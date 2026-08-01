# 最近媒体模块公开命名迁移说明

本文记录 `RTCStatsMonitor`、`AiNoiseSuppression`（AiNS）和
`MediaEffectsComposer` 最近一次公开命名精简。内容面向 SDK 接入方，说明旧名、
新名、使用位置、用途及迁移方式。

## 1. 迁移范围与结论

- 本次改名是破坏性变更，源码中没有保留旧名称兼容别名。
- 已同步 SDK 源码、TypeScript 声明、测试、文档以及
  `demo/base-js/`、`samples/base-js-mh/` 中的示例。
- 事件名、事件 payload 结构、默认时序和方法行为没有因为本次命名精简而改变。
- 接入方只需要修改实际使用到的旧名称；没有使用对应模块时无需调整。
- AiNS 中标记为“直接模块 API”的名称，只影响直接导入
  `lib/AiNoiseSuppression/` 源模块的代码。通过 `RTCSession` 使用 AiNS 的普通接入方
  通常只需要迁移 `level` 和 `setLevel()`。

## 2. RTCStatsMonitor

### 2.1 使用入口

通话会话创建 PeerConnection 后，SDK 会自动创建监控器，可以从会话获取：

```js
const monitor = rtcSession.statsMonitor;

if (monitor)
{
  const quality = monitor.getNetworkQuality();
  const report = monitor.getReport();
}
```

也可以独立创建：

```js
const monitor = new CRTC.RTCStatsMonitor(peerConnection, {
  sampleIntervalMs : 2000,
  reportIntervalMs : 2000,
  timeoutMs        : 5000
});
```

`CRTC.getStats` 仍是 `CRTC.RTCStatsMonitor` 的历史导出别名，本次没有修改。

### 2.2 方法改名

| 旧名 | 新名 | 所属对象 | 用途和返回值 |
| --- | --- | --- | --- |
| `markTransition(reason)` | `markChange(reason)` | `RTCStatsMonitor` | 显式标记换轨、重协商、设备切换等媒体变化。之后的若干样本处于过渡期，监控器会暂缓瞬时质量告警。无返回值。SDK 的 `RTCSession` 会在媒体变化时自动调用，独立使用监控器时才通常需要手动调用。 |
| `getLatestReport()` | `getReport()` | `RTCStatsMonitor` | 返回最近一次完整诊断报告 `DetailedReport`；尚未完成有效采样时返回 `null`。只读取快照，不会主动调用 `getStats()`。 |
| `getLatestLegacyReport()` | `getLegacyReport()` | `RTCStatsMonitor` | 返回最近一次兼容格式报告 `LegacyReport`；对应 `report` 事件的数据结构。尚无报告时返回 `null`。 |
| `getLatestNetworkQuality()` | `getNetworkQuality()` | `RTCStatsMonitor` | 返回最近一次网络质量报告 `NetworkQualityReport`；对应 `network-quality` 事件的数据结构。尚无报告时返回 `null`。 |

迁移示例：

```js
// 旧写法
monitor.markTransition('replace-track');
const detailed = monitor.getLatestReport();
const legacy = monitor.getLatestLegacyReport();
const quality = monitor.getLatestNetworkQuality();

// 新写法
monitor.markChange('replace-track');
const detailed = monitor.getReport();
const legacy = monitor.getLegacyReport();
const quality = monitor.getNetworkQuality();
```

事件监听方式没有改名：

```js
monitor.on('detailed-report', (report) => {
  console.log(report);
});

monitor.on('report', (report) => {
  console.log(report);
});

monitor.on('network-quality', (report) => {
  console.log(report.level);
});
```

### 2.3 构造选项改名

这些属性用于 `new CRTC.RTCStatsMonitor(pc, options)` 的第二个参数。

