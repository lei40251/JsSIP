# MediaStreamMixer — 混流器模块

**文件**: [lib/Mixer.js](../lib/Mixer.js)
**导出**: `class MediaStreamMixer`

> 将多路 `MediaStream` / `HTMLMediaElement` 合并为单路音视频输出流。视频用 Canvas 2D 合成，音频用 WebAudio API 混音。

---

## 目录

1. [核心概念](#1-核心概念)
2. [构造与配置](#2-构造与配置)
3. [输入源管理](#3-输入源管理)
4. [视频混流](#4-视频混流)
5. [音频混流](#5-音频混流)
6. [输出流获取](#6-输出流获取)
7. [生命周期](#7-生命周期)
8. [内部调用时序](#8-内部调用时序)
9. [私有方法速查](#9-私有方法速查)

---

## 1. 核心概念

### 两种布局模式

| 模式 | 触发条件 | 行为 |
|------|----------|------|
| `legacy` | 不传 `options` 或 options 无任何混流配置项 | 固定 640x480 单元格，最多 2×2 宫格。画布尺寸随源数量动态变化 |
| `grid` | 传了 `options`（任意配置项）或调用 `appendStream(stream, slot)` 时隐式升级 | 固定输出分辨率（默认 1280x720），输入视频按 slot 在网格中定位 |

### 数据流路径

```
MediaStream/HTMLVideoElement
    │
    ├──► _createSource() ──► _sources[]
    │                           │
    ├──► video (HTMLVideoElement) ──► _drawVideosToCanvas() ──► canvas ──► captureStream()
    │                                                                         │
    ├──► audio (WebAudio) ──► MediaStreamSourceNode ──► GainNode ──► MediaStreamAudioDestinationNode
    │                                                                         │
    └──► getMixedStream() ──► 合并 video stream + audio tracks ──► 最终输出 MediaStream
```

---

## 2. 构造与配置

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
  layoutMode: 'grid'  // 'grid' | 'legacy'
});
```

**参数**:

- `videos`: `MediaStream | HTMLMediaElement | Array<...>` — 输入源。支持数组、单个对象、SDK 包装对象 `{ mediaStream }`；传入 `HTMLMediaElement` 时仅支持 `srcObject` 为 `MediaStream` 的元素，不支持普通文件 URL/MSE `video.src`
- `options`: 配置对象：
  - `width` / `height` — 输出分辨率（grid 模式默认 1280x720）
  - `fps` — 输出帧率（默认浏览器自动）
  - `backgroundColor` — 画布底色（默认 `'#000'`）
  - `audioGain` — 全局默认音量（默认 0.8）
  - `layoutMode` — `'grid'` | `'legacy'`

### 关键初始化步骤

1. 检测 `options` 是否有显式配置项 → 决定 `_layoutMode`
2. 创建 `canvas` + `2d context`，grid 模式设置固定分辨率
3. 调用 `appendStream(videos)` 将初始源加入混流
4. 音频相关对象（`AudioContext` 等）延迟创建 — 直到 `getAudioStream()` 才初始化

---

## 3. 输入源管理

### `appendStream(videos, optionsOrSlot)`

向混流器添加新源。

```js
// 添加单个源，自动分配 slot
mixer.appendStream(stream);

// 添加到指定 slot（会隐式升级为 grid 模式）
mixer.appendStream(stream, 3);
mixer.appendStream(stream, { slot: 3, gain: 0.5 });

// 批量添加
mixer.appendStream([streamA, streamB], { gain: 0.7 });
```

**逻辑**:

1. 如果 `optionsOrSlot` 是数字或包含 `.slot` → 调用 `_ensureModernLayout()` 升级为 grid 模式
2. 遍历 `videos` 数组，对每个输入：
   - 调用 `_normalizeSourceOptions()` 统一 options 格式
   - `_createSource()` 创建内部 source 对象（创建隐藏 `<video>` 元素）
   - grid 模式下，同 slot 已有源则覆盖（先 remove 旧的）
   - 如果 `_audioContext` 已存在，连接该源的音频
3. 如果 rAF 循环因无源暂停过，重新启动

### `removeStream(streamOrId)`

```js
mixer.removeStream(stream);         // 通过 MediaStream 对象
mixer.removeStream(stream.id);      // 通过 stream id
mixer.removeStream(source.id);      // 通过内部 source id
```

- 通过 `_findSource()` 查找匹配的 source
- 调用 `_removeSource()` 断开音频、释放 video 元素、从 `_sources` 移除

### `clearStreams()`

移除所有源，遍历 `_sources` 切片逐个调用 `_removeSource()`。

### Source 内部结构

```js
{
  id:              string,   // 唯一标识，优先用 MediaStream.id
  stream:          MediaStream,
  video:           HTMLVideoElement,
  slot:            number | null,
  gain:            number,
  audioSourceNode: MediaStreamSourceNode | null,
  gainNode:        GainNode | null,
  audioStream:     MediaStream | null,
  ownedVideo:      boolean   // true=mixer 创建的隐藏 video，false=外部传入的 HTMLMediaElement
}
```

### `getSources()`

返回快照数组，不暴露内部引用：

```js
[
  { id, streamId, slot, gain, hasAudio, hasVideo },
  ...
]
```

---

## 4. 视频混流

### 机制

每一帧的流程：

```
requestAnimationFrame
    │
    ▼
_drawVideosToCanvas()
    │
    ├── legacy 模式
    │   ├── 设置 canvas 尺寸（640/1280 × 480/960）
    │   ├── 筛选可渲染源（stream.active + 有 video track）
    │   └── _drawImage(video, idx) — 每个源画到对应单元格
    │
    └── grid 模式
        ├── _prepareModernCanvas() — 固定输出分辨率
        ├── 填充背景色
        ├── _calcLayout() — 根据最大 slot 计算行列数
        └── 按 slot 计算每个源的 cell 位置，_scaleVideo() 等比缩放后 drawImage
```

### `_calcLayout()` 网格计算

| 源数 / slot 范围 | 布局 |
|-----------------|------|
| 1 | 1×1 |
| 2 | 按画布横竖比例 2×1 或 1×2 |
| 3-4 | 2×2 |
| 5-6 | 按比例 3×2 或 2×3 |
| 7-9 | 3×3 |
| 10+ | `ceil(sqrt(n)) × ceil(n/cols)` |

### `_scaleVideo(width, height, targetW, targetH)`

等比缩放 + 居中算法：

- 以视频宽高比与目标单元格宽高比比较
- 取能填满单元格的缩放比（按较宽边对齐）
- 计算 `offsetX` / `offsetY` 实现居中
- 无效输入返回 `null`

### 性能优化

- 配置 `fps` 时，rAF 只负责调度，真正的视频合成按目标帧间隔节流，避免输出 15/30fps 时仍按屏幕刷新率满负载合成
- rAF 只在 `_sources.length > 0` 时持续调度，无源时自动暂停；最后一个源移除时会强制渲染一帧背景色，避免输出残留上一帧
- `appendStream()` 添加源时自动恢复 rAF 循环
- 每帧检查 `video.readyState < 2` 跳过未就绪的视频

---

## 5. 音频混流

### 机制

```
每个 source:
  MediaStream ──► createMediaStreamSource() ──► GainNode ──┐
                                                            │
所有 source 汇总 ───────────────────────────────────────────┤
                                                            ▼
                                             MediaStreamAudioDestinationNode
                                                      │
                                                      ▼
                                              _destination.stream
```

### 关键实现

- **延迟初始化**: `AudioContext` 只在已请求音频且存在 live 音频轨时创建，避免无音频源也占用浏览器音频资源
- **自动恢复**: 如果 `AudioContext` 处于 `suspended` 状态，`getAudioStream()` 会 `await resume()`
- **源替换处理**: 渲染循环检测外部 `HTMLMediaElement.srcObject` 变化，并触发音频断旧连新
- **音量控制**: 每个 source 有独立 `GainNode`，可在 `appendStream()` 时指定
- **音频轨注入**: `getMixedStream()` 把 `AudioDestination` 的音频轨添加到视频 `MediaStream` 中；启动时无音频、后续 append 有音频源时也会补入
- **状态观测**: `getAudioInfo()` 区分 `not-requested`、`no-source`、`ready`、`mixing`、`suspended`、`failed`、`stopped`
- **本地监听**: demo 里的输出 `<video>` 默认静音；添加带音频的输入源后，需要点击“监听输出”按钮才会在本机播放混音结果

---

## 6. 输出流获取

### `getMixedStream()` — 主入口

```js
const mixedStream = await mixer.getMixedStream();
// 直接传给 RTCPeerConnection / <video> 等消费端
```

**步骤**:

1. 设置 `_isStopDrawingFrames = false`（重置停止标记）
2. 调用 `getVideoStream()` 获取或复用视频输出流，保存为 `_mixedStream`
3. 调用 `getAudioStream()` 获取音频流
4. 把音频流的音轨 `addTrack()` 到视频流
5. 返回合并后的 `MediaStream`

### `getVideoStream()`

- 调用 `_drawVideosToCanvas()` 开始 rAF 循环
- `canvas.captureStream(fps)` 抓取画布内容为视频流
- 同一 Mixer 实例内复用已有输出流；多次调用不会停止调用方已持有的旧 video track
- 返回仅含视频轨的 `MediaStream`

### `getAudioStream()`

- 标记调用方需要混音音频
- 如果当前没有 live 音频轨，返回 `null`，暂不创建 `AudioContext`
- 存在 live 音频轨时创建 / 恢复 `AudioContext`
- 创建 `MediaStreamAudioDestinationNode`
- 遍历所有 `_sources` 连接音频，返回 `_destination.stream`（仅含音频轨）

### `getAudioInfo()`

返回当前音频状态快照：

```js
{
  requested: true,
  status: 'mixing',
  contextState: 'running',
  sourceCount: 2,
  liveSourceCount: 2,
  connectedSources: 2,
  outputTracks: 1,
  reason: '',
  lastError: ''
}
```

`status` 常见值：

- `not-requested` — 尚未调用 `getAudioStream()` / `getMixedStream()`
- `no-source` — 已请求音频，但当前没有 live 音频轨
- `ready` / `mixing` — AudioContext 可用，且已连接音频源
- `suspended` — AudioContext 仍处于浏览器挂起状态
- `failed` — AudioContext 创建/恢复或音频源连接失败
- `stopped` — Mixer 已停止

### Renderer fallback

初始化阶段按 `renderMode` 选择 Worker/WebGL2/main-2d；运行时如果 Worker 后端连续失败，Mixer 会切到主线程 Canvas2D。运行期 fallback 不切 WebGL2，因为 WorkerRenderer 已经占用了输出 canvas 的 2D context；主线程 WebGL2 运行时失败只更新状态，不跨 context 切换。

---

## 7. 生命周期

```
new MediaStreamMixer()
    │
    ├── appendStream(stream)
    │       │
    │       ▼
    ├── getMixedStream() ──► rAF 循环启动
    │       │                    │
    │       ├── appendStream() ──┘ 可继续添加源
    │       ├── removeStream()     移除源
    │       │
    │       ▼
    └── stop()
            │
            ├── cancelAnimationFrame() + rAF 标记
            ├── clearStreams() — 释放所有源
            ├── audioContext.close()
            ├── 清理 captureStreams + canvas
            └── 标记实例不可复用
```

`stop()` 后同一个 mixer 实例不再支持 `appendStream()`、`getVideoStream()`、`getAudioStream()` 或 `getMixedStream()`；需要重新创建实例。

### `stop()` 清理

1. `_isStopDrawingFrames = true` — 阻止 rAF 下一帧
2. `cancelAnimationFrame()` — 取消当前排队帧
3. `clearStreams()` — 逐一 `_removeSource()`，断开音频 + 释放 video 元素
4. 断开并销毁 `AudioContext`
5. 销毁 renderer
6. 停止所有 `_capturedStreams` 的 tracks
7. `_destroyed = true` — 阻止后续误复用

---

## 8. 内部调用时序

### 完整混流流程

```
调用方                              Mixer
  │                                  │
  │  new Mixer([streamA])            │
  │ ───────────────────────────────► │
  │                                  ├── _hasMixerOptions() → false
  │                                  ├── _layoutMode = 'legacy'
  │                                  ├── _prepareModernCanvas() (跳过)
  │                                  └── appendStream([streamA])
  │                                       └── _createSource(streamA)
  │                                           ├── _createSourceId()
  │                                           └── _mediaStreamToVideoElement()
  │                                               └── <video>.play()
  │
  │  appendStream(streamB, 5)
  │ ───────────────────────────────► │
  │                                  ├── _ensureModernLayout() → 升级为 grid
  │                                  ├── _createSource(streamB, { slot: 5 })
  │                                  └── slot 冲突检测
  │
  │  await getMixedStream()
  │ ───────────────────────────────► │
  │                                  ├── getVideoStream()
  │                                  │   ├── _drawVideosToCanvas()
  │                                  │   │   ├── 按 fps 判断是否需要合成当前帧
  │                                  │   │   ├── _drawModernVideosToCanvas()
  │                                  │   │   │   ├── _calcLayout()
  │                                  │   │   │   └── 每个 source → _scaleVideo() → drawImage()
  │                                  │   │   └── rAF 调度下一帧
  │                                  │   └── canvas.captureStream() → videoStream（后续调用复用）
  │                                  │
  │                                  ├── 保存 _mixedStream = videoStream
  │                                  │
  │                                  ├── getAudioStream()
  │                                  │   ├── new AudioContext()
  │                                  │   ├── createMediaStreamDestination()
  │                                  │   ├── 每个 source → _connectAudio()
  │                                  │   │   └── createMediaStreamSource() → GainNode → Destination
  │                                  │   └── return audioStream
  │                                  │
  │                                  ├── _addAudioTracksToStream(videoStream, audioStream)
  │                                  └── return mixedStream
  │
  │  removeStream(streamA)
  │ ───────────────────────────────► │
  │                                  ├── _findSource(streamA)
  │                                  ├── _removeSource(sourceA)
  │                                  │   ├── _disconnectAudio()
  │                                  │   └── source.video.pause() + remove()
  │                                  └── _syncVideos()
  │
  │  stop()
  │ ───────────────────────────────► │
  │                                  ├── cancelAnimationFrame()
  │                                  ├── clearStreams()
  │                                  ├── audioContext.close()
  │                                  └── 清理 resources
```

### 音频连接时序（详细）

```
getAudioStream() 或 appendStream() 触发
    │
    ▼
_connectAudio(source)
    │
    ├── _getSourceStream() → 同步 srcObject
    │
    ├── 检查 audioContext 和 audioDestination 就绪
    │
    ├── 检查 _hasLiveAudioTrack()
    │
    ├── [已连过?] → 检查 audioStream === currentStream?
    │   ├── 相同 → return false（无需重复连）
    │   └── 不同 → _disconnectAudio()（先断旧的）
    │
    └── 创建新的音频链路:
        createMediaStreamSource(stream)
            → 连到 GainNode (gain = source.gain)
            → 连到 MediaStreamAudioDestination
        → 记录节点引用 + 调用 _ensureMixedStreamAudioTrack()
```

---

## 9. 私有方法速查

| 方法 | 作用 | 调用者 |
|------|------|--------|
| `_hasMixerOptions(options)` | 检测是否传了新版配置项 | constructor |
| `_normalizePositiveInteger(v, fallback)` | 校验正整数 | constructor |
| `_normalizeSlot(v, index)` | 校验 slot + 递增 | `_normalizeSourceOptions` |
| `_normalizeGain(v, fallback)` | 校验音量值 | constructor, `_normalizeSourceOptions`, `_createSource` |
| `_normalizeSourceOptions(options, idx)` | 统一 appendStream 参数格式 | `appendStream` |
| `_ensureModernLayout()` | legacy → grid 升级 | `appendStream` |
| `_prepareModernCanvas()` | 设置 grid 固定画布尺寸 | constructor, `_ensureModernLayout`, `_drawModernVideosToCanvas` |
| `_syncVideos()` | `_videos` ← `_sources[].video` | `appendStream`, `_removeSource` |
| `_createSourceId(stream, video)` | 生成唯一 source id | `_createSource` |
| `_createSource(input, options)` | 创建内部 source 对象 | `appendStream` |
| `_getNextSlot()` | 找第一个空 slot | `_createSource` |
| `_removeSource(source)` | 移除源 + 释放资源 | `removeStream`, `clearStreams`, `appendStream`(slot覆盖) |
| `_findSource(streamOrId)` | 按 stream/id/video 查找 | `removeStream` |
| `_hasLiveAudioTrack(source)` | 是否有 live 音频轨 | `_connectAudio`, `getSources` |
| `_updateAudioInfo(info)` | 更新音频状态快照 | `getAudioInfo`, `getAudioStream` |
| `_hasVideoTrack(source)` | 是否有视频轨 | `_isRenderable` |
| `_isRenderable(source)` | stream active + 有视频轨 | `_drawVideosToCanvas`, `_drawModernVideosToCanvas` |
| `_getSourceStream(source)` | 获取当前 MediaStream | 多处调用 |
| `_scaleVideo(w, h, tw, th)` | 等比缩放 + 居中 | `_drawImage`, `_drawModernVideosToCanvas` |
| `_drawImage(video, idx)` | legacy 单格绘制 | `_drawVideosToCanvas`(legacy) |
| `_calcLayout()` | 计算网格行列 | `_drawModernVideosToCanvas` |
| `_drawModernVideosToCanvas()` | grid 模式绘制全帧 | `_drawVideosToCanvas` |
| `_drawVideosToCanvas()` | 主 rAF 回调 | rAF, `getVideoStream`, `appendStream` |
| `_mediaStreamToVideoElement(s)` | 创建隐藏 `<video>` | `_createSource` |
| `_connectAudio(source)` | 连接一路音频 | `appendStream`, `getAudioStream` |
| `_disconnectAudio(source)` | 断开一路音频 | `_removeSource`, `_connectAudio`(换源) |
| `_ensureMixedStreamAudioTrack()` | 补音频轨到已返回的 mixed stream | `_connectAudio` |
| `_addAudioTracksToStream(ts, as)` | 去重添加音频轨 | `getMixedStream` |
| `_fallbackRendererToMain2D(reason)` | Worker/renderer 运行时失败后切主线程 2D | `_drawVideosToCanvas` |
