# PRTC APIs Documentation

### 注意：浏览器权限限制，仅支持https访问获取媒体设备

## NAMESPACES

### Web SDK 版本

`TRTC.version`

<!-- ### 调试
> 可以将调试日志输出到浏览器控制台

`FlyInn.debug.enable('FlyInn:*') // 开启调试输出`

`FlyInn.debug.disable('FlyInn:*') // 关闭调试输出` -->

---

> ### 创建客户端对象
> 创建一个实时音视频通话的客户端对象，在每次会话中仅需要调用一次。

`createClient(clientConfig: Object): Client`

| 参数      | 类型    | 默认值 | 必填 | 示例|
| -------- | ------- | ----- | --- | --- |
| domain   | string  |       | 是  | pro.vsbc.com |
| dn       | string  |       | 否  | 张三 |
| register | boolean | false | 否  | |
| user_id  | string  |       | 是  | 2384574834 |
| user_sig | string  |       | 是  | |
| wss_url  | string  |       | 是  | wss://pro.vsbc.com:5092/wss |

---

>### 创建一个本地流 Stream 对象

`createStream(streamConfig: Object): LocalStream`

| 参数      | 类型    | 默认值 | 必填 |
| -------- | ------- | ----- | --- |
| audio   | boolean / Object  | true  | 否 |
| Video   | boolean / Object  | true  | 否 |

Audio:

Video:

---

## Class

### Client

### LocalStream

### RemoteStream