# 7. 旧版功能升级指南

[← 上一章：SDK API 参考](./06-api-reference.md) · [学习目录](./README.md) · [下一章：Base JS Demo →](./08-demo-guide.md)

本章用于把已有项目中的 AiNS、虚拟背景、混流和通话统计升级到当前接入方式。建议按“搜索旧入口 → 修改呼叫/接听参数 → 修改通话中控制 → 修改事件 → 删除旧生命周期代码 → 验证”的顺序逐项完成。

## 7.1 升级前先做调用清单

在项目中搜索以下关键词：

```text
new CRTC.getStats
window.CRTCStats
setMode(
new CRTC.MediaStreamComposer
getMediaStreamComposer
appendStream
getMixedStream
getVideoStream
aiVirtualBackground
aiVB
getAiVBEngine
aiNoiseSuppression
```

对每个命中位置标记它属于哪条路径：

| 路径 | 必须检查的入口 |
| --- | --- |
| 呼出 | `ua.call(target, options)` |
| 音频呼入接听 | `session.answer({ mediaConstraints: { audio: true, video: false } })` |
| 视频呼入接听 | `session.answer({ mediaConstraints: { audio: true, video: ... } })` |
| 音频升级视频 | `session.upgradeToVideo(options, done)` |
| 通话中设备/效果更新 | `switchDevice()`、composer、AiNS 控制器 |
| 结束和失败 | `ended`、`failed` |

同一能力只改呼出、不改接听，是升级后最常见的不一致来源。

## 7.2 AiNS 升级

### 7.2.1 当前推荐入口

初始启用放在呼叫或接听参数：

```js
const aiNoiseSuppression = {
  enabled             : true,
  noiseReductionLevel : 80,
  outputGain          : 1,
  sampleRate          : 48000,
  assetConfig         : {
    cdnUrl : './assets/ains'
  }
};

await ua.call(target, {
  mediaConstraints : {
    audio : { sampleRate: 48000, channelCount: 1 },
    video : videoConstraints
  },
  aiNoiseSuppression
});
```

呼入同样传入：

```js
session.answer({
  mediaConstraints : {
    audio : { sampleRate: 48000, channelCount: 1 },
    video : videoConstraints
  },
  aiNoiseSuppression
});
```

### 7.2.2 通话中参数变化

从当前会话获取控制器：

```js
const aiNS = session.getAiNoiseSuppression();

if (aiNS)
{
  aiNS.setSuppressionLevel(70);
  aiNS.setOutputGain(1.1);
}
```

| 项目 | 当前要求 |
| --- | --- |
| 降噪强度 | `noiseReductionLevel` / `setSuppressionLevel()`，范围 `0～100` |
| 输出增益 | `outputGain` / `setOutputGain()`，范围 `0～4` |
| 推荐采样率 | `48000Hz` |
| 资源目录 | 包含 `ans.wasm`、`ans_onnx.tar.gz` |
| 失败处理 | 监听 `mediaEffectsIssue`；降噪失败时通话通常继续使用可用音频 |

升级时不要保存一个全局 AiNS 控制器跨通话复用。每次 `newRTCSession` 对应新的控制器；`getAiNoiseSuppression()` 返回 `null` 时表示当前会话未启用、尚未创建或已经释放。

## 7.3 虚拟背景升级

### 7.3.1 初始参数位置变化

| 旧位置 | 当前位置 |
| --- | --- |
| `options.aiVirtualBackground` | `options.mediaEffectsComposer.sources[0].aiVirtualBackground` |
| `options.aiVB` | `options.mediaEffectsComposer.sources[0].aiVirtualBackground` |

旧写法：

```js
ua.call(target, {
  mediaConstraints : { audio: true, video: true },
  aiVirtualBackground : {
    mode       : 'blur',
    blurRadius : 16
  }
});
```

当前写法：

```js
await ua.call(target, {
  mediaConstraints : { audio: true, video: true },
  mediaEffectsComposer : {
    width  : 1280,
    height : 720,
    fps    : 15,
    sources : [
      {
        slot : 0,
        aiVirtualBackground : {
          mode         : 'blur',
          blurRadius   : 16,
          assetConfig : { cdnUrl: './assets/aivb' }
        }
      }
    ]
  }
});
```

变化原因对接入的影响：虚拟背景现在属于 composer 中某一路视频源。`slot: 0` 表示当前通话的本地摄像头源；以后添加第二路视频时，可以针对不同 slot 使用不同效果。

### 7.3.2 通话中方法变化

