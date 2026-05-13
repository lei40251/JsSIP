/**
 * Builds renderer payloads from Mixer sources and layout mode.
 */
function LayoutEngine(options)
{
  options = options || {};

  this._sourceRegistry = options.sourceRegistry;
  this._canvas = options.canvas;
  this._config = options.config;
  this._prepareModernCanvas = options.prepareModernCanvas;
  this._resizeRenderer = options.resizeRenderer;
}

LayoutEngine.prototype.createRenderPayload = function(layoutMode)
{
  if (layoutMode !== 'legacy')
  {
    return this._createModernRenderPayload();
  }

  return this._createLegacyRenderPayload();
};

LayoutEngine.prototype._createLegacyRenderPayload = function()
{
  const renderSources = this._sourceRegistry.sources.filter((source) => this._sourceRegistry.isRenderable(source));
  let rowCount = 1;

  if (renderSources.length >= 3)
  {
    rowCount = 2;
  }

  const canvasWidth = renderSources.length >= 2 ? 1280 : 640;
  const canvasHeight = 480 * rowCount;

  if (this._canvas.width !== canvasWidth)
  {
    this._canvas.width = canvasWidth;
  }

  if (this._canvas.height !== canvasHeight)
  {
    this._canvas.height = canvasHeight;
  }

  this._resizeRenderer(canvasWidth, canvasHeight);

  const items = [];

  renderSources.forEach((source, idx) =>
  {
    const draw = this._calcDrawRect(source.video, (idx % 2) * 640, Math.floor(idx / 2) * 480, 640, 480);

    if (draw)
    {
      items.push({
        id    : source.id,
        slot  : source.slot,
        video : source.video,
        draw  : draw
      });
    }
  });

  return {
    width           : canvasWidth,
    height          : canvasHeight,
    backgroundColor : this._config.backgroundColor,
    items           : items
  };
};

LayoutEngine.prototype._createModernRenderPayload = function()
{
  this._prepareModernCanvas();
  this._resizeRenderer(this._canvas.width, this._canvas.height);

  const layout = this._calcLayout();
  const cellWidth = this._canvas.width / layout.cols;
  const cellHeight = this._canvas.height / layout.rows;
  const items = [];

  this._sourceRegistry.sources.forEach((source) =>
  {
    if (!this._sourceRegistry.isRenderable(source))
    {
      return;
    }

    const slot = typeof source.slot === 'number' ? source.slot : 0;
    const col = slot % layout.cols;
    const row = Math.floor(slot / layout.cols);
    const targetX = col * cellWidth;
    const targetY = row * cellHeight;
    const draw = this._calcDrawRect(source.video, targetX, targetY, cellWidth, cellHeight);

    if (draw)
    {
      items.push({
        id    : source.id,
        slot  : slot,
        video : source.video,
        draw  : draw
      });
    }
  });

  return {
    width           : this._canvas.width,
    height          : this._canvas.height,
    backgroundColor : this._config.backgroundColor,
    items           : items
  };
};

LayoutEngine.prototype._calcLayout = function()
{
  let maxSlot = -1;

  this._sourceRegistry.sources.forEach((source) =>
  {
    if (typeof source.slot === 'number' && source.slot > maxSlot)
    {
      maxSlot = source.slot;
    }
  });

  const count = Math.max(maxSlot + 1, this._sourceRegistry.sources.length, 1);
  const isPortrait = this._canvas.height > this._canvas.width;
  let cols = 1;
  let rows = 1;

  if (count <= 1)
  {
    cols = 1;
    rows = 1;
  }
  else if (count <= 2)
  {
    if (isPortrait)
    {
      cols = 1;
      rows = 2;
    }
    else
    {
      cols = 2;
      rows = 1;
    }
  }
  else if (count <= 4)
  {
    cols = 2;
    rows = 2;
  }
  else if (count <= 6)
  {
    if (isPortrait)
    {
      cols = 2;
      rows = 3;
    }
    else
    {
      cols = 3;
      rows = 2;
    }
  }
  else if (count <= 9)
  {
    cols = 3;
    rows = 3;
  }
  else
  {
    cols = Math.ceil(Math.sqrt(count));
    rows = Math.ceil(count / cols);
  }

  return { cols, rows };
};

LayoutEngine.prototype._calcDrawRect = function(video, targetX, targetY, targetWidth, targetHeight)
{
  const newVideo = this._scaleVideo(video.videoWidth, video.videoHeight, targetWidth, targetHeight);

  if (!newVideo || !newVideo.width || !newVideo.height)
  {
    return null;
  }

  return {
    x      : targetX + newVideo.offsetX,
    y      : targetY + newVideo.offsetY,
    width  : newVideo.width,
    height : newVideo.height
  };
};

LayoutEngine.prototype._scaleVideo = function(width, height, targetWidth, targetHeight)
{
  let newWidth;
  let newHeight;
  let scale;

  if (!width || !height)
  {
    return null;
  }

  if (width / height >= targetWidth / targetHeight)
  {
    scale = targetWidth / width;
    newHeight = height * scale;
    newWidth = targetWidth;
  }
  else
  {
    scale = targetHeight / height;
    newWidth = width * scale;
    newHeight = targetHeight;
  }

  return {
    width   : newWidth,
    height  : newHeight,
    offsetX : Math.max(0, (targetWidth - newWidth) / 2),
    offsetY : Math.max(0, (targetHeight - newHeight) / 2)
  };
};

module.exports = LayoutEngine;
