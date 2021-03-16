// 调试信息输出
// FlyInn.debug.enable('FlyInn:*');

// 关闭调试信息输出
// FlyInn.debug.disable('FlyInn:*');

let remoteTracks = [];
let remoteVideoStreams;
const uuid = FlyInn.Utils.newUUID();

// MQ
let mqSocket = null;
let callid = null;
let confid = null;
let dn = null;
let device = navigator.userAgent;
let roomid = null;
let sid = null;
let uid = null;
let version = '1.0.0';
let audio_ssrc = null;
let video_ssrc = null;

// CR
let contentType = 'application/json';
let host = 'pro.vsbc.com';
let xRights = null;
let xSid = null;
let xTimestampDiff = null;
let xUid = null;
let xVersion = '1.0.0';
let temper = null;

// 注册UA的用户名
const account = '1001';

// 远端用户名
const cnames = new Map();

// websocket 实例
const socket = new FlyInn.WebSocketInterface(
  'wss://lccsp.zgpajf.com.cn:5092/wss'
);

// UA 配置项
const configuration = {
  // JsSIP.Socket 实例
  sockets: socket,
  // 与 UA 关联的 SIP URI
  uri: `sip:${account}@lccsp.zgpajf.com.cn`,
  // SIP身份验证密码
  // password: ,
  register: false,
  session_timers: false,
  display_name: ' Web 用户名 ',
};

// Flyinn 实例
const flyinnUA = new FlyInn.UA(configuration);

// 摄像头列表
function listCameras(session) {
  var options = '<option value="">请选择摄像头</option>';
  navigator.mediaDevices.getUserMedia({video:true}).then((stream)=>{
    stream.getVideoTracks()[0].stop();

    navigator.mediaDevices.enumerateDevices().then((s) => {
      let k = 1;
      for (var i = 0; i < s.length; ++i) {
        if (s[i].kind === 'videoinput') {
          options += `<option value="${s[i].deviceId}">${
            s[i].label ? s[i].label : 'Camera' + k
          }</option>`;
          k++;
        }
      }
      $('#camSelect').html(options);

      document.querySelector('#camSelect').onchange = function () {
        if ($(this).val() === '') {
          return;
        }
        const stream = session
          .switchCam({
            deviceId: { exact: $(this).val() },
          })
          .then((s) => {
            let tracks = s.getTracks();
            let localStream = new MediaStream();
            tracks.forEach((track) => {
              if (track.kind == 'video' && track.readyState == 'live') {
                localStream.addTrack(track);
              }
            });
            document.querySelector('#localVideo').srcObject = localStream;
          });
      };
    });
  })
}
/**
 * 输出显示状态
 * @param {String} text
 */
function setStatus(text) {
  const statusDom = document.querySelector('#status');
  statusDom.innerText = text;
  console.log(text);
}

// callTo
function callTo(linkman) {
  if (!linkman) {
    return;
  }
  const session = flyinnUA.call(`${linkman}@lccsp.zgpajf.com.cn`, {
    mediaConstraints: { audio: true, video: true },
    extraHeaders: [`P-UUID: ${uuid}`],
  });

  // 监听远端增加视频
  session.connection.addEventListener('track', function (trackEvent) {
    if (trackEvent.track.kind === 'video' && trackEvent.track.enabled) {
      remoteTracks.push(trackEvent.track);
      // 创建媒体流
      createStream(remoteTracks);
    }
  });

  document.querySelector('#cancel').onclick = function () {
    // 取消呼叫
    session.terminate();
    location.reload();
  };
}

