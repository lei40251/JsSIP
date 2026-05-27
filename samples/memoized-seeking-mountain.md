# 混流器输出流支持 Insertable Streams API

## Context

混流器目前通过 `canvas.captureStream(fps)` 获取输出视频流。该方式依赖浏览器内部定时采样 canvas，存在帧率控制不精确、canvas 与流生命周期强耦合等限制。

需要增加 `MediaStreamTrackGenerator` + `VideoFrame(canvas, ...)` 方案：渲染完成后主动从 canvas 创建 VideoFrame 并写入 Generator，以独立控制输出帧率、降低延迟。当 Insertable Streams API 不可用时，回退到 `canvas.captureStream()`。

## Implementation

### 1. OutputStreamManager.js — 核心改造

**新增 `_detectInsertableStreams()` 静态方法**：检测 `MediaStreamTrackGenerator`、`VideoFrame` 构造函数可用性，并用 1x1 canvas 运行时探测 `VideoFrame(canvas, ...)` 是否支持。

**`getVideoStream(drawFirstFrame)` 分支**：
- Insertable Streams 路径：创建 `MediaStreamTrackGenerator` + 获取 `writer`，返回 `new MediaStream([generator])`
- captureStream 路径：现有逻辑不变

**新增 `onFrameRendered(canvas, timestampMs)`**：RenderLoop 每次成功渲染后调用。
- `_pendingWrite` 标记防止背压堆积（下游消费慢时丢弃中间帧）
- `new VideoFrame(canvas, { timestamp: Math.round(timestampMs * 1000) })` 创建帧
- `writer.write(frame)` 异步写入，不阻塞渲染循环
- 写入失败时主动 `frame.close()` 防止资源泄漏

**`stop()` 分支**：Insertable Streams 路径关闭 writer → 停止 generator track；captureStream 路径停止所有 capturedStreams tracks。

新增诊断计数器 `_droppedOutputFrames`。

### 2. RenderLoop.js — 添加回调

构造函数新增 `onFrameRendered` 可选回调。

`renderFrame()` 中 `else` 分支（`renderer.render(payload)` 成功后）末尾调用：
```js
if (typeof this._onFrameRendered === 'function') {
    this._onFrameRendered(this._canvas, now);
}
```

仅在 `_shouldRenderPayload` 通过且 renderer 实际渲染后才调用，空 payload 时跳过。

### 3. MixerController.js — 连线

RenderLoop 构造时传入 `onFrameRendered`：
```js
onFrameRendered: (canvas, timestamp) => {
    this._outputStreamManager.onFrameRendered(canvas, timestamp);
}
```

`getMixedStream()` / `getVideoStream()` 无需改动。

### 4. 无改动的文件

MainCanvas2DRenderer / MainWebGL2Renderer / WorkerRenderer / BaseRenderer / RendererFactory / MixerDomAdapter / MixerConfig — 所有渲染后端都绘制到同一个 canvas，`onFrameRendered` 从 canvas 读取像素，与后端无关。

## FPS 与时序

- 输出帧率由 RenderLoop 的 FPS 节流控制（同现有逻辑），无额外帧率控制
- 首帧：`drawFirstFrame()` 强制同步渲染触发首次 `onFrameRendered`
- 背压：`_pendingWrite` 标记确保最多 1 帧在写队列，超出丢弃

## 验收

1. `npx gulp lint` — ESLint 通过
2. `npx gulp mixer-test` — 现有测试全部通过
3. `npx gulp test` — 全量测试通过
4. 浏览器中验证：创建 Mixer 并调用 `getMixedStream()`，连到 `<video>` 播放正常
