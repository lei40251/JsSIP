# 8. Base JS Demo 完整学习与验证

[← 上一章：旧版功能升级](./07-upgrade-guide.md) · [学习目录](./README.md)

Base JS Demo 是一份可运行的 SDK 接入示例，覆盖模式初始化、自动注册、主动注销/重新注册、呼入呼出、三方通话、媒体设备、音视频模式、共享、AiNS、虚拟背景、镜像、水印、DTMF、SIP INFO、呼转和通话质量统计。

本章不仅说明按钮用途，还按“页面入口 → Demo 代码位置 → SDK 调用 → 事件反馈 → 清理与验证”解释主要功能。客户可以先按功能运行，再根据函数名定位源码。

## 8.1 使用建议

建议先完成注册、语音通话和音视频通话，再逐项验证设备切换、媒体效果、共享和统计。迁移到业务页面时，以本指南中的公开 SDK 调用为准，不要复制 Demo 的测试账号或环境配置。

### 8.1.1 源码入口与加载顺序

| 文件 | 客户应重点阅读的内容 |
| --- | --- |
| [`index.html`](../../demo/base-js/index.html) | 页面控件、按钮 ID、音视频元素和脚本加载顺序 |
| [`app.js`](../../demo/base-js/js/app.js) | UA 配置与事件、`newRTCSession`、呼叫/接听、通话中控制、共享和统计展示 |
| [`app.sdk-helper.js`](../../demo/base-js/js/app.sdk-helper.js) | URL 参数、设备列表、选中设备约束、本地/远端媒体渲染 |
| [`app.ui-bindings.js`](../../demo/base-js/js/app.ui-bindings.js) | 主动注册/注销、外呼按钮、设备下拉框和媒体效果控件绑定 |
| [`app-media-effects.js`](../../demo/base-js/js/app-media-effects.js) | composer、虚拟背景、水印和 AiNS 参数构建及通话中更新 |
| [`config.js`](../../demo/config.js) | Demo 环境选择；客户必须替换为自己的交付配置 |

`index.html` 先加载 SDK 和环境配置，再加载媒体效果、辅助函数、主流程和页面绑定。阅读时建议按以下顺序搜索函数或事件名：

```text
configuration → new CRTC.UA → ua.on(...) → start()
newRTCSession → call(...) / session.answer(...)
session.on(...) → failed / ended 清理
```

### 8.1.2 核心功能定位总表

| 功能 | 页面入口 | 代码定位 | 主要 SDK 调用/事件 |
| --- | --- | --- | --- |
| 自动注册、主动注销/重新注册 | 顶部初始化区、注册控制区 | `initializeDemoMode`、`registerUa`、`unregisterUa` | `start()`、`register()`、`unregister()`、注册事件 |
| 语音/视频外呼 | `#call`、`#callVideo` | `call(type, direction, mediaStream)` | `ua.call()`、`newRTCSession` |
| 语音/视频接听 | `#answer`、`#answerVideo` | `newRTCSession` 中的按钮绑定 | `session.answer()` |
| 三方通话 | 三方模式下的会议成员区 | `app-conference.js` | `ua.call()`、`session.answer()`、`getMediaEffectsComposer()`、`renegotiate()` |
| 设备选择 | `#cameras`、`#mics` | `buildSelected*Constraints()`、设备 `change` 事件 | `CRTC.Utils.get*()`、`switchDevice()` |
| 音视频模式切换 | `#toAudio`、`#toVideo`、`#toVideoSendonly` | `newRTCSession` 中的模式按钮绑定 | `downgradeToAudio()`、`upgradeToVideo()`、`mode` |
| 媒体效果 | 输出镜像、虚拟背景和水印控件 | `buildCallComposerOptions()`、`buildCallAiNsOptions()` | `getMediaEffectsComposer()`、`getAiNoiseSuppression()` |
| 屏幕/元素分享 | 共享与推流区 | `screenShare`、`formShare`、`picShare`、`videoShare` | `share()`、`unShare()`、共享事件 |
| 呼转/INFO/DTMF | 辅助功能区 | `referBtn`、`sendInfo`、`dtmf` | `refer()`、`sendInfo()`、`sendDTMF()` |
| 通话统计 | 视频区下方浮层 | `stats:detailed-report` 监听和渲染函数 | `stats:*` 会话事件 |

