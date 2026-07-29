# 1. SIP 与 WebRTC 基础

[学习目录](./README.md) · [下一章：快速完成第一通电话 →](./02-quick-start.md)

本章只解释接入 SDK 必须掌握的概念。你不需要先学习 SIP 报文格式、SDP 语法或 WebRTC 底层协议。

## 1.1 信令和媒体是两条链路

一次浏览器音视频通话同时存在两类连接：

| 链路 | 负责内容 | 常见配置 |
| --- | --- | --- |
| SIP 信令 | 注册、呼叫、振铃、接听、拒接、挂断 | WSS 地址、SIP 账号、密码 |
| WebRTC 媒体 | 摄像头、麦克风、音视频协商和传输 | 媒体约束、STUN/TURN |

能注册成功，只说明 SIP 信令可用，不代表音视频一定能连通。能收到来电但双方没有声音或画面时，应继续检查浏览器权限、媒体约束、ICE 和 TURN。

## 1.2 SDK 中的核心对象

| 对象 | 生命周期 | 前端职责 |
| --- | --- | --- |
| `CRTC.UA` | 页面或应用级，通常只创建一个 | 连接 WSS、注册 SIP、发起呼叫、接收新会话 |
| `CRTC.RTCSession` | 一通电话一个实例 | 接听、挂断、监听通话事件、控制媒体能力和读取统计 |
| `RTCPeerConnection` | 属于某个会话 | 承载 WebRTC 协商、ICE 状态和远端轨道 |
| `MediaStream` | 一组音频/视频轨道 | 绑定 `<video>`、作为混流输入或自定义发送流 |
| `MediaStreamTrack` | 单条音频或视频轨道 | 静音、换设备、检查轨道状态 |

关系可以简单理解为：

```text
一个页面
└─ 一个 CRTC.UA
   ├─ RTCSession（第一通电话）
   │  └─ RTCPeerConnection
   └─ RTCSession（第二通电话）
      └─ RTCPeerConnection
```

示例页面如果只允许一通电话，可以用 `currentSession` 保存当前会话。需要并发通话时，应使用 `Map<session.id, session>` 管理，不能让后一通覆盖前一通。

Base JS Demo 在 UA 的 `newRTCSession` 中保存当前会话。下面是 [`app.js`](../../demo/base-js/js/app.js) 的会话入口节选：

```js
ua.on('newRTCSession', function(e)
{
  if (tmpSession)
  {
    e.session.terminate({ status_code: 486 });
  }
  else if (!rtcSession)
  {
    rtcSession = e.session;
  }
  else
  {
    tmpSession = e.session;
  }
});
```

Demo 为呼转保留了 `tmpSession`，普通单通话页面可以简化为只保留一个 `rtcSession`。关键是只保存 `e.session`，不要自行构造 `RTCSession`。

## 1.3 常见名词

### WSS

浏览器通过安全 WebSocket 连接 SIP 信令服务。WSS 连接成功后，UA 才能继续注册。

### SIP URI

SIP 用户身份通常写成：

```text
sip:alice@example.com
```

`alice` 是账号，`example.com` 是 SIP 域。被叫目标也建议在首次联调时使用完整 SIP URI。

### SDP

SDP 描述本次通话希望发送和接收的媒体，例如是否有音频、视频，以及支持哪些编解码器。普通接入不需要业务自己修改 SDP。

### ICE、STUN 和 TURN

- ICE：WebRTC 寻找双方可用网络路径的过程。
- STUN：帮助浏览器发现公网映射地址。
- TURN：双方无法直连时中继媒体，企业网络、跨运营商或严格防火墙环境尤其重要。

WSS 地址、SIP 域和 TURN 地址用途不同，不一定使用同一个域名。

## 1.4 浏览器安全要求

- 摄像头和麦克风通常只能在 HTTPS 或 localhost 页面使用。
- 首次调用媒体采集时浏览器会请求权限。
- 图片背景、AiNS 和虚拟背景资源跨域部署时，资源服务器必须允许页面域名访问。
- 页面自动播放远端音频可能受浏览器策略限制，建议由用户点击按钮触发呼叫或接听，并处理 `video.play()` 的 Promise。

## 1.5 一通电话的最小心智模型

```text
创建 UA
→ 启动并注册
→ ua.call() 呼出，或 newRTCSession 收到呼入
→ 得到 RTCSession
→ 呼入调用 session.answer()
→ 绑定 RTCPeerConnection 的 track 事件播放远端流
→ confirmed 表示通话建立
→ session.terminate() 挂断
→ ended 或 failed 后清理页面状态
```

