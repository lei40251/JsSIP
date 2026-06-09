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
 * 返回的管线对象暴露四个方法：
 *   - render()              — 渲染一帧（异步）
 *   - updateMirror(bool)    — 运行时切换水平镜像
 *   - updateEffectConfig({ blurRadius }) — 运行时更新模糊半径
 *   - cleanUp()             — 清空画布（丢弃管线前调用）
 *
 * @param {Object} options
 * @param {HTMLCanvasElement} options.canvas — 目标输出 canvas
 * @param {HTMLVideoElement} options.videoElement — 源视频元素
 * @param {HTMLImageElement} [options.backgroundImage] — 背景图片（'image' 模式必需）
 * @param {string} [options.backgroundColor='#00ff00'] — 'color' 模式使用的 CSS 颜色
 * @param {'none'|'blur'|'image'|'color'} options.mode — 合成模式
 * @param {boolean} [options.mirror=false] — 是否水平镜像输出
 * @param {Object} options.segmenterRuntime — MediaPipe 分割器实例（需暴露 segmentForVideo(videoEl) 方法）
 * @param {number} [options.blurRadius=20] — 高斯模糊半径（像素，0-100）
 * @returns {Object} 管线句柄 —— { render, updateMirror, updateEffectConfig, cleanUp }
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
    blurRadius
  } = options;

  const context = canvas.getContext('2d');

  if (!context)
  {
    throw new Error('2D canvas not supported');
  }

  // 离屏 canvas，用于通过 destination-in 合成方式分离出人物剪影
  const personCanvas = document.createElement('canvas');
  const personContext = personCanvas.getContext('2d');

  if (!personContext)
  {
    throw new Error('Unable to create person mask canvas');
  }

  personCanvas.width = canvas.width;
  personCanvas.height = canvas.height;

  /** @type {Object} 可变的管线状态 */
  const state = {
    backgroundImage,
    backgroundColor : backgroundColor || '#00ff00',
    blurRadius      : typeof blurRadius === 'number' ? blurRadius : 20,
    mirror          : Boolean(mirror),
    mode
  };

  /**
   * 渲染一帧。
   *
   * 工作流程：
   *   1. 若模式为 'none'，直接绘制视频帧并返回
   *   2. 对当前视频帧执行 MediaPipe 分割
   *   3. 将人物剪影绘制到离屏 canvas（视频帧被分割遮罩裁剪，使用 destination-in）
   *   4. 在目标 canvas 上绘制背景层（模糊/图片/纯色）
   *   5. 将人物叠加到最上层
   *
   * @returns {Promise<void>}
   * @throws {Error} 如果分割失败或未返回遮罩
   */
  async function render()
  {
    if (state.mode === 'none')
    {
      clearCanvas(context, canvas);
      drawVideoFrame(context, videoElement, canvas, state.mirror);

      return;
    }

    const segmentationResult = await segmenterRuntime.segmentForVideo(videoElement);

    if (!segmentationResult || !segmentationResult.segmentationMask)
    {
      throw new Error('MediaPipe segmentation did not return segmentationMask');
    }

    // ---- 构建人物遮罩（离屏） ----
    clearCanvas(personContext, personCanvas);
    drawVideoFrame(personContext, videoElement, personCanvas, state.mirror);
    // 仅保留分割遮罩非零的像素
    personContext.globalCompositeOperation = 'destination-in';
    drawVideoFrame(personContext, segmentationResult.segmentationMask, personCanvas, state.mirror);
    personContext.globalCompositeOperation = 'source-over';

    // ---- 绘制背景层 ----
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

    // ---- 将人物叠加到最上层 ----
    context.drawImage(personCanvas, 0, 0, canvas.width, canvas.height);
  }

  /**
   * 运行时更新水平镜像设置，无需重建管线。
   *
   * @param {boolean} nextMirror
   */
  function updateMirror(nextMirror)
  {
    state.mirror = Boolean(nextMirror);
  }

  /**
   * 运行时更新效果配置。
   *
   * 目前仅支持 `blurRadius`。
   *
   * @param {Object} [effectConfig={}]
   * @param {number} [effectConfig.blurRadius] — 新的模糊半径（钳位到 0-100）
   */
  function updateEffectConfig(effectConfig = {})
  {
    if (typeof effectConfig.blurRadius === 'number')
    {
      state.blurRadius = Math.max(0, Math.min(effectConfig.blurRadius, 100));
    }
  }

  /**
   * 清空两个 canvas。在丢弃管线前调用。
   */
  function cleanUp()
  {
    clearCanvas(context, canvas);
    clearCanvas(personContext, personCanvas);
  }

  return {
    render,
    updateMirror,
    updateEffectConfig,
    cleanUp
  };
}

// ---------------------------------------------------------------------------
// 内部绘图辅助函数
// ---------------------------------------------------------------------------

/**
 * 将 canvas 清空为透明黑色。
 *
 * @param {CanvasRenderingContext2D} context
 * @param {HTMLCanvasElement} canvas
 */
function clearCanvas(context, canvas)
{
  context.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * 将视频/canvas 元素绘制到目标 canvas 上，可选水平镜像。
 *
 * 镜像通过 scale(-1, 1) 变换实现。
 *
 * @param {CanvasRenderingContext2D} context — 目标 2D 上下文
 * @param {HTMLVideoElement|HTMLCanvasElement} videoElement — 源元素
 * @param {HTMLCanvasElement} canvas — 目标 canvas（用于获取尺寸）
 * @param {boolean} mirror — 是否水平翻转
 */
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

/**
 * 以 "cover" 模式绘制图片 —— 等比缩放并裁剪，使图片填满 canvas 同时保持宽高比。
 *
 * @param {CanvasRenderingContext2D} context
 * @param {HTMLImageElement} image — 源图片（必须已加载完成）
 * @param {HTMLCanvasElement} canvas — 目标 canvas
 * @throws {Error} 如果未提供图片或图片尺寸无效
 */
function drawCoverImage(context, image, canvas)
{
  if (!image)
  {
    throw new Error('Background image required for image mode');
  }

  // 兼容 <img>、<video> 以及原始 ImageData / ImageBitmap
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

  // 裁剪较长的一边以匹配目标宽高比
  if (sourceRatio > targetRatio)
  {
    // 图片更宽 —— 裁剪左右两侧
    cropWidth = sourceHeight * targetRatio;
    offsetX = (sourceWidth - cropWidth) / 2;
  }
  else
  {
    // 图片更高 —— 裁剪上下两侧
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

module.exports = {
  buildCanvas2DPipeline
};