页面中的 B2B、无设备、自定义黑屏流、双流兼容按钮属于专项联调入口，不是普通客户接入的必选流程。阅读主流程时先关注上表中的标准入口。

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

示例：

```text
http://localhost:8080/demo/base-js/index.html?caller=1001
```

页面打开后不会创建 UA 或连接信令。选择“初始化点对点”或“初始化三方”后，Demo 创建当前页面唯一的 UA，并自动连接和注册。

## 8.5 Demo 的 UA 配置

Demo 会根据已配置的环境和账号创建 `CRTC.UA`。客户项目应使用服务方提供的 WSS、SIP URI、鉴权凭据、授权码和注册参数，不要迁移 Demo 的测试账号规则。完整 UA 配置见 [SDK API 参考](./06-api-reference.md)。

Demo 中的 UA 创建代码位于 [`app.js`](../../demo/base-js/js/app.js)：

```js
const account = handleGetQuery('caller');
const socket = new CRTC.WebSocketInterface(signalingUrl);
const configuration = {
  sockets                          : socket,
  uri                              : `sip:${account}@${sipDomain}`,
  display_name                     : account,
  password                         : `${password ? password : 'yl_19'}${account}`,
  connection_recovery_max_interval : 3,
  connection_recovery_min_interval : 2,
  register_expires                 : 20,
  register                         : true,
  session_timers                   : false,
  secret_key                       : secretKey
};

const ua = new CRTC.UA(configuration);
```

`signalingUrl`、`sipDomain`、`secretKey`、`iceServers` 和 `password` 由 `config.js` 中选中的环境提供。Demo 的密码拼接方式只是测试环境规则，不是 SDK 固定要求。

### 自动注册

默认 URL：

```text
?caller=1001
```

`ua.start()` 连接成功后自动注册，事件顺序通常为 `connected → registered`。

Demo 对两个状态分别记录：

```js
ua.on('connected', function()
{
  disconnectedBy = null;
  isShowUI = false;
  setStatus('信令连接成功');
});

ua.on('registered', function(data)
{
  setStatus(`注册成功：${data.response.from.uri.toString()}`);
});
```

只看到“信令连接成功”时还不能呼叫，必须继续等待 `registered`。

### 主动注销与重新注册

初始化后 Demo 固定自动注册。注册控制区仍保留主动注销和重新注册，用于验证注册生命周期。

注册控制区对应代码位于 [`app.ui-bindings.js`](../../demo/base-js/js/app.ui-bindings.js)：

```js
document.querySelector('#registerUa').onclick = function()
{
  if (ua.isConnected() && !ua.isRegistered())
  {
    ua.register();
  }
};

document.querySelector('#unregisterUa').onclick = function()
{
  if (ua.isRegistered())
  {
    ua.unregister();
  }
};
```

完整验证顺序：

1. 选择点对点或三方模式，等待 `registered` 事件和“注册成功”状态。
2. 点击“主动注销”，等待 `unregistered` 事件和“未注册”状态。
3. 点击“主动注册”，确认可以重新注册并呼叫。
4. 未注册时点击外呼，`call()` 会通过 `isRegistered()` 阻止呼叫。

为避免影响通话验证，建议在没有活动通话时注销或重新注册。注册状态处理集中在 [`app.js`](../../demo/base-js/js/app.js) 的 `connected`、`registered`、`registrationFailed`、`unregistered` 和 `disconnected` 事件中。

## 8.6 WebRTC 网络配置

呼叫和接听参数中的 `pcConfig` 应使用服务方提供的 STUN/TURN 配置。是否强制使用 TURN 以及其他兼容参数必须以部署要求为准，不要照搬测试环境值。

注册成功但没有媒体时，先检查 ICE/TURN，不要只检查 WSS。强制 `relay` 时 TURN 地址、凭据、UDP/TCP 端口或防火墙任一异常都会导致媒体失败。

Demo 在 [`app.js`](../../demo/base-js/js/app.js) 中按环境参数组装 `pcConfig`：

```js
const pcConfig = {};

iceServers && (pcConfig['iceServers'] = iceServers);
iceTransportPolicy && (pcConfig['iceTransportPolicy'] = iceTransportPolicy);
pcConfig['iceCandidatePoolSize'] = 4;
pcConfig['bundlePolicy'] = 'max-compat';
```

该对象同时传给 `ua.call()` 和两个标准 `session.answer()` 入口。如果只在呼出传 TURN，呼入接听可能在同一网络下出现不同结果。

