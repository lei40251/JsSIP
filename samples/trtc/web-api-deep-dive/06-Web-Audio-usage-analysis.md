# 06 Web Audio 使用分析

> 本文沿“Context → 输入 → 处理图 → 输出 → 播放恢复 → 释放”说明 SDK 的音频处理。

## 1. 本章结论

Web Audio 在源码中承担四种职责：

1. 把麦克风或远端 Track 接入 AudioNode 图。
2. 执行音量、混音、耳返、降噪/AEC 参考等处理。
3. 通过 MediaStreamDestination 重新生成可发布 Track。
4. 在浏览器自动播放限制下恢复 AudioContext 和媒体元素。

AudioContext、AudioNode、原生 Track 和 Player 分属不同资源层，必须分别关闭。

## 2. AudioContext 的创建和状态

源码优先使用标准 `AudioContext`，旧 Safari 可由 Adapter 映射 `webkitAudioContext`。

关键状态：

| 状态 | 含义 | SDK 动作 |
|---|---|---|
| `suspended` | 尚未获得播放手势或被浏览器暂停 | 用户交互后 `resume()` |
| `running` | AudioNode 图正常推进 | 正常采集、处理或播放 |
| `closed` | 已永久关闭 | 不能再次 resume，需要新建 |

多个 Track 可以共享上下文，但共享意味着最终 close 必须由 AudioContext 管理器统一决定，单个 Track 不应随意关闭全局 Context。

## 3. 输入怎样进入处理图

```text
MediaStreamTrack
  → new MediaStream([track])
  → audioContext.createMediaStreamSource(stream)
  → source AudioNode
```

输入可能来自：

- 本地麦克风 source track。
- 屏幕系统音频。
- 背景音乐或 URL 媒体元素。
- 远端接收 Track。
- AI 降噪或其他处理器的中间输出。

创建 source node 后仍要保存 Track 与 Node 的对应关系，换轨时才能只替换目标输入。

## 4. AudioPipeline 的主干

典型处理图：

```mermaid
flowchart LR
    Track["source track"] --> Source["MediaStreamAudioSourceNode"]
    Source --> Processor["Worklet / processor / AI NS"]
    Processor --> Gain["GainNode"]
    Gain --> Meter["Analyser / volume worklet"]
    Meter --> Destination["MediaStreamDestination"]
    Destination --> Out["outMediaTrack"]
```

实际分支可跳过某些节点。处理图包装需要支持：

- 动态 connect/disconnect。
- 换输入而尽量保留后续节点。
- 节点失败时回退原始 Track，让通话继续。
- close 时按所有权释放 Worklet、port、listener 和 Node。

## 5. 输出重新变成可发布 Track

```text
audioContext.createMediaStreamDestination()
  → destination.stream.getAudioTracks()[0]
  → LocalAudioTrack.outMediaTrack
  → RTCRtpSender.replaceTrack(outMediaTrack)
```

这解释了为什么麦克风 source track 和 sender track 可能不是同一个对象。停止麦克风时，必须同时处理 source 和 destination Track。

## 6. 音量检测的两条路径

| 路径 | 输入/输出 | 特点 |
|---|---|---|
| `AnalyserNode` | `getByteTimeDomainData()` 等 | 简单、兼容广，通常在主线程采样 |
| AudioWorklet | PCM/音量经 `MessagePort` 或 Stream 输出 | 更稳定地运行在音频渲染线程，生命周期更复杂 |

音量值不是 Stats 的网络音量，也不是浏览器媒体元素 `volume`；它来自 PCM 或波形采样。

采样器必须避免：

- 重复创建 timer。
- Track ended 后仍轮询。
- Worklet port listener 未解绑。
- 页面隐藏后主线程 timer 大幅漂移。

## 7. Gain、混音和耳返

- `GainNode.gain` 控制处理图增益，不等同于发送端编码码率。
- 多个 source 可以连接到同一 destination 完成混音。
- 耳返把本地处理结果连接到播放 destination，同时要防止回声路径。
- AEC 参考需要明确哪一路是扬声器播放参考，不能简单把所有节点相连。

