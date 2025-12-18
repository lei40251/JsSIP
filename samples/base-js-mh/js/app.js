/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable no-undef */

// 调试信息输出
CRTC.debug.enable('CRTC:*');
// 关闭调试信息输出
// CRTC.debug.disable('CRTC:*');

const no_camera_svg = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg t="1756366745939" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="10589" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100"><path d="M865.08627 773.036973l-0.83027 0.996324a35.424865 35.424865 0 0 0-17.380324-4.649513 36.006054 36.006054 0 0 0-2.767568 71.956757c8.468757 7.140324 13.062919 14.612757 13.062919 22.417297 0 45.111351-152.050162 81.643243-339.635892 81.643243-130.739892 0-244.154811-17.767784-300.945297-43.782919l-50.425081 50.36973C241.442595 995.272649 370.632649 1024 517.535135 1024c232.475676 0 420.67027-71.956757 420.67027-160.518919 0-33.542919-27.011459-64.70573-73.119135-90.444108zM965.881081 49.816216a33.210811 33.210811 0 0 0-46.937946 0L58.118919 910.751135a33.210811 33.210811 0 0 0 46.827243 46.827243L965.881081 96.643459a33.210811 33.210811 0 0 0 0-46.827243zM251.350486 647.610811a363.935135 363.935135 0 0 1-73.229837-221.405406c0-195.611676 148.895135-354.248649 339.414486-354.248648a329.728 329.728 0 0 1 222.955243 86.126702l51.58746-51.532108A407.164541 407.164541 0 0 0 517.535135 0c-229.265297 0-415.135135 190.796108-415.135135 426.205405a431.076324 431.076324 0 0 0 96.754162 273.380325z m382.643892-382.588541a199.264865 199.264865 0 0 0-278.14054 278.140541l120.665946-120.942703a83.027027 83.027027 0 1 1 53.635459-53.635459zM716.8 426.205405a207.622919 207.622919 0 0 0-1.439135-23.635027l-221.405406 221.405406a207.622919 207.622919 0 0 0 23.579676 1.494486 199.264865 199.264865 0 0 0 199.264865-199.264865z m-398.861838 373.732325A404.618378 404.618378 0 0 0 517.535135 852.410811c229.265297 0 415.135135-190.796108 415.135135-426.205406a433.34573 433.34573 0 0 0-45.996973-194.947459L830.380973 287.827027a371.407568 371.407568 0 0 1 26.568649 138.378378c0 195.611676-148.895135 354.248649-339.414487 354.248649a329.783351 329.783351 0 0 1-146.127567-33.819676z" fill="#8a8a8a" p-id="10590"></path></svg>';

// 通话统计
let stats;
// 是否存在远端回铃音
let earlyMedia = false;
// 断线重连
let rtcSession;
let optionsTimer;
// 呼叫转移 被转用
let tmpSession;
let safari_r = false;
let options;

let camFlag = true;

let useUpdate = true;
let useRnnoiseNode = false;
let haveACamera = false;
let confirmed = false;

// 用于断网提示相关
let handleStop = false;
let disconnectedBy = null;
let isShowUI = false;

let mix;

// 当前模式
let curMode;

// 兼容mcu等候室用
let cloneStream = null;
let isRefer = false;

// 数字人通话
// eslint-disable-next-line prefer-const
let pc = null;
// eslint-disable-next-line prefer-const
let localAudio = null;

const extraFeatures = [];

// let payload;

// 远端客户端UA
// let remoteUA;

const localVideo = document.querySelector('#localVideo');
const remoteVideo = document.querySelector('#remoteVideo');
const remoteAudio = document.querySelector('#remoteAudio');

let cusMediaStream = new MediaStream();
let blackVideo = null;

const xdata = handleGetQuery('xdata') || 'dGVzdCB4LWRhdGE=';
const mbit = handleGetQuery('mbit') || 400;
const env = handleGetQuery('env');
const noremb = handleGetQuery('noremb') || false;
const { signalingUrl, sipDomain, secretKey, iceServers, iceTransportPolicy, password } = env ? envs[`env_${env}`] : envs['env_default'];
const exts = handleGetQuery('ext') ? handleGetQuery('ext').split(',') : null;

exts && exts.forEach((ext) => extraFeatures.push(ext));

// 注册UA的用户名
const account = handleGetQuery('caller');
// websocket 实例
const socket = new CRTC.WebSocketInterface(signalingUrl);
// UA 配置项
const configuration = {
  // Socket 实例
  sockets                          : socket,
  // 与 UA 关联的 SIP URI
  uri                              : `sip:${account}@${sipDomain}`,
  // 显示名
  display_name                     : account,
  // SIP身份验证密码
  password                         : `${password?password:'yl_19'}${account}`,
  connection_recovery_max_interval : 3,
  connection_recovery_min_interval : 2,
  register_expires                 : 20,
  session_timers                   : false,
  secret_key                       : secretKey
};

// 媒体约束条件
let videoConstraints = {
  facingMode : 'user',
  width      : 640,
  height     : 480,
  frameRate  : 15
};

if (exts && exts.indexOf('BP720P') !== -1)
{
  videoConstraints = {
    facingMode : 'user',
    width      : 1280,
    height     : 720,
    frameRate  : 15
  };
}

// RTCPeerConnection 的 RTCConfiguration 对象
const pcConfig = {};

iceServers && (pcConfig['iceServers'] = iceServers);
iceTransportPolicy && (pcConfig['iceTransportPolicy'] = iceTransportPolicy);
pcConfig['iceCandidatePoolSize'] = 10;

pcConfig['bundlePolicy'] = 'max-compat';

// UA 实例
const ua = new CRTC.UA(configuration);

// ***** UA 事件回调 *****

/**
 * browser:navigator:offline
 *
 * @fires 浏览器离线时触发
 */
ua.on('browser:navigator:offline', function()
{
  setStatus('浏览器已离线');

  // 断网提示
  if (!disconnectedBy)
  {
    disconnectedBy = 'BROWSER';

    // 断网提示
    isShowUI = true;
  }
});

/**
 * browser:navigator:online
 *
 * @fires 浏览器在线时触发
 */
ua.on('browser:navigator:online', function()
{
  setStatus('浏览器在线');
  if (disconnectedBy === 'BROWSER')
  {
    disconnectedBy=null;

    // 关闭断网提示
    isShowUI = false;
  }
});

/**
 * connected
 *
 * @fires 信令连接成功时触发
 */
ua.on('connected', function()
{
  disconnectedBy = null;

  // 关闭断网提示
  isShowUI = false;

  setStatus('信令连接成功');
});

/**
 * disconnected
 *
 * @fires 信令连接尝试(或自动重新尝试)失败时触发
 *
 * @type {object}
 * @property {boolean} error - 连接是否因为错误而断开
 */
ua.on('disconnected', function(data)
{
  setStatus(`信令连接断开: ${data.code} ${data.reason}`);

  // 主动断开不处理断网提示
  if (handleStop)
  {
    return;
  }

  if (!disconnectedBy)
  {
    // 显示断网提示
    isShowUI = true;
  }
  disconnectedBy = 'UA';
});

