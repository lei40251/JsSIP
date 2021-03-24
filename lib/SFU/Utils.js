
const Client = require('./Client');
const LocalStream = require('./LocalStream');

function webrtcSupportedCheck()
{
  return [ 'RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCIceGatherer' ].filter(function(e)
  {
    return e in window;
  }).length > 0;
}

function mediaDevicesSupportedCheck()
{
  if (!navigator.mediaDevices) return !1;
  const checks = [ 'getUserMedia', 'enumerateDevices' ];

  return checks.filter(function(e)
  {
    return e in navigator.mediaDevices;
  }).length === checks.length;
}

function videoEncodeSupportedCheck(value)
{
  const videoCodecs=new Map();

  RTCRtpSender.getCapabilities('video').codecs.forEach((codec) =>
  {
    videoCodecs.set(codec.mimeType.replace('video/', '').toLowerCase());
  });

  return videoCodecs.has(value);
}

function videoDecodeSupportedCheck(value)
{
  const videoCodecs=new Map();

  RTCRtpSender.getCapabilities('video').codecs.forEach((codec) =>
  {
    videoCodecs.set(codec.mimeType.replace('video/', '').toLowerCase());
  });

  return videoCodecs.has(value);
}

module.exports = {
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
    const isWebRTCSupported=webrtcSupportedCheck(),
      isMediaDevicesSupported = mediaDevicesSupportedCheck(),
      isH264EncodeSupported = videoEncodeSupportedCheck('h264'),
      isH264DecodeSupported = videoDecodeSupportedCheck('h264'),
      isVp8EncodeSupported = videoEncodeSupportedCheck('vp8'),
      isVp8DecodeSupported =videoDecodeSupportedCheck('vp8');

    const isSupported = isWebRTCSupported &&
    isMediaDevicesSupported &&
    isH264DecodeSupported &&
    isH264EncodeSupported &&
    isVp8DecodeSupported &&
    isVp8EncodeSupported;

    return { result : isSupported,
      detail : {
        // isBrowserSupported      : true,
        isWebRTCSupported       : isWebRTCSupported,
        isMediaDevicesSupported : isMediaDevicesSupported,
        isH264EncodeSupported   : isH264EncodeSupported,
        isH264DecodeSupported   : isH264DecodeSupported,
        isVp8EncodeSupported    : isVp8EncodeSupported,
        isVp8DecodeSupported    : isVp8DecodeSupported
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