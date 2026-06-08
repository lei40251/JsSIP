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

  const personCanvas = document.createElement('canvas');
  const personContext = personCanvas.getContext('2d');

  if (!personContext)
  {
    throw new Error('Unable to create person mask canvas');
  }

  personCanvas.width = canvas.width;
  personCanvas.height = canvas.height;

  const state = {
    backgroundImage,
    backgroundColor : backgroundColor || '#00ff00',
    blurRadius      : typeof blurRadius === 'number' ? blurRadius : 20,
    mirror          : Boolean(mirror),
    mode
  };

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

    clearCanvas(personContext, personCanvas);
    drawVideoFrame(personContext, videoElement, personCanvas, state.mirror);
    personContext.globalCompositeOperation = 'destination-in';
    drawVideoFrame(personContext, segmentationResult.segmentationMask, personCanvas, state.mirror);
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
  }

  function updateMirror(nextMirror)
  {
    state.mirror = Boolean(nextMirror);
  }

  function updateEffectConfig(effectConfig = {})
  {
    if (typeof effectConfig.blurRadius === 'number')
    {
      state.blurRadius = Math.max(0, Math.min(effectConfig.blurRadius, 100));
    }
  }

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

module.exports = {
  buildCanvas2DPipeline
};
