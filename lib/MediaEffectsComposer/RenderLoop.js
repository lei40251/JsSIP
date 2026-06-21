/**
 * RenderLoop — 混流器渲染循环
 *
 * 负责混流器的视频渲染节奏控制：
 *   - 通过 requestAnimationFrame 驱动帧循环
 *   - 按配置的 fps 节流，避免不必要的绘制
 *   - 管理渲染后端的生命周期（创建、销毁、故障降级）
 *   - 检测 Worker 渲染器故障，自动按配置降级到下一个可用后端
 *
 * @module RenderLoop
 */


const MainCanvas2DRenderer = require('./renderers/MainCanvas2DRenderer');
const MainWebGL2Renderer = require('./renderers/MainWebGL2Renderer');
const WorkerRenderer = require('./renderers/WorkerRenderer');
const issueUtils = require('../MediaEffectsIssue');
const getErrorMessage = issueUtils.getErrorMessage;


/**
 * 创建渲染器（原 RendererFactory 逻辑，已内联到 RenderLoop）。
 * 根据 renderMode 自动选择最优渲染后端。
 */
function createRenderer(canvas, config, hooks)
{
  const mode = config.renderMode || 'auto';
  const forceMainThread = config.forceMainThreadRenderer === true;
  const forceMain2D = config.forceMain2DRenderer === true;
  const errors = [];

  hooks = hooks || {};

  if (forceMain2D)
  {
    return createMain2D(canvas, config, true, 'Active source AI virtual background requires main-thread Canvas2D');
  }

  if (mode === 'main-2d')
  {
    return createMain2D(canvas, config, false, '');
  }

  if (forceMainThread && (mode === 'worker-webgl2' || mode === 'worker-2d'))
  {
    return createMainFallback(canvas, config, mode, 'Active source/output effects require a main-thread renderer');
  }

  // Safari/WKWebView prefer main-thread WebGL2
  if (mode === 'auto' && shouldPreferMainWebGL2())
  {
    try
    {
      const renderer = new MainWebGL2Renderer(config, {
        requestedMode : mode,
        isFallback    : true,
        reason        : 'Safari/WKWebView prefers main-thread WebGL2 because Worker WebGL2 support is limited'
      });

      renderer.init(canvas);
      
      return renderer;
    }
    catch (error)
    {
      errors.push(error.message || String(error));
    }
  }

  // Try Worker path
  if (
    !forceMainThread &&
    (mode === 'worker-webgl2' || mode === 'worker-2d' || mode === 'auto')
  )
  {
    try
    {
      const workerMode = mode === 'auto' ? 'worker-webgl2' : mode;
      const workerConfig = Object.assign({}, config, { renderMode: workerMode });
      const renderer = new WorkerRenderer(workerConfig, {
        requestedMode : mode,
        isFallback    : false,
        reason        : '',
        onFatalError  : hooks.onWorkerFatalError
      });

      renderer.init(canvas);
      
      return renderer; 
    }
    catch (error)
    {
      errors.push(error.message || String(error));
      if (mode === 'worker-webgl2' || mode === 'worker-2d')
      {
        return createMainFallback(canvas, config, mode, errors.join('; '));
      }
    }
  }

  // Try main-thread WebGL2
  if (mode === 'main-webgl2' || mode === 'auto')
  {
    try
    {
      const renderer = new MainWebGL2Renderer(config, {
        requestedMode : mode,
        isFallback    : errors.length > 0,
        reason        : errors.join('; ')
      });

      renderer.init(canvas);
      
      return renderer;
    }
    catch (error)
    {
      errors.push(error.message || String(error));
    }
  }

  // Ultimate fallback: main thread Canvas2D
  return createMain2D(canvas, config, errors.length > 0, errors.join('; '));
}

function createMainFallback(canvas, config, requestedMode, reason)
{
  if (config.forceMain2DRenderer === true)
  {
    return createMain2D(canvas, config, true, reason);
  }

  if (requestedMode !== 'worker-2d')
  {
    try
    {
      const renderer = new MainWebGL2Renderer(config, {
        requestedMode : requestedMode,
        isFallback    : true,
        reason        : reason
      });

      renderer.init(canvas);
      
      return renderer;
    }
    catch (error) {}
  }

  return createMain2D(canvas, config, true, reason);
}

