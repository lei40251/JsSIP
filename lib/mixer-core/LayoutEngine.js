/**
 * LayoutEngine — 混流器布局引擎
 *
 * 根据输入源的数量、slot 分配和布局模式（legacy / grid），
 * 计算每路视频在输出画布上的绘制位置和尺寸，生成渲染 payload。
 *
 * 布局模式：
 *   - legacy：固定 640x480 单元格，最多 2x2，向后兼容旧版调用方
 *   - grid：按 slot 和输出画布比例自动计算网格，支持动态增减
 *
 * @module LayoutEngine
 */

/**
 * 构造函数。
 *
 * @param {Object} options
 * @param {Object} options.sourceRegistry - SourceRegistry 实例，用于获取输入源列表
 * @param {HTMLCanvasElement} options.canvas - 输出 canvas 元素
 * @param {Object} options.config - 混流配置对象
 * @param {Function} options.prepareModernCanvas - 设置 grid 模式 canvas 尺寸的方法
 * @param {Function} options.resizeRenderer - 调整渲染器尺寸的方法
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

/**
 * 根据布局模式生成一帧的渲染 payload。
 *
 * @param {string} layoutMode - 布局模式：'legacy' | 'grid'
 * @returns {Object} 渲染 payload { width, height, backgroundColor, items }
 */
LayoutEngine.prototype.createRenderPayload = function(layoutMode)
{
  if (layoutMode !== 'legacy')
  {
    return this._createModernRenderPayload();
  }

  return this._createLegacyRenderPayload();
};

/**
 * 创建 legacy 模式的渲染 payload。
 *
 * 固定布局规则：
 *   - 1 路源：640x480，单格
 *   - 2 路源：1280x480，左右并列
 *   - 3~4 路源：1280x960，2x2 宫格
 * 每个单元格 640x480，源按索引依次放入。
 *
 * @returns {Object} 渲染 payload
 */
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

/**
 * 创建 grid 模式的渲染 payload。
 *
 * 按 slot 将源排列到自动计算的网格中，画板尺寸固定。
 * 每个源按 slot 计算所在行列位置，支持动态增减源。
 *
 * @returns {Object} 渲染 payload
 */
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

/**
 * 计算 grid 模式的网格行列数。
 *
 * 根据最大 slot 编号和总源数确定网格大小：
 *   1 路 → 1x1         2 路 → 按画布比例 1x2 或 2x1
 *   3~4 路 → 2x2      5~6 路 → 按比例 2x3 或 3x2
 *   7~9 路 → 3x3      10+ 路 → 尽可能接近正方形
 *
 * @returns {Object} { cols: number, rows: number }
 */
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

/**
 * 计算一路视频在画布上的实际绘制矩形。
 * 保持视频原始宽高比，在目标区域内居中显示。
 *
 * @param {HTMLVideoElement} video - video 元素
 * @param {number} targetX - 目标区域左上角 X
 * @param {number} targetY - 目标区域左上角 Y
 * @param {number} targetWidth - 目标区域宽度
 * @param {number} targetHeight - 目标区域高度
 * @returns {Object|null} 绘制矩形 { x, y, width, height }，无法计算时返回 null
 */
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

/**
 * 等比缩放视频，使其完全覆盖目标区域（封面效果 / cover）。
 * 缩放后超出目标区域的部分被裁剪，视频在区域内居中。
 *
 * @param {number} width - 视频原始宽度（videoWidth）
 * @param {number} height - 视频原始高度（videoHeight）
 * @param {number} targetWidth - 目标区域宽度
 * @param {number} targetHeight - 目标区域高度
 * @returns {Object|null} { width, height, offsetX, offsetY }，无效尺寸返回 null
 */
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
    // 视频更宽（相对目标）：按目标宽度缩放，高度超出部分上下裁剪
    scale = targetWidth / width;
    newHeight = height * scale;
    newWidth = targetWidth;
  }
  else
  {
    // 视频更高（相对目标）：按目标高度缩放，宽度超出部分左右裁剪
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
