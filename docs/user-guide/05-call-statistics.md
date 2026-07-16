# 5. 通话质量统计

[← 上一章：媒体能力](./04-media-features.md) · [学习目录](./README.md) · [下一章：SDK API 参考 →](./06-api-reference.md)

每个 `RTCSession` 都会管理本通电话的统计实例。页面在 `newRTCSession` 中监听 `session` 的 `stats:*` 事件即可；挂断、呼叫失败和重呼时不需要自行启动或停止定时器。

本章字段与 Base JS Demo 的统计浮层一一对应。先按 5.1 完成接入，再按 5.3～5.8 解释页面中的每一个值。

## 5.1 完整接入示例

```js
ua.on('newRTCSession', function(data)
{
  const session = data.session;

  session.on('stats:detailed-report', function(report)
  {
    renderConnection(report.connection);
    renderOutboundStreams(report.outbound);
    renderInboundStreams(report.inbound);
    renderQuality(report.quality);
  });

  session.on('stats:stats-error', function(error)
  {
    // 统计失败不会结束通话。
    console.warn('统计失败：', error.code, error.message);
  });

  // 旧页面需要原有字段结构时保留这两个监听。
  session.on('stats:network-quality', function(report)
  {
    console.log(report);
  });

  session.on('stats:report', function(report)
  {
    console.log(report);
  });
});
```

事件选择：

| 事件 | 新页面是否推荐 | 参数 | 适用场景 |
| --- | --- | --- | --- |
| `stats:detailed-report` | 是 | `{ connection, outbound, inbound, quality }` | 统计面板、弱网提示和常规问题定位 |
| `stats:network-quality` | 可选 | `{ RTT, uplinkLoss, downlinkLoss, uplinkNetworkQuality, downlinkNetworkQuality }` | 保留原有网络质量组件 |
| `stats:report` | 可选 | `{ RTT, upStreams, downStreams }` | 保留原有上下行流展示或上报结构 |
| `stats:stats-error` | 是 | `{ code, fatal, message, error, consecutiveErrors }` | 记录采样异常；不用于判断通话是否结束 |

默认约每 `2000ms` 采样一次。第一轮主要用于建立码率、丢包率等增量指标的计算基线，部分值暂时为 `null` 属于正常现象。

## 5.2 数值、单位与空值

| 字段类型 | 单位或取值 | 页面显示建议 |
| --- | --- | --- |
| 码率 | `bps` | 除以 `1000` 显示 `kbps`；不要按 `1024` 换算 |
| RTT、抖动、编解码耗时 | `ms` | 保留 0～2 位小数 |
| 丢包、丢帧、重传比例 | 百分比 `0～100` | 加 `%` |
| 分辨率 | 像素 | `宽 × 高` |
| 帧率 | `fps` | 显示数字和 `fps` |
| 网络质量等级 | 整数 `0～6` | 同时显示数字和中文含义 |
| 问题严重程度 | 整数 `1～6` | 可显示为 `L1～L6` |

`null` 或 `undefined` 表示浏览器没有提供该字段、媒体尚未产生可比较样本，或当前浏览器无法计算。它不等于数值 `0`。

兼容事件中的 `RTT`、`uplinkLoss` 和 `downlinkLoss` 在没有样本时可能使用 `0` 作为安全值，因此必须结合质量等级判断：质量等级为 `0` 时，应显示“检测中”或“暂无数据”，不能显示“网络极佳”。

```js
function formatNumber(value, unit)
{
  return value === null || value === undefined
    ? '-'
    : String(value) + (unit || '');
}

function formatBitrate(value)
{
  return value === null || value === undefined
    ? '-'
    : (value / 1000).toFixed(1) + 'kbps';
}
```

## 5.3 网络质量等级 0～6

上行和下行分别计算。每个方向使用当前采样中最差一路媒体的丢包率，并结合当前 RTT 取较差结果；不会把多路 RTP 或多个时间窗口平均后掩盖当前弱网。

### 5.3.1 精确判定表