// 创建会议 or 加会
function joinConf(room, noMq) {
  if (noMq) {
    callTo(room);
    return;
  }
  // 获取临时密钥
  $.ajax({
    url: 'https://pro.vsbc.com/cu/d/p9sdfjddpoesdf9dkjdfjd',
    success: (res) => {
      if (res.code != 1000) {
        renderMq(res.msg);
        return;
      }
      // console.log(new Date(res.timestamp).getTime())
      // xTimestampDiff = new Date().getTime() - new Date(res.timestamp).getTime();
      xRights = res.data['X-Rights'];
      xSid = res.data['X-SID'];
      xUid = res.data['X-UID'];
      temper = res.data['temper'];

      if (room) {
        // 加入会议
        $.ajax({
          type: 'POST',
          url: 'https://pro.vsbc.com/cu/iapi/conf/join',
          // url: 'https://pro.vsbc.com/cu/d/conf/join', //无鉴权加入会议
          contentType: 'application/json',
          data: JSON.stringify({ roomId: room }),
          beforeSend: function (request) {
            const xTimestamp = parseInt(new Date().getTime() / 1000);
            request.setRequestHeader(
              'Authorization',
              createToken({ roomId: room }, xTimestamp)
            );
            request.setRequestHeader('X-Timestamp', xTimestamp);
            request.setRequestHeader('X-SID', xSid);
            request.setRequestHeader('X-UID', xUid);
            request.setRequestHeader('X-Rights', xRights);
            request.setRequestHeader('X-Version', '1.0.0');
          },
          success: function (result) {
            if (result.code === 1000) {
              roomid = result.data.roomId;
              confid = result.data.confId;

              // 建立消息队列
              initMq(result.data.mqUrl);
            } else {
              renderMq(result.msg);
            }
          },
        });
      } else {
        // 发起会议
        $.ajax({
          type: 'POST',
          url: 'https://pro.vsbc.com/cu/iapi/conf/new',
          // url: 'https://pro.vsbc.com/cu/d/conf/new',  //无鉴权发起会议
          contentType: 'application/json',
          data: JSON.stringify({}),
          beforeSend: function (request) {
            const xTimestamp = parseInt(new Date().getTime() / 1000);
            request.setRequestHeader(
              'Authorization',
              createToken({}, xTimestamp)
            );
            request.setRequestHeader('X-Timestamp', xTimestamp);
            request.setRequestHeader('X-SID', xSid);
            request.setRequestHeader('X-UID', xUid);
            request.setRequestHeader('X-Rights', xRights);
            request.setRequestHeader('X-Version', '1.0.0');
          },
          success: function (result) {
            if (result.code === 1000) {
              roomid = result.data.roomId;
              confid = result.data.confId;

              // 建立消息队列
              initMq(result.data.mqUrl);
            } else {
              renderMq(result.msg);
            }
          },
        });
      }
    },
  });
}

// 生成加会请求Token
function createToken(obj, timestamp) {
  var headersSign = CryptoJS.HmacSHA256(
    `content-type:application/json\r\nhost:${host}\r\nx-rights:${xRights}\r\nx-sid:${xSid}\r\nx-timestamp:${timestamp}\r\nx-uid:${xUid}\r\nx-version:1.0.0`,
    temper
  ).toString();

  return CryptoJS.HmacSHA256(JSON.stringify(obj), headersSign);
}

// 截视频帧
function captureVideo(video) {
  const canvas = document.getElementById('captureView');
  const ctx = canvas.getContext('2d');

  canvas.width = video.clientWidth;
  canvas.height = video.clientHeight;

  ctx.drawImage(video, 0, 0, video.clientWidth, video.clientHeight);
}

// 初始化消息队列连接
function initMq(mqUrl) {
  if (!mqUrl) {
    return;
  }
  mqSocket = new WebSocket(mqUrl);
  mqSocket.onopen = function () {
    callTo(roomid);
    document.querySelector('#linkman').value = roomid;
  };
  mqSocket.onmessage = function (event) {
    let data = null;
    try {
      data = JSON.parse(event.data);
    } catch (error) {}
    if (!data) {
      return;
    }
    switch (data.type) {
      case 'join':
        renderMq(Base64.decode(data.body.dn) + ' 加入会议');
        break;
      case 'leave':
        renderMq(Base64.decode(data.body.dn) + ' 离开会议');
        break;
      case 'publish':
        let media = null;
        let status = null;
        if (data.body.mType === 'audio') {
          media = '麦克风';
        } else {
          media = '摄像头';
        }
        if (data.body.mStatus === 'mute') {
          status = '关闭';
        } else {
          status = '开启';
        }
        if (data.body.uid !== uid) {
          renderMq(Base64.decode(data.body.dn) + ' ' + status + media);
        }
        break;
      default:
        break;
    }
  };
}