## 8.7 页面顶部配置项

### 呼叫号码

输入账号部分，例如 `1002`。Demo 调用：

```js
await ua.call(`${number}@${sipDomain}`, options);
```

### 摄像头和麦克风

下拉列表来自 `CRTC.Utils.getCameras()` 和 `getMicrophones()`。选择后：

- 无通话：保存 deviceId，标准呼叫/接听通过 `buildSelectedAudioConstraints()`、`buildSelectedVideoConstraints()` 写入 `deviceId.exact`。
- 通话中：立即调用 `session.switchDevice('camera'/'audio', deviceId)`。

代码位置：设备枚举和约束构建在 [`app.sdk-helper.js`](../../demo/base-js/js/app.sdk-helper.js)，下拉框 `change` 事件在 [`app.ui-bindings.js`](../../demo/base-js/js/app.ui-bindings.js)。标准接听和视频升级也复用相同的视频约束，避免呼出、接听使用不同设备。

约束构建函数会在已选设备时写入 `deviceId.exact`：

```js
function buildSelectedVideoConstraints()
{
  const constraints = Object.assign({}, videoConstraints);

  if (selectCamera)
  {
    constraints.deviceId = { exact: selectCamera };
  }

  return constraints;
}
```

下拉框变化时同时保存下一通要用的设备，并热更新当前通话：

```js
document.querySelector('#cameras').addEventListener('change', function()
{
  const deviceId = this.options[this.selectedIndex].value;

  selectCamera = deviceId;

  if (rtcSession)
  {
    if (typeof cloneStream !== 'undefined' && cloneStream)
    {
      cloneStream.getVideoTracks().forEach((v) =>
      {
        v.stop();
      });
    }
    rtcSession.switchDevice('camera', deviceId);
  }

  setStatus(`${rtcSession ? 'switchDevice' : 'select camera'} ${this.options[this.selectedIndex].innerText}`);
});
```

两段代码分别取自 [`app.sdk-helper.js`](../../demo/base-js/js/app.sdk-helper.js) 和 [`app.ui-bindings.js`](../../demo/base-js/js/app.ui-bindings.js)。麦克风的处理相同，只把设备类型替换为 `'audio'`。

### 更新方式

| UI | `useUpdate` | 用途 |
| --- | --- | --- |
| `useUpdate` | `true` | 音视频升级/降级时使用 UPDATE 方式 |
| `useReInvite` | `false` | 使用 re-INVITE 方式 |

下拉框在 [`app.ui-bindings.js`](../../demo/base-js/js/app.ui-bindings.js) 更新 `useUpdate`；`#toAudio`、`#toVideo` 和 `#toVideoSendonly` 在 [`app.js`](../../demo/base-js/js/app.js) 把该值传给升级/降级方法。必须由服务端和对端共同支持，默认联调先使用现网已验证的方式。

### 画质偏好

调用 `session.setVideoContentHint(value)`：

| 值 | 页面文字 | 适合场景 |
| --- | --- | --- |
| `''` | 默认 | 让浏览器自行选择 |
| `detail` | 保清晰 | 文档、静态画面、对分辨率更敏感 |
| `motion` | 保流畅 | 人物运动或对帧率更敏感 |
| `text` | 文本 | 文字/屏幕内容；浏览器支持程度需验证 |

Demo 在下拉框变化时直接更新当前会话：

```js
document.querySelector('#videoHint').onchange = function()
{
  e.session.setVideoContentHint(this.options[this.selectedIndex].value);
  setStatus(`${this.options[this.selectedIndex].text}`);
};
```

这段代码位于 [`app.js`](../../demo/base-js/js/app.js) 的 `newRTCSession` 内，因此操作的始终是当前这一通会话。

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

以上三项的参数构建和通话中更新集中在 [`app-media-effects.js`](../../demo/base-js/js/app-media-effects.js)：

- `buildCallComposerOptions()`：组合镜像、水印和虚拟背景，供呼叫/标准接听使用。
- `applyCurrentOutputMirrorToSession()`：更新当前通话输出镜像。
- `applyCurrentVirtualBackgroundToSession()`：更新或清除 slot 0 虚拟背景。
- `buildCallAiNsOptions()`：生成下一次呼叫/标准接听的 AiNS 参数。
- `applyAiNsLevelToCurrentCall()`：热更新当前通话降噪强度。

