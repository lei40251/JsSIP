# 6. SDK API 参考

[← 上一章：通话质量统计](./05-call-statistics.md) · [学习目录](./README.md) · [下一章：旧版功能升级 →](./07-upgrade-guide.md)

本章集中列出客户接入时常用的公开 SDK 对象、方法和事件，不作为 SDK 全部类型和底层能力清单。部署专用的 SIP 鉴权、兼容扩展和诊断接口，应以服务方提供的接入要求为准。

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
| `display_name` | `string \| null` | 否 | `null` | SIP From 显示名称 |
| `register` | `boolean` | 否 | `true` | `true` 自动注册；`false` 由 `connected` 后调用 `register()` |
| `register_expires` | 正整数 | 否 | `600` 秒 | REGISTER 过期时间 |
| `session_timers` | `boolean` | 否 | `true` | 是否启用 SIP Session Timer |
| `connection_recovery_min_interval` | 正数 | 否 | `2` 秒 | WSS 恢复最小间隔 |
| `connection_recovery_max_interval` | 正数 | 否 | `30` 秒 | WSS 恢复最大间隔 |

`connection_recovery_min_interval` 必须小于或等于最大值。生产值按网络和服务要求设置。

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

### `unregister(): void`

主动注销 SIP 注册，但不主动停止 UA。注销完成等待 `unregistered` 事件；如需重新注册，可再次调用 `register()`。

