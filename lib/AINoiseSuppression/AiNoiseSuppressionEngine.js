const AiNSMediaStreamProcessor = require('./AiNSMediaStreamProcessor');
const Logger = require('../Logger');
const issueUtils = require('../MediaEffectsIssue');

const logger = new Logger('AiNoiseSuppressionEngine');
const MAX_REPORTED_ISSUES = 20;
const ISSUE_DEFAULTS = {
  module  : 'AiNS',
  message : 'Unknown AiNS issue'
};

function cloneIssue(issue)
{
  return issue && typeof issue === 'object' ? JSON.parse(JSON.stringify(issue)) : null;
}

/**
 * 汇总浏览器能力与当前处理器运行态快照。
 *
 * @param {AiNSMediaStreamProcessor|null} processor
 * @returns {Object}
 */
function collectCapabilityReport(processor)
{
  const requirements = {
    audioContext : typeof AudioContext !== 'undefined',
    audioWorklet : typeof AudioWorkletNode !== 'undefined',
    webAssembly  : typeof WebAssembly !== 'undefined',
    mediaStream  : typeof MediaStream !== 'undefined'
  };
  const missing = Object.keys(requirements).filter((key) => !requirements[key]);
  const supported = missing.length === 0 && AiNSMediaStreamProcessor.isSupported();

  return {
    supported    : supported,
    requirements : requirements,
    missing      : missing,
    reason       : missing.length > 0 ? `Missing browser capabilities: ${missing.join(', ')}` : '',
    runtime      : processor ? {
      initialized         : Boolean(processor.processedStream),
      enabled             : typeof processor.isEnabled === 'function' ? processor.isEnabled() : Boolean(processor.enabled),
      preserveOtherTracks : Boolean(processor.preserveOtherTracks),
      sampleRate          : processor.config && processor.config.sampleRate,
      noiseReductionLevel : processor.config && processor.config.noiseReductionLevel
    } : null
  };
}

/**
 * AINoiseSuppression 对外门面。
 *
 * 这个类作为唯一公开入口，负责实例化和管理降噪处理器。
 */
class AiNoiseSuppressionEngine
{
  /**
   * @param {Object} [options]
   * @param {boolean} [options.enabled=true]
   * @param {boolean} [options.preserveOtherTracks=true]
   * @param {number} [options.sampleRate=48000]
   * @param {number} [options.noiseReductionLevel=80]
   * @param {Object} [options.assetConfig]
   */
  constructor(options = {})
  {
    this.options = options;
    this._issues = [];
    this._onIssue = typeof options.onIssue === 'function' ? options.onIssue : null;
    this.processor = new AiNSMediaStreamProcessor(Object.assign({}, options, {
      onIssue : this._handleIssue.bind(this)
    }));
    this.inputStream = null;
    this.outputStream = null;

    logger.debug(`constructor: ${JSON.stringify(this.processor.config)}`);
  }

  /**
   * 统一的问题处理入口。
   *
   * 接收来自 AiNSMediaStreamProcessor 的上报后执行以下操作：
   *
   * 1. **内存缓存**：将 clone 后的 issue 推入 this._issues 数组，供 getIssues() 查询。
   *    通过 MAX_REPORTED_ISSUES（默认 20）限制缓存条数，超出时丢弃最旧记录（FIFO 策略），
   *    防止内存无限增长。
   *
   * 2. **向上传递**：调用构造函数传入的 onIssue 回调（通常由 MediaPipeline 提供，
   *    最终通过 RTCSession._emitMediaEffectsIssue 发出 'mediaEffectsIssue' 事件），
   *    回调异常时会被 catch 后记录警告日志，不中断问题处理流程。
   *
   * 3. **能力报告：** 在 getCapabilityReport() 中将问题列表和最后一条问题写入
   *    report.issues 和 report.runtime.lastIssue，方便上层调试与监控。
   *
   * @param {Object} [issue] - 问题描述对象，字段由下层组件定义
   */
  _handleIssue(issue)
  {
    const normalizedIssue = issueUtils.normalizeIssue(ISSUE_DEFAULTS, issue);

    this._issues.push(cloneIssue(normalizedIssue));
    if (this._issues.length > MAX_REPORTED_ISSUES)
    {
      this._issues.shift();
    }

    issueUtils.forwardIssue(this._onIssue, normalizedIssue, logger, 'AiNS issue callback failed', cloneIssue);
  }

