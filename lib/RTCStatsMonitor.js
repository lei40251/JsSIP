/* eslint-disable max-len */
const EventEmitter = require('events').EventEmitter;
const Logger = require('./Logger');

const logger = new Logger('RTCStatsMonitor');

const DEFAULT_OPTIONS = {
  sampleIntervalMs           : 2000,
  legacyReportIntervalMs     : 2000,
  backgroundSampleIntervalMs : 2000,
  transitionGraceSamples     : 2,
  enableDetailedReport       : true,
  enableRawStatsLog          : false,
  rawStatsLogIntervalMs      : 10000,
  getStatsTimeoutMs          : 5000,
  autoStart                  : true,
  contextProvider            : null,
  streamClassifier           : null
};

const LEVEL = {
  FULL         : 'full',
  PARTIAL      : 'partial',
  LEGACY_BASIC : 'legacy-basic',
  UNSUPPORTED  : 'unsupported'
};

/**
 * 数据处理主链路：
 *
 * RTCPeerConnection.getStats()
 *   -> 兼容标准 Map、普通对象和旧版 result()/stat() 报告
 *   -> 按 report.id 保存上一份基线
 *   -> 使用报告自身 timestamp 计算区间增量
 *   -> 生成完整诊断报告和 detailed-report 事件摘要
 *   -> 按较低频率生成兼容的 report / network-quality
 *
 * 这里刻意不使用 setInterval：一次 getStats 尚未完成时不会启动下一次采样，
 * 可避免低性能移动设备上出现并发解析、乱序覆盖基线和定时器堆积。
 *
 * 兼容等级由运行时实际收到的 API 和字段自动判断，不依赖 UA：
 * - full：存在 RTP、传输/候选对和至少一类高级质量字段；
 * - partial：支持标准 getStats，但浏览器只提供部分字段；
 * - legacy-basic：使用旧版 callback/result()/stat() 报告；
 * - unsupported：PeerConnection 不提供 getStats。
 */

/**
 * 独立的 WebRTC 统计监控器。
 *
 * PC 创建后即可启动，不要求当时已经存在 sender、receiver、MID 或 RTP 数据。
 * 浏览器缺失的字段统一返回 null，避免把“未知”误判为 0。
 *
 * @fires RTCStatsMonitor#detailed-report 每次成功采样后触发的常用诊断摘要
 * @fires RTCStatsMonitor#report 兼容旧模块结构的上下行媒体报告
 * @fires RTCStatsMonitor#network-quality 兼容旧模块结构的网络等级
 * @fires RTCStatsMonitor#stats-error 不影响通话流程的统计错误
 */
