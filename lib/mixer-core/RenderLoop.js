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

const RendererFactory = require('../mixer-renderer/RendererFactory');
const MainCanvas2DRenderer = require('../mixer-renderer/MainCanvas2DRenderer');
const MainWebGL2Renderer = require('../mixer-renderer/MainWebGL2Renderer');
const WorkerRenderer = require('../mixer-renderer/WorkerRenderer');

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

    // bind 一次避免每帧创建新函数
    this._boundRenderFrame = this.renderFrame.bind(this);
  }

  /**
   * 恢复渲染循环（清除停止标记）。
   */
  resume()
  {
    this._stopped = false;
  }

  /**
   * 启动渲染循环。
   * 先恢复再调度下一帧。
   */
  start()
  {
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
  }

  /**
   * 确保渲染后端已创建。
   * 首次调用时通过 RendererFactory.createRenderer 根据配置创建实际渲染器。
   *
   * @returns {BaseRenderer} 当前渲染后端
   */
  ensureRenderer()
  {
    if (!this._renderer)
    {
      this._renderer = RendererFactory.createRenderer(this._canvas, this._config, {
        onWorkerFatalError : (reason) =>
        {
          this.fallbackRenderer(reason || 'Worker renderer failed at runtime');
        }
      });
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
    const currentInfo = info || (this._renderer && this._renderer.getInfo ? this._renderer.getInfo() : {});

    if (currentInfo.actualMode === 'main-2d')
    {
      return false;
    }

    if (!info && !currentInfo.isWorker && currentInfo.actualMode !== 'worker-failed')
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
    this._rendererErrorCount = 0;

    return true;
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
      this._rendererErrorCount = 0;

      return true;
    }
    catch (error)
    {
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
      this._rendererErrorCount = 0;

      return true;
    }
    catch (error)
    {
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
    const reason = `Mixer render failed: ${error.message || String(error)}`;

    this._renderErrorCount += 1;
    this._logger.warn(reason);

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