节点图动态变化时，先 connect 新路径，再 disconnect 旧路径可以降低音频间断；但要避免同一路重复连接造成音量叠加。

## 8. 播放器怎样接入 AudioContext

音频可以直接由 `<audio srcObject>` 播放，也可以先进入 Web Audio：

```text
remote track
  ├─ HTMLAudioElement 直接播放
  └─ MediaStreamSource → gain/processor → audioContext.destination
```

是否使用 Web Audio 取决于音量、输出、混音和处理需求。`setSinkId()` 属于媒体元素输出设备能力，AudioContext destination 的输出设备控制受浏览器支持限制，不能混为一谈。

## 9. 自动播放恢复有两层

浏览器可能同时阻止：

1. `AudioContext` 从 suspended 进入 running。
2. `HTMLMediaElement.play()` Promise。

恢复流程应在真实用户手势中同时尝试：

```text
user click/touch
  → audioContext.resume()
  → 对待播放 audio/video 再次 play()
  → 成功后移除交互提示和一次性 listener
```

只 resume Context 不能保证媒体元素播放；只重试 play 也不能保证处理图推进。

## 10. 状态与错误

- `NotAllowedError` 通常表示自动播放或权限限制，不应无限后台重试。
- Worklet 加载失败时应保留原始 Track 或兼容处理路径。
- Context closed 后调用 resume 是逻辑错误，需要重新创建资源。
- Node disconnect 通常允许重复调用，但 wrapper 状态必须防止重复业务事件。

## 11. 释放顺序

```text
停止发布/播放
  → 解绑音量和 port listener
  → 停 Worklet/processor 任务
  → disconnect source/processor/gain/analyser/destination
  → stop 独立生成的 destination track
  → 清 MediaStream 和 Node 引用
  → 若无人使用，再由管理器 close AudioContext
```

只 `track.stop()` 不会自动断开所有 AudioNode；只 `disconnect()` 也不会停止原生采集设备。

## 12. API 参数与本项目实参

### 12.1 `new AudioContext(options)`

MDN：[AudioContext()](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext)

源码 L18454—L18492 先按 `AudioContext → webkitAudioContext → mozAudioContext` 选择构造器，再创建全局单例：

```js
IV = new AudioContextClass({ sampleRate: 48000 });
IV.onstatechange = () => {
  logger.info(`context state: ${IV.state}`);
  observableCreate();
};
```

| option | 标准含义/可选值 | 本项目传值 |
|---|---|---|
| `latencyHint` | `'interactive'`、`'balanced'`、`'playback'` 或期望秒数；提示浏览器在延迟和功耗间取舍 | 未传，使用浏览器默认 |
| `sampleRate` | 目标采样率，必须是实现支持的值 | 固定 `48000` Hz，与 WebRTC 常用音频时钟和屏幕音频约束一致 |
| `sinkId` | 支持浏览器可指定输出设备或静音 sink | 构造时未传；播放器输出设备另走 `setSinkId()` |
| `renderSizeHint` | 新/实验选项，用于提示渲染 quantum 大小 | 未传 |

构造器可能因不支持采样率、资源上限或缺少实现而抛错，所以源码捕获后每 1000 ms 重试。该单例由所有音频 Track、Player 和混音图共享，不是每条 Track 一个 Context。

### 12.2 `audioContext.resume()` 与 `suspend()`

MDN：[resume()](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume)、[suspend()](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/suspend)

两个方法都无参数并返回 Promise。

```js
if (context.state === 'running') return resolve();
context.resume().then(resolve, reject);
```

本项目对 `resume()` 做 1 秒节流：距上次调用不足 1 秒时，先清旧 timer，再 `setTimeout(..., 1000)`；成功后不返回新 Track，只表示渲染时钟恢复。失败会监听 `visibilitychange`，并保留 click 恢复入口。

当检测到 `state==='running'` 但 `currentTime` 长时间不增长时，源码调用无参 `suspend()`，等待状态机随后重新 resume。这是修复“假 running”，不是用户暂停播放。

### 12.3 `createMediaStreamSource(stream)`

MDN：[createMediaStreamSource()](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamSource)

唯一参数必须是 `MediaStream`。项目持有的输入通常是单条 `MediaStreamTrack`，所以先包装：

