/**
 * MainWebGL2Renderer — 主线程 WebGL2 渲染器
 *
 * 使用 WebGL2 将各路视频帧上传为纹理，通过 GPU shader 合成输出。
 * 相比 Canvas2D 路径，缩放和合成由 GPU 处理，通常在高分辨率或多路源时更稳定。
 *
 * 适用场景：
 *   - Safari / WKWebView：Worker + WebGL2 不稳定时，主线程 WebGL2 作为中间方案
 *   - 需要 GPU 加速但又无法使用 Worker 的环境
 *
 * @module MainWebGL2Renderer
 */
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

module.exports = class MainWebGL2Renderer extends BaseRenderer
{
  /**
   * @param {Object} config - 混流配置
   * @param {Object} info - 渲染器元信息
   */
  constructor(config, info)
  {
    super(config, Object.assign({
      actualMode : 'main-webgl2',
      isWorker   : false,
      isWebGL2   : true
    }, info || {}));

    /** @type {HTMLCanvasElement|null} 输出 canvas */
    this._canvas = null;

    /** @type {WebGL2RenderingContext|null} WebGL2 上下文 */
    this._gl = null;

    /** @type {WebGLProgram|null} 合成用的 WebGL program */
    this._program = null;

    /** @type {WebGLBuffer|null} 全屏四边形顶点 buffer */
    this._positionBuffer = null;

    /** @type {WebGLBuffer|null} 纹理坐标 buffer */
    this._texCoordBuffer = null;

    /** @type {Object<string, WebGLTexture>} 每个源对应的纹理对象缓存 */
    this._textures = {};

    /** @type {Object<string, WebGLTexture>} 每个水印对应的纹理对象缓存 */
    this._watermarkTextures = {};
  }

  /**
   * 初始化 WebGL2 上下文并编译 shader program。
   *
   * @param {HTMLCanvasElement} canvas - 输出 canvas
   * @returns {boolean} true=初始化成功
   * @throws {Error} WebGL2 context 不可用时抛出
   */
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

  /**
   * 编译 shader、链接 program、创建全屏四边形顶点数据。
   * 顶点覆盖 [-1, 1] 范围，纹理坐标对应 [0, 1]。
   */
  _setupProgram()
  {
    const gl = this._gl;
    const vertexShader = glHelpers.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = glHelpers.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    this._program = glHelpers.createProgram(gl, vertexShader, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    // 全屏四边形：两个三角形组成一个矩形，覆盖整个裁剪空间
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

  /**
   * 启用顶点 attribute 并绑定 buffer。
   *
   * @param {string} name - shader 中 attribute 变量名
   * @param {WebGLBuffer} buffer - 已填充数据的 buffer
   */
  _enableAttribute(name, buffer)
  {
    const gl = this._gl;
    const location = gl.getAttribLocation(this._program, name);

    gl.enableVertexAttribArray(location);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  }

  /**
   * 调整输出尺寸，同步更新 canvas 元素尺寸。
   *
   * @param {number} width - 新宽度
   * @param {number} height - 新高度
   */
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

  /**
   * 绘制一帧到 canvas。
   *
   * 流程：
   *   1. 调整尺寸，清空背景色
   *   2. 遍历 items，将每路视频帧上传到对应的纹理
   *   3. 通过 gl.viewport 裁剪到每个 item 的绘制区域后提交绘制
   *
   * 纹理坐标说明：HTMLVideoElement 像素原点在左上角，WebGL 纹理坐标原点在左下角，
   * 上传时通过 UNPACK_FLIP_Y_WEBGL 翻转，与 Worker WebGL2 路径保持一致。
   *
   * @param {Object} payload - 布局数据
   */
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
    gl.disable(gl.BLEND);

    payload.items.forEach((item) =>
    {
      if (!item.video || item.video.readyState < 2)
      {
        return;
      }

      const texture = this._getTexture(item.id);

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, item.video);
      this._drawItem(item, payload.height);
    });

    this._drawWatermarks(payload.sourceWatermarks, payload.height);
    this._drawWatermarks(payload.outputWatermarks, payload.height);

    gl.flush();
    this._info.renderedFrames += 1;
  }

  /**
   * 获取或创建指定源的 WebGL 纹理。
   * 纹理使用 CLAMP_TO_EDGE + LINEAR 滤波参数。
   *
   * @param {string} id - 源 ID
   * @returns {WebGLTexture} 纹理对象
   */
  _getTexture(id)
  {
    if (!this._textures[id])
    {
      this._textures[id] = glHelpers.createVideoTexture(this._gl);
    }

    return this._textures[id];
  }

  /**
   * 通过 gl.viewport 将全屏四边形裁剪到指定区域后绘制。
   *
   * viewport Y 坐标转换：WebGL 原点在左下角，canvas 原点在左上角，
   * 因此 y = canvasHeight - draw.y - draw.height。
   *
   * @param {Object} item - 绘制项
   * @param {number} item.draw.x - 绘制区域左上角 X
   * @param {number} item.draw.y - 绘制区域左上角 Y
   * @param {number} item.draw.width - 绘制区域宽度
   * @param {number} item.draw.height - 绘制区域高度
   * @param {number} canvasHeight - 画布总高度
   */
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

  /**
   * 绘制水印列表。
   *
   * @param {Array<Object>} watermarks - 水印绘制项
   * @param {number} canvasHeight - 画布总高度
   */
  _drawWatermarks(watermarks, canvasHeight)
  {
    if (!this._gl || !(watermarks || []).length)
    {
      return;
    }

    const gl = this._gl;
    const activeKeys = {};

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    (watermarks || []).forEach((watermark) =>
    {
      if (!watermark.image || !watermark.draw)
      {
        return;
      }

      const key = `${watermark.id}:${watermark.sourceId || (typeof watermark.slot === 'number' ? watermark.slot : 'output')}`;
      const texture = this._getWatermarkTexture(key);

      activeKeys[key] = true;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, watermark.image);
      this._drawItem(watermark, canvasHeight);
    });

    gl.disable(gl.BLEND);
    this._cleanupUnusedWatermarkTextures(activeKeys);
  }

  /**
   * 获取或创建指定水印的 WebGL 纹理。
   *
   * @param {string} key - 水印纹理 key
   * @returns {WebGLTexture} 纹理对象
   */
  _getWatermarkTexture(key)
  {
    if (!this._watermarkTextures[key])
    {
      this._watermarkTextures[key] = glHelpers.createVideoTexture(this._gl);
    }

    return this._watermarkTextures[key];
  }

  /**
   * 清理不再出现的水印纹理。
   *
   * @param {Object} activeKeys - 当前帧出现的水印 key
   */
  _cleanupUnusedWatermarkTextures(activeKeys)
  {
    Object.keys(this._watermarkTextures).forEach((key) =>
    {
      if (activeKeys[key])
      {
        return;
      }

      this._gl.deleteTexture(this._watermarkTextures[key]);
      delete this._watermarkTextures[key];
    });
  }

  /**
   * 移除一路源的纹理缓存并释放 GPU 资源。
   *
   * @param {string} id - 源 ID
   */
  removeSource(id)
  {
    const texture = this._textures[id];

    if (texture && this._gl)
    {
      this._gl.deleteTexture(texture);
    }

    delete this._textures[id];
  }

  /**
   * 销毁渲染器，释放所有 WebGL 资源。
   *
   * 清理步骤：
   *   1. 删除所有纹理
   *   2. 删除顶点和纹理坐标 buffer
   *   3. 删除 shader program
   *   4. 通过 WEBGL_lose_context 扩展强制释放 GPU 上下文
   */
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

    Object.keys(this._watermarkTextures).forEach((id) =>
    {
      gl.deleteTexture(this._watermarkTextures[id]);
    });
    this._watermarkTextures = {};

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