| 旧属性 | 新属性 | 类型 / 默认值 | 用途 |
| --- | --- | --- | --- |
| `legacyReportIntervalMs` | `reportIntervalMs` | `number`, 默认 `2000` ms | 控制兼容 `report` 和 `network-quality` 事件的输出间隔。实际值不会小于前台采样间隔 `sampleIntervalMs`。 |
| `backgroundSampleIntervalMs` | `bgIntervalMs` | `number`, 默认 `2000` ms | 页面进入后台后使用的采样间隔。实际值不会小于 `sampleIntervalMs`。 |
| `transitionGraceSamples` | `transitionSamples` | `number`, 默认 `2` | 媒体变化后作为过渡期处理的样本数量。过渡期内保留统计，但暂缓将瞬时变化解释为质量问题。小于 `0` 的值按 `0` 处理。 |
| `enableDetailedReport` | `detailedReport` | `boolean`, 默认 `true` | 是否记录常用诊断摘要并发送 `detailed-report` 事件。关闭后仍可保留兼容报告路径。 |
| `enableRawStatsLog` | `rawStatsLog` | `boolean`, 默认 `true` | 是否按限频规则记录脱敏后的原始 RTC stats 日志。此项控制日志，不改变 `getReport()` 的读取方式。 |
| `rawStatsLogIntervalMs` | `rawLogIntervalMs` | `number`, 默认 `10000` ms | 原始 stats 日志的最小输出间隔，最小值为 `1000` ms。 |
| `getStatsTimeoutMs` | `timeoutMs` | `number`, 默认 `5000` ms | 单次 `RTCPeerConnection.getStats()` 的超时时间，最小值为 `100` ms。超时会产生统计错误，但不会中断通话。 |

完整新配置示例：

```js
const monitor = new CRTC.RTCStatsMonitor(peerConnection, {
  sampleIntervalMs  : 2000,
  reportIntervalMs  : 2000,
  bgIntervalMs      : 3000,
  transitionSamples : 2,
  detailedReport    : true,
  rawStatsLog       : true,
  rawLogIntervalMs  : 10000,
  timeoutMs         : 5000,
  autoStart         : true
});
```

`sampleIntervalMs`、`autoStart`、`contextProvider` 和 `streamClassifier` 本次没有改名。

## 3. AI Noise Suppression（AiNS）

AiNS 有两个使用层级：

1. 推荐的会话控制器：通过 `rtcSession.getAiNoiseSuppression()` 获取，只公开通话中需要的控制方法。
2. 直接模块 API：直接导入 `AiNSEngine`、`AiNSConfig`，用于底层媒体管线、自定义集成或调试。

### 3.1 普通 RTCSession 接入需要迁移的名称

| 旧名 | 新名 | 使用位置 | 用途 |
| --- | --- | --- | --- |
| `noiseReductionLevel` | `level` | 呼叫/接听时的 AiNS 配置、`MetaHumanClient` 的 `aiNoiseSuppression` 配置、直接创建 `AiNSEngine` | 降噪强度，范围 `0` 到 `100`，默认 `80`。`0` 表示不施加降噪强度，值越高抑制越强。非法值会按已有规则归一化。 |
| `setSuppressionLevel(level)` | `setLevel(level)` | `AiNoiseSuppressionController`、`MetaHumanAiNoiseSuppressionController`、`AiNSEngine` | 通话中动态调整降噪强度，不需要重建音频处理图。参数范围 `0` 到 `100`，无返回值。 |

呼叫或接听时配置：

```js
rtcSession.answer({
  mediaConstraints : { audio: true, video: false },
  aiNoiseSuppression : {
    enabled     : true,
    level       : 80,
    outputGain  : 1,
    assetConfig : { cdnUrl: './static' }
  }
});
```

通话中动态调整：

```js
const ns = rtcSession.getAiNoiseSuppression();

if (ns)
{
  ns.setLevel(70);
  ns.setOutputGain(1);
}
```

数字人客户端配置同样使用 `level`：

```js
const client = new CRTC.MetaHumanClient({
  server : serverUrl,
  aiNoiseSuppression : {
    enabled     : true,
    level       : 80,
    outputGain  : 1,
    assetConfig : { cdnUrl: './static' }
  }
});
```

### 3.2 直接 AiNSEngine API 改名

以下名称只有在业务代码直接导入 AiNS 源模块时才需要迁移。通过
`rtcSession.getAiNoiseSuppression()` 获取的控制器不暴露这些方法。

