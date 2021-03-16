// const JsSIP_C = require('./../Constants');
const debug = require('debug')('FlyInn:LocalStream');
const debugerror = require('debug')('FlyInn:ERROR:LOCALSTREAM');

const Stream = require('./Stream');

module.exports = class LocalStream extends Stream
{
  constructor(streamConfig, tracks)
  {
    super();

    this._userId = streamConfig.user_id;
    this._audio = streamConfig.audio;
    this._microphoneId = streamConfig._microphone_id;
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

  get custom()
  {
    return this._custom;
  }

  set custom(value)
  {
    this._custom = value;
  }

  initialize()
  {
    debug('initalize()');

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
        this.emit('getusermediafailed', error);
        throw error;
      });
  }

  switchDevice()
  {
    return this._session.switchCam({})
      .then((s) =>
      {
        this._stream = s;

        return s;
      });
  }
};