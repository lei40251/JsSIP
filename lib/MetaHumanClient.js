const EventEmitter = require('events').EventEmitter;
const Logger = require('./Logger');
const Exceptions = require('./Exceptions');
const issueUtils = require('./MediaEffectsIssue');

const logger = new Logger('MetaHumanClient');
const getErrorMessage = issueUtils.getErrorMessage;
const META_HUMAN_MEDIA_EFFECTS_ISSUE_DEFAULTS = {
  module          : 'AiNS',
  component       : 'MetaHumanClient',
  stage           : 'unknown',
  severity        : 'error',
  message         : 'unknown media effects issue',
  fallbackApplied : false,
  degraded        : false,
  details         : null
};

/**
 * MetaHumanClient — 数字人 WebRTC 客户端
 *
 * 封装与数字人后端的 WebRTC 连接流程，可选集成 AI 降噪（AiNoiseSuppression）。
 *
 * @example
 *   const mh = new CRTC.MetaHumanClient({
 *     server     : 'https://dev.vsbc.com:9090',
 *     iceServers : [{ urls: 'turn:...', username: '...', credential: '...' }],
 *     avatar     : 'wav2lip256_avatar1',
 *     flag       : 0
 *   });
 *
 *   mh.on('track', (evt) => { videoEl.srcObject = evt.stream; });
 *   mh.on('error', (evt) => { console.error(evt.cause); });
 *
 *   mh.connect();
 */
