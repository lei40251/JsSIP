// const debug = require('debug')('FlyInn:LocalStream');
// const debugerror = require('debug')('FlyInn:ERROR:LOCALSTREAM');
const { Base64 } = require('js-base64');
const Stream = require('./Stream');

/**
 * 远端媒体对象
 *
 * @class RemoteStream
 * @extends {Stream}
 */
class RemoteStream extends Stream
{
  constructor(track)
  {
    super(track);

    // this._stream = new MediaStream();
    this._id = track.id;
    this._type = track.kind;
    this._cname = null;

    if (track.kind === 'video' && track.readyState !== 'ended')
    {
      // 媒体结束播放触发移除事件
      track.onended = () =>
      {
        this.emit('stream-removed');
      };

      this._stream.addTrack(track);
    }
    else if (track.kind === 'audio' && track.readyState !== 'ended')
    {
      this._stream.addTrack(track);
    }
  }

  /**
   * 媒体类型
   *
   * @readonly
   * @memberof RemoteStream
   */
  get type()
  {
    return this._type;
  }

  /**
   * 用户ID
   *
   * @readonly
   * @memberof RemoteStream
   */
  get userId()
  {
    return this._cname.userid || '';
  }

  /**
   * 用户显示名
   *
   * @readonly
   * @memberof RemoteStream
   */
  get display_name()
  {
    return this._cname.dn ? Base64.decode(this._cname.dn) : '';
  }

  set cname(str)
  {
    this._cname = str;
  }
}

module.exports = RemoteStream;