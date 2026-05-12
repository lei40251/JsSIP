const BaseRenderer = require('./BaseRenderer');
const glHelpers = require('./helpers/gl');
const colorHelper = require('./helpers/color');

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main()
{
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_texture;
out vec4 outColor;
void main()
{
  outColor = texture(u_texture, v_texCoord);
}`;

/**
 * 主线程 WebGL2 渲染器。
 *
 * Safari / WKWebView 常见情况是 Worker + WebGL2 不稳定或不可用，但主线程 WebGL2 可用。
 * 这一路不能降低主线程调度压力，但可以把缩放和合成交给 GPU，通常比多路 Canvas2D 更稳。
 */
module.exports = class MainWebGL2Renderer extends BaseRenderer
{
  constructor(config, info)
  {
    super(config, Object.assign({
      actualMode : 'main-webgl2',
      isWorker   : false,
      isWebGL2   : true
    }, info || {}));

    this._canvas = null;
    this._gl = null;
    this._program = null;
    this._positionBuffer = null;
    this._texCoordBuffer = null;
    this._textures = {};
  }

  init(canvas)
  {
    this._canvas = canvas;
    this._gl = canvas.getContext('webgl2', {
      alpha                 : false,
      antialias             : false,
      preserveDrawingBuffer : Boolean(this._config.preserveDrawingBuffer),
      powerPreference       : 'high-performance'
    });

    if (!this._gl)
    {
      throw new Error('WebGL2 context is not available');
    }

    this._setupProgram();
    this.resize(canvas.width, canvas.height);

    return true;
  }

  _setupProgram()
  {
    const gl = this._gl;
    const vertexShader = glHelpers.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = glHelpers.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    this._program = glHelpers.createProgram(gl, vertexShader, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    this._positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1
    ]), gl.STATIC_DRAW);

    this._texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      1, 1
    ]), gl.STATIC_DRAW);

    gl.useProgram(this._program);
    this._enableAttribute('a_position', this._positionBuffer);
    this._enableAttribute('a_texCoord', this._texCoordBuffer);
    gl.uniform1i(gl.getUniformLocation(this._program, 'u_texture'), 0);
  }

  _enableAttribute(name, buffer)
  {
    const gl = this._gl;
    const location = gl.getAttribLocation(this._program, name);

    gl.enableVertexAttribArray(location);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  }

  resize(width, height)
  {
    super.resize(width, height);

    if (!this._canvas)
    {
      return;
    }

    if (this._canvas.width !== width)
    {
      this._canvas.width = width;
    }

    if (this._canvas.height !== height)
    {
      this._canvas.height = height;
    }
  }

  render(payload)
  {
    if (!this._gl || !payload)
    {
      return;
    }

    const gl = this._gl;
    const clearColor = colorHelper.parseColor(payload.backgroundColor);

    this.resize(payload.width, payload.height);

    gl.useProgram(this._program);
    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);

    payload.items.forEach((item) =>
    {
      if (!item.video || item.video.readyState < 2)
      {
        return;
      }

      const texture = this._getTexture(item.id);

      gl.bindTexture(gl.TEXTURE_2D, texture);
      // HTMLVideoElement / HTMLCanvasElement 的像素原点是左上角，而 WebGL 纹理坐标原点按左下角处理。
      // 在上传阶段翻转，比手动反转 shader texcoord 更稳定，也方便与 Worker WebGL2 路径保持一致。
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, item.video);
      this._drawItem(item, payload.height);
    });

    gl.flush();
    this._info.renderedFrames += 1;
  }

  _getTexture(id)
  {
    if (!this._textures[id])
    {
      this._textures[id] = glHelpers.createVideoTexture(this._gl);
    }

    return this._textures[id];
  }

  _drawItem(item, canvasHeight)
  {
    const gl = this._gl;
    const draw = item.draw;
    const viewportX = Math.round(draw.x);
    const viewportY = Math.round(canvasHeight - draw.y - draw.height);
    const viewportWidth = Math.round(draw.width);
    const viewportHeight = Math.round(draw.height);

    if (viewportWidth <= 0 || viewportHeight <= 0)
    {
      return;
    }

    gl.viewport(viewportX, viewportY, viewportWidth, viewportHeight);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  removeSource(id)
  {
    const texture = this._textures[id];

    if (texture && this._gl)
    {
      this._gl.deleteTexture(texture);
    }

    delete this._textures[id];
  }

  destroy()
  {
    const gl = this._gl;

    if (!gl)
    {
      return;
    }

    Object.keys(this._textures).forEach((id) =>
    {
      gl.deleteTexture(this._textures[id]);
    });
    this._textures = {};

    if (this._positionBuffer)
    {
      gl.deleteBuffer(this._positionBuffer);
    }

    if (this._texCoordBuffer)
    {
      gl.deleteBuffer(this._texCoordBuffer);
    }

    if (this._program)
    {
      gl.deleteProgram(this._program);
    }

    const loseContext = gl.getExtension('WEBGL_lose_context');

    if (loseContext)
    {
      loseContext.loseContext();
    }

    this._gl = null;
    this._program = null;
    this._canvas = null;
  }
};
