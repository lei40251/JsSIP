/* eslint-disable no-undef */
/* eslint-disable no-console */
// 调试信息输出
CRTC.debug.enable('CRTC:*');

// 关闭调试信息输出
CRTC.debug.disable('CRTC:*');

function handleGetQuery(name) {
  const reg = new RegExp(`(^|&)${name}=([^&]*)(&|$)`, 'i');

  const r = window.location.search.substr(1).match(reg);

  if (r != null) return unescape(r[2]);

  return null;
}

let currMode;
let holdMode;

const uuid = CRTC.Utils.newUUID();

// 注册UA的用户名
const account = handleGetQuery('linkman')
  ? handleGetQuery('linkman')
  : parseInt(`90${Math.random() * 100}`);

// websocket 实例
// eslint-disable-next-line no-undef
const socket = new CRTC.WebSocketInterface('wss://lccsp.zgpajf.com.cn:5092/wss');

// UA 配置项
const configuration = {
  // JsSIP.Socket 实例
  sockets: socket,
  // 与 UA 关联的 SIP URI
  uri: `sip:${account}@lccsp.zgpajf.com.cn`,
  // SIP身份验证密码
  password: 'yl_19' + account
};

// Flyinn 实例
// eslint-disable-next-line no-undef
const flyinnUA = new CRTC.UA(configuration);

/**
 * 输出显示状态
 * @param {String} text
 */
function setStatus(text) {
  const statusDom = document.querySelector('#status');

  statusDom.innerText = text;
}

function updateDevices() {
  CRTC.Utils.getCameras()
    .then((cameras) => {
      let option = '<option selected value="">请选择</option>';

      cameras.forEach((device) => {
        option += `<option value="${device.deviceId}">${device.label}</option>`;
      });

      document.querySelector('#cameras').innerHTML = option;
    });
}