composer 初始配置的核心代码如下，取自 [`app-media-effects.js`](../../demo/base-js/js/app-media-effects.js)：

```js
const outputMirror = document.getElementById('callMediaEffectsComposerOutputMirror').value === 'on';
const aiVBOptions = buildCurrentAiVBOptions();
const watermarks = buildCurrentWatermarks();
const hasComposerEffects = outputMirror || watermarks.length || aiVBOptions;
const composerOptions = {};

if (outputMirror)
{
  composerOptions.mirror = true;
}

if (watermarks.length)
{
  composerOptions.watermarks = watermarks;
}

if (aiVBOptions)
{
  composerOptions.sources = [
    {
      aiVirtualBackground : aiVBOptions
    }
  ];
}
```

AiNS 则使用独立顶层配置：

```js
return {
  enabled             : true,
  noiseReductionLevel : getCurrentAiNsLevel(),
  outputGain          : 1,
  assetConfig         : { cdnUrl: AI_NOISE_ASSET_ROOT }
};
```

前一段将虚拟背景放在 `sources[]`，后一段将 AiNS 放在呼叫 options 顶层，两者的参数层级不能互换。

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

代码位置：水印输入读取、合并和更新位于 [`app-media-effects.js`](../../demo/base-js/js/app-media-effects.js) 的 `buildCurrent*Watermark()`、`mergeSessionWatermarks()`、`applyCurrent*WatermarkToSession()`；按钮绑定位于 [`app.ui-bindings.js`](../../demo/base-js/js/app.ui-bindings.js)。

文字水印的构造函数会保留 SDK 默认值，只写入用户真正填写的可选字段：

```js
function buildCurrentTextWatermark()
{
  const text = document.getElementById('callMediaEffectsComposerTextWatermarkText').value.trim();

  if (!text)
  {
    return null;
  }

  const textPosition = document.getElementById('callMediaEffectsComposerTextWatermarkPosition').value || 'bottom-right';
  const textSize = document.getElementById('callMediaEffectsComposerTextWatermarkSize').value;
  const textColor = document.getElementById('callMediaEffectsComposerTextWatermarkColor').value.trim();
  const textOpacity = readCallMediaEffectsComposerOpacity(
    document.getElementById('callMediaEffectsComposerTextWatermarkOpacity')
  );
  const textWatermark = {
    id       : CALL_TEXT_WATERMARK_ID,
    type     : 'text',
    text     : text,
    position : textPosition
  };

  if (String(textSize).trim())
  {
    textWatermark.fontSize = Number(textSize);
  }

  if (textColor)
  {
    textWatermark.color = textColor;
  }

  if (textOpacity !== undefined)
  {
    textWatermark.opacity = textOpacity;
  }

  return textWatermark;
}
```

更新单个水印前，Demo 用稳定 ID 保留其他水印：

```js
function mergeSessionWatermarks(nextItems, idsToReplace)
{
  const { sessionComposer } = getSessionComposerHandles();
  const current = getSessionWatermarkSnapshot(sessionComposer);

  return current
    .filter((item) => !idsToReplace.includes(item && item.id))
    .concat(nextItems);
}
```

两段都取自 [`app-media-effects.js`](../../demo/base-js/js/app-media-effects.js)。`setWatermarks()` 是全量写入，如果跳过合并步骤，应用文字水印时可能会把图片水印删掉。

## 8.9 基础呼叫按钮

| 按钮 | 核心 SDK 调用 | 媒体内容 |
| --- | --- | --- |
| 语音外呼 | `ua.call()` | 麦克风音频，无视频 |
| 音视频外呼 | `ua.call()` | 麦克风 + 摄像头 |
| 共享桌面外呼 | `getDisplayMedia()` + `ua.call()` | 屏幕视频 + 麦克风作为首次外呼媒体 |
| 分享屏幕 | `session.share('screen', ...)` | 已建立通话后切换到屏幕分享 |

呼叫公共步骤：

1. `ua.isRegistered()` 必须为 true。
2. 终止当前已有会话。
3. 构建当前业务需要的 `pcConfig` 和呼叫参数。
4. 写入当前 composer、虚拟背景和 AiNS 配置。
5. 优先使用自定义 `mediaStream`，否则使用 `mediaConstraints`。
6. 写入选中的 camera/mic deviceId。
7. `await ua.call()`。
8. 在 session 上处理远端媒体和通话事件。

