const BaseRenderer = require('./BaseRenderer');
const workerScript = require('./workerScript');

/**
 * Worker 渲染器。
 *
 * 负责三件事：
 *   1. 创建独立 OffscreenCanvas 给 Worker 渲染；
 *   2. 每帧从 video 元素抽取 VideoFrame / ImageBitmap 并 transfer；
 *   3. Worker 渲染后传回 ImageBitmap，主线程写入真正用于 captureStream() 的输出 canvas。
 *
 * 注意：不再 transfer 输出 canvas 本身。这样 canvas.captureStream() 始终绑定主线程 canvas，
 * 避免部分浏览器无法捕获 Worker 直接绘制结果而出现黑屏。
 */
module.exports = class WorkerRenderer extends BaseRenderer
{
  constructor(config, info)
  {
    super(config, Object.assign({
      actualMode : 'worker-init',
      isWorker   : true,
      isWebGL2   : false
    }, info || {}));

    this._canvas = null;
    this._outputContext = null;
    this._worker = null;
    this._workerUrl = null;
    this._workerReady = false;
    this._workerBusy = false;
    this._extractingFrame = false;
    this._queuedPayloads = [];
    this._destroyed = false;
    this._frameFactory = null;
  }

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

  _canUseWorker(canvas)
  {
    return Boolean(
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      canvas &&
      canvas.getContext
    );
  }

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

  resize(width, height)
  {
    super.resize(width, height);
  }

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

  async _renderInWorker(payload)
  {
    this._extractingFrame = true;
    let result = null;

    try
    {
      result = await this._createWorkerPayload(payload);

      this._extractingFrame = false;

      if (result.items.length === 0)
      {
        this._flushQueuedPayload();

        return;
      }

      if (this._destroyed)
      {
        this._closeTransferFrames(result.items);

        return;
      }

      this._workerBusy = true;
      this._worker.postMessage({
        type    : 'render',
        payload : {
          width           : payload.width,
          height          : payload.height,
          backgroundColor : payload.backgroundColor,
          items           : result.items
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

  _flushQueuedPayload()
  {
    if (!this._queuedPayloads.length || this._destroyed || this._workerBusy || this._extractingFrame)
    {
      return;
    }

    const payload = this._queuedPayloads.shift();

    this._renderInWorker(payload);
  }

  async _createWorkerPayload(payload)
  {
    const items = [];
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
    }
    catch (error)
    {
      this._closeTransferFrames(items);
      throw error;
    }

    return { items, transfers };
  }

  async _createFrame(video)
  {
    const VideoFrameConstructor = typeof window !== 'undefined' ? window.VideoFrame : null;

    if (this._frameFactory === 'imagebitmap' || (this._frameFactory === null && typeof createImageBitmap !== 'undefined'))
    {
      try
      {
        // Worker WebGL2 上传 ImageBitmap 时，部分浏览器不会再按 UNPACK_FLIP_Y_WEBGL 处理方向。
        // 因此 WebGL2 Worker 路径在抽帧阶段就翻转一次；Worker Canvas2D 继续使用原始方向。
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

  removeSource(id)
  {
    if (this._worker)
    {
      this._worker.postMessage({ type: 'removeSource', id: id });
    }
  }

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
