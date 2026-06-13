/* eslint-disable prefer-const */
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
 * 演示页专用的本地验证 / 本地预览流程已拆到 app.media-effects-demo.js。
 */

// =============================================================================
// 虚拟背景状态
// =============================================================================

// 当前选中的虚拟背景类型：''、'none'、'blur'、'img1'、'img2'
let virtualBackgroundType = '';

// AI 虚拟背景资源目录
const AI_VB_TASKS_ROOT = './assets/aivb';

// 演示里内置的两张背景图
const virtualBackgroundImgs = {
  img1 : './virtual-background/backgrounds/office.png',
  img2 : './virtual-background/backgrounds/sky.jpg'
};

// =============================================================================
// AI 降噪（AiNS）状态
// =============================================================================

// 当前是否启用了 AiNS。演示里只处理 '' 和 'AiNS' 两种值。
let aiNsType = '';

// AI 降噪资源目录
const AI_NOISE_ASSET_ROOT = './assets/ains';

// =============================================================================
// MediaEffectsComposer 配置构建
// =============================================================================

/**
 * 根据当前 virtualBackgroundType 状态，构建 AI 虚拟背景配置。
 */
function buildSelectedAiVirtualBackgroundOptions()
{
  // 没选任何效果，就不返回配置
  if (!virtualBackgroundType)
  {
    return null;
  }

  // 演示页直接复用当前视频采集参数，未获取到时退回安全默认值
  const sourceWidth = Number(videoConstraints.width) || 640;
  const sourceHeight = Number(videoConstraints.height) || 480;
  const sourceFps = Number(videoConstraints.frameRate) || 15;

  // 这是三种模式（blur / none / image）都会共用的基础配置
  const aiVirtualBackground = {
    assetConfig : { flatBaseUrl: AI_VB_TASKS_ROOT },
    video       : {
      width     : sourceWidth,
      height    : sourceHeight,
      // 输出目标帧率，钳位范围 [1, 60]，默认 15
      targetFps : Math.min(sourceFps, 15)
    }
  };

  // mode 可选值：'blur'（虚化） / 'none'（仅保留人物） / 'image'（图片背景）
  // SDK 也会根据 blurRadius / imageUrl / color 自动推断 mode

  // 纯虚化模式：只模糊背景，不替换图片
  if (virtualBackgroundType === 'blur')
  {
    aiVirtualBackground.mode = 'blur';

    return aiVirtualBackground;
  }

  // 只保留人物，背景透明（无模糊、无替换）
  if (virtualBackgroundType === 'none')
  {
    aiVirtualBackground.mode = 'none';

    return aiVirtualBackground;
  }

  // 其余值（img1 / img2）都按图片背景处理
  aiVirtualBackground.mode = 'image';
  aiVirtualBackground.imageUrl = virtualBackgroundImgs[virtualBackgroundType];

  return aiVirtualBackground;
}

// =============================================================================
// 水印配置构建
// =============================================================================

/**
 * 从页面控件读取文字水印参数，构建文字水印配置对象。
 * 文字内容为空时返回 null，表示不需要文字水印。
 *
 * @returns {Object|null} 文字水印配置对象，或 null
 */
function buildCallTextWatermark()
{
  // 水印文本内容
  const text = document.getElementById('callMediaEffectsComposerTextWatermarkText').value.trim();

  // 文本为空，表示不需要文字水印
  if (!text)
  {
    return null;
  }

  // 水印位置预设值：top-left / top-center / top-right / center /
  // bottom-left / bottom-center / bottom-right，未选择时默认 bottom-right
  const textPosition = document.getElementById('callMediaEffectsComposerTextWatermarkPosition').value || 'bottom-right';
  // 字号（px），SDK 默认 28
  const textSize = document.getElementById('callMediaEffectsComposerTextWatermarkSize').value;
  // 字体颜色（CSS 色值），SDK 默认 '#fff'（白色）
  const textColor = document.getElementById('callMediaEffectsComposerTextWatermarkColor').value.trim();
  // 不透明度，范围 [0, 1]，SDK 默认 1（完全不透明）
  const textOpacity = readCallMediaEffectsComposerOpacity(
    document.getElementById('callMediaEffectsComposerTextWatermarkOpacity')
  );
  const textWatermark = {
    // 水印唯一标识，用于精确删除/替换；不传则 SDK 自动分配 "watermark-N"
    id       : 'call-output-text-watermark',
    type     : 'text',
    text     : text,
    position : textPosition
  };

  // 用户填了字号才覆盖默认值
  if (String(textSize).trim())
  {
    textWatermark.fontSize = Number(textSize);
  }

  // 用户填了颜色才覆盖默认值
  if (textColor)
  {
    textWatermark.color = textColor;
  }

  // 用户调过透明度才覆盖默认值
  if (textOpacity !== undefined)
  {
    textWatermark.opacity = textOpacity;
  }

  return textWatermark;
}

