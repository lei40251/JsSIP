# 10 辅助浏览器 API

> 本文集中说明不直接承载 RTP 媒体、但决定调度、环境、上报、协议和页面生命周期的浏览器能力。

## 1. 本章结论

这些 API 可以按职责分成五组：

| 组 | API | 主要用途 |
|---|---|---|
| 网络与资源 | fetch、XHR、FormData、URLSearchParams、sendBeacon | 调度、下载、上报 |
| 环境与权限 | Navigator、UA Client Hints、Permissions、Network Information | 兼容和策略 |
| 页面与视图 | visibility、pagehide、IntersectionObserver、DOM | 自动订阅和退出收尾 |
| 缓存与性能 | local/sessionStorage、Performance | 日志、配置和诊断 |
| 协议与字节 | ArrayBuffer、TypedArray、DataView、TextEncoder、Base64 | 消息、上报、SEI、WASM |

这些能力失败时通常应该降级，不应直接中断已经建立的音视频通话。

## 2. HTTP 请求封装

公共请求工具优先使用 `fetch`，兼容场景降级 XHR：

```text
sendHttpRequest(options)
  ├─ fetch available → fetch(url, {method, body, priority})
  └─ fallback → xhr.timeout + xhr.open(method,url,true) + xhr.send(body)
```

当前封装实际只统一 method、body 和响应解析。`timeout` 只在 XHR 分支生效；fetch 分支没有传 AbortSignal，也没有显式检查 `response.ok`。源码没有接收或设置 headers。后文会把这些事实与理想封装要求分开说明。

## 3. 房间调度

进房前先通过 HTTP 获取：

- 主、备信令地址。
- ICE/TURN 信息。
- SPC/MPC 和 codec 策略。
- keepAlive、优先级和网络配置。

```text
enterRoom params
  → FormData 或 URLSearchParams
  → 主备调度地址请求/竞速
  → 解析 schedule result
  → SignalChannel + Room 配置
```

调度成功只表示获得连接信息，不表示 WebSocket、join 或媒体连接完成。

## 4. 资源下载

WASM、模型、配置和其他资源可能通过统一 connection manager 下载。需要记录：

- DNS/TCP/TLS/TTFB/下载耗时（浏览器可用时）。
- Content-Type 和内容长度。
- 取消与超时。
- 多地址回退。
- 缓存命中与重复请求合并。

下载 Promise 的消费者仍负责解释内容和释放解码/实例资源。

## 5. gzip、Blob 与上报

日志或二进制报告可能先编码/压缩，再使用 fetch/XHR/sendBeacon：

```text
JSON/text
  → TextEncoder / gzip
  → Blob 或 Uint8Array
  → sendBeacon / fetch keepalive / normal request
```

`sendBeacon()` 适合页面退出时的小型可靠上报，不提供普通 fetch 那样的响应读取能力，也受浏览器队列大小限制。

## 6. 页面退出收尾

`pagehide` 比只监听 unload 更适合现代页面生命周期。退出时通常：

- 尝试发送必要 leave/日志上报。
- 停止可延后的任务。
- 不执行阻塞式同步网络请求。
- 区分 bfcache 场景和真正销毁。

页面事件不是 SDK `destroy()` 的替代；应用仍应在可控生命周期显式释放。

## 7. Storage

使用 local/sessionStorage 前先做可用性检测，因为隐私模式、配额和策略可能让属性存在但写入抛错。

| 存储 | 典型用途 | 生命周期 |
|---|---|---|
| localStorage | 跨刷新日志/配置/诊断 | 持久化，需容量和隐私控制 |
| sessionStorage | 当前标签页会话数据 | 页面会话级 |

不能保存 userSig、token、鉴权头等敏感信息；日志缓存也应有上限和淘汰策略。

## 8. Performance

- `performance.now()` 记录连接、方法和重连耗时。
- PerformanceResourceTiming 辅助定位资源下载阶段。
- 时间戳用于 Stats 差分时要统一单位和采样周期。

性能记录失败不应改变业务 Promise 的成功/失败结果。

## 9. UA 与 Client Hints

源码同时使用 `navigator.userAgent` 和 `userAgentData.getHighEntropyValues()`：

- UA 用于旧浏览器和特殊 WebView 分支。
- Client Hints 获取平台、架构和更细版本。
- iPadOS 等环境还结合触摸点、平台和屏幕特征。

