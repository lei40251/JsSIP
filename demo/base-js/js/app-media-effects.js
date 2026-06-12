/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable no-undef */

/**
 * @fileoverview 媒体效果管理模块
 *
 * 这里主要放“效果本身”的逻辑：
 * 1. AI 虚拟背景
 * 2. AI 降噪（AiNS）
 * 3. MediaEffectsComposer 配置构建
 *
 * 纯 UI 绑定尽量放到 app.ui-bindings.js，这里只保留状态和处理流程。
 */

// =============================================================================
// 虚拟背景状态
// =============================================================================

// 当前选中的虚拟背景类型：''、'none'、'blur'、'img1'、'img2'
let virtualBackgroundType = '';

// 本地预览专用的 MediaEffectsComposer，和通话中的 composer 分开
let virtualBackgroundPreviewEngine = null;

// 本地预览专用的摄像头输入流
let virtualBackgroundPreviewInputStream = null;

// 当前是否已经在做本地虚拟背景演示
let virtualBackgroundPreviewActive = false;

// 当前是否正在启动本地虚拟背景演示，避免重复点击
let virtualBackgroundPreviewPending = false;

// 演示里内置的两张背景图
const virtualBackgroundImgs = {
  img1 : './virtual-background/backgrounds/office.png',
  img2 : './virtual-background/backgrounds/sky.jpg'
};

// AI 虚拟背景资源目录
const AI_VB_TASKS_ROOT = './assets/aivb';

// AI 虚拟背景运行需要的模型和 wasm 资源
const AI_VB_ASSET_CONFIG = {
  moduleUrl   : `${AI_VB_TASKS_ROOT}/vision.js`,
  wasmBaseUrl : AI_VB_TASKS_ROOT,
  modelUrl    : `${AI_VB_TASKS_ROOT}/selfie_segmenter_landscape.tflite`
};

// =============================================================================
// AI 降噪（AiNS）状态
// =============================================================================

// 当前是否启用了 AiNS。演示里只处理 '' 和 'AiNS' 两种值。
let aiNsType = '';

// AI 降噪资源目录
const AI_NOISE_ASSET_ROOT = './assets/ains';

// 本地试听时采集到的原始麦克风流
let aiNsMonitorStream = null;

// 本地试听时创建出来的降噪处理器
let aiNsMonitorProcessor = null;

// 当前是否正在本地试听降噪
let aiNsMonitorActive = false;

/**
 * 把新的降噪强度应用到当前通话。
 * 这个方法虽然逻辑不长，但它依赖当前模块维护的 AiNS 模式和会话状态，
 * 所以仍然放在媒体效果模块里，而不是拆到 UI 事件或 helper 里。
 */
function applyAiNsLevelToCurrentCall(level)
{
  // 只有当前模块处于 AiNS 模式时，才需要把强度下发到当前会话
  if (aiNsType !== 'AiNS' || !rtcSession)
  {
    return false;
  }

  // 当前会话可能还没创建 AiNS 实例，没有的话就留给下一次呼叫时生效
  const aiNsEngine = rtcSession.getAiNoiseSuppression();

  if (!aiNsEngine)
  {
    return false;
  }

  // 直接更新当前通话里的降噪强度
  aiNsEngine.setSuppressionLevel(level);

  return true;
}

// =============================================================================
// AiNS 本地试听链路
// =============================================================================

/**
 * 停止本地试听：
 * 1. 先更新状态和按钮
 * 2. 再停掉 audio 标签播放
 * 3. 再释放处理器和采集流
 */