/**
 * 从页面控件读取图片水印参数，构建图片水印配置对象。
 * 图片地址为空时返回 null，表示不需要图片水印。
 *
 * @returns {Object|null} 图片水印配置对象，或 null
 */
function buildCallImageWatermark()
{
  // 水印图片 URL
  const imageUrl = document.getElementById('callMediaEffectsComposerImageWatermarkUrl').value.trim();

  // URL 为空，表示不需要图片水印
  if (!imageUrl)
  {
    return null;
  }

  // 水印位置预设值：top-left / top-center / top-right / center /
  // bottom-left / bottom-center / bottom-right，未选择时默认 bottom-right
  const imagePosition = document.getElementById('callMediaEffectsComposerImageWatermarkPosition').value || 'bottom-right';
  // 图片宽度（px），留空则使用原图宽度
  const imageWidth = document.getElementById('callMediaEffectsComposerImageWatermarkWidth').value;
  // 图片高度（px），留空则使用原图高度
  const imageHeight = document.getElementById('callMediaEffectsComposerImageWatermarkHeight').value;
  // 不透明度，范围 [0, 1]，SDK 默认 1（完全不透明）
  const imageOpacity = readCallMediaEffectsComposerOpacity(
    document.getElementById('callMediaEffectsComposerImageWatermarkOpacity')
  );
  const imageWatermark = {
    // 水印唯一标识，用于精确删除/替换；不传则 SDK 自动分配 "watermark-N"
    id       : 'call-output-image-watermark',
    type     : 'image',
    image    : imageUrl,
    position : imagePosition
  };

  // 用户填了宽度才覆盖默认值
  if (String(imageWidth).trim())
  {
    imageWatermark.width = Number(imageWidth);
  }

  // 用户填了高度才覆盖默认值
  if (String(imageHeight).trim())
  {
    imageWatermark.height = Number(imageHeight);
  }

  // 用户调过透明度才覆盖默认值
  if (imageOpacity !== undefined)
  {
    imageWatermark.opacity = imageOpacity;
  }

  return imageWatermark;
}

/**
 * 收集当前页面上的所有水印配置（文字 + 图片），返回合并后的数组。
 *
 * @returns {Object[]} 水印配置数组
 */
