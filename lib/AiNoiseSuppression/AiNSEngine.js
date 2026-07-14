const Logger = require('../Logger');
const issueUtils = require('../MediaEffectsIssue');
const AiNSConfig = require('./AiNSConfig');
const AiNSWorkletRuntime = require('./AiNSWorkletRuntime');

const logger = new Logger('AiNoiseSuppression');
const getErrorMessage = issueUtils.getErrorMessage;

function cloneIssue(issue)
{
  return issue && typeof issue === 'object' ? JSON.parse(JSON.stringify(issue)) : null;
}

function isAiNSSupported()
{
  return typeof AudioContext !== 'undefined' &&
    typeof AudioWorkletNode !== 'undefined' &&
    typeof WebAssembly !== 'undefined';
}

/**
 * 汇总浏览器能力与当前引擎运行态快照。
 *
 * @param {AiNoiseSuppressionEngine|null} engine
 * @returns {Object}
 */
function collectCapabilityReport(engine)
{
  const requirements = {
    audioContext : typeof AudioContext !== 'undefined',
    audioWorklet : typeof AudioWorkletNode !== 'undefined',
    webAssembly  : typeof WebAssembly !== 'undefined',
    mediaStream  : typeof MediaStream !== 'undefined'
  };
  const missing = Object.keys(requirements).filter((key) => !requirements[key]);
  const supported = missing.length === 0 && isAiNSSupported();

  return {
    supported    : supported,
    requirements : requirements,
    missing      : missing,
    reason       : missing.length > 0 ? `Missing browser capabilities: ${missing.join(', ')}` : '',
    runtime      : engine ? {
      initialized         : Boolean(engine.processedStream),
      enabled             : typeof engine.isEnabled === 'function' ? engine.isEnabled() : Boolean(engine.enabled),
      preserveOtherTracks : Boolean(engine.preserveOtherTracks),
      sampleRate          : engine.config && engine.config.sampleRate,
      noiseReductionLevel : engine.config && engine.config.noiseReductionLevel,
      outputGain          : engine.config && engine.config.outputGain
    } : null
  };
}

/**
 * AI 降噪引擎。
 *
 * 负责接收原始 MediaStream/MediaStreamTrack 输入，管理 AudioContext +
 * AudioWorkletNode 音频处理图，通过 WASM 降噪模型实时处理音频，并提供
 * 问题记录与能力报告。
 */
class AiNoiseSuppressionEngine
{
  /**
   * @param {Object} [options]
   * @param {boolean} [options.enabled=true]
   * @param {boolean} [options.preserveOtherTracks=true]
   * @param {number} [options.sampleRate=48000]
   * @param {number} [options.noiseReductionLevel=80] - 降噪强度 (0-100)
   * @param {number} [options.outputGain=1] - AiNS 处理后的输出增益 (0-4)
   * @param {Object} [options.assetConfig] - 模型资源 CDN 配置
   */
  constructor(options = {})
  {
    this.options = options;
    this._issues = [];
    this._onIssue = typeof options.onIssue === 'function' ? options.onIssue : null;

    const normalizedOptions = AiNSConfig.create(options);

    // -- 音频图相关状态 --
    this.processedTrack = null;
    this.processedStream = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.outputGainNode = null;
    this.destination = null;
    this.enabled = normalizedOptions.enabled;
    this.originalTrack = null;
    this.originalStream = null;
    this.preserveOtherTracks = normalizedOptions.preserveOtherTracks;
    this.config = normalizedOptions;

    // -- 引擎入口处使用的输入/输出流引用 --
    this.inputStream = null;
    this.outputStream = null;

    // -- Worklet 运行时 --
    this._workletRuntime = new AiNSWorkletRuntime({
      sampleRate          : normalizedOptions.sampleRate,
      noiseReductionLevel : normalizedOptions.noiseReductionLevel,
      assetConfig         : normalizedOptions.assetConfig,
      onIssue             : this._reportIssue.bind(this)
    });

    logger.debug(`constructor: ${JSON.stringify(this.config)}`);
  }

  // ===========================================================================
  //  问题管理
  // ===========================================================================

  /**
	  * 内部异常报告（来自 WorkletRuntime / 音频图组件）。
	  */ 
  _reportIssue(issue)
  {
    const normalizedIssue = Object.assign({ component: 'AiNoiseSuppression', severity: 'error' }, issue);

    this._issues.push(cloneIssue(normalizedIssue));

    if (!this._onIssue) return;
    try { this._onIssue(normalizedIssue); }
    catch (e) { logger.warn(`AiNoiseSuppression issue callback failed: ${ e.message || String(e)}`); }
  }

  /** @returns {Object[]} 问题列表深拷贝 */
  getIssues()
  {
    return this._issues.map(cloneIssue);
  }

  /** @returns {Object|null} 最近一条问题 */
  getLastIssue()
  {
    return this._issues.length > 0 ? cloneIssue(this._issues[this._issues.length - 1]) : null;
  }

  // ===========================================================================
  //  初始化 / 处理
  // ===========================================================================

