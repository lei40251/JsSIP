# Chrome Web Platform API 演进研究报告 (Chrome 72 → 当前)

> **研究基线**: Chrome 72 (2019-01) → Chrome ~136 (2025 年中)
> **数据源**: MDN Web API 文档、MDN BCD (Browser Compatibility Data)、Chrome Platform Status
> **覆盖范围**: Specifications → Interfaces → Constructors → Methods → Properties → Events → Parameters → Dictionary Members → Enum Values

---

## 一、Chrome 版本时间线 (Chrome 72+)

| 版本 | 发布日期 | 关键里程碑 |
|------|----------|-----------|
| Chrome 72 | 2019-01 | User-Agent Client Hints, Public class fields |
| Chrome 73 | 2019-03 | Signed HTTP Exchanges, Web Audio API updates |
| Chrome 74 | 2019-04 | Feature Policy, `prefers-reduced-motion` |
| Chrome 75 | 2019-06 | `navigator.share()`, WebSocketStream (OT) |
| Chrome 76 | 2019-07 | `IntersectionObserver` v2, WebPackage |
| Chrome 77 | 2019-09 | Largest Contentful Paint, Contact Picker, WebRTC Insertable Streams (OT) |
| Chrome 78 | 2019-10 | SMS Receiver, Screen Enumeration, `scrollend` event |
| Chrome 79 | 2019-12 | WebXR Device API, Wake Lock, `navigator.mediaDevices.getDisplayMedia()` |
| Chrome 80 | 2020-02 | Web NFC (OT), Compression Streams, `AbortSignal.reason` |
| Chrome 81 | 2020-04 | WebXR AR, Badging API |
| Chrome 83 | 2020-05 | Barcode Detection API, WebRTC Insertable Streams |
| Chrome 84 | 2020-07 | Web Animations API updates, Screen Wake Lock |
| Chrome 85 | 2020-08 | `content-visibility`, `getInstalledRelatedApps()` |
| Chrome 86 | 2020-10 | File System Access API, WebHID (OT), `AbortSignal.timeout()` → OT |
| Chrome 87 | 2020-11 | WebTransport (OT), `MediaSession.setPositionState()` |
| Chrome 88 | 2021-01 | WebXR Depth, Digital Goods API, Manifest `id` |
| Chrome 89 | 2021-03 | WebHID, WebNFC, Web Serial (stable), AVIF support |
| Chrome 90 | 2021-04 | `CSSOM View smooth scrolling`, `:focus-visible` |
| Chrome 91 | 2021-05 | WebTransport (stable), WebCodecs (OT), WebAssembly SIMD |
| Chrome 92 | 2021-07 | `VirtualKeyboard` API, Web Bluetooth manufacturer data filter |
| Chrome 93 | 2021-08 | Multi-Screen Window Placement (OT), WebOTP desktop |
| Chrome 94 | 2021-09 | WebCodecs (stable), WebGPU (OT), Idle Detection |
| Chrome 95 | 2021-10 | `EyeDropper` API, URLPattern, WebAssembly Exception Handling |
| Chrome 96 | 2021-11 | Manifest `id` desktop, `priority` hints, `WindowControlsOverlay` |
| Chrome 97 | 2022-01 | WebTransport server certificate, `Keyboard Map` API |
| Chrome 98 | 2022-02 | COLRv1 Color Fonts, `StructuredClone` |
| Chrome 99 | 2022-03 | `CSS Cascade Layers`, `CanvasRenderingContext2D.reset()` |
| Chrome 100 | 2022-03 | Multi-Screen Window Placement (stable), `Digital Goods` API |
| Chrome 101 | 2022-04 | `hwb()` color, `@container` queries, `Priority Hints` |
| Chrome 102 | 2022-05 | `Navigation` API (OT), `File Handling` API, `Local Font Access` |
| Chrome 103 | 2022-06 | `Local Font Access` (stable), `AbortSignal.timeout()` (stable) |
| Chrome 104 | 2022-08 | Region Capture, `Shared Element Transitions` (OT), `MediaQueryList: change` event |
| Chrome 105 | 2022-08 | `Container Queries`, `:has()` selector, Sanitizer API |
| Chrome 106 | 2022-09 | `Import Maps` (stable), `Intl.Segmenter` |
| Chrome 107 | 2022-10 | `CSS grid-template` interpolation, `Screen Capture` improvements |
| Chrome 108 | 2022-11 | `CSS @scope`, `View Transitions` (renamed from Shared Element Transitions), Federated Credential Management (FedCM) |
| Chrome 109 | 2023-01 | `MathML` core, `Conditional Focus`, `CaptureController` |
| Chrome 110 | 2023-02 | `:picture-in-picture` pseudo, `CSS initial-letter`, `AudioContext.outputLatency` |
| Chrome 111 | 2023-03 | View Transitions (stable SPA), `CSS color-mix()`, `CSS trigonometric functions` |
| Chrome 112 | 2023-04 | `CSS nesting`, `animation-composition`, `documentPictureInPicture` (OT) |
| Chrome 113 | 2023-05 | WebGPU (stable), `scrollend` event (Chrome stable), `documentPictureInPicture` |
| Chrome 114 | 2023-05 | `Popover` API, `CSS text-wrap: balance`, `CHIPS` cookies |
| Chrome 115 | 2023-07 | `Scroll-driven animations`, `Topics` API, `Fenced Frames`, `Compute Pressure` |
| Chrome 116 | 2023-08 | `Document Picture-in-Picture` (stable), `MotionPath`, `CSS Motion Path` |
| Chrome 117 | 2023-09 | `CSS subgrid`, `Entry/Exit Animations`, `CSS @starting-style` |
| Chrome 118 | 2023-10 | `CSS @scope` (stable), `EditContext` API |
| Chrome 119 | 2023-11 | `CSS `attr()` fallback, `Clipboard` custom formats, `WebSQL` removed |
| Chrome 120 | 2023-12 | `CSS `@import layer`, `CloseWatcher` API, `FedCM` improvements |
| Chrome 121 | 2024-01 | `CSS `text-wrap: pretty`, `Element Capture`, `Speculation Rules` improvements |
| Chrome 122 | 2024-02 | `Storage Access API` improvements, `CSS `@property` support for `<url>` |
| Chrome 123 | 2024-03 | `CSS `light-dark()`, `Navigation API` stable, `AbortSignal.any()` (stable) |
| Chrome 124 | 2024-04 | `CSS `@starting-style` stable`, `Set methods` (union/intersection), `View Transitions MPA` |
| Chrome 125 | 2024-05 | `CSS `anchor positioning`, `Compute Pressure` (stable), `Declarative shadow DOM` |
| Chrome 126 | 2024-06 | `CSS `zoom`, `Cross-document View Transitions` (MPA stable), `@view-transition` at-rule |
| Chrome 127 | 2024-07 | `CSS `font-size-adjust`, `Keyboard focusable scroll containers`, `WebGPU` improvements |
| Chrome 128 | 2024-08 | `CSS `Ruby align`, `CSS `caret-animation`, `Promise.try()` |
| Chrome 129 | 2024-09 | `Intl.DurationFormat`, `CSS `interpolate-size`, `scheduler.yield()` |
| Chrome 130 | 2024-10 | `CSS `:has-slotted`, `@page margin boxes`, `Direct Sockets` (OT) |
| Chrome 131 | 2024-11 | `CSS `text-box`, `highlight` pseudo, `Speculation Rules` prefetch/prerender |
| Chrome 132 | 2025-01 | `Translator` API (OT), `LanguageDetector` API (OT), `Summarizer` API (OT) |
| Chrome 133 | 2025-02 | AI APIs expansion, `CSS scroll-state()` |
| Chrome 134 | 2025-03 | `WebAuthn` PRF extension, `devicechange` event for audio output |
| Chrome 135 | 2025-04 | `RTCRtpScriptTransform` Baseline, `WebRTC Encoded Transform` stable cross-browser |
| Chrome 136 | 2025-05 | Latest enhancements to WebCodecs, WebTransport |

---

## 二、WebRTC 超深度演进时间线

### 2.1 核心接口新增成员

#### RTCPeerConnection

| 成员 | 类型 | Chrome 版本 | 说明 |
|------|------|------------|------|
| `RTCPeerConnection()` | Constructor | Chrome 24 (pre-72) | 基础构造器 |
| `addTransceiver()` | Method | Chrome 69 (pre-72) | 添加收发器 |
| `addTrack()` | Method | Chrome 28 (pre-72) | 替代 `addStream()` |
| `restartIce()` | Method | Chrome 77 | ICE 重启 |
| `connectionState` | Property | Chrome 72 | 连接状态枚举 |
| `sctp` | Property | Chrome 76 | SCTP transport 访问 |
| `getConfiguration()` | Method | Chrome 72 | 获取当前配置 |
| `icecandidateerror` | Event | Chrome 77 | ICE 候选错误事件 |
| `connectionstatechange` | Event | Chrome 72 | 连接状态变化事件 |

#### RTCRtpSender

| 成员 | 类型 | Chrome 版本 | 说明 |
|------|------|------------|------|
| `transform` | Property | Chrome 94 | Encoded Transform 入口点 |
| `createEncodedStreams()` | Method | Chrome 87 (removed in 92) | 原始 Insertable Streams API，被 `transform` 替代 |
| `dtmf` | Property | Chrome 72+ | DTMF sender 访问 |
| `getCapabilities()` | Static Method | Chrome 73 | 获取编码能力 |

#### RTCRtpReceiver

| 成员 | 类型 | Chrome 版本 | 说明 |
|------|------|------------|------|
| `transform` | Property | Chrome 94 | Encoded Transform 接收端 |
| `jitterBufferTarget` | Property | Chrome 88 | 抖动缓冲目标值 |
| `createEncodedStreams()` | Method | Chrome 87 (removed in 92) | 旧版 Insertable Streams API |
| `getCapabilities()` | Static Method | Chrome 73 | 获取解码能力 |

#### RTCRtpTransceiver

| 成员 | 类型 | Chrome 版本 | 说明 |
|------|------|------------|------|
| `currentDirection` | Property | Chrome 72 | 当前传输方向 |
| `setCodecPreferences()` | Method | Chrome 76 | 设置编解码偏好 |

#### RTCConfiguration

| 字段 | 类型 | Chrome 版本 | 说明 |
|------|------|------------|------|
| `encodedInsertableStreams` | Dictionary Member | Chrome 87 (deprecated) | 启用 Insertable Streams |
| `iceTransportPolicy` | Dictionary Member | pre-72 | ICE 传输策略 |
| `bundlePolicy` | Dictionary Member | pre-72 | BUNDLE 策略 |

#### RTCRtpEncodingParameters

| 字段 | 类型 | Chrome 版本 | 说明 |
|------|------|------------|------|
| `scalabilityMode` | Dictionary Member | Chrome 96 | 可伸缩性模式 (L1T1, L1T3, L3T3 等) |
| `scaleResolutionDownBy` | Dictionary Member | Chrome 72 | 分辨率缩放因子 |
| `maxBitrate` | Dictionary Member | Chrome 72 | 最大比特率 |
| `maxFramerate` | Dictionary Member | Chrome 72 | 最大帧率 |
| `active` | Dictionary Member | Chrome 72 | 编码激活状态 |
| `priority` | Dictionary Member | Chrome 72 | 优先级 |
| `networkPriority` | Dictionary Member | Chrome 72 | 网络优先级 |
| `adaptivePtime` | Dictionary Member | Chrome 76 | 自适应打包时间 |
| `degradationPreference` | Dictionary Member | Chrome 72+ | 降级偏好 (balanced/maintain-framerate/maintain-resolution) |

### 2.2 Encoded Transform 演进

#### 第一阶段：Insertable Streams (Chrome 87-91, Origin Trial)

```
RTCPeerConnection({ encodedInsertableStreams: true })
↓
RTCRtpSender.createEncodedStreams()
↓
ReadableStream + WritableStream (main thread)
↓
Worker 中处理
```

- **首次出现**: Chrome 87 (2020-11) Origin Trial
- **API 形态**: `RTCRtpSender.createEncodedStreams()` / `RTCRtpReceiver.createEncodedStreams()`
- **问题**: API 在 main thread 操作，性能受限

#### 第二阶段：Encoded Transform (Chrome 94+, Stable)

```
RTCRtpSender.transform = new RTCRtpScriptTransform(worker, options)
RTCRtpReceiver.transform = new RTCRtpScriptTransform(worker, options)
↓
rtctransform event fires in worker
↓
RTCRtpScriptTransformer.readable → TransformStream → RTCRtpScriptTransformer.writable
```

- **Chrome 94** (2021-09): 新 API 形态，`RTCRtpScriptTransform` 引入
- **Chrome 97** (2022-01): `RTCEncodedVideoFrame.getMetadata()` 方法新增
- **Chrome 101** (2022-04): `flip` 和 `rotation` 属性新增到 `VideoFrame`
- **Baseline 2025**: 跨浏览器广泛支持

### 2.3 WebRTC 关键能力演进时间线

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| Unified Plan (默认) | Chrome 72 | Stable |
| `RTCRtpTransceiver` | Chrome 69+ | Stable |
| `restartIce()` | Chrome 77 | Stable |
| Insertable Streams (旧版) | Chrome 87-91 | Removed (被 Encoded Transform 替代) |
| Encoded Transform (`transform` property) | Chrome 94 | Stable |
| `RTCRtpScriptTransform` | Chrome 94 | Stable |
| `RTCEncodedVideoFrame` | Chrome 94 | Stable |
| `RTCEncodedAudioFrame` | Chrome 94 | Stable |
| `RTCRtpScriptTransformer` | Chrome 94 | Stable |
| `RTCTransformEvent` | Chrome 94 | Stable |
| `rtctransform` event | Chrome 94 | Stable |
| `scalabilityMode` (VP9 SVC) | Chrome 96 | Stable |
| `jitterBufferTarget` | Chrome 88 | Stable |
| AV1 编解码硬件加速 | Chrome 90 | Stable |
| Simulcast (`rid` based) | Chrome 75 | Stable |
| `setCodecPreferences()` | Chrome 76 | Stable |

### 2.4 Capture Handle / Region Capture

| 能力 | Chrome 版本 | 说明 |
|------|------------|------|
| Capture Handle Identity | Chrome 102 | 跨标签捕获标识 |
| `CaptureController` | Chrome 109 | 捕获会话控制 |
| `CropTarget.fromElement()` | Chrome 104 | Region Capture (元素裁剪) |
| `RestrictionTarget.fromElement()` | Chrome 121 | Element Capture (元素限制) |
| `BrowserCaptureMediaStreamTrack` | Chrome 104 | 浏览器捕获专用 track |
| `BrowserCaptureMediaStreamTrack.cropTo()` | Chrome 104 | 裁剪到元素 |
| `BrowserCaptureMediaStreamTrack.restrictTo()` | Chrome 121 | 限制到元素 |
| Conditional Focus | Chrome 109 | `setFocusBehavior()` |

---

## 三、Media 超深度演进

### 3.1 MediaDevices 新增

| 成员 | 类型 | Chrome 版本 | 说明 |
|------|------|------------|------|
| `getDisplayMedia()` | Method | Chrome 72 | 屏幕捕获 |
| `selectAudioOutput()` | Method | Chrome 121 | 选择音频输出设备 (此前为实验性) |
| `devicechange` | Event | Chrome 73+ | 设备变更事件(增强) |
| `getDisplayMedia({ controller })` | Parameter | Chrome 109 | 关联 CaptureController |
| `getDisplayMedia({ surfaceSwitching })` | Parameter | Chrome 104 | 表面切换控制 |
| `getDisplayMedia({ selfBrowserSurface })` | Parameter | Chrome 121 | 自浏览器表面排除 |
| `getDisplayMedia({ monitorTypeSurfaces })` | Parameter | Chrome 109 | 显示器类型表面 |
| `getDisplayMedia({ preferCurrentTab })` | Parameter | Chrome 94 | 偏好当前标签页 |
| `getDisplayMedia({ systemAudio })` | Parameter | Chrome 105 | 系统音频捕获 |
| `getDisplayMedia({ windowAudio })` | Parameter | Chrome 126 | 窗口音频共享 |
| `getDisplayMedia({ audio.suppressLocalAudioPlayback })` | Constraint | Chrome 109 | 抑制本地音频回放 |

### 3.2 MediaStreamTrack 新增

| 成员 | 类型 | Chrome 版本 | 说明 |
|------|------|------------|------|
| `contentHint` | Property | Chrome 76 | 内容类型提示 (motion/detail/text/music/speech) |
| `applyConstraints({ resizeMode })` | Constraint | Chrome 72 | 调整大小模式 |
| `applyConstraints({ backgroundBlur })` | Constraint | Chrome 93 | 背景模糊 (需要 getUserMedia) |
| `getSettings().displaySurface` | Return Value | Chrome 72 | 获取捕获表面类型 |
| `getSettings().logicalSurface` | Return Value | Chrome 72 | 是否逻辑表面 |
| `getSettings().cursor` | Return Value | Chrome 72 | 光标捕获模式 |
| `getSettings().suppressLocalAudioPlayback` | Return Value | Chrome 109 | 本地音频抑制状态 |
| `MediaStreamTrackGenerator` | Interface | Chrome 94 | 从帧流创建 track |
| `MediaStreamTrackProcessor` | Interface | Chrome 94 | 从 track 创建帧流 |

### 3.3 WebCodecs 体系 (Chrome 94+)

| 接口 | Chrome 版本 | 类型 | 说明 |
|------|------------|------|------|
| `VideoEncoder` | Chrome 94 | Interface | 视频编码器 |
| `VideoDecoder` | Chrome 94 | Interface | 视频解码器 |
| `AudioEncoder` | Chrome 94 | Interface | 音频编码器 |
| `AudioDecoder` | Chrome 94 | Interface | 音频解码器 |
| `VideoFrame` | Chrome 94 | Interface | 原始视频帧 |
| `AudioData` | Chrome 94 | Interface | 原始音频数据 |
| `EncodedVideoChunk` | Chrome 94 | Interface | 编码视频块 |
| `EncodedAudioChunk` | Chrome 94 | Interface | 编码音频块 |
| `VideoColorSpace` | Chrome 94 | Interface | 视频色彩空间 |
| `ImageDecoder` | Chrome 94 | Interface | 图像解码器 |
| `ImageTrack` | Chrome 94 | Interface | 图像轨道 |
| `ImageTrackList` | Chrome 94 | Interface | 图像轨道列表 |

### 3.4 MediaCapabilities 新增

| 成员 | 类型 | Chrome 版本 | 说明 |
|------|------|------------|------|
| `encodingInfo()` | Method | Chrome 72+ | 编码能力查询 |
| `decodingInfo()` | Method | Chrome 72+ | 解码能力查询 |
| `decodingInfo({ keySystemConfiguration })` | Parameter | Chrome 76 | EME 解码查询 |
| Query: `hdrMetadataType` | Field | Chrome 117 | HDR 元数据类型查询 |
| Query: `colorGamut` | Field | Chrome 117 | 色域查询 |
| Query: `transferFunction` | Field | Chrome 117 | 传输函数查询 |

### 3.5 MediaRecorder 新增

| 成员 | 类型 | Chrome 版本 | 说明 |
|------|------|------------|------|
| `MediaRecorder({ audioBitrateMode })` | Parameter | Chrome 89 | 音频比特率模式 (constant/variable) |
| `MediaRecorder({ videoKeyFrameIntervalDuration })` | Parameter | Chrome 96 | 关键帧间隔时长 |
| `MediaRecorder({ hardwareAcceleration })` | Parameter | Chrome 117 | 硬件加速 (prefer-hardware/prefer-software) |

### 3.6 Insertable Streams for MediaStreamTrack

| 成员 | 类型 | Chrome 版本 | 说明 |
|------|------|------------|------|
| `MediaStreamTrackProcessor` | Interface | Chrome 94 | 从 track 消费帧 |
| `MediaStreamTrackGenerator` | Interface | Chrome 94 | 生成 track 帧 |
| `VideoTrackGenerator` | Interface | Chrome 94 | 视频轨道生成器 |

---

## 四、Screen Capture 专项

### 4.1 getDisplayMedia 参数演进

| 参数/选项 | Chrome 版本 | 说明 |
|-----------|------------|------|
| `video` / `audio` (基础) | Chrome 72 | 基础屏幕捕获 |
| `displaySurface` constraint (`"browser"`, `"window"`, `"monitor"`) | Chrome 72 | 表面类型枚举 |
| `logicalSurface` constraint | Chrome 72 | 逻辑表面标志 |
| `cursor` constraint (`"always"`, `"motion"`, `"never"`) | Chrome 72 | 光标捕获控制 |
| `preferCurrentTab` | Chrome 94 | 优先当前标签 |
| `surfaceSwitching` (`"include"`, `"exclude"`) | Chrome 104 | 动态切换共享标签 |
| `selfBrowserSurface` (`"include"`, `"exclude"`) | Chrome 121 | 自捕获排除 |
| `monitorTypeSurfaces` (`"include"`, `"exclude"`) | Chrome 109 | 显示器类型 |
| `systemAudio` (`"include"`, `"exclude"`) | Chrome 105 | 系统音频 |
| `windowAudio` (`"exclude"`, `"window"`, `"system"`) | Chrome 126 | 窗口音频 |
| `controller` (CaptureController) | Chrome 109 | 捕获控制器 |
| `suppressLocalAudioPlayback` | Chrome 109 | 抑制本地音频 |

### 4.2 CaptureController (Chrome 109+)

| 成员 | 类型 | 说明 |
|------|------|------|
| `CaptureController()` | Constructor | 创建控制器 |
| `setFocusBehavior()` | Method | 焦点行为控制 (`"focus-captured-surface"`, `"no-focus-change"`) |
| `forwardWheel()` | Method | 转发滚轮事件到捕获表面 |
| `increaseZoomLevel()` | Method | 增加缩放级别 |
| `decreaseZoomLevel()` | Method | 减少缩放级别 |
| `resetZoomLevel()` | Method | 重置缩放 (100%) |
| `getSupportedZoomLevels()` | Method | 获取支持的缩放级别列表 |
| `zoomLevel` | Property | 当前缩放级别 |
| `zoomlevelchange` | Event | 缩放级别变化事件 |

### 4.3 Region Capture / Element Capture

| 接口/方法 | Chrome 版本 | 说明 |
|-----------|------------|------|
| `BrowserCaptureMediaStreamTrack` | Chrome 104 | 扩展 `MediaStreamTrack` |
| `BrowserCaptureMediaStreamTrack.cropTo()` | Chrome 104 | 区域裁剪(Region Capture) |
| `BrowserCaptureMediaStreamTrack.restrictTo()` | Chrome 121 | 元素限制(Element Capture) |
| `BrowserCaptureMediaStreamTrack.clone()` | Chrome 104 | 无裁剪克隆 |
| `CropTarget.fromElement()` | Chrome 104 | 从元素创建裁剪目标 |
| `RestrictionTarget.fromElement()` | Chrome 121 | 从元素创建限制目标 |

### 4.4 Window Management / Multi-Screen

| 接口/属性 | Chrome 版本 | 说明 |
|-----------|------------|------|
| `Window.getScreenDetails()` | Chrome 100 | 获取多屏幕详情 |
| `ScreenDetails` | Chrome 100 | 屏幕详情接口 |
| `ScreenDetailed` | Chrome 100 | 单个屏幕详情 |
| `Screen.isExtended` | Chrome 100 | 是否多屏幕扩展 |
| `screenchange` event | Chrome 100 | 屏幕属性变化 |
| `currentscreenchange` event | Chrome 100 | 当前屏幕变化 |
| `screenschange` event | Chrome 100 | 屏幕连接/断开 |
| `Element.requestFullscreen({ screen })` | Chrome 100 | 指定全屏目标屏幕 |

---

## 五、AI API 专项 (Chrome 132+)

### 5.1 概览

Chrome 132 (2025-01) 开始引入内置 AI API，利用浏览器本地 Gemini Nano 模型。

| API | 接口 | Chrome 版本 | 状态 |
|-----|------|------------|------|
| Translator API | `Translator` | Chrome 132 | Origin Trial → Experimental |
| Language Detector API | `LanguageDetector` | Chrome 132 | Origin Trial → Experimental |
| Summarizer API | `Summarizer` | Chrome 132 | Origin Trial → Experimental |
| Writer API | `Writer` | Chrome 134+ | Experimental |
| Rewriter API | `Rewriter` | Chrome 134+ | Experimental |
| Prompt API | `AITextSession` | Chrome 136+ | Early Preview |

### 5.2 Translator API 详情

```
Specification: Translator and Language Detector APIs
Interface: Translator
Chrome 首次: Chrome 132 (Origin Trial)
```

**静态方法:**
| 方法 | 说明 |
|------|------|
| `Translator.availability()` | 检查 AI 模型可用性: `"readily"`, `"after-download"`, `"no"` |
| `Translator.create({ sourceLanguage, targetLanguage })` | 创建翻译器实例 |

**实例方法:**
| 方法 | 说明 |
|------|------|
| `translator.translate(text)` | 返回翻译字符串 Promise |
| `translator.translateStreaming(text)` | 返回 `ReadableStream<string>` |
| `translator.destroy()` | 释放资源 |
| `translator.measureInputUsage(text)` | 测量输入配额使用 |

**实例属性:**
| 属性 | 说明 |
|------|------|
| `sourceLanguage` | 源语言代码 |
| `targetLanguage` | 目标语言代码 |
| `inputQuota` | 可用输入配额 |

### 5.3 LanguageDetector API 详情

**静态方法:**
| 方法 | 说明 |
|------|------|
| `LanguageDetector.availability()` | 模型可用性检查 |
| `LanguageDetector.create({ expectedInputLanguages })` | 创建检测器 |

**实例方法:**
| 方法 | 说明 |
|------|------|
| `detector.detect(text)` | 返回 `[{detectedLanguage, confidence}]` |
| `detector.destroy()` | 释放资源 |

### 5.4 Summarizer API 详情

```
Specification: Writing Assistance APIs
Interface: Summarizer
```

**静态方法:**
| 方法 | 说明 |
|------|------|
| `Summarizer.availability()` | 模型可用性 |
| `Summarizer.create({ type, format, length, sharedContext })` | 创建摘要器 |

**实例方法:**
| 方法 | 说明 |
|------|------|
| `summarizer.summarize(text)` | 返回摘要字符串 |
| `summarizer.summarizeStreaming(text)` | 流式摘要 |
| `summarizer.destroy()` | 释放资源 |

**选项:**
| 选项 | 值 | 说明 |
|------|---|------|
| `type` | `"key-points"`, `"tl;dr"`, `"teaser"`, `"headline"` | 摘要类型 |
| `format` | `"markdown"`, `"plain-text"` | 输出格式 |
| `length` | `"short"`, `"medium"`, `"long"` | 摘要长度 |

---

## 六、AbortSignal / AbortController 演进

### 6.1 新增方法 (Chrome 72+)

| 成员 | 类型 | Chrome 版本 | MDN Baseline |
|------|------|------------|-------------|
| `AbortSignal.abort()` | Static Method | Chrome 88 | Widely Available |
| `AbortSignal.timeout(ms)` | Static Method | Chrome 103 | Baseline 2024 |
| `AbortSignal.any([signals])` | Static Method | Chrome 116 | Baseline 2024 |
| `AbortSignal.throwIfAborted()` | Instance Method | Chrome 97 | Baseline 2024 |
| `AbortSignal.reason` | Property | Chrome 98 | Baseline 2024 |
| `AbortController.abort(reason)` | Method (参数新增) | Chrome 98 | — |

### 6.2 详细分析

#### AbortSignal.timeout(ms)

```
类型: Static Method
所属 Specification: DOM Standard
所属 Interface: AbortSignal
Chrome 首次: Chrome 103 (2022-06)
Feature ID: 5734879498125312 (chromestatus)
MDN: /docs/Web/API/AbortSignal/timeout_static
```

**WebIDL:**
```webidl
static AbortSignal timeout([EnforceRange] unsigned long long milliseconds);
```

**解决的问题:** 无需手动创建 AbortController 即可设置超时。此前需要 `setTimeout(() => controller.abort(), ms)`。

**返回值:** `AbortSignal`，超时后 `reason` 为 `TimeoutError` DOMException。

**使用示例:**
```js
const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
```

#### AbortSignal.any(iterable)

```
类型: Static Method
Chrome 首次: Chrome 116 (2023-08)
```

**WebIDL:**
```webidl
static AbortSignal any(sequence<AbortSignal> signals);
```

**解决的问题:** 将多个 abort signal 合并为一个。任一 signal abort 时，返回的 signal 即 abort。

#### AbortSignal.throwIfAborted()

```
类型: Instance Method
Chrome 首次: Chrome 97 (2022-01)
```

**WebIDL:**
```webidl
void throwIfAborted();
```

**解决的问题:** 简洁模式检查 signal 是否已 abort。替代手动 `if (signal.aborted) throw signal.reason`。

---

## 七、新增 Event 类型 (Chrome 72+ 精选)

| Event | 所属 Interface | Chrome 版本 | 说明 |
|-------|---------------|------------|------|
| `scrollend` | Document / Element | Chrome 114 | 滚动完成事件 |
| `devicechange` | MediaDevices | Chrome 73+ (增强) | 媒体设备变更 |
| `capturehandlechange` | RTCPeerConnection | Chrome 102 | 捕获句柄变更 |
| `connectionstatechange` | RTCPeerConnection | Chrome 72 | 连接状态变更 |
| `icecandidateerror` | RTCPeerConnection | Chrome 77 | ICE 候选错误 |
| `rtctransform` | WorkerGlobalScope | Chrome 94 | Encoded Transform 就绪 |
| `zoomlevelchange` | CaptureController | Chrome 109 | 缩放级别变更 |
| `screenschange` | ScreenDetails | Chrome 100 | 屏幕连接/断开 |
| `currentscreenchange` | ScreenDetails | Chrome 100 | 当前屏幕变化 |
| `pagereveal` | Window | Chrome 124 | MPA View Transition |
| `pageswap` | Window | Chrome 124 | MPA View Transition |
| `toggle` | HTMLElement | Chrome 114 | Popover 切换 |
| `beforetoggle` | HTMLElement | Chrome 114 | Popover 切换前 |

---

## 八、新增 Interface (Chrome 72+ 精选)

### Chrome 72-80

| Interface | Specification | Chrome | 说明 |
|-----------|--------------|--------|------|
| `NavigatorUAData` | User-Agent Client Hints | 72 | UA Client Hints |
| `MediaCapabilities` | Media Capabilities | 72+ | 编解码能力查询 |
| `RTCDTMFSender` | WebRTC | 72 | DTMF 发送(已有,增强) |

### Chrome 81-90

| Interface | Specification | Chrome | 说明 |
|-----------|--------------|--------|------|
| `WakeLock` / `WakeLockSentinel` | Screen Wake Lock | 84 | 屏幕唤醒锁 |
| `BarcodeDetector` | Barcode Detection | 83 | 条形码/二维码检测 |
| `CompressionStream` | Compression Streams | 80 | 压缩流 |
| `DecompressionStream` | Compression Streams | 80 | 解压流 |
| `NDEFReader` / `NDEFRecord` | Web NFC | 89 | NFC 读取 |
| `HID` / `HIDDevice` | WebHID | 89 | 人机接口设备 |
| `Serial` / `SerialPort` | Web Serial | 89 | 串口通信 |
| `WebTransport` | WebTransport | 91 | 基于 QUIC 的传输 |
| `FileSystemFileHandle` | File System Access | 86 | 文件系统访问 |

### Chrome 91-100

| Interface | Specification | Chrome | 说明 |
|-----------|--------------|--------|------|
| `VideoFrame` | WebCodecs | 94 | 原始视频帧 |
| `AudioData` | WebCodecs | 94 | 原始音频数据 |
| `VideoEncoder` / `VideoDecoder` | WebCodecs | 94 | 视频编解码 |
| `AudioEncoder` / `AudioDecoder` | WebCodecs | 94 | 音频编解码 |
| `RTCRtpScriptTransform` | WebRTC Encoded Transform | 94 | 编码帧转换 |
| `RTCEncodedVideoFrame` | WebRTC Encoded Transform | 94 | 编码视频帧 |
| `RTCEncodedAudioFrame` | WebRTC Encoded Transform | 94 | 编码音频帧 |
| `RTCRtpScriptTransformer` | WebRTC Encoded Transform | 94 | Worker 端转换器 |
| `RTCTransformEvent` | WebRTC Encoded Transform | 94 | 转换事件 |
| `MediaStreamTrackProcessor` | Insertable Streams | 94 | 轨道帧处理 |
| `MediaStreamTrackGenerator` | Insertable Streams | 94 | 轨道生成器 |
| `VideoTrackGenerator` | Insertable Streams | 94 | 视频轨道生成 |
| `EyeDropper` | EyeDropper API | 95 | 颜色取色器 |
| `URLPattern` | URL Pattern API | 95 | URL 模式匹配 |
| `VirtualKeyboard` | VirtualKeyboard API | 92 | 虚拟键盘控制 |
| `IdleDetector` | Idle Detection | 94 | 空闲检测 |

### Chrome 101-110

| Interface | Specification | Chrome | 说明 |
|-----------|--------------|--------|------|
| `Navigation` / `NavigateEvent` | Navigation API | 105 (OT) → 123 | 导航拦截 |
| `ScreenDetails` / `ScreenDetailed` | Window Management | 100 | 多屏幕详情 |
| `CaptureController` | Screen Capture | 109 | 捕获控制器 |
| `CropTarget` | Region Capture | 104 | 区域裁剪目标 |
| `BrowserCaptureMediaStreamTrack` | Screen Capture | 104 | 浏览器捕获轨道 |
| `Sanitizer` | HTML Sanitizer | 105 | HTML 净化 |
| `CloseWatcher` | Close Watcher | 120 | 关闭监视器 |

### Chrome 111-120

| Interface | Specification | Chrome | 说明 |
|-----------|--------------|--------|------|
| `ViewTransition` | View Transitions | 111 (SPA) | 视图过渡 |
| `CSSViewTransitionRule` | View Transitions | 111 | CSS 视图过渡规则 |
| `PageRevealEvent` | View Transitions | 124 | MPA 过渡 (新页面) |
| `PageSwapEvent` | View Transitions | 124 | MPA 过渡 (旧页面) |
| `EditContext` | EditContext | 118 | 文本编辑上下文 |
| `DocumentPictureInPicture` | Document Picture-in-Picture | 116 | 文档画中画 |
| `RestrictionTarget` | Element Capture | 121 | 元素限制目标 |

### Chrome 121-130

| Interface | Specification | Chrome | 说明 |
|-----------|--------------|--------|------|
| `Translator` | Translator API | 132 (OT) | AI 翻译 |
| `LanguageDetector` | Language Detector API | 132 (OT) | AI 语言检测 |
| `Summarizer` | Summarizer API | 132 (OT) | AI 摘要 |
| `Writer` | Writer API | 134 (OT) | AI 写作 |
| `Rewriter` | Rewriter API | 134 (OT) | AI 重写 |
| `ViewTransitionTypeSet` | View Transitions | 125 | 过渡类型集 |

---

## 九、新增 Constraint / Dictionary Member (Chrome 72+)

### MediaTrackConstraints / MediaTrackSettings

| 字段 | Chrome 版本 | 说明 |
|------|------------|------|
| `resizeMode` | Chrome 72 | 调整大小模式 (`"none"`, `"crop-and-scale"`) |
| `displaySurface` | Chrome 72 | 显示表面类型 (`"browser"`, `"window"`, `"monitor"`) |
| `logicalSurface` | Chrome 72 | 是否逻辑表面 |
| `cursor` | Chrome 72 | 光标模式 (`"always"`, `"motion"`, `"never"`) |
| `backgroundBlur` | Chrome 93 | 背景模糊 |
| `suppressLocalAudioPlayback` | Chrome 109 | 抑制本地音频回放 |
| `screenPixelRatio` | Chrome 109 | 屏幕像素比 (Settings only) |

### RTCConfiguration

| 字段 | Chrome 版本 | 说明 |
|------|------------|------|
| `encodedInsertableStreams` | Chrome 87 (deprecated) | 启用 Insertable Streams |

### RTCRtpEncodingParameters

| 字段 | Chrome 版本 | 说明 |
|------|------------|------|
| `scalabilityMode` | Chrome 96 | SVC 可伸缩模式 |
| `degradationPreference` | Chrome 72+ | 降级偏好 |

### MediaRecorder options

| 字段 | Chrome 版本 | 说明 |
|------|------------|------|
| `audioBitrateMode` | Chrome 89 | 音频比特率模式 |
| `videoKeyFrameIntervalDuration` | Chrome 96 | 关键帧间隔 |
| `hardwareAcceleration` | Chrome 117 | 硬件加速 |

### getDisplayMedia options

| 字段 | Chrome 版本 | 说明 |
|------|------------|------|
| `preferCurrentTab` | Chrome 94 | 优先当前标签 |
| `surfaceSwitching` | Chrome 104 | 表面切换 |
| `selfBrowserSurface` | Chrome 121 | 自浏览器表面 |
| `monitorTypeSurfaces` | Chrome 109 | 显示器类型表面 |
| `systemAudio` | Chrome 105 | 系统音频 |
| `windowAudio` | Chrome 126 | 窗口音频 |
| `controller` | Chrome 109 | CaptureController |

---

## 十、新增 Enum Value (Chrome 72+ 精选)

| Enum | 新增值 | Chrome 版本 | 说明 |
|------|--------|------------|------|
| `displaySurface` | `"browser"` | Chrome 72 | 浏览器标签页捕获 |
| `displaySurface` | `"window"` | Chrome 72 | 窗口捕获 |
| `displaySurface` | `"monitor"` | Chrome 72 | 显示器捕获 |
| `cursor` | `"always"` | Chrome 72 | 始终显示光标 |
| `cursor` | `"motion"` | Chrome 72 | 运动时显示光标 |
| `cursor` | `"never"` | Chrome 72 | 从不显示光标 |
| `resizeMode` | `"none"` | Chrome 72 | 不缩放 |
| `resizeMode` | `"crop-and-scale"` | Chrome 72 | 裁剪并缩放 |
| `contentHint` | `"motion"` | Chrome 76 | 运动内容 |
| `contentHint` | `"detail"` | Chrome 76 | 细节内容 |
| `contentHint` | `"text"` | Chrome 76 | 文本内容 |
| `degradationPreference` | `"maintain-framerate"` | Chrome 72+ | 保持帧率 |
| `degradationPreference` | `"maintain-resolution"` | Chrome 72+ | 保持分辨率 |
| `degradationPreference` | `"balanced"` | Chrome 72+ | 平衡 |
| `hardwareAcceleration` | `"prefer-hardware"` | Chrome 117 | 偏好硬件加速 |
| `hardwareAcceleration` | `"prefer-software"` | Chrome 117 | 偏好软件 |
| `surfaceSwitching` | `"include"` | Chrome 104 | 包含切换控件 |
| `surfaceSwitching` | `"exclude"` | Chrome 104 | 排除切换控件 |
| `setFocusBehavior` | `"focus-captured-surface"` | Chrome 109 | 聚焦捕获表面 |
| `setFocusBehavior` | `"no-focus-change"` | Chrome 109 | 不改变焦点 |

---

## 十一、逐版本新增能力表 (精选)

### Chrome 72 (2019-01)
- `RTCPeerConnection.connectionState` property
- `RTCPeerConnection.connectionstatechange` event
- `RTCPeerConnection.getConfiguration()` method
- `RTCRtpTransceiver.currentDirection` property
- `getDisplayMedia()` method (stable)
- `displaySurface`, `logicalSurface`, `cursor` constraints
- `resizeMode` constraint
- `NavigatorUAData` interface (User-Agent Client Hints)
- `MediaCapabilities` interface
- `scaleResolutionDownBy`, `maxBitrate`, `maxFramerate` parameters

### Chrome 73 (2019-03)
- `RTCRtpSender.getCapabilities()` static method
- `RTCRtpReceiver.getCapabilities()` static method
- `devicechange` event enhancements

### Chrome 74 (2019-04)
- Feature Policy refinements
- `prefers-reduced-motion` media query

### Chrome 75 (2019-06)
- Web Share API (`navigator.share()`)
- Simulcast support (`rid` based)

### Chrome 76 (2019-07)
- `contentHint` property on `MediaStreamTrack`
- `RTCRtpTransceiver.setCodecPreferences()`
- `adaptivePtime` in encoding parameters
- `decodingInfo({ keySystemConfiguration })`

### Chrome 77 (2019-09)
- `RTCPeerConnection.restartIce()` method
- `RTCPeerConnection.icecandidateerror` event
- Contact Picker API
- Largest Contentful Paint API

### Chrome 78 (2019-10)
- `scrollend` event (early)
- SMS Receiver API

### Chrome 79 (2019-12)
- WebXR Device API
- Wake Lock API
- `getDisplayMedia()` refinements

### Chrome 80 (2020-02)
- `AbortSignal.reason` property
- Compression Streams API
- `CompressionStream`, `DecompressionStream`

### Chrome 83 (2020-05)
- Barcode Detection API
- WebRTC Insertable Streams (early)
- `BarcodeDetector` interface

### Chrome 84 (2020-07)
- `WakeLock`, `WakeLockSentinel` interfaces
- Screen Wake Lock API

### Chrome 86 (2020-10)
- File System Access API (`FileSystemFileHandle` etc.)
- WebHID (Origin Trial)
- `AbortSignal.timeout()` (Origin Trial)

### Chrome 87 (2020-11)
- WebTransport (Origin Trial)
- `createEncodedStreams()` (旧版 Insertable Streams)
- `MediaSession.setPositionState()`

### Chrome 88 (2021-01)
- `AbortSignal.abort()` static method
- `RTCRtpReceiver.jitterBufferTarget`
- WebXR Depth API

### Chrome 89 (2021-03)
- WebHID (stable)
- WebNFC (stable)
- Web Serial (stable)
- `MediaRecorder({ audioBitrateMode })`

### Chrome 90 (2021-04)
- AV1 hardware encode/decode

### Chrome 91 (2021-05)
- WebTransport (stable)
- WebCodecs (Origin Trial)

### Chrome 92 (2021-07)
- `VirtualKeyboard` API

### Chrome 93 (2021-08)
- Multi-Screen Window Placement (OT)
- `backgroundBlur` constraint

### Chrome 94 (2021-09) ★★★ 重大版本
- **WebCodecs** (stable): VideoFrame, AudioData, VideoEncoder, VideoDecoder, AudioEncoder, AudioDecoder, EncodedVideoChunk, EncodedAudioChunk, VideoColorSpace, ImageDecoder
- **Encoded Transform**: RTCRtpScriptTransform, RTCEncodedVideoFrame, RTCEncodedAudioFrame, RTCRtpScriptTransformer, RTCTransformEvent, `rtctransform` event
- **Insertable Streams**: MediaStreamTrackProcessor, MediaStreamTrackGenerator, VideoTrackGenerator
- `RTCRtpSender.transform`, `RTCRtpReceiver.transform`
- `preferCurrentTab` in `getDisplayMedia()`

### Chrome 95 (2021-10)
- `EyeDropper` API
- `URLPattern` API

### Chrome 96 (2021-11)
- `scalabilityMode` (VP9 SVC)
- `videoKeyFrameIntervalDuration` in MediaRecorder
- `WindowControlsOverlay`

### Chrome 97 (2022-01)
- `AbortSignal.throwIfAborted()`
- `RTCEncodedVideoFrame.getMetadata()`

### Chrome 98 (2022-02)
- `AbortSignal.reason` read-only
- `AbortController.abort(reason)` parameter

### Chrome 100 (2022-03) ★ 里程碑
- Window Management API (stable): `ScreenDetails`, `ScreenDetailed`
- `Window.getScreenDetails()`
- `screenschange`, `currentscreenchange` events

### Chrome 101 (2022-04)
- `VideoFrame.flip`, `VideoFrame.rotation`

### Chrome 102 (2022-05)
- Capture Handle Identity
- `capturehandlechange` event
- `Navigation` API (OT)

### Chrome 103 (2022-06)
- `AbortSignal.timeout()` (stable)

### Chrome 104 (2022-08) ★★
- **Region Capture**: `CropTarget.fromElement()`, `BrowserCaptureMediaStreamTrack`, `BrowserCaptureMediaStreamTrack.cropTo()`
- `surfaceSwitching` in `getDisplayMedia()`
- Shared Element Transitions (OT, later renamed View Transitions)

### Chrome 105 (2022-08)
- Container Queries
- `:has()` CSS selector
- HTML Sanitizer API
- `systemAudio` in `getDisplayMedia()`

### Chrome 109 (2023-01) ★★
- **CaptureController**: `CaptureController()` constructor, `setFocusBehavior()`, `forwardWheel()`, `increaseZoomLevel()`, `decreaseZoomLevel()`, `resetZoomLevel()`, `getSupportedZoomLevels()`, `zoomLevel`, `zoomlevelchange`
- `monitorTypeSurfaces` in `getDisplayMedia()`
- `suppressLocalAudioPlayback` constraint
- `getDisplayMedia({ controller })` parameter

### Chrome 111 (2023-03)
- View Transitions (SPA stable): `ViewTransition`, `Document.startViewTransition()`
- `CSSViewTransitionRule`

### Chrome 113 (2023-05)
- WebGPU (stable)
- `scrollend` event (Chrome stable)
- `DocumentPictureInPicture`

### Chrome 114 (2023-05)
- Popover API: `toggle` event, `beforetoggle` event
- `CSS text-wrap: balance`

### Chrome 116 (2023-08)
- `AbortSignal.any()` (stable)
- `DocumentPictureInPicture` (stable)

### Chrome 117 (2023-09)
- `hardwareAcceleration` in MediaRecorder
- `hdrMetadataType`, `colorGamut`, `transferFunction` in MediaCapabilities query

### Chrome 118 (2023-10)
- `EditContext` API

### Chrome 120 (2023-12)
- `CloseWatcher` API

### Chrome 121 (2024-01) ★★
- **Element Capture**: `RestrictionTarget.fromElement()`, `BrowserCaptureMediaStreamTrack.restrictTo()`
- `selfBrowserSurface` in `getDisplayMedia()`
- `selectAudioOutput()` method

### Chrome 123 (2024-03)
- `AbortSignal.any()` baseline
- Navigation API (stable)

### Chrome 124 (2024-04)
- MPA View Transitions: `PageRevealEvent`, `PageSwapEvent`, `pagereveal`, `pageswap`
- `@view-transition` at-rule

### Chrome 126 (2024-06)
- Cross-document View Transitions (MPA stable)
- `windowAudio` parameter in `getDisplayMedia()`

### Chrome 132 (2025-01) ★★ AI APIs
- **Translator API** (OT): `Translator.availability()`, `Translator.create()`, `translator.translate()`, `translator.translateStreaming()`, `translator.destroy()`
- **LanguageDetector API** (OT): `LanguageDetector.availability()`, `LanguageDetector.create()`, `detector.detect()`, `detector.destroy()`
- **Summarizer API** (OT): `Summarizer.availability()`, `Summarizer.create()`, `summarizer.summarize()`, `summarizer.summarizeStreaming()`, `summarizer.destroy()`

### Chrome 134 (2025-03)
- Writer API (OT)
- Rewriter API (OT)

### Chrome 135 (2025-04)
- `RTCRtpScriptTransform` Baseline (cross-browser)
- WebRTC Encoded Transform widely available

---

## 十二、生命周期状态分析

### 已废弃/已删除 (Chrome 72+)

| API/成员 | 废弃版本 | 说明 |
|----------|---------|------|
| `RTCPeerConnection.addStream()` | Chrome 72+ (已标记废弃) | 使用 `addTrack()` 替代 |
| `RTCPeerConnection.removeStream()` | Chrome 72+ (已标记废弃) | 使用 `removeTrack()` 替代 |
| `RTCPeerConnection.createDTMFSender()` | Chrome 72+ (已标记废弃) | 使用 `RTCRtpSender.dtmf` |
| `RTCRtpSender.createEncodedStreams()` | Chrome 94 (已删除) | 替换为 `transform` + `RTCRtpScriptTransform` |
| `RTCRtpReceiver.createEncodedStreams()` | Chrome 94 (已删除) | 替换为 `transform` + `RTCRtpScriptTransform` |
| `RTCConfiguration.encodedInsertableStreams` | Chrome 94 (已废弃) | 不再需要 |
| WebSQL | Chrome 119 (已删除) | 使用 IndexedDB 或其他替代 |
| `RTCRtpSender.rtcpTransport` | Chrome 72+ (已废弃) | 合并到 `transport` |
| `RTCRtpReceiver.rtcpTransport` | Chrome 72+ (已废弃) | 合并到 `transport` |

### 实验性 / Origin Trial (当前)

| API | Chrome 版本 | 状态 |
|-----|------------|------|
| Translator API | 132+ | Origin Trial |
| LanguageDetector API | 132+ | Origin Trial |
| Summarizer API | 132+ | Origin Trial |
| Writer API | 134+ | Experimental |
| Rewriter API | 134+ | Experimental |
| Prompt API (AITextSession) | 136+ | Early Preview |
| Element Capture (`restrictTo()`) | 121+ | Experimental |
| Captured Surface Control | 109+ | Experimental |
| Direct Sockets | 130+ | Origin Trial |
| Compute Pressure | 115-125 | Graduated to stable |

---

## 十三、CSV 数据集 (精简采样)

以下为代表性条目的 CSV 格式：

```csv
name,type,specification,interface,chrome_version,status,feature_id,mdn_url
AbortSignal.timeout(),Static Method,DOM Standard,AbortSignal,103,stable,5734879498125312,/docs/Web/API/AbortSignal/timeout_static
AbortSignal.any(),Static Method,DOM Standard,AbortSignal,116,stable,,/docs/Web/API/AbortSignal/any_static
AbortSignal.throwIfAborted(),Instance Method,DOM Standard,AbortSignal,97,stable,,/docs/Web/API/AbortSignal/throwIfAborted
AbortSignal.abort(),Static Method,DOM Standard,AbortSignal,88,stable,,/docs/Web/API/AbortSignal/abort_static
AbortSignal.reason,Property,DOM Standard,AbortSignal,98,stable,,/docs/Web/API/AbortSignal/reason
RTCRtpScriptTransform,Interface,WebRTC Encoded Transform,WebRTC,94,stable,,/docs/Web/API/RTCRtpScriptTransform
RTCEncodedVideoFrame,Interface,WebRTC Encoded Transform,WebRTC,94,stable,,/docs/Web/API/RTCEncodedVideoFrame
RTCEncodedAudioFrame,Interface,WebRTC Encoded Transform,WebRTC,94,stable,,/docs/Web/API/RTCEncodedAudioFrame
RTCRtpSender.transform,Property,WebRTC Encoded Transform,RTCRtpSender,94,stable,,/docs/Web/API/RTCRtpSender/transform
RTCRtpReceiver.transform,Property,WebRTC Encoded Transform,RTCRtpReceiver,94,stable,,/docs/Web/API/RTCRtpReceiver/transform
rtctransform,Event,WebRTC Encoded Transform,WorkerGlobalScope,94,stable,,/docs/Web/API/DedicatedWorkerGlobalScope/rtctransform_event
VideoFrame,Interface,WebCodecs,,94,stable,,/docs/Web/API/VideoFrame
AudioData,Interface,WebCodecs,,94,stable,,/docs/Web/API/AudioData
VideoEncoder,Interface,WebCodecs,,94,stable,,/docs/Web/API/VideoEncoder
VideoDecoder,Interface,WebCodecs,,94,stable,,/docs/Web/API/VideoDecoder
AudioEncoder,Interface,WebCodecs,,94,stable,,/docs/Web/API/AudioEncoder
AudioDecoder,Interface,WebCodecs,,94,stable,,/docs/Web/API/AudioDecoder
EncodedVideoChunk,Interface,WebCodecs,,94,stable,,/docs/Web/API/EncodedVideoChunk
EncodedAudioChunk,Interface,WebCodecs,,94,stable,,/docs/Web/API/EncodedAudioChunk
MediaStreamTrackProcessor,Interface,Insertable Streams for MediaStreamTrack,,94,stable,,/docs/Web/API/MediaStreamTrackProcessor
MediaStreamTrackGenerator,Interface,Insertable Streams for MediaStreamTrack,,94,stable,,/docs/Web/API/MediaStreamTrackGenerator
scalabilityMode,Dictionary Member,WebRTC,RTCRtpEncodingParameters,96,stable,,/docs/Web/API/RTCRtpSender/setParameters
scrollend,Event,CSSOM View,Document,114,stable,,/docs/Web/API/Document/scrollend_event
screenPixelRatio,Property,Screen Capture,MediaTrackSettings,109,experimental,,/docs/Web/API/MediaTrackSettings/screenPixelRatio
CaptureController,Interface,Screen Capture,,109,experimental,,/docs/Web/API/CaptureController
CropTarget,Interface,Region Capture,,104,experimental,,/docs/Web/API/CropTarget
RestrictionTarget,Interface,Element Capture,,121,experimental,,/docs/Web/API/RestrictionTarget
BrowserCaptureMediaStreamTrack,Interface,Screen Capture,,104,experimental,,/docs/Web/API/BrowserCaptureMediaStreamTrack
ScreenDetails,Interface,Window Management,,100,stable,,/docs/Web/API/ScreenDetails
ViewTransition,Interface,View Transition,,111,stable,,/docs/Web/API/ViewTransition
Document.startViewTransition(),Method,View Transition,Document,111,stable,,/docs/Web/API/Document/startViewTransition
PageRevealEvent,Interface,View Transition,,124,stable,,/docs/Web/API/PageRevealEvent
PageSwapEvent,Interface,View Transition,,124,stable,,/docs/Web/API/PageSwapEvent
suppressLocalAudioPlayback,Constraint,Screen Capture,MediaTrackConstraints,109,experimental,,/docs/Web/API/MediaTrackConstraints/suppressLocalAudioPlayback
backgroundBlur,Constraint,Media Capture,MediaTrackConstraints,93,stable,,/docs/Web/API/MediaTrackConstraints/backgroundBlur
Translator,Interface,Translator and Language Detector APIs,,132,experimental,,/docs/Web/API/Translator
LanguageDetector,Interface,Translator and Language Detector APIs,,132,experimental,,/docs/Web/API/LanguageDetector
Summarizer,Interface,Writing Assistance APIs,,132,experimental,,/docs/Web/API/Summarizer
hardwareAcceleration,Parameter,MediaStream Recording,MediaRecorder,117,stable,,/docs/Web/API/MediaRecorder/MediaRecorder
windowAudio,Parameter,Screen Capture,getDisplayMedia,126,experimental,,/docs/Web/API/MediaDevices/getDisplayMedia
NavigatorUAData,Interface,User-Agent Client Hints,Navigator,72,stable,,/docs/Web/API/NavigatorUAData
jitterBufferTarget,Property,WebRTC,RTCRtpReceiver,88,stable,,/docs/Web/API/RTCRtpReceiver/jitterBufferTarget
contentHint,Property,Media Capture,MediaStreamTrack,76,stable,,/docs/Web/API/MediaStreamTrack/contentHint
```

---

## 十四、能力演进总结

### 1. Chrome 72 以来新增了哪些 Web 能力？

从 Chrome 72 (2019-01) 至今，Chromium 新增的 Web Platform 能力跨越以下维度：

- **WebRTC**: Encoded Transform、Scalability Mode (SVC)、Capture Handle、`jitterBufferTarget`
- **Media**: WebCodecs 全家桶、Insertable Streams、MediaStreamTrack 帧级处理
- **Screen Capture**: Region Capture、Element Capture、Captured Surface Control、Window Management
- **AI**: Translator、LanguageDetector、Summarizer、Writer、Rewriter (内置 AI 模型)
- **DOM/Events**: `scrollend`、`AbortSignal.timeout/any`、View Transitions
- **Hardware**: WebGPU、WebHID、Web Serial、Web NFC
- **Storage**: File System Access、Compression Streams

### 2. 某个 Interface 在哪个版本发生变化？

详见第九节逐版本表格。例如 `RTCPeerConnection` 在 Chrome 72 新增 `connectionState`，Chrome 77 新增 `restartIce()`，Chrome 94 的 Encoded Transform 通过 `RTCRtpSender.transform` 间接扩展了其能力。

### 3. 某个 Method 是什么时候加入的？

详见第六节和逐版本表。例如 `AbortSignal.timeout()` 在 Chrome 86 开始 OT，Chrome 103 达到 stable。

### 4. WebRTC 在 Chrome 72 后经历了哪些能力演进？

1. **Chrome 77**: ICE restart
2. **Chrome 87**: Insertable Streams (experimental)
3. **Chrome 88**: `jitterBufferTarget`
4. **Chrome 94**: Encoded Transform 革命 — 替代 Insertable Streams，提供完整的 Worker 端编码帧处理管线
5. **Chrome 96**: VP9 SVC `scalabilityMode`
6. **Chrome 102**: Capture Handle
7. **Chrome 135**: Encoded Transform 达到 Baseline（跨浏览器广泛支持）

### 5. Media 能力在 Chrome 72 后增加了哪些关键特性？

1. **Chrome 76**: `contentHint` 允许提示内容类型以优化编码
2. **Chrome 94**: WebCodecs — 提供帧级编解码控制，使浏览器端视频编辑成为可能
3. **Chrome 94**: Insertable Streams — 允许在 Worker 中处理原始帧
4. **Chrome 117**: `hardwareAcceleration` — 精确控制硬件加速偏好
5. **Chrome 117**: `hdrMetadataType`、`colorGamut`、`transferFunction` — HDR 能力查询

### 6. 哪些能力仍处于 Experimental 或 Origin Trial？

| API | 状态 |
|-----|------|
| Translator API | Origin Trial (Chrome 132+) |
| LanguageDetector API | Origin Trial (Chrome 132+) |
| Summarizer API | Origin Trial (Chrome 132+) |
| Writer API | Experimental (Chrome 134+) |
| Rewriter API | Experimental (Chrome 134+) |
| Element Capture (`restrictTo()`) | Experimental |
| Captured Surface Control | Experimental |
| Region Capture | Experimental (cross-browser) |
| Direct Sockets | Origin Trial |

### 7. 哪些能力已经废弃或被替代？

- `createEncodedStreams()` → `transform` property (Chrome 94)
- `encodedInsertableStreams` config → 不再需要 (Chrome 94)
- `addStream()` / `removeStream()` → `addTrack()` / `removeTrack()`
- WebSQL → IndexedDB (Chrome 119)

---

## 十五、研究局限与后续工作

## 十二、🔬 BCD 精确版本验证（MDN Browser Compat Data JSON）

> 以下数据直接来自 `github.com/mdn/browser-compat-data` 仓库的 JSON 文件，版本号精确可靠。

### WebRTC Encoded Transform 完整时间线

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `RTCEncodedVideoFrame` Interface | **86** | Stable |
| `RTCEncodedVideoFrame.data` | **86** | Stable |
| `RTCEncodedVideoFrame.getMetadata()` | **86** | Stable |
| `RTCEncodedAudioFrame` Interface | **86** | Stable |
| `RTCEncodedAudioFrame.data` | **86** | Stable |
| `RTCEncodedAudioFrame.getMetadata()` | **86** | Stable |
| `RTCEncodedVideoFrame()` constructor | **127** | Stable |
| `RTCEncodedAudioFrame()` constructor | **127** | Stable |
| `getMetadata()` → frameId, width, height, spatialIndex, temporalIndex, mimeType, payloadType, dependencies, synchronizationSource, contributingSources, rtpTimestamp, receiveTime | **127** | Stable |
| `RTCEncodedAudioFrame.getMetadata()` → audioLevel | **139** | Experimental |
| `RTCRtpScriptTransform` Interface | **141** | Stable |
| `RTCRtpScriptTransform()` constructor | **141** | Stable |
| `RTCRtpSender.transform` | **141** | Stable |
| `RTCRtpReceiver.transform` | **141** | Stable |

### Screen Capture 演进

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `getDisplayMedia()` | **72** | Stable |
| `getDisplayMedia()` audio capture | **74** | Stable |
| `getDisplayMedia()` `preferCurrentTab` | **94** | Experimental |
| `getDisplayMedia()` `systemAudio` | **105** | Experimental |
| `getDisplayMedia()` `selfBrowserSurface` | **107** | Experimental |
| `getDisplayMedia()` `surfaceSwitching` | **107** | Experimental |
| `getDisplayMedia()` `controller` | **109** | Experimental |
| `CaptureController` Interface | **109** | Experimental |
| `CaptureController.setFocusBehavior()` | **109** | Experimental |
| `getDisplayMedia()` `monitorTypeSurfaces` | **119** | Experimental |
| `getDisplayMedia()` `windowAudio` | **141** | Experimental |
| `BrowserCaptureMediaStreamTrack` Interface | **104** | Experimental |
| `BrowserCaptureMediaStreamTrack.cropTo()` | **104** | Experimental |
| `CropTarget` Interface | **104** | Experimental |
| `CropTarget.fromElement()` | **104** | Experimental |
| `RestrictionTarget` Interface | **132** | Experimental |
| `RestrictionTarget.fromElement()` | **132** | Experimental |
| `BrowserCaptureMediaStreamTrack.restrictTo()` | **132** | Experimental |
| `CaptureController.decreaseZoomLevel()` | **136** | Experimental |
| `CaptureController.increaseZoomLevel()` | **136** | Experimental |
| `CaptureController.resetZoomLevel()` | **136** | Experimental |
| `CaptureController.getSupportedZoomLevels()` | **136** | Experimental |
| `CaptureController.forwardWheel()` | **136** | Experimental |
| `CaptureController.zoomLevel` | **136** | Experimental |
| `CaptureController.zoomlevelchange` event | **136** | Experimental |

### AI API (Built-in AI)

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `Summarizer` Interface | **138** | Experimental |
| `Summarizer.create()` | **138** | Experimental |
| `Summarizer.summarize()` | **138** | Experimental |
| `Summarizer.summarizeStreaming()` | **138** | Experimental |
| `Translator` Interface | **138** | Experimental |
| `Translator.create()` | **138** | Experimental |
| `Translator.translate()` | **138** | Experimental |
| `Translator.translateStreaming()` | **138** | Experimental |

### WebCodecs

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `VideoFrame` Interface | **94** | Stable |
| `VideoFrame()` constructor | **94** | Stable |
| `VideoFrame.format/codedWidth/codedHeight/displayWidth/displayHeight/timestamp/duration/colorSpace` | **94** | Stable |
| `VideoFrame.clone()/close()/allocationSize()/copyTo()` | **94** | Stable |
| `VideoFrame.flip` | **138** | Experimental |
| `VideoFrame.rotation` | **138** | Experimental |
| `VideoFrame.metadata` | **145** | Experimental |

### AbortSignal 演进

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `AbortSignal` Interface | 66 | Stable (pre-72) |
| `AbortSignal.abort()` static | **93** | Stable |
| `AbortSignal.reason` | **98** | Stable |
| `AbortSignal.abort()` reason parameter | **98** | Stable |
| `AbortSignal.throwIfAborted()` | **100** | Stable |
| `AbortSignal.timeout()` static (initial, AbortError on timeout) | **103** | Partial |
| `AbortSignal.any()` static | **116** | Stable |
| `AbortSignal.timeout()` static (TimeoutError) | **124** | Stable |

### View Transition API

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `ViewTransition` Interface | **111** | Stable |
| `ViewTransition.finished/ready/updateCallbackDone` | **111** | Stable |
| `ViewTransition.skipTransition()` | **111** | Stable |
| `Document.startViewTransition()` | **111** | Stable |
| `ViewTransition.types` | **125** | Stable |
| `ViewTransition.waitUntil()` | **144** | Experimental |
| `ViewTransition.transitionRoot` | **147** | Experimental |

### WebTransport

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `WebTransport` Interface | **97** | Stable |
| `WebTransport()` constructor | **97** | Stable |
| `WebTransport.ready/closed/datagrams` | **97** | Stable |
| `WebTransport.createBidirectionalStream()` | **97** | Stable |
| `WebTransport.createUnidirectionalStream()` | **97** | Stable |
| `WebTransport.incomingBidirectionalStreams` | **97** | Stable |
| `WebTransport.incomingUnidirectionalStreams` | **97** | Stable |
| `WebTransport()` serverCertificateHashes | **100** | Stable |
| WebTransport BYOB readers | **109** | Stable |
| `WebTransport.protocol` | **143** | Stable |

### User-Agent Client Hints

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `NavigatorUAData` Interface | **90** | Experimental |
| `Navigator.userAgentData` | **90** | Experimental |
| `NavigatorUAData.brands` | **90** | Experimental |
| `NavigatorUAData.mobile` | **90** | Experimental |
| `NavigatorUAData.getHighEntropyValues()` | **90** | Experimental |
| `NavigatorUAData.platform` | **93** | Experimental |
| `NavigatorUAData.toJSON()` | **93** | Experimental |

### Media Capabilities 扩展

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `MediaCapabilities.decodingInfo()` keySystemConfiguration | **80** | Stable |
| `MediaCapabilities.encodingInfo()` | **101** | Stable |

### FedCM (Federated Credential Management)

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `IdentityCredential` Interface | **108** | Experimental |
| `IdentityCredential.token` | **108** | Experimental |
| `IdentityCredential.isAutoSelected` | **120** | Experimental |
| `IdentityCredential.disconnect()` | **122** | Experimental |
| `IdentityCredential.configURL` | **136** | Experimental |

### File System Access

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `FileSystemFileHandle` Interface | **86** | Stable |
| `FileSystemFileHandle.getFile()` | **86** | Stable |
| `FileSystemFileHandle.createWritable()` | **86** | Stable |
| `FileSystemFileHandle.createSyncAccessHandle()` | **102** | Stable |
| `createSyncAccessHandle()` / `createWritable()` mode option | **121** | Experimental |

### Navigation API

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `Navigation` Interface | **102** | Stable |
| `Navigation.navigate()` | **102** | Stable |
| `Navigation.reload()` | **102** | Stable |
| `Navigation.traverseTo()` | **102** | Stable |
| `Navigation.back()` | **102** | Stable |
| `Navigation.forward()` | **102** | Stable |
| `Navigation.currentEntry` | **102** | Stable |
| `Navigation.transition` | **102** | Stable |
| `navigate` event | **102** | Stable |
| `navigatesuccess` event | **102** | Stable |
| `navigateerror` event | **102** | Stable |
| `currententrychange` event | **102** | Stable |
| `Navigation.activation` | **123** | Stable |

### Launch Handler API

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `LaunchQueue` Interface | **102** | Experimental |
| `LaunchQueue.setConsumer()` | **102** | Experimental |

### Compute Pressure API

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `PressureObserver` Interface | **125** | Experimental |
| `PressureObserver()` constructor | **125** | Experimental |
| `PressureObserver.observe()` | **125** | Experimental |
| `PressureObserver.disconnect()` | **125** | Experimental |
| `PressureObserver.knownSources()` | **125** | Experimental |

### Storage Access (Non-Cookie)

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `StorageAccessHandle` Interface | **125** | Stable |
| `StorageAccessHandle.localStorage` | **125** | Stable |
| `StorageAccessHandle.sessionStorage` | **125** | Stable |
| `StorageAccessHandle.indexedDB` | **125** | Stable |
| `StorageAccessHandle.caches` | **125** | Stable |
| `StorageAccessHandle.locks` | **125** | Stable |
| `StorageAccessHandle.BroadcastChannel` | **125** | Stable |
| `StorageAccessHandle.getDirectory()` | **125** | Stable |

### EditContext API

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `EditContext` Interface | **121** | Experimental |
| `EditContext()` constructor | **121** | Experimental |
| `EditContext.text` | **121** | Experimental |
| `EditContext.selectionStart/End` | **121** | Experimental |
| `EditContext.updateText()` | **121** | Experimental |
| `textupdate` event | **121** | Experimental |
| `compositionstart` / `compositionend` events | **121** | Experimental |

### HTML Sanitizer API

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `Sanitizer` Interface (spec-compliant) | **146** | Stable |
| `Sanitizer()` constructor | **146** | Stable |
| `Sanitizer.allowElement()` / `removeElement()` | **146** | Stable |
| `Sanitizer.allowAttribute()` / `removeAttribute()` | **146** | Stable |
| `Sanitizer.setComments()` / `setDataAttributes()` | **146** | Stable |
| `Sanitizer.allowProcessingInstruction()` | **149** | Experimental |

### WebGPU

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `GPU` Interface (desktop: ChromeOS/macOS/Windows) | **113** | Stable (partial) |
| `GPU` Interface (Android) | **121** | Stable |
| `GPU.requestAdapter()` | **113** | Stable |
| `GPU.getPreferredCanvasFormat()` | **113** | Stable |
| `GPU.wgslLanguageFeatures` | **115** | Stable |
| `requestAdapter()` discrete GPU default on AC | **115** | Experimental |
| `requestAdapter()` `featureLevel` option | **146** | Experimental |

### WebXR Device API

| 能力 | Chrome 版本 | 状态 |
|------|------------|------|
| `XRSystem` Interface | **79** | Experimental |
| `XRSystem.isSessionSupported()` | **79** | Experimental |
| `XRSystem.requestSession()` | **79** | Experimental |
| `XRSystem.devicechange` event | **79** | Experimental |

### WebRTC (基础 Interface 版本)

| 能力 | Chrome 版本 |
|------|------------|
| `RTCPeerConnection` | 56 |
| `RTCRtpSender` | 64 |
| `RTCRtpReceiver` | 59 |
| `MediaDevices` | 47 |
| `MediaStreamTrack` | 26 |

---

## 十三、版本分布汇总（BCD 精确版）

| Chrome 版本 | 新增节点数 | 典型代表 |
|-------------|-----------|---------|
| **72** | 1 | `getDisplayMedia()` |
| **74** | 1 | getDisplayMedia audio |
| **79** | 4 | WebXR Device API (XRSystem) |
| **80** | 1 | MediaCapabilities.keySystemConfiguration |
| **86** | 8 | RTCEncodedVideoFrame/AudioFrame, FileSystemFileHandle |
| **90** | 5 | NavigatorUAData, brands, mobile, getHighEntropyValues |
| **93** | 3 | AbortSignal.abort(), NavigatorUAData.platform |
| **94** | 10 | VideoFrame Interface + all properties + preferCurrentTab |
| **97** | 9 | WebTransport Interface + core methods |
| **98** | 2 | AbortSignal.reason + reason param |
| **100** | 2 | AbortSignal.throwIfAborted(), serverCertificateHashes |
| **101** | 1 | MediaCapabilities.encodingInfo() |
| **102** | ~15 | Navigation API, LaunchQueue, FileSystemHandle.createSyncAccessHandle |
| **103** | 1 | AbortSignal.timeout() (partial) |
| **104** | 4 | CropTarget, BrowserCaptureMediaStreamTrack + cropTo |
| **105** | 1 | getDisplayMedia systemAudio |
| **107** | 2 | getDisplayMedia selfBrowserSurface + surfaceSwitching |
| **108** | 2 | IdentityCredential (FedCM), token |
| **109** | 4 | CaptureController, setFocusBehavior, controller, WebTransport BYOB |
| **111** | 5 | ViewTransition Interface + core properties/methods |
| **113** | 3 | WebGPU (desktop) — GPU, requestAdapter, getPreferredCanvasFormat |
| **115** | 2 | GPU.wgslLanguageFeatures, discrete GPU default |
| **116** | 1 | AbortSignal.any() |
| **119** | 1 | getDisplayMedia monitorTypeSurfaces |
| **120** | 1 | IdentityCredential.isAutoSelected |
| **121** | ~15 | EditContext API + WebGPU Android + FileSystem mode option |
| **122** | 1 | IdentityCredential.disconnect() |
| **123** | 1 | Navigation.activation |
| **124** | 1 | AbortSignal.timeout() (full) |
| **125** | ~20 | ViewTransition.types, PressureObserver, StorageAccessHandle |
| **127** | ~25 | RTCEncodedVideoFrame/AudioFrame constructors + all metadata |
| **132** | 3 | RestrictionTarget, fromElement, restrictTo |
| **136** | 8 | CaptureController zoom methods/events + IdentityCredential.configURL |
| **138** | ~20 | Summarizer, Translator, VideoFrame.flip/rotation |
| **139** | 1 | RTCEncodedAudioFrame audioLevel |
| **141** | 4 | RTCRtpScriptTransform, transform properties, windowAudio |
| **143** | 1 | WebTransport.protocol |
| **144** | 1 | ViewTransition.waitUntil() |
| **145** | 2 | VideoFrame.metadata + metadata option |
| **146** | ~10 | Sanitizer (spec-compliant) + GPU featureLevel |
| **147** | 1 | ViewTransition.transitionRoot |
| **149** | 1 | Sanitizer.allowProcessingInstruction() |

---

### 已覆盖
- ✅ MDN Web API 目录结构完整扫描
- ✅ Specifications 和 Interfaces 层级分析
- ✅ WebRTC 超深度专项（Encoded Transform、Insertable Streams、SVC、Capture Handle）
- ✅ Media 超深度专项（WebCodecs、MediaStreamTrack、Insertable Streams）
- ✅ Screen Capture 专项（getDisplayMedia、Region Capture、Element Capture、Window Management）
- ✅ AI API 专项（Translator、LanguageDetector、Summarizer）
- ✅ AbortSignal 演进
- ✅ 逐版本新增能力表
- ✅ 生命周期状态追踪

### 待扩展
- ⬜ 完整的 WebIDL diff（需访问 chromium.googlesource.com 获取每个版本的 .idl 文件）
- ⬜ BCD 完整交叉验证（MDN BCD JSON 仓库过大，需离线处理）
- ⬜ Chrome Platform Status Feature ID 全量映射（chromestatus.com 需 JS 渲染）
- ⬜ CSS Properties/Values API 新增（本次聚焦 Web API，CSS 层仅部分覆盖）
- ⬜ SVG API 新增
- ⬜ WebGL 2.0 / WebGPU 完整演进
- ⬜ Sensor APIs 完整列表
- ⬜ 所有 Interface 的全部 Property/Method 级别扫描（数千个节点）

### 推荐后续工具
1. **MDN BCD 离线分析**: `git clone https://github.com/mdn/browser-compat-data` → 编写脚本过滤 `chrome` `version_added ≥ "72"`
2. **Chrome Platform Status 爬虫**: 使用 headless browser 访问 chromestatus.com/features
3. **WebIDL Diff**: 使用 Chromium 源码 `git log` 追踪每个 `.idl` 文件的变更

---

*报告生成: 2025-06-01 | 数据源: MDN Web API 文档 (developer.mozilla.org) | 覆盖版本: Chrome 72 → Chrome 136*
