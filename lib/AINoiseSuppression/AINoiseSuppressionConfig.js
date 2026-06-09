/**
 * AINoiseSuppressionConfig — AI 降噪引擎的配置归一化模块。
 *
 * 职责：
 *   - 将外部传入的选项与安全默认值合并
 *   - 对每种参数类型做类型校验与范围钳位
 *   - 输出规格一致的配置快照，避免下游重复校验
 *
 * 设计要点：
 *   - 所有归一化函数都是纯函数（无副作用），方便单元测试
 *   - 对外导出常量供 Core 和 Processor 直接引用，避免魔术数字
 *   - 非法值统一回退到安全的默认值，并在 debug 级别记录 fallback 原因
 *
 * @module AINoiseSuppressionConfig
 */

const Logger = require('../Logger');

const logger = new Logger('AINoiseSuppressionConfig');

/**
 * 默认采样率（48kHz）。
 *
 * 与 WASM 模型期望的输入一致。若 AudioContext 无法以 48kHz
 * 创建，Core 会回退到浏览器默认值。
 * @type {number}
 */
const DEFAULT_SAMPLE_RATE = 48000;

/**
 * 默认降噪强度（0-100 范围）。
 *
 * 80 在"足够降噪"和"保持语音自然度"之间取平衡。
 * 值越高降噪越激进，也越容易造成语音失真。
 * @type {number}
 */
const DEFAULT_SUPPRESSION_LEVEL = 80;

/**
 * 降噪 WASM/模型资源的默认 CDN 地址（相对路径）。
 *
 * 部署时可通过 options.assetConfig.cdnUrl 覆盖为绝对 URL
 * 或其他 CDN 地址。最终拼接规则由 Core.AssetLoader 负责。
 * @type {string}
 */
const DEFAULT_CDN_URL = './static';

exports.DEFAULT_SAMPLE_RATE = DEFAULT_SAMPLE_RATE;
exports.DEFAULT_SUPPRESSION_LEVEL = DEFAULT_SUPPRESSION_LEVEL;
exports.DEFAULT_CDN_URL = DEFAULT_CDN_URL;

/**
 * 创建完全归一化的 AINoiseSuppression 配置对象。
 *
 * 所有外部选项经此函数处理后，下游代码可以按标准类型直接使用，
 * 无需再做额外校验。
 *
 * @param {Object} [options] — 用户提供的原始选项
 * @param {boolean} [options.enabled=true] — 是否默认启用降噪
 * @param {boolean} [options.preserveOtherTracks=true] — 处理时是否保留原始流中非音频轨道（如视频轨）
 * @param {number} [options.sampleRate=48000] — AudioContext 采样率
 * @param {number} [options.noiseReductionLevel=80] — 降噪强度（0-100）
 * @param {Object} [options.assetConfig] — 资源 CDN / 路径覆盖，含 cdnUrl 字段
 * @returns {Object} 归一化后的配置对象
 * @returns {boolean} returns.enabled
 * @returns {boolean} returns.preserveOtherTracks
 * @returns {number} returns.sampleRate
 * @returns {number} returns.noiseReductionLevel — 已钳位到 [0, 100]
 * @returns {Object|null} returns.assetConfig — 归一化后的资源配置，或 null
 */
exports.create = function(options)
{
  options = options && typeof options === 'object' ? options : {};

  const config = {
    enabled             : exports.normalizeBoolean(options.enabled, true),
    preserveOtherTracks : exports.normalizeBoolean(options.preserveOtherTracks, true),
    sampleRate          : exports.normalizePositiveInteger(options.sampleRate, DEFAULT_SAMPLE_RATE),
    noiseReductionLevel : exports.normalizeSuppressionLevel(options.noiseReductionLevel, DEFAULT_SUPPRESSION_LEVEL),
    assetConfig         : exports.normalizeAssetConfig(options.assetConfig)
  };

  logger.debug(`Config created: ${JSON.stringify(config)}`);

  return config;
};

/**
 * 归一化为布尔值。
 *
 * 仅当 value 严格为 boolean 类型时直接返回；其他情况（undefined、
 * 字符串、数字等）均回退到 fallback。避免 JS 隐式类型转换
 * （如字符串 "false" 被转为 true）带来的配置错误。
 *
 * @param {*} value — 原始传入值
 * @param {boolean} fallback — 非法或未传时使用的备选值
 * @returns {boolean}
 */
exports.normalizeBoolean = function(value, fallback)
{
  if (typeof value === 'boolean')
  {
    return value;
  }

  if (value !== undefined)
  {
    logger.debug(`normalizeBoolean fallback: value=${value} fallback=${fallback}`);
  }

  return Boolean(fallback);
};

/**
 * 归一化为正整数（严格大于 0）。
 *
 * 无限值、NaN、负数、零均视为非法，回退到 fallback。
 * 合法的小数值向下取整（Math.floor）。
 *
 * @param {*} value — 原始传入值
 * @param {number} fallback — 非法或未传时使用的备选值
 * @returns {number}
 */
exports.normalizePositiveInteger = function(value, fallback)
{
  const numberValue = Number(value);

  if (Number.isFinite(numberValue) && numberValue > 0)
  {
    return Math.floor(numberValue);
  }

  if (value !== undefined)
  {
    logger.debug(`normalizePositiveInteger fallback: value=${value} fallback=${fallback}`);
  }

  return fallback;
};

/**
 * 归一化降噪强度级别。
 *
 * 将输入钳位到 [0, 100] 范围：
 *   - 0 = 无降噪（完全 bypass）
 *   - 100 = 最大降噪强度
 *   - 非法值回退到 fallback
 *
 * 钳位使用 Math.min/max 而非取模，确保配置有明确上限，
 * 不会因极端值导致 WASM 内部异常。
 *
 * @param {*} value — 原始传入值
 * @param {number} fallback — 非法或未传时使用的备选值
 * @returns {number} 钳位到 [0, 100] 的正整数
 */
exports.normalizeSuppressionLevel = function(value, fallback)
{
  const numberValue = Number(value);

  if (Number.isFinite(numberValue))
  {
    return Math.max(0, Math.min(100, Math.floor(numberValue)));
  }

  if (value !== undefined)
  {
    logger.debug(`normalizeSuppressionLevel fallback: value=${value} fallback=${fallback}`);
  }

  return fallback;
};

/**
 * 归一化资源配置。
 *
 * 规则：
 *   - 非 object 类型（含 null）直接返回 null
 *   - 只接受 string 类型的 cdnUrl（且去除首尾空白后非空）
 *   - 若归一化后对象为空（没有有效 key），返回 null 而非空对象，
 *     方便下游用 `if (assetConfig)` 判断是否配置了自定义资源路径
 *
 * @param {*} assetConfig — 原始资源配置
 * @returns {Object|null} 归一化后的资源配置 { cdnUrl: string }，或 null
 */
exports.normalizeAssetConfig = function(assetConfig)
{
  if (!assetConfig || typeof assetConfig !== 'object')
  {
    if (assetConfig !== undefined && assetConfig !== null)
    {
      logger.debug(`normalizeAssetConfig fallback: invalid value=${assetConfig}`);
    }

    return null;
  }

  const normalized = {};

  if (typeof assetConfig.cdnUrl === 'string' && assetConfig.cdnUrl.trim())
  {
    normalized.cdnUrl = assetConfig.cdnUrl.trim();
  }
  else if (assetConfig.cdnUrl !== undefined)
  {
    logger.debug(`normalizeAssetConfig ignore cdnUrl: value=${assetConfig.cdnUrl}`);
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
};
