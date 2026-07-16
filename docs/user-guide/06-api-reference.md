# 6. SDK API 参考

[← 上一章：通话质量统计](./05-call-statistics.md) · [学习目录](./README.md) · [下一章：旧版功能升级 →](./07-upgrade-guide.md)

本章集中列出 Base JS Demo 使用的 SDK 对象、方法和事件。每个条目均说明参数、可选值、返回值、触发条件和常见注意事项。

## 6.1 全局对象

### `CRTC.version`

SDK 版本字符串：

```js
console.log(CRTC.version);
```

联调时建议把版本写入日志，便于确认页面加载的文件是否正确。

### `CRTC.debug.enable(namespace)` / `disable(namespace)`

```js
CRTC.debug.enable('CRTC:*');
CRTC.debug.disable('CRTC:*');
```

| 参数 | 类型 | 示例 | 说明 |
| --- | --- | --- | --- |
| `namespace` | `string` | `CRTC:*` | 日志命名空间匹配规则 |

联调时开启；生产环境按项目日志策略控制，避免长期输出大量调试信息。

## 6.2 `CRTC.WebSocketInterface`

```js
const socket = new CRTC.WebSocketInterface(
  'wss://sip.example.com/wss'
);
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `url` | `string` | 是 | `wss://` SIP 信令地址；不是网页 HTTPS 地址 |

证书无效、代理未升级 WebSocket、路径错误或端口不可达时会导致 UA 无法触发 `connected`。

## 6.3 `new CRTC.UA(configuration)`

```js
const ua = new CRTC.UA({
  sockets                          : socket,
  uri                              : 'sip:alice@example.com',
  display_name                     : 'Alice',
  password                         : 'alice-password',
  secret_key                       : 'SDK 授权码',
  register                         : true,
  register_expires                 : 600,
  connection_recovery_min_interval : 2,
  connection_recovery_max_interval : 30,
  session_timers                   : true
});
```

### 必填和常用配置

| 字段 | 类型 | 必填 | 默认值 | 有效值/说明 |
| --- | --- | --- | ---: | --- |
| `sockets` | `WebSocketInterface` 或数组 | 是 | 无 | 一个或多个 WSS 传输 |
| `uri` | `string` | 是 | 无 | 当前用户 SIP URI；建议完整 `sip:user@domain` |
| `secret_key` | `string` | 是 | 无 | SDK 授权码 |
| `password` | `string \| null` | 视鉴权 | `null` | SIP Digest 密码 |
| `authorization_user` | `string \| null` | 否 | `null` | 鉴权用户名与 URI user 不同时设置 |
| `authorization_jwt` | `string \| null` | 否 | `null` | 服务端支持 JWT 鉴权时使用 |
| `realm` | `string \| null` | 否 | `null` | 指定鉴权 realm |
| `ha1` | `string \| null` | 否 | `null` | 使用预计算 HA1 时设置；不要与错误密码混用 |
| `display_name` | `string \| null` | 否 | `null` | SIP From 显示名称 |
| `register` | `boolean` | 否 | `true` | `true` 自动注册；`false` 由 `connected` 后调用 `register()` |
| `register_expires` | 正整数 | 否 | `600` 秒 | REGISTER 过期时间 |
| `registrar_server` | SIP URI | 否 | 从当前域推导 | 指定注册服务器 |
| `no_answer_timeout` | 正数 | 否 | `60` 秒 | 呼入无人接听超时 |
| `session_timers` | `boolean` | 否 | `true` | 是否启用 SIP Session Timer |
| `session_timers_refresh_method` | `UPDATE` 等服务支持值 | 否 | `UPDATE` | 会话刷新方式 |
| `connection_recovery_min_interval` | 正数 | 否 | `2` 秒 | WSS 恢复最小间隔 |
| `connection_recovery_max_interval` | 正数 | 否 | `30` 秒 | WSS 恢复最大间隔 |
| `user_agent` | `string` | 否 | SDK 默认值 | SIP User-Agent 头 |

`connection_recovery_min_interval` 必须小于或等于最大值。Demo 为快速联调使用 `2～3` 秒；生产值按网络和服务要求设置。

