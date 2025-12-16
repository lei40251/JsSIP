function negotiate() 
{
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });

    
  return pc.createOffer().then((offer) => 
  {
    return pc.setLocalDescription(offer);
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
      // document.getElementById('sessionid').value = answer.sessionid;

      // 实例化 AudioStreamer，传入页面获取的参数
      localAudio = new AudioStreamer('wss://dev.vsbc.com:9090/ws', answer.sessionid, 16000);

      // 设置回调函数
      localAudio.onError = (msg) => 
      {
        console.warn(`[ERROR] ${msg}`);
      };
      localAudio.onClose = () => 
      {
        console.warn('传输流程结束。');
      };

      // 启动
      localAudio.start();
      
      return pc.setRemoteDescription(answer);
    })
    .catch((e) => 
    {
      console.error(e);
    });
}

function start(flag) 
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
      if (flag)
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
      // document.getElementById('video').srcObject = evt.streams[0];
    }
  });

  negotiate();
}
document.querySelector('#callMetaHuman').onclick= function()
{
  start();
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