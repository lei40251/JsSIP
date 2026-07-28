/**
 * AiVBState —— 源级别 AI 虚拟背景控制器
 *
 * 管理每个视频源（source）的 AI 虚拟背景效果生命周期：
 *   - 配置归一化与校验
 *   - MediaPipe 分割器运行时的创建与销毁
 *   - 背景图的异步加载与缓存
 *   - 分割调度（fps 节流、frameSkip、排队去重）
 *   - 向渲染器提供可绘制状态（遮罩 + 背景图 + 工作画布）
 *
 * 每个 source 的状态通过 WeakMap 存储，不污染 source 对象本身；
 * 但运行时、工作画布、背景图等资源仍需通过 removeSource()/destroy() 主动清理。
 *
 * @module AiVBState
 */

const AiVBConfig = require('./AiVBConfig');
const MediaPipeSegmenterRuntime = require('./MediaPipeSegmenterRuntime');
const issueUtils = require('../../MediaEffectsIssue');

// =============================================================================
// 常量
// =============================================================================

/** 分割器运行时启动延迟（毫秒），避免通话建立初期 CPU 争抢 */
const DEFAULT_RUNTIME_STARTUP_DELAY_MS = 1500;

/** 分割器运行时默认最大帧率，平衡效果与性能 */
const DEFAULT_MAX_RUNTIME_FPS = 15;
const VALID_MODES = [ 'image', 'color', 'blur', 'none' ];
const getErrorMessage = issueUtils.getErrorMessage;

// =============================================================================
// 纯函数工具
// =============================================================================

/**
 * 浅拷贝对象，非对象或 null 返回空对象。
 *
 * @param {*} input - 任意输入
 * @returns {Object} 浅拷贝后的对象
 */
function cloneObject(input)
{
  return input && typeof input === 'object' ? Object.assign({}, input) : {};
}

/**
 * 将数值钳位到 [min, max] 范围，非有限数返回 fallback。
 *
 * @param {*} value - 输入值
 * @param {number} min - 下限
 * @param {number} max - 上限
 * @param {number} fallback - 非法值时的回退值
 * @returns {number} 钳位后的数值
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
 * 根据用户参数自动推断 AI 虚拟背景模式。
 *
 * 推断优先级：
 *   1. 显式指定 mode 字符串 → 直接使用
 *   2. 有 imageUrl → 'image'（图片替换背景）
 *   3. 有 color → 'color'（纯色背景）
 *   4. 有 blurRadius → 'blur'（模糊背景）
 *   5. 以上均无 → 'none'（关闭效果）
 *
 * @param {Object} options - 用户原始配置
 * @returns {string} 解析后的模式：'image' | 'color' | 'blur' | 'none'
 */
