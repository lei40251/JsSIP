# 快速上手

### 注意：浏览器权限限制，仅支持https访问获取媒体设备

> CRTC User Agent 代表与SIP帐户关联的SIP客户端。CRTC User Agent 在 `CRTC.UA` 中定义。

## 第一个例子

创建文件及目录，结构见 base-js 目录：

> *建议使用 webrtc-adapter 以实现更好的浏览器兼容*

*开启debug模式查看控制台输出调试信息*

```
CRTC.debug.enable('CRTC:*')
```

*关闭调试*

```
CRTC.debug.disable('CRTC:*')
```

### 初始化

1. 引入 SDK 文件

```
<script src="./js/CRTC.min.js"></script>
```

2. UA 配置参数

```
const socket = new CRTC.WebSocketInterface('你的 WSS 信令地址');
const configuration = {
  sockets    : socket,
  uri        : 'sip:account@sipDomain',
  password   : 'password',
  secret_key : '授权码'
};
```

3. UA 实例化

```
const UA = new CRTC.UA(configuration);
```
4. UA 事件回调
```
ua.on('newRTCSession', function(data)
{
  // 呼入或呼出通话时触发

  ... 此处代码见 demo ...
  
  // session 事件回调
  data.session.on('progress', function(d) 
  {
    ... 此处代码见 demo ...
  });
});
```

5. 启动 UA

```
UA.start();
```

### 发起呼叫

1. 呼叫参数

```
const options = {
  'mediaConstraints' : { 'audio': true, 'video': { width : { ideal: 640 }, height : { ideal: 480 }, frameRate : 15 } },
  'extraHeaders'     : [ 'X-Data: dGVzdCB4LWRhdGE=' ]
};
```

2. 发起呼叫

```
const session = UA.call('sip:bob@example.com', options);
```
