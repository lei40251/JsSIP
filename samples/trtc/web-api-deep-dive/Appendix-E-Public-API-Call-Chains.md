# 附录 E 公开 API 调用链

> 本附录用于从公开方法反查参数、内部方法、浏览器 API、事件和释放位置。推荐先阅读主线，再按具体 API 查询。

> 分析对象：`samples/trtc/trtc.deobfuscated.js`。
>
> 目标：从任意一个公开方法出发，能继续找到参数经过哪些包装器、进入哪些内部方法、最终调用哪些浏览器 Web API、触发哪些事件，以及由谁释放资源。

## 1. 先看真正的调用入口：方法体外还有装饰器

公开方法并不是直接进入文件中看见的函数体。L36130-L36530 的 `applyDecorators(...)` 会在运行时替换原型方法，因此真实顺序是：

```text
调用者
  → 参数校验
  → 同类操作去重 / update 参数合并 / stop 状态钩子
  → 防抖、限频或插件名解析
  → 日志与错误转换
  → 文件中可见的方法体
  → Room / Track / Player / Plugin
  → WebSocket、WebRTC、Media、DOM 等 Web API
  → 浏览器事件反向进入 SDK EventEmitter
```

如果只读方法体，会漏掉以下实际行为：

| 公开方法 | 方法体外的关键行为 | 源码位置 |
|---|---|---:|
| `enterRoom` | 参数校验；相同房间调用去重；写入日志 userId/sdkAppId | L36148-L36180 |
| `startLocalAudio` | 参数校验；相同 microphoneId 的重复 start 合并 | L36187-L36208 |
| `updateLocalAudio` | update 合并；`captureVolume` 以 200 ms 防抖 | L36210-L36234 |
| `stopLocalAudio` | audio stop 状态钩子，避免重复停止 | L36236 |
| `startLocalVideo` | 相同 cameraId 的重复 start 合并 | L36237-L36258 |
| `updateLocalVideo` | video update 合并 | L36260 |
| `startScreenShare` | 同一 screen start 合并 | L36262 |
| `start/update/stopRemoteVideo` | 以 `userId + streamType` 作为操作键 | L36265-L36322 |
| `stopRemoteVideo({userId:'*'})` | 包装器遍历所有远端主流/辅流 | L36293-L36320 |
| `setRemoteAudioVolume` | 以 userId 为键，200 ms 内只保留末次调用 | L36325-L36372 |
| `start/update/stopPlugin` | 插件名称先解析为插件实例，再调用实例方法 | L36374-L36446 |
| `sendSEIMessage` | 参数校验；每秒 30 次、每秒累计 8000 字节限频 | L36473-L36490 |
| `sendCustomMessage` | 参数校验；每秒 30 次、每秒累计 8000 字节限频 | L36492-L36495 |

反混淆文件中有少量形参重命名不完整，例如声明 `role` 后方法体仍出现 `e`，或 `catch (err)` 后读取另一短变量。应以装饰器规则、数据结构和下游调用共同确认语义，不能把短变量名当成可靠 API 名称。

## 2. 公开 API 总表

“直接 Web API”指门面方法自身能看到的调用；“最终 Web API”包含下游 Track、Room、Player 和 Transport。

