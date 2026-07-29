# 4. 媒体能力：AiNS、虚拟背景与混流

[← 上一章：通话流程与事件时序](./03-call-lifecycle.md) · [学习目录](./README.md) · [下一章：通话质量统计 →](./05-call-statistics.md)

本章使用 SDK 的 `RTCSession` 集成方式。呼叫或接听时传入初始配置，通话中从当前会话获取控制器。普通通话不需要业务创建独立处理实例，也不需要自行替换发送轨道。

## 4.1 三项能力的关系

| 能力 | 处理对象 | 初始入口 | 通话中入口 |
| --- | --- | --- | --- |
| AiNS | 本地麦克风音频 | `options.aiNoiseSuppression` | `session.getAiNoiseSuppression()` |
| AI 虚拟背景 | `slot 0` 本地摄像头画面 | `mediaEffectsComposer.sources[].aiBackground` | `session.getMediaEffectsComposer()` |
| 音视频混流 | 摄像头、屏幕或其他 `MediaStream` | `options.mediaEffectsComposer` | `session.getMediaEffectsComposer()` |

虚拟背景是混流器某一路视频源的效果，因此它放在 `mediaEffectsComposer.sources` 中，而不是独立的会话顶层参数。

## 4.2 创建统一的呼叫参数

呼出 `ua.call()` 和呼入 `session.answer()` 应使用同一个构造函数，避免两条路径效果不一致：

```js
const pcConfig = {
  iceServers : [
    {
      urls       : 'turn:turn.example.com:3478',
      username   : 'turn-user',
      credential : 'turn-password'
    }
  ]
};

function buildMediaOptions()
{
  return {
    pcConfig,
    mediaConstraints : {
      audio : {
        sampleRate   : 48000,
        channelCount : 1
      },
      video : {
        width     : { ideal: 1280 },
        height    : { ideal: 720 },
        frameRate : { ideal: 15 }
      }
    },
    aiNoiseSuppression : {
      enabled             : true,
      level : 80,
      outputGain          : 1,
      assetConfig         : { cdnUrl: './assets/ains' }
    },
    mediaEffectsComposer : {
      width  : 1280,
      height : 720,
      fps    : 15,
      sources : [
        {
          slot : 0,
          aiBackground : {
            mode         : 'blur',
            blurRadius   : 16,
            assetConfig : { cdnUrl: './assets/aivb' }
          }
        }
      ]
    }
  };
}
```

应用到呼出和接听：

```js
function startVideoCall(target)
{
  return ua.call(target, buildMediaOptions());
}

function answerVideoCall()
{
  if (currentSession && currentSession.direction === 'incoming')
  {
    currentSession.answer(buildMediaOptions());
  }
}
```

不需要某项能力时，删除对应字段即可。纯音频通话不需要配置 `mediaEffectsComposer`。

## 4.3 AiNS

AiNS 处理本地麦克风轨道。建议请求 `48000Hz` 单声道，并避免同时启用其他第三方降噪，防止重复处理造成声音失真或音量降低。

### 参数

| 参数 | 类型 | 默认值 | 范围或说明 |
| --- | --- | ---: | --- |
| `enabled` | `boolean` | `true` | 是否启用 |
| `level` | `number` | `80` | `0~100` |
| `outputGain` | `number` | `1` | `0~4` |
| `sampleRate` | `number` | `48000` | 正整数 |
| `keepOtherTracks` | `boolean` | `true` | 是否保留输入流中的非音频轨道 |
| `assetConfig.cdnUrl` | `string` | `./static` | AiNS 资源目录 |

`cdnUrl` 目录应包含：

```text
ans.wasm
ans_onnx.tar.gz
```

### 通话中调整

```js
function updateAiNS(level, gain)
{
  const controller = currentSession &&
    currentSession.getAiNoiseSuppression();

  if (!controller)
  {
    console.warn('当前会话未启用 AiNS，或控制器尚未创建');
    return;
  }

  controller.setLevel(level);
  const appliedGain = controller.setOutputGain(gain);

  console.log('实际应用增益：', appliedGain);
}
```

