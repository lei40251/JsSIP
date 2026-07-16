# 02 `RTCPeerConnection` 使用分析

> 本文沿一条主线说明 `RTCPeerConnection` 在 Adapter、能力检测和正式业务中的不同职责。完整调用点、事件和方法邻接关系见附录 A—D。

## 1. 本章结论

`trtc.deobfuscated.js` 中的 `RTCPeerConnection` 不能只按搜索结果理解。源码里的相关代码实际分成三种性质不同的使用：

1. **Adapter**：修改浏览器原生 API，让 Chrome、Firefox 和 Safari 暴露更一致的行为。
2. **能力检测**：临时创建 PC，通过 Offer 或本地双 PC 回环验证编码、解码和 Transceiver 能力。
3. **正式业务**：使用 MPC 或 SPC 两套拓扑承载发布、订阅、换轨、统计和重连。

正式业务的核心区别是：

| 维度 | MPC | SPC |
|---|---|---|
| PC 所有者 | 每个 `iJ` 派生连接实例独占一个 PC | 房间级 `SignalTransport` 独占一个共享 PC |
| 上行/下行 | `dJ` 上行、每个 `aJ` 负责一个远端用户下行 | `UplinkTransport`、`DownlinkTransport` 只是共享 PC 的业务视图 |
| 首次 SDP | Offer 通过 WebSocket 的 publish/subscribe RPC 换取 Answer | 浏览器生成 Offer，客户端根据服务端 ability 在本地合成 Answer |
| 重连粒度 | 单个上行或单个远端用户连接分别重建 | 整个共享 PC 执行 `rebuild_pc` |
| 失败降级 | 继续使用各自 PC | SPC 初始化失败时可整体降级到 MPC |

因此，“进房成功”“WebSocket 已连接”和“媒体 PC 已 connected”是三个不同完成点，不能合并成一个“连接成功”。

## 2. 三类代码必须先分开

| 类型 | 主要源码范围 | 是否承载正式媒体 | 阅读重点 |
|---|---:|---|---|
| 浏览器 Adapter | L6643—L9580 | 间接承载 | 原生构造器、方法、事件和返回值被怎样统一 |
| 能力检测 | L15760—L16340、L45352—L45455 | 否 | 临时 PC 回答了什么能力问题，是否正确释放 |
| 正式 MPC/SPC | MPC L37350—L40710；SPC L45320—L49420 | 是 | 对象所有权、SDP、状态、重连和释放 |

这一区分可以避免两个常见误判：

- Adapter 中定义了 `addIceCandidate()` 兼容，不等于正式业务使用独立 Candidate 信令。
- H.264 回环检测中两个 PC 互相 `addIceCandidate()`，也不等于 MPC/SPC 采用 trickle ICE。

当前文件可以直接确认：正式 MPC/SPC 没有形成 `onicecandidate → WebSocket → addIceCandidate` 的业务调用链；实际业务主要交换完整的 SDP 描述。

## 3. 构造参数从哪里来

MPC 在 `iJ.initialize()`（L37435 附近）创建 PC；SPC 在 `SignalTransport.initialize()`（L46194 附近）创建 PC。

| 配置字段 | MPC | SPC | 实际来源或用途 |
|---|---|---|---|
| `iceServers` | `room.getIceServers()` | `initialize(iceServers)` 参数 | 调度结果、join 结果或显式 fallback |
| `iceTransportPolicy` | `room.getIceTransportPolicy()` | 同 MPC | `forceRelay` 时为 `relay`，否则按配置或默认 `all` |
| `sdpSemantics` | `room.sdpSemantics` | 同 MPC | 由 Unified Plan 能力和创建参数共同决定 |
| `bundlePolicy` | `max-bundle` | `max-bundle` | 尽量共享 ICE/DTLS transport |
| `rtcpMuxPolicy` | `require` | `require` | RTP 与 RTCP 复用 |
| `tcpCandidatePolicy` | `disable` | `disable` | 非标准扩展，不能当成通用 WebRTC 写法 |
| `IceTransportsType` | `nohost` | `nohost` | 私有或非标准字段，不能直接移植 |
| `encodedInsertableStreams` | 无 | 按能力开关 | 旧 Insertable Streams 必须在构造阶段开启 |
| `offerExtmapAllowMixed` | 无 | `true` | SPC 的扩展映射协商选项 |

