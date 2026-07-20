/// <reference types="node" />
import {EventEmitter} from 'events'

import {IncomingRequest, IncomingResponse, OutgoingRequest} from './SIPMessage'
import {NameAddrHeader} from './NameAddrHeader'
import {URI} from './URI'
import {causes, DTMF_TRANSPORT} from './Constants'
import RTCStatsMonitor = require('./RTCStatsMonitor')

interface RTCPeerConnectionDeprecated extends RTCPeerConnection {
  /**
   * @deprecated
   * @see https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getRemoteStreams
   */
  getRemoteStreams(): MediaStream[];
}

export enum SessionDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
}

export enum Originator {
  LOCAL = 'local',
  REMOTE = 'remote',
  SYSTEM = 'system',
}

// options
export interface MediaConstraints {
  audio?: boolean;
  video?: boolean;
}

export type MediaEffectsComposerWatermarkTarget = 'output' | 'source';
export type MediaEffectsComposerWatermarkType = 'text' | 'image';
export type MediaEffectsComposerWatermarkPositionPreset =
  'top-left' |
  'top-center' |
  'top-right' |
  'center' |
  'bottom-left' |
  'bottom-center' |
  'bottom-right';

export interface MediaEffectsComposerWatermarkPoint {
  x: number;
  y: number;
}

export interface MediaEffectsComposerWatermarkFilter {
  id?: string;
  target?: MediaEffectsComposerWatermarkTarget;
  slot?: number;
  sourceId?: string;
  streamId?: string;
}

export interface MediaEffectsComposerWatermarkOptions {
  id?: string;
  target?: MediaEffectsComposerWatermarkTarget;
  type?: MediaEffectsComposerWatermarkType;
  text?: string;
  image?: string | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap;
  slot?: number;
  sourceId?: string;
  streamId?: string;
  position?: MediaEffectsComposerWatermarkPositionPreset | MediaEffectsComposerWatermarkPoint;
  width?: number;
  height?: number;
  opacity?: number;
  font?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  padding?: number;
  backgroundRadius?: number;
  borderRadius?: number;
  margin?: number;
}

export interface MediaEffectsComposerSourceOptions {
  slot?: number;
  gain?: number;
  sourceMirror?: boolean;
  aiVirtualBackground?: AiVBOptions | null;
  [key: string]: any;
}

export interface MediaEffectsComposerSourceState {
  id: string;
  streamId: string | null;
  slot: number | null;
  gain: number;
  sourceMirror: boolean | null;
  aiVirtualBackground: AiVBOptions | null;
  hasAudio: boolean;
  hasVideo: boolean;
}

export interface MediaEffectsComposerRenderState {
  requestedMode: string;
  actualMode: string;
  isWorker: boolean;
  isWebGL2: boolean;
  isFallback: boolean;
  reason: string;
  droppedFrames: number;
  renderedFrames: number;
  fps: number | null;
  width: number | null;
  height: number | null;
  outputMode?: string;
  captureFrameControlMode?: string;
  insertableActive?: boolean;
  insertableEnabledByConfig?: boolean;
  insertableSupported?: boolean;
  insertableGeneratorType?: string;
  insertableSupportReason?: string;
  insertableWriteFailures?: number;
  insertableHasGeneratorTrack?: boolean;
  outputHasCapturedStream?: boolean;
  activeCaptureSinkAttached?: boolean;
}

export interface MediaEffectsComposerAudioState {
  requested: boolean;
  status: string;
  contextState: string | null;
  sourceCount: number;
  liveSourceCount: number;
  connectedSources: number;
  outputTracks: number;
  reason: string;
  lastError: string;
}

export interface MediaEffectsComposerMirrorState {
  global: boolean;
  overrides: Record<string, boolean | null>;
}

export interface MediaEffectsComposerSlotMirrorState extends MediaEffectsComposerMirrorState {
  slot: number;
  override: boolean | null;
  effective: boolean;
}

