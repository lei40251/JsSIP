# 01 浏览器 API 使用全景分析

> 本文是第一层地图：按浏览器 API 分类说明“用了什么、传了什么、在哪里用”。关键 API 的兼容、能力检测、正式业务和生命周期放到后续专题。

## 1. WebRTC 核心 API

**API 是什么**

`RTCPeerConnection`、`RTCRtpTransceiver`、`RTCRtpSender` 和 `RTCRtpReceiver` 共同负责媒体协商、收发轨道、传输参数和连接统计。

**源码位置**

- Adapter：L6651—L9450。
- codec/Transceiver 能力检测：L15760—L16340、L45352—L45455。
- MPC：L37350—L40710。
- SPC：L45320—L49420。

**实际参数**

正式 PC 都使用 `iceServers`、`iceTransportPolicy`、`sdpSemantics`、`max-bundle` 和 `rtcpMuxPolicy=require`。SPC 另外使用 `encodedInsertableStreams` 和 `offerExtmapAllowMixed`。源码还传入 `tcpCandidatePolicy`、`IceTransportsType` 等非标准字段，不能直接当作通用 WebRTC 配置。

**使用场景**

- MPC 为上行和每个远端用户分别持有 PC。
- SPC 由房间级 `SignalTransport` 持有共享 PC。
- 固定 Transceiver 槽用于发布、换轨和小流/辅流。
- `getStats()` 用于实际候选路径、码率、丢包、RTT、分辨率和卡顿指标。

**典型调用链**

```text
Room.publish / subscribe
  → MPC 或 SPC transport
  → createOffer / setLocalDescription
  → WebSocket 信令或本地 ability 合成
  → setRemoteDescription
  → waitForPeerConnectionConnected
```

**深入阅读**

见 [`RTCPeerConnection` 使用分析](02-RTCPeerConnection-usage-analysis.md)。

## 2. MediaDevices 与媒体采集

**API 是什么**

`enumerateDevices()` 枚举输入输出设备；`getUserMedia()` 采集摄像头和麦克风；`getDisplayMedia()` 采集屏幕、窗口或标签页。

**源码位置**

媒体约束和能力工具主要位于 L15700—L17400；Track 与采集实现主要位于 L19900—L24000；公开入口位于 L34700—L35200。

**实际参数**

- 音频：`deviceId`、`echoCancellation`、`noiseSuppression`、`autoGainControl`、`channelCount`、`sampleRate`。
- 视频：`deviceId`、`facingMode`、`width`、`height`、`frameRate`。
- 屏幕：`displaySurface`、系统音频、Capture Handle、可选 CropTarget 和额外麦克风轨道。

约束会从精确值逐级降级；最终必须通过 `track.getSettings()` 确认浏览器实际采用的设备和规格。

**使用场景**

本地音视频启动、设备切换、设备拔插恢复、屏幕分享、系统音频和屏幕区域裁剪。

**典型调用链**

```text
startLocalVideo(options)
  → profile / cameraId 转 capture config
  → navigator.mediaDevices.getUserMedia({video})
  → MediaStream.getVideoTracks()[0]
  → LocalVideoTrack.setInputMediaStreamTrack()
```

**深入阅读**

见 [`MediaDevices` 与采集](04-MediaDevices-and-Capture.md)。

## 3. MediaStream 与 MediaStreamTrack

**API 是什么**

`MediaStream` 负责组合轨道和携带 msid；`MediaStreamTrack` 是真正的音频或视频资源，提供 `enabled`、`muted`、`readyState`、`getSettings()`、`applyConstraints()`、`clone()` 和 `stop()`。

**源码位置**

Track 包装与媒体资源层主要位于 L19900—L24000；发布和订阅层在 L37350—L49420 使用这些轨道。

**实际参数**

- `new MediaStream([track])` 用于播放、sender 关联和音频节点桥接。
- `applyConstraints()` 接收设备、分辨率、帧率或音频 3A 更新。
- `contentHint` 在视频 motion/detail 和音频 speech/music 之间传播。

**使用场景**

区分采集得到的 source track、处理管线产生的 out track、Sender 当前发送的 track 和 Player 当前播放的 track。

**典型调用链**

```text
sourceTrack
  → Track.setInputMediaStreamTrack()
  → Audio/Canvas pipeline（可选）
  → outMediaTrack
  → RTCRtpSender.replaceTrack(outMediaTrack)
```

**深入阅读**

见 [`MediaStreamTrack` 生命周期](05-MediaStreamTrack-Lifecycle.md)。

## 4. Web Audio

**API 是什么**