`TRTCRoom.getIceServers()`（L51176 附近）的实际优先级是：

```text
room._turnServers
  > scheduleResult.iceServers
  > 方法显式 fallback
  > JOIN_ROOM_RESULT 中保存的 iceServers
  > []
```

SPC 可能在 join-result 返回前先以空 ICE Server 数组创建 PC；join 成功后再通过 `pc.setConfiguration()` 更新。源码没有使用 `pc.restartIce()` 或 `createOffer({iceRestart:true})`。

## 4. Adapter：业务调用前原生 API 已被修改

业务代码虽然写的是标准 `new RTCPeerConnection()`、`getStats()` 和 `setRemoteDescription()`，旧浏览器运行时可能已经进入 Adapter 包装。

| 浏览器或公共层 | 主要修补内容 | 对正式业务的影响 |
|---|---|---|
| Chrome | `ontrack`、`getSenders/getReceivers`、旧回调式 `getStats`、`addStream/addTrack`、描述和 Candidate 参数对象 | 业务可以统一使用 Promise、sender/receiver 和 track 事件 |
| Firefox | 回调/Promise 统一、sender/receiver stats、`removeStream`、`addTransceiver(sendEncodings)`、Offer/Answer 等待参数生效 | 创建 Offer 前可能先等待 `sender.setParameters()` |
| Safari | 本地/远端 stream API、`onaddstream`、旧回调接口、IceServer `url→urls`、legacy Offer 参数 | 旧 Safari 的 stream 和 track 行为被包装成接近标准接口 |
| 公共 Shim | Candidate 标准字段、SCTP `maxMessageSize`、DataChannel 消息大小、`connectionState`、空 Candidate、无参 `setLocalDescription` | 正式业务读取到的状态和错误可能来自兼容层派生 |

Adapter 只负责统一浏览器行为，不决定 SDK 的发布、订阅和重连策略。完整 Shim 函数和出现行号应放入附录，而不是打断本章主线。

## 5. 能力检测：临时 PC 不属于正式通话

源码使用临时 PC 做四类探测：

| 探测 | 关键调用 | 它真正证明的内容 | 释放情况 |
|---|---|---|---|
| 编码能力 | canvas `captureStream(0)` → `addTrack()` → `createOffer()` | 发送 Offer 是否声明 H.264、VP8、H.265 | 正常路径 `pc.close()`；异常分支缺少统一 `finally` |
| 解码能力 | `addTransceiver('video',{direction:'recvonly'})` → `createOffer()` | 接收 m-line 是否声明对应 codec | 正常路径关闭 |
| Android Chrome H.264 回环 | 两个本地 PC 交换 Candidate 和 SDP，轮询 sender/receiver Stats | H.264 是否真的有字节收发，而不只是 SDP 声明支持 | cleanup 停轨并关闭两个 PC |
| SPC Transceiver 能力 | 检查类、原型、`currentDirection`，再实际 `addTransceiver('audio')` | Unified Plan/Transceiver 是否能真实调用 | 检测后关闭 |

这里必须区分两个层次：

- `createOffer()` 中出现 codec，只能证明浏览器愿意宣告该能力。
- 双 PC 回环观察到 `bytesSent/bytesReceived > 0`，才证明该浏览器组合下有实际传输。

## 6. 正式业务的对象所有权

## 6.1 MPC：每个连接实例独占 PC

`iJ` 是 MPC 公共基类，`aJ` 下行和 `dJ` 上行继承它。

```text
TRTCRoom
  ├─ dJ uplink
  │    └─ RTCPeerConnection
  ├─ aJ remote-user-A
  │    └─ RTCPeerConnection
  └─ aJ remote-user-B
       └─ RTCPeerConnection
```

`iJ` 负责：

- 创建和关闭 PC。
- 把原生连接状态映射到 SDK 状态。
- 等待 connected、处理超时和离房取消。
- 通过 `getStats()` 记录选中的 Candidate Pair。
- 在 `failed/closed` 时启动由子类实现的重连。

## 6.2 SPC：房间级对象独占一个共享 PC

