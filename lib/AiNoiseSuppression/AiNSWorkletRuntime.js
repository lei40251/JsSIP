const Logger = require('../Logger');
const issueUtils = require('../MediaEffectsIssue');
const AiNSConfig = require('./AiNSConfig');
const createWorkletCode = require('./AiNSWorkletSource');

const logger = new Logger('AiNSWorkletRuntime');
const DEFAULT_CDN_URL = AiNSConfig.DEFAULT_CDN_URL;
const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const WORKLET_MESSAGE_TYPES = {
  SET_SUPPRESSION_LEVEL : 'SET_SUPPRESSION_LEVEL',
  SET_BYPASS            : 'SET_BYPASS'
};
const WORKLET_EVENT_TYPES = {
  INIT_FAILED                : 'AINS_WORKLET_INIT_FAILED',
  UNSUPPORTED_CHANNEL_LAYOUT : 'AINS_UNSUPPORTED_CHANNEL_LAYOUT'
};
const getErrorMessage = issueUtils.getErrorMessage;

/**
 * 根据 cdnUrl 拼接 WASM 和模型文件的完整 URL。
 * @param {string} cdnUrl
 * @returns {{wasm: string, model: string}}
 */
function getAssetUrls(cdnUrl)
{
  const base = cdnUrl || DEFAULT_CDN_URL;

  return {
    wasm  : `${base}/ans.wasm`,
    model : `${base}/ans_onnx.tar.gz`
  };
}

/**
 * 带超时的资源 fetch。解决弱网环境下 fetch() 长时间挂起的问题。
 *
 * @param {string} url - 资源 URL
 * @param {number} [timeoutMs=15000] - 超时毫秒
 * @returns {Promise<ArrayBuffer>}
 */
async function fetchAsset(url, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS)
{
  logger.debug(`fetchAsset() start: url=${url} timeoutMs=${timeoutMs}`);
  let timeoutResolve = null;
  const trackedTimeoutPromise = new Promise((_, reject) =>
  {
    const timerId = setTimeout(() =>
    {
      reject(new Error(`Timed out fetching asset after ${timeoutMs}ms: ${url}`));
    }, timeoutMs);

    timeoutResolve = () => clearTimeout(timerId);
  });
  let response = null;

  try
  {
    response = await Promise.race([
      fetch(url),
      trackedTimeoutPromise
    ]);
  }
  finally
  {
    if (timeoutResolve) timeoutResolve();
  }

  if (!response.ok)
  {
    throw new Error(`Failed to fetch asset: url=${url} status=${response.status} statusText=${response.statusText}`);
  }

  const bytes = await response.arrayBuffer();

  logger.debug(`fetchAsset() complete: url=${url} bytes=${bytes.byteLength}`);

  return bytes;
}

/**
 * 以 Blob URL 的形式注册内联 AudioWorklet 模块。
 *
 * @param {AudioContext} audioContext
 * @param {string} inlineCode
 * @returns {Promise<void>}
 */
