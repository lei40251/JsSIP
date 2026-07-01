# `samples/trtc.deobfuscated.js` 中所有 RTCPeerConnection 使用分析

> 分析日期: 2026-07-01  
> 源文件: `samples/trtc.deobfuscated.js` (约 1.7MB，反混淆后的 TRTC Web SDK)  
> RTCPeerConnection 引用总数: **213 处**

本文档完整梳理了文件中所有 RTCPeerConnection 相关的用法，分为四大类：

1. **浏览器兼容层 (Polyfill / Adapter)** — 修改 `RTCPeerConnection.prototype`，跨浏览器行为统一
2. **能力检测** — 用临时 RTCPeerConnection 探测编解码/API 支持
3. **核心连接类** — MPC 与 SPC 两种连接模式的完整实现
4. **业务逻辑调用** — SDK 上层如何通过 `_peerConnection` 属性操作连接

---

## 目录

- [一、浏览器兼容层 (Polyfill / Adapter)](#一浏览器兼容层-polyfill--adapter)
  - [1.1 Chrome 适配](#11-chrome-适配)
  - [1.2 Firefox 适配](#12-firefox-适配)
  - [1.3 Safari 适配](#13-safari-适配)
  - [1.4 通用适配 (Common Shim)](#14-通用适配-common-shim)
  - [1.5 RTCPeerConnection 构造函数劫持](#15-rtcpeerconnection-构造函数劫持)
- [二、能力检测 (临时连接)](#二能力检测-临时连接)
- [三、核心连接类](#三核心连接类)
  - [3.1 MPC 多连接类 (iJ)](#31-mpc-多连接类-ij)
  - [3.2 SPC 单连接类 (SignalTransport)](#32-spc-单连接类-signaltransport)
  - [3.3 MPC vs SPC 模式对比](#33-mpc-vs-spc-模式对比)
- [四、业务逻辑中的 RTCPeerConnection 使用](#四业务逻辑中的-rtcpeerconnection-使用)

---

## 一、浏览器兼容层 (Polyfill / Adapter)

文件中包含一个完整的 WebRTC Adapter 实现，对各浏览器的 RTCPeerConnection 进行原型修改（prototype patching），解决跨浏览器 API 差异。

### 架构总览

```
浏览器检测 (TC函数)
    ├── Chrome → 加载 Chrome shim (xC)
    ├── Firefox → 加载 Firefox shim (KC)
    └── Safari → 加载 Safari shim
         └── 通用 Common shim (browserShimData)
```

### 1.1 Chrome 适配

#### 1.1.1 事件监听拦截 `fC()` (行 6654-6707)

**引用位置**: 6656, 6657

拦截 `addEventListener` / `removeEventListener`，实现事件的映射转换。用于在不支持特定事件的浏览器中将底层事件映射为目标事件（例如 `addstream` → `track`）。

```js
if (!e.RTCPeerConnection) return;
const r = e.RTCPeerConnection.prototype;
const n = r.addEventListener;
r.addEventListener = function(e, r) { ... }
```

维护 `_eventMap` 映射表，使 `removeEventListener` 可以正确解绑转换后的事件处理函数。同时通过 `Object.defineProperty` 支持 `ontrack` 等属性式事件监听。

---

#### 1.1.2 ontrack 事件 + setRemoteDescription 修复 `kC()` (行 7011-7072)

**引用位置**: 7011, 7013, 7026, 7030, 7040, 7055

为不支持原生 `ontrack` 事件的旧版 Chrome 添加 `ontrack` 属性（getter/setter），并将底层 `addstream` 事件转换为 `track` 事件。

同时修复 `setRemoteDescription`：在 `addstream` 事件触发时，遍历 stream 中的 track，通过 `getReceivers` 找到对应的 receiver，构造标准的 `RTCTrackEvent` 并派发 `track` 事件。

```js
Object.defineProperty(e.RTCPeerConnection.prototype, 'ontrack', { ... });
e.RTCPeerConnection.prototype.setRemoteDescription = function() {
  this._ontrackpoly || (this._ontrackpoly = (t) => {
    t.stream.addEventListener('addtrack', ...);
    // 构造标准 track event
    const n = new Event('track');
    n.track = i.track;
    n.receiver = r;   // from getReceivers
    n.transceiver = { receiver: r };
    n.streams = [t.stream];
    this.dispatchEvent(n);
  });
  this.addEventListener('addstream', this._ontrackpoly);
  return t.apply(this, arguments);
};
```

---

#### 1.1.3 getSenders / DTMF 垫片 `DC()` (行 7079-7196)

**引用位置**: 7083, 7084, 7085, 7104, 7107, 7111, 7115, 7122, 7126, 7134, 7138, 7147, 7151, 7165, 7166, 7167, 7172, 7176

旧版 Chrome 不支持 `getSenders`/`getReceivers` API，但支持 `createDTMFSender`。通过以下方式模拟：

**场景 A** (无 getSenders 但有 createDTMFSender):
- 添加 `getSenders()` 方法，内部维护 `_senders` 数组
- 劫持 `addTrack()`：调用原方法后，将返回的 sender 加入 `_senders`
- 劫持 `removeTrack()`：同步从 `_senders` 中删除
- 劫持 `addStream()` / `removeStream()`：遍历 tracks 管理 `_senders`
- 为 sender 添加 `dtmf` 属性（通过 `createDTMFSender` 懒创建）

**场景 B** (有 getSenders 但 sender 无 dtmf 属性):
- 劫持 `getSenders()`：为每个 sender 设置 `_pc` 引用
- 通过 `Object.defineProperty` 为 `RTCRtpSender.prototype` 添加 `dtmf` getter

```js
if (!e.RTCPeerConnection.prototype.getSenders) {
  e.RTCPeerConnection.prototype.getSenders = function() {
    return (this._senders = this._senders || []), this._senders.slice();
  };
  const i = e.RTCPeerConnection.prototype.addTrack;
  e.RTCPeerConnection.prototype.addTrack = function(e, r) {
    let n = i.apply(this, arguments);
    return n || ((n = t(this, e)), this._senders.push(n)), n;
  };
}
```

---

#### 1.1.4 getStats 回调转 Promise 垫片 `wC()` (行 7202-7267)

**引用位置**: 7204, 7205, 7209

旧版 Chrome 的 `getStats()` 使用回调风格（而非 Promise）。将其包装为 Promise，并转换 `result()` API 为 Map 格式。

```js
e.RTCPeerConnection.prototype.getStats = function() {
  // 如果已是 Promise 风格，直接调用原方法
  if (t.length === 0 && (arguments.length === 0 || typeof e != 'function')) 
    return t.apply(this, []);
  // 回调转 Promise
  return new Promise((e, i) => {
    t.apply(this, [function(t) { e(o(n(t))); }, i]);
  }).then(i, r);
};
```

同时将旧版统计类型名（如 `localcandidate`）转换为新格式（`local-candidate`）。

---

#### 1.1.5 Sender/Receiver.getStats 垫片 `NC()` (行 7273-7369)

**引用位置**: 7275, 7278, 7283, 7290, 7295, 7314, 7319, 7338, 7342

为旧版 Chrome 的 `RTCRtpSender` 和 `RTCRtpReceiver` 添加 `getStats()` 方法。

- 劫持 `getSenders()` 和 `getReceivers()`，为每个实例添加 `_pc` 引用
- 劫持 `addTrack()`，为 sender 添加 `_pc` 引用
- 通过 track 事件的 `srcElement` 为 receiver 设置 `_pc`
- Sender.getStats / Receiver.getStats 通过 `_pc.getStats()` 过滤对应 track 实现
- 增强 `RTCPeerConnection.getStats(track)`，支持通过 track 参数直接查询

---

#### 1.1.6 getLocalStreams + addStream/removeStream 垫片 `OC()` (行 7376-7453)

**引用位置**: 7379, 7386, 7388, 7404, 7406, 7423, 7425, 7435, 7437

Chrome 65+ 且原生支持 addTrack 时使用。维护 `_shimmedLocalStreams` 映射表追踪 stream → track → sender 关系。

- `getLocalStreams()`：从映射表中提取 stream 列表
- `addTrack(track, stream)`：将 sender 关联到 stream
- `addStream(stream)`：调用原方法后，将新增 sender 关联到 stream
- `removeStream(stream)`：清理映射并调用原方法
- `removeTrack(sender)`：从所有关联 stream 中移除

---

#### 1.1.7 addStream/removeStream 反向流映射 + SDP 修复 `PC()` (行 7460-7650)

**引用位置**: 7462, 7463, 7464, 7468, 7475, 7479, 7498, 7520, 7530, 7563, 7588, 7590, 7594, 7616, 7618, 7629

Chrome 版本 < 65 时使用的复杂适配。使用反向流映射表解决内部流 ID 与外部的差异问题。

核心机制：
- `_streams`: 内部流 ID → 内部流对象
- `_reverseStreams`: 内部流 ID → 外部原始流对象

关键劫持：
- **addStream**: 创建内部流副本，建立双向映射
- **removeStream**: 清理双向映射
- **addTrack**: 检查 stream 是否已有副本，有则复用，无则创建新内部流
- **removeTrack**: 当 track 所属 stream 只剩一个 track 时，removeStream；否则仅 removeTrack
- **createOffer/createAnswer**: 在 SDP 中将内部流 ID 替换为外部原始流 ID
- **setLocalDescription**: 在设置 SDP 前将外部流 ID 替换为内部流 ID
- **localDescription getter**: 读取时将内部流 ID 替换为外部流 ID

---

#### 1.1.8 setLocalDescription/setRemoteDescription/addIceCandidate 参数转换 `MC()` (行 7656-7677)

**引用位置**: 7658, 7659, 7663, 7676

Chrome < 53 时，将 `setLocalDescription`/`setRemoteDescription`/`addIceCandidate` 的字符串/普通对象参数统一转为标准的 `RTCSessionDescription`/`RTCIceCandidate` 对象。

```js
!e.RTCPeerConnection && e.webkitRTCPeerConnection && (e.RTCPeerConnection = e.webkitRTCPeerConnection);
// 为每个方法创建包装：
arguments[0] = new (t === 'addIceCandidate' ? e.RTCIceCandidate : e.RTCSessionDescription)(arguments[0]);
```

同时将 `webkitRTCPeerConnection` 别名映射为 `RTCPeerConnection`。

---

### 1.2 Firefox 适配

#### 1.2.1 setLocalDescription/setRemoteDescription Promise 化 `FC()` (行 7828-7891)

**引用位置**: 7830, 7831, 7835, 7848, 7857, 7861

旧版 Firefox 使用回调而非 Promise。同时：
- 添加 `mozRTCPeerConnection` → `RTCPeerConnection` 别名映射
- 将 RTCSessionDescription/RTCIceCandidate 参数标准化
- 劫持 `getStats` 统一统计类型名（`inboundrtp` → `inbound-rtp` 等）

---

#### 1.2.2 Sender.getStats 垫片 `BC()` (行 7896-7929)

**引用位置**: 7898, 7900, 7905, 7912, 7917

劫持 `getSenders()` 和 `addTrack()` 添加 `_pc` 引用，为 `RTCRtpSender.prototype` 添加 `getStats()`。

---

#### 1.2.3 Receiver.getStats 垫片 `HC()` (行 7934-7956)

**引用位置**: 7936, 7938, 7943

劫持 `getReceivers()` 添加 `_pc` 引用，通过 track 事件设置 receiver 的 `_pc`，添加 `getStats()`。

---

#### 1.2.4 removeStream 垫片 `WC()` (行 7961-7974)

**引用位置**: 7963, 7964, 7967

如果 `RTCPeerConnection.prototype` 上没有 `removeStream`，基于 `removeTrack` 模拟。

---

#### 1.2.5 addTransceiver 增强 `jC()` (行 7986-8039)

**引用位置**: 7988, 7989, 7994

劫持 `addTransceiver()`，处理 `sendEncodings`（Simulcast 参数）。在调用原方法前后管理 `setParametersPromises` 队列，等待编码参数设置完成后再进行 createOffer/createAnswer。

---

#### 1.2.6 createOffer / createAnswer 修复 `qC()` / `zC()` (行 8062-8101)

**引用位置**: 8065, 8066, 8070, 8086, 8087, 8091

在 `createOffer`/`createAnswer` 执行前等待所有 `setParametersPromises`（由 addTransceiver 产生）完成。

---

### 1.3 Safari 适配

#### 1.3.1 Plan B 兼容层 `YC()` (行 8144-8203)

**引用位置**: 8146, 8149, 8152, 8156, 8159, 8163, 8172, 8186, 8189

为 Safari（使用 Plan B SDP 语义）补充 `getLocalStreams`、`addStream`、`addTrack`、`removeStream` 方法。维护 `_localStreams` 数组追踪本地流。

---

#### 1.3.2 getRemoteStreams / onaddstream 修复 `XC()` (行 8209-8279)

**引用位置**: 8213, 8214, 8217, 8221, 8224, 8251, 8255

添加 `getRemoteStreams()` 方法（维护 `_remoteStreams` 数组）。
添加 `onaddstream` 属性，通过监听 `track` 事件收集远端 stream 并派发 `addstream` 事件。
劫持 `setRemoteDescription`，在收到远端 SDP 后的 track 事件中收集 `_remoteStreams`。

---

#### 1.3.3 createOffer/createAnswer/setXXXDescription/addIceCandidate Promise 统一 `QC()` (行 8286-8336)

**引用位置**: 8288, 8289

Safari 的方法支持回调风格但不完全兼容 Promise。统一包装为 Promise，处理传参差异。

---

#### 1.3.4 迭代器修复 `ZC()` (行 8342-8343)

**引用位置**: （通过 `forEach` 遍历 getSenders/getReceivers/getTransceivers 结果）

Safari 返回的数组不支持 `forEach` 等迭代方法，通过劫持方法转换返回值。

---

### 1.4 通用适配 (Common Shim)

#### 1.4.1 SCTP 支持检测 `ub()` (行 9162-9270)

**引用位置**: 9164, 9165, 9166, 9172, 9176

为 `RTCPeerConnection.prototype` 添加 `sctp` 属性（getter，返回 `_sctp` 或 null）。
劫持 `setRemoteDescription`，当 SDP 中包含 SCTP 媒体行时解析并记录 maxMessageSize（兼容 Firefox 57 的 65535 限制和旧版的 16384 默认值）。

---

#### 1.4.2 DataChannel 消息大小限制 `hb()` (行 9274-9305)

**引用位置**: 9276, 9294, 9298

劫持 `createDataChannel()`，为返回的 DataChannel 的 `send()` 方法添加消息大小检查，超过 `sctp.maxMessageSize` 时抛出 TypeError。

---

#### 1.4.3 connectionState 属性垫片 `pb()` (行 9312-9366)

**引用位置**: 9314, 9315

为不支持 `connectionState` 的旧浏览器（通过 `iceConnectionState` 映射）：
- `completed` → `connected`
- `checking` → `connecting`
- 其他状态原样传递

同时添加 `onconnectionstatechange` 属性支持，劫持 `setLocalDescription`/`setRemoteDescription` 触发状态变更事件。

---

#### 1.4.4 setRemoteDescription extmap-allow-mixed 修复 `mb()` (行 9370-9394)

**引用位置**: 9372, 9375, 9379

劫持 `setRemoteDescription`，对不支持 `a=extmap-allow-mixed` 属性的浏览器（旧版 Chrome/Safari），从 SDP 中移除该行后再设置。

---

#### 1.4.5 addIceCandidate 空候选修复 `_b()` (行 9398-9418)

**引用位置**: 9400, 9401, 9407

劫持 `addIceCandidate`：
- 旧版 Chrome (< 78)、Firefox (< 68)、Safari：空 candidate 字符串直接 resolve（不做实际操作）
- 旧版无参数调用（仅回调）直接 resolve

---

#### 1.4.6 setLocalDescription 无参数修复 `fb()` (行 9422-9450)

**引用位置**: 9424, 9425, 9431

劫持 `setLocalDescription`，支持无参数调用：根据当前 signalingState 自动推断 type（`offer` 或 `answer`），然后自动调用 `createOffer`/`createAnswer` 生成 SDP 并设置。

---

### 1.5 RTCPeerConnection 构造函数劫持

#### 1.5.1 IceServer URL 格式统一 `eb()` (行 8369-8399)

**引用位置**: 8371, 8372, 8374, 8397, 8399

**完全替换** `window.RTCPeerConnection` 构造函数。

旧版浏览器使用 `RTCIceServer.url`（单数），新版使用 `urls`（复数）。劫持构造函数，将传入配置中的 `url` 自动转换为 `urls`，同时复制 `prototype` 和 `generateCertificate` 静态方法：

```js
const t = e.RTCPeerConnection;  // 保存原构造函数
e.RTCPeerConnection = function(e, i) {
  if (e && e.iceServers) {
    // 遍历 iceServers，将 { url: "..." } 转为 { urls: "..." }
    for (let i = 0; i < e.iceServers.length; i++) {
      if (void 0 === r.urls && r.url) {
        r = JSON.parse(JSON.stringify(r));
        r.urls = r.url;
        delete r.url;
      }
    }
  }
  return new t(e, i);  // 调用原构造函数
};
e.RTCPeerConnection.prototype = t.prototype;
// 保留 generateCertificate 静态方法
```

---

## 二、能力检测 (临时连接)

文件中 7 处 `new RTCPeerConnection()` 用于浏览器能力探测，都是临时创建、用完即释放。

### 2.1 `detectEncodeByPeerConnection()` — 编码能力检测 (行 15771)

| 项目 | 内容 |
|------|------|
| **行号** | 15771 |
| **传参** | 无参数（默认配置） |
| **生命周期** | 临时，检测完 `pc.close()` |
| **触发条件** | 首次检测结果中 H264 或 VP8 编码返回 false（需要重试确认） |

**流程**:
1. 创建 `<canvas>`，调用 `captureStream(0)` 获取视频流
2. `pc.addTrack(videoTrack, stream)` 添加视频轨
3. `await pc.createOffer()` 生成 SDP
4. 检查 SDP 文本中是否包含 `h264`、`vp8`、`h265`
5. `pc.close()` 关闭并返回结果

**用途**: 通过检查 createOffer 产生的 SDP 中是否包含特定 codec 名称，判断浏览器是否支持该编码格式。

---

### 2.2 `detectDecodeByPeerConnection()` — 解码能力检测 (行 15814)

| 项目 | 内容 |
|------|------|
| **行号** | 15814 |
| **传参** | 无参数（默认配置） |
| **生命周期** | 临时，检测完 `pc.close()` |

**流程**:
1. 如果支持 `addTransceiver`：`pc.addTransceiver('video', { direction: 'recvonly' })` 仅接收方向
2. 否则（旧浏览器）：`pc.createOffer({ offerToReceiveVideo: true })`
3. 解析 SDP 检查 `h264`、`vp8`、`h265`
4. `pc.close()`

**用途**: 通过仅接收方向的 SDP Offer 来判断浏览器的解码能力。与编码检测互补——浏览器可能支持 H264 解码但不支持编码。

---

### 2.3 H264 端到端实测 (发送端, 行 16116)

| 项目 | 内容 |
|------|------|
| **行号** | 16116 |
| **传参** | `{}` 空对象 |
| **所在环境** | 仅 Android Chrome + H264 encode/decode 都返回 true 时 |
| **生命周期** | 2000ms 超时或验证成功后 `l.close()` |

---

### 2.4 H264 端到端实测 (接收端, 行 16117)

| 项目 | 内容 |
|------|------|
| **行号** | 16117 |
| **传参** | `{ offerToReceiveAudio: true, offerToReceiveVideo: true }` |
| **所在环境** | 同上，与 #3 配对 |

**2.3 + 2.4 联合流程**:
1. 两个 PC 建立 P2P 连接，通过 ICE candidate 交换连通
2. 发送端用 canvas 生成测试视频，`l.addTrack(canvasTrack, canvasStream)`
3. 接收端在 Answer SDP 中**手动过滤只保留 H264 codec**，强制使用 H264
4. 每 100ms 检查 getStats：发送端 `outbound-rtp.bytesSent > 0`，接收端 `inbound-rtp.bytesReceived > 0`
5. 检测到实际数据传输即确认 H264 可用；2 秒超时则判定不可用

**用途**: 浏览器可能"声称"支持 H264，但实际编解码可能失败。通过真实的 P2P 传输来验证 H264 端到端可用性。

---

### 2.5 `isTransceiverSupported()` — Transceiver API 检测 (行 16313)

| 项目 | 内容 |
|------|------|
| **行号** | 16313 |
| **传参** | `{ sdpSemantics: 'unified-plan' }` |

**流程**:
1. 前置检查：`window.RTCRtpTransceiver` 存在 + `addTransceiver` 存在 + `currentDirection` 属性存在
2. 创建 Unified Plan 语义的临时 PC
3. `e.addTransceiver('audio')` 测试
4. 无异常 → `true`；异常 → `false`
5. `e.close()`

**用途**: 检测浏览器是否完整支持 Unified Plan + Transceiver API。`currentDirection` 检查是为了排除旧版 Safari 的假阳性。

---

### 2.6 `BJ()` 函数 — 解码器优先级解析 (行 45439)

| 项目 | 内容 |
|------|------|
| **行号** | 45439 |
| **传参** | 无参数 |
| **生命周期** | 临时，用完 `e.close()` |

**流程**:
1. 创建临时 PC，`addTransceiver('video', { direction: 'recvonly' })`
2. `createOffer()` 获取 SDP
3. 解析 SDP 获取浏览器按优先级排列的 codec 列表
4. `sortRtpCodecsByPriority()` 排序
5. 过滤 `h264`、`vp8`、`h265`
6. 结果赋值给 `clientAbility.video.decoders`

**用途**: 构建客户端解码能力描述，用于后续与服务器的 codec 协商。

---

## 三、核心连接类

SDK 使用两种模式管理 PeerConnection：

| 模式 | 类名 (混淆后) | 类名 (语义) | Connection 数 | 场景 |
|------|-------------|-----------|--------------|------|
| MPC | `iJ` | Multi PeerConnection | N 个（每远端用户一个） | 多人通话、观众拉流 |
| SPC | `SignalTransport` | Single PeerConnection | 1 个（全局共享） | 主播推流、一对一 |

SPC 初始化失败时**自动降级为 MPC**（见 `initSinglePC` → `fallbackToMPC`）。

### 3.1 MPC 多连接类 (iJ)

**对应行号范围**: ~37364-39761

**构造函数** (行 37364-37403):
```js
class iJ {
  constructor(e) {
    this.userId = e.userId;
    this.tinyId = e.tinyId;
    this._room = e.room;
    this._sdpSemantics = e.room.sdpSemantics;
    this._isUplink = e.isUplink;  // 上行(推流) or 下行(拉流)
    this._peerConnection = null;
    this._emitter = new EventEmitter();
    // ...
  }
}
```

#### `initialize()` — 创建 PeerConnection (行 37434-37449)

```js
initialize() {
  const e = {
    iceServers         : this._room.getIceServers(),
    iceTransportPolicy : this._room.getIceTransportPolicy(),
    sdpSemantics       : this._sdpSemantics,
    bundlePolicy       : 'max-bundle',
    rtcpMuxPolicy      : 'require',
    tcpCandidatePolicy : 'disable',
    IceTransportsType  : 'nohost'
  };
  this._peerConnection = new RTCPeerConnection(e);
  this._peerConnection.onconnectionstatechange = this.onConnectionStateChange.bind(this);
}
```

#### `_peerConnection` 在 MPC 中的使用方式

| 操作 | 典型调用 | 说明 |
|------|---------|------|
| 获取连接状态 | `this._peerConnection.connectionState` | 判断 NEW/CONNECTING/CONNECTED 等 |
| 获取 ICE 状态 | `this._peerConnection.iceConnectionState` | ICE 连接状态 |
| 获取 DTLS 状态 | `this._peerConnection.getSenders()[0].transport` | 通过第一个 sender 的 transport |
| 添加收发器 | `this._peerConnection.addTransceiver(type, { direction })` | 上行 1+2 个，下行 1+2+1 个 |
| 创建 Offer | `this._peerConnection.createOffer(options)` | 生成本地 SDP Offer |
| 设置本地 SDP | `this._peerConnection.setLocalDescription(desc)` | 设置 Offer/Answer |
| 设置远端 SDP | `this._peerConnection.setRemoteDescription(desc)` | 设置远端 Offer/Answer |
| 添加轨道 | `this._peerConnection.addTrack(track, stream)` | 添加音频/视频轨 |
| 移除轨道 | `this._peerConnection.removeTrack(sender)` | 移除并可选关闭 transceiver |
| 替换轨道 | `sender.replaceTrack(newTrack)` | mute/unmute 时替换 |
| 获取统计 | `this._peerConnection.getStats()` | 获取连接质量统计数据 |
| 获取发送者 | `this._peerConnection.getSenders()` | 查找 sender 操作 |
| 获取接收者 | `this._peerConnection.getReceivers()` | 查找 receiver |
| 获取收发器 | `this._peerConnection.getTransceivers()` | Unified Plan 语义下使用 |
| 关闭连接 | `this._peerConnection.close()` | 释放资源 |
| 事件监听 | `this._peerConnection.ontrack` | 远端 track 到达 |
| 事件监听 | `this._peerConnection.onconnectionstatechange` | 连接状态变化 |

#### `closePeerConnection()` (行 37461-37475)
```js
closePeerConnection() {
  if (this._peerConnection) {
    this._peerConnection.onconnectionstatechange = null;
    this._peerConnection.close();
    this._peerConnection = null;
  }
}
```

---

### 3.2 SPC 单连接类 (SignalTransport)

**对应行号范围**: ~45866-47367

**类定义** (行 45866):
```js
class SignalTransport extends EventEmitter2 {
  constructor({ signalChannel, room, enableCustomMessage }) {
    this._peerConnection = null;
    this._datachannel = null;
    this._room = room;
    this._signalChannel = signalChannel;
    this._enableCustomMessage = enableCustomMessage;
    // ...统计、状态、能力属性
  }
}
```

#### `getPeerConnectionConfig(iceServers)` (行 46170-46191)

```js
getPeerConnectionConfig(e) {
  const i = {
    encodedInsertableStreams : this.enableInsertableStreams,  // SPC 特有
    offerExtmapAllowMixed    : true,                          // SPC 特有
    iceServers               : e,
    iceTransportPolicy       : this._room.getIceTransportPolicy(),
    sdpSemantics             : this._room.sdpSemantics,
    bundlePolicy             : 'max-bundle',
    rtcpMuxPolicy            : 'require',
    tcpCandidatePolicy       : 'disable',
    IceTransportsType        : 'nohost'
  };
  // 如果是重新连接，从已有 PC 继承 encodedInsertableStreams 配置
  const r = this._peerConnection?.getConfiguration().encodedInsertableStreams;
  if (xN(r)) i.encodedInsertableStreams = r;
  return i;
}
```

#### `initialize(iceServers)` (行 46194-46255)

```js
async initialize(e) {
  this._peerConnection = new RTCPeerConnection(this.getPeerConnectionConfig(e));
  
  // ICE 连接状态变化 → 记录连接耗时
  this._peerConnection.oniceconnectionstatechange = () => { ... };
  
  // 信令状态变化
  this._peerConnection.onsignalingstatechange = () => { ... };
  
  // 连接状态变化
  this._peerConnection.onconnectionstatechange = this.onConnectionStateChange.bind(this);
  
  // 远端 track 到达
  this._peerConnection.ontrack = (e) => this.emit('track', e);
  
  // 自定义消息 DataChannel
  if (this._enableCustomMessage) {
    this._datachannel = this._peerConnection.createDataChannel(`${userId}dc`);
  }
  
  // 创建上行收发器 (1 音频 + 3 视频 = 4 个)
  this._peerConnection.addTransceiver('audio', { direction: 'sendonly' });
  this._peerConnection.addTransceiver('video', { direction: 'sendonly' }); // 主流
  this._peerConnection.addTransceiver('video', { direction: 'sendonly' }); // 小流
  this._peerConnection.addTransceiver('video', { direction: 'sendonly' }); // 辅流
  
  const offer = await this._peerConnection.createOffer();
  // ...
}
```

#### SPC 特有功能

| 功能 | 代码位置 | 说明 |
|------|---------|------|
| Insertable Streams | `encodedInsertableStreams` 配置 | 自定义编码管线处理（SEI 注入等） |
| Script Transform | `scriptTransformWorker` | Web Worker 中的编码/解码管线 |
| DataChannel 消息 | `createDataChannel` | 信令通道外的自定义消息传输 |
| JitterBuffer 控制 | `setJitterBufferTarget` | 控制接收端抖动缓冲 |
| 小流 Simulcast | transceiver#3 的 encodings | 大小流分层编码 |
| 防火墙检测 | `firewall-restriction` 事件 | UDP 不通时自动检测 |

---

### 3.3 MPC vs SPC 模式对比

| 维度 | MPC (iJ) | SPC (SignalTransport) |
|------|---------|----------------------|
| **模式** | 每远端用户一个 PC | 全局共享一个 PC |
| **Transceiver** | 动态按需创建 | 初始化时固定创建 4 个 |
| **配置参数** | 7 个 | 9 个（多了 `encodedInsertableStreams` + `offerExtmapAllowMixed`） |
| **事件监听** | 仅 `onconnectionstatechange` | ICE / 信令 / 连接 / track / DataChannel |
| **高级特性** | 无 | Insertable Streams / DataChannel / SEI / JitterBuffer |
| **ICE 候选** | `IceTransportsType: 'nohost'` | 同 MPC |
| **降级关系** | SPC 失败 → fallbackToMPC() | — |

---

## 四、业务逻辑中的 RTCPeerConnection 使用

SDK 上层通过 `_peerConnection` 属性操作 PeerConnection，以下是关键业务操作汇总。

### 4.1 连接建立流程

```
1. 获取 iceServers (从信令服务器)
2. initialize() 创建 new RTCPeerConnection(config)
3. addTransceiver() 预创建收发器
4. createOffer() 生成本地 SDP
5. 发送 Offer 到信令服务器
6. 收到 Answer → setRemoteDescription()
7. ICE candidate 交换
8. connectionState → 'connected'
```

### 4.2 上行/下行切换

**MPC 模式**：
- `_isUplink = true`：上行连接（推流），addTrack 添加本地媒体
- `_isUplink = false`：下行连接（拉流），ontrack 事件接收远端媒体

**SPC 模式**：
- 上行：初始化时 4 个 `sendonly` transceiver
- 下行：`addDownlinkTrack()` 添加 `recvonly` transceiver

### 4.3 重连机制

```
连接断开 → setConfiguration(新 iceServers) → 重新 createOffer
          → 如果失败: closePeerConnection() → 重新 initialize()
```

### 4.4 媒体操作

| 操作 | 调用链 |
|------|-------|
| 发布本地流 | `addTrack(track, stream)` → `createOffer()` → `setLocalDescription()` |
| 取消发布 | `removeTrack(sender)` → `createOffer()` → `setLocalDescription()` |
| 静音/取消静音 | `sender.replaceTrack(null)` / `sender.replaceTrack(track)` |
| 切换摄像头 | `sender.replaceTrack(newTrack)` |
| 屏幕共享 | 新 track → `addTrack` 或 `replaceTrack` |
| 订阅远端流 | `addTransceiver(type, { direction:'recvonly' })` → 重新协商 |
| 取消订阅 | 移除 transceiver → 重新协商 |

### 4.5 统计与诊断

| 操作 | 代码 | 说明 |
|------|------|------|
| 连接耗时统计 | ICE start/end time | 记录 `checking→connected` 耗时 |
| DTLS 状态 | `getSenders()[0].transport.state` | DTLS 握手状态 |
| RTT 检测 | `getStats()` 过滤 candidate-pair | 往返时延 |
| 码率统计 | `getStats()` 过滤 outbound/inbound-rtp | 发送/接收码率 |
| 丢包统计 | `getStats()` packetsLost | 丢包数 |
| 编解码协商 | SDP 解析 codec | 确认实际使用的编码格式 |

### 4.6 资源释放

```
unpublish() / leave()
  → closePeerConnection()
    → onconnectionstatechange = null
    → oniceconnectionstatechange = null
    → onsignalingstatechange = null
    → ontrack = null
    → pc.close()
    → _peerConnection = null
```

---

## 附录: 完整 RTCPeerConnection 引用行号清单

### A. Polyfill / Adapter (Chrome)
| 行号范围 | 函数 | 功能 |
|---------|------|------|
| 6656-6657 | `fC()` | addEventListener/removeEventListener 事件拦截 |
| 7011, 7013 | `kC()` | ontrack 属性检测 |
| 7026, 7030 | `kC()` | setRemoteDescription 劫持 |
| 7040, 7055 | `kC()` | getReceivers 调用 |
| 7083-7085 | `DC()` | getSenders/createDTMFSender 检测 |
| 7104, 7107 | `DC()` | getSenders 补丁 |
| 7111, 7115 | `DC()` | addTrack 劫持 |
| 7122, 7126 | `DC()` | removeTrack 劫持 |
| 7134, 7138 | `DC()` | addStream 劫持 |
| 7147, 7151 | `DC()` | removeStream 劫持 |
| 7165-7167 | `DC()` | getSenders + DTMF 检测 |
| 7172, 7176 | `DC()` | getSenders 劫持 (场景 B) |
| 7204-7205, 7209 | `wC()` | getStats 修补 |
| 7275 | `NC()` | RTCPeerConnection/RTCRtpSender/RTCRtpReceiver 检测 |
| 7278, 7283 | `NC()` | getSenders 补丁 |
| 7290, 7295 | `NC()` | addTrack 补丁 |
| 7314, 7319 | `NC()` | getReceivers 补丁 |
| 7338, 7342 | `NC()` | getStats 增强 |
| 7379 | `OC()` | getLocalStreams 补丁 |
| 7386, 7388 | `OC()` | addTrack 劫持 |
| 7404, 7406 | `OC()` | addStream 劫持 |
| 7423, 7425 | `OC()` | removeStream 劫持 |
| 7435, 7437 | `OC()` | removeTrack 劫持 |
| 7462-7464 | `PC()` | Chrome 版本检测 |
| 7468 | `PC()` | getLocalStreams 补丁 |
| 7475, 7479 | `PC()` | addStream 劫持 |
| 7498 | `PC()` | removeStream 劫持 (旧) |
| 7520 | `PC()` | removeStream 劫持 |
| 7530 | `PC()` | addTrack 劫持 |
| 7563, 7588 | `PC()` | createOffer/createAnswer 劫持 |
| 7590, 7594 | `PC()` | setLocalDescription 劫持 |
| 7616, 7618 | `PC()` | localDescription getter |
| 7629 | `PC()` | removeTrack 劫持 (新版) |
| 7658-7659 | `MC()` | webkitRTCPeerConnection 别名 |
| 7663, 7676 | `MC()` | setLocalDescription 等参数转换 |

### B. Polyfill / Adapter (Firefox)
| 行号范围 | 函数 | 功能 |
|---------|------|------|
| 7830-7831 | `FC()` | mozRTCPeerConnection 别名 |
| 7835, 7848 | `FC()` | setLocalDescription 等参数标准化 |
| 7857, 7861 | `FC()` | getStats 修补 |
| 7898 | `BC()` | RTCPeerConnection/RTCRtpSender 检测 |
| 7900, 7905 | `BC()` | getSenders 补丁 |
| 7912, 7917 | `BC()` | addTrack 补丁 |
| 7936 | `HC()` | RTCPeerConnection/RTCRtpSender 检测 |
| 7938, 7943 | `HC()` | getReceivers 补丁 |
| 7963-7964, 7967 | `WC()` | removeStream 补丁 |
| 7988-7989, 7994 | `jC()` | addTransceiver 劫持 |
| 8065-8066, 8070 | `qC()` | createOffer 劫持 |
| 8086-8087, 8091 | `zC()` | createAnswer 劫持 |

### C. Polyfill / Adapter (Safari)
| 行号范围 | 函数 | 功能 |
|---------|------|------|
| 8146, 8149, 8152 | `YC()` | getLocalStreams 补丁 |
| 8156, 8159, 8163 | `YC()` | addStream 补丁 |
| 8172 | `YC()` | addTrack 补丁 |
| 8186, 8189 | `YC()` | removeStream 补丁 |
| 8213-8214, 8217 | `XC()` | getRemoteStreams 补丁 |
| 8221, 8224 | `XC()` | onaddstream 属性 |
| 8251, 8255 | `XC()` | setRemoteDescription 劫持 |
| 8288-8289 | `QC()` | 方法 Promise 化 |

### D. 通用适配
| 行号范围 | 函数 | 功能 |
|---------|------|------|
| 8371-8372, 8374 | `eb()` | 构造函数劫持 (url→urls) |
| 8397, 8399 | `eb()` | prototype/generateCertificate 保留 |
| 8420, 8424 | `ib()` | createOffer 修复 |
| 9164-9166 | `ub()` | SCTP 属性补丁 |
| 9172, 9176 | `ub()` | setRemoteDescription 劫持 |
| 9276 | `hb()` | createDataChannel 检测 |
| 9294, 9298 | `hb()` | createDataChannel 劫持 |
| 9314-9315 | `pb()` | connectionState 属性补丁 |
| 9372 | `mb()` | RTCPeerConnection 检测 |
| 9375, 9379 | `mb()` | setRemoteDescription 劫持 |
| 9400-9401, 9407 | `_b()` | addIceCandidate 劫持 |
| 9424-9425, 9431 | `fb()` | setLocalDescription 劫持 |
| 9477, 9481 | 浏览器检测 | webkitRTCPeerConnection 检测 |

### E. 能力检测
| 行号 | 函数 | 用途 |
|------|------|------|
| 15771 | `detectEncodeByPeerConnection()` | 编码能力检测 |
| 15814 | `detectDecodeByPeerConnection()` | 解码能力检测 |
| 16116 | H264 验证 (发送端) | H264 端到端实测 |
| 16117 | H264 验证 (接收端) | H264 端到端实测 |
| 16313 | `isTransceiverSupported()` | Transceiver API 检测 |
| 16324, 16330, 16336, 16343 | 工具检测函数 | getReceivers/getSenders/getTransceivers/addTransceiver 可用性 |
| 45439 | `BJ()` | 解码器优先级解析 |

### F. 核心连接 (MPC + SPC)
| 行号 | 类/上下文 | 操作 |
|------|---------|------|
| 37379 | iJ constructor | `_peerConnection = null` 初始化 |
| 37447 | iJ.initialize() | `new RTCPeerConnection(e)` MPC 创建 |
| 37448-37492 | iJ | `_peerConnection.xxx` MPC 操作 |
| 46204 | SignalTransport.initialize() | `new RTCPeerConnection(config)` SPC 创建 |
| 46205-47367 | SignalTransport | `_peerConnection.xxx` SPC 操作 |
| 46300 | SignalTransport | `setConfiguration()` 重连 |

---

## 关键数据

- **RTCPeerConnection 总引用**: 213 处
- **`new RTCPeerConnection()` 调用**: 8 处（6 处能力检测 + 2 处核心连接）
  - 能力检测: `detectEncodeByPeerConnection` (行15771), `detectDecodeByPeerConnection` (行15814), H264 实测 × 2 (行16116/16117), `isTransceiverSupported` (行16313), `BJ` 解码器解析 (行45439)
  - 核心连接: MPC `iJ.initialize` (行37447), SPC `SignalTransport.initialize` (行46204)
- **原型方法劫持**: ~50+ 个方法被 patch
- **构造函数劫持**: 1 处（`eb()` 函数，行8369-8399，`url`→`urls` 格式转换）
- **支持的浏览器**: Chrome, Firefox, Safari, Edge Legacy, 微信浏览器, 鸿蒙浏览器
