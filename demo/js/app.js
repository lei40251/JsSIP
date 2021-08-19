/* eslint-disable no-console */
// import * as sdpTransform from 'sdp-transform';
// const sdpTransform = require('sdp-transform');

// console.log(sdpTransform);
// 调试信息输出
PRTC.debug.enable('FlyInn:*');
// 关闭调试信息输出
// PRTC.debug.disable('FlyInn:*');

// test start
// const pcRecvVideo = new RTCPeerConnection();

// pcRecvVideo.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: true })
//   .then((desc) =>
//   {
//     console.log('desc: ', sdpTransform.parse(desc.sdp));
//   });

// test end


// 控制台输出SDK版本信息
console.log(PRTC.version);

// 会话路由地址，创建&加入会议用
const callRouterUrl = 'https://pro.vsbc.com:6082';

// 客户端对象
let client = null;
// 本端媒体对象
let localStream = null;
// 远端音频流对象
let remoteAudioStream = null;

// 本端视频流禁用状态
let localVideoMuted = false;
// 本端音频流禁用状态
let localAudioMuted = false;
// 远端音频流禁用状态
let remoteAudioMuted = false;

let nPC;

// 会议结束重置参数
function resetStatus()
{
  localStream = null;
  remoteAudioStream = null;

  localVideoMuted = false;
  localAudioMuted = false;
  remoteAudioMuted = false;

  document.querySelector('#rvs').innerHTML = '';
  document.querySelector('#local_stream').srcObject = null;
}

// 渲染远端媒体
function renderRemoteStream(remoteStream)
{
  // 远端视频div容器
  const rvsEle = document.querySelector('#rvs');

  const div = document.createElement('div');
  const p = document.createElement('p');
  const btn = document.createElement('button');

  div.classList = 'remote_stream';
  div.dataset.stream_id = remoteStream.id;

  btn.classList = 'handle_remote_stream';
  btn.innerText = '关闭视频';
  btn.dataset.muted = 0;
  // 远端视频上按钮的操作
  btn.onclick = function(self)
  {
    if (self.target.dataset.muted == '1')
    {
      if (remoteStream.unmuteVideo() == '1')
      {
        self.target.innerHTML = '关闭视频';
        self.target.dataset.muted = '0';
      }
      else
      {
        console.warn('开启失败');
      }
    }
    else if (remoteStream.muteVideo())
    {
      self.target.innerHTML = '开启视频';
      self.target.dataset.muted = '1';
    }
    else
    {
      console.warn('关闭失败');
    }
  };

  p.innerText = `${remoteStream.userId}(${remoteStream.display_name})`;

  const video =document.createElement('video');
  // 安卓微信浏览器用
  const x5VideoPlayerFullscreen = document.createAttribute('x5-video-player-fullscreen');
  const x5VideoPlayerType = document.createAttribute('x5-video-player-type');

  x5VideoPlayerFullscreen.value=true;
  x5VideoPlayerType.value='h5';

  // 设置video属性
  video.setAttributeNode(x5VideoPlayerType);
  video.setAttributeNode(x5VideoPlayerFullscreen);
  video.autoplay=true;
  video.playsInline =true;

  // 媒体流
  video.srcObject = remoteStream.stream;
  video.play();
  video.onclick = function()
  {
    captureVideo(video);
  };

  // 将video等 插入页面
  div.append(video);
  div.append(p);
  div.append(btn);
  rvsEle.append(div);
}

// 离会回调，方便监听和取消监听用
function peerLeave(data)
{
  // console.log('远端用户离开会议: ', data.userId);
}

// 客户端初始化
function initSignalling()
{
  // clientConfig 配置项
  const configuration = {
    call_router_url : callRouterUrl,
    sdk_app_id      : sdkAppId,
    user_id         : userId,
    user_sig        : userSig
  };

  PRTC.Logger.setLogLevel('error');

  // 创建 client
  client = PRTC.createClient(configuration);

<<<<<<< HEAD
  client.on('pc', (pc) =>
  {
    nPC=pc;
  });
=======
  // client.uploadDebug();
>>>>>>> sfu-dev-loglevel

  // 信令连接成功建立
  client.on('connection-state-changed', function(data)
  {
    // console.log('connection-state-changed: ', data);
  });

  // 注册成功，在需要注册场景可用
  client.on('peer-join', function(e)
  {
    // console.log('远端用户加入: ', e.userId);
  });

  // 注册失败，在需要注册场景可用
  client.on('peer-leave', peerLeave);

  // 已添加远端流
  client.on('stream-added', function(remoteStream)
  {
    // 远端音频混流，此处单独处理远端音频
    if (remoteStream.type === 'audio')
    {
      remoteAudioStream = remoteStream;
      const audioPlayer = document.createElement('audio');

      audioPlayer.srcObject = remoteStream.stream;
      audioPlayer.play();
    }
    else
    {
      renderRemoteStream(remoteStream);
    }
  });

  // 已删除远端流
  client.on('stream-removed', function(remoteStream)
  {
    const remoteStreamDivs = document.querySelectorAll('.remote_stream');

    remoteStreamDivs.forEach(function(div)
    {
      if (div.dataset.stream_id === remoteStream.id)
      {
        div.remove();
      }
    });
  });

  // 本端加入会议
  client.on('local-joined', function(data)
  {
    document.querySelector('#join_conf').setAttribute('disabled', true);
    // console.log('您已加入会议');
    localStream = data;

    localStream.stream.oninactive= () =>
    {
      // console.log('Video stopped either because 1) it was over, ' +
      //     'or 2) no further data is available.');
    };

    if (!localStream.custom)
    {
      document.querySelector('#local_stream').srcObject = localStream.stream;
      document.querySelector('#local_stream').play();
    }
  });

  // 本端离开会议
  client.on('local-leave', function()
  {
    resetStatus();
    document.querySelector('#join_conf').removeAttribute('disabled');
    // console.log('您已离开会议');
  });

  // 客户端错误事件处理
  client.on('error', function(data)
  {
    console.log('error: ', data);
  });
}

