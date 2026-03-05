const { buildWebGL2Pipeline } = require('./pipelines/webgl2/webgl2Pipeline.js');
const { createTimerWorker } = require('./helpers/timerHelper.js');

const DEFAULT_CONFIG = {
  video        : { width: 1280, height: 720, targetFps: 15 },
  segmentation : {
    backend         : 'wasmSimd',
    inputResolution : '160x96',
    model           : 'meet',
    pipeline        : 'webgl2',
    targetFps       : 15
  },
  postProcessing : {
    smoothSegmentationMask : true,
    coverage               : [ 0.5, 0.75 ],
    lightWrapping          : 0.3,
    blendMode              : 'screen',
    jointBilateralFilter   : {
      sigmaSpace : 1,
      sigmaColor : 0.1
    }
  }
};

module.exports = class VirtualBackgroundEngine 
{
  /**
   * 创建虚拟背景引擎实例
   * @param {Object} options - 可选的配置选项
   */
  constructor(options = {}) 
  {
    this.config = this.mergeConfig(options);
    this.pipeline = null;
    this.tfs = null;
    this.timerWorker = createTimerWorker();

    this.inputStream = null;
    this.outputStream = null;

    this.canvas = null;
    this.videoEl = null;
    this.backgroundEl = null;

    this.isRunning = false;
    this.renderTimeoutId = null;
    this.animationFrameId = null;
    this.solidColorCanvas = null;
  }

  /**
   * 合并用户配置与默认配置
   * @param {Object} options - 用户提供的配置选项
   * @returns {Object} 合并后的配置对象
   */
  mergeConfig(options) 
  {
    options = options || {};

    const config = Object.assign({}, DEFAULT_CONFIG, options);

    config.video = Object.assign({}, DEFAULT_CONFIG.video, options.video);
    config.segmentation = Object.assign({}, DEFAULT_CONFIG.segmentation, options.segmentation);
    config.postProcessing = Object.assign({}, DEFAULT_CONFIG.postProcessing, options.postProcessing);

    return config;
  }

  /**
   * 初始化虚拟背景引擎
   * @param {Object} params - 初始化参数
   * @param {MediaStream} params.inputStream - 输入的媒体流（必需）
   * @param {string} params.modelPath - 模型文件路径（必需）
   * @param {HTMLCanvasElement} [params.canvas] - 可选的画布元素
   */
  async init({ inputStream, modelPath, canvas }) 
  {
    if (!inputStream) throw new Error('inputStream required');
    if (!modelPath) throw new Error('modelPath required');

    this.inputStream = inputStream;
    this.canvas = canvas || document.createElement('canvas');
    this.canvas.width = this.config.video.width;
    this.canvas.height = this.config.video.height;

    await this.loadModel(modelPath);
    await this.createVideoElement();
    this.setupPipeline();
    this.createOutputStream();
  }

  /**
   * 加载 TFLite SIMD 分割模型
   * @param {string} modelPath - 模型文件路径
   * @returns {Promise<void>}
   */
  async loadModel(modelPath) 
  {
    if (typeof createTFLiteSIMDModule === 'undefined') 
    {
      throw new Error('TFLite SIMD not loaded');
    }

    // eslint-disable-next-line no-undef
    this.tfs = await createTFLiteSIMDModule();

    let modelResponse;

    try 
    {
      modelResponse = await fetch(modelPath);
      if (!modelResponse.ok) 
      {
        throw new Error(`HTTP ${modelResponse.status}: ${modelResponse.statusText}`);
      }
    }
    catch (err) 
    {
      throw new Error(`Failed to fetch model: ${err.message}`);
    }

    const model = await modelResponse.arrayBuffer();

    const bufferOffset = await this.tfs._getModelBufferMemoryOffset();

    this.tfs.HEAPU8.set(new Uint8Array(model), bufferOffset);
    this.tfs._loadModel(model.byteLength);
  }

  /**
   * 创建视频元素并播放输入流
   * @returns {Promise<void>}
   */
  async createVideoElement() 
  {
    this.videoEl = document.createElement('video');
    this.videoEl.autoplay = true;
    this.videoEl.playsInline = true;
    this.videoEl.srcObject = this.inputStream;

    try 
    {
      await this.videoEl.play();
    }
    catch (err) 
    {
      throw new Error(`Video play failed: ${err.message}`);
    }
  }

  /**
   * 设置 WebGL2 处理管道
   */
  setupPipeline() 
  {
    this.backgroundEl = document.createElement('img');
    this.backgroundEl.src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

    const sourcePlayback = {
      width       : this.config.video.width,
      height      : this.config.video.height,
      htmlElement : this.videoEl
    };

    this.pipeline = buildWebGL2Pipeline(
      sourcePlayback,
      this.backgroundEl,
      { type: 'image' },
      this.config.segmentation,
      this.canvas,
      this.tfs,
      () => { }
    );

    this.pipeline.updatePostProcessingConfig(this.config.postProcessing);
  }

  /**
   * 创建输出媒体流
   * 使用画布捕获视频帧生成输出流
   */
  createOutputStream() 
  {
    const stream = this.canvas.captureStream(this.config.video.targetFps);

    this.outputStream = stream;
  }

  /**
   * 获取输出媒体流
   * @returns {MediaStream} 处理后的输出媒体流
   */
  getOutputStream() 
  {
    return this.outputStream;
  }

  /**
   * 启动虚拟背景渲染循环
   * 开始处理视频帧并应用虚拟背景效果
   */
  start() 
  {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = 0;
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  /**
   * 停止虚拟背景渲染循环
   * 释放动画帧和定时器资源
   */
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

  /**
   * 渲染循环 - 递归调用以持续处理视频帧
   * @param {number} now - 当前时间戳（毫秒）
   */
  async loop(now) 
  {
    if (!this.isRunning) return;

    const interval = 1000 / this.config.video.targetFps;

    if (now - this.lastFrameTime >= interval) 
    {
      this.lastFrameTime = now;
      if (this.isRendering) return;

      this.isRendering = true;
      await this.pipeline.render();
      this.isRendering = false;
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  /**
   * 设置背景图片
   * 异步加载图片并更新背景元素
   * @param {string} url - 背景图片的 URL 地址
   * @returns {Promise<void>} 图片加载完成后 resolve，加载失败则 reject
   */
  async setBackgroundImage(url) 
  {
    return new Promise((resolve, reject) => 
    {
      const img = new Image();

      img.crossOrigin = 'anonymous';

      img.onload = () => 
      {
        this.backgroundEl.src = img.src;
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * 设置模糊背景效果
   * 使用高斯模糊对原始视频背景进行模糊处理
   * @param {number} [radius=20] - 模糊半径，值越大模糊程度越高
   */
  setBlurBackground(radius) 
  {
    radius = radius || 20;

    this.pipeline.updatePostProcessingConfig(
      Object.assign({}, this.config.postProcessing, {
        blurRadius : radius
      })
    );
  }

  /**
   * 设置纯色背景
   * 创建一个纯色画布作为虚拟背景
   * @param {string} [color='#00ff00'] - 背景颜色，默认为绿色
   */
  setSolidColor(color = '#00ff00') 
  {
    if (!this.solidColorCanvas) 
    {
      this.solidColorCanvas = document.createElement('canvas');
      this.solidColorCanvas.width = 16;
      this.solidColorCanvas.height = 16;
    }
    const ctx = this.solidColorCanvas.getContext('2d');

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 16, 16);
    this.backgroundEl.src = this.solidColorCanvas.toDataURL();
  }

  /**
   * 销毁虚拟背景引擎实例
   * 释放所有资源，包括 Web Worker、模型内存、媒体流等
   */
  destroy() 
  {
    this.stop();

    if (this.pipeline.cleanUp) 
    {
      this.pipeline.cleanUp();
    }

    if (this.tfs._freeModelBuffer) 
    {
      this.tfs._freeModelBuffer();
    }

    this.timerWorker.terminate();

    this.inputStream.getTracks().forEach((t) => t.stop());

    this.pipeline = null;
    this.tfs = null;
    this.inputStream = null;
    this.outputStream = null;
  }
};
