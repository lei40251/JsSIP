const { createTimerWorker } = require('../VirtualBackground/helpers/timerHelper.js');
const { buildWebGL2Pipeline } = require('./pipelines/webgl2/webgl2Pipeline.js');
const Config = require('./AiVBEConfig');
const MediaPipeSegmenterRuntime = require('./MediaPipeSegmenterRuntime');
const Logger = require('../Logger');

const logger = new Logger('AiVBE');

class AiVBEEngine
{
  constructor(options = {})
  {
    this.config = Config.create(options);
    this.pipeline = null;
    this.timerWorker = createTimerWorker();
    this.segmenterRuntime = new MediaPipeSegmenterRuntime({
      assetConfig : this.config.assetConfig
    });
    this.inputStream = null;
    this.outputStream = null;
    this.canvas = null;
    this.videoEl = null;
    this.backgroundEl = null;
    this.isRunning = false;
    this.animationFrameId = null;
    this.renderTimeoutId = null;
    this.solidColorCanvas = null;
    this._cachedSolidColor = null;
    this._cachedSolidColorDataUrl = null;
    this.lastFrameTime = 0;
    this.isRendering = false;
  }

  _cleanUpPipeline()
  {
    if (this.pipeline && this.pipeline.cleanUp)
    {
      this.pipeline.cleanUp();
    }
    this.pipeline = null;

    if (this.backgroundEl)
    {
      this.backgroundEl.onload = null;
      this.backgroundEl.onerror = null;
      this.backgroundEl.src = '';
      this.backgroundEl = null;
    }
  }

  async init({ inputStream, modelPath, canvas } = {})
  {
    if (!inputStream)
    {
      throw new Error('inputStream required');
    }

    this.inputStream = inputStream;
    this.canvas = canvas || document.createElement('canvas');
    this.canvas.width = this.config.video.width;
    this.canvas.height = this.config.video.height;

    await this.segmenterRuntime.initialize({
      modelPath,
      modelSelection : this.config.segmentation.modelSelection
    });
    await this.createVideoElement();
    this.createOutputStream();
  }

  async createVideoElement()
  {
    this.videoEl = document.createElement('video');
    this.videoEl.muted = true;
    this.videoEl.autoplay = true;
    this.videoEl.playsInline = true;
    this.videoEl.srcObject = this.inputStream;

    await this.videoEl.play();
  }

  async setupPipeline(type, src)
  {
    this._cleanUpPipeline();

    return new Promise((resolve, reject) =>
    {
      const backgroundEl = document.createElement('img');

      backgroundEl.onerror = () => reject(new Error('Failed to load background image'));
      backgroundEl.onload = () =>
      {
        try
        {
          this.backgroundEl = backgroundEl;
          this.pipeline = buildWebGL2Pipeline(
            {
              width       : this.config.video.width,
              height      : this.config.video.height,
              htmlElement : this.videoEl
            },
            this.backgroundEl,
            { type, mirror: this.config.video.mirror },
            this.config.segmentation,
            this.canvas,
            this.segmenterRuntime
          );

          this.pipeline.updatePostProcessingConfig(this.config.postProcessing);
          resolve();
        }
        catch (error)
        {
          reject(error);
        }
      };

      backgroundEl.src = src || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    });
  }

  createOutputStream()
  {
    this.outputStream = this.canvas.captureStream(this.config.video.targetFps);
  }

  getOutputStream()
  {
    return this.outputStream;
  }

  setMirror(mirror)
  {
    this.config.video.mirror = Boolean(mirror);

    if (this.pipeline && this.pipeline.updateMirror)
    {
      this.pipeline.updateMirror(this.config.video.mirror);
    }
  }

