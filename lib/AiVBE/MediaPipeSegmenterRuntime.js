const Logger = require('../Logger');
const AiVBEAssetLoader = require('./AiVBEAssetLoader');
const AssetManifest = require('./AiVBEAssetManifest');

const logger = new Logger('AiVBEMediaPipeRuntime');

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
    this.latestResult = null;
    this.destroyed = false;
    this.handleResults = this.handleResults.bind(this);
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
      const SelfieSegmentation = await this.assetLoader.ensureScriptLoaded();

      if (this.destroyed)
      {
        throw new Error('MediaPipe segmenter destroyed');
      }

      this.assetUrls = this.assetLoader.getAssetUrls(options.modelPath);
      const landscapeModelFile = AssetManifest.FILES.landscapeModel;
      const portraitModelFile = AssetManifest.FILES.portraitModel;
      const segmenter = new SelfieSegmentation({
        locateFile : (file) =>
        {
          if (file === landscapeModelFile || file === portraitModelFile)
          {
            return this.assetUrls.modelUrl;
          }

          return `${this.assetUrls.visionBaseUrl}/${file}`;
        }
      });

      try
      {
        segmenter.setOptions({
          // Keep mask coordinates aligned with the original video frame.
          // Output mirroring is handled later by the WebGL composition stage.
          selfieMode     : false,
          modelSelection : options.modelSelection === 0 ? 0 : 1
        });
        await segmenter.initialize();

        if (this.destroyed)
        {
          throw new Error('MediaPipe segmenter destroyed');
        }

        segmenter.onResults(this.handleResults);
        this.segmenter = segmenter;
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
        this.latestResult = null;

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

    if (this.latestResult)
    {
      const latestResult = this.latestResult;

      this.latestResult = null;

      return latestResult;
    }

    if (this.pendingRequest)
    {
      return this.pendingRequest.promise;
    }

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

    this.segmenter.send({ image: videoElement }).catch((error) =>
    {
      if (!this.pendingRequest || this.pendingRequest.promise !== promise)
      {
        return;
      }

      const pending = this.pendingRequest;

      this.pendingRequest = null;
      pending.reject(error);
    });

    return promise;
  }

  handleResults(results)
  {
    if (this.pendingRequest)
    {
      const pending = this.pendingRequest;

      this.pendingRequest = null;
      pending.resolve(results);

      return;
    }

    this.latestResult = results;
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
    this.latestResult = null;
  }
};