/**
 * failed
 *
 * @fires UA 错误时触发
 *
 * @type {object}
 * @property {string} originator - 错误来源
 * @property {string} message - 错误说明
 * @property {string} cause - 错误原因
 */
ua.on('failed', function(data)
{
  console.warn('data:', data);
  setStatus(`${data.originator} ${data.message} ${data.cause}`);
});

/**
 * registered
 *
 * @fires 用户注册成功后触发
 *
 * @type {object}
 * @property {object} response - 注册的响应实例
 */
ua.on('registered', function(data)
{
  setStatus(`注册成功：${data.response.from.uri.toString()}`);
  // setTimeout(() =>
  // {
  //   call('callnull');
  // }, 1000);
});

/**
 * registrationFailed
 *
 * @fires 用户注册失败时触发
 *
 * @type {object}
 * @property {object} response - 注册的响应实例
 * @property {string} cause - 注册失败原因
 */
ua.on('registrationFailed', function(data)
{
  setStatus(`注册失败${data.cause}`);
});

/**
 * newRTCSession
 *
 * @fires 呼入或呼出通话时触发
 *
 * @type {object}
 * @property {string} origin - 新通话是本端（'local'）或远端（'remote'）生成
 * @property {object} session - 通话的session实例
 * @property {object} request - 本端或远端的请求对象，远端呼入可以在此获取随路数据，呼叫模式等
 */
