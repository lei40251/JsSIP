const _ua = null;
const _session = {
  a : null,
  b : null,
  c : null,
  d : null
};
let notify = false;
let _tmpTarget = null;
let _incomingSession = null;
let _tmpSession = null;
let _PeerConnection = null;
const _localStream = {
  one : null,
  two : null
  // three: null,
  // four: null
};
const _remoteStream = {
  one : null,
  two : null
  // three: null,
  // four: null
};
const _getStatsResult = null;
const _sipCode = {
  busy : {
    status_code : 486
  },
  reject : {
    status_code : 403
  }
};
let mediaConstraints = null;

// const xdata = handleGetQuery('xdata');


function haveSession(session)
{
  for (const k in session)
  {
    if (!session[k])
    {
      return k;
    }
  }

  return null;
}

// remove stream
function _stopStream(target)
{
  const targetEle = `#${ target}`;
  let localSrcObject = document
    .querySelector(targetEle)
    .querySelector('.localVideo').srcObject;
  let remoteSrcObject = document
    .querySelector(targetEle)
    .querySelector('.remoteVideo').srcObject;

  if (_remoteStream[target])
  {
    _remoteStream[target].getTracks().forEach((track) => track.stop());
  }
  if (_localStream[target])
  {
    _localStream[target].getTracks().forEach((track) => track.stop());
  }
  if (localSrcObject)
  {
    localSrcObject.getTracks().forEach((track) => track.stop());
    localSrcObject = null;
  }
  if (remoteSrcObject)
  {
    remoteSrcObject.getTracks().forEach((track) => track.stop());
    remoteSrcObject = null;
  }
}

// pause the ring
function _ringPause(session)
{
  if (session.direction === 'outgoing')
  {
    document.querySelector('#ringback').pause();
    document.querySelector('#ringback').currentTime = 0;
  }
  else
  {
    document.querySelector('#ringing').pause();
    document.querySelector('#ringing').currentTime = 0;
  }
}

// after accepted
function _afterAccept(session, target)
{
  let remoteKinds = null;
  const targetEle = `#${ target}`;

  $(targetEle)
    .find('.close-phone')
    .removeClass('close-phone');
  let _displayName = session.remote_identity.display_name
    ? `in: ${ session.remote_identity.display_name}`
    : `out: ${ session.local_identity.uri.user}`;

  _PeerConnection = session.connection;
  _localStream[target] = new MediaStream();
  _PeerConnection.getSenders().forEach(function(sender)
  {
    // sender.track && _localStream[target].addTrack(sender.track);
    if (sender.track && sender.track.readyState != 'ended')
    {
      _localStream[target].addTrack(sender.track);
    }
  });
  _remoteStream[target] = new MediaStream();
  _PeerConnection.getReceivers().forEach(function(receiver)
  {
    remoteKinds += receiver.track.kind;
    // remoteKinds = '';
    // receiver.track && _remoteStream[target].addTrack(receiver.track);
    if (receiver.track && receiver.track.readyState != 'ended')
    {
      _remoteStream[target].addTrack(receiver.track);
    }
  });

  if (
    (mediaConstraints && !mediaConstraints.video) ||
    remoteKinds.indexOf('video') == -1
  )
  {
    _displayName += '【语音模式】';
    document.querySelector(targetEle).querySelector('.toggle-camera').style =
      'display:none;';
  }

  if (_localStream[target])
  {
    document.querySelector(targetEle).querySelector('.localVideo').srcObject =
      _localStream[target];
  }
  if (_remoteStream[target])
  {
    document
      .querySelector(targetEle)
      .querySelector('.remoteVideo').srcObject = _remoteStream[target];
    document
      .querySelector(targetEle)
      .querySelector('.remoteVideo')
      .addEventListener('canplay', () =>
      {
        document
          .querySelector(targetEle)
          .querySelector('.remoteVideo')
          .play();
      });
    if (
      sessionStorage.getItem('audiooutput') &&
      sessionStorage.getItem('audiooutput') != 'no'
    )
    {
      COMMON.attachSinkId(
        document.querySelector(targetEle).querySelector('.remoteVideo'),
        sessionStorage.getItem('audiooutput')
      );
    }
  }
  if (_displayName)
  {
    document
      .querySelector(targetEle)
      .querySelector('.displayName').innerHTML = _displayName;
  }
  // addstream changeCam
  _PeerConnection.addEventListener('addstream', function(e)
  {
    for (const i in _session)
    {
      if (_session[i] == session)
      {
        const tmpEle = `#${ i}`;

        $(tmpEle).find('.screenVideo')[0].srcObject = e.stream;
      }
    }
  });

  let inboundStream = null;

  _PeerConnection.addEventListener('track', function(ev)
  {
    // var target;
    for (const i in _session)
    {
      if (_session[i] == session)
      {
        var tmpEle = `#${ i}`;
        // target = i;
      }
    }

    // console.log("ev: ", ev)

    // _remoteStream[target] = new MediaStream();

    // if (ev.track.readyState != 'ended' && ev.track.muted == false) {
    //   _remoteStream[target].addTrack(track);
    // }

    // document
    //   .querySelector(tmpEle)
    //   .querySelector(".remoteVideo").srcObject = _remoteStream[target];


    const videoElem = $(tmpEle).find('.screenVideo')[0];

    if (ev.streams && ev.streams[0])
    {
      videoElem.srcObject = ev.streams[0];
    }
    else
    {
      // if (!inboundStream) {
      inboundStream = new MediaStream();
      videoElem.srcObject = inboundStream;
      inboundStream.addTrack(ev.track);
      // } else {
      // inboundStream.replaceTrack(ev.track);
      // }
    }


  });

  session.connection.getSenders().forEach((sender) =>
  {
    if (sender.track&& sender.track.kind === 'video')
    {
      const parameters = sender.getParameters();

      parameters.encodings[0].maxBitrate = 400 * 1000;

      sender.setParameters(parameters);

      sender.track.contentHint = 'detail';
    }
  });

  COMMON.changePage('session', _tmpTarget);
}

