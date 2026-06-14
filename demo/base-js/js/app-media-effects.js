/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable no-undef */

/**
 * @fileoverview 媒体效果管理模块
 *
 * 这里聚合 demo 页里和媒体效果相关的核心逻辑：
 * 1. 页面状态与效果资源
 * 2. MediaEffectsComposer 配置构建
 * 3. 当前通话中的增量效果更新
 * 4. 呼叫 / 接听时使用的 AiNS 配置
 *
 * 本地试听、预览、演示控制逻辑已拆到 app.media-effects-demo.js。
 */

// =============================================================================
// 页面状态与资源
// =============================================================================

// 当前选中的虚拟背景类型：''、'none'、'blur'、'img1'、'img2'
let virtualBackgroundType = '';
const AI_VB_TASKS_ROOT = './assets/aivb';

// 演示页内置背景图 key -> URL 映射
const virtualBackgroundImgs = {
  img1 : './virtual-background/backgrounds/office.png',
  img2 : './virtual-background/backgrounds/sky.jpg'
};

// 当前是否启用了 AiNS。演示里只处理 '' 和 'AiNS' 两种值。
let aiNsType = '';
const AI_NOISE_ASSET_ROOT = './assets/ains';

// 当前呼叫页里两类输出水印的固定 ID。
const CALL_TEXT_WATERMARK_ID = 'call-output-text-watermark';
const CALL_IMAGE_WATERMARK_ID = 'call-output-image-watermark';

// =============================================================================
// MediaEffectsComposer 配置构建
// =============================================================================

/**
 * 根据当前选择构建 AI 虚拟背景配置；未开启时返回 null。
 */
function buildCurrentAiVirtualBackgroundOptions()
{
  if (!virtualBackgroundType)
  {
    return null;
  }

  // 直接复用当前采集参数，缺失时退回演示页默认值。
  const sourceWidth = Number(videoConstraints.width) || 640;
  const sourceHeight = Number(videoConstraints.height) || 480;
  const sourceFps = Number(videoConstraints.frameRate) || 15;

  const aiVirtualBackground = {
    assetConfig : { flatBaseUrl: AI_VB_TASKS_ROOT },
    video       : {
      width     : sourceWidth,
      height    : sourceHeight,
      targetFps : Math.min(sourceFps, 15)
    }
  };

  if (virtualBackgroundType === 'blur')
  {
    aiVirtualBackground.mode = 'blur';

    return aiVirtualBackground;
  }

  if (virtualBackgroundType === 'none')
  {
    aiVirtualBackground.mode = 'none';

    return aiVirtualBackground;
  }

  // 其余值（img1 / img2）都按图片背景处理。
  aiVirtualBackground.mode = 'image';
  aiVirtualBackground.imageUrl = virtualBackgroundImgs[virtualBackgroundType];

  return aiVirtualBackground;
}

// =============================================================================
// 水印配置构建
// =============================================================================

/**
 * 从页面控件读取文字水印配置；文字为空时返回 null。
 *
 * @returns {Object|null} 文字水印配置对象，或 null
 */
function buildCurrentTextWatermark()
{
  const text = document.getElementById('callMediaEffectsComposerTextWatermarkText').value.trim();

  if (!text)
  {
    return null;
  }

  const textPosition = document.getElementById('callMediaEffectsComposerTextWatermarkPosition').value || 'bottom-right';
  const textSize = document.getElementById('callMediaEffectsComposerTextWatermarkSize').value;
  const textColor = document.getElementById('callMediaEffectsComposerTextWatermarkColor').value.trim();
  const textOpacity = readCallMediaEffectsComposerOpacity(
    document.getElementById('callMediaEffectsComposerTextWatermarkOpacity')
  );
  const textWatermark = {
    id       : CALL_TEXT_WATERMARK_ID,
    type     : 'text',
    text     : text,
    position : textPosition
  };

  // 仅在用户填写时覆盖 SDK 默认值。
  if (String(textSize).trim())
  {
    textWatermark.fontSize = Number(textSize);
  }

  if (textColor)
  {
    textWatermark.color = textColor;
  }

  if (textOpacity !== undefined)
  {
    textWatermark.opacity = textOpacity;
  }

  return textWatermark;
}

/**
 * 从页面控件读取图片水印配置；URL 为空时返回 null。
 *
 * @returns {Object|null} 图片水印配置对象，或 null
 */
function buildCurrentImageWatermark()
{
  const imageUrl = document.getElementById('callMediaEffectsComposerImageWatermarkUrl').value.trim();

  if (!imageUrl)
  {
    return null;
  }

  const imagePosition = document.getElementById('callMediaEffectsComposerImageWatermarkPosition').value || 'bottom-right';
  const imageWidth = document.getElementById('callMediaEffectsComposerImageWatermarkWidth').value;
  const imageHeight = document.getElementById('callMediaEffectsComposerImageWatermarkHeight').value;
  const imageOpacity = readCallMediaEffectsComposerOpacity(
    document.getElementById('callMediaEffectsComposerImageWatermarkOpacity')
  );
  const imageWatermark = {
    id       : CALL_IMAGE_WATERMARK_ID,
    type     : 'image',
    image    : imageUrl,
    position : imagePosition
  };

  // 仅在用户填写时覆盖 SDK 默认值。
  if (String(imageWidth).trim())
  {
    imageWatermark.width = Number(imageWidth);
  }

  if (String(imageHeight).trim())
  {
    imageWatermark.height = Number(imageHeight);
  }

  if (imageOpacity !== undefined)
  {
    imageWatermark.opacity = imageOpacity;
  }

  return imageWatermark;
}