## 6.4 UA 方法

### `start(): void`

启动 WSS；`register: true` 时连接成功后自动注册。重复启动前先确认 UA 当前状态。

```js
ua.start();
```

### `stop(): void`

停止 UA、结束其管理的活动流程并断开信令。适用于退出账号或页面整体销毁。

```js
window.addEventListener('beforeunload', function()
{
  ua.stop();
});
```

### `register(): void`

手动发送 REGISTER。仅在 `register: false` 且 WSS 已连接时调用：

```js
ua.on('connected', function()
{
  ua.register();
});
```

调用完成不代表注册成功，最终等待 `registered` 或 `registrationFailed`。

### `isConnected(): boolean`

返回 WSS 当前是否连接：

```js
if (!ua.isConnected())
{
  showMessage('信令尚未连接');
}
```

### `isRegistered(): boolean`

返回 SIP 当前是否注册。呼叫前必须检查：

```js
if (!ua.isRegistered())
{
  return;
}
```

### `call(target, options): Promise<RTCSession>`

```js
const session = await ua.call('7301@example.com', {
  pcConfig,
  mediaConstraints : {
    audio : { sampleRate: 48000, channelCount: 1 },
    video : {
      facingMode : 'user',
      width      : 640,
      height     : 480,
      frameRate  : 15
    }
  },
  extraHeaders : [
    'X-Data: dGVzdA==',
    'X-Direction: sendrecv'
  ]
});
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `target` | `string` | 是 | 被叫；可用 `user@domain` 或完整 SIP URI |
| `options` | `object` | 否 | 呼叫、媒体和事件配置 |

`options`：

| 字段 | 类型/可选值 | 默认 | 说明 |
| --- | --- | --- | --- |
| `mediaConstraints.audio` | `boolean \| MediaTrackConstraints` | 视调用 | `true` 使用默认麦克风；`false` 不采集 |
| `mediaConstraints.video` | `boolean \| MediaTrackConstraints` | 视调用 | `true` 使用默认摄像头；`false` 不采集 |
| `mediaStream` | `MediaStream` | 无 | 自定义发送流；优先于自动采集 |
| `pcConfig` | `RTCConfiguration` | 浏览器默认 | ICE/TURN、transport、bundle 等 |
| `rtcOfferConstraints` | `RTCOfferOptions` | 无 | `offerToReceiveAudio/video` 等方向能力 |
| `extraHeaders` | `string[]` | `[]` | INVITE 自定义头，格式 `Name: value` |
| `extraFeatures` | `string[]` | `[]` | 项目部署支持的扩展能力，如 BFCP |
| `eventHandlers` | `{ [eventName]: function }` | 无 | 创建会话时直接绑定事件；Demo 用于 `mediaEffectsIssue` |
| `aiNoiseSuppression` | AiNS 配置 | 无 | 启用本地麦克风 AI 降噪 |
| `mediaEffectsComposer` | composer 配置 | 无 | 启用混流、虚拟背景、镜像和水印 |

`mediaStream` 至少包含业务需要发送的有效 track。自定义流和 `mediaConstraints` 同时存在时，不能假设 SDK 会额外采集并合并所有轨道；Demo 的特殊空轨场景显式构建完整流。

Promise 可能因权限拒绝、约束不满足、媒体流无效或呼叫初始化失败而 reject。SIP 拒接/超时通常通过该 session 的 `failed` 事件处理。

### `sendOptions(target, body?, options?)`

```js
ua.sendOptions(`sip_ping@example.com`);
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `target` | `string` | 是 | OPTIONS 目标 SIP URI |
| `body` | `string` | 否 | 可选消息体 |
| `options` | `object` | 否 | 可选额外头和事件处理 |

返回 OPTIONS 请求对象。Demo 在 iOS 场景定时发送；是否需要保活及发送周期应由部署环境决定。

## 6.5 UA 事件

### 注册和连接事件

