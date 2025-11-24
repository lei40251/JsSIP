好的，这是一份对您提供的 **720P 高分辨率 30FPS 视频混合器** HTML/JavaScript 代码的**非常详细**的中文注释版本。

这份代码实现了一个高性能的视频混合器（Video Mixer），它能够将多个 Canvas 或 MediaStream（通过 `canvas.captureStream` 模拟）的视频源合并到一个输出流中，并支持多种渲染模式（Worker + WebGL, Worker + Canvas2D, Main Thread + Canvas2D）以优化性能。

-----

## 💻 720P 高分辨率 30FPS 混合器代码详细注释

### HTML 结构与样式 (`<head>` / `<body>`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>720P High-Res 30FPS Mixer - Selectable Mode</title>
    <style>
        /* 页面基础样式：黑色背景，白色文字，居中布局 */
        body { background: #000; color: #fff; font-family: sans-serif; text-align: center; margin: 0; padding: 20px; }
        /* 状态信息显示区域 */
        #status { color: #0f0; font-size: 12px; padding: 8px; border: 1px solid #333; background: #111; margin: 10px auto; max-width: 800px; border-radius: 4px; }
        /* 最终输出视频区域的样式 (1280x720 比例) */
        #outputVideo { width: 100%; max-width: 1280px; aspect-ratio: 16 / 9; border: 1px solid #333; background: #111; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        /* 控制按钮容器 */
        .controls { margin: 20px; display: flex; gap: 15px; justify-content: center; align-items: center; }
        /* 按钮和选择框的通用样式 */
        button, select { padding: 12px 20px; font-size: 16px; font-weight: 600; border-radius: 6px; cursor: pointer; border: 1px solid #555; background: #2c2c2e; color: white; }
        /* Start 按钮特定颜色 */
        #startBtn { background: #007aff; border-color: #007aff; }
        /* Stop 按钮特定颜色 */
        #stopBtn { background: #ff3b30; border-color: #ff3b30; }
        /* 禁用状态样式 */
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        /* 用于存储 Video 元素的强制隐藏样式，这些元素用于 VideoFrame/ImageBitmap 的数据源 */
        .force-visible { position: fixed; top: 0; left: 0; width: 1px; height: 1px; z-index: 99999; opacity: 0.01; pointer-events: none; }
    </style>
</head>
<body>

    <h3>720P High-Res / 30 FPS (Final Fix)</h3>
    <div id="status">System Standby</div>
    
    <div class="main-stage">
        <video id="outputVideo" autoplay playsinline webkit-playsinline muted controls></video>
    </div>

    <div class="controls">
        <label for="renderModeSelect" style="color: #ccc;">渲染模式:</label>
        <select id="renderModeSelect">
            <option value="Auto">Auto (推荐)</option>
            <option value="Worker_WebGL">Tier 1: Worker + WebGL (最高性能)</option>
            <option value="Worker_Canvas2D">Tier 2: Worker + 2D (中等性能)</option>
            <option value="MainThread_Canvas2D">Tier 3: Main Thread + 2D (最低兼容)</option>
        </select>
        <button id="startBtn">Start Mixer</button>
        <button id="stopBtn" disabled>Stop</button>
    </div>

    <div style="display:none;">
        <canvas id="c1" width="1280" height="720"></canvas>
        <canvas id="c2" width="1280" height="720"></canvas>
        <canvas id="c3" width="1280" height="720"></canvas>
        <canvas id="c4" width="1280" height="720"></canvas>
    </div>

<script>
```

### Worker 脚本 (`workerScript`)

这段代码是定义了一个**字符串**，它将作为 **Web Worker** 的代码被执行。它负责高性能的渲染操作，以减轻浏览器主线程的压力。

```javascript
/**
 * ============================================================================
 * Worker Code (FIXED: Standard string concatenation used for mode message)
 * ============================================================================
 */
const workerScript = `
let canvas, gl, ctx, renderMode;
let textureCache = [null, null, null, null]; // WebGL 纹理缓存数组，最多 4 个源

// WebGL 顶点着色器：定义顶点位置和纹理坐标
const vsSource = \`attribute vec4 a_position; attribute vec2 a_texCoord; varying vec2 v_texCoord; void main() { gl_Position = a_position; v_texCoord = a_texCoord; }\`;
// WebGL 片段着色器：通过采样纹理来获取颜色，实现图像绘制
const fsSource = \`precision mediump float; varying vec2 v_texCoord; uniform sampler2D u_image; void main() { gl_FragColor = texture2D(u_image, v_texCoord); }\`;

/**
 * 初始化 WebGL 渲染环境
 * @param {WebGLRenderingContext} gl - WebGL 上下文
 * @returns {boolean} 初始化是否成功
 */
function initWebGL(gl) {
    try {
        // 辅助函数：编译着色器
        const compile = (t, s) => { const h = gl.createShader(t); gl.shaderSource(h, s); gl.compileShader(h); return h; };
        // 创建并链接程序
        const p = gl.createProgram();
        gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSource));
        gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSource));
        gl.linkProgram(p);
        gl.useProgram(p);
        
        // 设置顶点和纹理坐标的 Buffer (绘制一个覆盖整个视口的矩形/三角形带)
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        // 包含 (-1,-1) 到 (1,1) 的顶点坐标和 (0,0) 到 (1,1) 的纹理坐标
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]), gl.STATIC_DRAW);
        
        // 关联着色器中的属性变量
        const pl = gl.getAttribLocation(p, "a_position");
        const tl = gl.getAttribLocation(p, "a_texCoord");
        gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(pl);
        gl.vertexAttribPointer(tl, 2, gl.FLOAT, false, 16, 8); gl.enableVertexAttribArray(tl);
        
        // 关联纹理单元
        gl.uniform1i(gl.getUniformLocation(p, "u_image"), 0);
        return true;
    } catch(e) { return false; }
}

/**
 * Worker 接收主线程消息的回调函数
 */
self.onmessage = function(e) {
    const { type, payload } = e.data;
    
    // 初始化消息
    if (type === 'INIT') {
        canvas = payload.canvas; // 从主线程转移控制权的 OffscreenCanvas
        const requestedMode = payload.requestedMode; 
        const isAndroid = payload.isAndroid;

        // 尝试 WebGL 渲染模式 (Tier 1)
        if (requestedMode === 'Worker_WebGL') {
            // WebGL 上下文属性：禁用 Alpha，启用 Desynchronized (防止输入延迟)，禁用抗锯齿
            const attr = { alpha: false, desynchronized: true, antialias: false, powerPreference: "high-performance" };
            // 尝试获取 WebGL2 或 WebGL 上下文
            gl = canvas.getContext('webgl2', attr) || canvas.getContext('webgl', attr);
            
            if (gl && initWebGL(gl)) {
                renderMode = 'WebGL';
                self.postMessage({ type: 'READY', mode: 'Tier 1 (Worker WebGL)' }); // 通知主线程准备就绪
                return;
            }
        }

        // Canvas2D 渲染模式 (Tier 2 或 WebGL 失败时的回退)
        // 注意：在 Android 上禁用 desynchronized 以避免已知的 Bug 或撕裂问题
        ctx = canvas.getContext('2d', { alpha: false, desynchronized: !isAndroid });
        renderMode = 'Canvas2D';
        // FIXED LINE: 标准字符串拼接，发送状态信息给主线程
        self.postMessage({ type: 'READY', mode: 'Tier 2 (Worker 2D / ' + requestedMode + ')' });
    } 
    // 绘图消息
    else if (type === 'DRAW') {
        try {
            // 根据已确定的渲染模式调用对应的绘图函数
            if (renderMode === 'WebGL') drawWebGL(payload.frames, payload.totalSources);
            else drawCanvas2D(payload.frames, payload.totalSources);
        } finally {
            // 绘图完成后通知主线程 Worker 空闲
            self.postMessage({ type: 'DONE' });
        }
    }
    // 销毁/停止消息
    else if (type === 'DESTROY') {
        if (gl) {
             // 销毁 WebGL 纹理和上下文
             textureCache.forEach(t => t && gl.deleteTexture(t));
             gl.getExtension('WEBGL_losing_context')?.loseContext();
        }
        self.close(); // 关闭 Worker
    }
};

/**
 * 使用 WebGL 绘制帧
 * @param {Array<{index: number, frame: (VideoFrame|ImageBitmap)}>} frames - 要绘制的帧数组
 * @param {number} totalSources - 总视频源数量
 */
function drawWebGL(frames, totalSources) {
    gl.clearColor(0, 0, 0, 1); // 清空背景为黑色
    gl.clear(gl.COLOR_BUFFER_BIT);
    const w = gl.canvas.width; const h = gl.canvas.height;
    const useGrid = totalSources > 1; // 超过 1 个源则启用 2x2 网格布局
    const gridW = useGrid ? w / 2 : w;
    const gridH = useGrid ? h / 2 : h;

    frames.forEach(item => {
        const i = item.index;
        // 绑定或创建纹理
        if (!textureCache[i]) {
            textureCache[i] = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, textureCache[i]);
            // 设置纹理参数
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, textureCache[i]);
        }
        
        // 将 VideoFrame 或 ImageBitmap 上传为 WebGL 纹理
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, item.frame);
        
        // 计算 Viewport (视口) 位置，实现 2x2 网格
        let x = useGrid ? (i % 2) * gridW : 0;
        let y = useGrid ? Math.floor(i / 2) * gridH : 0;
        // WebGL 坐标系 Y 轴是反转的，所以需要 (h - (y + gridH))
        gl.viewport(x, h - (y + gridH), gridW, gridH);
        
        // 绘制矩形
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        item.frame.close(); // 释放 VideoFrame/ImageBitmap 资源
    });
    gl.flush(); // 强制执行所有 WebGL 命令
}

/**
 * 使用 Canvas2D 绘制帧
 * @param {Array<{index: number, frame: (VideoFrame|ImageBitmap)}>} frames - 要绘制的帧数组
 * @param {number} totalSources - 总视频源数量
 */
function drawCanvas2D(frames, totalSources) {
    const w = canvas.width; const h = canvas.height;
    // 如果源不足 4 个，清空背景，避免残留
    if (totalSources < 4) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); }
    const gridW = totalSources > 1 ? w / 2 : w;
    const gridH = totalSources > 1 ? h / 2 : h;
    
    frames.forEach(item => {
        const i = item.index;
        // 计算绘制位置，实现 2x2 网格
        let x = totalSources > 1 ? (i % 2) * gridW : 0;
        let y = totalSources > 1 ? Math.floor(i / 2) * gridH : 0;
        
        // 绘制帧到 Canvas2D
        ctx.drawImage(item.frame, x, y, gridW, gridH);
        item.frame.close(); // 释放 VideoFrame/ImageBitmap 资源
    });
}
`;
```

### 主线程 - 混合器类 (`ProductionMixer`)

该类封装了视频混合器的核心逻辑，包括初始化 Worker、管理视频源、以及驱动渲染循环。

```javascript
/**
 * ============================================================================
 * Main Mixer Class
 * ============================================================================
 */
class ProductionMixer {
    /**
     * @param {string} renderModeOverride - 强制渲染模式 (例如: 'Worker_WebGL')
     */
    constructor(renderModeOverride = 'Auto') {
        this.config = { width: 1280, height: 720, fps: 30 };
        this.renderModeOverride = renderModeOverride; 
        
        this.sources = []; // 视频源数组
        this.canvas = document.createElement('canvas'); // 用于捕获最终流的 Canvas
        this.canvas.width = this.config.width;
        this.canvas.height = this.config.height;
        
        this.isRunning = false;
        this.worker = null;
        this.renderMode = 'Init...';
        this.isWorkerBusy = false; // 标志 Worker 是否正在忙碌
        
        this.frameInterval = 1000 / this.config.fps; // 30 FPS 的帧间隔时间
        this.lastFrameTime = 0;
        this.animationFrameId = null;
        
        // 检查浏览器是否支持高性能的 VideoFrame API (比 createImageBitmap 更好)
        this.hasVideoFrame = typeof VideoFrame !== 'undefined';
        
        this._init();
    }

    /**
     * 内部初始化函数：根据配置确定渲染模式 (Worker 或 Main Thread)
     */
    _init() {
        const isAndroid = /Android/i.test(navigator.userAgent);
        // 检查是否支持 Worker + OffscreenCanvas (高性能模式的基础)
        const supportsWorker = window.Worker && window.OffscreenCanvas;

        let selectedMode = this.renderModeOverride;
        
        // 1. 如果强制选择 Main Thread Canvas2D 模式 (Tier 3)
        if (selectedMode === 'MainThread_Canvas2D') {
            this.renderMode = 'Tier 3 (Main Thread)';
            // 在主线程获取 Canvas2D 上下文
            this.ctx = this.canvas.getContext('2d', { alpha: false });
            this.log(`Mode: Manual Main Thread (720P@30FPS)`);
            return;
        }

        // 2. 如果请求 Worker 模式，但浏览器不支持，则降级到 Main Thread
        if (selectedMode !== 'Auto' && !supportsWorker) {
             selectedMode = 'MainThread_Canvas2D'; 
             this.log(`⚠️ Worker Mode requested but OffscreenCanvas not supported. Falling back to Main Thread.`);
        }
        
        // 3. 尝试 Worker 模式 (Tier 1/2)
        if (supportsWorker) {
            try {
                // 如果是 Auto 模式，默认请求 Worker_WebGL (Tier 1)
                const requestedMode = selectedMode === 'Auto' ? 'Worker_WebGL' : selectedMode;
                
                // 将 Canvas 控制权转移给 Worker
                const offscreen = this.canvas.transferControlToOffscreen();
                // 将 Worker 脚本字符串转为 Blob 并创建 Worker 实例
                const blob = new Blob([workerScript], { type: 'application/javascript' });
                this.worker = new Worker(URL.createObjectURL(blob));
                
                // Worker 消息处理
                this.worker.onmessage = (e) => {
                    if (e.data.type === 'READY') {
                        // Worker 初始化成功，获取实际运行的渲染模式
                        this.renderMode = e.data.mode;
                        this.log(`System Ready: ${this.renderMode} (720P@30FPS)`);
                    } else if (e.data.type === 'DONE') {
                        // Worker 告知绘图完成，解除忙碌状态
                        this.isWorkerBusy = false;
                    }
                };
                
                // 发送 INIT 消息给 Worker，并转移 OffscreenCanvas 控制权
                this.worker.postMessage({ 
                    type: 'INIT', 
                    payload: { canvas: offscreen, isAndroid: isAndroid, requestedMode: requestedMode } 
                }, [offscreen]); // [offscreen] 是 Transferable 数组，用于转移对象所有权
                return;
            } catch (e) { console.warn("Worker init failed:", e); }
        }
        
        // 4. 最终回退到 Main Thread Canvas2D 模式 (Tier 3)
        this.renderMode = 'Tier 3 (Main Thread)';
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.log(`System Ready: Tier 3 Fallback (Worker initialization failed)`);
    }

    /**
     * 更新状态栏信息
     */
    log(msg) { document.getElementById('status').innerText = msg; }

    /**
     * 添加视频流作为输入源
     */
    addStream(stream, id) {
        // 创建一个隐藏的 Video 元素来播放流，以便获取 VideoFrame/ImageBitmap
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        video.autoplay = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.className = 'force-visible'; // 强制隐藏
        
        document.body.appendChild(video);
        this.sources.push({ id, element: video, index: this.sources.length });
    }

    /**
     * 启动混合器
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        // 确保所有视频源开始播放
        this.sources.forEach(s => s.element.play().catch(()=>{}));
        this.loop(); // 启动渲染循环
    }

    /**
     * 销毁混合器
     */
    destroy() {
        this.isRunning = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId); // 取消动画帧
        if (this.worker) {
            this.worker.postMessage({ type: 'DESTROY' }); // 通知 Worker 销毁
            this.worker.terminate(); // 终止 Worker 线程
            this.worker = null;
        }
        // 清理所有创建的 Video 元素
        this.sources.forEach(s => {
            s.element.srcObject = null;
            s.element.remove();
        });
        this.sources = [];
        document.getElementById('outputVideo').srcObject = null;
        this.log("Stopped");
    }

    /**
     * 获取混合后的 MediaStream
     */
    getMixedStream() {
        // 从 Canvas 中捕获 MediaStream
        return this.canvas.captureStream(this.config.fps);
    }

    /**
     * 渲染循环，使用 requestAnimationFrame 驱动
     */
    async loop(timestamp) {
        if (!this.isRunning) return;
        // 请求下一个动画帧
        this.animationFrameId = requestAnimationFrame((t) => this.loop(t));

        // 帧率控制：如果帧间隔时间未到，则跳过本次绘制
        if (timestamp && (timestamp - this.lastFrameTime < this.frameInterval)) return;
        this.lastFrameTime = timestamp;

        // 如果是 Worker 模式且 Worker 正在忙碌，则跳过本次绘制 (丢帧)
        if (this.worker && this.isWorkerBusy) return;

        const total = this.sources.length;
        let validItems = [];

        try {
            // 异步从所有视频源中提取帧 (VideoFrame 或 ImageBitmap)
            const framesPromises = this.sources.map(async (s) => {
                // 确保视频元素处于足够好的状态 (readyState >= 2)
                if (s.element.readyState >= 2) {
                    try {
                        if (this.hasVideoFrame) {
                            // 使用高性能的 VideoFrame API
                            return { index: s.index, frame: new VideoFrame(s.element) };
                        } else {
                            // 使用 ImageBitmap 作为兼容/回退方案
                            const bmp = await createImageBitmap(s.element); 
                            return { index: s.index, frame: bmp };
                        }
                    } catch (e) { return null; } // 捕获帧创建错误
                }
                return null;
            });

            const results = await Promise.all(framesPromises);
            validItems = results.filter(r => r !== null); // 过滤掉失败的帧

            if (validItems.length > 0) {
                // 如果是 Worker 模式
                if (this.worker && this.renderMode.includes('Worker')) {
                    this.isWorkerBusy = true; // 标记 Worker 忙碌
                    this.worker.postMessage(
                        { type: 'DRAW', payload: { frames: validItems, totalSources: total } }, 
                        validItems.map(i => i.frame) // 传递帧对象的所有权 (Transferable)
                    );
                    validItems = []; // 避免在 finally 中释放已转移的资源
                } 
                // 如果是 Main Thread 模式
                else if (this.ctx) {
                    this._drawMain(validItems, total); // 在主线程绘图
                }
            }
        } catch (error) {
            console.error("Loop Error:", error);
        } finally {
            // 释放未被转移或在主线程使用的帧资源
            if (validItems.length > 0) {
                validItems.forEach(i => i.frame.close());
            }
        }
    }

    /**
     * 主线程 Canvas2D 绘图逻辑
     */
    _drawMain(items, total) {
        if (total < 4) {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.config.width, this.config.height);
        }
        // 计算 2x2 网格的尺寸
        const gridW = total > 1 ? this.config.width / 2 : this.config.width;
        const gridH = total > 1 ? this.config.height / 2 : this.config.height;

        items.forEach(item => {
            const i = item.index;
            let x = total > 1 ? (i % 2) * gridW : 0;
            let y = total > 1 ? Math.floor(i / 2) * gridH : 0;
            
            // 绘制帧
            this.ctx.drawImage(item.frame, x, y, gridW, gridH);
            item.frame.close(); // 释放资源
        });
    }
}