ua.on('newRTCSession', function(e)
{
  console.warn('nsession: ', e);

  confirmed = false;

  if (tmpSession)
  {
    e.session.terminate({ status_code: 486 });
  }
  else if (!rtcSession)
  {
    rtcSession = e.session;
  }
  else
  {
    tmpSession = e.session;
  }

  if (e.originator === 'remote')
  {
    // 远端呼入通过 request.mode 判断呼叫是音频还是视频
    setStatus(`收到${e.request.mode === 'video' ? '视频' : '音频'}呼叫`);
    // 通过 request.getHeader(param) 获取随路数据, param 为 call 时携带的参数命称
    setStatus(`收到 x-data: ${e.request.getHeader('x-data')}`);
  }

  // ***** Session 事件回调 *****

  e.session.on('refer', function(d)
  {
    isRefer = true;
    d.request.refer_to.uri.host = sipDomain;
    d.accept(() =>
    {
      e.session.terminate();
      call('video', null, cloneStream);
    }, options);
  });

  // 部分场景兼容使用
  e.session.on('sdp', function(d)
  {
    // 呼叫VoLTE手机号需要
    noremb && (d.sdp = d.sdp.replace(/a=rtcp-fb:\d* goog-remb\r\n/g, ''));
    noremb && (d.sdp = d.sdp.replace(/a=rtcp-fb:\d* transport-cc\r\n/g, ''));

    // d.sdp = d.sdp.replace(/a=extmap:13/, 'a=extmap:8');

    d.sdp = d.sdp.replace(/a=extmap:\d+ urn:3gpp:video-orientation\r\n/g, '');
    // d.sdp = d.sdp.replace(/a=extmap:.*\r\n/g, '');

    if (d.originator === 'local')
    {
      // 保存浏览器默认payload，适配pa
      // const payloadRegex = /profile-level-id=([a-zA-Z0-9]{6})/;
      // payload || (payload = d.sdp.match(payloadRegex)[1]);
      // const newPayloadRegex = new RegExp(payload, 'g');
      // // 将sdp的默认payload改为420D0D
      // d.sdp = d.sdp.replace(newPayloadRegex, '420D0D');
      // d.sdp = d.sdp.replace(/packetization-mode=0/, 'packetization-mode=1');
      // d.sdp = d.sdp.replace(/profile-level-id=([a-zA-Z0-9]{6})/g, 'profile-level-id=428028');
      // d.sdp = d.sdp.replace(/(m=video .*\r\n)/g, '$1b=AS:2048\r\n');

      // d.sdp = d.sdp.replace(/a=rtcp.*nack pli\r\n/g, '');

      // d.sdp = d.sdp.replace(/packetization-mode=0/g, 'packetization-mode=1');

      // d.sdp = d.sdp.replace(/a=extmap:13/, 'a=extmap:2');
      // a=fmtp:109 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42c01f
    }
    else if (d.originator === 'remote')
    {
      // 适配pa
      // d.sdp = d.sdp.replace(/profile-level-id=420D0D;.*packetization-mode=1;/g, `level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=${payload}`);
      // d.sdp = d.sdp.replace(/420D0D/g, payload);

      // d.sdp = d.sdp.replace(/packetization-mode=1/g, 'packetization-mode=0');

      // 端到端用
      // d.sdp = d.sdp.replace('a=floorctrl:s-only\r\n', 'a=floorctrl:s-only\r\na=floorid:2 mstrm:12\r\na=confid:123\r\na=userid:456\r\n');
      // d.sdp = d.sdp.replace('a=floorctrl:c-only\r\n', 'a=floorctrl:s-only\r\na=floorid:2 m-stream:3\r\n');

      // d.sdp = d.sdp.replace(/SAVPF 106\r\n/g, 'SAVPF 126\r\n');
      // d.sdp = d.sdp.replace(/a=rtpmap:106/g, 'a=rtpmap:126');
      // d.sdp = d.sdp.replace(/a=fmtp:106/g, 'a=fmtp:126');

      // m=video 20080 UDP/TLS/RTP/SAVPF 106
      // b=TIAS:512000
      // a=rtpmap:106 H264/90000
      // a=fmtp:106 profile-level-id=42801F;max-br=512;packetization-mode=1
      // d.sdp = d.sdp.replace(/a=extmap:2/, 'a=extmap:13');
      // d.sdp = d.sdp.replace(/a=extmap:8 urn:3gpp:video-orientation\r\n/g, '');
    }
  });

  /**
    * progress
    *
    * @fires 收到或者发出 1xx （>100） 的SIP请求时触发;可以在此设置回铃音或振铃
    *
    * @type {object}
    * @property {string} mode - 'audio'音频模式，'video'视频模式
    */
  e.session.on('progress', function(d)
  {
    if (d.originator === 'local')
    {
      setStatus('收到呼叫，振铃中');
    }
    else
    {
      // 如果不存在远端铃声，可以播放本地铃声
      if (!earlyMedia)
      {
        // 可以播放本地铃声
      }

      setStatus('对方已振铃，请等待接听');
    }
  });

  /**
   * hold
   *
   * @fires 本端或远端暂停通话时触发
   *
   * @type {object}
   * @property {string} originator - 'remote'为远端触发，'local'为本端触发
   */
  e.session.on('hold', function(d)
  {
    setStatus(`${d.originator} hold`);
    // 通话暂停后跨域设置本地视频媒体为空，或者切换UI为暂停通话状态
    stopStreams();
  });

  /**
    * unhold
    *
    * 部分情况下取消暂停后无法加载出视频媒体；可以在此重新获取本地和远端媒体
    *
    * @fires 本端或远端取消暂停通话时触发
    *
    * @type {object}
    * @property {string} originator - 'remote'为远端触发，'local'为本端触发
    */
  e.session.on('unhold', function(d)
  {
    setStatus(`${d.originator} unhold`);

    // 获取媒体流
    getStreams(e.session.connection);
  });

  /**
    * mode
    *
    * 通话模式变化后需要重新获取本地和远端媒体
    *
    * @fires 通话模式发生变化时触发，如：音频模式切换为视频模式，视频模式切换为音频模式
    *
    * @type {object}
    * @property {string} mode - 'audio'音频模式，'video'视频模式
    */
  e.session.on('mode', function(d)
  {
    setStatus(`mode: ${d.mode}`);

    curMode = d.mode;

    if (d.mode == 'video')
    {
      e.session.connection.getSenders().forEach((sender) =>
      {
        if (sender.track && sender.track.kind === 'video')
        {
          const parameters = sender.getParameters();

          parameters.encodings[0].maxBitrate = 400 * 1000;

          sender.setParameters(parameters);
        }
      });

    }

    stats && stats.reset();

    // 获取媒体流
    getStreams(e.session.connection);
  });

  /**
    * cameraChanged
    *
    * 通话模式变化后需要重新获取本地和远端媒体
    *
    * @fires 摄像头切换完成后触发
    *
    * @type {object}
    * @property {string} videoStream - 切换后的视频流
    */
  e.session.on('cameraChanged', function(d)
  {
    // 兼容mcu等候室用
    const localStream = CRTC.Utils.getStreams(e.session.connection, 'local');
    const tmpTracks = [];

    if (localStream.audioStream.getAudioTracks().length > 0)
    {
      tmpTracks.push(localStream.audioStream.getAudioTracks()[0].clone());
      // tmpTracks.push(localStream.audioStream.getAudioTracks()[0]);
    }

    if (d.videoStream.getVideoTracks().length > 0)
    {
      tmpTracks.push(d.videoStream.getVideoTracks()[0].clone());
      // tmpTracks.push(d.videoStream.getVideoTracks()[0]);
    }

    cloneStream && cloneStream.getTracks().forEach((track) => track.stop());

    cloneStream = new MediaStream(tmpTracks);
    localVideo.srcObject = cloneStream;

    // 兼容不同浏览器安全策略
    setTimeout(() =>
    {
      localVideo.play();
    }, 100);
  });

  /**
    * remoteShared
    *
    * 渲染或者停止渲染远端分享的视频媒体
    *
    * @fires 远端分享或停止分享后触发
    */
  e.session.on('remoteShared', function(d)
  {
    document.querySelector('#remoteVideo2').srcObject = d.sharedStream.videoStream;
    document.querySelector('#remoteVideo2').classList = 'mh-100 mw-100';
  });

  /**
    * remoteUnShared
    *
    * 停止渲染远端分享的视频媒体
    *
    * @fires 远端停止分享后触发
    */
  e.session.on('remoteUnShared', function()
  {
    document.querySelector('#remoteVideo2').srcObject = null;
    document.querySelector('#remoteVideo2').classList = 'mh-100 mw-100 hide';
  });

  /**
    * peerconnection:iceConnectionState
    *
    * 反应当前的媒体连接状态变化，如果checking后长时间没有connected则说明媒体异常
    *
    * @fires iceconnectionstatechange事件触发
    *
    */
  e.session.on('peerconnection:iceConnectionState', (d) =>
  {
    // console.warn('iceConnectionState: ', d);
  });

  
  /**
    * mediaerror
    *
    * @fires 当获取到的用户媒体为已知异常时触发
    *
    * @type {object}
    * @property {string} type - 'video'为视频轨道异常
    * @property {Mediastream} mediastream - 触发此异常的媒体流
    */
  e.session.on('mediaerror', function(d)
  {
    setStatus(`用户媒体错误：${d.type } track failed`);

    // 可以根据需要多次检查并做进一步处理
    let count = 3;
    const timer = setInterval(() => 
    {
      if (CRTC.Utils.isVideoTrackHealthy(d.mediastream))
      {
        clearInterval(timer);
      }
      else if (count >= 0)
      {
        clearInterval(timer);
        // 可以根据需要做进一步处理，提示用户等
      }
      else
      {
        count--;
      }
    }, 1000);
  });

  /**
    * failed
    *
    * @fires 建立通话失败触发
    *
    * @type {object}
    * @property {string} originator - 'remote'为远端触发，'local'为本端触发
    * @property {string} message - originator 为 'remote' 时输出失败信息
    * @property {string} cause - 失败原因
    */
  e.session.on('failed', function(d)
  {
    mix && mix.stop();
    setStatus(`通话建立失败: ${d.cause}`);

    tmpSession = null;
    rtcSession = null;

    // 输出通话开始时间及通话结束时间
    setStatus(`start: ${e.session.start_time}`);
    setStatus(`ended: ${e.session.end_time}`);

    // 通话暂停后跨域设置本地视频媒体为空，或者切换UI为暂停通话状态
    stopStreams();

    // 停止获取统计信息
    stats && stats.stop();

    optionsTimer && clearInterval(optionsTimer);

    document.querySelector('#remoteVideo').classList = 'h-100';
    document.querySelector('#remoteVideo2').classList = 'hide';

    cusMediaStream.getTracks().forEach((track) => track.stop());

    cusMediaStream = new MediaStream();
  });

  /**
    * videoTrackState
    *
    * @fires 视频轨道状态变化时触发
    *
    * @type {object}
    * @property {MediaStreamTrack} track - 触发当前事件的视频轨道
    * @property {string} properties - 触发当前事件的属性 muted/readyState/enabled/label 等
    * @property {string/boolean} value - 变化后的值
    */
  e.session.on('videoTrackState', function(d)
  {
    // 视频轨道状态
    setStatus(`VTState ${d.properties} ${d.value}`);
  });

  /**
    * ended
    *
    * @fires 通话结束后触发
    *
    * @type {object}
    * @property {string} originator - 'remote'为远端触发，'local'为本端触发
    * @property {string} message - originator 为 'remote' 时输出失败信息
    * @property {string} cause - 结束原因
    */
  e.session.on('ended', function()
  {
    mix && mix.stop();
    setStatus('通话结束');

    // 输出通话开始时间及通话结束时间
    setStatus(`start: ${e.session.start_time}`);
    setStatus(`ended: ${e.session.end_time}`);

    if (rtcSession === e.session && Boolean(tmpSession))
    {
      stopStreams();
      getStreams(tmpSession.connection);
    }
    else
    {
      tmpSession = null;
      rtcSession = null;
      // 通话暂停后跨域设置本地视频媒体为空，或者切换UI为暂停通话状态
      // stopStreams();
      // 停止获取统计信息
      stats && stats.stop();
    }
    optionsTimer && clearInterval(optionsTimer);

    document.querySelector('#remoteVideo').classList = 'h-100';
    document.querySelector('#remoteVideo2').classList = 'hide';

    cusMediaStream.getTracks().forEach((track) => track.stop());
    cusMediaStream = new MediaStream();
  });

  /**
    * newDTMF
    *
    * @fires 收到INFO模式的DTMF后触发
    *
    * @type {object}
    * @property {string} originator - 'remote'为远端触发，'local'为本端触发
    * @property {object} dtmf - DTMF 对象
    */
  e.session.on('newDTMF', function(d)
  {
    // 输出 INFO 模式的 DTMF
    setStatus(`${d.originator} DTMF:${d.dtmf.tone}`);
  });

  /**
    * newInfo
    *
    * @fires 收到INFO消息后触发
    *
    * @type {object}
    * @property {string} originator - 'remote'为远端触发，'local'为本端触发
    * @property {object} info - INFO 对象
    */
  e.session.on('newInfo', function(d)
  {
    if (d.originator === 'remote')
    {
      setStatus(`收到新消息：${d.info.body}`);
    }
    else if (d.originator === 'local')
    {
      setStatus(`发出消息：${d.info.body}`);
    }
  });

  /**
    * notify
    *
    * @fires 收到需要处理的notify消息（talk，hold）时触发
    *
    * @type {object}
    * @property {string} event - 'talk'，'hold'
    * @property {object} request - 请求对象
    */
  e.session.on('notify', function(d)
  {
    // 3pcc 取消保持&自动接听
    if (d.event == 'talk')
    {
      if (e.session.isOnHold().local)
      {
        e.session.unhold();
        setStatus('3pcc unhold');

        return;
      }

      e.session.answer({
        rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
        mediaConstraints    : {
          audio :
          {
            sampleRate   : 48000,
            channelCount : 1
          },
          video : true
        },
        pcConfig : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' })
      });
      setStatus('3pcc answer');
    }
    else if (d.event == 'hold')
    {
      e.session.hold();
      setStatus('3pcc hold');
    }

  });

  /**
    * muted
    *
    * @fires 本地开启麦克风或摄像头方法调用成功后触发
    *
    * @type {object}
    * @property {boolean} audio - 判断是否音频被开启
    * @property {boolean} video - 判断是否视频被开启
    */
  e.session.on('muted', function(d)
  {
    if (d.audio)
    {
      setStatus('关闭麦克风');
    }
    else if (d.video)
    {
      setStatus('关闭摄像头');
    }
  });

  /**
    * unmuted
    *
    * @fires 本地关闭麦克风或摄像头方法调用成功后触发
    *
    * @type {object}
    * @property {boolean} audio - 判断是否音频被关闭
    * @property {boolean} video - 判断是否视频被关闭
    */
  e.session.on('unmuted', function(d)
  {
    if (d.audio)
    {
      setStatus('开启麦克风');
    }
    else if (d.video)
    {
      setStatus('开启摄像头');
    }
  });

  e.session.on('upgradeToVideo', (d) =>
  {
    if (confirmed && !haveACamera)
    {
      d.reject();
    }
    else
    {
      d.accept();
    }
  });

  /**
    * confirmed
    *
    * @fires 通话确认ACK的时候触发
    *
    * @type {object}
    * @property {string} originator - 'remote'为远端触发，'local'为本端触发
    */
  e.session.on('confirmed', async function()
  {
    setStatus('confirmed');
    // updateDevices();
    // if (e.session === tmpSession)
    // {
    //   rtcSession.terminate();
    // }

    confirmed = true;

    /* 用于验证接通以后替换音频 */
    // const rs = CRTC.Utils.getStreams(e.session.connection, 'local');

    // mix = new CRTC.Mixer([ rs.audioStream ]);
    // mix.getAudioStream().then((m) => 
    // {
    //   const sender = e.session.connection.getSenders().filter((s) => 
    //   {
    //     if (s.track && s.track.kind == 'audio')
    //     {
    //       return s;
    //     }
    //   });

    //   if (sender.length>0)
    //   {
    //     sender[0].replaceTrack(m.getAudioTracks()[0], m);
    //   }
    // });
    /* 结尾 */

    // 获取统计信息
    stats = new CRTC.getStats(e.session.connection);

    stats.on('report', function(r)
    {
      // e.session.connection.getReceivers().forEach((re) =>
      // {
      //   // 测试丢包用
      //   re.jitterBufferTarget = 2000;
      //   re.playoutDelayHint = 1000;
      // });

      // console.warn('report: ', JSON.stringify(r));
      let downF = '';
      let upF = '';

      r.downStreams.forEach((item) =>
      {
        if (item.type === 'audio')
        {
          downF += `# 音频 # ${item.speed}kbps | ${item.jitter || ''}ms | ${item.loss}%\n`;
        }
        else
        {
          downF += `# ${item.type === 'shared' ? '共享' : '视频'} # ${item.frameWidth || ''} * ${item.frameHeight || ''} | ${item.framesPerSecond || ''}fps | ${item.speed}kbps | ${item.jitter || ''}ms | ${item.loss}%\n`;
        }
      });

      r.upStreams.forEach((item) =>
      {
        if (item.type === 'audio')
        {
          upF += `# 音频 # ${item.speed}kbps | ${item.jitter || ''}ms | ${item.loss}%\n`;
        }
        else
        {
          upF += `# ${item.type === 'shared' ? '共享' : '视频'} # ${item.frameWidth || ''} * ${item.frameHeight || ''} | ${item.framesPerSecond || ''}fps | ${item.speed}kbps | ${item.jitter || ''}ms | ${item.loss}%\n`;
        }
      });

      document.querySelector('#upF').innerText = upF;
      document.querySelector('#downF').innerText = downF;

      document.querySelector('#RTT').innerText = r.RTT || '';
      // document.querySelector('#upL').innerText = r.uplinkLoss || '';
      // document.querySelector('#downL').innerText = r.downlinkLoss || '';
    });

    stats.on('network-quality', function(ev)
    {
      const { uplinkNetworkQuality, RTT, uplinkLoss, downlinkNetworkQuality, downlinkLoss } = ev;

      document.querySelector('#NQ').innerText = `Rtt: ${RTT} ## uQ: ${uplinkNetworkQuality} uL: ${uplinkLoss} ## dQ: ${downlinkNetworkQuality} dL: ${downlinkLoss}`;
    });

    // 获取媒体流
    getStreams(e.session.connection);

    e.session.connection.ontrack = function(event)
    {
      if (event.track.kind !== 'video')
      {
        return;
      }

      if (event.track.readyState == 'live' && event.track.muted == false && document.querySelector('#remoteVideo2').srcObject.id != event.streams[0].id)
      {
        document.querySelector('#remoteVideo2').srcObject = event.streams[0];
        // document.querySelector('#remoteVideo2').play();

        document.querySelector('#remoteVideo').classList = 'w-25 position-absolute top-0 end-0';
        // document.querySelector('#remoteVideo2').classList = 'h-100 w-100';
      }
      else
      {
        document.querySelector('#remoteVideo').classList = 'h-100';
        // document.querySelector('#remoteVideo2').classList = 'hide';
      }
    };

    // 根据分辨率设置速率
    if (mbit)
    {
      e.session.connection.getSenders().forEach((sender) =>
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
  });

  //  ***** DOM 事件绑定 *****

  // 保清晰/保流畅
  document.querySelector('#videoHint').onchange = function()
  {
    e.session.setVideoContentHint(this.options[this.selectedIndex].value);
    setStatus(`${this.options[this.selectedIndex].text}`);
  };

  /**
   * 音频接听
   */
  document.querySelector('#answer').onclick = function()
  {
    e.session.answer({
      mediaConstraints : {
        audio :
        {
          sampleRate   : 48000,
          channelCount : 1
        },
        video : false
      },
      pcConfig            : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
      // 被叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
      extraHeaders        : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true },
      extraFeatures       : extraFeatures
    });

    setStatus('audio answer');
  };

  /**
   * 视频接听
   */
  document.querySelector('#answerVideo').onclick = function()
  {
    e.session.answer({
      mediaConstraints : {
        audio : true,
        video : videoConstraints
      },
      pcConfig            : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
      // 被叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
      extraHeaders        : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures       : extraFeatures
    });

    setStatus('video answer');
  };

  /**
   * 空音频接听
   */
  document.querySelector('#answerAudio').onclick = async function()
  {
    const tmpStream = new MediaStream();
    const emptyTrack = await CRTC.Utils.generateAnEmptyAudioTrack();

    tmpStream.addTrack(emptyTrack.audioTrack, tmpStream);
    e.session.answer({
      mediaConstraints : {
        audio : true,
        video : videoConstraints
      },
      pcConfig            : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
      // 被叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
      extraHeaders        : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures       : extraFeatures,
      mediaStream         : tmpStream
    });

    setStatus('video answer');
  };

  /**
   * 单视频接听
   */
  document.querySelector('#onlyVideoAudio').onclick = async function()
  {
    e.session.answer({
      mediaConstraints : {
        audio : false,
        video : videoConstraints
      },
      pcConfig            : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
      // 被叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
      extraHeaders        : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures       : extraFeatures
    });

    setStatus('video answer');
  };

  /**
   * 自定义视频接听
   */
  document.querySelector('#onlyCommVideo').onclick = async function()
  {
    const tmpStream = new MediaStream();

    blackVideo || (blackVideo = CRTC.Utils.generateAnBlackVideoTrack({ svgSource: no_camera_svg, width: videoConstraints.width, height: videoConstraints.height, fps: videoConstraints.fps }));

    tmpStream.addTrack(blackVideo.videoTrack, tmpStream);

    e.session.answer({
      mediaConstraints : {
        audio : false,
        video : true
      },
      pcConfig            : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
      // 被叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
      extraHeaders        : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures       : extraFeatures,
      mediaStream         : tmpStream
    });

    setStatus('video answer');
  };
  document.querySelector('#audioCommVideo').onclick = async function()
  {
    const tmpStream = new MediaStream();


    blackVideo || (blackVideo = CRTC.Utils.generateAnBlackVideoTrack({ svgSource: no_camera_svg, width: videoConstraints.width, height: videoConstraints.height, fps: videoConstraints.fps }));

    tmpStream.addTrack(blackVideo.videoTrack, tmpStream);

    e.session.answer({
      mediaConstraints : {
        audio : true,
        video : true
      },
      pcConfig            : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
      // 被叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
      extraHeaders        : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures       : extraFeatures,
      mediaStream         : tmpStream
    });

    setStatus('video answer');
  };

  /**
   * 切换为音频模式
   *
   * 切换会触发 session 的 mode 事件回调
   */
  document.querySelector('#toAudio').onclick = function()
  {
    e.session.demoteToAudio({ useUpdate: false }, () => { setStatus(`切换音频模式完成${curMode}`); });
  };

  /**
   * 切换为视频模式
   *
   * 切换会触发 session 的 mode 事件回调
   */
  document.querySelector('#toVideo').onclick = function()
  {
    e.session.upgradeToVideo({ useUpdate: false }, () => { setStatus(`切换视频模式完成${curMode}`); });
    stats && stats.reset();
  };

  /**
   * 切换自定义流单向视频
   */
  document.querySelector('#toCommonVideoSendonly').onclick = function()
  {
    const tmpStream = new MediaStream();


    blackVideo || (blackVideo = CRTC.Utils.generateAnBlackVideoTrack({ svgSource: no_camera_svg, width: videoConstraints.width, height: videoConstraints.height, fps: videoConstraints.fps }));

    tmpStream.addTrack(blackVideo.videoTrack, tmpStream);

    e.session.upgradeToVideo({ sendOnly: true, useUpdate: useUpdate, videoStream: tmpStream }, () => { setStatus('切换视频模式完成')+curMode; });
    stats && stats.reset();
  };

  /**
   * 替换自定义流
   */
  document.querySelector('#switchVideo').onclick = function()
  {
    const cusVideo = CRTC.Utils.generateAnBlackVideoTrack({ svgSource: no_camera_svg, width: videoConstraints.width, height: videoConstraints.height, fps: videoConstraints.fps });

    e.session.connection.getSenders().forEach((sender) =>
    {
      if (sender.track.kind === 'video')
      {
        sender.replaceTrack(cusVideo.videoTrack).then(() => setStatus('替换成功'));
      }
    });
  };

  /**
   * 切换单向视频
   */
  document.querySelector('#toVideoSendonly').onclick = function()
  {
    e.session.upgradeToVideo({ sendOnly: true, useUpdate: useUpdate, videoConstraints: videoConstraints }, () => { setStatus('切换视频模式完成')+curMode; });
    stats && stats.reset();
  };

  /**
   * 自定义流视频模式
   */
  document.querySelector('#toCommonVideo').onclick = function()
  {
    const tmpStream = new MediaStream();

    blackVideo || (blackVideo = CRTC.Utils.generateAnBlackVideoTrack({ svgSource: no_camera_svg, width: videoConstraints.width, height: videoConstraints.height, fps: videoConstraints.fps }));

    tmpStream.addTrack(blackVideo.videoTrack, tmpStream);
    e.session.upgradeToVideo({ useUpdate: useUpdate, videoStream: tmpStream }, () => { setStatus('切换视频模式完成')+curMode; });
    stats && stats.reset();
  };


  /**
   * 切换摄像头
   *
   * 切换摄像头成功会触发 session 的 cameraChanged 事件回调
   */
  document.querySelector('#cameras').onchange = function()
  {
    if (cloneStream)
    {
      cloneStream.getVideoTracks().forEach((v) =>
      {
        v.stop();
      });
    }
    e.session.switchDevice('camera', this.options[this.selectedIndex].value);
    // .then(() => e.session.renegotiate())
    // .catch((err) => console.warn('err: ', err));
    setStatus(`switchDevice${this.options[this.selectedIndex].innerText}`);
  };

  /**
   * 切换麦克风
   *
   * 切换摄像头成功会触发 session 的 cameraChanged 事件回调
   */
  document.querySelector('#mics').onchange = function()
  {
    e.session.switchDevice('audio', this.options[this.selectedIndex].value);
    setStatus(`switchDevice${this.options[this.selectedIndex].innerText}`);
  };

  /**
   * 手机端用切换摄像头
   */
  document.querySelector('#switchDevice').onclick = async function()
  {
    if (cloneStream)
    {
      cloneStream.getVideoTracks().forEach((v) =>
      {
        v.stop();
      });
    }
    e.session.switchDevice('camera', camFlag ? 'environment' : 'user')
      .then(() => e.session.renegotiate())
      .catch((err) => console.warn('err: ', err));

    camFlag = !camFlag;
    setStatus(`switchDevice facingMode ${ camFlag}`);
  };

  /**
   * 结束通话
   */
  document.querySelector('#cancel').onclick = function()
  {
    e.session.terminate();

    blackVideo && blackVideo.cleanup();

    try
    {
      rtcSession.terminate();
      tmpSession.terminate();
    }
    catch (error) { }
  };

  /**
   * 呼叫盲转
   */
  document.querySelector('#referBtn').onclick = function()
  {
    // 转接过程中的事件
    const eventHandlers = {
      'progress'         : function(data) { console.log('progress', data); },
      'failed'           : function() { if (e.session.isOnHold().local) { e.session.unhold(); } },
      'accepted'         : function(data) { console.log('accept', data); e.session.terminate(); },
      'trying'           : function(data) { console.log('trying', data); },
      'requestSucceeded' : function(data) { console.log('requestSucceeded', data); },
      'requestFailed'    : function() { if (e.session.isOnHold().local) { e.session.unhold(); } }
    };

    // 暂停前一个通话，开始转接
    e.session.hold();
    e.session.refer(`${document.querySelector('#refer').value}@${sipDomain}`, {
      eventHandlers : eventHandlers
    });
  };

  /**
   * 关闭麦克风
   */
  document.querySelector('#muteMic').onclick = function()
  {
    console.log('mute: ', e.session.isMuted().audio);
    // 关闭麦克风
    e.session.mute({ audio: true });
  };

  /**
   * 开启麦克风
   */
  document.querySelector('#unmuteMic').onclick = function()
  {
    console.log('unmute: ', e.session.isMuted().audio);
    // 开启麦克风
    e.session.unmute({ audio: true });
  };

  /**
   * 关闭视频
   */
  document.querySelector('#muteCam').onclick = function()
  {
    // 关闭摄像头
    e.session.mute({ video: true });
  };

  /**
   * 开启视频
   */
  document.querySelector('#unmuteCam').onclick = function()
  {
    // 摄像头为关闭状态，则开启摄像头
    e.session.unmute({ video: true });
  };

  /**
   * 暂停/恢复通话
   */
  document.querySelector('#hold').onclick = function()
  {
    // 获取通话中本端和远端是否是暂停状态
    const isHold = e.session.isOnHold();

    // 本端暂停才可以执行恢复方法
    if (isHold.local)
    {
      // 恢复通话
      e.session.unhold();
    }
    // 本地和远端都未暂停才可以执行暂停方法
    else if (!isHold.remote)
    {
      // 暂停通话
      e.session.hold();
    }
  };

  /**
   * 分享屏幕
   */
  document.querySelector('#screenShare').onclick = function()
  {
    e.session.share('screen', null, null)
      .then((stream) =>
      {
        document.querySelector('#screen').srcObject = stream;
        document.querySelector('#screen').classList = 'mh-100 mw-100';

        stream.getVideoTracks()[0].onended = () =>
        {
          document.querySelector('#screen').classList = 'mh-100 mw-100 hide';
        };
      });
  };
  document.querySelector('#screenShareD').onclick = function()
  {
    e.session.share('screen', null, null, true)
      .then((stream) =>
      {
        document.querySelector('#screen').srcObject = stream;
        document.querySelector('#screen').classList = 'mh-100 mw-100';

        // 演示用
        // e.session.sendFloorStatus(3);

        // 部分被动场景可能无法触发ended事件，集成时如果必要可以考虑定时获取状态更新页面
        stream.getVideoTracks()[0].addEventListener('ended', () =>
        {
          // e.session.sendFloorStatus(6);
          document.querySelector('#screen').classList = 'mh-100 mw-100 hide';
        });

        const timer = setInterval(() =>
        {
          if (stream.getVideoTracks()[0].readyState === 'ended')
          {
            // e.session.sendFloorStatus(6);
            document.querySelector('#screen').classList = 'mh-100 mw-100 hide';
            clearInterval(timer);
          }
        }, 100);

        document.querySelector('#remoteVideo2').srcObject = null;
        document.querySelector('#remoteVideo2').classList = 'mh-100 mw-100 hide';
      })
      .catch((error) =>
      {
        if (error.message && error.message.indexOf('user gesture handler') !== -1)
        {
          safari_r = true;
          setStatus('请在浏览器中点击 "Safari分享" 按钮触发屏幕分享');
        }

        console.warn('error: ', error);
        setStatus(error.message);
        // e.session.sendFloorStatus(6);
      });
  };

  document.querySelector('#screenShareD_iOS').onclick = function()
  {
    if (safari_r)
    {
      safari_r = false;
      e.session.share('screen', null, null, true, true)
        .then((stream) =>
        {
          document.querySelector('#screen').srcObject = stream;
          document.querySelector('#screen').classList = 'mh-100 mw-100';

          // 演示用
          // e.session.sendFloorStatus(3);

          // 部分被动场景可能无法触发ended事件，集成时如果必要可以考虑定时获取状态更新页面
          stream.getVideoTracks()[0].addEventListener('ended', () =>
          {
            // e.session.sendFloorStatus(6);
            document.querySelector('#screen').classList = 'mh-100 mw-100 hide';
          });

          const timer = setInterval(() =>
          {
            if (stream.getVideoTracks()[0].readyState === 'ended')
            {
              // e.session.sendFloorStatus(6);
              document.querySelector('#screen').classList = 'mh-100 mw-100 hide';
              clearInterval(timer);
            }
          }, 100);

          document.querySelector('#remoteVideo2').srcObject = null;
          document.querySelector('#remoteVideo2').classList = 'mh-100 mw-100 hide';
        })
        .catch((err) =>
        {
          console.warn('err: ', err);
          // e.session.sendFloorStatus(6);
        });
    }
  };

  /**
   * 分享页面元素
   *
   * 分享页面元素依赖 html2canvas.js
   */
  document.querySelector('#formShare').onclick = function()
  {
    e.session.share('html', '#ele', html2canvas);
  };
  document.querySelector('#formShareD').onclick = function()
  {
    e.session.share('html', '#ele', html2canvas, true);
  };

  /**
   * 分享图片
   */
  document.querySelector('#picShare').onclick = function()
  {
    e.session.share('pic', '#pic_s', null);
  };
  document.querySelector('#picShareD').onclick = function()
  {
    e.session.share('pic', '#pic_s', null, true);
  };

  /**
   * 分享视频
   */
  document.querySelector('#videoShare').onclick = function()
  {
    // 分享视频需要视频在播放状态
    document.querySelector('#video_s').play()
      .then(() =>
      {
        e.session.share('video', '#video_s', null);
      });
  };
  document.querySelector('#videoShareD').onclick = function()
  {
    // 分享视频需要视频在播放状态
    document.querySelector('#video_s').play()
      .then(() =>
      {
        e.session.share('video', '#video_s', null, true);
      });
  };

  /**
   * 停止分享
   */
  document.querySelector('#stopShare').onclick = function()
  {
    e.session.unShare();

    setTimeout(() =>
    {
      // 获取媒体流
      getStreams(e.session.connection);
    }, 300);
  };

  /**
   * 发送 DTMF
   */
  document.querySelector('#dtmf').onclick = function(d)
  {
    e.session.sendDTMF(d.target.innerText, { 'transportType': 'RFC2833' });
  };

  /**
   * 通话种推送消息
   */
  document.querySelector('#sendInfo').onclick = function()
  {
    // 注意： contentType 必填，一般用 text/plain 发送字符串
    e.session.sendInfo('text/plain', document.querySelector('#info').value);
  };

  /**
   * 对远端媒体截图
   */
  document.querySelector('#capture').onclick = function()
  {
    const canvas = document.getElementById('captureView');
    const ctx = canvas.getContext('2d');

    canvas.width = $('#remoteVideo')[0].videoWidth;
    canvas.height = $('#remoteVideo')[0].videoHeight;

    ctx.drawImage(
      $('#remoteVideo')[0],
      0,
      0,
      $('#remoteVideo')[0].videoWidth,
      $('#remoteVideo')[0].videoHeight
    );
  };
});


/**
 * 测试用
 */
document.querySelector('#testBtn').onclick = function()
{
  console.warn('aaaaaaaaaaaaaaaaaaaaaa');
  navigator.mediaDevices.enumerateDevices()
    .then((devices) =>
    {
      const dev=[];

      devices.forEach((device) =>
      {
        dev.push(device);
        if (typeof device.getCapabilities === 'function')
        {
          dev.push(device.getCapabilities());
          console.warn(device);
        }
      });

      document.body.innerText=JSON.stringify(dev);
    });
};

// 部分场景视频卡死需要重新播放
document.querySelector('.resume').onclick = function()
{
  document.querySelectorAll('video').forEach((video) => video.play().catch());
};

// useUpdate
document.querySelector('#useupdate').onchange = function()
{
  this.options[this.selectedIndex].value !== 'update' ? useUpdate = false : useUpdate = true;
  console.log(this.options[this.selectedIndex]);
  setStatus(`${this.options[this.selectedIndex].value === 'update' ? 'useUpdate' : 'useReInvite'}`);
};

// useRnnoiseNode
document.querySelector('#useRnnoiseNode').onchange = function()
{
  this.options[this.selectedIndex].value !== '0' ? useRnnoiseNode = true : useRnnoiseNode = false;
  console.log(this.options[this.selectedIndex]);
  setStatus(`noise: ${useRnnoiseNode}`);
};

/**
 * 发起呼叫
 * @param {string} type 呼叫类型 - audio：音频模式（默认）；video：视频模式
 */
async function call(type, direction, mediaStream)
{
  telephone_event_pt = null;

  camFlag = true;

  if (!ua.isRegistered())
  {
    setStatus('请注册成功后呼叫');

    return;
  }

  rtcSession && rtcSession.terminate();

  options = {
    // 呼叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
    extraHeaders  : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
    // cMode         : 'paphone',
    extraFeatures : extraFeatures,
    pcConfig      : pcConfig
  };

  if (direction == 'sendonly')
  {
    options['rtcOfferConstraints'] = { offerToReceiveAudio: true, offerToReceiveVideo: false };
  }

  if (mediaStream)
  {
    options['mediaStream'] = mediaStream;
  }
  else
  {
    options['mediaConstraints'] = {
      audio :
      {
        sampleRate   : 48000,
        channelCount : 1
      },
      video : (type === 'video' || type === 'onlyVideo') ? videoConstraints : false
    };
  }

  if (type === 'screen')
  {
    await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false })
      .then(async(stream) =>
      {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: options['mediaConstraints'].audio, video: false });

        cusMediaStream.addTrack(stream.getVideoTracks()[0]);
        cusMediaStream.addTrack(audioStream.getAudioTracks()[0]);
        delete options['mediaConstraints'];
        options['mediaStream'] = cusMediaStream;
      });
  }

  if (type === 'callnull' || type === 'callnullaudio' || type === 'callnullvideo')
  {
    const tmpStream = new MediaStream();

    if (type === 'callnullaudio' || type === 'callnull')
    {
      const emptyTrack = await CRTC.Utils.generateAnEmptyAudioTrack();

      // 自定义音频
      tmpStream.addTrack(emptyTrack.audioTrack, tmpStream);
    }

    blackVideo || (blackVideo = CRTC.Utils.generateAnBlackVideoTrack({ svgSource: no_camera_svg, width: videoConstraints.width, height: videoConstraints.height, fps: videoConstraints.fps }));

    window.novideo = blackVideo;

    // 自定义视频
    (type === 'callnullvideo' || type === 'callnull') && tmpStream.addTrack(novideo.videoTrack, tmpStream);

    options['mediaStream'] = tmpStream;

    // 系统麦克风和摄像头
    options['mediaConstraints'] = {
      audio : type === 'callnullvideo' ? true : false,
      video : type === 'callnullaudio' ? videoConstraints : true
    };
  }

  if (type === 'onlyVideo')
  {
    options.mediaConstraints.audio = false;
  }

  const callee = document.querySelector('#callee').value;

  console.log('op: ', options);

  try
  {
    const session = await ua.call(`${callee}@${sipDomain}`, options);

    // 默认远端无回铃音
    earlyMedia = false;

    // 播放远端的回铃音
    session.connection.ontrack = function(event)
    {
      if (event.track.kind === 'audio')
      {
        // 收到远端媒体则设置远端回铃音
        earlyMedia = true;

        remoteAudio.srcObject = event.streams[0];

        /**
       * 兼容chrome
       * https://developer.chrome.com/blog/play-request-was-interrupted/#error
       * https://bugs.chromium.org/p/chromium/issues/detail?id=718647
       */
        remoteAudio.play()
          .catch(() => { });
      }
    };

    // 外呼未触发newRTCSession前取消呼叫
    document.querySelector('#cancel').onclick = function()
    {
      try
      {
        session.terminate();
      }
      catch (error)
      {
        if (error.message === 'Invalid status: 8' || error.message === 'Invalid status: 7')
        {
          console.warn('ended');
        }
        console.warn(error.message);
      }

      // session.terminate();
      // 关闭无设备的黑屏
      blackVideo && blackVideo.cleanup();

      // 兼容mcu等候室用
      cloneStream && cloneStream.getTracks().forEach((track) =>
      {
        track.stop();
        localVideo.srcObject = null;
      });

      cloneStream = null;
    };

  }
  catch (error)
  {
    console.warn(`name: ${error.name}, message: ${error.message}`);
  }


  // 兼容iOS
  if (optionsTimer)
  {
    clearInterval(optionsTimer);
  }

  if (navigator.userAgent.indexOf('iPhone') != -1)
  {
    optionsTimer = setInterval(() =>
    {
      ua.sendOptions(`sip_ping@${sipDomain}`);
    }, 3000);
  }

}

