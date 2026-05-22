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

    /** @type {Map<string,Object>} 按 slot 组合创建的子混音 bus */
    this._audioBuses = new Map();

    /** @type {AudioContext|null} WebAudio 上下文（延迟创建） */
    this._audioContext = null;

    /** @type {boolean} 是否已请求获取音频流 */
    this._audioRequested = false;

    /** @type {boolean} 是否已请求默认全量音频流 */
    this._defaultAudioRequested = false;

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
  getAudioStream(options)
  {
    const request = this._normalizeAudioRequest(options);

    if (!request)
    {
      return Promise.resolve(null);
    }

    this._audioRequested = true;
    this._updateAudioInfo({
      status : 'requested',
      reason : ''
    });

    if (request.type === 'default')
    {
      this._defaultAudioRequested = true;

      return this._refreshAudioConnections();
    }

    const bus = this._getOrCreateAudioBus(request.key, request.slots);

    bus.requested = true;

    return this._refreshAudioConnections(bus);
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

    this._audioRefreshPromise = this._refreshRequestedAudioConnections()
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

    this._audioBuses.forEach((bus) => this._disconnectBusSource(bus, source));

    if (source.gainNode)
    {
      source.gainNode.disconnect();
      source.gainNode = null;
    }

    source.audioStream = null;

    if (audioSourceNode)
    {
      this._audioSources = this._audioSources.filter((sourceNode) => sourceNode !== audioSourceNode);
      audioSourceNode.disconnect();
    }

    source.audioSourceNode = null;
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
    this._audioBuses.forEach((bus) =>
    {
      this._disconnectAudioBus(bus);
    });
    this._audioBuses.clear();
    this._audioRequested = false;
    this._defaultAudioRequested = false;
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
  _ensureAudioSystem(options)
  {
    options = Object.assign({ defaultDestination: true }, options || {});

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

        if (options.defaultDestination && !this._audioDestination)
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
   * 归一化 getAudioStream() 参数。
   * 不传参数时返回默认全量混音；传 slots 时按 slot 组合创建子混音。
   *
   * @param {Object|Array<number>} options - getAudioStream 参数
   * @returns {Object|null} { type:'default' } 或 { type:'slots', key, slots }
   */
  _normalizeAudioRequest(options)
  {
    if (options === undefined || options === null)
    {
      return { type: 'default' };
    }

    const rawSlots = options instanceof Array ? options : options.slots;

    if (!(rawSlots instanceof Array))
    {
      return null;
    }

    const slots = rawSlots
      .map((slot) => Number(slot))
      .filter((slot) => Number.isInteger(slot) && slot >= 0)
      .filter((slot, index, values) => values.indexOf(slot) === index)
      .sort((a, b) => a - b);

    if (slots.length === 0)
    {
      return null;
    }

    return {
      type  : 'slots',
      key   : slots.join(','),
      slots : slots
    };
  }

  /**
   * 获取或创建按 slot 组合输出的音频 bus。
   *
   * @param {string} key - 归一化后的 slots key
   * @param {Array<number>} slots - slot 列表
   * @returns {Object} bus 对象
   */
  _getOrCreateAudioBus(key, slots)
  {
    let bus = this._audioBuses.get(key);

    if (!bus)
    {
      bus = {
        key         : key,
        slots       : slots.slice(),
        requested   : false,
        destination : null,
        connections : new Map(),
        info        : {
          status           : 'not-requested',
          connectedSources : 0,
          outputTracks     : 0
        }
      };
      this._audioBuses.set(key, bus);
    }

    return bus;
  }

  /**
   * 刷新默认混音和所有已请求的子混音 bus。
   *
   * @returns {Promise<MediaStream|null>} 默认混音流或最后一次刷新结果
   */
  _refreshRequestedAudioConnections()
  {
    let chain = Promise.resolve(null);

    if (this._defaultAudioRequested)
    {
      chain = chain.then(() => this._refreshAudioConnections());
    }

    this._audioBuses.forEach((bus) =>
    {
      if (bus.requested)
      {
        chain = chain.then(() => this._refreshAudioConnections(bus));
      }
    });

    return chain;
  }

  /**
   * 获取目标混音应连接的 live 音频源。
   *
   * @param {Object|null} bus - 子混音 bus，不传则为默认全量混音
   * @returns {Array<Object>} source 列表
   */
  _getLiveAudioSources(bus)
  {
    return this._sourceRegistry.sources.filter((source) =>
    {
      if (bus && bus.slots.indexOf(source.slot) === -1)
      {
        return false;
      }

      return this._sourceRegistry.hasLiveAudioTrack(source);
    });
  }

  /**
   * 返回指定目标当前连接数。
   *
   * @param {Object|null} bus - 子混音 bus，不传则为默认全量混音
   * @returns {number} 连接数
   */
  _getTargetConnectionCount(bus)
  {
    return bus ? bus.connections.size : this._audioSources.length;
  }

  /**
   * 更新默认混音或子混音状态。
   *
   * @param {Object|null} bus - 子混音 bus，不传则更新默认音频信息
   * @param {Object} info - 状态字段
   */
  _updateTargetAudioInfo(bus, info)
  {
    if (!bus)
    {
      this._updateAudioInfo(info);

      return;
    }

    Object.assign(bus.info, {
      status           : bus.info.status,
      connectedSources : bus.connections.size,
      outputTracks     : bus.destination ? bus.destination.stream.getAudioTracks().length : 0
    }, info || {});
  }

  /**
   * 断开 source 在指定子混音 bus 上的连接。
   *
   * @param {Object} bus - 子混音 bus
   * @param {Object} source - 内部 source 对象
   */
  _disconnectBusSource(bus, source)
  {
    if (!bus || !bus.connections)
    {
      return;
    }

    const connection = bus.connections.get(source.id);

    if (!connection)
    {
      return;
    }

    if (connection.gainNode)
    {
      connection.gainNode.disconnect();
    }

    bus.connections.delete(source.id);
    this._updateTargetAudioInfo(bus);
  }

  /**
   * 断开并释放一个子混音 bus。
   *
   * @param {Object} bus - 子混音 bus
   */
  _disconnectAudioBus(bus)
  {
    if (!bus)
    {
      return;
    }

    bus.connections.forEach((connection) =>
    {
      if (connection.gainNode)
      {
        connection.gainNode.disconnect();
      }
    });
    bus.connections.clear();

    if (bus.destination)
    {
      try
      {
        bus.destination.disconnect();
      }
      catch (error)
      {}

      bus.destination = null;
    }
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
  _refreshAudioConnections(bus)
  {
    if ((!this._audioRequested && !bus) || this._getDestroyed())
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
      const stream = this._sourceRegistry.getStream(source);

      if (source.audioSourceNode && (!this._sourceRegistry.hasLiveAudioTrack(source) || source.audioStream !== stream))
      {
        this.disconnectSource(source);
      }
    });

    if (bus)
    {
      bus.connections.forEach((connection, sourceId) =>
      {
        const source = this._sourceRegistry.find(sourceId);
        const streamChanged = source && this._sourceRegistry.getStream(source) !== connection.audioStream;
        const shouldDisconnect = !source ||
          bus.slots.indexOf(source.slot) === -1 ||
          !this._sourceRegistry.hasLiveAudioTrack(source) ||
          streamChanged;

        if (shouldDisconnect)
        {
          if (connection.gainNode)
          {
            connection.gainNode.disconnect();
          }

          bus.connections.delete(sourceId);
        }
      });
    }

    const liveSources = this._getLiveAudioSources(bus);

    // 没有 live 音频源，跳过
    if (liveSources.length === 0)
    {
      this._logger.debug('No live audio sources, skip audio stream creation');
      this._updateTargetAudioInfo(bus, {
        status : 'no-source',
        reason : 'No live audio source'
      });

      return Promise.resolve(null);
    }

    return this._ensureAudioSystem({ defaultDestination: !bus })
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

        if (bus && !bus.destination)
        {
          bus.destination = this._audioContext.createMediaStreamDestination();
        }

        const connectedSources = liveSources.filter((source) => this._connectSource(source, bus));

        if (this._getTargetConnectionCount(bus) === 0 && connectedSources.length === 0)
        {
          this._logger.warn('No valid audio sources, skip audio stream creation');
          this._updateTargetAudioInfo(bus, {
            status : 'failed',
            reason : 'No audio source connected'
          });

          return null;
        }

        this._updateTargetAudioInfo(bus, {
          status : this._audioContext && this._audioContext.state === 'suspended' ? 'suspended' : 'mixing',
          reason : ''
        });

        return bus ? bus.destination.stream : this._audioDestination.stream;
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
  _connectSource(source, bus)
  {
    const stream = this._sourceRegistry.getStream(source);

    if (!this._audioContext || !this._sourceRegistry.hasLiveAudioTrack(source))
    {
      return false;
    }

    if (!bus && !this._audioDestination)
    {
      return false;
    }

    if (bus && !bus.destination)
    {
      return false;
    }

    if (source.audioSourceNode)
    {
      if (source.audioStream !== stream)
      {
        this.disconnectSource(source);
      }
    }

    try
    {
      const audioSourceNode = source.audioSourceNode || this._audioContext.createMediaStreamSource(stream);
      const gainNode = this._audioContext.createGain();

      gainNode.gain.value = source.gain;

      if (!source.audioSourceNode)
      {
        source.audioSourceNode = audioSourceNode;
        source.audioStream = stream;
      }

      if (bus)
      {
        if (bus.connections.has(source.id))
        {
          return false;
        }

        audioSourceNode.connect(gainNode);
        gainNode.connect(bus.destination);
        bus.connections.set(source.id, {
          audioSourceNode : audioSourceNode,
          gainNode        : gainNode,
          audioStream     : stream
        });

        return true;
      }

      if (source.gainNode)
      {
        return false;
      }

      audioSourceNode.connect(gainNode);
      gainNode.connect(this._audioDestination);

      source.gainNode = gainNode;
      if (!this._audioSources.some((sourceNode) => sourceNode === audioSourceNode))
      {
        this._audioSources.push(audioSourceNode);
      }

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