| 公开 API | 门面行号 | 主要内部链 | 最终 Web API / 浏览器能力 |
|---|---:|---|---|
| `TRTC.create` / `_create` | L34250-L34297 | permission wrapper → `new TRTCSdk` | `navigator.userAgent`、`hardwareConcurrency`、`deviceMemory`、UA Client Hints、WebGL GPU 查询、`location`、iframe 检测 |
| `getNetworkTime` | L34543 | `getServerTime` | 由 WebSocket NTP 同步值和计时器维护；调用本身不发网络请求 |
| `use` | L34549-L34579 | `_use` → `new Plugin(context)` | 取决于插件；可能使用 Worker/WASM/WebCodecs，不可从 `use` 一概而论 |
| `enterRoom` | L34581-L34628 | `Room.join` → schedule → SignalChannel → MPC/SPC | Fetch/XHR、WebSocket、RTCPeerConnection、计时器、Page Visibility |
| `exitRoom` | L34631-L34637 | `_exitRoom` → `Room.leave` → decorator `reset(true)` | WebSocket send/可选 close、PC close、timer clear；不停止本地采集 Track |
| `switchRoom` | L34640-L34662 | `Room.switchRoom`；失败则 exit + enter | WebSocket RPC、PC 重建或更新、计时器 |
| `switchRole` | L34706-L34715 | `Room.switchRole` → uplink close/create | WebSocket RPC、RTCPeerConnection、sender/transceiver |
| `destroy` | L34718-L34737 | plugin destroy → Room.destroy → stop local tracks | WebSocket.close、PC.close、Track.stop、AudioNode/Player/Worker 清理 |
| `startLocalAudio` | L34740-L34796 | AudioTrack.capture → play → publish | getUserMedia、MediaStreamTrack、Web Audio、HTMLAudioElement、RTCRtpSender |
| `updateLocalAudio` | L34799-L34826 | switchDevice/custom track/update3A/play/publish | getUserMedia 或 replace input、AudioNode、MediaStreamTrack、RTCRtpSender |
| `stopLocalAudio` | L34829-L34843 | unpublish → Track.stop/close → manager remove | sender/transceiver 更新、Track.stop、AudioNode.disconnect、media element cleanup |
| `startLocalVideo` | L34846-L34996 | VideoTrack.capture → play → publish | getUserMedia、Track settings/constraints、HTMLVideoElement/Canvas、RTCRtpSender |
| `updateLocalVideo` | L34923-L34996 | switch/recapture/applyProfile/play/publish | getUserMedia、applyConstraints、contentHint、replaceTrack、setParameters |
| `stopLocalVideo` | L34999-L35011 | unpublish → stop/close | sender/transceiver 更新、Track.stop、video/canvas cleanup |
| `startScreenShare` | L35022-L35104 | ScreenTrack.capture → optional AudioTrack → publish/play | getDisplayMedia、MediaStream、Track ended、Capture Handle/CropTarget、HTMLVideoElement |
| `updateScreenShare` | L35107-L35152 | contentHint/mute/publish/play update | Track.enabled/contentHint、sender/transceiver、HTML/Canvas player |
| `stopScreenShare` | L35155-L35161 | `_stopScreenShare` | unpublish、Track.stop、Audio pipeline/plugin cleanup |
| `startRemoteVideo` | L35164-L35214 | Room.subscribe → RemoteTrack.play → observe view | RTCPeerConnection track/receiver、HTMLVideoElement/Canvas/WebGL、IntersectionObserver |
| `updateRemoteVideo` | L35217-L35255 | changeType/play update/observe view | WebSocket subscribe RPC、media player、IntersectionObserver |
| `stopRemoteVideo` | L35258-L35264 | `_stopRemoteVideo` → unsubscribe/stop | receiver/transceiver/PC subscription、player cleanup |
| `muteRemoteAudio` | L35299-L35327 | `_startRemoteAudio` 或 `_stopRemoteAudio` | PC subscribe/unsubscribe、HTMLAudioElement/Web Audio |
| `setRemoteAudioVolume` | L35330-L35352 | `_updateAudioPlayOption` | HTMLMediaElement.volume、AudioNode/GainNode 管线 |
| `startPlugin` | L35355-L35361 | plugin resolver → `plugin.start` | 插件定义决定 |
| `updatePlugin` | L35364-L35370 | plugin resolver → `plugin.update` | 插件定义决定 |
| `stopPlugin` | L35373-L35379 | plugin resolver → `plugin.stop` | 插件定义决定；应释放插件持有的 Worker/Node/Codec |
| `enableAudioVolumeEvaluation` | L35382-L35388 | Room interval → sender/receiver stats/audio level | getStats、Web Audio 音量值、timer |
| `on` / `off` | L35391-L35442 | EventEmitter；AUDIO_FRAME 有额外 PCM 管线 | AbortController、AudioWorklet/ScriptProcessor（仅音频帧事件） |
| `getAudioTrack` | L35445-L35466 | 选本地/远端 Track；可选 processed clone | MediaStreamTrack.clone |
| `getVideoTrack` | L35469-L35490 | 选主流/辅流；可选 processed clone | MediaStreamTrack.clone |
| `getVideoSnapshot` | L35493-L35512 | Track.getVideoFrame → Player.getVideoFrame | Canvas 2D drawImage、canvas.toDataURL('image/png') |
| `setCurrentSpeaker` | L35526-L35544 | enumerate output → `_setCurrentSpeaker` → player | enumerateDevices、HTMLMediaElement.setSinkId |
| `sendSEIMessage` | L35991-L36002 | SEI plugin update → encoded frame pipeline | RTCRtpScriptTransform/createEncodedStreams、Worker/Streams，视能力分支而定 |
| `sendCustomMessage` | L36005-L36010 | CustomMessageManager → SignalChannel.send | Uint8Array、btoa、WebSocket；本实现不是业务 DataChannel 消息 |
| `callExperimentalAPI` | L36013-L36021 | registry `zG.call` | 由实验 API 名称决定，不能推断固定 Web API |
| `TRTC.setLogLevel` | L36023-L36025 | logger config/upload switch | Console、网络日志上报、存储，取决于开关 |
| `TRTC.isSupported` | L36027-L36029 | capability detection | navigator、MediaDevices、RTCPeerConnection、codec/graphics 能力探测 |
| `TRTC.getPermissions` | L36031-L36055 | permission manager request/get | Permissions API、getUserMedia 授权探测 |
| `TRTC.getCameraList` | L36057-L36059 | device helper | enumerateDevices；可选先请求权限 |
| `TRTC.getMicrophoneList` | L36061-L36063 | device helper | enumerateDevices；可选先请求权限 |
| `TRTC.getSpeakerList` | L36065-L36067 | output device helper | enumerateDevices；浏览器可能不暴露 audiooutput |
| `TRTC.setCurrentSpeaker` | L36069-L36105 | 遍历实例或 Android 输入路由兼容 | enumerateDevices、setSinkId；Android 分支可能通过切换输入设备实现路由 |

