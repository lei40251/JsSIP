// ============================================================
// app — UI 逻辑、工具方法、UI 回调及非 MediaStreamComposer-SDK 操作
// ============================================================
const app = {
  localStreams            : [],
  counter                 : 0,
  currentSlot             : 0,
  maxDemoSources          : 9,
  monitorAudio            : false,
  outputVideoStream       : null,
  outputMixedStream       : null,
  outputRuntimeConfig     : null,
  outputPlayback          : null,
  activeSubmixes          : new Map(),
  submixPlaybackCtx       : null,
  vizToken                : 0,
  lastRenderPathSignature : '',
  stressRun               : null,
  stressResults           : [],
  stressSamples           : [],
  stressAuxComposers      : [],
  stressSourceFactory     : null,
  stressDragState         : null,

  // ==========================================================
  // DOM 引用
  // ==========================================================
  ui : {
    slotGrid                 : document.getElementById('slot-selector'),
    mixedVideo               : document.getElementById('mixed-video'),
    thumbs                   : document.getElementById('thumbs-container'),
    previewStage             : document.querySelector('.preview-stage'),
    btnStart                 : document.getElementById('btn-start'),
    btnStop                  : document.getElementById('btn-stop'),
    audioMonitorRow          : document.getElementById('audio-monitor-row'),
    btnMonitorAudio          : document.getElementById('btn-monitor-audio'),
    panelAddSource           : document.getElementById('panel-add-source'),
    panelSubmix              : document.getElementById('panel-submix'),
    panelWatermark           : document.getElementById('panel-watermark'),
    cfgOutRes                : document.getElementById('cfg-out-res'),
    cfgFps                   : document.getElementById('cfg-fps'),
    cfgRenderMode            : document.getElementById('cfg-render-mode'),
    outputInitConfig         : document.getElementById('output-init-config'),
    submixList               : document.getElementById('submix-list'),
    submixStatus             : document.getElementById('submix-status'),
    panelSources             : document.getElementById('panel-sources'),
    statusBadge              : document.getElementById('status-badge'),
    overlay                  : document.getElementById('grid-overlay'),
    previewStageFrame        : document.getElementById('preview-stage-frame'),
    selectedSlotNumber       : document.getElementById('selected-slot-number'),
    selectedSlotSource       : document.getElementById('selected-slot-source'),
    selectedSlotWatermark    : document.getElementById('selected-slot-watermark'),
    selectedSlotMirror       : document.getElementById('selected-slot-mirror'),
    mirrorStatusLine         : document.getElementById('mirror-status-line'),
    btnGlobalMirror          : document.getElementById('btn-global-mirror'),
    btnOutputMirror          : document.getElementById('btn-output-mirror'),
    btnOutputWatermarkMirror : document.getElementById('btn-output-watermark-mirror'),
    btnSlotMirror            : document.getElementById('btn-slot-mirror'),
    btnSlotMirrorClear       : document.getElementById('btn-slot-mirror-clear'),
    wmOutputText             : document.getElementById('wm-output-text'),
    wmOutputTextPosition     : document.getElementById('wm-output-text-position'),
    wmOutputTextX            : document.getElementById('wm-output-text-x'),
    wmOutputTextY            : document.getElementById('wm-output-text-y'),
    wmOutputTextSize         : document.getElementById('wm-output-text-size'),
    wmOutputTextColor        : document.getElementById('wm-output-text-color'),
    wmOutputTextOpacity      : document.getElementById('wm-output-text-opacity'),
    wmOutputTextBgColor      : document.getElementById('wm-output-text-bg-color'),
    wmOutputImage            : document.getElementById('wm-output-image'),
    wmOutputImagePosition    : document.getElementById('wm-output-image-position'),
    wmOutputImageX           : document.getElementById('wm-output-image-x'),
    wmOutputImageY           : document.getElementById('wm-output-image-y'),
    wmOutputImageOpacity     : document.getElementById('wm-output-image-opacity'),
    wmSlotSelect             : document.getElementById('wm-slot-select'),
    wmSelectedSlot           : document.getElementById('wm-selected-slot'),
    wmSlotSourceState        : document.getElementById('wm-slot-source-state'),
    wmSlotWatermarkState     : document.getElementById('wm-slot-watermark-state'),
    wmSlotText               : document.getElementById('wm-slot-text'),
    wmSlotPosition           : document.getElementById('wm-slot-position'),
    wmSlotX                  : document.getElementById('wm-slot-x'),
    wmSlotY                  : document.getElementById('wm-slot-y'),
    wmSlotSize               : document.getElementById('wm-slot-size'),
    wmSlotColor              : document.getElementById('wm-slot-color'),
    wmSlotOpacity            : document.getElementById('wm-slot-opacity'),
    wmSlotBgColor            : document.getElementById('wm-slot-bg-color'),
    watermarkModeButtons     : document.querySelectorAll('[data-watermark-mode]'),
    watermarkSections        : document.querySelectorAll('[data-watermark-section]'),
    watermarkList            : document.getElementById('watermark-list'),
    statsLayout              : document.getElementById('stat-layout'),
    statsAudio               : document.getElementById('stat-audio'),
    statsAudioState          : document.getElementById('stat-audio-state'),
    statsSize                : document.getElementById('stat-size'),
    statsSources             : document.getElementById('stat-sources'),
    statsRenderer            : document.getElementById('stat-renderer'),
    statsRenderPath          : document.getElementById('stat-render-path'),
    statsOutputMode          : document.getElementById('stat-output-mode'),
    statsDropped             : document.getElementById('stat-dropped'),
    statsRenderReason        : document.getElementById('stat-render-reason'),
    stressCaseSeconds        : document.getElementById('stress-case-seconds'),
    stressSampleMs           : document.getElementById('stress-sample-ms'),
    stressSettleSeconds      : document.getElementById('stress-settle-seconds'),
    stressSourceKind         : document.getElementById('stress-source-kind'),
    stressSourceCounts       : document.getElementById('stress-source-counts'),
    stressInstanceCounts     : document.getElementById('stress-instance-counts'),
    stressOutputResolutions  : document.getElementById('stress-output-resolutions'),
    stressOutputFps          : document.getElementById('stress-output-fps'),
    stressRenderModes        : document.getElementById('stress-render-modes'),
    stressStatus             : document.getElementById('stress-status'),
    stressSummary            : document.getElementById('stress-summary'),
    stressPanel              : document.getElementById('panel-stress'),
    stressLauncher           : document.getElementById('stress-launcher'),
    stressCloseBtn           : document.getElementById('stress-close-btn'),
    stressDragHandle         : document.getElementById('stress-drag-handle')
  },

  // ==========================================================
  // UI 方法 — DOM 操作、事件绑定、界面更新
  // ==========================================================

  init()
  {
    for (let i = 0; i < this.maxDemoSources; i++)
    {
      const btn = document.createElement('div');

      btn.className = 'slot-btn';
      btn.innerText = this.formatSlotLabel(i);
      btn.dataset.slot = i;
      btn.onclick = () => this.selectSlot(i);
      this.ui.slotGrid.appendChild(btn);
    }
    for (let i = 0; i < this.maxDemoSources; i++)
    {
      const opt = document.createElement('option');

      opt.value = i;
      opt.innerText = `槽位 ${this.formatSlotLabel(i)}`;
      this.ui.wmSlotSelect.appendChild(opt);
    }
    this.ui.wmSlotSelect.onchange = () => this.selectSlot(parseInt(this.ui.wmSlotSelect.value, 10));
    this.selectSlot(0);

    this.ui.btnStart.onclick = () => this.start();
    this.ui.btnStop.onclick = () => this.stop();
    this.ui.btnMonitorAudio.onclick = () => this.toggleMonitorAudio();
    this.bindWatermarkPositionControls();
    this.bindWatermarkModeTabs();
    this.bindOutputResolutionControl();
    window.addEventListener('resize', () => this.syncPreviewFrameRatio());
    this.bindDataActions();
    this.bindStressPanel();
    this.updateMonitorAudioUI();
    this.setRunningUI(false);
    // 水印参数需要支持启动前编辑（用于构造参数验证）。
    this.setPanelEnabled(this.ui.panelWatermark, true);
  },

  bindOutputResolutionControl()
  {
    const select = document.getElementById('cfg-out-res');

    if (!select) return;

    select.addEventListener('change', () => this.syncPreviewFrameRatio());
    this.syncPreviewFrameRatio();
  },

  bindDataActions()
  {
    document.querySelectorAll('[data-action]').forEach((el) =>
    {
      el.addEventListener('click', (e) =>
      {
        const method = el.dataset.action;
        const args = el.dataset.args;

        if (args)
        {
          const parsed = JSON.parse(args);

          this[method](parsed);
        }
        else
        {
          this[method]();
        }
      });
    });
  },

  syncPreviewFrameRatio()
  {
    const frame = this.ui.previewStageFrame;
    const stage = this.ui.previewStage;

    if (!frame) return;

    let w = 0;
    let h = 0;
    const runtimeConfig = this.getOutputRuntimeConfig();

    if (runtimeConfig && Number.isFinite(runtimeConfig.width) && Number.isFinite(runtimeConfig.height))
    {
      w = runtimeConfig.width;
      h = runtimeConfig.height;
    }
    else
    {
      [ w, h ] = document.getElementById('cfg-out-res').value.split('x').map(Number);
    }

    if (!w || !h) return;
    if (!stage) return;

    const style = window.getComputedStyle(stage);
    const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const availW = Math.max(stage.clientWidth - padX, 0);
    const availH = Math.max(stage.clientHeight - padY, 0);

    if (!availW || !availH) return;

    const ratio = w / h;
    let fitW = availW;
    let fitH = fitW / ratio;

    if (fitH > availH)
    {
      fitH = availH;
      fitW = fitH * ratio;
    }

    frame.style.width = `${Math.floor(fitW)}px`;
    frame.style.height = `${Math.floor(fitH)}px`;
  },

  bindWatermarkModeTabs()
  {
    const buttons = this.ui.watermarkModeButtons || [];
    const sections = this.ui.watermarkSections || [];

    if (!buttons.length || !sections.length) return;

    const setMode = (mode) =>
    {
      buttons.forEach((btn) =>
      {
        btn.classList.toggle('active', btn.dataset.watermarkMode === mode);
      });
      sections.forEach((section) =>
      {
        section.classList.toggle('d-none', section.dataset.watermarkSection !== mode);
      });
    };

    buttons.forEach((btn) =>
    {
      btn.addEventListener('click', () => setMode(btn.dataset.watermarkMode || 'output'));
    });
    setMode('output');
  },

  bindWatermarkPositionControls()
  {
    const controls = [
      { select: this.ui.wmOutputTextPosition, selector: '.wm-output-text-coordinate' },
      { select: this.ui.wmOutputImagePosition, selector: '.wm-output-image-coordinate' },
      { select: this.ui.wmSlotPosition, selector: '.wm-slot-coordinate' }
    ];

    controls.forEach(({ select, selector }) =>
    {
      if (!select) return;

      const update = () =>
      {
        document.querySelectorAll(selector).forEach((field) =>
        {
          field.classList.toggle('d-none', select.value !== 'custom');
        });
      };

      select.addEventListener('change', update);
      update();
    });
  },

  setPanelEnabled(panel, enabled)
  {
    if (!panel) return;

    panel.classList.toggle('panel-disabled', !enabled);
    panel.querySelectorAll('button, input, select').forEach((el) =>
    {
      el.disabled = !enabled;
    });
  },

  setRunningUI(running)
  {
    this.setPanelEnabled(this.ui.panelSources, running);
    this.setPanelEnabled(this.ui.panelAddSource, running);
    this.setPanelEnabled(this.ui.panelSubmix, running);
    this.setOutputConfigLocked(running);
  },

  setOutputConfigLocked(locked)
  {
    [ this.ui.cfgOutRes, this.ui.cfgFps, this.ui.cfgRenderMode ].forEach((el) =>
    {
      if (!el) return;
      el.disabled = locked;
      el.title = locked ? '运行中不可修改，停止后可调整' : '';
    });

    const initConfigPanel = this.ui.outputInitConfig;

    if (!initConfigPanel) return;

    initConfigPanel.classList.toggle('compact-card-locked', locked);
    initConfigPanel.title = locked ? '运行中不可修改，停止后可调整' : '';
    initConfigPanel.querySelectorAll('input, select').forEach((el) =>
    {
      el.disabled = locked;
      el.title = locked ? '运行中不可修改，停止后可调整' : '';
    });
  },

  showNotification(msg, type = 'error')
  {
    const container = document.getElementById('toast-container');

    if (!container) return;

    const toast = document.createElement('div');

    toast.className = `toast-item toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(() =>
    {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  selectSlot(idx)
  {
    idx = this.clampSlot(idx);
    this.currentSlot = idx;
    const btns = this.ui.slotGrid.children;

    for (const b of btns)
    {
      const slot = parseInt(b.dataset.slot, 10);

      b.classList.toggle('active', slot === idx);
      b.classList.toggle('has-watermark', this.hasSlotWatermark(slot));
    }
    this.ui.selectedSlotNumber.innerText = this.formatSlotLabel(idx);
    this.ui.wmSlotSelect.value = String(idx);
    this.refreshSelectedSlotSummary();
    this.refreshWatermarkList();
  },

  updateSlotUI()
  {
    const occupied = new Set();

    this.getSources().forEach((s) => occupied.add(s.slot));

    const btns = this.ui.slotGrid.children;

    for (const b of btns)
    {
      const slot = parseInt(b.dataset.slot, 10);

      b.classList.toggle('occupied', occupied.has(slot));
      b.classList.toggle('has-watermark', this.hasSlotWatermark(slot));
    }

    Array.from(this.ui.thumbs.children).forEach((node) =>
    {
      if (!node || !node.dataset) return;
      node.classList.toggle('selected', parseInt(node.dataset.slot, 10) === this.currentSlot);
    });
    this.refreshSelectedSlotSummary();
  },

  refreshSelectedSlotSummary()
  {
    const source = this.getSelectedSource();
    const hasWatermark = this.hasSlotWatermark(this.currentSlot);
    const mirrorState = this.getCurrentSlotMirrorState();
    const sourceState = source ? `已占用 · ${source.id}` : '无源';
    const watermarkState = hasWatermark ? '已设置 slot 水印' : '无 slot 水印';
    const mirrorText = mirrorState.effective ? '镜像开启' : '镜像关闭';
    const slotLabel = this.formatSlotLabel(this.currentSlot);

    this.ui.selectedSlotSource.innerText = sourceState;
    this.ui.selectedSlotWatermark.innerText = watermarkState;
    if (this.ui.selectedSlotMirror)
    {
      this.ui.selectedSlotMirror.innerText = mirrorText;
    }
    this.ui.wmSelectedSlot.innerText = slotLabel;
    this.ui.wmSlotSourceState.innerText = source ? `源 ${source.id}` : '无源';
    this.ui.wmSlotWatermarkState.innerText = watermarkState;
    this.ui.wmSlotSelect.value = String(this.currentSlot);
    this.refreshMirrorDemoUI();
  },

  getCurrentSlotMirrorState()
  {
    const sourceMirrorConfig = this.getSourceMirror();
    const slotState = this.getSourceMirror(this.currentSlot);
    const source = this.getSelectedSource();
    const globalMirror = Boolean(sourceMirrorConfig && sourceMirrorConfig.global);
    const slotOverride = slotState ? slotState.override : null;
    const sourceMirror = source && typeof source.sourceMirror === 'boolean' ? source.sourceMirror : null;
    const effective = slotState ? slotState.effective : globalMirror;

    return {
      globalMirror,
      slotOverride,
      sourceMirror,
      effective
    };
  },

  refreshMirrorDemoUI()
  {
    const mirrorState = this.getCurrentSlotMirrorState();
    const outputMirror = this.getMirror();
    const watermarkMirror = this.getOutputWatermarkMirror();
    const slotText = mirrorState.slotOverride === null ?
      '跟随全局' :
      (mirrorState.slotOverride ? '覆盖开启' : '覆盖关闭');

    if (this.ui.mirrorStatusLine)
    {
      this.ui.mirrorStatusLine.innerText =
        `当前槽位镜像:${slotText === '跟随全局' ? '跟随' : (slotText === '覆盖开启' ? '开' : '关')} · 输出镜像:${outputMirror ? '开' : '关'} · 水印跟随:${watermarkMirror ? '开' : '关'}`;
    }

    if (this.ui.btnGlobalMirror)
    {
      this.ui.btnGlobalMirror.innerText = mirrorState.globalMirror ? '关闭源默认镜像' : '开启源默认镜像';
    }

    if (this.ui.btnOutputMirror)
    {
      this.ui.btnOutputMirror.innerText = outputMirror ? '输出镜像: 开' : '输出镜像: 关';
    }

    if (this.ui.btnOutputWatermarkMirror)
    {
      this.ui.btnOutputWatermarkMirror.innerText = watermarkMirror ? '水印跟随: 开' : '水印跟随: 关';
    }

    if (this.ui.btnSlotMirror)
    {
      const slotLabel = this.formatSlotLabel(this.currentSlot);

      this.ui.btnSlotMirror.innerText = `槽位 ${slotLabel} 镜像`;
    }

    if (this.ui.btnSlotMirrorClear)
    {
      this.ui.btnSlotMirrorClear.disabled = mirrorState.slotOverride === null;
    }
  },

  async toggleGlobalMirror()
  {
    if (!this.isRunning()) return;

    const sourceMirror = this.getSourceMirror();
    const next = !(sourceMirror && sourceMirror.global);

    if (!await this.setSourceMirror(next)) return;
    this.refreshSelectedSlotSummary();
    this.updateStats();
  },

  async toggleOutputMirror()
  {
    if (!this.isRunning()) return;

    const next = !this.getMirror();

    if (!await this.setMirror(next)) return;
    this.refreshSelectedSlotSummary();
    this.updateStats();
  },

  async toggleOutputWatermarkMirror()
  {
    if (!this.isRunning()) return;

    const next = !this.getOutputWatermarkMirror();

    if (!await this.setOutputWatermarkMirror(next)) return;
    this.refreshSelectedSlotSummary();
    this.updateStats();
  },

  async toggleCurrentSlotMirror()
  {
    if (!this.isRunning()) return;

    const mirrorState = this.getCurrentSlotMirrorState();
    const next = mirrorState.slotOverride === null ?
      !mirrorState.effective :
      !mirrorState.slotOverride;

    if (!await this.setSourceMirror(this.currentSlot, next)) return;
    this.refreshSelectedSlotSummary();
    this.updateStats();
  },

  async clearCurrentSlotMirror()
  {
    if (!this.isRunning()) return;
    if (!await this.clearSourceMirror(this.currentSlot)) return;
    this.refreshSelectedSlotSummary();
    this.updateStats();
  },

  refreshWatermarkList()
  {
    if (!this.ui.watermarkList) return;

    const watermarks = this.getWatermarkSnapshot();

    if (!watermarks.length)
    {
      this.ui.watermarkList.innerHTML = '<div class="submix-empty">暂无水印</div>';
      this.updateSlotUI();

      return;
    }

    this.ui.watermarkList.innerHTML = '';
    watermarks.forEach((item) =>
    {
      const row = document.createElement('div');

      row.className = 'watermark-item';

      const statusClass = item.status === 'ready' ? 'ready' : '';
      const positionText = item.position && typeof item.position === 'object'
        ? `(${item.position.x},${item.position.y})`
        : (item.position || '-');

      row.innerHTML = `
                <div class="watermark-id">${item.id}</div>
                <div class="pill ${statusClass}">${item.status || '-'}</div>
                <div class="watermark-meta">target=${item.target} · slot=${item.slot === null || item.slot === undefined ? '-' : item.slot} · type=${item.type} · position=${positionText} · reason=${item.reason || '-'}</div>
            `;
      this.ui.watermarkList.appendChild(row);
    });
    this.updateSlotUI();
  },

  addThumb(stream, label, slot)
  {
    const existing = document.querySelector(`.source-thumb[data-slot="${slot}"]`);

    if (existing) existing.remove();
    if (this.ui.thumbs.innerText.includes('暂无')) this.ui.thumbs.innerHTML = '';

    const div = document.createElement('div');

    div.className = 'source-thumb';
    div.dataset.slot = slot;
    div.id = `thumb-${stream.id}`;
    const hasVideo = stream.getVideoTracks().length > 0;
    const hasAudio = stream.getAudioTracks().length > 0;
    const meta = stream.demoMeta || {};
    const mediaMarkup = hasVideo
      ? '<video autoplay muted playsinline></video>'
      : `<div class="media-placeholder">♪<br>${meta.note || 'Audio'}</div>`;
    const trackInfo = `${hasVideo ? 'V' : '-'} / ${hasAudio ? 'A' : '-'}${meta.note ? ` · ${ meta.note}` : ''}`;
    const slotLabel = this.formatSlotLabel(slot);

    div.innerHTML = `
            <div class="slot-tag">${slotLabel}</div>
            <div class="remove-btn" onclick="app.removeSource('${stream.id}')">&times;</div>
            ${mediaMarkup}
            <div class="info">
                <div class="info-title">${label}</div>
                <div class="info-meta">${trackInfo}</div>
            </div>
        `;
    const video = div.querySelector('video');

    if (video) video.srcObject = stream;

    const thumbs = Array.from(this.ui.thumbs.children);
    const nextThumb = thumbs.find((t) => parseInt(t.dataset.slot, 10) > slot);

    if (nextThumb) this.ui.thumbs.insertBefore(div, nextThumb);
    else this.ui.thumbs.appendChild(div);
  },

  rebuildThumbsFromLocalStreams()
  {
    if (!this.ui.thumbs) return;

    const sorted = this.localStreams.slice().sort((a, b) => a.slot - b.slot);

    this.ui.thumbs.innerHTML = '';
    sorted.forEach((item) => this.addThumb(item.stream, item.label || '输入源', item.slot));
    if (!sorted.length)
    {
      this.ui.thumbs.innerHTML = '<div class="source-strip-empty">(暂无输入源)</div>';
    }
  },

  updateMonitorAudioUI()
  {
    if (!this.ui.btnMonitorAudio) return;

    this.ui.btnMonitorAudio.innerText = this.monitorAudio ? '🔇 停止监听' : '🔊 监听输出';
    const hasAudioSource = this.getSources().some((source) => source && source.hasAudio);

    this.ui.btnMonitorAudio.disabled = !this.isRunning() || !hasAudioSource;
    this.ui.btnMonitorAudio.title = this.ui.btnMonitorAudio.disabled && this.isRunning() && !hasAudioSource
      ? '当前没有可混音的音频输入源'
      : '';
  },

  ensureSubmixEmptyState()
  {
    if (!this.ui.submixList || this.activeSubmixes.size > 0) return;

    this.ui.submixList.innerHTML = '<div class="submix-empty">暂无子混音</div>';
  },

  updateStats()
  {
    if (!this.isRunning()) return;
    this.syncPreviewFrameRatio();

    const sources = this.getSources();
    const ac = sources.filter((s) => s.hasAudio).length;
    const audioInfo = this.getAudioInfo();

    this.ui.statsSources.innerText = sources.length;
    this.ui.statsAudio.innerText = ac;
    this.ui.statsAudioState.innerText = audioInfo ? `${audioInfo.status} (${audioInfo.connectedSources}/${audioInfo.liveSourceCount})` : '-';
    const layout = this.calcLayoutFromSources(sources);

    this.drawOverlay(layout.cols, layout.rows);
    this.updateRenderInfo();
  },

  refreshStats()
  {
    if (!this.isRunning())
    {
      this.ui.statsSize.innerText = '-';
      this.ui.statsLayout.innerText = '-';
      this.ui.statsSources.innerText = '0';
      this.ui.statsAudio.innerText = '0';
      this.ui.statsAudioState.innerText = '-';
      this.ui.statsRenderer.innerText = '-';
      this.ui.statsRenderPath.innerText = '-';
      this.ui.statsOutputMode.innerText = '-';
      this.ui.statsDropped.innerText = '0';
      this.ui.statsRenderReason.innerText = '-';

      return;
    }
    const outputSettings = this.getOutputRuntimeConfig();
    const fpsText = outputSettings && Number.isFinite(outputSettings.frameRate) ? outputSettings.frameRate : '-';

    this.ui.statsSize.innerText = outputSettings
      ? `${outputSettings.width || '-'}x${outputSettings.height || '-'} @ ${fpsText}fps`
      : '-';
    this.updateStats();
  },

  updateSubmixStatus()
  {
    if (!this.ui.submixStatus) return;

    if (!this.activeSubmixes.size)
    {
      this.ui.submixStatus.innerText = '-';

      return;
    }

    this.ui.submixStatus.innerText = Array.from(this.activeSubmixes.keys()).join(' | ');
  },

  updateRenderInfo()
  {
    const info = this.getRenderInfo();

    if (!info) return;

    this.ui.statsRenderer.innerText = `${info.actualMode} (${info.requestedMode})`;
    this.ui.statsRenderPath.innerText = this.formatRenderPathText(info);
    this.ui.statsOutputMode.innerText = this.formatOutputModeText(info);
    this.ui.statsDropped.innerText = info.droppedFrames || 0;
    this.ui.statsRenderReason.innerText = info.reason || '-';
    this.logRenderPathIfChanged(info);
  },

  formatRenderPathText(info)
  {
    if (!info) return '-';

    const backend = info.actualMode || '-';
    const worker = info.isWorker ? 'worker' : 'main';
    const renderer = info.isWebGL2 ? 'webgl2' : '2d';
    const fallback = info.isFallback ? 'fallback' : 'normal';

    return `${backend} | ${worker} | ${renderer} | ${fallback}`;
  },

  logRenderPathIfChanged(info)
  {
    if (!info) return;

    const signature = [
      info.requestedMode || '',
      info.actualMode || '',
      info.isWorker ? 1 : 0,
      info.isWebGL2 ? 1 : 0,
      info.isFallback ? 1 : 0,
      info.reason || ''
    ].join('|');

    if (signature === this.lastRenderPathSignature) return;

    this.lastRenderPathSignature = signature;

    console.info(
      `[MediaStreamComposerDemo][RenderPath] requested=${info.requestedMode || '-'} actual=${info.actualMode || '-'} ` +
      `worker=${Boolean(info.isWorker)} webgl2=${Boolean(info.isWebGL2)} fallback=${Boolean(info.isFallback)} ` +
      `dropped=${info.droppedFrames || 0} rendered=${info.renderedFrames || 0} reason=${info.reason || '-'} ` +
      `outputMode=${info.outputMode || '-'} insertableActive=${Boolean(info.insertableActive)} ` +
      `insertableSupported=${Boolean(info.insertableSupported)} generator=${info.insertableGeneratorType || '-'} ` +
      `supportReason=${info.insertableSupportReason || '-'} writeFailures=${info.insertableWriteFailures || 0} ` +
      `captureFrameControl=${info.captureFrameControlMode || '-'}`
    );
  },

  formatOutputModeText(info)
  {
    if (!info) return '-';

    const mode = info.outputMode || '-';
    const active = info.insertableActive ? 'active' : 'inactive';
    const supported = info.insertableSupported ? 'supported' : 'unsupported';
    const generator = info.insertableGeneratorType || '-';
    const reason = info.insertableSupportReason || '-';

    if (mode === 'insertable')
    {
      return `${mode} | ${active} | ${generator}`;
    }

    return `${mode} | ${info.captureFrameControlMode || '-'} | ${supported} | ${reason}`;
  },

  startRenderInfoLoop()
  {
    const tick = () =>
    {
      if (!this.isRunning()) return;
      this.updateRenderInfo();
      requestAnimationFrame(tick);
    };

    tick();
  },

  drawOverlay(cols, rows)
  {
    this.syncPreviewFrameRatio();
    this.ui.overlay.style.width = '100%';
    this.ui.overlay.style.height = '100%';
    this.ui.overlay.innerHTML = '';
    this.ui.statsLayout.innerText = `${cols}x${rows}`;
    const wPct = 100 / cols, hPct = 100 / rows;

    for (let r = 0; r < rows; r++)
    {
      for (let c = 0; c < cols; c++)
      {
        const div = document.createElement('div');

        div.className = 'grid-cell-label';
        div.style.left = `${c * wPct }%`;
        div.style.top = `${r * hPct }%`;
        div.style.width = `${wPct }%`;
        div.style.height = `${hPct }%`;
        div.innerText = this.formatSlotLabel(r * cols + c);
        this.ui.overlay.appendChild(div);
      }
    }
  },

  startViz(stream)
  {
    const token = ++this.vizToken;
    const audioTracks = stream.getAudioTracks();
    const cvs = document.getElementById('viz-canvas');
    const ctx = cvs.getContext('2d');

    if (audioTracks.length === 0)
    {
      cvs.width = cvs.clientWidth;
      cvs.height = cvs.clientHeight;
      ctx.clearRect(0, 0, cvs.width, cvs.height);

      return;
    }

    const ac = new AudioContext();
    const src = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser();

    an.fftSize = 128;
    src.connect(an);
    const data = new Uint8Array(an.frequencyBinCount);
    const draw = () =>
    {
      if (!this.isRunning() || token !== this.vizToken)
      {
        ac.close();

        return;
      }
      requestAnimationFrame(draw);
      cvs.width = cvs.clientWidth; cvs.height = cvs.clientHeight;
      an.getByteFrequencyData(data);
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      const barW = (cvs.width / data.length) * 2.5;
      let x = 0;

      for (let i = 0; i < data.length; i++)
      {
        const h = (data[i] / 255) * cvs.height;

        ctx.fillStyle = `rgb(${h + 50}, 220, 100)`;
        ctx.fillRect(x, cvs.height - h, barW, h);
        x += barW + 1;
      }
    };

    draw();
  },

  createVideoOnlyPreviewStream(stream)
  {
    if (!stream) return null;

    return new MediaStream(stream.getVideoTracks());
  },

  async setPreviewStream(stream, { muted = true, suppressPlayError = false } = {})
  {
    if (!stream) return;

    this.ui.mixedVideo.srcObject = stream;
    this.ui.mixedVideo.muted = muted;
    this.startViz(stream);
    try
    {
      await this.ui.mixedVideo.play();
    }
    catch (e)
    {
      if (!suppressPlayError) throw e;
    }
  },

  isBenignMediaPlayInterruption(error)
  {
    const message = error && error.message ? String(error.message) : '';

    return message.indexOf('interrupted by a new load request') !== -1 ||
      message.indexOf('The play() request was interrupted') !== -1 ||
      message.indexOf('AbortError') !== -1;
  },

  // ==========================================================
  // UI 回调 — 被 app-media-stream-composer.js 中的 SDK 方法调用
  // ==========================================================

  onComposerStarting()
  {
    this.outputVideoStream = null;
    this.outputMixedStream = null;
    this.outputRuntimeConfig = null;
    this.stopOutputWebAudioPlayback();
    this.ui.mixedVideo.muted = true;
    this.stopAllSubmixes();
    this.updateMonitorAudioUI();
  },

  onComposerStarted(outStream, w, h, fps)
  {
    this.outputVideoStream = outStream;
    this.outputMixedStream = null;
    this.outputRuntimeConfig = { width: w, height: h, frameRate: fps };
    this.setPreviewStream(this.createVideoOnlyPreviewStream(outStream), {
      muted             : true,
      suppressPlayError : true
    });

    this.ui.btnStart.style.display = 'none';
    this.ui.btnStop.style.display = 'block';
    this.ui.audioMonitorRow.style.display = 'block';
    this.setRunningUI(true);
    this.ui.panelSubmix.classList.add('active');
    this.ui.statusBadge.innerText = '运行中';
    this.ui.statusBadge.className = 'badge bg-success align-self-center';
    this.refreshStats();
    this.syncPreviewFrameRatio();
    this.ui.thumbs.innerHTML = '';
    this.updateRenderInfo();
    this.refreshSelectedSlotSummary();
    this.refreshMirrorDemoUI();
    this.refreshWatermarkList();
    this.startRenderInfoLoop();
  },

  onComposerStartError(e)
  {
    this.showNotification(`启动失败: ${e.message}`);
  },

  onComposerStopped()
  {
    this.localStreams.forEach((item) =>
    {
      const s = item.stream || item;

      s.getTracks().forEach((t) => t.stop());
      if (s.stopInternal) s.stopInternal();
    });
    this.localStreams = [];
    this.counter = 0;
    this.monitorAudio = false;
    this.outputVideoStream = null;
    this.outputMixedStream = null;
    this.outputRuntimeConfig = null;
    this.stopOutputWebAudioPlayback();
    this.vizToken++;
    this.stopAllSubmixes();
    this.closeSubmixPlaybackContext();
    this.ui.mixedVideo.srcObject = null;
    this.ui.mixedVideo.muted = true;
    this.ui.btnStart.style.display = 'block';
    this.ui.btnStop.style.display = 'none';
    this.ui.audioMonitorRow.style.display = 'none';
    this.setRunningUI(false);
    this.ui.panelSubmix.classList.remove('active');
    this.ui.statusBadge.innerText = '已停止';
    this.ui.statusBadge.className = 'badge bg-secondary align-self-center';
    this.ui.thumbs.innerHTML = '<div class="source-strip-empty">(暂无输入源)</div>';
    this.ui.overlay.innerHTML = '';
    this.ui.statsAudioState.innerText = '-';
    this.ui.statsRenderer.innerText = '-';
    this.ui.statsRenderPath.innerText = '-';
    this.ui.statsOutputMode.innerText = '-';
    this.ui.statsDropped.innerText = '0';
    this.ui.statsRenderReason.innerText = '-';
    this.lastRenderPathSignature = '';
    this.updateMonitorAudioUI();
    this.updateSlotUI();
    this.refreshSelectedSlotSummary();
    this.refreshMirrorDemoUI();
    this.refreshWatermarkList();
    this.resetConfigUI();
  },

  /**
   * 停止后重置所有配置控件到默认值。
   */
  resetConfigUI()
  {
    this.currentSlot = 0;
    const defaults = {
      'cfg-out-res'              : '1280x720',
      'cfg-fps'                  : '15',
      'cfg-render-mode'          : 'auto',
      'cfg-ctor-output-mirror'   : 'off',
      'cfg-ctor-output-watermark-mirror' : 'off',
      'cfg-in-res'               : 'auto',
      'cfg-in-fps'               : '15',
      'wm-output-text'           : 'CRTC 直播',
      'wm-output-text-position'  : 'bottom-right',
      'wm-output-text-color'     : '#ffffff',
      'wm-output-text-bg-color'  : 'rgba(0,0,0,0.45)',
      'wm-output-text-size'      : '28',
      'wm-output-text-x'         : '16',
      'wm-output-text-y'         : '16',
      'wm-output-image'          : '',
      'wm-output-image-position' : 'top-right',
      'wm-output-image-x'        : '16',
      'wm-output-image-y'        : '16',
      'wm-output-image-url'      : '',
      'wm-slot-text'             : 'Slot',
      'wm-slot-position'         : 'bottom-left',
      'wm-slot-x'                : '12',
      'wm-slot-y'                : '12',
      'wm-slot-size'             : '28',
      'wm-slot-color'            : '#ffffff',
      'wm-slot-bg-color'         : 'rgba(0,0,0,0.45)'
    };

    Object.entries(defaults).forEach(([ id, val ]) =>
    {
      const el = document.getElementById(id);

      if (el) el.value = val;
    });
    const ctorWatermarkCheckbox = document.getElementById('cfg-ctor-watermarks');

    if (ctorWatermarkCheckbox) ctorWatermarkCheckbox.checked = false;
    this.syncPreviewFrameRatio();
    this.selectSlot(0);
    this.refreshMirrorDemoUI();
    this.refreshWatermarkList();
  },

  // ==========================================================
  // 子混音管理 — 音频监听 UI 与 WebAudio 播放
  // ==========================================================

  toggleMonitorAudio()
  {
    if (!this.isRunning() || !this.outputVideoStream) return;

    const enable = !this.monitorAudio;

    this.ui.btnMonitorAudio.disabled = true;
    if (enable)
    {
      return this.getOutputMixedStream()
        .then(async(stream) =>
        {
          if (!stream) return;

          this.outputMixedStream = stream;
          // 监听输出只切换音频链路，不重绑视频预览，避免 video 元素闪烁。
          await this.startOutputWebAudioPlayback(stream);
          this.monitorAudio = true;
          this.startViz(stream);
        })
        .catch((e) =>
        {
          this.monitorAudio = false;
          this.stopOutputWebAudioPlayback();
          this.startViz(this.createVideoOnlyPreviewStream(this.outputVideoStream));
          if (e && e.code === 'NO_AUDIO_TRACK')
          {
            this.showNotification(e.message, 'warning');
          }
          else if (!this.isBenignMediaPlayInterruption(e))
          {
            this.showNotification(`监听输出失败: ${e.message}`);
          }
        })
        .finally(() =>
        {
          this.updateMonitorAudioUI();
        });
    }

    this.monitorAudio = false;
    this.stopOutputWebAudioPlayback();
    this.startViz(this.createVideoOnlyPreviewStream(this.outputVideoStream));
    this.updateMonitorAudioUI();

    return Promise.resolve();
  },

  listenSelectedSlotSubmix()
  {
    this.listenSubmix([ this.currentSlot ]);
  },

  pauseOtherSubmixes(activeKey)
  {
    this.activeSubmixes.forEach((item, key) =>
    {
      if (key !== activeKey)
      {
        item.isPlaying = false;
        this.stopSubmixWebAudioPlayback(item);
        this.updateSubmixControlUI(item);
      }
    });
  },

  updateSubmixControlUI(submix)
  {
    if (!submix) return;

    if (submix.playButton)
    {
      submix.playButton.innerText = submix.isPlaying ? '暂停' : '播放';
    }

    if (submix.muteButton)
    {
      submix.muteButton.innerText = submix.isMuted ? '🔇' : '🔊';
      submix.muteButton.setAttribute('aria-label', submix.isMuted ? '取消静音' : '静音');
    }

    if (submix.volumeInput)
    {
      submix.volumeInput.value = String(Math.round((submix.volume || 1) * 100));
    }
  },

  applySubmixGain(submix)
  {
    if (!submix || !submix.playbackSources) return;

    const gainValue = submix.isMuted ? 0 : (submix.volume || 1);

    submix.playbackSources.forEach((item) =>
    {
      if (item.gain && item.gain.gain)
      {
        item.gain.gain.value = gainValue;
      }
    });
  },

  stopOutputWebAudioPlayback()
  {
    if (!this.outputPlayback) return;
    const item = this.outputPlayback;

    try { item.source.disconnect(); }
    catch (e) {}
    try { item.gain.disconnect(); }
    catch (e) {}
    if (item.ownedTracks && item.ownedTracks.length)
    {
      item.ownedTracks.forEach((track) =>
      {
        try { track.stop(); }
        catch (e) {}
      });
    }
    this.outputPlayback = null;
  },

  async startOutputWebAudioPlayback(stream)
  {
    this.stopOutputWebAudioPlayback();
    if (!stream) return;

    const ctx = await this.ensureSubmixPlaybackContext();
    const tracks = stream.getAudioTracks
      ? stream.getAudioTracks().filter((track) => track && track.readyState === 'live')
      : [];
    let playbackStream = stream;
    let ownedTracks = [];

    if (!tracks.length)
    {
      const error = new Error('当前输出暂无音频轨道，请先添加带音频的输入源');

      error.code = 'NO_AUDIO_TRACK';
      throw error;
    }

    if (tracks.length)
    {
      const clonedTracks = tracks.map((track) =>
      {
        try { return track.clone ? track.clone() : null; }
        catch (e) { return null; }
      }).filter(Boolean);

      if (clonedTracks.length)
      {
        playbackStream = new MediaStream(clonedTracks);
        ownedTracks = clonedTracks;
      }
    }

    const source = ctx.createMediaStreamSource(playbackStream);
    const gain = ctx.createGain();

    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(ctx.destination);
    this.outputPlayback = { source, gain, ownedTracks };
  },

  toggleSubmixPlay(key)
  {
    const submix = this.activeSubmixes.get(key);

    if (!submix || !submix.audio || !submix.audio.srcObject) return;

    if (submix.isPlaying)
    {
      submix.isPlaying = false;
      this.stopSubmixWebAudioPlayback(submix);
      this.updateSubmixControlUI(submix);

      return;
    }

    this.startSubmixWebAudioPlayback(submix, submix.audio.srcObject)
      .then(() =>
      {
        submix.isPlaying = true;
        this.applySubmixGain(submix);
        this.updateSubmixControlUI(submix);
      })
      .catch(() => {});
  },

  toggleSubmixMute(key)
  {
    const submix = this.activeSubmixes.get(key);

    if (!submix) return;

    submix.isMuted = !submix.isMuted;
    this.applySubmixGain(submix);
    this.updateSubmixControlUI(submix);
  },

  setSubmixVolume(key, value)
  {
    const submix = this.activeSubmixes.get(key);

    if (!submix) return;

    const normalized = Math.max(0, Math.min(1, Number(value)));

    submix.volume = Number.isFinite(normalized) ? normalized : 1;
    this.applySubmixGain(submix);
    this.updateSubmixControlUI(submix);
  },

  ensureSubmixPlaybackContext()
  {
    if (!this.submixPlaybackCtx)
    {
      this.submixPlaybackCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (this.submixPlaybackCtx.state === 'suspended')
    {
      return this.submixPlaybackCtx.resume().then(() => this.submixPlaybackCtx);
    }

    return Promise.resolve(this.submixPlaybackCtx);
  },

  async startSubmixWebAudioPlayback(submix, fallbackStream)
  {
    this.stopSubmixWebAudioPlayback(submix);
    const ctx = await this.ensureSubmixPlaybackContext();
    const streams = [];

    if (fallbackStream)
    {
      let playbackStream = fallbackStream;
      let ownedTracks = [];
      const tracks = fallbackStream.getAudioTracks ? fallbackStream.getAudioTracks() : [];

      if (tracks.length)
      {
        const clonedTracks = tracks.map((track) =>
        {
          try { return track.clone ? track.clone() : null; }
          catch (e) { return null; }
        }).filter(Boolean);

        if (clonedTracks.length)
        {
          playbackStream = new MediaStream(clonedTracks);
          ownedTracks = clonedTracks;
        }
      }

      streams.push({ stream: playbackStream, ownedTracks });
    }

    submix.playbackSources = streams.map((item) =>
    {
      const source = ctx.createMediaStreamSource(item.stream);
      const gain = ctx.createGain();

      gain.gain.value = submix && submix.isMuted ? 0 : ((submix && submix.volume) || 1);
      source.connect(gain);
      gain.connect(ctx.destination);

      return { source, gain, stream: item.stream, ownedTracks: item.ownedTracks || [] };
    });
  },

  stopSubmixWebAudioPlayback(submix)
  {
    if (!submix || !submix.playbackSources) return;

    submix.playbackSources.forEach((item) =>
    {
      try { item.source.disconnect(); }
      catch (e) { }
      try { item.gain.disconnect(); }
      catch (e) { }
      if (item.ownedTracks && item.ownedTracks.length)
      {
        item.ownedTracks.forEach((track) =>
        {
          try { track.stop(); }
          catch (e) { }
        });
      }
    });
    submix.playbackSources = [];
  },

  closeSubmixPlaybackContext()
  {
    if (!this.submixPlaybackCtx) return;

    try { this.submixPlaybackCtx.close(); }
    catch (e) { }
    this.submixPlaybackCtx = null;
  },

  ensureSubmixItem(key, slots)
  {
    const existing = this.activeSubmixes.get(key);

    if (existing) return existing;

    const emptyEl = this.ui.submixList.querySelector('.submix-empty');

    if (emptyEl) emptyEl.remove();

    const row = document.createElement('div');

    row.className = 'submix-item';
    row.dataset.key = key;

    const label = document.createElement('div');

    label.className = 'submix-label';
    label.innerText = `槽位 ${this.formatSlotList(slots)}`;

    const stopButton = document.createElement('button');

    stopButton.className = 'btn btn-outline-danger btn-submix-stop';
    stopButton.innerText = '停止';
    stopButton.onclick = () => this.stopSubmix(slots);

    const controls = document.createElement('div');

    controls.className = 'submix-controls';

    const playButton = document.createElement('button');

    playButton.className = 'btn btn-outline-primary btn-submix-play';
    playButton.innerText = '暂停';
    playButton.onclick = () => this.toggleSubmixPlay(key);

    const muteButton = document.createElement('button');

    muteButton.className = 'btn btn-outline-secondary btn-submix-mute';
    muteButton.innerText = '🔊';
    muteButton.onclick = () => this.toggleSubmixMute(key);
    
    const volumeInput = document.createElement('input');

    volumeInput.type = 'range';
    volumeInput.className = 'submix-volume';
    volumeInput.min = '0';
    volumeInput.max = '100';
    volumeInput.step = '1';
    volumeInput.value = '100';
    volumeInput.oninput = (event) =>
    {
      this.setSubmixVolume(key, Number(event.target.value) / 100);
    };

    controls.appendChild(playButton);
    controls.appendChild(muteButton);
    controls.appendChild(stopButton);
    controls.appendChild(volumeInput);

    const audio = document.createElement('audio');

    audio.autoplay = false;
    audio.controls = false;
    audio.muted = true;
    audio.playsInline = true;
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.style.display = 'none';

    row.appendChild(label);
    row.appendChild(controls);
    row.appendChild(audio);
    this.ui.submixList.appendChild(row);

    const submix = {
      key,
      slots          : slots.slice(),
      row,
      label,
      audio,
      controls,
      playButton,
      muteButton,
      volumeInput,
      isolated       : true,
      playbackSource : null,
      isPlaying      : true,
      isMuted        : false,
      volume         : 1
    };

    this.activeSubmixes.set(key, submix);
    this.updateSubmixControlUI(submix);
    this.updateSubmixStatus();

    return submix;
  },

  stopSubmix(slots)
  {
    const normalizedSlots = this.normalizeSubmixSlots(slots);

    if (!normalizedSlots.length) return;

    this.removeSubmixItem(normalizedSlots.join(','));
  },

  removeSubmixItem(key)
  {
    const submix = this.activeSubmixes.get(key);

    if (!submix) return;

    submix.isPlaying = false;
    this.stopSubmixWebAudioPlayback(submix);
    this.releaseSubmixAudioRequest(submix.slots, submix.isolated !== false);
    submix.audio.srcObject = null;
    submix.row.remove();
    this.activeSubmixes.delete(key);
    this.updateSubmixStatus();
    this.ensureSubmixEmptyState();
  },

  stopAllSubmixes()
  {
    Array.from(this.activeSubmixes.keys()).forEach((key) => this.removeSubmixItem(key));
    this.updateSubmixStatus();
    this.ensureSubmixEmptyState();
  },

  refreshActiveSubmix()
  {
    if (!this.activeSubmixes.size) return;

    Array.from(this.activeSubmixes.values()).forEach((submix) =>
    {
      this.listenSubmix(submix.slots, { silent: true, play: false });
    });
  },

  // ==========================================================
  // 输入源创建 — VirtualGen / getUserMedia / getDisplayMedia
  // ==========================================================

  _createVirtual(options)
  {
    this.counter++;
    let w = 640, h = 360;
    const resVal = document.getElementById('cfg-in-res').value;

    if (resVal !== 'auto') [ w, h ] = resVal.split('x').map(Number);

    const fps = parseInt(document.getElementById('cfg-in-fps').value);
    const s = VirtualGen.create(w, h, fps, options.label, this.counter, options);

    this._handleStreamAdd(s, options.thumbLabel);
  },

  addVirtual()
  {
    const next = this.counter + 1;

    this._createVirtual({
      video      : true,
      audio      : true,
      label      : `SRC-${next}`,
      thumbLabel : `音视频 ${next}`
    });
  },

  addVirtualVideoOnly()
  {
    const next = this.counter + 1;

    this._createVirtual({
      video      : true,
      audio      : false,
      label      : `VIDEO-${next}`,
      videoText  : 'VIDEO ONLY',
      thumbLabel : `仅视频 ${next}`
    });
  },

  addVirtualAudioOnly()
  {
    const next = this.counter + 1;

    this._createVirtual({
      video      : false,
      audio      : true,
      label      : `AUDIO-${next}`,
      thumbLabel : `仅音频 ${next}`
    });
  },

  async addCamera()
  {
    try
    {
      const constraints = { video: {}, audio: true };
      const resVal = document.getElementById('cfg-in-res').value;

      if (resVal !== 'auto')
      {
        const [ w, h ] = resVal.split('x').map(Number);

        constraints.video.width = { ideal: w };
        constraints.video.height = { ideal: h };
      }

      const fps = parseInt(document.getElementById('cfg-in-fps').value);

      constraints.video.frameRate = { ideal: fps };

      const s = await navigator.mediaDevices.getUserMedia(constraints);

      this._handleStreamAdd(s, '摄像头');
    }
    catch (e) { this.showNotification(`摄像头失败: ${e.message}`); }
  },

  async addScreen()
  {
    try
    {
      const fps = parseInt(document.getElementById('cfg-in-fps').value);
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: fps }, audio: true });

      this._handleStreamAdd(s, '屏幕共享');

      s.getVideoTracks()[0].onended = () => this.removeSource(s.id);
    }
    catch (e) { this.showNotification(`屏幕共享失败: ${e.message}`); }
  },

  clearAll()
  {
    [ ...this.localStreams ].forEach((item) => this.removeSource(item.stream.id));
  },

  removeLocalStreamBySlot(slot)
  {
    const oldItem = this.localStreams.find((item) => item.slot === slot);

    if (!oldItem) return;
    this.removeSource(oldItem.stream.id);
  },

  // ==========================================================
  // 水印编排 — 构造水印配置并调用 MediaStreamComposer SDK 方法
  // ==========================================================

  async applyOutputTextWatermark()
  {
    const next = this.getWatermarkSnapshot().filter((item) => item.target !== 'output');

    next.push(this.buildOutputTextWatermark());
    const imageWatermark = this.buildOutputImageWatermark();

    if (imageWatermark) next.push(imageWatermark);

    await this.applyWatermarks(next);
  },

  async applyOutputImageWatermark()
  {
    const watermark = this.buildOutputImageWatermark();

    if (!watermark) return;

    const next = this.getWatermarkSnapshot().filter((item) => item.target !== 'output');

    next.push(this.buildOutputTextWatermark());
    next.push(watermark);

    await this.applyWatermarks(next);
  },

  async applySlotNameWatermark()
  {
    if (!this.isRunning()) return;

    const text = this.ui.wmSlotText.value || `槽位 ${this.formatSlotLabel(this.currentSlot)}`;
    const next = this.getWatermarkSnapshot().filter((item) => !(item.target === 'source' && item.slot === this.currentSlot));

    next.push(this.buildSlotWatermark(this.currentSlot, text));
    await this.applyWatermarks(next);
  },

  // ==========================================================
  // 压测工具 — 场景矩阵、采样、结果导出
  // ==========================================================

  bindStressPanel()
  {
    this.hideStressPanel();
    if (this.ui.stressLauncher)
    {
      this.ui.stressLauncher.addEventListener('click', () => this.toggleStressPanel());
    }
    if (this.ui.stressCloseBtn)
    {
      this.ui.stressCloseBtn.addEventListener('click', () => this.hideStressPanel());
    }
    this.bindStressDrag();
    this.updateStressStatus('未开始');
    this.refreshStressSummary();
  },

  showStressPanel()
  {
    if (!this.ui.stressPanel) return;
    this.ui.stressPanel.classList.remove('stress-hidden');
    if (this.ui.stressLauncher)
    {
      this.ui.stressLauncher.style.display = 'none';
    }
  },

  hideStressPanel()
  {
    if (!this.ui.stressPanel) return;
    this.ui.stressPanel.classList.add('stress-hidden');
    if (this.ui.stressLauncher)
    {
      this.ui.stressLauncher.style.display = '';
    }
  },

  toggleStressPanel()
  {
    if (!this.ui.stressPanel) return;
    if (this.ui.stressPanel.classList.contains('stress-hidden'))
    {
      this.showStressPanel();
    }
    else
    {
      this.hideStressPanel();
    }
  },

  bindStressDrag()
  {
    const panel = this.ui.stressPanel;
    const handle = this.ui.stressDragHandle;

    if (!panel || !handle) return;

    handle.addEventListener('mousedown', (event) =>
    {
      if (event.button !== 0) return;

      const rect = panel.getBoundingClientRect();

      this.stressDragState = {
        offsetX : event.clientX - rect.left,
        offsetY : event.clientY - rect.top
      };
      panel.style.right = 'auto';
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      event.preventDefault();
    });

    document.addEventListener('mousemove', (event) =>
    {
      if (!this.stressDragState || !panel || panel.classList.contains('stress-hidden')) return;

      const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);
      const nextLeft = Math.min(maxLeft, Math.max(0, event.clientX - this.stressDragState.offsetX));
      const nextTop = Math.min(maxTop, Math.max(0, event.clientY - this.stressDragState.offsetY));

      panel.style.left = `${Math.round(nextLeft)}px`;
      panel.style.top = `${Math.round(nextTop)}px`;
    });

    document.addEventListener('mouseup', () =>
    {
      this.stressDragState = null;
    });
  },

  updateStressStatus(text)
  {
    if (!this.ui.stressStatus) return;
    this.ui.stressStatus.innerText = text || '-';
  },

  clearStressResults()
  {
    this.stressResults = [];
    this.stressSamples = [];
    this.updateStressStatus('结果已清空');
    this.refreshStressSummary();
  },

  _parseCommaList(raw)
  {
    return String(raw || '')
      .split(/[\s,，]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  },

  _getAllowedRenderModes()
  {
    const select = this.ui.cfgRenderMode;

    if (!select || !select.options) return [];

    return Array.from(select.options).map((item) => item.value);
  },

  _buildStressScenarios()
  {
    const sourceKind = (this.ui.stressSourceKind && this.ui.stressSourceKind.value) || 'av';
    const sourceLimit = this.maxDemoSources;
    const instanceLimit = this.maxDemoSources;
    const sourceRaw = this._parseCommaList(this.ui.stressSourceCounts && this.ui.stressSourceCounts.value)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const sourceCounts = Array.from(new Set(
      sourceRaw
        .map((value) => Math.floor(value))
        .filter((value) => value > 0)
        .map((value) => Math.min(value, sourceLimit))
    ));
    const instanceCountsRaw = this._parseCommaList(this.ui.stressInstanceCounts && this.ui.stressInstanceCounts.value)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const instanceCountsNormalized = Array.from(new Set(
      instanceCountsRaw
        .map((value) => Math.floor(value))
        .filter((value) => value > 0)
        .map((value) => Math.min(value, instanceLimit))
    ));
    const resolutions = this._parseCommaList(this.ui.stressOutputResolutions && this.ui.stressOutputResolutions.value)
      .filter((value) => /^\d+x\d+$/i.test(value));
    const fpsList = this._parseCommaList(this.ui.stressOutputFps && this.ui.stressOutputFps.value)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    const allowedModes = new Set(this._getAllowedRenderModes());
    const renderModes = this._parseCommaList(this.ui.stressRenderModes && this.ui.stressRenderModes.value)
      .filter((value) => allowedModes.has(value));
    const scenarios = [];

    renderModes.forEach((renderMode) =>
    {
      resolutions.forEach((resolution) =>
      {
        fpsList.forEach((fps) =>
        {
          sourceCounts.forEach((sources) =>
          {
            const instanceCounts = instanceCountsNormalized.length ? instanceCountsNormalized : [ sources ];

            instanceCounts.forEach((instances) =>
            {
              scenarios.push({
                renderMode,
                resolution,
                fps,
                sources,
                instances
              });
            });
          });
        });
      });
    });

    const sourceOverflow = sourceRaw.some((value) => value > sourceLimit);
    const instanceOverflow = instanceCountsRaw.some((value) => value > instanceLimit);

    this._stressInputNormalizeNote = (sourceOverflow || instanceOverflow)
      ? `输入值过大已自动收敛（源<=${sourceLimit}，实例<=${instanceLimit}）`
      : '';

    return scenarios;
  },

  async startStressTest()
  {
    if (this.stressRun && !this.stressRun.done)
    {
      this.showNotification('压测正在运行中', 'warning');

      return;
    }

    const scenarios = this._buildStressScenarios();

    if (this._stressInputNormalizeNote)
    {
      this.showNotification(this._stressInputNormalizeNote, 'warning');
    }

    if (!scenarios.length)
    {
      const sourceKind = (this.ui.stressSourceKind && this.ui.stressSourceKind.value) || 'av';
      const sourceLimit = this.maxDemoSources;
      const sourceHint = `当前模式源路数最大 ${sourceLimit}`;

      this.showNotification(`压测矩阵为空，请检查输入。${sourceHint}`, 'warning');

      return;
    }

    const durationSeconds = this.readPositiveNumber(this.ui.stressCaseSeconds, 45);
    const settleSeconds = this.readPositiveNumber(this.ui.stressSettleSeconds, 3);
    const sampleIntervalMs = Math.max(200, this.readPositiveNumber(this.ui.stressSampleMs, 1000));
    const sourceKind = (this.ui.stressSourceKind && this.ui.stressSourceKind.value) || 'av';
    const runId = Date.now();
    const runState = {
      id               : runId,
      done             : false,
      stopRequested    : false,
      startedAt        : Date.now(),
      durationMs       : durationSeconds * 1000,
      settleMs         : settleSeconds * 1000,
      sampleIntervalMs : sampleIntervalMs,
      sourceKind       : sourceKind,
      totalCases       : scenarios.length
    };

    this.stressRun = runState;
    this.stressResults = [];
    this.stressSamples = [];
    this.refreshStressSummary();
    this.updateStressStatus(`压测开始: 0/${runState.totalCases}`);

    try
    {
      for (let index = 0; index < scenarios.length; index++)
      {
        if (runState.stopRequested) break;

        const scenario = scenarios[index];

        this.updateStressStatus(
          `执行中 ${index + 1}/${runState.totalCases}: ${scenario.renderMode} ${scenario.resolution} ${scenario.fps}fps ${scenario.sources}路源/${scenario.instances}实例`
        );

        const result = await this._runStressCase(runState, scenario, index + 1, runState.totalCases);

        this.stressResults.push(result);
        this.stressSamples = this.stressSamples.concat(result.samples);
        this.refreshStressSummary();
      }
    }
    catch (error)
    {
      this.showNotification(`压测中断: ${error.message || String(error)}`, 'error');
    }
    finally
    {
      this._teardownStressAuxComposers();
      this._teardownStressSourceFactory();
      runState.done = true;
      const summary = `${this.stressResults.length}/${runState.totalCases}`;

      this.updateStressStatus(runState.stopRequested ? `已停止: ${summary}` : `已完成: ${summary}`);
      this.refreshStressSummary();
    }
  },

  stopStressTest()
  {
    if (!this.stressRun || this.stressRun.done)
    {
      this.updateStressStatus('当前没有运行中的压测');

      return;
    }

    this.stressRun.stopRequested = true;
    this.updateStressStatus('停止中...');
    this._teardownStressAuxComposers();
    this._teardownStressSourceFactory();
    this.stop();
  },

  async _waitWithStop(ms, runState)
  {
    const step = 200;
    let remaining = Math.max(0, Number(ms) || 0);

    while (remaining > 0)
    {
      if (runState.stopRequested)
      {
        throw new Error('压测已被停止');
      }

      const waitMs = Math.min(step, remaining);

      await new Promise((resolve) => window.setTimeout(resolve, waitMs));
      remaining -= waitMs;
    }
  },

  async _runStressCase(runState, scenario, caseIndex, totalCases)
  {
    this.ui.cfgOutRes.value = scenario.resolution;
    this.ui.cfgFps.value = String(scenario.fps);
    this.ui.cfgRenderMode.value = scenario.renderMode;

    this._teardownStressAuxComposers();
    this._teardownStressSourceFactory();
    await this.stop();
    await this.start();

    if (!this.isRunning())
    {
      throw new Error(`启动失败: ${scenario.renderMode} ${scenario.resolution} ${scenario.fps}fps ${scenario.sources}路/${scenario.instances}实例`);
    }

    this.clearAll();
    this.selectSlot(0);
    this.stressSourceFactory = await this._createStressSourceFactory(scenario, runState.sourceKind);
    await this._populateStressSourcesForTest(scenario.sources);
    await this._createAuxStressComposers(scenario);
    this.updateStats();

    await this._waitWithStop(runState.settleMs, runState);

    const startedAt = Date.now();
    const samples = [];

    while (Date.now() - startedAt < runState.durationMs)
    {
      if (runState.stopRequested)
      {
        throw new Error('压测已被停止');
      }

      samples.push(this._takeStressSample(runState, scenario, caseIndex, Date.now() - startedAt));
      await this._waitWithStop(runState.sampleIntervalMs, runState);
    }

    return this._createStressCaseResult(scenario, caseIndex, totalCases, samples, startedAt, Date.now());
  },

  _parseResolution(resolution)
  {
    const parts = String(resolution || '').split('x').map((item) => Number(item));

    if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1]))
    {
      return { width: 1280, height: 720 };
    }

    return {
      width  : Math.max(1, Math.round(parts[0])),
      height : Math.max(1, Math.round(parts[1]))
    };
  },

  _createStressVirtualStream(kind, width, height, fps, labelPrefix)
  {
    this.counter += 1;
    const seq = this.counter;
    const options = {
      video : kind !== 'audio',
      audio : kind !== 'video',
      label : `${labelPrefix}-${seq}`
    };

    if (kind === 'video')
    {
      options.videoText = 'VIDEO ONLY';
    }

    return VirtualGen.create(width, height, fps, options.label, seq, options);
  },

  async _createStressSourceFactory(scenario, sourceKind)
  {
    const size = this._parseResolution(scenario.resolution);
    const fps = Number(scenario.fps) || 15;
    const kind = sourceKind || 'av';

    if (kind === 'camera')
    {
      const baseStream = await navigator.mediaDevices.getUserMedia({
        video : {
          width     : { ideal: size.width },
          height    : { ideal: size.height },
          frameRate : { ideal: fps }
        },
        audio : true
      });

      return {
        kind,
        create : async () =>
        {
          const tracks = [];
          const baseVideo = baseStream.getVideoTracks()[0];
          const baseAudio = baseStream.getAudioTracks()[0];

          if (baseVideo && baseVideo.readyState === 'live')
          {
            tracks.push(baseVideo.clone());
          }
          if (baseAudio && baseAudio.readyState === 'live')
          {
            tracks.push(baseAudio.clone());
          }

          return new MediaStream(tracks);
        },
        dispose : () =>
        {
          baseStream.getTracks().forEach((track) => track.stop());
        }
      };
    }

    return {
      kind,
      create : async (labelPrefix) => this._createStressVirtualStream(kind, size.width, size.height, fps, labelPrefix),
      dispose : () => {}
    };
  },

  async _createAuxStressComposers(scenario)
  {
    const instances = Math.max(1, Number(scenario.instances || 1));
    const auxCount = Math.max(0, instances - 1);

    if (auxCount === 0)
    {
      this.stressAuxComposers = [];

      return;
    }

    const size = this._parseResolution(scenario.resolution);
    const auxList = [];

    for (let i = 0; i < auxCount; i++)
    {
      const composer = new CRTC.MediaStreamComposer([], {
        width      : size.width,
        height     : size.height,
        fps        : scenario.fps,
        renderMode : scenario.renderMode
      });
      const streams = [];

      for (let slot = 0; slot < scenario.sources; slot++)
      {
        const stream = await this.stressSourceFactory.create(`AUX${i + 1}-SRC${slot + 1}`, slot, i + 1);

        composer.addSource(stream, slot);
        streams.push(stream);
      }

      const outputStream = await composer.getOutput({ type: 'video' });

      auxList.push({ composer, streams, outputStream });
    }

    this.stressAuxComposers = auxList;
  },

  _teardownStressSourceFactory()
  {
    if (!this.stressSourceFactory) return;

    if (typeof this.stressSourceFactory.dispose === 'function')
    {
      try { this.stressSourceFactory.dispose(); }
      catch (e) {}
    }

    this.stressSourceFactory = null;
  },

  _teardownStressAuxComposers()
  {
    if (!this.stressAuxComposers || !this.stressAuxComposers.length)
    {
      this.stressAuxComposers = [];

      return;
    }

    this.stressAuxComposers.forEach((item) =>
    {
      if (!item) return;

      if (item.composer && item.composer.stop)
      {
        try { item.composer.stop(); }
        catch (e) {}
      }

      (item.streams || []).forEach((stream) =>
      {
        if (!stream) return;
        stream.getTracks().forEach((track) => track.stop());
        if (stream.stopInternal) stream.stopInternal();
      });

      if (item.outputStream && item.outputStream.getTracks)
      {
        item.outputStream.getTracks().forEach((track) => track.stop());
      }
    });

    this.stressAuxComposers = [];
  },

  async _populateStressSourcesForTest(count)
  {
    for (let i = 0; i < count; i++)
    {
      const stream = await this.stressSourceFactory.create(`MAIN-SRC${i + 1}`, i, 0);

      this._handleStreamAdd(stream, `压测源 ${i + 1}`);
    }
  },

  _takeStressSample(runState, scenario, caseIndex, elapsedMs)
  {
    const infos = [];
    const mainInfo = this.getRenderInfo();

    if (mainInfo) infos.push(mainInfo);
    (this.stressAuxComposers || []).forEach((item) =>
    {
      if (!item || !item.composer || !item.composer.getState) return;
      const auxInfo = item.composer.getState().render;

      if (auxInfo) infos.push(auxInfo);
    });

    const droppedFrames = infos.reduce((sum, info) => sum + Number(info.droppedFrames || 0), 0);
    const renderedFrames = infos.reduce((sum, info) => sum + Number(info.renderedFrames || 0), 0);
    const fallbackFlags = infos.map((info) => Boolean(info.isFallback));
    const reasons = infos
      .map((info, idx) => (info.reason ? `i${idx}:${info.reason}` : ''))
      .filter(Boolean);
    const requestedModes = infos.map((info) => info.requestedMode || '').filter(Boolean);
    const actualModes = infos.map((info, idx) => `i${idx}:${info.actualMode || '-'}`);

    return {
      runId         : runState.id,
      caseIndex     : caseIndex,
      totalCases    : runState.totalCases,
      elapsedMs     : elapsedMs,
      ts            : Date.now(),
      renderMode    : scenario.renderMode,
      resolution    : scenario.resolution,
      fps           : scenario.fps,
      sources       : scenario.sources,
      instances     : scenario.instances,
      requestedMode : requestedModes[0] || '',
      actualMode    : actualModes.join(','),
      isWorker      : infos.some((info) => Boolean(info.isWorker)),
      isWebGL2      : infos.some((info) => Boolean(info.isWebGL2)),
      isFallback    : fallbackFlags.some(Boolean),
      droppedFrames : droppedFrames,
      renderedFrames: renderedFrames,
      reason        : reasons.join(' | '),
      perInstance   : infos.map((info, idx) => ({
        index         : idx,
        requestedMode : info.requestedMode || '',
        actualMode    : info.actualMode || '',
        droppedFrames : Number(info.droppedFrames || 0),
        renderedFrames: Number(info.renderedFrames || 0),
        isFallback    : Boolean(info.isFallback),
        reason        : info.reason || ''
      }))
    };
  },

  _createStressCaseResult(scenario, caseIndex, totalCases, samples, startedAt, endedAt)
  {
    const first = samples[0] || {};
    const last = samples[samples.length - 1] || {};
    const deltaDropped = Math.max(0, (last.droppedFrames || 0) - (first.droppedFrames || 0));
    const deltaRendered = Math.max(0, (last.renderedFrames || 0) - (first.renderedFrames || 0));
    const totalFrames = deltaDropped + deltaRendered;
    const dropRate = totalFrames > 0 ? deltaDropped / totalFrames : 0;
    const fallbackSeen = samples.some((sample) => sample.isFallback);
    const reasons = Array.from(new Set(samples.map((sample) => sample.reason).filter(Boolean)));

    return {
      caseIndex,
      totalCases,
      renderMode    : scenario.renderMode,
      resolution    : scenario.resolution,
      fps           : scenario.fps,
      sources       : scenario.sources,
      instances     : scenario.instances,
      sampleCount   : samples.length,
      startedAt,
      endedAt,
      durationMs    : Math.max(0, endedAt - startedAt),
      requestedMode : last.requestedMode || scenario.renderMode,
      actualMode    : last.actualMode || '',
      fallbackSeen,
      deltaDropped,
      deltaRendered,
      dropRate,
      reasons,
      samples
    };
  },

  refreshStressSummary()
  {
    if (!this.ui.stressSummary) return;

    if (!this.stressResults.length)
    {
      this.ui.stressSummary.innerText = '无结果';

      return;
    }

    const passThreshold = 0.02;
    const passCount = this.stressResults.filter((item) =>
      !item.fallbackSeen &&
      item.dropRate < passThreshold &&
      (!item.reasons || item.reasons.length === 0)
    ).length;
    const failCount = this.stressResults.length - passCount;
    const topFailures = this.stressResults
      .slice()
      .sort((a, b) => b.dropRate - a.dropRate)
      .slice(0, 5)
      .map((item) =>
      {
        const drop = (item.dropRate * 100).toFixed(2);

        return `${item.caseIndex}. ${item.renderMode} ${item.resolution} ${item.fps}fps ${item.sources}路/${item.instances}实例 | drop=${drop}% fallback=${item.fallbackSeen ? 'Y' : 'N'} reason=${item.reasons && item.reasons.length ? item.reasons.join(' / ') : '-'}`;
      });

    this.ui.stressSummary.innerText =
      `总用例: ${this.stressResults.length}\n` +
      `通过(丢帧<2%且无fallback/无reason): ${passCount}\n` +
      `未通过: ${failCount}\n` +
      `\n高风险用例(前5):\n${topFailures.join('\n')}`;
  },

  exportStressJson()
  {
    if (!this.stressResults.length)
    {
      this.showNotification('暂无压测结果可导出', 'warning');

      return;
    }

    const payload = {
      exportedAt : new Date().toISOString(),
      run        : this.stressRun ? {
        id               : this.stressRun.id,
        startedAt        : this.stressRun.startedAt,
        totalCases       : this.stressRun.totalCases,
        durationMs       : this.stressRun.durationMs,
        settleMs         : this.stressRun.settleMs,
        sampleIntervalMs : this.stressRun.sampleIntervalMs,
        sourceKind       : this.stressRun.sourceKind
      } : null,
      results : this.stressResults,
      samples : this.stressSamples
    };

    this._downloadTextFile(
      `media-stream-composer-stress-${this._formatTimestampForFile()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  },

  exportStressCsv()
  {
    if (!this.stressResults.length)
    {
      this.showNotification('暂无压测结果可导出', 'warning');

      return;
    }

    const header = [
      'caseIndex',
      'renderMode',
      'resolution',
      'fps',
      'sources',
      'instances',
      'requestedMode',
      'actualMode',
      'fallbackSeen',
      'deltaDropped',
      'deltaRendered',
      'dropRatePercent',
      'sampleCount',
      'durationMs',
      'reasons'
    ];
    const rows = this.stressResults.map((item) =>
    {
      const values = [
        item.caseIndex,
        item.renderMode,
        item.resolution,
        item.fps,
        item.sources,
        item.instances,
        item.requestedMode,
        item.actualMode,
        item.fallbackSeen ? '1' : '0',
        item.deltaDropped,
        item.deltaRendered,
        (item.dropRate * 100).toFixed(4),
        item.sampleCount,
        item.durationMs,
        item.reasons && item.reasons.length ? item.reasons.join(' | ') : ''
      ];

      return values.map((value) => this._escapeCsv(value)).join(',');
    });
    const content = [ header.join(','), ...rows ].join('\n');

    this._downloadTextFile(
      `media-stream-composer-stress-${this._formatTimestampForFile()}.csv`,
      content,
      'text/csv;charset=utf-8'
    );
  },

  _escapeCsv(value)
  {
    const text = String(value === null || value === undefined ? '' : value);

    if (!/[",\n]/.test(text)) return text;

    return `"${text.replace(/"/g, '""')}"`;
  },

  _downloadTextFile(fileName, text, mimeType)
  {
    const blob = new Blob([ text ], { type: mimeType || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  _formatTimestampForFile()
  {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');

    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  },

  // ==========================================================
  // 工具方法 — 通用辅助函数
  // ==========================================================

  formatSlotLabel(slot)
  {
    return String(Number(slot) + 1);
  },

  formatSlotList(slots)
  {
    return slots.map((slot) => this.formatSlotLabel(slot)).join(',');
  },

  clampSlot(slot)
  {
    const value = Number(slot);

    if (!Number.isInteger(value)) return 0;

    return Math.min(Math.max(value, 0), this.maxDemoSources - 1);
  },

  getCompactInsertSlot(preferredSlot)
  {
    return this.clampSlot(preferredSlot);
  },

  readWatermarkPosition(selectEl, xEl, yEl, fallback)
  {
    const value = selectEl && selectEl.value ? selectEl.value : fallback;

    if (value !== 'custom') return value;

    const x = Number(xEl && xEl.value);
    const y = Number(yEl && yEl.value);

    return {
      x : Number.isFinite(x) ? x : 0,
      y : Number.isFinite(y) ? y : 0
    };
  },

  readPositiveNumber(inputEl, fallback)
  {
    const value = Number(inputEl && inputEl.value);

    return Number.isFinite(value) && value > 0 ? value : fallback;
  },

  readOpacity(inputEl, fallback)
  {
    const value = Number(inputEl && inputEl.value);

    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  },

  buildOutputTextWatermark()
  {
    return {
      id               : 'output-text',
      target           : 'output',
      type             : 'text',
      text             : this.ui.wmOutputText.value || 'CRTC Live',
      fontSize         : this.readPositiveNumber(this.ui.wmOutputTextSize, 28),
      color            : (this.ui.wmOutputTextColor && this.ui.wmOutputTextColor.value) || '#ffffff',
      opacity          : this.readOpacity(this.ui.wmOutputTextOpacity, 1),
      backgroundColor  : (this.ui.wmOutputTextBgColor && this.ui.wmOutputTextBgColor.value) || 'rgba(0,0,0,0.45)',
      padding          : 3,
      backgroundRadius : 3,
      position         : this.readWatermarkPosition(
        this.ui.wmOutputTextPosition,
        this.ui.wmOutputTextX,
        this.ui.wmOutputTextY,
        'bottom-right'
      )
    };
  },

  buildOutputImageWatermark()
  {
    const image = this.ui.wmOutputImage.value.trim();

    if (!image) return null;

    return {
      id       : 'output-image',
      target   : 'output',
      type     : 'image',
      image    : image,
      opacity  : this.readOpacity(this.ui.wmOutputImageOpacity, 1),
      width    : 160,
      position : this.readWatermarkPosition(
        this.ui.wmOutputImagePosition,
        this.ui.wmOutputImageX,
        this.ui.wmOutputImageY,
        'top-right'
      )
    };
  },

  buildSlotWatermark(slot, text)
  {
    return {
      id               : `slot-${slot}-name`,
      target           : 'source',
      slot             : slot,
      type             : 'text',
      text             : text,
      fontSize         : this.readPositiveNumber(this.ui.wmSlotSize, 28),
      color            : (this.ui.wmSlotColor && this.ui.wmSlotColor.value) || '#ffffff',
      opacity          : this.readOpacity(this.ui.wmSlotOpacity, 1),
      backgroundColor  : (this.ui.wmSlotBgColor && this.ui.wmSlotBgColor.value) || 'rgba(0,0,0,0.45)',
      padding          : 3,
      backgroundRadius : 3,
      position         : this.readWatermarkPosition(
        this.ui.wmSlotPosition,
        this.ui.wmSlotX,
        this.ui.wmSlotY,
        'bottom-left'
      ),
      margin : 12
    };
  },

  withTimeout(promise, timeout, message)
  {
    let timer = null;

    return Promise.race([
      Promise.resolve(promise).catch((error) => ({ error })),
      new Promise((resolve) =>
      {
        timer = window.setTimeout(() => resolve({ timedOut: true, message }), timeout);
      })
    ]).then((result) =>
    {
      if (timer) window.clearTimeout(timer);

      return result;
    });
  },

  shouldUseSubmixWebAudioPlayback()
  {
    const ua = navigator.userAgent || '';

    return /Android/i.test(ua) && /Chrome|CriOS/i.test(ua) && !/Edg|OPR|Firefox/i.test(ua);
  },

  normalizeSubmixSlots(slots)
  {
    if (!(slots instanceof Array)) return [];

    return slots
      .map((slot) => Number(slot))
      .filter((slot) => Number.isInteger(slot) && slot >= 0 && slot < this.maxDemoSources)
      .filter((slot, index, values) => values.indexOf(slot) === index)
      .sort((a, b) => a - b);
  },

  createAudioPlaybackStream(stream)
  {
    if (!stream || !stream.getAudioTracks) return stream;

    const tracks = stream.getAudioTracks().filter((track) => track && track.readyState === 'live');

    if (!tracks.length) return stream;

    const clonedTracks = tracks.map((track) =>
    {
      try { return track.clone ? track.clone() : null; }
      catch (e) { return null; }
    }).filter(Boolean);

    if (!clonedTracks.length) return stream;

    return new MediaStream(clonedTracks);
  },

  calcLayoutFromSources(sources)
  {
    let maxSlot = -1;

    sources.forEach((s) =>
    {
      if (typeof s.slot === 'number' && s.slot > maxSlot) maxSlot = s.slot;
    });
    const count = Math.min(Math.max(maxSlot + 1, sources.length, 1), this.maxDemoSources);
    let w = 0;
    let h = 0;
    const runtimeConfig = this.getOutputRuntimeConfig();

    if (runtimeConfig && Number.isFinite(runtimeConfig.width) && Number.isFinite(runtimeConfig.height))
    {
      w = runtimeConfig.width;
      h = runtimeConfig.height;
    }
    else
    {
      const resVal = document.getElementById('cfg-out-res').value;

      [ w, h ] = resVal.split('x').map(Number);
    }
    const isPortrait = h > w;
    let cols = 1, rows = 1;

    if (count <= 1) { cols = 1; rows = 1; }
    else if (count <= 2)
    {
      if (isPortrait) { cols = 1; rows = 2; }
      else { cols = 2; rows = 1; }
    }
    else if (count <= 4) { cols = 2; rows = 2; }
    else if (count <= 6)
    {
      if (isPortrait) { cols = 2; rows = 3; }
      else { cols = 3; rows = 2; }
    }
    else { cols = 3; rows = 3; }

    return { cols, rows };
  }
};

window.app = app;
