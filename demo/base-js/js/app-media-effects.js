/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable no-undef */

/**
 * @fileoverview 媒体效果管理模块
 *
 * 本模块负责演示环境中所有与通话媒体效果相关的功能，包括：
 *   1. AI 虚拟背景（ Virtual Background ）—— 人像分割 + 背景替换 / 模糊 / 透明
 *   2. AI 降噪（ AiNS ）—— 语音降噪，支持本地验证链路与正式通话链路独立管理
 *   3. MediaEffectsComposer —— 统一管理镜像、水印（文字/图片）、虚拟背景等输出效果
 *
 * 核心设计原则：
 *   - 本地验证链路（ Preview / Monitor ）与正式通话链路（ rtcSession ）分离，避免相互干扰
 *   - 所有 UI 输入值在进入处理器前统一收敛（归一化），避免非法值导致的运行时异常
 *   - 通过 MediaEffectsComposer 统一管理输出管线，而非在各处散落独立的流处理逻辑
 *
 * 依赖：
 *   - 全局变量 rtcSession（ app.js 中管理的通话会话对象 ）
 *   - 全局变量 localVideo（ 本地视频 <video> 元素 ）
 *   - 全局变量 videoConstraints（ 视频采集约束 ）
 *   - 全局函数 setStatus()、getStreams()（ app.js 中定义 ）
 *   - 全局构造函数 CRTC.AiNSEngine、CRTC.MediaEffectsComposer（ SDK 提供 ）
 */

// =============================================================================
// 虚拟背景（ Virtual Background ）相关状态
// =============================================================================

/**
 * 当前选中的虚拟背景类型。
 * 可选值：''（未选择）、'none'（仅保留人像）、'blur'（模糊背景）、'img1'、'img2'（图片背景）
 * @type {string}
 */
let virtualBackgroundType = '';

/**
 * 虚拟背景本地预览引擎实例（ MediaEffectsComposer ）。
 * 仅在用户点击"开始演示"时创建，与正式通话链路独立。
 * @type {CRTC.MediaEffectsComposer|null}
 */
let virtualBackgroundPreviewEngine;

/**
 * 虚拟背景预览的输入流（来自摄像头 getUserMedia）。
 * 需要单独管理以便在停止预览时释放轨道。
 * @type {MediaStream|null}
 */
let virtualBackgroundPreviewInputStream;

/** @type {boolean} 虚拟背景预览是否处于激活状态 */
let virtualBackgroundPreviewActive = false;

/** @type {boolean} 虚拟背景预览是否正在启动中（防止重复点击） */
let virtualBackgroundPreviewPending = false;

/**
 * 可选的虚拟背景图片映射表。
 * key 对应 `<select>` 中 `<option>` 的 value，
 * value 为图片资源路径。
 * @type {{ [key: string]: string }}
 */
const virtualBackgroundImgs = {
  img1 : './virtual-background/backgrounds/office.png',
  img2 : './virtual-background/backgrounds/sky.jpg'
};

/**
 * AI 虚拟背景（ TFLite 分割模型 ）所需静态资源的根目录。
 * 包含 vision.js（ 推理 Worker ）、.wasm 运行时、.tflite 模型文件。
 * @type {string}
 */
const AI_VB_TASKS_ROOT = './assets/aivb';

/**
 * AI 虚拟背景的资源配置对象。
 * 传递给 MediaEffectsComposer / AiVirtualBackground 处理器，
 * 使其能按需加载分割模型和 WASM 运行时。
 * @type {{ moduleUrl: string, wasmBaseUrl: string, modelUrl: string }}
 */
const AI_VB_ASSET_CONFIG = {
  moduleUrl   : `${AI_VB_TASKS_ROOT}/vision.js`,
  wasmBaseUrl : AI_VB_TASKS_ROOT,
  modelUrl    : `${AI_VB_TASKS_ROOT}/selfie_segmenter_landscape.tflite`
};

// =============================================================================
// AI 降噪（ AiNS ）相关状态
// =============================================================================

/**
 * 当前选中的 AI 降噪类型。
 * 可选值：''（未开启）、'AiNS'（启用 AI 降噪）
 * @type {string}
 */
let aiNsType = '';

/**
 * AI 降噪模型资源根目录。
 * 处理器会根据此路径加载降噪所需的模型文件。
 * @type {string}
 */
const AI_NOISE_ASSET_ROOT = './assets/ains';

/**
 * 本地降噪验证用的原始麦克风采集流。
 * 与正式通话的音频流完全独立。
 * @type {MediaStream|null}
 */
let aiNsMonitorStream = null;

/**
 * 经过 AiNSEngine 处理后的输出流。
 * 挂载到本地 `<audio>` 元素上供用户主观试听对比。
 * @type {MediaStream|null}
 */