| 事件 | 参数 | 触发条件 | 处理建议 |
| --- | --- | --- | --- |
| `browser:navigator:offline` | 无 | 浏览器检测离线 | 显示断网，禁用新呼叫 |
| `browser:navigator:online` | 无 | 浏览器恢复在线 | 显示恢复中，仍等待连接/注册 |
| `connected` | 连接对象可忽略 | WSS 已连接 | 自动模式等待注册；手动模式调用 `register()` |
| `disconnected` | `{ code, reason, error }` | WSS 主动/被动断开 | 禁用新呼叫；区分主动 stop |
| `failed` | `{ originator, message, cause }` | UA 操作发生错误 | 记录和提示具体原因 |
| `registered` | `{ response }` | REGISTER 收到成功响应 | 开放呼叫 |
| `registrationFailed` | `{ response, cause }` | REGISTER 失败或超时 | 保持禁用并提示原因 |

`disconnected` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | `number` | WebSocket 关闭码或连接错误码 |
| `reason` | `string` | 断开原因 |
| `error` | `boolean` | 是否为错误导致 |

### `newRTCSession`

```js
ua.on('newRTCSession', function(data)
{
  bindSession(data.session);
});
```

| 字段 | 类型/可选值 | 说明 |
| --- | --- | --- |
| `originator` | `local` / `remote` | 本端呼出或远端呼入 |
| `session` | `RTCSession` | 当前通话对象 |
| `request` | SIP 请求对象 | 可读取主叫、模式和自定义头 |

呼入和呼出都会触发。所有会话事件都应在这里按 session 绑定。

## 6.6 `RTCSession` 常用属性

| 属性 | 类型/可选值 | 可用时机 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 会话创建后 | 本通电话标识 |
| `direction` | `incoming` / `outgoing` | 会话创建后 | 呼入或呼出 |
| `status` | `number` | 会话全程 | SDK 会话状态；业务优先使用事件 |
| `connection` | `RTCPeerConnection` | PC 创建后 | 浏览器媒体连接；结束后不可继续使用 |
| `statsMonitor` | `RTCStatsMonitor \| null` | PC 创建并启用统计后 | 本通电话统计；结束释放后为 `null` |
| `start_time` | `Date` 等 | 建立后 | 通话开始时间 |
| `end_time` | `Date` 等 | 结束后 | 通话结束时间 |

## 6.7 RTCSession 呼叫控制方法

### `answer(options?): void`

仅用于呼入会话。参数与 `call()` 的媒体部分相近：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `mediaConstraints` | `MediaStreamConstraints` | 接听后发送的本地媒体 |
| `mediaStream` | `MediaStream` | 自定义发送流 |
| `pcConfig` | `RTCConfiguration` | ICE/TURN 和 PC 配置 |
| `rtcOfferConstraints` / `rtcAnswerConstraints` | WebRTC options | 接收方向/应答约束 |
| `extraHeaders` | `string[]` | 200 OK 等响应附加头 |
| `extraFeatures` | `string[]` | 已启用的扩展能力 |
| `mediaEffectsComposer` | object | composer 初始配置 |
| `aiNoiseSuppression` | object | AiNS 初始配置 |

```js
session.answer({
  mediaConstraints : { audio: true, video: videoConstraints },
  pcConfig,
  extraHeaders         : [ 'X-Data: dGVzdA==' ],
  rtcOfferConstraints  : { offerToReceiveAudio: true, offerToReceiveVideo: true },
  mediaEffectsComposer : buildComposerOptions(),
  aiNoiseSuppression   : buildAiNsOptions()
});
```

### `terminate(options?): void`

| 字段 | 类型/范围 | 默认/说明 |
| --- | --- | --- |
| `status_code` | `number` | 呼入拒接需 `300～699`；呼出取消/已建立 Reason 可用 `200～699` |
| `reason_phrase` | `string` | 可选原因文本 |
| `extraHeaders` | `string[]` | 额外 SIP 头 |
| `body` | `string` | 可选正文 |
| `cause` | `string` | 可选结束原因 |

```js
// 呼入忙线拒接。
session.terminate({ status_code: 486 });

// 取消呼出或挂断已建立通话。
session.terminate();
```

### `isEstablished(): boolean`

会话是否已建立。它适合保护只允许通话中执行的操作，UI 生命周期仍以 `confirmed/failed/ended` 事件为准。

