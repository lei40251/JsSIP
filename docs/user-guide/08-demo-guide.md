# 8. Base JS Demo 完整学习与验证

[← 上一章：旧版功能升级](./07-upgrade-guide.md) · [学习目录](./README.md)

Base JS Demo 是一份可运行的完整接入示例，覆盖 UA 创建、自动/手动注册、呼入呼出、媒体设备、音视频模式、共享、AiNS、虚拟背景、镜像、水印、DTMF、SIP INFO、呼转和通话质量统计。

本章按“先运行 → 看懂页面参数 → 完成基础通话 → 逐项验证功能 → 对照代码迁移”的顺序使用。

## 8.1 Demo 文件分工

| 文件 | 主要内容 |
| --- | --- |
| [`demo/base-js/index.html`](../../demo/base-js/index.html) | 页面元素、按钮、统计浮层和资源引入顺序 |
| [`demo/base-js/js/app.js`](../../demo/base-js/js/app.js) | UA 配置、注册、会话事件、呼叫/接听、模式、共享和统计 |
| [`demo/base-js/js/app-media-effects.js`](../../demo/base-js/js/app-media-effects.js) | AiNS、虚拟背景、composer、镜像和水印参数 |
| [`demo/base-js/js/app.ui-bindings.js`](../../demo/base-js/js/app.ui-bindings.js) | 页面控件与 SDK 调用的直接绑定 |
| [`demo/base-js/js/app.sdk-helper.js`](../../demo/base-js/js/app.sdk-helper.js) | URL 参数、设备、媒体流和页面辅助函数 |
| [`demo/config.js`](../../demo/config.js) | 环境、WSS、SIP 域、授权和 ICE/TURN 配置 |

阅读顺序建议：先在 `app.js` 找 `configuration`、UA 事件、`newRTCSession` 和 `call()`，再到 `app-media-effects.js` 看媒体参数，最后看 UI 绑定。

## 8.2 运行条件

- Chrome 或 Edge 推荐使用较新版本；Safari/Firefox 需结合目标功能验证。
- 页面必须通过 HTTPS 或 localhost 打开，不能使用 `file://`。
- 浏览器必须允许摄像头、麦克风、屏幕共享和自动播放所需权限。
- 测试账号、WSS、SIP 域、密码、SDK 授权和 TURN 必须属于同一可用环境。
- AiNS、虚拟背景和图片水印资源必须可通过页面 URL 访问。

在项目根目录启动静态服务器：

```bash
python -m http.server 8080
```

打开两个账号：

```text
http://localhost:8080/demo/base-js/index.html?caller=7300
http://localhost:8080/demo/base-js/index.html?caller=7301
```

第一次打开页面时允许音视频权限。Demo 会进行一次预采集以获得完整设备名称，随后停止这次预采集的 tracks。

## 8.3 环境配置

`demo/config.js` 中每个 `env_*` 对象表示一套环境：

```js
const envs = {
  env_default : {
    signalingUrl       : 'wss://sip.example.com/wss',
    sipDomain          : 'example.com',
    secretKey          : 'SDK 授权码',
    iceServers         : [
      {
        urls       : 'turn:turn.example.com:3478?transport=udp',
        username   : 'turn-user',
        credential : 'turn-password'
      }
    ],
    iceTransportPolicy : 'relay',
    password           : '可选密码前缀'
  }
};
```

| 字段 | 类型/可选值 | 必填 | 用途 |
| --- | --- | --- | --- |
| `signalingUrl` | `wss://...` | 是 | SIP over WebSocket 地址 |
| `sipDomain` | 域名或服务约定地址 | 是 | 生成当前账号和被叫 SIP URI |
| `secretKey` | `string` | 是 | SDK 授权 |
| `iceServers` | `RTCIceServer[] \| null` | 视网络 | STUN/TURN 列表 |
| `iceTransportPolicy` | `all` / `relay` | 否 | `all` 允许所有候选；`relay` 强制 TURN |
| `password` | `string` | 否 | Demo 账号密码拼接使用的前缀 |

环境选择：

```text
?caller=7300&env=dev
```

`env=dev` 对应 `env_dev`；不传 `env` 使用 `env_default`。如果名称不存在，页面无法得到完整配置。