module.exports = class RTCStatsMonitor extends EventEmitter
{
  /**
   * @param {RTCPeerConnection} pc 要监控的 PeerConnection
   * @param {object} [options] 采样与输出选项
   * @param {number} [options.sampleIntervalMs=2000] 前台基础采样间隔，最小 500ms
   * @param {number} [options.legacyReportIntervalMs=2000] 两个兼容事件的输出间隔
   * @param {number} [options.backgroundSampleIntervalMs=2000] 页面后台时的采样间隔
   * @param {number} [options.transitionGraceSamples=2] 媒体变化后跳过异常诊断的样本数
   * @param {boolean} [options.enableDetailedReport=true] 是否记录常用诊断摘要并发送 detailed-report 事件
   * @param {boolean} [options.enableRawStatsLog=false] 是否按限频规则记录原始报告
   * @param {number} [options.getStatsTimeoutMs=5000] 单次 getStats 超时时间，最小 100ms
   * @param {boolean} [options.autoStart=true] 构造后是否立即开始采样
   * @param {Function} [options.contextProvider] 提供 hold、mute、mode、sharedMid 等会话上下文
   * @param {Function} [options.streamClassifier] 自定义 audio/video/shared 流分类
   */
  constructor(pc, options = {})
  {
    super();

    this._pc = pc;
    this._options = Object.assign({}, DEFAULT_OPTIONS, options);
    this._options.sampleIntervalMs = Math.max(500, number(this._options.sampleIntervalMs) || DEFAULT_OPTIONS.sampleIntervalMs);
    this._options.legacyReportIntervalMs = Math.max(this._options.sampleIntervalMs, number(this._options.legacyReportIntervalMs) || DEFAULT_OPTIONS.legacyReportIntervalMs);
    this._options.backgroundSampleIntervalMs = Math.max(this._options.sampleIntervalMs, number(this._options.backgroundSampleIntervalMs) || DEFAULT_OPTIONS.backgroundSampleIntervalMs);
    this._options.getStatsTimeoutMs = Math.max(100, number(this._options.getStatsTimeoutMs) || DEFAULT_OPTIONS.getStatsTimeoutMs);
    this._options.rawStatsLogIntervalMs = Math.max(1000, number(this._options.rawStatsLogIntervalMs) || DEFAULT_OPTIONS.rawStatsLogIntervalMs);
    const transitionGraceSamples = number(this._options.transitionGraceSamples);

    this._options.transitionGraceSamples = transitionGraceSamples === null
      ? DEFAULT_OPTIONS.transitionGraceSamples
      : Math.max(0, Math.floor(transitionGraceSamples));

    this._previous = new Map();
    this._observedTypes = new Set();
    this._observedFeatures = new Set();
    this._timer = null;
    this._started = false;
    this._sampling = false;
    // stop() 后若在旧 getStats 返回前再次 start()，由旧采样的 finally 安排新一轮采样。
    this._restartPending = false;
    this._runId = 0;
    this._sampleCount = 0;
    this._lastLegacyTimestamp = null;
    this._lastRawLogTimestamp = null;
    this._lastTopology = null;
    this._transitionReason = null;
    this._transitionSamples = 0;
    this._consecutiveErrors = 0;
    this._unsupportedReported = false;
    this._statsFormat = 'unknown';
    this._latestDetailedReport = null;
    this._latestLegacyReport = null;
    this._latestNetworkQuality = null;

    this._compatibility = {
      level : this._canGetStats() ? LEVEL.PARTIAL : LEVEL.UNSUPPORTED,
      api   : {
        getStats            : this._canGetStats(),
        promiseGetStats     : false,
        callbackGetStats    : false,
        getTransceivers     : Boolean(pc && typeof pc.getTransceivers === 'function'),
        standardStatsReport : false
      }
    };

    if (this._options.autoStart !== false)
    {
      this.start();
    }
  }

  get supported()
  {
    return this._compatibility.level !== LEVEL.UNSUPPORTED;
  }

  get compatibility()
  {
    return this._compatibilitySnapshot();
  }

  /**
   * 启动采样。重复调用不会创建多个定时器。
   *
   * 第一次立即采样只建立计数器基线；需要增量的码率、区间丢包等字段在
   * 下一份可比较报告到达前保持 null。
   */
  start()
  {
    if (this._started)
    {
      return;
    }

    this._started = true;
    this._runId++;

    if (this._sampling)
    {
      // 已发出的 getStats 无法取消；等待旧采样退出后立即为新 runId 重新调度。
      this._restartPending = true;

      return;
    }

    // 立即采样第一份基线，否则要等两个周期后才能得到第一组有效增量。
    this._schedule(0);
  }

  /**
   * 停止采样并释放定时器、历史基线和质量窗口。
   *
   * 浏览器不支持取消已经发出的 getStats Promise，因此使用 runId 丢弃在途结果，
   * 保证 stop() 返回后不再触发任何报告事件。
   */
  stop()
  {
    if (!this._started && !this._sampling)
    {
      return;
    }

    this._started = false;
    this._runId++;
    this._restartPending = false;

    if (this._timer !== null)
    {
      clearTimeout(this._timer);
      this._timer = null;
    }

    // 在途 getStats 不能取消，通过 runId 让它返回后不再发事件。
    this._clearSamplingBaseline();
  }

  /**
   * 保持运行状态不变，仅重建统计基线。
   *
   * 适合外部明确知道计数器会重置的场景；下一份报告会重新进入 warming-up，
   * 不会把新的小计数器减去旧的大计数器而得到负速率。
   */
  reset()
  {
    this._clearSamplingBaseline();
    this.markTransition('reset');
  }

  /**
   * 清除所有依赖上一轮报告的状态，但保留 latest 报告供停止后诊断查看。
   * stop、reset 和旧 runId 在途结果返回时都必须走这里，避免旧基线污染重启会话。
   *
   * @private
   */
  _clearSamplingBaseline()
  {
    this._previous.clear();
    this._sampleCount = 0;
    this._lastLegacyTimestamp = null;
    this._lastTopology = null;
    this._transitionReason = null;
    this._transitionSamples = 0;
    this._consecutiveErrors = 0;
    this._lastRawLogTimestamp = null;
  }

  /**
   * 正常情况下模块会自动识别媒体变化；RTCSession 也可以用此方法补充更明确的变化原因。
   */
  markTransition(reason = 'external-media-change')
  {
    this._transitionReason = reason;
    this._transitionSamples = this._options.transitionGraceSamples;
  }

  getLatestReport()
  {
    return cloneSnapshot(this._latestDetailedReport);
  }

  getLatestLegacyReport()
  {
    return cloneSnapshot(this._latestLegacyReport);
  }

  getLatestNetworkQuality()
  {
    return cloneSnapshot(this._latestNetworkQuality);
  }

  _canGetStats()
  {
    return Boolean(this._pc && typeof this._pc.getStats === 'function');
  }

  _schedule(timeoutMs)
  {
    if (!this._started)
    {
      return;
    }

    this._timer = setTimeout(() =>
    {
      Promise.resolve(this._sample()).catch((error) =>
      {
        logger.warn(`RTCStatsMonitor sampling task failed: ${error && error.message ? error.message : String(error)}`);
      });
    }, timeoutMs);
  }

  /**
   * 执行一个完整采样周期。
   *
   * 只有上一个周期完全结束后才调度下一次；单次失败通过 stats-error 上报，
   * 不会抛到 RTCSession，也不会停止后续重试。PC 已关闭或 API 不存在时才停止。
   *
   * @returns {Promise<void>}
   * @private
   */
  async _sample()
  {
    if (!this._started || this._sampling)
    {
      return;
    }

    const runId = this._runId;

    this._sampling = true;

    try
    {
      if (!this._canGetStats())
      {
        if (!this._unsupportedReported)
        {
          this._unsupportedReported = true;
          this._compatibility.level = LEVEL.UNSUPPORTED;
          this._emitStatsError('GET_STATS_UNSUPPORTED', new Error('RTCPeerConnection.getStats is unavailable'), true);
        }

        this.stop();

        return;
      }

      if (this._pc.signalingState === 'closed')
      {
        this.stop();

        return;
      }

      const detailedReport = await this._collect();

      if (!this._started || runId !== this._runId)
      {
        // _collect() 在解析阶段会更新基线；如果本轮已经失效，必须再次清除这些副作用。
        this._clearSamplingBaseline();

        return;
      }

      this._sampleCount++;
      this._consecutiveErrors = 0;
      this._latestDetailedReport = detailedReport;

      if (this._options.enableDetailedReport)
      {
        try { logger.debug('detailed-report: ', JSON.stringify(this._createDetailedLogReport(detailedReport))); }
        catch (error) { logger.warn(`detailed-report logging failed: ${error.message || String(error)}`); }
        this._safeEmit('detailed-report', this._createDetailedEventReport(detailedReport));
      }

      if (this._sampleCount === 1)
      {
        this._lastLegacyTimestamp = detailedReport.timestamp;
      }
      else if (this._lastLegacyTimestamp === null || detailedReport.timestamp - this._lastLegacyTimestamp >= this._options.legacyReportIntervalMs)
      {
        const legacyReport = this._createLegacyReport(detailedReport);
        const networkQualityReport = this._createNetworkQuality(detailedReport);

        this._lastLegacyTimestamp = detailedReport.timestamp;
        this._latestLegacyReport = legacyReport;
        this._latestNetworkQuality = networkQualityReport;
        this._safeEmit('report', legacyReport);
        this._safeEmit('network-quality', networkQualityReport);
      }
    }
    catch (error)
    {
      this._consecutiveErrors++;
      this._emitStatsError('GET_STATS_FAILED', error, false);
    }
    finally
    {
      this._sampling = false;

      if (this._started && (runId === this._runId || this._restartPending))
      {
        const restartImmediately = this._restartPending;

        this._restartPending = false;
        this._schedule(restartImmediately ? 0 :
          typeof document !== 'undefined' && document.visibilityState === 'hidden'
            ? this._options.backgroundSampleIntervalMs
            : this._options.sampleIntervalMs
        );
      }
    }
  }

  /**
   * 收集、归一化并解析一次报告，同时记录 getStats 和解析耗时。
   *
   * @returns {Promise<object>} 完整诊断报告
   * @private
   */
  async _collect()
  {
    const getStatsStartedAt = monotonicNow();
    // callback 和 Promise 形式都可能遇到异常实现静默不返回；统一超时可确保
    // _sample() 进入 finally 释放采样锁，并在下一周期继续重试。
    const rawStats = await withTimeout(
      this._requestStats(),
      this._options.getStatsTimeoutMs,
      `getStats timed out after ${this._options.getStatsTimeoutMs}ms`
    );
    const getStatsDurationMs = monotonicNow() - getStatsStartedAt;
    const parseStartedAt = monotonicNow();
    const normalized = this._normalize(rawStats);
    const report = this._createDetailedReport(normalized.reports, getStatsDurationMs, normalized.format);

    this._updateCompatibility(normalized.reports, normalized.format);
    report.compatibility = this._compatibilitySnapshot();
    report.performance.parseDurationMs = rounded(monotonicNow() - parseStartedAt, 3);
    this._logRawStats(report.timestamp, normalized.reports);

    return report;
  }

  /**
   * 优先调用现代 Promise getStats；返回值为空或同步抛错时自动切换 callback API。
   *
   * 能力判断基于实际调用结果，避免仅凭函数 length 或浏览器 UA 作结论。
   *
   * @returns {Promise<RTCStatsReport|object>}
   * @private
   */
  async _requestStats()
  {
    let result;

    try
    {
      result = this._pc.getStats();
    }
    catch (error)
    {
      return this._requestStatsByCallback(error);
    }

    if (result && typeof result.then === 'function')
    {
      this._compatibility.api.promiseGetStats = true;

      try
      {
        return await result;
      }
      catch (error)
      {
        return this._requestStatsByCallback(error);
      }
    }

    if (result)
    {
      return result;
    }

    return this._requestStatsByCallback();
  }

  /**
   * 兼容历史上出现过的两种 callback 参数顺序。
   *
   * 函数 length 仅作为第一次尝试的提示；同步失败后会交换签名重试。
   * settled 防止异常浏览器同时调用成功和失败回调时重复完成 Promise。
   *
   * @param {Error} [initialError] Promise 形式首次调用时的同步异常
   * @returns {Promise<object>}
   * @private
   */
  async _requestStatsByCallback(initialError)
  {
    this._compatibility.api.callbackGetStats = true;
    const selectorFirst = this._pc.getStats.length >= 3;
    const attemptTimeoutMs = Math.max(50, Math.min(500, Math.floor(this._options.getStatsTimeoutMs / 2)));

    try
    {
      return await this._callStatsCallback(selectorFirst, attemptTimeoutMs, initialError);
    }
    catch (firstError)
    {
      return this._callStatsCallback(!selectorFirst, attemptTimeoutMs, firstError || initialError);
    }
  }

  _callStatsCallback(selectorFirst, timeoutMs, initialError)
  {
    return new Promise((fulfill, reject) =>
    {
      let settled = false;
      const timeoutId = setTimeout(() =>
      {
        if (!settled)
        {
          settled = true;
          reject(initialError || new Error('getStats callback signature timed out'));
        }
      }, timeoutMs);
      const success = (result) =>
      {
        if (!settled)
        {
          settled = true;
          clearTimeout(timeoutId);
          fulfill(result);
        }
      };
      const failure = (error) =>
      {
        if (!settled)
        {
          settled = true;
          clearTimeout(timeoutId);
          reject(error || initialError || new Error('getStats callback failed'));
        }
      };

      try
      {
        let callbackResult;

        if (selectorFirst)
        {
          // 一部分旧实现使用 getStats(selector, success, failure)。
          callbackResult = this._pc.getStats(null, success, failure);
        }
        else
        {
          // 旧 Chrome 常见签名为 getStats(success, selector)。
          callbackResult = this._pc.getStats(success, null);
        }

        if (callbackResult && typeof callbackResult.then === 'function')
        {
          Promise.resolve(callbackResult).catch(failure);
        }
      }
      catch (error)
      {
        clearTimeout(timeoutId);
        settled = true;
        reject(error || initialError);
      }
    });
  }

  /**
   * 将不同浏览器的报告容器转换为普通对象数组。
   *
   * - standard：现代 RTCStatsReport（MapLike/forEach）；
   * - object：部分 WebView/polyfill 返回的普通对象；
   * - legacy：旧 Chrome result() + stat() 格式。
   *
   * @param {*} rawStats 浏览器原始 getStats 返回值
   * @returns {{reports: object[], format: string}}
   * @private
   */
  _normalize(rawStats)
  {
    const reports = [];
    let format;

    if (rawStats && typeof rawStats.result === 'function')
    {
      format = 'legacy';
      rawStats.result().forEach((report) => reports.push(normalizeLegacyReport(report)));
    }
    else if (rawStats && typeof rawStats.forEach === 'function')
    {
      format = 'standard';
      rawStats.forEach((report) => reports.push(copyReport(report)));
    }
    else if (rawStats && typeof rawStats === 'object')
    {
      format = 'object';
      Object.keys(rawStats).forEach((key) => reports.push(copyReport(rawStats[key])));
    }
    else
    {
      throw new TypeError('Unsupported getStats report format');
    }

    return { reports, format };
  }

  /**
   * 建立索引并组装一份完整报告。
   *
   * 解析顺序保持为“关联对象 -> 媒体流 -> 连接 -> 质量”，这样 codec、
   * media-source、remote RTP 和 candidate 可以通过 id 关联到对应主报告。
   *
   * @private
   */
  _createDetailedReport(reports, getStatsDurationMs, format)
  {
    const byId = new Map();
    const byType = new Map();

    reports.forEach((report) =>
    {
      if (report.id !== undefined && report.id !== null)
      {
        byId.set(String(report.id), report);
      }

      if (!byType.has(report.type))
      {
        byType.set(report.type, []);
      }

      byType.get(report.type).push(report);
    });

    const timestamp = findTimestamp(reports);
    const context = this._readContext();
    const transceivers = this._readTransceivers();
    const selectedPair = findSelectedPair(byType, byId);
    const remoteInboundByLocalId = indexByField(byType.get('remote-inbound-rtp') || [], 'localId');
    const remoteOutboundByLocalId = indexByField(byType.get('remote-outbound-rtp') || [], 'localId');
    const outbound = (byType.get('outbound-rtp') || [])
      .filter((report) => !report.isRemote)
      .map((report) => this._createOutbound(report, byId, remoteInboundByLocalId, context, transceivers));
    const remoteInbound = (byType.get('remote-inbound-rtp') || [])
      .map((report) => this._createRemoteInbound(report, byId));
    const inbound = (byType.get('inbound-rtp') || [])
      .filter((report) => !report.isRemote)
      .map((report) => this._createInbound(report, byId, remoteOutboundByLocalId, context, transceivers));
    const sources = (byType.get('media-source') || []).map((report) => createSource(report));
    const connection = this._createConnection(selectedPair, byId, timestamp);
    const topology = createTopology(outbound, inbound, transceivers, selectedPair.pair);

    if (this._lastTopology !== null && topology !== this._lastTopology)
    {
      this.markTransition('stats-topology-changed');
    }

    this._lastTopology = topology;

    const ready = outbound.some((stream) =>
      stream.comparable && stream.actualBitrateBps !== null) ||
      inbound.some((stream) =>
        stream.comparable && stream.receiveBitrateBps !== null);
    const phase = this._readPhase(ready);
    const detailedReport = {
      timestamp,
      sampleDurationMs : findSampleDuration(outbound, inbound),
      ready,
      phase,
      transition       : phase === 'transitioning' ? {
        reason           : this._transitionReason || 'media-change',
        remainingSamples : this._transitionSamples
      } : null,
      connection,
      sources,
      outbound,
      remoteInbound,
      inbound,
      quality       : null,
      compatibility : null,
      performance   : {
        getStatsDurationMs : rounded(getStatsDurationMs, 3),
        parseDurationMs    : 0,
        reportCount        : reports.length,
        statsFormat        : format
      }
    };

    detailedReport.quality = this._createDetailedQuality(detailedReport, context);

    if (this._transitionSamples > 0)
    {
      this._transitionSamples--;
    }

    this._remember(reports);

    return detailedReport;
  }

  /**
   * 解析本地发送链路：媒体源 -> 编码器/RTP -> 远端接收反馈。
   *
   * 区间指标全部依赖同一 report.id 的前后两份数据；浏览器缺字段、时间戳不前进、
   * 计数器回退时返回 null，避免制造负码率或虚假丢包。
   *
   * @private
   */
  _createOutbound(report, byId, remoteInboundByLocalId, context, transceivers)
  {
    const previous = this._previous.get(String(report.id));
    const seconds = durationSeconds(report, previous);
    const codec = resolve(report.codecId, byId);
    const source = resolve(report.mediaSourceId, byId);
    const remoteReport = resolve(report.remoteId, byId) || remoteInboundByLocalId.get(String(report.id)) || null;
    const transceiver = findTransceiver(transceivers, report.mid, source && source.trackIdentifier, 'sender');
    const sourceInfo = createSourceWithFallback(source, transceiver);
    const packetsSentDelta = delta(report, previous, 'packetsSent');

    return {
      id                                      : String(report.id),
      type                                    : this._classify(report, context, transceiver),
      kind                                    : readKind(report),
      ssrc                                    : valueOrNull(report.ssrc),
      mid                                     : valueOrNull(report.mid),
      rid                                     : valueOrNull(report.rid),
      encodingIndex                           : number(report.encodingIndex),
      active                                  : report.active !== false,
      trackIdentifier                         : (source && source.trackIdentifier) || report.trackIdentifier || readTrackId(transceiver, 'sender'),
      mediaSourceId                           : report.mediaSourceId || null,
      codec                                   : createCodec(codec, report),
      timestamp                               : number(report.timestamp),
      sampleDurationMs                        : seconds === null ? null : rounded(seconds * 1000, 3),
      actualBitrateBps                        : bitrate(report, previous, 'bytesSent'),
      rtpBitrateBps                           : combinedBitrate(report, previous, 'bytesSent', 'headerBytesSent'),
      targetBitrateBps                        : number(report.targetBitrate),
      retransmitBitrateBps                    : bitrate(report, previous, 'retransmittedBytesSent'),
      retransmitPacketPercent                 : percent(delta(report, previous, 'retransmittedPacketsSent'), packetsSentDelta),
      bytesSent                               : number(report.bytesSent),
      headerBytesSent                         : number(report.headerBytesSent),
      retransmittedBytesSent                  : number(report.retransmittedBytesSent),
      packetsSent                             : number(report.packetsSent),
      packetsSentDelta                        : packetsSentDelta,
      retransmittedPacketsSent                : number(report.retransmittedPacketsSent),
      framesSent                              : number(report.framesSent),
      framesEncoded                           : number(report.framesEncoded),
      framesEncodedDelta                      : delta(report, previous, 'framesEncoded'),
      framesPerSecond                         : number(report.framesPerSecond) || number(report.framerateMean),
      frameWidth                              : number(report.frameWidth) === null && sourceInfo ? sourceInfo.width : number(report.frameWidth),
      frameHeight                             : number(report.frameHeight) === null && sourceInfo ? sourceInfo.height : number(report.frameHeight),
      keyFramesEncoded                        : number(report.keyFramesEncoded),
      hugeFramesSent                          : number(report.hugeFramesSent),
      averageEncodeTimeMs                     : average(report, previous, 'totalEncodeTime', 'framesEncoded', 1000),
      averagePacketSendDelayMs                : average(report, previous, 'totalPacketSendDelay', 'packetsSent', 1000),
      averageQp                               : average(report, previous, 'qpSum', 'framesEncoded', 1),
      qpSum                                   : number(report.qpSum),
      qualityLimitationReason                 : report.qualityLimitationReason || null,
      qualityLimitationDurations              : numericObject(report.qualityLimitationDurations),
      qualityLimitationDurationsDelta         : objectDelta(report.qualityLimitationDurations, previous && previous.qualityLimitationDurations),
      qualityLimitationResolutionChangesDelta : delta(report, previous, 'qualityLimitationResolutionChanges'),
      nackCountDelta                          : delta(report, previous, 'nackCount'),
      pliCountDelta                           : delta(report, previous, 'pliCount'),
      firCountDelta                           : delta(report, previous, 'firCount'),
      source                                  : sourceInfo,
      remoteInbound                           : remoteReport ? this._createRemoteInbound(remoteReport, byId) : null,
      comparable                              : seconds !== null
    };
  }

  /**
   * 解析 remote-inbound-rtp，即对端对本端上行 RTP 的接收反馈。
   * 它是判断上行丢包、抖动和 RTT 的优先数据源。
   *
   * @private
   */
  _createRemoteInbound(report, byId)
  {
    const previous = this._previous.get(String(report.id));
    const lostDelta = delta(report, previous, 'packetsLost');
    const receivedDelta = delta(report, previous, 'packetsReceived');
    const fractionLost = number(report.fractionLost);

    return {
      id                  : String(report.id),
      localId             : report.localId || null,
      kind                : readKind(report),
      ssrc                : valueOrNull(report.ssrc),
      codec               : createCodec(resolve(report.codecId, byId), report),
      packetsLost         : number(report.packetsLost),
      packetsReceived     : number(report.packetsReceived),
      intervalLossPercent : fractionLost === null ? lossPercent(lostDelta, receivedDelta) : rounded(Math.max(0, fractionLost) * 100, 2),
      fractionLost,
      jitterMs            : timeMs(report.jitter, report._legacyJitterMs),
      rttMs               : timeMs(report.roundTripTime, report._legacyRttMs),
      averageRttMs        : cumulativeAverage(report.totalRoundTripTime, report.roundTripTimeMeasurements, 1000)
    };
  }

  /**
   * 解析远端发送到本地的下行链路，重点计算接收码率、区间丢包、
   * jitter buffer、解码耗时、丢帧和卡顿等指标。
   *
   * @private
   */
  _createInbound(report, byId, remoteOutboundByLocalId, context, transceivers)
  {
    const previous = this._previous.get(String(report.id));
    const seconds = durationSeconds(report, previous);
    const transceiver = findTransceiver(transceivers, report.mid, report.trackIdentifier, 'receiver');
    const lostDelta = delta(report, previous, 'packetsLost');
    const receivedDelta = delta(report, previous, 'packetsReceived');
    const droppedDelta = delta(report, previous, 'framesDropped');
    const decodedDelta = delta(report, previous, 'framesDecoded');
    const remoteReport = resolve(report.remoteId, byId) || remoteOutboundByLocalId.get(String(report.id)) || null;

    return {
      id                                : String(report.id),
      type                              : this._classify(report, context, transceiver),
      kind                              : readKind(report),
      ssrc                              : valueOrNull(report.ssrc),
      mid                               : valueOrNull(report.mid),
      trackIdentifier                   : report.trackIdentifier || readTrackId(transceiver, 'receiver'),
      codec                             : createCodec(resolve(report.codecId, byId), report),
      timestamp                         : number(report.timestamp),
      sampleDurationMs                  : seconds === null ? null : rounded(seconds * 1000, 3),
      receiveBitrateBps                 : bitrate(report, previous, 'bytesReceived'),
      rtpBitrateBps                     : combinedBitrate(report, previous, 'bytesReceived', 'headerBytesReceived'),
      bytesReceived                     : number(report.bytesReceived),
      headerBytesReceived               : number(report.headerBytesReceived),
      packetsReceived                   : number(report.packetsReceived),
      packetsLost                       : number(report.packetsLost),
      intervalLossPercent               : lossPercent(lostDelta, receivedDelta),
      packetsDiscarded                  : number(report.packetsDiscarded),
      packetsDiscardedDelta             : delta(report, previous, 'packetsDiscarded'),
      jitterMs                          : timeMs(report.jitter, report._legacyJitterMs),
      framesReceived                    : number(report.framesReceived),
      framesDecoded                     : number(report.framesDecoded),
      framesDecodedDelta                : decodedDelta,
      framesRendered                    : number(report.framesRendered),
      framesDropped                     : number(report.framesDropped),
      droppedFramePercent               : lossPercent(droppedDelta, decodedDelta),
      framesPerSecond                   : number(report.framesPerSecond) || number(report.framerateMean),
      frameWidth                        : number(report.frameWidth),
      frameHeight                       : number(report.frameHeight),
      averageDecodeTimeMs               : average(report, previous, 'totalDecodeTime', 'framesDecoded', 1000),
      averageProcessingDelayMs          : average(report, previous, 'totalProcessingDelay', 'framesDecoded', 1000),
      averageJitterBufferDelayMs        : average(report, previous, 'jitterBufferDelay', 'jitterBufferEmittedCount', 1000),
      averageJitterBufferTargetDelayMs  : average(report, previous, 'jitterBufferTargetDelay', 'jitterBufferEmittedCount', 1000),
      averageJitterBufferMinimumDelayMs : average(report, previous, 'jitterBufferMinimumDelay', 'jitterBufferEmittedCount', 1000),
      jitterBufferEmittedCount          : number(report.jitterBufferEmittedCount),
      freezeCount                       : number(report.freezeCount),
      freezeCountDelta                  : delta(report, previous, 'freezeCount'),
      totalFreezesDuration              : number(report.totalFreezesDuration),
      freezesDurationDeltaMs            : multiplied(delta(report, previous, 'totalFreezesDuration'), 1000),
      pauseCount                        : number(report.pauseCount),
      pauseCountDelta                   : delta(report, previous, 'pauseCount'),
      totalPausesDuration               : number(report.totalPausesDuration),
      pausesDurationDeltaMs             : multiplied(delta(report, previous, 'totalPausesDuration'), 1000),
      nackCountDelta                    : delta(report, previous, 'nackCount'),
      pliCountDelta                     : delta(report, previous, 'pliCount'),
      firCountDelta                     : delta(report, previous, 'firCount'),
      retransmittedPacketsReceived      : number(report.retransmittedPacketsReceived),
      retransmittedPacketsReceivedDelta : delta(report, previous, 'retransmittedPacketsReceived'),
      retransmittedBytesReceived        : number(report.retransmittedBytesReceived),
      retransmittedBytesReceivedDelta   : delta(report, previous, 'retransmittedBytesReceived'),
      retransmitReceiveBitrateBps       : bitrate(report, previous, 'retransmittedBytesReceived'),
      fecPacketsReceived                : number(report.fecPacketsReceived),
      fecPacketsReceivedDelta           : delta(report, previous, 'fecPacketsReceived'),
      fecPacketsDiscarded               : number(report.fecPacketsDiscarded),
      fecPacketsDiscardedDelta          : delta(report, previous, 'fecPacketsDiscarded'),
      fecBytesReceived                  : number(report.fecBytesReceived),
      fecBytesReceivedDelta             : delta(report, previous, 'fecBytesReceived'),
      fecReceiveBitrateBps              : bitrate(report, previous, 'fecBytesReceived'),
      remoteOutbound                    : createRemoteOutbound(remoteReport),
      comparable                        : seconds !== null
    };
  }

  /**
   * 解析当前选中的 ICE candidate-pair 与 transport。
   * 优先使用 transport.selectedCandidatePairId，缺失时再回退 nominated+succeeded。
   *
   * @private
   */
  _createConnection(selected, byId, timestamp)
  {
    const pair = selected.pair;
    const previous = pair && this._previous.get(String(pair.id));
    const transport = selected.transport;
    const previousTransport = transport && this._previous.get(String(transport.id));

    return {
      connectionState                   : readConnectionState(this._pc),
      iceConnectionState                : this._pc.iceConnectionState || null,
      iceGatheringState                 : this._pc.iceGatheringState || null,
      signalingState                    : this._pc.signalingState || null,
      dtlsState                         : (transport && transport.dtlsState) || null,
      iceState                          : (transport && transport.iceState) || null,
      selectedCandidatePairId           : (pair && pair.id) || null,
      candidatePairSelection            : selected.method,
      candidatePairState                : (pair && pair.state) || null,
      candidatePairNominated            : pair ? pair.nominated === true : null,
      localCandidateId                  : (pair && pair.localCandidateId) || null,
      remoteCandidateId                 : (pair && pair.remoteCandidateId) || null,
      selectedCandidatePairChanges      : transport ? number(transport.selectedCandidatePairChanges) : null,
      selectedCandidatePairChangesDelta : transport ? delta(transport, previousTransport, 'selectedCandidatePairChanges') : null,
      rttMs                             : pair ? timeMs(pair.currentRoundTripTime, pair._legacyRttMs) : null,
      averageRttMs                      : pair ? cumulativeAverage(pair.totalRoundTripTime, pair.responsesReceived, 1000) : null,
      availableOutgoingBitrateBps       : pair ? number(pair.availableOutgoingBitrate) : null,
      availableIncomingBitrateBps       : pair ? number(pair.availableIncomingBitrate) : null,
      sendBitrateBps                    : pair ? bitrate(pair, previous, 'bytesSent') : null,
      receiveBitrateBps                 : pair ? bitrate(pair, previous, 'bytesReceived') : null,
      bytesSent                         : pair ? number(pair.bytesSent) : null,
      bytesReceived                     : pair ? number(pair.bytesReceived) : null,
      packetsSent                       : pair ? number(pair.packetsSent) : null,
      packetsReceived                   : pair ? number(pair.packetsReceived) : null,
      packetsDiscardedOnSend            : pair ? number(pair.packetsDiscardedOnSend) : null,
      packetsDiscardedOnSendDelta       : pair ? delta(pair, previous, 'packetsDiscardedOnSend') : null,
      bytesDiscardedOnSend              : pair ? number(pair.bytesDiscardedOnSend) : null,
      bytesDiscardedOnSendDelta         : pair ? delta(pair, previous, 'bytesDiscardedOnSend') : null,
      lastPacketSentAgoMs               : pair ? age(timestamp, pair.lastPacketSentTimestamp) : null,
      lastPacketReceivedAgoMs           : pair ? age(timestamp, pair.lastPacketReceivedTimestamp) : null,
      localCandidate                    : pair ? createCandidate(resolve(pair.localCandidateId, byId)) : null,
      remoteCandidate                   : pair ? createCandidate(resolve(pair.remoteCandidateId, byId)) : null
    };
  }

  /**
   * 把详细流报告投影为旧 report 事件结构。
   *
   * 这里有意保留音频/视频对象各自的历史字段集合；只修正计算口径，并按用户约定
   * 将 speed 统一为 number，避免旧业务监听器迁移时需要同时改字段路径。
   *
   * @private
   */
  _createLegacyReport(report)
  {
    const outbound = groupByType(report.outbound);
    const inbound = groupByType(report.inbound);
    const upStreams = [];
    const downStreams = [];

    [ 'audio', 'video', 'shared' ].forEach((type) =>
    {
      const up = outbound[type] || [];
      const down = inbound[type] || [];

      if (up.length > 0)
      {
        up.forEach((stream) => upStreams.push(createLegacyOutbound(type, stream)));
      }
      else if (type === 'audio')
      {
        upStreams.push(createLegacyOutbound(type, null));
      }

      if (down.length > 0)
      {
        down.forEach((stream) => downStreams.push(createLegacyInbound(type, stream)));
      }
      else if (type === 'audio')
      {
        downStreams.push(createLegacyInbound(type, null));
      }
    });

    return {
      // 与 network-quality、detailed-report.quality 使用同一份当前网络快照。
      RTT : report.quality.RTT,
      upStreams,
      downStreams
    };
  }

  /**
   * 将 detailed-report.quality 中已经计算完成的网络快照投影为旧事件结构。
   * 这里不再二次更新滑动窗口，保证三个事件的重叠字段来自同一轮计算。
   *
   * @private
   */
  _createNetworkQuality(report)
  {
    const quality = report.quality;

    return {
      uplinkNetworkQuality   : quality.uplinkNetworkQuality,
      RTT                    : quality.RTT,
      uplinkLoss             : quality.uplinkLoss,
      downlinkNetworkQuality : quality.downlinkNetworkQuality,
      downlinkLoss           : quality.downlinkLoss
    };
  }

  /**
   * 普通日志只保留通话浮层和常规排障所需字段，避免每个采样周期输出
   * candidate 地址、累计计数器和关联对象等完整诊断数据。
   * 完整报告仍可通过 getLatestReport() 获取。
   *
   * @private
   */
  _createDetailedLogReport(report)
  {
    const compactCandidate = (candidate) =>
    {
      if (!candidate)
      {
        return null;
      }

      return {
        candidateType : candidate.candidateType,
        protocol      : candidate.protocol,
        relayProtocol : candidate.relayProtocol
      };
    };

    return {
      compatibility    : report.compatibility ? { level: report.compatibility.level } : null,
      phase            : report.phase,
      ready            : report.ready,
      sampleDurationMs : report.sampleDurationMs,
      connection       : {
        connectionState             : report.connection.connectionState,
        iceConnectionState          : report.connection.iceConnectionState,
        dtlsState                   : report.connection.dtlsState,
        rttMs                       : report.connection.rttMs,
        sendBitrateBps              : report.connection.sendBitrateBps,
        availableOutgoingBitrateBps : report.connection.availableOutgoingBitrateBps,
        receiveBitrateBps           : report.connection.receiveBitrateBps,
        availableIncomingBitrateBps : report.connection.availableIncomingBitrateBps,
        candidatePath               : {
          state  : report.connection.candidatePairState,
          local  : compactCandidate(report.connection.localCandidate),
          remote : compactCandidate(report.connection.remoteCandidate)
        }
      },
      outbound : report.outbound.map((stream) => ({
        type                    : stream.type,
        mid                     : stream.mid,
        codec                   : stream.codec ? stream.codec.name : null,
        actualBitrateBps        : stream.actualBitrateBps,
        lossPercent             : stream.remoteInbound ? stream.remoteInbound.intervalLossPercent : null,
        jitterMs                : stream.remoteInbound ? stream.remoteInbound.jitterMs : null,
        rttMs                   : stream.remoteInbound ? stream.remoteInbound.rttMs : null,
        framesPerSecond         : stream.framesPerSecond,
        frameWidth              : stream.frameWidth,
        frameHeight             : stream.frameHeight,
        averageEncodeTimeMs     : stream.averageEncodeTimeMs,
        qualityLimitationReason : stream.qualityLimitationReason
      })),
      inbound : report.inbound.map((stream) => ({
        type                       : stream.type,
        mid                        : stream.mid,
        codec                      : stream.codec ? stream.codec.name : null,
        receiveBitrateBps          : stream.receiveBitrateBps,
        lossPercent                : stream.intervalLossPercent,
        jitterMs                   : stream.jitterMs,
        averageJitterBufferDelayMs : stream.averageJitterBufferDelayMs,
        framesPerSecond            : stream.framesPerSecond,
        frameWidth                 : stream.frameWidth,
        frameHeight                : stream.frameHeight,
        averageDecodeTimeMs        : stream.averageDecodeTimeMs,
        droppedFramePercent        : stream.droppedFramePercent
      })),
      quality : {
        RTT                    : report.quality.RTT,
        uplinkLoss             : report.quality.uplinkLoss,
        downlinkLoss           : report.quality.downlinkLoss,
        uplinkNetworkQuality   : report.quality.uplinkNetworkQuality,
        downlinkNetworkQuality : report.quality.downlinkNetworkQuality,
        uplinkMediaQuality     : report.quality.uplinkMediaQuality,
        downlinkMediaQuality   : report.quality.downlinkMediaQuality,
        issues                 : report.quality.issues.map((reportIssue) => ({
          code     : reportIssue.code,
          severity : reportIssue.severity
        }))
      },
      performance : {
        getStatsDurationMs : report.performance.getStatsDurationMs,
        parseDurationMs    : report.performance.parseDurationMs,
        reportCount        : report.performance.reportCount,
        statsFormat        : report.performance.statsFormat
      }
    };
  }

  /**
   * 事件只反馈 Demo 和常规监控需要的字段，避免把完整诊断对象持续传给业务层。
   * 完整报告可通过 getLatestReport() 获取。
   *
   * @private
   */
  _createDetailedEventReport(report)
  {
    return {
      connection : {
        connectionState             : report.connection.connectionState,
        iceConnectionState          : report.connection.iceConnectionState,
        dtlsState                   : report.connection.dtlsState,
        sendBitrateBps              : report.connection.sendBitrateBps,
        availableOutgoingBitrateBps : report.connection.availableOutgoingBitrateBps,
        receiveBitrateBps           : report.connection.receiveBitrateBps,
        availableIncomingBitrateBps : report.connection.availableIncomingBitrateBps
      },
      outbound : report.outbound.map((stream) => ({
        type                    : stream.type,
        kind                    : stream.kind,
        mid                     : stream.mid,
        codec                   : stream.codec ? { name: stream.codec.name } : null,
        actualBitrateBps        : stream.actualBitrateBps,
        framesPerSecond         : stream.framesPerSecond,
        frameWidth              : stream.frameWidth,
        frameHeight             : stream.frameHeight,
        averageEncodeTimeMs     : stream.averageEncodeTimeMs,
        qualityLimitationReason : stream.qualityLimitationReason,
        remoteInbound           : stream.remoteInbound ? {
          jitterMs            : stream.remoteInbound.jitterMs,
          intervalLossPercent : stream.remoteInbound.intervalLossPercent
        } : null
      })),
      inbound : report.inbound.map((stream) => ({
        type                : stream.type,
        kind                : stream.kind,
        mid                 : stream.mid,
        codec               : stream.codec ? { name: stream.codec.name } : null,
        receiveBitrateBps   : stream.receiveBitrateBps,
        jitterMs            : stream.jitterMs,
        intervalLossPercent : stream.intervalLossPercent,
        framesPerSecond     : stream.framesPerSecond,
        frameWidth          : stream.frameWidth,
        frameHeight         : stream.frameHeight,
        averageDecodeTimeMs : stream.averageDecodeTimeMs
      })),
      quality : {
        RTT                    : report.quality.RTT,
        uplinkNetworkQuality   : report.quality.uplinkNetworkQuality,
        downlinkNetworkQuality : report.quality.downlinkNetworkQuality,
        issues                 : report.quality.issues.map((eventIssue) => ({
          code     : eventIssue.code,
          severity : eventIssue.severity
        }))
      }
    };
  }

  /**
   * 生成 detailed-report 中的媒体质量诊断。
   *
   * 网络等级与媒体问题分开：网络可能正常，但编码器仍可能因 CPU 或带宽限制降级。
   * transition 期间暂缓瞬时问题诊断，避免 replaceTrack/重协商产生误报。
   *
   * @private
   */
  _createDetailedQuality(report, context)
  {
    const issues = [];
    const currentNetwork = currentNetworkSample(report);

    // RTT 和丢包率使用当前采样，避免多样本平均掩盖用户正在感受的瞬时劣化。
    const network = currentNetwork;
    const unavailable = report.connection.connectionState === 'failed' || report.connection.connectionState === 'closed';

    // 媒体刚变化时先等待新基线稳定，避免换轨和重协商产生瞬时误报。
    if (report.phase !== 'transitioning')
    {
      report.outbound.forEach((stream) => collectOutboundIssues(stream, issues));
      report.inbound.forEach((stream) => collectInboundIssues(stream, issues));
      collectConnectionIssues(report, issues, context);

      if (network.rtt !== null && network.rtt > 200)
      {
        issues.push(issue('HIGH_RTT', network.rtt > 500 ? 6 : 4, null, { rttMs: network.rtt }));
      }
    }

    if (report.connection.connectionState === 'failed' || report.connection.connectionState === 'closed')
    {
      issues.push(issue('CONNECTION_UNAVAILABLE', 6, null, { connectionState: report.connection.connectionState }));
    }

    const uplinkNetworkQuality = unavailable ? 6 : networkQuality(network.uplinkLoss, network.rtt, network.hasUplink);
    const downlinkNetworkQuality = unavailable ? 6 : networkQuality(network.downlinkLoss, network.rtt, network.hasDownlink);

    return {
      uplinkNetworkQuality,
      downlinkNetworkQuality,
      RTT                  : network.rtt === null ? 0 : Math.floor(network.rtt),
      uplinkLoss           : network.uplinkLoss === null ? 0 : Math.floor(network.uplinkLoss),
      downlinkLoss         : network.downlinkLoss === null ? 0 : Math.floor(network.downlinkLoss),
      uplinkMediaQuality   : mediaQuality(uplinkNetworkQuality, issues, 'uplink'),
      downlinkMediaQuality : mediaQuality(downlinkNetworkQuality, issues, 'downlink'),
      sampleReady          : network.hasData,
      issues,
      context              : cleanContext(context)
    };
  }

  _classify(report, context, transceiver)
  {
    if (typeof this._options.streamClassifier === 'function')
    {
      try
      {
        const result = this._options.streamClassifier({ report, context, transceiver });

        if (result)
        {
          return result;
        }
      }
      catch (error)
      {
        this._emitStatsError('STREAM_CLASSIFIER_FAILED', error, false);
      }
    }

    const kind = readKind(report);

    if (kind === 'video' && context.sharedMid !== undefined && context.sharedMid !== null && String(report.mid) === String(context.sharedMid))
    {
      return 'shared';
    }

    return kind || 'unknown';
  }

  _readContext()
  {
    if (typeof this._options.contextProvider !== 'function')
    {
      return {};
    }

    try
    {
      return this._options.contextProvider() || {};
    }
    catch (error)
    {
      this._emitStatsError('CONTEXT_PROVIDER_FAILED', error, false);

      return {};
    }
  }

  _readTransceivers()
  {
    if (!this._pc || typeof this._pc.getTransceivers !== 'function')
    {
      return [];
    }

    try
    {
      return this._pc.getTransceivers() || [];
    }
    catch (error)
    {
      return [];
    }
  }

  _readPhase(ready)
  {
    const state = readConnectionState(this._pc);

    if (state === 'closed')
    {
      return 'stopped';
    }

    if (state === 'failed' || state === 'disconnected')
    {
      return 'reconnecting';
    }

    if (this._transitionSamples > 0)
    {
      return 'transitioning';
    }

    return ready ? 'active' : 'warming-up';
  }

  /**
   * 保存本次原始报告作为下一周期基线，并移除已经消失的 report id。
   * 这既适配重协商后的 SSRC/编码层变化，也避免长通话中 Map 无限增长。
   *
   * @private
   */
  _remember(reports)
  {
    const currentIds = new Set();

    reports.forEach((report) =>
    {
      if (report.id === undefined || report.id === null)
      {
        return;
      }

      const id = String(report.id);

      currentIds.add(id);
      this._previous.set(id, report);
    });

    // 清除协商后已经消失的旧 report，避免长通话中 Map 持续增长。
    Array.from(this._previous.keys()).forEach((id) =>
    {
      if (!currentIds.has(id))
      {
        this._previous.delete(id);
      }
    });
  }

  /**
   * 根据实际观察到的报告类型和字段自动更新兼容等级。
   *
   * observed 集合跨样本累积，因为音视频 RTP、transport 和远端反馈未必会在
   * 同一份报告中同时出现；一旦浏览器证明支持某字段，就保留该能力结论。
   *
   * @private
   */
  _updateCompatibility(reports, format)
  {
    this._statsFormat = format;

    if (format === 'legacy')
    {
      this._compatibility.level = LEVEL.LEGACY_BASIC;

      return;
    }

    this._compatibility.api.standardStatsReport = format === 'standard';

    reports.forEach((report) =>
    {
      report.type && this._observedTypes.add(report.type);
      observeFeatures(report, this._observedFeatures);
    });

    const hasTransport = this._observedTypes.has('transport') && this._observedTypes.has('candidate-pair');
    const hasRtp = this._observedTypes.has('outbound-rtp') || this._observedTypes.has('inbound-rtp');
    const hasAdvanced = this._observedFeatures.has('remoteInboundRtp') || this._observedFeatures.has('qualityLimitationReason') || this._observedFeatures.has('jitterBufferDelay');

    this._compatibility.level = hasTransport && hasRtp && hasAdvanced ? LEVEL.FULL : LEVEL.PARTIAL;
  }

  _compatibilitySnapshot()
  {
    return {
      level              : this._compatibility.level,
      api                : Object.assign({}, this._compatibility.api),
      observedStatsTypes : Array.from(this._observedTypes).sort(),
      observedFeatures   : featureSnapshot(this._observedFeatures),
      statsFormat        : this._statsFormat
    };
  }

  _logRawStats(timestamp, reports)
  {
    if (!this._options.enableRawStatsLog)
    {
      return;
    }

    if (this._lastRawLogTimestamp !== null && timestamp - this._lastRawLogTimestamp < this._options.rawStatsLogIntervalMs)
    {
      return;
    }

    try
    {
      const sanitizedReports = sanitizeRawStats(reports);
      const serialized = safeJsonStringify(sanitizedReports);

      this._lastRawLogTimestamp = timestamp;
      logger.debug(`raw stats: ${serialized}`);
    }
    catch (error)
    {
      logger.warn(`raw stats logging failed: ${error.message || String(error)}`);
    }
  }

  _safeEmit(eventName, payload)
  {
    try { this.emit(eventName, payload); }
    catch (error) { logger.warn(`${eventName} listener failed: ${error.message || String(error)}`); }
  }

  _emitStatsError(code, error, fatal)
  {
    const event = {
      code,
      fatal             : Boolean(fatal),
      message           : error && error.message ? error.message : String(error),
      error             : error || null,
      consecutiveErrors : this._consecutiveErrors
    };

    logger.warn(`${code}: ${event.message}`);
    this._safeEmit('stats-error', event);
  }
};

