/**
 * MixerConfig — 混流器配置归一化工具模块
 *
 * 负责将外部传入的配置参数进行校验、归一化和默认值填充。
 * 所有方法均为纯函数（无副作用），方便单元测试。
 *
 * @module MixerConfig
 */

/** 新版混流配置的识别关键字列表 */
const MODERN_OPTION_KEYS = [
  'width',
  'height',
  'fps',
  'layoutMode',
  'backgroundColor',
  'audioGain',
  'renderMode',
  'workerUrl',
  'dropFrameWhenBusy',
  'maxFrameQueue',
  'preserveDrawingBuffer'
];

/** 合法的渲染后端模式集合 */
const VALID_RENDER_MODES = {
  auto            : true, // 自动选择（优先 Worker WebGL2）
  'worker-webgl2' : true, // Worker 线程 WebGL2
  'main-webgl2'   : true, // 主线程 WebGL2
  'worker-2d'     : true, // Worker 线程 Canvas2D
  'main-2d'       : true // 主线程 Canvas2D（最兼容）
};

/**
 * 创建归一化的混流配置对象。
 *
 * 根据传入的 options 参数，检测是否使用了新版配置项（如 width/height/fps），
 * 自动决定布局模式（legacy 或 grid），并对每个字段做合法性校验与默认值填充。
 *
 * @param {Object} [options={}] - 原始配置参数
 * @returns {Object} 归一化后的配置对象
 * @returns {boolean} returns.hasModernOptions - 是否显式传了新版配置项
 * @returns {boolean} returns.hasExplicitRenderMode - 是否显式指定了渲染后端
 * @returns {string} returns.layoutMode - 布局模式：'legacy' | 'grid'
 * @returns {Object} returns.config - 归一化后的具体配置
 */
exports.create = function(options)
{
  options = options || {};

  const hasModernOptions = exports.hasMixerOptions(options);
  const hasExplicitRenderMode = Object.prototype.hasOwnProperty.call(options, 'renderMode');
  const layoutMode = options.layoutMode || (hasModernOptions ? 'grid' : 'legacy');

  return {
    hasModernOptions      : hasModernOptions,
    hasExplicitRenderMode : hasExplicitRenderMode,
    layoutMode            : layoutMode,
    config                : {
      width                 : exports.normalizePositiveInteger(options.width, layoutMode === 'legacy' ? null : 1280),
      height                : exports.normalizePositiveInteger(options.height, layoutMode === 'legacy' ? null : 720),
      fps                   : exports.normalizePositiveInteger(options.fps, null),
      backgroundColor       : options.backgroundColor || '#000',
      audioGain             : exports.normalizeGain(options.audioGain, 0.8),
      renderMode            : exports.normalizeRenderMode(options.renderMode, layoutMode === 'legacy' ? 'main-2d' : 'auto'),
      workerUrl             : typeof options.workerUrl === 'string' ? options.workerUrl : null,
      dropFrameWhenBusy     : options.dropFrameWhenBusy === false ? false : true,
      maxFrameQueue         : exports.normalizePositiveInteger(options.maxFrameQueue, 1),
      preserveDrawingBuffer : options.preserveDrawingBuffer === false ? false : true
    }
  };
};

/**
 * 检测 options 中是否包含新版配置项。
 * 旧版调用方不传任何配置时返回 false，保持 legacy 布局兼容。
 *
 * @param {Object} options - 用户传入的配置
 * @returns {boolean} true=至少包含一个新版配置项
 */
exports.hasMixerOptions = function(options)
{
  return Boolean(
    options &&
    MODERN_OPTION_KEYS.some((key) => Object.prototype.hasOwnProperty.call(options, key))
  );
};

/**
 * 归一化渲染模式字符串。
 * 非法值统一回退到 fallback，避免外部拼写错误导致构造异常。
 *
 * @param {*} value - 原始传入的 renderMode
 * @param {string} fallback - 非法或未传时使用的备选值
 * @returns {string} 合法的渲染模式
 */
exports.normalizeRenderMode = function(value, fallback)
{
  if (typeof value === 'string' && VALID_RENDER_MODES[value])
  {
    return value;
  }

  return fallback || 'auto';
};

/**
 * 归一化为正整数。
 * 对外暴露的 width/height/fps 只接受正数，非法值回退到 fallback。
 *
 * @param {*} value - 原始输入值
 * @param {number|null} fallback - 非法时使用的备选值
 * @returns {number|null} 归一化后的正整数，或 fallback
 */
exports.normalizePositiveInteger = function(value, fallback)
{
  const numberValue = Number(value);

  if (Number.isFinite(numberValue) && numberValue > 0)
  {
    return Math.floor(numberValue);
  }

  return fallback;
};

/**
 * 归一化 slot 值。
 * slot 只允许非负整数，数组批量添加时从起始 slot 递增。
 *
 * @param {*} value - 原始 slot 值
 * @param {number} index - 在数组中的索引，批量添加时累加到 slot 上
 * @returns {number|null} 归一化后的 slot，非法则返回 null
 */
exports.normalizeSlot = function(value, index)
{
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue))
  {
    return null;
  }

  return Math.max(0, Math.floor(numberValue)) + index;
};

/**
 * 归一化音量增益值。
 * 允许大于 1 做放大（音频增强场景），但不允许负数。非法值使用 fallback。
 *
 * @param {*} value - 原始增益值
 * @param {number} fallback - 非法时的备选值
 * @returns {number} 归一化后的增益值（>= 0）
 */
exports.normalizeGain = function(value, fallback)
{
  const numberValue = Number(value);

  if (Number.isFinite(numberValue) && numberValue >= 0)
  {
    return numberValue;
  }

  return fallback;
};

/**
 * 统一 appendStream() 第二个参数的格式。
 * 支持两种调用方式：
 *   appendStream(stream, 3)               → 数字作为 slot
 *   appendStream(stream, { slot, gain })  → 对象解构
 *
 * @param {number|Object} optionsOrSlot - 原始参数（数字或对象）
 * @param {number} index - 数组索引，批量添加时 slot 递增
 * @param {number} defaultGain - 未指定 gain 时使用的默认值
 * @returns {Object} 归一化后的源配置 { slot: number|null, gain: number|undefined }
 */
exports.normalizeSourceOptions = function(optionsOrSlot, index, defaultGain)
{
  const options = {};

  if (typeof optionsOrSlot === 'number')
  {
    options.slot = exports.normalizeSlot(optionsOrSlot, index);
  }
  else if (optionsOrSlot && typeof optionsOrSlot === 'object')
  {
    if (typeof optionsOrSlot.slot === 'number')
    {
      options.slot = exports.normalizeSlot(optionsOrSlot.slot, index);
    }

    if (typeof optionsOrSlot.gain === 'number')
    {
      options.gain = exports.normalizeGain(optionsOrSlot.gain, defaultGain);
    }
  }

  return options;
};