// === Demo App Logic ===
let mixer = null;
let sourceIntervals = []; // 用于清除模拟视频源定时器的数组

document.getElementById('startBtn').addEventListener('click', async () => {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const selectedMode = document.getElementById('renderModeSelect').value;
    
    // 禁用/启用按钮
    startBtn.disabled = true;
    stopBtn.disabled = false;
    document.getElementById('renderModeSelect').disabled = true;

    // 创建混合器实例，使用选择的模式
    mixer = new ProductionMixer(selectedMode); 

    try {
        const colors = ['#ff3b30', '#34c759', '#007aff', '#ffcc00'];
        const streams = [];
        const startTime = Date.now();
        
        // 模拟 4 个视频源 (Canvas)
        for(let i=1; i<=4; i++) {
            const canvas = document.getElementById('c'+i);
            const ctx = canvas.getContext('2d', { alpha: false });
            
            // 设置定时器，以 30 FPS 左右的频率更新 Canvas 内容，模拟动态视频流
            const intervalId = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const offset = Math.floor(elapsed * 0.5) % 1280; // 模拟横向移动

                // 绘制背景、移动的矩形和源编号
                ctx.fillStyle = '#1c1c1e'; ctx.fillRect(0,0,1280,720);
                ctx.fillStyle = colors[i-1]; ctx.fillRect(offset, 260, 200, 200);
                ctx.fillStyle = '#fff'; ctx.font = 'bold 120px sans-serif'; ctx.fillText(i, 60, 180);
            }, 33); // 约 30 FPS (1000ms / 30 ≈ 33ms)
            sourceIntervals.push(intervalId);
            
            // 从模拟 Canvas 获取 MediaStream
            streams.push(canvas.captureStream(mixer.config.fps));
        }

        // 将流添加到混合器
        streams.forEach((s, i) => mixer.addStream(s, `uid-${i}`));
        mixer.start(); // 启动混合器渲染循环

        // 将混合器的输出流连接到页面的 <video> 元素
        const outVid = document.getElementById('outputVideo');
        outVid.srcObject = mixer.getMixedStream();
        outVid.play().catch(console.error); // 播放输出流

    } catch(e) {
        console.error(e);
        mixer.log("Error: " + e.message);
        document.getElementById('stopBtn').click(); // 遇到错误时停止
    }
});

