# MediaStreamMixer — 混流器模块

将多路 `MediaStream` / `HTMLMediaElement` 合并为单路音视频输出流。
视频使用 Canvas 合成（支持 WebGL2 / Canvas2D 多后端）；音频通过 WebAudio API 混音。

**入口**: [lib/Mixer.js](../lib/Mixer.js)（barrel 文件，重定向到 MixerController）  
**核心**: [lib/mixer-core/MixerController.js](../lib/mixer-core/MixerController.js)  
**导出**: `class MediaStreamMixer`

---

## 目录

1. [模块结构](#1-模块结构)
2. [核心概念](#2-核心概念)
3. [mixer-core — 核心子模块](#3-mixer-core--核心子模块)
4. [mixer-renderer — 渲染后端](#4-mixer-renderer--渲染后端)
5. [渲染模式选择与降级链](#5-渲染模式选择与降级链)
6. [配置与构造](#6-配置与构造)
7. [API 速查](#7-api-速查)
8. [生命周期](#8-生命周期)
9. [内部调用时序](#9-内部调用时序)

---

## 1. 模块结构

MediaStreamMixer 分为两个子模块：

```
lib/
├── Mixer.js                               # 入口（重定向到 MixerController）
├── mixer-core/                             # 核心逻辑：源管理、布局、音频、输出
│   ├── MixerController.js                  # 主控制器，调解者模式协调各子模块
│   ├── SourceRegistry.js                   # 输入源注册表
│   ├── LayoutEngine.js                     # 网格布局计算引擎
│   ├── AudioMixer.js                       # WebAudio 混音模块
│   ├── OutputStreamManager.js              # 输出流生命周期管理
│   ├── RenderLoop.js                       # 帧循环与渲染后端调度
│   ├── MixerConfig.js                      # 配置归一化（纯函数）
│   └── MixerDomAdapter.js                  # DOM 元素创建适配器
├── mixer-renderer/                         # 渲染后端：多种绘制实现
│   ├── RendererFactory.js                  # 渲染器工厂，按 mode 自动选择
│   ├── BaseRenderer.js                     # 渲染器基类
│   ├── MainCanvas2DRenderer.js             # 主线程 Canvas2D（兜底路径）
│   ├── MainWebGL2Renderer.js               # 主线程 WebGL2（GPU 加速）
│   ├── WorkerRenderer.js                   # Worker 线程渲染器
│   ├── workerScript.js                     # Blob Worker 内联脚本生成
│   └── helpers/
│       ├── gl.js                           # WebGL shader 编译/链接着
│       └── color.js                        # CSS 颜色解析（WebGL clearColor）
```

**mixer-core** 负责业务逻辑：源管理、布局计算、音频混音、输出流管理。  
**mixer-renderer** 负责将布局数据绘制到 Canvas，提供多种渲染后端并支持自动降级。

### 职责边界

| 子模块 | 职责 |
|--------|------|
| `SourceRegistry` | 源的增删、ID 生成、slot 分配、状态查询 |
| `LayoutEngine` | 按 slot 计算每路视频的绘制矩形 |
| `AudioMixer` | 延迟创建 AudioContext，每路独立 GainNode，WebAudio 混音 |
| `OutputStreamManager` | `canvas.captureStream()`、音频轨注入、停止清理 |
| `RenderLoop` | rAF 帧循环、fps 节流、调用渲染器绘制 |
| `MixerConfig` | 参数校验、归一化、默认值填充（纯函数） |
| `MixerDomAdapter` | 创建隐藏 canvas/video 元素 |
| `RendererFactory` | 按 renderMode 创建合适的渲染器实例 |
| `BaseRenderer` | 渲染器接口定义 + 公共 info 管理 |
| `MainCanvas2DRenderer` | 主线程 `CanvasRenderingContext2D.drawImage()` |
| `MainWebGL2Renderer` | 主线程 WebGL2，每源一个纹理，shader 合成 |
| `WorkerRenderer` | Worker 内 OffscreenCanvas 渲染，结果传回主线程写入输出 canvas |
| `workerScript` | 生成自包含的 Worker JS 源码（WebGL2 + Canvas2D 双模式） |

**状态委派**: MixerController 不持有子模块状态的副本。19 个旧私有属性（`_sources`、`_renderer`、`_audioContext` 等）通过 `Object.defineProperty` 只读 getter 直接委派到子模块，无需手动同步。

---

## 2. 核心概念

### 2.1 布局方式

固定输出分辨率（默认 1280x720），输入源按 slot 在网格中定位。画布尺寸不随源数量动态变化。

### 2.2 数据流路径

```
MediaStream / HTMLVideoElement
    │
    ├──► SourceRegistry.add() ──► sources[]
    │                                 │
    ├──► video (HTMLVideoElement) ──► RenderLoop.renderFrame()
    │                                     │
    │                              LayoutEngine.createRenderPayload()
    │                                     │
    │                              renderer.render(payload) → canvas
    │                                     │
    │                              OutputStreamManager.getVideoStream()
    │                                     │
    │                              canvas.captureStream() → videoStream
    │
    ├──► AudioMixer._connectSource()
    │       createMediaStreamSource() → GainNode → destination
    │
    └──► OutputStreamManager.addAudioTracksToStream()
            videoStream + audioStream.tracks → 最终输出 MediaStream
```

### 2.3 渲染 payload 结构

`LayoutEngine.createRenderPayload()` 返回的数据结构，供渲染器消费：

```js
{
  width: 1280,              // 画布宽
  height: 720,              // 画布高
  backgroundColor: '#000',  // 背景色
  items: [
    {
      id: 'source-1',
      video: HTMLVideoElement,  // 实际的 video 元素引用（或 Worker 路径中的 VideoFrame/ImageBitmap）
      draw: {
        x: 0, y: 0,
        width: 640, height: 720
      }
    },
    // ...
  ],
  sourceWatermarks: [
    { id: 'slot0', image: HTMLCanvasElement, opacity: 0.9, draw: { x, y, width, height } }
  ],
  outputWatermarks: [
    { id: 'brand', image: HTMLCanvasElement, opacity: 0.85, draw: { x, y, width, height } }
  ]
}
```

渲染器只需遍历 `items`，按 `draw` 矩形绘制每个 `video`，铺满背景色即可。这样渲染器与业务逻辑完全解耦。
水印绘制顺序固定为：背景色 → 视频源 → 每路源水印 → 全局输出水印。

---

## 3. mixer-core — 核心子模块

### 3.1 MixerController（主控制器）

调解者模式，串联所有子模块。主要流程：

```
new MixerController(videos, options)
  → MixerConfig.create(options)         // 1. 归一化配置
  → new MixerDomAdapter()               // 2. 创建隐藏 canvas
  → new SourceRegistry()                // 3. 创建各子模块
  → new OutputStreamManager(canvas)
  → new RenderLoop(canvas, config)
  → new AudioMixer(config)
  → new LayoutEngine(config)
  → appendStream(videos)                // 4. 加入初始源
```

公开 API 均为委托调用：`appendStream` → `SourceRegistry.add()` + `RenderLoop.resume()`，`stop()` → 逐个销毁子模块。

### 3.2 SourceRegistry（源注册表）

管理所有输入源，核心数据结构：

```js
{
  id:              string,    // 优先 MediaStream.id（冲突追加 -1 -2 后缀）
  stream:          MediaStream,
  video:           HTMLVideoElement, // 播放输入视频的 <video>
  slot:            number,    // 网格位置
  gain:            number,           // 音频增益
  audioSourceNode: MediaStreamAudioSourceNode | null,  // 由 AudioMixer 连接
  gainNode:        GainNode | null,
  audioStream:     MediaStream | null,
  ownedVideo:      boolean  // true=mixer 创建的隐藏 video，false=外部传入
}
```

**Slot 分配规则**：
- 指定 slot → 放入目标位置，同 slot 旧源被覆盖
- 未指定 slot → 从 0 开始自增分配最小编号空位
- 批量添加时 slot 在数组内递增

### 3.3 LayoutEngine（布局引擎）

计算每路视频的绘制矩形（`{ x, y, width, height }`），cover 等比缩放。

网格布局规则：

| 源数 | 网格 |
|------|------|
| 1 | 1×1 |
| 2 | 按画布横竖比 2×1 或 1×2 |
| 3-4 | 2×2 |
| 5-6 | 按比例 3×2 或 2×3 |
| 7-9 | 3×3 |
| 10+ | `ceil(sqrt(n)) × ceil(n/cols)` |

等比缩放实现 `_scaleVideo()`：按目标区域等比缩放，超出部分裁剪，居中显示（cover 效果）。

### 3.4 AudioMixer（音频混音）

```
MediaStream → createMediaStreamSource() → GainNode ─┐
                                                     │
所有源汇总 ──────────────────────────────────────────┤
                                                     ▼
                              MediaStreamAudioDestinationNode
                                      │
                                      ▼
                              destination.stream
```

关键行为：
- **延迟初始化**: `AudioContext` 只在已请求音频且存在 live 音频轨时创建
- **自动恢复**: `AudioContext` 处于 `suspended` 时自动 `resume()`
- **换源检测**: 每帧渲染前 `syncExternalSourceAudio()` 检测 HTMLVideoElement 的 `srcObject` 变化
- **异步刷新**: `scheduleRefresh()` 用于不能 await 的路径，pending 标记确保不丢失刷新请求
- **音量独立**: 每路独立 `GainNode`，`appendStream` 时可指定 `gain`

### 3.5 OutputStreamManager（输出流管理）

- `getVideoStream()`: 调用 `canvas.captureStream(fps)` 获取视频轨
- `addAudioTracksToStream()`: 将音频流的音轨注入到视频流中，去重
- `stop()`: 停止所有输出 track

音频延迟注入：`getMixedStream()` 返回后通过 `appendStream()` 添加有音频的源时，自动将新音频轨补充到已返回的流。

### 3.6 RenderLoop（帧循环）

帧循环流程：

```
requestAnimationFrame
    │
    ▼
RenderLoop.renderFrame(timestamp)
    │
    ├── fps 节流：未到目标间隔时跳过
    ├── 同步外部音频源（换源检测）
    ├── LayoutEngine.createRenderPayload()
    ├── renderer.render(payload) → 绘制到 canvas
    ├── 检查 Worker 健康：连续失败 2 次 → 降级
    └── _scheduleNextFrame()
```

- 有源时持续渲染，无源时渲染一帧背景色后暂停
- 新源加入时自动恢复

### 3.7 MixerConfig（配置归一化）

纯函数工具，提供 `MixerConfig.create(options)`：参数校验和默认值填充。

### 3.8 MixerDomAdapter（DOM 适配器）

创建隐藏的 `<canvas>` 和 `<video>` 元素，统一管理 DOM 副作用，方便测试替换。

---

## 4. mixer-renderer — 渲染后端

渲染后端负责把 `LayoutEngine` 计算的 payload 实际绘制到 Canvas。支持主线程和 Worker 两种执行环境，Canvas2D 和 WebGL2 两种绘制 API。

### 4.1 BaseRenderer（基类）

接口定义，所有渲染器继承自它：

| 方法 | 说明 |
|------|------|
| `init(canvas)` | 初始化上下文，返回 `true` 或抛异常 |
| `render(payload)` | 绘制一帧 |
| `resize(w, h)` | 更新画布尺寸 |
| `removeSource(id)` | 释放特定源的 GPU 资源 |
| `destroy()` | 销毁所有资源 |
| `getInfo()` | 返回运行时信息快照 |

### 4.2 MainCanvas2DRenderer（主线程 Canvas2D）

最稳定、最基础的渲染路径。所有其他路径失败时的最终兜底。

- **绘制方式**: `CanvasRenderingContext2D.drawImage()`
- **context 创建**: `canvas.getContext('2d', { alpha: false })`
- **每帧流程**: 填充背景色 → 遍历 items → `drawImage(video, x, y, w, h)`
- **特点**: 简单可靠，性能依赖浏览器 Canvas2D 实现，适合少量源和低分辨率场景

### 4.3 MainWebGL2Renderer（主线程 WebGL2）

GPU 加速渲染，适合 Safari/WKWebView 等 Worker 支持不完善的浏览器。

- **绘制方式**: WebGL2 纹理 + shader 合成
- **GLSL**: 顶点 shader 传位置和纹理坐标，片元 shader 采样 `u_texture`
- **每源一个纹理**: `_textures[id]` 缓存，`texImage2D` 上传视频帧
- **坐标翻转**: `UNPACK_FLIP_Y_WEBGL = true`（HTML video 原点左上角 → WebGL 原点左下角）
- **viewport 裁剪**: 每个 item 独立 `gl.viewport`，用 `TRIANGLE_STRIP` 绘制全屏四边形后裁剪到对应区域
- **销毁时**: 删除所有纹理和 buffer，调用 `WEBGL_lose_context` 扩展释放 GPU 资源

**适用场景**: Safari/WKWebView 中 Worker WebGL2 不稳定但主线程 WebGL2 可用时，作为 Worker 失败后的降级。

### 4.4 WorkerRenderer（Worker 线程渲染器）

WebWorker + OffscreenCanvas，不阻塞主线程。

**架构**:

```
主线程                              Worker 线程
──────                              ──────────
WorkerRenderer.init()
  → new OffscreenCanvas()
  → postMessage({ type: 'init' }) ───► Worker 内创建 WebGL2 / Canvas2D 上下文
  → 等待 'ready' 消息 ◄────────────── postMessage({ type: 'ready', actualMode })

WorkerRenderer.render(payload)
  → _createWorkerPayload()          每帧
  │   ├── createImageBitmap(video)  或
  │   └── new VideoFrame(video)     ← 从 video 元素抽取帧
  → postMessage({ type: 'render' }) ───► Worker 内绘制到 OffscreenCanvas
  → 等待 'rendered' 消息 ◄────────────── transferToImageBitmap()
  ↓                                     postMessage({ type: 'rendered', bitmap })
  _outputContext.drawImage(bitmap)
  → 写入主线程输出 canvas
  → canvas.captureStream() 可捕获
```

**帧抽取策略**: `_createFrame()` 自动探测最优 API：
1. 优先 `createImageBitmap(video)`（广泛支持）
2. 回退 `new VideoFrame(video)`（部分浏览器）
- WebGL2 Worker 路径下 `imageOrientation: 'flipY'` 补偿纹理坐标翻转

**帧队列控制**:
- `dropFrameWhenBusy: true`（默认）→ Worker 忙时丢弃中间帧，只保留最新
- `dropFrameWhenBusy: false` → 队列积累，最多 `maxFrameQueue` 帧
- Worker 就绪后自动消费队列（`_flushQueuedPayload`）

**关键设计决策**: 不再 transfer 输出 canvas 本身。主线程 canvas 始终用于 `captureStream()`，Worker 只传回 `ImageBitmap`，避免部分浏览器黑屏问题。

### 4.5 workerScript（Worker 内联脚本）

`workerScript.createWorkerScript()` 返回自包含的 Worker JS 源码（字符串）。

Worker 内部逻辑：
- **初始化**: 接收 `OffscreenCanvas`，按 `requestedMode` 尝试 `initWebGL2()` → 失败则 `initCanvas2D()`
- **渲染**: 根据 `actualMode` 走 `renderWebGL2()` 或 `renderCanvas2D()`
- **输出**: `canvas.transferToImageBitmap()` 传回主线程
- **消息协议**: `init` / `render` / `removeSource` / `destroy` 四种消息类型

默认通过 Blob URL 加载；可通过 `options.workerUrl` 指定外部脚本以绕过 CSP 限制。

### 4.6 helpers

| 文件 | 内容 |
|------|------|
| `gl.js` | `compileShader()` 编译 GLSL → `WebGLShader`；`createProgram()` 链接 → `WebGLProgram`；`createVideoTexture()` 创建纹理 |
| `color.js` | `parseColor()` 将 CSS 颜色（`#rgb`、`#rrggbb`、`rgb()`、`rgba()`）解析为 `[r, g, b, a]` 数组，用于 WebGL `clearColor` |

---

## 5. 渲染模式选择与降级链

```
renderMode: 'auto'（默认）
    │
    ├── Safari/WKWebView 检测 ──true──► main-webgl2 (作为初始选择)
    │
    ├── 尝试 worker-webgl2
    │   ├── 成功 → worker-webgl2 ✓
    │   └── 失败 → 尝试 main-webgl2
    │       ├── 成功 → main-webgl2 (降级)
    │       └── 失败 → 尝试 worker-2d
    │           ├── 成功 → worker-2d (降级)
    │           └── 失败 → main-2d (兜底)
    │
    └── Worker 运行时连续失败 2 次 → RenderLoop 触发降级到 main-2d

显式模式:
  worker-webgl2 → worker 初始化失败 → main-webgl2 → main-2d
  worker-2d     → worker 初始化失败 → main-2d
  main-webgl2   → 初始化失败 → main-2d
  main-2d       → 直接使用（无降级）
```

| mode | 执行环境 | 绘制 API | 适用场景 |
|------|----------|----------|----------|
| `auto` | 自动选择 | 自动 | 绝大多数情况 |
| `worker-webgl2` | Worker | WebGL2 | 高性能，首选 |
| `worker-2d` | Worker | Canvas2D | Worker 环境但 WebGL2 不可用 |
| `main-webgl2` | 主线程 | WebGL2 | Safari / 特殊环境 |
| `main-2d` | 主线程 | Canvas2D | 兼容性兜底 |

Safari/WKWebView 特殊处理：Worker + WebGL2 在这些浏览器上不稳定或不可用，因此在 `auto` 模式下检测到 Safari 时直接走 `main-webgl2` 路径，避免 Worker 初始化失败的开销。

---

## 6. 配置与构造

### new MediaStreamMixer(videos, options)

```js
const mixer = new MediaStreamMixer([
  localStream,
  remoteStream
], {
  width: 1280,
  height: 720,
  fps: 15,
  backgroundColor: '#000',
  audioGain: 0.8,
  renderMode: 'auto'
});
```

**videos**: `MediaStream | HTMLMediaElement | Array<...>`
- 支持数组、单个对象、SDK 包装对象 `{ mediaStream }`
- HTMLMediaElement 需使用 `srcObject = MediaStream`

**options**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `width/height` | `number` | 1280x720 | 输出分辨率 |
| `fps` | `number` | 15 | 输出帧率 |
| `backgroundColor` | `string` | `'#000'` | 画布底色 |
| `audioGain` | `number` | 0.8 | 全局默认音量 |
| `renderMode` | `string` | `'auto'` | 渲染后端选择 |
| `workerUrl` | `string` | 使用 Blob Worker | 外部 Worker 脚本地址 |
| `dropFrameWhenBusy` | `boolean` | `true` | Worker 忙时丢帧 |
| `maxFrameQueue` | `number` | 1 | 帧队列最大长度 |
| `watermarks` | `Array<Object>` | `[]` | 初始水印配置，支持文字和图片 |

### 水印配置

```js
const mixer = new CRTC.Mixer([], {
  width: 1280,
  height: 720,
  watermarks: [
    { id: 'brand', target: 'output', type: 'text', text: 'CRTC', position: 'bottom-right' },
    { id: 'slot0-name', target: 'source', slot: 0, type: 'text', text: 'Host', position: 'bottom-left' },
    { id: 'notice', target: 'output', type: 'text', text: 'LIVE', position: 'top-center' },
    { id: 'custom-logo', target: 'output', type: 'image', image: logoImage, position: { x: 24, y: 24 } }
  ]
});
```

字段说明：

| 字段 | 说明 |
|------|------|
| `target` | `'output'` 全局输出水印，或 `'source'` 每路源水印；默认 `'output'` |
| `type` | `'text'` 或 `'image'`；传 `image` 时自动按图片处理 |
| `text` | 文字水印内容 |
| `image` | 图片 URL、`HTMLImageElement`、`HTMLCanvasElement`、`ImageBitmap` |
| `slot/sourceId/streamId` | source 水印匹配条件，优先级 `sourceId > streamId > slot` |
| `position` | 预设位置，或 `{ x, y }` 坐标；默认 `'bottom-right'`。预设支持 `'top-left'`、`'top-center'`、`'top-right'`、`'center'`、`'bottom-left'`、`'bottom-center'`、`'bottom-right'`；坐标相对目标区域左上角，全局水印相对输出画布，source 水印相对该源绘制区域 |
| `width/height/font/fontSize/color/backgroundColor/opacity/padding/margin` | 水印尺寸和样式，非法值回退默认值 |

### 初始化步骤

1. `MixerConfig.create(options)` 归一化配置
2. 创建 `MixerDomAdapter` + 离屏 canvas
3. `RendererFactory.createRenderer(canvas, config)` 创建渲染器实例
4. 创建子模块：`SourceRegistry` → `OutputStreamManager` → `RenderLoop` → `AudioMixer` → `LayoutEngine`
5. 预置 canvas 尺寸
6. `appendStream(videos)` 将初始源加入混流
7. 音频系统延迟创建，直到 `getAudioStream()` 才初始化

---

## 7. API 速查

### MixerController 公开 API

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `appendStream(videos, optionsOrSlot?)` | `MediaStream/HTMLVideoElement/Array`, `number/Object` | `boolean` | 添加输入源，同 slot 覆盖 |
| `removeStream(streamOrId)` | `MediaStream/string` | `boolean` | 移除指定源 |
| `clearStreams()` | — | — | 移除所有源 |
| `getSources()` | — | `Array<Object>` | 源信息快照：`{ id, streamId, slot, gain, hasAudio, hasVideo }` |
| `getRenderInfo()` | — | `Object` | 渲染后端状态：`{ requestedMode, actualMode, isWorker, isWebGL2, isFallback, renderedFrames, droppedFrames, fps }` |
| `getAudioInfo()` | — | `Object` | 音频系统状态：`{ status, contextState, sourceCount, liveSourceCount, connectedSources }` |
| `setWatermarks(watermarks)` | `Array/Object/null` | `Promise<Array<Object>>` | 替换全部水印，图片 URL 异步加载 |
| `clearWatermarks(filter?)` | `Object` | — | 清除全部或按 `{ id, target, slot, sourceId, streamId }` 清除 |
| `getWatermarks()` | — | `Array<Object>` | 返回水印只读快照，包含 `status/reason` |
| `getMixedStream()` | — | `Promise<MediaStream>` | 完整音视频混合流 |
| `getVideoStream()` | — | `MediaStream` | 仅视频轨 |
| `getAudioStream(options?)` | `undefined` 或 `{ slots:number[] }` | `Promise<MediaStream\|null>` | 仅音频轨；传 `slots` 时返回指定槽位子混音 |
| `stop()` | — | — | 释放所有资源，实例不再可用 |

`getAudioStream()` 始终返回纯音频 `MediaStream`，不会为了播放兼容性额外添加视频轨。移动端本地监听时建议在用户点击事件中创建/绑定 `<audio controls playsinline>` 并立即调用 `play()`，如果浏览器拦截自动播放，可保留原生控制条让用户再次点击播放。

---

## 8. 生命周期

```
new MediaStreamMixer()
    ├── appendStream() → 可多次调用
    │
    ├── getMixedStream() / getVideoStream()
    │       └── rAF 循环启动
    │             ├── 有源 → 持续渲染
    │             ├── 无源 → 一帧背景色后暂停
    │             └── 新源加入 → 自动恢复
    │
    └── stop()
            ├── RenderLoop.stop() — cancelAnimationFrame
            ├── clearStreams() — 移除所有源
            ├── AudioMixer.stop() — 关闭 AudioContext
            ├── RenderLoop.destroy() — 销毁渲染器
            ├── OutputStreamManager.stop() — 停止所有 tracks
            └── _destroyed = true
```

**`stop()` 后**: 同一实例不再可用，需 `new MediaStreamMixer()`。

---

## 9. 内部调用时序

```
调用方                              MixerController
  │                                      │
  │  new Mixer([streamA])                │
  │ ──────────────────────────────────►  │
  │                                      ├── MixerConfig.create(options)
  │                                      ├── RendererFactory.createRenderer(canvas, config)
  │                                      │   └── 选择并初始化最佳渲染后端
  │                                      ├── 创建子模块
  │                                      ├── 预置 canvas 尺寸
  │                                      └── appendStream([streamA])
  │                                           └── SourceRegistry.add(streamA)
  │                                               ├── _createSource() → ID + video 元素
  │                                               └── slot 冲突检测
  │
  │  appendStream(streamB, 5)
  │ ──────────────────────────────────►  │
  │                                      └── SourceRegistry.add(streamB, { slot: 5 })
  │
  │  await getMixedStream()
  │ ──────────────────────────────────►  │
  │                                      ├── OutputStreamManager.getVideoStream()
  │                                      │   ├── drawFirstFrame()
  │                                      │   │   ├── LayoutEngine.createRenderPayload()
  │                                      │   │   └── renderer.render(payload)
  │                                      │   └── canvas.captureStream() → videoStream
  │                                      │
  │                                      ├── setMixedStream(videoStream)
  │                                      │
  │                                      ├── AudioMixer._refreshAudioConnections()
  │                                      │   ├── _ensureAudioSystem() → new AudioContext()
  │                                      │   └── _connectSource() → 遍历所有源
  │                                      │
  │                                      └── addAudioTracksToStream(videoStream, audioStream)
  │
  │  stop()
  │ ──────────────────────────────────►  │
  │                                      ├── RenderLoop.stop()
  │                                      ├── clearStreams()
  │                                      ├── AudioMixer.stop()
  │                                      ├── RenderLoop.destroy()
  │                                      └── OutputStreamManager.stop()
```

---

## 相关文档

各子模块源码含详细注释：
- **mixer-core**: [SourceRegistry.js](../lib/mixer-core/SourceRegistry.js)、[LayoutEngine.js](../lib/mixer-core/LayoutEngine.js)、[AudioMixer.js](../lib/mixer-core/AudioMixer.js)、[OutputStreamManager.js](../lib/mixer-core/OutputStreamManager.js)、[RenderLoop.js](../lib/mixer-core/RenderLoop.js)、[MixerConfig.js](../lib/mixer-core/MixerConfig.js)
- **mixer-renderer**: [RendererFactory.js](../lib/mixer-renderer/RendererFactory.js)、[MainCanvas2DRenderer.js](../lib/mixer-renderer/MainCanvas2DRenderer.js)、[MainWebGL2Renderer.js](../lib/mixer-renderer/MainWebGL2Renderer.js)、[WorkerRenderer.js](../lib/mixer-renderer/WorkerRenderer.js)
