/* eslint-disable no-console */
/* eslint-disable no-undef */

// 调试信息输出
PRTC.debug.enable('FlyInn:*');

// 关闭调试信息输出
// PRTC.debug.disable('FlyInn:*');

const version = PRTC.version;

let client = null;

const callRouterUrl = 'https://pro.vsbc.com/pa';

// new
let localStream = null;
let remoteAudioStream = null;

// 音视频禁用状态
let localVideoMuted = false;
let localAudioMuted = false;
let remoteAudioMuted = false;

// 会议结束重置参数
function resetStatus()
{
  // new
  localStream = null;
  remoteAudioStream = null;

  // 音视频禁用状态
  localVideoMuted = false;
  localAudioMuted = false;
  remoteAudioMuted = false;

  document.querySelector('#rvs').innerHTML = '';
  document.querySelector('#local_stream').srcObject = null;

}

// 渲染远端媒体
function renderRemoteStream(stream)
{
  const rvsEle = document.querySelector('#rvs');

  const div = document.createElement('div');
  const p = document.createElement('p');
  const btn = document.createElement('button');

  div.classList = 'remote_stream';
  div.dataset.stream_id = stream.id;

  btn.classList = 'handle_remote_stream';
  btn.innerText = '关闭视频';
  btn.dataset.muted = 0;
  btn.onclick = function(self)
  {
    if (self.target.dataset.muted == '1')
    {
      if (stream.unmuteVideo() == '1')
      {
        self.target.innerHTML = '关闭视频';
        self.target.dataset.muted = '0';
      }
      else
      {
        console.warn('开启失败');
      }
    }
    else if (stream.muteVideo())
    {
      self.target.innerHTML = '开启视频';
      self.target.dataset.muted = '1';
    }
    else
    {
      console.warn('关闭失败');
    }
  };

  p.innerText = `${stream.userId}(${stream.dn})`;

  const video =document.createElement('video');

  const x5VideoPlayerFullscreen = document.createAttribute('x5-video-player-fullscreen');

  const x5VideoPlayerType = document.createAttribute('x5-video-player-type');

  x5VideoPlayerFullscreen.value=true;
  x5VideoPlayerType.value='h5';

  video.setAttributeNode(x5VideoPlayerType);
  video.setAttributeNode(x5VideoPlayerFullscreen);

  video.autoplay=true;
  video.playsInline =true;

  video.srcObject = stream.stream;
  video.onclick = function()
  {
    captureVideo(video);
  };

  div.append(video);
  div.append(p);
  div.append(btn);
  rvsEle.append(div);
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

  // Client
  client = PRTC.createClient(configuration);

  // 信令连接成功建立
  client.on('connection-state-changed', function(data)
  {
    console.log('connection-state-changed: ', data);
  });

  // 注册成功，在需要注册场景可用
  client.on('registered', function()
  {
    console.log('注册成功');
  });

  // 注册失败，在需要注册场景可用
  client.on('registrationFailed', function()
  {
    console.log('注册失败');
  });

  // 已添加远端流
  client.on('stream-added', function(remoteStream)
  {
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
    console.log('removed: ', remoteStream);

    const remoteStreamDivs = document.querySelectorAll('.remote_stream');

    remoteStreamDivs.forEach(function(div)
    {
      if (div.dataset.stream_id === remoteStream.id)
      {
        div.remove();
      }
    });
  });

  client.on('local-joined', function(data)
  {
    console.log('您已加入会议');
    localStream = data;

    // document.querySelector('#local_stream').addEventListener('ended', () =>
    // {
    //   console.log('mmmmmmmmmm');
    // });

    localStream.stream.oninactive= () =>
    {
      console.log('Video stopped either because 1) it was over, ' +
          'or 2) no further data is available.');
    };

    localStream.custom || (document.querySelector('#local_stream').srcObject = localStream.stream);
  });

  client.on('local-left', function()
  {
    resetStatus();
    console.log('您已离开会议');
  });

  client.on('error', function(data)
  {
    console.log('error: ', data);
  });
}

// 启动
function start()
{
  Promise.resolve()
    .then(function()
    {
      getTemper(initSignalling);
    })
    .then(function()
    {

    })
    .catch(function(error)
    {
      console.error(error);
    });
}

start();

document.querySelector('#screenShare').onclick=function()
{
  client.displayShare();
};

// 预览本端媒体
document.querySelector('#create_stream').onclick = function()
{
  localStream = new PRTC.LocalStream({});

  localStream.on('stop', () =>
  {
    console.log('localstream is stoped.');
  });

  localStream.initialize().then(function()
  {
    document.querySelector('#local_stream').srcObject = localStream.stream;
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
    client.join(document.querySelector('#roomId').value, document.querySelector('#display_name').value);
  }
};

document.querySelector('#leave').onclick =function()
{
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
  localStream.switchDevice().then(function(s)
  {
    document.querySelector('#local_stream').srcObject = s;
  });
};