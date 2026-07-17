# 5. 通话质量统计

[← 上一章：媒体能力](./04-media-features.md) · [学习目录](./README.md) · [下一章：SDK API 参考 →](./06-api-reference.md)

每个 `RTCSession` 都会管理本通电话的统计实例。页面在 `newRTCSession` 中监听 `session` 的 `stats:*` 事件即可；挂断、呼叫失败和重呼时不需要自行启动或停止定时器。

先按 5.1 完成接入，再根据后续章节理解各字段的业务含义和展示方式。

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

默认约每 `2000ms` 更新一次。通话刚开始时部分值暂时为 `null` 属于正常现象。

Base JS Demo 在每次 `newRTCSession` 中绑定统计，并用 `statsSession` 防止旧会话的延迟结果覆盖新会话。以下代码取自 [`app.js`](../../demo/base-js/js/app.js)：

```js
statsSession = e.session;
resetSessionStatsPanel();

e.session.on('stats:detailed-report', function(report)
{
  if (statsSession !== e.session)
  {
    return;
  }

  const quality = report.quality;
  const issueText = quality.issues.map((issue) =>
  {
    return `${sessionStatsIssueNames[issue.code] || issue.code}(L${issue.severity})`;
  }).join(' | ');

  renderSessionStatsStreams('#rtcStatsOutbound', report.outbound, true);
  renderSessionStatsStreams('#rtcStatsInbound', report.inbound, false);
  renderSessionConnectionStats(report.connection);
  setSessionStatsPanelText(
    '#rtcStatsQuality',
    `RTT:${formatSessionStatsNumber(quality.RTT, 'ms')} | ↑:${formatSessionNetworkQuality(quality.uplinkNetworkQuality)} | ↓:${formatSessionNetworkQuality(quality.downlinkNetworkQuality)}`
  );
  setSessionStatsPanelText('#rtcStatsIssues', issueText || '无');
});

e.session.on('stats:stats-error', function(error)
{
  if (statsSession === e.session)
  {
    console.warn('[RTCStatsMonitor] stats-error:', error);
  }
});
```

这段代码展示了一个完整页面接入应同时考虑的三件事：会话归属、完整报告渲染和非致命错误记录。

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

Demo 的实际格式化函数保留一位小数，并且同样不把空值当成 `0`：

```js
const formatSessionStatsNumber = function(value, unit)
{
  return value === null || value === undefined ? '-' : `${value}${unit || ''}`;
};

const formatSessionStatsBitrate = function(value)
{
  return value === null || value === undefined ? '-' : `${(Math.round(value / 100) / 10).toFixed(1)}kbps`;
};
```

该节选来自 [`app.js`](../../demo/base-js/js/app.js)。这里的换算等价于将 bps 除以 `1000` 后保留一位小数。

## 5.3 网络质量等级 0～6

SDK 分别提供上行和下行质量等级。业务页面应直接使用 SDK 输出的等级，不要根据 RTT 或丢包率自行复刻判定逻辑，以免版本升级后出现口径不一致。

| 等级 | 建议文案 | 页面处理 |
| ---: | --- | --- |
| `0` | 暂无数据 | 显示检测中，不参与好坏排序 |
| `1` | 极佳 | 正常展示 |
| `2` | 较好 | 正常展示 |
| `3` | 一般 | 可使用中性提示 |
| `4` | 较差 | 可提示用户检查网络 |
| `5` | 很差 | 建议明显提示网络质量下降 |
| `6` | 严重异常 | 结合连接状态和连续样本给出强提示 |

### 5.3.1 什么时候会出现 0

常见情况：

- 通话刚开始，统计结果尚未完整生成。
- 纯音频通话中没有视频流；不存在的媒体方向不会被评为 `1`。
- 本端没有活动的发送媒体，所以上行没有可评价的样本。
- 远端尚未发送媒体，所以下行没有 inbound RTP。
- 浏览器没有提供当前方向的 RTT 和丢包字段。
- 切换设备、共享或重协商后，新的 RTP 报告尚未稳定。

业务处理：显示“检测中/暂无数据”，继续等待后续样本。不要把 `0` 排在 `1` 前面当作“更好”。

