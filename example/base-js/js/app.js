/* eslint-disable no-console */
/* eslint-disable no-undef */
// 调试信息输出
CRTC.debug.enable('CRTC:*');
// 关闭调试信息输出
CRTC.debug.disable('CRTC:*');

// 当前通话模式： audio 或者 video
let currMode;
// 暂停前的通话模式
let holdMode;
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
  sockets  : socket,
  // 与 UA 关联的 SIP URI
  uri      : `sip:${account}@${sipDomain}`,
  // SIP身份验证密码
  password : `yl_19${account}`
};
// 媒体约束条件
const videoConstraints = {
  width     : { ideal: 640 },
  height    : { ideal: 480 },
  frameRate : 15
};

// UA 实例
const ua = new CRTC.UA(configuration);

// 新通话（呼入或呼出）
ua.on('newRTCSession', function(e)
{
  /**
   * DOM 事件绑定
   */

  // 切换摄像头
  document.querySelector('#cameras').onchange = function() 
  {
    e.session.switchDevice('camera', this.options[this.selectedIndex].value);
    setStatus(`switchDevice${this.options[this.selectedIndex].innerText}`);
  };

  // 音频接听
  document.querySelector('#answer').onclick = function() 
  {
    e.session.answer({
      mediaConstraints : { audio: true, video: false }
    });
    setStatus('audio answer');
  };

  // 视频接听
  document.querySelector('#answerVideo').onclick = function() 
  {
    e.session.answer({
      mediaConstraints : { audio: true, video: videoConstraints }
    });
    setStatus('video answer');
  };

  // 切换为音频模式
  document.querySelector('#toAudio').onclick = function() 
  {
    e.session.demoteToAudio();
  };

  // 切换为视频模式
  document.querySelector('#toVideo').onclick = function() 
  {
    e.session.upgradeToVideo();
  };

  // 挂机
  document.querySelector('#cancel').onclick = function() 
  {
    e.session.terminate();
  };

  // 呼转
  document.querySelector('#referBtn').onclick = function() 
  {
    const eventHandlers = {
      'progress' : function(data) { console.log('progress', data); },
      'failed'   : function(data) 
      {
        console.log('failed', data);
        if (e.session.isOnHold().local) 
        {
          e.session.unhold();
        }
      },
      'accepted'         : function(data) { console.log('accept', data); e.session.terminate(); },
      'trying'           : function(data) { console.log('trying', data); },
      'requestSucceeded' : function(data) { console.log('requestSucceeded', data); },
      'requestFailed'    : function(data) 
      {
        console.log('requestFailed', data);
        if (e.session.isOnHold().local) 
        {
          e.session.unhold();
        }
      }
    };
    
    e.session.hold();

    e.session.refer(`${document.querySelector('#refer').value}@${sipDomain}`, {
      eventHandlers : eventHandlers
    });
  };

  // 静麦/取消静麦
  document.querySelector('#muteMic').onclick = function() 
  {
    // 获取麦克风状态
    if (e.session.isMuted().audio) 
    {
      // 开启麦克风
      e.session.unmute({ audio: true });
    }
    else 
    {
      // 关闭麦克风
      e.session.mute({ audio: true });
    }
  };

  // 关闭/开启视频
  document.querySelector('#muteCam').onclick = function() 
  {
    // 获取视频状态
    if (e.session.isMuted().video) 
    {
      // 开启摄像头
      e.session.unmute({ video: true });
    }
    else 
    {
      // 关闭摄像头
      e.session.mute({ video: true });
    }
  };

  // 保持/取消保持
  document.querySelector('#hold').onclick = function() 
  {
    // 获取保持状态
    const isHold = e.session.isOnHold();

    // 本地和远端都未保持才可以保持
    if (isHold.local) 
    {
      e.session.unhold();
    }
    else if (!isHold.remote)
    {
      e.session.hold();
    }
  };

  // 分享屏幕
  document.querySelector('#screenShare').onclick = function() 
  {
    e.session.share('screen');
  };

  // 分享页面元素
  document.querySelector('#formShare').onclick = function() 
  {
    e.session.share('html', '#ele', html2canvas);
  };

  // 分享图片
  document.querySelector('#picShare').onclick = function() 
  {
    e.session.share('pic', '#pic_s');
  };

  // 分享视频
  document.querySelector('#videoShare').onclick = function() 
  {
    // 分享视频需要视频在播放状态
    document.querySelector('#video_s').play()
      .then(() => 
      {
        e.session.share('video', '#video_s');
      });
  };

  // 停止分享
  document.querySelector('#stopShare').onclick = function() 
  {
    e.session.unShare();
  };

  // 通话种推送消息
  document.querySelector('#sendInfo').onclick = function() 
  {
    // 注意： contentType 必填
    e.session.sendInfo('text/plain', document.querySelector('#info').value);
  };

  /**
   * session event
   */
  // 收到呼转事件
  e.session.on('refer', function(d) 
  {
    console.log('refer');
    d.accept();
  });

  // 保持通话事件
  e.session.on('hold', function() 
  {
    // 本地视频
    document.querySelector('#localVideo').srcObject = new MediaStream();
    // 远端视频
    document.querySelector('#remoteVideo').srcObject = new MediaStream();
  });

  // 取消保持通话事件
  e.session.on('unhold', function() 
  {
    // 本地视频
    let localVideoStream = new MediaStream();

    if (RTCPeerConnection.prototype.getSenders) 
    {
      e.session.connection.getSenders().forEach((sender) => 
      {

        if (sender.track && sender.track.kind === 'video' && sender.track.readyState === 'live') 
        {
          localVideoStream.addTrack(sender.track);
        }

      });
    }
    else 
    {
      localVideoStream = e.session.connection.getLocalStreams()[0];
    }

    document.querySelector('#localVideo').srcObject = localVideoStream;

    setTimeout(() => 
    {
      document.querySelector('#localVideo').play();
    }, 100);

    // 远端视频
    let remoteVideoStream = new MediaStream();

    if (RTCPeerConnection.prototype.getReceivers) 
    {
      e.session.connection.getReceivers().forEach((receiver) => 
      {

        if (receiver.track && receiver.track.readyState === 'live') 
        {
          if (receiver.track.kind === 'video') 
          {
            remoteVideoStream.addTrack(receiver.track);
          }
          else 
          {
            remoteVideoStream.addTrack(receiver.track);
          }
        }

      });
    }
    else 
    {
      remoteVideoStream = e.session.connection.getRemoteStreams()[0];
    }
    document.querySelector('#remoteVideo').srcObject = remoteVideoStream;

    setTimeout(() => 
    {
      document.querySelector('#remoteVideo').play();
    }, 100);
  });

  // 通话模式切换事件
  e.session.on('mode', function(d) 
  {
    console.log('mode: ', d);

    currMode = d.mode;

    // document.querySelector('#video_area').classList = '';
    // 本地视频
    let localVideoStream = new MediaStream();

    if (RTCPeerConnection.prototype.getSenders) 
    {
      e.session.connection.getSenders().forEach((sender) => 
      {

        if (sender.track && sender.track.kind === 'video' && sender.track.readyState === 'live' && d.mode !== 'audio') 
        {
          localVideoStream.addTrack(sender.track);
        }

      });
    }
    else 
    {
      localVideoStream = e.session.connection.getLocalStreams()[0];
    }

    document.querySelector('#localVideo').srcObject = localVideoStream;

    setTimeout(() => 
    {
      document.querySelector('#localVideo').play();
    }, 100);

    // 远端视频
    let remoteVideoStream = new MediaStream();

    if (RTCPeerConnection.prototype.getReceivers) 
    {
      e.session.connection.getReceivers().forEach((receiver) => 
      {

        if (receiver.track && receiver.track.readyState === 'live') 
        {
          if (receiver.track.kind === 'video') 
          {
            if (d.mode !== 'audio') 
            {
              remoteVideoStream.addTrack(receiver.track);
            }
          }
          else 
          {
            remoteVideoStream.addTrack(receiver.track);
          }
        }

      });
    }
    else 
    {
      remoteVideoStream = e.session.connection.getRemoteStreams()[0];
    }
    document.querySelector('#remoteVideo').srcObject = remoteVideoStream;

    setTimeout(() => 
    {
      document.querySelector('#remoteVideo').play();
    }, 100);
  });

  // 呼入振铃 & 呼出回铃音
  e.session.on('progress', function(d) 
  {
    if (d.originator === 'local') 
    {
      setStatus('收到呼叫，振铃中');
    }
    else 
    {
      setStatus('对方已振铃，收到回铃音');
    }
  });

  // 切换摄像头事件
  e.session.on('cameraChanged', function(d) 
  {
    document.querySelector('#localVideo').srcObject = d;
    
    setTimeout(() => 
    {
      document.querySelector('#localVideo').play();
    }, 100);
  });

  // 呼叫失败处理
  e.session.on('failed', function(d) 
  {
    setStatus(`呼叫失败: ${d.cause}`);
  });

  // 呼叫结束
  e.session.on('ended', function() 
  {
    setStatus('呼叫结束');
  });

  // 呼叫已确认
  e.session.on('confirmed', function() 
  {
    // 本地视频
    let localVideoStream = new MediaStream();

    if (RTCPeerConnection.prototype.getSenders) 
    {
      e.session.connection.getSenders().forEach((sender) => 
      {
        if (
          sender.track &&
          sender.track.kind === 'video' &&
          sender.track.readyState === 'live'
        ) 
        {
          localVideoStream.addTrack(sender.track);
        }
      });
    }
    else 
    {
      localVideoStream = e.session.connection.getLocalStreams()[0];
    }

    document.querySelector('#localVideo').srcObject = localVideoStream;
    // document.querySelector('#localVideo').addEventListener('loadedmetadata', (event) => {
    document.querySelector('#localVideo').play();
    // })

    // 远端视频
    let remoteVideoStream = new MediaStream();
    const remoteAudioStream = new MediaStream();

    if (RTCPeerConnection.prototype.getReceivers) 
    {
      e.session.connection.getReceivers().forEach((receiver) => 
      {
        if (receiver.track && receiver.track.readyState === 'live') 
        {
          if (receiver.track.kind === 'audio') 
          {
            remoteAudioStream.addTrack(receiver.track);
          }
          else 
          {
            remoteVideoStream.addTrack(receiver.track);
          }
        }
      });
    }
    else 
    {
      remoteVideoStream = e.session.connection.getRemoteStreams()[0];
    }
    const audio = new Audio();

    audio.srcObject = remoteAudioStream;

    // audio.addEventListener('loadedmetadata', (event) => {
    audio.play();
    // })


    document.querySelector('#remoteVideo').srcObject = remoteVideoStream;
    // document.querySelector('#remoteVideo').addEventListener('loadedmetadata', (event) => {
    document.querySelector('#remoteVideo').play();
    // })

  });

  // 收到新消息
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

  // 取消bundle
  e.session.on('sdp', function(d) 
  {
    d.sdp = d.sdp.replace(/a=group:BUNDLE.*\r\n/, '');
  });

  // 摄像头、麦克风已关闭
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

  // 摄像头、麦克风已开启
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
});