| 旧名 | 新名 | 类型 / 返回值 | 用途 |
| --- | --- | --- | --- |
| `preserveOtherTracks` | `keepOtherTracks` | 构造属性，`boolean`，默认 `true` | 输入为 `MediaStream` 时，输出流是否保留原流中的非音频轨道，例如视频轨。关闭后输出只包含 AiNS 处理后的音频轨。 |
| `getOutputStream()` | `getOutput()` | `MediaStream \| null` | 读取当前处理后的输出流。初始化尚未完成时可能为 `null`。 |
| `replaceAudioTrack(input)` | `replaceTrack(input)` | `Promise<MediaStream>` | 用新的 `MediaStream` 或音频 `MediaStreamTrack` 替换当前输入音轨，重连现有处理图，并返回新的处理后输出流。输入没有音频轨时 Promise 会拒绝。 |
| `getProcessor()` | `getRuntime()` | `AiNSWorkletRuntime` | 获取内部 AudioWorklet 运行时，主要用于调试。它仍属于 `internal/unstable` API，不建议普通业务依赖。 |
| `getCapabilityReport()` | `getCapabilities()` | 能力报告对象 | 返回浏览器能力、运行状态和已记录问题。实例方法包含当前运行态；静态方法 `AiNSEngine.getCapabilities()` 返回未绑定实例的环境能力。 |
| `rebuildProcessedStream()` | `rebuildStream()` | 无返回值 | 从当前处理后音频轨以及需要保留的其他轨道重建输出 `MediaStream`。这是底层管线方法，普通接入方不需要手动调用。 |

直接模块使用示例：

```js
const AiNSEngine = require('../lib/AiNoiseSuppression/AiNSEngine');

const engine = new AiNSEngine({
  enabled         : true,
  level           : 80,
  keepOtherTracks : true,
  outputGain      : 1
});

await engine.init({ inputStream });

const outputStream = engine.getOutput();
const capabilities = engine.getCapabilities();

await engine.replaceTrack(nextAudioTrack);
```

### 3.3 直接 AiNSConfig 导出改名

| 旧导出 | 新导出 | 用途 |
| --- | --- | --- |
| `DEFAULT_SUPPRESSION_LEVEL` | `DEFAULT_LEVEL` | AiNS 默认降噪强度常量，当前值为 `80`。 |
| `normalizeSuppressionLevel(value, fallback)` | `normalizeLevel(value, fallback)` | 将输入强度归一化到 `0` 到 `100`；无法使用输入值时采用 `fallback`。只建议 AiNS 内部或自定义底层集成使用。 |

AiNS 的实现类显示名称也由 `AiNoiseSuppressionEngine` 精简为 `AiNSEngine`。SDK
正常通过默认导出创建实例，不依赖类名的用户无需调整；如果代码检查
`constructor.name`、直接引用旧类符号或旧文件路径，则需要改用 `AiNSEngine`。

## 4. MediaEffectsComposer

### 4.1 使用入口

会话中启用 Composer 后，通过 `RTCSession` 获取实例：

```js
const composer = rtcSession.getMediaEffectsComposer();

if (composer)
{
  console.log(composer.getState());
}
```

呼叫或接听时可以传入初始配置：

```js
const mediaEffectsComposer = {
  width              : 1280,
  height             : 720,
  fps                : 25,
  dropBusyFrames     : true,
  keepDrawingBuffer  : true,
  manualFrameControl : true,
  mirrorWatermarks   : false,
  sources : [
    {
      slot : 0,
      aiBackground : {
        enabled : true,
        mode    : 'blur'
      }
    }
  ]
};

rtcSession.answer({
  mediaConstraints : { audio: true, video: true },
  mediaEffectsComposer
});
```

### 4.2 操作方法改名

