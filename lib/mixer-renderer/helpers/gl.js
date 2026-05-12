/**
 * 编译 WebGL shader。
 *
 * @param {WebGL2RenderingContext} gl - WebGL2 上下文
 * @param {number} shaderType - gl.VERTEX_SHADER 或 gl.FRAGMENT_SHADER
 * @param {string} shaderSource - GLSL 源码
 * @returns {WebGLShader} 编译后的 shader
 */
exports.compileShader = function(gl, shaderType, shaderSource)
{
  const shader = gl.createShader(shaderType);

  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
  {
    const message = gl.getShaderInfoLog(shader);

    gl.deleteShader(shader);
    throw new Error(`Could not compile shader: ${message}`);
  }

  return shader;
};

/**
 * 链接 WebGL program。
 *
 * @param {WebGL2RenderingContext} gl - WebGL2 上下文
 * @param {WebGLShader} vertexShader - 顶点 shader
 * @param {WebGLShader} fragmentShader - 片元 shader
 * @returns {WebGLProgram} 链接后的 program
 */
exports.createProgram = function(gl, vertexShader, fragmentShader)
{
  const program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
  {
    const message = gl.getProgramInfoLog(program);

    gl.deleteProgram(program);
    throw new Error(`Could not link WebGL program: ${message}`);
  }

  return program;
};

/**
 * 创建用于上传视频帧的 2D texture。
 *
 * @param {WebGL2RenderingContext} gl - WebGL2 上下文
 * @returns {WebGLTexture} texture
 */
exports.createVideoTexture = function(gl)
{
  const texture = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
};