function createMain2D(canvas, config, isFallback, reason)
{
  const renderer = new MainCanvas2DRenderer(config, {
    requestedMode : config.renderMode || 'auto',
    isFallback    : Boolean(isFallback),
    reason        : reason || ''
  });

  renderer.init(canvas);
  
  return renderer;
}

function shouldPreferMainWebGL2()
{
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua);
  const isIOSWebView = /iPhone|iPad|iPod/i.test(ua) && !/Safari/i.test(ua);

  return isSafari || isIOSWebView;
}
class RenderLoop
{
  /**
   * @param {Object} options
   * @param {HTMLCanvasElement} options.canvas - 输出 canvas 元素
   * @param {Object} options.config - 混流配置
   * @param {Object} options.logger - 日志记录器
   * @param {Function} options.getSources - 返回当前源列表的回调
   * @param {Function} options.createRenderPayload - 创建渲染 payload 的函数
   * @param {Function} options.syncExternalSourceAudio - 同步外部源音频的函数
   * @param {Function} options.onStateChange - 状态变化回调（已弃用，保留为空函数）
   * @param {Function} [options.onFramePresented] - 帧真正输出到主画布后的回调
   */
  constructor(options)
  {
    options = options || {};

    this._canvas = options.canvas;
    this._config = options.config;
    this._logger = options.logger;
    this._getSources = options.getSources;
    this._createRenderPayload = options.createRenderPayload;
    this._syncExternalSourceAudio = options.syncExternalSourceAudio;
    this._onStateChange = options.onStateChange;
    this._onFramePresented = options.onFramePresented;
    this._onIssue = typeof options.onIssue === 'function' ? options.onIssue : null;

    /** @type {BaseRenderer|null} 当前使用的渲染后端实例 */
    this._renderer = null;

    /** @type {number|null} requestAnimationFrame 返回的 ID，用于 cancel */
    this._animationId = null;

    /** @type {number} 上一次真正执行合成的时间戳（performance.now） */
    this._lastRenderTime = 0;

    /** @type {number} 目标帧间隔（毫秒），由 fps 计算，0 表示不节流 */
    this._renderFrameInterval = this._config.fps ? 1000 / this._config.fps : 0;

    /** @type {number} 连续渲染失败次数，用于诊断渲染后端异常 */
    this._renderErrorCount = 0;

    /** @type {number} 连续 renderer 失败次数，达到阈值后触发后端降级 */
    this._rendererErrorCount = 0;

    /** @type {boolean} 停止标记；设为 true 时 rAF 回调直接返回 */
    this._stopped = false;

    /** @type {string} 最近一次已输出的渲染路径签名，避免重复刷日志 */
    this._lastRenderPathSignature = '';

    // bind 一次避免每帧创建新函数
    this._boundRenderFrame = this.renderFrame.bind(this);

    if (this._logger)
    {
      this._logger.debug(`RenderLoop constructed: fps=${this._config.fps || 0} renderMode=${this._config.renderMode}`);
    }
  }

  /**
   * 内部异常报告方法。
   *
   * 上报渲染循环中的各类问题，包括：
   * - renderer-fallback-requested: 当前渲染后端不满足需求，触发降级链
   * - renderer-fallback-main-webgl2: 降级到主线程 WebGL2 成功
   * - renderer-fallback-main-webgl2-failed: 降级到主线程 WebGL2 失败
   * - renderer-fallback-worker-2d: 降级到 Worker 2D 成功
   * - renderer-fallback-worker-2d-failed: 降级到 Worker 2D 失败
   * - renderer-render-frame: 渲染帧失败（增加错误计数）
   *
   * 渲染降级链优先级顺序：
   *   Worker WebGL2 → 主线程 WebGL2 → Worker 2D
   * 每一级降级失败都会上报，方便排查为何最底层的 2D 模式也被触发。
   * 降级尝试失败时 fallbackApplied 设为 false，成功时设为 true。
   *
   * @param {Object} [issue] - 问题描述对象
   */
  _reportIssue(issue)
  {
    if (!this._onIssue) return;
    try { this._onIssue(Object.assign({ component: 'RenderLoop', severity: 'warn' }, issue)); }
    catch (e) { if (this._logger) this._logger.warn(`RenderLoop issue callback failed: ${ e.message || String(e)}`); }
  }

