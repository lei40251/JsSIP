/**
 * AiVBConfig —— AiVirtualBackground 引擎的配置归一化模块。
 *
 * 将用户提供的选项与安全默认值合并，校验已知 key，
 * 并尽早拒绝未知选项以捕获拼写错误 / 误配置。
 *
 * 以函数集合形式导出（而非类），以便 AiVirtualBackground 和 AiVBAssetLoader
 * 无需实例化即可使用。
 *
 * @module AiVBConfig
 */

const Logger = require('../../Logger');

const logger = new Logger('AiVBConfig');

/** MediaPipe 推理固定使用 GPU，避免 CPU fallback 在通话期间拖垮主线程 */
const FORCED_DELEGATE = 'GPU';

/** `video` 选项块下已识别的 key */
const VIDEO_OPTION_KEYS = [ 'width', 'height', 'targetFps', 'mirror', 'processingScale' ];

/** `segmentation` 选项块下已识别的 key */
const SEGMENTATION_OPTION_KEYS = [ 'delegate', 'frameSkip' ];

/** `postProcessing` 选项块下已识别的 key */
const POST_PROCESSING_OPTION_KEYS = [ 'blurRadius', 'maxBlurRadius', 'foregroundBrightness', 'foregroundContrast', 'foregroundSaturate' ];

/** `assetConfig` 选项块下已识别的 key */
const ASSET_CONFIG_OPTION_KEYS = [ 'cdnUrl', 'moduleUrl', 'wasmBaseUrl', 'modelUrl' ];

// ---------------------------------------------------------------------------
// 默认值
// ---------------------------------------------------------------------------

/** @type {{ width: number, height: number, targetFps: number, mirror: boolean, processingScale: number }} */
const DEFAULT_VIDEO = {
  width           : 1280,
  height          : 720,
  targetFps       : 15,
  mirror          : false,
  processingScale : 0.5
};

/** @type {{ delegate: 'GPU', frameSkip: number }} */
const DEFAULT_SEGMENTATION = {
  delegate  : FORCED_DELEGATE,
  frameSkip : 1
};

/** 
 * @type {{ blurRadius: number, maxBlurRadius: number, foregroundBrightness: number, 
 *           foregroundContrast: number, foregroundSaturate: number }} 
 */
const DEFAULT_POST_PROCESSING = {
  blurRadius           : 12,
  maxBlurRadius        : 20,
  foregroundBrightness : 1.12,
  foregroundContrast   : 1.10,
  foregroundSaturate   : 1.08
};

/** MediaPipe Tasks Vision 默认 CDN URL（jsDelivr） */
const DEFAULT_TASKS_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2';
const DEFAULT_TASKS_WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm';

/** 默认 selfie-segmenter landscape 模型（Google Cloud Storage） */
const DEFAULT_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite';

// ---------------------------------------------------------------------------
// 顶层工厂函数
// ---------------------------------------------------------------------------

/**
 * 创建完全归一化的 AiVirtualBackground 配置对象。
 *
 * @param {Object} [options={}] — 用户提供的原始选项
 * @param {Object} [options.video] — 视频流设置
 * @param {Object} [options.segmentation] — 分割设置
 * @param {Object} [options.postProcessing] — 后处理设置
 * @param {Object} [options.assetConfig] — CDN / 路径覆盖
 * @returns {{ video: Object, segmentation: Object, postProcessing: Object, assetConfig: Object }}
 */
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

// ---------------------------------------------------------------------------
// 各段归一化函数
// ---------------------------------------------------------------------------

/**
 * 归一化 `video` 选项块。
 *
 * 接受部分对象；缺失的 key 回退到 DEFAULT_VIDEO。
 * 未知 key 会导致立即抛出错误。
 *
 * @param {Object} [video] — 原始视频选项
 * @returns {{ width: number, height: number, targetFps: number, mirror: boolean, processingScale: number }}
 * @throws {Error} 如果存在未知 key
 */
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
  if (Number.isFinite(Number(video.processingScale)))
  {
    normalized.processingScale = clampNumber(video.processingScale, 0.1, 1, DEFAULT_VIDEO.processingScale);
  }

  return normalized;
};

/**
 * 归一化 `segmentation` 选项块。
 *
 * @param {Object} [segmentation] — 原始分割选项
 * @returns {{ delegate: 'GPU', frameSkip: number }}
 * @throws {Error} 如果存在未知 key
 */
