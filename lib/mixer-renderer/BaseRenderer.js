/**
 * BaseRenderer — 渲染器基类
 *
 * 定义所有渲染后端的统一接口。
 * 渲染器只负责把 Mixer 算好的布局 payload 绘制到 canvas，
 * 不关心源管理、布局计算、音频混音等业务逻辑。
 *
 * 子类必须实现：
 *   - init(canvas)    — 初始化渲染上下文
 *   - render(payload) — 绘制一帧
 * 可选覆盖：
 *   - resize(w, h)    — 调整输出尺寸
 *   - removeSource(id) — 释放指定源的 GPU 资源
 *   - destroy()       — 销毁所有资源
 *
 * @module BaseRenderer
 */
module.exports = class BaseRenderer
{
  /**
   * @param {Object} config - 混流配置（来自 MixerConfig）
   * @param {string} [config.renderMode] - 请求的渲染模式
   * @param {number} [config.fps] - 目标帧率
   * @param {number} [config.width] - 输出宽度
   * @param {number} [config.height] - 输出高度
   * @param {Object} [info] - 渲染器元信息（子类传入，覆盖基类默认值）
   * @param {string} [info.requestedMode] - 请求的渲染模式
   * @param {string} [info.actualMode] - 实际使用的渲染模式
   * @param {boolean} [info.isWorker] - 是否在 Worker 中运行
   * @param {boolean} [info.isWebGL2] - 是否使用 WebGL2
   * @param {boolean} [info.isFallback] - 是否为降级路径
   * @param {string} [info.reason] - 降级/失败原因描述
   */
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

  /**
   * 初始化渲染上下文。
   * 子类在此获取 canvas context、编译 shader 等。
   *
   * @param {HTMLCanvasElement} canvas - 输出 canvas
   * @returns {boolean} true=初始化成功
   */
  init()
  {
    return true;
  }

  /**
   * 绘制一帧到 canvas。
   *
   * @param {Object} payload - 布局数据（由 LayoutEngine.createRenderPayload 生成）
   * @param {number} payload.width - 画布宽度
   * @param {number} payload.height - 画布高度
   * @param {string} payload.backgroundColor - 背景色
   * @param {Array<Object>} payload.items - 每路视频的绘制信息
   */
  render()
  {}

  /**
   * 调整输出画布尺寸。
   *
   * @param {number} width - 新宽度
   * @param {number} height - 新高度
   */
  resize(width, height)
  {
    this._info.width = width;
    this._info.height = height;
  }

  /**
   * 移除一路源的 GPU 资源（如 WebGL 纹理）。
   * Worker 渲染器会将此操作转发到 Worker 线程。
   *
   * @param {string} id - 源 ID
   */
  removeSource()
  {}

  /**
   * 销毁渲染器，释放所有 GPU 资源和上下文引用。
   */
  destroy()
  {}

  /**
   * 获取渲染器运行时信息快照。
   * 返回副本，外部修改不影响内部状态。
   *
   * @returns {Object} 渲染状态信息
   */
  getInfo()
  {
    return Object.assign({}, this._info);
  }

  /**
   * 更新运行时信息（仅内部使用，子类调用）。
   *
   * @param {Object} info - 要更新的字段
   */
  _updateInfo(info)
  {
    Object.assign(this._info, info || {});
  }
};
