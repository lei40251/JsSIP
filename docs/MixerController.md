# MixerController.js — 主控制器详解

**文件**: [lib/mixer-core/MixerController.js](../lib/mixer-core/MixerController.js)

MixerController 采用**调解者模式**，不直接处理渲染、音频、布局等具体逻辑，而是协调 6 个子模块完成工作：

| 子模块 | 职责 |
|--------|------|
| `SourceRegistry` | 源管理：增删改查、ID 分配、slot 管理 |
| `LayoutEngine` | 布局计算：按 slot 和画布尺寸计算每路视频的绘制矩形 |
| `AudioMixer` | 音频混音：WebAudio 多路 GainNode → destination |
| `OutputStreamManager` | 输出流：canvas.captureStream() + 音频轨注入 |
| `RenderLoop` | 帧循环：rAF 调度 + fps 节流 + 调用渲染器绘制 |
| `MixerDomAdapter` | DOM 副作用：创建隐藏 canvas/video 元素 |
| `MixerConfig` | 配置归一化：参数校验、默认值填充 |
| `WatermarkManager` | 水印配置归一化、图片加载、文字缓存和绘制项计算 |

---

## 1. 私有方法调用关系图

```
constructor(videos, options)
  ├── MixerConfig.create(options)
  ├── new MixerDomAdapter()
  ├── domAdapter.createCanvas()
  ├── new SourceRegistry()
  ├── new OutputStreamManager(canvas, config)
  ├── new RenderLoop(canvas, config, { getSources, createRenderPayload, ... })
  ├── new AudioMixer(sourceRegistry, { getDestroyed, onAudioTrackAvailable })
  ├── new WatermarkManager()
  ├── new LayoutEngine(sourceRegistry, { prepareCanvas, resizeRenderer, createWatermarkItems })
  ├── _prepareCanvas()
  ├── WatermarkManager.setWatermarks(options.watermarks)
  └── appendStream(videos)
        └── SourceRegistry.add()
              └── _mediaStreamToVideoElement()  ← 回调

getMixedStream()
  ├── RenderLoop.resume()
  ├── getVideoStream()
  │     ├── RenderLoop.resume()
  │     └── OutputStreamManager.getVideoStream()
  ├── OutputStreamManager.setMixedStream()
  ├── getAudioStream()
  │     └── AudioMixer.getAudioStream()
  └── _addAudioTracksToStream()

appendStream(videos, optionsOrSlot)
  ├── _normalizeSourceOptions()
  ├── _assertNotDestroyed()
  ├── SourceRegistry.add()  ← 内部回调 _mediaStreamToVideoElement
  ├── _scheduleAudioRefresh()  ← 仅音频已初始化时
  └── RenderLoop.start()

removeStream(streamOrId)
  ├── _assertNotDestroyed()
  ├── _findSource()
  └── _removeSource()
        └── SourceRegistry.remove()
              ├── onBeforeRemove → _disconnectAudio()
              └── onAfterRemove → RenderLoop.removeSource() / 清画布

stop()
  ├── RenderLoop.stop()
  ├── clearStreams()
  │     └── 遍历 _sources → _removeSource()
  ├── AudioMixer.stop()
  ├── RenderLoop.destroy()
  └── OutputStreamManager.stop()
```

---

## 2. 方法逐项说明

### 2.1 构造与初始化

#### `constructor(videos, options)`

**功能**: 创建混流器实例，初始化所有子模块。

**参数**:
- `videos`: `Array<MediaStream|HTMLMediaElement|Object>` — 输入源列表，也支持单个源
- `options`: `Object` — 混流配置

**调用链**:
1. `MixerConfig.create(options)` → 归一化配置，得到 `this._config`
2. `new MixerDomAdapter({ config, logger })` → 创建 DOM 适配器
3. `this._domAdapter.createCanvas()` → 创建离屏 canvas
4. `new SourceRegistry({...})` → 创建源注册表，传入回调：
   - `onBeforeRemove` → `_disconnectAudio(source)`
   - `onAfterRemove` → 通知 RenderLoop 移除源 / 清空画布
