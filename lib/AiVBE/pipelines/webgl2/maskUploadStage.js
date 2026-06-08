const { compileShader, createPiplelineStageProgram, createTexture, glsl } = require('../../../VirtualBackground/pipelines/helpers/webglHelper.js');

const inputResolutions = {
  '640x360' : [ 640, 360 ],
  '256x256' : [ 256, 256 ],
  '256x144' : [ 256, 144 ],
  '160x96'  : [ 160, 96 ]
};

exports.buildMaskUploadStage = (gl, vertexShader, positionBuffer, texCoordBuffer, segmentationConfig, outputTexture) =>
{
  const fragmentShaderSource = glsl`#version 300 es

    precision highp float;

    uniform sampler2D u_segmentationMask;

    in vec2 v_texCoord;

    out vec4 outColor;

    void main() {
      vec4 mask = texture(u_segmentationMask, v_texCoord);
      float alpha = mask.a > 0.0 ? mask.a : max(mask.r, max(mask.g, mask.b));
      outColor = vec4(0.0, 0.0, 0.0, alpha);
    }
  `;

  const [ segmentationWidth, segmentationHeight ] = inputResolutions[segmentationConfig.inputResolution];
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = createPiplelineStageProgram(
    gl,
    vertexShader,
    fragmentShader,
    positionBuffer,
    texCoordBuffer
  );
  const maskLocation = gl.getUniformLocation(program, 'u_segmentationMask');
  const inputTexture = createTexture(
    gl,
    gl.RGBA8,
    segmentationWidth,
    segmentationHeight,
    gl.LINEAR,
    gl.LINEAR
  );
  const frameBuffer = gl.createFramebuffer();
  let maskCanvas = null;
  let maskContext = null;

  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    outputTexture,
    0
  );

  gl.useProgram(program);
  gl.uniform1i(maskLocation, 1);

  function getUploadSource(maskSource)
  {
    if (typeof document === 'undefined')
    {
      return maskSource;
    }

    if (!maskCanvas)
    {
      maskCanvas = document.createElement('canvas');
      maskCanvas.width = segmentationWidth;
      maskCanvas.height = segmentationHeight;
      maskContext = maskCanvas.getContext('2d');
    }

    if (!maskContext)
    {
      return maskSource;
    }

    maskContext.clearRect(0, 0, segmentationWidth, segmentationHeight);
    maskContext.drawImage(maskSource, 0, 0, segmentationWidth, segmentationHeight);

    return maskCanvas;
  }

  function render(maskSource)
  {
    const uploadSource = getUploadSource(maskSource);

    gl.viewport(0, 0, segmentationWidth, segmentationHeight);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      uploadSource
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function cleanUp()
  {
    gl.deleteFramebuffer(frameBuffer);
    gl.deleteTexture(inputTexture);
    gl.deleteProgram(program);
    gl.deleteShader(fragmentShader);
  }

  return { render, cleanUp };
};
