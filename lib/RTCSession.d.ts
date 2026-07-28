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
  aiBackground?: AiVBOptions | null;
  [key: string]: any;
}

export interface MediaEffectsComposerSourceState {
  id: string;
  streamId: string | null;
  slot: number | null;
  gain: number;
  sourceMirror: boolean | null;
  aiBackground: AiVBOptions | null;
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
  frameControlMode?: string;
  insertableActive?: boolean;
  insertableConfigured?: boolean;
  insertableSupported?: boolean;
  generatorType?: string;
  insertableReason?: string;
  writeFailures?: number;
  hasGeneratorTrack?: boolean;
  hasCaptureStream?: boolean;
  captureSinkActive?: boolean;
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
  mirrorWatermarks: boolean;
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
    aiBackground: boolean;
    aiBackgroundSupported: boolean;
    aiBackgroundEnabled: boolean;
    outputMirror: boolean;
    audioSubmix: boolean;
    insertableConfigured: boolean;
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
  dropBusyFrames?: boolean;
  maxFrameQueue?: number;
  keepDrawingBuffer?: boolean;
  insertable?: boolean;
  manualFrameControl?: boolean;
  mirror?: boolean;
  sourceMirror?: boolean;
  mirrorWatermarks?: boolean;
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
  mirrorWatermarks?: boolean;
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
  getWatermarkMirror(): boolean;
  setWatermarkMirror(enabled: boolean): Promise<MediaEffectsComposerConfigState>;
  setWatermarks(
    watermarks: MediaEffectsComposerWatermarkOptions[] | MediaEffectsComposerWatermarkOptions | null
  ): Promise<MediaEffectsComposerWatermarkState[]>;
  clearWatermarks(filter?: MediaEffectsComposerWatermarkFilter): Promise<MediaEffectsComposerConfigState>;
  getWatermarks(): MediaEffectsComposerWatermarkState[];
  setAiBackground(slotOrTarget: number | string | MediaStream | HTMLVideoElement, options: boolean | AiVBOptions | null): AiVBOptions | null;
  getAiBackground(slotOrTarget: number | string | MediaStream | HTMLVideoElement): AiVBOptions | null;
  clearAiBackground(slotOrTarget: number | string | MediaStream | HTMLVideoElement): void;
  setConfig(patch: MediaEffectsComposerConfigPatch): Promise<MediaEffectsComposerConfigState>;
  getRenderInfo(): MediaEffectsComposerRenderState;
  getAudioInfo(): MediaEffectsComposerAudioState;
  getCapabilities(): MediaEffectsComposerCapabilityReport;
  getOutput(options?: MediaEffectsComposerOutputRequest | 'mixed' | 'video' | 'audio'): Promise<MediaStream | null>;
  getMixedStream(): Promise<MediaStream>;
  getVideoStream(): MediaStream;
  getAudioStream(options?: { slots?: number[]; isolated?: boolean; audioContext?: 'shared' | 'isolated'; recreate?: boolean } | number[]): Promise<MediaStream | null>;
  getSubmixStream(options?: { slots?: number[] } | number[]): Promise<MediaStream | null>;
  releaseOutput(options: MediaEffectsComposerOutputRequest): boolean;
  releaseSubmixStream(options?: { slots?: number[]; isolated?: boolean } | number[]): boolean;
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
  setLevel(level: number): void;
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
  /** 默认 true；false 时重新协商失败不终止已有通话。 */
  terminateOnFailure?: boolean;
}

/** share() 支持的媒体类型；auxiliary 模式当前仅接受 screen。 */
export type ShareType = 'screen' | 'html' | 'pic' | 'video';

/**
 * 普通分享参数。对象写法可避免依赖位置参数，并与独立屏幕辅流保持统一调用形式。
 * 未填写的字段沿用历史默认值，不改变替换摄像头轨或 BFCP 双流行为。
 */
export interface ShareOptions {
  /** HTML、图片或视频元素的 CSS 选择器；screen 不需要填写。 */
  id?: string | null;
  /** HTML 分享所需的 DOM 转画布函数，例如 html2canvas。 */
  assembly?: any;
  /** 是否使用 BFCP 双流；默认 false，且必须与会话 BFCP 配置保持一致。 */
  dual?: boolean;
  /** 是否跳过 BFCP FloorRequest；默认 false，仅用于明确的兼容场景。 */
  skip?: boolean;
}

