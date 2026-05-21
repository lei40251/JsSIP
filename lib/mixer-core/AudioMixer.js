/**
 * AudioMixer — WebAudio 混音模块
 *
 * 负责混流器的音频处理部分：
 *   - 延迟创建 AudioContext（用户交互后才初始化）
 *   - 每路输入源独立 GainNode 控制音量
 *   - 汇总到 MediaStreamAudioDestinationNode 输出
 *   - 支持动态增删源、外部换源检测、自动重连
 *
 * @module AudioMixer
 */
class AudioMixer
{
  /**
   * @param {Object} options
   * @param {Object} options.logger - 日志记录器
   * @param {Function} options.getDestroyed - 返回混流器是否已销毁的回调
   * @param {Object} options.sourceRegistry - SourceRegistry 实例
   * @param {Function} options.onAudioTrackAvailable - 音频轨可用时的回调（用于补充到 mixed stream）
   */
  constructor(options)
  {
    options = options || {};

    this._logger = options.logger;
    this._getDestroyed = options.getDestroyed;
    this._sourceRegistry = options.sourceRegistry;
    this._onAudioTrackAvailable = options.onAudioTrackAvailable;

    /** @type {Array<MediaStreamAudioSourceNode>} 已连接的 WebAudio 源节点列表 */
    this._audioSources = [];

    /** @type {MediaStreamAudioDestinationNode|null} 混音输出目标节点 */
    this._audioDestination = null;

    /** @type {AudioContext|null} WebAudio 上下文（延迟创建） */
    this._audioContext = null;

    /** @type {boolean} 是否已请求获取音频流 */
    this._audioRequested = false;

    /** @type {Promise|null} 正在进行的音频刷新操作 */
    this._audioRefreshPromise = null;

    /** @type {boolean} 刷新过程中又有新的刷新请求标记 */
    this._audioRefreshPending = false;

    /** @type {Object} 音频系统状态信息（调试用） */
    this._audioInfo = {
      requested        : false,
      status           : 'not-requested',
      contextState     : null,
      sourceCount      : 0,
      liveSourceCount  : 0,
      connectedSources : 0,
      outputTracks     : 0,
      reason           : '',
      lastError        : ''
    };
  }

  /**
   * 获取混合后的音频流。
   * 初始化 AudioContext（延迟创建），连接所有源的音频到 destination。
   *
   * @returns {Promise<MediaStream|null>} 仅包含音频轨的流；无音频源时返回 null
   */
  getAudioStream()
  {
    this._audioRequested = true;
    this._updateAudioInfo({
      status : 'requested',
      reason : ''
    });

    return this._refreshAudioConnections();
  }

  /**
   * 计划一次异步音频刷新。
   * 适用于不能直接 await 的路径（如 appendStream 循环内）。
   * 如果已有正在进行的刷新，标记 pending 并在完成后自动重刷。
   */
  scheduleRefresh()
  {
    if (!this._audioRequested || this._getDestroyed())
    {
      return;
    }

    if (this._audioRefreshPromise)
    {
      this._audioRefreshPending = true;

      return;
    }

    this._audioRefreshPromise = this._refreshAudioConnections()
      .catch((error) =>
      {
        this._logger.warn(`Failed to refresh mixed audio: ${error.message || String(error)}`);
        this._updateAudioInfo({
          status    : 'failed',
          reason    : 'Failed to refresh mixed audio',
          lastError : error.message || String(error)
        });
      })
      .then((stream) =>
      {
        const needsAnotherRefresh = this._audioRefreshPending;

        this._audioRefreshPromise = null;
        this._audioRefreshPending = false;

        if (needsAnotherRefresh)
        {
          this.scheduleRefresh();
        }

        return stream || null;
      });
  }

  /**
   * 检测外部 HTMLMediaElement 是否替换了 srcObject，并同步音频连接。
   *
   * 遍历所有源，检查 stream 引用是否变化。如果发现换源：
   *   - 已有音频连接的源：断开旧连接，标记需要刷新
   *   - 新出现音频轨的源：标记需要刷新
   */
  syncExternalSourceAudio()
  {
    if (!this._audioRequested && !this._audioContext)
    {
      return;
    }

    let needsRefresh = false;

    this._sourceRegistry.sources.forEach((source) =>
    {
      const previousStream = source.stream;
      const currentStream = this._sourceRegistry.getStream(source);

      // 已有音频连接但 stream 变化了，断开旧连接
      if (source.audioSourceNode && source.audioStream !== currentStream)
      {
        this.disconnectSource(source);
        needsRefresh = true;

        return;
      }

      // stream 引用变化且有音频轨，需要刷新连接
      if (currentStream && currentStream !== previousStream && this._sourceRegistry.hasLiveAudioTrack(source))
      {
        needsRefresh = true;
      }
    });

    if (needsRefresh)
    {
      this.scheduleRefresh();
    }
  }