优先做 API 特性检测；UA 只用于无法通过能力判断的已知兼容问题。

## 10. Network Information

`navigator.connection` 可提供 type/effectiveType/downlink/rtt 等浏览器估计，并监听网络类型变化。

它不是 WebRTC 真实路径：

- 真实 Candidate 类型、协议和地址应从 PC Stats 获取。
- 真实媒体 RTT、丢包和码率应从 RTP/remote-inbound/candidate-pair 获取。
- Network Information 只作为环境提示和上报维度。

## 11. Permissions

```text
navigator.permissions.query({name:'camera'|'microphone'})
  → state = granted / prompt / denied
  → 监听 change（支持时）
```

Permissions 查询不能替代 `getUserMedia()`：浏览器可能不支持某个 name，最终授权仍在采集调用中发生。

## 12. IntersectionObserver 自动订阅

远端视频视图可见性链：

```text
observe(view)
  → IntersectionObserver callback
  → 合并短时间可见性变化
  → subscribe / unsubscribe 或播放策略调整
```

Observer 只表达 DOM 可见性，不代表用户业务一定希望退订；Demo/SDK 策略要明确。销毁 view 时必须 unobserve/disconnect。

## 13. 页面可见性和任务调度

`document.visibilityState` 会影响：

- timer/Worker timer 选择。
- 播放与渲染帧回调。
- Stats/日志调度。
- 后台限制和恢复。

任务调度同时使用 timer、RAF、idle callback 或 Worker。每个任务都应保存取消句柄，并由拥有它的对象清理。

## 14. 其他 DOM 能力

- `document.createElement()` 创建音视频、Canvas、自动播放提示等内部元素。
- CustomEvent/内部 EventEmitter 传递状态。
- Image 用于渲染素材或辅助资源。
- Compute Pressure 等能力主要是检测或可选诊断，不能写成正式核心链。

## 15. 二进制对象的分工

| 类型 | 适合操作 |
|---|---|
| ArrayBuffer | 固定字节区和网络/WASM 载体 |
| Uint8Array 等 TypedArray | 按字节或数值数组访问 |
| DataView | 明确大小端读取不同宽度整数 |
| TextEncoder/TextDecoder | UTF-8 文本与字节互转 |
| Blob | 上报、下载、动态 Worker/Object URL |

TypedArray view 的 `byteOffset/byteLength` 可能不是整个底层 buffer，传输和合并时不能直接假设 `view.buffer` 只包含当前数据。

## 16. 自定义二进制协议

源码包含：

- 大端整数读写。
- varint/类 Protobuf 编码。
- TLV/SignalPacket 解析。
- 自定义上报包。
- H.264 SEI 字节操作。
- ArrayBuffer 合并和 Transferable。

解析器必须在每次读取前检查剩余长度，避免损坏包导致越界或无限循环。

## 17. Base64 自定义消息

当前公开自定义消息路径：

```text
Uint8Array
  → 字节转字符串/Base64
  → WebSocket JSON data
  → 接收端 Base64 解码
  → Uint8Array
```

这不是二进制 WebSocket 帧，也不是当前启用的 SPC DataChannel。Base64 会增加体积，不适合高频大数据。

## 18. 安全边界

- URL、日志和上报不得输出 userSig/token/credential。
- TURN username/credential 记录时必须隐藏。
- 动态 Blob Worker 受 CSP 约束。
- Storage 不保存长期敏感凭证。
- `Math.random()` 不适合安全 ID；需要不可预测值时使用 Web Crypto。
- 解析外部二进制数据要限制长度、递归和分配。

## 19. 释放与降级

| 资源 | 释放 |
|---|---|
| fetch/XHR | AbortController / xhr.abort，清 timeout |
| Object URL | `URL.revokeObjectURL()` |
| Observer | unobserve/disconnect |
| DOM listener | removeEventListener |
| timer/RAF/idle | clear/cancel |
| Storage cache | 容量淘汰和业务清除 |
| ArrayBuffer/Frame | 清引用；可关闭对象显式 close |

辅助 API 失败通常记录并降级：调度和鉴权属于进房前硬依赖；日志、性能、权限预查询、Observer 等通常不是通话硬依赖。

## 20. API 参数与本项目实参

### 20.1 `fetch(input, init?)`

MDN：[fetch()](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch)

公共包装器 L12918—L12938：

