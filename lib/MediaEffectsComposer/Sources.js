/**
 * Sources — 混流器输入源注册表
 *
 * 管理所有参与混流的输入源（MediaStream / HTMLVideoElement）。
 * 负责源的增删、ID 生成、slot 分配、状态查询等。
 *
 * @module Sources
 */
class Sources
{
  /**
   * @param {Object} options
   * @param {Object} options.logger - 日志记录器
   * @param {Function} options.getDefaultGain - 返回默认音量增益的回调
   * @param {Function} options.normalizeGain - 增益值归一化函数
   * @param {Function} options.createVideoElement - 创建隐藏 video 元素的工厂函数
   * @param {Function} options.onBeforeRemove - 源被移除前的回调（用于断开音频连接）
   * @param {Function} options.onAfterRemove - 源被移除后的回调（用于清理渲染器、清空画布）
   */
  constructor(options)
  {
    options = options || {};

    this._logger = options.logger;
    this._getDefaultGain = options.getDefaultGain;
    this._normalizeGain = options.normalizeGain;
    this._createVideoElement = options.createVideoElement;
    this._onBeforeRemove = options.onBeforeRemove;
    this._onAfterRemove = options.onAfterRemove;

    /** @type {Array<Object>} 当前所有输入源对象列表 */
    this.sources = [];

    /** @type {Array<HTMLVideoElement>} 当前所有源对应的 video 元素列表（与 sources 同步） */
    this.videos = [];

    /** @type {number} 内部自增 ID 序列，用于生成唯一 source ID */
    this._sourceSeq = 0;

    if (this._logger)
    {
      this._logger.debug('Sources constructed');
    }
  }

  /**
   * 添加一个新的输入源。
   *
   * 如果新源的 slot 已被占用，旧源会被替换（先移除旧源再添加新源）。
   *
   * @param {MediaStream|HTMLVideoElement|Object} input - 输入源
   * @param {Object} [options={}] - 配置选项 { slot, gain, sourceMirror, aiVirtualBackground }
   * @returns {Object} 新建的 source 对象
   */
  add(input, options)
  {
    const source = this._createSource(input, options || {});

    // 检查 slot 冲突，同 slot 旧源会被替换
    if (typeof source.slot === 'number')
    {
      const oldSource = this.sources.find((item) => item.slot === source.slot);

      if (oldSource)
      {
        if (this._logger)
        {
          this._logger.warn(`Slot ${source.slot} overwritten.`);
        }

        this.remove(oldSource);
      }
    }

    this.sources.push(source);
    this._syncVideos();

    if (this._logger)
    {
      const hasAudio = this.hasLiveAudioTrack(source);
      const hasVideo = this.hasVideoTrack(source);
      const trackLabel = hasAudio && hasVideo ? 'audio+video' : (hasAudio ? 'audio' : (hasVideo ? 'video' : 'none'));

      this._logger.debug(`Source added: id=${source.id} slot=${source.slot} tracks=${trackLabel} gain=${source.gain}`);
    }

    return source;
  }

  /**
   * 移除所有输入源（遍历快照逐一移除）。
   */
  clear()
  {
    if (this._logger)
    {
      this._logger.debug(`Clearing all sources: count=${this.sources.length}`);
    }

    this.sources.slice().forEach((source) =>
    {
      this.remove(source);
    });
  }

  /**
   * 按 MediaStream 对象、stream.id 或内部 source.id 查找源。
   *
   * @param {MediaStream|string|HTMLVideoElement} streamOrId - 查找依据
   * @returns {Object|null} 找到的 source 对象，或 null
   */
  find(streamOrId)
  {
    if (!streamOrId)
    {
      return null;
    }

    if (typeof streamOrId === 'string')
    {
      // 先匹配 source.id，再匹配 stream.id
      return this.sources.find((source) =>
      {
        const stream = this.getStream(source);

        return source.id === streamOrId || (stream && stream.id === streamOrId);
      }) || null;
    }

    // 按 MediaStream 或 HTMLVideoElement 引用匹配
    const stream = streamOrId.mediaStream || streamOrId;

    return this.sources.find((source) =>
    {
      return source.stream === stream || source.video === streamOrId;
    }) || null;
  }

