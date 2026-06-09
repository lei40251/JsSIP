/**
 * AIVirtualBackground—— 基于 MediaPipe 人像分割的
 * 实时视频虚拟背景引擎。
 *
 * 支持四种背景模式：
 *   - 'none'  — 直通模式，不做背景替换
 *   - 'blur'  — 对原始背景做高斯模糊
 *   - 'image' — 用自定义图片替换背景（cover-fit 裁剪）
 *   - 'color' — 用纯色填充背景
 *
 * @module AIVirtualBackground
 */

const { buildCanvas2DPipeline } = require('./Canvas2DPipeline.js');
const Config = require('./AiVBConfig');
const MediaPipeSegmenterRuntime = require('./MediaPipeSegmenterRuntime');
const Logger = require('../Logger');

const logger = new Logger('AIVirtualBackground');
const PERFORMANCE_LOG_INTERVAL_MS = 5000;

class AIVirtualBackground
{
  constructor(options = {})
  {
    this.config = Config.create(options);
    this.pipeline = null;
    this.segmenterRuntime = new MediaPipeSegmenterRuntime({
      assetConfig : this.config.assetConfig
    });
    this.inputStream = null;
    this.outputStream = null;
    this.canvas = null;
    this.videoEl = null;
    this.backgroundEl = null;
    this.isRunning = false;
    this.animationFrameId = null;
    this.currentBackgroundKind = 'none';
    this.lastFrameTime = 0;
    this.isRendering = false;
    this.renderPromise = null;
    this.destroyed = false;
    this.pipelineRequestId = 0;
    this.pendingImageLoad = null;
    this._performanceLogTimer = null;
    this._performance = this._createPerformanceState();
  }

  _createPerformanceState()
  { 
    return {
      avgRenderMs         : 0,
      avgSegmentationMs   : 0,
      currentMode         : 'none',
      droppedFrames       : 0,
      frameSkip           : this.config.segmentation.frameSkip,
      lastMaskReused      : false,
      maskReuseRate       : 0,
      maskReusedFrames    : 0,
      processingScale     : this.config.video.processingScale,
      renderedFrames      : 0,
      segmentedFrames     : 0,
      totalRenderMs       : 0,
      totalSegmentationMs : 0
    };
  }

  _resetPerformanceState()
  {
    this._performance = this._createPerformanceState();
  }

  _cancelPendingImageLoad(reason)
  {
    if (!this.pendingImageLoad)
    {
      return;
    }

    const pending = this.pendingImageLoad;

    this.pendingImageLoad = null;

    if (pending.image)
    {
      pending.image.onload = null;
      pending.image.onerror = null;
      pending.image.src = '';
    }

    pending.reject(new Error(reason || 'Background image load cancelled'));
  }

  _cleanUpPipeline(options = {})
  {
    if (options.cancelPendingImageLoad !== false)
    {
      this._cancelPendingImageLoad('Background image load cancelled');
    }

    if (this.pipeline && this.pipeline.cleanUp)
    {
      this.pipeline.cleanUp();
    }

    this.pipeline = null;
  }

  _releaseBackgroundImage()
  {
    if (!this.backgroundEl)
    {
      return;
    }

    this.backgroundEl.onload = null;
    this.backgroundEl.onerror = null;
    this.backgroundEl.src = '';
    this.backgroundEl = null;
  }

  _assertInitialized()
  {
    if (!this.canvas || !this.videoEl || !this.outputStream || !this.pipeline)
    {
      throw new Error('AIVirtualBackground not initialized');
    }
  }