## 3. 房间生命周期

### 3.1 `enterRoom(params)` 的参数分流

| 参数 | 门面处理 | 下游用途 |
|---|---|---|
| `sdkAppId/userId/userSig` | 原样进入 `roomParams` | 调度、WebSocket URL/鉴权、join RPC |
| `roomId` | 缺省转 0 | 数字房间；与 `strRoomId` 二选一 |
| `strRoomId` | 缺省转空串 | 字符串房间，并设置 `useStringRoomId` |
| `scene` | 默认 `rtc` | 房间场景、角色/延迟/发布策略 |
| `role` | `audience → 21`，其他 → 20 | join 协议角色；随后决定是否创建上行 |
| `enableAutoPlayDialog` | 默认 true | 播放失败时是否创建交互恢复 UI |
| `autoReceiveAudio` | 默认 true | 收到远端音频可用事件后是否自动订阅/播放 |
| `autoReceiveVideo` | 默认 false | 收到远端视频可用事件后是否自动订阅 |
| `proxy` | 传入 `setProxyServer`；对象形式还提取 TURN | 调度/信令代理、RTCConfiguration.iceServers/transport policy |
| `preferHW` | 仅布尔值生效 | 编解码实现偏好 |
| `playoutDelay` | truthy 时写入 Room | 远端播放延迟策略 |
| `jitterBufferDelay` | truthy 时写入 Room | receiver jitter buffer 目标值 |
| `privateMapKey/latencyLevel/businessInfo` | 写入 join 数据 | 服务端鉴权和房间策略 |
| `useVp8/useH265` | 写入 join 数据 | 能力协商与 SDP codec 选择 |
| `keepAlive` | 写入 join 数据 | exit 后是否短时保留 SignalChannel |

完整调用链：

```text
enterRoom(params)
  → validation + same-room start hook
  → Room.setProxyServer()/setTurnServer()（可选）
  → Room.join(roomParams, scene, frameWorkType)
    → join 状态装饰器: left → joining → joined
    → schedule()（必要时）
      → Fetch/XHR 获得 domains、ICE servers、自动配置
    → SignalChannel.connect()
      → 主/备 URL 各 new WebSocket(url)
      → Promise-any 选择先成功的一条
      → socket OPEN
      → channel setup/join response（应用层成功）
    → Room.doJoin()
      → sendWaitForResponse(join envelope)
      → 保存 tinyId、远端用户、能力与 relay 信息
    → initSinglePC() 或按发布/订阅创建 MPC
      → new RTCPeerConnection(configuration)
      → transceiver/capability/SDP 流程
    → startHeartbeat()/syncUserList()/network quality
  → _checkTrackToPublish()
    → 将进房前已采集且 publish=true 的本地 Track 发布
  → AG.start() 全局监控
```

不要把以下状态合并成一个“连接成功”：

1. HTTP 调度成功。
2. WebSocket `open`。
3. channel setup/join RPC 成功。
4. `RTCPeerConnection.connectionState === 'connected'`。
5. 远端 `track` 到达。
6. 播放器首帧渲染。

### 3.2 `exitRoom()` 不等于停止本地摄像头/麦克风

实际链路：

```text
exitRoom()
  → _exitRoom() 的 stop('room') 状态钩子
  → Room.leave()
    → 发送最后一次 heartbeat（失败忽略）
    → SignalChannel.send(leave)
    → leave 状态装饰器 success → Room.reset(true)
      → stop heartbeat / user-list timer
      → close downlink/uplink/single PC
      → clear stats/user maps
      → keepAlive=true 且 socket 健康：暂留 WebSocket
        否则 SignalChannel.close()
  → _clearRemoteTracks()
```

`exitRoom()` 没有调用 `stopLocalAudio()`、`stopLocalVideo()` 或 `stopScreenShare()`。本地 Track 可以继续采集，并可在下次 `enterRoom()` 后由 `_checkTrackToPublish()` 重新发布。这是源码中有意保留的生命周期语义。

### 3.3 `switchRoom(params)`