## 8.4 URL 参数完整说明

| 参数 | 示例 | 默认值 | 作用 |
| --- | --- | --- | --- |
| `caller` | `7300` | 无 | 当前 SIP 账号；运行 Demo 时必须传 |
| `env` | `dev` | `default` | 选择 `env_dev` 等环境 |
| `register` | `manual` | 自动注册 | `manual` 时连接后显式调用 `ua.register()` |
| `xdata` | Base64 字符串 | `dGVzdCB4LWRhdGE=` | INVITE 的 `X-Data` 随路数据 |
| `mbit` | `800` | `400` | 视频最大码率，单位 kbps |
| `rec` | `30` | 关闭 | Demo 录音时长，单位秒 |
| `noremb` | `true` | `false` | 互通场景的 REMB/Transport-CC 处理选项 |
| `ext` | `BFCP,BP720P` | 无 | 逗号分隔的扩展能力 |

组合示例：

```text
http://localhost:8080/demo/base-js/index.html?caller=7300&env=dev&register=manual&mbit=800&ext=BP720P
```

`ext=BP720P` 会把默认摄像头约束从 `640×480@15fps` 调整为 `1280×720@15fps`。其他扩展必须与服务端和对端能力一致。

## 8.5 Demo 的 UA 配置

Demo 生成：

```js
const configuration = {
  sockets                          : socket,
  uri                              : `sip:${account}@${sipDomain}`,
  display_name                     : account,
  password                         : `${password || 'yl_19'}${account}`,
  connection_recovery_max_interval : 3,
  connection_recovery_min_interval : 2,
  register_expires                 : 20,
  register                         : !manualRegister,
  session_timers                   : false,
  secret_key                       : secretKey
};
```

这些值用于演示，不等于所有项目的推荐生产值：账号密码生成规则、注册过期时间、Session Timer 和重连间隔应按你的 SIP 服务要求配置。

### 自动注册

默认 URL：

```text
?caller=7300
```

`ua.start()` 连接成功后自动注册，事件顺序通常为 `connected → registered`。

### 手动注册

```text
?caller=7300&register=manual
```

配置 `register: false`；`connected` 回调调用 `ua.register()`。最终仍以 `registered` 事件作为可呼叫条件。

页面启动 10 秒后会检查 `isConnected()` 和 `isRegistered()`。任一为 false 时 Demo 停止 UA 并输出网络或注册异常。

## 8.6 WebRTC 网络配置

Demo 的 `pcConfig`：

```js
const pcConfig = {
  iceServers,
  iceTransportPolicy,
  iceCandidatePoolSize : 4,
  bundlePolicy         : 'max-compat'
};
```

| 字段 | Demo 值 | 说明 |
| --- | --- | --- |
| `iceServers` | 来自环境 | STUN/TURN 凭据 |
| `iceTransportPolicy` | `all` 或 `relay` | 是否强制中继 |
| `iceCandidatePoolSize` | `4` | 预收集候选以减少建连等待 |
| `bundlePolicy` | `max-compat` | Demo 使用的媒体协商兼容策略 |

注册成功但没有媒体时，先检查 ICE/TURN，不要只检查 WSS。强制 `relay` 时 TURN 地址、凭据、UDP/TCP 端口或防火墙任一异常都会导致媒体失败。

## 8.7 页面顶部配置项

### 呼叫号码

输入账号部分，例如 `7301`。Demo 调用：

```js
await ua.call(`${number}@${sipDomain}`, options);
```

### 摄像头和麦克风

下拉列表来自 `CRTC.Utils.getCameras()` 和 `getMicrophones()`。选择后：

- 无通话：保存 deviceId，下一次呼叫/接听写入 `mediaConstraints.*.deviceId.exact`。
- 通话中：立即调用 `session.switchDevice('camera'/'audio', deviceId)`。

### 更新方式

| UI | `useUpdate` | 用途 |
| --- | --- | --- |
| `useUpdate` | `true` | 音视频升级/降级时使用 UPDATE 方式 |
| `useReInvite` | `false` | 使用 re-INVITE 方式 |

必须由服务端和对端共同支持，默认联调先使用现网已验证的方式。

### 画质偏好

调用 `session.setVideoContentHint(value)`：