| 旧名 | 新名 | 参数 / 返回值 | 使用场景 |
| --- | --- | --- | --- |
| `setSourceAiVirtualBackground(slotOrTarget, options)` | `setAiBackground(slotOrTarget, options)` | 目标可以是 slot、source id、`MediaStream` 或 `HTMLVideoElement`；配置为 `true`、`AiVBOptions`、`false` 或 `null`。返回归一化后的 `AiVBOptions \| null`。 | 为指定输入源设置、更新或关闭 AI 虚拟背景。`true` 启用默认配置，`false/null` 禁用。 |
| `getSourceAiVirtualBackground(slotOrTarget)` | `getAiBackground(slotOrTarget)` | 返回 `AiVBOptions \| null`。 | 读取指定源当前的 AI 虚拟背景配置快照。修改返回对象不会直接修改 Composer 内部状态。 |
| `clearSourceAiVirtualBackground(slotOrTarget)` | `clearAiBackground(slotOrTarget)` | 无返回值。 | 清除指定源的虚拟背景，并刷新渲染策略和画面。 |
| `setMirrorWatermarksWithOutput(enabled)` | `setWatermarkMirror(enabled)` | `boolean`，返回 `Promise<MediaEffectsComposerConfigState>`。 | 设置最终输出镜像时，输出级水印是否同步水平翻转。二维码、文字方向必须保持不变时可设为 `false`。 |
| `getMirrorWatermarksWithOutput()` | `getWatermarkMirror()` | 返回 `boolean`。 | 读取当前水印跟随输出镜像的生效配置。 |
| `getCapabilityReport()` | `getCapabilities()` | 返回 `MediaEffectsComposerCapabilityReport`。 | 获取最大源数量、AI 背景、Insertable Streams、当前渲染路径、音频状态和降级信息。适合能力判断和故障诊断。 |
| `getIsolatedSubmixAudioStream(options)` | `getSubmixStream(options)` | 参数为 `{ slots: number[] }` 或 `number[]`，返回 `Promise<MediaStream \| null>`。 | 为指定 slots 创建独立 `AudioContext` 的纯音频子混流。没有可用音频源时返回 `null`。 |
| `releaseSubmixAudioStream(options)` | `releaseSubmixStream(options)` | 参数为 `{ slots, isolated? }` 或 `number[]`，返回 `boolean`。 | 释放对应子混流请求及资源。返回 `false` 表示参数无效或没有找到对应请求。 |

虚拟背景运行时迁移示例：

```js
const composer = rtcSession.getMediaEffectsComposer();

if (composer)
{
  composer.setAiBackground(0, {
    enabled    : true,
    mode       : 'blur',
    blurRadius : 12
  });

  const current = composer.getAiBackground(0);
  console.log(current);

  composer.clearAiBackground(0);
}
```

水印镜像示例：

```js
const composer = rtcSession.getMediaEffectsComposer();

if (composer)
{
  // 输出画面镜像，但二维码/文字水印保持原方向。
  await composer.setMirror(true);
  await composer.setWatermarkMirror(false);

  console.log(composer.getWatermarkMirror());
}
```

子混音示例：

```js
const submix = await composer.getSubmixStream({ slots: [ 0, 2 ] });

if (submix)
{
  audioElement.srcObject = submix;
}

// 不再使用时释放同一组 slots 对应的资源。
composer.releaseSubmixStream({ slots: [ 0, 2 ], isolated: true });
```

### 4.3 构造和会话配置属性改名

这些属性用于 `new CRTC.MediaEffectsComposer(videos, options)`，或 RTCSession 的
`mediaEffectsComposer` 配置。

| 旧属性 | 新属性 | 类型 / 默认值 | 用途 |
| --- | --- | --- | --- |
| `aiVirtualBackground` | `aiBackground` | `AiVBOptions \| null` | Composer source 配置和 source 状态中使用的虚拟背景字段。新名称与运行时方法 `setAiBackground()` / `getAiBackground()` 保持一致。 |
| `mirrorWatermarksWithOutput` | `mirrorWatermarks` | `boolean`, 默认 `false` | 当最终输出启用镜像时，输出级水印是否随画面一起水平翻转。也可通过 `setWatermarkMirror()` 动态修改。 |
| `dropFrameWhenBusy` | `dropBusyFrames` | `boolean`, 默认 `true` | Worker 尚未完成上一帧时是否丢弃新帧，避免队列堆积导致延迟持续增加。 |
| `preserveDrawingBuffer` | `keepDrawingBuffer` | `boolean`, 默认 `true` | 是否要求主线程 WebGL2 渲染上下文保留绘图缓冲。此处是 Composer 配置名；传给原生 WebGL 的上下文属性仍叫 `preserveDrawingBuffer`。 |
| `manualCaptureFrameControl` | `manualFrameControl` | `boolean`, 默认 `true` | 在 `captureStream` 输出路径下，是否优先使用 `captureStream(0)` 加 `requestFrame()` 手动控制出帧。 |

