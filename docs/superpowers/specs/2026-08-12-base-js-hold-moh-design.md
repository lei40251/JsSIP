# base-js 本地保持 MOH 音轨切换设计

## 目标

在 `demo/base-js` 的通话会话进入本地保持时，将对应 `RTCPeerConnection` 的发送音频轨道替换为循环播放的 `sound/moh.mp3`；取消本地保持时，恢复保持前的原始发送音频轨道。

该行为适用于所有由本端发起的保持，包括页面“保持/取消保持”按钮和 REFER 流程发起的保持。对端发起的保持不切换本端音轨。

## 范围

- 修改 `demo/base-js/js/app.js` 中现有 session hold/unhold 生命周期处理。
- 使用已有的 `demo/base-js/sound/moh.mp3`。
- 保留 `app.js` 当前尚未提交的其他修改，不进行无关重构。
- 不修改 SDK 的 `RTCSession` hold/unhold 实现，也不改变 SIP 协商行为。

## 方案

新增一个会话级 MOH 控制器，保存以下资源：

- 当前音频 `RTCRtpSender`。
- 进入保持前 sender 上的原始 `MediaStreamTrack`。
- 用于读取 `moh.mp3` 的 `HTMLAudioElement`。
- `AudioContext`、媒体元素 source、媒体流 destination 和临时 MOH track。
- 当前切换/恢复状态，用于避免重复 hold/unhold 事件创建多套资源。

MOH 通过 `AudioContext.createMediaElementSource()` 接入 `createMediaStreamDestination()`，以 destination 中的音频 track 作为 `replaceTrack()` 的输入。该方式不依赖兼容性较弱的 `HTMLMediaElement.captureStream()`。

## 数据流

### 本地 hold

1. session 触发 `hold` 事件。
2. 仅当 `originator === 'local'` 时执行 MOH 切换。
3. 从 session 的 PeerConnection 中查找当前携带音频 track 的 sender。
4. 保存 sender 和其原始 track。
5. 创建循环播放 `./sound/moh.mp3` 的音频元素和 Web Audio 输出 track。
6. 调用 `sender.replaceTrack(mohTrack)`。
7. 原始 track 仅保存引用，不停止、不重新申请麦克风权限。

### 本地 unhold

1. session 触发 `unhold` 事件。
2. 仅当 `originator === 'local'` 时执行恢复。
3. 调用同一个 sender 的 `replaceTrack(originalTrack)`。
4. 恢复成功后暂停并重置 MOH 播放，停止临时 MOH track，断开 Web Audio 节点并关闭 AudioContext。
5. 清空保存的状态，使后续 hold 可以重新初始化。
6. 继续执行现有 `getStreams()`，刷新页面的本地和远端媒体展示。

### 会话结束

在 session 的结束生命周期中清理仍存在的 MOH 播放器、临时 track 和 AudioContext。若 sender 仍然可用且原始 track 尚未恢复，先尝试恢复，再清理临时资源。

## 并发与幂等

- 同一会话已处于 MOH 状态时，重复的本地 hold 事件不重复创建播放器或覆盖原始 track。
- hold 与 unhold 的异步 `replaceTrack()` 操作串行执行，避免快速点击或 REFER 失败回退造成旧操作覆盖新状态。
- 每次操作执行时重新检查会话和 sender 是否仍可使用。
- 每个 session 使用独立状态，避免新旧会话之间共享音轨引用。

## 错误处理

- 找不到音频 sender 或原始 track 时记录警告并保留现有音轨，不阻断 SIP hold。
- 音频播放或 `AudioContext.resume()` 失败时记录错误，并清理本次创建的临时资源。
- 替换为 MOH 失败时保留原始音轨并清理 MOH 资源。
- 恢复原始音轨失败时记录错误，不停止原始 track；会话结束时再次尽力清理。
- 所有错误均不改变现有 hold、unhold、REFER 成功或失败的信令处理。

## 验证

- 静态检查 `app.js` 的语法和项目 ESLint 规则。
- 验证普通本地 hold 使用 MOH track，unhold 恢复同一个原始 track。
- 验证 REFER 发起 hold 后使用 MOH，REFER 失败触发 unhold 时恢复原 track。
- 验证对端 hold/unhold 不调用音轨替换。
- 验证重复 hold/unhold 和会话结束不会遗留播放中的音频元素、临时 track 或 AudioContext。
- 确认现有未提交修改仍保留且未被覆盖。
