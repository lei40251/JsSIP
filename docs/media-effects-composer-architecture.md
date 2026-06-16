# MediaEffectsComposer 混流器模块架构分析

## 模块总览

`MediaEffectsComposer` 是一个多路音视频混流器，将多个 `MediaStream` / `HTMLMediaElement` 合并为一个输出 `MediaStream`，可直接给 `RTCPeerConnection`、本地预览或录制链路使用。

镜像语义上，这个模块只处理“源级镜像”“合成输出镜像”“输出级水印是否跟随镜像”三件事，不负责页面层本地预览的 CSS 镜像。

命名约定：目录名优先使用完整能力名并统一写成 `AI`（如 `AIVirtualBackground/`、`AINoiseSuppression/`）；文件名和标识符优先使用缩写形式 `Ai` / `ai`（如 `AiVBConfig.js`、`AiNSCore.js`、`AiNSEngine`、`aiVirtualBackground`）。

这一版对外 API 已经收敛为 8 个主方法：

- `addSource()`
- `removeSource()`
- `clearSources()`
- `setConfig()`
- `getState()`
- `getOutput()`
- `releaseOutput()`
- `stop()`

旧方法仍保留，但主要作为兼容包装层，内部尽量转调到新控制路径。

### 快速理解路线

1. 入口在 [lib/MediaEffectsComposer/Core/MediaEffectsComposer.js](../lib/MediaEffectsComposer/Core/MediaEffectsComposer.js)。
2. 输入源由 `SourceRegistry` 管理。
3. 源级虚拟背景由 `SourceAiVBManager` 调度，并复用 `AIVirtualBackground/` 下的配置、资源加载和 MediaPipe runtime。
4. 视频渲染由 `LayoutEngine -> RenderLoop -> RendererFactory` 处理。
5. 音频输出由 `AudioMixer` 处理。
6. 输出流由 `OutputStreamManager` 统一产出。
7. 水印由 `WatermarkManager` 管理。

### 模块职责总览

```
MediaEffectsComposer 是总调度：
  SourceRegistry 管输入源
  SourceAiVBManager 管源级虚拟背景
  LayoutEngine 计算布局和镜像后的绘制信息
  RenderLoop 负责何时渲染
  RendererFactory/Renderer 负责怎么画
  WatermarkManager 负责水印状态和异步资源
  AudioMixer 负责音频混音和子混音
  OutputStreamManager 负责 canvas/audio 到最终 MediaStream 的导出
```

### 当前推荐的调试入口

| 目标 | 推荐入口 | 对应内部链路 |
|------|----------|--------------|
| 看当前所有源 | `getState().sources` | `SourceRegistry.getSnapshot()` |
| 看镜像/水印配置 | `getState().config` | `_getConfigStateSnapshot()` |
| 看视频渲染状态 | `getState().render` | `RenderLoop.getRenderInfo()` |
| 看音频混音状态 | `getState().audio` | `AudioMixer.getInfo()` |
| 获取完整输出 | `getOutput({ type: 'mixed' })` | `_getMixedOutput()` |
| 获取子混音 | `getOutput({ type: 'audio', slots, isolated })` | shared slots bus 或 isolated AudioContext |

### 兼容旧方法如何看待

| 旧方法 | 当前角色 |
|--------|----------|
| `appendStream()` | `addSource()` 包装层 |
| `removeStream()` | `removeSource()` 包装层 |
| `clearStreams()` | `clearSources()` 包装层 |
| `getSources()` / `getRenderInfo()` / `getAudioInfo()` | `getState()` 的拆分包装层 |
| `getMixedStream()` / `getAudioStream()` / `getVideoStream()` | `getOutput()` 的兼容入口 |
| `setMirror()` / `setSourceMirror()` / `setWatermarks()` 等 | `setConfig()` 的兼容入口 |

---

## 目录结构

