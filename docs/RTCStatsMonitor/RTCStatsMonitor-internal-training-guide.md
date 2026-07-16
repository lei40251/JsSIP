# RTCStatsMonitor 完整报告内部培训手册

本文面向内部研发、测试、技术支持和交付人员，专门解释以下接口返回的完整诊断对象：

```js
const fullReport = session.statsMonitor.getLatestReport();
```

普通 SDK 日志中的 `detailed-report:` 已改为常用摘要，不再持续打印完整对象。几种输出的区别如下：

- 日志中的 `detailed-report:`：面向日常观察的摘要，字段说明见[摘要日志内部培训简洁版](./RTCStatsMonitor-summary-training-guide.md)。
- `stats:detailed-report` 事件：面向 Demo 和常规监控的稳定摘要事件。
- `session.statsMonitor.getLatestReport()`：返回最近一份完整报告，包含连接路径、候选地址、媒体源、所有 RTP 明细、质量诊断、浏览器兼容性和采样性能，是本文解释的对象。
- `raw stats:`：浏览器原始 `getStats()` 报告，仅在启用 `enableRawStatsLog` 时限频输出，不是本文解释的对象。

> 完整报告可能包含本地/远端 IP、端口、TURN 地址和轨道标识，只应在授权的内部排障环境中收集、传输和保存。

## 1. 先掌握四条阅读规则

### 1.1 `null`、`0` 和字段缺失不是一回事

- `null`：浏览器未提供、没有关联报告、尚无上一份基线、时间戳未前进或累计计数器回退，当前无法可靠计算。
- `0`：浏览器提供了有效值，或一次有效区间计算结果确实为 0。
- 数组为空：当前报告没有该类统计对象，例如纯音频通话没有视频 RTP。
- `quality.RTT`、`quality.uplinkLoss`、`quality.downlinkLoss` 为兼容旧事件使用的数字字段；底层值不可用时会显示 `0`。判断“真实 0”还是“缺数据”必须同时看 RTP 明细、`ready`、`phase` 和 `quality` 等级。

### 1.2 累计值与区间值要分开

- 没有 `Delta`、`Bitrate`、`Percent`、`average` 前缀的包数、字节数、帧数和时长通常是浏览器从本 RTP 对象建立以来的累计值。
- `*Delta`、`*BitrateBps`、`*Percent` 和大部分 `average*Ms` 是当前报告与上一份同 `report.id` 报告之间的区间值，更接近用户当前体验。
- 第一次采样只能建立基线，因此很多区间值为 `null`；下一份同 ID 且时间戳正常的报告才可计算。
- 换轨、重协商、SSRC 或报告 ID 变化时会重新建立基线，不应把前后不同对象的累计值直接相减。

### 1.3 单位

| 后缀或字段 | 单位 |
| --- | --- |
| `*Bps` | bit/s |
| `*Ms` | 毫秒 |
| `*Percent`、`uplinkLoss`、`downlinkLoss` | 百分比，范围通常为 0～100 |
| `timestamp`、`remoteTimestamp` | 浏览器统计时间戳，通常为毫秒 |
| `totalFreezesDuration`、`totalPausesDuration` | 秒，浏览器累计值 |
| `qualityLimitationDurations` | 秒，按原因累计 |
| 宽高 | 像素 |
| FPS | 帧/秒 |

### 1.4 关联关系

```text
sources[] / outbound[].source
        ↓
outbound-rtp ── remoteId/localId ── remote-inbound-rtp
        ↓
本端发送                        远端对本端上行的反馈

remote-outbound-rtp ── localId/remoteId ── inbound-rtp
        ↓                                      ↓
远端发送侧补充信息                         本端接收

transport ── selectedCandidatePairId ── candidate-pair
                                      ├─ local-candidate
                                      └─ remote-candidate
```

报告中的 `id`、`localId`、`remoteId`、`mediaSourceId`、`codecId` 和 candidate ID 用来连接这些对象。阅读单路媒体时，先锁定 `outbound[].id` 或 `inbound[].id`，再沿嵌套对象和 ID 查同一路数据。

## 2. 完整报告结构

```text
DetailedReport
├─ timestamp
├─ sampleDurationMs
├─ ready
├─ phase
├─ transition
├─ connection
├─ sources[]
├─ outbound[]
│  ├─ codec
│  ├─ source
│  └─ remoteInbound
├─ remoteInbound[]
├─ inbound[]
│  ├─ codec
│  └─ remoteOutbound
├─ quality
│  ├─ issues[]
│  └─ context
├─ compatibility
└─ performance
```

## 3. 顶层字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `timestamp` | number | 本轮所有浏览器报告中最大的统计时间戳；没有有效时间戳时回退到 `Date.now()`。 |
| `sampleDurationMs` | number/null | 本轮所有可比较上下行 RTP 中最大的实际采样间隔。没有可比较流时为 `null`。 |
| `ready` | boolean | 至少存在一路可比较且已算出发送或接收码率时为 `true`。它表示增量统计已就绪，不等于通话一定正常。 |
| `phase` | string | 当前监控阶段，见下表。 |
| `transition` | object/null | 仅 `phase=transitioning` 时存在，记录过渡原因和剩余保护样本数。 |
| `connection` | object | PeerConnection、transport、选中 candidate pair 及候选地址信息。 |
| `sources` | array | 浏览器原始 `media-source` 报告的本地采集源列表。 |
| `outbound` | array | 每一条本端发送 RTP 的完整明细。 |
| `remoteInbound` | array | 所有远端对本端上行 RTP 的接收反馈。 |
| `inbound` | array | 每一条本端接收 RTP 的完整明细。 |
| `quality` | object | 当前网络等级、媒体等级、问题列表和会话上下文。 |
| `compatibility` | object | 本运行环境实际观察到的 `getStats()` 能力。 |
| `performance` | object | 本次采样和解析本身的性能数据。 |

