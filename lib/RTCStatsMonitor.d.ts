import {EventEmitter} from 'events'

declare class RTCStatsMonitor extends EventEmitter {
  /**
   * 创建独立统计监控器。默认立即启动；PC 尚无 RTP 数据时先进入 warming-up。
   */
  constructor(pc: RTCPeerConnection, options?: RTCStatsMonitor.Options)

  /** getStats 是否可用。字段级能力请读取 compatibility.level。 */
  readonly supported: boolean
  /** 当前自动检测到的兼容等级、API 形式、报告类型和高级字段。 */
  readonly compatibility: RTCStatsMonitor.Compatibility

  /** 启动采样；重复调用不会创建重复定时器。 */
  start(): void
  /** 停止采样并清理定时器、增量基线和质量窗口。 */
  stop(): void
  /** 保持运行状态不变，清空旧计数器并重建增量基线。 */
  reset(): void
  /** 显式标记换轨/重协商等媒体变化，过渡期内暂缓瞬时质量告警。 */
  markTransition(reason?: string): void
  /** 获取最近一次完整诊断报告，不会主动触发采样。 */
  getLatestReport(): RTCStatsMonitor.DetailedReport | null
  /** 获取最近一次兼容 report。 */
  getLatestLegacyReport(): RTCStatsMonitor.LegacyReport | null
  /** 获取最近一次兼容 network-quality。 */
  getLatestNetworkQuality(): RTCStatsMonitor.NetworkQualityReport | null

  on(event: 'detailed-report', listener: (report: RTCStatsMonitor.DetailedReportEvent) => void): this
  on(event: 'report', listener: (report: RTCStatsMonitor.LegacyReport) => void): this
  on(event: 'network-quality', listener: (report: RTCStatsMonitor.NetworkQualityReport) => void): this
  on(event: 'stats-error', listener: (error: RTCStatsMonitor.StatsError) => void): this
}

declare namespace RTCStatsMonitor {
  type CompatibilityLevel = 'full' | 'partial' | 'legacy-basic' | 'unsupported'
  type ReportPhase = 'warming-up' | 'transitioning' | 'active' | 'reconnecting' | 'stopped'
  type StreamType = 'audio' | 'video' | 'shared' | 'unknown' | string
  /** 0 表示暂无有效样本；1 为最佳，6 为最差。 */
  type QualityLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6
  type StatsFormat = 'unknown' | 'standard' | 'object' | 'legacy'

  interface SessionContext {
    sessionStatus: number | string | null
    mode: string | null
    localHold: boolean
    remoteHold: boolean
    audioMuted: boolean
    videoMuted: boolean
    sharedMid: string | number | null
  }

  interface Options {
    /** 前台采样间隔，默认 2000ms，最小 500ms。 */
    sampleIntervalMs?: number
    /** report/network-quality 输出间隔，默认 2000ms。 */
    legacyReportIntervalMs?: number
    /** 页面进入后台后的采样间隔，默认 2000ms。 */
    backgroundSampleIntervalMs?: number
    /** 媒体变化后跳过瞬时诊断的样本数量，默认 2。 */
    transitionGraceSamples?: number
    /** 是否记录常用诊断摘要并发送 detailed-report 事件，默认 true。 */
    enableDetailedReport?: boolean
    /** 是否限频记录脱敏后的原始 RTCStatsReport，默认 true。 */
    enableRawStatsLog?: boolean
    /** 原始报告日志最小间隔，默认 10000ms。 */
    rawStatsLogIntervalMs?: number
    /** 单次 getStats 超时时间，默认 5000ms，最小 100ms。 */
    getStatsTimeoutMs?: number
    /** 构造完成后是否立即开始采样，默认 true。 */
    autoStart?: boolean
    /** 提供 mode/hold/mute/sharedMid 等会话上下文，用于解释质量问题。 */
    contextProvider?: () => Partial<SessionContext> & Record<string, unknown>
    /** 覆盖默认的 audio/video/shared 流分类。 */
    streamClassifier?: (input: {
      report: Record<string, unknown>
      context: Partial<SessionContext> & Record<string, unknown>
      transceiver: RTCRtpTransceiver | null
    }) => StreamType | null | undefined
  }