| 值 | 页面文字 | 适合场景 |
| --- | --- | --- |
| `''` | 默认 | 让浏览器自行选择 |
| `detail` | 保清晰 | 文档、静态画面、对分辨率更敏感 |
| `motion` | 保流畅 | 人物运动或对帧率更敏感 |
| `text` | 文本 | 文字/屏幕内容；浏览器支持程度需验证 |

### 输出镜像

只有本次呼叫/接听启用了 `mediaEffectsComposer` 才能通话中生效。下拉变化调用 composer 的镜像更新方法；这是发送合成画面的镜像，不等同于只镜像本地 `<video>` 的 CSS。

### 虚拟背景

| UI 值 | SDK 配置 | 说明 |
| --- | --- | --- |
| 空 | 不传背景配置 | 不启用虚拟背景 |
| `none` | `mode: 'none'` | 运行人物分割但不替换背景的演示选项 |
| `img1` / `img2` | `mode: 'image'` | 使用 Demo 图片资源 |
| `blur` | `mode: 'blur'` | 背景模糊 |

选择会同时影响下一次呼叫/接听；当前会话已有 composer 时也会调用 `setSourceAiVirtualBackground(0, options)` 或清除方法立即更新。

### AiNS

| 控件 | 值/范围 | 生效时机 |
| --- | --- | --- |
| Ai 降噪 | 空 / `AiNS` | 是否在下一次呼叫/接听传 `aiNoiseSuppression` |
| 强度 | 整数 `0～100` | 当前会话已启用时调用 `setSuppressionLevel()`；否则下次生效 |

关闭下拉并不代表当前通话一定会动态销毁已有 AiNS；Demo 重点展示初始启用和强度热更新。需要运行时开关时应按产品设计明确其生命周期。

## 8.8 水印控件

文字水印：

| 字段 | 类型/范围 | 说明 |
| --- | --- | --- |
| 文字 | `string` | 空字符串用于清除或不创建 |
| 位置 | `top-left/top-center/top-right/center/bottom-left/bottom-center/bottom-right` | 锚点位置 |
| 字号 | `number ≥ 8` | 像素字号 |
| 颜色 | CSS 颜色 | 页面使用 color input |
| 透明度 | `0～1` | `0` 全透明，`1` 不透明 |

图片水印：

| 字段 | 类型/范围 | 说明 |
| --- | --- | --- |
| URL | `string` | 图片地址，必须能被当前页面跨域读取 |
| 位置 | 同文字水印 | 锚点位置 |
| 宽/高 | 正数 | 输出画布像素尺寸 |
| 透明度 | `0～1` | 图片不透明度 |

“应用”读取当前控件并调用 `setWatermarks()`；“清空”移除对应水印。`getMediaEffectsComposer()` 返回 `null` 时表示本通电话没有启用 composer，按钮不能改变当前发送画面。

## 8.9 基础呼叫按钮

| 按钮 | `call(type, direction)` | 媒体内容 |
| --- | --- | --- |
| 语音外呼 | `call()` | 麦克风音频，无视频 |
| 音视频外呼 | `call('video')` | 麦克风 + 摄像头 |
| 单视频外呼 | `call('onlyVideo')` | 无音频，视频双向能力按呼叫配置 |
| 共享桌面外呼 | `call('screen')` | 屏幕视频 + 麦克风音频的自定义流 |
| 音视频外呼（无设备） | `call('callnull')` | 静默音频 + 黑屏视频 |
| 无麦克风 | `call('callnullaudio')` | 静默音频 + 摄像头 |
| 无摄像头 | `call('callnullvideo')` | 麦克风 + 黑屏视频 |

呼叫公共步骤：

1. `ua.isRegistered()` 必须为 true。
2. 终止当前已有会话。
3. 构建 `extraHeaders`、`extraFeatures` 和 `pcConfig`。
4. 写入当前 composer、虚拟背景和 AiNS 配置。
5. 优先使用自定义 `mediaStream`，否则使用 `mediaConstraints`。
6. 写入选中的 camera/mic deviceId。
7. `await ua.call()`。
8. 在 session 上绑定远端早期音频轨道。

Demo 的 `extraHeaders`：

