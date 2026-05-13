const RendererFactory = require('../mixer-renderer/RendererFactory');
const MainCanvas2DRenderer = require('../mixer-renderer/MainCanvas2DRenderer');

/**
 * Owns Mixer rendering cadence and renderer lifecycle.
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

  this._renderer = null;
  this._animationId = null;
  this._lastRenderTime = 0;
  this._renderFrameInterval = this._config.fps ? 1000 / this._config.fps : 0;
  this._renderErrorCount = 0;
  this._rendererErrorCount = 0;
  this._stopped = false;

  this._boundRenderFrame = this.renderFrame.bind(this);
}

RenderLoop.prototype.resume = function()
{
  this._stopped = false;
  this._notifyStateChange();
};

RenderLoop.prototype.start = function()
{
  this.resume();
  this._scheduleNextFrame();
};

RenderLoop.prototype.stop = function()
{
  this._stopped = true;

  if (this._animationId)
  {
    window.cancelAnimationFrame(this._animationId);
    this._animationId = null;
  }

  this._notifyStateChange();
};

RenderLoop.prototype.resetFrameTiming = function()
{
  this._lastRenderTime = 0;
  this._notifyStateChange();
};

RenderLoop.prototype.ensureRenderer = function()
{
  if (!this._renderer)
  {
    this._renderer = RendererFactory.createRenderer(this._canvas, this._config);
    this._notifyStateChange();
  }

  return this._renderer;
};

RenderLoop.prototype.resizeRenderer = function(width, height)
{
  if (this._renderer)
  {
    this._renderer.resize(width, height);
  }
};

RenderLoop.prototype.removeSource = function(sourceId)
{
  if (this._renderer && this._renderer.removeSource)
  {
    this._renderer.removeSource(sourceId);
  }
};

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
  this._notifyStateChange();
};

RenderLoop.prototype.destroy = function()
{
  this.stop();
  this._lastRenderTime = 0;

  if (this._renderer)
  {
    this._renderer.destroy();
    this._renderer = null;
  }

  this._notifyStateChange();
};

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
  this._notifyStateChange();

  return true;
};

RenderLoop.prototype._scheduleNextFrame = function()
{
  if (this._stopped || this._animationId || this._getSources().length === 0)
  {
    return;
  }

  this._animationId = window.requestAnimationFrame(this._boundRenderFrame);
};

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

RenderLoop.prototype._notifyStateChange = function()
{
  if (this._onStateChange)
  {
    this._onStateChange();
  }
};

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