let aiNsMonitorProcessedStream = null;

/**
 * 本地降噪验证专用的处理器实例。
 * 与 rtcSession 中使用的 AiNSEngine 完全独立。
 * @type {CRTC.AiNSEngine|null}
 */
let aiNsMonitorProcessor = null;

/** @type {boolean} 本地降噪验证是否处于激活状态 */
let aiNsMonitorActive = false;

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 归一化 AI 降噪强度值。
 *
 * 将 UI 输入统一收敛到 [0, 100] 的合法区间内，
 * 非数字或非法值回退到默认值 80。
 *
 * @param {string|number} value - 来自 `<input>` 的原始值（可能是字符串）
 * @returns {number} 归一化后的强度值，范围 0-100
 */
function normalizeAiNsReductionLevel(value)
{
  const parsedLevel = parseInt(value, 10);

  return Number.isNaN(parsedLevel) ? 80 : Math.max(0, Math.min(100, parsedLevel));
}

/**
 * 从 UI 读取当前选择的 AiNS 强度。
 *
 * 在呼叫/接听建链前调用，将页面上的选择值写入会话配置。
 *
 * @returns {number} 归一化后的降噪强度（ 0-100 ），默认 80
 */
function getCurrentAiNsLevel()
{
  const levelInput = document.querySelector('#aiNoiseReductionLevel');

  return levelInput ? normalizeAiNsReductionLevel(levelInput.value) : 80;
}

/**
 * 根据 aiNsMonitorActive 状态更新"开始/结束验证"按钮的外观。
 *
 * 激活态：黄色警告按钮，文案"结束验证"
 * 非激活态：outline 黄色按钮，文案"开始验证"
 */
function updateAiNsMonitorButton()
{
  const button = document.querySelector('#toggleAiNsMonitor');

  if (!button)
  {
    return;
  }

  button.innerHTML = aiNsMonitorActive ?
    '<i class="bi-stop-circle me-1"></i>结束验证' :
    '<i class="bi-soundwave me-1"></i>开始验证';
  button.className = aiNsMonitorActive ? 'btn btn-warning' : 'btn btn-outline-warning';
}

/**
 * 获取本地降噪试听用的 `<audio>` 元素。
 *
 * @returns {HTMLAudioElement|null}
 */
function getAiNsMonitorAudio()
{
  return document.querySelector('#aiNoiseMonitorAudio');
}

/**
 * 将当前 AiNS 强度应用到正在进行的通话会话中。
 *
 * 如果当前不在通话中或未启用 AiNS，则静默返回 false，不做任何操作。
 *
 * @param {number} level - 归一化后的降噪强度（ 0-100 ）
 * @returns {boolean} 是否成功应用（ false 表示当前不可操作 ）
 */
function applyAiNsLevelToCurrentCall(level)
{
  // 仅在 AiNS 模式且存在可用会话时才尝试应用
  if (aiNsType !== 'AiNS' || !rtcSession || typeof rtcSession.getAiNoiseSuppression !== 'function')
  {
    return false;
  }

  const aiNsEngine = rtcSession.getAiNoiseSuppression();

  if (!aiNsEngine || typeof aiNsEngine.setSuppressionLevel !== 'function')
  {
    return false;
  }

  aiNsEngine.setSuppressionLevel(level);

  return true;
}

// =============================================================================
// AiNS 本地验证链路管理
// =============================================================================

/**
 * 停止本地降噪验证链路。
 *
 * 清理顺序：标记停用 → 更新按钮 → 停止音频播放 →
 * 销毁处理器 → 释放原始采集流轨道。
 * 异常在销毁/释放阶段被捕获并 warn，不会阻断后续清理步骤。
 *
 * @returns {Promise<void>}
 */
async function stopAiNsMonitor()
{
  const monitorAudio = getAiNsMonitorAudio();

  // 1. 立即标记为非激活，防止并发调用
  aiNsMonitorActive = false;
  updateAiNsMonitorButton();

  // 2. 停止音频元素播放并解除流绑定
  if (monitorAudio)
  {
    monitorAudio.pause();
    monitorAudio.srcObject = null;
  }

  // 3. 销毁降噪处理器（异步操作，需等待）
  if (aiNsMonitorProcessor && typeof aiNsMonitorProcessor.destroy === 'function')
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

  // 4. 释放采集流的所有轨道（摄像头/麦克风硬件资源）
  if (aiNsMonitorStream)
  {
    aiNsMonitorStream.getTracks().forEach((track) => track.stop());
  }

  // 5. 重置全部相关引用
  aiNsMonitorStream = null;
  aiNsMonitorProcessedStream = null;
  aiNsMonitorProcessor = null;
}