```js
[
  `X-Data: ${xdata}`,
  `X-UA: ${navigator.userAgent}`,
  `X-Direction: ${direction || 'sendrecv'}`
]
```

自定义头的名称、编码和服务端处理规则需双方约定。

B2B 按钮还依赖特定外部服务获取目标号码和随路数据，只在相应服务可用时验证；普通 SDK 接入不需要这一步。

## 8.10 接听按钮

收到远端 INVITE 后，`newRTCSession.originator === 'remote'`，Demo 显示来电信息并等待选择：

| 按钮 | 媒体策略 |
| --- | --- |
| 语音接听 | 麦克风音频，`video: false` |
| 音视频接听 | 麦克风 + 摄像头 |
| 单视频接听 | 无音频，只使用视频 |
| 音视频接听（空音频） | 静默音频 + 摄像头 |
| 单自定义视频接听 | 自定义视频流，无常规音频 |
| 音频自定义视频接听 | 麦克风 + 自定义视频流 |

每个接听入口都应同时检查：`pcConfig`、媒体约束/自定义流、当前选中设备、composer 和 AiNS。只在呼出路径启用媒体能力会导致接听后功能不一致。

## 8.11 通话中模式切换

| 按钮 | 主要 SDK 调用 | 关键参数 |
| --- | --- | --- |
| 切换音频模式 | `downgradeToAudio()` | `{ useUpdate }` |
| 切换音视频模式 | `upgradeToVideo()` | `{ useUpdate, videoConstraints }` |
| 切换单向视频 | `upgradeToVideo()` | `{ sendOnly: true, useUpdate, videoConstraints }` |
| 自定义流视频模式 | `upgradeToVideo()` | `{ useUpdate, videoStream }` |
| 自定义流单向视频 | `upgradeToVideo()` | `{ sendOnly: true, useUpdate, videoStream/videoConstraints }` |
| 替换自定义流 | `switchDevice()` 后按需调用 `renegotiate()` | 摄像头可传设备 ID、`user` 或 `environment`；仅在新的媒体方向需要 SDP 协商时调用 `renegotiate()` |

模式切换完成后监听 `mode({ mode: 'audio'|'video' })` 更新页面。不要只在按钮点击时先改 UI，因为远端可能拒绝或协商失败。

## 8.12 静音、设备和保持

| 控件 | SDK 调用 | 参数/返回值 |
| --- | --- | --- |
| 麦克风关/开 | `mute({ audio: true })` / `unmute({ audio: true })` | `isMuted().audio` 可读当前状态 |
| 摄像头关 | `mute({ video: true })` | Demo 也演示 `video_only: true` 兼容选项 |
| 摄像头开 | `unmute({ video: true })` | 监听 `unmuted` |
| 选择摄像头 | `switchDevice('camera', deviceId)` | Promise；完成后触发 `cameraChanged` |
| 选择麦克风 | `switchDevice('audio', deviceId)` | Promise |
| 切换前后摄像头 | `switchDevice('camera', 'user'/'environment')` | 移动端 facingMode |
| 保持/恢复 | `hold()` / `unhold()` | `isOnHold()` 返回 `{ local, remote }` |

保持状态以 `hold/unhold` 事件为准。`originator: 'local'` 表示本端操作，`remote` 表示对端保持。

## 8.13 共享与推流

| 按钮 | 调用 | 参数说明 |
| --- | --- | --- |
| 分享屏幕 | `share('screen', null, null)` | 浏览器弹出屏幕选择 |
| 分享页面元素 | `share('html', '#ele', html2canvas)` | 将 DOM 渲染为共享画面 |
| 分享图片 | `share('pic', '#pic_s', null)` | 选择器指向 `<img>` |
| 分享视频 | `share('video', '#video_s', null)` | 选择器指向正在播放的 `<video>` |
| 停止分享 | `unShare()` | 方法名中的 `S` 大写 |
| 带 `(D)` 的分享 | `share(type, id, assembly, true)` | 双流模式，双方和网络侧必须支持 |

屏幕分享被用户从浏览器原生工具栏停止时，也应结束 SDK 分享状态。普通页面接入应监听屏幕 video track 的 `ended`。

远端通过 `remoteShared` 获得共享流，`remoteUnShared` 清空共享画面。

## 8.14 呼转、SIP INFO 和 DTMF

