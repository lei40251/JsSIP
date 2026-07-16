# `samples/trtc.deobfuscated.js` — 浏览器 API 使用全景分析

> 文件：`samples/trtc.deobfuscated.js`（~52K 行 / 1.7MB，TRTC Web SDK 反混淆版本）
>
> 结构概览：UMD 包装器（L10）→ core-js polyfills（L1-6650）→ WebRTC adapter.js 浏览器适配层（L6651-9308）→ 核心功能模块（SDP 解析、信令、媒体管线、WebGL 渲染、TRTCSdk 主类等，L9308-51908）

---

## 一、WebRTC 核心 API（~213 次 RTCPeerConnection 出现）

### 1.1 `RTCPeerConnection` 构造函数

**出现次数**：~213 次

**功能**：建立浏览器端实时音视频 P2P 连接的核心对象。

**构造参数**（L37437-37445 / L46173-46184）：

```js
new RTCPeerConnection({
  iceServers               : this._room.getIceServers(),      // TURN/STUN 服务器列表
  iceTransportPolicy       : this._room.getIceTransportPolicy(), // 'all' | 'relay'
  sdpSemantics             : 'unified-plan' | 'plan-b',       // SDP 格式语义
  bundlePolicy             : 'max-bundle',                    // BUNDLE 复用策略
  rtcpMuxPolicy            : 'require',                       // RTCP 复用
  tcpCandidatePolicy       : 'disable',                       // 禁用 TCP 候选
  IceTransportsType        : 'nohost',                        // 禁用 Host 候选
  encodedInsertableStreams : true,                             // 启用 Encoded Transform (L46175)
  offerExtmapAllowMixed    : true                              // 允许混合扩展映射 (L46176)
})
```

**使用场景**：
- **上行传输（UplinkTransport）**：在 `initialize()` 中创建 PC，用于推流（L37437-37448）
- **下行传输（DownlinkTransport）**：在 `initialize(iceServers)` 中创建 PC，用于拉流（L46204）
- **能力检测用**：临时创建 PC 检测编解码能力后立即关闭（L15771, L15817）

### 1.2 `createOffer()` / `createAnswer()`

**出现次数**：~88 次（与 setLocalDescription/setRemoteDescription/addIceCandidate 合计）

**功能**：生成 SDP Offer/Answer，启动或响应 WebRTC 协商。

**createOffer 典型调用**（L38231-38238）：

```js
// 上行传输：创建 Offer 发起推流
const options = { voiceActivityDetection: false };

// Unified Plan 下预先 addTransceiver 声明需要接收的媒体类型
if (hasAddTransceiver && sdpSemantics === 'unified-plan') {
  pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('video', { direction: 'recvonly' });
} else {
  // Plan B 用传统 offerToReceive 选项
  options.offerToReceiveAudio = true;
  options.offerToReceiveVideo = true;
}

const offer = await pc.createOffer(options);
// 然后对 SDP 进行处理：移除 H.264（如不支持）、设置带宽、过滤方向
```

**createAnswer 典型场景**：收到远端 Offer 后生成 Answer 进行应答。

### 1.3 `setLocalDescription()` / `setRemoteDescription()`

**功能**：设置本地/远端 SDP 描述，驱动 ICE 收集和媒体协商。

**典型流程**（L38191-38196）：
```
createOffer → setLocalDescription(offer) → 通过信令通道发送 offer
收到 answer → setRemoteDescription(answer) → 媒体连接建立
```

**适配垫片**：
- Firefox 旧版：回调转 Promise（L7825-7833）
- Chrome/Safari：参数格式标准化（L7653-7661）
- Safari：ontrack 事件需通过 setRemoteDescription 触发（L8251-8255）

### 1.4 `addIceCandidate()`

**功能**：添加远端 ICE 候选地址，完成连接性检测。

**典型用法**（L16119-16120）：
```js
pc.addEventListener('icecandidate', (e) => {
  // 收集本地 candidate，通过信令通道发送给远端
  signalChannel.send({ candidate: e.candidate });
});
// 远端收到后调用
await pc.addIceCandidate(remoteCandidate);
```

### 1.5 `addTrack()` / `removeTrack()`

**出现次数**：~236 次（含 replaceTrack）

**功能**：向 PeerConnection 添加/移除媒体轨道（推流时添加本地轨道，拉流时不使用这两个 API——拉流通过 ontrack 事件接收）。

**推流典型流程**（L38722-38729）：
```js
const stream = new MediaStream();
stream.addTrack(audioTrack);    // 麦克风轨道
stream.addTrack(videoTrack);    // 摄像头轨道
pc.addTrack(audioTrack, stream);
pc.addTrack(videoTrack, stream);
// 大小流（Simulcast）场景可能还有 smallTrack
```

**适配垫片**：
- 旧 Chrome 无 addTrack：通过 addStream 垫片模拟（L7372-7456）
- removeTrack 同理通过 removeStream 垫片

### 1.6 `replaceTrack()`

**出现次数**：~50+ 次

**功能**：在保持连接的前提下替换发送端的媒体轨道，用于设备切换（如切换摄像头）或 mute/unmute 实现。

**典型用法**（L38677, L38684）：
```js
// 切换摄像头：替换视频轨道而不重新协商
await transceiver.sender.replaceTrack(newVideoTrack);

// 音频 mute：替换为 null
await sender.replaceTrack(null);
// 音频 unmute：替换回原轨道
await sender.replaceTrack(originalAudioTrack);
```

