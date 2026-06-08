const Logger = require('../Logger');

const logger = new Logger('AiVBEConfig');
const SUPPORTED_DELEGATES = new Set([ 'CPU', 'GPU' ]);
const VIDEO_OPTION_KEYS = [ 'width', 'height', 'targetFps', 'mirror' ];
const SEGMENTATION_OPTION_KEYS = [ 'delegate' ];
const POST_PROCESSING_OPTION_KEYS = [ 'blurRadius' ];
const ASSET_CONFIG_OPTION_KEYS = [ 'cdnUrl', 'baseUrl', 'moduleUrl', 'wasmBaseUrl', 'modelUrl' ];

const DEFAULT_VIDEO = {
  width     : 1280,
  height    : 720,
  targetFps : 15,
  mirror    : false
};

const DEFAULT_SEGMENTATION = {
  delegate : 'GPU'
};

const DEFAULT_POST_PROCESSING = {
  blurRadius : 20
};

const DEFAULT_TASKS_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2';
const DEFAULT_TASKS_WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm';
const DEFAULT_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite';

exports.create = function(options = {})
{
  const assetConfig = exports.normalizeAssetConfig(options.assetConfig);
  const config = {
    video          : exports.normalizeVideo(options.video),
    segmentation   : exports.normalizeSegmentation(options.segmentation),
    postProcessing : exports.normalizePostProcessing(options.postProcessing),
    assetConfig
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

  assertKnownKeys('video', video, VIDEO_OPTION_KEYS);

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
    normalized.targetFps = clampNumber(video.targetFps, 1, 60, DEFAULT_VIDEO.targetFps);
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

  assertKnownKeys('segmentation', segmentation, SEGMENTATION_OPTION_KEYS);

  if (typeof segmentation.delegate === 'string' && segmentation.delegate.trim())
  {
    const delegate = segmentation.delegate.trim().toUpperCase();

    if (SUPPORTED_DELEGATES.has(delegate))
    {
      normalized.delegate = delegate;
    }
  }

  return normalized;
};

exports.normalizePostProcessing = function(postProcessing)
{
  const normalized = Object.assign({}, DEFAULT_POST_PROCESSING);

  if (!postProcessing || typeof postProcessing !== 'object')
  {
    return normalized;
  }

  assertKnownKeys('postProcessing', postProcessing, POST_PROCESSING_OPTION_KEYS);

  normalized.blurRadius = clampNumber(
    postProcessing.blurRadius,
    0,
    100,
    DEFAULT_POST_PROCESSING.blurRadius
  );

  return normalized;
};

exports.normalizeAssetConfig = function(assetConfig)
{
  const normalized = {
    moduleUrl   : DEFAULT_TASKS_MODULE_URL,
    wasmBaseUrl : DEFAULT_TASKS_WASM_BASE_URL,
    modelUrl    : DEFAULT_MODEL_URL
  };

  if (!assetConfig || typeof assetConfig !== 'object')
  {
    return normalized;
  }

  assertKnownKeys('assetConfig', assetConfig, ASSET_CONFIG_OPTION_KEYS);

  if (typeof assetConfig.cdnUrl === 'string' && assetConfig.cdnUrl.trim())
  {
    const baseUrl = assetConfig.cdnUrl.trim().replace(/\/$/, '');

    normalized.moduleUrl = `${baseUrl}/vision_bundle.mjs`;
    normalized.wasmBaseUrl = `${baseUrl}/wasm`;
  }
  else if (typeof assetConfig.baseUrl === 'string' && assetConfig.baseUrl.trim())
  {
    const baseUrl = assetConfig.baseUrl.trim().replace(/\/$/, '');

    normalized.moduleUrl = `${baseUrl}/vision_bundle.mjs`;
    normalized.wasmBaseUrl = `${baseUrl}/wasm`;
  }

  if (typeof assetConfig.moduleUrl === 'string' && assetConfig.moduleUrl.trim())
  {
    normalized.moduleUrl = assetConfig.moduleUrl.trim();
  }
  if (typeof assetConfig.wasmBaseUrl === 'string' && assetConfig.wasmBaseUrl.trim())
  {
    normalized.wasmBaseUrl = assetConfig.wasmBaseUrl.trim().replace(/\/$/, '');
  }
  if (typeof assetConfig.modelUrl === 'string' && assetConfig.modelUrl.trim())
  {
    normalized.modelUrl = assetConfig.modelUrl.trim();
  }

  return normalized;
};

function clampNumber(value, min, max, fallback)
{
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue))
  {
    return fallback;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function assertKnownKeys(sectionName, value, allowedKeys)
{
  const allowedKeySet = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeySet.has(key));

  if (unknownKeys.length > 0)
  {
    throw new Error(
      `Unsupported AiVBE ${sectionName} option(s): ${unknownKeys.join(', ')}`
    );
  }
}