若本通电话开始时未启用 AiNS，通话中无法通过 getter 创建控制器，应在下一次呼叫或接听参数中启用。

`getAiNoiseSuppression()` 在当前会话未配置 AiNS、控制器尚未创建或会话已结束时返回 `null`。

### Demo 对照

Base JS Demo 中对应：

- `getNsOpts()`：构造呼叫和接听参数。
- `setNsLevel()`：通话中修改降噪强度。
- `setNsGain()`：通话中修改输出增益。

这些函数位于 [`demo/base-js/js/app-effects.js`]。

Demo 的实际初始配置只在页面选中 AiNS 时返回对象：

```js
function getNsOpts()
{
  if (aiNsType !== 'AiNS')
  {
    return null;
  }

  return {
    enabled             : true,
    level : getNsLevel(),
    outputGain          : 1,
    assetConfig         : { cdnUrl: AI_NOISE_ASSET_ROOT }
  };
}
```

通话中热更新不会新建控制器，而是检查当前会话已经存在的 AiNS 实例：

```js
function setNsLevel(level)
{
  if (aiNsType !== 'AiNS' || !rtcSession)
  {
    return false;
  }

  const aiNsEngine = rtcSession.getAiNoiseSuppression();

  if (!aiNsEngine)
  {
    return false;
  }

  aiNsEngine.setLevel(level);

  return true;
}
```

两段代码均取自 [`app-effects.js`](../../demo/base-js/js/app-effects.js)。`false` 表示当前通话无法热更新，Demo 会提示“将在下一次呼叫/接听时生效”。

## 4.4 AI 虚拟背景

SDK 会话集成中，本地摄像头是 `slot 0`。虚拟背景配置属于该输入源。

### 背景模式

```js
const blurBackground = {
  mode       : 'blur',
  blurRadius : 16
};

const imageBackground = {
  mode     : 'image',
  imageUrl : 'https://static.example.com/office.jpg'
};

const colorBackground = {
  mode  : 'color',
  color : '#1f2937'
};

const noBackgroundEffect = {
  mode : 'none'
};
```

### 常用参数

| 参数 | 默认值 | 说明 |
| --- | ---: | --- |
| `enabled` | `true` | `false` 表示暂停虚拟背景处理；需要删除已有配置时调用清除方法 |
| `mode` | `none` | `none`、`blur`、`image`、`color` |
| `imageUrl` | — | 图片背景 URL |
| `color` | — | 纯色背景 CSS 颜色 |
| `blurRadius` | `12` | 背景模糊半径 |
| `video.width` / `video.height` | `1280` / `720` | 输入处理尺寸 |
| `video.targetFps` | `15` | 处理帧率，范围 `1~60` |
| `video.mirror` | `false` | 是否镜像输入源 |
| `video.processingScale` | `0.5` | 处理缩放，范围 `0.1~1` |
| `segmentation.frameSkip` | `1` | 跳帧数，范围 `0~120` |
| `postProcessing.maxBlurRadius` | `20` | 最大模糊半径，范围 `0~100` |
| `postProcessing.foregroundBrightness` | `1.12` | 前景亮度，范围 `0.5~2` |
| `postProcessing.foregroundContrast` | `1.10` | 前景对比度，范围 `0.5~2` |
| `postProcessing.foregroundSaturate` | `1.08` | 前景饱和度，范围 `0~2` |

### 资源配置

使用 `assetConfig.cdnUrl` 时，目录应包含：

```text
vision.js
vision_wasm_internal.js
vision_wasm_internal.wasm
vision_wasm_nosimd_internal.js
vision_wasm_nosimd_internal.wasm
selfie_segmenter_landscape.tflite
```

也可以分别配置 `moduleUrl`、`wasmBaseUrl` 和 `modelUrl`。显式 URL 优先于 `cdnUrl`。

### 通话中切换背景

