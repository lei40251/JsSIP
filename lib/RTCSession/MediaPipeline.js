const Logger = require('../Logger');
const Utils = require('../Utils');

const logger = new Logger('RTCSession');

/**
 * 延迟获取依赖，避免在测试进程里过早缓存真实实现。
 *
 * gulp 会把多组测试放在同一个 Node 进程中串行执行，如果这里在模块顶层直接 require，
 * 前面的测试一旦提前加载 RTCSession/MediaPipeline，后续测试再写 require.cache mock
 * 就接管不到了，最终会出现“单测单跑通过、整套 gulp 失败”的问题。
 */
function getMediaEffectsComposerCtor()
{
  return require('../MediaEffectsComposer');
}

function getAiNSEngineCtor()
{
  return require('../AINoiseSuppression/index.js');
}

function clonePlainObject(input)
{
  return input && typeof input === 'object' ? Object.assign({}, input) : {};
}

function normalizeComposerSourceList(composerOptions)
{
  const list = composerOptions && composerOptions.sources;

  if (!list)
  {
    return [];
  }

  if (list instanceof Array)
  {
    return list
      .filter((item) => item && typeof item === 'object')
      .map((item) => clonePlainObject(item));
  }

  if (typeof list === 'object')
  {
    return [ clonePlainObject(list) ];
  }

  return [];
}

/**
 * MediaPipeline — RTCSession 的媒体处理管线。
 *
 * ## 职责
 *
 * MediaPipeline 把会话中所有媒体加工步骤收敛到一个类里，按固定顺序编排：
 *
 * ```
 * getUserMedia 原始流
 *   → processMediaStream (外部注入预处理)
 *     → applyAiNoiseSuppressionOnSdkGumStream (AI 降噪)
 *       → applyMediaEffectsComposerOnSdkGumStream (视频合成/镜像/AiVB 等)
 *         → 最终发送流
 * ```
 *
 * 同时负责：
 * - AI 降噪引擎（AiNSEngine）的创建、复用、销毁；
 * - MediaEffectsComposer 的创建、输入切换、销毁；
 * - GUM 约束修正（关闭浏览器原生降噪，避免双重处理）；
 * - 移动端宽高交换等平台适配。
 *
 * ## 设计原则
 *
 * 1. **只持有 session 引用，不复制状态。**
 *    管线直接读写 `RTCSession` 实例上的 `_sessionAiNSEngine` / `_mediaEffectsComposer`
 *    等字段，避免单独设计状态同步层。
 *
 * 2. **任何加工失败都降级为透传原流。**
 *    降噪崩溃、composer 异常都不应阻断通话建立——catch 后返回原 `MediaStream`。
 *
 * 3. **停旧再启新，防止资源泄漏。**
 *    每次创建新引擎 / 新 composer 前都先调用对应的 `stop*` 方法清理旧实例。
 *
 * @class MediaPipeline
 */
