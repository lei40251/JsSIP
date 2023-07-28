/* eslint-disable no-console */
/* eslint-disable no-undef */

// 调试信息输出
CRTC.debug.enable('CRTC:*');
// CRTC.debug.disable('CRTC:*');

// 通话统计
let callerStats;
let tmpSession;
// 通话统计
let tmpVideoStream;
// 兼容部分iOS手机蓝牙问题
let tmpStream;
let callee;

// 信令地址
const signalingUrl = 'wss://5g.vsbc.com:9002/wss';
// sip domain
const sipDomain = '5g.vsbc.com';
// const sipDomain = 'pro.vsbc.com';

// 注册UA的用户名
const callerAccount = handleGetQuery('caller');
// UA 配置项
const configuration = {
  // JsSIP.Socket 实例
  sockets      : new CRTC.WebSocketInterface(signalingUrl),
  // 与 UA 关联的 SIP URI
  uri          : `sip:${callerAccount}@${sipDomain}`,
  // 显示名
  display_name : callerAccount,
  // SIP身份验证密码
  password     : `yl_19${callerAccount}`,
  secret_key   : sessionStorage.getItem('secret_key') || 'dhrrsY0tGw0VGSos+3lLLiZJK7hPe10zmSKueyNMS7Ig5PnThG0EYrLGx4mYmE2j23jAVexrZLTjZQL1ytosFN5EU1t95eyn38+t3KTZV4jSPCD2iidEXtOi6GuaB73na/5jH4wkobyOMpaZCKK5SNl2yDhaU8qbXMtnG1b0ezWd+ROcsC4WPh8O0HHk42VWhEnzXVp0k9KAn+idsO2536CZ4uIPPT244Z7aC1QPL0Y5Vj54oJrB3C54wbkouWd9s+MDIm3BzewBnf3ogSLGIlrN85Y7U5PnBERpeb0JXKi8pGGY40fS3EUJxi7zRPRrdGuzrAMgFiOBRTfqz+sWuQ=='
};
// 媒体约束条件
const videoConstraints = {
  width     : { ideal: 640 },
  height    : { ideal: 480 },
  frameRate : 15
};