| 旧写法 | 当前写法 |
| --- | --- |
| `session.getAiVBEngine()` | `session.getMediaEffectsComposer()` |
| 直接操作独立背景实例 | `composer.setSourceAiVirtualBackground(0, options)` |
| 关闭/销毁独立背景实例 | `composer.clearSourceAiVirtualBackground(0)` |

```js
const composer = session.getMediaEffectsComposer();

if (composer)
{
  composer.setSourceAiVirtualBackground(0, {
    mode  : 'color',
    color : '#1f2937'
  });
}
```

清除：

```js
composer && composer.clearSourceAiVirtualBackground(0);
```

### 7.3.3 模式与参数迁移

| `mode` | 必要参数 | 说明 |
| --- | --- | --- |
| `none` | 无 | 不使用背景替换 |
| `blur` | `blurRadius` 可选 | 模糊真实背景 |
| `image` | `imageUrl` 必填 | 使用图片背景；图片需允许跨域访问 |
| `color` | `color` 必填 | 使用 CSS 颜色字符串 |

升级后首次验证应分别覆盖模糊、图片、清除和挂断重呼。图片模式还需验证资源 URL、CORS 和 HTTPS。

## 7.4 混流升级

### 7.4.1 类名与方法映射

| 旧入口 | 当前入口 | 返回值变化 |
| --- | --- | --- |
| `new CRTC.MediaStreamComposer()` | `new CRTC.MediaEffectsComposer()` | 新类名 |
| `session.getMediaStreamComposer()` | `session.getMediaEffectsComposer()` | 未启用时为 `null` |
| `appendStream(stream, options)` | `addSource(stream, options)` | 添加/替换 slot |
| `removeStream(streamOrSlot)` | `removeSource(streamOrSlot)` | 移除一路源 |
| `clearStreams()` | `clearSources()` | 清空全部输入 |
| `getMixedStream()` | `await getOutput({ type: 'mixed' })` | 当前统一入口为 Promise |
| `getVideoStream()` | `await getOutput({ type: 'video' })` | 当前统一入口为 Promise |
| `getAudioStream(options)` | `await getOutput({ type: 'audio', ...options })` | 当前统一入口为 Promise |
| `releaseSubmixAudioStream(options)` | `releaseOutput({ type: 'audio', ...options })` | 与获取参数对应 |

兼容方法仍可能可调用，但新代码应统一使用当前名称，避免同一项目混用两套生命周期。

### 7.4.2 从业务自行换轨迁移到会话集成

旧项目可能自行创建 composer、获取输出、查找 sender 并调用 `replaceTrack()`。普通通话升级后优先把 composer 配置交给 `ua.call()` / `session.answer()`：

```js
const options = {
  mediaConstraints : { audio: true, video: videoConstraints },
  mediaEffectsComposer : {
    width           : 1280,
    height          : 720,
    fps             : 15,
    backgroundColor : '#000000',
    sourceMirror    : false,
    mirror          : false,
    sources         : [ { slot: 0 } ]
  }
};

const session = await ua.call(target, options);
```

当前会话需要动态更新时：

```js
const composer = session.getMediaEffectsComposer();

if (composer)
{
  composer.setMirror(true);
  composer.setWatermarks([ watermark ]);
}
```

升级影响：

- 不再由业务选择通话 sender 并替换 composer 输出轨道。
- 设备切换、共享、音视频模式变化和会话结束继续围绕当前 `RTCSession` 操作。
- `width/height/fps/renderMode` 等初始化参数不要在已有通话中强行改变；下一通呼叫重新配置。
- 通话结束后不要继续调用旧 composer 引用。

## 7.5 RTCStatsMonitor 升级概览

统计升级不只是类名变化，还改变了生命周期、采样口径、空值语义和诊断范围。

| 项目 | 旧统计 | 当前统计 |
| --- | --- | --- |
| 会话入口 | 页面在 `confirmed` 后 `new CRTC.getStats(session.connection)` | `RTCSession` 创建 PC 后自动管理，页面监听 `session` |
| 类名 | `CRTC.getStats` | `CRTC.RTCStatsMonitor`；`CRTC.getStats` 保留为兼容名称 |
| 事件位置 | 独立实例的 `report` / `network-quality` | 会话的 `stats:report` / `stats:network-quality`，并新增详细和错误事件 |
| 停止 | 页面调用 `stats.stop()` 或使用全局标记 | 会话结束自动停止并释放 |
| 媒体类型 | 页面调用 `setMode()` | 自动根据当前媒体报告识别 |
| `reset()` | 旧用法等同停止 | 当前只清空基线并继续采样 |
| 丢包/RTT | 旧实现中无包可能被当作 `100%` 丢包，字段缺失也可能被数值兜底 | 缺少可比较数据保持无数据语义，质量等级使用 `0` |
| 网络质量 | 基础等级 | 当前样本最差流 + 当前 RTT，并在连接失败时输出 `6` |
| 诊断 | RTT、丢包、码率等基础字段 | 增加带宽、队列、重传、编解码、卡顿、路径变化等 issues |

