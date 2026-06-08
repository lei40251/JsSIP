const Logger = require('../Logger');
const AiVBEAssetLoader = require('./AiVBEAssetLoader');

const logger = new Logger('AiVBEMediaPipeRuntime');
const DEFAULT_DELEGATE = 'GPU';

module.exports = class MediaPipeSegmenterRuntime
{
  constructor(config = {})
  {
    this.assetLoader = new AiVBEAssetLoader(config.assetConfig);
    this.assetUrls = null;
    this.segmenter = null;
    this.initialized = false;
    this.initializingPromise = null;
    this.pendingRequest = null;
    this.queuedRequest = null;
    this.destroyed = false;
    this.labels = [];
    this.personMaskIndex = 0;
    this.maskCanvas = null;
    this.maskContext = null;
    this.maskImageData = null;
  }

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
      const { FilesetResolver, ImageSegmenter } = await this.assetLoader.ensureTasksLoaded();

      if (this.destroyed)
      {
        throw new Error('MediaPipe segmenter destroyed');
      }

      this.assetUrls = this.assetLoader.getRuntimeOptions(options.modelPath);
      const vision = await FilesetResolver.forVisionTasks(this.assetUrls.wasmBaseUrl);
      const segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions : {
          modelAssetPath : this.assetUrls.modelUrl,
          delegate       : options.delegate === 'CPU' ? 'CPU' : DEFAULT_DELEGATE
        },
        runningMode           : 'VIDEO',
        outputCategoryMask    : false,
        outputConfidenceMasks : true
      });

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
        this.queuedRequest.videoElement = videoElement;
      }

      logger.debug('segmentForVideo() queued latest frame while previous segmentation is pending');

      return this.queuedRequest.promise;
    }

    return this.runSegmentation(videoElement);
  }

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
      this.segmenter.segmentForVideo(videoElement, timestampMs, (result) =>
      {
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

  resolvePersonMaskIndex(maskCount)
  {
    for (let index = 0; index < this.labels.length; index += 1)
    {
      if (typeof this.labels[index] === 'string' && /person/i.test(this.labels[index]))
      {
        return index;
      }
    }

    if (maskCount > 1)
    {
      return maskCount - 1;
    }

    return 0;
  }

  createSegmentationMask(result)
  {
    const mask = this.resolveOutputMask(result);
    const width = mask.width;
    const height = mask.height;

    if (!width || !height)
    {
      throw new Error('ImageSegmenter returned invalid categoryMask size');
    }

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
    let offset = 0;

    for (let i = 0; i < confidenceValues.length; i += 1)
    {
      const alpha = Math.max(0, Math.min(255, Math.round(confidenceValues[i] * 255)));

      imageData[offset] = 0;
      imageData[offset + 1] = 0;
      imageData[offset + 2] = 0;
      imageData[offset + 3] = alpha;
      offset += 4;
    }

    this.maskContext.putImageData(this.maskImageData, 0, 0);

    return this.maskCanvas;
  }

  resolveOutputMask(result)
  {
    if (result && Array.isArray(result.confidenceMasks) && result.confidenceMasks.length > 0)
    {
      this.personMaskIndex = this.resolvePersonMaskIndex(result.confidenceMasks.length);

      return result.confidenceMasks[this.personMaskIndex];
    }

    if (result && result.categoryMask)
    {
      return result.categoryMask;
    }

    throw new Error('ImageSegmenter did not return a supported mask output');
  }

  readMaskValues(mask)
  {
    if (!mask)
    {
      throw new Error('ImageSegmenter mask is required');
    }

    if (typeof mask.getAsFloat32Array === 'function')
    {
      return mask.getAsFloat32Array();
    }

    if (typeof mask.getAsUint8Array === 'function')
    {
      const categoryValues = mask.getAsUint8Array();
      const floatValues = new Float32Array(categoryValues.length);

      for (let i = 0; i < categoryValues.length; i += 1)
      {
        floatValues[i] = categoryValues[i] > 0 ? 1 : 0;
      }

      return floatValues;
    }

    throw new Error('Unsupported ImageSegmenter mask format');
  }

  closeSegmentationResult(result)
  {
    if (result && typeof result.close === 'function')
    {
      result.close();

      return;
    }

    if (result && Array.isArray(result.confidenceMasks))
    {
      result.confidenceMasks.forEach((mask) =>
      {
        if (mask && typeof mask.close === 'function')
        {
          mask.close();
        }
      });
    }

    if (result && result.categoryMask && typeof result.categoryMask.close === 'function')
    {
      result.categoryMask.close();
    }
  }

  async destroy()
  {
    this.destroyed = true;

    if (this.pendingRequest)
    {
      const pending = this.pendingRequest;

      this.pendingRequest = null;
      pending.reject(new Error('MediaPipe segmenter destroyed'));
    }

    if (this.queuedRequest)
    {
      const queued = this.queuedRequest;

      this.queuedRequest = null;
      queued.reject(new Error('MediaPipe segmenter destroyed'));
    }

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
  }
};