// UA debug information
function _UAMessageSubject(that)
{
  [
    'connecting',
    'connected',
    'disconnected',
    'registered',
    'unregistered',
    'registrationFailed',
    'newRTCSession',
    'newMessage'
  ].map((event) =>
  {
    that.ua.on(event, function(e)
    {
      console.log(`UAEvent: ${event}`, e);
    });
  });
}

// RTCSession debug information
function _RTCSessionMessageSubject(session)
{
  [
    'peerconnection',
    'connecting',
    'sending',
    'progress',
    'accepted',
    'confirmed',
    'ended',
    'failed',
    'newDTMF',
    'newInfo',
    'hold',
    'unhold',
    'muted',
    'unmuted',
    'reinvite',
    'update',
    'refer',
    'replaces',
    'sdp',
    'icecandidate',
    'getusermediafailed',
    'peerconnection:createofferfailed',
    'peerconnection:createanswerfailed',
    'peerconnection:setlocaldescriptionfailed',
    'peerconnection:setremotedescriptionfailed'
  ].map((event) =>
  {
    session.on(event, function(e)
    {
      console.info(`RTCSessionEvent: ${event}`, e);
    });
  });
}

/* UAEvent */
const _uaEvent = {
  registered : function(e)
  {
    COMMON.changePage('main');
  },
  registrationFailed : function(e)
  {
    COMMON.changePage('login');
    M.toast({
      html : e.cause
    });
  },
  newRTCSession : function(e)
  {
    _tmpSession = e.session;
    _tmpTarget = haveSession(_session);
    if (e.originator === 'remote')
    {
      if (!_tmpTarget || _incomingSession)
      {
        console.warn('incoming call replied with 486 "Busy Here"');
        e.session.terminate(_sipCode.busy);

        return;
      }
      _incomingSession = e.session;
    }
    _RTCSessionMessageSubject(e.session);
    _RTCSessionStatusSubject(e.session, e);
  },
  newMessage : function(e) { }
};

function _UAStatusSubject(that)
{
  Object.keys(_uaEvent).map((event) =>
  {
    that.ua.on(event, function(e)
    {
      _uaEvent[event](e);
    });
  });
}

