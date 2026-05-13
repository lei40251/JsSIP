/**
 * Small DOM helper for Mixer-owned media elements.
 */
function MixerDomAdapter(options)
{
  options = options || {};

  this._config = options.config;
  this._logger = options.logger;
}

MixerDomAdapter.prototype.createCanvas = function()
{
  const canvas = document.createElement('canvas');

  canvas.setAttribute('style', 'display:none');

  return canvas;
};

MixerDomAdapter.prototype.prepareModernCanvas = function(canvas)
{
  const width = this._config.width || 1280;
  const height = this._config.height || 720;

  // Setting canvas width/height clears it, so only touch dimensions when needed.
  if (canvas.width !== width)
  {
    canvas.width = width;
  }

  if (canvas.height !== height)
  {
    canvas.height = height;
  }
};

MixerDomAdapter.prototype.createVideoElement = function(mediaStream)
{
  const video = document.createElement('video');

  video.setAttribute('style', 'display:none');
  video.muted = true;
  video.autoplay = true;
  video.setAttribute('playsinline', '');
  video.srcObject = mediaStream && (mediaStream.mediaStream || mediaStream);
  video.play().catch((error) =>
  {
    const stream = video.srcObject;
    const streamId = stream && stream.id ? stream.id : 'unknown';

    this._logger.error(`video play error for stream ${streamId}: ${error.message || String(error)}`);
  });

  return video;
};

module.exports = MixerDomAdapter;