5. `new OutputStreamManager({ canvas, config, logger })` → 输出流管理器
6. `new RenderLoop({ canvas, config, logger, getSources, createRenderPayload, syncExternalSourceAudio })` → 渲染循环
7. `new AudioMixer({ logger, sourceRegistry, getDestroyed, onAudioTrackAvailable })` → 音频混音器
8. `new WatermarkManager()` → 水印管理器
9. `new LayoutEngine({ sourceRegistry, canvas, config, prepareCanvas, resizeRenderer, createWatermarkItems })` → 布局引擎
9. `this._prepareCanvas()` → 预置画布尺寸
10. `WatermarkManager.setWatermarks(options.watermarks)` → 加载初始水印
11. `this.appendStream(videos)` → 加入初始源

---

### 2.2 配置检测与参数归一化

这些方法均委派给 `MixerConfig`（纯函数工具类），区别在于这里作为控制器实例方法暴露，方便子模块回调中引用。

| 方法 | 委派目标 | 功能 |
|------|----------|------|
| `_normalizeRenderMode(value, fallback)` | `MixerConfig.normalizeRenderMode` | 渲染模式归一化，非法值回退到 `fallback` |
| `_normalizePositiveInteger(value, fallback)` | `MixerConfig.normalizePositiveInteger` | 正整数归一化，防 canvas 0 尺寸 |
| `_normalizeSlot(value, index)` | `MixerConfig.normalizeSlot` | slot 归一化，批量添加时递增 |
| `_normalizeGain(value, fallback)` | `MixerConfig.normalizeGain` | 音量增益归一化，非法值用全局默认音量 |
| `_normalizeSourceOptions(optionsOrSlot, index)` | `MixerConfig.normalizeSourceOptions` | 统一 `appendStream()` 第二个参数的格式 |

**设计意图**: 为什么这些方法不在控制器里直接调用 `MixerConfig` 静态方法，而是包装一层？
因为子模块（如 SourceRegistry）构造时接收的是方法引用（`this._normalizeGain.bind(this)`），
如果 SourceRegistry 直接 import MixerConfig，会增加模块间耦合。通过控制器传递，所有归一化逻辑集中一处。

---

### 2.3 基础设施

| 方法 | 功能 |
|------|------|
| `_prepareCanvas()` | 调用 `domAdapter.prepareCanvas(this._canvas)`，设置画布尺寸 |
| `_ensureRenderer()` | 确保渲染后端已初始化，委派给 `RenderLoop.ensureRenderer()` |
| `_resizeRenderer(width, height)` | 将画布尺寸同步给渲染器，委派给 `RenderLoop.resizeRenderer()` |
| `_fallbackRendererToMain2D(reason)` | 显式落到主线程 Canvas2D 的内部兜底，完整 auto 降级链由 `RenderLoop.fallbackRenderer()` 处理 |
| `_assertNotDestroyed(methodName)` | 防 `stop()` 后继续操作，抛 `Error` 要求重新 new 实例 |

---

### 2.4 源移除与查找

#### `_removeSource(source)`

**功能**: 移除并清理一个 source。

**调用链**:
```
SourceRegistry.remove(source)
  ├── onBeforeRemove(source) → _disconnectAudio(source)  ← 先断音频
  ├── 释放 ownedVideo 的 video 元素
  ├── 从 _sources 数组中移除
  └── onAfterRemove(source) → 通知 RenderLoop / 清画布
```

**返回值**: `boolean` — 是否成功移除。

#### `_findSource(streamOrId)`

**功能**: 按 MediaStream 对象、`stream.id` 或内部 `source.id` 查找 source。

**参数**:
- `MediaStream` → 按引用匹配
- `string` → 先匹配 `source.id`，再匹配 `stream.id`
- `HTMLVideoElement` → 匹配关联的 video 元素

**返回值**: `Object|null`

---

### 2.5 源状态检测

| 方法 | 功能 | 委派目标 |
|------|------|----------|
| `_hasLiveAudioTrack(source)` | 检测某路源是否有 live 音频轨 | `SourceRegistry.hasLiveAudioTrack` |
| `_hasVideoTrack(source)` | 检测某路源是否有视频轨（不判断 readyState） | `SourceRegistry.hasVideoTrack` |
| `_isRenderable(source)` | 判断某路源当前是否可渲染（stream active + 有视频轨） | `SourceRegistry.isRenderable` |
| `_getSourceStream(source)` | 获取 source 当前关联的 MediaStream，对 HTMLVideoElement 会同步更新引用 | `SourceRegistry.getStream` |

---

### 2.6 渲染数据构建

