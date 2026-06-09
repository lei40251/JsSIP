/**
 * ComposerDomAdapter — 合成器 DOM 元素创建适配器
 *
 * 负责创建和管理混流器内部使用的 DOM 元素：
 *   - 离屏 canvas：用于合成视频帧
 *   - 隐藏 video 元素：用于播放每个 MediaStream
 *
 * 将这些 DOM 操作集中在此，方便测试时 mock 和后续迁移到 WebWorker 环境。
 *
 * @module ComposerDomAdapter
 */
class ComposerDomAdapter
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

    if (this._logger)
    {
      this._logger.debug('ComposerDomAdapter constructed');
    }
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

    if (this._logger)
    {
      this._logger.debug('Hidden composer canvas created');
    }

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
    let resized = false;

    // canvas width/height 设置时会清空画布，只在尺寸变化时才写
    if (canvas.width !== width)
    {
      canvas.width = width;
      resized = true;
    }

    if (canvas.height !== height)
    {
      canvas.height = height;
      resized = true;
    }

    if (resized && this._logger)
    {
      this._logger.debug(`Canvas prepared: ${width}x${height}`);
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
    if (this._logger)
    {
      const stream = video.srcObject;
      const streamId = stream && stream.id ? stream.id : 'unknown';

      this._logger.debug(`Video element created for stream ${streamId}`);
    }
    const capturedStreamId = (video.srcObject && video.srcObject.id) || 'unknown';

    video.play().catch((error) =>
    {
      // 确认 video 是否仍关联着该 stream。如果 stream 已被清理（pause + srcObject = null），
      // 说明该 video 在被 play() resolve 之前已被上层逻辑主动移除，此为良性竞态，不必报 error。
      const isOrphaned = !video.srcObject;

      if (isOrphaned)
      {
        return;
      }

      this._logger.error(`video play error for stream ${capturedStreamId}: ${error.message || String(error)}`);
    });

    return video;
  }

  /**
   * 为 captureStream 输出创建隐藏的消费 video。
   * 用于规避部分 Chromium 在未被本地 UI 消费时对 captureStream 降质/丢帧。
   *
   * @param {MediaStream} mediaStream - 要持续播放的 captureStream 输出
   * @returns {HTMLVideoElement} 隐藏的消费 video 元素
   */
  createOutputSinkVideoElement(mediaStream)
  {
    const video = this.createVideoElement(mediaStream);

    if (this._logger)
    {
      const streamId = mediaStream && mediaStream.id ? mediaStream.id : 'unknown';

      this._logger.debug(`Output sink video created for captureStream ${streamId}`);
    }

    return video;
  }

  /**
   * 清理隐藏的 video 元素。
   *
   * @param {HTMLVideoElement|null} video - 要清理的隐藏 video
   */
  disposeVideoElement(video)
  {
    if (!video)
    {
      return;
    }

    try
    {
      if (typeof video.pause === 'function')
      {
        video.pause();
      }
    }
    catch (error)
    {}

    try
    {
      video.srcObject = null;
    }
    catch (error)
    {}

    try
    {
      if (typeof video.remove === 'function')
      {
        video.remove();
      }
    }
    catch (error)
    {}
  }
}

module.exports = ComposerDomAdapter;