### 5.3.2 什么时候会出现 6

常见情况：

- 当前网络质量严重下降。
- 媒体连接进入失败或关闭状态。
- SDK 判断当前方向已无法提供可用体验。

单次 `6` 可能来自瞬时网络切换；连续多次为 `6`，并且连接状态、媒体码率或用户体验同时异常时，再展示强提醒。`closed` 也可能是正常挂断后的短暂统计结果，页面应在 `ended` / `failed` 时清空本通电话的数据。

### 5.3.3 页面格式化

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

连接区域可使用以下字段：

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

| 字段 | 类型/可选值 | 建议展示 | 含义 |
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

| 字段 | 类型/可选值 | 建议展示 | 含义 |
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
| `RTT` | 非负整数，ms | SDK 提供的当前往返时延；暂无有效值时为 `0` |
| `uplinkNetworkQuality` | `0～6` | 本端发送方向网络质量 |
| `downlinkNetworkQuality` | `0～6` | 本端接收方向网络质量 |
| `issues` | `Array<{ code, severity }>` | 当前样本达到诊断条件的问题 |

`severity` 范围为 `1～6`，数字越大越严重。它用于问题排序和提示强度，不等同于 HTTP、SIP 或浏览器错误码。

## 5.8 质量问题码

问题码用于页面提示和监控聚合。触发规则由 SDK 版本维护，业务只需根据 `code` 和 `severity` 选择合适的提示文案，不应在页面中自行复制质量判定规则。

### 上行和编码

| `code` | 建议文案 |
| --- | --- |
| `UPLINK_BANDWIDTH_LIMITED` | 上行带宽受限 |
| `UPLINK_BANDWIDTH_BUDGET_LOW` | 上行可用带宽不足 |
| `UPLINK_PACKET_LOSS` | 上行丢包较高 |
| `UPLINK_SEND_QUEUE_DELAY` | 上行发送排队明显 |
| `UPLINK_HIGH_RETRANSMISSION` | 上行重传率较高 |
| `UPLINK_FEEDBACK_REQUESTS` | 上行重传请求较多 |
| `UPLINK_LOCAL_SEND_DISCARDS` | 本地发送数据被丢弃 |
| `ENCODER_CPU_LIMITED` | 编码性能受限 |
| `ENCODER_SLOW` | 视频编码速度较慢 |
| `ENCODER_FRAME_RATE_REDUCED` | 编码帧率下降 |
| `ENCODER_RESOLUTION_REDUCED` | 编码分辨率下降 |

### 下行和解码

| `code` | 建议文案 |
| --- | --- |
| `DOWNLINK_PACKET_LOSS` | 下行丢包较高 |
| `DOWNLINK_HIGH_JITTER` | 下行抖动较高 |
| `DOWNLINK_PACKET_DISCARDS` | 本地接收数据被丢弃 |
| `DOWNLINK_JITTER_BUFFER_DELAY` | 下行缓冲延迟较高 |
| `DOWNLINK_TRANSPORT_STALLED` | 下行媒体传输停滞 |
| `DOWNLINK_FEEDBACK_REQUESTS` | 下行重传请求较多 |
| `VIDEO_DECODER_SLOW` | 视频解码速度较慢 |
| `VIDEO_FRAME_DROPPING` | 视频丢帧明显 |
| `VIDEO_FREEZING` | 视频出现卡顿 |
| `VIDEO_PAUSING` | 视频出现暂停 |

### 连接

| `code` | 建议文案 |
| --- | --- |
| `HIGH_RTT` | 网络延迟较高 |
| `CONNECTION_PATH_CHANGED` | 网络路径发生变化 |
| `CONNECTION_UNAVAILABLE` | 媒体连接不可用 |

切换摄像头、开始/停止共享或改变音视频模式后，短时间的指标波动可能属于正常现象。页面应结合连续样本和用户实际体验判断是否提示。

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