#### `_createRenderPayload()`

**功能**: 构建一帧的渲染 payload。

**调用**: `LayoutEngine.createRenderPayload()`

**返回数据结构**:
```js
{
  width: 1280,
  height: 720,
  backgroundColor: '#000',
  items: [
    { id: 'source-1', video: HTMLVideoElement, draw: { x, y, width, height } },
    ...
  ],
  sourceWatermarks: [],
  outputWatermarks: []
}
```

**设计意图**: MixerController 只决定"每路视频画在哪里"，具体的"怎么画"交给渲染器。
这样 Canvas2D、WebGL2、Worker 可以复用完全一致的布局结果。
水印绘制项由 WatermarkManager 根据当前 payload 追加，不改变源布局算法。

---

### 2.7 主渲染循环

#### `_drawVideosToCanvas(timestamp, forceRender = false)`

**功能**: requestAnimationFrame 回调，合成一帧到输出画布。

**调用**: `RenderLoop.renderFrame(timestamp, forceRender)`

**内部流程**:
```
renderFrame(timestamp)
  ├── fps 节流：未到目标间隔 → 跳过
  ├── syncExternalSourceAudio()  ← 换源检测
  ├── LayoutEngine.createRenderPayload()
  ├── renderer.render(payload)  → 绘制到 canvas
  ├── Worker 健康：连续失败 2 次 → 触发 fallback
  └── _scheduleNextFrame()
```

---

### 2.8 音频连接与管理

| 方法 | 功能 | 委派目标 |
|------|------|----------|
| `_scheduleAudioRefresh()` | 异步刷新音频连接（用于不能 await 的路径） | `AudioMixer.scheduleRefresh()` |
| `_syncExternalSourceAudio()` | 检测外部 HTMLMediaElement 是否替换了 srcObject | `AudioMixer.syncExternalSourceAudio()` |
| `_disconnectAudio(source)` | 断开一路 source 的音频连接 | `AudioMixer.disconnectSource(source)` |
| `_ensureMixedStreamAudioTrack(audioStream)` | 将音频轨补充到已返回的 mixed stream | `OutputStreamManager.ensureMixedStreamAudioTrack()` |
| `_addAudioTracksToStream(target, audioStream)` | 去重地将音频轨添加到目标流 | `OutputStreamManager.addAudioTracksToStream()` |

**调用场景**:
- `_disconnectAudio()`: removeStream、appendStream 同 slot 覆盖、外部换源
- `_scheduleAudioRefresh()`: appendStream 添加有音频源时
- `_syncExternalSourceAudio()`: 每帧渲染前检测换源

---

### 2.9 公开 API

#### `appendStream(videos, optionsOrSlot)`

**功能**: 添加新的输入源。

**调用方式**:
```js
appendStream(stream)                    // 自动分配 slot
appendStream(stream, 3)                 // 指定 slot
appendStream(stream, { slot: 3, gain: 0.5 })
appendStream([streamA, streamB])        // 批量添加
```

**返回值**: `boolean` — 至少成功添加了一个源

**调用链**:
```
_assertNotDestroyed()
_normalizeSourceOptions(optionsOrSlot, index)
SourceRegistry.add(video, sourceOptions)
  └── 内部回调 _mediaStreamToVideoElement() 创建隐藏视频元素
if (_audioMixer 已初始化) → _scheduleAudioRefresh()
RenderLoop.start()  ← 恢复帧循环（之前可能因无源暂停）
```

#### `removeStream(streamOrId)`

**功能**: 按 MediaStream 或 ID 移除一路源。

**参数**: `MediaStream | string`
- `MediaStream` → 按引用匹配
- `string` → 先匹配 `source.id`，再匹配 `stream.id`

**返回值**: `boolean`

**调用链**: `_findSource()` → `_removeSource()` → `SourceRegistry.remove()` → 回调链

#### `clearStreams()`

**功能**: 移除所有输入源。遍历 `_sources`（快照，slice 拷贝防止遍历时数组变化），逐个 `_removeSource()`。

#### `getSources()`

**功能**: 返回所有源的快照数组。新建对象数组，外部修改不影响内部。

**返回**:
```js
[
  { id: 'source-1', streamId: '...', slot: 0, gain: 0.8, hasAudio: true, hasVideo: true },
  ...
]
```

#### `getRenderInfo()`

