/**
 * MainCanvas2DRenderer — 主线程 Canvas2D 渲染器
 *
 * 最基础的渲染路径，依赖 CanvasRenderingContext2D.drawImage() 将
 * 各路视频绘制到输出 canvas。所有更高性能路径初始化失败时都会降级到这里。
 *
 * 特点：
 *   - 兼容性最好，所有支持 Canvas 的浏览器均可使用
 *   - 性能依赖浏览器 Canvas2D 实现的硬件加速能力
 *   - 行为与旧版 Mixer drawImage 逻辑一致，作为稳定兜底
 *
 * @module MainCanvas2DRenderer
 */
const BaseRenderer = require('./BaseRenderer');

module.exports = class MainCanvas2DRenderer extends BaseRenderer
{
  /**
   * @param {Object} config - 混流配置
   * @param {Object} info - 渲染器元信息
   */
  constructor(config, info)
  {
    super(config, Object.assign({
      actualMode : 'main-2d',
      isWorker   : false,
      isWebGL2   : false
    }, info || {}));

    /** @type {HTMLCanvasElement|null} 输出 canvas */
    this._canvas = null;

    /** @type {CanvasRenderingContext2D|null} Canvas2D 上下文 */
    this._context = null;
  }

  /**
   * 初始化 Canvas2D 渲染上下文。
   *
   * @param {HTMLCanvasElement} canvas - 输出 canvas
   * @returns {boolean} true=初始化成功
   * @throws {Error} Canvas2D context 不可用时抛出
   */
  init(canvas)
  {
    this._canvas = canvas;
    this._context = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');

    if (!this._context)
    {
      throw new Error('Canvas2D context is not available');
    }

    this.resize(canvas.width, canvas.height);

    return true;
  }

  /**
   * 调整输出尺寸，同步更新 canvas 元素的宽高。
   * 只在尺寸真正变化时赋值，避免触发不必要的重绘。
   *
   * @param {number} width - 新宽度
   * @param {number} height - 新高度
   */
  resize(width, height)
  {
    super.resize(width, height);

    if (!this._canvas)
    {
      return;
    }

    if (this._canvas.width !== width)
    {
      this._canvas.width = width;
    }

    if (this._canvas.height !== height)
    {
      this._canvas.height = height;
    }
  }

  /**
   * 绘制一帧到 canvas。
   *
   * 流程：
   *   1. 调整 canvas 尺寸到 payload 尺寸
   *   2. 填充背景色，覆盖上一帧残留
   *   3. 遍历 items，按 draw 矩形依次调用 drawImage
   *
   * @param {Object} payload - 布局数据
   */
  render(payload)
  {
    if (!this._context || !payload)
    {
      return;
    }

    this.resize(payload.width, payload.height);

    // 每帧先铺背景色，确保源减少、slot 覆盖或 contain 留边时不会残留上一帧内容
    this._context.fillStyle = payload.backgroundColor || '#000';
    this._context.fillRect(0, 0, payload.width, payload.height);

    payload.items.forEach((item) =>
    {
      if (!item.video || item.video.readyState < 2)
      {
        return;
      }

      this._drawItem(item, payload.outputMirrorX, payload.width);
    });

    const sourceWatermarkMirrorX = payload.outputMirrorX;
    const outputWatermarkMirrorX = payload.mirrorWatermarksWithOutput === false ? false : payload.outputMirrorX;

    this._drawWatermarks(payload.sourceWatermarks, sourceWatermarkMirrorX, payload.width);
    this._drawWatermarks(payload.outputWatermarks, outputWatermarkMirrorX, payload.width);

    this._info.renderedFrames += 1;
    this._emitFramePresented({
      canvas    : this._canvas,
      timestamp : typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(),
      source    : 'main-2d'
    });
  }

  /**
   * 绘制水印列表。
   *
   * @param {Array<Object>} watermarks - 水印绘制项
   */
  _drawWatermarks(watermarks, outputMirrorX, canvasWidth)
  {
    if (!this._context)
    {
      return;
    }

    (watermarks || []).forEach((watermark) =>
    {
      if (!watermark.image || !watermark.draw)
      {
        return;
      }

      const previousAlpha = typeof this._context.globalAlpha === 'number' ? this._context.globalAlpha : 1;
      const draw = this._resolveDrawRect(watermark.draw, outputMirrorX, canvasWidth);

      this._context.globalAlpha = watermark.opacity;
      this._drawSurface(watermark.image, draw, Boolean(outputMirrorX));
      this._context.globalAlpha = previousAlpha;
    });
  }

  _drawItem(item, outputMirrorX, canvasWidth)
  {
    if (!item || !item.video || !item.draw)
    {
      return;
    }

    const draw = this._resolveDrawRect(item.draw, outputMirrorX, canvasWidth);
    const effectiveMirrorX = Boolean(item.mirrorX) !== Boolean(outputMirrorX);

    this._drawSurface(item.video, draw, effectiveMirrorX);
  }

  _drawSurface(surface, draw, mirrorX)
  {
    if (!surface || !draw)
    {
      return;
    }

    if (!mirrorX)
    {
      this._context.drawImage(
        surface,
        draw.x,
        draw.y,
        draw.width,
        draw.height
      );

      return;
    }

    this._context.save();
    this._context.translate(draw.x + draw.width, draw.y);
    this._context.scale(-1, 1);
    this._context.drawImage(surface, 0, 0, draw.width, draw.height);
    this._context.restore();
  }

  _resolveDrawRect(draw, outputMirrorX, canvasWidth)
  {
    if (!draw)
    {
      return null;
    }

    if (!outputMirrorX)
    {
      return draw;
    }

    return {
      x      : canvasWidth - draw.x - draw.width,
      y      : draw.y,
      width  : draw.width,
      height : draw.height
    };
  }

  /**
   * 销毁渲染器，清除 canvas 内容并释放上下文引用。
   */
  destroy()
  {
    if (this._context && this._canvas)
    {
      this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }

    this._context = null;
    this._canvas = null;
  }
};