export interface MediaEffectsComposerConfigState {
  /**
   * 合成输出镜像。会影响实际输出流，不等同于本地 video 标签的 CSS 预览镜像。
   */
  outputMirror: boolean;
  /**
   * 源级默认镜像。在布局进入输出前，对每一路源做镜像。
   */
  sourceMirror: boolean;
  sourceMirrorOverrides: Record<string, boolean>;
  /**
   * 当 outputMirror=true 时，输出级水印是否一起翻转。
   */
  mirrorWatermarksWithOutput: boolean;
  watermarks: MediaEffectsComposerWatermarkState[];
}

export interface MediaEffectsComposerState {
  sources: MediaEffectsComposerSourceState[];
  config: MediaEffectsComposerConfigState;
  render: MediaEffectsComposerRenderState;
  audio: MediaEffectsComposerAudioState;
  issues: MediaEffectsIssue[];
}

export interface MediaEffectsIssue {
  module?: string;
  component?: string;
  stage?: string;
  severity?: 'info' | 'warn' | 'error' | string;
  message: string;
  fallbackApplied?: boolean;
  degraded?: boolean;
  details?: Record<string, any>;
  timestamp?: number;
}

export interface MediaEffectsComposerCapabilityReport {
  limits: {
    maxSources: number;
  };
  features: {
    multiSource: boolean;
    sourceAiVirtualBackground: boolean;
    sourceAiVirtualBackgroundSupported: boolean;
    sourceAiVirtualBackgroundEnabled: boolean;
    outputMirror: boolean;
    audioSubmix: boolean;
    insertableStreamsConfigured: boolean;
  };
  render: MediaEffectsComposerRenderState;
  audio: MediaEffectsComposerAudioState;
}

export interface MediaEffectsComposerSessionOptions {
  width?: number;
  height?: number;
  fps?: number;
  backgroundColor?: string;
  audioGain?: number;
  renderMode?: string;
  workerUrl?: string;
  dropFrameWhenBusy?: boolean;
  maxFrameQueue?: number;
  preserveDrawingBuffer?: boolean;
  mirror?: boolean;
  sourceMirror?: boolean;
  mirrorWatermarksWithOutput?: boolean;
  watermarks?: MediaEffectsComposerWatermarkOptions[] | MediaEffectsComposerWatermarkOptions | null;
  sources?: MediaEffectsComposerSourceOptions[] | null;
  [key: string]: any;
}

export interface MediaEffectsComposerOptions extends MediaEffectsComposerSessionOptions {}

export interface MediaEffectsComposerWatermarkState extends MediaEffectsComposerWatermarkOptions {
  target: MediaEffectsComposerWatermarkTarget;
  type: MediaEffectsComposerWatermarkType;
  slot: number | null;
  sourceId: string | null;
  streamId: string | null;
  position: MediaEffectsComposerWatermarkPositionPreset | MediaEffectsComposerWatermarkPoint;
  opacity: number;
  fontSize: number;
  color: string;
  backgroundColor: string;
  padding: number;
  backgroundRadius: number;
  margin: number;
  status: string;
  reason: string;
}

export interface MediaEffectsComposerOutputRequest {
  type?: 'mixed' | 'video' | 'audio';
  slots?: number[];
  /**
   * When true, creates the submix in an independent AudioContext.
   */
  isolated?: boolean;
  audioContext?: 'shared' | 'isolated';
  recreate?: boolean;
}

export interface MediaEffectsComposerConfigPatch {
  outputMirror?: boolean;
  mirror?: boolean;
  mirrorWatermarksWithOutput?: boolean;
  sourceMirror?: boolean;
  sourceMirrorOverrides?: Record<string, boolean | null>;
  clearSourceMirrorOverrides?: boolean;
  watermarks?: MediaEffectsComposerWatermarkOptions[] | MediaEffectsComposerWatermarkOptions | null;
  clearWatermarks?: boolean;
  clearWatermarkFilter?: MediaEffectsComposerWatermarkFilter | null;
  [key: string]: any;
}

