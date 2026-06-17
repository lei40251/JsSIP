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
  INIT_FAILED : 'AINS_WORKLET_INIT_FAILED'
};
const ISSUE_DEFAULTS = {
  module          : 'AiNS',
  component       : 'AiNSWorkletRuntime',
  stage           : 'unknown',
  severity        : 'error',
  message         : 'Unknown AiNS worklet runtime issue',
  fallbackApplied : false,
  degraded        : false,
  details         : {}
};
const getErrorMessage = issueUtils.getErrorMessage;

/**
 * AiNS 资源地址解析与抓取辅助器。
 *
 * 负责把 assetConfig 中的 cdnUrl 展开成具体资源 URL，并执行 fetch。
 */
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

  /**
   * 获取 AI 降噪所需的静态资源（WASM / 模型文件）。
   *
   * 引入 DEFAULT_FETCH_TIMEOUT_MS 超时机制（默认 15000ms），解决弱网环境下
   * fetch() 长时间挂起导致整个初始化流程卡死的问题。超时后 Promise 会被 reject，
   * 由上层 initialize() 捕获并通过 _reportIssue 上报，最终业务侧可通过
   * 'mediaEffectsIssue' 事件获知并执行降级。
   *
   * 实现细节：
   * - 使用 Promise.race 竞速：fetch 请求 vs 超时 Promise
   * - 超时 Promise 在 finally 块中通过 clearTimeout 清理，防止内存泄漏
   * - 超时错误信息包含 URL 和超时毫秒数，方便排查
   *
   * @param {string} url - 资源 URL
   * @returns {Promise<ArrayBuffer>}
   */
  async fetchAsset(url)
  {
    logger.debug(`AiNSAssetLoader.fetchAsset() start: url=${url} timeoutMs=${DEFAULT_FETCH_TIMEOUT_MS}`);
    let timeoutResolve = null;
    const trackedTimeoutPromise = new Promise((_, reject) =>
    {
      const timerId = setTimeout(() =>
      {
        reject(new Error(`Timed out fetching asset after ${DEFAULT_FETCH_TIMEOUT_MS}ms: ${url}`));
      }, DEFAULT_FETCH_TIMEOUT_MS);

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
      if (timeoutResolve)
      {
        timeoutResolve();
      }
    }

    if (!response.ok)
    {
      throw new Error(`Failed to fetch asset: url=${url} status=${response.status} statusText=${response.statusText}`);
    }

    const bytes = await response.arrayBuffer();

    logger.debug(`AiNSAssetLoader.fetchAsset() complete: url=${url} bytes=${bytes.byteLength}`);

    return bytes;
  }
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

    this._onIssue = typeof config.onIssue === 'function' ? config.onIssue : null;

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
   * 内部异常报告方法。
   *
   * 将 Worklet 运行时层面的问题（资源拉取失败、Worklet 节点初始化失败、
   * Worklet 内部线程初始化失败等）统一格式化后记录日志，并通过 onIssue 回调
   * 向上传递给 AiNSMediaStreamProcessor。
   *
   * 上报的问题类型包括：
   * - asset-fetch: WASM/模型资源拉取失败
   * - worklet-node-init: AudioWorkletNode 创建失败（如 addModule 失败）
   * - worklet-internal-init: Worker 线程内部 DeepFilter 初始化失败
   *   （通过 AudioWorklet port 的 onmessage 监听 WORKLET_EVENT_TYPES.INIT_FAILED 事件）
   *
   * 与 AiNSMediaStreamProcessor._reportIssue 的区别：
   * - 本方法位于调用链的最底层，直接面对运行时错误
   * - 上报后会设置 error.__mediaEffectsIssueReported = true，防止上层重复上报
   * - 对 AiNSWorkletSource 发来的 INIT_FAILED 消息，会将 fallbackApplied 和 degraded
   *   标记为 true，表明降噪功能已降级（音频直通、不处理）
   *
   * @param {Object} [issue] - 问题描述对象
   */
  _reportIssue(issue)
  {
    const normalizedIssue = issueUtils.normalizeIssue(ISSUE_DEFAULTS, issue);

    issueUtils.logIssue(logger, 'AiNS runtime issue', normalizedIssue, false);
    issueUtils.forwardIssue(this._onIssue, normalizedIssue, logger, 'AiNS runtime issue callback failed');
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
    let assets = null;

    try
    {
      assets = await Promise.all([
        this.assetLoader.fetchAsset(assetUrls.wasm),
        this.assetLoader.fetchAsset(assetUrls.model)
      ]);
    }
    catch (error)
    {
      this._reportIssue({
        stage    : 'asset-fetch',
        severity : 'error',
        message  : getErrorMessage(error),
        details  : {
          cdnUrl    : this.assetLoader.cdnUrl,
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
            cdnUrl              : this.assetLoader.cdnUrl
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
