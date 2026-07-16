# 04 `MediaDevices` 与媒体采集

> 本文沿“枚举 → 构造约束 → 采集 → 校验 → 发布 → 切换 → 停止”说明摄像头、麦克风和屏幕共享。

## 1. 本章结论

源码把采集分成三条入口：

| 入口 | 浏览器 API | 输出 |
|---|---|---|
| 摄像头/麦克风 | `getUserMedia()` | 本地 source MediaStreamTrack |
| 屏幕/窗口/标签页 | `getDisplayMedia()` | 屏幕视频和可选系统音频 Track |
| 自定义轨道 | 调用方传入原生 Track | 跳过浏览器采集，只进入 Track 包装和发布 |

SDK 不会把一次失败直接视为最终失败。它会根据错误类型和浏览器兼容性逐级放宽约束；采集成功后再读取 `getSettings()`，因为浏览器实际采用的设备和规格可能与请求不同。

## 2. API、位置和职责

| API | 主要用途 | 代表性源码区域 |
|---|---|---:|
| `enumerateDevices()` | 枚举摄像头、麦克风和扬声器 | 媒体设备管理与公开设备接口 |
| `getUserMedia()` | 摄像头/麦克风采集 | Track capture 与兼容层 |
| `getDisplayMedia()` | 屏幕采集 | ScreenTrack capture 与浏览器 Shim |
| `getSupportedConstraints()` | 判断约束字段是否可用 | 约束构造前 |
| `track.getCapabilities()` | 查询设备可调范围 | 采集后、切换/约束前 |
| `track.getSettings()` | 读取实际设备和分辨率/帧率 | 采集、上报和 media settings |
| `track.applyConstraints()` | 不重采集地更新约束 | 设备/规格更新和屏幕二次约束 |

完整出现位置见附录 A。

## 3. Adapter 先统一浏览器差异

采集业务调用前，Adapter 可能已经修改：

- 旧 Chrome/Firefox 的音频约束字段名。
- Safari 的空对象和 `undefined` 约束清理。
- legacy `navigator.getUserMedia` 到 Promise 风格的统一。
- 缺少原生 `getDisplayMedia()` 时，通过外部 sourceId 和 `getUserMedia()` 模拟屏幕采集。

因此业务里的标准调用不代表目标浏览器原生就完整支持该参数。最终仍要结合 `getSupportedConstraints()`、错误类型和 `getSettings()` 判断。

## 4. 设备枚举完整链

```text
公开设备查询
  → navigator.mediaDevices.enumerateDevices()
  → 按 kind 分类 videoinput / audioinput / audiooutput
  → 过滤或标记默认设备
  → 生成 SDK 设备对象
```

浏览器在未授权前可能返回空 `label`，这不代表没有设备。设备枚举还受到以下条件影响：

- 页面必须处于安全上下文。
- 浏览器可能隐藏非默认设备，直到成功授权采集。
- `audiooutput` 和 `setSinkId()` 不是所有浏览器都支持。
- 设备拔插后旧 deviceId 可能失效。

## 5. 摄像头约束从哪里来

公开 `startLocalVideo()` 的主要输入会分流到不同层：

| 用户参数 | 最终位置 |
|---|---|
| `cameraId` | `getUserMedia.video.deviceId` |
| `useFrontCamera` | `facingMode` |
| profile width/height/frameRate | 视频采集约束 |
| profile bitrate | sender parameters 或 SDP，不属于 gUM |
| mirror/fillMode/rotation | Player 或 Canvas，不属于 gUM |
| 自定义 `videoTrack` | 跳过摄像头采集 |

典型约束形态：

```js
{
  video: {
    deviceId: { exact: cameraId },
    width: { ideal: width },
    height: { ideal: height },
    frameRate: { ideal: frameRate },
    facingMode: useFrontCamera ? 'user' : 'environment'
  }
}
```

源码会根据入口和兼容分支使用 exact、ideal 或普通值，不能假定所有字段都严格满足。

## 6. 麦克风约束从哪里来

