const Logger = require('../Logger');
const Utils = require('../Utils');
const Sources = require('./Sources');
const LayoutEngine = require('./LayoutEngine');
const AudioMixer = require('./AudioMixer');
const OutputStream = require('./OutputStream');
const RenderLoop = require('./RenderLoop');
const MediaEffectsComposerConfig = require('./ComposerConfig');
const AiVBState = require('./AIVirtualBackground/AiVBState');
const Watermark = require('./Watermark');
const issueUtils = require('../MediaEffectsIssue');
const logger = new Logger('MediaEffectsComposer');
const MAX_REPORTED_ISSUES = 50;
const ISSUE_DEFAULTS = {
  module  : 'MediaEffectsComposer',
  message : 'Unknown MediaEffectsComposer issue'
};
const getErrorMessage = issueUtils.getErrorMessage;

function cloneIssue(issue)
{
  return issue && typeof issue === 'object' ? JSON.parse(JSON.stringify(issue)) : null;
}

/**
 * 归一化 getOutput() / releaseOutput() 参数。
 * 不传参数时默认返回 'mixed' 类型。
 *
 * @param {*} options - 原始参数
 * @returns {Object} { type: 'mixed'|'video'|'audio' }
 */
function normalizeOutputRequest(options)
{
  if (options === undefined || options === null)
  {
    return { type: 'mixed' };
  }

  if (typeof options === 'string')
  {
    return { type: options };
  }

  return Object.assign({ type: 'mixed' }, options);
}

/**
 * 检查音频请求参数是否含有效的 slots 列表。
 *
 * @param {Object|*} request - 原始请求参数
 * @returns {Object|undefined} 有效请求返回原值，否则返回 undefined
 */
function resolveAudioRequest(request)
{
  return request && request.slots ? request : undefined;
}

/**
 * MediaEffectsComposer — 多路音视频合成器
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
 *   const composer = new MediaEffectsComposer([localStream, remoteStream], { width: 1280, height: 720 });
 *   const output = await composer.getMixedStream();
 *   // peerConnection.addTrack(output.getVideoTracks()[0], output);
 */
class MediaEffectsComposer
{
  // =========================================================================
  //  构造与初始化
  // =========================================================================

