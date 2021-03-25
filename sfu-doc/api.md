# PRTC APIs Documentation

### 注意：浏览器权限限制，仅支持https访问获取媒体设备

## NAMESPACES

## Members

`version`

Web SDK 版本

<!-- ### 调试
> 可以将调试日志输出到浏览器控制台

`PRTC.debug.enable('FlyInn:*') // 开启调试输出`

`PRTC.debug.disable('FlyInn:*') // 关闭调试输出` -->

`PRTC.isScreenShareSupported()`

检测浏览器是否支持屏幕分享

在创建屏幕分享流之前请调用该方法检查当前浏览器是否支持屏幕分享。

Returns:

Type boolean

getDevices
getCameras
getMicrophones
getSpeakers

---

> ### 创建客户端对象
> 创建一个实时音视频通话的客户端对象，在每次会话中仅需要调用一次。

`createClient(clientConfig: Object): Client`

| 参数      | 类型    | 默认值 | 必填 | 示例|
| -------- | ------- | ----- | --- | --- |
| domain   | string  |       | 是  | pro.vsbc.com |
| dn       | string  |       | 否  | 张三 |
| register | boolean | false | 否  | |
| user_sig | string  |       | 是  | |

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
setTurnServer
join
leave
on

### LocalStream
initialize
switchDevice
muteAudio
muteVideo
unmuteAudio
unmuteVideo
getId
getUserId

### RemoteStream
getType
muteAudio
muteVideo
unmuteAudio
unmuteVideo
getId
getUserId
