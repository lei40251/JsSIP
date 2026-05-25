// ============================================================
// app — UI 逻辑、工具方法、UI 回调及非 Mixer-SDK 操作
// ============================================================
const app = {
  localStreams      : [],
  counter           : 0,
  currentSlot       : 0,
  maxDemoSources    : 9,
  monitorAudio      : false,
  activeSubmixes    : new Map(),
  submixPlaybackCtx : null,

  // ==========================================================
  // DOM 引用
  // ==========================================================
  ui: {
    slotGrid              : document.getElementById('slot-selector'),
    mixedVideo            : document.getElementById('mixed-video'),
    thumbs                : document.getElementById('thumbs-container'),
    previewStage          : document.querySelector('.preview-stage'),
    btnStart              : document.getElementById('btn-start'),
    btnStop               : document.getElementById('btn-stop'),
    audioMonitorRow       : document.getElementById('audio-monitor-row'),
    btnMonitorAudio       : document.getElementById('btn-monitor-audio'),
    panelAddSource        : document.getElementById('panel-add-source'),
    panelSubmix           : document.getElementById('panel-submix'),
    panelWatermark        : document.getElementById('panel-watermark'),
    submixList            : document.getElementById('submix-list'),
    submixStatus          : document.getElementById('submix-status'),
    panelSources          : document.getElementById('panel-sources'),
    statusBadge           : document.getElementById('status-badge'),
    overlay               : document.getElementById('grid-overlay'),
    previewStageFrame     : document.getElementById('preview-stage-frame'),
    selectedSlotNumber    : document.getElementById('selected-slot-number'),
    selectedSlotSource    : document.getElementById('selected-slot-source'),
    selectedSlotWatermark : document.getElementById('selected-slot-watermark'),
    wmOutputText          : document.getElementById('wm-output-text'),
    wmOutputTextPosition  : document.getElementById('wm-output-text-position'),
    wmOutputTextX         : document.getElementById('wm-output-text-x'),
    wmOutputTextY         : document.getElementById('wm-output-text-y'),
    wmOutputTextSize      : document.getElementById('wm-output-text-size'),
    wmOutputTextColor     : document.getElementById('wm-output-text-color'),
    wmOutputTextBgColor   : document.getElementById('wm-output-text-bg-color'),
    wmOutputImage         : document.getElementById('wm-output-image'),
    wmOutputImagePosition : document.getElementById('wm-output-image-position'),
    wmOutputImageX        : document.getElementById('wm-output-image-x'),
    wmOutputImageY        : document.getElementById('wm-output-image-y'),
    wmSlotSelect          : document.getElementById('wm-slot-select'),
    wmSelectedSlot        : document.getElementById('wm-selected-slot'),
    wmSlotSourceState     : document.getElementById('wm-slot-source-state'),
    wmSlotWatermarkState  : document.getElementById('wm-slot-watermark-state'),
    wmSlotText            : document.getElementById('wm-slot-text'),
    wmSlotPosition        : document.getElementById('wm-slot-position'),
    wmSlotX               : document.getElementById('wm-slot-x'),
    wmSlotY               : document.getElementById('wm-slot-y'),
    wmSlotSize            : document.getElementById('wm-slot-size'),
    wmSlotColor           : document.getElementById('wm-slot-color'),
    wmSlotBgColor         : document.getElementById('wm-slot-bg-color'),
    watermarkModeButtons  : document.querySelectorAll('[data-watermark-mode]'),
    watermarkSections     : document.querySelectorAll('[data-watermark-section]'),
    watermarkList         : document.getElementById('watermark-list'),
    statsLayout           : document.getElementById('stat-layout'),
    statsAudio            : document.getElementById('stat-audio'),
    statsAudioState       : document.getElementById('stat-audio-state'),
    statsSize             : document.getElementById('stat-size'),
    statsSources          : document.getElementById('stat-sources'),
    statsRenderer         : document.getElementById('stat-renderer'),
    statsDropped          : document.getElementById('stat-dropped'),
    statsRenderReason     : document.getElementById('stat-render-reason')
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
    this.updateMonitorAudioUI();
    this.setRunningUI(false);
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

    const [ w, h ] = document.getElementById('cfg-out-res').value.split('x').map(Number);

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
    this.setPanelEnabled(this.ui.panelWatermark, running);
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
    const sourceState = source ? `已占用 · ${source.id}` : '无源';
    const watermarkState = hasWatermark ? '已设置 slot 水印' : '无 slot 水印';
    const slotLabel = this.formatSlotLabel(this.currentSlot);

    this.ui.selectedSlotSource.innerText = sourceState;
    this.ui.selectedSlotWatermark.innerText = watermarkState;
    this.ui.wmSelectedSlot.innerText = slotLabel;
    this.ui.wmSlotSourceState.innerText = source ? `源 ${source.id}` : '无源';
    this.ui.wmSlotWatermarkState.innerText = watermarkState;
    this.ui.wmSlotSelect.value = String(this.currentSlot);
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
    this.ui.btnMonitorAudio.disabled = !this.isRunning();
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
      this.ui.statsDropped.innerText = '0';
      this.ui.statsRenderReason.innerText = '-';

      return;
    }
    const [ w, h ] = document.getElementById('cfg-out-res').value.split('x').map(Number);
    const fps = parseInt(document.getElementById('cfg-fps').value);

    this.ui.statsSize.innerText = `${w}x${h} @ ${fps}fps`;
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
    this.ui.statsDropped.innerText = info.droppedFrames || 0;
    this.ui.statsRenderReason.innerText = info.reason || '-';
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
    const audioTracks = stream.getAudioTracks();
    const cvs = document.getElementById('viz-canvas');
    const ctx = cvs.getContext('2d');

    if (audioTracks.length === 0)
    {
      const waitForAudio = () =>
      {
        if (!this.isRunning()) return;
        cvs.width = cvs.clientWidth; cvs.height = cvs.clientHeight;
        ctx.clearRect(0, 0, cvs.width, cvs.height);

        if (stream.getAudioTracks().length > 0)
        {
          this.startViz(stream);

          return;
        }

        requestAnimationFrame(waitForAudio);
      };

      waitForAudio();

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
      if (!this.isRunning())
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

  // ==========================================================
  // UI 回调 — 被 app-mixer.js 中的 SDK 方法调用
  // ==========================================================

  onMixerStarting()
  {
    this.ui.mixedVideo.muted = true;
    this.stopAllSubmixes();
    this.updateMonitorAudioUI();
  },

  onMixerStarted(outStream, w, h, fps)
  {
    this.ui.mixedVideo.srcObject = outStream;
    this.ui.mixedVideo.muted = !this.monitorAudio;

    this.ui.btnStart.style.display = 'none';
    this.ui.btnStop.style.display = 'block';
    this.ui.audioMonitorRow.style.display = 'block';
    this.setRunningUI(true);
    this.ui.panelSubmix.classList.add('active');
    this.ui.statusBadge.innerText = '运行中';
    this.ui.statusBadge.className = 'badge bg-success align-self-center';
    this.ui.statsSize.innerText = `${w}x${h} @ ${fps}fps`;
    this.syncPreviewFrameRatio();
    this.ui.thumbs.innerHTML = '';
    this.updateRenderInfo();
    this.refreshSelectedSlotSummary();
    this.refreshWatermarkList();

    this.startViz(outStream);
    this.startRenderInfoLoop();
  },

  onMixerStartError(e)
  {
    this.showNotification(`启动失败: ${e.message}`);
  },

  onMixerStopped()
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
    this.ui.statsDropped.innerText = '0';
    this.ui.statsRenderReason.innerText = '-';
    this.updateMonitorAudioUI();
    this.updateSlotUI();
    this.refreshSelectedSlotSummary();
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
      'cfg-out-res'           : '1280x720',
      'cfg-fps'               : '15',
      'cfg-render-mode'       : 'auto',
      'cfg-in-res'            : 'auto',
      'cfg-in-fps'            : '15',
      'wm-output-text'        : 'CRTC 直播',
      'wm-output-text-position' : 'bottom-right',
      'wm-output-text-color'  : '#ffffff',
      'wm-output-text-bg-color' : 'rgba(0,0,0,0.45)',
      'wm-output-text-size'   : '28',
      'wm-output-text-x'      : '16',
      'wm-output-text-y'      : '16',
      'wm-output-image'       : '',
      'wm-output-image-position' : 'top-right',
      'wm-output-image-x'     : '16',
      'wm-output-image-y'     : '16',
      'wm-output-image-url'   : '',
      'wm-slot-text'          : 'Slot',
      'wm-slot-position'      : 'bottom-left',
      'wm-slot-x'             : '12',
      'wm-slot-y'             : '12',
      'wm-slot-size'          : '28',
      'wm-slot-color'         : '#ffffff',
      'wm-slot-bg-color'      : 'rgba(0,0,0,0.45)'
    };

    Object.entries(defaults).forEach(([ id, val ]) =>
    {
      const el = document.getElementById(id);

      if (el) el.value = val;
    });
    this.syncPreviewFrameRatio();
    this.selectSlot(0);
    this.refreshWatermarkList();
  },

  // ==========================================================
  // 子混音管理 — 音频监听 UI 与 WebAudio 播放
  // ==========================================================

  toggleMonitorAudio()
  {
    if (!this.isRunning() || !this.ui.mixedVideo.srcObject) return;

    const enable = !this.monitorAudio;

    this.monitorAudio = enable;
    this.ui.mixedVideo.muted = !enable;

    if (enable)
    {
      try
      {
        this.ui.mixedVideo.play();
      }
      catch (e)
      {
        this.monitorAudio = false;
        this.ui.mixedVideo.muted = true;
        this.showNotification(`监听输出失败: ${e.message}`);
      }
    }

    this.updateMonitorAudioUI();
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
        item.audio.pause();
        this.stopSubmixWebAudioPlayback(item);
      }
    });
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
    const streams = fallbackStream ? [ fallbackStream ] : [];

    submix.playbackSources = streams.map((stream) =>
    {
      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();

      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(ctx.destination);

      return { source, gain, stream };
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

    stopButton.className = 'btn btn-outline-danger';
    stopButton.innerText = '停止';
    stopButton.onclick = () => this.stopSubmix(slots);

    const audio = document.createElement('audio');

    audio.autoplay = true;
    audio.controls = true;
    audio.muted = false;
    audio.playsInline = true;
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');

    row.appendChild(label);
    row.appendChild(stopButton);
    row.appendChild(audio);
    this.ui.submixList.appendChild(row);

    const submix = {
      key,
      slots          : slots.slice(),
      row,
      label,
      audio,
      playbackSource : null
    };

    audio.onplay = () =>
    {
      if (this.shouldUseSubmixWebAudioPlayback() && audio.srcObject)
      {
        this.startSubmixWebAudioPlayback(submix, audio.srcObject).catch(() => { });
      }
    };
    audio.onpause = () => this.stopSubmixWebAudioPlayback(submix);
    this.activeSubmixes.set(key, submix);
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

    submix.audio.pause();
    this.stopSubmixWebAudioPlayback(submix);
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
  // 水印编排 — 构造水印配置并调用 Mixer SDK 方法
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

  buildOutputTextWatermark()
  {
    return {
      id               : 'output-text',
      target           : 'output',
      type             : 'text',
      text             : this.ui.wmOutputText.value || 'CRTC Live',
      fontSize         : this.readPositiveNumber(this.ui.wmOutputTextSize, 28),
      color            : (this.ui.wmOutputTextColor && this.ui.wmOutputTextColor.value) || '#ffffff',
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

  calcLayoutFromSources(sources)
  {
    let maxSlot = -1;

    sources.forEach((s) =>
    {
      if (typeof s.slot === 'number' && s.slot > maxSlot) maxSlot = s.slot;
    });
    const count = Math.min(Math.max(maxSlot + 1, sources.length, 1), this.maxDemoSources);
    const resVal = document.getElementById('cfg-out-res').value;
    const [ w, h ] = resVal.split('x').map(Number);
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