  /**
   * 初始化降噪输出流。
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
    this.setInput(this.inputStream);
    await this.ensureGraph();

    if (!this.processedStream)
    {
      throw new Error('AiNoiseSuppression.init: failed to create processed MediaStream');
    }

    this.outputStream = this.processedStream;
    logger.debug(`init() complete: hasOutput=${Boolean(this.outputStream)}`);

    return this.outputStream;
  }

  /** @returns {MediaStream|null} */
  getOutputStream()
  {
    return this.outputStream;
  }

  /**
   * 兼容 RTCSession 的 mediaStreamProcessor 接口。
   * @param {MediaStream} inputStream
   * @returns {Promise<MediaStream>}
   */
  async process(inputStream)
  {
    logger.debug('process()');
    
    return this.init({ inputStream });
  }

  /**
   * 用新的音频轨替换当前处理链，保留非音频轨道。
   * @param {MediaStream|MediaStreamTrack} input
   * @returns {Promise<MediaStream>}
   */
  async replaceAudioTrack(input)
  {
    logger.debug('replaceAudioTrack()');
    const nextAudioTrack = this._getInputAudioTrack(input);

    if (!nextAudioTrack)
    {
      throw new Error('AiNoiseSuppression: replacement input has no audio track');
    }

    const nextStream = this._buildReplacedAudioStream(nextAudioTrack);

    this.originalTrack = nextAudioTrack;
    this.originalStream = nextStream;

    await this.ensureGraph();

    if (!this.processedStream)
    {
      throw new Error('AiNoiseSuppression.replaceAudioTrack: failed to create processed MediaStream');
    }

    this.outputStream = this.processedStream;
    this.inputStream = this.originalStream;

    return this.outputStream;
  }

  /**
   * 暴露内部 WorkletRuntime（调试用，internal/unstable API）。
   * @returns {AiNSWorkletRuntime}
   */
  getProcessor()
  {
    return this._workletRuntime;
  }

  // ===========================================================================
  //  运行时控制
  // ===========================================================================

  /**
   * 动态开关降噪，不销毁处理图。
   * @param {boolean} enable
   * @returns {Promise<boolean>}
   */
  setEnabled(enable)
  {
    this.enabled = AiNSConfig.normalizeBoolean(enable, this.enabled);
    logger.debug(`setEnabled(): enabled=${this.enabled}`);
    this._workletRuntime.setNsEnabled(this.enabled);

    return Promise.resolve(this.enabled);
  }

  /**
   * 动态调整降噪强度 (0-100)。
   * @param {number} level
   */
  setSuppressionLevel(level)
  {
    const nextLevel = AiNSConfig.normalizeSuppressionLevel(level, this.config.noiseReductionLevel);

    this.config.noiseReductionLevel = nextLevel;
    logger.debug(`setSuppressionLevel(): level=${nextLevel}`);
    this._workletRuntime.setSuppressionLevel(nextLevel);
  }

  /**
   * 动态调整 AiNS 处理后的输出增益，不重建音频处理图。
   *
   * @param {number} value - 输出增益，范围 0-4
   * @returns {number} 归一化后的实际增益
   */
  setOutputGain(value)
  {
    const nextGain = AiNSConfig.normalizeOutputGain(value, this.config.outputGain);

    this.config.outputGain = nextGain;
    logger.debug(`setOutputGain(): value=${nextGain}`);

    if (this.outputGainNode)
    {
      this.outputGainNode.gain.value = nextGain;
    }

    return nextGain;
  }

  isEnabled()
  {
    return this.enabled;
  }

  /** 暂停 AudioContext */
  async suspend()
  {
    logger.debug(`suspend(): state=${this.audioContext ? this.audioContext.state : 'none'}`);
    if (this.audioContext && this.audioContext.state === 'running')
    {
      await this.audioContext.suspend();
    }
  }

  /** 恢复 AudioContext */
  async resume()
  {
    logger.debug(`resume(): state=${this.audioContext ? this.audioContext.state : 'none'}`);
    if (this.audioContext && this.audioContext.state === 'suspended')
    {
      await this.audioContext.resume();
    }
  }

  // ===========================================================================
  //  能力报告
  // ===========================================================================

  getCapabilityReport()
  {
    const report = collectCapabilityReport(this);

    if (report.runtime)
    {
      report.runtime.issueCount = this._issues.length;
      report.runtime.lastIssue = this._issues.length > 0 ? cloneIssue(this._issues[this._issues.length - 1]) : null;
    }
    report.issues = this._issues.map(cloneIssue);

    return report;
  }

  static isSupported()
  {
    return isAiNSSupported();
  }

  static getCapabilityReport()
  {
    const report = collectCapabilityReport(null);

    report.issues = [];
    
    return report;
  } 

  // ===========================================================================
  //  销毁
  // ===========================================================================

  async destroy()
  {
    logger.debug('destroy()');
    await this.teardownGraph();
    this._workletRuntime.destroy();
    this.originalTrack = null;
    this.originalStream = null;
    this.inputStream = null;
    this.outputStream = null;
  }

  // ===========================================================================
  //  内部：输入处理
  // ===========================================================================