## 1.6 SIP 注册到底完成了什么

浏览器不是打开 WSS 就可以呼叫。完整过程是：

```text
建立 WSS
→ connected
→ 发送 SIP REGISTER
→ 服务端鉴权
→ 200 OK
→ registered
```

| 状态 | 能说明什么 | 不能说明什么 |
| --- | --- | --- |
| `connected` | 浏览器与 WSS 信令服务已连接 | SIP 账号不一定已注册，不能直接呼叫 |
| `registered` | SIP 账号注册成功，服务端可路由呼入 | TURN 和媒体仍可能不可用 |
| `registrationFailed` | 注册被拒绝、鉴权失败或超时 | 不一定是 WSS 故障 |
| `disconnected` | WSS 已断开 | 浏览器网络接口是否离线需结合 offline 事件 |

自动注册是 `register: true`，`ua.start()` 连接后自动发送 REGISTER。SDK 也支持配置 `register: false` 后主动调用 `ua.register()`；Base JS Demo 选择运行模式后固定使用自动注册。两种方式的最终成功标志都相同：`registered`。

Demo 不在 `connected` 事件中直接开放呼叫，而是分别记录连接和注册结果。以下代码取自 [`app.js`](../../demo/base-js/js/app.js)：

```js
ua.on('connected', function()
{
  setStatus('信令连接成功');
});

ua.on('registered', function(data)
{
  setStatus(`注册成功：${data.response.from.uri.toString()}`);
});

ua.on('registrationFailed', function(data)
{
  setStatus(`注册失败${data.cause}`);
});
```

## 1.7 一次 SIP 呼叫中会看到哪些阶段

最常见的呼出信令：

```text
INVITE
← 100 Trying
← 180 Ringing 或 183 Session Progress
← 200 OK
ACK →
……通话……
BYE → / ← BYE
```

对应 SDK 事件：

| SIP 阶段 | SDK 事件 | 页面含义 |
| --- | --- | --- |
| 发送/接收 INVITE | `newRTCSession` | 创建本通电话对象并绑定事件 |
| 100 Trying | `trying` | 服务正在处理呼叫 |
| 180/183 | `progress` | 振铃、回铃或早期媒体 |
| 200 OK | `accepted` | 对方已接受，正在完成确认 |
| ACK | `confirmed` | 会话已正式建立 |
| 建立前失败 | `failed` | 拒接、取消、超时、协商失败 |
| 建立后 BYE | `ended` | 通话结束 |

`accepted` 和 `confirmed` 不应当作同一个事件。业务通常在 `accepted` 显示“正在建立”，在 `confirmed` 切换到“通话中”。

### 180 和 183 的区别

- 180 通常表示远端正在振铃，本端可以播放本地回铃音。
- 183 可能携带 SDP 和早期媒体，例如网络侧提供的真实回铃音或提示音。

如果 `session.connection.ontrack` 在 confirmed 前收到远端音频，页面应优先播放这路早期媒体，避免本地回铃音和远端提示音同时播放。

## 1.8 呼入和呼出为什么时序不同

呼出：页面调用 `ua.call()` 后可能触发浏览器媒体授权，因此 Promise 可能因权限、设备或媒体约束问题而 reject。

呼入：收到 `newRTCSession` 时用户尚未接听，不应假设本地媒体或 `session.connection` 已经可用。调用 `session.answer(options)` 后再按接听流程使用媒体连接。

这决定了两条规则：

1. 呼入页面不要在收到来电时就假设 `session.connection` 可用。
2. 呼叫/接听参数必须共用同一构造逻辑，否则呼出有 AiNS/虚拟背景，呼入接听却没有。

## 1.9 SDP Offer/Answer 与媒体方向

SDP 是双方对音频、视频、编解码器和网络参数的描述。常见方向：

| 方向 | 含义 |
| --- | --- |
| `sendrecv` | 发送并接收 |
| `sendonly` | 只发送 |
| `recvonly` | 只接收 |
| `inactive` | 暂不发送也不接收 |

页面调用 `mute()` 只改变本地轨道发送状态，不一定等同于修改 SDP 方向。`hold()`、音视频升级/降级、共享或某些设备操作可能触发重新协商。

普通接入不要直接修改 SDP。确有互通要求时，应先与 SDK 服务方确认受支持的配置或兼容方案。

## 1.10 ICE 建连的实际过程

```text
收集本地 candidate
→ 通过 SDP 交换候选和凭据
→ ICE checking
→ 选择可用 candidate pair
→ connected/completed
→ DTLS connected
→ SRTP 音视频传输
```

