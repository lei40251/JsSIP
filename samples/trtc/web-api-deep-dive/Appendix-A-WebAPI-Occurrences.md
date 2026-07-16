# 附录 A Web API 出现位置

> 本附录是机械定位资料，不进入主阅读线。定义、Adapter、能力检测和正式业务调用可能同时出现，必须回到对应专题判断语义。
> 目标：看到任意一个浏览器 Web API 名称后，可以定位它在源码中的出现位置、所在方法和应阅读的专项。定义/兼容层、能力检测和正式业务调用可能同时出现，必须结合专项判断。

## 深入审计补充项

第一版账本以主干 WebRTC/媒体关键字为主。第二轮按构造器、全局对象、实例方法和兼容层别名继续检查后，补出以下不应遗漏的 API。这里保留代表位置；完整参数和实参流进入相应正文。

| API | 代表位置 | 性质 | 正文 |
|---|---:|---|---|
| `CompressionStream('gzip')` | L12975 | 正式日志压缩 | 10 |
| `new Response(compressedStream)` / `blob()` / `arrayBuffer()` | L12976 | 正式压缩流收集 | 10 |
| `Response.clone()` / `json()` / `arrayBuffer()` | L12931—L12935 | 正式 HTTP 响应解析 | 10 |
| `MediaStreamTrackProcessor({track})` | L47691 | 正式可选黑帧检测 | 08 |
| `MediaStreamTrackGenerator({kind:'video'})` | L43955 | 正式自定义解码输出 | 08 |
| `ReadableStream` / `WritableStream` / `TransformStream` | L21883、L22923、L45764 等 | 正式 PCM/encoded 管线 | 08 |
| `AbortController` | L21877、L27338、L48113、L48936 | 正式 stream 中止 | 08 |
| `RTCRtpScriptTransform` | L48154、L48981 | 正式 SPC encoded transform | 08 |
| `PressureObserver` | L32819—L32820 | 可选 CPU 诊断 | 10 |
| `CropTarget.fromElement()` / `track.cropTo()` | L27033 附近 | 可选屏幕区域裁剪 | 04 |
| `requestIdleCallback` / `cancelIdleCallback` | L16995、L17115、L17169 | 正式任务调度与 fallback | 10 |
| `MessageChannel` | L2304、L2370 附近 | setImmediate 兼容层 | 10 |
| `MutationObserver` | L2436、L2480 附近 | queueMicrotask 兼容层 | 10 |
| `queueMicrotask` | L2440 起 | 原生能力引用/微任务兼容层 | 10 |
| `FormData.append()` | L30764—L30777 | 正式调度参数 | 10 |
| `URLSearchParams` | L12066、L30942、L36826 等 | 正式 query 解析/构造，也含 polyfill 自测 | 10 |
| `EncodedAudioChunk` | L33749 | 正式 Opus 降级解码 | 09 |
| `VideoEncoder` / `VideoDecoder` / `VideoFrame` | L15945—L15986 | 能力实测 | 09 |
| `AudioDecoder` | L33722 | 正式音频 fallback | 09 |
| `MediaCapabilities.encodingInfo/decodingInfo` | L16573、L16604 | 能力预测 | 09 |
| `WebAssembly.validate/instantiateStreaming/instantiate` | L16415、L31108、L31121 | SIMD 检测与正式 WASM 加载 | 09 |
| `IntersectionObserver` | L35803 | 正式可见性订阅策略 | 10 |
| `navigator.permissions.query()` | L34079 | 可选权限预查询 | 10 |
| `navigator.sendBeacon()` | L42183、L42216 | 正式上报优先路径 | 10 |
| `btoa/atob` | L49461、L49480 | 正式 Base64 自定义消息 | 10 |

补充审计同时纠正三类机械误判：全局名称出现在 polyfill feature test 中不等于正式业务调用；类名可能被打包器局部变量遮蔽；注释中的 API 名称不能计为执行点。