### 3.1 `phase`

| 值 | 含义 | 阅读方式 |
| --- | --- | --- |
| `warming-up` | 尚无可比较的有效增量 | 建连初期或报告 ID 刚变化时常见，先等待下一轮 |
| `transitioning` | 换轨、设备切换、共享、模式切换、重协商或统计拓扑变化后的保护期 | 瞬时媒体问题暂缓诊断，重点看连接是否恢复和剩余样本数 |
| `active` | 已有可比较的上下行统计 | 可正常判读当前区间指标 |
| `reconnecting` | `connectionState` 为 `failed` 或 `disconnected` | 正在断线或恢复，优先排查连接路径 |
| `stopped` | PeerConnection 已关闭 | 通话结束后正常；通话中出现则异常 |

`transition.reason` 是触发保护期的原因，例如设备切换、共享开始/停止、重协商、模式变化或 `stats-topology-changed`；`remainingSamples` 是还要跳过瞬时诊断的样本数。

## 4. `connection`：连接与 ICE 路径

### 4.1 状态和候选对选择

| 字段 | 说明 |
| --- | --- |
| `connectionState` | `RTCPeerConnection.connectionState`；浏览器缺少时回退到 `iceConnectionState`。稳定通话通常为 `connected`。 |
| `iceConnectionState` | PeerConnection 的 ICE 连接状态，如 `new/checking/connected/completed/disconnected/failed/closed`。 |
| `iceGatheringState` | ICE 候选收集状态，如 `new/gathering/complete`。 |
| `signalingState` | SDP 信令状态，如 `stable/have-local-offer/have-remote-offer/closed`。 |
| `dtlsState` | 选中 transport 的 DTLS 状态；没有 transport 报告时为 `null`。 |
| `iceState` | 选中 transport 报告中的 ICE 状态；它不是 PeerConnection 的 `iceConnectionState`。 |
| `selectedCandidatePairId` | 当前选中 candidate pair 的报告 ID。 |
| `candidatePairSelection` | `transport`：由 `transport.selectedCandidatePairId` 精确关联；`fallback`：回退选择 `selected=true` 或 `nominated && succeeded`；`unavailable`：未找到。 |
| `candidatePairState` | 选中候选对状态，稳定链路通常为 `succeeded`。 |
| `candidatePairNominated` | 当前候选对是否被 ICE 提名；浏览器未提供时为 `null`。 |
| `localCandidateId` | 选中候选对关联的本地 candidate ID。 |
| `remoteCandidateId` | 选中候选对关联的远端 candidate ID。 |
| `selectedCandidatePairChanges` | transport 累计发生的选中候选对变更次数。 |
| `selectedCandidatePairChangesDelta` | 本采样周期新增的候选对变更次数；大于 0 会产生路径变化提示。 |

### 4.2 时延、带宽和传输计数

| 字段 | 说明 |
| --- | --- |
| `rttMs` | 当前 candidate pair 的 `currentRoundTripTime`，转换为毫秒。它是传输路径 RTT；`quality.RTT` 会优先采用媒体 RTT。 |
| `averageRttMs` | candidate pair 累计 `totalRoundTripTime / responsesReceived`，单位毫秒；用于观察历史整体，不参与当前网络等级。 |
| `availableOutgoingBitrateBps` | 浏览器估算的当前可用上行带宽。 |
| `availableIncomingBitrateBps` | 浏览器估算的当前可用下行带宽，很多浏览器不提供。 |
| `sendBitrateBps` | candidate pair 的 `bytesSent` 区间增量换算出的整条连接实际发送码率。 |
| `receiveBitrateBps` | candidate pair 的 `bytesReceived` 区间增量换算出的整条连接实际接收码率。 |
| `bytesSent` | candidate pair 累计发送字节数。 |
| `bytesReceived` | candidate pair 累计接收字节数。 |
| `packetsSent` | candidate pair 累计发送包数。 |
| `packetsReceived` | candidate pair 累计接收包数。 |
| `packetsDiscardedOnSend` | 本机在发送前累计丢弃的包数。 |
| `packetsDiscardedOnSendDelta` | 本周期新增的发送前丢弃包数；大于 0 会触发本地发送丢弃问题。 |
| `bytesDiscardedOnSend` | 本机在发送前累计丢弃的字节数。 |
| `bytesDiscardedOnSendDelta` | 本周期新增的发送前丢弃字节数。 |
| `lastPacketSentAgoMs` | 报告时间戳距最后发送数据包时间的间隔。 |
| `lastPacketReceivedAgoMs` | 报告时间戳距最后接收数据包时间的间隔；有下行、非远端 hold 且超过 10 秒时判定传输停滞。 |

连接层的 `sendBitrateBps/receiveBitrateBps` 是整个候选对上的流量；RTP 层码率是单路媒体，二者统计边界不同，不应要求简单相等。

### 4.3 `localCandidate` / `remoteCandidate`

两个对象结构相同：