常见候选类型：

| 类型 | 来源 | 特点 |
| --- | --- | --- |
| `host` | 本机网络接口 | 局域网直连候选；可能使用 mDNS 隐藏地址 |
| `srflx` | STUN | NAT 映射的公网候选 |
| `relay` | TURN | 媒体经 TURN 中继，穿透成功率高但增加带宽和时延 |

`iceTransportPolicy: 'all'` 允许浏览器尝试 host/srflx/relay；`relay` 只允许 TURN。企业网、对称 NAT 或严格防火墙中，TURN 往往是媒体可用的关键。

Base JS Demo 将交付环境的 ICE 参数写入同一个 `pcConfig`，再同时用于呼出和接听：

```js
const pcConfig = {};

iceServers && (pcConfig['iceServers'] = iceServers);
iceTransportPolicy && (pcConfig['iceTransportPolicy'] = iceTransportPolicy);
pcConfig['iceCandidatePoolSize'] = 4;
pcConfig['bundlePolicy'] = 'max-compat';
```

这段代码取自 [`app.js`](../../demo/base-js/js/app.js)。`iceServers`、`iceTransportPolicy` 应来自当前部署环境，不要复制其他环境的 TURN 凭据。

### ICE 状态含义

| 状态 | 含义 | 页面建议 |
| --- | --- | --- |
| `new` | 尚未开始或刚创建 | 显示正在准备 |
| `checking` | 正在检查候选对 | 显示正在连接媒体 |
| `connected` | 已找到可用路径 | 允许继续等待更优路径 |
| `completed` | ICE 检查基本完成 | 正常稳定状态 |
| `disconnected` | 暂时失去连通 | 先观察恢复，不立即挂断 |
| `failed` | 无可用路径 | 检查 TURN、网络和防火墙 |
| `closed` | PC 已关闭 | 挂断后正常；通话中出现则异常 |

## 1.11 MediaStream 与 Track 生命周期

一个 `MediaStream` 可以包含多条 track：

```js
const stream = await navigator.mediaDevices.getUserMedia({
  audio : true,
  video : true
});

console.log(stream.getAudioTracks());
console.log(stream.getVideoTracks());
```

Track 的常见属性：

| 属性 | 常见值 | 含义 |
| --- | --- | --- |
| `kind` | `audio` / `video` | 媒体类型 |
| `enabled` | `true` / `false` | 是否输出有效媒体，常用于静音 |
| `muted` | `true` / `false` | track 是否暂时无法提供数据 |
| `readyState` | `live` / `ended` | 是否仍可用 |
| `label` | 设备名称 | 用户授权后通常可见 |

`track.stop()` 是永久停止该 track，不能通过 `enabled = true` 恢复。切换设备、挂断和页面销毁时要区分：

- SDK 管理的通话 track 由会话流程处理。
- 页面自行创建的预览、屏幕流、占位流必须由页面停止。
- 不要提前停止一个仍被当前通话使用的自定义 track。

Demo 在页面自己创建的媒体流失败或结束时显式停止 tracks。以下是 [`app.js`](../../demo/base-js/js/app.js) 中的清理方式：

```js
cusMediaStream.getTracks().forEach((track) => track.stop());
cusMediaStream = new MediaStream();
```

这个规则适用于页面自行采集的屏幕流、自定义流和预览流；会话内部管理的流仍交给 SDK 会话生命周期。

## 1.12 本地预览和实际发送不是同一件事

`localVideo.srcObject = stream` 只是把某个流显示在页面，不代表该流一定已经发送。实际发送取决于当前会话配置、媒体方向和 track 状态。

Demo 通过 [`app-sdk-helper.js`](../../demo/base-js/js/app-sdk-helper.js) 从 PeerConnection 读取 SDK 正在使用的流，再绑定到页面元素：

```js
const localStream = CRTC.Utils.getStreams(pc, 'local');
const remoteStream = CRTC.Utils.getStreams(pc, 'remote');

setMedia(remoteAudio, remoteStream.audioStream);
setMedia(remoteVideo, remoteStream.mediaStream);

Promise.all([ localVideo.play(), remoteAudio.play(), remoteVideo.play() ])
  .then(() => { })
  .catch(() => { });
```

`srcObject` 用于展示，`CRTC.Utils.getStreams()` 反映的才是当前 PeerConnection 的本地/远端媒体。

类似地，CSS：

```css
video { transform: scaleX(-1); }
```

只镜像本地看到的元素，不会改变远端收到的画面。composer 的 `setMirror(true)` 改变的是实际合成输出，两者不要混用。

