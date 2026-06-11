/**
 * workerScript — Worker 内联脚本生成器
 *
 * 生成一个自包含的 WebWorker 渲染脚本源码字符串。
 * Browserify 将此模块打包进 SDK 主包，默认通过 Blob URL 创建 Worker。
 *
 * Worker 内部支持：
 *   - worker-webgl2: OffscreenCanvas + WebGL2 输出
 *   - worker-2d: OffscreenCanvas + Canvas2D 输出
 *   - source-level AI virtual background: MediaPipe + OffscreenCanvas 全部留在 Worker
 *
 * @module workerScript
 */
exports.createWorkerScript = function()
{
  // eslint-disable-next-line quotes
  return `
var canvas = null;
var ctx = null;
var gl = null;
var program = null;
var positionBuffer = null;
var texCoordBuffer = null;
var textures = {};
var watermarkTextures = {};
var actualMode = 'unknown';
var requestedMode = 'auto';
var width = 0;
var height = 0;
var backgroundColor = '#000';
var outputMirrorX = false;
var mirrorWatermarksWithOutput = true;
var opacityLocation = null;
var mirrorTexCoordBuffer = null;
var aivbSourceStates = Object.create(null);
var aivbRuntimeStates = Object.create(null);
var aivbModulePromises = Object.create(null);
var aivbBackgroundStates = Object.create(null);
var VERTEX_SHADER = "#version 300 es\\nin vec2 a_position;\\nin vec2 a_texCoord;\\nout vec2 v_texCoord;\\nvoid main() {\\n  gl_Position = vec4(a_position, 0.0, 1.0);\\n  v_texCoord = a_texCoord;\\n}\\n";
var FRAGMENT_SHADER = "#version 300 es\\nprecision highp float;\\nin vec2 v_texCoord;\\nuniform sampler2D u_texture;\\nuniform float u_opacity;\\nout vec4 outColor;\\nvoid main() {\\n  vec4 color = texture(u_texture, v_texCoord);\\n  outColor = vec4(color.rgb, color.a * u_opacity);\\n}\\n";

function now()
{
  return typeof performance !== 'undefined' && performance && typeof performance.now === 'function' ?
    performance.now() :
    Date.now();
}

function clamp(value, min, max)
{
  return Math.min(max, Math.max(min, value));
}

function hasAiVirtualBackground(item)
{
  return Boolean(item &&
    item.aiVirtualBackground &&
    item.aiVirtualBackground.enabled !== false &&
    item.aiVirtualBackground.mode &&
    item.aiVirtualBackground.mode !== 'none');
}

function getFrameWidth(frame)
{
  return (frame && (frame.displayWidth || frame.codedWidth || frame.width)) || 0;
}

function getFrameHeight(frame)
{
  return (frame && (frame.displayHeight || frame.codedHeight || frame.height)) || 0;
}

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

function getSourceState(id)
{
  if (!aivbSourceStates[id])
  {
    aivbSourceStates[id] = {
      configKey                  : '',
      latestMask                 : null,
      renderedSinceSegmentation  : 0,
      lastSegmentationScheduledAt: 0,
      runtimeAllowedAt           : 0,
      segmentationSurface        : { canvas: null, context: null },
      maskSurface                : { canvas: null, context: null, imageData: null },
      foregroundSurface          : { canvas: null, context: null },
      outputSurface              : { canvas: null, context: null }
    };
  }

  return aivbSourceStates[id];
}

function createConfigKey(config)
{
  return JSON.stringify({
    mode            : config.mode || '',
    imageUrl        : config.imageUrl || '',
    backgroundColor : config.backgroundColor || '',
    blurRadius      : Number(config.blurRadius) || 0,
    modelPath       : config.modelPath || '',
    runtimeEnabled  : config.runtimeEnabled !== false,
    startupDelayMs  : Number(config.startupDelayMs) || 0,
    maxRuntimeFps   : Number(config.maxRuntimeFps) || 0,
    video           : config.video || {},
    segmentation    : config.segmentation || {},
    assetConfig     : config.assetConfig || {}
  });
}

function resetSourceStateForConfig(state, config)
{
  state.latestMask = null;
  state.renderedSinceSegmentation = 0;
  state.lastSegmentationScheduledAt = 0;
  state.runtimeAllowedAt = now() + Math.max(0, Number(config.startupDelayMs) || 0);
}

function resolveAiVBState(id, config)
{
  var state = getSourceState(id);
  var configKey = createConfigKey(config);

  if (state.configKey !== configKey)
  {
    state.configKey = configKey;
    resetSourceStateForConfig(state, config);
  }

  return state;
}

async function loadVisionTasksModule(moduleUrl)
{
  if (!moduleUrl)
  {
    throw new Error('AIVirtualBackground moduleUrl is required');
  }

  if (!aivbModulePromises[moduleUrl])
  {
    aivbModulePromises[moduleUrl] = import(moduleUrl)
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

function getRuntimeKey(config)
{
  return JSON.stringify({
    moduleUrl   : config.assetConfig && config.assetConfig.moduleUrl ? config.assetConfig.moduleUrl : '',
    wasmBaseUrl : config.assetConfig && config.assetConfig.wasmBaseUrl ? config.assetConfig.wasmBaseUrl : '',
    modelUrl    : config.modelPath || (config.assetConfig && config.assetConfig.modelUrl) || '',
    delegate    : config.segmentation && config.segmentation.delegate ? config.segmentation.delegate : 'GPU'
  });
}

function resolvePersonMaskIndex(labels, maskCount)
{
  for (var index = 0; index < labels.length; index += 1)
  {
    if (typeof labels[index] === 'string' && /person/i.test(labels[index]))
    {
      return index;
    }
  }

  if (maskCount > 1)
  {
    return maskCount - 1;
  }

  return 0;
}

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
      var moduleUrl = config.assetConfig && config.assetConfig.moduleUrl ? config.assetConfig.moduleUrl : '';
      var wasmBaseUrl = config.assetConfig && config.assetConfig.wasmBaseUrl ? config.assetConfig.wasmBaseUrl : '';
      var modelUrl = config.modelPath || (config.assetConfig && config.assetConfig.modelUrl) || '';
      var delegate = config.segmentation && config.segmentation.delegate ? config.segmentation.delegate : 'GPU';
      var tasksModule = await loadVisionTasksModule(moduleUrl);
      var vision = await tasksModule.FilesetResolver.forVisionTasks(wasmBaseUrl);
      var segmenter = await tasksModule.ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelUrl,
          delegate: delegate
        },
        runningMode: 'VIDEO',
        outputCategoryMask: false,
        outputConfidenceMasks: true
      });

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

function closeSegmentationResult(result)
{
  if (result && typeof result.close === 'function')
  {
    result.close();
    return;
  }

  if (result && Array.isArray(result.confidenceMasks))
  {
    result.confidenceMasks.forEach(function(mask)
    {
      if (mask && typeof mask.close === 'function')
      {
        mask.close();
      }
    });
  }

  if (result && result.categoryMask && typeof result.categoryMask.close === 'function')
  {
    result.categoryMask.close();
  }
}

function resolveMaskValues(mask)
{
  if (!mask)
  {
    throw new Error('ImageSegmenter mask is required');
  }

  if (typeof mask.getAsFloat32Array === 'function')
  {
    return mask.getAsFloat32Array();
  }

  if (typeof mask.getAsUint8Array === 'function')
  {
    var categoryValues = mask.getAsUint8Array();
    var floatValues = new Float32Array(categoryValues.length);

    for (var index = 0; index < categoryValues.length; index += 1)
    {
      floatValues[index] = categoryValues[index] > 0 ? 1 : 0;
    }

    return floatValues;
  }

  throw new Error('Unsupported ImageSegmenter mask format');
}

function createMaskCanvas(sourceState, runtimeState, result)
{
  var mask = null;

  if (result && Array.isArray(result.confidenceMasks) && result.confidenceMasks.length > 0)
  {
    var personMaskIndex = resolvePersonMaskIndex(runtimeState.labels || [], result.confidenceMasks.length);

    mask = result.confidenceMasks[personMaskIndex];
  }
  else if (result && result.categoryMask)
  {
    mask = result.categoryMask;
  }

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

  var confidenceValues = resolveMaskValues(mask);
  var imageData = sourceState.maskSurface.imageData.data;
  var offset = 0;

  for (var index = 0; index < confidenceValues.length; index += 1)
  {
    var alpha = Math.max(0, Math.min(255, Math.round(confidenceValues[index] * 255)));

    imageData[offset] = 0;
    imageData[offset + 1] = 0;
    imageData[offset + 2] = 0;
    imageData[offset + 3] = alpha;
    offset += 4;
  }

  maskSurface.context.putImageData(sourceState.maskSurface.imageData, 0, 0);

  return maskSurface.canvas;
}

function drawSurfaceToContext(targetContext, surface, x, y, drawWidth, drawHeight, mirrorX, flipY)
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

  if (!sourceState.lastSegmentationScheduledAt)
  {
    return true;
  }

  return now() - sourceState.lastSegmentationScheduledAt >= minInterval;
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

  return sourceState.renderedSinceSegmentation >= frameSkip;
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
  drawSurfaceToContext(segmentationSurface.context, frame, 0, 0, targetWidth, targetHeight, false, false);

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
          closeSegmentationResult(result);
        }
      });
    }
    catch (error)
    {
      reject(error);
    }
  });
}

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

  sourceState.lastSegmentationScheduledAt = now();

  var runtimeState = await ensureSegmenterRuntime(config);
  var input = buildSegmentationInput(sourceState, item.frame, config);

  if (!runtimeState || !runtimeState.segmenter || !input)
  {
    return sourceState.latestMask;
  }

  sourceState.latestMask = await runSegmentation(sourceState, runtimeState, input);
  sourceState.renderedSinceSegmentation = 0;

  return sourceState.latestMask;
}

async function getRenderableSurface(item)
{
  if (!hasAiVirtualBackground(item))
  {
    return item.frame;
  }

  var sourceState = resolveAiVBState(item.id, item.aiVirtualBackground);
  var mask = await ensureLatestMask(item);
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
  drawSurfaceToContext(foregroundSurface.context, item.frame, 0, 0, drawWidth, drawHeight, Boolean(item.mirrorX), false);
  foregroundSurface.context.globalCompositeOperation = 'destination-in';
  foregroundSurface.context.drawImage(mask, 0, 0, drawWidth, drawHeight);
  foregroundSurface.context.globalCompositeOperation = 'source-over';

  outputSurface.context.clearRect(0, 0, drawWidth, drawHeight);

  if (item.aiVirtualBackground.mode === 'blur')
  {
    outputSurface.context.save();
    outputSurface.context.filter = 'blur(' + (Number(item.aiVirtualBackground.blurRadius) || 16) + 'px)';
    drawSurfaceToContext(outputSurface.context, item.frame, 0, 0, drawWidth, drawHeight, Boolean(item.mirrorX), false);
    outputSurface.context.restore();
  }
  else if (item.aiVirtualBackground.mode === 'image')
  {
    var backgroundImage = await ensureBackgroundImage(item.aiVirtualBackground.imageUrl || '');

    if (!backgroundImage || !drawCoverSurface(outputSurface.context, backgroundImage, drawWidth, drawHeight))
    {
      return item.frame;
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
  sourceState.renderedSinceSegmentation += 1;

  return outputSurface.canvas;
}

async function init(message)
{
  canvas = message.canvas;
  requestedMode = message.requestedMode || 'auto';
  width = message.width || canvas.width || 1;
  height = message.height || canvas.height || 1;
  backgroundColor = message.backgroundColor || '#000';
  canvas.width = width;
  canvas.height = height;

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

      if (requestedMode === 'worker-webgl2')
      {
        postMessage({ type: 'failed', reason: error.message || String(error) });
        return;
      }
    }
  }

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
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
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
  var top = Math.round(height - draw.y - draw.height);
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

    drawSurfaceToContext(ctx, surface, draw.x, draw.y, draw.width, draw.height, Boolean(item.mirrorX) !== outputMirrorX, false);
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
    drawSurfaceToContext(ctx, watermark.frame, draw.x, draw.y, draw.width, draw.height, Boolean(applyMirror), false);
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
  var match = value.match(/rgba?\\\\(([^)]+)\\\\)/i);

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
`;
};