| 字段 | 说明 |
| --- | --- |
| `id` | candidate 报告 ID。 |
| `candidateType` | `host`、`srflx`、`prflx` 或 `relay`。`relay` 表示经 TURN 中继。 |
| `protocol` | candidate 的传输协议，常见 `udp` 或 `tcp`。 |
| `relayProtocol` | TURN relay 使用的底层协议，未中继或浏览器未提供时为 `null`。 |
| `address` | candidate 地址，优先读 `address`，旧实现回退到 `ip`。可能是 IP、mDNS 名称或被浏览器隐藏。 |
| `port` | candidate 端口。 |
| `url` | 生成该 candidate 的 STUN/TURN URL，浏览器可能不提供。 |
| `relatedAddress` | `srflx/relay` candidate 对应的基础地址。 |
| `relatedPort` | 对应的基础端口。 |

常用判读：

- `host ↔ host`：通常是局域网或直连。
- `srflx`：经过 NAT 映射后仍为点对点路径。
- 任一侧为 `relay`：媒体正在使用 TURN；这是可用的兼容路径，不应单独视为故障。
- `selectedCandidatePairId` 频繁变化：可能是网络切换、弱网恢复、VPN 或多网卡抖动。

## 5. `sources[]`：浏览器媒体源

`sources[]` 只来自浏览器实际提供的 `media-source` 报告，不包含 `getSettings()` 回退。

| 字段 | 说明 |
| --- | --- |
| `id` | `media-source` 报告 ID。 |
| `kind` | 媒体类型，通常为 `audio` 或 `video`。 |
| `trackIdentifier` | 对应本地轨道标识。 |
| `width` | 视频源宽度；音频或缺字段时为 `null`。 |
| `height` | 视频源高度。 |
| `frames` | 媒体源累计产生的帧数，浏览器可能不提供。 |
| `framesPerSecond` | 当前采集源 FPS。 |

`sources[]` 为空不代表没有本地轨道。有些浏览器不提供 `media-source`，此时 `outbound[].source` 仍可能从发送轨道的 `getSettings()` 补到宽高和 FPS。

## 6. `outbound[]`：本端发送 RTP

每个数组元素对应一条 `outbound-rtp`，多路视频、Simulcast、屏幕共享或多 MID 时会出现多条，必须逐条阅读。

### 6.1 标识、分类和关联

| 字段 | 说明 |
| --- | --- |
| `id` | 当前 `outbound-rtp` 报告 ID，也是 `issues[].streamId` 关联该流的主键。 |
| `type` | SDK 业务分类，默认随 `kind`；视频 MID 等于会话 `sharedMid` 时为 `shared`；自定义分类器也可覆盖。 |
| `kind` | 浏览器报告的实际媒体类型，通常为 `audio` 或 `video`。 |
| `ssrc` | RTP SSRC。多编码层可能拥有不同 SSRC。 |
| `mid` | SDP MID，用于关联 transceiver 和区分媒体行。 |
| `rid` | RTP Stream ID，Simulcast 编码层常见；普通单层流可能为 `null`。 |
| `encodingIndex` | 浏览器提供的编码层索引，非标准实现可能不提供。 |
| `active` | 浏览器明确为 `false` 时表示该层未激活；缺字段默认按激活处理。 |
| `trackIdentifier` | 优先取媒体源标识，其次取 RTP 报告，再回退 sender track ID。 |
| `mediaSourceId` | 关联的 `media-source` 报告 ID。 |
| `timestamp` | 当前 RTP 报告时间戳。 |
| `sampleDurationMs` | 当前与上一份同 ID RTP 报告之间的实际间隔。 |
| `comparable` | 是否存在上一份同 ID 且时间戳前进的报告。`true` 只说明具备区间比较基础，不保证浏览器提供了每个计数器。 |

### 6.2 码率、字节和包

| 字段 | 说明 |
| --- | --- |
| `actualBitrateBps` | `bytesSent` 的区间增量换算值，即媒体负载实际发送码率，不含 RTP 头字节。 |
| `rtpBitrateBps` | `bytesSent + headerBytesSent` 的区间码率；缺少头字节字段时按 0 补充。 |
| `targetBitrateBps` | 浏览器编码/拥塞控制当前目标码率，不是业务配置值的保证结果。 |
| `retransmitBitrateBps` | `retransmittedBytesSent` 的区间码率。 |
| `retransmitPacketPercent` | 本周期重传包增量占发送包增量的百分比。 |
| `bytesSent` | 累计发送媒体负载字节数。 |
| `headerBytesSent` | 累计发送 RTP 头字节数。 |
| `retransmittedBytesSent` | 累计重传字节数。 |
| `packetsSent` | 累计发送 RTP 包数。 |
| `packetsSentDelta` | 本周期新增发送包数。 |
| `retransmittedPacketsSent` | 累计重传包数。 |

### 6.3 视频帧、编码性能和质量限制

