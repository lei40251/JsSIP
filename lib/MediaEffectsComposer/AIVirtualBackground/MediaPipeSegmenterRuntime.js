/**
 * MediaPipeSegmenterRuntime —— 封装 MediaPipe ImageSegmenter（VIDEO 模式），
 * 为 AIVirtualBackground 提供人像分割能力。
 *
 * 职责：
 *   - 通过 AiVBAssetLoader 懒加载 MediaPipe Tasks Vision 运行时
 *   - 使用 selfie-segmenter 模型初始化 ImageSegmenter
 *   - 执行逐帧分割并返回基于 canvas 的 alpha 遮罩
 *   - 最多排队一个待处理帧，避免背压积累
 *   - 销毁时干净关闭分割器并拒绝所有未完成的 Promise
 *
 * @module MediaPipeSegmenterRuntime
 */

const Logger = require('../../Logger');
const AiVBAssetLoader = require('./AiVBAssetLoader');
const SegmentationCommon = require('./AiVBSegmentationCommon');

const logger = new Logger('AiVBMediaPipeRuntime');
const segmentationHelpers = SegmentationCommon.createSegmentationHelpers();

/** 默认推理后端 —— 'GPU' 以获得最佳性能 */
const DEFAULT_DELEGATE = 'GPU';
const DEFAULT_MASK_EDGE_BLUR_PX = 1;
const DEFAULT_MASK_ALPHA_BIAS = 0.16;
const DEFAULT_MASK_INSET_PX = 0.75;

function normalizeDelegate()
{
  return DEFAULT_DELEGATE;
}