  setInput(input)
  {
    logger.debug(`setInput(): type=${this._getInputType(input)}`);

    if (input instanceof MediaStream)
    {
      const audioTrack = this._getInputAudioTrack(input);

      if (!audioTrack)
      {
        throw new Error('AiNoiseSuppression: input stream has no audio track');
      }

      this.originalStream = input;
      this.originalTrack = audioTrack;
      logger.debug(`setInput() stream resolved: audioTracks=${input.getAudioTracks().length} totalTracks=${input.getTracks().length}`);

      return;
    }

    if (!input || input.kind !== 'audio')
    {
      throw new Error('AiNoiseSuppression: input track must be audio');
    }

    this.originalTrack = input;
    this.originalStream = new MediaStream([ input ]);
    logger.debug('setInput() single audio track wrapped into MediaStream');
  }

  _getInputAudioTrack(input)
  {
    if (input instanceof MediaStream)
    {
      return input.getAudioTracks()[0] || null;
    }
    if (input && input.kind === 'audio')
    {
      return input;
    }
    
    return null;
  }

  _getInputType(input)
  {
    if (input instanceof MediaStream) return 'MediaStream';
    if (input && typeof input.kind === 'string') return `MediaStreamTrack:${input.kind}`;
    
    return typeof input;
  }

  _buildReplacedAudioStream(audioTrack)
  {
    if (!this.originalStream)
    {
      return new MediaStream([ audioTrack ]);
    }

    const outputTracks = [ audioTrack ];

    this.originalStream.getTracks().forEach((track) =>
    {
      if (track.kind !== 'audio') outputTracks.push(track);
    });

    return new MediaStream(outputTracks);
  }

  // ===========================================================================
  //  内部：音频图
  // ===========================================================================

  async ensureGraph()
  {
    logger.debug('ensureGraph() start');

    if (!this.originalTrack || !this.originalStream)
    {
      throw new Error('AiNoiseSuppression: missing source audio track');
    }

    this.audioContext = this.audioContext || new AudioContext({ sampleRate: this.config.sampleRate });

    if (this.audioContext.state !== 'running')
    {
      try
      {
        await this.audioContext.resume();
      }
      catch (error)
      {
        logger.warn(`ensureGraph() | audioContext resume failed: ${getErrorMessage(error)}`);
        this._reportIssue({
          stage    : 'audio-context-resume',
          severity : 'warn',
          message  : getErrorMessage(error),
          degraded : true,
          details  : {
            contextState : this.audioContext ? this.audioContext.state : 'unknown',
            sampleRate   : this.audioContext ? this.audioContext.sampleRate : this.config.sampleRate
          }
        });
      }
    }

    await this._workletRuntime.initialize();

    if (!this.workletNode)
    {
      this.workletNode = await this._workletRuntime.createAudioWorkletNode(this.audioContext);
    }

    if (!this.outputGainNode)
    {
      this.outputGainNode = this.audioContext.createGain();
    }
    this.outputGainNode.gain.value = this.config.outputGain;

    if (!this.destination)
    {
      this.destination = this.audioContext.createMediaStreamDestination();
    }

    if (this.sourceNode)
    {
      this.sourceNode.disconnect();
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(new MediaStream([ this.originalTrack ]));
    this.sourceNode
      .connect(this.workletNode)
      .connect(this.outputGainNode)
      .connect(this.destination);

    this.rebuildProcessedStream();
    await this.setEnabled(this.enabled);
    logger.debug(`ensureGraph() complete: contextState=${this.audioContext.state} preserveOtherTracks=${this.preserveOtherTracks}`);
  }

  rebuildProcessedStream()
  {
    if (!this.destination)
    {
      throw new Error('AiNoiseSuppression: missing destination node');
    }

    const processedTrack = this.destination.stream.getAudioTracks()[0];

    if (!processedTrack)
    {
      throw new Error('AiNoiseSuppression: worklet destination did not produce an audio track');
    }

    this.processedTrack = processedTrack;

    const outputTracks = [ processedTrack ];

    if (this.preserveOtherTracks && this.originalStream)
    {
      this.originalStream.getTracks().forEach((track) =>
      {
        if (track.kind !== 'audio') outputTracks.push(track);
      });
    }

    this.processedStream = new MediaStream(outputTracks);
    logger.debug(`rebuildProcessedStream(): trackCount=${outputTracks.length}`);
  }

  async teardownGraph()
  {
    logger.debug('teardownGraph() start');

    try
    {
      if (this.workletNode) { this.workletNode.disconnect(); this.workletNode = null; }
      if (this.outputGainNode) { this.outputGainNode.disconnect(); this.outputGainNode = null; }
      if (this.sourceNode) { this.sourceNode.disconnect(); this.sourceNode = null; }
      if (this.destination) { this.destination.disconnect(); this.destination = null; }
      if (this.audioContext) { await this.audioContext.close(); this.audioContext = null; }
    }
    catch (error)
    {
      logger.warn('teardownGraph() | ignore cleanup error', error);
    }
    finally
    {
      this.processedTrack = null;
      this.processedStream = null;
      logger.debug('teardownGraph() complete');
    }
  }
}

module.exports = AiNoiseSuppressionEngine;