```js
sourceNode = audioCtx.createMediaStreamSource(
  new MediaStream([sourceTrack])
);
```

这里 `sourceTrack` 是麦克风、屏幕音频、远端音频或调用方自定义音频 Track。临时 MediaStream 只为满足 Web Audio API 参数类型；节点读取的仍是同一条原生 Track，没有 clone，也不会接管其 stop 生命周期。

### 12.4 `createMediaElementSource(element)`

MDN：[createMediaElementSource()](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaElementSource)

唯一参数是 `HTMLMediaElement`。`getOrCreateAudioNode(source)` 在 `source instanceof HTMLAudioElement` 时传入这个元素；否则若是 `MediaStreamTrack` 才走上一节。创建后元素的音频被路由到 AudioContext 图，必须把节点继续连接到 destination 才能听见。

项目用 `WeakMap` 以 source 对象为键缓存节点，因为同一个 media element 通常不能在同一 Context 中重复创建多个 `MediaElementAudioSourceNode`。

### 12.5 `createMediaStreamDestination()`

MDN：[createMediaStreamDestination()](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination)

该方法没有参数，返回 `MediaStreamAudioDestinationNode`。其 `stream` 属性包含处理后的音频 Track：

```js
this.destination = audioContext.createMediaStreamDestination();
this.destination.channelCount = 1;

get mixTrack() {
  return this.destination.stream.getAudioTracks()[0];
}
```

因此 Web Audio 图的“输出”不是扬声器，而是一个新的可发布 Track。项目将 destination 声道数设为 1；混音后的 `mixTrack` 随后进入 Track 包装，再进入 sender `replaceTrack()`。

### 12.6 `createGain()` 与 `gain.value`