```js
const { url, body, method = 'POST', timeout, priority } = requestOptions;

return fetch(url, { method, body, priority })
  .then(response => response.clone().json().then(
    json => ({ data: json }),
    () => response.arrayBuffer().then(parseFallback)
  ));
```

| 参数/字段 | 标准含义 | 本项目怎样传 |
|---|---|---|
| `input` | URL 字符串、URL 或 Request | 直接传 `requestOptions.url` 字符串 |
| `init.method` | HTTP 方法，默认 GET | 包装器默认 `'POST'`；调用方可覆盖 |
| `init.body` | BodyInit，如 string、Blob、FormData、ArrayBuffer 等 | 直接传 `requestOptions.body`；日志可为 JSON string 或压缩 ArrayBuffer |
| `init.priority` | `'high'/'low'/'auto'` 的请求优先级提示，兼容性有限 | 上报 fallback 传 `'low'`，其他调用可省略 |
| `init.headers` | HeadersInit | 未传；包装器也没有从 options 解构 headers |
| `init.signal` | AbortSignal | 未传，因此 `requestOptions.timeout` 对 fetch 分支完全不生效 |
| `init.credentials/mode/cache/redirect/referrerPolicy/integrity/keepalive` | 凭据、CORS、缓存等策略 | 均未传，使用浏览器默认 |

`fetch()` 只在网络失败/中止等情况下 reject；HTTP 4xx/5xx 仍 resolve。当前源码没有检查 `response.ok/status`，所以会继续尝试解析错误响应体。这是本文件可直接确认的行为，不应写成“统一处理 HTTP 状态”。

### 20.2 Response 解析链