```text
TRTCRoom
  └─ SignalTransport
       ├─ RTCPeerConnection
       ├─ UplinkTransport 业务视图
       ├─ DownlinkTransport(user A) 业务视图
       └─ DownlinkTransport(user B) 业务视图
```

`UplinkTransport` 和 `DownlinkTransport` 不拥有 PC，因此关闭某个视图不能直接关闭共享 PC。共享 PC 的重建和最终销毁都由 `SignalTransport` 负责。

## 7. 初始化不等于媒体已经连通

## 7.1 MPC 初始化

`iJ.initialize()`：

```text
读取 Room 配置
  → new RTCPeerConnection(config)
  → 绑定 onconnectionstatechange
  → 上行或下行子类继续绑定自己的事件
```

此时 PC 仍未完成 SDP 交换。首次发布或订阅才会进入 `createOffer → setLocalDescription → WebSocket RPC → setRemoteDescription`。

## 7.2 SPC 初始化

`SignalTransport.initialize()`：

```text
new RTCPeerConnection(config)
  → 绑定 ICE、signaling、connection、track 事件
  → 预建 1 个 audio + 3 个 video 的 sendonly transceiver
  → createOffer()
  → 保存 originOffer
  → 从 Offer 推导 clientAbility
```

这里没有设置完整的本地/远端描述，也没有等待 connected。它得到的是“原始 Offer 和客户端能力”，不是已经连通的媒体连接。

## 8. 进房与首次连接调用链

`TRTCRoom.join()`（L49689—L49860）的关键时序是：

```text
Promise.all([
  room.initialize(),      // 初始化信令等房间资源
  room.initSinglePC()     // 尝试初始化 SPC 并生成 originOffer
])
  → doJoin(joinParams, singlePC?.clientAbility)
  → 收到 JOIN_ROOM_RESULT
  → 保存 tinyId、用户和 ICE Server
  → singlePC.setIceServers(...)
  → singlePC.connect(serverAbility)
```

join-result 分支异步启动 `setIceServers().then(connect)`，没有把媒体 connected 作为 `join()` resolve 的前置条件。因此：

```text
join() resolve
  ≠ SignalTransport connected
  ≠ 本地发布完成
  ≠ 远端订阅首帧到达
```

后续 `Room.publish()`、`UplinkTransport.publish()` 和 `DownlinkTransport.doSubscribe()` 会显式等待 `singlePC.waitForPeerConnectionConnected()`，补上这个时序间隔。

## 9. MPC 与 SPC 怎样完成 SDP 协商

## 9.1 MPC 上行

```text
Room.publish(track)
  → dJ.publish()
  → 首次创建固定发送槽或 addTrack
  → createOffer({voiceActivityDetection:false})
  → setLocalDescription(offer)
  → WebSocket publish RPC 携带 localDescription
  → 收到 Answer
  → setRemoteDescription(answer)
  → waitForPeerConnectionConnected()
```

## 9.2 MPC 下行

```text
Room.subscribe(remoteTracks)
  → aJ.subscribe(targetState)
  → 创建 audio/video/video recvonly transceiver
  → createOffer({voiceActivityDetection:false})
  → 修改 codec、RTCP feedback、stereo 和扩展字段
  → setLocalDescription(offer)
  → WebSocket subscribe RPC
  → setRemoteDescription(answer)
  → ontrack 绑定远端 Track
  → waitForPeerConnectionConnected()
```

首次订阅已经声明所需 m-line；后续增量订阅通常只发送 `subscribe_change` 的业务 Boolean，不重新创建 Offer。完全退订才关闭该远端用户的 MPC。

## 9.3 SPC

```text
originOffer
  → setOffer(originOffer)
  → 根据 serverAbility 合成本地可接受的 Answer
  → setRemoteDescription(answer)
  → waitForPeerConnectionConnected()
```

SPC 不是把浏览器 Offer 原样发给服务器换 Answer。客户端会解析 Offer、结合服务端 ability 主动构造 codec、方向、SSRC、MSID 和 MID 关系，再把合成结果设为远端 Answer。

## 10. 发布、订阅和换轨

