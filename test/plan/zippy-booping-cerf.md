# Mixer.js 混流方法工程化分析报告

## 背景

对 `lib/Mixer.js`（MediaStreamMixer）及其渲染子系统（`lib/mixer-renderer/`）进行系统性代码审查，从工程化角度诊断架构、资源管理、错误处理、性能、可维护性等方面的问题。

---

## 一、资源管理与内存泄漏（高风险）

### 1.1 样本/Demo 中的 Mixer 实例泄漏
**涉及文件**: `samples/mix/js/app.js`, `samples/mix/js/webrtc.sip.js`

- **问题**: Mixer 实例创建后从未调用 `stop()`。`getMixedStream()` 启动的 `requestAnimationFrame` 循环绑定在 `window` 上，即使局部变量 `mix` 离开作用域，渲染循环和 AudioContext 仍持续运行。
- **影响**: 持续消耗 CPU（rAF）、GPU（WebGL 纹理）、内存（audio node graph），长连通话场景下累积严重。
- **对比**: `demo/base-js/mixer.html` 展示了正确的双阶段清理模式（`mixer.stop()` → 外部 track stop）。

### 1.2 `stop()` 中 AudioContext.close() 未 await
**位置**: `Mixer.js:1248-1250`

```js
this._audioContext.close();  // 返回 Promise，未 await
```

- **问题**: close() 是异步操作，不 await 可能导致 AudioContext 在后续代码执行时仍处于 closing 状态，close 抛异常，或 gc 无法回收资源。
- **叠加风险**: stop() 执行期间如果外部恰好调用 getMixedStream()（重置 `_isStopDrawingFrames = false`），两套逻辑竞态操作同一组资源。

### 1.3 `_capturedStreams` 管理脆弱
**位置**: `Mixer.js:1500-1509`

- 多次调用 `getVideoStream()` 会停止旧的 capturedStream 的 tracks。如果外部代码保留了旧 `mixedStream` 引用，其 video track 会被突然 stop。
- `_capturedStreams` 在 `getMixedStream()` 路径中由 `getVideoStream()` 清理，但 `getMixedStream()` 也在 `_mixedStream` 中保存了引用，stop 时 track.stop() 可能让调用方持有的流突然静默。

### 1.4 隐藏 video 元素泄漏风险
**位置**: `Mixer.js:1048-1061`

- `appendStream()` 为每个 MediaStream 创建隐藏 `<video>`，`removeStream()` 中 `_removeSource()` 会清理 ownedVideo。
- 但如果调用方先释放 Mixer 引用而不调 `stop()`（GC 不保证立即调用析构），这些隐藏 video 元素会持续存在 DOM 中并保持媒体流活跃。

---

## 二、错误处理与边界情况（中高风险）

### 2.1 rAF 渲染循环无异常保护
**位置**: `Mixer.js:1014-1035`

```js
_drawVideosToCanvas()
{
    if (this._isStopDrawingFrames) return;
    const payload = this._createRenderPayload();
    this._ensureRenderer().render(payload);  // 无 try-catch
    if (this._sources.length > 0)
        this._animationId = window.requestAnimationFrame(...);
}
```

- **问题**: `_createRenderPayload()` 或 `renderer.render()` 任一抛出异常，rAF 链断裂，后续所有帧停止渲染。没有任何恢复/重试机制。
- **建议**: 至少用 try-catch 包裹，记录 error 后继续调度下一帧。

### 2.2 `_mediaStreamToVideoElement` 静默吞错误
**位置**: `Mixer.js:1058`

```js
video.play().catch(() => { logger.error('video play error'); });
```

- **问题**: 错误信息过于笼统（无 video id、无 stream id、无具体 error），不抛异常也不通知调用方。在 hidden tab 或 autoplay 被浏览器策略阻止时，调用方不知道某路源渲染失败。
- **影响**: 用户看到黑画面但无从排查。

### 2.3 `getAudioStream()` 返回 null 时静默降级
**位置**: `Mixer.js:1461-1463`