async function stopAiNsMonitor()
{
  // 演示页里固定使用这个 audio 元素来回放试听结果
  const monitorAudio = document.querySelector('#aiNoiseMonitorAudio');

  // 先改状态，按钮能第一时间切回“开始验证”
  aiNsMonitorActive = false;
  updateAiNsMonitorButton();

  // 停止页面上的音频播放
  monitorAudio.pause();
  monitorAudio.srcObject = null;

  // 如果已经创建过 AiNS 处理器，这里销毁它
  if (aiNsMonitorProcessor)
  {
    try
    {
      await aiNsMonitorProcessor.destroy();
    }
    catch (error)
    {
      console.warn('stopAiNsMonitor destroy error', error);
    }
  }

  // 关闭本地采集到的麦克风轨道
  if (aiNsMonitorStream)
  {
    aiNsMonitorStream.getTracks().forEach((track) => track.stop());
  }

  // 最后把状态清空，方便下一次重新开始
  aiNsMonitorStream = null;
  aiNsMonitorProcessor = null;
}

/**
 * 根据当前下拉框状态，把试听链路切到：
 * 1. 原声
 * 2. AiNS 处理后音频
 */
async function applyAiNsMonitorState(forceStatus = false)
{
  // 没有开始试听时，不需要做任何事
  if (!aiNsMonitorActive || !aiNsMonitorStream)
  {
    return;
  }

  // 演示页的试听回放目标
  const monitorAudio = document.querySelector('#aiNoiseMonitorAudio');

  // 当前 UI 上的降噪强度
  const level = getCurrentAiNsLevel();

  // 选中了 AiNS，就走处理后的音频
  if (aiNsType === 'AiNS')
  {
    // 第一次切到 AiNS 时，先创建处理器并生成处理后流
    if (!aiNsMonitorProcessor)
    {
      aiNsMonitorProcessor = new CRTC.AiNSEngine({
        enabled             : true,
        preserveOtherTracks : true,
        noiseReductionLevel : level,
        assetConfig         : { cdnUrl: AI_NOISE_ASSET_ROOT }
      });

      const processedStream = await aiNsMonitorProcessor.process(aiNsMonitorStream);

      monitorAudio.srcObject = processedStream;
    }
    else
    {
      // 已经有处理器时，只需要更新开关和强度即可
      await aiNsMonitorProcessor.setEnabled(true);
      aiNsMonitorProcessor.setSuppressionLevel(level);
    }

    // 每次都重新 play，确保试听能正常出声
    await monitorAudio.play();
    setStatus(`本地降噪验证中，当前强度 ${level}`);

    return;
  }

  // 这里说明用户把 AiNS 关掉了，试听要退回原声
  if (aiNsMonitorProcessor)
  {
    await aiNsMonitorProcessor.destroy();
    aiNsMonitorProcessor = null;
  }

  // 回放原始麦克风流，方便对比效果
  monitorAudio.srcObject = aiNsMonitorStream;
  await monitorAudio.play();

  // 只有在需要时才提示状态，避免每次都刷屏
  if (forceStatus)
  {
    setStatus('本地麦克风原声验证中（未开启 AI 降噪）');
  }
}

// =============================================================================
// MediaEffectsComposer 配置构建
// =============================================================================

/**
 * 根据当前下拉框，构建 AI 虚拟背景配置。
 */
function buildSelectedAiVirtualBackgroundOptions()
{
  // 没选任何效果，就不返回配置
  if (!virtualBackgroundType)
  {
    return null;
  }

  // 演示页直接复用当前视频采集参数
  const sourceWidth = Number(videoConstraints.width) || 640;
  const sourceHeight = Number(videoConstraints.height) || 480;
  const sourceFps = Number(videoConstraints.frameRate) || 15;

  // 分辨率越高，处理缩放比例越小，减轻分割压力
  let processingScale = 0.4;

  if (sourceWidth * sourceHeight >= 1280 * 720)
  {
    processingScale = 0.3;
  }
  else if (sourceWidth * sourceHeight >= 640 * 480)
  {
    processingScale = 0.35;
  }

  // 这是三种模式都会共用的基础配置
  const aiVirtualBackground = {
    enabled        : true,
    startupDelayMs : 0,
    maxRuntimeFps  : Math.min(sourceFps, 15),
    assetConfig    : Object.assign({}, AI_VB_ASSET_CONFIG),
    segmentation   : {
      delegate  : 'GPU',
      frameSkip : 0
    },
    video : {
      width           : sourceWidth,
      height          : sourceHeight,
      targetFps       : Math.min(sourceFps, 15),
      processingScale : processingScale
    }
  };

  // 纯虚化模式
  if (virtualBackgroundType === 'blur')
  {
    aiVirtualBackground.mode = 'blur';
    aiVirtualBackground.blurRadius = 16;

    return aiVirtualBackground;
  }

  // 只保留人物，不替换背景
  if (virtualBackgroundType === 'none')
  {
    aiVirtualBackground.mode = 'none';

    return aiVirtualBackground;
  }

  // 其余值都按图片背景处理
  aiVirtualBackground.mode = 'image';
  aiVirtualBackground.imageUrl = virtualBackgroundImgs[virtualBackgroundType];

  return aiVirtualBackground;
}