| 操作 | MPC | SPC |
|---|---|---|
| 首次发布 | 创建上行 PC 并完成 publish SDP RPC | 复用共享 PC 的前 4 个 sender 槽 |
| 后续发布 | 固定槽 `replaceTrack()`；旧路径可能更新 Offer | sender `replaceTrack()`，必要时更新共享 SDP |
| 订阅远端 | 每个用户一个下行 PC | 每个远端用户占用 3 个动态 recvonly 槽 |
| 增量订阅 | 通常发 `subscribe_change` | 批量修改共享 Answer、MID/SSRC 映射后统一 `updateSDP()` |
| 调整码率 | `sender.setParameters()` 优先，SDP 兜底 | 同样优先 sender parameters，并维护共享 Answer |
| 切换设备 | `sender.replaceTrack(newTrack)` | 同左 |

`replaceTrack()` 只替换 sender 的输入轨道，不会自动更新 SDK media settings、通知服务端、修改 transceiver direction，也不会保证新轨道一定落在既有协商范围内。

## 11. 状态变化与等待语义

MPC 和 SPC 都维护自己的 SDK 媒体状态，不能只看单个原生字段。

```text
pc.connectionState=connecting
  → SDK CONNECTING

pc.connectionState=connected/completed
  → getStats() 查 selected candidate pair
  → SDK CONNECTED

pc.connectionState=failed/closed
  → SDK DISCONNECTED
  → 启动重连
```

`waitForPeerConnectionConnected()` 具备完整生命周期：

- 同一对象的并发等待复用一个 Promise。
- 已 connected 时立即完成。
- 连接约 10 秒仍未成功则超时。
- 离房时以 `API_CALL_ABORTED` 拒绝。
- PC 被 close/reset 时主动拒绝。
- finally 清除缓存 Promise 和 listener。

当 WebSocket 仍在线、多个 PC 连续超时并且全局没有任何媒体 PC connected 时，源码才把问题归为可能的媒体防火墙限制。这说明信令状态和媒体状态是两套独立判断。

## 12. 重连与降级

## 12.1 MPC 重连

- 下行：关闭该用户 PC，重新 `initialize()`，按原订阅状态重新 `connect()`。
- 上行：先尝试 unpublish，重建 PC，再重新发布主流和辅流。
- 每个 MPC 实例维护自己的重连次数、timer 和等待 Promise。
- WebSocket 未连接时不盲目建 PC，而是等待信令恢复后继续。

## 12.2 SPC 重连

```text
startReconnection()
  → reset old PC
  → 获取备用 relay 信息
  → initialize(new iceServers)
  → WebSocket REBUILD_PEER_CONNECTION RPC
  → connect(response.ability, true)
  → UplinkTransport 重新发布
  → 所有 DownlinkTransport 重新订阅
```

SPC 重连失败会按错误类型决定延迟重试或停止；达到最大次数后不会无限重建。

## 12.3 SPC 降级到 MPC

SPC 初始化失败或首次报告不可恢复错误时，Room 可以：

1. 关闭共享 PC。
2. 禁用 SPC。
3. 必要时重新进房。
4. 创建 MPC 上行并恢复主/辅发布。
5. 为每个远端用户创建 MPC 下行并恢复原订阅状态。

上层 Track 包装尽量复用，因此降级主要改变传输拓扑，不要求业务重新创建所有 Track 对象。

## 13. 关闭与资源释放

| 资源 | 所有者 | 正常释放方式 | 不能依赖的隐式行为 |
|---|---|---|---|
| MPC PC | `iJ` 派生实例 | 清事件 → `pc.close()` → 拒绝 wait Promise | `pc.close()` 不会替 SDK 停止本地采集 Track |
| SPC PC | `SignalTransport` | `reset()` 用于重建；`close()` 用于永久销毁 | 单个 Uplink/Downlink view 关闭不能关共享 PC |
| 本地采集 Track | 本地 Track/Manager | unpublish/replace 后由资源所有者 `track.stop()` | `replaceTrack(null)` 不等于停止摄像头或麦克风 |
| 远端 Track 包装 | Downlink 对象 | 退订、停止 Player、解绑事件 | PC 结束不等于所有 UI/Player 引用都已清理 |
| Encoded Streams | `SignalTransport` | 最终 close 时 AbortController 中止 | 当前 reset 路径没有完整清理 Map，重连可能积累项 |
| Script Transform Worker | `SignalTransport` | 理想情况应在最终 close 时 `terminate()` | 当前源码未看到显式 `terminate()` |
| DataChannel | SPC PC | 随 PC 关闭回收 | 当前 Room 构造路径实际没有启用自定义 DataChannel |

