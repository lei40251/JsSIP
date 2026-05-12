const Logger = require('./Logger');
const RendererFactory = require('./mixer-renderer/RendererFactory');
const logger = new Logger('MediaStreamMixer');

/**
 * MediaStreamMixer — 多路音视频混流器
 *
 * 功能：
 *   - 将多个 MediaStream / HTMLVideoElement 合并为一个 MediaStream
 *   - 视频：按浏览器能力使用 Worker WebGL2 / 主线程 WebGL2 / Worker Canvas2D / 主线程 Canvas2D 绘制
 *   - 音频：用 WebAudio API，每路独立 GainNode 控制音量，汇总到 MediaStreamAudioDestinationNode
 *
 * 两种布局模式：
 *   - legacy：固定 640x480 单元格，最多 2x2，向后兼容旧版调用方
 *   - grid：按 slot 和输出画布比例自动计算网格，支持动态增减
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
   *     - HTMLVideoElement：外部 video 元素（mixer 不接管生命周期）
   *     - { mediaStream: MediaStream }：SDK 内部包装对象
   * @param {Object} [options]
   *   混流配置。只要传入 width/height/fps/layoutMode/backgroundColor/audioGain 中任意一项，
   *   默认进入新版 grid 布局；完全不传配置时保持旧版 640x480 单元、最多 2x2 的行为。
   * @param {number} [options.width=1280]  - 输出视频宽度（grid 模式默认 1280，legacy 模式动态）
   * @param {number} [options.height=720]  - 输出视频高度（grid 模式默认 720，legacy 模式动态）
   * @param {number} [options.fps]         - 输出帧率（不传则浏览器自动选择）
   * @param {string} [options.backgroundColor='#000'] - 画布背景色
   * @param {number} [options.audioGain=0.8] - 全局默认音量增益
   * @param {string} [options.layoutMode]  - 'grid' | 'legacy'
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

    /** @type {number} 内部 ID 自增计数器，当 MediaStream.id 冲突时追加序号 */
    this._sourceSeq = 0;

    /**
     * @type {Array<Object>} 统一内部数据结构，每个元素包含：
     *   {string}  id              - 唯一标识（优先用 MediaStream.id）
     *   {MediaStream} stream      - 当前关联的 MediaStream
     *   {HTMLVideoElement} video  - 用于绘制到 canvas 的 video 元素
     *   {number|null} slot        - grid 模式下的位置编号
     *   {number} gain             - 该路的音量增益
     *   {MediaStreamSourceNode|null} audioSourceNode - WebAudio 源节点
     *   {GainNode|null} gainNode  - 该路的音量控制节点
     *   {MediaStream|null} audioStream - 已连接音频的流引用（用于换源检测）
     *   {boolean} ownedVideo      - true=mixer 创建的隐藏 video；false=外部传入的元素
     */
    this._sources = [];

    /**
     * @type {Array<HTMLVideoElement>}
     * 仅用于旧版兼容：外部代码如果只读 _videos，仍能看到当前参与混流的 video 元素。
     * 通过 _syncVideos() 与 _sources 保持同步。
     */
    this._videos = [];

    // -----------------------------------------------------------------------
    // 布局模式与渲染控制
    // -----------------------------------------------------------------------

    /**
     * 检测是否显式传了新版配置项。
     * 避免旧项目无感升级后输出分辨率变化。
     * @type {boolean}
     */
    this._hasModernOptions = this._hasMixerOptions(options);

    /**
     * @type {boolean} 调用方是否显式选择了渲染后端。
     * 用于区分“旧调用默认 main-2d”和“后续 slot 升级后可自动选择高性能后端”。
     */
    this._hasExplicitRenderMode = Object.prototype.hasOwnProperty.call(options, 'renderMode');

    /**
     * @type {string} 布局模式：'legacy' | 'grid'
     * - legacy：旧版固定宫格，画布尺寸动态
     * - grid：新版 slot 网格，画布固定
     */
    this._layoutMode = options.layoutMode || (this._hasModernOptions ? 'grid' : 'legacy');

    /** @type {boolean} 停止绘制标记；设为 true 时 rAF 回调直接返回 */
    this._isStopDrawingFrames = false;

    /** @type {number|null} requestAnimationFrame 返回的 ID，用于 cancel */
    this._animationId = null;

    // -----------------------------------------------------------------------
    // WebAudio 相关
    // -----------------------------------------------------------------------

    /** @type {Array<MediaStreamSourceNode>} 所有已连接的音频源节点（用于调试/清理） */
    this._audioSources = [];

    /** @type {MediaStreamAudioDestinationNode|null} 音频汇总目标节点 */
    this._audioDestination = null;

    /** @type {AudioContext|null} WebAudio 上下文（延迟到 getAudioStream() 才创建） */
    this._audioContext = null;

    /**
     * @type {MediaStream|null}
     * getMixedStream() 已返回的流。后续 append 有音频源时，
     * 通过 _ensureMixedStreamAudioTrack() 把 destination 的音频轨补进去。
     */
    this._mixedStream = null;

    /**
     * @type {Array<MediaStream>}
     * canvas.captureStream() 产生的流列表，stop() 时统一停止 tracks。
     */
    this._capturedStreams = [];

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
    this._config = {
      width                 : this._normalizePositiveInteger(options.width, this._layoutMode === 'legacy' ? null : 1280),
      height                : this._normalizePositiveInteger(options.height, this._layoutMode === 'legacy' ? null : 720),
      fps                   : this._normalizePositiveInteger(options.fps, null),
      backgroundColor       : options.backgroundColor || '#000',
      audioGain             : this._normalizeGain(options.audioGain, 0.8),
      renderMode            : this._normalizeRenderMode(options.renderMode, this._layoutMode === 'legacy' ? 'main-2d' : 'auto'),
      workerUrl             : typeof options.workerUrl === 'string' ? options.workerUrl : null,
      dropFrameWhenBusy     : options.dropFrameWhenBusy === false ? false : true,
      maxFrameQueue         : this._normalizePositiveInteger(options.maxFrameQueue, 1),
      preserveDrawingBuffer : options.preserveDrawingBuffer === false ? false : true
    };

    // -----------------------------------------------------------------------
    // 渲染画布
    // -----------------------------------------------------------------------

    /** @type {HTMLCanvasElement} 离屏 canvas，所有视频帧合成到这里 */
    this._canvas = document.createElement('canvas');

    /**
     * @type {BaseRenderer|null}
     * 渲染后端延迟到第一次 getVideoStream()/getMixedStream() 时创建。
     * 这样可以按 renderMode 决定是拿 2D、WebGL2，还是创建 Worker 的独立 OffscreenCanvas。
     */
    this._renderer = null;

    this._canvas.setAttribute('style', 'display:none');

    // grid 模式预置 canvas 尺寸
    if (this._layoutMode !== 'legacy')
    {
      this._prepareModernCanvas();
    }

    // -- 将初始传入的源加入混流 --
    this.appendStream(videos);
  }

  // =========================================================================
  //  配置检测与参数归一化
  // =========================================================================

  /**
   * 检测 options 中是否显式包含新版混流配置项。
   * 这是为了避免旧项目在升级后无感切换到 grid 模式，导致输出分辨率变化。
   *
   * @param {Object} options - 用户传入的配置对象
   * @returns {boolean} true=调用方明确传了混流配置
   */
  _hasMixerOptions(options)
  {
    return Boolean(
      options &&
      (
        Object.prototype.hasOwnProperty.call(options, 'width') ||
        Object.prototype.hasOwnProperty.call(options, 'height') ||
        Object.prototype.hasOwnProperty.call(options, 'fps') ||
        Object.prototype.hasOwnProperty.call(options, 'layoutMode') ||
        Object.prototype.hasOwnProperty.call(options, 'backgroundColor') ||
        Object.prototype.hasOwnProperty.call(options, 'audioGain') ||
        Object.prototype.hasOwnProperty.call(options, 'renderMode') ||
        Object.prototype.hasOwnProperty.call(options, 'workerUrl') ||
        Object.prototype.hasOwnProperty.call(options, 'dropFrameWhenBusy') ||
        Object.prototype.hasOwnProperty.call(options, 'maxFrameQueue') ||
        Object.prototype.hasOwnProperty.call(options, 'preserveDrawingBuffer')
      )
    );
  }

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
    const validModes = {
      auto            : true,
      'worker-webgl2' : true,
      'main-webgl2'   : true,
      'worker-2d'     : true,
      'main-2d'       : true
    };

    if (typeof value === 'string' && validModes[value])
    {
      return value;
    }

    return fallback || 'auto';
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
    const numberValue = Number(value);

    if (Number.isFinite(numberValue) && numberValue > 0)
    {
      return Math.floor(numberValue);
    }

    return fallback;
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
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue))
    {
      return null;
    }

    return Math.max(0, Math.floor(numberValue)) + index;
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
    const numberValue = Number(value);

    if (Number.isFinite(numberValue) && numberValue >= 0)
    {
      return numberValue;
    }

    return fallback;
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
    const options = {};

    if (typeof optionsOrSlot === 'number')
    {
      options.slot = this._normalizeSlot(optionsOrSlot, index);
    }
    else if (optionsOrSlot && typeof optionsOrSlot === 'object')
    {
      if (typeof optionsOrSlot.slot === 'number')
      {
        options.slot = this._normalizeSlot(optionsOrSlot.slot, index);
      }

      if (typeof optionsOrSlot.gain === 'number')
      {
        options.gain = this._normalizeGain(optionsOrSlot.gain, this._config.audioGain);
      }
    }

    return options;
  }

  // =========================================================================
  //  布局模式管理
  // =========================================================================

  /**
   * 将 legacy 实例升级为 grid 模式。
   * 旧实例一旦使用 slot 添加源，就升级为新版 grid 布局。
   * 这是 appendStream(stream, slot) 的隐式语义。
   *
   * 副作用：修改 _layoutMode、_config.width/height、重置 canvas 尺寸。
   */
  _ensureModernLayout()
  {
    if (this._layoutMode !== 'legacy')
    {
      return;
    }

    this._layoutMode = 'grid';
    this._config.width = this._config.width || 1280;
    this._config.height = this._config.height || 720;

    // 旧调用如果在启动前通过 appendStream(stream, slot) 进入新版 slot 模式，
    // 且调用方没有显式指定 renderMode，则允许使用 auto 后端选择。
    if (!this._hasExplicitRenderMode && !this._renderer)
    {
      this._config.renderMode = 'auto';
    }

    this._prepareModernCanvas();
  }

  /**
   * 设置 grid 模式的固定输出画布尺寸。
   * 与 legacy 模式不同，grid 模式下画布尺寸恒定不变。
   */
  _prepareModernCanvas()
  {
    const width = this._config.width || 1280;
    const height = this._config.height || 720;

    // 只有尺寸真正变化时才设置 canvas.width/height。
    // 浏览器在设置 canvas 尺寸时会清空画布；Worker 路径是异步回写，若每帧都清空就会明显闪烁。
    if (this._canvas.width !== width)
    {
      this._canvas.width = width;
    }

    if (this._canvas.height !== height)
    {
      this._canvas.height = height;
    }
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
    if (!this._renderer)
    {
      this._renderer = RendererFactory.createRenderer(this._canvas, this._config);
    }

    return this._renderer;
  }

  /**
   * 将当前输出画布尺寸同步给 renderer。
   *
   * @param {number} width - 输出宽度
   * @param {number} height - 输出高度
   */
  _resizeRenderer(width, height)
  {
    if (this._renderer)
    {
      this._renderer.resize(width, height);
    }
  }

  /**
   * 同步 _videos 数组，用于旧版兼容。
   * 外部代码如果只读 _videos，仍能看到当前参与混流的 video 元素。
   */
  _syncVideos()
  {
    this._videos = this._sources.map((source) => source.video);
  }

  // =========================================================================
  //  源标识与创建
  // =========================================================================

  /**
   * 生成唯一 source ID。
   * 优先使用 MediaStream.id，便于外部用 removeStream(stream.id) 移除；
   * 重复 id 时追加序号避免内部冲突。
   *
   * @param {MediaStream|null} stream - 媒体流
   * @param {HTMLVideoElement} video - video 元素
   * @returns {string} 唯一的 source ID
   */
  _createSourceId(stream, video)
  {
    const baseId = (stream && stream.id) || video.id || `mixer-source-${this._sourceSeq + 1}`;
    let sourceId = baseId;

    while (this._sources.some((source) => source.id === sourceId))
    {
      this._sourceSeq += 1;
      sourceId = `${baseId}-${this._sourceSeq}`;
    }

    return sourceId;
  }

  /**
   * 创建内部 source 对象。
   * 根据输入类型决定是否创建隐藏 video 元素：
   *   - HTMLMediaElement：直接引用外部元素，不接管生命周期
   *   - 其他（MediaStream / { mediaStream }）：创建隐藏 <video autoplay muted>
   *
   * @param {MediaStream|HTMLMediaElement|Object} input - 输入源
   * @param {Object} options - { slot, gain } 归一化后的选项
   * @returns {Object} source 对象（结构见 _sources 的 @type 注释）
   * @throws {TypeError} 无效 MediaStream
   */
  _createSource(input, options)
  {
    let video;
    let stream;
    let ownedVideo = false;

    if (input instanceof HTMLMediaElement)
    {
      // 调用方传 HTMLVideoElement 时不接管元素生命周期，只读取其 srcObject 并在绘制时跟随变化。
      video = input;
      stream = input.srcObject;
    }
    else
    {
      // 支持 SDK 内部常见包装对象 { mediaStream }，也支持原生 MediaStream。
      stream = input && (input.mediaStream || input);

      if (!stream)
      {
        throw new TypeError('Invalid MediaStream.');
      }

      video = this._mediaStreamToVideoElement(stream);
      ownedVideo = true;
    }

    const source = {
      id              : this._createSourceId(stream, video),
      stream          : stream,
      video           : video,
      slot            : typeof options.slot === 'number' ? options.slot : null,
      gain            : this._normalizeGain(options.gain, this._config.audioGain),
      audioSourceNode : null,
      gainNode        : null,
      audioStream     : null,
      ownedVideo      : ownedVideo
    };

    // grid 模式下未指定 slot → 自动分配第一个空位
    if (this._layoutMode !== 'legacy' && source.slot === null)
    {
      source.slot = this._getNextSlot();
    }

    return source;
  }

  /**
   * 查找第一个未被占用的 slot 编号。
   * 从 0 开始递增，跳过已被现有 source 占用的 slot。
   *
   * @returns {number} 第一个空闲 slot
   */
  _getNextSlot()
  {
    let slot = 0;
    const occupiedSlots = this._sources.reduce((slots, source) =>
    {
      if (typeof source.slot === 'number')
      {
        slots[source.slot] = true;
      }

      return slots;
    }, {});

    while (occupiedSlots[slot])
    {
      slot += 1;
    }

    return slot;
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
    if (!source)
    {
      return false;
    }

    // 先断开 WebAudio 节点连接，避免音频残留
    this._disconnectAudio(source);

    if (source.ownedVideo && source.video)
    {
      // 只有 Mixer 自己创建的隐藏 video 才会释放；外部传入的 HTMLMediaElement 不做 pause/remove。
      source.video.pause();
      source.video.srcObject = null;
      source.video.remove();
    }

    this._sources = this._sources.filter((item) => item !== source);
    this._syncVideos();

    if (this._renderer)
    {
      this._renderer.removeSource(source.id);
    }

    return true;
  }

  /**
   * 按 MediaStream 对象、stream.id 或内部 source.id 查找 source。
   *
   * @param {MediaStream|string|HTMLVideoElement} streamOrId - 查找依据
   * @returns {Object|null} 找到的 source 对象，或 null
   */
  _findSource(streamOrId)
  {
    if (!streamOrId)
    {
      return null;
    }

    // 按字符串 ID 查找（source.id 或 stream.id）
    if (typeof streamOrId === 'string')
    {
      return this._sources.find((source) =>
      {
        const stream = this._getSourceStream(source);

        return source.id === streamOrId || (stream && stream.id === streamOrId);
      }) || null;
    }

    // 按对象引用查找（MediaStream 或 HTMLVideoElement）
    const stream = streamOrId.mediaStream || streamOrId;

    return this._sources.find((source) =>
    {
      return source.stream === stream || source.video === streamOrId;
    }) || null;
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
    const stream = this._getSourceStream(source);

    return Boolean(
      stream &&
      stream.getAudioTracks &&
      stream.getAudioTracks().some((track) => track.readyState === 'live')
    );
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
    const stream = this._getSourceStream(source);

    return Boolean(
      stream &&
      stream.getVideoTracks &&
      stream.getVideoTracks().length > 0
    );
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
    const stream = this._getSourceStream(source);

    return Boolean(
      stream &&
      stream.active &&
      this._hasVideoTrack(source)
    );
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
    const stream = source.video && source.video.srcObject ? source.video.srcObject : source.stream;

    if (stream && source.stream !== stream)
    {
      source.stream = stream;
    }

    return stream;
  }

  // =========================================================================
  //  视频缩放计算
  // =========================================================================

  /**
   * 计算视频等比缩放后的尺寸和居中偏移量。
   *
   * 缩放策略：始终按比例缩放，取能填满目标单元格的缩放比
   * （按较宽边对齐，短边居中留黑边）。
   *
   * @param {number} width       - 原始视频宽度（video.videoWidth）
   * @param {number} height      - 原始视频高度（video.videoHeight）
   * @param {number} [targetWidth=640]  - 目标单元格宽度
   * @param {number} [targetHeight=480] - 目标单元格高度
   * @returns {Object|null} 缩放结果：{ width, height, offsetX, offsetY }，无效输入返回 null
   */
  _scaleVideo(width, height, targetWidth = 640, targetHeight = 480)
  {
    let newWidth;
    let newHeight;
    let scale;

    if (!width || !height)
    {
      return null;
    }

    // 以宽高比决定缩放基准边
    if (width / height >= targetWidth / targetHeight)
    {
      // 视频更宽（或等比例）→ 以宽度为基准，高度等比缩放（上下留黑边）
      scale = targetWidth / width;
      newHeight = height * scale;
      newWidth = targetWidth;
    }
    else
    {
      // 视频更高 → 以高度为基准，宽度等比缩放（左右留黑边）
      scale = targetHeight / height;
      newWidth = width * scale;
      newHeight = targetHeight;
    }

    // 居中偏移量（当缩放后尺寸小于目标尺寸时有效）
    const offsetX = Math.max(0, (targetWidth - newWidth) / 2);
    const offsetY = Math.max(0, (targetHeight - newHeight) / 2);

    return {
      width   : newWidth,
      height  : newHeight,
      offsetX : offsetX,
      offsetY : offsetY
    };
  }

  // =========================================================================
  //  布局计算（grid 模式）
  // =========================================================================

  /**
   * 根据当前所有 source 的 slot 计算网格行列数。
   * 布局按最大 slot 计算，而不只是按源数量计算。
   * 例如只占用 slot 8，也应显示 3x3，让 slot 8 落在右下角。
   *
   * @returns {Object} { cols: number, rows: number }
   */
  _calcLayout()
  {
    let maxSlot = -1;

    this._sources.forEach((source) =>
    {
      if (typeof source.slot === 'number' && source.slot > maxSlot)
      {
        maxSlot = source.slot;
      }
    });

    const count = Math.max(maxSlot + 1, this._sources.length, 1);
    const isPortrait = this._canvas.height > this._canvas.width;
    let cols = 1;
    let rows = 1;

    if (count <= 1)
    {
      cols = 1;
      rows = 1;
    }
    else if (count <= 2)
    {
      if (isPortrait)
      {
        cols = 1;
        rows = 2;
      }
      else
      {
        cols = 2;
        rows = 1;
      }
    }
    else if (count <= 4)
    {
      cols = 2;
      rows = 2;
    }
    else if (count <= 6)
    {
      if (isPortrait)
      {
        cols = 2;
        rows = 3;
      }
      else
      {
        cols = 3;
        rows = 2;
      }
    }
    else if (count <= 9)
    {
      cols = 3;
      rows = 3;
    }
    else
    {
      // 超过 9 路时使用通用算法：尽可能接近正方形
      cols = Math.ceil(Math.sqrt(count));
      rows = Math.ceil(count / cols);
    }

    return { cols, rows };
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
    if (this._layoutMode !== 'legacy')
    {
      return this._createModernRenderPayload();
    }

    return this._createLegacyRenderPayload();
  }

  /**
   * legacy 模式 payload。
   * 继续保持旧版 640x480 单元格、最多两列、>=3 路时两行的画布尺寸规则。
   *
   * @returns {Object} 渲染 payload
   */
  _createLegacyRenderPayload()
  {
    const renderSources = this._sources.filter((source) => this._isRenderable(source));
    let rowCount = 1;

    if (renderSources.length >= 3)
    {
      rowCount = 2;
    }

    const canvasWidth = renderSources.length >= 2 ? 1280 : 640;
    const canvasHeight = 480 * rowCount;

    if (this._canvas.width !== canvasWidth)
    {
      this._canvas.width = canvasWidth;
    }

    if (this._canvas.height !== canvasHeight)
    {
      this._canvas.height = canvasHeight;
    }

    this._resizeRenderer(canvasWidth, canvasHeight);

    const items = [];

    renderSources.forEach((source, idx) =>
    {
      const draw = this._calcDrawRect(source.video, (idx % 2) * 640, Math.floor(idx / 2) * 480, 640, 480);

      if (draw)
      {
        items.push({
          id    : source.id,
          slot  : source.slot,
          video : source.video,
          draw  : draw
        });
      }
    });

    return {
      width           : canvasWidth,
      height          : canvasHeight,
      backgroundColor : this._config.backgroundColor,
      items           : items
    };
  }

  /**
   * grid 模式 payload。
   * 按 slot 计算 1/2/4/6/9 宫格，并根据输出横竖屏决定 2 路、6 路的排列方向。
   *
   * @returns {Object} 渲染 payload
   */
  _createModernRenderPayload()
  {
    this._prepareModernCanvas();
    this._resizeRenderer(this._canvas.width, this._canvas.height);

    const layout = this._calcLayout();
    const cellWidth = this._canvas.width / layout.cols;
    const cellHeight = this._canvas.height / layout.rows;
    const items = [];

    this._sources.forEach((source) =>
    {
      if (!this._isRenderable(source))
      {
        return;
      }

      const slot = typeof source.slot === 'number' ? source.slot : 0;
      const col = slot % layout.cols;
      const row = Math.floor(slot / layout.cols);
      const targetX = col * cellWidth;
      const targetY = row * cellHeight;
      const draw = this._calcDrawRect(source.video, targetX, targetY, cellWidth, cellHeight);

      if (draw)
      {
        items.push({
          id    : source.id,
          slot  : slot,
          video : source.video,
          draw  : draw
        });
      }
    });

    return {
      width           : this._canvas.width,
      height          : this._canvas.height,
      backgroundColor : this._config.backgroundColor,
      items           : items
    };
  }

  /**
   * 计算某个 video 在目标单元格中的 contain 绘制矩形。
   *
   * @param {HTMLVideoElement} video - 输入视频元素
   * @param {number} targetX - 单元格左上角 x
   * @param {number} targetY - 单元格左上角 y
   * @param {number} targetWidth - 单元格宽
   * @param {number} targetHeight - 单元格高
   * @returns {Object|null} { x, y, width, height }
   */
  _calcDrawRect(video, targetX, targetY, targetWidth, targetHeight)
  {
    const newVideo = this._scaleVideo(video.videoWidth, video.videoHeight, targetWidth, targetHeight);

    if (!newVideo || !newVideo.width || !newVideo.height)
    {
      return null;
    }

    return {
      x      : targetX + newVideo.offsetX,
      y      : targetY + newVideo.offsetY,
      width  : newVideo.width,
      height : newVideo.height
    };
  }

  // =========================================================================
  //  主渲染循环（rAF）
  // =========================================================================

  /**
   * requestAnimationFrame 回调 — 每帧执行一次。
   * 根据 _layoutMode 分发到 legacy 或 grid 绘制方法。
   * 绘制完成后根据是否有源决定是否调度下一帧。
   */
  _drawVideosToCanvas()
  {
    if (this._isStopDrawingFrames)
    {
      return;
    }

    const payload = this._createRenderPayload();

    this._ensureRenderer()
      .render(payload);

    // 还有源时才继续帧循环，无源时暂停以节省 CPU
    if (this._sources.length > 0)
    {
      this._animationId = window.requestAnimationFrame(this._drawVideosToCanvas.bind(this));
    }
    else
    {
      this._animationId = null;
    }
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
    const video = document.createElement('video');

    video.setAttribute('style', 'display:none');

    video.muted = true;
    video.autoplay = true;
    video.setAttribute('playsinline', '');
    video.srcObject = mediaStream && (mediaStream.mediaStream || mediaStream);
    video.play().catch(() => { logger.error('video play error'); });

    return video;
  }

  // =========================================================================
  //  音频连接与管理
  // =========================================================================

  /**
   * 连接一路 source 的音频到混音目标节点。
   *
   * 音频路径：source.stream → createMediaStreamSource() → GainNode → AudioDestination
   *
   * 幂等性：同一 source 已连接同 stream 时直接返回 false 不重复连接；
   * 如果外部替换了 stream（如 HTMLVideoElement 换源），先断旧节点再建新链路。
   *
   * @param {Object} source - 内部 source 对象
   * @returns {boolean} true=成功连接；false=跳过（无音频轨 / 已连接 / audioContext 未就绪）
   */
  _connectAudio(source)
  {
    const stream = this._getSourceStream(source);

    if (!this._audioContext || !this._audioDestination || !this._hasLiveAudioTrack(source))
    {
      return false;
    }

    if (source.audioSourceNode)
    {
      // 同一个 source 已经连过当前 stream 时无需重复连接；如果外部替换过 stream，则先断旧节点。
      if (source.audioStream === stream)
      {
        return false;
      }

      this._disconnectAudio(source);
    }

    try
    {
      // 创建音频链路：MediaStream → SourceNode → GainNode → Destination
      const audioSourceNode = this._audioContext.createMediaStreamSource(stream);
      const gainNode = this._audioContext.createGain();

      gainNode.gain.value = source.gain;
      audioSourceNode.connect(gainNode);
      gainNode.connect(this._audioDestination);

      // 保存节点引用，便于后续断开和音量调整
      source.audioSourceNode = audioSourceNode;
      source.gainNode = gainNode;
      source.audioStream = stream;
      this._audioSources.push(audioSourceNode);

      // 如果 mixedStream 已返回给调用方且有音频轨，补进去
      this._ensureMixedStreamAudioTrack();

      logger.debug('audio tracks: ', stream.getAudioTracks().length);

      return true;
    }
    catch (error)
    {
      logger.warn(`Failed to connect audio source: ${error.message}`);

      return false;
    }
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
    const audioSourceNode = source.audioSourceNode;

    // 先断 gainNode，再断 audioSourceNode（反向顺序断开）
    if (source.gainNode)
    {
      source.gainNode.disconnect();
      source.gainNode = null;
    }

    if (source.audioSourceNode)
    {
      source.audioSourceNode.disconnect();
      source.audioSourceNode = null;
    }

    source.audioStream = null;

    // 从 _audioSources 追踪数组中移除
    if (audioSourceNode)
    {
      this._audioSources = this._audioSources.filter((sourceNode) => sourceNode !== audioSourceNode);
    }
  }

  /**
   * 将 AudioDestination 的音频轨补充到已返回的 mixed stream 中。
   *
   * 场景：getMixedStream() 已返回 mixed stream 给调用方时还没有音频源，
   * 后续通过 appendStream() 添加了有音频的源，此方法负责把新出现的音频轨注入到已返回的流。
   */
  _ensureMixedStreamAudioTrack()
  {
    if (!this._mixedStream || !this._audioDestination || this._mixedStream.getAudioTracks().length > 0)
    {
      return;
    }

    this._audioDestination.stream.getAudioTracks().forEach((track) =>
    {
      this._mixedStream.addTrack(track);
    });
  }

  /**
   * 去重地将音频流中的音轨添加到目标流中。
   *
   * @param {MediaStream} targetStream - 目标流（一般是 video stream）
   * @param {MediaStream} audioStream - 音频流（audio destination stream）
   */
  _addAudioTracksToStream(targetStream, audioStream)
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
      }
    });
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

    this._isStopDrawingFrames = true;

    if (this._animationId)
    {
      window.cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }

    this.clearStreams();

    // MediaStreamDestinationNode 没有 disconnect 输入的语义，disconnect 失败不应影响资源释放。
    if (this._audioDestination)
    {
      try
      {
        this._audioDestination.disconnect();
      }
      catch (error)
      {}

      this._audioDestination = null;
    }

    if (this._audioContext)
    {
      // close() 返回 Promise，但这里不等待；stop 的目标是同步断开对象引用和停止输出轨。
      this._audioContext.close();
    }

    this._audioContext = null;
    this._audioSources = [];
    this._mixedStream = null;

    // 清理渲染后端。WebGL 路径会释放 texture/program，Worker 路径会 terminate worker。
    if (this._renderer)
    {
      this._renderer.destroy();
      this._renderer = null;
    }

    // 停止画布导出的视频流
    this._capturedStreams.forEach((stream) =>
    {
      stream.getTracks().forEach((track) =>
      {
        track.stop();
      });
    });

    this._capturedStreams = [];
    this._canvas.stream = null;
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
   * 指定 slot 时会隐式将 legacy 模式升级为 grid 模式。
   * grid 模式下同 slot 已有源会被新源覆盖。
   *
   * @param {MediaStream|HTMLVideoElement|Array|Object} videos - 输入源
   * @param {number|Object} [optionsOrSlot] - slot 数字或 { slot, gain } 对象
   * @returns {boolean} true=至少成功添加了一个源
   * @throws {TypeError} 未传 videos
   */
  appendStream(videos, optionsOrSlot)
  {
    logger.debug('appendStream');
    if (!videos)
    {
      throw new TypeError('First parameter is required.');
    }

    if (!(videos instanceof Array))
    {
      videos = [ videos ];
    }

    let appended = false;

    // 只需首次判断是否需要升级到 grid 布局
    if (typeof optionsOrSlot === 'number' || (optionsOrSlot && typeof optionsOrSlot.slot === 'number'))
    {
      this._ensureModernLayout();
    }

    videos.forEach((video, index) =>
    {
      const sourceOptions = this._normalizeSourceOptions(optionsOrSlot, index);

      const source = this._createSource(video, sourceOptions);

      // grid 模式下同 slot 覆盖检测
      if (this._layoutMode !== 'legacy' && typeof source.slot === 'number')
      {
        const oldSource = this._sources.find((item) => item.slot === source.slot);

        if (oldSource)
        {
          // 新版 slot 语义与演示页一致：同 slot 新源覆盖旧源。
          logger.warn(`Slot ${source.slot} overwritten.`);
          this._removeSource(oldSource);
        }
      }

      this._sources.push(source);
      this._syncVideos();
      appended = true;

      // 如果音频系统已初始化，立即连接该源的音频
      if (this._audioContext)
      {
        this._connectAudio(source);
      }
    });

    // 如果 rAF 因无源而暂停且混流器仍活跃，恢复帧循环
    if (!this._animationId && !this._isStopDrawingFrames && this._sources.length > 0)
    {
      this._animationId = window.requestAnimationFrame(this._drawVideosToCanvas.bind(this));
    }

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
    logger.debug('removeStream');

    return this._removeSource(this._findSource(streamOrId));
  }

  /**
   * 移除所有输入源。
   * 遍历 _sources 快照逐条清理，过程中 _sources 数组会变化。
   */
  clearStreams()
  {
    logger.debug('clearStreams');

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
    return this._sources.map((source) =>
    {
      const stream = this._getSourceStream(source);

      return {
        id       : source.id,
        streamId : stream ? stream.id : null,
        slot     : source.slot,
        gain     : source.gain,
        hasAudio : this._hasLiveAudioTrack(source),
        hasVideo : this._hasVideoTrack(source)
      };
    });
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
    if (!this._renderer)
    {
      return {
        requestedMode  : this._config.renderMode,
        actualMode     : 'not-started',
        isWorker       : false,
        isWebGL2       : false,
        isFallback     : false,
        reason         : '',
        droppedFrames  : 0,
        renderedFrames : 0,
        fps            : this._config.fps,
        width          : this._canvas.width || this._config.width,
        height         : this._canvas.height || this._config.height
      };
    }

    return this._renderer.getInfo();
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
    this._isStopDrawingFrames = false;

    const mixedVideoStream = this.getVideoStream();

    // 先保存 mixed stream，再初始化音频；这样启动时无音频、后续 append 有音频源时，
    // _connectAudio() 可以把 MediaStreamDestination 的音频轨补到已经返回给调用方的流里。
    this._mixedStream = mixedVideoStream;

    const mixedAudioStream = await this.getAudioStream();

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
    this._isStopDrawingFrames = false;

    // 取消上次的 rAF 循环，重新开始
    if (this._animationId)
    {
      window.cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }

    // 立即绘制第一帧 + 启动 rAF 循环
    this._drawVideosToCanvas();

    const videoStream = new MediaStream();

    // 旧版未传 fps 时继续使用浏览器默认 captureStream 行为；新版传 fps 时控制输出帧率
    const capturedStream = this._config.fps ? this._canvas.captureStream(this._config.fps) : this._canvas.captureStream();

    capturedStream.getVideoTracks().forEach((track) =>
    {
      logger.debug('track: ', track.id, track.enabled, track.readyState);
      videoStream.addTrack(track);
    });

    // 清理前一次 captureStream，避免多次调用 getVideoStream 导致流泄漏
    this._capturedStreams.forEach((stream) =>
    {
      stream.getTracks().forEach((track) => track.stop());
    });
    this._capturedStreams = [];

    // 用于停止混合时
    this._canvas.stream = capturedStream;
    this._capturedStreams.push(capturedStream);

    return videoStream;
  }

  /**
   * 获取混合后的音频流。
   * 初始化 AudioContext（延迟创建），连接所有源的音频到 MediaStreamAudioDestination。
   *
   * @returns {Promise<MediaStream|null>} 仅包含音频轨的流；无音频源时返回 null
   */
  async getAudioStream()
  {
    logger.debug('getAudioStream()');

    // 延迟创建 AudioContext（避免浏览器自动播放策略限制）
    if (!this._audioContext)
    {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

      this._audioContext = new AudioContextConstructor();
    }

    // 自动恢复被浏览器挂起的 AudioContext
    if (this._audioContext.state === 'suspended')
    {
      await this._audioContext.resume();
    }

    // 创建音频汇总节点
    if (!this._audioDestination)
    {
      this._audioDestination = this._audioContext.createMediaStreamDestination();
    }

    // createMediaStreamSource 对同一个 MediaStream 只能创建一次有效链路。
    // 每个 source 只在未连接或 stream 已变化时连接，避免重复混入同一路音频。
    const connectedSources = this._sources.filter((source) => this._connectAudio(source));

    if (this._audioSources.length === 0 && connectedSources.length === 0)
    {
      logger.warn('No valid audio sources, skip audio stream creation');

      return null;
    }

    return this._audioDestination.stream;
  }
};
