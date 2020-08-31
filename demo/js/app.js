/* eslint-disable no-console */
// 调试信息输出
// FlyInn.debug.enable('FlyInn:*');

const domain = 'pro.vsbc.com';
const port = 60040

// 关闭调试信息输出
FlyInn.debug.disable('FlyInn:*');

// 判断是否https或者本地调试
if (window.location.protocol.indexOf('https') === -1 && window.location.host.indexOf('127.0.0.1') === -1 && window.location.host.indexOf('localhost') === -1) {
  console.log('实时音视频服务不支持非Https访问');
}

// 注册UA的用户名
const account = parseInt(`90${Math.random() * 100}`);

// websocket 实例
// eslint-disable-next-line no-undef
const socket = new FlyInn.WebSocketInterface(`wss://${domain}:${port}/wss`);

// UA 配置项
const configuration = {
  // JsSIP.Socket 实例
  sockets: socket,
  // 与 UA 关联的 SIP URI
  uri: `sip:${account}@${domain}`,
  // SIP身份验证密码
  password: account
};

// Flyinn 实例
// eslint-disable-next-line no-undef
const flyinnUA = new FlyInn.UA(configuration);

/**
 * 输出显示状态
 * @param {String} text
 */
function setStatus(text) {
  const statusDom = document.querySelector('#status');

  statusDom.innerText = text;
  console.log(text);
}