  /**
   * 以“引擎模式”初始化降噪输出流。
   *
   * @param {{inputStream: MediaStream}} [params]
   * @returns {Promise<MediaStream>}
   */
  async init(params = {})
  {
    logger.debug('init()');

    if (!params.inputStream)
    {
      throw new Error('inputStream required');
    }

    this.inputStream = params.inputStream;
    this.outputStream = await this.processor.init(this.inputStream);
    logger.debug(`init() complete: hasOutput=${Boolean(this.outputStream)}`);

    return this.outputStream;
  }

  /**
   * 获取最近一次 init 后的输出流。
   *
   * @returns {MediaStream|null}
   */
  getOutputStream()
  {
    return this.outputStream;
  }

  /**
   * 兼容 RTCSession 的实例式 mediaStreamProcessor 接口。
   *
   * @param {MediaStream} inputStream
   * @returns {Promise<MediaStream>}
   */
  async process(inputStream)
  {
    logger.debug('process()');

    return this.init({ inputStream });
  }

  /**
   * 用新的音频输入替换当前处理链中的音频轨，并返回最新输出流。
   *
   * @param {MediaStream|MediaStreamTrack} input
   * @returns {Promise<MediaStream>}
   */
  async replaceAudioTrack(input)
  {
    logger.debug('replaceAudioTrack()');
    this.outputStream = await this.processor.replaceAudioTrack(input);
    this.inputStream = this.processor.originalStream;

    return this.outputStream;
  }

  /**
   * 暴露当前实例内部处理器，供业务层在已实例化前提下调试或调参。
   *
   * 注意：这是调试逃生口，属于 internal/unstable API，不建议在正式业务逻辑里依赖。
   *
   * @returns {AiNSMediaStreamProcessor}
   */
  getProcessor()
  {
    return this.processor;
  }

  /**
   * 动态开关 AI 降噪。
   *
   * @param {boolean} enable
   * @returns {Promise<boolean>}
   */
  setEnabled(enable)
  {
    logger.debug(`setEnabled(): requested=${enable}`);

    return this.processor.setEnabled(enable);
  }

  getCapabilityReport()
  {
    const report = collectCapabilityReport(this.processor);

    if (report.runtime)
    {
      report.runtime.issueCount = this._issues.length;
      report.runtime.lastIssue = this._issues.length > 0 ? cloneIssue(this._issues[this._issues.length - 1]) : null;
    }
    report.issues = this._issues.map(cloneIssue);

    return report;
  }

  /**
   * 动态调整降噪强度。
   *
   * @param {number} level
   */
  setSuppressionLevel(level)
  {
    logger.debug(`setSuppressionLevel(): requested=${level}`);

    this.processor.setSuppressionLevel(level);
  }

  /**
   * 销毁引擎内部所有运行时资源。
   */
  async destroy()
  {
    logger.debug('destroy()');
    await this.processor.destroy();
    this.inputStream = null;
    this.outputStream = null;
  }

  /**
   * 获取当前引擎记录的所有问题列表。
   *
   * 返回的是深拷贝副本，外部修改不会影响内部缓存。
   * 最多保留 MAX_REPORTED_ISSUES 条（默认 20 条），FIFO 淘汰。
   *
   * @returns {Object[]}
   */
  getIssues()
  {
    return this._issues.map(cloneIssue);
  }

  /**
   * 获取最近一次记录的问题，若无则返回 null。
   *
   * 返回深拷贝副本，通常用于健康检查或状态快照（如 getCapabilityReport()）。
   *
   * @returns {Object|null}
   */
  getLastIssue()
  {
    return this._issues.length > 0 ? cloneIssue(this._issues[this._issues.length - 1]) : null;
  }

  /**
   * 浏览器能力探测。
   *
   * @returns {boolean}
   */
  static isSupported()
  {
    return AiNSMediaStreamProcessor.isSupported();
  }

  /**
   * 获取静态能力报告（不依赖实例状态）。
   *
   * @returns {Object}
   */
  static getCapabilityReport()
  {
    const report = collectCapabilityReport(null);

    report.issues = [];

    return report;
  }
}

module.exports = AiNoiseSuppressionEngine;