```js
const mixedAudioStream = await this.getAudioStream();  // 可能返回 null
this._addAudioTracksToStream(mixedVideoStream, mixedAudioStream);  // 接受 null
```

- **问题**: 调用方拿到 mixedStream 发现没有 audio track，无法区分是"无音频源"还是"音频初始化失败"。
- **建议**: 通过返回值（如 `{ stream, hasAudio }`）或 callback 告知音频状态。

### 2.4 AudioContext 自动播放策略处理不足
**位置**: `Mixer.js:1527-1535`

- `resume()` 可能被浏览器策略阻止（未发生用户交互前），此时 `_audioContext.state` 仍为 'suspended'，`createMediaStreamSource()` 可能抛异常。
- 当前只在连接每个 source 时有 try-catch，但 AudioContext 初始化本身没有 robust 的重试机制。

---

## 三、架构设计问题（中等风险）

### 3.1 workerScript.js 代码重复严重
**涉及文件**: `lib/mixer-renderer/workerScript.js`

| 组件 | 主线程 | Worker 重复 |
|------|--------|------------|
| 颜色解析 | `helpers/color.js`（94行） | 内联 ~60 行 |
| Shader 编译 | `helpers/gl.js`（73行） | 内联 ~40 行 |
| 纹理管理 | `MainWebGL2Renderer._getTexture()` | 内联 `getTexture()` |
| Viewport 计算 | `MainWebGL2Renderer._drawItem()` | 内联在 `renderWebGL2()` |

- **原因**: Worker 脚本以字符串形式传递，无法模块化引用。
- **影响**: 修改主线程渲染逻辑时必须同时更新 workerScript.js 的对应代码，极易遗漏，导致两路径行为不一致。
- **建议**: 将共享逻辑提取为独立模块，通过构建工具（如 Rollup/Webpack）打包为 Worker 字符串，而非手写字符串拼接。

### 3.2 `getVideoStream()` 同步返回但实际渲染异步
**位置**: `Mixer.js:1474-1511`

- `getVideoStream()` 调用 `_drawVideosToCanvas()` 尝试立即渲染第一帧，然后 `canvas.captureStream()` 输出流。
- 但 WebGL2 路径中 `texImage2D` 可能尚未完成 GPU 上传，Worker 路径可能第一帧还在队列中。
- 调用方得到的第一个帧可能是黑屏/空画布。

### 3.3 布局计算在大 slot 场景下浪费空间
**位置**: `Mixer.js:783-849`

- `_calcLayout()` 按 `maxSlot` 计算网格。如果只用了 slot 0 和 slot 100，会计算出 10x10 网格，造成大量空白区域。
- 使用时需要注意 slot 分配的连续性，没有自动压缩 slot 的能力。

### 3.4 `_canvas.stream` 非标准属性
**位置**: `Mixer.js:1508`

```js
this._canvas.stream = capturedStream;
```

- 在 DOM 元素上设置自定义属性可能与其他库冲突，且不是可枚举的属性模式。
- Chrome 的未来版本可能对 HTMLCanvasElement 的扩展属性更严格。

---

## 四、并发与竞态条件（中等风险）

### 4.1 `stop()` 与 `getMixedStream()` 互斥无保护

```
stop():                          getMixedStream():
  _isStopDrawingFrames = true      _isStopDrawingFrames = false
  cancelAnimationFrame             _drawVideosToCanvas()
  clearStreams()                   canvas.captureStream()
  _audioContext.close()            getAudioStream()
  _renderer.destroy()
```

- 两个方法可以交错执行。如果 `stop()` 之后马上调用 `getMixedStream()`，可能使用已被 destroy 的 renderer 或 closed 的 AudioContext。
- **建议**: 添加 `_destroyed` 状态标记，`getMixedStream/getVideoStream` 检查该标记后抛异常或返回错误。