### `hold(options?, done?): boolean` / `unhold(options?, done?): boolean`

```js
session.hold({ useUpdate: false }, function()
{
  console.log('保持协商完成');
});
```

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `options.useUpdate` | `boolean` | `false`/项目选择 | `true` 使用 UPDATE，`false` 使用 re-INVITE |
| `options.extraHeaders` | `string[]` | `[]` | 附加 SIP 头 |
| `done` | `function` | 无 | 协商完成回调 |

返回 `boolean` 表示是否成功开始本次操作。最终状态监听 `hold/unhold`。

### `isOnHold(): { local: boolean, remote: boolean }`

```js
const hold = session.isOnHold();
console.log(hold.local, hold.remote);
```

`local` 表示本端是否保持，`remote` 表示远端是否保持。

### `mute(options)` / `unmute(options)`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `audio` | `boolean` | 是否静音/恢复本地音频 |
| `video` | `boolean` | 是否关闭/恢复本地视频 |
| `video_only` | `boolean` | Demo 的摄像头关闭兼容选项，仅在对应场景使用 |

```js
session.mute({ audio: true });
session.unmute({ audio: true });
session.mute({ video: true });
session.unmute({ video: true });
```

### `isMuted(): { audio: boolean, video: boolean }`

返回本端当前静音状态。

### `refer(target, options?): void`

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `target` | `string \| URI` | 转接目标 |
| `options.extraHeaders` | `string[]` | REFER 额外头 |
| `options.replaces` | `RTCSession` | attended transfer 场景可指定被替换会话 |
| `options.eventHandlers` | `object` | `accepted/failed/requestFailed` 等结果处理 |

转接前是否保持当前通话以及成功后是否挂断，按业务流程处理。

## 6.8 RTCSession 媒体方法

### `switchDevice(type, deviceId): Promise<MediaStream>`

| 参数 | 可选值 | 说明 |
| --- | --- | --- |
| `type` | `camera` / `audio` | 摄像头或麦克风 |
| `deviceId` | 设备 ID | 从设备列表得到 |
| `deviceId`（camera） | `user` / `environment` | 移动端前置/后置摄像头 |

```js
await session.switchDevice('camera', cameraDeviceId);
await session.switchDevice('audio', microphoneDeviceId);
```

摄像头成功后监听 `cameraChanged({ videoStream })` 更新预览。

### `renegotiate(options?, done?): boolean`

手动触发重新协商。Demo 在特定摄像头切换后调用：

```js
session.switchDevice('camera', 'environment')
  .then(function()
  {
    session.renegotiate();
  });
```

`options.useUpdate` 选择 UPDATE/re-INVITE，`rtcOfferConstraints` 可指定 Offer 方向。一般设备切换由 SDK 已处理时不重复调用。

### `share(type, id?, assembly?, dual?, skip?): Promise`

| 参数 | 类型/可选值 | 说明 |
| --- | --- | --- |
| `type` | `screen` / `html` / `pic` / `video` | 分享源类型 |
| `id` | CSS selector / `null` | HTML、图片、视频元素；屏幕传 `null` |
| `assembly` | function / `null` | DOM 转画布函数，如 `html2canvas` |
| `dual` | `boolean` | `true` 使用双方支持的双流/BFCP 场景 |
| `skip` | `boolean` | 特定共享兼容选项；普通接入不传 |

```js
await session.share('screen', null, null);
await session.share('html', '#sharedArea', html2canvas);
await session.share('pic', '#sharedImage', null);
await session.share('video', '#sharedVideo', null);
```

### `unShare(): void`

停止当前分享。方法名中 `S` 为大写。

### `downgradeToAudio(options?, done?)`

```js
session.downgradeToAudio({ useUpdate: false }, done);
```

视频通话降级音频。`useUpdate: true` 使用 UPDATE，否则使用 re-INVITE。完成后监听 `mode({ mode: 'audio' })`。

