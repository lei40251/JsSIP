/* eslint-disable no-console */
// 调试信息输出
FlyInn.debug.enable('FlyInn:*');

// 关闭调试信息输出
// FlyInn.debug.disable('FlyInn:*');

let deg=0;
let RTCRecord = false;
let inCallSession = null;
const recordRTC = [];

function rotaVideo()
{
  deg+=1;
  $('#remoteVideo').css({ 'transform': `rotate(${90*deg}deg)` });
}

function resetVideo()
{
  $('#remoteVideo').css({ 'transform': 'rotate(0deg)' });
}

/**
 * 获取url参数
 *
 * @param {String} name 参数名
 * @return {String|null}
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
 * @param {String} text
 */
function setStatus(text)
{
  const statusDom = document.querySelector('#status');

  statusDom.innerText = text;
}

// 注册UA的用户名
const account = handleGetQuery('linkman')
  ? handleGetQuery('linkman')
  : parseInt(`90${Math.random() * 100}`);

// websocket 实例
// eslint-disable-next-line no-undef
const socket = new FlyInn.WebSocketInterface('wss://lccsp.zgpajf.com.cn:5092/wss');

// UA 配置项
const configuration = {
  // JsSIP.Socket 实例
  sockets  : socket,
  // 与 UA 关联的 SIP URI
  uri      : `sip:${account}@lccsp.zgpajf.com.cn`,
  // SIP身份验证密码
  password : `yl_19${account}`
};

// Flyinn 实例
// eslint-disable-next-line no-undef
const flyinnUA = new FlyInn.UA(configuration);

