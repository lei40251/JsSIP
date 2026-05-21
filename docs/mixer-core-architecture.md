# MediaStreamMixer 混流器模块架构分析

## 模块总览

MediaStreamMixer 是一个**多路音视频混流器**，将多个 `MediaStream` / `HTMLMediaElement`（常见为 `HTMLVideoElement`）合并为一个包含视频轨和音频轨的 `MediaStream`，可直接传递给 `RTCPeerConnection` 用于 WebRTC 推流。

### 快速理解路线

如果只想先建立整体模型，不建议从所有文件逐个读起。建议按下面顺序阅读：

1. **入口层**: `lib/Mixer.js` 只做导出，实际实现入口是 `lib/mixer-core/MixerController.js`。
2. **核心链路**: 输入源由 `SourceRegistry` 管理；视频画面由 `LayoutEngine → RenderLoop → RendererFactory` 处理；音频由 `AudioMixer → OutputStreamManager` 处理。
3. **渲染实现**: `MainCanvas2DRenderer` 是兜底实现；`MainWebGL2Renderer` 和 `WorkerRenderer` 是性能优化实现。
4. **运行状态**: `getSources()` 查看输入源状态，`getRenderInfo()` 查看视频渲染状态，`getAudioInfo()` 查看音频混音状态。
5. **生命周期**: `appendStream()` 添加源，`getMixedStream()/getVideoStream()` 创建输出流，`stop()` 释放资源且实例不可复用。

### 模块职责总览

```
MixerController 是总调度：
  SourceRegistry 管输入源
  LayoutEngine 只算每路视频画在哪里
  RenderLoop 负责每一帧什么时候画
  RendererFactory/Renderer 负责怎么画
  AudioMixer 负责把所有音轨混到一起
  OutputStreamManager 负责把 canvas/audio 变成最终 MediaStream
```

### 代码追踪入口

| 追踪目标 | 起点 | 继续查看 |
|----------|------|----------|
| 构造 `CRTC.Mixer` 时初始化了哪些子模块 | `MixerController.constructor()` | `MixerConfig.create()`、各子模块构造函数 |
| 添加输入源后的处理流程 | `MixerController.appendStream()` | `SourceRegistry.add()`、`AudioMixer.scheduleRefresh()`、`RenderLoop.start()` |
| slot 自动分配和同 slot 覆盖规则 | `SourceRegistry._getNextSlot()` / `SourceRegistry.add()` | `MixerConfig.normalizeSlot()`、`LayoutEngine._calcLayout()` |
| 单帧视频渲染流程 | `RenderLoop.renderFrame()` | `LayoutEngine.createRenderPayload()`、当前 renderer 的 `render()` |
| 渲染后端选择和降级规则 | `RendererFactory.createRenderer()` | `WorkerRenderer.init()`、`MainWebGL2Renderer.init()`、`MainCanvas2DRenderer.init()` |
| 输出 `MediaStream` 的创建流程 | `MixerController.getMixedStream()` | `OutputStreamManager.getVideoStream()`、`AudioMixer.getAudioStream()` |
| 后续添加的音频源如何补进已返回的 mixed stream | `AudioMixer._connectSource()` | `OutputStreamManager.ensureMixedStreamAudioTrack()` |
| 移除输入源时的资源清理流程 | `MixerController.removeStream()` | `SourceRegistry.remove()`、`AudioMixer.disconnectSource()`、`RenderLoop.removeSource()` |
| 停止混流器时释放的资源 | `MixerController.stop()` | `AudioMixer.stop()`、`RenderLoop.destroy()`、`OutputStreamManager.stop()` |
| 黑屏、无声、渲染降级的排查入口 | `getRenderInfo()` / `getAudioInfo()` | `RenderLoop._handleRendererInfo()`、`AudioMixer._updateAudioInfo()` |

### 关键状态速查

| 状态/API | 所属模块 | 用来确认 |
|---------|----------|----------|
| `source.id` / `source.slot` / `source.gain` | `SourceRegistry` | 标识输入源、布局位置和单路音量 |
| `source.ownedVideo` | `SourceRegistry` | 区分内部创建的隐藏 video 和外部传入的 video |
| `render payload.items[].draw` | `LayoutEngine` | renderer 实际消费的绘制矩形 |
| `_animationId` / `_stopped` | `RenderLoop` | rAF 是否仍在调度 |
| `actualMode` / `isFallback` / `reason` | renderer info | 当前实际渲染后端、是否降级、降级原因 |
| `droppedFrames` / `renderedFrames` | renderer info | Worker 是否繁忙、是否发生丢帧 |
| `status` / `contextState` / `connectedSources` | audio info | 音频是否已请求、AudioContext 状态、已连接源数量 |
| `_mixedStream` / `_videoStream` | `OutputStreamManager` | 输出流是否已创建、音频是否会补进已返回流 |

### 常见调试入口

