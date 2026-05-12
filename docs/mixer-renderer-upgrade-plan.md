# Mixer 渲染后端升级方案

## 背景

当前 `lib/Mixer.js` 使用主线程 Canvas 2D 完成视频混合：

- 每个输入源通过隐藏 `video` 元素播放。
- 每帧使用 `CanvasRenderingContext2D.drawImage()` 绘制到同一个 canvas。
- 通过 `canvas.captureStream()` 输出混合后的视频轨。
- 音频通过 WebAudio API 混合，视频渲染和音频混合相互独立。

这个方案兼容性好，但多路高分辨率视频时会占用主线程，容易影响页面交互、信令逻辑和其他 UI 渲染。

目标是在保持现有公开 API 兼容的前提下，引入可插拔渲染后端，优先使用 `Worker + WebGL2`，在不支持或初始化失败时自动降级。

## 目标

- 保持现有 API 不破坏：
  - `new CRTC.Mixer(videos, options)`
  - `appendStream()`
  - `removeStream()`
  - `clearStreams()`
  - `getSources()`
  - `getVideoStream()`
  - `getAudioStream()`
  - `getMixedStream()`
  - `stop()`
- 在现代 WebRTC 浏览器中优先使用高性能渲染路径。
- 不支持 WebGL2 或 Worker 渲染失败时，自动降级到稳定路径。
- 不引入 WebGL1 主线支持，降低复杂度和测试成本。
- 音频混合继续保留在主线程 WebAudio，不放进 Worker。
- 所有模式输出行为一致：相同 layout、slot、contain 缩放、背景色、fps。

## 非目标

- 不做 WebGL1 渲染后端。
- 不引入复杂 GPU 特效、滤镜、美颜或转场。
- 不改变现有音频混合架构。
- 不要求所有浏览器都跑最高性能模式，只要求能自动落到可用模式。
- 不把 demo 中的摄像头、屏幕共享、虚拟源生成逻辑放入 SDK。

## 渲染模式

建议支持 3 种实际渲染后端：

| 模式 | 说明 | 用途 |
| --- | --- | --- |
| `worker-webgl2` | Worker + OffscreenCanvas + WebGL2 | 默认优先，高性能路径 |
| `worker-2d` | Worker + OffscreenCanvas + Canvas 2D | WebGL2 不可用时的 worker 降级 |
| `main-2d` | 主线程 Canvas 2D | 最终兼容兜底 |

默认 `renderMode: 'auto'` 时按以下顺序尝试：

1. `Worker + WebGL2`
2. `Worker + Canvas2D`
3. `Main Thread + Canvas2D`

不建议加入 `WebGL1`：

- 目标环境是支持 WebRTC 的现代浏览器，WebGL2 覆盖面已经足够高。
- WebGL1 主要提升老旧设备兼容性，但会增加 shader、纹理、上下文、测试和降级复杂度。
- GPU 被禁用、WebGL2 初始化失败或设备被 blocklist 时，Canvas2D fallback 更稳。

## 新增配置

在现有 `options` 基础上增加渲染相关配置：

```js
const mixer = new CRTC.Mixer([], {
  width: 1280,
  height: 720,
  fps: 30,

  // auto | worker-webgl2 | worker-2d | main-2d
  renderMode: 'auto',

  // 可选：指定外部 worker 脚本路径。
  // 某些 CSP 环境不允许 Blob Worker，此时必须使用固定 workerUrl。
  workerUrl: './mixer.worker.js',

  // worker 忙时是否丢弃本帧，避免帧队列堆积导致延迟越来越高。
  dropFrameWhenBusy: true,

  // 最多允许排队多少帧。建议默认 1。
  maxFrameQueue: 1
});
```

### `renderMode`

- `auto`：自动选择最佳可用模式。
- `worker-webgl2`：强制使用 Worker WebGL2；失败后仍建议自动降级，除非增加 `strictRenderMode`。
- `worker-2d`：强制使用 Worker Canvas2D。
- `main-2d`：强制使用主线程 Canvas2D。

### `workerUrl`

建议支持两种加载策略：

