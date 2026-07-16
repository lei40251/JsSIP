# 05 `MediaStreamTrack` 生命周期

> 本文不按方法罗列 Track API，而是沿一条轨道从创建、处理、发布、播放、换轨到停止追踪所有权。

## 1. 先区分四种 Track

| 名称 | 来源 | 用途 | 谁决定停止 |
|---|---|---|---|
| source track | gUM/gDM 或外部传入 | 原始摄像头、麦克风、屏幕输入 | 创建/接管它的本地 Track |
| out track | Audio/Canvas/处理管线输出 | 真正交给 Sender 发布 | 处理管线所有者 |
| sender track | `RTCRtpSender.track` | 当前正在发送的输入 | Sender 只引用，不负责停止源资源 |
| player track | 本地/远端播放器引用 | `srcObject` 或渲染输入 | Player 负责解绑，不通常负责停止 source |

这四者可能指向同一个原生 Track，也可能完全不同。生命周期分析必须先确认当前字段代表哪一种。

## 2. MediaStream 的五种用途

源码中的 `MediaStream` 主要用于：

1. 承接 `getUserMedia/getDisplayMedia` 返回值。
2. 把单条 Track 交给 HTMLMediaElement 播放。
3. 给 `addTrack(track, stream)` 和 Transceiver 提供 msid 关系。
4. 连接 Web Audio source/destination。
5. 承接 `canvas.captureStream()` 等处理后输出。

MediaStream 是轨道集合和关系容器；停止 Stream 引用本身不会替代 `track.stop()`。

## 3. 输入 Track 怎样进入 SDK 包装

```text
native sourceTrack
  → setInputMediaStreamTrack(track)
  → 解绑旧 input 事件
  → 保存新 input
  → 绑定 mute/unmute/ended
  → 建立或更新 Audio/Video pipeline
  → 产生/选择 outMediaTrack
```

设置输入时必须处理旧轨道：如果旧轨道由当前对象拥有，交接完成后停止；如果只是外部借用，则按构造参数/所有权约定决定是否停止。

## 4. 输出 Track 怎样变化

没有处理管线时，out track 可以直接等于 source track；有音频、Canvas 或其他处理时，out track 来自 destination：

```text
sourceTrack
  ├─ 直接路径 ──────────────→ outTrack = sourceTrack
  └─ processor pipeline ────→ destination/canvas track
```

`setOutputMediaStreamTrack()` 要同步：

- 当前发布 Track。
- Player 输入。
- Track settings 和 kind。
- 旧输出 Track 的释放责任。

## 5. 三种状态不能混淆

| 状态 | 含义 | 是否终止 |
|---|---|---|
| `enabled=false` | 应用主动禁用输出，浏览器通常发送静音/黑帧 | 否，可恢复 |
| `muted=true` | Track 暂时无法提供媒体数据 | 否，可能恢复 |
| `readyState='ended'` | Track 永久结束 | 是，不能重新启动 |

SDK 的 mute/unmute 还可能通过 `sender.replaceTrack(null|track)` 或业务信令表达，不能只看原生 `enabled`。

## 6. 原生事件怎样进入 SDK

本地和远端 Track 会监听：

- `mute`
- `unmute`
- `ended`

事件可能通过 `addEventListener` 或属性 handler 绑定。释放时必须使用同一方式解绑，避免旧 Track 在换轨后继续修改新对象状态。

屏幕 Track 的 ended 通常触发停止共享；远端 receiver track 的 ended 通常跟随 PC/订阅生命周期；摄像头短暂 muted 不应直接当成设备已永久丢失。

## 7. 从采集到发布

```text
getUserMedia / getDisplayMedia
  → sourceTrack
  → LocalTrack.setInputMediaStreamTrack
  → 可选 Audio/Canvas pipeline
  → outMediaTrack
  → Room.publish
  → RTCRtpSender.replaceTrack / addTrack
```

发布层只接收可发送 Track，不应接管采集设备的停止责任。

## 8. 从接收到播放

```text
RTCPeerConnection ontrack
  → receiver native track
  → RemoteTrack.setInputMediaStreamTrack
  → Player.setTrack
  → HTMLMediaElement / Canvas / WebGL
```

