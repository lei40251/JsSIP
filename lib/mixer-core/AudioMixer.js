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

    /** @type {Set<MediaStreamAudioSourceNode>} 已连接的 WebAudio 源节点集合 */
    this._audioSources = new Set();

    /** @type {MediaStreamAudioDestinationNode|null} 混音输出目标节点 */
    this._audioDestination = null;

    /** @type {Map<string,Object>} 按 slot 组合创建的子混音 bus */
    this._audioBuses = new Map();

    /** @type {Map<string,Object>} 按 slot 组合创建的独立 AudioContext 子混音 */
    this._isolatedSubmixes = new Map();

    /** @type {AudioContext|null} WebAudio 上下文（延迟创建） */
    this._audioContext = null;

    /** @type {boolean} 是否已请求获取音频流 */
    this._audioRequested = false;

    /** @type {boolean} 是否已请求默认全量音频流 */
    this._defaultAudioRequested = false;

    /** @type {Promise|null} 正在进行的音频刷新操作 */
    this._audioRefreshPromise = null;

    /** @type {boolean} 是否已有排队等待的批量刷新 */
    this._audioRefreshScheduled = false;

    /** @type {boolean} 刷新过程中又有新的刷新请求标记 */
    this._audioRefreshPending = false;

    /** @type {Promise<boolean>|null} 音频系统初始化锁，避免并发创建多个 AudioContext */
    this._audioSystemReadyPromise = null;

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

    if (this._logger)
    {
      this._logger.debug('AudioMixer constructed');
    }
  }

  /**
   * 获取混合后的音频流。
   * 初始化 AudioContext（延迟创建），连接所有源的音频到 destination。
   *
   * @returns {Promise<MediaStream|null>} 仅包含音频轨的流；无音频源时返回 null
   */
  getAudioStream(options)
  {
    if (this._logger)
    {
      this._logger.debug(`getAudioStream(): ${JSON.stringify(options || null)}`);
    }
    const request = this._normalizeAudioRequest(options);

    if (!request)
    {
      if (this._logger)
      {
        this._logger.warn('getAudioStream() ignored: invalid request');
      }

      return Promise.resolve(null);
    }

    this._audioRequested = true;
    this._updateAudioInfo({
      status : 'requested',
      reason : ''
    });

    // 显式要求 isolated 时，slot 子混音走独立 AudioContext。
    if (request.type === 'slots' && options && options.isolated === true)
    {
      const isolatedSubmix = this._getOrCreateIsolatedSubmix(request.key, request.slots);

      isolatedSubmix.requested = true;
      
      return this._refreshIsolatedSubmixConnections(isolatedSubmix);
    }

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
   * 获取独立 AudioContext 的子混音音频流。
   * 每个 slot 组合都会创建并复用自己的 AudioContext 与 destination。
   *
   * @param {Object|Array<number>} options - { slots: number[] } 或 slots 数组
   * @returns {Promise<MediaStream|null>} 子混音音频流；参数无效时返回 null
   */
  getIsolatedSubmixAudioStream(options)
  {
    if (this._logger)
    {
      this._logger.debug(`getIsolatedSubmixAudioStream(): ${JSON.stringify(options || null)}`);
    }

    const request = this._normalizeAudioRequest(options);

    if (!request || request.type !== 'slots')
    {
      return Promise.resolve(null);
    }

    this._audioRequested = true;
    this._updateAudioInfo({
      requested : true,
      status    : 'requested',
      reason    : ''
    });

    const submix = this._getOrCreateIsolatedSubmix(request.key, request.slots);

    submix.requested = true;

    return this._refreshIsolatedSubmixConnections(submix);
  }

  /**
   * 释放指定 slots 的子混音请求与连接。
   * 用于上层在切换子混音组合时主动回收旧链路，避免长期占用音频资源。
   *
   * @param {Object|Array<number>} options - { slots:number[], isolated?:boolean } 或 slots 数组
   * @returns {boolean} true 表示成功释放；false 表示参数无效或目标不存在
   */
  releaseSubmixAudioStream(options)
  {
    if (this._logger)
    {
      this._logger.debug(`releaseSubmixAudioStream(): ${JSON.stringify(options || null)}`);
    }

    const request = this._normalizeAudioRequest(options);

    if (!request || request.type !== 'slots')
    {
      return false;
    }

    if (options && options.isolated === true)
    {
      const submix = this._isolatedSubmixes.get(request.key);

      if (!submix)
      {
        return false;
      }

      submix.requested = false;
      this._disconnectIsolatedSubmix(submix, true);
      this._isolatedSubmixes.delete(request.key);
      this._refreshRequestedState();

      return true;
    }

    const bus = this._audioBuses.get(request.key);

    if (!bus)
    {
      return false;
    }

    bus.requested = false;
    this._disconnectAudioBus(bus);
    this._audioBuses.delete(request.key);
    this._refreshRequestedState();

    return true;
  }

  /**
   * 计划一次异步音频刷新。
   * 适用于不能直接 await 的路径（如 appendStream 循环内）。
   * 如果已有正在进行的刷新，标记 pending 并在完成后自动重刷。
   */
  scheduleRefresh()
  {
    if (this._logger)
    {
      this._logger.debug(`scheduleRefresh(): requested=${this._audioRequested} destroyed=${this._getDestroyed()}`);
    }

    if (!this._audioRequested || this._getDestroyed())
    {
      return;
    }

    if (this._audioRefreshScheduled)
    {
      this._audioRefreshPending = true;

      return;
    }

    this._audioRefreshScheduled = true;
    this._queueAudioRefresh(() =>
    {
      this._audioRefreshScheduled = false;
      this._runScheduledRefresh();
    });
  }

  _runScheduledRefresh()
  {
    if (this._logger)
    {
      this._logger.debug('Running scheduled audio refresh');
    }

    if (!this._audioRequested || this._getDestroyed())
    {
      this._audioRefreshPending = false;

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

      const previousSignature = source.audioTrackSignature;
      const currentSignature = this._getAudioTrackSignature(currentStream);

      // 已有音频连接但音频轨真正变化了，断开旧连接
      if (source.audioSourceNode && !this._isSameAudioTrackSignature(previousSignature, currentSignature))
      {
        this.disconnectSource(source);
        needsRefresh = true;

        return;
      }

      // stream 引用变化但音频轨不变时无需重建 source；只有新增音轨才刷新连接。
      if (currentStream && currentStream !== previousStream && this._sourceRegistry.hasLiveAudioTrack(source) && !source.audioSourceNode)
      {
        needsRefresh = true;
      }
    });

    if (needsRefresh)
    {
      if (this._logger)
      {
        this._logger.debug('External source audio changed, scheduling refresh');
      }

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
    if (this._logger && source)
    {
      this._logger.debug(`Disconnecting audio source: id=${source.id}`);
    }

    this._destroySourceNode(source);
  }

  _destroySourceNode(source)
  {
    const audioSourceNode = source.audioSourceNode;
    const masterGainNode = source.masterGainNode;

    this._audioBuses.forEach((bus) => this._disconnectBusSource(bus, source));
    this._isolatedSubmixes.forEach((submix) => this._disconnectIsolatedSubmixSource(submix, source));

    if (source.gainNode)
    {
      this._disposeOutputGain(source, source.gainNode, true);
      source.gainNode = null;
    }

    source.audioStream = null;
    source.audioTrackId = null;
    source.audioTrackSignature = null;

    if (audioSourceNode)
    {
      this._audioSources.delete(audioSourceNode);
      this._safeDisconnect(audioSourceNode);
    }

    if (masterGainNode)
    {
      this._safeDisconnect(masterGainNode);
    }

    source.audioSourceNode = null;
    source.masterGainNode = null;
    if (source.outputGains)
    {
      source.outputGains.clear();
      source.outputGains = null;
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
    if (this._logger)
    {
      this._logger.debug('Stopping AudioMixer');
    }

    if (this._audioDestination)
    {
      this._safeDisconnect(this._audioDestination);

      this._audioDestination = null;
    }

    this._sourceRegistry.sources.forEach((source) =>
    {
      this._destroySourceNode(source);
    });

    const audioContext = this._audioContext;

    // 先断开引用，防止 stop 后并发路径继续复用旧 context。
    this._audioContext = null;
    this._audioSystemReadyPromise = null;
    if (audioContext)
    {
      audioContext.close().catch((error) =>
      {
        this._logger.warn(`Failed to close AudioContext: ${error.message || String(error)}`);
      });
    }
    this._audioSources = new Set();
    this._audioBuses.forEach((bus) =>
    {
      this._disconnectAudioBus(bus);
    });
    this._audioBuses.clear();
    this._isolatedSubmixes.forEach((submix) =>
    {
      this._disconnectIsolatedSubmix(submix, true);
    });
    this._isolatedSubmixes.clear();
    this._audioRequested = false;
    this._defaultAudioRequested = false;
    this._audioRefreshPromise = null;
    this._audioRefreshScheduled = false;
    this._audioRefreshPending = false;
    this._audioSystemReadyPromise = null;
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

    if (this._logger)
    {
      this._logger.debug(`Ensuring audio system: defaultDestination=${options.defaultDestination}`);
    }

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

      this._audioContext = this._createAudioContext(AudioContextConstructor);
    }

    if (this._audioSystemReadyPromise)
    {
      return this._audioSystemReadyPromise;
    }

    // 浏览器自动暂停时，尝试恢复
    const resumePromise = this._audioContext.state === 'suspended' ? this._audioContext.resume() : Promise.resolve();

    this._audioSystemReadyPromise = resumePromise
      .then(() =>
      {
        if (this._getDestroyed())
        {
          this._audioSystemReadyPromise = null;

          return false;
        }

        if (options.defaultDestination && !this._audioDestination)
        {
          this._audioDestination = this._createAudioDestination();
        }

        this._updateAudioInfo({
          status : this._audioContext.state === 'suspended' ? 'suspended' : 'ready',
          reason : ''
        });

        this._audioSystemReadyPromise = null;

        return true;
      })
      .catch((error) =>
      {
        this._updateAudioInfo({
          status    : 'failed',
          reason    : 'AudioContext resume failed',
          lastError : error.message || String(error)
        });

        this._audioSystemReadyPromise = null;

        return false;
      });

    return this._audioSystemReadyPromise;
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
      if (this._logger)
      {
        this._logger.debug('Audio request normalized to default mix');
      }

      return { type: 'default' };
    }

    const rawSlots = options instanceof Array ? options : options.slots;

    if (!(rawSlots instanceof Array))
    {
      if (this._logger)
      {
        this._logger.warn(`Audio request invalid: ${JSON.stringify(options)}`);
      }

      return null;
    }

    const slots = rawSlots
      .map((slot) => Number(slot))
      .filter((slot) => Number.isInteger(slot) && slot >= 0)
      .filter((slot, index, values) => values.indexOf(slot) === index)
      .sort((a, b) => a - b);

    if (slots.length === 0)
    {
      if (this._logger)
      {
        this._logger.warn(`Audio request empty after normalization: ${JSON.stringify(options)}`);
      }

      return null;
    }

    if (this._logger)
    {
      this._logger.debug(`Audio request normalized: slots=${slots.join(',')}`);
    }

    return {
      type  : 'slots',
      key   : slots.join(','),
      slots : slots
    };
  }

  _queueAudioRefresh(callback)
  {
    if (typeof setTimeout === 'function')
    {
      setTimeout(callback, 0);

      return;
    }

    Promise.resolve().then(callback);
  }

  _refreshRequestedState()
  {
    const hasRequestedBus = Array.from(this._audioBuses.values())
      .some((bus) => bus && bus.requested);
    const hasRequestedIsolatedSubmix = Array.from(this._isolatedSubmixes.values())
      .some((submix) => submix && submix.requested);

    this._audioRequested = this._defaultAudioRequested ||
      hasRequestedBus ||
      hasRequestedIsolatedSubmix;
  }

  _createAudioContext(AudioContextConstructor)
  {
    try
    {
      return new AudioContextConstructor({ sampleRate: 48000 });
    }
    catch (error)
    {
      return new AudioContextConstructor();
    }
  }

  _createAudioDestination()
  {
    const destination = this._audioContext.createMediaStreamDestination();

    return destination;
  }

  _isDestinationTrackHealthy(destination)
  {
    if (!destination || !destination.stream || !destination.stream.getAudioTracks)
    {
      return false;
    }

    const tracks = destination.stream.getAudioTracks();

    return tracks.some((track) => track && track.readyState === 'live');
  }

  _ensureBusDestination(bus)
  {
    if (!bus)
    {
      return null;
    }

    if (!bus.destination)
    {
      bus.destination = this._createAudioDestination();

      return bus.destination;
    }

    if (!this._isDestinationTrackHealthy(bus.destination))
    {
      const track = bus.destination.stream.getAudioTracks()[0];
      const ended = track && track.readyState === 'ended';

      if (ended)
      {
        bus.connections.forEach((connection) =>
        {
          this._disposeOutputGain(connection.source || null, connection.gainNode, true);
        });
        bus.connections.clear();
        this._safeDisconnect(bus.destination);
        bus.destination = this._createAudioDestination();
      }
    }

    return bus.destination;
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

      if (this._logger)
      {
        this._logger.debug(`Audio bus created: key=${key} slots=${slots.join(',')}`);
      }
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

    this._isolatedSubmixes.forEach((submix) =>
    {
      if (submix.requested)
      {
        chain = chain.then(() => this._refreshIsolatedSubmixConnections(submix));
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
    return bus ? bus.connections.size : this._audioSources.size;
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
      this._disposeOutputGain(source, connection.gainNode, true);
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

    if (this._logger)
    {
      this._logger.debug(`Disconnecting audio bus: key=${bus.key}`);
    }

    bus.connections.forEach((connection) =>
    {
      if (connection.gainNode)
      {
        this._disposeOutputGain(connection.source || null, connection.gainNode, true);
      }
    });
    bus.connections.clear();

    if (bus.destination)
    {
      this._safeDisconnect(bus.destination);

      bus.destination = null;
    }
  }

  /**
   * 获取或创建独立 AudioContext 子混音。
   *
   * @param {string} key - 归一化后的 slots key
   * @param {Array<number>} slots - slot 列表
   * @returns {Object} 子混音对象
   */
  _getOrCreateIsolatedSubmix(key, slots)
  {
    let submix = this._isolatedSubmixes.get(key);

    if (!submix)
    {
      submix = {
        key          : key,
        slots        : slots.slice(),
        requested    : false,
        audioContext : null,
        destination  : null,
        connections  : new Map(),
        readyPromise : null
      };
      this._isolatedSubmixes.set(key, submix);

      if (this._logger)
      {
        this._logger.debug(`Isolated submix created: key=${key} slots=${slots.join(',')}`);
      }
    }

    return submix;
  }

  _ensureIsolatedSubmixSystem(submix)
  {
    if (this._logger && submix)
    {
      this._logger.debug(`Ensuring isolated submix system: key=${submix.key}`);
    }

    if (!submix || this._getDestroyed())
    {
      return Promise.resolve(false);
    }

    if (!submix.audioContext)
    {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

      if (!AudioContextConstructor)
      {
        this._logger.warn('AudioContext is not available');

        return Promise.resolve(false);
      }

      submix.audioContext = this._createAudioContext(AudioContextConstructor);
    }

    if (submix.readyPromise)
    {
      return submix.readyPromise;
    }

    const resumePromise = submix.audioContext.state === 'suspended' ?
      submix.audioContext.resume() : Promise.resolve();

    submix.readyPromise = resumePromise
      .then(() =>
      {
        if (this._getDestroyed())
        {
          submix.readyPromise = null;

          return false;
        }

        if (!submix.destination)
        {
          submix.destination = submix.audioContext.createMediaStreamDestination();
        }

        submix.readyPromise = null;

        return true;
      })
      .catch(() =>
      {
        submix.readyPromise = null;

        return false;
      });

    return submix.readyPromise;
  }

  _disconnectIsolatedSubmixSource(submix, source)
  {
    if (!submix || !submix.connections || !source)
    {
      return;
    }

    const connection = submix.connections.get(source.id);

    if (!connection)
    {
      return;
    }

    if (connection.gainNode)
    {
      this._disposeOutputGain(source, connection.gainNode, true);
    }

    if (connection.sourceNode)
    {
      this._safeDisconnect(connection.sourceNode);
    }

    if (connection.ownsClonedTrack && connection.clonedTrack && connection.clonedTrack.stop)
    {
      try
      {
        connection.clonedTrack.stop();
      }
      catch (error)
      {}
    }

    submix.connections.delete(source.id);
  }

  _disconnectIsolatedSubmix(submix, closeContext)
  {
    if (!submix)
    {
      return;
    }

    if (this._logger)
    {
      this._logger.debug(`Disconnecting isolated submix: key=${submix.key} closeContext=${closeContext}`);
    }

    submix.connections.forEach((connection) =>
    {
      if (connection.gainNode)
      {
        this._disposeOutputGain(connection.source || null, connection.gainNode, true);
      }

      if (connection.sourceNode)
      {
        this._safeDisconnect(connection.sourceNode);
      }

      if (connection.ownsClonedTrack && connection.clonedTrack && connection.clonedTrack.stop)
      {
        try
        {
          connection.clonedTrack.stop();
        }
        catch (error)
        {}
      }
    });
    submix.connections.clear();

    if (submix.destination)
    {
      this._safeDisconnect(submix.destination);
      submix.destination = null;
    }

    if (closeContext && submix.audioContext)
    {
      submix.audioContext.close().catch((error) =>
      {
        this._logger.warn(`Failed to close isolated AudioContext: ${error.message || String(error)}`);
      });
      submix.audioContext = null;
      submix.readyPromise = null;
    }
  }

  _refreshIsolatedSubmixConnections(submix)
  {
    if (this._logger && submix)
    {
      this._logger.debug(`Refreshing isolated submix connections: key=${submix.key}`);
    }

    if (!submix || this._getDestroyed())
    {
      return Promise.resolve(null);
    }

    submix.connections.forEach((connection, sourceId) =>
    {
      const source = this._sourceRegistry.find(sourceId);
      const stream = source && this._sourceRegistry.getStream(source);
      const signature = this._getAudioTrackSignature(stream);
      const shouldDisconnect = !source ||
        submix.slots.indexOf(source.slot) === -1 ||
        !this._sourceRegistry.hasLiveAudioTrack(source) ||
        !this._isSameAudioTrackSignature(connection.audioTrackSignature, signature);

      if (shouldDisconnect)
      {
        this._disconnectIsolatedSubmixSource(submix, connection.source || source || { id: sourceId });
      }
    });

    return this._ensureIsolatedSubmixSystem(submix)
      .then((ready) =>
      {
        if (!ready || !submix.destination || !submix.audioContext)
        {
          return null;
        }

        if (!this._isDestinationTrackHealthy(submix.destination))
        {
          const track = submix.destination.stream.getAudioTracks()[0];
          const ended = track && track.readyState === 'ended';

          if (ended)
          {
            this._disconnectIsolatedSubmix(submix, false);
            submix.destination = submix.audioContext.createMediaStreamDestination();
          }
        }

        const liveSources = this._getLiveAudioSources(submix);

        liveSources.forEach((source) =>
        {
          if (submix.connections.has(source.id))
          {
            this._syncSourceOutputGains(source);

            return;
          }

          const stream = this._sourceRegistry.getStream(source);
          const signature = this._getAudioTrackSignature(stream);

          if (!stream || !signature)
          {
            return;
          }

          try
          {
            const originalTrack = signature.track;
            let clonedTrack = null;
            let clonedStream = null;
            let ownsClonedTrack = false;

            if (originalTrack && originalTrack.clone)
            {
              try
              {
                clonedTrack = originalTrack.clone();
                clonedStream = new MediaStream([ clonedTrack ]);
                ownsClonedTrack = true;
              }
              catch (error)
              {
                // clone 失败时退回原始 stream，避免直接丢失该路子混音。
                clonedTrack = null;
                clonedStream = stream;
                ownsClonedTrack = false;
              }
            }
            else
            {
              clonedStream = stream;
            }

            const sourceNode = submix.audioContext.createMediaStreamSource(clonedStream);
            const gainNode = submix.audioContext.createGain();

            gainNode.gain.value = source.gain;
            sourceNode.connect(gainNode);
            gainNode.connect(submix.destination);
            this._registerOutputGain(source, gainNode);

            submix.connections.set(source.id, {
              sourceNode          : sourceNode,
              gainNode            : gainNode,
              source              : source,
              audioTrackSignature : signature,
              clonedTrack         : clonedTrack,
              clonedStream        : clonedStream,
              ownsClonedTrack     : ownsClonedTrack
            });
          }
          catch (error)
          {
            this._logger.warn(`Failed to connect isolated submix source: ${error.message || String(error)}`);
          }
        });

        return submix.destination.stream;
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
  _refreshAudioConnections(bus)
  {
    if (this._logger)
    {
      this._logger.debug(`Refreshing audio connections: target=${bus ? `bus:${bus.key}` : 'default'}`);
    }

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
      const signature = this._getAudioTrackSignature(stream);

      const shouldDestroySource = source.audioSourceNode &&
        (!this._sourceRegistry.hasLiveAudioTrack(source) || !this._isSameAudioTrackSignature(source.audioTrackSignature, signature));

      if (shouldDestroySource)
      {
        this.disconnectSource(source);
      }
    });

    if (bus)
    {
      bus.connections.forEach((connection, sourceId) =>
      {
        const source = this._sourceRegistry.find(sourceId);
        const stream = source && this._sourceRegistry.getStream(source);
        const signature = this._getAudioTrackSignature(stream);
        const trackChanged = source && !this._isSameAudioTrackSignature(source.audioTrackSignature, signature);
        const shouldDisconnect = !source ||
          bus.slots.indexOf(source.slot) === -1 ||
          !this._sourceRegistry.hasLiveAudioTrack(source) ||
          trackChanged;

        if (shouldDisconnect)
        {
          this._disconnectBusSource(bus, connection.source || source || { id: sourceId });
        }
      });
    }

    const liveSourcesBeforeReady = this._getLiveAudioSources(bus);

    // 默认全量混音保持延迟创建：无源时不创建 AudioContext。
    if (!bus && liveSourcesBeforeReady.length === 0)
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
          this._ensureBusDestination(bus);
        }
        else if (bus)
        {
          this._ensureBusDestination(bus);
        }

        const liveSources = this._getLiveAudioSources(bus);

        // 子混音 bus 返回稳定的纯音频流；即使当前无源，后续 append 后也复用同一个 destination。
        if (liveSources.length === 0)
        {
          this._logger.debug('No live audio sources, skip audio source connection');
          this._updateTargetAudioInfo(bus, {
            status : 'no-source',
            reason : 'No live audio source'
          });

          return bus ? bus.destination.stream : null;
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
    const signature = this._getAudioTrackSignature(stream);
    const trackId = signature && signature.id;

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
      if (!this._isSameAudioTrackSignature(source.audioTrackSignature, signature))
      {
        this.disconnectSource(source);
      }
    }

    try
    {
      if (this._logger)
      {
        this._logger.debug(`Connecting audio source: id=${source.id} target=${bus ? `bus:${bus.key}` : 'default'}`);
      }

      if (bus && bus.connections.has(source.id))
      {
        this._syncSourceOutputGains(source);

        return true;
      }

      const audioSourceNode = source.audioSourceNode || this._audioContext.createMediaStreamSource(stream);
      const masterGainNode = source.masterGainNode || this._audioContext.createGain();
      const gainNode = this._audioContext.createGain();

      gainNode.gain.value = source.gain;
      this._registerOutputGain(source, gainNode);

      if (!source.audioSourceNode)
      {
        source.audioSourceNode = audioSourceNode;
        source.masterGainNode = masterGainNode;
        source.audioStream = stream;
        source.audioTrackId = trackId;
        source.audioTrackSignature = signature;
        masterGainNode.gain.value = 1;
        audioSourceNode.connect(masterGainNode);
      }

      if (bus)
      {
        masterGainNode.connect(gainNode);
        gainNode.connect(bus.destination);
        bus.connections.set(source.id, {
          audioSourceNode : audioSourceNode,
          masterGainNode  : masterGainNode,
          gainNode        : gainNode,
          source          : source,
          audioStream     : stream,
          audioTrackId    : trackId
        });

        return true;
      }

      if (source.gainNode)
      {
        this._syncSourceOutputGains(source);

        return false;
      }

      masterGainNode.connect(gainNode);
      gainNode.connect(this._audioDestination);

      source.gainNode = gainNode;
      this._audioSources.add(audioSourceNode);

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
      connectedSources : this._countConnectedSources(),
      outputTracks     : this._audioDestination ? this._audioDestination.stream.getAudioTracks().length : 0
    }, info || {});

    if (info && this._logger)
    {
      this._logger.debug(`Audio info updated: ${JSON.stringify(this._audioInfo)}`);
    }
  }

  _countConnectedSources()
  {
    let busConnections = 0;
    let isolatedConnections = 0;

    this._audioBuses.forEach((bus) =>
    {
      busConnections += bus.connections.size;
    });

    this._isolatedSubmixes.forEach((submix) =>
    {
      isolatedConnections += submix.connections.size;
    });

    return this._audioSources.size + busConnections + isolatedConnections;
  }

  _registerOutputGain(source, gainNode)
  {
    if (!source || !gainNode)
    {
      return;
    }

    if (!source.outputGains)
    {
      source.outputGains = new Set();
    }

    source.outputGains.add(gainNode);
  }

  _disposeOutputGain(source, gainNode, disconnect)
  {
    if (!gainNode)
    {
      return;
    }

    try
    {
      gainNode.gain.value = 0;
    }
    catch (error)
    {}

    if (source && source.outputGains)
    {
      source.outputGains.delete(gainNode);
    }

    if (disconnect)
    {
      this._safeDisconnect(gainNode);
    }
  }

  _syncSourceOutputGains(source)
  {
    if (!source || !source.outputGains)
    {
      return;
    }

    source.outputGains.forEach((gainNode) =>
    {
      if (gainNode && gainNode.gain)
      {
        gainNode.gain.value = source.gain;
      }
    });
  }

  _safeDisconnect(node)
  {
    if (!node || !node.disconnect)
    {
      return;
    }

    try
    {
      node.disconnect();
    }
    catch (error)
    {}
  }

  _getAudioTrackId(stream)
  {
    const signature = this._getAudioTrackSignature(stream);

    return signature ? signature.id : null;
  }

  _getAudioTrackSignature(stream)
  {
    if (!stream || !stream.getAudioTracks)
    {
      return null;
    }

    const track = stream.getAudioTracks().find((item) => item.readyState === 'live') || stream.getAudioTracks()[0];

    if (!track)
    {
      return null;
    }

    return {
      track : track,
      id    : track.id || ''
    };
  }

  _isSameAudioTrackSignature(previous, current)
  {
    if (!previous || !current)
    {
      return previous === current;
    }

    return previous.track === current.track &&
      previous.id === current.id;
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
    return Array.from(this._audioSources);
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