- 默认使用内联 Blob Worker，部署简单。
- 如果传入 `workerUrl`，使用外部 worker 文件，适合 CSP 严格环境。

### `dropFrameWhenBusy`

Worker 渲染时必须避免消息堆积。

推荐默认值：

```js
dropFrameWhenBusy: true
maxFrameQueue: 1
```

当 Worker 正在渲染上一帧时，主线程直接跳过当前帧，而不是继续发送。

## 新增只读状态 API

建议增加：

```js
const info = mixer.getRenderInfo();
```

返回示例：

```js
{
  requestedMode: 'auto',
  actualMode: 'worker-webgl2',
  isWorker: true,
  isWebGL2: true,
  isFallback: false,
  reason: '',
  droppedFrames: 12,
  renderedFrames: 300,
  fps: 30,
  width: 1280,
  height: 720
}
```

用途：

- demo 展示当前实际模式。
- 线上排查性能问题。
- 统计不同浏览器实际 fallback 情况。

## 架构设计

### Mixer 主类职责

`MediaStreamMixer` 保持负责：

- 输入源管理：`appendStream/removeStream/clearStreams/getSources`
- 布局计算：slot、rows、cols、contain 缩放
- 输出流生命周期：`captureStream()`、停止 tracks
- 音频混合：AudioContext、GainNode、MediaStreamDestination
- 渲染后端选择和生命周期管理

### Renderer 抽象

新增内部渲染后端接口：

```js
class BaseRenderer {
  async init(config) {}
  render(framePayload) {}
  resize(width, height) {}
  destroy() {}
  getInfo() {}
}
```

建议实现：

```text
MainCanvas2DRenderer
WorkerCanvas2DRenderer
WorkerWebGL2Renderer
```

`MainCanvas2DRenderer` 可以先由现有 Canvas 2D 逻辑提取而来，保证行为不变。

### Renderer 选择器

新增内部方法：

```js
async _initRenderer()
```

伪流程：

```js
if (renderMode === 'main-2d') {
  use MainCanvas2DRenderer;
}

if (renderMode === 'worker-webgl2' || renderMode === 'auto') {
  try WorkerWebGL2Renderer;
}

if (renderMode === 'worker-2d' || renderMode === 'auto') {
  try WorkerCanvas2DRenderer;
}

use MainCanvas2DRenderer;
```

## 能力检测

### Worker + OffscreenCanvas

需要检测：

```js
typeof Worker !== 'undefined'
typeof OffscreenCanvas !== 'undefined'
canvas.transferControlToOffscreen
```

注意：

- 不能在已经调用 `canvas.getContext('2d')` 后再 `transferControlToOffscreen()`。
- 因此 `Mixer.js` 需要改为延迟初始化 canvas context，由 renderer 决定拿 2D、WebGL2 还是 offscreen。

### WebGL2

Worker 中检测：

```js
const gl = offscreenCanvas.getContext('webgl2', {
  alpha: false,
  antialias: false,
  desynchronized: true,
  powerPreference: 'high-performance'
});
```

如果失败：

- Worker 返回 `INIT_FAILED`。
- Mixer 降级到 `worker-2d`。

不做 WebGL1 fallback。

### Frame API

主线程抽帧建议顺序：

1. `new VideoFrame(video)`，如果支持。
2. `createImageBitmap(video)`。
3. 若都不支持，直接降级到 `main-2d`，由主线程 `drawImage(video)`。

原因：

- Worker 无法直接访问 DOM video 元素。
- `VideoFrame` 和 `ImageBitmap` 都可 transfer 到 Worker。
- 需要每帧及时 `close()`，避免内存增长。

## 帧传递策略

主线程每帧：

1. 遍历当前 sources。
2. 检查 `video.readyState >= 2`。
3. 抽帧为 `VideoFrame` 或 `ImageBitmap`。
4. 带上布局信息发送给 Worker：

```js
{
  type: 'render',
  frames: [
    {
      id: 'stream-id',
      slot: 0,
      frame,
      sourceWidth,
      sourceHeight,
      target: { x, y, width, height }
    }
  ],
  canvas: {
    width: 1280,
    height: 720
  },
  backgroundColor: '#000'
}
```

