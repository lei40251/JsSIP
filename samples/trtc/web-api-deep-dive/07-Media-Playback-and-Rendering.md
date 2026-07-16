# 07 媒体播放与渲染

> 本文沿“Track 到达 → 选择播放器 → 帧驱动 → 画面处理 → 输出/截图 → 停止”说明媒体呈现。

## 1. 本章结论

源码存在两类视频呈现路径：

```text
原生播放：Track → HTMLVideoElement
处理渲染：Track → hidden video/frame source → Canvas2D/WebGL → canvas
```

音频主要通过 HTMLAudioElement 或 Web Audio 播放。Player 负责绑定和呈现 Track，但通常不拥有本地采集源；清理 Player 不等于停止摄像头或 receiver。

## 2. Player 的统一职责

Player 基类主要维护：

- 当前 Track/MediaStream。
- 播放目标元素或容器。
- play/pause/playing/error 等状态。
- 自动播放失败和恢复。
- 帧率、尺寸和首帧信息。
- stop 与最终销毁。

播放器状态与 Track 状态不同：Track 可能 live，但媒体元素因自动播放被阻止；元素可能 playing，但网络 Stats 已经没有新帧。

## 3. HTMLVideoElement 路径

典型创建和播放：

```text
document.createElement('video')
  → autoplay = true
  → playsInline = true
  → muted 按本地预览/业务设置
  → srcObject = new MediaStream([videoTrack])
  → append 到目标容器
  → video.play()
```

主要参数和职责：

| 参数/属性 | 作用 |
|---|---|
| `playsInline` | 避免移动端强制全屏 |
| `muted` | 本地预览或自动播放兼容 |
| `srcObject` | 绑定 MediaStream |
| object-fit | fillMode，不影响采集尺寸 |
| CSS transform | mirror/简单旋转 |
| `requestVideoFrameCallback` | 按真实视频帧驱动尺寸、首帧或渲染 |

## 4. HTMLAudioElement 路径

```text
audioTrack 或 URL
  → HTMLAudioElement.srcObject / src
  → volume
  → 可选 setSinkId(deviceId)
  → play()
```

`setSinkId()` 失败通常不应停止接收；可以继续使用系统默认输出并上报兼容信息。

背景音乐可能使用双元素或独立播放对象，以便切换、循环和淡入淡出，不应与远端通话音频的 Track 生命周期混在一起。

## 5. 媒体元素事件到 SDK 状态

常见事件包括：

- `loadedmetadata`
- `playing`
- `pause`
- `ended`
- `error`
- `resize`

事件处理必须绑定当前元素/Track 版本。换轨或换容器后，旧元素晚到的事件不能覆盖新播放器状态。

## 6. 自动播放失败

`element.play()` 返回 Promise。遇到 `NotAllowedError` 时：

```text
记录待恢复 Player
  → 展示用户交互提示
  → 用户点击
  → AudioContext.resume（如需要）
  → element.play()
  → 成功后清提示和 listener
```

自动播放提示属于 SDK 接入辅助，不代表媒体 Track 或 PC 失败。

## 7. 为什么还需要 Canvas/WebGL

原生 video 适合直接播放；以下需求需要处理渲染：

- 多路合成。
- 镜像、旋转、裁剪、透明度。
- 水印、文字和图像叠加。
- 截图和像素检测。
- 把处理画面重新输出为可发布 Track。
- WebGL GPU shader 和纹理处理。

## 8. 图像源怎样产生

视频 Track 通常先绑定到隐藏 video，或通过支持的帧 API变成可绘制源：

```text
MediaStreamTrack
  → hidden HTMLVideoElement / VideoFrame source
  → requestVideoFrameCallback 或渲染 timer
  → Canvas drawImage / WebGL texture upload
```

读取帧前必须处理视频尚无尺寸、readyState 不足和 Track ended。

## 9. Canvas 2D 路径

Canvas 2D 适合：

- `drawImage()` 简单合成。
- `getImageData()` 像素读取或黑帧判断。
- `toDataURL()/toBlob()` 截图。
- 文本、水印和基础变换。

需要频繁读像素时可使用 `{willReadFrequently:true}`；否则浏览器可能在 GPU/CPU 间频繁搬运。

## 10. WebGL2 路径

WebGL2 渲染主链：

```text
创建 WebGL2 context
  → 编译/link shader program
  → 创建顶点/纹理坐标 buffer
  → 创建 texture / framebuffer
  → 每帧上传视频纹理
  → 设置矩阵、alpha、旋转、镜像
  → drawArrays/drawElements
```

需要处理：

- shader 编译或 program link 失败。
- context lost/restored。
- 纹理、buffer、framebuffer 和 program 删除。
- Canvas 尺寸变化后的 viewport/FBO 重建。

