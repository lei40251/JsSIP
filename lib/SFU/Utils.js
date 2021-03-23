
const Client = require('./Client');
const LocalStream = require('./LocalStream');

function webrtcSupportedCheck()
{
  return [ 'RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCIceGatherer' ].filter(function(e)
  {
    return e in window;
  }).length > 0;
}

function mediaDevicesSupported()
{
  if (!navigator.mediaDevices) return !1;
  const checks = [ 'getUserMedia', 'enumerateDevices' ];

  return checks.filter(function(e)
  {
    return e in navigator.mediaDevices;
  }).length === checks.length;
}

function videoEncodeSupported(value)
{
  const videoCodecs=new Map();

  RTCRtpSender.getCapabilities('video').codecs.forEach((codec) =>
  {
    videoCodecs.set(codec.mimeType.replace('video/', '').toLowerCase());
  });

  return videoCodecs.has(value);
}

function videoDecodeSupported(value)
{
  const videoCodecs=new Map();

  RTCRtpSender.getCapabilities('video').codecs.forEach((codec) =>
  {
    videoCodecs.set(codec.mimeType.replace('video/', '').toLowerCase());
  });

  return videoCodecs.has(value);
}

module.exports= {
  createClient : (clientConfig) =>
  {
    return new Client(clientConfig);
  },

  createStream : (streamConfig) =>
  {
    return new LocalStream(streamConfig);
  },

  checkSystemRequirements : () =>
  {

    return { result : true,
      detail : {
        isBrowserSupported      : true,
        isWebRTCSupported       : webrtcSupportedCheck(),
        isMediaDevicesSupported : mediaDevicesSupported(),
        isH264EncodeSupported   : videoEncodeSupported('h264'),
        isH264DecodeSupported   : videoDecodeSupported('h264'),
        isVp8EncodeSupported    : videoEncodeSupported('vp8'),
        isVp8DecodeSupported    : videoDecodeSupported('vp8')
      }
    };
  },

  isScreenShareSupported : () =>
  {
    return Boolean(navigator.mediaDevices.getDisplayMedia);
  },

  getDevices : () =>
  {
    return Promise.resolve()
      .then(() =>
      {
        return navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      })
      .then((stream) =>
      {
        stream.getTracks().forEach((track) =>
        {
          track.stop();
        });

        return navigator.mediaDevices.enumerateDevices();
      })
      .catch((e) => { return e; });
  },

  getCameras : () =>
  {
    return Promise.resolve()
      .then(() =>
      {
        return navigator.mediaDevices.getUserMedia({ video: true });
      })
      .then((stream) =>
      {
        stream.getTracks().forEach((track) =>
        {
          track.stop();
        });

        return navigator.mediaDevices.enumerateDevices();
      })
      .then((devices) =>
      {
        return devices.filter((dev) => { return dev.kind==='videoinput'; });
      })
      .catch((e) => { return e; });
  },

  getMicrophones : () =>
  {
    return Promise.resolve()
      .then(() =>
      {
        return navigator.mediaDevices.getUserMedia({ audio: true });
      })
      .then((stream) =>
      {
        stream.getTracks().forEach((track) =>
        {
          track.stop();
        });

        return navigator.mediaDevices.enumerateDevices();
      })
      .then((devices) =>
      {
        return devices.filter((dev) => { return dev.kind==='audioinput'; });
      })
      .catch((e) => { return e; });
  },

  getSpeakers : () =>
  {
    return Promise.resolve()
      .then(() =>
      {
        return navigator.mediaDevices.getUserMedia({ audio: true });
      })
      .then((stream) =>
      {
        stream.getTracks().forEach((track) =>
        {
          track.stop();
        });

        return navigator.mediaDevices.enumerateDevices();
      })
      .then((devices) =>
      {
        return devices.filter((dev) => { return dev.kind==='audiooutput'; });
      })
      .catch((e) => { return e; });
  }
};