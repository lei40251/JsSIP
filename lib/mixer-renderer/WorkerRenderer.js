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
 *   5. 主线程将 ImageBitmap 绘制到用于 captureStream() 的输出 canvas
 *
 * 关键设计决策：不再 transfer 输出 canvas 本身。
 * canvas.captureStream() 始终绑定主线程 canvas，避免部分浏览器
 * 无法捕获 Worker 直接绘制结果而出现黑屏。
 *
 * @module WorkerRenderer
 */
const BaseRenderer = require('./BaseRenderer');
const workerScript = require('./workerScript');

module.exports = class WorkerRenderer extends BaseRenderer
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
    super(config, Object.assign({
      actualMode : 'worker-init',
      isWorker   : true,
      isWebGL2   : false
    }, info || {}));

    /** @type {HTMLCanvasElement|null} 主线程输出 canvas（绑定 captureStream） */
    this._canvas = null;

    /** @type {CanvasRenderingContext2D|null} 主线程 2D 上下文（写入 Worker 返回的 bitmap） */
    this._outputContext = null;

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
      this._outputContext = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');

      if (!this._outputContext)
      {
        throw new Error('Canvas2D output context is not available');
      }

      // 预填背景色，避免初始黑屏闪烁
      this._outputContext.fillStyle = this._config.backgroundColor || '#000';
      this._outputContext.fillRect(0, 0, canvas.width || 1, canvas.height || 1);
      this._outputContext.imageSmoothingEnabled = true;

      const offscreenCanvas = new OffscreenCanvas(canvas.width || 1, canvas.height || 1);

      this._worker.onmessage = (event) => this._handleWorkerMessage(event);
      this._worker.onerror = (error) =>
      {
        this._workerBusy = false;
        this._extractingFrame = false;
        this._updateInfo({
          actualMode : 'worker-failed',
          isFallback : true,
          reason     : `Worker renderer error: ${error.message || 'unknown'}`
        });
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
      this._workerReady = true;
      this._updateInfo({
        actualMode : data.actualMode,
        isWorker   : true,
        isWebGL2   : Boolean(data.isWebGL2),
        reason     : data.reason || this._info.reason
      });
      this._flushQueuedPayload();

      return;
    }

    if (data.type === 'rendered')
    {
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

        this._outputContext.drawImage(data.bitmap, 0, 0, this._canvas.width, this._canvas.height);

        if (data.bitmap.close)
        {
          data.bitmap.close();
        }
      }

      this._workerBusy = false;
      this._info.renderedFrames += 1;
      this._flushQueuedPayload();

      return;
    }

    if (data.type === 'renderError')
    {
      this._workerBusy = false;
      this._updateInfo({
        isFallback : true,
        reason     : data.reason || 'Worker render failed'
      });
      this._flushQueuedPayload();

      return;
    }

    if (data.type === 'failed')
    {
      this._workerBusy = false;
      this._workerReady = false;
      this._extractingFrame = false;
      this._updateInfo({
        actualMode : 'worker-failed',
        isFallback : true,
        reason     : data.reason || 'Worker renderer initialization failed'
      });
    }
  }

  /**
   * 调整输出尺寸（委托到基类，保存宽高信息）。
   *
   * @param {number} width - 新宽度
   * @param {number} height - 新高度
   */
  resize(width, height)
  {
    super.resize(width, height);
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
      this._queuePayload(payload);

      return;
    }

    if (this._workerBusy || this._extractingFrame)
    {
      this._queuePayload(payload);

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
          width            : payload.width,
          height           : payload.height,
          backgroundColor  : payload.backgroundColor,
          items            : result.items,
          sourceWatermarks : result.sourceWatermarks,
          outputWatermarks : result.outputWatermarks
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
   * 将 payload 入队列。
   *
   * 根据配置决定行为：
   *   - dropFrameWhenBusy: 丢弃旧帧，只保留最新一帧
   *   - 非丢帧模式: 追加到队列尾部，超出 maxFrameQueue 时丢弃最早帧
   *
   * @param {Object} payload - 布局数据
   */
  _queuePayload(payload)
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
  }

  /**
   * 消费队列中的下一帧（Worker 空闲时调用）。
   */
  _flushQueuedPayload()
  {
    if (!this._queuedPayloads.length || this._destroyed || this._workerBusy || this._extractingFrame)
    {
      return;
    }

    const payload = this._queuedPayloads.shift();

    this._renderInWorker(payload);
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
          id   : item.id,
          draw : item.draw,
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
   * WebGL2 Worker 路径：ImageBitmap 上传到 WebGL 时浏览器可能不再处理
   * UNPACK_FLIP_Y_WEBGL，因此在抽帧阶段传入 { imageOrientation: 'flipY' }
   * 来补偿翻转。
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
        const bitmapOptions = this._info.actualMode === 'worker-webgl2' ?
          { imageOrientation: 'flipY' } :
          undefined;
        const bitmap = bitmapOptions ? await createImageBitmap(video, bitmapOptions) : await createImageBitmap(video);

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
