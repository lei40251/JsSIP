/**
 * RenderLoop — 混流器渲染循环
 *
 * 负责混流器的视频渲染节奏控制：
 *   - 通过 requestAnimationFrame 驱动帧循环
 *   - 按配置的 fps 节流，避免不必要的绘制
 *   - 管理渲染后端的生命周期（创建、销毁、故障降级）
 *   - 检测 Worker 渲染器故障，自动降级到主线程 Canvas2D
 *
 * @module RenderLoop
 */

const RendererFactory = require('../mixer-renderer/RendererFactory');
const MainCanvas2DRenderer = require('../mixer-renderer/MainCanvas2DRenderer');

/**
 * 构造函数。
 *
 * @param {Object} options
 * @param {HTMLCanvasElement} options.canvas - 输出 canvas 元素
 * @param {Object} options.config - 混流配置
 * @param {Object} options.logger - 日志记录器
 * @param {Function} options.getSources - 返回当前源列表的回调
 * @param {Function} options.createRenderPayload - 创建渲染 payload 的函数
 * @param {Function} options.syncExternalSourceAudio - 同步外部源音频的函数
 * @param {Function} options.onStateChange - 状态变化回调（已弃用，保留为空函数）
 */
function RenderLoop(options)
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
  /** @type {number} 连续 renderer 失败次数，达到阈值后切换到主线程 Canvas2D */
  this._rendererErrorCount = 0;
  /** @type {boolean} 停止标记；设为 true 时 rAF 回调直接返回 */
  this._stopped = false;

  // bind 一次避免每帧创建新函数
  this._boundRenderFrame = this.renderFrame.bind(this);
}

/**
 * 恢复渲染循环（清除停止标记）。
 */
RenderLoop.prototype.resume = function()
{
  this._stopped = false;
};

/**
 * 启动渲染循环。
 * 先恢复再调度下一帧。
 */
RenderLoop.prototype.start = function()
{
  this.resume();
  this._scheduleNextFrame();
};

/**
 * 停止渲染循环。
 * 取消待处理的 rAF，设置停止标记。
 */
RenderLoop.prototype.stop = function()
{
  this._stopped = true;

  if (this._animationId)
  {
    window.cancelAnimationFrame(this._animationId);
    this._animationId = null;
  }
};

/**
 * 重置帧计时器。
 * 在下一次渲染时忽略 fps 节流，立即合成一帧。
 * 用于刚添加源时需要立即刷新画面的场景。
 */
RenderLoop.prototype.resetFrameTiming = function()
{
  this._lastRenderTime = 0;
};

/**
 * 确保渲染后端已创建。
 * 首次调用时通过 RendererFactory.createRenderer 根据配置创建实际渲染器。
 *
 * @returns {BaseRenderer} 当前渲染后端
 */
RenderLoop.prototype.ensureRenderer = function()
{
  if (!this._renderer)
  {
    this._renderer = RendererFactory.createRenderer(this._canvas, this._config);
  }

  return this._renderer;
};

/**
 * 调整渲染器输出尺寸。
 *
 * @param {number} width - 新宽度
 * @param {number} height - 新高度
 */
RenderLoop.prototype.resizeRenderer = function(width, height)
{
  if (this._renderer)
  {
    this._renderer.resize(width, height);
  }
};

/**
 * 从渲染器中移除一路源的绘制数据。
 *
 * @param {string} sourceId - 要移除的源 ID
 */
RenderLoop.prototype.removeSource = function(sourceId)
{
  if (this._renderer && this._renderer.removeSource)
  {
    this._renderer.removeSource(sourceId);
  }
};

/**
 * 获取当前渲染后端状态信息。
 *
 * @returns {Object} 渲染状态快照
 */
RenderLoop.prototype.getRenderInfo = function()
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
};

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
RenderLoop.prototype.renderFrame = function(timestamp, forceRender)
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
      const renderer = this.ensureRenderer();

      renderer.render(payload);
      this._handleRendererInfo(renderer);

      this._lastRenderTime = now;
      this._renderErrorCount = 0;
    }
  }
  catch (error)
  {
    this._handleRenderError(error);
  }

  this._scheduleNextFrame();
};

/**
 * 销毁渲染循环。
 * 停止帧循环并销毁渲染后端，释放资源。
 */
RenderLoop.prototype.destroy = function()
{
  this.stop();
  this._lastRenderTime = 0;

  if (this._renderer)
  {
    this._renderer.destroy();
    this._renderer = null;
  }
};

/**
 * 运行时降级到主线程 Canvas2D 渲染器。
 *
 * Worker 渲染器运行时失败后切到 main-2d。只在以下条件满足时降级：
 *   - 当前渲染器不是 main-2d
 *   - 当前是 Worker 渲染器或已标记为 worker-failed
 *
 * @param {string} reason - 降级原因描述
 * @returns {boolean} true=降级成功
 */
RenderLoop.prototype.fallbackRendererToMain2D = function(reason)
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
};

/**
 * 调度下一帧 rAF。
 * 已停止、已有待处理帧、或无源时跳过调度。
 */
RenderLoop.prototype._scheduleNextFrame = function()
{
  if (this._stopped || this._animationId || this._getSources().length === 0)
  {
    return;
  }

  this._animationId = window.requestAnimationFrame(this._boundRenderFrame);
};

/**
 * 检查渲染器运行健康状态。
 * 检测 Worker 渲染器故障，累积错误计数达 2 次后触发降级。
 *
 * @param {BaseRenderer} renderer - 当前渲染后端
 */
RenderLoop.prototype._handleRendererInfo = function(renderer)
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
      this.fallbackRendererToMain2D(info.reason || 'Worker renderer failed at runtime');
    }
  }
  else
  {
    this._rendererErrorCount = 0;
  }
};

/**
 * 处理渲染异常。
 * 累积错误计数达 2 次后触发降级到 main-2d。
 *
 * @param {Error} error - 渲染异常
 */
RenderLoop.prototype._handleRenderError = function(error)
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
    this.fallbackRendererToMain2D(reason);
  }
};

// 只读 getter 暴露给 MixerController 的 prototype getter 使用
Object.defineProperties(RenderLoop.prototype, {
  renderer : {
    get : function()
    {
      return this._renderer;
    }
  },
  animationId : {
    get : function()
    {
      return this._animationId;
    }
  },
  lastRenderTime : {
    get : function()
    {
      return this._lastRenderTime;
    }
  },
  renderFrameInterval : {
    get : function()
    {
      return this._renderFrameInterval;
    }
  },
  renderErrorCount : {
    get : function()
    {
      return this._renderErrorCount;
    }
  },
  rendererErrorCount : {
    get : function()
    {
      return this._rendererErrorCount;
    }
  },
  isStopped : {
    get : function()
    {
      return this._stopped;
    }
  }
});

module.exports = RenderLoop;
