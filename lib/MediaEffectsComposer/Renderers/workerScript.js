const SegmentationCommon = require('../AIVirtualBackground/AiVBSegmentationCommon');

/* eslint-disable */
/**
 * workerScript - Worker inline script generator.
 *
 * Keep the worker implementation as executable JS so the SDK minifier can
 * compress and mangle it before we serialize it with Function#toString().
 */
function workerMain()
{
// =============================================================================
// Worker 渲染脚本 —— 在 WebWorker 中运行，负责实际的视频帧合成渲染。
//
// 渲染流程概览：
//   1. 主线程通过 postMessage 发送 init 消息（含 OffscreenCanvas）
//   2. Worker 根据 requestedMode 选择 WebGL2 或 Canvas2D 初始化渲染上下文
//   3. 主线程每帧将 VideoFrame/ImageBitmap transfer 过来（render 消息）
//   4. Worker 渲染到 OffscreenCanvas 后，调用 transferToImageBitmap() 回传
//   5. 主线程将 ImageBitmap 绘制回统一输出 canvas，供 captureStream / Insertable 复用
//
// 消息协议：
//   init(canvas, requestedMode, width, height, backgroundColor)
//   render(payload: {width, height, backgroundColor, items[], watermarks[]})
//   removeSource(id)
//   destroy()
//   → 回复: ready | rendered(bitmap) | renderError | failed
//
// AI 虚拟背景路径：当 item 带有 aiVirtualBackground 配置且 runtimeEnabled=true 时，
//   Worker 内部通过动态 import() 加载 MediaPipe Tasks Vision 模块，
//   在 Worker 内完成人像分割 → 遮罩合成 → 背景替换，全部不经过主线程。
// =============================================================================

// =============================================================================
// 一、全局状态 — Worker 渲染上下文 & 纹理缓存
// =============================================================================
var canvas = null;                  // OffscreenCanvas（主线程 transfer 进来）
var ctx = null;                     // Canvas2D 上下文（worker-2d 模式使用）
var gl = null;                      // WebGL2 上下文（worker-webgl2 模式使用）
var program = null;                 // WebGL shader program
var positionBuffer = null;          // 全屏四边形顶点 buffer（[-1,1] 范围）
var texCoordBuffer = null;          // 标准纹理坐标 buffer（[0,1] 范围）
var textures = {};                  // 每个 video source 的 WebGL 纹理缓存
var watermarkTextures = {};         // 每个水印的 WebGL 纹理缓存
var actualMode = 'unknown';         // 实际使用的渲染模式（worker-webgl2 / worker-2d）
var requestedMode = 'auto';         // 请求的渲染模式
var width = 0;                      // 输出宽度
var height = 0;                     // 输出高度
var backgroundColor = '#000';       // 画布背景色
var outputMirrorX = false;          // 是否对最终输出做水平镜像
var mirrorWatermarksWithOutput = true; // 输出镜像时水印是否一起镜像
var opacityLocation = null;         // shader 中 u_opacity uniform 的 location
var mirrorTexCoordBuffer = null;    // 镜像纹理坐标 buffer（U 坐标翻转）

// =============================================================================
// 二、AI 虚拟背景状态 — Worker 内的人像分割与背景替换
// =============================================================================
var aivbSourceStates = Object.create(null);     // sourceId → 分割状态（遮罩、画布等）
var aivbRuntimeStates = Object.create(null);    // runtimeKey → MediaPipe segmenter 实例
var aivbModulePromises = Object.create(null);   // moduleUrl → 动态 import() Promise（去重）
var aivbBackgroundStates = Object.create(null); // imageUrl → 背景图 ImageBitmap 缓存
	var dynamicImport = new Function('moduleUrl', 'return import(moduleUrl);');
	self.SEGMENTATION_COMMON_INJECT_MARKER = '__SEGMENTATION_COMMON_INJECT__';

	// 遮罩后处理参数
var DEFAULT_MASK_EDGE_BLUR_PX = 1;     // 遮罩边缘羽化模糊半径（px），防止硬边白边
var DEFAULT_MASK_ALPHA_BIAS = 0.16;    // 遮罩 alpha 偏移，轻微收缩遮罩减少边缘泄漏
var DEFAULT_MASK_INSET_PX = 0.75;      // 遮罩整体向内收一圈，减少头发边缘白边

// WebGL2 shader 源码
// 顶点着色器：传递顶点位置和纹理坐标
var VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;
// 片元着色器：采样纹理并应用透明度
var FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_opacity;
out vec4 outColor;
void main() {
  vec4 color = texture(u_texture, v_texCoord);
  outColor = vec4(color.rgb, color.a * u_opacity);
}
`;

// ---------------------------------------------------------------------------
// 三、工具函数
// ---------------------------------------------------------------------------

// 获取当前高精度时间戳（ms），优先使用 performance.now，回退 Date.now
function now()
{
  return typeof performance !== 'undefined' && performance && typeof performance.now === 'function' ?
    performance.now() :
    Date.now();
}

// 数值钳位到 [min, max] 范围
function clamp(value, min, max)
{
  return Math.min(max, Math.max(min, value));
}

function buildForegroundEnhancementFilter(postProcessing)
{
  var config = postProcessing && typeof postProcessing === 'object' ? postProcessing : {};
  var brightness = Number(config.foregroundBrightness);
  var contrast = Number(config.foregroundContrast);
  var saturate = Number(config.foregroundSaturate);

  return 'brightness(' + (isFinite(brightness) ? brightness : 1) + ') contrast(' + (isFinite(contrast) ? contrast : 1) + ') saturate(' + (isFinite(saturate) ? saturate : 1) + ')';
}

// 判断 item 是否启用了 AiVB 虚拟背景效果
function hasAiVirtualBackground(item)
{
  return Boolean(item &&
    item.aiVirtualBackground &&
    item.aiVirtualBackground.enabled !== false &&
    item.aiVirtualBackground.mode &&
    item.aiVirtualBackground.mode !== 'none');
}

// 从 VideoFrame / ImageBitmap 中提取实际宽度和高度
// VideoFrame 用 displayWidth/codedWidth，ImageBitmap 用 width
function getFrameWidth(frame)
{
  return (frame && (frame.displayWidth || frame.codedWidth || frame.width)) || 0;
}

function getFrameHeight(frame)
{
  return (frame && (frame.displayHeight || frame.codedHeight || frame.height)) || 0;
}

// 确保离屏 surface（{canvas, context}）尺寸匹配目标尺寸，不匹配则重建
// 用于复用 AiVB 处理链中的中间画布，避免每帧创建新 canvas
function ensureCanvasSize(surface, targetWidth, targetHeight)
{
  var nextWidth = Math.max(1, Math.round(targetWidth || 1));
  var nextHeight = Math.max(1, Math.round(targetHeight || 1));

  if (!surface.canvas)
  {
    surface.canvas = new OffscreenCanvas(nextWidth, nextHeight);
    surface.context = surface.canvas.getContext('2d');
  }

  if (!surface.context)
  {
    return null;
  }

  if (surface.canvas.width !== nextWidth)
  {
    surface.canvas.width = nextWidth;
  }

  if (surface.canvas.height !== nextHeight)
  {
    surface.canvas.height = nextHeight;
  }

  return surface;
}

// ---------------------------------------------------------------------------
// 四、AiVB Source 状态管理 — 每个视频源的独立分割管线状态
// ---------------------------------------------------------------------------

// 获取或创建指定 source 的 AiVB 处理状态
// 每个 source 维护独立的：
//   - latestMask/latestFrame: 最新人像分割遮罩及对应的冻结视频帧 canvas
//   - segmentationSurface: 缩放到处理分辨率的输入帧
//   - maskSurface: 分割模型输出的置信度遮罩
//   - featherSurface: 边缘羽化后的遮罩
//   - foregroundSurface: 前景（人像）合成中间画布
//   - outputSurface: 最终合成输出（前景 + 替换背景）
function getSourceState(id)
{
  if (!aivbSourceStates[id])
  {
    aivbSourceStates[id] = {
      configKey                  : '',       // 当前配置的序列化 key，用于检测配置变更
      latestMask                 : null,      // 最新的分割遮罩 canvas
      latestFrame                : null,      // 与 latestMask 对应的冻结视频帧 canvas
      renderedSinceSeg          : 0,         // 上次分割后已渲染的帧数（用于 frameSkip）
      lastSegAt                 : 0,         // 上次调度分割的时间戳（用于 fps 节流）
      runtimeAllowedAt           : 0,         // 最早允许启动分割的时间（startupDelayMs）
      segmentationSurface        : { canvas: null, context: null }, // 送入分割模型的缩放后帧
      pendingFrameSurface        : { canvas: null, context: null }, // 当前分割对应的原始视频帧
      latestFrameSurface         : { canvas: null, context: null }, // 渲染前景使用的稳定视频帧
      maskSurface                : { canvas: null, context: null, imageData: null }, // 原始置信度遮罩
      featherSurface             : { canvas: null, context: null }, // 羽化后的遮罩
      foregroundSurface          : { canvas: null, context: null }, // 前景合成画布
      outputSurface              : { canvas: null, context: null }  // 最终输出画布
    };
  }

  return aivbSourceStates[id];
}

// 生成运行时配置的 key，仅包含影响分割模型初始化的参数。
// mode / imageUrl / blurRadius 等渲染参数的变化不应重置分割管线，
// 否则切换背景时会清空 latestMask 导致闪烁。
function createRuntimeConfigKey(config)
{
  return JSON.stringify({
    modelPath      : config.modelPath || '',
    runtimeEnabled : config.runtimeEnabled !== false,
    maxRuntimeFps  : Number(config.maxRuntimeFps) || 0,
    video          : config.video || {},
    segmentation   : config.segmentation || {},
    assetConfig    : config.assetConfig || {}
  });
}

function resetSourceState(state, config)
{
  state.latestMask = null;
  state.latestFrame = null;
  state.renderedSinceSeg = 0;
  state.lastSegAt = 0;
  state.runtimeAllowedAt = now() + Math.max(0, Number(config.startupDelayMs) || 0);
}

function resolveAiVBState(id, config)
{
  var state = getSourceState(id);
  var runtimeKey = createRuntimeConfigKey(config);

  // 仅在分割模型 / 资源 / fps 等运行时参数变化时才重建管线；
  // 单纯的背景图片 / 模糊半径 / 模式切换不清除遮罩，直接替换背景即可
  if (state.runtimeKey !== runtimeKey)
  {
    state.runtimeKey = runtimeKey;
    state.configKey = ''; // 强制同步
    resetSourceState(state, config);
  }

  // 同步当前渲染配置 key，用于检测渲染参数变化（如背景 URL 变更需重新加载图片）
  var renderKey = JSON.stringify({
    mode            : config.mode || '',
    imageUrl        : config.imageUrl || '',
    backgroundColor : config.backgroundColor || '',
    blurRadius      : Number(config.blurRadius) || 0
  });

  if (state.renderKey !== renderKey)
  {
    state.renderKey = renderKey;
    // 渲染参数变化不清除遮罩，只标记以便后续重新加载背景图等
  }

  return state;
}

// ---------------------------------------------------------------------------
// 五、AiVB 分割运行时 — 动态加载 MediaPipe Tasks Vision 并管理 segmenter 生命周期
// ---------------------------------------------------------------------------

// 动态 import() 加载 MediaPipe Tasks Vision ESM 模块（按 moduleUrl 去重缓存）
async function loadVisionTasksModule(moduleUrl)
{
  if (!moduleUrl)
  {
    throw new Error('AIVirtualBackground moduleUrl is required');
  }

  if (!aivbModulePromises[moduleUrl])
  {
    aivbModulePromises[moduleUrl] = dynamicImport(moduleUrl)
      .then(function(module)
      {
        if (!module || !module.FilesetResolver || !module.ImageSegmenter)
        {
          throw new Error('MediaPipe Tasks module is missing exports');
        }

        return module;
      });
  }

  return aivbModulePromises[moduleUrl];
}

// 生成 segmenter 运行时的唯一 key（按模块 URL + 模型路径 + delegate 区分）
// 不同 source 可以共享同一个 segmenter 实例（如相同配置的多路视频）
function getRuntimeKey(config)
{
  return JSON.stringify({
    moduleUrl   : config.assetConfig && config.assetConfig.moduleUrl ? config.assetConfig.moduleUrl : '',
    wasmBaseUrl : config.assetConfig && config.assetConfig.wasmBaseUrl ? config.assetConfig.wasmBaseUrl : '',
    modelUrl    : config.modelPath || (config.assetConfig && config.assetConfig.modelUrl) || '',
    delegate    : config.segmentation && config.segmentation.delegate ? config.segmentation.delegate : 'GPU'
  });
}

// 确保 MediaPipe ImageSegmenter 已初始化（按 runtimeKey 去重，避免并发创建）
// 使用 selfie-segmenter 模型，VIDEO 运行模式，输出置信度遮罩
async function ensureSegmenterRuntime(config)
{
  var runtimeKey = getRuntimeKey(config);
  var runtimeState = aivbRuntimeStates[runtimeKey];

  if (!runtimeState)
  {
    runtimeState = {
      segmenter   : null,
      labels      : [],
      ready       : false,
      initializing: null
    };
    aivbRuntimeStates[runtimeKey] = runtimeState;
  }

  if (runtimeState.ready && runtimeState.segmenter)
  {
    return runtimeState;
  }

  if (!runtimeState.initializing)
  {
    runtimeState.initializing = (async function()
    {
      var runtimeOptions = segmentationCommon.resolveRuntimeOptions(config.assetConfig, config.modelPath);
      var moduleUrl = runtimeOptions.moduleUrl;
      var wasmBaseUrl = runtimeOptions.wasmBaseUrl;
      var modelUrl = runtimeOptions.modelUrl;
      var delegate = config.segmentation && config.segmentation.delegate ? config.segmentation.delegate : 'GPU';
      var tasksModule = await loadVisionTasksModule(moduleUrl);
      var vision = await tasksModule.FilesetResolver.forVisionTasks(wasmBaseUrl);
      var segmenter = await tasksModule.ImageSegmenter.createFromOptions(
        vision,
        segmentationCommon.createSegmenterOptions(modelUrl, delegate)
      );

      runtimeState.segmenter = segmenter;
      runtimeState.labels = typeof segmenter.getLabels === 'function' ? segmenter.getLabels() : [];
      runtimeState.ready = true;
    })()
      .finally(function()
      {
        runtimeState.initializing = null;
      });
  }

  await runtimeState.initializing;

  return runtimeState;
}

// ---------------------------------------------------------------------------
// 六、遮罩构建 — 将 MediaPipe 分割结果转为 alpha 遮罩 canvas
// ---------------------------------------------------------------------------

// 将 MediaPipe 置信度/类别遮罩转换为 RGBA ImageData，写入 alpha 通道
// 返回羽化后的遮罩 canvas（用于 destination-in 合成抠出人像）
function createMaskCanvas(sourceState, runtimeState, result)
{
  var outputMask = segmentationCommon.resolveOutputMask(result, runtimeState.labels || []);
  var mask = outputMask.mask;

  if (!mask)
  {
    throw new Error('ImageSegmenter did not return a supported mask output');
  }

  var maskWidth = mask.width || 0;
  var maskHeight = mask.height || 0;
  var maskSurface = ensureCanvasSize(sourceState.maskSurface, maskWidth, maskHeight);

  if (!maskSurface || !maskSurface.context)
  {
    throw new Error('Unable to create segmentation mask canvas');
  }

  if (
    !sourceState.maskSurface.imageData ||
    sourceState.maskSurface.canvas.width !== maskWidth ||
    sourceState.maskSurface.canvas.height !== maskHeight
  )
  {
    sourceState.maskSurface.imageData = maskSurface.context.createImageData(maskWidth, maskHeight);
  }

  var confidenceValues = segmentationCommon.readMaskValues(mask);
  var imageData = sourceState.maskSurface.imageData.data;

  segmentationCommon.fillAlphaMaskImageData(confidenceValues, imageData, DEFAULT_MASK_ALPHA_BIAS);

  maskSurface.context.putImageData(sourceState.maskSurface.imageData, 0, 0);

  if (DEFAULT_MASK_EDGE_BLUR_PX <= 0)
  {
    return maskSurface.canvas;
  }

  var featherSurface = ensureCanvasSize(sourceState.featherSurface, maskWidth, maskHeight);

  if (!featherSurface || !featherSurface.context)
  {
    return maskSurface.canvas;
  }

  var inset = Math.max(0, Math.min(DEFAULT_MASK_INSET_PX, Math.min(maskWidth, maskHeight) / 4));

  featherSurface.context.clearRect(0, 0, maskWidth, maskHeight);
  featherSurface.context.save();
  featherSurface.context.filter = 'blur(' + DEFAULT_MASK_EDGE_BLUR_PX + 'px)';
  featherSurface.context.drawImage(
    maskSurface.canvas,
    inset,
    inset,
    Math.max(1, maskWidth - (inset * 2)),
    Math.max(1, maskHeight - (inset * 2))
  );
  featherSurface.context.restore();

  return featherSurface.canvas;
}

// ---------------------------------------------------------------------------
// 七、绘制辅助函数
// ---------------------------------------------------------------------------

// 向目标上下文绘制 surface，支持水平镜像和垂直翻转
// mirrorX: 水平翻转（用于镜像效果）；flipY: 垂直翻转（WebGL 纹理坐标系适配）
function drawSurface(targetContext, surface, x, y, drawWidth, drawHeight, mirrorX, flipY)
{
  if (!targetContext || !surface)
  {
    return;
  }

  if (!mirrorX && !flipY)
  {
    targetContext.drawImage(surface, x, y, drawWidth, drawHeight);
    return;
  }

  targetContext.save();
  targetContext.translate(
    mirrorX ? x + drawWidth : x,
    flipY ? y + drawHeight : y
  );
  targetContext.scale(mirrorX ? -1 : 1, flipY ? -1 : 1);
  targetContext.drawImage(surface, 0, 0, drawWidth, drawHeight);
  targetContext.restore();
}

function drawCoverSurface(targetContext, surface, drawWidth, drawHeight)
{
  var imageWidth = (surface && (surface.displayWidth || surface.naturalWidth || surface.videoWidth || surface.width)) || 0;
  var imageHeight = (surface && (surface.displayHeight || surface.naturalHeight || surface.videoHeight || surface.height)) || 0;

  if (!imageWidth || !imageHeight)
  {
    return false;
  }

  var imageAspect = imageWidth / imageHeight;
  var drawAspect = drawWidth / drawHeight;
  var sourceWidth = imageWidth;
  var sourceHeight = imageHeight;
  var sourceX = 0;
  var sourceY = 0;

  if (imageAspect > drawAspect)
  {
    sourceWidth = imageHeight * drawAspect;
    sourceX = (imageWidth - sourceWidth) / 2;
  }
  else
  {
    sourceHeight = imageWidth / drawAspect;
    sourceY = (imageHeight - sourceHeight) / 2;
  }

  targetContext.drawImage(
    surface,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    drawWidth,
    drawHeight
  );

  return true;
}

function resolveDrawRect(draw, applyMirror)
{
  if (!draw)
  {
    return null;
  }

  if (!applyMirror)
  {
    return draw;
  }

  return {
    x      : width - draw.x - draw.width,
    y      : draw.y,
    width  : draw.width,
    height : draw.height
  };
}

async function ensureBackgroundImage(url)
{
  if (!url)
  {
    return null;
  }

  var backgroundState = aivbBackgroundStates[url];

  if (!backgroundState)
  {
    backgroundState = {
      bitmap: null,
      promise: null,
      error: ''
    };
    aivbBackgroundStates[url] = backgroundState;
  }

  if (backgroundState.bitmap)
  {
    return backgroundState.bitmap;
  }

  if (!backgroundState.promise)
  {
    backgroundState.promise = fetch(url)
      .then(function(response)
      {
        if (!response.ok)
        {
          throw new Error('Failed to load background image: ' + response.status);
        }

        return response.blob();
      })
      .then(function(blob)
      {
        return createImageBitmap(blob);
      })
      .then(function(bitmap)
      {
        backgroundState.bitmap = bitmap;
        backgroundState.error = '';
        backgroundState.promise = null;

        return bitmap;
      })
      .catch(function(error)
      {
        backgroundState.promise = null;
        backgroundState.error = error && error.message ? error.message : String(error);

        return null;
      });
  }

  return backgroundState.promise;
}

function canRunSegmentation(sourceState, config)
{
  var fps = Number(config.maxRuntimeFps);
  var minInterval = fps > 0 ? 1000 / fps : 200;

  if (!sourceState.lastSegAt)
  {
    return true;
  }

  return now() - sourceState.lastSegAt >= minInterval;
}

function shouldUpdateMask(sourceState, config)
{
  var frameSkip = config && config.segmentation ? Number(config.segmentation.frameSkip) : 0;

  if (!sourceState.latestMask)
  {
    return true;
  }

  if (!Number.isFinite(frameSkip) || frameSkip <= 0)
  {
    return true;
  }

  return sourceState.renderedSinceSeg >= frameSkip;
}

function copyFrameToSurface(surface, frame)
{
  var frameWidth = getFrameWidth(frame);
  var frameHeight = getFrameHeight(frame);
  var target = ensureCanvasSize(surface, frameWidth, frameHeight);

  if (!target || !target.context)
  {
    return null;
  }

  target.context.clearRect(0, 0, frameWidth, frameHeight);
  drawSurface(target.context, frame, 0, 0, frameWidth, frameHeight, false, false);

  return target.canvas;
}

function buildSegmentationInput(sourceState, frame, config)
{
  var frameWidth = getFrameWidth(frame);
  var frameHeight = getFrameHeight(frame);
  var processingScale = config && config.video ? Number(config.video.processingScale) : 1;
  var scale = Number.isFinite(processingScale) ? clamp(processingScale, 0.1, 1) : 1;
  var targetWidth = Math.max(1, Math.round(frameWidth * scale));
  var targetHeight = Math.max(1, Math.round(frameHeight * scale));
  var segmentationSurface = ensureCanvasSize(sourceState.segmentationSurface, targetWidth, targetHeight);

  if (!segmentationSurface || !segmentationSurface.context)
  {
    return null;
  }

  segmentationSurface.context.clearRect(0, 0, targetWidth, targetHeight);
  drawSurface(segmentationSurface.context, frame, 0, 0, targetWidth, targetHeight, false, false);

  return segmentationSurface.canvas;
}

async function runSegmentation(sourceState, runtimeState, input)
{
  return new Promise(function(resolve, reject)
  {
    try
    {
      runtimeState.segmenter.segmentForVideo(input, now(), function(result)
      {
        try
        {
          resolve(createMaskCanvas(sourceState, runtimeState, result));
        }
        catch (error)
        {
          reject(error);
        }
        finally
        {
          segmentationCommon.closeSegmentationResult(result);
        }
      });
    }
    catch (error)
    {
      reject(error);
    }
  });
}

// ---------------------------------------------------------------------------
// 八、AiVB 核心管线 — 逐帧人像分割 → 背景合成
// ---------------------------------------------------------------------------

// 确保当前帧有最新的分割遮罩
// 流程：检查是否需要更新 → 构建分割输入 → 调用 MediaPipe segmenter → 构建遮罩 canvas
async function ensureLatestMask(item)
{
  var config = item.aiVirtualBackground;
  var sourceState = resolveAiVBState(item.id, config);

  if (config.runtimeEnabled === false)
  {
    return sourceState.latestMask;
  }

  if (now() < sourceState.runtimeAllowedAt)
  {
    return sourceState.latestMask;
  }

  if (!shouldUpdateMask(sourceState, config) || !canRunSegmentation(sourceState, config))
  {
    return sourceState.latestMask;
  }

  sourceState.lastSegAt = now();

  var runtimeState = await ensureSegmenterRuntime(config);
  var input = buildSegmentationInput(sourceState, item.frame, config);
  var pendingFrame = copyFrameToSurface(sourceState.pendingFrameSurface, item.frame);

  if (!runtimeState || !runtimeState.segmenter || !input)
  {
    return sourceState.latestMask;
  }

  sourceState.latestMask = await runSegmentation(sourceState, runtimeState, input);
  sourceState.latestFrame = copyFrameToSurface(sourceState.latestFrameSurface, pendingFrame) || pendingFrame;
  sourceState.renderedSinceSeg = 0;

  return sourceState.latestMask;
}

// 获取 item 的可渲染 surface
// 无 AiVB：直接返回原始 frame
// 有 AiVB：执行人像分割 → 前景合成 → 背景替换，返回合成后的 outputSurface canvas
// 支持三种背景模式：blur（模糊）、image（图片）、color（纯色）
async function getRenderableSurface(item)
{
  if (!hasAiVirtualBackground(item))
  {
    return item.frame;
  }

  var sourceState = resolveAiVBState(item.id, item.aiVirtualBackground);
  var mask = await ensureLatestMask(item);
  var foregroundSource = sourceState.latestFrame || item.frame;
  var drawWidth = Math.max(1, Math.round(item.draw && item.draw.width ? item.draw.width : getFrameWidth(item.frame)));
  var drawHeight = Math.max(1, Math.round(item.draw && item.draw.height ? item.draw.height : getFrameHeight(item.frame)));
  var foregroundSurface = ensureCanvasSize(sourceState.foregroundSurface, drawWidth, drawHeight);
  var outputSurface = ensureCanvasSize(sourceState.outputSurface, drawWidth, drawHeight);

  if (!foregroundSurface || !foregroundSurface.context || !outputSurface || !outputSurface.context)
  {
    return item.frame;
  }

  if (!mask)
  {
    return item.frame;
  }

  foregroundSurface.context.clearRect(0, 0, drawWidth, drawHeight);
  foregroundSurface.context.filter = buildForegroundEnhancementFilter(item.aiVirtualBackground.postProcessing);
  drawSurface(foregroundSurface.context, foregroundSource, 0, 0, drawWidth, drawHeight, Boolean(item.mirrorX), false);
  foregroundSurface.context.filter = 'none';
  foregroundSurface.context.globalCompositeOperation = 'destination-in';
  foregroundSurface.context.drawImage(mask, 0, 0, drawWidth, drawHeight);
  foregroundSurface.context.globalCompositeOperation = 'source-over';

  outputSurface.context.clearRect(0, 0, drawWidth, drawHeight);

  if (item.aiVirtualBackground.mode === 'blur')
  {
    outputSurface.context.save();
    outputSurface.context.filter = 'blur(' + (Number(item.aiVirtualBackground.blurRadius) || 16) + 'px)';
    drawSurface(outputSurface.context, foregroundSource, 0, 0, drawWidth, drawHeight, Boolean(item.mirrorX), false);
    outputSurface.context.restore();
  }
  else if (item.aiVirtualBackground.mode === 'image')
  {
    var backgroundImage = await ensureBackgroundImage(item.aiVirtualBackground.imageUrl || '');

    // 背景图就绪时绘制 cover-fit 背景；未就绪时跳过背景层，
    // 前景（人物抠图）直接叠加在清空后的画布上，避免回退到原始视频画面导致闪烁
    if (backgroundImage)
    {
      drawCoverSurface(outputSurface.context, backgroundImage, drawWidth, drawHeight);
    }
  }
  else if (item.aiVirtualBackground.mode === 'color')
  {
    outputSurface.context.fillStyle = item.aiVirtualBackground.backgroundColor || '#00ff00';
    outputSurface.context.fillRect(0, 0, drawWidth, drawHeight);
  }
  else
  {
    return item.frame;
  }

  outputSurface.context.drawImage(foregroundSurface.canvas, 0, 0, drawWidth, drawHeight);
  sourceState.renderedSinceSeg += 1;

  return outputSurface.canvas;
}

// =============================================================================
// 九、Worker 生命周期 — 初始化 / 渲染 / 销毁
// =============================================================================

// 初始化 Worker 渲染器
// 优先尝试 WebGL2；auto 模式下 WebGL2 失败则降级到 Canvas2D
// 明确指定 worker-webgl2 失败则直接回复 failed
async function init(message)
{
  canvas = message.canvas;
  requestedMode = message.requestedMode || 'auto';
  width = message.width || canvas.width || 1;
  height = message.height || canvas.height || 1;
  backgroundColor = message.backgroundColor || '#000';
  canvas.width = width;
  canvas.height = height;

  // 阶段1：尝试 WebGL2 初始化
  if (requestedMode === 'worker-webgl2' || requestedMode === 'auto')
  {
    try
    {
      initWebGL2();
      actualMode = 'worker-webgl2';
      postMessage({ type: 'ready', actualMode: actualMode, isWebGL2: true, reason: '' });

      return;
    }
    catch (error)
    {
      destroyWebGL2();

      // 明确指定 worker-webgl2 失败 → 直接失败，不降级
      if (requestedMode === 'worker-webgl2')
      {
        postMessage({ type: 'failed', reason: error.message || String(error) });
        return;
      }
    }
  }

  // 阶段2：降级到 Canvas2D（auto 模式或明确指定 worker-2d）
  try
  {
    initCanvas2D();
    actualMode = 'worker-2d';
    postMessage({ type: 'ready', actualMode: actualMode, isWebGL2: false, reason: '' });
  }
  catch (error)
  {
    postMessage({ type: 'failed', reason: error.message || String(error) });
  }
}

function initWebGL2()
{
  gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance'
  });

  if (!gl)
  {
    throw new Error('Worker WebGL2 context is not available');
  }

  var vertexShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
  var fragmentShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

  program = createProgram(vertexShader, fragmentShader);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ -1, -1, 1, -1, -1, 1, 1, 1 ]), gl.STATIC_DRAW);

  texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ 0, 0, 1, 0, 0, 1, 1, 1 ]), gl.STATIC_DRAW);

  mirrorTexCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, mirrorTexCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ 1, 0, 0, 0, 1, 1, 0, 1 ]), gl.STATIC_DRAW);

  gl.useProgram(program);
  enableAttribute('a_position', positionBuffer);
  enableAttribute('a_texCoord', texCoordBuffer);
  gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);
  opacityLocation = gl.getUniformLocation(program, 'u_opacity');
  gl.uniform1f(opacityLocation, 1);
}

function initCanvas2D()
{
  ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');

  if (!ctx)
  {
    throw new Error('Worker Canvas2D context is not available');
  }
}

// 渲染一帧 — Worker 的核心入口
// 流程：
//   1. 更新输出尺寸和背景色
//   2. 根据 actualMode 分发到 renderWebGL2() 或 renderCanvas2D()
//   3. 通过 transferToImageBitmap() 将结果传回主线程
//   4. 关闭所有已使用的 VideoFrame/ImageBitmap（防止内存泄漏）
async function render(payload)
{
  var bitmap = null;

  try
  {
    width = payload.width || width;
    height = payload.height || height;
    backgroundColor = payload.backgroundColor || backgroundColor;
    outputMirrorX = Boolean(payload.outputMirrorX);
    mirrorWatermarksWithOutput = payload.mirrorWatermarksWithOutput !== false;

    if (canvas.width !== width)
    {
      canvas.width = width;
    }

    if (canvas.height !== height)
    {
      canvas.height = height;
    }

    if (actualMode === 'worker-webgl2')
    {
      await renderWebGL2(payload);
    }
    else if (actualMode === 'worker-2d')
    {
      await renderCanvas2D(payload);
    }

    if (!canvas.transferToImageBitmap)
    {
      postMessage({ type: 'renderError', reason: 'OffscreenCanvas.transferToImageBitmap is not available' });
      return;
    }

    bitmap = canvas.transferToImageBitmap();
    postMessage({ type: 'rendered', bitmap: bitmap }, [ bitmap ]);
    bitmap = null;
  }
  catch (error)
  {
    if (bitmap && typeof bitmap.close === 'function')
    {
      bitmap.close();
    }

    postMessage({ type: 'renderError', reason: error && error.message ? error.message : String(error) });
  }
  finally
  {
    closeFrames(payload.items || []);
    closeFrames(payload.sourceWatermarks || []);
    closeFrames(payload.outputWatermarks || []);
  }
}

async function renderWebGL2(payload)
{
  var color = parseColor(payload.backgroundColor || '#000');
  var items = payload.items || [];

  gl.useProgram(program);
  gl.clearColor(color[0], color[1], color[2], color[3]);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE0);
  gl.disable(gl.BLEND);

  for (var index = 0; index < items.length; index += 1)
  {
    var item = items[index];

    if (!item.frame || !item.draw)
    {
      continue;
    }

    var surface = await getRenderableSurface(item);
    var texture = getTexture(item.id);
    var draw = resolveDrawRect(item.draw, outputMirrorX);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, surface);
    gl.uniform1f(opacityLocation, 1);
    drawRect(draw, Boolean(item.mirrorX) !== outputMirrorX);
  }

  drawWatermarksWebGL2(payload.sourceWatermarks || [], outputMirrorX);
  drawWatermarksWebGL2(payload.outputWatermarks || [], mirrorWatermarksWithOutput ? outputMirrorX : false);
  gl.flush();
}

function drawWatermarksWebGL2(watermarks, applyMirror)
{
  if (!watermarks.length)
  {
    return;
  }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  watermarks.forEach(function(watermark)
  {
    if (!watermark.frame || !watermark.draw)
    {
      return;
    }

    var texture = getWatermarkTexture(watermark.id);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, watermark.frame);
    gl.uniform1f(opacityLocation, typeof watermark.opacity === 'number' ? clamp(watermark.opacity, 0, 1) : 1);
    drawRect(resolveDrawRect(watermark.draw, applyMirror), Boolean(applyMirror));
  });

  gl.disable(gl.BLEND);
}

function drawRect(draw, mirrorX)
{
  var left = Math.round(draw.x);
  var top = Math.round(draw.y);
  var drawWidth = Math.round(draw.width);
  var drawHeight = Math.round(draw.height);

  if (drawWidth <= 0 || drawHeight <= 0)
  {
    return;
  }

  enableAttribute('a_texCoord', mirrorX ? mirrorTexCoordBuffer : texCoordBuffer);
  gl.viewport(left, top, drawWidth, drawHeight);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

async function renderCanvas2D(payload)
{
  var items = payload.items || [];

  ctx.fillStyle = payload.backgroundColor || '#000';
  ctx.fillRect(0, 0, width, height);

  for (var index = 0; index < items.length; index += 1)
  {
    var item = items[index];

    if (!item.frame || !item.draw)
    {
      continue;
    }

    var surface = await getRenderableSurface(item);
    var draw = resolveDrawRect(item.draw, outputMirrorX);

    drawSurface(ctx, surface, draw.x, draw.y, draw.width, draw.height, Boolean(item.mirrorX) !== outputMirrorX, false);
  }

  drawWatermarksCanvas2D(payload.sourceWatermarks || [], outputMirrorX);
  drawWatermarksCanvas2D(payload.outputWatermarks || [], mirrorWatermarksWithOutput ? outputMirrorX : false);
}

function drawWatermarksCanvas2D(watermarks, applyMirror)
{
  watermarks.forEach(function(watermark)
  {
    if (!watermark.frame || !watermark.draw)
    {
      return;
    }

    var previousAlpha = ctx.globalAlpha;

    var draw = resolveDrawRect(watermark.draw, applyMirror);

    ctx.globalAlpha = typeof watermark.opacity === 'number' ? watermark.opacity : 1;
    drawSurface(ctx, watermark.frame, draw.x, draw.y, draw.width, draw.height, Boolean(applyMirror), false);
    ctx.globalAlpha = previousAlpha;
  });
}

function compileShader(type, source)
{
  var shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
  {
    var shaderError = gl.getShaderInfoLog(shader);

    gl.deleteShader(shader);
    throw new Error('Could not compile shader: ' + shaderError);
  }

  return shader;
}

function createProgram(vertexShader, fragmentShader)
{
  var programObject = gl.createProgram();

  gl.attachShader(programObject, vertexShader);
  gl.attachShader(programObject, fragmentShader);
  gl.linkProgram(programObject);

  if (!gl.getProgramParameter(programObject, gl.LINK_STATUS))
  {
    var programError = gl.getProgramInfoLog(programObject);

    gl.deleteProgram(programObject);
    throw new Error('Could not link WebGL program: ' + programError);
  }

  return programObject;
}

function enableAttribute(name, buffer)
{
  var location = gl.getAttribLocation(program, name);

  gl.enableVertexAttribArray(location);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
}

function getTexture(id)
{
  if (!textures[id])
  {
    textures[id] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textures[id]);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  return textures[id];
}

function getWatermarkTexture(id)
{
  if (!watermarkTextures[id])
  {
    watermarkTextures[id] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, watermarkTextures[id]);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  return watermarkTextures[id];
}

function removeSource(id)
{
  if (gl && textures[id])
  {
    gl.deleteTexture(textures[id]);
  }

  delete textures[id];
  delete aivbSourceStates[id];
}

function closeFrames(items)
{
  items.forEach(function(item)
  {
    if (item.frame && typeof item.frame.close === 'function')
    {
      item.frame.close();
    }
  });
}

function closeBackgroundBitmaps()
{
  Object.keys(aivbBackgroundStates).forEach(function(key)
  {
    var state = aivbBackgroundStates[key];

    if (state && state.bitmap && typeof state.bitmap.close === 'function')
    {
      state.bitmap.close();
    }
  });

  aivbBackgroundStates = Object.create(null);
}

async function destroy()
{
  var runtimeKeys = Object.keys(aivbRuntimeStates);

  closeBackgroundBitmaps();
  destroyWebGL2();
  ctx = null;
  canvas = null;
  aivbSourceStates = Object.create(null);

  for (var index = 0; index < runtimeKeys.length; index += 1)
  {
    var runtimeState = aivbRuntimeStates[runtimeKeys[index]];

    if (runtimeState && runtimeState.segmenter && typeof runtimeState.segmenter.close === 'function')
    {
      try
      {
        await runtimeState.segmenter.close();
      }
      catch (error)
      {}
    }
  }

  aivbRuntimeStates = Object.create(null);
}

function destroyWebGL2()
{
  if (!gl)
  {
    return;
  }

  Object.keys(textures).forEach(function(key)
  {
    gl.deleteTexture(textures[key]);
  });
  textures = {};

  Object.keys(watermarkTextures).forEach(function(key)
  {
    gl.deleteTexture(watermarkTextures[key]);
  });
  watermarkTextures = {};

  if (positionBuffer)
  {
    gl.deleteBuffer(positionBuffer);
  }

  if (texCoordBuffer)
  {
    gl.deleteBuffer(texCoordBuffer);
  }

  if (mirrorTexCoordBuffer)
  {
    gl.deleteBuffer(mirrorTexCoordBuffer);
  }

  if (program)
  {
    gl.deleteProgram(program);
  }

  var loseContext = gl.getExtension('WEBGL_lose_context');

  if (loseContext)
  {
    loseContext.loseContext();
  }

  gl = null;
  program = null;
  positionBuffer = null;
  texCoordBuffer = null;
  mirrorTexCoordBuffer = null;
  opacityLocation = null;
}

function parseColor(value)
{
  if (!value || typeof value !== 'string')
  {
    return [ 0, 0, 0, 1 ];
  }

  var normalized = value.trim();

  if (normalized[0] === '#')
  {
    return parseHexColor(normalized);
  }

  if (normalized.indexOf('rgb') === 0)
  {
    return parseRgbColor(normalized);
  }

  return [ 0, 0, 0, 1 ];
}

function parseHexColor(value)
{
  var hex = value.slice(1);

  if (hex.length === 3)
  {
    hex = hex.split('').map(function(char)
    {
      return char + char;
    }).join('');
  }

  if (hex.length !== 6)
  {
    return [ 0, 0, 0, 1 ];
  }

  var parsed = parseInt(hex, 16);

  if (!isFinite(parsed))
  {
    return [ 0, 0, 0, 1 ];
  }

  return [
    ((parsed >> 16) & 255) / 255,
    ((parsed >> 8) & 255) / 255,
    (parsed & 255) / 255,
    1
  ];
}

function parseRgbColor(value)
{
  var match = value.match(/rgba?\(([^)]+)\)/i);

  if (!match)
  {
    return [ 0, 0, 0, 1 ];
  }

  var parts = match[1].split(',').map(function(part)
  {
    return Number(part.trim());
  });

  if (parts.length < 3 || parts.some(function(part)
  {
    return !isFinite(part);
  }))
  {
    return [ 0, 0, 0, 1 ];
  }

  return [
    clamp(parts[0] / 255, 0, 1),
    clamp(parts[1] / 255, 0, 1),
    clamp(parts[2] / 255, 0, 1),
    clamp(parts.length > 3 ? parts[3] : 1, 0, 1)
  ];
}

// =============================================================================
// 十、消息分发 — Worker 主消息循环
//
// 接收主线程的 postMessage，按 type 分发到对应处理函数：
//   init         → 初始化渲染上下文（OffscreenCanvas + WebGL2/Canvas2D）
//   render       → 渲染一帧（payload 含 items 和 watermarks）
//   removeSource → 释放指定 source 的纹理和 AiVB 状态
//   destroy      → 销毁所有资源（纹理、shader、segmenter、背景图缓存）
// =============================================================================
self.onmessage = function(event)
{
  var data = event.data || {};

  if (data.type === 'init')
  {
    init(data);
    return;
  }

  if (data.type === 'render')
  {
    render(data.payload || {});
    return;
  }

  if (data.type === 'removeSource')
  {
    removeSource(data.id);
    return;
  }

  if (data.type === 'destroy')
  {
    destroy();
  }
};
}

exports.createWorkerScript = function()
{
  var source = workerMain.toString();

		source = source.replace(
			"'__SEGMENTATION_COMMON_INJECT__'",
			"'__SEGMENTATION_COMMON_INJECT__',segmentationCommon=(" + SegmentationCommon.getWorkerSegmentationHelpersFactorySource() + ")()"
		);

  return source.slice(source.indexOf('{') + 1, source.lastIndexOf('}'));
};