  /**
   * @param {Array<MediaStream|HTMLMediaElement>|MediaStream|HTMLMediaElement} videos
   *   需要混流的输入源。为了兼容旧版 SDK，仍然支持只传数组；新版也允许传单个源。
   *   每个元素可以是：
   *     - MediaStream：原生 WebRTC 媒体流
   *     - HTMLVideoElement：外部 video 元素，需使用 srcObject=MediaStream（composer 不接管生命周期）
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
   * @param {boolean} [options.sourceMirror=false]
   *   是否默认对所有槽位应用水平镜像。
   * @param {boolean} [options.mirror=false]
   *   是否对最终合成输出整体做水平镜像。
   * @param {boolean} [options.mirrorWatermarksWithOutput=false]
   *   输出镜像时，输出级水印是否跟着一起翻转。
   * @param {boolean} [options.enableInsertable=false]
   *   是否优先使用 Insertable Streams 导出视频；能力不足时回退到 captureStream。
   * @param {boolean} [options.manualCaptureFrameControl=true]
   *   captureStream 路径下是否优先使用 captureStream(0)+requestFrame 手动出帧。
   * @param {Array<Object>} [options.watermarks=[]]
   *   初始水印配置列表。
   * @param {Object[]} [options.sources]
   *   与初始输入源逐项对应的 source 级配置数组，如 `sourceMirror`、
   *   `aiVirtualBackground` 等。
   */
  constructor(videos = [], options = {})
  {
    // -- 参数安全守卫（防止外部传 null/undefined 导致后续崩溃） --
    options = options || {};
    videos = videos || [];
    this._onIssue = typeof options.onIssue === 'function' ? options.onIssue : null;
    this._issues = [];

    // 统一为数组，方便后续统一遍历
    if (!(videos instanceof Array))
    {
      videos = [ videos ];
    }

    logger.debug(`constructor: ${videos.length} ${JSON.stringify(options)}`);

    // -----------------------------------------------------------------------
    // 源管理
    // -----------------------------------------------------------------------

    this._sourceRegistry = null;

    const config = MediaEffectsComposerConfig.create(options);

    logger.debug(`constructor normalized config: ${JSON.stringify(config)}`);

    /** @type {boolean} 实例销毁标记；stop() 后不再允许重新取流或追加源 */
    this._destroyed = false;

    /** @type {number|null} requestAnimationFrame 返回的 ID，用于 cancel */
    this._renderLoop = null;

    /** @type {number} 连续渲染失败次数，用于诊断渲染后端异常 */
    // (delegated to RenderLoop via prototype getter)

    // -----------------------------------------------------------------------
    // WebAudio 相关
    // -----------------------------------------------------------------------

    this._audioComposer = null;
    this._outMgr = null;
    this._sourceAiVBManager = null;
    this._watermarkManager = null;

    // -----------------------------------------------------------------------
    // 混流配置
    // -----------------------------------------------------------------------

    /**
     * @type {Object}
     * @property {number} width               - 输出宽度（默认 1280）
     * @property {number} height              - 输出高度（默认 720）
     * @property {number|null} fps             - 帧率（null=浏览器默认）
     * @property {string}      backgroundColor - 画布底色
     * @property {number}      audioGain       - 全局默认音量
     * @property {string}      renderMode      - 渲染后端选择
     */
    this._config = config;
    this._sourceAiVBManager = new AiVBState({
      logger  : logger,
      onIssue : this._recordIssue.bind(this)
    });
    this._config.aiVirtualBackgroundManager = this._sourceAiVBManager;
    this._config.hasSourceAiVirtualBackground = false;
    this._config.forceMainThreadRenderer = false;
    this._config.forceMain2DRenderer = false;
    this._slotMirrorOv = Object.create(null);
    this._watermarkManager = new Watermark({
      logger  : logger,
      onIssue : this._recordIssue.bind(this)
    });

    // -----------------------------------------------------------------------
    // 渲染画布
    // -----------------------------------------------------------------------

    /** @type {HTMLCanvasElement} 离屏 canvas，所有视频帧合成到这里 */
    this._canvas = document.createElement('canvas');
    this._canvas.setAttribute('style', 'display:none');
    logger.debug('Hidden composer canvas created');

    /** @type {number|null} 上次渲染器 resize 的宽高缓存，仅尺寸变化时打日志 */
    this._lastRenderWidth = null;
    this._lastRenderHeight = null;

    // -----------------------------------------------------------------------
    // 输入源存储（Sources）—— 统一管理所有视频/音频源的生命周期。
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
    
    this._sourceRegistry = new Sources({
      logger             : logger,
      getDefaultGain     : () => this._config.audioGain,
      normalizeGain      : MediaEffectsComposerConfig.normalizeGain,
      createVideoElement : this._mediaStreamToVideoElement.bind(this),
      onBeforeRemove     : (source) => this._disconnectAudio(source),
      onAfterRemove      : (source) =>
      {
        this._sourceAiVBManager.removeSource(source);

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
    // 输出流管理器（OutputStream）—— 将 canvas 内容导出为 MediaStream。
    //
    // 职责：
    //   1. 通过 canvas.captureStream(fps) 获取输出视频轨道
    //   2. 管理输出流的 fps、分辨率等参数（取自 this._config）
    //   3. 提供 getVideoStream() / getMixedStream() 入口
    //
    // 依赖：需要 canvas 已创建、config 已就绪
    // -----------------------------------------------------------------------

    this._outMgr = new OutputStream({
      canvas           : this._canvas,
      config           : this._config,
      createSinkVideo  : (stream) => this._createSinkVideoElement(stream),
      disposeSinkVideo : (video) => this._disposeSinkVideoElement(video),
      logger           : logger,
      onIssue          : this._recordIssue.bind(this)
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
    //       RenderLoop 内部通过 ensureRenderer() 按需创建
    // -----------------------------------------------------------------------

    this._renderLoop = new RenderLoop({
      canvas                  : this._canvas,
      config                  : this._config,
      logger                  : logger,
      getSources              : () => this._sources,
      createRenderPayload     : () => this._createRenderPayload(),
      syncExternalSourceAudio : () => this._syncExternalSourceAudio(),
      onStateChange           : () => {},
      onFramePresented        : (frameCtx) => this._outMgr.onFramePresented(frameCtx),
      onIssue                 : this._recordIssue.bind(this)
    });

    // -----------------------------------------------------------------------
    // 音频混音器（AudioMixer）—— 将所有源的音频轨道混合为一路输出。
    //
    // 职责：
    //   1. 通过 WebAudio API（AudioContext, GainNode）创建混音管线
    //   2. 通过 sourceRegistry 查询源信息，连接/断开源音频的 WebAudio 节点
    //   3. 将混音结果以 MediaStream 形式回传给控制层
    //   4. 检测并规避已销毁（_destroyed）后的操作
    //
    // 回调：
    //   onAudioTrackAvailable → 将混音后的音频轨道挂到输出流上
    //   getDestroyed          → 防销毁后误操作
    // -----------------------------------------------------------------------

    this._audioComposer = new AudioMixer({
      logger                : logger,
      sourceRegistry        : this._sourceRegistry,
      getDestroyed          : () => this._destroyed,
      onAudioTrackAvailable : (audioStream) => this._ensureMixedAudio(audioStream),
      onIssue               : this._recordIssue.bind(this)
    });

    // -----------------------------------------------------------------------
    // 布局引擎（LayoutEngine）—— 计算每个源在 canvas 上的位置和尺寸。
    //
    // 职责：
    //   1. 按 slot 自动计算网格布局（cols × rows）
    //   2. 在源增删或画布尺寸变化时重新布局
    //   3. 生成每路视频的绘制矩形（draw rect），供 renderer 使用
    //   4. 触发 canvas 尺寸调整（prepareCanvas → resizeRenderer）
    //
    // 注意：LayoutEngine 不直接操作渲染管线，只计算坐标；
    //       实际绘制由 renderer 根据 payload.items 中的 draw 区域执行。
    // -----------------------------------------------------------------------

    this._layoutEngine = new LayoutEngine({
      sourceRegistry       : this._sourceRegistry,
      canvas               : this._canvas,
      config               : this._config,
      logger               : logger,
      prepareCanvas        : this._prepareCanvas.bind(this),
      resizeRenderer       : this._resizeRenderer.bind(this),
      createWatermarkItems : (payload) => this._createWatermarkItems(payload),
      resolveMirrorX       : (source, slot) => this._resolveMirrorX(source, slot)
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
      })
      .catch((error) =>
      {
        logger.warn(`Initial watermarks setup failed: ${error.message || String(error)}`);
        this._recordIssue({
          message : getErrorMessage(error)
        });
      });

    this._lastRenderInfoLogSignature = '';

    // -- 将初始传入的源加入混流 --
    this.addSource(videos, this._normalizeInitialSourceOptionsList(options, videos.length));

    // 安卓微信 / 鸿蒙浏览器：强制第一个输入槽位视频为 30fps，与 RTCSession 侧保持一致
    if (Utils.shouldRecoverVideoFrameRateByUA())
    {
      this._forceFirstSlotFrameRate();
    }
  }

  /**
   * 对第一个输入槽位（slot 0）的视频轨强制应用 30fps 约束。
   *
   * 部分 UA（安卓微信 / 鸿蒙浏览器）下视频帧率可能出现异常，
   * 此处参考 RTCSession._checkAndRecoverVideoFrameRate 的逻辑，
   * 读取当前约束并以 Object.assign 合并 frameRate: 30，避免覆盖轨上已有的 width/height 等约束。
   */
  _forceFirstSlotFrameRate()
  {
    const firstSource = this._sources.find((s) => s.slot === 0);

    if (!firstSource) 
    {
      return;
    }

    const stream = firstSource.stream;

    if (!stream || typeof stream.getVideoTracks !== 'function')
    {
      return;
    }

    const videoTrack = stream.getVideoTracks()[0];

    if (!videoTrack || typeof videoTrack.getConstraints !== 'function' || typeof videoTrack.applyConstraints !== 'function')
    {
      return;
    }

    const constraints = videoTrack.getConstraints() || {};
    const frameRateConstraints = constraints.frameRate;
    const frameRate = typeof frameRateConstraints === 'number'
      ? frameRateConstraints
      : frameRateConstraints && (
        frameRateConstraints.exact ||
        frameRateConstraints.ideal ||
        frameRateConstraints.max ||
        frameRateConstraints.min
      );

    // 当前帧率已是 30 或更高则跳过
    if (Number.isFinite(frameRate) && frameRate >= 30)
    {
      return;
    }

    videoTrack.applyConstraints(Object.assign({}, constraints, {
      frameRate : 30
    })).catch((error) =>
    {
      logger.debug(`_forceFirstSlotFrameRate applyConstraints failed: ${error.message || String(error)}`);
    });
  }

  // =========================================================================
  //  配置检测与参数归一化
  // =========================================================================

  /**
   * 统一 appendStream() 第二个参数的格式。
   * 支持两种调用方式：
   *   appendStream(stream, 3)            → 数字作为 slot
   *   appendStream(stream, { slot, gain, sourceMirror }) → 对象解构
   *
   * 同时将 aiVirtualBackground 配置透传给 AiVBState 做二级归一化。
   *
   * @param {number|Object} optionsOrSlot - 原始参数
   * @param {number} index - 数组索引，用于批量添加时 slot 递增
   * @returns {Object} { slot: number|null, gain: number|undefined, sourceMirror: boolean|undefined }
   */
  _normalizeSourceOptions(optionsOrSlot, index)
  {
    const normalized = MediaEffectsComposerConfig.normalizeSourceOptions(optionsOrSlot, index, this._config.audioGain);

    if (Object.prototype.hasOwnProperty.call(normalized, 'aiVirtualBackground'))
    {
      normalized.aiVirtualBackground = this._sourceAiVBManager.normalizeInput(normalized.aiVirtualBackground);
    }

    return normalized;
  }

  /**
   * 对构造时传入的 sources 数组做并行配置归一化。
   * options.sources 数组与 videos 数组按索引一一对应。
   *
   * @param {Object} options - 原始配置
   * @param {number} sourceCount - 源数量
   * @returns {Array<Object|undefined>} 归一化后的配置列表
   */
  _normalizeInitialSourceOptionsList(options, sourceCount)
  {
    const normalizedCount = Math.max(0, Number(sourceCount) || 0);
    const normalizedList = [];
    const sourceList = options && options.sources instanceof Array ? options.sources : null;

    for (let index = 0; index < normalizedCount; index++)
    {
      if (sourceList && sourceList[index] && typeof sourceList[index] === 'object')
      {
        normalizedList.push(sourceList[index]);

        continue;
      }

      normalizedList.push(undefined);
    }

    return normalizedList;
  }

  /**
   * 统一的问题记录入口。
   *
   * 接收来自以下组件的上报：
   * - Watermark（水印加载/初始化失败）
   * - AiVBState（AI 虚拟背景初始化/分割/背景图加载失败）
   * - RenderLoop（渲染器降级/回退/帧渲染失败）
   * - OutputStream（captureStream/insertable 输出失败）
   * - AudioMixer（音频上下文/混音失败）
   * - MediaEffectsComposer 自身（如水印初始化失败）
   *
   * 执行以下操作：
   * 1. 内存缓存：将 clone 后的 issue 推入 this._issues（FIFO，MAX_REPORTED_ISSUES=50）
   * 2. 状态快照：通过 ComposerState.getSnapshot() 将问题列表写入 state.issues，供调试面板查询
   * 3. 向上传递：调用 onIssue 回调（最终到达 RTCSession._emitMediaEffectsIssue），
   *    触发 'mediaEffectsIssue' 事件
   *
   * 各子组件通过 bind(this._recordIssue) 获得上报能力，形成统一的汇合点。
   * 所有子组件上报的问题在 component 字段中标记自身的组件名，
   * 便于管理员区分问题来源。
   *
   * @param {Object} [issue] - 问题描述对象
   */
  _recordIssue(issue)
  {
    const normalizedIssue = issueUtils.normalizeIssue(ISSUE_DEFAULTS, issue);

    this._issues.push(cloneIssue(normalizedIssue));
    if (this._issues.length > MAX_REPORTED_ISSUES)
    {
      this._issues.shift();
    }

    issueUtils.forwardIssue(this._onIssue, normalizedIssue, logger, 'MediaEffectsComposer issue callback failed', cloneIssue);
  }

  /**
   * 获取混流器运行时记录的所有问题。
   *
   * 返回深拷贝副本，最多保留 MAX_REPORTED_ISSUES 条（默认 50 条），FIFO 淘汰。
   * 外部通过 getSnapshot() → state.issues 即可获取问题列表，
   * 方便在调试面板或监控系统中展示。
   *
   * @returns {Object[]}
   */
  getIssues()
  {
    return this._issues.map(cloneIssue);
  }

  /**
   * 解析指定 source 在当前 slot 上的水平镜像策略。
   *
   * 优先级（从高到低）：
   *   1. slot 级别的覆盖（setSourceMirror(slot, bool) 单独设置）
   *   2. source 对象自身的 mirrorX 属性
   *   3. 全局 sourceMirror 配置
   *
   * @param {Object} source - 内部 source 对象
   * @param {number} slot - source 所在 slot 编号
   * @returns {boolean} 该 source 在当前 slot 上是否应水平镜像
   */
  _resolveMirrorX(source, slot)
  {
    const key = String(slot);
    const hasSlotOverride = Object.prototype.hasOwnProperty.call(this._slotMirrorOv, key);

    if (hasSlotOverride)
    {
      return this._slotMirrorOv[key];
    }

    if (source && typeof source.mirrorX === 'boolean')
    {
      return source.mirrorX;
    }

    return Boolean(this._config.mirrorX);
  }

  /**
   * 检查输出镜像是否已启用。
   * 输出镜像会对整个合成画面做水平翻转（不影响各 source 自身的镜像）。
   *
   * @returns {boolean} true=输出全局水平镜像已启用
   */
  _isOutputMirrorEnabled()
  {
    return Boolean(this._config.outputMirrorX);
  }

  /**
   * 检查是否有任何 source 或 slot 覆盖启用了水平镜像。
   * 用于判断渲染策略是否需要调整（如 source AiVB 需要主线程渲染）。
   *
   * @returns {boolean} true=至少有一个镜像策略启用了
   */
  _isMirrorEnabled()
  {
    if (this._config.mirrorX)
    {
      return true;
    }

    if (Object.keys(this._slotMirrorOv).some((slot) => this._slotMirrorOv[slot] === true))
    {
      return true;
    }

    return this._sources.some((source) => source && source.mirrorX === true);
  }

  /**
   * 检查是否有任何 source 启用了 AI 虚拟背景效果。
   * 用于决定是否需要强制走主线程渲染路径。
   *
   * @returns {boolean} true=至少一个 source 启用了 AiVB
   */
  _hasSourceAiVirtualBackgroundEnabled()
  {
    return this._sources.some((source) => this._sourceAiVBManager.hasEnabledEffect(source));
  }

  /**
   * 为所有启用了 AiVB 的 source 预加载渲染资源（背景图等）。
   * 在 mirror 等配置变更时调用，避免首帧白屏。
   */
  _preloadSourceAiVBRenderAssets()
  {
    this._sources.forEach((source) =>
    {
      if (!source || !source.video)
      {
        return;
      }

      this._sourceAiVBManager.preloadRenderAssets(source, source.video);
    });
  }

  /**
   * 根据当前 AiVB 启停状态刷新渲染器策略。
   *
   * 当有 source 在使用 AiVB 时，必须切到主线程渲染器（WebGL2 优先，最终兜底 Canvas2D），
   * 因为 Worker 无法直接访问主线程的遮罩 canvas 和背景图。
   * 当全部 source 的 AiVB 关闭后，不再强制主线程，允许后续 restoreFFS 切换回 Worker 路径。
   */
  _refreshFxRenderPolicy()
  {
    const hasSourceAiVirtualBackground = this._hasSourceAiVirtualBackgroundEnabled();
    const previousAiVBPolicy = this._config.hasSourceAiVirtualBackground;

    this._config.hasSourceAiVirtualBackground = hasSourceAiVirtualBackground;

    if (previousAiVBPolicy !== hasSourceAiVirtualBackground)
    {
      logger.debug(`Effect renderer policy updated: hasSourceAiVirtualBackground=${hasSourceAiVirtualBackground}`);
    }
  }

  /**
   * 设置输出画布尺寸。
   */
  _prepareCanvas()
  {
    const width = this._config.width || 1280;
    const height = this._config.height || 720;
    let resized = false;

    if (this._canvas.width !== width)
    {
      this._canvas.width = width;
      resized = true;
    }

    if (this._canvas.height !== height)
    {
      this._canvas.height = height;
      resized = true;
    }

    if (resized)
    {
      logger.debug(`Canvas prepared: ${width}x${height}`);
    }
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
   * Worker 渲染器运行时失败后降级到主线程渲染器。
   * 委托给 RenderLoop，后者尝试 main-webgl2 → main-2d 回退链。
   *
   * @param {string} reason - 降级原因
   * @returns {boolean} true=降级成功
   */
  _fallbackRendererToMainThread(reason)
  {
    logger.warn(`Fallback to main-thread renderer requested: ${reason}`);

    return this._renderLoop.fallbackRendererToMainThread(reason);
  }

  /**
   * 当前渲染器失败后降级到 Worker Canvas2D 渲染器。
   * 委托给 RenderLoop，后者尝试 Worker 内 2D 上下文初始化。
   *
   * @param {string} reason - 降级原因
   * @returns {boolean} true=降级成功
   */
  _fallbackRendererToWorker2D(reason)
  {
    logger.warn(`Fallback to worker-2d renderer requested: ${reason}`);

    return this._renderLoop.fallbackRendererToWorker2D(reason);
  }

  /**
   * 防止 stop() 后继续复用同一个实例。
   *
   * stop() 会释放 renderer、AudioContext、captureStream tracks 和内部源。
   * 继续复用同一个实例容易让调用方拿到已 ended 的输出轨，因此明确要求重新 new composer。
   *
   * @param {string} methodName - 当前公开方法名
   * @throws {Error} 实例已 stop
   */
  _assertNotDestroyed(methodName)
  {
    if (this._destroyed)
    {
      logger.warn(`Method called after stop(): ${methodName}`);
      throw new Error(`MediaEffectsComposer has been stopped. Create a new composer before calling ${methodName}.`);
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
      logger.debug(`Removing composer source: id=${source.id} slot=${source.slot}`);
    }

    const removed = this._sourceRegistry.remove(source);

    if (!removed)
    {
      logger.debug('Removing composer source skipped: source not found');
    }

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

  // =========================================================================
  //  渲染数据构建
  // =========================================================================

  /**
   * 构建一帧渲染 payload。
   *
   * Composer 本身只负责决定每路视频应该画在哪里；真正的绘制由当前 renderer 完成。
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
      logger.debug('Force rendering composer frame');
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

    const video = document.createElement('video');

    video.setAttribute('style', 'display:none');
    video.muted = true;
    video.autoplay = true;
    video.setAttribute('playsinline', '');
    video.srcObject = mediaStream && (mediaStream.mediaStream || mediaStream);

    const capturedStreamId = (video.srcObject && video.srcObject.id) || 'unknown';

    video.play().catch((error) =>
    {
      if (!video.srcObject)
      {
        return;
      }
      logger.error(`video play error for stream ${capturedStreamId}: ${error.message || String(error)}`);
    });

    return video;
  }

  /**
   * 为 captureStream 输出创建隐藏的消费 video（用于规避部分 Chromium 降质丢帧）。
   */
  _createSinkVideoElement(mediaStream)
  {
    const video = this._mediaStreamToVideoElement(mediaStream);

    logger.debug(`Output sink video created for captureStream ${mediaStream && mediaStream.id ? mediaStream.id : 'unknown'}`);
    
    return video;
  }

  /**
   * 清理隐藏的 video 元素。
   */
  _disposeSinkVideoElement(video)
  {
    if (!video) return;

    try { if (typeof video.pause === 'function') video.pause(); }
    catch (e) {}
    try { video.srcObject = null; }
    catch (e) {}
    try { if (typeof video.remove === 'function') video.remove(); }
    catch (e) {}
  }

  // =========================================================================
  //  音频连接与管理
  // =========================================================================

  /**
   * 异步刷新音频连接；用于不能 await 的路径（appendStream / rAF）。
   */
  _scheduleAudioRefresh()
  {
    logger.debug('Scheduling composer audio refresh');
    this._audioComposer.scheduleRefresh();
  }

  /**
   * 检测外部 HTMLMediaElement 是否替换了 srcObject，并同步音频连接。
   */
  _syncExternalSourceAudio()
  {
    this._audioComposer.syncExternalSourceAudio();
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
      logger.debug(`Disconnecting composer audio: id=${source.id}`);
    }

    this._audioComposer.disconnectSource(source);
  }

  /**
   * 将 AudioDestination 的音频轨补充到已返回的 mixed stream 中。
   *
   * 场景：getMixedStream() 已返回 mixed stream 给调用方时还没有音频源，
   * 后续通过 appendStream() 添加了有音频的源，此方法负责把新出现的音频轨注入到已返回的流。
   */
  _ensureMixedAudio(audioStream)
  {
    logger.debug('Ensuring mixed stream audio track');
    this._outMgr.ensureMixedStreamAudioTrack(audioStream || (this._audioDestination && this._audioDestination.stream));
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
    this._outMgr.addAudioTracksToStream(targetStream, audioStream);
  }

  /**
   * 移除并清理内部源（按 target）。
   *
   * target 为 undefined 时清空所有源；否则按 stream/id 查找后移除单个源。
   * 移除过程由 Sources.remove() 驱动，触发 onBeforeRemove（断音频）
   * → onAfterRemove（清理渲染器、AiVB 状态）回调链。
   *
   * @param {MediaStream|string|HTMLVideoElement|undefined} target - 移除目标
   * @returns {boolean} true=成功移除
   */
  _removeSourcesInternal(target)
  {
    if (target === undefined)
    {
      logger.debug(`clearSources: count=${this._sources.length}`);

      const sources = this._sources.slice();

      sources.forEach((source) =>
      {
        this._removeSource(source);
      });

      logger.debug(`clearSources complete: remaining=${this._sources.length}`);

      return true;
    }

    logger.debug(`removeSource: ${typeof target === 'string' ? target : '[object]'}`);
    const removed = this._removeSource(this._findSource(target));

    logger.debug(`removeSource complete: removed=${removed} remaining=${this._sources.length}`);

    return removed;
  }

  /**
   * 获取指定 slot（或全部 slot）的 source 水平镜像状态快照。
   *
   * 返回结构：
   *   - 指定 slot 时：{ slot, global, override, effective }
   *   - 不指定 slot 时：{ global, overrides }
   *
   * @param {number} [slot] - 要查询的 slot 编号
   * @returns {Object} 镜像状态快照
   * @throws {TypeError} slot 参数非法时抛出
   */
  _getSourceMirrorLegacySnapshot(slot)
  {
    const global = Boolean(this._config.mirrorX);
    const overrides = Object.keys(this._slotMirrorOv).reduce((snapshot, key) =>
    {
      snapshot[key] = this._slotMirrorOv[key];

      return snapshot;
    }, {});

    if (slot === undefined || slot === null)
    {
      return { global, overrides };
    }

    const normalizedSlot = MediaEffectsComposerConfig.normalizeSlot(slot, 0);

    if (normalizedSlot === null)
    {
      throw new TypeError('Invalid slot.');
    }

    const key = String(normalizedSlot);
    const hasOverride = Object.prototype.hasOwnProperty.call(this._slotMirrorOv, key);
    const override = hasOverride ? this._slotMirrorOv[key] : null;
    let effective = global;
    const source = this._sources.find((item) => item && item.slot === normalizedSlot) || null;

    if (override !== null)
    {
      effective = override;
    }
    else if (source && typeof source.mirrorX === 'boolean')
    {
      effective = source.mirrorX;
    }

    return {
      slot      : normalizedSlot,
      global    : global,
      override  : override,
      effective : Boolean(effective)
    };
  }

  _collectRenderInfo(logResult = true)
  {
    const info = this._renderLoop.getRenderInfo();
    const outputRouteInfo = this._outMgr && this._outMgr.getOutputRouteInfo ?
      this._outMgr.getOutputRouteInfo() : {};
    const mergedInfo = Object.assign({}, info, outputRouteInfo);

    if (logResult)
    {
      const signature = [
        mergedInfo.requestedMode,
        mergedInfo.actualMode,
        mergedInfo.isWorker ? 1 : 0,
        mergedInfo.isWebGL2 ? 1 : 0,
        mergedInfo.isFallback ? 1 : 0,
        mergedInfo.reason || '',
        mergedInfo.outputMode || '',
        mergedInfo.insertableActive ? 1 : 0,
        mergedInfo.captureFrameControlMode || '',
        mergedInfo.fps || 0,
        mergedInfo.width || 0,
        mergedInfo.height || 0
      ].join('|');

      if (signature !== this._lastRenderInfoLogSignature)
      {
        this._lastRenderInfoLogSignature = signature;
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
    }

    return mergedInfo;
  }

  _collectAudioInfo(logResult = true)
  {
    const info = this._audioComposer.getInfo();

    if (logResult)
    {
      logger.debug(
        `getAudioInfo(): status=${info.status} requested=${info.requested} ` +
        `sources=${info.sourceCount}/${info.liveSourceCount} outputTracks=${info.outputTracks}`
      );
    }

    return info;
  }

  _getConfigStateSnapshot()
  {
    const slotMirrorXOverrides = this._slotMirrorOv || {};

    return {
      outputMirror          : Boolean(this._config.outputMirrorX),
      sourceMirror          : Boolean(this._config.mirrorX),
      sourceMirrorOverrides : Object.keys(slotMirrorXOverrides).reduce((snapshot, key) =>
      {
        snapshot[key] = slotMirrorXOverrides[key];

        return snapshot;
      }, {}),
      mirrorWatermarksWithOutput : this._config.mirrorWatermarksWithOutput !== false,
      watermarks                 : (this._watermarkManager.getWatermarks() || []).slice()
    };
  }

  /**
   * 获取输出视频流的同步方法。
   *
   * 流程：
   *   1. 恢复渲染循环
   *   2. 如果已有 live 视频流 → 直接复用
   *   3. 否则通过 OutputStream 创建新流（先绘制首帧确保 canvas 有内容）
   *   4. 启动渲染循环
   *
   * @returns {MediaStream} 仅含视频轨的输出流
   */
  _getVideoOutputSync()
  {
    this._renderLoop.resume();

    if (this._outMgr.hasLiveVideoStream())
    {
      this._renderLoop.start();

      return this._outMgr.videoStream;
    }

    const videoStream = this._outMgr.getVideoStream(() =>
    {
      this._renderLoop.resetFrameTiming();
      this._drawVideosToCanvas(undefined, true);
    });

    logger.debug(`getVideoStream() created: tracks=${videoStream.getVideoTracks().length}`);

    return videoStream;
  }

  /**
   * 获取合并了视频和音频的混合输出流。
   *
   * 流程：
   *   1. 获取视频流（启动 rAF 渲染循环 + 建立视频输出路径，优先 Insertable，回退 captureStream）
   *   2. 保存为 mixedStream（供后续 _ensureMixedAudio 补充音频轨）
   *   3. 获取稳定的音频流（getStableAudioStream；即使无源也创建静音轨）
   *   4. 将音频轨注入到视频流
   *
   * @returns {Promise<MediaStream>} 含视频轨和音频轨的混合流
   */
  async _getMixedOutput()
  {
    this._renderLoop.resume();

    const mixedVideoStream = this._getVideoOutputSync();

    this._outMgr.setMixedStream(mixedVideoStream);

    const mixedAudioStream = await this._audioComposer.getStableAudioStream();

    logger.debug(`getMixedStream() audio resolved: tracks=${mixedAudioStream ? mixedAudioStream.getAudioTracks().length : 0}`);

    this._addAudioTracksToStream(mixedVideoStream, mixedAudioStream);
    logger.debug(`getMixedStream() complete: videoTracks=${mixedVideoStream.getVideoTracks().length} audioTracks=${mixedVideoStream.getAudioTracks().length}`);

    return mixedVideoStream;
  }

  _normalizeOutputRequest(options)
  {
    return normalizeOutputRequest(options);
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
   *   5. 停止所有输出 video tracks（captureStream / Insertable）
   */
  stop()
  {
    logger.debug('stop');

    if (this._destroyed)
    {
      logger.debug('stop skipped: already destroyed');

      return;
    }

    this._destroyed = true;
    this._renderLoop.stop();

    this._removeSourcesInternal(undefined);

    this._audioComposer.stop();
    this._sourceAiVBManager.clear();
    this._layoutEngine.clearAudioPlaceholderCache();
    this._renderLoop.destroy();

    this._outMgr.stop();
    logger.debug('stop complete');
  }

  /**
   * 添加一个或多个源到混流器。
   *
   * 处理逻辑：
   *   1. 检查是否已 stop（抛错）
   *   2. 统一输入为数组
   *   3. 检查最大源数限制，超出时截断
   *   4. 逐项调用 Sources.add()，配置冲突时旧源被自动替换
   *   5. 若音频系统已就绪，调度异步音频刷新
   *   6. 刷新渲染策略（AiVB 可能强制主线程）并启动渲染循环
   *
   * @param {MediaStream|HTMLVideoElement|Array} videos - 单个或批量输入源
   * @param {number|Object|Array} optionsOrSlot - 单个或批量配置
   * @returns {boolean} true=至少成功添加了一个源
   * @throws {TypeError} 第一参数为空时抛出
   */
  addSource(videos, optionsOrSlot)
  {
    logger.debug(`addSource: count=${videos instanceof Array ? videos.length : 1}`);
    this._assertNotDestroyed('addSource()');

    if (!videos)
    {
      throw new TypeError('First parameter is required.');
    }

    if (!(videos instanceof Array))
    {
      videos = [ videos ];
    }

    const maxSources = MediaEffectsComposerConfig.getMaxSources();
    const currentCount = this._sources.length;
    const available = Math.max(0, maxSources - currentCount);

    if (available <= 0)
    {
      logger.warn(`addSource: max sources (${maxSources}) reached, skipping all`);

      return false;
    }

    if (videos.length > available)
    {
      logger.warn(`addSource: truncating ${videos.length - available} source(s) to enforce ${maxSources}-source limit`);
      videos = videos.slice(0, available);
    }

    let appended = false;
    const sourceOptionsList = optionsOrSlot instanceof Array ? optionsOrSlot : null;

    videos.forEach((video, index) =>
    {
      const sourceOptions = this._normalizeSourceOptions(
        sourceOptionsList ? sourceOptionsList[index] : optionsOrSlot,
        sourceOptionsList ? 0 : index
      );

      this._sourceRegistry.add(video, sourceOptions);
      appended = true;

      if (this._audioComposer.hasAudioContext || this._audioComposer.requested)
      {
        this._scheduleAudioRefresh();
      }
    });

    this._refreshFxRenderPolicy();
    this._renderLoop.start();

    // 安卓微信 / 鸿蒙浏览器：新源加入后检查 slot 0 是否需强制 30fps
    if (Utils.shouldRecoverVideoFrameRateByUA())
    {
      this._forceFirstSlotFrameRate();
    }

    logger.debug(`addSource complete: appended=${appended} totalSources=${this._sources.length}`);

    return appended;
  }

  /**
   * 移除一个源（按 stream 对象、stream id 或 source id 查找）。
   *
   * @param {MediaStream|string|HTMLVideoElement} target - 要移除的目标
   * @returns {boolean} true=成功移除
   */
  removeSource(target)
  {
    this._assertNotDestroyed('removeSource()');

    if (target === undefined)
    {
      return false;
    }

    return this._removeSourcesInternal(target);
  }

  clearSources()
  {
    this._assertNotDestroyed('clearSources()');
    this._removeSourcesInternal(undefined);
  }

  /**
   * 动态更新混流配置（运行时即时生效，无需重建 composer）。
   *
   * 支持的 patch 字段：
   *   - outputMirror: 全局输出镜像
   *   - mirrorWatermarksWithOutput: 输出镜像时水印是否同步镜像
   *   - sourceMirror: 全局 source 镜像
   *   - clearSourceMirrorOverrides: 清除所有 slot 级别的镜像覆盖
   *   - sourceMirrorOverrides: slot 级别的镜像覆盖映射表
   *   - watermarks: 替换全部水印配置
   *   - clearWatermarks + clearWatermarkFilter: 按条件清除水印
   *
   * 特殊行为：
   *   - 镜像策略变更时自动预加载 AiVB 渲染资源
   *   - 镜像策略变更时刷新渲染器策略（AiVB 需要主线程）
   *   - 水印或镜像变更后强制重绘一帧
   *
   * @param {Object} patch - 配置补丁（键值对）
   * @returns {Promise<Object>} 更新后的配置快照
   */
  async setConfig(patch)
  {
    this._assertNotDestroyed('setConfig()');
    patch = patch || {};

    let needsMirrorPolicyRefresh = false;
    let needsForceRender = false;
    let shouldPreloadAiVBRenderAssets = false;

    if (Object.prototype.hasOwnProperty.call(patch, 'outputMirror'))
    {
      this._config.outputMirrorX = Boolean(patch.outputMirror);
      needsMirrorPolicyRefresh = true;
      needsForceRender = true;
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'mirrorWatermarksWithOutput'))
    {
      this._config.mirrorWatermarksWithOutput = Boolean(patch.mirrorWatermarksWithOutput);
      needsForceRender = true;
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'sourceMirror'))
    {
      this._config.mirrorX = Boolean(patch.sourceMirror);
      needsMirrorPolicyRefresh = true;
      needsForceRender = true;
      shouldPreloadAiVBRenderAssets = true;
    }

    if (patch.clearSourceMirrorOverrides === true)
    {
      this._slotMirrorOv = Object.create(null);
      needsMirrorPolicyRefresh = true;
      needsForceRender = true;
      shouldPreloadAiVBRenderAssets = true;
    }

    if (patch.sourceMirrorOverrides && typeof patch.sourceMirrorOverrides === 'object')
    {
      Object.keys(patch.sourceMirrorOverrides).forEach((slotKey) =>
      {
        const normalizedSlot = MediaEffectsComposerConfig.normalizeSlot(slotKey, 0);

        if (normalizedSlot === null)
        {
          throw new TypeError('Invalid slot.');
        }

        const key = String(normalizedSlot);
        const value = patch.sourceMirrorOverrides[slotKey];

        if (value === null || value === undefined)
        {
          delete this._slotMirrorOv[key];
        }
        else
        {
          this._slotMirrorOv[key] = Boolean(value);
        }
      });
      needsMirrorPolicyRefresh = true;
      needsForceRender = true;
      shouldPreloadAiVBRenderAssets = true;
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'watermarks'))
    {
      await this._watermarkManager.setWatermarks(patch.watermarks);
      needsForceRender = true;
    }

    if (patch.clearWatermarks === true)
    {
      this._watermarkManager.clearWatermarks(patch.clearWatermarkFilter || null);
      needsForceRender = true;
    }

    if (needsMirrorPolicyRefresh)
    {
      if (shouldPreloadAiVBRenderAssets)
      {
        this._preloadSourceAiVBRenderAssets();
      }
      this._refreshFxRenderPolicy();
    }

    if (needsForceRender)
    {
      this._drawVideosToCanvas(undefined, true);
    }

    return this._getConfigStateSnapshot();
  }

  getState()
  {
    this._assertNotDestroyed('getState()');

    return {
      sources : this._sourceRegistry.getSnapshot(),
      config  : this._getConfigStateSnapshot(),
      render  : this._collectRenderInfo(false),
      audio   : this._collectAudioInfo(false),
      issues  : this.getIssues()
    };
  }

  async getOutput(options)
  {
    const request = this._normalizeOutputRequest(options);
    const type = request.type;

    logger.debug(`getOutput(): ${JSON.stringify(request)}`);
    this._assertNotDestroyed('getOutput()');

    if (type === 'video')
    {
      return this._getVideoOutputSync();
    }

    if (type === 'audio')
    {
      return this._audioComposer.getAudioStream(resolveAudioRequest(request));
    }

    if (type === 'mixed')
    {
      return this._getMixedOutput();
    }

    throw new TypeError('Invalid output type.');
  }

  releaseOutput(options)
  {
    const request = this._normalizeOutputRequest(options);

    logger.debug(`releaseOutput(): ${JSON.stringify(request)}`);
    this._assertNotDestroyed('releaseOutput()');

    if (request.type !== 'audio')
    {
      return false;
    }

    return this._audioComposer.releaseSubmixAudioStream(request);
  }

  /**
   * 返回当前所有源的快照。
   * 返回新对象数组，外部修改不影响内部状态。
   *
   * @returns {Array<Object>} 源信息列表：
   *   { id, streamId, slot, gain, sourceMirror, hasAudio, hasVideo }
   */
  getSources()
  {
    return this.getState().sources;
  }

  /**
   * 为指定 source 设置 AI 虚拟背景效果。
   *
   * @param {number|MediaStream|string} slotOrTarget - slot 编号或 Stream 对象
   * @param {boolean|Object|null} options - 效果配置（true=启用默认效果，Object=详细配置，false/null=禁用）
   * @returns {Object|null} 归一化后的效果配置快照
   */
  setSourceAiVirtualBackground(slotOrTarget, options)
  {
    this._assertNotDestroyed('setSourceAiVirtualBackground()');

    const source = this._resolveFxSource(slotOrTarget);

    this._sourceAiVBManager.setSourceConfig(source, options);
    this._refreshFxRenderPolicy();
    this._drawVideosToCanvas(undefined, true);

    return this._sourceAiVBManager.getSourceConfig(source);
  }

  /**
   * 获取指定 source 的 AI 虚拟背景配置快照。
   *
   * @param {number|MediaStream|string} slotOrTarget - slot 编号或 Stream 对象
   * @returns {Object|null} 效果配置快照
   */
  getSourceAiVirtualBackground(slotOrTarget)
  {
    this._assertNotDestroyed('getSourceAiVirtualBackground()');

    return this._sourceAiVBManager.getSourceConfig(this._resolveFxSource(slotOrTarget));
  }

  /**
   * 清除指定 source 的 AI 虚拟背景效果。
   *
   * 清除后立即刷新渲染器策略（可能从主线程切回 Worker 路径），并强制重绘一帧。
   *
   * @param {number|MediaStream|string} slotOrTarget - slot 编号或 Stream 对象
   */
  clearSourceAiVirtualBackground(slotOrTarget)
  {
    this._assertNotDestroyed('clearSourceAiVirtualBackground()');

    this._sourceAiVBManager.clearSourceConfig(this._resolveFxSource(slotOrTarget));
    this._refreshFxRenderPolicy();
    this._drawVideosToCanvas(undefined, true);
  }

  /**
   * 设置整体输出镜像（最终合成画面水平翻转，不改变各 source 自身镜像策略）。
   *
   * @param {boolean} enabled - true=开启输出镜像
   * @returns {Object} 更新后的配置快照
   */
  setMirror(enabled)
  {
    this._assertNotDestroyed('setMirror()');

    return this.setConfig({ outputMirror: enabled });
  }

  getMirror()
  {
    return this.getState().config.outputMirror;
  }

  /**
   * 设置输出镜像时水印是否同步镜像。
   * 默认开启；关闭后水印不受输出镜像影响（如二维码场景需要保持正向）。
   *
   * @param {boolean} enabled - true=水印随输出一起镜像
   * @returns {Object} 更新后的配置快照
   */
  setMirrorWatermarksWithOutput(enabled)
  {
    this._assertNotDestroyed('setMirrorWatermarksWithOutput()');

    return this.setConfig({ mirrorWatermarksWithOutput: enabled });
  }

  getMirrorWatermarksWithOutput()
  {
    return this.getState().config.mirrorWatermarksWithOutput;
  }

  /**
   * 设置 source 级别水平镜像。
   *
   * 两种调用方式：
   *   - setSourceMirror(true)  → 设置全局 source 镜像（所有无覆盖的 source 生效）
   *   - setSourceMirror(0, true) → 仅对 slot 0 设置镜像覆盖
   *
   * slot 级别覆盖优先级高于全局设置。
   *
   * @param {number|boolean} slotOrEnabled - slot 编号或全局镜像开关
   * @param {boolean} [enabled] - 当第一个参数是 slot 时，指定该 slot 的镜像状态
   * @returns {Object} 更新后的配置快照
   */
  setSourceMirror(slotOrEnabled, enabled)
  {
    this._assertNotDestroyed('setSourceMirror()');

    if (typeof slotOrEnabled === 'boolean' && enabled === undefined)
    { 
      return this.setConfig({ sourceMirror: slotOrEnabled });
    }

    return this.setConfig({
      sourceMirrorOverrides : {
        [slotOrEnabled] : enabled
      }
    });
  }

  getSourceMirror(slot)
  {
    this._assertNotDestroyed('getSourceMirror()');

    return this._getSourceMirrorLegacySnapshot(slot);
  }

  /**
   * 清除 source 级别水平镜像覆盖。
   *
   * 两种调用方式：
   *   - clearSourceMirror()  → 清除所有 slot 级别的覆盖，回退到全局设置
   *   - clearSourceMirror(0) → 仅清除 slot 0 的覆盖
   *
   * @param {number} [slot] - 要清除的 slot 编号
   * @returns {Object} 更新后的配置快照
   */
  clearSourceMirror(slot)
  {
    this._assertNotDestroyed('clearSourceMirror()');

    if (slot === undefined || slot === null)
    {
      return this.setConfig({ clearSourceMirrorOverrides: true });
    }

    return this.setConfig({
      sourceMirrorOverrides : {
        [slot] : null
      }
    });
  }

  /**
   * 根据 slot 编号或 Stream 对象解析对应的内部 source 对象。
   * 用于 setSourceAiVirtualBackground() / getSourceAiVirtualBackground() 等效果设置方法。
   *
   * @param {number|MediaStream|string} slotOrTarget - slot 编号或 Stream 对象
   * @returns {Object} 找到的内部 source 对象
   * @throws {TypeError} 未找到时抛出
   */
  _resolveFxSource(slotOrTarget)
  {
    const source = typeof slotOrTarget === 'number' ?
      this._sources.find((item) => item && item.slot === slotOrTarget) || null :
      this._findSource(slotOrTarget);

    if (!source)
    {
      throw new TypeError('Invalid source target.');
    }

    return source;
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
    this._assertNotDestroyed('getRenderInfo()');

    return this._collectRenderInfo();
  }

  /**
   * 返回当前音频混流状态。
   *
   * @returns {Object} 音频状态快照
   */
  getAudioInfo()
  {
    this._assertNotDestroyed('getAudioInfo()');

    return this._collectAudioInfo();
  }

  /**
   * 返回对外稳定的兼容性/降级报告。
   *
   * 用于把“当前走了哪条渲染路径、是否降级、音频是否已请求、可支持的最大 source 数”
   * 以正式结构暴露给业务层，而不是让调用方依赖内部日志。
   *
   * @returns {Object}
   */
  getCapabilityReport()
  {
    this._assertNotDestroyed('getCapabilityReport()');

    return {
      limits : {
        maxSources : MediaEffectsComposerConfig.getMaxSources()
      },
      features : {
        multiSource                 : MediaEffectsComposerConfig.getMaxSources() > 1,
        sourceAiVirtualBackground   : Boolean(this._config.hasSourceAiVirtualBackground),
        outputMirror                : true,
        audioSubmix                 : true,
        insertableStreamsConfigured : Boolean(this._config.enableInsertable)
      },
      render : this._collectRenderInfo(),
      audio  : this._collectAudioInfo()
    };
  }

  /**
   * 替换全部水印配置。
   *
   * @param {Array<Object>|Object|null} watermarks - 水印配置
   * @returns {Promise<Array<Object>>} 当前水印快照
   */
  setWatermarks(watermarks)
  {
    return this.setConfig({ watermarks })
      .then(() => this.getState().config.watermarks);
  }

  /**
   * 清除水印。
   *
   * @param {Object} [filter] - { id, target, slot, sourceId, streamId }
   */
  clearWatermarks(filter)
  {
    this._assertNotDestroyed('clearWatermarks()');

    return this.setConfig({
      clearWatermarks      : true,
      clearWatermarkFilter : filter
    });
  }

  /**
   * 获取当前水印状态快照。
   *
   * @returns {Array<Object>} 水印状态列表
   */
  getWatermarks()
  {
    return this.getState().config.watermarks;
  }

  /**
   * 获取合并了视频和音频的完整输出流。
   *
   * 流程：
   *   1. getVideoStream() → 启动 rAF 渲染循环 + 建立视频输出路径（优先 Insertable，回退 captureStream）
   *   2. 保存 mixedStream 引用，供后续 _ensureMixedAudio() 补充音频轨
   *   3. getAudioStream() → 初始化 AudioContext + 连接所有源的音频
   *   4. 将音频流的音轨添加到视频流
   *
   * @returns {Promise<MediaStream>} 包含视频轨和音频轨的混合流
   */
  async getMixedStream()
  {
    logger.debug('getMixedStream()');

    return this.getOutput({ type: 'mixed' });
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

    return this._getVideoOutputSync();
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
    const audioStream = await this._audioComposer.getAudioStream(options);

    logger.debug(`getAudioStream() resolved: tracks=${audioStream ? audioStream.getAudioTracks().length : 0}`);

    return audioStream;
  }

  /**
   * 获取独立 AudioContext 的 slots 子混音音频流。
   *
   * @param {Object|Array<number>} options - { slots:number[] } 或 slots 数组
   * @returns {Promise<MediaStream|null>} 子混音音频流
   */
  async getIsolatedSubmixAudioStream(options)
  {
    logger.debug(`getIsolatedSubmixAudioStream(): ${JSON.stringify(options || null)}`);
    const audioStream = await this.getOutput(Object.assign({ type: 'audio', isolated: true }, options instanceof Array ? { slots: options } : (options || {})));

    logger.debug(`getIsolatedSubmixAudioStream() resolved: tracks=${audioStream ? audioStream.getAudioTracks().length : 0}`);

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
    const released = this.releaseOutput(Object.assign({ type: 'audio' }, options instanceof Array ? { slots: options } : (options || {})));

    logger.debug(`releaseSubmixAudioStream() complete: released=${released}`);

    return released;
  }

  // -- Sources 委派 --
  get _sources()
  {
    return (this._sourceRegistry && this._sourceRegistry.sources) || [];
  }

  // -- RenderLoop 委派 --
  get _renderer()
  {
    return (this._renderLoop && this._renderLoop.renderer) || null;
  }

  get _isStopDrawingFrames()
  {
    return this._renderLoop ? this._renderLoop.isStopped : false;
  }

  // -- AudioMixer 委派 --
  get _audioSources()
  {
    return (this._audioComposer && this._audioComposer.audioSources) || [];
  }

  get _audioDestination()
  {
    return (this._audioComposer && this._audioComposer.audioDestination) || null;
  }

  get _audioContext()
  {
    return (this._audioComposer && this._audioComposer.audioContext) || null;
  }

  // -- OutputStream 委派 --
  get _capturedStreams()
  {
    return (this._outMgr && this._outMgr.capturedStreams) || [];
  }

  get _videoStream()
  {
    return (this._outMgr && this._outMgr.videoStream) || null;
  }
  // -- 旧版兼容别名 --
  appendStream(videos, optionsOrSlot)
  {
    return this.addSource(videos, optionsOrSlot);
  }

  removeStream(streamOrId)
  {
    return this.removeSource(streamOrId);
  }

  clearStreams()
  {
    this.clearSources();
  }
}

module.exports = MediaEffectsComposer;