```text
switchRoom(params)
  → validation + update key/cache
  → Room.isSwitchRoomSupported()
  → _clearRemoteTracks()
  → Room.switchRoom(params)
    → WebSocket switch-room RPC
    → 更新 roomId/user map/RTC 订阅状态
  → 超时或 switch-room 失败
    → _rejoinRoom(params)
      → exitRoom()
      → 合并旧 enterRoomParams 与新房间参数
      → enterRoom()
```

反混淆后的 catch 局部变量存在名称不一致，但回退意图和下游调用是明确的。

### 3.4 `switchRole(role, config)`

- `privateMapKey` 和 `latencyLevel` 先更新到 Room。
- 切到 `audience` 时，下游会关闭上行 PC。
- 切到 `anchor` 后 `_checkTrackToPublish()` 会发布仍在持有的本地 Track。
- WebSocket 负责角色 RPC；WebRTC 负责实际上行 sender/transceiver 生命周期。

### 3.5 `destroy()` 的精确语义

源码中的门面 `destroy()` 是同步方法，顺序为：插件 `destroy` → 事件解绑 → `Room.destroy()` → 移出实例集合 → 停本地 Track。它不返回一个等待所有异步 stop 完成的 Promise。

这和 `exitRoom()` 有三个区别：

| 维度 | `exitRoom` | `destroy` |
|---|---|---|
| 实例是否可再次进房 | 可以 | 不应再使用 |
| 本地采集是否保留 | 保留 | 发起 stop/close |
| Signal/PC/插件 | Room reset，keepAlive 可能暂留信令 | 全部销毁，pending join 被 reject |

## 4. 本地音频 API

### 4.1 `startLocalAudio(config = {publish:true})`

参数到内部对象的映射：

| 参数 | 内部动作 | 最终 Web API 参数/属性 |
|---|---|---|
| `publish` | 默认 true；已进房则 `Room.publish` | sender/transceiver + publish RPC |
| `mute` | capture 后 `Track.setMute` | 通常控制 Track.enabled 或发布 mute flag |
| `option.microphoneId` | `captureConfig.deviceId` | getUserMedia audio `deviceId` constraint |
| `option.audioTrack` | `customSource` | 直接接收调用者提供的 MediaStreamTrack |
| `captureVolume` | `setCaptureVolume` | Web Audio GainNode/内部音量管线 |
| `profile` | 字符串查 profile 表或直接对象 | sampleRate/channelCount/bitrate/3A constraints |
| `earMonitorVolume` | `{muted, volume}` 播放配置 | HTMLMediaElement.volume / Audio graph |
| `echoCancellation` | 写入 audio profile | getUserMedia audio constraint |
| `noiseSuppression` | 写入 audio profile | getUserMedia audio constraint |
| `autoGainControl` | 写入 audio profile | getUserMedia audio constraint |

调用链：

```text
startLocalAudio
  → new LocalAudioTrack(audioManager)
  → setProfile()/setCaptureVolume()
  → 绑定设备错误、active device、publish state、player state
  → track.capture({deviceId | customSource})
    → build audio MediaTrackConstraints
    → navigator.mediaDevices.getUserMedia({audio: constraints})
    → stream.getAudioTracks()[0]
    → setInputMediaStreamTrack(source)
      → 可选 AudioContext processing graph
      → 生成 outMediaTrack
  → setMute()
  → Room.publish(track)（publish=true 且已进房）
    → UplinkTransport.addTrack/replaceTrack
    → sender/transceiver + WebSocket publish/change RPC
  → _updateAudioPlayOption(ear monitor)
  → EventBus 113
```

源码门面区域部分短变量在反混淆后未完全同步，详细 capture 实现应继续沿 L23000 附近 Track 类阅读，而不是照抄 `e/o/s` 名称。

### 4.2 `updateLocalAudio(config)` 是分支更新，不是统一重采集

| 输入变化 | 分支 |
|---|---|
| `microphoneId` | `switchDevice(id)`，通常新 getUserMedia 后替换输入 Track |
| `audioTrack` | `setInputMediaStreamTrack(customTrack)` |
| `captureVolume` | 200 ms 防抖后更新 capture gain |
| `earMonitorVolume` | 更新播放 muted/volume，不改变采集约束 |
| 3A 字段 | `update3A(config)`，按浏览器能力 applyConstraints 或重采集 |
| `publish` | Room.publish / Room.unpublish |
| `mute` | LocalAudioTrack.setMute |

`deepMerge(this._localAudioConfig, config)` 在最后保存增量配置，供下一次 update 和恢复流程使用。

### 4.3 `stopLocalAudio()` 的释放顺序

```text
Room.unpublish(track)（已进房）
  → EventBus 114
  → track.stop()        停播放器/运行状态
  → track.close()       停 source/out Track、音频节点和监听
  → audioManager.removeInput(track)
  → destroyEventDispatcher(track)
  → 清空 Track/config 引用
```