// ua events
// 注册成功
ua.on('registered', function() 
{
  setStatus(`注册成功：${account}`);
});

// 注册失败
ua.on('failed', function(d) 
{
  console.log(d);
});

// 发起音频呼叫
document.querySelector('#call').onclick = function() 
{
  // 设置当前通话模式为音频模式
  currMode = 'audio';
  call();
};

// 发起视频呼叫
document.querySelector('#callVideo').onclick = function() 
{
  // 设置当前通话模式为视频模式
  currMode = 'video';
  call('video');
};

/**
 * 发起呼叫
 * @param {string} type 呼叫类型 - audio：音频模式（默认）；video：视频模式
 */
function call(type) 
{
  const mediaConstraints = {
    audio : true,
    video : false
  };

  if (type === 'video') 
  {
    mediaConstraints.video = videoConstraints;
  }

  const callee = document.querySelector('#callee').value;
  const session = ua.call(`${callee}@${sipDomain}`, {
    mediaConstraints
  });

  // session.connection.ontrack = function() 
  // {
  // 远端视频
  // const remoteVideoStream = new MediaStream();

  // if (receiver.track && receiver.track.readyState === 'live')
  // {
  //   remoteVideoStream.addTrack(receiver.track);
  // }

  // 本地视频
  // let localVideoStream = new MediaStream();

  // if (RTCPeerConnection.prototype.getSenders) 
  // {
  //   session.connection.getSenders().forEach((sender) => 
  //   {
  //     if (
  //       sender.track &&
  //       sender.track.kind === 'video' &&
  //       sender.track.readyState === 'live'
  //     ) 
  //     {
  //       localVideoStream.addTrack(sender.track);
  //     }
  //   });
  // }
  // else 
  // {
  //   localVideoStream = session.connection.getLocalStreams()[0];
  // }

  // document.querySelector('#localVideo').srcObject = localVideoStream;

  // setTimeout(() => 
  // {
  //   document.querySelector('#localVideo').play();
  // }, 100);

  // localVideoStream.getVideoTracks().forEach((track) =>
  // {
  //   track.addEventListener('ended', () =>
  //   {
  //     console.log('这里可以切换为音频界面');
  //   });
  // });


  // document.querySelector('#remoteVideo').srcObject = event.streams[0];
  // };

  // 外呼取消呼叫
  document.querySelector('#cancel').onclick = function() 
  {
    session.terminate();
  };
}

// 对远端媒体截图
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

// 页面刷新 终止会话，注销ua
window.onbeforeunload = function() 
{
  ua.stop();
};

// 监听系统输入设备变化更新摄像头列表
navigator.mediaDevices.addEventListener('devicechange', () => 
{
  updateDevices();
});

// 启动
function start()
{
  updateDevices();

  // 启动UA，连接信令服务器并注册
  ua.start();
}

start();