function buildCallWatermarks()
{
  const watermarks = [];
  const textWatermark = buildCallTextWatermark();
  const imageWatermark = buildCallImageWatermark();

  textWatermark && watermarks.push(textWatermark);
  imageWatermark && watermarks.push(imageWatermark);

  return watermarks;
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
  const outputMirror = document.getElementById('callMediaEffectsComposerOutputMirror').value === 'on';

  // 虚拟背景配置来自上面的统一构建函数
  const aiVirtualBackground = buildSelectedAiVirtualBackgroundOptions();

  const watermarks = buildCallWatermarks();

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

// =============================================================================
// 会话相关辅助函数
// =============================================================================

/**
 * 获取当前会话的 Composer 更新能力。
 * 同时返回旧接口（getMediaEffectsComposer）和新接口（updateMediaEffectsComposer）的可用性，
 * 方便下游按实际 SDK 版本选择合适的调用方式。
 *
 * @returns {{ sessionComposer: Object|null, canUpdateSessionComposer: boolean }}
 */
function getSessionComposerUpdater()
{
  // 旧接口：从 RTCSession 拿 composer 实例，后续通过实例方法操作
  const sessionComposer = rtcSession && rtcSession.getMediaEffectsComposer ?
    rtcSession.getMediaEffectsComposer() :
    null;
  // 新接口：直接检查 RTCSession 上是否有整包更新方法
  const canUpdateSessionComposer = Boolean(rtcSession && rtcSession.updateMediaEffectsComposer);

  return { sessionComposer, canUpdateSessionComposer };
}

/**
 * 获取当前 composer 中已存在的水印列表快照。
 *
 * @param {Object} sessionComposer — 当前会话的 MediaEffectsComposer 实例（旧接口）
 * @returns {Object[]} 水印配置数组，获取失败时返回空数组
 */
function getSessionWatermarksSnapshot(sessionComposer)
{
  if (!sessionComposer || typeof sessionComposer.getWatermarks !== 'function')
  {
    return [];
  }

  try
  {
    return [].concat(sessionComposer.getWatermarks() || []);
  }
  catch (error)
  {}

  return [];
}

/**
 * 将新增/更新后的水印项与 composer 中已有的水印列表合并。
 * 根据 idsToReplace 删除旧项，再追加 nextItems 中的新项。
 *
 * @param {Object[]} nextItems — 要新增或更新的水印项
 * @param {string[]} idsToReplace — 需要从旧列表中移除的水印 ID
 * @returns {Object[]} 合并后的水印数组
 */
function buildMergedWatermarks(nextItems, idsToReplace)
{
  const { sessionComposer } = getSessionComposerUpdater();
  // 从当前通话 composer 中取出已有水印快照
  const current = getSessionWatermarksSnapshot(sessionComposer);

  // 先按 ID 删除旧项，再追加新项，实现更新/替换语义
  return current
    .filter((item) => !idsToReplace.includes(item && item.id))
    .concat(nextItems);
}

// =============================================================================
// 镜像 / 水印单独应用
// =============================================================================

/**
 * 将当前输出镜像开关状态应用到当前通话。
 * 如果还没有发起通话，则仅提示用户该设置会在下次呼叫时生效。
 */
async function applyMirrorToCurrentSession()
{
  // 还没发起通话——只提示，不报错
  if (!rtcSession)
  {
    const outputMirror = document.getElementById('callMediaEffectsComposerOutputMirror').value === 'on';

    setStatus(`输出镜像已设为${outputMirror ? '开启' : '关闭'}，将在下一次呼叫/接听时生效`);

    return;
  }

  const { sessionComposer, canUpdateSessionComposer } = getSessionComposerUpdater();

  // SDK 既没有旧 composer 实例也没有新接口，说明当前版本不支持动态调整
  if (!sessionComposer && !canUpdateSessionComposer)
  {
    setStatus('当前没有可更新的输出镜像');

    return;
  }

  const outputMirror = document.getElementById('callMediaEffectsComposerOutputMirror').value === 'on';

  try
  {
    // 旧接口：通过 composer 实例直接设置
    if (sessionComposer && typeof sessionComposer.setMirror === 'function')
    {
      await sessionComposer.setMirror(outputMirror);
    }
    // 新接口：整包更新，同时开启 insertable 以保证管线激活
    else if (canUpdateSessionComposer)
    {
      await rtcSession.updateMediaEffectsComposer({ mirror: outputMirror, enableInsertable: true });
    }

    setStatus(`已${outputMirror ? '开启' : '关闭'}当前通话输出镜像`);
  }
  catch (error)
  {
    console.warn('applyMirrorToCurrentSession error', error);
    setStatus(`应用输出镜像失败：${error && error.message ? error.message : error}`);
  }
}

/**
 * 将一组水印配置写入当前通话的 composer。
 * 优先尝试旧接口的 setWatermarks，其次用新接口整包更新。
 *
 * @param {Object[]} watermarks — 水印配置数组
 */
async function applyWatermarksToCurrentSession(watermarks)
{
  const { sessionComposer, canUpdateSessionComposer } = getSessionComposerUpdater();

  // SDK 既没有旧 composer 实例也没有新接口，说明当前版本不支持动态调整
  if (!sessionComposer && !canUpdateSessionComposer)
  {
    setStatus('当前没有可更新的水印');

    return;
  }

  // 旧接口：通过 composer 实例的 setWatermarks 直接写入
  if (sessionComposer && typeof sessionComposer.setWatermarks === 'function')
  {
    await sessionComposer.setWatermarks(watermarks);

    return;
  }

  // 新接口：整包更新，同时开启 insertable 以保证管线激活
  if (canUpdateSessionComposer)
  {
    await rtcSession.updateMediaEffectsComposer({
      watermarks,
      enableInsertable : true
    });
  }
}

/**
 * 从页面控件读取文字水印设置，应用到当前通话。
 * 如果还没有发起通话，则提示用户该设置会在下次呼叫时生效。
 */
async function applyTextWatermarkToCurrentSession()
{
  const watermark = buildCallTextWatermark();

  // 还没发起通话——只提示，不报错
  if (!rtcSession)
  {
    setStatus(watermark ? '当前文字水印已保存，将在下一次呼叫/接听时生效' : '当前文字水印已清空');

    return;
  }

  // 合并新旧水印：先按 ID 删除旧的文字水印，再追加新的
  const watermarks = buildMergedWatermarks(
    watermark ? [ watermark ] : [],
    [ 'call-output-text-watermark' ]
  );

  try
  {
    await applyWatermarksToCurrentSession(watermarks);
    setStatus(watermark ? '已应用当前文字水印到当前通话' : '已清除当前文字水印');
  }
  catch (error)
  {
    console.warn('applyTextWatermarkToCurrentSession error', error);
    setStatus(`应用文字水印失败：${error && error.message ? error.message : error}`);
  }
}

/**
 * 从页面控件读取图片水印设置，应用到当前通话。
 * 如果还没有发起通话，则提示用户该设置会在下次呼叫时生效。
 */
async function applyImageWatermarkToCurrentSession()
{
  const watermark = buildCallImageWatermark();

  // 还没发起通话——只提示，不报错
  if (!rtcSession)
  {
    setStatus(watermark ? '当前图片水印已保存，将在下一次呼叫/接听时生效' : '当前图片水印已清空');

    return;
  }

  // 合并新旧水印：先按 ID 删除旧的图片水印，再追加新的
  const watermarks = buildMergedWatermarks(
    watermark ? [ watermark ] : [],
    [ 'call-output-image-watermark' ]
  );

  try
  {
    await applyWatermarksToCurrentSession(watermarks);
    setStatus(watermark ? '已应用当前图片水印到当前通话' : '已清除当前图片水印');
  }
  catch (error)
  {
    console.warn('applyImageWatermarkToCurrentSession error', error);
    setStatus(`应用图片水印失败：${error && error.message ? error.message : error}`);
  }
}

/**
 * 清空页面上文字水印相关的输入控件值。
 */
function clearTextWatermarkInputs()
{
  document.getElementById('callMediaEffectsComposerTextWatermarkText').value = '';
  document.getElementById('callMediaEffectsComposerTextWatermarkSize').value = '';
  document.getElementById('callMediaEffectsComposerTextWatermarkOpacity').value = '';
}

/**
 * 清空页面上图片水印相关的输入控件值。
 */
function clearImageWatermarkInputs()
{
  document.getElementById('callMediaEffectsComposerImageWatermarkUrl').value = '';
  document.getElementById('callMediaEffectsComposerImageWatermarkWidth').value = '';
  document.getElementById('callMediaEffectsComposerImageWatermarkHeight').value = '';
  document.getElementById('callMediaEffectsComposerImageWatermarkOpacity').value = '';
}

/**
 * 清空页面文字水印输入并同步清除当前通话中的文字水印。
 */
async function clearTextWatermarkFromCurrentSession()
{
  clearTextWatermarkInputs();
  await applyTextWatermarkToCurrentSession();
}

/**
 * 清空页面图片水印输入并同步清除当前通话中的图片水印。
 */
async function clearImageWatermarkFromCurrentSession()
{
  clearImageWatermarkInputs();
  await applyImageWatermarkToCurrentSession();
}

/**
 * 把当前镜像、水印、虚拟背景一次性应用到当前通话。
 */
async function applyCurrentComposerSettingsToSession()
{
  const { sessionComposer, canUpdateSessionComposer } = getSessionComposerUpdater();

  // 当前没有会话或者 SDK 没暴露相关能力时，直接提示即可
  if (!sessionComposer && !canUpdateSessionComposer)
  {
    setStatus('当前没有可更新的 MediaEffectsComposer');

    return;
  }

  // 拿"完整状态"（includeDisabledState=true），包括关闭的字段，
  // 方便在通话中用全量配置覆盖旧配置
  const composerOptions = buildCallMediaEffectsComposerOptions({ includeDisabledState: true });

  try
  {
    // 新接口：一次整包更新，覆盖所有 composer 设置
    if (canUpdateSessionComposer)
    {
      await rtcSession.updateMediaEffectsComposer(composerOptions);
    }
    else
    {
      // 旧接口：镜像和水印走 setConfig，虚拟背景单独取值后设置
      const aiVirtualBackground = buildSelectedAiVirtualBackgroundOptions();

      await sessionComposer.setConfig({
        outputMirror : Boolean(composerOptions.mirror),
        watermarks   : composerOptions.watermarks || []
      });

      // 没选虚拟背景时清掉 sources[0] 上的效果，选了就覆盖
      if (!aiVirtualBackground)
      {
        sessionComposer.clearSourceAiVirtualBackground(0);
      }
      else
      {
        sessionComposer.setSourceAiVirtualBackground(0, aiVirtualBackground);
      }
    }

    setStatus('已应用当前镜像/水印/虚拟背景设置到当前通话');
  }
  catch (error)
  {
    console.warn('applyCurrentComposerSettingsToSession error', error);
    setStatus(`应用合成设置失败：${error && error.message ? error.message : error}`);
  }
}

/**
 * 把当前虚拟背景应用到当前通话。
 * 和“全量应用 composer 配置”相比，这里只关注虚拟背景。
 */
async function applyVirtualBackgroundToCurrentSession()
{
  const { sessionComposer, canUpdateSessionComposer } = getSessionComposerUpdater();

  // 两种方式都没有，说明当前 SDK 版本不支持动态应用虚拟背景，静默返回
  if (!sessionComposer && !canUpdateSessionComposer)
  {
    return;
  }

  try
  {
    // 旧接口：通过 composer 实例的 setSourceAiVirtualBackground 直接设置
    if (sessionComposer && typeof sessionComposer.setSourceAiVirtualBackground === 'function')
    {
      const aiVirtualBackground = buildSelectedAiVirtualBackgroundOptions();

      if (!aiVirtualBackground)
      {
        // 没选虚拟背景 → 清除当前用户的 AI 虚拟背景效果
        sessionComposer.clearSourceAiVirtualBackground(0);
      }
      else
      {
        sessionComposer.setSourceAiVirtualBackground(0, aiVirtualBackground);
      }
    }
    // 新接口：只更新 sources[0] 上的虚拟背景，不重新传水印/镜像等无关配置
    else if (canUpdateSessionComposer)
    {
      await rtcSession.updateMediaEffectsComposer({
        sources : [
          {
            aiVirtualBackground : buildSelectedAiVirtualBackgroundOptions() || null
          }
        ],
        enableInsertable : true
      });
    }
  }
  catch (error)
  {
    console.warn('applyVirtualBackgroundToCurrentSession error', error);
    setStatus(`应用虚拟背景失败：${error && error.message ? error.message : error}`);
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
  // 只有明确选中 AiNS 时才返回配置，其余状态返回 null
  if (aiNsType !== 'AiNS')
  {
    return null;
  }

  // 这份对象会在 call / answer 时直接传给 SDK
  return {
    enabled             : true,
    // 保留其他音轨（如屏幕共享），不把所有轨道都降噪
    preserveOtherTracks : true,
    // 降噪等级，范围 [0, 100]，默认 80；从页面滑块动态读取
    noiseReductionLevel : getCurrentAiNsLevel(),
    // 降噪模型资源目录
    assetConfig         : { cdnUrl: AI_NOISE_ASSET_ROOT }
  };
}