| 等级 | 产生条件；满足任一项即可 | 含义 |
| ---: | --- | --- |
| `0` | 该方向没有活动媒体；或丢包率和 RTT 都不可用 | 暂无有效样本，不代表好或坏 |
| `1` | 已有媒体样本，丢包率为 `0%`，并且 RTT `< 50ms` | 极佳 |
| `2` | 丢包率 `> 0% 且 ≤ 10%`；或 RTT `≥ 50ms 且 ≤ 100ms` | 较好 |
| `3` | 丢包率 `> 10% 且 ≤ 20%`；或 RTT `> 100ms 且 ≤ 200ms` | 一般 |
| `4` | 丢包率 `> 20% 且 ≤ 30%`；或 RTT `> 200ms 且 ≤ 350ms` | 差 |
| `5` | 丢包率 `> 30% 且 ≤ 40%`；或 RTT `> 350ms 且 ≤ 500ms` | 极差 |
| `6` | 丢包率 `> 40%`；或 RTT `> 500ms`；或 PeerConnection 状态为 `failed` / `closed` | 网络不可用或接近不可用 |

边界值按表中的不等号判断。例如 RTT 正好 `500ms` 为 `5`，大于 `500ms` 才为 `6`；丢包率正好 `40%` 为 `5`，大于 `40%` 才为 `6`。

### 5.3.2 什么时候会出现 0

常见情况：

- 通话刚开始，第一份样本还没有建立增量基线。
- 纯音频通话中没有视频流；不存在的媒体方向不会被评为 `1`。
- 本端没有活动 sender，所以上行没有可评价的媒体。
- 远端尚未发送媒体，所以下行没有 inbound RTP。
- 浏览器没有提供当前方向的 RTT 和丢包字段。
- 切换设备、共享或重协商后，新的 RTP 报告尚未稳定。

业务处理：显示“检测中/暂无数据”，继续等待后续样本。不要把 `0` 排在 `1` 前面当作“更好”。

### 5.3.3 什么时候会出现 6

常见情况：

- 当前方向最差媒体流的丢包率大于 `40%`。
- 当前 RTT 大于 `500ms`。
- `connectionState` 进入 `failed` 或 `closed`，此时上下行都直接为 `6`。

单次 `6` 可能来自瞬时网络切换；连续多次为 `6`，并且连接状态、媒体码率或用户体验同时异常时，再展示强提醒。`closed` 也可能是正常挂断后的短暂统计结果，页面应在 `ended` / `failed` 时清空本通电话的数据。

### 5.3.4 页面格式化

```js
const qualityNames = [
  '暂无数据', '极佳', '较好', '一般', '差', '极差', '已断开或极差'
];

function formatQuality(level)
{
  return qualityNames[level]
    ? `${qualityNames[level]}(${level})`
    : '未知';
}
```

## 5.4 `stats:detailed-report.connection`

Demo 的“网络连接”区域使用以下全部字段：

| 字段 | 类型/可选值 | 含义与判读 |
| --- | --- | --- |
| `connectionState` | `new`、`connecting`、`connected`、`disconnected`、`failed`、`closed` 或 `null` | PeerConnection 总状态；稳定通话通常为 `connected` |
| `iceConnectionState` | `new`、`checking`、`connected`、`completed`、`disconnected`、`failed`、`closed` 或 `null` | ICE 连通状态；`connected/completed` 表示已有可用媒体路径 |
| `dtlsState` | `new`、`connecting`、`connected`、`closed`、`failed` 或 `null` | DTLS 安全传输状态；稳定通话通常为 `connected` |
| `sendBitrateBps` | `number \| null` | 所有当前发送媒体的实际总码率，单位 bps |
| `availableOutgoingBitrateBps` | `number \| null` | 浏览器估算的可用上行带宽，单位 bps |
| `receiveBitrateBps` | `number \| null` | 所有当前接收媒体的实际总码率，单位 bps |
| `availableIncomingBitrateBps` | `number \| null` | 浏览器估算的可用下行带宽；许多浏览器不提供 |

判读顺序：

1. `connectionState` 是否为 `connected`。
2. ICE 是否为 `connected` 或 `completed`。
3. DTLS 是否为 `connected`。
4. 远端正在发送时，下行实际码率是否长期接近 `0`。
5. 实际上行码率是否长期接近或超过可用上行带宽，并伴随分辨率/FPS 下降。

`availableIncomingBitrateBps` 为 `null` 很常见，不应当作下行带宽为 0。

## 5.5 `stats:detailed-report.outbound[]`

