# 数字人外呼与接听

选择“启用 AI”后点击“数字人外呼”：

1. 创建 Web Audio 静音音轨，通过 `mh.connect(inputStream)` 建立数字人连接，不采集本地麦克风。
2. 收到数字人画面后，将数字人输出流交给 `ua.call()`。
3. SIP 通话接通后，把 SIP 远端音频接入同一个 Web Audio 输出。接通前的早期媒体（如回铃音）不会送给 AI。
4. 取消、挂断或关闭数字人时，释放数字人连接及音频节点；不停止 SIP 原始接收轨道。

整个过程保持数字人发送轨道不变，不需要 `replaceTrack()` 或重新协商 SDP。远端输入不额外应用本地麦克风 AiNS。普通数字人外呼和预览仍使用麦克风输入。

## 数字人接听

来电时点击“数字人接听”，无论是否选择“启用 AI”，都使用来电方声音作为数字人输入：

1. 先用静音音轨连接数字人服务。
2. 收到数字人音视频后，调用 `rtcSession.answer({ mediaStream: remoteStream, ... })`，把数字人音视频发送给来电方。
3. 在同一个 `confirmed` 事件中，把来电方音频接入数字人输入，不采集本地麦克风。

## SDK 接入

`MetaHumanClient.connect(mediaStream?: MediaStream): Promise<void>`：

- 不传参数：按配置采集麦克风，保持原有行为。
- 传入流：使用第一条存活音频轨道的克隆，不采集麦克风；没有存活音频轨道时以 `TypeError` 拒绝。
- 外部音频仍应用配置中的 AiNS；不需要降噪时设置 `aiNoiseSuppression: null`。
- SDK 关闭时只停止自己的克隆及处理后轨道。调用方负责原始流、AudioContext 和音频节点。
- 空 `MediaStream` 没有音轨，不能充当静音输入。本示例用零值 `ConstantSourceNode` 提供静音。

静音输入见 `js/app-metahuman.js` 的 `startMetaHumanFlow()`；接入远端音频直接写在 `js/app-call.js` 的 `confirmed` 事件中。

## 验证

页面加载 `../../dist/CRTC.min.js`，修改 SDK 源码后需先执行 `npm run build:min`。
实机检查：接通前对本地麦克风说话、183 回铃音、接通后对端说话、拒接、取消、挂断后重呼，以及关闭数字人。
浏览器自动播放策略可能挂起 AudioContext，因此在点击外呼按钮时调用 `resume()`。
仍需结合数字人后端及目标浏览器验证识别、回复和首句延迟。