MDN：[createGain()](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createGain)、[GainNode.gain](https://developer.mozilla.org/en-US/docs/Web/API/GainNode/gain)

`createGain()` 无参数，返回 `GainNode`；增益通过 `gain` 这个 `AudioParam` 设置。源码：

```js
if (volume !== 1) {
  gainNode ||= audioContext.createGain();
  gainNode.gain.value = volume;
} else {
  deleteGainNode();
}
```

`volume` 是 SDK 归一化后的线性倍率，不是 dB。`1` 表示原幅度并直接删除多余节点；`0` 静音；大于 `1` 会放大并可能削波。耳返也创建独立 GainNode，把公开耳返音量写入 `gain.value`。

项目使用直接赋 `value`，没有调用 `setValueAtTime()` 或 ramp，因此这是立即变化，不是平滑渐变。

### 12.7 `AudioNode.connect(destination, output?, input?)`

MDN：[connect()](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/connect)、[disconnect()](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/disconnect)

包装层 `_connect(e, t=0)` 最终执行：

```js
(this.node2 || this.node).connect(destinationNode, 0, inputIndex);
```

| 参数 | 标准含义 | 本项目传值 |
|---|---|---|
| `destination` | 目标 `AudioNode` 或 `AudioParam` | 包装对象下一节点的原生 node |
| `output` | 源节点输出口索引，默认 `0` | 固定 `0` |
| `input` | 目标节点输入口索引，默认 `0` | `pipeTo(next, index)` 保存的 index；AEC 混音支路显式用 `1`，主链用 `0` |

主链是 `source → aec → denoiser → voiceChanger → gain → destination`；静音参考支路是 `silentNode → mixNode → aec(input 1)`。这里的第二路输入是图拓扑参数，不是声道号。

`disconnect(destination)` 的参数是之前连接的目标节点。项目遍历 `connectedNodes` 精确断开，再清 Set；不是无参断开全部，以免误伤同一个源的其他有效分支。

### 12.8 `audioWorklet.addModule(moduleURL, options?)`

MDN：[AudioWorklet.addModule()](https://developer.mozilla.org/en-US/docs/Web/API/Worklet/addModule)

| 参数 | 含义 | 本项目传值 |
|---|---|---|
| `moduleURL` | 包含 `registerProcessor()` 的脚本 URL | `URL.createObjectURL(new Blob([processorCode], {type:'application/javascript'}))` 产生的 blob URL |
| `options.credentials` | `'omit'`、`'same-origin'`、`'include'`，控制跨源凭据 | 未传；blob URL 不需要跨源凭据 |

返回 Promise；成功后才能创建相同 processor name 的 AudioWorkletNode。失败就降级到 ScriptProcessor，不把整条通话判失败。

### 12.9 `new AudioWorkletNode(context, name, options?)`

MDN：[AudioWorkletNode()](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode/AudioWorkletNode)

音量检测实例的原生调用是：

```js
new AudioWorkletNode(audioContext, 'volume-meter');
```

| 参数 | 含义 | 本项目实参 |
|---|---|---|
| `context` | 已注册模块的 AudioContext | 全局音频 context |
| `name` | processor 在 `registerProcessor(name, class)` 中注册的名称 | 固定 `'volume-meter'` |
| `options.numberOfInputs/numberOfOutputs/outputChannelCount` | 节点 I/O 布局 | 未传，使用 processor/浏览器默认 |
| `options.parameterData` | AudioParam 初始值 | 未传 |
| `options.processorOptions` | 结构化克隆给 processor 构造器的自定义数据 | 未传 |
| `options.channelCount/channelCountMode/channelInterpretation` | 声道处理策略 | 未传 |

节点的 `port.onmessage` 接收 worklet 回传对象；源码读取 `event.data.volume`、`volumeDb`、`cacheLen`、`outputLen`。这一步没有额外 API 参数，但字段是项目自定义消息协议，不属于 Web Audio 标准字段。

### 12.10 `createAnalyser()` 与 `getByteTimeDomainData(array)`

MDN：[createAnalyser()](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createAnalyser)、[getByteTimeDomainData()](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getByteTimeDomainData)

`createAnalyser()` 无参数。包装器默认 `fftSize=256`，设置后按 `frequencyBinCount` 创建 `Uint8Array`：

```js
analyser.fftSize = 256;
dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteTimeDomainData(dataArray);
```

`getByteTimeDomainData(array)` 的唯一参数是由调用方提供并被原地写入的 `Uint8Array`；没有返回新数组。项目用最大样本值近似音量，也用数组生成波形路径。`fftSize` 必须是允许的 2 次幂范围；本项目固定 256。

### 12.11 `createScriptProcessor(bufferSize, inputChannels, outputChannels)` fallback

MDN：[createScriptProcessor()](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createScriptProcessor)

这是已废弃的兼容 API，仅在 AudioWorklet 初始化失败时使用：

```js
audioContext.createScriptProcessor(2048, 1, 1);
```

| 参数 | 本项目值 | 含义 |
|---|---:|---|
| `bufferSize` | `2048` 帧 | 每次 `audioprocess` 回调的缓冲大小；越大越稳但延迟更高 |
| `numberOfInputChannels` | `1` | 单声道输入 |
| `numberOfOutputChannels` | `1` | 单声道输出 |

回调读取 `event.inputBuffer.getChannelData(0)`；参数 `0` 是第一声道，返回 `Float32Array`。项目计算均方根音量。销毁时将 `onaudioprocess=null`，避免继续持有实例回调。

### 12.12 释放边界

原生 `AudioContext.close()` 无参数并返回 Promise，但当前全局单例在普通 Track close 中没有关闭，因为其他 Track/Player 仍可能共用。单条 Track 的释放只删除/断开自己创建的 nodes、port 监听和处理器引用。若在单 Track stop 时关闭全局 Context，会同时破坏其他音频链。

## 13. 事实与边界

### 可以直接确认

- source Track 可以经 AudioNode 图产生独立 out Track。
- 音量检测同时存在 Analyser 和 Worklet 路径。
- 自动播放恢复同时涉及 Context 和媒体元素。
- 音频管线失败时应尽量回退，保证通话继续。

### 合理推断

- 全局 Context/Manager 用于减少多 Track 重复创建音频上下文。
- 动态节点包装是为了在设备切换和处理器开关时保留稳定输出。

### 不能确认

- 浏览器内部 AEC、AGC、NS 与 SDK 自定义处理的精确组合效果，需要真实设备和声学环境验证。
