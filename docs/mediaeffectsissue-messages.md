# `mediaEffectsIssue` message 清单

## 目的

`RTCSession` 对外统一发出 `mediaEffectsIssue` 事件，当前事件负载只保留两个字段：

```js
{
  module: 'AiNS' | 'MediaEffectsComposer',
  message: '...'
}
```

上层只需要知道：

- 是哪个媒体效果模块出问题了
- 当前失败文案是什么

更详细的上下文，例如 `component`、`stage`、`severity`、是否已经 fallback、附加 `details`，都只保留在 SDK logger 里，供排查使用。

## 上层处理原则

- `AiNS` 失败：通常表示 AI 降噪不可用或已降级，通话本身一般仍可继续，建议提示“降噪不可用，已回退原始音频”。
- `MediaEffectsComposer` 失败：通常表示混流、虚拟背景、水印或渲染链路异常。若只是单个效果失败，可关闭对应效果继续通话；若是主渲染链路失败，可能需要回退到原始摄像头流。
- 对于固定错误文案，可按本文档做精细化提示。
- 对于透传错误文案，可统一提示“媒体效果初始化/运行失败”，同时结合 logger 排查根因。

## AiNS

### 固定 message

| message | 来源 | 原因 | 上层处理 | 后续排查/处理 |
| --- | --- | --- | --- | --- |
| `Timed out fetching asset after 15000ms: ${url}` | `AiNSWorkletRuntime` | 从 `cdnUrl` 或资产地址拉取 wasm/js 资源超时，常见于地址错误、网络不可达、CDN 慢或被拦截。 | 提示降噪初始化失败，关闭 AiNS，保留原始音频继续通话。可提供“稍后重试”。 | 检查 `cdnUrl`、浏览器网络、资源是否真实存在、跨域和缓存策略；logger 会带 `asset-fetch-timeout` 相关上下文。 |
| `Failed to fetch asset: url=${url} status=${status} statusText=${statusText}` | `AiNSWorkletRuntime` | 资源请求返回非 2xx，通常是 404、403、500 或错误的文件路径。 | 提示降噪资源加载失败，关闭 AiNS。 | 核对发布包是否包含对应文件、`cdnUrl` 是否指向正确目录、服务端是否允许访问。 |
| `Assets not loaded` | `AiNSWorkletRuntime` | 进入 worklet 初始化或处理前，资源尚未完成加载。可能是初始化顺序不对，也可能前一步加载失败。 | 不要继续启用 AiNS；可在资源确认就绪后重试。 | 看 logger 里更早的 asset 失败日志，确认是否先发生了拉取失败或超时。 |
| `AudioWorklet internal initialization failed` | `AiNSWorkletRuntime` | AudioWorklet 内部初始化失败，但 worklet 没有给出更细的错误文本时，会落到这个兜底文案。 | 关闭 AiNS，继续原始音频。 | 结合 logger 看 worklet 端初始化消息；常见原因是浏览器兼容性、脚本加载异常、底层 wasm 初始化失败。 |
| `Processor not initialized. Call initialize() first.` | `AiNSWorkletRuntime` | 在 runtime 尚未 `initialize()` 完成前就开始处理。属于调用时序错误或前置初始化失败后仍继续使用。 | 上层不要重试当前实例，重新初始化 AiNS 或直接关闭功能。 | 检查调用链是否在初始化 Promise 完成前就触发处理。 |
| `AiNSMediaStreamProcessor.init: failed to create processed MediaStream` | `AiNSMediaStreamProcessor` | 降噪处理图构建完成后，没有成功产出新的处理后音频流。 | 回退原始音频，提示降噪不可用。 | 看 logger 中更早的 graph 创建、destination、track 生成日志。 |
| `AiNSMediaStreamProcessor.replaceAudioTrack: failed to create processed MediaStream` | `AiNSMediaStreamProcessor` | 替换输入音轨时，新的处理后音频流未生成成功。 | 保留旧音轨或回退原始音频，不要继续强切换。 | 检查设备切换时输入流是否合法，是否在切换过程中拿到了空轨。 |
| `AiNSMediaStreamProcessor: input stream has no audio track` | `AiNSMediaStreamProcessor` | 传入流里没有音频轨。常见于纯视频流、采集失败或业务误传。 | 不要启用 AiNS；可静默跳过或提示“当前没有可降噪音频”。 | 检查 `getUserMedia`/屏幕流输入是否包含音频。 |
| `AiNSMediaStreamProcessor: input track must be audio` | `AiNSMediaStreamProcessor` | 传入的单轨不是音频轨。属于业务调用错误。 | 直接关闭 AiNS；无需重试同一入参。 | 检查调用方是否误把视频轨或其他轨道传入。 |
| `AiNSMediaStreamProcessor: replacement input has no audio track` | `AiNSMediaStreamProcessor` | 替换音轨时的新流没有音频轨。 | 保持旧音频或退回原始音频。 | 排查切麦/切设备时的新流生成逻辑。 |
| `AiNSMediaStreamProcessor: missing source audio track` | `AiNSMediaStreamProcessor` | 处理图里预期的源音轨不存在，说明输入流状态已异常或轨道已结束。 | 关闭 AiNS，必要时提示用户重新选择麦克风。 | 检查源轨是否已 `ended`、是否被提前 `stop()`。 |
| `AiNSMediaStreamProcessor: missing destination node` | `AiNSMediaStreamProcessor` | 音频处理图没有创建出目标节点，无法导出处理后的流。 | 回退原始音频。 | 排查 `AudioContext`、节点创建、浏览器音频上下文状态。 |
| `AiNSMediaStreamProcessor: worklet destination did not produce an audio track` | `AiNSMediaStreamProcessor` | worklet 输出端没有产出任何可用音频轨。 | 回退原始音频。 | 重点看 worklet 初始化和 graph 连接日志。 |

