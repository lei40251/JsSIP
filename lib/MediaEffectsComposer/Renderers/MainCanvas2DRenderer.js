/**
 * MainCanvas2DRenderer — 主线程 Canvas2D 渲染器
 *
 * 最基础的渲染路径，依赖 CanvasRenderingContext2D.drawImage() 将
 * 各路视频绘制到输出 canvas。所有更高性能路径初始化失败时都会降级到这里。
 *
 * 特点：
 *   - 兼容性最好，所有支持 Canvas 的浏览器均可使用
 *   - 性能依赖浏览器 Canvas2D 实现的硬件加速能力
 *   - 行为与旧版 composer drawImage 逻辑一致，作为稳定兜底
 *
 * @module MainCanvas2DRenderer
 */
const createRendererBase = require('./RendererBase');

function buildForegroundFilter(postProcessing)
{
  const config = postProcessing && typeof postProcessing === 'object' ? postProcessing : {};
  const brightness = Number(config.foregroundBrightness);
  const contrast = Number(config.foregroundContrast);
  const saturate = Number(config.foregroundSaturate);

  return `brightness(${Number.isFinite(brightness) ? brightness : 1}) contrast(${Number.isFinite(contrast) ? contrast : 1}) saturate(${Number.isFinite(saturate) ? saturate : 1})`;
}

module.exports = class MainCanvas2DRenderer 
{
  /**
   * @param {Object} config - 混流配置
   * @param {Object} info - 渲染器元信息
   */
  constructor(config, info)
  {
    Object.assign(this, createRendererBase(config, Object.assign({
      actualMode : 'main-2d',
      isWorker   : false,
      isWebGL2   : false
    }, info || {})));

    /** @type {HTMLCanvasElement|null} 输出 canvas */
    this._canvas = null;

    /** @type {CanvasRenderingContext2D|null} Canvas2D 上下文 */
    this._context = null;
    this._aiVB = config && config.aiVBManager ? config.aiVBManager : null;
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
    this._info.width = width;
    this._info.height = height;

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

      if (item.aiBackground && this._aiVB)
      {
        this._drawAiVBItem(item, payload.outputMirrorX, payload.width);

        return;
      }

      this._drawItem(item, payload.outputMirrorX, payload.width);
    });

    const sourceWatermarkMirrorX = payload.outputMirrorX;
    const outputWatermarkMirrorX = payload.mirrorWatermarks === false ? false : payload.outputMirrorX;

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

  _drawAiVBItem(item, outputMirrorX, canvasWidth)
  {
    if (!item || !item.source || !this._aiVB)
    {
      this._drawItem(item, outputMirrorX, canvasWidth);

      return;
    }

    const effect = this._aiVB.getRenderableState(item.source, item.video);

    if (!effect || !effect.config || effect.config.mode === 'none')
    {
      this._drawItem(item, outputMirrorX, canvasWidth);

      return;
    }

    const draw = this._resolveDrawRect(item.draw, outputMirrorX, canvasWidth);
    const effectiveMirrorX = Boolean(item.mirrorX) !== Boolean(outputMirrorX);
    const mask = effect.latestMask;
    const foregroundSource = effect.latestFrame || item.video;

    if (!draw || !mask)
    {
      this._drawItem(item, outputMirrorX, canvasWidth);

      return;
    }

    const work = this._ensureWorkSurface(effect.state, draw.width, draw.height);

    if (!work || !work.context)
    {
      this._drawItem(item, outputMirrorX, canvasWidth);

      return;
    }

    work.context.clearRect(0, 0, work.canvas.width, work.canvas.height);
    work.context.filter = buildForegroundFilter(effect.config.postProcessing);
    this._drawSurfaceToContext(work.context, foregroundSource, {
      x      : 0,
      y      : 0,
      width  : work.canvas.width,
      height : work.canvas.height
    }, effectiveMirrorX);
    work.context.filter = 'none';
    work.context.globalCompositeOperation = 'destination-in';
    this._drawSurfaceToContext(work.context, mask, {
      x      : 0,
      y      : 0,
      width  : work.canvas.width,
      height : work.canvas.height
    }, effectiveMirrorX);
    work.context.globalCompositeOperation = 'source-over';

    if (effect.config.mode === 'blur')
    {
      this._context.save();
      this._context.filter = `blur(${effect.config.blurRadius}px)`;
      this._drawSurface(foregroundSource, draw, effectiveMirrorX);
      this._context.restore();
    }
    else if (effect.config.mode === 'image')
    {
      // 背景图就绪时绘制 cover-fit 背景；未就绪时跳过背景层，
      // 前景（人物抠图）直接叠加在画布底色上，避免回退到原始视频画面导致闪烁
      if (effect.backgroundImage)
      {
        this._drawCoverSurface(effect.backgroundImage, draw);
      }
    }
    else if (effect.config.mode === 'color')
    {
      this._context.fillStyle = effect.config.backgroundColor || '#00ff00';
      this._context.fillRect(draw.x, draw.y, draw.width, draw.height);
    }

    this._context.drawImage(work.canvas, draw.x, draw.y, draw.width, draw.height);
    this._aiVB.noteFrameRendered(item.source, true);
  }

  _ensureWorkSurface(state, width, height)
  {
    if (!state)
    {
      return null;
    }

    if (!state.workCanvas)
    {
      state.workCanvas = document.createElement('canvas');
      state.workContext = state.workCanvas.getContext('2d');
    }

    if (!state.workContext)
    {
      return null;
    }

    if (state.workCanvas.width !== Math.max(1, Math.round(width)))
    {
      state.workCanvas.width = Math.max(1, Math.round(width));
    }

    if (state.workCanvas.height !== Math.max(1, Math.round(height)))
    {
      state.workCanvas.height = Math.max(1, Math.round(height));
    }

    return {
      canvas  : state.workCanvas,
      context : state.workContext
    };
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

  _drawSurfaceToContext(context, surface, draw, mirrorX)
  {
    if (!context || !surface || !draw)
    {
      return;
    }

    if (!mirrorX)
    {
      context.drawImage(surface, draw.x, draw.y, draw.width, draw.height);

      return;
    }

    context.save();
    context.translate(draw.x + draw.width, draw.y);
    context.scale(-1, 1);
    context.drawImage(surface, 0, 0, draw.width, draw.height);
    context.restore();
  }

  _drawCoverSurface(surface, draw)
  {
    const imageWidth = surface.naturalWidth || surface.videoWidth || surface.width;
    const imageHeight = surface.naturalHeight || surface.videoHeight || surface.height;

    if (!imageWidth || !imageHeight)
    {
      return false;
    }

    const imageAspect = imageWidth / imageHeight;
    const drawAspect = draw.width / draw.height;
    let sourceWidth = imageWidth;
    let sourceHeight = imageHeight;
    let sourceX = 0;
    let sourceY = 0;

    if (imageAspect > drawAspect)
    {
      sourceWidth = imageHeight * drawAspect;
      sourceX = (imageWidth - sourceWidth) / 2;
    }
    else
    {
      sourceHeight = imageWidth / drawAspect;
      sourceY = (imageHeight - sourceHeight) / 2;
    }

    this._context.drawImage(
      surface,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      draw.x,
      draw.y,
      draw.width,
      draw.height
    );

    return true;
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