/**
 * 根据当前 AiNS 开关状态应用或回退本地降噪验证链路。
 *
 * 核心逻辑：
 *   1. 非激活态 → 直接返回
 *   2. AiNS 开启：
 *      a. 若处理器尚不存在 → 创建 AiNSEngine → 处理原始流 → 挂载到 audio 元素播放
 *      b. 若处理器已存在 → 启用并更新强度（无需重建处理器和流）
 *   3. 非 AiNS：
 *      - 销毁已有处理器，回退为直接播放原始麦克风采集流（原声）
 *
 * @param {boolean} [forceStatus=false] - 是否强制更新状态栏（用于 AiNS 切换时立即反馈）
 * @returns {Promise<void>}
 */
async function applyAiNsMonitorState(forceStatus = false)
{
  if (!aiNsMonitorActive || !aiNsMonitorStream)
  {
    return;
  }

  const monitorAudio = getAiNsMonitorAudio();
  const level = getCurrentAiNsLevel();

  if (!monitorAudio)
  {
    return;
  }

  // ========== AiNS 开启：创建或更新处理器 ==========
  if (aiNsType === 'AiNS')
  {
    if (!aiNsMonitorProcessor)
    {
      // 首次创建：实例化处理器 → 对原始流做降噪 → 挂载处理后的流
      aiNsMonitorProcessor = new CRTC.AiNSEngine({
        enabled             : true,
        preserveOtherTracks : true,
        noiseReductionLevel : level,
        assetConfig         : { cdnUrl: AI_NOISE_ASSET_ROOT }
      });
      aiNsMonitorProcessedStream = await aiNsMonitorProcessor.process(aiNsMonitorStream);
      monitorAudio.srcObject = aiNsMonitorProcessedStream;
      await monitorAudio.play();
    }
    else
    {
      // 已存在处理器：仅更新开关和强度，避免重建流
      await aiNsMonitorProcessor.setEnabled(true);
      aiNsMonitorProcessor.setSuppressionLevel(level);
    }

    setStatus(`本地降噪验证中，当前强度 ${level}`);

    return;
  }

  // ========== AiNS 关闭：回退到原声 ==========
  if (aiNsMonitorProcessor)
  {
    await aiNsMonitorProcessor.destroy();
    aiNsMonitorProcessor = null;
    aiNsMonitorProcessedStream = null;
  }

  monitorAudio.srcObject = aiNsMonitorStream;
  await monitorAudio.play();

  if (forceStatus)
  {
    setStatus('本地麦克风原声验证中（未开启 AI 降噪）');
  }
}

// =============================================================================
// MediaEffectsComposer —— 透明度的读取与归一化
// =============================================================================

/**
 * 读取 MediaEffectsComposer 中某元素的透明度值并归一化。
 *
 * 支持两种输入格式：
 *   - 百分比字符串："80%"  → 归一化为 0.8
 *   - 小数或大于 1 的数字：1.5 或 150 → 归一化为 1.0；0.5 → 0.5
 *
 * @param {HTMLInputElement|null} inputEl - 透明度输入框 DOM 元素
 * @returns {number|undefined} 归一化后的透明度（ 0-1 ），空值时返回 undefined（不设置）
 */
function readCallMediaEffectsComposerOpacity(inputEl)
{
  const raw = String((inputEl || {}).value || '').trim();

  if (!raw)
  {
    return undefined;
  }

  // 移除末尾 '%' 符号
  const normalized = raw.endsWith('%') ? raw.slice(0, -1).trim() : raw;
  // 兼容逗号作为小数点分隔符
  const parsed = Number(normalized.replace(',', '.'));

  if (!Number.isFinite(parsed))
  {
    return undefined;
  }

  // 大于 1 的值视为百分比（如 80 → 0.8），否则直接使用
  const opacity = parsed > 1 ? (parsed / 100) : parsed;

  return Math.min(1, Math.max(0, opacity));
}

// =============================================================================
// MediaEffectsComposer —— AI 虚拟背景配置构建
// =============================================================================

/**
 * 根据当前 virtualBackgroundType 构建 AI 虚拟背景配置对象。
 *
 * 处理尺度（ processingScale ）策略：
 *   - 分辨率越高，分割输入缩得越小（ 0.3-0.4 ），以在人物移动时保持遮罩跟手性
 *   - 这是 CPU/GPU 性能与分割质量的折中：高分辨率下过度精细的分割反而可能引入延迟
 *
 * @returns {Object|null} AI 虚拟背景配置，未选择时返回 null
 * @throws {Error} 当 virtualBackgroundType 为未知值时抛出
 */