`AudioContext`、`MediaStreamAudioSourceNode`、`MediaStreamAudioDestinationNode`、`GainNode`、`AnalyserNode` 和 AudioWorklet 组成浏览器音频处理图。

**源码位置**

AudioContext 管理、播放器和处理管线主要位于 L18000—L22000；AI 降噪和混音模块在媒体资源层继续接入。

**实际参数**

- `createMediaStreamSource(stream)` 把 Track 输入处理图。
- `createMediaStreamDestination()` 把处理结果重新变成可发布 Track。
- `GainNode.gain` 控制音量。
- Analyser 或 AudioWorklet 周期输出音量/PCM。

**使用场景**

麦克风预处理、音量检测、混音、耳返、背景音乐、AEC 参考、播放音量和自动播放恢复。

**典型调用链**

```text
microphone sourceTrack
  → createMediaStreamSource
  → processor / gain / analyser
  → createMediaStreamDestination
  → outMediaTrack
```

**深入阅读**

见 [Web Audio 使用分析](06-Web-Audio-usage-analysis.md)。

## 5. HTMLMediaElement 播放

**API 是什么**

`HTMLVideoElement` 和 `HTMLAudioElement` 通过 `srcObject` 播放 MediaStream，通过 `play()` Promise 暴露自动播放限制，通过 `setSinkId()` 选择音频输出设备。

**源码位置**

Player 基类和音视频播放器主要位于 L17400—L19000。

**实际参数**

- 视频：`autoplay`、`playsInline`、`muted`、`srcObject`、object-fit、mirror。
- 音频：`srcObject` 或 URL、`volume`、可选 `setSinkId(deviceId)`。

**使用场景**

本地预览、远端音视频播放、背景音乐、输出设备切换、自动播放弹窗恢复和首帧检测。

**典型调用链**

```text
RemoteTrack.setInputMediaStreamTrack(track)
  → Player.setTrack(track)
  → mediaElement.srcObject = new MediaStream([track])
  → mediaElement.play()
```

**深入阅读**

见 [媒体播放与渲染](07-Media-Playback-and-Rendering.md)。

## 6. Canvas、WebGL 与视频帧

**API 是什么**

Canvas 2D 用于绘制、截图和简单混画；WebGL2 用于纹理、着色器、FBO 和 GPU 视频合成；`captureStream()` 把画布输出重新变成视频轨道。

**源码位置**

Canvas/WebGL 渲染节点主要位于 L24000—L29000；部分黑帧检测和视频帧处理位于 Worker 相关代码。

**实际参数**

- `canvas.getContext('2d', {willReadFrequently:true})` 用于像素读取。
- `canvas.getContext('webgl2', options)` 创建 GPU 渲染上下文。
- `canvas.captureStream(frameRate)` 输出处理后视频轨道。
- `requestVideoFrameCallback()` 在支持时驱动视频帧更新。

**使用场景**

本地混流、镜像、旋转、裁剪、透明度、截图、黑帧检测和处理后 Track 输出。

**典型调用链**

```text
video track
  → hidden video / frame source
  → Canvas2D 或 WebGL renderer
  → canvas.captureStream()
  → processed video track
```

**深入阅读**

见 [媒体播放与渲染](07-Media-Playback-and-Rendering.md)。

## 7. WebSocket 信令

**API 是什么**

浏览器 `WebSocket` 提供长连接；SDK 在其上实现主备地址竞速、JSON 信封、序列号 RPC、在线判断和恢复。

**源码位置**

SignalChannel 主要位于 L36740—L37400；Room 在 L49400—L51908 调用它完成进房、发布、订阅和重建。

**实际参数**

URL 包含 SDK、用户、鉴权和诊断查询参数。发送消息统一为 `{cmd,data,userId,tinyId,seq}` JSON；源码没有设置 `binaryType`、子协议或自定义 Ping/Pong。

**使用场景**

join、publish、subscribe、自定义消息、媒体配置、重建 PC、网络质量上报和房间事件。

**典型调用链**

```text
sendWaitForResponse(command, data)
  → send(JSON envelope)
  → WebSocket.send()
  → onmessage()
  → seq 匹配对应等待请求
```

**深入阅读**

见 [`WebSocket` 使用分析](03-WebSocket-usage-analysis.md)。

## 8. HTTP、URL 与上报

**API 是什么**

`fetch`、`XMLHttpRequest`、`FormData`、`URLSearchParams` 和 `sendBeacon` 用于房间调度、资源下载、日志/质量上报和页面退出收尾。

**源码位置**

公共 HTTP 工具约位于 L12500—L13400；WASM/资源下载、调度和上报在各业务模块调用。

**实际参数**