SPC 还需要通过 stream id、tinyId、MID 和内部 Map 把共享 PC 上的 track 还原到正确用户和媒体类型。

## 9. `getSettings()`、Capabilities 和 Constraints

| API | 回答的问题 |
|---|---|
| `getSettings()` | 浏览器当前实际使用什么设备、尺寸、帧率、采样率 |
| `getCapabilities()` | 该 Track 可调范围和可选值是什么 |
| `getConstraints()` | 当前请求过什么约束 |
| `applyConstraints()` | 尝试在现有 Track 上改变约束 |

SDK 上报和 sender 参数应优先基于 settings；profile 只是请求目标和无 API 时的回退。

## 10. `clone()` 的语义

`track.clone()` 创建共享同一媒体源的新 Track 对象：

- clone 有独立的 `enabled` 和 `stop()` 状态。
- 停止 clone 通常不立即关闭其他克隆。
- 只有所有相关 Track 结束后，底层设备才可能真正释放。

源码使用 clone 时必须记录谁拥有每个克隆，不能用“同一个摄像头”推断它们是同一 JS 对象。

## 11. `contentHint` 怎样传播

- 摄像头运动画面可倾向 `motion`。
- 屏幕文字/文档可倾向 `detail` 或 `text`。
- 音频可在 speech/music 等提示之间选择。

视频 contentHint 还会影响 sender degradationPreference：motion 更偏向保帧率，detail 更偏向保分辨率。它是提示，不是严格保证。

## 12. 换轨与重新采集

安全顺序：

```text
创建并验证 newSourceTrack
  → 接入现有处理管线
  → 得到 newOutTrack
  → sender.replaceTrack(newOutTrack)
  → Player 切换
  → 更新 settings / 业务字段
  → 停 oldOutTrack 和 oldSourceTrack
```

`replaceTrack()` 不会自动更新 SDK settings、通知服务端或停止旧轨道。新轨道超出既有协商 envelope 时还可能抛 `InvalidModificationError`。

## 13. stopCapture、stop 和 close

虽然不同类命名不同，语义应区分：

- **stopCapture**：停止原生采集源，未必销毁整个业务 Track 包装。
- **stop**：停止播放或处理任务，具体以对象类型为准。
- **close**：进入不可继续使用的最终释放，解绑事件、停管线、清引用。

阅读时不能只凭方法名，必须追它实际停止了 source、out、Player、Sender 还是 timer。

## 14. 退发布与停止顺序

```text
Room.unpublish
  → sender.replaceTrack(null) / removeTrack
  → 更新 publish 状态
  → 停 Player/Audio/Canvas pipeline
  → 停 outTrack（若独立生成）
  → sourceTrack.stop()
  → 解绑事件并清字段
```

先断开 Sender 可以减少旧轨道停止事件对协商状态的干扰；但最终是否释放设备，仍取决于显式停止所有拥有的 Track。

## 15. 资源泄漏检查表

- 旧 Track 的 mute/unmute/ended listener 是否解绑。
- `requestVideoFrameCallback` 是否取消。
- AudioNode 是否 disconnect。
- canvas capture track 是否 stop。
- Player 的 `srcObject` 是否清空。
- Sender 是否仍引用不再使用的 Track。
- 外部传入 Track 是否被误停止。
- recapture 失败时旧 Track 是否仍保持可用。

## 16. API 参数与本项目实参

### 16.1 `new MediaStream(tracks?)`

MDN：[MediaStream()](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream/MediaStream)

构造器可无参，也可传 `MediaStreamTrack[]` 或另一个 `MediaStream`。本项目常用无参构造，再按条件 `addTrack(track)`：

```js
const stream = new MediaStream();
audioTrack && stream.addTrack(audioTrack);
videoTrack && stream.addTrack(videoTrack);
```