function buildSelectedAiVirtualBackgroundOptions()
{
  if (!virtualBackgroundType)
  {
    return null;
  }

  const sourceWidth = Number(videoConstraints.width) || 640;
  const sourceHeight = Number(videoConstraints.height) || 480;
  const sourceFps = Number(videoConstraints.frameRate) || 15;
  // 处理尺度默认 0.4，分辨率越高越小，以优先保证分割跟手性
  let processingScale = 0.4;

  if (sourceWidth * sourceHeight >= 1280 * 720)
  {
    processingScale = 0.3;
  }
  else if (sourceWidth * sourceHeight >= 640 * 480)
  {
    processingScale = 0.35;
  }

  /** @type {Object} AI 虚拟背景配置 */
  const aiVirtualBackground = {
    enabled        : true,
    startupDelayMs : 0,
    maxRuntimeFps  : Math.min(sourceFps, 15), // 上限 15fps，降低 CPU 开销
    assetConfig    : Object.assign({}, AI_VB_ASSET_CONFIG), // 浅拷贝避免修改常量
    segmentation   : {
      delegate  : 'GPU', // 使用 WebGL/WebGPU 进行分割推理
      frameSkip : 0 // 不跳帧，每帧都做分割
    },
    video : {
      height          : sourceHeight,
      processingScale : processingScale,
      targetFps       : Math.min(sourceFps, 15),
      width           : sourceWidth
    }
  };

  // 模糊模式：高斯模糊背景
  if (virtualBackgroundType === 'blur')
  {
    aiVirtualBackground.mode = 'blur';
    aiVirtualBackground.blurRadius = 16;

    return aiVirtualBackground;
  }

  // 透明模式：仅保留人像，不替换背景
  if (virtualBackgroundType === 'none')
  {
    aiVirtualBackground.mode = 'none';

    return aiVirtualBackground;
  }

  // 图片模式：查找预定义的背景图片 URL
  const backgroundImageUrl = virtualBackgroundImgs[virtualBackgroundType];

  if (!backgroundImageUrl)
  {
    throw new Error(`Unknown virtual background type: ${virtualBackgroundType || 'empty'}`);
  }

  aiVirtualBackground.mode = 'image';
  aiVirtualBackground.imageUrl = backgroundImageUrl;

  return aiVirtualBackground;
}

// =============================================================================
// MediaEffectsComposer —— 合成器配置构建（镜像 + 水印 + 虚拟背景）
// =============================================================================

/**
 * 从 UI 控件读取所有设置，构建完整的 MediaEffectsComposer 配置对象。
 *
 * 收集以下配置项：
 *   1. 输出镜像（ Y 轴翻转 ）
 *   2. 文字水印（ 文案 / 位置 / 字号 / 颜色 / 透明度 ）
 *   3. 图片水印（ URL / 位置 / 宽高 / 透明度 ）
 *   4. AI 虚拟背景（ 通过 buildSelectedAiVirtualBackgroundOptions 获取 ）
 *
 * @param {{ includeDisabledState?: boolean }} [options={}] - 可选参数
 * @param {boolean} [options.includeDisabledState=false] - 是否包含禁用态配置
 *   设为 true 时，即使所有效果都未开启，也返回包含空配置的对象（用于 updateMediaEffectsComposer 关闭效果）
 *   设为 false 时，如果没有任何效果开启，返回 null（避免空操作）
 * @returns {Object|null} 合成器配置对象，或 null（表示无需操作）
 */