### 1.7 `getSenders()` / `getReceivers()` / `getTransceivers()`

**功能**：查询当前连接的发送/接收/收发器列表，用于轨道管理。

**典型用法**：
```js
// 获取第一个发送器的传输对象（用来检查 DTLS 状态）
const senders = pc.getSenders();
const dtlsTransport = senders[0]?.transport;        // L38686-38687

// 遍历收发器设置方向
const transceivers = pc.getTransceivers();
transceivers.forEach(t => t.direction = 'sendonly'); // L39018
```

**适配垫片**（L7075-7198）：
- 旧 Chrome 无原生 `getSenders()`/`getReceivers()`，通过 `createDTMFSender` 和内部映射表反向推导

### 1.8 `getStats()`

**功能**：获取 WebRTC 连接的实时统计信息（包收发量、丢包率、延迟、编解码器信息等），用于通话质量监控。

**用法**：Chrome 和 Firefox 的原生 `getStats()` 在旧版中使用回调模式，adapter.js 提供 Promise 化垫片（L7198-7209, L7893-7928）。

```js
const stats = await pc.getStats();
stats.forEach(report => {
  if (report.type === 'inbound-rtp' && report.kind === 'video') {
    // 视频接收统计：packetsLost, jitter, frameRate 等
  }
});
```

### 1.9 `createDataChannel()` / `RTCDataChannel`

**功能**：创建自定义数据通道，用于传输非音视频数据（如自定义消息）。

**典型用法**（L46229）：
```js
// 创建以 userId 命名的数据通道
this._datachannel = pc.createDataChannel(`${userId}dc`);
this._datachannel.onmessage = (event) => {
  // 处理收到的自定义消息
};
```

### 1.10 `createEncodedStreams()` + `RTCRtpScriptTransform`

**出现次数**：~38 次（Insertable Streams 相关）

**功能**：WebRTC Encoded Transform（编码帧插入/读取），用于：
1. **SEI 信息注入**：在编码后的视频帧中插入 SEI NAL 单元（如 NTP 时间戳、房间信息）
2. **编码帧预处理**：在编码前对帧进行处理

**两套 API 共存**（L16371-16373）：

```js
// 旧版（Chrome 86+）
const streams = sender.createEncodedStreams();
// streams.readable / streams.writable

// 新版（RTCRtpScriptTransform）
sender.transform = new RTCRtpScriptTransform(worker, {
  userId, streamType, isAudio, isMain, seiMessageList
});
```

**实际使用**：
- 上行：`sender.createEncodedStreams()` → readable 管道出来 → `TransformStream` 注入 SEI → writable 管道回去（L48106-48139）
- 下行：`receiver.createEncodedStreams()` → 读取编码帧（L48931-48935）
- Transform Worker：通过 `new Worker()` + `self.onrtctransform` 实现编码帧的离线处理（L46086-46141）

### 1.11 SDP 处理

**完整 SDP 语法解析器**（L9869-10590）：定义了 SDP 媒体行、属性行、编解码器参数的完整语法。

**SDP 修改场景**：
| 函数 | 功能 | 位置 |
|------|------|------|
| `exchangeSDP()` | 创建 Offer → 发送到信令服务器 → 等待 Answer | L38184-38223 |
| `setBandwidthBySDP()` | 修改 SDP 中的 `b=AS:` 带宽限制 | L46914-46940 |
| `filterSDPDirection()` | 过滤媒体段的 direction 属性 | L47085-47088 |
| `setSDPDirection()` | 设置媒体段的 direction（sendonly/recvonly/sendrecv/inactive） | L39438-39448 |
| 移除 H.264 | SDK 对不支持 H.264 的场景，从 SDP 中剔除 H.264 编解码器 | L38242-38248 |

### 1.12 `connectionState` / `iceConnectionState` / `signalingState`

**功能**：监听连接状态变化，驱动 UI 更新和错误恢复。

**典型用法**（L46205-46227）：
```js
pc.oniceconnectionstatechange = () => {
  switch (pc.iceConnectionState) {
    case 'checking':  /* ICE 连接检测中 */ break;
    case 'connected': /* ICE 连接成功，记录耗时 */ break;
    case 'failed':    /* ICE 连接失败，上报错误 */ break;
  }
};
pc.onconnectionstatechange = this.onConnectionStateChange.bind(this);
// 内部映射到: NEW → CONNECTING → CONNECTED → DISCONNECTED → FAILED → CLOSED
```

**适配垫片**（L9308-9320）：旧浏览器无 `connectionState`，通过 `iceConnectionState` 映射模拟。

---

## 二、媒体设备与采集 API（~65 次出现）

### 2.1 `navigator.mediaDevices.getUserMedia(constraints)`

**出现次数**：28 次

**功能**：请求用户授权并采集摄像头/麦克风的媒体流。这是 SDK 最核心的采集入口。

**调用链路**：
```
TRTC.createClient() → client.join() → client.startLocalVideo() / startLocalAudio()
  → getUserMedia(constraints) → 获取 MediaStream → 创建 Track 对象
```

**约束构建**（L20385-20429）：

**音频约束**（`isAudioConstraintsValid()`）：
```js
// 默认值
const audioConstraints = {
  echoCancellation: true,      // 回声消除（可设为 'remote-only' | 'all' | false）
  noiseSuppression: true,      // 噪声抑制
  autoGainControl: true,       // 自动增益控制
  sampleRate: 48000,           // 采样率（48kHz）
  channelCount: 1,             // 声道数（可选）
  deviceId: microphoneId       // 指定麦克风设备（可选）
};
```