| 字段 | 说明 |
| --- | --- |
| `framesSent` | 累计送入 RTP 发送链路的帧数。 |
| `framesEncoded` | 累计成功编码帧数。 |
| `framesEncodedDelta` | 本周期新增编码帧数。 |
| `framesPerSecond` | 浏览器当前编码 FPS；缺失时回退旧字段 `framerateMean`。 |
| `frameWidth` | 实际编码输出宽度；浏览器缺失时回退到 `source.width`。 |
| `frameHeight` | 实际编码输出高度；浏览器缺失时回退到 `source.height`。 |
| `keyFramesEncoded` | 累计编码关键帧数。关键帧突增常与入会、丢包恢复、PLI/FIR 或场景切换有关。 |
| `hugeFramesSent` | 浏览器判定的累计超大帧数，缺字段时为 `null`。 |
| `averageEncodeTimeMs` | 本周期 `totalEncodeTime` 增量除以 `framesEncoded` 增量，表示平均单帧编码耗时。 |
| `averagePacketSendDelayMs` | 本周期 `totalPacketSendDelay` 增量除以发送包增量，表示包在本地发送队列中的平均等待时间。 |
| `averageQp` | 本周期 `qpSum` 增量除以编码帧增量。QP 越高通常压缩越强、画质越低，但不同编码器不能直接横向比较。 |
| `qpSum` | 浏览器累计 QP 总和。 |
| `qualityLimitationReason` | `none`、`bandwidth`、`cpu` 或 `other`；说明浏览器为何限制视频质量。 |
| `qualityLimitationDurations` | 各限制原因累计持续秒数，例如 `{none, cpu, bandwidth, other}`。 |
| `qualityLimitationDurationsDelta` | 各限制原因在本采样周期新增的秒数；计数器回退的项为 `null`。 |
| `qualityLimitationResolutionChangesDelta` | 本周期因质量限制发生的分辨率调整次数。 |

### 6.4 反馈请求和嵌套对象

| 字段 | 说明 |
| --- | --- |
| `nackCountDelta` | 本周期收到的 NACK 增量，表示远端请求重传丢失 RTP 包。 |
| `pliCountDelta` | 本周期收到的 PLI 增量，表示远端请求新的视频关键帧。 |
| `firCountDelta` | 本周期收到的 FIR 增量，也是关键帧刷新请求。 |
| `codec` | 本路实际编解码器对象，字段见 6.5。 |
| `source` | 本路采集源对象，字段见 6.6。 |
| `remoteInbound` | 与本路发送 RTP 关联的远端接收反馈，字段见第 7 章；浏览器无反馈时为 `null`。 |

### 6.5 `codec`

`outbound[].codec`、`remoteInbound[].codec` 和 `inbound[].codec` 结构相同：

| 字段 | 说明 |
| --- | --- |
| `mimeType` | 完整 MIME 类型，例如 `audio/opus`、`video/H264`。 |
| `name` | 从 MIME 类型提取的短名称，例如 `opus`、`H264`。 |
| `payloadType` | RTP Payload Type。 |
| `clockRate` | RTP 时钟频率，单位 Hz。 |
| `channels` | 音频声道数；视频通常为 `null`。 |
| `sdpFmtpLine` | 编解码器格式参数，例如 H264 profile-level-id；浏览器可能不提供。 |

### 6.6 `source`

| 字段 | 说明 |
| --- | --- |
| `id` | 对应 `media-source` ID；使用轨道设置回退时为 `null`。 |
| `trackIdentifier` | 媒体源或 sender track 标识。 |
| `width` | 采集源宽度。 |
| `height` | 采集源高度。 |
| `framesPerSecond` | 采集源 FPS。 |
| `origin` | `media-source` 表示来自浏览器统计；`track-settings` 表示回退自 `track.getSettings()`。 |

比较 `source` 与 outbound 本身可以判断编码降级：

- `source.width/height/FPS`：进入编码器前的采集规格。
- `frameWidth/frameHeight/framesPerSecond`：编码器实际输出规格。
- 两者下降不一定是故障；应同时看 `qualityLimitationReason`、带宽、CPU 和用户观感。

## 7. `remoteInbound[]`：远端对本端上行的反馈

完整报告顶层 `remoteInbound[]` 列出浏览器提供的所有 `remote-inbound-rtp`；`outbound[].remoteInbound` 是其中与某条本端发送 RTP 关联的一份。两处字段含义相同。

| 字段 | 说明 |
| --- | --- |
| `id` | `remote-inbound-rtp` 报告 ID。 |
| `localId` | 对应本地 `outbound-rtp` ID。 |
| `kind` | 被反馈媒体的类型。 |
| `ssrc` | 远端反馈的 SSRC。 |
| `codec` | 本路 RTP 编解码器，结构见 6.5。 |
| `packetsLost` | 远端累计观测到的丢包数。 |
| `packetsReceived` | 远端累计接收包数；部分浏览器不提供。 |
| `intervalLossPercent` | 当前上行丢包百分比。优先使用浏览器的 `fractionLost × 100`；没有 `fractionLost` 时使用丢包与收包的区间增量计算。 |
| `fractionLost` | 浏览器原始 RTCP 丢包比例，通常为 0～1；这是原值，不是百分数。 |
| `jitterMs` | 远端接收本端 RTP 时观测到的抖动，已转换为毫秒。 |
| `rttMs` | 当前媒体 RTP 反馈 RTT，单位毫秒；`quality.RTT` 优先使用所有上行流中最大的这个值。 |
| `averageRttMs` | 累计 `totalRoundTripTime / roundTripTimeMeasurements`，单位毫秒；不参与当前质量等级。 |

上行排障必须优先看 `outbound[].remoteInbound`：本端 `outbound-rtp` 自身无法直接知道媒体到达远端前的最终丢包、抖动和 RTT。`remoteInbound=null` 只表示浏览器没有给出远端反馈，不能直接判定上行无丢包。

## 8. `inbound[]`：本端接收 RTP