数组中每一项代表本端发送的一路 RTP。音频、摄像头视频和共享视频可能各有一项；同类媒体存在多路编码时也可能出现多项。

| 字段 | 类型/可选值 | Demo 展示 | 含义 |
| --- | --- | --- | --- |
| `type` | `audio`、`video`、`shared`、`unknown` 或扩展字符串 | 用于媒体名称 | SDK 识别后的媒体类别 |
| `kind` | `audio`、`video` 或 `null` | 用于媒体名称 | WebRTC 媒体类型 |
| `mid` | `string \| number \| null` | `音频[0]` 等 | SDP 媒体行标识，用于区分多路流 |
| `codec.name` | `string \| null` | `编码:opus/H264` | 实际使用的编解码器简称 |
| `actualBitrateBps` | `number \| null` | `码率` | 本轮实际发送码率，单位 bps |
| `remoteInbound.jitterMs` | `number \| null` | `抖动` | 远端接收本路媒体时反馈的抖动，单位 ms |
| `remoteInbound.intervalLossPercent` | `number \| null` | `丢包` | 本路媒体到达远端前的当前周期丢包率 |
| `frameWidth` | `number \| null` | `画面` | 视频实际编码宽度 |
| `frameHeight` | `number \| null` | `画面` | 视频实际编码高度 |
| `framesPerSecond` | `number \| null` | `FPS` | 实际编码帧率 |
| `averageEncodeTimeMs` | `number \| null` | `编码` | 平均编码一帧耗时 |
| `qualityLimitationReason` | `none`、`bandwidth`、`cpu`、`other` 或 `null` | `限制` | 浏览器报告的视频质量限制原因 |

`remoteInbound` 整体可能为 `null`，表示远端反馈报告尚不可用。此时上行抖动和丢包显示 `-`，不代表没有丢包。

`qualityLimitationReason` 判读：

| 值 | 含义 | 建议 |
| --- | --- | --- |
| `none` | 当前没有报告质量限制 | 结合其他指标继续判断 |
| `bandwidth` | 上行带宽限制编码质量 | 检查可用上行带宽、目标码率和丢包 |
| `cpu` | CPU/编码能力限制 | 降低分辨率、帧率或媒体效果负载 |
| `other` | 浏览器报告了其他限制 | 结合 FPS、分辨率和日志定位 |
| `null` | 浏览器未提供 | 不显示结论 |

## 5.6 `stats:detailed-report.inbound[]`

数组中每一项代表本端接收的一路 RTP。

| 字段 | 类型/可选值 | Demo 展示 | 含义 |
| --- | --- | --- | --- |
| `type` | `audio`、`video`、`shared`、`unknown` 或扩展字符串 | 用于媒体名称 | SDK 识别后的媒体类别 |
| `kind` | `audio`、`video` 或 `null` | 用于媒体名称 | WebRTC 媒体类型 |
| `mid` | `string \| number \| null` | `视频[1]` 等 | SDP 媒体行标识 |
| `codec.name` | `string \| null` | `编码` | 实际接收的编解码器简称 |
| `receiveBitrateBps` | `number \| null` | `码率` | 本轮实际接收码率，单位 bps |
| `jitterMs` | `number \| null` | `抖动` | RTP 到达本端时的网络抖动，单位 ms |
| `intervalLossPercent` | `number \| null` | `丢包` | 本轮接收丢包率 |
| `frameWidth` | `number \| null` | `画面` | 视频接收/解码宽度 |
| `frameHeight` | `number \| null` | `画面` | 视频接收/解码高度 |
| `framesPerSecond` | `number \| null` | `FPS` | 接收或解码帧率 |
| `averageDecodeTimeMs` | `number \| null` | `解码` | 平均解码一帧耗时 |

远端静音、保持、画面静止或浏览器节流时，码率/FPS 可能下降。不能仅凭低码率判断故障，应同时检查远端是否应当发送、连接状态、丢包、抖动和用户实际体验。

## 5.7 `stats:detailed-report.quality`

| 字段 | 类型/范围 | 说明 |
| --- | --- | --- |
| `RTT` | 非负整数，ms | 当前媒体反馈 RTT 优先；缺失时回退连接 RTT；仍缺失时为 `0` |
| `uplinkNetworkQuality` | `0～6` | 本端发送方向网络质量 |
| `downlinkNetworkQuality` | `0～6` | 本端接收方向网络质量 |
| `issues` | `Array<{ code, severity }>` | 当前样本达到诊断条件的问题 |

