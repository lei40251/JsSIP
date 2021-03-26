const debug = require('debug')('FlyInn:LocalStream');
const debugerror = require('debug')('FlyInn:ERROR:LOCALSTREAM');

const Stream = require('./Stream');

const videoProfile ={
  '120p'  : { width: { ideal: 160 }, height: { ideal: 120 }, frameRate: 15, bitrate: 200 },
  '180p'  : { width: { ideal: 320 }, height: { ideal: 180 }, frameRate: 15, bitrate: 350 },
  '240p'  : { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: 15, bitrate: 400 },
  '360p'  : { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: 15, bitrate: 800 },
  '480p'  : { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: 15, bitrate: 900 },
  '720p'  : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: 15, bitrate: 1500 },
  '1280p' : { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: 15, bitrate: 2000 }
};

const audioProfile ={
  standard : { channelCount: 1, bitrate: 40 },
  high     : { channelCount: 1, bitrate: 128 }
};

const hints=[ 'motion', 'detail', 'text' ];

/**
 * 本地媒体对象，可以通过createStream创建
 *
 * @param {object} streamConfig - 注意：本参数未启用
 * @param {string} streamConfig.user_id - 用户ID
 * @param {string} streamConfig.audio - 是否采集麦克风
 * @param {string} streamConfig.video - 是否采集摄像头视频
 * @param {string} streamConfig.microphone_id - 音频输入设备 deviceId，可通过 getMicrophones()获取
 * @param {string} streamConfig.camera_id - 摄像头的 deviceId, 可通过 getCameras() 获取
 * @param {string} streamConfig.facing_mode - 'user':前置摄像头，'environment':后置摄像头，请勿同时使用 camrea_id 和 facing_ode
 * @param {string} streamConfig.screen - 是否采用屏幕分享
 * @param {string} streamConfig.videoSource - 视频源
 * @param {string} streamConfig.audioSource - 音频源
 * @param {string} streamConfig.mirror - 视频是否镜像，不适用于屏幕分享
 * @class LocalStream
 * @extends {Stream}
 */
class LocalStream extends Stream
{
  constructor(streamConfig, tracks)
  {
    super();

    this._userId = streamConfig.user_id;
    this._audio = streamConfig.audio;
    this._microphoneId = streamConfig.microphone_id;
    this._video = streamConfig.video;
    this._cameraId = streamConfig.camera_id;
    this._facingMode = streamConfig.facing_mode;
    this._screen = streamConfig.screen;
    this._screenAudio = streamConfig.screen_audio;
    this._audioSource = streamConfig.audioSource;
    this._videoSource = streamConfig.videoSource;
    this._mirror = streamConfig.mirror;

    this._session = null;
    this._custom = false;
    this._audioBitrate = null;
    this._videoBitrate = null;

    this._id = this._stream.id;
    if (tracks)
    {
      tracks.forEach((track) =>
      {
        if (track.readyState !== 'ended')
        {
          this._stream.addTrack(track);
        }
      });
    }
  }

  set session(value)
  {
    this._session = value;
  }

  /**
   * @readonly
   * @memberof LocalStream
   */
  get userId()
  {
    return this._userId;
  }

  get custom()
  {
    return this._custom;
  }

  set custom(value)
  {
    this._custom = value;
  }

  /**
   * 初始化本地音视频对象
   *
   * @return {Promise}
   * @memberof LocalStream
   */
  initialize()
  {
    debug('initialize()');

    return navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then((stream) =>
      {
        this._stream = stream;

        return stream;
      })
      .catch((error) =>
      {
        // this._failed('local', null, JsSIP_C.causes.USER_DENIED_MEDIA_ACCESS);
        debugerror('emit "getusermediafailed" [error:%o]', error);
        // this.emit('getusermediafailed', error);
        throw error;
      });
  }

