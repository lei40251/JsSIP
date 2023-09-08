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

const logger = new Logger('RTCSession');

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

    super();

    this._id = null;
    this._ua = ua;
    this._status = C.STATUS_NULL;
    this._dialog = null;
    this._earlyDialogs = {};
    this._contact = null;
    this._from_tag = null;
    this._to_tag = null;

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
    // 恢复摄像头轨道用
    this._restoreCameraTrackCanvas = null;
    this._restoreCameraTrackCtx = null;
    this._restoreCameraTrackDraw = null;

    // 本地分享媒体：图片、视频、屏幕等.
    this._localShareRTPSender = null;
    this._localShareStream = null;
    this._localShareStreamLocallyGenerated = false;

    // 本地摄像头
    this._localCameras = [];
    this._selectedLocalCameras = null;

    // Flag to indicate PeerConnection ready for new actions.
    this._rtcReady = true;

    // Flag to indicate ICE candidate gathering is finished even if iceGatheringState is not yet 'complete'.
    this._iceReady = false;

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
    logger.debug('connect()');

    const originalTarget = target;
    const eventHandlers = Utils.cloneObject(options.eventHandlers);
    const mediaStream = options.mediaStream || null;
    const pcConfig = Utils.cloneObject(options.pcConfig, { iceServers: [] });
    const rtcConstraints = options.rtcConstraints || null;
    const rtcOfferConstraints = options.rtcOfferConstraints || null;
    const extraHeaders = Utils.cloneArray(options.extraHeaders);

    this._inviteMediaConstraints = Utils.cloneObject(options.mediaConstraints, {
      audio : true,
      video : true
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

    // 适配浏览器M79以后Chrome默认使用mDNS主机名隐藏WebRTC暴露的本地IP
    return Promise.resolve()
      // Get a stream if required.
      .then(() =>
      {
        // A stream is given, let the app set events such as 'peerconnection' and 'connecting'.
        if (mediaStream)
        {
          return mediaStream;
        }
        // Request for user media access.
        else if (this._inviteMediaConstraints.audio || this._inviteMediaConstraints.video)
        {
          this._localMediaStreamLocallyGenerated = true;

          // 判断授权是否包含视频
          if (Number(this._ua.sk[7]) < 1)
          {
            delete this._inviteMediaConstraints.video;
          }

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

          const mStream = navigator.mediaDevices.getUserMedia(currMediaConstraints)
            .catch((error) =>
            {
              if (this._status === C.STATUS_TERMINATED)
              {
                throw new Error('terminated');
              }

              this._failed('local', null, CRTC_C.causes.USER_DENIED_MEDIA_ACCESS);

              logger.warn('emit "getusermediafailed" [error:%o]', error);
              logger.warn(`emit "getusermediafailed" [error:%o]${JSON.stringify(error)}`);

              this.emit('getusermediafailed', error);

              throw error;
            });

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

          logger.debug(`local ${track.kind} track state: ${JSON.stringify(trackObj)} ***** settings: ${JSON.stringify(track.getSettings())} ***** constraints: ${JSON.stringify(track.getConstraints())} ***** capabilities: ${JSON.stringify(track.getCapabilities())}`);

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
                }

                if (track.readyState != trackStat.readyState)
                {
                  trackStat.readyState = track.readyState;
                  this.emit('videoTrackState', { track, properties: 'readyState', value: track.readyState });
                }

                if (track.muted != trackStat.muted || track.mute == true)
                {
                  trackStat.muted = track.muted;
                  this.emit('videoTrackState', { track, properties: 'muted', value: track.muted });
                }

                if (track.label != trackStat.label)
                {
                  trackStat.label = track.label;
                  this.emit('videoTrackState', { track, properties: 'label', value: track.label });
                }
              }
              else
              {
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
    logger.debug('init_incoming()');

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

    // Fire 'newRTCSession' event.
    this._newRTCSession('remote', request);

    // The user may have rejected the call in the 'newRTCSession' event.
    if (this._status === C.STATUS_TERMINATED)
    {
      return;
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
    logger.debug('answer()');

    const request = this._request;
    const extraHeaders = Utils.cloneArray(options.extraHeaders);
    const mediaConstraints = Utils.cloneObject(options.mediaConstraints);
    const mediaStream = options.mediaStream || null;
    const pcConfig = Utils.cloneObject(options.pcConfig, { iceServers: [] });
    const rtcConstraints = options.rtcConstraints || null;
    const rtcAnswerConstraints = options.rtcAnswerConstraints || null;
    const rtcOfferConstraints = Utils.cloneObject(options.rtcOfferConstraints);

    let tracks;
    let peerHasAudioLine = false;
    let peerHasVideoLine = false;
    let peerOffersFullAudio = false;
    let peerOffersFullVideo = false;

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

    Promise.resolve()
      // Handle local MediaStream.
      .then(() =>
      {
        // A local MediaStream is given, use it.
        if (mediaStream)
        {
          return mediaStream;
        }

        // Audio and/or video requested, prompt getUserMedia.
        else if (mediaConstraints.audio || mediaConstraints.video)
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
          if (!mediaConstraints.video)
          {
            this._localToAudio = true;
          }

          const mStream = navigator.mediaDevices.getUserMedia(mediaConstraints)
            .catch((error) =>
            {
              if (this._status === C.STATUS_TERMINATED)
              {
                throw new Error('terminated');
              }

              request.reply(480);
              this._failed('local', null, CRTC_C.causes.USER_DENIED_MEDIA_ACCESS);

              logger.warn('emit "getusermediafailed" [error:%o]', error);
              logger.warn(`emit "getusermediafailed" [error:%o]${JSON.stringify(error)}`);

              this.emit('getusermediafailed', error);

              throw new Error('getUserMedia() failed');
            });


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
      })
      // Attach MediaStream to RTCPeerconnection.
      .then((stream) =>
      {
        if (this._status === C.STATUS_TERMINATED)
        {
          throw new Error('terminated');
        }

        this._localMediaStream = stream;

        if (stream)
        {
          const videoTrackStates = new Map();

          stream.getTracks().forEach((track) =>
          {
            const trackObj = `id:${track.id} enabled:${track.enabled} readyState:${track.readyState} muted:${track.muted} label:${track.label}`;

            logger.debug(`local ${track.kind} track state: ${JSON.stringify(trackObj)} ***** settings: ${JSON.stringify(track.getSettings())} ***** constraints: ${JSON.stringify(track.getConstraints())} ***** capabilities: ${JSON.stringify(track.getCapabilities())}`);

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
                  }

                  if (track.readyState != trackStat.readyState)
                  {
                    trackStat.readyState = track.readyState;
                    this.emit('videoTrackState', { track, properties: 'readyState', value: track.readyState });
                  }

                  if (track.muted != trackStat.muted || track.mute == true)
                  {
                    trackStat.muted = track.muted;
                    this.emit('videoTrackState', { track, properties: 'muted', value: track.muted });
                  }

                  if (track.label != trackStat.label)
                  {
                    trackStat.label = track.label;
                    this.emit('videoTrackState', { track, properties: 'label', value: track.label });
                  }
                }
                else
                {
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
        const e = { originator: 'remote', type: 'offer', sdp: newSdp };

        logger.debug('emit "sdp"');
        this.emit('sdp', e);

        const offer = new RTCSessionDescription({ type: 'offer', sdp: e.sdp });

        this._connectionPromiseQueue = this._connectionPromiseQueue
          .then(() => this._connection.setRemoteDescription(offer))
          .catch((error) =>
          {
            request.reply(488);

            this._failed('system', null, CRTC_C.causes.WEBRTC_ERROR);

            logger.warn('emit "peerconnection:setremotedescriptionfailed" [error:%o]', error);
            logger.warn(`emit "peerconnection:setremotedescriptionfailed" [error:%o]${JSON.stringify(error)}`);

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
            .catch(() =>
            {
              request.reply(500);

              throw new Error('_createLocalDescription() failed');
            });
        }
        else
        {
          return this._createLocalDescription('offer', this._rtcOfferConstraints)
            .catch(() =>
            {
              request.reply(500);

              throw new Error('_createLocalDescription() failed');
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
  upgradeToVideo()
  {
    logger.debug('upgradeToVideo()');

    if (this._ua.sk[7] < 2)
    {
      return;
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

    this._localToAudio = false;
    this._localToVideo = true;

    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) =>
      {
        // 适配 iOS 15.1/15.2 crach 的 bug，webkit Bug https://bugs.webkit.org/show_bug.cgi?id=232006
        let ua;

        navigator.userAgent && (ua = navigator.userAgent.toLowerCase().match(/cpu iphone os (.*?) like mac os/));
        if ((ua && ua[1]) && (ua[1].includes('15_1') || ua[1].includes('15_2')))
        {
          stream = Utils.getStreamThroughCanvas(stream);
        }

        const videoTracks = stream.getVideoTracks();

        this._localMediaStream.addTrack(videoTracks[0]);

        // 兼容低版本浏览器不支持addTrack的情况
        if (RTCPeerConnection.prototype.addTrack)
        {
          this._connection.addTrack(videoTracks[0], this._localMediaStream);
        }
        else
        {
          this._connection.addStream(stream);
        }
      })
      .then(() =>
      {
        this._iceReady = false;

        this.renegotiate({ rtcOfferConstraints: { iceRestart: true } });
      });
  }

  /**
   * 切换到音频模式
   */
  demoteToAudio(options={}, done)
  {
    logger.debug('demoteToAudio()');

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

  /**
   * 切换设备，一般用于切换摄像头
   */
  async switchDevice(type, deviceId)
  {
    logger.debug(`switchDevice(), type:${type}, deviceId:${deviceId}`);

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
    if (type=== 'camera')
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
            videoConstraints = { deviceId: { exact: deviceId } };
          }
          else if (this._localCameras.length === 2)
          {
            // 不传deviceId情况下，如果有两个摄像头则使用facingMode参数
            let facingMode;

            if (this._selectedLocalCameras === 'user')
            {
              facingMode = 'environment';
              this._selectedLocalCameras = 'environment';
            }
            else
            {
              facingMode = 'user';
              this._selectedLocalCameras = 'user';
            }
            // 两个摄像头使用facingMode参数切换
            videoConstraints = { facingMode: facingMode };
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
            else if (this._localCameras.indexOf(this._selectedLocalCameras) == (this._localCameras.length-1))
            {
              did= this._localCameras[0];
              this._selectedLocalCameras = this._localCameras[0];
            }
            else
            {
              did = this._localCameras[(this._localCameras.indexOf(this._selectedLocalCameras)+1)];
              this._selectedLocalCameras = this._localCameras[(this._localCameras.indexOf(this._selectedLocalCameras)+1)];
            }

            videoConstraints = { deviceId: did };
          }
          else
          {
            // 如果没有deviceId且少于两个摄像头则不处理切换摄像头操作
            logger.warn('not enough cameras.');

            return;
          }

          this._connection.getSenders().find((s) =>
          {
            logger.debug(`kind: ${s.track.kind}`);
            if (s.track.kind == 'video')
            {
              s.track.stop();
            }
          });

          this._localMediaStreamLocallyGenerated = true;

          constraints.video = videoConstraints;

          return navigator.mediaDevices
            .getUserMedia(constraints)
            .catch((error) =>
            {
              logger.error('emit "getusermediafailed" [error:%o]', error);
              logger.error(`emit "getusermediafailed" [error:%o]${JSON.stringify(error)}`);
              this.emit('getusermediafailed', error);
              throw new Error('getUserMedia() failed');
            });
        })
        .then((stream) =>
        {
          // 适配 iOS 15.1/15.2 crach 的 bug，webkit Bug https://bugs.webkit.org/show_bug.cgi?id=232006
          let ua;

          navigator.userAgent && (ua = navigator.userAgent.toLowerCase().match(/cpu iphone os (.*?) like mac os/));
          if ((ua && ua[1]) && (ua[1].includes('15_1') || ua[1].includes('15_2')))
          {
            stream = Utils.getStreamThroughCanvas(stream);
          }

          this._localMediaStream.removeTrack(this._localMediaStream.getVideoTracks()[0]);

          const videoTrack = stream.getVideoTracks()[0];

          this._localMediaStream.addTrack(videoTrack);

          const sender = this._connection.getSenders().find((s) =>
          {
            return s.track.kind == 'video';
          });

          sender.replaceTrack(videoTrack);

          this.emit('cameraChanged', { videoStream: stream });

          return stream;
        });
    }
    else
    {
      return false;
    }
  }

  /**
   * 分享媒体
   */
  share(type, id, assembly, dual)
  {
    logger.debug('share()');

    // Check Session Status.
    if (
      this._status !== C.STATUS_CONFIRMED &&
      this._status !== C.STATUS_WAITING_FOR_ACK &&
      this._status !== C.STATUS_1XX_RECEIVED
    )
    {
      throw new Exceptions.InvalidStateError(this._status);
    }

    let timer;
    const element = document.querySelector(id);

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
      logger.debug('share video');

      this._localShareStream = element.captureStream(0);

      this._localShareStreamLocallyGenerated = true;

      this._streamInactiveHandle(dual);

      this._localShareStream.getVideoTracks()
        .forEach((track) =>
        {
          if (dual)
          {
            this._localShareRTPSender = this._connection.addTrack(track, element.captureStream(0));
            this.renegotiate({ rtcOfferConstraints: { iceRestart: true } });
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
      logger.debug('share pic');

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
            this._localShareRTPSender = this._connection.addTrack(track, canvas.captureStream(15));
            this.renegotiate({ rtcOfferConstraints: { iceRestart: true } });
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
      logger.debug('share html');

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
            this._localShareRTPSender = this._connection.addTrack(track, canvas.captureStream(15));
            this.renegotiate({ rtcOfferConstraints: { iceRestart: true } });
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
      logger.debug('share screen');

      // 判断浏览器是否兼容获取屏幕分享
      if (!(navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices))
      {
        logger.warn('getDisplayMedia is not supported');
        this.emit('getdisplaymediafailed');
      }

      this._localShareStreamLocallyGenerated = true;

      // 分享屏幕 默认帧率 5
      navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 } })
        .then((stream) =>
        {
          this._localShareRTPSender = null;
          this._localShareStream = stream;

          this._streamInactiveHandle(dual);

          // 替换流方式分享屏幕
          stream.getVideoTracks().forEach((track) =>
          {
            if (dual)
            {
              this._localShareRTPSender = this._connection.addTrack(track, stream);
              this.renegotiate({ rtcOfferConstraints: { iceRestart: true } });
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

        })
        .catch((error) =>
        {
          logger.warn('emit "getdisplaymediafailed" [error:%o]', error);
          logger.warn(`emit "getdisplaymediafailed" [error:%o]${JSON.stringify(error)}`);
          this.emit('getdisplaymediafailed', error);
          throw new Error('getDisplayMedia() failed');
        });
    }
  }

  /**
   * 停止分享媒体
   */
  unShare()
  {
    logger.debug('unShare()');

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
    logger.debug('terminate()');

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
        logger.debug('canceling session');

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
        logger.debug('rejecting session');

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
        logger.debug('terminating session');

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
    logger.debug('sendDTMF() | tones: %s', tones);

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
      logger.debug(`"duration" value is lower than the minimum allowed, setting it to ${RTCSession_DTMF.C.MIN_DURATION} milliseconds`);
      duration = RTCSession_DTMF.C.MIN_DURATION;
    }
    else if (duration > RTCSession_DTMF.C.MAX_DURATION)
    {
      logger.debug(`"duration" value is greater than the maximum allowed, setting it to ${RTCSession_DTMF.C.MAX_DURATION} milliseconds`);
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
      logger.debug(`"interToneGap" value is lower than the minimum allowed, setting it to ${RTCSession_DTMF.C.MIN_INTER_TONE_GAP} milliseconds`);
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
    logger.debug('sendInfo()');

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
  mute(options = { audio: true, video: false })
  {
    logger.debug('mute()');

    let audioMuted = false, videoMuted = false;

    if (options.audio)
    {
      audioMuted = true;
      this._audioMuted = true;
      this._toggleMuteAudio(true);
    }

    if (options.video)
    {
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
    logger.debug('unmute()');

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
   * Hold
   */
  hold(options = {}, done)
  {
    logger.debug('hold()');

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
    logger.debug('unhold()');

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
    logger.debug('renegotiate()');

    const rtcOfferConstraints = options.rtcOfferConstraints || null;

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
          cause         : CRTC_C.causes.WEBRTC_ERROR,
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
    logger.debug('refer()');

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
    logger.debug('sendRequest()');

    return this._dialog.sendRequest(method, options);
  }

  /**
   * In dialog Request Reception
   */
  receiveRequest(request)
  {
    logger.debug('receiveRequest()');

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

            logger.debug('emit "sdp"');
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

                logger.warn('emit "peerconnection:setremotedescriptionfailed" [error:%o]', error);
                logger.warn(`emit "peerconnection:setremotedescriptionfailed" [error:%o]${JSON.stringify(error)}`);
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
    logger.warn('onTransportError()');

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
    logger.warn('onRequestTimeout()');

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
    logger.warn('onDialogError()');

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
    logger.debug('newDTMF()');

    this.emit('newDTMF', data);
  }

  // Called from Info handler.
  newInfo(data)
  {
    logger.debug('newInfo()');

    this.emit('newInfo', data);
  }

  // for 3pcc, Called from Notify handler.
  newNotify(data)
  {
    logger.debug('newNotify()');

    this.emit('newNotify', data);
  }

  /**
   * Check if RTCSession is ready for an outgoing re-INVITE or UPDATE with SDP.
   */
  _isReadyToReOffer()
  {
    if (!this._rtcReady)
    {
      logger.debug('_isReadyToReOffer() | internal WebRTC status not ready');

      return false;
    }

    // No established yet.
    if (!this._dialog)
    {
      logger.debug('_isReadyToReOffer() | session not established yet');

      return false;
    }

    // Another INVITE transaction is in progress.
    if (this._dialog.uac_pending_reply === true ||
        this._dialog.uas_pending_reply === true)
    {
      logger.debug('_isReadyToReOffer() | there is another INVITE/UPDATE transaction in progress');

      return false;
    }

    return true;
  }

  _close()
  {
    logger.debug('close()');
    // Close local MediaStream if it was not given by the user.
    if (this._localMediaStream && this._localMediaStreamLocallyGenerated)
    {
      logger.debug('close() | closing local MediaStream');

      Utils.closeMediaStream(this._localMediaStream);
    }

    if (this._localShareStream)
    {
      logger.debug('close() | closing local MediaStream');

      Utils.closeMediaStream(this._localShareStream);
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
        logger.warn('close() | error closing the RTCPeerConnection: %o', error);
        logger.warn(`close() | error closing the RTCPeerConnection: %o${JSON.stringify(error)}`);
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
        logger.debug('no ACK received, terminating the session');

        clearTimeout(this._timers.invite2xxTimer);
        this.sendRequest(CRTC_C.BYE);
        this._ended('remote', null, CRTC_C.causes.NO_ACK);
      }
    }, Timers.TIMER_H);
  }

  _createRTCConnection(pcConfig, rtcConstraints)
  {
    // 是否成功连接过
    let successfullyConnected = false;

    this._connection = new RTCPeerConnection(pcConfig, rtcConstraints);

    this._connection.addEventListener('iceconnectionstatechange', () =>
    {
      const state = this._connection.iceConnectionState;

      this.emit('peerconnection:iceConnectionState', state);

      logger.warn(`emit "peerconnection:iceConnectionState" ${state}`);

      // 成功连接过
      if (state === 'connected')
      {
        successfullyConnected = true;
      }

      // 如果没有成功连接过，挂断通话；成功连接过则重新协商
      // TODO: Do more with different states.
      if (state === 'failed' || state === 'disconnected')
      {
        if (!successfullyConnected)
        {
          this.terminate({
            cause         : CRTC_C.causes.RTP_TIMEOUT,
            status_code   : 408,
            reason_phrase : CRTC_C.causes.RTP_TIMEOUT
          });
        }
        else
        {
        // RTCPeerConnection failed断开后启动重新协商
          this.renegotiate({ rtcOfferConstraints: { iceRestart: true } });
        }
      }
    });

    logger.debug('emit "peerconnection"');

    this.emit('peerconnection', {
      peerconnection : this._connection
    });
  }

  _createLocalDescription(type, constraints)
  {
    logger.debug('createLocalDescription()');

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
              logger.warn('emit "peerconnection:createofferfailed" [error:%o]', error);
              logger.warn(`emit "peerconnection:createofferfailed" [error:%o]${JSON.stringify(error)}`);

              this.emit('peerconnection:createofferfailed', error);

              return Promise.reject(error);
            });
        }
        else
        {
          return connection.createAnswer(constraints)
            .catch((error) =>
            {
              logger.warn('emit "peerconnection:createanswerfailed" [error:%o]', error);
              logger.warn(`emit "peerconnection:createanswerfailed" [error:%o]${JSON.stringify(error)}`);

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
            // 处理视频呼叫音频接听后再切换视频时 mid 值问题
            media.mid = index;
            mids.push(index);

            if (media.type === 'video')
            {
              let lowH264 = false;
              const delH264Payload = [];
              const payloads = media.payloads.split(' ');

              media.fmtp.forEach((fmtp) =>
              {
                if (fmtp.config.indexOf('profile-level-id=42e0') !== -1)
                {
                  lowH264 = true;
                }

                if (fmtp.config.indexOf('packetization-mode=0') !== -1 || (fmtp.config.indexOf('packetization-mode') !== -1 && fmtp.config.indexOf('profile-level-id=42') === -1))
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

              media.payloads = payloads.filter((x) => !delH264Payload.some((i) => i==x)).join(' ');

              if (media.fmtp)
              {
                media.fmtp = media.fmtp.filter((r) => delH264Payload.indexOf(r.payload) == -1);
              }

              if (media.rtp)
              {
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
              delete media.ext;
              if (media.type === 'video')
              {
                media.ext = [ { value: 13, uri: 'urn:3gpp:video-orientation' } ];
                media.invalid = [ { value: 'tcap:1 RTP/AVPF' }, { value: 'pcfg:1 t=1' } ];
              }
            }
          });

          // 处理视频呼叫音频接听后再切换视频时 mid 值问题
          sdp.groups[0].mids = mids.join(' ');
          desc.sdp = sdp_transform.write(sdp);
        }

        sdp.media.forEach((media) =>
        {
          /**
           * 处理SDP的码率配置
           */
          if (media.type === 'video')
          {
            media.bandwidth = [ { type: 'AS', limit: 960 } ];
          }
          else if (media.type === 'audio')
          {
            media.bandwidth = [ { type: 'AS', limit: 90 } ];
          }
        });

        sdp.bandwidth = [ { type: 'AS', limit: 1050 } ];
        desc.sdp = sdp_transform.write(sdp);

        // 兼容chrome<71版本  https://github.com/webrtcHacks/adapter/issues/919
        desc.sdp = desc.sdp.replace(/a=extmap-allow-mixed.*\r\n/g, '');

        return connection.setLocalDescription(desc)
          .catch((error) =>
          {
            this._rtcReady = true;

            logger.warn('emit "peerconnection:setlocaldescriptionfailed" [error:%o]', error);
            logger.warn(`emit "peerconnection:setlocaldescriptionfailed" [error:%o]${JSON.stringify(error)}`);

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

          logger.debug('emit "sdp"');

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

            logger.debug('emit "sdp"');

            this.emit('sdp', e);

            resolve(e.sdp);
          };

          connection.addEventListener('icecandidate', iceCandidateListener = (event) =>
          {
            const candidate = event.candidate;

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
            if ((connection.iceGatheringState === 'complete') && !finished)
            {
              ready();
            }

            // 超时自动ready
            if (connection.iceGatheringState === 'gathering')
            {
              setTimeout(() =>
              {
                ready();
              }, 5000);
            }

          });
        });
      })
      .then((sdp) =>
      {
        // 去掉IPV6
        sdp = sdp.replace(/a=candidate:.*:.*\r\n/g, '');

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
              // m.direction = 'inactive';
            }

            if (m.port !== 0)
            {
              (this._mode === '') && (this._mode = 'video');
              this._localToAudio = false;
              this._localToVideo = true;
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
            // const direction = m.direction;

            if (this._localToAudio)
            {
              if (m.direction != 'recvonly')
              {
                m.port = 0;
              }
              // m.direction = 'inactive';
              if (this._remoteHold)
              {
                m.port = port;
                // m.direction = direction;
              }
              this._ontogglemode('audio');
            }
            else
            {
              this._ontogglemode('video');
            }
          }

        }

        sdp_desc.media.forEach((media) =>
        {
          /**
            * 处理5G外呼sdp过大问题,
            * SDK只对H264过滤保留两个,以兼容其他通用端,SBC对外呼手机的呼叫做媒体过滤
            */
          if (this._ua.sk[7] >= 3)
          {
            if (media.type === 'video')
            {
              media.bandwidth = [ { type: 'AS', limit: 960 }, { type: 'RR', limit: 6000 }, { type: 'RS', limit: 8000 } ];
              media.invalid = [ { value: 'tcap:1 RTP/AVPF' }, { value: 'pcfg:1 t=1' } ];
            }
            else if (media.type === 'audio')
            {
              media.bandwidth = [ { type: 'AS', limit: 90 }, { type: 'RR', limit: 600 }, { type: 'RS', limit: 2000 } ];
            }

            sdp_desc.bandwidth = [ { type: 'AS', limit: 1050 }, { type: 'RR', limit: 6600 }, { type: 'RS', limit: 10000 } ];
          }
        });

        return sdp_transform.write(sdp_desc);
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
    logger.debug('receiveReinvite()');

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
        .catch(() =>
        {
          request.reply(500);
        });

      return;
    }

    // Request with SDP.
    if (contentType !== 'application/sdp')
    {
      logger.debug('invalid Content-Type');
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
          if (request.body.indexOf('tcap:1 RTP/AVPF') && desc)
          {
            desc = desc.replace(/a=mid:1\r\n/, 'a=mid:1\r\na=cc-xfb\r\n');
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
      let mediaIndex = 0;

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

        // waiting = true;

        if (mediaIndex == 1 && (m.port === 0 || (m.port === 0 && this._mode === 'video')))
        {
          this._ontogglemode('audio');
          // this._localToAudio = true;
          // this._localToVideo = false;
          // nextS.call(this);
        }
        else if (this._mode === 'audio')
        {
          waiting = true;
          // 触发切换事件，要求用户授权
          this._remoteToVideo = true;
          this._remoteToAudio = false;

          this._localToAudio = false;
          this._localToVideo =true;

          if (this.listeners('upgradeToVideo').length === 0)
          {
            this._localToAudio = false;
            nextS.call(this);
          }
          else
          {
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
          // this._localToAudio = true;
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

      this._handleSessionTimersInIncomingRequest(request, extraHeaders);

      if (this._late_sdp)
      {
        desc = this._mangleOffer(desc);
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
    logger.debug('receiveUpdate()');

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
      logger.debug('invalid Content-Type');

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
          if (request.body.indexOf('tcap:1 RTP/AVPF') && desc)
          {
            desc = desc.replace(/a=mid:1\r\n/, 'a=mid:1\r\na=cc-xfb\r\n');
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

        // waiting = true;
        if (m.port === 0 || (m.port === 0 && this._mode === 'video'))
        {
          this._ontogglemode('audio');
          // this._localToAudio = true;
          // this._localToVideo = false;
          // nextS.call(this);
        }
        else
        {
          waiting = true;
          // 触发切换事件，要求用户授权
          this._remoteToVideo = true;
          this._remoteToAudio = false;

          this._localToAudio = false;
          this._localToVideo =true;

          if (this.listeners('upgradeToVideo').length === 0)
          {
            this._localToAudio = false;
            nextS.call(this);
          }
          else
          {
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
        this._localToAudio = true;
        this._localToVideo = false;
        nextS.call(this);
      }
    }

    function sendAnswer(desc)
    {
      const extraHeaders = [ `Contact: ${this._contact}` ];

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
    logger.debug('_processInDialogSdpOffer()');

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

    const newSdp = this._sdpAddMid(request.body);
    const e = { originator: 'remote', type: 'offer', sdp: newSdp };

    logger.debug('emit "sdp"');
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
            logger.warn('emit "peerconnection:setremotedescriptionfailed" [error:%o]', error);
            logger.warn(`emit "peerconnection:setremotedescriptionfailed" [error:%o]${JSON.stringify(error)}`);

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
        // 适配 100rel 调整 hold 的判断
        if (this._remoteToVideo && this._notHold)
        {
          return navigator.mediaDevices.getUserMedia({ video: true })
            .catch((error) =>
            {
              if (this._status === C.STATUS_TERMINATED)
              {
                throw new Error('terminated');
              }

              this._failed('local', null, CRTC_C.causes.USER_DENIED_MEDIA_ACCESS);

              logger.warn('emit "getusermediafailed" [error:%o]', error);
              logger.warn(`emit "getusermediafailed" [error:%o]${JSON.stringify(error)}`);

              this.emit('getusermediafailed', error);

              throw error;
            });
        }
      })
      .then((stream) =>
      {
        if (stream)
        {
          // 适配 iOS 15.1/15.2 crach 的 bug，webkit Bug https://bugs.webkit.org/show_bug.cgi?id=232006
          let ua;

          navigator.userAgent && (ua = navigator.userAgent.toLowerCase().match(/cpu iphone os (.*?) like mac os/));
          if ((ua && ua[1]) && (ua[1].includes('15_1') || ua[1].includes('15_2')))
          {
            stream = Utils.getStreamThroughCanvas(stream);
          }

          stream.getVideoTracks().forEach((track) =>
          {
            this._localMediaStream.addTrack(track);

            // 兼容低版本浏览器不支持addTrack的情况
            if (RTCPeerConnection.prototype.addTrack)
            {
              this._connection.addTrack(track, stream);
            }
            else
            {
              this._connection.addStream(stream);
            }
          });
          this._iceReady = false;
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
            logger.warn('emit "peerconnection:createtelocaldescriptionfailed" [error:%o]', error);
            logger.warn(`emit "peerconnection:createtelocaldescriptionfailed" [error:%o]${JSON.stringify(error)}`);

            throw error;
          });
      })
      .catch((error) =>
      {
        logger.warn('_processInDialogSdpOffer() failed [error: %o]', error);
        logger.warn(`_processInDialogSdpOffer() failed [error: %o]${JSON.stringify(error)}`);
      });

    return this._connectionPromiseQueue;
  }

  /**
   * In dialog Refer Reception
   */
  _receiveRefer(request)
  {
    logger.debug('receiveRefer()');

    if (!request.refer_to)
    {
      logger.debug('no Refer-To header field present in REFER');
      request.reply(400);

      return;
    }

    if (request.refer_to.uri.scheme !== CRTC_C.SIP)
    {
      logger.debug('Refer-To header field points to a non-SIP URI scheme');
      request.reply(416);

      return;
    }

    // Reply before the transaction timer expires.
    request.reply(202);

    const notifier = new RTCSession_ReferNotifier(this, request.cseq);

    logger.debug('emit "refer"');

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
      initCallback = (typeof initCallback === 'function')? initCallback : null;

      if (this._status !== C.STATUS_WAITING_FOR_ACK &&
          this._status !== C.STATUS_CONFIRMED)
      {
        return false;
      }

      const session = new RTCSession(this._ua);

      session.on('progress', ({ response }) =>
      {
        notifier.notify(response.status_code, response.reason_phrase);
      });

      session.on('accepted', ({ response }) =>
      {
        notifier.notify(response.status_code, response.reason_phrase);
      });

      session.on('_failed', ({ message, cause }) =>
      {
        if (message)
        {
          notifier.notify(message.status_code, message.reason_phrase);
        }
        else
        {
          notifier.notify(487, cause);
        }
      });

      // Consider the Replaces header present in the Refer-To URI.
      if (request.refer_to.uri.hasHeader('replaces'))
      {
        const replaces = decodeURIComponent(request.refer_to.uri.getHeader('replaces'));

        options.extraHeaders = Utils.cloneArray(options.extraHeaders);
        options.extraHeaders.push(`Replaces: ${replaces}`);
      }

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
    logger.debug('receiveNotify()');

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
    logger.debug('receiveReplaces()');

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
      logger.debug('Replaced INVITE rejected by the user');
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

        this._localMediaStream = mediaStream;
        this._replaceAudioTrack = false;

        let sendStream = new MediaStream();
        const mics = await Utils.getMicrophones();

        // 兼容安卓微信Bug及iOS蓝牙问题
        if ((navigator.userAgent.indexOf('WeChat') != -1) || (navigator.userAgent.indexOf('iPhone') !=-1 && mics.length > 1))
        {
          sendStream.addTrack(this._generateAnEmptyAudioTrack());
          sendStream.addTrack(mediaStream.getVideoTracks()[0]);

          this._replaceAudioTrack = true;
        }
        else
        {
          sendStream = mediaStream;
        }

        if (sendStream)
        {
          // 兼容低版本浏览器不支持addTrack的情况
          if (RTCPeerConnection.prototype.addTrack)
          {
            sendStream.getTracks().forEach((track) =>
            {
              this._connection.addTrack(track, sendStream);
            });
          }
          else
          {
            this._connection.addStream(sendStream);
          }
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

        this._request.body = desc;
        this._status = C.STATUS_INVITE_SENT;

        logger.debug('emit "sending" [request:%o]', this._request);

        const cache = [];

        logger.debug(`emit "sending" [request:%o] ${JSON.stringify(this._request, function(key, value)
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
      logger.warn('sendDTMF() | no local audio track to send DTMF with');

      return;
    }

    return sender.dtmf;
  }

  /**
   * Reception of Response for Initial INVITE
   */
  _receiveInviteResponse(response)
  {
    logger.debug('receiveInviteResponse()');

    // Handle 2XX retransmissions and responses from forked requests.
    if (this._dialog && (response.status_code >=200 && response.status_code <=299))
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
        break;

      case /^1[0-9]{2}$/.test(response.status_code):
      {
        // Do nothing with 1xx responses without To tag.
        if (!response.to_tag)
        {
          logger.debug('1xx response received without to tag');
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
              if (response.getHeader('require') === '100rel' && Boolean(response.getHeader('rseq')))
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

        logger.debug('emit "sdp"');
        this.emit('sdp', e);

        const answer = new RTCSessionDescription({ type: 'answer', sdp: e.sdp });

        this._connectionPromiseQueue = this._connectionPromiseQueue
          .then(() => this._connection.setRemoteDescription(answer))
          // 发送 RFC3262 183 PRACK
          .then(() =>
          {
            if (response.getHeader('require') === '100rel' && Boolean(response.getHeader('rseq')))
            {
              this._earlyDialogs[Object.keys(this._earlyDialogs)[0]].sendRequest(CRTC_C.PRACK, { RSeq: response.getHeader('rseq') });
            }
          })
          .then(() => this._progress('remote', response))
          .catch((error) =>
          {
            logger.warn('emit "peerconnection:setremotedescriptionfailed" [error:%o]', error);
            logger.warn(`emit "peerconnection:setremotedescriptionfailed" [error:%o]${JSON.stringify(error)}`);

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
          // 适配 100rel 调整 ack 的 cseq
          this.sendRequest(CRTC_C.ACK);
          this._confirmed('local', null);
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

        logger.debug('emit "sdp"');
        this.emit('sdp', e);

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
                this._confirmed('local', null);

                // 兼容安卓微信Bug及iOS蓝牙问题
                const mics = await Utils.getMicrophones();

                if (this._replaceAudioTrack && navigator.userAgent.indexOf('WeChat') != -1)
                {
                  navigator.mediaDevices.getUserMedia({ audio: this._inviteMediaConstraints.audio || true, video: false })
                    .then((stream) =>
                    {
                      const sender = e.session.connection.getSenders().find((s) =>
                      {
                        return s.track.kind == 'audio';
                      });

                      sender.replaceTrack(stream.getAudioTracks()[0]);
                    });
                }
                else if (this._receiveInviteResponse && (navigator.userAgent.indexOf('iPhone') !=-1 && mics.length > 1))
                {
                  if (this._localMediaStream)
                  {
                    const sender = e.session.connection.getSenders().find((s) =>
                    {
                      return s.track.kind == 'audio';
                    });

                    sender.replaceTrack(this._localMediaStream.getAudioTracks()[0]);
                  }
                }
              })
              .catch((error) =>
              {
                this._acceptAndTerminate(response, 488, 'Not Acceptable Here');
                this._failed('remote', response, CRTC_C.causes.BAD_MEDIA_DESCRIPTION);

                logger.warn('emit "peerconnection:setremotedescriptionfailed" [error:%o]', error);
                logger.warn(`emit "peerconnection:setremotedescriptionfailed" [error:%o]${JSON.stringify(error)}`);

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
    logger.debug('sendReinvite()');

    const extraHeaders = Utils.cloneArray(options.extraHeaders);
    const eventHandlers = Utils.cloneObject(options.eventHandlers);
    const rtcOfferConstraints = options.rtcOfferConstraints ||
      this._rtcOfferConstraints || null;

    let succeeded = false;

    extraHeaders.push(`Contact: ${this._contact}`);

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

        const e = { originator: 'local', type: 'offer', sdp };

        logger.debug('emit "sdp"');
        this.emit('sdp', e);

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

      logger.debug('emit "sdp"');
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

          logger.warn('emit "peerconnection:setremotedescriptionfailed" [error:%o]', error);
          logger.warn(`emit "peerconnection:setremotedescriptionfailed" [error:%o]${JSON.stringify(error)}`);

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
    logger.debug('sendUpdate()');

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

          logger.debug('emit "sdp"');
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

      // Handle Session Timers.
      this._handleSessionTimersInIncomingResponse(response);

      // Must have SDP answer.
      if (sdpOffer)
      {
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

        /**
       * 音视频切换相关
       * 远端接听模式
       * @author: lei
       */
        const sdp_body = sdp_transform.parse(response.body);

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

        const newSdp = this._sdpAddMid(response.body);
        const e = { originator: 'remote', type: 'answer', sdp: newSdp };

        logger.debug('emit "sdp"');
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

            logger.warn('emit "peerconnection:setremotedescriptionfailed" [error:%o]', error);
            logger.warn(`emit "peerconnection:setremotedescriptionfailed" [error:%o]${JSON.stringify(error)}`);

            this.emit('peerconnection:setremotedescriptionfailed', error);
          });
      }
      // No SDP answer.
      else
      if (eventHandlers.succeeded)
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
    logger.debug('acceptAndTerminate()');

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
      logger.debug('mangleOffer() | me on hold, mangling offer');
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
      logger.debug('mangleOffer() | both on hold, mangling offer');
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
      logger.debug('mangleOffer() | remote on hold, mangling offer');
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
    if (mode === 'audio')
    {
      this._localMediaStream.getVideoTracks().forEach((track) =>
      {
        track.stop();
      });

      this._localShareStream && this._localShareStream.getVideoTracks().forEach((track) =>
      {
        track.stop();
      });
    }
  }

  _streamInactiveHandle(dual)
  {
    // 分享屏幕点击系统停止按钮后停止分享
    this._localShareStream.addEventListener('inactive', () =>
    {
      if (this._localShareStream && this._localShareStreamLocallyGenerated)
      {
        if (dual)
        {
          this._connection.getTransceivers().forEach((transeiver) =>
          {
            if (transeiver.sender.track && transeiver.sender.track.kind === 'video')
            {
              if (transeiver.sender.track.id === this._localShareStream.getTracks()[0].id)
              {
                if (!transeiver.stopped)
                {
                  transeiver.direction = 'inactive';
                }
                transeiver.sender.track.stop();
              }
            }
          });

          this._localShareStream = null;
          this._localShareStreamLocallyGenerated = false;
          this._connection.removeTrack(this._localShareRTPSender);
          this.renegotiate({ rtcOfferConstraints: { iceRestart: true } });
        }
        else
        {
          this._localMediaStream.getVideoTracks().forEach((track) =>
          {
            const sender = this._connection.getSenders().find((s) =>
            {
              return s.track.kind == 'video' && (s.track.label.indexOf('window') === -1 || s.track.label.indexOf('web-') === -1 || s.track.label.indexOf('screen') === -1);
            });

            track.readyState === 'live' && sender.replaceTrack(track);
          });

          this._localShareStreamLocallyGenerated = false;

        }

        this._localShareStream = null;
        this._localShareStreamLocallyGenerated = false;
      }
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

        logger.debug('runSessionTimer() | sending session refresh request');

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

        logger.warn('runSessionTimer() | timer expired, terminating the session');

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
      return sender.track && sender.track.kind === 'video';
    });

    for (const sender of senders)
    {
      sender.track.enabled = !mute;
    }
  }

  _newRTCSession(originator, request)
  {
    logger.debug('newRTCSession()');

    this._ua.newRTCSession(this, {
      originator,
      session : this,
      request
    });
  }

  _connecting(request)
  {
    logger.debug('session connecting');

    logger.debug('emit "connecting"');

    this.emit('connecting', {
      request
    });
  }

  _progress(originator, response)
  {
    logger.debug('session progress');

    logger.debug('emit "progress"');

    this.emit('progress', {
      originator,
      response : response || null
    });
  }

  _accepted(originator, message)
  {
    logger.debug('session accepted');

    this._start_time = new Date();

    logger.debug('emit "accepted"');

    this.emit('accepted', {
      originator,
      response : message || null
    });
  }

  _confirmed(originator, ack)
  {
    logger.debug('session confirmed');

    this._is_confirmed = true;

    // 如果是SDK调用媒体设备，则启动媒体状态监测
    this._localMediaStreamLocallyGenerated && this._checkMediaStreamStatus();

    logger.debug('emit "confirmed"');

    this.emit('confirmed', {
      originator,
      ack : ack || null
    });
  }

  _ended(originator, message, cause)
  {
    logger.debug('session ended');

    this._end_time = new Date();

    this._close();

    logger.debug('emit "ended"');

    this.emit('ended', {
      originator,
      message : message || null,
      cause
    });

    // 停止全部统计信息事件
    window.CRTCStats = 'stop';

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
    logger.debug('session failed');

    // Emit private '_failed' event first.
    logger.debug('emit "_failed"');

    this.emit('_failed', {
      originator,
      message : message || null,
      cause
    });

    // 停止全部统计信息事件
    window.CRTCStats = 'stop';

    this._close();

    logger.debug('emit "failed"');

    this.emit('failed', {
      originator,
      message : message || null,
      cause
    });
  }

  _onhold(originator)
  {
    logger.debug('session onhold');

    this._setLocalMediaStatus();

    logger.debug('emit "hold"');

    this.emit('hold', {
      originator
    });
  }

  _onunhold(originator)
  {
    logger.debug('session onunhold');

    this._setLocalMediaStatus();

    logger.debug('emit "unhold"');

    this.emit('unhold', {
      originator
    });
  }

  _onmute({ audio, video })
  {
    logger.debug('session onmute');

    this._setLocalMediaStatus();

    logger.debug('emit "muted"');

    this.emit('muted', {
      audio,
      video
    });
  }

  _onunmute({ audio, video })
  {
    logger.debug('session onunmute');

    this._setLocalMediaStatus();

    logger.debug('emit "unmuted"');

    this.emit('unmuted', {
      audio,
      video
    });
  }

  // 切换音视频模式触发 mode 事件
  _ontogglemode(mode)
  {
    if (mode === this._mode)
    {
      return;
    }

    this._mode = mode;

    logger.debug('session ontogglemode');

    if (!this._remoteHold)
    {
      this._setLocalMedia(mode);
    }

    logger.debug('emit "mode"');

    this.emit('mode', { mode });
  }

  // sdp 中增加 mid 属性
  _sdpAddMid(sdp)
  {
    if (sdp.indexOf('a=mid:0') === -1)
    {
      const regex = /(m=audio.*\r?\n)([\s\S]*?)(m=video.*\r?\n)([\s\S]*?)(?=(m=|$))/g;
      const replacement = '$1a=mid:0\r\n$2$3a=mid:1\r\n$4';

      return sdp.replace(regex, replacement);
    }
    else
    {
      return sdp;
    }
  }

  /**
   * 生成一个空的音频轨道
   */
  _generateAnEmptyAudioTrack()
  {
    // 增加安卓微信呼叫的语音提醒
    // const audio = new Audio('./sound/waiting.mp3');
    const audio = new Audio(C.RING_AUDIO);
    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();
    const source = audioCtx.createMediaElementSource(audio);

    audio.loop = true;
    audio.crossOrigin = 'anonymous';
    audio.play().catch((error) => { logger.error(`new Audio() error: ${JSON.stringify(error)}`); });
    source.connect(destination);

    return destination.stream.getAudioTracks()[0];
  }

  /**
   * 将临时的canvas视频恢复为麦克风videoTrack
   */
  _replaceAudioToMic()
  {
    // 获取麦克风流，成功后替换canvas视频，失败后重新获取麦克风媒体并替换
    navigator.mediaDevices.getUserMedia({ audio: this._inviteMediaConstraints.audio || true, video: false })
      .then((stream) =>
      {
        this._connection.getSenders().forEach((sender) =>
        {
          if (sender.track.kind == 'audio')
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
            stream.getAudioTracks()[0].addEventListener('mute', this._replaceMicToAudio);
            stream.getAudioTracks()[0].addEventListener('ended', this._replaceMicToAudio);
          }
        });
      })
      .catch((error) =>
      {
        // 获取麦克风失败，重新获取
        logger.error(`replaceAudioToMic error: ${JSON.stringify(error)}`);
        this._replaceAudioToMic();
      });
  }

  /**
   * 先将原来videoTrack替换为canvas视频，并关闭原来videoTrack
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
        sender.track.removeEventListener('mute', this._replaceMicToAudio);
        sender.track.removeEventListener('ended', this._replaceMicToAudio);

        // 释放摄像头
        sender.track.stop();

        // 替换视频轨道
        sender.replaceTrack(this._generateAnEmptyAudioTrack());

        // 本地播放本地视频轨道
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
          if (sender.track.kind == 'video')
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
            sender.track.addEventListener('mute', this._replaceVideoToCanvas);
            sender.track.addEventListener('ended', this._replaceVideoToCanvas);
          }
        });
      })
      .catch((error) =>
      {
        // 获取摄像头失败，重新获取
        logger.error(`replaceCanvasToVideo error: ${JSON.stringify(error)}`);
        this._replaceCanvasToVideo();
      });
  }

  /**
   * 先将原来videoTrack替换为canvas视频，并关闭原来videoTrack
   */
  _replaceVideoToCanvas()
  {
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
    const drawToCanvas =function()
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
      if (sender.track&&sender.track.kind == 'video')
      {
        // TODO: 可能多次触发事件
        // 清除事件绑定
        sender.track.removeEventListener('mute', this._replaceVideoToCanvas);
        sender.track.removeEventListener('ended', this._replaceVideoToCanvas);

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
      timer = setTimeout(function()
      {
        timer = null;

        // 如果设备变化则替换轨道流
        this._connection.getSenders().forEach((sender) =>
        {
          // 视频轨道
          if (sender.track.kind === 'video')
          {
            this._replaceVideoToCanvas.call(sender.track, this._connection);
          }
          // 音频轨道
          else if (sender.track.kind === 'audio')
          {
            this._replaceMicToAudio.call(sender.track, this._connection);
          }
        });
      }, 300);
    };

    // 先判断现在PC里面的媒体是否已经是muted
    this._connection.getSenders().forEach((sender) =>
    {
      // 视频轨道
      if (sender.track.kind === 'video')
      {
        if (sender.track.muted)
        {
          this._replaceVideoToCanvas.call(sender.track, this._connection);
        }
        else
        {
          // iOS Safari 按 HOME 切后台，会触发两次 mute 和 unmute
          // mute 事件触发替换视频流为临时视频，并释放摄像头
          sender.track.addEventListener('mute', this._replaceVideoToCanvas);
          sender.track.addEventListener('ended', this._replaceVideoToCanvas);
        }
      }
      // 音频轨道
      else if (sender.track.kind === 'audio')
      {
        if (sender.track.muted)
        {
          this._replaceMicToAudio.call(sender.track, this._connection);
        }
        else
        {
          // mute 事件触发替换视频流为临时空音频，并释放麦克风
          sender.track.addEventListener('mute', this._replaceMicToAudio);
          sender.track.addEventListener('ended', this._replaceMicToAudio);
        }
      }
    });
  }
};