/* RTCSession */
const _rtcSessionEvent = {
  progress : function(e, session, UAe)
  {
    const targetEle = `#${ _tmpTarget}`;

    if (session.direction === 'outgoing')
    {
      COMMON.changePage('calling', _tmpTarget);
      document.querySelector('#ringback').play();
    }
    else
    {
      console.log(UAe);
      document
        .querySelector(targetEle)
        .querySelector('.display-name').innerHTML =
        UAe.request.from.display_name;
      COMMON.changePage('incoming', _tmpTarget);
      document.querySelector('#ringing').play();
    }
    _session[_tmpTarget] = session;
    // if (!!sessionStorage.getItem('autoAnswer')) {
    //   _session[_tmpTarget].answer();
    //   setTimeout(() => {
    //     _session[_tmpTarget].terminate()
    //   }, Number(sessionStorage.getItem('autoAnswerTimer')));
    // }
  },
  sdp : function(e)
  {
    // if (e.type == 'offer')
    // {
    //   e.sdp = e.sdp.replace(/a=setup:passive/g, 'a=setup:actpass');
    // }
    // else if (e.type == 'answer')
    // {
    //   e.sdp = e.sdp.replace(/a=setup:actpass/g, 'a=setup:actpass');
    // }

    // 呼叫VoLTE手机号需要
    noremb && (e.sdp = e.sdp.replace(/a=rtcp-fb:\d* goog-remb\r\n/g, ''));
    noremb && (e.sdp = e.sdp.replace(/a=rtcp-fb:\d* transport-cc\r\n/g, ''));

    // e.sdp = e.sdp.replace(/a=ssrc.*\r\n/g, '');
    // e.sdp = e.sdp.replace(/a=msid.*\r\n/g, '');
    // e.sdp = e.sdp.replace(/a=mid.*\r\n/g, '');
    // e.sdp = e.sdp.replace(/a=extmap.*\r\n/g, '');
    // e.sdp = e.sdp.replace(/a=group:BUNDLE.*\r\n/, '');
    // e.sdp = e.sdp.replace(/a=candidate.*169\.254.*\r\n/g, '');
    // e.sdp = e.sdp.replace(/a=candidate.*tcp.*\r\n/g, '');
    // e.sdp = e.sdp.replace(/a=candidate.*([a-f0-9]{1,4}(:[a-f0-9]{1,4}){7}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){0,7}::[a-f0-9]{0,4}(:[a-f0-9]{1,4}){0,7}).*\r\n/g, '');
  },
  failed : function(e, session, UAe)
  {
    // if (e.cause == "Rejected" || e.cause == "Canceled") {
    //   for (var i in _session) {
    //     if (!_session[i]) {
    //       COMMON.changePage("normal", i);
    //     }
    //   }
    // } else {
    for (const i in _session)
    {
      if (_session[i] == session)
      {
        _session[i] = null;
        COMMON.changePage('normal', i);
        _stopStream(i);
      }
    }
    // }

    _ingSession = null;
    _ringPause(session);
    M.toast({
      html : e.cause
    });
    if (_getStatsResult)
    {
      _getStatsResult.nomore();
    }
    _tmpTarget = null;
    _incomingSession = null;
  },
  confirmed : function(e, session, UAe)
  {
    // setTimeout(() =>
    // {
    _afterAccept(session, _tmpTarget);
    // }, 800);
  },
  accepted : function(e, session, UAe)
  {
    // var target = haveSession(_session);
    // _session[_tmpTarget] = session;
    _ringPause(session);
    // _tmpTarget=null

    // 兼容部分手机初始黑屏问题
    // setTimeout(() =>
    // {
    //   session.mute({ video: true });
    //   // e.session.mute({ video: true });
    //   setTimeout(() =>
    //   {
    //     session.unmute({ video: true });
    //   }, 300);
    // }, 1000);

    // 根据分辨率设置速率
    if (mbit)
    {
      session.connection.getSenders().forEach((sender) =>
      {
        if (sender.track && sender.track.kind === 'video')
        {
          const parameters = sender.getParameters();

          parameters.encodings[0].maxBitrate = mbit * 1000;

          sender.setParameters(parameters);

          sender.track.contentHint = 'detail';
        }
      });
    }

    _incomingSession = null;
  },
  ended : function(e, session, UAe)
  {
    let endTarget = null;

    for (const i in _session)
    {
      if (_session[i] == session)
      {
        _session[i] = null;
        endTarget = i;
      }
    }
    // _incomingSession = null;
    _stopStream(endTarget);
    M.toast({
      html : e.cause
    });
    COMMON.changePage('normal', endTarget);
    // _tmpTarget = null;
  },
  newDTMF : function(e, session, UAe)
  {
    if (e.originator === 'remote')
    {
      M.toast({
        html : `newDTMF: ${e.request.body}`
      });
    }
  },
  newInfo : function(e, session, UAe)
  {
    if (e.originator === 'remote')
    {
      const info = JSON.parse(e.request.body);

      if (info.type !== 'debug')
      {
        M.toast({
          html : `newInfo: ${e.request.body}`
        });
      }
    }
  },
  refer : function(e, session)
  {
    console.log(e);
    e.accept(this.ua);
  },
  reinvite : function(e, session, UAe)
  {
    // console.log("inviteee: ", e);
    // console.log("invitess: ", session);
    let tmpEle = null;

    for (const i in _session)
    {
      if (_session[i] == session)
      {
        tmpEle = `#${ i}`;
        // $(tmpEle).find(".screenVideo")[0].srcObject = e.stream;
      }
    }
    if (e.request.headers['X-Action'])
    {
      if (e.request.headers['X-Action'][0].raw == 'shareScreen')
      {
        tmpEle &&
          $(tmpEle)
            .find('.screen-video')
            .removeClass('hide');
      }
      else if (e.request.headers['X-Action'][0].raw == 'stopShareScreen')
      {
        tmpEle &&
          $(tmpEle)
            .find('.screen-video')
            .addClass('hide');
      }
    }
  },
  newNotify : function(e, session, UAe)
  {
    if (e.originator === 'remote')
    {
      notify = true;
      if (e.request.event.event == 'talk')
      {
        if (session.isEstablished())
        {
          if (session.isOnHold())
          {
            session.unhold();
          }
        }
        else
        {
          session.answer({
            rtcAnswerConstraints : {
              audio : true,
              video : false
            }
          });
        }
      }
      else if (e.request.event.event == 'hold')
      {
        session.hold();
      }
    }
  }
};

