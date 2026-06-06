const workletCode = require('./aiNoiseSuppressionWorkletSource');

const DEFAULT_CDN_URL = './static';
const WORKLET_MESSAGE_TYPES = {
  SET_SUPPRESSION_LEVEL : 'SET_SUPPRESSION_LEVEL',
  SET_BYPASS            : 'SET_BYPASS'
};

class AssetLoader
{
  /**
   * @param {Object} [config]
   * @param {string} [config.cdnUrl]
   */
  constructor(config = {})
  {
    this.cdnUrl = config.cdnUrl || DEFAULT_CDN_URL;
  }

  getAssetUrls()
  {
    return {
      glue  : this.getAssetUrl('v2/ans.js'),
      wasm  : this.getAssetUrl('v2/ans.wasm'),
      model : this.getAssetUrl('v2/ans_onnx.tar.gz')
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
 * AINoiseSuppression Core 运行时。
 *
 * 它只负责：
 * - 拉取 WASM / 模型资源
 * - 注册 AudioWorklet 模块
 * - 创建 AudioWorkletNode
 * - 向 Worklet 发送运行时控制消息
 *
 * 它不直接处理 MediaStream，也不管理 AudioContext 生命周期。
 * MediaStream 图的搭建由 `AINoiseSuppressionMediaStreamProcessor` 负责。
 */
module.exports = class AiNSCore
{
  /**
   * @param {Object} [config]
   * @param {number} [config.sampleRate=48000]
   * @param {number} [config.noiseReductionLevel=80]
   * @param {Object} [config.assetConfig]
   */
  constructor(config = {})
  {
    const initialNoiseReductionLevel = typeof config.noiseReductionLevel === 'number' &&
      !Number.isNaN(config.noiseReductionLevel) ?
      Math.max(0, Math.min(100, Math.floor(config.noiseReductionLevel))) :
      80;

    this.assetLoader = new AssetLoader(config.assetConfig);
    this.assets = null;
    this.workletNode = null;
    this.isInitialized = false;
    this.bypassEnabled = false;
    this.config = {
      sampleRate          : config.sampleRate || 48000,
      noiseReductionLevel : initialNoiseReductionLevel,
      assetConfig         : config.assetConfig || null
    };
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
    if (this.isInitialized) return;

    const assetUrls = this.assetLoader.getAssetUrls();
    const assets = await Promise.all([
      this.assetLoader.fetchAsset(assetUrls.wasm),
      this.assetLoader.fetchAsset(assetUrls.model)
    ]);

    this.assets = {
      wasmBytes  : assets[0],
      modelBytes : assets[1]
    };
    this.isInitialized = true;
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

    await registerInlineWorkletModule(audioContext, workletCode);

    this.workletNode = new AudioWorkletNode(audioContext, 'ai-noise-suppression-audio-processor', {
      processorOptions : {
        wasmBytes        : this.assets.wasmBytes,
        modelBytes       : this.assets.modelBytes,
        suppressionLevel : this.config.noiseReductionLevel
      }
    });

    return this.workletNode;
  }

  /**
   * 动态调整降噪强度，范围会被夹到 0~100。
   *
   * @param {number} level
   */
  setSuppressionLevel(level)
  {
    if (typeof level !== 'number' || Number.isNaN(level)) return;

    const clampedLevel = Math.max(0, Math.min(100, Math.floor(level)));

    this.config.noiseReductionLevel = clampedLevel;

    if (!this.workletNode) return;

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
    if (!this.workletNode) return;

    this.bypassEnabled = !enabled;
    this.workletNode.port.postMessage({
      type  : WORKLET_MESSAGE_TYPES.SET_BYPASS,
      value : !enabled
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
      throw new Error('Processor not initialized. Call initialize() first.');
    }
  }
};
