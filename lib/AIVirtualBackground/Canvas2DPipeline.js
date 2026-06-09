/**
 * Canvas2DPipeline —— 基于 Canvas2D 的快速合成管线，用于虚拟背景效果。
 *
 * 使用一个离屏 <canvas> 做人像遮罩，目标 canvas 做最终合成。
 * 无需 WebGL —— 所有支持 Canvas2D 的环境均可工作。
 *
 * 支持的合成模式：
 *   - 'none'  — 直接绘制视频帧，不做背景替换
 *   - 'blur'  — 模糊原始背景，再将人像叠加在上层
 *   - 'image' — 用 cover-fit 图片替换背景
 *   - 'color' — 用纯色填充背景
 *
 * @module Canvas2DPipeline
 */

/**
 * 构建 Canvas2D 渲染管线。
 *
 * 返回的管线对象在 init 后长期复用，通过 updateState 更新模式和资源，
 * 避免每次切换背景都销毁再重建。
 *
 * @param {Object} options
 * @param {HTMLCanvasElement} options.canvas — 目标输出 canvas
 * @param {HTMLVideoElement} options.videoElement — 源视频元素
 * @param {HTMLImageElement} [options.backgroundImage] — 背景图片（'image' 模式使用）
 * @param {string} [options.backgroundColor='#00ff00'] — 'color' 模式使用的 CSS 颜色
 * @param {'none'|'blur'|'image'|'color'} options.mode — 合成模式
 * @param {boolean} [options.mirror=false] — 是否水平镜像输出
 * @param {Object} options.segmenterRuntime — MediaPipe 分割器实例（需暴露 segmentForVideo(videoEl) 方法）
 * @param {number} [options.blurRadius=20] — 高斯模糊半径
 * @param {number} [options.maxBlurRadius=12] — 高斯模糊半径上限
 * @param {number} [options.processingScale=0.5] — 分割输入缩放比例
 * @param {number} [options.frameSkip=1] — 分割降频参数，0 表示每帧都做
 * @param {Object} [options.metrics] — 可选的指标回调
 * @returns {Object} 管线句柄
 * @throws {Error} 如果无法从 canvas 获取 2D 上下文
 */