/**
 * 从页面读取当前所有 MediaEffectsComposer 设置。
 * 这个配置会在呼叫发起时传入 SDK，也可以在通话中重新应用。
 */
function buildCallMediaEffectsComposerOptions(options = {})
{
  // includeDisabledState=true 时，即使用户没开效果，也返回完整的“空配置”
  const { includeDisabledState = false } = options;

  // 是否开启输出镜像
  const outputMirror = document.getElementById('callMediaEffectsComposerOutputMirror').checked;

  // 虚拟背景配置来自上面的统一构建函数
  const aiVirtualBackground = buildSelectedAiVirtualBackgroundOptions();

  // 文字水印和图片水印都会塞进这里
  const watermarks = [];

  // ---------------------------------------------------------------------------
  // 文字水印
  // ---------------------------------------------------------------------------

  // 文字内容为空时，就不创建文字水印
  const text = document.getElementById('callMediaEffectsComposerTextWatermarkText').value.trim();

  if (text)
  {
    // 这些都是文字水印的可选参数
    const textPosition = document.getElementById('callMediaEffectsComposerTextWatermarkPosition').value || 'bottom-right';
    const textSize = document.getElementById('callMediaEffectsComposerTextWatermarkSize').value;
    const textColor = document.getElementById('callMediaEffectsComposerTextWatermarkColor').value.trim();
    const textOpacity = readCallMediaEffectsComposerOpacity(
      document.getElementById('callMediaEffectsComposerTextWatermarkOpacity')
    );

    // 先组织最小必填字段
    const textWatermark = {
      id       : 'call-output-text-watermark',
      target   : 'output',
      type     : 'text',
      text     : text,
      position : textPosition
    };

    // 大小有填就带上
    if (String(textSize).trim())
    {
      textWatermark.fontSize = Number(textSize);
    }

    // 颜色有填就带上
    if (textColor)
    {
      textWatermark.color = textColor;
    }

    // 透明度写了才带上，没写就走 SDK 默认值
    if (textOpacity !== undefined)
    {
      textWatermark.opacity = textOpacity;
    }

    watermarks.push(textWatermark);
  }

  // ---------------------------------------------------------------------------
  // 图片水印
  // ---------------------------------------------------------------------------

  // 图片地址为空时，就不创建图片水印
  const imageUrl = document.getElementById('callMediaEffectsComposerImageWatermarkUrl').value.trim();

  if (imageUrl)
  {
    // 这些都是图片水印的可选参数
    const imagePosition = document.getElementById('callMediaEffectsComposerImageWatermarkPosition').value || 'bottom-right';
    const imageWidth = document.getElementById('callMediaEffectsComposerImageWatermarkWidth').value;
    const imageHeight = document.getElementById('callMediaEffectsComposerImageWatermarkHeight').value;
    const imageOpacity = readCallMediaEffectsComposerOpacity(
      document.getElementById('callMediaEffectsComposerImageWatermarkOpacity')
    );

    // 先组织最小必填字段
    const imageWatermark = {
      id       : 'call-output-image-watermark',
      target   : 'output',
      type     : 'image',
      image    : imageUrl,
      position : imagePosition
    };

    // 宽高只在用户填写后才传入
    if (String(imageWidth).trim())
    {
      imageWatermark.width = Number(imageWidth);
    }

    if (String(imageHeight).trim())
    {
      imageWatermark.height = Number(imageHeight);
    }

    // 透明度写了才带上
    if (imageOpacity !== undefined)
    {
      imageWatermark.opacity = imageOpacity;
    }

    watermarks.push(imageWatermark);
  }

  // ---------------------------------------------------------------------------
  // 最终 composer 配置
  // ---------------------------------------------------------------------------

  const composerOptions = {};

  // includeDisabledState 时，镜像也要明确传 true/false
  if (includeDisabledState)
  {
    composerOptions.mirror = outputMirror;
  }
  else if (outputMirror)
  {
    composerOptions.mirror = true;
  }

  // 有需要时再带上水印数组
  if (includeDisabledState || watermarks.length)
  {
    composerOptions.watermarks = watermarks;
  }

  // sources[0] 只放当前主视频源的 AI 虚拟背景配置
  if (includeDisabledState || aiVirtualBackground)
  {
    composerOptions.sources = [
      {
        aiVirtualBackground : aiVirtualBackground || null
      }
    ];
  }

  // 只要有任何效果，就开启 insertable 流程
  if (includeDisabledState || outputMirror || watermarks.length || aiVirtualBackground)
  {
    composerOptions.enableInsertable = true;
  }

  // 发起呼叫时如果完全没配任何效果，直接返回 null，让上层不用传这个字段
  if (!includeDisabledState && !outputMirror && !watermarks.length && !aiVirtualBackground)
  {
    return null;
  }

  return composerOptions;
}

