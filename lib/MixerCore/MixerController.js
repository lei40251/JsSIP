const Logger = require('../Logger');
const SourceRegistry = require('./SourceRegistry');
const LayoutEngine = require('./LayoutEngine');
const AudioMixer = require('./AudioMixer');
const OutputStreamManager = require('./OutputStreamManager');
const RenderLoop = require('./RenderLoop');
const MixerConfig = require('./MixerConfig');
const MixerDomAdapter = require('./MixerDomAdapter');
const WatermarkManager = require('./WatermarkManager');
const logger = new Logger('MediaStreamMixer');
let lastRenderInfoLogSignature = '';

/**
 * _audioInfo 的默认值，子模块未初始化或不可用时使用。
 * @type {Object}
 */
const DEFAULT_AUDIO_INFO = Object.freeze({
  requested        : false,
  status           : 'not-requested',
  contextState     : null,
  sourceCount      : 0,
  liveSourceCount  : 0,
  connectedSources : 0,
  outputTracks     : 0,
  reason           : '',
  lastError        : ''
});

/**
 * MediaStreamMixer — 多路音视频混流器
 *
 * 功能：
 *   - 将多个 MediaStream / HTMLVideoElement(srcObject=MediaStream) 合并为一个 MediaStream
 *   - 视频：按浏览器能力使用 Worker WebGL2 / 主线程 WebGL2 / Worker Canvas2D / 主线程 Canvas2D 绘制
 *   - 音频：用 WebAudio API，每路独立 GainNode 控制音量，汇总到 MediaStreamAudioDestinationNode
 *
 * 布局方式：按 slot 和输出画布比例自动计算网格，画布尺寸由配置指定（默认 1280x720），
 * 不随源数量动态变化。
 *
 * 使用示例：
 *   const mixer = new MediaStreamMixer([localStream, remoteStream], { width: 1280, height: 720 });
 *   const output = await mixer.getMixedStream();
 *   // peerConnection.addTrack(output.getVideoTracks()[0], output);
 */
