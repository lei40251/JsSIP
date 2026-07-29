# 2. 快速完成第一通电话

[← 上一章：SIP 与 WebRTC 基础](./01-sip-webrtc-basics.md) · [学习目录](./README.md) · [下一章：通话流程与事件时序 →](./03-call-lifecycle.md)

本章完成一个最小但完整的单通话页面，包括注册、呼出、来电、接听、远端视频、失败处理和挂断。

## 2.1 引入 SDK

```html
<script src="./adapter-latest.js"></script>
<script src="./CRTC.min.js"></script>
```

`adapter-latest.js` 用于浏览器 WebRTC 兼容，`CRTC.min.js` 是页面需要引入的 SDK 文件。实际路径以交付包的目录结构为准。

## 2.2 准备页面元素

```html
<p id="status">尚未启动</p>
<video id="remoteVid" autoplay playsinline></video>

<input id="target" value="sip:bob@example.com">
<button id="callButton" disabled>音视频呼叫</button>
<button id="answerButton" disabled>接听</button>
<button id="hangupButton" disabled>挂断</button>
```

按钮初始禁用，注册成功后开放呼叫，收到来电后开放接听。这样可以避免用户在错误时机调用 SDK。

## 2.3 创建 UA

```js
const socket = new CRTC.WebSocketInterface('wss://sip.example.com/wss');

const ua = new CRTC.UA({
  sockets    : socket,
  uri        : 'sip:alice@example.com',
  password   : 'alice-password',
  secret_key : 'SDK 授权码'
});
```

| 配置 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | ---: | --- |
| `sockets` | `WebSocketInterface` 或数组 | 是 | 无 | WSS 信令连接对象 |
| `uri` | `string` | 是 | 无 | 当前登录用户的完整 SIP URI |
| `password` | `string` | 视鉴权 | `null` | 当前 SIP 账号的注册密码 |
| `secret_key` | `string` | 是 | 无 | SDK 授权码 |
| `display_name` | `string` | 否 | `null` | 来电显示名称 |
| `register` | `boolean` | 否 | `true` | 是否在连接成功后自动注册 |
| `register_expires` | 正整数 | 否 | `600` 秒 | 注册有效期 |

生产环境不要把账号密码和授权码直接写入前端代码或提交到版本管理系统。

Base JS Demo 把环境配置和账号参数组合成 `configuration`，再只创建一个 UA。以下节选自 [`app.js`](../../demo/base-js/js/app.js)：

```js
const account = getQuery('caller');
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

这里的密码规则和较短注册周期是 Demo 环境行为，客户项目应使用服务方交付的真实配置。

## 2.4 配置 WebRTC 网络

```js
const pcConfig = {
  iceServers : [
    {
      urls       : 'turn:turn.example.com:3478',
      username   : 'turn-user',
      credential : 'turn-password'
    }
  ]
};
```

如果服务端要求媒体必须经过 TURN，可以同时配置 `iceTransportPolicy: 'relay'`。不要在不了解部署要求时默认强制 relay。

`RTCConfiguration` 常用字段：

| 字段 | 类型/可选值 | 说明 |
| --- | --- | --- |
| `iceServers` | `RTCIceServer[]` | STUN/TURN 列表；TURN 通常需要用户名和凭据 |
| `iceTransportPolicy` | `all` / `relay` | `all` 允许直连和中继；`relay` 只使用 TURN |
| `iceCandidatePoolSize` | 非负整数 | 预收集 ICE 候选数量 |
| `bundlePolicy` | `balanced` / `max-compat` / `max-bundle` | 多媒体传输复用策略；按服务兼容要求选择 |
| `rtcpMuxPolicy` | `require` / `negotiate` | RTCP 复用策略；Demo 接听使用 `negotiate` 兼容配置 |

## 2.5 媒体约束怎么填写

音频和视频都可以传 `true`、`false` 或约束对象：

```js
const mediaConstraints = {
  audio : {
    deviceId    : { exact: selectedMicrophoneId },
    sampleRate  : 48000,
    channelCount: 1
  },
  video : {
    deviceId   : { exact: selectedCameraId },
    facingMode : 'user',
    width      : { ideal: 1280 },
    height     : { ideal: 720 },
    frameRate  : { ideal: 15, max: 30 }
  }
};
```

| 写法 | 含义 |
| --- | --- |
| `audio: true` | 使用默认麦克风 |
| `audio: false` | 不采集本地音频 |
| `video: true` | 使用默认摄像头 |
| `video: false` | 不采集本地视频 |
| `deviceId: { exact: id }` | 必须使用指定设备；设备不存在会采集失败 |
| `deviceId: { ideal: id }` | 尽量使用指定设备，失败时允许浏览器回退 |
| `facingMode: 'user'` | 前置摄像头 |
| `facingMode: 'environment'` | 后置摄像头 |
| `width/height/frameRate: number` | 直接约束目标值 |
| `{ ideal, min, max, exact }` | 使用 WebRTC 约束范围；`exact` 最严格 |

第一版接入建议先使用 Demo 的 `640×480@15fps`，基础通话稳定后再提高分辨率和帧率。约束越严格，设备不支持时越容易产生 `OverconstrainedError`。

Demo 将设备选择收敛成两个构造函数，呼出、接听和视频升级都复用它们。代码取自 [`app-sdk-helper.js`](../../demo/base-js/js/app-sdk-helper.js)：

```js
function getAudioOpts()
{
  const constraints = {
    sampleRate   : 48000,
    channelCount : 1
  };

  if (selectMic)
  {
    constraints.deviceId = { exact: selectMic };
  }

  return constraints;
}

