/**
 * Mixer input source registry.
 */
function SourceRegistry(options)
{
  options = options || {};

  this._logger = options.logger;
  this._getLayoutMode = options.getLayoutMode;
  this._getDefaultGain = options.getDefaultGain;
  this._normalizeGain = options.normalizeGain;
  this._createVideoElement = options.createVideoElement;
  this._onBeforeRemove = options.onBeforeRemove;
  this._onAfterRemove = options.onAfterRemove;

  this.sources = [];
  this.videos = [];
  this._sourceSeq = 0;
}

SourceRegistry.prototype.add = function(input, options)
{
  const source = this._createSource(input, options || {});

  if (this._getLayoutMode() !== 'legacy' && typeof source.slot === 'number')
  {
    const oldSource = this.sources.find((item) => item.slot === source.slot);

    if (oldSource)
    {
      if (this._logger)
      {
        this._logger.warn(`Slot ${source.slot} overwritten.`);
      }

      this.remove(oldSource);
    }
  }

  this.sources.push(source);
  this._syncVideos();

  return source;
};

SourceRegistry.prototype.clear = function()
{
  this.sources.slice().forEach((source) =>
  {
    this.remove(source);
  });
};

SourceRegistry.prototype.find = function(streamOrId)
{
  if (!streamOrId)
  {
    return null;
  }

  if (typeof streamOrId === 'string')
  {
    return this.sources.find((source) =>
    {
      const stream = this.getStream(source);

      return source.id === streamOrId || (stream && stream.id === streamOrId);
    }) || null;
  }

  const stream = streamOrId.mediaStream || streamOrId;

  return this.sources.find((source) =>
  {
    return source.stream === stream || source.video === streamOrId;
  }) || null;
};

SourceRegistry.prototype.remove = function(source)
{
  if (!source)
  {
    return false;
  }

  if (this._onBeforeRemove)
  {
    this._onBeforeRemove(source);
  }

  if (source.ownedVideo && source.video)
  {
    source.video.pause();
    source.video.srcObject = null;
    source.video.remove();
  }

  const index = this.sources.indexOf(source);

  if (index !== -1)
  {
    this.sources.splice(index, 1);
  }

  this._syncVideos();

  if (this._onAfterRemove)
  {
    this._onAfterRemove(source);
  }

  return true;
};

SourceRegistry.prototype.getSnapshot = function()
{
  return this.sources.map((source) =>
  {
    const stream = this.getStream(source);

    return {
      id       : source.id,
      streamId : stream ? stream.id : null,
      slot     : source.slot,
      gain     : source.gain,
      hasAudio : this.hasLiveAudioTrack(source),
      hasVideo : this.hasVideoTrack(source)
    };
  });
};

SourceRegistry.prototype.getStream = function(source)
{
  const stream = source.video && !source.ownedVideo ? source.video.srcObject : source.stream;

  if (source.stream !== stream)
  {
    source.stream = stream;
  }

  return stream;
};

SourceRegistry.prototype.hasAnyLiveAudioTrack = function()
{
  return this.sources.some((source) => this.hasLiveAudioTrack(source));
};

SourceRegistry.prototype.hasLiveAudioTrack = function(source)
{
  const stream = this.getStream(source);

  return Boolean(
    stream &&
    stream.getAudioTracks &&
    stream.getAudioTracks().some((track) => track.readyState === 'live')
  );
};

SourceRegistry.prototype.hasVideoTrack = function(source)
{
  const stream = this.getStream(source);

  return Boolean(
    stream &&
    stream.getVideoTracks &&
    stream.getVideoTracks().length > 0
  );
};

SourceRegistry.prototype.isRenderable = function(source)
{
  const stream = this.getStream(source);

  return Boolean(
    stream &&
    stream.active &&
    this.hasVideoTrack(source)
  );
};

SourceRegistry.prototype._createSource = function(input, options)
{
  let video;
  let stream;
  let ownedVideo = false;

  if (input instanceof HTMLMediaElement)
  {
    video = input;
    stream = input.srcObject;
  }
  else
  {
    stream = input && (input.mediaStream || input);

    if (!stream)
    {
      throw new TypeError('Invalid MediaStream.');
    }

    video = this._createVideoElement(stream);
    ownedVideo = true;
  }

  const source = {
    id              : this._createSourceId(stream, video),
    stream          : stream,
    video           : video,
    slot            : typeof options.slot === 'number' ? options.slot : null,
    gain            : this._normalizeGain(options.gain, this._getDefaultGain()),
    audioSourceNode : null,
    gainNode        : null,
    audioStream     : null,
    ownedVideo      : ownedVideo
  };

  if (this._getLayoutMode() !== 'legacy' && source.slot === null)
  {
    source.slot = this._getNextSlot();
  }

  return source;
};

SourceRegistry.prototype._createSourceId = function(stream, video)
{
  const baseId = (stream && stream.id) || video.id || `mixer-source-${this._sourceSeq + 1}`;
  let sourceId = baseId;

  while (this.sources.some((source) => source.id === sourceId))
  {
    this._sourceSeq += 1;
    sourceId = `${baseId}-${this._sourceSeq}`;
  }

  return sourceId;
};

SourceRegistry.prototype._getNextSlot = function()
{
  let slot = 0;
  const occupiedSlots = this.sources.reduce((slots, source) =>
  {
    if (typeof source.slot === 'number')
    {
      slots[source.slot] = true;
    }

    return slots;
  }, {});

  while (occupiedSlots[slot])
  {
    slot += 1;
  }

  return slot;
};

SourceRegistry.prototype._syncVideos = function()
{
  this.videos.splice(0, this.videos.length);

  this.sources.forEach((source) =>
  {
    this.videos.push(source.video);
  });
};

module.exports = SourceRegistry;