/**
 * 把当前镜像、水印、虚拟背景一次性应用到当前通话。
 */
async function applyCurrentComposerSettingsToSession()
{
  // 旧接口通过 getMediaEffectsComposer() 直接拿 composer 实例
  const sessionComposer = rtcSession && rtcSession.getMediaEffectsComposer ?
    rtcSession.getMediaEffectsComposer() :
    null;

  // 新接口通过 rtcSession.updateMediaEffectsComposer() 整体更新
  const canUpdateSessionComposer = Boolean(rtcSession && rtcSession.updateMediaEffectsComposer);

  // 当前没有会话或者 SDK 没暴露相关能力时，直接提示即可
  if (!sessionComposer && !canUpdateSessionComposer)
  {
    setStatus('当前没有可更新的 MediaEffectsComposer');

    return;
  }

  // 这里拿的是“完整状态”，包括关闭的字段，方便通话中覆盖旧配置
  const composerOptions = buildCallMediaEffectsComposerOptions({ includeDisabledState: true });

  try
  {
    // 新接口：整包更新
    if (canUpdateSessionComposer)
    {
      await rtcSession.updateMediaEffectsComposer(composerOptions);
    }
    else
    {
      // 旧接口：镜像和水印走 setConfig，虚拟背景单独设置
      const aiVirtualBackground = buildSelectedAiVirtualBackgroundOptions();

      await sessionComposer.setConfig({
        outputMirror : Boolean(composerOptions.mirror),
        watermarks   : composerOptions.watermarks || []
      });

      // 没选虚拟背景时清掉 sources[0] 上的效果，选了就直接覆盖
      if (!aiVirtualBackground)
      {
        sessionComposer.clearSourceAiVirtualBackground(0);
      }
      else
      {
        sessionComposer.setSourceAiVirtualBackground(0, aiVirtualBackground);
      }
    }

    setStatus('已应用当前镜像/水印设置到当前通话');
  }
  catch (error)
  {
    console.warn('applyCurrentComposerSettingsToSession error', error);
    setStatus(`应用合成设置失败：${error && error.message ? error.message : error}`);
  }
}

// =============================================================================
// 虚拟背景本地预览
// =============================================================================

/**
 * 把当前虚拟背景应用到当前通话。
 * 和“全量应用 composer 配置”相比，这里只关注虚拟背景。
 */
