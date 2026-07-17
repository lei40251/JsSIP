# 8. Base JS Demo 完整学习与验证

[← 上一章：旧版功能升级](./07-upgrade-guide.md) · [学习目录](./README.md)

Base JS Demo 是一份可运行的完整接入示例，覆盖 UA 创建、自动/手动注册、呼入呼出、媒体设备、音视频模式、共享、AiNS、虚拟背景、镜像、水印、DTMF、SIP INFO、呼转和通话质量统计。

本章按“先运行 → 配置环境 → 完成基础通话 → 逐项验证功能 → 迁移到业务页面”的顺序使用。

## 8.1 使用建议

建议先完成注册、语音通话和音视频通话，再逐项验证设备切换、媒体效果、共享和统计。迁移到业务页面时，以本指南中的公开 SDK 调用为准，不要复制 Demo 的测试账号或环境配置。

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
http://localhost:8080/demo/base-js/index.html?caller=1001
http://localhost:8080/demo/base-js/index.html?caller=1002
```

第一次打开页面时允许音视频权限，设备列表才能显示完整名称。

## 8.3 环境配置

运行前应按交付说明准备以下信息：

| 配置 | 用途 |
| --- | --- |
| WSS 地址 | 连接 SIP 信令服务 |
| SIP 域和测试账号 | 生成当前账号及被叫地址 |
| 注册凭据 | 完成 SIP 鉴权 |
| SDK 授权码 | 初始化 SDK |
| STUN/TURN 配置 | 建立 WebRTC 媒体连接 |

这些值必须属于同一套可用环境。不要在公开文档、代码仓库或公开页面中写入真实密码、授权码或 TURN 凭据。

## 8.4 URL 参数说明

| 参数 | 示例 | 默认值 | 作用 |
| --- | --- | --- | --- |
| `caller` | `1001` | 无 | 当前 SIP 账号；运行 Demo 时必须传 |
| `register` | `manual` | 自动注册 | `manual` 时连接后显式调用 `ua.register()` |

组合示例：

```text
http://localhost:8080/demo/base-js/index.html?caller=1001&register=manual
```

## 8.5 Demo 的 UA 配置

Demo 会根据已配置的环境和账号创建 `CRTC.UA`。客户项目应使用服务方提供的 WSS、SIP URI、鉴权凭据、授权码和注册参数，不要迁移 Demo 的测试账号规则。完整 UA 配置见 [SDK API 参考](./06-api-reference.md)。

### 自动注册

默认 URL：

```text
?caller=1001
```

`ua.start()` 连接成功后自动注册，事件顺序通常为 `connected → registered`。

### 手动注册

```text
?caller=1001&register=manual
```

配置 `register: false`；`connected` 回调调用 `ua.register()`。最终仍以 `registered` 事件作为可呼叫条件。

页面以 `isConnected()` 和 `isRegistered()` 判断当前是否可以呼叫，注册失败时应先检查环境和账号配置。

## 8.6 WebRTC 网络配置

呼叫和接听参数中的 `pcConfig` 应使用服务方提供的 STUN/TURN 配置。是否强制使用 TURN 以及其他兼容参数必须以部署要求为准，不要照搬测试环境值。

注册成功但没有媒体时，先检查 ICE/TURN，不要只检查 WSS。强制 `relay` 时 TURN 地址、凭据、UDP/TCP 端口或防火墙任一异常都会导致媒体失败。

## 8.7 页面顶部配置项

### 呼叫号码

输入账号部分，例如 `1002`。Demo 调用：

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
| `none` | `mode: 'none'` | 暂不替换背景 |
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

| 按钮 | 核心 SDK 调用 | 媒体内容 |
| --- | --- | --- |
| 语音外呼 | `ua.call()` | 麦克风音频，无视频 |
| 音视频外呼 | `ua.call()` | 麦克风 + 摄像头 |
| 共享桌面 | `session.share()` | 通话中共享屏幕 |

呼叫公共步骤：

1. `ua.isRegistered()` 必须为 true。
2. 终止当前已有会话。
3. 构建当前业务需要的 `pcConfig` 和呼叫参数。
4. 写入当前 composer、虚拟背景和 AiNS 配置。
5. 优先使用自定义 `mediaStream`，否则使用 `mediaConstraints`。
6. 写入选中的 camera/mic deviceId。
7. `await ua.call()`。
8. 在 session 上处理远端媒体和通话事件。

需要使用自定义 SIP 头时，其名称、编码和服务端处理规则必须由双方约定；无明确要求时不要添加。

## 8.10 接听按钮

收到远端 INVITE 后，`newRTCSession.originator === 'remote'`，Demo 显示来电信息并等待选择：

| 按钮 | 媒体策略 |
| --- | --- |
| 语音接听 | 麦克风音频，`video: false` |
| 音视频接听 | 麦克风 + 摄像头 |

每个接听入口都应同时检查：`pcConfig`、媒体约束/自定义流、当前选中设备、composer 和 AiNS。只在呼出路径启用媒体能力会导致接听后功能不一致。

## 8.11 通话中模式切换

| 按钮 | 主要 SDK 调用 | 关键参数 |
| --- | --- | --- |
| 切换音频模式 | `downgradeToAudio()` | `{ useUpdate }` |
| 切换音视频模式 | `upgradeToVideo()` | `{ useUpdate, videoConstraints }` |
| 切换单向视频 | `upgradeToVideo()` | `{ sendOnly: true, useUpdate, videoConstraints }` |

模式切换完成后监听 `mode({ mode: 'audio'|'video' })` 更新页面。不要只在按钮点击时先改 UI，因为远端可能拒绝或协商失败。

## 8.12 静音、设备和保持

| 控件 | SDK 调用 | 参数/返回值 |
| --- | --- | --- |
| 麦克风关/开 | `mute({ audio: true })` / `unmute({ audio: true })` | `isMuted().audio` 可读当前状态 |
| 摄像头关 | `mute({ video: true })` | 关闭本地视频 |
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

质量 `0` 显示暂无数据；不是最佳网络。质量 `6` 表示严重异常，应结合连接状态和连续样本提示。完整解释见 [通话质量统计](./05-call-statistics.md)。

会话失败/结束或当前统计会话切换时，Demo 清空旧面板，防止重呼显示上一通数据。

## 8.16 媒体效果资源检查

确认配置目录中的以下资源可直接返回文件内容：

```text
AiNS: ans.wasm、ans_onnx.tar.gz
虚拟背景: vision.js、相关 WASM 文件、selfie_segmenter_landscape.tflite
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