  /**
   * 初始化虚拟背景引擎。
   *
   * 完整的初始化管线（按顺序）：
   *
   *   1. 加载 MediaPipe 分割模型（selfie-segmenter）
   *      └─ segmenterRuntime.initialize() → WASM + TFLite 模型
   *   2. 创建隐藏 <video> 元素
   *      └─ createVideoElement() → video.srcObject = inputStream
   *   3. 构建 Canvas2D 渲染管线
   *      └─ buildCanvas2DPipeline() → 离屏 canvas + 分割输入 canvas
   *   4. 创建输出流
   *      └─ canvas.captureStream(fps) → MediaStream 输出
   *   5. 重置背景为"直通"模式
   *      └─ clearBackground()
   *
   * 调用 start() 后，requestAnimationFrame 循环开始逐帧处理。
   * 初始化失败时自动销毁已创建的资源。
   *
   * @param {Object} [options]
   * @param {MediaStream} options.inputStream — 原始摄像头采集流
   * @param {string} [options.modelPath]     — 可选的分割模型 URL 覆盖
   * @param {HTMLCanvasElement} [options.canvas] — 可选的外部 canvas
   * @returns {Promise<void>}
   */
  async init({ inputStream, modelPath, canvas } = {})
  {
    if (!inputStream)
    {
      throw new Error('inputStream required');
    }

    this.destroyed = false;
    this.inputStream = inputStream;
    this.canvas = canvas || document.createElement('canvas');
    this.canvas.width = this.config.video.width;
    this.canvas.height = this.config.video.height;
    this._resetPerformanceState();

    try
    {
      await this.segmenterRuntime.initialize({
        modelPath,
        delegate : this.config.segmentation.delegate
      });
      await this.createVideoElement();
      this.createPipeline();
      this.createOutputStream();
      this.clearBackground();
    }
    catch (error)
    {
      await this.destroy();
      throw error;
    }
  }

  async createVideoElement()
  {
    this.videoEl = document.createElement('video');
    this.videoEl.muted = true;
    this.videoEl.autoplay = true;
    this.videoEl.playsInline = true;
    this.videoEl.srcObject = this.inputStream;

    await this.videoEl.play();
  }

  createPipeline()
  {
    this.pipeline = buildCanvas2DPipeline({
      backgroundColor : '#00ff00',
      backgroundImage : null,
      blurRadius      : this.config.postProcessing.blurRadius,
      canvas          : this.canvas,
      frameSkip       : this.config.segmentation.frameSkip,
      maxBlurRadius   : this.config.postProcessing.maxBlurRadius,
      metrics         : {
        onRenderComplete : (payload) => this._recordRenderMetrics(payload)
      },
      mirror           : this.config.video.mirror,
      mode             : 'none',
      processingScale  : this.config.video.processingScale,
      segmenterRuntime : this.segmenterRuntime,
      videoElement     : this.videoEl
    });
  }

  createOutputStream()
  {
    this.outputStream = this.canvas.captureStream(this.config.video.targetFps);
  }

  getOutputStream()
  {
    return this.outputStream;
  }

  _recordRenderMetrics(payload = {})
  {
    const renderDurationMs = Number(payload.renderDurationMs) || 0;
    const segmentationDurationMs = Number(payload.segmentationDurationMs) || 0;

    this._performance.renderedFrames += 1;
    this._performance.totalRenderMs += renderDurationMs;
    this._performance.avgRenderMs = this._performance.totalRenderMs / this._performance.renderedFrames;
    this._performance.lastMaskReused = Boolean(payload.reusedMask);

    if (payload.reusedMask)
    {
      this._performance.maskReusedFrames += 1;
    }

    this._performance.maskReuseRate = this._performance.renderedFrames > 0 ?
      this._performance.maskReusedFrames / this._performance.renderedFrames :
      0;

    if (payload.segmentationRan)
    {
      this._performance.segmentedFrames += 1;
      this._performance.totalSegmentationMs += segmentationDurationMs;
      this._performance.avgSegmentationMs =
        this._performance.totalSegmentationMs / this._performance.segmentedFrames;
    }
  }