async function applyVirtualBackgroundToCurrentSession()
{
  // 旧接口：直接拿 composer
  const sessionComposer = rtcSession && rtcSession.getMediaEffectsComposer ?
    rtcSession.getMediaEffectsComposer() :
    null;

  // 新接口：通过 rtcSession 整体更新
  const canUpdateSessionComposer = Boolean(rtcSession && rtcSession.updateMediaEffectsComposer);

  // 两种方式都没有，就说明当前没法应用
  if (!sessionComposer && !canUpdateSessionComposer)
  {
    return;
  }

  try
  {
    // 新接口走完整 composer 配置
    if (canUpdateSessionComposer)
    {
      await rtcSession.updateMediaEffectsComposer(
        buildCallMediaEffectsComposerOptions({ includeDisabledState: true })
      );
    }
    else
    {
      // 旧接口只改 sources[0] 的虚拟背景
      const aiVirtualBackground = buildSelectedAiVirtualBackgroundOptions();

      if (!aiVirtualBackground)
      {
        sessionComposer.clearSourceAiVirtualBackground(0);
      }
      else
      {
        sessionComposer.setSourceAiVirtualBackground(0, aiVirtualBackground);
      }
    }
  }
  catch (error)
  {
    console.warn('applyVirtualBackgroundToCurrentSession error', error);
    setStatus(`应用虚拟背景失败：${error && error.message ? error.message : error}`);
  }
}

/**
 * 停止本地虚拟背景演示。
 */
async function stopVirtualBackgroundPreview(options = {})
{
  // 默认停止后恢复成当前通话预览；如果没有通话，就清空本地 video
  const { restoreSessionPreview = true } = options;

  // 先把界面状态切回“未演示”
  virtualBackgroundPreviewPending = false;
  virtualBackgroundPreviewActive = false;
  updateVirtualBackgroundPreviewButton();

  // 停掉本地演示 composer
  if (virtualBackgroundPreviewEngine)
  {
    try
    {
      virtualBackgroundPreviewEngine.stop();
    }
    catch (error)
    {
      console.warn('stopVirtualBackgroundPreview stop error', error);
    }
  }

  // 释放为了演示额外采集到的摄像头流
  if (virtualBackgroundPreviewInputStream)
  {
    virtualBackgroundPreviewInputStream.getTracks().forEach((track) => track.stop());
  }

  // 把状态清空，避免下次复用旧实例
  virtualBackgroundPreviewEngine = null;
  virtualBackgroundPreviewInputStream = null;

  // 结束演示后，恢复页面上的本地预览
  if (restoreSessionPreview)
  {
    if (rtcSession && rtcSession.connection)
    {
      getStreams(rtcSession.connection);
    }
    else
    {
      localVideo.srcObject = null;
    }
  }
}

/**
 * 启动本地虚拟背景演示。
 * 这里会额外采一条摄像头流，只给本地看效果，不影响当前通话链路。
 */
async function startVirtualBackgroundPreview()
{
  // 演示必须先选中一个虚拟背景类型
  if (!virtualBackgroundType)
  {
    throw new Error('请先选择虚拟背景效果');
  }

  // 先从摄像头采一条本地输入流
  virtualBackgroundPreviewInputStream = await navigator.mediaDevices.getUserMedia({
    audio : false,
    video : videoConstraints
  });

  // 再基于这条流创建一个独立的本地 composer
  virtualBackgroundPreviewEngine = new CRTC.MediaEffectsComposer(virtualBackgroundPreviewInputStream, {
    width   : videoConstraints.width,
    height  : videoConstraints.height,
    fps     : videoConstraints.frameRate,
    sources : [
      {
        // 本地演示和通话里的配置保持一致，方便对照最终效果
        aiVirtualBackground : buildSelectedAiVirtualBackgroundOptions()
      }
    ]
  });

  // 把本地演示输出挂到页面上的 localVideo
  localVideo.srcObject = await virtualBackgroundPreviewEngine.getOutput({ type: 'video' });
  localVideo.play().catch(() => {});

  // 更新本地状态和按钮文案
  virtualBackgroundPreviewPending = false;
  virtualBackgroundPreviewActive = true;
  updateVirtualBackgroundPreviewButton();
}