function buildCallMediaEffectsComposerOptions(options = {})
{
  const { includeDisabledState = false } = options;

  // ---- 1. 输出镜像 ----
  const outputMirrorEl = document.getElementById('callMediaEffectsComposerOutputMirror');
  const outputMirror = Boolean(outputMirrorEl && outputMirrorEl.checked);

  // ---- 2. AI 虚拟背景 ----
  const aiVirtualBackground = buildSelectedAiVirtualBackgroundOptions();

  // ---- 3. 水印（文字 + 图片）----
  /** @type {Object[]} 水印配置数组 */
  const watermarks = [];

  // --- 3a. 文字水印 ---
  const text = String((document.getElementById('callMediaEffectsComposerTextWatermarkText') || {}).value || '').trim();

  if (text)
  {
    const textPos = String((document.getElementById('callMediaEffectsComposerTextWatermarkPosition') || {}).value || 'bottom-right');
    const textSize = (document.getElementById('callMediaEffectsComposerTextWatermarkSize') || {}).value;
    const textColor = String((document.getElementById('callMediaEffectsComposerTextWatermarkColor') || {}).value || '').trim();
    const textOpacity = readCallMediaEffectsComposerOpacity(document.getElementById('callMediaEffectsComposerTextWatermarkOpacity'));

    /** @type {Object} 文字水印配置 */
    const textWatermark = {
      id       : 'call-output-text-watermark',
      target   : 'output', // 添加到输出流上
      type     : 'text',
      text     : text,
      position : textPos // 默认右下角
    };

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

    watermarks.push(textWatermark);
  }

  // --- 3b. 图片水印 ---
  const imageUrl = String((document.getElementById('callMediaEffectsComposerImageWatermarkUrl') || {}).value || '').trim();

  if (imageUrl)
  {
    const imagePos = String((document.getElementById('callMediaEffectsComposerImageWatermarkPosition') || {}).value || 'bottom-right');
    const imageWidth = (document.getElementById('callMediaEffectsComposerImageWatermarkWidth') || {}).value;
    const imageHeight = (document.getElementById('callMediaEffectsComposerImageWatermarkHeight') || {}).value;
    const imageOpacity = readCallMediaEffectsComposerOpacity(document.getElementById('callMediaEffectsComposerImageWatermarkOpacity'));

    /** @type {Object} 图片水印配置 */
    const imageWatermark = {
      id       : 'call-output-image-watermark',
      target   : 'output',
      type     : 'image',
      image    : imageUrl,
      position : imagePos
    };

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

    watermarks.push(imageWatermark);
  }

  // ---- 4. 组装 composerOptions ----
  /** @type {Object} MediaEffectsComposer 配置 */
  const composerOptions = {};

  // 镜像：includeDisabledState 模式下始终设置，否则仅勾选时设置
  if (includeDisabledState)
  {
    composerOptions.mirror = outputMirror;
  }
  else if (outputMirror)
  {
    composerOptions.mirror = true;
  }

  // 水印
  if (includeDisabledState || watermarks.length)
  {
    composerOptions.watermarks = watermarks;
  }

  // AI 虚拟背景（ sources[0] 为主视频源 ）
  if (includeDisabledState || aiVirtualBackground)
  {
    composerOptions.sources = [
      {
        aiVirtualBackground : aiVirtualBackground || null
      }
    ];
  }

  // enableInsertable：标记是否需要启用 Insertable Streams 管线
  // 任意一项有值即需要启用
  if (includeDisabledState || outputMirror || watermarks.length || aiVirtualBackground)
  {
    composerOptions.enableInsertable = true;
  }

  // 排除模式（非 includeDisabledState ）：所有效果都未开启 → 返回 null
  if (!includeDisabledState && !outputMirror && !watermarks.length && !aiVirtualBackground)
  {
    return null;
  }

  return composerOptions;
}

// =============================================================================
// MediaEffectsComposer —— 会话合成器的获取与更新
// =============================================================================

/**
 * 获取当前通话会话的 MediaEffectsComposer 实例。
 *
 * 仅在 rtcSession 存在且提供了 getMediaEffectsComposer 方法时返回。
 *
 * @returns {CRTC.MediaEffectsComposer|null} 合成器实例或 null
 */
function getCurrentSessionComposer()
{
  if (!rtcSession || typeof rtcSession.getMediaEffectsComposer !== 'function')
  {
    return null;
  }

  return rtcSession.getMediaEffectsComposer();
}

/**
 * 将当前选中的虚拟背景应用到指定合成器。
 *
 * 不修改合成器的其他配置（镜像、水印等），仅更新 sources[0].aiVirtualBackground。
 *
 * @param {CRTC.MediaEffectsComposer|null} targetComposer - 目标合成器实例
 */
function applyVirtualBackgroundSelection(targetComposer)
{
  if (!targetComposer)
  {
    return;
  }

  const aiVirtualBackground = buildSelectedAiVirtualBackgroundOptions();

  // 未选择背景 → 清除该源上的虚拟背景效果
  if (!aiVirtualBackground)
  {
    targetComposer.clearSourceAiVirtualBackground(0);

    return;
  }

  // 已选择背景 → 设置到 source[0]
  targetComposer.setSourceAiVirtualBackground(0, aiVirtualBackground);
}

/**
 * 将当前 UI 上的镜像/水印设置全量应用到当前通话会话。
 *
 * 支持两种更新路径（按优先级）：
 *   1. rtcSession.updateMediaEffectsComposer() —— 新版 API，一键更新全部配置
 *   2. sessionComposer.setConfig() + applyVirtualBackgroundSelection() —— 旧版分步更新
 *
 * @returns {Promise<void>}
 */