```
lib/
├── Mixer.js
│
└── MediaEffectsComposer/
    ├── AIVirtualBackground/
    │   ├── AiVBConfig.js
    │   ├── AiVBAssetLoader.js
    │   └── MediaPipeSegmenterRuntime.js
    │
    ├── Core/
    │   ├── MediaEffectsComposer.js
    │   ├── MixerConfig.js
    │   ├── SourceRegistry.js
    │   ├── SourceAiVBManager.js
    │   ├── LayoutEngine.js
    │   ├── MixerDomAdapter.js
    │   ├── AudioMixer.js
    │   ├── OutputStreamManager.js
    │   ├── RenderLoop.js
    │   └── WatermarkManager.js
    │
    └── Renderers/
        ├── RendererFactory.js
        ├── BaseRenderer.js
        ├── MainCanvas2DRenderer.js
        ├── MainWebGL2Renderer.js
        ├── WorkerRenderer.js
        ├── workerScript.js
        └── helpers/
            ├── gl.js
            └── color.js
```

---

## 中枢控制器

### [lib/MediaEffectsComposer/Core/MediaEffectsComposer.js](../lib/MediaEffectsComposer/Core/MediaEffectsComposer.js)

`MediaEffectsComposer` 负责协调所有子模块，是整个系统的中介者。

### 构造流程

```
constructor(videos, options)
  │
  ├─ MixerConfig.create(options) → 归一化配置
  ├─ new MixerDomAdapter(...)
  ├─ new WatermarkManager(...)
  ├─ new SourceRegistry(...)
  ├─ new OutputStreamManager(...)
  ├─ new RenderLoop(...)
  ├─ new AudioMixer(...)
  ├─ new LayoutEngine(...)
  └─ appendStream(videos) / addSource(videos) → 添加初始源
```

说明：
- 构造阶段仍然沿用旧初始化路径 `appendStream(videos)`，但该方法已经只是 `addSource()` 包装层。

### 当前公开 API 与内部链路

| 新方法 | 功能 | 主要链路 |
|--------|------|----------|
| `addSource(videos, optionsOrSlot)` | 添加输入源 | `SourceRegistry.add() -> AudioMixer.scheduleRefresh() -> RenderLoop.start()` |
| `removeSource(target)` | 移除一路源 | `_removeSourcesInternal(target) -> SourceRegistry.remove()` |
| `clearSources()` | 移除全部源 | `_removeSourcesInternal(undefined)` |
| `setConfig(patch)` | 动态修改镜像/水印等配置 | 更新 `_config` / `_slotMirrorXOverrides` / `WatermarkManager` / 强制重绘 |
| `getState()` | 读取统一状态快照 | `SourceRegistry + _getConfigStateSnapshot() + RenderLoop + AudioMixer` |
| `getOutput(options)` | 获取 `mixed` / `video` / `audio` 输出 | `_getVideoOutputSync()` / `_getMixedOutput()` / `AudioMixer` |
| `releaseOutput(options)` | 释放音频子混音 | `AudioMixer.releaseSubmixAudioStream()` |
| `stop()` | 销毁实例 | `RenderLoop.stop() -> clearSources() -> AudioMixer.stop() -> RenderLoop.destroy() -> OutputStreamManager.stop()` |

### 兼容旧方法实现方式

旧方法现在主要只是薄包装：

```js
appendStream(videos, optionsOrSlot) {
  return this.addSource(videos, optionsOrSlot);
}

removeStream(streamOrId) {
  return this.removeSource(streamOrId);
}

clearStreams() {
  this.clearSources();
}

async getMixedStream() {
  return this.getOutput({ type: 'mixed' });
}
```

需要特别注意的兼容点：

- `getVideoStream()` 仍保留同步行为，内部直接走 `_getVideoOutputSync()`
- `getAudioStream({ slots })` 使用共享主 `AudioContext`，但每次调用默认创建新的子混音输出轨道
- `getAudioStream({ slots, isolated: true })` 或 `audioContext: 'isolated'` 使用独立 `AudioContext`
- `setMirror()` / `setSourceMirror()` 这类旧 setter 仍然同步返回，但内部调的是异步 `setConfig()`

---

## 新 API 核心实现

### `addSource()`

`addSource()` 是新的源入口，负责：