| 现象 | 优先检查 | 重点确认 |
|------|----------|----------|
| 输出黑屏 | `getRenderInfo().actualMode`、`getSources()`、video `readyState` | renderer 是否启动、源是否可渲染、Worker 是否降级、canvas capture 是否创建 |
| 有画面无声音 | `getAudioInfo()`、源的 `hasAudio` | 是否调用 `getMixedStream()`、AudioContext 是否 suspended、源是否有 live audio track |
| Worker 渲染没有启用 | `getRenderInfo().actualMode/reason` | `auto` 在 Safari/WKWebView 是否走 main-webgl2、Worker 是否异步进入 `worker-failed` |
| 新增源没有进入画面 | `getSources()` 的 `slot` 和 `hasVideo` | slot 是否被覆盖、stream 是否 active、video 是否已有尺寸 |
| remove 后仍有残留 | `SourceRegistry.remove()` 回调链 | 音频节点是否断开、renderer 纹理是否释放、输出流是否仍持有旧 track |

### 目录结构

```
lib/
├── Mixer.js                          # 入口 barrel（re-export MixerController）
│
├── mixer-core/                       # 核心逻辑层
│   ├── MixerController.js            # 中枢控制器
│   ├── MixerConfig.js                # 配置归一化（纯函数）
│   ├── SourceRegistry.js             # 输入源注册表
│   ├── LayoutEngine.js               # 布局引擎
│   ├── MixerDomAdapter.js            # DOM 元素创建适配器
│   ├── AudioMixer.js                 # WebAudio 混音
│   ├── OutputStreamManager.js        # 输出流管理
│   └── RenderLoop.js                 # 渲染循环（rAF 驱动）
│
└── mixer-renderer/                   # 渲染后端层
    ├── RendererFactory.js            # 渲染器工厂（自动选择/降级）
    ├── BaseRenderer.js               # 渲染器基类（抽象接口）
    ├── MainCanvas2DRenderer.js       # 主线程 Canvas2D（最兼容，最终兜底）
    ├── MainWebGL2Renderer.js         # 主线程 WebGL2（GPU 加速）
    ├── WorkerRenderer.js             # Worker 线程渲染器（OffscreenCanvas）
    ├── workerScript.js               # Worker 内联脚本生成器
    └── helpers/
        ├── gl.js                     # WebGL 工具（shader 编译、纹理创建）
        └── color.js                  # CSS 颜色解析（用于 WebGL clearColor）
```

### 核心数据流

```
输入源 (MediaStream / HTMLMediaElement)
      │
      ├──▶ [SourceRegistry] ──▶ 源增删管理、video 元素创建
      │
      ├──▶ [AudioMixer] ──▶ WebAudio 混音 ──▶ MediaStreamAudioDestinationNode
      │                           │
      │                           └──▶ 音频轨注入到输出流
      │
      └──▶ [LayoutEngine] ──▶ 布局计算
                    │
                    ▼
            [RenderLoop] ──▶ rAF 驱动
                    │
                    ▼
          ┌──────────────────────────────────────────────────┐
          │            [RendererFactory]                     │
          │              /        |        \                 │
          │     MainCanvas2D  MainWebGL2  WorkerRenderer     │
          │     (CanvasRendering  (WebGL2   (OffscreenCanvas │
          │      Context2D)      shader)    → ImageBitmap)   │
          └──────────────────────┬───────────────────────────┘
                                 │
                                 ▼
                    canvas 帧绘制完成
                                 │
                                 ▼
            [OutputStreamManager] ◀── canvas.captureStream()
                    │
                    └──▶ 输出 MediaStream (视频轨 + 音频轨)
```

---

## 文件功能分析

### 入口

#### [lib/Mixer.js](../lib/Mixer.js) — 模块入口（barrel）

```javascript
module.exports = require('./mixer-core/MixerController');
```

- **职责**: 向后兼容的 barrel 文件。旧代码 `require('./Mixer')` 仍能工作。
- **实际类名**: `MediaStreamMixer`（即 MixerController 中 `module.exports` 的 class）。

---

### mixer-core 层

#### [lib/mixer-core/MixerController.js](../lib/mixer-core/MixerController.js) — 混流控制器（中枢）

**核心类**: `MediaStreamMixer`

##### 构造流程

```
constructor(videos, options)
  │
  ├─ MixerConfig.create(options) → 归一化配置
  │
  ├─ new MixerDomAdapter({ config, logger })
  │   └─ adapter.createCanvas() → 离屏 canvas
  │
  ├─ new SourceRegistry({ logger, callbacks })
  │   └─ 源增删、video 元素创建、音频/渲染器回调
  │
  ├─ new OutputStreamManager({ canvas, config, logger })
  │   └─ canvas.captureStream() 输出管理
  │
  ├─ new RenderLoop({ canvas, config, callbacks })
  │   └─ rAF 驱动、renderer 生命周期
  │
  ├─ new AudioMixer({ sourceRegistry, callbacks })
  │   └─ WebAudio 混音
  │
  └─ new LayoutEngine({ sourceRegistry, canvas, config, callbacks })
      └─ 布局计算
      │
      └─ appendStream(videos) → 添加初始源
```