Room 退房时的总体顺序是：停止同步和心跳 → 关闭各下行 → 清网络质量 → 关闭上行 → 处理 WebSocket → 重置 Stats 和用户 → 最后关闭共享 SPC。

## 14. API 参数与本项目实参

本节只解释正文调用链中真正影响行为的原生 API。参数的标准含义以 MDN 为准；“本项目实参”则以 `trtc.deobfuscated.js` 为准。二者必须分开看：标准允许某个字段，不代表本项目传了它；源码传了私有字段，也不代表它属于 Web 标准。

## 14.1 `new RTCPeerConnection(configuration)`

MDN：[RTCPeerConnection()](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/RTCPeerConnection)

MPC 的正式业务代码（L37435—L37448）直接展示了配置对象怎样进入构造器：

```js
const e = {
  iceServers         : this._room.getIceServers(),
  iceTransportPolicy : this._room.getIceTransportPolicy(),
  sdpSemantics       : this._sdpSemantics,
  bundlePolicy       : 'max-bundle',
  rtcpMuxPolicy      : 'require',
  tcpCandidatePolicy : 'disable',
  IceTransportsType  : 'nohost'
};

this._peerConnection = new RTCPeerConnection(e);
```

标准 `configuration` 字段如下：

| 字段 | 类型、可选值和默认值 | 含义 | 本项目怎样传 |
|---|---|---|---|
| `iceServers` | `RTCIceServer[]`，可省略 | 可供 ICE 使用的 STUN/TURN 服务器；空数组时只能依靠主机候选等本地可达路径 | MPC 调 `room.getIceServers()`；SPC 接收 `initialize(iceServers)` 参数。每项通常含 `urls`，TURN 还可含 `username`、`credential`、`credentialType` |
| `iceTransportPolicy` | `'all'` 或 `'relay'`；标准默认 `'all'` | `'all'` 考虑所有候选，`'relay'` 只使用 TURN relay 候选 | 来自 `room.getIceTransportPolicy()`；`forceRelay` 场景会得到 `'relay'` |
| `bundlePolicy` | `'balanced'`、`'max-compat'`、`'max-bundle'`；默认 `'balanced'` | 远端不支持 BUNDLE 时，决定预先创建多少 transport | 固定传 `'max-bundle'`，倾向所有媒体共用一个 transport |
| `rtcpMuxPolicy` | 现代实现使用 `'require'` | 是否要求 RTP/RTCP 复用 | 固定传 `'require'` |
| `iceCandidatePoolSize` | `0..65535`，默认 `0` | 预取 ICE Candidate 的池大小 | 未传，使用浏览器默认 `0` |
| `certificates` | `RTCCertificate[]`，可省略 | 指定 DTLS 身份证书；首次确定后不能靠 `setConfiguration()` 更换 | 未传，由浏览器生成 |
| `peerIdentity` | `string`，可省略 | 要求远端通过指定身份验证 | 未传 |
| `sdpSemantics` | 非当前标准配置字段；历史 Chrome 常见 `'unified-plan'` / `'plan-b'` | 选择 SDP 轨道语义 | 源码显式传 `_sdpSemantics` / `room.sdpSemantics`，属于兼容性历史包袱 |
| `tcpCandidatePolicy`、`IceTransportsType` | 非 MDN 标准字段 | 目标内核或私有实现的候选过滤开关 | 固定为 `'disable'`、`'nohost'`；不能复制成通用 WebRTC 配置 |
| `encodedInsertableStreams`、`offerExtmapAllowMixed` | 实验/历史实现字段 | 分别启用旧 Encoded Insertable Streams、允许 extmap mixed 协商 | 仅 SPC 按能力传前者，并固定传后者为 `true` |

`RTCIceServer` 子字段要继续展开：