function cloneSnapshot(value, seen)
{
  if (value === null || value === undefined || typeof value !== 'object')
  {
    return value;
  }

  seen = seen || new Map();
  if (seen.has(value)) return seen.get(value);

  if (value instanceof Array)
  {
    const snapshot = [];

    seen.set(value, snapshot);
    value.forEach((item) => snapshot.push(cloneSnapshot(item, seen)));

    return snapshot;
  }

  const snapshot = {};

  seen.set(value, snapshot);
  Object.keys(value).forEach((key) =>
  {
    snapshot[key] = cloneSnapshot(value[key], seen);
  });

  return snapshot;
}

function sanitizeRawStats(reports)
{
  const privateFields = {
    address          : true,
    ip               : true,
    ipaddress        : true,
    port             : true,
    relatedaddress   : true,
    relatedport      : true,
    localaddress     : true,
    localport        : true,
    remoteaddress    : true,
    remoteport       : true,
    url              : true,
    usernamefragment : true
  };

  return (reports || []).map((report) => Object.keys(report || {}).reduce((sanitized, key) =>
  {
    sanitized[key] = privateFields[String(key).toLowerCase()] ? '[redacted]' : report[key];

    return sanitized;
  }, {}));
}

function safeJsonStringify(value)
{
  const seen = new Set();

  return JSON.stringify(value, (key, item) =>
  {
    if (Object.prototype.toString.call(item) === '[object BigInt]') return item.toString();
    if (!item || typeof item !== 'object') return item;
    if (seen.has(item)) return '[Circular]';
    seen.add(item);

    return item;
  });
}

