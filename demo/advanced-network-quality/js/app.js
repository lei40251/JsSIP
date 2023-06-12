/* eslint-disable no-console */
/* eslint-disable no-undef */

// 调试信息输出
CRTC.debug.enable('CRTC:*');
// 关闭调试信息输出
// CRTC.debug.disable('CRTC:*');

// 通话统计
let stats;
let tmpAudioStream;
let tmpVideoStream;

// 兼容部分iOS手机蓝牙问题
let tmpStream = null;

// 远端客户端UA
// let remoteUA;

const localVideo = document.querySelector('#localVideo');
const remoteVideo = document.querySelector('#remoteVideo');
const remoteAudio = document.querySelector('#remoteAudio');

// 信令地址
const signalingUrl = 'wss://5g.vsbc.com:9002/wss';
// const signalingUrl = 'wss://pro.vsbc.com:60041/wss';
// const signalingUrl = 'wss://pro.vsbc.com:60040/wss';
// const signalingUrl = 'wss://pro.vsbc.com:12550/wss';
// sip domain
const sipDomain = '5g.vsbc.com';
// const sipDomain = 'pro.vsbc.com';

// 注册UA的用户名
const account = handleGetQuery('caller');
// websocket 实例
const socket = new CRTC.WebSocketInterface(signalingUrl);
// UA 配置项
const configuration = {
  // JsSIP.Socket 实例
  sockets      : socket,
  // 与 UA 关联的 SIP URI
  uri          : `sip:${account}@${sipDomain}`,
  // 显示名
  display_name : account,
  // SIP身份验证密码
  password     : `yl_19${account}`,
  secret_key   : sessionStorage.getItem('secret_key') || 'tGUEY7b+Tnrx9nRtn463YcssbMKswoiI0txcM+sHKx7HbT8n3KabY3Psx3KCILRE+Jvmr09ytnhCtuvsOlNVngWKI1UAGTKGB8UIwXOTM4i4G4FlzbTXGSuQ+jmxwfzEO2njBMdJS3r9yMce1o7cqRxL3R/y+UnZQTJnyiIOvvZS3lf1o5+ge4oMZTgly0xVaBy9TbyG3PIOgXC/wTH5GrG0IhpDQ8Ez5LLgV3tTAbZHSti0cn6ChUdVaB1n5OsElRhO7iTXLsUwtGDFlHUM6v0OL2bnHIMVaGbI9SpWmppucJGKB5CfU+dora5sjJ0pPhqgGHgqee5mSuD4jz0XoA=='
};
// 媒体约束条件
const videoConstraints = {
  width     : { ideal: 640 },
  height    : { ideal: 480 },
  frameRate : 15
};

// RTCPeerConnection 的 RTCConfiguration 对象
const pcConfig = {
  // TURN 配置
  // iceServers : [
  //   {
  //     'urls'       : 'turn:5g.vsbc.com:60000?transport=udp',
  //     'username'   : 'ipcu',
  //     'credential' : 'yl_19cu'
  //   } ],
  // iceTransportPolicy : 'public',
  bundlePolicy       : 'balanced',
  tcpCandidatePolicy : 'disable',
  IceTransportsType  : 'nohost'
};

if (/Android/.test(navigator.userAgent))
{
  const browserVersion = navigator.userAgent.match(/Chrome\/(\d+)/)[1];

  if (browserVersion < 85)
  {
    console.log('Your Chrome version is lower than 85.');
    pcConfig['iceServers'] =[
      {
        'urls'       : 'turn:5g.vsbc.com:60000?transport=udp',
        'username'   : 'ipcu',
        'credential' : 'yl_19cu'
      } ];

    pcConfig['iceTransportPolicy']= 'all';
    pcConfig['iceCandidatePoolSize']= 2;
  }
}
// UA 实例
const ua = new CRTC.UA(configuration);

