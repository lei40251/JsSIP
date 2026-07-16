# 08 Worker、Streams 与编码帧处理

> 本文沿“能力选择 → 创建 Worker → 建立 Stream 管线 → 处理中止 → 最终释放”说明后台与编码帧能力。

## 1. 本章结论

源码中的 Worker 不是一个统一线程池，而是服务三类独立任务：

1. 页面隐藏时仍希望稳定运行的定时任务。
2. 视频黑帧/像素检测等重计算。
3. `RTCRtpScriptTransform` 编码帧处理。

Web Streams 则把 AudioWorklet PCM、encoded frame 和处理器连接成可中止的管线。旧 `createEncodedStreams()` 与新 `RTCRtpScriptTransform` 是两套互斥或择优路径。

## 2. 能力选择

| 能力 | 检查 | 选择意义 |
|---|---|---|
| Dedicated Worker | `Worker`、Blob URL | 能否把任务移出主线程 |
| Web Streams | Readable/Writable/TransformStream | 能否使用 pipe 管线 |
| 旧 Insertable Streams | sender/receiver `createEncodedStreams` | 主线程或自管 TransformStream 处理编码帧 |
| Script Transform | `RTCRtpScriptTransform` | 在 Worker 的 `onrtctransform` 中处理编码帧 |
| Track Processor/Generator | 对应构造器存在性 | 原始视频帧与 Track 之间桥接 |

源码除特性检测外还结合浏览器版本门槛，避免“属性存在但目标版本不可用”的假阳性。

## 3. 动态 Worker 的创建

多处 Worker 通过源码字符串创建：

```text
worker source string
  → new Blob([source], {type:'text/javascript'})
  → URL.createObjectURL(blob)
  → new Worker(url)
  → URL.revokeObjectURL(url)
```

立即 revoke URL 不会终止已经创建的 Worker；最终仍需要 `worker.terminate()` 或让 Worker 自己退出。

动态源码便于把处理器打包到单文件 SDK，但会受到 CSP `blob:` worker-src 限制。

## 4. Worker 定时器

页面隐藏时，主线程 `setInterval` 可能被强烈节流。源码通过 Worker 消息维持任务：

```text
main: postMessage({type:'start', taskId, delay})
  → worker: setInterval(...)
  → worker: postMessage({type:'tick', taskId})
  → main: dispatch callback
```

停止时必须按 taskId 清 Worker 内 timer，并清主线程 callback Map；只删除主线程回调会让 Worker timer 继续运行。

## 5. Web Streams 管线

基本模型：

```text
ReadableStream
  → pipeThrough(new TransformStream(transformer))
  → pipeTo(WritableStream)
```

管线需要明确：

- backpressure 由哪一层控制。
- transform 抛错后是否允许媒体继续。
- abort/cancel 是否真正传入 pipe 调用。
- Track/PC 重建时旧 readable 是否自然结束。

## 6. AudioWorklet PCM

AudioWorklet 通过 MessagePort 或内部桥接把 PCM/音量数据送到主线程，再转换为 ReadableStream 供处理器消费。

生命周期包括：

- 加载 Worklet module。
- 创建 node 和 port listener。
- 订阅 PCM 数据。
- 结束时关闭 port/订阅并 disconnect node。

PCM 流和 WebRTC encoded frame 不是同一层：前者是音频采样，后者已经过编解码器。

## 7. 黑帧检测 Worker

典型链路：

```text
MediaStreamTrackProcessor readable
  → reader.read() 得到 VideoFrame
  → OffscreenCanvas.drawImage(frame)
  → getImageData()
  → 采样像素计算黑色比例
  → frame.close()
```

每次读取的 VideoFrame 都必须 close；reader、Track 和 Worker 也要在停止检测时释放。像素采样用于诊断，不应阻塞正式播放或发布。

## 8. 旧 `createEncodedStreams()` 路径

发送端：

```text
sender.createEncodedStreams()
  → readable encoded frames
  → TransformStream(SEI/自定义处理)
  → writable back to sender
```

接收端同样从 receiver 取得 readable/writable。常见用途是：

- H.264 SEI 注入和读取。
- NTP/房间信息等旁路数据。
- 编码帧级诊断或扩展处理。

encoded frame 位于编解码器与 SRTP 网络层之间，不是原始 Canvas/PCM 帧。

## 9. `RTCRtpScriptTransform` 路径

主线程：

```text
worker = new Worker(blobUrl)
sender.transform = new RTCRtpScriptTransform(worker, options)
```

Worker：

```text
self.onrtctransform = event => {
  const {readable, writable, options} = event.transformer;
  readable.pipeThrough(transform).pipeTo(writable);
}
```

控制消息通过 `worker.postMessage()` 更新 SEI 列表或运行参数。必须区分“创建 transform 时的 options”和后续控制消息。