// RTCPeerConnection 的 RTCConfiguration 对象
const pcConfig = {
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
// 主叫
const caller = new CRTC.UA(configuration);

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
caller.on('failed', function(data)
{
  console.error(`${data.originator} ${data.message} ${data.cause}`);
});

/**
 * disconnected
 *
 * @fires 信令连接尝试(或自动重新尝试)失败时触发
 *
 * @type {object}
 * @property {boolean} error - 连接是否因为错误而断开
 */
caller.on('disconnected', function(data)
{
  console.error(`信令连接断开: ${data.code} ${data.reason}`);
});

/**
 * connected
 *
 * @fires 信令连接尝试(或自动重新尝试)成功时触发
 *
 * @type {object}
 */
caller.on('connected', function()
{
  console.log('信令已连接');
});

/**
 * registered
 *
 * @fires 用户注册成功后触发
 *
 * @type {object}
 * @property {object} response - 注册的响应实例
 */
caller.on('registered', function(data)
{
  console.log(`注册成功：${data.response.from.uri.toString()}`);
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
caller.on('registrationFailed', function(data)
{
  console.error(`注册失败${data.cause}`);
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
caller.on('newRTCSession', function(e)
{
  console.log('nsession: ', e);

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

      d.sdp = d.sdp.replace(/m=video 9/, 'm=video 9999');
      d.sdp = d.sdp.replace(/m=audio 9/, 'm=audio 9999');
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
    console.error(`通话建立失败: ${d.cause}`);

    tmpSession = null;

    if (tmpStream)
    {
      tmpStream.getTracks().forEach((track) => track.stop());
      tmpStream = null;
    }

    // 输出通话开始时间及通话结束时间
    console.log(`start: ${e.session.start_time}`);
    console.log(`ended: ${e.session.end_time}`);

    // 通话暂停后跨域设置本地视频媒体为空，或者切换UI为暂停通话状态
    stopStreams();

    // 停止获取统计信息
    callerStats && callerStats.stop();
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
    console.warn('通话结束');

    if (tmpStream)
    {
      tmpStream.getTracks().forEach((track) => track.stop());
      tmpStream = null;
    }

    // 输出通话开始时间及通话结束时间
    console.log(`start: ${e.session.start_time}`);
    console.log(`ended: ${e.session.end_time}`);

    // 停止获取统计信息
    callerStats && callerStats.stop();


    // 计算上行平均网络质量
    if (testResult.uplinkNetworkQualities.length > 0)
    {
      testResult.average.uplinkNetworkQuality = Math.ceil(
        testResult.uplinkNetworkQualities.reduce((value, current) => value + current, 0) / testResult.uplinkNetworkQualities.length
      );
    }
    if (testResult.downlinkNetworkQualities.length > 0)
    {
    // 计算下行平均网络质量
      testResult.average.downlinkNetworkQuality = Math.ceil(
        testResult.downlinkNetworkQualities.reduce((value, current) => value + current, 0) / testResult.downlinkNetworkQualities.length
      );
    }

    document.body.innerHTML = JSON.stringify(testResult, null, 2);
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
    // 通话建立后20s统计时间然后结束通话
    setTimeout(() =>
    {
      e.session.terminate();

      try
      {
        tmpSession.terminate();
      }
      catch (error) { }
    }, 20000);

    const mics = await CRTC.Utils.getMicrophones();
    // 获取统计信息

    callerStats = new CRTC.getStats(e.session.connection);
    callerStats.on('report', function(r)
    {
      document.querySelector('#upF').innerText = `${r.upFrameWidth || ''} ${r.upFrameHeight || ''}`;
      document.querySelector('#downF').innerText = `${r.downFrameWidth || ''} ${r.downFrameHeight || ''}`;
      document.querySelector('#upS').innerText = r.uplinkSpeed || '';
      document.querySelector('#downS').innerText = r.downlinkSpeed || '';
      document.querySelector('#downL').innerText = r.downlinkLoss || '';
    });

    callerStats.on('network-quality', function(ev)
    {
      const { uplinkNetworkQuality, RTT, uplinkLoss, downlinkNetworkQuality, downlinkLoss } = ev;

      document.querySelector('#uNQ').innerText =`Rtt: ${RTT} ## uQ: ${uplinkNetworkQuality} uL: ${uplinkLoss} ## dQ: ${downlinkNetworkQuality} dL: ${downlinkLoss}`;
      testResult.uplinkNetworkQualities.push(ev.uplinkNetworkQuality);
    });

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
});

/**
 * 发起呼叫
 * @param {string} type 呼叫类型 - audio：音频模式（默认）；video：视频模式
 */
async function call(type, direction)
{
  if (!caller.isRegistered() || !callee.isRegistered)
  {
    console.error('请注册成功后呼叫');
    setTimeout(() =>
    {
      call('video', 'sendonly');
    }, 100);

    return;
  }

  // // 兼容安卓微信Bug、iOS蓝牙及iOS 15.1&15.2问题
  // if (/iP(hone|od|ad)/.test(navigator.userAgent))
  // {
  //   tmpStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: videoConstraints });
  //   const version = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
  //   const majorVersion = parseInt(version[1], 10);

  //   if (majorVersion === 15 && (version[2] === '1' || version[2] === '2'))
  //   {
  //     console.log('You are using iOS 15.1 or 15.2');
  //     tmpStream = CRTC.Utils.getStreamThroughCanvas(tmpStream);
  //   }
  // }

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

  // // 兼容安卓微信Bug及iOS蓝牙问题
  // if ((navigator.userAgent.indexOf('WeChat') != -1) || (navigator.userAgent.indexOf('iPhone') !=-1 && mics.length > 1))
  // {
  //   // 增加安卓微信呼叫的语音提醒
  //   const audio = new Audio('./sound/waiting.mp3');
  //   const localStream = new MediaStream();
  //   const audioCtx = new AudioContext();
  //   const destination = audioCtx.createMediaStreamDestination();
  //   const source = audioCtx.createMediaElementSource(audio);

  //   audio.loop = true;
  //   audio.crossOrigin = 'anonymous';
  //   audio.play().catch((e) => { console.log(e); });
  //   source.connect(destination);
  //   localStream.addTrack(destination.stream.getAudioTracks()[0]);

  //   if (type === 'video')
  //   {
  //     if (tmpStream)
  //     {
  //       localStream.addTrack(tmpStream.getVideoTracks()[0]);
  //     }
  //     else
  //     {
  //       tmpVideoStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
  //       localStream.addTrack(tmpVideoStream.getVideoTracks()[0]);
  //     }
  //   }

  //   options['mediaStream'] = localStream;
  // }
  // else if (tmpStream)
  // {
  //   options['mediaStream'] = tmpStream;
  // }
  // else
  // {
  //   options['mediaConstraints'] = {
  //     audio : true,
  //     video : type === 'video' ? videoConstraints : false
  //   };
  // }

  const calleeNo = handleGetQuery('callee');

  // 不获取设备权限检测网络;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.setAttribute('style', 'disable:none');
  const drawToCanvas =function()
  {
    canvas.width = 640;
    canvas.height = 480;
    ctx.fillStyle = 'red';
    ctx.fillRect(100, 100, 100, 100);
    window.requestAnimationFrame(drawToCanvas);
  };

  drawToCanvas();

  // const newStream = canvas.captureStream(15);
  const newStream = new MediaStream();

  const audio = new Audio('./sound/waiting.mp3');
  const audioCtx = new AudioContext();
  const destination = audioCtx.createMediaStreamDestination();
  const source = audioCtx.createMediaElementSource(audio);

  audio.loop = true;
  audio.crossOrigin = 'anonymous';
  audio.play().catch((e) => { console.log(e); });
  source.connect(destination);
  newStream.addTrack(destination.stream.getAudioTracks()[0]);

  options['mediaStream'] = newStream;


  await caller.call(`${calleeNo}@${sipDomain}`, options);
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
 * 启动初始化
 */
function callerStart()
{
  // 输出SDK版本号
  console.warn(`SDK Ver: ${CRTC.version}`);

  // 启动UA，连接信令服务器并注册
  caller.start();

  // 可以定时发起呼叫、手动发起呼叫、或者判断两个客户都注册成功后发起呼叫
  setTimeout(() =>
  {
    // 设置当前通话模式为单向视频模式
    call('video', 'sendonly');
  }, 1000);
}

callerStart();