module.exports = class MediaPipeSegmenterRuntime
{
  /**
   * @param {Object} [config={}]
   * @param {Object} [config.assetConfig] — MediaPipe 运行时包和模型文件的 CDN / 路径覆盖
   */
  constructor(config = {})
  {
    this._onIssue = typeof config.onIssue === 'function' ? config.onIssue : null;

    /** @type {AiVBAssetLoader} 负责 MediaPipe 的动态脚本加载 */
    this.assetLoader = new AiVBAssetLoader(config.assetConfig);

    /** @type {Object|null} 解析后的资源 URL —— { moduleUrl, wasmBaseUrl, modelUrl } */
    this.assetUrls = null;

    /** @type {Object|null} MediaPipe ImageSegmenter 实例 */
    this.segmenter = null;

    /** @type {boolean} 分割器是否已成功初始化 */
    this.initialized = false;

    /** @type {Promise|null} 正在进行的初始化 Promise（用于去重，防止并发初始化） */
    this.initializingPromise = null;

    /** @type {Object|null} 当前正在执行的分割请求 —— { resolve, reject, promise } */
    this.pendingRequest = null;

    /** @type {Object|null} 排队中的分割请求，当前一个请求完成后立即处理 ——
     *   { videoElement, resolve, reject, promise } */
    this.queuedRequest = null;

    /** @type {boolean} 是否已调用 destroy() */
    this.destroyed = false;

    /** @type {string[]} 分割模型返回的标签列表 */
    this.labels = [];

    /** @type {number} 'person' 标签在 labels 中的索引 */
    this.personMaskIndex = 0;

    /** @type {HTMLCanvasElement|null} 复用的离屏 canvas，用于生成 alpha 遮罩 */
    this.maskCanvas = null;

    /** @type {CanvasRenderingContext2D|null} maskCanvas 的 2D 上下文 */
    this.maskContext = null;

    /** @type {ImageData|null} 复用的 ImageData 缓冲区，用于遮罩输出 */
    this.maskImageData = null;

    /** @type {HTMLCanvasElement|null} 对遮罩边缘做轻量羽化的离屏 canvas */
    this.featherCanvas = null;

    /** @type {CanvasRenderingContext2D|null} featherCanvas 的 2D 上下文 */
    this.featherContext = null;
  }

  _reportIssue(issue)
  {
    if (!this._onIssue) return;
    try { this._onIssue(Object.assign({ component: 'MediaPipeSegmenterRuntime' }, issue)); }
    catch (e) { if (logger) logger.warn(`MediaPipeSegmenterRuntime issue callback failed: ${ e.message || String(e)}`); }
  }
 
  // ---------------------------------------------------------------------------
  // 生命周期
  // ---------------------------------------------------------------------------

  /**
   * 初始化 MediaPipe ImageSegmenter。
   *
   * 加载 Tasks Vision 运行时（动态 <script> 注入）、解析 WASM 和模型 URL、
   * 创建分割器并记录标签列表，以便后续定位人物遮罩。
   *
   * 可安全地多次调用 —— 已初始化时立即返回，正在初始化时共享同一个 Promise。
   *
   * @param {Object} [options={}]
   * @param {string} [options.modelPath] — 可选的模型 URL 覆盖
   * @param {'GPU'} [options.delegate='GPU'] — 推理后端固定为 GPU
   * @returns {Promise<void>}
   * @throws {Error} 如果分割器已被销毁
   */
  async initialize(options = {})
  {
    if (this.destroyed)
    {
      throw new Error('MediaPipe segmenter destroyed');
    }

    if (this.initialized)
    {
      return;
    }

    if (this.initializingPromise)
    {
      return this.initializingPromise;
    }

    this.initializingPromise = (async() =>
    {
      let tasks = null;

      try
      {
        tasks = await this.assetLoader.ensureTasksLoaded();
      }
      catch (error)
      {
        this._reportIssue({
          stage           : 'aivb-runtime-load',
          severity        : 'warn',
          fallbackApplied : true,
          degraded        : true,
          message         : error && error.message ? error.message : String(error),
          details         : {
            assetConfig : this.assetLoader && this.assetLoader.assetConfig ?
              Object.assign({}, this.assetLoader.assetConfig) :
              {}
          }
        });

        if (error && typeof error === 'object')
        {
          error.__mediaEffectsIssueReported = true;
        }

        throw error;
      }

      const { FilesetResolver, ImageSegmenter } = tasks;

      if (this.destroyed)
      {
        throw new Error('MediaPipe segmenter destroyed');
      }

      this.assetUrls = this.assetLoader.getRuntimeOptions(options.modelPath);
      const vision = await FilesetResolver.forVisionTasks(this.assetUrls.wasmBaseUrl);
      const requestedDelegate = normalizeDelegate(options.delegate);
      const segmenter = await this.createGpuSegmenter(
        ImageSegmenter,
        vision,
        requestedDelegate
      );

      try
      {
        if (this.destroyed)
        {
          throw new Error('MediaPipe segmenter destroyed');
        }

        this.segmenter = segmenter;
        this.labels = typeof segmenter.getLabels === 'function' ? segmenter.getLabels() : [];
        this.initialized = true;
        logger.debug(`initialize() complete: ${JSON.stringify(this.assetUrls)}`);
      }
      catch (error)
      {
        // 尽力关闭刚创建的分割器
        if (typeof segmenter.close === 'function')
        {
          try
          {
            await segmenter.close();
          }
          catch (closeError)
          {
            logger.warn(`Failed to close MediaPipe segmenter after initialize error: ${closeError.message}`);
          }
        }

        this.segmenter = null;
        this.assetUrls = null;
        this.initialized = false;
        this.labels = [];
        this.personMaskIndex = 0;
        this.maskCanvas = null;
        this.maskContext = null;
        this.maskImageData = null;
        this.featherCanvas = null;
        this.featherContext = null;

        // 拒绝正在等待初始化的请求
        if (this.pendingRequest)
        {
          const pending = this.pendingRequest;

          this.pendingRequest = null;
          pending.reject(error);
        }

        throw error;
      }
    })();

    try
    {
      await this.initializingPromise;
    }
    finally
    {
      this.initializingPromise = null;
    }
  }

  async createGpuSegmenter(ImageSegmenter, vision, requestedDelegate)
  {
    try
    {
      return await ImageSegmenter.createFromOptions(
        vision,
        segmentationHelpers.createSegmenterOptions(this.assetUrls.modelUrl, requestedDelegate)
      );
    }
    catch (error)
    {
      logger.warn(
        `ImageSegmenter GPU init failed; CPU fallback is disabled: ${
          error && error.message ? error.message : error
        }`
      );

      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // 分割
  // ---------------------------------------------------------------------------

  /**
   * 为给定视频帧排期一次分割。
   *
   * 如果已有分割正在进行，最新的帧会被排队（仅保留一帧排队 —— 更早的排队帧会被替换）。
   * 这样可以在不积压请求的前提下保持管线响应。
   *
   * @param {HTMLVideoElement} videoElement — 源视频元素
   * @returns {Promise<{ segmentationMask: HTMLCanvasElement }>}
   * @throws {Error} 如果分割器未初始化
   */
  async segmentForVideo(videoElement)
  {
    if (!this.initialized || !this.segmenter)
    {
      throw new Error('MediaPipe segmenter not initialized');
    }

    if (this.pendingRequest)
    {
      if (!this.queuedRequest)
      {
        let resolveQueued;
        let rejectQueued;

        const queuedPromise = new Promise((resolve, reject) =>
        {
          resolveQueued = resolve;
          rejectQueued = reject;
        });

        this.queuedRequest = {
          videoElement,
          resolve : resolveQueued,
          reject  : rejectQueued,
          promise : queuedPromise
        };
      }
      else
      {
        // 替换之前的排队帧 —— 只有最新的帧才重要
        this.queuedRequest.videoElement = videoElement;
      }

      logger.debug('segmentForVideo() queued latest frame while previous segmentation is pending');

      return this.queuedRequest.promise;
    }

    return this.runSegmentation(videoElement);
  }

  updateQueuedFrame(videoElement)
  {
    if (!this.queuedRequest)
    {
      return false;
    }

    this.queuedRequest.videoElement = videoElement;

    return true;
  }

  /**
   * 执行一次分割。
   *
   * 调用 MediaPipe 分割器的 VIDEO 模式 API，将置信度遮罩输出转换为基于 canvas 的 alpha 遮罩。
   *
   * @private
   * @param {HTMLVideoElement} videoElement
   * @returns {Promise<{ segmentationMask: HTMLCanvasElement }>}
   */
  async runSegmentation(videoElement)
  {
    let resolvePending;
    let rejectPending;

    const promise = new Promise((resolve, reject) =>
    {
      resolvePending = resolve;
      rejectPending = reject;
    });

    this.pendingRequest = {
      resolve : resolvePending,
      reject  : rejectPending,
      promise
    };

    const timestampMs = typeof performance !== 'undefined' &&
      typeof performance.now === 'function'
      ? performance.now()
      : Date.now();

    try
    {
      // MediaPipe VIDEO 模式的分割是基于回调的
      this.segmenter.segmentForVideo(videoElement, timestampMs, (result) =>
      {
        // 防止 destroy() 已将 pendingRequest 置空后的过时回调
        if (!this.pendingRequest || this.pendingRequest.promise !== promise)
        {
          return;
        }

        const pending = this.pendingRequest;

        this.pendingRequest = null;

        try
        {
          pending.resolve({
            segmentationMask : this.createSegmentationMask(result)
          });
        }
        catch (error)
        {
          pending.reject(error);
        }
        finally
        {
          this.closeSegmentationResult(result);
          this.processQueuedRequest();
        }
      });
    }
    catch (error)
    {
      const pending = this.pendingRequest;

      this.pendingRequest = null;
      pending.reject(error);
      this.processQueuedRequest();
    }

    return promise;
  }

  /**
   * 如果有排队请求且没有其他请求正在执行，将其出队并执行。
   *
   * @private
   */
  processQueuedRequest()
  {
    if (!this.queuedRequest || this.pendingRequest || this.destroyed)
    {
      return;
    }

    const queued = this.queuedRequest;

    this.queuedRequest = null;
    this.runSegmentation(queued.videoElement)
      .then(queued.resolve)
      .catch(queued.reject);
  }

  // ---------------------------------------------------------------------------
  // 遮罩构建
  // ---------------------------------------------------------------------------

  /**
   * 确定哪个置信度遮罩对应"人物"。
   *
   * 启发式策略：
   *   1. 在标签中搜索匹配 /person/i 的项
   *   2. 若无标签匹配且有多个遮罩，选最后一个（selfie-segmenter 模型的最后一个输出通常是人像）
   *   3. 兜底使用索引 0
   *
   * @param {number} maskCount — 返回的置信度遮罩总数
   * @returns {number} 从 0 开始的索引
   */
  resolvePersonMaskIndex(maskCount)
  {
    return segmentationHelpers.resolvePersonMaskIndex(this.labels, maskCount);
  }

  /**
   * 从原始分割结果构建基于 canvas 的 alpha 遮罩。
   *
   * 遮罩为灰度 canvas，其中：
   *   - R=G=B=0（黑色）
   *   - A = round(置信度 × 255)
   *
   * 此 canvas 可作为 destination-in 合成的源来使用。
   *
   * @private
   * @param {Object} result — 原始 MediaPipe ImageSegmenterResult
   * @returns {HTMLCanvasElement} 已绘制 alpha 遮罩的 canvas
   * @throws {Error} 如果未找到支持的遮罩输出
   */
  createSegmentationMask(result)
  {
    const mask = this.resolveOutputMask(result);
    const width = mask.width;
    const height = mask.height;

    if (!width || !height)
    {
      throw new Error('ImageSegmenter returned invalid categoryMask size');
    }

    // 懒创建 / 调整复用的遮罩 canvas
    if (!this.maskCanvas)
    {
      this.maskCanvas = document.createElement('canvas');
      this.maskContext = this.maskCanvas.getContext('2d');
    }

    if (!this.maskContext)
    {
      throw new Error('Unable to create segmentation mask canvas');
    }

    if (this.maskCanvas.width !== width || this.maskCanvas.height !== height || !this.maskImageData)
    {
      this.maskCanvas.width = width;
      this.maskCanvas.height = height;
      this.maskImageData = this.maskContext.createImageData(width, height);
    }

    const confidenceValues = this.readMaskValues(mask);
    const imageData = this.maskImageData.data;

    segmentationHelpers.fillAlphaMaskImageData(confidenceValues, imageData, DEFAULT_MASK_ALPHA_BIAS);

    this.maskContext.putImageData(this.maskImageData, 0, 0);

    return this.copyMaskForResult(this.applyMaskEdgeBlur(width, height));
  }

  copyMaskForResult(maskCanvas)
  {
    if (!maskCanvas || typeof document === 'undefined')
    {
      return maskCanvas;
    }

    const width = Number(maskCanvas.width) || 0;
    const height = Number(maskCanvas.height) || 0;

    if (!width || !height)
    {
      return maskCanvas;
    }

    const resultCanvas = document.createElement('canvas');
    const resultContext = resultCanvas.getContext('2d');

    if (!resultContext)
    {
      return maskCanvas;
    }

    resultCanvas.width = width;
    resultCanvas.height = height;
    resultContext.drawImage(maskCanvas, 0, 0, width, height);

    return resultCanvas;
  }

  applyMaskEdgeBlur(width, height)
  {
    if (!this.maskCanvas || !this.maskContext || DEFAULT_MASK_EDGE_BLUR_PX <= 0)
    {
      return this.maskCanvas;
    }

    if (!this.featherCanvas)
    {
      this.featherCanvas = document.createElement('canvas');
      this.featherContext = this.featherCanvas.getContext('2d');
    }

    if (!this.featherContext)
    {
      return this.maskCanvas;
    }

    if (this.featherCanvas.width !== width)
    {
      this.featherCanvas.width = width;
    }

    if (this.featherCanvas.height !== height)
    {
      this.featherCanvas.height = height;
    }

    const inset = Math.max(0, Math.min(DEFAULT_MASK_INSET_PX, Math.min(width, height) / 4));

    this.featherContext.clearRect(0, 0, width, height);
    this.featherContext.save();
    this.featherContext.filter = `blur(${DEFAULT_MASK_EDGE_BLUR_PX}px)`;
    this.featherContext.drawImage(
      this.maskCanvas,
      inset,
      inset,
      Math.max(1, width - (inset * 2)),
      Math.max(1, height - (inset * 2))
    );
    this.featherContext.restore();

    return this.featherCanvas;
  }

  /**
   * 从分割结果中解析出要使用的遮罩。
   *
   * 优先使用 confidenceMasks[personMaskIndex]（如果可用）；
   * 回退到 categoryMask（兼容旧模型）。
   *
   * @private
   * @param {Object} result
   * @returns {Object} 单个遮罩对象（含 width、height 及数据访问方法）
   * @throws {Error} 如果既没有 confidenceMasks 也没有 categoryMask
   */
  resolveOutputMask(result)
  {
    const outputMask = segmentationHelpers.resolveOutputMask(result, this.labels);

    this.personMaskIndex = outputMask.personMaskIndex;

    return outputMask.mask;
  }

  /**
   * 从 MediaPipe 遮罩中读取原始置信度值。
   *
   * 支持 Float32Array 输出（置信度遮罩）和 Uint8Array 输出（类别遮罩），
   * 全部归一化为 [0, 1] 范围内的 Float32。
   *
   * @private
   * @param {Object} mask — MediaPipe 遮罩对象
   * @returns {Float32Array} [0, 1] 范围内的置信度值
   * @throws {Error} 如果遮罩格式不受支持
   */
  readMaskValues(mask)
  {
    return segmentationHelpers.readMaskValues(mask);
  }

  /**
   * 释放分割结果关联的 MediaPipe 资源。
   *
   * MediaPipe 结果可能持有 WASM 底层资源，需要显式清理。
   * 此方法同时关闭结果本身及其子遮罩对象。
   *
   * @private
   * @param {Object} result — MediaPipe ImageSegmenterResult
   */
  closeSegmentationResult(result)
  {
    segmentationHelpers.closeSegmentationResult(result);
  }

  // ---------------------------------------------------------------------------
  // 销毁
  // ---------------------------------------------------------------------------

  /**
   * 销毁分割器：关闭 MediaPipe 实例、拒绝未完成的 Promise、释放所有资源。
   *
   * 可安全地多次调用。
   *
   * @returns {Promise<void>}
   */
  async destroy()
  {
    this.destroyed = true;

    // 拒绝正在执行的分割
    if (this.pendingRequest)
    {
      const pending = this.pendingRequest;

      this.pendingRequest = null;
      pending.reject(new Error('MediaPipe segmenter destroyed'));
    }

    // 拒绝排队中的帧
    if (this.queuedRequest)
    {
      const queued = this.queuedRequest;

      this.queuedRequest = null;
      queued.reject(new Error('MediaPipe segmenter destroyed'));
    }

    // 等待初始化完成，以便安全关闭它可能已创建的分割器
    if (this.initializingPromise)
    {
      try
      {
        await this.initializingPromise;
      }
      catch (error)
      {
        logger.debug(`destroy() ignored initialize error: ${error.message}`);
      }
    }

    if (this.segmenter && typeof this.segmenter.close === 'function')
    {
      await this.segmenter.close();
    }

    this.segmenter = null;
    this.assetUrls = null;
    this.initialized = false;
    this.initializingPromise = null;
    this.labels = [];
    this.personMaskIndex = 0;
    this.maskCanvas = null;
    this.maskContext = null;
    this.maskImageData = null;
    this.featherCanvas = null;
    this.featherContext = null;
  }
};