页面级按钮位于 [`app.ui-bindings.js`](../../demo/base-js/js/app.ui-bindings.js)，最终统一进入 [`app.js`](../../demo/base-js/js/app.js) 的 `call(type, direction, mediaStream)`。该函数先检查注册状态，再组合设备、媒体效果、`pcConfig` 和媒体流，最后执行 `await ua.call()`。

标准音频和视频按钮只负责传入呼叫类型：

```js
document.querySelector('#call').onclick = function()
{
  call();
};

document.querySelector('#callVideo').onclick = function()
{
  call('video');
};
```

`call()` 的核心参数组装如下：

```js
if (!ua.isRegistered())
{
  setStatus('请注册成功后呼叫');

  return;
}

rtcSession && rtcSession.terminate();

options = {
  extraHeaders  : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}`, `X-Direction: ${direction || 'sendrecv'}` ],
  extraFeatures : extraFeatures,
  pcConfig      : pcConfig,
  eventHandlers : {
    mediaEffectsIssue : handleSessionMediaEffectsIssue
  }
};

if (mediaStream)
{
  options['mediaStream'] = mediaStream;
}
else
{
  options['mediaConstraints'] = {
    audio : buildSelectedAudioConstraints(),
    video : (type === 'video' || type === 'onlyVideo') ? buildSelectedVideoConstraints() : false
  };
}

options.mediaEffectsComposer = buildCallComposerOptions();
options.aiNoiseSuppression = buildCallAiNsOptions();

remoteNo = number;

const session = await ua.call(`${number}@${sipDomain}`, options);
```

两段均取自 Demo 当前的 [`app.ui-bindings.js`](../../demo/base-js/js/app.ui-bindings.js) 和 [`app.js`](../../demo/base-js/js/app.js)。完整 `call()` 还包含屏幕外呼、占位轨道、单向视频和 iOS OPTIONS 保活；学习标准接入时先掌握上面的主路径。

需要使用自定义 SIP 头时，其名称、编码和服务端处理规则必须由双方约定；无明确要求时不要添加。

## 8.10 接听按钮

收到远端 INVITE 后，`newRTCSession.originator === 'remote'`，Demo 显示来电信息并等待选择：

| 标准按钮 | 媒体策略 |
| --- | --- |
| 语音接听 | 麦克风音频，`video: false` |
| 音视频接听 | 麦克风 + 摄像头 |

两个标准接听入口位于 [`app.js`](../../demo/base-js/js/app.js) 的 `newRTCSession` 回调中，分别绑定 `#answer` 和 `#answerVideo`。它们会组合 `pcConfig`、当前选中设备、composer 和 AiNS，再调用 `session.answer()`。

下面是两个标准入口中最能体现区别的参数部分，取自 [`app.js`](../../demo/base-js/js/app.js)：

```js
document.querySelector('#answer').onclick = function()
{
  e.session.answer({
    mediaConstraints : {
      audio : buildSelectedAudioConstraints(),
      video : false
    },
    pcConfig             : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
    extraHeaders         : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
    rtcOfferConstraints  : { offerToReceiveAudio: true },
    extraFeatures        : extraFeatures,
    mediaEffectsComposer : buildCallComposerOptions(),
    aiNoiseSuppression   : buildCallAiNsOptions()
  });
};

document.querySelector('#answerVideo').onclick = function()
{
  e.session.answer({
    mediaConstraints : {
      audio : buildSelectedAudioConstraints(),
      video : buildSelectedVideoConstraints()
    },
    pcConfig             : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
    extraHeaders         : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
    rtcOfferConstraints  : { offerToReceiveAudio: true, offerToReceiveVideo: true },
    extraFeatures        : extraFeatures,
    mediaEffectsComposer : buildCallComposerOptions(),
    aiNoiseSuppression   : buildCallAiNsOptions()
  });
};
```

两个入口的公共字段完全相同，差异只在本地视频采集和是否希望接收远端视频。

页面还保留空音频、单视频和自定义黑屏流等专项按钮。这些按钮用于验证特殊媒体流，不等同于标准接听路径，也不保证启用顶部选择的全部媒体效果。客户实现常规接听时应参考 `#answer`、`#answerVideo`。

## 8.11 通话中模式切换

