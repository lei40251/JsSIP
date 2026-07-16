# 09 WebCodecs 与 WebAssembly

> 本文先区分能力证据，再说明实际解码、WASM 加载、输出和释放，避免把“检测到 API”写成“业务正在使用”。

## 1. 本章结论

源码同时使用四类 codec 证据：

1. API/构造器是否存在。
2. WebRTC Offer 是否宣告 codec。
3. WebCodecs/MediaCapabilities 是否接受具体配置。
4. 实际编码或解码是否产生数据。

证据强度逐级增加。WebCodecs 和 WASM 既承担能力检测，也有局部实际处理路径；不能把所有 Encoder/Decoder 名称命中都算作正式编解码业务。

## 2. 四类能力检测

| 检测 | 能回答什么 | 不能回答什么 |
|---|---|---|
| 构造器/方法存在 | 浏览器暴露 API | 配置或 codec 一定可用 |
| `isConfigSupported()` | 浏览器接受给定配置 | 真实帧一定成功输出 |
| MediaCapabilities | supported/smooth/powerEfficient | 当前设备负载下真实体验 |
| WebRTC Offer/回环 | WebRTC 协商或真实字节收发 | 独立 WebCodecs 路径行为 |

## 3. WebCodecs 视频能力

典型检测会构造 codec、尺寸、码率、帧率和 profile 配置，再调用 Decoder/Encoder 的 `isConfigSupported()` 或实际 configure。

H.264 必须关注：

- codec 字符串/profile-level-id。
- Annex B 与 avc 格式差异。
- description/extradata。
- 硬件加速偏好。
- 浏览器接受配置不等于能解码所有码流。

## 4. WebRTC SDP codec 探测

临时 `RTCPeerConnection` 通过 `createOffer()` 检查 H.264、VP8、H.265，回答的是 WebRTC m-line 能力。Android Chrome 还使用双 PC 回环和 Stats 验证真实字节收发。

这部分详见 [`RTCPeerConnection` 使用分析](02-RTCPeerConnection-usage-analysis.md)，不要与 WebCodecs Decoder 配置检测合并计数。

## 5. MediaCapabilities

`navigator.mediaCapabilities.encodingInfo()/decodingInfo()` 接收音视频内容类型、尺寸、码率和帧率等参数，返回：

- `supported`
- `smooth`
- `powerEfficient`

它适合做策略参考，但结果依赖浏览器实现和设备能力；真实通话仍应结合 Stats、帧率和卡顿观察。

## 6. WebAssembly SIMD 与加载

WASM 使用前会检测 WebAssembly 和 SIMD 等能力，再选择对应资源。

标准加载顺序：

```text
fetch(wasmUrl)
  → WebAssembly.instantiateStreaming(response, importObject)
  └─ MIME/兼容失败
       → response.arrayBuffer()
       → WebAssembly.instantiate(bytes, importObject)
```

需要区分：

- 网络下载失败。
- MIME 导致 streaming 失败。
- 模块编译/实例化失败。
- importObject 不匹配。
- SIMD 模块在不支持设备上验证失败。

## 7. 实际 AudioDecoder 路径

源码中存在实际 `AudioDecoder` 使用，不只是能力检测：

```text
构造 AudioDecoder({output,error})
  → configure(audioConfig)
  → decode(new EncodedAudioChunk(...))
  → output(AudioData)
  → 消费/复制 PCM
  → AudioData.close()
  → decoder.flush()/close()
```

每个 `AudioData` 必须 close；decoder error 后不能继续假设当前配置有效。

## 8. 自定义视频解码路径

自定义视频解码器会根据能力和配置选择 WebCodecs/WASM 等实现，并把输出适配为播放器或新 Track 可消费的形式。

可能的输出形态：

- VideoFrame 直接交给 Canvas/WebGL。
- 写入 Track Generator 形成 MediaStreamTrack。
- 转换为图像/纹理供自定义渲染。

这条路径与浏览器 RTCPeerConnection 内部解码器不同；WebRTC receiver 默认不会自动把 encoded frame 交给用户自建 Decoder，除非额外 encoded transform/自定义链路明确接入。

## 9. 回退原生轨道

自定义解码或处理失败时，媒体能力应尽量回退：

```text
custom decoder/wasm failed
  → 关闭自定义 processor
  → 恢复 receiver/native track 播放
  → 保留通话和订阅状态
  → 上报降级原因
```