  /**
   * 断开一路源的音频连接，释放 WebAudio 节点。
   *
   * 调用场景：
   *   - removeStream() 移除源时
   *   - appendStream() 同 slot 覆盖时
   *   - 外部 HTMLVideoElement 换源检测触发时
   *
   * @param {Object} source - 内部 source 对象
   */
  disconnectSource(source)
  {
    const audioSourceNode = source.audioSourceNode;

    if (source.gainNode)
    {
      source.gainNode.disconnect();
      source.gainNode = null;
    }

    if (source.audioSourceNode)
    {
      source.audioSourceNode.disconnect();
      source.audioSourceNode = null;
    }

    source.audioStream = null;

    if (audioSourceNode)
    {
      this._audioSources = this._audioSources.filter((sourceNode) => sourceNode !== audioSourceNode);
    }
  }

  /**
   * 获取当前音频系统状态快照。
   * 返回副本，外部修改不影响内部状态。
   *
   * @returns {Object} 音频状态信息
   */
  getInfo()
  {
    this._updateAudioInfo();

    return Object.assign({}, this._audioInfo);
  }

  /**
   * 停止音频系统，释放所有资源。
   *
   * 清理步骤：
   *   1. 断开并清空 AudioDestination 节点
   *   2. 关闭 AudioContext
   *   3. 清空源节点列表
   *   4. 重置请求状态
   */
  stop()
  {
    if (this._audioDestination)
    {
      try
      {
        this._audioDestination.disconnect();
      }
      catch (error)
      {}

      this._audioDestination = null;
    }

    if (this._audioContext)
    {
      this._audioContext.close();
    }

    this._audioContext = null;
    this._audioSources = [];
    this._audioRequested = false;
    this._audioRefreshPromise = null;
    this._audioRefreshPending = false;
    this._updateAudioInfo({
      status : 'stopped',
      reason : 'Mixer stopped'
    });
  }

  /**
   * 确保音频系统已初始化（创建 AudioContext + Destination）。
   *
   * 如果浏览器不支持 AudioContext 或恢复失败，Promise resolve false。
   * AudioContext 在用户交互后自动 resume（浏览器 autoplay 政策）。
   *
   * @returns {Promise<boolean>} true=音频系统就绪
   */
  _ensureAudioSystem()
  {
    if (this._getDestroyed())
    {
      return Promise.resolve(false);
    }

    if (!this._audioContext)
    {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

      if (!AudioContextConstructor)
      {
        this._logger.warn('AudioContext is not available');
        this._updateAudioInfo({
          status    : 'failed',
          reason    : 'AudioContext is not available',
          lastError : 'AudioContext is not available'
        });

        return Promise.resolve(false);
      }

      this._audioContext = new AudioContextConstructor();
    }

    // 浏览器自动暂停时，尝试恢复
    const resumePromise = this._audioContext.state === 'suspended' ? this._audioContext.resume() : Promise.resolve();

    return resumePromise
      .then(() =>
      {
        if (this._getDestroyed())
        {
          return false;
        }

        if (!this._audioDestination)
        {
          this._audioDestination = this._audioContext.createMediaStreamDestination();
        }

        this._updateAudioInfo({
          status : this._audioContext.state === 'suspended' ? 'suspended' : 'ready',
          reason : ''
        });

        return true;
      })
      .catch((error) =>
      {
        this._updateAudioInfo({
          status    : 'failed',
          reason    : 'AudioContext resume failed',
          lastError : error.message || String(error)
        });

        return false;
      });
  }