MDN：[Response.clone()](https://developer.mozilla.org/en-US/docs/Web/API/Response/clone)、[json()](https://developer.mozilla.org/en-US/docs/Web/API/Response/json)、[arrayBuffer()](https://developer.mozilla.org/en-US/docs/Web/API/Response/arrayBuffer)

Response body 通常只能消费一次，所以源码先 `clone()`：clone 用于尝试 JSON，原 response 在 JSON 失败时再读 ArrayBuffer。

| API | 参数 | 返回 | 本项目后续 |
|---|---|---|---|
| `response.clone()` | 无 | 新 Response，共享/tee body stream | clone 上调用 `json()` |
| `response.json()` | 无 | Promise，解析 JSON | 成功包装 `{data:jsonData}` |
| `response.arrayBuffer()` | 无 | Promise<ArrayBuffer> | 先按自定义二进制头解析，再 TextDecoder，最后才保留原 buffer |

`json()` 失败不只表示“响应不是 JSON”，也可能是 body 解码/流错误；当前代码一律进入二进制/文本 fallback。

### 20.3 XHR fallback 的每个参数

MDN：[XMLHttpRequest.open()](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/open)、[send()](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/send)

```js
xhr.timeout = timeout || 5000;
xhr.open(method, url, true);
xhr.send(body);
```

| API 参数 | 含义 | 本项目实参 |
|---|---|---|
| `open(method, url, async, user?, password?)` | 初始化请求 | `method`、`url`、`true`；未传 user/password |
| `timeout` 属性 | 超时毫秒数；0 表示不超时 | `requestOptions.timeout || 5000` |
| `send(body?)` | 发送 body | 同一个 `requestOptions.body` |

源码没有 `setRequestHeader()`、`responseType`、`withCredentials` 或独立 `ontimeout/onerror`。完成依赖 `readystatechange` 到 4；2xx 才 resolve，先 `JSON.parse(xhr.response)`，失败返回原字符串。

### 20.4 `new FormData()` 与 `append(name, value, filename?)`

MDN：[FormData()](https://developer.mozilla.org/en-US/docs/Web/API/FormData/FormData)、[append()](https://developer.mozilla.org/en-US/docs/Web/API/FormData/append)

调度源码 L30764 起无参构造，然后逐项 append：

```js
const form = new FormData();
form.append('userId', String(userId));
form.append('sdkAppId', String(sdkAppId));
form.append('isStrGroupId', String(useStringRoomId));
form.append('groupId', String(roomId));
form.append('sdkVersion', sdkVersion);
form.append('userSig', String(userSig));
```

`append` 的 `name` 是 multipart 字段名，`value` 可为 string 或 Blob；本项目全部显式转 string。第三参数 `filename` 只对 Blob/File 有意义，本项目未传。可选 `model/osString/role/latencyLevel/frameWorkType` 只有有值时才 append。

FormData 交给 fetch/XHR 时浏览器生成 multipart boundary；调用方不应手动设置一个不含 boundary 的 `Content-Type`。`userSig` 是敏感字段，禁止把完整 FormData 序列化到普通日志。

### 20.5 `new URLSearchParams(init)`

MDN：[URLSearchParams()](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/URLSearchParams)

`init` 可以是查询字符串、键值对象、pair iterable 或另一个 URLSearchParams。

| 调用 | 本项目用途 |
|---|---|
| `new URLSearchParams(location.search)` | 读取 `trtc_env`、调试参数、WebSocket 的 `trtc_*` 透传项 |
| `new URLSearchParams(object).toString()` | 把日志上报参数对象编码为 query string |
| `.get(name)` | 取第一个值，不存在返回 null |
| `.has(name)` | 判断参数是否存在 |

`toString()` 会进行 application/x-www-form-urlencoded 编码且不带开头 `?`，所以源码显式 `url + '?' + params.toString()`。WebSocket URL 的核心鉴权参数没有使用 URLSearchParams 构造，而是逐段 `encodeURIComponent()` 拼接。

### 20.6 `CompressionStream(format)` 与压缩结果读取

MDN：[CompressionStream()](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream/CompressionStream)

构造器唯一参数 `format` 支持 `'gzip'`、`'deflate'`、`'deflate-raw'`；项目只传 `'gzip'`，且 JSON 字符串长度必须大于 2800：

```js
const compressed = new Blob([jsonStr], { type: 'application/json' })
  .stream()
  .pipeThrough(new CompressionStream('gzip'));

const buffer = await new Response(compressed).blob().then(b => b.arrayBuffer());
```

`Blob.stream()` 无参数，返回字节 ReadableStream；`new Response(body)` 把压缩 stream 作为 body，其他 init 未传；`blob()` 与 `arrayBuffer()` 都无参数。任一步失败就退回原 JSON 字符串。是否压缩最终通过 URL query `gzip=1|0` 告知服务端。

### 20.7 `navigator.sendBeacon(url, data?)`

MDN：[sendBeacon()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)

| 参数 | 含义 | 本项目实参 |
|---|---|---|
| `url` | 接收上报的 HTTP(S) URL | logger URL，并拼 `gzip=Number(data instanceof ArrayBuffer)` |
| `data` | 可选 BodyInit | 原 JSON string、自定义二进制包或 gzip ArrayBuffer |

返回 boolean，只表示浏览器是否成功把数据加入发送队列，不是服务器成功响应。源码以返回值 `o` 判断：false 时退回 `sendHttpRequest({url,body,priority:'low'})`；true 时不读任何响应。

### 20.8 Storage API 参数

MDN：[Storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage)

| API | 参数 | 返回 | 本项目使用 |
|---|---|---|---|
| `getItem(key)` | string key | string 或 null | 读取带前缀的 JSON 缓存、调试开关 |
| `setItem(key,value)` | 两个 string | undefined，可能因配额/策略抛错 | queue flush 时 `JSON.stringify(value)` |
| `removeItem(key)` | string key | undefined | 删除过期项或指定缓存 |
| `clear()` | 无 | undefined | 包装器提供，但会清当前 origin 全部 localStorage，调用要谨慎 |
| `key(index)` | 数字索引 | key 或 null | 遍历过期项的兼容路径可能使用 |

本项目先做 `isLocalStorageAvailable()` 并全部 try/catch。sessionStorage 只读取调试插件配置。`Storage` 没有内建过期时间；源码把 `expiresIn` 写进 JSON，再自行扫描删除。

### 20.9 `performance.now()`

MDN：[performance.now()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)

无参数，返回从 time origin 起的高精度毫秒数，适合计算同一上下文内耗时。包装器：

```js
return performance?.now
  ? Math.floor(performance.now())
  : Date.now();
```

项目向下取整成整数毫秒；不可用才回退 Unix epoch 毫秒。两种时间基准不同，因此只能对同一函数两次返回做差，不应把 fallback 与原生值混在绝对时间字段中。

### 20.10 `getHighEntropyValues(hints)`

MDN：[NavigatorUAData.getHighEntropyValues()](https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData/getHighEntropyValues)

唯一参数是希望获取的 hint 名称数组。项目精确传：

```js
[
  'architecture',
  'bitness',
  'model',
  'platformVersion',
  'fullVersionList'
]
```

返回 Promise<UADataValues>。源码缓存第一次结果，并结合低熵的 `platform/mobile/brands` 形成日志字符串。浏览器可能因隐私预算、权限策略或不支持返回缺字段；代码逐字段判空，没有把它作为进房硬依赖。

### 20.11 Network Information 事件参数

MDN：[NetworkInformation](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation)

源码取得 `navigator.connection`，注册：

```js
connection?.addEventListener('typechange', onNetworkTypeChange);
```

事件名传 `'typechange'`，listener 是共享函数，第三个 options 未传。业务读取的 `type/effectiveType/downlink/rtt/saveData` 都是浏览器估计值；标准/实现更常见的通用事件是 `change`，源码使用 `typechange` 带有目标浏览器兼容假设。它不替代 PC Stats。

### 20.12 `permissions.query(descriptor)`

MDN：[Permissions.query()](https://developer.mozilla.org/en-US/docs/Web/API/Permissions/query)

唯一参数是 permission descriptor。项目封装 `get(name)` 直接传：

```js
const status = await navigator.permissions.query({ name });
status.addEventListener('change', this.permissionChangeHandler);
```

调用方 `name` 主要是 `'camera'` 或 `'microphone'`。返回 PermissionStatus 的 `state` 为 `'granted'/'denied'/'prompt'`。不同浏览器可能不接受这些 name，所以 catch 后记录并降级；查询结果不能代替 `getUserMedia()` 的实际授权。

### 20.13 `new IntersectionObserver(callback, options)`

MDN：[IntersectionObserver()](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/IntersectionObserver)

源码 L35785—L35839：

```js
observer = new IntersectionObserver(entries => {
  entries.forEach(entry => visibleMap.set(entry.target, entry.isIntersecting));
  clearTimeout(debounceId);
  debounceId = setTimeout(updateSubscription, 200);
}, { root: viewRoot });
```

| 参数/option | 含义 | 本项目实参 |
|---|---|---|
| `callback(entries, observer)` | 交叉状态变化批次 | 只声明 entries，读取 target/isIntersecting |
| `root` | 作为视口的祖先 Element/Document；null 表示顶层 viewport | 公开 `viewRoot`，可为 undefined/null |
| `rootMargin` | 扩缩 root 边界，默认 `0px` | 未传 |
| `threshold` | 触发比例或数组，默认 `0` | 未传，所以刚进入/离开即触发 |
| `trackVisibility/delay/scrollMargin` | 新/实验可见性参数 | 未传 |

`observe(element)` 的唯一参数是每个远端视频 view；`unobserve(element)` 移除单个旧 view；`disconnect()` 无参清全部；`takeRecords()` 无参同步取尚未派发的 entry。项目把多 view 结果聚合，并延迟 200 ms 后决定订阅/退订。

### 20.14 `requestIdleCallback(callback, options?)`

MDN：[requestIdleCallback()](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback)、[cancelIdleCallback()](https://developer.mozilla.org/en-US/docs/Web/API/Window/cancelIdleCallback)

任务调度器传：

```js
idleId = requestIdleCallback(callback, { timeout: task.delay });
```

callback 收到 `IdleDeadline`，标准字段是 `didTimeout` 和无参 `timeRemaining()`。项目 wrapper 的回调不读取 deadline，只用 idle 时机周期检查 `performanceNow()-last >= delay`。`options.timeout` 保证长期没空闲时也触发。

不支持原生 API 时 fallback 用 `setTimeout(callback,1000)` 并模拟 `{didTimeout:false,timeRemaining(){...}}`；由于 fallback 函数只声明一个参数，传入的 `{timeout}` 会被忽略。取消时 `cancelIdleCallback(id)` 传保存 id；fallback 内部转 `clearTimeout(id)`。

### 20.15 `new PressureObserver(callback)` 与 `observe(source, options)`

MDN：[PressureObserver](https://developer.mozilla.org/en-US/docs/Web/API/PressureObserver)

```js
observer = new PressureObserver(this.onPressureChange);
await observer.observe('cpu', { sampleInterval: 2000 });
```

| 参数 | 含义 | 本项目值 |
|---|---|---|
| constructor `callback(records, observer)` | 接收压力记录批次 | 已绑定的 `onPressureChange`；使用最后一条 record |
| `observe(source)` | 压力源 | `'cpu'` |
| `options.sampleInterval` | 最小采样间隔毫秒 | `2000` |

记录 `state` 映射 nominal/fair/serious/critical。该 API 仍属可选能力：Android 被显式跳过，构造/observe 全部 catch，只上报检测启动失败，不阻断通话。

### 20.16 `pagehide` 与 `visibilitychange`

MDN：[pagehide](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event)、[visibilitychange](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)

```js
window.addEventListener('pagehide', this.handleUnload);
document.addEventListener('visibilitychange', handler);
```

两者都传事件名和 listener，未传 options。当前 `handleUnload()` 不接收 PageTransitionEvent，也没有读取 `event.persisted`，所以 bfcache pagehide 与永久离开走同一条统计收尾。visibility handler 读取 `document.hidden/visibilityState`，在 RAF、timer、音频恢复间切换。

### 20.17 编码与 Base64 参数

MDN：[TextEncoder](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder)、[TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/TextDecoder)、[btoa()](https://developer.mozilla.org/en-US/docs/Web/API/Window/btoa)、[atob()](https://developer.mozilla.org/en-US/docs/Web/API/Window/atob)

- `new TextEncoder()` 无参数，只编码 UTF-8；`encode(input)` 的 input 是 JS string，项目用于协议字符串和上报字段。
- `new TextDecoder(label='utf-8', options?)` 项目无参，默认 UTF-8、非 fatal；`decode(input?)` 传 Uint8Array/ArrayBuffer。
- `btoa(binaryString)` 唯一参数必须是每个码元都在 0..255 的二进制字符串。项目先 `new Uint8Array(buffer)`，再 `String.fromCharCode(...bytes)`。
- `atob(base64)` 唯一参数是 Base64 字符串；项目把返回字符串逐字符 `charCodeAt(0)`，生成 Uint8Array.buffer。

这条自定义消息路径不是直接编码 Unicode 文本，而是把任意字节转换为 Base64。超大数组使用展开运算符可能触及参数数量上限，因此不适合大 payload。

### 20.18 DataView 与 TypedArray 的构造参数

MDN：[DataView()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/DataView)、[TypedArray](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray)

`new DataView(buffer, byteOffset?, byteLength?)`：项目用它在同一 ArrayBuffer 上按协议偏移读写 8/16/32 位整数；`getUint16(offset, littleEndian?)` 等第二参数决定大小端，源码自定义协议多处显式按大端组织。

`new Uint8Array(buffer, byteOffset?, length?)`：buffer 可为 ArrayBuffer，也可传长度/数组；项目常用 `new Uint8Array(frame.data)`、`new Uint8Array(buffer)`。转移 `view.buffer` 前必须考虑 view 的 byteOffset/byteLength，不能默认底层 buffer 只含当前 view。

### 20.19 审计补出的 Scheduler API：业务与兼容层分开

深入搜索还发现 `MessageChannel`、`MutationObserver` 和 `queueMicrotask`，但它们位于基础库的 task/microtask shim（L2288—L2490），不是 RTC 正式业务策略：

```text
setImmediate fallback:
  process.nextTick / Dispatch.now
  → MessageChannel
  → window.postMessage
  → script.onreadystatechange
  → setTimeout

queueMicrotask fallback:
  native queueMicrotask
  → Promise.then / process.nextTick
  → MutationObserver(characterData)
  → setImmediate
```

- `new MessageChannel()` 无参数，源码用 `port2.postMessage(taskId)` 驱动 `port1.onmessage`。
- `new MutationObserver(callback)` 的 callback 是 flush microtask queue；`observe(textNode,{characterData:true})` 只监听文本节点 data 翻转。
- `queueMicrotask(callback)` 唯一参数是待排入 microtask 的函数。

这些 API 应计入完整性附录，但主文必须标注“基础库调度兼容层”，不能写成房间、媒体或重连业务直接使用。

## 21. 事实与边界

### 可以直接确认

- HTTP 用于调度、下载和上报，WebSocket 用于房间信令。
- Storage 和 Performance 用于诊断与缓存，不承载媒体。
- 页面可见性、Observer 和 Worker timer 影响调度策略。
- 自定义消息使用 JSON + Base64 WebSocket 路径。

### 不能确认

- 服务端调度、上报和二进制协议的全部字段语义。
- 浏览器隐私策略下所有 Navigator/Permissions 字段的稳定可用性。
