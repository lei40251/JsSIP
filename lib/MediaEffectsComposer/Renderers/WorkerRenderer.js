/**
 * WorkerRenderer — Worker 线程渲染器
 *
 * 将渲染工作卸载到 WebWorker，通过 OffscreenCanvas 避免阻塞主线程。
 *
 * 架构说明：
 *   1. 创建 OffscreenCanvas 并 transfer 到 Worker
 *   2. Worker 内根据配置选择 WebGL2 或 Canvas2D 上下文
 *   3. 每帧从 video 元素抽取 VideoFrame / ImageBitmap 并 transfer 到 Worker
 *   4. Worker 渲染后通过 transferToImageBitmap() 传回 ImageBitmap
 *   5. 主线程将 ImageBitmap 绘制回统一输出 canvas，供 captureStream / Insertable 复用
 *
 * 关键设计决策：不再 transfer 输出 canvas 本身。
 * 统一输出 canvas 始终留在主线程，避免部分浏览器无法消费 Worker
 * 直接绘制结果而出现黑屏或输出链断裂。
 *
 * @module WorkerRenderer
 */
const createRendererBase = require('./RendererBase');
const workerScript = require('./WorkerScript');

module.exports = class WorkerRenderer 
{
  /**
   * @param {Object} config - 混流配置
   * @param {string} [config.workerUrl] - 外部 Worker 脚本地址（不传则使用 Blob Worker）
   * @param {boolean} [config.dropFrameWhenBusy=true] - Worker 忙时是否丢弃新帧
   * @param {number} [config.maxFrameQueue=1] - 最大帧队列长度
   * @param {Object} info - 渲染器元信息
   */
  constructor(config, info)
  {
    const rendererInfo = Object.assign({}, info || {});
    const onFatalError = typeof rendererInfo.onFatalError === 'function' ? rendererInfo.onFatalError : null;

    delete rendererInfo.onFatalError;

    Object.assign(this, createRendererBase(config, Object.assign({
      actualMode : 'worker-init',
      isWorker   : true,
      isWebGL2   : false
    }, rendererInfo)));

    this._onFatalError = onFatalError;

    /** @type {HTMLCanvasElement|null} 主线程统一输出 canvas（供 captureStream / Insertable 复用） */
    this._canvas = null;

    /** @type {CanvasRenderingContext2D|null} 主线程 2D 上下文（写入 Worker 返回的 bitmap） */
    this._outputContext = null;

    /** @type {boolean} 是否允许将 Worker 返回帧直接交给 Insertable 输出 */
    this._preferDirectFrameSource = Boolean(this._config && this._config.enableInsertable);

    /** @type {Worker|null} WebWorker 实例 */
    this._worker = null;

    /** @type {string|null} Worker 脚本的 Blob URL（用于后续 revoke） */
    this._workerUrl = null;

    /** @type {boolean} Worker 是否已完成初始化并回复 ready */
    this._workerReady = false;

    /** @type {boolean} Worker 正在处理上一帧，不能再发新帧 */
    this._workerBusy = false;

    /** @type {boolean} 正在从 video 抽取帧（异步操作进行中） */
    this._extractingFrame = false;

    /** @type {Array<Object>} 等待发送到 Worker 的帧队列 */
    this._queuedPayloads = [];

    /** @type {boolean} 销毁标记，设置后所有异步操作跳过 */
    this._destroyed = false;

    /** @type {boolean} 避免同一个 Worker 故障重复触发主线程降级 */
    this._fatalErrorNotified = false;

    /**
     * @type {'imagebitmap'|'videoframe'|null}
     * 帧抽取方式。自动探测：优先 createImageBitmap，回退 VideoFrame。
     * null 表示尚未确定。
     */
    this._frameFactory = null;
  }

  /**
   * 初始化 Worker 渲染器。
   *
   * 步骤：
   *   1. 检查 Worker + OffscreenCanvas 可用性
   *   2. 创建 Worker 实例（Blob URL 或外部脚本）
   *   3. 创建 OffscreenCanvas 并 transfer 到 Worker
   *   4. 等待 Worker 回复 ready 消息
   *
   * @param {HTMLCanvasElement} canvas - 主线程输出 canvas
   * @returns {boolean} true=初始化成功
   * @throws {Error} Worker 或 OffscreenCanvas 不可用时抛出
   */
  init(canvas)
  {
    if (!this._canUseWorker(canvas))
    {
      throw new Error('Worker OffscreenCanvas is not available');
    }

    this._canvas = canvas;
    this.resize(canvas.width, canvas.height);

    try
    {
      this._worker = this._createWorker();

      const offscreenCanvas = new OffscreenCanvas(canvas.width || 1, canvas.height || 1);

      this._worker.onmessage = (event) => this._handleWorkerMessage(event);
      this._worker.onerror = (error) =>
      {
        const reason = `Worker renderer error: ${error.message || 'unknown'}`;

        this._workerBusy = false;
        this._extractingFrame = false;
        this._updateInfo({
          actualMode : 'worker-failed',
          isFallback : true,
          reason     : reason
        });
        this._notifyFatalError(reason);
      };

      this._worker.postMessage({
        type            : 'init',
        canvas          : offscreenCanvas,
        requestedMode   : this._config.renderMode,
        width           : canvas.width,
        height          : canvas.height,
        backgroundColor : this._config.backgroundColor
      }, [ offscreenCanvas ]);
    }
    catch (error)
    {
      this._destroyWorker();
      throw error;
    }

    return true;
  }

  /**
   * 检查当前环境是否支持 Worker 渲染。
   *
   * @param {HTMLCanvasElement} canvas - 输出 canvas
   * @returns {boolean} true=支持 Worker + OffscreenCanvas
   */
  _canUseWorker(canvas)
  {
    return Boolean(
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      canvas &&
      canvas.getContext
    );
  }

  /**
   * 创建 Worker 实例。
   * 优先使用外部脚本（workerUrl），否则生成 Blob Worker。
   *
   * @returns {Worker} Worker 实例
   */
  _createWorker()
  {
    if (this._config.workerUrl)
    {
      return new Worker(this._config.workerUrl);
    }

    const blob = new Blob([ workerScript.createWorkerScript() ], { type: 'application/javascript' });

    this._workerUrl = URL.createObjectURL(blob);

    return new Worker(this._workerUrl);
  }

  /**
   * 处理 Worker 返回的消息。
   *
   * 消息类型：
   *   - ready: Worker 初始化完成，包含实际使用的渲染模式
   *   - rendered: Worker 渲染完成，返回 ImageBitmap
   *   - renderError: Worker 渲染失败
   *   - failed: Worker 初始化失败
   *
   * @param {MessageEvent} event - Worker 消息事件
   */
  _handleWorkerMessage(event)
  {
    const data = event.data || {};

    if (data.type === 'ready')
    {
      if (!this._outputContext)
      {
        if (!this._canvas || !this._canvas.getContext)
        {
          this._workerReady = false;
          this._updateInfo({
            actualMode : 'worker-failed',
            isFallback : true,
            reason     : 'Canvas2D output context is not available'
          });
          this._notifyFatalError('Canvas2D output context is not available');

          return;
        }

        this._outputContext = this._canvas.getContext('2d', { alpha: false }) || this._canvas.getContext('2d');

        if (!this._outputContext)
        {
          this._workerReady = false;
          this._updateInfo({
            actualMode : 'worker-failed',
            isFallback : true,
            reason     : 'Canvas2D output context is not available'
          });
          this._notifyFatalError('Canvas2D output context is not available');

          return;
        }

        this._outputContext.fillStyle = this._config.backgroundColor || '#000';
        this._outputContext.fillRect(0, 0, this._canvas.width || 1, this._canvas.height || 1);
        this._outputContext.imageSmoothingEnabled = true;
      }

      if (!this._outputContext)
      {
        this._workerReady = false;
        this._updateInfo({
          actualMode : 'worker-failed',
          isFallback : true,
          reason     : 'Canvas2D output context is not available'
        });
        this._notifyFatalError('Canvas2D output context is not available');

        return;
      }

      this._workerReady = true;
      this._updateInfo({
        actualMode : data.actualMode,
        isWorker   : true,
        isWebGL2   : Boolean(data.isWebGL2),
        reason     : data.reason || this._info.reason
      });

      if (this._queuedPayloads.length && !this._destroyed && !this._workerBusy && !this._extractingFrame)
      {
        this._renderInWorker(this._queuedPayloads.shift());
      }

      return;
    }

    if (data.type === 'rendered')
    {
      const presentedTimestamp = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      let frameSource = null;
      let frameSourceConsumed = false;
      const canUseDirectFrameSource = this._preferDirectFrameSource &&
        !(
          this._info &&
          this._info.actualMode === 'worker-webgl2' &&
          this._config &&
          this._config.hasSourceAiVirtualBackground === true
        );

      if (data.bitmap && canUseDirectFrameSource)
      {
        frameSource = data.bitmap;
        frameSourceConsumed = true;
      }

      if (frameSource && this._info && this._info.actualMode === 'worker-webgl2')
      {
        frameSource = null;
        frameSourceConsumed = false;
      }

      if (data.bitmap && this._outputContext)
      {
        // 确保输出 canvas 尺寸与预期一致
        if (this._canvas.width !== this._info.width)
        {
          this._canvas.width = this._info.width;
        }

        if (this._canvas.height !== this._info.height)
        {
          this._canvas.height = this._info.height;
        }

        this._drawWorkerBitmapToOutput(data.bitmap);

        if (!frameSourceConsumed && data.bitmap.close)
        {
          data.bitmap.close();
        }
      }

      this._workerBusy = false;
      this._info.renderedFrames += 1;
      this._emitFramePresented({
        canvas              : this._canvas,
        frameSource         : frameSource,
        frameSourceConsumed : frameSourceConsumed,
        timestamp           : presentedTimestamp,
        source              : this._info.actualMode || 'worker'
      });

      if (this._queuedPayloads.length && !this._destroyed && !this._workerBusy && !this._extractingFrame)
      {
        this._renderInWorker(this._queuedPayloads.shift());
      }

      return;
    }

    if (data.type === 'renderError')
    {
      this._workerBusy = false;
      this._updateInfo({
        isFallback : true,
        reason     : data.reason || 'Worker render failed'
      });

      if (this._queuedPayloads.length && !this._destroyed && !this._workerBusy && !this._extractingFrame)
      {
        this._renderInWorker(this._queuedPayloads.shift());
      }

      return;
    }

    if (data.type === 'failed')
    {
      const reason = data.reason || 'Worker renderer initialization failed';

      this._workerBusy = false;
      this._workerReady = false;
      this._extractingFrame = false;
      this._updateInfo({
        actualMode : 'worker-failed',
        isFallback : true,
        reason     : reason
      });
      this._notifyFatalError(reason);
    }
  }

  _drawWorkerBitmapToOutput(bitmap)
  {
    if (!bitmap || !this._outputContext || !this._canvas)
    {
      return;
    }

    if (this._info && this._info.actualMode === 'worker-webgl2')
    {
      this._outputContext.save();
      this._outputContext.translate(0, this._canvas.height);
      this._outputContext.scale(1, -1);
      this._outputContext.drawImage(bitmap, 0, 0, this._canvas.width, this._canvas.height);
      this._outputContext.restore();

      return;
    }

    this._outputContext.drawImage(bitmap, 0, 0, this._canvas.width, this._canvas.height);
  }

  _notifyFatalError(reason)
  {
    if (this._fatalErrorNotified || this._destroyed || !this._onFatalError)
    {
      return;
    }

    this._fatalErrorNotified = true;
    this._onFatalError(reason);
  }

  /**
   * 调整输出尺寸（委托到基类，保存宽高信息）。
   *
   * @param {number} width - 新宽度
   * @param {number} height - 新高度
   */
  resize(width, height)
  {
    this._info.width = width;
    this._info.height = height;
  }

  /**
   * 提交一帧到 Worker 渲染。
   *
   * 流程：
   *   1. Worker 未就绪 → 入队列等待
   *   2. Worker 正忙且配置了丢帧 → 记录丢帧，替换队列中的最新帧
   *   3. Worker 正忙且未配置丢帧 → 入队列（超出 maxFrameQueue 截断）
   *   4. Worker 空闲 → 立即抽取帧并发送
   *
   * @param {Object} payload - 布局数据
   */
  render(payload)
  {
    if (this._destroyed)
    {
      return;
    }

    if (!this._worker)
    {
      return;
    }

    if (!this._workerReady)
    {
      const maxFrameQueue = Math.max(0, this._config.maxFrameQueue || 0);

      if (maxFrameQueue <= 0)
      {
        this._info.droppedFrames += 1;

        return;
      }

      if (this._config.dropFrameWhenBusy)
      {
        this._info.droppedFrames += 1;
        this._queuedPayloads = [ payload ];

        return;
      }

      this._queuedPayloads.push(payload);

      while (this._queuedPayloads.length > maxFrameQueue)
      {
        this._queuedPayloads.shift();
        this._info.droppedFrames += 1;
      }

      return;
    }

    if (this._workerBusy || this._extractingFrame)
    {
      const maxFrameQueue = Math.max(0, this._config.maxFrameQueue || 0);

      if (maxFrameQueue <= 0)
      {
        this._info.droppedFrames += 1;

        return;
      }

      if (this._config.dropFrameWhenBusy)
      {
        this._info.droppedFrames += 1;
        this._queuedPayloads = [ payload ];

        return;
      }

      this._queuedPayloads.push(payload);

      while (this._queuedPayloads.length > maxFrameQueue)
      {
        this._queuedPayloads.shift();
        this._info.droppedFrames += 1;
      }

      return;
    }

    this._renderInWorker(payload);
  }

  /**
   * 从 video 元素抽取帧并发送到 Worker。
   *
   * 异步执行：先在主线程创建 ImageBitmap/VideoFrame，
   * 然后通过 postMessage transfer 给 Worker。
   *
   * @param {Object} payload - 布局数据
   */
  async _renderInWorker(payload)
  {
    this._extractingFrame = true;
    let result = null;

    try
    {
      result = await this._createWorkerPayload(payload);

      this._extractingFrame = false;

      if (this._destroyed)
      {
        this._closeTransferFrames(result.items);

        return;
      }

      this._workerBusy = true;
      this._worker.postMessage({
        type    : 'render',
        payload : {
          width                      : payload.width,
          height                     : payload.height,
          backgroundColor            : payload.backgroundColor,
          outputMirrorX              : Boolean(payload.outputMirrorX),
          mirrorWatermarksWithOutput : payload.mirrorWatermarksWithOutput !== false,
          items                      : result.items,
          sourceWatermarks           : result.sourceWatermarks,
          outputWatermarks           : result.outputWatermarks
        }
      }, result.transfers); 
    }
    catch (error)
    {
      if (result && result.items)
      {
        this._closeTransferFrames(result.items);
      }

      this._extractingFrame = false;
      this._workerBusy = false;
      this._info.droppedFrames += 1;
      this._updateInfo({
        isFallback : true,
        reason     : `Worker frame extraction failed: ${error.message || String(error)}`
      });
    }
  }

  /**
   * 从 payload 中提取所有 video 帧，生成可 transfer 的 ImageBitmap/VideoFrame。
   *
   * @param {Object} payload - 布局数据
   * @returns {Promise<Object>}
   *   items: 包含 id、draw 和 frame 的数组
   *   sourceWatermarks/outputWatermarks: 包含水印 frame 和 draw 的数组
   *   transfers: 用于 postMessage transfer 的帧对象列表
   */
  async _createWorkerPayload(payload)
  {
    const items = [];
    const sourceWatermarks = [];
    const outputWatermarks = [];
    const transfers = [];

    try
    {
      for (let idx = 0; idx < payload.items.length; ++idx)
      {
        const item = payload.items[idx];

        if (!item.video || item.video.readyState < 2)
        {
          continue;
        }

        const frame = await this._createFrame(item.video);
 
        items.push({
          id                  : item.id,
          draw                : item.draw,
          mirrorX             : Boolean(item.mirrorX),
          aiVirtualBackground : this._normalizeWorkerAiVirtualBackgroundConfig(item.aiVirtualBackground),
          frame
        });
        transfers.push(frame);
      }

      await this._appendWorkerWatermarks(payload.sourceWatermarks, sourceWatermarks, transfers);
      await this._appendWorkerWatermarks(payload.outputWatermarks, outputWatermarks, transfers);
    }
    catch (error)
    {
      this._closeTransferFrames(items);
      this._closeTransferFrames(sourceWatermarks);
      this._closeTransferFrames(outputWatermarks);
      throw error;
    }

    return { items, sourceWatermarks, outputWatermarks, transfers };
  }

  /**
   * 将主线程水印图面转成可 transfer 的 frame。
   *
   * @param {Array<Object>} watermarks - 水印绘制项
   * @param {Array<Object>} target - Worker payload 目标列表
   * @param {Array<*>} transfers - transfer 列表
   */
  async _appendWorkerWatermarks(watermarks, target, transfers)
  {
    for (let idx = 0; idx < (watermarks || []).length; ++idx)
    {
      const watermark = watermarks[idx];

      if (!watermark.image || !watermark.draw)
      {
        continue;
      }

      const frame = await this._createWatermarkFrame(watermark.image);

      target.push({
        id      : watermark.id,
        draw    : watermark.draw,
        opacity : watermark.opacity,
        frame
      });
      transfers.push(frame);
    }
  }

  /**
   * 从 HTMLVideoElement 抽取一帧，自动选择最优 API。
   *
   * 探测顺序：
   *   1. createImageBitmap(video) — 广泛支持，优先使用
   *   2. new VideoFrame(video) — VideoFrame API，部分浏览器支持
   *
   * @param {HTMLVideoElement} video - 输入 video 元素
   * @returns {Promise<ImageBitmap|VideoFrame>} 抽取的帧
   */
  async _createFrame(video)
  {
    const VideoFrameConstructor = typeof window !== 'undefined' ? window.VideoFrame : null;

    if (this._frameFactory === 'imagebitmap' || (this._frameFactory === null && typeof createImageBitmap !== 'undefined'))
    {
      try
      {
        const bitmap = await createImageBitmap(video);

        this._frameFactory = 'imagebitmap';

        return bitmap;
      }
      catch (error)
      {
        if (this._frameFactory === 'imagebitmap')
        {
          throw error;
        }
      }
    }

    if (this._frameFactory === 'videoframe' || (this._frameFactory === null && VideoFrameConstructor))
    {
      try
      {
        const frame = new VideoFrameConstructor(video);

        this._frameFactory = 'videoframe';

        return frame;
      }
      catch (error)
      {
        if (this._frameFactory === 'videoframe')
        {
          throw error;
        }
      }
    }

    throw new Error('VideoFrame and createImageBitmap are unavailable');
  }

  /**
   * 从水印图面创建可 transfer 的 ImageBitmap/VideoFrame。
   *
   * @param {*} image - Canvas/Image/ImageBitmap
   * @returns {Promise<ImageBitmap|VideoFrame>} 可 transfer 的帧
   */
  async _createWatermarkFrame(image)
  {
    if (typeof createImageBitmap !== 'undefined')
    {
      return createImageBitmap(image);
    }

    const VideoFrameConstructor = typeof window !== 'undefined' ? window.VideoFrame : null;

    if (VideoFrameConstructor)
    {
      return new VideoFrameConstructor(image);
    }

    throw new Error('Watermark frame extraction is unavailable');
  }

  _normalizeWorkerAiVirtualBackgroundConfig(config)
  {
    if (!config || typeof config !== 'object')
    {
      return null;
    }

    const normalized = JSON.parse(JSON.stringify(config));

    if (typeof normalized.imageUrl === 'string')
    {
      normalized.imageUrl = this._toAbsoluteUrl(normalized.imageUrl);
    }

    if (typeof normalized.modelPath === 'string')
    {
      normalized.modelPath = this._toAbsoluteUrl(normalized.modelPath);
    }

    if (normalized.assetConfig && typeof normalized.assetConfig === 'object')
    {
      if (typeof normalized.assetConfig.moduleUrl === 'string')
      {
        normalized.assetConfig.moduleUrl = this._toAbsoluteUrl(normalized.assetConfig.moduleUrl);
      }

      if (typeof normalized.assetConfig.wasmBaseUrl === 'string')
      {
        normalized.assetConfig.wasmBaseUrl = this._toAbsoluteUrl(normalized.assetConfig.wasmBaseUrl);
      }

      if (typeof normalized.assetConfig.modelUrl === 'string')
      {
        normalized.assetConfig.modelUrl = this._toAbsoluteUrl(normalized.assetConfig.modelUrl);
      }
    }

    return normalized;
  }

  _toAbsoluteUrl(url)
  {
    if (typeof url !== 'string' || !url.trim())
    {
      return url;
    }

    try
    {
      if (typeof document !== 'undefined' && document && document.baseURI)
      {
        return new URL(url, document.baseURI).toString();
      }

      if (typeof location !== 'undefined' && location && location.href)
      {
        return new URL(url, location.href).toString();
      }
    }
    catch (error)
    {}

    return url;
  }

  /**
   * 释放未发送到 Worker 的帧资源（防止内存泄漏）。
   *
   * @param {Array<Object>} items - 包含 frame 的项列表
   */
  _closeTransferFrames(items)
  {
    (items || []).forEach((item) =>
    {
      if (item.frame && item.frame.close)
      {
        item.frame.close();
      }
    });
  }

  /**
   * 通知 Worker 移除一路源的纹理缓存。
   *
   * @param {string} id - 源 ID
   */
  removeSource(id)
  {
    if (this._worker)
    {
      this._worker.postMessage({ type: 'removeSource', id: id });
    }
  }

  /**
   * 销毁 Worker 渲染器。
   *
   * 清理步骤：
   *   1. 设置销毁标记，阻止后续异步操作
   *   2. 清空待处理帧队列
   *   3. 释放输出上下文引用
   *   4. 终止 Worker 线程 + revoke Blob URL
   */
  destroy()
  {
    this._destroyed = true;
    this._workerReady = false;
    this._extractingFrame = false;
    this._workerBusy = false;
    this._queuedPayloads = [];
    this._outputContext = null;

    this._destroyWorker();
  }

  /**
   * 终止 Worker 线程并释放相关资源。
   * 先发送 destroy 消息通知 Worker 清理 GPU 资源，再 terminate。
   */
  _destroyWorker()
  {
    if (this._worker)
    {
      try
      {
        this._worker.postMessage({ type: 'destroy' });
      }
      catch (error)
      {}

      this._worker.terminate();
      this._worker = null;
    }

    if (this._workerUrl)
    {
      URL.revokeObjectURL(this._workerUrl);
      this._workerUrl = null;
    }
  }
};
