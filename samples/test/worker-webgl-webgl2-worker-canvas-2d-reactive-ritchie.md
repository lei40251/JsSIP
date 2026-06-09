# MediaStreamComposer 渲染后端升级方案（融合版）

融合自 `docs/media-stream-composer-renderer-upgrade-plan.md`（架构/API/Worker 设计）与 `claude-code` 计划（主线程 WebGL2 / shader 实现细节）。

## 背景

当前 `lib/MediaStreamComposer.js` 使用主线程 Canvas 2D 完成视频混合。多路高分辨率视频时主线程负载高，影响页面交互。

目标：引入可插拔渲染后端，优先使用 `Worker + WebGL2`，在不支持时自动降级，Safari 用户也能走 WebGL2 加速。

## 渲染模式

| 模式 | 说明 | 适用场景 |
| --- | --- | --- |
| `worker-webgl2` | Worker + OffscreenCanvas + WebGL2 | Chrome/Firefox 主路径（GPU + 离主线程） |
| `main-webgl2` | 主线程 Canvas + WebGL2 | Safari / CSP 禁止 Worker / Worker 初始化失败（GPU，主线程） |
| `worker-2d` | Worker + OffscreenCanvas + Canvas 2D | WebGL2 不可用时离主线程降级 |
| `main-2d` | 主线程 Canvas 2D | 最终兜底 |

默认 `renderMode: 'auto'` 时按以下顺序尝试：

```
worker-webgl2 → main-webgl2 → worker-2d → main-2d
```

- `worker-webgl2`：Chrome/Firefox 走此路径（GPU + Worker 双收益）
- `main-webgl2`：Safari 因不支持 Worker 内 WebGL，自动落到此路径（仍享 GPU 加速）
- `worker-2d`：WebGL2 全部不可用但 Worker + OffscreenCanvas 可用（解放主线程）
- `main-2d`：什么都不支持时的保底

不引入 WebGL1（目标环境是支持 WebRTC 的现代浏览器，WebGL2 覆盖率已足够高）。

## 新增配置

```js
const mixer = new CRTC.MediaStreamComposer([], {
  width: 1280, height: 720, fps: 30,

  // auto | worker-webgl2 | main-webgl2 | worker-2d | main-2d
  renderMode: 'auto',

  // CSP 严格环境可指定外部 worker 脚本路径
  workerUrl: './mixer.worker.js',

  // worker 忙时丢帧策略
  dropFrameWhenBusy: true,
  maxFrameQueue: 1
});
```

## 新增只读 API

```js
const info = mixer.getRenderInfo();
// {
//   requestedMode: 'auto',
//   actualMode: 'main-webgl2',    // 实际生效的模式
//   isWorker: false,
//   isWebGL2: true,
//   isFallback: false,
//   reason: 'Worker WebGL2 not available in this browser',
//   droppedFrames: 0,
//   renderedFrames: 300,
//   fps: 30,
//   width: 1280,
//   height: 720
// }
```

## 架构

### MediaStreamComposer 职责不变

- 输入源管理（`appendStream/removeStream/clearStreams/getSources`）
- 布局计算（slot / rows / cols / `_scaleVideo`）
- 音频混音（WebAudio，保持主线程）
- 渲染后端选择和生命周期管理

### Renderer 抽象

```
BaseRenderer (interface)
  ├── MainCanvas2DRenderer    // 现有逻辑抽取，最终兜底
  ├── MainWebGL2Renderer      // 新增：主线程 WebGL2（覆盖 Safari）
  ├── WorkerCanvas2DRenderer  // 新增：Worker + OffscreenCanvas 2D
  └── WorkerWebGL2Renderer    // 新增：Worker + OffscreenCanvas WebGL2（主路径）
```

```js
class BaseRenderer {
  async init(canvas, config) {}  // 返回 { success, mode, reason }
  render(framePayload) {}        // 每帧调用
  resize(width, height) {}
  addSource(sourceId) {}         // 可选：预分配 texture
  removeSource(sourceId) {}      // 可选：释放 texture
  destroy() {}
  getInfo() {}
}
```

### Renderer 选择器

```js
async _initRenderer() {
  // 1. 用户强制指定
  if (renderMode === 'worker-webgl2') try WorkerWebGL2Renderer
  if (renderMode === 'main-webgl2')   try MainWebGL2Renderer
  if (renderMode === 'worker-2d')     try WorkerCanvas2DRenderer
  if (renderMode === 'main-2d')       use MainCanvas2DRenderer

  // 2. auto 模式按优先级尝试
  try WorkerWebGL2Renderer      // Chrome/Firefox 首选
  try MainWebGL2Renderer         // Safari / CSP 等
  try WorkerCanvas2DRenderer     // Worker 可用但无 WebGL2
  use MainCanvas2DRenderer        // 终极兜底
}
```

## 关键实现细节

### 两种 WebGL2 Renderer 的 shader 设计

Worker 和 Main thread 的 WebGL2 着色器完全一致：

**Vertex Shader (GLSL 300 es)**：
```glsl
#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
```