**视频约束**（`isVideoConstraintsValid()`）：
```js
const videoConstraints = {
  deviceId: cameraId,                    // 指定摄像头（可选）
  facingMode: 'user' | 'environment',    // 前后摄像头
  width: { ideal: 1280, max: 1280 },     // 宽度约束
  height: { ideal: 720, max: 720 },      // 高度约束
  frameRate: 15,                          // 帧率
};
```

**重试机制**：遇到 `NotReadableError` 时自动重试最多 3 次（L20357-20364），包含设备 ID 降级策略（exact → ideal → 不限设备）。

### 2.2 `navigator.mediaDevices.enumerateDevices()`

**出现次数**：7 次

**功能**：枚举所有可用的媒体输入/输出设备（摄像头、麦克风、扬声器）。

**典型用法**（L19298-19324）：
```js
// 先触发 getUserMedia 获取权限，再枚举设备可获取完整的设备标签
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
const devices = await navigator.mediaDevices.enumerateDevices();
// devices: [{ deviceId, groupId, kind: 'audioinput'|'videoinput'|'audiooutput', label }]
```

**使用场景**：
- 每次 `getUserMedia` 成功后重新枚举设备（L19324），获取最新的设备列表
- SDK 启动时枚举设备检测可用性（L20278-20288）
- `devicechange` 事件触发时重新枚举（L19218-19221）

### 2.3 `navigator.mediaDevices.getDisplayMedia(constraints)`

**出现次数**：多处

**功能**：屏幕共享采集（整个屏幕、应用窗口、或浏览器标签页）。

**约束构建**（L26980-27001）：
```js
const displayConstraints = {
  video: {
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },
    frameRate: 15,
    displaySurface: 'monitor' | 'window' | 'browser' | 'current-tab'
  },
  preferCurrentTab: true,               // 优先当前标签页
  audio: {                               // 系统音频（可选）
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: false,
    sampleRate: 48000
  },
  systemAudio: 'include',                // Chrome 标签页音频
  selfBrowserSurface: 'include',
  surfaceSwitching: 'include'
};
```

**后处理**：获取屏幕流后使用 `applyConstraints()` 微调帧率（L27017-27021），使用 `CropTarget.fromElement()` 对指定元素进行区域裁剪（L27034-27038）。

### 2.4 `navigator.mediaCapabilities.encodingInfo()` / `decodingInfo()`

**功能**：查询浏览器是否支持特定编码/解码配置，用于能力检测和编码选择。

**典型用法**（L16573-16604）：
```js
// 检测 H.264 编码是否支持
const result = await navigator.mediaCapabilities.encodingInfo({
  video: {
    contentType: 'video/avc;codecs=avc1.42E01E',   // H.264 Baseline
    width: 1280, height: 720, bitrate: 1000000, framerate: 30
  }
});
// result: { supported: true | false, smooth: true | false, powerEfficient: true | false }
```

### 2.5 `MediaStreamTrack` 详细 API

**功能**：精细化的轨道级别操作。

**常用 API 及场景**：

| API | 场景 | 关键行号 |
|-----|------|----------|
| `track.getSettings()` | 获取轨道实际设置（分辨率、采样率等），用于日志和状态同步 | L12588, L19652, L23332 |
| `track.getCapabilities()` | 获取设备能力范围，用于约束校验 | L16369, L20307 |
| `track.getConstraints()` | 获取当前约束，用于 3A 动态调整前保存状态 | L23846 |
| `track.applyConstraints()` | 动态修改 3A 参数或分辨率/frameRate | L23860, L24449 |
| `track.stop()` | 停止轨道释放设备，如关闭摄像头/麦克风 | 35+ 次 |
| `track.clone()` | 克隆轨道，用于同时推流和本地预览 | L35463, L44834 |
| `track.muted` / `track.enabled` | mute/unmute 状态 | 40+ / 8 次 |
| `track.readyState` | `'live'` / `'ended'`，驱动播放器生命周期 | 8 次 |
| `track.contentHint` | 提示浏览器优化方向（`'motion'`/`'detail'`/`'text'`），用于屏幕共享 | 多处 |

### 2.6 `InputDeviceInfo.getCapabilities()`

**功能**：在 `enumerateDevices` 结果上获取设备能力（Chrome 特性）。

```js
if (typeof InputDeviceInfo !== 'undefined' && 'getCapabilities' in InputDeviceInfo.prototype) {
  const device = devices.find(d => d.kind === 'videoinput');
  device.getCapabilities();  // 返回类似 track.getCapabilities() 的范围
}
```

---

## 三、音频处理 API（58 次 AudioContext）

### 3.1 AudioContext 初始化与自动播放策略

**功能**：创建全局单例 AudioContext，管理浏览器自动播放策略。

**初始化**（L18470-18491）：
```js
// 三级降级：AudioContext → webkitAudioContext → mozAudioContext
typeof AudioContext !== 'undefined'
  ? (AudioContextClass = AudioContext)
  : typeof webkitAudioContext !== 'undefined'
    ? (AudioContextClass = webkitAudioContext)
    : typeof mozAudioContext !== 'undefined' && (AudioContextClass = mozAudioContext);

// 全局单例
const audioCtx = new AudioContextClass({ sampleRate: 48000 });

// 监听状态变化（挂起/恢复）
audioCtx.onstatechange = () => {
  if (audioCtx.state === 'suspended') {
    // 检测到浏览器暂停了音频上下文（自动播放策略）
    // 在用户交互（click）时恢复
    document.addEventListener('click', resumeAudioContext);
  }
};
```