- 普通请求优先 `fetch`，必要时降级 XHR。
- 调度可能并发主备域名请求。
- 页面退出/批量上报优先 `navigator.sendBeacon()`；返回 `false` 时退回普通 `fetch/XHR` 包装。当前 fetch 包装没有传 `keepalive`。
- 日志正文可能先 gzip，再以 Blob/ArrayBuffer 发送。

**使用场景**

获取信令/ICE 配置、加载 WASM、上传日志、网络质量和性能数据。

**典型调用链**

```text
enterRoom
  → schedule(joinParams)
  → FormData / URLSearchParams
  → 主备 HTTP 请求竞速
  → 保存 signal URL、ICE 和策略
```

**深入阅读**

见 [辅助浏览器 API](10-Auxiliary-Browser-APIs.md)。

## 9. Worker、Web Streams 与 Encoded Transform

**API 是什么**

Dedicated Worker 承载后台定时器、黑帧检测和 `RTCRtpScriptTransform`；Readable/Writable/TransformStream 连接音频 PCM、编码帧和处理器。

**源码位置**

通用 Worker/Streams 工具分布于 L16800—L17400 和媒体资源层；SPC encoded transform 主要位于 L45900—L49400。

**实际参数**

- Worker 多通过 Blob URL 动态创建，创建后立即 revoke URL。
- 旧路径使用 `sender/receiver.createEncodedStreams()`。
- 新路径把 `new RTCRtpScriptTransform(worker, options)` 赋给 sender/receiver 的 `transform`。

**使用场景**

SEI 注入/提取、编码帧管线、黑帧检测、AudioWorklet PCM、页面隐藏时稳定定时。

**典型调用链**

```text
RTCRtpSender encoded readable
  → TransformStream(SEI / frame processor)
  → encoded writable
```

**深入阅读**

见 [Worker、Streams 与编码帧处理](08-Worker-Streams-and-Encoded-Processing.md)。

## 10. WebCodecs、MediaCapabilities 与 WebAssembly

**API 是什么**

WebCodecs 提供浏览器级编解码器和编码块；MediaCapabilities 查询支持性、流畅性和功耗；WebAssembly 加载自定义音视频处理实现。

**源码位置**

能力检测集中于 L15000—L16400；实际 AudioDecoder、自定义视频解码器和 WASM 加载位于媒体处理模块。

**实际参数**

- codec 检测没有只依赖 `isConfigSupported()`；当前源码直接执行 configure、单帧 encode/decode、flush，并以实际 output 判断。
- MediaCapabilities 传入 codec、尺寸、码率和帧率。
- WASM 优先 `instantiateStreaming`，失败时下载 ArrayBuffer 后 `instantiate`。

**使用场景**

区分“API 存在”“浏览器宣告 codec”“配置可接受”和“真实数据可解码”；为自定义音频/视频处理选择 WebCodecs、WASM 或 WebRTC 原生路径。

**典型调用链**

```text
能力检测
  → 选择 WebCodecs / WASM / 原生 WebRTC
  → configure / instantiate
  → 处理帧
  → close / 恢复原轨道
```

**深入阅读**

见 [WebCodecs 与 WebAssembly](09-WebCodecs-and-WebAssembly.md)。

## 11. Navigator、Permissions 与页面状态

**API 是什么**

Navigator 提供 UA、Client Hints、网络类型、硬件能力、语言和权限；DOM/Observer 提供页面可见性、视图交叉、页面退出和自动播放交互。

**源码位置**

浏览器检测和权限工具主要位于公共工具与媒体资源层；视图自动订阅和页面生命周期在 SDK/Room 层继续使用。

**实际参数**

- `permissions.query({name})` 查询摄像头/麦克风权限。
- `userAgentData.getHighEntropyValues()` 获取平台和版本信息。
- `IntersectionObserver` 观察远端视图可见性。
- `document.visibilityState`、`pagehide` 控制定时器、上报和退出收尾。

**使用场景**

浏览器兼容分支、设备权限提示、网络类型更新、按可见性订阅、后台调度和页面退出释放。

**典型调用链**

```text
远端 view 进入/离开可见区域
  → IntersectionObserver callback
  → 合并状态变化
  → subscribe / unsubscribe
```

**深入阅读**

见 [辅助浏览器 API](10-Auxiliary-Browser-APIs.md)。

## 12. Storage、Performance 与定时器

**API 是什么**

`localStorage` 和 `sessionStorage` 保存日志/配置和会话数据；Performance API 记录耗时和资源下载；timer、RAF、idle callback 和 Worker timer 负责调度。

**源码位置**

这些 API 分散在公共工具、日志、播放器、房间和网络质量模块。

**实际参数**