1. 检查实例是否已 `stop()`
2. 标准化单个源或数组源
3. 限制最多 9 路
4. 归一化 `slot/gain/sourceMirror/aiVirtualBackground`
5. 交给 `SourceRegistry.add()`
6. 若音频链路已经建立，则异步刷新音频连接
7. 刷新镜像 / 效果渲染策略
8. 启动 `RenderLoop`

调用链：

```
addSource()
  ├─ _normalizeSourceOptions()
  ├─ SourceRegistry.add()
  ├─ _scheduleAudioRefresh()   (按需)
  ├─ _refreshRendererPolicyForEffects()
  └─ RenderLoop.start()
```

旧方法对应：

```js
appendStream(...)
```

### `removeSource()` 和 `clearSources()`

这两个方法有意分开：

- `removeSource(target)` 只处理单个目标
- `clearSources()` 明确表示清空全部源

内部共用 `_removeSourcesInternal()`，但对外语义保持分离，避免把“不传参数的 remove”变成危险的批量删除。

调用链：

```
removeSource(target)
  └─ _removeSourcesInternal(target)
       ├─ _findSource(target)
       ├─ SourceRegistry.remove()
       ├─ onBeforeRemove -> AudioMixer.disconnectSource()
       └─ onAfterRemove  -> RenderLoop.removeSource()

clearSources()
  └─ _removeSourcesInternal(undefined)
       └─ 遍历全部 source 执行同样清理
```

旧方法对应：

```js
removeStream(...)
clearStreams()
```

### `setConfig()`

`setConfig()` 是新的运行时配置中心，负责统一处理：

- `outputMirror`
- `mirrorWatermarksWithOutput`
- `sourceMirror`
- `sourceMirrorOverrides`
- `clearSourceMirrorOverrides`
- `watermarks`
- `clearWatermarks`
- `clearWatermarkFilter`

核心实现特点：

1. 先改内存配置 `_config`
2. 再处理水印异步更新
3. 计算是否需要刷新镜像渲染策略
4. 计算是否需要强制重绘
5. 返回统一配置快照

这里要特别区分：

- `sourceMirror` / `sourceMirrorOverrides` 作用在单路 source 进入布局之前
- `outputMirror` 作用在最终合成输出
- `mirrorWatermarksWithOutput` 只影响输出级水印是否跟着 `outputMirror` 一起翻转

调用链：

```
setConfig(patch)
  ├─ 更新 _config.outputMirrorX / mirrorX
  ├─ 更新 _slotMirrorXOverrides
  ├─ WatermarkManager.setWatermarks() / clearWatermarks()
  ├─ _refreshRendererPolicyForMirror()
  └─ _drawVideosToCanvas(undefined, true)
```

旧方法对应：

```js
setMirror(enabled)
setMirrorWatermarksWithOutput(enabled)
setSourceMirror(...)
clearSourceMirror(...)
setWatermarks(watermarks)
clearWatermarks(filter)
```

### `getState()`

`getState()` 是新的统一状态查询入口，把以前零散的查询合并为一次快照读取：

```js
{
  sources,
  config,
  render,
  audio
}
```

内部来源：

| 字段 | 来源 |
|------|------|
| `sources` | `SourceRegistry.getSnapshot()` |
| `config` | `_getConfigStateSnapshot()` |
| `render` | `_collectRenderInfo(false)` |
| `audio` | `_collectAudioInfo(false)` |

旧方法对应：

```js
getSources()
getRenderInfo()
getAudioInfo()
getWatermarks()
getMirror()
getSourceMirror()
```

### `getOutput()`

`getOutput()` 是新的统一取流入口，按 `type` 分三条路径。

#### 1. `type: 'video'`

```js
await composer.getOutput({ type: 'video' })
```

内部走：

```
getOutput({ type: 'video' })
  └─ _getVideoOutputSync()
       ├─ RenderLoop.resume()
       ├─ OutputStreamManager.hasLiveVideoStream()
       └─ OutputStreamManager.getVideoStream(drawFirstFrame)
```

#### 2. `type: 'mixed'`

```js
await composer.getOutput({ type: 'mixed' })
```