  /**
   * 恢复渲染循环（清除停止标记）。
   */
  resume()
  {
    this._stopped = false;

    if (this._logger)
    {
      this._logger.debug('RenderLoop resumed');
    }
  }

  /**
   * 启动渲染循环。
   * 先恢复再调度下一帧。
   */
  start()
  {
    if (this._logger)
    {
      this._logger.debug('RenderLoop start requested');
    }

    this.resume();
    this._scheduleNextFrame();
  }

  /**
   * 停止渲染循环。
   * 取消待处理的 rAF，设置停止标记。
   */
  stop()
  {
    this._stopped = true;

    if (this._logger)
    {
      this._logger.debug('RenderLoop stopped');
    }

    if (this._animationId)
    {
      window.cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  /**
   * 重置帧计时器。
   * 在下一次渲染时忽略 fps 节流，立即合成一帧。
   * 用于刚添加源时需要立即刷新画面的场景。
   */
  resetFrameTiming()
  {
    this._lastRenderTime = 0;

    if (this._logger)
    {
      this._logger.debug('RenderLoop frame timing reset');
    }
  }

  /**
   * 确保渲染后端已创建。
   * 首次调用时通过 createRenderer 根据配置创建实际渲染器。
   *
   * @returns {BaseRenderer} 当前渲染后端
   */
  ensureRenderer()
  {
    if (!this._renderer)
    {
      if (this._logger)
      {
        this._logger.debug(`Creating renderer: requestedMode=${this._config.renderMode}`);
      }

      this._renderer = createRenderer(this._canvas, this._config, {
        onWorkerFatalError : (reason) =>
        {
          this.fallbackRenderer(reason || 'Worker renderer failed at runtime');
        }
      });
      this._bindFrameCb(this._renderer);
      this._logRenderPath(this._renderer.getInfo(), 'create');
    }

    return this._renderer;
  }

  /**
   * 调整渲染器输出尺寸。
   *
   * @param {number} width - 新宽度
   * @param {number} height - 新高度
   */
  resizeRenderer(width, height)
  {
    if (this._renderer)
    {
      this._renderer.resize(width, height);
    }
  }

  /**
   * 从渲染器中移除一路源的绘制数据。
   *
   * @param {string} sourceId - 要移除的源 ID
   */
  removeSource(sourceId)
  {
    if (this._renderer && this._renderer.removeSource)
    {
      this._renderer.removeSource(sourceId);
    }
  }

  /**
   * 获取当前渲染后端状态信息。
   *
   * @returns {Object} 渲染状态快照
   */
  getRenderInfo()
  {
    if (!this._renderer)
    {
      return {
        requestedMode  : this._config.renderMode,
        actualMode     : 'not-started',
        isWorker       : false,
        isWebGL2       : false,
        isFallback     : false,
        reason         : '',
        droppedFrames  : 0,
        renderedFrames : 0,
        fps            : this._config.fps,
        width          : this._canvas.width || this._config.width,
        height         : this._canvas.height || this._config.height
      };
    }

    return this._renderer.getInfo();
  }

  /**
   * 渲染一帧（requestAnimationFrame 回调）。
   *
   * 流程：
   *   1. 检查停止标记，已停止则直接返回
   *   2. 检查 fps 节流（是否已达到目标帧间隔），未到时跳过绘制
   *   3. 同步外部音频源状态（检测 HTMLVideoElement 换源）
   *   4. 构建渲染 payload 并交给 renderer 绘制
   *   5. 检查渲染器健康状态（Worker 故障检测、错误计数）
   *   6. 调度下一帧 rAF
   *
   * @param {number} [timestamp] - rAF 传入的高精度时间戳
   * @param {boolean} [forceRender=false] - 是否强制渲染（忽略 fps 节流）
   */
  renderFrame(timestamp, forceRender)
  {
    if (this._stopped)
    {
      return;
    }

    if (!forceRender)
    {
      this._animationId = null;
    }

    const now = typeof timestamp === 'number' ? timestamp : (
      typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
    );
    const shouldRender = forceRender ||
      !this._renderFrameInterval ||
      !this._lastRenderTime ||
      now - this._lastRenderTime >= this._renderFrameInterval;

    try
    {
      if (shouldRender)
      {
        this._syncExternalSourceAudio();

        const payload = this._createRenderPayload();

        if (!this._shouldRenderPayload(payload))
        {
          this._lastRenderTime = now;
          this._renderErrorCount = 0;
        }
        else
        {
          const renderer = this.ensureRenderer();

          renderer.render(payload);
          this._handleRendererInfo(renderer);

          this._lastRenderTime = now;
          this._renderErrorCount = 0;
        }
      }
    }
    catch (error)
    {
      this._handleRenderError(error);
    }

    this._scheduleNextFrame();
  }

  /**
   * 销毁渲染循环。
   * 停止帧循环并销毁渲染后端，释放资源。
   */
  destroy()
  {
    if (this._logger)
    {
      this._logger.debug('Destroying RenderLoop');
    }

    this.stop();
    this._lastRenderTime = 0;

    if (this._renderer)
    {
      this._renderer.destroy();
      this._renderer = null;
    }
  }

  /**
   * 运行时降级到下一个可用渲染器。
   *
   * auto 模式按 worker-webgl2 -> main-webgl2 -> worker-2d -> main-2d 继续尝试。
   * 只在以下条件满足时降级：
   *   - 当前渲染器不是 main-2d
   *   - 当前是 Worker 渲染器或已标记为 worker-failed
   *
   * @param {string} reason - 降级原因描述
   * @returns {boolean} true=降级成功
   */
  fallbackRenderer(reason)
  {
    if (this._logger)
    {
      this._logger.warn(`Fallback renderer requested: ${reason}`);
    }
    this._reportIssue({
      stage   : 'renderer-fallback-requested',
      message : reason,
      details : {
        requestedMode : this._config && this._config.renderMode ? this._config.renderMode : ''
      }
    });

    const currentInfo = this._renderer && this._renderer.getInfo ? this._renderer.getInfo() : {};

    if (currentInfo.actualMode === 'main-2d')
    {
      return false;
    }

    if (!currentInfo.isWorker && currentInfo.actualMode !== 'worker-failed')
    {
      return false;
    }

    if (this._renderer && this._renderer.destroy)
    {
      this._renderer.destroy();
    }

    if (this._config.renderMode === 'auto' && currentInfo.actualMode !== 'worker-2d')
    {
      const mainWebGL2 = this._tryFallbackToMainWebGL2(currentInfo, reason);

      if (mainWebGL2)
      {
        return true;
      }

      const worker2D = this._tryFallbackToWorker2D(currentInfo, reason);

      if (worker2D)
      {
        return true;
      }
    }

    return this.fallbackRendererToMain2D(reason, currentInfo);
  }

  fallbackRendererToMain2D(reason, info)
  {
    if (this._logger)
    {
      this._logger.warn(`Falling back to main-2d: ${reason}`);
    }

    const currentInfo = info || (this._renderer && this._renderer.getInfo ? this._renderer.getInfo() : {});

    if (currentInfo.actualMode === 'main-2d')
    {
      return false;
    }

    if (!info && this._renderer && this._renderer.destroy)
    {
      this._renderer.destroy();
    }

    const renderer = new MainCanvas2DRenderer(this._config, {
      requestedMode  : currentInfo.requestedMode || this._config.renderMode,
      actualMode     : 'main-2d',
      isWorker       : false,
      isWebGL2       : false,
      isFallback     : true,
      reason         : reason,
      droppedFrames  : currentInfo.droppedFrames || 0,
      renderedFrames : currentInfo.renderedFrames || 0
    });

    renderer.init(this._canvas);
    this._renderer = renderer;
    this._bindFrameCb(this._renderer);
    this._logRenderPath(this._renderer.getInfo(), 'fallback-main-2d');
    this._rendererErrorCount = 0;

    return true;
  }

  fallbackRendererToMainThread(reason, info)
  {
    const currentInfo = info || (this._renderer && this._renderer.getInfo ? this._renderer.getInfo() : {});

    if (!currentInfo.isWorker && currentInfo.actualMode !== 'worker-failed')
    {
      return false;
    }

    if (this._renderer && this._renderer.destroy)
    {
      this._renderer.destroy();
    }

    if (
      this._config.forceMain2DRenderer !== true &&
      currentInfo.actualMode !== 'worker-2d'
    )
    {
      const mainWebGL2 = this._tryFallbackToMainWebGL2(currentInfo, reason);

      if (mainWebGL2)
      {
        return true;
      }
    }

    return this.fallbackRendererToMain2D(reason, currentInfo);
  }

  fallbackRendererToWorker2D(reason, info)
  {
    const currentInfo = info || (this._renderer && this._renderer.getInfo ? this._renderer.getInfo() : {});

    if (currentInfo.actualMode === 'worker-2d' || currentInfo.actualMode === 'worker-init')
    {
      return false;
    }

    if (this._renderer && this._renderer.destroy)
    {
      this._renderer.destroy();
    }

    return this._tryFallbackToWorker2D(currentInfo, reason);
  }

  _tryFallbackToMainWebGL2(currentInfo, reason)
  {
    try
    {
      const renderer = new MainWebGL2Renderer(this._config, {
        requestedMode  : currentInfo.requestedMode || this._config.renderMode,
        actualMode     : 'main-webgl2',
        isWorker       : false,
        isWebGL2       : true,
        isFallback     : true,
        reason         : reason,
        droppedFrames  : currentInfo.droppedFrames || 0,
        renderedFrames : currentInfo.renderedFrames || 0
      });

      renderer.init(this._canvas);
      this._renderer = renderer;
      this._bindFrameCb(this._renderer);
      this._logRenderPath(this._renderer.getInfo(), 'fallback-main-webgl2');
      this._rendererErrorCount = 0;

      if (this._logger)
      {
        this._logger.warn(`Fallback succeeded: main-webgl2 reason=${reason}`);
      }
      this._reportIssue({
        stage   : 'renderer-fallback-main-webgl2',
        message : reason,
        details : {
          previousMode : currentInfo.actualMode || '',
          nextMode     : 'main-webgl2'
        }
      });

      return true;
    }
    catch (error)
    {
      if (this._logger)
      {
        this._logger.warn(`Fallback to main-webgl2 failed: ${error.message || String(error)}`);
      }
      this._reportIssue({
        stage           : 'renderer-fallback-main-webgl2-failed',
        message         : getErrorMessage(error),
        fallbackApplied : false,
        details         : {
          previousMode  : currentInfo.actualMode || '',
          attemptedMode : 'main-webgl2'
        }
      });

      return false;
    }
  }

  _tryFallbackToWorker2D(currentInfo, reason)
  {
    try
    {
      const workerConfig = Object.assign({}, this._config, { renderMode: 'worker-2d' });
      const renderer = new WorkerRenderer(workerConfig, {
        requestedMode  : currentInfo.requestedMode || this._config.renderMode,
        actualMode     : 'worker-init',
        isWorker       : true,
        isWebGL2       : false,
        isFallback     : true,
        reason         : reason,
        droppedFrames  : currentInfo.droppedFrames || 0,
        renderedFrames : currentInfo.renderedFrames || 0,
        onFatalError   : (fallbackReason) =>
        {
          this.fallbackRendererToMain2D(fallbackReason || 'Worker Canvas2D renderer failed at runtime');
        }
      });

      renderer.init(this._canvas);
      this._renderer = renderer;
      this._bindFrameCb(this._renderer);
      this._logRenderPath(this._renderer.getInfo(), 'fallback-worker-2d');
      this._rendererErrorCount = 0;

      if (this._logger)
      {
        this._logger.warn(`Fallback succeeded: worker-2d reason=${reason}`);
      }
      this._reportIssue({
        stage   : 'renderer-fallback-worker-2d',
        message : reason,
        details : {
          previousMode : currentInfo.actualMode || '',
          nextMode     : 'worker-2d'
        }
      });

      return true;
    }
    catch (error)
    {
      if (this._logger)
      {
        this._logger.warn(`Fallback to worker-2d failed: ${error.message || String(error)}`);
      }
      this._reportIssue({
        stage           : 'renderer-fallback-worker-2d-failed',
        message         : getErrorMessage(error),
        fallbackApplied : false,
        details         : {
          previousMode  : currentInfo.actualMode || '',
          attemptedMode : 'worker-2d'
        }
      });

      return false;
    }
  }

  /**
   * 调度下一帧 rAF。
   * 已停止、已有待处理帧、或无源时跳过调度。
   */
  _scheduleNextFrame()
  {
    if (this._stopped || this._animationId || this._getSources().length === 0)
    {
      return;
    }

    this._animationId = window.requestAnimationFrame(this._boundRenderFrame);
  }

  /**
   * 检查渲染器运行健康状态。
   * 检测 Worker 渲染器故障，累积错误计数达 2 次后触发降级。
   *
   * @param {BaseRenderer} renderer - 当前渲染后端
   */
  _handleRendererInfo(renderer)
  {
    if (!renderer.getInfo)
    {
      return;
    }

    const info = renderer.getInfo();

    this._logRenderPath(info, 'runtime');

    if (info.actualMode === 'worker-failed' || (info.isWorker && info.isFallback && info.reason))
    {
      this._rendererErrorCount += 1;

      if (this._rendererErrorCount >= 2)
      {
        this.fallbackRenderer(info.reason || 'Worker renderer failed at runtime');
      }
    }
    else
    {
      this._rendererErrorCount = 0;
    }
  }

  /**
   * 空源、无水印且没有已创建 renderer 时跳过绘制。
   * 这样构造阶段的强制刷新不会提前初始化 Worker/WebGL；
   * 如果已有 renderer，则仍允许空 payload 清背景，避免移除所有源后残留上一帧。
   *
   * @param {Object} payload - 本帧渲染数据
   * @returns {boolean} true=需要交给 renderer 绘制
   */
  _shouldRenderPayload(payload)
  {
    if (this._renderer)
    {
      return true;
    }

    return Boolean(
      payload &&
      (
        (payload.items && payload.items.length) ||
        (payload.sourceWatermarks && payload.sourceWatermarks.length) ||
        (payload.outputWatermarks && payload.outputWatermarks.length)
      )
    );
  }

  /**
   * 处理渲染异常。
   * 累积错误计数达 2 次后触发后端降级。
   *
   * @param {Error} error - 渲染异常
   */
  _handleRenderError(error)
  {
    const reason = `Composer render failed: ${error.message || String(error)}`;

    this._renderErrorCount += 1;
    this._logger.warn(reason);
    this._reportIssue({
      stage   : 'renderer-render-frame',
      message : reason,
      details : {
        renderErrorCount : this._renderErrorCount,
        rendererMode     : this._renderer && this._renderer.getInfo ? this._renderer.getInfo().actualMode : ''
      }
    });

    if (this._renderer && this._renderer._updateInfo)
    {
      this._renderer._updateInfo({
        isFallback : true,
        reason     : reason
      });
    }

    if (this._renderErrorCount >= 2)
    {
      this.fallbackRenderer(reason);
    }
  }

  _bindFrameCb(renderer)
  {
    if (!renderer || !renderer.setFramePresentedCallback)
    {
      return;
    }

    renderer.setFramePresentedCallback((frameCtx) =>
    {
      if (typeof this._onFramePresented === 'function')
      {
        this._onFramePresented(frameCtx || {});
      }
    });
  }

  _logRenderPath(info, trigger)
  {
    if (!info || !this._logger)
    {
      return;
    }

    const signature = [
      info.requestedMode,
      info.actualMode,
      info.isWorker,
      info.isWebGL2,
      info.isFallback,
      info.reason || ''
    ].join('|');

    if (signature === this._lastRenderPathSignature)
    {
      return;
    }

    this._lastRenderPathSignature = signature;

    const message =
      `Render path [${trigger}]: requested=${info.requestedMode} actual=${info.actualMode} ` +
      `worker=${info.isWorker} webgl2=${info.isWebGL2} fallback=${info.isFallback} ` +
      `reason=${info.reason || ''} rendered=${info.renderedFrames || 0} dropped=${info.droppedFrames || 0}`;

    if (info.isFallback)
    {
      this._logger.warn(message);

      return;
    }

    this._logger.debug(message);
  }

  get renderer()
  {
    return this._renderer;
  }

  get animationId()
  {
    return this._animationId;
  }

  get lastRenderTime()
  {
    return this._lastRenderTime;
  }

  get renderFrameInterval()
  {
    return this._renderFrameInterval;
  }

  get renderErrorCount()
  {
    return this._renderErrorCount;
  }

  get rendererErrorCount()
  {
    return this._rendererErrorCount;
  }

  get isStopped()
  {
    return this._stopped;
  }
}

module.exports = RenderLoop;