`aiBackground` 会出现在 source 配置/状态和能力报告两类对象中。
它们的完整路径和类型不同：

- `sources[n].aiBackground`：`AiVBOptions | null`，创建 Composer 时为第 n 路输入设置效果。
- `composer.getSources()[n].aiBackground`：`AiVBOptions | null`，读取该路源当前效果状态。
- `composer.getCapabilities().features.aiBackground`：`boolean`，表示当前是否有源启用了 AI 背景。

### 4.4 配置状态和能力报告字段改名

以下字段是读取结果，不是全部都能直接作为构造参数传入。表格中的“读取位置”用于
区分同名字段所处的返回对象。

| 旧字段 | 新字段 | 读取位置 | 含义 |
| --- | --- | --- | --- |
| `mirrorWatermarksWithOutput` | `mirrorWatermarks` | `getState().config`、`setConfig()` 返回值 | 当前输出镜像时水印是否随之镜像。 |
| `aiVirtualBackground` | `aiBackground` | `getSources()[n]`、`getState().sources[n]` | 指定 source 当前的 AI 背景配置快照。 |
| `sourceAiVirtualBackground` | `aiBackground` | `getCapabilities().features` | 当前 Composer 是否已有 source 启用 AI 背景。该字段是 `boolean`，不是 source 配置。 |
| `sourceAiVirtualBackgroundSupported` | `aiBackgroundSupported` | `getCapabilities().features` | 当前浏览器环境是否具备 AI 背景运行所需的基础能力。 |
| `sourceAiVirtualBackgroundEnabled` | `aiBackgroundEnabled` | `getCapabilities().features` | 当前 Composer 是否已有 source 启用 AI 背景。 |
| `insertableStreamsConfigured` | `insertableConfigured` | `getCapabilities().features` | 构造配置是否请求 Insertable Streams；不代表浏览器一定支持或当前一定正在使用。 |

能力读取示例：

```js
const capabilities = composer.getCapabilities();

if (capabilities.features.aiBackgroundSupported)
{
  console.log('AI background is available');
}

console.log({
  aiBackgroundEnabled : capabilities.features.aiBackgroundEnabled,
  insertableRequested : capabilities.features.insertableConfigured,
  actualRenderMode    : capabilities.render.actualMode
});
```

### 4.5 渲染诊断字段改名

这些字段出现在 `composer.getRenderInfo()`、`composer.getState().render` 以及
`composer.getCapabilities().render` 中，主要用于日志、监控和兼容性诊断。

| 旧字段 | 新字段 | 类型 | 含义 |
| --- | --- | --- | --- |
| `captureFrameControlMode` | `frameControlMode` | `string` | 当前 captureStream 出帧方式，例如手动 `requestFrame` 或自动 FPS 捕获。 |
| `insertableEnabledByConfig` | `insertableConfigured` | `boolean` | 配置是否请求 Insertable Streams。需结合 `insertableSupported` 和 `insertableActive` 判断实际路径。 |
| `insertableGeneratorType` | `generatorType` | `string` | 当前环境识别到的视频轨生成器类型；未使用或不支持时为空字符串。 |
| `insertableSupportReason` | `insertableReason` | `string` | Insertable Streams 不可用、未启用或回退时的原因描述。 |
| `insertableWriteFailures` | `writeFailures` | `number` | 向 Insertable 输出写帧失败的累计次数。 |
| `insertableHasGeneratorTrack` | `hasGeneratorTrack` | `boolean` | 当前是否已经创建生成器视频轨。 |
| `outputHasCapturedStream` | `hasCaptureStream` | `boolean` | 当前是否持有 canvas `captureStream` 输出。 |
| `activeCaptureSinkAttached` | `captureSinkActive` | `boolean` | 为保持 captureStream 活跃而使用的内部视频 sink 是否已挂载。 |

