/* eslint-disable max-len */
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
// 断线重连
let rtcSession;
let optionsTimer;
// 呼叫转移 被转用
let tmpSession;
let safari_r = false;

const extraFeatures = [];

// let payload;

// 远端客户端UA
// let remoteUA;

const localVideo = document.querySelector('#localVideo');
const remoteVideo = document.querySelector('#remoteVideo');
const remoteAudio = document.querySelector('#remoteAudio');

let cusMediaStream = new MediaStream();

const env = handleGetQuery('env');
const { signalingUrl, sipDomain, secretKey, iceServers, iceTransportPolicy } = env ? envs[`env_${env}`] : envs['env_default'];
const exts = handleGetQuery('ext') ? handleGetQuery('ext').split() : null;

exts && exts.forEach((ext) => extraFeatures.push(ext));

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
  secret_key     : secretKey
};
// 媒体约束条件
const videoConstraints = {
  width     : 640,
  height    : 480,
  frameRate : 15
};

// RTCPeerConnection 的 RTCConfiguration 对象
const pcConfig = {};

iceServers && (pcConfig['iceServers'] = iceServers);
iceTransportPolicy && (pcConfig['iceTransportPolicy'] = iceTransportPolicy);
pcConfig['iceCandidatePoolSize'] = 10;

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
  setStatus(`信令连接断开: ${data.code} ${data.reason}`);
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
    console.log('refer', d);
    d.request.refer_to.uri.host = sipDomain;
    d.accept(null, {
      // 呼叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
      extraHeaders  : [ 'X-Data: dGVzdCB4LWRhdGE=', `X-UA: ${navigator.userAgent}`, 'Custom: C00071694431-TEST47518-P120100016079316-176049668', 'RecordID: E1647E83-7729-48F7-AF58-951CC86CFF16', 'SessName: -' ],
      // cMode        : 'paphone',
      extraFeatures : extraFeatures,
      pcConfig      : pcConfig
    });
  });

  // 部分场景兼容使用
  e.session.on('sdp', function(d)
  {
    // 呼叫VoLTE手机号需要
    // d.sdp = d.sdp.replace(/a=rtcp-fb:\d* goog-remb\r\n/g, '');
    // d.sdp = d.sdp.replace(/a=rtcp-fb:\d* transport-cc\r\n/g, '');

    if (d.originator === 'local')
    {
      // 保存浏览器默认payload，适配pa
      // const payloadRegex = /profile-level-id=([a-zA-Z0-9]{6})/;
      // payload || (payload = d.sdp.match(payloadRegex)[1]);
      // const newPayloadRegex = new RegExp(payload, 'g');
      // // 将sdp的默认payload改为420D0D
      // d.sdp = d.sdp.replace(newPayloadRegex, '420D0D');
      // d.sdp = d.sdp.replace(/packetization-mode=0/, 'packetization-mode=1');
      d.sdp = d.sdp.replace(/profile-level-id=([a-zA-Z0-9]{6})/g, 'profile-level-id=428028');
      d.sdp = d.sdp.replace(/(m=video .*\r\n)/g, '$1b=AS:2048\r\n');
    }
    else if (d.originator === 'remote')
    {
      // 适配pa
      // d.sdp = d.sdp.replace(/profile-level-id=420D0D;.*packetization-mode=1;/g, `level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=${payload}`);
      // d.sdp = d.sdp.replace(/420D0D/g, payload);

      // 端到端用
      // d.sdp = d.sdp.replace('a=floorctrl:s-only\r\n', 'a=floorctrl:s-only\r\na=floorid:2 mstrm:12\r\na=confid:123\r\na=userid:456\r\n');
      // d.sdp = d.sdp.replace('a=floorctrl:c-only\r\n', 'a=floorctrl:s-only\r\na=floorid:2 m-stream:3\r\n');

      d.sdp = d.sdp.replace(/SAVPF 106\r\n/g, 'SAVPF 126\r\n');
      d.sdp = d.sdp.replace(/a=rtpmap:106/g, 'a=rtpmap:126');
      d.sdp = d.sdp.replace(/a=fmtp:106/g, 'a=fmtp:126');

      // m=video 20080 UDP/TLS/RTP/SAVPF 106
      // b=TIAS:512000
      // a=rtpmap:106 H264/90000
      // a=fmtp:106 profile-level-id=42801F;max-br=512;packetization-mode=1
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

    if (d.mode == 'video')
    {
      // 兼容部分手机初始黑屏问题
      setTimeout(() =>
      {
        e.session.mute({ video: true });
        setTimeout(() =>
        {
          e.session.unmute({ video: true });
        }, 300);
      }, 1000);
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
    localVideo.srcObject = d.videoStream;

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
    // document.querySelector('#remoteVideo2').srcObject = CRTC.Utils.getStreams(e.session.connection, 'shared').videoStream;
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
    console.warn('iceConnectionState: ', d);
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
    setStatus('通话结束');

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
        pcConfig : pcConfig
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
  e.session.on('confirmed', async function()
  {
    setStatus('confirmed');

    // if (e.session === tmpSession)
    // {
    //   rtcSession.terminate();
    // }

    // 获取统计信息
    stats = new CRTC.getStats(e.session.connection);

    stats.on('report', function(r)
    {
      let downF = '';
      let upF = '';

      console.warn('report: ', r);
      r.downStreams.forEach((item) =>
      {
        downF += `## ${item.type || 'video'}: ${item.frameWidth || ''} * ${item.frameHeight || ''} ${item.framesPerSecond || ''}fps ${item.speed || ''} `;
      });

      r.upStreams.forEach((item) =>
      {
        upF += `## ${item.type || 'video'}: ${item.frameWidth || ''} * ${item.frameHeight || ''} ${item.framesPerSecond || ''}fps ${item.speed || ''} `;
      });

      document.querySelector('#upF').innerText = upF;
      document.querySelector('#downF').innerText = downF;

      document.querySelector('#upS').innerText = r.uplinkSpeed || '';
      document.querySelector('#downS').innerText = r.downlinkSpeed || '';
      document.querySelector('#upL').innerText = r.uplinkLoss || '';
      document.querySelector('#downL').innerText = r.downlinkLoss || '';
    });

    stats.on('network-quality', function(ev)
    {
      const { uplinkNetworkQuality, RTT, uplinkLoss, downlinkNetworkQuality, downlinkLoss } = ev;

      document.querySelector('#NQ').innerText = `Rtt: ${RTT} ## uQ: ${uplinkNetworkQuality} uL: ${uplinkLoss} ## dQ: ${downlinkNetworkQuality} dL: ${downlinkLoss}`;
    });

    // if (d.originator === 'local')
    // {
    //   // 兼容部分手机初始黑屏问题
    //   setTimeout(() =>
    //   {
    //     e.session.mute({ video: true });
    //     setTimeout(() =>
    //     {
    //       e.session.unmute({ video: true });
    //     }, 300);
    //   }, 1000);
    // }

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
  });

  //  ***** DOM 事件绑定 *****

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
      pcConfig            : pcConfig,
      // 被叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
      extraHeaders        : [ 'X-Data: dGVzdCB4LWRhdGE=', `X-UA: ${navigator.userAgent}` ],
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
        audio :
        {
          sampleRate   : 48000,
          channelCount : 1
        },
        video : videoConstraints
      },
      pcConfig            : pcConfig,
      // 被叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
      extraHeaders        : [ 'X-Data: dGVzdCB4LWRhdGE=', `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures       : extraFeatures
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

        document.querySelector('#remoteVideo2').srcObject = null;
        document.querySelector('#remoteVideo2').classList = 'mh-100 mw-100 hide';
      })
      .catch((error) =>
      {
        // if (error.message && error.message.indexOf('user gesture handler') !== -1)
        // if (error.message && error.message.indexOf('user gesture handler') !== -1)
        // {
        safari_r = true;
        setStatus('请在浏览器中点击 "Safari分享" 按钮触发屏幕分享');
        // }

        console.warn('error: ', error);
        setStatus(error.message);
        // e.session.sendFloorStatus(6);
      });
  };

  document.querySelector('#screenShareD_iOS').onclick = function()
  {
    console.warn('aaaaaaaaaa', safari_r);
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

  rtcSession && rtcSession.terminate();

  const options = {
    // 呼叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
    extraHeaders  : [ 'X-Data: dGVzdCB4LWRhdGE=', `X-UA: ${navigator.userAgent}`, 'Custom: C00071694431-TEST47518-P120100016079316-176049668', 'RecordID: E1647E83-7729-48F7-AF58-951CC86CFF16', 'SessName: -' ],
    // cMode        : 'paphone',
    extraFeatures : extraFeatures,
    pcConfig      : pcConfig
  };

  if (direction == 'sendonly')
  {
    options['rtcOfferConstraints'] = { offerToReceiveAudio: true, offerToReceiveVideo: false };
  }

  options['mediaConstraints'] = {
    audio :
    {
      sampleRate   : 48000,
      channelCount : 1
    },
    video : type === 'video' ? videoConstraints : false
  };

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

  if (navigator.userAgent.indexOf('ArkWeb') != -1)
  {
    const tmpVideo = await navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints || false });

    tmpVideo.addTrack(generateAnEmptyAudioTrack());
    options['mediaStream'] = tmpVideo;

  }

  if (type === 'callnull')
  {
    const tmpStream = new MediaStream();

    const emptyTrack = await CRTC.Utils.generateAnEmptyAudioTrack();

    // 自动呼叫会有异常
    if (emptyTrack.state === 'suspended')
    {
      // await emptyTrack.audioContext.resume();
      // 创建一个临时按钮
      const resumeButton = document.createElement('button');

      resumeButton.innerText = '点击开启音频';
      resumeButton.style.position = 'fixed';
      resumeButton.style.top = '50%';
      resumeButton.style.left = '50%';
      resumeButton.style.transform = 'translate(-50%, -50%)';
      resumeButton.style.zIndex = '9999';
      resumeButton.style.padding = '10px 20px';

      document.body.appendChild(resumeButton);

      // 等待用户点击
      await new Promise((resolve) =>
      {
        resumeButton.onclick = async() =>
        {
          await emptyTrack.audioContext.resume();
          document.body.removeChild(resumeButton);
          resolve();
        };
      });
    }

    console.warn('emptyTrack: ', emptyTrack);

    tmpStream.addTrack(emptyTrack.audioTrack, tmpStream);
    tmpStream.addTrack(CRTC.Utils.generateAnEmptyVideoTrack().videoTrack, tmpStream);

    options['mediaStream'] = tmpStream;
  }

  const callee = document.querySelector('#callee').value;

  console.log('op: ', options);
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
  };
}

start();

// 测试用
function addNewTrack(type)
{
  const vtrack = new MediaStreamTrackGenerator({ kind: type });

  rtcSession.connection.addTrack(vtrack);

  rtcSession.renegotiate({ rtcOfferConstraints: { iceRestart: true } });
}

document.querySelector('#addAudio').onclick = function() { addNewTrack('audio'); };
document.querySelector('#addVideo').onclick = function() { addNewTrack('video'); };