exports.normalizeSegmentation = function(segmentation)
{
  const normalized = Object.assign({}, DEFAULT_SEGMENTATION);

  if (!segmentation || typeof segmentation !== 'object')
  {
    return normalized;
  }

  assertKnownKeys('segmentation', segmentation, SEGMENTATION_OPTION_KEYS);

  normalized.delegate = FORCED_DELEGATE;
  if (Number.isFinite(Number(segmentation.frameSkip)))
  {
    normalized.frameSkip = Math.floor(
      clampNumber(segmentation.frameSkip, 0, 120, DEFAULT_SEGMENTATION.frameSkip)
    );
  }

  return normalized;
};

/**
 * 归一化 `postProcessing` 选项块。
 *
 * @param {Object} [postProcessing] — 原始后处理选项
 * @returns {{ blurRadius: number, maxBlurRadius: number, foregroundBrightness: number, 
 *             foregroundContrast: number, foregroundSaturate: number }} — 钳位到安全范围
 * @throws {Error} 如果存在未知 key 
 */
exports.normalizePostProcessing = function(postProcessing)
{
  const normalized = Object.assign({}, DEFAULT_POST_PROCESSING);

  if (!postProcessing || typeof postProcessing !== 'object')
  {
    return normalized;
  }

  assertKnownKeys('postProcessing', postProcessing, POST_PROCESSING_OPTION_KEYS);

  normalized.maxBlurRadius = clampNumber(
    postProcessing.maxBlurRadius,
    0,
    100,
    DEFAULT_POST_PROCESSING.maxBlurRadius
  );
  normalized.blurRadius = clampNumber(
    postProcessing.blurRadius,
    0,
    normalized.maxBlurRadius,
    Math.min(DEFAULT_POST_PROCESSING.blurRadius, normalized.maxBlurRadius)
  );
  normalized.foregroundBrightness = clampNumber(
    postProcessing.foregroundBrightness,
    0.5,
    2,
    DEFAULT_POST_PROCESSING.foregroundBrightness
  );
  normalized.foregroundContrast = clampNumber(
    postProcessing.foregroundContrast,
    0.5,
    2,
    DEFAULT_POST_PROCESSING.foregroundContrast
  );
  normalized.foregroundSaturate = clampNumber(
    postProcessing.foregroundSaturate,
    0,
    2,
    DEFAULT_POST_PROCESSING.foregroundSaturate
  );

  return normalized;
};

/**
 * 归一化 `assetConfig` 选项块。
 *
 * URL 解析优先级（从高到低）：
 *   1. 显式的 `moduleUrl` / `wasmBaseUrl` / `modelUrl`
 *   2. `cdnUrl`（自动推导扁平 aivb 目录的 vision.js + wasm + model 路径）
 *   3. 硬编码的 jsDelivr + Google Cloud Storage 默认值
 *
 * @param {Object} [assetConfig] — 原始资源配置
 * @returns {{ moduleUrl: string, wasmBaseUrl: string, modelUrl: string }}
 * @throws {Error} 如果存在未知 key
 */
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

  // 便捷方式：从单个 cdnUrl 推导扁平 aivb 目录的运行时 URL
  if (typeof assetConfig.cdnUrl === 'string' && assetConfig.cdnUrl.trim())
  {
    const baseUrl = assetConfig.cdnUrl.trim().replace(/\/$/, '');

    normalized.moduleUrl = `${baseUrl}/vision.js`;
    normalized.wasmBaseUrl = baseUrl;
    normalized.modelUrl = `${baseUrl}/selfie_segmenter_landscape.tflite`;
  }

  // 显式的逐项 URL 覆盖具有最高优先级
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

// ---------------------------------------------------------------------------
// 内部辅助函数
// ---------------------------------------------------------------------------

/**
 * 将数值钳位到 [min, max] 范围。如果值无法转换为有限数值，则返回 fallback。
 *
 * @param {*} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
function clampNumber(value, min, max, fallback)
{
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue))
  {
    return fallback;
  }

  return Math.min(max, Math.max(min, numericValue));
}

/**
 * 验证选项对象仅包含已识别的 key，若发现未知 key 则抛出错误。
 *
 * 此函数充当拼写错误的早期预警（例如使用了 `blur_radius` 而非 `blurRadius`）。
 *
 * @param {string} sectionName — 人类可读的配置段名称（用于错误消息）
 * @param {Object} value — 原始选项对象
 * @param {string[]} allowedKeys — 已识别 key 的白名单
 * @throws {Error} 如果 `value` 包含不在 `allowedKeys` 中的 key
 */
function assertKnownKeys(sectionName, value, allowedKeys)
{
  const allowedKeySet = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeySet.has(key));

  if (unknownKeys.length > 0)
  {
    throw new Error(
      `Unsupported AiVirtualBackground ${sectionName} option(s): ${unknownKeys.join(', ')}`
    );
  }
}
