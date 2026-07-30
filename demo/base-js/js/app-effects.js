/* Demo 媒体效果：虚拟背景、镜像、水印和 AI 降噪配置。
 *
 * 聚合 demo 页面中与媒体效果相关的核心逻辑：
 * 1. 页面状态与效果资源配置
 * 2. 虚拟背景配置构建（AiVBOptions）
 * 3. 水印配置构建（文字水印 + 图片水印）
 * 4. MediaEffectsComposer 呼叫/接听参数汇总（getFxOpts）
 * 5. AI 降噪呼叫/接听参数构建（getNsOpts）
 * 6. 当前会话实例获取和水印合并辅助
 * 7. 当前通话效果同步（setMirror、setMarks、setVb、setNsLevel）
 * 8. 媒体效果页面操作（changeNsMode、changeNsLevel、清除水印）
 * 9. 页面状态初始化（initFx）
 *
 * 呼叫/接听时的初始效果通过 getFxOpts() 和 getNsOpts() 配置；
 * 通话建立后的增量更新通过 setMirror/setMarks/setVb/setNsLevel 实时生效。
 */
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
 * 2. 虚拟背景、水印与 MediaEffectsComposer 呼叫参数
 * 3. 呼叫 / 接听时使用的 AI 降噪参数
 * 4. 当前通话中的增量效果更新
 * 5. 媒体效果表单操作与初始状态同步
 */

// =============================================================================
// 页面状态与资源
// =============================================================================

// 当前选中的虚拟背景类型：''（不启用）、'none'（保留人物不替换）、'blur'（模糊）、'img1'、'img2'
let vbType = '';
// AI 虚拟背景模型资源根路径（WASM/TFLite 等文件所在目录）
const VB_ROOT = './assets/aivb';

// 演示页内置背景图 key -> URL 映射
const vbImgs = {
  img1 : './imgs/office.png',
  img2 : './imgs/sky.jpg'
};

// 当前是否启用了 AiNS。演示里只处理 ''（未启用）和 'AiNS'（启用）两种值。
let aiNsType = '';
// AI 降噪模型资源根路径（WASM 和模型文件所在目录）
const NS_ROOT = './assets/ains';

// 文字水印固定 ID，用于 Composer 中水印的去重和按 ID 更新
const TEXT_MARK_ID = 'call-output-text-watermark';
// 图片水印固定 ID，用于 Composer 中水印的去重和按 ID 更新
const IMAGE_MARK_ID = 'call-output-image-watermark';