module.exports = class MediaStreamMixer
{
  // =========================================================================
  //  构造与初始化
  // =========================================================================

  /**
   * @param {Array<MediaStream|HTMLMediaElement>|MediaStream|HTMLMediaElement} videos
   *   需要混流的输入源。为了兼容旧版 SDK，仍然支持只传数组；新版也允许传单个源。
   *   每个元素可以是：
   *     - MediaStream：原生 WebRTC 媒体流
   *     - HTMLVideoElement：外部 video 元素，需使用 srcObject=MediaStream（mixer 不接管生命周期）
   *     - { mediaStream: MediaStream }：SDK 内部包装对象
   * @param {Object} [options]
   *   混流配置。
   * @param {number} [options.width=1280]  - 输出视频宽度
   * @param {number} [options.height=720]  - 输出视频高度
   * @param {number} [options.fps]         - 输出帧率（不传则浏览器自动选择）
   * @param {string} [options.backgroundColor='#000'] - 画布背景色
   * @param {number} [options.audioGain=0.8] - 全局默认音量增益
   * @param {string} [options.renderMode='auto']
   *   渲染后端：'auto' | 'worker-webgl2' | 'main-webgl2' | 'worker-2d' | 'main-2d'
   * @param {string} [options.workerUrl]
   *   可选外部 Worker 脚本地址；不传时默认使用 Blob Worker，部署更简单。
   * @param {boolean} [options.dropFrameWhenBusy=true]
   *   Worker 尚未渲染完上一帧时是否丢弃当前帧，避免排队导致延迟不断累积。
   * @param {number} [options.maxFrameQueue=1]
   *   预留队列配置。当前实现默认只保留 1 帧，后续可扩展为更长队列。
   */
  constructor(videos = [], options = {})
  {
    // -- 参数安全守卫（防止外部传 null/undefined 导致后续崩溃） --
    options = options || {};
    videos = videos || [];

    // 统一为数组，方便后续统一遍历
    if (!(videos instanceof Array))
    {
      videos = [ videos ];
    }

    logger.debug(`constructor: ${videos.length}`);

    // -----------------------------------------------------------------------
    // 源管理
    // -----------------------------------------------------------------------

    this._sourceRegistry = null;

    const config = MixerConfig.create(options);

    /** @type {boolean} 实例销毁标记；stop() 后不再允许重新取流或追加源 */
    this._destroyed = false;

    /** @type {number|null} requestAnimationFrame 返回的 ID，用于 cancel */
    this._renderLoop = null;

    /** @type {number} 连续渲染失败次数，用于诊断渲染后端异常 */
    // (delegated to RenderLoop via prototype getter)

    // -----------------------------------------------------------------------
    // WebAudio 相关
    // -----------------------------------------------------------------------

    this._audioMixer = null;
    this._audioRefreshPromise = null;
    this._audioRefreshPending = false;

    this._outputStreamManager = null;
    this._domAdapter = null;
    this._watermarkManager = null;

    // -----------------------------------------------------------------------
    // 混流配置
    // -----------------------------------------------------------------------

    /**
     * @type {Object}
     * @property {number|null} width           - 输出宽度（legacy=null 动态，grid=1280）
     * @property {number|null} height          - 输出高度（legacy=null 动态，grid=720）
     * @property {number|null} fps             - 帧率（null=浏览器默认）
     * @property {string}      backgroundColor - 画布底色
     * @property {number}      audioGain       - 全局默认音量
     * @property {string}      renderMode      - 渲染后端选择
     */
    this._config = config;
    this._domAdapter = new MixerDomAdapter({
      config : this._config,
      logger : logger
    });
    this._watermarkManager = new WatermarkManager({
      logger : logger
    });

    // -----------------------------------------------------------------------
    // 渲染画布
    // -----------------------------------------------------------------------

    /** @type {HTMLCanvasElement} 离屏 canvas，所有视频帧合成到这里 */
    this._canvas = this._domAdapter.createCanvas();

    /** @type {number|null} 上次渲染器 resize 的宽高缓存，仅尺寸变化时打日志 */
    this._lastRenderWidth = null;
    this._lastRenderHeight = null;

    // -----------------------------------------------------------------------
    // 源注册表（SourceRegistry）—— 统一管理所有视频/音频源的生命周期。
    //
    // 职责：
    //   1. 维护源列表，处理增删查改
    //   2. 创建对应的 <video> 元素（通过 createVideoElement）
    //   3. 管理音频增益归一化（normalizeGain）
    //   4. 在源移除时触发回调链：断音频 → 清渲染帧 → 清画布
    //
    // 回调链说明：
    //   onBeforeRemove → 先断音频（_disconnectAudio），避免音频残留
    //   onAfterRemove  → 如果渲染器已创建则通知渲染循环移除该源；
    //                    如果全部源已清空且仍在输出流中，则清除画布（黑帧）
    //   onAfterRemove 不直接访问 this._sourceRegistry，以减少时序耦合
    // -----------------------------------------------------------------------
    
    this._sourceRegistry = new SourceRegistry({
      logger             : logger,
      getDefaultGain     : () => this._config.audioGain,
      normalizeGain      : this._normalizeGain.bind(this),
      createVideoElement : this._mediaStreamToVideoElement.bind(this),
      onBeforeRemove     : (source) => this._disconnectAudio(source),
      onAfterRemove      : (source) =>
      {
        if (this._renderer)
        {
          this._renderLoop.removeSource(source.id);
        }

        if (!this._isStopDrawingFrames && this._sources.length === 0 && this._videoStream)
        {
          this._drawVideosToCanvas(undefined, true);
        }
      }
    });

    // -----------------------------------------------------------------------
    // 输出流管理器（OutputStreamManager）—— 将 canvas 内容导出为 MediaStream。
    //
    // 职责：
    //   1. 通过 canvas.captureStream(fps) 获取输出视频轨道
    //   2. 管理输出流的 fps、分辨率等参数（取自 this._config）
    //   3. 提供 getVideoStream() / getMixedStream() 入口
    //
    // 依赖：需要 canvas 已创建、config 已就绪
    // -----------------------------------------------------------------------

    this._outputStreamManager = new OutputStreamManager({
      canvas : this._canvas,
      config : this._config,
      logger : logger
    });

    // -----------------------------------------------------------------------
    // 渲染循环（RenderLoop）—— 驱动每一帧的合成绘制。
    //
    // 职责：
    //   1. 通过 requestAnimationFrame 驱动帧循环
    //   2. 每次 tick 调用 createRenderPayload 收集源快照
    //   3. 将快照交给 renderer 绘制到 canvas
    //   4. 管理 fps 节流、暂停/恢复、状态上报
    //   5. 同步外部音频进度（syncExternalSourceAudio）
    //
    // 注意：renderer（BaseRenderer 子类）是延迟创建的，
    //       RenderLoop 内部通过 tryAcquireRenderer() 按需初始
    // -----------------------------------------------------------------------

    this._renderLoop = new RenderLoop({
      canvas                  : this._canvas,
      config                  : this._config,
      logger                  : logger,
      getSources              : () => this._sources,
      createRenderPayload     : () => this._createRenderPayload(),
      syncExternalSourceAudio : () => this._syncExternalSourceAudio(),
      onStateChange           : () => {},
      onFramePresented        : (frameCtx) => this._outputStreamManager.onFramePresented(frameCtx)
    });

    // -----------------------------------------------------------------------
    // 音频混音器（AudioMixer）—— 将所有源的音频轨道混合为一路输出。
    //
    // 职责：
    //   1. 通过 WebAudio API（AudioContext, GainNode）创建混音管线
    //   2. 监听 sourceRegistry 的增删事件，自动接入/断开源音频
    //   3. 将混音结果以 MediaStream 形式回传给控制层
    //   4. 检测并规避已销毁（_destroyed）后的操作
    //
    // 回调：
    //   onAudioTrackAvailable → 将混音后的音频轨道挂到输出流上
    //   getDestroyed          → 防销毁后误操作
    // -----------------------------------------------------------------------

    this._audioMixer = new AudioMixer({
      logger                : logger,
      sourceRegistry        : this._sourceRegistry,
      getDestroyed          : () => this._destroyed,
      onAudioTrackAvailable : (audioStream) => this._ensureMixedStreamAudioTrack(audioStream)
    });

    // -----------------------------------------------------------------------
    // 布局引擎（LayoutEngine）—— 计算每个源在 canvas 上的位置和尺寸。
    //
    // 职责：
    //   1. 根据 renderMode（legacy/grid）计算布局矩阵
    //   2. 在源增删或画布尺寸变化时重新布局
    //   3. 更新每个源的 _displayRect（供 renderer 绘制时使用）
    //   4. 触发 canvas 尺寸调整（prepareCanvas → resizeRenderer）
    //
    // 注意：LayoutEngine 不直接操作渲染管线，只计算坐标；
    //       实际绘制由 renderer 根据 _displayRect 执行。
    //       这种分离使布局策略可热切换（如从 grid 切为 custom）
    // -----------------------------------------------------------------------

    this._layoutEngine = new LayoutEngine({
      sourceRegistry       : this._sourceRegistry,
      canvas               : this._canvas,
      config               : this._config,
      logger               : logger,
      prepareCanvas        : this._prepareCanvas.bind(this),
      resizeRenderer       : this._resizeRenderer.bind(this),
      createWatermarkItems : (payload) => this._createWatermarkItems(payload)
    });

    this._prepareCanvas();
    this._watermarkManager.setWatermarks(this._config.watermarks)
      .then(() =>
      {
        logger.debug(`Initial watermarks ready: count=${this._config.watermarks ? this._config.watermarks.length : 0}`);

        if (!this._destroyed)
        {
          this._drawVideosToCanvas(undefined, true);
        }
      });

    // -- 将初始传入的源加入混流 --
    this.appendStream(videos);
  }

  // =========================================================================
  //  配置检测与参数归一化
  // =========================================================================

  /**
   * 归一化渲染模式。
   * 非法值统一回到 auto，避免外部拼写错误导致构造失败。
   *
   * @param {*} value - 用户传入的 renderMode
   * @param {string} fallback - 非法或未传时使用的模式
   * @returns {string} 合法渲染模式
   */
  _normalizeRenderMode(value, fallback)
  {
    return MixerConfig.normalizeRenderMode(value, fallback);
  }

  /**
   * 将输入值归一化为正整数。
   * 对外暴露的 width/height/fps 只接受正数；非法值回退默认值，不让 canvas 进入 0 尺寸。
   *
   * @param {*} value - 原始输入
   * @param {number|null} fallback - 非法值时使用的备选值
   * @returns {number|null} 归一化后的整数，或 fallback
   */
  _normalizePositiveInteger(value, fallback)
  {
    return MixerConfig.normalizePositiveInteger(value, fallback);
  }

  /**
   * 归一化 slot 值。
   * slot 只允许非负整数，数组批量添加时从起始 slot 递增（沿用演示页行为）。
   *
   * @param {*} value - 原始 slot 值
   * @param {number} index - 在数组中的索引，批量添加时累加到 slot 上
   * @returns {number|null} 归一化后的 slot，非法则返回 null
   */
  _normalizeSlot(value, index)
  {
    return MixerConfig.normalizeSlot(value, index);
  }

  /**
   * 归一化音量增益值。
   * 允许大于 1 做放大，但不允许负数。非法值使用全局默认音量。
   *
   * @param {*} value - 原始增益值
   * @param {number} fallback - 非法时的备选值
   * @returns {number} 归一化后的增益值（>= 0）
   */
  _normalizeGain(value, fallback)
  {
    return MixerConfig.normalizeGain(value, fallback);
  }

  /**
   * 统一 appendStream() 第二个参数的格式。
   * 支持两种调用方式：
   *   appendStream(stream, 3)            → 数字作为 slot
   *   appendStream(stream, { slot, gain }) → 对象解构
   *
   * @param {number|Object} optionsOrSlot - 原始参数
   * @param {number} index - 数组索引，用于批量添加时 slot 递增
   * @returns {Object} { slot: number|null, gain: number|undefined }
   */
  _normalizeSourceOptions(optionsOrSlot, index)
  {
    return MixerConfig.normalizeSourceOptions(optionsOrSlot, index, this._config.audioGain);
  }

  /**
   * 设置输出画布尺寸。
   */
  _prepareCanvas()
  {
    this._domAdapter.prepareCanvas(this._canvas);
  }

  /**
   * 确保渲染后端已经初始化。
   *
   * RendererFactory 是整个 Mixer 唯一允许初始化输出 canvas context 的地方。
   * 这样可以避免不同 renderer 抢占同一个 canvas context。
   *
   * @returns {BaseRenderer} 当前实际使用的渲染后端
   */
  _ensureRenderer()
  {
    logger.debug('Ensuring mixer renderer');
    const renderer = this._renderLoop.ensureRenderer();

    return renderer;
  }

  /**
   * 将当前输出画布尺寸同步给 renderer。
   *
   * @param {number} width - 输出宽度
   * @param {number} height - 输出高度
   */
  _resizeRenderer(width, height)
  {
    if (this._lastRenderWidth !== width || this._lastRenderHeight !== height)
    {
      logger.debug(`Resizing renderer: ${width}x${height}`);
      this._lastRenderWidth = width;
      this._lastRenderHeight = height;
    }

    this._renderLoop.resizeRenderer(width, height);
  }

  /**
   * Worker renderer 运行时失败后的最终主线程 Canvas2D 兜底。
   *
   * auto 模式的完整运行期降级链在 RenderLoop.fallbackRenderer() 中处理；
   * 此方法保留给显式要求直接落到 main-2d 的内部调用。
   *
   * @param {string} reason - fallback 原因
   * @returns {boolean} true=完成 fallback
   */
  _fallbackRendererToMain2D(reason)
  {
    logger.warn(`Fallback to main-2d requested: ${reason}`);
    const fallbacked = this._renderLoop.fallbackRendererToMain2D(reason);

    return fallbacked;
  }

  /**
   * 防止 stop() 后继续复用同一个实例。
   *
   * stop() 会释放 renderer、AudioContext、captureStream tracks 和内部源。
   * 继续复用同一个实例容易让调用方拿到已 ended 的输出轨，因此明确要求重新 new Mixer。
   *
   * @param {string} methodName - 当前公开方法名
   * @throws {Error} 实例已 stop
   */
  _assertNotDestroyed(methodName)
  {
    if (this._destroyed)
    {
      throw new Error(`MediaStreamMixer has been stopped. Create a new mixer before calling ${methodName}.`);
    }
  }

  // =========================================================================
  //  源移除与查找
  // =========================================================================

  /**
   * 移除并清理一个 source 对象。
   * 步骤：断开音频 → 释放 video 元素（仅 ownedVideo）→ 从 _sources 移除 → 同步 _videos。
   *
   * @param {Object} source - 要移除的 source 对象
   * @returns {boolean} true=成功移除；false=source 为空
   */
  _removeSource(source)
  {
    if (source)
    {
      logger.debug(`Removing mixer source: id=${source.id} slot=${source.slot}`);
    }

    const removed = this._sourceRegistry.remove(source);

    return removed;
  }

  /**
   * 按 MediaStream 对象、stream.id 或内部 source.id 查找 source。
   *
   * @param {MediaStream|string|HTMLVideoElement} streamOrId - 查找依据
   * @returns {Object|null} 找到的 source 对象，或 null
   */
  _findSource(streamOrId)
  {
    return this._sourceRegistry.find(streamOrId);
  }

  // =========================================================================
  //  源状态检测
  // =========================================================================

  /**
   * 检测某路源是否有 live（活跃）状态的音频轨。
   * 只混入 live 状态音频轨，避免 ended track 触发 WebAudio 创建失败或无效混音。
   *
   * @param {Object} source - 内部 source 对象
   * @returns {boolean} true=至少有一条 live 音频轨
   */
  _hasLiveAudioTrack(source)
  {
    return this._sourceRegistry.hasLiveAudioTrack(source);
  }

  /**
   * 检测某路源是否有视频轨（不判断 readyState）。
   * readyState 在绘制阶段才判断；这样刚加入但尚未出帧的源仍保留在布局中。
   *
   * @param {Object} source - 内部 source 对象
   * @returns {boolean} true=至少有一条视频轨
   */
  _hasVideoTrack(source)
  {
    return this._sourceRegistry.hasVideoTrack(source);
  }

  /**
   * 判断某路源当前是否可渲染。
   * 条件：stream 存在且 active，并且有视频轨。
   * 具体视频帧是否可画由 video.readyState 在绘制时判断。
   *
   * @param {Object} source - 内部 source 对象
   * @returns {boolean} true=可渲染
   */
  _isRenderable(source)
  {
    return this._sourceRegistry.isRenderable(source);
  }

  /**
   * 获取 source 当前关联的 MediaStream。
   *
   * 对于外部传入的 HTMLVideoElement，调用方可能后续替换 srcObject，
   * 这里同步更新 source.stream 引用，确保后续操作使用最新流。
   *
   * 注意：此方法仅同步 stream 引用，不断开音频。
   * 如果外部替换了 srcObject，音频重连由 _connectAudio() 中的换源检测处理。
   *
   * @param {Object} source - 内部 source 对象
   * @returns {MediaStream|null} 当前 MediaStream
   */
  _getSourceStream(source)
  {
    return this._sourceRegistry.getStream(source);
  }

  // =========================================================================
  //  渲染数据构建
  // =========================================================================

  /**
   * 构建一帧渲染 payload。
   *
   * Mixer 本身只负责决定每路视频应该画在哪里；真正的绘制由当前 renderer 完成。
   * 这样 Canvas2D、WebGL2、Worker Canvas2D、Worker WebGL2 可以复用完全一致的布局结果。
   *
   * @returns {Object} renderer.render() 可直接消费的数据
   */
  _createRenderPayload()
  {
    return this._layoutEngine.createRenderPayload();
  }

  /**
   * 构建当前帧水印绘制项。
   *
   * @param {Object} payload - 基础渲染 payload
   * @returns {Object} { sourceWatermarks, outputWatermarks }
   */
  _createWatermarkItems(payload)
  {
    return this._watermarkManager.createRenderItems(payload);
  }

  // =========================================================================
  //  主渲染循环（rAF）
  // =========================================================================

  /**
   * requestAnimationFrame 回调。
   * 合成一帧画面到输出画布。
   * 当配置了 fps 时，rAF 仍负责调度，但真正合成按目标帧间隔节流。
   * 绘制完成后根据是否有源决定是否调度下一帧。
   *
   * @param {number} [timestamp] - requestAnimationFrame 传入的高精度时间戳
   * @param {boolean} [forceRender=false] - 是否忽略 fps 节流立即合成一帧
   */
  _drawVideosToCanvas(timestamp, forceRender = false)
  {
    if (forceRender)
    {
      logger.debug('Force rendering mixer frame');
    }

    this._renderLoop.renderFrame(timestamp, forceRender);
  }

  // =========================================================================
  //  视频元素工具
  // =========================================================================

  /**
   * 将 MediaStream 包裹为隐藏的 HTMLVideoElement。
   * 创建的 video 元素：display:none、muted、autoplay、playsinline。
   *
   * @param {MediaStream|Object} mediaStream - MediaStream 或 { mediaStream } 包装对象
   * @returns {HTMLVideoElement} 可播放该流的隐藏 video
   */
  _mediaStreamToVideoElement(mediaStream)
  {
    logger.debug('Creating internal video element from media stream');

    return this._domAdapter.createVideoElement(mediaStream);
  }

  // =========================================================================
  //  音频连接与管理
  // =========================================================================

  /**
   * 异步刷新音频连接；用于不能 await 的路径（appendStream / rAF）。
   */
  _scheduleAudioRefresh()
  {
    logger.debug('Scheduling mixer audio refresh');
    this._audioMixer.scheduleRefresh();
  }

  /**
   * 检测外部 HTMLMediaElement 是否替换了 srcObject，并同步音频连接。
   */
  _syncExternalSourceAudio()
  {
    this._audioMixer.syncExternalSourceAudio();
  }

  /**
   * 断开一路 source 的音频连接，释放 WebAudio 节点。
   * 在以下场景调用：
   *   - removeStream() 移除源时
   *   - appendStream() 同 slot 覆盖时
   *   - HTMLVideoElement 外部换源时（由 _connectAudio 的换源检测触发）
   *
   * @param {Object} source - 内部 source 对象
   */
  _disconnectAudio(source)
  {
    if (source)
    {
      logger.debug(`Disconnecting mixer audio: id=${source.id}`);
    }

    this._audioMixer.disconnectSource(source);
  }

  /**
   * 将 AudioDestination 的音频轨补充到已返回的 mixed stream 中。
   *
   * 场景：getMixedStream() 已返回 mixed stream 给调用方时还没有音频源，
   * 后续通过 appendStream() 添加了有音频的源，此方法负责把新出现的音频轨注入到已返回的流。
   */
  _ensureMixedStreamAudioTrack(audioStream)
  {
    logger.debug('Ensuring mixed stream audio track');
    this._outputStreamManager.ensureMixedStreamAudioTrack(audioStream || (this._audioDestination && this._audioDestination.stream));
  }

  /**
   * 去重地将音频流中的音轨添加到目标流中。
   *
   * @param {MediaStream} targetStream - 目标流（一般是 video stream）
   * @param {MediaStream} audioStream - 音频流（audio destination stream）
   */
  _addAudioTracksToStream(targetStream, audioStream)
  {
    logger.debug('Adding audio tracks to mixed output stream');
    this._outputStreamManager.addAudioTracksToStream(targetStream, audioStream);
  }

  // =========================================================================
  //  公开 API
  // =========================================================================

  /**
   * 停止混流，释放所有资源。
   *
   * 清理步骤：
   *   1. 设置停止标记 + cancelAnimationFrame 停止渲染循环
   *   2. clearStreams() 移除所有源（断开音频、释放 video 元素）
   *   3. 断开并关闭 AudioContext
   *   4. 清空画布
   *   5. 停止所有 captureStream 的 tracks
   */
  stop()
  {
    logger.debug('stop');

    if (this._destroyed)
    {
      return;
    }

    this._destroyed = true;
    this._renderLoop.stop();

    this.clearStreams();

    this._audioMixer.stop();
    this._renderLoop.destroy();

    this._outputStreamManager.stop();
  }

  /**
   * 向混流器添加新的输入源。
   *
   * 支持多种调用方式：
   *   appendStream(stream)          → 自动分配 slot（grid 模式）
   *   appendStream(stream, 3)       → 指定 slot
   *   appendStream(stream, { slot: 3, gain: 0.5 })
   *   appendStream([streamA, ...])  → 批量添加
   *
   * 同 slot 已有源会被新源覆盖。
   *
   * @param {MediaStream|HTMLVideoElement|Array|Object} videos - 输入源
   * @param {number|Object} [optionsOrSlot] - slot 数字或 { slot, gain } 对象
   * @returns {boolean} true=至少成功添加了一个源
   * @throws {TypeError} 未传 videos
   */
  appendStream(videos, optionsOrSlot)
  {
    logger.debug(`appendStream: count=${videos instanceof Array ? videos.length : 1}`);
    this._assertNotDestroyed('appendStream()');

    if (!videos)
    {
      throw new TypeError('First parameter is required.');
    }

    if (!(videos instanceof Array))
    {
      videos = [ videos ];
    }

    // ---- 最多 9 路源限制 ----
    const maxSources = MixerConfig.getMaxSources();
    const currentCount = this._sources.length;
    const available = Math.max(0, maxSources - currentCount);

    if (available <= 0)
    {
      logger.warn(`appendStream: max sources (${maxSources}) reached, skipping all`);

      return false;
    }

    if (videos.length > available)
    {
      logger.warn(`appendStream: truncating ${videos.length - available} source(s) to enforce ${maxSources}-source limit`);
      videos = videos.slice(0, available);
    }

    let appended = false;

    videos.forEach((video, index) =>
    {
      const sourceOptions = this._normalizeSourceOptions(optionsOrSlot, index);

      this._sourceRegistry.add(video, sourceOptions);
      appended = true;

      // 如果音频系统已初始化，立即连接该源的音频
      if (this._audioMixer.hasAudioContext || this._audioMixer.requested)
      {
        this._scheduleAudioRefresh();
      }
    });

    // 如果 rAF 因无源而暂停且混流器仍活跃，恢复帧循环
    this._renderLoop.start();

    return appended;
  }

  /**
   * 按 MediaStream 或 ID 移除一路源。
   *
   * @param {MediaStream|string} streamOrId - 要移除的流或 ID
   *   - MediaStream 对象：按引用匹配
   *   - string：先匹配 source.id，再匹配 stream.id
   * @returns {boolean} true=找到并移除了源
   */
  removeStream(streamOrId)
  {
    logger.debug(`removeStream: ${typeof streamOrId === 'string' ? streamOrId : '[object]'}`);
    this._assertNotDestroyed('removeStream()');

    return this._removeSource(this._findSource(streamOrId));
  }

  /**
   * 移除所有输入源。
   * 遍历 _sources 快照逐条清理，过程中 _sources 数组会变化。
   */
  clearStreams()
  {
    logger.debug(`clearStreams: count=${this._sources.length}`);

    const sources = this._sources.slice();

    sources.forEach((source) =>
    {
      this._removeSource(source);
    });

  }

  /**
   * 返回当前所有源的快照。
   * 返回新对象数组，外部修改不影响内部状态。
   *
   * @returns {Array<Object>} 源信息列表：
   *   { id, streamId, slot, gain, hasAudio, hasVideo }
   */
  getSources()
  {
    this._assertNotDestroyed('getSources()');

    logger.debug(`getSources(): count=${this._sources.length}`);

    return this._sourceRegistry.getSnapshot();
  }

  /**
   * 返回当前渲染后端状态。
   *
   * 这个 API 只读，不影响渲染；主要用于 demo 展示和线上排查性能问题。
   * Worker 后端初始化有异步消息，因此刚启动时 actualMode 可能短暂显示 worker-init，
   * 随后会更新为 worker-webgl2 或 worker-2d。
   *
   * @returns {Object} 渲染状态快照
   */
  getRenderInfo()
  {
    const info = this._renderLoop.getRenderInfo();
    const outputRouteInfo = this._outputStreamManager && this._outputStreamManager.getOutputRouteInfo ?
      this._outputStreamManager.getOutputRouteInfo() :
      {};
    const mergedInfo = Object.assign({}, info, outputRouteInfo);

    const signature = [
      mergedInfo.requestedMode,
      mergedInfo.actualMode,
      mergedInfo.isWorker ? 1 : 0,
      mergedInfo.isWebGL2 ? 1 : 0,
      mergedInfo.isFallback ? 1 : 0,
      mergedInfo.reason || '',
      mergedInfo.outputMode || '',
      mergedInfo.insertableActive ? 1 : 0,
      mergedInfo.insertableSupported ? 1 : 0,
      mergedInfo.insertableGeneratorType || '',
      mergedInfo.insertableSupportReason || ''
    ].join('|');

    if (signature !== lastRenderInfoLogSignature)
    {
      lastRenderInfoLogSignature = signature;
      logger.debug(
        `getRenderInfo(): requested=${mergedInfo.requestedMode} actual=${mergedInfo.actualMode} ` +
        `worker=${mergedInfo.isWorker} webgl2=${mergedInfo.isWebGL2} fallback=${mergedInfo.isFallback} ` +
        `reason=${mergedInfo.reason || ''} rendered=${mergedInfo.renderedFrames || 0} dropped=${mergedInfo.droppedFrames || 0} ` +
        `outputMode=${mergedInfo.outputMode || '-'} insertableActive=${Boolean(mergedInfo.insertableActive)} ` +
        `insertableSupported=${Boolean(mergedInfo.insertableSupported)} generator=${mergedInfo.insertableGeneratorType || '-'} ` +
        `insertableReason=${mergedInfo.insertableSupportReason || '-'} ` +
        `captureFrameControl=${mergedInfo.captureFrameControlMode || '-'} ` +
        `fps=${mergedInfo.fps || 0} size=${mergedInfo.width || 0}x${mergedInfo.height || 0}`
      );
    }

    return mergedInfo;
  }

  /**
   * 返回当前音频混流状态。
   *
   * @returns {Object} 音频状态快照
   */
  getAudioInfo()
  {
    return this._audioMixer.getInfo();
  }

  /**
   * 替换全部水印配置。
   *
   * @param {Array<Object>|Object|null} watermarks - 水印配置
   * @returns {Promise<Array<Object>>} 当前水印快照
   */
  setWatermarks(watermarks)
  {
    this._assertNotDestroyed('setWatermarks()');

    logger.debug(`setWatermarks(): count=${watermarks instanceof Array ? watermarks.length : (watermarks ? 1 : 0)}`);

    return this._watermarkManager.setWatermarks(watermarks)
      .then((snapshot) =>
      {
        this._drawVideosToCanvas(undefined, true);

        return snapshot;
      });
  }

  /**
   * 清除水印。
   *
   * @param {Object} [filter] - { id, target, slot, sourceId, streamId }
   */
  clearWatermarks(filter)
  {
    this._assertNotDestroyed('clearWatermarks()');
    logger.debug(`clearWatermarks(): filter=${JSON.stringify(filter || null)}`);
    this._watermarkManager.clearWatermarks(filter);
    this._drawVideosToCanvas(undefined, true);
  }

  /**
   * 获取当前水印状态快照。
   *
   * @returns {Array<Object>} 水印状态列表
   */
  getWatermarks()
  {
    this._assertNotDestroyed('getWatermarks()');

    logger.debug('getWatermarks()');

    return this._watermarkManager.getWatermarks();
  }

  /**
   * 获取合并了视频和音频的完整输出流。
   *
   * 流程：
   *   1. getVideoStream() → 启动 rAF 渲染循环 + canvas.captureStream()
   *   2. 保存 mixedStream 引用，供后续 _ensureMixedStreamAudioTrack() 补充音频轨
   *   3. getAudioStream() → 初始化 AudioContext + 连接所有源的音频
   *   4. 将音频流的音轨添加到视频流
   *
   * @returns {Promise<MediaStream>} 包含视频轨和音频轨的混合流
   */
  async getMixedStream()
  {
    logger.debug('getMixedStream()');
    this._assertNotDestroyed('getMixedStream()');
    this._renderLoop.resume();

    const mixedVideoStream = this.getVideoStream();

    // 先保存 mixed stream，再初始化音频；这样启动时无音频、后续 append 有音频源时，
    // _connectAudio() 可以把 MediaStreamDestination 的音频轨补到已经返回给调用方的流里。
    this._outputStreamManager.setMixedStream(mixedVideoStream);

    const mixedAudioStream = await this.getAudioStream();

    logger.debug(`getMixedStream() audio resolved: tracks=${mixedAudioStream ? mixedAudioStream.getAudioTracks().length : 0}`);

    this._addAudioTracksToStream(mixedVideoStream, mixedAudioStream);

    return mixedVideoStream;
  }

  /**
   * 仅获取混合后的视频流（不含音频）。
   * 启动 rAF 渲染循环，从 canvas 截取画面输出为 MediaStream。
   *
   * @returns {MediaStream} 仅包含视频轨的流
   */
  getVideoStream()
  {
    logger.debug('getVideoStream()');
    this._assertNotDestroyed('getVideoStream()');
    this._renderLoop.resume();

    if (this._outputStreamManager.hasLiveVideoStream())
    {
      this._renderLoop.start();

      return this._outputStreamManager.videoStream;
    }

    const videoStream = this._outputStreamManager.getVideoStream(() =>
    {
      this._renderLoop.resetFrameTiming();
      this._drawVideosToCanvas(undefined, true);
    });

    logger.debug(`getVideoStream() created: tracks=${videoStream.getVideoTracks().length}`);

    return videoStream;
  }

  /**
   * 获取混合后的音频流。
   * 初始化 AudioContext（延迟创建），连接所有源的音频到 MediaStreamAudioDestination。
   *
   * @returns {Promise<MediaStream|null>} 仅包含音频轨的流；无音频源时返回 null
   */
  async getAudioStream(options)
  {
    logger.debug(`getAudioStream(): ${JSON.stringify(options || null)}`);
    this._assertNotDestroyed('getAudioStream()');
    const audioStream = await this._audioMixer.getAudioStream(options);

    return audioStream;
  }

  /**
   * 获取独立 AudioContext 的子混音音频流。
   * 每个 slots 组合会创建并复用自己的 AudioContext。
   *
   * @param {Object|Array<number>} options - { slots:number[] } 或 slots 数组
   * @returns {Promise<MediaStream|null>} 子混音音频流
   */
  async getIsolatedSubmixAudioStream(options)
  {
    logger.debug(`getIsolatedSubmixAudioStream(): ${JSON.stringify(options || null)}`);
    this._assertNotDestroyed('getIsolatedSubmixAudioStream()');
    const audioStream = await this._audioMixer.getIsolatedSubmixAudioStream(options);

    return audioStream;
  }

  /**
   * 释放指定 slots 的子混音请求与资源。
   *
   * @param {Object|Array<number>} options - { slots:number[], isolated?:boolean } 或 slots 数组
   * @returns {boolean} true 表示成功释放；false 表示参数无效或目标不存在
   */
  releaseSubmixAudioStream(options)
  {
    logger.debug(`releaseSubmixAudioStream(): ${JSON.stringify(options || null)}`);
    this._assertNotDestroyed('releaseSubmixAudioStream()');

    return this._audioMixer.releaseSubmixAudioStream(options);
  }

  // -- SourceRegistry 委派 --
  get _sources()
  {
    return (this._sourceRegistry && this._sourceRegistry.sources) || [];
  }

  get _videos()
  {
    return (this._sourceRegistry && this._sourceRegistry.videos) || [];
  }

  // -- RenderLoop 委派 --
  get _renderer()
  {
    return (this._renderLoop && this._renderLoop.renderer) || null;
  }

  get _animationId()
  {
    return (this._renderLoop && this._renderLoop.animationId) || null;
  }

  get _lastRenderTime()
  {
    return (this._renderLoop && this._renderLoop.lastRenderTime) || 0;
  }

  get _renderFrameInterval()
  {
    return (this._renderLoop && this._renderLoop.renderFrameInterval) || 0;
  }

  get _renderErrorCount()
  {
    return (this._renderLoop && this._renderLoop.renderErrorCount) || 0;
  }

  get _rendererErrorCount()
  {
    return (this._renderLoop && this._renderLoop.rendererErrorCount) || 0;
  }

  get _isStopDrawingFrames()
  {
    return this._renderLoop ? this._renderLoop.isStopped : false;
  }

  // -- AudioMixer 委派 --
  get _audioSources()
  {
    return (this._audioMixer && this._audioMixer.audioSources) || [];
  }

  get _audioDestination()
  {
    return (this._audioMixer && this._audioMixer.audioDestination) || null;
  }

  get _audioContext()
  {
    return (this._audioMixer && this._audioMixer.audioContext) || null;
  }

  get _audioRequested()
  {
    return this._audioMixer ? this._audioMixer.requested : false;
  }

  get _audioInfo()
  {
    return (this._audioMixer && this._audioMixer.audioInfo) || DEFAULT_AUDIO_INFO;
  }

  // -- OutputStreamManager 委派 --
  get _mixedStream()
  {
    return (this._outputStreamManager && this._outputStreamManager.mixedStream) || null;
  }

  get _capturedStreams()
  {
    return (this._outputStreamManager && this._outputStreamManager.capturedStreams) || [];
  }

  get _capturedStream()
  {
    return (this._outputStreamManager && this._outputStreamManager.capturedStream) || null;
  }

  get _videoStream()
  {
    return (this._outputStreamManager && this._outputStreamManager.videoStream) || null;
  }
};