### 透传 message

下面这些不是固定常量，而是直接透传底层错误 `error.message`：

- 浏览器或系统音频上下文错误，例如 `AudioContext resume` 失败
- wasm/js 初始化错误
- AudioWorklet 脚本执行错误
- worklet 通过 `postMessage` 主动上报的内部错误

处理建议：

- 上层统一提示“AI 降噪初始化失败”或“AI 降噪运行失败”
- 当前实例不要继续复用，直接关闭 AiNS 或重新初始化
- 结合 logger 中的 `component/stage/details` 看具体失败点

## MediaEffectsComposer

### 固定 message

| message | 来源 | 原因 | 上层处理 | 后续排查/处理 |
| --- | --- | --- | --- | --- |
| `composer output has no video track` | `MediaPipeline` | composer 已创建，但最终输出流里没有视频轨，说明合成输出失败。 | 关闭混流/虚拟背景，回退原始摄像头流。 | 检查 renderer、输出流生成、输入源是否有视频轨。 |
| `AudioContext is not available` | `AudioMixer` | 当前环境没有可用 `AudioContext`，或被浏览器/运行环境限制。 | 关闭 composer 音频混合能力，必要时只保留视频处理。 | 常见于老环境、受限 WebView、浏览器能力缺失。 |
| `No valid audio sources, skip audio stream creation` | `AudioMixer` | 当前没有任何可参与混音的有效音频源，因此跳过生成混音音频轨。 | 通常不必中断视频处理；可静默降级，或提示“当前无可混音音频”。 | 检查各 source 是否真有 live 音频轨。 |
| `Insertable frame writing disabled due to repeated failures` | `OutputStreamManager` | Insertable Streams 连续写帧失败，SDK 主动停用该路径避免持续报错。 | 允许通话继续，提示高级视频处理能力已降级。 | 结合 logger 看此前的逐次写帧失败原因，常见于浏览器兼容性或生成器状态异常。 |
| `TrackGenerator constructor is unavailable` | `OutputStreamManager` | 当前环境不支持 `MediaStreamTrackGenerator`。 | 关闭依赖 Insertable Streams 的输出路径，必要时切回 canvas capture。 | 常见于浏览器版本不支持。 |
| `generator track is unavailable` | `OutputStreamManager` | 已尝试创建 generator，但没有可用输出轨。 | 回退到其他输出模式。 | 检查 generator 初始化状态与浏览器支持。 |
| `generator writable is unavailable` | `OutputStreamManager` | generator 没有可写入端，无法继续喂帧。 | 回退到其他输出模式。 | 常见于浏览器实现不完整或 generator 已异常关闭。 |
| `VideoFrame constructor is unavailable` | `OutputStreamManager` | 当前环境不支持 `VideoFrame`。 | 关闭依赖 `VideoFrame` 的路径，尝试其他渲染/输出模式。 | 需要浏览器能力兜底。 |
| `MediaEffectsComposer has been stopped. Create a new composer before calling ${methodName}.` | `ComposerRuntime` | composer 已 stop，但业务仍继续调用更新、取输出或 source 相关方法。 | 不要重试当前实例；重新创建 composer。 | 调用时序问题，检查关闭后是否仍保留旧实例引用。 |
| `Image constructor is unavailable` | `WatermarkManager` | 当前环境没有 `Image` 构造器，无法加载图片水印。 | 关闭图片水印；文字水印可视情况保留。 | 常见于非浏览器环境或受限运行环境。 |
| `Failed to load image: ${url}` | `WatermarkManager` | 图片水印资源加载失败。 | 去掉该图片水印继续通话。 | 检查图片 URL、跨域、文件是否存在。 |
| `Missing image` | `WatermarkManager` | 水印配置要求图片，但没有提供图片对象或地址。 | 直接忽略该水印配置，并提示配置错误。 | 检查 `watermarks[].image` 是否为空。 |
| `Failed to load background image` | `SourceAiVBController` 或 worker | 虚拟背景背景图加载失败。 | 关闭该背景图模式，可回退为 blur 或关闭 AiVB。 | 检查背景图 URL、跨域、文件存在性。 |
| `AIVirtualBackground requires browser environment` | `AiVBAssetLoader` | 在非浏览器环境初始化 AiVB。 | 直接关闭 AiVB，不应重试。 | 属于运行环境不支持。 |
| `Failed to load MediaPipe Tasks runtime: ${moduleUrl}` | `AiVBAssetLoader` | MediaPipe runtime 脚本加载失败。通常是 URL 错、网络失败或脚本不可访问。 | 关闭 AiVB，允许普通视频继续。 | 核对 `cdnUrl/moduleUrl`、网络、部署内容。 |
| `Timed out waiting for MediaPipe Tasks runtime: ${moduleUrl}` | `AiVBAssetLoader` | 等待 MediaPipe runtime 挂载全局对象超时。 | 关闭 AiVB。 | 看脚本是否被拦截、执行过慢、版本不匹配。 |
| `MediaPipe Tasks runtime loaded but global not found: ${moduleUrl}` | `AiVBAssetLoader` | 脚本已加载，但没有暴露预期全局对象，通常是版本或包内容不匹配。 | 关闭 AiVB。 | 核对 runtime 文件版本和导出格式。 |
| `MediaPipe segmenter destroyed` | `MediaPipeSegmenterRuntime` | 分割器已销毁，但仍有初始化或分割请求进入。 | 不要重试当前实例，重新创建 AiVB/composer。 | 检查 stop/close 后是否还有异步回调继续执行。 |
| `MediaPipe segmenter not initialized` | `MediaPipeSegmenterRuntime` | 还没完成初始化就开始做分割。 | 等初始化完成后再试，或重建实例。 | 检查 AiVB 初始化 Promise 时序。 |
| `ImageSegmenter returned invalid categoryMask size` | `MediaPipeSegmenterRuntime` | 分割结果的 mask 尺寸与预期不符，无法用于后续渲染。 | 关闭 AiVB 或切到其他模式。 | 看 runtime 版本、输入尺寸和 MediaPipe 输出是否匹配。 |
| `Unable to create segmentation mask canvas` | `MediaPipeSegmenterRuntime` 或 worker | 无法创建 mask canvas。 | 关闭 AiVB。 | 检查 `canvas/offscreenCanvas` 能力和内存状态。 |
| `ImageSegmenter did not return a supported mask output` | `AiVBSegmentationCommon` 或 worker | MediaPipe 返回的 mask 输出类型不在 SDK 支持范围内。 | 关闭 AiVB。 | 重点检查 runtime/模型版本是否与 SDK 匹配。 |
| `ImageSegmenter mask is required` | `AiVBSegmentationCommon` | 分割结果缺少 mask 数据。 | 关闭 AiVB。 | 常见于底层结果异常或 runtime 版本问题。 |
| `Unsupported ImageSegmenter mask format` | `AiVBSegmentationCommon` | 返回了 mask，但格式不是 SDK 支持的格式。 | 关闭 AiVB。 | 检查 MediaPipe 产物格式与当前 SDK 兼容性。 |
| `WebGL2 context is not available` | `MainWebGL2Renderer` | 主线程 WebGL2 上下文不可用。 | 允许自动 fallback 到 2D/worker；若最终仍失败则关闭该效果。 | 常见于浏览器能力不足、驱动关闭 WebGL、上下文创建失败。 |
| `Canvas2D context is not available` | `MainCanvas2DRenderer` | 主线程 2D canvas 不可用。 | 尝试其他渲染模式；若无可用模式则关闭 composer/AiVB。 | 运行环境异常或 canvas 创建失败。 |
| `Worker OffscreenCanvas is not available` | `WorkerRenderer` | Worker 路径依赖的 `OffscreenCanvas` 不可用。 | 切主线程 renderer 或其他模式。 | 浏览器能力限制。 |
| `Worker WebGL2 context is not available` | `workerScript` | Worker 中无法创建 WebGL2。 | 自动 fallback 到 worker 2D 或主线程模式。 | 多见于浏览器/驱动能力不足。 |
| `Worker Canvas2D context is not available` | `workerScript` | Worker 中无法创建 2D canvas。 | fallback 到主线程模式。 | 浏览器能力限制。 |
| `Could not compile shader: ...` | `Renderers/gl.js` 或 worker | WebGL shader 编译失败。 | 切换到 2D renderer 或关闭相关特效。 | 结合 logger 看 shader 文本、GPU/驱动兼容性。 |
| `Could not link WebGL program: ...` | `Renderers/gl.js` 或 worker | WebGL program 链接失败。 | 切换到 2D renderer 或关闭相关特效。 | 多与 GPU/驱动兼容、shader 输入输出不匹配有关。 |
| `VideoFrame and createImageBitmap are unavailable` | `WorkerRenderer` | Worker 路径缺少帧搬运所需浏览器能力。 | 关闭 worker 渲染路径，回退主线程模式。 | 浏览器能力不足。 |
| `Watermark frame extraction is unavailable` | `WorkerRenderer` | worker 模式下无法提取水印帧。 | 关闭对应水印或回退其他渲染模式。 | 看浏览器帧提取能力是否支持。 |