## 7.6 会话统计入口迁移

旧写法：

```js
let stats;

session.on('confirmed', function()
{
  stats = new CRTC.getStats(session.connection);
  stats.on('report', handleReport);
  stats.on('network-quality', handleNetworkQuality);
});

session.on('ended', function()
{
  stats && stats.stop();
});
```

当前写法：

```js
ua.on('newRTCSession', function(data)
{
  const session = data.session;

  session.on('stats:report', handleLegacyReport);
  session.on('stats:network-quality', handleNetworkQuality);
  session.on('stats:detailed-report', handleDetailedReport);
  session.on('stats:stats-error', handleStatsError);
});
```

| 会话事件 | 参数结构 | 是否兼容旧页面 |
| --- | --- | --- |
| `stats:report` | `{ RTT, upStreams, downStreams }` | 是 |
| `stats:network-quality` | `{ RTT, uplinkLoss, downlinkLoss, uplinkNetworkQuality, downlinkNetworkQuality }` | 是 |
| `stats:detailed-report` | `{ connection, outbound, inbound, quality }` | 新增，推荐新页面 |
| `stats:stats-error` | `{ code, fatal, message, error, consecutiveErrors }` | 新增 |

直接创建独立监控器时，事件名仍不带 `stats:` 前缀：`report`、`network-quality`、`detailed-report`、`stats-error`。

## 7.7 构造参数变化

旧位置参数：

```js
const stats = new CRTC.getStats(pc, delay, interval);
```

当前对象参数：

```js
const monitor = new CRTC.RTCStatsMonitor(pc, {
  sampleIntervalMs           : 2000,
  legacyReportIntervalMs     : 2000,
  backgroundSampleIntervalMs : 2000,
  transitionGraceSamples     : 2,
  getStatsTimeoutMs          : 5000,
  enableDetailedReport       : true,
  enableRawStatsLog          : false,
  rawStatsLogIntervalMs      : 10000,
  autoStart                  : true
});
```

旧的 `delay`、`interval` 数字位置参数不会自动转换为当前配置。只传 `pc` 的旧写法仍使用默认配置；仍传数字的项目必须改为对象。

## 7.8 网络质量等级的行为变化

这是统计升级中最需要重新确认页面文案和告警逻辑的部分。

### 等级 0

当前 `0` 明确表示“暂无有效样本”，包括：没有该方向媒体、第一轮基线未建立、浏览器没有提供丢包和 RTT、媒体刚切换尚未稳定。`0` 不表示比 `1` 更好。

旧页面如果使用：

```js
if (quality <= 2)
{
  showGoodNetwork();
}
```

必须改为：

```js
if (quality === 0)
{
  showDetecting();
}
else if (quality <= 2)
{
  showGoodNetwork();
}
```

### 等级 1～6 的阈值

| 等级 | 当前丢包率或 RTT 条件；任一项满足 |
| ---: | --- |
| `1` | 丢包 `0%` 且 RTT `<50ms` |
| `2` | 丢包 `>0%～10%`，或 RTT `50～100ms` |
| `3` | 丢包 `>10%～20%`，或 RTT `>100～200ms` |
| `4` | 丢包 `>20%～30%`，或 RTT `>200～350ms` |
| `5` | 丢包 `>30%～40%`，或 RTT `>350～500ms` |
| `6` | 丢包 `>40%`，或 RTT `>500ms`，或连接 `failed/closed` |

当前上行和下行都使用各自方向当前样本中最差一路 RTP 的丢包率；RTT 优先使用媒体反馈，缺失时回退连接 RTT。不会把多个时间窗口平均后再输出，所以瞬时变化比旧页面可能更明显。告警应采用“连续多次 + 用户体验/连接状态”的策略，不要看到单次 `4～6` 就自动挂断。

### 空值与 0 的区别

- `stats:detailed-report` 中浏览器未提供的连接、流指标为 `null`。
- 兼容 `stats:network-quality` 为保持数字字段，在 RTT/丢包缺失时可能输出 `0`。
- 是否有有效网络样本，应看 `uplinkNetworkQuality/downlinkNetworkQuality` 是否为 `0`。