每个元素对应一条 `inbound-rtp`。下行码率、丢包、抖动、解码、缓冲、丢帧、卡顿、暂停、重传和 FEC 都在这里逐流记录。

### 8.1 标识、分类和基础接收量

| 字段 | 说明 |
| --- | --- |
| `id` | 当前 `inbound-rtp` 报告 ID，也是下行问题的 `streamId`。 |
| `type` | SDK 业务分类，默认随 `kind`，共享视频可为 `shared`。 |
| `kind` | 浏览器媒体类型，通常为 `audio` 或 `video`。 |
| `ssrc` | 下行 RTP SSRC。 |
| `mid` | SDP MID。 |
| `trackIdentifier` | 浏览器报告的接收轨道标识，缺失时回退 receiver track ID。 |
| `codec` | 实际接收编解码器，结构见 6.5。 |
| `timestamp` | 当前 RTP 报告时间戳。 |
| `sampleDurationMs` | 与上一份同 ID 报告之间的实际间隔。 |
| `comparable` | 是否具备同 ID 且时间戳正常的上一份报告。 |
| `receiveBitrateBps` | `bytesReceived` 区间增量换算的媒体负载接收码率，不含 RTP 头。 |
| `rtpBitrateBps` | `bytesReceived + headerBytesReceived` 的区间码率。 |
| `bytesReceived` | 累计接收媒体负载字节数。 |
| `headerBytesReceived` | 累计接收 RTP 头字节数。 |
| `packetsReceived` | 累计接收 RTP 包数。 |
| `packetsLost` | 累计接收丢包数。 |
| `intervalLossPercent` | 本周期 `丢包增量 / (丢包增量 + 收包增量) × 100`。 |
| `packetsDiscarded` | RTP 包到达本机后、进入播放前累计被丢弃的数量。 |
| `packetsDiscardedDelta` | 本周期新增的本地丢弃包数。 |
| `jitterMs` | 本端接收 RTP 的当前抖动，单位毫秒。 |

### 8.2 视频帧、解码和播放

| 字段 | 说明 |
| --- | --- |
| `framesReceived` | 累计接收的完整视频帧数。 |
| `framesDecoded` | 累计成功解码帧数。 |
| `framesDecodedDelta` | 本周期新增解码帧数。 |
| `framesRendered` | 累计渲染帧数，部分浏览器不提供。 |
| `framesDropped` | 累计丢弃视频帧数。 |
| `droppedFramePercent` | 本周期丢帧增量占“丢帧增量 + 解码帧增量”的百分比。 |
| `framesPerSecond` | 当前接收/解码 FPS；缺失时回退旧字段 `framerateMean`。 |
| `frameWidth` | 当前解码视频宽度。 |
| `frameHeight` | 当前解码视频高度。 |
| `averageDecodeTimeMs` | 本周期 `totalDecodeTime` 增量除以解码帧增量，表示平均单帧解码耗时。 |
| `averageProcessingDelayMs` | 本周期 `totalProcessingDelay` 增量除以解码帧增量，表示从收到编码帧到完成解码的平均处理延迟。 |

### 8.3 Jitter Buffer

| 字段 | 说明 |
| --- | --- |
| `averageJitterBufferDelayMs` | 本周期 jitter buffer 实际累计延迟增量除以输出样本增量。数值越高，播放越平滑但端到端延迟越大。 |
| `averageJitterBufferTargetDelayMs` | 本周期浏览器目标缓冲延迟均值。 |
| `averageJitterBufferMinimumDelayMs` | 本周期浏览器可达到的最小缓冲延迟均值。 |
| `jitterBufferEmittedCount` | jitter buffer 累计输出的音频样本或视频帧数量，是上述均值的计数分母。 |

实际延迟显著高于目标延迟时，可进一步结合网络抖动、主线程负载和浏览器实现判断；缺少这些字段的浏览器不能据此诊断。

### 8.4 卡顿、暂停与反馈请求

| 字段 | 说明 |
| --- | --- |
| `freezeCount` | 累计视频卡顿次数。 |
| `freezeCountDelta` | 本周期新增卡顿次数。 |
| `totalFreezesDuration` | 累计卡顿时长，浏览器原始单位为秒。 |
| `freezesDurationDeltaMs` | 本周期新增卡顿时长，转换为毫秒。 |
| `pauseCount` | 累计视频暂停次数。 |
| `pauseCountDelta` | 本周期新增暂停次数。 |
| `totalPausesDuration` | 累计暂停时长，单位秒。 |
| `pausesDurationDeltaMs` | 本周期新增暂停时长，单位毫秒。 |
| `nackCountDelta` | 本周期本端发送的 NACK 增量，请求远端重传丢失 RTP 包。 |
| `pliCountDelta` | 本周期本端发送的 PLI 增量，请求远端视频关键帧。 |
| `firCountDelta` | 本周期本端发送的 FIR 增量。 |

`freeze` 和 `pause` 是浏览器统计定义，不能简单等同于 DOM `<video>` 的 pause 事件。内部排障时要结合用户画面、FPS、丢帧和时间线。

### 8.5 重传与 FEC

