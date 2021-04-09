const { EventEmitter } = require('events');

// const debug = require('debug')('FlyInn:Stream');
// const debugerror = require('debug')('FlyInn:ERROR:STREAM');

/**
 * LocalStream 和 RemoteStream 的基类
 *
 * @class Stream
 * @extends {EventEmitter}
 */
class Stream extends EventEmitter
{
  constructor()
  {
    super();
    this._stream = new MediaStream();

    this._id = null;
    this._type = null;
  }

  /**
   * @member {string} id - Stream唯一标识ID
   * @readonly
   * @memberof Stream
   */
  get id()
  {
    return this._id;
  }

  /**
   * @member {MediaStream} stream - 音视频流
   * @readonly
   * @memberof Stream
   */
  get stream()
  {
    return this._stream;
  }

  /**
   * 禁用视频轨道
   *
   * @return {boolean}
   * @memberof Stream
   */
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

  /**
   * 启用视频轨道
   *
   * @return {boolean}
   * @memberof Stream
   */
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

  /**
   * 禁用音频轨道,远端音频混流仅支持禁用全部音频
   *
   * @return {boolean}
   * @memberof Stream
   */
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

  /**
   * 启用音频轨道,远端音频混流仅支持启用全部音频
   *
   * @return {boolean}
   * @memberof Stream
   */
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
}

module.exports = Stream;