1. 账号 A 使用自动注册，确认 `connected → registered`。
2. 账号 B 使用 `register=manual`，确认连接后手动注册成功。
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
| 页面没有注册 | `caller`、WSS、证书、账号密码、授权码和注册失败信息 |
| `connected` 但不能呼叫 | 等待 `registered`；手动模式确认调用 `ua.register()` |
| 收到来电但没有声音/画面 | 接听参数、权限、选中设备、ICE/TURN、`connection.ontrack` |
| `ua.call()` reject | 权限、OverconstrainedError、设备被占用、自定义流是否含有效轨道 |
| `getMediaEffectsComposer()` 为 `null` | 本通电话的 call/answer options 未传 composer，或会话已结束 |
| `getAiNoiseSuppression()` 为 `null` | 本通电话未启用 AiNS、尚未创建或会话已结束 |
| 虚拟背景无变化 | composer、slot 0、模型资源、图片 CORS、`mediaEffectsIssue` |
| 图片水印不显示 | URL/CORS、宽高、透明度是否为 0、位置是否超出画面 |
| 共享失败 | HTTPS、浏览器支持、用户是否取消选择、DOM 渲染函数是否加载 |
| 统计显示 `-` | 浏览器字段缺失或结果尚未生成；等待后续样本 |
| 统计显示质量 `0` | 当前方向无有效样本，不是网络最佳 |
| 视频不自动播放 | 处理 `play()` reject，提供用户点击“恢复播放” |
| 页面更新后行为没变 | 确认加载的 SDK 版本和脚本地址，并清理浏览器缓存 |

## 8.19 从 Demo 迁移到业务页面

建议保留的结构：

- 一个应用级 `UA`。
- 在 UA 上集中绑定连接和注册事件。
- 在每次 `newRTCSession` 中绑定本通电话全部事件。
- 一个 `buildCallOptions()` 同时供呼出和呼入接听使用。
- 直接从当前 session 获取 composer、AiNS 和统计。
- `failed/ended` 共用完整清理函数。

业务页面需要替换的部分：

- Demo 的测试账号和环境选择方式。
- 全局变量改为框架状态或组件状态。
- 未使用的扩展能力无需从 Demo 迁移。
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
- 完整统计面板、质量 0～6 和问题码的正确解释。
- 挂断重呼后无旧 session、控制器、媒体流或统计数据残留。

[← 上一章：旧版功能升级](./07-upgrade-guide.md) · [返回学习目录](./README.md)