// 渲染消息队列消息
function renderMq(message) {
  const li = document.createElement('li');
  const ele = document.querySelector('#mq');
  li.innerHTML = message;
  ele.appendChild(li);
  ele.scrollTop = ele.scrollHeight;
}

// 生成媒体流
function createStream(tracks) {
  remoteVideoStreams = new Set();
  tracks.forEach((track) => {
    if (track.kind === 'video' && track.readyState !== 'ended') {
      // 媒体结束播放自动清除
      track.onended = function (s) {
        for (let item of remoteVideoStreams.values()) {
          if (s.target['id'] === item.id) {
            remoteVideoStreams.delete(item);
          }
        }
        renderRemoteVideos(remoteVideoStreams);
      };
      const newStream = new MediaStream();
      newStream.addTrack(track);
      remoteVideoStreams.add({ stream: newStream, id: track.id });
    }
  });
  // renderRemoteVideos(remoteVideoStreams);
}

// 渲染远端视频
function renderRemoteVideos(rvs) {
  let rvsEle = document.querySelector('#rvs');
  rvsEle.innerHTML = '';
  rvs.forEach((rv) => {
    let div = document.createElement('div');
    let p = document.createElement('p');
    p.className = 'r-title';
    p.dataset['track'] = rv.id;
    p.innerText = cnames.get(rv.id);

    // let video = document.createElement('video');
    let video = $(
      `<video autoplay playsinline x5-video-player-fullscreen="true" x5-video-player-type="h5" ></video>`
    )[0];
    video.srcObject = rv.stream;
    video.play();
    video.onclick = function () {
      captureVideo(video);
    };
    div.append(video);
    div.append(p);
    rvsEle.append(div);
  });
}


flyinnUA.on('connecting', function(e){
  console.log('connecting')
})


flyinnUA.on('connected', function(e){
  console.log('connected')
})

// newMessage 消息
flyinnUA.on('newMessage', function (e) {
  console.log(JSON.parse(e.request.body));
});

