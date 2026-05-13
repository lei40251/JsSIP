/**
 * Owns canvas captureStream outputs and mixed stream track composition.
 */
function OutputStreamManager(options)
{
  options = options || {};

  this._canvas = options.canvas;
  this._config = options.config;
  this._logger = options.logger;

  this._mixedStream = null;
  this._capturedStreams = [];
  this._capturedStream = null;
  this._videoStream = null;
}

OutputStreamManager.prototype.hasLiveVideoStream = function()
{
  return Boolean(
    this._videoStream &&
    this._videoStream.getVideoTracks().some((track) => track.readyState === 'live')
  );
};

OutputStreamManager.prototype.getVideoStream = function(drawFirstFrame)
{
  if (this.hasLiveVideoStream())
  {
    return this._videoStream;
  }

  drawFirstFrame();

  const videoStream = new MediaStream();
  const capturedStream = this._config.fps ? this._canvas.captureStream(this._config.fps) : this._canvas.captureStream();

  capturedStream.getVideoTracks().forEach((track) =>
  {
    if (this._logger)
    {
      this._logger.debug('track: ', track.id, track.enabled, track.readyState);
    }

    videoStream.addTrack(track);
  });

  this._canvas.stream = capturedStream;
  this._capturedStream = capturedStream;
  this._videoStream = videoStream;
  this._capturedStreams.push(capturedStream);

  return this._videoStream;
};

OutputStreamManager.prototype.setMixedStream = function(stream)
{
  this._mixedStream = stream;
};

OutputStreamManager.prototype.addAudioTracksToStream = function(targetStream, audioStream)
{
  if (!targetStream || !audioStream)
  {
    return;
  }

  audioStream.getAudioTracks().forEach((track) =>
  {
    if (!targetStream.getAudioTracks().some((item) => item.id === track.id))
    {
      targetStream.addTrack(track);
    }
  });
};

OutputStreamManager.prototype.ensureMixedStreamAudioTrack = function(audioStream)
{
  if (!this._mixedStream || !audioStream || this._mixedStream.getAudioTracks().length > 0)
  {
    return;
  }

  audioStream.getAudioTracks().forEach((track) =>
  {
    this._mixedStream.addTrack(track);
  });
};

OutputStreamManager.prototype.stop = function()
{
  this._mixedStream = null;
  this._videoStream = null;
  this._capturedStream = null;

  this._capturedStreams.forEach((stream) =>
  {
    stream.getTracks().forEach((track) =>
    {
      track.stop();
    });
  });

  this._capturedStreams = [];
  this._canvas.stream = null;
};

Object.defineProperties(OutputStreamManager.prototype, {
  mixedStream : {
    get : function()
    {
      return this._mixedStream;
    }
  },
  capturedStreams : {
    get : function()
    {
      return this._capturedStreams;
    }
  },
  capturedStream : {
    get : function()
    {
      return this._capturedStream;
    }
  },
  videoStream : {
    get : function()
    {
      return this._videoStream;
    }
  }
});

module.exports = OutputStreamManager;