| 字段 | 说明 |
| --- | --- |
| `retransmittedPacketsReceived` | 累计收到的重传包数。 |
| `retransmittedPacketsReceivedDelta` | 本周期新增重传包数。 |
| `retransmittedBytesReceived` | 累计收到的重传字节数。 |
| `retransmittedBytesReceivedDelta` | 本周期新增重传字节数。 |
| `retransmitReceiveBitrateBps` | 本周期重传字节换算的接收码率。 |
| `fecPacketsReceived` | 累计收到的 FEC 包数。 |
| `fecPacketsReceivedDelta` | 本周期新增 FEC 包数。 |
| `fecPacketsDiscarded` | 累计丢弃的 FEC 包数。 |
| `fecPacketsDiscardedDelta` | 本周期新增丢弃 FEC 包数。 |
| `fecBytesReceived` | 累计收到的 FEC 字节数。 |
| `fecBytesReceivedDelta` | 本周期新增 FEC 字节数。 |
| `fecReceiveBitrateBps` | 本周期 FEC 字节换算的接收码率。 |

重传和 FEC 增长表示恢复机制正在工作，不应单独判为故障；只有当它们持续较高并伴随丢包、低码率、卡顿或用户投诉时，才说明网络恢复开销明显。

### 8.6 `remoteOutbound`

它是远端发送侧通过 `remote-outbound-rtp` 提供的补充信息：

| 字段 | 说明 |
| --- | --- |
| `id` | `remote-outbound-rtp` 报告 ID。 |
| `remoteTimestamp` | 远端报告时间戳。 |
| `reportsSent` | 远端累计发送的 RTCP Sender Report 数量。 |
| `bytesSent` | 远端声明的累计发送字节数。 |
| `packetsSent` | 远端声明的累计发送包数。 |
| `roundTripTimeMs` | 该远端报告给出的 RTT，单位毫秒。 |

`remoteOutbound=null` 很常见；下行主诊断仍以本端 `inbound-rtp` 为准。

## 9. `quality`：质量结论

| 字段 | 说明 |
| --- | --- |
| `uplinkNetworkQuality` | 当前上行网络等级 0～6，仅由当前上行最差丢包、当前 RTT 和连接可用性计算。 |
| `downlinkNetworkQuality` | 当前下行网络等级 0～6。 |
| `RTT` | 当前质量 RTT 的向下取整整数毫秒。优先取所有 `outbound[].remoteInbound.rttMs` 中最大值；没有媒体 RTT 时回退 `connection.rttMs`；都没有时为 0。 |
| `uplinkLoss` | 所有上行流当前 `intervalLossPercent` 的最大值，向下取整；无数据时为 0。 |
| `downlinkLoss` | 所有下行流当前 `intervalLossPercent` 的最大值，向下取整；无数据时为 0。 |
| `uplinkMediaQuality` | 上行网络等级与所有 `UPLINK_*`、`ENCODER_*` 问题严重度的最大值。 |
| `downlinkMediaQuality` | 下行网络等级与所有 `DOWNLINK_*`、`VIDEO_*` 问题严重度的最大值。 |
| `issues` | 当前采样识别到的问题列表。 |
| `context` | RTCSession 提供的会话状态，用于解释 hold、mute、共享和模式。 |

### 9.1 网络等级算法

数字越大越差，丢包和 RTT 使用“或”关系。多路 RTP 取当前最差一路，不做历史样本平均：

| 等级 | 条件 |
| ---: | --- |
| 0 | 该方向没有活动媒体，或丢包和 RTT 都不可用 |
| 1 | 丢包为 0 且 RTT 小于 50ms |
| 2 | 丢包大于 0，或 RTT 大于等于 50ms |
| 3 | 丢包大于 10%，或 RTT 大于 100ms |
| 4 | 丢包大于 20%，或 RTT 大于 200ms |
| 5 | 丢包大于 30%，或 RTT 大于 350ms |
| 6 | 丢包大于 40%，RTT 大于 500ms，或连接状态为 `failed/closed` |

边界使用源码中的严格比较。例如 RTT 恰好为 200ms 时尚未进入 L4，超过 200ms 才进入；RTT 恰好为 50ms 时进入 L2。

### 9.2 `context`

| 字段 | 说明 |
| --- | --- |
| `sessionStatus` | RTCSession 当前内部状态码或状态值；未提供时为 `null`。 |
| `mode` | 当前通话模式，例如 `audio`、`video`；未提供时为 `null`。 |
| `localHold` | 本端是否保持通话。 |
| `remoteHold` | 远端是否保持通话；为 `true` 时长时间无下行不会误判为传输停滞。 |
| `audioMuted` | 本端音频是否静音。 |
| `videoMuted` | 本端视频是否静音。 |
| `sharedMid` | 屏幕共享对应 MID，用于把视频流分类为 `shared`。 |

### 9.3 `issues[]` 公共字段

| 字段 | 说明 |
| --- | --- |
| `code` | 稳定的问题代码。 |
| `severity` | 1～6，数字越大越严重。 |
| `streamId` | 关联的 `outbound[].id` 或 `inbound[].id`；连接级问题为 `null`。 |
| `evidence` | 触发本问题时保存的证据字段。不要只看 code，应把 evidence 与对应流明细一起读。 |

`phase=transitioning` 时会暂缓所有瞬时流和连接问题；`CONNECTION_UNAVAILABLE` 仍会保留，避免真正断线被保护期隐藏。

### 9.4 所有问题代码、触发条件与 evidence