### 呼转

```js
session.hold();
session.refer(`${target}@${sipDomain}`, {
  eventHandlers : {
    accepted      : function() {},
    failed        : function() {},
    requestFailed : function() {}
  }
});
```

Demo 在呼转前保持当前通话，并根据 refer 的结果恢复或结束。目标格式和转接策略必须与 SIP 服务约定。

### SIP INFO

```js
session.sendInfo(
  'text/plain',
  JSON.stringify(document.querySelector('#info').value)
);
```

接收端监听 `newInfo`。`contentType` 和 body 格式必须双方约定，body 不是自动 JSON。

### DTMF

```js
session.sendDTMF('1', { transportType: 'RFC2833' });
```

Demo 键盘使用 `0～9`、`*`、`#`，接收端监听 `newDTMF`。传输方式还可按对端能力使用 `INFO`，不要在未确认能力时随意切换。

## 8.15 统计浮层

统计浮层在每次 `newRTCSession` 中监听：

```js
session.on('stats:detailed-report', renderReport);
session.on('stats:stats-error', logError);
session.on('stats:network-quality', function() {});
session.on('stats:report', function() {});
```

| 区域 | 字段 |
| --- | --- |
| 上行链路 | 编码、码率、远端抖动/丢包、分辨率、FPS、编码耗时、限制原因 |
| 下行链路 | 编码、码率、本端抖动/丢包、分辨率、FPS、解码耗时 |
| 网络连接 | PC、ICE、DTLS、实际/可用上下行码率 |
| 网络质量 | RTT、上行等级、下行等级 |
| 存在问题 | issue code 的中文名和 `L1～L6` 严重度 |

质量 `0` 显示暂无数据；不是最佳网络。质量 `6` 可能来自 `>40%` 丢包、`>500ms` RTT 或连接 `failed/closed`。完整解释见 [通话质量统计](./05-call-statistics.md)。

会话失败/结束或当前统计会话切换时，Demo 清空旧面板，防止重呼显示上一通数据。

## 8.16 媒体效果资源检查

确认以下资源可直接返回文件内容：

```text
demo/base-js/assets/ains/ans.wasm
demo/base-js/assets/ains/ans_onnx.tar.gz
demo/base-js/assets/aivb/vision.js
demo/base-js/assets/aivb/vision_wasm_internal.wasm
demo/base-js/assets/aivb/vision_wasm_nosimd_internal.wasm
demo/base-js/assets/aivb/selfie_segmenter_landscape.tflite
```

检查项：

- HTTP 状态为 `200`，不是登录页或 HTML 404 页面。
- URL 以当前页面目录为基准能正确解析。
- 跨域部署时响应允许当前页面域访问。
- HTTPS 页面不要加载 HTTP 资源。
- WASM/模型响应没有被网关改写或截断。
- `mediaEffectsIssue` 中的 `module/message` 能显示具体失败能力。

## 8.17 按功能逐步验证

### 阶段 A：注册

1. 账号 7300 默认自动注册，确认 `connected → registered`。
2. 账号 7301 使用 `register=manual`，确认连接后手动注册成功。
3. 修改为错误密码，确认 `registrationFailed` 且呼叫被禁止。
4. 临时断网，观察 offline/disconnected；恢复后等待重新连接和注册。

### 阶段 B：基础呼叫

1. 双方完成语音呼叫。
2. 双方完成音视频呼叫。
3. 验证呼出取消、呼入拒接、主叫挂断和被叫挂断。
4. 验证 `failed/ended` 后按钮和媒体元素复位。
5. 立即重呼，确认不复用旧会话。

### 阶段 C：设备和模式

1. 通话前选择 camera/mic，确认下一通使用选中设备。
2. 通话中切 camera/mic，确认事件和画面/音频变化。
3. 音频升级视频，再降级音频。
4. 分别验证 UPDATE 与 re-INVITE 方式。
5. 验证静音、恢复和保持/恢复。

### 阶段 D：媒体效果

1. 开启 AiNS，设置 `0/50/100` 三档并对比声音。
2. 通话中修改强度，确认当前控制器生效。
3. 验证背景模糊、两张图片、`none` 和清除。
4. 验证输出镜像。
5. 添加文字/图片水印，逐项验证位置、尺寸和透明度。
6. 将资源 URL 临时改错，确认通话继续并收到 `mediaEffectsIssue`。

