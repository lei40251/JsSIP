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
 * 4. 呼叫 / 接听时使用的 AI 降噪配置
 */

// =============================================================================
// 页面状态与资源
// =============================================================================

// 当前选中的虚拟背景类型：''、'none'、'blur'、'img1'、'img2'
let virtualBackgroundType = '';
const AI_VB_TASKS_ROOT = './assets/aivb';

// 演示页内置背景图 key -> URL 映射
const virtualBackgroundImgs = {
  img1 : '../../demo/base-js/imgs/office.png',
  img2 : '../../demo/base-js/imgs/sky.jpg'
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
 * =============================================================================
 * === SDK: AiVBOptions 参数结构 ===
 * =============================================================================
 *
 * @typedef {Object} AiVBOptions
 *
 * @property {boolean} [enabled] — 是否启用（默认 true，设为 false 可暂停效果而不销毁）
 *
 * @property {'none'|'blur'|'image'|'color'} [mode] — 虚拟背景模式：
 *   - 'none'  : 不应用虚拟背景效果；保留 AI 虚拟背景配置对象，但不做人像分割、不替换背景
 *   - 'blur'  : 背景模糊
 *   - 'image' : 替换为自定义图片（需同时传 imageUrl）
 *   - 'color' : 替换为纯色背景（需同时传 color）
 *
 * @property {string}  [imageUrl]   — 背景图片 URL（mode='image' 时需要）
 * @property {string}  [color]      — 背景颜色（mode='color' 时需要，CSS 颜色值）
 * @property {string}  [modelPath]  — 自定义 AI 模型路径
 *
 * ---------- video：视频源处理参数 ----------
 * @property {Object}  [video]
 * @property {number}  [video.width]           — 输入宽度（默认 1280）
 * @property {number}  [video.height]          — 输入高度（默认 720）
 * @property {number}  [video.targetFps]       — 目标帧率（默认 15）
 * @property {boolean} [video.mirror]          — 是否水平翻转源视频（默认 false）
 *
 * ---------- assetConfig：AI 资源文件路径（用于自定义 CDN / 本地部署）----------
 * @property {Object}  [assetConfig]
 * @property {string}  [assetConfig.cdnUrl]    — 扁平资源基路径（所有文件在同一目录）
 */

/**
 * 根据当前选择构建 AI 虚拟背景配置；未开启时返回 null。
 *
 * @returns {AiVBOptions|null}
 */
function buildCurrentAiVBOptions()
{
  if (!virtualBackgroundType)
  {
    return null;
  }

  // 直接复用当前采集参数，缺失时退回演示页默认值。
  const sourceWidth = Number(videoConstraints.width) || 640;
  const sourceHeight = Number(videoConstraints.height) || 480;
  const sourceFps = Number(videoConstraints.frameRate) || 15;

  /**
   * 组装 AiVBOptions 对象（详见上方 JSDoc）
   *
   * @type {AiVBOptions}
   */
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

  if (virtualBackgroundType === 'none')
  {
    aiVBOptions.mode = 'none';

    return aiVBOptions;
  }

  // 其余值（img1 / img2）都按图片背景处理。
  const imageUrl = virtualBackgroundImgs[virtualBackgroundType];

  if (!imageUrl)
  {
    return null;
  }

  aiVBOptions.mode = 'image';
  aiVBOptions.imageUrl = imageUrl;

  return aiVBOptions;
}

// =============================================================================
// 水印配置构建
// =============================================================================

/**
 * === SDK: MediaEffectsComposerWatermarkOptions ===
 *
 * @typedef {Object} MediaEffectsComposerWatermarkOptions
 *
 * ---- 核心字段 ----
 * @property {string}  [id]               — 水印唯一 ID（用于后续更新/删除时的去重和定位） * 
 * @property {'text'|'image'} [type]      — 水印类型：'text'=文字水印，'image'=图片水印
 *
 * ---- 文字水印专用 ----
 * @property {string}  [text]            — 文字内容
 * @property {string}  [font]            — CSS font 属性（如 'bold 20px Arial'）
 * @property {number}  [fontSize]        — 字号 / px（优先级低于 font）
 * @property {string}  [color]           — 文字颜色（CSS 颜色值，默认 '#ffffff'）
 * @property {string}  [backgroundColor] — 文字背景色（CSS 颜色值，默认透明）
 * 
 * ---- 图片水印专用 ----
 * @property {string|ImageBitmap} [image]
 *   — 图片源：URL 字符串 或 ImageBitmap
 *
 * ---- 通用外观 ----
 * @property {number}  [width]    — 水印宽度 / px；文字水印不传则自适应，图片水印建议传
 * @property {number}  [height]   — 水印高度 / px；同上
 * @property {number}  [opacity]  — 透明度（0~1，默认 1）
 *
 * ---- 位置（二选一）----
 * @property {'top-left'|'top-center'|'top-right'|'center'|'bottom-left'|'bottom-center'|'bottom-right'} [position]
 *   — 预设位置（默认 'bottom-right'），九宫格定位
 * @property {{x:number, y:number}} [position]
 *   — 自定义坐标（像素值，原点在左上角）
 *
 */

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
 * ================================================================================
 * === SDK: MediaEffectsComposerOptions（通话时通过 mediaEffectsComposer 字段传入）===
 * ================================================================================
 *
 * @typedef {Object} MediaEffectsComposerOptions
 *
 * ---- 画布基础参数 ----
 * @property {number}  [width]                 — 合成画布宽度（默认 1280）
 * @property {number}  [height]                — 合成画布高度（默认 720）
 * @property {number}  [fps]                   — 合成帧率（默认 15）
 *
 * ---- 输出镜像 ----
 * @property {boolean} [mirror]       — 输出画面水平镜像（默认 false，影响所有观看者看到的画面）
 *
 * ---- 水印 ----
 * @property {MediaEffectsComposerWatermarkOptions[]|MediaEffectsComposerWatermarkOptions|null} [watermarks]
 *   — 水印配置（数组/单对象/null），详见 buildCurrentTextWatermark 上方注释
 *
 * ---- 输入源配置（含 AI 虚拟背景）----
 * @property {MediaEffectsComposerSourceOptions[]} [sources]
 *   — 输入源配置数组，每个元素：
 *     @property {number}   [slot]               — 槽位索引
 *     @property {AiVBOptions} [aiBackground]
 *       — 该源的 AI 虚拟背景配置，详见 buildCurrentAiVBOptions 上方 JSDoc
 */

/**
 * 从页面读取当前所有 MediaEffectsComposer 设置。
 * 这个配置用于呼叫发起（call）或接听（answer）时的初始效果参数。
 *
 * @returns {MediaEffectsComposerOptions|null} 有效果时返回配置对象，无效果时返回 null
 */
function buildCallComposerOptions()
{
  const outputMirror = document.getElementById('callMediaEffectsComposerOutputMirror').value === 'on';
  const aiVBOptions = buildCurrentAiVBOptions();
  const watermarks = buildCurrentWatermarks();
  const hasComposerEffects = outputMirror || watermarks.length || aiVBOptions;

  /**
   * SDK 的 MediaEffectsComposerOptions 对象
   * @type {MediaEffectsComposerOptions}
   */
  const composerOptions = {};

  if (outputMirror)
  {
    // 输出画面水平镜像
    composerOptions.mirror = true;
  }

  if (watermarks.length)
  {
    // 水印配置数组
    composerOptions.watermarks = watermarks;
  }

  if (aiVBOptions)
  {
    // 输入源配置：每个源可独立设置 AI 虚拟背景。
    // 这里把所有源配置放在第一个槽位（index 0）。
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

// =============================================================================
// 当前会话更新辅助
// =============================================================================

/**
 * SDK: MediaEffectsComposerInstance 运行时接口速览
 *
 * 获取实例：
 *   rtcSession.getMediaEffectsComposer() → MediaEffectsComposerInstance | null
 *
 * 镜像：
 *   setMirror(enabled: boolean) → Promise<MediaEffectsComposerConfigState>
 *     — 设置输出画面水平镜像
 *
 * 水印：
 *   setWatermarks(watermarks: WatermarkOptions[] | WatermarkOptions | null)
 *     → Promise<WatermarkState[]> — 全量设置水印（传 null 清除全部）
 *   getWatermarks() → WatermarkState[] — 读取当前水印状态（含 SDK 默认值）
 *   clearWatermarks(filter?) — 按条件清除水印
 *     filter: { id }
 *
 * AI 虚拟背景：
 *   setAiBackground(slotOrTarget, options)
 *     slotOrTarget: number — 槽位索引（如 0）
 *     options: AiVBOptions
 * 
 */

/**
 * 获取当前会话可用的 composer 更新入口。
 *
 * ========== SDK 调用 ==========
 * rtcSession.getMediaEffectsComposer()
 *   - 返回: MediaEffectsComposerInstance | null
 *   - 说明: 仅在通话建立且 mediaEffectsComposer 已启用时返回实例，
 *           否则返回 null（需在 call/answer 时传入 insertable: true）
 *   - 返回的实例上可用方法见本区块顶部注释
 *
 * @returns {{ sessionComposer: Object|null }}
 */
function getSessionComposerHandles()
{
  /** @type {import('../../lib/RTCSession').MediaEffectsComposerInstance|null} */
  const sessionComposer = rtcSession && rtcSession.getMediaEffectsComposer ?
    rtcSession.getMediaEffectsComposer() :
    null;

  return { sessionComposer };
}

/**
 * 获取当前会话里已存在的水印快照；不可读时返回空数组。
 *
 * ========== SDK 调用 ==========
 * sessionComposer.getWatermarks()
 *   - 返回: MediaEffectsComposerWatermarkState[]
 *   - 说明: 返回当前已设置的水印配置数组（已归一化，含 SDK 填充的默认值）
 *   - WatermarkState 比 WatermarkOptions 多出:
 *     { status, reason, slot, sourceId, streamId } 等运行时字段
 *
 * @param {Object} sessionComposer — 当前会话的 MediaEffectsComposer 实例
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
 *
 * ========== SDK 调用 ==========
 * sessionComposer.setMirror(enabled: boolean)
 *   - enabled: true=开启输出画面水平镜像，false=关闭
 *   - 影响所有观看者看到的画面
 *   - 返回 Promise，建议 await，便于感知运行时失败
 */
async function applyCurrentOutputMirrorToSession()
{
  if (!rtcSession)
  {
    const outputMirror = document.getElementById('callMediaEffectsComposerOutputMirror').value === 'on';

    setStatus(`输出镜像已设为${outputMirror ? '开启' : '关闭'}，将在下一次呼叫/接听时生效`);

    return;
  }

  const { sessionComposer } = getSessionComposerHandles();

  if (!sessionComposer)
  {
    setStatus('当前通话没有 MediaEffectsComposer，输出镜像将在下一次呼叫/接听时生效');

    return;
  }

  const outputMirror = document.getElementById('callMediaEffectsComposerOutputMirror').value === 'on';

  try
  {
    // SDK: setMirror(enabled: boolean) — 设置输出画面水平镜像
    if (sessionComposer && typeof sessionComposer.setMirror === 'function')
    {
      await sessionComposer.setMirror(outputMirror);
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
 * ========== SDK 调用 ==========
 * sessionComposer.setWatermarks(watermarks)
 *   - 参数:
 *     watermarks: MediaEffectsComposerWatermarkOptions[] | MediaEffectsComposerWatermarkOptions | null
 *       - 数组: 全量替换当前所有水印为新的一组
 *       - 单个: 替换为只有这一个水印
 *       - null:  清除全部水印
 *   - 返回: Promise<MediaEffectsComposerWatermarkState[]>
 *   - 注意: 这是全量替换（非增量），每次调用会清空之前的水印再设置新的
 *     - 所以 demo 里先通过 getWatermarks() 读旧列表，再 merge 后传回
 *
 * @param {Object[]} watermarks — 水印配置数组（MediaEffectsComposerWatermarkOptions[]），
 *   字段详见 buildCurrentTextWatermark 上方 JSDoc
 */
async function applyWatermarksToSession(watermarks)
{
  const { sessionComposer } = getSessionComposerHandles();

  if (!sessionComposer)
  {
    setStatus('当前通话没有 MediaEffectsComposer，水印将在下一次呼叫/接听时生效');

    return;
  }

  // SDK: setWatermarks(watermarks) — 全量设置水印配置
  if (sessionComposer && typeof sessionComposer.setWatermarks === 'function')
  {
    await sessionComposer.setWatermarks(watermarks);

    return;
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
 *
 * ========== SDK 调用 ==========
 * sessionComposer.setAiBackground(slotOrTarget, options)
 *   - slotOrTarget: number | string
 *     - number: 槽位索引（如 0=第一个输入源）
 *   - options: AiVBOptions | null
 *     - 传 null 等同于 clear（但建议用下面的 clear 方法）
 *     - 参数结构详见 buildCurrentAiVBOptions 上方 JSDoc
 *
 * sessionComposer.clearAiBackground(slotOrTarget)
 *   - slotOrTarget: number | string — 同上
 *   - 作用: 清除指定源的 AI 虚拟背景效果
 */
async function applyCurrentVirtualBackgroundToSession()
{
  const { sessionComposer } = getSessionComposerHandles();

  if (!sessionComposer)
  {
    setStatus('当前通话没有 MediaEffectsComposer，虚拟背景将在下一次呼叫/接听时生效');

    return;
  }

  try
  {
    if (sessionComposer && typeof sessionComposer.setAiBackground === 'function')
    {
      const aiVBOptions = buildCurrentAiVBOptions();

      if (!aiVBOptions)
      {
        // SDK: clearAiBackground(0)
        // 没选虚拟背景 → 清除槽位 0 的 AI 虚拟背景效果
        sessionComposer.clearAiBackground(0);
      }
      else
      {
        // SDK: setAiBackground(0, AiVBOptions)
        // 将虚拟背景配置应用到槽位 0（第一个输入源）
        sessionComposer.setAiBackground(0, aiVBOptions);
      }
    }
  }
  catch (error)
  {
    console.warn('applyCurrentVirtualBackgroundToSession error', error);
    setStatus(`应用虚拟背景失败：${error && error.message ? error.message : error}`);
  }
}

/**
 * 处理虚拟背景下拉框变化。
 * 这里只同步页面状态，并在当前通话存在 composer 时热更新效果。
 */
async function handleVirtualBackgroundChange(selectEl)
{
  const selectedOption = selectEl.options[selectEl.selectedIndex];

  virtualBackgroundType = selectedOption.value;

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

  const { sessionComposer } = getSessionComposerHandles();

  if (!sessionComposer)
  {
    return;
  }

  await applyCurrentVirtualBackgroundToSession();
}

// =============================================================================
// AI 降噪呼叫参数构建
// =============================================================================

/**
 * =============================================================================
 * === SDK: AI 降噪配置参数结构 ===
 * =============================================================================
 *
 * @typedef {Object} AiNSOptions
 *
 * @property {boolean} [enabled] — 是否启用 AI 降噪（默认 true）
 *   设为 false 可暂时关闭而不销毁管线
 *
 * @property {number} [level] — 降噪强度（0~100，默认 80）
 *   - 0   = 不降噪
 *   - 100 = 最大降噪强度
 *   - 值越高噪声抑制越强，但语音可能稍有失真
 *
 * @property {number} [outputGain] — AiNS 处理后的输出增益（0~4，默认 1）
 *   大于 1 可补偿降噪后的音量，过高可能造成削波
 *
 * @property {Object} [assetConfig] — AI 模型资源路径配置
 * @property {string} [assetConfig.cdnUrl] — CDN 根路径（默认 './static'）
 *   SDK 会在该路径下查找 WASM 和模型文件
 */

/**
 * 构建呼叫 / 接听时要传给 SDK 的 AI 降噪配置。
 *
 * @returns {AiNSOptions|null} 启用了 AiNS 时返回配置对象，否则返回 null
 */
function buildCallAiNsOptions()
{
  if (aiNsType !== 'AiNS')
  {
    return null;
  }

  return {
    enabled     : true,
    level       : getCurrentAiNsLevel(),
    outputGain  : getCurrentAiNsOutputGain(),
    assetConfig : { cdnUrl: AI_NOISE_ASSET_ROOT }
  };
}

/**
 * 把新的降噪强度应用到当前通话。
 * 仅当前会话已创建 AiNS 实例时返回 true。
 */
function applyAiNsLevelToCurrentCall(level)
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

/**
 * 通话中动态调整 AiNS 输出增益，不会重建处理链或替换音轨。
 *
 * @param {number} value — 输出增益，范围 0~4；1 表示不额外放大
 * @returns {boolean} 当前通话存在 AiNS 实例时返回 true
 */
function applyAiNsOutputGainToCurrentCall(value)
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

  aiNsEngine.setOutputGain(value);

  return true;
}

/**
 * 初始化媒体效果表单状态，避免首次呼叫读到未同步的页面值。
 */
function initMediaEffects()
{
  virtualBackgroundType = document.querySelector('#virtualBackground').value;
  aiNsType = document.querySelector('#aiNoiseSuppression').value;

  const levelInput = document.querySelector('#aiNoiseReductionLevel');
  const gainInput = document.querySelector('#aiNoiseOutputGain');

  levelInput.value = normalizeAiNsReductionLevel(levelInput.value);
  gainInput.value = normalizeAiNsOutputGain(gainInput.value);
}
