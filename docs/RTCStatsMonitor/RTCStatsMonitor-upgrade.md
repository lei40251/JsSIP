# RTCStatsMonitor 升级说明

本文面向从旧 `Stats/getStats` 接入迁移到 `RTCStatsMonitor` 的开发者。

相关文档：

- 普通客户判读 Demo 统计：[RTCStatsMonitor 通话质量解读指南](./RTCStatsMonitor-statistics-guide.md)
- 内部逐字段分析完整日志：[RTCStatsMonitor 完整报告内部培训手册](./RTCStatsMonitor-internal-training-guide.md)
- 浏览器实测范围：[RTCStatsMonitor 浏览器兼容验证](./RTCStatsMonitor-browser-compatibility.md)

## 1. 升级目标

SDK 已使用 **RTCStatsMonitor** 直接替换旧的 **Stats** 统计模块，统一网络质量、媒体质量和 WebRTC 链路诊断逻辑，避免两套统计实现产生不同结果。

旧文件 **lib/Stats.js** 已删除。SDK 继续保留 **CRTC.getStats** 公开名称，但它与 **CRTC.RTCStatsMonitor** 现在指向同一个构造函数：

~~~js
CRTC.getStats === CRTC.RTCStatsMonitor;
~~~

因此，只使用 **new CRTC.getStats(pc)** 和 **report**、**network-quality** 事件的接入代码可以继续工作；使用旧构造参数或旧控制方法的代码需要按本文调整。

## 2. 公开入口

以下两种写法完全等价：

~~~js
const stats = new CRTC.getStats(pc);
~~~

~~~js
const stats = new CRTC.RTCStatsMonitor(pc);
~~~

新项目推荐使用语义更明确的 **RTCStatsMonitor**：

~~~js
const stats = new CRTC.RTCStatsMonitor(pc, {
  sampleIntervalMs           : 2000,
  reportIntervalMs     : 2000,
  bgIntervalMs : 2000
});
~~~

默认在构造完成后立即启动。PC 尚未产生 RTP 数据时，模块会先进入 **warming-up** 阶段，不需要等待 ICE、DTLS 或媒体轨道完全就绪后再创建。

## 3. 构造参数变化

旧模块使用位置参数：

~~~js
new CRTC.getStats(pc, delay, interval);
~~~

新模块统一使用配置对象：

~~~js
new CRTC.getStats(pc, {
  sampleIntervalMs           : 2000,
  reportIntervalMs     : 2000,
  bgIntervalMs : 2000,
  transitionSamples     : 2,
  timeoutMs          : 5000,
  detailedReport       : true,
  rawStatsLog          : true
});
~~~

旧的 **delay**、**interval** 数字参数不再自动转换。只传入 **pc** 的旧代码不受影响。

主要配置含义：

| 配置项 | 默认值 | 说明 |
| --- | ---: | --- |
| sampleIntervalMs | 2000 | 前台基础采样间隔，最小 500ms |
| reportIntervalMs | 2000 | report 和 network-quality 输出间隔 |
| bgIntervalMs | 2000 | 页面进入后台后的采样间隔 |
| transitionSamples | 2 | 媒体变化后暂缓瞬时质量告警的样本数 |
| timeoutMs | 5000 | 单次 getStats() 超时时间，最小 100ms |
| detailedReport | true | 是否输出完整 `detailed-report:` 日志并发送同轮摘要事件 |
| rawStatsLog | true | 是否每 10 秒限频记录一份脱敏后的浏览器原始 `getStats()` 报告；可显式设为 `false` 关闭 |

## 4. 事件兼容与新增事件

### 4.1 保留事件

以下事件名称和 payload 结构保持兼容：

- **report**
- **network-quality**

~~~js
stats.on('report', function(report)
{
  console.log(report.RTT, report.upStreams, report.downStreams);
});

stats.on('network-quality', function(quality)
{
  console.log(
    quality.RTT,
    quality.uplinkLoss,
    quality.downlinkLoss,
    quality.uplinkNetworkQuality,
    quality.downlinkNetworkQuality
  );
});
~~~

三个报告中的重叠字段使用同一次采样生成的质量快照：

- report.RTT
- network-quality.RTT
- detailed-report.quality.RTT
- 上下行丢包率
- 上下行网络质量等级

**getReport().connection.rttMs** 表示 candidate-pair RTT；**detailed-report.quality.RTT** 优先使用当前媒体 RTP 反馈 RTT，缺失时再回退 candidate-pair RTT。丢包率同样使用当前样本中的最大值，不做多样本平均。

### 4.2 新增事件

**detailed-report** 事件只提供 Demo 和常规监控需要的连接、上下行流和质量摘要。启用 `detailedReport` 时，同一轮完整诊断报告会以 **detailed-report:** 写入 SDK logger；无论是否启用事件和日志，都可以通过 **getReport()** 读取最近一份完整报告：

~~~js
stats.on('detailed-report', function(report)
{
  console.log(report.connection);
  console.log(report.outbound);
  console.log(report.inbound);
  console.log(report.quality);
});

