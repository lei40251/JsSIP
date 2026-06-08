const { buildCanvas2DPipeline } = require('./Canvas2DPipeline.js');
const Config = require('./AiVBEConfig');
const MediaPipeSegmenterRuntime = require('./MediaPipeSegmenterRuntime');
const Logger = require('../Logger');

const logger = new Logger('AiVBE');

class AiVBEEngine
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

    if (this.backgroundEl)
    {
      this.backgroundEl.onload = null;
      this.backgroundEl.onerror = null;
      this.backgroundEl.src = '';
      this.backgroundEl = null;
    }
  }

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

  async createVideoElement()
  {
    this.videoEl = document.createElement('video');
    this.videoEl.muted = true;
    this.videoEl.autoplay = true;
    this.videoEl.playsInline = true;
    this.videoEl.srcObject = this.inputStream;

    await this.videoEl.play();
  }

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

      backgroundEl.src = src;
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

  setMirror(mirror)
  {
    this.config.video.mirror = Boolean(mirror);

    if (this.pipeline && this.pipeline.updateMirror)
    {
      this.pipeline.updateMirror(this.config.video.mirror);
    }
  }

  start()
  {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = 0;
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  stop()
  {
    this.isRunning = false;

    if (this.animationFrameId)
    {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  async loop(now)
  {
    if (!this.isRunning) return;

    const interval = 1000 / this.config.video.targetFps;

    if (now - this.lastFrameTime >= interval)
    {
      this.lastFrameTime = now;
      if (this.isRendering)
      {
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

    if (normalizedUrl === 'none')
    {
      this.clearBackground();

      return;
    }

    return this.setupPipeline('image', normalizedUrl);
  }

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

  async setSolidColor(color = '#00ff00')
  {
    this._assertInitialized();

    if (!isValidColor(color))
    {
      throw new Error('Invalid color format. Expected #RRGGBB or rgba(r,g,b,a)');
    }

    return this.setupPipeline('color', color);
  }

  _assertInitialized()
  {
    if (!this.canvas || !this.videoEl || !this.outputStream)
    {
      throw new Error('AiVBEEngine not initialized');
    }
  }

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
