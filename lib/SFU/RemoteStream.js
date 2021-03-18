// const debug = require('debug')('FlyInn:LocalStream');
// const debugerror = require('debug')('FlyInn:ERROR:LOCALSTREAM');
const { Base64 } = require('js-base64');
const Stream = require('./Stream');

module.exports = class RemoteStream extends Stream
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

  get type()
  {
    return this._type;
  }

  get userId()
  {
    return this._cname.userid || '';
  }

  get dn()
  {
    return this._cname.dn ? Base64.decode(this._cname.dn) : '';
  }

  set cname(str)
  {
    this._cname = str;
  }
};