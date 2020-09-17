const EventEmitter = require('events').EventEmitter;
const debug = require('debug')('FlyInn:RTCSession');
const debugerror = require('debug')('FlyInn:ERROR:WebRTC:SwitchCam');

debugerror.log = console.warn.bind(console);
const Exceptions = require('../Exceptions');

module.exports = class SwitchCam extends EventEmitter
{
  constructor(session)
  {
    super();

    this._session = session;
    this._mediaConstraints = {};
    this._cams = [];
    this._camIdx = 0;
    this._shouldFaceUser = true;

    this._initDevices();
  }

  get cams()
  {
    return this._cams;
  }

  /**
   * 切换视频流
   *
   * @param {*} videoStream 要切换的新视频流
   * @returns 新的本地流
   */
  switchVideoStream(videoStream, videoConstraints)
  {
    debug('switchVideoStream()');

    if (videoConstraints)
    {
      this._mediaConstraints = { video: videoConstraints };
    }
    else
    {
      this._mediaConstraints = { video: true };
    }

    // Check Session Status.
    if (
      this._session.status !== this._session.C.STATUS_CONFIRMED &&
      this._session.status !== this._session.C.STATUS_WAITING_FOR_ACK
    )
    {
      throw new Exceptions.InvalidStateError(this._status);
    }

    if (videoStream)
    {
      this._switchStream(videoStream);
    }
    else
    {
      this._shouldFaceUser = !this._shouldFaceUser;
      if (this._getSupportedConstraints('facingMode') === true)
      {
        this._mediaConstraints.video['facingMode'] = this._shouldFaceUser ? 'user' : 'environment';
      }
      else if (this._cams.length < 2)
      {
        // this._mediaConstraints.video = true;
        return;
      }
      else if (this._cams.length === 2)
      {
        this._mediaConstraints.video['deviceId'] = { exact: this._shouldFaceUser ? this._cams[0] : this._cams[1] };
      }
      else if (this._cams.length > 2)
      {
        if (this._camIdx + 1 < this._cams.length)
        {
          this._camIdx += 1;
        }
        else
        {
          this._camIdx = 0;
        }
        this._mediaConstraints.video['deviceId'] = { exact: this._cams[this._camIdx] };
      }

      return Promise.resolve()
        .then(() =>
        {
          this._session._connection.getSenders().find((s) =>
          {
            if (s.track.kind == 'video')
            {
              s.track.stop();
            }
          });

          this._localMediaStreamLocallyGenerated = true;

          return navigator.mediaDevices
            .getUserMedia(this._mediaConstraints)
            .catch((error) =>
            {
              debugerror('emit "getusermediafailed" [error:%o]', error);
              this.emit('getusermediafailed', error);
              throw new Error('getUserMedia() failed');
            });
        })
        .then((mediaStream) =>
        {
          this._switchStream(mediaStream);

          return mediaStream;
        });
    }
  }

  // 停止原视频轨道，替换为新的视频轨道
  _switchStream(videoStream)
  {
    videoStream.getVideoTracks().forEach((track) =>
    {
      this._session._connection.getSenders().find((s) =>
      {
        if (s.track.kind == 'video')
        {
          s.track.stop();
          s.replaceTrack(track);
        }
      });
    });
  }

  // 约束支持情况
  _getSupportedConstraints(constraint)
  {
    // return true or false.
    if (navigator.mediaDevices)
    {
      const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();

      return supportedConstraints.hasOwnProperty(constraint);
    }
    else
    {
      return false;
    }
    // return Promise.resolve()
    //   .then(() => {
    //     return navigator.mediaDevices.getSupportedConstraints();
    //   })
    //   .then((supportedConstraints) => {
    //     return supportedConstraints.hasOwnProperty(constraint);
    //   },
    //   (error) => {
    //     debugerror('emit "getSupportedConstraints" [error:%o]', error);

    //     this.emit('getSupportedConstraints', error);

    //     throw new Error('getSupportedConstraints() failed');
    //   });
  }

  // 获取设备列表
  _initDevices()
  {
    // 如果浏览器支持 facingMode 则不需要再获取设备列表
    if (this._getSupportedConstraints('facingMode') === true)
    {
      return;
    }

    return (
      Promise.resolve()
        // Handle local MediaStream.
        .then(() =>
        {
          try
          {
            return navigator.mediaDevices
              .getUserMedia({ audio: true, video: true });
          }
          catch (error)
          {
            debugerror('emit "getusermediafailed" [error:%o]', error);

            this.emit('getusermediafailed', error);

            throw new Error('getUserMedia() failed');
          }
        })
        .then((mediaStream) =>
        {
          mediaStream.getTracks().forEach((track) =>
          {
            track.stop();
          });

          return navigator.mediaDevices.enumerateDevices()
            .catch((error) =>
            {
              debugerror('emit "enumerateDevices" [error:%o]', error);

              this.emit('enumerateDevices', error);

              throw new Error('enumerateDevices() failed');
            });
        })
        .then((mediaDevices) =>
        {
          mediaDevices.forEach((mediaDevice) =>
          {
            if (mediaDevice.kind === 'videoinput')
            {
              this._cams.push(mediaDevice.deviceId);
            }
          });
        })
    );
  }
};