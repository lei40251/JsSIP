## Modules

<dl>
<dt><a href="#module_PRTC">PRTC</a></dt>
<dd></dd>
</dl>

## Classes

<dl>
<dt><a href="#Client">Client</a> ⇐ <code>EventEmitter</code></dt>
<dd></dd>
<dt><a href="#LocalStream">LocalStream</a> ⇐ <code><a href="#Stream">Stream</a></code></dt>
<dd></dd>
<dt><a href="#RemoteStream">RemoteStream</a> ⇐ <code><a href="#Stream">Stream</a></code></dt>
<dd></dd>
<dt><a href="#Stream">Stream</a> ⇐ <code>EventEmitter</code></dt>
<dd></dd>
</dl>

<a name="module_PRTC"></a>

## PRTC

* [PRTC](#module_PRTC)
    * [.version](#module_PRTC.version) : <code>string</code>
    * [.checkSystemRequirements()](#module_PRTC.checkSystemRequirements) ⇒ <code>object</code>
    * [.isScreenShareSupported()](#module_PRTC.isScreenShareSupported) ⇒ <code>boolean</code>
    * [.getDevices()](#module_PRTC.getDevices) ⇒ <code>Promise.&lt;Array.&lt;MediaDeviceInfo&gt;&gt;</code>
    * [.getCameras()](#module_PRTC.getCameras) ⇒ <code>Promise.&lt;Array.&lt;MediaDeviceInfo&gt;&gt;</code>
    * [.getMicrophones()](#module_PRTC.getMicrophones) ⇒ <code>Promise.&lt;Array.&lt;MediaDeviceInfo&gt;&gt;</code>
    * [.getSpeakers()](#module_PRTC.getSpeakers) ⇒ <code>Promise.&lt;Array.&lt;MediaDeviceInfo&gt;&gt;</code>
    * [.createClient(clientConfig)](#module_PRTC.createClient) ⇒ [<code>Client</code>](#Client)
    * [.createStream(streamConfig)](#module_PRTC.createStream) ⇒ [<code>LocalStream</code>](#LocalStream)

<a name="module_PRTC.version"></a>

### PRTC.version : <code>string</code>
- SDK 版本号

**Kind**: static property of [<code>PRTC</code>](#module_PRTC)  
<a name="module_PRTC.checkSystemRequirements"></a>

### PRTC.checkSystemRequirements() ⇒ <code>object</code>
检测浏览器是否支持 WebRTC 相关属性、方法等

**Kind**: static method of [<code>PRTC</code>](#module_PRTC)  
**Returns**: <code>object</code> - datadata.result - 检测结果data.detail - 检测详情data.detail.isWebRTCSupported - 当前浏览器是否支持 webRTCdata.detail.isMediaDevicesSupported - 当前浏览器是否支持获取媒体设备及媒体流data.detail.isH264EncodeSupported - 当前浏览器上行是否支持 H264 编码data.detail.isH264DecodeSupported - 当前浏览器下行是否支持 H264 编码data.detail.isVp8EncodeSupported - 当前浏览器上行是否支持 VP8 编码data.detail.isVp8DecodeSupported - 当前浏览器下行是否支持 VP8 编码  
<a name="module_PRTC.isScreenShareSupported"></a>

### PRTC.isScreenShareSupported() ⇒ <code>boolean</code>
浏览器是否支持屏幕分享

**Kind**: static method of [<code>PRTC</code>](#module_PRTC)  
**Returns**: <code>boolean</code> - .  
<a name="module_PRTC.getDevices"></a>

### PRTC.getDevices() ⇒ <code>Promise.&lt;Array.&lt;MediaDeviceInfo&gt;&gt;</code>
获取全部媒体输入、输出设备

**Kind**: static method of [<code>PRTC</code>](#module_PRTC)  
<a name="module_PRTC.getCameras"></a>

### PRTC.getCameras() ⇒ <code>Promise.&lt;Array.&lt;MediaDeviceInfo&gt;&gt;</code>
获取全部摄像头列表

**Kind**: static method of [<code>PRTC</code>](#module_PRTC)  
<a name="module_PRTC.getMicrophones"></a>

### PRTC.getMicrophones() ⇒ <code>Promise.&lt;Array.&lt;MediaDeviceInfo&gt;&gt;</code>
获取全部麦克风

**Kind**: static method of [<code>PRTC</code>](#module_PRTC)  
<a name="module_PRTC.getSpeakers"></a>

### PRTC.getSpeakers() ⇒ <code>Promise.&lt;Array.&lt;MediaDeviceInfo&gt;&gt;</code>
获取全部扬声器列表

**Kind**: static method of [<code>PRTC</code>](#module_PRTC)  
<a name="module_PRTC.createClient"></a>

### PRTC.createClient(clientConfig) ⇒ [<code>Client</code>](#Client)
创建 Client 客户端对象

**Kind**: static method of [<code>PRTC</code>](#module_PRTC)  
**Returns**: [<code>Client</code>](#Client) - - 客户端对象.  

| Param | Type | Description |
| --- | --- | --- |
| clientConfig | <code>object</code> | 详细内容见 Client |

<a name="module_PRTC.createStream"></a>

### PRTC.createStream(streamConfig) ⇒ [<code>LocalStream</code>](#LocalStream)
创建本地流对象，可以通过 客户端对象的 join 方法使用本流入会

**Kind**: static method of [<code>PRTC</code>](#module_PRTC)  
**Returns**: [<code>LocalStream</code>](#LocalStream) - - 客户端对象.  

| Param | Type | Description |
| --- | --- | --- |
| streamConfig | <code>object</code> | 详细内容见 LocalStream |

<a name="Client"></a>

## Client ⇐ <code>EventEmitter</code>
**Kind**: global class  
**Extends**: <code>EventEmitter</code>  

* [Client](#Client) ⇐ <code>EventEmitter</code>
    * [new Client(clientConfig)](#new_Client_new)
    * [.join(roomId, displayName, [options])](#Client+join)
    * [.leave()](#Client+leave)
    * ["JOIN-ROOM-FAILED"](#Client+event_JOIN-ROOM-FAILED)
    * ["CONNECTION-STATE-CHANGED"](#Client+event_CONNECTION-STATE-CHANGED)
    * ["REGISTERED"](#Client+event_REGISTERED)
    * ["REGISTRATIONFAILED"](#Client+event_REGISTRATIONFAILED)
    * ["ERROR"](#Client+event_ERROR)
    * ["LOCAL-JOINED"](#Client+event_LOCAL-JOINED)
    * ["STREAM-ADDED"](#Client+event_STREAM-ADDED)
    * ["LOCAL-LEFT"](#Client+event_LOCAL-LEFT)
    * ["STREAM-REMOVED"](#Client+event_STREAM-REMOVED)

<a name="new_Client_new"></a>

### new Client(clientConfig)
音视频通话客户对象，通过createClient创建


| Param | Type | Description |
| --- | --- | --- |
| clientConfig | <code>object</code> |  |
| clientConfg.call_router_url | <code>string</code> | callRouter 地址 url |
| clientConfg.sdi_app_id | <code>string</code> | sdkAppID |
| clientConfg.user_id | <code>string</code> | 用户ID |
| clientConfg.user_sig | <code>string</code> | 签名 |

<a name="Client+join"></a>

### client.join(roomId, displayName, [options])
加入房间，房间不存在则创建

**Kind**: instance method of [<code>Client</code>](#Client)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| roomId | <code>string</code> |  | 房间号 |
| displayName | <code>string</code> |  | 显示名（可以为中文） |
| [options] | <code>object</code> | <code>{}</code> |  |
| [options.mediaStream] | <code>MediaStream</code> |  | 本地媒体流，则默认调用麦克风、摄像头获取 |
| [options.pcConfig] | <code>array</code> |  | turn服务器设置 [{urls:'turn:example.com:666',username:'',credential:''}] |
| [options.iceTransportPolicy] | <code>string</code> | <code>&quot;all&quot;</code> | ICE协商策略, 'relay':强制使用TURN, 'all':任何类型 |

<a name="Client+leave"></a>

### client.leave()
离开房间

**Kind**: instance method of [<code>Client</code>](#Client)  
<a name="Client+event_JOIN-ROOM-FAILED"></a>

### "JOIN-ROOM-FAILED"
加入房间失败事件

**Kind**: event emitted by [<code>Client</code>](#Client)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| code | <code>string</code> | code 列表另附 |

<a name="Client+event_CONNECTION-STATE-CHANGED"></a>

### "CONNECTION-STATE-CHANGED"
WebSocket 信令通道连接状态变化事件

**Kind**: event emitted by [<code>Client</code>](#Client)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| data | <code>string</code> | CONNECTING 连接中，CONNECTED 已连接，DISCONNECTED 已断开 |

<a name="Client+event_REGISTERED"></a>

### "REGISTERED"
注册成功事件，注册后呼叫情况下使用

**Kind**: event emitted by [<code>Client</code>](#Client)  
**Properties**

| Name | Type |
| --- | --- |
| data | <code>object</code> | 

<a name="Client+event_REGISTRATIONFAILED"></a>

### "REGISTRATIONFAILED"
注册失败事件，注册后呼叫情况下使用

**Kind**: event emitted by [<code>Client</code>](#Client)  
**Properties**

| Name | Type |
| --- | --- |
| data | <code>object</code> | 

<a name="Client+event_ERROR"></a>

### "ERROR"
错误事件

**Kind**: event emitted by [<code>Client</code>](#Client)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| data | <code>string</code> | 事件列表另附 |

<a name="Client+event_LOCAL-JOINED"></a>

### "LOCAL-JOINED"
本地已加入会议事件

**Kind**: event emitted by [<code>Client</code>](#Client)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| data | <code>object</code> | 本地媒体流对象 |

<a name="Client+event_STREAM-ADDED"></a>

### "STREAM-ADDED"
新用户媒体加入会议事件

**Kind**: event emitted by [<code>Client</code>](#Client)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| data | <code>object</code> | 远端媒体流对象 |

<a name="Client+event_LOCAL-LEFT"></a>

### "LOCAL-LEFT"
本地已退出会议事件

**Kind**: event emitted by [<code>Client</code>](#Client)  
<a name="Client+event_STREAM-REMOVED"></a>

### "STREAM-REMOVED"
远端用户媒体流已经移除事件

**Kind**: event emitted by [<code>Client</code>](#Client)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| data | <code>object</code> | 远端媒体对象 |

<a name="LocalStream"></a>

## LocalStream ⇐ [<code>Stream</code>](#Stream)
**Kind**: global class  
**Extends**: [<code>Stream</code>](#Stream)  

* [LocalStream](#LocalStream) ⇐ [<code>Stream</code>](#Stream)
    * [new LocalStream(streamConfig)](#new_LocalStream_new)
    * [.userId](#LocalStream+userId)
    * [.id](#Stream+id)
    * [.stream](#Stream+stream)
    * [.initialize()](#LocalStream+initialize) ⇒ <code>Promise</code>
    * [.setAudioProfile([profile])](#LocalStream+setAudioProfile)
    * [.setVideoProfile([profile])](#LocalStream+setVideoProfile) ⇒ <code>Promise</code>
    * [.setVideoContentHint([hint])](#LocalStream+setVideoContentHint) ⇒ <code>boolean</code>
    * [.close()](#LocalStream+close)
    * [.muteVideo()](#Stream+muteVideo) ⇒ <code>boolean</code>
    * [.unmuteVideo()](#Stream+unmuteVideo) ⇒ <code>boolean</code>
    * [.muteAudio()](#Stream+muteAudio) ⇒ <code>boolean</code>
    * [.unmuteAudio()](#Stream+unmuteAudio) ⇒ <code>boolean</code>
    * ["STOPED"](#LocalStream+event_STOPED)
    * ["CLOSE-FAILED"](#LocalStream+event_CLOSE-FAILED)

<a name="new_LocalStream_new"></a>

### new LocalStream(streamConfig)
本地媒体对象，可以通过createStream创建


| Param | Type | Description |
| --- | --- | --- |
| streamConfig | <code>object</code> | 注意：本参数未启用 |
| streamConfig.user_id | <code>string</code> | 用户ID |
| streamConfig.audio | <code>string</code> | 是否采集麦克风 |
| streamConfig.video | <code>string</code> | 是否采集摄像头视频 |
| streamConfig.microphone_id | <code>string</code> | 音频输入设备 deviceId，可通过 getMicrophones()获取 |
| streamConfig.camera_id | <code>string</code> | 摄像头的 deviceId, 可通过 getCameras() 获取 |
| streamConfig.facing_mode | <code>string</code> | 'user':前置摄像头，'environment':后置摄像头，请勿同时使用 camrea_id 和 facing_ode |
| streamConfig.screen | <code>string</code> | 是否采用屏幕分享 |
| streamConfig.videoSource | <code>string</code> | 视频源 |
| streamConfig.audioSource | <code>string</code> | 音频源 |
| streamConfig.mirror | <code>string</code> | 视频是否镜像，不适用于屏幕分享 |

<a name="LocalStream+userId"></a>

### localStream.userId
**Kind**: instance property of [<code>LocalStream</code>](#LocalStream)  
**Read only**: true  
<a name="Stream+id"></a>

### localStream.id
Stream唯一标识ID

**Kind**: instance property of [<code>LocalStream</code>](#LocalStream)  
**Read only**: true  
<a name="Stream+stream"></a>

### localStream.stream
音视频流

**Kind**: instance property of [<code>LocalStream</code>](#LocalStream)  
**Read only**: true  
<a name="LocalStream+initialize"></a>

### localStream.initialize() ⇒ <code>Promise</code>
初始化本地音视频对象

**Kind**: instance method of [<code>LocalStream</code>](#LocalStream)  
<a name="LocalStream+setAudioProfile"></a>

### localStream.setAudioProfile([profile])
设置音频 Profile

**Kind**: instance method of [<code>LocalStream</code>](#LocalStream)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [profile] | <code>string</code> | <code>&quot;standard&quot;</code> | 码率: 'standard':40kbps; 'high':128kbps |

<a name="LocalStream+setVideoProfile"></a>

### localStream.setVideoProfile([profile]) ⇒ <code>Promise</code>
设置视频 Profile

**Kind**: instance method of [<code>LocalStream</code>](#LocalStream)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [profile] | <code>string</code> \| <code>object</code> | <code>&quot;480p&quot;</code> | 详见profile对照表 |
| profile.width | <code>string</code> |  | 视频宽度 |
| profile.height | <code>string</code> |  | 视频高度 |
| profile.frameRate | <code>string</code> |  | 帧率 |
| profile.bitrate | <code>string</code> |  | 比特率 kbps |

<a name="LocalStream+setVideoContentHint"></a>

### localStream.setVideoContentHint([hint]) ⇒ <code>boolean</code>
设置视频内容提示

**Kind**: instance method of [<code>LocalStream</code>](#LocalStream)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [hint] | <code>string</code> | <code>&quot;motion&quot;</code> | 'motion', 'detail', 'text' |

<a name="LocalStream+close"></a>

### localStream.close()
关闭本地音视频流，释放麦克风和摄像头

**Kind**: instance method of [<code>LocalStream</code>](#LocalStream)  
<a name="Stream+muteVideo"></a>

### localStream.muteVideo() ⇒ <code>boolean</code>
禁用视频轨道

**Kind**: instance method of [<code>LocalStream</code>](#LocalStream)  
<a name="Stream+unmuteVideo"></a>

### localStream.unmuteVideo() ⇒ <code>boolean</code>
启用视频轨道

**Kind**: instance method of [<code>LocalStream</code>](#LocalStream)  
<a name="Stream+muteAudio"></a>

### localStream.muteAudio() ⇒ <code>boolean</code>
禁用音频轨道,远端音频混流仅支持禁用全部音频

**Kind**: instance method of [<code>LocalStream</code>](#LocalStream)  
<a name="Stream+unmuteAudio"></a>

### localStream.unmuteAudio() ⇒ <code>boolean</code>
启用音频轨道,远端音频混流仅支持启用全部音频

**Kind**: instance method of [<code>LocalStream</code>](#LocalStream)  
<a name="LocalStream+event_STOPED"></a>

### "STOPED"
本地媒体已关闭事件

**Kind**: event emitted by [<code>LocalStream</code>](#LocalStream)  
<a name="LocalStream+event_CLOSE-FAILED"></a>

### "CLOSE-FAILED"
错误事件

**Kind**: event emitted by [<code>LocalStream</code>](#LocalStream)  
**Properties**

| Name | Type |
| --- | --- |
| data | <code>object</code> | 

<a name="RemoteStream"></a>

## RemoteStream ⇐ [<code>Stream</code>](#Stream)
**Kind**: global class  
**Extends**: [<code>Stream</code>](#Stream)  

* [RemoteStream](#RemoteStream) ⇐ [<code>Stream</code>](#Stream)
    * [new RemoteStream()](#new_RemoteStream_new)
    * [.type](#RemoteStream+type)
    * [.userId](#RemoteStream+userId)
    * [.display_name](#RemoteStream+display_name)
    * [.id](#Stream+id)
    * [.stream](#Stream+stream)
    * [.muteVideo()](#Stream+muteVideo) ⇒ <code>boolean</code>
    * [.unmuteVideo()](#Stream+unmuteVideo) ⇒ <code>boolean</code>
    * [.muteAudio()](#Stream+muteAudio) ⇒ <code>boolean</code>
    * [.unmuteAudio()](#Stream+unmuteAudio) ⇒ <code>boolean</code>

<a name="new_RemoteStream_new"></a>

### new RemoteStream()
远端媒体对象

<a name="RemoteStream+type"></a>

### remoteStream.type
媒体类型

**Kind**: instance property of [<code>RemoteStream</code>](#RemoteStream)  
**Read only**: true  
<a name="RemoteStream+userId"></a>

### remoteStream.userId
用户ID

**Kind**: instance property of [<code>RemoteStream</code>](#RemoteStream)  
**Read only**: true  
<a name="RemoteStream+display_name"></a>

### remoteStream.display\_name
用户显示名

**Kind**: instance property of [<code>RemoteStream</code>](#RemoteStream)  
**Read only**: true  
<a name="Stream+id"></a>

### remoteStream.id
Stream唯一标识ID

**Kind**: instance property of [<code>RemoteStream</code>](#RemoteStream)  
**Read only**: true  
<a name="Stream+stream"></a>

### remoteStream.stream
音视频流

**Kind**: instance property of [<code>RemoteStream</code>](#RemoteStream)  
**Read only**: true  
<a name="Stream+muteVideo"></a>

### remoteStream.muteVideo() ⇒ <code>boolean</code>
禁用视频轨道

**Kind**: instance method of [<code>RemoteStream</code>](#RemoteStream)  
<a name="Stream+unmuteVideo"></a>

### remoteStream.unmuteVideo() ⇒ <code>boolean</code>
启用视频轨道

**Kind**: instance method of [<code>RemoteStream</code>](#RemoteStream)  
<a name="Stream+muteAudio"></a>

### remoteStream.muteAudio() ⇒ <code>boolean</code>
禁用音频轨道,远端音频混流仅支持禁用全部音频

**Kind**: instance method of [<code>RemoteStream</code>](#RemoteStream)  
<a name="Stream+unmuteAudio"></a>

### remoteStream.unmuteAudio() ⇒ <code>boolean</code>
启用音频轨道,远端音频混流仅支持启用全部音频

**Kind**: instance method of [<code>RemoteStream</code>](#RemoteStream)  
<a name="Stream"></a>

## Stream ⇐ <code>EventEmitter</code>
**Kind**: global class  
**Extends**: <code>EventEmitter</code>  

* [Stream](#Stream) ⇐ <code>EventEmitter</code>
    * [new Stream()](#new_Stream_new)
    * [.id](#Stream+id)
    * [.stream](#Stream+stream)
    * [.muteVideo()](#Stream+muteVideo) ⇒ <code>boolean</code>
    * [.unmuteVideo()](#Stream+unmuteVideo) ⇒ <code>boolean</code>
    * [.muteAudio()](#Stream+muteAudio) ⇒ <code>boolean</code>
    * [.unmuteAudio()](#Stream+unmuteAudio) ⇒ <code>boolean</code>

<a name="new_Stream_new"></a>

### new Stream()
LocalStream 和 RemoteStream 的基类

<a name="Stream+id"></a>

### stream.id
Stream唯一标识ID

**Kind**: instance property of [<code>Stream</code>](#Stream)  
**Read only**: true  
<a name="Stream+stream"></a>

### stream.stream
音视频流

**Kind**: instance property of [<code>Stream</code>](#Stream)  
**Read only**: true  
<a name="Stream+muteVideo"></a>

### stream.muteVideo() ⇒ <code>boolean</code>
禁用视频轨道

**Kind**: instance method of [<code>Stream</code>](#Stream)  
<a name="Stream+unmuteVideo"></a>

### stream.unmuteVideo() ⇒ <code>boolean</code>
启用视频轨道

**Kind**: instance method of [<code>Stream</code>](#Stream)  
<a name="Stream+muteAudio"></a>

### stream.muteAudio() ⇒ <code>boolean</code>
禁用音频轨道,远端音频混流仅支持禁用全部音频

**Kind**: instance method of [<code>Stream</code>](#Stream)  
<a name="Stream+unmuteAudio"></a>

### stream.unmuteAudio() ⇒ <code>boolean</code>
启用音频轨道,远端音频混流仅支持启用全部音频

**Kind**: instance method of [<code>Stream</code>](#Stream)  