function monotonicNow()
{
  if (typeof performance !== 'undefined' && typeof performance.now === 'function')
  {
    return performance.now();
  }

  return Date.now();
}

function number(value)
{
  if (typeof value === 'number' && isFinite(value))
  {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '')
  {
    const result = Number(value);

    return isFinite(result) ? result : null;
  }

  return null;
}

function rounded(value, digits = 2)
{
  if (number(value) === null)
  {
    return null;
  }

  const factor = Math.pow(10, digits);

  return Math.round(value * factor) / factor;
}

function multiplied(value, multiplier)
{
  return value === null ? null : rounded(value * multiplier, 3);
}

function valueOrNull(value)
{
  return value === undefined ? null : value;
}

function copyReport(report)
{
  const result = {};

  if (!report || typeof report !== 'object')
  {
    return result;
  }

  Object.keys(report).forEach((key) =>
  {
    result[key] = report[key];
  });

  [ 'id', 'type', 'timestamp' ].forEach((key) =>
  {
    if (result[key] === undefined && report[key] !== undefined)
    {
      result[key] = report[key];
    }
  });

  return result;
}

function normalizeLegacyReport(report)
{
  const result = {
    id        : report.id,
    type      : report.type,
    timestamp : number(report.timestamp) || Date.now()
  };

  if (typeof report.names === 'function' && typeof report.stat === 'function')
  {
    report.names().forEach((name) =>
    {
      result[name] = report.stat(name);
    });
  }

  const originalType = String(result.type || '').toLowerCase();

  if (originalType === 'ssrc')
  {
    if (result.bytesSent !== undefined)
    {
      result.type = 'outbound-rtp';
      result.frameWidth = number(result.frameWidth) || number(result.googFrameWidthSent);
      result.frameHeight = number(result.frameHeight) || number(result.googFrameHeightSent);
      result.framesPerSecond = number(result.framesPerSecond) || number(result.googFrameRateSent);
    }
    else if (result.bytesReceived !== undefined)
    {
      result.type = 'inbound-rtp';
      result.frameWidth = number(result.frameWidth) || number(result.googFrameWidthReceived);
      result.frameHeight = number(result.frameHeight) || number(result.googFrameHeightReceived);
      result.framesPerSecond = number(result.framesPerSecond) || number(result.googFrameRateReceived);
      result._legacyJitterMs = number(result.googJitterReceived);
    }

    result.kind = result.mediaType || result.kind || (result.frameWidth ? 'video' : 'audio');
    result.mimeType = result.mimeType || result.googCodecName || null;
  }
  else if (originalType === 'googcandidatepair' || originalType === 'candidatepair')
  {
    result.type = 'candidate-pair';
    result.selected = String(result.googActiveConnection) === 'true';
    result.nominated = result.selected;
    result.state = result.selected ? 'succeeded' : null;
    result._legacyRttMs = number(result.googRtt);
  }
  else if (originalType === 'localcandidate')
  {
    result.type = 'local-candidate';
  }
  else if (originalType === 'remotecandidate')
  {
    result.type = 'remote-candidate';
  }

  Object.keys(result).forEach((key) =>
  {
    const numericValue = number(result[key]);

    if (numericValue !== null && key !== 'id' && key !== 'type')
    {
      result[key] = numericValue;
    }
  });

  return result;
}

