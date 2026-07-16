# 03 `WebSocket` 信令分析

> 本文沿“连接 → 信封 → RPC → 在线状态 → 业务命令 → 恢复 → 关闭”解释 WebSocket 控制面。RPC 是 Remote Procedure Call（远程过程调用）；MPC/SPC 分别指多 PeerConnection/单 PeerConnection 模式。完整术语见[核心术语速查](00-Reading-Guide-and-Source-Map.md#7-核心术语速查)，方法和事件位置见附录 B—D。

## 1. 本章结论

源码没有直接把 WebSocket 当成一个简单的 `send/onmessage` 通道，而是在浏览器 API 上增加了五层能力：

1. 主、备地址同时连接，选择先成功的一条。
2. 所有业务命令封装成统一 JSON 信封。
3. 使用单调 `seq` 把事件式响应包装成 Promise RPC。
4. 把“socket open”“应用层信道就绪”“join 成功”分成不同状态。
5. 在异常关闭后恢复信令，再由 Room 决定是否重进房和重建媒体。

源码没有实现应用层 Ping/Pong。`isOnline` 的核心依据是连接状态和最近约 12 秒是否收到下行消息，而不是定时向服务器发送 ping。

## 2. 使用边界

| 层 | WebSocket 相关内容 | 是否属于正式业务 |
|---|---|---|
| 能力检测 | 检查 `WebSocket` 构造器和标准静态状态值 | 只说明 API 存在 |
| SignalChannel | 建连、收发、RPC、在线判断、恢复 | 是，控制面核心 |
| Room | join/publish/subscribe/rebuild 等业务命令 | 是，命令调用方 |
| WebRTC | SDP 或 ability 通过信令交换 | 是，但媒体数据不走 WebSocket |

WebSocket 负责控制面；音视频 RTP/RTCP 由 RTCPeerConnection 承载。WebSocket 在线不代表 ICE/DTLS 和媒体路径可用。

## 3. 谁拥有 WebSocket

房间初始化时创建 SignalChannel（源码语义对象，反混淆类名 `Xj`）：

```text
SDK 实例
  → TRTCRoom
    → SignalChannel
      ├─ _socket          主地址候选
      ├─ _backupSocket    备地址候选
      └─ _socketInUse     当前胜出的连接
```

SignalChannel 同时持有：

- SDK AppId、userId、userSig 和信令 URL。
- 当前 tinyId 和信令会话信息。
- 递增 `_seq`。
- 最近下行消息时间。
- 尚未完成 RPC 的事件 listener 和 timeout。
- 重连、关闭和在线状态字段。

Room 决定什么时候 join、reJoin 或销毁；SignalChannel 只负责可靠地传递命令和恢复连接。

## 4. URL 怎样构造

主、备地址来自房间调度结果。SignalChannel 在基址后拼接 SDK 和用户信息，以及白名单诊断查询参数。

```text
schedule mainUrl / backupUrl
  → build URL query
  → encodeURIComponent(value)
  → new WebSocket(finalUrl)
```

需要注意：

- 查询值逐项编码，不是把整个 URL 再编码一次。
- userSig 等鉴权信息可能进入 URL，日志和错误上报必须脱敏。
- 源码没有传 WebSocket `protocols` 参数。
- 没有读取协商后的 `protocol`、`extensions` 或二进制类型。

## 5. 主备连接是竞速，不是顺序回退

连接阶段同时调用两次 `connectWS()`：

```text
connectWS(main)
    ┐
    ├─ promiseAny → 最先成功的 socket → _socketInUse
    ┘
connectWS(backup)
```

每个候选连接：

1. `new WebSocket(url)`。
2. 临时绑定 `onopen/onclose/onerror`。
3. 可选连接超时。
4. open 时 resolve 当前 socket。
5. close/error/timeout 时 reject。
6. finally 清临时 handler 和 timer。

选出胜者后关闭较慢的候选。这样可以同时处理“主域名不可达”和“主域名可达但更慢”，代价是短时间内会创建两条 TCP/TLS/WebSocket 连接。

## 6. open 之后还没有完成进房

至少要区分四个阶段：

```text
WebSocket open
  → CHANNEL_SETUP_RESULT / 应用层信道建立
    → join RPC 成功
      → MPC/SPC 媒体连接完成
```

`connectWS()` resolve 只能证明浏览器 WebSocket 握手成功。后续仍要等待应用层下行结果，并由 Room 发送 join。任何文档或业务日志都不应把这四步统一写成“连接成功”。

## 7. 统一 JSON 信封

`send(command, data)` 发送的核心结构是：

```js
{
  cmd: command,
  data,
  userId: this.userId,
  tinyId: this._signalInfo.tinyId,
  seq: ++this._seq
}
```

特点：

- 业务协议是文本 JSON，没有设置 `binaryType`。
- `seq` 在当前 SignalChannel 内单调递增。
- join 前 tinyId 可能尚未建立，后续命令使用 join 结果保存的 tinyId。
- 自定义二进制消息会先转 Base64，再放入 JSON，而不是发送 WebSocket 二进制帧。

发送前主要依据 SDK 内部连接状态；源码没有以 `WebSocket.readyState === WebSocket.OPEN` 作为统一背压/发送门禁，也没有使用 `bufferedAmount`。

## 8. 收消息：先更新活性，再分派事件

`onmessage(event)` 的阅读顺序是：

```text
收到浏览器 message 事件
  → 记录最近下行消息时间
  → JSON.parse(event.data)
  → 读取 cmd / seq / code / message / data
  → 数值命令映射为内部事件名
  → EventEmitter.emit(eventName, {data: envelope})
```

未知命令不会直接丢弃；映射失败时可用命令值字符串作为事件名，便于兼容服务端新增消息。

这里更新“最近收到消息”的时间非常关键：在线判断依赖下行活性，而不是应用层 ping 响应。

## 9. `sendWaitForResponse()` 怎样把事件变成 RPC

```text
生成 seq
  → 注册目标响应事件 listener
  → 发送 JSON 信封
  → onmessage emit 对应事件
  → listener 检查 event.data.seq
  → 匹配时 resolve
  → timeout/close 时 reject
  → finally 解绑 listener、清 timer
```

同一响应事件可能同时存在多个请求，因此不能只按事件名完成 Promise，必须继续比较 `seq`。

RPC 的 Promise 代表“收到匹配响应”，不一定代表后续媒体动作完成。例如 publish RPC 返回 Answer 后，仍要 `setRemoteDescription()` 并等待 PC connected。

## 10. 业务命令怎样进入 SignalChannel

| 业务动作 | 典型命令 | 响应后的下一步 |
|---|---|---|
| 进房 | join | 保存 tinyId、用户、ICE/ability；启动媒体连接 |
| MPC 发布 | publish / publish_change / unpublish | 应用 Answer、更新 sender/状态 |
| MPC 订阅 | subscribe / subscribe_change / unsubscribe | 应用 Answer或更新既有 m-line 状态 |
| SPC 重建 | rebuild peer connection | 根据新 ability 连接共享 PC |
| 媒体配置 | constraint/media settings | 服务端更新业务侧参数 |
| 自定义消息 | custom message | JSON + Base64 数据 |
| 网络质量与日志 | report 类命令 | 统计和诊断，不直接改变媒体轨道 |

命令字符串、数值下行码和 SDK 内部事件名是三套表示，需要沿映射表阅读，不能把某个数值直接当成公开事件。

## 11. 在线状态不是 `readyState`

源码中的在线判断大致由以下事实组成：

- 当前 SignalChannel 已建立并处于内部 connected 状态。
- 最近约 12 秒内收到过服务端消息。
- 正在关闭或明确销毁时不能判为在线。

因此会出现几种组合：

| WebSocket | 最近有下行 | 媒体 PC | 含义 |
|---|---|---|---|
| open | 有 | connected | 控制面和媒体面正常 |
| open | 有 | failed | 信令可用，媒体路径故障 |
| open | 无 | 可能仍 connected | TCP 表面未关，但应用层已可能失活 |
| closed | 无 | 暂时 connected | 现有媒体可能短暂继续，但无法可靠控制和恢复 |

源码没有应用层 `ping`/`pong` 命令，也无法从浏览器标准 API 主动发送协议级 WebSocket Ping 帧。

## 12. 异常恢复分为三层

### 12.1 候选连接创建失败

主备任一成功即可继续；两个都失败或超时，SignalChannel 建立失败，由上层决定重试或报错。

### 12.2 已有 WebSocket 异常关闭

SignalChannel 清当前连接和等待状态，进入恢复流程。恢复过程中不会把旧 `_socketInUse` 继续当作可发送对象。

### 12.3 Room 重新进房

信令恢复不自动保证房间状态和媒体状态仍有效。Room 会根据错误和当前阶段决定：

- 只恢复 SignalChannel。
- 重新发送 join。
- 重建 SPC。
- 让各 MPC 连接在信令恢复后继续自己的重连。

所以“WebSocket reconnect”和“RTC reconnect”不是同一个方法，也不应共用一个完成事件。

## 13. RPC 重试不是盲目重发

请求是否可以重试取决于命令语义：

- 纯查询或幂等状态同步较容易重试。
- join、publish、subscribe 等状态命令必须结合服务端返回和当前 Room 状态。
- 超时不等于服务端一定没有执行，直接重复可能产生重复状态。

源码通过命令包装、Room 状态和恢复流程协调，而不是给所有 `sendWaitForResponse()` 自动套相同重试策略。

## 14. 正常关闭必须中止所有等待

关闭 SignalChannel 时需要完成：

1. 标记主动关闭，避免 `onclose` 再进入异常恢复。
2. 解绑主、备和当前 socket 的 handler。
3. 使用正常关闭码关闭浏览器 WebSocket。
4. 清连接、重试和在线 timer。
5. 拒绝所有尚未完成的 RPC Promise。
6. 移除 EventEmitter listener。

如果只调用 `socket.close()` 而不拒绝等待请求，公开 API 可能一直等到各自 timeout，导致退房和销毁拖延。

## 15. 与 RTCPeerConnection 的协同

MPC 的 SDP 明确经过 WebSocket RPC：

```text
createOffer
  → setLocalDescription
  → publish/subscribe RPC 携 Offer
  → 收到 Answer
  → setRemoteDescription
```

SPC 的首次协商不同：客户端先生成 origin Offer 和 client ability，join 后使用 server ability 本地合成 Answer；WebSocket 仍负责 join、ability 和 rebuild 命令，但不是简单的“发送 Offer、返回完整 Answer”。

正式 MPC/SPC 没有可证明的独立 Candidate 消息链。不能因为 Adapter 存在 `addIceCandidate()`，就写成业务 Candidate 通过 WebSocket 逐个交换。

## 16. API 参数与本项目实参

### 16.1 `new WebSocket(url, protocols?)`

MDN：[WebSocket()](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket)

源码 L36901—L36908：

```js
connectWS(e) {
  let { url: t, timeout: i, isMain: r } = e,
      n = new WebSocket(t);

  this.bindSocket(n);
  r ? (this._socket = n) : (this._backupSocket = n);
  // ...
}
```

| 参数 | 标准含义和可选值 | 本项目怎样传 |
|---|---|---|
| `url` | 必填字符串或 URL；应使用 `ws:` / `wss:`（MDN 也说明浏览器可解析 HTTP(S) 形式），不能带 fragment | 传局部变量 `t`，它来自 `connectWS({url,...})` 的解构；主连接是 `_urlWithParam`，备连接是 `_backupUrlWithParam` |
| `protocols` | 可选字符串或字符串数组，表示期望的 WebSocket 子协议；省略时等价空列表 | 完全未传，因此不会主动发送自定义 `Sec-WebSocket-Protocol` 候选 |

`url` 不是服务端裸地址。getter 会拼接：

```text
base URL
  + SPC race 模式下的 /v2/ws
  + ?sdkAppId=...
  + &userId=...
  + &userSig=...
  + &keepAlive=0|1
  + 可选 signalDomain
  + 页面 trtc_* 调试参数
  + race 模式下的 &race=1
```

所有动态值都先经 `encodeURIComponent()`；`URLSearchParams(location.search)` 只负责读取页面查询参数。`userSig` 最终位于 URL query，日志、代理和历史记录必须避免泄露它。

### 16.2 `connect(timeout)` 与 `connectWS({url, timeout, isMain})`

这两个不是浏览器 API，但它们决定原生构造器收到什么值。

| 参数 | 默认值 | 含义 | 下游去向 |
|---|---:|---|---|
| `connect(timeout)` | `10000` ms | 单个候选 WebSocket 的建立超时；传 `0` 时不装超时定时器 | 同一个值分别传给主、备 `connectWS()` |
| `url` | 无 | 已拼好 query 的完整信令地址 | 直接成为 `new WebSocket(url)` 的第一个参数 |
| `timeout` | 上一层传入 | 候选连接允许等待的毫秒数 | `setTimeout(callback, timeout)` |
| `isMain` | 无 | 只用于把 socket 保存到 `_socket` 或 `_backupSocket`，以及超时后关闭正确候选 | 不会传给浏览器 WebSocket |

主备竞速时两个 `connectWS()` 参数对象分别是：

```js
{ url: this._urlWithParam,       isMain: true,  timeout }
{ url: this._backupUrlWithParam, isMain: false, timeout }
```

`promiseAny()` 选择第一个触发 `open` 的实例；另外一个实例随后解绑并以正常关闭码关掉。

### 16.3 事件绑定及事件参数

MDN：[open](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/open_event)、[message](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/message_event)、[error](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/error_event)、[close](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close_event)

```js
e.addEventListener('close', this.onclose);
e.addEventListener('error', this.onerror);
e.addEventListener('message', this.onmessage);
```

`addEventListener(type, listener, options?)` 在这里传两个参数：事件名和已在构造函数中 `bind(this)` 的监听器；第三个 options 没传，因此使用非 capture、非 once、非 passive 的默认行为。连接候选阶段又临时赋值 `n.onopen/onerror/onclose`，Promise settle 后全部置 `null`；正式使用阶段则保留 `addEventListener()` 注册的三个监听器。

| 回调实参 | 标准字段 | 本项目读取 |
|---|---|---|
| `MessageEvent e` | `data`、`origin`、`lastEventId` 等 | 只读取 `e.data`，先按字符串字节数计数，再 `JSON.parse(e.data)` |
| `CloseEvent e` | `code`、`reason`、`wasClean`、`target` | 用 `target` 判断主/备及是否当前连接；用 `wasClean` 和 `code===1000` 判断是否重连 |
| `Event e`（error） | 通常不暴露底层网络错误详情 | 只通过 `target` 定位 socket；错误原因由状态机统一包装 |

### 16.4 `socket.send(data)`

MDN：[send()](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send)

标准 `data` 可以是字符串、`ArrayBuffer`、`Blob`、TypedArray 或 `DataView`，返回 `undefined`。本项目信令只传 UTF-8 JSON 字符串：

```js
const envelope = {
  cmd: command,
  data,
  userId: this.userId,
  tinyId: this._signalInfo.tinyId,
  seq: ++this._seq
};
const text = JSON.stringify(envelope);

this._socketInUse.send(text);
this.bytesSent += getStringByteLength(text);
return envelope.seq;
```

| 信封字段 | 来源 | 含义 |
|---|---|---|
| `cmd` | `send(command, data)` 的 `command` | 服务端命令名，如 join、publish、subscribe、reconnect |
| `data` | 第二参数，默认 `{}` | 命令业务体；不是 WebSocket API 的第二参数 |
| `userId` | SignalChannel 构造参数 | 当前用户标识 |
| `tinyId` | channel setup / join 响应保存 | 服务端侧房间内短标识；建链早期可能尚未赋值 |
| `seq` | `_seq` 自增 | 客户端 RPC 关联号；响应通过相同 seq 唤醒等待者 |

源码先检查 SDK 状态 `isConnected && !room.isLeft`，但没有再次检查原生 `readyState`，也没有使用 `bufferedAmount` 做背压。因此该实现适合低频小信令，不适合照搬为大文件或高频媒体数据通道。

### 16.5 `sendWaitForResponse(options)` 的每个参数

这是项目在 `send()` 上构造的 RPC 层：

| 字段 | 默认值 | 含义 | 实际使用 |
|---|---:|---|---|
| `command` | 无 | 要发送的命令 | 传给 `send(command, data)` |
| `data` | 无 | 命令业务体 | 进入 JSON 信封的 `data` |
| `timeout` | `5000` ms | 等待响应的最长时间 | 传给 `setTimeout()`；超时后解绑响应和关闭监听器 |
| `responseCommand` | 无 | 期望收到的内部事件名 | `this.on(responseCommand, handler)` |
| `commandDesc` | 无 | 面向日志的命令说明 | 超时错误消息使用，不发给服务端 |
| `enableLog` | `true` | 超时时是否写 warning | 仅影响日志 |
| `addReceiveTime` | `false` | 成功响应时是否补客户端接收时间 | 为真时写 `response.data.receiveTime = Date.now()` |

真正完成 Promise 的条件是 `response.data.seq === requestSeq`，而不是只匹配命令名。连接关闭时 `MSG_TYPE_7` 会让所有等待立即以 `API_CALL_ABORTED` 结束。

### 16.6 `socket.close(code?, reason?)`

MDN：[close()](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close)

| 参数 | 标准限制 | 本项目实参 |
|---|---|---|
| `code` | 可省略；应用自定义码通常应在 `3000..4999`，`1000` 表示正常关闭 | 放弃竞速候选和常规关闭传 `1000`；进入重连前传 `4011` 表示项目自定义的重连关闭 |
| `reason` | 可省略的 UTF-8 文本，编码后最多 123 字节 | 未传 |

`close()` 启动关闭握手，不保证调用点已完成网络关闭。项目因此先解绑事件，避免主动关闭的备用 socket 误触发正式连接的重连逻辑。`startReconnection()` 还会先把当前 socket 的 `onclose` 清空，再以 `4011` 关闭。

## 17. 事实、推断和未知边界

### 可以直接确认

- 主备地址并发竞速，选择先成功连接。
- 业务消息使用 JSON 信封和单调 seq。
- RPC 通过内部事件和 seq 匹配实现。
- 在线判断依赖最近下行消息，不存在自定义 ping/pong。
- WebSocket open、join 和媒体 connected 是不同阶段。
- 当前公开自定义消息路径走 WebSocket，而不是启用的 DataChannel。

### 合理推断

- 主备竞速用于降低 DNS、线路或单域名故障带来的建连长尾。
- 最近下行时间比单独看 readyState 更接近“应用层是否仍活着”。
- 未统一使用 bufferedAmount，说明信令消息被假定为低频小包；高频大数据不应照搬该实现。

### 仅凭当前 JS 不能确认

- 服务端全部命令协议、幂等性和错误码语义。
- 服务端是否发送协议级 Ping 帧；浏览器 JS 无法直接观察或发送该控制帧。
- 每种异常下服务端保留房间状态的精确时长。

## 18. 本章附录入口

- WebSocket 全部浏览器 API 出现位置：见 [附录 A](Appendix-A-WebAPI-Occurrences.md)。
- SignalChannel 方法定义和调用方：见 [附录 B](Appendix-B-Source-Method-Index.md)。
- `open/message/error/close` 事件：见 [附录 C](Appendix-C-Event-Index.md)。
- 公开 API 到信令命令：见 [附录 E](Appendix-E-Public-API-Call-Chains.md)。
