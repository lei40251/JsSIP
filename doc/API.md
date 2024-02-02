# CRTC JSSDK 简要说明

### 注意：浏览器权限限制，仅支持https访问获取媒体设备

## 查看 SDK 版本

 `CRTC.version`

## 调试

可以将调试日志输出到浏览器控制台

 `CRTC.debug.enable('CRTC:*') // 开启调试输出`

 `CRTC.debug.disable('CRTC:*') // 关闭调试输出`

## Class

### CRTC.UA

#### 实例方法

| 方法名称                              | 触发时间                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| start()                               | 连接到信令服务器并向 SIP 服务器注册，如果先前已停止，则恢复先前的状态          |
| stop()                                | 妥善取消注册并终止活动会话（如果有）后，保存当前注册状态并与信令服务器断开连接 |
| call(target, options)<sup>**1**</sup> | 拨出多媒体电话                                                                 |
| isRegistered()                        | 如果UA注册成功则防护true，否则返回false                                        |

> 标注 1 字段说明

| 参数    | 说明                                     |
| ------- | ---------------------------------------- |
| target  | 通话目的地，目标用户名或完整 SIP URI     |
| options | 带有附加参数的**可选对象**（请参见下文） |

options
| 字段名           | 说明                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| mediaConstraints | 具有两个有效字段（音频和视频）的对象，该字段指示会话是否打算使用音频和/或视频以及要使用的约束默认值是音频和视频均设置为 true |
| extraHeaders     | 呼叫时可以自定义携带的数据，示例：[ 'X-Data: dGVzdCB4LWRhdGE=' ]                                                             |
| mediaStream      | 发送给远端的自定义媒体流，自定义媒体流必须包含音频或视                                                                       |
| cMode            | 兼容模式 （如：'paphone'为兼容paphone）                                                                                      |

#### 事件

| 事件名称                        | 触发时间                                   |
| ------------------------------- | ------------------------------------------ |
| failed                          | UA 错误时触发                              |
| connected                       | 信令传输连接建立时                         |
| disconnected                    | 当信令传输连接尝试（或自动重新尝试）失败时 |
| registered                      | 注册成功时                                 |
| unregistered                    | 注销时                                     |
| registrationFailed              | 注册失败时                                 |
| newRTCSession<sup>**1**</sup>   | 为呼入会话/发出呼叫时                      |
| network-quality<sup>**2**</sup> | 网络状态统计事件                           |
| connectFailed<sup>**3**</sup>   | start()调用5秒信令连接未成功时触发         |

> 标注 1：data 字段说明

呼入时
| 字段名     | 说明                                                                              |
| ---------- | --------------------------------------------------------------------------------- |
| originator | "remote" 新会话由远端生成                                                         |
| session    | 会话的 CRTC. RTCSession 实例                                                      |
| request    | 收到的 INVITE 请求的实例，可以获取呼叫携带数据，示例：request.getHeader('X-Data') |
呼出时
| 字段名     | 说明                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| originator | "local" 新会话由本地生成                                                        |
| session    | 会话的 CRTC. RTCSession 实例                                                    |
| request    | 传出 INVITE 请求的实例，可以获取呼叫携带数据，示例：request.getHeader('X-Data') |

> 标注2：data 字段说明

| 字段名                 | 说明                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RTT                    | 本端 RTT                                                                                                                                                                                   |
| uplinkNetworkQuality   | 本端上行网络质量：<br>0 网络状况未知，表示当前 client 实例还没有建立上行/下行连接 <br>1	网络状况极佳<br>2	网络状况较好3	网络状况一般<br>4	网络状况差<br>5	网络状况极差<br>6	网络连接已断开 |
| uplinkLoss             | 本端上行丢包率                                                                                                                                                                             |
| downlinkNetworkQuality | 本端下行网络质量：<br>0 网络状况未知，表示当前 client 实例还没有建立上行/下行连接 <br>1	网络状况极佳<br>2	网络状况较好3	网络状况一般<br>4	网络状况差<br>5	网络状况极差<br>6	网络连接已断开 |
| downlinkLoss           | 本端下行丢包率                                                                                                                                                                             |

> 标注3：failed 说明

| 字段名     | 说明                   |
| ---------- | ---------------------- |
| originator | "local" 事件由本地触发 |
| message    | Connection Error       |
### CRTC.RTCSession

#### 实例方法