function _RTCSessionStatusSubject(session, UAe)
{
  Object.keys(_rtcSessionEvent).map((event) =>
  {
    session.on(event, function(e)
    {
      _rtcSessionEvent[event](e, session, UAe);
    });
  });
}

// TODO: what ???
function _setVideoStream(stream, target)
{
  const targetEle = `#${ target}`;

  document
    .querySelector(targetEle)
    .querySelector('.localVideo').srcObject = stream;
  document
    .querySelector(targetEle)
    .querySelector('.localVideo')
    .play();
  // document.querySelector('#localVideo').srcObject = stream;
  // document.querySelector('#localVideo').play();
}

/* WebRTC Class */
function WebRTC(options = {})
{
  this.account = options.account || ' ';
  this.password = options.password || '';
  this.domain = options.domain || ' ';
  this.wss = options.wss || ' ';

  this.socket = new CRTC.WebSocketInterface(this.wss);
  this.configuration = {
    sockets     : [ this.socket ],
    uri         : `sip:${ this.account }@${ this.domain}`,
    contact_uri :
      `sip:${ this.account }@${ this.account }.invalid;transport=ws`,
    password         : this.password,
    display_name     : this.account,
    register         : true,
    session_timers   : false,
    register_expires : 900,
    secret_key       : sessionStorage.getItem('secret_key') || 'pdiC8Sg121leH89+tXKLKmUIJTrUqf/Jq+i5vtsl10n4Us/7m2RuyMZWZWIgs4+WyZPfluXtmOwgq2QV8ZVk1+nL7E/5ZovRARwZzeeiG+Y39e9BRXiiu0panarGBzLfaAaMxnr3itlq6XWBvKDbN/PXS0NpQ55zRcEgRoXrBB0so1klK5gqPyF5bbyUVAUidla4qgnoXYufxGOLSbYezKPaW07uaHDWPigsHRxCFnvspPzYIZhJGWQBXiutPhI3oriGjcomkcodTtwHTpF7TGNVKbdous9TgS7MnawZGEwBNVk8VYUjeGbU8Op/BnWDseSRJHz/0NV4LFBogIjQxA=='

  };

  this.ua = new CRTC.UA(this.configuration);
}

