/**
 * Mixer 内部渲染器基类。
 *
 * 公开 SDK 不暴露这些类；它们只负责把 Mixer 已经算好的布局画到同一个 canvas。
 * Mixer 继续负责源管理、布局计算、音频混合和输出 MediaStream 生命周期。
 */
module.exports = class BaseRenderer
{
  constructor(config, info)
  {
    this._config = config || {};
    this._info = Object.assign({
      requestedMode  : this._config.renderMode || 'main-2d',
      actualMode     : 'unknown',
      isWorker       : false,
      isWebGL2       : false,
      isFallback     : false,
      reason         : '',
      droppedFrames  : 0,
      renderedFrames : 0,
      fps            : this._config.fps || null,
      width          : this._config.width || null,
      height         : this._config.height || null
    }, info || {});
  }

  init()
  {
    return true;
  }

  render()
  {}

  resize(width, height)
  {
    this._info.width = width;
    this._info.height = height;
  }

  removeSource()
  {}

  destroy()
  {}

  getInfo()
  {
    return Object.assign({}, this._info);
  }

  _updateInfo(info)
  {
    Object.assign(this._info, info || {});
  }
};