// 新通话
flyinnUA.on('newRTCSession', function (e) {
  let curMuted = null;

  console.log('session: ', e.session)

  document.querySelector('#cameras').onchange = function () {
    e.session.switchDevice('camera', this.options[this.selectedIndex].value)
  }

  document.querySelector('#answer').onclick = function () {
    // 接听
    e.session.answer({
      mediaConstraints: { audio: true, video: false }
    });
  };

  document.querySelector('#answerVideo').onclick = function () {
    // 接听
    e.session.answer({
      mediaConstraints: { audio: true, video: { width: { ideal: 480 }, height: { ideal: 640 } } }
    });
  };

  document.querySelector('#toAudio').onclick = function () {
    e.session.demoteToAudio();
  };

  document.querySelector('#toVideo').onclick = function () {
    e.session.upgradeToVideo();
  };

  document.querySelector('#cancel').onclick = function () {
    e.session.terminate();
  };

  var eventHandlers = {
    'progress': function (data) { console.log('progress', data) },
    'failed': function (data) {
      console.log('failed', data);
      if (e.session.isOnHold().local) {
        e.session.unhold({}, function () {
          console.warn('hm: ', holdMode)
          if (holdMode == 'video') {
            e.session.upgradeToVideo()
          }
        });
      }
    },
    'accepted': function (data) { console.log('accept', data); e.session.terminate() },
    'trying': function (data) { console.log('trying', data) },
    'requestSucceeded': function (data) { console.log('requestSucceeded', data) },
    'requestFailed': function (data) {
      console.log('requestFailed', data);
      if (e.session.isOnHold().local) {
        e.session.unhold({}, function () {
          console.warn('hm: ', holdMode)
          if (holdMode == 'video') {
            e.session.upgradeToVideo()
          }
        });
      }
    },
  };

  document.querySelector('#referBtn').onclick = function () {
    holdMode = currMode;
    e.session.hold();

    e.session.refer(`${document.querySelector('#refer').value}@lccsp.zgpajf.com.cn`, {
      eventHandlers: eventHandlers
    });

    // e.session.refer(`${document.querySelector('#refer').value}@lccsp.zgpajf.com.cn`,{
    //   replaces:e.session,
    //   mediaConstraints:{audio:true,video:true},
    //   eventHandlers:eventHandlers
    // });
  };

  document.querySelector('#muteMic').onclick = function () {
    // 获取视频和麦克风的关闭状态
    curMuted = e.session.isMuted();
    if (curMuted.audio) {
      // 开启麦克风
      e.session.unmute({ audio: true });
    }
    else {
      // 关闭麦克风
      e.session.mute({ audio: true });
    }
  };

  document.querySelector('#hold').onclick = function () {
    if (e.session.isOnHold().local) {
      e.session.unhold({}, function () {
        console.warn('hm: ', holdMode)
        if (holdMode == 'video') {
          e.session.upgradeToVideo()
        }
      });
    }
    else {
      holdMode = currMode;
      e.session.hold();
    }
  };

  document.querySelector('#muteCam').onclick = function () {
    // 获取视频和麦克风的关闭状态
    curMuted = e.session.isMuted();
    if (curMuted.video) {
      // 开启摄像头
      e.session.unmute({ video: true });
    }
    else {
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
    const stream = e.session.switchCam({ frameRate: 15 });

    stream &&
      stream.then((s) => {
        document.querySelector('#localVideo').srcObject = s;

        document.querySelector('#localVideo').addEventListener('canplay', (event) => {
          document.querySelector('#localVideo').play()
        })
      });
  };

  document.querySelector('#screenShare').onclick = function () {
    e.session.share('screen');
  };


  document.querySelector('#formShare').onclick = function () {
    // isRecordingStarted = true;
    // let cav;

    // setInterval(() => {
    //   html2canvas(document.querySelector("#ele")).then(canvas => {
    //       // document.body.appendChild(canvas)
    //     cav = canvas;
    //   });      
    // }, 500);

    e.session.share('html', '#ele', html2canvas);
  };

  // let timer;

  document.querySelector('#picShare').onclick = function () {
    e.session.share('pic', '#pic_s');
  };

  document.querySelector('#videoShare').onclick = function () {
    document.querySelector('#video_s').play()
      .then(() => {
        e.session.share('video', '#video_s');
      });
  };

  document.querySelector('#stopShare').onclick = function () {
    e.session.unShare();

    isStoppedRecording = false;
  };

  e.session.on('refer', function (d) {
    console.log('refer')
    d.accept()
  })

  e.session.on('replaces', function (e) {
    console.log('replaces: ', e)
    e.accept()
  })

  e.session.on('hold', function () {

    document.querySelector('#video_area').classList = '';
    // 本地视频
    document.querySelector('#localVideo').srcObject = new MediaStream();
    // 远端视频
    document.querySelector('#remoteVideo').srcObject = new MediaStream();
  })

  e.session.on('unhold', function () {

    document.querySelector('#video_area').classList = '';
    // 本地视频
    let localVideoStream = new MediaStream();

    if (RTCPeerConnection.prototype.getSenders) {
      e.session.connection.getSenders().forEach((sender) => {

        if (sender.track && sender.track.kind === 'video' && sender.track.readyState === 'live') {
          localVideoStream.addTrack(sender.track);
        }

      });
    }
    else {
      localVideoStream = e.session.connection.getLocalStreams()[0];
    }

    document.querySelector('#localVideo').srcObject = localVideoStream;

    document.querySelector('#localVideo').addEventListener('canplay', (event) => {
      document.querySelector('#localVideo').play()
    })

    // 远端视频
    let remoteVideoStream = new MediaStream();

    if (RTCPeerConnection.prototype.getReceivers) {
      e.session.connection.getReceivers().forEach((receiver) => {

        if (receiver.track && receiver.track.readyState === 'live') {
          if (receiver.track.kind === 'video') {
            remoteVideoStream.addTrack(receiver.track);
          }
          else {
            remoteVideoStream.addTrack(receiver.track);
          }
        }

      });
    }
    else {
      remoteVideoStream = e.session.connection.getRemoteStreams()[0];
    }
    document.querySelector('#remoteVideo').srcObject = remoteVideoStream;

    document.querySelector('#remoteVideo').addEventListener('canplay', (event) => {
      document.querySelector('#remoteVideo').play()
    })
  })



  e.session.on('mode', function (d) {
    console.log('mode: ', d);

    currMode = d.mode;

    document.querySelector('#video_area').classList = '';
    // 本地视频
    let localVideoStream = new MediaStream();

    if (RTCPeerConnection.prototype.getSenders) {
      e.session.connection.getSenders().forEach((sender) => {

        if (sender.track && sender.track.kind === 'video' && sender.track.readyState === 'live' && d.mode !== 'audio') {
          localVideoStream.addTrack(sender.track);
        }

      });
    }
    else {
      localVideoStream = e.session.connection.getLocalStreams()[0];
    }

    document.querySelector('#localVideo').srcObject = localVideoStream;

    document.querySelector('#localVideo').addEventListener('canplay', (event) => {
      document.querySelector('#localVideo').play()
    })

    // 远端视频
    let remoteVideoStream = new MediaStream();

    if (RTCPeerConnection.prototype.getReceivers) {
      e.session.connection.getReceivers().forEach((receiver) => {

        if (receiver.track && receiver.track.readyState === 'live') {
          if (receiver.track.kind === 'video') {
            if (d.mode !== 'audio') {
              remoteVideoStream.addTrack(receiver.track);
            }
          }
          else {
            remoteVideoStream.addTrack(receiver.track);
          }
        }

      });
    }
    else {
      remoteVideoStream = e.session.connection.getRemoteStreams()[0];
    }
    document.querySelector('#remoteVideo').srcObject = remoteVideoStream;

    document.querySelector('#remoteVideo').addEventListener('canplay', (event) => {
      document.querySelector('#remoteVideo').play()
    })
  })

  // 呼入振铃 & 呼出回铃音
  e.session.on('progress', function (d) {
    if (d.originator === 'local') {
      setStatus('振铃中');
      // setTimeout(() =>
      // {
      //   e.session.answer({
      //     mediaConstraints : {
      //       audio : true,
      //       video : { width: { ideal: 480 }, height: { ideal: 640 } }
      //     }
      //   });
      // }, 200);
    }
    else {
      setStatus('播放回铃音');
    }
  });

  e.session.on('cameraChanged', function (d) {
    document.querySelector('#localVideo').srcObject = d
    document.querySelector('#localVideo').addEventListener('canplay', (event) => {
      document.querySelector('#localVideo').play()
    })
  })

  // 呼叫失败处理
  e.session.on('failed', function (d) {
    document.querySelector('#video_area').classList = 'hide';
    setStatus(`呼叫失败: ${d.cause}`);
    // location.reload();
  });

  // 呼叫结束
  e.session.on('ended', function () {
    document.querySelector('#video_area').classList = 'hide';
    setStatus('呼叫结束');
    // location.reload();
  });

  // e.session.on('upgradeToVideo', function(data){
  //   console.log('invite to video', data);
  // })

  // 呼叫已确认
  e.session.on('confirmed', function (d) {
    document.querySelector('#video_area').classList = '';
    // 本地视频
    let localVideoStream = new MediaStream();

    if (RTCPeerConnection.prototype.getSenders) {
      e.session.connection.getSenders().forEach((sender) => {
        if (
          sender.track &&
          sender.track.kind === 'video' &&
          sender.track.readyState === 'live'
        ) {
          localVideoStream.addTrack(sender.track);
        }
      });
    }
    else {
      localVideoStream = e.session.connection.getLocalStreams()[0];
    }

    document.querySelector('#localVideo').srcObject = localVideoStream;
    document.querySelector('#localVideo').addEventListener('canplay', (event) => {
      document.querySelector('#localVideo').play()
    })

    // 远端视频
    let remoteVideoStream = new MediaStream();
    let remoteAudioStream = new MediaStream();

    if (RTCPeerConnection.prototype.getReceivers) {
      e.session.connection.getReceivers().forEach((receiver) => {
        if (receiver.track && receiver.track.readyState === 'live') {
          if (receiver.track.kind === 'audio') {
            remoteAudioStream.addTrack(receiver.track)
          }
          else {
            remoteVideoStream.addTrack(receiver.track);
          }
        }
      });
    }
    else {
      remoteVideoStream = e.session.connection.getRemoteStreams()[0];
    }
    const audio = new Audio();
    audio.srcObject = remoteAudioStream;

    audio.addEventListener('canplay', (event) => {
      audio.play()
    })

    document.querySelector('#remoteVideo').srcObject = remoteVideoStream;
    document.querySelector('#remoteVideo').addEventListener('canplay', (event) => {
      document.querySelector('#remoteVideo').play()
    })
  });

  // 收到新消息
  e.session.on('newInfo', function (d) {
    if (d.originator === 'remote') {
      console.log('收到新消息：', d.info.body);
    }
    else if (d.originator === 'local') {
      console.log('发出消息：', d.info.body);
    }
  });

  // 取消bundle
  e.session.on('sdp', function (d) {
    d.sdp = d.sdp.replace(/a=group:BUNDLE.*\r\n/, '');
  });


  // 摄像头、麦克风已关闭
  e.session.on('muted', function (d) {
    if (d.audio) {
      document.querySelector('#muteMic').innerText = '开启麦克风';
    }
    else if (d.video) {
      document.querySelector('#muteCam').innerText = '开启摄像头';
    }
  });

  // 摄像头、麦克风已开启
  e.session.on('unmuted', function (d) {
    if (d.audio) {
      document.querySelector('#muteMic').innerText = '关闭麦克风';
    }
    else if (d.video) {
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
  currMode = 'audio'
  call()
};

// 发起呼叫
document.querySelector('#callVideo').onclick = function () {
  currMode = 'video'
  call('video')
};

function call(type) {
  const mediaConstraints = {
    audio: true,
    video: false
  }

  if (type === 'video') {
    mediaConstraints.video = true;
  }

  const linkman = document.querySelector('#linkman').value;
  const session = flyinnUA.call(`${linkman}@lccsp.zgpajf.com.cn`, {
    mediaConstraints
    // mediaConstraints : {
    //   audio : true,
    //   video : { width: { ideal: 480 }, height: { ideal: 640 } }
    // }
  });

  session.connection.ontrack = function (event) {
    // 远端视频
    // const remoteVideoStream = new MediaStream();

    // if (receiver.track && receiver.track.readyState === 'live')
    // {
    //   remoteVideoStream.addTrack(receiver.track);
    // }

    // 本地视频
    let localVideoStream = new MediaStream();

    if (RTCPeerConnection.prototype.getSenders) {
      session.connection.getSenders().forEach((sender) => {
        if (
          sender.track &&
          sender.track.kind === 'video' &&
          sender.track.readyState === 'live'
        ) {
          localVideoStream.addTrack(sender.track);
        }
      });
    }
    else {
      localVideoStream = session.connection.getLocalStreams()[0];
    }

    document.querySelector('#localVideo').srcObject = localVideoStream;

    document.querySelector('#localVideo').addEventListener('canplay', (event) => {
      document.querySelector('#localVideo').play()
    })

    // localVideoStream.getVideoTracks().forEach((track) =>
    // {
    //   track.addEventListener('ended', () =>
    //   {
    //     console.log('这里可以切换为音频界面');
    //   });
    // });



    // document.querySelector('#remoteVideo').srcObject = event.streams[0];
  };

  document.querySelector('#cancel').onclick = function () {
    // 取消呼叫
    session.terminate();
    location.reload();
  };
}

window.onbeforeunload = function () {
  flyinnUA.stop();
};

document.querySelector('#capture').onclick = function () {
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

updateDevices();

navigator.mediaDevices.addEventListener('devicechange', async () => {
  await updateDevices();
});