/* globals RTCPeerConnection: false, RTCSessionDescription: false */

const EventEmitter = require('events').EventEmitter;
const sdp_transform = require('sdp-transform');
const Logger = require('./Logger');
const CRTC_C = require('./Constants');
const Exceptions = require('./Exceptions');
const Transactions = require('./Transactions');
const Utils = require('./Utils');
const Timers = require('./Timers');
const SIPMessage = require('./SIPMessage');
const Dialog = require('./Dialog');
const RequestSender = require('./RequestSender');
const RTCSession_DTMF = require('./RTCSession/DTMF');
const RTCSession_Info = require('./RTCSession/Info');
const RTCSession_ReferNotifier = require('./RTCSession/ReferNotifier');
const RTCSession_ReferSubscriber = require('./RTCSession/ReferSubscriber');
const issueUtils = require('./MediaEffectsIssue');
const MediaPipeline = require('./RTCSession/MediaPipeline');
const BFCPChannel = require('./RTCSession/BFCPChannel'); // BFCP 协议 + DataChannel 封装
const RTCStatsMonitor = require('./RTCStatsMonitor');
const URI = require('./URI');
const BFCPLib = require('./BFCP/index');

const logger = new Logger('RTCSession');
const RequestStatusValue = BFCPLib.RequestStatusValue;
const MEDIA_EFFECTS_ISSUE_DEFAULTS = {
  module  : 'MediaEffects',
  message : 'Unknown media effects issue'
};
const getErrorMessage = issueUtils.getErrorMessage;

const C = {
  // RTCSession states.
  STATUS_NULL               : 0,
  STATUS_INVITE_SENT        : 1,
  STATUS_1XX_RECEIVED       : 2,
  STATUS_INVITE_RECEIVED    : 3,
  STATUS_WAITING_FOR_ANSWER : 4,
  STATUS_ANSWERED           : 5,
  STATUS_WAITING_FOR_ACK    : 6,
  STATUS_CANCELED           : 7,
  STATUS_TERMINATED         : 8,
  STATUS_CONFIRMED          : 9
};

/**
 * Local variables.
 */
const holdMediaTypes = [ 'audio', 'video' ];
const EVENT_SET_REMOTE_DESCRIPTION_FAILED = 'peerconnection:setremotedescriptionfailed';
const HEADER_ACCEPT_CONTACT_MMTEL_VIDEO = 'Accept-Contact: *;+g.3gpp.icsi-ref="urn%3Aurn-7%3A3gpp-service.ims.icsi.mmtel";video';
const HEADER_P_PREFERRED_SERVICE_MMTEL = 'P-Preferred-Service: urn:urn-7:3gpp-service.ims.icsi.mmtel';

function push5GServiceHeaders(extraHeaders, ua)
{
  if (Utils.is5GService(ua))
  {
    extraHeaders.push(HEADER_ACCEPT_CONTACT_MMTEL_VIDEO);
    extraHeaders.push(HEADER_P_PREFERRED_SERVICE_MMTEL);
  }
}

function emitSetRemoteDescriptionFailed(session, error)
{
  session._logEventError('warn', EVENT_SET_REMOTE_DESCRIPTION_FAILED, error);
  session.emit(EVENT_SET_REMOTE_DESCRIPTION_FAILED, error);
}