function readKind(report)
{
  const kind = report && (report.kind || report.mediaType);

  if (kind)
  {
    return String(kind).toLowerCase();
  }

  if (report && report.mimeType)
  {
    return String(report.mimeType).toLowerCase()
      .indexOf('video') !== -1 ? 'video' : 'audio';
  }

  return null;
}

function delta(current, previous, key)
{
  if (!current || !previous)
  {
    return null;
  }

  const currentValue = number(current[key]);
  const previousValue = number(previous[key]);

  if (currentValue === null || previousValue === null || currentValue < previousValue)
  {
    return null;
  }

  return currentValue - previousValue;
}

/**
 * 使用报告自身 timestamp 计算实际采样时长。
 *
 * setTimeout 在后台页、低性能设备和主线程繁忙时会漂移，因此不能直接把配置的
 * 1 秒间隔当作分母。时间戳缺失或倒退时返回 null，让调用方重建基线。
 */
function durationSeconds(current, previous)
{
  if (!current || !previous)
  {
    return null;
  }

  const currentTimestamp = number(current.timestamp);
  const previousTimestamp = number(previous.timestamp);

  if (currentTimestamp === null || previousTimestamp === null)
  {
    return null;
  }

  const result = (currentTimestamp - previousTimestamp) / 1000;

  return result > 0 ? result : null;
}

