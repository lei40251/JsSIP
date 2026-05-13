/**
 * WebAudio mixer for MediaStreamMixer sources.
 */
function AudioMixer(options)
{
  options = options || {};

  this._logger = options.logger;
  this._getDestroyed = options.getDestroyed;
  this._sourceRegistry = options.sourceRegistry;
  this._onAudioTrackAvailable = options.onAudioTrackAvailable;

  this._audioSources = [];
  this._audioDestination = null;
  this._audioContext = null;
  this._audioRequested = false;
  this._audioRefreshPromise = null;
  this._audioRefreshPending = false;
  this._audioInfo = {
    requested        : false,
    status           : 'not-requested',
    contextState     : null,
    sourceCount      : 0,
    liveSourceCount  : 0,
    connectedSources : 0,
    outputTracks     : 0,
    reason           : '',
    lastError        : ''
  };
}

AudioMixer.prototype.getAudioStream = function()
{
  this._audioRequested = true;
  this._updateAudioInfo({
    status : 'requested',
    reason : ''
  });

  return this._refreshAudioConnections();
};

AudioMixer.prototype.scheduleRefresh = function()
{
  if (!this._audioRequested || this._getDestroyed())
  {
    return;
  }

  if (this._audioRefreshPromise)
  {
    this._audioRefreshPending = true;

    return;
  }

  this._audioRefreshPromise = this._refreshAudioConnections()
    .catch((error) =>
    {
      this._logger.warn(`Failed to refresh mixed audio: ${error.message || String(error)}`);
      this._updateAudioInfo({
        status    : 'failed',
        reason    : 'Failed to refresh mixed audio',
        lastError : error.message || String(error)
      });
    })
    .then((stream) =>
    {
      const needsAnotherRefresh = this._audioRefreshPending;

      this._audioRefreshPromise = null;
      this._audioRefreshPending = false;

      if (needsAnotherRefresh)
      {
        this.scheduleRefresh();
      }

      return stream || null;
    });
};

AudioMixer.prototype.syncExternalSourceAudio = function()
{
  if (!this._audioRequested && !this._audioContext)
  {
    return;
  }

  let needsRefresh = false;

  this._sourceRegistry.sources.forEach((source) =>
  {
    const previousStream = source.stream;
    const currentStream = this._sourceRegistry.getStream(source);

    if (source.audioSourceNode && source.audioStream !== currentStream)
    {
      this.disconnectSource(source);
      needsRefresh = true;

      return;
    }

    if (currentStream && currentStream !== previousStream && this._sourceRegistry.hasLiveAudioTrack(source))
    {
      needsRefresh = true;
    }
  });

  if (needsRefresh)
  {
    this.scheduleRefresh();
  }
};

AudioMixer.prototype.disconnectSource = function(source)
{
  const audioSourceNode = source.audioSourceNode;

  if (source.gainNode)
  {
    source.gainNode.disconnect();
    source.gainNode = null;
  }

  if (source.audioSourceNode)
  {
    source.audioSourceNode.disconnect();
    source.audioSourceNode = null;
  }

  source.audioStream = null;

  if (audioSourceNode)
  {
    this._audioSources = this._audioSources.filter((sourceNode) => sourceNode !== audioSourceNode);
  }
};

AudioMixer.prototype.getInfo = function()
{
  this._updateAudioInfo();

  return Object.assign({}, this._audioInfo);
};

AudioMixer.prototype.stop = function()
{
  if (this._audioDestination)
  {
    try
    {
      this._audioDestination.disconnect();
    }
    catch (error)
    {}

    this._audioDestination = null;
  }

  if (this._audioContext)
  {
    this._audioContext.close();
  }

  this._audioContext = null;
  this._audioSources = [];
  this._audioRequested = false;
  this._audioRefreshPromise = null;
  this._audioRefreshPending = false;
  this._updateAudioInfo({
    status : 'stopped',
    reason : 'Mixer stopped'
  });
};

AudioMixer.prototype._ensureAudioSystem = function()
{
  if (this._getDestroyed())
  {
    return Promise.resolve(false);
  }

  if (!this._audioContext)
  {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextConstructor)
    {
      this._logger.warn('AudioContext is not available');
      this._updateAudioInfo({
        status    : 'failed',
        reason    : 'AudioContext is not available',
        lastError : 'AudioContext is not available'
      });

      return Promise.resolve(false);
    }

    this._audioContext = new AudioContextConstructor();
  }

  const resumePromise = this._audioContext.state === 'suspended' ? this._audioContext.resume() : Promise.resolve();

  return resumePromise
    .then(() =>
    {
      if (this._getDestroyed())
      {
        return false;
      }

      if (!this._audioDestination)
      {
        this._audioDestination = this._audioContext.createMediaStreamDestination();
      }

      this._updateAudioInfo({
        status : this._audioContext.state === 'suspended' ? 'suspended' : 'ready',
        reason : ''
      });

      return true;
    })
    .catch((error) =>
    {
      this._updateAudioInfo({
        status    : 'failed',
        reason    : 'AudioContext resume failed',
        lastError : error.message || String(error)
      });

      return false;
    });
};