**Fragment Shader (GLSL 300 es)**：
```glsl
#version 300 es
precision highp float;
in vec2 v_texCoord;
out vec4 outColor;
uniform sampler2D u_texture;
void main() {
  outColor = texture(u_texture, v_texCoord);
}
```

**纹理上传**（共用逻辑）：
```js
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
```

**每源渲染**（per-source viewport）：
```js
// Y 轴转换：canvas Y=0 顶部 → WebGL viewport Y=0 底部
const vpY = canvasHeight - renderRect.y - renderRect.h;
gl.viewport(renderRect.x, vpY, renderRect.w, renderRect.h);
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
```

**critical**: `captureStream()` 需要 `preserveDrawingBuffer: true`

### MainWebGL2Renderer 特殊说明

- `canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' })`
- 每帧直接 `texImage2D(..., video)` — 零拷贝 GPU 上传，无帧抽取开销
- 这是对比 Worker WebGL2 的核心优势：Worker 路径需要 `createImageBitmap(video)` 抽帧，有额外 CPU 开销和延迟

### Worker 帧抽取策略

Worker WebGL2 / Worker Canvas2D 需要从主线程抽帧发送：

```
VideoFrame(video)  →  transferable，零拷贝
  fallback:
createImageBitmap(video)  →  transferable，有拷贝
  fallback:
降级到 main-2d
```

### Worker 丢帧策略

```js
// 主线程
if (dropFrameWhenBusy && workerBusy) {
  droppedFrames++;
  return; // 跳过本帧
}
workerBusy = true;
worker.postMessage({ type: 'render', frames, layout }, [transfers]);

// Worker 渲染完成后回复
worker.onmessage = (e) => {
  if (e.data.type === 'rendered') {
    workerBusy = false;
    // close 掉所有 VideoFrame/ImageBitmap
  }
};
```

### 能力检测

```js
// Worker + OffscreenCanvas
supportsWorker = typeof Worker !== 'undefined'
  && typeof OffscreenCanvas !== 'undefined'
  && typeof canvas.transferControlToOffscreen !== 'undefined';

// Worker 内 WebGL2（需在 Worker 内检测）
// 检测方法：new OffscreenCanvas(1,1).getContext('webgl2', ...)

// 主线程 WebGL2（由 MainWebGL2Renderer constructor try/catch）
```

## 文件结构

```
lib/
  MediaStreamComposer.js                              (修改 ~60 行)
  Renderers/
    BaseRenderer.js                      (接口定义 ~60 行)
    RendererFactory.js                   (选择器 ~60 行)
    MainCanvas2DRenderer.js              (现有逻辑抽取 ~100 行)
    MainWebGL2Renderer.js                (新增 ~200 行)
    WorkerCanvas2DRenderer.js            (新增 ~120 行)
    WorkerWebGL2Renderer.js              (新增 ~250 行)
    helpers/
      glHelpers.js                       (compileShader/createProgram ~50 行)
      frameUtils.js                      (抽帧: VideoFrame/createImageBitmap ~40 行)
    mixer.worker.js                      (Worker 内渲染入口 ~80 行)
```

总计新增 ~960 行，修改 MediaStreamComposer.js ~60 行。

## 实施步骤

### 第 1 阶段：Renderer 抽象 + MainCanvas2DRenderer

- 定义 `BaseRenderer` 接口
- 将当前 Canvas2D 绘制逻辑抽取为 `MainCanvas2DRenderer`
- 增加 `_initRenderer()` 和 `getRenderInfo()`
- MediaStreamComposer.js 默认使用 `MainCanvas2DRenderer`，行为完全不变
- 跑通 lint/test/demo

### 第 2 阶段：MainWebGL2Renderer

- 实现主线程 WebGL2 渲染
- 支持 `main-webgl2` 模式，auto 模式中作为第二优先
- 这样 Safari 用户先享受 GPU 加速
- 验证降级：`main-webgl2` → `main-2d`

### 第 3 阶段：Worker Canvas2D

- 实现 `mixer.worker.js`（Blob Worker + 外部 workerUrl 双模式）
- 实现 `WorkerCanvas2DRenderer`
- 实现帧抽取（`createImageBitmap`）
- 实现丢帧策略

### 第 4 阶段：Worker WebGL2

- Worker 内初始化 WebGL2
- 实现 texture 缓存和 quad 绘制
- source 移除时通知 Worker 释放 texture
- 验证降级链：`worker-webgl2` → `main-webgl2` → `worker-2d` → `main-2d`

### 第 5 阶段：Demo + 文档

- 更新 `demo/base-js/mixer.html`
- 增加渲染模式选择 + `getRenderInfo()` 显示
- 文档说明兼容性和 fallback

## 验证

- 1/2/4/6/9 路布局正确
- 横屏/竖屏正确
- slot 覆盖正确
- removeStream 后画面/音频/纹理全释放
- stop 后资源全释放
- 降级链每层可验证（DevTools 模拟各能力缺失）
- 4 路 720p 30fps 主线程不卡顿
