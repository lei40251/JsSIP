// ============================================================
// app — CRTC.Mixer SDK 调用层
// 职责：此文件中的方法通过 Object.assign 挂载到全局 app 对象上，
//       封装所有直接调用 CRTC.Mixer SDK 的操作。UI 层（app-base.js）
//       不应直接访问 this.mixer，而应通过此文件提供的包装方法读取状态。
// ============================================================
Object.assign(window.app, {

  // ==========================================================
  // 生命周期 — Mixer 实例的创建与销毁
  // ==========================================================

  /**
   * 启动 Mixer 实例。
   * 从 UI 控件读取输出分辨率、帧率和渲染后端配置，创建 CRTC.Mixer，
   * 获取混流输出流后通知 UI 层展示预览。
   *
   * @async
   * @fires onMixerStarting - 启动前通知 UI 做准备工作
   * @fires onMixerStarted  - 启动成功，传递输出流和参数给 UI
   * @fires onMixerStartError - 启动失败，传递错误给 UI
   * @returns {Promise<void>}
   */
  async start()
  {
    // 如果已有正在运行的 mixer，先停止
    if (this.mixer) this.stop();

    // 从 UI 控件读取输出配置参数
    const [ w, h ] = document.getElementById('cfg-out-res').value.split('x').map(Number);
    const fps = parseInt(document.getElementById('cfg-fps').value);
    const renderMode = document.getElementById('cfg-render-mode').value;

    // 创建 Mixer 实例，初始空源列表
    this.mixer = new CRTC.Mixer([], { width: w, height: h, fps, renderMode });
    // 重置监听状态，由 UI 层按需开启
    this.monitorAudio = false;
    // 通知 UI 层进入启动前准备（如停止旧子混音）
    this.onMixerStarting();

    try
    {
      // 获取混流输出流（可能需异步等待渲染管线就绪）
      const outStream = await this.mixer.getMixedStream();

      // 通知 UI 层展示预览视频
      this.onMixerStarted(outStream, w, h, fps);
    }
    catch (e)
    {
      // 启动失败时清理 mixer 实例
      if (this.mixer)
      {
        this.mixer.stop();
        this.mixer = null;
      }
      // 通知 UI 层显示错误
      this.onMixerStartError(e);
    }
  },

  /**
   * 停止 Mixer 实例。
   * 销毁当前 mixer，释放资源，通知 UI 层清理界面状态。
   *
   * @async
   * @fires onMixerStopped - 停止后通知 UI 层清理
   * @returns {Promise<void>}
   */
  async stop()
  {
    if (this.mixer)
    {
      this.mixer.stop();
      this.mixer = null;
    }
    // 通知 UI 层重置所有面板状态
    this.onMixerStopped();
  },

  // ==========================================================
  // 源查询 — 从 Mixer 实例读取源与状态信息
  // ==========================================================

  /**
   * 获取当前选中槽位对应的源对象。
   *
   * @returns {Object|null} 返回匹配当前槽位的 source 对象，
   *         包含 slot、id、hasAudio 等字段；无 mixer 或无匹配时返回 null。
   */
  getSelectedSource()
  {
    if (!this.mixer) return null;

    return this.mixer.getSources().find((source) => source.slot === this.currentSlot) || null;
  },

  /**
   * 检查指定槽位是否已设置了槽位水印（target='source'）。
   *
   * @param {number} slot - 要检查的槽位编号
   * @returns {boolean} 该槽位是否存在 source 类型的水印
   */
  hasSlotWatermark(slot)
  {
    if (!this.mixer || !this.mixer.getWatermarks) return false;
    const watermarks = this.mixer.getWatermarks() || [];

    return watermarks.some((item) => item.target === 'source' && item.slot === slot);
  },

  /**
   * 获取当前所有水印的快照列表。
   *
   * @returns {Array} 水印对象数组，每个包含 id、target、type、position、status 等字段。
   *         无 mixer 或无 getWatermarks API 时返回空数组。
   */
  getWatermarkSnapshot()
  {
    if (!this.mixer || !this.mixer.getWatermarks) return [];

    return this.mixer.getWatermarks() || [];
  },

  // ==========================================================
  // Mixer 状态查询包装方法
  // 供 UI 层读取状态，避免 app-base.js 直接访问 this.mixer
  // ==========================================================

  /**
   * 判断 Mixer 是否正在运行。
   * UI 层通过此方法替代直接检查 this.mixer，保持职责分离。
   *
   * @returns {boolean} true 表示 mixer 实例存在且正在运行
   */
  isRunning()
  {
    return Boolean(this.mixer);
  },

  /**
   * 获取 Mixer 当前所有输入源列表。
   *
   * @returns {Array} source 对象数组，每个包含 slot、id、hasAudio 等。
   *         无 mixer 时返回空数组。
   */
  getSources()
  {
    return this.mixer ? this.mixer.getSources() : [];
  },

  /**
   * 获取 Mixer 的音频引擎状态信息。
   *
   * @returns {Object|null} 音频信息对象（含 status、connectedSources、liveSourceCount），
   *         无 mixer 或 SDK 不支持时返回 null。
   */
  getAudioInfo()
  {
    return this.mixer && this.mixer.getAudioInfo ? this.mixer.getAudioInfo() : null;
  },

  /**
   * 获取 Mixer 的渲染器运行信息。
   *
   * @returns {Object|null} 渲染信息对象（含 actualMode、requestedMode、droppedFrames、reason），
   *         无 mixer 或 SDK 不支持时返回 null。
   */
  getRenderInfo()
  {
    return this.mixer && this.mixer.getRenderInfo ? this.mixer.getRenderInfo() : null;
  },

  // ==========================================================
  // 水印变更 — 通过 Mixer SDK 管理全局与槽位水印
  // ==========================================================

  /**
   * 应用水印列表到 Mixer。
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
    if (!this.mixer) return;

    await this.mixer.setWatermarks(watermarks);
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
  clearOutputWatermarks()
  {
    if (!this.mixer) return;

    this.mixer.clearWatermarks({ target: 'output' });
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
  clearSelectedSlotWatermark()
  {
    if (!this.mixer) return;

    this.mixer.clearWatermarks({ target: 'source', slot: this.currentSlot });
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
  clearAllSlotWatermarks()
  {
    if (!this.mixer) return;

    this.mixer.clearWatermarks({ target: 'source' });
    this.refreshWatermarkList();
    this.updateSlotUI();
  },

  // ==========================================================
  // 子混音 — 从 Mixer 获取指定槽位的独立音频流
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
    // 无 mixer 时直接返回
    if (!this.mixer) return;

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

    try
    {
      // 显示准备中状态
      submix.label.innerText = `槽位 ${displayKey} 准备中...`;
      // Android Chrome 需使用 WebAudio 绕过自动播放限制
      const useWebAudioPlayback = this.shouldUseSubmixWebAudioPlayback();

      if (shouldPlay)
      {
        // 暂停其他子混音（同一 mixer 输出只能由一个 audio 元素播放）
        this.pauseOtherSubmixes(key);
        if (useWebAudioPlayback)
        {
          // Android Chrome 需要先 resume AudioContext
          await this.withTimeout(
            this.ensureSubmixPlaybackContext(),
            800,
            'submix playback context resume timeout'
          );
        }
        // 重置 audio 元素状态，准备绑定新流
        submix.audio.pause();
        submix.audio.removeAttribute('src');
        submix.audio.srcObject = null;
        submix.audio.load();
      }

      // 从 Mixer 获取独立的子混音音频流
      const stream = await this.mixer.getAudioStream({ slots: normalizedSlots, isolated: true });
      const trackCount = stream ? stream.getAudioTracks().length : 0;

      if (!stream)
      {
        // 所选槽位无可用的音频轨道
        submix.audio.pause();
        submix.audio.srcObject = null;
        submix.audio.load();
        submix.label.innerText = `槽位 ${displayKey} 无可用音频`;
        this.updateStats();

        return;
      }

      // 记忆 audio 元素之前的暂停状态，用于决定是否恢复播放
      const wasPaused = submix.audio.paused;

      // 将音频流绑定到 UI 元素
      submix.audio.srcObject = stream;
      // WebAudio 模式下 audio 元素静音，由 AudioContext 输出
      submix.audio.muted = useWebAudioPlayback;
      if (useWebAudioPlayback)
      {
        // 等待一帧确保 srcObject 已绑定
        await new Promise((r) => window.requestAnimationFrame(() => r()));
      }
      // 需要自动播放或之前未暂停时触发播放
      if (shouldPlay || !wasPaused)
      {
        if (useWebAudioPlayback)
        {
          // WebAudio 模式：连接 AudioContext 播放
          await this.withTimeout(
            this.startSubmixWebAudioPlayback(submix, stream),
            800,
            'submix webaudio playback timeout'
          );
          // audio.play() 在 muted 模式下无声音，但用于保持 audio 状态同步
          submix.audio.play().catch(() => { });
        }
        else
        {
          // 普通模式：直接通过 audio 元素播放
          await this.withTimeout(submix.audio.play(), 1200, 'submix audio element play timeout');
        }
      }
      // 更新状态显示
      submix.label.innerText = `槽位 ${displayKey} · ${trackCount} 音轨`;
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
    if (!this.mixer || this.localStreams.length <= 1) return;

    // 按 slot 升序排列
    const sorted = this.localStreams.slice().sort((a, b) => a.slot - b.slot);
    // 检查是否存在槽位空洞（slot != index）
    const needCompact = sorted.some((item, index) => item.slot !== index);

    if (!needCompact) return;

    // 先从 mixer 中移除所有流
    sorted.forEach((item) =>
    {
      this.mixer.removeStream(item.stream.id);
    });

    // 按顺序重新添加到 mixer，分配连续槽位
    sorted.forEach((item, index) =>
    {
      this.mixer.appendStream(item.stream, index);
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
   * 检查源数量上限，覆盖目标槽位旧源，添加到 Mixer，然后更新 UI。
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
    if (!this.mixer) return;
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
    // 将新源添加到 Mixer 指定槽位
    this.mixer.appendStream(stream, slot);

    // 记录本地源列表
    this.localStreams.push({ stream, slot, label });
    // 添加缩略图到界面
    this.addThumb(stream, label, slot);
    this.updateSlotUI();

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
   * 按源 ID 从 Mixer 移除输入源。
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
    if (!this.mixer) return;

    // 从 Mixer 移除流
    this.mixer.removeStream(id);

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
    this.updateStats();
    this.refreshActiveSubmix();
    this.refreshWatermarkList();
  }
});