/**
 * Runtime patch for an already created composer.
 *
 * Note:
 * - `RTCSession.updateMediaEffectsComposer()` only guarantees session-scoped state:
 *   source 0 plus output-level config.
 * - Immutable constructor fields such as `width/height/fps/renderMode/...` cannot be
 *   hot-updated on an existing composer instance and will be rejected at runtime.
 */
export interface MediaEffectsComposerPatch extends MediaEffectsComposerConfigPatch {
  sources?: MediaEffectsComposerSourceOptions[] | null;
}

export interface MediaEffectsComposerInstance {
  addSource(
    videos: MediaStream | HTMLVideoElement | Array<MediaStream | HTMLVideoElement>,
    optionsOrSlot?: number | MediaEffectsComposerSourceOptions
  ): boolean;
  appendStream(
    videos: MediaStream | HTMLVideoElement | Array<MediaStream | HTMLVideoElement>,
    optionsOrSlot?: number | MediaEffectsComposerSourceOptions
  ): boolean;
  removeSource(target: MediaStream | HTMLVideoElement | string): boolean;
  removeStream(target: MediaStream | HTMLVideoElement | string): boolean;
  clearSources(): void;
  clearStreams(): void;
  getState(): MediaEffectsComposerState;
  getSources(): MediaEffectsComposerSourceState[];
  /**
   * 合成输出镜像，影响实际输出流。
   */
  getMirror(): boolean;
  setMirror(enabled: boolean): Promise<MediaEffectsComposerConfigState>;
  /**
   * 源级镜像状态。无 slot 时返回全局与覆盖项；指定 slot 时返回该路生效值。
   */
  getSourceMirror(): MediaEffectsComposerMirrorState;
  getSourceMirror(slot: number): MediaEffectsComposerSlotMirrorState;
  setSourceMirror(slotOrEnabled: number | boolean, enabled?: boolean): Promise<MediaEffectsComposerConfigState>;
  clearSourceMirror(slot?: number): Promise<MediaEffectsComposerConfigState>;
  getMirrorWatermarksWithOutput(): boolean;
  setMirrorWatermarksWithOutput(enabled: boolean): Promise<MediaEffectsComposerConfigState>;
  setWatermarks(
    watermarks: MediaEffectsComposerWatermarkOptions[] | MediaEffectsComposerWatermarkOptions | null
  ): Promise<MediaEffectsComposerWatermarkState[]>;
  clearWatermarks(filter?: MediaEffectsComposerWatermarkFilter): Promise<MediaEffectsComposerConfigState>;
  getWatermarks(): MediaEffectsComposerWatermarkState[];
  setSourceAiVirtualBackground(slotOrTarget: number | string | MediaStream | HTMLVideoElement, options: boolean | AiVBOptions | null): AiVBOptions | null;
  getSourceAiVirtualBackground(slotOrTarget: number | string | MediaStream | HTMLVideoElement): AiVBOptions | null;
  clearSourceAiVirtualBackground(slotOrTarget: number | string | MediaStream | HTMLVideoElement): void;
  setConfig(patch: MediaEffectsComposerConfigPatch): Promise<MediaEffectsComposerConfigState>;
  getRenderInfo(): MediaEffectsComposerRenderState;
  getAudioInfo(): MediaEffectsComposerAudioState;
  getCapabilityReport(): MediaEffectsComposerCapabilityReport;
  getOutput(options?: MediaEffectsComposerOutputRequest | 'mixed' | 'video' | 'audio'): Promise<MediaStream | null>;
  getMixedStream(): Promise<MediaStream>;
  getVideoStream(): MediaStream;
  getAudioStream(options?: { slots?: number[]; isolated?: boolean; audioContext?: 'shared' | 'isolated'; recreate?: boolean } | number[]): Promise<MediaStream | null>;
  getIsolatedSubmixAudioStream(options?: { slots?: number[] } | number[]): Promise<MediaStream | null>;
  releaseOutput(options: MediaEffectsComposerOutputRequest): boolean;
  releaseSubmixAudioStream(options?: { slots?: number[]; isolated?: boolean } | number[]): boolean;
  stop(): void;
}

