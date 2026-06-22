// ============================================================
// app — CRTC.MediaEffectsComposer SDK 调用层
// 职责：此文件中的方法通过 Object.assign 挂载到全局 app 对象上，
//       封装所有直接调用 CRTC.MediaEffectsComposer SDK 的操作。UI 层（app-base.js）
//       不应直接访问 this.composer，而应通过此文件提供的包装方法读取状态。
// ============================================================
Object.assign(window.app, {

  aiVirtualBackgroundAssetsBaseUrl : '../../demo/base-js/assets/aivb',
  aiVirtualBackgroundImages        : {
    office : '../../demo/base-js/virtual-background/backgrounds/office.png',
    sky    : '../../demo/base-js/virtual-background/backgrounds/sky.jpg'
  },

  // ==========================================================
  // 生命周期 — MediaEffectsComposer 实例的创建与销毁
  // ==========================================================

  /**
   * 启动 MediaEffectsComposer 实例。
   * 从 UI 控件读取输出分辨率、帧率和渲染后端配置，创建 CRTC.MediaEffectsComposer，
   * 默认仅获取视频输出流用于预览；完整音视频混流由 UI 层在用户点击监听时按需获取。
   *
   * @async
   * @fires onComposerStarting - 启动前通知 UI 做准备工作
   * @fires onComposerStarted  - 启动成功，传递输出流和参数给 UI
   * @fires onComposerStartError - 启动失败，传递错误给 UI
   * @returns {Promise<void>}
   */
  async start()
  {
    // 如果已有正在运行的 composer，先停止
    if (this.composer) this.stop();

    // 从 UI 控件读取输出配置参数
    const [ w, h ] = document.getElementById('cfg-out-res').value.split('x').map(Number);
    const fps = parseInt(document.getElementById('cfg-fps').value);
    const renderMode = document.getElementById('cfg-render-mode').value;
    const ctorOutputMirror = document.getElementById('cfg-ctor-output-mirror');
    const ctorOutputWatermarkMirror = document.getElementById('cfg-ctor-output-watermark-mirror');
    const ctorWatermarks = document.getElementById('cfg-ctor-watermarks');
    const options = {
      width                      : w,
      height                     : h,
      fps                        : fps,
      renderMode                 : renderMode,
      onIssue                    : this.createComposerIssueHandler('MainComposer'),
      mirror                     : ctorOutputMirror && ctorOutputMirror.value === 'on',
      mirrorWatermarksWithOutput : !ctorOutputWatermarkMirror || ctorOutputWatermarkMirror.value === 'on',
      watermarks                 : []
    };

    if (ctorWatermarks && ctorWatermarks.checked)
    {
      options.watermarks.push(this.buildOutputTextWatermark());
      const outputImageWatermark = this.buildOutputImageWatermark();

      if (outputImageWatermark)
      {
        options.watermarks.push(outputImageWatermark);
      }
    }

	    // 创建 MediaEffectsComposer 实例，初始空源列表
	    this.composer = new CRTC.MediaEffectsComposer([], options);
	    console.info('[MediaEffectsComposerDemo] ======== Composer 已创建 ========');
	    console.info('[MediaEffectsComposerDemo] 配置:', JSON.stringify({ width: w, height: h, fps, renderMode }));
	    // 重置监听状态，由 UI 层按需开启
	    this.monitorAudio = false;
	    // 通知 UI 层进入启动前准备（如停止旧子混音）
	    this.onComposerStarting();

	    try
	    {
	      // 启动阶段仅获取视频输出流，避免默认拉起完整音频混流
	      const outStream = await this.composer.getOutput({ type: 'video' });
	      console.info('[MediaEffectsComposerDemo] getOutput() 完成，视频轨:', outStream.getVideoTracks().length);

	      const info = this.composer.getRenderInfo();
	      console.info('[MediaEffectsComposerDemo] 渲染信息:', JSON.stringify({
	        requestedMode  : info.requestedMode,
	        actualMode     : info.actualMode,
	        isWorker       : info.isWorker,
	        isWebGL2       : info.isWebGL2,
	        isFallback     : info.isFallback,
	        reason         : info.reason || '-',
	        renderedFrames : info.renderedFrames,
	        droppedFrames  : info.droppedFrames
	      }));

	      // 通知 UI 层展示预览视频
	      this.onComposerStarted(outStream, w, h, fps);
	    }
    catch (e)
    {
      // 启动失败时清理 composer 实例
      if (this.composer)
      {
        this.composer.stop();
        this.composer = null;
      }
      // 通知 UI 层显示错误
      this.onComposerStartError(e);
    }
  },

  /**
   * 停止 MediaEffectsComposer 实例。
   * 销毁当前 composer，释放资源，通知 UI 层清理界面状态。
   *
   * @async
   * @fires onComposerStopped - 停止后通知 UI 层清理
   * @returns {Promise<void>}
   */
  async stop()
  {
    if (this.composer)
    {
      this.composer.stop();
      this.composer = null;
    }
    // 通知 UI 层重置所有面板状态
    this.onComposerStopped();
  },

  getComposerState()
  {
    return this.composer ? this.composer.getState() : null;
  },

  // ==========================================================
  // 源查询 — 从 MediaEffectsComposer 实例读取源与状态信息
  // ==========================================================

  /**
   * 获取当前选中槽位对应的源对象。
   *
   * @returns {Object|null} 返回匹配当前槽位的 source 对象，
   *         包含 slot、id、hasAudio 等字段；无 composer 或无匹配时返回 null。
   */
  getSelectedSource()
  {
    const state = this.getComposerState();

    if (!state) return null;

    return state.sources.find((source) => source.slot === this.currentSlot) || null;
  },

  getLocalStreamItemBySlot(slot)
  {
    return this.localStreams.find((item) => item.slot === Number(slot)) || null;
  },

  getSelectedLocalStreamItem()
  {
    return this.getLocalStreamItemBySlot(this.currentSlot);
  },

  getCurrentSlotAiVirtualBackground()
  {
    const source = this.getSelectedSource();

    if (source && source.aiVirtualBackground)
    {
      return source.aiVirtualBackground;
    }

    const item = this.getSelectedLocalStreamItem();

    return item && item.aiVirtualBackground ? item.aiVirtualBackground : null;
  },

  getAiVirtualBackgroundModeValue(config)
  {
    if (!config || !config.mode || config.mode === 'none')
    {
      return '';
    }

    if (config.mode === 'blur')
    {
      return 'blur';
    }

    if (config.mode === 'image')
    {
      if (config.imageUrl === this.aiVirtualBackgroundImages.office)
      {
        return 'office';
      }

      if (config.imageUrl === this.aiVirtualBackgroundImages.sky)
      {
        return 'sky';
      }
    }

    return '';
  },

  describeAiVirtualBackground(config)
  {
    if (!config || !config.mode || config.mode === 'none')
    {
      return '无虚拟背景';
    }

    if (config.mode === 'blur')
    {
      return '已启用 · 背景模糊';
    }

    if (config.mode === 'image')
    {
      if (config.imageUrl === this.aiVirtualBackgroundImages.office)
      {
        return '已启用 · Office';
      }

      if (config.imageUrl === this.aiVirtualBackgroundImages.sky)
      {
        return '已启用 · Sky';
      }

      return '已启用 · 图片背景';
    }

    return `已启用 · ${config.mode}`;
  },

  buildSelectedSlotAiVirtualBackgroundOptions()
  {
    const modeSelect = document.getElementById('slot-aivb-mode');
    const mode = modeSelect ? String(modeSelect.value || '').trim() : '';

    if (!mode)
    {
      return null;
    }

    const options = {
      enabled     : true,
      assetConfig : {
        cdnUrl : this.aiVirtualBackgroundAssetsBaseUrl
      }
    };
    const item = this.getSelectedLocalStreamItem();
    const track = item && item.stream && item.stream.getVideoTracks ? item.stream.getVideoTracks()[0] : null;
    const settings = track && typeof track.getSettings === 'function' ? track.getSettings() : null;
    const width = settings ? Number(settings.width) : NaN;
    const height = settings ? Number(settings.height) : NaN;

    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)
    {
      options.video = {
        width  : Math.round(width),
        height : Math.round(height)
      };
    }

    if (mode === 'blur')
    {
      options.mode = 'blur';
      options.blurRadius = 16;

      return options;
    }

    const imageUrl = this.aiVirtualBackgroundImages[mode];

    if (!imageUrl)
    {
      throw new Error(`Unknown AiVB mode: ${mode}`);
    }

    options.mode = 'image';
    options.imageUrl = imageUrl;

    return options;
  },

  async applySelectedSlotAiVirtualBackground()
  {
    if (!this.composer) return false;

    const item = this.getSelectedLocalStreamItem();
    const source = this.getSelectedSource();

    if (!source || !item || !item.stream || !item.stream.getVideoTracks || item.stream.getVideoTracks().length === 0)
    {
      this.showNotification('当前槽位没有可处理的视频源', 'warning');

      return false;
    }

    const config = this.buildSelectedSlotAiVirtualBackgroundOptions();

    if (!config)
    {
      return this.clearSelectedSlotAiVirtualBackground();
    }

    try
    {
      this.composer.setSourceAiVirtualBackground(this.currentSlot, config);
      item.aiVirtualBackground = this.composer.getSourceAiVirtualBackground(this.currentSlot) || config;
      this.refreshSelectedSlotSummary();
      this.updateStats();

      return true;
    }
    catch (e)
    {
      this.showNotification(`应用虚拟背景失败: ${e.message}`, 'warning');
      this.refreshSelectedSlotSummary();

      return false;
    }
  },

  async clearSelectedSlotAiVirtualBackground()
  {
    if (!this.composer) return false;

    const item = this.getSelectedLocalStreamItem();
    const source = this.getSelectedSource();

    if (item)
    {
      item.aiVirtualBackground = null;
    }

    if (!source)
    {
      this.refreshSelectedSlotSummary();
      this.updateStats();

      return false;
    }

    try
    {
      this.composer.clearSourceAiVirtualBackground(this.currentSlot);
    }
    catch (e)
    {
      this.showNotification(`清除虚拟背景失败: ${e.message}`, 'warning');
      this.refreshSelectedSlotSummary();

      return false;
    }

    this.refreshSelectedSlotSummary();
    this.updateStats();

    return true;
  },

  /**
   * 检查指定槽位是否已设置了槽位水印（target='source'）。
   *
   * @param {number} slot - 要检查的槽位编号
   * @returns {boolean} 该槽位是否存在 source 类型的水印
   */
  hasSlotWatermark(slot)
  {
    const state = this.getComposerState();

    if (!state) return false;
    const watermarks = state.config.watermarks || [];

    return watermarks.some((item) => item.target === 'source' && item.slot === slot);
  },

  /**
   * 获取当前所有水印的快照列表。
   *
   * @returns {Array} 水印对象数组，每个包含 id、target、type、position、status 等字段。
   *         无 composer 或无 getWatermarks API 时返回空数组。
   */
  getWatermarkSnapshot()
  {
    const state = this.getComposerState();

    return state ? (state.config.watermarks || []) : [];
  },

  // ==========================================================
  // MediaEffectsComposer 状态查询包装方法
  // 供 UI 层读取状态，避免 app-base.js 直接访问 this.composer
  // ==========================================================

  /**
   * 判断 MediaEffectsComposer 是否正在运行。
   * UI 层通过此方法替代直接检查 this.composer，保持职责分离。
   *
   * @returns {boolean} true 表示 composer 实例存在且正在运行
   */
  isRunning()
  {
    return Boolean(this.composer);
  },

  /**
   * 获取仅包含视频轨的输出流。
   *
   * @returns {MediaStream|null} 仅视频的输出流；无 composer 时返回 null。
   */
  async getOutputVideoStream()
  {
    return this.composer ? this.composer.getOutput({ type: 'video' }) : null;
  },

  /**
   * 获取包含音视频轨的完整输出混流。
   * UI 层仅在用户主动监听输出时调用，避免启动阶段初始化默认音频混流。
   *
   * @async
   * @returns {Promise<MediaStream|null>} 完整混流；无 composer 时返回 null。
   */
  async getOutputMixedStream()
  {
    return this.composer ? this.composer.getOutput({ type: 'mixed' }) : null;
  },

  /**
   * 获取 MediaEffectsComposer 当前所有输入源列表。
   *
   * @returns {Array} source 对象数组，每个包含 slot、id、hasAudio 等。
   *         无 composer 时返回空数组。
   */
  getSources()
  {
    const state = this.getComposerState();

    return state ? state.sources : [];
  },

  /**
   * 获取源镜像配置。
   *
   * @param {number} [slot] - 可选槽位编号；传入时返回该槽位状态对象
   * @returns {Object} 不传 slot 时返回 { global, overrides }；传 slot 时返回 { slot, global, override, effective }
   */
  getSourceMirror(slot)
  {
    const state = this.getComposerState();

    if (!state) return slot === undefined ? { global: false, overrides: {} } : null;

    const config = state.config;
    const global = Boolean(config.sourceMirror);
    const overrides = Object.assign({}, config.sourceMirrorOverrides || {});

    if (slot === undefined)
    {
      return { global, overrides };
    }

    const normalizedSlot = Number(slot);
    const key = String(normalizedSlot);
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, key);
    const override = hasOverride ? Boolean(overrides[key]) : null;

    return {
      slot      : normalizedSlot,
      global    : global,
      override  : override,
      effective : override === null ? global : override
    };
  },

  /**
   * 获取整体输出镜像状态。
   *
   * @returns {boolean} true 表示最终输出整体镜像开启
   */
  getMirror()
  {
    const state = this.getComposerState();

    return Boolean(state && state.config.outputMirror);
  },

  /**
   * 获取整体镜像时水印是否跟随镜像。
   *
   * @returns {boolean}
   */
  getOutputWatermarkMirror()
  {
    const state = this.getComposerState();

    return state ? Boolean(state.config.mirrorWatermarksWithOutput) : true;
  },

  /**
   * 设置源镜像。
   *
   * @param {number|boolean} slotOrEnabled - 布尔值表示设置全局默认值；数字表示槽位编号
   * @param {boolean} [enabled] - 传入槽位时表示该槽位覆盖值
   * @returns {boolean} 是否执行成功
   */
  async setSourceMirror(slotOrEnabled, enabled)
  {
    if (!this.composer) return false;
    await this.composer.setSourceMirror(slotOrEnabled, enabled);

    return true;
  },

  /**
   * 设置整体输出镜像。
   *
   * @param {boolean} enabled - true 开启，false 关闭
   * @returns {boolean} 是否执行成功
   */
  async setMirror(enabled)
  {
    if (!this.composer) return false;
    await this.composer.setMirror(Boolean(enabled));

    return true;
  },

  /**
   * 设置整体镜像时水印是否跟随。
   *
   * @param {boolean} enabled
   * @returns {boolean}
   */
  async setOutputWatermarkMirror(enabled)
  {
    if (!this.composer) return false;
    await this.composer.setConfig({ mirrorWatermarksWithOutput: Boolean(enabled) });

    return true;
  },

  /**
   * 清除源镜像覆盖。
   *
   * @param {number} [slot] - 不传则清除全部槽位覆盖
   * @returns {boolean} 是否执行成功
   */
  async clearSourceMirror(slot)
  {
    if (!this.composer) return false;
    await this.composer.clearSourceMirror(slot);

    return true;
  },

  /**
   * 获取 MediaEffectsComposer 的音频引擎状态信息。
   *
   * @returns {Object|null} 音频信息对象（含 status、connectedSources、liveSourceCount），
   *         无 composer 或 SDK 不支持时返回 null。
   */
  getAudioInfo()
  {
    const state = this.getComposerState();

    return state ? state.audio : null;
  },

  /**
   * 获取 MediaEffectsComposer 的渲染器运行信息。
   *
   * @returns {Object|null} 渲染信息对象（含 actualMode、requestedMode、droppedFrames、reason），
   *         无 composer 或 SDK 不支持时返回 null。
   */
  getRenderInfo()
  {
    const state = this.getComposerState();

    return state ? state.render : null;
  },

  /**
   * 从当前输出视频轨读取运行时参数（宽高/帧率）。
   *
   * @returns {Object|null} 可能包含 width/height/frameRate；读取失败返回 null。
   */
  getActiveOutputVideoSettings()
  {
    if (!this.outputVideoStream || !this.outputVideoStream.getVideoTracks) return null;
    const track = this.outputVideoStream.getVideoTracks()[0];

    if (!track || !track.getSettings) return null;
    const settings = track.getSettings();
    const width = Number(settings.width), height = Number(settings.height), frameRate = Number(settings.frameRate);
    const next = {};

    if (Number.isFinite(width)) next.width = Math.round(width);
    if (Number.isFinite(height)) next.height = Math.round(height);
    if (Number.isFinite(frameRate)) next.frameRate = Math.round(frameRate * 10) / 10;
    if (!Object.keys(next).length) return null;

    return next;
  },

  /**
   * 获取输出运行时参数缓存，并尝试用视频轨实时参数刷新。
   *
   * @returns {Object|null} 输出运行时配置对象
   */
  getOutputRuntimeConfig()
  {
    const liveSettings = this.getActiveOutputVideoSettings();

    if (liveSettings)
    {
      const nextConfig = Object.assign({}, this.outputRuntimeConfig || {});

      // 统计面板里的 FPS 保持启动配置值，不用实时轨道帧率覆盖。
      if (Number.isFinite(liveSettings.width))
      {
        nextConfig.width = liveSettings.width;
      }

      if (Number.isFinite(liveSettings.height))
      {
        nextConfig.height = liveSettings.height;
      }

      if (!Number.isFinite(nextConfig.frameRate) && Number.isFinite(liveSettings.frameRate))
      {
        nextConfig.frameRate = liveSettings.frameRate;
      }

      this.outputRuntimeConfig = nextConfig;
    }

    return this.outputRuntimeConfig;
  },

  // ==========================================================
  // 水印变更 — 通过 MediaEffectsComposer SDK 管理全局与槽位水印
  // ==========================================================

  /**
   * 应用水印列表到 MediaEffectsComposer。
   * 替换所有已有水印，然后触发 UI 刷新。
   *
   * @async
   * @param {Array} watermarks - 水印配置数组，每个元素包含 id、target、type、position 等字段
   * @fires refreshWatermarkList - 更新水印列表 UI
   * @fires updateSlotUI - 更新槽位指示器（has-watermark 样式）
   * @returns {Promise<void>}
   */
  async applyWatermarks(watermarks)
  {
    if (!this.composer) return;

    await this.composer.setWatermarks(watermarks);
    // 刷新界面：水印列表 + 槽位状态标记
    this.refreshWatermarkList();
    this.updateSlotUI();
  },

  /**
   * 清除所有输出级水印（target='output'）。
   * 不影响各槽位的 source 水印。
   *
   * @fires refreshWatermarkList
   * @fires updateSlotUI
   * @returns {void}
   */
  async clearOutputWatermarks()
  {
    if (!this.composer) return;

    await this.composer.clearWatermarks({ target: 'output' });
    this.refreshWatermarkList();
    this.updateSlotUI();
  },

  /**
   * 清除当前选中槽位的源水印。
   * 仅移除 target='source' 且 slot 等于当前槽位的水印。
   *
   * @fires refreshWatermarkList
   * @fires updateSlotUI
   * @returns {void}
   */
  async clearSelectedSlotWatermark()
  {
    if (!this.composer) return;

    await this.composer.clearWatermarks({ target: 'source', slot: this.currentSlot });
    this.refreshWatermarkList();
    this.updateSlotUI();
  },

  /**
   * 清除所有槽位的源水印。
   * 移除所有 target='source' 的水印，保留输出级水印。
   *
   * @fires refreshWatermarkList
   * @fires updateSlotUI
   * @returns {void}
   */
  async clearAllSlotWatermarks()
  {
    if (!this.composer) return;

    await this.composer.clearWatermarks({ target: 'source' });
    this.refreshWatermarkList();
    this.updateSlotUI();
  },

  // ==========================================================
  // 子混音 — 从 MediaEffectsComposer 获取指定槽位的独立音频流
  // 用于监听局部混音，非破坏性操作，不改变输出内容。
  // ==========================================================

  /**
   * 监听指定槽位的子混音音频流。
   * 支持 WebAudio 回退播放（Android Chrome 需要特殊处理以避免自动播放限制）。
   *
   * @async
   * @param {number[]} slots - 要监听的槽位编号数组，如 [0, 1]
   * @param {Object}   [options={}] - 选项
   * @param {boolean}  [options.silent=false] - 静默模式，出错时不弹通知
   * @param {boolean}  [options.play=true] - 是否自动播放
   * @fires ensureSubmixItem - 创建/获取子混音 UI 项
   * @fires pauseOtherSubmixes - 暂停其他子混音
   * @fires updateSubmixStatus - 更新子混音状态栏
   * @fires updateStats - 刷新统计面板
   * @returns {Promise<void>}
   */
  async listenSubmix(slots, options = {})
  {
    // 无 composer 时直接返回
    if (!this.composer) return;

    // 规范化：去重、排序、范围检查
    const normalizedSlots = this.normalizeSubmixSlots(slots);

    if (!normalizedSlots.length) return;

    // 用逗号拼接的槽位字符串作为唯一 key
    const key = normalizedSlots.join(',');
    // 用户可读的槽位显示文本（如 "1,2,3"）
    const displayKey = this.formatSlotList(normalizedSlots);
    // 获取或创建子混音 UI 条目（audio 元素 + 控制按钮）
    const submix = this.ensureSubmixItem(key, normalizedSlots);
    const silent = Boolean(options.silent);
    const shouldPlay = !silent && options.play !== false;
    // 子混音统一用 isolated 输出，播放统一交给 WebAudio（支持多路并行有声）。
    const useWebAudioPlayback = true;
    const useIsolatedSubmix = true;

    try
    {
      // 显示准备中状态
      submix.label.innerText = `槽位 ${displayKey} 准备中...`;

      if (shouldPlay)
      {
        if (useWebAudioPlayback)
        {
          // Android Chrome 需要先 resume AudioContext
          await this.withTimeout(
            this.ensureSubmixPlaybackContext(),
            800,
            'submix playback context resume timeout'
          );
        }
        // 非 WebAudio 模式下重置 audio 元素状态，准备绑定新流
        if (!useWebAudioPlayback)
        {
          submix.audio.pause();
          submix.audio.removeAttribute('src');
          submix.audio.srcObject = null;
          submix.audio.load();
        }
      }

      // 从 MediaEffectsComposer 获取独立的子混音音频流
      const stream = await this.composer.getOutput({
        type     : 'audio',
        slots    : normalizedSlots,
        isolated : useIsolatedSubmix
      });
      const playbackStream = this.createAudioPlaybackStream(stream);
      const trackCount = stream ? stream.getAudioTracks().length : 0;

      if (!playbackStream)
      {
        // 所选槽位无可用的音频轨道
        if (!useWebAudioPlayback)
        {
          submix.audio.pause();
          submix.audio.srcObject = null;
          submix.audio.load();
        }
        else
        {
          submix.audio.srcObject = null;
          this.stopSubmixWebAudioPlayback(submix);
        }
        submix.label.innerText = `槽位 ${displayKey} 无可用音频`;
        this.updateStats();

        return;
      }

      // 将音频流绑定到 UI 元素
      submix.audio.srcObject = playbackStream;
      // 仅作为流容器，不直接出声；实际音频由 WebAudio 输出。
      submix.audio.muted = useWebAudioPlayback;
      submix.audio.autoplay = false;
      if (useWebAudioPlayback)
      {
        await new Promise((r) => window.requestAnimationFrame(() => r()));
      }
      if (shouldPlay)
      {
        if (useWebAudioPlayback)
        {
          // WebAudio 模式：连接 AudioContext 播放
          await this.withTimeout(
            this.startSubmixWebAudioPlayback(submix, playbackStream),
            800,
            'submix webaudio playback timeout'
          );
          submix.isPlaying = true;
        }
        else
        {
          // 普通模式：直接通过 audio 元素播放
          await this.withTimeout(submix.audio.play(), 1200, 'submix audio element play timeout');
          submix.isPlaying = true;
        }
      }
      else
      {
        submix.isPlaying = false;
      }
      // 更新状态显示
      submix.label.innerText = `槽位 ${displayKey} · ${trackCount} 音轨`;
      submix.isolated = useIsolatedSubmix;
      this.updateSubmixControlUI(submix);
      this.updateSubmixStatus();
      this.updateStats();
    }
    catch (e)
    {
      // 播放失败（通常是被浏览器自动播放策略阻止）
      submix.label.innerText = `槽位 ${displayKey} 播放被阻止，可再点播放器播放`;
      this.updateStats();

      if (!silent)
      {
        this.showNotification(`监听子混音失败: ${e.message}`);
      }
    }
  },

  /**
   * 释放指定子混音音频请求。
   *
   * @param {number[]} slots - 槽位数组
   * @param {boolean} isolated - 是否 isolated 请求
   * @returns {boolean} 是否成功发起释放
   */
  releaseSubmixAudioRequest(slots, isolated)
  {
    if (!this.composer) return false;
    const normalizedSlots = this.normalizeSubmixSlots(slots);

    if (!normalizedSlots.length) return false;

    try
    {
      return this.composer.releaseOutput({
        type     : 'audio',
        slots    : normalizedSlots,
        isolated : Boolean(isolated)
      });
    }
    catch (e)
    {
      return false;
    }
  },

  /**
   * 释放除当前激活项外的子混音音频请求。
   *
   * @param {string} activeKey - 当前保留的子混音 key
   * @param {boolean} isolated - 是否 isolated 请求
   * @returns {void}
   */
  releaseOtherSubmixAudioRequests(activeKey, isolated)
  {
    this.activeSubmixes.forEach((item, key) =>
    {
      if (key !== activeKey)
      {
        this.releaseSubmixAudioRequest(item.slots, isolated);
      }
    });
  },

  // ==========================================================
  // 源管理 — 输入流的增删、槽位压缩
  // ==========================================================

  /**
   * 压缩槽位，消除空洞。
   * 当中间槽位的源被移除后，将后面的源前移填补空缺，保持槽位连续。
   * 例如：移除 slot 1 后，[0: A, 1: (空), 2: C] → [0: A, 1: C]。
   *
   * @fires rebuildThumbsFromLocalStreams - 重建缩略图列表
   * @returns {void}
   */
  compactSlotsIfSparse()
  {
    // 少于 2 个源时无需压缩
    if (!this.composer || this.localStreams.length <= 1) return;

    // 按 slot 升序排列
    const sorted = this.localStreams.slice().sort((a, b) => a.slot - b.slot);
    // 检查是否存在槽位空洞（slot != index）
    const needCompact = sorted.some((item, index) => item.slot !== index);

    if (!needCompact) return;

    // 先从 composer 中移除所有流
    sorted.forEach((item) =>
    {
      this.composer.removeSource(item.stream.id);
    });

    // 按顺序重新添加到 composer，分配连续槽位
    sorted.forEach((item, index) =>
    {
      const sourceOptions = { slot: index };

      if (item.aiVirtualBackground)
      {
        sourceOptions.aiVirtualBackground = item.aiVirtualBackground;
      }

      this.composer.addSource(item.stream, sourceOptions);
      item.slot = index;
    });

    // 更新本地数据
    this.localStreams = sorted;
    // 重建 UI 缩略图
    this.rebuildThumbsFromLocalStreams();
    // 修正当前选中槽位，确保不越界
    this.currentSlot = this.clampSlot(
      Math.min(this.currentSlot, Math.max(this.localStreams.length - 1, 0))
    );
  },

  /**
   * 处理输入源添加的内部方法。
   * 检查源数量上限，覆盖目标槽位旧源，添加到 MediaEffectsComposer，然后更新 UI。
   *
   * @param {MediaStream} stream - 要添加的媒体流
   * @param {string}      label  - 缩略图显示的标签文字
   * @fires removeLocalStreamBySlot - 移除目标槽位的旧源
   * @fires addThumb - 添加缩略图到 UI
   * @fires compactSlotsIfSparse - 触发槽位压缩
   * @fires updateSlotUI - 更新槽位选择器
   * @fires selectSlot - 自动跳转到下一个空槽位
   * @fires updateStats - 刷新统计
   * @fires refreshActiveSubmix - 刷新激活的子混音
   * @fires refreshWatermarkList - 刷新水印列表
   * @returns {void}
   */
  _handleStreamAdd(stream, label)
  {
    if (!this.composer) return;
    // 计算插入槽位（优先使用当前选中槽位）
    const slot = this.getCompactInsertSlot(this.currentSlot);

    // 已达上限且目标槽位未被当前本地流占用时拒绝添加
    if (this.localStreams.length >= this.maxDemoSources &&
        !this.localStreams.some((item) => item.slot === slot))
    {
      // 释放被拒绝的流资源
      stream.getTracks().forEach((track) => track.stop());
      if (stream.stopInternal) stream.stopInternal();
      this.showNotification(
        `当前 demo 只支持 ${this.maxDemoSources} 个输入源，请先删除或覆盖已有源位。`,
        'warning'
      );

      return;
    }

    // 移除目标槽位的旧源（如有）
    this.removeLocalStreamBySlot(slot);
    // 将新源添加到 MediaEffectsComposer 指定槽位
    this.composer.addSource(stream, { slot });

    // 记录本地源列表
    this.localStreams.push({
      stream,
      slot,
      label,
      aiVirtualBackground : null
    });
    // 添加缩略图到界面
    this.addThumb(stream, label, slot);
    this.updateSlotUI();
    this.updateMonitorAudioUI();

    // 自动选中下一个空槽位
    const occupied = new Set(this.localStreams.map((item) => item.slot));

    for (let i = 0; i < this.maxDemoSources; i++)
    {
      if (!occupied.has(i)) { this.selectSlot(i); break; }
    }

    // 刷新统计面板和关联 UI
    this.updateStats();
    this.refreshActiveSubmix();
    this.refreshWatermarkList();
  },

  /**
   * 按源 ID 从 MediaEffectsComposer 移除输入源。
   * 停止并释放流的音视频轨道，清理对应缩略图，压缩槽位。
   *
   * @param {string} id - MediaStream.id，用于定位和移除
   * @fires compactSlotsIfSparse - 压缩槽位空洞
   * @fires rebuildThumbsFromLocalStreams - 重建缩略图
   * @fires updateSlotUI - 更新槽位选择器
   * @fires updateStats - 刷新统计
   * @fires refreshActiveSubmix - 刷新子混音
   * @fires refreshWatermarkList - 刷新水印列表
   * @returns {void}
   */
  removeSource(id)
  {
    if (!this.composer) return;

    // 从 MediaEffectsComposer 移除流
    this.composer.removeSource(id);

    // 在本地列表中查找并移除
    const idx = this.localStreams.findIndex((item) => item.stream.id === id);

    if (idx !== -1)
    {
      const s = this.localStreams[idx].stream;

      // 停止所有轨道
      s.getTracks().forEach((t) => t.stop());
      // 调用虚拟源等自定义清理钩子
      if (s.stopInternal) s.stopInternal();
      // 从本地列表移除
      this.localStreams.splice(idx, 1);
    }

    // 移除对应的 DOM 缩略图元素
    const el = document.getElementById(`thumb-${id}`);

    if (el) el.remove();
    // 如果缩略图容器为空，显示占位提示
    if (this.ui.thumbs.children.length === 0)
    {
      this.ui.thumbs.innerHTML = '<div class="source-strip-empty">(暂无输入源)</div>';
    }
    this.updateSlotUI();
    this.updateMonitorAudioUI();
    this.updateStats();
    this.refreshActiveSubmix();
    this.refreshWatermarkList();
  }
});
