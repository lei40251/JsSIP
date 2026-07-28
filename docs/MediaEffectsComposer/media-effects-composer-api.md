# CRTC.MediaEffectsComposer API 参考

将多路 `MediaStream` / `HTMLVideoElement` 合并为单路音视频输出流的混流器。

---

## 目录

1. [快速开始](#1-快速开始)
2. [构造函数](#2-构造函数)
3. [新公共 API](#3-新公共-api)
4. [兼容旧 API 映射](#4-兼容旧-api-映射)
5. [完整使用示例](#5-完整使用示例)
6. [常见问题](#6-常见问题)

---

## 1. 快速开始

```js
// 1. 创建混流器
const composer = new CRTC.MediaEffectsComposer(
  [localStream, remoteStream],
  { width: 1280, height: 720, fps: 15 }
);

// 2. 获取完整音视频输出
const mixedStream = await composer.getOutput({ type: 'mixed' });

// 3. 推送到 WebRTC
mixedStream.getTracks().forEach((track) => {
  peerConnection.addTrack(track, mixedStream);
});

// 4. 结束时销毁
composer.stop();
```

**仅视频预览：**

```js
const composer = new CRTC.MediaEffectsComposer([streamA, streamB]);
const previewStream = await composer.getOutput({ type: 'video' });
previewVideo.srcObject = previewStream;
```

**旧写法兼容：**

```js
const previewStream = composer.getVideoStream();      // 兼容保留，同步
const mixedStream = await composer.getMixedStream();  // 兼容保留
```

---

## 2. 构造函数

### `new CRTC.MediaEffectsComposer(videos, options)`

```js
const composer = new CRTC.MediaEffectsComposer(
  [localStream, remoteStream],
  {
    width: 1280,
    height: 720,
    fps: 15,
    backgroundColor: '#000',
    sourceMirror: false,
    mirror: false,
    mirrorWatermarks: false,
    watermarks: []
  }
);
```

给首路源直接挂虚拟背景：

```js
const composer = new CRTC.MediaEffectsComposer(localStream, {
  width: 1280,
  height: 720,
  sources: [
    {
      aiBackground: {
        enabled: true,
        mode: 'blur',
        blurRadius: 16
      }
    }
  ]
});
```

#### 参数 `videos`

`MediaStream | HTMLVideoElement | Array<MediaStream|HTMLVideoElement>`

| 形式 | 示例 | 说明 |
|------|------|------|
| 空数组 | `[]` | 不添加初始源，后续通过 `addSource()` 添加 |
| 单个流 | `stream` | 单个 `MediaStream` |
| 多个流 | `[s1, s2, s3]` | 按顺序分配 slot 0, 1, 2 |
| Video 元素 | `videoElement` | 外部 `HTMLVideoElement`，需 `srcObject=MediaStream` |

#### 参数 `options`

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `width` | `number` | `1280` | 输出视频宽度（px） |
| `height` | `number` | `720` | 输出视频高度（px） |
| `fps` | `number` | `15`（安卓微信/鸿蒙下默认 `60`） | 输出帧率 |
| `backgroundColor` | `string` | `'#000'` | 画布底色 |
| `audioGain` | `number` | `0.8` | 全局默认音量增益 |
| `renderMode` | `string` | `'auto'` | 渲染后端。`auto` 创建期按 `worker-webgl2 → main-webgl2 → main-2d` 尝试，运行期降级链为 `worker-webgl2 → main-webgl2 → worker-2d → main-2d` |
| `workerUrl` | `string \| null` | `null` | 外部 Worker 脚本地址；不传时默认走 Blob Worker |
| `dropBusyFrames` | `boolean` | `true` | Worker 忙时是否丢弃当前帧，避免延迟累积 |
| `maxFrameQueue` | `number` | `1` | 预留帧队列长度，当前默认只保留 1 帧 |
| `insertable` | `boolean` | `false` | 是否优先使用 Insertable Streams 导出视频 |
| `manualFrameControl` | `boolean` | `true` | captureStream 路径下是否优先使用 `captureStream(0)+requestFrame` |
| `sourceMirror` | `boolean` | `false` | 所有源默认镜像，属于源级处理，发生在布局进入最终输出前 |
| `mirror` | `boolean` | `false` | 构造期整体输出镜像，影响最终合成输出流，不等同于本地预览 CSS 镜像 |
| `mirrorWatermarks` | `boolean` | `false` | 当整体输出镜像开启时，输出级水印是否跟随一起翻转 |
| `watermarks` | `Array<Object>` | `[]` | 初始水印配置 |
| `keepDrawingBuffer` | `boolean` | `true` | 是否保留 WebGL 绘图缓冲，用于 `toDataURL` 截图等场景 |
| `sources` | `Array<Object> \| null` | `null` | 初始源配置数组，按输入源顺序对应，如 `sourceMirror`、`aiBackground` |

镜像语义建议按这 4 层理解：

- 本地预览镜像：通常只是页面层 `video` 的 CSS 效果，不属于 `MediaEffectsComposer`
- 源级镜像：`sourceMirror` / `setSourceMirror()`，对某一路输入源做镜像
- 合成输出镜像：`mirror` / `setMirror()`，对最终输出画面做整体镜像
- 水印跟随输出镜像：`mirrorWatermarks`，仅控制输出级水印是否跟着整体翻转

---

## 3. 新公共 API

### `addSource(videos, optionsOrSlot?)`

添加输入源。

```js
composer.addSource(stream);
composer.addSource(stream, 2);
composer.addSource(stream, { slot: 1, gain: 0.5, sourceMirror: true });
composer.addSource(stream, {
  slot: 0,
  aiBackground: {
    enabled: true,
    mode: 'blur',
    blurRadius: 16
  }
});
composer.addSource([streamA, streamB], 3);
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `videos` | `MediaStream \| HTMLVideoElement \| Array` | 必传 |
| `optionsOrSlot` | `number \| Object` | `slot` 或 `{ slot, gain, sourceMirror, aiBackground }` |

| 返回值 | 说明 |
|--------|------|
| `boolean` | `true` 表示至少成功添加了一路 |

规则：
- 同 slot 已有源时会被覆盖
- 最多支持 9 路源
- `stop()` 后调用会抛出 `Error`

**旧写法兼容：**

```js
composer.appendStream(stream, 2);
```

### `setAiBackground(slotOrTarget, options)`

给某一路源开启或更新虚拟背景。

```js
composer.setAiBackground(0, {
  enabled: true,
  mode: 'image',
  imageUrl: '/assets/bg.png'
});
```

### `getAiBackground(slotOrTarget)`

读取某一路源当前的虚拟背景配置快照。

```js
const effect = composer.getAiBackground(0);
```

### `clearAiBackground(slotOrTarget)`

清除某一路源的虚拟背景效果。

```js
composer.clearAiBackground(0);
```

### `removeSource(target)`

移除一路输入源。

```js
composer.removeSource(stream);
composer.removeSource(videoElement);
composer.removeSource(stream.id);
composer.removeSource(source.id);
```

| 返回值 | 说明 |
|--------|------|
| `boolean` | `true` 表示找到并移除成功 |

说明：
- 不传参数时不会自动清空全部源
- 批量清空请使用 `clearSources()`

**旧写法兼容：**

```js
composer.removeStream(stream.id);
```

### `clearSources()`

移除全部输入源。

```js
composer.clearSources();
```

说明：
- 只清空源，不重置镜像、水印等配置
- 后续仍可继续 `addSource()`

**旧写法兼容：**

```js
composer.clearStreams();
```

### `setConfig(patch)`

统一更新运行时配置。支持镜像、水印等动态修改。

```js
await composer.setConfig({
  outputMirror: true,
  mirrorWatermarks: true
});

await composer.setConfig({
  sourceMirror: true,
  sourceMirrorOverrides: {
    0: false,
    2: true
  }
});

await composer.setConfig({
  watermarks: [
    { id: 'brand', target: 'output', type: 'text', text: 'CRTC', position: 'bottom-right' }
  ]
});

await composer.setConfig({
  clearWatermarks: true,
  clearWatermarkFilter: { target: 'source', slot: 0 }
});
```

#### `patch` 支持字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `outputMirror` | `boolean` | 设置整体输出镜像，影响最终输出流 |
| `mirrorWatermarks` | `boolean` | 设置输出级水印是否跟随整体输出镜像 |
| `sourceMirror` | `boolean` | 设置所有源默认镜像，属于源级处理 |
| `sourceMirrorOverrides` | `Object` | 槽位级镜像覆盖，如 `{ 0: true, 1: null }` |
| `clearSourceMirrorOverrides` | `boolean` | 清空全部槽位镜像覆盖 |
| `watermarks` | `Array<Object> \| Object \| null` | 替换全部水印 |
| `clearWatermarks` | `boolean` | 是否执行按条件清空水印 |
| `clearWatermarkFilter` | `Object` | 清空水印过滤条件 |

| 返回值 | 说明 |
|--------|------|
| `Promise<Object>` | 最新配置快照 |

#### 水印对象字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | `string` | — | 必传，唯一标识 |
| `target` | `string` | `'output'` | `'output'` 或 `'source'` |
| `type` | `string` | `'text'` | `'text'` 或 `'image'` |
| `text` | `string` | — | 文本水印内容 |
| `image` | `*` | — | 图片：URL / `HTMLImageElement` / `ImageBitmap` 等 |
| `slot` | `number` | — | source 水印匹配槽位 |
| `streamId` | `string` | — | source 水印匹配 `MediaStream.id` |
| `position` | `string \| Object` | `'bottom-right'` | 预设位置或 `{ x, y }` |
| `width` | `number` | — | 图片宽度 |
| `height` | `number` | — | 图片高度 |
| `fontSize` | `number` | `28` | 文本字号 |
| `color` | `string` | `'#fff'` | 文本颜色 |
| `backgroundColor` | `string` | `'rgba(0,0,0,0.45)'` | 文本底色 |
| `opacity` | `number` | `1` | 透明度 |
| `padding` | `number` | `3` | 内边距 |
| `margin` | `number` | `16` | 外边距 |
| `backgroundRadius` | `number` | `3` | 文本水印背景圆角半径 |

预设位置：
`'top-left'`, `'top-center'`, `'top-right'`, `'center'`, `'bottom-left'`, `'bottom-center'`, `'bottom-right'`

**旧写法兼容：**

```js
await composer.setWatermarks(watermarks);
composer.clearWatermarks({ target: 'output' });
composer.setMirror(true);
composer.setWatermarkMirror(true);
composer.setSourceMirror(0, true);
composer.clearSourceMirror(0);
```

### `getState()`

返回统一状态快照。

```js
const state = composer.getState();

console.log(state.sources);
console.log(state.config);
console.log(state.render);
console.log(state.audio);
```

返回结构：

```js
{
  sources: [
    {
      id: 'source-1',
      streamId: 'abc',
      slot: 0,
      gain: 0.8,
      sourceMirror: false,
      aiBackground: null,   // 该源的 AiVB 配置，无则为 null
      hasAudio: true,
      hasVideo: true
    }
  ],
  config: {
    outputMirror: false,
    sourceMirror: false,
    sourceMirrorOverrides: {},
    mirrorWatermarks: false,
    watermarks: []
  },
  render: {
    requestedMode: 'auto',
    actualMode: 'worker-webgl2',
    isWorker: true,
    isWebGL2: true,
    isFallback: false,
    reason: '',
    droppedFrames: 0,
    renderedFrames: 0,
    fps: 15,
    width: 1280,
    height: 720,
    outputMode: 'insertable',
    insertableActive: true
    // ...更多字段由具体 renderer 和 OutputStream 提供
  },
  audio: {
    requested: false,
    status: 'not-requested',
    contextState: null,
    sourceCount: 0,
    liveSourceCount: 0,
    connectedSources: 0,
    outputTracks: 0,
    reason: '',
    lastError: ''
    // ...更多字段由 AudioMixer 提供
  },
  issues: [
    // getIssues() 返回的问题列表（深拷贝），最多 50 条 FIFO
  ]
}
```

**旧写法兼容：**

```js
composer.getSources();
composer.getRenderInfo();
composer.getAudioInfo();
composer.getWatermarks();
composer.getMirror();
composer.getWatermarkMirror();
composer.getSourceMirror();
```

### `getOutput(options?)`

统一获取输出流。

#### 获取完整音视频输出

```js
const mixedStream = await composer.getOutput({ type: 'mixed' });
```

#### 获取仅视频输出

```js
const videoStream = await composer.getOutput({ type: 'video' });
previewVideo.srcObject = videoStream;
```

#### 获取音频输出

```js
const audioStream = await composer.getOutput({ type: 'audio' });
const submixStream = await composer.getOutput({ type: 'audio', slots: [0, 2] });
const isolatedSubmix = await composer.getOutput({ type: 'audio', slots: [0, 1], isolated: true });
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `options.type` | `'mixed' \| 'video' \| 'audio'` | 输出类型 |
| `options.slots` | `number[]` | 子混音槽位列表，仅 `audio` 有效 |
| `options.isolated` | `boolean` | 使用独立 `AudioContext` 创建该子混音 |
| `options.audioContext` | `'shared' \| 'isolated'` | 显式选择共享或独立 `AudioContext` |
| `options.recreate` | `boolean` | 兼容参数；普通 `slots` 子混音默认每次都会创建新的 destination track |

| 返回值 | 说明 |
|--------|------|
| `Promise<MediaStream>` | `mixed` / `video` 输出流 |
| `Promise<MediaStream \| null>` | `audio` 输出流；无音频时可返回 `null` |

说明：
- `type: 'mixed'` 内部会先拿视频输出，再合入音频轨
- `type: 'video'` 走统一新入口，但旧 `getVideoStream()` 仍保留同步兼容行为
- `type: 'audio'` + `slots` 默认使用共享主 `AudioContext`，但每次调用都会创建新的子混音输出轨道
- `type: 'audio'` + `isolated: true` 或 `audioContext: 'isolated'` 会创建独立 `AudioContext`

**旧写法兼容：**

```js
await composer.getMixedStream();
composer.getVideoStream();
await composer.getAudioStream();
await composer.getSubmixStream({ slots: [0, 1] });
```

### `releaseOutput(options)`

释放通过 `getOutput({ type: 'audio', ... })` 创建的子混音资源。

```js
composer.releaseOutput({ type: 'audio', slots: [0, 1] });
composer.releaseOutput({ type: 'audio', slots: [2, 3] });
```

| 返回值 | 说明 |
|--------|------|
| `boolean` | `true` 表示成功释放 |

说明：
- 当前仅 `audio` 类型支持释放

**旧写法兼容：**

```js
composer.releaseSubmixStream({ slots: [0, 1], isolated: true });
```

### `stop()`

释放所有资源，停止混流器。调用后实例不可复用。

```js
composer.stop();
```

---

## 4. 兼容旧 API 映射

| 旧方法 | 新方法 / 新写法 |
|--------|------------------|
| `appendStream(videos, optionsOrSlot)` | `addSource(videos, optionsOrSlot)` |
| `removeStream(streamOrId)` | `removeSource(streamOrId)` |
| `clearStreams()` | `clearSources()` |
| `getSources()` | `getState().sources` |
| `setMirror(enabled)` | `await setConfig({ outputMirror: enabled })` |
| `getMirror()` | `getState().config.outputMirror` |
| `setWatermarkMirror(enabled)` | `await setConfig({ mirrorWatermarks: enabled })` |
| `getWatermarkMirror()` | `getState().config.mirrorWatermarks` |
| `setSourceMirror(true)` | `await setConfig({ sourceMirror: true })` |
| `setSourceMirror(slot, enabled)` | `await setConfig({ sourceMirrorOverrides: { [slot]: enabled } })` |
| `clearSourceMirror()` | `await setConfig({ clearSourceMirrorOverrides: true })` |
| `clearSourceMirror(slot)` | `await setConfig({ sourceMirrorOverrides: { [slot]: null } })` |
| `setWatermarks(watermarks)` | `await setConfig({ watermarks })` |
| `clearWatermarks(filter)` | `await setConfig({ clearWatermarks: true, clearWatermarkFilter: filter })` |
| `getWatermarks()` | `getState().config.watermarks` |
| `getRenderInfo()` | `getState().render` |
| `getAudioInfo()` | `getState().audio` |
| `getMixedStream()` | `await getOutput({ type: 'mixed' })` |
| `getVideoStream()` | `getOutput({ type: 'video' })` |
| `getAudioStream(options)` | `await getOutput({ type: 'audio', ...options })` |
| `getSubmixStream(options)` | `await getOutput({ type: 'audio', isolated: true, ...options })` |
| `releaseSubmixStream(options)` | `releaseOutput({ type: 'audio', ...options })` |

兼容说明：
- 旧方法当前仍可调用，内部实现已经转调到新控制路径
- 建议新接入统一使用 `addSource / setConfig / getState / getOutput / releaseOutput`
- `getVideoStream()` 仍保留同步行为，主要用于兼容历史代码

---

## 5. 完整使用示例

### 示例 1：基础推流

```js
async function startMixingAndPush() {
  const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });

  const composer = new CRTC.MediaEffectsComposer([], {
    width: 1280,
    height: 720,
    fps: 15
  });

  composer.addSource(localStream, 0);
  composer.addSource(screenStream, { slot: 1, gain: 0.5 });

  const mixedStream = await composer.getOutput({ type: 'mixed' });
  mixedStream.getTracks().forEach((track) => pc.addTrack(track, mixedStream));

  return { composer, mixedStream };
}
```

### 示例 2：统一状态读取

```js
const state = composer.getState();

console.log('sources', state.sources);
console.log('render', state.render);
console.log('audio', state.audio);
```

### 示例 3：镜像和水印动态配置

```js
await composer.setConfig({
  outputMirror: true,
  mirrorWatermarks: false,
  sourceMirrorOverrides: {
    0: true
  },
  watermarks: [
    { id: 'brand', target: 'output', type: 'text', text: 'Live', position: 'top-right' },
    { id: 'host', target: 'source', slot: 0, type: 'text', text: 'Host', position: 'bottom-left' }
  ]
});
```

### 示例 4：子混音监听

```js
const submix = await composer.getOutput({
  type: 'audio',
  slots: [0, 1],
  isolated: true
});

monitorAudio.srcObject = submix;

composer.releaseOutput({
  type: 'audio',
  slots: [0, 1],
  isolated: true
});
```

### 示例 5：运行时切换虚拟背景

```js
composer.setAiBackground(0, {
  enabled: true,
  mode: 'image',
  imageUrl: '/assets/office.png'
});

composer.clearAiBackground(0);
```

---

## 6. 常见问题

### Q: `removeSource()` 不传参数能否当作 `clearSources()`？

不能。当前 API 有意保持分离：
- `removeSource(target)` 明确表示移除一路
- `clearSources()` 明确表示清空全部

这样调用语义更清晰，也避免误删全部源。

### Q: `stop()` 后能复用吗？

不能。`stop()` 后实例已销毁，需要重新 `new CRTC.MediaEffectsComposer()`。

### Q: 最多支持多少路输入源？

9 路。

### Q: 为什么还保留旧方法？

为了平滑迁移旧业务代码。当前旧方法仍可使用，但内部都已尽量复用新实现。

### Q: `getOutput({ type: 'video' })` 和 `getVideoStream()` 有什么区别？

- 新代码建议统一使用 `await getOutput({ type: 'video' })`
- `getVideoStream()` 是兼容层，仍保持同步返回

### Q: 什么时候才会初始化音频混音？

延迟初始化。只有请求音频输出时才会创建音频链路，例如：
- `await getOutput({ type: 'audio' })`
- `await getOutput({ type: 'mixed' })`


### Q: `RTCSession` 里传 `mediaEffectsComposer` 时，会把通话音频也一起混掉吗？

当原始输入流有音频轨时（`hasSourceAudio`），`MediaPipeline` 使用 `getOutput({ type: 'mixed' })` 获取 composer 的完整音视频输出（包含 composer 内部的音频混音结果）。当原始输入流无音频轨时，仅使用 `getOutput({ type: 'video' })` 获取视频输出。

如果你需要多源音频混音或子混音，请直接使用独立的 `MediaEffectsComposer` 实例并显式调用 `getOutput({ type: 'mixed' })` / `getOutput({ type: 'audio' })`。

### Q: `forceNoSwapWH` 是 composer 自身的构造参数吗？

不是。它只在 `RTCSession` 集成路径里用于 `buildMediaEffectsComposerCtorOptions()` 的宽高推导，控制移动端是否跳过宽高交换；这个字段不会继续下传到 `new MediaEffectsComposer(..., options)`。