/**
 * 收集当前页面上的所有输出水印配置（文字 + 图片）。
 *
 * @returns {Object[]} 水印配置数组
 */
function buildCurrentWatermarks()
{
  const watermarks = [];
  const textWatermark = buildCurrentTextWatermark();
  const imageWatermark = buildCurrentImageWatermark();

  textWatermark && watermarks.push(textWatermark);
  imageWatermark && watermarks.push(imageWatermark);

  return watermarks;
}

/**
 * 从页面读取当前所有 MediaEffectsComposer 设置。
 * 这个配置用于呼叫发起或接听时的初始效果参数。
 */
function buildCallComposerOptions()
{
  const outputMirror = document.getElementById('callMediaEffectsComposerOutputMirror').value === 'on';
  const aiVirtualBackground = buildCurrentAiVirtualBackgroundOptions();
  const watermarks = buildCurrentWatermarks();
  const hasComposerEffects = outputMirror || watermarks.length || aiVirtualBackground;

  const composerOptions = {};

  if (outputMirror)
  {
    composerOptions.mirror = true;
  }

  if (watermarks.length)
  {
    composerOptions.watermarks = watermarks;
  }

  if (aiVirtualBackground)
  {
    composerOptions.sources = [
      {
        aiVirtualBackground : aiVirtualBackground
      }
    ];
  }

  if (hasComposerEffects)
  {
    composerOptions.enableInsertable = true;
  }

  if (!hasComposerEffects)
  {
    return null;
  }

  return composerOptions;
}

// =============================================================================
// 当前会话更新辅助
// =============================================================================

/**
 * 获取当前会话可用的 composer 更新入口。
 *
 * @returns {{ sessionComposer: Object|null, canUpdateSessionComposer: boolean }}
 */
function getSessionComposerHandles()
{
  const sessionComposer = rtcSession && rtcSession.getMediaEffectsComposer ?
    rtcSession.getMediaEffectsComposer() :
    null;
  const canUpdateSessionComposer = Boolean(rtcSession && rtcSession.updateMediaEffectsComposer);

  return { sessionComposer, canUpdateSessionComposer };
}

/**
 * 获取当前会话里已存在的水印快照；不可读时返回空数组。
 *
 * @param {Object} sessionComposer — 当前会话的 MediaEffectsComposer 实例（旧接口）
 * @returns {Object[]} 水印配置数组，获取失败时返回空数组
 */
function getSessionWatermarkSnapshot(sessionComposer)
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
 * 以“先删旧 ID、再追加新项”的方式合并会话内水印。
 *
 * @param {Object[]} nextItems — 要新增或更新的水印项
 * @param {string[]} idsToReplace — 需要从旧列表中移除的水印 ID
 * @returns {Object[]} 合并后的水印数组
 */
function mergeSessionWatermarks(nextItems, idsToReplace)
{
  const { sessionComposer } = getSessionComposerHandles();
  const current = getSessionWatermarkSnapshot(sessionComposer);

  return current
    .filter((item) => !idsToReplace.includes(item && item.id))
    .concat(nextItems);
}

// =============================================================================
// 当前通话效果同步
// =============================================================================

/**
 * 把当前输出镜像开关同步到正在进行的通话。
 * 未通话时只更新页面状态提示。
 */
async function applyCurrentOutputMirrorToSession()
{
  if (!rtcSession)
  {
    const outputMirror = document.getElementById('callMediaEffectsComposerOutputMirror').value === 'on';

    setStatus(`输出镜像已设为${outputMirror ? '开启' : '关闭'}，将在下一次呼叫/接听时生效`);

    return;
  }

  const { sessionComposer, canUpdateSessionComposer } = getSessionComposerHandles();

  if (!sessionComposer && !canUpdateSessionComposer)
  {
    setStatus('当前没有可更新的输出镜像');

    return;
  }

  const outputMirror = document.getElementById('callMediaEffectsComposerOutputMirror').value === 'on';

  try
  {
    if (sessionComposer && typeof sessionComposer.setMirror === 'function')
    {
      await sessionComposer.setMirror(outputMirror);
    }
    else if (canUpdateSessionComposer)
    {
      await rtcSession.updateMediaEffectsComposer({ mirror: outputMirror, enableInsertable: true });
    }

    setStatus(`已${outputMirror ? '开启' : '关闭'}当前通话输出镜像`);
  }
  catch (error)
  {
    console.warn('applyCurrentOutputMirrorToSession error', error);
    setStatus(`应用输出镜像失败：${error && error.message ? error.message : error}`);
  }
}

