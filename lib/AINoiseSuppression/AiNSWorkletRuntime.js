const Logger = require('../Logger');
const AiNSConfig = require('./AiNSConfig');
const createWorkletCode = require('./AiNSWorkletSource');

const logger = new Logger('AiNSWorkletRuntime');
const DEFAULT_CDN_URL = AiNSConfig.DEFAULT_CDN_URL;
const WORKLET_MESSAGE_TYPES = {
  SET_SUPPRESSION_LEVEL : 'SET_SUPPRESSION_LEVEL',
  SET_BYPASS            : 'SET_BYPASS'
};

class AiNSAssetLoader
{
  constructor(config = {})
  {
    this.cdnUrl = config.cdnUrl || DEFAULT_CDN_URL;
  }

  getAssetUrls()
  {
    return {
      wasm  : this.getAssetUrl('ans.wasm'),
      model : this.getAssetUrl('ans_onnx.tar.gz')
    };
  }

  getAssetUrl(relativePath)
  {
    return `${this.cdnUrl}/${relativePath}`;
  }

  async fetchAsset(url)
  {
    const response = await fetch(url);

    if (!response.ok)
    {
      throw new Error(`Failed to fetch asset: ${response.status} ${response.statusText}`);
    }

    return response.arrayBuffer();
  }
}

async function registerInlineWorkletModule(audioContext, inlineCode)
{
  const blob = new Blob([ inlineCode ], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  try
  {
    await audioContext.audioWorklet.addModule(blobUrl);
  }
  finally
  {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * AiNSWorkletRuntime 运行时。
 *
 * 它只负责：
 * - 拉取 WASM / 模型资源
 * - 注册 AudioWorklet 模块
 * - 创建 AudioWorkletNode
 * - 向 Worklet 发送运行时控制消息
 *
 * 它不直接处理 MediaStream，也不管理 AudioContext 生命周期。
 * MediaStream 图的搭建由 `AiNSMediaStreamProcessor` 负责。
 */
module.exports = class AiNSWorkletRuntime
{
  /**
   * @param {Object} [config]
   * @param {number} [config.sampleRate=48000]
   * @param {number} [config.noiseReductionLevel=80]
   * @param {Object} [config.assetConfig]
   */
  constructor(config = {})
  {
    const normalizedConfig = AiNSConfig.create(config);

    this.assetLoader = new AiNSAssetLoader(normalizedConfig.assetConfig || {});
    this.assets = null;
    this.workletNode = null;
    this.isInitialized = false;
    this.bypassEnabled = false;
    this.config = {
      sampleRate          : normalizedConfig.sampleRate,
      noiseReductionLevel : normalizedConfig.noiseReductionLevel,
      assetConfig         : normalizedConfig.assetConfig
    };

    logger.debug(`AiNSWorkletRuntime constructed: ${JSON.stringify(this.config)}`);
  }

  /**
   * 预加载 AINoiseSuppression 运行时资源。
   *
   * 设计成显式初始化有两个好处：
     * - 可以把网络开销前移到真正建图之前；
   * - 发生失败时更容易在业务侧做降级和提示。
   *
   * @returns {Promise<void>}
   */
  async initialize()
  {
    if (this.isInitialized)
    {
      logger.debug('initialize() skipped: already initialized');

      return;
    }

    logger.debug('initialize() start');

    const assetUrls = this.assetLoader.getAssetUrls();

    logger.debug(`initialize() asset urls: ${JSON.stringify(assetUrls)}`);
    const assets = await Promise.all([
      this.assetLoader.fetchAsset(assetUrls.wasm),
      this.assetLoader.fetchAsset(assetUrls.model)
    ]);

    this.assets = {
      wasmBytes  : assets[0],
      modelBytes : assets[1]
    };

    this.isInitialized = true;

    logger.debug(`initialize() complete: wasmBytes=${this.assets.wasmBytes.byteLength} modelBytes=${this.assets.modelBytes.byteLength}`);
  }

  /**
   * 在给定 AudioContext 上创建降噪 WorkletNode。
   *
   * 注意：
   * - 这里假设 initialize() 已经完成；
   * - Worklet 只关心处理逻辑，不直接连接 source/destination；
   * - Audio graph 的连线留给上层 MediaStreamProcessor 负责。
   *
   * @param {AudioContext} audioContext
   * @returns {Promise<AudioWorkletNode>}
   */
  async createAudioWorkletNode(audioContext)
  {
    this.ensureInitialized();

    if (!this.assets)
    {
      throw new Error('Assets not loaded');
    }

    logger.debug(`createAudioWorkletNode() start: sampleRate=${audioContext && audioContext.sampleRate}`);
    await registerInlineWorkletModule(audioContext, createWorkletCode());

    this.workletNode = new AudioWorkletNode(audioContext, 'ai-noise-suppression-audio-processor', {
      processorOptions : {
        wasmBytes        : this.assets.wasmBytes,
        modelBytes       : this.assets.modelBytes,
        suppressionLevel : this.config.noiseReductionLevel
      }
    });

    logger.debug('createAudioWorkletNode() complete');

    return this.workletNode;
  }

  /**
   * 动态调整降噪强度，范围会被夹到 0~100。
   *
   * @param {number} level
   */
  setSuppressionLevel(level)
  {
    const clampedLevel = AiNSConfig.normalizeSuppressionLevel(level, this.config.noiseReductionLevel);

    this.config.noiseReductionLevel = clampedLevel;

    logger.debug(`setSuppressionLevel(): ${clampedLevel}`);

    if (!this.workletNode)
    {
      logger.debug('setSuppressionLevel() deferred: worklet node not ready');

      return;
    }

    this.workletNode.port.postMessage({
      type  : WORKLET_MESSAGE_TYPES.SET_SUPPRESSION_LEVEL,
      value : clampedLevel
    });
  }

  /**
   * 启用或禁用 AI 降噪。
   *
   * 实现方式不是销毁 Worklet，而是切换为 bypass，
   * 这样开关更快，也不会频繁重建 AudioWorkletNode。
   *
   * @param {boolean} enabled
   */
  setNoiseSuppressionEnabled(enabled)
  {
    const normalizedEnabled = AiNSConfig.normalizeBoolean(enabled, true);

    this.bypassEnabled = !normalizedEnabled;
    logger.debug(`setNoiseSuppressionEnabled(): enabled=${normalizedEnabled}`);

    if (!this.workletNode)
    {
      logger.debug('setNoiseSuppressionEnabled() deferred: worklet node not ready');

      return;
    }

    this.workletNode.port.postMessage({
      type  : WORKLET_MESSAGE_TYPES.SET_BYPASS,
      value : !normalizedEnabled
    });
  }

  isNoiseSuppressionEnabled()
  {
    return !this.bypassEnabled;
  }

  /**
   * 销毁 Core 级资源引用。
   *
   * 这里不关闭 AudioContext，因为 AudioContext 归上层 Processor 管理。
   */
  destroy()
  {
    logger.debug('destroy()');

    if (this.workletNode)
    {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    this.assets = null;
    this.isInitialized = false;
  }

  /**
   * 在需要 WorkletNode 之前确保 initialize() 已被调用。
   */
  ensureInitialized()
  {
    if (!this.isInitialized)
    {
      logger.warn('ensureInitialized() failed: processor not initialized');
      throw new Error('Processor not initialized. Call initialize() first.');
    }
  }
};