| 字段 | 单位 | 含义 |
| --- | --- | --- |
| `RTT` | ms | 当前往返时延 |
| `uplinkLoss` | `%` | 当前上行丢包率 |
| `downlinkLoss` | `%` | 当前下行丢包率 |
| `uplinkNetworkQuality` | `0～6` | 当前上行质量等级 |
| `downlinkNetworkQuality` | `0～6` | 当前下行质量等级 |

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

## 5.12 最近统计结果

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

页面常规展示使用 `stats:detailed-report` 即可。问题上报时只选取排障需要的字段，并按产品安全要求脱敏。

`session.statsMonitor` 在 PeerConnection 创建后可用，会话结束释放后为 `null`。会话内实例不要自行调用 `start()`、`stop()` 或 `reset()`。

Demo 把最近一份结果暴露给浏览器控制台，便于联调时对照页面面板。以下代码取自 [`app.js`](../../demo/base-js/js/app.js)：

```js
function getCurrentCallStats()
{
  const monitor = rtcSession && rtcSession.statsMonitor;

  if (!monitor)
  {
    return null;
  }

  return {
    networkQuality : monitor.getLatestNetworkQuality(),
    legacyReport   : monitor.getLatestLegacyReport(),
    detailedReport : monitor.getLatestReport()
  };
}

window.getCurrentCallStats = getCurrentCallStats;
```

这些 getter 只读取缓存，不会立即触发一轮 `getStats()`。

## 5.13 独立 PeerConnection 监控

只有监控不属于 `RTCSession` 的 PeerConnection 时才直接创建：

```js
const monitor = new CRTC.RTCStatsMonitor(peerConnection, {
  sampleIntervalMs     : 2000,
  enableDetailedReport : true,
  autoStart            : true
});

monitor.on('detailed-report', renderStats);
monitor.on('stats-error', console.warn);

// 页面不再使用该 PC 时释放。
monitor.stop();
```

| 参数 | 类型 | 默认值 | 有效范围/说明 |
| --- | --- | ---: | --- |
| `sampleIntervalMs` | `number` | `2000` | 前台采样间隔，最小 `500` |
| `enableDetailedReport` | `boolean` | `true` | 是否发送详细摘要事件 |
| `autoStart` | `boolean` | `true` | 构造后是否立即采样 |

## 5.14 Demo 面板逐项对照

示例统计面板可按以下字段组织：

| 面板区域 | 使用字段 |
| --- | --- |
| 上行链路 | `outbound[].kind/type/mid/codec/actualBitrateBps/remoteInbound/frameWidth/frameHeight/framesPerSecond/averageEncodeTimeMs/qualityLimitationReason` |
| 下行链路 | `inbound[].kind/type/mid/codec/receiveBitrateBps/jitterMs/intervalLossPercent/frameWidth/frameHeight/framesPerSecond/averageDecodeTimeMs` |
| 网络连接 | `connectionState/iceConnectionState/dtlsState/sendBitrateBps/availableOutgoingBitrateBps/receiveBitrateBps/availableIncomingBitrateBps` |
| 网络质量 | `quality.RTT/uplinkNetworkQuality/downlinkNetworkQuality` |
| 存在问题 | `quality.issues[].code/severity` |

Demo 代码见 [`demo/base-js/js/app.js`] 的 `RTCSession 统计事件接入示例`。运行和验证步骤见 [Base JS Demo 学习与验证](./08-demo-guide.md)，旧统计迁移见 [旧版功能升级指南](./07-upgrade-guide.md)。

Demo 在新会话开始、当前会话失败或结束时都调用同一个面板重置函数：

```js
const resetSessionStatsPanel = function()
{
  const waitingText = '--';

  setSessionStatsPanelText('#rtcStatsConnection', waitingText);
  setSessionStatsPanelText('#rtcStatsQuality', waitingText);
  setSessionStatsPanelText('#rtcStatsIssues', '无');
  setSessionStatsPanelText('#rtcStatsOutbound', waitingText);
  setSessionStatsPanelText('#rtcStatsInbound', waitingText);
};
```

只清空局部文字而不切换 `statsSession` 不够；结束时还需将归属引用置为 `null`，才能屏蔽旧会话的延迟事件。

[← 上一章：媒体能力](./04-media-features.md) · [下一章：SDK API 参考 →](./06-api-reference.md)