  /**
   * 移除一个具体的 source 对象。
   *
   * 步骤：触发 onBeforeRemove（断开音频）→ 清理 ownedVideo（暂停、清空 srcObject、移除 DOM）→
   * 从数组移除 → 同步 _videos → 触发 onAfterRemove（渲染器清理、画布清空）。
   *
   * @param {Object} source - 要移除的 source 对象
   * @returns {boolean} true=成功移除；false=source 为空
   */
  remove(source)
  {
    if (!source)
    {
      return false;
    }

    if (this._logger)
    {
      this._logger.debug(`Removing source: id=${source.id} slot=${source.slot}`);
    }

    // 先通知外部断开音频连接
    if (this._onBeforeRemove)
    {
      try { this._onBeforeRemove(source); }
      catch (error)
      {
        if (this._logger) this._logger.warn(`Source before-remove cleanup failed: ${error.message || String(error)}`);
      }
    }

    // 如果是 composer 内部创建的 video 元素，清理 DOM
    if (source.ownedVideo && source.video)
    {
      try { source.video.pause(); }
      catch (error) {}
      try { source.video.srcObject = null; }
      catch (error) {}
      try { source.video.remove(); }
      catch (error) {}
    }

    const index = this.sources.indexOf(source);

    if (index !== -1)
    {
      this.sources.splice(index, 1);
    }

    this._syncVideos();

    // 通知外部源已移除（渲染器清理、画布清空等）
    if (this._onAfterRemove)
    {
      try { this._onAfterRemove(source); }
      catch (error)
      {
        if (this._logger) this._logger.warn(`Source after-remove cleanup failed: ${error.message || String(error)}`);
      }
    }

    if (this._logger)
    {
      this._logger.debug(`Source removed: id=${source.id} remaining=${this.sources.length}`);
    }

    return true;
  }

  /**
   * 返回当前所有源的快照。
   * 返回新数组，外部修改不影响内部状态。
   *
   * @returns {Array<Object>} 源信息列表：{ id, streamId, slot, gain, sourceMirror, hasAudio, hasVideo }
   */
  getSnapshot()
  {
    return this.sources.map((source) =>
    {
      const stream = this.getStream(source);

      return {
        id                  : source.id,
        streamId            : stream ? stream.id : null, 
        slot                : source.slot,
        gain                : source.gain,
        sourceMirror        : typeof source.mirrorX === 'boolean' ? source.mirrorX : null,
        aiVirtualBackground : cloneSnapshotValue(source.aiVirtualBackground),
        hasAudio            : this.hasLiveAudioTrack(source),
        hasVideo            : this.hasVideoTrack(source)
      };
    });
  }

  /**
   * 获取 source 当前关联的 MediaStream。
   *
   * 对于外部传入的 HTMLVideoElement，调用方可能后续替换 srcObject，
   * 这里同步更新 source.stream 引用，确保后续操作使用最新流。
   *
   * @param {Object} source - 内部 source 对象
   * @returns {MediaStream|null} 当前 MediaStream
   */
  getStream(source)
  {
    const stream = source.video && !source.ownedVideo ? source.video.srcObject : source.stream;

    // 同步 stream 引用（外部换源场景）
    if (source.stream !== stream)
    {
      source.stream = stream;
    }

    return stream;
  }

  /**
   * 检测是否至少有一路源有 live（活跃）状态的音频轨。
   *
   * @returns {boolean} true=至少一路有活跃音频
   */
  hasAnyLiveAudioTrack()
  {
    return this.sources.some((source) => this.hasLiveAudioTrack(source));
  }

  /**
   * 检测某路源是否有 live（活跃）状态的音频轨。
   * 只混入 live 状态的音频轨，避免 ended track 导致 WebAudio 创建失败或无效混音。
   *
   * @param {Object} source - 内部 source 对象
   * @returns {boolean} true=至少有一条 live 音频轨
   */
  hasLiveAudioTrack(source)
  {
    const stream = this.getStream(source);

    return Boolean(
      stream &&
      stream.getAudioTracks &&
      stream.getAudioTracks().some((track) => track.readyState === 'live')
    );
  }

  /**
   * 检测某路源是否有视频轨（不判断 readyState）。
   * readyState 在绘制阶段才判断，刚加入但尚未出帧的源仍保留在布局中。
   *
   * @param {Object} source - 内部 source 对象
   * @returns {boolean} true=至少有一条视频轨
   */
  hasVideoTrack(source)
  {
    const stream = this.getStream(source);

    return Boolean(
      stream &&
      stream.getVideoTracks &&
      stream.getVideoTracks().length > 0
    );
  }

  /**
   * 判断某路源当前是否可渲染。
   * 条件：stream 存在且 active，并且有视频轨。
   * 具体的视频帧是否能绘制由 video.readyState 在渲染阶段判断。
   *
   * @param {Object} source - 内部 source 对象
   * @returns {boolean} true=可渲染
   */
  isRenderable(source)
  {
    const stream = this.getStream(source);

    return Boolean(
      stream &&
      stream.active &&
      this.hasVideoTrack(source)
    );
  }