```js
function useImageBackground(imageUrl)
{
  const composer = currentSession &&
    currentSession.getMediaEffectsComposer();

  if (!composer)
  {
    console.warn('当前会话未启用 mediaEffectsComposer');
    return;
  }

  composer.setAiBackground(0, {
    mode : 'image',
    imageUrl,
    assetConfig : { cdnUrl: './assets/aivb' }
  });
}

function clearVirtualBackground()
{
  const composer = currentSession &&
    currentSession.getMediaEffectsComposer();

  composer && composer.clearAiBackground(0);
}
```

调用示例：`useImageBackground('https://static.example.com/meeting-room.jpg')`。

图片跨域时，图片服务器必须返回允许当前页面访问的 CORS 响应头。

### Demo 对照

- `getFxOpts()`：构造混流和虚拟背景初始配置。
- `setVb()`：通话中切换背景。
- 函数实现见 [`app-effects.js`]，页面控件见 [`index.html`]。

Demo 把当前视频约束和页面选择转换为 AiVB 配置。以下是 [`app-effects.js`](../../demo/base-js/js/app-effects.js) 的模式构造节选：

```js
const aiVBOptions = {
  assetConfig : { cdnUrl: AI_VB_TASKS_ROOT },
  video       : {
    width     : sourceWidth,
    height    : sourceHeight,
    targetFps : Math.min(sourceFps, 15)
  }
};

if (virtualBackgroundType === 'blur')
{
  aiVBOptions.mode = 'blur';

  return aiVBOptions;
}

const imageUrl = virtualBackgroundImgs[virtualBackgroundType];

if (!imageUrl)
{
  return null;
}

aiVBOptions.mode = 'image';
aiVBOptions.imageUrl = imageUrl;
```

通话中使用同一个构造结果更新 slot 0：

```js
const aiVBOptions = getVbOpts();

if (!aiVBOptions)
{
  sessionComposer.clearAiBackground(0);
}
else
{
  sessionComposer.setAiBackground(0, aiVBOptions);
}
```

这样初始呼叫和通话中切换不会出现两套背景参数解析规则。

## 4.5 音视频混流

启用 `mediaEffectsComposer` 后，本地摄像头作为 `slot 0`。SDK 将合成结果用于当前通话，业务无需再次获取输出流。

Base JS Demo 根据页面当前镜像、水印和虚拟背景状态构造 composer。以下代码取自 [`app-effects.js`](../../demo/base-js/js/app-effects.js)：

```js
function getFxOpts()
{
  const outputMirror = document.getElementById('fxMirror').value === 'on';
  const aiVBOptions = getVbOpts();
  const watermarks = [];
  const textMark = getTextMark();
  const imageMark = getImageMark();

  if (textMark) watermarks.push(textMark);
  if (imageMark) watermarks.push(imageMark);

  const hasComposerEffects = outputMirror || watermarks.length || aiVBOptions;
  const composerOptions = {};

  if (outputMirror)
  {
    composerOptions.mirror = true;
  }

  if (watermarks.length)
  {
    composerOptions.watermarks = watermarks;
  }

  if (aiVBOptions)
  {
    composerOptions.sources = [
      {
        aiBackground : aiVBOptions
      }
    ];
  }

  if (hasComposerEffects)
  {
    composerOptions.insertable = true;
  }

  if (!hasComposerEffects)
  {
    return null;
  }

  return composerOptions;
}
```

返回 `null` 表示本次呼叫不需要 composer，可以避免普通通话额外创建渲染链路。

### 会话配置

| 参数 | 类型/可选值 | 默认值 | 说明 |
| --- | --- | ---: | --- |
| `width` / `height` | 正整数 | `1280` / `720` | 合成输出尺寸 |
| `fps` | 正整数 | 通常 `15` | 输出帧率；部分需要帧率纠偏的浏览器环境会使用适配值 |
| `backgroundColor` | CSS color | `#000` | 无画面区域背景色 |
| `audioGain` | `number` | `0.8` | 输入源默认音频增益 |
| `sourceMirror` | `boolean` | `false` | 输入源默认镜像 |
| `mirror` | `boolean` | `false` | 最终输出是否镜像 |
| `mirrorWatermarks` | `boolean` | `false` | 输出镜像时水印是否一起镜像 |
| `watermarks` | 对象、数组或 `null` | `[]` | 初始水印配置 |
| `sources` | 数组或 `null` | `null` | 各输入源的 slot、增益、镜像和虚拟背景 |