完整字段和所有 issue 阈值见 [通话质量统计](./05-call-statistics.md)。

## 7.9 `report` 数据单位变化注意

兼容 `stats:report` 保留 `speed` 作为 kbps 展示值。新的 `stats:detailed-report` 使用：

- `actualBitrateBps`
- `receiveBitrateBps`
- `sendBitrateBps`
- `availableOutgoingBitrateBps`

这些字段单位全部是 `bps`。迁移页面时必须除以 `1000` 后显示 kbps，不能直接拼接 `kbps`，也不要重复除以 `1024`。

## 7.10 生命周期方法变化

| 旧代码 | 当前处理 |
| --- | --- |
| `window.CRTCStats = 'stop'` | 删除；当前实例不读取该变量 |
| `stats.setMode('audio'/'video')` | 删除；媒体类型自动识别 |
| `stats.reset()` 用于停止 | 改为 `stats.stop()`；当前 `reset()` 会继续运行 |
| 会话结束手动 `stats.stop()` | 删除；会话自动管理 |
| 独立 PC 不停止 | 页面不用该 PC 时仍必须 `monitor.stop()` |

当前 `reset()` 的含义：保持监控运行，清除旧累计值基线，随后重新建立码率和丢包增量。调用后短时间出现 `null` 或等级 `0` 属于预期。

设备切换、共享开始/停止、音视频模式变化和重协商时，会话会让统计进入短暂过渡保护；通常不需要业务调用 `markTransition()`。

## 7.11 推荐的分阶段迁移

### 阶段一：保持页面结构

只把事件改到 `session`：

```js
session.on('stats:report', oldReportHandler);
session.on('stats:network-quality', oldQualityHandler);
```

验证旧页面能继续显示，并修正等级 `0` 的文案。

### 阶段二：切换详细面板

新增：

```js
session.on('stats:detailed-report', renderDetailedPanel);
session.on('stats:stats-error', reportStatsError);
```

按第 5 章展示连接、每路 RTP、质量和 issues。

### 阶段三：删除旧资源管理

删除 `new CRTC.getStats(session.connection)`、全局 `stats`、`window.CRTCStats`、`setMode()` 和会话内 `stats.stop()`。

## 7.12 完整升级验证矩阵

| 功能 | 必测场景 | 通过标准 |
| --- | --- | --- |
| 注册 | 自动注册、手动注册、密码错误、断网恢复 | 事件顺序和按钮状态正确 |
| 基础呼叫 | 音频呼出/呼入、视频呼出/呼入、拒接、取消、双方挂断 | `failed/ended` 后状态清理完整 |
| AiNS | 初始启用、强度/增益更新、资源 404 | 可调整；失败不导致通话退出 |
| 虚拟背景 | 模糊、图片、清除、挂断重呼 | 当前通话立即变化，重呼无旧状态 |
| 混流 | 会话集成、镜像、水印、第二路源 | slot 和输出效果正确 |
| 统计基线 | 呼叫刚开始 | 质量 `0` 显示检测中，不显示良好 |
| 弱网 | RTT/丢包达到 2～6 档 | 等级、issues 和页面文案一致 |
| 连接失败 | ICE/PC `failed` | 上下行等级 `6`，出现连接问题提示 |
| 媒体变化 | 切设备、共享、音视频升级/降级 | 短暂过渡后恢复，不残留旧 RTP |
| 重呼 | 挂断后再次呼叫 | 不复用旧 session、控制器或统计数据 |

## 7.13 升级完成清单

- 呼出、所有接听按钮和 `upgradeToVideo()` 都使用一致的媒体参数。
- AiNS 位于 `options.aiNoiseSuppression`，虚拟背景位于 `mediaEffectsComposer.sources[0]`。
- 通话内控制器从当前 `RTCSession` 获取，不跨通话缓存。
- 普通通话不再由页面自行替换 composer 输出轨道。
- 统计改为监听 `session` 的 `stats:*` 事件。
- 页面已明确区分质量等级 `0`、数值 `0` 和字段 `null`。
- 页面已适配等级 `6` 的网络阈值和连接失败语义。
- 已删除 `window.CRTCStats`、`setMode()` 和会话统计的手动停止代码。
- 独立 PeerConnection 统计仍在不用时调用 `stop()`。
- 已完成自动/手动注册、呼入/呼出、媒体效果、弱网、设备切换、共享、挂断和重呼验证。

[← 上一章：SDK API 参考](./06-api-reference.md) · [下一章：Base JS Demo →](./08-demo-guide.md)