Worker 完成后返回：

```js
{ type: 'rendered' }
```

如果 Worker 未返回完成信号且 `dropFrameWhenBusy === true`：

- 主线程跳过本帧。
- `droppedFrames++`。

## Worker WebGL2 渲染

Worker 内部职责：

- 初始化 WebGL2 context。
- 编译一个简单纹理 shader。
- 每路 source 复用 texture。
- 每帧：
  - 清屏为 `backgroundColor`。
  - 上传每个 frame 到对应 texture。
  - 根据 target rect 绘制 quad。
  - `frame.close()`。
  - `gl.flush()`。

关键点：

- texture 按 source id 缓存，不要每帧重新创建。
- source 移除时通知 Worker 删除 texture。
- `stop()` 时调用 `WEBGL_lose_context` 释放 GPU 资源。

## Worker Canvas2D 渲染

Worker 内部职责：

- 获取 `offscreenCanvas.getContext('2d', { alpha: false })`。
- 每帧：
  - 填充背景色。
  - 对每个 frame 执行 `drawImage(frame, x, y, w, h)`。
  - `frame.close()`。

优点：

- 比主线程 2D 少占 UI 线程。
- 不依赖 GPU WebGL2。

限制：

- 性能通常不如 WebGL2。
- 某些移动端 OffscreenCanvas 2D 性能不一定稳定，需要保留主线程 2D fallback。

## Main Thread Canvas2D 兜底

这是当前 `Mixer.js` 的现有逻辑，应保留并作为最终兜底。

优势：

- 兼容性最好。
- 代码路径最稳定。
- Worker、OffscreenCanvas、WebGL2、VideoFrame、ImageBitmap 任意不可用时仍可工作。

## 音频混合

音频继续保持当前 WebAudio 架构：

```text
MediaStream
  -> MediaStreamSource
  -> GainNode
  -> MediaStreamDestination
  -> mixed stream audio track
```

不建议把音频混合放到 Worker：

- WebAudio 和 MediaStreamDestination 的兼容性、自动播放策略、设备授权都更适合留在主线程。
- 视频渲染性能瓶颈和音频混合是两个独立问题。
- 当前音频逻辑已经支持后加源、remove、gain、stop 清理。

## 生命周期

### start / getVideoStream / getMixedStream

第一次需要输出流时：

1. 初始化 renderer。
2. 启动渲染循环。
3. 调用 `canvas.captureStream(fps)`。
4. 返回视频流或混合流。

### appendStream

1. 创建 source。
2. 计算 slot。
3. 如同 slot 已存在，移除旧 source。
4. 通知 renderer source 增加或让下一帧自动感知。
5. 如果音频系统已初始化，连接音频。

### removeStream

1. 断开音频节点。
2. 释放 Mixer 自己创建的 hidden video。
3. 从 source 列表移除。
4. 通知 Worker 删除对应 texture。

### stop

1. 停止 rAF。
2. 停止 canvas captureStream tracks。
3. clearStreams。
4. renderer.destroy：
   - Worker：post `destroy`，terminate。
   - WebGL2：删除 textures，lose context。
   - Canvas2D：清空引用。
5. 关闭 AudioContext。

## Demo 改造

`demo/base-js/mixer.html` 建议增加：

- 渲染模式选择：
  - Auto
  - Worker + WebGL2
  - Worker + Canvas2D
  - Main Thread + Canvas2D
- 实时显示：
  - requested mode
  - actual mode
  - fallback reason
  - dropped frames
  - rendered frames
- 保留现有输入源控制：
  - 虚拟源
  - 摄像头
  - 屏幕共享
  - slot 选择

## 实施步骤

### 第 1 阶段：抽象现有 Canvas2D

- 将当前主线程 Canvas2D 绘制逻辑封装为 `MainCanvas2DRenderer`。
- `Mixer.js` 仍默认使用 `MainCanvas2DRenderer`。
- 保证行为完全不变。
- 跑通 lint/test/demo。

### 第 2 阶段：增加 Renderer Selector