## 5. 本地视频 API

### 5.1 `startLocalVideo(config)`

默认配置是 `{publish:true, view:null, capture:true}`。

| 参数 | 内部映射 | Web API 层 |
|---|---|---|
| `capture` | false 时不主动采集，只挂入 manager input | 是否调用 getUserMedia |
| `option.cameraId` | `captureConfig.deviceId` | video deviceId constraint |
| `option.useFrontCamera` | user/environment | facingMode constraint |
| `option.videoTrack` | customSource | 外部 MediaStreamTrack |
| `retryWhenExactFailed` | capture retry policy | exact constraint 失败后降级重试 |
| `profile` | profile 表或对象 | width/height/frameRate + sender bitrate |
| `qosPreference` | `mapQoSToContentHint` | MediaStreamTrack.contentHint；下游 degradationPreference |
| `avoidCropping` | Track 字段 | profile/实际画幅选择策略 |
| `small/smallMode` | small config | simulcast encoding/transceiver |
| `fillMode` | player objectFit | video CSS/Canvas 渲染 |
| `mirror` | player mirror | CSS transform/Canvas/WebGL 坐标 |
| `rotation` | Track renderer/processor | Canvas/WebGL/track pipeline |

```text
startLocalVideo
  → new CameraVideoTrack(videoManager)
  → profile/small/rotation/contentHint 配置
  → 绑定 first-frame、device、publish、player、size 事件
  → capture=true ? track.capture(captureConfig) : manager.changeInput(track)
    → getUserMedia({video: constraints})
    → sourceTrack.getCapabilities()/getSettings()
    → setInputMediaStreamTrack(sourceTrack)
  → setMute()
  → Room.publish(track)
  → _updateVideoPlayOption(view, {objectFit, mirror})
    → view 解析为一个或多个 DOM 容器
    → Track.play → HTMLVideoElement 或 Canvas/WebGL
```

### 5.2 `updateLocalVideo(config)` 的决策树

```text
当前 capture=true
  ├─ capture=false → stopCapture()
  ├─ cameraId      → switchDevice(cameraId)
  ├─ useFrontCamera→ switchDevice(user/environment)
  └─ videoTrack    → setInputMediaStreamTrack(customTrack)

当前 capture=false 且新 capture=true
  → 合并旧/新 cameraId、facingMode、customSource
  → capture(mergedConfig)

profile 更新
  → setProfile()
  → 若无需设备切换 → applyProfile()

播放属性更新
  → fillMode/mirror/rotation/contentHint

发布状态更新
  → Room.publish()/unpublish()
  → setMute()
  → deepMerge 保存配置
```

“修改分辨率”最终可能走 `MediaStreamTrack.applyConstraints()`，也可能因设备/浏览器兼容重采集；“修改码率”通常进入 `RTCRtpSender.setParameters()`。二者不能混为同一个 API。

### 5.3 `stopLocalVideo()`

已进房先 unpublish，再 stop/close Track、销毁 dispatcher、清引用。HTMLVideoElement、Canvas、WebGL、Worker 的具体释放在 Track/Player 的 `close/destroy` 下游完成。

## 6. 屏幕共享 API

### 6.1 `startScreenShare(config = {publish:true, view:null})`

| 参数 | 内部捕获配置 | 浏览器含义 |
|---|---|---|
| `option.profile` | ScreenTrack profile | 捕获后约束与 sender 参数 |
| `option.systemAudio` | `systemAudio=true` | 请求 getDisplayMedia 音频；浏览器/共享目标决定是否返回 |
| `echoCancellation/noiseSuppression/autoGainControl` | system audio config | 音频处理约束 |
| `videoTrack/audioTrack` | custom track | 跳过或替换浏览器返回 Track |
| `captureElement` | capture element | Region Capture/CropTarget 分支 |
| `preferDisplaySurface` | display preference | monitor/window/browser 偏好提示，不能强制用户选择 |
| `qosPreference` | contentHint | 屏幕内容编码倾向 |
| `muteSystemAudio` | audio track `enabled = !mute` | 不等于停止系统音频 Track |

```text
startScreenShare
  → new ScreenTrack(videoManager)
  → ScreenTrack.capture(displayConfig)
    → navigator.mediaDevices.getDisplayMedia()
    → stream.getVideoTracks()[0]
    → applyConstraints/profile
    → 可选 CropTarget.fromElement() + track.cropTo()
  → source videoTrack.addEventListener('ended', handler)
    → 用户从浏览器 UI 停止共享
    → _stopScreenShare()
    → emit('screen-share-stopped')
  → 若 stream.getAudioTracks()[0] 存在
    → new ScreenAudioTrack
    → setInputMediaStreamTrack(audioTrack)
    → enabled = !muteSystemAudio
  → publish video + optional audio
  → play(view)
```