### `upgradeToVideo(options?, done?)`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `videoConstraints` | MediaTrackConstraints | 新摄像头采集约束 |
| `videoStream` | `MediaStream` | 自定义视频流；与约束二选一为主 |
| `sendOnly` | `boolean` | 是否只发送视频 |
| `recvOnly` | `boolean` | 是否只接收视频 |
| `useUpdate` | `boolean` | UPDATE 或 re-INVITE |
| `extraHeaders` | `string[]` | 额外头 |
| `mediaEffectsComposer` | object | 新视频启用 composer 时传入 |

```js
session.upgradeToVideo({
  useUpdate       : false,
  sendOnly        : false,
  videoConstraints
}, done);
```

### `setVideoContentHint(hint, share?): void`

| `hint` | 说明 |
| --- | --- |
| `''` | 默认策略 |
| `motion` | 偏向运动流畅度 |
| `detail` | 偏向画面清晰度 |
| `text` | 偏向文字内容；需验证浏览器支持 |

`share` 为可选布尔值，用于指定是否作用于共享视频轨道。Demo 对主视频调用单参数版本。

## 6.9 DTMF 与 SIP INFO

### `sendDTMF(tones, options?): void`

| 参数 | 类型/范围 | 默认值 | 说明 |
| --- | --- | ---: | --- |
| `tones` | `string \| number`；`0～9`、`*`、`#`、`A～D` | 必填 | 可发送一个或一串按键 |
| `transportType` | `INFO` / `RFC2833` | `INFO` | 对端支持的传输方式 |
| `duration` | `70～6000` ms | `100` | 单个 tone 时长；越界会被限制 |
| `interToneGap` | `≥50` ms | `500` | 多 tone 间隔 |
| `extraHeaders` | `string[]` | `[]` | INFO 模式附加头 |

```js
session.sendDTMF('123#', {
  transportType : 'RFC2833',
  duration      : 100,
  interToneGap  : 500
});
```

### `sendInfo(contentType, body?, options?): void`

```js
session.sendInfo(
  'text/plain',
  JSON.stringify({ action: 'custom-event' }),
  { extraHeaders: [ 'X-Trace-Id: 123' ] }
);
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `contentType` | `string` | 是 | MIME 类型，如 `text/plain`、`application/json` |
| `body` | `string` | 否 | 正文；对象需自行 JSON.stringify |
| `options.extraHeaders` | `string[]` | 否 | 附加头 |

## 6.10 AiNS 控制器

通过 `session.getAiNoiseSuppression()` 获取；未启用或已释放返回 `null`。

### 可调参数

| 方法 | 参数 | 返回值 | 说明 |
| --- | --- | --- | --- |
| `setSuppressionLevel(level)` | `number`，`0～100` | `void` | 修改降噪强度 |
| `setOutputGain(value)` | `number`，`0～4` | 实际应用值 | 修改输出增益 |

```js
const aiNS = session.getAiNoiseSuppression();

if (aiNS)
{
  aiNS.setSuppressionLevel(70);
  const gain = aiNS.setOutputGain(1.1);
  console.log('实际增益：', gain);
}
```

## 6.11 MediaEffectsComposer 会话控制器

通过 `session.getMediaEffectsComposer()` 获取；本通电话未传 `mediaEffectsComposer` 或已释放时返回 `null`。

### 会话控制方法

### `getWatermarks(): WatermarkState[]`

返回当前水印快照。用于在保留另一类水印时过滤/更新当前文字或图片水印。

### `setMirror(enabled): Promise<ConfigState>`

`enabled` 为 `boolean`。改变实际合成输出镜像，不是仅改变本地预览 CSS。

### `setWatermarks(watermarks): Promise<WatermarkState[]>`

`watermarks` 可为单个对象、数组或 `null`。

| 字段 | 类型/可选值 | 默认/说明 |
| --- | --- | --- |
| `id` | `string` | 业务唯一标识，便于更新/移除 |
| `target` | `output` / `source` | Demo 使用 `output` |
| `type` | `text` / `image` | 水印类型 |
| `text` | `string` | 文字水印内容 |
| `image` | URL 或图片/画布/视频/ImageBitmap | 图片水印内容 |
| `position` | 7 个预设或 `{x,y}` | Demo 使用预设位置 |
| `width/height` | 正数 | 图片绘制尺寸 |
| `opacity` | `0～1` | 透明度 |
| `fontSize` | 正数 | 文字字号 |
| `font` | CSS font string | 可选完整字体配置 |
| `color` | CSS color | 文字颜色 |
| `backgroundColor` | CSS color | 背景颜色 |
| `padding` / `margin` | 非负数 | 内边距/外边距 |

位置可选值：`top-left`、`top-center`、`top-right`、`center`、`bottom-left`、`bottom-center`、`bottom-right`。

### `setSourceAiVirtualBackground(slot, options): void`

Demo 使用 `slot: 0` 表示本地摄像头。`options.mode` 可为 `none/blur/image/color`，完整参数见第 4 章。

### `clearSourceAiVirtualBackground(slot): void`

清除对应输入源的虚拟背景。Demo 使用 `clearSourceAiVirtualBackground(0)`。

## 6.12 RTCStatsMonitor 会话入口

```js
const monitor = session.statsMonitor;