  /**
   * 设置虚拟背景模式（统一入口）。
   *
   * 四种模式：
   *   - 'none'  → clearBackground()：直通原始视频帧
   *   - 'blur'  → setBlurBackground(src)：高斯模糊原始背景
   *   - 'image' → setBackgroundImage(src)：用自定义图片替换背景
   *   - 'color' → setSolidColor(src)：用纯色填充背景
   *
   * @param {string} type — 'none' | 'blur' | 'image' | 'color'
   * @param {string|number} [src] — 模式参数（blur 半径 / 图片 URL / 颜色值）
   * @returns {Promise<void>}
   */
  setupPipeline(type, src)
  {
    if (type === 'blur')
    {
      return this.setBlurBackground(src);
    }

    if (type === 'color')
    {
      return this.setSolidColor(src);
    }

    if (type === 'image')
    {
      return this.setBackgroundImage(src);
    }

    if (type === 'none')
    {
      this.clearBackground();

      return Promise.resolve();
    }

    return Promise.reject(new Error(`Unsupported pipeline type: ${type}`));
  }

  _recordDroppedFrame()
  {
    this._performance.droppedFrames += 1;

    if (this._performance.droppedFrames === 1 || this._performance.droppedFrames % 30 === 0)
    {
      logger.warn(
        `Dropped frame: total=${this._performance.droppedFrames} mode=${this.currentBackgroundKind} ` +
        `fps=${this.config.video.targetFps}`
      );
    }
  }

  _updatePipelineState(nextState = {})
  {
    if (!this.pipeline)
    {
      throw new Error('AIVirtualBackground not initialized');
    }

    this.pipeline.updateState(nextState);

    if (Object.prototype.hasOwnProperty.call(nextState, 'mode') && nextState.mode)
    {
      this.currentBackgroundKind = nextState.mode;
      this._performance.currentMode = nextState.mode;
      logger.debug(`Background mode changed: ${nextState.mode}`);
    }

    if (Object.prototype.hasOwnProperty.call(nextState, 'mirror'))
    {
      logger.debug(`Mirror changed: ${Boolean(nextState.mirror)}`);
    }

    if (Object.prototype.hasOwnProperty.call(nextState, 'processingScale'))
    {
      this._performance.processingScale = this.config.video.processingScale;
      logger.debug(`Processing scale changed: ${this.config.video.processingScale}`);
    }

    if (Object.prototype.hasOwnProperty.call(nextState, 'frameSkip'))
    {
      this._performance.frameSkip = this.config.segmentation.frameSkip;
      logger.debug(`Frame skip changed: ${this.config.segmentation.frameSkip}`);
    }

    if (Object.prototype.hasOwnProperty.call(nextState, 'maxBlurRadius'))
    {
      logger.debug(`Max blur radius changed: ${this.config.postProcessing.maxBlurRadius}`);
    }
  }

  _startPerformanceLogger()
  {
    this._stopPerformanceLogger();
    this._performanceLogTimer = setInterval(() =>
    {
      const info = this.getPerformanceInfo();

      logger.debug(
        `Perf summary: mode=${info.currentMode} rendered=${info.renderedFrames} ` +
        `segmented=${info.segmentedFrames} dropped=${info.droppedFrames} ` +
        `avgRenderMs=${info.avgRenderMs.toFixed(2)} avgSegmentationMs=${info.avgSegmentationMs.toFixed(2)} ` +
        `maskReuseRate=${info.maskReuseRate.toFixed(2)}`
      );
    }, PERFORMANCE_LOG_INTERVAL_MS);
  }

  _stopPerformanceLogger()
  {
    if (!this._performanceLogTimer)
    {
      return;
    }

    clearInterval(this._performanceLogTimer);
    this._performanceLogTimer = null;
  }