  interface Compatibility {
    /** 运行时自动判断的 full/partial/legacy-basic/unsupported。 */
    level: CompatibilityLevel
    api: {
      getStats: boolean
      promiseGetStats: boolean
      callbackGetStats: boolean
      getTransceivers: boolean
      standardStatsReport: boolean
    }
    observedStatsTypes: string[]
    observedFeatures: Record<string, boolean>
    statsFormat: StatsFormat
  }

  interface CodecInfo {
    mimeType: string | null
    name: string | null
    payloadType: number | null
    clockRate: number | null
    channels: number | null
    sdpFmtpLine: string | null
  }

  interface MediaSourceReport {
    id: string | null
    kind: string | null
    trackIdentifier: string | null
    width: number | null
    height: number | null
    frames: number | null
    framesPerSecond: number | null
  }

  interface OutboundSource {
    id: string | null
    trackIdentifier: string | null
    width: number | null
    height: number | null
    framesPerSecond: number | null
    origin: 'media-source' | 'track-settings'
  }

  interface CandidateInfo {
    id: string | null
    candidateType: string | null
    protocol: string | null
    relayProtocol: string | null
    address: string | null
    port: number | null
    url: string | null
    relatedAddress: string | null
    relatedPort: number | null
  }

  interface RemoteInboundReport {
    id: string
    localId: string | null
    kind: string | null
    ssrc: string | number | null
    codec: CodecInfo
    packetsLost: number | null
    packetsReceived: number | null
    intervalLossPercent: number | null
    fractionLost: number | null
    jitterMs: number | null
    rttMs: number | null
    averageRttMs: number | null
  }

  interface RemoteOutboundReport {
    id: string | null
    remoteTimestamp: number | null
    reportsSent: number | null
    bytesSent: number | null
    packetsSent: number | null
    roundTripTimeMs: number | null
  }

  interface OutboundReport {
    id: string
    type: StreamType
    kind: string | null
    ssrc: string | number | null
    mid: string | number | null
    rid: string | number | null
    encodingIndex: number | null
    active: boolean
    trackIdentifier: string | null
    mediaSourceId: string | null
    codec: CodecInfo
    timestamp: number | null
    sampleDurationMs: number | null
    actualBitrateBps: number | null
    rtpBitrateBps: number | null
    targetBitrateBps: number | null
    retransmitBitrateBps: number | null
    retransmitPacketPercent: number | null
    bytesSent: number | null
    headerBytesSent: number | null
    retransmittedBytesSent: number | null
    packetsSent: number | null
    packetsSentDelta: number | null
    retransmittedPacketsSent: number | null
    framesSent: number | null
    framesEncoded: number | null
    framesEncodedDelta: number | null
    framesPerSecond: number | null
    frameWidth: number | null
    frameHeight: number | null
    keyFramesEncoded: number | null
    hugeFramesSent: number | null
    averageEncodeTimeMs: number | null
    averagePacketSendDelayMs: number | null
    averageQp: number | null
    qpSum: number | null
    qualityLimitationReason: string | null
    qualityLimitationDurations: Record<string, number> | null
    qualityLimitationDurationsDelta: Record<string, number | null> | null
    qualityLimitationResolutionChangesDelta: number | null
    nackCountDelta: number | null
    pliCountDelta: number | null
    firCountDelta: number | null
    source: OutboundSource | null
    remoteInbound: RemoteInboundReport | null
    comparable: boolean
  }