function getVideoOpts()
{
  const constraints = Object.assign({}, videoConstraints);

  if (selectCamera)
  {
    constraints.deviceId = { exact: selectCamera };
  }

  return constraints;
}
```

将选择的 deviceId 集中写入约束，可以避免呼出用选中设备、接听却回到默认设备。

## 2.6 完整页面代码

替换 WSS、账号、密码、授权码、TURN 和被叫地址后，可将以下内容作为接入骨架：

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>CRTC 第一通电话</title>
</head>
<body>
  <p id="status">尚未启动</p>
  <video id="remoteVid" autoplay playsinline></video>

  <input id="target" value="sip:bob@example.com">
  <button id="callButton" disabled>音视频呼叫</button>
  <button id="answerButton" disabled>接听</button>
  <button id="hangupButton" disabled>挂断</button>

  <script src="./adapter-latest.js"></script>
  <script src="./CRTC.min.js"></script>
  <script>
    const statusElement = document.getElementById('status');
    const remoteVid = document.getElementById('remoteVid');
    const targetInput = document.getElementById('target');
    const callButton = document.getElementById('callButton');
    const answerButton = document.getElementById('answerButton');
    const hangupButton = document.getElementById('hangupButton');

    const socket = new CRTC.WebSocketInterface('wss://sip.example.com/wss');
    const ua = new CRTC.UA({
      sockets    : socket,
      uri        : 'sip:alice@example.com',
      password   : 'alice-password',
      secret_key : 'SDK 授权码'
    });

    const pcConfig = {
      iceServers : [
        {
          urls       : 'turn:turn.example.com:3478',
          username   : 'turn-user',
          credential : 'turn-password'
        }
      ]
    };

    let currentSession = null;

    function setStatus(text)
    {
      statusElement.textContent = text;
    }

    function buildCallOptions()
    {
      return {
        pcConfig,
        mediaConstraints : {
          audio : true,
          video : {
            width     : { ideal: 1280 },
            height    : { ideal: 720 },
            frameRate : { ideal: 15 }
          }
        }
      };
    }

    const boundPeerConnections = new WeakSet();

    function bindRemoteMedia(session)
    {
      const peerConnection = session.connection;

      if (!peerConnection || boundPeerConnections.has(peerConnection))
      {
        return;
      }

      boundPeerConnections.add(peerConnection);

      peerConnection.addEventListener('track', function(event)
      {
        const stream = event.streams[0];

        if (stream)
        {
          remoteVid.srcObject = stream;
          remoteVid.play().catch(function(error)
          {
            console.warn('远端视频自动播放失败：', error);
          });
        }
      });
    }

    function clearSession(session)
    {
      if (currentSession === session)
      {
        currentSession = null;
      }

      remoteVid.srcObject = null;
      answerButton.disabled = true;
      hangupButton.disabled = true;
      callButton.disabled = !ua.isRegistered();
    }

    ua.on('connected', function()
    {
      setStatus('WSS 已连接，正在注册');
    });

    ua.on('registered', function()
    {
      setStatus('SIP 注册成功');
      callButton.disabled = false;
    });

    ua.on('registrationFailed', function(event)
    {
      setStatus('SIP 注册失败');
      console.error(event);
    });

    ua.on('disconnected', function()
    {
      setStatus('WSS 已断开');
      callButton.disabled = true;
    });

    ua.on('newRTCSession', function(data)
    {
      const session = data.session;

      // 最小示例只允许一通电话。
      if (currentSession && currentSession !== session)
      {
        session.terminate({ status_code: 486 });
        return;
      }

      currentSession = session;
      bindRemoteMedia(session);
      callButton.disabled = true;
      hangupButton.disabled = false;

      if (data.originator === 'remote')
      {
        setStatus('收到来电');
        answerButton.disabled = false;
      }
      else
      {
        setStatus('正在呼叫');
      }

      session.on('progress', function()
      {
        setStatus('呼叫振铃中');
      });

      session.on('confirmed', function()
      {
        setStatus('通话已建立');
        answerButton.disabled = true;
      });

      session.on('failed', function(event)
      {
        console.warn('通话失败：', event.cause);
        setStatus('通话失败：' + event.cause);
        clearSession(session);
      });

      session.on('ended', function(event)
      {
        console.log('通话结束：', event.cause);
        setStatus('通话已结束');
        clearSession(session);
      });
    });

    callButton.addEventListener('click', function()
    {
      const target = targetInput.value.trim();

      if (!target || currentSession)
      {
        return;
      }

      ua.call(target, buildCallOptions())
        .catch(function(error)
        {
          console.error('发起呼叫失败：', error);
          setStatus('发起呼叫失败');
          callButton.disabled = !ua.isRegistered();
        });
    });

    answerButton.addEventListener('click', function()
    {
      if (currentSession && currentSession.direction === 'incoming')
      {
        currentSession.answer(buildCallOptions());
        // 接听后再绑定本次通话的远端媒体。
        bindRemoteMedia(currentSession);
        answerButton.disabled = true;
      }
    });

    hangupButton.addEventListener('click', function()
    {
      currentSession && currentSession.terminate();
    });

    ua.start();
  </script>
</body>
</html>
```

