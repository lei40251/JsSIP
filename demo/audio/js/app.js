/* eslint-disable no-console */
// 调试信息输出
// FlyInnWeb.debug.enable('FlyInn:*');

// 关闭调试信息输出
// FlyInnWeb.debug.disable('FlyInn:*');

// 注册UA的用户名
// const account = parseInt(`90${Math.random() * 1000}`);
const account = '5000';
// const account = parseInt(`900${Math.random() * 10}`);
// var domain = 'pajf.vsbc.com';
// var wss = 'wss://pajf.vsbc.com:5092/wss';
// websocket 实例
// eslint-disable-next-line no-undef
const socket = new FlyInnWeb.WebSocketInterface('wss://pro.vsbc.com:10800/wss');

// UA 配置项
const configuration = {
  // JsSIP.Socket 实例
  sockets: socket,
  // 与 UA 关联的 SIP URI
  uri: `sip:${account}@pro.vsbc.com`,
  // SIP身份验证密码
  password: '5000'
  // password: account
};

// FlyinnWeb 实例
// eslint-disable-next-line no-undef
const flyinnUA = new FlyInnWeb.UA(configuration);

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
flyinnUA.on('newRTCSession', function (e) {
  let curMuted = null;

  const dtmf = document.querySelectorAll('.dtmf');

  for (let i = 0; i < dtmf.length; ++i) {
    (function (n) {
      dtmf[n].onclick = function (ev) {
        e.session.sendDTMF(ev.target.innerText, { type: 'RFC2833' });
      };
    })(i);
  }


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

  // 3PCC
  e.session.on('newNotify', function (d) {
    const self = this;

    if (d.originator === 'remote') {
      if (d.request.event.event == 'talk') {

        if (self.isEstablished()) {
          if (self.isOnHold()) {
            self.unhold();
          }
        } else {
          self.answer({
            rtcAnswerConstraints: { audio: true }
          });
        }
      } else if (e.request.event.event == 'hold') {
        self.hold();
      }
    }
  });

  // 呼叫结束
  e.session.on('ended', function () {
    setStatus('呼叫结束');
    location.reload();
  });

  // 呼叫已确认
  e.session.on('confirmed', function () {
    setStatus('已接通');
    document.querySelector('#localAudio').srcObject = this.local_stream;
    document.querySelector('#remoteAudio').srcObject = this.remote_stream;
  });

  // 摄像头、麦克风已关闭
  e.session.on('muted', function (d) {
    if (d.audio) {
      document.querySelector('#muteMic').innerText = '开启麦克风';
    }
  });

  // 摄像头、麦克风已开启
  e.session.on('unmuted', function (d) {
    if (d.audio) {
      document.querySelector('#muteMic').innerText = '关闭麦克风';
    }
  });
});

// 注册成功
flyinnUA.on('registered', function () {
  setStatus(`注册成功：${account}`);
});

// 注册失败
flyinnUA.on('registrationFailed', function (d) {
  console.log(d);
  setStatus(`注册失败：${d}`);
});

// 启动
flyinnUA.start();

// 发起呼叫
document.querySelector('#call').onclick = function () {
  const linkman = document.querySelector('#linkman').value;
  const session = flyinnUA.call(`${linkman}@pro.vsbc.com`);

  document.querySelector('#cancel').onclick = function () {
    // 取消呼叫
    session.terminate();
    location.reload();
  };
};

window.onbeforeunload = function () {
  flyinnUA.stop();
};