AudioMixer.prototype._refreshAudioConnections = function()
{
  if (!this._audioRequested || this._getDestroyed())
  {
    this._updateAudioInfo({
      status : this._getDestroyed() ? 'stopped' : 'not-requested',
      reason : this._getDestroyed() ? 'Mixer stopped' : ''
    });

    return Promise.resolve(null);
  }

  this._sourceRegistry.sources.forEach((source) =>
  {
    if (source.audioSourceNode && !this._sourceRegistry.hasLiveAudioTrack(source))
    {
      this.disconnectSource(source);
    }
  });

  if (!this._sourceRegistry.hasAnyLiveAudioTrack())
  {
    this._logger.debug('No live audio sources, skip audio stream creation');
    this._updateAudioInfo({
      status : 'no-source',
      reason : 'No live audio source'
    });

    return Promise.resolve(null);
  }

  return this._ensureAudioSystem()
    .then((ready) =>
    {
      if (!ready)
      {
        this._updateAudioInfo({
          status : this._audioInfo.status === 'failed' ? 'failed' : 'not-started',
          reason : this._audioInfo.reason || 'Audio system is not ready'
        });

        return null;
      }

      const connectedSources = this._sourceRegistry.sources.filter((source) => this._connectSource(source));

      if (this._audioSources.length === 0 && connectedSources.length === 0)
      {
        this._logger.warn('No valid audio sources, skip audio stream creation');
        this._updateAudioInfo({
          status : 'failed',
          reason : 'No audio source connected'
        });

        return null;
      }

      this._updateAudioInfo({
        status : this._audioContext && this._audioContext.state === 'suspended' ? 'suspended' : 'mixing',
        reason : ''
      });

      return this._audioDestination.stream;
    });
};

AudioMixer.prototype._connectSource = function(source)
{
  const stream = this._sourceRegistry.getStream(source);

  if (!this._audioContext || !this._audioDestination || !this._sourceRegistry.hasLiveAudioTrack(source))
  {
    return false;
  }

  if (source.audioSourceNode)
  {
    if (source.audioStream === stream)
    {
      return false;
    }

    this.disconnectSource(source);
  }

  try
  {
    const audioSourceNode = this._audioContext.createMediaStreamSource(stream);
    const gainNode = this._audioContext.createGain();

    gainNode.gain.value = source.gain;
    audioSourceNode.connect(gainNode);
    gainNode.connect(this._audioDestination);

    source.audioSourceNode = audioSourceNode;
    source.gainNode = gainNode;
    source.audioStream = stream;
    this._audioSources.push(audioSourceNode);

    if (this._onAudioTrackAvailable)
    {
      this._onAudioTrackAvailable(this._audioDestination.stream);
    }

    this._logger.debug('audio tracks: ', stream.getAudioTracks().length);

    return true;
  }
  catch (error)
  {
    this._logger.warn(`Failed to connect audio source: ${error.message}`);
    this._updateAudioInfo({
      status    : 'failed',
      reason    : 'Failed to connect audio source',
      lastError : error.message || String(error)
    });

    return false;
  }
};

AudioMixer.prototype._updateAudioInfo = function(info)
{
  Object.assign(this._audioInfo, {
    requested        : this._audioRequested,
    contextState     : this._audioContext ? this._audioContext.state : null,
    sourceCount      : this._sourceRegistry.sources.length,
    liveSourceCount  : this._sourceRegistry.sources.filter((source) => this._sourceRegistry.hasLiveAudioTrack(source)).length,
    connectedSources : this._audioSources.length,
    outputTracks     : this._audioDestination ? this._audioDestination.stream.getAudioTracks().length : 0
  }, info || {});
};

Object.defineProperties(AudioMixer.prototype, {
  requested : {
    get : function()
    {
      return this._audioRequested;
    }
  },
  hasAudioContext : {
    get : function()
    {
      return Boolean(this._audioContext);
    }
  },
  audioSources : {
    get : function()
    {
      return this._audioSources;
    }
  },
  audioDestination : {
    get : function()
    {
      return this._audioDestination;
    }
  },
  audioContext : {
    get : function()
    {
      return this._audioContext;
    }
  },
  audioInfo : {
    get : function()
    {
      return this._audioInfo;
    }
  }
});

module.exports = AudioMixer;
