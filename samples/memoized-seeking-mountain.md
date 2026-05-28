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

## 目标与范围

- 首版目标：在不破坏现有 `getVideoStream()/getMixedStream()` 行为的前提下，新增 Insertable Streams 输出路径，并保留稳定回退。
- 兼容原则：`OffscreenCanvas` / `transferToImageBitmap` 仅作为性能优化，不作为能力门槛。
- 分阶段交付：
  - **Phase 1（本次）**：主线程统一路径（Canvas2D/WebGL2/Worker 最终都从主线程 canvas 抽帧），优先稳定性。
  - **Phase 2（后续）**：WorkerRenderer 直通 `ImageBitmap -> VideoFrame` 优化，减少一次 drawImage。

## Implementation

### 1. OutputStreamManager.js — 核心改造

**新增 `_detectInsertableStreams()` 静态方法（分层检测）**：
- **核心必需能力**：`MediaStreamTrackGenerator`、`VideoFrame`、`WritableStream writer`
- **可选优化能力**：`OffscreenCanvas`、`transferToImageBitmap`、`createImageBitmap`
- 结论字段建议：
  - `supported`（是否可走 Insertable）
  - `reason`（不支持原因，便于日志）
  - `optimizations`（可用优化清单）

**`getVideoStream(drawFirstFrame)` 分支**：
- Insertable Streams 路径：
  - 创建 `MediaStreamTrackGenerator({ kind: 'video' })`
  - 创建 writer（`generator.writable.getWriter()`）
  - 先执行 `drawFirstFrame()` 并尝试写入首帧（预热/预检）
  - 首帧成功后返回 `new MediaStream([generator])`，**不调用 `captureStream()`**
  - 若任一步骤失败，立即释放临时资源并回退 `captureStream()`
- captureStream 路径：现有逻辑不变

**新增 `onFrameRendered(frameCtx)`** — RenderLoop 每次成功渲染后调用：
- Insertable Streams 模式下提取帧并写入 generator
- `frameCtx` 建议结构：`{ canvas, timestamp, source, bitmap? }`
- **Phase 1 抽帧策略（统一主线程）**：
  - 优先 `createImageBitmap(canvas)`（兼容好）
  - 如可用且收益明确，可走 `OffscreenCanvas + transferToImageBitmap` 优化
  - `OffscreenCanvas` 不可用时直接使用 `canvas` 路径，不降级到 `captureStream`
- 背压策略：`latest-frame wins`
  - 写入中（`_pendingWrite=true`）时不排队多帧，仅保存最新一帧覆盖旧帧
  - 写入完成后若存在 `_latestPendingFrame`，立即冲刷一次
  - 被覆盖帧必须立即 `close()`
- 资源释放：
  - `VideoFrame`：无论写入成功/失败/取消，最终都 `close()`
  - `ImageBitmap`：创建方负责 `close()`

**`stop()` 分支**：关闭 generator writer → 停止 generator track；captureStream 分支保持现有逻辑。
- 补充要求：清理 `_pendingWrite`、`_latestPendingFrame`、`_writer`、`_generatorTrack` 等内部状态，确保可重复 start/stop。

### 2. RenderLoop.js — 添加回调

构造函数新增 `onFrameRendered` 可选回调。

`renderFrame()` 中 `renderer.render(payload)` 成功后末尾调用：
```js
if (typeof this._onFrameRendered === 'function') {
    this._onFrameRendered({
        canvas: this._canvas,
        timestamp: now,
        source: this._rendererType
    });
}
```

### 3. MixerController.js — 连线

RenderLoop 构造时传入 `onFrameRendered`：
```js
onFrameRendered: (frameCtx) => {
    this._outputStreamManager.onFrameRendered(frameCtx);
}
```

### 4. WorkerRenderer.js — 优化（可选）

当前 Worker 返回 `ImageBitmap` → 主线程 `drawImage` 到 canvas。该路径保留为 Phase 1 默认方案。

Phase 2 可选优化：
- WorkerRenderer 在回调中附带 `bitmap/timestamp`
- Insertable 模式下优先消费该 bitmap 直接 `new VideoFrame(...)`，跳过主线程二次 draw
- 需额外验证 Worker 直通路径下的时间戳一致性和资源释放顺序

## FPS 与时序

- 输出帧率由 RenderLoop FPS 节流控制，与现有逻辑一致
- 首帧：`drawFirstFrame()` 强制渲染触发首次帧写入；首帧写失败则直接回退 `captureStream`
- 时间戳：
  - 默认：`performance.now() * 1000`（微秒）
  - 若已有可信渲染时间戳（如 Worker frame.timestamp）则透传
  - 保证单调不回退（必要时做 `max(lastTs+1, ts)`）

## 降级与兜底策略

### 初始化阶段（可无损降级）

1. 若核心 API 不支持：直接 `captureStream()`
2. 若 generator/writer 创建失败：直接 `captureStream()`
3. 若首帧抽取或首帧写入失败：释放 Insertable 资源后 `captureStream()`

### 运行阶段（已对外返回 stream 后）

- 不做“静默切换到 captureStream”（避免外部已持有 track 时出现语义突变）
- 策略：
  - 单次写帧失败：记录告警并继续
  - 连续失败达到阈值（如 5 次）：停止写入并上报告警事件/日志
  - 由上层决定是否重新创建输出流（可在后续迭代补自动重建策略）

### 兼容性结论

- **OffscreenCanvas 不支持时可以直接用 canvas 路径**（`createImageBitmap(canvas)` 或等价方案），不需要因为缺少 OffscreenCanvas 而降级到 `captureStream`。

## 验收

1. `npx gulp lint` — ESLint 通过
2. `npx gulp test` — 全量测试通过
3. 浏览器中 `getMixedStream()` 连 `<video>` 播放正常（Insertable 可用环境）
4. 禁用/缺失 Insertable API 时自动走 `captureStream()`，行为与现网一致
5. `start/stop/start`、重复 `getVideoStream/getMixedStream` 无泄漏、无僵尸 track
6. Canvas2D/WebGL2/Worker 三路径均验证时间戳单调与帧输出连续性