内部走：

```
getOutput({ type: 'mixed' })
  └─ _getMixedOutput()
       ├─ _getVideoOutputSync()
       ├─ OutputStreamManager.setMixedStream(videoStream)
       ├─ AudioMixer.getAudioStream()
       └─ _addAudioTracksToStream(videoStream, audioStream)
```

#### 3. `type: 'audio'`

```js
await composer.getOutput({ type: 'audio' })
await composer.getOutput({ type: 'audio', slots: [0, 2] })
await composer.getOutput({ type: 'audio', slots: [0, 2] })
```

内部走：

```
getOutput({ type: 'audio', ... })
  ├─ isolated=true/audioContext=isolated -> AudioMixer.getIsolatedSubmixAudioStream()
  └─ shared slots bus -> AudioMixer.getAudioStream()
```

旧方法对应：

```js
getMixedStream()
getVideoStream()
getAudioStream()
getIsolatedSubmixAudioStream()
```

### `releaseOutput()`

当前 `releaseOutput()` 只负责音频子混音释放：

```
releaseOutput({ type: 'audio', slots })
  └─ AudioMixer.releaseSubmixAudioStream()
```

旧方法对应：

```js
releaseSubmixAudioStream(...)
```

---

## 关键子模块

### [lib/MediaEffectsComposer/Core/MixerConfig.js](../lib/MediaEffectsComposer/Core/MixerConfig.js)

配置归一化模块，主要负责：

- 输出尺寸、fps、renderMode 标准化
- `slot` 归一化
- `gain` 归一化
- 源参数标准化

虽然对外已经推荐 `addSource()`，但 `addSource()` 内部仍会复用这里的 `normalizeSourceOptions()`，所以旧参数形式仍能兼容。

### [lib/MediaEffectsComposer/Core/SourceRegistry.js](../lib/MediaEffectsComposer/Core/SourceRegistry.js)

输入源注册表，负责：

- 增删查 source
- 维护 slot 覆盖规则
- 为 `MediaStream` 创建隐藏 `video`
- 生成源快照

关键调用：

```
addSource() / removeSource() / clearSources()
  -> SourceRegistry.add() / remove() / getSnapshot()
```

### [lib/MediaEffectsComposer/Core/LayoutEngine.js](../lib/MediaEffectsComposer/Core/LayoutEngine.js)

负责布局和渲染输入数据生成：

- 根据源数量和 slot 计算网格
- 根据镜像策略决定源级绘制镜像
- 组装 renderer 消费的 payload
- 追加 source/output 水印绘制项

### [lib/MediaEffectsComposer/Core/WatermarkManager.js](../lib/MediaEffectsComposer/Core/WatermarkManager.js)

新版本里水印管理被明确独立出来，职责包括：

- 保存当前水印状态
- 异步加载图片水印资源
- 输出带 `status/reason` 的水印快照
- 响应 `setConfig({ watermarks })` 和 `setConfig({ clearWatermarks: true })`

### [lib/MediaEffectsComposer/Core/AudioMixer.js](../lib/MediaEffectsComposer/Core/AudioMixer.js)

音频混音模块，负责：

- 延迟初始化 `AudioContext`
- 全量混音
- 指定 slots 子混音
- `isolated` 独立子混音
- 子混音释放

这也是 `getOutput({ type: 'audio' })` / `releaseOutput()` 的实际执行者。

### [lib/MediaEffectsComposer/Core/OutputStreamManager.js](../lib/MediaEffectsComposer/Core/OutputStreamManager.js)

输出流管理模块，负责：

- `canvas.captureStream()` 产出视频流
- 保存已返回的 mixed stream 引用
- 在后续音频可用时把音轨补进 mixed stream
- 停止所有 capture 出来的轨道

### [lib/MediaEffectsComposer/Core/RenderLoop.js](../lib/MediaEffectsComposer/Core/RenderLoop.js)

渲染循环负责：

- rAF 调度
- fps 节流
- renderer 生命周期
- Worker 失败后的降级
- 输出渲染信息

