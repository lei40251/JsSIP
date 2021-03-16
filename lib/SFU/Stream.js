const { EventEmitter } = require('events');

// const debug = require('debug')('FlyInn:Stream');
// const debugerror = require('debug')('FlyInn:ERROR:STREAM');
module.exports = class Stream extends EventEmitter
{
  constructor()
  {
    super();
    this._stream = new MediaStream();
    this._id = null;
    this._type = null;
  }

  get id()
  {
    return this._id;
  }

  get stream()
  {
    return this._stream;
  }

  muteVideo()
  {
    const videoTracks = this._stream.getVideoTracks();

    if (videoTracks.length > 0)
    {
      this._stream.getVideoTracks()[0].enabled = false;

      return true;
    }
    else
    {
      return false;
    }
  }

  unmuteVideo()
  {
    const videoTracks = this._stream.getVideoTracks();

    if (videoTracks.length > 0)
    {
      this._stream.getVideoTracks()[0].enabled = true;

      return true;
    }
    else
    {
      return false;
    }
  }

  muteAudio()
  {
    const audioTracks = this._stream.getAudioTracks();

    if (audioTracks.length > 0)
    {
      this._stream.getAudioTracks()[0].enabled = false;

      return true;
    }
    else
    {
      return false;
    }
  }

  unmuteAudio()
  {
    const audioTracks = this._stream.getAudioTracks();

    if (audioTracks.length > 0)
    {
      this._stream.getAudioTracks()[0].enabled = true;

      return true;
    }
    else
    {
      return false;
    }
  }
};