/**
 * 将累计字节差换算为 bit/s。计数器缺失或回退时返回 null。
 */
function bitrate(current, previous, key)
{
  const seconds = durationSeconds(current, previous);
  const bytes = delta(current, previous, key);

  return seconds === null || bytes === null ? null : rounded(bytes * 8 / seconds, 2);
}

function combinedBitrate(current, previous, payloadKey, headerKey)
{
  const seconds = durationSeconds(current, previous);
  const payload = delta(current, previous, payloadKey);
  let header = delta(current, previous, headerKey);

  if (seconds === null || payload === null)
  {
    return null;
  }

  header === null && (header = 0);

  return rounded((payload + header) * 8 / seconds, 2);
}

function average(current, previous, totalKey, countKey, multiplier)
{
  const total = delta(current, previous, totalKey);
  const count = delta(current, previous, countKey);

  return total === null || count === null || count <= 0 ? null : rounded(total / count * multiplier, 3);
}

function cumulativeAverage(total, count, multiplier)
{
  const totalValue = number(total);
  const countValue = number(count);

  return totalValue === null || countValue === null || countValue <= 0 ? null : rounded(totalValue / countValue * multiplier, 3);
}

function percent(part, total)
{
  return part === null || total === null || total <= 0 ? null : rounded(Math.max(0, part) * 100 / total, 2);
}

function lossPercent(lost, received)
{
  if (lost === null || received === null)
  {
    return null;
  }

  const total = Math.max(0, lost) + Math.max(0, received);

  return total > 0 ? rounded(Math.max(0, lost) * 100 / total, 2) : 0;
}

function objectDelta(current, previous)
{
  if (!current || !previous)
  {
    return null;
  }

  const result = {};

  Object.keys(current).forEach((key) =>
  {
    const currentValue = number(current[key]);
    const previousValue = number(previous[key]);

    result[key] = currentValue === null || previousValue === null || currentValue < previousValue ? null : rounded(currentValue - previousValue, 3);
  });

  return result;
}

/**
 * 复制浏览器返回的数值对象，同时过滤 undefined、NaN 和字符串等不稳定值。
 * qualityLimitationDurations 属于累计对象，原值用于展示，增量值用于本轮诊断。
 */
function numericObject(input)
{
  if (!input || typeof input !== 'object')
  {
    return null;
  }

  const result = {};

  Object.keys(input).forEach((key) =>
  {
    const value = number(input[key]);

    if (value !== null)
    {
      result[key] = value;
    }
  });

  return Object.keys(result).length > 0 ? result : null;
}

function resolve(id, byId)
{
  return id === undefined || id === null ? null : byId.get(String(id)) || null;
}

function createCodec(codec, report)
{
  const mimeType = (codec && codec.mimeType) || report.mimeType || null;

  return {
    mimeType,
    name : mimeType ? String(mimeType).split('/')
      .pop() : null,
    payloadType : codec ? number(codec.payloadType) : number(report.payloadType),
    clockRate   : codec ? number(codec.clockRate) : null,
    channels    : codec ? number(codec.channels) : null,
    sdpFmtpLine : (codec && codec.sdpFmtpLine) || null
  };
}

function createSource(report)
{
  return {
    id              : report.id || null,
    kind            : readKind(report),
    trackIdentifier : report.trackIdentifier || null,
    width           : number(report.width),
    height          : number(report.height),
    frames          : number(report.frames),
    framesPerSecond : number(report.framesPerSecond)
  };
}

function createSourceWithFallback(source, transceiver)
{
  const track = transceiver && transceiver.sender && transceiver.sender.track;
  const settings = readTrackSettings(track);

  if (!source && !settings)
  {
    return null;
  }

  return {
    id              : (source && source.id) || null,
    trackIdentifier : (source && source.trackIdentifier) || (track && track.id) || null,
    width           : source ? number(source.width) : settings.width,
    height          : source ? number(source.height) : settings.height,
    framesPerSecond : source ? number(source.framesPerSecond) : settings.frameRate,
    origin          : source ? 'media-source' : 'track-settings'
  };
}

function createRemoteOutbound(report)
{
  return report ? {
    id              : report.id || null,
    remoteTimestamp : number(report.remoteTimestamp),
    reportsSent     : number(report.reportsSent),
    bytesSent       : number(report.bytesSent),
    packetsSent     : number(report.packetsSent),
    roundTripTimeMs : timeMs(report.roundTripTime)
  } : null;
}

function timeMs(secondsValue, legacyMsValue)
{
  const seconds = number(secondsValue);

  return seconds === null ? number(legacyMsValue) : rounded(seconds * 1000, 2);
}

function findTimestamp(reports)
{
  let timestamp = null;

  reports.forEach((report) =>
  {
    const value = number(report.timestamp);

    if (value !== null && (timestamp === null || value > timestamp))
    {
      timestamp = value;
    }
  });

  return timestamp === null ? Date.now() : timestamp;
}