| 按钮 | 主要 SDK 调用 | 关键参数 |
| --- | --- | --- |
| 切换音频模式 | `downgradeToAudio()` | `{ useUpdate }` |
| 切换音视频模式 | `upgradeToVideo()` | `{ useUpdate, videoConstraints }` |
| 切换单向视频 | `upgradeToVideo()` | `{ sendOnly: true, useUpdate, videoConstraints }` |

模式切换完成后监听 `mode({ mode: 'audio'|'video' })` 更新页面。不要只在按钮点击时先改 UI，因为远端可能拒绝或协商失败。

代码位置：按钮绑定和 `mode` 事件都在 [`app.js`](../../demo/base-js/js/app.js) 的 `newRTCSession` 回调中。`useUpdate` 来自页面顶部“更新方式”下拉框。

Demo 的标准切换按钮代码如下：

```js
document.querySelector('#toAudio').onclick = function()
{
  e.session.downgradeToAudio({ useUpdate: useUpdate }, () => { setStatus(`切换音频模式完成${curMode}`); });
};

document.querySelector('#toVideo').onclick = function()
{
  e.session.upgradeToVideo({ useUpdate: useUpdate, videoConstraints: buildSelectedVideoConstraints() }, () => { setStatus(`切换视频模式完成${curMode}`); });
};

document.querySelector('#toVideoSendonly').onclick = function()
{
  e.session.upgradeToVideo({ sendOnly: true, useUpdate: useUpdate, videoConstraints: buildSelectedVideoConstraints() }, () => { setStatus('切换视频模式完成') + curMode; });
};
```

以上代码取自 [`app.js`](../../demo/base-js/js/app.js)。视频升级继续复用当前摄像头约束，因此通话前选择的设备在升级时也不会丢失。

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

代码位置：设备下拉框绑定在 [`app.ui-bindings.js`](../../demo/base-js/js/app.ui-bindings.js)；静音、前后摄像头切换和保持按钮，以及 `muted/unmuted`、`cameraChanged`、`hold/unhold` 事件在 [`app.js`](../../demo/base-js/js/app.js) 的 `newRTCSession` 回调中。

麦克风和摄像头使用独立的 mute 参数：

```js
document.querySelector('#muteMic').onclick = function()
{
  console.log('mute: ', e.session.isMuted().audio);
  e.session.mute({ audio: true });
};

document.querySelector('#unmuteMic').onclick = function()
{
  console.log('unmute: ', e.session.isMuted().audio);
  e.session.unmute({ audio: true });
};

document.querySelector('#muteCam').onclick = function()
{
  if (videoOnly)
  {
    e.session.mute({ video: true, video_only: true });
  }
  else
  {
    e.session.mute({ video: true });
  }
};
```

保持按钮先读取本地/远端状态，不会在远端已保持时重复发起本地保持：

```js
document.querySelector('#hold').onclick = function()
{
  const isHold = e.session.isOnHold();

  if (isHold.local)
  {
    e.session.unhold();
  }
  else if (!isHold.remote)
  {
    e.session.hold();
  }
};
```

代码均取自 [`app.js`](../../demo/base-js/js/app.js)。页面最终状态还应以 `muted/unmuted` 和 `hold/unhold` 事件为准，不只依赖按钮点击。

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

三方模式仍只采集一次屏幕，但会把同一个 `MediaStream` 传给 B、C 各自的 `session.share()`：

```js
await leg.session.share('screen', null, null, {
  mode                : 'auxiliary',
  mediaStream         : screenStream,
  stopStreamOnUnShare : false
});
```

Demo 负责目标选择和统一停止 `screenStream`；SDK 负责每条会话的 sender、re-INVITE、MID 通知以及远端 `remoteShared/remoteUnShared` 事件。页面代码不应直接操作共享 transceiver。

代码位置：`#screenShare`、`#formShare`、`#picShare`、`#videoShare`、`#stopShare` 以及带 `D` 的双流入口都在 [`app.js`](../../demo/base-js/js/app.js)。标准客户接入先参考不带 `D` 的方法；双流需要双方及网络侧能力支持。

标准屏幕共享会保留 SDK 返回的 stream，并监听浏览器原生停止操作：

```js
document.querySelector('#screenShare').onclick = function()
{
  e.session.share('screen', null, null)
    .then((stream) =>
    {
      document.querySelector('#screen').srcObject = stream;
      document.querySelector('#screen').classList = 'mh-100 mw-100';

      stream.getVideoTracks()[0].onended = () =>
      {
        document.querySelector('#screen').classList = 'mh-100 mw-100 hide';
      };
    });
};
```