### 6.2 `updateScreenShare`

该门面只直接处理：

- `fillMode`：播放器更新。
- `qosPreference`：`MediaStreamTrack.contentHint`。
- `publish`：视频和可选音频一起 publish/unpublish。
- `muteSystemAudio`：设置音频 Track `enabled`。
- `view`：重新绑定或停止播放器。

profile/捕获源的动态变化并没有在这个方法体中统一重采集，不能假设任意 start 参数都可通过 update 修改。

### 6.3 `_stopScreenShare`

```text
unpublish(video + audio)
  → screenVideo.stop()/close()
  → 若 screenAudio.echoCancellation === false：stopPlugin('AudioProcessor')
  → screenAudio.stop()/close()
  → audioManager.removeInput(screenAudio)
  → destroy video dispatcher
  → 清 Track/config 引用
```

## 7. 远端视频订阅与可见性

### 7.1 `startRemoteVideo({userId, streamType, view, option})`

```text
remotePublishedUserMap.get(userId)
  → streamType=main ? remoteVideoTrack : remoteAuxiliaryTrack
  → 绑定 decode-failed / video-size-changed / output-track-changed
  → option.small（仅 main）
    → setMediaType(大流/小流) + Room.changeType()
    → WebSocket subscription/change-type RPC
  → Room.subscribe(track)
    → MPC: 创建/复用该用户下行 PC，交换 subscribe SDP
    → SPC: 更新共享 PC 中该用户 MID/SSRC 订阅
  → RTCPeerConnection track 事件将 receiver track 注入 RemoteTrack
  → 可选解码失败降级插件
  → Track.play(view, objectFit/mirror/poster/canvasRender)
  → emit 对外 track 事件
  → 保存 remoteVideoConfigMap
  → 可选 _observeView()
```

### 7.2 `_observeView` 的精确算法

```text
view 未提供                         → 不处理
view=null/空数组/receive=false      → disconnect observer；确保订阅
需要按可见性接收
  → new IntersectionObserver(callback, {root:viewRoot})
  → 每个 entry 更新 visibleViewMap[target]=isIntersecting
  → clearTimeout(previous)
  → window.setTimeout(200 ms)
      任一 view 可见   → subscribe（尚未订阅时）
      全部 view 不可见 → unsubscribe（已订阅时）
  → 对移除的 view unobserve
  → 对新增 view observe
  → takeRecords() 合并尚未回调的记录
```

这里 200 ms 是可见性变化的合并窗口，避免滚动/布局抖动导致频繁信令和订阅切换。

### 7.3 `updateRemoteVideo` / `stopRemoteVideo`

- update 可改变 view、fillMode、mirror、大小流、draggable、可见性订阅。
- stop 先停止 player，再按远端 muteState 判断是否需要向 Room unsubscribe。
- `userId:'*'` 的批量停止来自方法装饰器，不在 `_stopRemoteVideo` 方法体中。
- 删除配置时会 `IntersectionObserver.disconnect()`。

## 8. 远端音频

### 8.1 `muteRemoteAudio(userId, muted)`

这里的 mute 语义是“停止/恢复接收与播放”，不是只把 `<audio>.muted` 设为 true：

```text
muted=true
  → _stopRemoteAudio
    → remoteAudioTrack.stop()
    → 若远端仍发布且允许发信令 → Room.unsubscribe(track)
    → 删除播放配置和 outTrack 映射
    → audioManager remove reference

muted=false
  → _startRemoteAudio → _doStartRemoteAudio
    → Room.subscribe(track)
    → _updateAudioPlayOption({volume})
    → HTMLAudioElement/Web Audio 播放
    → audioManager add reference
```

`userId:'*'` 的 stop 展开由 `_stopRemoteAudio` 装饰器完成；取消全体静音会遍历所有仍有音频的远端用户。

### 8.2 `setRemoteAudioVolume(userId, volume)`

- `'*'` 会更新默认值、已缓存用户值和所有已订阅 Track。
- 单用户值即使用户尚未发布也先缓存，后续 `_doStartRemoteAudio` 会读取。
- 播放层把百分比除以 100 后交给 `setAudioVolume`。
- 公开调用以 userId 为键做 200 ms 合并，连续拖动音量滑块不会每次都更新底层。

## 9. Track 获取、快照与扬声器

### 9.1 `getAudioTrack` / `getVideoTrack`

选择规则：

| userId | streamType | 返回对象 |
|---|---|---|
| 空 | audio main | 本地麦克风 Track |
| 空 | audio sub | 屏幕共享音频 Track |
| 空 | video main | 本地摄像头 Track |
| 空 | video sub | 本地屏幕 Track |
| 非空 | audio | 指定用户 remoteAudioTrack |
| 非空 | video main/sub | remoteVideoTrack / remoteAuxiliaryTrack |