##### 公开 API

| 方法 | 功能 | 调用链路 |
|------|------|---------|
| `appendStream(videos, options?)` | 添加输入源 | → SourceRegistry.add() → AudioMixer.scheduleRefresh() → RenderLoop.start() |
| `removeStream(streamOrId)` | 移除一路源 | → SourceRegistry.find() → SourceRegistry.remove() |
| `clearStreams()` | 移除所有源 | → 遍历 SourceRegistry.remove() |
| `getMixedStream()` | 获取完整混合流（视频+音频） | → getVideoStream() → setMixedStream() → getAudioStream() → addAudioTracksToStream() |
| `getVideoStream()` | 仅获取视频流 | → OutputStreamManager.getVideoStream() → 启动 RenderLoop |
| `getAudioStream()` | 仅获取音频流 | → AudioMixer.getAudioStream() |
| `getSources()` | 获取源快照 | → SourceRegistry.getSnapshot() |
| `getRenderInfo()` | 获取渲染状态 | → RenderLoop.getRenderInfo() → renderer.getInfo() |
| `getAudioInfo()` | 获取音频状态 | → AudioMixer.getInfo() |
| `stop()` | 销毁混流器 | → RenderLoop.stop() → clearStreams() → AudioMixer.stop() → RenderLoop.destroy() → OutputStreamManager.stop() |

##### 安全守卫

- `_assertNotDestroyed(methodName)`: 所有公开方法入口检查 `_destroyed` 标记，stop() 后禁止复用
- `_destroyed`: 构造时为 false，stop() 后设为 true，AudioMixer 也通过 `getDestroyed` 回调检测此标记

---

#### [lib/mixer-core/MixerConfig.js](../lib/mixer-core/MixerConfig.js) — 配置归一化

**纯函数工具模块**，所有方法无副作用。

| 方法 | 功能 | 归一化规则 |
|------|------|-----------|
| `create(options)` | 创建完整配置对象 | 将所有字段归一化后合并为对象 |
| `normalizeRenderMode(value, fallback)` | 渲染模式合法化 | 仅在 `VALID_RENDER_MODES` 集合中的值有效 |
| `normalizePositiveInteger(value, fallback)` | 正整数归一化 | >0 且有限 → floor，否则 fallback |
| `normalizeSlot(value, index)` | slot 编号归一化 | ≥0 整数 + index 偏移 |
| `normalizeGain(value, fallback)` | 音量增益归一化 | ≥0，允许放大（>1） |
| `normalizeSourceOptions(optionsOrSlot, index, defaultGain)` | appendStream 参数归一化 | 支持 `(stream, 3)` 和 `(stream, {slot, gain})` 两种调用形式 |

**默认配置**: width=1280, height=720, fps=null, backgroundColor='#000', audioGain=0.8, renderMode='auto', dropFrameWhenBusy=true, maxFrameQueue=1, preserveDrawingBuffer=true

---

#### [lib/mixer-core/SourceRegistry.js](../lib/mixer-core/SourceRegistry.js) — 输入源注册表

**职责**: 管理所有参与混流的输入源生命周期。

**source 对象结构**:
```javascript
{
  id: string,              // 唯一 ID（基于 stream.id 或自增）
  stream: MediaStream,     // 关联的 MediaStream
  video: HTMLMediaElement, // 参与绘制/换源检测的 media 元素，通常是 video
  slot: number | null,     // 布局槽位编号
  gain: number,            // 音量增益
  audioSourceNode: AudioNode | null,  // AudioMixer 连接时赋值
  gainNode: GainNode | null,          // AudioMixer 连接时赋值
  audioStream: MediaStream | null,    // 已连接的音频流引用
  ownedVideo: boolean      // 是否为 mixer 创建的 video
}
```

**关键方法**: `add` / `remove` / `find` / `getSnapshot` / `getStream` / `hasLiveAudioTrack` / `hasVideoTrack` / `isRenderable`

**回调链**（MixerController 构造时注入）:
```
onBeforeRemove(source)
  → AudioMixer.disconnectSource(source)   // 断开 WebAudio 连接

onAfterRemove(source)
  → RenderLoop.removeSource(source.id)    // 通知渲染器释放该源资源
  → 如果全部源已清空且仍在输出 → 绘制黑帧
```

---

#### [lib/mixer-core/LayoutEngine.js](../lib/mixer-core/LayoutEngine.js) — 布局引擎

**职责**: 根据输入源数量和 slot 分配，计算每路视频在固定画布上的绘制位置。

**网格布局**（3~4路→2x2，5~6路按比例，7~9→3x3，10+→接近正方形）

**缩放策略**: **contain 模式**：等比缩放使视频完整显示在目标区域内，剩余空间居中留边（更接近 CSS `object-fit: contain`）。如果后续希望铺满并裁剪，需要调整 `LayoutEngine._scaleVideo()`。