**自动播放策略恢复**：
- 监听 `AudioContext.state === 'suspended'`（L18494），记录挂起持续时间
- 通过 `document.addEventListener('click', ...)` 在用户交互时调用 `audioCtx.resume()`（L18502-18503）
- 状态变为 `'interrupted'` 时同样触发 `resume()`
- 弹出"自动播放被阻止，点击恢复"对话框（L17950-18061）

### 3.2 音频处理管线（AudioPipeline）

**功能**：构建完整的音频处理链路。

**管线结构**（L18821-18837）：
```
麦克风采集 (MediaStreamTrack)
  ↓ createMediaStreamSource
  → AEC 节点 (回声消除)
  → Denoiser (AI 降噪)
  → VoiceChanger (变声)
  → GainNode (音量控制)
  ↓ createMediaStreamDestination
  → 推流 (sendTrack) / 本地监听 (扬声器)
```

**管线中使用的 Web Audio API**：

| API | 功能 | 行号 |
|-----|------|------|
| `audioCtx.createMediaStreamSource(mediaStream)` | 从麦克风流创建音频源节点 | L18955, L27336 |
| `audioCtx.createMediaStreamDestination()` | 创建处理后的音频输出流（用于推流） | L18906, L19450 |
| `audioCtx.createGain()` | 创建增益控制节点（音量调节） | L18786, L23917 |
| `audioCtx.createAnalyser()` | 创建频谱分析器（音量检测备用） | L19515 |
| `audioCtx.createBiquadFilter()` | 创建滤波器 | 多处 |
| `node.connect(nextNode)` / `node.disconnect()` | 节点连接/断开 | 70+ 次 |

### 3.3 AudioWorklet — 音量检测

**功能**：通过 AudioWorklet 在独立线程中计算实时音量，避免主线程阻塞。

**Worklet 代码**（L19003 内联，压缩格式）：
```js
// registerProcessor('volume-meter', class extends AudioWorkletProcessor {
//   process(inputs, outputs) {
//     // 计算输入音频的峰值幅度（volume）和 dB（volumeDb）
//     // 通过 this.port.postMessage({ volume, volumeDb }) 发送到主线程
//   }
// })
```

**主线程注册**（L19013）：
```js
await audioCtx.audioWorklet.addModule(
  URL.createObjectURL(new Blob([workletCode], { type: 'application/javascript' }))
);
const workletNode = new AudioWorkletNode(audioCtx, 'volume-meter');
```

**两种模式**：
| 模式 | 实现 | 特点 |
|------|------|------|
| `worklet` | `AudioWorkletNode` | 独立线程，高性能，首选 |
| `analyser` | `createAnalyser()` + `getByteTimeDomainData()` | 主线程轮询，兼容性降级 |

### 3.4 AnalyserNode — 波形分析

**功能**：获取实时音频波形数据（时域）用于音频可视化或音量检测降级方案。

```js
analyser.getByteTimeDomainData(dataArray);  // 获取时域波形（L18734-18739）
const maxAmplitude = Math.max(...dataArray) / 128 - 1;  // 归一化幅度（L18747）
```

---

## 四、Canvas / WebGL 渲染 API（~191 次出现）

### 4.1 Canvas 2D — 快照与帧预处理

**使用场景**：

| 场景 | 说明 | 位置 |
|------|------|------|
| 截图/快照 | `drawImage(videoElement, 0, 0)` → `toDataURL('image/png')` | L18368-18377 |
| 编码能力检测 | 创建 canvas → `captureStream(0)` → `addTrack` 到临时 PC → 检测 SDP 中编解码器 | L15771-15786 |
| 图像数据读取 | `getImageData()` + `putImageData()` 用于像素级渲染 | L25203, L28297 |
| 画布流捕获 | `canvas.captureStream(0)` 获取画布视频流，用于混流/合成场景 | L15775, L18278, L25403 |

### 4.2 WebGL 2.0 — GPU 视频渲染管线

**功能**：利用 GPU 进行视频帧的实时渲染和处理（虚拟背景、水印、美颜等）。

**初始化**（L25952-25971）：
```js
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2', senderWrapper); // 请求 WebGL 2.0 上下文
if (!gl) throw new Error('webgl2 not supported');

// 编译默认着色器程序
const vertexShader = createShader(gl.VERTEX_SHADER, vertexSrc);   // 顶点着色器
const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragSrc); // 片元着色器
const program = createProgram(vertexShader, fragmentShader);

canvas.addEventListener('webglcontextlost', () => {
  // 上下文丢失，触发销毁和错误上报
  this.destroy(new RtcError({ code: VIDEO_MANAGER_ERROR, extraCode: 4 }));
});
```

**顶点着色器**（L25961）：
```glsl
attribute vec4 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = a_position;
  v_texCoord = a_texCoord;
}
```

**片元着色器**（L25965）：
```glsl
precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_texture;
void main() {
  gl_FragColor = texture2D(u_texture, v_texCoord);
}
```