| 方法名称                                     | 说明                                                                |
| -------------------------------------------- | ------------------------------------------------------------------- |
| isMuted()                                    | 请求麦克风和视频的开关状态                                          |
| isOnHold()                                   | 请求通话暂停状态                                                    |
| answer()                                     | 应答传入的会话此方法仅适用于传入会话                                |
| terminate()                                  | 终止当前会话，无论其方向或状态如何                                  |
| sendInfo(contentType, body=null)<sup>1</sup> | 发送 SIP INFO 消息                                                  |
| mute(options=null)<sup>2</sup>               | 使本地音频静音 和/或 视频关闭                                       |
| unmute(options=null)<sup>3</sup>             | 取消本地音频静音 和/或 打开视频                                     |
| hold()                                       | 暂停通话                                                            |
| unhold()                                     | 恢复暂停的通话                                                      |
| refer(options=null)                          | 呼转                                                                |
| switchDevice('camera', 'deviceId')           | 切换设备; camera ：摄像头，deviceId：设备ID, 通过getCameras接口获取 |
| share()                                      | 分享媒体（图片，视频，屏幕，页面元素）                              |
| unshare()                                    | 取消分享                                                            |
| sendInfo()                                   | 发送INFO消息                                                        |
| sendDTMF()                                   | 发送DTMF                                                            |
| demoteToAudio()                              | 通话降级为音频模式                                                  |
| upgradeToVideo()                             | 升级通话到视频模式                                                  |
| isEstablished()                              | 如果会话已经建立则返回true，否则返回false                           |

标注 1:
| 参数名      | 说明                                            |
| ----------- | ----------------------------------------------- |
| contentType | 表示 SIP INFO 消息的 ContentType 字段值的字符串 |
| body        | 表示 SIP INFO 消息正文的可选字符串              |

标注 2：
| 参数名 | 说明                       |
| ------ | -------------------------- |
| audio  | 布尔值, 是否将本地音频静音 |
| video  | 布尔值, 是否将本地视频关闭 |

标注 3：
| 参数名 | 说明                         |
| ------ | ---------------------------- |
| audio  | 布尔值，是否取消本地音频静音 |
| video  | 布尔值，是否打开本地视频     |

#### 事件

| 事件名称                                  | 说明                                                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| progress<sup>1</sup>                      | 在接收或生成对 INVITE 请求的 1XX SIP 类响应（> 100）时触发，播放振铃或回铃音                                                        |
| confirmed                                 | 确认呼叫时触发                                                                                                                      |
| ended                                     | 建立的呼叫结束时触发                                                                                                                |
| failed                                    | 当会话无法建立时触发                                                                                                                |
| newInfo<sup>2</sup>                       | 当接受或发送 SIP INFO 消息而触发                                                                                                    |
| newDTMF                                   | 收到INFO模式的DTMF后触发                                                                                                            |
| muted                                     | 当本地媒体静音时触发，包括音频静音或视频关闭                                                                                        |
| unmuted                                   | 当本地媒体取消静音时触发，包括音频取消静音或打开关闭的视频                                                                          |
| getusermediafailed                        | 当内部调用 getUserMedia() 失败时触发                                                                                                |
| peerconnection:iceConnectionState         | iceconnectionstatechange事件触发，[参考链接](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/iceConnectionState) |
| peerconnection:createofferfailed          | 当内部调用 createOffer() 失败时触发                                                                                                 |
| peerconnection:createanswerfailed         | 当内部调用 createAnswer() 失败时触发                                                                                                |
| peerconnection:setlocaldescriptionfailed  | 当内部调用 setLocalDescription() 失败时触发                                                                                         |
| peerconnection:setremotedescriptionfailed | 当内部调用 setRemoteDescription() 失败时触发                                                                                        |
| hold                                      | 通话已暂停                                                                                                                          |
| unhold                                    | 已恢复暂停的通话                                                                                                                    |
| mode                                      | 通话模式变化，如：音频模式切换到视频模式或视频模式切换到音频模式                                                                    |
| cameraChanged                             | 摄像头切换完成后触发                                                                                                                |
| videoTrackState<sup>3</sup>               | 本端video状态变化事件，当video状态变化时触发                                                                                        |

标注 1：
data 字段
| 字段名     | 说明                          |
| ---------- | ----------------------------- |
| originator | 呼入为"local"，呼出为"remote" |

标注 2：
data 字段
| 字段名     | 说明                          |
| ---------- | ----------------------------- |
| originator | 接收为"local"，发送为"remote" |
| info       | Info 实例                     |

标注 3：
data 字段
| 字段名                         | 说明                                                     |
| ------------------------------ | -------------------------------------------------------- |
| track                          | 视频媒体track，可以获取track实时属性                     |
| muted/readyState/label/enabled | muted:一般非主动释放摄像头时该属性会变为true，视频会中断 |

## Module

### CRTC.Utils
| 方法名称                   | 说明                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| getCameras()               | 获取可用的摄像头列表                                                                                        |
| getMicrophones()           | 获取可用的麦克风列表                                                                                        |
| getStreams(pc, originator) | 获取发送或接收的音视频流；PC: 获取媒体流的RTCPeerConnection；originator: 'local'发送的流,'remote'接收的流； |