function findSelectedPair(byType, byId)
{
  const transports = byType.get('transport') || [];

  for (const transport of transports)
  {
    const pair = resolve(transport.selectedCandidatePairId, byId);

    if (pair)
    {
      return { pair, transport, method: 'transport' };
    }
  }

  const pairs = byType.get('candidate-pair') || [];
  const selected = pairs.find((pair) => pair.selected === true) || pairs.find((pair) => (pair.nominated === true && pair.state === 'succeeded')) || null;

  return { pair: selected, transport: null, method: selected ? 'fallback' : 'unavailable' };
}

function indexByField(reports, field)
{
  const result = new Map();

  reports.forEach((report) =>
  {
    if (report[field] !== undefined && report[field] !== null)
    {
      result.set(String(report[field]), report);
    }
  });

  return result;
}

function createCandidate(candidate)
{
  return candidate ? {
    id             : candidate.id || null,
    candidateType  : candidate.candidateType || null,
    protocol       : candidate.protocol || null,
    relayProtocol  : candidate.relayProtocol || null,
    address        : candidate.address || candidate.ip || null,
    port           : number(candidate.port),
    url            : candidate.url || null,
    relatedAddress : candidate.relatedAddress || null,
    relatedPort    : number(candidate.relatedPort)
  } : null;
}

function age(currentTimestamp, eventTimestamp)
{
  const current = number(currentTimestamp);
  const event = number(eventTimestamp);

  return current === null || event === null || current < event ? null : rounded(current - event, 2);
}

function readConnectionState(pc)
{
  return pc.connectionState || pc.iceConnectionState || null;
}

function readTrackSettings(track)
{
  if (!track || typeof track.getSettings !== 'function')
  {
    return null;
  }

  try
  {
    const settings = track.getSettings() || {};

    return {
      width     : number(settings.width),
      height    : number(settings.height),
      frameRate : number(settings.frameRate)
    };
  }
  catch (error)
  {
    return null;
  }
}

function readTrackId(transceiver, side)
{
  const endpoint = transceiver && transceiver[side];

  return (endpoint && endpoint.track && endpoint.track.id) || null;
}

function findTransceiver(transceivers, mid, trackIdentifier, side)
{
  return transceivers.find((transceiver) =>
  {
    if (mid !== undefined && mid !== null && transceiver.mid !== undefined && transceiver.mid !== null && String(mid) === String(transceiver.mid))
    {
      return true;
    }

    return Boolean(trackIdentifier && readTrackId(transceiver, side) === trackIdentifier);
  }) || null;
}

function createTopology(outbound, inbound, transceivers, pair)
{
  const parts = [];

  outbound.forEach((stream) => parts.push(`o:${stream.id}:${stream.mid}:${stream.trackIdentifier}:${stream.active}`));
  inbound.forEach((stream) => parts.push(`i:${stream.id}:${stream.mid}:${stream.trackIdentifier}`));
  transceivers.forEach((transceiver) => parts.push(`t:${transceiver.mid}:${transceiver.currentDirection || transceiver.direction}:${readTrackId(transceiver, 'sender')}:${readTrackId(transceiver, 'receiver')}`));
  pair && parts.push(`p:${pair.id}`);

  return parts.sort().join('|');
}

function findSampleDuration(outbound, inbound)
{
  const durations = [];

  outbound.concat(inbound).forEach((stream) =>
  {
    stream.sampleDurationMs !== null && durations.push(stream.sampleDurationMs);
  });

  return durations.length > 0 ? rounded(Math.max.apply(null, durations), 3) : null;
}

function groupByType(streams)
{
  const result = {};

  streams.forEach((stream) =>
  {
    result[stream.type] || (result[stream.type] = []);
    result[stream.type].push(stream);
  });

  return result;
}

function createLegacyOutbound(type, stream)
{
  const remoteInbound = stream && stream.remoteInbound;

  // 保持旧 report 事件的字段集合不变，避免现有业务按 Object.keys 判断时受影响。
  if (type === 'audio')
  {
    return {
      type,
      mimeType    : stream && stream.codec && stream.codec.name,
      bytesSent   : number(stream && stream.bytesSent) || 0,
      packetsSent : number(stream && stream.packetsSent) || 0,
      loss        : number(remoteInbound && remoteInbound.intervalLossPercent) || 0,
      jitter      : number(remoteInbound && remoteInbound.jitterMs) || 0,
      speed       : rounded((number(stream && stream.actualBitrateBps) || 0) / 1000, 1) || 0
    };
  }

  return {
    type,
    mimeType        : stream && stream.codec && stream.codec.name,
    framesSent      : number(stream && stream.framesSent) || 0,
    framesEncoded   : number(stream && stream.framesEncoded) || 0,
    framesPerSecond : stream && stream.framesPerSecond,
    frameHeight     : stream && stream.frameHeight,
    frameWidth      : stream && stream.frameWidth,
    loss            : number(remoteInbound && remoteInbound.intervalLossPercent) || 0,
    jitter          : number(remoteInbound && remoteInbound.jitterMs) || 0,
    speed           : rounded((number(stream && stream.actualBitrateBps) || 0) / 1000, 1) || 0
  };
}

function createLegacyInbound(type, stream)
{
  if (type === 'audio')
  {
    return {
      type,
      mimeType        : stream && stream.codec && stream.codec.name,
      bytesReceived   : number(stream && stream.bytesReceived) || 0,
      packetsReceived : number(stream && stream.packetsReceived) || 0,
      loss            : number(stream && stream.intervalLossPercent) || 0,
      jitter          : number(stream && stream.jitterMs) || 0,
      speed           : rounded((number(stream && stream.receiveBitrateBps) || 0) / 1000, 1) || 0
    };
  }

  return {
    type,
    mimeType        : stream && stream.codec && stream.codec.name,
    framesReceived  : number(stream && stream.framesReceived) || 0,
    framesDecoded   : number(stream && stream.framesDecoded) || 0,
    framesPerSecond : stream && stream.framesPerSecond,
    frameHeight     : stream && stream.frameHeight,
    frameWidth      : stream && stream.frameWidth,
    loss            : number(stream && stream.intervalLossPercent) || 0,
    jitter          : number(stream && stream.jitterMs) || 0,
    speed           : rounded((number(stream && stream.receiveBitrateBps) || 0) / 1000, 1) || 0
  };
}

/**
 * 为浏览器 getStats Promise 增加确定的退出边界。
 * 原 Promise 即使稍后完成也已由 then/reject 处理，不会产生未捕获异常。
 */
function withTimeout(promise, timeoutMs, message)
{
  return new Promise((resolvePromise, rejectPromise) =>
  {
    let settled = false;
    const timer = setTimeout(() =>
    {
      if (!settled)
      {
        settled = true;
        rejectPromise(new Error(message || 'operation timed out'));
      }
    }, timeoutMs);

    Promise.resolve(promise).then((value) =>
    {
      if (!settled)
      {
        settled = true;
        clearTimeout(timer);
        resolvePromise(value);
      }
    }, (error) =>
    {
      if (!settled)
      {
        settled = true;
        clearTimeout(timer);
        rejectPromise(error);
      }
    });
  });
}

function currentNetworkSample(report)
{
  const mediaRtt = report.outbound
    .map((stream) => stream.remoteInbound && number(stream.remoteInbound.rttMs))
    .filter((value) => value !== null);
  const uplink = report.outbound
    .map((stream) => stream.remoteInbound && stream.remoteInbound.intervalLossPercent)
    .map((value) => number(value))
    .filter((value) => value !== null);
  const downlink = report.inbound
    .map((stream) => number(stream.intervalLossPercent))
    .filter((value) => value !== null);
  // 媒体 RTP 反馈更接近用户实际通话感受；浏览器不提供时再回退 ICE candidate-pair RTT。
  const rtt = mediaRtt.length > 0 ? Math.max.apply(null, mediaRtt) : number(report.connection.rttMs);

  return {
    rtt,
    uplinkLoss   : uplink.length > 0 ? Math.max.apply(null, uplink) : null,
    downlinkLoss : downlink.length > 0 ? Math.max.apply(null, downlink) : null,
    hasUplink    : report.outbound.some((stream) => stream.active),
    hasDownlink  : report.inbound.length > 0,
    hasData      : rtt !== null || uplink.length > 0 || downlink.length > 0
  };
}

function networkQuality(loss, rtt, hasStream)
{
  if (!hasStream || (loss === null && rtt === null))
  {
    return 0;
  }

  const safeLoss = loss === null ? 0 : loss;
  const safeRtt = rtt === null ? 0 : rtt;

  return safeLoss > 40 || safeRtt > 500 ? 6 : safeLoss > 30 || safeRtt > 350 ? 5 : safeLoss > 20 || safeRtt > 200 ? 4 : safeLoss > 10 || safeRtt > 100 ? 3 : safeLoss > 0 || safeRtt >= 50 ? 2 : 1;
}

