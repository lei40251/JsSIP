const AiNSMediaStreamProcessor = require('./AINoiseSuppressionMediaStreamProcessor');

/**
 * AINoiseSuppression 对外门面。
 *
 * 这个类作为唯一公开入口，负责实例化和管理降噪处理器。
 */
class AiNSEngine
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
  }

  /**
   * 以“引擎模式”初始化降噪输出流。
   *
   * @param {{inputStream: MediaStream}} [params]
   * @returns {Promise<MediaStream>}
   */
  async init(params = {})
  {
    if (!params.inputStream)
    {
      throw new Error('inputStream required');
    }

    this.inputStream = params.inputStream;
    this.outputStream = await this.processor.init(this.inputStream);

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
    this.outputStream = await this.processor.replaceAudioTrack(input);
    this.inputStream = this.processor.originalStream;

    return this.outputStream;
  }

  /**
   * 暴露当前实例内部处理器，供业务层在已实例化前提下调试或调参。
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
    return this.processor.setEnabled(enable);
  }

  /**
   * 动态调整降噪强度。
   *
   * @param {number} level
   */
  setSuppressionLevel(level)
  {
    this.processor.setSuppressionLevel(level);
  }

  /**
   * 销毁引擎内部所有运行时资源。
   */
  async destroy()
  {
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
}

module.exports = AiNSEngine;