// =============================================================================
// 虚拟背景配置构建
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
 *   - 'image' : 替换为自定义图片（需同时传 url）
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
function getVbOpts()
{
  if (!vbType)
  {
    return null;
  }

  // 直接复用当前采集参数，缺失时退回演示页默认值。
  const width = Number(videoOpts.width) || 640;
  const height = Number(videoOpts.height) || 480;
  const fps = Number(videoOpts.frameRate) || 15;

  /**
   * 组装 AiVBOptions 对象（详见上方 JSDoc）
   *
   * @type {AiVBOptions}
   */
  const vbOpts = {
    assetConfig : { cdnUrl: VB_ROOT },
    video       : {
      width     : width,
      height    : height,
      targetFps : Math.min(fps, 15)
    }
  };

  if (vbType === 'blur')
  {
    vbOpts.mode = 'blur';

    return vbOpts;
  }

  if (vbType === 'none')
  {
    vbOpts.mode = 'none';

    return vbOpts;
  }

  // 其余值（img1 / img2）都按图片背景处理。
  const url = vbImgs[vbType];

  if (!url)
  {
    return null;
  }

  vbOpts.mode = 'image';
  vbOpts.imageUrl = url;

  return vbOpts;
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
function getTextMark()
{
  const text = document.getElementById('textMarkText').value.trim();

  if (!text)
  {
    return null;
  }

  const pos = document.getElementById('textMarkPos').value || 'bottom-right';
  const size = document.getElementById('textMarkSize').value;
  const color = document.getElementById('textMarkColor').value.trim();
  const alpha = readOpacity(
    document.getElementById('textMarkAlpha')
  );
  const mark = {
    id       : TEXT_MARK_ID,
    type     : 'text',
    text     : text,
    position : pos
  };

  // 仅在用户填写时覆盖 SDK 默认值。
  if (String(size).trim())
  {
    mark.fontSize = Number(size);
  }

  if (color)
  {
    mark.color = color;
  }

  if (alpha !== undefined)
  {
    mark.opacity = alpha;
  }

  return mark;
}

/**
 * 从页面控件读取图片水印配置；URL 为空时返回 null。
 *
 * @returns {Object|null} 图片水印配置对象，或 null
 */
function getImageMark()
{
  const url = document.getElementById('imgMarkUrl').value.trim();

  if (!url)
  {
    return null;
  }

  const pos = document.getElementById('imgMarkPos').value || 'bottom-right';
  const width = document.getElementById('imgMarkW').value;
  const height = document.getElementById('imgMarkH').value;
  const alpha = readOpacity(
    document.getElementById('imgMarkAlpha')
  );
  const mark = {
    id       : IMAGE_MARK_ID,
    type     : 'image',
    image    : url,
    position : pos
  };

  // 仅在用户填写时覆盖 SDK 默认值。
  if (String(width).trim())
  {
    mark.width = Number(width);
  }

  if (String(height).trim())
  {
    mark.height = Number(height);
  }

  if (alpha !== undefined)
  {
    mark.opacity = alpha;
  }

  return mark;
}

// =============================================================================
// MediaEffectsComposer 呼叫 / 接听参数汇总
//
// getFxOpts() 是 app-call.js 与会议模块共同使用的配置入口：按页面当前选择组合镜像、
// 水印和 slot 0 虚拟背景。没有启用任何效果时返回 null，避免无意义地创建管线。
// =============================================================================

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
 *   — 水印配置（数组/单对象/null），详见 getTextMark 上方注释
 *
 * ---- 输入源配置（含 AI 虚拟背景）----
 * @property {MediaEffectsComposerSourceOptions[]} [sources]
 *   — 输入源配置数组，每个元素：
 *     @property {number}   [slot]               — 槽位索引
 *     @property {AiVBOptions} [aiBackground]
 *       — 该源的 AI 虚拟背景配置，详见 getVbOpts 上方 JSDoc
 */

/**
 * 从页面读取当前所有 MediaEffectsComposer 设置。
 * 这个配置用于呼叫发起（call）或接听（answer）时的初始效果参数。
 *
 * @returns {MediaEffectsComposerOptions|null} 有效果时返回配置对象，无效果时返回 null
 */
function getFxOpts()
{
  const mirror = document.getElementById('fxMirror').value === 'on';
  const vbOpts = getVbOpts();
  const watermarks = [];
  const textMark = getTextMark();
  const imageMark = getImageMark();

  if (textMark) watermarks.push(textMark);
  if (imageMark) watermarks.push(imageMark);

  const hasFx = mirror || watermarks.length || vbOpts;

  /**
   * SDK 的 MediaEffectsComposerOptions 对象
   * @type {MediaEffectsComposerOptions}
   */
  const opts = {};

  if (mirror)
  {
    // 输出画面水平镜像
    opts.mirror = true;
  }

  if (watermarks.length)
  {
    // 水印配置数组
    opts.watermarks = watermarks;
  }

  if (vbOpts)
  {
    // 输入源配置：每个源可独立设置 AI 虚拟背景。
    // 这里把所有源配置放在第一个槽位（index 0）。
    opts.sources = [
      {
        aiBackground : vbOpts
      }
    ];
  }

  if (hasFx)
  {
    opts.insertable = true;
  }

  if (!hasFx)
  {
    return null;
  }

  return opts;
}

// =============================================================================
// AI 降噪呼叫 / 接听参数构建
//
// 这里只返回 RTCSession.call()/answer() 使用的 aiNoiseSuppression 配置，不创建
// AiNS 实例。实例由 SDK 随通话创建；通话建立后的强度更新由 setNsLevel() 完成。
// =============================================================================

/**
 * =============================================================================
 * === SDK: AI 降噪配置参数结构 ===
 * =============================================================================
 *
 * @typedef {Object} AiNSOptions
 *
 * @property {boolean} [enabled] — 是否启用 AI 降噪（默认 true）
 * @property {number} [level] — 降噪强度（0~100，默认 80）
 * @property {number} [outputGain] — AiNS 输出增益（0~4，默认 1）
 * @property {Object} [assetConfig] — AI 模型资源路径配置
 * @property {string} [assetConfig.cdnUrl] — WASM 和模型文件所在根路径
 */

/**
 * 构建呼叫 / 接听时要传给 SDK 的 AI 降噪配置。
 *
 * @returns {AiNSOptions|null} 启用了 AiNS 时返回配置对象，否则返回 null
 */
function getNsOpts()
{
  if (aiNsType !== 'AiNS')
  {
    return null;
  }

  return {
    enabled     : true,
    level       : getNsLevel(),
    outputGain  : 1,
    assetConfig : { cdnUrl: NS_ROOT }
  };
}

// =============================================================================
// 当前会话实例与水印合并辅助
//
// 点对点模式从 rtcSession 取 composer；三方模式优先使用会议主 composer。
// setWatermarks() 是全量替换，因此更新单类水印前必须先保留另一类水印。
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
 * @returns {Object|null} 当前通话使用的合成器
 */
function getFx()
{
  // 三方模式下优先使用会议 composer（A-B 主会话的合成器），
  // 确保媒体特效面板操作的是正确的 composer 实例。
  const confMixer = typeof getConfMixer === 'function' ?
    getConfMixer() :
    null;

  /** @type {import('../../lib/RTCSession').MediaEffectsComposerInstance|null} */
  const fx = confMixer || (
    rtcSession && rtcSession.getMediaEffectsComposer ?
      rtcSession.getMediaEffectsComposer() :
      null
  );

  return fx;
}

/**
 * 以“先删旧 ID、再追加新项”的方式合并会话内水印。
 *
 * @param {Object[]} next — 要新增或更新的水印项
 * @param {string[]} ids — 需要从旧列表中移除的水印 ID
 * @returns {Object[]} 合并后的水印数组
 */
function mergeMarks(next, ids)
{
  const fx = getFx();
  let current = [];

  if (fx && typeof fx.getWatermarks === 'function')
  {
    try
    {
      current = [].concat(fx.getWatermarks() || []);
    }
    catch (error)
    {}
  }

  return current
    .filter((item) => !ids.includes(item && item.id))
    .concat(next);
}

// =============================================================================
// 当前通话效果同步
//
// 以下方法直接调用 SDK 的运行时更新 API，不重新发起呼叫或自行操作 sender。
// 如果当前通话没有创建相应实例，会提示用户让配置在下一次通话生效。
// =============================================================================

/**
 * 把当前输出镜像开关同步到正在进行的通话。
 * 未通话时只更新页面状态提示。
 *
 * ========== SDK 调用 ==========
 * fx.setMirror(enabled: boolean)
 *   - enabled: true=开启输出画面水平镜像，false=关闭
 *   - 影响所有观看者看到的画面
 *   - 返回 Promise，建议 await，便于感知运行时失败
 */
async function setMirror()
{
  if (!rtcSession)
  {
    const mirror = document.getElementById('fxMirror').value === 'on';

    setStatus(`输出镜像已设为${mirror ? '开启' : '关闭'}，将在下一次呼叫/接听时生效`);

    return;
  }

  const fx = getFx();

  if (!fx)
  {
    setStatus('当前通话没有 MediaEffectsComposer，输出镜像将在下一次呼叫/接听时生效');

    return;
  }

  const mirror = document.getElementById('fxMirror').value === 'on';

  try
  {
    // SDK: setMirror(enabled: boolean) — 设置输出画面水平镜像
    if (fx && typeof fx.setMirror === 'function')
    {
      await fx.setMirror(mirror);
    }

    setStatus(`已${mirror ? '开启' : '关闭'}当前通话输出镜像`);
  }
  catch (error)
  {
    console.warn('setMirror error', error);
    setStatus(`应用输出镜像失败：${error && error.message ? error.message : error}`);
  }
}

/**
 * 将一组输出水印写入当前通话。
 *
 * ========== SDK 调用 ==========
 * fx.setWatermarks(watermarks)
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
 *   字段详见 getTextMark 上方 JSDoc
 */
async function setMarks(watermarks)
{
  const fx = getFx();

  if (!fx)
  {
    setStatus('当前通话没有 MediaEffectsComposer，水印将在下一次呼叫/接听时生效');

    return;
  }

  // SDK: setWatermarks(watermarks) — 全量设置水印配置
  if (fx && typeof fx.setWatermarks === 'function')
  {
    await fx.setWatermarks(watermarks);

    return;
  }
}

/**
 * 把当前文字水印配置同步到当前通话。
 */
async function setTextMark()
{
  const watermark = getTextMark();

  if (!rtcSession)
  {
    setStatus(watermark ? '当前文字水印已保存，将在下一次呼叫/接听时生效' : '当前文字水印已清空');

    return;
  }

  const watermarks = mergeMarks(
    watermark ? [ watermark ] : [],
    [ TEXT_MARK_ID ]
  );

  try
  {
    await setMarks(watermarks);
    setStatus(watermark ? '已应用当前文字水印到当前通话' : '已清除当前文字水印');
  }
  catch (error)
  {
    console.warn('setTextMark error', error);
    setStatus(`应用文字水印失败：${error && error.message ? error.message : error}`);
  }
}

/**
 * 把当前图片水印配置同步到当前通话。
 */
async function setImageMark()
{
  const watermark = getImageMark();

  if (!rtcSession)
  {
    setStatus(watermark ? '当前图片水印已保存，将在下一次呼叫/接听时生效' : '当前图片水印已清空');

    return;
  }

  const watermarks = mergeMarks(
    watermark ? [ watermark ] : [],
    [ IMAGE_MARK_ID ]
  );

  try
  {
    await setMarks(watermarks);
    setStatus(watermark ? '已应用当前图片水印到当前通话' : '已清除当前图片水印');
  }
  catch (error)
  {
    console.warn('setImageMark error', error);
    setStatus(`应用图片水印失败：${error && error.message ? error.message : error}`);
  }
}

/**
 * 把当前虚拟背景应用到当前通话。
 *
 * ========== SDK 调用 ==========
 * fx.setAiBackground(slotOrTarget, options)
 *   - slotOrTarget: number | string
 *     - number: 槽位索引（如 0=第一个输入源）
 *   - options: AiVBOptions | null
 *     - 传 null 等同于 clear（但建议用下面的 clear 方法）
 *     - 参数结构详见 getVbOpts 上方 JSDoc
 *
 * fx.clearAiBackground(slotOrTarget)
 *   - slotOrTarget: number | string — 同上
 *   - 作用: 清除指定源的 AI 虚拟背景效果
 */
async function setVb()
{
  const fx = getFx();

  if (!fx)
  {
    setStatus('当前通话没有 MediaEffectsComposer，虚拟背景将在下一次呼叫/接听时生效');

    return;
  }

  try
  {
    if (fx && typeof fx.setAiBackground === 'function')
    {
      const vbOpts = getVbOpts();

      if (!vbOpts)
      {
        // SDK: clearAiBackground(0)
        // 没选虚拟背景 → 清除槽位 0 的 AI 虚拟背景效果
        fx.clearAiBackground(0);
      }
      else
      {
        // SDK: setAiBackground(0, AiVBOptions)
        // 将虚拟背景配置应用到槽位 0（第一个输入源）
        fx.setAiBackground(0, vbOpts);
      }
    }
  }
  catch (error)
  {
    console.warn('setVb error', error);
    setStatus(`应用虚拟背景失败：${error && error.message ? error.message : error}`);
  }
}

/**
 * 处理虚拟背景下拉框变化。
 * 这里只同步页面状态，并在当前通话存在 composer 时热更新效果。
 */
async function changeVb(selectEl)
{
  const option = selectEl.options[selectEl.selectedIndex];

  vbType = option.value;

  if (!vbType)
  {
    setStatus('虚拟背景已关闭');
  }
  else if (vbType === 'none')
  {
    setStatus('虚拟背景已切换为保留人物，不替换背景');
  }
  else
  {
    setStatus(`虚拟背景已切换为 ${option.innerText}`);
  }

  const fx = getFx();

  if (!fx)
  {
    return;
  }

  await setVb();
}

/**
 * 把新的降噪强度应用到当前通话。
 * 仅当前会话已创建 AiNS 实例时返回 true。
 */
function setNsLevel(level)
{
  if (aiNsType !== 'AiNS' || !rtcSession)
  {
    return false;
  }

  const ns = rtcSession.getAiNoiseSuppression();

  if (!ns)
  {
    return false;
  }

  ns.setLevel(level);

  return true;
}

// =============================================================================
// 媒体效果页面操作
//
// app-events.js 只负责绑定控件；表单状态、运行时更新和页面提示由本模块统一处理。
// =============================================================================

/**
 * 保存 AI 降噪模式选择并提示生效时机。
 *
 * @param {HTMLSelectElement} selectEl - AI 降噪模式选择框
 */
function changeNsMode(selectEl)
{
  aiNsType = selectEl.value;

  if (aiNsType === 'AiNS')
  {
    setStatus(`AI 降噪强度已设为 ${getNsLevel()}，将在下一次呼叫/接听时生效`);
  }
  else
  {
    setStatus('AI 降噪已关闭');
  }
}

/**
 * 整理 AI 降噪强度，并在当前通话已创建 AiNS 实例时热更新。
 *
 * @param {HTMLInputElement} inputEl - AI 降噪强度输入框
 */
function changeNsLevel(inputEl)
{
  const nextLevel = normNsLevel(inputEl.value);

  inputEl.value = nextLevel;

  if (aiNsType !== 'AiNS')
  {
    return;
  }

  if (setNsLevel(nextLevel))
  {
    setStatus(`AI 降噪强度已设为 ${nextLevel}，已应用到当前通话`);
  }
  else
  {
    setStatus(`AI 降噪强度已设为 ${nextLevel}，将在下一次呼叫/接听时生效`);
  }
}

/**
 * 清空文字水印表单并同步当前通话。
 */
async function clearTextMark()
{
  document.getElementById('textMarkText').value = '';
  document.getElementById('textMarkSize').value = '';
  document.getElementById('textMarkAlpha').value = '';
  await setTextMark();
}

/**
 * 清空图片水印表单并同步当前通话。
 */
async function clearImageMark()
{
  document.getElementById('imgMarkUrl').value = '';
  document.getElementById('imgMarkW').value = '';
  document.getElementById('imgMarkH').value = '';
  document.getElementById('imgMarkAlpha').value = '';
  await setImageMark();
}

// =============================================================================
// 页面状态初始化
// =============================================================================

/**
 * 初始化媒体效果表单状态，避免首次呼叫读到未同步的页面值。
 */
function initFx()
{
  vbType = document.querySelector('#vbMode').value;
  aiNsType = document.querySelector('#nsMode').value;

  const levelInput = document.querySelector('#nsLevel');

  levelInput.value = normNsLevel(levelInput.value);
}

// 媒体效果模块负责同步自己的初始表单状态。
initFx();
