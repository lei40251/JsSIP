
        // ==========================================
        // 1. Utils (虚拟源 - 支持动态FPS控制)
        // ==========================================
        const VirtualGen = {
            audioCtx: null,
            noteNames: ['C4', 'E4', 'G4', 'B4', 'D5', 'F5', 'A5'],
            noteFrequencies: [261.63, 329.63, 392.00, 493.88, 587.33, 698.46, 880.00],

            // 创建一个用于测试的虚拟 MediaStream。
            // 视频部分来自 canvas.captureStream(fps)，音频部分来自 OscillatorNode。
            // 这个方法只服务于 demo，SDK 的 Mixer 本身不负责创建输入源。
            create(width, height, fps, label, id, options) {
                options = Object.assign({ video: true, audio: true }, options || {});
                if (options.audio) this.ensureAudioContext();

                const hue = (id * 137) % 360;
                const videoStream = options.video ? this.createVideoStream(width, height, fps, label, id, hue, options.videoText || '') : null;
                const audioData = options.audio ? this.createNoteAudio(id) : null;
                const mixed = new MediaStream([
                    ...(videoStream ? videoStream.getVideoTracks() : []),
                    ...(audioData ? audioData.stream.getAudioTracks() : [])
                ]);
                mixed.id = `virtual-${id}-${Date.now()}`;
                mixed.demoMeta = {
                    hasVideo : Boolean(options.video),
                    hasAudio : Boolean(options.audio),
                    note     : audioData ? audioData.note : '',
                    hue      : hue
                };

                // MediaStream.stopInternal 不是浏览器标准 API，只是 demo 为虚拟源补的清理钩子。
                // 删除虚拟源时需要停止 oscillator 和定时器，否则音频节点会继续占用资源。
                mixed.stopInternal = () => {
                    if (audioData) audioData.stop();
                };
                return mixed;
            },

            ensureAudioContext() {
                if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                return this.audioCtx;
            },

            createVideoStream(width, height, fps, label, id, hue, extraText) {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                let x = 0;

                // 这里持续刷新 canvas 画面，让虚拟源看起来是动态视频。
                // 输入源实际输出帧率由下面的 canvas.captureStream(fps) 控制。
                const draw = () => {
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(0, 0, width, height);

                    ctx.strokeStyle = `hsl(${hue}, 70%, 50%)`;
                    ctx.lineWidth = Math.max(5, width * 0.02);
                    ctx.strokeRect(0, 0, width, height);

                    x = (x + width * 0.015) % width; // 移动速度
                    ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
                    const boxSize = height * 0.2;
                    ctx.fillRect(x, height / 2 - boxSize / 2, boxSize, boxSize);

                    ctx.fillStyle = '#fff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    ctx.font = `bold ${height / 6}px sans-serif`;
                    ctx.fillText(label, width / 2, height / 2 - height / 8);

                    // 在虚拟源画面上直接标出输入分辨率和输入帧率，方便观察 Mixer 的缩放效果。
                    ctx.font = `${height / 10}px monospace`;
                    ctx.fillText(`${width}x${height} @ ${fps}fps`, width / 2, height / 2 + height / 6);
                    if (extraText) {
                        ctx.font = `bold ${height / 11}px sans-serif`;
                        ctx.fillText(extraText, width / 2, height / 2 + height / 3);
                    }

                    requestAnimationFrame(draw);
                };
                draw();

                // 关键：这里控制“输入源”的帧率，不是 Mixer 输出帧率。
                // Mixer 输出帧率在 new CRTC.Mixer({ fps }) 时设置。
                return canvas.captureStream(fps);
            },

            createNoteAudio(id) {
                const ac = this.ensureAudioContext();
                const noteIndex = (id - 1) % this.noteFrequencies.length;
                const note = this.noteNames[noteIndex];
                const baseFrequency = this.noteFrequencies[noteIndex];
                const dest = ac.createMediaStreamDestination();
                const osc = ac.createOscillator();
                const gain = ac.createGain();
                let beatTimer = null;

                osc.type = id % 2 ? 'sine' : 'triangle';
                osc.frequency.value = baseFrequency;
                gain.gain.value = 0.0001;
                osc.connect(gain);
                gain.connect(dest);
                osc.start();

                // 每个虚拟源用不同音高和节奏脉冲，混音监听时能分辨来源。
                const pulse = () => {
                    const now = ac.currentTime;
                    osc.frequency.setValueAtTime(baseFrequency, now);
                    gain.gain.cancelScheduledValues(now);
                    gain.gain.setValueAtTime(0.0001, now);
                    gain.gain.linearRampToValueAtTime(0.18, now + 0.025);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
                };
                pulse();
                beatTimer = window.setInterval(pulse, 520 + (noteIndex * 130));

                return {
                    stream : dest.stream,
                    note,
                    stop   : () => {
                        if (beatTimer) window.clearInterval(beatTimer);
                        try { osc.stop(); } catch (e) {}
                        try { osc.disconnect(); } catch (e) {}
                        try { gain.disconnect(); } catch (e) {}
                    }
                };
            }
        };

        // ==========================================
        // 2. UI App
        // ==========================================
        const app = {
            // CRTC.Mixer 实例。点击“启动混流引擎”后创建，点击“停止并释放”后销毁。
            mixer: null,

            // demo 自己创建或采集的输入源列表。
            // 每一项保存 { stream, slot }，用于删除源时同步停止本地采集轨道。
            localStreams: [],

            // 虚拟源编号计数器，仅用于生成画面标签和不同音符的测试音。
            counter: 0,

            // 当前选中的目标 slot。添加新源时会传给 CRTC.Mixer.appendStream(stream, slot)。
            currentSlot: 0,

            // 输出预览默认静音，只有用户点击“监听输出”后才打开本地播放，满足浏览器自动播放策略。
            monitorAudio: false,

            // 每组子混音使用独立 audio 元素，不影响右侧 mixed-video 的默认全量混音预览。
            activeSubmixes: new Map(),

            // 缓存页面元素，避免每次操作都重复 querySelector/getElementById。
            ui: {
                slotGrid: document.getElementById('slot-selector'),
                mixedVideo: document.getElementById('mixed-video'),
                thumbs: document.getElementById('thumbs-container'),
                btnStart: document.getElementById('btn-start'),
                btnStop: document.getElementById('btn-stop'),
                audioMonitorRow: document.getElementById('audio-monitor-row'),
                btnMonitorAudio: document.getElementById('btn-monitor-audio'),
                panelAddSource: document.getElementById('panel-add-source'),
                panelSubmix: document.getElementById('panel-submix'),
                submixList: document.getElementById('submix-list'),
                submixStatus: document.getElementById('submix-status'),
                panelSources: document.getElementById('panel-sources'),
                statusBadge: document.getElementById('status-badge'),
                overlay: document.getElementById('grid-overlay'),
                selectedSlotNumber: document.getElementById('selected-slot-number'),
                selectedSlotSource: document.getElementById('selected-slot-source'),
                selectedSlotWatermark: document.getElementById('selected-slot-watermark'),
                diagnosticSelectedSlot: document.getElementById('diagnostic-selected-slot'),
                wmOutputText: document.getElementById('wm-output-text'),
                wmOutputImage: document.getElementById('wm-output-image'),
                wmSlotSelect: document.getElementById('wm-slot-select'),
                wmSelectedSlot: document.getElementById('wm-selected-slot'),
                wmSlotSourceState: document.getElementById('wm-slot-source-state'),
                wmSlotWatermarkState: document.getElementById('wm-slot-watermark-state'),
                wmSlotText: document.getElementById('wm-slot-text'),
                watermarkList: document.getElementById('watermark-list'),
                tabs: Array.from(document.querySelectorAll('.tab-btn')),
                tabPanes: {
                    watermark : document.getElementById('tab-watermark'),
                    submix    : document.getElementById('tab-submix'),
                    diagnostics : document.getElementById('tab-diagnostics')
                },
                statsLayout: document.getElementById('stat-layout'),
                statsAudio: document.getElementById('stat-audio'),
                statsAudioState: document.getElementById('stat-audio-state'),
                statsSize: document.getElementById('stat-size'),
                statsRenderer: document.getElementById('stat-renderer'),
                statsDropped: document.getElementById('stat-dropped'),
                statsRenderReason: document.getElementById('stat-render-reason')
            },

            init() {
                // 初始化 0-8 共 9 个 slot 按钮；Mixer 内部会根据最大 slot 自动计算 1/2/4/6/9 宫格布局。
                for (let i = 0; i < 9; i++) {
                    const btn = document.createElement('div');
                    btn.className = 'slot-btn';
                    btn.innerText = i;
                    btn.dataset.slot = i;
                    btn.onclick = () => this.selectSlot(i);
                    this.ui.slotGrid.appendChild(btn);
                }
                for (let i = 0; i < 9; i++) {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.innerText = `slot ${i}`;
                    this.ui.wmSlotSelect.appendChild(opt);
                }
                this.ui.wmSlotSelect.onchange = () => this.selectSlot(parseInt(this.ui.wmSlotSelect.value, 10));
                this.ui.tabs.forEach(tab => {
                    tab.onclick = () => this.setInspectorTab(tab.dataset.tab);
                });
                this.selectSlot(0);

                // 绑定启动/停止按钮。输入源按钮通过 HTML 上的 onclick 直接调用 app.addXxx()。
                this.ui.btnStart.onclick = () => this.start();
                this.ui.btnStop.onclick = () => this.stop();
                this.ui.btnMonitorAudio.onclick = () => this.toggleMonitorAudio();
                this.updateMonitorAudioUI();
                this.setInspectorTab('watermark');
            },

            selectSlot(idx) {
                // 只改变 demo 当前选中的目标位置，不会立即影响 Mixer。
                this.currentSlot = idx;
                const btns = this.ui.slotGrid.children;
                for (let b of btns) {
                    const slot = parseInt(b.dataset.slot, 10);
                    b.classList.toggle('active', slot === idx);
                    b.classList.toggle('has-watermark', this.hasSlotWatermark(slot));
                }
                this.ui.selectedSlotNumber.innerText = idx;
                this.ui.wmSlotSelect.value = String(idx);
                this.refreshSelectedSlotSummary();
                this.refreshWatermarkList();
            },

            updateSlotUI() {
                const occupied = new Set();
                if (this.mixer) {
                    // getSources() 是 Mixer 对外暴露的只读快照，这里不直接访问 _sources 私有字段。
                    this.mixer.getSources().forEach(s => occupied.add(s.slot));
                }

                const btns = this.ui.slotGrid.children;
                for (let b of btns) {
                    const slot = parseInt(b.dataset.slot, 10);
                    b.classList.toggle('occupied', occupied.has(slot));
                    b.classList.toggle('has-watermark', this.hasSlotWatermark(slot));
                }

                Array.from(this.ui.thumbs.children).forEach(node => {
                    if (!node || !node.dataset) return;
                    node.classList.toggle('selected', parseInt(node.dataset.slot, 10) === this.currentSlot);
                });
                this.refreshSelectedSlotSummary();
            },

            setInspectorTab(name) {
                this.ui.tabs.forEach(tab => {
                    tab.classList.toggle('active', tab.dataset.tab === name);
                });
                Object.entries(this.ui.tabPanes).forEach(([key, pane]) => {
                    pane.classList.toggle('active', key === name);
                });
            },

            getSelectedSource() {
                if (!this.mixer) return null;
                return this.mixer.getSources().find(source => source.slot === this.currentSlot) || null;
            },

            hasSlotWatermark(slot) {
                if (!this.mixer || !this.mixer.getWatermarks) return false;
                const watermarks = this.mixer.getWatermarks() || [];
                return watermarks.some(item => item.target === 'source' && item.slot === slot);
            },

            getWatermarkSnapshot() {
                if (!this.mixer || !this.mixer.getWatermarks) return [];
                return this.mixer.getWatermarks() || [];
            },

            refreshSelectedSlotSummary() {
                const source = this.getSelectedSource();
                const hasWatermark = this.hasSlotWatermark(this.currentSlot);
                const sourceState = source ? `已占用 · ${source.id}` : '无源';
                const watermarkState = hasWatermark ? '已设置 slot 水印' : '无 slot 水印';
                const summary = `slot ${this.currentSlot} · ${sourceState} · ${watermarkState}`;

                this.ui.selectedSlotSource.innerText = sourceState;
                this.ui.selectedSlotWatermark.innerText = watermarkState;
                this.ui.wmSelectedSlot.innerText = String(this.currentSlot);
                this.ui.wmSlotSourceState.innerText = source ? `源 ${source.id}` : '无源';
                this.ui.wmSlotWatermarkState.innerText = watermarkState;
                this.ui.diagnosticSelectedSlot.innerText = summary;
                this.ui.wmSlotSelect.value = String(this.currentSlot);
            },

            refreshWatermarkList() {
                if (!this.ui.watermarkList) return;

                const watermarks = this.getWatermarkSnapshot();
                if (!watermarks.length) {
                    this.ui.watermarkList.innerHTML = '<div class="submix-empty">暂无水印</div>';
                    this.updateSlotUI();
                    return;
                }

                this.ui.watermarkList.innerHTML = '';
                watermarks.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'watermark-item';

                    const statusClass = item.status === 'ready' ? 'ready' : '';
                    row.innerHTML = `
                        <div class="watermark-id">${item.id}</div>
                        <div class="pill ${statusClass}">${item.status || '-'}</div>
                        <div class="watermark-meta">target=${item.target} · slot=${item.slot === null || item.slot === undefined ? '-' : item.slot} · type=${item.type} · reason=${item.reason || '-'}</div>
                    `;
                    this.ui.watermarkList.appendChild(row);
                });
                this.updateSlotUI();
            },

            async applyWatermarks(watermarks) {
                if (!this.mixer) return;

                await this.mixer.setWatermarks(watermarks);
                this.refreshWatermarkList();
                this.updateSlotUI();
            },

            buildOutputTextWatermark() {
                return {
                    id       : 'output-text',
                    target   : 'output',
                    type     : 'text',
                    text     : this.ui.wmOutputText.value || 'CRTC Live',
                    position : 'bottom-right'
                };
            },

            buildOutputImageWatermark() {
                const image = this.ui.wmOutputImage.value.trim();
                if (!image) return null;

                return {
                    id       : 'output-image',
                    target   : 'output',
                    type     : 'image',
                    image    : image,
                    width    : 160,
                    position : 'top-right'
                };
            },

            buildSlotWatermark(slot, text) {
                return {
                    id       : `slot-${slot}-name`,
                    target   : 'source',
                    slot     : slot,
                    type     : 'text',
                    text     : text,
                    position : 'bottom-left',
                    margin   : 12
                };
            },

            async applyOutputTextWatermark() {
                await this.applyWatermarks([
                    this.buildOutputTextWatermark(),
                    ...this.getWatermarkSnapshot().filter(item => !(item.target === 'output' && item.id === 'output-image'))
                ]);
            },

            async applyOutputImageWatermark() {
                const watermark = this.buildOutputImageWatermark();
                if (!watermark) return;

                await this.applyWatermarks([
                    watermark,
                    ...this.getWatermarkSnapshot().filter(item => !(item.target === 'output' && item.id === 'output-text'))
                ]);
            },

            async clearOutputWatermarks() {
                if (!this.mixer) return;

                this.mixer.clearWatermark({ target: 'output' });
                this.refreshWatermarkList();
                this.updateSlotUI();
            },

            async applySlotNameWatermark() {
                if (!this.mixer) return;

                const text = this.ui.wmSlotText.value || `Slot ${this.currentSlot}`;
                const next = this.getWatermarkSnapshot().filter(item => !(item.target === 'source' && item.slot === this.currentSlot));
                next.push(this.buildSlotWatermark(this.currentSlot, text));
                await this.applyWatermarks(next);
            },

            clearSelectedSlotWatermark() {
                if (!this.mixer) return;

                this.mixer.clearWatermark({ target: 'source', slot: this.currentSlot });
                this.refreshWatermarkList();
                this.updateSlotUI();
            },

            clearAllWatermarks() {
                if (!this.mixer) return;

                this.mixer.clearWatermark();
                this.refreshWatermarkList();
                this.updateSlotUI();
            },

            listenSelectedSlotSubmix() {
                this.listenSubmix([this.currentSlot]);
            },

            async start() {
                if (this.mixer) this.stop();

                const [w, h] = document.getElementById('cfg-out-res').value.split('x').map(Number);
                const fps = parseInt(document.getElementById('cfg-fps').value);
                const renderMode = document.getElementById('cfg-render-mode').value;

                // 这里是 demo 使用 SDK Mixer 的核心入口：
                // width/height 控制输出 canvas 分辨率，fps 控制输出 MediaStream 的视频帧率。
                // renderMode 用于演示新增的渲染后端选择能力，auto 会按 Worker WebGL2 → 主线程 WebGL2 → Worker 2D → 主线程 2D 降级。
                // 初始不传输入源，后续通过 appendStream(stream, slot) 动态添加。
                this.mixer = new CRTC.Mixer([], { width: w, height: h, fps: fps, renderMode: renderMode });
                this.monitorAudio = false;
                this.ui.mixedVideo.muted = true;
                this.stopAllSubmixes();
                this.updateMonitorAudioUI();

                try {
                    // getMixedStream() 返回混合后的 MediaStream，可直接赋给 video 预览，也可推给 RTCPeerConnection。
                    const outStream = await this.mixer.getMixedStream();
                    this.ui.mixedVideo.srcObject = outStream;
                    this.ui.mixedVideo.muted = !this.monitorAudio;

                    this.ui.btnStart.style.display = 'none';
                    this.ui.btnStop.style.display = 'block';
                    this.ui.audioMonitorRow.style.display = 'block';
                    this.ui.panelSources.style.opacity = '1';
                    this.ui.panelSources.style.pointerEvents = 'auto';
                    this.ui.panelAddSource.style.opacity = '1';
                    this.ui.panelAddSource.style.pointerEvents = 'auto';
                    this.ui.panelSubmix.classList.add('active');
                    this.ui.statusBadge.innerText = "运行中";
                    this.ui.statusBadge.style.background = "#4ade80";
                    this.ui.statusBadge.style.color = "white";
                    this.ui.statsSize.innerText = `${w}x${h} @ ${fps}fps`;
                    this.ui.thumbs.innerHTML = '';
                    this.updateRenderInfo();
                    this.refreshSelectedSlotSummary();
                    this.refreshWatermarkList();

                    // 启动音频可视化。启动时可能还没有任何音频源，startViz 内部会等待音频轨出现。
                    this.startViz(outStream);
                    this.startRenderInfoLoop();
                } catch (e) {
                    if (this.mixer) {
                        this.mixer.stop();
                        this.mixer = null;
                    }
                    alert(e.message);
                }
            },

            stop() {
                // 先释放 Mixer 内部资源：绘制循环、canvas captureStream、WebAudio 节点等。
                if (this.mixer) {
                    this.mixer.stop();
                    this.mixer = null;
                }

                // 再释放 demo 自己持有的输入源。Mixer.stop() 不会停止外部传入的原始摄像头/屏幕流。
                this.localStreams.forEach(item => {
                    const s = item.stream || item;

                    s.getTracks().forEach(t => t.stop());
                    if (s.stopInternal) s.stopInternal();
                });
                this.localStreams = [];
                this.monitorAudio = false;
                this.stopAllSubmixes();
                this.ui.mixedVideo.srcObject = null;
                this.ui.mixedVideo.muted = true;
                this.ui.btnStart.style.display = 'block';
                this.ui.btnStop.style.display = 'none';
                this.ui.audioMonitorRow.style.display = 'none';
                this.ui.panelSources.style.opacity = '0.5';
                this.ui.panelSources.style.pointerEvents = 'none';
                this.ui.panelAddSource.style.opacity = '0.5';
                this.ui.panelAddSource.style.pointerEvents = 'none';
                this.ui.panelSubmix.classList.remove('active');
                this.ui.statusBadge.innerText = "已停止";
                this.ui.statusBadge.style.background = "#e2e8f0";
                this.ui.statusBadge.style.color = "#475569";
                this.ui.thumbs.innerHTML = '<div style="color:#94a3b8; font-size:12px; margin:auto;">(暂无输入源)</div>';
                this.ui.overlay.innerHTML = '';
                this.ui.statsAudioState.innerText = '-';
                this.ui.statsRenderer.innerText = '-';
                this.ui.statsDropped.innerText = '0';
                this.ui.statsRenderReason.innerText = '-';
                this.updateMonitorAudioUI();
                this.updateSlotUI();
                this.refreshSelectedSlotSummary();
                this.refreshWatermarkList();
            },

            async toggleMonitorAudio() {
                if (!this.mixer || !this.ui.mixedVideo.srcObject) return;

                const enable = !this.monitorAudio;
                this.monitorAudio = enable;
                this.ui.mixedVideo.muted = !enable;

                if (enable) {
                    try {
                        await this.ui.mixedVideo.play();
                    } catch (e) {
                        this.monitorAudio = false;
                        this.ui.mixedVideo.muted = true;
                        alert("监听输出失败: " + e.message);
                    }
                }

                this.updateMonitorAudioUI();
            },

            updateMonitorAudioUI() {
                if (!this.ui.btnMonitorAudio) return;

                this.ui.btnMonitorAudio.innerText = this.monitorAudio ? '🔇 停止监听' : '🔊 监听输出';
                this.ui.btnMonitorAudio.disabled = !this.mixer;
            },

            async listenSubmix(slots) {
                if (!this.mixer) return;

                const normalizedSlots = this.normalizeSubmixSlots(slots);
                if (!normalizedSlots.length) return;

                const key = normalizedSlots.join(',');

                try {
                    const stream = await this.mixer.getAudioStream({ slots: normalizedSlots });
                    const submix = this.ensureSubmixItem(key, normalizedSlots);

                    if (!stream || stream.getAudioTracks().length === 0) {
                        submix.audio.pause();
                        submix.audio.srcObject = null;
                        submix.label.innerText = `slots ${key} 无可用音频`;
                        this.updateStats();

                        return;
                    }

                    submix.audio.srcObject = stream;
                    await submix.audio.play();
                    submix.label.innerText = `slots ${key}`;
                    this.updateSubmixStatus();
                    this.updateStats();
                } catch (e) {
                    this.removeSubmixItem(key);
                    alert("监听子混音失败: " + e.message);
                }
            },

            normalizeSubmixSlots(slots) {
                if (!(slots instanceof Array)) return [];

                return slots
                    .map(slot => Number(slot))
                    .filter(slot => Number.isInteger(slot) && slot >= 0)
                    .filter((slot, index, values) => values.indexOf(slot) === index)
                    .sort((a, b) => a - b);
            },

            ensureSubmixItem(key, slots) {
                const existing = this.activeSubmixes.get(key);
                if (existing) return existing;

                this.clearSubmixEmptyState();

                const row = document.createElement('div');
                row.className = 'submix-item';
                row.dataset.key = key;

                const label = document.createElement('div');
                label.className = 'submix-label';
                label.innerText = `slots ${key}`;

                const stopButton = document.createElement('button');
                stopButton.className = 'btn-outline btn-mini';
                stopButton.style.color = 'var(--danger)';
                stopButton.innerText = '停止';
                stopButton.onclick = () => this.stopSubmix(slots);

                const audio = document.createElement('audio');
                audio.autoplay = true;
                audio.controls = true;
                audio.playsInline = true;

                row.appendChild(label);
                row.appendChild(stopButton);
                row.appendChild(audio);
                this.ui.submixList.appendChild(row);

                const submix = {
                    key,
                    slots: slots.slice(),
                    row,
                    label,
                    audio
                };
                this.activeSubmixes.set(key, submix);
                this.updateSubmixStatus();

                return submix;
            },

            clearSubmixEmptyState() {
                if (!this.ui.submixList) return;

                const empty = this.ui.submixList.querySelector('.submix-empty');
                if (empty) empty.remove();
            },

            ensureSubmixEmptyState() {
                if (!this.ui.submixList || this.activeSubmixes.size > 0) return;

                this.ui.submixList.innerHTML = '<div class="submix-empty">暂无子混音</div>';
            },

            stopSubmix(slots) {
                const normalizedSlots = this.normalizeSubmixSlots(slots);
                if (!normalizedSlots.length) return;

                this.removeSubmixItem(normalizedSlots.join(','));
            },

            removeSubmixItem(key) {
                const submix = this.activeSubmixes.get(key);
                if (!submix) return;

                submix.audio.pause();
                submix.audio.srcObject = null;
                submix.row.remove();
                this.activeSubmixes.delete(key);
                this.updateSubmixStatus();
                this.ensureSubmixEmptyState();
            },

            stopAllSubmixes() {
                Array.from(this.activeSubmixes.keys()).forEach(key => this.removeSubmixItem(key));
                this.updateSubmixStatus();
                this.ensureSubmixEmptyState();
            },

            async _handleStreamAdd(stream, label) {
                if (!this.mixer) return;
                const slot = this.currentSlot;

                // demo 与 SDK 的 slot 语义保持一致：同一个 slot 再加源会覆盖旧源。
                // 这里先停止 demo 侧旧输入源，避免被覆盖后摄像头/屏幕仍在采集。
                this.removeLocalStreamBySlot(slot);

                // 这是动态添加输入源到 SDK Mixer 的核心调用。
                // 第二个参数是 slot 编号；Mixer 内部会根据 slot 计算画面位置。
                this.mixer.appendStream(stream, slot);

                this.localStreams.push({ stream, slot });
                this.addThumb(stream, label, slot);
                this.updateSlotUI();

                let nextSlot = slot + 1;
                if (nextSlot < 9) this.selectSlot(nextSlot);

                this.updateStats();
                this.refreshActiveSubmix();
                this.refreshWatermarkList();
            },

            removeLocalStreamBySlot(slot) {
                // 查找 demo 侧记录的旧源，并复用 removeSource 做 Mixer 移除、轨道停止和 UI 清理。
                const oldItem = this.localStreams.find(item => item.slot === slot);
                if (!oldItem) return;
                this.removeSource(oldItem.stream.id);
            },

            addThumb(stream, label, slot) {
                // 同 slot 覆盖时，先删旧缩略图。
                const existing = document.querySelector(`.source-thumb[data-slot="${slot}"]`);
                if (existing) existing.remove();
                if (this.ui.thumbs.innerText.includes('暂无')) this.ui.thumbs.innerHTML = '';

                // 缩略图只用于展示输入源原始画面，不参与混流。
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
                const trackInfo = `${hasVideo ? 'V' : '-'} / ${hasAudio ? 'A' : '-'}${meta.note ? ' · ' + meta.note : ''}`;

                div.innerHTML = `
            <div class="slot-tag">${slot}</div>
            <div class="remove-btn" onclick="app.removeSource('${stream.id}')">&times;</div>
            ${mediaMarkup}
            <div class="info">${label}<br>${trackInfo}</div>
        `;
                const video = div.querySelector('video');
                if (video) video.srcObject = stream;

                const thumbs = Array.from(this.ui.thumbs.children);
                const nextThumb = thumbs.find(t => parseInt(t.dataset.slot) > slot);
                if (nextThumb) this.ui.thumbs.insertBefore(div, nextThumb);
                else this.ui.thumbs.appendChild(div);
            },

            removeSource(id) {
                if (!this.mixer) return;

                // 从 SDK Mixer 中移除指定源。id 是原始 MediaStream.id，也可被 Mixer.getSources() 返回。
                this.mixer.removeStream(id);

                // 停止 demo 自己采集/生成的原始输入源，释放摄像头、屏幕共享或虚拟源 oscillator。
                const idx = this.localStreams.findIndex(item => item.stream.id === id);
                if (idx !== -1) {
                    const s = this.localStreams[idx].stream;
                    s.getTracks().forEach(t => t.stop());
                    if (s.stopInternal) s.stopInternal();
                    this.localStreams.splice(idx, 1);
                }

                const el = document.getElementById(`thumb-${id}`);
                if (el) el.remove();
                if (this.ui.thumbs.children.length === 0) {
                    this.ui.thumbs.innerHTML = '<div style="color:#94a3b8; font-size:12px; margin:auto;">(暂无输入源)</div>';
                }
                this.updateSlotUI();
                this.updateStats();
                this.refreshActiveSubmix();
                this.refreshWatermarkList();
            },

            _createVirtual(options) {
                this.counter++;
                let w = 640, h = 360;
                const resVal = document.getElementById('cfg-in-res').value;
                if (resVal !== 'auto') [w, h] = resVal.split('x').map(Number);

                // 输入帧率只作用于这个虚拟源自身；Mixer 输出帧率由启动时的输出帧率决定。
                const fps = parseInt(document.getElementById('cfg-in-fps').value);

                const s = VirtualGen.create(w, h, fps, options.label, this.counter, options);
                this._handleStreamAdd(s, options.thumbLabel);
            },

            addVirtual() {
                const next = this.counter + 1;
                this._createVirtual({
                    video      : true,
                    audio      : true,
                    label      : `SRC-${next}`,
                    thumbLabel : `音视频 ${next}`
                });
            },

            addVirtualVideoOnly() {
                const next = this.counter + 1;
                this._createVirtual({
                    video      : true,
                    audio      : false,
                    label      : `VIDEO-${next}`,
                    videoText  : 'VIDEO ONLY',
                    thumbLabel : `仅视频 ${next}`
                });
            },

            addVirtualAudioOnly() {
                const next = this.counter + 1;
                this._createVirtual({
                    video      : false,
                    audio      : true,
                    label      : `AUDIO-${next}`,
                    thumbLabel : `仅音频 ${next}`
                });
            },

            async addCamera() {
                try {
                    const constraints = { video: {}, audio: true };
                    const resVal = document.getElementById('cfg-in-res').value;
                    if (resVal !== 'auto') {
                        const [w, h] = resVal.split('x').map(Number);

                        // 摄像头输入分辨率使用 ideal，浏览器和设备可能返回接近但不完全一致的实际值。
                        constraints.video.width = { ideal: w };
                        constraints.video.height = { ideal: h };
                    }

                    // 摄像头输入帧率同样是 ideal 约束，实际值取决于设备能力和浏览器策略。
                    const fps = parseInt(document.getElementById('cfg-in-fps').value);
                    constraints.video.frameRate = { ideal: fps };

                    const s = await navigator.mediaDevices.getUserMedia(constraints);
                    this._handleStreamAdd(s, '摄像头');
                } catch (e) { alert("摄像头失败: " + e.message); }
            },

            async addScreen() {
                try {
                    // 屏幕共享通常不能精确控制帧率，这里只把选择值传给浏览器做参考。
                    const fps = parseInt(document.getElementById('cfg-in-fps').value);
                    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: fps }, audio: true });
                    this._handleStreamAdd(s, '屏幕共享');

                    // 用户通过浏览器浮层停止屏幕共享时，同步从 Mixer 和 UI 中移除。
                    s.getVideoTracks()[0].onended = () => this.removeSource(s.id);
                } catch (e) { }
            },

            clearAll() {
                // 使用副本遍历，避免 removeSource 修改 localStreams 时影响当前循环。
                [...this.localStreams].forEach(item => this.removeSource(item.stream.id));
            },

            updateStats() {
                if (!this.mixer) return;

                // 统计信息全部从 Mixer.getSources() 快照得出，避免依赖 SDK 私有字段。
                const sources = this.mixer.getSources();
                const ac = sources.filter(s => s.hasAudio).length;
                const audioInfo = this.mixer.getAudioInfo ? this.mixer.getAudioInfo() : null;

                this.ui.statsAudio.innerText = ac;
                this.ui.statsAudioState.innerText = audioInfo ? `${audioInfo.status} (${audioInfo.connectedSources}/${audioInfo.liveSourceCount})` : '-';
                this.updateOverlayFromSources(sources);
                this.updateRenderInfo();
            },

            refreshActiveSubmix() {
                if (!this.activeSubmixes.size) return;

                Array.from(this.activeSubmixes.values()).forEach(submix => {
                    this.listenSubmix(submix.slots);
                });
            },

            updateSubmixStatus() {
                if (!this.ui.submixStatus) return;

                if (!this.activeSubmixes.size) {
                    this.ui.submixStatus.innerText = '-';

                    return;
                }

                this.ui.submixStatus.innerText = Array.from(this.activeSubmixes.keys()).join(' | ');
            },

            updateRenderInfo() {
                if (!this.mixer || !this.mixer.getRenderInfo) return;

                // getRenderInfo() 是新增的只读排查接口。Worker 模式初始化有异步消息，
                // 所以 actualMode 可能从 worker-init 稍后更新为 worker-webgl2 或 worker-2d。
                const info = this.mixer.getRenderInfo();
                this.ui.statsRenderer.innerText = `${info.actualMode} (${info.requestedMode})`;
                this.ui.statsDropped.innerText = info.droppedFrames || 0;
                this.ui.statsRenderReason.innerText = info.reason || '-';
            },

            startRenderInfoLoop() {
                // 渲染后端和 dropped frame 是运行时数据，需要循环刷新。
                const tick = () => {
                    if (!this.mixer) return;
                    this.updateRenderInfo();
                    requestAnimationFrame(tick);
                };

                tick();
            },

            calcLayoutFromSources(sources) {
                // 这里复刻 Mixer 的 slot 布局计算，仅用于画页面上的虚线 overlay。
                // 真正的混流布局仍由 SDK 内部完成；overlay 只是帮助观察 slot 位置。
                let maxSlot = -1;
                sources.forEach(s => {
                    if (typeof s.slot === 'number' && s.slot > maxSlot) maxSlot = s.slot;
                });
                const count = Math.max(maxSlot + 1, sources.length, 1);
                const resVal = document.getElementById('cfg-out-res').value;
                const [w, h] = resVal.split('x').map(Number);
                const isPortrait = h > w;
                let cols = 1, rows = 1;

                if (count <= 1) { cols = 1; rows = 1; }
                else if (count <= 2) {
                    if (isPortrait) { cols = 1; rows = 2; } else { cols = 2; rows = 1; }
                }
                else if (count <= 4) { cols = 2; rows = 2; }
                else if (count <= 6) {
                    if (isPortrait) { cols = 2; rows = 3; } else { cols = 3; rows = 2; }
                }
                else if (count <= 9) { cols = 3; rows = 3; }
                else {
                    cols = Math.ceil(Math.sqrt(count));
                    rows = Math.ceil(count / cols);
                }

                return { cols, rows };
            },

            updateOverlayFromSources(sources) {
                // 源变化后刷新预览区上的 slot 网格。
                const layout = this.calcLayoutFromSources(sources);
                this.drawOverlay(layout.cols, layout.rows);
            },

            drawOverlay(cols, rows) {
                // 根据 rows/cols 在预览区画一个百分比定位的网格，不影响真实输出流。
                this.ui.overlay.style.width = '100%';
                this.ui.overlay.style.height = '100%';
                this.ui.overlay.innerHTML = '';
                this.ui.statsLayout.innerText = `${cols}x${rows}`;
                const wPct = 100 / cols, hPct = 100 / rows;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const div = document.createElement('div');
                        div.className = 'grid-cell-label';
                        div.style.left = (c * wPct) + '%';
                        div.style.top = (r * hPct) + '%';
                        div.style.width = wPct + '%';
                        div.style.height = hPct + '%';
                        div.innerText = r * cols + c;
                        this.ui.overlay.appendChild(div);
                    }
                }
            },

            startViz(stream) {
                // 对 mixed stream 做音频频谱可视化。启动时可能还没有任何音频源，
                // 如果此时直接 createMediaStreamSource(stream) 会抛错，所以先等待音频轨出现。
                const audioTracks = stream.getAudioTracks();
                const cvs = document.getElementById('viz-canvas');
                const ctx = cvs.getContext('2d');

                if (audioTracks.length === 0) {
                    const waitForAudio = () => {
                        if (!this.mixer) return;
                        cvs.width = cvs.clientWidth; cvs.height = cvs.clientHeight;
                        ctx.clearRect(0, 0, cvs.width, cvs.height);

                        // CRTC.Mixer 支持先启动、后添加带音频的输入源；音频轨出现后再创建 analyser。
                        if (stream.getAudioTracks().length > 0) {
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
                const an = ac.createAnalyser(); an.fftSize = 128;
                src.connect(an);
                const data = new Uint8Array(an.frequencyBinCount);
                const draw = () => {
                    // Mixer 停止时关闭可视化用的 AudioContext，避免页面残留音频分析节点。
                    if (!this.mixer) { ac.close(); return; }
                    requestAnimationFrame(draw);
                    cvs.width = cvs.clientWidth; cvs.height = cvs.clientHeight;
                    an.getByteFrequencyData(data);
                    ctx.clearRect(0, 0, cvs.width, cvs.height);
                    const barW = (cvs.width / data.length) * 2.5;
                    let x = 0;
                    for (let i = 0; i < data.length; i++) {
                        const h = (data[i] / 255) * cvs.height;
                        ctx.fillStyle = `rgb(${h + 50}, 220, 100)`;
                        ctx.fillRect(x, cvs.height - h, barW, h);
                        x += barW + 1;
                    }
                };
                draw();
            }
        };

        app.init();
        window.addEventListener('pagehide', () => app.stop());
    