**render payload 结构**（RendererFactory 各渲染器的输入）:
```javascript
{
  width: number,
  height: number,
  backgroundColor: string,
  items: [{ id, slot, video: HTMLMediaElement, draw: { x, y, width, height } }]
}
```

---

#### [lib/mixer-core/MixerDomAdapter.js](../lib/mixer-core/MixerDomAdapter.js) — DOM 适配器

- `createCanvas()`: 创建 `display:none` 离屏 canvas
- `prepareCanvas(canvas)`: 设置 canvas 尺寸（仅变化时写入，避免清空画布）
- `createVideoElement(mediaStream)`: 创建隐藏 video 元素（display:none, muted, autoplay, playsinline）

---

#### [lib/mixer-core/AudioMixer.js](../lib/mixer-core/AudioMixer.js) — WebAudio 混音

**架构**: 每路源独立 `MediaStreamAudioSourceNode → GainNode`，全部汇总到 `MediaStreamAudioDestinationNode`。

**关键特性**:
- **延迟创建**: `AudioContext` 在调用 `getAudioStream()` 且存在 live 音频源时才初始化；没有 live 音频源时直接返回 `null`
- **独立音量**: 每路源独立 `GainNode`，通过 `source.gain` 控制
- **自动重连**: `syncExternalSourceAudio()` 检测外部传入的 `HTMLMediaElement.srcObject` 换源
- **刷新去抖**: `scheduleRefresh()` 带 pending 标记，避免并发刷新

**音频轨注入到视频流**: `_connectSource()` 成功后调用 `onAudioTrackAvailable` → `OutputStreamManager.ensureMixedStreamAudioTrack()`。

---

#### [lib/mixer-core/OutputStreamManager.js](../lib/mixer-core/OutputStreamManager.js) — 输出流管理

- `getVideoStream(drawFirstFrame)`: 先绘制首帧，再通过 `canvas.captureStream(fps)` 获取视频轨，并返回只含视频轨的新 `MediaStream`
- `setMixedStream(stream)`: 保存混合流引用，供后续音频补充
- `ensureMixedStreamAudioTrack(audioStream)`: 将音频轨注入到已返回给调用方的流中（**延迟音频**关键设计）
- `addAudioTracksToStream(target, audio)`: 通用去重音频注入
- `hasLiveVideoStream()`: 检测 video stream 是否仍有 live 轨
- `stop()`: 停止所有 captured tracks

---

#### [lib/mixer-core/RenderLoop.js](../lib/mixer-core/RenderLoop.js) — 渲染循环

**rAF 驱动，控制渲染节奏 + 管理渲染后端生命周期**。

```
requestAnimationFrame
    │
    ▼
renderFrame(timestamp, forceRender)
    │
    ├─ fps 节流检测 ── 未到间隔 → 跳过绘制
    │
    ├─ syncExternalSourceAudio()    ← 同步外部换源
    │
    ├─ createRenderPayload()        ← LayoutEngine 计算布局
    │
    ├─ ensureRenderer()             ← 按需创建渲染器（RendererFactory）
    │     └─ RendererFactory.createRenderer(canvas, config)
    │           │
    │           └─ 返回 BaseRenderer 子类实例
    │
    ├─ renderer.render(payload)     ← 实际绘制到 canvas
    │     │
    │     ├─ MainCanvas2DRenderer.render()  → fillRect() + drawImage()
    │     ├─ MainWebGL2Renderer.render()    → WebGL2 shader
    │     └─ WorkerRenderer.render()        → postMessage → Worker
    │
    ├─ _handleRendererInfo()        ← Worker 故障检测
    │
    └─ _scheduleNextFrame()         ← 无源暂停，有源恢复
```

**故障降级机制**:
```
WorkerRenderer 故障 × 2 或渲染异常 × 2
    │
    ▼
fallbackRendererToMain2D(reason)
    ├─ 条件：当前不是 main-2d && 是 Worker 或 worker-failed
    ├─ destroy() 当前 renderer
    └─ new MainCanvas2DRenderer() → init(canvas)
```

**fps 节流**: 非调整 rAF 间隔，而是在 rAF 回调内跳过未到间隔的帧。`forceRender=true` 跳过节流。

**无源暂停**: 源列表为空时不调度 rAF，`appendStream()` 后显式 `RenderLoop.start()` 恢复。

---

### mixer-renderer 层

#### [lib/mixer-renderer/BaseRenderer.js](../lib/mixer-renderer/BaseRenderer.js) — 渲染器基类

**渲染器抽象接口**，子类必须实现 `init(canvas)` 和 `render(payload)`。

**元信息 `_info`**:
```javascript
{
  requestedMode, actualMode,    // 请求和实际的渲染模式
  isWorker, isWebGL2,           // 运行环境标记
  isFallback, reason,           // 降级状态
  droppedFrames, renderedFrames,// 性能计数
  fps, width, height            // 输出参数
}
```