## 10. AbortController 的真实接入

源码为 encoded pipe 保存 AbortController，并在同 key 重建时 abort 旧 controller。但只有把 `controller.signal` 正确传给 `pipeTo/pipeThrough` 或处理器，abort 才能实际中止管线。

SPC `reset()` 重建 PC 时没有像最终 `close()` 一样完整遍历并清空 controller Map。旧 PC close 后流通常会结束，但多次重连可能保留旧 Map 项；这是需要运行验证和后续补强的资源风险。

## 11. TrackProcessor/Generator 桥接

支持时可以把 Track 变成 VideoFrame 流，再把处理后帧写入 Generator 形成新 Track：

```text
MediaStreamTrackProcessor(track).readable
  → frame transform
  → MediaStreamTrackGenerator.writable
  → processed MediaStreamTrack
```

这与 Canvas `captureStream()` 是两种输出处理视频的路径。Generator 路径必须保证每个不再使用的 VideoFrame close。

## 12. 错误与降级

- Worker 创建/CSP 失败：回退主线程或不启用可选处理。
- encoded transform 失败：优先保持原始媒体通话，除非能力本身是强制安全要求。
- 黑帧检测失败：停止诊断，不应关闭远端 Track。
- pipe reject：记录原因并清理 controller/readers，避免无观察 Promise。

## 13. 最终释放

```text
停止业务处理
  → abort/cancel Streams
  → release reader/writer lock
  → 关闭 VideoFrame
  → 清 MessagePort listener
  → 停 Worker timer
  → worker.terminate()
  → 清 controller/task Map
```

当前 `SignalTransport.close()` 能处理中止管线和事件，但源码表面未看到 ScriptTransform Worker 的显式 `terminate()`；最终实现应补充或通过运行时证明 Worker 会被安全回收。

## 14. API 参数与本项目实参

### 14.1 动态 Worker 的四步参数链

MDN：[Blob()](https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob)、[URL.createObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)、[Worker()](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker)、[URL.revokeObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static)

Script Transform 和黑帧检测都使用同一模式：

```js
const blob = new Blob([workerSource], { type: 'text/javascript' });
const workerURL = URL.createObjectURL(blob);
const worker = new Worker(workerURL);
URL.revokeObjectURL(workerURL);
```

每一步的参数不能合并理解：

| API | 参数 | 本项目实参 | 含义 |
|---|---|---|---|
| `new Blob(blobParts, options)` | `blobParts` | `[workerSource]`，数组中是一整段字符串代码 | 把内存中的 JS 文本变成 Blob 内容 |
| 同上 | `options.type` | `'text/javascript'` 或 `'application/javascript'` | 只声明 MIME 类型；不会执行代码 |
| 同上 | `options.endings` | `'transparent'` / `'native'` | 未传，默认 `'transparent'` |
| `URL.createObjectURL(object)` | `object` | 上一步 Blob | 得到当前 document 生命周期内可加载的 `blob:` URL |
| `new Worker(scriptURL, options?)` | `scriptURL` | 上一步 blob URL | 立即开始加载独立 Worker |
| 同上 | `options.type` | `'classic'` / `'module'` | 未传，所以是 classic worker；源码使用 `importScripts`/拼接脚本也与 classic 一致 |
| 同上 | `options.credentials/name` | 模块凭据模式/调试名称 | 未传 |
| `URL.revokeObjectURL(url)` | `url` | 同一个 blob URL | Worker 构造后立即撤销 URL 映射；已开始加载的 Worker 继续运行 |

撤销 URL 只释放 URL 映射，不等于 `worker.terminate()`。最终销毁仍应显式终止 Worker；当前 Script Transform/共享 timer 的个别路径需要特别核对这一点。

### 14.2 `worker.postMessage(message, transfer?)`

MDN：[Worker.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage)

| 参数 | 含义 | 本项目实例 |
|---|---|---|
| `message` | 经 structured clone 复制/转移的任意可克隆数据 | timer `{taskId,delay,type}`；黑帧 `{type,trackId,timeout,readable}`；transform 控制 `{type:'sei',data,...}` |
| `transfer` | 可选 transferable 数组；所有权转移而非复制 | 黑帧检测传 `[processor.readable]`；AudioWorklet/MessageChannel 传 `[port]`；PCM 数据传 `[typedArray.buffer]` |

黑帧检测完整调用（L47686—L47694）：

```js
const processor = new MediaStreamTrackProcessor({ track });
worker.postMessage(
  { type: 'addTrack', trackId: track.id, timeout, readable: processor.readable },
  [processor.readable]
);
```