WebRTC.prototype.connect = function()
{
  this.ua.start();
  _UAMessageSubject(this);
  _UAStatusSubject(this);
};

WebRTC.prototype.stop = function()
{
  this.ua.stop();
};

WebRTC.prototype.unregister = function()
{
  if (this.ua.isRegistered())
  {
    this.ua.unregister();
  }
};

WebRTC.prototype.call = function(linkman, mode)
{
  mediaConstraints = sessionStorage.getItem('constraints')
    ? JSON.parse(sessionStorage.getItem('constraints'))
    : {
      audio : true,
      video : false
    };

  if (mode == 'video')
  {
    if (!mediaConstraints.video)
    {
      mediaConstraints.video = true;
    }
    if (!mediaConstraints.audio)
    {
      mediaConstraints.audio = true;
    }
  }
  else if (mode == 'audio')
  {
    if (mediaConstraints.video)
    {
      mediaConstraints.video = false;
    }
    if (!mediaConstraints.audio)
    {
      mediaConstraints.audio = true;
    }
  }

  if (exts && exts.indexOf('BP720P') !== -1)
  {
    mediaConstraints['video'] = {
      width     : 1280,
      height    : 720,
      frameRate : 15
    };
  }

  this.session = this.ua.call(`sip:${ linkman }@${ this.domain}`, {
    mediaConstraints : mediaConstraints,
    pcConfig         : pcConfig,
    extraHeaders     : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
    extraFeatures
  });
};

WebRTC.prototype.conference = function(linkman, mediaStream)
{
  this.session = this.ua.call(`sip:${ linkman }@${ this.domain}`, {
    mediaStream : mediaStream
  });
};

WebRTC.prototype.answer = function()
{
  mediaConstraints = null;
  _incomingSession.answer({
    // rtcOfferConstraints: {
    //   offerToReceiveAudio: 1,
    //   offerToReceiveVideo: 0,
    //   DtlsSrtpKeyAgreement: 0
    // },

    pcConfig         : pcConfig,
    extraHeaders     : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
    mediaConstraints :
      phoneModal == 'audio'
        ? {
          video : false,
          audio : true
        }
        : {
          audio : true,
          video : true
        }
  });
};

WebRTC.prototype.cancel = function()
{
  _tmpSession.terminate();
};

WebRTC.prototype.reject = function(target)
{
  _incomingSession.terminate(_sipCode.reject);
};

WebRTC.prototype.youanswer = function(target)
{
  _tmpSession.sendInfo('application/json', '', {
    extraHeaders : [ 'event: talk' ]
  });
};

WebRTC.prototype.hangup = function(target)
{
  if (target && _session[target])
  {
    _session[target].terminate();
  }
  else
  {
    for (const i in _session)
    {
      _session[i].terminate();
    }
  }
};

WebRTC.prototype.closeMic = function(target)
{
  if (_session[target])
  {
    _session[target].mute();
  }
};