// 新通话
flyinnUA.on('newRTCSession', function (e) {
  let curMuted = null;

  dn = Base64.encode(
    e.request.from.display_name
      ? e.request.from.display_name
      : e.request.from.uri.user
  );

  // 收到选择摄像头
  listCameras(e.session);

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

  document.querySelector('#camSelect').onchange = function () {
    console.log(this);
  };

  document.querySelector('#switchCam').onclick = function () {
    // 切换摄像头
    e.session.switchCam({}).then((s) => {
      let tracks = s.getTracks();
      let localStream = new MediaStream();
      tracks.forEach((track) => {
        if (track.kind == 'video' && track.readyState == 'live') {
          localStream.addTrack(track);
        }
      });
      document.querySelector('#localVideo').srcObject = localStream;
    });
  };

  document.querySelector('#screenShare').onclick = function () {
    e.session.displayShare('replace');
  };

  // 呼入振铃 & 呼出回铃音
  e.session.on('progress', function (d) {
    if (d.originator === 'local') {
      setStatus('收到新呼入振铃');

      setTimeout(() => {
        e.session.answer();
      }, 200);
    } else {
      setStatus('播放回铃音');
    }
  });

  e.session.on('sdp', function (d) {
    d.sdp = d.sdp
      .replace(/network-id [^1][^\d*].*$/gm, '@')
      .replace(
        /(a=cand.*9 typ.*(\n|(\r\n)))|(a=cand.*@(\n|(\r\n)))|(a=.*generation [^0].*(\n|(\r\n)))|(a=mid:.*(\n|(\r\n)))|(a=group:BUNDLE.*(\n|(\r\n)))/g,
        ''
      );
    d.sdp = d.sdp.replace(/(?=a\=ice-ufra)/g, `a=x-sfu-cname:${dn}\r\n`);
  });

  // 呼叫失败处理
  e.session.on('failed', function (d) {
    document.querySelector('#video_area').classList = 'hide';
    setStatus(`失败: ${d.cause}`);
    location.reload();
  });

  // ReInvite 处理 cname
  e.session.on('reinvite', function (d) {
    d.callback = () => {
      const transceiverMids = new Map();
      const transceivers = e.session.connection.getTransceivers();

      for (let i = 0; i < transceivers.length; ++i) {
        transceiverMids.set(
          transceivers[i].mid,
          transceivers[i].receiver.track.id
        );
      }

      const medias = d.request['sdp'] ? d.request['sdp'].media : [];

      let rTitles = document.querySelectorAll('.r-title');

      for (let i = 0; i < medias.length; ++i) {
        let xSfuCname = '';
        try {
          xSfuCname = Base64.decode(medias[i].xSfuCname);
        } catch (error) {}
        cnames.set(transceiverMids.get(String(i)), xSfuCname);

        // if (xSfuCname) {
        //   rTitles.forEach((rTitle) => {
        //     // if (rTitle.dataset['track'] === transceiverMids.get(String(i))) {
        //     //   rTitle.innerText = xSfuCname;
        //     // console.log(xSfuCname);
        //     // }
        //   });
        // }
      }

      renderRemoteVideos(remoteVideoStreams);
    };
  });

  // 呼叫结束
  e.session.on('ended', function (event) {
    document.querySelector('#video_area').classList = 'hide';
    setStatus('离开会议');
    if (event.originator === 'local') {
      mqSocket &&
        mqSocket.send(
          JSON.stringify({
            type: 'leave',
            seq: '1',
            body: {
              callid: callid,
              confid: confid,
              uid: uid,
              roomid: roomid,
              device: device,
              ts: new Date().getTime(),
              version: version,
              sid: sid,
              dn: dn,
            },
          })
        );
    }
    location.reload();
  });

  // invite
  e.session.on('sending', function (event) {
    const sdp = event.request.body;
    callid = event.request.call_id;
    // confid = 'confid';
    // roomid = event.request.to.uri.user;
    sid =
      String(crc32(new Date().getTime().toString())) +
      String(crc32(event.request.call_id));
    uid = event.request.from.uri.user;
    audio_ssrc = sdp
      .replace(/(\n|\r\n)/g, '')
      .match(/m=audio.*?a=ssrc:(\d+)/)[1];
    video_ssrc = sdp
      .replace(/(\n|\r\n)/g, '')
      .match(/m=video.*?a=ssrc:(\d+)/)[1];
  });

  // 200 ok
  e.session.on('accepted', function (event) {
    if (event.originator === 'remote') {
      mqSocket &&
        mqSocket.send(
          JSON.stringify({
            type: 'join',
            seq: '1',
            body: {
              callid: callid,
              confid: confid,
              uid: uid,
              roomid: roomid,
              device: device,
              ts: new Date().getTime(),
              version: version,
              sid: sid,
              dn: dn,
            },
          })
        );
      // Test
      let v = 0;
      function test() {
        setTimeout(() => {
          if (v < 9999) {
            test();
            v++;
          }
          mqSocket &&
            mqSocket.send(
              JSON.stringify({
                type: 'publish',
                seq: 1,
                body: {
                  dn: dn,
                  mStatus: 'unmute',
                  mType: 'audio',
                  ssrc: audio_ssrc,
                  ts: new Date().getTime(),
                  uid: uid,
                },
              })
            );
        }, 100);
      }
      // test();

      mqSocket &&
        mqSocket.send(
          JSON.stringify({
            type: 'publish',
            seq: 1,
            body: {
              dn: dn,
              mStatus: 'unmute',
              mType: 'audio',
              ssrc: audio_ssrc,
              ts: new Date().getTime(),
              uid: uid,
            },
          })
        );
      mqSocket &&
        mqSocket.send(
          JSON.stringify({
            type: 'publish',
            seq: 1,
            body: {
              dn: dn,
              mStatus: 'unmute',
              mType: 'video',
              ssrc: video_ssrc,
              ts: new Date().getTime(),
              uid: uid,
            },
          })
        );
    }
  });

  // 呼叫已确认
  e.session.on('confirmed', function () {
    document.querySelector('#video_area').classList = '';

    // 本地视频
    const localVideoStream = new MediaStream();
    e.session.connection.getSenders().forEach((sender) => {
      if (
        sender.track &&
        sender.track.kind === 'video' &&
        sender.track.readyState === 'live'
      ) {
        localVideoStream.addTrack(sender.track);
      }
    });
    document.querySelector('#localVideo').srcObject = localVideoStream;

    // 远端音频
    const remoteAudioStream = new MediaStream();
    e.session.connection.getReceivers().forEach((receiver) => {
      if (receiver.track.kind === 'audio') {
        remoteAudioStream.addTrack(receiver.track);
      }
    });
    document.querySelector('#remoteAudio').srcObject = remoteAudioStream;
  });

  // 摄像头、麦克风已关闭
  e.session.on('muted', function (d) {
    if (d.audio) {
      document.querySelector('#muteMic').innerText = '开启麦克风';
      mqSocket &&
        mqSocket.send(
          JSON.stringify({
            type: 'publish',
            seq: 1,
            body: {
              dn: dn,
              mStatus: 'mute',
              mType: 'audio',
              ssrc: audio_ssrc,
              ts: new Date().getTime(),
              uid: uid,
            },
          })
        );
    } else if (d.video) {
      document.querySelector('#muteCam').innerText = '开始发送图像';
      mqSocket &&
        mqSocket.send(
          JSON.stringify({
            type: 'publish',
            seq: 1,
            body: {
              dn: dn,
              mStatus: 'mute',
              mType: 'video',
              ssrc: video_ssrc,
              ts: new Date().getTime(),
              uid: uid,
            },
          })
        );
    }
  });

  // 摄像头、麦克风已开启
  e.session.on('unmuted', function (d) {
    if (d.audio) {
      document.querySelector('#muteMic').innerText = '关闭麦克风';
      mqSocket &&
        mqSocket.send(
          JSON.stringify({
            type: 'publish',
            seq: 1,
            body: {
              dn: dn,
              mStatus: 'unmute',
              mType: 'audio',
              ssrc: audio_ssrc,
              ts: new Date().getTime(),
              uid: uid,
            },
          })
        );
    } else if (d.video) {
      document.querySelector('#muteCam').innerText = '停止发送图像';
      mqSocket &&
        mqSocket.send(
          JSON.stringify({
            type: 'publish',
            seq: 1,
            body: {
              dn: dn,
              mStatus: 'unmute',
              mType: 'video',
              ssrc: video_ssrc,
              ts: new Date().getTime(),
              uid: uid,
            },
          })
        );
    }
  });
});

