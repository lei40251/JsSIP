/**
 * OutputStreamManager — 混流器输出流管理
 *
 * 负责混流器输出流的生命周期管理：
 *   - canvas.captureStream() 获取视频流
 *   - 音频轨注入到已返回的混合流（延迟添加音频场景）
 *   - 停止时清理所有捕获的流轨道
 *
 * @module OutputStreamManager
 */
class OutputStreamManager
{
  /**
   * @param {Object} options
   * @param {HTMLCanvasElement} options.canvas - 输出 canvas 元素
   * @param {Object} options.config - 混流配置
   * @param {Object} options.logger - 日志记录器
   */
  constructor(options)
  {
    options = options || {};

    this._canvas = options.canvas;
    this._config = options.config;
    this._logger = options.logger;

    /** @type {MediaStream|null} 通过 getMixedStream() 返回的完整混合流 */
    this._mixedStream = null;

    /** @type {Array<MediaStream>} 所有通过 captureStream 创建的流的列表（用于停止时清理） */
    this._capturedStreams = [];

    /** @type {MediaStream|null} 当前活跃的 captureStream 引用 */
    this._capturedStream = null;

    /** @type {MediaStream|null} 输出视频流（仅含视频轨） */
    this._videoStream = null;

    if (this._logger)
    {
      this._logger.debug('OutputStreamManager constructed');
    }
  }

  /**
   * 检测当前视频流是否仍有 live（活跃）状态的视频轨。
   *
   * @returns {boolean} true=视频流存在且至少有一条 live 视频轨
   */
  hasLiveVideoStream()
  {
    return Boolean(
      this._videoStream &&
      this._videoStream.getVideoTracks().some((track) => track.readyState === 'live')
    );
  }

  /**
   * 获取视频输出流。
   *
   * 首次调用时先绘制一帧（确保 canvas 有内容），然后执行
   * canvas.captureStream() 获取原始流，将其视频轨添加到新的 MediaStream 返回。
   *
   * @param {Function} drawFirstFrame - 绘制首帧的回调
   * @returns {MediaStream} 仅包含视频轨的输出流
   */
  getVideoStream(drawFirstFrame)
  {
    if (this.hasLiveVideoStream())
    {
      if (this._logger)
      {
        this._logger.debug('Reusing existing live video stream');
      }

      return this._videoStream;
    }

    drawFirstFrame();

    const videoStream = new MediaStream();
    const capturedStream = this._config.fps ? this._canvas.captureStream(this._config.fps) : this._canvas.captureStream();

    capturedStream.getVideoTracks().forEach((track) =>
    {
      if (this._logger)
      {
        this._logger.debug('track: ', track.id, track.enabled, track.readyState);
      }

      videoStream.addTrack(track);
    });

    this._canvas.stream = capturedStream;
    this._capturedStream = capturedStream;
    this._videoStream = videoStream;
    this._capturedStreams.push(capturedStream);

    if (this._logger)
    {
      this._logger.debug(`Created new video stream: tracks=${videoStream.getVideoTracks().length}`);
    }

    return this._videoStream;
  }

  /**
   * 保存 mixedStream 引用，供后续 _ensureMixedStreamAudioTrack() 补充音频轨。
   *
   * @param {MediaStream} stream - 混合流（视频流，可能后续添加音频）
   */
  setMixedStream(stream)
  {
    this._mixedStream = stream;

    if (this._logger)
    {
      const trackCount = stream && stream.getTracks ? stream.getTracks().length : 0;

      this._logger.debug(`Mixed stream set: tracks=${trackCount}`);
    }
  }

  /**
   * 将音频流中的音轨去重地添加到目标流中。
   *
   * @param {MediaStream} targetStream - 目标流（一般是 video stream）
   * @param {MediaStream} audioStream - 音频流（audio destination stream）
   */
  addAudioTracksToStream(targetStream, audioStream)
  {
    if (!targetStream || !audioStream)
    {
      return;
    }

    audioStream.getAudioTracks().forEach((track) =>
    {
      if (!targetStream.getAudioTracks().some((item) => item.id === track.id))
      {
        targetStream.addTrack(track);

        if (this._logger)
        {
          this._logger.debug(`Audio track added to target stream: ${track.id}`);
        }
      }
    });
  }

  /**
   * 将音频轨补充到已返回的 mixed stream 中。
   *
   * 场景：getMixedStream() 已返回 mixed stream 给调用方时还没有音频源，
   * 后续通过 appendStream() 添加了有音频的源，此方法负责把新出现的音频轨
   * 注入到已返回的流。
   *
   * @param {MediaStream} audioStream - 音频流
   */
  ensureMixedStreamAudioTrack(audioStream)
  {
    if (!this._mixedStream || !audioStream || this._mixedStream.getAudioTracks().length > 0)
    {
      return;
    }

    audioStream.getAudioTracks().forEach((track) =>
    {
      this._mixedStream.addTrack(track);

      if (this._logger)
      {
        this._logger.debug(`Mixed stream audio track injected: ${track.id}`);
      }
    });
  }

  /**
   * 停止所有输出流，释放资源。
   *
   * 清理步骤：
   *   1. 清空内部引用
   *   2. 停止所有 captureStream 的 tracks
   *   3. 清空 capturedStreams 列表
   *   4. 清除 canvas 上的 stream 引用
   */
  stop()
  {
    if (this._logger)
    {
      this._logger.debug(`Stopping output streams: captured=${this._capturedStreams.length}`);
    }

    this._mixedStream = null;
    this._videoStream = null;
    this._capturedStream = null;

    this._capturedStreams.forEach((stream) =>
    {
      stream.getTracks().forEach((track) =>
      {
        track.stop();
      });
    });

    this._capturedStreams = [];
    this._canvas.stream = null;

    if (this._logger)
    {
      this._logger.debug('Output streams stopped');
    }
  }

  get mixedStream()
  {
    return this._mixedStream;
  }

  get capturedStreams()
  {
    return this._capturedStreams;
  }

  get capturedStream()
  {
    return this._capturedStream;
  }

  get videoStream()
  {
    return this._videoStream;
  }
}

module.exports = OutputStreamManager;
