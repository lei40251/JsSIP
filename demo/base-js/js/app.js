/* eslint-disable no-console */
/* eslint-disable no-undef */

// 调试信息输出
CRTC.debug.enable('CRTC:*');
// 关闭调试信息输出
CRTC.debug.disable('CRTC:*');

// 通话统计
let stats;
// 是否存在远端回铃音
let earlyMedia = false;
let tmpAudioStream;
let tmpVideoStream;
// 断线重连
let rtcSession;
let needReinvite = false;
let optionsTimer;
// 呼叫转移 被转用
let tmpSession;

// 兼容部分iOS手机蓝牙问题
let tmpStream;

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
  sockets        : socket,
  // 与 UA 关联的 SIP URI
  uri            : `sip:${account}@${sipDomain}`,
  // 显示名
  display_name   : account,
  // SIP身份验证密码
  password       : `yl_19${account}`,
  session_timers : false,
  secret_key     : sessionStorage.getItem('secret_key') || 'dhrrsY0tGw0VGSos+3lLLiZJK7hPe10zmSKueyNMS7Ig5PnThG0EYrLGx4mYmE2j23jAVexrZLTjZQL1ytosFN5EU1t95eyn38+t3KTZV4jSPCD2iidEXtOi6GuaB73na/5jH4wkobyOMpaZCKK5SNl2yDhaU8qbXMtnG1b0ezWd+ROcsC4WPh8O0HHk42VWhEnzXVp0k9KAn+idsO2536CZ4uIPPT244Z7aC1QPL0Y5Vj54oJrB3C54wbkouWd9s+MDIm3BzewBnf3ogSLGIlrN85Y7U5PnBERpeb0JXKi8pGGY40fS3EUJxi7zRPRrdGuzrAMgFiOBRTfqz+sWuQ=='
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
        'credential' : 'yl_19c555u'
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

  e.session.on('refer', function(d)
  {
    console.log('refer');
    d.accept();
  });

  // e.session.on('accepted', function(d)
  // {
  //   remoteUA = d.response.getHeader('x-ua');
  // });

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
    setStatus(`${d.originator}hold`);
    // 通话暂停后跨域设置本地视频媒体为空，或者切换UI为暂停通话状态
    stopStreams('hold');
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
    setStatus(`${d.originator}unhold`);

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
    localVideo.srcObject = d.videoStream;

    // 兼容不同浏览器安全策略
    setTimeout(() =>
    {
      localVideo.play();
    }, 100);
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
    console.warn('videoTrackState: ', d.properties, d.value);
    // if (d.properties === 'muted')
    // {
    setStatus(`videoTrackState ${d.properties} ${d.value}`);
    // }
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
        mediaConstraints    : { audio: true, video: true },
        pcConfig            : pcConfig
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
      console.warn('callee: ');
      console.table(ev);

      const { uplinkNetworkQuality, RTT, uplinkLoss, downlinkNetworkQuality, downlinkLoss } = ev;

      document.querySelector('#NQ').innerText =`Rtt: ${RTT} ## uQ: ${uplinkNetworkQuality} uL: ${uplinkLoss} ## dQ: ${downlinkNetworkQuality} dL: ${downlinkLoss}`;
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

    // 接通后开始判断视频轨道是否异常
    pc = e.session.connection;
    checkVideoTrackMuted();

  });

  // **** 切后台替换视频轨道 ****
  let pc;
  let drawing;
  let canvas;
  let ctx;

  // 将临时的 canvas 视频恢复为摄像头 videoTrack
  function replaceCanvasToVideo()
  {
    // 获取摄像头流，成功后替换canvas视频，失败后重新获取摄像头流替换
    navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints })
      .then((stream) =>
      {
        pc.getSenders().forEach((sender) =>
        {
          if (sender.track.kind == 'video')
          {
            window.cancelAnimationFrame(drawing);
            ctx.clearRect(0, 0, 640, 480);
            // 替换视频轨道
            sender.replaceTrack(stream.getVideoTracks()[0]);
            // 本地播放本地视频轨道
            localVideo.srcObject = stream;
            stream.getVideoTracks()[0].addEventListener('mute', replaceVideoToCanvas);
            stream.getVideoTracks()[0].addEventListener('ended', replaceVideoToCanvas);
          }
        });
      })
      .catch((ev) =>
      {
        console.log('ev: ', ev);
        replaceCanvasToVideo();
      });
  }

  // 先将原来 videoTrack 替换为 canvas 视频，并关闭原来 videoTrack
  function replaceVideoToCanvas()
  {
    // 判断是否在通话中
    if (!e.session.isEstablished())
    {
      return;
    }
    this.removeEventListener('mute', replaceVideoToCanvas);
    this.removeEventListener('ended', replaceVideoToCanvas);

    canvas = document.createElement('canvas');
    canvas.setAttribute('style', 'disable:none');
    ctx = canvas.getContext('2d');

    const drawToCanvas =function()
    {
      canvas.width = 640;
      canvas.height = 480;
      ctx.fillStyle = 'green';
      ctx.fillRect(0, 0, 640, 480);
      drawing = window.requestAnimationFrame(drawToCanvas);
    };

    drawToCanvas();

    const newStream = canvas.captureStream(15);

    pc.getSenders().forEach((sender) =>
    {
      if (sender.track&&sender.track.kind == 'video')
      {
        // 释放摄像头
        sender.track.stop();
        // 替换视频轨道
        sender.replaceTrack(newStream.getVideoTracks()[0]);
        // 本地播放本地视频轨道
        localVideo.srcObject = newStream;
        // 开始尝试获取摄像头媒体并恢复
        replaceCanvasToVideo();
      }
    });
  }

  // 检查视频轨道是否异常并处理
  function checkVideoTrackMuted()
  {
    // 先判断现在PC里面是否是 muted 正常视频
    pc.getSenders().forEach((sender) =>
    {
      if (sender.track.kind == 'video')
      {
        if (sender.track.muted)
        {
          replaceVideoToCanvas.call(sender.track, pc);
        }
        else
        {
          // iOS Safari 按 HOME 切后台，会触发两次 mute 和 unmute
          // mute 事件触发替换视频流为临时视频，并释放摄像头
          sender.track.addEventListener('mute', replaceVideoToCanvas);
          sender.track.addEventListener('ended', replaceVideoToCanvas);
        }
      }
    });
  }


  //  ***** DOM 事件绑定 *****

  /**
   * 音频接听
   */
  document.querySelector('#answer').onclick = function()
  {
    e.session.answer({
      mediaConstraints    : { audio: true, video: false },
      pcConfig            : pcConfig,
      // 被叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
      extraHeaders        : [ 'X-Data: dGVzdCB4LWRhdGE=', `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: false }
    });

    setStatus('audio answer');
  };

  /**
   * 视频接听
   */
  document.querySelector('#answerVideo').onclick = function()
  {
    e.session.answer({
      mediaConstraints    : { audio: true, video: videoConstraints },
      pcConfig            : pcConfig,
      // 被叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
      extraHeaders        : [ 'X-Data: dGVzdCB4LWRhdGE=', `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true }
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
    e.session.demoteToAudio();
  };

  /**
   * 切换为视频模式
   *
   * 切换会触发 session 的 mode 事件回调
   */
  document.querySelector('#toVideo').onclick = function()
  {
    e.session.upgradeToVideo();
    stats && stats.reset();
  };

  /**
   * 切换摄像头
   *
   * 切换摄像头成功会触发 session 的 cameraChanged 事件回调
   */
  document.querySelector('#cameras').onchange = function()
  {
    e.session.switchDevice('camera', this.options[this.selectedIndex].value);
    setStatus(`switchDevice${this.options[this.selectedIndex].innerText}`);
  };

  /**
   * 手机端用切换摄像头
   */
  document.querySelector('#switchDevice').onclick = function()
  {
    e.session.switchDevice('camera');
    setStatus('switchDevice facingMode');
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

  // /**
  //  * 关闭/开启视频
  //  */
  // document.querySelector('#muteCam').onclick = function()
  // {
  //   // 获取麦克风和视频的开关状态
  //   const isMuted = e.session.isMuted();

  //   // 摄像头为关闭状态，则开启摄像头
  //   if (isMuted.video)
  //   {
  //     e.session.unmute({ video: true });
  //   }
  //   // 摄像头为开启状态，则关闭摄像头
  //   else
  //   {
  //     e.session.mute({ video: true });
  //   }
  // };

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
    e.session.share('screen', null, null,);
  };
  document.querySelector('#screenShareD').onclick = function()
  {
    e.session.share('screen', null, null, true);
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
    const options = { 'transportType': 'RFC2833' };

    e.session.sendDTMF(d.target.innerText, options);
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

// 部分场景视频卡死需要重新播放
document.querySelector('.resume').onclick = function()
{
  document.querySelectorAll('video').forEach((video) => video.play().catch());
};

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
    tmpStream = await navigator.mediaDevices.getUserMedia({ audio : {
      echoCancellation : {
        exact                     : true,
        echoCancellationThreshold : -80 // 调整阈值为-40dB
      }
    },
    video : videoConstraints });
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
    options['rtcOfferConstraints'] ={ offerToReceiveAudio: true, offerToReceiveVideo: false };
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

    // 兼容自动播放bug的
    // const source = audioCtx.createBufferSource();

    // await fetch('./sound/waiting.mp3').then((res) => res.arrayBuffer())
    //   .then((res) => { return audioCtx.decodeAudioData(res); })
    //   .then((res) =>
    //   {
    //     source.buffer=res;
    //     source.loop = true;
    //     source.connect(destination);
    //     source.start();
    //   });

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
      audio : {
        echoCancellation : {
          exact                     : true,
          echoCancellationThreshold : -40 // 调整阈值为-40dB
        }
      },
      video : type === 'video' ? videoConstraints : false
    };
  }

  console.warn(options);
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

  setTimeout(() =>
  {
    if (!ua.isConnected() || !ua.isRegistered())
    {
      ua.stop();
      console.log('网络连接异常或未注册成功');
    }
  }, 10000);

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