| code | 触发条件与等级 | evidence |
| --- | --- | --- |
| `UPLINK_BANDWIDTH_LIMITED` | `qualityLimitationReason=bandwidth`，L4 | `targetBitrateBps`, `actualBitrateBps` |
| `ENCODER_CPU_LIMITED` | `qualityLimitationReason=cpu`，L4 | `averageEncodeTimeMs`, `framesPerSecond` |
| `UPLINK_PACKET_LOSS` | 上行区间丢包 >10% 为 L4；>30% 为 L6 | `lossPercent`, `jitterMs`, `rttMs` |
| `UPLINK_SEND_QUEUE_DELAY` | 平均发包排队 >50ms 为 L3；>150ms 为 L5 | `averagePacketSendDelayMs` |
| `UPLINK_HIGH_RETRANSMISSION` | 重传包比例 >10% 为 L3；>25% 为 L5 | `retransmitPacketPercent`, `retransmitBitrateBps` |
| `UPLINK_FEEDBACK_REQUESTS` | 本周期 NACK >10，或 PLI/FIR >2，L3 | `nackCountDelta`, `pliCountDelta`, `firCountDelta` |
| `ENCODER_SLOW` | 视频平均编码耗时 >单帧预算 80% 为 L3；>150% 为 L5 | `averageEncodeTimeMs`, `frameBudgetMs` |
| `ENCODER_FRAME_RATE_REDUCED` | 源 FPS ≥10，编码 FPS <源 FPS 的 70%，L3 | `sourceFps`, `encodedFps` |
| `ENCODER_RESOLUTION_REDUCED` | 编码像素数 <源像素数的 60%，L3 | 源和编码的宽高 |
| `DOWNLINK_PACKET_LOSS` | 下行区间丢包 >10% 为 L4；>30% 为 L6 | `lossPercent`, `jitterMs` |
| `DOWNLINK_HIGH_JITTER` | 下行抖动 >50ms 为 L3；>100ms 为 L5 | `jitterMs` |
| `VIDEO_FRAME_DROPPING` | 区间丢帧 >10% 为 L3；>30% 为 L5 | `droppedFramePercent`, `averageDecodeTimeMs` |
| `VIDEO_FREEZING` | 本周期卡顿次数或卡顿时长增量 >0，L5 | `freezeCountDelta`, `freezesDurationDeltaMs` |
| `DOWNLINK_PACKET_DISCARDS` | 本周期本地接收丢弃包 >0，L3 | `packetsDiscardedDelta` |
| `DOWNLINK_JITTER_BUFFER_DELAY` | 平均实际缓冲 >200ms 为 L3；>500ms 为 L5 | `averageJitterBufferDelayMs`, `averageJitterBufferTargetDelayMs` |
| `VIDEO_DECODER_SLOW` | 视频平均解码耗时 ≥单帧预算 80% 为 L3；>150% 为 L5 | `averageDecodeTimeMs`, `frameBudgetMs` |
| `VIDEO_PAUSING` | 本周期暂停次数或暂停时长增量 >0，L4 | `pauseCountDelta`, `pausesDurationDeltaMs` |
| `DOWNLINK_FEEDBACK_REQUESTS` | 本周期 NACK >10，或 PLI/FIR >2，L3 | `nackCountDelta`, `pliCountDelta`, `firCountDelta` |
| `UPLINK_LOCAL_SEND_DISCARDS` | candidate pair 本周期发送前丢弃包或字节 >0，L4 | `packetsDiscardedOnSendDelta`, `bytesDiscardedOnSendDelta` |
| `UPLINK_BANDWIDTH_BUDGET_LOW` | 可用上行带宽 <所有激活且有目标码率的上行流目标码率总和 ×80%，L4 | `availableOutgoingBitrateBps`, `activeTargetBitrateBps` |
| `DOWNLINK_TRANSPORT_STALLED` | 存在下行、远端未 hold，且距最后收包 >10 秒，L5 | `lastPacketReceivedAgoMs` |
| `CONNECTION_PATH_CHANGED` | 本周期选中 candidate pair 变化次数 >0，L2 | `selectedCandidatePairChangesDelta`, `selectedCandidatePairId` |
| `HIGH_RTT` | 当前质量 RTT >200ms 为 L4；>500ms 为 L6 | `rttMs` |
| `CONNECTION_UNAVAILABLE` | `connectionState=failed/closed`，L6 | `connectionState` |

## 10. `compatibility`：实际浏览器能力

兼容性不是按 User-Agent 写死，而是根据本次运行中实际调用成功的 API、观察到的报告类型和字段累积判断。

| 字段 | 说明 |
| --- | --- |
| `level` | `full`、`partial`、`legacy-basic` 或 `unsupported`。 |
| `api.getStats` | PeerConnection 是否存在 `getStats` 函数。 |
| `api.promiseGetStats` | 实际调用是否观察到 Promise 形式。 |
| `api.callbackGetStats` | 是否实际使用过 callback 回退形式。 |
| `api.getTransceivers` | 是否存在 `getTransceivers()`。 |
| `api.standardStatsReport` | 是否观察到标准 MapLike `RTCStatsReport`。 |
| `observedStatsTypes` | 从监控开始到当前累计观察到的报告类型，排序后输出，例如 `transport/candidate-pair/outbound-rtp/inbound-rtp`。 |
| `observedFeatures` | 高级字段是否曾经出现，见下表。 |
| `statsFormat` | 本轮归一化前的容器格式：`standard`、`object`、`legacy` 或 `unknown`。 |

兼容等级：