| 子字段 | 必填性 | 含义 | 本项目来源 |
|---|---|---|---|
| `urls` | 必填 | 单个 URL 或 URL 数组；常见方案是 `stun:`、`turn:`、`turns:` | 调度、JOIN_ROOM_RESULT 或显式 fallback |
| `username` | TURN 时常用 | TURN 长期凭据用户名 | 服务端下发；日志打印时会隐藏 |
| `credential` | TURN 时常用 | TURN 密码或凭据对象 | 服务端下发；日志打印时会隐藏 |
| `credentialType` | 可选，默认 `'password'` | 说明 `credential` 的类型 | 源码没有自行补值，沿用下发值或浏览器默认 |

SPC 在 L46170—L46204 先调用 `getPeerConnectionConfig(e)`，再把完整返回值传入构造器。因此这里的 `e` 不是整个配置对象，而只是上层传下来的 `iceServers`；包装函数负责补齐其余字段。

## 14.2 `createOffer(options)`

MDN：[createOffer()](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createOffer)

标准签名是 `pc.createOffer(options?)`，返回 `Promise<RTCSessionDescriptionInit>`。主要选项：

| 选项 | 类型/默认 | 含义 | 本项目怎样传 |
|---|---|---|---|
| `iceRestart` | `boolean`，默认 `false` | `true` 时让新 Offer 携带新的 ICE credentials，发起 ICE Restart | 正式业务没有传；重连采用重建 PC 或重新交换 SDP |
| `offerToReceiveAudio` | `boolean`，已废弃 | legacy Plan B 风格地要求接收音频 | 只有无 `addTransceiver()` 的兼容分支传 `true` |
| `offerToReceiveVideo` | `boolean`，已废弃 | legacy Plan B 风格地要求接收视频 | 解码探测和 MPC 兼容分支传 `true` |
| `voiceActivityDetection` | `boolean`，历史选项 | 是否使用语音活动检测相关能力 | MPC 下行显式传 `false` |

MPC 下行（L38231—L38238）先决定 Unified Plan 还是 legacy 参数：

```js
const e = { voiceActivityDetection: false };

hasAddTransceiver() && this._sdpSemantics === sdpSemanticsUnifiedPlan
  ? (this._peerConnection.addTransceiver('audio', { direction: 'recvonly' }),
     this._peerConnection.addTransceiver('video', { direction: 'recvonly' }),
     this._peerConnection.addTransceiver('video', { direction: 'recvonly' }))
  : ((e.offerToReceiveAudio = true), (e.offerToReceiveVideo = true));

const t = await this._peerConnection.createOffer(e);
```

因此 `e` 的运行时形态有两种：支持 Transceiver 时只有 `{voiceActivityDetection:false}`；旧接口分支则再带两个 `offerToReceive*`。SPC 初始化直接无参 `createOffer()`，因为四个 `sendonly` Transceiver 已经定义了 m-line 结构。

## 14.3 `addTransceiver(trackOrKind, init)`

MDN：[addTransceiver()](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTransceiver)

| 参数 | 类型/可选项 | 含义 | 本项目怎样传 |
|---|---|---|---|
| `trackOrKind` | `MediaStreamTrack`，或 `'audio'` / `'video'` | 传 Track 时立即成为 sender 的源；传 kind 时先创建空 sender 槽 | 能力检测和固定槽通常传字符串；MPC 首次发布优先传真实输出 Track，没有 Track 时传 kind 字符串 |
| `init.direction` | `'sendrecv'`、`'sendonly'`、`'recvonly'`、`'inactive'`；默认 `'sendrecv'` | 希望协商出的收发方向 | MPC 下行传 `'recvonly'`；SPC 前四槽传 `'sendonly'`；退发布后可能改成 `'inactive'` |
| `init.streams` | `MediaStream[]`，默认 `[]` | 决定远端 `track` 事件的 `streams` 分组，不负责采集 | MPC 首次发布传 `[e]`，其中 `e` 是临时 `MediaStream`，已加入本次音视频输出 Track |
| `init.sendEncodings` | `RTCRtpEncodingParameters[]` | 预设 sender 编码层，例如 `rid`、`active`、`maxBitrate`、缩放倍数 | 正式创建槽时未传；码率后续通过 `sender.setParameters()` 设置 |