function buildCanvas2DPipeline(options)
{
  const {
    canvas,
    videoElement,
    backgroundImage,
    backgroundColor,
    mode,
    mirror,
    segmenterRuntime,
    blurRadius,
    maxBlurRadius,
    processingScale,
    frameSkip,
    metrics
  } = options;

  const context = canvas.getContext('2d');

  if (!context)
  {
    throw new Error('2D canvas not supported');
  }

  const personCanvas = document.createElement('canvas');
  const personContext = personCanvas.getContext('2d');

  if (!personContext)
  {
    throw new Error('Unable to create person mask canvas');
  }

  const segmentationCanvas = document.createElement('canvas');
  const segmentationContext = segmentationCanvas.getContext('2d');

  if (!segmentationContext)
  {
    throw new Error('Unable to create segmentation input canvas');
  }

  personCanvas.width = canvas.width;
  personCanvas.height = canvas.height;

  /** @type {Object} 可变的管线状态 */
  const state = {
    backgroundImage : backgroundImage || null,
    backgroundColor : backgroundColor || '#00ff00',
    blurRadius      : clampBlurRadius(blurRadius, maxBlurRadius),
    frameSkip       : normalizeFrameSkip(frameSkip),
    maxBlurRadius   : normalizeMaxBlurRadius(maxBlurRadius),
    mirror          : Boolean(mirror),
    mode            : mode || 'none',
    processingScale : normalizeProcessingScale(processingScale)
  };

  /** @type {HTMLCanvasElement|null} 上一帧可复用的分割遮罩 */
  let lastSegmentationMask = null;
  
  /** @type {number} 自上次新分割以来已输出的帧数 */
  let renderedSinceSegmentation = 0;

  /** @type {boolean} 最近一帧是否复用了旧遮罩 */
  let lastMaskReused = false;

  resizeWorkingCanvases();

  async function render()
  {
    const renderStartAt = getNow();

    ensureCanvasSizes();

    if (state.mode === 'none')
    {
      clearCanvas(context, canvas);
      drawVideoFrame(context, videoElement, canvas, state.mirror);
      renderedSinceSegmentation += 1;
      lastMaskReused = false;
      emitMetric('onRenderComplete', {
        renderDurationMs       : getNow() - renderStartAt,
        reusedMask             : false,
        segmentationDurationMs : 0,
        segmentationRan        : false,
        segmentationMask       : null
      });

      return;
    }

    const segmentationDecision = shouldRunSegmentation();
    let segmentationMask = lastSegmentationMask;
    let segmentationRan = false;
    let segmentationDurationMs = 0;

    if (segmentationDecision.run)
    {
      const segmentationStartAt = getNow();

      segmentationMask = await getSegmentationMask();
      segmentationRan = true;
      segmentationDurationMs = getNow() - segmentationStartAt;
      lastSegmentationMask = segmentationMask;
      renderedSinceSegmentation = 0;
      lastMaskReused = false;
    }
    else
    {
      renderedSinceSegmentation += 1;
      lastMaskReused = true;
    }

    if (!segmentationMask)
    {
      throw new Error('MediaPipe segmentation did not return segmentationMask');
    }

    clearCanvas(personContext, personCanvas);
    drawVideoFrame(personContext, videoElement, personCanvas, state.mirror);
    personContext.globalCompositeOperation = 'destination-in';
    drawVideoFrame(personContext, segmentationMask, personCanvas, state.mirror);
    personContext.globalCompositeOperation = 'source-over';

    clearCanvas(context, canvas);

    if (state.mode === 'blur')
    {
      context.save();
      context.filter = `blur(${state.blurRadius}px)`;
      drawVideoFrame(context, videoElement, canvas, state.mirror);
      context.restore();
    }
    else if (state.mode === 'image')
    {
      drawCoverImage(context, state.backgroundImage, canvas);
    }
    else if (state.mode === 'color')
    {
      context.fillStyle = state.backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(personCanvas, 0, 0, canvas.width, canvas.height);
    emitMetric('onRenderComplete', {
      renderDurationMs       : getNow() - renderStartAt,
      reusedMask             : lastMaskReused,
      segmentationDurationMs : segmentationDurationMs,
      segmentationRan        : segmentationRan,
      segmentationMask       : segmentationMask
    });
  }

  function updateState(nextState = {})
  {
    if (Object.prototype.hasOwnProperty.call(nextState, 'mode') && nextState.mode)
    {
      state.mode = nextState.mode;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'mirror'))
    {
      state.mirror = Boolean(nextState.mirror);
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'backgroundImage'))
    {
      state.backgroundImage = nextState.backgroundImage || null;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'backgroundColor') && nextState.backgroundColor)
    {
      state.backgroundColor = nextState.backgroundColor;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'maxBlurRadius'))
    {
      state.maxBlurRadius = normalizeMaxBlurRadius(nextState.maxBlurRadius);
      state.blurRadius = clampBlurRadius(state.blurRadius, state.maxBlurRadius);
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'blurRadius'))
    {
      state.blurRadius = clampBlurRadius(nextState.blurRadius, state.maxBlurRadius);
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'processingScale'))
    {
      state.processingScale = normalizeProcessingScale(nextState.processingScale);
      resizeWorkingCanvases();
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'frameSkip'))
    {
      state.frameSkip = normalizeFrameSkip(nextState.frameSkip);
    }
  }

  function setMode(nextMode)
  {
    updateState({ mode: nextMode });
  }

  function setBackgroundImage(nextImage)
  {
    updateState({ backgroundImage: nextImage });
  }

  function setBackgroundColor(nextColor)
  {
    updateState({ backgroundColor: nextColor });
  }

  function setBlurRadius(nextBlurRadius)
  {
    updateState({ blurRadius: nextBlurRadius });
  }

  function updateMirror(nextMirror)
  {
    updateState({ mirror: nextMirror });
  }

  function updateEffectConfig(effectConfig = {})
  {
    updateState(effectConfig);
  }

  function getState()
  {
    return {
      backgroundImage : state.backgroundImage,
      backgroundColor : state.backgroundColor,
      blurRadius      : state.blurRadius,
      frameSkip       : state.frameSkip,
      maxBlurRadius   : state.maxBlurRadius,
      mirror          : state.mirror,
      mode            : state.mode,
      processingScale : state.processingScale
    };
  }

  function cleanUp()
  {
    clearCanvas(context, canvas);
    clearCanvas(personContext, personCanvas);
    clearCanvas(segmentationContext, segmentationCanvas);
    lastSegmentationMask = null;
    renderedSinceSegmentation = 0;
    lastMaskReused = false;
  }

  function ensureCanvasSizes()
  {
    if (personCanvas.width !== canvas.width || personCanvas.height !== canvas.height)
    {
      personCanvas.width = canvas.width;
      personCanvas.height = canvas.height;
    }

    resizeWorkingCanvases();
  }

  function resizeWorkingCanvases()
  {
    const width = Math.max(1, Math.round(canvas.width * state.processingScale));
    const height = Math.max(1, Math.round(canvas.height * state.processingScale));

    if (segmentationCanvas.width !== width)
    {
      segmentationCanvas.width = width;
    }

    if (segmentationCanvas.height !== height)
    {
      segmentationCanvas.height = height;
    }
  }

  function shouldRunSegmentation()
  {
    if (!lastSegmentationMask)
    {
      return { run: true };
    }

    if (state.frameSkip <= 0)
    {
      return { run: true };
    }

    if (renderedSinceSegmentation >= state.frameSkip)
    {
      return { run: true };
    }

    return { run: false };
  }

  async function getSegmentationMask()
  {
    clearCanvas(segmentationContext, segmentationCanvas);
    drawVideoFrame(segmentationContext, videoElement, segmentationCanvas, false);

    const segmentationResult = await segmenterRuntime.segmentForVideo(segmentationCanvas);

    if (!segmentationResult || !segmentationResult.segmentationMask)
    {
      throw new Error('MediaPipe segmentation did not return segmentationMask');
    }

    return segmentationResult.segmentationMask;
  }

  function emitMetric(method, payload)
  {
    if (!metrics || typeof metrics[method] !== 'function')
    {
      return;
    }

    metrics[method](payload);
  }

  return {
    render,
    updateState,
    setMode,
    setBackgroundImage,
    setBackgroundColor,
    setBlurRadius,
    updateMirror,
    updateEffectConfig,
    getState,
    cleanUp
  };
}

