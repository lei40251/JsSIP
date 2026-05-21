/**
 * LayoutEngine — 混流器布局引擎
 *
 * 根据输入源的数量和 slot 分配，计算每路视频在固定输出画布上的绘制位置和尺寸，
 * 生成渲染 payload。画布尺寸由配置指定（默认 1280x720），不随源数量动态变化。
 *
 * @module LayoutEngine
 */
class LayoutEngine
{
  /**
   * @param {Object} options
   * @param {Object} options.sourceRegistry - SourceRegistry 实例
   * @param {HTMLCanvasElement} options.canvas - 输出 canvas 元素
   * @param {Object} options.config - 混流配置对象
   * @param {Function} options.prepareCanvas - 设置 canvas 尺寸的方法
   * @param {Function} options.resizeRenderer - 调整渲染器尺寸的方法
   */
  constructor(options)
  {
    options = options || {};

    this._sourceRegistry = options.sourceRegistry;
    this._canvas = options.canvas;
    this._config = options.config;
    this._prepareCanvas = options.prepareCanvas;
    this._resizeRenderer = options.resizeRenderer;
  }

  /**
   * 生成一帧的渲染 payload。
   *
   * 按 slot 将源排列到自动计算的网格中，画板尺寸固定。
   * 每个源按 slot 计算所在行列位置，支持动态增减源。
   *
   * @returns {Object} 渲染 payload { width, height, backgroundColor, items }
   */
  createRenderPayload()
  {
    this._prepareCanvas();
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
  }

  /**
   * 计算网格的行列数。
   *
   * 根据最大 slot 编号和总源数确定网格大小：
   *   1 路 → 1x1         2 路 → 按画布比例 1x2 或 2x1
   *   3~4 路 → 2x2      5~6 路 → 按比例 2x3 或 3x2
   *   7~9 路 → 3x3      10+ 路 → 尽可能接近正方形
   *
   * @returns {Object} { cols: number, rows: number }
   */
  _calcLayout()
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
  }

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
  _calcDrawRect(video, targetX, targetY, targetWidth, targetHeight)
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
  }

  /**
   * 等比缩放视频，使其完整显示在目标区域内（contain）。
   * 缩放后剩余空间居中留边，视频不会被裁剪。
   *
   * @param {number} width - 视频原始宽度（videoWidth）
   * @param {number} height - 视频原始高度（videoHeight）
   * @param {number} targetWidth - 目标区域宽度
   * @param {number} targetHeight - 目标区域高度
   * @returns {Object|null} { width, height, offsetX, offsetY }，无效尺寸返回 null
   */
  _scaleVideo(width, height, targetWidth, targetHeight)
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
      // 视频更宽（相对目标）：按目标宽度缩放，上下留边
      scale = targetWidth / width;
      newHeight = height * scale;
      newWidth = targetWidth;
    }
    else
    {
      // 视频更高（相对目标）：按目标高度缩放，左右留边
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
  }
}

module.exports = LayoutEngine;