export interface AiVBVideoOptions {
  width?: number;
  height?: number;
  targetFps?: number;
  mirror?: boolean;
  processingScale?: number;
}

export interface AiVBSegmentationOptions {
  delegate?: 'CPU' | 'GPU';
  frameSkip?: number;
}

export interface AiVBPostProcessingOptions {
  blurRadius?: number;
  maxBlurRadius?: number;
  foregroundBrightness?: number;
  foregroundContrast?: number;
  foregroundSaturate?: number;
}

export interface AiVBAssetOptions {
  cdnUrl?: string;
  moduleUrl?: string;
  wasmBaseUrl?: string;
  modelUrl?: string;
  scriptNonce?: string;
}

export interface AiVBOptions {
  enabled?: boolean;
  mode?: 'none' | 'blur' | 'image' | 'color';
  imageUrl?: string;
  color?: string;
  blurRadius?: number;
  modelPath?: string;
  video?: AiVBVideoOptions;
  segmentation?: AiVBSegmentationOptions;
  postProcessing?: AiVBPostProcessingOptions;
  assetConfig?: AiVBAssetOptions;
  [key: string]: any;
}

export interface AiNoiseSuppressionController {
  setEnabled(enable: boolean): Promise<boolean>;
  setSuppressionLevel(level: number): void;
  setOutputGain(value: number): number;
  isEnabled(): boolean;
}

export interface ExtraHeaders {
  extraHeaders?: string[];
}

export interface AnswerOptions extends ExtraHeaders {
  mediaConstraints?: MediaConstraints;
  mediaStream?: MediaStream;
  mediaEffectsComposer?: MediaEffectsComposerSessionOptions;
  pcConfig?: RTCConfiguration;
  rtcConstraints?: object;
  rtcAnswerConstraints?: RTCOfferOptions;
  rtcOfferConstraints?: RTCOfferOptions;
  sessionTimersExpires?: number;
}

export interface RejectOptions extends ExtraHeaders {
  status_code?: number;
  reason_phrase?: string;
}

export interface UpgradeToVideoOptions extends ExtraHeaders {
  videoConstraints?: any;
  videoStream?: MediaStream;
  sendOnly?: boolean;
  recvOnly?: boolean;
  useUpdate?: boolean;
  mediaEffectsComposer?: MediaEffectsComposerSessionOptions;
}

export interface TerminateOptions extends RejectOptions {
  body?: string;
  cause?: causes | string;
}

export interface ReferOptions extends ExtraHeaders {
  eventHandlers?: any;
  replaces?: RTCSession;
}

export interface OnHoldResult {
  local: boolean;
  remote: boolean;
}

export interface DTFMOptions extends ExtraHeaders {
  duration?: number;
  interToneGap?: number;
  transportType?: DTMF_TRANSPORT;
}

export interface HoldOptions extends ExtraHeaders {
  useUpdate?: boolean;
}

export interface RenegotiateOptions extends HoldOptions {
  rtcOfferConstraints?: RTCOfferOptions;
}

// events
export interface DTMF extends EventEmitter {
  tone: string;
  duration: number;
}

export interface Info extends EventEmitter {
  contentType: string;
  body: string;
}

export interface PeerConnectionEvent {
  peerconnection: RTCPeerConnectionDeprecated;
}

export interface ConnectingEvent {
  request: IncomingRequest | OutgoingRequest;
}

export interface SendingEvent {
  request: OutgoingRequest
}

export interface IncomingEvent {
  originator: Originator.LOCAL;
}

export interface EndEvent {
  originator: Originator;
  message: IncomingRequest | IncomingResponse;
  cause: string;
}

export interface IncomingDTMFEvent {
  originator: Originator.REMOTE;
  dtmf: DTMF;
  request: IncomingRequest;
}

export interface OutgoingDTMFEvent {
  originator: Originator.LOCAL;
  dtmf: DTMF;
  request: OutgoingRequest;
}

export interface IncomingInfoEvent {
  originator: Originator.REMOTE;
  info: Info;
  request: IncomingRequest;
}