/**
 * 处理虚拟背景下拉框变化：
 * 1. 更新当前选择状态
 * 2. 同步到当前通话
 * 3. 同步到本地演示
 */
async function handleVirtualBackgroundChange(selectEl)
{
  // 当前下拉框选中的 option
  const selectedOption = selectEl.options[selectEl.selectedIndex];

  // 保存当前选择，后续构建配置时统一从这里取
  virtualBackgroundType = selectedOption.value;

  // 先更新状态栏，方便用户知道自己选中了什么
  if (!virtualBackgroundType)
  {
    setStatus('虚拟背景已关闭');
  }
  else if (virtualBackgroundType === 'none')
  {
    setStatus('虚拟背景已切换为保留人物，不替换背景');
  }
  else
  {
    setStatus(`虚拟背景已切换为 ${selectedOption.innerText}`);
  }

  // 当前通话里的 composer（旧接口拿法）
  const sessionComposer = rtcSession && rtcSession.getMediaEffectsComposer ?
    rtcSession.getMediaEffectsComposer() :
    null;

  // 页面上既没有通话中的 composer，也没有本地预览，就不用再往下做了
  if (!sessionComposer && !virtualBackgroundPreviewEngine)
  {
    return;
  }

  // 用户把虚拟背景关掉时，分别清掉通话和本地预览中的效果
  if (!virtualBackgroundType)
  {
    if (sessionComposer)
    {
      await applyVirtualBackgroundToCurrentSession();
    }

    if (virtualBackgroundPreviewEngine)
    {
      virtualBackgroundPreviewEngine.clearSourceAiVirtualBackground(0);
    }

    return;
  }

  // 如果当前正在通话，就把新选择同步到当前会话
  if (sessionComposer)
  {
    await applyVirtualBackgroundToCurrentSession();
  }

  // 如果本地演示已经开着，也同步更新本地演示画面
  if (virtualBackgroundPreviewEngine)
  {
    // 本地演示中的 composer 也同步到当前选择
    const aiVirtualBackground = buildSelectedAiVirtualBackgroundOptions();

    if (!aiVirtualBackground)
    {
      virtualBackgroundPreviewEngine.clearSourceAiVirtualBackground(0);
    }
    else
    {
      virtualBackgroundPreviewEngine.setSourceAiVirtualBackground(0, aiVirtualBackground);
    }
  }
}

// =============================================================================
// 呼叫参数构建
// =============================================================================

/**
 * 构建呼叫时要传给 SDK 的 AiNS 配置。
 */
function buildCallAiNoiseSuppressionOptions()
{
  // 只有明确选中 AiNS 时才返回配置
  if (aiNsType !== 'AiNS')
  {
    return null;
  }

  // 这份对象会在 call / answer 时直接传给 SDK
  return {
    enabled             : true,
    preserveOtherTracks : true,
    noiseReductionLevel : getCurrentAiNsLevel(),
    assetConfig         : { cdnUrl: AI_NOISE_ASSET_ROOT }
  };
}

// =============================================================================
// 初始化
// =============================================================================

/**
 * 初始化媒体效果模块。
 * 这里只做状态同步，真正的 UI 事件绑定放在 app.ui-bindings.js。
 */
function initMediaEffects()
{
  // 把下拉框初始值同步到模块状态，避免第一次呼叫时读到旧值
  virtualBackgroundType = document.querySelector('#virtualBackground').value;
  aiNsType = document.querySelector('#aiNoiseSuppression').value;

  // 顺手把默认强度整理成 0-100 的合法值，避免页面初始值写错
  const levelInput = document.querySelector('#aiNoiseReductionLevel');

  levelInput.value = normalizeAiNsReductionLevel(levelInput.value);
}