function generateAnEmptyAudioTrack()
{
  // 增加安卓微信呼叫的语音提醒
  // const audio = new Audio('./sound/waiting.mp3');
  const audio = new Audio();
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
 * 获取发送和接收的音视频媒体流，并渲染到DOM
 *
 * @param {RTCPeerConnection} pc 用户获取媒体流的 RTCPeerConnection 对象
 */
function getStreams(pc)
{
  // 本地媒体流
  const localStream = CRTC.Utils.getStreams(pc, 'local');
  // 远端媒体流
  const remoteStream = CRTC.Utils.getStreams(pc, 'remote');

  // const audioTrack = localStream.audioStream.getAudioTracks()>0 ? localStream.audioStream.getAudioTracks()[0].clone():null;
  // const videoTrack = (localStream.videoStream.getVideoTracks().length > 0) ? localStream.videoStream.getVideoTracks()[0].clone() : null;
  const audioTrack = localStream.audioStream.getAudioTracks() > 0 ? localStream.audioStream.getAudioTracks()[0] : null;
  const videoTrack = (localStream.videoStream.getVideoTracks().length > 0) ? localStream.videoStream.getVideoTracks()[0] : null;
  const mediaStreamArray = [];

  let newCloneStream;

  if (videoTrack)
  {
    mediaStreamArray.push(videoTrack);
  }
  else if (audioTrack)
  {
    mediaStreamArray.push(audioTrack);
  }

  if (mediaStreamArray.length > 0)
  {
    // 本地视频
    newCloneStream = new MediaStream(mediaStreamArray);

    localVideo.srcObject = newCloneStream;
    newCloneStream.getTracks().length > 0 && newCloneStream.getTracks()[0].addEventListener('ended', function()
    {
      // 特殊情况下清理页面残留的video黑框
      localVideo.srcObject = null;
    });
  }

  // 停止旧的媒体流
  if (cloneStream)
  {
    if (!isRefer)
    {
      // cloneStream.getTracks().forEach((track) => track.stop());
    }
  }
  isRefer = false;

  // 更新全局的 cloneStream 引用
  newCloneStream && (cloneStream = newCloneStream);

  // 远端音频
  // 适配安卓微信部分情况下无声音问题 trackId
  setTimeout(() =>
  {
    remoteAudio.srcObject = remoteStream.audioStream;

    /**
     * 兼容chrome
     * https://developer.chrome.com/blog/play-request-was-interrupted/#error
     * https://bugs.chromium.org/p/chromium/issues/detail?id=718647
     */
    remoteAudio.play()
      .catch(() => { });
  }, 100);
  // 远端视频
  remoteVideo.srcObject = remoteStream.mediaStream;
  remoteStream.videoStream.getVideoTracks().length > 0 && remoteStream.videoStream.getVideoTracks()[0].addEventListener('ended', function()
  {
    // 特殊情况下清理页面残留的video黑框
    if (!tmpSession)
    {
      remoteVideo.srcObject = null;
    }
  });

  /**
   * 兼容chrome
   * https://developer.chrome.com/blog/play-request-was-interrupted/#error
   * https://bugs.chromium.org/p/chromium/issues/detail?id=718647
   */
  Promise.all([ localVideo.play(), remoteAudio.play(), remoteVideo.play() ])
    .then(() => { })
    .catch(() => { });
}

function stopStreams()
{
  // 停止媒体流，这里可以切换页面UI
  remoteVideo.srcObject = null;
  remoteAudio.srcObject = null;
  localVideo.srcObject = null;
}

/**
 * 获取url参数
 *
 * @param {string} name - 参数名，区分大小写
 */
function handleGetQuery(name)
{
  const reg = new RegExp(`(^|&)${name}=([^&]*)(&|$)`, 'i');
  const r = window.location.search.substr(1).match(reg);

  if (r != null) return unescape(r[2]);

  return null;
}

/**
 * 输出显示状态
 *
 * @param {string} text - 输出的内容
 */
function setStatus(text)
{
  const statusDom = document.querySelector('#status');

  statusDom.innerText = `${statusDom.innerText}${text}\r\n`;
}

// 检查摄像头状态
async function checkCameraStatus()
{
  try
  {
    // 先检查是否有摄像头设备
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === 'videoinput');

    if (videoDevices.length === 0)
    {
      return '系统没有摄像头';
    }

    // 尝试访问摄像头
    await navigator.mediaDevices.getUserMedia({ video: true }).then((mediastream) => { mediastream && mediastream.getTracks().forEach((t) => t.stop()); });
    haveACamera = true;

    return '摄像头可以正常使用';

  }
  catch (error)
  {
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError')
    {
      return '系统没有摄像头';
    }
    else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')
    {
      return '用户拒绝了摄像头权限';
    }
    else
    {
      return `摄像头错误: ${error.name}`;
    }
  }
}

