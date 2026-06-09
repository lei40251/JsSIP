/**
 * AiVBE（AI Virtual Background Engine）—— 基于 MediaPipe 人像分割的
 * 实时视频虚拟背景引擎。
 *
 * 支持四种背景模式：
 *   - 'none'  — 直通模式，不做背景替换（仍会运行分割）
 *   - 'blur'  — 对原始背景做高斯模糊
 *   - 'image' — 用自定义图片替换背景（cover-fit 裁剪）
 *   - 'color' — 用纯色填充背景
 *
 * @module AiVBE
 */

const { buildCanvas2DPipeline } = require('./Canvas2DPipeline.js');
const Config = require('./AiVBEConfig');
const MediaPipeSegmenterRuntime = require('./MediaPipeSegmenterRuntime');
const Logger = require('../Logger');

const logger = new Logger('AiVBE');

/**
 * AI 虚拟背景引擎核心类。
 *
 * 典型生命周期：
 *   1. new AiVBEEngine({ ... })
 *   2. await engine.init({ inputStream, canvas })
 *   3. await engine.setBlurBackground(20)   // 或 setBackgroundImage / setSolidColor
 *   4. engine.start()
 *   5. … 使用 engine.getOutputStream() 作为处理后的视频轨道 …
 *   6. engine.stop()
 *   7. await engine.destroy()
 *
 * @class
 */
class AiVBEEngine
{
  /**
   * @param {Object} [options={}] — 引擎配置
   * @param {Object} [options.video] — 视频流参数
   * @param {number} [options.video.width=1280] — 输出宽度
   * @param {number} [options.video.height=720] — 输出高度
   * @param {number} [options.video.targetFps=15] — 渲染目标帧率（1-60）
   * @param {boolean} [options.video.mirror=false] — 是否水平镜像
   * @param {Object} [options.segmentation] — MediaPipe 分割参数
   * @param {'CPU'|'GPU'} [options.segmentation.delegate='GPU'] — 推理后端
   * @param {Object} [options.postProcessing] — 后处理参数
   * @param {number} [options.postProcessing.blurRadius=20] — 模糊半径（0-100）
   * @param {Object} [options.assetConfig] — CDN / 资源路径覆盖（MediaPipe 运行时和模型文件）
   */
  constructor(options = {})
  {
    /** @type {Object} 归一化后的配置对象（参见 AiVBEConfig） */
    this.config = Config.create(options);

    /** @type {Object|null} 当前渲染管线句柄（Canvas2D pipeline） */
    this.pipeline = null;

    /** @type {MediaPipeSegmenterRuntime} 人像分割运行时 */
    this.segmenterRuntime = new MediaPipeSegmenterRuntime({
      assetConfig : this.config.assetConfig
    });

    /** @type {MediaStream|null} 输入视频流 */
    this.inputStream = null;

    /** @type {MediaStream|null} 输出流（从 canvas 捕获的处理后帧） */
    this.outputStream = null;

    /** @type {HTMLCanvasElement|null} 用于合成的离屏 canvas */
    this.canvas = null;

    /** @type {HTMLVideoElement|null} 由 inputStream 驱动的内部 video 元素 */
    this.videoEl = null;

    /** @type {HTMLImageElement|null} 背景图片元素（仅 image 模式使用） */
    this.backgroundEl = null;

    /** @type {boolean} 渲染循环是否正在运行 */
    this.isRunning = false;

    /** @type {number|null} requestAnimationFrame 句柄 */
    this.animationFrameId = null;

    /** @type {'none'|'blur'|'image'|'color'} 当前生效的背景模式 */
    this.currentBackgroundKind = 'none';

    /** @type {number} 上一帧的渲染时间戳（毫秒） */
    this.lastFrameTime = 0;

    /** @type {boolean} 防止并发渲染的互斥锁 */
    this.isRendering = false;

    /** @type {Promise|null} 当前正在执行的渲染 Promise */
    this.renderPromise = null;

    /** @type {boolean} 是否已调用 destroy() */
    this.destroyed = false;

    /** @type {number} 单调递增的请求 ID，用于取消过时的管线设置操作（例如不再需要的图片加载） */
    this.pipelineRequestId = 0;

    /** @type {Object|null} 正在进行的背景图片加载句柄，结构为 { image, reject }。加载完成或被取消时清空 */
    this.pendingImageLoad = null;
  }

  // ---------------------------------------------------------------------------
  // 内部辅助方法
  // ---------------------------------------------------------------------------

  /**
   * 取消正在进行的背景图片加载。
   *
   * 清除图片元素的回调、重置 src，并拒绝调用方正在等待的 Promise。
   *
   * @private
   * @param {string} [reason='Background image load cancelled'] — 拒绝原因
   */
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

  /**
   * 销毁当前渲染管线并释放相关资源。
   *
   * 默认同时取消正在进行的背景图片加载。传入 `{ cancelPendingImageLoad: false }`
   * 可跳过（例如在 destroy 流程中单独处理取消逻辑时）。
   *
   * @private
   * @param {Object} [options={}]
   * @param {boolean} [options.cancelPendingImageLoad=true]
   */
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

