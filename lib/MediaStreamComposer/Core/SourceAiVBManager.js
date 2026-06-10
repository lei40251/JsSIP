const AiVBConfig = require('../AIVirtualBackground/AiVBConfig');
const MediaPipeSegmenterRuntime = require('../AIVirtualBackground/MediaPipeSegmenterRuntime');

function cloneObject(input)
{
  return input && typeof input === 'object' ? Object.assign({}, input) : {};
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
    video           : video,
    segmentation    : segmentation,
    postProcessing  : postProcessing,
    assetConfig     : assetConfig
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

module.exports = class SourceAiVBManager
{
  constructor(options = {})
  {
    this._logger = options.logger || null;
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

    state.config = config;

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

  getRenderableState(source, videoElement)
  {
    if (!source || !this.hasEnabledEffect(source))
    {
      return null;
    }

    const state = this._ensureState(source);
    const config = source.aiVirtualBackground;

    state.config = config;
    this._ensureRuntime(state);
    this._ensureBackgroundImage(state);
    this._scheduleSegmentation(state, videoElement);

    return {
      config          : config,
      latestMask      : state.latestMask,
      backgroundImage : state.backgroundImage,
      state           : state
    };
  }

  noteFrameRendered(source, usedMask)
  {
    const state = source && source.__aiVirtualBackgroundState;

    if (!state || !usedMask)
    {
      return;
    }

    state.renderedSinceSegmentation += 1;
  }

  removeSource(source)
  {
    const state = source && source.__aiVirtualBackgroundState;

    if (!state)
    {
      return;
    }

    source.__aiVirtualBackgroundState = null;

    if (state.runtime && typeof state.runtime.destroy === 'function')
    {
      Promise.resolve(state.runtime.destroy())
        .catch(() => {});
    }
  }

  _ensureState(source)
  {
    if (source.__aiVirtualBackgroundState)
    {
      return source.__aiVirtualBackgroundState;
    }

    source.__aiVirtualBackgroundState = {
      config                    : source.aiVirtualBackground,
      runtime                   : null,
      runtimeReady              : false,
      runtimeInitializing       : false,
      runtimeInitError          : '',
      pendingSegmentation       : false,
      latestMask                : null,
      renderedSinceSegmentation : 0,
      backgroundImageUrl        : null,
      backgroundImageLoadedUrl  : null,
      backgroundImagePendingUrl : null,
      backgroundImage           : null,
      backgroundImageStatus     : 'idle',
      backgroundImageError      : '',
      backgroundImageRequestId  : 0,
      loadingImage              : false,
      segmentationCanvas        : null,
      segmentationContext       : null,
      workCanvas                : null,
      workContext               : null
    };

    return source.__aiVirtualBackgroundState;
  }

  _ensureRuntime(state)
  {
    if (!state || !state.config || !isEffectEnabled(state.config))
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

    state.runtime.initialize({
      modelPath : state.config.modelPath,
      delegate  : state.config.segmentation.delegate
    })
      .then(() =>
      {
        state.runtimeReady = true;
      })
      .catch((error) =>
      {
        state.runtimeInitError = error && error.message ? error.message : String(error);

        if (this._logger)
        {
          this._logger.warn(`AiVB runtime init failed: ${state.runtimeInitError}`);
        }
      })
      .finally(() =>
      {
        state.runtimeInitializing = false;
      });
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
      if (state.backgroundImageRequestId !== requestId)
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
      if (state.backgroundImageRequestId !== requestId)
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

  _scheduleSegmentation(state, videoElement)
  {
    if (!state || !state.runtimeReady || state.pendingSegmentation || !state.runtime || !videoElement || videoElement.readyState < 2)
    {
      return;
    }

    const frameSkip = state.config && state.config.segmentation ? state.config.segmentation.frameSkip : 1;
    const shouldRun = !state.latestMask || frameSkip <= 0 || state.renderedSinceSegmentation >= frameSkip;

    if (!shouldRun)
    {
      return;
    }

    state.pendingSegmentation = true;
    const segmentationInput = this._getSegmentationInput(state, videoElement);

    state.runtime.segmentForVideo(segmentationInput || videoElement)
      .then((result) =>
      {
        if (!result || !result.segmentationMask)
        {
          return;
        }

        state.latestMask = result.segmentationMask;
        state.renderedSinceSegmentation = 0;
      })
      .catch((error) =>
      {
        if (this._logger)
        {
          this._logger.warn(`AiVB segmentation failed: ${error && error.message ? error.message : String(error)}`);
        }
      })
      .finally(() =>
      {
        state.pendingSegmentation = false;
      });
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
};