Demo 的摘要事件只发送 `code` 和 `severity`。需要查看某个问题对应的流及触发证据时，可以读取：

```js
const fullReport = session.statsMonitor &&
  session.statsMonitor.getLatestReport();

if (fullReport)
{
  fullReport.quality.issues.forEach(function(issue)
  {
    console.log(issue.code, issue.severity, issue.streamId, issue.evidence);
  });
}
```

`severity` 范围为 `1～6`，数字越大越严重。它用于问题排序和提示强度，不等同于 HTTP、SIP 或浏览器错误码。

## 5.8 全部质量问题码与触发条件

### 上行和编码

| `code` | Demo 中文 | 主要触发条件 | 严重度 |
| --- | --- | --- | ---: |
| `UPLINK_BANDWIDTH_LIMITED` | 上行带宽受限 | 视频 `qualityLimitationReason === 'bandwidth'` | 4 |
| `UPLINK_BANDWIDTH_BUDGET_LOW` | 上行可用带宽不足 | 可用上行带宽小于所有活动发送层目标码率总和的 `80%` | 4 |
| `UPLINK_PACKET_LOSS` | 上行丢包 | 远端反馈丢包 `>10%`；`>30%` 时更严重 | 4 / 6 |
| `UPLINK_SEND_QUEUE_DELAY` | 上行发送排队 | 平均发送排队 `>50ms`；`>150ms` 时更严重 | 3 / 5 |
| `UPLINK_HIGH_RETRANSMISSION` | 上行重传率高 | 重传包比例 `>10%`；`>25%` 时更严重 | 3 / 5 |
| `UPLINK_FEEDBACK_REQUESTS` | 上行重传请求多 | 单轮 `NACK >10`，或 `PLI >2`，或 `FIR >2` | 3 |
| `UPLINK_LOCAL_SEND_DISCARDS` | 上行本地丢弃 | 浏览器报告本轮发送包或字节被本地丢弃 | 4 |
| `ENCODER_CPU_LIMITED` | 编码器 CPU 受限 | 视频 `qualityLimitationReason === 'cpu'` | 4 |
| `ENCODER_SLOW` | 编码器过慢 | 平均编码耗时超过单帧预算 `80%`；超过 `150%` 时更严重 | 3 / 5 |
| `ENCODER_FRAME_RATE_REDUCED` | 编码帧率下降 | 采集源 FPS `≥10`，实际编码 FPS 小于源 FPS 的 `70%` | 3 |
| `ENCODER_RESOLUTION_REDUCED` | 编码分辨率下降 | 实际编码像素数小于采集源像素数的 `60%` | 3 |

### 下行和解码

| `code` | Demo 中文 | 主要触发条件 | 严重度 |
| --- | --- | --- | ---: |
| `DOWNLINK_PACKET_LOSS` | 下行丢包 | 当前接收丢包 `>10%`；`>30%` 时更严重 | 4 / 6 |
| `DOWNLINK_HIGH_JITTER` | 下行高抖动 | 抖动 `>50ms`；`>100ms` 时更严重 | 3 / 5 |
| `DOWNLINK_PACKET_DISCARDS` | 下行本地丢弃 | 本轮有接收包被浏览器本地丢弃 | 3 |
| `DOWNLINK_JITTER_BUFFER_DELAY` | 下行缓冲过高 | 平均抖动缓冲 `>200ms`；`>500ms` 时更严重 | 3 / 5 |
| `DOWNLINK_TRANSPORT_STALLED` | 下行传输停滞 | 有下行流、远端未保持，且超过 `10s` 没收到包 | 5 |
| `DOWNLINK_FEEDBACK_REQUESTS` | 下行重传请求多 | 单轮 `NACK >10`，或 `PLI >2`，或 `FIR >2` | 3 |
| `VIDEO_DECODER_SLOW` | 解码器过慢 | 平均解码耗时达到单帧预算 `80%`；超过 `150%` 时更严重 | 3 / 5 |
| `VIDEO_FRAME_DROPPING` | 视频丢帧 | 丢帧比例 `>10%`；`>30%` 时更严重 | 3 / 5 |
| `VIDEO_FREEZING` | 视频卡顿 | 本轮新增冻结次数或冻结时长 | 5 |
| `VIDEO_PAUSING` | 视频暂停 | 本轮新增暂停次数或暂停时长 | 4 |