  /**
   * 设置音频 Profile
   *
   * @param {string} [profile=standard] -  码率: 'standard':40kbps; 'high':128kbps
   * @memberof LocalStream
   */
  setAudioProfile(profile='standard')
  {
    if (typeof profile === 'string')
    {
      if (this._session.connection)
      {
        const senders = this._session.connection.getSenders();

        senders.forEach((sender) =>
        {
          if (sender.track&&sender.track.kind === 'audio')
          {
            const parameters = sender.getParameters();

            parameters.encodings[0].maxBitrate = profile.bitrate*1024;
            sender.setParameters(parameters);
          }
        });
      }
      else
      {
        this._audioBitrate = audioProfile[profile].bitrate;
      }

      if (this.stream)
      {
        return this.stream.getAudioTracks()[0].applyConstraints(audioProfile[profile])
          .then(() =>
          {
            return true;
          })
          .catch(() =>
          {
            return false;
          });
      }
    }
  }

  /**
   * 设置视频 Profile
   *
   * @param {string|object} [profile=480p] - 详见profile对照表
   * @param {string} profile.width - 视频宽度
   * @param {string} profile.height - 视频高度
   * @param {string} profile.frameRate - 帧率
   * @param {string} profile.bitrate - 比特率 kbps
   * @return {Promise}
   * @memberof LocalStream
   */
  setVideoProfile(profile='480p')
  {
    if (typeof profile === 'object')
    {
      if (this._session.connection)
      {
        const senders = this._session.connection.getSenders();

        senders.forEach((sender) =>
        {
          if (sender.track&&sender.track.kind === 'video')
          {
            const parameters = sender.getParameters();

            parameters.encodings[0].maxBitrate = profile.bitrate*1024;
            sender.setParameters(parameters);
          }
        });
      }
      else
      {
        this._videoBitrate = profile.bitrate;
      }

      if (this.stream)
      {
        return this.stream.getVideoTracks()[0].applyConstraints(profile)
          .then(() =>
          {
            return true;
          })
          .catch(() =>
          {
            return false;
          });
      }
    }
    else if (typeof profile === 'string')
    {
      if (this._session.connection)
      {
        const senders = this._session.connection.getSenders();

        senders.forEach((sender) =>
        {
          if (sender.track&&sender.track.kind === 'video')
          {
            const parameters = sender.getParameters();

            parameters.encodings[0].maxBitrate = videoProfile[profile].bitrate*1024;
            sender.setParameters(parameters);
          }
        });
      }
      else
      {
        this._videoBitrate = videoProfile[profile].bitrate;
      }

      if (this.stream)
      {
        return this.stream.getVideoTracks()[0].applyConstraints(videoProfile[profile])
          .then(() =>
          {
            return true;
          })
          .catch(() =>
          {
            return false;
          });
      }
    }
  }

  /**
   * 设置视频内容提示
   *
   * @param {string} [hint=motion] - 'motion', 'detail', 'text'
   * @return {boolean}
   * @memberof LocalStream
   */
  setVideoContentHint(hint='motion')
  {
    if (hints.indexOf(hint))
    {
      const tracks = this._stream.getTracks();

      tracks.forEach((track) =>
      {
        if ('contentHint' in track)
        {
          track.contentHint=hint;
        }
        else
        {
          return false;
        }
      });

      return true;
    }
  }

  /**
   * 关闭本地音视频流，释放麦克风和摄像头
   *
   * @memberof LocalStream
   */
  close()
  {
    Promise.resolve()
      .then(() =>
      {
        this.stream.getTracks().forEach((track) =>
        {
          track.stop();
        });
      })
      .then(() =>
      {
        /**
         * 本地媒体已关闭事件
         *
         * @event LocalStream#STOPPED
         */
        this.emit('stopped');
      })
      .catch((e) =>
      {
        /**
         * 错误事件
         *
         * @event LocalStream#CLOSE-FAILED
         * @property {object} data
         */
        this.emit('close-failed', e);
      });
  }

  /**
   * 切换视频输入设备
   *
   * @param {object} [options={}]
   * @param {object|string} options.deviceId - 设备ID
   * @param {string} options.deviceId.exact - 强制使用的设备ID
   * @return {stream}
   * @memberof LocalStream
   */
  switchDevice(options={})
  {
    return this._session.switchCam(options)
      .then((s) =>
      {
        this._stream = s;

        return s;
      });
  }
}

module.exports = LocalStream;