## 2.7 代码运行顺序

完整示例的执行顺序如下：

1. 创建 DOM 引用、WSS、UA 和 `pcConfig`。
2. 在 `ua.start()` 前绑定 UA 事件，避免漏掉快速返回的连接/注册事件。
3. `connected` 时只显示“正在注册”。
4. `registered` 时开放呼叫按钮。
5. 每次 `newRTCSession` 保存当前 session，并立即绑定本通电话事件。
6. 呼出时调用 `ua.call()`，通过 Promise 和会话事件处理后续状态。
7. 呼入时由用户操作触发 `answer()`，并继续监听本通电话的事件。
8. `connection.ontrack` 播放远端流。
9. `failed` 或 `ended` 统一清理页面。

不要把事件绑定放到 `confirmed` 后：拒接、超时、早期媒体和建立前失败都会在 confirmed 之前发生。

Base JS Demo 的标准呼出也遵循同一顺序。以下是 [`app.js`](../../demo/base-js/js/app.js) 中 `call(type, direction, mediaStream)` 的核心节选：

```js
if (!ua.isRegistered())
{
  setStatus('请注册成功后呼叫');

  return;
}

options = {
  extraHeaders  : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}`, `X-Direction: ${direction || 'sendrecv'}` ],
  extraFeatures : extraFeatures,
  pcConfig      : pcConfig,
  eventHandlers : {
    mediaEffectsIssue : onFxIssue
  }
};

options['mediaConstraints'] = {
  audio : getAudioOpts(),
  video : (type === 'video' || type === 'onlyVideo') ? getVideoOpts() : false
};

options.mediaEffectsComposer = getFxOpts();
options.aiNoiseSuppression = getNsOpts();

const session = await ua.call(`${number}@${sipDomain}`, options);
```

这是 Demo 的通用函数节选，因此包含随路头和媒体效果。最小接入可只保留 `pcConfig`、`mediaConstraints` 和 `ua.call()`。

标准视频接听的参数与呼出保持一致，以下代码同样取自 [`app.js`](../../demo/base-js/js/app.js)：

```js
document.querySelector('#answerVideo').onclick = function()
{
  e.session.answer({
    mediaConstraints : {
      audio : getAudioOpts(),
      video : getVideoOpts()
    },
    pcConfig             : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
    extraHeaders         : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
    rtcOfferConstraints  : { offerToReceiveAudio: true, offerToReceiveVideo: true },
    extraFeatures        : extraFeatures,
    mediaEffectsComposer : getFxOpts(),
    aiNoiseSuppression   : getNsOpts()
  });

  setStatus('video answer');
};
```

呼出和接听都调用 `getAudioOpts() / getVideoOpts()`、`getFxOpts()` 和 `getNsOpts()`，这正是两条路径保持一致的关键。

## 2.8 自动注册和手动注册

示例默认自动注册。手动注册写法：

```js
const ua = new CRTC.UA({
  sockets    : socket,
  uri        : 'sip:alice@example.com',
  password   : 'alice-password',
  secret_key : 'SDK 授权码',
  register   : false
});

