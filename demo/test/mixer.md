好的，这是一个用于 **音视频混流 (Media Stream Mixing)** 的 Web 应用的 HTML、CSS 和 JavaScript 代码。

我将为你提供一个 **极度详细、逐块的中文注释** 版本，解释每个部分的功能、技术原理以及核心的混流逻辑，特别是关于 **输入/输出双重 FPS 控制** 的实现。

## 🖥️ Mixer v6.3 完整代码及详细注释 (中文)

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mixer v6.3 (输入/输出双重FPS控制)</title>
    <style>
        /* ========================================== */
        /* --- 1. CSS 变量定义 (主题色) --- */
        /* ========================================== */
        :root { 
            --primary: #6366f1; /* 主色调：靛蓝 */
            --danger: #ef4444; /* 危险色：红色 */
            --bg: #f8fafc; /* 背景色：浅灰 */
            --panel: #ffffff; /* 面板背景：白色 */
            --text: #334155; /* 主要文本色：深蓝灰 */
        }

        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            background: var(--bg); 
            color: var(--text); 
            margin: 0; padding: 15px; 
            height: 100vh; 
            box-sizing: border-box; 
            display: flex; flex-direction: column; 
            overflow: hidden; /* 确保整个应用界面不会滚动 */
        }
        
        header { 
            display: flex; justify-content: space-between; align-items: center; 
            margin-bottom: 12px; 
            flex-shrink: 0; /* 标题不压缩 */
        }
        h1 { margin: 0; font-size: 1.3rem; display: flex; align-items: center; gap: 10px; }
        .badge { 
            background: #e2e8f0; padding: 4px 12px; border-radius: 20px; 
            font-size: 12px; font-weight: 600; color: #475569; 
        }
        
        .main-layout { 
            display: flex; gap: 20px; 
            flex: 1; /* 占据剩余垂直空间 */
            min-height: 0; /* 解决 flex 容器的最小高度问题 */
        }
        
        /* --- 左侧控制面板 --- */
        .control-panel { 
            width: 340px; 
            display: flex; flex-direction: column; gap: 12px; 
            overflow-y: auto; /* 允许垂直滚动 */
            padding-right: 5px; 
            flex-shrink: 0; 
        }
        .card { 
            background: var(--panel); padding: 15px; border-radius: 8px; 
            box-shadow: 0 1px 2px rgba(0,0,0,0.05); 
            border: 1px solid #e2e8f0; 
        }
        .card h3 { 
            margin: 0 0 10px 0; font-size: 0.85rem; color: #64748b; 
            text-transform: uppercase; 
            border-bottom: 1px solid #f1f5f9; 
            padding-bottom: 8px; 
        }
        
        .form-row { margin-bottom: 10px; }
        .form-row label { display: block; font-size: 0.8rem; font-weight: 500; margin-bottom: 4px; }
        select, input { 
            width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; 
            font-size: 0.9rem; background: #fff; 
        }
        
        .btn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        button { 
            padding: 10px; border: none; border-radius: 6px; cursor: pointer; 
            font-weight: 600; font-size: 0.85rem; transition: all 0.2s; 
        }
        button:hover { opacity: 0.9; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary { background: var(--primary); color: white; }
        .btn-danger { background: var(--danger); color: white; }
        .btn-outline { background: white; border: 1px solid #cbd5e1; color: var(--text); }
        .btn-outline:hover { background: #f1f5f9; border-color: #94a3b8; }

        /* 槽位选择器 */
        .slot-grid-selector { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); /* 3x3 布局 */
            gap: 6px; 
            margin-bottom: 12px; 
        }
        .slot-btn { 
            aspect-ratio: 16/9; /* 保持 16:9 比例 */
            background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; 
            display: flex; align-items: center; justify-content: center; 
            font-size: 14px; color: #64748b; cursor: pointer; transition: all 0.15s;
            position: relative;
        }
        .slot-btn:hover { border-color: var(--primary); color: var(--primary); }
        .slot-btn.active { 
            background: var(--primary); color: white; border-color: var(--primary); 
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); /* 选中状态 */
        }
        .slot-btn.occupied { 
            background: #f1f5f9; color: #cbd5e1; border-color: #e2e8f0; 
            cursor: not-allowed; 
        }
        .slot-btn.occupied::after { content: '×'; position: absolute; font-size: 18px; } /* 占用标记 */

        /* --- 右侧预览面板 (Canvas Preview) --- */
        .preview-panel { 
            flex: 1; display: flex; flex-direction: column; /* 垂直布局 */
            background: var(--panel); border-radius: 8px; 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
            overflow: hidden; border: 1px solid #e2e8f0;
        }
        
        .canvas-wrapper { 
            flex: 1; min-height: 0; /* 预览区占据大部分空间 */
            background: #0f172a; 
            display: flex; align-items: center; justify-content: center; position: relative; 
        }
        video#mixed-video { 
            max-width: 100%; max-height: 100%; display: block; 
            background: #000; box-shadow: 0 0 20px rgba(0,0,0,0.5); 
        }
        
        /* 布局网格覆盖层 */
        #grid-overlay { position: absolute; top:0; left:0; pointer-events: none; }
        .grid-cell-label { 
            position: absolute; border: 1px dashed rgba(255,255,255,0.15); 
            display: flex; align-items: center; justify-content: center; 
            color: rgba(255,255,255,0.2); font-size: 24px; font-weight: bold;
        }

        /* 音频可视化区 */
        .audio-viz { 
            height: 60px; flex-shrink: 0; background: #1e293b; 
            position: relative; border-top: 1px solid #334155; 
        }
        canvas#viz-canvas { width: 100%; height: 100%; display: block; }

        /* 输入源缩略图区 */
        .source-strip { 
            height: 110px; flex-shrink: 0; background: #f8fafc; padding: 10px; 
            display: flex; gap: 10px; overflow-x: auto; align-items: center; 
            border-top: 1px solid #e2e8f0; 
        }
        .source-thumb { 
            width: 120px; height: 100%; background: #000; border-radius: 6px; 
            position: relative; overflow: hidden; flex-shrink: 0; 
            border: 2px solid #e2e8f0; 
            display: flex; flex-direction: column;
        }
        .source-thumb video { flex: 1; width: 100%; object-fit: cover; opacity: 0.8; }
        .source-thumb .info { background: #334155; color: white; font-size: 10px; padding: 4px; text-align: center; }
        .source-thumb .slot-tag { 
            position: absolute; top: 4px; left: 4px; background: var(--primary); color: white; 
            width: 20px; height: 20px; border-radius: 50%; font-size: 11px; 
            display: flex; align-items: center; justify-content: center; font-weight: bold; z-index: 2;
        }
        .source-thumb .remove-btn {
            position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; 
            background: rgba(239, 68, 68, 0.9); color: white; border-radius: 4px;
            display: flex; align-items: center; justify-content: center; 
            font-size: 14px; cursor: pointer; border: none; z-index: 2;
        }
    </style>
</head>
<body>

<header>
    <h1>🎛️ Mixer v6.3 <span style="font-size:0.8em; color:#64748b; font-weight:400; margin-left:5px;">FPS Control</span></h1>
    <div id="status-badge" class="badge">就绪</div>
</header>

<div class="main-layout">
                <div class="control-panel">
        <div class="card">
            <h3>1. 输出 (Canvas Output)</h3>
            <div class="form-row">
                <label>输出分辨率</label>
                <select id="cfg-out-res">
                    <optgroup label="横屏 (Landscape)">
                        <option value="1920x1080">1080p (1920x1080)</option>
                        <option value="1280x720" selected>720p (1280x720)</option>
                        <option value="854x480">480p (854x480)</option>
                        <option value="640x360">360p (640x360)</option>
                    </optgroup>
                    <optgroup label="竖屏 (Portrait)">
                        <option value="1080x1920">1080p 竖屏</option>
                        <option value="720x1280">720p 竖屏</option>
                        <option value="480x854">480p 竖屏</option>
                        <option value="360x640">360p 竖屏</option>
                    </optgroup>
                </select>
            </div>
            <div class="form-row">
                <label>输出帧率</label>
                <select id="cfg-fps">
                                        <option value="60">60 FPS (流畅)</option>
                    <option value="30" selected>30 FPS (标准)</option>
                    <option value="15">15 FPS (低耗)</option>
                    <option value="5">5 FPS (极低)</option>
                </select>
            </div>
            <button id="btn-start" class="btn-primary" style="width:100%">▶️ 启动混流引擎</button>
            <button id="btn-stop" class="btn-danger" style="width:100%; display:none;">⏹️ 停止并释放</button>
        </div>

        <div class="card" id="panel-sources" style="opacity:0.5; pointer-events:none;">
            <h3>2. 目标位置 (Target Slot)</h3>
                        <div class="slot-grid-selector" id="slot-selector">
            </div>
            
            <h3>3. 添加源 (Add Source)</h3>
            <div class="form-row">
                <label>输入分辨率 (Resolution)</label>
                <select id="cfg-in-res">
                    <option value="auto">自动 (Auto)</option>
                                    </select>
            </div>

            <div class="form-row">
                <label>输入帧率 (Input FPS)</label>
                <select id="cfg-in-fps">
                                        <option value="60">60 FPS</option>
                    <option value="30" selected>30 FPS</option>
                    <option value="15">15 FPS</option>
                    <option value="10">10 FPS</option>
                    <option value="5">5 FPS</option>
                </select>
            </div>

            <div class="btn-grid">
                <button class="btn-outline" onclick="app.addVirtual()">🤖 虚拟源</button>
                <button class="btn-outline" onclick="app.addCamera()">📷 摄像头</button>
                <button class="btn-outline" onclick="app.addScreen()">🖥️ 屏幕共享</button>
                <button class="btn-outline" style="color:var(--danger)" onclick="app.clearAll()">🗑️ 清空</button>
            </div>
        </div>

        <div class="card">
            <h3>4. 实时统计</h3>
            <div style="font-size:12px; font-family:monospace; line-height:1.5;">
                <div>Canvas: <span id="stat-size">-</span></div>
                <div>Layout: <span id="stat-layout">-</span></div>
                <div>Audio: <span id="stat-audio">0</span> Ch</div>
            </div>
        </div>
    </div>

                <div class="preview-panel">
        <div class="canvas-wrapper">
                        <video id="mixed-video" autoplay playsinline controls muted></video>
            <div id="grid-overlay"></div>
            <div style="position:absolute; top:10px; right:10px; background:rgba(0,0,0,0.5); color:white; padding:2px 6px; border-radius:4px; font-size:10px;">Output Preview</div>
        </div>
        
                <div class="audio-viz">
            <canvas id="viz-canvas"></canvas>
            <div style="position:absolute; top:2px; left:5px; color:#4ade80; font-size:10px; font-weight:bold;">Audio Mix</div>
        </div>

                <div class="source-strip" id="thumbs-container">
            <div style="color:#94a3b8; font-size:12px; margin:auto;">(暂无输入源)</div>
        </div>
    </div>
</div>

<script>
// ==========================================
// 1. SlotMixer 核心混流类
//    使用 Canvas 混合视频，使用 Web Audio API 混合音频
// ==========================================
class SlotMixer {
  constructor(config) {
    this._config = Object.assign({ width: 1280, height: 720, fps: 30 }, config);
    this._sources = new Map(); // 存储所有输入源：key=streamId, value=sourceData
    this._isStopDrawing = false;
    this._animationId = null;
    this._audioContext = null;
    this._audioDestination = null; // 混音输出目标

    // 视频混合的核心：Canvas 元素
    this._canvas = document.createElement('canvas');
    this._canvas.width = this._config.width;
    this._canvas.height = this._config.height;
    this._context = this._canvas.getContext('2d', { alpha: false }); // 2D 渲染上下文，禁用透明度以提高性能
  }

  /**
   * 添加一个 MediaStream 到指定槽位 (Slot)
   * @param {MediaStream} stream 输入媒体流
   * @param {number} slotIndex 槽位编号 (0-8)
   */
  appendStream(stream, slotIndex) {
    if (!stream) return false;
    
    // 覆盖：如果有旧流占用该槽位，则先移除旧流
    for (const [id, src] of this._sources.entries()) {
        if (src.slot === slotIndex) {
            console.warn(`Slot ${slotIndex} overwritten.`);
            this.removeStream(id);
        }
    }

    // 1. 创建 Video 元素来播放输入流 (用于 Canvas 绘制)
    const video = document.createElement('video');
    video.muted = true; // 必须静音，避免回音
    video.autoplay = true; video.playsInline = true;
    video.srcObject = stream;
    video.play().catch(e => {});

    const sourceData = {
        id: stream.id,
        stream: stream,
        video: video,
        slot: slotIndex,
        audioSourceNode: null, // Web Audio API Source Node
        gainNode: null // Web Audio API Gain Node (用于音量控制)
    };
    
    this._sources.set(stream.id, sourceData);
    // 2. 如果混音器已启动，立即连接音频
    if (this._audioContext) this._connectAudio(sourceData);
    return true;
  }

  /**
   * 移除一个输入流
   */
  removeStream(streamId) {
    const source = this._sources.get(streamId);
    if (!source) return;
    
    // 断开 Web Audio 连接并清理节点
    if (source.gainNode) source.gainNode.disconnect();
    if (source.audioSourceNode) source.audioSourceNode.disconnect();
    
    // 清理 Video 元素
    if (source.video) {
        source.video.pause();
        source.video.srcObject = null;
        source.video.remove();
    }
    this._sources.delete(streamId);
  }

  /**
   * Web Audio API: 连接音频流到混音目的地
   */
  _connectAudio(source) {
    // 检查是否有音轨且尚未连接
    if (source.stream.getAudioTracks().length === 0 || source.audioSourceNode) return;
    try {
        // MediaStreamSourceNode：将输入流转换为 Web Audio 节点
        const srcNode = this._audioContext.createMediaStreamSource(source.stream);
        // GainNode：用于控制音量
        const gainNode = this._audioContext.createGain();
        gainNode.gain.value = 0.8; // 默认音量
        // 连接：Source -> Gain -> Destination
        srcNode.connect(gainNode);
        gainNode.connect(this._audioDestination);
        source.audioSourceNode = srcNode;
        source.gainNode = gainNode;
    } catch (e) {}
  }

  /**
   * 计算当前视频源的布局 (例如 1x1, 2x2, 3x3)
   * 布局基于最大的槽位索引 (maxSlot + 1 = count)
   */
  _calcLayout() {
    let maxSlot = -1;
    // 找出占用的最大槽位编号
    for(const src of this._sources.values()) {
        if(src.slot > maxSlot) maxSlot = src.slot;
    }
    
    const count = maxSlot + 1; // 布局所需的总单元格数 (基于最大槽位)
    const isPortrait = this._canvas.height > this._canvas.width;
    let cols = 1, rows = 1;

    // 核心布局逻辑
    if (count <= 1) { cols = 1; rows = 1; }
    else if (count <= 2) {
        if (isPortrait) { cols = 1; rows = 2; } else { cols = 2; rows = 1; } // 竖屏 1x2，横屏 2x1
    }
    else if (count <= 4) { cols = 2; rows = 2; } // 2x2
    else if (count <= 6) {
        if (isPortrait) { cols = 2; rows = 3; } else { cols = 3; rows = 2; } // 竖屏 2x3，横屏 3x2
    }
    else if (count <= 9) { cols = 3; rows = 3; } // 3x3
    else { // 超过 9 个源，按近似正方形布局
        cols = Math.ceil(Math.sqrt(count));
        rows = Math.ceil(count / cols);
    }
    return { cols, rows };
  }

  /**
   * 视频绘制循环 (使用 requestAnimationFrame 保持流畅)
   */
  _drawLoop() {
    if (this._isStopDrawing) return;

    // 1. 清空 Canvas (绘制黑色背景)
    this._context.fillStyle = '#000';
    this._context.fillRect(0, 0, this._canvas.width, this._canvas.height);

    // 2. 计算当前布局参数
    const { cols, rows } = this._calcLayout();
    const cellW = this._canvas.width / cols;
    const cellH = this._canvas.height / rows;

    // 3. 遍历所有视频源并绘制到对应位置
    this._sources.forEach(source => {
        // 确保视频有足够的帧数据可以绘制 (readyState >= 2)
        if(source.video.readyState >= 2) {
            const slot = source.slot;
            // 计算该槽位的列和行索引
            const c = slot % cols;
            const r = Math.floor(slot / cols);
            // 目标绘制区域的左上角坐标
            const targetX = c * cellW;
            const targetY = r * cellH;

            const vw = source.video.videoWidth;
            const vh = source.video.videoHeight;
            if(vw && vh) {
                // 计算等比例缩放，保持视频长宽比 (Contain 模式)
                const scale = Math.min(cellW / vw, cellH / vh);
                const dw = vw * scale; // 实际绘制宽度
                const dh = vh * scale; // 实际绘制高度
                // 计算居中偏移量
                const dx = targetX + (cellW - dw) / 2;
                const dy = targetY + (cellH - dh) / 2;
                
                // 核心绘制 API: 将视频帧画到 Canvas 上
                this._context.drawImage(source.video, dx, dy, dw, dh);
            }
        }
    });
    
    // 绘制网格覆盖层 (可选)
    if(window.app && window.app.drawOverlay) window.app.drawOverlay(cols, rows);
    
    // 循环调用
    this._animationId = requestAnimationFrame(this._drawLoop.bind(this));
  }

  /**
   * 获取 Canvas 混合后的视频流 (MediaStream)
   * 核心：利用 canvas.captureStream(fps) 实现输出帧率控制
   * @returns {MediaStream} 包含视频轨的流
   */
  getVideoStream() {
    this._isStopDrawing = false;
    this._drawLoop(); // 启动 Canvas 绘制循环
    // **核心 FPS 控制**：以 this._config.fps 速率从 Canvas 捕获 MediaStream
    return this._canvas.captureStream(this._config.fps);
  }

  /**
   * 获取 Web Audio API 混合后的音频流 (MediaStream)
   * @returns {MediaStream} 包含音频轨的流
   */
  async getAudioStream() {
    // 懒创建 AudioContext
    if (!this._audioContext) {
        this._audioContext = new AudioContext();
        // MediaStreamDestinationNode：将 Web Audio 的输出转换为 MediaStream
        this._audioDestination = this._audioContext.createMediaStreamDestination();
    }
    // 确保 AudioContext 处于运行状态 (处理浏览器安全策略)
    if (this._audioContext.state === 'suspended') await this._audioContext.resume();
    
    // 连接所有现有源的音频
    this._sources.forEach(s => this._connectAudio(s));
    
    return this._audioDestination.stream;
  }

  /**
   * 获取完整的混合 MediaStream (视频 + 音频)
   */
  async getMixedStream() {
    const v = this.getVideoStream(); // 获取视频流 (已控制 FPS)
    const a = await this.getAudioStream(); // 获取音频流
    
    // 创建一个新的 MediaStream，合并视频轨和音频轨
    const m = new MediaStream();
    v.getVideoTracks().forEach(t => m.addTrack(t));
    if (a) a.getAudioTracks().forEach(t => m.addTrack(t));
    return m;
  }

  /**
   * 停止混流引擎并释放资源
   */
  stop() {
    this._isStopDrawing = true;
    if (this._animationId) cancelAnimationFrame(this._animationId); // 停止绘制循环
    
    // 移除并清理所有输入流资源
    this._sources.forEach(s => this.removeStream(s.id));
    this._sources.clear();
    
    // 关闭 AudioContext
    if (this._audioContext) {
        this._audioContext.close();
        this._audioContext = null;
    }
  }
}

// ==========================================
// 2. Utils (虚拟源生成器 - 支持动态输入 FPS 控制)
// ==========================================
const VirtualGen = {
    audioCtx: null,

    /**
    * 创建一个模拟视频流，其视频帧率由 captureStream(fps) 控制
    * @param {number} width 
    * @param {number} height
    * @param {number} fps 目标输入帧率
    */
    create(width, height, fps, label, id) {
        // ... AudioContext 初始化略 ...
        if(!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();
        
        const canvas = document.createElement('canvas'); 
        canvas.width = width; 
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const hue = (id * 137) % 360; 
        let x = 0; 

        // Draw 函数仍然以浏览器最高的刷新率 (通常 60Hz) 运行
        // 这样可以保证 Canvas 上的动画平滑，**但实际捕获帧率由 captureStream 控制**
        const draw = () => {
            // 绘制动态内容 (一个移动的方块)
            // ... 绘制逻辑略 ...
            ctx.fillStyle = '#0f172a'; 
            ctx.fillRect(0,0,width,height);
            // ... 绘制边框和方块 ...
            x = (x + width * 0.015) % width; // 移动方块
            // ... 绘制文字 (SRC-X, 分辨率@FPS) ...
            requestAnimationFrame(draw);
        };
        draw();
        
        // **核心输入 FPS 控制**：通过 canvas.captureStream(fps) 捕获指定帧率的流
        const vStream = canvas.captureStream(fps);

        // 音频生成 (模拟信号)
        // ... Audio 逻辑略 ...
        const dest = this.audioCtx.createMediaStreamDestination();
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.frequency.value = 200 + (id * 100);
        gain.gain.value = 0.2;
        osc.connect(gain); gain.connect(dest); osc.start();

        // 合并视频轨和音频轨
        const mixed = new MediaStream([...vStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
        mixed.id = `virtual-${id}-${Date.now()}`;
        mixed.stopInternal = () => { try{osc.stop()}catch(e){} }; // 提供内部清理函数
        return mixed;
    }
};

// ==========================================
// 3. UI 交互逻辑 (App)
// ==========================================
const app = {
    mixer: null, // SlotMixer 实例
    localStreams: [], // 存储所有输入的 MediaStream，便于清理
    counter: 0,
    currentSlot: 0, // 当前选中的槽位

    // UI 元素的引用
    ui: {
        slotGrid: document.getElementById('slot-selector'),
        mixedVideo: document.getElementById('mixed-video'),
        thumbs: document.getElementById('thumbs-container'),
        btnStart: document.getElementById('btn-start'),
        btnStop: document.getElementById('btn-stop'),
        panelSources: document.getElementById('panel-sources'),
        statusBadge: document.getElementById('status-badge'),
        overlay: document.getElementById('grid-overlay'),
        statsLayout: document.getElementById('stat-layout'),
        statsAudio: document.getElementById('stat-audio'),
        statsSize: document.getElementById('stat-size')
    },

    init() {
        // 初始化 9 个槽位按钮
        for(let i=0; i<9; i++) {
            const btn = document.createElement('div');
            btn.className = 'slot-btn';
            btn.innerText = i;
            btn.dataset.slot = i;
            btn.onclick = () => this.selectSlot(i);
            this.ui.slotGrid.appendChild(btn);
        }
        this.selectSlot(0); // 默认选中槽位 0

        this.ui.btnStart.onclick = () => this.start();
        this.ui.btnStop.onclick = () => this.stop();
    },

    selectSlot(idx) {
        // ... 槽位选择逻辑略 ...
        this.currentSlot = idx;
        const btns = this.ui.slotGrid.children;
        for(let b of btns) {
            b.classList.toggle('active', parseInt(b.dataset.slot) === idx);
        }
    },

    updateSlotUI() {
        // ... 更新槽位占用状态 UI 略 ...
        if(!this.mixer) return;
        const occupied = new Set();
        this.mixer._sources.forEach(s => occupied.add(s.slot));
        const btns = this.ui.slotGrid.children;
        for(let b of btns) {
            b.classList.toggle('occupied', occupied.has(parseInt(b.dataset.slot)));
        }
    },

    async start() {
        const [w, h] = document.getElementById('cfg-out-res').value.split('x').map(Number);
        const fps = parseInt(document.getElementById('cfg-fps').value); // 获取输出帧率

        // 实例化混流器，传入输出分辨率和输出 FPS
        this.mixer = new SlotMixer({ width: w, height: h, fps: fps });
        
        try {
            // 获取混合后的流，并将其设置到预览 video 元素
            const outStream = await this.mixer.getMixedStream();
            this.ui.mixedVideo.srcObject = outStream;
            
            // 更新 UI 状态
            this.ui.btnStart.style.display = 'none';
            this.ui.btnStop.style.display = 'block';
            this.ui.panelSources.style.opacity = '1';
            this.ui.panelSources.style.pointerEvents = 'auto';
            this.ui.statusBadge.innerText = "运行中";
            this.ui.statusBadge.style.background = "#4ade80";
            this.ui.statusBadge.style.color = "white";
            this.ui.statsSize.innerText = `${w}x${h} @ ${fps}fps`;
            this.ui.thumbs.innerHTML = '';
            this.startViz(outStream); // 启动音频可视化
        } catch (e) {
            alert(e.message);
        }
    },

    stop() {
        // ... 停止和清理逻辑略 ...
        if(this.mixer) {
            this.mixer.stop();
            this.mixer = null;
        }
        // 停止所有输入的本地流
        this.localStreams.forEach(s => {
            s.getTracks().forEach(t => t.stop());
            if(s.stopInternal) s.stopInternal();
        });
        this.localStreams = [];
        // ... 更新 UI 状态略 ...
    },

    async _handleStreamAdd(stream, label) {
        if(!this.mixer) return;
        const slot = this.currentSlot;
        // 将流添加到混流器
        const success = this.mixer.appendStream(stream, slot);
        
        if(success) {
            this.localStreams.push(stream);
            this.addThumb(stream, label, slot); // 添加缩略图
            this.updateSlotUI(); // 更新槽位状态
            
            // 自动选择下一个槽位
            let nextSlot = slot + 1;
            if (nextSlot < 9) this.selectSlot(nextSlot);
        }
        this.updateStats();
    },

    addThumb(stream, label, slot) {
        // ... 缩略图创建和排序逻辑略 ...
        const existing = document.querySelector(`.source-thumb[data-slot="${slot}"]`);
        if(existing) existing.remove();
        if(this.ui.thumbs.innerText.includes('暂无')) this.ui.thumbs.innerHTML = '';

        const div = document.createElement('div');
        div.className = 'source-thumb';
        div.dataset.slot = slot;
        div.id = `thumb-${stream.id}`;
        
        div.innerHTML = `
            <div class="slot-tag">${slot}</div>
            <div class="remove-btn" onclick="app.removeSource('${stream.id}')">&times;</div>
            <video autoplay muted playsinline></video>
            <div class="info">${label}</div>
        `;
        div.querySelector('video').srcObject = stream;
        
        // 按槽位编号排序插入
        const thumbs = Array.from(this.ui.thumbs.children);
        const nextThumb = thumbs.find(t => parseInt(t.dataset.slot) > slot);
        if(nextThumb) this.ui.thumbs.insertBefore(div, nextThumb);
        else this.ui.thumbs.appendChild(div);
    },

    removeSource(id) {
        // ... 移除源和清理逻辑略 ...
        if(!this.mixer) return;
        this.mixer.removeStream(id);
        
        // 停止本地流的 MediaStreamTrack
        const idx = this.localStreams.findIndex(s => s.id === id);
        if(idx !== -1) {
            const s = this.localStreams[idx];
            s.getTracks().forEach(t => t.stop());
            if(s.stopInternal) s.stopInternal(); // 清理虚拟源的内部振荡器
            this.localStreams.splice(idx, 1);
        }
        // ... 更新 UI 略 ...
    },

    addVirtual() {
        this.counter++;
        let w=640, h=360;
        const resVal = document.getElementById('cfg-in-res').value;
        if(resVal !== 'auto') [w, h] = resVal.split('x').map(Number);
        
        // **关键：获取选中的输入帧率**
        const fps = parseInt(document.getElementById('cfg-in-fps').value);
        
        // 创建虚拟源，将目标 FPS 传递给 VirtualGen
        const s = VirtualGen.create(w, h, fps, `SRC-${this.counter}`, this.counter);
        this._handleStreamAdd(s, `虚拟源 ${this.counter}`);
    },

    async addCamera() {
        try {
            const constraints = { video: {}, audio: true };
            const resVal = document.getElementById('cfg-in-res').value;
            // 设置分辨率约束
            if(resVal !== 'auto') {
                const [w, h] = resVal.split('x').map(Number);
                constraints.video.width = {ideal: w};
                constraints.video.height = {ideal: h};
            }
            // **关键：尝试应用输入帧率设置到摄像头** (理想值)
            const fps = parseInt(document.getElementById('cfg-in-fps').value);
            constraints.video.frameRate = { ideal: fps };

            // 采集摄像头流
            const s = await navigator.mediaDevices.getUserMedia(constraints);
            this._handleStreamAdd(s, '摄像头');
        } catch(e) { alert("摄像头失败: " + e.message); }
    },

    async addScreen() {
        try {
            // **关键：尝试应用输入帧率设置到屏幕共享** (作为最大值)
            const fps = parseInt(document.getElementById('cfg-in-fps').value);
            const s = await navigator.mediaDevices.getDisplayMedia({video:{frameRate:fps}, audio:true});
            this._handleStreamAdd(s, '屏幕共享');
            // 监听屏幕共享结束事件 (例如用户点击停止共享)
            s.getVideoTracks()[0].onended = () => this.removeSource(s.id);
        } catch(e) {}
    },

    clearAll() {
        // ... 清空所有流 ...
        [...this.localStreams].forEach(s => this.removeSource(s.id));
    },

    updateStats() {
        // ... 更新音频通道统计 ...
        if(!this.mixer) return;
        let ac = 0; this.mixer._sources.forEach(s => { if(s.audioSourceNode) ac++ });
        this.ui.statsAudio.innerText = ac;
    },

    drawOverlay(cols, rows) {
        // ... 绘制网格覆盖层 UI 逻辑 ...
        this.ui.overlay.style.width = '100%';
        this.ui.overlay.style.height = '100%';
        this.ui.overlay.innerHTML = '';
        this.ui.statsLayout.innerText = `${cols}x${rows}`;
        // ... 循环创建网格单元和编号标签 ...
    },

    /**
    * 音频可视化 (Audio Visualization)
    * 从混合后的输出流中提取音频数据进行绘制
    */
    startViz(stream) {
        const ac = new AudioContext();
        const src = ac.createMediaStreamSource(stream); // 从 MediaStream 创建 Source
        const an = ac.createAnalyser(); an.fftSize = 128; // AnalyserNode 用于分析音频数据
        src.connect(an); // 连接：Source -> Analyser
        
        const cvs = document.getElementById('viz-canvas');
        const ctx = cvs.getContext('2d');
        const data = new Uint8Array(an.frequencyBinCount); // 用于存储频率数据的数组
        
        const draw = () => {
            if(!this.mixer) { ac.close(); return; }
            requestAnimationFrame(draw);
            cvs.width = cvs.clientWidth; cvs.height = cvs.clientHeight;
            
            an.getByteFrequencyData(data); // 获取频率数据
            ctx.clearRect(0,0,cvs.width,cvs.height);
            
            // 绘制频率条 (柱状图)
            const barW = (cvs.width / data.length)*2.5;
            let x = 0;
            for(let i=0; i<data.length; i++) {
                const h = (data[i]/255)*cvs.height; // 归一化高度
                ctx.fillStyle = `rgb(${h+50}, 220, 100)`;
                ctx.fillRect(x, cvs.height-h, barW, h);
                x+=barW+1;
            }
        };
        draw();
    }
};

app.init();
</script>
</body>
</html>
```