module.exports = class MediaPipeline
{
  /**
   * @param {Object} session — RTCSession 实例引用。
   *        管线不复制 session 的任何字段，需要时直接读/写 `this._session.xxx`。
   */
  constructor(session)
  {
    // 这里不复制 session 状态，只持有引用。
    // 这样媒体管线能直接读写 RTCSession 当前会话态，同时避免再次设计状态同步层。
    this._session = session;
  }

  /**
   * 获取当前会话的 MediaEffectsComposer 实例（可能为 null）。
   * @returns {MediaEffectsComposer|null}
   */
  getMediaEffectsComposer()
  {
    return this._session._mediaEffectsComposer;
  }

  /**
   * 获取当前会话的 AI 降噪实例（可能为 null）。
   * @returns {AiNSEngine|null}
   */
  getAiNoiseSuppression()
  {
    return this._session._sessionAiNSEngine;
  }

  getAiVirtualBackground()
  {
    const session = this._session;
    const composer = session._mediaEffectsComposer;

    if (composer && typeof composer.getSourceAiVirtualBackground === 'function')
    {
      try
      {
        return composer.getSourceAiVirtualBackground(0);
      }
      catch (error)
      {}
    }

    const sources = normalizeComposerSourceList(session._sessionMediaEffectsComposerOptions);
    const sourceOptions = sources[0] || null;

    return sourceOptions && sourceOptions.aiVirtualBackground ? sourceOptions.aiVirtualBackground : null;
  }

  /**
   * 从 RTCSession 的入参 `options` 中提取 `mediaEffectsComposer` 配置。
   *
   * 这里只做字段提取，不做配置归一化或默认值合并，保持 RTCSession 现有入参语义不变。
   *
   * @param {Object} [options={}] — 会话创建/更新时传入的选项对象。
   * @returns {Object|null} — 提取到的 composer 配置，或 null 表示不启用 composer。
   */
  resolveMediaEffectsComposerOptions(options = {})
  {
    // 这里只负责从会话选项中提取 composer 配置，不做更激进的配置归一化，
    // 保持 RTCSession 现有入参语义不变。
    if (!options || typeof options !== 'object')
    {
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(options, 'mediaEffectsComposer'))
    {
      const composerOptions = options.mediaEffectsComposer || null;

      if (!composerOptions || typeof composerOptions !== 'object')
      {
        return composerOptions;
      }

      const normalized = Object.assign({}, composerOptions);
      const normalizedSources = normalizeComposerSourceList(composerOptions);

      if (normalizedSources.length > 0)
      {
        normalized.sources = normalizedSources;
      }

      return normalized;
    }

    return null;
  }

  /**
   * 执行外部注入预处理。
   *
   * `_mediaStreamProcessor` 是外部通过 `RTCSession` 注入的处理函数，
   * 签名为 `(MediaStream) => Promise<MediaStream>`。
   *
   * **失败降级策略：** 处理器抛异常时日志告警并返回原流，不阻断通话建立。
   *
   * @param {MediaStream} stream — 原始 getUserMedia 流。
   * @returns {Promise<MediaStream>} — 处理后的流（或原流，如果无处理器/处理失败）。
   */
  async processMediaStream(stream)
  {
    const session = this._session;

    logger.debug('_processMediaStream()');

    // mediaStreamProcessor 是外部注入能力，可能是美颜或其他视频预处理。
    // 失败时必须降级回原流，不能因为处理器异常影响通话建立。
    if (!session._mediaStreamProcessor)
    {
      return stream;
    }

    try
    {
      const nextStream = await session._mediaStreamProcessor(stream);

      return nextStream instanceof MediaStream ? nextStream : stream;
    }
    catch (error)
    {
      logger.warn(`${session._id} mediaStreamProcessor error:`, error);
    }

    return stream;
  }

  /**
   * 规范化 AI 降噪选项，统一各种入参形式为 `Object | null`。
   *
   * | 入参                      | 返回值    | 含义                   |
   * |---------------------------|-----------|------------------------|
   * | `undefined` / `null` / `false` | `null`    | 不启用 AI 降噪         |
   * | `true`                    | `{}`      | 启用，使用默认配置     |
   * | `{ enabled: false }`      | `null`    | 显式禁用               |
   * | `{ ... }` (其他对象)       | 浅拷贝副本 | 启用，使用传入配置     |
   *
   * @param {boolean|Object|undefined|null} aiNSOptions — AI 降噪原始选项。
   * @returns {Object|null} — 规范化后的选项对象，或 null 表示不启用。
   */
  normalizeSessionAiNSOptions(aiNSOptions)
  {
    if (aiNSOptions === undefined || aiNSOptions === null || aiNSOptions === false)
    {
      return null;
    }

    if (aiNSOptions === true)
    {
      return {};
    }

    if (typeof aiNSOptions === 'object' && aiNSOptions.enabled !== false)
    {
      return Object.assign({}, aiNSOptions);
    }

    return null;
  }

  /**
   * 停止当前会话的 AI 降噪引擎并释放相关资源。
   *
   * 执行顺序：
   * 1. 立即置空 session 上的引擎/输入流引用（上层可立即进入"已停止"状态）；
   * 2. 异步调用 `engine.destroy()` 释放底层 WASM/Worker 资源；
   * 3. 关闭输入流的所有 track。
   *
   * **注意：** 先断引用再异步销毁，避免并发路径（如快速切设备）读到旧引擎实例
   * 并重复操作。
   */
  stopSessionAiNoiseSuppression()
  {
    const session = this._session;
    const engine = session._sessionAiNSEngine;
    const aiNSInputStream = session._aiNSInputStream;

    // 先断开 session 上的引用，再异步销毁底层资源。
    // 这样上层可以立即进入"已停止"状态，避免并发路径重复操作旧实例。
    session._sessionAiNSEngine = null;
    session._aiNSInputStream = null;

    if (!engine || typeof engine.destroy !== 'function')
    {
      this.safeCloseMediaStream(aiNSInputStream, 'close ai noise suppression input stream failed');

      return;
    }

    Promise.resolve(engine.destroy())
      .then(() =>
      {
        this.safeCloseMediaStream(aiNSInputStream, 'close ai noise suppression input stream failed');
      })
      .catch((error) =>
      {
        logger.warn(`${session._id} destroy session ai noise suppression failed:`, error);
        this.safeCloseMediaStream(aiNSInputStream, 'close ai noise suppression input stream failed');
      });
  }

  /**
   * 对 getUserMedia 原始流执行 AI 降噪处理（完整初始化路径）。
   *
   * 内部流程：
   * 1. 规范化选项 → 无音轨或不启用则直接透传；
   * 2. 停止旧引擎（如果存在）；
   * 3. 创建新的 `AiNSEngine` 实例；
   * 4. 调用 `engine.process(stream)` 得到降噪后流；
   * 5. 记录输入流引用（用于后续 replaceAudioTrack 场景）。
   *
   * **失败降级：** catch 后停止引擎、返回原流。
   *
   * @param {MediaStream} stream — 待降噪的媒体流。
   * @param {boolean|Object} aiNSOptions — AI 降噪配置。
   * @returns {Promise<MediaStream>} — 降噪后的流（或原流，如果无音轨/处理失败）。
   */
  async applyAiNoiseSuppressionOnSdkGumStream(stream, aiNSOptions)
  {
    const session = this._session;

    logger.debug(`applyAiNoiseSuppressionOnSdkGumStream: ${JSON.stringify(aiNSOptions)}`);
    if (!stream || !(stream instanceof MediaStream))
    {
      return stream;
    }

    const normalizedOptions = this.normalizeSessionAiNSOptions(aiNSOptions);

    // 没有音轨时不进入 AI 降噪，直接透传。
    if (!normalizedOptions || !stream.getAudioTracks || stream.getAudioTracks().length === 0)
    {
      return stream;
    }

    try
    {
      this.stopSessionAiNoiseSuppression();
      const AiNSEngine = getAiNSEngineCtor();

      session._sessionAiNSEngine = new AiNSEngine(normalizedOptions);

      const processedStream = await session._sessionAiNSEngine.process(stream);

      session._aiNSInputStream = stream;

      return processedStream instanceof MediaStream ? processedStream : stream;
    }
    catch (error)
    {
      logger.warn(`${session._id} apply ai noise suppression failed:`, error);
      this.stopSessionAiNoiseSuppression();

      return stream;
    }
  }

  /**
   * 在已存在 AI 降噪引擎的情况下替换输入音轨（轻量路径）。
   *
   * 与 {@link applyAiNoiseSuppressionOnSdkGumStream} 的区别：
   * - 完整路径：新建引擎 → `engine.process(stream)`；
   * - 轻量路径：复用现有引擎 → `engine.replaceAudioTrack(stream)`，
   *   避免重新初始化 WASM 的开销（典型场景：通话中切换麦克风）。
   *
   * **降级链：**
   * - 引擎不存在 → 退化为完整初始化路径；
   * - replaceAudioTrack 失败 → 停止旧引擎 → 退化为完整初始化路径。
   *
   * @param {MediaStream} stream — 新音轨所在的媒体流。
   * @param {boolean|Object} [aiNSOptions=this._session._sessionAiNSOptions] — AI 降噪配置，
   *        默认使用会话当前配置。
   * @returns {Promise<MediaStream>} — 降噪后的流。
   */
  async replaceAudioTrackWithSessionAiNoiseSuppression(stream, aiNSOptions = this._session._sessionAiNSOptions)
  {
    const session = this._session;
    const normalizedOptions = this.normalizeSessionAiNSOptions(aiNSOptions);

    if (!normalizedOptions || !stream || !stream.getAudioTracks || stream.getAudioTracks().length === 0)
    {
      return stream;
    }

    try
    {
      if (!session._sessionAiNSEngine)
      {
        // 还没有引擎时，退化为完整初始化路径，保证行为一致。
        return await this.applyAiNoiseSuppressionOnSdkGumStream(stream, normalizedOptions);
      }

      const processedStream = await session._sessionAiNSEngine.replaceAudioTrack(stream);

      this.safeCloseMediaStream(session._aiNSInputStream, 'close previous ai noise suppression input stream failed');
      session._aiNSInputStream = stream;

      return processedStream instanceof MediaStream ? processedStream : stream;
    }
    catch (error)
    {
      logger.warn(`${session._id} replace audio track with ai noise suppression failed:`, error);
      this.stopSessionAiNoiseSuppression();

      return await this.applyAiNoiseSuppressionOnSdkGumStream(stream, normalizedOptions);
    }
  }

  /**
   * 修正 getUserMedia 约束，关闭浏览器原生降噪以避免双重处理。
   *
   * 当启用了自定义处理链路（AI 降噪 或 外部 mediaStreamProcessor 且要求关闭原生降噪）时，
   * 显式设置 `noiseSuppression: false`，避免浏览器原生降噪 + 自定义降噪同时生效
   * 导致声音发闷或延迟增大。
   *
   * **注意：** 仅当 `constraints.audio !== false` 且 `!== undefined` 时才修改 audio 约束，
   * 纯视频请求不受影响。
   *
   * @param {Object|boolean} constraints — 原始 getUserMedia 约束。
   * @param {boolean|Object|null} [aiNSOptions=null] — AI 降噪选项。
   * @returns {Object|boolean} — 修正后的约束（新对象，不修改原对象）。
   */
  getGumConstraintsWithProcessorFlags(constraints, aiNSOptions = null)
  {
    const session = this._session;
    const nextConstraints = Utils.cloneObject(constraints);

    if (!nextConstraints)
    {
      return nextConstraints;
    }

    if (
      (
        this.normalizeSessionAiNSOptions(aiNSOptions) ||
        (session._mediaStreamProcessor && session._mediaStreamProcessor.disableNativeNoiseSuppression)
      ) &&
      nextConstraints.audio !== false &&
      nextConstraints.audio !== undefined
    )
    {
      // 自定义处理链接管降噪时，显式关闭浏览器原生 noiseSuppression，
      // 避免双重处理导致声音发闷或延迟增大。
      nextConstraints.audio = nextConstraints.audio === true ?
        { noiseSuppression: false } :
        Object.assign({}, nextConstraints.audio, { noiseSuppression: false });
    }

    logger.debug(`nextConstraints: ${JSON.stringify(nextConstraints)}`);

    return nextConstraints;
  }

  /**
   * 构建 MediaEffectsComposer 构造选项，从视频轨设置中推导宽高/帧率。
   *
   * 推导优先级：
   * 1. 用户显式传入的 `width` / `height`（`composerOptions`）；
   * 2. 视频轨 `getSettings()` 返回的实际分辨率；
   * 3. `fps` 同理：用户传入 > 视频轨 frameRate。
   *
   * ## 移动端宽高交换
   *
   * 移动端（Android/iPhone/iPad）默认交换宽高，原因：
   * - 移动端前置摄像头通常以竖屏分辨率上报（如 480×640），
   *   但 composer 内部按横屏坐标系（width=水平, height=垂直）处理；
   * - 交换后保证输出画面方向正确。
   *
   * 可通过设置 `forceNoSwapWH: true` 禁用此行为（非移动端或特殊场景）。
   *
   * **注意：** `forceNoSwapWH` 仅用于推导，不会下传到 composer 构造参数中。
   *
   * @param {MediaStream} stream — 源媒体流（用于提取视频轨设置）。
   * @param {Object} [composerOptions={}] — 用户传入的 composer 配置。
   * @param {number} [composerOptions.width] — 期望输出宽度。
   * @param {number} [composerOptions.height] — 期望输出高度。
   * @param {number} [composerOptions.fps] — 期望输出帧率。
   * @param {boolean} [composerOptions.forceNoSwapWH] — 是否禁用移动端宽高交换。
   * @returns {Object} — MediaEffectsComposer 的构造选项。
   */
  buildMediaEffectsComposerCtorOptions(stream, composerOptions)
  {
    const options = Object.assign({}, composerOptions || {});
    const videoTrack = stream && stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
    const settings = videoTrack && videoTrack.getSettings ? (videoTrack.getSettings() || {}) : {};
    const widthFromSettings = Number(settings.width);
    const heightFromSettings = Number(settings.height);
    const widthFromOptions = Number(options.width);
    const heightFromOptions = Number(options.height);
    const frameRate = Number(settings.frameRate);
    const userAgent = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
    const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
    const forceNoSwapWH = Boolean(options.forceNoSwapWH);

    // forceNoSwapWH 只作为 RTCSession 侧推导参数使用，不传给 composer 本身。
    delete options.forceNoSwapWH;

    let normalizedWidth = Number.isFinite(widthFromOptions) && widthFromOptions > 0 ?
      widthFromOptions :
      widthFromSettings;
    let normalizedHeight = Number.isFinite(heightFromOptions) && heightFromOptions > 0 ?
      heightFromOptions :
      heightFromSettings;

    if (
      isMobileDevice &&
      !forceNoSwapWH &&
      Number.isFinite(normalizedWidth) &&
      Number.isFinite(normalizedHeight) &&
      normalizedWidth > 0 &&
      normalizedHeight > 0
    )
    {
      [ normalizedWidth, normalizedHeight ] = [ normalizedHeight, normalizedWidth ];
    }

    if (Number.isFinite(normalizedWidth) && normalizedWidth > 0)
    {
      options.width = Math.floor(normalizedWidth);
    }

    if (Number.isFinite(normalizedHeight) && normalizedHeight > 0)
    {
      options.height = Math.floor(normalizedHeight);
    }

    if (options.fps === undefined && Number.isFinite(frameRate) && frameRate > 0)
    {
      options.fps = Math.floor(frameRate);
    }

    return options;
  }

  /**
   * 停止当前会话的 MediaEffectsComposer 并释放相关资源。
   *
   * 执行顺序：
   * 1. 调用 `composer.stop()` 释放内部渲染资源（Canvas/WebGL 上下文等）；
   * 2. 关闭 composer 输入流的所有 track；
   * 3. 置空 session 上的 composer/inputStream 引用。
   *
   * **注意：** `composer.stop()` 只释放内部资源，外部输入流仍需显式关闭。
   */
  stopSessionMediaEffectsComposer(options)
  {
    options = options || {};
    const session = this._session;
    const composerInputStream = session._mediaEffectsComposerInputStream;
    const preserveInputStream = options.preserveInputStream === true;

    if (!session._mediaEffectsComposer)
    {
      session._mediaEffectsComposer = null;
      if (!preserveInputStream)
      {
        this.safeCloseMediaStream(composerInputStream, 'close composer input stream failed');
      }
      session._mediaEffectsComposerInputStream = null;

      return;
    }

    // composer.stop() 只释放内部渲染资源，外部输入流仍需 RTCSession 显式关闭。
    this.safeStopMediaEffectsComposer(session._mediaEffectsComposer, 'stop composer failed');
    if (!preserveInputStream)
    {
      this.safeCloseMediaStream(composerInputStream, 'close composer input stream failed');
    }

    session._mediaEffectsComposer = null;
    session._mediaEffectsComposerInputStream = null;
  }

  /**
   * 安全停止 MediaEffectsComposer（静默吞掉异常）。
   *
   * @param {MediaEffectsComposer|null} composer — composer 实例。
   * @param {string} message — 失败时的日志前缀。
   */
  safeStopMediaEffectsComposer(composer, message)
  {
    const session = this._session;

    if (!composer)
    {
      return;
    }

    try
    {
      if (typeof composer.stop === 'function')
      {
        composer.stop();
      }
    }
    catch (error)
    {
      logger.warn(`${session._id} ${message}: ${error && error.message ? error.message : error}`);
    }
  }

  /**
   * 安全关闭 MediaStream（停止所有 track 并释放）。
   *
   * @param {MediaStream|null} stream — 待关闭的媒体流。
   * @param {string} message — 失败时的日志前缀。
   */
  safeCloseMediaStream(stream, message)
  {
    const session = this._session;

    if (!stream)
    {
      return;
    }

    try
    {
      Utils.closeMediaStream(stream);
    }
    catch (error)
    {
      logger.warn(`${session._id} ${message}: ${error && error.message ? error.message : error}`);
    }
  }

  /**
   * 对 getUserMedia 原始流执行 MediaEffectsComposer 视频合成。
   *
   * 内部流程：
   * 1. 调用 {@link buildMediaEffectsComposerCtorOptions} 推导构造参数；
   * 2. 停止旧 composer（如果存在）；
   * 3. 创建新的 `MediaEffectsComposer` 实例；
   * 4. 获取合成后的视频轨；
   * 5. **仅替换视频轨**，保留原始音轨不变——音频混音职责不属于 MediaEffectsComposer。
   *
   * **失败降级：** catch 后清理 composer、返回原流。
   *
   * @param {MediaStream} stream — 源媒体流。
   * @param {Object} composerOptions — composer 配置。
   * @returns {Promise<MediaStream>} — 合成后的流（视频轨替换为 composer 输出 + 原始音轨），
   *          或原流（如果无视频轨/处理失败）。
   */
  async applyMediaEffectsComposerOnSdkGumStream(stream, composerOptions, runtimeOptions)
  {
    const session = this._session;
    const options = runtimeOptions || {};

    logger.debug(`applyMediaEffectsComposerOnSdkGumStream: ${JSON.stringify(composerOptions)}`);
    if (!stream || !composerOptions || !(stream instanceof MediaStream))
    {
      return stream;
    }

    if (!stream.getVideoTracks || stream.getVideoTracks().length === 0)
    {
      return stream;
    }

    const composerCtorOptions = this.buildMediaEffectsComposerCtorOptions(stream, composerOptions);
    let composer = null;

    logger.debug(`composerCtorOptions: ${JSON.stringify(composerCtorOptions)}`);
    try
    {
      this.stopSessionMediaEffectsComposer({
        preserveInputStream : options.preserveExistingComposerInputStream === true
      });
      const MediaEffectsComposer = getMediaEffectsComposerCtor();

      composer = new MediaEffectsComposer([ stream ], composerCtorOptions);

      const mixedVideoStream = await composer.getOutput({ type: 'video' });
      const mixedVideoTrack = mixedVideoStream && mixedVideoStream.getVideoTracks ?
        mixedVideoStream.getVideoTracks()[0] :
        null;

      if (!mixedVideoTrack)
      {
        throw new Error('composer output has no video track');
      }

      const mixedStream = new MediaStream();

      // 保留原始音轨，只替换视频轨为 composer 输出轨。
      // 这样不会把音频混音职责错误地耦合到 MediaEffectsComposer。
      stream.getAudioTracks && stream.getAudioTracks().forEach((track) =>
      {
        mixedStream.addTrack(track, mixedStream);
      });
      mixedVideoTrack.contentHint = 'detail';
      mixedStream.addTrack(mixedVideoTrack, mixedStream);

      session._mediaEffectsComposer = composer;
      session._mediaEffectsComposerInputStream = stream;

      return mixedStream;
    }
    catch (error)
    {
      logger.warn(`${session._id} apply composer failed:`, error);
      this.safeStopMediaEffectsComposer(composer, 'composer stop after apply failure failed');

      session._mediaEffectsComposer = null;
      session._mediaEffectsComposerInputStream = null;

      return stream;
    }
  }

  /**
   * 媒体管线统一入口：按固定顺序执行完整的媒体处理链路。
   *
   * ## 处理顺序
   *
   * ```
   * ┌─────────────────────────────────────────────────────────────┐
   * │ 1. getGumConstraintsWithProcessorFlags(constraints, aiNS)    │
   * │    └─ 修正 GUM 约束（关闭浏览器原生降噪避免双重处理）       │
   * │                                                             │
   * │ 2. navigator.mediaDevices.getUserMedia(gumConstraints)       │
   * │    └─ 获取原始媒体流                                        │
   * │                                                             │
   * │ 3. processMediaStream(stream)                               │
   * │    └─ 外部注入预处理                                        │
   * │                                                             │
   * │ 4. applyAiNoiseSuppressionOnSdkGumStream(stream, aiNS)       │
   * │    └─ AI 降噪处理                                           │
   * │                                                             │
   * │ 5. applyMediaEffectsComposerOnSdkGumStream(stream, composer)  │
   * │    └─ 视频合成（镜像/画中画/AiVB 等）                       │
   * └─────────────────────────────────────────────────────────────┘
   * ```
   *
   * 每一步失败都降级透传原流，不会阻断整体管线。
   *
   * @param {Object|boolean} constraints — getUserMedia 约束。
   * @param {Object} composerOptions — MediaEffectsComposer 配置。
   * @param {boolean|Object} [aiNSOptions=this._session._sessionAiNSOptions] — AI 降噪配置，
   *        默认使用会话当前配置。
   * @returns {Promise<MediaStream>} — 经过完整管线处理的最终媒体流。
   */
  async getUserMediaWithSessionPipeline(constraints, composerOptions, aiNSOptions = this._session._sessionAiNSOptions)
  {
    // 统一入口顺序：
    // 1. 修正 GUM 约束
    // 2. 执行外部注入预处理
    // 3. 执行 AI 降噪
    // 4. 执行 MediaEffectsComposer 合成
    const gumConstraints = this.getGumConstraintsWithProcessorFlags(constraints, aiNSOptions);
    const stream = await navigator.mediaDevices.getUserMedia(gumConstraints);
    const processedStream = await this.processMediaStream(stream);
    const aiNoiseSuppressedStream = await this.applyAiNoiseSuppressionOnSdkGumStream(processedStream, aiNSOptions);

    return await this.applyMediaEffectsComposerOnSdkGumStream(aiNoiseSuppressedStream, composerOptions);
  }
};
