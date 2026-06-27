/**
 * 渲染器共享基础方法工厂（纯函数，不是类）。
 *
 * 只提供辅助方法（getInfo / _updateInfo / setFramePresentedCallback / _emitFramePresented）
 * 和状态初始化。不提供 init / render / resize / removeSource / destroy，
 * 这些由各渲染器类自行实现，避免 Object.assign 遮蔽原型方法。
 */

function createRendererBase(config, info)
{
  config = config || {};
  info = Object.assign({
    requestedMode  : config.renderMode || 'main-2d',
    actualMode     : 'unknown',
    isWorker       : false,
    isWebGL2       : false,
    isFallback     : false,
    reason         : '',
    droppedFrames  : 0,
    renderedFrames : 0,
    fps            : config.fps || null,
    width          : config.width || null,
    height         : config.height || null
  }, info || {});

  return {
    _config           : config, 
    _info             : info,
    _onFramePresented : null,

    getInfo() { return Object.assign({}, this._info); },

    _updateInfo(updates) { Object.assign(this._info, updates || {}); },

    setFramePresentedCallback(callback)
    {
      this._onFramePresented = typeof callback === 'function' ? callback : null;
    },

    _emitFramePresented(meta)
    {
      if (this._onFramePresented) this._onFramePresented(meta || {});
    }
  };
}

module.exports = createRendererBase;