## 11. 帧驱动策略

优先级通常是：

1. `requestVideoFrameCallback()`：跟随真实解码帧。
2. `requestAnimationFrame()`：跟随页面渲染帧率。
3. timer/Worker timer：兼容或后台任务。

播放器停止、Track 结束或页面销毁时必须取消对应 callback，否则隐藏元素和渲染上下文会继续被闭包引用。

## 12. `canvas.captureStream()` 输出

```text
Canvas renderer
  → canvas.captureStream(targetFrameRate)
  → outputStream.getVideoTracks()[0]
  → LocalVideoTrack.outMediaTrack
  → sender.replaceTrack(outTrack)
```

这条路径用于本地混流和视频处理。输出 Track 的尺寸来自 Canvas，不再直接等于摄像头 settings。

## 13. 截图

截图流程：

```text
确认当前视频帧和尺寸
  → 画入临时或现有 Canvas
  → toDataURL / toBlob
  → 返回图片数据
```

跨域 URL 视频可能污染 Canvas；MediaStream 视频通常不受普通跨域图片规则影响，但外部叠加图像仍要满足 CORS。

## 14. 容器和 Track 切换

切换 view 时应：

- 把元素从旧容器移到新容器或重建明确的新元素。
- 保留当前 `srcObject` 和播放状态。
- 解绑旧容器 Observer。
- 防止同一个 Track 被多个不受控 Player 重复播放音频。

换 Track 时先绑定新 Stream，再清旧 Stream，可减少黑屏窗口。

## 15. stop 与 destroy

```text
Player.stop()
  → 取消帧 callback/timer
  → pause media element
  → srcObject = null / 清 src
  → 解绑媒体事件
  → 释放 Canvas/WebGL 资源
  → 从 DOM 移除内部创建的元素
```

如果元素是调用方提供的容器或节点，只能清 SDK 自己绑定的资源，不能随意删除用户 DOM。

Player 销毁通常不调用 sourceTrack.stop()；Track 是否停止由更上层资源所有者决定。

## 16. 资源释放检查表

- media element 是否 pause 并清 `srcObject`。
- `requestVideoFrameCallback`/RAF/timer 是否取消。
- Resize/Intersection Observer 是否断开。
- Canvas capture output Track 是否 stop。
- WebGL texture、buffer、framebuffer、program 是否 delete。
- context lost handler 是否解绑。
- Blob/Object URL 是否 revoke。
- 自动播放恢复队列是否删除当前 Player。

## 17. API 参数与本项目实参

### 17.1 `document.createElement(tagName, options?)`

MDN：[createElement()](https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement)

| 参数 | 含义 | 本项目实参 |
|---|---|---|
| `tagName` | 要创建的 HTML 元素名 | `'video'`、`'audio'`、`'canvas'`、`'div'` 等；媒体播放主路径创建 video/audio，截图和渲染创建 canvas |
| `options.is` | 可选的 customized built-in element 名称 | 未传 |

VideoPlayer 创建的 `<video>` 随后设置 `autoplay`、`playsinline`、`muted=true`，并将 Track 包装进 MediaStream 后赋给 `srcObject`。这一步是创建 UI 容器；真正开始解码/播放仍要调用 `play()`。

### 17.2 `mediaElement.srcObject = mediaProvider`

MDN：[HTMLMediaElement.srcObject](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/srcObject)

它是属性赋值，不是函数参数。项目给 Track 播放时传入的是：

```js
video.srcObject = new MediaStream([track]);
```

| 右侧值 | 含义 | 使用场景 |
|---|---|---|
| `new MediaStream([track])` | 只含当前原生 Track 的流 | 视频/音频 Track 首次绑定、换轨、Chrome 播放恢复 |
| `null` | 解绑当前媒体 provider | stop、destroy、切 URL、重建 MediaStream 前 |

这里每次新建 MediaStream 是重建“容器”，不是 clone Track。Chrome 恢复路径先置 `null` 再创建新流，解决元素仍引用旧流状态的问题。

URL 播放走不同路径：设置 `element.crossOrigin='anonymous'` 和 `element.src=url`，不会再同时保留 Track；`setUrl()` 先解绑 Track 和 `srcObject`。

### 17.3 `play()`、`pause()` 及媒体属性

MDN：[play()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play)、[pause()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/pause)

两个方法都无参数。`play()` 返回 Promise；`pause()` 返回 `undefined`。

```js
await new Promise((resolve, reject) => {
  this.element.play().then(resolve, reject);
});
```