  /**
   * 刷新所有音频连接。
   *
   * 核心流程：
   *   1. 断开已无音频轨的旧源连接
   *   2. 如果没有 live 音频源，返回 null
   *   3. 确保音频系统已初始化
   *   4. 遍历所有源，为有音频轨且未连接的源建立 WebAudio 连接
   *
   * @returns {Promise<MediaStream|null>} audio destination stream，或 null
   */
  _refreshAudioConnections()
  {
    if (!this._audioRequested || this._getDestroyed())
    {
      this._updateAudioInfo({
        status : this._getDestroyed() ? 'stopped' : 'not-requested',
        reason : this._getDestroyed() ? 'Mixer stopped' : ''
      });

      return Promise.resolve(null);
    }

    // 先清理已无音频轨的旧连接
    this._sourceRegistry.sources.forEach((source) =>
    {
      if (source.audioSourceNode && !this._sourceRegistry.hasLiveAudioTrack(source))
      {
        this.disconnectSource(source);
      }
    });

    // 没有 live 音频源，跳过
    if (!this._sourceRegistry.hasAnyLiveAudioTrack())
    {
      this._logger.debug('No live audio sources, skip audio stream creation');
      this._updateAudioInfo({
        status : 'no-source',
        reason : 'No live audio source'
      });

      return Promise.resolve(null);
    }

    return this._ensureAudioSystem()
      .then((ready) =>
      {
        if (!ready)
        {
          this._updateAudioInfo({
            status : this._audioInfo.status === 'failed' ? 'failed' : 'not-started',
            reason : this._audioInfo.reason || 'Audio system is not ready'
          });

          return null;
        }

        const connectedSources = this._sourceRegistry.sources.filter((source) => this._connectSource(source));

        if (this._audioSources.length === 0 && connectedSources.length === 0)
        {
          this._logger.warn('No valid audio sources, skip audio stream creation');
          this._updateAudioInfo({
            status : 'failed',
            reason : 'No audio source connected'
          });

          return null;
        }

        this._updateAudioInfo({
          status : this._audioContext && this._audioContext.state === 'suspended' ? 'suspended' : 'mixing',
          reason : ''
        });

        return this._audioDestination.stream;
      });
  }

  /**
   * 连接一路源的音频到混音输出。
   *
   * 流程：createMediaStreamSource → GainNode → destination
   * 如果源已有音频连接且 stream 未变则跳过；如果 stream 变了则先断开再重连。
   *
   * @param {Object} source - 内部 source 对象
   * @returns {boolean} true=成功连接
   */
  _connectSource(source)
  {
    const stream = this._sourceRegistry.getStream(source);

    if (!this._audioContext || !this._audioDestination || !this._sourceRegistry.hasLiveAudioTrack(source))
    {
      return false;
    }

    if (source.audioSourceNode)
    {
      if (source.audioStream === stream)
      {
        return false;
      }

      this.disconnectSource(source);
    }

    try
    {
      const audioSourceNode = this._audioContext.createMediaStreamSource(stream);
      const gainNode = this._audioContext.createGain();

      gainNode.gain.value = source.gain;
      audioSourceNode.connect(gainNode);
      gainNode.connect(this._audioDestination);

      source.audioSourceNode = audioSourceNode;
      source.gainNode = gainNode;
      source.audioStream = stream;
      this._audioSources.push(audioSourceNode);

      if (this._onAudioTrackAvailable)
      {
        this._onAudioTrackAvailable(this._audioDestination.stream);
      }

      this._logger.debug('audio tracks: ', stream.getAudioTracks().length);

      return true;
    }
    catch (error)
    {
      this._logger.warn(`Failed to connect audio source: ${error.message}`);
      this._updateAudioInfo({
        status    : 'failed',
        reason    : 'Failed to connect audio source',
        lastError : error.message || String(error)
      });

      return false;
    }
  }

  /**
   * 更新音频状态信息（合并更新方式）。
   *
   * @param {Object} [info] - 要更新的字段（可选，不传则只同步计数器）
   */
  _updateAudioInfo(info)
  {
    Object.assign(this._audioInfo, {
      requested        : this._audioRequested,
      contextState     : this._audioContext ? this._audioContext.state : null,
      sourceCount      : this._sourceRegistry.sources.length,
      liveSourceCount  : this._sourceRegistry.sources.filter((source) => this._sourceRegistry.hasLiveAudioTrack(source)).length,
      connectedSources : this._audioSources.length,
      outputTracks     : this._audioDestination ? this._audioDestination.stream.getAudioTracks().length : 0
    }, info || {});
  }

  get requested()
  {
    return this._audioRequested;
  }

  get hasAudioContext()
  {
    return Boolean(this._audioContext);
  }

  get audioSources()
  {
    return this._audioSources;
  }

  get audioDestination()
  {
    return this._audioDestination;
  }

  get audioContext()
  {
    return this._audioContext;
  }

  get audioInfo()
  {
    return this._audioInfo;
  }
}

module.exports = AudioMixer;
