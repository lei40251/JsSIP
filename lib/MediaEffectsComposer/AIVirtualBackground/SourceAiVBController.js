const AiVBConfig = require('./AiVBConfig');
const MediaPipeSegmenterRuntime = require('./MediaPipeSegmenterRuntime');

const DEFAULT_RUNTIME_STARTUP_DELAY_MS = 1500;
const DEFAULT_MAX_RUNTIME_FPS = 15;

function cloneObject(input)
{
  return input && typeof input === 'object' ? Object.assign({}, input) : {};
}

function clampNumber(value, min, max, fallback)
{
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue))
  {
    return fallback;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function resolveMode(options)
{
  const rawMode = typeof options.mode === 'string' ? options.mode.trim().toLowerCase() : '';

  if (rawMode)
  {
    return rawMode;
  }

  if (typeof options.imageUrl === 'string')
  {
    return 'image';
  }

  if (typeof options.color === 'string')
  {
    return 'color';
  }

  if (Number.isFinite(Number(options.blurRadius)))
  {
    return 'blur';
  }

  return 'none';
}

function normalizeModeValue(mode, options)
{
  switch (mode)
  {
    case 'image':
      return typeof options.imageUrl === 'string' && options.imageUrl.trim() ? options.imageUrl.trim() : null;
    case 'color':
      return typeof options.color === 'string' && options.color.trim() ? options.color.trim() : null;
    case 'blur':
      return Number.isFinite(Number(options.blurRadius)) ? Number(options.blurRadius) : null;
    default:
      return null;
  }
}

function normalizeConfig(input)
{
  if (input === undefined || input === null || input === false)
  {
    return null;
  }

  const options = input === true ? {} : cloneObject(input);

  if (options.enabled === false)
  {
    return null;
  }

  const mode = resolveMode(options);
  const video = AiVBConfig.normalizeVideo(options.video);
  const segmentation = AiVBConfig.normalizeSegmentation(options.segmentation);
  const postProcessing = AiVBConfig.normalizePostProcessing(options.postProcessing);
  const assetConfig = AiVBConfig.normalizeAssetConfig(options.assetConfig);
  const value = normalizeModeValue(mode, options);

  if (mode === 'blur' && Number.isFinite(value))
  {
    postProcessing.blurRadius = Math.max(0, Math.min(postProcessing.maxBlurRadius, value));
  }

  return {
    enabled         : true,
    mode            : mode,
    imageUrl        : mode === 'image' && typeof value === 'string' ? value : null,
    backgroundColor : mode === 'color' && typeof value === 'string' ? value : null,
    blurRadius      : mode === 'blur' && Number.isFinite(value) ? value : postProcessing.blurRadius,
    modelPath       : typeof options.modelPath === 'string' && options.modelPath.trim() ? options.modelPath.trim() : null,
    runtimeEnabled  : options.runtimeEnabled !== false,
    startupDelayMs  : Math.floor(clampNumber(
      options.startupDelayMs,
      0,
      10000,
      DEFAULT_RUNTIME_STARTUP_DELAY_MS
    )),
    maxRuntimeFps : clampNumber(
      options.maxRuntimeFps,
      1,
      30,
      Number.isFinite(Number(options.video && options.video.targetFps)) && Number(options.video.targetFps) > 0
        ? Number(options.video.targetFps)
        : DEFAULT_MAX_RUNTIME_FPS
    ),
    video          : video,
    segmentation   : segmentation,
    postProcessing : postProcessing,
    assetConfig    : assetConfig
  };
}

function cloneConfigSnapshot(config)
{
  if (!config)
  {
    return null;
  }

  return {
    enabled         : config.enabled !== false,
    mode            : config.mode,
    imageUrl        : config.imageUrl,
    backgroundColor : config.backgroundColor,
    blurRadius      : config.blurRadius,
    modelPath       : config.modelPath,
    runtimeEnabled  : config.runtimeEnabled === true,
    startupDelayMs  : config.startupDelayMs,
    maxRuntimeFps   : config.maxRuntimeFps,
    video           : cloneObject(config.video),
    segmentation    : cloneObject(config.segmentation),
    postProcessing  : cloneObject(config.postProcessing),
    assetConfig     : cloneObject(config.assetConfig)
  };
}

function isEffectEnabled(config)
{
  return Boolean(config && config.enabled !== false && config.mode && config.mode !== 'none');
}

function isRuntimeEnabled(config)
{
  return Boolean(config && config.runtimeEnabled === true);
}

function createRuntimeConfigKey(config)
{
  if (!config)
  {
    return '';
  }

  return JSON.stringify({
    modelPath     : config.modelPath || '',
    delegate      : config.segmentation ? config.segmentation.delegate : '',
    assetConfig   : config.assetConfig || {},
    maxRuntimeFps : config.maxRuntimeFps
  });
}

module.exports = class SourceAiVBController
{
  constructor(options = {})
  {
    this._logger = options.logger || null;
    this._states = new WeakMap();
  }

  normalizeInput(input)
  {
    return normalizeConfig(input);
  }

  setSourceConfig(source, input)
  {
    if (!source)
    {
      return null;
    }

    const config = normalizeConfig(input);

    source.aiVirtualBackground = config;

    if (!isEffectEnabled(config))
    {
      this.removeSource(source);

      return null;
    }

    const state = this._ensureState(source);
    const runtimeConfigKey = isRuntimeEnabled(config) ? createRuntimeConfigKey(config) : '';
    const runtimeConfigChanged = state.runtimeConfigKey &&
      state.runtimeConfigKey !== runtimeConfigKey;

    state.config = config;
    state.disposed = false;
    state.generation += 1;
    state.runtimeAllowedAt = this._now() + config.startupDelayMs;

    if (!isRuntimeEnabled(config))
    {
      this._resetRuntime(state);
      state.runtimeConfigKey = '';
    }
    else
    {
      if (state.runtimeInitializing || runtimeConfigChanged)
      {
        this._resetRuntime(state);
      }

      state.runtimeConfigKey = runtimeConfigKey;
    }

    if (state.backgroundImageUrl !== config.imageUrl)
    {
      state.backgroundImageRequestId += 1;
      state.backgroundImageUrl = config.imageUrl;
      state.backgroundImageStatus = 'idle';
      state.backgroundImageError = '';
      state.backgroundImagePendingUrl = null;
      state.loadingImage = false;
    }

    return cloneConfigSnapshot(config);
  }

  getSourceConfig(source)
  {
    return cloneConfigSnapshot(source && source.aiVirtualBackground);
  }

  clearSourceConfig(source)
  {
    if (!source)
    {
      return;
    }

    source.aiVirtualBackground = null;
    this.removeSource(source);
  }

  hasEnabledEffect(source)
  {
    return isEffectEnabled(source && source.aiVirtualBackground);
  }

  preloadRenderAssets(source, videoElement)
  {
    if (!source || !this.hasEnabledEffect(source))
    {
      return;
    }

    const state = this._ensureState(source);
    const config = source.aiVirtualBackground;

    state.config = config;

    if (!this._isVideoReadyForSegmentation(videoElement))
    {
      return;
    }

    this._ensureBackgroundImage(state);
  }

  getRenderableState(source, videoElement)
  {
    if (!source || !this.hasEnabledEffect(source))
    {
      return null;
    }

    const state = this._ensureState(source);
    const config = source.aiVirtualBackground;
    const videoReady = this._isVideoReadyForSegmentation(videoElement);

    state.config = config;

    if (videoReady)
    {
      this._ensureBackgroundImage(state);

      if (isRuntimeEnabled(config))
      {
        const now = this._now();

        if (now >= state.runtimeAllowedAt)
        {
          this._ensureRuntime(state);
          this._scheduleSegmentation(state, videoElement, now);
        }
      }
    }

    return {
      config          : config,
      latestMask      : state.latestMask,
      backgroundImage : state.backgroundImage,
      state           : state
    };
  }

  noteFrameRendered(source, usedMask)
  {
    const state = source ? this._states.get(source) : null;

    if (!state || !usedMask)
    {
      return;
    }

    state.renderedSinceSegmentation += 1;
  }

  removeSource(source)
  {
    const state = source ? this._states.get(source) : null;

    if (!state)
    {
      return;
    }

    this._states.delete(source);
    state.disposed = true;
    state.generation += 1;
    state.pendingSegmentation = false;
    state.activeSegmentationPromise = null;
    state.queuedSegmentationPromise = null;
    state.lastQueuedSegmentationInputAt = 0;
    state.lastSegmentationScheduledAt = 0;
    state.runtimeConfigKey = '';
    state.loadingImage = false;
    state.backgroundImageRequestId += 1;
    state.latestMask = null;
    state.backgroundImage = null;
    state.segmentationCanvas = null;
    state.segmentationContext = null;
    state.workCanvas = null;
    state.workContext = null;

    if (state.runtime && typeof state.runtime.destroy === 'function')
    {
      Promise.resolve(state.runtime.destroy())
        .catch(() => {});
    }
  }

  clear()
  {
    this._states = new WeakMap();
  }

  _ensureState(source)
  {
    const existingState = source ? this._states.get(source) : null;

    if (existingState)
    {
      return existingState;
    }

    const state = {
      config                        : source.aiVirtualBackground,
      disposed                      : false,
      generation                    : 0,
      runtime                       : null,
      runtimeReady                  : false,
      runtimeInitializing           : false,
      runtimeInitError              : '',
      runtimeConfigKey              : '',
      pendingSegmentation           : false,
      activeSegmentationPromise     : null,
      queuedSegmentationPromise     : null,
      lastQueuedSegmentationInputAt : 0,
      lastSegmentationScheduledAt   : 0,
      runtimeAllowedAt              : 0,
      latestMask                    : null,
      renderedSinceSegmentation     : 0,
      backgroundImageUrl            : null,
      backgroundImageLoadedUrl      : null,
      backgroundImagePendingUrl     : null,
      backgroundImage               : null,
      backgroundImageStatus         : 'idle',
      backgroundImageError          : '',
      backgroundImageRequestId      : 0,
      loadingImage                  : false,
      segmentationCanvas            : null,
      segmentationContext           : null,
      workCanvas                    : null,
      workContext                   : null
    };

    this._states.set(source, state);

    return state;
  }

  _ensureRuntime(state)
  {
    if (!state || !state.config || !isEffectEnabled(state.config) || !isRuntimeEnabled(state.config))
    {
      return;
    }

    if (state.runtimeReady || state.runtimeInitializing)
    {
      return;
    }

    state.runtime = state.runtime || new MediaPipeSegmenterRuntime({
      assetConfig : state.config.assetConfig
    });
    state.runtimeInitializing = true;
    state.runtimeInitError = '';
    const generation = state.generation;

    state.runtime.initialize({
      modelPath : state.config.modelPath,
      delegate  : state.config.segmentation.delegate
    })
      .then(() =>
      {
        if (state.disposed || state.generation !== generation)
        {
          return;
        }

        state.runtimeReady = true;
      })
      .catch((error) =>
      {
        if (state.disposed || state.generation !== generation)
        {
          return;
        }

        state.runtimeInitError = error && error.message ? error.message : String(error);

        if (this._logger)
        {
          this._logger.warn(`AiVB runtime init failed: ${state.runtimeInitError}`);
        }
      })
      .finally(() =>
      {
        if (state.disposed || state.generation !== generation)
        {
          return;
        }

        state.runtimeInitializing = false;
      });
  }

  _resetRuntime(state)
  {
    if (!state)
    {
      return;
    }

    state.runtimeReady = false;
    state.runtimeInitializing = false;
    state.runtimeInitError = '';
    state.pendingSegmentation = false;
    state.activeSegmentationPromise = null;
    state.queuedSegmentationPromise = null;
    state.lastQueuedSegmentationInputAt = 0;
    state.lastSegmentationScheduledAt = 0;
    state.latestMask = null;

    if (state.runtime && typeof state.runtime.destroy === 'function')
    {
      Promise.resolve(state.runtime.destroy())
        .catch(() => {});
    }

    state.runtime = null;
  }

  _ensureBackgroundImage(state)
  {
    if (!state || !state.config || state.config.mode !== 'image')
    {
      return;
    }

    if (!state.config.imageUrl)
    {
      state.backgroundImage = null;
      state.backgroundImageLoadedUrl = null;
      state.backgroundImagePendingUrl = null;
      state.backgroundImageStatus = 'idle';
      state.backgroundImageError = '';
      state.loadingImage = false;

      return;
    }

    if (state.backgroundImage &&
      state.backgroundImageLoadedUrl === state.config.imageUrl)
    {
      return;
    }

    if (state.loadingImage &&
      state.backgroundImagePendingUrl === state.config.imageUrl)
    {
      return;
    }

    if (state.backgroundImageStatus === 'error' &&
      state.backgroundImagePendingUrl === state.config.imageUrl)
    {
      return;
    }

    const image = this._createImageElement();
    const requestId = state.backgroundImageRequestId + 1;
    const imageUrl = state.config.imageUrl;

    if (!image)
    {
      state.backgroundImageStatus = 'error';
      state.backgroundImageError = 'Image element is unavailable';

      return;
    }

    state.backgroundImageRequestId = requestId;
    state.loadingImage = true;
    state.backgroundImageStatus = 'loading';
    state.backgroundImagePendingUrl = imageUrl;
    state.backgroundImageError = '';

    image.onload = () =>
    {
      if (state.disposed || state.backgroundImageRequestId !== requestId)
      {
        return;
      }

      state.loadingImage = false;
      state.backgroundImage = image;
      state.backgroundImageLoadedUrl = imageUrl;
      state.backgroundImagePendingUrl = null;
      state.backgroundImageStatus = 'ready';
      state.backgroundImageError = '';
    };
    image.onerror = () =>
    {
      if (state.disposed || state.backgroundImageRequestId !== requestId)
      {
        return;
      }

      state.loadingImage = false;
      state.backgroundImagePendingUrl = null;
      state.backgroundImageStatus = 'error';
      state.backgroundImageError = 'Failed to load background image';
    };
    image.src = imageUrl;
  }

  _createImageElement()
  {
    let image = null;

    if (typeof Image !== 'undefined')
    {
      image = new Image();
    }
    else if (typeof document !== 'undefined' && document && typeof document.createElement === 'function')
    {
      try
      {
        image = document.createElement('img');
      }
      catch (error)
      {}
    }

    if (image)
    {
      try
      {
        image.crossOrigin = 'anonymous';
      }
      catch (error)
      {}

      return image;
    }

    return null;
  }

  _scheduleSegmentation(state, videoElement, now = this._now())
  {
    if (!state || !state.runtimeReady || !state.runtime || !this._isVideoReadyForSegmentation(videoElement))
    {
      return;
    }

    const frameSkip = state.config && state.config.segmentation ? state.config.segmentation.frameSkip : 0;
    const shouldRun = !state.latestMask || frameSkip <= 0 || state.renderedSinceSegmentation >= frameSkip;

    if (!shouldRun)
    {
      return;
    }

    if (!this._canScheduleSegmentation(state, now))
    {
      return;
    }

    const generation = state.generation;

    if (state.pendingSegmentation)
    {
      if (state.queuedSegmentationPromise)
      {
        this._refreshQueuedSegmentationInput(state, videoElement);

        return;
      }

      const segmentationInput = this._getSegmentationInput(state, videoElement);
      const input = segmentationInput || videoElement;
      const queuedPromise = state.runtime.segmentForVideo(input);

      state.queuedSegmentationPromise = queuedPromise;
      state.lastQueuedSegmentationInputAt = now;
      state.lastSegmentationScheduledAt = now;
      this._bindSegmentationPromise(state, queuedPromise, generation);

      return;
    }

    const segmentationInput = this._getSegmentationInput(state, videoElement);
    const input = segmentationInput || videoElement;

    state.pendingSegmentation = true;
    const activePromise = state.runtime.segmentForVideo(input);

    state.activeSegmentationPromise = activePromise;
    state.lastQueuedSegmentationInputAt = 0;
    state.lastSegmentationScheduledAt = now;
    this._bindSegmentationPromise(state, activePromise, generation);
  }

  _canScheduleSegmentation(state, now)
  {
    const maxRuntimeFps = state.config ? Number(state.config.maxRuntimeFps) : DEFAULT_MAX_RUNTIME_FPS;
    const minInterval = Number.isFinite(maxRuntimeFps) && maxRuntimeFps > 0
      ? 1000 / maxRuntimeFps
      : 1000 / DEFAULT_MAX_RUNTIME_FPS;

    if (!state.lastSegmentationScheduledAt)
    {
      return true;
    }

    return now - state.lastSegmentationScheduledAt >= minInterval;
  }

  _bindSegmentationPromise(state, promise, generation)
  {
    promise
      .then((result) =>
      {
        if (state.disposed || state.generation !== generation)
        {
          return;
        }

        if (!result || !result.segmentationMask)
        {
          return;
        }

        state.latestMask = result.segmentationMask;
        state.renderedSinceSegmentation = 0;
      })
      .catch((error) =>
      {
        if (state.disposed || state.generation !== generation)
        {
          return;
        }

        if (this._logger)
        {
          this._logger.warn(`AiVB segmentation failed: ${error && error.message ? error.message : String(error)}`);
        }
      })
      .finally(() =>
      {
        if (state.disposed || state.generation !== generation)
        {
          return;
        }

        if (state.activeSegmentationPromise === promise)
        {
          if (state.queuedSegmentationPromise)
          {
            state.activeSegmentationPromise = state.queuedSegmentationPromise;
            state.queuedSegmentationPromise = null;
            state.pendingSegmentation = true;

            return;
          }

          state.activeSegmentationPromise = null;
          state.pendingSegmentation = false;

          return;
        }

        if (state.queuedSegmentationPromise === promise)
        {
          state.queuedSegmentationPromise = null;
        }
      });
  }

  _refreshQueuedSegmentationInput(state, videoElement)
  {
    const now = this._now();
    const targetFps = state.config && state.config.video ? Number(state.config.video.targetFps) : 15;
    const minInterval = Number.isFinite(targetFps) && targetFps > 0 ? 1000 / targetFps : 66;

    if (state.lastQueuedSegmentationInputAt &&
      now - state.lastQueuedSegmentationInputAt < minInterval)
    {
      return;
    }

    state.lastQueuedSegmentationInputAt = now;
    const segmentationInput = this._getSegmentationInput(state, videoElement);
    const input = segmentationInput || videoElement;

    if (state.runtime && typeof state.runtime.updateQueuedFrame === 'function')
    {
      state.runtime.updateQueuedFrame(input);
    }
  }

  _getSegmentationInput(state, videoElement)
  {
    if (!state || !videoElement || typeof document === 'undefined')
    {
      return null;
    }

    const configVideo = state.config && state.config.video ? state.config.video : {};
    const sourceWidth = Number(videoElement.videoWidth) || Number(configVideo.width) || 0;
    const sourceHeight = Number(videoElement.videoHeight) || Number(configVideo.height) || 0;
    const processingScale = Number(configVideo.processingScale);

    if (!sourceWidth || !sourceHeight)
    {
      return null;
    }

    const scale = Number.isFinite(processingScale) ? Math.max(0.1, Math.min(1, processingScale)) : 1;
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    if (!state.segmentationCanvas)
    {
      state.segmentationCanvas = document.createElement('canvas');
      state.segmentationContext = state.segmentationCanvas.getContext('2d');
    }

    if (!state.segmentationContext)
    {
      return null;
    }

    if (state.segmentationCanvas.width !== width)
    {
      state.segmentationCanvas.width = width;
    }

    if (state.segmentationCanvas.height !== height)
    {
      state.segmentationCanvas.height = height;
    }

    state.segmentationContext.clearRect(0, 0, width, height);
    state.segmentationContext.drawImage(videoElement, 0, 0, width, height);

    return state.segmentationCanvas;
  }

  _isVideoReadyForSegmentation(videoElement)
  {
    if (!videoElement || videoElement.readyState < 2)
    {
      return false;
    }

    const videoWidth = Number(videoElement.videoWidth) || 0;
    const videoHeight = Number(videoElement.videoHeight) || 0;

    return videoWidth > 0 && videoHeight > 0;
  }

  _now()
  {
    return typeof performance !== 'undefined' && performance && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }
};