### 连接

| `code` | Demo 中文 | 主要触发条件 | 严重度 |
| --- | --- | --- | ---: |
| `HIGH_RTT` | 高延迟 | RTT `>200ms`；`>500ms` 时更严重 | 4 / 6 |
| `CONNECTION_PATH_CHANGED` | 网络路径变化 | 本轮选中的 ICE candidate pair 发生变化 | 2 |
| `CONNECTION_UNAVAILABLE` | 连接不可用 | `connectionState` 为 `failed` 或 `closed` | 6 |

切换摄像头、开始/停止共享、音视频模式变化或重协商后会进入短暂过渡期。过渡期继续采样，但暂缓瞬时问题诊断，避免把正常换轨抖动误报成故障。

## 5.9 兼容事件 `stats:network-quality`

```ts
{
  RTT: number,
  uplinkLoss: number,
  downlinkLoss: number,
  uplinkNetworkQuality: 0 | 1 | 2 | 3 | 4 | 5 | 6,
  downlinkNetworkQuality: 0 | 1 | 2 | 3 | 4 | 5 | 6
}
```

字段说明：

| 字段 | 单位 | 计算口径 |
| --- | --- | --- |
| `RTT` | ms | 当前媒体 RTT 优先，缺失时回退连接 RTT |
| `uplinkLoss` | `%` | 所有活动上行 RTP 中当前丢包率最大值 |
| `downlinkLoss` | `%` | 所有下行 RTP 中当前丢包率最大值 |
| `uplinkNetworkQuality` | `0～6` | 按 5.3 阈值计算 |
| `downlinkNetworkQuality` | `0～6` | 按 5.3 阈值计算 |

丢包和 RTT 使用当前采样，不做多样本平均。这样页面能更快反映用户此刻的听感和观感。

## 5.10 兼容事件 `stats:report`

```ts
{
  RTT: number,
  upStreams: Array<LegacyUpStream>,
  downStreams: Array<LegacyDownStream>
}
```

`upStreams[]` 字段：

| 字段 | 说明 |
| --- | --- |
| `type` | `audio`、`video`、`shared` 或扩展类型 |
| `mimeType` | 编解码器名称 |
| `bytesSent` / `packetsSent` | 累计发送字节/包数 |
| `framesSent` / `framesEncoded` | 视频累计发送/编码帧数 |
| `framesPerSecond` | 视频帧率 |
| `frameWidth` / `frameHeight` | 视频分辨率 |
| `loss` | 当前周期上行丢包率，百分比 |
| `jitter` | 远端反馈抖动，ms |
| `speed` | 兼容结构中的码率数值，单位 kbps |

`downStreams[]` 对应字段为 `bytesReceived`、`packetsReceived`、`framesReceived`、`framesDecoded`、`framesPerSecond`、分辨率、`loss`、`jitter` 和 `speed`。

新页面不要把兼容 `speed` 与详细事件的 `*BitrateBps` 混用：前者是 kbps 展示值，后者是 bps 原始数值。

## 5.11 `stats:stats-error`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | `string` | 可稳定记录和聚合的错误标识 |
| `fatal` | `boolean` | 是否为不可继续采样的错误 |
| `message` | `string` | 错误说明 |
| `error` | `Error \| null` | 浏览器原始异常；上报前注意脱敏 |
| `consecutiveErrors` | `number` | 连续失败次数 |

处理原则：

- `fatal === false`：记录后继续等待下一轮，不结束通话。
- 页面不应把统计错误显示成通话失败。
- 连续错误可上报监控系统，但仍以 `failed` / `ended` 和连接状态判断通话生命周期。

## 5.12 最近报告与完整诊断

```js
const monitor = currentSession && currentSession.statsMonitor;

if (monitor)
{
  const quality = monitor.getLatestNetworkQuality();
  const legacy = monitor.getLatestLegacyReport();
  const detailed = monitor.getLatestReport();

  console.log(quality, legacy, detailed);
}
```