function collectOutboundIssues(stream, issues)
{
  if (stream.qualityLimitationReason === 'bandwidth')
  {
    issues.push(issue('UPLINK_BANDWIDTH_LIMITED', 4, stream.id, {
      targetBitrateBps : stream.targetBitrateBps,
      actualBitrateBps : stream.actualBitrateBps
    }));
  }
  else if (stream.qualityLimitationReason === 'cpu')
  {
    issues.push(issue('ENCODER_CPU_LIMITED', 4, stream.id, {
      averageEncodeTimeMs : stream.averageEncodeTimeMs,
      framesPerSecond     : stream.framesPerSecond
    }));
  }

  if (stream.remoteInbound && stream.remoteInbound.intervalLossPercent !== null && stream.remoteInbound.intervalLossPercent > 10)
  {
    issues.push(issue('UPLINK_PACKET_LOSS', stream.remoteInbound.intervalLossPercent > 30 ? 6 : 4, stream.id, {
      lossPercent : stream.remoteInbound.intervalLossPercent,
      jitterMs    : stream.remoteInbound.jitterMs,
      rttMs       : stream.remoteInbound.rttMs
    }));
  }

  // 发送队列延迟和重传必须基于本轮增量，累计总量不能代表当前通话状态。
  if (stream.averagePacketSendDelayMs !== null && stream.averagePacketSendDelayMs > 50)
  {
    issues.push(issue('UPLINK_SEND_QUEUE_DELAY', stream.averagePacketSendDelayMs > 150 ? 5 : 3, stream.id, {
      averagePacketSendDelayMs : stream.averagePacketSendDelayMs
    }));
  }

  if (stream.retransmitPacketPercent !== null && stream.retransmitPacketPercent > 10)
  {
    issues.push(issue('UPLINK_HIGH_RETRANSMISSION', stream.retransmitPacketPercent > 25 ? 5 : 3, stream.id, {
      retransmitPacketPercent : stream.retransmitPacketPercent,
      retransmitBitrateBps    : stream.retransmitBitrateBps
    }));
  }

  if ((stream.nackCountDelta || 0) > 10 || (stream.pliCountDelta || 0) > 2 || (stream.firCountDelta || 0) > 2)
  {
    issues.push(issue('UPLINK_FEEDBACK_REQUESTS', 3, stream.id, {
      nackCountDelta : stream.nackCountDelta,
      pliCountDelta  : stream.pliCountDelta,
      firCountDelta  : stream.firCountDelta
    }));
  }

  // 编码耗时超过单帧预算的 80% 时，编码器已经很难稳定跟上目标帧率。
  const encodeFrameBudgetMs = stream.framesPerSecond ? 1000 / stream.framesPerSecond : null;

  if (stream.kind === 'video' && encodeFrameBudgetMs !== null && stream.averageEncodeTimeMs !== null && stream.averageEncodeTimeMs > encodeFrameBudgetMs * 0.8)
  {
    issues.push(issue('ENCODER_SLOW', stream.averageEncodeTimeMs > encodeFrameBudgetMs * 1.5 ? 5 : 3, stream.id, {
      averageEncodeTimeMs : stream.averageEncodeTimeMs,
      frameBudgetMs       : rounded(encodeFrameBudgetMs, 2)
    }));
  }

  if (stream.source && stream.kind === 'video')
  {
    const sourceFps = number(stream.source.framesPerSecond);
    const encodedFps = number(stream.framesPerSecond);
    const sourcePixels = (stream.source.width || 0) * (stream.source.height || 0);
    const encodedPixels = (stream.frameWidth || 0) * (stream.frameHeight || 0);

    if (sourceFps !== null && encodedFps !== null && sourceFps >= 10 && encodedFps < sourceFps * 0.7)
    {
      issues.push(issue('ENCODER_FRAME_RATE_REDUCED', 3, stream.id, { sourceFps, encodedFps }));
    }

    if (sourcePixels > 0 && encodedPixels > 0 && encodedPixels < sourcePixels * 0.6)
    {
      issues.push(issue('ENCODER_RESOLUTION_REDUCED', 3, stream.id, {
        sourceWidth   : stream.source.width,
        sourceHeight  : stream.source.height,
        encodedWidth  : stream.frameWidth,
        encodedHeight : stream.frameHeight
      }));
    }
  }
}

function collectInboundIssues(stream, issues)
{
  if (stream.intervalLossPercent !== null && stream.intervalLossPercent > 10)
  {
    issues.push(issue('DOWNLINK_PACKET_LOSS', stream.intervalLossPercent > 30 ? 6 : 4, stream.id, {
      lossPercent : stream.intervalLossPercent,
      jitterMs    : stream.jitterMs
    }));
  }

  if (stream.jitterMs !== null && stream.jitterMs > 50)
  {
    issues.push(issue('DOWNLINK_HIGH_JITTER', stream.jitterMs > 100 ? 5 : 3, stream.id, { jitterMs: stream.jitterMs }));
  }

  if (stream.droppedFramePercent !== null && stream.droppedFramePercent > 10)
  {
    issues.push(issue('VIDEO_FRAME_DROPPING', stream.droppedFramePercent > 30 ? 5 : 3, stream.id, {
      droppedFramePercent : stream.droppedFramePercent,
      averageDecodeTimeMs : stream.averageDecodeTimeMs
    }));
  }

  if ((stream.freezeCountDelta || 0) > 0 || (stream.freezesDurationDeltaMs || 0) > 0)
  {
    issues.push(issue('VIDEO_FREEZING', 5, stream.id, {
      freezeCountDelta       : stream.freezeCountDelta,
      freezesDurationDeltaMs : stream.freezesDurationDeltaMs
    }));
  }

  if ((stream.packetsDiscardedDelta || 0) > 0)
  {
    issues.push(issue('DOWNLINK_PACKET_DISCARDS', 3, stream.id, {
      packetsDiscardedDelta : stream.packetsDiscardedDelta
    }));
  }

  if (stream.averageJitterBufferDelayMs !== null && stream.averageJitterBufferDelayMs > 200)
  {
    issues.push(issue('DOWNLINK_JITTER_BUFFER_DELAY', stream.averageJitterBufferDelayMs > 500 ? 5 : 3, stream.id, {
      averageJitterBufferDelayMs       : stream.averageJitterBufferDelayMs,
      averageJitterBufferTargetDelayMs : stream.averageJitterBufferTargetDelayMs
    }));
  }

  const decodeFrameBudgetMs = stream.framesPerSecond ? 1000 / stream.framesPerSecond : null;

  if (stream.kind === 'video' && decodeFrameBudgetMs !== null && stream.averageDecodeTimeMs !== null && stream.averageDecodeTimeMs >= decodeFrameBudgetMs * 0.8)
  {
    issues.push(issue('VIDEO_DECODER_SLOW', stream.averageDecodeTimeMs > decodeFrameBudgetMs * 1.5 ? 5 : 3, stream.id, {
      averageDecodeTimeMs : stream.averageDecodeTimeMs,
      frameBudgetMs       : rounded(decodeFrameBudgetMs, 2)
    }));
  }

  if ((stream.pauseCountDelta || 0) > 0 || (stream.pausesDurationDeltaMs || 0) > 0)
  {
    issues.push(issue('VIDEO_PAUSING', 4, stream.id, {
      pauseCountDelta       : stream.pauseCountDelta,
      pausesDurationDeltaMs : stream.pausesDurationDeltaMs
    }));
  }

  if ((stream.nackCountDelta || 0) > 10 || (stream.pliCountDelta || 0) > 2 || (stream.firCountDelta || 0) > 2)
  {
    issues.push(issue('DOWNLINK_FEEDBACK_REQUESTS', 3, stream.id, {
      nackCountDelta : stream.nackCountDelta,
      pliCountDelta  : stream.pliCountDelta,
      firCountDelta  : stream.firCountDelta
    }));
  }
}

function collectConnectionIssues(report, issues, context)
{
  const connection = report.connection;

  if ((connection.packetsDiscardedOnSendDelta || 0) > 0 || (connection.bytesDiscardedOnSendDelta || 0) > 0)
  {
    issues.push(issue('UPLINK_LOCAL_SEND_DISCARDS', 4, null, {
      packetsDiscardedOnSendDelta : connection.packetsDiscardedOnSendDelta,
      bytesDiscardedOnSendDelta   : connection.bytesDiscardedOnSendDelta
    }));
  }

  // 只有浏览器明确给出可用带宽和各层目标码率时才比较，避免把缺字段误判为带宽不足。
  const activeTargetBitrate = report.outbound
    .filter((stream) => stream.active !== false && stream.targetBitrateBps !== null)
    .reduce((total, stream) => total + stream.targetBitrateBps, 0);

  if (connection.availableOutgoingBitrateBps !== null && activeTargetBitrate > 0 && connection.availableOutgoingBitrateBps < activeTargetBitrate * 0.8)
  {
    issues.push(issue('UPLINK_BANDWIDTH_BUDGET_LOW', 4, null, {
      availableOutgoingBitrateBps : connection.availableOutgoingBitrateBps,
      activeTargetBitrateBps      : activeTargetBitrate
    }));
  }

  // 远端 hold 时长时间无下行包是正常行为；其余场景超过 10 秒才认为传输停滞。
  if (report.inbound.length > 0 && !context.remoteHold && connection.lastPacketReceivedAgoMs !== null && connection.lastPacketReceivedAgoMs > 10000)
  {
    issues.push(issue('DOWNLINK_TRANSPORT_STALLED', 5, null, {
      lastPacketReceivedAgoMs : connection.lastPacketReceivedAgoMs
    }));
  }

  if ((connection.selectedCandidatePairChangesDelta || 0) > 0)
  {
    issues.push(issue('CONNECTION_PATH_CHANGED', 2, null, {
      selectedCandidatePairChangesDelta : connection.selectedCandidatePairChangesDelta,
      selectedCandidatePairId           : connection.selectedCandidatePairId
    }));
  }
}

function issue(code, severity, streamId, evidence)
{
  return { code, severity, streamId: streamId || null, evidence: evidence || {} };
}

function mediaQuality(networkValue, issues, direction)
{
  let quality = networkValue;
  const prefixes = direction === 'uplink' ? [ 'UPLINK_', 'ENCODER_' ] : [ 'DOWNLINK_', 'VIDEO_' ];

  issues
    .filter((item) => prefixes.some((prefix) => item.code.indexOf(prefix) === 0))
    .forEach((item) =>
    {
      quality = Math.max(quality || 1, item.severity);
    });

  return quality;
}

function cleanContext(context)
{
  return {
    sessionStatus : context.sessionStatus === undefined ? null : context.sessionStatus,
    mode          : context.mode || null,
    localHold     : Boolean(context.localHold),
    remoteHold    : Boolean(context.remoteHold),
    audioMuted    : Boolean(context.audioMuted),
    videoMuted    : Boolean(context.videoMuted),
    sharedMid     : context.sharedMid === undefined ? null : context.sharedMid
  };
}

function observeFeatures(report, features)
{
  if (report.type === 'remote-inbound-rtp')
  {
    features.add('remoteInboundRtp');
  }

  [ 'qualityLimitationReason', 'jitterBufferDelay', 'freezeCount', 'framesRendered', 'availableOutgoingBitrate', 'availableIncomingBitrate' ].forEach((field) =>
  {
    report[field] !== undefined && features.add(field);
  });
}

function featureSnapshot(features)
{
  const result = {};

  [ 'remoteInboundRtp', 'qualityLimitationReason', 'jitterBufferDelay', 'freezeCount', 'framesRendered', 'availableOutgoingBitrate', 'availableIncomingBitrate' ].forEach((feature) =>
  {
    result[feature] = features.has(feature);
  });

  return result;
}