function switchCam(deviceId)
{
  localStream.switchDevice({ deviceId: deviceId }).then((stream) =>
  {
    document.querySelector('#local_stream').srcObject=stream;
    document.querySelector('#local_stream').play();
  });
}

// 启动
function start()
{
  getTemper(initSignalling);
}

start();

// document.querySelector('#show_remote_video').onclick=function()
// {
//   const vs = new MediaStream();
//   const nc = nPC.getReceivers()[0].track;

//   // nc.onunmute = () =>
//   // {
//   // don't set srcObject again if it is already set.
//   // if (remoteView.srcObject) return;
//   // remoteView.srcObject = streams[0];
//   vs.addTrack(nc);

//   const vd = document.createElement('video');

//   vd.srcObject= vs;
//   vd.play();
//   document.querySelector('#rvs').append(vd);
//   // renderRemoteStream(vs);
//   // console.log('nc: ', nc);
//   // };
// };

// 预览本端媒体
document.querySelector('#create_stream').onclick = function()
{
  localStream = new PRTC.LocalStream({});

  localStream.on('stop', () =>
  {
    // console.log('localstream is stopped.');
  });

  localStream.initialize().then(function()
  {
    document.querySelector('#local_stream').srcObject = localStream.stream;
    document.querySelector('#local_stream').play();
  });
};

// 加入会议
document.querySelector('#join_conf').onclick =function()
{
  if (localStream)
  {
    client.join(document.querySelector('#roomId').value, document.querySelector('#display_name').value, { mediaStream: localStream.stream });
  }
  else
  {
    client.join(document.querySelector('#roomId').value, document.querySelector('#display_name').value, {
      iceTransportPolicy : 'relay',
      iceServers         : [
        {
          'urls' : [
            'turn:a.vsbc.com:6084?transport=udp'
          ],
          'username'   : 'user',
          'credential' : 'password'
        }
      ]
    });
  }
};

// 离开会议
document.querySelector('#leave').onclick =function()
{
  client.off('peer-leave', peerLeave);
  client.leave();
};

// 切换本端视频状态
document.querySelector('#handle_local_video').onclick = function(self)
{
  if (localVideoMuted)
  {
    if (localStream.unmuteVideo())
    {
      self.target.innerHTML = '禁用本端视频';
      localVideoMuted = !localVideoMuted;
    }
    else
    {
      console.warn('启用失败');
    }
  }
  else if (localStream.muteVideo())
  {
    self.target.innerHTML = '启用本端视频';
    localVideoMuted = !localVideoMuted;
  }
  else
  {
    console.warn('禁用失败');
  }
};

// 切换本端音频状态
document.querySelector('#handle_local_audio').onclick = function(self)
{
  if (localAudioMuted)
  {
    if (localStream.unmuteAudio())
    {
      self.target.innerHTML = '禁用本端音频';
      localAudioMuted = !localAudioMuted;
    }
    else
    {
      console.warn('启用失败');
    }
  }
  else if (localStream.muteAudio())
  {
    self.target.innerHTML = '启用本端音频';
    localAudioMuted = !localAudioMuted;
  }
  else
  {
    console.warn('禁用失败');
  }
};

// 切换远端音频状态
document.querySelector('#handle_remote_audio').onclick = function(self)
{
  if (remoteAudioMuted)
  {
    if (remoteAudioStream.unmuteAudio())
    {
      self.target.innerHTML = '禁用远端音频';
      remoteAudioMuted = !remoteAudioMuted;
    }
    else
    {
      console.warn('启用失败');
    }
  }
  else if (remoteAudioStream.muteAudio())
  {
    self.target.innerHTML = '启用远端音频';
    remoteAudioMuted = !remoteAudioMuted;
  }
  else
  {
    console.warn('禁用失败');
  }
};

// 切换摄像头
document.querySelector('#switch_device').onclick = function()
{
  // localStream.switchDevice().then(function(s)
  // {
  //   document.querySelector('#local_stream').srcObject = s;
  // });
  PRTC.getCameras().then((cams) =>
  {
    let camsList='';

    for (let i = 0; i<cams.length; ++i)
    {
      camsList+=`<button type="button" onclick="switchCam('${cams[i].deviceId}')">Cam ${i+1} ${cams[i].label}</button>`;
    }

    document.querySelector('#cams').innerHTML=camsList;
  });
};

window.onbeforeunload=function()
{
  client.off('peer-leave', peerLeave);
  client.leave();
};