# 混流器输出流支持 Insertable Streams API

## Context

混流器目前通过 `canvas.captureStream(fps)` 获取输出视频流。该方式依赖浏览器内部定时采样 canvas，帧率控制不精确。

参照 `samples/mediastream.webgl.html` 中 `MediaStreamTrackGenerator` + `transferToImageBitmap()` + `VideoFrame(bitmap, ...)` 方案，增加 Insertable Streams API 输出路径。当 API 不可用时回退 `canvas.captureStream()`。

关键参考代码（`mediastream.webgl.html`）：
```
canvas.transferToImageBitmap()        → 零拷贝提取帧
new VideoFrame(bitmap, { timestamp })  → 构造输出帧
generator.writable 写出的帧              → 输出 track
```

## Implementation

### 1. OutputStreamManager.js — 核心改造

**新增 `_detectInsertableStreams()` 静态方法**：检测 `MediaStreamTrackGenerator`、`VideoFrame`、`OffscreenCanvas`、`transferToImageBitmap` 可用性。

**`getVideoStream(drawFirstFrame)` 分支**：
- Insertable Streams 路径：创建 `MediaStreamTrackGenerator`，返回 `new MediaStream([generator])`，**不调用 `captureStream()`**
- captureStream 路径：现有逻辑不变

**新增 `onFrameRendered(canvas, now)`** — RenderLoop 每次成功渲染 canvas 后调用：
- Insertable Streams 模式下提取帧并写入 generator
- 提取策略（按渲染后端区分）：
  - **WorkerRenderer**: Worker 返回的 `ImageBitmap` 可直接 `new VideoFrame(bitmap, { timestamp })`，无需 drawImage 到 canvas
  - **Canvas2D/WebGL2 主线程渲染器**: `createImageBitmap(canvas)` → `new VideoFrame(bitmap, { timestamp })`，或使用 `OffscreenCanvas` + `transferToImageBitmap()` 零拷贝
- 写入失败时 `frame.close()` 防泄漏
- 背压标记 `_pendingWrite`：上次写未完成时丢弃中间帧

**`stop()` 分支**：关闭 generator writer → 停止 generator track；captureStream 分支保持现有逻辑。

### 2. RenderLoop.js — 添加回调

构造函数新增 `onFrameRendered` 可选回调。

`renderFrame()` 中 `renderer.render(payload)` 成功后末尾调用：
```js
if (typeof this._onFrameRendered === 'function') {
    this._onFrameRendered(this._canvas, now);
}
```

### 3. MixerController.js — 连线

RenderLoop 构造时传入 `onFrameRendered`：
```js
onFrameRendered: (canvas, timestamp) => {
    this._outputStreamManager.onFrameRendered(canvas, timestamp);
}
```

### 4. WorkerRenderer.js — 优化（可选）

当前 Worker 返回 `ImageBitmap` → 主线程 `drawImage` 到 canvas。Insertable Streams 模式下可直接 `new VideoFrame(bitmap, { timestamp: frame.timestamp })` + `generator.write()`，跳过 canvas drawImage 步骤。

## FPS 与时序

- 输出帧率由 RenderLoop FPS 节流控制，与现有逻辑一致
- 首帧：`drawFirstFrame()` 强制渲染触发首次帧写入
- 时间戳：使用 `performance.now() * 1000`（微秒），或 Worker 模式下保留原始 `frame.timestamp`

## 验收

1. `npx gulp lint` — ESLint 通过
2. `npx gulp test` — 全量测试通过
3. 浏览器中 `getMixedStream()` 连 `<video>` 播放正常