  start()
  {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = 0;
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  stop()
  {
    this.isRunning = false;

    if (this.animationFrameId)
    {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.renderTimeoutId)
    {
      this.timerWorker.clearTimeout(this.renderTimeoutId);
      this.renderTimeoutId = null;
    }
  }

  async loop(now)
  {
    if (!this.isRunning) return;

    const interval = 1000 / this.config.video.targetFps;

    if (now - this.lastFrameTime >= interval)
    {
      this.lastFrameTime = now;
      if (this.isRendering)
      {
        this.animationFrameId = requestAnimationFrame(this.loop);

        return;
      }

      this.isRendering = true;

      try
      {
        if (this.pipeline)
        {
          await this.pipeline.render();
        }
      }
      catch (error)
      {
        logger.error(`Render error: ${error.message}`);
      }
      finally
      {
        this.isRendering = false;
      }
    }

    if (this.isRunning)
    {
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  }

  async setBackgroundImage(url)
  {
    if (typeof url !== 'string' || !url.trim())
    {
      throw new Error('Invalid background image URL');
    }

    if (url === 'none')
    {
      this.clearBackground();

      return;
    }

    return this.setupPipeline('image', url);
  }

  clearBackground()
  {
    this._cleanUpPipeline();

    const gl = this.canvas.getContext('webgl2');

    if (!gl)
    {
      throw new Error('WebGL2 not available');
    }

    const vsSrc = `#version 300 es
      in vec2 a_position;
      in vec2 a_texCoord;
      out vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;
    const fsSrc = `#version 300 es
      precision highp float;
      in vec2 v_texCoord;
      out vec4 outColor;
      uniform sampler2D u_inputFrame;
      void main() {
        outColor = texture(u_inputFrame, v_texCoord);
      }
    `;

    const vs = gl.createShader(gl.VERTEX_SHADER);

    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS))
    {
      throw new Error(`Passthrough VS compile failed: ${gl.getShaderInfoLog(vs)}`);
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
    {
      throw new Error(`Passthrough FS compile failed: ${gl.getShaderInfoLog(fs)}`);
    }

    const program = gl.createProgram();

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    {
      throw new Error(`Passthrough program link failed: ${gl.getProgramInfoLog(program)}`);
    }

    const vao = gl.createVertexArray();

    gl.bindVertexArray(vao);

    const posBuf = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ -1, -1, 1, -1, -1, 1, 1, 1 ]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'a_position');

    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texBuf = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ 0, 1, 1, 1, 0, 0, 1, 0 ]), gl.STATIC_DRAW);
    const texLoc = gl.getAttribLocation(program, 'a_texCoord');

    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'u_inputFrame'), 0);

    const { videoEl, canvas } = this;

    this.pipeline = {
      async render()
      {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
        gl.bindVertexArray(vao);
        gl.useProgram(program);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      updatePostProcessingConfig() {},
      updateMirror() {},
      cleanUp()
      {
        gl.deleteTexture(texture);
        gl.deleteBuffer(texBuf);
        gl.deleteBuffer(posBuf);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
      }
    };
  }

  async setBlurBackground(radius)
  {
    await this.setupPipeline('blur');
    radius = typeof radius === 'number' ? radius : 20;

    if (radius < 0 || radius > 100)
    {
      radius = 20;
    }

    this.pipeline.updatePostProcessingConfig(
      Object.assign({}, this.config.postProcessing, {
        blurRadius : radius
      })
    );
  }

  async setSolidColor(color = '#00ff00')
  {
    const isValidColor = /^#[0-9A-Fa-f]{6}$/.test(color) ||
      /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/.test(color);

    if (!isValidColor)
    {
      throw new Error('Invalid color format. Expected #RRGGBB or rgba(r,g,b,a)');
    }

    if (this._cachedSolidColor === color &&
        this._cachedSolidColorDataUrl &&
        this.pipeline &&
        this.backgroundEl)
    {
      this.backgroundEl.src = this._cachedSolidColorDataUrl;

      return;
    }

    if (!this.solidColorCanvas)
    {
      this.solidColorCanvas = document.createElement('canvas');
      this.solidColorCanvas.width = 16;
      this.solidColorCanvas.height = 16;
    }

    const ctx = this.solidColorCanvas.getContext('2d');

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 16, 16);
    this._cachedSolidColorDataUrl = this.solidColorCanvas.toDataURL();
    this._cachedSolidColor = color;

    return this.setupPipeline('image', this._cachedSolidColorDataUrl);
  }

  async destroy()
  {
    this.stop();
    this._cleanUpPipeline();

    if (this.solidColorCanvas)
    {
      this.solidColorCanvas = null;
    }

    this._cachedSolidColor = null;
    this._cachedSolidColorDataUrl = null;

    if (this.timerWorker)
    {
      this.timerWorker.terminate();
    }

    if (this.videoEl)
    {
      this.videoEl.srcObject = null;
      this.videoEl.load();
    }

    if (this.segmenterRuntime)
    {
      await this.segmenterRuntime.destroy();
    }

    this.pipeline = null;
    this.inputStream = null;
    this.outputStream = null;
    this.canvas = null;
    this.videoEl = null;
    this.timerWorker = null;
  }
}

module.exports = AiVBEEngine;