document.getElementById('stopBtn').addEventListener('click', () => {
    if (mixer) {
        mixer.destroy(); // 销毁混合器实例
        mixer = null;
    }
    // 清除模拟视频源的定时器
    sourceIntervals.forEach(clearInterval);
    sourceIntervals = [];
    
    // 恢复按钮状态
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('renderModeSelect').disabled = false;
});
</script>
</body>
</html>
```

### 关键技术点总结

1.  **Web Worker + OffscreenCanvas (Tier 1 & 2):**
      * 通过将 Canvas 的渲染上下文转移到 **Web Worker** 中，实现了 **主线程与渲染分离**。这样即使进行复杂的 720P@30FPS 混合操作，主线程（负责 UI 和用户交互）也不会被阻塞，提供了更好的性能和用户体验。
2.  **WebGL 渲染 (Tier 1):**
      * 在 Worker 中使用 **WebGL** 进行图像混合，利用了设备的 **GPU** 进行加速，是性能最高的模式，尤其适合高分辨率和高帧率的场景。
3.  **Canvas2D 渲染 (Tier 2 & 3):**
      * Tier 2 在 Worker 中使用 Canvas2D，性能中等，但在 GPU 不支持 WebGL 或 WebGL 失败时作为回退。
      * Tier 3 在主线程使用 Canvas2D，性能最低，仅作为兼容性保障。
4.  **`VideoFrame` / `ImageBitmap`:**
      * 使用 `new VideoFrame(videoElement)` 或 `createImageBitmap(videoElement)` 从视频元素中高效地提取帧数据。这些对象是 **Transferable** 的，可以直接所有权转移给 Worker，避免了昂贵的内存拷贝。
5.  **`canvas.captureStream(fps)`:**
      * 将 Canvas 绘制的内容实时捕获为一个 **MediaStream**，并设置期望的帧率（30 FPS），这是将混合结果输出到 `<video>` 元素或用于 WebRTC/录制的基础。
6.  **资源管理 (`.close()`):**
      * 在 `loop` 函数和 Worker 绘图函数中，对 `VideoFrame` 或 `ImageBitmap` 使用了 `.close()` 方法，这是至关重要的，它用于释放底层资源，防止内存泄漏和性能下降。