音频约束除 `deviceId` 外，还可能包含：

- `echoCancellation`
- `noiseSuppression`
- `autoGainControl`
- `channelCount`
- `sampleRate`
- 浏览器或 SDK 扩展字段

采集约束只决定浏览器 source track。后续 Web Audio、AI 降噪、Gain 和音量检测属于处理管线，不能全部归因于 `getUserMedia()`。

## 7. `getUserMedia()` 的逐级降级

采集工具不会对所有错误统一重试。典型判断是：

```text
getUserMedia(strict constraints)
  ├─ 成功 → 校验 tracks → 读取 settings
  └─ 失败
       ├─ OverconstrainedError → 放宽具体约束
       ├─ 浏览器不支持字段 → 删除兼容性字段
       ├─ 精确 deviceId 失效 → 选择默认设备或重新枚举
       └─ NotAllowed / Security / NotReadable → 包装并上抛
```

权限拒绝、非安全上下文、设备被系统占用等错误不能靠反复放宽尺寸解决。重试必须保留错误语义。

## 8. 自定义轨道分支

调用方传入原生 `MediaStreamTrack` 时：

```text
custom track
  → 校验 kind 和 readyState
  → Track.setInputMediaStreamTrack()
  → 可选处理管线
  → 发布或本地播放
```

该分支不调用 `getUserMedia()`，因此：

- SDK 不拥有外部采集设备的创建过程。
- 是否在 `close()` 时停止外部 Track，必须按 Track 包装的所有权约定处理。
- cameraId、facingMode 等采集选项不再生效。

## 9. 采集后的校验

采集 Promise resolve 后仍要检查：

1. MediaStream 是否包含期望 kind 的 Track。
2. Track 是否已 `ended`。
3. `getSettings()` 中的 deviceId、width、height、frameRate、sampleRate 等实际值。
4. 浏览器是否返回了与目标设备不同的默认设备。

后续 SDK media settings 和上报应优先使用实际 settings；无法读取时才回退 profile。

## 10. 屏幕共享的约束和能力

屏幕采集不是普通摄像头采集的别名。它还涉及：

- `displaySurface` 和浏览器选择器。
- 系统音频是否可选。
- 当前标签页 Capture Handle。
- CropTarget/区域裁剪。
- 用户从浏览器 UI 点击“停止共享”触发的 `ended`。

```text
startScreenShare(options)
  → 检查 getDisplayMedia / 兼容路径
  → 构造 display constraints
  → navigator.mediaDevices.getDisplayMedia()
  → 校验 video track
  → 可选 applyConstraints / cropTo
  → 可选额外 getUserMedia() 采集麦克风
  → ScreenTrack.setInputMediaStreamTrack()
```

## 11. 系统音频和额外麦克风是两条来源

`getDisplayMedia({audio:true})` 返回的音频是浏览器/操作系统允许共享的系统或标签页音频；“同时采集麦克风”通常需要额外调用一次 `getUserMedia({audio:...})`。

两条轨道后续可以：

- 分别发布。
- 进入 Web Audio 混音后输出一条 Track。
- 在不支持系统音频时只保留麦克风。

不能把 `audio:true` 解释成所有浏览器都会返回系统声音。

## 12. 屏幕区域裁剪

支持 Region Capture 时，典型握手为：

```text
目标 DOM element
  → CropTarget.fromElement(element)
  → screenVideoTrack.cropTo(cropTarget)
```

这是采集后的 Track 操作，不是 `getDisplayMedia()` 的普通 width/height 约束。能力不存在或调用失败时应继续使用完整屏幕 Track，而不是中断整个通话。

## 13. 设备切换和重采集

设备切换有两种路径：

| 路径 | 适合场景 | 后续动作 |
|---|---|---|
| `applyConstraints({deviceId})` | 浏览器和当前 Track 支持无缝切换 | 重新读取 settings；必要时通知 sender 参数 |
| 重新 `getUserMedia()` | applyConstraints 不支持或失败 | 新 Track 接入处理管线，sender replaceTrack，最后停旧 Track |