### 4.2 多次 `getVideoStream()` 的流停止问题
- 每次调用 `getVideoStream()` 会停止之前的 capturedStream。如果用旧的 `getMixedStream()` 返回的流已经传给 `RTCPeerConnection.addTrack()`，track 突然 stop 会导致对端触发 `track.onended`。

---

## 五、性能问题（低中风险）

### 5.1 每帧纹理全量上传
- WebGL2 渲染器每帧调用 `texImage2D` 将完整 video 帧上传到 GPU。对于 4K 源或同时渲染 9+ 路，带宽开销显著。
- 浏览器内部可能有优化（零拷贝），但不能依赖。

### 5.2 WorkerRenderer 的 createImageBitmap 延迟
- `createImageBitmap(video)` 是异步操作，增加了帧到达 Worker 的延迟。
- 虽然通过丢帧机制避免队列堆积，但增加了帧处理的端到端延迟（可能 1-2 帧），在实时场景中敏感。

### 5.3 legacy 模式下频繁 resize canvas
- `_createLegacyRenderPayload()` 每次调用都可能改变 canvas 尺寸，导致浏览器清空画布内容。
- grid 模式有 `_prepareModernCanvas()` 的尺寸保护，但 legacy 模式没有。

---

## 六、代码可维护性（低风险）

### 6.1 单一文件过长
- `Mixer.js` 1557 行，`workerScript.js` 512 行。虽然内部有章节分隔注释，但整体可读性仍受影响。
- 建议将布局计算（`_calcLayout`、`_scaleVideo` 等）或音频管理拆分为独立模块。

### 6.2 注释过于冗长
- JSDoc 注释面面俱到，但许多对理解代码无帮助（如 "归一化slot值" 的方法描述比实际代码还长）。
- 约 30% 的文件内容是注释，对于核心代码来说维护负担较重。

### 6.3 Logger 使用不统一
- 不同位置使用不同级别的日志（error/warn/debug），但 Logger 本身没有暴露级别过滤功能。
- 线上环境不带问题时 debug 日志不会输出，但 error/warn 可能也无法被调用方捕获。

---

## 优化建议优先级

| 优先级 | 类别 | 建议 | 涉及文件 |
|--------|------|------|---------|
| P0 | 资源泄漏 | 确保所有 Mixer 使用方调用 `stop()` | samples/mix/js/app.js, webrtc.sip.js |
| P0 | 错误处理 | rAF 循环添加 try-catch 保护 | Mixer.js:1014-1035 |
| P0 | 错误处理 | `_mediaStreamToVideoElement` 错误信息增强 | Mixer.js:1058 |
| P1 | 竞态条件 | 添加 `_destroyed` 标记保护状态 | Mixer.js |
| P1 | 资源管理 | `stop()` 中 await AudioContext.close() | Mixer.js:1248-1250 |
| P1 | API 清晰性 | `getAudioStream()` 明确告知调用方音频不可用 | Mixer.js:1461-1463 |
| P1 | 代码质量 | 通过构建工具解决 workerScript.js 代码重复 | workerScript.js, package.json |
| P2 | 性能 | 评估 canvas 频繁 resize 的影响 | Mixer.js _createLegacyRenderPayload |
| P2 | 兼容性 | 为不支持 `captureStream` 的浏览器提供 fallback 提示 | Mixer.js |
| P2 | 可维护性 | 将布局计算抽为独立模块 | Mixer.js |

---

## 验证方法

1. **资源泄漏验证**: 反复创建/销毁 Mixer 实例，观察 DevTools Performance/Memory 面板中 DOM node 数和 GPU 内存是否持续增长
2. **错误处理验证**: 构造异常场景（关闭摄像头、断开音频设备、Worker 初始化失败），确认渲染循环不崩溃
3. **竞态条件验证**: 高频率交替调用 `stop()` 和 `getMixedStream()`，确认无异常抛出
4. **浏览器兼容性**: 在 Chrome、Firefox、Safari 上分别测试 auto 模式的后端选择是否符合预期