不能为了保留可选增强能力而停止整个通话。

## 10. 状态和完成点

- `isConfigSupported()` 完成：只代表配置查询完成。
- `configure()` 返回：不代表首帧已解码。
- `decode()` 返回：输入已排队，不代表 output callback 已执行。
- `flush()` resolve：此前排队输出已完成。
- `close()`：Decoder 不可再使用。

文档和公开 Promise 必须明确表示哪个完成点。

## 11. 释放顺序

```text
停止输入 encoded chunks
  → 等待或取消 pending decode
  → flush（需要保留输出时）
  → close decoder/encoder
  → close 所有 VideoFrame/AudioData
  → 释放 WASM 实例外围引用和内存视图
  → stop Generator/output Track
```

WASM 实例没有统一 `close()`，释放依赖取消任务、清 JS 引用和模块自己提供的 destroy/free 方法。

## 12. API 参数与本项目实参

### 12.1 `new VideoEncoder(init)`

MDN：[VideoEncoder()](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/VideoEncoder)

`init` 必填，包含两个回调：

```js
const encoder = new VideoEncoder({
  output: chunk => {
    encodedChunk = chunk;
    result.encodeSupported = true;
  },
  error: reject
});
```

| 字段 | 标准含义 | 本项目传值 |
|---|---|---|
| `output(chunk, metadata)` | 每个编码结果回调；chunk 是 EncodedVideoChunk | 只接第一个形参，保存 chunk 给后续 VideoDecoder，并置支持标志 |
| `error(error)` | 编码器异步错误回调 | 直接传 capability Promise 的 reject 函数 |

构造成功不表示 codec 可用；必须继续 `configure → encode → flush`，并实际收到 output 才置 `encodeSupported=true`。

### 12.2 `encoder.configure(config)`

MDN：[VideoEncoder.configure()](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/configure)

H.264 探测实参：

```js
{
  codec: 'avc1.42E01E',
  avc: { format: 'annexb' },
  width: 320,
  height: 240,
  bitrate: 1000000
}
```

VP8 探测实参：

```js
{
  codec: 'vp8',
  width: 320,
  height: 240,
  bitrate: 1000000
}
```

| config 字段 | 类型/可选值 | 含义 | 本项目值 |
|---|---|---|---|
| `codec` | codec string | 编码格式和 profile/level | H.264 baseline-ish `avc1.42E01E`；或 `'vp8'` |
| `width/height` | 正整数 | 编码帧尺寸 | `320 × 240` |
| `displayWidth/displayHeight` | 可选正整数 | 显示纵横比尺寸 | 未传 |
| `bitrate` | bit/s 或 bitrate mode 对象（按实现） | 目标码率 | `1000000` bit/s |
| `framerate` | number | 目标帧率 | 未传；能力实测只编码一帧 |
| `hardwareAcceleration` | `'no-preference'`、`'prefer-hardware'`、`'prefer-software'` | 硬/软编偏好 | 未传 |
| `latencyMode` | `'quality'`、`'realtime'` | 质量/实时延迟偏好 | 未传 |
| `scalabilityMode` | string | 时域/空域可伸缩模式 | 未传 |
| `alpha` | `'discard'` / `'keep'` | alpha 通道处理 | 未传 |
| `avc.format` | `'avc'` / `'annexb'` | H.264 chunk 的字节流格式 | H.264 明确传 `'annexb'` |

`configure()` 返回 `undefined`，错误可能同步抛出或进入 error callback。源码没有先调用 `VideoEncoder.isConfigSupported()`，而是用真实单帧编码作为最终探测。

### 12.3 `new VideoFrame(source, init)` 与 `encoder.encode(frame, options?)`