export interface OutgoingInfoEvent {
  originator: Originator.LOCAL;
  info: Info;
  request: OutgoingRequest;
}

export interface HoldEvent {
  originator: Originator
}

export interface ReInviteEvent {
  request: IncomingRequest;
  callback?: VoidFunction;
  reject: (options?: RejectOptions) => void;
}

export interface ReferEvent {
  request: IncomingRequest;
  accept: Function;
  reject: VoidFunction;
}

export interface SDPEvent {
  originator: Originator;
  type: string;
  sdp: string;
}

export interface IceCandidateEvent {
  candidate: RTCIceCandidate;
  ready: VoidFunction;
}

export interface OutgoingEvent {
  originator: Originator.REMOTE;
  response: IncomingResponse;
}

export interface OutgoingAckEvent {
  originator: Originator.LOCAL;
}

export interface IncomingAckEvent {
  originator: Originator.REMOTE;
  ack: IncomingRequest;
}

export interface ModeEvent {
  mode: string
}

// listener
export type AnyListener = (...args: any[]) => void;
export type PeerConnectionListener = (event: PeerConnectionEvent) => void;
export type ConnectingListener = (event: ConnectingEvent) => void;
export type SendingListener = (event: SendingEvent) => void;
export type IncomingListener = (event: IncomingEvent) => void;
export type OutgoingListener = (event: OutgoingEvent) => void;
export type IncomingConfirmedListener = (event: IncomingAckEvent) => void;
export type OutgoingConfirmedListener = (event: OutgoingAckEvent) => void;
export type CallListener = IncomingListener | OutgoingListener;
export type ConfirmedListener = IncomingConfirmedListener | OutgoingConfirmedListener;
export type EndListener = (event: EndEvent) => void;
export type IncomingDTMFListener = (event: IncomingDTMFEvent) => void;
export type OutgoingDTMFListener = (event: OutgoingDTMFEvent) => void;
export type DTMFListener = IncomingDTMFListener | OutgoingDTMFListener;
export type IncomingInfoListener = (event: IncomingInfoEvent) => void;
export type OutgoingInfoListener = (event: OutgoingInfoEvent) => void;
export type InfoListener = IncomingInfoListener | OutgoingInfoListener;
export type HoldListener = (event: HoldEvent) => void;
export type MuteListener = (event: MediaConstraints) => void;
export type ReInviteListener = (event: ReInviteEvent) => void;
export type UpdateListener = ReInviteListener;
export type ReferListener = (event: ReferEvent) => void;
export type SDPListener = (event: SDPEvent) => void;
export type IceCandidateListener = (event: IceCandidateEvent) => void;
export type ModeListener = (event: ModeEvent) => void;
/**
 * 媒体效果异常事件负载。
 *
 * 当混流器、AI 降噪、AI 虚拟背景等模块发生运行时异常（如模型加载失败、
 * 渲染器降级、资源获取超时等），系统会自动上报并通过 session.emit 发出
 * 'mediaEffectsIssue' 事件。业务侧可监听此事件用于 UI 提示或监控告警。
 *
 * 字段说明：
 * - module: 问题所属模块名，如 'AiNS'（AI 降噪）、'MediaEffectsComposer'（混流器）
 * - message: 人类可读的问题描述信息
 */
export interface MediaEffectsIssueEvent {
  module: string;
  message: string;
}