// 新通话
flyinnUA.on('newRTCSession', (e) => {
  let curMuted = null;

  document.querySelector('#answer').onclick = function () {
    // 接听
    e.session.answer();
  };

  document.querySelector('#cancel').onclick = function () {
    // 拒绝/挂机
    e.session.terminate();
  };

  document.querySelector('#muteMic').onclick = function () {
    // 获取视频和麦克风的关闭状态
    curMuted = e.session.isMuted();
    if (curMuted.audio) {
      // 开启麦克风
      e.session.unmute({ audio: true });
    } else {
      // 关闭麦克风
      e.session.mute({ audio: true });
    }
  };

  document.querySelector('#muteCam').onclick = function () {
    // 获取视频和麦克风的关闭状态
    curMuted = e.session.isMuted();
    if (curMuted.video) {
      // 开启摄像头
      e.session.unmute({ video: true });
    } else {
      // 关闭摄像头
      e.session.mute({ video: true });
    }
  };

  document.querySelector('#sendInfo').onclick = function () {
    // 通话中发送消息  注意： contentType 必填
    e.session.sendInfo('text/plain', document.querySelector('#info').value);
  };

  document.querySelector('#switchCam').onclick = function () {
    // 切换摄像头
    const stream = e.session.switchVideoStream();

    stream &&
      stream.then((s) => {
        document.querySelector('#localVideo').srcObject = s;
      });
  };

  // 分享桌面
  document.querySelector('#screenShare').onclick = function () {
    if (navigator.getDisplayMedia) {
      navigator
        .getDisplayMedia({
          video: true,
        })
        .then((stream) => {
          stream.addEventListener('inactive', (e) => {
            switchStream();
          });
          switchStream(stream, 'screen');
        })
        .catch((error) => {
          console.log(error);
        });
    } else if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      navigator.mediaDevices
        .getDisplayMedia({
          video: true,
        })
        .then((stream) => {
          stream.addEventListener('inactive', (e) => {
            switchStream();
          });
          switchStream(stream, 'screen');
        })
        .catch((error) => {
          console.log(error);
        });
    } else {
      alert('您的浏览器暂不支持分享屏幕');
    }

    // 设置本地视频
    function _setVideoStream(stream) {
      document.querySelector('#localVideo').srcObject = stream;
      document.querySelector('#localVideo').play();
    }

    // 切换不同媒体
    function switchStream(stream, type) {
      var oStream = null;
      if (type === 'screen') {
        window.screenStream = stream;
        oStream = stream;
      } else {
        if (stream) {
          oStream = stream;
          window.stream = stream;
        } else {
          oStream = window.stream;
        }
      }
      if (e.session && e.session.connection) {
        _setVideoStream(oStream);

        if (type === 'screen') {
          window.stream = e.session.connection.getLocalStreams()[0];
        }
        oStream.getVideoTracks().forEach(function (track) {
          var sender = e.session.connection.getSenders().find(function (s) {
            return s.track.kind == track.kind;
          });
          sender.replaceTrack(track);
        });
      }
    }
  };

  let speaker = true;

  document.querySelector('#switchSpeaker').onclick = function () {
    // 切换摄像头
    const remoteVideo = document.querySelector('#remoteVideo');

    speaker = !speaker;
    if (speaker) {
      // remoteVideo.removeAttribute('muted');
      remoteVideo.muted = false;
      this.innerText = '关闭扬声器';
    } else {
      // remoteVideo.setAttribute('muted', 'muted');
      remoteVideo.muted = true;
      this.innerText = '开启扬声器';
    }
  };

  // 呼入振铃 & 呼出回铃音
  e.session.on('progress', function (d) {
    if (d.originator === 'local') {
      setStatus('收到新呼入振铃');
    } else {
      setStatus('播放回铃音');
    }
  });

  // 呼叫失败处理
  e.session.on('failed', function (d) {
    setStatus(`呼叫失败: ${d.cause}`);
    location.reload();
  });

  // 呼叫结束
  e.session.on('ended', function () {
    setStatus('呼叫结束');
    location.reload();
  });

  // 呼叫已确认
  e.session.on('confirmed', function () {
    // document.querySelector('#localVideo').srcObject = this.local_stream;
    // document.querySelector('#remoteVideo').srcObject = this.remote_stream;

    const PeerConnection = e.session.connection;

    const _localStream = new MediaStream();

    const _remoteStream = new MediaStream();

    PeerConnection.getSenders().forEach(function (sender) {
      _localStream.addTrack(sender.track);
    });

    PeerConnection.getReceivers().forEach(function (receiver) {
      _remoteStream.addTrack(receiver.track);
    });
    if (_localStream) {
      document.querySelector('#localVideo').srcObject = _localStream;
    }

    if (_remoteStream) {
      document.querySelector('#remoteVideo').srcObject = _remoteStream;
    }
  });

  // 收到新消息
  e.session.on('newInfo', function (d) {
    if (d.originator === 'remote') {
      console.log('收到新消息：', d.info.body);
    } else if (d.originator === 'local') {
      console.log('发出消息：', d.info.body);
    }
  });

  // 摄像头、麦克风已关闭
  e.session.on('muted', function (d) {
    if (d.audio) {
      document.querySelector('#muteMic').innerText = '开启麦克风';
    } else if (d.video) {
      document.querySelector('#muteCam').innerText = '开启摄像头';
    }
  });

  // 摄像头、麦克风已开启
  e.session.on('unmuted', function (d) {
    if (d.audio) {
      document.querySelector('#muteMic').innerText = '关闭麦克风';
    } else if (d.video) {
      document.querySelector('#muteCam').innerText = '关闭摄像头';
    }
  });
});

// 注册成功
flyinnUA.on('registered', function () {
  setStatus(`注册成功：${account}`);
});

// 注册成功
flyinnUA.on('failed', function (d) {
  console.log(d);
});

// 启动
flyinnUA.start();

// 发起呼叫
document.querySelector('#call').onclick = function () {
  const linkman = document.querySelector('#linkman').value;
  const session = flyinnUA.call(`${linkman}@${domain}`, {
    mediaConstraints: { audio: true, video: true },
  });

  document.querySelector('#cancel').onclick = function () {
    // 取消呼叫
    session.terminate();
    location.reload();
  };
};

window.onbeforeunload = function () {
  flyinnUA.stop();
};
