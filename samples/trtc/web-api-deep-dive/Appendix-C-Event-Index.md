# 附录 C 事件索引

> 本附录覆盖 EventTarget、DOM `on*` 属性和 SDK EventEmitter；事件的业务语义和生命周期以主线专题为准。
> 同时覆盖浏览器 EventTarget、DOM `on*` 属性和 SDK EventEmitter。事件参数若使用常量，索引保留常量表达式；其实际字符串值和 payload 结构在所属专项展开。
共识别 **318** 组“操作 + 事件表达式”。
| 事件操作 | 事件名/表达式 | 出现行号 | 典型所在方法 | 子系统/专项 |
|---|---|---|---|---|
| EventEmitter.emit | `'1'` | L23495, L28917, L45744 | `recapture — 重新捕获屏幕/设备；addUser — 方法；onHeartbeatReport — 心跳上报数据回调` | `05-MediaStreamTrack-Lifecycle.md / 05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md / 10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.emit | `'113'` | L34793 | `startLocalAudio — 采集本地麦克风音频并推送到房间` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `'114'` | L34835 | `stopLocalAudio — 停止本地麦克风音频采集并取消推送` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `'115'` | L35595 | `_doStartRemoteAudio — 内部：执行远端音频播放逻辑` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `'116'` | L35626 | `_stopRemoteAudio — 内部：停止远端音频播放` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `'155'` | L18499, L18513 | `observableCreate — 源码命名函数` | `07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `'156'` | L28397 | `play — 播放本地流（渲染到指定 DOM 元素）` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `'157'` | L28513 | `stop — 停止本地流播放` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `'2'` | L23367, L28940 | `updateDeviceIdInUse — 更新当前使用的设备 ID；deleteUser — 方法` | `05-MediaStreamTrack-Lifecycle.md / 05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `'262'` | L39804, L40073 | `getSenderStats — 获取发送端统计；getReceiverStats — 获取接收端统计` | `02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'263'` | L39827, L39840 | `getSenderStats — 获取发送端统计` | `02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'265'` | L31962 | `initWorkletNode — 方法` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.emit | `'266'` | L13834, L13847 | `构造函数；handleUploadFailed — 处理日志上传失败` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.emit | `'3'` | L29009 | `setRemotePublishedUserList — 设置远端已发布用户列表` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.emit | `'4'` | L23201, L23569, L23587, L23614 | `publish — 发布本地音视频流到房间；success — 操作成功回调；fail — 操作失败回调` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `'5'` | L23502, L28936, L28981 | `recapture — 重新捕获屏幕/设备；deleteUser — 方法；setRemotePublishedUserList — 设置远端已发布用户列表` | `05-MediaStreamTrack-Lifecycle.md / 05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `'6'` | L23301, L28938, L28983, L29004, L29010 | `asyncGeneratorWrap — 方法；deleteUser — 方法；setRemotePublishedUserList — 设置远端已发布用户列表` | `05-MediaStreamTrack-Lifecycle.md / 05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md / 08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.emit | `'61'` | L51755 | `success — 操作成功回调` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'7'` | L23458, L28991 | `onTrackEnded — 轨道结束回调；setRemotePublishedUserList — 设置远端已发布用户列表` | `05-MediaStreamTrack-Lifecycle.md / 05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `'audio-frame'` | L27691, L27707, L27735 | `handleLocalTrackStarted — 本地轨道开始回调；handleRemoteTrackStarted — 远端轨道开始回调` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `'audio-frame-with-ntp'` | L28140 | `decodeFrame — 解码视频帧` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `'audio-volume'` | L50840 | `enableAudioVolumeEvaluation — 开启/关闭音量回调通知（设置回调间隔，单位 ms）` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'banned'` | L50035 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'closed'` | L37455, L47518 | `close — 关闭本地流并释放所有轨道` | `02-RTCPeerConnection-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.emit | `'connection-state-changed'` | L37541, L37941, L37942, L38593, L38595, L38596, L38598, L38698, L38699, L38840, L47532, L47935, L47937, L47938, L47940, L48359, L48901, L48902 | `emitConnectionStateChangedEvent — 发射连接状态变化事件；publishByTransceiver — 通过 addTransceiver API 推流；unpublish — 取消发布本地音视频流` | `02-RTCPeerConnection-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.emit | `'custom-message'` | L49980 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'data_channel_msg'` | L46243 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.emit | `'decode-downgrade-state-changed'` | L28562 | `onDecodeDowngradeStateChanged — 解码降级状态变化回调` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `'decode-failed'` | L27986 | `reportDecodeResult — 方法` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `'disconnect'` | L25911 | `disconnect — 断开 WebSocket 信令连接` | `07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `'dump'` | L46150, L49754 | `initScriptTransformWorker — 初始化脚本转换 Worker；initSinglePC — 初始化单 RTCPeerConnection 模式（主播推流）` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md / 03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'error'` | L20177, L37521, L37723, L44135, L44146, L46453, L49998, L50312, L50583 | `handleAutoPlayFailed — 处理自动播放失败（用户交互后恢复）；onConnectionStateChange — 连接状态变化回调；beforeReconnect — 重连前处理；initializeGlVideoContext — 初始化 WebGL 视频渲染上下文；reconnect — 重新建立信令连接；另 3 个` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md / 02-RTCPeerConnection-usage-analysis.md / 10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md / 03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'firewall-restriction'` | L37661, L50320, L50576 | `waitForPeerConnectionConnected — 等待 PeerConnection 连接成功；installDownlinkEvents — 安装下行连接的事件监听；_initUplinkConnection — 初始化上行推流连接` | `02-RTCPeerConnection-usage-analysis.md / 03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'first-video-frame'` | L20209, L28374 | `s — 内部函数；构造函数` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md / 05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `'input-media-track-changed'` | L20094 | `setInputMediaStreamTrack — 设置输入 MediaStreamTrack` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `'local-publish-flag-changed'` | L50244, L50261 | `onPublishedUserList — 收到已发布用户列表后的处理` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'media-connection-state-changed'` | L50316, L50572 | `installDownlinkEvents — 安装下行连接的事件监听；_initUplinkConnection — 初始化上行推流连接` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'message'` | L49510, L49548 | `onReceiveMsg — 收到消息回调；emitMessage — 发射消息事件` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.emit | `'network-quality'` | L49988 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'ntp-time-updated'` | L51557 | `startUpdateNTPTime — 启动 NTP 时间同步` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'output-media-track-changed'` | L20117 | `setOutputMediaStreamTrack — 设置输出 MediaStreamTrack` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `'output-track-changed'` | L44324 | `_setMainOutput — 方法` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.emit | `'peer-join'` | L49690 | `join — 加入 TRTC 房间，初始化连接并开始信令通信` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'peer-leave'` | L49694 | `join — 加入 TRTC 房间，初始化连接并开始信令通信` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'permission-state-change'` | L34051 | `构造函数` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.emit | `'player-state-changed'` | L19786 | `构造函数` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `'rejectionHandled'` | L2691 | `zh — 源码命名函数` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `'remote-publish-changed'` | L28015 | `onFlagChanged — 标志位变化回调` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `'remote-publish-state-changed'` | L49703 | `join — 加入 TRTC 房间，初始化连接并开始信令通信` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'remote-published'` | L50292 | `createDownlinkConnection — 创建下行拉流连接（接收远端流）` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'remote-unpublished'` | L50301 | `closeDownLinkConnection — 关闭指定下行连接` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'render'` | L26549, L44360, L44397 | `构造函数；update — 方法` | `07-Media-Playback-and-Rendering.md / 10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.emit | `'sei-message'` | L46149, L49753 | `initScriptTransformWorker — 初始化脚本转换 Worker；initSinglePC — 初始化单 RTCPeerConnection 模式（主播推流）` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md / 03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'signal-connection-state-changed'` | L49994 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'spc-reconnected'` | L46427 | `reconnect — 重新建立信令连接` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.emit | `'state-changed'` | L32837 | `onPressureChange — 网络压力变化回调` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.emit | `'subscribe-small-video-changed'` | L51332 | `changeType — 修改订阅流类型（大小流切换）` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `'track'` | L46227 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.emit | `'unhandledRejection'` | L2673 | `Jh — 源码命名函数` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `Bx.ERROR` | L17720, L17754 | `handleElementEvent — 处理 DOM 元素事件；replayByRecreateMediaStream — 重新播放（重建 MediaStream）` | `07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `Bx.LOADED_DATA` | L17724 | `handleElementEvent — 处理 DOM 元素事件` | `07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `Bx.LOADED_META_DATA` | L17727 | `handleElementEvent — 处理 DOM 元素事件` | `07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `Bx.MEDIA_TRACK_CHANGED` | L18355, L19605, L19646 | `setTrack — 方法` | `07-Media-Playback-and-Rendering.md / 04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `Bx.PLAYER_STATE_CHANGED` | L17877, L17894, L17910 | `success — 操作成功回调` | `07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `Bx.RESIZE` | L18264 | `handleElementEvent — 处理 DOM 元素事件` | `07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `Bx.TIME_UPDATE` | L19499 | `initializeElement — 方法` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `Events.AUDIO_LEVEL_INTERVAL` | L50815 | `enableAudioVolumeEvaluation — 开启/关闭音量回调通知（设置回调间隔，单位 ms）` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.AUTOPLAY_DIALOG_CLICK_CONFIRM` | L18069 | `onConfirm — 确认按钮回调` | `07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `Events.HEARTBEAT_REPORT` | L50204 | `doHeartbeat — 执行一次心跳检测并上报状态` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.JOIN_FAILED` | L51696 | `onError — 错误处理回调` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.JOIN_RECEIVED_CMD_RES` | L49834 | `asyncGeneratorWrap — 方法` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.JOIN_SCHEDULE_SUCCESS` | L45303 | `schedule — 调度任务` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.emit | `Events.JOIN_SEND_CMD` | L49824 | `asyncGeneratorWrap — 方法` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.JOIN_SIGNAL_CONNECTION_END` | L49785, L50069, L50073 | `asyncGeneratorWrap — 方法；initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.JOIN_SIGNAL_CONNECTION_START` | L50071 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.JOIN_START` | L51657 | `onError — 错误处理回调` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.JOIN_SUCCESS` | L51684 | `onError — 错误处理回调` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.LEAVE_SEND_CMD` | L50098 | `leave — 离开当前房间` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.LEAVE_START` | L51725 | `success — 操作成功回调` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.LEAVE_SUCCESS` | L51727 | `success — 操作成功回调` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.LOCAL_TRACK_CAPTURE_FAILED` | L23157 | `capture — 捕获当前帧` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `Events.LOCAL_TRACK_CAPTURE_START` | L23140 | `capture — 捕获当前帧` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `Events.LOCAL_TRACK_CAPTURE_SUCCESS` | L23150 | `capture — 捕获当前帧` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `Events.LOCAL_TRACK_PUBLISHED` | L23568 | `success — 操作成功回调` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `Events.LOCAL_TRACK_RECAPTURE` | L23496, L23503 | `recapture — 重新捕获屏幕/设备` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `Events.LOCAL_TRACK_REPLACED` | L50664 | `replaceTrack — 替换本地流中的指定轨道` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.LOCAL_TRACK_UNPUBLISHED` | L23322 | `unpublish — 取消发布本地音视频流` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `Events.LOG` | L14066 | `addLogToQueue — 方法` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.emit | `Events.NETWORK_QUALITY` | L41083 | `start — 启动组件/模块（开始工作流程）` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.emit | `Events.PEER_CONNECTION_STATE_CHANGED` | L37535, L47526 | `emitConnectionStateChangedEvent — 发射连接状态变化事件` | `02-RTCPeerConnection-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.emit | `Events.PLAYER_STATE_CHANGED` | L19785 | `构造函数` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `Events.PLAY_TRACK_START` | L19893 | `play — 播放本地流（渲染到指定 DOM 元素）` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `Events.PUBLISH_FAILED` | L51776 | `onError — 错误处理回调` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.RECEIVED_PUBLISHED_USER_LIST` | L50259 | `onPublishedUserList — 收到已发布用户列表后的处理` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.REMOTE_PUBLISH_STATE_CHANGED` | L49702 | `join — 加入 TRTC 房间，初始化连接并开始信令通信` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.REMOTE_TRACK_SUBSCRIBED` | L28045 | `success — 操作成功回调` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `Events.REMOTE_TRACK_UNSUBSCRIBED` | L28063 | `success — 操作成功回调` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `Events.ROOM_DESTROY` | L45263 | `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.emit | `Events.SEND_FIRST_VIDEO_FRAME` | L39567, L48647 | `handleConnectionStateChange — 处理连接状态变化` | `02-RTCPeerConnection-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.emit | `Events.SIGNAL_CONNECTION_STATE_CHANGED` | L49993 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.SINGLE_CONNECTION_STAT` | L46526 | `onConnectionStateChange — 连接状态变化回调` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.emit | `Events.SPC_RECONNECTED` | L46426 | `reconnect — 重新建立信令连接` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.emit | `Events.SUBSCRIBE_FAILED` | L51859 | `onError — 错误处理回调` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.SUBSCRIBE_START` | L50734 | `subscribe — 订阅远端用户的音视频流` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.SUBSCRIBE_SUCCESS` | L50745 | `subscribe — 订阅远端用户的音视频流` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.SWITCH_DEVICE_SUCCESS` | L23772, L24517 | `switchDevice — 切换采集设备` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `Events.SWITCH_ROOM_FAILED` | L51486 | `switchRoom — 切换房间，保持当前已发布的音视频流不变，直接切换到目标房间` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.SWITCH_ROOM_START` | L51469 | `switchRoom — 切换房间，保持当前已发布的音视频流不变，直接切换到目标房间` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.SWITCH_ROOM_SUCCESS` | L51490 | `switchRoom — 切换房间，保持当前已发布的音视频流不变，直接切换到目标房间` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.UNSUBSCRIBE_SUCCESS` | L50797 | `unsubscribe — 取消订阅远端用户的音视频流` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.emit | `Events.VIDEO_LOADED_DATA` | L19810 | `构造函数` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `FSM.STATECHANGED` | L16867 | `dispatchStateChange — 内部函数` | `10-Auxiliary-Browser-APIs.md` |
| EventEmitter.emit | `IH.UNAVAILABLE` | L26079 | `success — 操作成功回调` | `07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `MSG_TYPE_1` | L37030 | `onmessage — 收到消息事件回调` | `03-WebSocket-usage-analysis.md` |
| EventEmitter.emit | `MSG_TYPE_2` | L37327 | `emitConnectionStateChanged — 发射连接状态变化事件` | `03-WebSocket-usage-analysis.md` |
| EventEmitter.emit | `MSG_TYPE_3) : e === 'DISCONNECTED' && this.emit(MSG_TYPE_6` | L37329 | `emitConnectionStateChanged — 发射连接状态变化事件` | `03-WebSocket-usage-analysis.md` |
| EventEmitter.emit | `MSG_TYPE_5` | L36985, L36999, L37042 | `onclose — 连接关闭事件回调；onerror — 连接错误事件回调；onmessage — 收到消息事件回调` | `03-WebSocket-usage-analysis.md` |
| EventEmitter.emit | `MSG_TYPE_7` | L37270 | `close — 关闭本地流并释放所有轨道` | `03-WebSocket-usage-analysis.md` |
| EventEmitter.emit | `MSG_TYPE_8` | L37008 | `onmessage — 收到消息事件回调` | `03-WebSocket-usage-analysis.md` |
| EventEmitter.emit | `String(a` | L37063 | `onmessage — 收到消息事件回调` | `03-WebSocket-usage-analysis.md` |
| EventEmitter.emit | `XJ.CONNECTION_STATE_CHANGED` | L46556 | `emitConnectionStateChangedEvent — 发射连接状态变化事件` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.emit | `XJ.FIREWALL_RESTRICTION` | L46642 | `waitForPeerConnectionConnected — 等待 PeerConnection 连接成功` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.emit | `a` | L37060 | `onmessage — 收到消息事件回调` | `03-WebSocket-usage-analysis.md` |
| EventEmitter.emit | `a ? transportWrapper.REMOTE_VIDEO_AVAILABLE : transportWrapper.REMOTE_VIDEO_UNAVAILABLE` | L34383 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `dH.RENDER` | L25334 | `render — 渲染视频帧到画布` | `07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `e` | L35420 | `emit — 触发事件通知所有注册的监听器` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `e ? 'mute' : 'unmute'` | L20043 | `setMute — 设置静音状态` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `e ? Events.TRACK_MUTED : Events.TRACK_UNMUTED` | L20044 | `setMute — 设置静音状态` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.emit | `e.EVENT_NETWORK_QUALITY` | L41103 | `start — 启动组件/模块（开始工作流程）` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.emit | `e.RENDER` | L25204, L25206 | `draw2d — 2D 绘制` | `07-Media-Playback-and-Rendering.md` |
| EventEmitter.emit | `i` | L19182, L19191 | `update — 方法` | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| EventEmitter.emit | `i.hasAuxiliary ? transportWrapper.REMOTE_VIDEO_AVAILABLE : transportWrapper.REMOTE_VIDEO_UNAVAILABLE` | L34394 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `s ? transportWrapper.REMOTE_AUDIO_AVAILABLE : transportWrapper.REMOTE_AUDIO_UNAVAILABLE` | L34389 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `stateStr` | L16866 | `dispatchStateChange — 内部函数` | `10-Auxiliary-Browser-APIs.md` |
| EventEmitter.emit | `t.kind === StreamConstants.AUDIO ? transportWrapper.AUDIO_PLAY_STATE_CHANGED : transportWrapper.V...` | L34348 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.AUDIO_FRAME` | L33902, L33913, L34477 | `enableAudioFrameEvent — 启用音频帧事件通知；_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md / 00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.AUDIO_PLAY_STATE_CHANGED` | L34787 | `startLocalAudio — 采集本地麦克风音频并推送到房间` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.AUDIO_VOLUME` | L34221 | `构造函数` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.AUTOPLAY_FAILED` | L32308, L34353 | `handleAutoPlayFailed — 处理自动播放失败（用户交互后恢复）；_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md / 00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.CONNECTION_STATE_CHANGED` | L34329 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.CUSTOM_MESSAGE` | L34468 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.DEVICE_CHANGED` | L34482, L34486, L34490, L34494, L34502, L34509, L34518, L34525, L34772, L34893, L35534, L35929, L35935, L36079 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件；asyncGeneratorWrap — 方法；startLocalAudio — 采集本地麦克风音频并推送到房间；startLocalVideo — 采集本地摄像头视频并推送到房间；setCurrentSpeaker — 设置扬声器设备（音频输出设备 ID）；另 2 个` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.ERROR` | L34324, L34405, L34768, L34889, L35181, L35570 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件；startLocalAudio — 采集本地麦克风音频并推送到房间；startLocalVideo — 采集本地摄像头视频并推送到房间；startRemoteVideo — 开始播放远端视频（触发订阅远端流）；_doStartRemoteAudio — 内部：执行远端音频播放逻辑` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.FIRST_VIDEO_FRAME` | L34473, L34885, L35046 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件；startLocalVideo — 采集本地摄像头视频并推送到房间；stopLocalVideo — 停止本地摄像头视频采集并取消推送` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.KICKED_OUT` | L34317 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.LAYER_DATA` | L34470 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.NETWORK_QUALITY` | L34336 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.PERMISSION_STATE_CHANGE` | L34530 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.PUBLISH_STATE_CHANGED` | L34778, L34899, L35042 | `startLocalAudio — 采集本地麦克风音频并推送到房间；startLocalVideo — 采集本地摄像头视频并推送到房间；stopLocalVideo — 停止本地摄像头视频采集并取消推送` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.REMOTE_USER_ENTER` | L34306 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.REMOTE_USER_EXIT` | L34310 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.SCREEN_SHARE_STOPPED` | L35072 | `stopLocalVideo — 停止本地摄像头视频采集并取消推送` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.SEI_MESSAGE` | L33034, L34401 | `decode — 解码视频/音频数据；_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md / 00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.STATISTICS` | L34464 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.TRACK` | L35757 | `_emitTrackEvent — 内部：向外部发射轨道状态事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.VIDEO_DECODE_DOWNGRADE_STATE_CHANGED` | L35659 | `_enableVideoDecodeFallback — 内部：切换视频解码降级策略（软解/硬解）` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.VIDEO_PLAY_STATE_CHANGED` | L34908, L35088 | `startLocalVideo — 采集本地摄像头视频并推送到房间；stopLocalVideo — 停止本地摄像头视频采集并取消推送` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.emit | `transportWrapper.VIDEO_SIZE_CHANGED` | L34912, L35185 | `startLocalVideo — 采集本地摄像头视频并推送到房间；startRemoteVideo — 开始播放远端视频（触发订阅远端流）` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.on | `'"` | L15229 | `CATCH_HANDLER_ERROR — 方法` | `10-Auxiliary-Browser-APIs.md` |
| EventEmitter.on | `'".concat(t` | L29621 | `EVENT_HANDLER_ERROR — 方法` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.on | `'1'` | L45925, L49688 | `构造函数；join — 加入 TRTC 房间，初始化连接并开始信令通信` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md / 03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `'102'` | L15363, L35936 | `构造函数；_initActiveSpeaker — 内部：初始化活跃发言人检测逻辑` | `10-Auxiliary-Browser-APIs.md / 00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.on | `'103'` | L15369 | `构造函数` | `10-Auxiliary-Browser-APIs.md` |
| EventEmitter.on | `'104'` | L32014 | `installEvent — 安装单个事件监听器` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.on | `'113'` | L27756 | `installEvent — 安装单个事件监听器` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `'114'` | L27757, L32015 | `installEvent — 安装单个事件监听器` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md / 08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.on | `'115'` | L27758 | `installEvent — 安装单个事件监听器` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `'116'` | L27759 | `installEvent — 安装单个事件监听器` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `'154'` | L32305 | `handleAutoPlayFailed — 处理自动播放失败（用户交互后恢复）` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.on | `'2'` | L34770, L34891, L49692 | `startLocalAudio — 采集本地麦克风音频并推送到房间；startLocalVideo — 采集本地摄像头视频并推送到房间；join — 加入 TRTC 房间，初始化连接并开始信令通信` | `00-Reading-Guide-and-Source-Map.md / 03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `'201'` | L30906 | `generateRoomConfig — 内部函数` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.on | `'202'` | L30910 | `generateRoomConfig — 内部函数` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.on | `'22'` | L13829 | `构造函数` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.on | `'262'` | L45697 | `构造函数` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.on | `'266'` | L13836, L15375 | `构造函数` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.on | `'28'` | L30903 | `generateRoomConfig — 内部函数` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.on | `'3'` | L49696 | `join — 加入 TRTC 房间，初始化连接并开始信令通信` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `'4'` | L34774, L34895, L35038 | `startLocalAudio — 采集本地麦克风音频并推送到房间；startLocalVideo — 采集本地摄像头视频并推送到房间；stopLocalVideo — 停止本地摄像头视频采集并取消推送` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.on | `'5'` | L34766, L34887, L49697 | `startLocalAudio — 采集本地麦克风音频并推送到房间；startLocalVideo — 采集本地摄像头视频并推送到房间；join — 加入 TRTC 房间，初始化连接并开始信令通信` | `00-Reading-Guide-and-Source-Map.md / 03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `'6'` | L34780, L34901, L49698 | `startLocalAudio — 采集本地麦克风音频并推送到房间；startLocalVideo — 采集本地摄像头视频并推送到房间；join — 加入 TRTC 房间，初始化连接并开始信令通信` | `00-Reading-Guide-and-Source-Map.md / 03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `'63'` | L30904 | `generateRoomConfig — 内部函数` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.on | `'7'` | L24623 | `fallbackProfile — 降级编码 Profile` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.on | `'84'` | L30905 | `generateRoomConfig — 内部函数` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.on | `'audio-volume'` | L34176 | `构造函数` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.on | `'audioInputAdded'` | L23818 | `handleMicrophoneRemoved — 麦克风拔出事件回调` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.on | `'audioInputRemoved'` | L23792 | `listenDeviceChange — 监听设备插拔事件` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.on | `'closed'` | L38480, L39679, L49410 | `n — 源码命名函数` | `02-RTCPeerConnection-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.on | `'connection-state-changed'` | L37665, L38572, L47895, L50314, L50570 | `waitForPeerConnectionConnected — 等待 PeerConnection 连接成功；installEvents — 安装事件监听器；installDownlinkEvents — 安装下行连接的事件监听；_initUplinkConnection — 初始化上行推流连接` | `02-RTCPeerConnection-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md / 03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `'decode-failed'` | L35179, L35568, L48878 | `startRemoteVideo — 开始播放远端视频（触发订阅远端流）；_doStartRemoteAudio — 内部：执行远端音频播放逻辑；installEvents — 安装事件监听器` | `00-Reading-Guide-and-Source-Map.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.on | `'disconnect'` | L24886 | `构造函数` | `07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `'dump'` | L49754 | `initSinglePC — 初始化单 RTCPeerConnection 模式（主播推流）` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `'error'` | L34223, L43923, L50307, L50578 | `构造函数；asyncGeneratorWrap — 方法；installDownlinkEvents — 安装下行连接的事件监听；_initUplinkConnection — 初始化上行推流连接` | `00-Reading-Guide-and-Source-Map.md / 10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md / 03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `'firewall-restriction'` | L50318, L50574 | `installDownlinkEvents — 安装下行连接的事件监听；_initUplinkConnection — 初始化上行推流连接` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `'heartbeat-report'` | L28470, L45710, L47675 | `useCanvasPlayer — 使用 Canvas 播放器；onVideoCodecChanged — 视频编码器切换回调；start — 启动组件/模块（开始工作流程）` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md / 10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.on | `'input-media-track-changed'` | L24304, L27697 | `构造函数；handleLocalTrackStarted — 本地轨道开始回调` | `05-MediaStreamTrack-Lifecycle.md / 05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `'message'` | L49978 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `'mute'` | L38764, L48288 | `installTrackMuteEvents — 安装轨道静音状态事件监听器` | `02-RTCPeerConnection-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.on | `'output-media-track-changed'` | L26689, L35745 | `addCameraSource — 添加摄像头源；_listenOutputTrackChanged — 内部：监听输出轨道切换事件` | `07-Media-Playback-and-Rendering.md / 00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.on | `'peer-join'` | L49520 | `onReceiveMsg — 收到消息回调` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.on | `'peer-leave'` | L49446 | `构造函数` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.on | `'publish'` | L24305 | `构造函数` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.on | `'sei-message'` | L49753 | `initSinglePC — 初始化单 RTCPeerConnection 模式（主播推流）` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `'spc-reconnected'` | L47906, L48877 | `installSPCEvents — 安装单连接模式事件监听器；installEvents — 安装事件监听器` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.on | `'track'` | L48875 | `installEvents — 安装事件监听器` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.on | `'unmute'` | L38765, L48289 | `installTrackMuteEvents — 安装轨道静音状态事件监听器` | `02-RTCPeerConnection-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.on | `'video-size-changed'` | L35183 | `startRemoteVideo — 开始播放远端视频（触发订阅远端流）` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.on | `'videoCodecInfo'` | L43941 | `asyncGeneratorWrap — 方法` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.on | `'videoFrame'` | L43905, L43942, L43958, L43966 | `asyncGeneratorWrap — 方法` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.on | `'videoInputAdded'` | L24688 | `handleCameraRemoved — 摄像头拔出事件回调` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.on | `'videoInputRemoved'` | L24664 | `listenDeviceChange — 监听设备插拔事件` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.on | `Bx.ERROR` | L19833 | `构造函数` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.on | `Bx.LOADED_DATA` | L19808 | `构造函数` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.on | `Bx.LOADED_META_DATA` | L19812 | `构造函数` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.on | `Bx.MEDIA_TRACK_CHANGED` | L19816 | `构造函数` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.on | `Bx.PLAYER_STATE_CHANGED` | L19782 | `构造函数` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.on | `Bx.RESIZE` | L19822 | `构造函数` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.on | `Events.AUDIO_CONTEXT_LONG_SUSPENDED` | L23666 | `构造函数` | `05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.on | `Events.AUDIO_LEVEL_INTERVAL` | L18986 | `构造函数` | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| EventEmitter.on | `Events.AUTOPLAY_DIALOG_CLICK_CONFIRM` | L17651 | `bindAutoPlayEvent — 绑定自动播放事件` | `07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `Events.JOIN_SCHEDULE_SUCCESS` | L13877 | `installEvents — 安装事件监听器` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.on | `Events.JOIN_START` | L13887 | `installEvents — 安装事件监听器` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.on | `Events.JOIN_SUCCESS` | L28726 | `validateSingleParamRule — 内部函数` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `Events.LEAVE_START` | L28732 | `validateSingleParamRule — 内部函数` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `Events.LEAVE_SUCCESS` | L13893, L36496, L37665, L46655 | `installEvents — 安装事件监听器；构造函数；waitForPeerConnectionConnected — 等待 PeerConnection 连接成功` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md / 00-Reading-Guide-and-Source-Map.md / 02-RTCPeerConnection-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.on | `Events.LOCAL_TRACK_PUBLISHED` | L28738 | `validateSingleParamRule — 内部函数` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `Events.LOCAL_TRACK_RECAPTURE` | L28867 | `validateSingleParamRule — 内部函数` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `Events.LOCAL_TRACK_REPLACED` | L28802 | `validateSingleParamRule — 内部函数` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `Events.LOCAL_TRACK_UNPUBLISHED` | L28749 | `validateSingleParamRule — 内部函数` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `Events.PEER_CONNECTION_STATE_CHANGED` | L28826 | `validateSingleParamRule — 内部函数` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `Events.REMOTE_TRACK_SUBSCRIBED` | L28778 | `validateSingleParamRule — 内部函数` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `Events.REMOTE_TRACK_UNSUBSCRIBED` | L28787 | `validateSingleParamRule — 内部函数` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `Events.ROOM_DESTROY` | L29034 | `createRateLimitDecorator — 内部函数` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventEmitter.on | `Events.SIGNAL_CONNECTION_STATE_CHANGED` | L28808 | `validateSingleParamRule — 内部函数` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `Events.SWITCH_DEVICE_SUCCESS` | L23628, L28796 | `fail — 操作失败回调；validateSingleParamRule — 内部函数` | `05-MediaStreamTrack-Lifecycle.md / 05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `Events.SWITCH_ROOM_SUCCESS` | L36497 | `构造函数` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.on | `Events.TRACK_MUTED` | L28760 | `validateSingleParamRule — 内部函数` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `Events.TRACK_UNMUTED` | L28769 | `validateSingleParamRule — 内部函数` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `Events.VIDEO_CODEC_IMPLEMENTATION_CHANGED` | L28845 | `validateSingleParamRule — 内部函数` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.on | `MSG_TYPE_2` | L40870 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `XJ.CONNECTION_STATE_CHANGED` | L46656, L49917 | `waitForPeerConnectionConnected — 等待 PeerConnection 连接成功；reJoin — 断开后重新加入房间` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md / 03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `_j.JOIN_ROOM_RESULT` | L37318 | `stopKeepAliveIn — 停止内部保活机制` | `03-WebSocket-usage-analysis.md` |
| EventEmitter.on | `_j.RECEIVE_CUSTOM_MSG` | L49445 | `构造函数` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.on | `_j.UPLINK_NETWORK_STATS` | L40866 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `dH.RENDER` | L26547, L44356, L44393 | `构造函数；update — 方法` | `07-Media-Playback-and-Rendering.md / 10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.on | `e` | L17212, L35396, L37740, L41328 | `createEventDispatcher — 内部函数；on — 注册事件监听器；addEvent — 添加事件` | `10-Auxiliary-Browser-APIs.md / 00-Reading-Guide-and-Source-Map.md / 02-RTCPeerConnection-usage-analysis.md / 10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.on | `fJ.EVENT_NETWORK_QUALITY` | L49984 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.on | `n` | L37190 | `sendWaitForResponse — 发送请求并等待响应` | `03-WebSocket-usage-analysis.md` |
| EventEmitter.on | `receiverWrapper.UNAVAILABLE` | L43935, L44131, L44273 | `asyncGeneratorWrap — 方法；initializeGlVideoContext — 初始化 WebGL 视频渲染上下文；setSmallVideo — 设置小流视频轨道` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.on | `t` | L21771, L42337, L42551 | `fromEventObservable — 内部函数；installEvents — 安装事件监听器` | `00-Reading-Guide-and-Source-Map.md / 10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.on | `transportWrapper.SEI_MESSAGE` | L34533 | `_listenEvents — 内部：监听房间层事件并转发为 SDK 对外事件` | `00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.once | `'banned'` | L41336 | `installEvents — 安装事件监听器` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.once | `'error'` | L46672, L49755 | `waitForReconnected — 等待重连完成；initSinglePC — 初始化单 RTCPeerConnection 模式（主播推流）` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md / 03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.once | `'first-video-frame'` | L28372, L34883, L35044 | `构造函数；startLocalVideo — 采集本地摄像头视频并推送到房间；stopLocalVideo — 停止本地摄像头视频采集并取消推送` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md / 00-Reading-Guide-and-Source-Map.md` |
| EventEmitter.once | `'input-media-track-changed'` | L27915 | `waitHasMediaTrack — 等待媒体轨道就绪` | `05-MediaStreamTrack-Lifecycle.md / 07-Media-Playback-and-Rendering.md` |
| EventEmitter.once | `'spc-reconnected'` | L46672 | `waitForReconnected — 等待重连完成` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.once | `Events.JOIN_RECEIVED_CMD_RES` | L45170, L45296 | `setProxyServer — 设置代理服务器；schedule — 调度任务` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventEmitter.once | `Events.LOCAL_TRACK_CAPTURE_SUCCESS` | L20171 | `handleAutoPlayFailed — 处理自动播放失败（用户交互后恢复）` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventEmitter.once | `MSG_TYPE_1` | L50067 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.once | `MSG_TYPE_3` | L37733, L46404 | `beforeReconnect — 重连前处理；reconnect — 重新建立信令连接` | `02-RTCPeerConnection-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventEmitter.once | `MSG_TYPE_5` | L49783 | `asyncGeneratorWrap — 方法` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventEmitter.once | `MSG_TYPE_7` | L37173 | `sendWaitForResponse — 发送请求并等待响应` | `03-WebSocket-usage-analysis.md` |
| EventEmitter.once | `MSG_TYPE_8` | L37211 | `sendWaitForResponseWithRetry — 发送请求并等待响应（带重试）` | `03-WebSocket-usage-analysis.md` |
| EventEmitter.once | `_j.JOIN_ROOM_RESULT` | L49826 | `asyncGeneratorWrap — 方法` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md` |
| EventTarget.addEventListener | `'addstream'` | L7067, L8234 | `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）；XC — 源码命名函数` | `02-RTCPeerConnection-usage-analysis.md` |
| EventTarget.addEventListener | `'addtrack'` | L7036 | `RTCPeerConnection.prototype.setRemoteDescription — 设置远端 SDP 描述（跨浏览器适配）` | `02-RTCPeerConnection-usage-analysis.md` |
| EventTarget.addEventListener | `'change'` | L34080 | `get — HTTP GET 请求便捷封装` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| EventTarget.addEventListener | `'click'` | L18502, L18539, L20170 | `observableCreate — 源码命名函数；resumeAudioContext — 内部函数；handleAutoPlayFailed — 处理自动播放失败（用户交互后恢复）` | `07-Media-Playback-and-Rendering.md / 04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventTarget.addEventListener | `'close'` | L36931 | `bindSocket — 绑定 WebSocket 实例到连接管理器` | `03-WebSocket-usage-analysis.md` |
| EventTarget.addEventListener | `'connectionstatechange'` | L9335 | `pb — 源码命名函数` | `02-RTCPeerConnection-usage-analysis.md` |
| EventTarget.addEventListener | `'contextlost'` | L26108 | `create — 方法` | `07-Media-Playback-and-Rendering.md` |
| EventTarget.addEventListener | `'contextrestored'` | L26112 | `create — 方法` | `07-Media-Playback-and-Rendering.md` |
| EventTarget.addEventListener | `'devicechange'` | L19220 | `构造函数` | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| EventTarget.addEventListener | `'error'` | L36932 | `bindSocket — 绑定 WebSocket 实例到连接管理器` | `03-WebSocket-usage-analysis.md` |
| EventTarget.addEventListener | `'icecandidate'` | L16119, L16120 | `asyncGeneratorWrap — 方法` | `10-Auxiliary-Browser-APIs.md` |
| EventTarget.addEventListener | `'iceconnectionstatechange'` | L9362 | `pb — 源码命名函数` | `02-RTCPeerConnection-usage-analysis.md` |
| EventTarget.addEventListener | `'message'` | L2373, L36933 | `nu — 源码命名函数；bindSocket — 绑定 WebSocket 实例到连接管理器` | `00-Reading-Guide-and-Source-Map.md / 03-WebSocket-usage-analysis.md` |
| EventTarget.addEventListener | `'pagehide'` | L41335 | `installEvents — 安装事件监听器` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventTarget.addEventListener | `'track'` | L7021 | `kC — 源码命名函数` | `02-RTCPeerConnection-usage-analysis.md` |
| EventTarget.addEventListener | `'typechange'` | L12095 | `getNetworkType — 检测当前网络类型（wifi/4g/3g/ethernet 等）` | `10-Auxiliary-Browser-APIs.md` |
| EventTarget.addEventListener | `'visibilitychange'` | L17150, L18536, L19693, L20512, L25364, L42759 | `n — 内部函数；resumeAudioContext — 内部函数；setVolume — 设置音量；AU — 源码命名函数；update — 方法；另 1 个` | `10-Auxiliary-Browser-APIs.md / 07-Media-Playback-and-Rendering.md / 04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md / 00-Reading-Guide-and-Source-Map.md / 07-Media-Playback-and-Rendering.md / 10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventTarget.addEventListener | `'webglcontextlost'` | L25968 | `create — 方法` | `07-Media-Playback-and-Rendering.md` |
| EventTarget.addEventListener | `StreamConstants.ENDED` | L23108, L35070 | `installTrackEvent — 安装轨道事件监听器；stopLocalVideo — 停止本地摄像头视频采集并取消推送` | `05-MediaStreamTrack-Lifecycle.md / 00-Reading-Guide-and-Source-Map.md` |
| EventTarget.addEventListener | `StreamConstants.MUTE` | L23106 | `installTrackEvent — 安装轨道事件监听器` | `05-MediaStreamTrack-Lifecycle.md` |
| EventTarget.addEventListener | `StreamConstants.UNMUTE` | L23107 | `installTrackEvent — 安装轨道事件监听器` | `05-MediaStreamTrack-Lifecycle.md` |
| EventTarget.addEventListener | `e` | L17211 | `createEventDispatcher — 内部函数` | `10-Auxiliary-Browser-APIs.md` |
| EventTarget.addEventListener | `t` | L6702, L21789 | `fC — 源码命名函数；fromEventObservable — 内部函数` | `02-RTCPeerConnection-usage-analysis.md / 00-Reading-Guide-and-Source-Map.md` |
| EventTarget.removeEventListener | `'addstream'` | L8232 | `XC — 源码命名函数` | `02-RTCPeerConnection-usage-analysis.md` |
| EventTarget.removeEventListener | `'change'` | L34102 | `destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | `00-Reading-Guide-and-Source-Map.md` |
| EventTarget.removeEventListener | `'click'` | L18515, L20161 | `observableCreate — 源码命名函数；i — 源码命名函数` | `07-Media-Playback-and-Rendering.md / 04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md` |
| EventTarget.removeEventListener | `'close'` | L36939 | `unbindSocket — 解绑 WebSocket 实例` | `03-WebSocket-usage-analysis.md` |
| EventTarget.removeEventListener | `'connectionstatechange'` | L9333 | `pb — 源码命名函数` | `02-RTCPeerConnection-usage-analysis.md` |
| EventTarget.removeEventListener | `'error'` | L36940 | `unbindSocket — 解绑 WebSocket 实例` | `03-WebSocket-usage-analysis.md` |
| EventTarget.removeEventListener | `'message'` | L36941 | `unbindSocket — 解绑 WebSocket 实例` | `03-WebSocket-usage-analysis.md` |
| EventTarget.removeEventListener | `'pagehide'` | L41398 | `uninstallEvents — 卸载事件监听器集合` | `10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventTarget.removeEventListener | `'track'` | L7020, L8233, L47234 | `kC — 源码命名函数；XC — 源码命名函数；reset — 重置房间状态（清理所有内部数据）` | `02-RTCPeerConnection-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| EventTarget.removeEventListener | `'visibilitychange'` | L17170, L18514, L25362, L25385, L42800 | `e 类 — e；observableCreate — 源码命名函数；update — 方法；close — 关闭本地流并释放所有轨道；onRemoteVideoPlayEnd — 远端视频播放结束回调` | `10-Auxiliary-Browser-APIs.md / 07-Media-Playback-and-Rendering.md / 07-Media-Playback-and-Rendering.md / 10-Auxiliary-Browser-APIs.md / 10-Auxiliary-Browser-APIs.md` |
| EventTarget.removeEventListener | `StreamConstants.ENDED` | L23118 | `uninstallTrackEvent — 卸载轨道事件监听器` | `05-MediaStreamTrack-Lifecycle.md` |
| EventTarget.removeEventListener | `StreamConstants.MUTE` | L23116 | `uninstallTrackEvent — 卸载轨道事件监听器` | `05-MediaStreamTrack-Lifecycle.md` |
| EventTarget.removeEventListener | `StreamConstants.UNMUTE` | L23117 | `uninstallTrackEvent — 卸载轨道事件监听器` | `05-MediaStreamTrack-Lifecycle.md` |
| EventTarget.removeEventListener | `t` | L6701, L21790 | `fC — 源码命名函数；fromEventObservable — 内部函数` | `02-RTCPeerConnection-usage-analysis.md / 00-Reading-Guide-and-Source-Map.md` |
| 事件属性 | `onaudioprocess` | L19046, L19065 | `initScriptProcessor — 初始化 ScriptProcessor 音频处理；destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）` | `06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md` |
| 事件属性 | `once` | L9685, L9825 | `o — 内部函数；c.prototype.once — 原型方法` | `02-RTCPeerConnection-usage-analysis.md` |
| 事件属性 | `onclick` | L18022, L18028, L18033, L18048, L18049 | `createDiaLog — 创建弹窗；addDiaLog — 添加弹窗` | `07-Media-Playback-and-Rendering.md` |
| 事件属性 | `onclose` | L36810, L36913, L36924, L37088, L46235 | `构造函数；connectWS — 建立 WebSocket 连接；startReconnection — 开始重连流程；initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| 事件属性 | `onconnectionstatechange` | L37448, L37468, L46226, L47365 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream；closePeerConnection — 关闭并清理 RTCPeerConnection 连接；removeRTCListener — 移除 RTC 监听器` | `02-RTCPeerConnection-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| 事件属性 | `ondurationchange` | L32075 | `updateListener — 更新事件监听` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| 事件属性 | `onended` | L32090 | `updateListener — 更新事件监听` | `08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| 事件属性 | `onerror` | L12519, L12642, L17772, L17795, L31080, L31164, L36809, L36914, L36924, L46152, L46245, L47606 | `asyncGeneratorWrap — 方法；loadVideo — 加载视频元素；doReplayByRecreateMediaStream — 通过重建 MediaStream 重新播放；downloadWithXHR — 使用 XMLHttpRequest 下载；loadScript — 加载外部脚本；另 5 个` | `10-Auxiliary-Browser-APIs.md / 07-Media-Playback-and-Rendering.md / 08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md / 03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| 事件属性 | `oniceconnectionstatechange` | L46205, L47364 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream；removeRTCListener — 移除 RTC 监听器` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| 事件属性 | `onload` | L12518, L31070, L31158 | `asyncGeneratorWrap — 方法；downloadWithXHR — 使用 XMLHttpRequest 下载；loadScript — 加载外部脚本` | `10-Auxiliary-Browser-APIs.md / 08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| 事件属性 | `onmessage` | L2371, L17068, L17074, L19003, L19022, L19067, L27231, L27255, L31837, L31838, L31938, L32700, L32768, L36808, L46106, L46147, L46239, L47598, L47608 | `nu — 源码命名函数；e 类 — e；preload — 预加载资源；initAudioWorklet — 初始化 AudioWorklet（音量检测等）；destroy — 销毁 SDK 实例，释放所有资源（房间、轨道、连接等）；另 7 个` | `00-Reading-Guide-and-Source-Map.md / 10-Auxiliary-Browser-APIs.md / 06-Web-Audio-usage-analysis.md / 04-MediaDevices-and-Capture.md / 07-Media-Playback-and-Rendering.md / 08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md / 03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| 事件属性 | `onopen` | L36915, L36924, L46231 | `connectWS — 建立 WebSocket 连接；initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream` | `03-WebSocket-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| 事件属性 | `onreadystatechange` | L12941 | `sendHttpRequest — 内部函数` | `10-Auxiliary-Browser-APIs.md` |
| 事件属性 | `onrtctransform` | L46119 | `initScriptTransformWorker — 初始化脚本转换 Worker` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| 事件属性 | `onsignalingstatechange` | L46219, L47366 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream；removeRTCListener — 移除 RTC 监听器` | `02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| 事件属性 | `onstatechange` | L18475, L46260, L47368 | `initAudioWorklet — 内部函数；initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream；removeRTCListener — 移除 RTC 监听器` | `07-Media-Playback-and-Rendering.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
| 事件属性 | `ontimeupdate` | L19499, L32085 | `initializeElement — 方法；updateListener — 更新事件监听` | `04-MediaDevices-and-Capture.md / 05-MediaStreamTrack-Lifecycle.md / 08-Worker-Streams-and-Encoded-Processing.md / 09-WebCodecs-and-WebAssembly.md` |
| 事件属性 | `ontrack` | L37907, L46227, L47367 | `initialize — 初始化本地流，获取摄像头/麦克风权限并创建 MediaStream；removeRTCListener — 移除 RTC 监听器` | `02-RTCPeerConnection-usage-analysis.md / 02-RTCPeerConnection-usage-analysis.md / 08-Worker-Streams-and-Encoded-Processing.md` |