`readable` 同时出现在 message 字段和 transfer list：字段决定 Worker 从 `event.data.readable` 取到它，transfer list 决定 stream 所有权转入 Worker。转移后主线程不能再按原方式读取该 stream。

### 14.3 `new MediaStreamTrackProcessor(options)`

MDN：[MediaStreamTrackProcessor()](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrackProcessor/MediaStreamTrackProcessor)

| option | 含义 | 本项目传值 |
|---|---|---|
| `track` | 必填的输入 MediaStreamTrack | 黑帧检测传远端/本地待检查视频 Track `e` |
| `maxBufferSize` | 部分实现支持的最大排队帧数 | 未传，使用实现默认 |

构造后 `processor.readable` 输出 `VideoFrame`。Worker 内部调用 `readable.getReader()`，循环 `reader.read()` 得到 `{done,value}`；`value` 画到 OffscreenCanvas 后必须 `value.close()`。

### 14.4 `new MediaStreamTrackGenerator(options)` 与 writer

MDN：[MediaStreamTrackGenerator](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrackGenerator)

源码 L43953—L43958：

```js
const generator = new MediaStreamTrackGenerator({ kind: 'video' });
const writer = generator.writable.getWriter();

wrappedTrack.setInputMediaStreamTrack(generator);
decoder.on('videoFrame', frame => writer.write(frame));
```

`options.kind` 必填，本项目固定 `'video'`。生成器本身表现为 MediaStreamTrack，同时暴露 WritableStream。`getWriter()` 无参数并锁定 writable；`writer.write(frame)` 的唯一参数是 VideoFrame，返回 Promise。调用方必须处理背压/拒绝，并在结束时 `writer.close()` 或 `writer.abort()`、释放锁；当前片段没有展示完整 writer 释放，是需要在销毁链核查的点。

### 14.5 `new ReadableStream(underlyingSource, strategy?)`

MDN：[ReadableStream()](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/ReadableStream)

项目自建 stream 时主要只传第一个对象：

```js
new ReadableStream({
  start(controller) {
    source = new GU(input, controller.enqueue.bind(controller),
                          controller.error.bind(controller),
                          controller.close.bind(controller));
  },
  cancel(reason) { /* 断开节点/关闭 port */ }
});
```

| underlyingSource 字段 | 标准含义 | 本项目使用 |
|---|---|---|
| `start(controller)` | 构造时调用，可同步/异步入队 | 保存 controller 的 `enqueue/error/close` 给音频抓取器 |
| `pull(controller)` | 队列需要更多数据时调用 | 这些路径未定义，数据由外部事件主动 push |
| `cancel(reason)` | consumer 取消时释放 source | 断开 AudioNode、关闭 MessagePort 等 |
| `type` | byte stream 可用 `'bytes'` | 未传，普通对象 stream |
| `strategy.highWaterMark/size` | 背压阈值和单项大小算法 | 未传，使用默认策略 |

### 14.6 `new WritableStream(underlyingSink, strategy?)`

