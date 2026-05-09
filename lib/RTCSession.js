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
const URI = require('./URI');
const BFCPLib = require('./BFCP/index');

const logger = new Logger('RTCSession');
const BFCPUser = BFCPLib.User;
const Primitive = BFCPLib.Primitive;
const AttributeName = BFCPLib.AttributeName;
const RequestStatusValue = BFCPLib.RequestStatusValue;

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
    this._ealyAudio;

    // DataChannel
    this._dataChannel = null;
    this._dataChannelName = CRTC_C.BFCP;
    this._dataChannelReady = false;
    this._dataChannelConfig = { ordered: false, maxRetransmits: 0 }; // 乱序，不可靠
    this._dataChannelMsgs = {};

    // 是否启用BFCP
    this._enableBFCP = false;
    // 用于解析BFCP消息的User对象
    this._bfcpUser = null;
    // BFCP控制的floorId，SDP协商获得
    this._floorId = null;
    // BFCP服务类型，默认c-s，根据SDP协商修改
    this._floorctrl = null;
    // 本端发送给BFCP服务器的流的mid
    this._mStream = null;
    // 服务端发送给本端的流的label，根据SDP协商获得，用于获取远端辅流
    this._mstrm = null;
    // 远端的辅流在PC中的transceiver索引号，根据前面label及SDP计算得到
    this._transceiverIndex = null;
    // SDP协商过程中远端给的userId
    this._bfcpUserId = null;
    // SDP协商过程中远端给的confId
    this._confId = null;
    // 本端发送floorRequest收到响应里面的，用于后续释放资源
    this._floorRequestId = null;
    // 发送BFCP消息事务ID，起始值为1-9的随机整数
    this._transactionId = 1;
    // BFCP的心跳定时器
    this._bfcpHeatbeatTimer = null;
    // BFCP协商时的视频轨道，用于后面替换
    this._bfcpVideoTrack = null;
    // BFCP控制的流，接通后立即获取
    this._bfcpStream = null;
    // 是否已经收到共享
    this._remoteShared = false;
    // bfcp使用的混音音频
    this._bfcpAudioDestination = null;
    this._bfcpAudioSources = [];
    this._bfcpMediastreams = [];
    this._bfcpAudioCtx = null;

    // 预处理媒体流，如虚拟背景等
    this._mediaStreamProcessor = null;

    // 用于华为安卓记录后摄
    this._environment = null;

    // SDP协商的分辨率速率
    this._sdpResolution = 'BP480P';

    // 适配 DTMF payload 值
    this._dtmf_payload = null;

    this._inviteVideoTrackStatsTimer = null;
    this._answerVideoTrackStatsTimer = null;

    // The RTCPeerConnection instance (public attribute).
    this._connection = null;

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

    // 本地分享媒体：图片、视频、屏幕等.
    this._localShareRTPSender = null;
    this._localShareStream = new MediaStream();
    this._localShareStreamLocallyGenerated = false;

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

    // 预处理媒体流，如虚拟背景等
    this._mediaStreamProcessor = options.mediaStreamProcessor || null;

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

    // 是否启用BFCP
    this._enableBFCP = false;
    if (extraFeatures && extraFeatures.indexOf(CRTC_C.BFCP) !== -1) 
    {
      this._enableBFCP = true;
      this._bfcpUser = new BFCPUser(this._ua.contact.uri.user, target.user);
    }

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
    if (this._ua.sk[7] >= 3) 
    {
      extraHeaders.push('Accept-Contact: *;+g.3gpp.icsi-ref="urn%3Aurn-7%3A3gpp-service.ims.icsi.mmtel";video');
      extraHeaders.push('P-Preferred-Service: urn:urn-7:3gpp-service.ims.icsi.mmtel');
    }

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
          if (Number(this._ua.sk[7]) < 1) 
          {
            delete this._inviteMediaConstraints.video;
          }

          hasAudio = Boolean(this._inviteMediaConstraints.audio);

          let currMediaConstraints;

          // 兼容安卓微信Bug，开始不获取麦克风媒体
          if (navigator.userAgent.indexOf('WeChat') != -1) 
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
            const tStream = await navigator.mediaDevices.getUserMedia(currMediaConstraints)
              .then(async(stream) =>
              {
                // 预处理视频
                if (this._mediaStreamProcessor)
                {
                  stream = (await this._mediaStreamProcessor(stream)) || stream;
                }

                return stream;
              })
              .catch((error) => 
              {
                if (this._status === C.STATUS_TERMINATED) 
                {
                  throw new Error('terminated');
                }

                this._failed('local', null, CRTC_C.causes.USER_DENIED_MEDIA_ACCESS);

                logger.warn(`${this._id} emit "getusermediafailed" [error:%o]`, error);
                logger.warn(`${this._id} emit "getusermediafailed" ${error.message} ${JSON.stringify(error)}`);

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

              this._environment = await Utils.getHuaweiAndroidEnvironment();
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
        if ((navigator.userAgent.indexOf('WeChat') != -1 && hasAudio) || (navigator.userAgent.indexOf('iPhone') != -1 && mics.length > 1 && hasAudio)) 
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

        // 适配 iOS 15.1/15.2 crach 的 bug，webkit Bug https://bugs.webkit.org/show_bug.cgi?id=232006
        let ua;

        navigator.userAgent && (ua = navigator.userAgent.toLowerCase().match(/cpu iphone os (.*?) like mac os/));
        if ((ua && ua[1]) && (ua[1].includes('15_1') || ua[1].includes('15_2'))) 
        {
          return Utils.getStreamThroughCanvas(sendStream);
        }
        else 
        {
          return sendStream;
        }
      })
      .then((stream) => 
      {
        // Create a new RTCPeerConnection instance.
        this._createRTCConnection(pcConfig, rtcConstraints);

        const videoTrackStates = new Map();

        // 音视频轨道属性状态都分别保存日志，视频轨道状态变化触发对应事件
        stream.getTracks().forEach((track) => 
        {
          const trackObj = `id:${track.id} enabled:${track.enabled} readyState:${track.readyState} muted:${track.muted} label:${track.label}`;

          logger.debug(`${this._id} local ${track.kind} track state: ${JSON.stringify(trackObj)} ***** settings: ${JSON.stringify(track.getSettings())} ***** constraints: ${JSON.stringify(track.getConstraints())} ***** capabilities: ${JSON.stringify(track.getCapabilities ? track.getCapabilities() : {})}`);

          this._inviteVideoTrackStatsTimer = setInterval(() => 
          {
            if (track.kind === 'video') 
            {
              if (videoTrackStates.has(track.id)) 
              {
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
              }
              else 
              {
                logger.debug(`${this._id} ${track.id} enabled: ${track.enabled}, readyState: ${track.readyState}, muted: ${track.muted}, label: ${track.label}`);
                videoTrackStates.set(track.id, { enabled: track.enabled, readyState: track.readyState, muted: track.muted, label: track.label });
              }
            }
          }, 1000);
        });

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

    // 更新BFCP的floorctrl
    const lines = request.body.split(/\r?\n/);
    const line = lines.find((l) =>
      l.trim().startsWith('a=floorctrl:') && l.includes(':')
    );

    if (line) 
    {
      switch (line.split(':')[1].trim()) 
      {
        case 'c-s':
        case 'c-only':
          this._floorctrl = 's-only';
          break;
        case 's-only':
          this._floorctrl = 'c-only';
          break;
        default:
          break;
      }
    }

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

    // 初始化统计信息参数
    window.CRTCStats = 'start';

    const request = this._request;
    const extraHeaders = Utils.cloneArray(options.extraHeaders);
    const mediaConstraints = Utils.cloneObject(options.mediaConstraints);
    const mediaStream = options.mediaStream || null;
    const pcConfig = Utils.cloneObject(options.pcConfig, { iceServers: [] });
    const rtcConstraints = options.rtcConstraints || null;
    const rtcAnswerConstraints = options.rtcAnswerConstraints || null;
    const rtcOfferConstraints = Utils.cloneObject(options.rtcOfferConstraints);
    const extraFeatures = options.extraFeatures || null;

    // 是否启用BFCP
    this._enableBFCP = false;
    if (extraFeatures && extraFeatures.indexOf(CRTC_C.BFCP) !== -1) 
    {
      this._enableBFCP = true;
      this._bfcpUser = new BFCPUser(this.local_identity.uri.user, this.remote_identity.uri.user);
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
    if (this._ua.sk[7] >= 3) 
    {
      extraHeaders.push('Accept-Contact: *;+g.3gpp.icsi-ref="urn%3Aurn-7%3A3gpp-service.ims.icsi.mmtel";video');
      extraHeaders.push('P-Preferred-Service: urn:urn-7:3gpp-service.ims.icsi.mmtel');
    }

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

    // Create a new RTCPeerConnection instance.
    // TODO: This may throw an error, should react.
    this._createRTCConnection(pcConfig, rtcConstraints);

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
          if (Number(this._ua.sk[7]) < 1) 
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

          const mStream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(async(stream) =>
            {
              // 预处理视频
              if (this._mediaStreamProcessor)
              {
                stream = (await this._mediaStreamProcessor(stream)) || stream;
              }

              return stream;
            })
            .catch((error) => 
            {
              if (this._status === C.STATUS_TERMINATED) 
              {
                throw new Error('terminated');
              }

              request.reply(480);
              this._failed('local', null, CRTC_C.causes.USER_DENIED_MEDIA_ACCESS);

              logger.warn(`${this._id} emit "getusermediafailed" [error:%o]`, error);
              logger.warn(`${this._id} emit "getusermediafailed" ${error.message} ${JSON.stringify(error)}`);

              this.emit('getusermediafailed', error);

              throw new Error('getUserMedia() failed');
            });

          if (mediaConstraints.video && mStream) 
          {
            this._environment = await Utils.getHuaweiAndroidEnvironment();
            logger.debug(`${this._id} environment id: `, this._environment);
          }


          // 适配 iOS 15.1/15.2 crach 的 bug，webkit Bug https://bugs.webkit.org/show_bug.cgi?id=232006
          let ua;

          navigator.userAgent && (ua = navigator.userAgent.toLowerCase().match(/cpu iphone os (.*?) like mac os/));
          if ((ua && ua[1]) && (ua[1].includes('15_1') || ua[1].includes('15_2'))) 
          {
            return Utils.getStreamThroughCanvas(mStream);
          }
          else 
          {
            return mStream;
          }
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
          const videoTrackStates = new Map();

          stream.getTracks().forEach((track) => 
          {
            const trackObj = `id:${track.id} enabled:${track.enabled} readyState:${track.readyState} muted:${track.muted} label:${track.label}`;

            logger.debug(`${this._id} local ${track.kind} track state: ${JSON.stringify(trackObj)} ***** settings: ${JSON.stringify(track.getSettings())} ***** constraints: ${JSON.stringify(track.getConstraints())} ***** capabilities: ${JSON.stringify(track.getCapabilities())}`);

            this._answerVideoTrackStatsTimer = setInterval(() => 
            {
              if (track.kind === 'video') 
              {
                if (videoTrackStates.has(track.id)) 
                {
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
                }
                else 
                {
                  logger.debug(`${this._id} ${track.id} enabled: ${track.enabled}, readyState: ${track.readyState}, muted: ${track.muted}, label: ${track.label}`);
                  videoTrackStates.set(track.id, { enabled: track.enabled, readyState: track.readyState, muted: track.muted, label: track.label });
                }
              }
            }, 1000);
          });

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
          if (this._enableBFCP) 
          {
            const { videoTrack } = Utils.generateAnEmptyVideoTrack();

            this._bfcpVideoTrack = videoTrack;
            this._connection.addTrack(this._bfcpVideoTrack, this._localMediaStream);
            this._connection.ondatachannel = (event) => { this._initDataChannel(event); };
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

            logger.warn(`${this._id} emit "peerconnection:setremotedescriptionfailed" [error:%o]`, error);
            logger.warn(`${this._id} emit "peerconnection:setremotedescriptionfailed" ${error.message} ${JSON.stringify(error)}`);

            this.emit('peerconnection:setremotedescriptionfailed', error);

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
              request.reply(500);

              throw new Error(`_createLocalDescription() failed ${error.message}`);
            });
        }
        else 
        {
          return this._createLocalDescription('offer', this._rtcOfferConstraints)
            .catch((error) => 
            {
              request.reply(500);

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

        if (this._enableBFCP && this._floorctrl == 's-only') 
        {
          this._floorId = 2;
          desc = desc.replace(/^(m=application .*\r\n)/mg, `$1a=floorctrl:${this._floorctrl}\r\na=floorid:${this._floorId} mstrm:12\r\na=confid:123\r\na=userid:456\r\n`);
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
      });
  }

  /**
   * 切换到视频模式
   */
  upgradeToVideo(options, done) 
  {
    logger.debug(`${this._id} upgradeToVideo()`, options, done);

    if (this._ua.sk[7] < 2) 
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
          stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints })
            .then(async(mediastream) =>
            {
              // 预处理视频
              if (this._mediaStreamProcessor)
              {
                mediastream = (await this._mediaStreamProcessor(mediastream)) || mediastream;
              }

              return mediastream;
            })
            .catch((error) => { throw error; });
          if (stream) 
          {
            this._environment = await Utils.getHuaweiAndroidEnvironment();
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

          // 适配 iOS 15.1/15.2 crach 的 bug，webkit Bug https://bugs.webkit.org/show_bug.cgi?id=232006
          let ua;

          navigator.userAgent && (ua = navigator.userAgent.toLowerCase().match(/cpu iphone os (.*?) like mac os/));
          if ((ua && ua[1]) && (ua[1].includes('15_1') || ua[1].includes('15_2'))) 
          {
            stream = Utils.getStreamThroughCanvas(stream);
          }

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
            Utils.sendKeyFrames(this._connection, 1);
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

    // TODO 需要判断当前是否是视频通话
    if (type === 'camera') 
    {
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
            if (s.track && s.track.kind == 'video') 
            {
              if (this._enableBFCP) 
              {
                // 启用了BFCP，区分一下BFCP控制的视频轨道
                // eslint-disable-next-line max-len
                (s.track != this._bfcpVideoTrack && s.track != (this._localShareStream && this._localShareStream.getVideoTracks()[0])) && s.track.stop();
              }
              else 
              {
                next = true;
                s.track.stop();
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

          return constraints;
        })
        .then(async(videoConstraints) => 
        {
          logger.debug(`${this._id} videoConstraints`, JSON.stringify(videoConstraints));

          const sender = this._connection.getSenders().find((s) => 
          {
            if (this._enableBFCP) 
            {
              // 启用了BFCP，区分一下BFCP控制的视频轨道
              return s.track.kind == 'video' && s.track != this._bfcpVideoTrack && s.track != (this._localShareStream && this._localShareStream.getVideoTracks()[0]);
            }
            else 
            {
              return s.track.kind == 'video';
            }
          });

          // 先释放原来的设备再获取新的
          sender && sender.track && sender.track.stop();

          // iOS手机延迟重新获取
          navigator.userAgent.indexOf('iPhone') != -1 && Utils.sleep(500);

          let stream = await navigator.mediaDevices
            .getUserMedia(videoConstraints)
            .then(async(mediastream) =>
            {
              // 预处理视频
              if (this._mediaStreamProcessor)
              {
                mediastream = (await this._mediaStreamProcessor(mediastream)) || mediastream;
              }

              return mediastream;
            })
            .catch((error) => 
            {
              logger.error(`${this._id} emit "getusermediafailed" [error:%o]`, error);
              logger.error(`${this._id} emit "getusermediafailed" ${error.message} ${JSON.stringify(error)}`);
              this.emit('getusermediafailed', error);
              throw new Error('getUserMedia() failed');
            });

          try 
          {
            const track = stream.getVideoTracks()[0];

            logger.debug(`${this._id} stream: `, track.kind, track.label, track.readyState);
          }
          catch (error) 
          {
            logger.error(`${this._id} stream error: `, error.message);
          }

          // 适配 iOS 15.1/15.2 crach 的 bug，webkit Bug https://bugs.webkit.org/show_bug.cgi?id=232006
          let ua;

          navigator.userAgent && (ua = navigator.userAgent.toLowerCase().match(/cpu iphone os (.*?) like mac os/));
          if ((ua && ua[1]) && (ua[1].includes('15_1') || ua[1].includes('15_2'))) 
          {
            stream = Utils.getStreamThroughCanvas(stream);
          }

          try 
          {
            this._localMediaStream.removeTrack(this._localMediaStream.getVideoTracks()[0]);
          }
          catch (error) 
          {
            logger.error(this._id + error.message);
          }

          const videoTrack = stream.getVideoTracks()[0];

          this._localMediaStream.addTrack(videoTrack);

          sender.replaceTrack(videoTrack);

          this.emit('cameraChanged', { videoStream: stream });

          return stream;
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

          this._connection.getSenders().find((s) => 
          {
            logger.debug(`${this._id} kind: ${s.track.kind}`);
            if (s.track.kind == 'audio') 
            {
              next = true;
              s.track.stop();
            }
          });

          if (!next) 
          {
            return Promise.reject('switchDevice Failed. There is no audio track for the current session.');
          }

          this._localMediaStreamLocallyGenerated = true;

          constraints.audio = audioConstraints;

          return navigator.mediaDevices
            .getUserMedia(constraints)
            .catch((error) => 
            {
              logger.error(`${this._id} emit "getusermediafailed" [error:%o]`, error);
              logger.error(`${this._id} emit "getusermediafailed" ${error.message} ${JSON.stringify(error)}`);
              this.emit('getusermediafailed', error);
              throw new Error('getUserMedia() failed');
            });
        })
        .then((stream) => 
        {
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
   * 分享媒体
   */
  async share(type, id, assembly, dual, skip) 
  {
    logger.debug(`${this._id} share()`);

    // 双流必须开启BFCP支持
    if ((dual && !this._enableBFCP) || (!dual && this._enableBFCP)) 
    {
      return Promise.reject(new Exceptions.NotSupportedError(`Dual and BFCP settings must be consistent. Dual: ${dual}, BFCP: ${this._enableBFCP}`));
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
      if (this._enableBFCP && !skip) 
      {
        floorResponse = await this._sendFloorRequest();

        this._handleFloorRequestStatusMessage(floorResponse);
        // Log the response for debugging purposes
        logger.debug(`${this._id} Floor request response:`, floorResponse);
        const status = floorResponse.getAttribute(AttributeName.FloorRequestInformation).content[1].content[1].content[0];

        if (status != RequestStatusValue.Granted) 
        {
          return Promise.reject(`Floor request not accepted. Status: ${status}`);
          // throw new Error(`Floor request not accepted. Status: ${status}`);
        }

        // 保存一下状态
        this._bfcpRequestStatus = status;

        // 主动踢掉远端的共享
        this._remoteShared = false;
        this.emit('remoteUnShared');

        this._floorRequestId = floorResponse.getAttribute(AttributeName.FloorRequestInformation).content[0];
      }
    }
    catch (error) 
    {
      logger.error(`${this._id} Error while processing floor request:`, error.message || error);

      return Promise.reject(`Floor request failed: ${error.message || 'Unknown error'}`);
      // throw new Error(`Floor request failed: ${error.message || 'Unknown error'}`);
    }

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
              return s.track == this._bfcpVideoTrack;
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
              return s.track == this._bfcpVideoTrack;
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
              return s.track == this._bfcpVideoTrack;
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
            if (this._bfcpRequestStatus === RequestStatusValue.Granted) 
            {
              // BFCP 双流方式分享屏幕
              stream.getTracks().forEach((track) => 
              {
                if (track.kind === 'audio') 
                {
                  this._addShareAudioToBfcpAudioTrack(stream);
                }
                else 
                {
                  const sender = this._connection.getSenders().find((s) => 
                  {
                    return s.track == this._bfcpVideoTrack;
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
              this._localShareStreamLocallyGenerated || (this._enableBFCP && this._sendFloorRelease());
            }, 10000);
          }
          else 
          {
            // BFCP 释放资源
            this._enableBFCP && this._sendFloorRelease();
          }

          logger.warn(`${this._id} emit "getdisplaymediafailed" [error:%o]`, error);
          logger.warn(`${this._id} emit "getdisplaymediafailed" ${error.message} ${JSON.stringify(error)}`);
          this.emit('getdisplaymediafailed', error);
          throw error;
        });
    }
  }

  /**
   * 停止分享媒体
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

    Utils.closeMediaStream(this._localShareStream);
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
   * 设置视频内容提示，主要用于提升在不同场景下的视频编码质量
   */
  setVideoContentHint(hint, shared) 
  {
    logger.debug(`${this._id} setVideoContentHint()`, hint);

    const hints = [ 'detail', 'text', 'motion' ];

    if (this._status !== C.STATUS_WAITING_FOR_ACK && this._status !== C.STATUS_CONFIRMED) 
    {
      return false;
    }

    if (!this._isReadyToReOffer()) 
    {
      return false;
    }

    if (hints[hint] !== -1) 
    {
      let tracks;

      if (shared) 
      {
        tracks = this._localShareStream.getVideoTracks();
      }
      else 
      {
        tracks = this._localMediaStream.getVideoTracks();
      }

      tracks.forEach((track) => 
      {
        if ('contentHint' in track) 
        {
          track.contentHint = hint;
        }
        else 
        {
          return false;
        }
      });
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

    const eventHandlers = {
      succeeded : () => 
      {
        if (done) { done(); }
      },
      failed : () => 
      {
        this.terminate({
          cause         : options.failed ? options.failed : CRTC_C.causes.WEBRTC_ERROR,
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
   * Send a BFCP FloorRequest
   */
  _sendFloorRequest() 
  {
    logger.debug(`${this._id} sendFloorRequest()`);

    const currentTransactionId = this._transactionId;

    this._transactionId++;
    const floorRequest = this._bfcpUser.floorRequestMessage(currentTransactionId, this._floorId);

    return this._dataChannelSend(floorRequest, currentTransactionId);
  }

  // TODO: 测试用
  sendFloorStatus(status) 
  {
    logger.debug(`${this._id} _sendFloorStatus()`);

    const currentTransactionId = this._transactionId;

    this._transactionId++;

    const floorStatus = this._bfcpUser.floorStatusMessage(this._floorId, status, currentTransactionId);

    return this._dataChannelSend(floorStatus, currentTransactionId);
  }

  _sendFloorStatusAck(message) 
  {
    logger.debug(`${this._id} _sendFloorStatusAck()`);

    const floorStatus = this._bfcpUser.floorStatusAckMessage(this._floorId, message);

    return this._sendDataChannelMessage(floorStatus);
  }

  /**
   * Send a BFCP Hello
   */
  _sendHello() 
  {
    logger.debug(`${this._id} sendHello()`);

    const currentTransactionId = this._transactionId;

    this._transactionId++;

    const hello = this._bfcpUser.helloMessage(currentTransactionId, this._floorId);

    return this._dataChannelSend(hello, currentTransactionId);
  }

  /**
   * Send a BFCP FloorRelease
   */
  _sendFloorRelease() 
  {
    logger.debug(`${this._id} sendFloorRelease()`);

    const currentTransactionId = this._transactionId;

    this._transactionId++;

    const floorRelease = this._bfcpUser.floorReleaseMessage(currentTransactionId, this._floorRequestId);

    return this._dataChannelSend(floorRelease, currentTransactionId);
  }

  // BFCP用的混音相关方法
  _createBfcpAudioTrack(mediaStream) 
  {
    this._bfcpAudioCtx = new AudioContext();

    const audioSource = this._bfcpAudioCtx.createMediaStreamSource(mediaStream);

    this._bfcpAudioSources.push(audioSource);
    this._bfcpAudioDestination = this._bfcpAudioCtx.createMediaStreamDestination();

    audioSource.connect(this._bfcpAudioDestination);

    return this._bfcpAudioDestination.stream.getAudioTracks()[0];
  }

  _addShareAudioToBfcpAudioTrack(mediaStream) 
  {
    const audioSource = this._bfcpAudioCtx.createMediaStreamSource(mediaStream);

    this._bfcpAudioSources.push(audioSource);

    audioSource.connect(this._bfcpAudioDestination);
  }

  _distoryBfcpAudioTrack() 
  {
    if (this._bfcpAudioSources.length > 0) 
    {
      this._bfcpAudioSources.forEach((audioSource) => audioSource.disconnect());
      this._bfcpAudioSources = [];

      this._bfcpAudioDestination = null;
    }
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

                logger.warn(`${this._id} emit "peerconnection:setremotedescriptionfailed" [error:%o]`, error);
                logger.warn(`${this._id} emit "peerconnection:setremotedescriptionfailed" ${error.message} ${JSON.stringify(error)}`);
                this.emit('peerconnection:setremotedescriptionfailed', error);
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

    this.emit('newInfo', data);
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
    // Close local MediaStream if it was not given by the user.
    if (this._localMediaStream && this._localMediaStreamLocallyGenerated) 
    {
      logger.warn(`${this._id} close() | closing local MediaStream`);
      Utils.closeMediaStream(this._localMediaStream);
    }

    // 销毁BFCP相关媒体
    this._distoryBfcpAudioTrack();
    this._bfcpMediastreams.length > 0 && this._bfcpMediastreams.forEach((mediaStream) => 
    {
      logger.debug(`${this._id} close() | closing local bfcp MediaStream`);
      Utils.closeMediaStream(mediaStream);
    });

    if (this._localShareStream) 
    {
      logger.debug(`${this._id} close() | closing local share MediaStream`);

      Utils.closeMediaStream(this._localShareStream);
    }

    if (this._bfcpStream) 
    {
      logger.debug(`${this._id} close() | closing local bfcp MediaStream`);

      Utils.closeMediaStream(this._bfcpStream);
    }

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
        logger.warn(`${this._id} close() | error closing the RTCPeerConnection: %o`, error);
        logger.warn(`${this._id} close() | error closing the RTCPeerConnection: ${error.message} ${JSON.stringify(error)}`);
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
          if (this._enableBFCP) 
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
              logger.warn(`${this._id} emit "peerconnection:createofferfailed" [error:%o]`, error);
              logger.warn(`${this._id} emit "peerconnection:createofferfailed" ${error.message} ${JSON.stringify(error)}`);

              this.emit('peerconnection:createofferfailed', error);

              return Promise.reject(error);
            });
        }
        else 
        {
          return connection.createAnswer(constraints)
            .catch((error) => 
            {
              logger.warn(`${this._id} emit "peerconnection:createanswerfailed" [error:%o]`, error);
              logger.warn(`${this._id} emit "peerconnection:createanswerfailed" ${error.message} ${JSON.stringify(error)}`);

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
            if (this._ua.sk[7] >= 3) 
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
        this._enableBFCP || (desc.sdp = desc.sdp.replace(/profile-level-id=[\w\d]+/g, `profile-level-id=${CRTC_C.SDP_LEVELID_AS[this._sdpResolution].LEVELID}`));

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

            logger.warn(`${this._id} emit "peerconnection:setlocaldescriptionfailed" [error:%o]`, error);
            logger.warn(`${this._id} emit "peerconnection:setlocaldescriptionfailed" ${error.message} ${JSON.stringify(error)}`);

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

          this._enableBFCP && (e.sdp = e.sdp.replace('UDP/DTLS/SCTP webrtc-datachannel', 'UDP/DTLS/SCTP/BFCP *'));

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

            this._enableBFCP && (e.sdp = e.sdp.replace('UDP/DTLS/SCTP webrtc-datachannel', 'UDP/DTLS/SCTP/BFCP *'));

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
            if (this._ua.sk[7] >= 3) 
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
            if (this._ua.sk[7] >= 3) 
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
        if (this._ua.sk[7] >= 3) 
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
          if (this._ua.sk[7] >= 3 && desc) 
          {
            desc = desc.replace(/(m=video.*)\r\n/, '$1\r\na=cc-xfb\r\n');
            desc = desc.replace(/a=pcfg:1 t=1\r\n/, '');
            desc = desc.replace(/a=tcap.*AVPF\r\n/, '');
          }

          if (this._enableBFCP && this._floorctrl == 's-only') 
          {
            desc = desc.replace(/^(m=application .*\r\n)/mg, `$1a=floorctrl:${this._floorctrl}\r\na=floorid:${this._floorId} mstrm:12\r\na=confid:123\r\na=userid:456\r\n`);
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
              accept : () => 
              {
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
      if (this._ua.sk[7] >= 3) 
      {
        extraHeaders.push('Accept-Contact: *;+g.3gpp.icsi-ref="urn%3Aurn-7%3A3gpp-service.ims.icsi.mmtel";video');
        extraHeaders.push('P-Preferred-Service: urn:urn-7:3gpp-service.ims.icsi.mmtel');
      }

      this._handleSessionTimersInIncomingRequest(request, extraHeaders);

      if (this._late_sdp) 
      {
        desc = this._mangleOffer(desc);
      }

      if (this._enableBFCP) 
      {
        // 适配通用情况下的SDP H224
        applicationIndex && applicationIndex[1] !== -1 && (desc += 'm=application 0 UDP/TLS/RTP/SAVPF 100\r\na=rtpmap:100 H224/4800\r\na=inactive\r\n');
        logger.debug(`${this._id} OLD SDP: `, desc);
        desc = Utils.reorderApplicationMedia(desc, applicationIndex);
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
          if (this._ua.sk[7] >= 3 && desc) 
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
      if (this._ealyAudio && request.body.indexOf('m=video 0 ') === -1) 
      {
        this._ealyAudio = undefined;
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
      if (this._ua.sk[7] >= 3) 
      {
        extraHeaders.push('Accept-Contact: *;+g.3gpp.icsi-ref="urn%3Aurn-7%3A3gpp-service.ims.icsi.mmtel";video');
        extraHeaders.push('P-Preferred-Service: urn:urn-7:3gpp-service.ims.icsi.mmtel');
      }

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
            logger.warn(`${this._id} emit "peerconnection:setremotedescriptionfailed" [error:%o]`, error);
            logger.warn(`${this._id} emit "peerconnection:setremotedescriptionfailed" ${error.message} ${JSON.stringify(error)}`);

            this.emit('peerconnection:setremotedescriptionfailed', error);

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
          catch (error) 
          {
            logger.error('sender error: ', error.message);
          }
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

          return navigator.mediaDevices.getUserMedia(videoConstraints)
            .then(async(stream) =>
            {
              // 预处理视频
              if (this._mediaStreamProcessor)
              {
                stream = (await this._mediaStreamProcessor(stream)) || stream;
              }

              return stream;
            })
            .catch((error) => 
            {
              if (this._status === C.STATUS_TERMINATED) 
              {
                throw new Error('terminated');
              }

              // this._failed('local', null, CRTC_C.causes.USER_DENIED_MEDIA_ACCESS);

              logger.warn(`${this._id} emit "getusermediafailed" [error:%o]`, error);
              logger.warn(`${this._id} emit "getusermediafailed" ${error.message} ${JSON.stringify(error)}`);

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

          // 适配 iOS 15.1/15.2 crach 的 bug，webkit Bug https://bugs.webkit.org/show_bug.cgi?id=232006
          let ua;

          navigator.userAgent && (ua = navigator.userAgent.toLowerCase().match(/cpu iphone os (.*?) like mac os/));
          if ((ua && ua[1]) && (ua[1].includes('15_1') || ua[1].includes('15_2'))) 
          {
            stream = Utils.getStreamThroughCanvas(stream);
          }

          stream.getVideoTracks().forEach((track) => 
          {
            try 
            {
              this._localMediaStream.addTrack(track);
            }
            catch (error) 
            {
              logger.warn(`${this._id} _processInDialogSdpOffer() failed local stream ${error.name} ${track.kind} ${error.message} ${JSON.stringify(error)}`);
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
                logger.warn(`${this._id} _processInDialogSdpOffer() failed no stream ${error.name} ${track.kind} ${error.message} ${JSON.stringify(error)}`);
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
                  logger.warn(`${this._id} _processInDialogSdpOffer() failed no stream ${error.name} ${this._localMediaStream.getVideoTracks()[0].kind} ${error.message} ${JSON.stringify(error)}`);
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
            logger.warn(`${this._id} emit "peerconnection:createtelocaldescriptionfailed" [error:%o]`, error);
            logger.warn(`${this._id} emit "peerconnection:createtelocaldescriptionfailed" ${error.message} ${JSON.stringify(error)}`);

            throw error;
          });
      })
      .catch((error) => 
      {
        logger.warn(`${this._id} _processInDialogSdpOffer() failed [error: %o]`, error);
        logger.warn(`${this._id} _processInDialogSdpOffer() failed ${error.message} ${JSON.stringify(error)}`);
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

      if (this._enableBFCP) 
      {
        initCallback && initCallback();

        return;
      }

      const session = new RTCSession(this._ua);

      session.on('progress', ({ response }) => 
      {
        this._enableBFCP || notifier.notify(response.status_code, response.reason_phrase);
      });

      session.on('accepted', ({ response }) => 
      {
        this._enableBFCP || notifier.notify(response.status_code, response.reason_phrase);

        // 华为MCU需要挂断
        this._enableBFCP && this.terminate();
      });

      session.on('_failed', ({ message, cause }) => 
      {
        if (message) 
        {
          this._enableBFCP || notifier.notify(message.status_code, message.reason_phrase);
        }
        else 
        {
          this._enableBFCP || notifier.notify(487, cause);
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

        // 兼容BFCP需要做音频混音
        if (this._enableBFCP) 
        {
          const stream = new MediaStream([ this._createBfcpAudioTrack(mediaStream), mediaStream.getVideoTracks()[0] ]);

          this._bfcpMediastreams.push(mediaStream);
          this._localMediaStream = stream;
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
        if (this._enableBFCP) 
        {
          const { videoTrack } = Utils.generateAnEmptyVideoTrack();

          this._bfcpVideoTrack = videoTrack;
          this._connection.addTrack(this._bfcpVideoTrack, this._localMediaStream);

          this._initDataChannel();
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

        // 添加BFCP所需属性
        if (this._enableBFCP) 
        {
          // 根据 MediaStreamTrackGenerator 是否支持判断是否存在第二个视频流
          let supportedMSTC = false;

          if ('MediaStreamTrackGenerator' in window) 
          {
            supportedMSTC = true;
          }

          this._connection.getTransceivers().forEach((transceiver) => 
          {
            const track = transceiver.sender.track;

            if (!track) 
            {
              return;
            }

            if (supportedMSTC) 
            {
              // eslint-disable-next-line no-undef
              if (track instanceof MediaStreamTrackGenerator || this._isCanvasTrack(track)) 
              {
                this._mStream = transceiver.mid;
                sessionStorage.setItem(CRTC_C.BFCP_SHARED_STREAM_INDEX, transceiver.mid);
              }
            }
            else if (this._isCanvasTrack(track)) 
            {
              this._mStream = transceiver.mid;
              sessionStorage.setItem(CRTC_C.BFCP_SHARED_STREAM_INDEX, transceiver.mid);
            }
          });

          desc = desc.replace(/^(m=application .*\r\n)/mg, `$1a=floorctrl:${this._floorctrl ? this._floorctrl : 'c-s'}\r\n`);

          // 添加主辅流标志
          desc = this._addMediastreamFlag(desc, this._mStream);
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
              this._ealyAudio = true;
            }

            if (response.getHeader('require') && response.getHeader('require').indexOf('100rel') !== -1 && Boolean(response.getHeader('rseq'))) 
            {
              this._earlyDialogs[Object.keys(this._earlyDialogs)[0]].sendRequest(CRTC_C.PRACK, { RSeq: response.getHeader('rseq') });
            }
          })
          .then(() => this._progress('remote', response))
          .catch((error) => 
          {
            logger.warn(`${this._id} emit "peerconnection:setremotedescriptionfailed" [error:%o]`, error);
            logger.warn(`${this._id} emit "peerconnection:setremotedescriptionfailed" ${error.message} ${JSON.stringify(error)}`);

            this.emit('peerconnection:setremotedescriptionfailed', error);
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

          if (this._ealyAudio) 
          {
            this._ontogglemode('audio');
          }

          // 兼容安卓微信Bug
          if (this._replaceAudioTrack && navigator.userAgent.indexOf('WeChat') != -1) 
          {
            navigator.mediaDevices.getUserMedia({ audio: this._inviteMediaConstraints.audio || true, video: false })
              .then((stream) => 
              {
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

        if (this._enableBFCP) 
        {
          // 获取响应中BFCP相关属性
          this._floorId = Number((e.sdp.match(/a=floorid:(\d+)/) || [ null, 1 ])[1]);
          this._floorctrl = ((e.sdp.match(/a=floorctrl:([a-z-]+)/) || [ null, '' ])[1] === 's-only') ? 'c-only' : 'c-s';
          this._confId = (e.sdp.match(/a=confid:(\d+)/) || [ null, '' ])[1];
          this._bfcpUserId = (e.sdp.match(/a=userid:(\d+)/) || [ null, '' ])[1];
          this._mstrm = (e.sdp.match(/mstrm:(\d+)/) || [ null, '' ])[1];

          // 把协商来的userId 和 confId赋值给bfcpUser对象
          this._bfcpUser.userId = Number(this._bfcpUserId);
          this._bfcpUser.conferenceId = Number(this._confId);
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

                if (this._replaceAudioTrack && navigator.userAgent.indexOf('WeChat') != -1) 
                {
                  navigator.mediaDevices.getUserMedia({ audio: this._inviteMediaConstraints.audio || true, video: false })
                    .then((stream) => 
                    {
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
                this._enableBFCP && this.renegotiate();
              })
              .catch((error) => 
              {
                this._acceptAndTerminate(response, 488, 'Not Acceptable Here');
                this._failed('remote', response, CRTC_C.causes.BAD_MEDIA_DESCRIPTION);

                logger.warn(`${this._id} emit "peerconnection:setremotedescriptionfailed" [error:%o]`, error);
                logger.warn(`${this._id} emit "peerconnection:setremotedescriptionfailed" ${error.message} ${JSON.stringify(error)}`);

                this.emit('peerconnection:setremotedescriptionfailed', error);
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
    if (this._ua.sk[7] >= 3) 
    {
      extraHeaders.push('Accept-Contact: *;+g.3gpp.icsi-ref="urn%3Aurn-7%3A3gpp-service.ims.icsi.mmtel";video');
      extraHeaders.push('P-Preferred-Service: urn:urn-7:3gpp-service.ims.icsi.mmtel');
    }

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

        // 添加BFCP所需属性
        this._enableBFCP && (sdp = sdp.replace(/^(m=application .*\r\n)/mg, `$1a=floorctrl:${this._floorctrl}\r\na=floorid:${this._floorId} m-stream:${this._mStream}\r\n`));
        // 添加主辅流标志
        sdp = this._addMediastreamFlag(sdp, this._mStream);
        const e = { originator: 'local', type: 'offer', sdp };

        this._enableBFCP && (e.sdp = e.sdp.replace('UDP/DTLS/SCTP webrtc-datachannel', 'UDP/DTLS/SCTP/BFCP *'));

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
      this._transceiverIndex = Utils.findLabelIndexByMstrm(response.body);
      if (this._transceiverIndex && this._transceiverIndex !== -1) 
      {
        sessionStorage.setItem(CRTC_C.BFCP_TRANSCEIVER_INDEX, this._transceiverIndex);

        try 
        {
          this._bfcpStream = Utils.getStreams(this._connection, 'shared');

          logger.debug(`${this._id} sessionStorage setItem ${CRTC_C.BFCP_TRANSCEIVER_INDEX}: ${this._transceiverIndex}`);
        }
        catch (error) 
        {
          logger.error(`${this._id} Failed to set item in sessionStorage:${error}`);
        }
      }

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

          logger.warn(`${this._id} emit "peerconnection:setremotedescriptionfailed" [error:%o]`, error);
          logger.warn(`${this._id} emit "peerconnection:setremotedescriptionfailed" ${error.message} ${JSON.stringify(error)}`);

          this.emit('peerconnection:setremotedescriptionfailed', error);
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
    if (this._ua.sk[7] >= 3) 
    {
      extraHeaders.push('Accept-Contact: *;+g.3gpp.icsi-ref="urn%3Aurn-7%3A3gpp-service.ims.icsi.mmtel";video');
      extraHeaders.push('P-Preferred-Service: urn:urn-7:3gpp-service.ims.icsi.mmtel');
    }

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

          this._enableBFCP && (e.sdp = e.sdp.replace('UDP/DTLS/SCTP webrtc-datachannel', 'UDP/DTLS/SCTP/BFCP *'));

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

            logger.warn(`${this._id} emit "peerconnection:setremotedescriptionfailed" [error:%o]`, error);
            logger.warn(`${this._id} emit "peerconnection:setremotedescriptionfailed" ${error.message} ${JSON.stringify(error)}`);

            this.emit('peerconnection:setremotedescriptionfailed', error);
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

  // 给SDP添加主辅流标志
  _addMediastreamFlag(sdp, targetMid = '3') 
  {
    // 仅处理video媒体块，排除application块
    const videoPattern = new RegExp('(m=video[\\s\\S]*?^a=mid:(\\d+)\\r?\\n)', 'gm');

    sdp = sdp.replace(videoPattern, (match, p1, mid) => 
    {
      // 根据mid设置content值
      const content = mid === targetMid ? 'slides' : 'main';

      return `${p1}a=content:${content}\r\n`;
    });

    return sdp;
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

      this._localShareStream && this._localShareStream.getVideoTracks().forEach((track) => 
      {
        track.stop();
      });
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
                this._connection.connectionState === 'connected' && transeiver.sender.replaceTrack(this._bfcpVideoTrack);
              }
            }
          });

          this._localShareStream = null;
          this._localShareStreamLocallyGenerated = false;

          // BFCP 释放资源，当被取消权限以后不再用发送release
          this._bfcpRequestStatus !== RequestStatusValue.Revoked && this._sendFloorRelease();
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
      if (this._enableBFCP) 
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
        return !this._isCanvasTrack(sender.track)
          && sender.track !== this._bfcpVideoTrack
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
    if (/(^|[;>])\s*\+?video\s*([;=]|$)/i.test(message.getHeader('contact'))) 
    {
      this.emit('remoteSupportsVideo', true);
    }
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

    this.emit('confirmed', {
      originator,
      ack : ack || null
    });
  }

  _ended(originator, message, cause) 
  {
    logger.debug(`${this._id} session ended`);

    this._end_time = new Date();

    this._close();

    logger.debug(`${this._id} emit "ended"`);

    // 停止全部统计信息事件
    window.CRTCStats = 'stop';

    this.emit('ended', {
      originator,
      message : message || null,
      cause
    });

    this._dataChannel && this._dataChannel.close();
    this._dataChannel = null;

    if (this._inviteVideoTrackStatsTimer) 
    {
      clearInterval(this._inviteVideoTrackStatsTimer);
    }

    if (this._answerVideoTrackStatsTimer) 
    {
      clearInterval(this._answerVideoTrackStatsTimer);
    }

    // DC 状态设置为未准备好
    this._dataChannelReady = false;
    // 停止发送心跳
    this._bfcpHeatbeatTimer && clearInterval(this._bfcpHeatbeatTimer);
    this._bfcpHeatbeatTimer = null; // 避免潜在的内存泄漏

    // 停止检测close状态
    this._closingInterval && clearInterval(this._closingInterval);
  }

  _failed(originator, message, cause) 
  {
    logger.debug(`${this._id} session failed`);

    // Emit private '_failed' event first.
    logger.debug(`${this._id} emit "_failed"`);

    // 停止全部统计信息事件
    window.CRTCStats = 'stop';

    this.emit('_failed', {
      originator,
      message : message || null,
      cause
    });

    this._dataChannel && this._dataChannel.close();
    this._dataChannel = null;

    this._close();

    logger.debug(`${this._id} emit "failed"`);

    this.emit('failed', {
      originator,
      message : message || null,
      cause
    });

    // DC 状态设置为未准备好
    this._dataChannelReady = false;
    // 停止发送心跳
    this._bfcpHeatbeatTimer && clearInterval(this._bfcpHeatbeatTimer);
    this._bfcpHeatbeatTimer = null; // 避免潜在的内存泄漏

    // 停止检测close状态
    this._closingInterval && clearInterval(this._closingInterval);
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
    audio.play().catch((error) => { logger.error(`${this._id} new Audio() error: ${error.message} ${JSON.stringify(error)}`); });
    source.connect(destination);

    return destination.stream.getAudioTracks()[0];
  }

  /**
   * 将临时的音频恢复为麦克风audioTrack
   */
  _replaceAudioToMic() 
  {
    // 获取麦克风流，成功后替换canvas视频，失败后重新获取麦克风媒体并替换
    navigator.mediaDevices.getUserMedia({ audio: this._inviteMediaConstraints.audio || true, video: false })
      .then((stream) => 
      {
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
        logger.error(`${this._id} replaceAudioToMic error: ${error.message} ${JSON.stringify(error)}`);
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
    navigator.mediaDevices.getUserMedia({ audio: false, video: this._inviteMediaConstraints.video || true })
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
        logger.error(`${this._id} replaceCanvasToVideo error: ${error.message} ${JSON.stringify(error)}`);
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
   * BFCP && DataChannel
   */

  /**
   * 处理 Hello 消息
   * @param {Object} message - 接收到的消息对象
   */
  _handleHelloMessage(message) 
  {
    logger.debug(`${this._id} BFCP send HACK: Transaction ID: ${message.commonHeader.transactionId}, Timestamp: ${Date.now()}`);
    const response = this._bfcpUser.helloAckMessage(message);

    this._sendDataChannelMessage(response);
  }

  /**
   * 处理 FloorRequestStatus 消息
   * @param {Object} message - 接收到的消息对象
   */
  _handleFloorRequestStatusMessage(message) 
  {
    logger.debug(`${this._id} BFCP send FloorRequestStatusACK: Transaction ID: ${message.commonHeader.transactionId}, Timestamp: ${Date.now()}`);
    const response = this._bfcpUser.floorRequestStatusAckMessage(message);

    this._sendDataChannelMessage(response);

    // 处理本端分享被撤销的情况
    const status = message.getAttribute(AttributeName.FloorRequestInformation).content[1].content[1].content[0];

    if (status === RequestStatusValue.Revoked) 
    {
      this._bfcpRequestStatus = status;
      // 已经共享了的自动取消共享
      if (this._localShareStreamLocallyGenerated) 
      {
        this.unShare();
      }
    }
  }

  /**
   * 处理 FloorStatus 消息
   * @param {Object} message - 接收到的消息对象
   */
  _handleFloorStatusMessage(message) 
  {
    // 不再回ack，根据support里面是否支持做出这个决定
    // this._sendFloorStatusAck(message);
    const floorStatus = message.getAttribute(AttributeName.FloorRequestInformation).content[1].content[1].content[0];

    // 根据状态触发事件
    if (floorStatus === RequestStatusValue.Granted && !this._remoteShared) 
    {
      this._remoteShared = true;
      this.emit('remoteShared', { sharedStream: this._bfcpStream });
    }
    else if (floorStatus === RequestStatusValue.Released && this._remoteShared) 
    {
      this._remoteShared = false;
      this.emit('remoteUnShared');
    }
    else 
    {
      logger.warn(`${this._id} Unknown floor status: ${floorStatus}`);
    }
  }

  /**
   * 处理 FloorRequest 消息
   * @param {Object} message - 接收到的消息对象
   */
  _handleFloorRequestMessage(message) 
  {
    const wantedFloorId = message.getAttribute(AttributeName.FloorId).content;

    if (this.listeners('floorRequest').length === 0 || (message.commonHeader.primitive = Primitive.FloorRelease)) 
    {
      // 自动接受请求
      const response = this._bfcpUser.floorRequestStatusMessage(
        message,
        wantedFloorId,
        RequestStatusValue.Granted
      );

      this._sendDataChannelMessage(response, message.commonHeader.transactionId);
    }
    else 
    {
      // 触发事件，允许外部处理
      this.emit('floorRequest', {
        message,
        accept : () => 
        {
          const response = this._bfcpUser.floorRequestStatusMessage(
            message,
            wantedFloorId,
            RequestStatusValue.Granted
          );

          this._sendDataChannelMessage(response, message.commonHeader.transactionId);
        },
        reject : () => 
        {
          const response = this._bfcpUser.floorRequestStatusMessage(
            message,
            wantedFloorId,
            RequestStatusValue.Denied
          );

          this._sendDataChannelMessage(response, message.commonHeader.transactionId);
        }
      });
    }
  }

  /**
   * 发送消息到数据通道
   * @param {Buffer} message - 要发送的消息
   * @param {number} [transactionId] - 可选的事务 ID
   */
  _sendDataChannelMessage(message, transactionId) 
  {
    logger.debug(`${this._id} Sending message ${Utils.uint8ArrayToBase64(message)} with Transaction ID: ${transactionId}, Timestamp: ${Date.now()}`);
    this._dataChannel.send(message);
  }

  /**
   * 处理数据通道接收到的消息。
   *
   * @param {Object} event - 数据通道消息事件对象。
   * @param {ArrayBuffer|string} event.data - 接收到的消息数据，通常为 ArrayBuffer 类型。
   *
   * 该方法会解析消息并根据消息类型执行相应逻辑。如果数据通道未准备好或消息格式不正确，则忽略处理。
   */
  _onChannelMessage(event) 
  {
    logger.debug(`${this._id} onChannelMessage()`);

    // 如果数据通道未准备好，则忽略消息
    if (!this._dataChannelReady) 
    {
      logger.warn(`${this._id} onChannelMessage(): Data channel is not ready, ignoring message.`);

      return;
    }

    const data = event.data;

    // 确保接收到的数据是 ArrayBuffer 类型
    if (!(data instanceof ArrayBuffer)) 
    {
      logger.warn(`${this._id} onChannelMessage(): Received non-ArrayBuffer message, ignoring.`);

      return;
    }

    try 
    {
      // 将 ArrayBuffer 转换为 Buffer 并解析消息
      const bufferData = Buffer.from(data);

      logger.debug(`${this._id} recv unit8: `, Utils.uint8ArrayToBase64(bufferData));

      // 适配 0002 0000  的包
      if (Utils.uint8ArrayToBase64(bufferData) === 'AgAAAA==') 
      {
        return;
      }

      const message = this._bfcpUser.receiveMessage(bufferData);

      // 输出日志：收到消息内容及tid，时间戳
      logger.debug(`${this._id} BFCP recv: ${JSON.stringify(message)}, Transaction ID: ${message.commonHeader.transactionId}, Timestamp: ${Date.now()}`);

      // 处理已注册的事务消息
      if (this._dataChannelMsgs[message.commonHeader.transactionId]) 
      {
        // 记录BFCP消息响应时间
        logger.debug(`${this._id} bfcp response time: transactionId(${message.commonHeader.transactionId}), time(${Date.now() - this._dataChannelMsgs[message.commonHeader.transactionId].sendAt}ms)`);

        this._dataChannelMsgs[message.commonHeader.transactionId].received = true;
        this._dataChannelMsgs[message.commonHeader.transactionId].resolve(message);
        delete this._dataChannelMsgs[message.commonHeader.transactionId];

        return;
      }

      // 根据消息类型执行相应逻辑
      switch (message.commonHeader.primitive) 
      {
        case Primitive.Hello:
          this._handleHelloMessage(message);
          break;

        case Primitive.FloorRequestStatus:
          this._handleFloorRequestStatusMessage(message);
          break;

        case Primitive.FloorStatus:
          this._handleFloorStatusMessage(message);
          break;

        case Primitive.FloorRequest:
          this._handleFloorRequestMessage(message);
          break;

        default:
          logger.debug(`${this._id} onChannelMessage(): do not require processing type: ${message.commonHeader.primitive}`);
          break;
      }
    }
    catch (error) 
    {
      logger.error(`${this._id} onChannelMessage(): Error while processing message.`, error);
    }
  }

  /**
   * DC 关闭后清理
   */
  _onChannelClose() 
  {
    logger.debug(`${this._id} datachannel closed.`);

    setTimeout(() => 
    {
      // 判断dc如果断开1秒后ice状态正常则重连dc
      if (this.connection.iceConnectionState === 'connected') 
      {
        this.renegotiate();
      }
      else 
      {
        // DC 状态设置为未准备好
        this._dataChannelReady = false;
        // 停止发送心跳
        clearInterval(this._bfcpHeatbeatTimer);
        this._bfcpHeatbeatTimer = null; // 避免潜在的内存泄漏

        // 停止检测close状态
        clearInterval(this._closingInterval);
      }
    }, 1000);
  }

  /**
   * DC 发送消息
   * @param {*} message
   * @param {*} transactionId
   * @returns
   */
  _dataChannelSend(message, transactionId) 
  {
    logger.debug(`${this._id} dataChannelSend() ${transactionId}`);

    return new Promise((resolve, reject) => 
    {
      // DataChannel 未准备好
      if (!this._dataChannelReady) 
      {
        reject(`[DataChannel] Not ready for transactionId: ${transactionId}`);
        logger.error(`${this._id} [DataChannel] Not ready for transactionId: ${transactionId}`);

        return;
      }

      // 保存发送的处理中的 DC 消息，收到响应后删除
      if (!this._dataChannelMsgs[transactionId]) 
      {
        this._dataChannelMsgs[transactionId] = {
          retries  : 0,
          sendAt   : Date.now(),
          message  : message,
          received : false,
          resolve,
          reject
        };
      }

      const messageState = this._dataChannelMsgs[transactionId];

      // 如果已经超出最大重试次数，则报告错误
      if (messageState.retries !== 0 && (messageState.retries > CRTC_C.MAX_RETRY_ATTEMPTS)) 
      {
        logger.warn(`${this._id} [DataChannel] Max retry attempts (${CRTC_C.MAX_RETRY_ATTEMPTS}) reached for transactionId: ${transactionId}`);
        messageState.reject(`[DataChannel] Max retry attempts (${CRTC_C.MAX_RETRY_ATTEMPTS}) reached for transactionId: ${transactionId}`);

        return;
      }

      // 输出日志：发送消息次数及tid，时间戳
      logger.debug(`${this._id} BFCP send: ${JSON.stringify(this._bfcpUser.receiveMessage(messageState.message))} ${JSON.stringify(Utils.uint8ArrayToBase64(messageState.message))} ${messageState.retries + 1}, ${transactionId} ${Date.now()}`);

      const sendMessage = this._bfcpUser.receiveMessage(messageState.message);

      // DC 消息超时重试, FloorRelease消息不重发
      if (CRTC_C.MAX_RETRY_ATTEMPTS > 0 && sendMessage.commonHeader.primitive != Primitive.FloorRelease) 
      {
        setTimeout(() => 
        {
          // 如果没有收到响应，则重试
          if (messageState && !messageState.received) 
          {
            messageState.retries++;
            // 增加重试的间隔
            this._dataChannelSend(messageState.message, transactionId);
          }
        }, Math.pow(2, messageState.retries) * 500);
      }

      this._dataChannel && this._dataChannel.send(messageState.message);
    });
  }

  // 检查是否为画布流的通用方法
  _isCanvasTrack(track) 
  {
    // 检查track的settings中是否包含canvas相关信息
    const settings = track.getSettings();

    // Firefox中canvas轨道的label通常包含"MediaStreamTrack"且不会有deviceId
    // 同时增加对Firefox中CanvasCaptureMediaStreamTrack的检查
    return (!settings.deviceId || settings.deviceId === 'canvas') ||
      track.label.toLowerCase().includes('canvas') ||
      (track.constructor && track.constructor.name === 'CanvasCaptureMediaStreamTrack') ||
      (!settings.deviceId && track.label.includes('MediaStreamTrack'));
  }

  /**
   * 初始化 DataChannel
   */
  _initDataChannel(event) 
  {
    logger.debug(`${this._id} initDataChannel() ${JSON.stringify(event)}`);

    // 内部变量
    let datachannel;

    /**
     * 异常处理
     */
    if (event && event.channel) 
    {
      this._dataChannel = datachannel = event.channel;
    }
    else 
    {
      // 如果是DataChannel的发起方则创建DataChannel
      this._dataChannel = datachannel = this._connection.createDataChannel(this._dataChannelName, this._dataChannelConfig);
    }
    // 特殊场景存在createDataChannel不成功的问题 See: https://github.com/feross/simple-peer/issues/163
    if (!datachannel) 
    {
      logger.error(`${this._id} Data channel event is missing \`channel\` property`);

      return;
    }

    /**
     * 设置DC默认属性
     */
    datachannel.binaryType = 'arraybuffer';
    this._dataChannelName = datachannel.label;

    /**
     * 事件监听
     */
    datachannel.onmessage = (ev) => 
    {
      // 收到数据
      this._onChannelMessage(ev);
    };

    // 端口状态处于 established 的时候会触发
    datachannel.onopen = () => 
    {
      logger.warn(`${this._id} datachannel opened.`);

      this._dataChannelReady = true;
      // 开始发送心跳消息
      this._sendHello();
      this._bfcpHeatbeatTimer = setInterval(() => 
      {
        this._sendHello();
      }, CRTC_C.BFCP_HEARTBEAT_INTERVAL);
    };

    datachannel.onclose = () => 
    {
      // 底层链路被关闭的时候会触发
      this._onChannelClose();
    };

    // 遇到错误的时候会触发
    datachannel.onerror = (ev) => 
    {
      logger.error(`${this._id} datachannel error.`);
      const err = ev.error instanceof Error
        ? ev.error
        : new Error(`Datachannel error: ${ev.message} ${ev.filename}:${ev.lineno}:${ev.colno}`);

      this._dataChannelReady = false;
      logger.warn(`${this._id} data err: `, err);

      // 异常重连
      if (this.connection.iceConnectionState === 'connected') 
      {
        this.renegotiate();
      }
    };

    // HACK: Chrome will sometimes get stuck in readyState "closing", let's check for this condition
    // https://bugs.chromium.org/p/chromium/issues/detail?id=882743
    let isClosing = false;

    this._closingInterval = setInterval(() => 
    {
      // No "onclosing" event
      if (datachannel && datachannel.readyState === 'closing') 
      {
        // closing timed out: equivalent to onclose firing
        if (isClosing) this._onChannelClose();
        isClosing = true;
      }
      else 
      {
        isClosing = false;
      }
    }, CRTC_C.CHANNEL_CLOSING_TIMEOUT);

    return datachannel;
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

      if (!conn || conn.connectionState !== 'connected' || !this._is_confirmed || this._enableBFCP)
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
