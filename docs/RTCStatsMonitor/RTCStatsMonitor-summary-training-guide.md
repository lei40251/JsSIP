# RTCStatsMonitor 摘要日志内部培训简洁版

本文面向内部研发、测试、技术支持和交付人员，用于快速阅读 SDK 普通日志：

```text
[RTCStatsMonitor] detailed-report: { ... }
```

该日志默认约每 2 秒输出一次，只保留与 Demo 通话浮层接近的状态、链路、上下行媒体、质量和采样性能字段。它不再包含候选 IP、端口、轨道标识、累计字节/包/帧计数和完整关联对象，因此日志量明显低于完整报告。

需要深度排障时，调用 `session.statsMonitor.getLatestReport()` 获取最近一份完整诊断对象，并参考[完整报告内部培训手册](./RTCStatsMonitor-internal-training-guide.md)。

## 1. 摘要结构

```text
detailed-report
├─ compatibility：兼容等级
├─ phase / ready / sampleDurationMs：采样状态
├─ connection：连接状态、总码率、可用带宽和候选路径类型
├─ outbound[]：每路上行音频、视频或共享
├─ inbound[]：每路下行音频、视频或共享
├─ quality：本轮网络/媒体质量和问题代码
└─ performance：getStats 与解析耗时
```

## 2. 30 秒阅读顺序

1. 看 `phase` 和 `ready`：`active + true` 才是已经建立统计基线的稳定样本。
2. 看 `connection`：连接、ICE、DTLS 是否为正常状态，收发码率是否持续大于 0。
3. 看 `outbound[]`：本端实际是否在发送，以及对端反馈的丢包、抖动和 RTT。
4. 看 `inbound[]`：本端实际是否收到，视频 FPS、尺寸、解码耗时和丢帧是否异常。
5. 看 `quality`：质量等级、当前最差丢包和 `issues` 问题代码。
6. 最后看 `performance`：排除浏览器 `getStats()` 本身过慢。

## 3. 顶层状态

| 字段 | 含义 |
| --- | --- |
| `compatibility.level` | `full` 最完整；`partial` 缺少部分高级指标；`legacy-basic` 为旧格式；`unsupported` 表示不可用 |
| `phase` | `warming-up` 预热、`transitioning` 媒体变化、`active` 稳定、`reconnecting` 重连、`stopped` 停止 |
| `ready` | 是否已有至少一条 RTP 流可以计算区间码率 |
| `sampleDurationMs` | 本轮与上一有效样本的实际间隔，默认通常约 2000ms |

首次采样或换轨后的部分区间字段为 `null` 是正常现象，应等待下一到两个样本，不要把 `null` 当成 0。

## 4. 连接摘要 `connection`

| 字段 | 快速判断 |
| --- | --- |
| `connectionState` | 正常通话通常为 `connected` |
| `iceConnectionState` | 正常通常为 `connected` 或 `completed` |
| `dtlsState` | 正常通常为 `connected` |
| `rttMs` | 当前 candidate-pair RTT，仅作连接链路参考 |
| `sendBitrateBps` / `receiveBitrateBps` | 整条连接当前实际收发码率，单位 bit/s |
| `availableOutgoingBitrateBps` / `availableIncomingBitrateBps` | 浏览器估算的可用上下行带宽 |
| `candidatePath` | 只保留候选类型和协议，不记录 IP、端口或 TURN 地址 |

`quality.RTT` 更接近用户感受：优先采用当前媒体 RTP 反馈 RTT，缺失时才回退 `connection.rttMs`。

## 5. 上行摘要 `outbound[]`

每个数组元素代表一路实际发送的 RTP，音频、摄像头视频、屏幕共享和多编码层不会互相合并。

| 字段 | 含义 |
| --- | --- |
| `type` / `mid` / `codec` | 媒体类型、协商 MID 和编码格式 |
| `actualBitrateBps` | 本端当前实际发送码率 |
| `lossPercent` | 对端反馈的当前上行丢包率 |
| `jitterMs` / `rttMs` | 对端反馈的抖动和媒体 RTT |
| `framesPerSecond` | 视频实际发送 FPS；音频通常为 `null` |
| `frameWidth` / `frameHeight` | 视频实际发送尺寸 |
| `averageEncodeTimeMs` | 当前区间平均单帧编码耗时 |
| `qualityLimitationReason` | 常见为 `none`、`bandwidth`、`cpu` 或 `other` |

实际发送码率持续为 0 或 `null` 时，先确认 `phase` 是否稳定，再检查 mute、hold、轨道状态和远端是否完成协商。

## 6. 下行摘要 `inbound[]`

| 字段 | 含义 |
| --- | --- |
| `type` / `mid` / `codec` | 媒体类型、协商 MID 和编码格式 |
| `receiveBitrateBps` | 本端当前实际接收码率 |
| `lossPercent` / `jitterMs` | 当前下行丢包率和抖动 |
| `averageJitterBufferDelayMs` | 当前区间平均抖动缓冲延迟 |
| `framesPerSecond` | 视频实际接收 FPS |
| `frameWidth` / `frameHeight` | 视频实际接收尺寸 |
| `averageDecodeTimeMs` | 当前区间平均单帧解码耗时 |
| `droppedFramePercent` | 当前区间视频丢帧比例 |

接收码率为 0 时，先区分“远端没有发送”和“本端网络/解码异常”：结合远端日志、信令状态、丢包、FPS 和 `issues` 判断。

## 7. 质量摘要 `quality`

| 字段 | 含义 |
| --- | --- |
| `RTT` | 当前最接近用户体验的 RTT，单位 ms |
| `uplinkLoss` / `downlinkLoss` | 本轮所有对应 RTP 流中的最差丢包率，不做多样本平均 |
| `uplinkNetworkQuality` / `downlinkNetworkQuality` | 上下行网络等级，0 表示无数据，1 最好，6 最差 |
| `uplinkMediaQuality` / `downlinkMediaQuality` | 综合编码、解码、卡顿等媒体问题后的等级 |
| `issues[]` | 只保留 `code` 和 `severity`，用于快速定位问题类型和严重程度 |

网络等级正常但媒体等级差，通常表示 CPU、编码器、解码器或渲染问题，不要只查网络。

## 8. 采样性能 `performance`

| 字段 | 含义 |
| --- | --- |
| `getStatsDurationMs` | 浏览器完成一次 `getStats()` 的耗时 |
| `parseDurationMs` | SDK 归一化和计算报告的耗时 |
| `reportCount` | 本轮浏览器统计对象数量 |
| `statsFormat` | `standard`、`object` 或旧格式标识 |

性能耗时偶发升高不一定影响媒体；只有持续升高并伴随页面卡顿、采样超时或统计断档时才需要专项排查。

## 9. 常见现象速查

| 用户现象 | 优先查看 |
| --- | --- |
| 有画面但模糊 | 上行视频码率、可用上行带宽、发送尺寸、`qualityLimitationReason` |
| 视频卡顿 | 下行 FPS、丢包、抖动缓冲、解码耗时、丢帧、`issues` |
| 音频断续或机器人音 | 音频上下行丢包、抖动、RTT、网络等级 |
| 有信令但无媒体 | ICE/DTLS、对应 RTP 是否存在、实际收发码率、远端是否发送 |
| 切换设备后短暂异常 | 先确认 `phase=transitioning`，等待新统计基线建立 |

普通日志足够用于快速定位方向；需要候选地址、累计计数器、NACK/PLI/FIR、FEC、冻结时长或关联 ID 等证据时，再读取完整报告。