### 渲染/运行期透传 message

下面这些 message 会根据底层真实错误动态生成：

- `Render fallback [${trigger}]: ...`
- `Composer render failed: ${error.message}`
- `AiVB segmentation failed: ...`
- 浏览器原生异常，例如 canvas、worker、视频帧、图像解码、GPU 上下文相关错误

处理建议：

- 如果 logger 显示已经 fallback 成功，上层可以只做弱提示，通话通常还能继续
- 如果最终没有可用 renderer 或输出轨，关闭 composer / AiVB，回退原始视频
- 如果是单个水印或背景图失败，只关闭该效果，不要直接中断整个通话

## logger 使用建议

收到 `mediaEffectsIssue` 后，如果需要进一步定位，优先从 SDK logger 看这些信息：

- `module`：`AiNS` 或 `MediaEffectsComposer`
- `component`：具体出错组件，例如 `AiNSWorkletRuntime`、`AudioMixer`、`RenderLoop`、`SourceAiVBController`
- `stage`：失败发生阶段，例如资源拉取、runtime 初始化、renderer fallback、输出写帧
- `severity`：`debug`、`warn`、`error`
- `fallbackApplied`：是否已经自动降级
- `degraded`：当前是否已经进入降级状态
- `details`：更具体的 URL、slot、source、渲染模式等上下文

推荐处理策略：

- 业务提示以 `module + message` 为准，保持简单稳定
- 监控和技术排查以 logger 为准，不依赖事件负载里的内部字段
- 同一类错误连续出现时，可在业务层做去重提示，避免用户反复看到相同告警
