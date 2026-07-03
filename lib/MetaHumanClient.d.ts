/// <reference types="node" />
import {EventEmitter} from 'events';

// ---- Option interfaces ----

export interface MetaHumanAudioConstraints {
  /** 默认 48000 */
  sampleRate?: number;
  /** 默认 1，AiNS/deepfilter 使用单声道输入 */
  channelCount?: number;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
  /** AiNS 启用时内部会强制归一为 false，避免双重降噪 */
  noiseSuppression?: boolean;
  latency?: { ideal: number };
}

export interface MetaHumanAiNsAssetConfig {
  cdnUrl: string;
}

export interface MetaHumanAiNsOptions {
  /** 是否启用降噪，默认 true */
  enabled?: boolean;
  /** 降噪强度 0-100，默认 80 */
  noiseReductionLevel?: number;
  /** WASM 资源 CDN 配置 */
  assetConfig?: MetaHumanAiNsAssetConfig;
}

export interface MetaHumanClientOptions {
  /** 数字人后端服务地址（必填） */
  server: string;
  /** ICE 服务器列表 */
  iceServers?: Array<{ urls: string; username?: string; credential?: string }>;
  /** 数字人头像标识 */
  avatar?: string;
  /** ASR/TTS 处理开关（0 不处理，1 处理），默认 0 */
  flag?: number;
  /** 麦克风采集约束 */
  audioConstraints?: MetaHumanAudioConstraints;
  /** 指定麦克风设备 deviceId */
  micDeviceId?: string;
  /** AI 降噪配置（可选，传入则启用） */
  aiNoiseSuppression?: MetaHumanAiNsOptions;
}

// ---- Event payload interfaces ----

export interface MetaHumanTrackEvent {
  /** 远端数字人视频流 */
  stream: MediaStream;
}

export interface MetaHumanErrorEvent {
  /** 错误描述 */
  cause: string;
}

export type MetaHumanClientState = 'idle' | 'connecting' | 'connected' | 'closed';

export interface MetaHumanStateChangedEvent {
  /** 连接状态：'idle' | 'connecting' | 'connected' | 'closed' */
  state: MetaHumanClientState;
}

export interface MetaHumanMediaEffectsIssueEvent {
  module: string;
  component: string;
  stage: string;
  severity: 'debug' | 'warn' | 'error';
  message: string;
  fallbackApplied: boolean;
  degraded: boolean;
  details?: Record<string, unknown> | null;
}

export interface MetaHumanAiNoiseSuppressionController {
  setEnabled(enable: boolean): Promise<boolean>;
  setSuppressionLevel(level: number): void;
  isEnabled(): boolean;
}

// ---- Listener types ----

export type MetaHumanTrackListener = (event: MetaHumanTrackEvent) => void;
export type MetaHumanErrorListener = (event: MetaHumanErrorEvent) => void;
export type MetaHumanStateChangedListener = (event: MetaHumanStateChangedEvent) => void;

// ---- Event map ----

export interface MetaHumanClientEventMap {
  track: MetaHumanTrackListener;
  error: MetaHumanErrorListener;
  stateChanged: MetaHumanStateChangedListener;
  mediaEffectsIssue: (event: MetaHumanMediaEffectsIssueEvent) => void;
}

// ---- Exported class ----

export class MetaHumanClient extends EventEmitter {
  constructor(options: MetaHumanClientOptions);

  /** 当前连接状态 */
  get state(): MetaHumanClientState;

  /** 获取当前 AiNS 控制器 */
  getAiNoiseSuppression(): MetaHumanAiNoiseSuppressionController | null;

  /** 发起连接，返回 Promise */
  connect(): Promise<void>;

  /** 关闭连接，释放资源 */
  close(): void;

  /** 更新配置（下次 connect 生效） */
  updateConfig(updates: {
    avatar?: string;
    flag?: number;
    audioConstraints?: MetaHumanAudioConstraints;
    micDeviceId?: string | null;
    aiNoiseSuppression?: MetaHumanAiNsOptions | null;
  }): void;

  on<T extends keyof MetaHumanClientEventMap>(type: T, listener: MetaHumanClientEventMap[T]): this;
  once<T extends keyof MetaHumanClientEventMap>(type: T, listener: MetaHumanClientEventMap[T]): this;
  off<T extends keyof MetaHumanClientEventMap>(type: T, listener: MetaHumanClientEventMap[T]): this;
}