function clearCanvas(context, canvas)
{
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function drawVideoFrame(context, videoElement, canvas, mirror)
{
  context.save();

  if (mirror)
  {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }

  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  context.restore();
}

function drawCoverImage(context, image, canvas)
{
  if (!image)
  {
    throw new Error('Background image required for image mode');
  }

  const sourceWidth = image.naturalWidth || image.videoWidth || image.width;
  const sourceHeight = image.naturalHeight || image.videoHeight || image.height;

  if (!sourceWidth || !sourceHeight)
  {
    throw new Error('Background image has invalid dimensions');
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = canvas.width / canvas.height;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (sourceRatio > targetRatio)
  {
    cropWidth = sourceHeight * targetRatio;
    offsetX = (sourceWidth - cropWidth) / 2;
  }
  else
  {
    cropHeight = sourceWidth / targetRatio;
    offsetY = (sourceHeight - cropHeight) / 2;
  }

  context.drawImage(
    image,
    offsetX,
    offsetY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );
}

function normalizeProcessingScale(value)
{
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue))
  {
    return 0.5;
  }

  return Math.min(1, Math.max(0.1, numericValue));
}

function normalizeFrameSkip(value)
{
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue))
  {
    return 1;
  }

  return Math.max(0, Math.floor(numericValue));
}

function normalizeMaxBlurRadius(value)
{
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue))
  {
    return 12;
  }

  return Math.min(100, Math.max(0, numericValue));
}

function clampBlurRadius(value, maxBlurRadius)
{
  const numericValue = Number(value);
  const maxValue = normalizeMaxBlurRadius(maxBlurRadius);

  if (!Number.isFinite(numericValue))
  {
    return Math.min(20, maxValue);
  }

  return Math.min(maxValue, Math.max(0, numericValue));
}

function getNow()
{
  if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function')
  {
    return performance.now();
  }

  return Date.now();
}

module.exports = {
  buildCanvas2DPipeline
};