MDN：[WritableStream()](https://developer.mozilla.org/en-US/docs/Web/API/WritableStream/WritableStream)

```js
new WritableStream({
  write(chunk) { observer.next(chunk); }
});
```

| sink 方法 | 参数 | 本项目行为 |
|---|---|---|
| `start(controller)` | error controller | 多数路径未定义 |
| `write(chunk, controller)` | 上游每个 chunk | PCM 抓取把 `chunk` 追加到数组；Observable 桥把它转成 next |
| `close()` | 无 | 可在正常完成时收尾；片段未自定义 |
| `abort(reason)` | 中止原因 | 片段未自定义，交给 stream 默认状态机 |

第二个 queuing strategy 未传，因此没有自定义 highWaterMark/size。对高频帧，如果 write 返回的 Promise 长期未完成，`pipeTo()` 会自然传播背压。

### 14.7 `new TransformStream(transformer, writableStrategy?, readableStrategy?)`

MDN：[TransformStream()](https://developer.mozilla.org/en-US/docs/Web/API/TransformStream/TransformStream)

编码帧路径只传 transformer：

```js
new TransformStream({
  transform(frame, controller) {
    const output = wrappedTrack.encodeFrame(frame);
    controller.enqueue(output || frame);
  }
});
```

| transformer 字段 | 含义 | 本项目使用 |
|---|---|---|
| `start(controller)` | 初始化转换器 | 未定义 |
| `transform(chunk, controller)` | 转换每个 chunk | 注入/解析 SEI、音频 NTP、公开编码帧回调；不处理时原帧 enqueue |
| `flush(controller)` | 上游关闭后冲刷缓存 | 未定义 |
| `readableType/writableType` | 保留扩展字段 | 未传 |

两侧 strategy 也未传。transform 回调如果既不 enqueue 也不抛错，相当于丢弃该帧；所以源码在没有处理器时明确 `enqueue(frame)`。

### 14.8 `pipeThrough(transform, options?)` 与 `pipeTo(destination, options?)`

MDN：[pipeThrough()](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/pipeThrough)、[pipeTo()](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/pipeTo)

| options 字段 | 类型/默认 | 含义 | 本项目 |
|---|---|---|---|
| `preventClose` | boolean，默认 false | 上游关闭时不关闭目标 | 未设置 |
| `preventAbort` | boolean，默认 false | 上游报错时不 abort 目标 | 未设置 |
| `preventCancel` | boolean，默认 false | 目标报错时不 cancel 上游 | 未设置 |
| `signal` | `AbortSignal` | 外部中止整个 pipe | 通过 AbortController 对象的 `.signal` 属性提供 |

编码发送路径的源码形态是：

```js
const controller = new AbortController();
readable
  .pipeThrough(transformStream, controller)
  .pipeTo(writable, controller)
  .catch(handlePipeError);
```

标准第二参数需要一个 options 对象；`AbortController` 实例本身正好暴露 `signal` 属性，所以这里结构上等价于传 `{signal: controller.signal}`，其余 prevent* 字段缺失并采用 false。代码随后把 controller 按 sender/receiver 键保存，释放时调用 `controller.abort('destroy')`。

### 14.9 `new AbortController()` 与 `abort(reason?)`

MDN：[AbortController()](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/AbortController)、[abort()](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort)

构造器无参数，生成只读 `signal`。`abort(reason?)` 的 reason 可为任意值；项目常传 `'destroy'`、`'cancelled'`、`'timeout'`、`'download'`，用于 catch 时区分正常释放和异常。

同一 sender/receiver 已存在 controller 时源码拒绝重复建 pipe；这防止一个 encoded stream 被多次消费。重建 PC 时必须同时删除旧 Map 项，否则即使旧 stream 已自然结束，Map 仍可能阻止新对象或积累引用。

### 14.10 `new RTCRtpScriptTransform(worker, options, transfer?)`

MDN：[RTCRtpScriptTransform()](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpScriptTransform/RTCRtpScriptTransform)

发送端：

```js
sender.transform = new RTCRtpScriptTransform(worker, {
  isReceiver: false,
  isAudio: mediaType === 1,
  isMain: mediaType !== 2,
  isSmall: mediaType === 8
});
```

接收端：

```js
receiver.transform = new RTCRtpScriptTransform(worker, {
  isReceiver: true,
  isAudio,
  userId: this.userId,
  streamType
});
```

| 参数 | 标准含义 | 本项目实参 |
|---|---|---|
| `worker` | 处理 encoded frames 的 Worker | 房间级 `scriptTransformWorker`，由动态 Blob 脚本创建 |
| `options` | structured-clone 到 Worker 的 `event.transformer.options` | 项目自定义路由元数据，决定发送/接收、音视频、主辅/小流和用户 |
| `transfer` | 可选 transferable 列表 | 未传 |

Worker 中 `self.onrtctransform` 从 `event.transformer` 取 `readable/writable/options`，再按 options 选择管线。options 不是浏览器预定义字段；字段名和语义完全由本项目 Worker 代码约定。

### 14.11 Worker 终止与 reader/writer 释放

MDN：[Worker.terminate()](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate)、[ReadableStreamDefaultReader.cancel()](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/cancel)、[releaseLock()](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/releaseLock)

- `worker.terminate()` 无参数，立即终止 Worker，不等待 finally；适合最终销毁，不适合希望 worker 自己 flush 的场景。
- `reader.cancel(reason?)` 告诉 source 不再需要数据；黑帧 Worker 传 `'timeout'/'black'/'error'` 等项目原因。
- `reader.releaseLock()` / `writer.releaseLock()` 无参数，只释放锁，不自动 cancel/close stream。

当前黑帧 Worker 会 cancel reader、清 timer 和 Map；Script Transform 的正文源码主要依赖 pipe abort/PC close。最终文档把未见明确 `terminate()` 的路径列为资源核查点，而不把“撤销 blob URL”误写成 Worker 已释放。

## 15. 事实与边界

### 可以直接确认

- 旧 Insertable Streams 和 Script Transform 两套路径同时存在。
- Worker 用于定时、黑帧和编码帧处理。
- encoded 管线与 PC/Sender/Receiver 生命周期绑定。
- 黑帧路径显式处理 VideoFrame 和 OffscreenCanvas。

### 合理推断

- Script Transform 用于把编码帧处理移出主线程并适配新版浏览器接口。
- Worker timer 用于降低页面隐藏节流对心跳/采样的影响。

### 不能确认

- 每个浏览器版本的 encoded frame 格式和 Worker 回收行为，需要真实运行验证。
