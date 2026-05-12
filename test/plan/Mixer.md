# Mixer.js 混流模块工程化分析与整改建议

## Summary

`MediaStreamMixer` 当前整体架构可用，已经具备 source 管理、grid/legacy 布局、WebAudio 混音、主线程/Worker 多渲染后端等能力。但工程上存在几类问题：生命周期不够明确、异常恢复不足、Worker 路径有明确画面残留 bug、音频换源和 AudioContext 管理偏脆弱，另外 `Mixer.js` 和 `workerScript.js` 体量较大，长期维护成本较高。

优先处理顺序建议是：先修会造成画面/声音错误和资源泄漏的问题，再补状态机和可观测性，最后做结构拆分和性能优化。

## Key Findings

- P0：Worker 模式空 payload 不清屏  
  `WorkerRenderer` 在无可渲染 items 时直接返回，可能导致移除所有源、视频未 ready、track ended 后输出冻结在上一帧。主线程 renderer 每帧清背景，Worker 路径行为不一致。

- P0：调用方样本存在 Mixer 实例泄漏  
  `samples/mix/js/app.js` 和 `samples/mix/js/webrtc.sip.js` 创建 Mixer 后没有保存实例，也没有在结束时调用 `stop()`。这会让 rAF、AudioContext、renderer 资源持续存在。

- P0：rAF 渲染循环缺少异常保护  
  `_drawVideosToCanvas()` 中 `_createRenderPayload()` 或 `renderer.render()` 抛错会直接断开后续 rAF 链路，混流画面停止且缺少恢复机制。

- P1：`HTMLMediaElement` 支持与实现不一致  
  文档/注释说支持 `HTMLVideoElement`，但 `_isRenderable()` 要求 `MediaStream.active` 和 video track。普通 `video.src`、MSE、文件视频会被跳过。需要收窄文档，或放宽实现。

- P1：外部 video 换 `srcObject` 后音频可能残留旧流  
  `_getSourceStream()` 会更新画面用的 stream，但音频重连只发生在 `_connectAudio()`。如果外部替换 `srcObject`，可能出现“画面是新流，声音还是旧流”。

- P1：生命周期状态机不清晰  
  多次调用 `getVideoStream()` 会停止旧 captured stream tracks，调用方持有的旧 `mixedStream` 可能突然 ended。`stop()` 后实例是否可复用也未定义，容易产生竞态。

- P1：AudioContext 创建和关闭策略偏粗  
  `getAudioStream()` 即使无 live 音频源也会创建/恢复 AudioContext；`stop()` 中 `close()` 未等待，单独看不是致命 bug，但在缺少 `_stopped/_destroyed` 状态机时会放大竞态风险。

- P2：`fps` 只限制输出，不限制合成负载  
  `canvas.captureStream(fps)` 控制输出轨帧率，但 rAF 仍按屏幕刷新率合成，多路视频下会增加 CPU/GPU 压力。

- P2：Worker 运行时失败没有真正 fallback  
  初始化阶段有 fallback，但 Worker 运行中失败只更新状态，不会切换到主线程 renderer，线上可能表现为掉帧、黑屏或冻结。

- P2：可观测性不足  
  `video.play()` 失败日志过粗；`getAudioStream()` 返回 `null` 时调用方无法区分“无音频源”和“音频初始化失败”；renderer/audio 错误没有事件或结构化状态。

- P3：维护成本较高  
  `Mixer.js` 超过 1500 行，混合了 source、layout、audio、video loop、public API；`workerScript.js` 与主线程 renderer 重复颜色解析、shader、viewport、纹理管理逻辑，后续容易出现双路径行为漂移。

## Recommended Changes

- 修复 Worker 空画面：即使 `items.length === 0`，也向 Worker 发送 render payload 并清背景，或在主线程输出 canvas 上清背景。
- 给 `_drawVideosToCanvas()` 增加 try/catch，记录错误、更新 render info，并继续调度下一帧；连续错误可触发 renderer fallback。
- 在样本和业务调用方中持有 Mixer 实例，通话结束、切换混流、页面卸载时统一调用 `mixer.stop()`。
- 增加 `_state` 或 `_destroyed/_started/_stopping` 标记，明确 `stop()` 后不允许继续 `getMixedStream()`，或支持显式 restart。
- 明确多次 `getVideoStream()/getMixedStream()` 行为：要么返回同一个输出流，要么文档明确会停止旧输出轨。
- 处理外部 `HTMLVideoElement.srcObject` 变化：检测 stream 变化后同步触发音频重连。
- `getAudioStream()` 先检查是否存在 live audio track，无音频源时避免创建 AudioContext；后续 append 有音频源再创建并注入 mixed stream。
- 为 rAF 加 fps throttle，让合成频率与配置帧率一致或可配置。
- 补充 `getRenderInfo()`/新增音频状态字段，区分无音频、AudioContext suspended、connect failed、正常混音。
- 长期拆分模块：`SourceManager`、`LayoutCalculator`、`AudioMixer`、`RenderLoop`，并用构建工具生成 Worker 脚本，减少重复代码。

## Public API / Behavior Notes

- 不建议破坏性修改 `getMixedStream()` 返回结构，避免影响现有调用方。
- 可新增只读状态 API 或事件，例如 `getAudioInfo()`、`onerror`/`onstatechange`，用于补足可观测性。
- 需要明确文档：Mixer 不负责停止外部原始 tracks，只负责释放自身创建的 video、WebAudio 节点、renderer 和 captureStream tracks。
- `HTMLMediaElement` 支持策略需要二选一：只支持 `srcObject=MediaStream`，或正式支持普通 video 元素渲染。

## Test Plan

- Worker 模式下添加源、移除全部源、视频未 ready、track ended，确认输出变为背景色而不是上一帧。
- 多次调用 `getMixedStream()/getVideoStream()`，确认旧流行为符合文档，不产生隐式泄漏。
- 外部 `HTMLVideoElement` 替换 `srcObject`，确认画面和音频都切到新流。
- 无音频源启动，后续 append 有音频源，确认 mixed stream 能补入音轨。
- 高频 `stop()` 与 `getMixedStream()` 交错调用，确认不会使用 destroyed renderer 或 closing AudioContext。
- Chrome、Firefox、Safari 分别验证 `auto` 渲染后端选择、fallback、黑屏/冻结恢复。
- 反复创建和销毁 Mixer，观察 DOM node、AudioContext、GPU/内存是否持续增长。

## Assumptions

- 当前目标是保持 SDK 向后兼容，不改变 `getMixedStream()` 的返回类型。
- `samples/mix` 虽是样本代码，但仍应作为公开集成示例修正。
- 优先修正确性和资源释放问题，结构拆分和构建工具改造放到后续迭代。
