function negotiate(flag) 
{
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'sendrecv' });

  
  // 1. 获取麦克风权限
  const constraints = { 
    audio : { 
      sampleRate       : this.expectedSampleRate,
      channelCount     : 1,
      echoCancellation : true,
      autoGainControl  : true,
      noiseSuppression : true,
      latency          : { ideal: 0.01 }
    } 
  };

  if (mic)
  {
    constraints.audio['deviceId'] = { exact: mic };
  }
  console.warn('micC: ', mic, constraints);
  console.warn('请求麦克风权限...');
  
  return navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => 
    {
      pc.addTrack(stream.getAudioTracks()[0]);
      
      return pc.createOffer().then((offer) => 
      {
        return pc.setLocalDescription(offer);
      });        
    })
    .then(() => 
    {
      const offer = pc.localDescription;
        
      return fetch('https://dev.vsbc.com:9090/offer', {
        body : JSON.stringify({
          sdp  : offer.sdp,
          type : offer.type
        }),
        headers : {
          'Content-Type' : 'application/json'
        },
        method : 'POST'
      });
    })
    .then((response) => 
    {
      return response.json();
    })
    .then((answer) => 
    {
      // // document.getElementById('sessionid').value = answer.sessionid;

      // // 实例化 AudioStreamer，传入页面获取的参数
      // localAudio = new AudioStreamer('wss://dev.vsbc.com:9090/ws', answer.sessionid, 16000);

      // // 设置回调函数
      // localAudio.onError = (msg) => 
      // {
      //   console.warn(`[ERROR] ${msg}`);
      // };
      // localAudio.onClose = () => 
      // {
      //   console.warn('传输流程结束。');
      // };

      // // 启动
      // localAudio.start(flag);
      
      return pc.setRemoteDescription(answer);
    })
    .catch((e) => 
    {
      console.error(e);
    });
    
  
}

function start(flag, flag1) 
{
  console.warn('start');
  const config = {
    sdpSemantics       : 'unified-plan',
    iceTransportPolicy : 'relay'
  };

  // if (document.getElementById('use-stun').checked) 
  // {
  // config.iceServers = [{ urls: ['stun:stun.l.google.com:19302'] }];
  config.iceServers = [ { 'urls': 'turn:dev.vsbc.com:9001?transport=udp', 'username': 'test', 'credential': 'test' } ];
  // }

  pc = new RTCPeerConnection(config);

  // connect audio / video
  pc.addEventListener('track', (evt) => 
  {
    console.warn('track');
    if (evt.track.kind == 'video') 
    {
      if (flag1)
      {        
        document.getElementById('screen').srcObject = evt.streams[0];
      }
      else if (flag)
      {

        rtcSession.answer({
          mediaConstraints : {
            audio : false,
            video : true
          },
          pcConfig            : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
          // 被叫随路数据携带 X-Data，注意 'X' 大写及 ':' 后面的空格
          rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
          extraFeatures       : extraFeatures,
          mediaStream         : evt.streams[0]
        });

      }
      else
      {
        call(null, null, evt.streams[0]);
      }
    }
  });

  negotiate(useRnnoiseNode);
}
document.querySelector('#callMetaHuman').onclick= function()
{
  start();
};

document.querySelector('#metaHuman').onclick= function()
{
  start(null, true);
};

document.querySelector('#closeMetaHuman').onclick= function()
{
  if (pc)
  {
    pc.close();
    pc=undefined;
  }
};

/**
   * 自定义视频接听
   */
document.querySelector('#videoMetaHuman').onclick = async function()
{
  start(true);

  setStatus('mate human answer');
};

// function stop() 
// {
//   document.getElementById('stop').style.display = 'none';

//   // close peer connection
//   setTimeout(() => 
//   {
//     pc.close();
//   }, 500);
// }

// window.onunload = function(event) {
//     // 在这里执行你想要的操作
//     setTimeout(() => {
//         pc.close();
//     }, 500);
// };

window.onbeforeunload = function(e) 
{
  setTimeout(() => 
  {
    pc.close();
  }, 500);
  // e = e || window.event
  // // 兼容IE8和Firefox 4之前的版本
  // if (e) {
  //   e.returnValue = '关闭提示'
  // }
  // Chrome, Safari, Firefox 4+, Opera 12+ , IE 9+
  // return '关闭提示'
};