| 参数/调用 | 含义 | 本项目实参 |
|---|---|---|
| `tracks` | 初始 Track 列表；省略时创建空流 | 自定义 source 分支用无参构造；Adapter 兼容代码也使用 `new MediaStream([track])` |
| `stream.addTrack(track)` | 把原生 Track 加入流，不复制 Track | 传 `customSource`、`outMediaTrack`、屏幕系统音频或额外麦克风 Track |
| `stream.removeTrack(track)` | 从流的成员列表移除，不停止 Track | Adapter 的 stream 映射使用；正式停止仍由 Track 所有者调用 `stop()` |
| `getTracks/getAudioTracks/getVideoTracks()` | 均无参数，返回当前成员快照数组 | 取采集结果第一条 Track、批量 stop、按 kind 选择 |

`MediaStream` 是分组容器，不拥有硬件。对流 `removeTrack()`、丢弃流对象或关闭 PC，都不会自动停止其中的原生 Track。

### 16.2 输入 Track 怎样进入包装对象

源码 L20081—L20117：

```js
setInputMediaStreamTrack(track) {
  const previous = this._inputTrack;
  this._inputTrack = track;
  this.trackSettings = track.getSettings?.();
  track.enabled = !this.muted;
  previous && this.uninstallTrackEvent(previous);
  this.installTrackEvent(track);
  return this.manager
    ? this.manager.changeInput(this)
    : this.setOutputMediaStreamTrack(track);
}
```

`track` 参数必须是原生 `MediaStreamTrack`。公开 `videoTrack/audioTrack`、`getUserMedia()` 结果、远端 `RTCTrackEvent.track` 和处理管线输出最终都走这一个入口。参数进入后依次发生：保存引用、读实际 settings、继承 SDK mute、换事件监听、通知 Manager 重新生成输出。

`setOutputMediaStreamTrack(track)` 的参数则是“准备播放/发布的 Track”：

```js
this._outputTrack = track;
this._outputTrack.contentHint = this._inputTrack.contentHint;
this._outputTrack.enabled = this._inputTrack.enabled;
```

当没有处理管线时 input 与 output 可以是同一对象；有混流、Web Audio、Canvas 或 TrackGenerator 时二者不同。PC 的 `addTrack/replaceTrack` 优先使用 output。

### 16.3 `track.enabled`

MDN：[MediaStreamTrack.enabled](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/enabled)

它是布尔属性，不是方法参数：`false` 让该 Track 输出静音音频或黑色视频帧，Track 仍为 `live`，设备也未释放。

```js
setMute(muted) {
  this.muted = muted;
  this._inputTrack  && (this._inputTrack.enabled  = !muted);
  this._outputTrack && (this._outputTrack.enabled = !muted);
}
```

公开参数 `muted=true` 最终写成原生 `enabled=false`。输入和输出同时设置，是为了避免处理链仍消费输入或 sender 仍发送输出时两侧状态不一致。

### 16.4 `track.muted`、`readyState` 与三个原生事件

MDN：[muted](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/muted)、[readyState](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/readyState)、[mute](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/mute_event)、[unmute](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/unmute_event)、[ended](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/ended_event)

安装事件时项目传三个事件名和三个实例方法，没有传 listener options：

```js
createEventDispatcher(track, track)
  .add('mute', this.onTrackMuted)
  .add('unmute', this.onTrackUnmuted)
  .add('ended', this.onTrackEnded);

track.muted && this.onTrackMuted();
track.readyState === 'ended' && this.onTrackEnded();
```

| 状态 | 含义 | 项目动作 |
|---|---|---|
| `enabled=false` | 应用主动禁用输出 | SDK `setMute()` 写入；不代表浏览器源故障 |
| `muted=true` / `mute` 事件 | Track 暂时无法提供数据 | 写 warning，保留对象等待 `unmute` |
| `readyState='ended'` / `ended` 事件 | Track 永久结束 | 屏幕共享触发停止流程；设备 Track 可进入重采集策略 |

`stop()` 由应用主动调用时，规范上不一定向同一个 Track 对象触发 `ended` 事件，因此释放逻辑不能只依赖事件回调。

### 16.5 `track.stop()`

MDN：[stop()](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop)

`stop()` 无参数、返回 `undefined`，把 Track 的 `readyState` 置为 `ended`，并通知底层 source 不再需要该 Track。source 可能被其他 Track 共享，所以设备何时真正关闭由浏览器决定。