## `RTCPeerConnection`（212 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L6656 | `fC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L6657 | `fC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7011 | `kC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7013 | `kC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7026 | `kC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7028 | `kC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7030 | `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7040 | `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7055 | `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7083 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7084 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7085 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7104 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7106 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7107 | `RTCPeerConnection.prototype.getSenders — 获取 RTCRtpSender 列表` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7111 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7113 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7115 | `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7122 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7124 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7126 | `RTCPeerConnection.prototype.removeTrack — 从 RTCPeerConnection 移除 MediaStreamTrack` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7134 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7136 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7138 | `RTCPeerConnection.prototype.addStream — 添加 MediaStream（旧版 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7147 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7149 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7151 | `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7165 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7166 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7167 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7172 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7174 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7176 | `RTCPeerConnection.prototype.getSenders — 获取 RTCRtpSender 列表` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7204 | `wC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7205 | `wC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7207 | `wC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7209 | `RTCPeerConnection.prototype.getStats — 获取 WebRTC 连接统计信息` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7271 | `o — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7275 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7278 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7282 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7283 | `RTCPeerConnection.prototype.getSenders — 获取 RTCRtpSender 列表` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7290 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7294 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7295 | `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7314 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7318 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7319 | `RTCPeerConnection.prototype.getReceivers — 获取 RTCRtpReceiver 列表` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7338 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7340 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7342 | `RTCPeerConnection.prototype.getStats — 获取 WebRTC 连接统计信息` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7378 | `OC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7379 | `RTCPeerConnection.prototype.getLocalStreams — 获取本地流列表（非标准 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7386 | `OC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7388 | `OC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7390 | `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7404 | `OC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7406 | `OC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7408 | `RTCPeerConnection.prototype.addStream — 添加 MediaStream（旧版 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7423 | `OC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7425 | `OC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7427 | `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7435 | `OC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7437 | `OC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7439 | `RTCPeerConnection.prototype.removeTrack — 从 RTCPeerConnection 移除 MediaStreamTrack` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7462 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7463 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7464 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7466 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7468 | `RTCPeerConnection.prototype.getLocalStreams — 获取本地流列表（非标准 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7475 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7477 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7479 | `RTCPeerConnection.prototype.addStream — 添加 MediaStream（旧版 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7498 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7519 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7520 | `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7529 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7530 | `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7533 | `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7563 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7588 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7590 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7592 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7594 | `RTCPeerConnection.prototype.setLocalDescription — 设置本地 SDP 描述` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7616 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7618 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7628 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7629 | `RTCPeerConnection.prototype.removeTrack — 从 RTCPeerConnection 移除 MediaStreamTrack` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7632 | `RTCPeerConnection.prototype.removeTrack — 从 RTCPeerConnection 移除 MediaStreamTrack` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7635 | `RTCPeerConnection.prototype.removeTrack — 从 RTCPeerConnection 移除 MediaStreamTrack` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7658 | `MC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7659 | `MC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7663 | `MC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7676 | `MC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7830 | `FC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7831 | `FC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7835 | `FC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7848 | `FC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7857 | `FC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7859 | `FC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7861 | `RTCPeerConnection.prototype.getStats — 获取 WebRTC 连接统计信息` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7898 | `BC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7900 | `BC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7904 | `BC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7905 | `RTCPeerConnection.prototype.getSenders — 获取 RTCRtpSender 列表` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7912 | `BC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7916 | `BC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7917 | `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7936 | `HC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7938 | `HC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7942 | `HC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7943 | `RTCPeerConnection.prototype.getReceivers — 获取 RTCRtpReceiver 列表` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7963 | `WC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7964 | `WC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7966 | `WC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7967 | `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7988 | `jC — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7989 | `jC — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7993 | `jC — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7994 | `RTCPeerConnection.prototype.addTransceiver — 添加 RTCRtpTransceiver` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8065 | `qC — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8066 | `qC — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8068 | `qC — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8070 | `RTCPeerConnection.prototype.createOffer — 创建 SDP Offer（兼容不同浏览器格式差异）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8086 | `zC — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8087 | `zC — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8089 | `zC — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8091 | `RTCPeerConnection.prototype.createAnswer — 创建 SDP Answer` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8146 | `YC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8149 | `YC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8151 | `YC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8152 | `RTCPeerConnection.prototype.getLocalStreams — 获取本地流列表（非标准 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8156 | `YC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8159 | `YC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8161 | `YC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8163 | `RTCPeerConnection.prototype.addStream — 添加 MediaStream（旧版 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8171 | `YC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8172 | `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8186 | `YC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8188 | `YC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8189 | `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8213 | `XC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8214 | `XC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8216 | `XC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8217 | `RTCPeerConnection.prototype.getRemoteStreams — 原型方法` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8221 | `XC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8224 | `XC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8251 | `XC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8253 | `XC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8255 | `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8288 | `QC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8289 | `QC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8339 | `QC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8340 | `QC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8368 | `$C — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8371 | `eb — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8372 | `eb — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8374 | `eb — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8397 | `eb — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8399 | `eb — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8420 | `ib — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8422 | `ib — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8424 | `RTCPeerConnection.prototype.createOffer — 创建 SDP Offer（兼容不同浏览器格式差异）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9164 | `ub — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9165 | `ub — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9166 | `ub — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9172 | `ub — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9174 | `ub — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9176 | `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9276 | `hb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9294 | `hb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9296 | `hb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9298 | `RTCPeerConnection.prototype.createDataChannel — 创建 RTCDataChannel 数据通道` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9309 | `RTCPeerConnection.prototype.createDataChannel — 创建 RTCDataChannel 数据通道` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9314 | `pb — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9315 | `pb — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9372 | `mb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9375 | `mb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9377 | `mb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9379 | `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9400 | `_b — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9401 | `_b — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9406 | `_b — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9407 | `RTCPeerConnection.prototype.addIceCandidate — 添加 ICE 候选地址` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9424 | `fb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9425 | `fb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9430 | `fb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9431 | `RTCPeerConnection.prototype.setLocalDescription — 设置本地 SDP 描述` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9481 | `r — 内部函数` | SDP 与配置 | `02-RTCPeerConnection-usage-analysis.md` |
| L15653 | `hL — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L15751 | `detectEncodeByPeerConnection — 通过 RTCPeerConnection 检测浏览器支持的编码格式` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L15771 | `detectEncodeByPeerConnection — 通过 RTCPeerConnection 检测浏览器支持的编码格式` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L15795 | `detectDecodeByPeerConnection — 通过 RTCPeerConnection 检测浏览器支持的解码格式` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L15814 | `detectDecodeByPeerConnection — 通过 RTCPeerConnection 检测浏览器支持的解码格式` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16116 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16117 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16313 | `isSmallStreamSupported — 检测是否支持 Simulcast/SVC 分层编码小流` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16324 | `hasGetReceivers — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16330 | `hasGetSenders — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16336 | `hasGetTransceivers — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16343 | `hasAddTransceiver — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16378 | `checkWebRTCSupport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16872 | `dispatchStateChange — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L37447 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L37461 | `closePeerConnection — 关闭并清理 RTCPeerConnection 连接` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L37547 | `getPeerConnection — 获取指定方向的 RTCPeerConnection 实例` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L45439 | `asyncGeneratorWrap — 方法` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L46170 | `extends 类 — extends` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L46204 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L46460 | `extends 类 — extends` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47538 | `extends 类 — extends` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L49745 | `initSinglePC — 初始化单 RTCPeerConnection 模式（主播推流）` | TRTCRoom 与业务编排 | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
## `RTCSessionDescription`（10 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L6997 | `o — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7515 | `o — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7610 | `RTCPeerConnection.prototype.setLocalDescription — 设置本地 SDP 描述` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7654 | `RTCPeerConnection.prototype.removeTrack — 从 RTCPeerConnection 移除 MediaStreamTrack` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7668 | `MC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7840 | `FC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7977 | `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7978 | `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9388 | `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9389 | `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
## `RTCIceCandidate`（13 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L6997 | `o — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7654 | `RTCPeerConnection.prototype.removeTrack — 从 RTCPeerConnection 移除 MediaStreamTrack` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7668 | `MC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7840 | `FC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7977 | `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7978 | `RTCPeerConnection.prototype.removeStream — 移除 MediaStream（旧版 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9097 | `lb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9098 | `lb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9100 | `lb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9131 | `lb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9137 | `lb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9146 | `db — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9147 | `db — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
## `RTCRtpSender/Receiver/Transceiver`（58 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L7077 | `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7078 | `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7106 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7168 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7169 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7174 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7183 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7269 | `o — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7270 | `o — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7275 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7276 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7282 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7303 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7304 | `RTCRtpSender.prototype.getStats — 获取 WebRTC 连接统计信息` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7312 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7318 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7328 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7329 | `RTCRtpReceiver.prototype.getStats — 获取 WebRTC 连接统计信息` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7337 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7635 | `RTCPeerConnection.prototype.removeTrack — 从 RTCPeerConnection 移除 MediaStreamTrack` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7898 | `BC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7899 | `BC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7904 | `BC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7925 | `BC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7926 | `RTCRtpSender.prototype.getStats — 获取 WebRTC 连接统计信息` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7932 | `RTCRtpSender.prototype.getStats — 获取 WebRTC 连接统计信息` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7933 | `RTCRtpSender.prototype.getStats — 获取 WebRTC 连接统计信息` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7936 | `HC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7937 | `HC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7942 | `HC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7952 | `HC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7953 | `RTCRtpReceiver.prototype.getStats — 获取 WebRTC 连接统计信息` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7959 | `RTCRtpReceiver.prototype.getStats — 获取 WebRTC 连接统计信息` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7960 | `RTCRtpReceiver.prototype.getStats — 获取 WebRTC 连接统计信息` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7993 | `jC — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8047 | `JC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8048 | `JC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8052 | `JC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8053 | `RTCRtpSender.prototype.getParameters — 原型方法` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9485 | `r — 内部函数` | SDP 与配置 | `02-RTCPeerConnection-usage-analysis.md` |
| L16307 | `isSmallStreamSupported — 检测是否支持 Simulcast/SVC 分层编码小流` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16351 | `hasTransceiverStop — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16353 | `hasTransceiverStop — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16359 | `hasReplaceTrack — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16365 | `hasSetParameters — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16367 | `hasSetParameters — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16371 | `hasSetParameters — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16475 | `hasVideoFrameCallback — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16625 | `getH264ProfileSupport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16627 | `getH264ProfileSupport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16654 | `getH264ProfileSupport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16656 | `getH264ProfileSupport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L38983 | `e 类 — e` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L39009 | `e 类 — e` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L39083 | `e 类 — e` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L39155 | `e 类 — e` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L48504 | `addTrackByTransceiver — 通过 RTCRtpTransceiver 添加轨道` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48548 | `removeTrackByTransceiver — 通过 RTCRtpTransceiver 移除轨道` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
## `WebSocket`（17 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L11818 | `$D — 源码命名函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L16434 | `getBrowserCapabilityReport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L18843 | `connect — 建立 WebSocket 信令连接` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L18858 | `disconnect — 断开 WebSocket 信令连接` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L24970 | `e 类 — e` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25017 | `e 类 — e` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25908 | `extends 类 — extends` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L26329 | `extends 类 — extends` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L36866 | `extends 类 — extends` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L36901 | `extends 类 — extends` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L36905 | `connectWS — 建立 WebSocket 连接` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L36928 | `extends 类 — extends` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L36936 | `extends 类 — extends` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L36944 | `extends 类 — extends` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L38161 | `e 类 — e` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L39357 | `e 类 — e` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L46340 | `extends 类 — extends` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
## `RTCDataChannel`（3 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L7982 | `GC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9296 | `hb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L46229 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
## `getUserMedia`（8 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L7730 | `shimGetDisplayMedia — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7750 | `VC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8134 | `shimGetDisplayMedia — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8358 | `ZC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L19318 | `handleEncryption — 源码命名函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20299 | `retryFunction — 内部函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L27066 | `i — 内部函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L34064 | `request — 发送 HTTP 请求（内部工具方法，含超时和错误处理）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
## `enumerateDevices`（4 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L6895 | `n — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L19283 | `$V — 源码命名函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19298 | `handleEncryption — 源码命名函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19324 | `handleEncryption — 源码命名函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
## `getDisplayMedia`（3 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L27004 | `i — 内部函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L35014 | `stopLocalVideo — 停止本地摄像头视频采集并取消推送` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35016 | `stopLocalVideo — 停止本地摄像头视频采集并取消推送` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
## `MediaStream`（19 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L7492 | `RTCPeerConnection.prototype.addStream — 添加 MediaStream（旧版 API 兼容垫片）` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7554 | `RTCPeerConnection.prototype.addTrack — 添加 MediaStreamTrack 到 RTCPeerConnection` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L17596 | `doResume — 执行恢复操作` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L17770 | `doReplayByRecreateMediaStream — 通过重建 MediaStream 重新播放` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18154 | `initializeElement — 方法` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18358 | `setTrack — 方法` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18955 | `getOrCreateAudioNode — 内部函数` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L19481 | `getMediaStream — 获取当前 MediaStream` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19606 | `setTrack — 方法` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19650 | `setTrack — 方法` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19651 | `setTrack — 方法` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L23142 | `capture — 捕获当前帧` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L27129 | `capture — 捕获当前帧` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27418 | `getPCM — 获取 PCM 音频数据` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L38654 | `publishByTransceiver — 通过 addTransceiver API 推流` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L38722 | `publishByAddTrack — 通过 addTrack API 推流` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L38731 | `publishByAddTrack — 通过 addTrack API 推流` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L39030 | `addTrackBySender — 通过 RTCRtpSender 添加轨道` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L39034 | `addTrackBySender — 通过 RTCRtpSender 添加轨道` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
## `MediaStreamTrack`（34 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L7113 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7124 | `DC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7294 | `NC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7344 | `RTCPeerConnection.prototype.getStats — 获取 WebRTC 连接统计信息` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7388 | `OC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7437 | `OC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7529 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7628 | `PC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7745 | `VC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L7916 | `BC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8171 | `YC — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L12239 | `getValueType — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12574 | `getMediaStreamTrackInfo — 获取 MediaStreamTrack 的详细信息（类型、ID、状态等）` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L16368 | `hasSetParameters — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16369 | `hasSetParameters — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17440 | `validateMethodArgs — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18954 | `getOrCreateAudioNode — 内部函数` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L19433 | `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20081 | `setInputMediaStreamTrack — 设置输入 MediaStreamTrack` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20099 | `setOutputMediaStreamTrack — 设置输出 MediaStreamTrack` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L23169 | `e 类 — e` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23391 | `isNeedToRecapture — 检查是否需要重新采集` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23403 | `isNeedToRecapture — 检查是否需要重新采集` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23699 | `e 类 — e` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24051 | `e 类 — e` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L27897 | `codecParameters 类 — codecParameters` | 远端 Track 与播放 | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| L29900 | `mergeVideoProfile — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L29917 | `mergeVideoProfile — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L29918 | `mergeVideoProfile — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L29937 | `validate — 校验/验证数据合法性` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L31478 | `maskSensitiveData — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L35018 | `stopLocalVideo — 停止本地摄像头视频采集并取消推送` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35444 | `getAudioTrack — 获取本地音频 MediaStreamTrack` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35468 | `getVideoTrack — 获取本地视频 MediaStreamTrack` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
## `Track constraints/settings/capabilities`（26 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L16627 | `getH264ProfileSupport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16656 | `getH264ProfileSupport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L19340 | `handleEncryption — 源码命名函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19652 | `setTrack — 方法` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20193 | `emitFirstVideoFrameEvent — 发射首帧视频事件` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20307 | `retryFunction — 内部函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20380 | `findTrackByDeviceId — 内部函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L23332 | `updateDeviceIdInUse — 更新当前使用的设备 ID` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23395 | `isNeedToRecapture — 检查是否需要重新采集` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23407 | `isNeedToRecapture — 检查是否需要重新采集` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23846 | `update3A — 更新 3A（AGC/AEC/ANS）参数` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23860 | `update3A — 更新 3A（AGC/AEC/ANS）参数` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24311 | `e 类 — e` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24435 | `applyProfile — 应用编码 Profile 配置` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24449 | `applyProfile — 应用编码 Profile 配置` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24463 | `applyProfile — 应用编码 Profile 配置` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24479 | `e 类 — e` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L26790 | `updateCameraSource — 更新摄像头源` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27017 | `i — 内部函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L35018 | `stopLocalVideo — 停止本地摄像头视频采集并取消推送` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L38904 | `updateMediaSettings — 更新媒体设置` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L38912 | `updateMediaSettings — 更新媒体设置` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L38926 | `updateMediaSettings — 更新媒体设置` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L48423 | `updateMediaSettings — 更新媒体设置` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48431 | `updateMediaSettings — 更新媒体设置` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48446 | `updateMediaSettings — 更新媒体设置` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
## `Track lifecycle`（56 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L6971 | `CC — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L12931 | `sendHttpRequest — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L16109 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17440 | `validateMethodArgs — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L17610 | `replay — 重新播放` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18328 | `stop — 停止本地流播放` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L19324 | `handleEncryption — 源码命名函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19544 | `stop — 停止本地流播放` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19724 | `stop — 停止本地流播放` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19948 | `playSubContainer — 方法` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20010 | `stop — 停止本地流播放` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20015 | `stop — 停止本地流播放` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20034 | `close — 关闭本地流并释放所有轨道` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20140 | `updatePlayingState — 更新播放状态` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L23143 | `capture — 捕获当前帧` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23164 | `capture — 捕获当前帧` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23477 | `recapture — 重新捕获屏幕/设备` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23507 | `recapture — 重新捕获屏幕/设备` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23546 | `stopCapture — 停止捕获` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23770 | `switchDevice — 切换采集设备` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24515 | `switchDevice — 切换采集设备` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L25493 | `close — 关闭本地流并释放所有轨道` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25738 | `close — 关闭本地流并释放所有轨道` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L28515 | `stop — 停止本地流播放` | 远端 Track 与播放 | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| L32362 | `stop — 停止本地流播放` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32409 | `destroyAllMusic — 销毁所有音乐资源` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L33048 | `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L33502 | `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L33827 | `decode — 解码视频/音频数据` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L34066 | `request — 发送 HTTP 请求（内部工具方法，含超时和错误处理）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L34836 | `stopLocalAudio — 停止本地麦克风音频采集并取消推送` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35005 | `stopLocalVideo — 停止本地摄像头视频采集并取消推送` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35281 | `_stopRemoteVideo — 内部：停止远端视频播放` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35282 | `_stopRemoteVideo — 内部：停止远端视频播放` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35377 | `stopPlugin — 停止并卸载指定名称的插件` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35463 | `getAudioTrack — 获取本地音频 MediaStreamTrack` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35487 | `getVideoTrack — 获取本地视频 MediaStreamTrack` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35622 | `_stopRemoteAudio — 内部：停止远端音频播放` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35693 | `_updateVideoPlayOption — 内部：更新视频播放选项` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35864 | `_stopScreenShare — 内部：停止屏幕共享的逻辑` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35869 | `_stopScreenShare — 内部：停止屏幕共享的逻辑` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L39063 | `removeSender — 移除发送器` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L42395 | `stopDurationItem — 停止计时项` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L42498 | `installEvents — 安装事件监听器` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L42667 | `stopDataFreeze — 停止数据卡顿检测` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L42714 | `getDataFreezeDuration — 获取数据卡顿时长` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L44834 | `updateAr — 更新 AR 效果` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L44843 | `disableAr — 禁用 AR 功能` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L47697 | `checkOnce — 单次检查` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47718 | `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48210 | `publishSmall — 发布 Simulcast 小流` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48276 | `unpublishSmall — 取消发布小流` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L49047 | `subscribe — 订阅远端用户的音视频流` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L49051 | `subscribe — 订阅远端用户的音视频流` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L49129 | `unsubscribe — 取消订阅远端用户的音视频流` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L50107 | `clearNetworkQuality — 清除网络质量数据` | TRTCRoom 与业务编排 | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
## `AudioContext`（20 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L8457 | `rb — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L16270 | `isWebAudioSupported — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17434 | `validateMethodArgs — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L17441 | `validateMethodArgs — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L17952 | `pV — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18444 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18445 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18446 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18449 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18450 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18451 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18452 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18455 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18456 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18457 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18814 | `replaceSource — 替换音频源` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L19434 | `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19435 | `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19436 | `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L24027 | `e 类 — e` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
## `AudioWorklet`（16 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L11246 | `setSdkVersion — 设置 SDK 版本号` | SDP 与配置 | `02-RTCPeerConnection-usage-analysis.md` |
| L12244 | `getValueType — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L17235 | `构造函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L18432 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18435 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18897 | `setVolume — 设置音量` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L18900 | `setVolume — 设置音量` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L19003 | `preload — 预加载资源` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L19019 | `initAudioWorklet — 初始化 AudioWorklet（音量检测等）` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L19437 | `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L27231 | `startPCMCapture — 内部函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27239 | `startPCMCapture — 内部函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27272 | `extends 类 — extends` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L31740 | `start — 启动组件/模块（开始工作流程）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L31750 | `start — 启动组件/模块（开始工作流程）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32692 | `start — 启动组件/模块（开始工作流程）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
## `Web Audio nodes`（15 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L18786 | `setVolume — 设置音量` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L18890 | `setVolume — 设置音量` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L18906 | `构造函数` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L18955 | `getOrCreateAudioNode — 内部函数` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L19045 | `initScriptProcessor — 初始化 ScriptProcessor 音频处理` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L19434 | `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19435 | `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19436 | `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19450 | `构造函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19515 | `play — 播放本地流（渲染到指定 DOM 元素）` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L23882 | `setAudioVolume — 设置音频音量` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23917 | `mixAudioReference — 混音音频参考` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L27336 | `dump — 导出调试数据` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27418 | `getPCM — 获取 PCM 音频数据` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L31756 | `start — 启动组件/模块（开始工作流程）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
## `HTMLMediaElement`（6 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L12245 | `getValueType — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12634 | `loadVideo — 加载视频元素` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L16221 | `isScreenShareSupported — 检测浏览器是否支持 getDisplayMedia 屏幕共享` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17438 | `validateMethodArgs — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L17439 | `validateMethodArgs — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L17952 | `pV — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
## `Media playback`（52 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L12641 | `loadVideo — 加载视频元素` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L17438 | `validateMethodArgs — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L17526 | `play — 播放本地流（渲染到指定 DOM 元素）` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L17576 | `pause — 暂停播放` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L17597 | `doResume — 执行恢复操作` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L17610 | `replay — 重新播放` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L17952 | `pV — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18107 | `createAutoPlayDialog — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18108 | `createAutoPlayDialog — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18109 | `createAutoPlayDialog — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18110 | `createAutoPlayDialog — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18341 | `play — 播放本地流（渲染到指定 DOM 元素）` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18412 | `i — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18416 | `calculateStat — 方法` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L19512 | `play — 播放本地流（渲染到指定 DOM 元素）` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19710 | `setVolume — 设置音量` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19901 | `play — 播放本地流（渲染到指定 DOM 元素）` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19970 | `playSubContainer — 方法` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19977 | `setAudioOutput — 设置音频输出设备` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20134 | `updatePlayingState — 更新播放状态` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L24722 | `play — 播放本地流（渲染到指定 DOM 元素）` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25598 | `tryVideoFrameCallback — 尝试使用 VideoFrameCallback` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25601 | `tryVideoFrameCallback — 尝试使用 VideoFrameCallback` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25726 | `构造函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25732 | `replaceTrack — 替换本地流中的指定轨道` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L26617 | `setFpsAuto — 自动设置视频帧率` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L26629 | `setFpsAuto — 自动设置视频帧率` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L26938 | `stopVideoElement — 停止视频元素` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L28395 | `play — 播放本地流（渲染到指定 DOM 元素）` | 远端 Track 与播放 | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| L32139 | `play — 播放本地流（渲染到指定 DOM 元素）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32140 | `play — 播放本地流（渲染到指定 DOM 元素）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32149 | `pause — 暂停播放` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32157 | `stop — 停止本地流播放` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32163 | `setOperation — 设置播放器操作状态（暂停/恢复/停止）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32164 | `setOperation — 设置播放器操作状态（暂停/恢复/停止）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32165 | `setOperation — 设置播放器操作状态（暂停/恢复/停止）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32263 | `start — 启动组件/模块（开始工作流程）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32288 | `handleAutoPlayFailed — 处理自动播放失败（用户交互后恢复）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32298 | `t — 源码命名函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32316 | `asyncGeneratorWrap — 方法` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L33983 | `pauseRemotePlayer — 暂停远端播放器` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L33984 | `pauseRemotePlayer — 暂停远端播放器` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L33985 | `pauseRemotePlayer — 暂停远端播放器` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L33986 | `pauseRemotePlayer — 暂停远端播放器` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L33987 | `pauseRemotePlayer — 暂停远端播放器` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L33995 | `pauseRemotePlayer — 暂停远端播放器` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L33996 | `pauseRemotePlayer — 暂停远端播放器` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L35687 | `_updateVideoPlayOption — 内部：更新视频播放选项` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35693 | `_updateVideoPlayOption — 内部：更新视频播放选项` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35713 | `_updateAudioPlayOption — 内部：更新音频播放选项` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L42786 | `s — 源码命名函数` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L42789 | `onRemoteVideoPlayStart — 远端视频开始播放回调` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
## `Canvas 2D`（22 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L15774 | `detectEncodeByPeerConnection — 通过 RTCPeerConnection 检测浏览器支持的编码格式` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L15775 | `detectEncodeByPeerConnection — 通过 RTCPeerConnection 检测浏览器支持的编码格式` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L15886 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16092 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16115 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L18278 | `setCanvas — 方法` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18368 | `getVideoFrame — 方法` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18376 | `getVideoFrame — 方法` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18377 | `getVideoFrame — 方法` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L24902 | `构造函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25203 | `draw2d — 2D 绘制` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25205 | `draw2d — 2D 绘制` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25403 | `构造函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25510 | `render — 渲染视频帧到画布` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25513 | `render — 渲染视频帧到画布` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L26104 | `create — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L28297 | `draw2d — 2D 绘制` | 远端 Track 与播放 | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| L43421 | `centerFace — 人脸居中` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L44577 | `getWatermarkImage — 获取水印图片` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L44596 | `u — 内部函数` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L44598 | `u — 内部函数` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L47598 | `getWorker — 获取 Worker 实例` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
## `WebGL`（42 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L13652 | `getGPUInfo — 内部函数` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L24912 | `构造函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L24920 | `构造函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L24923 | `构造函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L24929 | `构造函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L24932 | `构造函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L24934 | `构造函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L24960 | `createFramebuffer — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L24964 | `createFramebuffer — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25096 | `useBufferFrame — 使用缓冲区帧` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25179 | `resize — 调整渲染尺寸` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25191 | `draw — 绘制视频帧` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25243 | `createTexture — 创建 WebGL 纹理` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25253 | `createTexture — 创建 WebGL 纹理` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25651 | `_render — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25955 | `create — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25959 | `create — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25963 | `create — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25967 | `create — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L26023 | `createShader — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L26026 | `createShader — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L26033 | `createProgram — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L26037 | `createProgram — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L26038 | `createProgram — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L26039 | `createProgram — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L43211 | `init — 初始化组件/模块（分配资源和建立内部状态）` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43214 | `init — 初始化组件/模块（分配资源和建立内部状态）` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43227 | `init — 初始化组件/模块（分配资源和建立内部状态）` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43231 | `init — 初始化组件/模块（分配资源和建立内部状态）` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43236 | `init — 初始化组件/模块（分配资源和建立内部状态）` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43295 | `onPredict — 预测回调` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43296 | `onPredict — 预测回调` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43321 | `onPredict — 预测回调` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43337 | `onFirstFrame — 首帧渲染回调` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43366 | `render — 渲染视频帧到画布` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43376 | `render — 渲染视频帧到画布` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43378 | `render — 渲染视频帧到画布` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43404 | `render — 渲染视频帧到画布` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43506 | `_initTexture — 方法` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43554 | `resize — 调整渲染尺寸` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43557 | `resize — 调整渲染尺寸` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43560 | `resize — 调整渲染尺寸` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
## `OffscreenCanvas`（5 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L15739 | `warnHttpNotSupported — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L24897 | `构造函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L24898 | `构造函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25626 | `_render — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L47598 | `getWorker — 获取 Worker 实例` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
## `Worker`（3 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L17064 | `e 类 — e` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L46137 | `initScriptTransformWorker — 初始化脚本转换 Worker` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47604 | `getWorker — 获取 Worker 实例` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
## `Streams`（35 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L12975 | `sendLogDataToServer — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L18831 | `构造函数` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L18832 | `构造函数` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L18833 | `构造函数` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L18834 | `构造函数` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L18835 | `构造函数` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L18836 | `构造函数` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L19415 | `构造函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19619 | `构造函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19620 | `构造函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19621 | `构造函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L21882 | `abortableObservable — 内部函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L21883 | `abortableObservable — 内部函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L22923 | `qB — 内部函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L23661 | `构造函数` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23662 | `构造函数` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23663 | `构造函数` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23922 | `mixAudioReference — 混音音频参考` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L27251 | `startPCMCapture — 内部函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27365 | `dump — 导出调试数据` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27366 | `dump — 导出调试数据` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27387 | `getPCM — 获取 PCM 音频数据` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27388 | `getPCM — 获取 PCM 音频数据` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27420 | `getPCM — 获取 PCM 音频数据` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27421 | `getPCM — 获取 PCM 音频数据` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L45764 | `createSEITransformStream — 内部函数` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L45803 | `createInsertableStreamTransform — 内部函数` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L46131 | `initScriptTransformWorker — 初始化脚本转换 Worker` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47598 | `getWorker — 获取 Worker 实例` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48117 | `createEncodedStreams — 创建编码流（Insertable Streams）` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48118 | `createEncodedStreams — 创建编码流（Insertable Streams）` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48139 | `createEncodedStreams — 创建编码流（Insertable Streams）` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48955 | `createEncodedStreams — 创建编码流（Insertable Streams）` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48956 | `createEncodedStreams — 创建编码流（Insertable Streams）` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48965 | `createEncodedStreams — 创建编码流（Insertable Streams）` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
## `Encoded Transform`（9 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L16372 | `hasSetParameters — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L46119 | `initScriptTransformWorker — 初始化脚本转换 Worker` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48075 | `d — 内部函数` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48112 | `createEncodedStreams — 创建编码流（Insertable Streams）` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48154 | `initSenderTransform — 初始化发送端 Transform Stream` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48193 | `publishSmall — 发布 Simulcast 小流` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48926 | `onTrack — 轨道事件回调` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48935 | `createEncodedStreams — 创建编码流（Insertable Streams）` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48981 | `initReceiverTransform — 初始化接收端 Transform Stream` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
## `WebCodecs`（17 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L15654 | `hL — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L15716 | `isWebCodecsApiAvailable — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L15945 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L15954 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L15978 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16385 | `checkWebCodecsSupport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16389 | `checkWebCodecsSupport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16390 | `checkWebCodecsSupport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16391 | `checkWebCodecsSupport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16392 | `checkWebCodecsSupport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16393 | `checkWebCodecsSupport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L25207 | `draw2d — 2D 绘制` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25628 | `_render — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25629 | `_render — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L28112 | `extends 类 — extends` | 远端 Track 与播放 | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| L33722 | `asyncGeneratorWrap — 方法` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L33749 | `decodeFrame — 解码视频帧` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
## `WebAssembly`（7 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L14779 | `codecType — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16414 | `isWasmSimdSupported — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16415 | `isWasmSimdSupported — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L31086 | `loadWasm — 加载 WebAssembly 模块` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L31097 | `loadWasm — 加载 WebAssembly 模块` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L31108 | `r — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L31121 | `r — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
## `fetch`（8 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L12928 | `sendHttpRequest — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L21815 | `fromFetchObservable — 内部函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L30943 | `sendLogReport — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L30944 | `sendLogReport — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L31041 | `downloadWithFetch — 使用 Fetch API 下载` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L31104 | `loadWasm — 加载 WebAssembly 模块` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L31877 | `getAuthData — 获取认证数据（签名等）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L40733 | `asyncGeneratorWrap — 方法` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
## `XMLHttpRequest`（3 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L12939 | `sendHttpRequest — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L31059 | `downloadWithXHR — 使用 XMLHttpRequest 下载` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L31066 | `downloadWithXHR — 使用 XMLHttpRequest 下载` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
## `sendBeacon`（2 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L42183 | `upload — 上传日志数据到服务器` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L42216 | `uploadKVStat — 上传 KV 统计` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
## `URL/Blob`（52 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L4922 | `Ky — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L4924 | `Ky — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L4940 | `Ky — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L4942 | `Ky — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L4943 | `Ky — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L4944 | `Ky — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L4945 | `Ky — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L4947 | `Ky — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L5181 | `fromCodePoint — 内部函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L5562 | `get — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L5665 | `HA — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L5668 | `HA — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L5669 | `HA — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L5671 | `HA — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L5811 | `sC — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L6627 | `get — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L6631 | `get — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L6636 | `toJSON — 内部函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L8366 | `$C — 源码命名函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L12066 | `xorEncryptBlock — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12070 | `buildLoggerUrl — 构建日志上报 URL` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12974 | `sendLogDataToServer — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L14138 | `checkURLParam — 方法` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L17065 | `e 类 — e` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17066 | `e 类 — e` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17501 | `setUrl — 设置 URL` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L19005 | `preload — 预加载资源` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L27228 | `startPCMCapture — 内部函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27229 | `startPCMCapture — 内部函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27350 | `c — 内部函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27358 | `c — 内部函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L30942 | `sendLogReport — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L31655 | `doPreload — 预加载` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L31667 | `doPreload — 预加载` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32103 | `reload — 重新加载资源` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32104 | `reload — 重新加载资源` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32545 | `doPreload — 预加载` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32557 | `doPreload — 预加载` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L33471 | `start — 启动组件/模块（开始工作流程）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L33519 | `openDebugDiaLog — 打开调试弹窗` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L34278 | `value — 方法` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L36826 | `extends 类 — extends` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L37067 | `extends 类 — extends` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L46135 | `initScriptTransformWorker — 初始化脚本转换 Worker` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L46136 | `initScriptTransformWorker — 初始化脚本转换 Worker` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L46140 | `initScriptTransformWorker — 初始化脚本转换 Worker` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L46371 | `connect — 建立 WebSocket 信令连接` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47596 | `getWorker — 获取 Worker 实例` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47602 | `getWorker — 获取 Worker 实例` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47605 | `getWorker — 获取 Worker 实例` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48046 | `publish — 发布本地音视频流到房间` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L51210 | `getSignalChannelUrl — 获取信令通道 URL` | TRTCRoom 与业务编排 | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
## `Storage`（12 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L13542 | `isLocalStorageAvailable — 检查 localStorage 是否可用` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L13553 | `isLocalStorageAvailable — 检查 localStorage 是否可用` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L14188 | `checkStorage — 检查存储状态` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L14194 | `checkStorage — 检查存储状态` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L14208 | `checkStorage — 检查存储状态` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L14217 | `doFlush — 方法` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L14231 | `getItem — 获取缓存项` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L14267 | `deleteItem — 删除缓存项` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L14281 | `clear — 清除所有数据` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L15299 | `nL — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L33472 | `start — 启动组件/模块（开始工作流程）` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L33520 | `openDebugDiaLog — 打开调试弹窗` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
## `Permissions`（1 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L34079 | `get — HTTP GET 请求便捷封装` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
## `Navigator/UA`（19 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L9473 | `r — 内部函数` | SDP 与配置 | `02-RTCPeerConnection-usage-analysis.md` |
| L12095 | `getNetworkType — 检测当前网络类型（wifi/4g/3g/ethernet 等）` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L13332 | `error — 输出 ERROR 级别日志` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L13361 | `getVersionNumber — 源码命名函数` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L13613 | `fetchUserAgentData — 内部函数` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L13617 | `fetchUserAgentData — 内部函数` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L16028 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16202 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16401 | `isMediaSessionSupported — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16441 | `getBrowserCapabilityReport — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16450 | `saveCapabilityResult — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16460 | `loadAndDetectCapabilities — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17242 | `构造函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17710 | `handleElementEvent — 处理 DOM 元素事件` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L17717 | `handleElementEvent — 处理 DOM 元素事件` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L34270 | `value — 方法` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L34271 | `value — 方法` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L41262 | `initData — 初始化数据` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L49801 | `asyncGeneratorWrap — 方法` | TRTCRoom 与业务编排 | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
## `DOM`（44 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L2436 | `get — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L12414 | `getViewListFromView — 源码命名函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12422 | `getViewListFromView — 源码命名函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12634 | `loadVideo — 加载视频元素` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L13651 | `getGPUInfo — 内部函数` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L15304 | `nL — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L15772 | `detectEncodeByPeerConnection — 通过 RTCPeerConnection 检测浏览器支持的编码格式` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L15885 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16091 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17150 | `n — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17170 | `e 类 — e` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17970 | `构造函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18007 | `createDiaLog — 创建弹窗` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18020 | `createDiaLog — 创建弹窗` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18023 | `createDiaLog — 创建弹窗` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18029 | `createDiaLog — 创建弹窗` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18152 | `initializeElement — 方法` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18370 | `getVideoFrame — 方法` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18502 | `observableCreate — 源码命名函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18514 | `observableCreate — 源码命名函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18515 | `observableCreate — 源码命名函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18536 | `resumeAudioContext — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18539 | `resumeAudioContext — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L19693 | `setVolume — 设置音量` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20161 | `i — 源码命名函数` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20170 | `handleAutoPlayFailed — 处理自动播放失败（用户交互后恢复）` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20512 | `AU — 源码命名函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L24899 | `构造函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25362 | `update — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25364 | `update — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25385 | `close — 关闭本地流并释放所有轨道` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25402 | `构造函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25469 | `putCanvasIntoDom — 将 Canvas 插入到 DOM` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25952 | `create — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25954 | `create — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L26102 | `create — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27351 | `c — 内部函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L29753 | `构造函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L29928 | `validate — 校验/验证数据合法性` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L31155 | `loadScript — 加载外部脚本` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L35803 | `_observeView — 内部：监听视频渲染 DOM 元素的变化（尺寸适配）` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L42759 | `onRemoteVideoPlayStart — 远端视频开始播放回调` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L42800 | `onRemoteVideoPlayEnd — 远端视频播放结束回调` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L44574 | `getWatermarkImage — 获取水印图片` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
## `Page visibility`（25 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L17128 | `n — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17142 | `e — 源码命名函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17150 | `n — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17170 | `e 类 — e` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L18480 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18514 | `observableCreate — 源码命名函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18536 | `resumeAudioContext — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L19693 | `setVolume — 设置音量` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L19695 | `setVolume — 设置音量` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L20505 | `AU — 源码命名函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L20510 | `AU — 源码命名函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L20512 | `AU — 源码命名函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L20514 | `AU — 源码命名函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L23433 | `asyncGeneratorWrap — 方法` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L25359 | `update — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25362 | `update — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25364 | `update — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25385 | `close — 关闭本地流并释放所有轨道` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25443 | `enableCheckMute — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25600 | `tryVideoFrameCallback — 尝试使用 VideoFrameCallback` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25604 | `tryVideoFrameCallback — 尝试使用 VideoFrameCallback` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L42756 | `o — 内部函数` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L42759 | `onRemoteVideoPlayStart — 远端视频开始播放回调` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L42800 | `onRemoteVideoPlayEnd — 远端视频播放结束回调` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L50029 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | TRTCRoom 与业务编排 | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
## `Timers/scheduling`（118 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L2385 | `nu — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L12548 | `delay — 延迟执行` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L13056 | `doReject — 源码命名函数` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L13066 | `doRetry — 内部函数` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L13922 | `uploadInterval — 定时上传日志` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L14187 | `checkStorage — 检查存储状态` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L15880 | `o — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L15904 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16095 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16104 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16105 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16106 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16111 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L16136 | `asyncGeneratorWrap — 方法` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17001 | `updateDevTools — 更新开发者工具信息` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17010 | `updateDevTools — 更新开发者工具信息` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17056 | `e 类 — e` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17068 | `e 类 — e` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17096 | `i — 源码命名函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17100 | `e 类 — e` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17133 | `n — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17136 | `n — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17138 | `n — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17146 | `e — 源码命名函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17166 | `e 类 — e` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17167 | `e 类 — e` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17169 | `e 类 — e` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17316 | `sendRequest — 发送请求` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L17519 | `play — 播放本地流（渲染到指定 DOM 元素）` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L17551 | `stop — 停止本地流播放` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L17566 | `destroyElement — 方法` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18407 | `i — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18484 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18489 | `initAudioWorklet — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18497 | `observableCreate — 源码命名函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18513 | `observableCreate — 源码命名函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18528 | `resumeAudioContext — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18529 | `resumeAudioContext — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L18533 | `resumeAudioContext — 内部函数` | HTML 媒体播放与自动播放 | `07-Media-Playback-and-Rendering.md` |
| L19689 | `setVolume — 设置音量` | 媒体设备与 Track 基础 | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| L21661 | `deferObservable — 内部函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L21701 | `intervalObservable — 内部函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L21707 | `intervalObservable — 内部函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L21724 | `timerObservable — 内部函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L21728 | `timerObservable — 内部函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L21732 | `timerObservable — 内部函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L21739 | `o — 内部函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L21920 | `animationFrameObservable — 内部函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L21922 | `animationFrameObservable — 内部函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L21925 | `animationFrameObservable — 内部函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L22743 | `构造函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L22764 | `dispose — 方法` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L22783 | `dispose — 方法` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L22789 | `delay — 延迟执行` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L22811 | `complete — 完成操作` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L22989 | `构造函数` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L22995 | `next — 执行下一步（迭代器）` | 响应式与内部异步工具 | `00-Reading-Guide-and-Source-Map.md` |
| L23001 | `dispose — 方法` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23240 | `l — 内部函数` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23422 | `onTrackMuted — 轨道被静音回调` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23423 | `onTrackMuted — 轨道被静音回调` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23445 | `onTrackUnmuted — 轨道取消静音回调` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23457 | `onTrackEnded — 轨道结束回调` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L23615 | `fail — 操作失败回调` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L26590 | `setFps — 设置视频帧率` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27340 | `dump — 导出调试数据` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27361 | `c — 内部函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27807 | `checkSubscribeParams — 校验远端订阅请求参数是否合法` | 远端 Track 与播放 | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| L27824 | `checkSubscribeParams — 校验远端订阅请求参数是否合法` | 远端 Track 与播放 | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| L30612 | `createUpdateMergeHook — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L30614 | `createUpdateMergeHook — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L34697 | `_clearRemoteTracks — 内部：清理所有远端轨道` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35811 | `_observeView — 内部：监听视频渲染 DOM 元素的变化（尺寸适配）` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L35812 | `_observeView — 内部：监听视频渲染 DOM 元素的变化（尺寸适配）` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L36329 | `asyncGeneratorWrap — 方法` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L36340 | `asyncGeneratorWrap — 方法` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L36341 | `asyncGeneratorWrap — 方法` | SDK 对外门面 | `00-Reading-Guide-and-Source-Map.md` |
| L36917 | `connectWS — 建立 WebSocket 连接` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L36924 | `connectWS — 建立 WebSocket 连接` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L37169 | `l — 源码命名函数` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L37174 | `sendWaitForResponse — 发送请求并等待响应` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L37187 | `u — 源码命名函数` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L37249 | `close — 关闭本地流并释放所有轨道` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L37303 | `stopKeepAliveIn — 停止内部保活机制` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L37314 | `t — 源码命名函数` | WebSocket 信令 | `03-WebSocket-usage-analysis.md` |
| L37627 | `i — 源码命名函数` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L37634 | `r — 源码命名函数` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L37649 | `waitForPeerConnectionConnected — 等待 PeerConnection 连接成功` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L37691 | `clearReconnectionTimer — 清除重连定时器` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L38422 | `reconnect — 重新建立信令连接` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L38439 | `clearReconnectionTimer — 清除重连定时器` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L39554 | `reconnect — 重新建立信令连接` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L40724 | `asyncGeneratorWrap — 方法` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L40736 | `asyncGeneratorWrap — 方法` | MPC 与 WebRTC Stats | `02-RTCPeerConnection-usage-analysis.md` |
| L41515 | `handleJoinFailed — 处理加入房间失败` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L42955 | `processFacePositionCrop — 处理人脸位置裁剪` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L42959 | `processFacePositionCrop — 处理人脸位置裁剪` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L42974 | `processFacePositionPortrait — 处理人脸人像位置` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L42978 | `processFacePositionPortrait — 处理人脸人像位置` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L44925 | `handleAbortError — 处理中止错误（用户取消操作时的清理）` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L46506 | `clearReconnectionTimer — 清除重连定时器` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L46608 | `i — 源码命名函数` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L46615 | `r — 源码命名函数` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L46630 | `waitForPeerConnectionConnected — 等待 PeerConnection 连接成功` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L46648 | `waitForPeerConnectionConnected — 等待 PeerConnection 连接成功` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47349 | `doSwitchRelay — 切换中继线路` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47356 | `doSwitchRelay — 切换中继线路` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47405 | `requestRemoteFallbackToH264 — 请求远端降级到 H264 编码` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47598 | `getWorker — 获取 Worker 实例` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L48861 | `close — 关闭本地流并释放所有轨道` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L49368 | `doSetJitterBufferDelay — 设置抖动缓冲延迟` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L49375 | `doSetJitterBufferDelay — 设置抖动缓冲延迟` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L49496 | `onReceiveMsg — 收到消息回调` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L49507 | `onReceiveMsg — 收到消息回调` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L49545 | `emitMessage — 发射消息事件` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L49820 | `asyncGeneratorWrap — 方法` | TRTCRoom 与业务编排 | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| L50122 | `clearJoinTimeout — 清除加入房间超时定时器` | TRTCRoom 与业务编排 | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| L51553 | `startUpdateNTPTime — 启动 NTP 时间同步` | TRTCRoom 与业务编排 | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
## `Encoding/binary`（102 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L1655 | `sort — 内部函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L1837 | `Ic — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L1838 | `Ic — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L2088 | `setFloat64 — 内部函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L2109 | `get — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L2112 | `get — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L2125 | `xl — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L2126 | `xl — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L2134 | `xl — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L3960 | `trim — 内部函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L3966 | `trim — 内部函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L4096 | `isView — 内部函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L4106 | `isView — 内部函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L4343 | `GT — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L4345 | `GT — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L4368 | `cv — 源码命名函数` | 运行时 Polyfill | `00-Reading-Guide-and-Source-Map.md` |
| L11677 | `flush — 刷新缓冲区（写入/清理缓存数据）` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11684 | `flush — 刷新缓冲区（写入/清理缓存数据）` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11696 | `write — 向缓冲区写入字节序列` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11699 | `write — 向缓冲区写入字节序列` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11700 | `write — 向缓冲区写入字节序列` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11734 | `malloc — 分配指定大小的内存空间` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11737 | `malloc — 分配指定大小的内存空间` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11745 | `malloc — 分配指定大小的内存空间` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11760 | `encodeVarint — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11780 | `$D — 源码命名函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11813 | `$D — 源码命名函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11887 | `decodeUtf8String — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11923 | `r — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11942 | `decodeTransportData — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11945 | `decodeTransportData — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11958 | `decodeTransportData — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11961 | `decodeTransportData — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11964 | `decodeTransportData — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11967 | `decodeTransportData — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11970 | `decodeTransportData — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11973 | `decodeTransportData — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11982 | `decodeTransportData — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11985 | `decodeTransportData — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11988 | `decodeTransportData — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L11999 | `r — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12001 | `r — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12002 | `r — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12003 | `r — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12032 | `decodeTransportData — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12741 | `concatArrayBuffers — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12744 | `concatArrayBuffers — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12788 | `parseBinaryPacketHeader — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12789 | `parseBinaryPacketHeader — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12793 | `parseBinaryPacketHeader — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12832 | `parseBinaryPacketHeader — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12892 | `r — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12908 | `tryDecryptBinaryBlock — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12910 | `tryDecryptBinaryBlock — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12916 | `tryDecryptBinaryBlock — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L12935 | `sendHttpRequest — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L13975 | `upload — 上传日志数据到服务器` | 浏览器检测、日志与存储 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L16416 | `isWasmSimdSupported — 内部函数` | 能力、事件与状态工具 | `10-Auxiliary-Browser-APIs.md` |
| L18724 | `构造函数` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L18730 | `setNode — 设置节点` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L19152 | `write — 向缓冲区写入字节序列` | Web Audio 与设备枚举 | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| L24098 | `addPreventionByte — 添加防检测字节` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24123 | `removePreventionByte — 移除防检测字节` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24160 | `removePreventionByte — 移除防检测字节` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24161 | `removePreventionByte — 移除防检测字节` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24187 | `encodeSEINalu — 编码 SEI NALU（H264 补充增强信息）` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24190 | `encodeSEINalu — 编码 SEI NALU（H264 补充增强信息）` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24212 | `getNaluCount — 获取 NALU 单元计数` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24243 | `encode — 编码视频/音频数据` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24244 | `encode — 编码视频/音频数据` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L24245 | `encode — 编码视频/音频数据` | 本地媒体 Track | `05-MediaStreamTrack-Lifecycle.md` |
| L25106 | `createBuffer — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25115 | `setTexBuffer — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25124 | `setPosBuffer — 设置位置缓冲区` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25132 | `changeBufferData — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27231 | `startPCMCapture — 内部函数` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27403 | `getPCM — 获取 PCM 音频数据` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27404 | `getPCM — 获取 PCM 音频数据` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27439 | `write — 向缓冲区写入字节序列` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L27440 | `write — 向缓冲区写入字节序列` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L28382 | `isAlphaSei — 方法` | 远端 Track 与播放 | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| L30246 | `validate — 校验/验证数据合法性` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L30284 | `validate — 校验/验证数据合法性` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32870 | `encodeSEIPayload — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32873 | `encodeSEIPayload — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32893 | `countAnnexbStartCodes — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32923 | `encapsulateSEIMessage — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32924 | `encapsulateSEIMessage — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32925 | `encapsulateSEIMessage — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32942 | `extractSEIMessage — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L32964 | `extractSEIMessage — 内部函数` | Worker、WASM 与媒体管理 | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| L42179 | `upload — 上传日志数据到服务器` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L42212 | `uploadKVStat — 上传 KV 统计` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43215 | `init — 初始化组件/模块（分配资源和建立内部状态）` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L43760 | `decode — 解码视频/音频数据` | 质量、上报与能力 | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| L47421 | `构造函数` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47425 | `构造函数` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47434 | `构造函数` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47441 | `构造函数` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L47447 | `构造函数` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L49461 | `send — 发送信令消息` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| L49480 | `onReceiveMsg — 收到消息回调` | SPC、DataChannel 与 Encoded Transform | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
## `Crypto/random`（8 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L8748 | `generateIdentifier — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L8784 | `generateIdentifier — 内部函数` | WebRTC Adapter | `02-RTCPeerConnection-usage-analysis.md` |
| L9964 | `format — 内部函数` | SDP 与配置 | `02-RTCPeerConnection-usage-analysis.md` |
| L9965 | `format — 内部函数` | SDP 与配置 | `02-RTCPeerConnection-usage-analysis.md` |
| L9971 | `format — 内部函数` | SDP 与配置 | `02-RTCPeerConnection-usage-analysis.md` |
| L10483 | `format — 内部函数` | SDP 与配置 | `02-RTCPeerConnection-usage-analysis.md` |
| L10484 | `format — 内部函数` | SDP 与配置 | `02-RTCPeerConnection-usage-analysis.md` |
| L10490 | `format — 内部函数` | SDP 与配置 | `02-RTCPeerConnection-usage-analysis.md` |
## `Performance`（3 处）
| 行号 | 所在方法/上下文 | 子系统 | 详细专项 |
|---:|---|---|---|
| L12268 | `performanceNow — 内部函数` | 二进制与公共工具 | `10-Auxiliary-Browser-APIs.md` |
| L25266 | `createTexture — 创建 WebGL 纹理` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
| L25429 | `enableCheckMute — 方法` | Canvas、WebGL 与混流 | `07-Media-Playback-and-Rendering.md` |