默认返回源 `mediaTrack`。`processed:true` 且 `outMediaTrack !== mediaTrack` 时返回 `outMediaTrack.clone()`，调用者获得的是一个新 MediaStreamTrack，需要自行管理 clone 的 `stop()`。

### 9.2 `getVideoSnapshot`

```text
选择 Local/Remote + main/sub Track
  → Track.getVideoFrame()
  → VideoPlayer.getVideoFrame()
    ├─ 已使用 canvas 渲染 → canvas.toDataURL('image/png')
    └─ video element 渲染
       → document.createElement('canvas')
       → width/height = videoWidth/videoHeight
       → context2d.drawImage(video, 0, 0)
       → toDataURL('image/png')
```

没有 Track/Player 时返回空字符串。跨源媒体若污染 canvas，`toDataURL` 可能抛安全异常；RTC MediaStream 通常不是普通跨域 URL 资源。

### 9.3 `setCurrentSpeaker`

```text
enumerateDevices/checkDeviceAvailability
  → 找到匹配 audiooutput.deviceId
  → 保存 _speakerId
  → 本地音频、屏幕音频、全部远端音频 setAudioOutput(id)
  → Player.setSinkId(id)
  → HTMLMediaElement.setSinkId(id)（存在才调用）
  → emit device-changed {type:'speaker', action:'active'}
```

实例方法会打印弃用提示，推荐静态 `TRTC.setCurrentSpeaker`。没有 `setSinkId` 或 audiooutput 枚举能力的浏览器只能保留默认输出。

## 10. 插件、SEI 和自定义消息

### 10.1 `use/startPlugin/updatePlugin/stopPlugin`

- `use` 接受插件类或 `{plugin, assetsPath}`，以 `Plugin.Name` 去重。
- 构造插件时注入 TRTC、Room、assetsPath 和错误类型。
- `autoStart` 插件注册后立即走 `startPlugin`。
- `start/update/stopPlugin` 的第一个公开参数可以是名称；`lG(...)` 包装器会解析为实例，因此方法体才会直接出现 `e.start/e.update/e.stop`。
- 插件实际使用的 Web API 必须继续查具体插件类；不能因门面出现 `startPlugin` 就断言使用了 WebCodecs 或 WASM。

### 10.2 `sendSEIMessage(buffer, options)`

- 从 `_plugins` 取 `SEI` 插件；插件未注册时门面不会直接发送。
- 默认 `seiPayloadType:243`。
- `small` 根据本地视频 Track 的 small 状态补入。
- 装饰器限制调用频率和字节吞吐。
- 真正注入点位于 sender encoded transform/Worker 流程，不是 WebSocket 消息。

### 10.3 `sendCustomMessage({cmdId,data,...})`

本文件中的业务自定义消息链路是：

```text
SDK.sendCustomMessage
  → Room.sendCustomMessage
  → MessageManagerBase.send
    → Uint8Array(data)
    → String.fromCharCode(...bytes)
    → btoa(...)
    → 构造 {cmdId,msg,ordered:true,reliable:true,streamSeq}
    → SignalChannel.send(custom-message command)
    → JSON.stringify envelope
    → WebSocket.send(text)
```

接收方向：

```text
WebSocket message
  → JSON.parse
  → SignalChannel emit RECEIVE_CUSTOM_MSG
  → MessageManagerBase.onReceiveMsg
  → atob(msg) → Uint8Array → ArrayBuffer
  → 按 userId/cmdId/streamSeq 排序
  → 缺序号时最多等待 5 秒
  → Room custom-message
  → SDK EVENT.CUSTOM_MESSAGE
```

SPC 中确实另有 RTCDataChannel，但这条公开自定义消息实现走 WebSocket 信令，不能把两者混写。

## 11. 对外事件到浏览器源头

`TRTC.EVENT` 定义在 L30675-L30704。下表给出门面 `_listenEvents` 的主要来源；完整出现位置查 `Appendix-C-Event-Index.md`。