| 方法 | 返回值 | 是否主动采样 |
| --- | --- | --- |
| `getLatestNetworkQuality()` | 最近兼容网络质量或 `null` | 否 |
| `getLatestLegacyReport()` | 最近兼容流报告或 `null` | 否 |
| `getLatestReport()` | 最近完整诊断报告或 `null` | 否 |

完整报告还包含采样阶段、候选路径、媒体源、RTP 累计/增量数据、问题证据、兼容等级和采样性能。页面常规展示使用 `stats:detailed-report` 即可；问题上报时可从完整报告选取必要字段，避免直接展示候选地址等网络信息。

`session.statsMonitor` 在 PeerConnection 创建后可用，会话结束释放后为 `null`。会话内实例不要自行调用 `start()`、`stop()` 或 `reset()`。

在 Base JS Demo 的通话建立后，可直接在浏览器控制台执行：

```js
getCurrentCallStats();
```

返回对象同时包含 `networkQuality`、`legacyReport` 和 `detailedReport`，便于把页面显示、兼容事件和完整诊断报告逐项对照。采样尚未产生或通话已结束时，对应值为 `null`。

## 5.13 独立 PeerConnection 监控

只有监控不属于 `RTCSession` 的 PeerConnection 时才直接创建：

```js
const monitor = new CRTC.RTCStatsMonitor(peerConnection, {
  sampleIntervalMs           : 2000,
  legacyReportIntervalMs     : 2000,
  backgroundSampleIntervalMs : 2000,
  transitionGraceSamples     : 2,
  enableDetailedReport       : true,
  enableRawStatsLog          : false,
  rawStatsLogIntervalMs      : 10000,
  getStatsTimeoutMs          : 5000,
  autoStart                  : true
});

monitor.on('detailed-report', renderStats);
monitor.on('stats-error', console.warn);

// 页面不再使用该 PC 时释放。
monitor.stop();
```

| 参数 | 类型 | 默认值 | 有效范围/说明 |
| --- | --- | ---: | --- |
| `sampleIntervalMs` | `number` | `2000` | 前台采样间隔，最小 `500` |
| `legacyReportIntervalMs` | `number` | `2000` | 兼容事件输出间隔 |
| `backgroundSampleIntervalMs` | `number` | `2000` | 页面后台采样间隔 |
| `transitionGraceSamples` | `number` | `2` | 媒体变化后暂缓诊断的样本数，非负整数 |
| `enableDetailedReport` | `boolean` | `true` | 是否发送详细摘要事件 |
| `enableRawStatsLog` | `boolean` | `false` | 是否限频记录浏览器原始报告；生产建议关闭 |
| `rawStatsLogIntervalMs` | `number` | `10000` | 原始报告日志最小间隔 |
| `getStatsTimeoutMs` | `number` | `5000` | 单次采样超时，最小 `100` |
| `autoStart` | `boolean` | `true` | 构造后是否立即采样 |

## 5.14 Demo 面板逐项对照

Base JS Demo 的 `newRTCSession` 中完成了以下处理：

| 面板区域 | 使用字段 |
| --- | --- |
| 上行链路 | `outbound[].kind/type/mid/codec/actualBitrateBps/remoteInbound/frameWidth/frameHeight/framesPerSecond/averageEncodeTimeMs/qualityLimitationReason` |
| 下行链路 | `inbound[].kind/type/mid/codec/receiveBitrateBps/jitterMs/intervalLossPercent/frameWidth/frameHeight/framesPerSecond/averageDecodeTimeMs` |
| 网络连接 | `connectionState/iceConnectionState/dtlsState/sendBitrateBps/availableOutgoingBitrateBps/receiveBitrateBps/availableIncomingBitrateBps` |
| 网络质量 | `quality.RTT/uplinkNetworkQuality/downlinkNetworkQuality` |
| 存在问题 | `quality.issues[].code/severity` |

Demo 代码见 [`demo/base-js/js/app.js`](../../demo/base-js/js/app.js) 的 `RTCSession 统计事件接入示例`。运行和验证步骤见 [Base JS Demo 学习与验证](./08-demo-guide.md)，旧统计迁移见 [旧版功能升级指南](./07-upgrade-guide.md)。

[← 上一章：媒体能力](./04-media-features.md) · [下一章：SDK API 参考 →](./06-api-reference.md)
