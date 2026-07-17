# 7. 旧版功能升级指南

[← 上一章：SDK API 参考](./06-api-reference.md) · [学习目录](./README.md) · [下一章：Base JS Demo →](./08-demo-guide.md)

本章用于把已有项目中的虚拟背景、旧版 `Mixer` 混流和通话统计升级到当前接入方式。建议按“搜索旧入口 → 修改呼叫/接听参数 → 修改通话中控制 → 修改事件 → 删除旧接入代码 → 验证”的顺序逐项完成。

## 7.1 升级前先做调用清单

在项目中搜索以下关键词：

```text
new CRTC.getStats
new CRTC.Mixer
appendStream
removeStream
clearStreams
getMixedStream
getVideoStream
aiVirtualBackground
aiVB
getAiVBEngine
```

对每个命中位置标记它属于哪条路径：

| 路径 | 必须检查的入口 |
| --- | --- |
| 呼出 | `ua.call(target, options)` |
| 音频呼入接听 | `session.answer({ mediaConstraints: { audio: true, video: false } })` |
| 视频呼入接听 | `session.answer({ mediaConstraints: { audio: true, video: ... } })` |
| 音频升级视频 | `session.upgradeToVideo(options, done)` |
| 通话中设备/效果更新 | `switchDevice()`、composer、虚拟背景控制器 |
| 结束和失败 | `ended`、`failed` |

同一能力只改呼出、不改接听，是升级后最常见的不一致来源。

## 7.2 虚拟背景升级

### 7.2.1 初始参数位置变化

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

### 7.2.2 通话中方法变化

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

### 7.2.3 模式与参数迁移

| `mode` | 必要参数 | 说明 |
| --- | --- | --- |
| `none` | 无 | 不使用背景替换 |
| `blur` | `blurRadius` 可选 | 模糊真实背景 |
| `image` | `imageUrl` 必填 | 使用图片背景；图片需允许跨域访问 |
| `color` | `color` 必填 | 使用 CSS 颜色字符串 |

升级后首次验证应分别覆盖模糊、图片、清除和挂断重呼。图片模式还需验证资源 URL、CORS 和 HTTPS。

## 7.3 混流升级

早期版本通过 `Mixer.js` 提供 `CRTC.Mixer`，由页面创建混流实例、添加输入流并获取混流结果。升级时应迁移到 `MediaEffectsComposer`，普通通话优先使用 `RTCSession` 的集成方式。

### 7.3.1 旧 Mixer 方法迁移

| 早期 `CRTC.Mixer` 写法 | 当前写法 | 迁移说明 |
| --- | --- | --- |
| `new CRTC.Mixer(streams, options)` | 在呼叫或接听参数中配置 `mediaEffectsComposer` | 普通通话由会话使用该配置 |
| `mixer.appendStream(stream, options)` | `composer.addSource(stream, options)` | 添加或替换指定 slot 的视频源 |
| `mixer.removeStream(streamOrId)` | `composer.removeSource(streamOrId)` | 移除一路视频源 |
| `mixer.clearStreams()` | `composer.clearSources()` | 清空全部输入源 |
| `mixer.getMixedStream()` / `getVideoStream()` | 普通通话无需由页面获取输出流 | 继续通过当前 `RTCSession` 控制通话媒体 |
| `mixer.setGlobalMirror()` / `setOutputMirror()` | `composer.setMirror(enabled)` | 设置合成输出镜像 |
| `mixer.setWatermarks(items)` | `composer.setWatermarks(items)` | 更新水印 |
| `mixer.stop()` | 结束使用后停止旧实例 | 完成迁移后删除旧 Mixer 实例及其清理代码 |

### 7.3.2 从旧 Mixer 实例迁移到会话集成

旧项目可能自行创建 `CRTC.Mixer`、获取混流输出，再把输出轨道用于通话。普通通话升级后，优先把混流配置交给 `ua.call()` / `session.answer()`：

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

呼入接听使用相同的 `mediaEffectsComposer` 配置：

