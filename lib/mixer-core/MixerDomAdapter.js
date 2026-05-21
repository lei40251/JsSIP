/**
 * MixerDomAdapter — 混流器 DOM 元素创建适配器
 *
 * 负责创建和管理混流器内部使用的 DOM 元素：
 *   - 离屏 canvas：用于合成视频帧
 *   - 隐藏 video 元素：用于播放每个 MediaStream
 *
 * 将这些 DOM 操作集中在此，方便测试时 mock 和后续迁移到 WebWorker 环境。
 *
 * @module MixerDomAdapter
 */
class MixerDomAdapter
{
  /**
   * @param {Object} options
   * @param {Object} options.config - 混流配置对象（含 width/height 等）
   * @param {Object} options.logger - 日志记录器
   */
  constructor(options)
  {
    options = options || {};

    this._config = options.config;
    this._logger = options.logger;
  }

  /**
   * 创建一个隐藏的离屏 canvas 元素。
   * 所有视频帧最终绘制到这个 canvas 上，然后通过 captureStream() 输出。
   *
   * @returns {HTMLCanvasElement} 隐藏的 canvas 元素
   */
  createCanvas()
  {
    const canvas = document.createElement('canvas');

    canvas.setAttribute('style', 'display:none');

    return canvas;
  }

  /**
   * 将 canvas 尺寸设置为配置值（grid 模式）。
   * 设置 canvas.width/height 会清空画布内容，因此只在尺寸变化时才修改。
   *
   * @param {HTMLCanvasElement} canvas - 目标 canvas 元素
   */
  prepareCanvas(canvas)
  {
    const width = this._config.width || 1280;
    const height = this._config.height || 720;

    // canvas width/height 设置时会清空画布，只在尺寸变化时才写
    if (canvas.width !== width)
    {
      canvas.width = width;
    }

    if (canvas.height !== height)
    {
      canvas.height = height;
    }
  }

  /**
   * 将 MediaStream 包裹为隐藏的 HTMLVideoElement。
   * video 元素属性：display:none、muted、autoplay、playsinline。
   *
   * @param {MediaStream|Object} mediaStream - MediaStream 或 { mediaStream } 包装对象
   * @returns {HTMLVideoElement} 可播放该流的隐藏 video 元素
   */
  createVideoElement(mediaStream)
  {
    const video = document.createElement('video');

    video.setAttribute('style', 'display:none');
    video.muted = true;
    video.autoplay = true;
    video.setAttribute('playsinline', '');
    video.srcObject = mediaStream && (mediaStream.mediaStream || mediaStream);
    video.play().catch((error) =>
    {
      const stream = video.srcObject;
      const streamId = stream && stream.id ? stream.id : 'unknown';

      this._logger.error(`video play error for stream ${streamId}: ${error.message || String(error)}`);
    });

    return video;
  }
}

module.exports = MixerDomAdapter;