- Storage 使用前先检测可写性并捕获配额/隐私模式异常。
- `performance.now()` 用于连接和方法耗时。
- `PerformanceResourceTiming` 用于资源下载诊断。
- `setTimeout/setInterval` 用于 RPC、连接、重连、Stats 和播放超时。

**使用场景**

日志缓存、跨刷新诊断、连接耗时、网络质量采样、重试退避和渲染调度。

**典型调用链**

```text
周期 Stats / 心跳 / 重试任务
  → 页面可见时普通 timer
  → 需要后台稳定时 Worker timer
  → close/reset 清理 task
```

**深入阅读**

见 [辅助浏览器 API](10-Auxiliary-Browser-APIs.md)。

## 13. 二进制、文本编码与安全边界

**API 是什么**

`ArrayBuffer`、TypedArray、DataView、TextEncoder/TextDecoder 和 Base64 API 用于自定义消息、上报包、TLV/类 Protobuf 和 H.264 SEI。

**源码位置**

公共二进制工具和协议解析主要位于 L23000—L33000；信令自定义消息和 encoded frame 处理继续调用。

**实际参数**

- DataView 明确读写大小端整数。
- TextEncoder/TextDecoder 处理 UTF-8。
- `btoa/atob` 把业务字节数组放入 JSON 信令。
- 当前可定位的随机序号/标识路径仍有 `Math.random()`；未形成明确的正式业务 `crypto.getRandomValues()` 调用链。

**使用场景**

信令消息封装、日志压缩、自定义消息、SEI、WASM 内存和 Transferable 数据。

**典型调用链**

```text
Uint8Array payload
  → base64
  → WebSocket JSON command
  → 服务端/远端反向解码
```

**深入阅读**

见 [辅助浏览器 API](10-Auxiliary-Browser-APIs.md)。

## 14. 仅检测或没有正式使用的 API

必须把“存在性检测”与“正式处理链”区分开：

| API | 当前文件中的状态 |
|---|---|
| `MediaRecorder` | 未发现正式录制链 |
| IndexedDB | 未发现使用 |
| ServiceWorker / SharedWorker | 未发现使用 |
| EventSource | 未发现使用 |
| WebTransport | 主要是能力检测，没有正式传输链 |
| 多数 WebCodecs Encoder/Decoder | 部分只做能力检测；实际 AudioDecoder 和自定义视频解码路径除外 |
| DataChannel | 实现存在，但当前 Room 构造路径没有启用自定义消息 DataChannel |

深入审计还补出了第一版全景容易漏掉的 API。它们已经分别进入专题，但在全景层要先标明性质：

| 补充 API | 性质 | 实际场景 | 深入章节 |
|---|---|---|---|
| `CompressionStream`、`Response(stream)` | 正式辅助业务 | 大于 2800 字符的日志 JSON gzip，上报失败时回退原文 | 10 |
| `MediaStreamTrackProcessor` | 正式可选诊断 | 把视频 Track 转成 VideoFrame readable，转移给黑帧 Worker | 08 |
| `MediaStreamTrackGenerator` | 正式解码输出分支 | 把自定义解码 VideoFrame 写回新视频 Track | 08 |
| `PressureObserver` | 可选诊断 | 每 2000 ms 采样 CPU pressure，失败不影响通话 | 10 |
| `CropTarget.fromElement/cropTo` | 正式可选采集 | 屏幕选择完成后再裁剪到 DOM Element | 04 |
| `MessageChannel` | 基础库兼容层 | setImmediate fallback，不是 RTC 信令通道 | 10 |
| `MutationObserver`、`queueMicrotask` | 基础库兼容层 | microtask 调度 fallback，不是媒体观察器 | 10 |
| `requestIdleCallback/cancelIdleCallback` | 正式任务调度 | idle 周期任务；不支持时退回 setTimeout | 10 |
| `Response.clone/json/arrayBuffer/blob` | 正式网络/压缩链 | HTTP 响应双路径解析、压缩流收集 | 10 |
| `EncodedAudioChunk` | 正式降级解码 | WebRTC encoded Opus 帧转换成 WebCodecs 输入 | 09 |

“补出 API”不等于它们同等重要。正文按业务阶段讲清楚，完整命中和兼容层位置仍放附录 A。

## 15. 从全景地图进入下一层

优先阅读两条主干：

```text
媒体面：RTCPeerConnection → MediaDevices → Track → Audio / Player / Worker
控制面：HTTP 调度 → WebSocket → Room 命令 → PC 发布订阅和恢复
```

完整 API 出现位置见 [附录 A](Appendix-A-WebAPI-Occurrences.md)，不要把附录中的机械命中数量直接当成正式业务调用次数。