MPC 首次发布（L38653—L38671）的关键点是：`a`、`s` 分别来自本地音频/视频包装对象的 `outMediaTrack`，`e` 只是用于流分组；真正发送的是第一个参数里的 Track。

## 14.4 `addTrack(track, ...streams)` 与 `removeTrack(sender)`

MDN：[addTrack()](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTrack)、[removeTrack()](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/removeTrack)

| API 参数 | 含义 | 本项目实参 |
|---|---|---|
| `addTrack.track` | 必填 `MediaStreamTrack`，是实际发送源 | 能力检测传 `canvas.captureStream()` 的第一条视频 Track；MPC legacy 发布传包装对象的 `outMediaTrack` |
| `addTrack....streams` | 可选 `MediaStream` 列表，只决定远端分组 | 能力检测把同一个 canvas stream 作为第二参数；业务分支把本地组合流传入 |
| `removeTrack.sender` | 必填 `RTCRtpSender`；停止该 sender 发送，通常触发重新协商 | MPC 先从 Transceiver 中找到 sender，再传给 `pc.removeTrack(e)`；这里的 `e` 是 sender，不是 Track |

不要把 SDK 中同名的 `room.addTrack(trackWrapper)` 与浏览器 `pc.addTrack(nativeTrack, stream)` 混为一层。前者先选择 MPC/SPC、主/辅流和 sender 槽，最后才可能调用后者。

## 14.5 `setLocalDescription(description)` 与 `setRemoteDescription(description)`

MDN：[setLocalDescription()](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setLocalDescription)、[setRemoteDescription()](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setRemoteDescription)

`description` 是 `RTCSessionDescriptionInit`：

| 字段 | 可选值/含义 | 本项目怎样传 |
|---|---|---|
| `type` | `'offer'`、`'answer'`、`'pranswer'`、`'rollback'` | MPC 直接传 `createOffer()` 结果；SPC `setOffer()` 固定重建成 `{type:'offer', sdp:t}`；Answer 来自服务端响应或本地合成 |
| `sdp` | SDP 文本；`rollback` 时应为空或省略 | MPC 可能先删 codec/改码率；SPC 先经 `jJ()` 改写，再传入本地描述 |

SPC（L47092—L47104）的实际值流是：

```js
setOffer(e) {
  const t = jJ(e.sdp, this.clientAbility, this._serverAbility);
  return this._peerConnection.setLocalDescription({ type: 'offer', sdp: t });
}

setAnswer(e) {
  return this._peerConnection.setRemoteDescription(e);
}
```

这里 `e` 在 `setOffer()` 入口是浏览器 Offer，传入原生 API 前只保留 `e.sdp` 并改写；`setAnswer()` 则把 `{type:'answer', sdp:...}` 整体透传。两个方法都返回 Promise，后续协商步骤必须 `await`，不能只看同步属性赋值。

## 14.6 `RTCRtpSender.replaceTrack(newTrack)`

MDN：[replaceTrack()](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack)

唯一参数 `newTrack` 是同 kind 的新 `MediaStreamTrack`，也可以是 `null`。返回 Promise；浏览器会尽量不触发重新协商，但 kind 改变或编码边界变化仍可能拒绝。

SPC 的传值规则（L48569—L48593）非常明确：

```js
const senders = this._peerConnection.getSenders();
const nativeTrack = track.outMediaTrack || track.mediaTrack;

nativeTrack.kind === 'audio' && senders[0] && await senders[0].replaceTrack(nativeTrack);
nativeTrack.kind === 'video' &&
  (!isAuxiliary && senders[1] && await senders[1].replaceTrack(nativeTrack),
   isAuxiliary && senders[3] && await senders[3].replaceTrack(nativeTrack));
```

| 实参 | 含义 |
|---|---|
| `track.outMediaTrack` | 优先使用处理管线输出，例如混流、特效或音频处理后的 Track |
| `track.mediaTrack` | 没有输出 Track 时退回包装对象当前原生 Track |
| `null` | 退发布或关闭时让 sender 停止发送；不会调用 source Track 的 `stop()` |

主音频固定 sender 0，主视频固定 sender 1，小流固定 sender 2，辅流视频固定 sender 3。这也是 `replaceTrack()` 无需重新搜索媒体类型以外映射的原因。

