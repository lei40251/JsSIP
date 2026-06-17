/**
 * SourceAiVBController —— 源级别 AI 虚拟背景控制器
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
 * @module SourceAiVBController
 */

const AiVBConfig = require('./AiVBConfig');
const MediaPipeSegmenterRuntime = require('./MediaPipeSegmenterRuntime');

// =============================================================================
// 常量
// =============================================================================

/** 分割器运行时启动延迟（毫秒），避免通话建立初期 CPU 争抢 */
const DEFAULT_RUNTIME_STARTUP_DELAY_MS = 1500;

/** 分割器运行时默认最大帧率，平衡效果与性能 */
const DEFAULT_MAX_RUNTIME_FPS = 15;

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

  // true → 空对象（使用全部默认值）
  const options = input === true ? {} : cloneObject(input);

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
    enabled         : true,                        // 效果是否启用
    mode            : mode,                        // 效果模式：image / color / blur / none
    imageUrl        : mode === 'image' && typeof value === 'string' ? value : null,  // 背景图片 URL
    backgroundColor : mode === 'color' && typeof value === 'string' ? value : null,  // 背景色
    blurRadius      : mode === 'blur' && Number.isFinite(value) ? value : postProcessing.blurRadius, // 模糊半径
    modelPath       : typeof options.modelPath === 'string' && options.modelPath.trim() ? options.modelPath.trim() : null, // 分割模型路径
    runtimeEnabled  : options.runtimeEnabled !== false,  // 是否启用运行时（Worker 内或主线程内动态加载）
    startupDelayMs  : Math.floor(clampNumber(       // 启动延迟，避免初始化阶段 CPU 争抢
      options.startupDelayMs,
      0,
      10000,
      DEFAULT_RUNTIME_STARTUP_DELAY_MS
    )),
    maxRuntimeFps : clampNumber(                    // 分割器最大帧率，默认跟随视频帧率
      options.maxRuntimeFps,
      1,
      30,
      Number.isFinite(Number(options.video && options.video.targetFps)) && Number(options.video.targetFps) > 0
        ? Number(options.video.targetFps)
        : DEFAULT_MAX_RUNTIME_FPS
    ),
    video          : video,                         // 视频流归一化配置
    segmentation   : segmentation,                  // 分割归一化配置
    postProcessing : postProcessing,                // 后处理归一化配置
    assetConfig    : assetConfig                    // 资源路径归一化配置
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
// SourceAiVBController 类
// =============================================================================

