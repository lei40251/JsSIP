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
const createRendererBase = require('./RendererBase');

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
uniform float u_opacity;
out vec4 outColor;
void main()
{
  vec4 color = texture(u_texture, v_texCoord);
  outColor = vec4(color.rgb, color.a * u_opacity);
}`;

// === 内联自 gl.js ===
function compileShader(gl, shaderType, shaderSource)
{
  const shader = gl.createShader(shaderType);

  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
  {
    const message = gl.getShaderInfoLog(shader);

    gl.deleteShader(shader);
    throw new Error(`Could not compile shader: ${ message}`);
  }
  
  return shader;
}

function createProgram(gl, vertexShader, fragmentShader)
{
  const program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
  {
    const message = gl.getProgramInfoLog(program);

    gl.deleteProgram(program);
    throw new Error(`Could not link WebGL program: ${ message}`);
  }
  
  return program;
}

function createVideoTexture(gl)
{
  const texture = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.bindTexture(gl.TEXTURE_2D, null);
  
  return texture; 
}

// === 内联自 color.js ===
function parseColor(color)
{
  if (!color || typeof color !== 'string') return [ 0, 0, 0, 1 ];
  const value = color.trim();

  if (value[0] === '#') return parseHexColor(value);
  if (value.indexOf('rgb') === 0) return parseRgbColor(value);
  
  return [ 0, 0, 0, 1 ];
}

function parseHexColor(value)
{
  let hex = value.slice(1);

  if (hex.length === 3) hex = hex.split('').map(function(item) { return item + item; })
    .join('');
  if (hex.length !== 6) return [ 0, 0, 0, 1 ];
  const n = parseInt(hex, 16);

  if (!Number.isFinite(n)) return [ 0, 0, 0, 1 ];
  
  return [ ((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1 ];
}

function parseRgbColor(value)
{
  const m = value.match(/rgba?\(([^)]+)\)/i);

  if (!m) return [ 0, 0, 0, 1 ];
  const parts = m[1].split(',').map(function(x) { return Number(x.trim()); });

  if (parts.length < 3 || parts.some(function(x) { return !Number.isFinite(x); })) return [ 0, 0, 0, 1 ];
  
  return [
    clamp(parts[0] / 255, 0, 1), clamp(parts[1] / 255, 0, 1),
    clamp(parts[2] / 255, 0, 1), clamp(parts.length > 3 ? parts[3] : 1, 0, 1)
  ];
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function buildForegroundFilter(postProcessing)
{
  const config = postProcessing && typeof postProcessing === 'object' ? postProcessing : {};
  const brightness = Number(config.foregroundBrightness);
  const contrast = Number(config.foregroundContrast);
  const saturate = Number(config.foregroundSaturate);

  return `brightness(${Number.isFinite(brightness) ? brightness : 1}) contrast(${Number.isFinite(contrast) ? contrast : 1}) saturate(${Number.isFinite(saturate) ? saturate : 1})`;
}

module.exports = class MainWebGL2Renderer 
{
  /**
   * @param {Object} config - 混流配置
   * @param {Object} info - 渲染器元信息
   */
  constructor(config, info)
  {
    Object.assign(this, createRendererBase(config, Object.assign({
      actualMode : 'main-webgl2',
      isWorker   : false,
      isWebGL2   : true
    }, info || {})));

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

    /** @type {WebGLBuffer|null} 镜像纹理坐标 buffer */
    this._mirrorTexCoordBuffer = null;

    /** @type {boolean|null} 当前绑定的镜像状态，避免每个 item 重复切 buffer */
    this._activeMirrorX = null;

    /** @type {Object<string, WebGLTexture>} 每个源对应的纹理对象缓存 */
    this._textures = {};

    /** @type {Object<string, WebGLTexture>} 每个水印对应的纹理对象缓存 */
    this._watermarkTextures = {};

    /** @type {*} shader 中透明度 uniform 的 location */
    this._opacityLocation = null;
    this._aiVB = config && config.aiVBManager ? config.aiVBManager : null;
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
      preserveDrawingBuffer : Boolean(this._config.keepDrawingBuffer),
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
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    this._program = createProgram(gl, vertexShader, fragmentShader);
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

    this._mirrorTexCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._mirrorTexCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      1, 0,
      0, 0,
      1, 1,
      0, 1
    ]), gl.STATIC_DRAW);

    gl.useProgram(this._program);
    this._enableAttribute('a_position', this._positionBuffer);
    this._setMirrorTexCoord(false);
    gl.uniform1i(gl.getUniformLocation(this._program, 'u_texture'), 0);
    this._opacityLocation = gl.getUniformLocation(this._program, 'u_opacity');
    gl.uniform1f(this._opacityLocation, 1);
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
    this._info.width = width;
    this._info.height = height;

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
    const clearColor = parseColor(payload.backgroundColor);

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
      const surface = this._resolveItemSurface(item, payload.outputMirrorX, payload.width);
      const drawItem = surface && surface.item ? surface.item : item;
      const inputSurface = surface && surface.surface ? surface.surface : item.video;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, inputSurface);
      const drawOutputMirrorX = surface && surface.aiVBComposed ? false : payload.outputMirrorX;

      this._drawItem(drawItem, payload.height, drawOutputMirrorX, payload.width);
    });

    const sourceWatermarkMirrorX = payload.outputMirrorX;
    const outputWatermarkMirrorX = payload.mirrorWatermarks === false ? false : payload.outputMirrorX;
    const activeWatermarkKeys = {};

    this._drawWatermarks(payload.sourceWatermarks, payload.height, sourceWatermarkMirrorX, payload.width, activeWatermarkKeys);
    this._drawWatermarks(payload.outputWatermarks, payload.height, outputWatermarkMirrorX, payload.width, activeWatermarkKeys);
    this._cleanupWmTextures(activeWatermarkKeys);

    gl.flush();
    this._info.renderedFrames += 1;
    this._emitFramePresented({
      canvas    : this._canvas,
      timestamp : typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(),
      source    : 'main-webgl2'
    });
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
      this._textures[id] = createVideoTexture(this._gl);
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
  _drawItem(item, canvasHeight, outputMirrorX, outputWidth)
  {
    const gl = this._gl;
    const draw = this._resolveDrawRect(item.draw, outputMirrorX, outputWidth);
    const viewportX = Math.round(draw.x);
    const viewportY = Math.round(canvasHeight - draw.y - draw.height);
    const viewportWidth = Math.round(draw.width);
    const viewportHeight = Math.round(draw.height);

    if (viewportWidth <= 0 || viewportHeight <= 0)
    {
      return;
    }

    const effectiveMirrorX = Boolean(item.mirrorX) !== Boolean(outputMirrorX);
    const opacity = Number.isFinite(Number(item.opacity)) ? Math.min(1, Math.max(0, Number(item.opacity))) : 1;

    this._setMirrorTexCoord(effectiveMirrorX);
    gl.uniform1f(this._opacityLocation, opacity);
    gl.viewport(viewportX, viewportY, viewportWidth, viewportHeight);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  _resolveItemSurface(item, outputMirrorX, canvasWidth)
  {
    if (!item || !item.aiBackground || !item.source || !this._aiVB)
    {
      return {
        surface : item ? item.video : null,
        item    : item
      };
    }

    const effect = this._aiVB.getRenderableState(item.source, item.video);

    if (!effect || !effect.config || effect.config.mode === 'none')
    {
      return {
        surface : item.video,
        item    : item
      };
    }

    const draw = this._resolveDrawRect(item.draw, outputMirrorX, canvasWidth);
    const effectiveMirrorX = Boolean(item.mirrorX) !== Boolean(outputMirrorX);
    const composedSurface = this._composeAiVBSurface(item, effect, draw, effectiveMirrorX);

    if (!composedSurface)
    {
      return {
        surface : item.video,
        item    : item
      };
    }

    return {
      surface      : composedSurface,
      aiVBComposed : true,
      item         : Object.assign({}, item, {
        draw    : draw,
        mirrorX : false
      })
    };
  }

  _composeAiVBSurface(item, effect, draw, mirrorX)
  {
    if (!item || !item.video || !effect || !effect.config || !draw)
    {
      return null;
    }

    const mask = effect.latestMask;
    const foregroundSource = effect.latestFrame || item.video;

    if (!mask)
    {
      return null;
    }

    const foregroundSurface = this._ensureWorkSurface(effect.state, 'foreground', draw.width, draw.height);
    const outputSurface = this._ensureWorkSurface(effect.state, 'output', draw.width, draw.height);

    if (!foregroundSurface || !foregroundSurface.context || !outputSurface || !outputSurface.context)
    {
      return null;
    }

    foregroundSurface.context.clearRect(0, 0, foregroundSurface.canvas.width, foregroundSurface.canvas.height);
    foregroundSurface.context.filter = buildForegroundFilter(effect.config.postProcessing);
    this._drawSurfaceToContext(foregroundSurface.context, foregroundSource, {
      x      : 0,
      y      : 0,
      width  : foregroundSurface.canvas.width,
      height : foregroundSurface.canvas.height
    }, mirrorX);
    foregroundSurface.context.filter = 'none';
    foregroundSurface.context.globalCompositeOperation = 'destination-in';
    this._drawSurfaceToContext(foregroundSurface.context, mask, {
      x      : 0,
      y      : 0,
      width  : foregroundSurface.canvas.width,
      height : foregroundSurface.canvas.height
    }, mirrorX);
    foregroundSurface.context.globalCompositeOperation = 'source-over';

    outputSurface.context.clearRect(0, 0, outputSurface.canvas.width, outputSurface.canvas.height);

    if (effect.config.mode === 'blur')
    {
      outputSurface.context.save();
      outputSurface.context.filter = `blur(${effect.config.blurRadius}px)`;
      this._drawSurfaceToContext(outputSurface.context, foregroundSource, {
        x      : 0,
        y      : 0,
        width  : outputSurface.canvas.width,
        height : outputSurface.canvas.height
      }, mirrorX);
      outputSurface.context.restore();
    }
    else if (effect.config.mode === 'image')
    {
      // 背景图就绪时绘制 cover-fit 背景；未就绪时跳过背景层，
      // 前景（人物抠图）直接叠加在清空后的画布上，避免回退到原始视频画面导致闪烁
      if (effect.backgroundImage)
      {
        this._drawCoverSurface(outputSurface.context, effect.backgroundImage, {
          x      : 0,
          y      : 0,
          width  : outputSurface.canvas.width,
          height : outputSurface.canvas.height
        });
      }
    }
    else if (effect.config.mode === 'color')
    {
      outputSurface.context.fillStyle = effect.config.backgroundColor || '#00ff00';
      outputSurface.context.fillRect(0, 0, outputSurface.canvas.width, outputSurface.canvas.height);
    }
    else
    {
      return null;
    }

    outputSurface.context.drawImage(
      foregroundSurface.canvas,
      0,
      0,
      outputSurface.canvas.width,
      outputSurface.canvas.height
    );
    this._aiVB.noteFrameRendered(item.source, true);

    return outputSurface.canvas;
  }

  _ensureWorkSurface(state, key, width, height)
  {
    if (!state || typeof document === 'undefined')
    {
      return null;
    }

    const canvasKey = `${key}Canvas`;
    const contextKey = `${key}Context`;

    if (!state[canvasKey])
    {
      state[canvasKey] = document.createElement('canvas');
      state[contextKey] = state[canvasKey].getContext('2d');
    }

    if (!state[contextKey])
    {
      return null;
    }

    const targetWidth = Math.max(1, Math.round(width));
    const targetHeight = Math.max(1, Math.round(height));

    if (state[canvasKey].width !== targetWidth)
    {
      state[canvasKey].width = targetWidth;
    }

    if (state[canvasKey].height !== targetHeight)
    {
      state[canvasKey].height = targetHeight;
    }

    return {
      canvas  : state[canvasKey],
      context : state[contextKey]
    };
  }

  _drawSurfaceToContext(context, surface, draw, mirrorX)
  {
    if (!context || !surface || !draw)
    {
      return;
    }

    if (!mirrorX)
    {
      context.drawImage(surface, draw.x, draw.y, draw.width, draw.height);

      return;
    }

    context.save();
    context.translate(draw.x + draw.width, draw.y);
    context.scale(-1, 1);
    context.drawImage(surface, 0, 0, draw.width, draw.height);
    context.restore();
  }

  _drawCoverSurface(context, surface, draw)
  {
    if (!context || !surface || !draw)
    {
      return false;
    }

    const imageWidth = surface.naturalWidth || surface.videoWidth || surface.width;
    const imageHeight = surface.naturalHeight || surface.videoHeight || surface.height;

    if (!imageWidth || !imageHeight)
    {
      return false;
    }

    const imageAspect = imageWidth / imageHeight;
    const drawAspect = draw.width / draw.height;
    let sourceWidth = imageWidth;
    let sourceHeight = imageHeight;
    let sourceX = 0;
    let sourceY = 0;

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

    context.drawImage(
      surface,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      draw.x,
      draw.y,
      draw.width,
      draw.height
    );

    return true;
  }

  _resolveDrawRect(draw, outputMirrorX, outputWidth)
  {
    if (!outputMirrorX)
    {
      return draw;
    }

    return {
      x      : outputWidth - draw.x - draw.width,
      y      : draw.y,
      width  : draw.width,
      height : draw.height
    };
  }

  _setMirrorTexCoord(mirrorX)
  {
    const desired = Boolean(mirrorX);

    if (this._activeMirrorX === desired)
    {
      return;
    }

    this._activeMirrorX = desired;
    this._enableAttribute('a_texCoord', desired ? this._mirrorTexCoordBuffer : this._texCoordBuffer);
  }

  /**
   * 绘制水印列表。
   *
   * @param {Array<Object>} watermarks - 水印绘制项
   * @param {number} canvasHeight - 画布总高度
   */
  _drawWatermarks(watermarks, canvasHeight, outputMirrorX, outputWidth, activeKeys)
  {
    if (!this._gl || !(watermarks || []).length)
    {
      return;
    }

    const gl = this._gl;

    activeKeys = activeKeys || {};

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
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, watermark.image);
      this._drawItem(watermark, canvasHeight, outputMirrorX, outputWidth);
    });

    gl.disable(gl.BLEND);
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
      this._watermarkTextures[key] = createVideoTexture(this._gl);
    }

    return this._watermarkTextures[key];
  }

  /**
   * 清理不再出现的水印纹理。
   *
   * @param {Object} activeKeys - 当前帧出现的水印 key
   */
  _cleanupWmTextures(activeKeys)
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

    if (this._mirrorTexCoordBuffer)
    {
      gl.deleteBuffer(this._mirrorTexCoordBuffer);
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
    this._activeMirrorX = null;
    this._aiVB = null;
  }
};