方法: `init()` / `render()` / `resize()` / `removeSource()` / `destroy()` / `getInfo()` / `_updateInfo()`

---

#### [lib/mixer-renderer/MainCanvas2DRenderer.js](../lib/mixer-renderer/MainCanvas2DRenderer.js) — 主线程 Canvas2D 渲染器

**最终的兜底路径**，兼容性最好。

```javascript
render(payload)
  // 1. 填背景色（覆盖上一帧残留和 contain 留边区域）
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);
  // 2. 遍历 items，drawImage 逐个绘制
  items.forEach(item => {
    if (item.video.readyState >= 2)
      ctx.drawImage(item.video, item.draw.x, item.draw.y, item.draw.width, item.draw.height);
  });
```

**注意**: `canvas.getContext('2d', { alpha: false })` — 禁用 alpha 通道，提升性能。

---

#### [lib/mixer-renderer/MainWebGL2Renderer.js](../lib/mixer-renderer/MainWebGL2Renderer.js) — 主线程 WebGL2 渲染器

**GPU 加速路径**，适用于 Safari/WKWebView 等无法使用 Worker WebGL2 的环境。

**架构**:
- 编译顶点 shader 和片元 shader（全屏四边形，纹理采样）
- 每路源一个 `WebGLTexture` 缓存，逐帧更新
- 通过 `gl.viewport` 裁剪到每个 item 的绘制区域

**render 流程**:
```
render(payload)
  │
  ├─ gl.clearColor → gl.clear()    ← 清空背景
  │
  └─ items.forEach:
       ├─ _getTexture(id)          ← 获取/创建纹理缓存
       ├─ gl.texImage2D(video)     ← 上传视频帧到纹理（UNPACK_FLIP_Y_WEBGL）
       └─ _drawItem(draw, height)  ← gl.viewport → gl.drawArrays
```

**Y 坐标翻转**: WebGL 原点在左下角，canvas 原点在左上角，`viewportY = canvasHeight - draw.y - draw.height`。

**销毁**: 删除所有纹理 + buffer + program，通过 `WEBGL_lose_context` 扩展释放 GPU 上下文。

---

#### [lib/mixer-renderer/WorkerRenderer.js](../lib/mixer-renderer/WorkerRenderer.js) — Worker 线程渲染器

**将渲染卸载到 WebWorker**，通过 `OffscreenCanvas` 避免阻塞主线程。

**架构**（注意：这里 transfer 的是新建的 `OffscreenCanvas`，不是输出 canvas 本身）:
```
WorkerRenderer（主线程）
    │
    ├─ createWorker() → new Worker(Blob URL / 外部脚本)
    │
    ├─ init(canvas)
    │   ├─ 创建新的 OffscreenCanvas，transfer 到 Worker
    │   └─ 主线程 2D context 备用（绘制 Worker 返回的 ImageBitmap）
    │
    ├─ render(payload)
    │   ├─ Worker 忙、未就绪 → 入队列（replace/drop）
    │   ├─ _createWorkerPayload() → createImageBitmap(video) / VideoFrame(video) × N
    │   └─ postMessage({ type: 'render', payload }) + transfer frames
    │
    └─ Worker 回传 rendered → drawImage(bitmap) → 主线程 canvas

Worker 线程（workerScript）
    │
    ├─ init → worker-webgl2 或 worker-2d
    │
    └─ render → 在 OffscreenCanvas 上绘制 → transferToImageBitmap()
```

**关键设计决策**: **不再 transfer 输出 canvas 本身**。`canvas.captureStream()` 始终绑定主线程 canvas，避免部分浏览器无法捕获 Worker 直接绘制结果而出现黑屏。

**帧抽取**: 优先尝试 `createImageBitmap(video)`，失败后回退 `new VideoFrame(video)`。对于 `worker-webgl2` 路径，`createImageBitmap` 会传入 `{ imageOrientation: 'flipY' }` 补偿 WebGL 纹理翻转。

**队列管理**:
- `dropFrameWhenBusy=true`: Worker 忙或正在抽帧时，只保留最新待处理 payload，并增加 droppedFrames（默认行为）
- `dropFrameWhenBusy=false`: 追加到队列，超出 `maxFrameQueue` 时丢弃最早帧
- `maxFrameQueue<=0`: 不排队，直接计为 dropped frame

---

#### [lib/mixer-renderer/workerScript.js](../lib/mixer-renderer/workerScript.js) — Worker 内联脚本生成器

**职责**: 生成自包含的 Worker 渲染脚本源码字符串，通过 Blob URL 创建 Worker，无需额外部署脚本文件。

**Worker 内部行为**（与主线程对应渲染器代码同构）:
- **worker-webgl2**: 在 `OffscreenCanvas` 上获取 `webgl2` context，编译 shader，纹理渲染
- **worker-2d**: 在 `OffscreenCanvas` 上获取 `2d` context，`drawImage()` 绘制

**消息协议**:

| 消息类型 | 方向 | 说明 |
|---------|------|------|
| `init(canvas, requestedMode, ...)` | 主线程 → Worker | 初始化渲染上下文 |
| `ready(actualMode, isWebGL2)` | Worker → 主线程 | 初始化完成 |
| `failed(reason)` | Worker → 主线程 | 初始化失败 |
| `render(payload)` | 主线程 → Worker | 提交一帧布局数据 |
| `rendered(bitmap)` | Worker → 主线程 | 渲染完成，返回 ImageBitmap |
| `renderError(reason)` | Worker → 主线程 | 渲染失败 |
| `removeSource(id)` | 主线程 → Worker | 释放纹理缓存 |
| `destroy()` | 主线程 → Worker | 销毁渲染资源 |

---

#### [lib/mixer-renderer/helpers/gl.js](../lib/mixer-renderer/helpers/gl.js) — WebGL 工具

| 方法 | 功能 |
|------|------|
| `compileShader(gl, type, source)` | 编译 WebGL shader，失败抛出编译日志 |
| `createProgram(gl, vertexShader, fragmentShader)` | 链接 WebGL program，失败抛出链接日志 |
| `createVideoTexture(gl)` | 创建 2D 纹理（CLAMP_TO_EDGE + LINEAR 滤波） |

**MainWebGL2Renderer 直接使用该 helper；Worker 内联脚本不 import 此文件，而是在生成的 worker 源码中包含同构实现。**

---

#### [lib/mixer-renderer/helpers/color.js](../lib/mixer-renderer/helpers/color.js) — CSS 颜色解析

**只 WebGL 渲染路径使用**（Canvas2D 原生支持 CSS 颜色字符串）。

将 CSS 颜色解析为归一化 RGBA 数组：

| 输入格式 | 示例 |
|---------|------|
| `#rgb` | `#fff` → `[1, 1, 1, 1]` |
| `#rrggbb` | `#ff0000` → `[1, 0, 0, 1]` |
| `rgb(r,g,b)` | `rgb(255,0,0)` → `[1, 0, 0, 1]` |
| `rgba(r,g,b,a)` | `rgba(0,0,0,0.5)` → `[0, 0, 0, 0.5]` |

不支持的格式（如 hsl、named colors）回退到纯黑 `[0, 0, 0, 1]`。

---

## 渲染后端选型链路

```
RendererFactory.createRenderer(canvas, config)
    │
    ├─ mode === 'main-2d'
    │   └─ ▶ new MainCanvas2DRenderer() → init(canvas)     ✔
    │
    ├─ mode === 'auto' && Safari/WKWebView
    │   └─ 先尝试 MainWebGL2Renderer
    │         ├─ 同步成功 ✔
    │         └─ 同步失败 → 继续走 auto 的后续 Worker / main fallback 尝试
    │
    ├─ mode === 'auto' && 非 Safari
    │   └─ ▶ new WorkerRenderer() → init(canvas)
    │         ├─ 同步成功 ✔（actualMode 先是 worker-init，ready 后变为 worker-webgl2 或 worker-2d）
    │         └─ 失败 → new MainWebGL2Renderer()
    │               ├─ 成功 ✔
    │               └─ 失败 → new MainCanvas2DRenderer() ✔
    │
    ├─ mode === 'worker-webgl2' / 'worker-2d'
    │   └─ ▶ new WorkerRenderer() → init(canvas)
    │         ├─ 同步成功 ✔（Worker 内部仍可能异步 failed）
    │         └─ 失败 → createMainFallback()
    │               ├─ (非 worker-2d) → MainWebGL2Renderer()
    │               └─ → MainCanvas2DRenderer() ✔
    │
    └─ mode === 'main-webgl2'
        └─ ▶ new MainWebGL2Renderer() → init(canvas)
              ├─ 成功 ✔
              └─ 失败 → new MainCanvas2DRenderer() ✔
```

**运行期降级**（Worker 已创建后异步失败，或渲染连续异常）:
```
WorkerRenderer 故障 × 2
    → destroy 当前 renderer
    → new MainCanvas2DRenderer() → init(canvas)
```

这里的运行期降级只切到 `main-2d`。`main-webgl2` 只参与 RendererFactory 的同步创建失败 fallback，不参与 Worker 运行期失败后的二次尝试。

---

## 跨文件调用链

### 完整的一帧渲染流程

