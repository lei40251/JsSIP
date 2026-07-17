# 快速上手

> 浏览器采集本地媒体时，页面通常需要通过 HTTPS 或 localhost 提供。

CRTC 的核心接入对象是 `CRTC.UA`。如果你拿到的是 release 压缩包，请把它当成交付包使用：核心 SDK 文件是 `dist/CRTC.min.js`，同时还会附带 Demo、变更说明和 HTML 用户指南。

## 1. 引入浏览器依赖

建议同时引入浏览器兼容层和构建后的 SDK bundle：

```html
<script src="./js/adapter-latest.js"></script>
<script src="./dist/CRTC.min.js"></script>
```

release 压缩包会提供 `dist/CRTC.min.js`、`demo/**`、`CHANGELOG.md` 和 `docs/*.html`（包含 `docs/assets/**`），但不会包含仓库里的源码。

## 2. 初始化 UA

```javascript
const socket = new CRTC.WebSocketInterface('wss://sip.example.com');
const configuration = {
  sockets    : socket,
  uri        : 'sip:alice@example.com',
  password   : 'superpassword',
  secret_key : '授权码'
};

const ua = new CRTC.UA(configuration);
```

调试时可打开日志：

```javascript
CRTC.debug.enable('CRTC:*');
```

关闭日志：

```javascript
CRTC.debug.disable('CRTC:*');
```

## 3. 监听核心事件

`newRTCSession` 是最关键的会话入口。无论呼入还是呼出，都从这里拿到 `RTCSession` 并继续挂接会话级事件。

```javascript
ua.on('newRTCSession', function(data)
{
  const session = data.session;

  session.on('progress', function(event)
  {
    console.log('call is in progress', event.originator);
  });

  session.on('failed', function(event)
  {
    console.log('call failed', event.cause);
  });

  session.on('ended', function(event)
  {
    console.log('call ended', event.cause);
  });

  session.on('confirmed', function()
  {
    console.log('call confirmed');
  });
});
```

## 4. 启动 UA

```javascript
ua.start();
```

## 5. 发起呼叫

```javascript
const options = {
  mediaConstraints : {
    audio : true,
    video : {
      width     : { ideal: 640 },
      height    : { ideal: 480 },
      frameRate : 15
    }
  },
  extraHeaders : [ 'X-Data: dGVzdCB4LWRhdGE=' ]
};

const session = ua.call('sip:bob@example.com', options);
```

## 6. 接听来电

在 `newRTCSession` 的回调中，如果 `data.originator === 'remote'`，通常表示当前页面收到呼入。此时可以调用：

```javascript
session.answer({
  mediaConstraints : {
    audio : true,
    video : true
  }
});
```

实际项目里可以按你的页面交互延迟调用 `answer()`。

## 7. 挂断通话

```javascript
session.terminate();
```

## 8. Release 包说明

当前 release 压缩包包含这些内容：

- `dist/CRTC.min.js`
- `demo/**`
- `CHANGELOG.md`
- `docs/*.html`
- `docs/assets/**`