**功能**: 返回当前渲染后端状态快照。只读，不影响渲染。

**返回**:
```js
{
  requestedMode: 'auto',
  actualMode: 'worker-webgl2',
  isWorker: true,
  isWebGL2: true,
  isFallback: false,
  renderedFrames: 1234,
  droppedFrames: 5,
  fps: 30
}
```

#### `getAudioInfo()`

**功能**: 返回当前音频混流状态快照。音频系统未初始化时返回默认值 `DEFAULT_AUDIO_INFO`。

**返回**:
```js
{
  requested: true,
  status: 'running',
  contextState: 'running',   // AudioContext.state
  sourceCount: 3,
  liveSourceCount: 2,
  connectedSources: 2,
  outputTracks: 1,
  reason: '',
  lastError: ''
}
```

#### `setWatermarks(watermarks)`

**功能**: 替换全部水印配置。支持文字水印和图片水印；图片 URL 异步加载，加载失败只体现在 `getWatermarks()` 状态中，不中断混流。

**返回值**: `Promise<Array<Object>>` — 当前水印快照。

#### `clearWatermarks(filter)`

**功能**: 清除水印。不传参数清空全部；可按 `{ id, target, slot, sourceId, streamId }` 删除匹配项。

#### `getWatermarks()`

**功能**: 返回水印状态快照，包含 `status` 和 `reason`，外部修改不会影响内部状态。

#### `getMixedStream()`

**功能**: 获取完整音视频混合流。

**调用链**:
```
1. _assertNotDestroyed()
2. RenderLoop.resume()           → 恢复帧循环
3. getVideoStream()              → 启动 canvas.captureStream()
4. OutputStreamManager.setMixedStream()  → 保存引用供后续音频注入
5. getAudioStream()              → 延迟创建 AudioContext
6. _addAudioTracksToStream()     → 音频轨合并到视频流
```

**返回值**: `Promise<MediaStream>` — 包含视频轨和音频轨的流

**设计要点**:
- 先保存 mixed stream 再初始化音频，
  这样 `appendStream()` 后添加有音频的源时，
  `_ensureMixedStreamAudioTrack()` 可以把新音频轨注入到已返回给调用方的流里。

#### `getVideoStream()`

**功能**: 仅获取混合后的视频流（不含音频）。

**调用链**:
```
1. _assertNotDestroyed()
2. RenderLoop.resume()
3. OutputStreamManager.getVideoStream(() => _drawVideosToCanvas(undefined, true))
   └── canvas.captureStream(fps) → 输出流
```

**返回值**: `MediaStream` — 仅含视频轨

#### `getAudioStream()`

**功能**: 获取混合后的音频流。

**调用**: `AudioMixer.getAudioStream()`

**内部行为**:
- 无音频源时返回 `null`
- 延迟创建 `AudioContext`
- AudioContext `suspended` 时自动 `resume()`
- 有已创建但未连接的新源时自动连接

**返回值**: `Promise<MediaStream|null>`

#### `stop()`

**功能**: 停止混流，释放所有资源。

**清理顺序**:
```
1. _destroyed = true              → 实例标记
2. RenderLoop.stop()              → cancelAnimationFrame
3. clearStreams()                 → 移除所有源（断开音频、释放 video）
4. AudioMixer.stop()              → 关闭 AudioContext
5. RenderLoop.destroy()           → 销毁渲染器
6. OutputStreamManager.stop()     → 停止所有 tracks
```

**注意**: `stop()` 后同一个实例不可再使用，必须 `new MediaStreamMixer()`。

---

## 3. 只读委派 Getter

文件末尾通过 `Object.defineProperties` 定义了 19 个只读 getter，全部委派到子模块。

**设计意图**: 早期实现中，这些状态通过 `_syncDelegatedState()` 方法定期手动同步，
每次同步遍历所有属性复制到控制器。改为 getter 委派后：
1. **消除冗余复制**：不需要维护影子属性，始终读取子模块最新状态
2. **消除同步时机问题**：不再需要在特定时机调用同步方法
3. **降低维护成本**：新增子模块属性只需加一行 getter，无需修改同步逻辑

### SourceRegistry 委派

| Getter | 委派路径 | 回退值 |
|--------|----------|--------|
| `_sources` | `_sourceRegistry.sources` | `[]` |
| `_videos` | `_sourceRegistry.videos` | `[]` |