`sources[]`：

| 字段 | 类型/范围 | 默认/说明 |
| --- | --- | --- |
| `slot` | 非负整数 | 输入槽位；通话摄像头通常为 `0` |
| `gain` | `number` | 该路音频增益；未传使用 `audioGain` |
| `sourceMirror` | `boolean` | 覆盖该路输入镜像 |
| `aiBackground` | AiVB 配置或 `null` | 该路视频的虚拟背景 |

### 添加屏幕作为第二路源

```js
let screenStream = null;

async function addScreenToComposer()
{
  const composer = currentSession &&
    currentSession.getMediaEffectsComposer();

  if (!composer)
  {
    throw new Error('当前会话未启用 mediaEffectsComposer');
  }

  screenStream = await navigator.mediaDevices.getDisplayMedia({
    video : true,
    audio : true
  });

  composer.addSource(screenStream, {
    slot : 1,
    gain : 0.7
  });

  const screenTrack = screenStream.getVideoTracks()[0];

  screenTrack.addEventListener('ended', function()
  {
    composer.removeSource(screenStream);
    screenStream = null;
  });
}
```

同一 `slot` 添加新输入会替换原输入，最多支持 9 路源。移除输入时使用 `removeSource(stream)`，清空全部输入时使用 `clearSources()`。

### 更新镜像和水印

```js
async function updateComposerDisplay()
{
  const composer = currentSession &&
    currentSession.getMediaEffectsComposer();

  if (!composer)
  {
    return;
  }

  await composer.setMirror(true);
  await composer.setWatermarks([
    {
      id       : 'brand',
      target   : 'output',
      type     : 'text',
      text     : 'CRTC',
      fontSize : 28,
      color    : '#ffffff',
      opacity  : 1,
      position : 'bottom-right'
    }
  ]);
}
```

更新部分水印时，可先用 `getWatermarks()` 读取当前列表，按稳定 ID 替换对应项后再调用 `setWatermarks()`，避免误删其他水印。

Demo 对单个文字水印的处理就是“读取当前列表→按 ID 合并→全量写回”：

```js
const watermarks = mergeMarks(
  watermark ? [ watermark ] : [],
  [ CALL_TEXT_WATERMARK_ID ]
);

try
{
  await setMarks(watermarks);
  setStatus(watermark ? '已应用当前文字水印到当前通话' : '已清除当前文字水印');
}
catch (error)
{
  console.warn('setTextMark error', error);
}
```

该节选来自 [`app-effects.js`](../../demo/base-js/js/app-effects.js)。图片水印使用相同流程，只替换稳定 ID 和水印构造函数。

### 水印参数

| 参数 | 类型/可选值 | 默认值 | 说明 |
| --- | --- | ---: | --- |
| `id` | `string` | 自动/业务设置 | 建议为每个业务水印提供稳定 ID |
| `target` | `output` / `source` | `output` | 输出级或输入源级水印 |
| `type` | `text` / `image` | 按内容推导 | 文字或图片 |
| `text` | `string` | — | 文字内容 |
| `image` | URL、图片/画布/视频元素或 ImageBitmap | — | 图片内容 |
| `position` | 7 个预设或 `{ x, y }` | 预设默认 | 锚点或坐标 |
| `width` / `height` | 正整数 | 图片原始/推导尺寸 | 图片绘制尺寸 |
| `opacity` | `0～1` | `1` | 透明度 |
| `fontSize` | 正整数 | `28` | 文字字号 |
| `color` | CSS color | `#fff` | 文字颜色 |
| `backgroundColor` | CSS color | `rgba(0,0,0,0.45)` | 文字背景 |
| `padding` | 非负整数 | `3` | 文字背景内边距 |
| `backgroundRadius` | 非负整数 | `3` | 背景圆角 |
| `margin` | 非负整数 | `16` | 与画布边缘距离 |