WebRTC.prototype.toMCU = async function(target)
{
  // if (_session[target]) {
  //   _session[target].mute();
  // }
  const other=[];
  const othStream = [];

  const localVideoElement = document.querySelectorAll('.localVideo');

  for (const lv of localVideoElement)
  {
    if (lv.srcObject.getVideoTracks().length>0)
    {
      othStream.push(lv.srcObject.clone());

      break;
    }
  }

  // othStream.push(document.querySelector('.localVideo').srcObject.clone());

  for (const key in _session)
  {
    if (_session[key])
    {
      other.push(_session[key]);
      const stream = new MediaStream();

      console.warn('sk: ', _session[key].connection.getReceivers());
      _session[key].connection.getReceivers().forEach(({ track }) =>
      {
        if (track && track.readyState !== 'ended' && (key !== target || track.kind !== 'audio'))
        {
          stream.addTrack(track);
        }
      });
      othStream.push(stream);
    }
  }

  console.warn('othStream: ', othStream);

  const mix = new CRTC.Mixer(othStream);
  const lVs = await mix.getMixedStream();

  _session[target].connection.getSenders().forEach((sender) =>
  {
    if (sender.track.kind === 'video')
    {
      sender.replaceTrack(lVs.getVideoTracks()[0]);
    }
    else if (sender.track.kind === 'audio')
    {
      sender.replaceTrack(lVs.getAudioTracks()[0]);
    }
  });

  document.querySelector('#mixVideo').srcObject=lVs;
};

WebRTC.prototype.openMic = function(target)
{
  if (_session[target])
  {
    _session[target].unmute();
  }
};

WebRTC.prototype.hold = function(target)
{
  if (_session[target])
  {
    _session[target].hold();
  }
};

WebRTC.prototype.unhold = function(target)
{
  if (_session[target])
  {
    _session[target].unhold();
  }
};

WebRTC.prototype.closeCam = function(target)
{
  if (_session[target])
  {
    _session[target].mute({
      audio : false,
      video : true
    });
  }
};

WebRTC.prototype.openCam = function(target)
{
  if (_session[target])
  {
    _session[target].unmute({
      audio : false,
      video : true
    });
  }
};

WebRTC.prototype.toVideo = function(target)
{
  if (_session[target])
  {
    _session[target].upgradeToVideo({ useUpdate: false }, () => { console.warn('切换视频模式完成'); });
  }
};

WebRTC.prototype.toAudio = function(target)
{
  if (_session[target])
  {
    _session[target].demoteToAudio({ useUpdate: false }, () => { console.warn('切换音频模式完成'); });
  }
};

WebRTC.prototype.sendDTMF = function(message, target)
{
  if (_session[target])
  {
    _session[target].sendDTMF(message, { 'transportType': 'RFC2833' });
  }
};

WebRTC.prototype.sendInfo = function(message, target)
{
  if (_session[target])
  {
    _session[target].sendInfo('application/json', message);
  }
};

WebRTC.prototype.switchStream = function(stream, target)
{
  window.stream = stream;
  if (_session && _PeerConnection)
  {
    _setVideoStream(stream);
    stream.getVideoTracks().forEach(function(track)
    {
      const sender = _PeerConnection.getSenders().find(function(s)
      {
        return s.track.kind == track.kind;
      });

      sender.replaceTrack(track);
    });
  }
};

WebRTC.prototype.shareScreen = function(stream, target)
{
  window.shareStraem = stream;
  if (_session && _PeerConnection)
  {
    stream.getVideoTracks().forEach(function(track)
    {
      const sender = _PeerConnection.getSenders().find(function(s)
      {
        if (s.track)
        {
          return s.track.label == track.label;
        }
      });

      if (sender)
      {
        sender.replaceTrack(track);
      }
      else
      {
        _PeerConnection.addTrack(track);
      }
    });
    _session[target].renegotiate({ extraHeaders: [ 'X-Action: shareScreen' ] });
  }
  isShareScreen = true;
};

WebRTC.prototype.stopShare = function(target)
{
  // if (!isShareScreen) {
  //   return;
  // }
  if (_session && _PeerConnection)
  {
    _PeerConnection.getSenders().find(function(s)
    {
      if (
        !s.track ||
        s.track.label.indexOf('screen') != -1 ||
        s.track.label.indexOf('window') != -1 ||
        s.track.label.indexOf('web') != -1
      )
      {
        s.track && s.track.stop();
        _PeerConnection.removeTrack(s);
      }
    });
    _session[target].renegotiate({
      extraHeaders : [ 'X-Action: stopShareScreen' ]
    });
  }
};

App.WebRTC = WebRTC;