/**
 * 不依赖 BFCP 的独立屏幕辅流参数。
 *
 * 该模式新增一条 sendonly video m-line，不替换摄像头轨。三方会议可将同一份
 * MediaStream 传给多条 RTCSession，每条会话独立完成协商和远端状态通知。
 */
export interface AuxiliaryShareOptions {
  /** 固定值；用于和历史 boolean dual 参数区分。 */
  mode: 'auxiliary';
  /**
   * 复用已有屏幕流。适合多条 RTCSession 共用一次 getDisplayMedia 的结果；
   * 传入后默认由调用方负责停止，单条会话 unShare() 不会影响其他会话。
   */
  mediaStream?: MediaStream;
  /** 未传 mediaStream 时由 SDK 调用 getDisplayMedia 所使用的约束。 */
  displayMediaConstraints?: {
    video?: boolean | MediaTrackConstraints;
    audio?: boolean | MediaTrackConstraints;
  };
  /**
   * 是否在 unShare()/session close 时停止 MediaStream。
   * 默认遵循“谁采集谁释放”：SDK 采集为 true，外部传入为 false。
   */
  stopStreamOnUnShare?: boolean;
  /** 屏幕视频轨的 contentHint；默认 detail，优先保证桌面文字和 UI 清晰。 */
  contentHint?: 'detail' | 'text' | 'motion' | '';
}

/** 与 BFCP remoteShared 保持一致的共享流结构。 */
export interface SharedStreamSet {
  /** 只包含共享视频轨，可直接绑定到 HTMLVideoElement.srcObject。 */
  videoStream: MediaStream;
  /** 完整共享媒体流；当前 auxiliary 模式与 videoStream 包含同一视频轨。 */
  mediaStream: MediaStream;
}

/** 远端共享开始事件；BFCP 和 auxiliary 模式共用该类型。 */
export interface RemoteSharedEvent {
  sharedStream: SharedStreamSet;
  /** auxiliary 模式的共享 m-line MID；普通渲染代码通常不需要读取。 */
  mid?: string;
  /** auxiliary 模式匹配到的原始远端视频轨。 */
  track?: MediaStreamTrack;
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
  /** SDK 调用 getDisplayMedia 失败或浏览器不支持屏幕采集。 */
  'getdisplaymediafailed': AnyListener;
  /** 远端 BFCP/auxiliary 共享轨已就绪，可开始渲染。 */
  'remoteShared': (event: RemoteSharedEvent) => void;
  /** 远端主动停止、共享轨 ended 或 BFCP 释放后触发。 */
  'remoteUnShared': VoidFunction;
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

  /** 原始 composer 输入流；复用轨道前应先 clone，未启用 composer 时返回 null。 */
  getComposerInputStream(): MediaStream | null;

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

  /** 推荐写法：普通屏幕、HTML、图片和视频分享均使用二参对象。 */
  share(type: ShareType, options: ShareOptions): Promise<MediaStream | void>;

  /** 推荐写法：使用不替换摄像头的独立屏幕辅流。 */
  share(type: 'screen', options: AuxiliaryShareOptions): Promise<MediaStream>;

  /**
   * 兼容上一版的 options 位置。新代码应使用 `share('screen', options)`。
   * @deprecated 请改用二参写法
   */
  share(
    type: 'screen',
    id: string | null | undefined,
    assembly: any,
    options: AuxiliaryShareOptions
  ): Promise<MediaStream>;

  /** 历史页面元素、替换摄像头轨和 BFCP 共享调用。 */
  share(
    type: ShareType,
    id?: string | null,
    assembly?: any,
    dual?: boolean,
    skip?: boolean
  ): Promise<MediaStream | void>;

  /** 停止当前分享；auxiliary 模式可 await sender 和通知清理完成。 */
  unShare(): void | Promise<void>;

  terminate(options?: TerminateOptions): void;

  sendDTMF(tones: string | number, options?: DTFMOptions): void;

  sendInfo(contentType: string, body?: string, options?: ExtraHeaders): void;

  hold(options?: HoldOptions, done?: VoidFunction): boolean;

  unhold(options?: HoldOptions, done?: VoidFunction): boolean;

  renegotiate(options?: RenegotiateOptions, done?: (error?: Error) => void): boolean;

  isOnHold(): OnHoldResult;

  mute(options?: MediaConstraints): void;

  unmute(options?: MediaConstraints): void;

  setVideoContentHint(hint, share:boolean): void;

  isMuted(): MediaConstraints;

  refer(target: string | URI, options?: ReferOptions): void;

  on<T extends keyof RTCSessionEventMap>(type: T, listener: RTCSessionEventMap[T]): this;
}