预设位置：`top-left`、`top-center`、`top-right`、`center`、`bottom-left`、`bottom-center`、`bottom-right`。

`width`、`height` 和 `fps` 等初始参数不支持在已有实例上热更新。需要改变这些参数时，在下一次呼叫或接听中传入新配置。

## 4.6 统一处理媒体效果异常

```js
session.on('mediaEffectsIssue', function(event)
{
  console.warn('媒体效果异常：', event.module, event.message);
  showToast('当前媒体效果不可用，通话将继续');
});
```

媒体效果失败时不要直接挂断。SDK 会尽量继续使用可用的原始媒体，业务可以关闭对应控件并提示用户。

建议只依赖以下稳定字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `module` | `AiNS` / `MediaEffectsComposer` | 出问题的能力 |
| `message` | `string` | 可记录的错误说明 |

### 常见故障与页面处理

| 现象 | 常见原因 | 页面处理 |
| --- | --- | --- |
| AiNS 资源加载失败 | cdnUrl、404、CORS、WASM 被网关改写 | 提示降噪不可用，继续基础音频 |
| 输入流没有音频 track | 纯视频、自定义流构造错误 | 不启用 AiNS，检查媒体流 |
| 虚拟背景模型失败 | 模型/WASM/vision.js 不可访问 | 清除背景效果，继续摄像头 |
| 图片背景或水印失败 | URL、CORS、图片解码 | 提示资源不可用，保留其他效果 |
| 混流效果异常 | 浏览器能力或性能限制 | 降低输出尺寸/FPS，继续观察 |
| 控制器为 `null` | 本通电话没有初始化该能力或已结束 | 不调用方法，下次 call/answer 配置 |

## 4.7 初始配置和热更新边界

| 参数/操作 | 通话中可更新 | 推荐入口 |
| --- | --- | --- |
| AiNS 强度 | 是 | `setLevel()` |
| AiNS 输出增益 | 是 | `setOutputGain()` |
| 虚拟背景模式/图片/颜色 | 是 | `setAiBackground(0, options)` |
| 清除虚拟背景 | 是 | `clearAiBackground(0)` |
| 输出镜像 | 是 | `setMirror(boolean)` |
| 水印列表 | 是 | `setWatermarks()` |
| composer 宽、高、FPS | 否，下一通配置 | `call/answer` 的 `mediaEffectsComposer` |
| 从未启用的 composer/AiNS | 不能靠 getter 创建 | 下一通 `call/answer` 配置 |

## 4.8 性能选择建议

| 设备/场景 | 初始建议 |
| --- | --- |
| 普通桌面视频 | `640×480` 或 `1280×720`、`15fps` |
| 移动端/低性能设备 | 先 `640×480@15fps`，减少后处理 |
| 虚拟背景 + 水印 | 先确认单路效果稳定，再组合 |
| 多路输入 | 控制每路分辨率/FPS，观察 CPU、掉帧和编码耗时 |
| 屏幕文字内容 | `contentHint='detail'/'text'`，同时验证清晰度和帧率 |

效果参数越高不一定体验越好。可结合第 5 章的码率、帧率、分辨率和质量提示观察实际体验。

## 4.9 上线检查

- 呼出和呼入都使用同一套媒体参数。
- AiNS 和虚拟背景资源均可从生产页面直接访问。
- 资源服务器已正确配置 HTTPS、CORS 和内容类型。
- 切换背景、添加屏幕和停止共享都已验证。
- 会话结束后页面不再保存旧 composer 或 AiNS 控制器。
- 移动浏览器上验证过摄像头方向、画布尺寸、帧率和性能。

旧版接口的逐项迁移见 [旧版功能升级指南](./07-upgrade-guide.md)。

[← 上一章：通话流程与事件时序](./03-call-lifecycle.md) · [下一章：通话质量统计 →](./05-call-statistics.md)
