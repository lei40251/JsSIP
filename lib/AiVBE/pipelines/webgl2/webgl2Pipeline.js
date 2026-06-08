const { buildJointBilateralFilterStage } = require('../../../VirtualBackground/pipelines/webgl2/jointBilateralFilterStage.js');
const { buildBackgroundImageStage } = require('../../../VirtualBackground/pipelines/webgl2/backgroundImageStage.js');
const { buildBackgroundBlurStage } = require('../../../VirtualBackground/pipelines/webgl2/backgroundBlurStage.js');
const { buildMaskUploadStage } = require('./maskUploadStage.js');
const { compileShader, createTexture, glsl } = require('../../../VirtualBackground/pipelines/helpers/webglHelper.js');

const inputResolutions = {
  '640x360' : [ 640, 360 ],
  '256x256' : [ 256, 256 ],
  '256x144' : [ 256, 144 ],
  '160x96'  : [ 160, 96 ]
};

exports.buildWebGL2Pipeline = (sourcePlayback, backgroundImage, backgroundConfig, segmentationConfig, canvas, segmenterRuntime) =>
{
  const vertexShaderSource = glsl`#version 300 es

    in vec2 a_position;
    in vec2 a_texCoord;

    out vec2 v_texCoord;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `;

  const { width: frameWidth, height: frameHeight } = sourcePlayback;
  const segmentationResolution = inputResolutions[segmentationConfig.inputResolution];

  if (!segmentationResolution)
  {
    throw new Error(`Unsupported segmentation inputResolution: ${segmentationConfig.inputResolution}`);
  }

  const [ segmentationWidth, segmentationHeight ] = segmentationResolution;
  const gl = canvas.getContext('webgl2');

  if (!gl)
  {
    throw new Error('WebGL2 not supported');
  }

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const vertexArray = gl.createVertexArray();

  gl.bindVertexArray(vertexArray);

  const positionBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([ -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0 ]),
    gl.STATIC_DRAW
  );

  const texCoordBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([ 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0 ]),
    gl.STATIC_DRAW
  );

  const inputFrameTexture = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, inputFrameTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const segmentationTexture = createTexture(
    gl,
    gl.RGBA8,
    segmentationWidth,
    segmentationHeight,
    gl.LINEAR,
    gl.LINEAR
  );
  const personMaskTexture = createTexture(
    gl,
    gl.RGBA8,
    frameWidth,
    frameHeight
  );

  const maskUploadStage = buildMaskUploadStage(
    gl,
    vertexShader,
    positionBuffer,
    texCoordBuffer,
    segmentationConfig,
    segmentationTexture
  );
  const jointBilateralFilterStage = buildJointBilateralFilterStage(
    gl,
    vertexShader,
    positionBuffer,
    texCoordBuffer,
    segmentationTexture,
    segmentationConfig,
    personMaskTexture,
    canvas
  );
  const backgroundStage =
    backgroundConfig.type === 'blur'
      ? buildBackgroundBlurStage(
        gl,
        vertexShader,
        positionBuffer,
        texCoordBuffer,
        personMaskTexture,
        canvas,
        backgroundConfig.mirror
      )
      : buildBackgroundImageStage(
        gl,
        positionBuffer,
        texCoordBuffer,
        personMaskTexture,
        backgroundImage,
        canvas,
        backgroundConfig.mirror
      );

  async function render()
  {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputFrameTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      sourcePlayback.htmlElement
    );
    gl.bindVertexArray(vertexArray);

    const segmentationResult = await segmenterRuntime.segmentForVideo(sourcePlayback.htmlElement);

    if (!segmentationResult || !segmentationResult.segmentationMask)
    {
      throw new Error('MediaPipe segmentation did not return segmentationMask');
    }

    maskUploadStage.render(segmentationResult.segmentationMask);
    jointBilateralFilterStage.render();
    backgroundStage.render();
  }

  function updatePostProcessingConfig(postProcessingConfig)
  {
    jointBilateralFilterStage.updateSigmaSpace(
      postProcessingConfig.jointBilateralFilter.sigmaSpace
    );
    jointBilateralFilterStage.updateSigmaColor(
      postProcessingConfig.jointBilateralFilter.sigmaColor
    );

    if (backgroundConfig.type === 'image')
    {
      backgroundStage.updateCoverage(postProcessingConfig.coverage);
      backgroundStage.updateLightWrapping(postProcessingConfig.lightWrapping);
      backgroundStage.updateBlendMode(postProcessingConfig.blendMode);
    }
    else if (backgroundConfig.type === 'blur')
    {
      backgroundStage.updateCoverage(postProcessingConfig.coverage);
      if (typeof postProcessingConfig.blurRadius === 'number')
      {
        backgroundStage.updateBlurRadius(postProcessingConfig.blurRadius);
      }
    }
    else
    {
      backgroundStage.updateCoverage([ 0, 0.9999 ]);
      backgroundStage.updateLightWrapping(0);
    }
  }

  function updateMirror(mirror)
  {
    if (backgroundStage.updateMirror)
    {
      backgroundStage.updateMirror(mirror);
    }
  }

  function cleanUp()
  {
    backgroundStage.cleanUp();
    jointBilateralFilterStage.cleanUp();
    maskUploadStage.cleanUp();
    gl.deleteTexture(personMaskTexture);
    gl.deleteTexture(segmentationTexture);
    gl.deleteTexture(inputFrameTexture);
    gl.deleteBuffer(texCoordBuffer);
    gl.deleteBuffer(positionBuffer);
    gl.deleteVertexArray(vertexArray);
    gl.deleteShader(vertexShader);
  }

  return { render, updatePostProcessingConfig, updateMirror, cleanUp };
};