## 14.7 `getStats(selector)`

MDN：[getStats()](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getStats)

`selector` 可省略；若传入，应是此 PC 上唯一对应 sender 或 receiver 的 `MediaStreamTrack`。返回 `Promise<RTCStatsReport>`。

| 调用形态 | 本项目用途 |
|---|---|
| `pc.getStats()` | MPC/SPC 的 `logSelectedCandidate()` 获取整份报告，再通过 `localCandidateId/remoteCandidateId` 关联被选 Candidate Pair |
| `sender.getStats()` | H.264 回环检测和本地发送音量；Adapter 缺失时内部转成 `pc.getStats(track)` 或全量后过滤 |
| `receiver.getStats()` | 回环解码检测和远端音量；同样可能经过 Adapter |

正式 `logSelectedCandidate()` 没传 selector，因为它要跨 transport 查 Candidate Pair，而不是只查某一条媒体 Track。

## 14.8 `setConfiguration(configuration)`、`createDataChannel(label, options)` 与 `close()`

MDN：[setConfiguration()](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setConfiguration)、[createDataChannel()](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel)、[close()](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/close)

- SPC 的 `setIceServers(e)` 在 L46296—L46303 把新的 `e` 作为 `iceServers` 重新送入 `getPeerConnectionConfig(e)`，再把完整对象传给 `setConfiguration()`。它没有只传 `{iceServers:e}`，目的是保留构造期的策略字段；已存在 localDescription 时源码拒绝继续用 origin Offer。
- `createDataChannel(label, options?)` 的 `label` 是业务子协议名称；SPC 源码传 ```${room.userId}dc```，没有传 options，因此使用默认有序、可靠传输。随后把 `binaryType` 设为 `'arraybuffer'`。当前 Room 构造链并未启用这条自定义消息路径，属于存在代码但非默认正式业务。
- `pc.close()` 无参数、无返回值。MPC 先置空 `onconnectionstatechange`，再关闭并清引用；它只关闭 ICE/DTLS/RTP 连接，不负责停止摄像头、麦克风、Player 或 Worker。

## 15. 事实、推断和不能确认的边界

### 可以直接确认

- 正式通话存在 MPC/SPC 两套实现，SPC 失败可以降级为 MPC。
- MPC 的 Offer/Answer 通过 WebSocket publish/subscribe RPC 交换。
- SPC 的远端 Answer由客户端根据服务端 ability 合成。
- 正式业务没有独立 trickle Candidate 消息链。
- SPC 前 4 个 transceiver 是固定上行槽，之后按每个远端用户 3 个下行槽扩展。
- 码率优先使用 `RTCRtpSender.setParameters()`，失败或不支持时再修改 SDP。
- PC 关闭不会自动停止由上层拥有的本地采集 Track。

### 合理推断

- 固定 m-line 和 sender 槽的主要目的，是减少发布换轨时的结构性重协商并保持服务端映射稳定。
- SPC 的 add/remove downlink 队列用于合并并发用户变化，减少重复 SDP 更新。
- WebSocket 在线但媒体 PC 连续超时被归为 firewall restriction，是在区分控制面和媒体面故障。

### 仅凭当前 JS 不能确认

- 服务端完整信令协议和全部错误码语义。
- 未单独发送 Candidate 时，服务端和目标浏览器内部采用的确切 ICE 收集时机。
- `tcpCandidatePolicy`、`IceTransportsType` 等私有字段在目标内核中的具体实现。
- 反混淆文件里的可疑 SDP 字符串是否与原始发布包完全一致。

## 16. 本章附录应该怎样放

最终版正文到这里结束。以下内容移到附录：

- 所有 `RTCPeerConnection`、Sender、Receiver、Transceiver 调用行号。
- Chrome、Firefox、Safari 每个 Shim 函数的逐行账本。
- MPC/SPC 所有方法的直接调用邻接表。
- 所有 PC 相关事件监听、解绑和派发位置。
- 全部 Mermaid 时序图的可打印版本。

这样正文可以顺着“边界 → 参数 → 兼容 → 探测 → 所有权 → 初始化 → 调用链 → 状态 → 重连 → 释放”读完，需要核对完整性时再查附录。