module.exports = class RTCSession extends EventEmitter 
{
  /**
   * Expose C object.
   */
  static get C() 
  {
    return C;
  }

  constructor(ua) 
  {
    logger.debug('new');
    logger.debug(`UA: ${navigator.userAgent}`);

    super();

    this._id = null;
    this._ua = ua;
    this._status = C.STATUS_NULL;
    this._dialog = null;
    this._earlyDialogs = {};
    this._contact = null;
    this._from_tag = null;
    this._to_tag = null;

    // 适配183音频后200ok无sdp
    this._earlyAudio;

    // DataChannel & BFCP —— 全部委托给 BFCPChannel 模块。
    this._bfcp = new BFCPChannel(this);

    // BFCP控制的流，接通后立即获取

    // 预处理媒体流，如虚拟背景等
    this._mediaStreamProcessor = null;
    this._sessionAiNSEngine = null;
    this._sessionAiNSOptions = null;
    this._aiNSInputStream = null;
    this._mediaEffectsComposer = null;
    // 记录当前送入 MediaEffectsComposer 的“原始输入流”（非合成输出流）。
    // 用于切换摄像头时只停旧输入 videoTrack，避免误停 sender 上的合成输出轨。
    this._mediaEffectsComposerInputStream = null;
    // RTCSession 只缓存会话级 composer 视图：
    // - source 0（本端主源）的 sourceMirror / aiVirtualBackground
    // - 输出层配置（mirror / watermarks 等）
    // - 重建 composer 所需的构造参数（width / height / fps / renderMode...）
    // 业务在 composer 实例上动态 addSource/removeSource 的多源状态不会回写到这里，
    // 会话重建时需要业务自行重放。
    this._sessionMediaEffectsComposerOptions = null;

    // 用于华为安卓记录后摄
    this._environment = null;

    // SDP协商的分辨率速率
    this._sdpResolution = 'BP480P';

    // 适配 DTMF payload 值
    this._dtmf_payload = null;

    this._inviteVideoTrackStatsTimer = null;
    this._answerVideoTrackStatsTimer = null;
    this._videoFrameRateMonitorTimer = null;
    this._isApplyingVideoFrameRateConstraints = false;
    this._maxBitrateRetryTimer = null;

    // The RTCPeerConnection instance (public attribute).
    this._connection = null;
    // 每个会话独立维护统计实例，PC 创建后自动启动，关闭会话时统一释放。
    this._statsMonitor = null;

    // Prevent races on serial PeerConnction operations.
    this._connectionPromiseQueue = Promise.resolve();

    // Incoming/Outgoing request being currently processed.
    this._request = null;

    // Cancel state for initial outgoing request.
    this._is_canceled = false;
    this._cancel_reason = '';

    // RTCSession confirmation flag.
    this._is_confirmed = false;

    // Is late SDP being negotiated.
    this._late_sdp = false;

    // Default rtcOfferConstraints and rtcAnswerConstrainsts (passed in connect() or answer()).
    this._rtcOfferConstraints = null;
    this._rtcAnswerConstraints = null;

    // Local MediaStream.
    this._localMediaStream = null;
    this._localMediaStreamLocallyGenerated = false;
    // 是否替换过音频轨道
    this._replaceAudioTrack = false;
    // 初始 invite 的媒体约束参数
    this._inviteMediaConstraints = null;
    this._answerMediaConstraints = null;
    // 恢复摄像头轨道用
    this._restoreCameraTrackCanvas = null;
    this._restoreCameraTrackCtx = null;
    this._restoreCameraTrackDraw = null;
    this._boundReplaceVideoToCanvas = this._replaceVideoToCanvas.bind(this);
    this._boundReplaceMicToAudios = this._replaceMicToAudio.bind(this);

    // 定制模式
    this._customizedMode = null;

    // 远端是否支持视频模式
    this._remoteSupportsVideo = false;

    // 本地分享媒体：图片、视频、屏幕等.
    this._localShareRTPSender = null;
    this._localShareStream = new MediaStream();
    this._localShareStreamLocallyGenerated = false;
    // 当前共享模式。一个 RTCSession 同一时间只允许一种共享，避免历史共享与辅流
    // 同时覆盖 _localShareStream，导致 unShare() 无法判断应该停止哪条媒体链路。
    this._shareMode = null;
    // 非 BFCP 辅流共享状态。
    //
    // 辅流模式不会替换摄像头 sender，而是为当前 RTCSession 单独协商一条
    // sendonly video m-line。三方会议中每个成员对应一条 RTCSession，页面可将
    // 同一个屏幕 MediaStream 交给多条会话发送，SDK 分别维护各自的 sender 和 MID。
    // 停止共享时保留 transceiver/MID，下一次共享优先 replaceTrack 复用已有 m-line，
    // 只有复用失败时才重新创建 transceiver，避免反复增加 SDP m-section。
    this._auxiliaryShareTransceiver = null;
    this._auxiliaryShareMid = null;
    // active 表示已完成协商且已发送 start INFO；starting 表示仍在采集或协商中。
    this._auxiliaryShareActive = false;
    this._auxiliaryShareStarting = false;
    // unShare() 可能发生在 getDisplayMedia/renegotiate 尚未完成时，用此标志让启动流程回滚。
    this._auxiliaryShareCancelRequested = false;
    // 标记 MediaStream 所有权：SDK 采集的流默认由 SDK 停止，外部传入的流默认不停止。
    this._auxiliaryShareOwnsStream = false;
    // 合并并发停止请求，避免重复发送 stop INFO 或重复 replaceTrack(null)。
    this._auxiliaryShareStopPromise = null;
    // 某些浏览器不会稳定触发 ended/inactive，因此事件监听之外再保留一个轮询兜底。
    this._auxiliaryShareEndTimer = null;
    this._auxiliaryShareBoundTrack = null;
    this._auxiliaryShareTrackEndedHandler = null;
    this._auxiliaryShareStreamInactiveHandler = null;

    // 非 BFCP 远端辅流状态。
    //
    // SIP INFO 负责说明“哪个 MID 是屏幕共享”，RTCPeerConnection track 事件负责
    // 提供真正的 MediaStreamTrack。二者到达顺序不固定，因此必须按 MID 分别缓存，
    // 只有 MID 和 live track 都具备时才向接入方触发 remoteShared。
    this._remoteAuxiliaryShareMid = null;
    this._remoteAuxiliaryShareTracks = new Map();
    // 防止同一个 track 因多次 track/unmute 处理而重复绑定 ended 监听器。
    this._remoteAuxiliaryShareBoundTracks = new Set();
    // 用于抑制同一条共享轨重复触发 remoteShared。
    this._remoteAuxiliaryShareActiveTrack = null;

    // 本地摄像头
    this._localCameras = [];
    this._selectedLocalCameras = null;

    // 单视频通话，关闭摄像头
    this._videoOnlyMute = false;
    this._onMutedVideoTrack = null;
    this._replaceMutedCanvasTrack = null;
    this._isCurrentlyMuted = false;

    // Flag to indicate PeerConnection ready for new actions.
    this._rtcReady = true;

    // Flag to indicate ICE candidate gathering is finished even if iceGatheringState is not yet 'complete'.
    this._iceReady = false;

    // 媒体断开后是不是发送reinvite
    this._canSend = false;

    // SIP Timers.
    this._timers = {
      ackTimer          : null,
      expiresTimer      : null,
      invite2xxTimer    : null,
      userNoAnswerTimer : null
    };

    // Session info.
    this._direction = null;
    this._local_identity = null;
    this._remote_identity = null;
    this._start_time = null;
    this._end_time = null;
    this._tones = null;

    // Mute/Hold state.
    this._audioMuted = false;
    this._videoMuted = false;
    this._localHold = false;
    this._remoteHold = false;

    // 通话模式
    this._mode = '';
    // 本地切换到音视频模式
    this._localToAudio = false;
    this._localToVideo = false;
    // 远端切换到音视频模式
    this._remoteToAudio = false;
    this._remoteToVideo = false;
    // 适配 100rel 调整reinvite的hold判断
    this._notHold = true;

    // 是否是自定义媒体流模式
    this._customMediaStream = false;

    // Session Timers (RFC 4028).
    this._sessionTimers = {
      enabled        : this._ua.configuration.session_timers,
      refreshMethod  : this._ua.configuration.session_timers_refresh_method,
      defaultExpires : CRTC_C.SESSION_EXPIRES,
      currentExpires : null,
      running        : false,
      refresher      : false,
      timer          : null // A setTimeout.
    };

    // Map of ReferSubscriber instances indexed by the REFER's CSeq number.
    this._referSubscribers = {};

    // Custom session empty object for high level use.
    this._data = {};
    // 媒体采集、预处理、AI 降噪、合成等细节统一收敛到内部组件，
    // RTCSession 主文件只保留会话编排和对外行为。
    this._mediaPipeline = new MediaPipeline(this);

    // 监听浏览器切后台输出黑屏
    this._initVisibilityChangeHandler();
  }

  /**
   * User API
   */

  // Expose RTCSession constants as a property of the RTCSession instance.
  get C() 
  {
    return C;
  }

  // Expose session failed/ended causes as a property of the RTCSession instance.
  get causes() 
  {
    return CRTC_C.causes;
  }

  get id() 
  {
    return this._id;
  }

  get connection() 
  {
    return this._connection;
  }

  get statsMonitor()
  {
    return this._statsMonitor;
  }

  get contact() 
  {
    return this._contact;
  }

  get direction() 
  {
    return this._direction;
  }

  get local_identity() 
  {
    return this._local_identity;
  }

  get remote_identity() 
  {
    return this._remote_identity;
  }

  get start_time() 
  {
    return this._start_time;
  }

  get end_time() 
  {
    return this._end_time;
  }

  get data() 
  {
    return this._data;
  }

  set data(_data) 
  {
    this._data = _data;
  }

  get status() 
  {
    return this._status;
  }

  getMediaEffectsComposer()
  {
    return this._mediaPipeline.getMediaEffectsComposer();
  }

  /**
   * Return the original local input stream currently feeding the session
   * MediaEffectsComposer. Callers must clone tracks before reusing them.
   */
  getComposerInputStream()
  {
    return this._mediaEffectsComposerInputStream;
  }

  getAiNoiseSuppression()
  {
    return this._mediaPipeline.getAiNoiseSuppression();
  }

  getAiVirtualBackground()
  {
    return this._mediaPipeline.getAiVirtualBackground();
  }

  async updateMediaEffectsComposer(options)
  {
    if (options === null)
    {
      this._sessionMediaEffectsComposerOptions = null;
      this._mediaPipeline.stopSessionMediaEffectsComposer();

      return null;
    }

    const resolvedOptions = this._mediaPipeline.resolveMediaEffectsComposerOptions({
      mediaEffectsComposer : options
    });

    if (!resolvedOptions)
    {
      this._sessionMediaEffectsComposerOptions = null;
      this._mediaPipeline.stopSessionMediaEffectsComposer();

      return null;
    }

    const composer = this.getMediaEffectsComposer();
    const previousSessionOptions = this._sessionMediaEffectsComposerOptions;

    if (!composer || typeof composer.setConfig !== 'function')
    {
      const nextSessionOptions = this._mediaPipeline.mergeSessionMediaEffectsComposerOptions(
        previousSessionOptions,
        resolvedOptions
      );
      const senders = this._connection && typeof this._connection.getSenders === 'function' ?
        this._connection.getSenders() :
        [];
      const videoSender = senders.find((item) => item && item.track && item.track.kind === 'video');
      const audioSender = senders.find((item) => item && item.track && item.track.kind === 'audio');
      const composerInputStream = this._mediaEffectsComposerInputStream;
      const currentLocalVideoTrack = videoSender && videoSender.track ? videoSender.track :
        (this._localMediaStream && this._localMediaStream.getVideoTracks ? this._localMediaStream.getVideoTracks()[0] : null);
      const currentLocalAudioTracks = this._localMediaStream && this._localMediaStream.getAudioTracks ?
        this._localMediaStream.getAudioTracks() :
        [];
      const rebuildFromComposerInputStream = Boolean(
        composerInputStream &&
        composerInputStream.getVideoTracks &&
        composerInputStream.getVideoTracks().length > 0
      );

      if (!rebuildFromComposerInputStream && !currentLocalVideoTrack)
      {
        return null;
      }

      this._sessionMediaEffectsComposerOptions = nextSessionOptions;

      const mixedStream = await this._mediaPipeline.applyMediaEffectsComposerOnSdkGumStream(
        rebuildFromComposerInputStream ? composerInputStream : (() =>
        {
          const currentLocalSourceStream = new MediaStream();

          currentLocalAudioTracks.forEach((track) =>
          {
            currentLocalSourceStream.addTrack(track, currentLocalSourceStream);
          });
          currentLocalSourceStream.addTrack(currentLocalVideoTrack, currentLocalSourceStream);

          return currentLocalSourceStream;
        })(),
        resolvedOptions,
        {
          preserveExistingComposerInputStream : rebuildFromComposerInputStream
        }
      );
      const mixedVideoTrack = mixedStream && mixedStream.getVideoTracks ? mixedStream.getVideoTracks()[0] : null;
      const mixedAudioTrack = mixedStream && mixedStream.getAudioTracks ? mixedStream.getAudioTracks()[0] : null;

      if (!mixedVideoTrack)
      {
        return null;
      }

      if (this._localMediaStream && typeof this._localMediaStream.removeTrack === 'function')
      {
        try
        {
          const previousVideoTrack = this._localMediaStream.getVideoTracks &&
            this._localMediaStream.getVideoTracks()[0];

          previousVideoTrack && this._localMediaStream.removeTrack(previousVideoTrack);
        }
        catch (error)
        {}

        this._localMediaStream.addTrack(mixedVideoTrack);

        if (mixedAudioTrack)
        {
          try
          {
            const previousAudioTrack = this._localMediaStream.getAudioTracks &&
              this._localMediaStream.getAudioTracks()[0];

            previousAudioTrack && this._localMediaStream.removeTrack(previousAudioTrack);
          }
          catch (error)
          {}

          this._localMediaStream.addTrack(mixedAudioTrack);
        }
      }
      else
      {
        this._localMediaStream = mixedStream;
      }

      if (videoSender && typeof videoSender.replaceTrack === 'function')
      {
        await videoSender.replaceTrack(mixedVideoTrack);
      }

      if (audioSender && mixedAudioTrack && typeof audioSender.replaceTrack === 'function')
      {
        await audioSender.replaceTrack(mixedAudioTrack);
      }

      return this.getMediaEffectsComposer() ? this.getMediaEffectsComposer().getState() : null;
    }

    const patch = this._mediaPipeline.resolveMediaEffectsComposerPatch(resolvedOptions);

    try
    {
      await composer.setConfig(patch);

      if (resolvedOptions.sources instanceof Array && resolvedOptions.sources.length > 0)
      {
        for (let index = 0; index < resolvedOptions.sources.length; index++)
        {
          const sourceOptions = resolvedOptions.sources[index];

          if (!sourceOptions || typeof sourceOptions !== 'object')
          {
            continue;
          }

          if (typeof sourceOptions.sourceMirror === 'boolean')
          {
            await composer.setSourceMirror(index, sourceOptions.sourceMirror);
          }

          if (Object.prototype.hasOwnProperty.call(sourceOptions, 'aiVirtualBackground'))
          {
            if (sourceOptions.aiVirtualBackground)
            {
              composer.setSourceAiVirtualBackground(index, sourceOptions.aiVirtualBackground);
            }
            else
            {
              composer.clearSourceAiVirtualBackground(index);
            }
          }
        }
      }
    }
    catch (error)
    {
      this._emitMediaEffectsIssue({
        module   : 'MediaEffectsComposer',
        severity : 'error',
        message  : getErrorMessage(error)
      });

      throw error;
    }

    this._sessionMediaEffectsComposerOptions = this._mediaPipeline.mergeSessionMediaEffectsComposerOptions(
      previousSessionOptions,
      resolvedOptions
    );

    return composer.getState();
  }

  isInProgress() 
  {
    switch (this._status) 
    {
      case C.STATUS_NULL:
      case C.STATUS_INVITE_SENT:
      case C.STATUS_1XX_RECEIVED:
      case C.STATUS_INVITE_RECEIVED:
      case C.STATUS_WAITING_FOR_ANSWER:
        return true;
      default:
        return false;
    }
  }

  isEstablished() 
  {
    switch (this._status) 
    {
      case C.STATUS_ANSWERED:
      case C.STATUS_WAITING_FOR_ACK:
      case C.STATUS_CONFIRMED:
        return true;
      default:
        return false;
    }
  }

  isEnded() 
  {
    switch (this._status) 
    {
      case C.STATUS_CANCELED:
      case C.STATUS_TERMINATED:
        return true;
      default:
        return false;
    }
  }

  isMuted() 
  {
    return {
      audio : this._audioMuted,
      video : this._videoMuted
    };
  }


  isOnHold()
  {
    return {
      local  : this._localHold,
      remote : this._remoteHold
    };
  }

  connect(target, options = {}, initCallback) 
  {
    logger.debug(`${this._id} connect()`);

    const originalTarget = target;
    const eventHandlers = Utils.cloneObject(options.eventHandlers);
    const mediaStream = options.mediaStream || null;
    const pcConfig = Utils.cloneObject(options.pcConfig, { iceServers: [] });
    const rtcConstraints = options.rtcConstraints || null;
    const rtcOfferConstraints = options.rtcOfferConstraints || null;
    const extraHeaders = Utils.cloneArray(options.extraHeaders);
    const extraFeatures = options.extraFeatures || null;
    const composerOptions = this._mediaPipeline.resolveMediaEffectsComposerOptions(options);
    const aiNSOptions = options.aiNoiseSuppression || null;

    this._sessionMediaEffectsComposerOptions = composerOptions;
    this._sessionAiNSOptions = aiNSOptions;
    this._mediaStreamProcessor = options.mediaStreamProcessor || null;
    this._mediaPipeline.stopSessionAiNoiseSuppression();

    this._inviteMediaConstraints = Utils.cloneObject(options.mediaConstraints, {
      audio : false,
      video : false
    });

    this._rtcOfferConstraints = rtcOfferConstraints;
    this._rtcAnswerConstraints = options.rtcAnswerConstraints || null;

    this._data = options.data || this._data;

    // Check target.
    if (target === undefined) 
    {
      throw new TypeError('Not enough arguments');
    }

    // Check Session Status.
    if (this._status !== C.STATUS_NULL) 
    {
      throw new Exceptions.InvalidStateError(this._status);
    }

    // Check WebRTC support.
    if (!window.RTCPeerConnection) 
    {
      throw new Exceptions.NotSupportedError('WebRTC not supported');
    }

    // Check target validity.
    target = this._ua.normalizeTarget(target);
    if (!target) 
    {
      throw new TypeError(`Invalid target: ${originalTarget}`);
    }

    // 判断授权的 sip domain
    if (this._ua.sk && (this._ua.sk[8].split(';').indexOf(target.host) == -1)) 
    {
      this._ua.emit('failed', {
        originator : 'local',
        message    : CRTC_C.causes.AUTHORIZATION_ERROR,
        cause      : CRTC_C.AUTHORIZATION_ERROR_CAUSES.AUTH_SIPDOMAIN_ERROR
      });

      return false;
    }

    // SDP协商的分辨率速率
    if (extraFeatures) 
    {
      if (extraFeatures.indexOf('BP480P') !== -1) 
      {
        this._sdpResolution = 'BP480P';
        this._ua.transport.sdpResolution = 'BP480P';
      }

      if (extraFeatures.indexOf('BP720P') !== -1) 
      {
        this._sdpResolution = 'BP720P';
        this._ua.transport.sdpResolution = 'BP720P';
      }
    }

    // 是否启用BFCP（委托给 BFCPChannel 初始化）
    this._bfcp.init(extraFeatures, this._ua.contact.uri.user, target.user);

    // 定制模式
    this._customizedMode = options.cMode;

    // Session Timers.
    if (this._sessionTimers.enabled) 
    {
      if (Utils.isDecimal(options.sessionTimersExpires)) 
      {
        if (options.sessionTimersExpires >= CRTC_C.MIN_SESSION_EXPIRES) 
        {
          this._sessionTimers.defaultExpires = options.sessionTimersExpires;
        }
        else 
        {
          this._sessionTimers.defaultExpires = CRTC_C.SESSION_EXPIRES;
        }
      }
    }

    // Set event handlers.
    for (const event in eventHandlers) 
    {
      if (Object.prototype.hasOwnProperty.call(eventHandlers, event)) 
      {
        this.on(event, eventHandlers[event]);
      }
    }

    // Session parameter initialization.
    this._from_tag = Utils.newTag();

    // Set anonymous property.
    const anonymous = options.anonymous || false;

    const requestParams = { from_tag: this._from_tag };

    this._contact = this._ua.contact.toString({
      anonymous,
      outbound : true
    });

    if (anonymous) 
    {
      requestParams.from_display_name = 'Anonymous';
      requestParams.from_uri = new URI('sip', 'anonymous', 'anonymous.invalid');

      extraHeaders.push(`P-Preferred-Identity: ${this._ua.configuration.uri.toString()}`);
      extraHeaders.push('Privacy: id');
    }
    else if (options.fromUserName) 
    {
      requestParams.from_uri = new URI('sip', options.fromUserName, this._ua.configuration.uri.host);

      extraHeaders.push(`P-Preferred-Identity: ${this._ua.configuration.uri.toString()}`);
    }

    if (options.fromDisplayName) 
    {
      requestParams.from_display_name = options.fromDisplayName;
    }

    extraHeaders.push(`Contact: ${this._contact}`);

    // 5G Headers
    push5GServiceHeaders(extraHeaders, this._ua);

    extraHeaders.push('Content-Type: application/sdp');

    if (this._sessionTimers.enabled) 
    {
      extraHeaders.push(`Session-Expires: ${this._sessionTimers.defaultExpires}${this._ua.configuration.session_timers_force_refresher ? ';refresher=uac' : ''}`);
    }

    this._request = new SIPMessage.InitialOutgoingInviteRequest(
      target, this._ua, requestParams, extraHeaders);

    this._id = this._request.call_id + this._from_tag;

    this._replaceAudioTrack = false;

    // 适配浏览器M79以后Chrome默认使用mDNS主机名隐藏WebRTC暴露的本地IP
    return Promise.resolve()
      // Get a stream if required.
      .then(async() => 
      {
        let hasAudio;
        const mStream = new MediaStream();

        // 非自定义媒体流模式
        this._customMediaStream = false;

        // A stream is given, let the app set events such as 'peerconnection' and 'connecting'.
        if (mediaStream) 
        {
          // 自定义媒体流模式
          this._customMediaStream = true;

          mediaStream.getTracks().forEach((track) => 
          {
            logger.warn(`${this._id} There are two ${this._inviteMediaConstraints.audio ? 'audio' : 'video'} tracks in the input, please check the parameters`);

            this._inviteMediaConstraints[track.kind] = false;

            mStream.addTrack(track, mStream);
          });
        }

        // Request for user media access.
        if (this._inviteMediaConstraints.audio || this._inviteMediaConstraints.video) 
        {
          this._localMediaStreamLocallyGenerated = true;

          // 判断授权是否包含视频
          if (!Utils.supportsVideo(this._ua)) 
          {
            delete this._inviteMediaConstraints.video;
          }

          hasAudio = Boolean(this._inviteMediaConstraints.audio);

          let currMediaConstraints;

          // 兼容安卓微信Bug，开始不获取麦克风媒体
          if (Utils.isWeChat()) 
          {
            currMediaConstraints = {
              audio : false,
              video : this._inviteMediaConstraints.video || false
            };
          }
          else 
          {
            currMediaConstraints = this._inviteMediaConstraints;
          }

          logger.debug(`${this._id} currMediaConstraints: `, JSON.stringify(currMediaConstraints));

          if (currMediaConstraints.audio || currMediaConstraints.video) 
          {
            // 本地设备采集统一走媒体管线，确保虚拟背景、AI 降噪、
            // MediaEffectsComposer 的执行顺序在各入口保持一致。
            const tStream = await this._mediaPipeline.getUserMediaWithSessionPipeline(currMediaConstraints, composerOptions)
              .catch((error) =>
              {
                if (this._status === C.STATUS_TERMINATED)
                {
                  throw new Error('terminated');
                }

                this._failed('local', null, CRTC_C.causes.USER_DENIED_MEDIA_ACCESS);

                this._logEventError('warn', 'getusermediafailed', error);

                this.emit('getusermediafailed', error);

                const e = new Error(`getusermediafailed, ${error.message}`, { cause: error.message });

                e.name = error.name;
                throw e;
              });

            if (currMediaConstraints.video && tStream) 
            {
              // 如果包含视频轨道，判断是否为分辨率正常的视频轨道
              if (navigator.userAgent.indexOf('iPhone') != -1 && tStream.getVideoTracks().length > 0) 
              {
                logger.debug(`${this._id} mediastream settings: `, JSON.stringify(tStream.getVideoTracks()[0].getSettings()));
                if (!Utils.isVideoTrackHealthy(tStream)) 
                {
                  this.emit('mediaerror', { type: 'video', mediastream: tStream });
                }
              }

              this._environment = await Utils.getEnvironmentId();
              logger.debug(`${this._id} environment id: `, this._environment);
            }

            tStream.getTracks().forEach((track) => 
            {
              mStream.addTrack(track, mStream);
            });
          }
        }

        let sendStream = new MediaStream();
        const mics = await Utils.getMicrophones();

        // 兼容安卓微信Bug及iOS蓝牙问题
        if ((Utils.isWeChat() && hasAudio) || (navigator.userAgent.indexOf('iPhone') != -1 && mics.length > 1 && hasAudio)) 
        {
          logger.debug(`${this.id} mics: ${mics.length} hasAudio: ${hasAudio}`);
          sendStream.addTrack(this._generateAnEmptyAudioTrack());
          mStream.getVideoTracks().length > 0 && sendStream.addTrack(mStream.getVideoTracks()[0]);

          this._replaceAudioTrack = true;
        }
        else 
        {
          sendStream = mStream;
        }

        return Utils.bypassIOS151_152CanvasBug(sendStream);
      })
      .then((stream) => 
      {
        // Create a new RTCPeerConnection instance.
        this._createRTCConnection(pcConfig, rtcConstraints);

        this._monitorLocalVideoTrackStates(stream, '_inviteVideoTrackStatsTimer');

        // Set internal properties.
        this._direction = 'outgoing';
        this._local_identity = this._request.from;
        this._remote_identity = this._request.to;

        // User explicitly provided a newRTCSession callback for this session.
        if (initCallback) 
        {
          initCallback(this);
        }

        this._newRTCSession('local', this._request);

        this._sendInitialRequest(rtcOfferConstraints, stream);
      });
  }

  init_incoming(request, initCallback) 
  {
    logger.debug(`${this._id} init_incoming()`);

    let expires;
    const contentType = request.hasHeader('Content-Type') ?
      request.getHeader('Content-Type').toLowerCase() : undefined;

    // Check body and content type.
    if (request.body && (contentType !== 'application/sdp')) 
    {
      request.reply(415);

      return;
    }

    // Session parameter initialization.
    this._status = C.STATUS_INVITE_RECEIVED;
    this._from_tag = request.from_tag;
    this._id = request.call_id + this._from_tag;
    this._request = request;
    this._contact = this._ua.contact.toString();

    // Get the Expires header value if exists.
    if (request.hasHeader('expires')) 
    {
      expires = request.getHeader('expires') * 1000;
    }

    /* Set the to_tag before
     * replying a response code that will create a dialog.
     */
    request.to_tag = Utils.newTag();

    // An error on dialog creation will fire 'failed' event.
    if (!this._createDialog(request, 'UAS', true)) 
    {
      request.reply(500, 'Missing Contact header field');

      return;
    }

    if (request.body) 
    {
      this._late_sdp = false;
    }
    else 
    {
      this._late_sdp = true;
    }

    this._status = C.STATUS_WAITING_FOR_ANSWER;

    // Set userNoAnswerTimer.
    this._timers.userNoAnswerTimer = setTimeout(() => 
    {
      request.reply(408);
      this._failed('local', null, CRTC_C.causes.NO_ANSWER);
    }, this._ua.configuration.no_answer_timeout
    );

    /* Set expiresTimer
     * RFC3261 13.3.1
     */
    if (expires) 
    {
      this._timers.expiresTimer = setTimeout(() => 
      {
        if (this._status === C.STATUS_WAITING_FOR_ANSWER) 
        {
          request.reply(487);
          this._failed('system', null, CRTC_C.causes.EXPIRES);
        }
      }, expires
      );
    }

    // Set internal properties.
    this._direction = 'incoming';
    this._local_identity = request.to;
    this._remote_identity = request.from;

    // A init callback was specifically defined.
    if (initCallback) 
    {
      initCallback(this);
    }

    /**
     * 音视频切换相关
     * 根据远端offer的sdp判断呼入的通话模式
     * @author: lei
     */
    if (request.body) 
    {
      const sdp = sdp_transform.parse(request.body);

      request['mode'] = 'audio';

      this._mode = 'audio';
      this._remoteToAudio = true;
      this._remoteToVideo = false;

      for (const m of sdp.media) 
      {
        if (m.type == 'audio') 
        {
          continue;
        }

        if (m.port !== 0) 
        {
          request['mode'] = 'video';
          this._mode = 'video';
          this._remoteToAudio = false;
          this._remoteToVideo = true;
        }
      }
    }

    // 解析呼入 SDP 中的 BFCP floorctrl（委托给 BFCPChannel）
    this._bfcp.parseFloorctrlFromIncomingSDP(request.body);

    // Fire 'newRTCSession' event.
    this._newRTCSession('remote', request);

    // The user may have rejected the call in the 'newRTCSession' event.
    if (this._status === C.STATUS_TERMINATED) 
    {
      return;
    }

    // 远端支持视频模式，触发回调
    if (/(^|[;>])\s*\+?video\s*([;=]|$)/i.test(request.getHeader('contact'))) 
    {
      logger.debug('remoteSupportsVideo');
      this.emit('remoteSupportsVideo', true);
    }

    // Reply 180.
    request.reply(180, null, [ `Contact: ${this._contact}` ]);

    // Fire 'progress' event.
    // TODO: Document that 'response' field in 'progress' event is null for incoming calls.
    this._progress('local', null);
  }

  /**
   * Answer the call.
   */
  answer(options = {}) 
  {
    logger.debug(`${this._id} answer() ${JSON.stringify(options)}`);

    const request = this._request;
    const extraHeaders = Utils.cloneArray(options.extraHeaders);
    const mediaConstraints = Utils.cloneObject(options.mediaConstraints);
    const mediaStream = options.mediaStream || null;
    const pcConfig = Utils.cloneObject(options.pcConfig, { iceServers: [] });
    const rtcConstraints = options.rtcConstraints || null;
    const rtcAnswerConstraints = options.rtcAnswerConstraints || null;
    const rtcOfferConstraints = Utils.cloneObject(options.rtcOfferConstraints);
    const extraFeatures = options.extraFeatures || null;    
    const composerOptions = this._mediaPipeline.resolveMediaEffectsComposerOptions(options);
    const aiNSOptions = options.aiNoiseSuppression || null;

    this._sessionMediaEffectsComposerOptions = composerOptions;
    this._sessionAiNSOptions = aiNSOptions;
    this._mediaStreamProcessor = options.mediaStreamProcessor || null;
    this._mediaPipeline.stopSessionAiNoiseSuppression();

    // 是否启用BFCP（委托给 BFCPChannel 初始化）
    this._bfcp.init(extraFeatures, this.local_identity.uri.user, this.remote_identity.uri.user);

    // SDP协商的分辨率速率
    if (extraFeatures) 
    {
      if (extraFeatures.indexOf('BP480P') !== -1) 
      {
        this._sdpResolution = 'BP480P';
        this._ua.transport.sdpResolution = 'BP480P';
      }

      if (extraFeatures.indexOf('BP720P') !== -1) 
      {
        this._sdpResolution = 'BP720P';
        this._ua.transport.sdpResolution = 'BP720P';
      }
    }

    let tracks;
    let peerHasAudioLine = false;
    let peerHasVideoLine = false;
    let peerOffersFullAudio = false;
    let peerOffersFullVideo = false;

    this._answerMediaConstraints = mediaConstraints;
    this._rtcAnswerConstraints = rtcAnswerConstraints;
    this._rtcOfferConstraints = options.rtcOfferConstraints || null;

    this._data = options.data || this._data;

    // 5G Headers
    push5GServiceHeaders(extraHeaders, this._ua);

    // Check Session Direction and Status.
    if (this._direction !== 'incoming') 
    {
      throw new Exceptions.NotSupportedError('"answer" not supported for outgoing RTCSession');
    }

    // Check Session status.
    if (this._status !== C.STATUS_WAITING_FOR_ANSWER) 
    {
      throw new Exceptions.InvalidStateError(this._status);
    }

    // Session Timers.
    if (this._sessionTimers.enabled) 
    {
      if (Utils.isDecimal(options.sessionTimersExpires)) 
      {
        if (options.sessionTimersExpires >= CRTC_C.MIN_SESSION_EXPIRES) 
        {
          this._sessionTimers.defaultExpires = options.sessionTimersExpires;
        }
        else 
        {
          this._sessionTimers.defaultExpires = CRTC_C.SESSION_EXPIRES;
        }
      }
    }

    this._status = C.STATUS_ANSWERED;

    // An error on dialog creation will fire 'failed' event.
    if (!this._createDialog(request, 'UAS')) 
    {
      request.reply(500, 'Error creating dialog');

      return;
    }

    clearTimeout(this._timers.userNoAnswerTimer);

    extraHeaders.unshift(`Contact: ${this._contact}`);

    // Determine incoming media from incoming SDP offer (if any).
    const sdp = request.parseSDP();

    // Make sure sdp.media is an array, not the case if there is only one media.
    if (!Array.isArray(sdp.media)) 
    {
      sdp.media = [ sdp.media ];
    }

    // Go through all medias in SDP to find offered capabilities to answer with.
    for (const m of sdp.media) 
    {
      if (m.type === 'audio') 
      {
        peerHasAudioLine = true;
        if (!m.direction || m.direction === 'sendrecv') 
        {
          peerOffersFullAudio = true;
        }
      }
      if (m.type === 'video') 
      {
        peerHasVideoLine = true;
        if (!m.direction || m.direction === 'sendrecv') 
        {
          peerOffersFullVideo = true;
        }
      }
    }

    // Remove audio from mediaStream if suggested by mediaConstraints.
    if (mediaStream && mediaConstraints.audio === false) 
    {
      tracks = mediaStream.getAudioTracks();
      for (const track of tracks) 
      {
        mediaStream.removeTrack(track);
      }
    }

    // Remove video from mediaStream if suggested by mediaConstraints.
    if (mediaStream && mediaConstraints.video === false) 
    {
      tracks = mediaStream.getVideoTracks();
      for (const track of tracks) 
      {
        mediaStream.removeTrack(track);
      }
    }

    // Set audio constraints based on incoming stream if not supplied.
    if (!mediaStream && mediaConstraints.audio === undefined) 
    {
      mediaConstraints.audio = peerOffersFullAudio;
    }

    // Set video constraints based on incoming stream if not supplied.
    if (!mediaStream && mediaConstraints.video === undefined) 
    {
      mediaConstraints.video = peerOffersFullVideo;
    }

    // Don't ask for audio if the incoming offer has no audio section.
    if (!mediaStream && !peerHasAudioLine && !rtcOfferConstraints.offerToReceiveAudio) 
    {
      mediaConstraints.audio = false;
    }

    // Don't ask for video if the incoming offer has no video section.
    if (!mediaStream && !peerHasVideoLine && !rtcOfferConstraints.offerToReceiveVideo) 
    {
      mediaConstraints.video = false;
    }

    // Create a new RTCPeerConnection instance. Configuration errors are
    // synchronous, so they must also close the incoming INVITE lifecycle.
    try
    {
      this._createRTCConnection(pcConfig, rtcConstraints);
    }
    catch (error)
    {
      try { request.reply(500, 'Failed to create peer connection'); }
      catch (replyError) { logger.warn(replyError); }
      this._failed('system', null, CRTC_C.causes.WEBRTC_ERROR);

      throw error;
    }

    // 根据自定义流确定是否需要获取对应设备的流
    mediaStream && mediaStream.getTracks().forEach((track) => 
    {
      mediaConstraints[track.kind] = false;
    });

    Promise.resolve()
      // Handle local MediaStream.
      .then(async() => 
      {
        // Audio and/or video requested, prompt getUserMedia.
        if (mediaConstraints.audio || mediaConstraints.video) 
        {
          this._localMediaStreamLocallyGenerated = true;

          // 判断授权是否包含视频
          if (!Utils.supportsVideo(this._ua)) 
          {
            delete mediaConstraints.video;
          }

          /**
           * 音视频切换相关
           * 判断是视频接听还是音频接听
           * @author: lei
           */
          if (!mediaConstraints.video && (mediaStream && mediaStream.getVideoTracks().length === 0)) 
          {
            this._localToAudio = true;
          }

          const mStream = await this._mediaPipeline.getUserMediaWithSessionPipeline(mediaConstraints, composerOptions)
            .catch((error) =>
            {
              if (this._status === C.STATUS_TERMINATED)
              {
                throw new Error('terminated');
              }

              request.reply(480);
              this._failed('local', null, CRTC_C.causes.USER_DENIED_MEDIA_ACCESS);

              this._logEventError('warn', 'getusermediafailed', error);

              this.emit('getusermediafailed', error);

              throw new Error('getUserMedia() failed');
            });

          if (mediaConstraints.video && mStream) 
          {
            this._environment = await Utils.getEnvironmentId();
            logger.debug(`${this._id} environment id: `, this._environment);
          }

          // 绕过 iOS 15.1/15.2 WebKit canvas crash bug
          return Utils.bypassIOS151_152CanvasBug(mStream);
        }
        else
        {
          this._customMediaStream = true;

          return mediaStream;
        }
      })
      // Attach MediaStream to RTCPeerconnection.
      .then((stream) => 
      {
        if (this._status === C.STATUS_TERMINATED) 
        {
          throw new Error('terminated');
        }

        // 如果有自定义流，使用自定义流对应音视频轨道
        if (mediaStream) 
        {
          mediaStream.getTracks().forEach((track) => 
          {
            stream.addTrack(track, stream);
          });
        }

        this._localMediaStream = stream;

        if (stream) 
        {
          this._monitorLocalVideoTrackStates(stream, '_answerVideoTrackStatsTimer');

          // 兼容低版本浏览器不支持addTrack的情况
          if (RTCPeerConnection.prototype.addTrack) 
          {
            stream.getTracks().forEach((track) => 
            {
              this._connection.addTrack(track, stream);
            });
          }
          else 
          {
            this._connection.addStream(stream);
          }

          /**
           * 是否启用 DataChannel
           **/
          if (this._bfcp.enabled) 
          {
            // BFCP 呼入准备：添加占位视频轨道，监听远端 DataChannel
            this._bfcp.setupForIncoming();
          }

        }
      })
      // Set remote description.
      .then(() => 
      {
        if (this._late_sdp) 
        {
          return;
        }

        const newSdp = this._sdpAddMid(request.body);

        // answer 生成时需要优先跟随远端 offer 的视频 b=AS。
        this._lastRemoteOfferSdpForAnswer = newSdp;
        const e = { originator: 'remote', type: 'offer', sdp: Utils.updateSdpByConstraints(newSdp, options.mediaConstraints) };

        logger.debug(`${this._id} emit "sdp"`);
        this.emit('sdp', e);

        const offer = new RTCSessionDescription({ type: 'offer', sdp: e.sdp });

        this._connectionPromiseQueue = this._connectionPromiseQueue
          .then(() => this._connection.setRemoteDescription(offer))
          .catch((error) => 
          {
            request.reply(488);

            this._failed('system', null, CRTC_C.causes.WEBRTC_ERROR);

            emitSetRemoteDescriptionFailed(this, error);

            throw new Error('peerconnection.setRemoteDescription() failed');
          });

        return this._connectionPromiseQueue;
      })
      // Create local description.
      .then(() => 
      {
        if (this._status === C.STATUS_TERMINATED) 
        {
          throw new Error('terminated');
        }

        // TODO: Is this event already useful?
        this._connecting(request);

        if (!this._late_sdp) 
        {
          return this._createLocalDescription('answer', rtcAnswerConstraints)
            .catch((error) => 
            {
              throw new Error(`_createLocalDescription() failed ${error.message}`);
            });
        }
        else 
        {
          return this._createLocalDescription('offer', this._rtcOfferConstraints)
            .catch((error) => 
            {
              throw new Error(`_createLocalDescription() failed ${error.message}`);
            });
        }
      })
      // Send reply.
      .then((desc) => 
      {
        if (this._status === C.STATUS_TERMINATED) 
        {
          throw new Error('terminated');
        }

        if (!mediaConstraints.video && desc) 
        {
          // desc = desc.replace(/(m=video) \d+ (.*\r?\n([\s\S]*?\r?\n)*?a=)recvonly/, '$1 0 $2inactive');
          desc = desc.replace(/(m=video) \d+ ([\s\S]*?a=)recvonly/g, '$1 0 $2inactive');
          desc = Utils.updateSdpByConstraints(desc, options.mediaConstraints);
        }

        if (this._bfcp.enabled) 
        {
          // BFCP SDP 应答属性注入（floorctrl / floorid / mstrm / confid / userid）
          desc = this._bfcp.addAnswerSDPAttributes(desc);
        }

        this._handleSessionTimersInIncomingRequest(request, extraHeaders);

        request.reply(200, null, extraHeaders,
          desc,
          () => 
          {
            this._status = C.STATUS_WAITING_FOR_ACK;

            this._setInvite2xxTimer(request, desc);
            this._setACKTimer();
            this._accepted('local');
          },
          () => 
          {
            this._failed('system', null, CRTC_C.causes.CONNECTION_ERROR);
          }
        );
      })
      .catch((error) => 
      {
        if (this._status === C.STATUS_TERMINATED) 
        {
          return;
        }

        logger.warn(error);

        // answer() 的媒体和 SDP 处理在异步链中执行。任何未被前置分支收口的
        // 异常都必须结束本次呼入，否则会话会停留在 ANSWERED，主叫持续振铃。
        try { request.reply(500, 'Failed to create answer'); }
        catch (replyError) { logger.warn(replyError); }

        this._failed('system', null, CRTC_C.causes.WEBRTC_ERROR);
      });
  }

  /**
   * 切换到视频模式
   */
  upgradeToVideo(options, done) 
  {
    logger.debug(`${this._id} upgradeToVideo()`, options, done);

    if (!Utils.supportsUpgradeToVideo(this._ua)) 
    {
      return;
    }

    if (!options) 
    {
      options = {};
    }

    logger.debug(`${this._id} options: `, JSON.stringify(options));

    if (!done) 
    {
      done = () => { };
    }

    if (
      Object.prototype.hasOwnProperty.call(options, 'mediaEffectsComposer')
    )
    {
      this._sessionMediaEffectsComposerOptions = this._mediaPipeline.resolveMediaEffectsComposerOptions(options);
    }

    // 优化处理切换到视频模式的视频约束条件
    let videoConstraints = { video: true };

    // 处理options.videoConstraints
    if (options.videoConstraints) 
    {
      // 确保必要的对象存在
      this._inviteMediaConstraints = this._inviteMediaConstraints || {};
      this._inviteMediaConstraints.video = this._inviteMediaConstraints.video || {};

      // 合并属性
      Object.assign(this._inviteMediaConstraints.video, options.videoConstraints);
      videoConstraints = this._inviteMediaConstraints.video;
    }
    // 如果options.videoConstraints不存在，但this._inviteMediaConstraints.video存在
    else if (this._inviteMediaConstraints && this._inviteMediaConstraints.video) 
    {
      videoConstraints = this._inviteMediaConstraints.video;
    }

    const videoStream = options.videoStream || null;

    // Check Session Status.
    if (
      this._status !== C.STATUS_CONFIRMED &&
      this._status !== C.STATUS_WAITING_FOR_ACK &&
      this._status !== C.STATUS_1XX_RECEIVED
    ) 
    {
      throw new Exceptions.InvalidStateError(this._status);
    }

    this._localToAudio = false;
    this._localToVideo = true;

    return Promise.resolve()
      .then(async() => 
      {
        const composerOptions = this._sessionMediaEffectsComposerOptions;

        // 兼容重复调用，或者由单向视频切换双向视频，或者双向视频切换单向视频的情况
        if (this._localMediaStream.getVideoTracks().length > 0) 
        {
          this._connection.getTransceivers().forEach((t) => 
          {
            // 双向视频
            t.direction = 'sendrecv';

            // 单向视频，仅发送
            if (t.sender && t.sender.track && t.sender.track.kind === 'video' && options.sendOnly) 
            {
              t.direction = 'sendonly';
            }

            // 单向视频，仅接收
            if (t.receiver && t.receiver.track && t.receiver.track.kind === 'video' && options.recvOnly) 
            {
              t.direction = 'recvonly';
            }

          });

          if (options.recvOnly) 
          {
            return;
          }
        }

        // 单向视频，仅接收
        if (options.recvOnly) 
        {
          return;
        }

        let stream;

        if (videoStream) 
        {
          stream = videoStream;
          this._customMediaStream = true;
        }
        else 
        {
          stream = await this._mediaPipeline.getUserMediaWithSessionPipeline({ video: videoConstraints }, composerOptions)
            .catch((error) => { throw error; });
          if (stream)
          {
            this._environment = await Utils.getEnvironmentId();
            logger.debug(`${this._id} environment id: `, this._environment);
          }
        }

        if (stream) 
        {
          // 兼容自定义流未释放的情况
          if (this._customMediaStream) 
          {
            const oldVideoTrack = this._localMediaStream.getVideoTracks()[0];
            const newVideoTrack = stream.getVideoTracks()[0];

            if (oldVideoTrack) 
            {
              this._localMediaStream.removeTrack(oldVideoTrack);
              this._localMediaStream.addTrack(newVideoTrack);

              let haveVideoTrackToSend = false;
              const senders = this._connection.getSenders();

              for (let i = 0; i < senders.length; i++) 
              {
                if (senders[i].track.kind === 'video') 
                {
                  senders[i].replaceTrack(newVideoTrack);

                  haveVideoTrackToSend = true;
                  break; // 跳出整个循环
                }
              }

              // 如果没有视频轨道则执行添加
              if (haveVideoTrackToSend) 
              {
                return true;
              }
            }
          }

          stream = Utils.bypassIOS151_152CanvasBug(stream);

          const videoTracks = stream.getVideoTracks();

          this._localMediaStream.addTrack(videoTracks[0]);

          // 根据是否单向添加Transceiver
          const transceiver = this._connection.addTransceiver('video', {
            direction : options.sendOnly ? 'sendonly' : 'sendrecv'
          });

          // 把 track 绑定到 sender
          await transceiver.sender.replaceTrack(videoTracks[0]);

          return true;
        }
      })
      .then(() => 
      {
        this._iceReady = false;

        const opts = { rtcOfferConstraints: { iceRestart: true } };

        // 单向视频，仅接收
        if (options.recvOnly) 
        {
          this._connection.addTransceiver('video', {
            direction : 'recvonly'
          });
        }

        // 使用update还是reinvite
        if (options.useUpdate) 
        {
          opts['useUpdate'] = true;
        }

        this.renegotiate(opts, () => 
        {
          done();

          if (options.sendOnly) 
          {
            // 单向视频，每分钟发送一次关键帧
            Utils.sendKeyFrames(this._connection, 0.5);
          }
        });
      });
  }

  /**
   * 切换到音频模式
   */
  downgradeToAudio(options = {}, done = () => { }) 
  {
    logger.debug(`${this._id} downgradeToAudio()`);
    this.demoteToAudio(options, done);
  }

  demoteToAudio(options = {}, done = () => { }) 
  {
    logger.debug(`${this._id} demoteToAudio()`);

    // Check Session Status.
    if (
      this._status !== C.STATUS_CONFIRMED &&
      this._status !== C.STATUS_WAITING_FOR_ACK &&
      this._status !== C.STATUS_1XX_RECEIVED
    ) 
    {
      throw new Exceptions.InvalidStateError(this._status);
    }

    if (this._localToAudio === true) 
    {
      return false;
    }

    if (!this._isReadyToReOffer()) 
    {
      return false;
    }

    this._localToAudio = true;
    this._localToVideo = false;

    const eventHandlers = {
      succeeded : () => 
      {
        if (done) { done(); }
      },
      failed : (resp) => 
      {
        try 
        {
          logger.warn(`${this._id} resp: `, JSON.stringify(resp));
        }
        catch (error) 
        {
          logger.error(`${this._id} resp: `, error.toString());
        }

        this.terminate({
          cause         : CRTC_C.causes.WEBRTC_ERROR,
          status_code   : 500,
          reason_phrase : 'DowngradeToAudio Failed'
        });
      }
    };

    if (options.useUpdate) 
    {
      this._sendUpdate({
        sdpOffer     : true,
        eventHandlers,
        extraHeaders : options.extraHeaders
      });
    }
    else 
    {
      this._sendReinvite({
        eventHandlers,
        extraHeaders : options.extraHeaders
      });
    }

    return true;
  }

  /**
   * 切换设备，一般用于切换摄像头
   */
  /**
   * 切换设备（摄像头/麦克风）。
   *
   * 当会话中启用了 MediaEffectsComposer 时，摄像头切换走 composer 分支：
   *
   *   switchDevice('camera'):
   *   ┌────────────────────────────────────────────────────────────┐
   *   │ 1. getUserMedia 获取新摄像头流                             │
   *   │                                                            │
   *   │ 2. 管线处理（与初始化相同）：                               │
   *   │    └─ _processMediaStream → AI 降噪 → 混流合成             │
   *   │                                                            │
   *   │ 3. composer 分支（useComposerBranch=true 时）：             │
   *   │    ├─ 停止旧输入 videoTrack                                │
   *   │    ├─ currentComposer.removeSource(oldInputStream)          │
   *   │    ├─ currentComposer.addSource(newInputStream)             │
   *   │    │   保持同一个 composer 实例，避免重建带来的状态抖动      │
   *   │    └─ currentComposer.getOutput('video') → 新合成输出轨     │
   *   │                                                            │
   *   │ 4. 回退分支（composer 操作失败时）：                        │
   *   │    └─ 走默认 sender.replaceTrack 路径                       │
   *   └────────────────────────────────────────────────────────────┘
   *
   *   switchDevice('audio'):
   *   ┌────────────────────────────────────────────────────────────┐
   *   │ 1. getUserMedia 获取新麦克风流                             │
   *   │ 2. _mediaPipeline.replaceAudioTrackWithSessionAiNoiseSuppression(stream) │
   *   │    └─ 引擎已存在 → replaceAudioTrack 替换输入音轨           │
   *   │    └─ 引擎不存在 → 降级为从头初始化                        │
   *   │ 3. 更新 localMediaStream 中的音轨                           │
   *   │ 4. sender.replaceTrack(audioTrack)                         │
   *   └────────────────────────────────────────────────────────────┘
   *
   * @param {string} type - 'camera' | 'audio'
   * @param {string} [deviceId] - 目标设备 ID
   * @returns {Promise<MediaStream>} 切换后的新流
   */
  async switchDevice(type, deviceId) 
  {
    logger.debug(`${this._id} switchDevice(), type:${type}, deviceId:${deviceId}`);

    // Check Session Status.
    if (
      this._status !== C.STATUS_CONFIRMED &&
      this._status !== C.STATUS_WAITING_FOR_ACK &&
      this._status !== C.STATUS_1XX_RECEIVED
    ) 
    {
      throw new Exceptions.InvalidStateError(this._status);
    }

    this._markStatsTransition('device-switch');

    // TODO 需要判断当前是否是视频通话
    if (type === 'camera') 
    {
      const composerOptions = this._sessionMediaEffectsComposerOptions;

      if (this._localCameras.length === 0) 
      {
        const cameras = await Utils.getCameras();

        cameras.forEach((cam) => 
        {
          this._localCameras.push(cam.deviceId);
        });
      }

      if (!this._selectedLocalCameras) 
      {
        this._selectedLocalCameras = 'user';
      }

      const constraints = { audio: false, video: true };

      return Promise.resolve()
        .then(() => 
        {
          // composer 专用分支开启条件：
          // 1) 当前会话声明了 composer 配置；
          // 2) composer 实例已存在（说明通话已在用 composer）；
          // 3) 已记录有效的 composer 输入流（用于 stop old input + remove/add）。
          const useComposerBranch = Boolean(
            composerOptions &&
            this._mediaEffectsComposer &&
            this._mediaEffectsComposerInputStream
          );
          let videoConstraints;

          // 如果传参包含deviceId则使用deviceId
          if (deviceId) 
          {
            if (deviceId !== 'user' && deviceId !== 'environment') 
            {
              videoConstraints = { deviceId: { exact: deviceId } };

              // 修复切换摄像头deviceId和faceingMode混用的问题
              try 
              {
                delete this._inviteMediaConstraints.video.facingMode;
              }
              catch (e) 
              {
                logger.error(this._id + e.message);
              }
            }
            // 使用facingMode参数
            else if (navigator.mediaDevices.getSupportedConstraints()['facingMode']) 
            {
              // 两个摄像头使用facingMode参数切换
              videoConstraints = { facingMode: deviceId };

              // 兼容华为安卓切换后摄
              if (this._environment && deviceId === 'environment') 
              {
                videoConstraints = { deviceId: { exact: this._environment } };
                logger.debug(`${this._id} switchDevice use: environment, `, this._environment);
              }

              // 修复切换摄像头deviceId和faceingMode混用的问题
              try 
              {
                delete this._inviteMediaConstraints.video.deviceId;
              }
              catch (e) 
              {
                logger.error(this._id + e.message);
              }
            }
          }
          else if (this._localCameras.length > 2) 
          {
            // 多于两个摄像头，则轮询摄像头列表
            let did;

            if (this._selectedLocalCameras === 'user') 
            {
              did = this._localCameras[1];
              this._selectedLocalCameras = this._localCameras[1];
            }
            else if (this._localCameras.indexOf(this._selectedLocalCameras) == (this._localCameras.length - 1)) 
            {
              did = this._localCameras[0];
              this._selectedLocalCameras = this._localCameras[0];
            }
            else 
            {
              did = this._localCameras[(this._localCameras.indexOf(this._selectedLocalCameras) + 1)];
              this._selectedLocalCameras = this._localCameras[(this._localCameras.indexOf(this._selectedLocalCameras) + 1)];
            }

            videoConstraints = { deviceId: did };
          }
          else 
          {
            // 如果没有deviceId且少于两个摄像头则不处理切换摄像头操作
            logger.warn(`${this._id} not enough cameras.`);

            return;
          }

          let next = false;

          this._connection.getSenders().find((s) => 
          {
            logger.debug(`${this._id} kind: ${s.track && s.track.kind}`);
            // 辅流 sender 发送的是屏幕轨。切换摄像头只能处理主视频 sender，
            // 否则会先 stop 屏幕轨，导致系统共享和其他复用该流的会话一起结束。
            if (s === this._localShareRTPSender) return false;

            if (s.track && s.track.kind == 'video') 
            {
              // 只要检测到“会话中存在视频 sender”即可继续流程。
              // 注意：在 composer 分支里 sender.track 可能是 composer 输出轨，不能提前 stop。
              next = true;
              if (this._bfcp.enabled) 
              {
                // 启用了BFCP，区分一下BFCP控制的视频轨道
                // eslint-disable-next-line max-len
                if (
                  !useComposerBranch &&
                  s.track != this._bfcp.videoTrack &&
                  s.track != (this._localShareStream && this._localShareStream.getVideoTracks()[0])
                )
                {
                  s.track.stop();
                }
              }
              else 
              {
                !useComposerBranch && s.track.stop();
              }
            }
          });

          if (!next) 
          {
            return Promise.reject('switchDevice Failed. There is no video track for the current session.');
          }

          this._localMediaStreamLocallyGenerated = true;

          // 确保必要的对象存在
          this._inviteMediaConstraints = this._inviteMediaConstraints || {};
          this._inviteMediaConstraints.video = this._inviteMediaConstraints.video || {};

          constraints.video = videoConstraints;
          constraints.video = Object.assign(this._inviteMediaConstraints.video, constraints.video);

          return { constraints, useComposerBranch };
        })
        .then(async({ constraints: videoConstraints, useComposerBranch }) => 
        {
          logger.debug(`${this._id} videoConstraints`, JSON.stringify(videoConstraints));

          const sender = this._connection.getSenders().find((s) => 
          {
            // 新摄像头轨最终也必须替换到主视频 sender，不能覆盖独立屏幕辅流。
            if (s === this._localShareRTPSender) return false;

            if (this._bfcp.enabled) 
            {
              // 启用了BFCP，区分一下BFCP控制的视频轨道
              return s.track && s.track.kind == 'video' && s.track != this._bfcp.videoTrack && s.track != (this._localShareStream && this._localShareStream.getVideoTracks()[0]);
            }
            else 
            {
              return s.track && s.track.kind == 'video';
            }
          });          

          // iOS手机延迟重新获取
          navigator.userAgent.indexOf('iPhone') != -1 && Utils.sleep(500);
          const sessionComposerOptions = this._sessionMediaEffectsComposerOptions;
          const sessionAiNSOptions = this._sessionAiNSOptions;

          // 统一媒体获取 + 预处理入口（虚拟背景等），默认流和 composer 流共用。
          const getProcessedStream = async() =>
          {
            if (!useComposerBranch && sessionComposerOptions)
            {
              return await this._mediaPipeline.getUserMediaWithSessionPipeline(
                { video: videoConstraints },
                sessionComposerOptions,
                sessionAiNSOptions
              );
            }

            return await navigator.mediaDevices.getUserMedia(videoConstraints)
              .then(async(mediastream) =>
              {
                return await this._mediaPipeline.processMediaStream(mediastream);
              })
              .catch((error) =>
              {
                this._logEventError('error', 'getusermediafailed', error);
                this.emit('getusermediafailed', error);
                throw new Error('getUserMedia() failed');
              });
          };

          // 对新流做统一后处理：
          // 1) 打点输出 track 状态，便于定位端侧设备/轨道异常；
          // 2) 保留原有 iOS 15.1/15.2 canvas 绕过逻辑，避免回归历史 crash。
          const normalizeStream = (stream) =>
          {
            try
            {
              const track = stream.getVideoTracks()[0];

              logger.debug(`${this._id} stream: `, track.kind, track.label, track.readyState);
            }
            catch (error) 
            {
              logger.error(`${this._id} stream error: `, error.message);
            } 

            stream = Utils.bypassIOS151_152CanvasBug(stream);

            return stream;
          };

          // 统一“把某个 videoTrack 应用到会话”的收口：
          // - 替换本地 _localMediaStream 的视频轨；
          // - replaceTrack 到 sender；
          // - 触发 cameraChanged 事件（保持既有对外行为）。
          const applyTrack = (nextTrack, streamForEvent) =>
          {
            try 
            {
              this._localMediaStream.removeTrack(this._localMediaStream.getVideoTracks()[0]);
            }
            catch (error) 
            {
              logger.error(this._id + error.message);
            }

            this._localMediaStream.addTrack(nextTrack);

            sender.replaceTrack(nextTrack);

            this.emit('cameraChanged', { videoStream: streamForEvent });
          };

          if (!useComposerBranch)
          {
            // 默认分支（无 composer 或 composer 状态不完整）：
            // 与你当前逻辑一致：先停 sender 旧轨，再取新流并直接替换 sender。
            // 先释放原来的设备再获取新的
            sender && sender.track && sender.track.stop();
            const stream = normalizeStream(await getProcessedStream());
            const videoTrack = stream.getVideoTracks()[0];

            applyTrack(videoTrack, stream);

            return stream;
          }

          try
          {
            const currentComposer = this._mediaEffectsComposer;
            const oldInputStream = this._mediaEffectsComposerInputStream;
            const oldInputVideoTrack = oldInputStream &&
              oldInputStream.getVideoTracks &&
              oldInputStream.getVideoTracks()[0];

            // composer 分支关键点：先停“旧输入 videoTrack”，而不是 sender 上的 composer 输出轨。
            oldInputVideoTrack && oldInputVideoTrack.stop();

            const stream = normalizeStream(await getProcessedStream());
            const newVideoTrack = stream.getVideoTracks && stream.getVideoTracks()[0];

            if (!newVideoTrack)
            {
              throw new Error('switchDevice composer branch has no video track');
            }

            const newInputStream = new MediaStream();
            const preservedAudioTracks = oldInputStream && oldInputStream.getAudioTracks ?
              oldInputStream.getAudioTracks() :
              [];
            const nextAudioTracks = preservedAudioTracks.length > 0 ?
              preservedAudioTracks :
              (stream.getAudioTracks ? stream.getAudioTracks() : []);

            nextAudioTracks.forEach((track) =>
            {
              newInputStream.addTrack(track, newInputStream);
            });
            newInputStream.addTrack(newVideoTrack, newInputStream);
            const sourceOptions = { slot: 0 };

            if (typeof currentComposer.getSourceAiVirtualBackground === 'function')
            {
              try
              {
                const aiVirtualBackground = currentComposer.getSourceAiVirtualBackground(0);

                if (aiVirtualBackground)
                {
                  sourceOptions.aiVirtualBackground = aiVirtualBackground;
                }
              }
              catch (error)
              {}
            }

            if (typeof currentComposer.getSourceMirror === 'function')
            {
              try
              {
                const mirrorState = currentComposer.getSourceMirror(0);

                if (mirrorState && typeof mirrorState.effective === 'boolean')
                {
                  sourceOptions.sourceMirror = mirrorState.effective;
                }
              }
              catch (error)
              {}
            }

            // 在同一个 composer 内完成输入替换，避免重建 composer 带来的状态抖动。
            currentComposer.removeSource(oldInputStream);
            currentComposer.addSource(newInputStream, sourceOptions);
            // 记录最新输入流，供下次 switchDevice 继续替换。
            this._mediaEffectsComposerInputStream = newInputStream;

            const mixedVideoStream = await currentComposer.getOutput({ type: 'video' });
            const mixedVideoTrack = mixedVideoStream &&
              mixedVideoStream.getVideoTracks &&
              mixedVideoStream.getVideoTracks()[0];

            if (!mixedVideoTrack)
            {
              throw new Error('switchDevice composer output has no video track');
            }

            applyTrack(mixedVideoTrack, mixedVideoStream);

            return mixedVideoStream;
          }
          catch (error)
          {
            // composer 分支任一步失败（remove/add/output 取轨等），回退到默认路径，
            // 目标是优先保障“能切成功”，同时保留 warn 方便后续排查 composer 分支失败原因。
            logger.warn(`${this._id} switchDevice composer branch failed, fallback to default flow:`, error);

            sender && sender.track && sender.track.stop();
            const fallbackStream = normalizeStream(await getProcessedStream());
            const fallbackTrack = fallbackStream.getVideoTracks()[0];

            applyTrack(fallbackTrack, fallbackStream);

            return fallbackStream;
          }
        });
    }
    else if (type === 'audio' && deviceId) 
    {
      const constraints = { audio: true, video: false };

      return Promise.resolve()
        .then(() => 
        {
          let next = false;
          const audioConstraints = { deviceId: { exact: deviceId } };
          const oldAiNSInputTrack = this._aiNSInputStream &&
            this._aiNSInputStream.getAudioTracks &&
            this._aiNSInputStream.getAudioTracks()[0];

          this._connection.getSenders().find((s) => 
          {
            logger.debug(`${this._id} kind: ${s.track.kind}`);
            if (s.track.kind == 'audio') 
            {
              next = true;
              if (!this._sessionAiNSEngine)
              {
                s.track.stop();
              }
            }
          });

          if (!next) 
          {
            return Promise.reject('switchDevice Failed. There is no audio track for the current session.');
          }

          oldAiNSInputTrack && oldAiNSInputTrack.stop();

          this._localMediaStreamLocallyGenerated = true;

          constraints.audio = audioConstraints;

          return navigator.mediaDevices
            .getUserMedia(this._mediaPipeline.getGumConstraintsWithProcessorFlags(constraints))
            .catch((error) => 
            {
              this._logEventError('error', 'getusermediafailed', error);
              this.emit('getusermediafailed', error);
              throw new Error('getUserMedia() failed');
            });
        })
        .then(async(stream) =>
        {
          // 切换麦克风时优先复用现有 AI 降噪引擎，避免每次切设备都重建整条音频处理链。
          stream = await this._mediaPipeline.replaceAudioTrackWithSessionAiNoiseSuppression(stream);

          try 
          {
            this._localMediaStream.removeTrack(this._localMediaStream.getAudioTracks()[0]);
          }
          catch (error) 
          {
            logger.error(this._id + error.message);
          }

          const audioTrack = stream.getAudioTracks()[0];

          this._localMediaStream.addTrack(audioTrack);

          const sender = this._connection.getSenders().find((s) => 
          {
            return s.track.kind == 'audio';
          });

          sender.replaceTrack(audioTrack);

          this.emit('audiointputChanged', { audioStream: stream });

          return stream;
        });
    }
    else 
    {
      logger.error(`${this._id} Invalid parameters`);

      // 参数错误
      return Promise.reject('Invalid parameters');
    }
  }

  /**
   * 分享媒体。
   *
   * 推荐所有分享类型统一使用 `share(type, options)`。普通分享 options 使用
   * `id/assembly/dual/skip` 字段；独立屏幕辅流使用 `mode: 'auxiliary'`。历史位置参数
   * `(type, id, assembly, dual, skip)` 和上一版第四参数 auxiliary options 继续兼容。
   *
   * @param {string} type 分享类型；辅流模式当前只支持 `screen`
   * @param {string|Object|null} idOrOptions 历史页面元素选择器，或分享参数对象
   * @param {Function|null} assembly 历史 HTML 合成函数；辅流模式不使用
   * @param {boolean|Object} dualOrOptions BFCP 开关，或兼容位置的辅流参数
   * @param {boolean} skip 是否跳过 BFCP FloorRequest；辅流模式不使用
   * @returns {Promise<MediaStream|void>} 屏幕流或历史分享结果
   */
  async share(type, idOrOptions, assembly, dualOrOptions, skip)
  {
    logger.debug(`${this._id} share()`);

    const shareArguments = this._normalizeShareArguments(
      idOrOptions,
      assembly,
      dualOrOptions,
      skip
    );

    if (shareArguments.options)
    {
      if (type !== 'screen' || shareArguments.options.mode !== 'auxiliary')
      {
        throw new TypeError('Auxiliary share options are only supported for screen sharing.');
      }

      return this._shareAuxiliaryScreen(type, shareArguments.options);
    }

    return this._shareLegacy(
      type,
      shareArguments.id,
      shareArguments.assembly,
      shareArguments.dual,
      shareArguments.skip
    );
  }

  /**
   * 将推荐的二参调用和历史位置参数统一成内部结构。
   *
   * 推荐普通分享：share(type, { id, assembly, dual, skip })
   * 推荐独立辅流：share('screen', { mode: 'auxiliary', ... })
   * 兼容辅流：share('screen', null, null, options)
   * 历史：share(type, id, assembly, dual, skip)
   *
   * @returns {{id: *, assembly: *, dual: boolean, skip: boolean, options: Object|null}}
   */
  _normalizeShareArguments(idOrOptions, assembly, dualOrOptions, skip)
  {
    const secondArgumentIsOptions = idOrOptions &&
      typeof idOrOptions === 'object' && !Array.isArray(idOrOptions);
    const fourthArgumentIsOptions = dualOrOptions &&
      typeof dualOrOptions === 'object' && !Array.isArray(dualOrOptions);

    if (secondArgumentIsOptions && fourthArgumentIsOptions)
    {
      throw new TypeError('Share options cannot be provided in both argument positions.');
    }

    if (secondArgumentIsOptions)
    {
      const auxiliaryOptionKeys = [
        'mode',
        'mediaStream',
        'displayMediaConstraints',
        'stopStreamOnUnShare',
        'contentHint'
      ];
      const isAuxiliaryOptions = auxiliaryOptionKeys.some((key) =>
        Object.prototype.hasOwnProperty.call(idOrOptions, key));

      // auxiliary 参数交给 share() 统一校验 mode 和 type，避免漏写 mode 时静默进入旧流程。
      if (isAuxiliaryOptions)
      {
        return {
          id       : null,
          assembly : null,
          dual     : false,
          skip     : false,
          options  : idOrOptions
        };
      }

      // 普通分享只改变参数表达方式，最终仍调用原有实现，BFCP 和 replaceTrack 时序不变。
      return {
        id       : idOrOptions.id === undefined ? null : idOrOptions.id,
        assembly : idOrOptions.assembly === undefined ? null : idOrOptions.assembly,
        dual     : idOrOptions.dual === undefined ? false : idOrOptions.dual,
        skip     : idOrOptions.skip === undefined ? false : idOrOptions.skip,
        options  : null
      };
    }

    return {
      id       : idOrOptions,
      assembly : assembly,
      dual     : fourthArgumentIsOptions ? false : dualOrOptions,
      skip     : skip,
      options  : fourthArgumentIsOptions ? dualOrOptions : null
    };
  }

  /**
   * 执行历史共享并维护统一共享模式。
   *
   * 旧实现保持在 _shareLegacyImpl() 中；包装层只增加并发保护和失败后的模式复位，
   * 不改变 BFCP、captureStream、sender.replaceTrack 等历史时序。
   */
  async _shareLegacy(type, id, assembly, dual, skip)
  {
    if (this._shareMode)
    {
      throw new Error(`A ${this._shareMode} media share is already active.`);
    }

    this._shareMode = 'legacy';

    try
    {
      const result = await this._shareLegacyImpl(type, id, assembly, dual, skip);
      const tracks = this._localShareStream && this._localShareStream.getTracks ?
        this._localShareStream.getTracks() : [];
      const hasLiveTrack = tracks.some((track) => track.readyState !== 'ended');

      // 无效类型或缺少 assembly 的历史调用可能正常返回但没有产生共享轨，不能锁住模式。
      if (!hasLiveTrack) this._shareMode = null;

      return result;
    }
    catch (error)
    {
      if (this._shareMode === 'legacy') this._shareMode = null;
      throw error;
    }
  }

  async _shareLegacyImpl(type, id, assembly, dual, skip)
  {

    // 双流必须开启BFCP支持
    if ((dual && !this._bfcp.enabled) || (!dual && this._bfcp.enabled)) 
    {
      return Promise.reject(new Exceptions.NotSupportedError(`Dual and BFCP settings must be consistent. Dual: ${dual}, BFCP: ${this._bfcp.enabled}`));
    }

    // Check Session Status.
    if (
      this._status !== C.STATUS_CONFIRMED &&
      this._status !== C.STATUS_WAITING_FOR_ACK &&
      this._status !== C.STATUS_1XX_RECEIVED
    ) 
    {
      return Promise.reject(new Exceptions.InvalidStateError(this._status));
      // throw new Exceptions.InvalidStateError(this._status);
    }

    let timer;
    let floorResponse;
    const element = document.querySelector(id);

    // 根据BFCP协议响应判断如何执行双流
    try 
    {
      if (this._bfcp.enabled && !skip) 
      {
        // 发送 BFCP FloorRequest 获取共享权限
        floorResponse = await this._bfcp.sendFloorRequest();

        // 处理响应并获取请求状态（BFCPChannel 内部会发送 ACK、更新状态、触发事件）
        const status = this._bfcp.handleFloorRequestStatusMessage(floorResponse);
        // Log the response for debugging purposes

        logger.debug(`${this._id} Floor request response:`, floorResponse);

        if (status != RequestStatusValue.Granted) 
        {
          return Promise.reject(`Floor request not accepted. Status: ${status}`);
        }
      }
    }
    catch (error) 
    {
      logger.error(`${this._id} Error while processing floor request:`, error.message || error);

      return Promise.reject(`Floor request failed: ${error.message || 'Unknown error'}`);
      // throw new Error(`Floor request failed: ${error.message || 'Unknown error'}`);
    }

    this._markStatsTransition('share-start');

    // 分享页面元素
    function renderHtml(canvas, ctx) 
    {
      assembly(document.querySelector(id), { allowTaint: true, logging: false }).then((cvs) => 
      {
        canvas.width = cvs.width;
        canvas.height = cvs.height;

        ctx.drawImage(cvs, 0, 0, cvs.width, cvs.height);
      })
        .then(() => 
        {
          renderHtml(canvas, ctx);
        });
    }

    // 分享视频
    if (type === 'video') 
    {
      logger.debug(`${this._id} share video`);

      this._localShareStream = element.captureStream(0);

      this._localShareStreamLocallyGenerated = true;

      this._streamInactiveHandle(dual);

      this._localShareStream.getVideoTracks()
        .forEach((track) => 
        {
          if (dual) 
          {
            const sender = this._connection.getSenders().find((s) => 
            {
              return s.track == this._bfcp.videoTrack;
            });

            sender.replaceTrack(track);
          }
          else 
          {
            const sender = this._connection.getSenders().find((s) => 
            {
              return s.track.kind == 'video' && s.track.readyState !== 'ended';
            });

            sender.replaceTrack(track);
          }
        });
    }
    // 分享图片
    else if (type === 'pic') 
    {
      logger.debug(`${this._id} share pic`);

      if (timer) 
      {
        clearInterval(timer);
      }
      const canvas = document.createElement('canvas');

      canvas.width = element.naturalWidth ? element.naturalWidth : element.width;
      canvas.height = element.naturalHeight ? element.naturalHeight : element.height;

      const ctx = canvas.getContext('2d');

      timer = setInterval(() => 
      {
        // eslint-disable-next-line max-len
        ctx.drawImage(element, 0, 0, (element.naturalWidth ? element.naturalWidth : element.width), element.naturalHeight ? element.naturalHeight : element.height);
      }, 100);

      this._localShareStream = canvas.captureStream(15);

      this._localShareStreamLocallyGenerated = true;

      this._streamInactiveHandle(dual);

      this._localShareStream.getVideoTracks()
        .forEach((track) => 
        {
          if (dual) 
          {
            const sender = this._connection.getSenders().find((s) => 
            {
              return s.track == this._bfcp.videoTrack;
            });

            sender.replaceTrack(track);
          }
          else 
          {
            const sender = this._connection.getSenders().find((s) => 
            {
              return s.track.kind == 'video' && s.track.readyState !== 'ended';
            });

            sender.replaceTrack(track);
          }
        });
    }
    // 分享页面元素
    else if (type === 'html') 
    {
      logger.debug(`${this._id} share html`);

      if (!assembly) 
      {
        return;
      }

      const canvas = document.createElement('canvas');

      canvas.width = 1;
      canvas.height = 1;

      const ctx = canvas.getContext('2d');

      renderHtml(canvas, ctx);

      this._localShareStream = canvas.captureStream(15);

      this._localShareStreamLocallyGenerated = true;

      this._streamInactiveHandle(dual);

      this._localShareStream.getVideoTracks()
        .forEach((track) => 
        {
          if (dual) 
          {
            const sender = this._connection.getSenders().find((s) => 
            {
              return s.track == this._bfcp.videoTrack;
            });

            sender.replaceTrack(track);
            // this._bfct = track;
          }
          else 
          {
            const sender = this._connection.getSenders().find((s) => 
            {
              return s.track.kind == 'video' && s.track.readyState !== 'ended';
            });

            sender.replaceTrack(track);
          }
        });
    }
    // 分享屏幕
    else if (type === 'screen') 
    {
      logger.debug(`${this._id} share screen`);

      // 判断浏览器是否兼容获取屏幕分享
      if (!(navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices)) 
      {
        logger.warn(`${this._id} getDisplayMedia is not supported`);
        this.emit('getdisplaymediafailed');
      }

      // 分享屏幕 默认帧率 15
      return navigator.mediaDevices.getDisplayMedia({ video: { width: { max: 1920 }, height: { max: 1080 }, frameRate: 15 }, audio: true })
        .then((stream) => 
        {
          this._localShareRTPSender = null;
          this._localShareStream = stream;

          this._streamInactiveHandle(dual);

          if (dual) 
          {
            if (this._bfcp.requestStatus === RequestStatusValue.Granted) 
            {
              // BFCP 双流方式分享屏幕
              stream.getTracks().forEach((track) => 
              {
                if (track.kind === 'audio') 
                {
                  this._bfcp.addShareAudioToBfcpAudioTrack(stream);
                }
                else 
                {
                  const sender = this._connection.getSenders().find((s) => 
                  {
                    return s.track == this._bfcp.videoTrack;
                  });

                  sender.replaceTrack(track);
                }
              });

              this._localShareStreamLocallyGenerated = true;

              return stream;
            }
            else 
            {
              // 如果共享权限已经被撤销则自动取消共享
              this.unShare();

              return Promise.reject(new Error('Yours sharing permission has been revoked.'));
            }
          }
          else 
          {
            // 替换流方式分享屏幕
            stream.getTracks().forEach((track) => 
            {
              const sender = this._connection.getSenders().find((s) => 
              {
                return s.track.kind == 'video' && s.track.readyState !== 'ended';
              });

              sender.replaceTrack(track);
            });

            this._localShareStreamLocallyGenerated = true;

            return stream;
          }
        })
        .catch((error) => 
        {
          if (error.message || error.message.indexOf('user gesture handler') !== -1) 
          {
            setTimeout(() => 
            {
              // BFCP 释放资源
              this._localShareStreamLocallyGenerated || (this._bfcp.enabled && this._bfcp.sendFloorRelease());
            }, 10000);
          }
          else 
          {
            // BFCP 释放资源
            this._bfcp.enabled && this._bfcp.sendFloorRelease();
          }

          this._logEventError('warn', 'getdisplaymediafailed', error);
          this.emit('getdisplaymediafailed', error);
          throw error;
        });
    }
  }

  /**
   * 停止分享媒体。
   *
   * 对接入方保持无参数调用。track-ended 等内部场景直接调用 _stopAuxiliaryShare(options)，
   * 不把 SDK 私有控制项暴露到公开 API。辅流启动未完成时调用本方法也会设置取消标记，
   * 等待启动流程进入安全回滚点，避免遗留正在发送的 sender。
   *
   * @returns {void|Promise<void>} 辅流模式可等待 sender 清理完成；历史模式保持 void
   */
  unShare()
  {
    logger.debug(`${this._id} unShare()`);

    // Check Session Status.
    if (
      this._status !== C.STATUS_CONFIRMED &&
      this._status !== C.STATUS_WAITING_FOR_ACK &&
      this._status !== C.STATUS_1XX_RECEIVED
    ) 
    {
      throw new Exceptions.InvalidStateError(this._status);
    }

    // 辅流模式需要异步 replaceTrack(null) 并发送停止通知，不能走历史的单纯 stop track。
    if (
      this._shareMode === 'auxiliary' ||
      this._auxiliaryShareActive ||
      this._auxiliaryShareStarting ||
      this._auxiliaryShareStopPromise
    )
    {
      return this._stopAuxiliaryShare();
    }

    this._markStatsTransition('share-stop');

    Utils.closeMediaStream(this._localShareStream);
    if (this._shareMode === 'legacy') this._shareMode = null;
  }

  /**
   * 使用独立 video m-line 发送屏幕辅流，不依赖 BFCP，也不替换摄像头轨道。
   *
   * 执行顺序：
   * 1. 校验会话状态并确定 MediaStream 所有权；
   * 2. 使用外部 mediaStream，或由 SDK 调用 getDisplayMedia；
   * 3. 优先 replaceTrack 复用已协商的 sender/MID；
   * 4. 无法复用时创建 sendonly transceiver，并通过 re-INVITE 协商；
   * 5. 取得 MID 后发送 screen-share/start INFO，接收端据此识别共享轨；
   * 6. 任一步失败都清空 sender、监听器和 SDK 自有流，不影响已经建立的主通话。
   *
   * 外部传入的 MediaStream 默认由调用方管理，便于多条 RTCSession 复用同一屏幕源；
   * SDK 自己采集的 MediaStream 默认在 unShare/session close 时停止。
   *
   * @param {string} type 分享类型，当前仅支持 screen
   * @param {Object} options AuxiliaryShareOptions
   * @returns {Promise<MediaStream>} 实际发送的屏幕流
   * @throws {InvalidStateError|NotSupportedError|Error} 状态、能力、采集或协商失败
   */
  async _shareAuxiliaryScreen(type, options = {})
  {
    if (type !== 'screen')
    {
      throw new Exceptions.NotSupportedError('Auxiliary share currently supports screen only.');
    }

    if (
      this._status !== C.STATUS_CONFIRMED &&
      this._status !== C.STATUS_WAITING_FOR_ACK
    )
    {
      throw new Exceptions.InvalidStateError(this._status);
    }

    if (this._auxiliaryShareStarting)
    {
      throw new Error('Auxiliary screen sharing is already starting.');
    }

    if (this._auxiliaryShareActive)
    {
      throw new Error('Auxiliary screen sharing is already active.');
    }

    if (this._shareMode && !this._auxiliaryShareStopPromise)
    {
      throw new Error(`A ${this._shareMode} media share is already active.`);
    }

    // 上一次 stop 尚未结束时先等待，避免旧 stop 的 finally 覆盖本次启动状态。
    if (this._auxiliaryShareStopPromise)
    {
      await this._auxiliaryShareStopPromise;
    }

    if (this._shareMode)
    {
      throw new Error(`A ${this._shareMode} media share is already active.`);
    }

    this._shareMode = 'auxiliary';
    this._auxiliaryShareStarting = true;
    this._auxiliaryShareCancelRequested = false;

    const providedStream = options.mediaStream || null;
    // 未显式配置时采用“谁采集谁释放”：外部流不归 SDK 所有，SDK 采集流归 SDK 所有。
    const ownsStream = options.stopStreamOnUnShare !== undefined ?
      Boolean(options.stopStreamOnUnShare) : !providedStream;
    let stream = providedStream;
    let createdTransceiver = false;

    try
    {
      // Demo 可传入一次 getDisplayMedia 得到的流供多条会话复用；普通接入方也可让
      // 单条 RTCSession 直接完成屏幕采集。
      if (!stream)
      {
        if (!(navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices))
        {
          const error = new Exceptions.NotSupportedError('getDisplayMedia is not supported.');

          logger.warn(`${this._id} getDisplayMedia is not supported`);
          this.emit('getdisplaymediafailed', error);
          throw error;
        }

        const constraints = options.displayMediaConstraints || {
          video : { width: { max: 1920 }, height: { max: 1080 }, frameRate: 15 },
          audio : false
        };

        try
        {
          stream = await navigator.mediaDevices.getDisplayMedia(constraints);
        }
        catch (error)
        {
          this._logEventError('warn', 'getdisplaymediafailed', error);
          this.emit('getdisplaymediafailed', error);
          throw error;
        }
      }

      const screenTrack = stream && stream.getVideoTracks && stream.getVideoTracks()[0];

      if (!screenTrack || screenTrack.readyState === 'ended')
      {
        throw new Error('Auxiliary screen share requires a live video track.');
      }

      // detail 更适合桌面文字和 UI；浏览器不支持或拒绝设置时不影响共享主流程。
      if ('contentHint' in screenTrack)
      {
        const contentHint = options.contentHint !== undefined ? options.contentHint : 'detail';

        try { screenTrack.contentHint = contentHint; }
        catch (error) {}
      }

      this._localShareStream = stream;
      this._localShareStreamLocallyGenerated = ownsStream;
      this._auxiliaryShareOwnsStream = ownsStream;
      this._bindAuxiliaryShareStreamEvents(stream);
      this._markStatsTransition('share-start');

      // 历史 screen 分享会把 _localShareRTPSender 置空；如果之前已经协商过辅流，
      // 可从保留的 transceiver 恢复 sender，继续复用原 MID 而不是增加新 m-line。
      if (!this._localShareRTPSender && this._auxiliaryShareTransceiver)
      {
        this._localShareRTPSender = this._auxiliaryShareTransceiver.sender;
      }

      // 已经协商过辅流 m-line 时，复用原 sender 不需要再次 re-INVITE，停止后重开更快。
      if (this._localShareRTPSender && this._auxiliaryShareMid)
      {
        try
        {
          await this._localShareRTPSender.replaceTrack(screenTrack);
        }
        catch (error)
        {
          // 某些浏览器在编码能力变化后可能拒绝 replaceTrack。此时废弃旧传输引用，
          // 继续走下方“新建 transceiver + 重新协商”的兼容分支。
          logger.warn(`${this._id} reuse auxiliary share sender failed`, error);
          try { await this._localShareRTPSender.replaceTrack(null); }
          catch (replaceError) {}
          try { this._auxiliaryShareTransceiver.direction = 'inactive'; }
          catch (directionError) {}
          this._localShareRTPSender = null;
          this._auxiliaryShareTransceiver = null;
          this._auxiliaryShareMid = null;
        }

        if (this._localShareRTPSender)
        {
          if (this._auxiliaryShareCancelRequested)
          {
            throw new Error('Auxiliary screen sharing was cancelled.');
          }

          this._auxiliaryShareActive = true;
          this._sendAuxiliaryShareInfo('start');

          return stream;
        }
      }

      if (!this._connection || typeof this._connection.addTransceiver !== 'function')
      {
        throw new Exceptions.NotSupportedError('RTCPeerConnection.addTransceiver is not supported.');
      }

      // 独立 sendonly m-line 保证摄像头 sender 不被屏幕轨替换；streams 参数让远端
      // track 事件保留正确的 MediaStream 关联信息。
      const transceiver = this._connection.addTransceiver(screenTrack, {
        direction : 'sendonly',
        streams   : [ stream ]
      });

      createdTransceiver = true;
      this._auxiliaryShareTransceiver = transceiver;
      this._localShareRTPSender = transceiver.sender;

      // addTransceiver 只改变本地 PeerConnection，必须通过 re-INVITE 让远端协商该 m-line。
      await this._renegotiateAuxiliaryShare();

      if (this._auxiliaryShareCancelRequested)
      {
        throw new Error('Auxiliary screen sharing was cancelled.');
      }

      // MID 在 setRemoteDescription 完成后才稳定可用，不能直接读取 addTransceiver 返回值。
      this._auxiliaryShareMid = await this._waitForAuxiliaryShareMid();
      this._auxiliaryShareActive = true;
      this._sendAuxiliaryShareInfo('start');

      return stream;
    }
    catch (error)
    {
      // 辅流属于可选能力，失败时只回滚共享资源，不能终止已经建立的音视频通话。
      const sender = this._localShareRTPSender;

      if (sender)
      {
        try { await sender.replaceTrack(null); }
        catch (replaceError) {}
      }

      if (createdTransceiver)
      {
        try { this._auxiliaryShareTransceiver.direction = 'inactive'; }
        catch (directionError) {}
        this._localShareRTPSender = null;
        this._auxiliaryShareTransceiver = null;
        this._auxiliaryShareMid = null;
      }

      this._clearAuxiliaryShareStreamEvents();
      this._auxiliaryShareActive = false;
      this._auxiliaryShareOwnsStream = false;
      this._localShareStream = null;
      this._localShareStreamLocallyGenerated = false;
      if (this._shareMode === 'auxiliary') this._shareMode = null;

      if (stream && ownsStream)
      {
        Utils.closeMediaStream(stream);
      }

      throw error;
    }
    finally
    {
      this._auxiliaryShareStarting = false;
    }
  }

  /**
   * 为新建的辅流 transceiver 发起一次完整 re-INVITE。
   *
   * renegotiate() 在 SIP/SDP 正忙时会返回 false，所以这里最多等待 10 秒重试；
   * 真正发出 re-INVITE 后再等待最多 15 秒响应。`terminateOnFailure:false` 非常重要：
   * 屏幕共享协商失败只能让 share() reject，不能把原有通话一起挂断。
   *
   * @returns {Promise<void>} 协商成功时完成，超时、取消或失败时拒绝
   */
  _renegotiateAuxiliaryShare()
  {
    return new Promise((resolve, reject) =>
    {
      const readyDeadline = Date.now() + 10000;
      let completed = false;
      let responseTimer = null;

      // SIP 回调、取消检查和超时可能竞争，只允许第一个结果结束 Promise。
      const finish = (error) =>
      {
        if (completed) return;

        completed = true;
        if (responseTimer) clearTimeout(responseTimer);
        if (error) reject(error);
        else resolve();
      };

      const attempt = () =>
      {
        if (this.isEnded() || this._auxiliaryShareCancelRequested)
        {
          finish(new Error(this.isEnded() ? 'Session ended.' : 'Auxiliary screen sharing was cancelled.'));

          return;
        }

        let started;

        try
        {
          started = this.renegotiate({ useUpdate: false, terminateOnFailure: false }, finish);
        }
        catch (error)
        {
          finish(error);

          return;
        }

        if (started)
        {
          // renegotiate 回调可能在测试或异常实现中同步执行，因此只在尚未完成时挂超时器。
          if (!completed)
          {
            responseTimer = setTimeout(() =>
            {
              finish(new Error('Auxiliary screen share renegotiation timed out.'));
            }, 15000);
          }

          return;
        }

        if (Date.now() >= readyDeadline)
        {
          finish(new Error('Timed out waiting to start auxiliary screen share renegotiation.'));

          return;
        }

        // 当前可能正处于 hold/re-INVITE 等协商阶段，短暂等待后再次检查可协商状态。
        setTimeout(attempt, 100);
      };

      attempt();
    });
  }

  /**
   * 等待浏览器为辅流 transceiver 分配稳定 MID。
   *
   * MID 是发送给远端的共享轨标识。re-INVITE 成功回调与 transceiver.mid 更新之间
   * 可能存在很短的时序差，因此采用有限轮询，而不是发送空 MID 或无限等待。
   *
   * @param {number} timeout 最大等待毫秒数
   * @returns {Promise<string>} 字符串形式的 MID
   */
  _waitForAuxiliaryShareMid(timeout = 3000)
  {
    return new Promise((resolve, reject) =>
    {
      const startedAt = Date.now();
      const check = () =>
      {
        const mid = this._auxiliaryShareTransceiver && this._auxiliaryShareTransceiver.mid;

        if (mid !== null && mid !== undefined)
        {
          resolve(String(mid));
        }
        else if (this._auxiliaryShareCancelRequested)
        {
          reject(new Error('Auxiliary screen sharing was cancelled.'));
        }
        else if (Date.now() - startedAt >= timeout)
        {
          reject(new Error('Auxiliary screen share negotiated without a MID.'));
        }
        else
        {
          setTimeout(check, 50);
        }
      };

      check();
    });
  }

  /**
   * 通过会话内 SIP INFO 通知远端共享状态和对应 MID。
   *
   * SDP 只说明新增了一条视频 m-line，不能表达它是摄像头还是屏幕。远端 SDK 收到
   * 本协议后把 MID 与 track 事件匹配，再统一触发 remoteShared/remoteUnShared。
   * INFO 仅为 SDK 内部协议，Demo 和接入方不需要解析。
   *
   * @param {'start'|'stop'} action 共享开始或停止
   * @returns {void}
   */
  _sendAuxiliaryShareInfo(action)
  {
    if (!this._auxiliaryShareMid) return;

    this.sendInfo('application/json', JSON.stringify({
      event : 'screen-share',
      action,
      mid   : this._auxiliaryShareMid
    }));
  }

  /**
   * 监听系统共享选择器或浏览器导致的屏幕轨结束。
   *
   * Chrome/Edge 通常触发 track ended，部分 Safari/WebView 只触发 stream inactive，
   * 还有环境两者都不稳定，所以同时监听两个事件并以 200ms 轮询 readyState 兜底。
   * handled 保证多个信号同时出现时只执行一次停止流程。
   *
   * @param {MediaStream} stream 当前辅流屏幕流
   * @returns {void}
   */
  _bindAuxiliaryShareStreamEvents(stream)
  {
    this._clearAuxiliaryShareStreamEvents();

    const track = stream && stream.getVideoTracks && stream.getVideoTracks()[0];

    if (!track) return;

    let handled = false;
    const handleEnded = () =>
    {
      if (handled) return;

      handled = true;
      // 外部复用流通常已经 ended，无需也不应由某一条 RTCSession 额外 stop；
      // SDK 自有流则按所有权规则完成释放。
      this._stopAuxiliaryShare({
        fromTrackEnded : true,
        stopStream     : this._auxiliaryShareOwnsStream
      }).catch((error) =>
      {
        this._logOperationError('warn', 'stop auxiliary share after track ended failed', error);
      });
    };

    this._auxiliaryShareBoundTrack = track;
    this._auxiliaryShareTrackEndedHandler = handleEnded;
    this._auxiliaryShareStreamInactiveHandler = handleEnded;

    track.addEventListener && track.addEventListener('ended', handleEnded);
    stream.addEventListener && stream.addEventListener('inactive', handleEnded);

    this._auxiliaryShareEndTimer = setInterval(() =>
    {
      if (track.readyState === 'ended') handleEnded();
    }, 200);
  }

  /**
   * 移除当前辅流的事件监听和轮询定时器。
   *
   * 每次绑定新流、停止共享和关闭会话都会调用，防止旧流结束后误停止下一次共享，
   * 也避免定时器或监听器长期持有 RTCSession 引用。
   *
   * @returns {void}
   */
  _clearAuxiliaryShareStreamEvents()
  {
    if (this._auxiliaryShareEndTimer)
    {
      clearInterval(this._auxiliaryShareEndTimer);
      this._auxiliaryShareEndTimer = null;
    }

    if (this._auxiliaryShareBoundTrack && this._auxiliaryShareTrackEndedHandler &&
      this._auxiliaryShareBoundTrack.removeEventListener)
    {
      this._auxiliaryShareBoundTrack.removeEventListener('ended', this._auxiliaryShareTrackEndedHandler);
    }

    if (this._localShareStream && this._auxiliaryShareStreamInactiveHandler &&
      this._localShareStream.removeEventListener)
    {
      this._localShareStream.removeEventListener('inactive', this._auxiliaryShareStreamInactiveHandler);
    }

    this._auxiliaryShareBoundTrack = null;
    this._auxiliaryShareTrackEndedHandler = null;
    this._auxiliaryShareStreamInactiveHandler = null;
  }

  /**
   * 停止非 BFCP 辅流并按所有权释放资源。
   *
   * 停止顺序是：先发送 stop INFO，让远端尽快清 UI；再 replaceTrack(null) 停止发送；
   * 随后解除监听并按所有权决定是否 stop MediaStream。默认保留 transceiver/MID，便于
   * 下一次共享直接复用；只有内部明确传 resetTransport 时才彻底丢弃传输引用。
   *
   * @param {Object} options SDK 内部停止参数
   * @param {boolean} [options.sendInfo=true] 是否通知远端
   * @param {boolean} [options.stopStream] 是否覆盖默认 MediaStream 所有权规则
   * @param {boolean} [options.resetTransport=false] 是否同时废弃 transceiver/MID
   * @returns {Promise<void>} sender 与资源清理完成后结束
   */
  _stopAuxiliaryShare(options = {})
  {
    // track ended、stream inactive、轮询和页面 unShare 可能同时进入，复用同一个 Promise。
    if (this._auxiliaryShareStopPromise) return this._auxiliaryShareStopPromise;

    const stream = this._localShareStream;
    const sender = this._localShareRTPSender;
    const wasActive = this._auxiliaryShareActive;
    const wasStarting = this._auxiliaryShareStarting;
    const stopStream = options.stopStream !== undefined ?
      Boolean(options.stopStream) : this._auxiliaryShareOwnsStream;

    // 先同步更新状态，使正在进行的采集/协商流程在下一检查点立即取消。
    this._auxiliaryShareCancelRequested = true;
    this._auxiliaryShareActive = false;

    this._auxiliaryShareStopPromise = (async() =>
    {
      if (wasActive && options.sendInfo !== false)
      {
        try { this._sendAuxiliaryShareInfo('stop'); }
        catch (error)
        {
          this._logOperationError('warn', 'send auxiliary share stop INFO failed', error);
        }
      }

      if (sender)
      {
        // 不 removeTrack/removeTransceiver，保留已协商的 m-line 供下一次共享复用。
        try { await sender.replaceTrack(null); }
        catch (error)
        {
          this._logOperationError('warn', 'stop auxiliary share sender failed', error);
        }
      }

      this._clearAuxiliaryShareStreamEvents();

      // 多条会话可能共享同一外部 MediaStream，只有拥有所有权的会话才可停止轨道。
      if (stream && stopStream)
      {
        Utils.closeMediaStream(stream);
      }

      if (this._localShareStream === stream)
      {
        this._localShareStream = null;
      }

      this._localShareStreamLocallyGenerated = false;
      this._auxiliaryShareOwnsStream = false;

      // getDisplayMedia 无法可靠取消。启动阶段收到 unShare() 时继续保留 starting/mode，
      // 等待 _shareAuxiliaryScreen() 取得结果后按 cancel 标志完成回滚，期间拒绝新共享。
      if (!wasStarting)
      {
        this._auxiliaryShareStarting = false;
        if (this._shareMode === 'auxiliary') this._shareMode = null;
      }

      if (options.resetTransport)
      {
        try { this._auxiliaryShareTransceiver.direction = 'inactive'; }
        catch (error) {}
        this._localShareRTPSender = null;
        this._auxiliaryShareTransceiver = null;
        this._auxiliaryShareMid = null;
      }

      if (wasActive)
      {
        this._markStatsTransition('share-stop');
      }
    })()
      .finally(() =>
      {
        this._auxiliaryShareStopPromise = null;
      });

    return this._auxiliaryShareStopPromise;
  }

  /**
   * Terminate the call.
   */
  terminate(options = {}) 
  {
    logger.debug(`${this._id} terminate()`);

    const cause = options.cause || CRTC_C.causes.BYE;
    const extraHeaders = Utils.cloneArray(options.extraHeaders);
    const body = options.body;

    let cancel_reason;
    let status_code = options.status_code;
    let reason_phrase = options.reason_phrase;

    // Check Session Status.
    if (this._status === C.STATUS_TERMINATED) 
    {
      throw new Exceptions.InvalidStateError(this._status);
    }

    switch (this._status) 
    {
      // - UAC -
      case C.STATUS_NULL:
      case C.STATUS_INVITE_SENT:
      case C.STATUS_1XX_RECEIVED:
        logger.debug(`${this._id} canceling session`);

        if (status_code && (status_code < 200 || status_code >= 700)) 
        {
          throw new TypeError(`Invalid status_code: ${status_code}`);
        }
        else if (status_code) 
        {
          reason_phrase = reason_phrase || CRTC_C.REASON_PHRASE[status_code] || '';
          cancel_reason = `SIP ;cause=${status_code} ;text="${reason_phrase}"`;
        }

        // Check Session Status.
        if (this._status === C.STATUS_NULL || this._status === C.STATUS_INVITE_SENT) 
        {
          this._is_canceled = true;
          this._cancel_reason = cancel_reason;
        }
        else if (this._status === C.STATUS_1XX_RECEIVED) 
        {
          this._request.cancel(cancel_reason);
        }

        this._status = C.STATUS_CANCELED;

        this._failed('local', null, CRTC_C.causes.CANCELED);
        break;

      // - UAS -
      case C.STATUS_WAITING_FOR_ANSWER:
      case C.STATUS_ANSWERED:
        logger.debug(`${this._id} rejecting session`);

        status_code = status_code || 480;

        if (status_code < 300 || status_code >= 700) 
        {
          throw new TypeError(`Invalid status_code: ${status_code}`);
        }

        this._request.reply(status_code, reason_phrase, extraHeaders, body);
        this._failed('local', null, CRTC_C.causes.REJECTED);
        break;

      case C.STATUS_WAITING_FOR_ACK:
      case C.STATUS_CONFIRMED:
        logger.debug(`${this._id} terminating session`);

        reason_phrase = options.reason_phrase || CRTC_C.REASON_PHRASE[status_code] || '';

        if (status_code && (status_code < 200 || status_code >= 700)) 
        {
          throw new TypeError(`Invalid status_code: ${status_code}`);
        }
        else if (status_code) 
        {
          extraHeaders.push(`Reason: SIP ;cause=${status_code}; text="${reason_phrase}"`);
        }

        /* RFC 3261 section 15 (Terminating a session):
          *
          * "...the callee's UA MUST NOT send a BYE on a confirmed dialog
          * until it has received an ACK for its 2xx response or until the server
          * transaction times out."
          */
        if (this._status === C.STATUS_WAITING_FOR_ACK &&
          this._direction === 'incoming' &&
          this._request.server_transaction.state !== Transactions.C.STATUS_TERMINATED) 
        {

          // Save the dialog for later restoration.
          const dialog = this._dialog;

          // Send the BYE as soon as the ACK is received...
          this.receiveRequest = ({ method }) => 
          {
            if (method === CRTC_C.ACK) 
            {
              this.sendRequest(CRTC_C.BYE, {
                extraHeaders,
                body
              });
              dialog.terminate();
            }
          };

          // .., or when the INVITE transaction times out
          this._request.server_transaction.on('stateChanged', () => 
          {
            if (this._request.server_transaction.state ===
              Transactions.C.STATUS_TERMINATED) 
            {
              this.sendRequest(CRTC_C.BYE, {
                extraHeaders,
                body
              });
              dialog.terminate();
            }
          });

          this._ended('local', null, cause);

          // Restore the dialog into 'this' in order to be able to send the in-dialog BYE :-).
          this._dialog = dialog;

          // Restore the dialog into 'ua' so the ACK can reach 'this' session.
          this._ua.newDialog(dialog);
        }
        else 
        {
          this.sendRequest(CRTC_C.BYE, {
            extraHeaders,
            body
          });

          this._ended('local', null, cause);
        }
    }
  }

  sendDTMF(tones, options = {}) 
  {
    logger.debug(`${this._id} sendDTMF() | tones: %s`, tones);

    let position = 0;
    let duration = options.duration || null;
    let interToneGap = options.interToneGap || null;
    const transportType = options.transportType || CRTC_C.DTMF_TRANSPORT.INFO;

    if (tones === undefined) 
    {
      throw new TypeError('Not enough arguments');
    }

    // Check Session Status.
    if (
      this._status !== C.STATUS_CONFIRMED &&
      this._status !== C.STATUS_WAITING_FOR_ACK &&
      this._status !== C.STATUS_1XX_RECEIVED
    ) 
    {
      throw new Exceptions.InvalidStateError(this._status);
    }

    // Check Transport type.
    if (
      transportType !== CRTC_C.DTMF_TRANSPORT.INFO &&
      transportType !== CRTC_C.DTMF_TRANSPORT.RFC2833
    ) 
    {
      throw new TypeError(`invalid transportType: ${transportType}`);
    }

    // Convert to string.
    if (typeof tones === 'number') 
    {
      tones = tones.toString();
    }

    // Check tones.
    if (!tones || typeof tones !== 'string' || !tones.match(/^[0-9A-DR#*,]+$/i)) 
    {
      throw new TypeError(`Invalid tones: ${tones}`);
    }

    // Check duration.
    if (duration && !Utils.isDecimal(duration)) 
    {
      throw new TypeError(`Invalid tone duration: ${duration}`);
    }
    else if (!duration) 
    {
      duration = RTCSession_DTMF.C.DEFAULT_DURATION;
    }
    else if (duration < RTCSession_DTMF.C.MIN_DURATION) 
    {
      logger.debug(`${this._id} "duration" value is lower than the minimum allowed, setting it to ${RTCSession_DTMF.C.MIN_DURATION} milliseconds`);
      duration = RTCSession_DTMF.C.MIN_DURATION;
    }
    else if (duration > RTCSession_DTMF.C.MAX_DURATION) 
    {
      logger.debug(`${this._id} "duration" value is greater than the maximum allowed, setting it to ${RTCSession_DTMF.C.MAX_DURATION} milliseconds`);
      duration = RTCSession_DTMF.C.MAX_DURATION;
    }
    else 
    {
      duration = Math.abs(duration);
    }
    options.duration = duration;

    // Check interToneGap.
    if (interToneGap && !Utils.isDecimal(interToneGap)) 
    {
      throw new TypeError(`Invalid interToneGap: ${interToneGap}`);
    }
    else if (!interToneGap) 
    {
      interToneGap = RTCSession_DTMF.C.DEFAULT_INTER_TONE_GAP;
    }
    else if (interToneGap < RTCSession_DTMF.C.MIN_INTER_TONE_GAP) 
    {
      logger.debug(`${this._id} "interToneGap" value is lower than the minimum allowed, setting it to ${RTCSession_DTMF.C.MIN_INTER_TONE_GAP} milliseconds`);
      interToneGap = RTCSession_DTMF.C.MIN_INTER_TONE_GAP;
    }
    else 
    {
      interToneGap = Math.abs(interToneGap);
    }

    // RFC2833. Let RTCDTMFSender enqueue the DTMFs.
    if (transportType === CRTC_C.DTMF_TRANSPORT.RFC2833) 
    {
      // Send DTMF in current audio RTP stream.
      const sender = this._getDTMFRTPSender();

      if (sender) 
      {
        // Add remaining buffered tones.
        tones = sender.toneBuffer + tones;
        // Insert tones.
        sender.insertDTMF(tones, duration, interToneGap);
      }

      return;
    }

    if (this._tones) 
    {
      // Tones are already queued, just add to the queue.
      this._tones += tones;

      return;
    }

    this._tones = tones;

    // Send the first tone.
    _sendDTMF.call(this);

    function _sendDTMF() 
    {
      let timeout;

      if (this._status === C.STATUS_TERMINATED ||
        !this._tones || position >= this._tones.length) 
      {
        // Stop sending DTMF.
        this._tones = null;

        return;
      }

      const tone = this._tones[position];

      position += 1;

      if (tone === ',') 
      {
        timeout = 2000;
      }
      else 
      {
        // Send DTMF via SIP INFO messages.
        const dtmf = new RTCSession_DTMF(this);

        options.eventHandlers = {
          onFailed : () => { this._tones = null; }
        };
        dtmf.send(tone, options);
        timeout = duration + interToneGap;
      }

      // Set timeout for the next tone.
      setTimeout(_sendDTMF.bind(this), timeout);
    }
  }

  sendInfo(contentType, body, options = {}) 
  {
    logger.debug(`${this._id} sendInfo()`);

    // Check Session Status.
    if (
      this._status !== C.STATUS_CONFIRMED &&
      this._status !== C.STATUS_WAITING_FOR_ACK &&
      this._status !== C.STATUS_1XX_RECEIVED
    ) 
    {
      throw new Exceptions.InvalidStateError(this._status);
    }

    const info = new RTCSession_Info(this);

    info.send(contentType, body, options);
  }

  /**
   * Mute
   */
  mute(options = { audio: true, video: false, video_only: false }) 
  {
    logger.debug(`${this._id} mute()`);

    let audioMuted = false, videoMuted = false;

    if (options.audio) 
    {
      audioMuted = true;
      this._audioMuted = true;
      this._toggleMuteAudio(true);
    }

    if (options.video) 
    {
      // 如果是单视频通话关闭视频
      options.video_only ? (this._videoOnlyMute = true) : (this._videoOnlyMute = false);
      videoMuted = true;
      this._videoMuted = true;
      this._toggleMuteVideo(true);
    }

    if (audioMuted === true || videoMuted === true) 
    {
      this._onmute({
        audio : audioMuted,
        video : videoMuted
      });
    }
  }

  /**
   * Unmute
   */
  unmute(options = { audio: true, video: true }) 
  {
    logger.debug(`${this._id} unmute()`);

    let audioUnMuted = false, videoUnMuted = false;

    if (options.audio) 
    {
      audioUnMuted = true;
      this._audioMuted = false;

      if (this._localHold === false) 
      {
        this._toggleMuteAudio(false);
      }
    }

    if (options.video) 
    {
      videoUnMuted = true;
      this._videoMuted = false;

      if (this._localHold === false) 
      {
        this._toggleMuteVideo(false);
      }
    }

    if (audioUnMuted === true || videoUnMuted === true) 
    {
      this._onunmute({
        audio : audioUnMuted,
        video : videoUnMuted
      });
    }
  }

  /**
   * 设置视频内容类型
   *
   * hint:
   *  - motion  -> 动态视频优先（保帧率）
   *  - detail  -> 细节优先（保分辨率）
   *  - text    -> 文本共享优化
   *  - ''      -> 恢复默认策略
   *
   * shared:
   *  - true  屏幕共享
   *  - false 摄像头
   */
  async setVideoContentHint(hint = '', shared = false)
  {
    logger.debug(`${this._id} setVideoContentHint()`, hint, shared);

    const validHints = [ 'detail', 'text', 'motion', '' ];

    if (!validHints.includes(hint))
    {
      logger.warn(`invalid contentHint: ${hint}`);

      return false;
    }

    if (
      this._status !== C.STATUS_WAITING_FOR_ACK &&
    this._status !== C.STATUS_CONFIRMED
    )
    {
      logger.warn('invalid session status');

      return false;
    }

    if (!this._isReadyToReOffer())
    {
      logger.warn('peerconnection not ready');

      return false;
    }

    const stream = shared
      ? this._localShareStream
      : this._localMediaStream;

    if (!stream)
    {
      logger.warn('stream not found');

      return false;
    }

    const tracks = stream.getVideoTracks();

    if (!tracks.length)
    {
      logger.warn('video track not found');

      return false;
    }

    for (const track of tracks)
    {
    // 设置 contentHint
      if ('contentHint' in track)
      {

        track.contentHint = hint;

        logger.debug(`track.contentHint = ${hint}`);
      }
      
      this.connection.getSenders().forEach((sender) => 
      {
        // shared=true 时只更新当前屏幕轨；shared=false 时排除辅流 sender，避免给
        // 屏幕共享错误套用摄像头的 degradationPreference 和编码参数。
        const isTargetSender = shared ? sender.track === track :
          sender !== this._localShareRTPSender;

        if (isTargetSender && sender.track && sender.track.kind === 'video')
        {
          const parameters = sender.getParameters();
          const degradationPreference = (hint !== 'motion') ? 'balanced' : 'maintain-resolution';

          // 强制保持分辨率，可以不降分辨率只降帧
          parameters.degradationPreference = degradationPreference;
          sender.setParameters(parameters).then(() => 
          {
            logger.debug(`setParameters success ${degradationPreference}`);
          })
            .catch((err) => 
            {
              logger.error(`setParameters error: ${ err.message}`);
            });
        }
      });

      // 找到对应 sender
      const sender = this.connection
        .getSenders()
        .find((s) => s.track === track);

      if (!sender)
      {
        logger.warn('RTCRtpSender not found');

        continue;
      }

      // 设置 degradationPreference
      await this._setSenderDegradationPreference(sender, hint, shared);
    }

    return true;
  }

  /**
   * 设置编码降级策略
   *
   * motion:
   *   maintain-framerate
   *
   * detail/text:
   *   maintain-resolution
   *
   * fallback:
   *   balanced
   */
  async _setSenderDegradationPreference(sender, hint)
  {
    // 浏览器兼容检测
    if (!this._isDegradationPreferenceSupported())
    {
      logger.debug('degradationPreference unsupported');

      return;
    }

    let degradationPreference = 'balanced';

    switch (hint)
    {
      case 'motion':
      // 保帧率
        degradationPreference = 'maintain-framerate';
        break;

      case 'detail':
      case 'text':
      // 保清晰度
        degradationPreference = 'maintain-resolution';
        break;

      case '':
      default:
        degradationPreference = 'balanced';
        break;
    }

    try
    {
      const parameters = sender.getParameters();

      if (!parameters)
      {
        logger.warn('sender.getParameters() empty');

        return;
      }

      // 避免重复 setParameters
      if (
        parameters.degradationPreference === degradationPreference
      )
      {
        logger.debug(
          `degradationPreference already ${degradationPreference}`
        );

        return;
      }

      parameters.degradationPreference = degradationPreference;

      await sender.setParameters(parameters);

      logger.debug(
        `set degradationPreference success: ${degradationPreference}`
      );
    }
    catch (err)
    {
      logger.error(
        `set degradationPreference failed: ${err.message}`
      );
    }
  }

  /**
 * 浏览器是否支持 degradationPreference
 */
  _isDegradationPreferenceSupported()
  {
    try
    {
      const ua = navigator.userAgent;

      // Safari
      const isSafari =
      /^((?!chrome|android).)*safari/i.test(ua);

      if (isSafari)
      {
        const safariMatch =
        ua.match(/Version\/(\d+)/);

        const version =
        safariMatch && safariMatch[1];

        if (version && Number(version) < 12)
        {
          return false;
        }
      }

      // Firefox
      const firefoxMatch =
      ua.match(/Firefox\/(\d+)/);

      if (firefoxMatch)
      {
        const firefoxVersion =
        Number(firefoxMatch[1]);

        if (firefoxVersion < 138)
        {
          return false;
        }
      }

      return true;
    }
    catch (err)
    {
      return false;
    }
  }


  /**
   * Hold
   */
  hold(options = {}, done) 
  {
    logger.debug(`${this._id} hold()`);

    if (this._status !== C.STATUS_WAITING_FOR_ACK && this._status !== C.STATUS_CONFIRMED) 
    {
      return false;
    }

    if (this._localHold === true) 
    {
      return false;
    }

    if (!this._isReadyToReOffer()) 
    {
      return false;
    }

    this._localHold = true;
    this._onhold('local');

    const eventHandlers = {
      succeeded : () => 
      {
        if (done) { done(); }
      },
      failed : () => 
      {
        this.terminate({
          cause         : CRTC_C.causes.WEBRTC_ERROR,
          status_code   : 500,
          reason_phrase : 'Hold Failed'
        });
      }
    };

    if (options.useUpdate) 
    {
      this._sendUpdate({
        sdpOffer     : true,
        eventHandlers,
        extraHeaders : options.extraHeaders
      });
    }
    else 
    {
      this._sendReinvite({
        eventHandlers,
        extraHeaders : options.extraHeaders
      });
    }

    return true;
  }

  unhold(options = {}, done) 
  {
    logger.debug(`${this._id} unhold()`);

    if (this._status !== C.STATUS_WAITING_FOR_ACK && this._status !== C.STATUS_CONFIRMED) 
    {
      return false;
    }

    if (this._localHold === false) 
    {
      return false;
    }

    if (!this._isReadyToReOffer()) 
    {
      return false;
    }

    this._localHold = false;
    this._onunhold('local');

    const eventHandlers = {
      succeeded : () => 
      {
        if (done) { done(); }
      },
      failed : () => 
      {
        this.terminate({
          cause         : CRTC_C.causes.WEBRTC_ERROR,
          status_code   : 500,
          reason_phrase : 'Unhold Failed'
        });
      }
    };

    if (options.useUpdate) 
    {
      this._sendUpdate({
        sdpOffer     : true,
        eventHandlers,
        extraHeaders : options.extraHeaders
      });
    }
    else 
    {
      this._sendReinvite({
        eventHandlers,
        extraHeaders : options.extraHeaders
      });
    }

    return true;
  }

  renegotiate(options = {}, done) 
  {
    logger.debug(`${this._id} renegotiate()`);

    let changeViaHost = {};
    const rtcOfferConstraints = options.rtcOfferConstraints || null;

    try 
    {
      options.changeViaHost && (changeViaHost = { changeViaHost: true });
    }
    catch (error) { }

    if (this._status !== C.STATUS_WAITING_FOR_ACK && this._status !== C.STATUS_CONFIRMED) 
    {
      return false;
    }

    if (!this._isReadyToReOffer()) 
    {
      return false;
    }

    this._markStatsTransition('renegotiate');

    const eventHandlers = {
      succeeded : () => 
      {
        if (done) { done(); }
      },
      failed : () => 
      {
        const cause = options.failed ? options.failed : CRTC_C.causes.WEBRTC_ERROR;

        if (options.terminateOnFailure === false)
        {
          if (done) { done(new Error(cause)); }

          return;
        }

        this.terminate({
          cause         : cause,
          status_code   : 500,
          reason_phrase : 'Media Renegotiation Failed'
        });
      }
    };

    this._setLocalMediaStatus();

    if (options.useUpdate) 
    {
      this._sendUpdate({
        sdpOffer     : true,
        eventHandlers,
        rtcOfferConstraints,
        extraHeaders : options.extraHeaders
      });
    }
    else 
    {
      this._sendReinvite({
        eventHandlers,
        rtcOfferConstraints,
        changeViaHost,
        extraHeaders : options.extraHeaders
      });
    }

    return true;
  }

  /**
   * Refer
   */
  refer(target, options) 
  {
    logger.debug(`${this._id} refer()`);

    const originalTarget = target;

    if (this._status !== C.STATUS_WAITING_FOR_ACK && this._status !== C.STATUS_CONFIRMED) 
    {
      return false;
    }

    // Check target validity.
    target = this._ua.normalizeTarget(target);
    if (!target) 
    {
      throw new TypeError(`Invalid target: ${originalTarget}`);
    }

    const referSubscriber = new RTCSession_ReferSubscriber(this);

    referSubscriber.sendRefer(target, options);

    // Store in the map.
    const id = referSubscriber.id;

    this._referSubscribers[id] = referSubscriber;

    // Listen for ending events so we can remove it from the map.
    referSubscriber.on('requestFailed', () => 
    {
      delete this._referSubscribers[id];
    });
    referSubscriber.on('accepted', () => 
    {
      delete this._referSubscribers[id];
    });
    referSubscriber.on('failed', () => 
    {
      delete this._referSubscribers[id];
    });

    return referSubscriber;
  }

  /**
   * Send a generic in-dialog Request
   */
  sendRequest(method, options) 
  {
    logger.debug(`${this._id} sendRequest()`);

    return this._dialog.sendRequest(method, options);
  }

  /**
   * In dialog Request Reception
   */
  receiveRequest(request) 
  {
    logger.debug(`${this._id} receiveRequest()`);

    if (request.method === CRTC_C.CANCEL) 
    {
      /* RFC3261 15 States that a UAS may have accepted an invitation while a CANCEL
      * was in progress and that the UAC MAY continue with the session established by
      * any 2xx response, or MAY terminate with BYE. CRTC does continue with the
      * established session. So the CANCEL is processed only if the session is not yet
      * established.
      */

      /*
      * Terminate the whole session in case the user didn't accept (or yet send the answer)
      * nor reject the request opening the session.
      */
      if (this._status === C.STATUS_WAITING_FOR_ANSWER ||
        this._status === C.STATUS_ANSWERED) 
      {
        this._status = C.STATUS_CANCELED;
        this._request.reply(487);
        this._failed('remote', request, CRTC_C.causes.CANCELED);
      }
    }
    else 
    {
      // Requests arriving here are in-dialog requests.
      switch (request.method) 
      {
        case CRTC_C.ACK:
          if (this._status !== C.STATUS_WAITING_FOR_ACK) 
          {
            return;
          }

          // Update signaling status.
          this._status = C.STATUS_CONFIRMED;

          clearTimeout(this._timers.ackTimer);
          clearTimeout(this._timers.invite2xxTimer);

          if (this._late_sdp) 
          {
            if (!request.body) 
            {
              this.terminate({
                cause       : CRTC_C.causes.MISSING_SDP,
                status_code : 400
              });
              break;
            }

            const newSdp = this._sdpAddMid(request.body);
            const e = { originator: 'remote', type: 'answer', sdp: newSdp };

            logger.debug(`${this._id} emit "sdp"`);
            this.emit('sdp', e);

            const answer = new RTCSessionDescription({ type: 'answer', sdp: e.sdp });

            this._connectionPromiseQueue = this._connectionPromiseQueue
              .then(() => this._connection.setRemoteDescription(answer))
              .then(() => 
              {
                if (!this._is_confirmed) 
                {
                  this._confirmed('remote', request);
                }
              })
              .catch((error) => 
              {
                this.terminate({
                  cause       : CRTC_C.causes.BAD_MEDIA_DESCRIPTION,
                  status_code : 488
                });

                emitSetRemoteDescriptionFailed(this, error);
              });
          }
          else
          if (!this._is_confirmed) 
          {
            this._confirmed('remote', request);
          }

          break;
        case CRTC_C.BYE:
          if (this._status === C.STATUS_CONFIRMED ||
            this._status === C.STATUS_WAITING_FOR_ACK) 
          {
            request.reply(200);
            this._ended('remote', request, CRTC_C.causes.BYE);
          }
          else if (this._status === C.STATUS_INVITE_RECEIVED ||
            this._status === C.STATUS_WAITING_FOR_ANSWER) 
          {
            request.reply(200);
            this._request.reply(487, 'BYE Received');
            this._ended('remote', request, CRTC_C.causes.BYE);
          }
          else 
          {
            request.reply(403, 'Wrong Status');
          }
          break;
        case CRTC_C.INVITE:
          if (this._status === C.STATUS_CONFIRMED) 
          {
            if (request.hasHeader('replaces')) 
            {
              this._receiveReplaces(request);
            }
            else 
            {
              this._receiveReinvite(request);
            }
          }
          else 
          {
            request.reply(403, 'Wrong Status');
          }
          break;
        case CRTC_C.INFO:
          if (this._status === C.STATUS_1XX_RECEIVED ||
            this._status === C.STATUS_WAITING_FOR_ANSWER ||
            this._status === C.STATUS_ANSWERED ||
            this._status === C.STATUS_WAITING_FOR_ACK ||
            this._status === C.STATUS_CONFIRMED) 
          {
            const contentType = request.hasHeader('Content-Type') ?
              request.getHeader('Content-Type').toLowerCase() : undefined;

            if (contentType && (contentType.match(/^application\/dtmf-relay/i))) 
            {
              new RTCSession_DTMF(this).init_incoming(request);
            }
            else if (contentType !== undefined) 
            {
              new RTCSession_Info(this).init_incoming(request);
            }
            else 
            {
              request.reply(415);
            }
          }
          else 
          {
            request.reply(403, 'Wrong Status');
          }
          break;
        case CRTC_C.UPDATE:
          // 以下修改为兼容 VoLTE 在通话建立前的彩铃及预先申请资源 UPDATE 携带 SDP 的情况
          // if (this._status === C.STATUS_CONFIRMED)
          // {
          this._receiveUpdate(request);
          // }
          // else
          // {
          //   request.reply(403, 'Wrong Status');
          // }
          break;
        case CRTC_C.REFER:
          if (this._status === C.STATUS_CONFIRMED) 
          {
            this._receiveRefer(request);
          }
          else 
          {
            request.reply(403, 'Wrong Status');
          }
          break;
        case CRTC_C.NOTIFY:
          // if (this._status === C.STATUS_CONFIRMED)
          // {
          //   this._receiveNotify(request);
          // }
          // for 3pcc
          if (this._status === C.STATUS_WAITING_FOR_ANSWER ||
            this._status === C.STATUS_ANSWERED ||
            this._status === C.STATUS_CONFIRMED) 
          {
            this._receiveNotify(request);
            this.newNotify({ request });
          }
          else 
          {
            request.reply(403, 'Wrong Status');
          }
          break;
        default:
          request.reply(501);
      }
    }
  }

  /**
   * Session Callbacks
   */

  onTransportError() 
  {
    logger.warn(`${this._id} onTransportError()`);

    if (this._status !== C.STATUS_TERMINATED) 
    {
      // this.terminate({
      //   status_code   : 500,
      //   reason_phrase : CRTC_C.causes.CONNECTION_ERROR,
      //   cause         : CRTC_C.causes.CONNECTION_ERROR
      // });
      // 连接错误不处理，延长重试时间
    }
  }

  onRequestTimeout() 
  {
    logger.warn(`${this._id} onRequestTimeout()`);

    if (this._status !== C.STATUS_TERMINATED) 
    {
      this.terminate({
        status_code   : 408,
        reason_phrase : CRTC_C.causes.REQUEST_TIMEOUT,
        cause         : CRTC_C.causes.REQUEST_TIMEOUT
      });
    }
  }

  onDialogError() 
  {
    logger.warn(`${this._id} onDialogError()`);

    if (this._status !== C.STATUS_TERMINATED) 
    {
      this.terminate({
        status_code   : 500,
        reason_phrase : CRTC_C.causes.DIALOG_ERROR,
        cause         : CRTC_C.causes.DIALOG_ERROR
      });
    }
  }

  // Called from DTMF handler.
  newDTMF(data) 
  {
    logger.debug(`${this._id} newDTMF()`);

    this.emit('newDTMF', data);
  }

  // Called from Info handler.
  newInfo(data) 
  {
    logger.debug(`${this._id} newInfo()`);

    // SDK 内部协议必须先更新共享状态，再把原始 newInfo 继续透传给接入方；
    // 这样既保留历史 newInfo 行为，又让 remoteShared 事件在同一消息周期内可用。
    this._handleAuxiliaryShareInfo(data);
    this.emit('newInfo', data);
  }

  /**
   * 解析远端辅流的 SDK 内部 INFO 协议。
   *
   * start 只记录目标 MID，并尝试和已缓存的 track 匹配；如果 track 尚未到达则等待
   * _handleAuxiliaryShareTrack()。stop 会清空当前匹配并触发 remoteUnShared。
   * 非 JSON、非远端消息或其他业务 INFO 均原样留给 newInfo 事件，不在这里报错。
   *
   * @param {Object} data RTCSession_Info 交付的数据
   * @returns {void}
   */
  _handleAuxiliaryShareInfo(data)
  {
    if (!data || data.originator !== 'remote' || !data.info) return;

    let body = data.info.body;

    if (typeof body === 'string')
    {
      try { body = JSON.parse(body); }
      catch (error) { return; }
    }

    if (!body || body.event !== 'screen-share') return;

    if (body.action === 'start' && body.mid !== null && body.mid !== undefined)
    {
      const mid = String(body.mid);

      // 远端可能因无法复用 sender 而改用新 MID。先结束旧共享，避免页面同时保留两路画面。
      if (this._remoteAuxiliaryShareMid !== mid && this._remoteAuxiliaryShareActiveTrack)
      {
        this._remoteAuxiliaryShareActiveTrack = null;
        this.emit('remoteUnShared');
      }

      this._remoteAuxiliaryShareMid = mid;
      this._emitRemoteAuxiliaryShared(mid);
    }
    else if (body.action === 'stop')
    {
      // 只在确实记录过共享时发停止事件，避免重复 stop INFO 导致 UI 重复关闭。
      const hadRemoteShare = this._remoteAuxiliaryShareMid !== null ||
        Boolean(this._remoteAuxiliaryShareActiveTrack);

      this._remoteAuxiliaryShareMid = null;
      this._remoteAuxiliaryShareActiveTrack = null;
      if (hadRemoteShare) this.emit('remoteUnShared');
    }
  }

  /**
   * 缓存 PeerConnection 新到达的远端视频轨，并按 transceiver.mid 与 INFO 匹配。
   *
   * 所有视频轨都会经过这里，但没有 screen-share/start INFO 指向其 MID 时不会触发
   * remoteShared，因此摄像头轨不会被误判为屏幕。track 先到或 INFO 先到都可处理。
   *
   * @param {RTCTrackEvent} event RTCPeerConnection 的 track 事件
   * @returns {void}
   */
  _handleAuxiliaryShareTrack(event)
  {
    const track = event && event.track;

    if (!track || track.kind !== 'video' || !this._connection) return;

    const transceiver = event.transceiver || this._connection.getTransceivers().find((item) =>
      item.receiver && item.receiver.track === track);
    const mid = transceiver && transceiver.mid;

    if (mid === null || mid === undefined) return;

    const normalizedMid = String(mid);

    // 即使当前还没有 INFO，也先缓存；后续 start INFO 可立即命中这条轨道。
    this._remoteAuxiliaryShareTracks.set(normalizedMid, track);

    if (!this._remoteAuxiliaryShareBoundTracks.has(track))
    {
      this._remoteAuxiliaryShareBoundTracks.add(track);

      // 某些浏览器 track 事件触发时轨道仍 muted，unmute 后再尝试发 remoteShared。
      const refresh = () =>
      {
        if (this._remoteAuxiliaryShareMid === normalizedMid)
        {
          this._emitRemoteAuxiliaryShared(normalizedMid);
        }
      };

      track.addEventListener && track.addEventListener('unmute', refresh);
      track.addEventListener && track.addEventListener('ended', () =>
      {
        // 远端异常停止或 PeerConnection 关闭时，ended 是 stop INFO 之外的兜底清理路径。
        this._remoteAuxiliaryShareTracks.delete(normalizedMid);
        this._remoteAuxiliaryShareBoundTracks.delete(track);

        if (this._remoteAuxiliaryShareMid === normalizedMid)
        {
          this._remoteAuxiliaryShareMid = null;
          this._remoteAuxiliaryShareActiveTrack = null;
          this.emit('remoteUnShared');
        }
      }, { once: true });
    }

    if (this._remoteAuxiliaryShareMid === normalizedMid)
    {
      this._emitRemoteAuxiliaryShared(normalizedMid);
    }
  }

  /**
   * 在 MID 和 live track 都具备时统一触发 remoteShared。
   *
   * 优先读取 track 缓存；若 track 事件未带 transceiver，则从 PeerConnection 再查一次。
   * 返回的 sharedStream 结构与 BFCP remoteShared 保持兼容，Demo 可以复用同一监听代码。
   * activeTrack 用于保证同一条轨道只通知一次。
   *
   * @param {string} mid 屏幕共享 m-line 的 MID
   * @returns {void}
   */
  _emitRemoteAuxiliaryShared(mid)
  {
    let track = this._remoteAuxiliaryShareTracks.get(String(mid));

    if (!track && this._connection)
    {
      const transceiver = this._connection.getTransceivers().find((item) =>
        String(item.mid) === String(mid));

      track = transceiver && transceiver.receiver && transceiver.receiver.track;
      if (track) this._remoteAuxiliaryShareTracks.set(String(mid), track);
    }

    if (!track || track.readyState !== 'live' || this._remoteAuxiliaryShareActiveTrack === track)
    {
      return;
    }

    // BFCP 的 sharedStream 同时暴露 videoStream/mediaStream；辅流保持相同字段，
    // 避免接入方为了不同共享模式维护两套 UI 代码。
    const videoStream = new MediaStream([ track ]);
    const mediaStream = new MediaStream([ track ]);

    this._remoteAuxiliaryShareActiveTrack = track;
    this.emit('remoteShared', {
      mid,
      track,
      sharedStream : { videoStream, mediaStream }
    });
  }

  // for 3pcc, Called from Notify handler.
  newNotify(data) 
  {
    logger.debug(`${this._id} newNotify()`);

    this.emit('newNotify', data);
  }

  /**
   * Check if RTCSession is ready for an outgoing re-INVITE or UPDATE with SDP.
   */
  _isReadyToReOffer() 
  {
    if (!this._rtcReady) 
    {
      logger.debug(`${this._id} _isReadyToReOffer() | internal WebRTC status not ready`);

      return false;
    }

    // No established yet.
    if (!this._dialog) 
    {
      logger.debug(`${this._id} _isReadyToReOffer() | session not established yet`);

      return false;
    }

    // Another INVITE transaction is in progress.
    if (this._dialog.uac_pending_reply === true ||
      this._dialog.uas_pending_reply === true) 
    {
      logger.debug(`${this._id} _isReadyToReOffer() | there is another INVITE/UPDATE transaction in progress`);

      return false;
    }

    return true;
  }

  _close() 
  {
    logger.debug(`${this._id} close()`);
    this._stopStatsMonitor();
    // Close local MediaStream if it was not given by the user.
    if (this._localMediaStream && this._localMediaStreamLocallyGenerated) 
    {
      logger.warn(`${this._id} close() | closing local MediaStream`);
      Utils.closeMediaStream(this._localMediaStream);
    }

    // 销毁BFCP相关媒体（委托给 BFCPChannel 统一清理）
    this._bfcp.close();

    // 会话关闭不需要再发 stop INFO（对端会随会话结束清理），这里只解除监听并按
    // MediaStream 所有权释放本地资源。外部复用流必须保留给其他 RTCSession 使用。
    if (this._auxiliaryShareActive || this._auxiliaryShareStarting || this._auxiliaryShareTransceiver)
    {
      this._clearAuxiliaryShareStreamEvents();
      if (this._localShareStream && this._auxiliaryShareOwnsStream)
      {
        logger.debug(`${this._id} close() | closing owned auxiliary share MediaStream`);
        Utils.closeMediaStream(this._localShareStream);
      }
      this._localShareStream = null;
      this._localShareRTPSender = null;
      this._localShareStreamLocallyGenerated = false;
      this._auxiliaryShareTransceiver = null;
      this._auxiliaryShareMid = null;
      this._auxiliaryShareActive = false;
      this._auxiliaryShareStarting = false;
      this._auxiliaryShareCancelRequested = true;
      this._auxiliaryShareOwnsStream = false;
    }

    this._shareMode = null;

    if (this._localShareStream && this._localShareStreamLocallyGenerated)
    {
      logger.debug(`${this._id} close() | closing local share MediaStream`);

      Utils.closeMediaStream(this._localShareStream);
    }

    // PeerConnection 即将关闭，清空远端匹配缓存，避免轨道对象继续被会话引用。
    this._remoteAuxiliaryShareMid = null;
    this._remoteAuxiliaryShareTracks.clear();
    this._remoteAuxiliaryShareBoundTracks.clear();
    this._remoteAuxiliaryShareActiveTrack = null;

    /**
     * 释放媒体管线资源。
     *
     * 清理顺序（与初始化逆序）：
     *   1. _mediaPipeline.stopSessionMediaEffectsComposer()
     *      └─ composer.stop() → 停止渲染循环、关闭 AudioContext、
     *         停止 captureStream tracks
     *   2. _mediaPipeline.stopSessionAiNoiseSuppression()
     *      └─ engine.destroy() → 关闭 WorkletNode、释放 WASM 资源、
     *         关闭 AudioContext
     *   3. 置空配置引用
     *
     * 这些 stop 方法各自安全关闭输入流，确保设备采集流不悬挂。
     */
    this._mediaPipeline.stopSessionMediaEffectsComposer();
    this._mediaPipeline.stopSessionAiNoiseSuppression();
    this._sessionMediaEffectsComposerOptions = null;
    this._sessionAiNSOptions = null;

    if (this._status === C.STATUS_TERMINATED) 
    {
      return;
    }

    this._status = C.STATUS_TERMINATED;

    // Terminate RTC.
    if (this._connection) 
    {
      try 
      {
        this._connection.close();
      }
      catch (error) 
      {
        this._logOperationError('warn', 'close() | error closing the RTCPeerConnection', error);
      }
    }

    // Terminate signaling.

    // Clear SIP timers.
    for (const timer in this._timers) 
    {
      if (Object.prototype.hasOwnProperty.call(this._timers, timer)) 
      {
        clearTimeout(this._timers[timer]);
      }
    }

    // Clear Session Timers.
    clearTimeout(this._sessionTimers.timer);

    // Terminate confirmed dialog.
    if (this._dialog) 
    {
      this._dialog.terminate();
      delete this._dialog;
    }

    // Terminate early dialogs.
    for (const dialog in this._earlyDialogs) 
    {
      if (Object.prototype.hasOwnProperty.call(this._earlyDialogs, dialog)) 
      {
        this._earlyDialogs[dialog].terminate();
        delete this._earlyDialogs[dialog];
      }
    }

    // Terminate REFER subscribers.
    for (const subscriber in this._referSubscribers) 
    {
      if (Object.prototype.hasOwnProperty.call(this._referSubscribers, subscriber)) 
      {
        delete this._referSubscribers[subscriber];
      }
    }

    this._ua.destroyRTCSession(this);
  }

  /**
   * Private API.
   */

  /**
   * RFC3261 13.3.1.4
   * Response retransmissions cannot be accomplished by transaction layer
   *  since it is destroyed when receiving the first 2xx answer
   */
  _setInvite2xxTimer(request, body) 
  {
    let timeout = Timers.T1;

    function invite2xxRetransmission() 
    {
      if (this._status !== C.STATUS_WAITING_FOR_ACK) 
      {
        return;
      }

      request.reply(200, null, [ `Contact: ${this._contact}` ], body);

      if (timeout < Timers.T2) 
      {
        timeout = timeout * 2;
        if (timeout > Timers.T2) 
        {
          timeout = Timers.T2;
        }
      }

      this._timers.invite2xxTimer = setTimeout(
        invite2xxRetransmission.bind(this), timeout);
    }

    this._timers.invite2xxTimer = setTimeout(
      invite2xxRetransmission.bind(this), timeout);
  }

  /**
   * RFC3261 14.2
   * If a UAS generates a 2xx response and never receives an ACK,
   *  it SHOULD generate a BYE to terminate the dialog.
   */
  _setACKTimer() 
  {
    this._timers.ackTimer = setTimeout(() => 
    {
      if (this._status === C.STATUS_WAITING_FOR_ACK) 
      {
        logger.debug(`${this._id} no ACK received, terminating the session`);

        clearTimeout(this._timers.invite2xxTimer);
        this.sendRequest(CRTC_C.BYE);
        this._ended('remote', null, CRTC_C.causes.NO_ACK);
      }
    }, Timers.TIMER_H);
  }

  _createRTCConnection(pcConfig, rtcConstraints) 
  {
    const self = this;

    self._canSend = false;

    // 是否成功连接过
    let successfullyConnected = false;

    this._connection = new RTCPeerConnection(pcConfig, rtcConstraints);
    this._startStatsMonitor(this._connection);
    // 在 SDK 层统一监听所有远端 track。是否为屏幕轨由后续 MID + INFO 匹配决定，
    // Demo 无需直接访问 RTCPeerConnection 或处理 track/INFO 到达顺序。
    this._connection.addEventListener('track', (event) =>
    {
      this._handleAuxiliaryShareTrack(event);
    });

    this._connection.onconnectionstatechange = () => 
    {
      switch (this._connection.connectionState) 
      {
        case 'connecting':
          // 如果是第一次连接，并且5秒后依然是connecting状态则重新协商
          if (!successfullyConnected) 
          {
            setTimeout(() => 
            {
              if (self._connection.connectionState === 'connecting') 
              {
                logger.warn(`${this._id} start iceConnectionState ${self._connection.connectionState}`);
                self.renegotiate({ rtcOfferConstraints: { iceRestart: true } });
              }
            }, 5000);
          }
          break;
        case 'connected':
          // 媒体接通后，如果信令重连媒体会重新协商
          window.addEventListener('setItemEvent', function(e) 
          {
            if (e.key === 'needReinvite' && e.newValue === 1 && !self._canSend) 
            {
              self._canSend = true;
              self.renegotiate({ failed: CRTC_C.causes.REINVITE_ERROR, rtcOfferConstraints: { iceRestart: true }, changeViaHost: true });

              setTimeout(() => 
              {
                self._canSend = false;
              }, 1000);
            }
          });
          break;
        default:
          break;
      }
    };

    this._connection.addEventListener('iceconnectionstatechange', () => 
    {
      const state = this._connection.iceConnectionState;

      this.emit('peerconnection:iceConnectionState', state);

      logger.warn(`${this._id} emit "peerconnection:iceConnectionState" ${state}`);

      // 成功连接过
      if (state === 'connected') 
      {
        logger.debug(`${this._id} ${state}`);
        successfullyConnected = true;
      }

      const reConnect = () => 
      {
        logger.warn(`${this._id} reConnect(). `);
        if (!successfullyConnected) 
        {
          self.terminate({
            cause         : CRTC_C.causes.RTP_TIMEOUT,
            status_code   : 408,
            reason_phrase : CRTC_C.causes.RTP_TIMEOUT
          });
        }
        else if (!this._canSend) 
        {
          logger.warn(`${this._id} iceConnectionState ${state}`);
          // RTCPeerConnection failed断开后启动重新协商
          if (this._bfcp.enabled) 
          {
            self.renegotiate();
          }
          else 
          {
            self.renegotiate({ failed: CRTC_C.causes.REINVITE_ERROR, rtcOfferConstraints: { iceRestart: true } });
          }
        }
      };

      // 如果没有成功连接过，挂断通话；成功连接过则重新协商
      // TODO: Do more with different states.
      if (state === 'failed' || state === 'disconnected') 
      {
        reConnect();
        setTimeout(() => 
        {
          if (state !== 'connected') 
          {
            reConnect();
          }
        }, 5000);
      }
    });

    logger.debug(`${this._id} emit "peerconnection"`);

    this.emit('peerconnection', {
      peerconnection : this._connection
    });
  }

  /**
   * PC 创建后立即启动会话级统计。
   *
   * 此时 sender、MID、RTP 报告可能尚未出现，RTCStatsMonitor 会先进入 warming-up，
   * 等字段和增量基线就绪后自动切换为 active，不要求业务判断 PC 是否“准备完毕”。
   */
  _startStatsMonitor(pc)
  {
    this._stopStatsMonitor();

    if (!pc)
    {
      return;
    }

    const monitor = new RTCStatsMonitor(pc, {
      autoStart       : false,
      contextProvider : () =>
      {
        // 统计模块优先使用本次新增的非 BFCP 辅流 MID；未启用辅流时再读取历史
        // BFCP sessionStorage 标记，从而保持两种共享模式的统计分类一致。
        let sharedMid = this._auxiliaryShareActive ? this._auxiliaryShareMid : null;

        // 隐私模式或受限 WebView 可能暴露 sessionStorage 但禁止读取，统计不能影响通话。
        try
        {
          if (sharedMid === null)
          {
            sharedMid = typeof sessionStorage !== 'undefined' ?
              sessionStorage.getItem(CRTC_C.BFCP_SHARED_STREAM_INDEX) :
              null;
          }
        }
        catch (error) {}

        return {
          sessionStatus : this._status,
          mode          : this._mode || null,
          localHold     : this._localHold,
          remoteHold    : this._remoteHold,
          audioMuted    : this._audioMuted,
          videoMuted    : this._videoMuted,
          sharedMid
        };
      }
    });

    // 会话事件统一增加 stats: 前缀，避免与通话事件混淆；payload 保持不变。
    [ 'report', 'network-quality', 'detailed-report', 'stats-error' ].forEach((eventName) =>
    {
      monitor.on(eventName, (payload) =>
      {
        logger.debug(`${this._id} stats:${eventName}`);
        this.emit(`stats:${eventName}`, payload);
      });
    });

    this._statsMonitor = monitor;
    monitor.start();
  }

  _stopStatsMonitor()
  {
    if (!this._statsMonitor)
    {
      return;
    }

    this._statsMonitor.stop();
    this._statsMonitor = null;
  }

  _markStatsTransition(reason)
  {
    this._statsMonitor && this._statsMonitor.markTransition(reason);
  }

  _createLocalDescription(type, constraints) 
  {
    logger.debug(`${this._id} createLocalDescription() ${type} ${JSON.stringify(constraints)}`);

    if (type !== 'offer' && type !== 'answer')
      throw new Error(`createLocalDescription() | invalid type "${type}"`);

    const connection = this._connection;

    this._rtcReady = false;

    return Promise.resolve()
      // Create Offer or Answer.
      .then(() => 
      {
        if (type === 'offer') 
        {
          return connection.createOffer(constraints)
            .catch((error) => 
            {
              this._logEventError('warn', 'peerconnection:createofferfailed', error);

              this.emit('peerconnection:createofferfailed', error);

              return Promise.reject(error);
            });
        }
        else 
        {
          return connection.createAnswer(constraints)
            .catch((error) => 
            {
              this._logEventError('warn', 'peerconnection:createanswerfailed', error);

              this.emit('peerconnection:createanswerfailed', error);

              return Promise.reject(error);
            });
        }
      })
      // Set local description.
      .then((desc) => 
      {
        const sdp = sdp_transform.parse(desc.sdp);

        if (type === 'offer') 
        {
          const mids = [];

          sdp.media.forEach((media, index) => 
          {
            if (!Utils.isFirefox()) 
            {
              // 处理视频呼叫音频接听后再切换视频时 mid 值问题
              media.mid = index;
              mids.push(index);
            }

            if (media.type === 'video') 
            {
              let lowH264 = false;
              let payloads = [ media.payloads ];
              const delH264Payload = [];

              if (typeof media.payloads === 'string') 
              {
                payloads = media.payloads.split(' ');
              }

              media.fmtp.forEach((fmtp) => 
              {
                if (fmtp.config.indexOf('profile-level-id=42e0') !== -1 || fmtp.config.indexOf('profile-level-id=42c0') !== -1) 
                {
                  lowH264 = true;
                }

                if (fmtp.config.indexOf('packetization-mode') !== -1 && fmtp.config.indexOf('profile-level-id=42') === -1) 
                {
                  delH264Payload.push(fmtp.payload);
                }

                // packetization-mode 规则：
                // 1) paphone    => 保留 0，删除 1
                // 2) 否则       => 保留 1，删除 0
                const keepZero = (this._customizedMode === 'paphone');
                const shouldDelete = keepZero ? fmtp.config.includes('packetization-mode=1') : fmtp.config.includes('packetization-mode=0');

                if (shouldDelete) 
                {
                  delH264Payload.push(fmtp.payload);
                }

              });

              media.fmtp.forEach((fmtp) => 
              {
                if (lowH264 && fmtp.config.indexOf('profile-level-id=4200') !== -1) 
                {
                  delH264Payload.push(fmtp.payload);
                }
              });

              media.fmtp.forEach((fmtp) => 
              {
                if (delH264Payload.indexOf(Number(fmtp.config.replace('apt=', ''))) != -1) 
                {
                  delH264Payload.push(fmtp.payload);
                }
              });

              // paphone H264 payload 为124，去掉其他payload为124的媒体
              if (media.rtp && this._customizedMode === 'paphone') 
              {
                media.rtp.forEach((item) => { item.payload === 124 && String(item.codec).toLowerCase() !== 'h264' && delH264Payload.push(124); });
              }

              media.payloads = payloads.filter((x) => !delH264Payload.some((i) => i == x)).join(' ');

              if (media.fmtp) 
              {
                media.fmtp = media.fmtp.filter((r) => delH264Payload.indexOf(r.payload) == -1);
              }

              if (media.rtp) 
              {
                // 是否存在 payload=124 且 codec 为 h264（忽略大小写）
                const hasOther124 = media.rtp.some((item) => item.payload === 124 && String(item.codec).toLowerCase() !== 'h264');

                // paphone H264 payload 为124，去掉其他payload为124的媒体
                this._customizedMode === 'paphone' && hasOther124 && delH264Payload.push(124);
                media.rtp = media.rtp.filter((r) => delH264Payload.indexOf(r.payload) == -1);
              }

              if (media.rtcpFb) 
              {
                media.rtcpFb = media.rtcpFb.filter((r) => delH264Payload.indexOf(r.payload) == -1);
              }
            }

            /**
             * 处理5G外呼sdp过大问题,
             * SDK只对H264过滤保留两个,以兼容其他通用端,SBC对外呼手机的呼叫做媒体过滤
             */
            if (Utils.is5GService(this._ua)) 
            {
              // 删除 extmap 仅保留 urn:3gpp:video-orientation
              if (media.ext) 
              {
                media.ext = media.ext.filter((ext) => 
                {
                  return ext.uri === 'urn:3gpp:video-orientation';
                });
              }

              if (media.type === 'video') 
              {
                media.invalid = [ { value: 'tcap:1 RTP/AVPF' }, { value: 'pcfg:1 t=1' } ];
              }
            }
          });

          // 处理视频呼叫音频接听后再切换视频时 mid 值问题
          (Utils.isFirefox()) || (sdp.groups[0].mids = mids.join(' '));
          desc.sdp = sdp_transform.write(sdp);
        }

        desc.sdp = sdp_transform.write(sdp);

        // 兼容chrome<71版本  https://github.com/webrtcHacks/adapter/issues/919
        desc.sdp = desc.sdp.replace(/a=extmap-allow-mixed.*\r\n/g, '');

        this._customizedMode === 'paphone' && (desc.sdp = Utils.compatiblePayload(desc.sdp));

        // 非BFCP修改为根据配置参数设置 profile-level-id
        const localSdpLevel = CRTC_C.SDP_LEVELID_AS[this._sdpResolution];

        !this._bfcp.enabled && localSdpLevel && (desc.sdp = desc.sdp.replace(/profile-level-id=[\w\d]+/g, `profile-level-id=${localSdpLevel.LEVELID}`));

        if (localSdpLevel && localSdpLevel.AS)
        {
          let videoAsKbps = localSdpLevel.AS;

          // answer 优先按远端 offer 的 b=AS 生成本地 x-google 码率范围；没有远端 AS 时才用本地分辨率表。
          if (type === 'answer')
          {
            const remoteOfferSdp = this._lastRemoteOfferSdpForAnswer || (connection.remoteDescription && connection.remoteDescription.sdp);
            const remoteVideo = remoteOfferSdp && sdp_transform.parse(remoteOfferSdp).media.find((media) => media.type === 'video');
            const remoteAs = remoteVideo && remoteVideo.bandwidth && remoteVideo.bandwidth.find((item) => item.type === 'AS' && Number(item.limit) > 0);

            remoteAs && (videoAsKbps = Number(remoteAs.limit));
          }

          const minKbps = Math.max(1, Math.round(videoAsKbps * 0.9));
          const maxKbps = Math.max(1, Math.round(videoAsKbps * 1.1));
          const parsedLocalSdp = sdp_transform.parse(desc.sdp);

          parsedLocalSdp.media.forEach((media) =>
          {
            if (media.type !== 'video' || !Array.isArray(media.fmtp))
            {
              return;
            }

            media.fmtp.forEach((fmtp) =>
            {
              if (!fmtp.config || /^\s*apt=/.test(fmtp.config))
              {
                return;
              }

              // x-google-* 只给本地 setLocalDescription 使用，RTX apt 行不加，发给 SIP 对端前会剥离。
              fmtp.config = fmtp.config
                .replace(/;x-google-min-bitrate=\d+/g, '')
                .replace(/;x-google-max-bitrate=\d+/g, '');
              fmtp.config += `;x-google-min-bitrate=${minKbps};x-google-max-bitrate=${maxKbps}`;
            });
          });

          desc.sdp = sdp_transform.write(parsedLocalSdp);
        }

        // 兼容 Firefox 去掉 bundle
        if (Utils.isFirefox() && type === 'offer') 
        {
          desc.sdp = desc.sdp.replace(/a=bundle-only\r\n/g, '');
          desc.sdp = desc.sdp.replace(/m=video 0 /g, 'm=video 9 ');
        }

        return connection.setLocalDescription(desc)
          .catch((error) => 
          {
            this._rtcReady = true;

            this._logEventError('warn', 'peerconnection:setlocaldescriptionfailed', error);

            this.emit('peerconnection:setlocaldescriptionfailed', error);

            return Promise.reject(error);
          });
      })
      .then(() => 
      {
        // Resolve right away if 'pc.iceGatheringState' is 'complete'.
        /**
         * Resolve right away if:
         * - 'connection.iceGatheringState' is 'complete' and no 'iceRestart' constraint is set.
         * - 'connection.iceGatheringState' is 'gathering' and 'iceReady' is true.
         */
        const iceRestart = constraints && constraints.iceRestart;

        if ((connection.iceGatheringState === 'complete' && !iceRestart) ||
          (connection.iceGatheringState === 'gathering' && this._iceReady)) 
        {
          this._rtcReady = true;

          const e = { originator: 'local', type: type, sdp: connection.localDescription.sdp };

          this._bfcp.enabled && (e.sdp = this._bfcp.replaceDataChannelMediaWithBFCP(e.sdp));
          // x-google-* 是本地 WebRTC 编码器参数，不透传给 SIP 对端。
          e.sdp = e.sdp.replace(/;x-google-min-bitrate=\d+/g, '').replace(/;x-google-max-bitrate=\d+/g, '');

          // logger.debug(`${this._id} complete emit "sdp"${ e.sdp}`);
          this.emit('sdp', e);

          return Promise.resolve(e.sdp);
        }

        // Add 'pc.onicencandidate' event handler to resolve on last candidate.
        return new Promise((resolve) => 
        {
          let finished = false;
          let iceCandidateListener;
          let iceGatheringStateListener;

          this._iceReady = false;

          const ready = () => 
          {
            connection.removeEventListener('icecandidate', iceCandidateListener);
            connection.removeEventListener('icegatheringstatechange', iceGatheringStateListener);

            finished = true;
            this._rtcReady = true;

            // connection.iceGatheringState will still indicate 'gathering' and thus be blocking.
            this._iceReady = true;

            const e = { originator: 'local', type: type, sdp: connection.localDescription.sdp };

            this._bfcp.enabled && (e.sdp = this._bfcp.replaceDataChannelMediaWithBFCP(e.sdp));
            // x-google-* 是本地 WebRTC 编码器参数，不透传给 SIP 对端。
            e.sdp = e.sdp.replace(/;x-google-min-bitrate=\d+/g, '').replace(/;x-google-max-bitrate=\d+/g, '');

            logger.debug(`${this._id} ready emit "sdp"`);
            this.emit('sdp', e);

            resolve(e.sdp);
          };

          connection.addEventListener('icecandidate', iceCandidateListener = (event) => 
          {
            const candidate = event.candidate;

            logger.debug(`${this._id} ${new Date().toISOString()} icecandidate: ${JSON.stringify(candidate)}`);

            if (candidate) 
            {
              // 两秒后如果没有收集结束，则强制结束
              setTimeout(() => 
              {
                if (!finished) 
                {
                  ready();
                }
              }, 2000);

              this.emit('icecandidate', {
                candidate,
                ready
              });
            }

            else if (!finished) 
            {
              ready();
            }
          });

          connection.addEventListener('icegatheringstatechange', iceGatheringStateListener = () => 
          {
            logger.debug(`${this._id} ${new Date().toISOString()} icegatheringstatechange: ${connection.iceGatheringState} ${finished}`);
            if ((connection.iceGatheringState === 'complete') && !finished) 
            {
              ready();
            }

            // 超时自动ready
            if (connection.iceGatheringState === 'gathering') 
            {
              setTimeout(() => 
              {
                !finished && ready();
              }, 500);
            }

          });
        });
      })
      .then((sdp) => 
      {
        // 去掉IPV6
        // sdp = sdp.replace(/a=candidate:.*:.*\r\n/g, '');
        // logger.debug(`${this._id} sdp: ${sdp}`);
        const sdp_desc = sdp_transform.parse(sdp);

        if (type === 'offer') 
        {
          (this._localToAudio === '') && (this._localToAudio = true);
          (this._localToVideo === '') && (this._localToVideo = false);

          for (const m of sdp_desc.media) 
          {
            if (m.type === 'audio') 
            {
              continue;
            }

            if (this._localToAudio || m.direction == 'inactive') 
            {
              m.port = 0;
              try 
              {
                delete m.connection;
              }
              catch (error) { }
              // m.connection = {
              //   ip      : '0.0.0.0',
              //   version : 4
              // };
            }

            if (m.port !== 0) 
            {
              if (this._mode === '') 
              {
                this._mode = 'video';
              }
              else 
              {
                this._ontogglemode('video');
              }
              this._localToAudio = false;
              this._localToVideo = true;
            }
            else 
            {
              m.direction = 'sendrecv';
            }
          }
          (this._mode === '') && (this._mode = 'audio');
        }
        else 
        {
          /**
           * 本地音频接听后设置 video 的 port=0
           * @author: lei
           */
          for (const m of sdp_desc.media) 
          {
            if (m.type !== 'video') 
            {
              continue;
            }

            const port = m.port;

            if (this._localToAudio || m.direction === 'inactive') 
            {
              m.port = 0;

              if (this._remoteHold) 
              {
                m.port = port;
              }
              this._ontogglemode('audio');
            }
            else if (!this._remoteToAudio) 
            {
              this._ontogglemode('video');
            }

            if (m.port === 0) 
            {
              delete m.connection;
              m.direction = 'sendrecv';
            }
          }
        }

        let _bandAS = 0;
        let _bandRR = 0;
        let _bandRS = 0;

        /**
         * 处理5G外呼sdp
         * 华为MCU对接需要带 b=AS
         */
        sdp_desc.media.forEach((media) => 
        {
          if (media.type === 'video') 
          {

            /**
             * 处理5G和非5G的SDP
             */
            if (Utils.is5GService(this._ua)) 
            {
              _bandAS += CRTC_C.SDP_LEVELID_AS[this._sdpResolution].AS;
              _bandRR += 6000;
              _bandRS += 8000;

              media.bandwidth = [ { type: 'AS', limit: CRTC_C.SDP_LEVELID_AS[this._sdpResolution].AS }, { type: 'RR', limit: 6000 }, { type: 'RS', limit: 8000 } ];
              media.invalid = [ { value: 'tcap:1 RTP/AVPF' }, { value: 'pcfg:1 t=1' } ];
            }
            else 
            {
              let bwidth = 1024;

              media.mid === 2 && (bwidth = 2048);
              _bandAS += bwidth;
              media.bandwidth || (media.bandwidth = [ { type: 'AS', limit: bwidth } ]);
            }
          }
          else if (media.type === 'audio') 
          {
            /**
             * 处理5G和非5G的SDP
             */
            if (Utils.is5GService(this._ua)) 
            {
              _bandAS += 90;
              _bandRR += 600;
              _bandRS += 2000;

              media.bandwidth = [ { type: 'AS', limit: 90 }, { type: 'RR', limit: 600 }, { type: 'RS', limit: 2000 } ];
            }
          }
        });

        /**
         * 处理5G和非5G的SDP
         */
        if (Utils.is5GService(this._ua)) 
        {
          sdp_desc.bandwidth = [ { type: 'AS', limit: _bandAS }, { type: 'RR', limit: _bandRR }, { type: 'RS', limit: _bandRS } ];
        }
        
        return sdp_transform.write(sdp_desc);
      })
      .catch((e) => 
      {
        logger.warn(`${this._id} ${e.message}`);
      });
  }

  /**
   * Dialog Management
   */
  _createDialog(message, type, early) 
  {
    const local_tag = (type === 'UAS') ? message.to_tag : message.from_tag;
    const remote_tag = (type === 'UAS') ? message.from_tag : message.to_tag;
    const id = message.call_id + local_tag + remote_tag;

    let early_dialog = this._earlyDialogs[id];

    // Early Dialog.
    if (early) 
    {
      if (early_dialog) 
      {
        return true;
      }
      else 
      {
        early_dialog = new Dialog(this, message, type, Dialog.C.STATUS_EARLY);

        // Dialog has been successfully created.
        if (early_dialog.error) 
        {
          logger.debug(early_dialog.error);
          this._failed('remote', message, CRTC_C.causes.INTERNAL_ERROR);

          return false;
        }
        else 
        {
          this._earlyDialogs[id] = early_dialog;

          return true;
        }
      }
    }

    // Confirmed Dialog.
    else 
    {
      this._from_tag = message.from_tag;
      this._to_tag = message.to_tag;

      // In case the dialog is in _early_ state, update it.
      if (early_dialog) 
      {
        early_dialog.update(message, type);
        this._dialog = early_dialog;
        delete this._earlyDialogs[id];

        return true;
      }

      // Otherwise, create a _confirmed_ dialog.
      const dialog = new Dialog(this, message, type);

      if (dialog.error) 
      {
        logger.debug(dialog.error);
        this._failed('remote', message, CRTC_C.causes.INTERNAL_ERROR);

        return false;
      }
      else 
      {
        this._dialog = dialog;

        return true;
      }
    }
  }

  /**
   * In dialog INVITE Reception
   */

  _receiveReinvite(request) 
  {
    logger.debug(`${this._id} receiveReinvite()`);

    const contentType = request.hasHeader('Content-Type') ?
      request.getHeader('Content-Type').toLowerCase() : undefined;
    const data = {
      request,
      callback : undefined,
      reject   : reject.bind(this)
    };

    let applicationIndex;
    let rejected = false;

    function reject(options = {}) 
    {
      rejected = true;

      const status_code = options.status_code || 403;
      const reason_phrase = options.reason_phrase || '';
      const extraHeaders = Utils.cloneArray(options.extraHeaders);

      if (this._status !== C.STATUS_CONFIRMED) 
      {
        return false;
      }

      if (status_code < 300 || status_code >= 700) 
      {
        throw new TypeError(`Invalid status_code: ${status_code}`);
      }
      request.reply(status_code, reason_phrase, extraHeaders);
    }

    // Emit 'reinvite'.
    this.emit('reinvite', data);

    if (rejected) 
    {
      return;
    }

    this._late_sdp = false;

    // Request without SDP.
    if (!request.body) 
    {
      this._late_sdp = true;
      if (this._remoteHold) 
      {
        this._remoteHold = false;
        this._onunhold('remote');
      }
      this._connectionPromiseQueue = this._connectionPromiseQueue
        .then(() => this._createLocalDescription('offer', this._rtcOfferConstraints))
        .then((sdp) => 
        {
          sendAnswer.call(this, sdp);
        })
        .catch((e) => 
        {
          logger.warn(`this._id ${e.message} ${JSON.stringify(e)}`);
          request.reply(500);
        });

      return;
    }

    // Request with SDP.
    if (contentType !== 'application/sdp') 
    {
      logger.debug(`${this._id} invalid Content-Type`);
      request.reply(415);

      return;
    }

    function nextS() 
    {
      // 适配100rel调整 reinvite 的 hold 判断
      this._notHold = true;

      this._localMediaStream.getVideoTracks().forEach((track) => 
      {
        if (track.readyState !== 'ended') 
        {
          this._notHold = false;
        }
      });

      this._processInDialogSdpOffer(request)
        // Send answer.
        .then((desc) => 
        {
          /**
           * 解决UPDATE场景到H5的媒体传输tcap AVPF协商问题
           * O/A方SDP中对应媒体携带a=cc-xfb属性，对应行为是SBC转发后把媒体传输AVP改为AVPF
           * 其中远端Offer tcap，本端应答时不能携带tcap属性，现修改为5G授权默认不携带tcap等
           *
           * 1、本端初始offer主动设置tcap，不带xfb
           * 2、本端初始offer未设置tcap，不带xfb
           * 3、本端初始answer，远端带tcap。带xfb
           * 4、本端初始answer，远端不带带tcap。不带xfb
           * 5、本端offer关闭视频，不带xfb
           * 6、本端answer关闭视频，不带xfb
           *
           * 有特殊场景update不带tcap，暂时改为全部响应带xfb
           */
          if (Utils.is5GService(this._ua) && desc) 
          {
            desc = desc.replace(/(m=video.*)\r\n/, '$1\r\na=cc-xfb\r\n');
            desc = desc.replace(/a=pcfg:1 t=1\r\n/, '');
            desc = desc.replace(/a=tcap.*AVPF\r\n/, '');
          }

          if (this._bfcp.enabled) 
          {
            desc = this._bfcp.addReinviteAnswerAttributes(desc, null);
          }

          if (this._status === C.STATUS_TERMINATED) 
          {
            return;
          }

          sendAnswer.call(this, desc);
        })
        .catch((error) => 
        {
          logger.warn(error);
        });
    }

    /**
     * 音视频切换相关
     * 收到reinvite时候判断是否要就行音视频模式切换
     * @author: lei
     */
    if (request.body) 
    {
      let waiting = false;
      let mediaIndex = 0;

      // 适配通用情况下的SDP H224
      const { originalIndexes, sdp } = Utils.getApplicationMediaPositions(request.body);

      applicationIndex = originalIndexes;
      request.body = sdp;
      logger.debug(`${this._id} applicationIndex: `, applicationIndex);
      logger.debug(`${this._id} NEW Reinvite SDP: `, sdp);

      const sdp_request = sdp_transform.parse(request.body);

      // request['mode'] = 'audio';

      this._remoteToAudio = true;
      this._remoteToVideo = false;

      for (const m of sdp_request.media) 
      {
        if (m.type == 'audio') 
        {
          continue;
        }

        mediaIndex++;

        if (mediaIndex == 1 && (m.port === 0 || (m.port === 0 && this._mode === 'video'))) 
        {
          this._ontogglemode('audio');
        }
        else if (this._mode === 'audio') 
        {
          waiting = true;
          // 触发切换事件，要求用户授权
          this._remoteToVideo = true;
          this._remoteToAudio = false;

          this._localToAudio = false;
          this._localToVideo = true;

          if (this.listeners('upgradeToVideo').length === 0) 
          {
            this._localToAudio = false;
            nextS.call(this);
          }
          else 
          {
            logger.debug(`${this._id} has upgradeToVideo listeners.`);
            this.emit('upgradeToVideo', {
              request,
              accept : (videoConstraints) => 
              {
                videoConstraints && (this._inviteMediaConstraints.video = videoConstraints);
                console.warn('tin: ', this._inviteMediaConstraints);
                this._localToAudio = false;
                nextS.call(this);
              },
              reject : () => 
              {
                this._localToAudio = true;
                request.body = Utils.disableVideoInSdp(request.body);
                nextS.call(this);
              }
            });
          }
        }
        // 兼容多流分享
        // else
        // {
        //   waiting = true;
        //   nextS.call(this);
        // }
      }

      if (!waiting) 
      {
        if (sdp_request.media.length < 3) 
        {
          // 自动响应的时候不改变这个参数，改变就变成音频模式了
          this._localToVideo = false;
          nextS.call(this);
        }
        else 
        {
          this._localToAudio = false;
          this._localToVideo = true;
          nextS.call(this);
        }
      }
    }

    function sendAnswer(desc) 
    {
      const extraHeaders = [ `Contact: ${this._contact}` ];

      // 5G Headers
      push5GServiceHeaders(extraHeaders, this._ua);

      this._handleSessionTimersInIncomingRequest(request, extraHeaders);

      if (this._late_sdp) 
      {
        desc = this._mangleOffer(desc);
      }

      if (this._bfcp.enabled) 
      {
        desc = this._bfcp.addReinviteAnswerAttributes(desc, applicationIndex);
        logger.debug(`${this._id} NEW Answer SDP: `, desc);
      }

      request.reply(200, null, extraHeaders, desc,
        () => 
        {
          this._status = C.STATUS_WAITING_FOR_ACK;
          this._setInvite2xxTimer(request, desc);
          this._setACKTimer();
        }
      );

      // If callback is given execute it.
      if (typeof data.callback === 'function') 
      {
        data.callback();
      }
    }
  }

  /**
   * In dialog UPDATE Reception
   */
  _receiveUpdate(request) 
  {
    logger.debug(`${this._id} receiveUpdate()`);

    const contentType = request.hasHeader('Content-Type') ?
      request.getHeader('Content-Type').toLowerCase() : undefined;
    const data = {
      request,
      callback : undefined,
      reject   : reject.bind(this)
    };

    let rejected = false;

    function reject(options = {}) 
    {
      rejected = true;

      const status_code = options.status_code || 403;
      const reason_phrase = options.reason_phrase || '';
      const extraHeaders = Utils.cloneArray(options.extraHeaders);

      if (this._status !== C.STATUS_CONFIRMED) 
      {
        return false;
      }

      if (status_code < 300 || status_code >= 700) 
      {
        throw new TypeError(`Invalid status_code: ${status_code}`);
      }

      request.reply(status_code, reason_phrase, extraHeaders);
    }

    // Emit 'update'.
    this.emit('update', data);

    if (rejected) 
    {
      return;
    }

    if (!request.body) 
    {
      sendAnswer.call(this, null);

      return;
    }

    if (contentType !== 'application/sdp') 
    {
      logger.debug(`${this._id} invalid Content-Type`);

      request.reply(415);

      return;
    }

    // 适配 100rel 调整update带sdp的处理
    function nextS() 
    {
      this._notHold = true;
      this._processInDialogSdpOffer(request)
        // Send answer.
        .then((desc) => 
        {
          /**
           * 解决UPDATE场景到H5的媒体传输tcap AVPF协商问题
           * O/A方SDP中对应媒体携带a=cc-xfb属性，对应行为是SBC转发后把媒体传输AVP改为AVPF
           * 其中远端Offer tcap，本端应答时不能携带tcap属性，现修改为5G授权默认不携带tcap等
           *
           * 1、本端初始offer主动设置tcap，不带xfb
           * 2、本端初始offer未设置tcap，不带xfb
           * 3、本端初始answer，远端带tcap。带xfb
           * 4、本端初始answer，远端不带带tcap。不带xfb
           * 5、本端offer关闭视频，不带xfb
           * 6、本端answer关闭视频，不带xfb
           *
           * 有特殊场景update不带tcap，暂时改为全部响应带xfb
           */
          if (Utils.is5GService(this._ua) && desc) 
          {
            desc = desc.replace(/(m=video.*)\r\n/, '$1\r\na=cc-xfb\r\n');
            desc = desc.replace(/a=pcfg:1 t=1\r\n/, '');
            desc = desc.replace(/a=tcap.*AVPF\r\n/, '');
          }

          if (this._status === C.STATUS_TERMINATED) 
          {
            return;
          }

          sendAnswer.call(this, desc);
        })
        .catch((error) => 
        {
          logger.warn(error);
        });
    }

    /**
     * 音视频切换相关
     * 收到reinvite时候判断是否要就行音视频模式切换
     * @author: lei
     */
    if (request.body) 
    {
      let waiting = false;

      // 适配 183 视频有端口但是 a=inactive
      if (this._earlyAudio && request.body.indexOf('m=video 0 ') === -1) 
      {
        this._earlyAudio = undefined;
      }

      const sdp_request = sdp_transform.parse(request.body);

      this._remoteToAudio = true;
      this._remoteToVideo = false;

      for (const m of sdp_request.media) 
      {
        if (m.type == 'audio') 
        {
          continue;
        }

        if (m.port === 0 || (m.port === 0 && this._mode === 'video')) 
        {
          this._ontogglemode('audio');
        }
        else 
        {
          waiting = true;
          // 触发切换事件，要求用户授权
          this._remoteToVideo = true;
          this._remoteToAudio = false;

          this._localToAudio = false;
          this._localToVideo = true;

          if (this.listeners('upgradeToVideo').length === 0) 
          {
            this._localToAudio = false;
            nextS.call(this);
          }
          else 
          {
            logger.debug(`${this._id} has upgradeToVideo listeners.`);

            this.emit('upgradeToVideo', {
              request,
              accept : () => 
              {
                this._localToAudio = false;
                nextS.call(this);
              },
              reject : () => 
              {
                this._localToAudio = true;
                nextS.call(this);
              }
            });
          }
        }
      }

      if (!waiting) 
      {
        logger.debug(`${this._id} !waiting.`);

        this._localToAudio = true;
        this._localToVideo = false;
        nextS.call(this);
      }
    }

    function sendAnswer(desc) 
    {
      const extraHeaders = [ `Contact: ${this._contact}` ];

      // 5G Headers
      push5GServiceHeaders(extraHeaders, this._ua);

      this._handleSessionTimersInIncomingRequest(request, extraHeaders);

      request.reply(200, null, extraHeaders, desc);

      // If callback is given execute it.
      if (typeof data.callback === 'function') 
      {
        data.callback();
      }
    }
  }

  _processInDialogSdpOffer(request) 
  {
    logger.debug(`${this._id} _processInDialogSdpOffer()`);

    const sdp = request.parseSDP();

    let hold = false;

    for (const m of sdp.media) 
    {
      if (holdMediaTypes.indexOf(m.type) === -1) 
      {
        continue;
      }

      const direction = m.direction || sdp.direction || 'sendrecv';

      if (direction === 'sendonly' || direction === 'inactive') 
      {
        hold = true;
      }
      // If at least one of the streams is active don't emit 'hold'.
      else 
      {
        hold = false;
        break;
      }
    }

    let newSdp = this._sdpAddMid(request.body);

    if (this._dtmf_payload) 
    {
      newSdp = Utils.replaceDtmfPayloads(newSdp, this._dtmf_payload);
    }

    logger.debug(`${this._id} new DTMF SDP: `, newSdp);

    // DTMF 触发的重新协商也会走 answer，需要同样保留远端 offer 的 b=AS。
    this._lastRemoteOfferSdpForAnswer = newSdp;

    const e = { originator: 'remote', type: 'offer', sdp: newSdp };

    logger.debug(`${this._id} emit "sdp"`);
    this.emit('sdp', e);

    const offer = new RTCSessionDescription({ type: 'offer', sdp: e.sdp });

    this._connectionPromiseQueue = this._connectionPromiseQueue
      // Set remote description.
      .then(() => 
      {
        if (this._status === C.STATUS_TERMINATED) 
        {
          throw new Error('terminated');
        }

        return this._connection.setRemoteDescription(offer)
          .catch((error) => 
          {
            request.reply(488);
            emitSetRemoteDescriptionFailed(this, error);

            throw error;
          });
      })
      .then(() => 
      {
        if (this._status === C.STATUS_TERMINATED) 
        {
          throw new Error('terminated');
        }

        if (this._remoteHold === true && hold === false) 
        {
          this._remoteHold = false;
          this._onunhold('remote');
        }
        else if (this._remoteHold === false && hold === true) 
        {
          this._remoteHold = true;
          this._onhold('remote');
        }
      })
      .then(() => 
      {
        // 新增判断是否已经存在一个视频
        let hasVideo = false;

        this._connection.getSenders().forEach((sender) => 
        {
          try 
          {
            logger.debug('sender: ', sender.track.kind, sender.track.readyState);            
          }
          catch (error) { }
          
          if (sender.track && sender.track.kind === 'video' && sender.track.readyState === 'live') 
          {
            hasVideo = true;
          }
        });

        logger.debug(`${this._id} stats: `, this._remoteToVideo, this._localToAudio, this._notHold, hasVideo, this._customMediaStream);

        // 适配 100rel 调整 hold 的判断
        if (this._remoteToVideo && !this._localToAudio && this._notHold && !hasVideo && (this._customMediaStream === false)) 
        {
          if (!this._localMediaStreamLocallyGenerated) 
          {
            return false;
          }

          const videoConstraints = this._inviteMediaConstraints ? { video: (this._inviteMediaConstraints.video || true) } : { video: true };

          if (CRTC_C.SDP_LEVELID_AS[this._sdpResolution].VIDEOCONSTRAINTS) 
          {
            Object.assign(videoConstraints.video, CRTC_C.SDP_LEVELID_AS[this._sdpResolution].VIDEOCONSTRAINTS);
          }

          logger.debug('video constraints: ', JSON.stringify(videoConstraints));

          return this._mediaPipeline.getUserMediaWithSessionPipeline(videoConstraints, this._sessionMediaEffectsComposerOptions)
            .catch((error) =>
            {
              if (this._status === C.STATUS_TERMINATED)
              {
                throw new Error('terminated');
              }

              // this._failed('local', null, CRTC_C.causes.USER_DENIED_MEDIA_ACCESS);

              this._logEventError('warn', 'getusermediafailed', error);

              this.emit('getusermediafailed', error);

              return false;
              // throw error;
            });
        }
      })
      .then((stream) => 
      {
        if (stream) 
        {
          logger.debug(`${this._id} has stream.`);

          stream = Utils.bypassIOS151_152CanvasBug(stream);

          stream.getVideoTracks().forEach((track) => 
          {
            try 
            {
              this._localMediaStream.addTrack(track);
            }
            catch (error) 
            {
              this._logOperationError('warn', `_processInDialogSdpOffer() failed local stream ${error.name} ${track.kind}`, error);
            }

            // 兼容低版本浏览器不支持addTrack的情况
            if (RTCPeerConnection.prototype.addTrack) 
            {
              try 
              {
                this._connection.addTrack(track, stream);
              }
              catch (error) 
              {
                this._logOperationError('warn', `_processInDialogSdpOffer() failed no stream ${error.name} ${track.kind}`, error);
              }
            }
            else 
            {
              this._connection.addStream(stream);
            }
          });

          this._iceReady = false;
        }
        else 
        {
          logger.debug(`${this._id} no stream.`);

          // 兼容低版本浏览器不支持addTrack的情况
          // eslint-disable-next-line no-lonely-if
          if (RTCPeerConnection.prototype.addTrack) 
          {
            if (this._localMediaStream.getVideoTracks()[0]) 
            {
              const videoTrack = this._localMediaStream.getVideoTracks()[0];
              const senders = this._connection.getSenders();
              const trackAlreadyAdded = senders.some((sender) => sender.track === videoTrack);

              if (!trackAlreadyAdded) 
              {
                try 
                {
                  this._connection.addTrack(this._localMediaStream.getVideoTracks()[0], this._localMediaStream);
                }
                catch (error) 
                {
                  this._logOperationError('warn', `_processInDialogSdpOffer() failed no stream ${error.name} ${this._localMediaStream.getVideoTracks()[0].kind}`, error);
                }
              }
              else 
              {
                logger.warn(`${this._id} Track is already added to the peer connection.`);
              }
            }
          }
          else 
          {
            this._connection.addStream(this._localMediaStream);
          }

          this._iceReady = true;
        }
      })
      // Create local description.
      .then(() => 
      {
        if (this._status === C.STATUS_TERMINATED) 
        {
          throw new Error('terminated');
        }

        return this._createLocalDescription('answer', this._rtcAnswerConstraints)
          .catch((error) => 
          {
            request.reply(500);
            this._logEventError('warn', 'peerconnection:createtelocaldescriptionfailed', error);

            throw error;
          });
      })
      .catch((error) => 
      {
        this._logOperationError('warn', '_processInDialogSdpOffer() failed', error);
      });

    return this._connectionPromiseQueue;
  }

  /**
   * In dialog Refer Reception
   */
  _receiveRefer(request) 
  {
    logger.debug(`${this._id} receiveRefer()`);

    if (!request.refer_to) 
    {
      logger.debug(`${this._id} no Refer-To header field present in REFER`);
      request.reply(400);

      return;
    }

    if (request.refer_to.uri.scheme !== CRTC_C.SIP) 
    {
      logger.debug(`${this._id} Refer-To header field points to a non-SIP URI scheme`);
      request.reply(416);

      return;
    }

    // Reply before the transaction timer expires.
    request.reply(202);

    const notifier = new RTCSession_ReferNotifier(this, request.cseq);

    logger.debug(`${this._id} emit "refer"`);

    // Emit 'refer'.
    this.emit('refer', {
      request,
      accept : (initCallback, options) => 
      {
        accept.call(this, initCallback, options);
      },
      reject : () => 
      {
        reject.call(this);
      }
    });

    function accept(initCallback, options = {}) 
    {
      initCallback = (typeof initCallback === 'function') ? initCallback : null;

      if (this._status !== C.STATUS_WAITING_FOR_ACK &&
        this._status !== C.STATUS_CONFIRMED) 
      {
        return false;
      }

      if (this._bfcp.enabled) 
      {
        initCallback && initCallback();

        return;
      }

      const session = new RTCSession(this._ua);

      session.on('progress', ({ response }) => 
      {
        this._bfcp.enabled || notifier.notify(response.status_code, response.reason_phrase);
      });

      session.on('accepted', ({ response }) => 
      {
        this._bfcp.enabled || notifier.notify(response.status_code, response.reason_phrase);

        // 华为MCU需要挂断
        this._bfcp.enabled && this.terminate();
      });

      session.on('_failed', ({ message, cause }) => 
      {
        if (message) 
        {
          this._bfcp.enabled || notifier.notify(message.status_code, message.reason_phrase);
        }
        else 
        {
          this._bfcp.enabled || notifier.notify(487, cause);
        }
      });

      // Consider the Replaces header present in the Refer-To URI.
      if (request.refer_to.uri.hasHeader('replaces')) 
      {
        const replaces = decodeURIComponent(request.refer_to.uri.getHeader('replaces'));

        options.extraHeaders = Utils.cloneArray(options.extraHeaders);
        options.extraHeaders.push(`Replaces: ${replaces}`);
      }

      options.mediaConstraints = options.mediaConstraints || this._inviteMediaConstraints || this._answerMediaConstraints;

      session.connect(request.refer_to.uri.toAor(), options, initCallback);
    }

    function reject() 
    {
      notifier.notify(603);
    }
  }

  /**
   * In dialog Notify Reception
   */
  _receiveNotify(request) 
  {
    logger.debug(`${this._id} receiveNotify()`);

    if (!request.event) 
    {
      request.reply(400);
    }

    switch (request.event.event) 
    {
      case 'refer': {
        let id;
        let referSubscriber;

        if (request.event.params && request.event.params.id) 
        {
          id = request.event.params.id;
          referSubscriber = this._referSubscribers[id];
        }
        else if (Object.keys(this._referSubscribers).length === 1) 
        {
          referSubscriber = this._referSubscribers[
            Object.keys(this._referSubscribers)[0]];
        }
        else 
        {
          request.reply(400, 'Missing event id parameter');

          return;
        }

        if (!referSubscriber) 
        {
          request.reply(481, 'Subscription does not exist');

          return;
        }

        referSubscriber.receiveNotify(request);

        request.reply(200);

        break;
      }

      // for 3pcc
      case 'talk':
      case 'hold':
      {
        request.reply(200);
        this.emit('notify', { event: request.event.event, request: request });
        break;
      }

      default: {
        request.reply(489);
      }
    }
  }

  /**
   * INVITE with Replaces Reception
   */
  _receiveReplaces(request) 
  {
    logger.debug(`${this._id} receiveReplaces()`);

    function accept(initCallback) 
    {
      if (this._status !== C.STATUS_WAITING_FOR_ACK &&
        this._status !== C.STATUS_CONFIRMED) 
      {
        return false;
      }

      const session = new RTCSession(this._ua);

      // Terminate the current session when the new one is confirmed.
      session.on('confirmed', () => 
      {
        this.terminate();
      });

      session.init_incoming(request, initCallback);
    }

    function reject() 
    {
      logger.debug(`${this._id} Replaced INVITE rejected by the user`);
      request.reply(486);
    }

    // Emit 'replace'.
    this.emit('replaces', {
      request,
      accept : (initCallback) => { accept.call(this, initCallback); },
      reject : () => { reject.call(this); }
    });
  }

  /**
   * Initial Request Sender
   */
  _sendInitialRequest(rtcOfferConstraints, mediaStream) 
  {
    const request_sender = new RequestSender(this._ua, this._request, {
      onRequestTimeout : () => 
      {
        this.onRequestTimeout();
      },
      onTransportError : () => 
      {
        this.onTransportError();
      },
      // Update the request on authentication.
      onAuthenticated : (request) => 
      {
        this._request = request;
      },
      onReceiveResponse : (response) => 
      {
        this._receiveInviteResponse(response);
      }
    });

    // This Promise is resolved within the next iteration, so the app has now
    // a chance to set events such as 'peerconnection' and 'connecting'.
    Promise.resolve()
      .then(async() => 
      {
        if (this._status === C.STATUS_TERMINATED) 
        {
          throw new Error('terminated');
        }

        // 兼容BFCP需要做音频混音（委托给 BFCPChannel）
        if (this._bfcp.enabled) 
        {
          this._localMediaStream = this._bfcp.setupForOutgoing(mediaStream);
        }
        else 
        {
          this._localMediaStream = mediaStream;
        }

        if (this._localMediaStream) 
        {
          // 兼容低版本浏览器不支持addTrack的情况
          if (RTCPeerConnection.prototype.addTrack) 
          {
            this._localMediaStream.getAudioTracks().forEach((track) => 
            {
              this._connection.addTrack(track, this._localMediaStream);
            });

            this._localMediaStream.getVideoTracks().forEach((track) => 
            {
              this._connection.addTrack(track, this._localMediaStream);
            });
          }
          else 
          {
            this._connection.addStream(this._localMediaStream);
          }
        }

        /**
         * 是否启用 DataChannel
         **/
        if (this._bfcp.enabled) 
        {
          // BFCP 添加占位视频轨道并初始化 DataChannel
          this._bfcp.setupVideoTrackAndDataChannel();
        }

        // TODO: should this be triggered here?
        this._connecting(this._request);

        return this._createLocalDescription('offer', rtcOfferConstraints)
          .catch((error) => 
          {
            this._failed('local', null, CRTC_C.causes.WEBRTC_ERROR);

            throw error;
          });
      })
      .then((desc) => 
      {
        if (this._is_canceled || this._status === C.STATUS_TERMINATED) 
        {
          throw new Error('terminated');
        }

        // 添加BFCP所需属性（委托给 BFCPChannel）
        if (this._bfcp.enabled) 
        {
          // 查找画布流对应的 transceiver mid
          this._bfcp.findAndSetMStream();
          // 注入 floorctrl / 主辅流标志 / BFCP 媒体描述
          desc = this._bfcp.addOfferSDPAttributes(desc);
        }

        this._request.body = desc;
        this._status = C.STATUS_INVITE_SENT;

        // 获取DTMF的payload
        if (desc && !this._dtmf_payload) 
        {
          this._dtmf_payload = Utils.getDtmfPayloadAndClockRate(desc);
        }

        logger.debug(`${this._id} dtmf payload ${JSON.stringify(this._dtmf_payload)}`);
        logger.debug(`${this._id} emit "sending" [request:%o] `, this._request);

        const cache = [];

        logger.debug(`${this._id} emit "sending" [request:%o] ${JSON.stringify(this._request, (key, value) => 
        {
          if (typeof value === 'object' && value !== null) 
          {
            if (cache.indexOf(value) !== -1) 
            {
              // 移除
              return;
            }
            // 收集所有的值
            cache.push(value);
          }

          return value;
        })}`);

        // Emit 'sending' so the app can mangle the body before the request is sent.
        this.emit('sending', {
          request : this._request
        });

        request_sender.send();
      })
      .catch((error) => 
      {
        if (this._status === C.STATUS_TERMINATED) 
        {
          return;
        }

        logger.warn(error);
      });
  }

  /**
   * Get DTMF RTCRtpSender.
   */
  _getDTMFRTPSender() 
  {
    const sender = this._connection.getSenders().find((rtpSender) => 
    {
      return rtpSender.track && rtpSender.track.kind === 'audio';
    });

    if (!(sender && sender.dtmf)) 
    {
      logger.warn(`${this._id} sendDTMF() | no local audio track to send DTMF with`);

      return;
    }

    return sender.dtmf;
  }

  /**
   * Reception of Response for Initial INVITE
   */
  _receiveInviteResponse(response) 
  {
    logger.debug(`${this._id} receiveInviteResponse()`);

    // Handle 2XX retransmissions and responses from forked requests.
    if (this._dialog && (response.status_code >= 200 && response.status_code <= 299)) 
    {

      /*
       * If it is a retransmission from the endpoint that established
       * the dialog, send an ACK
       */
      if (this._dialog.id.call_id === response.call_id &&
        this._dialog.id.local_tag === response.from_tag &&
        this._dialog.id.remote_tag === response.to_tag) 
      {
        this.sendRequest(CRTC_C.ACK);

        return;
      }

      // If not, send an ACK  and terminate.
      else 
      {
        const dialog = new Dialog(this, response, 'UAC');

        if (dialog.error !== undefined) 
        {
          logger.debug(dialog.error);

          return;
        }

        this.sendRequest(CRTC_C.ACK);
        this.sendRequest(CRTC_C.BYE);

        return;
      }

    }

    // Proceed to cancellation if the user requested.
    if (this._is_canceled) 
    {
      if (response.status_code >= 100 && response.status_code < 200) 
      {
        this._request.cancel(this._cancel_reason);
      }
      else if (response.status_code >= 200 && response.status_code < 299) 
      {
        this._acceptAndTerminate(response);
      }

      return;
    }

    if (this._status !== C.STATUS_INVITE_SENT && this._status !== C.STATUS_1XX_RECEIVED) 
    {
      return;
    }

    switch (true) 
    {
      case /^100$/.test(response.status_code):
        this._status = C.STATUS_1XX_RECEIVED;
        this._trying(response);
        break;

      case /^1[0-9]{2}$/.test(response.status_code):
      {
        // Do nothing with 1xx responses without To tag.
        if (!response.to_tag) 
        {
          logger.debug(`${this._id} 1xx response received without to tag`);
          break;
        }

        // Create Early Dialog if 1XX comes with contact.
        if (response.hasHeader('contact')) 
        {
          // An error on dialog creation will fire 'failed' event.
          if (!this._createDialog(response, 'UAC', true)) 
          {
            break;
          }
        }

        this._status = C.STATUS_1XX_RECEIVED;

        if (!response.body) 
        {
          Promise.resolve()
            .then(() => 
            {
              if (response.getHeader('require') && response.getHeader('require').indexOf('100rel') !== -1 && Boolean(response.getHeader('rseq'))) 
              {
                this._earlyDialogs[Object.keys(this._earlyDialogs)[0]].sendRequest(CRTC_C.PRACK, { RSeq: response.getHeader('rseq') });
              }
            })
            .then(() => 
            {
              this._progress('remote', response);
            });

          break;
        }

        const newSdp = this._sdpAddMid(response.body);
        const e = { originator: 'remote', type: 'answer', sdp: newSdp };

        logger.debug(`${this._id} emit "sdp"`);
        this.emit('sdp', e);

        const answer = new RTCSessionDescription({ type: 'answer', sdp: e.sdp });
        // TODO:如果改成pranswer接通前远端update会有问题
        // const answer = new RTCSessionDescription({ type: 'pranswer', sdp: e.sdp });

        this._connectionPromiseQueue = this._connectionPromiseQueue
          .then(() => 
          {
            // 兼容部分场景180多次返回SDP问题
            if (this._connection.signalingState !== 'stable') 
            {
              return this._connection.setRemoteDescription(answer);
            }
            else 
            {
              logger.warn(`${this._id} Failed to execute 'setRemoteDescription' on 'RTCPeerConnection': Failed to set remote answer sdp: Called in wrong state: stable`);
            }
          })
        // 发送 RFC3262 183 PRACK
          .then(() => 
          {
            if (e.sdp.indexOf('m=video 0 ') !== -1) 
            {
              this._earlyAudio = true;
            }

            if (response.getHeader('require') && response.getHeader('require').indexOf('100rel') !== -1 && Boolean(response.getHeader('rseq'))) 
            {
              this._earlyDialogs[Object.keys(this._earlyDialogs)[0]].sendRequest(CRTC_C.PRACK, { RSeq: response.getHeader('rseq') });
            }
          })
          .then(() => this._progress('remote', response))
          .catch((error) => 
          {
            emitSetRemoteDescriptionFailed(this, error);
          });
        break;
      }

      case /^2[0-9]{2}$/.test(response.status_code):
      {
        this._status = C.STATUS_CONFIRMED;

        // An error on dialog creation will fire 'failed' event.
        if (!this._createDialog(response, 'UAC')) 
        {
          break;
        }

        // 以下修改为兼容 VoLTE 的 200ok 不带 SDP 的情况
        if (!response.body) 
        {
          this._accepted('remote', response);

          if (this._earlyAudio) 
          {
            this._ontogglemode('audio');
          }

          // 兼容安卓微信Bug
          if (this._replaceAudioTrack && Utils.isWeChat()) 
          {
            navigator.mediaDevices.getUserMedia(this._mediaPipeline.getGumConstraintsWithProcessorFlags({  
              audio : this._inviteMediaConstraints.audio || true, 
              video : false 
            }))
              .then(async(stream) =>
              {
                stream = await this._mediaPipeline.replaceAudioTrackWithSessionAiNoiseSuppression(stream);
                const sender = this._connection.getSenders().find((s) => 
                {
                  return s.track.kind == 'audio';
                });

                sender.replaceTrack(stream.getAudioTracks()[0])
                  .then(() => 
                  {
                    logger.debug(`WeChat replactTrack ${stream.getAudioTracks()[0].id} success.`);
                    // 适配 100rel 调整 ack 的 cseq
                    this.sendRequest(CRTC_C.ACK);
                    this._confirmed('local', null);
                  });
              });
          }
          else 
          {
            // 适配 100rel 调整 ack 的 cseq
            this.sendRequest(CRTC_C.ACK);
            this._confirmed('local', null);
          }
          break;
        }

        /**
             * 音视频切换相关
             * 根据sdp判断用户Answer的通话模式，并触发mode事件
             * @author: lei
             */
        const sdp = sdp_transform.parse(response.body);

        this._remoteToAudio = true;
        this._remoteToVideo = false;

        for (const m of sdp.media) 
        {
          if (m.type === 'audio') 
          {
            continue;
          }

          if (m.port !== 0) 
          {
            this._remoteToAudio = false;
            this._remoteToVideo = true;
          }
        }

        if (this._remoteToAudio) 
        {
          this._ontogglemode('audio');
        }
        else 
        {
          this._ontogglemode('video');
        }

        const newSdp = this._sdpAddMid(response.body);
        const e = { originator: 'remote', type: 'answer', sdp: newSdp };

        logger.debug(`${this._id} emit "sdp"`);
        this.emit('sdp', e);

        if (this._bfcp.enabled) 
        {
          // 解析应答 SDP 中的 BFCP 属性（floorId / floorctrl / confId / userId / mstrm）
          this._bfcp.parseAnswerSDP(e.sdp);
        }


        const answer = new RTCSessionDescription({ type: 'answer', sdp: e.sdp });

        this._connectionPromiseQueue = this._connectionPromiseQueue
          .then(() => 
          {
            // Be ready for 200 with SDP after a 180/183 with SDP.
            // We created a SDP 'answer' for it, so check the current signaling state.
            if (this._connection.signalingState === 'stable') 
            {
              return this._connection.createOffer(this._rtcOfferConstraints)
                .then((offer) => this._connection.setLocalDescription(offer))
                .catch((error) => 
                {
                  this._acceptAndTerminate(response, 500, error.toString());
                  this._failed('local', response, CRTC_C.causes.WEBRTC_ERROR);
                });
            }
          })
          .then(() => 
          {
            this._connection.setRemoteDescription(answer)
              .then(async() => 
              {
                // Handle Session Timers.
                this._handleSessionTimersInIncomingResponse(response);

                this._accepted('remote', response);
                this.sendRequest(CRTC_C.ACK);

                // 兼容安卓微信Bug及iOS蓝牙问题
                const mics = await Utils.getMicrophones();

                if (this._replaceAudioTrack && Utils.isWeChat()) 
                {
                  navigator.mediaDevices.getUserMedia(this._mediaPipeline.getGumConstraintsWithProcessorFlags({ 
                    audio : this._inviteMediaConstraints.audio || true, 
                    video : false 
                  }))
                    .then(async(stream) =>
                    {
                      stream = await this._mediaPipeline.replaceAudioTrackWithSessionAiNoiseSuppression(stream);
                      const sender = this._connection.getSenders().find((s) => 
                      {
                        return s.track.kind == 'audio';
                      });

                      if (sender) 
                      {
                        sender.replaceTrack(stream.getAudioTracks()[0])
                          .then(() => 
                          {
                            this._confirmed('local', null);
                          });
                      }
                      else 
                      {
                        this._confirmed('local', null);
                      }
                    });
                }
                else if (this._receiveInviteResponse && (navigator.userAgent.indexOf('iPhone') != -1 && mics.length > 1)) 
                {
                  if (this._localMediaStream) 
                  {
                    const sender = this._connection.getSenders().find((s) => 
                    {
                      return s.track.kind == 'audio';
                    });

                    if (sender) 
                    {
                      sender.replaceTrack(this._localMediaStream.getAudioTracks()[0])
                        .then(() => 
                        {
                          this._confirmed('local', null);
                        });
                    }
                    else 
                    {
                      this._confirmed('local', null);

                    }
                  }
                }
                else 
                {
                  this._confirmed('local', null);
                }

                // 开启 BFCP，自动发送reInvite
                this._bfcp.enabled && this.renegotiate();
              })
              .catch((error) => 
              {
                this._acceptAndTerminate(response, 488, 'Not Acceptable Here');
                this._failed('remote', response, CRTC_C.causes.BAD_MEDIA_DESCRIPTION);

                emitSetRemoteDescriptionFailed(this, error);
              });
          });
        break;
      }

      default:
      {
        const cause = Utils.sipErrorCause(response.status_code);

        this._failed('remote', response, cause);
      }
    }
  }

  /**
   * Send Re-INVITE
   */
  _sendReinvite(options = {}) 
  {
    logger.debug(`${this._id} sendReinvite()`);

    const extraHeaders = Utils.cloneArray(options.extraHeaders);
    const eventHandlers = Utils.cloneObject(options.eventHandlers);
    const rtcOfferConstraints = options.rtcOfferConstraints || this._rtcOfferConstraints || null;

    let succeeded = false;

    // extraHeaders.push(`Contact: ${this._contact}`);

    // 5G Headers
    push5GServiceHeaders(extraHeaders, this._ua);

    extraHeaders.push('Content-Type: application/sdp');

    // Session Timers.
    if (this._sessionTimers.running) 
    {
      extraHeaders.push(`Session-Expires: ${this._sessionTimers.currentExpires};refresher=${this._sessionTimers.refresher ? 'uac' : 'uas'}`);
    }

    this._connectionPromiseQueue = this._connectionPromiseQueue
      .then(() => this._createLocalDescription('offer', rtcOfferConstraints))
      .then((sdp) => 
      {
        sdp = this._mangleOffer(sdp);

        // 添加BFCP所需属性（委托给 BFCPChannel）
        if (this._bfcp.enabled)
        {
          sdp = this._bfcp.addReinviteAttributes(sdp);
        }
        const e = { originator: 'local', type: 'offer', sdp };

        if (this._bfcp.enabled)
        {
          e.sdp = this._bfcp.replaceDataChannelMediaWithBFCP(e.sdp);
        }

        logger.debug(`${this._id} emit "sdp"`);
        this.emit('sdp', e);

        // 新增reinvite时更新via_host
        options.changeViaHost && this._ua.set('via_host', `${Utils.createRandomToken(12)}.invalid`);
        extraHeaders.push(`Contact: ${this._ua.contact.toString()}`);

        this.sendRequest(CRTC_C.INVITE, {
          extraHeaders,
          body          : sdp,
          eventHandlers : {
            onSuccessResponse : (response) => 
            {
              onSucceeded.call(this, response);
              succeeded = true;
            },
            onErrorResponse : (response) => 
            {
              onFailed.call(this, response);
            },
            onTransportError : () => 
            {
              this.onTransportError(); // Do nothing because session ends.
            },
            onRequestTimeout : () => 
            {
              this.onRequestTimeout(); // Do nothing because session ends.
            },
            onDialogError : () => 
            {
              this.onDialogError(); // Do nothing because session ends.
            }
          }
        });
      })
      .catch(() => 
      {
        onFailed();
      });

    function onSucceeded(response) 
    {
      if (this._status === C.STATUS_TERMINATED) 
      {
        return;
      }

      this.sendRequest(CRTC_C.ACK);

      // If it is a 2XX retransmission exit now.
      if (succeeded) { return; }

      // Handle Session Timers.
      this._handleSessionTimersInIncomingResponse(response);

      // Must have SDP answer.
      if (!response.body) 
      {
        onFailed.call(this);

        return;
      }
      else if (!response.hasHeader('Content-Type') || response.getHeader('Content-Type').toLowerCase() !== 'application/sdp') 
      {
        onFailed.call(this);

        return;
      }

      // BFCP 控制的媒体 transceiver 索引号
      this._bfcp.parseTransceiverIndex(response.body);

      /**
       * 音视频切换相关
       * 远端接听模式
       * @author: lei
       */
      const sdp_body = sdp_transform.parse(response.body);

      let mediaIndex = 0;

      for (const m of sdp_body.media) 
      {
        if (m.type == 'audio') 
        {
          continue;
        }

        mediaIndex++;

        if (m.port === 0 && mediaIndex == 1) 
        {
          this._remoteToAudio = true;
          this._remoteToVideo = false;
          this._ontogglemode('audio');
        }
        else 
        {
          this._remoteToAudio = false;
          this._remoteToVideo = true;
          this._ontogglemode('video');
        }
      }

      const newSdp = this._sdpAddMid(response.body);
      const e = { originator: 'remote', type: 'answer', sdp: newSdp };

      logger.debug(`${this._id} emit "sdp"`);
      this.emit('sdp', e);

      const answer = new RTCSessionDescription({ type: 'answer', sdp: e.sdp });

      this._connectionPromiseQueue = this._connectionPromiseQueue
        .then(() => this._connection.setRemoteDescription(answer))
        .then(() => 
        {
          if (eventHandlers.succeeded) 
          {
            eventHandlers.succeeded(response);
          }
        })
        .catch((error) => 
        {
          onFailed.call(this);

          emitSetRemoteDescriptionFailed(this, error);
        });
    }

    function onFailed(response) 
    {
      if (eventHandlers.failed) 
      {
        eventHandlers.failed(response);
      }
    }
  }

  /**
   * Send UPDATE
   */
  _sendUpdate(options = {}) 
  {
    logger.debug(`${this._id} sendUpdate()`);

    const extraHeaders = Utils.cloneArray(options.extraHeaders);
    const eventHandlers = Utils.cloneObject(options.eventHandlers);
    const rtcOfferConstraints = options.rtcOfferConstraints ||
      this._rtcOfferConstraints || null;
    const sdpOffer = options.sdpOffer || false;

    let succeeded = false;

    extraHeaders.push(`Contact: ${this._contact}`);

    // 5G Headers
    push5GServiceHeaders(extraHeaders, this._ua);

    // Session Timers.
    if (this._sessionTimers.running) 
    {
      extraHeaders.push(`Session-Expires: ${this._sessionTimers.currentExpires};refresher=${this._sessionTimers.refresher ? 'uac' : 'uas'}`);
    }

    if (sdpOffer) 
    {
      extraHeaders.push('Content-Type: application/sdp');

      this._connectionPromiseQueue = this._connectionPromiseQueue
        .then(() => this._createLocalDescription('offer', rtcOfferConstraints))
        .then((sdp) => 
        {
          sdp = this._mangleOffer(sdp);

          const e = { originator: 'local', type: 'offer', sdp };

          this._bfcp.enabled && (e.sdp = this._bfcp.replaceDataChannelMediaWithBFCP(e.sdp));

          logger.debug(`${this._id} emit "sdp"`);
          this.emit('sdp', e);

          this.sendRequest(CRTC_C.UPDATE, {
            extraHeaders,
            body          : sdp,
            eventHandlers : {
              onSuccessResponse : (response) => 
              {
                onSucceeded.call(this, response);
                succeeded = true;
              },
              onErrorResponse : (response) => 
              {
                onFailed.call(this, response);
              },
              onTransportError : () => 
              {
                this.onTransportError(); // Do nothing because session ends.
              },
              onRequestTimeout : () => 
              {
                this.onRequestTimeout(); // Do nothing because session ends.
              },
              onDialogError : () => 
              {
                this.onDialogError(); // Do nothing because session ends.
              }
            }
          });
        })
        .catch(() => 
        {
          onFailed.call(this);
        });
    }
    // No SDP.
    else 
    {
      this.sendRequest(CRTC_C.UPDATE, {
        extraHeaders,
        eventHandlers : {
          onSuccessResponse : (response) => 
          {
            onSucceeded.call(this, response);
          },
          onErrorResponse : (response) => 
          {
            onFailed.call(this, response);
          },
          onTransportError : () => 
          {
            this.onTransportError(); // Do nothing because session ends.
          },
          onRequestTimeout : () => 
          {
            this.onRequestTimeout(); // Do nothing because session ends.
          },
          onDialogError : () => 
          {
            this.onDialogError(); // Do nothing because session ends.
          }
        }
      });
    }

    function onSucceeded(response) 
    {
      if (this._status === C.STATUS_TERMINATED) 
      {
        return;
      }

      // If it is a 2XX retransmission exit now.
      if (succeeded) { return; }

      // 单向视频将收到的sdp内packetization-mode=1改为0
      // if (response.body && rtcOfferConstraints.offerToReceiveVideo === false)
      // {
      //   response.body = response.body.replace(/packetization-mode=1/g, 'packetization-mode=0');
      // }

      // Handle Session Timers.
      this._handleSessionTimersInIncomingResponse(response);

      // Must have SDP answer.
      if (sdpOffer) 
      {
        if (!response.body) 
        {
          logger.warn(`${this._id} no body.`);
          onFailed.call(this);

          return;
        }
        else if (!response.hasHeader('Content-Type') || response.getHeader('Content-Type').toLowerCase() !== 'application/sdp') 
        {
          logger.warn(`${this._id} not sdp.`);
          onFailed.call(this);

          return;
        }

        let sdp = response.body;

        // 适配特殊情况，本端切视频远端没有 video 0 的问题
        if (this._localToAudio) 
        {
          sdp = Utils.ensureVideoSdpAttrs(sdp);
        }

        /**
         * 音视频切换相关
         * 远端接听模式
         * @author: lei
         */
        const sdp_body = sdp_transform.parse(sdp);

        for (const m of sdp_body.media) 
        {
          if (m.type == 'audio') 
          {
            continue;
          }

          if (m.port !== 0) 
          {
            this._remoteToAudio = false;
            this._remoteToVideo = true;
            this._ontogglemode('video');
          }
          else 
          {
            this._remoteToAudio = true;
            this._remoteToVideo = false;
            this._ontogglemode('audio');
          }
        }

        const newSdp = this._sdpAddMid(sdp);
        const e = { originator: 'remote', type: 'answer', sdp: newSdp };

        logger.debug(`${this._id} emit "sdp"`);
        this.emit('sdp', e);

        const answer = new RTCSessionDescription({ type: 'answer', sdp: e.sdp });

        this._connectionPromiseQueue = this._connectionPromiseQueue
          .then(() => this._connection.setRemoteDescription(answer))
          .then(() => 
          {
            if (eventHandlers.succeeded) 
            {
              eventHandlers.succeeded(response);
            }
          })
          .catch((error) => 
          {
            onFailed.call(this);

            emitSetRemoteDescriptionFailed(this, error);
          });
      }
      // No SDP answer.
      else if (eventHandlers.succeeded) 
      {
        eventHandlers.succeeded(response);
      }
    }

    function onFailed(response) 
    {
      if (eventHandlers.failed) { eventHandlers.failed(response); }
    }
  }

  _acceptAndTerminate(response, status_code, reason_phrase) 
  {
    logger.debug(`${this._id} acceptAndTerminate()`);

    const extraHeaders = [];

    if (status_code) 
    {
      reason_phrase = reason_phrase || CRTC_C.REASON_PHRASE[status_code] || '';
      extraHeaders.push(`Reason: SIP ;cause=${status_code}; text="${reason_phrase}"`);
    }

    // An error on dialog creation will fire 'failed' event.
    if (this._dialog || this._createDialog(response, 'UAC')) 
    {
      this.sendRequest(CRTC_C.ACK);
      this.sendRequest(CRTC_C.BYE, {
        extraHeaders
      });
    }

    // Update session status.
    this._status = C.STATUS_TERMINATED;
  }

  /**
   * Correctly set the SDP direction attributes if the call is on local hold
   */
  _mangleOffer(sdp) 
  {

    if (!this._localHold && !this._remoteHold) 
    {
      return sdp;
    }

    sdp = sdp_transform.parse(sdp);

    // Local hold.
    if (this._localHold && !this._remoteHold) 
    {
      logger.debug(`${this._id} mangleOffer() | me on hold, mangling offer`);
      for (const m of sdp.media) 
      {
        if (holdMediaTypes.indexOf(m.type) === -1) 
        {
          continue;
        }
        if (!m.direction) 
        {
          m.direction = 'sendonly';
        }
        else if (m.direction === 'sendrecv') 
        {
          m.direction = 'sendonly';
        }
        else if (m.direction === 'recvonly') 
        {
          m.direction = 'inactive';
        }
      }
    }
    // Local and remote hold.
    else if (this._localHold && this._remoteHold) 
    {
      logger.debug(`${this._id} mangleOffer() | both on hold, mangling offer`);
      for (const m of sdp.media) 
      {
        if (holdMediaTypes.indexOf(m.type) === -1) 
        {
          continue;
        }
        m.direction = 'inactive';
      }
    }
    // Remote hold.
    else if (this._remoteHold) 
    {
      logger.debug(`${this._id} mangleOffer() | remote on hold, mangling offer`);
      for (const m of sdp.media) 
      {
        if (holdMediaTypes.indexOf(m.type) === -1) 
        {
          continue;
        }
        if (!m.direction) 
        {
          m.direction = 'recvonly';
        }
        else if (m.direction === 'sendrecv') 
        {
          m.direction = 'recvonly';
        }
        else if (m.direction === 'recvonly') 
        {
          m.direction = 'inactive';
        }
      }
    }

    return sdp_transform.write(sdp);
  }

  _setLocalMediaStatus() 
  {
    let enableAudio = true, enableVideo = true;

    if (this._localHold || this._remoteHold) 
    {
      enableAudio = false;
      enableVideo = false;
    }

    if (this._audioMuted) 
    {
      enableAudio = false;
    }

    if (this._videoMuted) 
    {
      enableVideo = false;
    }

    this._toggleMuteAudio(!enableAudio);
    this._toggleMuteVideo(!enableVideo);
  }

  // 如果是音频模式，则关闭本地视频
  _setLocalMedia(mode) 
  {
    logger.debug(`${this._id} setLocalMedia() ${mode}`);

    if (mode === 'audio' && (this._customMediaStream === false)) 
    {
      this._localMediaStream.getVideoTracks().forEach((track) => 
      {
        track.stop();
        this._localMediaStream.removeTrack(track);
      });

      // 切换为音频通话仍应允许用户继续共享屏幕。这里只停止历史“替换摄像头”
      // 共享轨；独立辅流由 unShare() 或系统停止共享事件单独管理。
      if (!this._auxiliaryShareActive && !this._auxiliaryShareStarting)
      {
        this._localShareStream && this._localShareStream.getVideoTracks().forEach((track) =>
        {
          track.stop();
        });
      }
    }
  }

  _streamInactiveHandle(dual) 
  {
    let ended = false;

    const mediaStreamTrackEndedHandler = () => 
    {
      if (this._localShareStream && this._localShareStreamLocallyGenerated) 
      {
        if (dual) 
        {
          this._connection.getTransceivers().forEach((transeiver) => 
          {
            if (transeiver.sender.track && transeiver.sender.track.kind === 'video') 
            {
              if (transeiver.sender.track.id === this._localShareStream.getVideoTracks()[0].id) 
              {
                this._connection.connectionState === 'connected' && transeiver.sender.replaceTrack(this._bfcp.videoTrack);
              }
            }
          });

          this._localShareStream = null;
          this._localShareStreamLocallyGenerated = false;

          // BFCP 释放资源，当被取消权限以后不再用发送release
          this._bfcp.requestStatus !== RequestStatusValue.Revoked && this._bfcp.sendFloorRelease();
        }
        else 
        {
          this._localMediaStream.getVideoTracks().forEach((track) => 
          {
            const sender = this._connection.getSenders().find((s) => 
            {
              return s.track.kind == 'video' && (s.track.label.indexOf('window') === -1 || s.track.label.indexOf('web-') === -1 || s.track.label.indexOf('screen') === -1);
            });

            track.readyState === 'live' && this._connection.connectionState === 'connected' && sender.replaceTrack(track);
          });

          this._localShareStreamLocallyGenerated = false;
        }

        this._localShareStream = null;
        this._localShareStreamLocallyGenerated = false;
        if (this._shareMode === 'legacy') this._shareMode = null;
      }
    };

    // safari 等场景ended 或者 inactive 事件不会触发
    const timer = setInterval(() => 
    {
      if (this._localShareStream && this._localShareStream.getVideoTracks() && this._localShareStream.getVideoTracks()[0].readyState === 'ended') 
      {
        clearInterval(timer);
        ended || mediaStreamTrackEndedHandler();
        ended = true;
      }
    }, 200);

    // 分享屏幕点击系统停止按钮后停止分享
    this._localShareStream.getVideoTracks()[0].addEventListener('ended', () => 
    {
      ended || mediaStreamTrackEndedHandler();
      ended = true;
    });

    this._localShareStream.addEventListener('inactive', () => 
    {
      ended || mediaStreamTrackEndedHandler();
      ended = true;
    });
  }

  /**
   * Handle SessionTimers for an incoming INVITE or UPDATE.
   * @param  {IncomingRequest} request
   * @param  {Array} responseExtraHeaders  Extra headers for the 200 response.
   */
  _handleSessionTimersInIncomingRequest(request, responseExtraHeaders) 
  {
    if (!this._sessionTimers.enabled) { return; }

    let session_expires_refresher;

    if (request.session_expires && request.session_expires >= CRTC_C.MIN_SESSION_EXPIRES) 
    {
      this._sessionTimers.currentExpires = request.session_expires;
      session_expires_refresher = request.session_expires_refresher || 'uas';
    }
    else 
    {
      this._sessionTimers.currentExpires = this._sessionTimers.defaultExpires;
      session_expires_refresher = 'uas';
    }

    responseExtraHeaders.push(`Session-Expires: ${this._sessionTimers.currentExpires};refresher=${session_expires_refresher}`);

    this._sessionTimers.refresher = (session_expires_refresher === 'uas');
    this._runSessionTimer();
  }

  /**
   * Handle SessionTimers for an incoming response to INVITE or UPDATE.
   * @param  {IncomingResponse} response
   */
  _handleSessionTimersInIncomingResponse(response) 
  {
    if (!this._sessionTimers.enabled) { return; }

    let session_expires_refresher;

    if (response.session_expires &&
      response.session_expires >= CRTC_C.MIN_SESSION_EXPIRES) 
    {
      this._sessionTimers.currentExpires = response.session_expires;
      session_expires_refresher = response.session_expires_refresher || 'uac';
    }
    else 
    {
      this._sessionTimers.currentExpires = this._sessionTimers.defaultExpires;
      session_expires_refresher = 'uac';
    }

    this._sessionTimers.refresher = (session_expires_refresher === 'uac');
    this._runSessionTimer();
  }

  _runSessionTimer() 
  {
    const expires = this._sessionTimers.currentExpires;

    this._sessionTimers.running = true;

    clearTimeout(this._sessionTimers.timer);

    // I'm the refresher.
    if (this._sessionTimers.refresher) 
    {
      this._sessionTimers.timer = setTimeout(() => 
      {
        if (this._status === C.STATUS_TERMINATED) { return; }

        if (!this._isReadyToReOffer()) { return; }

        logger.debug(`${this._id} runSessionTimer() | sending session refresh request`);

        if (this._sessionTimers.refreshMethod === CRTC_C.UPDATE) 
        {
          this._sendUpdate();
        }
        else 
        {
          this._sendReinvite();
        }
      }, expires * 500); // Half the given interval (as the RFC states).
    }

    // I'm not the refresher.
    else 
    {
      this._sessionTimers.timer = setTimeout(() => 
      {
        if (this._status === C.STATUS_TERMINATED) { return; }

        logger.warn(`${this._id} runSessionTimer() | timer expired, terminating the session`);

        this.terminate({
          cause         : CRTC_C.causes.REQUEST_TIMEOUT,
          status_code   : 408,
          reason_phrase : 'Session Timer Expired'
        });
      }, expires * 1100);
    }
  }

  _toggleMuteAudio(mute) 
  {
    const senders = this._connection.getSenders().filter((sender) => 
    {
      return sender.track && sender.track.kind === 'audio';
    });

    for (const sender of senders) 
    {
      sender.track.enabled = !mute;
    }
  }

  _toggleMuteVideo(mute) 
  {
    const senders = this._connection.getSenders().filter((sender) => 
    {
      // video mute 代表关闭摄像头画面，不代表停止屏幕共享。辅流必须保持 enabled，
      // 否则远端会看到冻结画面但收不到 remoteUnShared，造成媒体状态不一致。
      if (sender === this._localShareRTPSender) return false;

      if (this._bfcp.enabled) 
      {
        // 检查是否存在视频轨道
        if (!sender.track || sender.track.kind !== 'video') 
        {
          return false;
        }

        // 获取本地共享流的视频轨道ID
        let localShareTrackId = null;

        if (this._localShareStream &&
          this._localShareStream.getVideoTracks() &&
          this._localShareStream.getVideoTracks()[0]) 
        {
          localShareTrackId = this._localShareStream.getVideoTracks()[0].id;
        }

        // 验证视频轨道条件
        return !this._bfcp._isCanvasTrack(sender.track)
          && sender.track !== this._bfcp.videoTrack
          && sender.track.id !== localShareTrackId;
      }

      return sender.track && sender.track.kind === 'video';
    });

    for (const sender of senders) 
    {
      if (this._videoOnlyMute) 
      {
        if (this._isCurrentlyMuted === mute) return;
        this._isCurrentlyMuted = mute;
        if (mute) 
        {
          if (!this._onMutedVideoTrack) 
          {
            this._onMutedVideoTrack = sender.track;
            this._replaceMutedCanvasTrack = Utils.generateAnBlackVideoTrack({ svgSource: CRTC_C.NO_CAMERA_SVG, width: 640, height: 480, fps: 25 });
            sender.replaceTrack(this._replaceMutedCanvasTrack.videoTrack);
          }
        }
        else 
        {
          sender.replaceTrack(this._onMutedVideoTrack);
          this._replaceMutedCanvasTrack.cleanup();
          setTimeout(() => 
          {
            this._onMutedVideoTrack = null;
            this._replaceMutedCanvasTrack = null;
          }, 0);
        }
      }
      else 
      {
        sender.track.enabled = !mute;
        this._isCurrentlyMuted = mute;
      }
    }
  }

  _newRTCSession(originator, request) 
  {
    logger.debug(`${this._id} newRTCSession()`);

    this._ua.newRTCSession(this, {
      originator,
      session : this,
      request
    });
  }

  _connecting(request) 
  {
    logger.debug(`${this._id} session connecting`);

    logger.debug(`${this._id} emit "connecting"`);

    this.emit('connecting', {
      request
    });
  }

  _trying(response) 
  {
    logger.debug(`${this._id} session trying`);

    logger.debug(`${this._id} emit "trying"`);

    this.emit('trying', {
      response : response || null
    });
  }

  _progress(originator, response) 
  {
    logger.debug(`${this._id} session progress`);

    logger.debug(`${this._id} emit "progress"`);

    this.emit('progress', {
      originator,
      response : response || null
    });
  }

  _accepted(originator, message) 
  {
    logger.debug(`${this._id} session accepted`);

    this._start_time = new Date();

    logger.debug(`${this._id} emit "accepted"`);

    this.emit('accepted', {
      originator,
      response : message || null
    });

    // 远端支持视频模式，触发回调
    if (originator !== 'local' && /(^|[;>])\s*\+?video\s*([;=]|$)/i.test(message.getHeader('contact'))) 
    {
      logger.debug('remoteSupportsVideo');
      this.emit('remoteSupportsVideo', true);
    }
    
    this._remoteSupportsVideo && this.emit('remoteSupportsVideo', this._remoteSupportsVideo);
  }

  _confirmed(originator, ack) 
  {
    logger.debug(`${this._id} session confirmed`);

    this._is_confirmed = true;

    // 如果是SDK调用媒体设备，则启动媒体状态监测,停用媒体状态检测
    // this._localMediaStreamLocallyGenerated && this._checkMediaStreamStatus();

    logger.debug(`${this._id} emit "confirmed"`);

    // 主动发送关键帧，兼容部分手机接听时黑屏问题
    Utils.sendKeyFrames(this._connection, 0.5, 2);
    
    this._startVideoFrameRateMonitor();

    this._connection.getSenders().forEach((sender) => 
    {
      if (sender.track && sender.track.kind === 'video') 
      {
        sender.track.contentHint = 'detail';
      }
    });


    // 初始设置码率，并每2秒重试，共设置3次（部分浏览器可能在接通后重置编码参数）
    // 鸿蒙微信/鸿蒙浏览器/安卓微信除外
    if (!Utils.shouldRecoverVideoFrameRateByUA()) 
    {
      this._applyVideoMaxBitrate();
 
      let maxBitrateRetryCount = 0;

      this._maxBitrateRetryTimer = setInterval(() => 
      {
        maxBitrateRetryCount++;
        if (maxBitrateRetryCount >= 2) 
        {
          clearInterval(this._maxBitrateRetryTimer);
          this._maxBitrateRetryTimer = null;
        }
        this._applyVideoMaxBitrate();
      }, 2000);
    }

    this.emit('confirmed', {
      originator,
      ack : ack || null
    });
  }

  _ended(originator, message, cause) 
  {
    logger.debug(`${this._id} session ended`);

    this._end_time = new Date();
    this._stopVideoFrameRateMonitor();
    this._clearMaxBitrateRetryTimer();
    
    this._close();

    logger.debug(`${this._id} emit "ended"`);

    this.emit('ended', {
      originator,
      message : message || null,
      cause
    });

    if (this._inviteVideoTrackStatsTimer) 
    {
      clearInterval(this._inviteVideoTrackStatsTimer);
    }

    if (this._answerVideoTrackStatsTimer) 
    {
      clearInterval(this._answerVideoTrackStatsTimer);
    }
  }

  _failed(originator, message, cause) 
  {
    logger.debug(`${this._id} session failed`);
    this._stopVideoFrameRateMonitor();

    // Emit private '_failed' event first.
    logger.debug(`${this._id} emit "_failed"`);

    this.emit('_failed', {
      originator,
      message : message || null,
      cause
    });

    this._close();

    logger.debug(`${this._id} emit "failed"`);

    this.emit('failed', {
      originator,
      message : message || null,
      cause
    });
  }

  _onhold(originator) 
  {
    logger.debug(`${this._id} session onhold`);

    this._setLocalMediaStatus();

    logger.debug(`${this._id} emit "hold"`);

    this.emit('hold', {
      originator
    });
  }

  _onunhold(originator) 
  {
    logger.debug(`${this._id} session onunhold`);

    this._setLocalMediaStatus();

    logger.debug(`${this._id} emit "unhold"`);

    this.emit('unhold', {
      originator
    });
  }

  _onmute({ audio, video }) 
  {
    logger.debug(`${this._id} session onmute`);

    this._setLocalMediaStatus();

    logger.debug(`${this._id} emit "muted"`);

    this.emit('muted', {
      audio,
      video
    });
  }

  _onunmute({ audio, video }) 
  {
    logger.debug(`${this._id} session onunmute`);

    this._setLocalMediaStatus();

    logger.debug(`${this._id} emit "unmuted"`);

    this.emit('unmuted', {
      audio,
      video
    });
  }

  // 切换音视频模式触发 mode 事件
  _ontogglemode(mode) 
  {
    logger.debug(`${this._id} ontogglemode() ${mode} ${this._mode}`);

    if (mode === this._mode) 
    {
      return;
    }

    this._mode = mode;
    this._markStatsTransition('mode-change');

    logger.debug(`${this._id} session ontogglemode`);

    if (!this._remoteHold) 
    {
      this._setLocalMedia(mode);
    }

    logger.debug(`${this._id} emit "mode"`);

    this.emit('mode', { mode });
  }

  // sdp 中增加 mid 属性
  _sdpAddMid(sdp)
  {
    logger.debug(`${this._id} _sdpAddMid()`);
    if (sdp.indexOf('a=mid:') !== -1)
    {
      return sdp;
    }

    const lSdp =
      this.connection &&
      this.connection.localDescription &&
      this.connection.localDescription.sdp;

    const mids = [];

    if (lSdp) 
    {
      const parts = lSdp.split('\r\nm=');

      parts.slice(1).forEach((p) => 
      {
        const m = p.match(/\r\na=mid:([^\r\n]+)/);

        mids.push(m ? m[1] : null);
      });
    }

    let index = 0;
    const newSdp = sdp.replace(/(^m=[^\r\n]+)/gm, function(match) 
    {
      const mid = mids[index] !== null && mids[index] !== undefined
        ? mids[index]
        : String(index);

      index++;

      return `${match}\r\na=mid:${mid}`;
    });

    return newSdp;
  }

  _monitorLocalVideoTrackStates(stream, timerField)
  {
    const videoTrackStates = new Map();

    stream.getTracks().forEach((track) =>
    {
      const trackObj = `id:${track.id} enabled:${track.enabled} readyState:${track.readyState} muted:${track.muted} label:${track.label}`;

      logger.debug(`${this._id} local ${track.kind} track state: ${JSON.stringify(trackObj)} ***** settings: ${JSON.stringify(track.getSettings())} ***** constraints: ${JSON.stringify(track.getConstraints())} ***** capabilities: ${JSON.stringify(track.getCapabilities ? track.getCapabilities() : {})}`);
      this[timerField] = setInterval(() =>
      {
        if (track.kind !== 'video') return;
        if (!videoTrackStates.has(track.id))
        {
          logger.debug(`${this._id} ${track.id} enabled: ${track.enabled}, readyState: ${track.readyState}, muted: ${track.muted}, label: ${track.label}`);
          videoTrackStates.set(track.id, { enabled: track.enabled, readyState: track.readyState, muted: track.muted, label: track.label });

          return;
        }
        const trackStat = videoTrackStates.get(track.id);

        if (track.enabled != trackStat.enabled)
        {
          trackStat.enabled = track.enabled;
          this.emit('videoTrackState', { track, properties: 'enabled', value: track.enabled });
          logger.debug(`${this._id} ${track.id} videoTrackState enabled: ${track.enabled}`);
        }

        if (track.readyState != trackStat.readyState)
        {
          trackStat.readyState = track.readyState;
          this.emit('videoTrackState', { track, properties: 'readyState', value: track.readyState });
          logger.debug(`${this._id} ${track.id} videoTrackState readyState: ${track.readyState}`);
        }

        if (track.muted != trackStat.muted || track.mute == true)
        {
          trackStat.muted = track.muted;
          this.emit('videoTrackState', { track, properties: 'muted', value: track.muted });
          logger.debug(`${this._id} ${track.id} videoTrackState muted: ${track.muted}`);
        }

        if (track.label != trackStat.label)
        {
          trackStat.label = track.label;
          this.emit('videoTrackState', { track, properties: 'label', value: track.label });
          logger.debug(`${this._id} ${track.id} videoTrackState label: ${track.label}`);
        }
      }, 1000);
    });
  }

  _logEventError(level, eventName, error)
  {
    const loggerMethod = logger[level] || logger.warn;
    const errorMessage = getErrorMessage(error);

    loggerMethod(`${this._id} emit "${eventName}" [error:%o]`, error);
    loggerMethod(`${this._id} emit "${eventName}" ${errorMessage} ${JSON.stringify(error)}`);
  }

  /**
   * 内部方法：接收上游和各媒体的异常报告，统一发出 'mediaEffectsIssue' 事件。
   *
   * ## 数据流路径
   *
   * 整个异常上报链是：
   *
   *   最底层组件（_reportIssue）
   *     → 中层组件（_reportIssue/_handleIssue）
   *       → MediaEffectsComposer._recordIssue（统一汇聚，缓存到 _issues）
   *         → MediaPipeline.emitMediaEffectsIssue（桥接）
   *           → RTCSession._emitMediaEffectsIssue（本方法）
   *             → this.emit('mediaEffectsIssue', payload)
   *               → 业务层 session.on('mediaEffectsIssue', handler)
   *
   * ## 事件负载
   *
   * 发出的 payload 只包含 2 个字段，保护内部状态：
   * - module: 问题所属模块（如 'AiNS', 'MediaEffectsComposer'）
   * - message: 问题描述
   *
   * 更详细的 component / stage / details 等诊断信息由下层模块自行记录到 logger，
   * RTCSession 这里只负责对外转发最小事件。
   *
   * ## 设计目标
   *
   * 业务侧可通过 session.on('mediaEffectsIssue', handler) 监听异常事件，
   * 用于：
   * - 用户体验：在 UI 上提示"美颜/降噪功能异常，已降级处理"
   * - 监控告警：将事件上报到监控系统
   * - 问题排查：结合各模块 logger 定位问题根因
   *
   * @param {Object} [issue] - 异常描述对象
   * @param {string} issue.module - 问题所属模块
   * @param {string} issue.severity - 严重级别 ('debug'|'warn'|'error')
   * @param {string} issue.message - 问题描述
   */
  _emitMediaEffectsIssue(issue)
  {
    const normalizedIssue = issueUtils.normalizeIssue(MEDIA_EFFECTS_ISSUE_DEFAULTS, issue);
    const payload = {
      module  : normalizedIssue.module,
      message : normalizedIssue.message
    };

    logger.debug(`${this._id} emit "mediaEffectsIssue": module=${normalizedIssue.module} message=${normalizedIssue.message}`);
   
    this.emit('mediaEffectsIssue', payload);
  }

  _logOperationError(level, prefix, error)
  {
    const loggerMethod = logger[level] || logger.warn;
    const errorMessage = getErrorMessage(error);

    loggerMethod(`${this._id} ${prefix} [error:%o]`, error);
    loggerMethod(`${this._id} ${prefix} ${errorMessage} ${JSON.stringify(error)}`);
  }

  /**
   * 生成一个空的音频轨道
   */
  _generateAnEmptyAudioTrack() 
  {
    // 增加安卓微信呼叫的语音提醒
    // const audio = new Audio('./sound/waiting.mp3');
    const audio = new Audio();
    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();
    const source = audioCtx.createMediaElementSource(audio);

    audio.loop = true;
    audio.crossOrigin = 'anonymous';
    audio.play().catch((error) => { this._logOperationError('error', 'new Audio() error', error); });
    source.connect(destination);

    return destination.stream.getAudioTracks()[0];
  }

  /**
   * 将临时的音频恢复为麦克风audioTrack
   */
  _replaceAudioToMic() 
  {
    // 获取麦克风流，成功后替换canvas视频，失败后重新获取麦克风媒体并替换
    navigator.mediaDevices.getUserMedia(this._mediaPipeline.getGumConstraintsWithProcessorFlags({ 
      audio : this._inviteMediaConstraints.audio || true, 
      video : false 
    }))
      .then(async(stream) =>
      {
        stream = await this._mediaPipeline.replaceAudioTrackWithSessionAiNoiseSuppression(stream);
        this._connection.getSenders().forEach((sender) => 
        {
          if (sender.track && sender.track.kind == 'audio') 
          {
            // 保持媒体的muted状态
            stream.getAudioTracks()[0].enabled = this.isMuted().audio;

            // 替换音频轨道
            sender.replaceTrack(stream.getAudioTracks()[0]);

            // 本地播放本地音频轨道
            this._localMediaStream.removeTrack(this._localMediaStream.getAudioTracks()[0]);
            this._localMediaStream.addTrack(stream.getAudioTracks()[0]);

            // 触发本地媒体更新事件
            this.emit('localMediastreamUpdate', this._localMediaStream);

            // 继续监听mute和ended事件
            stream.getAudioTracks()[0].addEventListener('mute', this._boundReplaceMicToAudios);
            stream.getAudioTracks()[0].addEventListener('ended', this._boundReplaceMicToAudios);
          }
        });
      })
      .catch((error) => 
      {
        // 获取麦克风失败，重新获取
        this._logOperationError('error', 'replaceAudioToMic error', error);
        this._replaceAudioToMic();
      });
  }

  /**
   * 先将原来麦克风audioTrack替换为audio音频，并关闭原来audioTrack释放麦克风
   */
  _replaceMicToAudio() 
  {
    // 判断是否在通话中
    if (!this.isEstablished()) 
    {
      return;
    }

    this._connection.getSenders().forEach((sender) => 
    {
      if (sender.track && sender.track.kind == 'audio') 
      {
        // TODO: 可能多次触发事件
        // 清除事件绑定
        sender.track.removeEventListener('mute', this._boundReplaceMicToAudios);
        sender.track.removeEventListener('ended', this._boundReplaceMicToAudios);

        // 释放麦克风
        sender.track.stop();

        // 替换音频轨道
        sender.replaceTrack(this._generateAnEmptyAudioTrack());

        // 本地播放本地音频轨道
        this._localMediaStream.removeTrack(this._localMediaStream.getVideoTracks()[0]);
        this._localMediaStream.addTrack(this._generateAnEmptyAudioTrack());

        // 触发本地媒体更新事件
        this.emit('localMediastreamUpdate', this._localMediaStream);

        // 开始尝试获取麦克风体并恢复
        this._replaceAudioToMic();
      }
    });
  }

  /**
   * 将临时的canvas视频恢复为摄像头videoTrack
   */
  _replaceCanvasToVideo() 
  {
    // 获取摄像头流，成功后替换canvas视频，失败后重新获取摄像头媒体并替换
    // 摄像头恢复与普通取流保持同一条处理链，避免恢复后绕过虚拟背景/AI 降噪/合成配置。
    this._mediaPipeline.getUserMediaWithSessionPipeline(
      { audio: false, video: this._inviteMediaConstraints.video || true },
      this._sessionMediaEffectsComposerOptions
    )
      .then((stream) => 
      {
        this._connection.getSenders().forEach((sender) => 
        {
          if (sender.track && sender.track.kind == 'video') 
          {
            // 停止绘制并清空画布
            window.cancelAnimationFrame(this._restoreCameraTrackDraw);
            this._restoreCameraTrackCtx.clearRect(0, 0, this._inviteMediaConstraints.width || 640, this._inviteMediaConstraints.height || 480);
            // 保持媒体的muted状态
            stream.getVideoTracks()[0].enabled = this.isMuted().video;
            // 替换视频轨道
            sender.replaceTrack(stream.getVideoTracks()[0]);

            // 本地播放本地视频轨道
            this._localMediaStream.removeTrack(this._localMediaStream.getVideoTracks()[0]);
            this._localMediaStream.addTrack(stream.getVideoTracks()[0]);

            // 触发本地媒体更新事件
            this.emit('localMediastreamUpdate', this._localMediaStream);

            // 继续监听mute和ended事件
            sender.track.addEventListener('mute', this._boundReplaceVideoToCanvas);
            sender.track.addEventListener('ended', this._boundReplaceVideoToCanvas);
          }
        });
      })
      .catch((error) => 
      {
        // 获取摄像头失败，重新获取
        this._logOperationError('error', 'replaceCanvasToVideo error', error);
        this._replaceCanvasToVideo();
      });
  }

  /**
   * 先将原来videoTrack替换为canvas视频，并关闭原来videoTrack
   */
  _replaceVideoToCanvas() 
  {
    logger.debug(`${this._id} _replaceVideoToCanvas()`);

    // 判断是否在通话中
    if (!this.isEstablished()) 
    {
      return;
    }

    // 创建画布
    this._restoreCameraTrackCanvas = document.createElement('canvas');
    this._restoreCameraTrackCanvas.setAttribute('style', 'disable:none');
    this._restoreCameraTrackCtx = this._restoreCameraTrackCanvas.getContext('2d');

    // 开始绘制纯色
    const drawToCanvas = () => 
    {
      this._restoreCameraTrackCanvas.width = this._inviteMediaConstraints.width || 640;
      this._restoreCameraTrackCanvas.height = this._inviteMediaConstraints.height || 480;
      this._restoreCameraTrackCtx.fillStyle = 'blue';
      this._restoreCameraTrackCtx.fillRect(0, 0, this._inviteMediaConstraints.width || 640, this._inviteMediaConstraints.height || 480);
      this._restoreCameraTrackDraw = window.requestAnimationFrame(drawToCanvas);
    };

    drawToCanvas();

    // 从画布获取15fps视频流
    const newStream = this._restoreCameraTrackCanvas.captureStream(15);

    this._connection.getSenders().forEach((sender) => 
    {
      // eslint-disable-next-line no-undef
      if (sender.track && sender.track.kind == 'video' && (sender.track.readyState === 'ended' || sender.track.muted === true) && !(sender.track instanceof MediaStreamTrackGenerator)) 
      {
        // TODO: 可能多次触发事件
        // 清除事件绑定
        sender.track.removeEventListener('mute', this._boundReplaceVideoToCanvas);
        sender.track.removeEventListener('ended', this._boundReplaceVideoToCanvas);

        // 释放摄像头
        sender.track.stop();
        // 替换视频轨道
        sender.replaceTrack(newStream.getVideoTracks()[0]);
        // 本地播放本地视频轨道
        this._localMediaStream.removeTrack(this._localMediaStream.getVideoTracks()[0]);
        this._localMediaStream.addTrack(newStream.getVideoTracks()[0]);
        // 触发本地媒体更新事件
        this.emit('localMediastreamUpdate', this._localMediaStream);
        // 开始尝试获取摄像头媒体并恢复
        this._replaceCanvasToVideo();
      }
    });
  }

  /**
   * 检查媒体轨道是否异常并处理
   */
  _checkMediaStreamStatus() 
  {
    let timer = null;

    // 监听系统音视频设备变化替换媒体轨道，如：蓝牙耳机、外接摄像头等
    navigator.mediaDevices.ondevicechange = () => 
    {
      if (timer) { clearTimeout(timer); }
      timer = setTimeout(() => 
      {
        timer = null;

        // 如果设备变化则替换轨道流
        this._connection.getSenders().forEach((sender) => 
        {
          // 视频轨道
          if (sender.track && sender.track.kind === 'video') 
          {
            this._replaceVideoToCanvas();
          }
          // 音频轨道
          else if (sender.track && sender.track.kind === 'audio') 
          {
            this._replaceMicToAudio();
          }
        });
      }, 300);
    };

    // 先判断现在PC里面的媒体是否已经是muted
    this._connection.getSenders().forEach((sender) => 
    {
      // 视频轨道
      if (sender.track && sender.track.kind === 'video' && sender.track instanceof MediaStreamTrack) 
      {
        if (sender.track && sender.track.muted) 
        {
          this._replaceVideoToCanvas();
        }
        else if (sender.track instanceof MediaStreamTrack) 
        {
          // iOS Safari 按 HOME 切后台，会触发两次 mute 和 unmute
          // mute 事件触发替换视频流为临时视频，并释放摄像头
          sender.track.addEventListener('mute', this._boundReplaceVideoToCanvas);
          sender.track.addEventListener('ended', this._boundReplaceVideoToCanvas);
        }
      }
      // 音频轨道
      else if (sender.track && sender.track.kind === 'audio') 
      {
        if (sender.track && sender.track.muted) 
        {
          this._replaceMicToAudio();
        }
        else 
        {
          // mute 事件触发替换视频流为临时空音频，并释放麦克风
          sender.track.addEventListener('mute', this._boundReplaceMicToAudios);
          sender.track.addEventListener('ended', this._boundReplaceMicToAudios);
        }
      }
    });
  }


  /**
   * 监听页面切后台媒体muted切换为1fps的黑屏
   */
  _initVisibilityChangeHandler() 
  {
    this._visibilitychangeVideoTrack = null;
    this._blackVideoTrack = null;
    this._trackMutedTimer = null;

    const handleVisibilityChange = () => 
    {
      const conn = this._connection;

      if (!conn || conn.connectionState !== 'connected' || !this._is_confirmed || this._bfcp.enabled)
        return;

      if (document.hidden) 
      {
        this._handlePageHidden(conn);
      }
      else 
      {
        this._handlePageVisible(conn);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  /**
   * 启动视频帧率监控。
   *
   * 仅在需要纠偏的 UA 环境下生效（由 Utils.shouldRecoverVideoFrameRateByUA 判断）。
   * 先将帧率约束设为 30fps，之后每 2 秒检查一次，若帧率异常则重新应用约束。
   */
  _startVideoFrameRateMonitor() 
  {
    if (!Utils.shouldRecoverVideoFrameRateByUA()) 
    {
      return;
    }

    this._stopVideoFrameRateMonitor();

    this._checkAndRecoverVideoFrameRate(true);
    this._videoFrameRateMonitorTimer = setInterval(() => 
    {
      this._checkAndRecoverVideoFrameRate();
    }, 2000);
  }

  /**
   * 停止视频帧率监控。
   *
   * 清除定时器并重置应用约束标志位。
   */
  _stopVideoFrameRateMonitor() 
  {
    if (this._videoFrameRateMonitorTimer) 
    {
      clearInterval(this._videoFrameRateMonitorTimer);
      this._videoFrameRateMonitorTimer = null;
    }

    this._isApplyingVideoFrameRateConstraints = false;
  }

  _clearMaxBitrateRetryTimer() 
  {
    if (this._maxBitrateRetryTimer) 
    {
      clearInterval(this._maxBitrateRetryTimer);
      this._maxBitrateRetryTimer = null;
    }
  }

  /**
   * 根据 SDP 协商的分辨率设置视频编码器码率。
   * 以 SDP_LEVELID_AS[this._sdpResolution].AS 为中心，上下浮动 10%，单位从 kbps 转为 bps。
   */
  _applyVideoMaxBitrate() 
  {
    const sdpLevel = CRTC_C.SDP_LEVELID_AS[this._sdpResolution];

    // 未配置 AS 或特殊 UA 直接跳过，避免额外 sender 参数影响帧率。
    if (!this._connection || !sdpLevel || !sdpLevel.AS || Utils.shouldRecoverVideoFrameRateByUA())
    {
      return;
    }

    const minBitrate = Math.round(sdpLevel.AS * 0.9) * 1000;
    const maxBitrate = Math.round(sdpLevel.AS * 1.1) * 1000;

    this._connection.getSenders().forEach((sender) => 
    {
      if (sender.track && sender.track.kind === 'video') 
      {
        const parameters = sender.getParameters();

        if (!parameters.encodings || parameters.encodings.length === 0)
        {
          return;
        }

        parameters.encodings[0].minBitrate = minBitrate;
        parameters.encodings[0].maxBitrate = maxBitrate;

        sender.setParameters(parameters).then(() => 
        {
          logger.warn(`setParameters success detail min=${minBitrate} max=${maxBitrate}`);
        })
          .catch((err) => 
          {
            logger.error(`setParameters error: ${err.message}`);
          });
      }
    });
  }

  /**
   * 检查并恢复视频帧率为 30fps。
   *
   * 获取当前视频轨道，读取其帧率约束。如果帧率低于 30，则重新应用 30fps 约束。
   */
  async _checkAndRecoverVideoFrameRate(force = false) 
  {
    if (this._isApplyingVideoFrameRateConstraints || !this._connection || this._status === C.STATUS_TERMINATED) 
    {
      return;
    }

    const videoSender = this._connection.getSenders().find((sender) => 
    {
      return sender.track && sender.track.kind === 'video' && sender.track.readyState !== 'ended';
    });

    const track = videoSender && videoSender.track;

    if (!track || typeof track.getConstraints !== 'function' || typeof track.applyConstraints !== 'function') 
    {
      return;
    }

    // 鸿蒙环境下清空 video track 的 contentHint，避免帧率异常
    if (Utils.isHarmonyOS() && 'contentHint' in track && track.contentHint !== '') 
    {
      try 
      {
        track.contentHint = '';
        logger.debug(`${this._id} clear video track contentHint for HarmonyOS, trackId:${track.id}`);
      }
      catch (err) 
      {
        logger.warn(`${this._id} clear video track contentHint failed: ${err.message}`);
      }
    }

    const constraints = track.getConstraints() || {};
    const frameRateConstraints = constraints.frameRate;
    const frameRate = typeof frameRateConstraints === 'number'
      ? frameRateConstraints
      : frameRateConstraints && (
        frameRateConstraints.exact ||
        frameRateConstraints.ideal ||
        frameRateConstraints.max ||
        frameRateConstraints.min
      );

    if (!force && (!Number.isFinite(frameRate) || frameRate >= 30)) 
    {
      return;
    }

    this._isApplyingVideoFrameRateConstraints = true;

    try 
    {
      await track.applyConstraints(Object.assign({}, constraints, {
        frameRate : 30
      }));

      logger.debug(`${this._id} apply video frameRate to 30, trackId:${track.id}, oldConstraints:${JSON.stringify(constraints)}`);
    }
    catch (error) 
    {
      logger.warn(`${this._id} apply video frameRate constraints failed ${error.message} ${JSON.stringify(error)}`);
    }
    finally 
    {
      this._isApplyingVideoFrameRateConstraints = false;
    }
  }

  /**
    * 页面隐藏时：等待 track muted 后替换为黑屏 track
    */
  _handlePageHidden(conn) 
  {
    const videoSender = conn.getSenders().find((s) => s.track.kind === 'video');

    if (!videoSender) return;

    // 清理之前的定时器
    this._clearTrackMutedTimer();

    this._trackMutedTimer = setInterval(() => 
    {
      const track = videoSender.track;

      if (track.muted) 
      {
        this._clearTrackMutedTimer();

        this._visibilitychangeVideoTrack = track;
        this._blackVideoTrack = Utils.generateAnBlackVideoTrack({
          hidden : true,
          width  : track.getSettings().width || 640,
          height : track.getSettings().height || 480
        });

        videoSender.replaceTrack(this._blackVideoTrack.videoTrack);
      }
    }, 100);
  }

  /**
   * 页面可见时：恢复原视频 track
   */
  _handlePageVisible(conn) 
  {
    this._clearTrackMutedTimer();

    if (!this._visibilitychangeVideoTrack || conn.connectionState !== 'connected')
      return;

    const videoSender = conn.getSenders().find((s) => s.track.kind === 'video');

    if (videoSender) 
    {
      videoSender.replaceTrack(this._visibilitychangeVideoTrack);
    }

    this._visibilitychangeVideoTrack = null;

    if (this._blackVideoTrack) 
    {
      this._blackVideoTrack.cleanup();
      this._blackVideoTrack = null;
    }
  }  

  /**
   * 清理定时器的通用函数
   */
  _clearTrackMutedTimer() 
  {
    if (this._trackMutedTimer) 
    {
      clearInterval(this._trackMutedTimer);
      this._trackMutedTimer = null;
    }
  }
};