if (monitor)
{
  console.log(monitor.getLatestNetworkQuality());
  console.log(monitor.getLatestReport());
}
```

| 方法 | 返回值 | 说明 |
| --- | --- | --- |
| `getLatestNetworkQuality()` | 网络质量或 `null` | 不主动采样 |
| `getLatestLegacyReport()` | 兼容报告或 `null` | 不主动采样 |
| `getLatestReport()` | 完整报告或 `null` | 不主动采样 |

会话内实例由 session 管理，不要调用 `start/stop/reset`。独立 PC 的构造和生命周期见第 5 章。

Base JS Demo 还将这三个读取方法组合为控制台辅助函数 `getCurrentCallStats()`；它只读取最近一次结果，不会触发额外采样。

## 6.13 RTCSession 事件：呼叫建立与结束

| 事件 | 参数字段 | 精确触发条件 |
| --- | --- | --- |
| `trying` | 无 | 收到或发出 SIP 100 Trying 阶段 |
| `progress` | `{ originator, mode, response? }` | 1xx（大于 100）临时响应；`local` 常为呼入本端振铃，`remote` 常为呼出收到远端振铃 |
| `accepted` | `{ response }` | 收到 SIP 成功应答，通话正在完成确认 |
| `confirmed` | `{ originator, ack? }` 或可忽略 | ACK 完成，会话正式建立 |
| `failed` | `{ originator, message, cause }` | 未建立成功即结束：取消、拒接、超时、媒体/信令失败 |
| `ended` | `{ originator, message, cause }` | 已建立会话结束 |

`originator` 常见值为 `local`、`remote`，部分系统错误可为 `system`。`cause` 是业务日志和用户提示的主要原因字段。

## 6.14 RTCSession 事件：媒体与控制

| 事件 | 参数 | 触发条件 |
| --- | --- | --- |
| `remoteSupportsVideo` | 无需参数 | 远端 SDP 包含视频媒体能力 |
| `sdp` | `{ originator, type, sdp }` | 每次本地生成或远端接收 SDP；Demo 在互通场景修改 `d.sdp` |
| `hold` / `unhold` | `{ originator: 'local'|'remote' }` | 本端或远端保持状态变化 |
| `mode` | `{ mode: 'audio'|'video' }` | 音视频升级/降级完成 |
| `cameraChanged` | `{ videoStream: MediaStream }` | `switchDevice('camera', ...)` 成功 |
| `remoteShared` | `{ sharedStream }` | 远端开始共享；视频通常在 `sharedStream.videoStream` |
| `remoteUnShared` | 无 | 远端停止共享 |
| `peerconnection:iceConnectionState` | ICE 状态字符串 | PC 的 ICE 连接状态改变 |
| `mediaerror` | `{ type, mediastream }` | 本地媒体轨道/流出现已知异常 |
| `mediaEffectsIssue` | `{ module, message, ... }` | AiNS/composer/虚拟背景异常或降级 |
| `videoTrackState` | `{ track, properties, value }` | 视频 track 的 `muted/readyState/enabled/label` 等属性变化 |
| `muted` / `unmuted` | `{ audio, video }` | 本端静音/恢复操作成功 |
| `upgradeToVideo` | `{ accept, reject, ... }` | 远端请求从音频升级视频 |

ICE 状态可选值通常为 `new/checking/connected/completed/disconnected/failed/closed`。`disconnected` 可能短暂恢复，`failed` 才是明确失败状态。

远端视频升级处理：

```js
session.on('upgradeToVideo', function(data)
{
  const allow = confirm('对方请求开启视频，是否接受？');

  if (allow)
  {
    data.accept(videoConstraints);
  }
  else
  {
    data.reject();
  }
});
```

## 6.15 RTCSession 事件：SIP 扩展消息

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `refer` | `{ request, accept, reject }` | 收到远端 REFER；业务决定接受或拒绝 |
| `newDTMF` | `{ originator, dtmf, request }` | 收到/发出 INFO DTMF；`dtmf.tone` 为按键 |
| `newInfo` | `{ originator, info, request }` | 收到/发出 SIP INFO；`info.contentType/body` |
| `notify` | `{ event, request }` | Demo 处理 `talk` / `hold` 类型 NOTIFY |

REFER、NOTIFY 和 INFO 的具体业务含义依赖 SIP 服务约定。不要只根据消息到达就自动执行敏感操作，应检查来源、事件类型和产品规则。

## 6.16 RTCSession 统计事件

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `stats:detailed-report` | `{ connection, outbound, inbound, quality }` | 新统计面板推荐入口 |
| `stats:network-quality` | `{ RTT, uplinkLoss, downlinkLoss, uplinkNetworkQuality, downlinkNetworkQuality }` | 兼容网络质量 |
| `stats:report` | `{ RTT, upStreams, downStreams }` | 兼容流报告 |
| `stats:stats-error` | `{ code, fatal, message, error, consecutiveErrors }` | 统计错误，不中断通话 |

全部字段、0～6 阈值和 24 个 issue 见 [通话质量统计](./05-call-statistics.md)。

## 6.17 `CRTC.Utils`

### 设备与流

| 方法 | 参数 | 返回值 | 说明 |
| --- | --- | --- | --- |
| `getCameras()` | 无 | Promise 设备数组或错误对象 | 摄像头列表 |
| `getMicrophones()` | 无 | Promise 设备数组或错误对象 | 麦克风列表 |
| `getStreams(pc, type)` | PC、`local`/`remote` | 流集合或 `null` | 获取本地/远端聚合流 |
| `isVideoTrackHealthy(stream)` | `MediaStream` | `boolean` | 检查视频 track 是否可用 |

设备项常见字段：`kind`、`label`、`deviceId`。未授权前 `label` 可能为空。

### 占位轨道

```js
const emptyAudio = await CRTC.Utils.generateAnEmptyAudioTrack();
const blackVideo = CRTC.Utils.generateAnBlackVideoTrack({
  svgSource : noCameraSvg,
  width     : 640,
  height    : 480,
  fps       : 15
});
```

| 方法 | 参数 | 返回值 |
| --- | --- | --- |
| `generateAnEmptyAudioTrack()` | 无 | Promise，包含 `audioTrack` 和相关清理对象 |
| `generateAnBlackVideoTrack(options)` | `svgSource,width,height,fps` | 包含 `videoTrack`、预览/清理能力的对象 |

占位轨道用于明确的无设备业务场景。页面不再使用时应调用返回对象提供的清理能力或停止 tracks，避免长期占用 AudioContext/canvas 定时器。

## 6.18 使用约束总结

- `UA` 是应用/账号级；`RTCSession` 是单通电话级。
- `connected` 不等于 `registered`；呼叫前检查 `isRegistered()`。
- 每次 `newRTCSession` 重新绑定事件。
- 呼入接听和呼出使用同一套 `pcConfig`、媒体和效果参数构造逻辑。
- 事件 `failed`、`ended` 都要清理当前 session 和页面媒体。
- composer、AiNS 和 stats 只能用于它们所属的当前会话。
- `null` 表示能力未创建、字段不可用或对象已释放，必须显式判断。
- 媒体效果和统计异常通常不应直接挂断通话。

[← 上一章：通话质量统计](./05-call-statistics.md) · [下一章：旧版功能升级 →](./07-upgrade-guide.md)