  getPerformanceInfo()
  {
    return {
      avgRenderMs       : this._performance.avgRenderMs,
      avgSegmentationMs : this._performance.avgSegmentationMs,
      currentMode       : this.currentBackgroundKind,
      droppedFrames     : this._performance.droppedFrames,
      frameSkip         : this.config.segmentation.frameSkip,
      lastMaskReused    : this._performance.lastMaskReused,
      maskReuseRate     : this._performance.maskReuseRate,
      processingScale   : this.config.video.processingScale,
      renderedFrames    : this._performance.renderedFrames,
      segmentedFrames   : this._performance.segmentedFrames
    };
  }

  setMirror(mirror)
  {
    this.config.video.mirror = Boolean(mirror);

    if (this.pipeline)
    {
      this._updatePipelineState({ mirror: this.config.video.mirror });
    }
  }

  /**
   * 启动渲染循环（requestAnimationFrame）。
   *
   * 每帧执行：loop() → pipeline.render() → Canvas2D 合成 → captureStream 输出。
   *
   * 帧率由 config.video.targetFps 控制（默认 15fps），
   * rAF 负责调度，实际合成按目标帧间隔节流。
   *
   * 循环会持续运行直到 stop() 被调用或引擎被 destroy()。
   */
  start()
  {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = 0;
    this._startPerformanceLogger();
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  stop()
  {
    this.isRunning = false;
    this._stopPerformanceLogger();

    if (this.animationFrameId)
    {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 单帧渲染回调（rAF）。
   *
   * 每帧流程：
   *   1. 按 targetFps 节流，未达到目标帧间隔时跳过绘制
   *   2. 防止并发渲染（isRendering 互斥锁），并发时记录丢帧
   *   3. 调用 pipeline.render() 执行 Canvas2D 合成
   *   4. canvas 内容由 captureStream 自动输出到 MediaStream
   *   5. 调度下一帧 rAF
   *
   * @param {number} now — performance.now() 传入的高精度时间戳（毫秒）
   */
  async loop(now)
  {
    if (!this.isRunning) return;

    const interval = 1000 / this.config.video.targetFps;

    if (now - this.lastFrameTime >= interval)
    {
      this.lastFrameTime = now;

      if (this.isRendering)
      {
        this._recordDroppedFrame();
        this.animationFrameId = requestAnimationFrame(this.loop);

        return;
      }

      this.isRendering = true;
      this.renderPromise = (async() =>
      {
        const pipeline = this.pipeline;

        try
        {
          if (pipeline)
          {
            await pipeline.render();
          }
        }
        catch (error)
        {
          logger.error(`Render error: ${error.message}`);
        }
        finally
        {
          this.isRendering = false;
          this.renderPromise = null;
        }
      })();

      await this.renderPromise;
    }

    if (this.isRunning)
    {
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  }

  async setBackgroundImage(url)
  {
    this._assertInitialized();

    const normalizedUrl = typeof url === 'string' ? url.trim() : '';

    if (!normalizedUrl)
    {
      throw new Error('Invalid background image URL');
    }

    if (normalizedUrl.toLowerCase() === 'none')
    {
      this.clearBackground();

      return;
    }

    const requestId = ++this.pipelineRequestId;

    this._cancelPendingImageLoad('Background image load cancelled');

    return new Promise((resolve, reject) =>
    {
      const backgroundEl = document.createElement('img');
      let settled = false;

      const settle = (callback, value) =>
      {
        if (settled)
        {
          return;
        }

        settled = true;

        if (this.pendingImageLoad && this.pendingImageLoad.image === backgroundEl)
        {
          this.pendingImageLoad = null;
        }

        backgroundEl.onload = null;
        backgroundEl.onerror = null;
        callback(value);
      };

      this.pendingImageLoad = {
        image  : backgroundEl,
        reject : (error) => settle(reject, error)
      };

      backgroundEl.onerror = () => settle(reject, new Error('Failed to load background image'));
      backgroundEl.onload = () =>
      {
        try
        {
          if (requestId !== this.pipelineRequestId || this.destroyed)
          {
            settle(reject, new Error('Background image load cancelled'));

            return;
          }

          this._releaseBackgroundImage();
          this.backgroundEl = backgroundEl;
          this._updatePipelineState({
            backgroundImage : backgroundEl,
            mode            : 'image'
          });
          logger.debug(`Background image changed: ${normalizedUrl}`);
          settle(resolve);
        }
        catch (error)
        {
          settle(reject, error);
        }
      };

      backgroundEl.src = normalizedUrl;
    });
  }

  clearBackground()
  {
    this._assertInitialized();
    this._cancelPendingImageLoad('Background image load cancelled');
    this._releaseBackgroundImage();
    this._updatePipelineState({
      backgroundImage : null,
      mode            : 'none'
    });
  }

  async setBlurBackground(radius)
  {
    this._assertInitialized();
    const fallbackRadius = Math.min(
      this.config.postProcessing.blurRadius,
      this.config.postProcessing.maxBlurRadius
    );
    const normalizedRadius = clampNumber(
      typeof radius === 'number' ? radius : fallbackRadius,
      0,
      this.config.postProcessing.maxBlurRadius,
      fallbackRadius
    );

    this._cancelPendingImageLoad('Background image load cancelled');
    this._releaseBackgroundImage();
    this._updatePipelineState({
      backgroundImage : null,
      blurRadius      : normalizedRadius,
      mode            : 'blur'
    });
  }

  async setSolidColor(color = '#00ff00')
  {
    this._assertInitialized();

    if (!isValidColor(color))
    {
      throw new Error('Invalid color format. Expected #RRGGBB or rgba(r,g,b,a)');
    }

    this._cancelPendingImageLoad('Background image load cancelled');
    this._releaseBackgroundImage();
    this._updatePipelineState({
      backgroundColor : color,
      backgroundImage : null,
      mode            : 'color'
    });
  }

  /**
   * 销毁虚拟背景引擎，释放所有资源。
   *
   * 清理顺序：
   *   1. 停止渲染循环（stop → cancelAnimationFrame）
   *   2. 等待最后一帧渲染完成（renderPromise）
   *   3. 取消正在加载的背景图片
   *   4. 清理渲染管线（cleanUp）
   *   5. 释放背景图片引用
   *   6. 清理 video 元素（srcObject = null）
   *   7. 关闭 MediaPipe 分割器（释放 WASM 资源）
   *
   * 可安全地多次调用（destroyed 标记保护）。
   *
   * @returns {Promise<void>}
   */
  async destroy()
  {
    if (this.destroyed && !this.canvas && !this.videoEl && !this.outputStream)
    {
      return;
    }

    this.destroyed = true;
    this.stop();

    if (this.renderPromise)
    {
      await this.renderPromise;
    }

    this._cancelPendingImageLoad('Background image load cancelled');
    this._cleanUpPipeline({ cancelPendingImageLoad: false });
    this.currentBackgroundKind = 'none';
    this._releaseBackgroundImage();

    if (this.videoEl)
    {
      this.videoEl.srcObject = null;
      this.videoEl.load();
    }

    if (this.segmenterRuntime)
    {
      await this.segmenterRuntime.destroy();
    }

    this.pipeline = null;
    this.inputStream = null;
    this.outputStream = null;
    this.canvas = null;
    this.videoEl = null;
    this.backgroundEl = null;
  }
}

function isValidColor(color)
{
  if (/^#[0-9A-Fa-f]{6}$/.test(color))
  {
    return true;
  }

  const match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*(\d*(?:\.\d+)?)\s*)?\)$/.exec(color);

  if (!match)
  {
    return false;
  }

  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  const alpha = match[5] === undefined || match[5] === '' ? 1 : Number(match[5]);

  return red <= 255 && green <= 255 && blue <= 255 && alpha >= 0 && alpha <= 1;
}

function clampNumber(value, min, max, fallback)
{
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue))
  {
    return fallback;
  }

  return Math.min(max, Math.max(min, numericValue));
}

module.exports = AIVirtualBackground;
