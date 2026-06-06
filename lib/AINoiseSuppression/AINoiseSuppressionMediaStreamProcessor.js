const Logger = require('../Logger');
const AiNSCore = require('./AINoiseSuppressionCore');

const logger = new Logger('AINoiseSuppression');

/**
 * AINoiseSuppression 的 MediaStream 处理器。
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
    const initialNoiseReductionLevel = typeof options.noiseReductionLevel === 'number' &&
      !Number.isNaN(options.noiseReductionLevel) ?
      Math.max(0, Math.min(100, Math.floor(options.noiseReductionLevel))) :
      80;

    this.name = 'ai-noise-suppression-media-stream-processor';
    this.processedTrack = null;
    this.processedStream = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.destination = null;
    this.enabled = options.enabled !== false;
    this.originalTrack = null;
    this.originalStream = null;
    this.preserveOtherTracks = options.preserveOtherTracks !== false;
    this.processor = new AiNSCore({
      sampleRate          : options.sampleRate || 48000,
      noiseReductionLevel : initialNoiseReductionLevel,
      assetConfig         : options.assetConfig || null
    });
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
    return typeof AudioContext !== 'undefined' &&
      typeof AudioWorkletNode !== 'undefined' &&
      typeof WebAssembly !== 'undefined';
  }

  /**
   * 初始化处理图并返回降噪后的 MediaStream。
   *
   * @param {MediaStream|MediaStreamTrack} input
   * @returns {Promise<MediaStream>}
   */
  async init(input)
  {
    this.setInput(input);
    await this.ensureGraph();

    if (!this.processedStream)
    {
      throw new Error('AINoiseSuppressionMediaStreamProcessor.init: failed to create processed MediaStream');
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
    const nextAudioTrack = this._resolveInputAudioTrack(input);

    if (!nextAudioTrack)
    {
      throw new Error('AINoiseSuppressionMediaStreamProcessor: replacement input has no audio track');
    }

    const nextStream = this._buildStreamWithReplacedAudioTrack(nextAudioTrack);

    this.originalTrack = nextAudioTrack;
    this.originalStream = nextStream;

    await this.ensureGraph();

    if (!this.processedStream)
    {
      throw new Error('AINoiseSuppressionMediaStreamProcessor.replaceAudioTrack: failed to create processed MediaStream');
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
    this.enabled = enable;
    this.processor.setNoiseSuppressionEnabled(enable);

    return this.enabled;
  }

  setSuppressionLevel(level)
  {
    this.processor.setSuppressionLevel(level);
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
    if (input instanceof MediaStream)
    {
      const audioTrack = this._resolveInputAudioTrack(input);

      if (!audioTrack)
      {
        throw new Error('AINoiseSuppressionMediaStreamProcessor: input stream has no audio track');
      }

      this.originalStream = input;
      this.originalTrack = audioTrack;

      return;
    }

    if (!input || input.kind !== 'audio')
    {
      throw new Error('AINoiseSuppressionMediaStreamProcessor: input track must be audio');
    }

    this.originalTrack = input;
    this.originalStream = new MediaStream([ input ]);
  }

  _resolveInputAudioTrack(input)
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

  _buildStreamWithReplacedAudioTrack(audioTrack)
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
    if (!this.originalTrack || !this.originalStream)
    {
      throw new Error('AINoiseSuppressionMediaStreamProcessor: missing source audio track');
    }

    this.audioContext = this.audioContext || new AudioContext({ sampleRate: 48000 });

    if (this.audioContext.state !== 'running')
    {
      try
      {
        await this.audioContext.resume();
      }
      catch (error)
      {
        logger.warn('ensureGraph() | audioContext resume failed', error);
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
      throw new Error('AINoiseSuppressionMediaStreamProcessor: missing destination node');
    }

    const processedTrack = this.destination.stream.getAudioTracks()[0];

    if (!processedTrack)
    {
      throw new Error('AINoiseSuppressionMediaStreamProcessor: worklet destination did not produce an audio track');
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
  }

  /**
   * 拆除音频图并尽量吞掉清理阶段的非关键异常。
   *
   * 这么做是为了避免会话结束时因个别节点状态异常而阻断整体清理流程。
   */
  async teardownGraph()
  {
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
    }
  }
};