安全交接顺序是：

```text
先采集并验证新 Track
  → 替换 Track 包装输入/处理输出
  → sender.replaceTrack(newOutTrack)
  → Player 切换
  → 再 stop 旧 source/out Track
```

过早停止旧 Track 会造成可感知黑屏或静音。

## 14. `ended`、拔插和恢复

- 屏幕 Track `ended` 通常表示用户从浏览器共享 UI 主动停止。
- 摄像头/麦克风设备拔出可能触发 ended、mute 或设备列表变化。
- `muted` 不等于 `ended`，短暂没有媒体数据时不应立即销毁。
- 自动恢复前必须判断用户是否已经主动 stop/close，避免停止后又重新拉起权限请求。

## 15. 停止和释放

```text
停止本地媒体
  → Room.unpublish / sender.replaceTrack(null)
  → 停 Player 和处理管线
  → 解绑 ended/mute/unmute/devicechange
  → sourceTrack.stop()
  → 清 MediaStream 和 Track 引用
```

`RTCPeerConnection.close()`、`removeTrack()` 或 `replaceTrack(null)` 都不会自动关闭摄像头、麦克风或屏幕采集。真正拥有 source track 的 Track/Manager 必须显式 `stop()`。

## 16. API 参数与本项目实参

### 16.1 `enumerateDevices()`

MDN：[enumerateDevices()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices)

该方法没有参数，返回 `Promise<MediaDeviceInfo[]>`。每个结果主要包含 `kind`、`deviceId`、`groupId`、`label`；输入设备在支持时可能是带 `getCapabilities()` 的 `InputDeviceInfo`。

源码 L19283—L19345 的包装入口是 `handleEncryption(mode = 0)`。`mode` 是 SDK 自己的参数，不会传给浏览器：

| `mode` | SDK 行为 | 原生 API 实参 |
|---:|---|---|
| `0` | 只枚举一次，不主动申请权限补 label | `enumerateDevices()` 无参 |
| `1` | 若发现未授权的空标识设备，只临时申请音频权限 | `getUserMedia({audio:true, video:false})`，之后再次无参枚举 |
| `2` | 若发现未授权的空标识设备，只临时申请视频权限 | `getUserMedia({audio:false, video:true})`，之后再次无参枚举 |
| 其他非零值 | 按缺失类型申请音频和/或视频 | 动态 `{audio:boolean, video:boolean}` |

实际源码：

```js
let devices = await navigator.mediaDevices.enumerateDevices();
const permissionProbe = { audio: false, video: false };

// 根据空 deviceId/groupId 和 mode 决定 true/false
stream = await navigator.mediaDevices.getUserMedia(permissionProbe);
devices = await navigator.mediaDevices.enumerateDevices();
stream?.getTracks().forEach(track => track.stop());
```

第二次枚举的目的只是让授权后的 `label/deviceId` 可见；临时流立即停止，不进入发布链。

### 16.2 `getUserMedia(constraints)` 的顶层参数

MDN：[getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)、[MediaTrackConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints)

`constraints` 必填，结构是 `{audio, video}`：每项可以是 `false`、`true` 或约束对象。两项都缺失/为 `false` 会拒绝。返回 `Promise<MediaStream>`。

| 值 | 含义 | 本项目使用 |
|---|---|---|
| `false` | 不请求该媒体类型 | 只采麦克风时 `video:false`；只采摄像头时可令 `audio:false` |
| `true` | 请求该类型，接受浏览器默认设备和默认规格 | 最后一次降级的 `useTrueAsConstraint` 分支；枚举前权限探测 |
| 约束对象 | 请求该类型，并给设备选择算法必需或偏好条件 | 正常摄像头/麦克风采集 |

源码 L20280—L20315 先由 SDK 配置 `e` 构造真正的浏览器参数 `t`：

```js
const t = {
  audio: isAudioConstraintsValid(e),
  video: isVideoConstraintsValid(e)
};

const stream = await navigator.mediaDevices.getUserMedia(t);
```