module.exports = class MetaHumanClient extends EventEmitter
{
  /**
   * @param {object} options
   * @param {string} options.server             - 数字人后端服务地址（如 https://dev.vsbc.com:9090）
   * @param {Array}  options.iceServers         - ICE 服务器列表
   * @param {string} options.avatar             - 数字人头像标识
   * @param {number} [options.flag=0]           - ASR/TTS 处理开关（0 不处理，1 处理）
   * @param {object} [options.audioConstraints] - 麦克风采集约束
   * @param {number} [options.audioConstraints.sampleRate=48000]
   * @param {number} [options.audioConstraints.channelCount=1]
   * @param {string} [options.micDeviceId]      - 指定麦克风设备 deviceId（可选）
   * @param {object} [options.aiNoiseSuppression] - AI 降噪配置（可选，传入则启用）
   * @param {boolean} [options.aiNoiseSuppression.enabled=true]
   * @param {number}  [options.aiNoiseSuppression.noiseReductionLevel=80]  - 降噪强度 0-100
   * @param {object}  [options.aiNoiseSuppression.assetConfig]             - CDN 配置
   */
  constructor(options = {})
  {
    super();

    if (!options.server)
    {
      throw new Exceptions.ConfigurationError('server');
    }

    const aiNoiseSuppression = options.aiNoiseSuppression || null;

    /** @type {object} */
    this._audioConstraintOverrides = cloneAudioConstraints(options.audioConstraints);

    this._config = {
      server             : options.server,
      iceServers         : options.iceServers || [],
      avatar             : options.avatar || 'default',
      flag               : normalizeFlag(options.flag),
      audioConstraints   : createMetaHumanAudioConstraints(this._audioConstraintOverrides, aiNoiseSuppression),
      micDeviceId        : options.micDeviceId || null,
      aiNoiseSuppression : aiNoiseSuppression
    };

    /** @type {RTCPeerConnection|null} */
    this._pc = null;

    /** @type {'idle'|'connecting'|'connected'|'closed'} */
    this._state = 'idle';

    /** @type {AiNoiseSuppressionEngine|null} */
    this._ainsEngine = null;

    /** @type {MediaStream|null} */
    this._localStream = null;

    /** @type {MediaStream|null} */
    this._processedStream = null;

    /** @type {number} */
    this._connectSeq = 0;

    /** @type {object} */
    this._data = {};
  }

  // ===========================================================================
  // 公开属性
  // ===========================================================================

  /**
   * 获取当前连接状态
   * @returns {'idle'|'connecting'|'connected'|'closed'}
   */
  get state()
  {
    return this._state;
  }

  /**
   * 获取当前 AiNS 引擎实例（若已启用）。
   *
   * @returns {AiNoiseSuppressionEngine|null}
   */
  getAiNoiseSuppression()
  {
    return this._ainsEngine;
  }

  // ===========================================================================
  // 公开方法
  // ===========================================================================

  /**
   * 发起与数字人后端的 WebRTC 连接
   *
   * 流程：采集麦克风 →（可选 AI 降噪）→ 创建 PeerConnection → 发送 Offer → 接收 Answer
   *
   * @returns {Promise<void>}
   */
  connect()
  {
    if (this._state === 'connecting')
    {
      return Promise.reject(new Exceptions.InvalidStateError('connecting'));
    }

    const connectSeq = ++this._connectSeq;

    this._closePC();
    this._releaseLocalMedia();
    this._destroyAiNS();
    this._setState('connecting');

    // 构建麦克风约束
    const audioConstraints = Object.assign({}, this._config.audioConstraints);

    if (this._config.micDeviceId)
    {
      audioConstraints.deviceId = { exact: this._config.micDeviceId };
    }

    return navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
      .then((stream) =>
      {
        this._ensureActiveConnect(connectSeq, stream);
        this._localStream = stream;

        return stream;
      })
      .then((stream) => this._applyAiNoiseSuppression(stream))
      .then((processedStream) =>
      {
        this._ensureActiveConnect(connectSeq, processedStream === this._localStream ? null : processedStream);
        this._createPC();
        this._processedStream = processedStream;

        const audioTrack = processedStream.getAudioTracks()[0];

        if (!audioTrack)
        {
          throw new Error('未获取到麦克风音频轨道');
        }

        this._pc.addTrack(audioTrack, processedStream);

        return this._pc.createOffer();
      })
      .then((offer) =>
      {
        this._assertActiveConnect(connectSeq);

        return this._pc.setLocalDescription(offer);
      })
      .then(() =>
      {
        this._assertActiveConnect(connectSeq);

        const offer = this._pc.localDescription;

        return fetch(`${this._config.server}/offer`, {
          body : JSON.stringify({
            sdp    : offer.sdp,
            type   : offer.type,
            flag   : this._config.flag,
            avatar : this._config.avatar
          }),
          headers : {
            'Content-Type' : 'application/json'
          },
          method : 'POST'
        });
      })
      .then((response) =>
      {
        this._assertActiveConnect(connectSeq);

        if (!response.ok)
        {
          throw new Error(`服务器返回错误: ${response.status}`);
        }

        return response.json();
      })
      .then((answer) =>
      {
        this._assertActiveConnect(connectSeq);

        return this._pc.setRemoteDescription(answer);
      })
      .catch((err) =>
      {
        if (err && err.name === 'AbortError')
        {
          return;
        }

        const errorMessage = getErrorMessage(err);

        logger.error(`连接失败: ${errorMessage}`);
        this._closePC();
        this._releaseLocalMedia();
        this._destroyAiNS();
        this._setState('closed');
        this._emitError(errorMessage);

        throw err;
      });
  }

  /**
   * 关闭连接，释放 WebRTC 和 AiNS 资源
   */
  close()
  {
    logger.debug('close');
    this._connectSeq += 1;
    this._closePC();
    this._releaseLocalMedia();
    this._destroyAiNS();
    this._setState('closed');
  }

  /**
   * 更新配置项（下次 connect() 时生效）
   *
   * @param {object} updates
   * @param {string} [updates.avatar] - 新头像标识
   * @param {number} [updates.flag]   - 新 ASR/TTS 开关
   * @param {object} [updates.audioConstraints] - 新麦克风采集约束
   * @param {string|null} [updates.micDeviceId] - 新麦克风设备 ID
   * @param {object|null} [updates.aiNoiseSuppression] - 新 AiNS 配置
   */
  updateConfig(updates = {})
  {
    if (updates.avatar !== undefined)
    {
      this._config.avatar = updates.avatar;
    }
    if (updates.flag !== undefined)
    {
      this._config.flag = normalizeFlag(updates.flag);
    }
    if (updates.audioConstraints && typeof updates.audioConstraints === 'object')
    {
      this._audioConstraintOverrides = Object.assign({}, this._audioConstraintOverrides, updates.audioConstraints);
    }
    if (updates.micDeviceId !== undefined)
    {
      this._config.micDeviceId = updates.micDeviceId || null;
    }
    if (updates.aiNoiseSuppression !== undefined)
    {
      this._config.aiNoiseSuppression = updates.aiNoiseSuppression || null;
    }

    if (updates.audioConstraints !== undefined || updates.aiNoiseSuppression !== undefined)
    {
      this._config.audioConstraints = createMetaHumanAudioConstraints(
        this._audioConstraintOverrides,
        this._config.aiNoiseSuppression
      );
    }
  }

  // ===========================================================================
  // 内部方法
  // ===========================================================================

  /** @private */
  _createPC()
  {
    this._pc = new RTCPeerConnection({
      sdpSemantics       : 'unified-plan',
      iceTransportPolicy : 'relay',
      iceServers         : this._config.iceServers
    });

    this._pc.addEventListener('track', (evt) =>
    {
      if (evt.track.kind === 'video' && evt.streams[0])
      {
        this._setState('connected');
        this.emit('track', { stream: evt.streams[0] });
      }
    });

    this._pc.addTransceiver('video', { direction: 'recvonly' });
    this._pc.addTransceiver('audio', { direction: 'sendrecv' });
  }

  /** @private */
  _closePC()
  {
    if (this._pc)
    {
      this._pc.close();
      this._pc = null;
    }
  }

  /** @private */
  _setState(state)
  {
    if (this._state !== state)
    {
      this._state = state;
      this.emit('stateChanged', { state });
    }
  }

  /** @private */
  _emitError(cause)
  {
    if (this.listenerCount('error') > 0)
    {
      this.emit('error', { cause });
    }
  }

  /** @private */
  _emitMediaEffectsIssue(issue)
  {
    const normalizedIssue = issueUtils.normalizeIssue(META_HUMAN_MEDIA_EFFECTS_ISSUE_DEFAULTS, issue);

    logger.debug(`emit "mediaEffectsIssue": module=${normalizedIssue.module} message=${normalizedIssue.message}`);
    this.emit('mediaEffectsIssue', normalizedIssue);
  }

  /** @private */
  _hasAiNoiseSuppressionEnabled()
  {
    const aiNoiseSuppression = this._config.aiNoiseSuppression;

    return Boolean(aiNoiseSuppression && aiNoiseSuppression.enabled !== false);
  }

  /**
   * 对采集到的麦克风流应用 AI 降噪（如果已配置）
   * @private
   * @param {MediaStream} stream - 原始麦克风流
   * @returns {Promise<MediaStream>} - 处理后的流（降级时返回原始流）
   */
  async _applyAiNoiseSuppression(stream)
  {
    const ainsOptions = this._config.aiNoiseSuppression;

    if (!this._hasAiNoiseSuppressionEnabled())
    {
      return stream;
    }

    // 延迟加载，避免非 AiNS 场景引入额外依赖
    const AiNSEngine = require('./AiNoiseSuppression/AiNSEngine');

    if (!AiNSEngine.isSupported())
    {
      logger.warn('AiNS 不可用，使用原始音频流');
      this._emitMediaEffectsIssue({
        stage           : 'capability-check',
        severity        : 'warn',
        message         : 'AiNS is not supported in the current browser',
        fallbackApplied : true,
        degraded        : true
      });

      return stream;
    }

    try
    {
      this._ainsEngine = new AiNSEngine({
        enabled             : ainsOptions.enabled !== false,
        sampleRate          : this._config.audioConstraints.sampleRate,
        noiseReductionLevel : ainsOptions.noiseReductionLevel !== undefined ?
          ainsOptions.noiseReductionLevel :
          80,
        assetConfig : ainsOptions.assetConfig || null,
        onIssue     : (issue) =>
        {
          const normalizedIssue = issueUtils.normalizeIssue(META_HUMAN_MEDIA_EFFECTS_ISSUE_DEFAULTS, issue);

          logger.warn(`AiNS issue: ${normalizedIssue.message || 'unknown'}`);
          this._emitMediaEffectsIssue(normalizedIssue);
        }
      });

      const processedStream = await this._ainsEngine.process(stream);

      logger.debug('AiNS 已启用');

      return processedStream;
    }
    catch (err)
    {
      const errorMessage = getErrorMessage(err);

      logger.error(`AiNS 初始化失败，使用原始音频流: ${errorMessage}`);
      if (!err || err.__mediaEffectsIssueReported !== true)
      {
        this._emitMediaEffectsIssue({
          stage           : 'apply-ai-noise-suppression',
          severity        : 'error',
          message         : errorMessage,
          fallbackApplied : true,
          degraded        : true,
          details         : {
            normalizedAiNSOptions : {
              enabled             : ainsOptions.enabled !== false,
              sampleRate          : this._config.audioConstraints.sampleRate,
              noiseReductionLevel : ainsOptions.noiseReductionLevel !== undefined ?
                ainsOptions.noiseReductionLevel :
                80,
              assetConfig : ainsOptions.assetConfig || null
            }
          }
        });
      }
      this._destroyAiNS();

      return stream;
    }
  }

  /** @private */
  _destroyAiNS()
  {
    if (this._ainsEngine)
    {
      this._ainsEngine.destroy()
        .catch((error) =>
        {
          logger.warn(`AiNS 销毁失败: ${error && error.message ? error.message : error}`);
        });
      this._ainsEngine = null;
    }
  }

  /** @private */
  _releaseLocalMedia()
  {
    stopStreamTracks(this._processedStream);

    if (this._localStream !== this._processedStream)
    {
      stopStreamTracks(this._localStream);
    }

    this._localStream = null;
    this._processedStream = null;
  }

  /** @private */
  _assertActiveConnect(connectSeq)
  {
    if (this._connectSeq !== connectSeq || this._state === 'closed')
    {
      throw createAbortError();
    }
  }

  /** @private */
  _ensureActiveConnect(connectSeq, streamToStop)
  {
    if (this._connectSeq !== connectSeq || this._state === 'closed')
    {
      stopStreamTracks(streamToStop);
      throw createAbortError();
    }
  }
};

function cloneAudioConstraints(audioConstraints)
{
  return audioConstraints && typeof audioConstraints === 'object' ? Object.assign({}, audioConstraints) : {};
}

function createMetaHumanAudioConstraints(audioConstraints, aiNoiseSuppression)
{
  const normalized = Object.assign({
    sampleRate       : 48000,
    channelCount     : 1,
    echoCancellation : true,
    autoGainControl  : true,
    noiseSuppression : true,
    latency          : { ideal: 0.01 }
  }, audioConstraints || {});

  if (aiNoiseSuppression && aiNoiseSuppression.enabled !== false)
  {
    normalized.noiseSuppression = false;
  }

  return normalized;
}

function normalizeFlag(value)
{
  if (value === undefined || value === null || value === '')
  {
    return 0;
  }

  return Number(value) === 1 ? 1 : 0;
}

function createAbortError()
{
  const error = new Error('MetaHumanClient connect aborted');

  error.name = 'AbortError';

  return error;
}

function stopStreamTracks(stream)
{
  if (!(stream instanceof MediaStream))
  {
    return;
  }

  stream.getTracks().forEach((track) =>
  {
    try
    {
      track.stop();
    }
    catch (error)
    {}
  });
}
