/**
 * OutputStreamManager — 混流器输出流管理
 *
 * 负责混流器输出流的生命周期管理：
 *   - Insertable Streams 输出路径（VideoTrackGenerator/MediaStreamTrackGenerator）
 *   - canvas.captureStream() 回退路径
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
   * @param {Object} options.domAdapter - DOM 适配器
   * @param {Object} options.logger - 日志记录器
   */
  constructor(options)
  {
    options = options || {};

    this._canvas = options.canvas;
    this._config = options.config;
    this._domAdapter = options.domAdapter;
    this._logger = options.logger;

    /** @type {MediaStream|null} 通过 getMixedStream() 返回的完整混合流 */
    this._mixedStream = null;

    /** @type {Array<MediaStream>} 所有通过 captureStream 创建的流的列表（用于停止时清理） */
    this._capturedStreams = [];

    /** @type {MediaStream|null} 当前活跃的 captureStream 引用 */
    this._capturedStream = null;

    /** @type {MediaStream|null} 输出视频流（仅含视频轨） */
    this._videoStream = null;

    /** @type {Object} Insertable 能力探测结果 */
    this._insertableSupport = OutputStreamManager.detectInsertableStreams();
    this._insertableEnabledByConfig = Boolean(this._config && this._config.enableInsertable);

    /** @type {boolean} 当前是否使用 Insertable 路径 */
    this._insertableActive = false;

    /** @type {WritableStreamDefaultWriter<VideoFrame>|null} Insertable writer */
    this._writer = null;

    /** @type {Object|null} VideoTrackGenerator / MediaStreamTrackGenerator 实例 */
    this._generator = null;

    /** @type {MediaStreamTrack|null} Insertable 输出 track */
    this._generatorTrack = null;

    /** @type {boolean} Insertable 写入进行中标记 */
    this._pendingWrite = false;

    /** @type {Object|null} latest-frame-wins 队列里保留的最新帧上下文 */
    this._latestPendingFrame = null;

    /** @type {number} 上一次输出时间戳（微秒） */
    this._lastTimestampUs = 0;

    /** @type {number} 连续写帧失败计数 */
    this._continuousWriteFailures = 0;

    /** @type {number} 连续失败阈值，超过后停止 Insertable 写入 */
    this._maxContinuousWriteFailures = 5;

    /** @type {CanvasCaptureMediaStreamTrack|null} captureStream 输出 video track */
    this._capturedVideoTrack = null;

    /** @type {boolean} 是否启用 captureStream(0)+requestFrame 手动出帧模式 */
    this._manualCaptureFrameControl = false;

    /** @type {HTMLVideoElement|null} captureStream 输出保活 sink */
    this._activeCaptureSinkVideo = null;

    if (this._logger)
    {
      this._logger.debug(
        `OutputStreamManager constructed: insertableSupported=${this._insertableSupport.supported} ` +
        `enabledByConfig=${this._insertableEnabledByConfig} ` +
        `generator=${this._insertableSupport.generatorType || 'none'} reason=${this._insertableSupport.reason || ''}`
      );
    }
  }

  static _getGlobalObject()
  {
    if (typeof window !== 'undefined')
    {
      return window;
    }

    if (typeof global !== 'undefined')
    {
      return global;
    }

    return {};
  }

  /**
   * 探测 Insertable Streams 能力。
   *
   * 优先 VideoTrackGenerator（标准命名），
   * 兼容 MediaStreamTrackGenerator（旧命名/历史实现）。
   *
   * @returns {Object}
   */
  static detectInsertableStreams()
  {
    const runtime = OutputStreamManager._getGlobalObject();
    const VideoTrackGeneratorConstructor = runtime.VideoTrackGenerator;
    const MediaStreamTrackGeneratorConstructor = runtime.MediaStreamTrackGenerator;
    const VideoFrameConstructor = runtime.VideoFrame;
    const GeneratorConstructor = VideoTrackGeneratorConstructor || MediaStreamTrackGeneratorConstructor;

    if (!GeneratorConstructor)
    {
      return {
        supported     : false,
        reason        : 'TrackGenerator is unavailable',
        optimizations : [],
        generatorType : ''
      };
    }

    if (!VideoFrameConstructor)
    {
      return {
        supported     : false,
        reason        : 'VideoFrame is unavailable',
        optimizations : [],
        generatorType : ''
      };
    }

    let generatorType = 'media-stream-track-generator';

    if (VideoTrackGeneratorConstructor)
    {
      generatorType = 'video-track-generator';
    }

    const optimizations = [];

    if (typeof runtime.createImageBitmap === 'function')
    {
      optimizations.push('createImageBitmap');
    }

    return {
      supported     : true,
      reason        : '',
      optimizations : optimizations,
      generatorType : generatorType
    };
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
   * 首次调用时先绘制一帧（确保 canvas 有内容），随后优先尝试
   * Insertable Streams 输出；能力不足或初始化失败时再回退到 canvas.captureStream()。
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
    const insertableStream = this._createInsertableVideoStream();

    if (insertableStream)
    {
      this._videoStream = insertableStream;
      this._capturedStream = null;
      this._canvas.stream = null;
      this._insertableActive = true;

      // 首帧触发：在已渲染过 drawFirstFrame 后立刻尝试写入当前画面。
      this.onFramePresented({
        canvas    : this._canvas,
        timestamp : typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(),
        source    : 'bootstrap'
      });

      if (this._logger)
      {
        this._logger.debug(`Created insertable video stream: tracks=${insertableStream.getVideoTracks().length}`);
      }

      return this._videoStream;
    }

    return this._createCaptureStreamVideo();
  }

  _createCaptureStreamVideo()
  {
    const videoStream = new MediaStream();
    const capturedStream = this._createPreferredCaptureStream();

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
    this._insertableActive = false;
    this._configureCaptureFrameControl(capturedStream);
    this._ensureActiveCaptureSink(capturedStream);

    if (this._manualCaptureFrameControl)
    {
      this._requestCaptureFrame();
    }

    if (this._logger)
    {
      this._logger.debug(
        `Created captureStream video stream: tracks=${videoStream.getVideoTracks().length} ` +
        `manualFrameControl=${this._manualCaptureFrameControl}`
      );
    }

    return this._videoStream;
  }

  _createPreferredCaptureStream()
  {
    if (this._config.manualCaptureFrameControl !== false)
    {
      let manualStream = null;

      try
      {
        manualStream = this._canvas.captureStream(0);

        if (!this._hasRequestFrame(manualStream))
        {
          manualStream.getTracks().forEach((track) =>
          {
            if (track && track.stop)
            {
              track.stop();
            }
          });
          manualStream = null;
        }
      }
      catch (error)
      {
        manualStream = null;
      }

      if (manualStream)
      {
        return manualStream;
      }
    }

    let capturedStream = null;

    try
    {
      capturedStream = this._config.fps ? this._canvas.captureStream(this._config.fps) : this._canvas.captureStream();
    }
    catch (error)
    {
      capturedStream = null;
    }

    if (capturedStream)
    {
      return capturedStream;
    }

    return this._canvas.captureStream();
  }

  _hasRequestFrame(capturedStream)
  {
    if (!capturedStream || !capturedStream.getVideoTracks)
    {
      return false;
    }

    const videoTrack = capturedStream.getVideoTracks()[0];

    return Boolean(videoTrack && typeof videoTrack.requestFrame === 'function');
  }

  _configureCaptureFrameControl(capturedStream)
  {
    this._capturedVideoTrack = null;
    this._manualCaptureFrameControl = false;

    if (!capturedStream || !capturedStream.getVideoTracks)
    {
      return;
    }

    const videoTrack = capturedStream.getVideoTracks()[0];

    this._capturedVideoTrack = videoTrack || null;
    this._manualCaptureFrameControl = Boolean(
      this._config.manualCaptureFrameControl !== false &&
      videoTrack &&
      typeof videoTrack.requestFrame === 'function'
    );
  }

  _ensureActiveCaptureSink(capturedStream)
  {
    this._teardownActiveCaptureSink();

    if (!capturedStream || !this._domAdapter || !this._domAdapter.createOutputSinkVideoElement)
    {
      return;
    }

    this._activeCaptureSinkVideo = this._domAdapter.createOutputSinkVideoElement(capturedStream);

    if (this._logger)
    {
      const streamId = capturedStream.id || 'unknown';

      this._logger.debug(`Active capture sink attached: stream=${streamId}`);
    }
  }

  _teardownActiveCaptureSink()
  {
    if (!this._activeCaptureSinkVideo)
    {
      return;
    }

    if (this._domAdapter && this._domAdapter.disposeVideoElement)
    {
      this._domAdapter.disposeVideoElement(this._activeCaptureSinkVideo);
    }

    this._activeCaptureSinkVideo = null;
  }

  _requestCaptureFrame()
  {
    if (!this._manualCaptureFrameControl || !this._capturedVideoTrack || !this._capturedVideoTrack.requestFrame)
    {
      return;
    }

    if (this._capturedVideoTrack.readyState && this._capturedVideoTrack.readyState !== 'live')
    {
      return;
    }

    try
    {
      this._capturedVideoTrack.requestFrame();
    }
    catch (error)
    {
      this._manualCaptureFrameControl = false;

      if (this._logger)
      {
        this._logger.warn(`captureStream requestFrame failed, fallback to auto capture timing: ${error.message || String(error)}`);
      }
    }
  }

  _createInsertableVideoStream()
  {
    if (!this._insertableEnabledByConfig)
    {
      if (this._logger)
      {
        this._logger.debug('Insertable output not enabled by config, fallback to captureStream');
      }

      return null;
    }

    if (!this._insertableSupport.supported)
    {
      return null;
    }

    try
    {
      const generator = this._createTrackGenerator();
      const track = this._resolveGeneratorTrack(generator);

      if (!track)
      {
        throw new Error('generator track is unavailable');
      }

      if (!generator.writable || !generator.writable.getWriter)
      {
        throw new Error('generator writable is unavailable');
      }

      const writer = generator.writable.getWriter();

      this._generator = generator;
      this._generatorTrack = track;
      this._writer = writer;
      this._pendingWrite = false;
      this._latestPendingFrame = null;
      this._lastTimestampUs = 0;
      this._continuousWriteFailures = 0;

      return new MediaStream([ track ]);
    }
    catch (error)
    {
      if (this._logger)
      {
        this._logger.warn(`Insertable output init failed, fallback to captureStream: ${error.message || String(error)}`);
      }

      this._teardownInsertableState(false);

      return null;
    }
  }

  _createTrackGenerator()
  {
    const runtime = OutputStreamManager._getGlobalObject();
    const GeneratorConstructor = runtime.VideoTrackGenerator || runtime.MediaStreamTrackGenerator;

    if (!GeneratorConstructor)
    {
      throw new Error('TrackGenerator constructor is unavailable');
    }

    if (runtime.VideoTrackGenerator)
    {
      return new GeneratorConstructor();
    }

    return new GeneratorConstructor({ kind: 'video' });
  }

  _resolveGeneratorTrack(generator)
  {
    if (!generator)
    {
      return null;
    }

    if (generator.track)
    {
      return generator.track;
    }

    if (typeof generator.kind === 'string' && generator.kind === 'video')
    {
      return generator;
    }

    return null;
  }

  /**
   * 渲染帧已真正输出到主画布后的回调。
   *
   * @param {Object} frameCtx - { canvas, timestamp, source }
   */
  onFramePresented(frameCtx)
  {
    if (this._manualCaptureFrameControl)
    {
      this._requestCaptureFrame();
    }

    if (!this._insertableActive || !this._writer || !this._generatorTrack)
    {
      return;
    }

    if (this._generatorTrack.readyState && this._generatorTrack.readyState !== 'live')
    {
      return;
    }

    if (this._pendingWrite)
    {
      const replacedFrame = this._latestPendingFrame;

      this._latestPendingFrame = frameCtx;

      if (replacedFrame)
      {
        this._closePresentedFrameSource(replacedFrame.frameSource);
      }

      return;
    }

    this._pendingWrite = true;
    this._writePresentedFrame(frameCtx)
      .then(() =>
      {
        this._pendingWrite = false;
        this._flushLatestPendingFrame();
      })
      .catch((error) =>
      {
        this._pendingWrite = false;
        this._handleInsertableWriteError(error);
        this._flushLatestPendingFrame();
      });
  }

  _flushLatestPendingFrame()
  {
    if (!this._insertableActive || !this._latestPendingFrame)
    {
      return;
    }

    const nextFrame = this._latestPendingFrame;

    this._latestPendingFrame = null;
    this.onFramePresented(nextFrame);
  }

  _normalizeTimestampUs(timestamp)
  {
    let nextTimestampUs = Math.round((timestamp || 0) * 1000);

    if (!nextTimestampUs || !Number.isFinite(nextTimestampUs))
    {
      nextTimestampUs = this._lastTimestampUs + 1;
    }

    if (nextTimestampUs <= this._lastTimestampUs)
    {
      nextTimestampUs = this._lastTimestampUs + 1;
    }

    this._lastTimestampUs = nextTimestampUs;

    return nextTimestampUs;
  }

  async _writePresentedFrame(frameCtx)
  {
    if (!frameCtx || (!frameCtx.canvas && !frameCtx.frameSource) || !this._writer)
    {
      return;
    }

    const videoFrame = await this._createVideoFrameForPresentedFrame(frameCtx);

    if (!videoFrame)
    {
      return;
    }

    try
    {
      await this._writer.write(videoFrame);
      this._continuousWriteFailures = 0;
    }
    finally
    {
      if (videoFrame.close)
      {
        videoFrame.close();
      }
    }
  }

  async _createVideoFrameForPresentedFrame(frameCtx)
  {
    const frameSource = frameCtx && frameCtx.frameSource;
    const frameSourceConsumed = Boolean(frameCtx && frameCtx.frameSourceConsumed === true);

    if (frameSource)
    {
      return this._createVideoFrameFromSource(frameSource, frameCtx.timestamp, frameSourceConsumed);
    }

    return this._createVideoFrameFromSource(frameCtx && frameCtx.canvas, frameCtx && frameCtx.timestamp, false);
  }

  async _createVideoFrameFromSource(source, timestamp, sourceConsumed)
  {
    const runtime = OutputStreamManager._getGlobalObject();
    const VideoFrameConstructor = runtime.VideoFrame;

    if (!VideoFrameConstructor)
    {
      throw new Error('VideoFrame constructor is unavailable');
    }

    const timestampUs = this._normalizeTimestampUs(timestamp);

    if (!source)
    {
      return null;
    }

    if (sourceConsumed)
    {
      return new VideoFrameConstructor(source, { timestamp: timestampUs });
    }

    if (typeof runtime.createImageBitmap === 'function')
    {
      let bitmap = null;

      try
      {
        bitmap = await runtime.createImageBitmap(source);

        return new VideoFrameConstructor(bitmap, { timestamp: timestampUs });
      }
      finally
      {
        if (bitmap && bitmap.close)
        {
          bitmap.close();
        }
      }
    }

    return new VideoFrameConstructor(source, { timestamp: timestampUs });
  }

  _handleInsertableWriteError(error)
  {
    this._continuousWriteFailures += 1;

    if (this._logger)
    {
      this._logger.warn(
        `Insertable frame write failed: count=${this._continuousWriteFailures} ` +
        `reason=${error && error.message ? error.message : String(error)}`
      );
    }

    if (this._continuousWriteFailures >= this._maxContinuousWriteFailures)
    {
      this._insertableActive = false;

      if (this._logger)
      {
        this._logger.warn('Insertable frame writing disabled due to repeated failures');
      }
    }
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
   *   2. 断开 Insertable writer / generator track
   *   3. 停止所有 captureStream 的 tracks
   *   4. 清空 capturedStreams 列表
   *   5. 清除 canvas 上的 stream 引用和保活 sink
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
    this._capturedVideoTrack = null;
    this._manualCaptureFrameControl = false;
    this._insertableActive = false;
    this._teardownActiveCaptureSink();

    this._capturedStreams.forEach((stream) =>
    {
      stream.getTracks().forEach((track) =>
      {
        track.stop();
      });
    });

    this._capturedStreams = [];
    this._canvas.stream = null;
    this._teardownInsertableState(true);

    if (this._logger)
    {
      this._logger.debug('Output streams stopped');
    }
  }

  /**
   * 释放 Insertable 输出路径的运行时状态。
   *
   * @param {boolean} stopTrack - 是否同时停止 generator track
   */
  _teardownInsertableState(stopTrack)
  {
    const pendingFrame = this._latestPendingFrame;

    this._latestPendingFrame = null;
    this._pendingWrite = false;
    this._lastTimestampUs = 0;
    this._continuousWriteFailures = 0;

    if (pendingFrame)
    {
      this._closePresentedFrameSource(pendingFrame.frameSource);
    }

    if (this._writer)
    {
      try
      {
        this._writer.close().catch(() => {});
      }
      catch (error)
      {}

      try
      {
        this._writer.releaseLock();
      }
      catch (error)
      {}
    }

    if (stopTrack && this._generatorTrack && this._generatorTrack.stop)
    {
      try
      {
        this._generatorTrack.stop();
      }
      catch (error)
      {}
    }

    this._writer = null;
    this._generator = null;
    this._generatorTrack = null;
  }

  /**
   * 关闭当前已消费完成的 VideoFrame / ImageBitmap。
   *
   * @param {*} frameSource - 可能带有 close() 的帧对象
   */
  _closePresentedFrameSource(frameSource)
  {
    if (frameSource && typeof frameSource.close === 'function')
    {
      try
      {
        frameSource.close();
      }
      catch (error)
      {}
    }
  }

  /**
   * 获取输出流路径信息（Insertable / captureStream）。
   *
   * @returns {Object} 输出路径状态快照
   */
  getOutputRouteInfo()
  {
    return {
      outputMode                  : this._insertableActive ? 'insertable' : 'capture-stream',
      captureFrameControlMode     : this._manualCaptureFrameControl ? 'manual-request-frame' : 'auto-capture-fps',
      insertableActive            : Boolean(this._insertableActive),
      insertableEnabledByConfig   : Boolean(this._insertableEnabledByConfig),
      insertableSupported         : Boolean(this._insertableSupport && this._insertableSupport.supported),
      insertableGeneratorType     : (this._insertableSupport && this._insertableSupport.generatorType) || '',
      insertableSupportReason     : (this._insertableSupport && this._insertableSupport.reason) || '',
      insertableWriteFailures     : this._continuousWriteFailures || 0,
      insertableHasGeneratorTrack : Boolean(this._generatorTrack),
      outputHasCapturedStream     : Boolean(this._capturedStream),
      activeCaptureSinkAttached   : Boolean(this._activeCaptureSinkVideo)
    };
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
