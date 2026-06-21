const Logger = require('../Logger');
const issueUtils = require('../MediaEffectsIssue');
const AiNSConfig = require('./AiNSConfig');
const AiNSWorkletRuntime = require('./AiNSWorkletRuntime');

const logger = new Logger('AiNSMediaStreamProcessor');
const getErrorMessage = issueUtils.getErrorMessage;

function isAiNSSupported()
{
  return typeof AudioContext !== 'undefined' &&
    typeof AudioWorkletNode !== 'undefined' &&
    typeof WebAssembly !== 'undefined';
}

/**
 * AiNS 的 MediaStream 处理器。
 *
 * 职责：
 * 1. 接收原始 MediaStream / MediaStreamTrack；
 * 2. 搭建 AudioContext -> MediaStreamSource -> AudioWorkletNode -> Destination 图；
 * 3. 输出一个新的、可直接送入 JsSIP/RTCSession 的降噪后 MediaStream；
 * 4. 负责 AudioContext 和音频节点的生命周期。
 *
 * 这个类是“音频图编排层”，不会关心 RTCSession 之类的会话状态。
 */
module.exports = class AiNSMediaStreamProcessor
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
    this._onIssue = typeof options.onIssue === 'function' ? options.onIssue : null;
    const normalizedOptions = AiNSConfig.create(options);

    this.name = 'ai-noise-suppression-media-stream-processor';
    this.processedTrack = null;
    this.processedStream = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.destination = null;
    this.enabled = normalizedOptions.enabled;
    this.originalTrack = null;
    this.originalStream = null;
    this.preserveOtherTracks = normalizedOptions.preserveOtherTracks;
    this.config = normalizedOptions;
    this.processor = new AiNSWorkletRuntime({
      sampleRate          : normalizedOptions.sampleRate,
      noiseReductionLevel : normalizedOptions.noiseReductionLevel,
      assetConfig         : normalizedOptions.assetConfig,
      onIssue             : this._reportIssue.bind(this)
    });

    logger.debug(`constructor: ${JSON.stringify(this.config)}`);
  }

  /**
   * 内部异常报告方法。
   *
   * 将 AiNSWorkletRuntime 上报的问题统一格式化后记录日志，并根据 severity 级别
   * 将问题通过 `onIssue` 回调向上传递给 AiNoiseSuppressionEngine。
   *
   * issue 对象包含以下字段：
   * - module (string): 问题所属模块，如 'AiNS'
   * - component (string): 报告问题的组件名，如 'AiNSMediaStreamProcessor'
   * - stage (string): 问题发生的阶段，如 'audio-context-resume'
   * - severity (string): 严重级别，可选值为 'debug' | 'warn' | 'error'
   * - message (string): 问题描述信息
   * - fallbackApplied (boolean): 是否已应用降级方案
   * - degraded (boolean): 当前是否处于降级运行状态
   * - details (object): 与问题相关的额外上下文信息
   *
   * 异常处理机制：
   * - 日志记录：根据 severity 自动选择 logger.debug / logger.warn / logger.error
   * - 向上传递：调用构造函数传入的 onIssue 回调，回调异常时会被 catch 后记录警告日志
   * - 传参给下游时会将自身 _reportIssue 方法绑定后传给 AiNSWorkletRuntime，形成自底向上的问题上报链
   *
   * @param {Object} [issue] - 问题描述对象
   */
  _reportIssue(issue)
  {
    if (!this._onIssue) return;
    try { this._onIssue(Object.assign({ component: 'AiNSMediaStreamProcessor', severity: 'error' }, issue)); }
    catch (e) { logger.warn('AiNSMediaStreamProcessor issue callback failed: ' + (e.message || String(e))); }
  }

  /**
   * 浏览器能力检查。
   *
   * 只有同时具备：
   * - AudioContext
   * - AudioWorkletNode
   * - WebAssembly
   *
   * 才认为当前环境可以跑 AI 降噪。
   */
  static isSupported()
  {
    return isAiNSSupported();
  }

  /**
   * 初始化处理图并返回降噪后的 MediaStream。
   *
   * @param {MediaStream|MediaStreamTrack} input
   * @returns {Promise<MediaStream>}
   */
  async init(input)
  {
    logger.debug('init()');
    this.setInput(input);
    await this.ensureGraph();

    if (!this.processedStream)
    {
      throw new Error('AiNSMediaStreamProcessor.init: failed to create processed MediaStream');
    }

    return this.processedStream;
  }

  /**
   * 重启处理链。
   *
   * 用于切换输入流、切换麦克风或重新建图的场景。
   *
   * @param {MediaStream|MediaStreamTrack} [input]
   * @returns {Promise<MediaStream>}
   */
  async restart(input)
  {
    logger.debug(`restart(): hasNewInput=${Boolean(input)}`);

    if (input)
    {
      this.setInput(input);
    }

    return this.init(this.originalStream || this.originalTrack);
  }

  /**
   * 用新的音频轨替换当前输入流中的音频轨。
   *
   * 若当前处理器已经绑定了一路包含视频的原始流，则会保留原来的非音频轨道，
   * 只替换音频输入，方便 RTC 场景下切换麦克风或重新补音频轨。
   *
   * @param {MediaStream|MediaStreamTrack} input
   * @returns {Promise<MediaStream>}
   */
  async replaceAudioTrack(input)
  {
    logger.debug('replaceAudioTrack()');
    const nextAudioTrack = this._getInputAudioTrack(input);

    if (!nextAudioTrack)
    {
      throw new Error('AiNSMediaStreamProcessor: replacement input has no audio track');
    }

    const nextStream = this._buildReplacedAudioStream(nextAudioTrack);

    this.originalTrack = nextAudioTrack;
    this.originalStream = nextStream;

    await this.ensureGraph();

    if (!this.processedStream)
    {
      throw new Error('AiNSMediaStreamProcessor.replaceAudioTrack: failed to create processed MediaStream');
    }

    return this.processedStream;
  }

  /**
   * 运行时开关 AI 降噪，不销毁图。
   *
   * @param {boolean} enable
   * @returns {Promise<boolean>}
   */
  async setEnabled(enable)
  {
    this.enabled = AiNSConfig.normalizeBoolean(enable, this.enabled);
    logger.debug(`setEnabled(): enabled=${this.enabled}`);
    this.processor.setNsEnabled(this.enabled);

    return this.enabled;
  }

  setSuppressionLevel(level)
  {
    const nextLevel = AiNSConfig.normalizeSuppressionLevel(level, this.config.noiseReductionLevel);

    this.config.noiseReductionLevel = nextLevel;
    logger.debug(`setSuppressionLevel(): level=${nextLevel}`);
    this.processor.setSuppressionLevel(nextLevel);
  }

  isEnabled()
  {
    return this.enabled;
  }

  /**
   * 暂停 AudioContext，用于页面隐藏、临时节能等场景。
   */
  async suspend()
  {
    logger.debug(`suspend(): state=${this.audioContext ? this.audioContext.state : 'none'}`);

    if (this.audioContext && this.audioContext.state === 'running')
    {
      await this.audioContext.suspend();
    }
  }

  /**
   * 恢复 AudioContext。
   */
  async resume()
  {
    logger.debug(`resume(): state=${this.audioContext ? this.audioContext.state : 'none'}`);

    if (this.audioContext && this.audioContext.state === 'suspended')
    {
      await this.audioContext.resume();
    }
  }

  /**
   * 销毁完整处理图。
   *
   * 会释放：
   * - source/worklet/destination 节点
   * - AudioContext
   * - Core 内部的 WorkletNode 引用
   */
  async destroy()
  {
    logger.debug('destroy()');
    await this.teardownGraph();
    this.processor.destroy();
    this.originalTrack = null;
    this.originalStream = null;
  }

  /**
   * 统一规范输入类型，允许传入整个流或单个音轨。
   *
   * @param {MediaStream|MediaStreamTrack} input
   */
  setInput(input)
  {
    logger.debug(`setInput(): type=${this._getInputType(input)}`);

    if (input instanceof MediaStream)
    {
      const audioTrack = this._getInputAudioTrack(input);

      if (!audioTrack)
      {
        throw new Error('AiNSMediaStreamProcessor: input stream has no audio track');
      }

      this.originalStream = input;
      this.originalTrack = audioTrack;
      logger.debug(`setInput() stream resolved: audioTracks=${input.getAudioTracks().length} totalTracks=${input.getTracks().length}`);

      return;
    }

    if (!input || input.kind !== 'audio')
    {
      throw new Error('AiNSMediaStreamProcessor: input track must be audio');
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
    if (input instanceof MediaStream)
    {
      return 'MediaStream';
    }

    if (input && typeof input.kind === 'string')
    {
      return `MediaStreamTrack:${input.kind}`;
    }

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
      if (track.kind !== 'audio')
      {
        outputTracks.push(track);
      }
    });

    return new MediaStream(outputTracks);
  }

  /**
   * 真正创建或重建音频处理图。
   *
   * 调用顺序：
   * 1. 保证 AudioContext 可用
   * 2. 初始化 Core 资源
   * 3. 创建 WorkletNode
   * 4. 创建 source/destination
   * 5. 连接整张图
   * 6. 生成 processedStream
   */
  async ensureGraph()
  {
    logger.debug('ensureGraph() start');

    if (!this.originalTrack || !this.originalStream)
    {
      throw new Error('AiNSMediaStreamProcessor: missing source audio track');
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

    await this.processor.initialize();

    if (!this.workletNode)
    {
      this.workletNode = await this.processor.createAudioWorkletNode(this.audioContext);
    }

    if (!this.destination)
    {
      this.destination = this.audioContext.createMediaStreamDestination();
    }

    if (this.sourceNode)
    {
      this.sourceNode.disconnect();
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(new MediaStream([ this.originalTrack ]));
    this.sourceNode.connect(this.workletNode).connect(this.destination);

    this.rebuildProcessedStream();
    await this.setEnabled(this.enabled);
    logger.debug(`ensureGraph() complete: contextState=${this.audioContext.state} preserveOtherTracks=${this.preserveOtherTracks}`);
  }

  /**
   * 根据 destination 中的音轨重建最终输出流。
   *
   * 默认保留原始流中的非音频轨道，这样接入 RTCSession 时：
   * - 音频会换成降噪后的轨
   * - 视频轨仍沿用原始轨道
   */
  rebuildProcessedStream()
  {
    if (!this.destination)
    {
      throw new Error('AiNSMediaStreamProcessor: missing destination node');
    }

    const processedTrack = this.destination.stream.getAudioTracks()[0];

    if (!processedTrack)
    {
      throw new Error('AiNSMediaStreamProcessor: worklet destination did not produce an audio track');
    }

    this.processedTrack = processedTrack;

    const outputTracks = [ processedTrack ];

    if (this.preserveOtherTracks && this.originalStream)
    {
      this.originalStream.getTracks().forEach((track) =>
      {
        if (track.kind !== 'audio')
        {
          outputTracks.push(track);
        }
      });
    }

    this.processedStream = new MediaStream(outputTracks);
    logger.debug(`rebuildProcessedStream(): trackCount=${outputTracks.length}`);
  }

  /**
   * 拆除音频图并尽量吞掉清理阶段的非关键异常。
   *
   * 这么做是为了避免会话结束时因个别节点状态异常而阻断整体清理流程。
   */
  async teardownGraph()
  {
    logger.debug('teardownGraph() start');

    try
    {
      if (this.workletNode)
      {
        this.workletNode.disconnect();
        this.workletNode = null;
      }
      if (this.sourceNode)
      {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
      if (this.destination)
      {
        this.destination.disconnect();
        this.destination = null;
      }
      if (this.audioContext)
      {
        await this.audioContext.close();
        this.audioContext = null;
      }
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
};