**渲染流程**（L24906-25191）：
```
1. createTexture() → texImage2D()     // 上传视频帧到 GPU 纹理
2. bindFramebuffer()                   // 绑定帧缓冲（离屏渲染）
3. useProgram()                        // 激活着色器程序
4. bindBuffer() + bufferData()        // 上传顶点数据（矩形顶点+纹理坐标）
5. vertexAttribPointer() + enableVertexAttribArray()
6. activeTexture() + bindTexture()    // 绑定输入纹理
7. uniform1i(getUniformLocation)      // 设置 Uniform 变量
8. drawArrays(TRIANGLE_STRIP, 0, 4)   // 绘制全屏矩形
```

**YUV→RGB 转换**（L43506-43560）：视频帧以 YUV 格式上传为 3 个独立纹理（Y/U/V 平面），通过自定义片元着色器完成颜色空间转换。

**虚拟背景**（L43207-43313）：
- 使用多个纹理单元：`TEXTURE0`（原视频）、`TEXTURE1`（遮罩/Mask）、`TEXTURE2`（背景/BG）、`TEXTURE3`（水印）
- 多次 `activeTexture()` + `bindTexture()` + `uniform1i()` 组合设置

### 4.3 OffscreenCanvas — Worker 内渲染

**功能**：在 Web Worker 中进行离屏渲染，避免主线程阻塞。

**使用场景**：
- **VideoImageSource** 初始化：优先使用 `new OffscreenCanvas(w, h)`，降级到 `document.createElement('canvas')`（L24897-24901）
- **黑帧检测 Worker**：`new OffscreenCanvas(codedWidth, codedHeight)` → `getContext('2d')` → `drawImage(videoFrame)` → `getImageData()` 分析像素（L47598）
- 与主线程 Canvas 的条件判断：`instanceof OffscreenCanvas`（L25626）

### 4.4 `HTMLVideoElement.requestVideoFrameCallback()`

**功能**：精确的视频帧回调，替代 `requestAnimationFrame` 用于视频渲染。

**使用**（L18412-18416, L25601）：
```js
element.requestVideoFrameCallback((now, metadata) => {
  // metadata: { presentationTime, expectedDisplayTime, width, height, mediaTime }
  // 在帧可用时立即渲染，而不是等待下一个 rAF
  renderFrame();
});
```

---

## 五、HTML 媒体元素 API

### 5.1 视频播放器（VideoPlayer, L18102+）

**功能**：SDK 的视频渲染播放器，封装 `<video>` 元素。

```js
// 创建 video 元素
const videoEl = document.createElement('video');
videoEl.srcObject = new MediaStream([videoTrack]);  // 绑定远端/本地视频轨道
videoEl.muted = true;                                // 静音（防止自动播放策略阻止）
videoEl.autoplay = true;
videoEl.playsInline = true;                          // iOS 内联播放
videoEl.setAttribute('playsinline', '');

// 播放（处理自动播放策略）
videoEl.play().then(() => { /* 播放成功 */ })
  .catch(() => { /* 播放失败，监听 click 后恢复 */ });

// 全屏控制
videoEl.requestFullscreen();
```

### 5.2 音频播放器（AudioPlayer, L18542+）

**功能**：本地音频监听和远端音频播放。

```js
audioEl.srcObject = new MediaStream([audioTrack]);
audioEl.volume = volumeLevel;  // 0-1
// 音频输出设备切换（Chrome 特性）
await audioEl.setSinkId(speakerDeviceId);
```

---

## 六、网络请求 API

### 6.1 WebSocket — 信令连接

**功能**：建立与 TRTC 信令服务器的长连接，传输 SDP、ICE 候选、房间事件等控制消息。

**连接建立**（L36901-36926）：
```js
connectWS({ url, timeout, isMain }) {
  const ws = new WebSocket(url);    // wss://signaling.domain.com/v2/ws?params...

  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve(ws);
    ws.onclose = reject;
    ws.onerror = reject;
    if (timeout) {
      timer = setTimeout(() => {
        unbindAndCloseSocket(isMain ? 'MAIN' : 'BACKUP');
        reject(new RtcError({ code: SIGNAL_CHANNEL_SETUP_FAILED, message: 'ws connect timeout' }));
      }, timeout);
    }
  }).finally(() => {
    ws.onclose = ws.onerror = ws.onopen = null;  // 清理事件监听
    clearTimeout(timer);
  });
}
```

**双通道竞速连接**（L36888-36895）：
```js
// 同时连接主域名和备份域名，取先返回的
const connections = [
  connectWS({ url: mainUrl, isMain: true, timeout: 10000 }),
  connectWS({ url: backupUrl, isMain: false, timeout: 10000 })
];
this._socketInUse = await promiseAny(connections);  // 取最先成功的
// 关闭另一个（慢的）
unbindAndCloseSocket(slowSocket);
```

**心跳保活**：通过定时发送 ping 消息维持连接，超时无消息判定为 offline（L36863）。

### 6.2 fetch / XMLHttpRequest — HTTP 请求

**功能**：用于日志上报、远程配置拉取、WASM 文件下载等。

**fetch 优先降级 XHR**（L12927-12941）：
```js
function sendHttpRequest(url, options) {
  if ('fetch' in window) {
    return fetch(url, { method: options.method, body: options.body, priority: 'low' });
  }
  // 降级到 XMLHttpRequest
  const xhr = new XMLHttpRequest();
  xhr.open(options.method, url);
  // ... set headers, send body
}
```

