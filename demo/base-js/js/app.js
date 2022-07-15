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
// 信令地址
const signalingUrl = 'wss://5g.vsbc.com:9002/wss';
// sip domain
const sipDomain = '5g.vsbc.com';
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
  password     : `${account}`,
  secret_key   : sessionStorage.getItem('secret_key')
};
// 媒体约束条件
const videoConstraints = {
  width     : { ideal: 640 },
  height    : { ideal: 480 },
  frameRate : 15
};

// 呼叫及接听时的turn配置
const pcConfig = {
  'iceServers' : [ 
    { 
      'urls'       : 'turn:47.103.104.206:10001', 
      'username'   : 'user', 
      'credential' : 'yl_19passw0rd' 
    } ],
  'iceTransportPolicy' : 'relay'
};

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
  setStatus(`${data.originator } ${ data.message} ${data.cause}`);
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
  console.log(data);
  setStatus(`信令连接断开: ${ data.code} ${ data.reason}`);
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
  setStatus(`注册失败${ data.cause}`);
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
  if (e.originator === 'remote')
  {
    // 远端呼入通过 request.mode 判断呼叫是音频还是视频
    setStatus(`收到${ e.request.mode==='video'?'视频':'音频' }呼叫`);
    // 通过 request.getHeader(param) 获取随路数据, param 为 call 时携带的参数命称
    setStatus(`收到 x-data: ${e.request.getHeader('x-data')}`);
  }
  
  // ***** Session 事件回调 *****
  
  // e.session.on('refer', function(d) 
  // {
  //   console.log('refer');
  //   d.accept();
  // });
  
  e.session.on('sdp', function(d) 
  {
    d.sdp = d.sdp.replace(/a=group:BUNDLE.*\r\n/, '');
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
    setStatus(`${d.originator }hold`);
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
    setStatus(`${d.originator }unhold`);
 
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
    document.querySelector('#localVideo').srcObject = d.videoStream;
     
    // 兼容不同浏览器安全策略
    setTimeout(() => 
    {
      document.querySelector('#localVideo').play();
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
 
    // 输出通话开始时间及通话结束时间
    setStatus(`start: ${ e.session.start_time}`);
    setStatus(`ended: ${ e.session.end_time}`);
 
    // 通话暂停后跨域设置本地视频媒体为空，或者切换UI为暂停通话状态
    stopStreams();
 
    // 停止获取统计信息
    stats && stats.stop();
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
    setStatus(`start: ${ e.session.start_time}`);
    setStatus(`ended: ${ e.session.end_time}`);
 
    // 通话暂停后跨域设置本地视频媒体为空，或者切换UI为暂停通话状态
    stopStreams();
 
    // 停止获取统计信息
    stats && stats.stop();
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
    setStatus(`${d.originator } DTMF:${ d.dtmf.tone}`);
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
      document.querySelector('#muteMic').innerText = '开启麦克风';
    }
    else if (d.video) 
    {
      document.querySelector('#muteCam').innerText = '开启摄像头';
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
      document.querySelector('#muteMic').innerText = '关闭麦克风';
    }
    else if (d.video) 
    {
      document.querySelector('#muteCam').innerText = '关闭摄像头';
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
  e.session.on('confirmed', function(d) 
  {  
    setStatus('confirmed');
 
    // 获取统计信息
    stats = new CRTC.getStats(e.session.connection);
    stats.on('report', function(r)
    {
      document.querySelector('#upF').innerText = `${r.upFrameWidth }X${ r.upFrameHeight}`;
      document.querySelector('#downF').innerText = `${r.downFrameWidth }X${ r.downFrameHeight}`;
      document.querySelector('#upS').innerText = r.uplinkSpeed;
      document.querySelector('#downS').innerText = r.downlinkSpeed;
      document.querySelector('#downL').innerText = r.downlinkLoss;
    });

    // 兼容部分手机初始黑屏问题
    e.session.mute({ video: true });
    setTimeout(() => 
    {
      e.session.unmute({ video: true });
    }, 500);
 
    if (d.originator === 'local' && navigator.userAgent.indexOf('iPhone') === -1)
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
    else
    {
      // 获取媒体流
      getStreams(e.session.connection);
    }
  });

  //  ***** DOM 事件绑定 *****

  /**
   * 音频接听
   */
  document.querySelector('#answer').onclick = function() 
  {
    e.session.answer({
      mediaConstraints : { audio: true, video: false },
      pcConfig         : pcConfig
    });

    setStatus('audio answer');
  };

  /**
   * 视频接听
   */
  document.querySelector('#answerVideo').onclick = function() 
  {
    e.session.answer({
      mediaConstraints : { audio: true, video: videoConstraints },
      pcConfig         : pcConfig
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
   * 结束通话
   */
  document.querySelector('#cancel').onclick = function() 
  {
    if (e.session.isEstablished())
    {
      e.session.terminate();
    }
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
   * 关闭/开启麦克风
   */
  document.querySelector('#muteMic').onclick = function() 
  {
    // 获取麦克风和视频的开关状态
    const isMuted = e.session.isMuted();

    // 麦克风为关闭状态，则开启麦克风
    if (isMuted.audio)
    {
      e.session.unmute({ audio: true });
    }
    // 麦克风为开启状态，则关闭麦克风
    else
    {
      e.session.mute({ audio: true });
    }
  };

  /**
   * 关闭/开启视频
   */
  document.querySelector('#muteCam').onclick = function() 
  {
    // 获取麦克风和视频的开关状态
    const isMuted = e.session.isMuted();

    // 摄像头为关闭状态，则开启摄像头
    if (isMuted.video) 
    {
      e.session.unmute({ video: true });
    }
    // 摄像头为开启状态，则关闭摄像头
    else 
    {
      e.session.mute({ video: true });
    }
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
    e.session.share('screen');
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

  /**
   * 分享图片
   */
  document.querySelector('#picShare').onclick = function() 
  {
    e.session.share('pic', '#pic_s');
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
        e.session.share('video', '#video_s');
      });
  };

  /**
   * 停止分享
   */
  document.querySelector('#stopShare').onclick = function() 
  {
    e.session.unShare();
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

/**
 * 发起呼叫
 * @param {string} type 呼叫类型 - audio：音频模式（默认）；video：视频模式
 */
function call(type) 
{
  if (!ua.isRegistered())
  {
    setStatus('请注册成功后呼叫');
    
    return;
  }
  
  const options = {
    // 呼叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
    extraHeaders : [ 'X-Data: dGVzdCB4LWRhdGE=' ],
    pcConfig     : pcConfig
  };

  if (type === 'video')
  {
    options['mediaConstraints'] = {
      audio : true,
      video : videoConstraints
    };
  }
  else if (navigator.userAgent.indexOf('iPhone') != -1)
  {
    options['mediaConstraints'] = {
      audio : true,
      video : false
    };
  }
  else
  {
    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();
  
    options['mediaStream'] = destination.stream;
  }
  

  const callee = document.querySelector('#callee').value;
  const session = ua.call(`${callee}@${sipDomain}`, options);

  // 默认远端无回铃音
  earlyMedia = false;

  // 播放远端的回铃音
  session.connection.ontrack = function(event)
  {    
    // 收到远端媒体则设置远端回铃音
    earlyMedia = true;

    document.querySelector('#remoteVideo').srcObject = event.streams[0];
    
    /**
     * 兼容chrome
     * https://developer.chrome.com/blog/play-request-was-interrupted/#error
     * https://bugs.chromium.org/p/chromium/issues/detail?id=718647
     */
    document.querySelector('#remoteVideo').play()
      .catch(() => {});
  };

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
  // 本地视频
  const localStream = CRTC.Utils.getStreams(pc, 'local');
  // 远端音频
  const audio = new Audio();
  // 远端视频
  const remoteStream = CRTC.Utils.getStreams(pc, 'remote');

  // 本地视频
  document.querySelector('#localVideo').srcObject = localStream.videoStream;
  // 远端音频
  audio.srcObject = remoteStream.audioStream;
  // 远端视频
  document.querySelector('#remoteVideo').srcObject = remoteStream.videoStream;

  /**
   * 兼容chrome
   * https://developer.chrome.com/blog/play-request-was-interrupted/#error
   * https://bugs.chromium.org/p/chromium/issues/detail?id=718647
   */
  Promise.all([ document.querySelector('#localVideo').play(), audio.play(), document.querySelector('#remoteVideo').play() ])
    .then(() => {})
    .catch(() => {});
}

function stopStreams()
{
  // 停止媒体流，这里可以切换页面UI
  document.querySelector('#remoteVideo').srcObject = null;
  document.querySelector('#localVideo').srcObject = null;
  tmpAudioStream && tmpAudioStream.getTracks().forEach((track) => 
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
   
  statusDom.innerText = `${statusDom.innerText}${ text}\r\n`;
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