`getState().render` 和旧 `getRenderInfo()` 都来自这里。

---

## 数据流

### 新 API 视角

```
addSource()
  └─ SourceRegistry
      ├─ LayoutEngine
      ├─ AudioMixer
      └─ RenderLoop.start()

setConfig()
  ├─ 更新镜像配置
  ├─ 更新水印状态
  ├─ 刷新 renderer 策略
  └─ 强制重绘

getOutput()
  ├─ video -> OutputStreamManager
  ├─ mixed -> OutputStreamManager + AudioMixer
  └─ audio -> AudioMixer

getState()
  └─ 汇总 SourceRegistry + config + RenderLoop + AudioMixer
```

### 一帧视频渲染流程

```
RenderLoop.renderFrame()
  ├─ AudioMixer.syncExternalSourceAudio()
  ├─ LayoutEngine.createRenderPayload()
  ├─ RendererFactory.ensureRenderer()
  ├─ renderer.render(payload)
  └─ OutputStreamManager.onFramePresented()
```

### `getOutput({ type: 'mixed' })` 完整流程

```
getOutput({ type: 'mixed' })
  ├─ _getVideoOutputSync()
  │   ├─ OutputStreamManager.getVideoStream(drawFirstFrame)
  │   └─ canvas.captureStream(fps)
  │
  ├─ OutputStreamManager.setMixedStream(videoStream)
  │
  ├─ AudioMixer.getAudioStream()
  │   ├─ _ensureAudioSystem()
  │   ├─ _refreshAudioConnections()
  │   └─ 返回 audio destination stream
  │
  └─ addAudioTracksToStream(videoStream, audioStream)
```

### `setConfig()` 完整流程

```
setConfig(patch)
  ├─ 解析 outputMirror / sourceMirror / overrides
  ├─ 解析 clearSourceMirrorOverrides
  ├─ WatermarkManager.setWatermarks() / clearWatermarks()
  ├─ _refreshRendererPolicyForMirror()
  └─ _drawVideosToCanvas(undefined, true)
```

---

## 渲染后端选型

`RendererFactory` 仍沿用原来的多后端策略：

- `worker-webgl2`
- `main-webgl2`
- `worker-2d`
- `main-2d`

auto 模式降级顺序仍是：

```
worker-webgl2 -> main-webgl2 -> worker-2d -> main-2d
```

镜像相关的一个实现重点：

- 当启用了源镜像或输出镜像时，`MediaEffectsComposer` 会通过 `_refreshRendererPolicyForMirror()` 更新 `forceMainThreadRenderer`
- 如当前 renderer 是 Worker 路径，必要时会主动 fallback 到主线程渲染器

这也是为什么镜像配置被统一纳入 `setConfig()` 之后，内部仍需要顺带改渲染策略。

---

## 分层依赖图

```
MediaEffectsComposer.js
  ├── MixerConfig
  ├── MixerDomAdapter
  ├── WatermarkManager
  ├── SourceRegistry
  ├── LayoutEngine
  ├── AudioMixer
  ├── RenderLoop
  └── OutputStreamManager

RenderLoop
  └── RendererFactory
      ├── MainCanvas2DRenderer
      ├── MainWebGL2Renderer
      └── WorkerRenderer
```

---

## 设计取向

这一版 API 和实现上的主要取向是：

1. 对外入口收敛
2. 状态读取统一
3. 配置修改统一
4. 输出获取统一
5. 旧方法保留但降级为兼容层

换句话说，架构并不是“另起一套”，而是在保留原有内部模块的前提下，把对外控制面重新整理了一次。

---

## 注意事项

1. `stop()` 后实例不可复用。
2. `removeSource(target)` 和 `clearSources()` 对外语义保持分离，不建议合并。
3. 旧方法当前仍可用，但新代码应优先使用 `addSource / setConfig / getState / getOutput / releaseOutput`。
4. `getVideoStream()` 仍保留同步兼容行为，这是旧代码迁移期间的特例。
5. `AudioContext` 仍然延迟创建，只有在请求音频输出时才初始化。
6. Worker 渲染故障时仍会自动降级。