### RenderLoop 委派

| Getter | 委派路径 | 回退值 |
|--------|----------|--------|
| `_renderer` | `_renderLoop.renderer` | `null` |
| `_animationId` | `_renderLoop.animationId` | `null` |
| `_lastRenderTime` | `_renderLoop.lastRenderTime` | `0` |
| `_renderFrameInterval` | `_renderLoop.renderFrameInterval` | `0` |
| `_renderErrorCount` | `_renderLoop.renderErrorCount` | `0` |
| `_rendererErrorCount` | `_renderLoop.rendererErrorCount` | `0` |
| `_isStopDrawingFrames` | `_renderLoop.isStopped` | `false` |

### AudioMixer 委派

| Getter | 委派路径 | 回退值 |
|--------|----------|--------|
| `_audioSources` | `_audioMixer.audioSources` | `[]` |
| `_audioDestination` | `_audioMixer.audioDestination` | `null` |
| `_audioContext` | `_audioMixer.audioContext` | `null` |
| `_audioRequested` | `_audioMixer.requested` | `false` |
| `_audioInfo` | `_audioMixer.audioInfo` | `DEFAULT_AUDIO_INFO` |

### OutputStreamManager 委派

| Getter | 委派路径 | 回退值 |
|--------|----------|--------|
| `_mixedStream` | `_outputStreamManager.mixedStream` | `null` |
| `_capturedStreams` | `_outputStreamManager.capturedStreams` | `[]` |
| `_capturedStream` | `_outputStreamManager.capturedStream` | `null` |
| `_videoStream` | `_outputStreamManager.videoStream` | `null` |

---

## 4. 回调链汇总

MixerController 在各子模块构造时注入回调，形成数据流：

```
SourceRegistry.onBeforeRemove(source)
  └── _disconnectAudio(source)  → AudioMixer.disconnectSource()

SourceRegistry.onAfterRemove(source)
  ├── if _renderLoop → _renderLoop.removeSource(source.id)
  └── if 无源 + 有输出流 → clear canvas (_drawVideosToCanvas)

SourceRegistry.createVideoElement(mediaStream)
  └── _mediaStreamToVideoElement() → MixerDomAdapter.createVideoElement()

SourceRegistry.normalizeGain(value, fallback)
  └── _normalizeGain() → MixerConfig.normalizeGain()

SourceRegistry.getDefaultGain
  └── () => this._config.audioGain

AudioMixer.onAudioTrackAvailable(audioStream)
  └── _ensureMixedStreamAudioTrack() → OutputStreamManager.ensureMixedStreamAudioTrack()

AudioMixer.getDestroyed
  └── () => this._destroyed

LayoutEngine.prepareCanvas()
  └── _prepareCanvas() → MixerDomAdapter.prepareCanvas()

LayoutEngine.resizeRenderer(width, height)
  └── _resizeRenderer() → RenderLoop.resizeRenderer()

RenderLoop.getSources
  └── () => this._sources  → 委派给 SourceRegistry.sources

RenderLoop.createRenderPayload
  └── () => this._createRenderPayload() → LayoutEngine.createRenderPayload()

LayoutEngine.createWatermarkItems(payload)
  └── WatermarkManager.createRenderItems(payload)

RenderLoop.syncExternalSourceAudio
  └── () => this._syncExternalSourceAudio() → AudioMixer.syncExternalSourceAudio()
```

---

## 5. 关键设计决策

### 为什么构造时就创建所有子模块，而不是延迟创建？

MixerController 构造时就创建 6 个子模块，好处：
- **引用安全**：所有回调在构造时注册，后续方法可以直接引用子模块，无需判空
- **明确依赖**：构造失败尽早暴露（如 canvas 创建失败）

唯一延迟创建的是 AudioContext（音频上下文），它在 `getAudioStream()` 才初始化。
原因：WebAudio API 在部分浏览器上有自动播放策略限制，过早创建可能导致后续不可用。

### 为什么所有私有方法都委派给子模块，而不是直接实现？

MixerController 约 95% 的私有方法是一行委派调用。这是有意为之：
- **职责单一**：控制器只负责编排，不负责实现
- **可测试性**：每个子模块可以独立测试
- **可替换性**：如果某个子模块需要替换实现（如图改用 SVG 合成），只需替换子模块，控制器无需改变