  interface InboundReport {
    id: string
    type: StreamType
    kind: string | null
    ssrc: string | number | null
    mid: string | number | null
    trackIdentifier: string | null
    codec: CodecInfo
    timestamp: number | null
    sampleDurationMs: number | null
    receiveBitrateBps: number | null
    rtpBitrateBps: number | null
    bytesReceived: number | null
    headerBytesReceived: number | null
    packetsReceived: number | null
    packetsLost: number | null
    intervalLossPercent: number | null
    packetsDiscarded: number | null
    packetsDiscardedDelta: number | null
    jitterMs: number | null
    framesReceived: number | null
    framesDecoded: number | null
    framesDecodedDelta: number | null
    framesRendered: number | null
    framesDropped: number | null
    droppedFramePercent: number | null
    framesPerSecond: number | null
    frameWidth: number | null
    frameHeight: number | null
    averageDecodeTimeMs: number | null
    averageProcessingDelayMs: number | null
    averageJitterBufferDelayMs: number | null
    averageJitterBufferTargetDelayMs: number | null
    averageJitterBufferMinimumDelayMs: number | null
    jitterBufferEmittedCount: number | null
    freezeCount: number | null
    freezeCountDelta: number | null
    totalFreezesDuration: number | null
    freezesDurationDeltaMs: number | null
    pauseCount: number | null
    pauseCountDelta: number | null
    totalPausesDuration: number | null
    pausesDurationDeltaMs: number | null
    nackCountDelta: number | null
    pliCountDelta: number | null
    firCountDelta: number | null
    retransmittedPacketsReceived: number | null
    retransmittedPacketsReceivedDelta: number | null
    retransmittedBytesReceived: number | null
    retransmittedBytesReceivedDelta: number | null
    retransmitReceiveBitrateBps: number | null
    fecPacketsReceived: number | null
    fecPacketsReceivedDelta: number | null
    fecPacketsDiscarded: number | null
    fecPacketsDiscardedDelta: number | null
    fecBytesReceived: number | null
    fecBytesReceivedDelta: number | null
    fecReceiveBitrateBps: number | null
    remoteOutbound: RemoteOutboundReport | null
    comparable: boolean
  }

  interface ConnectionReport {
    connectionState: string | null
    iceConnectionState: string | null
    iceGatheringState: string | null
    signalingState: string | null
    dtlsState: string | null
    iceState: string | null
    selectedCandidatePairId: string | null
    candidatePairSelection: 'transport' | 'fallback' | 'unavailable'
    candidatePairState: string | null
    candidatePairNominated: boolean | null
    localCandidateId: string | null
    remoteCandidateId: string | null
    selectedCandidatePairChanges: number | null
    selectedCandidatePairChangesDelta: number | null
    rttMs: number | null
    averageRttMs: number | null
    availableOutgoingBitrateBps: number | null
    availableIncomingBitrateBps: number | null
    sendBitrateBps: number | null
    receiveBitrateBps: number | null
    bytesSent: number | null
    bytesReceived: number | null
    packetsSent: number | null
    packetsReceived: number | null
    packetsDiscardedOnSend: number | null
    packetsDiscardedOnSendDelta: number | null
    bytesDiscardedOnSend: number | null
    bytesDiscardedOnSendDelta: number | null
    lastPacketSentAgoMs: number | null
    lastPacketReceivedAgoMs: number | null
    localCandidate: CandidateInfo | null
    remoteCandidate: CandidateInfo | null
  }

  type QualityIssueCode =
    'UPLINK_BANDWIDTH_LIMITED' | 'ENCODER_CPU_LIMITED' | 'UPLINK_PACKET_LOSS' |
    'UPLINK_SEND_QUEUE_DELAY' | 'UPLINK_HIGH_RETRANSMISSION' | 'UPLINK_FEEDBACK_REQUESTS' |
    'ENCODER_SLOW' | 'ENCODER_FRAME_RATE_REDUCED' | 'ENCODER_RESOLUTION_REDUCED' |
    'DOWNLINK_PACKET_LOSS' | 'DOWNLINK_HIGH_JITTER' | 'VIDEO_FRAME_DROPPING' |
    'VIDEO_FREEZING' | 'DOWNLINK_PACKET_DISCARDS' | 'DOWNLINK_JITTER_BUFFER_DELAY' |
    'VIDEO_DECODER_SLOW' | 'VIDEO_PAUSING' | 'DOWNLINK_FEEDBACK_REQUESTS' |
    'UPLINK_LOCAL_SEND_DISCARDS' | 'UPLINK_BANDWIDTH_BUDGET_LOW' |
    'DOWNLINK_TRANSPORT_STALLED' | 'CONNECTION_PATH_CHANGED' | 'HIGH_RTT' |
    'CONNECTION_UNAVAILABLE'

  interface QualityIssue {
    code: QualityIssueCode
    /** 与质量等级同向：1 较轻，6 最严重。 */
    severity: Exclude<QualityLevel, 0>
    streamId: string | null
    evidence: Record<string, string | number | boolean | null>
  }