因此公开配置 `e.cameraId/e.width/...` 并不是直接原样传入；两个 builder 会删除空字段、决定 `exact/ideal/max`，重试时还会改变形态。

### 16.3 约束值的三种表达方式

媒体约束中的单个字段可以是普通值，也可以是约束对象：

| 写法 | 选择语义 | 失败表现 |
|---|---|---|
| `field: value` | 普通请求；浏览器尽量匹配 | 通常可选择近似值 |
| `field: {ideal: value}` | 偏好值，不要求必须满足 | 不匹配时可选择其他值 |
| `field: {exact: value}` 或 `{min,max}` | 强制约束 | 无设备满足时可抛 `OverconstrainedError` |

本项目第一次通常对明确的 `deviceId` 使用 `{exact:id}`，对分辨率使用 `{ideal,max}`；失败后依次去掉 max、去掉 exact、只保留 deviceId，最后降级为 `true`。所以日志中同一次公开调用可能出现多组不同的 `getUserMedia` 实参。

### 16.4 音频约束：每个字段怎样生成

`isAudioConstraintsValid(e)`（L20362—L20402）生成的对象：

```js
const audio = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: e.sampleRate
};

audio.deviceId = e.useExactDeviceId
  ? { exact: e.microphoneId }
  : e.microphoneId;
```

| 浏览器字段 | 类型/可选值 | 含义 | SDK 来源与实际规则 |
|---|---|---|---|
| `deviceId` | `string` 或 `ConstrainDOMString` | 选择输入设备 | `e.microphoneId`；首次可包装 `{exact:...}`，exact 失败后改普通字符串 |
| `echoCancellation` | `boolean`，部分实现还支持枚举字符串 | 请求浏览器回声消除 | 默认 `true`；公开值是 boolean、`'remote-only'` 或 `'all'` 时覆盖 |
| `noiseSuppression` | `boolean` | 请求浏览器噪声抑制 | 默认 `true`；源码仅在公开值明确为 `false` 时覆盖为 `false` |
| `autoGainControl` | `boolean` | 请求自动增益 | 默认 `true`；源码仅在公开值明确为 `false` 时覆盖为 `false` |
| `sampleRate` | number 或数值约束 | 期望采样率，浏览器可能不精确满足 | 直接来自 `e.sampleRate`；空值会在清理逻辑中被忽略 |
| `channelCount` | number 或数值约束 | 期望声道数 | 只有 `e.channelCount` 是 number 时才加入 |

`echoCancellation/noiseSuppression/autoGainControl` 只控制浏览器 source track。后面的 AudioWorklet、AI 降噪和 Gain 不是这些字段的“实现细节”，而是独立处理链。

### 16.5 视频约束：每个字段怎样生成

`isVideoConstraintsValid(e)`（L20404—L20428）实际构造：

```js
if (e.cameraId) {
  video.deviceId = e.useExactDeviceId ? { exact: e.cameraId } : e.cameraId;
} else if (e.facingMode) {
  video.facingMode = e.facingMode;
}

video.width  = { ideal: e.width,  max: e.width  };
video.height = { ideal: e.height, max: e.height };
video.frameRate = e.frameRate;
```

| 浏览器字段 | 类型/常用可选值 | 含义 | SDK 来源与分支 |
|---|---|---|---|
| `deviceId` | string / `{exact,ideal}` | 指定摄像头 | 有 `cameraId` 时使用；与 `facingMode` 二选一，优先 cameraId |
| `facingMode` | 常见 `'user'`、`'environment'`、`'left'`、`'right'`，也可 exact/ideal | 偏好前后摄像头 | 只有没有 cameraId 时才传 `e.facingMode` |
| `width` | number / `{min,max,exact,ideal}` | 采集帧宽度 | 通常 `{ideal:width,max:width}`；重试会去掉 max；Firefox 极低分辨率兼容分支直接传 number |
| `height` | 同 width | 采集帧高度 | 与 width 同步构造 |
| `frameRate` | number / 数值约束 | 目标帧率 | 直接传 `e.frameRate`；第一次重试可能降到 10 或 5 |