/**
 * 更新摄像头下拉列表
 */
function updateDevices()
{
  CRTC.Utils.getCameras()
    .then((cameras) =>
    {
      let option = '<option selected value="">请选择切换摄像头</option>';

      cameras.forEach((device) =>
      {
        option += `<option value="${device.deviceId}">${device.label}</option>`;
      });

      document.querySelector('#cameras').innerHTML = option;
    });

  checkCameraStatus();

  // 移动端不支持切换麦克风
  CRTC.Utils.getMicrophones()
    .then((microphones) =>
    {
      let menus = '';

      microphones.forEach((device) =>
      {
        menus += `<option value="${device.deviceId}">${device.label}</option>`;
      });

      document.querySelector('#mics').innerHTML = menus;
    });
}

/**
 * 启动初始化
 */
function start()
{
  // 输出SDK版本号
  setStatus(`${CRTC.version}`);

  // 更新摄像头下拉列表
  updateDevices();

  // 初始化断网提示相关
  handleStop=false;
  disconnectedBy = null;
  isShowUI = false;

  // 启动UA，连接信令服务器并注册
  ua.start();

  setTimeout(() =>
  {
    if (!ua.isConnected() || !ua.isRegistered())
    {
      ua.stop();
      console.log('网络连接异常或未注册成功');
    }
  }, 10000);

  // 发起无音视频呼叫
  document.querySelector('#callNull').onclick = function()
  {
    // 设置当前通话模式为音频模式
    call('callnull');
  };

  // 发起无麦克风呼叫
  document.querySelector('#callNullAudio').onclick = function()
  {
    // 设置当前通话模式为音频模式
    call('callnullaudio');
  };

  // 发起无音视频呼叫
  document.querySelector('#callNullVideo').onclick = function()
  {
    // 设置当前通话模式为音频模式
    call('callnullvideo');
  };

  // 发起音频呼叫
  document.querySelector('#call').onclick = function()
  {
    // 设置当前通话模式为音频模式
    call();
  };

  // 发起共享桌面视频呼叫
  document.querySelector('#callScreen').onclick = function()
  {
    // 设置当前通话模式为视频模式
    call('screen');
  };

  // 发起视频呼叫
  document.querySelector('#callVideo').onclick = function()
  {
    // 设置当前通话模式为视频模式
    call('video');
  };

  // 发起无音频视频呼叫
  document.querySelector('#callAudio').onclick = function()
  {
    // 设置当前通话模式为视频模式
    call('onlyVideo');
  };

  // 发起视频呼叫
  // document.querySelector('#callVideoSendonly').onclick = function()
  // {
  //   // 设置当前通话模式为单向视频模式
  //   call('video', 'sendonly');
  // };

  // 监听系统输入设备变化更新摄像头列表
  navigator.mediaDevices.addEventListener('devicechange', () =>
  {
    updateDevices();
  });

  // 页面刷新 终止会话，注销ua
  window.onbeforeunload = function()
  {
    handleStop = true;
    ua.stop();
  };
}

start();

document.addEventListener('visibilitychange', function()
{
  if (document.hidden)
  {
    console.log('页面进入后台');
  }
  else
  {
    // document.querySelectorAll('video').forEach((video) => video.play().catch((err) => console.warn('e: ', err)));
    console.warn('页面回到前台');
  }
});