诊断示例：

```js
const render = composer.getRenderInfo();

console.log({
  mode                 : render.actualMode,
  frameControlMode     : render.frameControlMode,
  insertableConfigured : render.insertableConfigured,
  insertableSupported  : render.insertableSupported,
  insertableActive     : render.insertableActive,
  generatorType        : render.generatorType,
  fallbackReason       : render.insertableReason,
  writeFailures        : render.writeFailures
});
```

## 5. 接入方迁移检查表

1. 全局搜索本文“旧名”列中的名称。
2. 先修改构造配置和 RTCSession 呼叫/接听参数，再修改运行时方法调用。
3. 如果使用 TypeScript，确认代码引用的是更新后的 `RTCSession.d.ts`、
   `RTCStatsMonitor.d.ts` 和 `MetaHumanClient.d.ts`。
4. 如果直接导入 `lib/AiNoiseSuppression/`，额外检查 `AiNSEngine`、
   `AiNSConfig.DEFAULT_LEVEL` 和 `AiNSConfig.normalizeLevel()`。
5. 如果读取 Composer 诊断数据或将其上报到服务端，必须同步修改字段映射、日志解析和
   数据看板字段。
6. 如果服务端保存了这些配置对象，需要同步调整序列化后的 JSON 字段名。
7. 更新 SDK 后重新构建并验证通话、设备切换、AI 降噪、虚拟背景、混流输出和统计上报。

可使用下面的命令快速检查仓库中是否仍有旧公开名称：

```bash
rg -n "markTransition|getLatestReport|getLatestLegacyReport|getLatestNetworkQuality|legacyReportIntervalMs|backgroundSampleIntervalMs|transitionGraceSamples|enableDetailedReport|enableRawStatsLog|rawStatsLogIntervalMs|getStatsTimeoutMs|noiseReductionLevel|preserveOtherTracks|setSuppressionLevel|getOutputStream|replaceAudioTrack|getProcessor|getCapabilityReport|rebuildProcessedStream|DEFAULT_SUPPRESSION_LEVEL|normalizeSuppressionLevel|setSourceAiVirtualBackground|getSourceAiVirtualBackground|clearSourceAiVirtualBackground|setMirrorWatermarksWithOutput|getMirrorWatermarksWithOutput|getIsolatedSubmixAudioStream|releaseSubmixAudioStream|aiVirtualBackground|sourceAiVirtualBackground|mirrorWatermarksWithOutput|dropFrameWhenBusy|enableInsertable|manualCaptureFrameControl|sourceAiVirtualBackgroundSupported|sourceAiVirtualBackgroundEnabled|insertableStreamsConfigured|captureFrameControlMode|insertableEnabledByConfig|insertableGeneratorType|insertableSupportReason|insertableWriteFailures|insertableHasGeneratorTrack|outputHasCapturedStream|activeCaptureSinkAttached" .
```

注意：搜索 `preserveDrawingBuffer` 时，原生 WebGL 上下文属性仍然合法；只有 Composer
构造配置需要改为 `keepDrawingBuffer`。

## 6. 已同步的示例和类型声明

可以从以下文件查看推荐的新写法：

- `demo/base-js/js/app-call.js`：RTCStatsMonitor 报告读取。
- `demo/base-js/js/app-effects.js`：AiNS 和 AI 虚拟背景配置、运行时控制。
- `samples/base-js-mh/js/app-call.js`：RTCStatsMonitor 完整报告说明。
- `samples/base-js-mh/js/app-effects.js`：数字人示例中的媒体效果和 AiNS 配置。
- `samples/base-js-mh/js/app-metahuman.js`：MetaHumanClient AiNS 运行时控制。
- `lib/RTCStatsMonitor.d.ts`：RTCStatsMonitor 方法、选项及报告结构。
- `lib/RTCSession.d.ts`：Composer、AiNS 控制器和会话配置类型。
- `lib/MetaHumanClient.d.ts`：MetaHumanClient AiNS 配置和控制器类型。
