const Logger = require('../Logger');
const AssetManifest = require('./AiVBEAssetManifest');

const logger = new Logger('AiVBEConfig');

const DEFAULT_VIDEO = {
  width     : 1280,
  height    : 720,
  targetFps : 15,
  mirror    : false
};

const DEFAULT_SEGMENTATION = {
  backend         : 'mediapipeSelfieSegmentation',
  inputResolution : '160x96',
  model           : 'selfie_segmenter_landscape',
  pipeline        : 'webgl2',
  targetFps       : 15,
  delegate        : 'GPU',
  modelSelection  : 1
};

const DEFAULT_POST_PROCESSING = {
  smoothSegmentationMask : true,
  coverage               : [ 0.5, 0.75 ],
  lightWrapping          : 0.2,
  blendMode              : 'screen',
  jointBilateralFilter   : {
    sigmaSpace : 3,
    sigmaColor : 0.2
  }
};

const DEFAULT_ASSET_BASE_URL = './virtual-background/mediapipe';
const DEFAULT_VISION_SCRIPT_PATH = `v2/${AssetManifest.FILES.runtimeScript}`;
const DEFAULT_MODEL_FILE = `v2/${AssetManifest.FILES.landscapeModel}`;

exports.create = function(options = {})
{
  const config = {
    video          : exports.normalizeVideo(options.video),
    segmentation   : exports.normalizeSegmentation(options.segmentation),
    postProcessing : exports.normalizePostProcessing(options.postProcessing),
    assetConfig    : exports.normalizeAssetConfig(options.assetConfig)
  };

  logger.debug(`Config created: ${JSON.stringify(config)}`);

  return config;
};

exports.normalizeVideo = function(video)
{
  const normalized = Object.assign({}, DEFAULT_VIDEO);

  if (!video || typeof video !== 'object')
  {
    return normalized;
  }

  if (Number.isFinite(Number(video.width)) && Number(video.width) > 0)
  {
    normalized.width = Math.floor(Number(video.width));
  }
  if (Number.isFinite(Number(video.height)) && Number(video.height) > 0)
  {
    normalized.height = Math.floor(Number(video.height));
  }
  if (Number.isFinite(Number(video.targetFps)) && Number(video.targetFps) > 0)
  {
    normalized.targetFps = Math.floor(Number(video.targetFps));
  }
  if (typeof video.mirror === 'boolean')
  {
    normalized.mirror = video.mirror;
  }

  return normalized;
};

exports.normalizeSegmentation = function(segmentation)
{
  const normalized = Object.assign({}, DEFAULT_SEGMENTATION);

  if (!segmentation || typeof segmentation !== 'object')
  {
    return normalized;
  }

  if (typeof segmentation.backend === 'string' && segmentation.backend.trim())
  {
    normalized.backend = segmentation.backend.trim();
  }
  if (typeof segmentation.inputResolution === 'string' && segmentation.inputResolution.trim())
  {
    normalized.inputResolution = segmentation.inputResolution.trim();
  }
  if (typeof segmentation.model === 'string' && segmentation.model.trim())
  {
    normalized.model = segmentation.model.trim();
  }
  if (typeof segmentation.pipeline === 'string' && segmentation.pipeline.trim())
  {
    normalized.pipeline = segmentation.pipeline.trim();
  }
  if (Number.isFinite(Number(segmentation.targetFps)) && Number(segmentation.targetFps) > 0)
  {
    normalized.targetFps = Math.floor(Number(segmentation.targetFps));
  }
  if (typeof segmentation.delegate === 'string' && segmentation.delegate.trim())
  {
    normalized.delegate = segmentation.delegate.trim().toUpperCase();
  }
  if (Number.isFinite(Number(segmentation.modelSelection)))
  {
    const selection = Math.floor(Number(segmentation.modelSelection));

    normalized.modelSelection = selection === 0 ? 0 : 1;
  }

  return normalized;
};

exports.normalizePostProcessing = function(postProcessing)
{
  const normalized = JSON.parse(JSON.stringify(DEFAULT_POST_PROCESSING));

  if (!postProcessing || typeof postProcessing !== 'object')
  {
    return normalized;
  }

  Object.assign(normalized, postProcessing);

  if (postProcessing.jointBilateralFilter && typeof postProcessing.jointBilateralFilter === 'object')
  {
    Object.assign(
      normalized.jointBilateralFilter,
      postProcessing.jointBilateralFilter
    );
  }

  return normalized;
};

exports.normalizeAssetConfig = function(assetConfig)
{
  const normalized = {
    baseUrl         : DEFAULT_ASSET_BASE_URL,
    visionScriptUrl : `${DEFAULT_ASSET_BASE_URL}/${DEFAULT_VISION_SCRIPT_PATH}`,
    visionBaseUrl   : `${DEFAULT_ASSET_BASE_URL}/v2`,
    modelBaseUrl    : `${DEFAULT_ASSET_BASE_URL}/v2`,
    modelUrl        : `${DEFAULT_ASSET_BASE_URL}/${DEFAULT_MODEL_FILE}`
  };

  if (!assetConfig || typeof assetConfig !== 'object')
  {
    return normalized;
  }

  if (typeof assetConfig.baseUrl === 'string' && assetConfig.baseUrl.trim())
  {
    normalized.baseUrl = assetConfig.baseUrl.trim().replace(/\/$/, '');
    normalized.visionScriptUrl = `${normalized.baseUrl}/${DEFAULT_VISION_SCRIPT_PATH}`;
    normalized.visionBaseUrl = `${normalized.baseUrl}/v2`;
    normalized.modelBaseUrl = `${normalized.baseUrl}/v2`;
    normalized.modelUrl = `${normalized.baseUrl}/${DEFAULT_MODEL_FILE}`;
  }
  if (typeof assetConfig.visionScriptUrl === 'string' && assetConfig.visionScriptUrl.trim())
  {
    normalized.visionScriptUrl = assetConfig.visionScriptUrl.trim();
  }
  if (typeof assetConfig.visionBaseUrl === 'string' && assetConfig.visionBaseUrl.trim())
  {
    normalized.visionBaseUrl = assetConfig.visionBaseUrl.trim().replace(/\/$/, '');
  }
  if (typeof assetConfig.modelBaseUrl === 'string' && assetConfig.modelBaseUrl.trim())
  {
    normalized.modelBaseUrl = assetConfig.modelBaseUrl.trim().replace(/\/$/, '');
    normalized.modelUrl = `${normalized.modelBaseUrl}/${AssetManifest.FILES.landscapeModel}`;
  }
  if (typeof assetConfig.modelUrl === 'string' && assetConfig.modelUrl.trim())
  {
    normalized.modelUrl = assetConfig.modelUrl.trim();
  }

  return normalized;
};