**WASM 下载**（L31096-31108）：`fetch(wasmUrl)` → `WebAssembly.instantiateStreaming(response, importObject)`

### 6.3 `navigator.sendBeacon()`

**功能**：页面卸载时可靠地发送日志/统计数据。

```js
// 优先使用 sendBeacon（不阻塞页面关闭），降级到 fetch
if (navigator.sendBeacon) {
  navigator.sendBeacon(url, blobOrData);
} else {
  fetch(url, { method: 'POST', body: data, keepalive: true });
}
```

---

## 七、Web Workers

### 7.1 ScriptTransform Worker — 编码帧处理

**功能**：在 Worker 线程中使用 `RTCRtpScriptTransform` 处理编码帧（SEI 注入/读取）。

**创建流程**（L46086-46141）：
```js
// 1. 将视频/音频编解码管线函数序列化为源码字符串
const workerCode = `(() => {
  // 编解码管线函数定义
  const videoEncodePipeline = [...];
  const audioDecodePipeline = [...];

  // 处理主线程发来的消息
  self.onmessage = (e) => { /* 处理 SEI payload */ };

  // WebRTC Encoded Transform 入口
  self.onrtctransform = (event) => {
    const transformer = event.transformer;
    const { readable, writable } = transformer;
    // readable → TransformStream(注入/提取 SEI) → writable
  };
})()`;

// 2. 创建 Blob URL → Worker
const blob = new Blob([workerCode], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
this.scriptTransformWorker = new Worker(url);
URL.revokeObjectURL(url);
```

**Worker 中使用 `self.onrtctransform`**：WebRTC 专用 API，在 Worker 中处理编码帧的 ReadableStream/WritableStream。

### 7.2 黑帧检测 Worker

**功能**：在独立 Worker 中通过 `OffscreenCanvas` + `VideoFrame` 检测视频是否黑屏。

**核心逻辑**（L47598）：
```js
// Worker 代码中
async function isFrameBlack(trackId) {
  const { value: frame, done } = await reader.read();  // VideoFrame from MediaStreamTrackProcessor
  if (!frame || done) return false;

  // OffscreenCanvas 离屏渲染
  canvas = new OffscreenCanvas(frame.codedWidth, frame.codedHeight);
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);

  // 采样 100 个随机像素，判断黑帧比例
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const blackRatio = getFrameBlackRatio(imageData);
  frame.close();
  return blackRatio === 1;  // 100% 黑色像素 = 黑帧
}
```

### 7.3 共享定时器 Worker

**功能**：在 Worker 中使用 `setInterval` 实现页面不可见时仍能执行的定时器（`requestIdleCallback` 背后的实现）。

**Worker 代码**（L17068）：
```js
self.onmessage = function(e) {
  const { type, taskId, delay } = e.data;
  if (type === 'start') {
    timers.set(taskId, setInterval(() => {
      self.postMessage({ type: 'tick', taskId });
    }, delay));
  }
};
```

---

## 八、WebAssembly

**功能**：加载 WASM 模块用于 AI 降噪、美颜等高性能计算。

**加载流程**（L31087-31143）：
```js
async function loadWasm(url, importObject) {
  const startTime = performance.now();
  let instance = null;

  // 优先：流式实例化（边下载边编译）
  if (WebAssembly.instantiateStreaming && !url.startsWith('data:') && !isFileProtocol()) {
    try {
      const response = fetch(url);
      instance = (await WebAssembly.instantiateStreaming(response, importObject)).instance;
    } catch {}
  }

  // 降级：完整下载后再实例化
  if (!instance) {
    const arrayBuffer = await download(url, { type: 'arraybuffer' });
    instance = (await WebAssembly.instantiate(arrayBuffer, importObject)).instance;
  }

  const cost = performance.now() - startTime;
  reportStream.addSuccessEvent({ key: 522701, cost });  // 上报加载耗时
  return instance;
}
```

**WASM SIMD 检测**（L16411-16421）：
```js
function isWasmSimdSupported() {
  return typeof WebAssembly !== 'undefined' &&
    WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]));
}
```

---

## 九、WebCodecs API

### 9.1 能力检测

```js
function checkWebCodecsSupport() {
  return {
    AudioDecoder: !isUndefined(window.AudioDecoder),
    AudioEncoder: !isUndefined(window.AudioEncoder),
    VideoDecoder: !isUndefined(window.VideoDecoder),
    VideoEncoder: !isUndefined(window.VideoEncoder),
    ImageDecoder: !isUndefined(window.ImageDecoder)
  };
}
```

### 9.2 `EncodedAudioChunk` — 实际使用

**功能**：将收到的编码音频数据封装为 WebCodecs 可解码的 Chunk。

```js
// decoder.decode(new EncodedAudioChunk({
//   data: encodedData,        // ArrayBuffer 编码数据
//   timestamp: 0,             // 微秒时间戳
//   type: 'key'               // key / delta
// }))
```
使用于 WebCodecs 音频解码路径（L33749），用于将服务端下发的编码音频包解码为 PCM 数据。

---

## 十、存储 API

### 10.1 localStorage

**功能**：持久化存储 SDK 配置、能力检测结果、错误日志等。

```js
// 能力检测缓存（带过期时间）
localStorage.setItem(`checkResult${ttl}`, JSON.stringify({
  ua: navigator.userAgent,
  checkResult: capabilityResult
}));

// 读取缓存
const cached = JSON.parse(localStorage.getItem(`checkResult${ttl}`));
if (cached && cached.ua === navigator.userAgent) {
  // 命中缓存，跳过重复检测
}
```