| 项目写入 | 类型/范围 | 含义 |
|---|---|---|
| `muted` | boolean | 元素输出是否静音；本地视频元素固定 true，音频元素按播放器配置 |
| `volume` | `0..1` | 元素播放音量；初始化时源码 `Math.min(Math.max(value,0),1)` |
| `loop` | boolean | URL/音乐播放结束后是否循环 |
| `autoplay` | boolean/属性 | 元素具备媒体后尝试自动播放，但仍受用户激活策略约束 |
| `playsInline` / `playsinline` | boolean/属性 | 移动端尽量内联而非强制全屏 |
| `crossOrigin` | `anonymous` 等 | URL 媒体的 CORS 模式；Track `srcObject` 路径不需要 |

`NotAllowedError` 被包装为自动播放错误并引导用户点击恢复；`NotSupportedError` 在音乐路径会尝试重载资源。`pause()` 只是暂停元素时间推进，不停止 Track，也不取消订阅。

### 17.4 `setSinkId(deviceId)`

MDN：[setSinkId()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId)

唯一参数 `deviceId` 是 `enumerateDevices()` 返回的 `audiooutput` 设备 id；空字符串通常表示默认输出。返回 Promise。

```js
setSinkId(deviceId) {
  this._outputDeviceId = deviceId;
  if (this.element && this.element.sinkId !== deviceId) {
    await this.element.setSinkId?.(deviceId);
  }
}
```

公开 speakerId 先保存，即使元素尚未创建；`play()` 创建元素后再补调用。可选链意味着不支持该 API 时不会直接调用，但也不表示设备切换成功。权限策略、设备不存在或系统拒绝时 Promise 可 reject。

### 17.5 `requestVideoFrameCallback(callback)`

MDN：[requestVideoFrameCallback()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)

唯一参数是回调函数，返回 callback id。浏览器回调形态是 `callback(now, metadata)`：

```js
video.requestVideoFrameCallback((now, metadata) => {
  stat.width = metadata.width;
  stat.height = metadata.height;
  stat.fps = Math.round(
    (metadata.presentedFrames - previous.presentedFrames) /
    (now - previousNow) * 1000
  );
});
```

| 回调值 | 含义 | 本项目用途 |
|---|---|---|
| `now` | 与 performance timeline 同源的回调时间戳，毫秒 | 与上次回调时间差计算 FPS |
| `metadata.width/height` | 当前视频帧媒体像素尺寸 | 更新播放器 stat |
| `metadata.presentedFrames` | 已提交合成的帧总数 | 计算两次采样间新增帧数 |
| `metadata.presentationTime` | 预期展示时间 | 卡顿监控链使用 |

统计链不是每帧立即重复注册，而是在回调后通过 2000 ms timer 再注册，得到低频采样。渲染源链则在每帧回调中再次申请下一次回调。

`cancelVideoFrameCallback(id)` 的唯一参数是前一次返回的 id。Track 结束、源切换或隐藏页清理时项目传 `videoCallbackId`，避免旧源继续驱动渲染。

### 17.6 `canvas.getContext(contextId, options?)`

MDN：[getContext()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext)

2D 路径：

```js
canvas.getContext('2d', {
  alpha: option.alpha,
  willReadFrequently: option.willReadFrequently
});
```

| 2D option | 含义 | 本项目来源 |
|---|---|---|
| `alpha` | 是否需要透明通道；false 可让浏览器优化为不透明画布 | 创建 VideoContext 时的 `e.alpha` |
| `willReadFrequently` | 提示后续会频繁 `getImageData()`，浏览器可偏向 CPU 可读存储 | `e.willReadFrequently`；黑帧/像素分析场景使用 |

WebGL2 路径把 `senderWrapper` 作为第二参数：

```js
canvas.getContext('webgl2', {
  alpha: true,
  antialias: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false,
  depth: false,
  stencil: false,
  failIfMajorPerformanceCaveat: true,
  powerPreference: 'low-power'
});
```

| WebGL attribute | 本项目值 | 影响 |
|---|---:|---|
| `alpha` | true | 默认 framebuffer 保留 alpha，用于透明视频/合成 |
| `antialias` | false | 不请求多重采样，降低开销 |
| `premultipliedAlpha` | false | 不假定颜色已预乘 alpha |
| `preserveDrawingBuffer` | false | 展示后允许清空，提高性能；截图不能依赖旧 framebuffer 长期保留 |
| `depth` / `stencil` | false | 2D 视频合成不申请深度/模板缓冲 |
| `failIfMajorPerformanceCaveat` | true | 只有明显软件/低性能实现时允许创建失败并降级 |
| `powerPreference` | `'low-power'` | 提示优先低功耗 GPU；只是提示，不保证设备选择 |

返回值可能是 `null`，源码会包装为 VIDEO_MANAGER_ERROR，而不是继续调用空 context。

### 17.7 `drawImage()` 三种参数形态