ua.on('connected', function()
{
  ua.register();
});
```

两种方式都必须等 `registered` 后呼叫。详细时序见第 3 章。

## 2.9 呼叫 options 最小字段表

| 字段 | 类型 | 什么时候需要 |
| --- | --- | --- |
| `pcConfig` | `RTCConfiguration` | 需要 TURN 或特定 PC 策略时 |
| `mediaConstraints` | `MediaStreamConstraints` | 让浏览器采集音视频时 |
| `mediaStream` | `MediaStream` | 使用业务已创建的自定义流时 |
| `extraHeaders` | `string[]` | 服务端要求随路数据时 |
| `rtcOfferConstraints` | `RTCOfferOptions` | 需要明确接收音频/视频方向时 |
| `aiNoiseSuppression` | `object` | 开启 AiNS 时 |
| `mediaEffectsComposer` | `object` | 开启虚拟背景、混流、镜像或水印时 |

`mediaStream` 与 `mediaConstraints` 不要随意同时传。使用自定义流时先检查所需音频/视频 tracks 是否存在且 `readyState === 'live'`。

## 2.10 UI 状态建议

| SDK 状态/事件 | 呼叫 | 接听 | 挂断 | 页面文字 |
| --- | --- | --- | --- | --- |
| 未注册 | 禁用 | 禁用 | 禁用 | 正在连接/注册 |
| `registered` | 开放 | 禁用 | 禁用 | 注册成功 |
| 呼出中 | 禁用 | 禁用 | 开放 | 正在呼叫 |
| 呼入中 | 禁用 | 开放 | 开放 | 收到来电 |
| `progress` | 禁用 | 视方向 | 开放 | 振铃/回铃 |
| `confirmed` | 禁用 | 禁用 | 开放 | 通话中 |
| `failed/ended` | 按注册状态恢复 | 禁用 | 禁用 | 失败原因/已结束 |

## 2.11 验证顺序

1. 通过 HTTPS 或 localhost 打开页面。
2. 控制台出现 WSS 连接和注册成功信息。
3. 使用账号 A 呼叫账号 B，确认 B 页面出现来电。
4. B 点击接听，双方允许摄像头和麦克风权限。
5. 确认远端视频出现，双方可以听到声音。
6. 任一方点击挂断，双方页面都回到可呼叫状态。

## 2.12 常见失败

| 现象 | 优先检查 |
| --- | --- |
| WSS 连接失败 | 地址、证书、反向代理和网络访问 |
| 注册失败 | SIP URI、密码、授权码和账号状态 |
| 摄像头/麦克风失败 | HTTPS、浏览器权限、设备占用和约束 |
| 可以振铃但没有媒体 | TURN、ICE、防火墙和对端媒体权限 |
| 来电时 `session.connection` 为空 | 呼入尚未接听；调用 `answer()` 后再绑定 `session.connection` |
| 视频存在但不自动播放 | 捕获 `video.play()` 失败并提供用户点击播放入口 |

## 2.13 第一通电话完成检查

- `connected` 和 `registered` 含义没有混用。
- 呼叫前检查 `ua.isRegistered()`。
- 呼入和呼出都经过 `newRTCSession`，每通电话都重新绑定事件。
- `ua.call()` 的 Promise 有 reject 处理。
- `answer()` 只对当前呼入 session 调用。
- `connection.ontrack` 能处理后续新增轨道，不只在 confirmed 时取一次流。
- `failed` 和 `ended` 都清除 `srcObject`、当前 session 和按钮状态。
- 页面关闭或退出账号时调用 `ua.stop()`。

[← 上一章：SIP 与 WebRTC 基础](./01-sip-webrtc-basics.md) · [下一章：通话流程与事件时序 →](./03-call-lifecycle.md)