async function registerWorkletModule(audioContext, inlineCode)
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
 * MediaStream 图的搭建由 `AiNoiseSuppressionEngine` 负责。
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

    this._onIssue = typeof config.onIssue === 'function' ? config.onIssue : null;

    this._cdnUrl = (normalizedConfig.assetConfig && normalizedConfig.assetConfig.cdnUrl) || DEFAULT_CDN_URL;
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
   * 内部异常报告方法。
   *
   * 将 Worklet 运行时层面的问题（资源拉取失败、Worklet 节点初始化失败、
   * Worklet 内部线程初始化失败等）统一格式化后记录日志，并通过 onIssue 回调
   * 向上传递给 AiNoiseSuppressionEngine。
   *
   * 上报的问题类型包括：
   * - asset-fetch: WASM/模型资源拉取失败
   * - worklet-node-init: AudioWorkletNode 创建失败（如 addModule 失败）
   * - worklet-internal-init: Worker 线程内部 DeepFilter 初始化失败
   *   （通过 AudioWorklet port 的 onmessage 监听 WORKLET_EVENT_TYPES.INIT_FAILED 事件）
   *
   * 与 AiNoiseSuppressionEngine._reportIssue 的区别：
   * - 本方法位于调用链的最底层，直接面对运行时错误
   * - 上报后会设置 error.__mediaEffectsIssueReported = true，防止上层重复上报
   * - 对 AiNSWorkletSource 发来的 INIT_FAILED 消息，会将 fallbackApplied 和 degraded
   *   标记为 true，表明降噪功能已降级（音频直通、不处理）
   *
   * @param {Object} [issue] - 问题描述对象
   */
  _reportIssue(issue)
  {
    if (!this._onIssue) return;
    try { this._onIssue(Object.assign({ component: 'AiNSWorkletRuntime', severity: 'error' }, issue)); }
    catch (e) { logger.warn(`AiNSWorkletRuntime issue callback failed: ${ e.message || String(e)}`); }
  }
 
  /**
   * 预加载 AiNoiseSuppression 运行时资源。
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

    const assetUrls = getAssetUrls(this._cdnUrl);

    logger.debug(`initialize() asset urls: ${JSON.stringify(assetUrls)}`);
    let assets = null;

    try
    {
      assets = await Promise.all([
        fetchAsset(assetUrls.wasm),
        fetchAsset(assetUrls.model)
      ]);
    }
    catch (error)
    {
      this._reportIssue({
        stage           : 'asset-fetch',
        severity        : 'error',
        message         : getErrorMessage(error),
        fallbackApplied : true,
        degraded        : true,
        details         : {
          cdnUrl    : this._cdnUrl,
          assetUrls : assetUrls
        }
      });
      if (error && typeof error === 'object')
      {
        error.__mediaEffectsIssueReported = true;
      }

      throw error;
    }

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
    try
    {
      await registerWorkletModule(audioContext, createWorkletCode());

      this.workletNode = new AudioWorkletNode(audioContext, 'ai-noise-suppression-audio-processor', {
        processorOptions : {
          wasmBytes        : this.assets.wasmBytes,
          modelBytes       : this.assets.modelBytes,
          suppressionLevel : this.config.noiseReductionLevel
        }
      });
    }
    catch (error)
    {
      this._reportIssue({
        stage    : 'worklet-node-init',
        severity : 'error',
        message  : getErrorMessage(error),
        details  : {
          sampleRate  : audioContext && audioContext.sampleRate,
          hasAssets   : Boolean(this.assets),
          moduleBytes : this.assets && this.assets.wasmBytes ? this.assets.wasmBytes.byteLength : 0,
          modelBytes  : this.assets && this.assets.modelBytes ? this.assets.modelBytes.byteLength : 0
        }
      });
      if (error && typeof error === 'object')
      {
        error.__mediaEffectsIssueReported = true;
      }

      throw error;
    }

    this.workletNode.port.onmessage = (event) =>
    {
      const data = event && event.data ? event.data : null;

      if (!data)
      {
        logger.debug('createAudioWorkletNode() port message ignored: empty payload');

        return;
      }

      logger.debug(`createAudioWorkletNode() port message: ${JSON.stringify(data)}`);

      if (data.type === WORKLET_EVENT_TYPES.INIT_FAILED)
      {
        this._reportIssue({
          component       : 'AiNSWorkletSource',
          stage           : 'worklet-internal-init',
          severity        : 'error',
          message         : data.message || 'AudioWorklet internal initialization failed',
          fallbackApplied : true,
          degraded        : true,
          details         : Object.assign({
            sampleRate          : audioContext && audioContext.sampleRate,
            noiseReductionLevel : this.config.noiseReductionLevel,
            cdnUrl              : this._cdnUrl
          }, data.details || {})
        });
      }
      else if (data.type === WORKLET_EVENT_TYPES.UNSUPPORTED_CHANNEL_LAYOUT)
      {
        this._reportIssue({
          component       : 'AiNSWorkletSource',
          stage           : 'unsupported-channel-layout',
          severity        : 'warn',
          message         : data.message || 'AudioWorklet bypassed unsupported channel layout',
          fallbackApplied : true,
          degraded        : true,
          details         : Object.assign({
            sampleRate          : audioContext && audioContext.sampleRate,
            noiseReductionLevel : this.config.noiseReductionLevel,
            cdnUrl              : this._cdnUrl
          }, data.details || {})
        });
      }
    };

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
  setNsEnabled(enabled)
  {
    const normalizedEnabled = AiNSConfig.normalizeBoolean(enabled, true);

    this.bypassEnabled = !normalizedEnabled;
    logger.debug(`setNsEnabled(): enabled=${normalizedEnabled}`);

    if (!this.workletNode)
    {
      logger.debug('setNsEnabled() deferred: worklet node not ready');

      return;
    }

    this.workletNode.port.postMessage({
      type  : WORKLET_MESSAGE_TYPES.SET_BYPASS,
      value : !normalizedEnabled
    });
  }

  /**
   * 返回当前是否处于“降噪启用”状态。
   *
   * @returns {boolean}
   */
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
   *
   * @throws {Error} 资源尚未初始化时抛错
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
