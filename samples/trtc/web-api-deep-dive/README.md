# TRTC Web API 源码学习文档

> 源码：`../trtc.deobfuscated.js`（51,908 行）
>
> 阅读目标：先建立浏览器 API 全景，再对关键 API 逐个下钻，最后串起完整业务流程。

## 从哪里开始

第一次阅读只走下面这条主线，不需要先查索引：

```text
00 阅读说明与源码地图
  → 01 浏览器 API 使用全景分析
    → 02 RTCPeerConnection
    → 03 WebSocket
    → 按需要阅读 04—10
      → 11 端到端业务流程
```

## 主阅读线

| 顺序 | 文档 | 解决的问题 |
|---:|---|---|
| 00 | [阅读说明与源码地图](00-Reading-Guide-and-Source-Map.md) | 先区分运行时、Adapter、工具、媒体、门面和房间六层代码 |
| 01 | [浏览器 API 使用全景分析](01-Browser-API-Panorama.md) | 整个 SDK 使用了哪些浏览器 API，各自服务什么场景 |
| 02 | [`RTCPeerConnection` 使用分析](02-RTCPeerConnection-usage-analysis.md) | Adapter、能力检测、MPC/SPC、状态、重连和释放 |
| 03 | [`WebSocket` 使用分析](03-WebSocket-usage-analysis.md) | 主备连接、JSON 信封、RPC、在线判断和信令恢复 |
| 04 | [`MediaDevices` 与采集](04-MediaDevices-and-Capture.md) | 设备枚举、摄像头/麦克风、屏幕共享、约束降级和停止 |
| 05 | [`MediaStreamTrack` 生命周期](05-MediaStreamTrack-Lifecycle.md) | source/out/sender/player track 的所有权与交接 |
| 06 | [Web Audio 使用分析](06-Web-Audio-usage-analysis.md) | AudioContext、处理图、音量、播放恢复和释放 |
| 07 | [媒体播放与渲染](07-Media-Playback-and-Rendering.md) | HTMLMediaElement、Canvas、WebGL、截图和销毁 |
| 08 | [Worker、Streams 与编码帧处理](08-Worker-Streams-and-Encoded-Processing.md) | 后台定时器、黑帧检测、Insertable Streams 和 Script Transform |
| 09 | [WebCodecs 与 WebAssembly](09-WebCodecs-and-WebAssembly.md) | 能力检测、实际解码、WASM 加载和回退 |
| 10 | [辅助浏览器 API](10-Auxiliary-Browser-APIs.md) | HTTP、上报、Navigator、DOM、Storage 和二进制协议 |
| 11 | [端到端业务流程](11-End-to-End-Business-Flows.md) | 进房、发布、订阅、切换设备、重连和退房 |

## 附录

附录用于核对完整性和从源码反查，不进入正常学习顺序。

| 附录 | 文档 | 适合什么时候使用 |
|---|---|---|
| A | [浏览器 Web API 全部出现位置](Appendix-A-WebAPI-Occurrences.md) | 已知浏览器 API，查它在源码哪里调用 |
| B | [源码方法与构造器索引](Appendix-B-Source-Method-Index.md) | 已知源码方法，查所属层和直接 Web API |
| C | [事件反向索引](Appendix-C-Event-Index.md) | 查事件在哪里监听、派发和解绑 |
| D | [方法直接调用邻接表](Appendix-D-Method-Adjacency-Index.md) | 逐方法核对直接调用关系 |
| E | [公开 SDK API 到 Web API 对照](Appendix-E-Public-API-Call-Chains.md) | 从公开 API 反查内部方法和浏览器 API |
| F | [完整流程图与时序图](Appendix-F-Visual-Call-Flows.md) | 需要集中查看流程图或打印时序图 |

## 阅读约定

文档把结论分为三类：

- **源码事实**：方法体、参数或调用关系可以在当前 JS 直接验证。
- **合理推断**：多个源码事实共同支持，但缺少服务端或构建前源码。
- **不能确认**：必须依赖服务端协议、原始源码、抓包或浏览器实测。

反混淆文件中的自动中文注释可能与方法体不一致。判断优先级始终是：

```text
方法体 → 调用方 → 被调用方 → 状态字段 → 自动注释
```

特别注意：源码中“出现过某 API”不代表正式通话一定执行。Polyfill、Adapter、能力检测和正式业务必须分层判断。

### 关键 API 的固定阅读模板

主文不是搜索结果汇总。每个关键 API 都按同一顺序展开：

1. **API 签名与用途**：先说明这个浏览器 API 解决什么问题。
2. **源码片段**：引用当前 JS 中真正执行的调用，不只给行号。
3. **标准参数**：说明每个参数、可选项、默认行为和浏览器限制。
4. **本项目实参**：逐字段追到公开配置、内部默认值或服务端返回值。
5. **调用阶段**：区分创建时参数、运行时二次配置和结果读取。
6. **后续去向**：说明返回对象由谁持有，继续传给哪个 Track、Sender、Player 或信令方法。
7. **失败与释放**：说明异常、降级、重试、重连和资源关闭。

其中最重要的是不要把不同阶段的参数混在一个对象里。例如屏幕共享至少分成四步：

```text
公开 startScreenShare(options)
  → 第一次选择界面的 getDisplayMedia(options)
  → 采集后 videoTrack.applyConstraints(constraints)
  → getSettings() / ended 事件验证最终结果和生命周期
```

所以 `preferCurrentTab`、`systemAudio`、`selfBrowserSurface`、`surfaceSwitching` 属于第一次选择界面；`frameRate`、`width`、`height` 还会在采集后再次应用到视频轨道。文档会分别展示两次浏览器调用收到的对象。

## 已复核的关键纠错

- 业务 WebSocket 没有自定义 ping/pong；在线判断依赖连接状态和最近下行消息时间。
- WebSocket `open`、应用层 channel setup、join 成功和媒体 PC connected 是不同阶段。
- 公开 `sendCustomMessage()` 在当前构造路径走 WebSocket 信令，不是 SPC DataChannel。
- 正式 MPC/SPC 没有可证明的逐 Candidate WebSocket 交换链；`addIceCandidate()` 的明确业务调用主要位于 H.264 本地回环检测。
- `exitRoom()` 关闭房间媒体连接但保留本地采集 Track；`destroy()` 才进入实例级完整释放。

## HTML 文档站

- 浏览入口：[html/index.html](html/index.html)
- 术语和来源判读：[核心术语速查](00-Reading-Guide-and-Source-Map.md#7-核心术语速查)、[怎样判断字段来源](00-Reading-Guide-and-Source-Map.md#8-怎样判断-这个字段从哪里来)
- `build-html.cjs` 以当前目录 Markdown 为内容源，生成左侧主线/附录导航、全文搜索、页内目录和 Mermaid 图。
