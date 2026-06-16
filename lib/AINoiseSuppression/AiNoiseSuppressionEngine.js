const AiNSMediaStreamProcessor = require('./AiNSMediaStreamProcessor');
const Logger = require('../Logger');

const logger = new Logger('AiNoiseSuppressionEngine');

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
   */
  constructor(options = {})
  {
    this.options = options;
    this.processor = new AiNSMediaStreamProcessor(options);
    this.inputStream = null;
    this.outputStream = null;

    logger.debug(`constructor: ${JSON.stringify(this.processor.config)}`);
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
    return collectCapabilityReport(this.processor);
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
   * 浏览器能力探测。
   */
  static isSupported()
  {
    return AiNSMediaStreamProcessor.isSupported();
  }

  static getCapabilityReport()
  {
    return collectCapabilityReport(null);
  }
}

module.exports = AiNoiseSuppressionEngine;