async function applyCurrentComposerSettingsToSession()
{
  const sessionComposer = getCurrentSessionComposer();
  const canUpdateSessionComposer = Boolean(rtcSession && typeof rtcSession.updateMediaEffectsComposer === 'function');

  if (!sessionComposer && !canUpdateSessionComposer)
  {
    setStatus('当前没有可更新的 MediaEffectsComposer');

    return;
  }

  // includeDisabledState: true —— 确保关闭效果时也能发送空配置
  const composerOptions = buildCallMediaEffectsComposerOptions({ includeDisabledState: true });

  try
  {
    if (canUpdateSessionComposer)
    {
      // 新版 API：一步到位
      await rtcSession.updateMediaEffectsComposer(composerOptions);
    }
    else
    {
      // 旧版 API：分步设置镜像/水印和虚拟背景
      const patch = {
        outputMirror : Boolean(composerOptions.mirror),
        watermarks   : composerOptions.watermarks || []
      };

      await sessionComposer.setConfig(patch);
      applyVirtualBackgroundSelection(sessionComposer);
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
// 虚拟背景本地预览（ Preview ）管理
// =============================================================================

/**
 * 获取虚拟背景预览按钮 DOM 元素。
 *
 * @returns {HTMLButtonElement|null}
 */
function getVirtualBackgroundPreviewButton()
{
  return document.querySelector('#toggleVirtualBackgroundPreview');
}

/**
 * 根据当前状态更新虚拟背景预览按钮的外观。
 *
 * 三态：
 *   - pending（启动中）：灰色 disabled 按钮，文案"启动中..."
 *   - active（已激活）：红色 outline 按钮，文案"结束演示"
 *   - idle（未激活）：蓝色 outline 按钮，文案"开始演示"
 */
function updateVirtualBackgroundPreviewButton()
{
  const button = getVirtualBackgroundPreviewButton();

  if (!button)
  {
    return;
  }

  // 启动中：禁用按钮防止重复点击
  if (virtualBackgroundPreviewPending)
  {
    button.innerHTML = '<i class="bi-arrow-repeat me-1"></i>启动中...';
    button.className = 'btn btn-outline-secondary';
    button.disabled = true;

    return;
  }

  button.innerHTML = virtualBackgroundPreviewActive ?
    '<i class="bi-stop-circle me-1"></i>结束演示' :
    '<i class="bi-person-bounding-box me-1"></i>开始演示';
  button.className = virtualBackgroundPreviewActive ? 'btn btn-outline-danger' : 'btn btn-outline-primary';
  button.disabled = false;
}

/**
 * 检查当前是否有活跃的通话连接。
 *
 * @returns {boolean} rtcSession.connection 存在且为真值
 */
function hasRtcSessionConnection()
{
  return Boolean(rtcSession && rtcSession.connection);
}

/**
 * 恢复本地视频预览。
 *
 * - 通话中：通过 getStreams(rtcSession.connection) 恢复显示通话流
 * - 非通话：清空 localVideo.srcObject
 */
function restoreLocalPreview()
{
  if (hasRtcSessionConnection())
  {
    getStreams(rtcSession.connection);

    return;
  }

  localVideo.srcObject = null;
}

/**
 * 将当前虚拟背景选择应用到正在进行的通话会话。
 *
 * 同样支持新旧两套 API 路径，专门用于只更新虚拟背景而不动其他设置的场景。
 *
 * @returns {Promise<void>}
 */
async function applyVirtualBackgroundToCurrentSession()
{
  const sessionComposer = getCurrentSessionComposer();
  const canUpdateSessionComposer = Boolean(rtcSession && typeof rtcSession.updateMediaEffectsComposer === 'function');

  if (!sessionComposer && !canUpdateSessionComposer)
  {
    return;
  }

  try
  {
    if (canUpdateSessionComposer)
    {
      // 新版 API：全量更新
      await rtcSession.updateMediaEffectsComposer(buildCallMediaEffectsComposerOptions({ includeDisabledState: true }));
    }
    else
    {
      // 旧版 API：仅更新虚拟背景
      applyVirtualBackgroundSelection(sessionComposer);
    }
  }
  catch (error)
  {
    console.warn('applyVirtualBackgroundToCurrentSession error', error);
    setStatus(`应用虚拟背景失败：${error && error.message ? error.message : error}`);
  }
}

/**
 * 停止虚拟背景本地预览。
 *
 * 清理顺序：
 *   1. 标记停用 → 更新按钮
 *   2. 停止预览引擎
 *   3. 释放采集流轨道
 *   4. 可选恢复通话流预览
 *
 * @param {{ restoreSessionPreview?: boolean }} [options={}] - 可选参数
 * @param {boolean} [options.restoreSessionPreview=true] - 是否在停止后恢复原始预览
 * @returns {Promise<void>}
 */
async function stopVirtualBackgroundPreview(options = {})
{
  const { restoreSessionPreview = true } = options;

  // 1. 立即标记为非激活 + 非 pending，防止并发操作
  virtualBackgroundPreviewPending = false;
  virtualBackgroundPreviewActive = false;
  updateVirtualBackgroundPreviewButton();

  // 2. 停止预览引擎
  if (virtualBackgroundPreviewEngine && typeof virtualBackgroundPreviewEngine.stop === 'function')
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

  // 3. 释放采集流轨道
  if (virtualBackgroundPreviewInputStream)
  {
    virtualBackgroundPreviewInputStream.getTracks().forEach((track) => track.stop());
  }

  // 4. 重置引用
  virtualBackgroundPreviewEngine = null;
  virtualBackgroundPreviewInputStream = null;

  // 5. 恢复原始视频预览（通话流或清空）
  if (restoreSessionPreview)
  {
    restoreLocalPreview();
  }
}

/**
 * 启动虚拟背景本地预览。
 *
 * 流程：
 *   1. 通过 getUserMedia 获取摄像头流
 *   2. 创建独立的 MediaEffectsComposer，配置 AI 虚拟背景
 *   3. 获取处理后的输出流并挂载到 localVideo
 *   4. 标记激活，更新按钮
 *
 * @returns {Promise<void>}
 * @throws {Error} 未选择虚拟背景效果时抛出
 */
async function startVirtualBackgroundPreview()
{
  // 前置检查：必须已选择背景效果
  if (!virtualBackgroundType)
  {
    throw new Error('请先选择虚拟背景效果');
  }

  // 1. 获取摄像头采集流（仅视频）
  virtualBackgroundPreviewInputStream = await navigator.mediaDevices.getUserMedia({
    audio : false,
    video : videoConstraints
  });

  // 2. 创建独立预览合成器——与 rtcSession 中的合成器完全隔离
  virtualBackgroundPreviewEngine = new CRTC.MediaEffectsComposer(virtualBackgroundPreviewInputStream, {
    width   : videoConstraints.width,
    height  : videoConstraints.height,
    fps     : videoConstraints.frameRate,
    sources : [
      {
        aiVirtualBackground : buildSelectedAiVirtualBackgroundOptions()
      }
    ]
  });

  // 3. 获取处理后输出流并挂载到视频元素
  localVideo.srcObject = await virtualBackgroundPreviewEngine.getOutput({
    type : 'video'
  });
  localVideo.play().catch(() => {}); // 忽略自动播放被浏览器拦截的错误

  // 4. 更新状态
  virtualBackgroundPreviewPending = false;
  virtualBackgroundPreviewActive = true;
  updateVirtualBackgroundPreviewButton();
}

/**
 * 响应用户在虚拟背景 `<select>` 中的选项变更。
 *
 * 同步更新：
 *   - virtualBackgroundType 状态变量
 *   - 正在使用的会话合成器（如有）
 *   - 正在运行的本地预览引擎（如有）
 *
 * @param {HTMLSelectElement} selectEl - 触发 change 事件的 select 元素
 * @returns {Promise<void>}
 */
async function handleVirtualBackgroundChange(selectEl)
{
  // 1. 读取并记录新的背景类型
  virtualBackgroundType = selectEl.options[selectEl.selectedIndex].value;

  // 2. 根据选择类型设置状态栏提示
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
    setStatus(`虚拟背景已切换为 ${selectEl.options[selectEl.selectedIndex].innerText}`);
  }

  // 3. 检查是否有需要更新的目标
  const sessionComposer = getCurrentSessionComposer();

  if (!sessionComposer && !virtualBackgroundPreviewEngine)
  {
    return;
  }

  // 4. 关闭背景 → 清除效果
  if (!virtualBackgroundType)
  {
    sessionComposer && await applyVirtualBackgroundToCurrentSession();
    virtualBackgroundPreviewEngine && virtualBackgroundPreviewEngine.clearSourceAiVirtualBackground(0);

    return;
  }

  // 5. 应用新背景 → 更新通话 + 更新本地预览
  if (sessionComposer)
  {
    await applyVirtualBackgroundToCurrentSession();
  }

  if (virtualBackgroundPreviewEngine)
  {
    applyVirtualBackgroundSelection(virtualBackgroundPreviewEngine);
  }
}

// =============================================================================
// AiNS 通话配置构建
// =============================================================================

/**
 * 从 UI 构建 AI 降噪配置对象，供 rtcSession 在呼叫/接听时使用。
 *
 * @returns {Object|null} AiNS 配置对象，未启用 AiNS 时返回 null
 */
function buildCallAiNoiseSuppressionOptions()
{
  if (aiNsType !== 'AiNS')
  {
    return null;
  }

  return {
    enabled             : true,
    preserveOtherTracks : true, // 保留非麦克风轨道（如屏幕共享音频）
    noiseReductionLevel : getCurrentAiNsLevel(),
    assetConfig         : { cdnUrl: AI_NOISE_ASSET_ROOT }
  };
}

// =============================================================================
// 模块初始化
// =============================================================================

/**
 * 初始化媒体效果模块。
 *
 * 绑定所有 UI 控件的事件监听器：
 *   - #virtualBackground change → 切换虚拟背景
 *   - #aiNoiseSuppression change → 切换 AI 降噪
 *   - #aiNoiseReductionLevel change → 调整降噪强度
 *   - #toggleAiNsMonitor click → 开始/停止本地降噪验证
 *   - #applyCurrentComposerSettings click → 应用合成器设置到当前通话
 *   - #toggleVirtualBackgroundPreview click → 开始/停止虚拟背景本地演示
 *
 * 同时初始化按钮的初始状态。
 */
function initMediaEffects()
{
  // ---- 初始化按钮外观 ----
  updateAiNsMonitorButton();
  updateVirtualBackgroundPreviewButton();

  // ---- 虚拟背景切换 ----
  document.querySelector('#virtualBackground').addEventListener('change', function()
  {
    handleVirtualBackgroundChange(this).catch((error) =>
    {
      console.warn('virtual background change error', error);
      setStatus(`虚拟背景切换失败：${error && error.message ? error.message : error}`);
    });
  });

  // ---- AI 降噪开关 ----
  document.querySelector('#aiNoiseSuppression').addEventListener('change', function()
  {
    aiNsType = this.value;

    // 切换降噪开关时提示当前强度
    setStatus(aiNsType === 'AiNS' ?
      `AI 降噪强度已设为 ${getCurrentAiNsLevel()}，将在下一次呼叫/接听时生效` :
      'AI 降噪已关闭');

    // 同步更新本地验证链路状态
    applyAiNsMonitorState(true);
  });

  // ---- AI 降噪强度滑块 ----
  document.querySelector('#aiNoiseReductionLevel').addEventListener('change', function()
  {
    const nextLevel = normalizeAiNsReductionLevel(this.value);

    // 回写归一化后的值到 UI
    this.value = nextLevel;

    if (aiNsType === 'AiNS')
    {
      if (applyAiNsLevelToCurrentCall(nextLevel))
      {
        setStatus(`AI 降噪强度已设为 ${nextLevel}，已应用到当前通话`);
      }
      else
      {
        setStatus(`AI 降噪强度已设为 ${nextLevel}，将在下一次呼叫/接听时生效`);
      }
    }

    // 如果本地验证正在运行，同步更新处理器强度
    applyAiNsMonitorState(false);
  });

  // ---- 本地降噪验证开关 ----
  document.querySelector('#toggleAiNsMonitor').onclick = async function()
  {
    // 正在运行 → 停止
    if (aiNsMonitorActive)
    {
      await stopAiNsMonitor();
      setStatus('已停止本地降噪验证');

      return;
    }

    // 未运行 → 启动
    try
    {
      // 获取仅音频的采集流（关闭所有内置降噪以保证原声纯净）
      aiNsMonitorStream = await navigator.mediaDevices.getUserMedia({
        audio : {
          echoCancellation : false,
          autoGainControl  : false,
          noiseSuppression : false
        },
        video : false
      });
      aiNsMonitorActive = true;
      updateAiNsMonitorButton();
      await applyAiNsMonitorState(true);
    }
    catch (error)
    {
      aiNsMonitorActive = false;
      updateAiNsMonitorButton();
      console.warn('toggleAiNsMonitor error', error);
      setStatus(`降噪验证启动失败：${error && error.message ? error.message : error}`);
    }
  };

  // ---- 应用合成器设置到当前通话 ----
  document.querySelector('#applyCurrentComposerSettings').onclick = async function()
  {
    await applyCurrentComposerSettingsToSession();
  };

  // ---- 虚拟背景本地预览开关 ----
  document.querySelector('#toggleVirtualBackgroundPreview').onclick = async function()
  {
    // 正在启动中 → 忽略点击
    if (virtualBackgroundPreviewPending)
    {
      return;
    }

    // 正在运行 → 停止
    if (virtualBackgroundPreviewActive)
    {
      await stopVirtualBackgroundPreview();
      setStatus('已结束本端虚拟背景演示');

      return;
    }

    // 未运行 → 启动
    try
    {
      virtualBackgroundPreviewPending = true;
      updateVirtualBackgroundPreviewButton();
      setStatus('正在启动本端虚拟背景演示...');
      await startVirtualBackgroundPreview();
      setStatus('本端虚拟背景演示已开启');
    }
    catch (error)
    {
      // 启动失败时确保清理干净
      await stopVirtualBackgroundPreview({ restoreSessionPreview: true });
      console.warn('startVirtualBackgroundPreview error', error);
      setStatus(`本端虚拟背景演示启动失败：${error && error.message ? error.message : error}`);
    }
  };
}