| 对外事件 | 直接内部来源 | 最终浏览器/协议来源 |
|---|---|---|
| `error` | Room/Track/Player/plugin error | WebSocket、PC state、DOMException、decode/play/capture failure |
| `autoplay-failed` | Track player error code PLAY_NOT_ALLOWED | `HTMLMediaElement.play()` Promise rejection |
| `kicked-out` | Room `banned` | WebSocket 服务端推送；随后 `_exitRoom` |
| `remote-user-enter/exit` | Room `peer-join/peer-leave` | WebSocket 用户列表/增量消息 |
| `remote-audio-available/unavailable` | remote publish state | WebSocket publish flag；后续可能触发 PC subscribe |
| `remote-video-available/unavailable` | remote publish state | WebSocket publish flag；主/辅流分别处理 |
| `audio-volume` | Room audio level evaluation | sender/receiver stats、Web Audio/track level、timer |
| `audio-frame` | audioManager | AudioWorklet/ScriptProcessor/encoded audio pipeline |
| `network-quality` | Room network quality | RTCPeerConnection.getStats + 服务端网络信息 |
| `connection-state-changed` | signal connection state | WebSocket open/close/reconnect 状态，不等同于 PC state |
| `audio-play-state-changed` | audio Track player | HTMLMediaElement/Web Audio 播放状态 |
| `video-play-state-changed` | video Track player | HTMLVideoElement/Canvas/WebGL 播放状态 |
| `screen-share-stopped` | screen source Track `ended` | 用户点击浏览器“停止共享”或 source 结束 |
| `device-changed` | device manager或 active device | `mediaDevices.devicechange`、enumerateDevices、switch success |
| `publish-state-changed` | LocalTrack publish state | WebSocket publish RPC + sender/PC 状态 |
| `track` | `_emitTrackEvent` | source/out MediaStreamTrack 建立或替换 |
| `statistics` | Room heartbeat report | getStats 累计/瞬时值 + WebSocket heartbeat |
| `sei-message` | encoded transform Worker | RTCRtpReceiver encoded frame/SEI parser |
| `custom-message` | MessageManager | WebSocket message + base64/排序恢复 |
| `video-decode-downgrade-state-changed` | decoder fallback plugin | 浏览器解码失败/软件解码插件状态 |
| `layerData` | Room layer data | 信令或 encoded processing 内部事件 |
| `first-video-frame` | Track first frame | video loaded/render frame/Canvas pipeline |
| `permission-state-change` | permission manager | Permissions `change` / capture permission result |
| `video-size-changed` | video Track | loadedmetadata/resize/track settings/frame dimensions |

### `on/off` 对 `audio-frame` 的特殊副作用

- 第一个 `audio-frame` listener 注册后，audioManager 为本地用户创建/启用 PCM 配置；若本地音频已开始，会立刻接入处理。
- 最后一个 listener 移除后，遍历 `getPCMAbortCtrlMap`，对每个 AbortController 调用 `abort('off')` 并清 Map。
- 因此 `on/off` 对普通事件只是 EventEmitter 操作，对 `audio-frame` 还控制真实音频处理资源。

## 12. WebSocket 与 WebRTC 的职责边界

| 功能 | WebSocket 控制面 | WebRTC 媒体面 |
|---|---|---|
| 进退房、角色、用户列表 | 是 | 否 |
| 发布/订阅意图 | 是，发送 RPC/状态 | 是，实际 sender/receiver/transceiver |
| SDP/能力参数 | 作为业务消息承载 | create/set description 执行 |
| 音视频字节 | 否 | RTP/RTCP/SRTP |
| 自定义消息（此公开 API） | 是 | 否；SPC DataChannel 是另一内部用途 |
| 网络质量 | 承载报告/服务端信息 | getStats 提供媒体与候选对数据 |
| 重连 | SignalChannel 重连并 rejoin | PC restart/recreate/update SDP |

业务链中没有把 ICE candidate 逐个作为 WebSocket 消息发送的明确实现。`addIceCandidate()` 的业务性调用出现在 H264 回环能力测试；adapter 层还有兼容定义。正式 MPC/SPC 主要通过 SDP/能力消息协作，不能套用通用教程后虚构 trickle-ICE 消息。

## 13. 从任意名称反查的固定路径

1. 看到公开 API：先在本文查总链，再进对应专项。
2. 看到源码内部方法：查 `Appendix-B-Source-Method-Index.md`，按行号确认同名方法所属类。
3. 看到浏览器 API：查 `Appendix-A-WebAPI-Occurrences.md`，获得所有调用点和所在方法。
4. 看到事件或 `on*` 属性：查 `Appendix-C-Event-Index.md`。
5. 最后回到专项，检查参数、状态、错误、事件回调和清理的完整闭环。

同名方法很多，例如 `initialize`、`close`、`publish`、`subscribe`。搜索时必须同时带源码行号或所属对象；仅凭方法名无法确定调用的是 Track、Transport、Room 还是 Player。

## 14. 学习时应保留的四个判断

1. 方法门面没有直接写 Web API，不代表没有使用；Web API 常在下游 Track/Transport/Player。
2. 方法体写了浏览器能力探测，不代表主业务一定走该分支；需要看 feature flag 和能力判断。
3. `Promise resolve`、SDK 状态事件、PC connected、首帧是不同完成点。
4. start 的逆过程不一定是 exit；本地 Track 的逆过程是 stop/close，而 exit 只结束房间会话。