```
[Controller] getVideoStream()
    │
    ├─ [OutputStreamManager] getVideoStream(drawFirstFrame)
    │     ├─ drawFirstFrame()
    │     │   └─ [RenderLoop] resetFrameTiming() + renderFrame(undefined, true)
    │     │
    │     └─ canvas.captureStream(fps) → 提取 video track → 返回新 MediaStream
    │
    └─ 返回视频流（启动 rAF 持续渲染）
          │
          ▼ (每一帧)
[RenderLoop] renderFrame(timestamp)
    │
    ├─ fps 节流检测
    │
    ├─ [AudioMixer] syncExternalSourceAudio()  ← 检测外部换源
    │
    ├─ [LayoutEngine] createRenderPayload()
    │     └─ 遍历 SourceRegistry.sources → 计算网格 → render payload
    │
    ├─ [RendererFactory] ensureRenderer()  (首次创建)
    │     └─ new WorkerRenderer() / MainWebGL2Renderer() / MainCanvas2DRenderer()
    │
    ├─ renderer.render(payload)
    │     │
    │     ├─ MainCanvas2DRenderer:
    │     │   ├─ ctx.fillStyle/ctx.fillRect() → 填背景
    │     │   └─ items.forEach → ctx.drawImage(video, x, y, w, h)
    │     │
    │     ├─ MainWebGL2Renderer:
    │     │   ├─ gl.clearColor/gl.clear() → 清空
    │     │   ├─ items.forEach → gl.texImage2D(video) → gl.viewport → gl.drawArrays
    │     │   └─ gl.flush()
    │     │
    │     └─ WorkerRenderer:
    │         ├─ createImageBitmap(video) / VideoFrame(video) × N
    │         ├─ postMessage({ type:'render', payload }) + transfer
    │         └─ [Worker 内] → OffscreenCanvas 绘制 → transferToImageBitmap()
    │           └─ [主线程] onmessage('rendered') → drawImage(bitmap)
    │
    ├─ _handleRendererInfo()  ← Worker 健康检查
    │
    └─ _scheduleNextFrame()
```

### getMixedStream() 完整流程

```
MixerController.getMixedStream()
  │
  ├─▶ OutputStreamManager.getVideoStream(drawFirstFrame)
  │     ├─ drawFirstFrame() → RenderLoop.resetFrameTiming() + renderFrame(undefined, true)
  │     ├─ canvas.captureStream(fps)
  │     └─ 返回仅含视频轨的 MediaStream
  │
  ├─▶ OutputStreamManager.setMixedStream(videoStream)
  │     └─ 保存引用，供后续音频轨补充
  │
  ├─▶ AudioMixer.getAudioStream()
  │     ├─ 无 live 音频源 → 返回 null
  │     ├─ 有 live 音频源 → _ensureAudioSystem() → new AudioContext()
  │     ├─ _refreshAudioConnections()
  │     │   ├─ SourceRegistry.hasAnyLiveAudioTrack()
  │     │   ├─ _connectSource() → createMediaStreamSource → GainNode → Destination
  │     │   └─ 返回 audioDestination.stream
  │     └─ 返回仅含音频轨的 MediaStream
  │
  └─▶ OutputStreamManager.addAudioTracksToStream(videoStream, audioStream)
        └─ 将音频轨去重添加到视频流
```

### appendStream() 完整流程

```
MixerController.appendStream(videos, options)
  │
  ├─ MixerConfig.normalizeSourceOptions(options, index)
  │
  ├─▶ SourceRegistry.add(video, sourceOptions)
  │     ├─ _createSource() → MixerDomAdapter.createVideoElement()
  │     ├─ slot 冲突检测 → 冲突则 remove(oldSource)
  │     │     ├─ AudioMixer.disconnectSource()  (onBeforeRemove)
  │     │     └─ RenderLoop.removeSource()       (onAfterRemove)
  │     └─ push → _syncVideos()
  │
  ├─▶ AudioMixer.scheduleRefresh()（如果音频已请求或 AudioContext 已初始化）
  │     └─ _refreshAudioConnections() → 为新源建立 WebAudio 管线
  │         └─ onAudioTrackAvailable → OutputStreamManager.ensureMixedStreamAudioTrack()
  │
  └─▶ RenderLoop.start()
        └─ _scheduleNextFrame() → requestAnimationFrame
```

### stop() 完整流程

```
MixerController.stop()
  │
  ├─ (设置 _destroyed = true)
  │
  ├─▶ RenderLoop.stop()
  │     └─ cancelAnimationFrame + _stopped = true
  │
  ├─▶ clearStreams()
  │     └─ 遍历 SourceRegistry.remove()
  │         ├─ AudioMixer.disconnectSource() → 断开 WebAudio
  │         ├─ video.pause() + srcObject=null + remove()（仅 ownedVideo）
  │         └─ RenderLoop.removeSource(source.id)
  │               └─ renderer.removeSource(id) → 释放 GPU 纹理
  │
  ├─▶ AudioMixer.stop()
  │     ├─ audioDestination.disconnect()
  │     └─ audioContext.close()
  │
  ├─▶ RenderLoop.destroy()
  │     ├─ stop()
  │     └─ renderer.destroy()
  │           ├─ MainCanvas2DRenderer: clearRect + 清空 context 引用
  │           ├─ MainWebGL2Renderer: 删除纹理/buffer/program + loseContext
  │           └─ WorkerRenderer: terminate Worker + revoke Blob URL
  │
  └─▶ OutputStreamManager.stop()
        ├─ 清空引用
        ├─ 遍历所有 capturedStreams → track.stop()
        └─ canvas.stream = null
```