```js
ua.unregister();
```

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
const session = await ua.call('bob@example.com', {
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
| `extraFeatures` | `string[]` | `[]` | 服务端已支持的扩展能力，如 BFCP |
| `eventHandlers` | `{ [eventName]: function }` | 无 | 创建会话时直接绑定事件；Demo 用于 `mediaEffectsIssue` |
| `aiNoiseSuppression` | AiNS 配置 | 无 | 启用本地麦克风 AI 降噪 |
| `mediaEffectsComposer` | composer 配置 | 无 | 启用混流、虚拟背景、镜像和水印 |

`mediaStream` 至少包含业务需要发送的有效 track。自定义流和 `mediaConstraints` 同时存在时，不能假设 SDK 会额外采集并合并所有轨道。

Promise 可能因权限拒绝、约束不满足、媒体流无效或呼叫初始化失败而 reject。SIP 拒接/超时通常通过该 session 的 `failed` 事件处理。

### `sendOptions(target)`

Demo 在特定移动端兼容场景中使用 OPTIONS 保活。普通接入不要自行设置发送周期，确有需要时按部署要求调用：

```js
ua.sendOptions(`sip_ping@example.com`);
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `target` | `string` | 是 | OPTIONS 目标 SIP URI |

## 6.5 UA 事件

### 注册和连接事件

| 事件 | 参数 | 触发条件 | 处理建议 |
| --- | --- | --- | --- |
| `browser:navigator:offline` | 无 | 浏览器检测离线 | 显示断网，禁用新呼叫 |
| `browser:navigator:online` | 无 | 浏览器恢复在线 | 显示恢复中，仍等待连接/注册 |
| `connected` | 无需使用参数 | WSS 已连接 | 自动模式等待注册；手动模式调用 `register()` |
| `disconnected` | `{ code, reason }` | WSS 主动/被动断开 | 禁用新呼叫；区分主动 stop |
| `failed` | `{ originator, message, cause }` | UA 操作发生错误 | 记录和提示具体原因 |
| `registered` | `{ response }` | REGISTER 收到成功响应 | 开放呼叫 |
| `unregistered` | `{ cause? }` | 主动注销或注册失效 | 禁用新呼叫；需要时允许重新注册 |
| `registrationFailed` | `{ cause }` | REGISTER 失败或超时 | 保持禁用并提示原因 |

`disconnected` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | `number` | WebSocket 关闭码或连接错误码 |
| `reason` | `string` | 断开原因 |

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
| `rtcOfferConstraints` | WebRTC options | 接收方向约束 |
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
| `status_code` | `number` | 呼入拒接状态码，例如忙线使用 `486` |

```js
// 呼入忙线拒接。
session.terminate({ status_code: 486 });

// 取消呼出或挂断已建立通话。
session.terminate();
```

### `isEstablished(): boolean`

会话是否已建立。它适合保护只允许通话中执行的操作，UI 生命周期仍以 `confirmed/failed/ended` 事件为准。

### `hold(): boolean` / `unhold(): boolean`

```js
session.hold();
session.unhold();
```

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
| `video_only` | `boolean` | 特定兼容场景选项；普通接入不传 |

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

手动触发重新协商。仅在设备切换未覆盖的新媒体方向等明确场景使用：

```js
session.switchDevice('camera', 'environment')
  .then(function()
  {
    session.renegotiate();
  });
```

一般设备切换由 SDK 已处理时不重复调用；Demo 仅在移动端前后摄像头兼容切换后调用。

默认情况下重新协商失败会结束会话。附加屏幕轨等可降级能力可传入 `{ terminateOnFailure: false }`，并通过完成回调的 `error` 参数回退该能力，同时保留原通话。

### `share(type, id?, assembly?, dualOrOptions?, skip?): Promise`

| 参数 | 类型/可选值 | 说明 |
| --- | --- | --- |
| `type` | `screen` / `html` / `pic` / `video` | 分享源类型 |
| `id` | CSS selector / `null` | HTML、图片、视频元素；屏幕传 `null` |
| `assembly` | function / `null` | DOM 转画布函数，如 `html2canvas` |
| `dualOrOptions` | `boolean` / object | `true` 使用 BFCP 双流；`{ mode: 'auxiliary' }` 使用独立辅流 |
| `skip` | `boolean` | BFCP 兼容参数；辅流模式不使用 |

```js
await session.share('screen', null, null);
await session.share('html', '#sharedArea', html2canvas);
await session.share('pic', '#sharedImage', null);
await session.share('video', '#sharedVideo', null);
```

不依赖 BFCP 的辅流模式会新增第二条 video m-line，不替换摄像头。它也可以复用外部屏幕流，适合一份屏幕源发送到多条 RTCSession：

```js
await session.share('screen', null, null, {
  mode                : 'auxiliary',
  mediaStream         : screenStream,
  stopStreamOnUnShare : false,
  contentHint         : 'detail'
});
```

| 辅流字段 | 类型 | 说明 |
| --- | --- | --- |
| `mode` | `'auxiliary'` | 启用非 BFCP 独立辅流 |
| `mediaStream` | `MediaStream` | 可选；复用已有屏幕流，不传时 SDK 调用 `getDisplayMedia` |
| `displayMediaConstraints` | object | SDK 获取屏幕时使用的约束 |
| `stopStreamOnUnShare` | `boolean` | 外部流默认 `false`，SDK 创建的流默认 `true` |
| `contentHint` | string | 默认 `detail` |

### `unShare(): void | Promise<void>`

停止当前分享。辅流模式会发送停止通知并清空共享 sender，因此调用方可以 `await`；方法名中 `S` 为大写。

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
| `useUpdate` | `boolean` | UPDATE 或 re-INVITE |
| `extraHeaders` | `string[]` | 额外头 |
| `mediaEffectsComposer` | object | 为升级后的视频启用混流、虚拟背景、镜像或水印；参数与呼叫/接听一致 |

```js
session.upgradeToVideo({
  useUpdate            : false,
  sendOnly             : false,
  videoConstraints     : videoConstraints,
  mediaEffectsComposer : buildComposerOptions()
}, done);
```

### `setVideoContentHint(hint): void`

| `hint` | 说明 |
| --- | --- |
| `''` | 默认策略 |
| `motion` | 偏向运动流畅度 |
| `detail` | 偏向画面清晰度 |
| `text` | 偏向文字内容；需验证浏览器支持 |

## 6.9 DTMF 与 SIP INFO

### `sendDTMF(tones, options?): void`

| 参数 | 类型/范围 | 默认值 | 说明 |
| --- | --- | ---: | --- |
| `tones` | `string \| number`；`0～9`、`*`、`#`、`A～D` | 必填 | 可发送一个或一串按键 |
| `transportType` | `INFO` / `RFC2833` | `INFO` | 对端支持的传输方式 |

```js
session.sendDTMF('123#', {
  transportType : 'RFC2833'
});
```

### `sendInfo(contentType, body?): void`

```js
session.sendInfo(
  'text/plain',
  JSON.stringify({ action: 'custom-event' })
);
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `contentType` | `string` | 是 | MIME 类型，如 `text/plain`、`application/json` |
| `body` | `string` | 否 | 正文；对象需自行 JSON.stringify |

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

`session.getComposerInputStream()` 返回进入 composer 前的本端原始 `MediaStream`，未启用 composer 时返回 `null`。需要把同一采集源复用到另一条 `RTCSession` 时，应 clone 轨道后再传入，不能直接停止或修改返回流中的轨道。

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
| `type` | `text` / `image` | 水印类型 |
| `text` | `string` | 文字水印内容 |
| `image` | URL | 图片水印地址 |
| `position` | 7 个预设位置 | 水印位置 |
| `width/height` | 正数 | 图片绘制尺寸 |
| `opacity` | `0～1` | 透明度 |
| `fontSize` | 正数 | 文字字号 |
| `color` | CSS color | 文字颜色 |

位置可选值：`top-left`、`top-center`、`top-right`、`center`、`bottom-left`、`bottom-center`、`bottom-right`。

### `setSourceAiVirtualBackground(slot, options): void`

会话集成时通常使用 `slot: 0` 表示本地摄像头。`options.mode` 可为 `none/blur/image/color`，完整参数见第 4 章。

### `clearSourceAiVirtualBackground(slot): void`

清除对应输入源的虚拟背景。本地摄像头通常使用 `clearSourceAiVirtualBackground(0)`。

Base JS Demo 在调用这些方法前先判断当前会话是否真的创建了 composer。以下是 [`app-media-effects.js`](../../demo/base-js/js/app-media-effects.js) 的运行时镜像更新节选：

```js
const { sessionComposer } = getSessionComposerHandles();

if (!sessionComposer)
{
  setStatus('当前通话没有 MediaEffectsComposer，输出镜像将在下一次呼叫/接听时生效');

  return;
}

const outputMirror = document.getElementById('callMediaEffectsComposerOutputMirror').value === 'on';

if (sessionComposer && typeof sessionComposer.setMirror === 'function')
{
  await sessionComposer.setMirror(outputMirror);
}
```

Getter 返回 `null` 不是异常；它通常表示本通呼叫/接听没有启用该能力。

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

该对象随当前会话可用，客户页面直接读取最近结果即可。

## 6.13 RTCSession 事件：呼叫建立与结束

| 事件 | 参数字段 | 触发条件 |
| --- | --- | --- |
| `trying` | 无 | 收到或发出 SIP 100 Trying 阶段 |
| `progress` | `{ originator, mode, response? }` | 1xx（大于 100）临时响应；`local` 常为呼入本端振铃，`remote` 常为呼出收到远端振铃 |
| `accepted` | `{ response }` | 收到 SIP 成功应答，通话正在完成确认 |
| `confirmed` | 无需使用参数 | 会话正式建立 |
| `failed` | `{ originator, message, cause }` | 未建立成功即结束：取消、拒接、超时、媒体/信令失败 |
| `ended` | `{ originator, message, cause }` | 已建立会话结束 |

`originator` 常见值为 `local`、`remote`。`cause` 是业务日志和用户提示的主要原因字段。

Demo 将 `trying` 和 `progress` 转成页面可理解的状态文字。以下代码取自 [`app.js`](../../demo/base-js/js/app.js)：

```js
e.session.on('trying', function()
{
  setStatus('Trying');
});

e.session.on('progress', function(d)
{
  if (d.originator === 'local')
  {
    setStatus('收到呼叫，振铃中');
  }
  else
  {
    if (!earlyMedia)
    {
      // 可在此播放本地回铃音（local ringback tone）
    }

    setStatus('对方已振铃，请等待接听');
  }
});
```

`progress.originator` 是理解“本端呼入振铃”与“呼出收到远端回铃”的关键。

## 6.14 RTCSession 事件：媒体与控制

| 事件 | 参数 | 触发条件 |
| --- | --- | --- |
| `remoteSupportsVideo` | 无需参数 | 远端 SDP 包含视频媒体能力 |
| `hold` / `unhold` | `{ originator: 'local'|'remote' }` | 本端或远端保持状态变化 |
| `mode` | `{ mode: 'audio'|'video' }` | 音视频升级/降级完成 |
| `cameraChanged` | `{ videoStream: MediaStream }` | `switchDevice('camera', ...)` 成功 |
| `remoteShared` | `{ sharedStream, mid?, track? }` | 远端开始 BFCP 或独立辅流共享；视频在 `sharedStream.videoStream` |
| `remoteUnShared` | 无 | 远端停止共享或共享轨结束 |
| `peerconnection:iceConnectionState` | ICE 状态字符串 | PC 的 ICE 连接状态改变 |
| `mediaerror` | `{ type, mediastream }` | 本地媒体轨道/流出现已知异常 |
| `mediaEffectsIssue` | `{ module, message }` | AiNS/composer/虚拟背景异常或降级 |
| `muted` / `unmuted` | `{ audio, video }` | 本端静音/恢复操作成功 |
| `upgradeToVideo` | `{ accept, reject }` | 远端请求从音频升级视频 |

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

Demo 的远端共享事件会直接更新第二个视频区域：

```js
e.session.on('remoteShared', function(d)
{
  document.querySelector('#remoteVideo2').srcObject = d.sharedStream.videoStream;
  document.querySelector('#remoteVideo2').classList = 'mh-100 mw-100';
});

e.session.on('remoteUnShared', function()
{
  document.querySelector('#remoteVideo2').srcObject = null;
  document.querySelector('#remoteVideo2').classList = 'mh-100 mw-100 hide';
});
```

代码取自 [`app.js`](../../demo/base-js/js/app.js)。共享流与普通远端摄像头画面分区显示，可避免停止共享时把主视频也清空。

## 6.15 RTCSession 事件：SIP 扩展消息

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `refer` | `{ request, accept, reject }` | 收到远端 REFER；业务决定接受或拒绝 |
| `newDTMF` | `{ originator, dtmf }` | 收到/发出 INFO DTMF；`dtmf.tone` 为按键 |
| `newInfo` | `{ originator, info }` | 收到/发出 SIP INFO；`info.contentType/body` |
| `notify` | `{ event }` | Demo 处理 `talk` / `hold` 类型 NOTIFY |

REFER、NOTIFY 和 INFO 的具体业务含义依赖 SIP 服务约定。不要只根据消息到达就自动执行敏感操作，应检查来源、事件类型和产品规则。

Demo 的 DTMF 发送和接收是对称的：

```js
document.querySelector('#dtmf').onclick = function(d)
{
  e.session.sendDTMF(d.target.innerText, { 'transportType': 'RFC2833' });
};

e.session.on('newDTMF', function(d)
{
  setStatus(`${d.originator} DTMF:${d.dtmf.tone}`);
});
```

SIP INFO 也同时展示发送与接收入口：

```js
document.querySelector('#sendInfo').onclick = function()
{
  e.session.sendInfo('text/plain', JSON.stringify(document.querySelector('#info').value));
};

e.session.on('newInfo', function(d)
{
  if (d.originator === 'remote')
  {
    setStatus(`收到新消息：${JSON.stringify(d.info.body)}`);
  }
});
```

两段都节选自 [`app.js`](../../demo/base-js/js/app.js)。Demo 的完整 `newInfo` 回调还会根据约定的 JSON `event` 处理呼转等候室，客户项目应按自己的协议处理。

## 6.16 RTCSession 统计事件

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `stats:detailed-report` | `{ connection, outbound, inbound, quality }` | 新统计面板推荐入口 |
| `stats:network-quality` | `{ RTT, uplinkLoss, downlinkLoss, uplinkNetworkQuality, downlinkNetworkQuality }` | 兼容网络质量 |
| `stats:report` | `{ RTT, upStreams, downStreams }` | 兼容流报告 |
| `stats:stats-error` | `{ code, message }` | 统计错误，不中断通话 |

全部字段、质量等级含义和问题码见 [通话质量统计](./05-call-statistics.md)。

Demo 对详细报告的最小实际处理如下：

```js
e.session.on('stats:detailed-report', function(report)
{
  if (statsSession !== e.session)
  {
    return;
  }

  renderSessionStatsStreams('#rtcStatsOutbound', report.outbound, true);
  renderSessionStatsStreams('#rtcStatsInbound', report.inbound, false);
  renderSessionConnectionStats(report.connection);
});

e.session.on('stats:stats-error', function(error)
{
  if (statsSession === e.session)
  {
    console.warn('[RTCStatsMonitor] stats-error:', error);
  }
});
```

代码取自 [`app.js`](../../demo/base-js/js/app.js)。完整 Demo 还会渲染 RTT、上下行质量和 issue 列表。

## 6.17 `CRTC.Utils`

### 设备与流

| 方法 | 参数 | 返回值 | 说明 |
| --- | --- | --- | --- |
| `getCameras()` | 无 | Promise 设备数组或错误对象 | 摄像头列表 |
| `getMicrophones()` | 无 | Promise 设备数组或错误对象 | 麦克风列表 |
| `getStreams(pc, type)` | PC、`local`/`remote` | 流集合或 `null` | 获取本地/远端聚合流 |
| `closeMediaStream(stream)` | `MediaStream` | `void` | 停止并释放流中的全部 track |
| `isVideoTrackHealthy(stream)` | `MediaStream` | `boolean` | 检查视频 track 是否可用 |

设备项常见字段：`kind`、`label`、`deviceId`。未授权前 `label` 可能为空。

Base JS Demo 在获得权限后用 SDK Utils 填充摄像头下拉框。以下代码取自 [`app.sdk-helper.js`](../../demo/base-js/js/app.sdk-helper.js)：

```js
await CRTC.Utils.getCameras()
  .then((cameras) =>
  {
    let option = '<option selected value="">切换摄像头</option>';

    cameras.forEach((device) =>
    {
      option += `<option value="${device.deviceId}">${device.label}</option>`;
    });

    document.querySelector('#cameras').innerHTML = option;
  });
```

麦克风列表使用相同流程调用 `CRTC.Utils.getMicrophones()`。如果页面初次加载时 `label` 为空，应在用户授权后再次调用设备枚举。

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
| `generateAnEmptyAudioTrack()` | 无 | 包含 `audioTrack` 的对象 |
| `generateAnBlackVideoTrack(options)` | `svgSource,width,height,fps` | 包含 `videoTrack`、`cleanup()` 的对象 |

占位轨道用于明确的无设备业务场景。页面不再使用时应调用返回对象提供的清理能力或停止 tracks，避免资源长期占用。

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
