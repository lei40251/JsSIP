# CRTC Web SDK 系统学习指南

这套文档面向熟悉 JavaScript、DOM、Promise 和浏览器开发，但第一次接入 SIP/WebRTC 的前端工程师。建议按章节顺序完成基础通话、媒体能力和通话质量统计的接入。

## HTML 文档站

- 浏览入口：[html/index.html](./html/index.html)
- 页面支持左侧章节导航、全文搜索、页内目录、Mermaid 流程图、代码复制、明暗主题和移动端阅读。
- Markdown 更新后，在本目录运行 `node build-html.cjs` 重新生成并校验全部 HTML 页面。

## 学完可以完成什么

- 配置并启动 `CRTC.UA`，完成 SIP 注册。
- 正确处理呼出、呼入、接听、远端媒体和挂断。
- 理解 `UA`、`RTCSession`、`RTCPeerConnection` 和 `MediaStream` 的关系。
- 在同一套会话代码中接入 AiNS、虚拟背景和多路混流。
- 监听 RTCStatsMonitor 事件并展示网络质量。
- 把旧版虚拟背景、混流和统计代码升级到当前写法。
- 运行 Base JS Demo，并能从页面功能定位到对应 SDK 调用。

## 推荐学习顺序

| 顺序 | 文档 | 完成标志 |
| ---: | --- | --- |
| 1 | [SIP 与 WebRTC 基础](./01-sip-webrtc-basics.md) | 能说清信令和媒体的区别 |
| 2 | [快速完成第一通电话](./02-quick-start.md) | 浏览器可以注册、呼叫、接听和挂断 |
| 3 | [通话流程与事件时序](./03-call-lifecycle.md) | 能按时机绑定事件并管理会话 |
| 4 | [媒体能力：AiNS、虚拟背景与混流](./04-media-features.md) | 可以在呼叫参数中启用并在通话中调整效果 |
| 5 | [通话质量统计](./05-call-statistics.md) | 可以展示 RTT、丢包、上下行质量和详细摘要 |
| 6 | [SDK API 参考](./06-api-reference.md) | 能按对象、方法和事件快速查询 |
| 7 | [旧版功能升级指南](./07-upgrade-guide.md) | 已完成虚拟背景、混流和统计接口迁移 |
| 8 | [Base JS Demo 学习与验证](./08-demo-guide.md) | 能用 Demo 验证配置并完成对应功能 |

API 参考不要求第一次完整背诵。建议完成前五章后，把第六章作为日常查询手册。

## 接入前需要准备

向服务提供方确认以下信息：

- WSS 信令地址，例如 `wss://sip.example.com/wss`。
- SIP 域，例如 `example.com`。
- SIP 账号和注册密码。
- SDK 授权码 `secret_key`。
- STUN/TURN 地址及其用户名、密码。
- 两个可用于互相呼叫的测试账号。

浏览器页面需要运行在 HTTPS 或 localhost 下，并获得摄像头、麦克风权限。

[开始学习：SIP 与 WebRTC 基础 →](./01-sip-webrtc-basics.md)