---

## 分层依赖图

```
lib/Mixer.js (barrel)
    │
    └─ lib/mixer-core/MixerController.js (中枢控制器)
          │
          ├──▶ MixerConfig                     (纯函数, 无依赖)
          ├──▶ MixerDomAdapter                 (DOM, 无依赖)
          │
          ├──▶ SourceRegistry                  ──依赖──▶ MixerDomAdapter.createVideoElement()
          │                                              MixerConfig (gain/slot 归一化)
          │                                              MixerController (onBefore/AfterRemove)
          │
          ├──▶ AudioMixer                      ──依赖──▶ SourceRegistry (源遍历)
          │                                              MixerController (getDestroyed/回调)
          │
          ├──▶ LayoutEngine                    ──依赖──▶ SourceRegistry (源列表)
          │                                              MixerController (prepare/resize 回调)
          │
          ├──▶ RenderLoop                      ──依赖──▶ RendererFactory
          │                                              LayoutEngine (createRenderPayload)
          │                                              AudioMixer (syncExternalSourceAudio)
          │
          └──▶ OutputStreamManager             ──依赖──▶ (无, 仅接收 canvas + config)
                                     
  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  
lib/mixer-renderer/
    │
    ├──▶ RendererFactory                       ──依赖──▶ MainCanvas2DRenderer
    │                                              ├──▶ MainWebGL2Renderer
    │                                              └──▶ WorkerRenderer
    │
    ├──▶ BaseRenderer                          (基类, 无依赖)
    │
    ├──▶ MainCanvas2DRenderer                  ──extends── BaseRenderer
    │
    ├──▶ MainWebGL2Renderer                    ──extends── BaseRenderer
    │                                              ──依赖──▶ gl.js
    │                                              ──依赖──▶ color.js
    │
    ├──▶ WorkerRenderer                        ──extends── BaseRenderer
    │                                              ──依赖──▶ workerScript.js
    │
    └─── workerScript.js                       (无依赖, 自包含字符串)
         helpers/
         ├── gl.js                             (无依赖)
         └── color.js                          (无依赖)
```

---

## 设计模式总结

| 模式 | 使用位置 | 说明 |
|------|---------|------|
| **Mediator（中介者）** | MixerController | 协调 SourceRegistry, AudioMixer, RenderLoop, OutputStreamManager, LayoutEngine 之间的交互 |
| **Strategy（策略）** | RendererFactory | 可切换多种渲染后端（main-2d / main-webgl2 / worker-*） |
| **Template Method（模板方法）** | BaseRenderer | 定义 `init() → render() → destroy()` 标准接口，子类各自实现 |
| **Observer（观察者）** | SourceRegistry 回调链 | onBeforeRemove → 断音频, onAfterRemove → 清理渲染器 |
| **Adapter（适配器）** | MixerDomAdapter | 将 DOM 创建操作统一封装，便于测试和未来迁移 |
| **Value Object（值对象）** | MixerConfig | 纯函数归一化配置参数，无副作用 |
| **Registry（注册表）** | SourceRegistry | 统一管理源对象的增删查 |
| **Dependency Injection（依赖注入）** | 所有模块的 constructor | 每个模块通过构造参数接收依赖 |
| **Queue + Drop（队列+丢帧）** | WorkerRenderer | Worker 忙时基于 `dropFrameWhenBusy` 策略丢帧 |

---

## 注意事项

1. **不可重用**: `stop()` 后 `_destroyed = true`，必须 `new Mixer()` 创建新实例。
2. **Canvas Context 抢占**: canvas 同一时间只能有一个 context（2D 或 WebGL2），RendererFactory 是唯一允许初始化 canvas context 的地方。
3. **Worker 输出 canvas 不 transfer**: WorkerRenderer 不将输出 canvas transfer 到 Worker，而是主线程持有 canvas，Worker 返回 ImageBitmap 后通过 `drawImage()` 写入。这是为了确保 `captureStream()` 始终绑定主线程 canvas，避免部分浏览器黑屏。
4. **AudioContext 延迟创建**: 符合浏览器 autoplay 政策，需用户交互后才能恢复。
5. **Worker 故障降级**: 连续 2 次错误触发自动降级到 `MainCanvas2DRenderer`。
6. **去重保护**: 多处通过 `track.id` 进行去重（音频轨注入、WebAudio 连接）。
7. **fps 节流**: 不调整 rAF 间隔，在 rAF 回调内按时间戳跳过未到间隔的帧。
8. **WebGL Y 坐标**: 主线程和 Worker 的 WebGL 路径都通过 `UNPACK_FLIP_Y_WEBGL` 翻转纹理，确保视频方向正确。
9. **color.js 仅 WebGL 使用**: Canvas2D 原生支持 CSS 颜色字符串，`color.js` 只服务于 WebGL 的 `gl.clearColor()`。
