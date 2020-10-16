# FlyInn JSSDK 简要说明

## 查看 SDK 版本

`FlyInn.version`

## 调试

可以将调试日志输出到浏览器控制台

`FlyInn.debug.enable('FlyInn:*') // 开启调试输出`

`FlyInn.debug.disable('FlyInn:*') // 关闭调试输出`

## Class

### FlyInn.UA

#### 实例方法

连接到信令服务器并向 SIP 服务器注册，如果先前已停止，则恢复先前的状态

> start()

妥善取消注册并终止活动会话（如果有）后，保存当前注册状态并与信令服务器断开连接

> stop()

拨出多媒体电话

> call(target, options=null)

| 参数    | 说明                                     |
| ------- | ---------------------------------------- |
| target  | 通话目的地，目标用户名或完整 SIP URI     |
| options | 带有附加参数的**可选对象**（请参见下文） |

options

|参数名|说明|
|-|-|
|mediaConstraints|具有两个有效参数（音频和视频）的对象，该参数指示会话是否打算使用音频和/或视频以及要使用的约束默认值是音频和视频均设置为 true|

#### 事件

| 事件名称                      | 触发时间                                   |
| ----------------------------- | ------------------------------------------ |
| connected                     | 信令传输连接建立时                         |
| disconnected                  | 当信令传输连接尝试（或自动重新尝试）失败时 |
| registered                    | 注册成功时                                 |
| unregistered                  | 注销时                                     |
| registrationFailed            | 注册失败时                                 |
| newRTCSession<sup>**①**</sup> | 为呼入会话/发出呼叫时                      |

> 标注 1：data 参数说明

呼入时

|参数名|说明|
|-|-|
|originator|"remote" 新会话由远端生成|
|session|会话的 FlyInn.RTCSession 实例|
|request|收到的 INVITE 请求的实例|

呼出时

|参数名|说明|
|-|-|
|originator|"local" 新会话由本地生成|
|session|会话的 FlyInn.RTCSession 实例|
|request|传出 INVITE 请求的实例|

### FlyInn.RTCSession

#### 实例方法

| 方法名称                                     | 说明                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| answer()                                     | 应答传入的会话此方法仅适用于传入会话                                          |
| terminate()                                  | 终止当前会话，无论其方向或状态如何                                            |
| sendInfo(contentType, body=null)<sup>1</sup> | 发送 SIP INFO 消息                                                            |
| mute(options=null)<sup>2</sup>               | 使本地音频静音 和/或 视频关闭                                                 |
| unmute(options=null)<sup>3</sup>             | 取消本地音频静音 和/或 打开视频                                               |
| switchCam(mediaConstraints=null)<sup>6</sup>                          | 当设备有多个摄像头时用于切换摄像头，该方法切换后本地视频流的 **Promise** 对象 |
|  displayShare(type=null)<sup>7</sup>                          | 分享桌面，type 默认为空启用双视频流模式，为‘replace’为替换流模式（建议采用替换流模式） |



#### 事件

| 事件名称             | 说明                                                                         |
| -------------------- | ---------------------------------------------------------------------------- |
| progress<sup>4</sup> | 在接收或生成对 INVITE 请求的 1XX SIP 类响应（> 100）时触发，播放振铃或回铃音 |
| confirmed            | 确认呼叫时触发                                                               |
| ended                | 建立的呼叫结束时触发                                                         |
| failed               | 当会话无法建立时触发                                                         |
| newInfo<sup>5</sup>  | 当接受或发送 SIP INFO 消息而触发                                             |
| muted                | 当本地媒体静音时触发，包括音频静音或视频关闭                                 |
| unmuted              | 当本地媒体取消静音时触发，包括音频取消静音或打开关闭的视频                   |
| getusermediafailed   | 当内部调用 getUserMedia() 失败时触发                                         |

## 标注

标注 1:

| 参数名 | 说明 |
| ----------- | ----------------------------------------------- |
| contentType | 表示 SIP INFO 消息的 ContentType 参数值的字符串 |
| body | 表示 SIP INFO 消息正文的可选字符串 |

标注 2：

| 参数名 | 说明 |
| ------ | ------------------------- |
| audio | 布尔值,是否将本地音频静音 |
| video | 布尔值,是否将本地视频关闭 |

标注 3：

| 参数名 | 说明 |
| ------ | ---------------------------- |
| audio | 布尔值，是否取消本地音频静音 |
| video | 布尔值，是否打开本地视频 |

标注 4：
data 参数

|参数名|说明|
|-|-|
|originator|呼入为"local" <br/> 呼出为"remote"|

标注 5：
data 参数

|参数名|说明|
|-|-|
|originator|接收为"local" <br/> 发送为"remote"|
|info|Info 实例|

标注 6：
mediaConstraints 参数

|参数名|说明|
|-|-|
|mediaConstraints|具有两个有效参数（音频和视频）的对象，该参数指示会话是否打算使用音频和/或视频以及要使用的约束默认值是音频和视频均设置为 true|