**日志队列**（L14188-14281）：本地日志缓存队列，通过 `localStorage` 持久化并在网络可用时批量上传。

### 10.2 sessionStorage

**功能**：仅用于存储调试开关（`TRTC_ENABLE_DEBUG_PLUGIN`、`TRTC_DEBUG_DIALOG_PATH`），不影响正常业务流程。

---

## 十一、Navigator API 详解

### 11.1 `navigator.userAgent` — 浏览器检测核心

**功能**：解析 UA 字符串，识别浏览器类型/版本/操作系统，驱动后续的 adapter 选择和能力判断。

**支持的浏览器/环境**（L15676-15697）：
```
Firefox / Edge / Chrome Desktop / Safari / TBS (腾讯浏览服务) / XWEB /
微信 (iPhone) / QQ浏览器 (Win) / QQ (Mobile/Mac/iPad) /
MIUI 浏览器 / 华为浏览器 / 三星浏览器 / OPPO 浏览器 / VIVO 浏览器 /
Edge Legacy / 搜狗 (Mobile/PC)
```

### 11.2 `navigator.userAgentData.getHighEntropyValues()` — UA Client Hints

**功能**：获取更详细的平台信息（品牌、型号、平台版本等），在支持的浏览器上替代 UA 解析。

```js
if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function') {
  const uaData = await navigator.userAgentData.getHighEntropyValues([
    'architecture', 'bitness', 'brands', 'fullVersionList',
    'model', 'platform', 'platformVersion'
  ]);
}
```

### 11.3 `navigator.connection.addEventListener('typechange')` — 网络监测

**功能**：监听网络类型切换（WiFi ↔ 4G ↔ 离线），触发信令重连或码率调整。

```js
const conn = navigator.connection;
conn.addEventListener('typechange', onNetworkTypeChange);
// typechange 回调中更新：networkType → 'wifi' | 'cellular' | 'ethernet' | 'unknown'
```

### 11.4 `navigator.permissions.query()`

**功能**：查询摄像头/麦克风权限状态，用于权限引导 UI。

```js
const cameraState = await navigator.permissions.query({ name: 'camera' });
cameraState.addEventListener('change', () => {
  // 权限状态变化（用户手动撤销/授予）
});
// cameraState.state: 'granted' | 'denied' | 'prompt'
```
使用于 L34079-34102，支持 camera 和 microphone 两种权限的查询与监听。

### 11.5 `navigator.mediaSession.setActionHandler()`

**功能**：响应媒体键（播放/暂停/上一首/下一首），用于通话控制集成。

```js
if ('mediaSession' in navigator && navigator.mediaSession.setActionHandler) {
  // 设置媒体会话操作处理
}
```

### 11.6 `navigator.hardwareConcurrency` / `navigator.maxTouchPoints`

- **hardwareConcurrency**：CP信用核数，用于日志上报和性能评估（L34271）
- **maxTouchPoints**：触摸点数，用于识别 iPad（`maxTouchPoints > 2 && UA 包含 Macintosh`，L13361）

---

## 十二、DOM API

**功能**：UI 元素创建、事件绑定、页面可见性检测。

### 12.1 元素创建

| 元素 | 用途 |
|------|------|
| `document.createElement('canvas')` | WebGL/2D 渲染 |
| `document.createElement('video')` | 视频播放器 |
| `document.createElement('div')` / `'button'` | 自动播放恢复弹窗 |
| `document.createElement('template')` | 弹窗 HTML 模板 |
| `document.createElement('style')` | 弹窗样式注入 |
| `document.createElement('script')` | 错误处理钩子注入 / 外部脚本加载 |

### 12.2 页面可见性追踪

**功能**：检测页面是否可见，影响编码帧率、渲染策略。

```js
// 可见性变化时调整编码帧率
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // 恢复帧率
  } else {
    // 降低帧率或暂停编码
  }
});

// 配合定时器：hidden 时使用低频率检查
if (document.hidden && task.isBackgroundTask) {
  // 使用 requestIdleCallback 仅在空闲时执行
}
```

---

## 十三、事件系统

### 13.1 自定义事件

```js
// 浏览器兼容性回调
window.dispatchEvent(new CustomEvent('TRTC_EVENT', { detail: payload }));
```

### 13.2 SDK 内部事件总线

SDK 有自己的 EventEmitter（L9695），基于 `EventEmitter` 模式实现，浏览器端的 `addEventListener`/`removeEventListener`/`dispatchEvent`/`CustomEvent` 主要用于：
- WebRTC adapter 层的 track/negotiationneeded/connectionstatechange 事件模拟
- 与浏览器原生事件体系的桥接

---

## 十四、定时器

| API | 用途 |
|-----|------|
| `setTimeout()` | 超时控制（连接超时、SDP 交换超时、自动播放检测）、延迟销毁、Promise 超时包装 |
| `setInterval()` | 心跳保活、定时日志上报、音频录制分段、黑帧检测轮询 |
| `requestAnimationFrame()` | 视频渲染循环、动画帧调度 |
| `requestIdleCallback()` | 后台低优先级任务（不可见时降低任务频率） |
| `queueMicrotask()` | 微任务调度（polyfill 引用） |

---

## 十五、编码与二进制