其他标准共享入口和停止逻辑如下：

```js
document.querySelector('#formShare').onclick = function()
{
  e.session.share('html', '#ele', html2canvas);
};

document.querySelector('#picShare').onclick = function()
{
  e.session.share('pic', '#pic_s', null);
};

document.querySelector('#videoShare').onclick = function()
{
  document.querySelector('#video_s').play()
    .then(() =>
    {
      e.session.share('video', '#video_s', null);
    });
};

document.querySelector('#stopShare').onclick = function()
{
  e.session.unShare();

  setTimeout(() =>
  {
    getStreams(e.session.connection);
  }, 300);
};
```

以上代码均取自 [`app.js`](../../demo/base-js/js/app.js)。`unShare()` 后重新读取 PeerConnection 媒体，是为了恢复本地和远端主画面。

## 8.14 呼转、SIP INFO 和 DTMF

### 呼转

```js
const eventHandlers = {
  'progress'         : function(data) { console.log('progress', data); },
  'failed'           : function() { if (e.session.isOnHold().local) { e.session.unhold(); } },
  'accepted'         : function(data) { console.log('accept', data); e.session.terminate(); },
  'trying'           : function(data) { console.log('trying', data); },
  'requestSucceeded' : function(data) { console.log('requestSucceeded', data); },
  'requestFailed'    : function() { if (e.session.isOnHold().local) { e.session.unhold(); } }
};

e.session.hold();
e.session.refer(`${document.querySelector('#refer').value}@${sipDomain}`, {
  eventHandlers : eventHandlers
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

Demo 的实际键盘会取用户点击的按键文字，接收时读取 `d.dtmf.tone`：

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

代码位置：发送按钮 `referBtn`、`sendInfo`、`dtmf` 以及接收事件 `refer`、`newInfo`、`newDTMF` 均位于 [`app.js`](../../demo/base-js/js/app.js) 的 `newRTCSession` 回调中。

## 8.15 统计浮层

统计浮层在每次 `newRTCSession` 中监听：

```js
statsSession = e.session;
resetSessionStatsPanel();

e.session.on('stats:detailed-report', function(report)
{
  if (statsSession !== e.session)
  {
    return;
  }

  const quality = report.quality;
  const issueText = quality.issues.map((issue) =>
  {
    return `${sessionStatsIssueNames[issue.code] || issue.code}(L${issue.severity})`;
  }).join(' | ');

  renderSessionStatsStreams('#rtcStatsOutbound', report.outbound, true);
  renderSessionStatsStreams('#rtcStatsInbound', report.inbound, false);
  renderSessionConnectionStats(report.connection);
  setSessionStatsPanelText(
    '#rtcStatsQuality',
    `RTT:${formatSessionStatsNumber(quality.RTT, 'ms')} | ↑:${formatSessionNetworkQuality(quality.uplinkNetworkQuality)} | ↓:${formatSessionNetworkQuality(quality.downlinkNetworkQuality)}`
  );
  setSessionStatsPanelText('#rtcStatsIssues', issueText || '无');
});