// 新通话
flyinnUA.on('newRTCSession', function(e)
{
  let curMuted = null;

  if (e.originator == 'remote')
  {
    inCallSession = e.session;
  }

  document.querySelector('#answer').onclick = function()
  {
    // 接听
    e.session.answer({
      mediaConstraints : {
        audio : true,
        video : {
          width : {
            ideal : 480
          },
          height : {
            ideal : 640
          }
        }
      }
    });
  };

  document.querySelector('#cancel').onclick = function()
  {
    // 拒绝|挂机|取消
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

  // document.querySelector('#switchCam').onclick = function()
  // {
  //   // 切换摄像头
  //   const stream = e.session.switchCam({ frameRate: 15 });

  //   stream &&
  //     stream.then((s) =>
  //     {
  //       document.querySelector('#localVideo').srcObject = s;
  //     });
  // };

  document.querySelector('#screenShare').onclick = function()
  {
    // 分享桌面
    e.session.displayShare('replace');
  };


  document.querySelector('#stopShare').onclick = function()
  {
    // 取消分享桌面
    e.session.unDisplayShare('replace');
  };

  // 呼入振铃 & 呼出回铃音
  e.session.on('progress', function(d)
  {
    if (d.originator === 'local')
    {
      setStatus('呼叫中');
      setTimeout(() =>
      {
        e.session.answer({
          mediaConstraints : {
            audio : true,
            video : { width: { ideal: 480 }, height: { ideal: 640 } }
          }
        });
      }, 200);
    }
    else
    {
      setStatus('播放回铃音');
    }
  });

  e.session.on('VoLTE:toVideo', function()
  {
    console.log('切换为视频模式');
    
    // 本地视频
    const localVideoStream = new MediaStream();
    const remoteVideoStream = new MediaStream();

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

    e.session.connection.getReceivers().forEach((receiver) =>
    {
      console.log('recv: ', receiver);
      if (
        receiver.track &&
        receiver.track.readyState === 'live'
      )
      {
        remoteVideoStream.addTrack(receiver.track);
      }
    });
    

    document.querySelector('#localVideo').srcObject = localVideoStream;

    document.querySelector('#remoteVideo').srcObject = remoteVideoStream;
  });

  e.session.on('VoLTE:toAudio', function()
  {
    console.log('切换为音频模式');
  });

  // 呼叫失败处理
  e.session.on('failed', function(d)
  {
    document.querySelector('#video_area').classList = 'hide';
    setStatus(`呼叫失败: ${d.cause}`);
    // location.reload();

    // 呼叫失败上传录像文件
    if (RTCRecord)
    {
      recordRTC[sessionStorage.getItem('sessionId')].stopRecording(function()
      {
        getSeekableBlob(
          recordRTC[sessionStorage.getItem('sessionId')].getBlob(),
          function(seekableBlob)
          {
            // uploadVideoHandler(seekableBlob);
            console.log('seek: ', seekableBlob);
            document.querySelector('#record').src = URL.createObjectURL(seekableBlob);
          }
        );
      });

      RTCRecord = false;
    }
  });

  // 呼叫结束
  e.session.on('ended', function()
  {
    document.querySelector('#video_area').classList = 'hide';
    setStatus('呼叫结束');
    resetVideo();
    // location.reload();

    // 通话结束先上传录像文件
    if (RTCRecord)
    {
      recordRTC[sessionStorage.getItem('sessionId')].stopRecording(function()
      {
        getSeekableBlob(
          recordRTC[sessionStorage.getItem('sessionId')].getBlob(),
          function(seekableBlob)
          {
            console.log('seekss: ', seekableBlob);
            // uploadVideoHandler(seekableBlob);
            document.querySelector('#record').src = URL.createObjectURL(seekableBlob);
          }
        );
      });
      RTCRecord = false;
    }
  });

  // 呼叫已确认
  e.session.on('confirmed', function()
  {
    document.querySelector('#video_area').classList = '';

    // if (inCallSession)
    // {
    //   const localStream = new MediaStream();
    //   const remoteStream = new MediaStream();

    //   inCallSession.connection.getSenders().forEach(function(sender)
    //   {
    //     localStream.addTrack(sender.track);
    //   });
    //   inCallSession.connection.getReceivers().forEach(function(receiver)
    //   {
    //     remoteStream.addTrack(receiver.track);
    //   });

    //   document.querySelector('#localVideo').srcObject = localStream;

    //   document.querySelector('#remoteVideo').srcObject = remoteStream;

    // }

  });

  // 取消bundle
  e.session.on('sdp', function(d)
  {
    d.sdp = d.sdp.replace(/a=group:BUNDLE.*\r\n/, '');
    d.sdp = d.sdp.replace(/a=mid:1.*\r\n/g, 'a=mid:1\r\na=tcap:1 RTP/AVPF\r\na=pcfg:1 t=1\r\n');
    d.sdp = d.sdp.replace(/a=extmap:.*\r\n/g, '');
    d.sdp = d.sdp.replace(/a=mid:1\r\n/g, 'a=extmap:13 urn:3gpp:video-orientation\r\na=mid:1\r\n');
    // d.sdp = d.sdp.replace(/a=extmap:2.*\r\n/, '');
    // d.sdp = d.sdp.replace(/a=extmap:3.*\r\n/, '');
    // d.sdp = d.sdp.replace(/a=extmap:4.*\r\n/, '');
    // d.sdp = d.sdp.replace(/a=extmap:5.*\r\n/, '');
    // d.sdp = d.sdp.replace(/a=extmap:6.*\r\n/, '');
    // d.sdp = d.sdp.replace(/a=extmap:7.*\r\n/, '');
    // d.sdp = d.sdp.replace(/a=extmap:8.*\r\n/, '');
    // d.sdp = d.sdp.replace(/a=extmap:9.*\r\n/, '');
    // d.sdp = d.sdp.replace(/a=extmap:10.*\r\n/, '');
    // d.sdp = d.sdp.replace(/a=extmap:11.*\r\n/, '');
    // d.sdp = d.sdp.replace(/a=extmap:12.*\r\n/, '');
    // d.sdp = d.sdp.replace(/a=extmap:14.*\r\n/, '');
  });

  // callMode
  e.session.on('callmode', function(d)
  {
    console.log('callmode: ', d);
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
  const session = flyinnUA.call(`${linkman}@lccsp.zgpajf.com.cn`, {
    mediaConstraints : {
      audio : true,
      video : { width: { ideal: 480 }, height: { ideal: 640 } }
    }
  });

  session.connection.ontrack = function(event)
  {

    // 本地视频
    const localVideoStream = new MediaStream();

    session.connection.getSenders().forEach((sender) =>
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

    document.querySelector('#remoteVideo').srcObject = event.streams[0];

    // 外呼端视频录制
    const arrayOfStreams = [ localVideoStream, event.streams[0] ];

    recordRTC[sessionStorage.getItem('sessionId')] = RecordRTC(arrayOfStreams, {
      type      : 'video',
      mimeType  : 'video/webm;codecs=vp8',
      watermark : '北京市, 北京市, 西城区, 前后井胡同, 8号'
    });
    recordRTC[sessionStorage.getItem('sessionId')].startRecording();
    RTCRecord = true;

  };

  document.querySelector('#cancel').onclick = function()
  {
    // 取消呼叫
    session.terminate();
    // location.reload();
  };
};

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

window.onbeforeunload = function()
{
  flyinnUA.stop();
};