本地 Track 的真正释放入口（L23541—L23549）：

```js
stopCapture() {
  this.sourceTrack && (
    this.sourceTrack.stop(),
    this.uninstallTrackEvent(this.sourceTrack)
  );
  this._inputTrack && this.uninstallTrackEvent(this._inputTrack);
  this.manager?.removeInput(this);
}
```

设备切换/重采集也会先 `sourceTrack.stop()`，但这属于“旧 source 结束、新 source 接替”；完整 close 还要停止 Player、解绑事件、从 Manager 移除和清引用。`sender.replaceTrack(null)` 只停发，不替代这里的 stop。

### 16.6 `track.clone()`

MDN：[clone()](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/clone)

该方法无参数，返回引用同一媒体 source 的新 Track 对象；新 Track 有自己的 id、`enabled` 和生命周期。项目只在调用方明确请求 `processed:true` 且 output 与 input 不同时 clone：

```js
return processed && wrapped.outMediaTrack !== wrapped.mediaTrack
  ? wrapped.outMediaTrack.clone()
  : wrapped.mediaTrack;
```

因此默认 `getAudioTrack/getVideoTrack` 返回 SDK 内部正在使用的原对象；`processed:true` 返回处理后 Track 的克隆，调用方停止 clone 不应结束 SDK 持有的原 output Track。虚拟背景更新输入时也传 `cameraTrack.mediaTrack.clone()`，隔离外部处理模块的 stop 行为。

### 16.7 `contentHint`

MDN：[MediaStreamTrack.contentHint](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/contentHint)

这是字符串属性，不是硬约束。视频常见值是空字符串、`'motion'`、`'detail'`、`'text'`；音频常见值包括 `speech`、`music`、`speech-recognition`。浏览器可把它作为编码取舍提示。

```js
setContentHint(value) {
  this.mediaTrack.contentHint = value;
  this.outMediaTrack.contentHint = value;
}
```

本项目摄像头 capture 默认 `e.contentHint || 'motion'`，屏幕 capture 默认 `e.contentHint || 'detail'`；公开 `qosPreference` 先经 `mapQoSToContentHint()` 转换。输出 Track 每次替换时还从 input 复制该值。SPC 后续把 `'motion'` 映射为 sender `maintain-framerate`，把 `'detail'` 映射为 `maintain-resolution`，所以该提示继续影响编码降级策略。

### 16.8 `getConstraints()`、`getCapabilities()`、`getSettings()` 与 `applyConstraints()`

四个 API 的关系：

| API | 参数 | 返回/作用 | 本项目使用 |
|---|---|---|---|
| `getConstraints()` | 无 | 返回最近一次请求的约束 | `update3A()` 取现有对象，再改 3A 字段 |
| `getCapabilities()` | 无 | 返回该 Track 可支持范围 | 采集后记录/校验，不直接代表当前值 |
| `getSettings()` | 无 | 返回当前实际值 | 保存 `trackSettings`，读取 deviceId、宽高、帧率、声道数 |
| `applyConstraints(constraints)` | 一个约束对象 | 异步重新配置同一 Track | 摄像头规格、音频 3A、屏幕二次规格 |

`applyConstraints()` 具体字段及 exact/ideal/min/max 规则见第 04 章。生命周期层需要关注的是：成功后仍是同一个 Track；失败不应先丢弃旧 Track；设备切换若走 recapture 则会创建新 Track 并触发 input/output 替换链。

## 17. 事实与边界

### 可以直接确认

- SDK 明确区分输入 Track 和输出 Track。
- Web Audio/Canvas 可以产生新的可发布 Track。
- `enabled`、`muted` 和 `ended` 被当成不同状态。
- PC/Sender 不拥有本地采集设备的最终停止责任。

### 合理推断

- 输入/输出分层是为了让采集、处理、发布和播放可以独立替换。
- 先换新轨再停旧轨用于降低设备切换的可感知中断。

### 不能确认

- 外部自定义 Track 在所有公开入口下是否都采用相同所有权约定，需结合具体参数和调用方。
