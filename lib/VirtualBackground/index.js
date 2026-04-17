const { buildWebGL2Pipeline } = require('./pipelines/webgl2/webgl2Pipeline.js');
const { createTimerWorker } = require('./helpers/timerHelper.js');
const Logger = require('../Logger');

const logger = new Logger('VirtualBackground');
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
    lightWrapping          : 0.2,
    blendMode              : 'screen',
    jointBilateralFilter   : {
      sigmaSpace : 3,
      sigmaColor : 0.2
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
    logger.debug('new VirtualBackgroundEngine');

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
    this._cachedSolidColor = null;
    this._cachedSolidColorDataUrl = null;

    this.lastFrameTime = 0; // 上一帧的时间戳，用于帧率控制
    this.isRendering = false; // 渲染锁，防止并发渲染
  }

  /**
   * 清理当前 pipeline 资源
   */
  _cleanUpPipeline()
  {
    if (this.pipeline && this.pipeline.cleanUp)
    {
      this.pipeline.cleanUp(); // 释放所有 WebGL 资源
    }
    this.pipeline = null;

    // 清理背景图片元素，避免内存泄漏
    if (this.backgroundEl)
    {
      this.backgroundEl.onload = null;
      this.backgroundEl.onerror = null;
      this.backgroundEl.src = '';
      this.backgroundEl = null;
    }
  }

  /**
   * 合并用户配置与默认配置
   * @param {Object} options - 用户提供的配置选项
   * @returns {Object} 合并后的配置对象
   */
  mergeConfig(options)
  {
    options = options || {};

    logger.debug(`mergeConfig() ${ JSON.stringify(options)}`);

    // 深拷贝默认配置，避免污染原始配置
    const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // 递归合并用户配置
    if (options.video)
    {
      Object.assign(config.video, options.video);
    }
    if (options.segmentation)
    {
      Object.assign(config.segmentation, options.segmentation);
    }
    if (options.postProcessing)
    {
      Object.assign(config.postProcessing, options.postProcessing);
      // 处理嵌套对象
      if (options.postProcessing.jointBilateralFilter)
      {
        Object.assign(
          config.postProcessing.jointBilateralFilter,
          options.postProcessing.jointBilateralFilter
        );
      }
    }

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
    logger.debug('init()');

    if (!inputStream)
    {
      logger.error('inputStream required');
      throw new Error('inputStream required');
    }

    if (!modelPath)
    {
      logger.error('modelPath required');
      throw new Error('modelPath required');
    }

    this.inputStream = inputStream;
    this.canvas = canvas || document.createElement('canvas');
    this.canvas.width = this.config.video.width;
    this.canvas.height = this.config.video.height;

    try
    {
      await this.loadModel(modelPath);
      await this.createVideoElement();
      this.createOutputStream();
    }
    catch (err)
    {
      this.destroy();
      logger.error('init error: ', err.message);

      throw err;
    }
  }

  /**
   * 加载 TFLite SIMD 分割模型
   * @param {string} modelPath - 模型文件路径
   * @returns {Promise<void>}
   */
  async loadModel(modelPath)
  {
    logger.debug(`loadModel() ${ modelPath}`);

    if (typeof createTFLiteSIMDModule === 'undefined')
    {
      logger.error('TFLite SIMD not loaded');
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
        logger.error(`HTTP ${modelResponse.status}: ${modelResponse.statusText}`);
        throw new Error(`HTTP ${modelResponse.status}: ${modelResponse.statusText}`);
      }
    }
    catch (err)
    {
      logger.error(`Failed to fetch model: ${err.message}`);
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
    logger.debug('createVideoElement()');

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
      logger.error(`Video play failed: ${err.message}`);
      throw new Error(`Video play failed: ${err.message}`);
    }
  }

  /**
   * 设置 WebGL2 处理管道
   * @param {string} type - 背景类型 ('image' | 'blur')
   * @param {string} src - 背景图片地址（可选）
   * @returns {Promise<void>}
   */
  async setupPipeline(type, src)
  {
    logger.debug(`setupPipeline() ${type}`);

    this._cleanUpPipeline();

    return new Promise((resolve, reject) =>
    {
      const backgroundEl = document.createElement('img');

      backgroundEl.onerror = () =>
      {
        logger.warn('load image error.');
        reject(new Error('Failed to load background image'));
      };

      backgroundEl.onload = () =>
      {
        try
        {
          const sourcePlayback = {
            width       : this.config.video.width,
            height      : this.config.video.height,
            htmlElement : this.videoEl
          };

          this.backgroundEl = backgroundEl;
          this.pipeline = buildWebGL2Pipeline(
            sourcePlayback,
            this.backgroundEl,
            { type: type },
            this.config.segmentation,
            this.canvas,
            this.tfs,
            () => { }
          );

          this.pipeline.updatePostProcessingConfig(this.config.postProcessing);
          resolve();
        }
        catch (err)
        {
          logger.error(`setupPipeline error: ${err.message}`);
          reject(err);
        }
      };

      backgroundEl.src = src || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    });
  }

  /**
   * 创建输出媒体流
   * 使用画布捕获视频帧生成输出流
   */
  createOutputStream()
  {
    logger.debug('createOutputStream()');

    const stream = this.canvas.captureStream(this.config.video.targetFps);

    this.outputStream = stream;
  }

  /**
   * 获取输出媒体流
   * @returns {MediaStream} 处理后的输出媒体流
   */
  getOutputStream()
  {
    logger.debug('getOutputStream()');

    return this.outputStream;
  }

  /**
   * 启动虚拟背景渲染循环
   * 开始处理视频帧并应用虚拟背景效果
   */
  start()
  {
    logger.debug(`start() ${this.isRunning}`);
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
    logger.debug('stop()');

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

      try
      {
        this.pipeline && await this.pipeline.render();
      }
      catch (err)
      {
        logger.error(`Render error: ${ err.message}`);
      }
      finally
      {
        this.isRendering = false;
      }
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
    logger.debug(`setBackgroundImage() ${url}`);

    // 参数验证
    if (typeof url !== 'string' || !url.trim())
    {
      throw new Error('Invalid background image URL');
    }

    return this.setupPipeline('image', url);
  }

  /**
   * 设置模糊背景效果
   * 使用高斯模糊对原始视频背景进行模糊处理
   * @param {number} [radius=20] - 模糊半径，值越大模糊程度越高
   * @returns {Promise<void>}
   */
  async setBlurBackground(radius)
  {
    logger.debug('setBlurBackground() ', radius);

    await this.setupPipeline('blur');
    radius = (typeof radius === 'number') ? radius : 20;

    // 添加范围验证
    if (radius < 0 || radius > 100)
    {
      logger.warn('blur radius out of range, using default value 20');
      radius = 20;
    }

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
   * @returns {Promise<void>}
   */
  async setSolidColor(color = '#00ff00')
  {
    logger.debug(`setSolidColor() ${color}`);

    // 参数验证：支持 #RRGGBB 或 rgba(r,g,b,a) 格式
    const isValidColor = /^#[0-9A-Fa-f]{6}$/.test(color) ||
      /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/.test(color);

    if (!isValidColor)
    {
      throw new Error('Invalid color format. Expected #RRGGBB or rgba(r,g,b,a)');
    }

    // 检查缓存，如果颜色相同且 pipeline 已初始化，直接更新背景
    if (this._cachedSolidColor === color && this._cachedSolidColorDataUrl && this.pipeline)
    {
      this.backgroundEl.src = this._cachedSolidColorDataUrl;

      return;
    }

    // 创建或复用纯色画布
    if (!this.solidColorCanvas)
    {
      this.solidColorCanvas = document.createElement('canvas');
      this.solidColorCanvas.width = 16;
      this.solidColorCanvas.height = 16;
    }

    const ctx = this.solidColorCanvas.getContext('2d');

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 16, 16);

    // 更新缓存
    this._cachedSolidColorDataUrl = this.solidColorCanvas.toDataURL();
    this._cachedSolidColor = color;

    return this.setupPipeline('image', this._cachedSolidColorDataUrl);
  }

  /**
   * 销毁虚拟背景引擎实例
   * 释放所有资源，包括 Web Worker、模型内存、媒体流等
   */
  destroy()
  {
    logger.debug('destroy()');

    this.stop();

    // 清理 pipeline 和背景元素
    this._cleanUpPipeline();

    // 清理纯色背景画布
    if (this.solidColorCanvas)
    {
      this.solidColorCanvas = null;
    }

    // 清理缓存属性
    this._cachedSolidColor = null;
    this._cachedSolidColorDataUrl = null;

    // 释放模型内存
    if (this.tfs && this.tfs._freeModelBuffer)
    {
      this.tfs._freeModelBuffer();
    }

    // 终止定时器 Worker
    if (this.timerWorker)
    {
      this.timerWorker.terminate();
    }

    // 停止输入流的所有轨道
    if (this.inputStream)
    {
      this.inputStream.getTracks().forEach((t) => t.stop());
    }

    // 清理视频元素
    if (this.videoEl)
    {
      this.videoEl.srcObject = null;
      this.videoEl.load();
    }

    // 重置所有引用
    this.pipeline = null;
    this.tfs = null;
    this.inputStream = null;
    this.outputStream = null;
    this.canvas = null;
    this.videoEl = null;
    this.timerWorker = null;
  }
};