const fullReport = stats.getReport();

if (fullReport)
{
  console.log(fullReport.sources, fullReport.remoteInbound, fullReport.compatibility);
}
~~~

**stats-error** 用于报告采样、解析或自定义分类失败：

~~~js
stats.on('stats-error', function(error)
{
  console.warn(error.code, error.message, error.fatal);
});
~~~

非致命错误会在后续采样周期继续重试。异常浏览器或 WebView 的 **getStats()** 如果静默不返回，会在 **timeoutMs** 后释放采样锁并发送错误事件。

### 4.3 完整报告与自动诊断

TypeScript 中 **DetailedReportEvent** 对应事件摘要，**DetailedReport** 对应 logger 和 **getReport()** 使用的完整报告。连接、候选地址、媒体源、编解码器、上下行 RTP、远端反馈、质量问题和性能数据均有明确类型。质量等级统一为数字：**0 表示暂无有效样本，1 最佳，6 最差**。

自动诊断除丢包、RTT、抖动和卡顿外，还会结合发送队列、重传比例、编解码耗时、抖动缓冲、FEC、发送丢弃、可用带宽、传输停滞和 ICE 路径变化生成 issues。缺字段不会当作 0，也不会只凭低码率直接判定故障。

完整日志的每个字段、单位、计算口径、问题阈值和 evidence 见 [RTCStatsMonitor 完整报告内部培训手册](./RTCStatsMonitor-internal-training-guide.md)。

## 5. 生命周期变化

### 5.1 reset() 不再停止采样

新模块中的 **reset()** 会：

- 保持监控运行；
- 清空旧计数器基线；
- 重新建立码率、丢包率等增量指标；
- 进入短暂的媒体过渡保护阶段。

~~~js
stats.reset();
~~~

需要停止统计时必须显式调用：

~~~js
stats.stop();
~~~

停止后可以重新启动：

~~~js
stats.start();
~~~

### 5.2 不再使用全局停止标记

旧模块使用过以下全局变量：

~~~js
window.CRTCStats = 'stop';
~~~

新模块不读取该变量。RTCSession 在创建 PeerConnection 后自动创建并启动统计实例，在会话关闭时自动调用 **stop()** 并释放引用。

### 5.3 setMode() 已删除

旧模块的 **setMode('audio')** 只用于过滤兼容报告中的摄像头视频数据，并不会实际修改媒体轨道或 SDP。

新模块根据当前 sender、receiver、transceiver、track 和 RTP 报告自动识别实际媒体类型，不再需要 **setMode()**。

发生音视频模式切换、换轨、设备切换或重协商时，可以通知模块进入过渡保护期：

~~~js
stats.markChange('session-mode-changed');
~~~

**markChange()** 不会停止采样，也不会强制指定媒体类型。

## 6. RTCSession 自动接入

~~~js
session.on('stats:report', handleLegacyReport);
session.on('stats:network-quality', handleNetworkQuality);
session.on('stats:detailed-report', handleDetailedReport);
session.on('stats:stats-error', handleStatsError);

// PC 创建后可读取实例；会话关闭后为 null。
const stats = session.statsMonitor;
~~~

RTCSession 会在设备切换、共享开始/停止、音视频模式变化和重协商时自动调用 **markChange()**。接入方通常不需要手动管理统计生命周期；单独监控其他 PeerConnection 时仍可直接构造 **RTCStatsMonitor**。

## 7. 浏览器兼容降级

模块根据实际 **getStats()** API 形式、报告类型和可用字段自动确定兼容等级：

| 等级 | 含义 |
| --- | --- |
| full | 标准报告及主要链路字段完整 |
| partial | 可以采样，但部分高级字段缺失 |
| legacy-basic | 使用旧 callback 或 legacy stats 报告，只提供基础指标 |
| unsupported | 当前环境无法使用 getStats() |

降级过程自动完成。缺失字段保持为 **null** 或安全默认值，不会因为某个高级指标不可用而阻断通话。

## 8. Demo

**demo/base-js/** 已展示：

- 直接监听 RTCSession 转发的 **stats:detailed-report** 和 **stats:stats-error**；
- 使用摘要事件展示页面统计信息；
- 会话结束或失败后清空统计界面；
- 统计实例的创建、启动和释放全部由 RTCSession 管理。

**samples/base-js-mh/** 中原有的 **setMode()** 调用已改为 **markChange('session-mode-changed')**。

## 9. 验证结果

本次升级已完成以下验证：

- RTCStatsMonitor 专项测试：16 个通过，0 个失败；
- SDK 基础、解析、属性和认证测试通过；
- MediaEffectsComposer、AiNS、虚拟背景、设备切换、SDP 和运行时更新测试通过；
- BFCP 测试通过；
- 完整 **npm run build** 构建通过；
- lint 和差异格式检查通过；
- dist 构建产物已更新。

浏览器实测与目标平台矩阵见 [RTCStatsMonitor 浏览器兼容验证](./RTCStatsMonitor-browser-compatibility.md)。