| level | 实际含义 |
| --- | --- |
| `full` | 已观察到 transport + candidate-pair、至少一种 RTP，并至少观察到 remote-inbound、质量限制或 jitter buffer 等高级能力。 |
| `partial` | 能采样标准/普通对象报告，但连接、RTP 或高级字段不完整。 |
| `legacy-basic` | 使用旧 Chrome `result()/stat()` 报告，仅保证基础指标。 |
| `unsupported` | 当前环境没有可用的 `getStats()`。 |

`observedFeatures` 固定包含以下布尔字段：

| 字段 | 表示曾观察到 |
| --- | --- |
| `remoteInboundRtp` | `remote-inbound-rtp` 报告 |
| `qualityLimitationReason` | 视频发送质量限制原因 |
| `jitterBufferDelay` | 下行 jitter buffer 累计延迟 |
| `freezeCount` | 视频卡顿计数 |
| `framesRendered` | 视频渲染帧数 |
| `availableOutgoingBitrate` | 可用上行带宽 |
| `availableIncomingBitrate` | 可用下行带宽 |

这些集合跨样本累积，因此某字段当前一轮未出现但过去出现过，对应能力仍为 `true`。`full` 只表示统计能力较完整，不表示通话质量良好。

## 11. `performance`：监控器自身开销

| 字段 | 说明 |
| --- | --- |
| `getStatsDurationMs` | 从请求 `pc.getStats()` 到取得结果的耗时。 |
| `parseDurationMs` | 归一化、关联对象、构建报告、更新兼容性和质量诊断的耗时。 |
| `reportCount` | 本轮浏览器原始报告对象总数。 |
| `statsFormat` | 本轮原始报告容器格式，与 `compatibility.statsFormat` 对应。 |

偶发一次耗时升高可能来自页面主线程繁忙；持续接近或超过采样周期时，才需要检查浏览器负载、报告规模和设备性能。采样调用另有超时保护，失败会通过 `stats-error` 报告，通话本身继续。

## 12. 一份报告的实战阅读流程

### 12.1 先判断报告是否可用

1. 看 `phase`、`ready` 和 `sampleDurationMs`。
2. `warming-up` 或大量区间字段为 `null` 时，继续找下一份同通话报告。
3. `transitioning` 时记录 `transition.reason`，避免把正常换轨瞬态当故障。

### 12.2 再判断连接

1. 看 `connectionState/iceConnectionState/dtlsState`。
2. 看 `candidatePairSelection` 是否成功、candidate pair 是否 `succeeded`。
3. 看本地和远端 candidate 类型，确认直连还是 TURN。
4. 看路径是否变化、最后收发包距今多久。

### 12.3 然后逐路看媒体

1. 用 `kind/type/mid/ssrc/rid` 找到用户投诉对应的媒体流。
2. 上行：`outbound` → `source` → 编码输出 → `remoteInbound`。
3. 下行：`inbound` → 网络接收 → jitter buffer → 解码 → 渲染/卡顿。
4. 多路 RTP 不做手工相加后再判丢包；质量模块已经按当前最差一路取值。

### 12.4 最后用质量结论验证

1. 看 `quality.issues[]`，通过 `streamId` 回到具体 RTP。
2. 核对 `evidence` 是否与明细一致。
3. 把 `quality.context` 中的 hold、mute、mode 和 sharedMid 纳入解释。
4. 以用户实际听感和观感为最终依据；报告用于定位原因，不替代端到端体验验证。

## 13. 常见组合案例

### 网络正常但画面差

```text
networkQuality=1/2
qualityLimitationReason=cpu
ENCODER_CPU_LIMITED 或 ENCODER_SLOW
```

说明网络不是主因，优先检查本机 CPU、视频特效、分辨率/FPS 和编码器性能。

### 上行带宽不足导致画质下降

```text
availableOutgoingBitrateBps 持续偏低
qualityLimitationReason=bandwidth
source 规格高于实际编码规格
```

说明浏览器正在主动降级；检查目标码率总和、上行带宽、Simulcast 层和网络拥塞。

### 本端看到远端卡顿

```text
inbound.intervalLossPercent / jitterMs 升高
averageJitterBufferDelayMs 升高
freezeCountDelta 或 droppedFramePercent 增长
```

优先判断下行网络；若网络指标正常而解码耗时接近帧预算，再转向本机解码和渲染性能。

### 日志里质量为 0 但用户投诉

先检查 `ready=false`、`phase=warming-up/transitioning`、RTP 数组为空或关键字段为 `null`。质量数字中的 0 可能代表“暂无数据”，不是“确认无丢包、无时延”。

## 14. 与客户指南和升级说明的边界

- 普通客户如何看 Demo 浮层：[RTCStatsMonitor 通话质量解读指南](./RTCStatsMonitor-statistics-guide.md)
- 内部如何快速阅读普通摘要日志：[RTCStatsMonitor 摘要日志内部培训简洁版](./RTCStatsMonitor-summary-training-guide.md)
- 旧 `getStats` 接入如何迁移：[RTCStatsMonitor 升级说明](./RTCStatsMonitor-upgrade.md)
- 浏览器测试范围和实测边界：[RTCStatsMonitor 浏览器兼容验证](./RTCStatsMonitor-browser-compatibility.md)

本手册解释当前 `lib/RTCStatsMonitor.js` 输出的完整字段和阈值。字段新增、删除或算法调整时，应同步检查 `lib/RTCStatsMonitor.d.ts`、专项测试和本文，避免培训材料与日志实际结构漂移。
