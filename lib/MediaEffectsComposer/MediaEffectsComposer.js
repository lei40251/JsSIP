const ComposerRuntime = require('./ComposerRuntime');

class MediaEffectsComposer extends ComposerRuntime
{
  appendStream(videos, optionsOrSlot)
  {
    return this.addSource(videos, optionsOrSlot);
  }

  removeStream(streamOrId)
  {
    return this.removeSource(streamOrId);
  }

  clearStreams()
  {
    this.clearSources();
  }
}

module.exports = MediaEffectsComposer;
