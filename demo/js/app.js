/* eslint-disable no-console */
// 调试信息输出
FlyInn.debug.enable('FlyInn:*');

// 关闭调试信息输出
// FlyInn.debug.disable("FlyInn:*");

// 注册UA的用户名
const account = parseInt(`90${Math.random() * 100}`);

// websocket 实例
// eslint-disable-next-line no-undef
const socket = new FlyInn.WebSocketInterface('wss://pro.vsbc.com:60040/wss');

// UA 配置项
const configuration = {
  // JsSIP.Socket 实例
  sockets  : socket,
  // 与 UA 关联的 SIP URI
  uri      : `sip:${account}@pro.vsbc.com`,
  // SIP身份验证密码
  password : account
};

// FlyinnWeb 实例
// eslint-disable-next-line no-undef
const flyinnUA = new FlyInn.UA(configuration);

/**
 * 输出显示状态
 * @param {String} text
 */
function setStatus(text)
{
  const statusDom = document.querySelector('#status');

  statusDom.innerText = text;
  console.log(text);
}

// 新通话
flyinnUA.on('newRTCSession', function(e)
{
  let curMuted = null;

  document.querySelector('#answer').onclick = function()
  {
    // 接听
    e.session.answer();
  };

  document.querySelector('#cancel').onclick = function()
  {
    // 拒绝/挂机
    e.session.terminate();
  };

  document.querySelector('#muteMic').onclick = function()
  {
    // 获取视频和麦克风的关闭状态
    curMuted = e.session.isMuted();
    if (curMuted.audio)
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

  document.querySelector('#muteCam').onclick = function()
  {
    // 获取视频和麦克风的关闭状态
    curMuted = e.session.isMuted();
    if (curMuted.video)
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

  document.querySelector('#sendInfo').onclick = function()
  {
    // 通话中发送消息  注意： contentType 必填
    e.session.sendInfo('text/plain', document.querySelector('#info').value);
  };

  document.querySelector('#switchCam').onclick = function()
  {
    // 切换摄像头
    const stream = e.session.switchCam({ frameRate: 15 });

    stream &&
      stream.then((s) =>
      {
        document.querySelector('#localVideo').srcObject = s;
      });
  };

  document.querySelector('#screenShare').onclick = function()
  {
    e.session.displayShare('replace');
  };

  // 呼入振铃 & 呼出回铃音
  e.session.on('progress', function(d)
  {
    if (d.originator === 'local')
    {
      setStatus('收到新呼入振铃');
    }
    else
    {
      setStatus('播放回铃音');
    }
  });

  // 呼叫失败处理
  e.session.on('failed', function(d)
  {
    document.querySelector('#video_area').classList = 'hide';
    setStatus(`呼叫失败: ${d.cause}`);
    location.reload();
  });

  // 呼叫结束
  e.session.on('ended', function()
  {
    document.querySelector('#video_area').classList = 'hide';
    setStatus('呼叫结束');
    location.reload();
  });

  // 呼叫已确认
  e.session.on('confirmed', function()
  {
    document.querySelector('#video_area').classList = '';
    // 本地视频
    const localVideoStream = new MediaStream();

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

    document.querySelector('#localVideo').srcObject = localVideoStream;

    // 远端视频
    const remoteVideoStream = new MediaStream();

    e.session.connection.getReceivers().forEach((receiver) =>
    {
      if (
        receiver.track &&
        receiver.track.kind === 'video' &&
        receiver.track.readyState === 'live'
      )
      {
        remoteVideoStream.addTrack(receiver.track);
      }
    });

    document.querySelector('#remoteVideo').srcObject = remoteVideoStream;
  });

  // 收到新消息
  e.session.on('newInfo', function(d)
  {
    if (d.originator === 'remote')
    {
      console.log('收到新消息：', d.info.body);
    }
    else if (d.originator === 'local')
    {
      console.log('发出消息：', d.info.body);
    }
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

// 注册成功
flyinnUA.on('registered', function()
{
  setStatus(`注册成功：${account}`);
});

// 注册成功
flyinnUA.on('failed', function(d)
{
  console.log(d);
});

// 启动
flyinnUA.start();

// 发起呼叫
document.querySelector('#call').onclick = function()
{
  const linkman = document.querySelector('#linkman').value;
  const session = flyinnUA.call(`${linkman}@pro.vsbc.com`, {
    mediaConstraints : { audio: true, video: true }
  });

  document.querySelector('#cancel').onclick = function()
  {
    // 取消呼叫
    session.terminate();
    location.reload();
  };
};

window.onbeforeunload = function()
{
  flyinnUA.stop();
};