// 启动
flyinnUA.start();

// 创建会议
document.querySelector('#invite_conf').onclick = function () {
  joinConf();
};

// 加入会议
document.querySelector('#join_conf').onclick = function () {
  joinConf(document.querySelector('#linkman').value);
};

// 加入会议
document.querySelector('#test_join').onclick = function () {
  joinConf(document.querySelector('#linkman').value, true);
};

window.onbeforeunload = function () {
  flyinnUA.stop();
};

// CRC32
var table =
  '00000000 77073096 EE0E612C 990951BA 076DC419 706AF48F E963A535 9E6495A3 0EDB8832 79DCB8A4 E0D5E91E 97D2D988 09B64C2B 7EB17CBD E7B82D07 90BF1D91 1DB71064 6AB020F2 F3B97148 84BE41DE 1ADAD47D 6DDDE4EB F4D4B551 83D385C7 136C9856 646BA8C0 FD62F97A 8A65C9EC 14015C4F 63066CD9 FA0F3D63 8D080DF5 3B6E20C8 4C69105E D56041E4 A2677172 3C03E4D1 4B04D447 D20D85FD A50AB56B 35B5A8FA 42B2986C DBBBC9D6 ACBCF940 32D86CE3 45DF5C75 DCD60DCF ABD13D59 26D930AC 51DE003A C8D75180 BFD06116 21B4F4B5 56B3C423 CFBA9599 B8BDA50F 2802B89E 5F058808 C60CD9B2 B10BE924 2F6F7C87 58684C11 C1611DAB B6662D3D 76DC4190 01DB7106 98D220BC EFD5102A 71B18589 06B6B51F 9FBFE4A5 E8B8D433 7807C9A2 0F00F934 9609A88E E10E9818 7F6A0DBB 086D3D2D 91646C97 E6635C01 6B6B51F4 1C6C6162 856530D8 F262004E 6C0695ED 1B01A57B 8208F4C1 F50FC457 65B0D9C6 12B7E950 8BBEB8EA FCB9887C 62DD1DDF 15DA2D49 8CD37CF3 FBD44C65 4DB26158 3AB551CE A3BC0074 D4BB30E2 4ADFA541 3DD895D7 A4D1C46D D3D6F4FB 4369E96A 346ED9FC AD678846 DA60B8D0 44042D73 33031DE5 AA0A4C5F DD0D7CC9 5005713C 270241AA BE0B1010 C90C2086 5768B525 206F85B3 B966D409 CE61E49F 5EDEF90E 29D9C998 B0D09822 C7D7A8B4 59B33D17 2EB40D81 B7BD5C3B C0BA6CAD EDB88320 9ABFB3B6 03B6E20C 74B1D29A EAD54739 9DD277AF 04DB2615 73DC1683 E3630B12 94643B84 0D6D6A3E 7A6A5AA8 E40ECF0B 9309FF9D 0A00AE27 7D079EB1 F00F9344 8708A3D2 1E01F268 6906C2FE F762575D 806567CB 196C3671 6E6B06E7 FED41B76 89D32BE0 10DA7A5A 67DD4ACC F9B9DF6F 8EBEEFF9 17B7BE43 60B08ED5 D6D6A3E8 A1D1937E 38D8C2C4 4FDFF252 D1BB67F1 A6BC5767 3FB506DD 48B2364B D80D2BDA AF0A1B4C 36034AF6 41047A60 DF60EFC3 A867DF55 316E8EEF 4669BE79 CB61B38C BC66831A 256FD2A0 5268E236 CC0C7795 BB0B4703 220216B9 5505262F C5BA3BBE B2BD0B28 2BB45A92 5CB36A04 C2D7FFA7 B5D0CF31 2CD99E8B 5BDEAE1D 9B64C2B0 EC63F226 756AA39C 026D930A 9C0906A9 EB0E363F 72076785 05005713 95BF4A82 E2B87A14 7BB12BAE 0CB61B38 92D28E9B E5D5BE0D 7CDCEFB7 0BDBDF21 86D3D2D4 F1D4E242 68DDB3F8 1FDA836E 81BE16CD F6B9265B 6FB077E1 18B74777 88085AE6 FF0F6A70 66063BCA 11010B5C 8F659EFF F862AE69 616BFFD3 166CCF45 A00AE278 D70DD2EE 4E048354 3903B3C2 A7672661 D06016F7 4969474D 3E6E77DB AED16A4A D9D65ADC 40DF0B66 37D83BF0 A9BCAE53 DEBB9EC5 47B2CF7F 30B5FFE9 BDBDF21C CABAC28A 53B39330 24B4A3A6 BAD03605 CDD70693 54DE5729 23D967BF B3667A2E C4614AB8 5D681B02 2A6F2B94 B40BBE37 C30C8EA1 5A05DF1B 2D02EF8D';
/* Number */
function crc32(/* String */ str, /* Number */ crc) {
  if (crc == window.undefined) crc = 0;
  var n = 0; //a number between 0 and 255
  var x = 0; //an hex number
  crc = crc ^ -1;
  for (var i = 0, iTop = str.length; i < iTop; i++) {
    n = (crc ^ str.charCodeAt(i)) & 0xff;
    x = '0x' + table.substr(n * 9, 8);
    crc = (crc >>> 8) ^ x;
  }
  var dec = (crc ^ -1) >>> 0;
  var hex = dec.toString(16);
  return hex;
}


function doPlay(){
  WeixinJSBridge.invoke('getNetworkType', {}, function (e) {
    var video=document.querySelectorAll('video');
    video.length>0 && video.forEach(v=>{
      v.play()
    })
  })
}

if (window.WeixinJSBridge) {
  doPlay()
} else {
  document.addEventListener("WeixinJSBridgeReady", function(){
    doPlay()
  }, false);
}