| API | 用途 |
|-----|------|
| `TextEncoder().encode(string)` | 字符串→UTF-8，用于信令签名（L11942-11988） |
| `TextDecoder().decode(buffer)` | 二进制→字符串，用于信令包解析（L11887, L47447） |
| `btoa()` / `atob()` | Base64 编解码，用于二进制消息传输（L49461, L49480） |
| `ArrayBuffer` + `DataView` | 二进制协议包构造/解析（L24098-24245, L32870-32964） |
| `Uint8Array` | 40+ 次，最常用的二进制操作数组 |
| `Float32Array` | WebGL 顶点/纹理坐标缓冲 + 音频 PCM 数据（L25106, L19152） |
| `Blob` + `URL.createObjectURL()` | Worker/Worklet 代码动态注入（L46135, L47596, L19005） |

---

## 十六、未使用（或仅能力检测）的 API

| API | 状态 |
|-----|------|
| `crypto.subtle` / `crypto.getRandomValues` / Web Crypto | **未使用**（加密在应用层自实现） |
| `MediaRecorder` | **未使用** |
| `decodeAudioData` | **未使用** |
| `IndexedDB` | **未使用** |
| `ServiceWorker` / `SharedWorker` | **未使用** |
| `EventSource` | **未使用** |
| `ResizeObserver` / `PerformanceObserver` | **未使用** |
| `WebTransport` | 仅能力检测 |
| `AudioDecoder` / `AudioEncoder` / `VideoDecoder` / `VideoEncoder` / `ImageDecoder` | 仅能力检测（`EncodedAudioChunk` 除外） |

---

## 十七、浏览器适配层概览（adapter.js 等价层，L6651-9308）

该层级为 Chrome/Firefox/Safari 提供完整的 API 差异垫片：

| 适配类型 | 覆盖范围 |
|----------|----------|
| EventTarget 垫片 | `addEventListener` / `removeEventListener` |
| MediaStream 垫片 | `webkitMediaStream` → `MediaStream` |
| ontrack 事件 | Chrome/Safari 通过 `addstream` 模拟；Firefox 修复 |
| getSenders / getReceivers | 旧 Chrome 通过 `createDTMFSender` 反向推导 |
| getStats Promise 化 | Chrome + Firefox 回调→Promise |
| addTrack/removeTrack | 统一 `addStream`/`removeStream` 语义 |
| setLocalDescription / setRemoteDescription | Promise 化 + 参数标准化 |
| addIceCandidate | 参数转换 |
| RTCSessionDescription / RTCIceCandidate | `new` 关键字标准化 |
| getDisplayMedia | Chrome/Firefox 适配 |
| getUserMedia 约束 | Firefox `moz*` ↔ 标准约束互转 |
| createOffer/createAnswer | Firefox 选项修复 |
| connectionState | `iceConnectionState` 映射模拟 |
| SDP Semantics | `plan-b` ↔ `unified-plan` 检测与适配 |

---

## 附录：完整 API 速查表

| API | 次数 | 典型用途 |
|-----|------|----------|
| `RTCPeerConnection` | 213 | 音视频通话核心连接 |
| `addTrack` / `removeTrack` / `replaceTrack` | 236 | 轨道管理 |
| `createOffer` / `createAnswer` / `setLocalDescription` / `setRemoteDescription` / `addIceCandidate` | 88 | SDP 协商 |
| `getSenders` / `getReceivers` / `getTransceivers` | ~80 | 发送/接收器查询 |
| `getStats` | ~30 | 通话质量统计 |
| `getUserMedia` | 28 | 摄像头/麦克风采集 |
| `getDisplayMedia` | ~10 | 屏幕共享采集 |
| `enumerateDevices` | 7 | 设备枚举 |
| `AudioContext` | 58 | 音频处理上下文 |
| `createMediaStreamSource` / `createMediaStreamDestination` | 4+3 | 音频流桥接 |
| `createAnalyser` / `getByteTimeDomainData` | 2+6 | 音量检测 |
| `createGain` | 5 | 音量控制 |
| `AudioWorklet` | 5 | Worker 线程音量检测 |
| `canvas.getContext('webgl2')` | 1 | WebGL 初始化 |
| `canvas.getContext('2d')` | 9 | 2D 绘制 |
| `canvas.captureStream` | 5 | 画布流捕获 |
| `OffscreenCanvas` | 7 | Worker 内离屏渲染 |
| `WebGL` 全套 API | ~80 | GPU 视频渲染（纹理/着色器/帧缓冲） |
| `new Worker()` | 3 | 编码帧处理/黑帧检测/共享定时器 |
| `WebAssembly.instantiateStreaming` | 1 | WASM 加载 |
| `EncodedAudioChunk` | 1 | WebCodecs 解码 |
| `WebSocket` | 18 | 信令长连接 |
| `fetch` | 10+ | HTTP 请求 |
| `localStorage` | 10+ | 持久化缓存 |
| `navigator.userAgent` | 22+ | 浏览器检测 |
| `performance.now()` | 3 | 高精度计时 |
| `requestAnimationFrame` | 4 | 渲染调度 |
| `setTimeout` / `setInterval` | 51+10 | 超时/定时 |
| `addEventListener` / `removeEventListener` | 39+ | 事件绑定 |
| `document.createElement` | ~20 | UI/DOM 创建 |
| `document.visibilityState` | 64+ | 页面可见性 |
| `URL.createObjectURL` / `revokeObjectURL` | 9+5 | Blob URL |
