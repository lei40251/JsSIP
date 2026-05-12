const BaseRenderer = require('./BaseRenderer');

/**
 * 主线程 Canvas2D 渲染器。
 *
 * 这是旧版 Mixer 的稳定兜底路径。所有更高性能路径初始化失败时都会回到这里，
 * 因此它的行为尽量保持简单、确定，并与旧 drawImage 逻辑一致。
 */
module.exports = class MainCanvas2DRenderer extends BaseRenderer
{
  constructor(config, info)
  {
    super(config, Object.assign({
      actualMode : 'main-2d',
      isWorker   : false,
      isWebGL2   : false
    }, info || {}));

    this._canvas = null;
    this._context = null;
  }

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

  render(payload)
  {
    if (!this._context || !payload)
    {
      return;
    }

    this.resize(payload.width, payload.height);

    // 每帧先铺背景色，确保源减少、slot 覆盖或 contain 留边时不会残留上一帧内容。
    this._context.fillStyle = payload.backgroundColor || '#000';
    this._context.fillRect(0, 0, payload.width, payload.height);

    payload.items.forEach((item) =>
    {
      if (!item.video || item.video.readyState < 2)
      {
        return;
      }

      this._context.drawImage(
        item.video,
        item.draw.x,
        item.draw.y,
        item.draw.width,
        item.draw.height
      );
    });

    this._info.renderedFrames += 1;
  }

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