profile 中的 `bitrate` 不会进入 `getUserMedia()`；它后续进入 `RTCRtpSender.setParameters()` 或 SDP。镜像、旋转和填充也不属于采集约束。

### 16.6 重试时浏览器实际收到什么

采集包装器最多重试 3 次，间隔 500 ms，只对 `NotReadableError`、`OverconstrainedError`、`AbortError` 放宽：

| 尝试 | SDK 标志变化 | 浏览器约束变化 |
|---:|---|---|
| 初始 | `useExactDeviceId` 通常为真，`maxResolution` 为真 | 精确 deviceId；宽高 `ideal + max` |
| 第 1 次重试 | `maxResolution=false`；帧率可能降至 10/5；`useExactDeviceId=false` | 去掉 width/height.max；deviceId 从 `{exact:id}` 变普通字符串 |
| 第 2 次重试 | `useDeviceIdOnly=true` | 只保留 deviceId，去掉尺寸和 3A 等附加约束 |
| 第 3 次重试 | `useTrueAsConstraint=true` | 对请求类型最终传 `true`，让浏览器选默认设备 |

`NotAllowedError`、`SecurityError`、无设备等不进入这条放宽链，而是保留 name、message 和 `constraint` 包装为 SDK 初始化错误。

### 16.7 `getDisplayMedia(options)`

MDN：[getDisplayMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)

源码 L26979—L27004 传入的顶层对象是：

```js
const options = {
  preferCurrentTab   : e.preferDisplaySurface === 'current-tab' || Boolean(e.captureElement),
  systemAudio        : 'include',
  selfBrowserSurface : 'include',
  surfaceSwitching   : 'include',
  video: {
    width          : isSafari ? { max: e.width } : { ideal: e.width, max: e.width },
    height         : isSafari ? { max: e.height } : { ideal: e.height, max: e.height },
    frameRate      : e.frameRate,
    displaySurface : e.preferDisplaySurface || 'monitor'
  }
};

if (e.systemAudio) {
  options.audio = {
    echoCancellation: e.echoCancellation ?? true,
    noiseSuppression: e.noiseSuppression ?? false,
    autoGainControl: e.autoGainControl ?? false,
    sampleRate: 48000
  };
}
```

顶层参数逐项解释：

| 字段 | 类型/可选值 | 含义 | 本项目传值 |
|---|---|---|---|
| `video` | 必须是 truthy 或约束对象，不能是 `false` | 请求被共享的画面 | 始终传对象 |
| `audio` | boolean 或音频约束，可省略 | 请求与共享表面关联的音频 | 仅 `e.systemAudio` 为真时加入对象 |
| `preferCurrentTab` | boolean，实验性提示 | 是否把当前标签页作为醒目选择 | 选择 current-tab 或启用元素裁剪时为 `true` |
| `systemAudio` | `'include'` / `'exclude'`，提示项 | 是否向用户提供系统音频选项 | 顶层固定传 `'include'`；但只有 `options.audio` 存在时才真正请求音频 Track |
| `selfBrowserSurface` | `'include'` / `'exclude'`，提示项 | 是否允许选择当前页面 | 固定 `'include'` |
| `surfaceSwitching` | `'include'` / `'exclude'`，提示项 | 是否允许浏览器提供共享表面切换控件 | 固定 `'include'` |
| `monitorTypeSurfaces` | `'include'` / `'exclude'`，实验性 | 是否在选择器中提供整屏 | 未传 |
| `controller` | `CaptureController`，实验性 | 允许额外控制捕获会话 | 未传 |

`video` 子字段：

| 字段 | 含义 | 本项目来源 |
|---|---|---|
| `displaySurface` | 希望的表面类型，常见 `monitor`、`window`、`browser` | `e.preferDisplaySurface`，无值时 `'monitor'`；这是提示，用户仍必须在选择器确认 |
| `width` | 希望的输出宽度 | Safari 只传 `{max}`，其他浏览器传 `{ideal,max}` |
| `height` | 希望的输出高度 | Safari 只传 `{max}`，其他浏览器传 `{ideal,max}` |
| `frameRate` | 希望的帧率 | 直接传 `e.frameRate` |