- 增加 `renderMode` 配置。
- 增加 `_initRenderer()`。
- 增加 `getRenderInfo()`。
- 暂时只返回 `main-2d`。

### 第 3 阶段：增加 Worker Canvas2D

- 增加 worker 文件或 Blob Worker。
- 支持 OffscreenCanvas 2D。
- 实现主线程抽帧和 worker 绘制。
- 完成自动 fallback 到 `main-2d`。

### 第 4 阶段：增加 Worker WebGL2

- Worker 初始化 WebGL2。
- 实现 texture 缓存和 quad 绘制。
- 支持 source 移除时释放 texture。
- WebGL2 初始化失败自动 fallback 到 `worker-2d`。

### 第 5 阶段：性能和稳定性优化

- 实现 worker busy 丢帧策略。
- 增加 dropped/rendered frame 统计。
- 检查 `VideoFrame/ImageBitmap.close()` 是否完整。
- 检查 stop 后 Worker/GPU/track 是否释放。

### 第 6 阶段：更新 Demo 和文档

- 更新 `demo/base-js/mixer.html`。
- 增加渲染模式选择。
- 展示 `getRenderInfo()`。
- 文档说明兼容性和 fallback。

## 测试计划

### 功能测试

- 旧调用：

```js
new CRTC.Mixer([stream]).getMixedStream();
```

- 新调用：

```js
new CRTC.Mixer([], {
  width: 1280,
  height: 720,
  fps: 30,
  renderMode: 'auto'
});
```

- 验证：
  - 1 路、2 路、4 路、6 路、9 路源布局正确。
  - 横屏/竖屏输出正确。
  - slot 覆盖正确。
  - removeStream 后画面和音频都移除。
  - stop 后摄像头/屏幕源由 demo 停止，Mixer 内部资源释放。

### 降级测试

- 禁用 WebGL2，确认降到 `worker-2d`。
- 禁用 OffscreenCanvas，确认降到 `main-2d`。
- 强制 `worker-webgl2`，初始化失败时应给出 fallback reason。
- 强制 `main-2d`，不应创建 worker。

### 性能测试

- 4 路 720p 30fps。
- 6 路 720p 30fps。
- 9 路 360p/480p 30fps。
- 观察：
  - 主线程 UI 是否卡顿。
  - dropped frames。
  - 内存是否稳定。
  - GPU memory 是否释放。

### 浏览器测试

- Chrome / Edge 桌面。
- Firefox 桌面。
- Safari 桌面。
- Android Chrome。
- iOS Safari / WKWebView。

预期：

- 支持 `Worker + WebGL2` 的环境使用最高性能路径。
- 不支持时自动降级。
- 所有环境至少能落到 `main-2d`。

## 风险与处理

### 风险：OffscreenCanvas 或 WebGL2 支持不完整

处理：

- 初始化必须 try/catch。
- Worker 必须返回失败原因。
- 自动 fallback 到下一模式。

### 风险：VideoFrame 支持差异

处理：

- 优先尝试 `VideoFrame`。
- 失败后尝试 `createImageBitmap`。
- 都失败则使用 `main-2d`。

### 风险：Worker 绘制延迟累积

处理：

- 默认 `maxFrameQueue = 1`。
- Worker busy 时丢帧。
- 统计 dropped frames。

### 风险：资源泄漏

处理：

- 所有 `VideoFrame/ImageBitmap` 必须 close。
- source 删除时释放 texture。
- stop 时 terminate worker、lose WebGL context、stop captured tracks。

### 风险：CSP 禁止 Blob Worker

处理：

- 支持 `workerUrl`。
- 默认 Blob Worker 仅作为便利路径。

## 推荐结论

采用三层渲染后端：

```text
Auto:
  Worker + WebGL2
  -> Worker + Canvas2D
  -> Main Thread + Canvas2D
```

不引入 WebGL1。

这个方案在现代 WebRTC 浏览器中可以优先获得 GPU + Worker 的性能收益，同时用 Canvas2D 保证兼容性。公开 API 基本不变，风险集中在内部 renderer 抽象和 worker 生命周期，可分阶段实现和验证。