// ***** UA 事件回调 *****

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
 * disconnected
 *
 * @fires 信令连接尝试(或自动重新尝试)失败时触发
 *
 * @type {object}
 * @property {boolean} error - 连接是否因为错误而断开
 */
ua.on('disconnected', function(data)
{
  needReinvite = true;
  setStatus(`信令连接断开: ${data.code} ${data.reason}`);
});

/**
 * connected
 *
 * @fires 信令连接尝试(或自动重新尝试)成功时触发
 *
 * @type {object}
 */
ua.on('connected', function()
{
  if (needReinvite)
  {
    rtcSession && rtcSession.renegotiate({ rtcOfferConstraints: { iceRestart: true } });

    setStatus('reinvite');
  }
  setStatus('信令已连接');
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
  console.log('nsession: ', e);

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

  // 部分场景兼容使用
  e.session.on('sdp', function(d)
  {
    if (d.originator === 'remote' && d.sdp && d.sdp.indexOf('a=inactive') !== -1)
    {
      d.sdp = d.sdp.replace(/m=video \d*/, 'm=video 0');
    }
    d.sdp = d.sdp.replace(/42e01f/, '42c01e');
    d.sdp = d.sdp.replace(/a=rtcp-fb:98 goog-remb\r\n/g, '');
    d.sdp = d.sdp.replace(/a=rtcp-fb:98 transport-cc\r\n/g, '');
    d.sdp = d.sdp.replace(/a=extmap:7 urn:3gpp:video-orientation/, 'a=extmap:13 urn:3gpp:video-orientation');

    if (d.originator === 'local')
    {
      d.sdp = d.sdp.replace(/a=group:BUNDLE.*\r\n/, '');
    }
    // else if (d.sdp.indexOf('a=mid:0') === -1)
    // {
    //   const regex = /(m=audio.*\r?\n)([\s\S]*?)(m=video.*\r?\n)([\s\S]*?)(?=(m=|$))/g;
    //   const replacement = '$1a=mid:0\r\n$2$3a=mid:1\r\n$4';
    //   // const newSdp = sdp.replace(regex, replacement);

    //   d.sdp = d.sdp.replace(regex, replacement);
    // }
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
      setStatus('对方已振铃，请等待接听');
    }
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
    setStatus(`通话建立失败: ${d.cause}`);

    tmpSession = null;
    needReinvite = false;

    if (tmpStream)
    {
      tmpStream.getTracks().forEach((track) => track.stop());
      tmpStream = null;
    }

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
    setStatus('通话结束');

    needReinvite = false;

    if (tmpStream)
    {
      tmpStream.getTracks().forEach((track) => track.stop());
      tmpStream = null;
    }

    // 输出通话开始时间及通话结束时间
    setStatus(`start: ${e.session.start_time}`);
    setStatus(`ended: ${e.session.end_time}`);

    if (rtcSession == e.session && Boolean(tmpSession))
    {
      stopStreams();
      getStreams(tmpSession.connection);
    }
    else
    {
      tmpSession = null;
      rtcSession = null;
      // 通话暂停后跨域设置本地视频媒体为空，或者切换UI为暂停通话状态
      stopStreams();
      // 停止获取统计信息
      stats && stats.stop();
    }
    optionsTimer && clearInterval(optionsTimer);

    document.querySelector('#remoteVideo').classList = 'h-100';
    document.querySelector('#remoteVideo2').classList = 'hide';
  });

  /**
    * confirmed
    *
    * @fires 通话确认ACK的时候触发
    *
    * @type {object}
    * @property {string} originator - 'remote'为远端触发，'local'为本端触发
    */
  e.session.on('confirmed', async function(d)
  {
    setStatus('confirmed');

    // if (e.session === tmpSession)
    // {
    //   rtcSession.terminate();
    // }

    const mics = await CRTC.Utils.getMicrophones();
    // 获取统计信息

    stats = new CRTC.getStats(e.session.connection);
    stats.on('report', function(r)
    {
      document.querySelector('#upF').innerText = `${r.upFrameWidth || ''} ${r.upFrameHeight || ''}`;
      document.querySelector('#downF').innerText = `${r.downFrameWidth || ''} ${r.downFrameHeight || ''}`;
      document.querySelector('#upS').innerText = r.uplinkSpeed || '';
      document.querySelector('#downS').innerText = r.downlinkSpeed || '';
      document.querySelector('#downL').innerText = r.downlinkLoss || '';
    });

    stats.on('network-quality', function(ev)
    {
      console.warn('e: ', ev);
    });

    // 兼容部分手机初始黑屏问题
    e.session.mute({ video: true });
    setTimeout(() =>
    {
      e.session.unmute({ video: true });
    }, 700);

    // 兼容安卓微信Bug及iOS蓝牙问题
    if (d.originator === 'local' && ((navigator.userAgent.indexOf('WeChat') != -1) || (navigator.userAgent.indexOf('iPhone') !=-1 && mics.length > 1)))
    {
      if (tmpStream)
      {
        tmpAudioStream = new MediaStream([ tmpStream.getAudioTracks()[0] ]);

        const sender = e.session.connection.getSenders().find((s) =>
        {
          return s.track.kind == 'audio';
        });

        sender.replaceTrack(tmpStream.getAudioTracks()[0]);
      }
      else
      {
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          .then((stream) =>
          {
            tmpAudioStream = stream;

            const sender = e.session.connection.getSenders().find((s) =>
            {
              return s.track.kind == 'audio';
            });

            sender.replaceTrack(stream.getAudioTracks()[0]);
          });
      }
    }

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
        document.querySelector('#remoteVideo2').play();

        document.querySelector('#remoteVideo').classList = 'w-25 position-absolute top-0 end-0';
        document.querySelector('#remoteVideo2').classList = 'h-100 w-100';
      }
      else
      {
        document.querySelector('#remoteVideo').classList = 'h-100';
        document.querySelector('#remoteVideo2').classList = 'hide';
      }
    };
  });

  //  ***** DOM 事件绑定 *****

  /**
   * 视频接听
   */
  document.querySelector('#answerVideo').onclick = function()
  {
    e.session.answer({
      pcConfig     : pcConfig,
      // 被叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
      extraHeaders : [ 'X-Data: dGVzdCB4LWRhdGE=', `X-UA: ${navigator.userAgent}` ]
    });

    // e.session.answer({
    //   mediaConstraints    : { audio: true, video: videoConstraints },
    //   pcConfig            : pcConfig,
    //   // 被叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
    //   extraHeaders        : [ 'X-Data: dGVzdCB4LWRhdGE=', `X-UA: ${navigator.userAgent}` ],
    //   rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true }
    // });

    setStatus('video answer');
  };

  /**
   * 结束通话
   */
  document.querySelector('#cancel').onclick = function()
  {
    e.session.terminate();

    try
    {
      rtcSession.terminate();
      tmpSession.terminate();
    }
    catch (error) { }
  };
});