/**
 * 将一组输出水印写入当前通话。
 *
 * @param {Object[]} watermarks — 水印配置数组
 */
async function applyWatermarksToSession(watermarks)
{
  const { sessionComposer, canUpdateSessionComposer } = getSessionComposerHandles();

  if (!sessionComposer && !canUpdateSessionComposer)
  {
    setStatus('当前没有可更新的水印');

    return;
  }

  if (sessionComposer && typeof sessionComposer.setWatermarks === 'function')
  {
    await sessionComposer.setWatermarks(watermarks);

    return;
  }

  if (canUpdateSessionComposer)
  {
    await rtcSession.updateMediaEffectsComposer({
      watermarks,
      enableInsertable : true
    });
  }
}

/**
 * 把当前文字水印配置同步到当前通话。
 */
async function applyCurrentTextWatermarkToSession()
{
  const watermark = buildCurrentTextWatermark();

  if (!rtcSession)
  {
    setStatus(watermark ? '当前文字水印已保存，将在下一次呼叫/接听时生效' : '当前文字水印已清空');

    return;
  }

  const watermarks = mergeSessionWatermarks(
    watermark ? [ watermark ] : [],
    [ CALL_TEXT_WATERMARK_ID ]
  );

  try
  {
    await applyWatermarksToSession(watermarks);
    setStatus(watermark ? '已应用当前文字水印到当前通话' : '已清除当前文字水印');
  }
  catch (error)
  {
    console.warn('applyCurrentTextWatermarkToSession error', error);
    setStatus(`应用文字水印失败：${error && error.message ? error.message : error}`);
  }
}

/**
 * 把当前图片水印配置同步到当前通话。
 */
async function applyCurrentImageWatermarkToSession()
{
  const watermark = buildCurrentImageWatermark();

  if (!rtcSession)
  {
    setStatus(watermark ? '当前图片水印已保存，将在下一次呼叫/接听时生效' : '当前图片水印已清空');

    return;
  }

  const watermarks = mergeSessionWatermarks(
    watermark ? [ watermark ] : [],
    [ CALL_IMAGE_WATERMARK_ID ]
  );

  try
  {
    await applyWatermarksToSession(watermarks);
    setStatus(watermark ? '已应用当前图片水印到当前通话' : '已清除当前图片水印');
  }
  catch (error)
  {
    console.warn('applyCurrentImageWatermarkToSession error', error);
    setStatus(`应用图片水印失败：${error && error.message ? error.message : error}`);
  }
}

/**
 * 清空页面上文字水印相关的输入控件值。
 */
function resetTextWatermarkInputs()
{
  document.getElementById('callMediaEffectsComposerTextWatermarkText').value = '';
  document.getElementById('callMediaEffectsComposerTextWatermarkSize').value = '';
  document.getElementById('callMediaEffectsComposerTextWatermarkOpacity').value = '';
}

/**
 * 清空页面上图片水印相关的输入控件值。
 */
function resetImageWatermarkInputs()
{
  document.getElementById('callMediaEffectsComposerImageWatermarkUrl').value = '';
  document.getElementById('callMediaEffectsComposerImageWatermarkWidth').value = '';
  document.getElementById('callMediaEffectsComposerImageWatermarkHeight').value = '';
  document.getElementById('callMediaEffectsComposerImageWatermarkOpacity').value = '';
}

/**
 * 清空页面文字水印输入并同步清除当前通话中的文字水印。
 */
async function clearCurrentTextWatermarkFromSession()
{
  resetTextWatermarkInputs();
  await applyCurrentTextWatermarkToSession();
}

/**
 * 清空页面图片水印输入并同步清除当前通话中的图片水印。
 */
async function clearCurrentImageWatermarkFromSession()
{
  resetImageWatermarkInputs();
  await applyCurrentImageWatermarkToSession();
}

/**
 * 把当前虚拟背景应用到当前通话。
 */
async function applyCurrentVirtualBackgroundToSession()
{
  const { sessionComposer, canUpdateSessionComposer } = getSessionComposerHandles();

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
      const aiVirtualBackground = buildCurrentAiVirtualBackgroundOptions();

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
            aiVirtualBackground : buildCurrentAiVirtualBackgroundOptions() || null
          }
        ],
        enableInsertable : true
      });
    }
  }
  catch (error)
  {
    console.warn('applyCurrentVirtualBackgroundToSession error', error);
    setStatus(`应用虚拟背景失败：${error && error.message ? error.message : error}`);
  }
}

// =============================================================================
// 输入清理与呼叫参数构建
// =============================================================================

/**
 * 构建呼叫 / 接听时要传给 SDK 的 AiNS 配置。
 */
function buildCallAiNsOptions()
{
  if (aiNsType !== 'AiNS')
  {
    return null;
  }

  return {
    enabled             : true,
    preserveOtherTracks : true,
    noiseReductionLevel : getCurrentAiNsLevel(),
    assetConfig         : { cdnUrl: AI_NOISE_ASSET_ROOT }
  };
}