    if (this.backgroundEl)
    {
      this.backgroundEl.onload = null;
      this.backgroundEl.onerror = null;
      this.backgroundEl.src = '';
      this.backgroundEl = null;
    }
  }

  /**
   * 断言引擎已初始化完毕，否则抛出错误。
   *
   * @private
   * @throws {Error} 如果 canvas、videoEl 或 outputStream 缺失
   */
  _assertInitialized()
  {
    if (!this.canvas || !this.videoEl || !this.outputStream)
    {
      throw new Error('AiVBEEngine not initialized');
    }
  }

  // ---------------------------------------------------------------------------
  // 公开 API —— 生命周期
  // ---------------------------------------------------------------------------

  /**
   * 使用输入视频流初始化引擎。
   *
   * 此方法会引导 MediaPipe 分割器、创建内部 video 元素、建立输出
   * canvas 捕获流，并设置默认的直通（'none'）管线。
   *
   * @param {Object} options
   * @param {MediaStream} options.inputStream — 待处理的原始摄像头/屏幕共享流
   * @param {string} [options.modelPath] — 可选的分割模型 URL 覆盖
   * @param {HTMLCanvasElement} [options.canvas] — 复用的已有 canvas，省略则自动创建
   * @returns {Promise<void>}
   * @throws {Error} 如果未提供 inputStream
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

    try
    {
      await this.segmenterRuntime.initialize({
        modelPath,
        delegate : this.config.segmentation.delegate
      });
      await this.createVideoElement();
      this.createOutputStream();
      this.clearBackground();
    }
    catch (error)
    {
      await this.destroy();

      throw error;
    }
  }

  /**
   * 创建由 inputStream 驱动的内部 <video> 元素。
   *
   * 元素设为静音、自动播放、内联播放，以确保在各浏览器中无需用户手势即可工作。
   *
   * @returns {Promise<void>}
   */
  async createVideoElement()
  {
    this.videoEl = document.createElement('video');
    this.videoEl.muted = true;
    this.videoEl.autoplay = true;
    this.videoEl.playsInline = true;
    this.videoEl.srcObject = this.inputStream;

    await this.videoEl.play();
  }

  /**
   * 为指定模式构建（或重建）Canvas2D 渲染管线。
   *
   * 'blur' 和 'color' 模式同步创建管线。
   * 'image' 模式需先加载背景图片，因此返回 Promise，图片就绪后完成管线装配。
   *
   * @private
   * @param {'blur'|'color'|'image'} type — 背景效果类型
   * @param {number|string} src — 模糊半径（数字）、颜色字符串或图片 URL
   * @returns {Promise<void>|void}
   */
  async setupPipeline(type, src)
  {
    this._assertInitialized();
    if (this.destroyed)
    {
      throw new Error('AiVBEEngine destroyed');
    }

    const requestId = ++this.pipelineRequestId;

    this._cleanUpPipeline();

    if (type === 'blur')
    {
      const blurRadius = typeof src === 'number' ? src : this.config.postProcessing.blurRadius;

      this.pipeline = buildCanvas2DPipeline({
        canvas           : this.canvas,
        videoElement     : this.videoEl,
        mode             : 'blur',
        mirror           : this.config.video.mirror,
        segmenterRuntime : this.segmenterRuntime,
        blurRadius       : blurRadius
      });
      this.currentBackgroundKind = 'blur';

      return;
    }

    if (type === 'color')
    {
      this.pipeline = buildCanvas2DPipeline({
        canvas           : this.canvas,
        videoElement     : this.videoEl,
        mode             : 'color',
        mirror           : this.config.video.mirror,
        segmenterRuntime : this.segmenterRuntime,
        backgroundColor  : src
      });
      this.currentBackgroundKind = 'color';

      return;
    }

    // ---- image 模式：异步加载背景图片 ----
    return new Promise((resolve, reject) =>
    {
      const backgroundEl = document.createElement('img');
      let settled = false;

      /**
       * 确保 Promise 只被敲定一次。清理事件回调和 pendingImageLoad 引用，
       * 防止过时的加载操作泄漏。
       *
       * @param {Function} callback — resolve 或 reject
       * @param {*} value — 传递给 callback 的值
       */
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
          // 如果已有更新的 setupPipeline 调用启动，或引擎已被销毁，丢弃本次加载结果
          if (requestId !== this.pipelineRequestId || this.destroyed)
          {
            settle(reject, new Error('Background image load cancelled'));

            return;
          }

          this.backgroundEl = backgroundEl;
          this.pipeline = buildCanvas2DPipeline({
            canvas           : this.canvas,
            videoElement     : this.videoEl,
            mode             : 'image',
            mirror           : this.config.video.mirror,
            segmenterRuntime : this.segmenterRuntime,
            backgroundImage  : backgroundEl
          });
          this.currentBackgroundKind = 'image';
          settle(resolve);
        }
        catch (error)
        {
          settle(reject, error);
        }
      };

      // 开始加载图片
      backgroundEl.src = src;
    });
  }

  /**
   * 通过 captureStream() 从内部 canvas 创建输出 MediaStream。
   *
   * 下游消费者（如 WebRTC 对等连接）应使用此流作为处理后的视频轨道。
   */
  createOutputStream()
  {
    this.outputStream = this.canvas.captureStream(this.config.video.targetFps);
  }

  /**
   * 返回处理后的视频流。
   *
   * @returns {MediaStream|null}
   */
  getOutputStream()
  {
    return this.outputStream;
  }

  /**
   * 运行时切换水平镜像，无需重建管线。
   *
   * @param {boolean} mirror — 是否开启镜像
   */
  setMirror(mirror)
  {
    this.config.video.mirror = Boolean(mirror);

    if (this.pipeline && this.pipeline.updateMirror)
    {
      this.pipeline.updateMirror(this.config.video.mirror);
    }
  }

  // ---------------------------------------------------------------------------
  // 渲染循环
  // ---------------------------------------------------------------------------

  /**
   * 启动 requestAnimationFrame 渲染循环。
   *
   * 如果循环已在运行，调用无效果。
   */
  start()
  {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = 0;
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  /**
   * 停止渲染循环。
   *
   * 取消下一次已排期的动画帧。正在渲染中的帧仍会完成。
   */
  stop()
  {
    this.isRunning = false;

    if (this.animationFrameId)
    {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 由 requestAnimationFrame 驱动的逐帧渲染回调。
   *
   * 按 targetFps 节流以避免不必要的渲染。前一帧仍在渲染时跳过当前帧
   *（丢弃而非排队），防止背压积累。
   *
   * @private
   * @param {number} now — rAF 提供的 DOMHighResTimeStamp
   * @returns {Promise<void>}
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
        // 上一帧仍在渲染中 —— 跳过当前帧以避免背压
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

  // ---------------------------------------------------------------------------
  // 公开 API —— 背景效果
  // ---------------------------------------------------------------------------

  /**
   * 设置自定义图片作为虚拟背景。
   *
   * 传入 `'none'` 可移除背景（等效于 clearBackground()）。
   *
   * @param {string} url — 图片 URL，必须为非空字符串
   * @returns {Promise<void>}
   * @throws {Error} 如果 url 为空/无效或引擎未初始化
   */
  async setBackgroundImage(url)
  {
    this._assertInitialized();

    const normalizedUrl = typeof url === 'string' ? url.trim() : '';

    if (!normalizedUrl)
    {
      throw new Error('Invalid background image URL');
    }

    if (normalizedUrl === 'none')
    {
      this.clearBackground();

      return;
    }

    return this.setupPipeline('image', normalizedUrl);
  }

  /**
   * 移除虚拟背景效果（直通模式）。
   *
   * 人像分割仍会运行，因此输出流仍是合成后的 canvas，但不做背景替换。
   */
  clearBackground()
  {
    this._assertInitialized();
    this._cleanUpPipeline();
    this.pipeline = buildCanvas2DPipeline({
      canvas           : this.canvas,
      videoElement     : this.videoEl,
      mode             : 'none',
      mirror           : this.config.video.mirror,
      segmenterRuntime : this.segmenterRuntime
    });
    this.currentBackgroundKind = 'none';
  }

  /**
   * 应用高斯模糊背景效果。
   *
   * 人像被分割出来，原始背景做模糊处理。
   *
   * @param {number} [radius] — 模糊半径（像素，0-100）。省略或超出范围时回退到配置的默认值
   * @returns {Promise<void>}
   */
  async setBlurBackground(radius)
  {
    this._assertInitialized();
    radius = typeof radius === 'number' ? radius : this.config.postProcessing.blurRadius;

    if (radius < 0 || radius > 100)
    {
      radius = this.config.postProcessing.blurRadius;
    }

    await this.setupPipeline('blur', radius);
  }

  /**
   * 用纯色替换背景。
   *
   * @param {string} [color='#00ff00'] — CSS 颜色，格式为 #RRGGBB 或 rgba(r,g,b,a)
   * @returns {Promise<void>}
   * @throws {Error} 如果颜色格式无法识别
   */
  async setSolidColor(color = '#00ff00')
  {
    this._assertInitialized();

    if (!isValidColor(color))
    {
      throw new Error('Invalid color format. Expected #RRGGBB or rgba(r,g,b,a)');
    }

    return this.setupPipeline('color', color);
  }

  // ---------------------------------------------------------------------------
  // 销毁
  // ---------------------------------------------------------------------------

  /**
   * 完全销毁引擎：停止渲染循环、释放管线、分割器以及所有 DOM / 流引用。
   *
   * 可安全地多次调用；一旦完全销毁，后续调用为无操作。
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

    this._cleanUpPipeline();
    this.currentBackgroundKind = 'none';

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

/**
 * 验证 CSS 颜色字符串的合法性。
 *
 * 接受：
 *   - 6 位十六进制： #RRGGBB
 *   - rgb / rgba 函数表示法
 *
 * @param {string} color
 * @returns {boolean}
 */
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

module.exports = AiVBEEngine;