/**
 * 发起呼叫
 * @param {string} type 呼叫类型 - audio：音频模式（默认）；video：视频模式
 */
async function call(type, direction)
{
  if (!ua.isRegistered())
  {
    setStatus('请注册成功后呼叫');

    return;
  }

  // 兼容安卓微信Bug、iOS蓝牙及iOS 15.1&15.2问题
  if (/iP(hone|od|ad)/.test(navigator.userAgent))
  {
    tmpStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: videoConstraints });
    const version = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
    const majorVersion = parseInt(version[1], 10);

    if (majorVersion === 15 && (version[2] === '1' || version[2] === '2'))
    {
      console.log('You are using iOS 15.1 or 15.2');
      tmpStream = CRTC.Utils.getStreamThroughCanvas(tmpStream);
    }
  }

  const mics = await CRTC.Utils.getMicrophones();
  const options = {
    // 呼叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
    extraHeaders : [ 'X-Data: dGVzdCB4LWRhdGE=', `X-UA: ${navigator.userAgent}` ],
    pcConfig     : pcConfig
  };

  if (direction == 'sendonly')
  {
    options['rtcOfferConstraints'] ={ offerToReceiveAudio: false, offerToReceiveVideo: false };
  }

  console.warn(tmpStream);

  // 兼容安卓微信Bug及iOS蓝牙问题
  if ((navigator.userAgent.indexOf('WeChat') != -1) || (navigator.userAgent.indexOf('iPhone') !=-1 && mics.length > 1))
  {
    // 增加安卓微信呼叫的语音提醒
    const audio = new Audio('./sound/waiting.mp3');
    const localStream = new MediaStream();
    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();
    const source = audioCtx.createMediaElementSource(audio);

    audio.loop = true;
    audio.crossOrigin = 'anonymous';
    audio.play().catch((e) => { console.log(e); });
    source.connect(destination);
    localStream.addTrack(destination.stream.getAudioTracks()[0]);

    if (type === 'video')
    {
      if (tmpStream)
      {
        localStream.addTrack(tmpStream.getVideoTracks()[0]);
      }
      else
      {
        tmpVideoStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        localStream.addTrack(tmpVideoStream.getVideoTracks()[0]);
      }
    }

    options['mediaStream'] = localStream;
  }
  else if (tmpStream)
  {
    options['mediaStream'] = tmpStream;
  }
  else
  {
    options['mediaConstraints'] = {
      audio : true,
      video : type === 'video' ? videoConstraints : false
    };
  }

  console.warn('options', options);

  const callee = document.querySelector('#callee').value;
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

  // 外呼未触发newRTCSession前取消呼叫
  document.querySelector('#cancel').onclick = function()
  {
    session.terminate();
  };
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

  console.log('ls: ', localStream.videoStream);
  // 本地视频
  localVideo.srcObject = localStream.videoStream;
  localStream.videoStream.getTracks().length > 0 && localStream.videoStream.getTracks()[0].addEventListener('ended', function()
  {
    // 特殊情况下清理页面残留的video黑框
    localVideo.srcObject = null;
  });
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
  remoteVideo.srcObject = remoteStream.videoStream;
  remoteStream.videoStream.getTracks().length> 0 && remoteStream.videoStream.getTracks()[0].addEventListener('ended', function()
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

function stopStreams(type)
{
  // 停止媒体流，这里可以切换页面UI
  remoteVideo.srcObject = null;
  remoteAudio.srcObject = null;
  localVideo.srcObject = null;
  type !== 'hold' && tmpAudioStream && tmpAudioStream.getTracks().forEach((track) =>
  {
    track.stop();
  });
  type !== 'hold' && tmpVideoStream && tmpVideoStream.getTracks().forEach((track) =>
  {
    track.stop();
  });
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
}

/**
 * 启动初始化
 */
function start()
{
  // 输出SDK版本号
  setStatus(`SDK Ver: ${CRTC.version}`);

  // 更新摄像头下拉列表
  updateDevices();

  // 启动UA，连接信令服务器并注册
  ua.start();

  // 发起音频呼叫
  document.querySelector('#call').onclick = function()
  {
    // 设置当前通话模式为音频模式
    call();
  };

  // 发起视频呼叫
  document.querySelector('#callVideo').onclick = function()
  {
    // 设置当前通话模式为视频模式
    call('video');
  };

  // 发起视频呼叫
  document.querySelector('#callVideoSendonly').onclick = function()
  {
    // 设置当前通话模式为单向视频模式
    call('video', 'sendonly');
  };

  // 监听系统输入设备变化更新摄像头列表
  navigator.mediaDevices.addEventListener('devicechange', () =>
  {
    updateDevices();
  });

  // 页面刷新 终止会话，注销ua
  window.onbeforeunload = function()
  {
    ua.stop();

    if (tmpStream)
    {
      tmpStream.getTracks().forEach((track) => track.stop());
      tmpStream = null;
    }
  };
}

start();