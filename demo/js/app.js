/* eslint-disable no-console */
/* eslint-disable no-undef */

// 调试信息输出
FlyInn.debug.enable('FlyInn:*');

// 关闭调试信息输出
// FlyInn.debug.disable('FlyInn:*');

const version = FlyInn.version;
const uuid = FlyInn.Utils.newUUID();
const domain = 'lccsp.zgpajf.com.cn';
const signallingUrl = 'wss://lccsp.zgpajf.com.cn:5092/wss';

let client = null;

// MQ
const device = navigator.userAgent;

const mqSocket = null;
const callid = null;
const confid = null;
const dn = null;
const roomid = null;
const sid = null;
const uid = null;
const audio_ssrc = null;
const video_ssrc = null;

// CallRouter
const host = 'pro.vsbc.com';

let xRights = null;
let xSid = null;
let xUid = null;
let temper = null;

// new
let localStream = null;
let remoteAudioStream = null;

// 音视频禁用状态
let localVideoMuted = false;
let localAudioMuted = false;
let remoteAudioMuted = false;

// 获取临时密钥及基本信息
function getTemper(callback)
{
  // 获取临时密钥
  $.ajax({
    url     : 'https://pro.vsbc.com/cu/d/p9sdfjddpoesdf9dkjdfjd',
    success : function(res)
    {
      if (res.code != 1000)
      {
        renderMq(res.msg);

        return;
      }
      xRights = res.data['X-Rights'];
      xSid = res.data['X-SID'];
      xUid = res.data['X-UID'];
      temper = res.data['temper'];
      callback();
    }
  });
}

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

  const video = $('<video autoplay playsinline x5-video-player-fullscreen="true" x5-video-player-type="h5" ></video>')[0];

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
    domain         : domain,
    wss_url        : signallingUrl,
    user_id        : xUid,
    user_sig       : xUid,
    register       : false,
    session_timers : false,
    display_name   : 'Web用户'
  };

  // Client
  client = FlyInn.createClient(configuration);

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

// 预览本地媒体
document.querySelector('#create_stream').onclick = function()
{
  localStream = new FlyInn.LocalStream({});

  localStream.initialize().then(function(stream)
  {
    document.querySelector('#local_stream').srcObject = stream;
  });
};

// 加入会议
document.querySelector('#join_conf').onclick =function()
{
  if (localStream)
  {
    client.join(String(document.querySelector('#linkman').value), { mediaStream: localStream.stream });
  }
  else
  {
    client.join(String(document.querySelector('#linkman').value));
  }
};

document.querySelector('#leave').onclick =function()
{
  client.leave();
};

// 切换本地视频状态
document.querySelector('#handle_local_video').onclick = function(self)
{
  if (localVideoMuted)
  {
    if (localStream.unmuteVideo())
    {
      self.target.innerHTML = '禁用本地视频';
      localVideoMuted = !localVideoMuted;
    }
    else
    {
      console.warn('启用失败');
    }
  }
  else if (localStream.muteVideo())
  {
    self.target.innerHTML = '启用本地视频';
    localVideoMuted = !localVideoMuted;
  }
  else
  {
    console.warn('禁用失败');
  }
};

// 切换本地音频状态
document.querySelector('#handle_local_audio').onclick = function(self)
{
  if (localAudioMuted)
  {
    if (localStream.unmuteAudio())
    {
      self.target.innerHTML = '禁用麦克风';
      localAudioMuted = !localAudioMuted;
    }
    else
    {
      console.warn('启用失败');
    }
  }
  else if (localStream.muteAudio())
  {
    self.target.innerHTML = '启用麦克风';
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