MDN：[VideoFrame()](https://developer.mozilla.org/en-US/docs/Web/API/VideoFrame/VideoFrame)、[VideoEncoder.encode()](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/encode)

```js
drawTestFrameOnCanvas();
const frame = new VideoFrame(canvas, { timestamp: 0 });
encoder.encode(frame, { keyFrame: true });
frame.close();
await encoder.flush();
encoder.close();
```

| 参数 | 含义 | 本项目实参 |
|---|---|---|
| `VideoFrame.source` | CanvasImageSource、另一个 VideoFrame 或原始 buffer | `320×240` 测试 canvas |
| `init.timestamp` | 微秒时间戳，必需于 canvas/image 类 source | `0`，因为只做单帧能力测试 |
| `init.duration` | 可选帧持续时间，微秒 | 未传 |
| `init.alpha` | 是否丢弃 alpha | 未传 |
| `encode.frame` | 要编码的 VideoFrame | 上一步 frame |
| `encode.options.keyFrame` | boolean，请求关键帧 | `true`，保证单帧输出可独立解码 |

`frame.close()` 在 `encode()` 入队后立即调用，释放 JS 持有的 frame 资源；encoder 已取得编码所需引用。`flush()` 无参数，等待此前所有输出/错误完成；`encoder.close()` 无参数，最终释放 codec 资源。

### 12.4 `new VideoDecoder(init)`、`configure(config)`、`decode(chunk)`

MDN：[VideoDecoder()](https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder/VideoDecoder)、[configure()](https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder/configure)、[decode()](https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder/decode)

```js
const decoder = new VideoDecoder({
  output: frame => {
    result.decodeSupported = true;
    resolve();
    frame.close();
  },
  error: reject
});

decoder.configure(decodeConfig);
decoder.decode(encodedChunkFromEncoder);
await decoder.flush();
decoder.close();
```

`init.output/error` 语义与 encoder 相同，只是 output 得到 VideoFrame。H.264 config 是 `{codec:'avc1.42E01E', avc:{format:'annexb'}}`，VP8 是 `{codec:'vp8'}`；width/height 可从 bitstream 推断，所以解码 config 未传。`decode(chunk)` 唯一参数正是前一步 encoder output 的 `EncodedVideoChunk`，确保编码与解码测试使用完全相同的 bitstream。

实际远端视频 fallback 的 config 另为 `{codec:'avc1.420028'}`，来自 `_enableVideoDecodeFallback()`；编码帧由 WebRTC encoded transform 输入，不是能力测试的 320×240 chunk。

### 12.5 `new AudioDecoder(init)` 与 Opus config

MDN：[AudioDecoder()](https://developer.mozilla.org/en-US/docs/Web/API/AudioDecoder/AudioDecoder)、[AudioDecoder.configure()](https://developer.mozilla.org/en-US/docs/Web/API/AudioDecoder/configure)

远端原生音频解码失败后，插件收到的实际配置（L35584—L35593）：

```js
{
  codec: 'opus',
  sampleRate: 48000,
  numberOfChannels: 1
}
```

| 字段 | 含义 | 本项目值 |
|---|---|---|
| `codec` | 音频 codec string | `'opus'` |
| `sampleRate` | 解码输出采样率 Hz | `48000` |
| `numberOfChannels` | 输出声道数 | `1` |
| `description` | codec-specific 初始化字节 | 未传；Opus 路径依赖 codec/流数据 |

构造器 `output(audioData)` 回调会增加 decoded count、向 observable 推送，并调用 player.write(audioData)；`error(error)` 记录后切失败状态。

### 12.6 `new EncodedAudioChunk(init)`

MDN：[EncodedAudioChunk()](https://developer.mozilla.org/en-US/docs/Web/API/EncodedAudioChunk/EncodedAudioChunk)

```js
decoder.decode(new EncodedAudioChunk({
  data: encodedFrame.data,
  timestamp: encodedFrame.timestamp,
  type: 'key'
}));
```

| init 字段 | 必填性/含义 | 本项目来源 |
|---|---|---|
| `type` | 必填，`'key'` 或 `'delta'` | 固定 `'key'`；Opus 音频帧不按视频 GOP 依赖处理 |
| `timestamp` | 必填，微秒时间戳 | encoded transform 输入帧的 `e.timestamp` |
| `data` | 必填，BufferSource | encoded transform 输入帧的 `e.data` |
| `duration` | 可选，微秒 | 未传 |
| `transfer` | 可选 ArrayBuffer 列表（新实现） | 未传，数据由构造器读取/复制语义处理 |

只有 `decoder.state==='configured'` 时才构造并 decode；否则该 encoded frame 被计数但不送入 decoder。

### 12.7 `MediaCapabilities.encodingInfo(config)` / `decodingInfo(config)`

MDN：[encodingInfo()](https://developer.mozilla.org/en-US/docs/Web/API/MediaCapabilities/encodingInfo)、[decodingInfo()](https://developer.mozilla.org/en-US/docs/Web/API/MediaCapabilities/decodingInfo)

源码 L16557—L16607 对 codec 列表逐项传：

```js
{
  type: 'webrtc',
  video: {
    contentType: `video/${codec}`,
    width,
    height,
    bitrate,
    framerate
  }
}
```

| 字段 | 含义 | 本项目默认值/来源 |
|---|---|---|
| `type` | 媒体使用场景 | 固定 `'webrtc'` |
| `video.contentType` | MIME + codec 信息 | 遍历参数数组 `e`，拼成 `video/${s}` |
| `width/height` | 目标像素尺寸 | 函数默认 `1920 × 1080`，调用方可覆盖 |
| `framerate` | 目标帧率 | 默认 `30` |
| `bitrate` | bit/s | 源码默认字面量 `3000`；按标准单位这是 3000 bit/s，数值明显偏低，不能擅自改写成 3000 kbps |

返回对象常含 `supported`、`smooth`、`powerEfficient`。这是浏览器预测，不等于真实 WebRTC 能收发；所以正文还保留 Offer 探测和回环实测。

### 12.8 `WebAssembly.validate(bytes)`

MDN：[WebAssembly.validate()](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/validate_static)

唯一必填参数是包含 wasm 二进制的 BufferSource。源码传一个固定 `Uint8Array([...])` 小模块，其中含 SIMD opcode；返回 boolean：

```js
const supported = typeof WebAssembly !== 'undefined' &&
  WebAssembly.validate(new Uint8Array([/* SIMD probe bytes */]));
```

它只验证当前引擎能否解析/验证这段 SIMD 模块，不下载业务 wasm，也不创建 instance。

### 12.9 `WebAssembly.instantiateStreaming(source, importObject?)`

MDN：[instantiateStreaming()](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiateStreaming_static)

源码 L31096—L31109：

```js
const responsePromise = fetch(url);
const result = await WebAssembly.instantiateStreaming(responsePromise, importObject);
instance = result.instance;
```

| 参数 | 含义 | 本项目实参 |
|---|---|---|
| `source` | `Response` 或其 Promise | `fetch(e)` 返回的 Promise，不提前 await，允许边下载边编译 |
| `importObject` | wasm import module/name 到 JS 值的映射 | `loadWasm(e,t)` 的第二参数 `t`，由具体 wasm 模块调用方提供 |
| `compileOptions` | 新实现可选编译选项 | 未传 |

URL 是 data URL、file URL、没有 fetch 或 streaming 失败时跳过/进入 fallback。服务端 MIME 不正确也可能让 streaming 失败。

### 12.10 `WebAssembly.instantiate(bytes, importObject?)` fallback

MDN：[WebAssembly.instantiate()](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiate_static)

```js
const bytes = await download(url, { type: 'arraybuffer' });
const result = await WebAssembly.instantiate(bytes, importObject);
instance = result.instance;
```

第一个参数从 HTTP 下载器得到完整 ArrayBuffer；第二参数与 streaming 路径是同一个 `t`。这条路径要等完整下载后编译，内存峰值和启动延迟通常更高，但不依赖 streaming MIME 条件。两条路径都只把 `.instance` 保存为运行对象；module 若需要缓存，需要另行保存 `result.module`，当前片段没有。

### 12.11 `close()` 的对象分别是谁

- `VideoFrame.close()` / `AudioData.close()`：释放帧背后的媒体资源；输出回调使用完即关。
- `VideoEncoder.close()` / `VideoDecoder.close()` / `AudioDecoder.close()`：同步把 codec 状态置为 closed，后续不能再 configure/decode；调用前先 await `flush()` 才不会丢排队工作。
- wasm instance 没有统一 `close()` 标准方法；具体包装类必须调用其导出的 free/destroy 或清 JS/GL 资源，不能套用 WebCodecs 生命周期。

## 13. 事实与边界

### 可以直接确认

- codec 能力通过多种 API 交叉判断。
- 存在实际 AudioDecoder 和自定义视频解码链。
- WASM 有 streaming 和 ArrayBuffer fallback。
- H.264 WebRTC 回环强于单纯 SDP 声明。

### 合理推断

- 多源能力证据用于降低浏览器“声明支持但实际失败”的兼容风险。
- WASM/WebCodecs 是可选处理路径，失败时应回退原生媒体。

### 不能确认

- 每种目标设备的硬解码、功耗和性能，需要运行数据验证。
- 反混淆包之外的 WASM 模块内部算法和内存释放细节。