  interface DetailedQuality {
    uplinkNetworkQuality: QualityLevel
    downlinkNetworkQuality: QualityLevel
    RTT: number
    uplinkLoss: number
    downlinkLoss: number
    uplinkMediaQuality: QualityLevel
    downlinkMediaQuality: QualityLevel
    issues: QualityIssue[]
    context: SessionContext
  }

  interface PerformanceReport {
    getStatsDurationMs: number
    parseDurationMs: number
    reportCount: number
    statsFormat: StatsFormat
  }

  interface LegacyUpStream {
    type: StreamType
    mimeType?: string
    bytesSent?: number
    packetsSent?: number
    framesSent?: number
    framesEncoded?: number
    framesPerSecond?: number | null
    frameHeight?: number | null
    frameWidth?: number | null
    loss: number
    jitter: number
    speed: number
  }

  interface LegacyDownStream {
    type: StreamType
    mimeType?: string
    bytesReceived?: number
    packetsReceived?: number
    framesReceived?: number
    framesDecoded?: number
    framesPerSecond?: number | null
    frameHeight?: number | null
    frameWidth?: number | null
    loss: number
    jitter: number
    speed: number
  }

  interface LegacyReport {
    RTT: number
    upStreams: LegacyUpStream[]
    downStreams: LegacyDownStream[]
  }

  interface NetworkQualityReport {
    uplinkNetworkQuality: QualityLevel
    RTT: number
    uplinkLoss: number
    downlinkNetworkQuality: QualityLevel
    downlinkLoss: number
  }

  /** detailed-report 事件使用的常用诊断摘要。 */
  interface DetailedReportEvent {
    connection: DetailedEventConnectionReport
    outbound: DetailedEventOutboundReport[]
    inbound: DetailedEventInboundReport[]
    quality: DetailedEventQuality
  }

  interface DetailedEventConnectionReport {
    connectionState: string | null
    iceConnectionState: string | null
    dtlsState: string | null
    sendBitrateBps: number | null
    availableOutgoingBitrateBps: number | null
    receiveBitrateBps: number | null
    availableIncomingBitrateBps: number | null
  }

  interface DetailedEventOutboundReport {
    type: StreamType
    kind: string | null
    mid: string | number | null
    codec: Pick<CodecInfo, 'name'> | null
    actualBitrateBps: number | null
    framesPerSecond: number | null
    frameWidth: number | null
    frameHeight: number | null
    averageEncodeTimeMs: number | null
    qualityLimitationReason: string | null
    remoteInbound: Pick<RemoteInboundReport, 'jitterMs' | 'intervalLossPercent'> | null
  }

  interface DetailedEventInboundReport {
    type: StreamType
    kind: string | null
    mid: string | number | null
    codec: Pick<CodecInfo, 'name'> | null
    receiveBitrateBps: number | null
    jitterMs: number | null
    intervalLossPercent: number | null
    framesPerSecond: number | null
    frameWidth: number | null
    frameHeight: number | null
    averageDecodeTimeMs: number | null
  }

  interface DetailedEventQuality {
    RTT: number
    uplinkNetworkQuality: QualityLevel
    downlinkNetworkQuality: QualityLevel
    issues: Array<Pick<QualityIssue, 'code' | 'severity'>>
  }

  /** getLatestReport() 返回的完整诊断报告；普通 logger 只输出其中的常用摘要。 */
  interface DetailedReport {
    /** 本次报告中最大的浏览器统计时间戳，单位毫秒。 */
    timestamp: number
    /** 与上一份同 id 报告的实际间隔；基线未建立时为 null。 */
    sampleDurationMs: number | null
    /** 是否已经存在至少一条可计算增量的上下行流。 */
    ready: boolean
    /** 当前处于预热、媒体变化、活动、重连或停止阶段。 */
    phase: ReportPhase
    transition: { reason: string; remainingSamples: number } | null
    connection: ConnectionReport
    sources: MediaSourceReport[]
    outbound: OutboundReport[]
    remoteInbound: RemoteInboundReport[]
    inbound: InboundReport[]
    quality: DetailedQuality
    compatibility: Compatibility
    performance: PerformanceReport
  }

  interface StatsError {
    code: string
    fatal: boolean
    message: string
    error: Error | null
    consecutiveErrors: number
  }
}

export = RTCStatsMonitor
