
const Client = require('./Client');
const LocalStream = require('./LocalStream');
const pkg = require('../../package.json');

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

/**
 * @module PRTC
 */

module.exports = {
  /**
   * @type {string} - SDK 版本号
   */
  version : pkg.version,

  /**
  * 检测浏览器是否支持 WebRTC 相关属性、方法等
  *
  * @returns {object} data
  * data.result - 检测结果
  * data.detail - 检测详情
  * data.detail.isWebRTCSupported - 当前浏览器是否支持 webRTC
  * data.detail.isMediaDevicesSupported - 当前浏览器是否支持获取媒体设备及媒体流
  * data.detail.isH264EncodeSupported - 当前浏览器上行是否支持 H264 编码
  * data.detail.isH264DecodeSupported - 当前浏览器下行是否支持 H264 编码
  * data.detail.isVp8EncodeSupported - 当前浏览器上行是否支持 VP8 编码
  * data.detail.isVp8DecodeSupported - 当前浏览器下行是否支持 VP8 编码
  *
  */
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

  /**
  * 浏览器是否支持屏幕分享
  * @return {boolean}.
  */
  isScreenShareSupported : () =>
  {
    return Boolean(navigator.mediaDevices.getDisplayMedia);
  },

  /**
  * 获取全部媒体输入、输出设备
  * @return {Promise.<Array.<MediaDeviceInfo>>}
  */
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

  /**
  * 获取全部摄像头列表
  * @return {Promise.<Array.<MediaDeviceInfo>>}
  */
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

  /**
  * 获取全部麦克风
  * @return {Promise.<Array.<MediaDeviceInfo>>}
  */
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

  /**
  * 获取全部扬声器列表
  * @return {Promise.<Array.<MediaDeviceInfo>>}
  */
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
  },

  /**
  * 创建 Client 客户端对象
  * @param {object} clientConfig - 详细内容见 Client
  * @return {Client} - 客户端对象.
  */
  createClient : (clientConfig) =>
  {
    return new Client(clientConfig);
  },

  /**
   * 创建本地流对象，可以通过 客户端对象的 join 方法使用本流入会
   * @param {object} streamConfig - 详细内容见 LocalStream
   * @return {LocalStream} - 客户端对象.
   */
  createStream : (streamConfig) =>
  {
    return new LocalStream(streamConfig);
  }

};