module.exports = class SourceAiVBController
{
  /**
   * @param {Object} [options={}]
   * @param {Object} [options.logger] - 日志记录器
   */
  constructor(options = {})
  {
    this._logger = options.logger || null;

    /**
     * WeakMap<source, state> —— 每个 source 的 AI 虚拟背景状态。
     * WeakMap 只负责避免把状态挂到 source 本身；运行时和画布资源仍需显式释放。
     */
    this._states = new WeakMap();
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
    source.aiVirtualBackground = config;

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
    state.generation += 1;                                    // 递增代数，使旧异步回调失效
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
      state.backgroundImageRequestId += 1;
      state.backgroundImageUrl = config.imageUrl;
      state.backgroundImageStatus = 'idle';
      state.backgroundImageError = '';
      state.backgroundImagePendingUrl = null;
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
    return cloneConfigSnapshot(source && source.aiVirtualBackground);
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

    source.aiVirtualBackground = null;
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
    return isEffectEnabled(source && source.aiVirtualBackground);
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
    const config = source.aiVirtualBackground;

    state.config = config;

    // 视频未就绪时不加载（无意义）
    if (!this._isVideoReadyForSegmentation(videoElement))
    {
      return;
    }

    this._ensureBackgroundImage(state);
  }

  /**
   * 获取当前帧 source 的可渲染状态。
   *
   * 渲染器调用此方法获取最新的遮罩和背景图。
   * 内部会按需触发分割调度和背景图加载。
   *
   * @param {Object} source - 内部 source 对象
   * @param {HTMLVideoElement} videoElement - 当前帧的 video 元素
   * @returns {Object|null} 可渲染状态 { config, latestMask, backgroundImage, state }
   */
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
      // 确保背景图（image 模式）正在加载
      this._ensureBackgroundImage(state);

      if (isRuntimeEnabled(config))
      {
        const now = this._now();

        // 启动延迟过后才允许调度分割
        if (now >= state.runtimeAllowedAt)
        {
          this._ensureRuntime(state);
          this._scheduleSegmentation(state, videoElement, now);
        }
      }
    }

    return {
      config          : config,              // 当前配置
      latestMask      : state.latestMask,     // 最新分割遮罩 canvas
      backgroundImage : state.backgroundImage, // 背景图片（image 模式）
      state           : state                 // 内部状态（含 workCanvas 等工作画布）
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

    state.renderedSinceSegmentation += 1;
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
    state.generation += 1;                                    // 递增代数，使所有进行中的异步回调失效
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

    // 异步销毁 MediaPipe 运行时
    if (state.runtime && typeof state.runtime.destroy === 'function')
    {
      Promise.resolve(state.runtime.destroy())
        .catch(() => {});
    }
  }

  /**
   * 清除所有 source 的状态（通常在 composer stop 时调用）。
   */
  clear()
  {
    this._states = new WeakMap();
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
   *   - runtimeInitError: 运行时初始化错误信息
   *   - runtimeConfigKey: 当前运行时对应的配置 key
   *   - pendingSegmentation: 是否有分割请求正在进行中
   *   - activeSegmentationPromise / queuedSegmentationPromise: 进行中/排队中的分割 Promise
   *   - runtimeAllowedAt: 最早允许启动分割的时间戳（startupDelayMs 之后）
   *   - latestMask: 最新的分割遮罩 canvas
   *   - renderedSinceSegmentation: 自上次分割后已渲染的帧数（用于 frameSkip）
   *   - backgroundImage*: 背景图加载状态和引用
   *   - segmentationCanvas / workCanvas: 复用的离屏 canvas
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
      config                        : source.aiVirtualBackground,
      disposed                      : false,         // 销毁标记
      generation                    : 0,             // 配置代数
      runtime                       : null,          // MediaPipe 分割器运行时
      runtimeReady                  : false,         // 运行时就绪标记
      runtimeInitializing           : false,         // 运行时初始化中
      runtimeInitError              : '',            // 初始化错误信息
      runtimeConfigKey              : '',            // 运行时配置 key
      pendingSegmentation           : false,         // 是否有进行中的分割
      activeSegmentationPromise     : null,          // 当前进行中的分割 Promise
      queuedSegmentationPromise     : null,          // 排队中的分割 Promise
      lastQueuedSegmentationInputAt : 0,             // 上次更新排队帧输入的时间戳
      lastSegmentationScheduledAt   : 0,             // 上次调度分割的时间戳（用于 fps 节流）
      runtimeAllowedAt              : 0,             // 最早允许启动分割的时间
      latestMask                    : null,          // 最新遮罩 canvas
      renderedSinceSegmentation     : 0,             // 分割后已渲染帧数
      backgroundImageUrl            : null,          // 当前配置的背景图 URL
      backgroundImageLoadedUrl      : null,          // 已加载完成的背景图 URL
      backgroundImagePendingUrl     : null,          // 正在加载中的背景图 URL
      backgroundImage               : null,          // 已加载的背景图 Image 元素
      backgroundImageStatus         : 'idle',        // 背景图加载状态：idle / loading / ready / error
      backgroundImageError          : '',            // 背景图加载错误信息
      backgroundImageRequestId      : 0,             // 背景图请求 ID（避免过时回调）
      loadingImage                  : false,         // 是否正在加载背景图
      segmentationCanvas            : null,          // 送入分割模型的缩放后帧 canvas
      segmentationContext           : null,          // segmentationCanvas 的 2D 上下文
      workCanvas                    : null,          // 合成用工作画布（前景抠图 + 背景合成）
      workContext                   : null           // workCanvas 的 2D 上下文
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

    // 已就绪或正在初始化 → 跳过
    if (state.runtimeReady || state.runtimeInitializing)
    {
      return;
    }

    state.runtime = state.runtime || new MediaPipeSegmenterRuntime({
      assetConfig : state.config.assetConfig
    });
    state.runtimeInitializing = true;
    state.runtimeInitError = '';
    const generation = state.generation;                      // 保存当前代数，用于回调中比对

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
  _ensureBackgroundImage(state)
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
      state.backgroundImageLoadedUrl = null;
      state.backgroundImagePendingUrl = null;
      state.backgroundImageStatus = 'idle';
      state.backgroundImageError = '';
      state.loadingImage = false;

      return;
    }

    // 已有正确加载的背景图 → 复用
    if (state.backgroundImage &&
      state.backgroundImageLoadedUrl === state.config.imageUrl)
    {
      return;
    }

    // 同一 URL 正在加载中 → 等待
    if (state.loadingImage &&
      state.backgroundImagePendingUrl === state.config.imageUrl)
    {
      return;
    }

    // 同一 URL 已加载失败 → 不重试（避免持续失败消耗资源）
    if (state.backgroundImageStatus === 'error' &&
      state.backgroundImagePendingUrl === state.config.imageUrl)
    {
      return;
    }

    const image = this._createImageElement();
    const requestId = state.backgroundImageRequestId + 1;
    const imageUrl = state.config.imageUrl;

    // 环境不支持 Image 构造
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
      // 请求 ID 不匹配 → 已有更新的请求，忽略
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
  _scheduleSegmentation(state, videoElement, now = this._now())
  {
    // 前置检查：运行时未就绪或视频不可用 → 跳过
    if (!state || !state.runtimeReady || !state.runtime || !this._isVideoReadyForSegmentation(videoElement))
    {
      return;
    }

    const frameSkip = state.config && state.config.segmentation ? state.config.segmentation.frameSkip : 0;
    const shouldRun = !state.latestMask || frameSkip <= 0 || state.renderedSinceSegmentation >= frameSkip;

    // frameSkip 条件不满足 → 跳过本帧
    if (!shouldRun)
    {
      return;
    }

    // fps 节流检查
    if (!this._canScheduleSegmentation(state, now))
    {
      return;
    }

    const generation = state.generation;

    if (state.pendingSegmentation)
    {
      // 已有进行中的分割
      if (state.queuedSegmentationPromise)
      {
        // 排队位已满 → 只更新排队帧的输入（latest-frame-wins）
        this._refreshQueuedSegmentationInput(state, videoElement);

        return;
      }

      // 排队位空闲 → 创建新的排队请求
      const segmentationInput = this._getSegmentationInput(state, videoElement);
      const input = segmentationInput || videoElement;
      const queuedPromise = state.runtime.segmentForVideo(input);

      state.queuedSegmentationPromise = queuedPromise;
      state.lastQueuedSegmentationInputAt = now;
      state.lastSegmentationScheduledAt = now;
      this._bindSegmentationPromise(state, queuedPromise, generation);

      return;
    }

    // 无进行中的分割 → 直接发起新分割
    const segmentationInput = this._getSegmentationInput(state, videoElement);
    const input = segmentationInput || videoElement;

    state.pendingSegmentation = true;
    const activePromise = state.runtime.segmentForVideo(input);

    state.activeSegmentationPromise = activePromise;
    state.lastQueuedSegmentationInputAt = 0;
    state.lastSegmentationScheduledAt = now;
    this._bindSegmentationPromise(state, activePromise, generation);
  }

  /**
   * 检查当前是否满足 fps 节流条件。
   *
   * @param {Object} state - source 内部状态
   * @param {number} now - 当前时间戳
   * @returns {boolean} true=可以调度分割
   */
  _canScheduleSegmentation(state, now)
  {
    const maxRuntimeFps = state.config ? Number(state.config.maxRuntimeFps) : DEFAULT_MAX_RUNTIME_FPS;
    const minInterval = Number.isFinite(maxRuntimeFps) && maxRuntimeFps > 0
      ? 1000 / maxRuntimeFps
      : 1000 / DEFAULT_MAX_RUNTIME_FPS;

    // 首次调度，无需节流
    if (!state.lastSegmentationScheduledAt)
    {
      return true;
    }

    return now - state.lastSegmentationScheduledAt >= minInterval;
  }

  /**
   * 将分割 Promise 的结果绑定到 state。
   *
   * 成功后更新 latestMask 和 renderedSinceSegmentation。
   * 失败时记录日志（不中断渲染，渲染器会回退到直接绘制原始视频帧）。
   * 完成后自动将排队中的分割提升为进行中。
   *
   * @param {Object} state - source 内部状态
   * @param {Promise} promise - 分割 Promise
   * @param {number} generation - 发起时的代数
   */
  _bindSegmentationPromise(state, promise, generation)
  {
    promise
      .then((result) =>
      {
        // generation 不匹配 → 状态已被替换，忽略过时结果
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

        // 分割失败不中断渲染，渲染器会回退到直接绘制原始帧
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

        // 当前进行中的 Promise 完成 → 提升排队中的 Promise 为进行中
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

        // 排队中的 Promise 被取消（更旧的排队可能已被替换）
        if (state.queuedSegmentationPromise === promise)
        {
          state.queuedSegmentationPromise = null;
        }
      });
  }

  /**
   * 更新排队中分割请求的视频帧输入。
   * 受 targetFps 节流，避免排队帧更新过于频繁。
   *
   * @param {Object} state - source 内部状态
   * @param {HTMLVideoElement} videoElement - 当前视频帧
   */
  _refreshQueuedSegmentationInput(state, videoElement)
  {
    const now = this._now();
    const targetFps = state.config && state.config.video ? Number(state.config.video.targetFps) : 15;
    const minInterval = Number.isFinite(targetFps) && targetFps > 0 ? 1000 / targetFps : 66;

    // 更新间隔不足 → 跳过（排队帧保持上一次的输入）
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

  /**
   * 准备送入分割模型的处理后帧。
   *
   * 将当前 video 帧按 processingScale 缩放到较小分辨率，
   * 绘制到复用的离屏 canvas 上。缩放后分辨率降低可减少 MediaPipe 推理耗时。
   *
   * @param {Object} state - source 内部状态
   * @param {HTMLVideoElement} videoElement - 当前视频帧
   * @returns {HTMLCanvasElement|null} 缩放后的帧 canvas，视频未就绪时返回 null
   */
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

    // 懒创建复用 canvas
    if (!state.segmentationCanvas)
    {
      state.segmentationCanvas = document.createElement('canvas');
      state.segmentationContext = state.segmentationCanvas.getContext('2d');
    }

    if (!state.segmentationContext)
    {
      return null;
    }

    // 仅在尺寸变化时更新 canvas 尺寸
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

  /**
   * 检查 video 元素是否已准备好进行分割。
   * 条件：readyState >= 2 (HAVE_CURRENT_DATA)，且有非零分辨率。
   *
   * @param {HTMLVideoElement} videoElement - video 元素
   * @returns {boolean} true=视频就绪
   */
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