浏览器必须每次弹出用户选择；这些选项不能替用户静默固定某个屏幕。

### 16.8 屏幕采集后的 `applyConstraints(constraints)`

MDN：[applyConstraints()](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/applyConstraints)

屏幕视频 Track 取得后，源码还会再传一次：

```js
await screenVideoTrack.applyConstraints({
  frameRate: { min: e.frameRate, ideal: e.frameRate },
  width: e.width,
  height: e.height
});
```

这与 `getDisplayMedia(options)` 不是重复：前者先决定用户共享哪个表面，后者对已经得到的 Track 请求输出规格。这里 `frameRate.min` 是强制下限，可能导致 `OverconstrainedError`；所以源码用 `try/catch` 记录 warning 并继续使用已获得的屏幕 Track。

摄像头 `applyProfile()` 则传普通 `{width,height,frameRate}`；音频 `update3A()` 先取 `track.getConstraints()`，修改三个 3A 字段后把完整对象传回。Chrome 分支更倾向重新采集，Firefox/Safari 才直接 apply。

### 16.9 `getSupportedConstraints()`、`getCapabilities()`、`getSettings()`

MDN：[getSupportedConstraints()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getSupportedConstraints)、[getCapabilities()](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getCapabilities)、[getSettings()](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings)

三个方法都没有参数，但回答的问题不同：

| API | 返回 | 回答的问题 | 本项目用途 |
|---|---|---|---|
| `mediaDevices.getSupportedConstraints()` | 支持字段名的布尔字典 | 浏览器识不识别某类约束字段 | Adapter 判断 `facingMode`、`autoGainControl` 等是否需要转换 |
| `track.getCapabilities()` | 当前 Track 可调范围/枚举值 | 这个具体设备最多能做到什么 | 采集成功后记录 width/height/frameRate、3A 等能力，并校验 echoCancellation 请求值 |
| `track.getSettings()` | 当前实际采用值 | 浏览器最后真正给了什么 | 更新 deviceId、宽高、帧率、声道数、首帧尺寸和上报 |

它们都不会修改 Track。不能用 capabilities 当成实际值，也不能用 supportedConstraints 推断当前摄像头一定支持某个分辨率。

### 16.10 区域裁剪参数

MDN：[CropTarget.fromElement()](https://developer.mozilla.org/en-US/docs/Web/API/CropTarget/fromElement)、[BrowserCaptureMediaStreamTrack.cropTo()](https://developer.mozilla.org/en-US/docs/Web/API/BrowserCaptureMediaStreamTrack/cropTo)

当公开配置带 `captureElement` 时，源码先验证窗口存在 `CropTarget`、静态方法 `fromElement` 和 Track 的 `cropTo`，再执行：

```js
const target = await CropTarget.fromElement(e.captureElement);
await screenVideoTrack.cropTo(target);
```

`fromElement(element)` 的唯一参数是要生成裁剪目标的 DOM Element；`cropTo(target)` 的唯一参数是返回的 `CropTarget`，传 `null` 通常表示恢复不裁剪，但本项目没有使用 `null` 分支。源码还检查 capture handle，只有句柄匹配 SDK 预期值才裁剪。

## 17. 事实与边界

### 可以直接确认

- 摄像头/麦克风和屏幕使用不同采集入口。
- 约束会按错误和支持性降级。
- 采集后使用 settings 确认实际规格。
- 屏幕系统音频与额外麦克风是不同来源。
- 自定义 Track 可以跳过原生采集。

### 仅凭当前 JS 不能确认

- 每个目标浏览器/操作系统组合的屏幕音频选择器行为。
- 私有浏览器约束在所有内核版本中的真实效果。
- 用户实际授权选择了哪个窗口或标签页，除非浏览器通过 settings/Capture Handle 暴露。