  /**
   * 判断对象是否具备 MediaStream 的基本接口。
   *
   * 这个私有方法会被构建脚本收集到保留名单里，避免压缩产物把调用点和定义名拆开。
   *
   * @param {*} stream - 待校验对象
   * @returns {boolean} true=满足 MediaStream 基本接口
   */
  _isMediaStreamLike(stream)
  {
    return Boolean(
      stream &&
      typeof stream.getTracks === 'function' &&
      typeof stream.getAudioTracks === 'function' &&
      typeof stream.getVideoTracks === 'function'
    );
  }

  /**
   * 创建一个内部 source 对象。
   *
   * @param {MediaStream|HTMLVideoElement|Object} input - 原始输入
   * @param {Object} options - 配置 { slot, gain, sourceMirror, aiVirtualBackground }
   * @returns {Object} source 对象
   * @throws {TypeError} 无效的 MediaStream
   */
  _createSource(input, options)
  {
    let video;
    let stream;
    let ownedVideo = false;

    if (input instanceof HTMLMediaElement)
    {
      // 外部传入的 video 元素，混流器不接管生命周期
      video = input;
      stream = input.srcObject;
    }
    else
    {
      // MediaStream 或 { mediaStream } 包装，内部创建隐藏 video
      stream = input && (input.mediaStream || input);

      if (!this._isMediaStreamLike(stream))
      {
        throw new TypeError('Invalid MediaStream.');
      }

      video = this._createVideoElement(stream);
      ownedVideo = true;
    }

    const source = {
      id                  : this._createSourceId(stream, video),
      stream              : stream,
      video               : video,
      slot                : typeof options.slot === 'number' ? options.slot : null,
      gain                : this._normalizeGain(options.gain, this._getDefaultGain()),
      mirrorX             : typeof options.sourceMirror === 'boolean' ? options.sourceMirror : null,
      aiVirtualBackground : options.aiVirtualBackground || null,
      audioSourceNode     : null, // WebAudio 源节点（由 AudioMixer 连接时赋值）
      masterGainNode      : null, // 每路输入唯一 fan-out 节点，避免 MediaStreamSource 直接扇出
      gainNode            : null, // 默认全量混音音量节点（由 AudioMixer 连接时赋值）
      outputGains         : new Set(), // 该源所有下游 gain，用于后续音量同步和安全清理
      audioStream         : null, // 当前已连接的音频流引用
      audioTrackId        : null, // 当前已连接的音频轨 id，用于判断是否真正换轨
      audioTrackSignature : null, // 音频轨身份签名（track 对象 + id）
      ownedVideo          : ownedVideo
    };

    // 未指定 slot 时自动分配最小编号空闲 slot
    if (source.slot === null)
    {
      source.slot = this._getNextSlot();
    }

    if (this._logger)
    {
      const streamId = stream && stream.id ? stream.id : 'unknown';

      this._logger.debug(`Source created: id=${source.id} stream=${streamId} slot=${source.slot} ownedVideo=${ownedVideo}`);
    }

    return source;
  }

  /**
   * 为 source 生成唯一 ID。
   * 优先使用 stream.id，冲突时追加自增序号确保唯一。
   *
   * @param {MediaStream} stream - 关联的 MediaStream
   * @param {HTMLVideoElement} video - 关联的 video 元素
   * @returns {string} 唯一 ID
   */
  _createSourceId(stream, video)
  {
    const baseId = (stream && stream.id) || video.id || `composer-source-${this._sourceSeq + 1}`;
    let sourceId = baseId;

    while (this.sources.some((source) => source.id === sourceId))
    {
      this._sourceSeq += 1;
      sourceId = `${baseId}-${this._sourceSeq}`;
    }

    return sourceId;
  }

  /**
   * 获取当前最小编号的空闲 slot。
   * 从 0 开始递增查找，跳过已被占用的 slot 编号。
   *
   * @returns {number} 可用的 slot 编号
   */
  _getNextSlot()
  {
    let slot = 0;
    const occupiedSlots = this.sources.reduce((slots, source) =>
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

  /**
   * 将 sources 数组中的 video 元素同步到 videos 数组。
   * 外部代码通过 this.videos 即可遍历所有 video 元素。
   */
  _syncVideos()
  {
    this.videos.splice(0, this.videos.length);

    this.sources.forEach((source) =>
    {
      this.videos.push(source.video);
    });

    if (this._logger)
    {
      this._logger.debug(`Videos synced: sources=${this.sources.length} videos=${this.videos.length}`);
    }
  }
}

function cloneSnapshotValue(value)
{
  if (value instanceof Array)
  {
    return value.map(cloneSnapshotValue);
  }

  if (value && typeof value === 'object')
  {
    return Object.keys(value).reduce((snapshot, key) =>
    {
      snapshot[key] = cloneSnapshotValue(value[key]);

      return snapshot;
    }, {});
  }

  return value === undefined ? null : value;
}

module.exports = Sources;
