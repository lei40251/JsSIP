# RTCStatsMonitor 浏览器兼容验证

验证日期：2026-07-14

本文记录当前实现已经完成的自动化和实测范围，不是所有浏览器版本的承诺支持矩阵。`full/partial/legacy-basic/unsupported` 表示统计字段能力，不表示通话质量等级。

相关文档：

- 客户统计判读：[RTCStatsMonitor 通话质量解读指南](./RTCStatsMonitor-statistics-guide.md)
- 完整兼容字段解释：[RTCStatsMonitor 完整报告内部培训手册](./RTCStatsMonitor-internal-training-guide.md)
- 旧接入迁移：[RTCStatsMonitor 升级说明](./RTCStatsMonitor-upgrade.md)

## 1. 自动化覆盖

| 能力 | 结果 |
| --- | --- |
| 标准 Promise getStats + RTCStatsReport | 通过 |
| 两种历史 callback 参数顺序及误导性函数 length | 通过 |
| legacy result/stat 报告格式 | 通过 |
| full / partial / legacy-basic / unsupported 自动降级 | 通过 |
| report / network-quality / detailed-report 同轮质量快照 | 通过 |
| RTCSession 自动启动、事件转发、过渡保护和停止释放 | 通过 |
| 缺字段、计数器回退、采样超时、停止后立即重启 | 通过 |

上述项目由 `test/test-rtc-stats-monitor.js` 覆盖，共 17 个测试。

## 2. 实际浏览器回环测试

测试页：`test/browser/rtc-stats-monitor-compat.html`

测试页使用 canvas 生成本地视频轨，建立两个 RTCPeerConnection 的真实回环连接，再通过构建后的 `dist/CRTC.js` 连续采样。

| 环境 | 结果 | 兼容等级 | 说明 |
| --- | --- | --- | --- |
| Windows Chromium 150，桌面视口 | 通过 | full | 标准报告、RTP、candidate-pair、remote-inbound-rtp 均已读取 |
| Windows Chromium 150，390×844 移动尺寸 | 通过 | full | 回环、事件一致性和数字质量等级通过；仍是桌面 Chromium 内核 |

两次实测均确认：完整报告进入 `active`、存在上行 RTP、质量等级在 0～6 范围内，三个事件的重叠质量字段一致。

390×844 仅验证页面在移动尺寸下运行同一 Chromium 统计链路，不代表 Android Chrome、Android WebView 或移动设备硬件已经实测。

## 3. 目标平台矩阵

| 平台 | 当前结论 |
| --- | --- |
| Chrome / Chromium PC | 已实测通过 |
| Edge PC | 与 Chromium 标准路径相同，当前环境未单独启动 Edge 实测 |
| Firefox PC | 已覆盖标准字段缺失时的 partial 降级，待 Firefox 实机回环 |
| Safari macOS | 已覆盖字段缺失和旧 API 降级，Windows 环境无法执行 Safari 实测 |
| Android Chrome / Android WebView | 已覆盖移动尺寸和 WebView 常见 callback/静默超时路径，待 Android 真机 |
| iOS Safari / 微信浏览器 | 已覆盖 partial/unsupported 安全降级，待 iOS 真机 |
| 鸿蒙浏览器 | 已覆盖 partial/legacy-basic/unsupported 安全降级，待鸿蒙真机 |

这里的“覆盖”表示代码路径和降级行为已有自动化测试，不等同于对应设备实测。发布前应在目标最低浏览器版本和真实通话网络下执行同一测试页，并记录浏览器版本、兼容等级、`observedStatsTypes` 和 `observedFeatures`。

## 4. 结论

当前实现不会基于 User-Agent 硬编码等级，而是按实际 API、报告格式和字段自动选择 `full`、`partial`、`legacy-basic` 或 `unsupported`。浏览器缺少高级字段时保留基础统计；`getStats()` 不可用、返回异常或静默超时时通过 `stats-error` 报告，统计失败不影响通话流程。