export interface RTCSessionEventMap {
  'peerconnection': PeerConnectionListener;
  'connecting': ConnectingListener;
  'sending': SendingListener;
  'progress': CallListener;
  'accepted': CallListener;
  'confirmed': ConfirmedListener;
  'ended': EndListener;
  'failed': EndListener;
  'newDTMF': DTMFListener;
  'newInfo': InfoListener;
  'hold': HoldListener;
  'unhold': HoldListener;
  'muted': MuteListener;
  'unmuted': MuteListener;
  'reinvite': ReInviteListener;
  'update': UpdateListener;
  'refer': ReferListener;
  'replaces': ReferListener;
  'sdp': SDPListener;
  'icecandidate': IceCandidateListener;
  'mode': ModeListener,
  'upgradeToVideo': AnyListener,
  'getusermediafailed': AnyListener;
  'mediaEffectsIssue': (event: MediaEffectsIssueEvent) => void;
  /** RTCStatsMonitor 的兼容 report，由会话增加 stats: 前缀后转发。 */
  'stats:report': (report: RTCStatsMonitor.LegacyReport) => void;
  /** 0 暂无数据，1 最佳，6 最差。 */
  'stats:network-quality': (report: RTCStatsMonitor.NetworkQualityReport) => void;
  /** Demo 和常规监控使用的诊断摘要。 */
  'stats:detailed-report': (report: RTCStatsMonitor.DetailedReportEvent) => void;
  /** 统计错误不影响通话流程。 */
  'stats:stats-error': (error: RTCStatsMonitor.StatsError) => void;
  'peerconnection:createofferfailed': AnyListener;
  'peerconnection:createanswerfailed': AnyListener;
  'peerconnection:setlocaldescriptionfailed': AnyListener;
  'peerconnection:setremotedescriptionfailed': AnyListener;
}

declare enum SessionStatus {
  STATUS_NULL = 0,
  STATUS_INVITE_SENT = 1,
  STATUS_1XX_RECEIVED = 2,
  STATUS_INVITE_RECEIVED = 3,
  STATUS_WAITING_FOR_ANSWER = 4,
  STATUS_ANSWERED = 5,
  STATUS_WAITING_FOR_ACK = 6,
  STATUS_CANCELED = 7,
  STATUS_TERMINATED = 8,
  STATUS_CONFIRMED = 9
}

export class RTCSession extends EventEmitter {
  static get C(): typeof SessionStatus;

  get C(): typeof SessionStatus;

  get causes(): typeof causes;

  get id(): string;

  set data(_data: any);
  get data(): any;

  get connection(): RTCPeerConnectionDeprecated;

  /** PC 创建后自动生成；会话关闭后恢复为 null。 */
  get statsMonitor(): RTCStatsMonitor | null;

  get contact(): string;

  get direction(): SessionDirection;

  get local_identity(): NameAddrHeader;

  get remote_identity(): NameAddrHeader;

  get start_time(): Date;

  get end_time(): Date;

  get status(): SessionStatus;

  getMediaEffectsComposer(): MediaEffectsComposerInstance | null;

  getAiNoiseSuppression(): AiNoiseSuppressionController | null;

  getAiVirtualBackground(): any | null;

  updateMediaEffectsComposer(options: MediaEffectsComposerSessionOptions | MediaEffectsComposerPatch | null): Promise<MediaEffectsComposerState | null>;

  isInProgress(): boolean;

  isEstablished(): boolean;

  isEnded(): boolean;

  isReadyToReOffer(): boolean;

  answer(options?: AnswerOptions): void;

  upgradeToVideo(options?: UpgradeToVideoOptions, done?: VoidFunction): any;

  demoteToAudio(options?: any, done?: VoidFunction): any;

  switchDevice(type: string, deviceId: string): any;

  share(type: string, id?: string, assembly?: any): void;

  unShare(): void;

  terminate(options?: TerminateOptions): void;

  sendDTMF(tones: string | number, options?: DTFMOptions): void;

  sendInfo(contentType: string, body?: string, options?: ExtraHeaders): void;

  hold(options?: HoldOptions, done?: VoidFunction): boolean;

  unhold(options?: HoldOptions, done?: VoidFunction): boolean;

  renegotiate(options?: RenegotiateOptions, done?: VoidFunction): boolean;

  isOnHold(): OnHoldResult;

  mute(options?: MediaConstraints): void;

  unmute(options?: MediaConstraints): void;

  setVideoContentHint(hint, share:boolean): void;

  isMuted(): MediaConstraints;

  refer(target: string | URI, options?: ReferOptions): void;

  resetLocalMedia(): void;

  on<T extends keyof RTCSessionEventMap>(type: T, listener: RTCSessionEventMap[T]): this;
}