## 1.13 媒体权限和设备错误

| 错误/现象 | 常见原因 | 处理 |
| --- | --- | --- |
| `NotAllowedError` | 用户拒绝、系统权限关闭、非安全页面 | 引导用户开启权限；不要反复弹窗 |
| `NotFoundError` | 没有满足条件的设备 | 提示连接设备或使用纯音频/占位方案 |
| `NotReadableError` | 设备被占用或系统读取失败 | 关闭其他应用、重新选择设备 |
| `OverconstrainedError` | `exact/min` 约束设备不支持 | 降低分辨率/FPS或改用 `ideal` |
| 设备 label 为空 | 尚未授权媒体权限 | 先请求一次权限后重新枚举 |
| `play()` reject | 浏览器自动播放限制 | 提供“点击播放/恢复播放”按钮 |

Demo 初始化时先请求一次音视频权限，再通过 [`app-sdk-helper.js`](../../demo/base-js/js/app-sdk-helper.js) 的 `loadDevices()` 读取设备。无论预采集成功还是失败，都会尝试刷新设备列表：

```js
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(async(stream) =>
  {
    await loadDevices();
    CRTC.Utils.closeMediaStream(stream);
  })
  .catch(async(error) =>
  {
    await loadDevices();
    setStatus(`预采集失败: ${error.name || error.message}`);
  });
```

预采集成功后立即关闭临时媒体流，不会与后续通话争用设备。权限失败时设备 label 可能为空，但页面仍会展示浏览器能够枚举到的设备。

## 1.14 AiNS、虚拟背景、混流与通话的关系

| 能力 | 用途 | 接入方式 |
| --- | --- | --- |
| AiNS | 改善本地麦克风的降噪效果 | 在呼叫/接听参数中启用，从当前会话调整强度和增益 |
| 虚拟背景 | 模糊或替换本地摄像头背景 | 在媒体效果配置中启用，从当前会话切换或清除背景 |
| 混流 | 合成摄像头、屏幕、镜像和水印等内容 | 在呼叫/接听参数中配置，从当前会话更新输入和显示效果 |

效果异常时应尽量保持基础通话，不要把媒体效果异常当作 SIP 通话失败。

## 1.15 通话统计的基本方向

从当前浏览器视角：

| 方向 | 含义 | 用户现象 |
| --- | --- | --- |
| 上行 | 本端发送到远端 | 远端听到/看到本端的质量 |
| 下行 | 本端从远端接收 | 本端用户听到/看到远端的质量 |

例如“对方说我声音断断续续”优先看上行音频；“我听对方断断续续”优先看下行音频。网络质量 `0` 表示暂无有效样本，`1` 最好，`6` 表示严重异常，等级含义见第 5 章。

## 1.16 接入前信息清单

开始写代码前应拿到：

- SDK 文件和版本号。
- WSS URL。
- SIP 域。
- 两个可互呼的测试账号和鉴权方式。
- SDK 授权码。
- STUN/TURN URL、用户名、凭据和传输协议。
- 是否要求 `relay`、`max-compat`、`rtcpMuxPolicy: negotiate` 等兼容参数。
- 服务端支持的自动/手动注册、UPDATE/re-INVITE、BFCP/双流和自定义 SIP 头规则。
- AiNS 和虚拟背景静态资源部署地址。

缺少其中一项时，先明确它属于信令、媒体、授权还是效果资源，不要用另一类地址猜测替代。

## 1.17 最小排查分层

| 层次 | 成功标志 | 失败时检查 |
| --- | --- | --- |
| 页面和 SDK | `CRTC.version` 可读 | 引入路径、缓存、脚本顺序 |
| WSS | `connected` | URL、证书、代理、网络 |
| SIP 注册 | `registered` | URI、密码、realm、授权、账号状态 |
| SIP 呼叫 | `progress/accepted/confirmed` | 被叫、路由、响应码、超时 |
| 本地采集 | 有 live audio/video track | HTTPS、权限、设备、约束 |
| ICE/DTLS | connected/completed | STUN/TURN、防火墙、凭据 |
| 远端播放 | `ontrack` 且 play 成功 | SDP 方向、远端发送、自动播放 |
| 媒体效果 | 控制器非 null，效果可见 | 呼叫参数、资源、CORS、性能 |
| 通话统计 | 后续样本出现有效字段 | 媒体连接、浏览器兼容、继续等待后续结果 |

下一章会把这套流程写成一份可直接运行的完整页面，第 3 章再展开注册和通话时序。

[← 学习目录](./README.md) · [下一章：快速完成第一通电话 →](./02-quick-start.md)
