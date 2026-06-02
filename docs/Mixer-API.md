# CRTC.Mixer API 参考

将多路 `MediaStream` / `HTMLVideoElement` 合并为单路音视频输出流的混流器。

> **外部调用入口**: `new CRTC.Mixer(videos, options)`
> **内部实现**: `lib/Mixer.js` → `lib/MixerCore/MixerController.js`（类名 `MediaStreamMixer`，构建时会被混淆）

---

## 目录

1. [快速开始](#1-快速开始)
2. [构造函数](#2-构造函数)
3. [源管理 API](#3-源管理-api)
4. [输出流 API](#4-输出流-api)
5. [音频子混音 API](#5-音频子混音-api)
6. [水印 API](#6-水印-api)
7. [镜像 API](#7-镜像-api)
8. [状态查询 API](#8-状态查询-api)
9. [生命周期 API](#9-生命周期-api)
10. [完整使用示例](#10-完整使用示例)
11. [常见问题](#11-常见问题)

---

## 1. 快速开始

```js
// 1. 创建混流器
const mixer = new CRTC.Mixer(
  [localStream, remoteStream],  // 初始输入源（可为空数组）
  { width: 1280, height: 720 } // 输出配置
);

// 2. 获取完整音视频混合流
const mixedStream = await mixer.getMixedStream();

// 3. 推送到 WebRTC
peerConnection.addTrack(mixedStream.getVideoTracks()[0], mixedStream);
peerConnection.addTrack(mixedStream.getAudioTracks()[0], mixedStream);

// 4. 用完后释放资源
mixer.stop();
```

**最小示例**（仅视频混流，不含音频）：

```js
const mixer = new CRTC.Mixer([streamA, streamB]);
const videoStream = mixer.getVideoStream(); // MediaStream，仅视频轨

// 在 <video> 元素上预览
previewVideo.srcObject = videoStream;
```

---

## 2. 构造函数

### `new CRTC.Mixer(videos, options)`

```js
const mixer = new CRTC.Mixer(
  [localStream, remoteStream],
  {
    width: 1280,
    height: 720,
    fps: 15,
    backgroundColor: '#000',
    audioGain: 0.8,
    renderMode: 'auto'
  }
);
```

#### 参数 `videos`

`MediaStream | HTMLVideoElement | Array<MediaStream|HTMLVideoElement> | { mediaStream: MediaStream }`

| 形式 | 示例 | 说明 |
|------|------|------|
| 空数组 | `[]` | 不添加初始源，通过 `appendStream()` 后续添加 |
| 单个流 | `stream` | 单个 MediaStream |
| 多个流 | `[s1, s2, s3]` | 按顺序分配 slot 0, 1, 2 |
| Video 元素 | `videoElement` | 外部 HTMLVideoElement（需 `srcObject=MediaStream`） |
| SDK 包装对象 | `{ mediaStream: s }` | CRTC SDK 内部包装格式 |

#### 参数 `options`

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `width` | `number` | `1280` | 输出视频宽度（px），非法值回退 1280 |
| `height` | `number` | `720` | 输出视频高度（px），非法值回退 720 |
| `fps` | `number` | `15` | 输出帧率，非法值回退 15 |
| `backgroundColor` | `string` | `'#000'` | 画布底色，CSS 颜色格式 |
| `audioGain` | `number` | `0.8` | 全局默认音量增益（>=0，允许 >1 放大） |
| `renderMode` | `string` | `'auto'` | 渲染后端，见下表 |
| `workerUrl` | `string` | `null` | 外部 Worker 脚本地址（默认 Blob Worker） |
| `dropFrameWhenBusy` | `boolean` | `true` | Worker 忙时丢弃中间帧 |
| `maxFrameQueue` | `number` | `1` | Worker 帧队列最大长度 |
| `preserveDrawingBuffer` | `boolean` | `true` | WebGL 保留绘图缓冲 |
| `mirrorX` | `boolean` | `false` | 全局水平镜像（兼容别名 `mirror`） |
| `outputMirrorX` | `boolean` | `false` | 最终合成输出整体水平镜像 |
| `mirrorWatermarksWithOutput` | `boolean` | `false` | 输出镜像时水印是否跟随镜像 |
| `enableInsertable` | `boolean` | `false` | 启用 Insertable Streams 输出（实验性） |
| `manualCaptureFrameControl` | `boolean` | `true` | 启用 `captureStream(0)+requestFrame` 手动出帧 |
| `watermarks` | `Array<Object>` | `[]` | 初始水印配置（支持文字和图片） |

#### `renderMode` 可选值

| 值 | 执行环境 | 绘制 API | 说明 |
|----|----------|----------|------|
| `'auto'` | 自动 | 自动 | **默认**，自动选择最优后端 |
| `'worker-webgl2'` | Worker | WebGL2 | 性能最优，不阻塞主线程 |
| `'worker-2d'` | Worker | Canvas2D | Worker 环境 Canvas2D 渲染 |
| `'main-webgl2'` | 主线程 | WebGL2 | Safari/WKWebView 推荐 |
| `'main-2d'` | 主线程 | Canvas2D | 兼容性兜底 |

**降级链**: `auto` 模式下，先尝试 `worker-webgl2` → 失败则 `main-webgl2` → 失败则 `worker-2d` → 最终兜底 `main-2d`。

---

## 3. 源管理 API

### `appendStream(videos, optionsOrSlot?)`

添加输入源到混流器。

```js
// 方式 1：自动分配 slot
mixer.appendStream(stream);

// 方式 2：指定 slot（数字）
mixer.appendStream(stream, 3);

// 方式 3：配置对象（slot + gain + mirrorX）
mixer.appendStream(stream, { slot: 2, gain: 0.5, mirrorX: true });

// 方式 4：批量添加
mixer.appendStream([streamA, streamB, streamC]);
// slot 自动递增：0, 1, 2

// 方式 5：批量 + 指定起始 slot
mixer.appendStream([streamA, streamB], 3);
// streamA → slot 3, streamB → slot 4
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `videos` | `*` | 同构造函数；**此参数必传** |
| `optionsOrSlot` | `number\|Object` | slot 数字或 `{ slot, gain, mirrorX }` 对象 |

| 返回值 | 说明 |
|--------|------|
| `boolean` | `true`=至少成功添加了一个源 |

**规则**:
- 同 slot 已有源会被**覆盖**（旧源自动移除）
- 最多 **9 路** 源（`MAX_SOURCES`），超出部分被截断并打印 warn
- `stop()` 后调用会抛出 `Error`

### `removeStream(streamOrId)`

移除一路输入源。

```js
// 按 MediaStream 对象移除
mixer.removeStream(remoteStream);

// 按 stream.id 移除
mixer.removeStream('stream-abc-123');

// 按 source.id 移除
mixer.removeStream(source.id);
```

| 返回值 | 说明 |
|--------|------|
| `boolean` | `true`=找到并移除成功 |

### `clearStreams()`

移除所有输入源。不清除水印或配置，后续仍可通过 `appendStream()` 添加新源。

```js
mixer.clearStreams();
```

### `getSources()`

返回当前所有源的只读快照。

```js
const sources = mixer.getSources();
// [
//   { id: 'stream-1', streamId: 'abc', slot: 0, gain: 0.8, mirrorX: false, hasAudio: true, hasVideo: true },
//   { id: 'stream-2', streamId: 'def', slot: 1, gain: 0.5, mirrorX: true,  hasAudio: false, hasVideo: true }
// ]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 内部 source ID（基于 stream.id 去重生成） |
| `streamId` | `string` | 原始 MediaStream.id |
| `slot` | `number` | 网格槽位编号 |
| `gain` | `number` | 该路音量增益 |
| `mirrorX` | `boolean` | 该路是否水平镜像 |
| `hasAudio` | `boolean` | 是否有活跃音频轨 |
| `hasVideo` | `boolean` | 是否有视频轨 |

---

## 4. 输出流 API

### `getMixedStream()`

获取包含视频轨和音频轨的完整混合流。**async 方法**。

```js
const mixedStream = await mixer.getMixedStream();

// 可直接用于 WebRTC
peerConnection.addTrack(mixedStream.getVideoTracks()[0], mixedStream);
peerConnection.addTrack(mixedStream.getAudioTracks()[0], mixedStream);

// 或用于本地预览
previewVideo.srcObject = mixedStream;
```

| 返回值 | 说明 |
|--------|------|
| `Promise<MediaStream>` | 包含视频轨和音频轨的混合流 |

**内部流程**:
1. `getVideoStream()` → 启动帧循环 + `canvas.captureStream(fps)`
2. `getAudioStream()` → 初始化 AudioContext + 连接所有源
3. 将音频轨注入视频流 → 返回完整流

**注意**: 如果调用时还没有音频源，后续通过 `appendStream()` 添加有音频的源时，音频轨会自动注入到已返回的流中。

### `getVideoStream()`

仅获取混合后的视频流（不含音频）。**同步方法**。

```js
const videoStream = mixer.getVideoStream(); // MediaStream（仅视频轨）

previewVideo.srcObject = videoStream;
```

| 返回值 | 说明 |
|--------|------|
| `MediaStream` | 仅包含视频轨的流 |

**注意**: 多次调用返回同一个 `MediaStream` 实例（通过 `canvas.captureStream()` 创建）。调用后自动启动 rAF 帧循环。

### `getAudioStream(options?)`

获取混合后的音频流。**async 方法**。

```js
// 全量混音（所有源）
const audioStream = await mixer.getAudioStream();

// 指定槽位子混音（只混 slot 0 和 2 的音频）
const submixStream = await mixer.getAudioStream({ slots: [0, 2] });

// isolated 子混音（独立 AudioContext，各子混音互不影响）
const isolatedStream = await mixer.getAudioStream({ slots: [0, 1], isolated: true });
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `options` | `undefined` | 不传 = 全量混音 |
| `options.slots` | `number[]` | 子混音槽位列表 |
| `options.isolated` | `boolean` | 是否使用独立 AudioContext（子混音必须选一个） |

| 返回值 | 说明 |
|--------|------|
| `Promise<MediaStream\|null>` | 音频流；无 live 音频源时返回 `null` |

---

## 5. 音频子混音 API

### `getIsolatedSubmixAudioStream(options)`

获取使用独立 AudioContext 的子混音音频流。与默认混音完全隔离。

```js
const submix = await mixer.getIsolatedSubmixAudioStream({ slots: [0, 2] });
// 或直接传数组
const submix = await mixer.getIsolatedSubmixAudioStream([0, 2]);
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `options` | `number[]` 或 `{ slots: number[] }` | 槽位列表 |

| 返回值 | 说明 |
|--------|------|
| `Promise<MediaStream\|null>` | 独立子混音音频流；参数无效或无源时返回 `null` |

### `releaseSubmixAudioStream(options)`

释放指定槽位的子混音及关联资源。

```js
// 释放 isolated 子混音
mixer.releaseSubmixAudioStream({ slots: [0, 2], isolated: true });

// 释放普通子混音 bus
mixer.releaseSubmixAudioStream({ slots: [1, 3] });
```

| 返回值 | 说明 |
|--------|------|
| `boolean` | `true`=成功释放 |

---

## 6. 水印 API

### `setWatermarks(watermarks)`

替换全部水印配置。**async 方法**（图片 URL 需异步加载）。

```js
const watermarks = await mixer.setWatermarks([
  // 文字水印 - 输出级
  { id: 'brand', target: 'output', type: 'text', text: 'CRTC', position: 'bottom-right' },

  // 文字水印 - 源级（每路指定 slot 的源上叠加）
  { id: 'name-tag', target: 'source', slot: 0, type: 'text', text: 'Host', position: 'bottom-left' },

  // 图片水印 - 输出级
  { id: 'logo', target: 'output', type: 'image', image: logoImg, position: { x: 24, y: 24 } },

  // 图片水印 - 按 streamId 匹配
  { id: 'badge', target: 'source', streamId: 'abc-123', type: 'image', image: badgeImg, position: 'top-right' }
]);
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `watermarks` | `Array<Object>\|Object\|null` | 水印配置；`null` 清除全部 |

| 返回值 | 说明 |
|--------|------|
| `Promise<Array<Object>>` | 当前水印状态快照（含 `status`/`reason` 字段） |

#### 水印对象字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | `string` | — | **必传**，唯一标识 |
| `target` | `string` | `'output'` | `'output'`=全局 / `'source'`=每路源 |
| `type` | `string` | `'text'` | `'text'` 或 `'image'`（传 `image` 字段时自动判定） |
| `text` | `string` | — | 文字水印内容（type='text' 时） |
| `image` | `*` | — | 图片：URL / `HTMLImageElement` / `HTMLCanvasElement` / `ImageBitmap` |
| `slot` | `number` | — | source 水印匹配：槽位编号 |
| `sourceId` | `string` | — | source 水印匹配：内部 source ID（优先级最高） |
| `streamId` | `string` | — | source 水印匹配：MediaStream.id |
| `position` | `string\|Object` | `'bottom-right'` | 预设位置或 `{ x, y }` 坐标 |
| `width` | `number` | — | 水印宽度（px） |
| `height` | `number` | — | 水印高度（px） |
| `font` | `string` | — | 字体 |
| `fontSize` | `number` | — | 字号（px） |
| `color` | `string` | — | 文字颜色 |
| `backgroundColor` | `string` | — | 文字底框色 |
| `opacity` | `number` | — | 透明度（0-1） |
| `padding` | `number` | — | 内边距 |
| `margin` | `number` | — | 外边距 |

**预设位置**: `'top-left'`, `'top-center'`, `'top-right'`, `'center'`, `'bottom-left'`, `'bottom-center'`, `'bottom-right'`

### `clearWatermarks(filter?)`

按条件清除水印。

```js
// 清除所有
mixer.clearWatermarks();

// 按 target 清除
mixer.clearWatermarks({ target: 'output' });

// 按 target + slot 清除
mixer.clearWatermarks({ target: 'source', slot: 0 });

// 按 id 清除
mixer.clearWatermarks({ id: 'brand' });

// 按 streamId 清除
mixer.clearWatermarks({ streamId: 'abc-123' });
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `filter` | `Object` | `{ id?, target?, slot?, sourceId?, streamId? }` |

### `getWatermarks()`

获取当前水印状态快照。

```js
const watermarks = mixer.getWatermarks();
// [{ id: 'brand', target: 'output', type: 'text', text: 'CRTC', status: 'ready', ... }]
```

---

## 7. 镜像 API

### `setGlobalMirror(enabled)` / `getGlobalMirror()`

设置/获取全局水平镜像。

```js
// 开启全局镜像
mixer.setGlobalMirror(true);

// 查询状态
const isMirrored = mixer.getGlobalMirror(); // true
```

- `setGlobalMirror(enabled)`: `enabled` — `boolean`
- `getGlobalMirror()`: 返回 `boolean`
- 兼容别名: `setMirror(enabled)` = `setGlobalMirror(enabled)`
- 全局镜像开启时自动强制使用主线程渲染

### `setSlotMirror(slot, enabled)` / `clearSlotMirror(slot)` / `getSlotMirrors()`

设置/清除/查询单个槽位的镜像覆盖。

```js
// slot 0 开启镜像（覆盖全局设置）
mixer.setSlotMirror(0, true);

// slot 0 恢复跟随全局
mixer.clearSlotMirror(0);

// 查询所有槽位覆盖
const overrides = mixer.getSlotMirrors(); // { "0": true }
```

### `setOutputMirror(enabled)` / `getOutputMirror()`

设置/获取最终合成输出的整体镜像。

```js
// 最终输出整体镜像
mixer.setOutputMirror(true);

const isOutputMirrored = mixer.getOutputMirror(); // true
```

### `setMirrorWatermarksWithOutput(enabled)` / `getMirrorWatermarksWithOutput()`

设置/获取输出镜像时水印是否跟随镜像。

```js
// 输出镜像时水印也镜像
mixer.setMirrorWatermarksWithOutput(true);

const mirrorWatermarks = mixer.getMirrorWatermarksWithOutput(); // true
```

---

## 8. 状态查询 API

### `getRenderInfo()`

返回渲染后端运行状态快照。

```js
const info = mixer.getRenderInfo();
// {
//   requestedMode: 'auto',        // 请求的渲染模式
//   actualMode: 'worker-webgl2',  // 实际使用的渲染模式
//   isWorker: true,               // 是否运行在 Worker 线程
//   isWebGL2: true,               // 是否使用 WebGL2
//   isFallback: false,            // 是否已降级
//   reason: '',                   // 降级原因
//   renderedFrames: 150,          // 已渲染帧数
//   droppedFrames: 3,             // 丢弃帧数
//   fps: 15,                      // 实际帧率
//   width: 1280,                  // 输出宽度
//   height: 720,                  // 输出高度
//   outputMode: 'captureStream',  // 输出模式
//   insertableActive: false,      // Insertable 是否激活
//   insertableSupported: false,   // Insertable 是否支持
//   captureFrameControlMode: 'manual' // captureStream 帧控制模式
// }
```

### `getAudioInfo()`

返回音频混流状态快照。

```js
const info = mixer.getAudioInfo();
// {
//   requested: true,           // 是否已请求音频
//   status: 'mixing',          // 'not-requested' | 'requested' | 'ready' | 'mixing' | 'no-source' | 'failed' | 'stopped'
//   contextState: 'running',   // AudioContext.state
//   sourceCount: 3,            // 总源数
//   liveSourceCount: 2,        // 有活跃音频轨的源数
//   connectedSources: 2,       // 已连接的源数
//   outputTracks: 1            // 输出音频轨数
// }
```

### `getSources()`

返回源列表快照。详见 [3. 源管理 API](#getSources)。

### `getWatermarks()`

返回水印快照。详见 [6. 水印 API](#getWatermarks)。

---

## 9. 生命周期 API

### `stop()`

释放所有资源，停止混流器。调用后实例不再可用。

```js
mixer.stop();
// 之后调用任何其他方法都会抛出 Error:
// "MediaStreamMixer has been stopped. Create a new mixer before calling ..."
```

**清理内容**:
1. `cancelAnimationFrame` — 停止帧循环
2. `clearStreams()` — 移除所有源（断开音频、释放 video 元素）
3. `AudioMixer.stop()` — 断开并关闭 AudioContext
4. `RenderLoop.destroy()` — 销毁渲染器
5. `OutputStreamManager.stop()` — 停止所有输出 track

**重要**: `stop()` 后必须 `new CRTC.Mixer()` 创建新实例才能继续使用。

---

## 10. 完整使用示例

### 示例 1：基础 WebRTC 推流

```js
async function startMixingAndPush() {
  const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });

  // 创建混流器：本地摄像头在 slot 0，屏幕共享在 slot 1
  const mixer = new CRTC.Mixer([localStream, screenStream], {
    width: 1280,
    height: 720,
    fps: 15,
    backgroundColor: '#1a1a2e',
    audioGain: 0.8,
    renderMode: 'auto',
    watermarks: [
      { id: 'brand', target: 'output', type: 'text', text: 'My App', position: 'top-right', opacity: 0.7 }
    ]
  });

  // 获取完整混流
  const mixedStream = await mixer.getMixedStream();

  // 推送到 WebRTC
  const pc = new RTCPeerConnection();
  mixedStream.getTracks().forEach(track => pc.addTrack(track, mixedStream));

  return { mixer, pc, mixedStream };
}
```

### 示例 2：动态增删源

```js
const mixer = new CRTC.Mixer([], { width: 1280, height: 720 });

// 先获取视频输出（此时无源，显示背景色）
const previewStream = mixer.getVideoStream();
previewVideo.srcObject = previewStream;

// 动态添加源
const stream1 = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
mixer.appendStream(stream1, 0); // slot 0

// 添加第二个源，指定音量
const stream2 = await getRemoteStream();
mixer.appendStream(stream2, { slot: 1, gain: 0.5 }); // slot 1，50% 音量

// 查看当前源
console.log(mixer.getSources());
// [{ slot: 0, ... }, { slot: 1, ... }]

// 移除某个源
mixer.removeStream(stream1.id);

// 添加第三个源，覆盖 slot 0
const stream3 = await getAnotherStream();
mixer.appendStream(stream3, 0);
// stream3 替换了 stream1，slot 布局自动更新
```

### 示例 3：多路源镜像控制

```js
const mixer = new CRTC.Mixer([localStream, remoteStream], {
  width: 1280,
  height: 720,
  mirrorX: false // 默认不镜像
});

// 仅 slot 0（本地摄像头）镜像
mixer.setSlotMirror(0, true);

// slot 1（远端）不镜像（跟随全局）
// getSlotMirrors() → { "0": true }

// 检查最终镜像状态
console.log('Global mirror:', mixer.getGlobalMirror());  // false
console.log('Slot mirrors:', mixer.getSlotMirrors());    // { "0": true }
```

### 示例 4：水印管理

```js
const mixer = new CRTC.Mixer([], {
  width: 1280,
  height: 720,
  watermarks: [
    { id: 'title', target: 'output', type: 'text', text: 'Live', position: 'top-center', fontSize: 32, color: '#fff' }
  ]
});

const logoImg = new Image();
logoImg.src = '/logo.png';
await logoImg.decode();

// 追加水印（替换全部）
await mixer.setWatermarks([
  { id: 'title', target: 'output', type: 'text', text: 'Live', position: 'top-center' },
  { id: 'logo', target: 'output', type: 'image', image: logoImg, position: { x: 24, y: 24 }, width: 120 }
]);

// 检查水印状态
const watermarks = mixer.getWatermarks();
watermarks.forEach(w => console.log(`${w.id}: ${w.status}`)); // 'ready' | 'loading' | 'failed'

// 清除输出级水印
mixer.clearWatermarks({ target: 'output' });

// 添加源级水印
mixer.appendStream(streamA, 0);
await mixer.setWatermarks([
  { id: 'host-badge', target: 'source', slot: 0, type: 'text', text: 'Host', position: 'bottom-left' }
]);
```

### 示例 5：独立子混音（监听场景）

```js
const mixer = new CRTC.Mixer([streamA, streamB, streamC], { width: 1280, height: 720 });
const mixedStream = await mixer.getMixedStream(); // 主输出

// 单独监听 slot 0 和 1 的音频（不影响主输出）
const monitorStream = await mixer.getIsolatedSubmixAudioStream([0, 1]);
monitorAudio.srcObject = monitorStream;

// 监听完毕后释放
mixer.releaseSubmixAudioStream({ slots: [0, 1], isolated: true });
```

### 示例 6：监控渲染状态

```js
function monitorMixerHealth(mixer) {
  const renderInfo = mixer.getRenderInfo();
  const audioInfo = mixer.getAudioInfo();

  // 渲染降级告警
  if (renderInfo.isFallback) {
    console.warn(`渲染器已降级: ${renderInfo.actualMode}, 原因: ${renderInfo.reason}`);
  }

  // 丢帧率告警
  const totalFrames = renderInfo.renderedFrames + renderInfo.droppedFrames;
  if (totalFrames > 100 && renderInfo.droppedFrames / totalFrames > 0.1) {
    console.warn(`丢帧率过高: ${Math.round(renderInfo.droppedFrames / totalFrames * 100)}%`);
  }

  // 音频异常
  if (audioInfo.status === 'failed') {
    console.error('音频混流出错:', audioInfo.lastError);
  }

  return { renderInfo, audioInfo };
}

// 定时监控
setInterval(() => monitorMixerHealth(mixer), 5000);
```

---

## 11. 常见问题

### Q: `stop()` 后能复用吗？

**不能**。`stop()` 后实例即销毁，调用任何方法都会抛出 `Error`。需要 `new CRTC.Mixer()` 创建新实例。

### Q: 最多支持多少路输入源？

**9 路**（`MAX_SOURCES = 9`）。超出部分会被静默截断并打印 warn。

### Q: `getVideoStream()` 和 `getMixedStream()` 的区别？

- `getVideoStream()` — 同步，仅返回视频轨
- `getMixedStream()` — async，返回视频轨 + 音频轨

通常：
- 预览用 `getVideoStream()`（不需要音频）
- 推流用 `getMixedStream()`（需要完整音视频）

### Q: 什么时候 AudioContext 初始化？

**延迟初始化**。只有在以下情况才会创建 AudioContext：
1. 调用 `getAudioStream()`
2. 调用 `getMixedStream()`（内部调用了 `getAudioStream()`）

这避免了浏览器自动播放策略的限制。

### Q: 镜像为什么强制主线程渲染？

Worker 线程的 OffscreenCanvas 上 `drawImage()` 的翻转在某些浏览器上不可靠，因此当任何镜像模式开启时，系统自动切换为主线程渲染。

### Q: 如何选择渲染后端？

- 默认 `'auto'` 即可，大多数场景不需要手动指定
- Chrome/Edge 会优先使用 Worker WebGL2（性能最好）
- Safari 自动降级到主线程 WebGL2
- 如果遇到渲染异常，可以通过 `getRenderInfo().actualMode` 查看实际使用的后端
- 如需调试，手动指定 `'main-2d'` 排除渲染后端问题

### Q: 如何在无音频源时获取输出流？

使用 `getVideoStream()` 而不是 `getMixedStream()`。`getMixedStream()` 会尝试初始化音频系统，如果没有音频源会返回不含音频轨的流，但初始化本身有开销。
