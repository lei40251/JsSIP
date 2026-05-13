# MediaStreamMixer — 混流器模块

**入口**: [lib/Mixer.js](../lib/Mixer.js)（barrel 文件，重定向到 MixerController）
**核心**: [lib/mixer-core/MixerController.js](../lib/mixer-core/MixerController.js)
**导出**: `class MediaStreamMixer`

> 将多路 `MediaStream` / `HTMLMediaElement` 合并为单路音视频输出流。
> 视频使用 Canvas 合成，支持 WebGL2 / Canvas2D / Worker 多后端；音频用 WebAudio API 混音。

---

## 目录

1. [模块结构](#1-模块结构)
2. [核心概念](#2-核心概念)
3. [构造与配置](#3-构造与配置)
4. [输入源管理](#4-输入源管理)
5. [视频混流](#5-视频混流)
6. [音频混流](#6-音频混流)
7. [输出流获取](#7-输出流获取)
8. [生命周期](#8-生命周期)
9. [内部调用时序](#9-内部调用时序)
10. [方法速查](#10-方法速查)

---

## 1. 模块结构

MediaStreamMixer 采用**调解者模式**，核心类 `MixerController` 作为调解者协调各子模块：

```
lib/
├── Mixer.js                           # 入口（重定向到 MixerController）
└── mixer-core/
    ├── MixerController.js             # 主控制器，协调所有子模块
    ├── SourceRegistry.js              # 输入源注册表
    ├── LayoutEngine.js                # 视频布局计算引擎
    ├── AudioMixer.js                  # WebAudio 混音模块
    ├── OutputStreamManager.js         # 输出流生命周期管理
    ├── RenderLoop.js                  # 帧循环与渲染后端管理
    ├── MixerConfig.js                 # 配置归一化工具（纯函数）
    └── MixerDomAdapter.js             # DOM 元素创建适配器
```

**职责边界**:

| 子模块 | 职责 |
|--------|------|
| `SourceRegistry` | 源的增删、ID 生成、slot 分配、状态查询 |
| `LayoutEngine` | 按布局模式和 slot 计算每路视频的绘制矩形 |
| `AudioMixer` | 延迟创建 AudioContext，每路独立 GainNode，WebAudio 混音 |
| `OutputStreamManager` | canvas.captureStream()、音频轨注入、停止清理 |
| `RenderLoop` | rAF 帧循环、fps 节流、渲染器创建/故障降级 |
| `MixerConfig` | 参数校验、归一化、默认值填充（纯函数） |
| `MixerDomAdapter` | 创建隐藏 canvas/video 元素 |

**状态委派**: MixerController 不持有子模块状态的副本。19 个旧私有属性（`_sources`、`_renderer`、`_audioContext` 等）通过 `Object.defineProperty` 只读 getter 直接委派到子模块，无需手动同步。

---

## 2. 核心概念

### 两种布局模式

| 模式 | 触发条件 | 行为 |
|------|----------|------|
| `legacy` | 不传 `options` 或 options 无任何混流配置项 | 固定 640x480 单元格，最多 2×2 宫格。画布尺寸随源数量动态变化 |
| `grid` | 传了 `options`（任意配置项）或调用 `appendStream(stream, slot)` 时隐式升级 | 固定输出分辨率（默认 1280x720），输入视频按 slot 在网格中定位 |

### 数据流路径

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

### 渲染后端

按 `renderMode` 配置自动选择：

- `auto`：优先 Worker WebGL2 → Worker Canvas2D → 主线程 WebGL2 → 主线程 Canvas2D
- `worker-webgl2` / `worker-2d`：Worker 线程（OffscreenCanvas），不阻塞主线程
- `main-webgl2` / `main-2d`：主线程渲染

运行时 Worker 渲染器连续失败 2 次后自动降级到 `main-2d`。

---

## 3. 构造与配置

### `new MediaStreamMixer(videos, options)`

```js
const mixer = new MediaStreamMixer([
  localStream,
  remoteStream
], {
  width: 1280,
  height: 720,
  fps: 30,
  backgroundColor: '#000',
  audioGain: 0.8,
  layoutMode: 'grid',   // 'grid' | 'legacy'
  renderMode: 'auto'     // 渲染后端选择
});
```

**参数**:

- `videos`: `MediaStream | HTMLMediaElement | Array<...>` — 输入源。
  支持数组、单个对象、SDK 包装对象 `{ mediaStream }`；
  `HTMLMediaElement` 需使用 `srcObject=MediaStream`。

- `options`:
  - `width` / `height` — 输出分辨率（grid 模式默认 1280x720，legacy 模式动态）
  - `fps` — 输出帧率（不传则浏览器自动选择）
  - `backgroundColor` — 画布底色（默认 `'#000'`）
  - `audioGain` — 全局默认音量（默认 0.8）
  - `layoutMode` — `'grid'` | `'legacy'`
  - `renderMode` — `'auto'` | `'worker-webgl2'` | `'main-webgl2'` | `'worker-2d'` | `'main-2d'`
  - `workerUrl` — 可选外部 Worker 脚本地址（不传使用 Blob Worker）
  - `dropFrameWhenBusy` — Worker 忙时是否丢帧（默认 `true`）
  - `maxFrameQueue` — 最大帧队列（默认 1）

### 初始化步骤

1. `MixerConfig.create(options)` 归一化配置 → 检测 `hasModernOptions` → 决定 `_layoutMode`
2. 创建 `MixerDomAdapter` + 离屏 `canvas`
3. 创建子模块：`SourceRegistry` → `OutputStreamManager` → `RenderLoop` → `AudioMixer` → `LayoutEngine`
4. grid 模式预置 canvas 尺寸
5. `appendStream(videos)` 将初始源加入混流
6. 音频系统延迟创建，直到 `getAudioStream()` 才初始化

---

## 4. 输入源管理

### `appendStream(videos, optionsOrSlot)`

```js
mixer.appendStream(stream);                          // 自动分配 slot
mixer.appendStream(stream, 3);                       // 指定 slot（隐式升级 grid）
mixer.appendStream(stream, { slot: 3, gain: 0.5 });
mixer.appendStream([streamA, streamB], { gain: 0.7 }); // 批量添加
```

**逻辑**:

1. 如果 `optionsOrSlot` 含 `.slot` → `_ensureModernLayout()` 升级为 grid
2. 遍历 `videos`，`SourceRegistry.add()` 创建/覆盖源
3. 音频系统已激活时触发 `AudioMixer.scheduleRefresh()`
4. 恢复 rAF 循环

### `removeStream(streamOrId)`

通过 `SourceRegistry.find()` → `SourceRegistry.remove()` 移除，自动断开音频并释放 video 元素。

### `getSources()`

返回快照数组：

```js
[
  { id, streamId, slot, gain, hasAudio, hasVideo },
  ...
]
```

### Source 内部结构

```js
{
  id:              string,   // 优先 MediaStream.id（冲突追加 -1 -2 后缀）
  stream:          MediaStream,
  video:           HTMLVideoElement,
  slot:            number | null,
  gain:            number,
  audioSourceNode: MediaStreamAudioSourceNode | null,  // 由 AudioMixer 连接
  gainNode:        GainNode | null,
  audioStream:     MediaStream | null,
  ownedVideo:      boolean   // true=mixer 创建的隐藏 video
}
```

### Slot 分配（grid 模式）

- 指定 slot 时放入目标位置，同 slot 旧源被覆盖
- 未指定 slot 时从 0 自增分配最小编号空位
- 批量添加时 slot 在数组内递增

---

## 5. 视频混流

### 帧循环（RenderLoop）

```
requestAnimationFrame
    │
    ▼
RenderLoop.renderFrame(timestamp, forceRender)
    │
    ├── fps 节流检查：未到目标间隔时跳过
    ├── 同步外部音频源（HTMLVideoElement 换源检测）
    ├── LayoutEngine.createRenderPayload(layoutMode)
    │       ├── legacy：固定宫格，逐源计算绘制矩形
    │       └── grid：_calcLayout() → 按 slot 排列
    ├── renderer.render(payload) → 绘制到 canvas
    ├── 检查 Worker 健康状态 → 连续失败 2 次降级
    └── _scheduleNextFrame()
```

### LayoutEngine 网格计算

| 源数 / slot 范围 | 布局 |
|-----------------|------|
| 1 | 1×1 |
| 2 | 按画布横竖比例 2×1 或 1×2 |
| 3-4 | 2×2 |
| 5-6 | 按比例 3×2 或 2×3 |
| 7-9 | 3×3 |
| 10+ | `ceil(sqrt(n)) × ceil(n/cols)` |

### 等比缩放

`_scaleVideo()` 实现 cover 效果：按目标区域等比缩放，超出部分裁剪，居中显示。

---

## 6. 音频混流

### 机制

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

### AudioMixer 关键行为

- **延迟初始化**: `AudioContext` 只在已请求音频且存在 live 音频轨时创建
- **自动恢复**: `AudioContext` 处于 `suspended` 时自动 `resume()`
- **换源检测**: 每帧渲染前 `syncExternalSourceAudio()` 检测 HTMLVideoElement 换源
- **异步刷新**: `scheduleRefresh()` 用于不能 await 的路径，pending 标记确保不丢失刷新请求
- **音量独立**: 每路独立 GainNode，appendStream 时可指定 gain

### `getAudioInfo()`

```js
{
  requested: true,
  status: 'mixing',        // not-requested | no-source | ready | mixing | suspended | failed | stopped
  contextState: 'running',
  sourceCount: 2,
  liveSourceCount: 2,
  connectedSources: 2,
  outputTracks: 1,
  reason: '',
  lastError: ''
}
```

---

## 7. 输出流获取

### `getMixedStream()`

```js
const mixedStream = await mixer.getMixedStream();
```

**步骤**:

1. `RenderLoop.resume()`
2. `getVideoStream()` → 启动 rAF + `canvas.captureStream()`
3. `setMixedStream()` 保存引用（供后续音频注入）
4. `getAudioStream()` → 初始化 AudioContext、连接所有音频源
5. `addAudioTracksToStream()` → 音频轨去重添加到视频流

**音频延迟注入**: `getMixedStream()` 返回后通过 `appendStream()` 添加有音频的源时，AudioMixer 自动将音频轨补充到已返回的流。

### `getRenderInfo()`

```js
{
  requestedMode: 'auto',
  actualMode: 'worker-webgl2',
  isWorker: true, isWebGL2: true, isFallback: false,
  droppedFrames: 0, renderedFrames: 42,
  fps: 30, width: 1280, height: 720
}
```

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
  │ ─────────────────────────────────►   │
  │                                      ├── MixerConfig.create(options)
  │                                      ├── 创建子模块（SourceRegistry / RenderLoop / AudioMixer / LayoutEngine）
  │                                      ├── grid 模式预置 canvas 尺寸
  │                                      └── appendStream([streamA])
  │                                           └── SourceRegistry.add(streamA)
  │                                               ├── _createSource() → ID + video 元素
  │                                               └── slot 冲突检测（grid 模式）
  │
  │  appendStream(streamB, 5)
  │ ─────────────────────────────────►   │
  │                                      ├── _ensureModernLayout() → grid 升级
  │                                      └── SourceRegistry.add(streamB, { slot: 5 })
  │
  │  await getMixedStream()
  │ ─────────────────────────────────►   │
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
  │ ─────────────────────────────────►   │
  │                                      ├── RenderLoop.stop()
  │                                      ├── clearStreams()
  │                                      ├── AudioMixer.stop()
  │                                      ├── RenderLoop.destroy()
  │                                      └── OutputStreamManager.stop()
```

---

## 10. 方法速查

### MixerController 公开 API

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `appendStream(videos, optionsOrSlot?)` | `MediaStream/HTMLVideoElement/Array`, `number/Object` | `boolean` | 添加输入源，同 slot 覆盖 |
| `removeStream(streamOrId)` | `MediaStream/string` | `boolean` | 移除指定源 |
| `clearStreams()` | — | — | 移除所有源 |
| `getSources()` | — | `Array<Object>` | 源信息快照 |
| `getRenderInfo()` | — | `Object` | 渲染后端状态 |
| `getAudioInfo()` | — | `Object` | 音频系统状态 |
| `getMixedStream()` | — | `Promise<MediaStream>` | 完整音视频混合流 |
| `getVideoStream()` | — | `MediaStream` | 仅视频轨 |
| `getAudioStream()` | — | `Promise<MediaStream\|null>` | 仅音频轨 |
| `stop()` | — | — | 释放所有资源 |

### 子模块入口

各子模块有完整中文注释，直接查看源码：
- [SourceRegistry.js](../lib/mixer-core/SourceRegistry.js)
- [LayoutEngine.js](../lib/mixer-core/LayoutEngine.js)
- [AudioMixer.js](../lib/mixer-core/AudioMixer.js)
- [OutputStreamManager.js](../lib/mixer-core/OutputStreamManager.js)
- [RenderLoop.js](../lib/mixer-core/RenderLoop.js)
- [MixerConfig.js](../lib/mixer-core/MixerConfig.js)
- [MixerDomAdapter.js](../lib/mixer-core/MixerDomAdapter.js)