e.session.on('stats:stats-error', function(error)
{
  if (statsSession === e.session)
  {
    console.warn('[RTCStatsMonitor] stats-error:', error);
  }
});
```

这段代码直接取自 [`app.js`](../../demo/base-js/js/app.js) 的 `RTCSession 统计事件接入示例`。

| 区域 | 字段 |
| --- | --- |
| 上行链路 | 编码、码率、远端抖动/丢包、分辨率、FPS、编码耗时、限制原因 |
| 下行链路 | 编码、码率、本端抖动/丢包、分辨率、FPS、解码耗时 |
| 网络连接 | PC、ICE、DTLS、实际/可用上下行码率 |
| 网络质量 | RTT、上行等级、下行等级 |
| 存在问题 | issue code 的中文名和 `L1～L6` 严重度 |

质量 `0` 显示暂无数据；不是最佳网络。质量 `6` 表示严重异常，应结合连接状态和连续样本提示。完整解释见 [通话质量统计](./05-call-statistics.md)。

会话失败/结束或当前统计会话切换时，Demo 清空旧面板，防止重呼显示上一通数据。

代码位置：统计事件绑定、格式转换和浮层渲染均在 [`app.js`](../../demo/base-js/js/app.js) 的 `newRTCSession` 回调前半部分。页面只消费 `session` 的 `stats:*` 公开事件；质量 `0` 显示“暂无数据”，质量 `6` 显示“严重异常”。

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

Demo 对媒体效果异常只记录和提示，不会挂断通话：

```js
function handleSessionMediaEffectsIssue(d)
{
  const moduleName = d && d.module ? d.module : 'MediaEffects';
  const message = d && d.message ? d.message : 'Unknown media effects failure';

  console.warn(
    `[base-js][mediaEffectsIssue] module=${moduleName} message=${message}`,
    d
  );
  setStatus(`媒体效果异常[${moduleName}]：${message}`);
}
```

该函数位于 [`app.js`](../../demo/base-js/js/app.js)，呼出时通过 `options.eventHandlers.mediaEffectsIssue` 传入，呼入会话则在 `newRTCSession` 中绑定事件。

## 8.17 按功能逐步验证

### 阶段 A：注册

1. 账号 A 使用自动注册，确认 `connected → registered`。
2. 账号 B 初始化后确认自动触发 `registered`。
3. 点击“主动注销”，确认 `unregistered`。
4. 再次点击“主动注册”，确认可以恢复呼叫。
5. 修改为错误密码，确认 `registrationFailed` 且呼叫被禁止。
6. 临时断网，观察 offline/disconnected；恢复后确认 WSS 重连，再按当前注册模式完成注册。

### 阶段 B：基础呼叫

1. 双方完成语音呼叫。
2. 双方完成音视频呼叫。
3. 验证呼出取消、呼入拒接、主叫挂断和被叫挂断。
4. 验证 `failed/ended` 后会话引用、统计浮层和媒体展示复位。
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
2. 从浏览器共享提示条停止屏幕，确认本地预览隐藏且通话视频恢复。
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
| `connected` 但不能呼叫 | 等待 `registered`；若注册失败，检查账号鉴权和注册事件 |
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

Demo 中可以直接参考的结构：

- 一个应用级 `UA`。
- 在 UA 上集中绑定连接和注册事件。
- 在每次 `newRTCSession` 中绑定本通电话全部事件。
- 直接从当前 session 获取 composer、AiNS 和统计。

Demo 的应用入口会先请求权限并枚举设备，然后启动 UA：

```js
function start()
{
  setStatus(`${CRTC.version}`);

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(async(mediastream) =>
    {
      await updateDevices();
      mediastream && mediastream.getTracks().forEach((track) => track.stop());
    })
    .catch(async(error) =>
    {
      try
      {
        await updateDevices();
      }
      catch (deviceError)
      {
        setStatus(`设备列表加载失败: ${deviceError.name || deviceError.message || 'unknown'}`);
      }

      setStatus(`预采集失败: ${error.name || error.message || 'unknown'}`);
    });

  handleStop = false;
  disconnectedBy = null;
  isShowUI = false;

  ua.start();

  setTimeout(() =>
  {
    if (!ua.isConnected() || !ua.isRegistered())
    {
      ua.stop();
      console.log('网络连接异常或未注册成功');
    }
  }, 10000);
}

start();
initMediaEffects();
```

这段代码取自 [`app.js`](../../demo/base-js/js/app.js)。预采集只为了请求权限和获取带名称的设备列表，因此成功后立即停止这些 tracks。

页面退出时的 UA 清理位于 [`app.ui-bindings.js`](../../demo/base-js/js/app.ui-bindings.js)：

```js
window.onbeforeunload = function()
{
  handleStop = true;
  ua.stop();
};
```

`handleStop` 会让 UA 的 `disconnected` 事件把这次断开识别为主动退出，不当成网络故障。

业务页面建议在迁移时进一步整理：

- 把呼叫与接听的公共配置收敛为一个 `buildCallOptions()`，避免两条路径参数不一致。
- 把 `failed/ended` 中的公共处理收敛为一个会话清理函数。
- 把 Demo 的全局状态替换为框架状态或组件状态。

业务页面需要替换的部分：

- Demo 的测试账号和环境选择方式。
- 未使用的扩展能力无需从 Demo 迁移。
- 日志、错误提示、权限引导和监控上报改为产品实现。
- 账号密码、TURN 凭据和授权信息应由安全配置流程提供。

## 8.20 完成标准

只依赖本学习文档和 Base JS Demo，应能完成：

- 初始化后自动注册、主动注销和重新注册，并正确处理连接/注册失败。
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