MDN：[drawImage()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage)

| 形态 | 参数含义 | 本项目场景 |
|---|---|---|
| `drawImage(image, dx, dy)` | 原尺寸画到目标位置 | 截图：`drawImage(video,0,0)` |
| `drawImage(image, dx, dy, dWidth, dHeight)` | 缩放到目标矩形 | Canvas 视频渲染、黑帧检测 |
| `drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)` | 先裁源矩形，再缩放到目标矩形 | fill/crop、混流布局、旋转前处理 |

`image` 在项目中可以是 video、canvas、ImageBitmap、VideoFrame 或其他 CanvasImageSource。通用渲染器 L25201—L25208 根据是否给源裁剪参数选择 5 参数或 9 参数版本；若 source 是 `VideoFrame`，画完立即 `close()`，释放其媒体资源。

### 17.8 像素读写：`getImageData()` 与 `putImageData()`

MDN：[getImageData()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/getImageData)、[putImageData()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData)

- `getImageData(sx, sy, sw, sh)`：项目黑帧检测传 `(0,0,canvas.width,canvas.height)`，读取整个 RGBA 区域；alpha 拼接传实际 `(0,0,width,height)`。
- `putImageData(imageData, dx, dy)`：普通路径把 ImageData 放在目标 `(x,y)`。
- 七参数 `putImageData(imageData, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight)`：只更新 dirty rectangle；不会做缩放、旋转、混合和颜色转换。

频繁读像素非常昂贵，这也是对应 2D context 使用 `willReadFrequently:true` 的原因。

### 17.9 `canvas.captureStream(frameRate?)`

MDN：[captureStream()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream)

可选 `frameRate` 指定捕获帧率：省略时画布变化会产帧；传 `0` 时禁用自动捕获，需要 CanvasCaptureMediaStreamTrack 的 `requestFrame()` 主动产帧。

| 调用 | 本项目意图 |
|---|---|
| `canvas.captureStream(0)` | 编码能力探测，创建可控的测试视频 Track |
| `canvas.captureStream()` | H.264 回环测试、Player canvas 模式、VideoContext destination，按画布更新产帧 |

返回 `MediaStream`；项目立即 `getVideoTracks()[0]` 取得 `CanvasCaptureMediaStreamTrack`。停止该 Track 不销毁 canvas，销毁 canvas 也要单独清 DOM/尺寸引用。

### 17.10 截图 `toDataURL(type?, quality?)`

MDN：[toDataURL()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL)

| 参数 | 含义 | 本项目传值 |
|---|---|---|
| `type` | MIME 类型，默认 `image/png` | 显式 `'image/png'` |
| `quality` | 对 JPEG/WebP 等有意义的 `0..1` 质量值 | 未传；PNG 无需质量参数 |

VideoPlayer 若已有 canvas，直接 `canvas.toDataURL('image/png')`；否则创建临时 canvas，尺寸取 `videoWidth/videoHeight`，先 `drawImage(video,0,0)` 再编码。跨源 URL 视频没有正确 CORS 时画布可能 tainted，调用会抛 `SecurityError`；`crossOrigin='anonymous'` 只有服务端同时允许 CORS 才有效。

### 17.11 WebGL 参数进入顺序

WebGL 初始化不是只 `getContext()`：

```text
getContext('webgl2', attributes)
  → createShader(VERTEX_SHADER / FRAGMENT_SHADER)
  → shaderSource(shader, source)
  → compileShader(shader)
  → createProgram()
  → attachShader(program, shader)
  → linkProgram(program)
  → getProgramParameter(program, LINK_STATUS)
  → viewport(0, 0, width, height)
  → drawArrays(TRIANGLE_STRIP, 0, 4)
```

`viewport(x,y,width,height)` 在项目始终从 `(0,0)` 覆盖整张输出画布；`drawArrays(mode,first,count)` 传 `TRIANGLE_STRIP,0,4`，用四个顶点画满屏矩形。销毁时对应删除 shader、program、texture、buffer 和 framebuffer，context loss 时切错误/降级链。

## 18. 事实与边界

### 可以直接确认

- 源码同时存在原生元素播放和 Canvas/WebGL 渲染路径。
- `srcObject` 通过 MediaStream 包装单条 Track。
- Canvas 输出可以重新成为发布 Track。
- 自动播放恢复需要用户交互，并与媒体连接状态分离。

### 合理推断

- WebGL 用于需要高性能、多图层或 shader 的视频处理，2D 用于简单绘制和像素读取。
- Frame callback 优先是为了让处理节奏接近真实解码帧。

### 不能确认

- 各浏览器 GPU 驱动下的实际渲染性能、颜色空间和 context lost 频率，需要运行时验证。