function resolveMode(options)
{
  const rawMode = typeof options.mode === 'string' ? options.mode.trim().toLowerCase() : '';

  if (rawMode)
  {
    return VALID_MODES.indexOf(rawMode) !== -1 ? rawMode : 'none';
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

/**
 * 根据模式获取对应的核心参数值。
 *
 * @param {string} mode - 效果模式
 * @param {Object} options - 用户配置
 * @returns {string|number|null} 模式对应的值，或 null
 */
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

/**
 * 完整归一化用户传入的 AI 虚拟背景配置。
 *
 * 将各种简写形式（true / 字符串 / 部分对象）统一为规范结构体。
 * 输入为 null/undefined/false 或 enabled=false 时返回 null（禁用效果）。
 *
 * @param {boolean|Object|null|undefined} input - 用户原始配置
 * @returns {Object|null} 归一化后的配置对象，或 null（禁用）
 */
function normalizeConfig(input)
{
  // null / undefined / false → 禁用效果
  if (input === undefined || input === null || input === false)
  {
    return null;
  }

  // true → 默认模糊背景
  const options = input === true ? { mode: 'blur' } : cloneObject(input);

  // 显式禁用
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

  // blur 模式：用用户指定的 blurRadius 覆盖后处理默认值（但不超过 maxBlurRadius）
  if (mode === 'blur' && Number.isFinite(value))
  {
    postProcessing.blurRadius = Math.max(0, Math.min(postProcessing.maxBlurRadius, value));
  }

  return {
    enabled         : true, // 效果是否启用
    mode            : mode, // 效果模式：image / color / blur / none
    imageUrl        : mode === 'image' && typeof value === 'string' ? value : null, // 背景图片 URL
    backgroundColor : mode === 'color' && typeof value === 'string' ? value : null, // 背景色
    blurRadius      : postProcessing.blurRadius, // 模糊半径（始终使用钳位后的后处理值）
    modelPath       : typeof options.modelPath === 'string' && options.modelPath.trim() ? options.modelPath.trim() : null, // 分割模型路径
    runtimeEnabled  : options.runtimeEnabled !== false, // 是否启用运行时（Worker 内或主线程内动态加载）
    startupDelayMs  : Math.floor(clampNumber( // 启动延迟，避免初始化阶段 CPU 争抢
      options.startupDelayMs,
      0, 
      10000, 
      DEFAULT_RUNTIME_STARTUP_DELAY_MS
    )),
    maxRuntimeFps : clampNumber( // 分割器最大帧率，默认跟随视频帧率
      options.maxRuntimeFps,
      1,
      30,
      Number.isFinite(Number(options.video && options.video.targetFps)) && Number(options.video.targetFps) > 0
        ? Number(options.video.targetFps)
        : DEFAULT_MAX_RUNTIME_FPS
    ),
    video          : video, // 视频流归一化配置
    segmentation   : segmentation, // 分割归一化配置
    postProcessing : postProcessing, // 后处理归一化配置
    assetConfig    : assetConfig // 资源路径归一化配置
  };
}

/**
 * 创建配置对象的深拷贝快照（避免外部修改影响内部状态）。
 *
 * @param {Object|null} config - 归一化配置
 * @returns {Object|null} 配置快照
 */
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

/**
 * 判断效果配置是否有效启用。
 * 条件：config 存在、enabled 不为 false、mode 不为 'none'。
 *
 * @param {Object|null} config - 归一化配置
 * @returns {boolean} true=效果有效启用
 */
function isEffectEnabled(config)
{
  return Boolean(config && config.enabled !== false && config.mode && config.mode !== 'none');
}

/**
 * 判断是否启用了运行时分割（Worker 内或主线程内动态加载 MediaPipe）。
 *
 * @param {Object|null} config - 归一化配置
 * @returns {boolean} true=运行时已启用
 */
function isRuntimeEnabled(config)
{
  return Boolean(config && config.runtimeEnabled === true);
}

/**
 * 生成分割器运行时的唯一配置 key。
 * 用于检测配置是否发生实质性变化（需重新创建 segmenter）。
 *
 * @param {Object|null} config - 归一化配置
 * @returns {string} 配置 key（JSON 序列化）
 */
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

// =============================================================================
// AiVBState 类
// =============================================================================

module.exports = class AiVBState
{
  /**
   * @param {Object} [options={}]
   * @param {Object} [options.logger] - 日志记录器
   */
  constructor(options = {})
  {
    this._logger = options.logger || null;
    this._onIssue = typeof options.onIssue === 'function' ? options.onIssue : null;

    /**
     * Map<source, state> —— 每个 source 的 AI 虚拟背景状态。
     * 使用 Map 以支持 clear() 遍历销毁所有运行时（防止 WASM/GPU 资源泄漏），
     * 生命周期由 removeSource() 显式管理，不依赖 GC。
     */
    this._states = new Map();
  }

  /**
   * 内部异常报告方法。
   *
   * 向上报告 AI 虚拟背景功能运行过程中的各类问题，包括：
   * - aivb-runtime-init: AI 模型运行时初始化失败（如模型加载失败、TFLite 不支持）
   * - aivb-background-image-create: 背景图片元素不可用
   * - aivb-background-image-load: 背景图片 URL 加载失败
   * - aivb-segmentation: 人像分割执行失败（不中断渲染，渲染器回退到直接绘制原始帧）
   *
   * 设计要点：
   * - 若无 onIssue 回调则直接返回，不做任何操作，保证模块独立性
   * - 回调本身会被 try-catch 包裹，防止外部回调异常影响到正常业务流程
   * - 默认 severity 为 'warn' 且 fallbackApplied/degraded 为 true，
   *   因为 AiVB 的所有异常场景都有降级方案（不处理 = 输出原始帧）
   *
   * @param {Object} [issue] - 问题描述对象
   */
  _reportIssue(issue)
  {
    if (!this._onIssue) return;
    try { this._onIssue(Object.assign({ component: 'AiVBState' }, issue)); }
    catch (e) { if (this._logger) this._logger.warn(`AiVBState issue callback failed: ${ e.message || String(e)}`); }
  } 

  // ---------------------------------------------------------------------------
  // 公开 API
  // ---------------------------------------------------------------------------

  /**
   * 归一化用户输入的 AI 虚拟背景配置。
   * 纯函数，不修改 source 状态。
   *
   * @param {boolean|Object|null} input - 用户配置
   * @returns {Object|null} 归一化配置
   */
  normalizeInput(input)
  {
    return normalizeConfig(input);
  }

  /**
   * 为指定 source 设置 AI 虚拟背景配置。
   *
   * 如果配置禁用效果，会主动清除该 source 的状态和运行时。
   * 如果配置启用但 runtimeConfigKey 变化（模型/模块/delegate 改变），会重建运行时。
   * 如果背景图 URL 变化，会重置背景图加载状态。
   *
   * @param {Object} source - 内部 source 对象
   * @param {boolean|Object|null} input - 用户配置
   * @returns {Object|null} 归一化后的配置快照
   */
  setSourceConfig(source, input)
  {
    if (!source)
    {
      return null;
    }

    const config = normalizeConfig(input);

    // 将归一化配置写回 source 对象，供渲染器读取
    source.aiBackground = config;

    // 效果被禁用 → 清理该 source 的所有运行时状态
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
    state.generation += 1; // 递增代数，使旧异步回调失效
    this._invalidateSeg(state);
    state.runtimeAllowedAt = this._now() + config.startupDelayMs; // 最早允许启动分割的时间

    if (!isRuntimeEnabled(config))
    {
      // 运行时被禁用 → 销毁 runtime 实例
      this._resetRuntime(state);
      state.runtimeConfigKey = '';
    }
    else
    {
      // 运行时启用中
      if (state.runtimeInitializing || runtimeConfigChanged)
      {
        // 正在初始化或配置已变 → 重建 runtime
        this._resetRuntime(state);
      }

      state.runtimeConfigKey = runtimeConfigKey;
    }

    // 背景图 URL 变化 → 重置加载状态，触发重新加载
    if (state.backgroundImageUrl !== config.imageUrl)
    {
      state.bgImageReqId += 1;
      state.backgroundImageUrl = config.imageUrl;
      state.bgImageStatus = 'idle';
      state.bgImageError = '';
      state.bgImagePendingUrl = null;
      state.loadingImage = false;
    }

    return cloneConfigSnapshot(config);
  }

  /**
   * 获取指定 source 的当前 AI 虚拟背景配置快照。
   *
   * @param {Object} source - 内部 source 对象
   * @returns {Object|null} 配置快照
   */
  getSourceConfig(source)
  {
    return cloneConfigSnapshot(source && source.aiBackground);
  }

  /**
   * 清除指定 source 的 AI 虚拟背景配置和运行时状态。
   *
   * @param {Object} source - 内部 source 对象
   */
  clearSourceConfig(source)
  {
    if (!source)
    {
      return;
    }

    source.aiBackground = null;
    this.removeSource(source);
  }

  /**
   * 检查指定 source 是否启用了 AI 虚拟背景效果。
   *
   * @param {Object} source - 内部 source 对象
   * @returns {boolean} true=效果已启用
   */
  hasEnabledEffect(source)
  {
    return isEffectEnabled(source && source.aiBackground);
  }

  /**
   * 预加载 source 的渲染资源（背景图等）。
   * 在 mirror 等配置变更时提前触发，避免首帧白屏。
   *
   * @param {Object} source - 内部 source 对象
   * @param {HTMLVideoElement} videoElement - 关联的 video 元素
   */
  preloadRenderAssets(source, videoElement)
  {
    if (!source || !this.hasEnabledEffect(source))
    {
      return;
    }

    const state = this._ensureState(source);
    const config = source.aiBackground;

    state.config = config;

    // 视频未就绪时不加载（无意义）
    if (!this._isVideoReadyForSeg(videoElement))
    {
      return;
    }

    this._ensureBgImage(state);
  }

  /**
   * 获取当前帧 source 的可渲染状态。
   *
   * 渲染器调用此方法获取最新的遮罩和背景图。
   * 内部会按需触发分割调度和背景图加载。
   *
   * @param {Object} source - 内部 source 对象
   * @param {HTMLVideoElement} videoElement - 当前帧的 video 元素
   * @returns {Object|null} 可渲染状态 { config, latestMask, latestFrame, backgroundImage, state }
   */
  getRenderableState(source, videoElement)
  {
    if (!source || !this.hasEnabledEffect(source))
    {
      return null;
    }

    const state = this._ensureState(source);
    const config = source.aiBackground;
    const videoReady = this._isVideoReadyForSeg(videoElement);

    state.config = config;

    if (videoReady)
    {
      // 确保背景图（image 模式）正在加载
      this._ensureBgImage(state);

      if (isRuntimeEnabled(config))
      {
        const now = this._now();

        // 启动延迟过后才允许调度分割
        if (now >= state.runtimeAllowedAt)
        {
          this._ensureRuntime(state);
          this._scheduleSeg(state, videoElement, now);
        }
      }
    }

    return {
      config          : config, // 当前配置
      latestMask      : state.latestMask, // 最新分割遮罩 canvas
      latestFrame     : state.latestFrame, // 与 latestMask 对应的冻结视频帧 canvas
      backgroundImage : state.backgroundImage, // 背景图片（image 模式）
      state           : state // 内部状态（含 workCanvas 等工作画布）
    };
  }

  /**
   * 通知控制器当前帧已使用遮罩完成渲染。
   * 用于 frameSkip 计数：渲染器每用一次遮罩绘制就调用一次。
   *
   * @param {Object} source - 内部 source 对象
   * @param {boolean} usedMask - 本帧是否实际使用了遮罩
   */
  noteFrameRendered(source, usedMask)
  {
    const state = source ? this._states.get(source) : null;

    if (!state || !usedMask)
    {
      return;
    }

    state.renderedSinceSeg += 1;
  }

  /**
   * 移除指定 source 的所有 AI 虚拟背景状态。
   *
   * 清理步骤：
   *   1. 从 WeakMap 删除状态引用
   *   2. 标记 disposed，使所有异步回调失效
   *   3. 取消进行中和排队中的分割
   *   4. 释放遮罩 canvas、背景图引用
   *   5. 销毁 MediaPipe 分割器运行时
   *
   * @param {Object} source - 内部 source 对象
   */
  removeSource(source)
  {
    const state = source ? this._states.get(source) : null;

    if (!state)
    {
      return;
    }

    this._states.delete(source);
    state.disposed = true;
    state.generation += 1; // 递增代数，使所有进行中的异步回调失效
    state.pendingSegmentation = false;
    state.activeSegPromise = null;
    state.queuedSegPromise = null;
    state.lastQueuedSegAt = 0;
    state.lastSegAt = 0;
    state.runtimeInitBlocked = false;
    state.runtimeConfigKey = '';
    state.loadingImage = false;
    state.bgImageReqId += 1;
    state.latestMask = null;
    state.latestFrame = null;
    state.segFrameMap = null;
    state.backgroundImage = null;
    state.activeSegCanvas = null;
    state.activeSegContext = null;
    state.queuedSegCanvas = null;
    state.queuedSegContext = null;
    state.activeFrameCanvas = null;
    state.activeFrameContext = null;
    state.queuedFrameCanvas = null;
    state.queuedFrameContext = null;
    state.latestFrameCanvas = null;
    state.latestFrameContext = null;
    state.workCanvas = null;
    state.workContext = null;

    // 异步销毁 MediaPipe 运行时
    if (state.runtime && typeof state.runtime.destroy === 'function')
    {
      Promise.resolve(state.runtime.destroy())
        .catch(() => {});
    }
  }

  /**
   * 清除所有 source 的状态（通常在 composer stop 时调用）。
   *
   * 遍历所有状态，销毁 MediaPipe 分段器运行时以释放 WASM/GPU 资源，
   * 然后清除整个映射表。
   */
  clear()
  {
    this._states.forEach((state) =>
    {
      state.latestMask = null;
      state.latestFrame = null;
      if (state.segFrameMap)
      {
        state.segFrameMap.clear();
      }

      if (state.runtime && typeof state.runtime.destroy === 'function')
      {
        Promise.resolve(state.runtime.destroy())
          .catch(() => {});
      }
    });
    this._states.clear();
  }

  // ---------------------------------------------------------------------------
  // 内部方法
  // ---------------------------------------------------------------------------

  /**
   * 获取或创建 source 对应的 AI 虚拟背景内部状态。
   *
   * 状态字段说明：
   *   - config: 当前归一化配置
   *   - disposed: 是否已标记为销毁（异步回调检查此标记避免操作已释放资源）
   *   - generation: 配置代数，每次 setSourceConfig 递增，用于忽略过时的异步回调
   *   - runtime: MediaPipeSegmenterRuntime 实例
   *   - runtimeReady: 运行时是否已初始化完成
   *   - runtimeInitializing: 运行时是否正在初始化中
   *   - runtimeInitBlocked: 当前配置下初始化失败后，是否阻断重复自动初始化
   *   - runtimeInitError: 运行时初始化错误信息
   *   - runtimeConfigKey: 当前运行时对应的配置 key
   *   - pendingSegmentation: 是否有分割请求正在进行中
   *   - activeSegPromise / queuedSegPromise: 进行中/排队中的分割 Promise
   *   - runtimeAllowedAt: 最早允许启动分割的时间戳（startupDelayMs 之后）
   *   - latestMask/latestFrame: 最新遮罩及其对应的冻结视频帧 canvas
   *   - renderedSinceSeg: 自上次分割后已渲染的帧数（用于 frameSkip）
   *   - backgroundImage*: 背景图加载状态和引用
   *   - activeSegCanvas / queuedSegCanvas: 复用的离屏 canvas（各自独立，防止画面串扰）
   *   - workCanvas: 合成用工作画布
   *
   * @param {Object} source - 内部 source 对象
   * @returns {Object} 内部状态对象
   */
  _ensureState(source)
  {
    const existingState = source ? this._states.get(source) : null;

    if (existingState)
    {
      return existingState;
    }

    const state = {
      config              : source.aiBackground,
      disposed            : false, // 销毁标记
      generation          : 0, // 配置代数
      runtime             : null, // MediaPipe 分割器运行时
      runtimeReady        : false, // 运行时就绪标记
      runtimeInitializing : false, // 运行时初始化中
      runtimeInitBlocked  : false, // 当前配置下初始化失败后阻断重复自动重试
      runtimeInitError    : '', // 初始化错误信息
      runtimeConfigKey    : '', // 运行时配置 key
      pendingSegmentation : false, // 是否有进行中的分割
      activeSegPromise    : null, // 当前进行中的分割 Promise
      queuedSegPromise    : null, // 排队中的分割 Promise
      lastQueuedSegAt     : 0, // 上次更新排队帧输入的时间戳
      lastSegAt           : 0, // 上次调度分割的时间戳（用于 fps 节流）
      runtimeAllowedAt    : 0, // 最早允许启动分割的时间
      latestMask          : null, // 最新遮罩 canvas
      latestFrame         : null, // 与 latestMask 对应的冻结视频帧 canvas
      segFrameMap         : new Map(), // segmentation Promise → 发起分割时的视频帧 canvas
      renderedSinceSeg    : 0, // 分割后已渲染帧数
      backgroundImageUrl  : null, // 当前配置的背景图 URL
      bgImageLoadedUrl    : null, // 已加载完成的背景图 URL
      bgImagePendingUrl   : null, // 正在加载中的背景图 URL
      backgroundImage     : null, // 已加载的背景图 Image 元素
      bgImageStatus       : 'idle', // 背景图加载状态：idle / loading / ready / error
      bgImageError        : '', // 背景图加载错误信息
      bgImageReqId        : 0, // 背景图请求 ID（避免过时回调）
      loadingImage        : false, // 是否正在加载背景图
      activeSegCanvas     : null, // 送入当前进行中分割的缩放后帧 canvas（独立于排队帧）
      activeSegContext    : null, // activeSegCanvas 的 2D 上下文
      queuedSegCanvas     : null, // 送入排队中分割的缩放后帧 canvas（独立于进行中帧，防止画面串扰）
      queuedSegContext    : null, // queuedSegCanvas 的 2D 上下文
      activeFrameCanvas   : null, // 当前进行中分割对应的原始视频帧 canvas
      activeFrameContext  : null, // activeFrameCanvas 的 2D 上下文
      queuedFrameCanvas   : null, // 排队中分割对应的原始视频帧 canvas
      queuedFrameContext  : null, // queuedFrameCanvas 的 2D 上下文
      latestFrameCanvas   : null, // 渲染前景使用的稳定视频帧 canvas
      latestFrameContext  : null, // latestFrameCanvas 的 2D 上下文
      workCanvas          : null, // 合成用工作画布（前景抠图 + 背景合成）
      workContext         : null // workCanvas 的 2D 上下文
    };

    this._states.set(source, state);

    return state;
  }

  /**
   * 确保 MediaPipe 分割器运行时已初始化。
   *
   * 首次调用时创建 MediaPipeSegmenterRuntime 实例并异步初始化。
   * 使用 generation 机制确保过时的初始化回调不会污染当前状态。
   *
   * @param {Object} state - source 内部状态
   */
  _ensureRuntime(state)
  {
    if (!state || !state.config || !isEffectEnabled(state.config) || !isRuntimeEnabled(state.config))
    {
      return;
    }

    // 已就绪、正在初始化或当前配置下已判定失败 → 跳过
    if (state.runtimeReady || state.runtimeInitializing || state.runtimeInitBlocked)
    {
      return;
    }

    state.runtime = state.runtime || new MediaPipeSegmenterRuntime({
      assetConfig : state.config.assetConfig,
      onIssue     : this._reportIssue.bind(this)
    });
    state.runtimeInitializing = true;
    state.runtimeInitBlocked = false;
    state.runtimeInitError = '';
    const generation = state.generation; // 保存当前代数，用于回调中比对

    state.runtime.initialize({
      modelPath : state.config.modelPath,
      delegate  : state.config.segmentation.delegate
    })
      .then(() =>
      {
        // 状态已被替换（generation 不匹配）或已销毁 → 忽略
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

        state.runtimeInitError = getErrorMessage(error);
        state.runtimeInitBlocked = true;

        if (this._logger)
        {
          this._logger.warn(
            `AiVB runtime init failed: error=${state.runtimeInitError} ` +
            `modelPath=${state.config && state.config.modelPath ? state.config.modelPath : ''} ` +
            `delegate=${state.config && state.config.segmentation ? state.config.segmentation.delegate : ''} ` +
            `assetConfig=${JSON.stringify(state.config && state.config.assetConfig ? state.config.assetConfig : {})}`
          );
        }
        if (!error || error.__mediaEffectsIssueReported !== true)
        {
          this._reportIssue({
            stage   : 'aivb-runtime-init',
            message : state.runtimeInitError,
            details : {
              modelPath   : state.config && state.config.modelPath ? state.config.modelPath : '',
              delegate    : state.config && state.config.segmentation ? state.config.segmentation.delegate : '',
              assetConfig : state.config && state.config.assetConfig ? cloneObject(state.config.assetConfig) : {}
            }
          });
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

  /**
   * 重置并销毁运行时状态。
   * 清理遮罩、取消进行中的分割、销毁 MediaPipe 实例。
   *
   * @param {Object} state - source 内部状态
   */
  _resetRuntime(state)
  {
    if (!state)
    {
      return;
    }

    state.runtimeReady = false;
    state.runtimeInitializing = false;
    state.runtimeInitBlocked = false;
    state.runtimeInitError = '';
    state.pendingSegmentation = false;
    state.activeSegPromise = null;
    state.queuedSegPromise = null;
    state.lastQueuedSegAt = 0;
    state.lastSegAt = 0;
    state.latestMask = null;
    state.latestFrame = null;
    if (state.segFrameMap)
    {
      state.segFrameMap.clear();
    }

    if (state.runtime && typeof state.runtime.destroy === 'function')
    {
      Promise.resolve(state.runtime.destroy())
        .catch(() => {});
    }

    state.runtime = null;
  }

  /**
   * 确保背景图已加载（image 模式）。
   *
   * 处理以下场景：
   *   - 背景图未加载 → 创建 Image 元素开始加载
   *   - 背景图 URL 与已加载的一致 → 复用
   *   - 背景图正在加载且 URL 不变 → 等待
   *   - 加载失败且 URL 不变 → 不重试
   *
   * @param {Object} state - source 内部状态
   */
  _ensureBgImage(state)
  {
    // 非 image 模式直接跳过
    if (!state || !state.config || state.config.mode !== 'image')
    {
      return;
    }

    // 无 URL → 清空背景图
    if (!state.config.imageUrl)
    {
      state.backgroundImage = null;
      state.bgImageLoadedUrl = null;
      state.bgImagePendingUrl = null;
      state.bgImageStatus = 'idle';
      state.bgImageError = '';
      state.loadingImage = false;

      return;
    }

    // 已有正确加载的背景图 → 复用
    if (state.backgroundImage &&
      state.bgImageLoadedUrl === state.config.imageUrl)
    {
      return;
    }

    // 同一 URL 正在加载中 → 等待
    if (state.loadingImage &&
      state.bgImagePendingUrl === state.config.imageUrl)
    {
      return;
    }

    // 同一 URL 已加载失败 → 不重试（避免持续失败消耗资源）
    if (state.bgImageStatus === 'error' &&
      state.bgImagePendingUrl === state.config.imageUrl)
    {
      return;
    }

    const image = this._createImageElement();
    const requestId = state.bgImageReqId + 1;
    const imageUrl = state.config.imageUrl;

    // 环境不支持 Image 构造
    if (!image)
    {
      state.bgImageStatus = 'error';
      state.bgImageError = 'Image element is unavailable';
      state.bgImagePendingUrl = state.config.imageUrl;
      if (this._logger)
      {
        this._logger.warn(
          `AiVB background image unavailable: url=${state.config && state.config.imageUrl ? state.config.imageUrl : ''} ` +
          `mode=${state.config && state.config.mode ? state.config.mode : ''}`
        );
      }
      this._reportIssue({
        stage   : 'aivb-background-image-create',
        message : state.bgImageError,
        details : {
          imageUrl : state.config && state.config.imageUrl ? state.config.imageUrl : '',
          mode     : state.config && state.config.mode ? state.config.mode : ''
        }
      });

      return;
    }

    state.bgImageReqId = requestId;
    state.loadingImage = true;
    state.bgImageStatus = 'loading';
    state.bgImagePendingUrl = imageUrl;
    state.bgImageError = '';

    image.onload = () =>
    {
      // 请求 ID 不匹配 → 已有更新的请求，忽略
      if (state.disposed || state.bgImageReqId !== requestId)
      {
        return;
      }

      state.loadingImage = false;
      state.backgroundImage = image;
      state.bgImageLoadedUrl = imageUrl;
      state.bgImagePendingUrl = null;
      state.bgImageStatus = 'ready';
      state.bgImageError = '';
    };
    image.onerror = () =>
    {
      if (state.disposed || state.bgImageReqId !== requestId)
      {
        return;
      }

      state.loadingImage = false;
      state.bgImagePendingUrl = imageUrl;
      state.bgImageStatus = 'error';
      state.bgImageError = 'Failed to load background image';
      if (this._logger)
      {
        this._logger.warn(`AiVB background image failed: url=${imageUrl} requestId=${requestId}`);
      }
      this._reportIssue({
        stage   : 'aivb-background-image-load',
        message : state.bgImageError,
        details : {
          imageUrl  : imageUrl,
          requestId : requestId
        }
      });
    };
    image.src = imageUrl;
  }

  /**
   * 创建用于加载背景图的 Image 元素。
   * 设置 crossOrigin='anonymous' 避免跨域污染 canvas。
   *
   * @returns {HTMLImageElement|null} Image 元素，环境不支持时返回 null
   */
  _createImageElement()
  {
    let image = null;

    // 优先使用 Image 构造函数
    if (typeof Image !== 'undefined')
    {
      image = new Image();
    }
    // 回退到 document.createElement
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

  /**
   * 调度一次人像分割。
   *
   * 节流策略：
   *   1. frameSkip > 0 时，每隔 frameSkip 帧才执行一次分割
   *   2. maxRuntimeFps 限制每秒最大分割次数
   *   3. 同一时间最多一个进行中的分割 + 一个排队中的分割
   *   4. 排队中的帧总是保留最新的（latest-frame-wins）
   *
   * @param {Object} state - source 内部状态
   * @param {HTMLVideoElement} videoElement - 当前视频帧
   * @param {number} [now=this._now()] - 当前时间戳
   */
  _scheduleSeg(state, videoElement, now = this._now())
  {
    // 前置检查：运行时未就绪或视频不可用 → 跳过
    if (!state || !state.runtimeReady || !state.runtime || !this._isVideoReadyForSeg(videoElement))
    {
      return;
    }

    const frameSkip = state.config && state.config.segmentation ? state.config.segmentation.frameSkip : 0;
    const shouldRun = !state.latestMask || frameSkip <= 0 || state.renderedSinceSeg >= frameSkip;

    // frameSkip 条件不满足 → 跳过本帧
    if (!shouldRun)
    {
      return;
    }

    const generation = state.generation;

    if (state.pendingSegmentation && state.queuedSegPromise)
    {
      // 已有排队请求时不创建新任务，只刷新排队帧输入，保证下一次分割尽量使用最新画面。
      this._refreshQueuedInput(state, videoElement);

      return;
    }

    // fps 节流只限制新分割请求，不限制已有排队请求的输入刷新。
    if (!this._canSegment(state, now))
    {
      return;
    }

    if (state.pendingSegmentation)
    {
      // 已有进行中的分割，且排队位空闲 → 创建新的排队请求
      const queuedFrame = this._getSegFrame(state, videoElement, 'queued');
      const queuedSource = queuedFrame || videoElement;
      const segmentationInput = this._getSegInput(state, queuedSource, 'queued');
      const input = segmentationInput || queuedSource;
      const queuedPromise = state.runtime.segmentForVideo(input);

      state.queuedSegFrame = queuedFrame;
      state.segFrameMap.set(queuedPromise, queuedFrame);
      state.queuedSegPromise = queuedPromise;
      state.lastQueuedSegAt = now;
      state.lastSegAt = now;
      this._bindSegPromise(state, queuedPromise, generation);

      return;
    }

    // 无进行中的分割 → 直接发起新分割
    const activeFrame = this._getSegFrame(state, videoElement, 'active');
    const activeSource = activeFrame || videoElement;
    const segmentationInput = this._getSegInput(state, activeSource);
    const input = segmentationInput || activeSource;

    state.pendingSegmentation = true;
    const activePromise = state.runtime.segmentForVideo(input);

    state.activeSegFrame = activeFrame;
    state.segFrameMap.set(activePromise, activeFrame);
    state.activeSegPromise = activePromise;
    state.lastQueuedSegAt = 0;
    state.lastSegAt = now;
    this._bindSegPromise(state, activePromise, generation);
  }

  /**
   * 检查当前是否满足 fps 节流条件。
   *
   * @param {Object} state - source 内部状态
   * @param {number} now - 当前时间戳
   * @returns {boolean} true=可以调度分割
   */
  _canSegment(state, now)
  {
    const maxRuntimeFps = state.config ? Number(state.config.maxRuntimeFps) : DEFAULT_MAX_RUNTIME_FPS;
    const minInterval = Number.isFinite(maxRuntimeFps) && maxRuntimeFps > 0
      ? 1000 / maxRuntimeFps
      : 1000 / DEFAULT_MAX_RUNTIME_FPS;

    // 首次调度，无需节流
    if (!state.lastSegAt)
    {
      return true;
    }

    return now - state.lastSegAt >= minInterval;
  }

  /**
   * 将分割 Promise 的结果绑定到 state。
   *
   * 成功后更新 latestMask 和 renderedSinceSeg。
   * 失败时记录日志（不中断渲染，渲染器会回退到直接绘制原始视频帧）。
   * 完成后自动将排队中的分割提升为进行中。
   *
   * @param {Object} state - source 内部状态
   * @param {Promise} promise - 分割 Promise
   * @param {number} generation - 发起时的代数
   */
  _bindSegPromise(state, promise, generation)
  {
    promise
      .then((result) =>
      {
        // generation 不匹配 → 状态已被替换，忽略过时结果
        if (state.disposed || state.generation !== generation)
        {
          if (result && result.segmentationMask && typeof result.segmentationMask.close === 'function')
          {
            try { result.segmentationMask.close(); }
            catch (error) {}
          }

          return;
        }

        if (!result || !result.segmentationMask)
        {
          return;
        }
        const syncedFrame = this._copyLatestSegFrame(state, state.segFrameMap.get(promise));

        if (syncedFrame)
        {
          state.latestFrame = syncedFrame;
          state.latestMask = result.segmentationMask;
          state.renderedSinceSeg = 0;
        }
      })
      .catch((error) =>
      {
        if (state.disposed || state.generation !== generation)
        {
          return;
        }

        // 分割失败不中断渲染，渲染器会回退到直接绘制原始帧
        if (this._logger)
        {
          this._logger.warn(
            `AiVB segmentation failed: error=${getErrorMessage(error)} ` +
            `mode=${state.config && state.config.mode ? state.config.mode : ''} ` +
            `delegate=${state.config && state.config.segmentation ? state.config.segmentation.delegate : ''} ` +
            `runtimeReady=${state.runtimeReady} pending=${state.pendingSegmentation}`
          );
        }
        this._reportIssue({
          stage   : 'aivb-segmentation',
          message : getErrorMessage(error),
          details : {
            mode         : state.config && state.config.mode ? state.config.mode : '',
            delegate     : state.config && state.config.segmentation ? state.config.segmentation.delegate : '',
            runtimeReady : Boolean(state.runtimeReady),
            pending      : Boolean(state.pendingSegmentation)
          }
        });
      })
      .finally(() =>
      {
        if (state.segFrameMap)
        {
          state.segFrameMap.delete(promise);
        }

        const isCurrentGeneration = !state.disposed && state.generation === generation;

        // 当前进行中的 Promise 完成 → 提升排队中的 Promise 为进行中
        if (state.activeSegPromise === promise)
        {
          if (isCurrentGeneration && state.queuedSegPromise)
          {
            state.activeSegPromise = state.queuedSegPromise;
            state.activeSegFrame = state.queuedSegFrame;
            state.activeSegCanvas = state.queuedSegCanvas;
            state.activeSegContext = state.queuedSegContext;
            state.activeFrameCanvas = state.queuedFrameCanvas;
            state.activeFrameContext = state.queuedFrameContext;
            state.queuedSegPromise = null;
            state.queuedSegFrame = null;
            state.queuedSegCanvas = null;
            state.queuedSegContext = null;
            state.queuedFrameCanvas = null;
            state.queuedFrameContext = null;
            state.pendingSegmentation = true;

            return;
          }

          state.activeSegPromise = null;
          state.activeSegFrame = null;
          state.pendingSegmentation = false;

          return;
        }

        // 排队中的 Promise 被取消（更旧的排队可能已被替换）
        if (state.queuedSegPromise === promise)
        {
          state.queuedSegPromise = null;
          state.queuedSegFrame = null;
        }
      });
  }

  _invalidateSeg(state)
  {
    if (!state)
    {
      return;
    }

    state.pendingSegmentation = false;
    state.activeSegPromise = null;
    state.queuedSegPromise = null;
    state.activeSegFrame = null;
    state.queuedSegFrame = null;
    state.lastQueuedSegAt = 0;
    state.lastSegAt = 0;

    if (state.segFrameMap)
    {
      state.segFrameMap.clear();
    }
  }

  /**
   * 更新排队中分割请求的视频帧输入。
   * 不创建新的分割任务，只覆盖排队请求持有的输入帧，减少快动作时的遮罩滞后。
   *
   * @param {Object} state - source 内部状态
   * @param {HTMLVideoElement} videoElement - 当前视频帧
   */
  _refreshQueuedInput(state, videoElement)
  {
    state.lastQueuedSegAt = this._now();
    const queuedFrame = this._getSegFrame(state, videoElement, 'queued');
    const queuedSource = queuedFrame || videoElement;
    const segmentationInput = this._getSegInput(state, queuedSource, 'queued');
    const input = segmentationInput || queuedSource;

    state.queuedSegFrame = queuedFrame;
    if (state.queuedSegPromise)
    {
      state.segFrameMap.set(state.queuedSegPromise, queuedFrame);
    }

    if (state.runtime && typeof state.runtime.updateQueuedFrame === 'function')
    {
      state.runtime.updateQueuedFrame(input);
    }
  }

  /**
   * 保存与分割请求对应的原始视频帧。
   *
   * 遮罩结果回来后会和这张冻结帧一起合成前景，避免旧 mask 套当前 video 时把真实背景盖回虚拟背景。
   *
   * @param {Object} state - source 内部状态
   * @param {HTMLVideoElement} videoElement - 当前视频帧
   * @param {string} target - 目标画布标识：'active' 或 'queued'
   * @returns {HTMLCanvasElement|null} 冻结帧 canvas
   */
  _getSegFrame(state, videoElement, target = 'active')
  {
    if (!state || !videoElement || typeof document === 'undefined')
    {
      return null;
    }

    const configVideo = state.config && state.config.video ? state.config.video : {};
    const width = Number(videoElement.videoWidth) || Number(configVideo.width) || 0;
    const height = Number(videoElement.videoHeight) || Number(configVideo.height) || 0;

    if (!width || !height)
    {
      return null;
    }

    const canvasKey = target === 'queued' ? 'queuedFrameCanvas' : 'activeFrameCanvas';
    const contextKey = target === 'queued' ? 'queuedFrameContext' : 'activeFrameContext';

    if (!state[canvasKey])
    {
      state[canvasKey] = document.createElement('canvas');
      state[contextKey] = state[canvasKey].getContext('2d');
    }

    if (!state[contextKey])
    {
      return null;
    }

    if (state[canvasKey].width !== width)
    {
      state[canvasKey].width = width;
    }

    if (state[canvasKey].height !== height)
    {
      state[canvasKey].height = height;
    }

    state[contextKey].clearRect(0, 0, width, height);
    state[contextKey].drawImage(videoElement, 0, 0, width, height);

    return state[canvasKey];
  }

  _copyLatestSegFrame(state, frame)
  {
    if (!state || !frame || typeof document === 'undefined')
    {
      return null;
    }

    const width = Number(frame.width || frame.videoWidth || frame.displayWidth) || 0;
    const height = Number(frame.height || frame.videoHeight || frame.displayHeight) || 0;

    if (!width || !height)
    {
      return null;
    }

    if (!state.latestFrameCanvas)
    {
      state.latestFrameCanvas = document.createElement('canvas');
      state.latestFrameContext = state.latestFrameCanvas.getContext('2d');
    }

    if (!state.latestFrameContext)
    {
      return null;
    }

    if (state.latestFrameCanvas.width !== width)
    {
      state.latestFrameCanvas.width = width;
    }

    if (state.latestFrameCanvas.height !== height)
    {
      state.latestFrameCanvas.height = height;
    }

    state.latestFrameContext.clearRect(0, 0, width, height);
    state.latestFrameContext.drawImage(frame, 0, 0, width, height);

    return state.latestFrameCanvas;
  }

  /**
   * 准备送入分割模型的处理后帧。
   *
   * 将当前冻结帧按 processingScale 缩放到较小分辨率，
   * 绘制到指定的离屏 canvas 上。缩放后分辨率降低可减少 MediaPipe 推理耗时。
   *
   * @param {Object} state - source 内部状态
   * @param {HTMLVideoElement|HTMLCanvasElement} frameSource - 当前视频帧或已冻结帧
   * @param {string} target - 目标画布标识：'active' 使用 activeSegCanvas，'queued' 使用 queuedSegCanvas
   * @returns {HTMLCanvasElement|null} 缩放后的帧 canvas，视频未就绪时返回 null
   */
  _getSegInput(state, frameSource, target = 'active')
  {
    if (!state || !frameSource || typeof document === 'undefined')
    {
      return null;
    }

    const configVideo = state.config && state.config.video ? state.config.video : {};
    const sourceWidth = Number(frameSource.width || frameSource.videoWidth || frameSource.displayWidth) || Number(configVideo.width) || 0;
    const sourceHeight = Number(frameSource.height || frameSource.videoHeight || frameSource.displayHeight) || Number(configVideo.height) || 0;
    const processingScale = Number(configVideo.processingScale);

    if (!sourceWidth || !sourceHeight)
    {
      return null;
    }

    const scale = Number.isFinite(processingScale) ? Math.max(0.1, Math.min(1, processingScale)) : 1;
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvasKey = target === 'queued' ? 'queuedSegCanvas' : 'activeSegCanvas';
    const contextKey = target === 'queued' ? 'queuedSegContext' : 'activeSegContext';

    // 懒创建复用 canvas
    if (!state[canvasKey])
    {
      state[canvasKey] = document.createElement('canvas');
      state[contextKey] = state[canvasKey].getContext('2d');
    }

    if (!state[contextKey])
    {
      return null;
    }

    // 仅在尺寸变化时更新 canvas 尺寸
    if (state[canvasKey].width !== width)
    {
      state[canvasKey].width = width;
    }

    if (state[canvasKey].height !== height)
    {
      state[canvasKey].height = height;
    }

    state[contextKey].clearRect(0, 0, width, height);
    state[contextKey].drawImage(frameSource, 0, 0, width, height);

    return state[canvasKey];
  }

  /**
   * 检查 video 元素是否已准备好进行分割。
   * 条件：readyState >= 2 (HAVE_CURRENT_DATA)，且有非零分辨率。
   *
   * @param {HTMLVideoElement} videoElement - video 元素
   * @returns {boolean} true=视频就绪
   */
  _isVideoReadyForSeg(videoElement)
  {
    if (!videoElement || videoElement.readyState < 2)
    {
      return false;
    }

    const videoWidth = Number(videoElement.videoWidth) || 0;
    const videoHeight = Number(videoElement.videoHeight) || 0;

    return videoWidth > 0 && videoHeight > 0;
  }

  /**
   * 获取当前高精度时间戳（毫秒）。
   * 优先使用 performance.now()，回退到 Date.now()。
   *
   * @returns {number} 时间戳（ms）
   */
  _now()
  {
    return typeof performance !== 'undefined' && performance && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }
};
