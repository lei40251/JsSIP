/* eslint-disable no-console */
/* eslint-disable no-undef */

// 调试信息输出
CRTC.debug.enable('CRTC:*');
CRTC.debug.disable('CRTC:*');

// 通话统计
let callerStats;

let tmpSession;

// 通话统计
let tmpVideoStream;

// 兼容部分iOS手机蓝牙问题
let tmpStream;

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
caller.on('disconnected', function(data)
{
  setStatus(`信令连接断开: ${data.code} ${data.reason}`);
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
caller.on('registered', function(data)
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
caller.on('registrationFailed', function(data)
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
caller.on('newRTCSession', function(e)
{
  console.log('nsession: ', e);

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
    setStatus('通话结束');

    if (tmpStream)
    {
      tmpStream.getTracks().forEach((track) => track.stop());
      tmpStream = null;
    }

    // 输出通话开始时间及通话结束时间
    setStatus(`start: ${e.session.start_time}`);
    setStatus(`ended: ${e.session.end_time}`);

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
    setStatus('confirmed');

    const mics = await CRTC.Utils.getMicrophones();
    // 获取统计信息

    callerStats = new CRTC.getStats(e.session.connection);
    callerStats.on('report', function(r)
    {
      console.table(r);
      document.querySelector('#upF').innerText = `${r.upFrameWidth || ''} ${r.upFrameHeight || ''}`;
      document.querySelector('#downF').innerText = `${r.downFrameWidth || ''} ${r.downFrameHeight || ''}`;
      document.querySelector('#upS').innerText = r.uplinkSpeed || '';
      document.querySelector('#downS').innerText = r.downlinkSpeed || '';
      document.querySelector('#downL').innerText = r.downlinkLoss || '';
    });

    callerStats.on('network-quality', function(ev)
    {
      // console.warn('caller: ');
      // console.table(ev);

      const { uplinkNetworkQuality, RTT, uplinkLoss, downlinkNetworkQuality, downlinkLoss } = ev;

      document.querySelector('#uNQ').innerText =`Rtt: ${RTT} ## uQ: ${uplinkNetworkQuality} uL: ${uplinkLoss} ## dQ: ${downlinkNetworkQuality} dL: ${downlinkLoss}`;

      testResult.uplinkNetworkQualities.push(ev.uplinkNetworkQuality);
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
   * 结束通话
   */
  document.querySelector('#cancel').onclick = function()
  {
    e.session.terminate();

    try
    {
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
  if (!caller.isRegistered())
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

  const callee = document.querySelector('#callee').value;
  const session = await caller.call(`${callee}@${sipDomain}`, options);

  // 外呼未触发newRTCSession前取消呼叫
  document.querySelector('#cancel').onclick = function()
  {
    session.terminate();
  };
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
 * 启动初始化
 */
function callerStart()
{
  // 输出SDK版本号
  setStatus(`SDK Ver: ${CRTC.version}`);

  // 启动UA，连接信令服务器并注册
  caller.start();

  // 发起视频呼叫
  document.querySelector('#callVideoSendonly').onclick = function()
  {
    // 设置当前通话模式为单向视频模式
    call('video', 'sendonly');
  };
}

callerStart();