```js
session.answer(options);
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

迁移后需要注意：

- 删除页面中创建、保存和停止旧 `CRTC.Mixer` 实例的代码。
- 删除页面中获取旧混流输出并用于通话的代码。
- 设备切换、共享、音视频模式变化和会话结束继续通过当前 `RTCSession` 操作。
- `width/height/fps` 等初始化参数不要在已有通话中强行改变；下一通呼叫重新配置。
- 通话结束后不要继续调用旧 composer 引用。

## 7.4 RTCStatsMonitor 升级概览

统计升级重点是接入入口、事件、字段单位、空值语义和页面展示。

| 项目 | 旧统计 | 当前统计 |
| --- | --- | --- |
| 会话入口 | 页面在 `confirmed` 后创建统计实例 | 页面直接监听当前 `session` 的统计事件 |
| 事件位置 | 独立实例的 `report` / `network-quality` | 会话的 `stats:report` / `stats:network-quality`，并新增详细和错误事件 |
| 页面清理 | 页面保存并停止会话统计实例 | 页面只清理本次通话的展示数据和状态 |
| 丢包/RTT | 缺少数据时可能仍输出数值 | 缺少有效样本时通过质量等级 `0` 表达暂无数据 |
| 网络质量 | 基础等级 | 继续使用 `0～6`，其中 `0` 表示暂无有效样本 |
| 诊断 | RTT、丢包、码率等基础字段 | 新增详细摘要和问题码，便于页面提示与排障 |

## 7.5 会话统计入口迁移

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

## 7.6 网络质量等级的行为变化

这是统计升级中最需要重新确认页面文案和告警逻辑的部分。

### 等级 0

当前 `0` 明确表示“暂无有效样本”，包括：没有该方向媒体、通话刚开始、浏览器没有提供丢包和 RTT、媒体刚切换尚未稳定。`0` 不表示比 `1` 更好。

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

### 等级 1～6

`1` 表示质量最好，等级越高表示体验越差，`6` 表示严重异常。页面应直接使用 SDK 输出等级，不要在业务代码中重新计算等级。告警建议结合连续多次结果、连接状态和用户实际体验，不要因单次 `4～6` 自动挂断。

### 空值与 0 的区别

- `stats:detailed-report` 中浏览器未提供的连接、流指标为 `null`。
- 兼容 `stats:network-quality` 为保持数字字段，在 RTT/丢包缺失时可能输出 `0`。
- 是否有有效网络样本，应看 `uplinkNetworkQuality/downlinkNetworkQuality` 是否为 `0`。

完整字段和问题码见 [通话质量统计](./05-call-statistics.md)。

## 7.7 `report` 数据单位变化注意

兼容 `stats:report` 保留 `speed` 作为 kbps 展示值。新的 `stats:detailed-report` 使用：

- `actualBitrateBps`
- `receiveBitrateBps`
- `sendBitrateBps`
- `availableOutgoingBitrateBps`

这些字段单位全部是 `bps`。迁移页面时必须除以 `1000` 后显示 kbps，不能直接拼接 `kbps`，也不要重复除以 `1024`。

## 7.8 统计代码清理

切换为 `session` 的统计事件后，删除页面中专门为会话统计创建、保存和停止独立实例的代码。`failed`、`ended` 事件中只需清理当前通话的页面状态和统计展示数据。

如果业务确实需要监控一个不属于 `RTCSession` 的独立 `RTCPeerConnection`，仍可创建 `RTCStatsMonitor`，并在不再使用该连接时调用 `monitor.stop()`。

## 7.9 推荐的分阶段迁移

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

按第 5 章展示连接、媒体流、质量和问题码。

### 阶段三：删除旧资源管理

删除页面中自行创建、保存和停止会话统计实例的代码，仅保留 `session` 统计事件及页面展示逻辑。

## 7.10 完整升级验证矩阵

| 功能 | 必测场景 | 通过标准 |
| --- | --- | --- |
| 注册 | 自动注册、手动注册、密码错误、断网恢复 | 事件顺序和按钮状态正确 |
| 基础呼叫 | 音频呼出/呼入、视频呼出/呼入、拒接、取消、双方挂断 | `failed/ended` 后状态清理完整 |
| 虚拟背景 | 模糊、图片、清除、挂断重呼 | 当前通话立即变化，重呼无旧状态 |
| 混流 | 旧 Mixer 迁移、会话集成、镜像、水印、第二路源 | 不再依赖旧 Mixer，slot 和输出效果正确 |
| 初始统计 | 呼叫刚开始 | 质量 `0` 显示检测中，不显示良好 |
| 弱网 | 使用可控网络环境观察质量下降 | 等级、问题码和页面文案一致 |
| 连接失败 | ICE/PC `failed` | 上下行等级 `6`，出现连接问题提示 |
| 媒体变化 | 切设备、共享、音视频升级/降级 | 短暂过渡后恢复，不残留旧 RTP |
| 重呼 | 挂断后再次呼叫 | 不复用旧 session、控制器或统计数据 |

## 7.11 升级完成清单

- 呼出、所有接听按钮和 `upgradeToVideo()` 都使用一致的媒体参数。
- 虚拟背景位于 `mediaEffectsComposer.sources[0]`。
- 通话内控制器从当前 `RTCSession` 获取，不跨通话缓存。
- 旧 `CRTC.Mixer` 已迁移到当前 `mediaEffectsComposer` 接入方式。
- 普通通话不再由页面自行获取混流输出并用于通话。
- 统计改为监听 `session` 的 `stats:*` 事件。
- 页面已明确区分质量等级 `0`、数值 `0` 和字段 `null`。
- 页面已适配等级 `6` 的严重异常语义。
- 已删除页面自行创建、保存和停止会话统计实例的代码。
- 独立 PeerConnection 统计仍在不用时调用 `stop()`。
- 已完成自动/手动注册、呼入/呼出、媒体效果、弱网、设备切换、共享、挂断和重呼验证。

[← 上一章：SDK API 参考](./06-api-reference.md) · [下一章：Base JS Demo →](./08-demo-guide.md)