### 阶段 E：共享和辅助功能

1. 验证屏幕、页面元素、图片和视频分享。
2. 从浏览器共享提示条停止屏幕，确认页面恢复。
3. 验证双流分享前先确认双方能力。
4. 验证 DTMF、新 INFO 和呼转结果事件。

### 阶段 F：统计

1. 刚建连时质量 `0` 显示“暂无数据/检测中”。
2. 正常通话出现音频/视频的上下行行。
3. 对照第 5 章检查面板每一个字段和单位。
4. 使用限速/丢包环境观察等级和 issue 变化。
5. 切设备、共享、升级/降级后确认统计恢复。
6. 挂断和重呼确认面板不残留。

## 8.18 常见问题定位表

| 现象 | 检查顺序 |
| --- | --- |
| 页面没有注册 | `caller`、环境名、WSS、证书、账号密码、授权码、10 秒超时日志 |
| `connected` 但不能呼叫 | 等待 `registered`；手动模式确认调用 `ua.register()` |
| 收到来电但没有声音/画面 | 接听参数、权限、选中设备、ICE/TURN、`connection.ontrack` |
| `ua.call()` reject | 权限、OverconstrainedError、设备被占用、自定义流是否含有效轨道 |
| `getMediaEffectsComposer()` 为 `null` | 本通电话的 call/answer options 未传 composer，或会话已结束 |
| `getAiNoiseSuppression()` 为 `null` | 本通电话未启用 AiNS、尚未创建或会话已结束 |
| 虚拟背景无变化 | composer、slot 0、模型资源、图片 CORS、`mediaEffectsIssue` |
| 图片水印不显示 | URL/CORS、宽高、透明度是否为 0、位置是否超出画面 |
| 共享失败 | HTTPS、浏览器支持、用户是否取消选择、DOM 渲染函数是否加载 |
| 统计显示 `-` | 浏览器字段缺失或基线未建立；等待后续样本 |
| 统计显示质量 `0` | 当前方向无有效样本，不是网络最佳 |
| 视频不自动播放 | 处理 `play()` reject，提供用户点击“恢复播放” |
| Demo 改了但行为没变 | 确认加载的 `dist/CRTC.min.js` 版本并清理浏览器缓存 |

## 8.19 从 Demo 迁移到业务页面

建议保留的结构：

- 一个应用级 `UA`。
- 在 UA 上集中绑定连接和注册事件。
- 在每次 `newRTCSession` 中绑定本通电话全部事件。
- 一个 `buildCallOptions()` 同时供呼出和呼入接听使用。
- 直接从当前 session 获取 composer、AiNS 和统计。
- `failed/ended` 共用完整清理函数。

业务页面需要替换的部分：

- Demo 的测试账号拼接和环境选择方式。
- 全局变量改为框架状态或组件状态。
- B2B、特殊空轨、双流等非当前产品场景可不接入。
- 日志、错误提示、权限引导和监控上报改为产品实现。
- 账号密码、TURN 凭据和授权信息应由安全配置流程提供。

## 8.20 完成标准

只依赖本学习文档和 Base JS Demo，应能完成：

- 自动和手动注册，并正确处理连接/注册失败。
- 音频、视频呼入呼出、取消、拒接和双方挂断。
- 远端音视频和共享流播放。
- camera/mic 切换、静音、保持和音视频模式切换。
- AiNS 初始启用和通话中强度调整。
- 虚拟背景、输出镜像、文字/图片水印。
- 屏幕、DOM、图片、视频分享。
- DTMF、SIP INFO 和呼转。
- 完整统计面板、质量 0～6 和所有 issue 的正确解释。

通话建立并等待至少一个统计周期后，还可在控制台执行 `getCurrentCallStats()`，同时查看兼容网络质量、兼容流报告和完整诊断报告。这样可以把页面摘要与原始字段一一对照；尚未产生报告时返回值中的对应项为 `null`。
- 挂断重呼后无旧 session、控制器、媒体流或统计数据残留。

[← 上一章：旧版功能升级](./07-upgrade-guide.md) · [返回学习目录](./README.md)
