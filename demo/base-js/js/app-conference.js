/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable no-undef */

// =============================================================================
// 三方会议（A 为浏览器侧桥接端）
//
// 三方模式下 A 同时与 B、C 建立两路独立的 RTCSession，通过 MediaEffectsComposer
// 将 B 和 C 的远端音视频轨合成后分别发送给对方，实现浏览器侧媒体桥接。
//
// Demo 中的 A 始终是桥接端；B 和 C 作为普通参与端使用点对点模式接入。
// 静默 C（silent C）以 recvonly 方向接入，只收不发，不占用上行带宽。
// =============================================================================

// 三方最多 2 路成员（B + C）
const CONFERENCE_MAX_LEGS = 2;
// session.id → leg 对象的映射，管理所有会议成员会话
const conferenceLegs = new Map();

// 待确认的外呼会话参数，newRTCSession 事件中使用后清除
let conferencePendingOutgoing = null;
// 当前在统计面板和控制栏中选中的成员会话 ID
let conferenceSelectedLegId = null;
// A-B 主会话的 MediaEffectsComposer 实例，用于合成 B + C 的远端媒体
let conferenceComposer = null;
// 当前 composer 所属的会话 ID（可能是 A-B 或静默 C 的会话）
let conferenceComposerHostId = null;
// 会议屏幕共享的 MediaStream
let conferenceScreenStream = null;
// 是否正在发起屏幕共享（防止并发启动）
let conferenceScreenStarting = false;
// 媒体合成调度队列，确保合成操作串行执行
let conferenceSyncQueue = Promise.resolve();
// 媒体合成防抖定时器
let conferenceSyncTimer = null;
// 当前合成签名字符串，用于跳过无变化的重复合成
let conferenceComposerSyncSignature = '';

/**
 * 读取 SIP 请求中的自定义头部字段。
 * 用于识别 X-Silent-Join 等三方特有的信令标记。
 *
 * @param {object} request - SIP 请求对象（invite/reinvite）
 * @param {string} name - 头部字段名称
 * @returns {string|null} 头部字段值，不存在则返回 null
 */
function getConferenceRequestHeader(request, name)
{
  try
  {
    return request && request.getHeader ? request.getHeader(name) : null;
  }
  catch (error)
  {
    return null;
  }
}

/**
 * 判断 SIP 头部字段的布尔语义。
 * 支持 'true'、'1'、'yes' 及其大小写变体，忽略参数部分（如 ;param）。
 */
function isConferenceHeaderEnabled(value)
{
  const normalized = String(value || '').split(';')[0].trim().toLowerCase();

  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/**
 * 按角色（B 或 C）查找对应的会议成员。
 *
 * @param {'B'|'C'} role - 成员角色
 * @returns {object|null} 匹配的 leg 对象
 */
function getConferenceLegByRole(role)
{
  return Array.from(conferenceLegs.values()).find((leg) => leg.role === role) || null;
}

/**
 * 获取成员的展示角色名（B 或 C）。
 */
function getConferenceDisplayRole(leg)
{
  return leg ? leg.role : '';
}

/**
 * 获取下一个可用角色。
 * B 优先被分配，B 已存在时返回 C。
 */
function getConferenceNextRole()
{
  return getConferenceLegByRole('B') ? 'C' : 'B';
}

/**
 * 获取所有已确认且未结束的会议成员。
 */
function getConferenceConfirmedLegs()
{
  return Array.from(conferenceLegs.values()).filter((leg) => leg.confirmed && !leg.ended);
}

/**
 * 获取当前选中的会议成员。
 *
 * 优先返回用户手动选中的成员；否则返回第一个可见成员（非静默、未结束）；
 * 再回退到任意未结束成员。
 */
function getConferenceSelectedLeg()
{
  if (conferenceSelectedLegId && conferenceLegs.has(conferenceSelectedLegId))
  {
    const selectedLeg = conferenceLegs.get(conferenceSelectedLegId);

    if (!selectedLeg.ended)
    {
      return selectedLeg;
    }
  }

  const activeLegs = Array.from(conferenceLegs.values()).filter((leg) => !leg.ended);
  const visibleLeg = activeLegs.find((leg) => !leg.silent);

  return visibleLeg || activeLegs[0] || null;
}

// =============================================================================
// 呼叫媒体与 composer 输出准备
//
// 三方会议中 A 作为桥接端，需要 MediaEffectsComposer 来合成 B 和 C 的远端轨。
// A-B 主会话的 composer 输出视频（A+B+C 合成画面），同时按 slot 混音，
// 分别为 B 发送 A+C 的音频、为 C 发送 A+B 的音频。
// =============================================================================

/**
 * 构建三方会议的 MediaEffectsComposer 配置。
 * 与点对点模式共用 buildCallComposerOptions()，但强制启用 insertable 模式，
 * 确保即使页面未选择任何特效，主会话也持有可动态添加远端源的 composer。
 */
function buildConferenceComposerOptions()
{
  const options = Object.assign({}, buildCallComposerOptions() || {});

  // 即使页面没有选择特效，主会话也必须创建 composer，供三方动态加源。
  options.enableInsertable = true;

  return options;
}

/**
 * 获取当前会议的 MediaEffectsComposer 实例。
 *
 * 优先返回缓存的 conferenceComposer；否则尝试从 A-B 主会话获取。
 * 供 app-media-effects.js 中的 getSessionComposerHandles() 调用，
 * 让媒体特效面板在三方模式下操作正确的 composer。
 */
function getConferenceMediaEffectsComposer()
{
  if (conferenceComposer)
  {
    return conferenceComposer;
  }

  const hostLeg = getConferenceLegByRole('B');

  return hostLeg && hostLeg.session.getMediaEffectsComposer ?
    hostLeg.session.getMediaEffectsComposer() : null;
}

/**
 * 构建三方模式下的 extraFeatures 列表。
 *
 * 三方屏幕共享通过 addTransceiver + renegotiate 自行协商第二条 video m-line，
 * 不使用 BFCP 占位轨，因此需要从 extraFeatures 中移除 BFCP，
 * 避免 SDK 为每一路会话都插入无用的 BFCP 扩展。
 */
function buildConferenceExtraFeatures()
{
  // 三方屏幕共享自行协商第二条 video m-line，不使用 BFCP 占位轨。
  return extraFeatures.filter((feature) => String(feature).toUpperCase() !== 'BFCP');
}

/**
 * 确保 A-B 主会话拥有可用的 MediaEffectsComposer。
 *
 * 如果主会话尚未创建 composer，则调用 updateMediaEffectsComposer 初始化。
 * 创建成功后刷新本端预览，确保 composer 的原始输入流正确绑定到 localVideo。
 *
 * @throws {Error} 如果主会话不存在或无法创建 composer
 */
async function ensureConferenceHostComposer(hostLeg)
{
  if (!hostLeg || !hostLeg.session)
  {
    throw new Error('A-B 主会话不存在');
  }

  let composer = hostLeg.session.getMediaEffectsComposer && hostLeg.session.getMediaEffectsComposer();

  if (!composer && hostLeg.session.updateMediaEffectsComposer)
  {
    await hostLeg.session.updateMediaEffectsComposer(buildConferenceComposerOptions());
    composer = hostLeg.session.getMediaEffectsComposer();
    renderConferenceLocalVideo(hostLeg);
  }

  if (!composer)
  {
    throw new Error('A-B 主会话无法创建 MediaEffectsComposer');
  }

  return composer;
}

/**
 * 克隆 A 的原始媒体流作为降级备用。
 *
 * 当 composer 宿主（A-B 主会话）因 B 挂断而销毁时，保留的普通 C 需要回退到
 * 未合成的 A 原始轨继续 A-C 通话。此克隆流独立于 composer 生命周期。
 *
 * @throws {Error} 如果从 A-B 主会话取不到原始媒体流
 */
function cloneConferenceFallbackLocalStream(hostLeg)
{
  const sourceStream = hostLeg.session.getComposerInputStream &&
    hostLeg.session.getComposerInputStream();

  if (!sourceStream || sourceStream.getTracks().length === 0)
  {
    throw new Error('A-B 主会话没有可复用的 A 原始媒体流');
  }

  const fallbackStream = new MediaStream();

  sourceStream.getTracks().forEach((track) => fallbackStream.addTrack(track.clone()));

  return fallbackStream;
}

/**
 * 用 composer 输出轨构建 MediaStream。
 * 视频轨来自 composer.getVideoStream()，音频轨来自指定的音频流。
 */
function buildConferenceComposerOutputStream(videoTrack, audioStream)
{
  const stream = new MediaStream();
  const audioTrack = audioStream && audioStream.getAudioTracks()[0];

  if (audioTrack) stream.addTrack(audioTrack);
  if (videoTrack) stream.addTrack(videoTrack);

  return stream;
}

/**
 * 为普通 C（非静默）准备 A-B 主 composer 的输出流。
 *
 * 执行步骤：
 * 1. 确保 B 的远端流已添加到 composer slot 1
 * 2. 从 composer 获取合成视频轨
 * 3. 从 composer 获取 C 的混音（slot 0+1，即 A+B）
 * 4. 从 composer 获取 B 的混音（slot 0+2，即 A+C），替换 B 的音频 sender
 * 5. 返回包含合成视频 + C 混音的 mediaStream，作为 C 呼叫时的媒体输入
 *
 * 这样 C 在 INVITE 阶段就绑定了稳定的 composer 输出轨（A+B 合成画面 + A+B 混音）。
 * C 确认后只需向 composer 加入 C 的远端源，无需替换 C 的 sender track。
 */
async function prepareNormalCComposerOutput(hostLeg)
{
  const composer = await ensureConferenceHostComposer(hostLeg);
  const fallbackLocalStream = cloneConferenceFallbackLocalStream(hostLeg);

  try
  {
    hydrateConferenceRemoteMainStream(hostLeg);
    updateConferenceComposerSource(composer, hostLeg, hostLeg.remoteMainStream, 1);

    const videoTrack = composer.getVideoStream().getVideoTracks()[0];

    if (!videoTrack)
    {
      throw new Error('A-B composer 没有输出视频轨');
    }

    const cAudioStream = await composer.getAudioStream({ slots: [ 0, 1 ] });
    const bAudioStream = await composer.getAudioStream({ slots: [ 0, 2 ] });
    const bAudioTrack = bAudioStream && bAudioStream.getAudioTracks()[0];

    rememberConferenceOriginalSenders(hostLeg);
    if (hostLeg.originalAudioSender && bAudioTrack)
    {
      await hostLeg.originalAudioSender.replaceTrack(bAudioTrack);
    }

    hostLeg.conferenceAudioStream = bAudioStream;
    conferenceComposer = composer;
    conferenceComposerHostId = hostLeg.session.id;

    return {
      mediaStream           : buildConferenceComposerOutputStream(videoTrack, cAudioStream),
      conferenceAudioStream : cAudioStream,
      fallbackLocalStream,
      normalComposerHostId  : hostLeg.session.id
    };
  }
  catch (error)
  {
    await rollbackNormalCComposerOutput(hostLeg, { fallbackLocalStream });
    throw error;
  }
}

/**
 * 回滚 prepareNormalCComposerOutput 的状态变更。
 *
 * 在 C 呼叫失败或 composer 宿主切换时需要调用，确保：
 * - 移除已添加到 composer 的 B 远端源
 * - 恢复 B 的原始音频 sender
 * - 释放已创建的混音输出和降级流
 */
async function rollbackNormalCComposerOutput(hostLeg, output)
{
  const composer = hostLeg && hostLeg.session.getMediaEffectsComposer &&
    hostLeg.session.getMediaEffectsComposer();

  if (composer && hostLeg.composerSourceStream)
  {
    try { composer.removeSource(hostLeg.composerSourceStream); }
    catch (error) {}
    hostLeg.composerSourceStream = null;
  }

  await restoreConferenceLegOriginalMedia(hostLeg);

  if (composer)
  {
    try { composer.releaseSubmixAudioStream({ slots: [ 0, 2 ] }); }
    catch (error) {}
    try { composer.releaseSubmixAudioStream({ slots: [ 0, 1 ] }); }
    catch (error) {}
  }

  if (hostLeg) hostLeg.conferenceAudioStream = null;
  if (output && output.fallbackLocalStream)
  {
    CRTC.Utils.closeMediaStream(output.fallbackLocalStream);
  }

  if (hostLeg && conferenceComposerHostId === hostLeg.session.id)
  {
    conferenceComposer = null;
    conferenceComposerHostId = null;
    conferenceComposerSyncSignature = '';
  }
}

/**
 * 构建三方会议外呼的 call options。
 *
 * @param {'B'|'C'} role - 呼叫的角色
 * @param {object|null} normalCOutput - prepareNormalCComposerOutput 的返回值，C 呼出时必传
 *
 * B 的呼叫：使用用户选择的摄像头/麦克风约束，创建独立的 composer。
 * C 的呼叫（非静默）：使用 A-B 主 composer 的输出流作为 mediaStream，
 *   传入 { audio: true, video: true } 告诉 SDK 保留已有轨道、不重复采集。
 *   这样 C 在 INVITE 阶段就绑定了稳定的 composer 输出轨。
 */
function buildConferenceCallOptions(role, normalCOutput)
{
  const options = {
    extraHeaders : [
      `X-Data: ${xdata}`,
      `X-UA: ${navigator.userAgent}`,
      'X-Direction: sendrecv'
    ],
    extraFeatures : buildConferenceExtraFeatures(),
    pcConfig      : pcConfig,
    eventHandlers : {
      mediaEffectsIssue : handleSessionMediaEffectsIssue
    }
  };

  if (role === 'B')
  {
    options.mediaConstraints = {
      audio : buildSelectedAudioConstraints(),
      video : buildSelectedVideoConstraints()
    };
    options.rtcOfferConstraints = {
      offerToReceiveAudio : true,
      offerToReceiveVideo : true
    };
    options.mediaEffectsComposer = buildConferenceComposerOptions();
    options.aiNoiseSuppression = buildCallAiNsOptions();

    return options;
  }

  // 普通 C 在 INVITE 创建时就绑定 A-B 主 composer 的稳定输出轨。
  // 通话确认后只向 composer 加入 C 源，不再替换 C 的 sender。
  if (!normalCOutput || !normalCOutput.mediaStream)
  {
    throw new Error('普通 C 缺少 A-B composer 输出流');
  }
  options.mediaStream = normalCOutput.mediaStream;
  // true 表示保留自定义流中已有的轨道。RTCSession 会在识别到
  // mediaStream 轨道后自动关闭重复 getUserMedia，不能传 false 或留空。
  options.mediaConstraints = { audio: true, video: true };
  options.rtcOfferConstraints = {
    offerToReceiveAudio : true,
    offerToReceiveVideo : true
  };
  options.aiNoiseSuppression = buildCallAiNsOptions();

  return options;
}

/**
 * 构建三方会议接听的 answer options。
 *
 * @param {object} leg - 待接听的会议成员
 * @param {object|null} normalCOutput - 普通 C 的 composer 输出
 *
 * B 的接听：使用用户选择的设备约束，创建独立 composer。
 * 普通 C 的接听：复用 prepareNormalCComposerOutput 的输出流。
 * 静默 C 的接听：使用独立 composer，应答时以 A 的设备流创建输出；
 *   会话确认后再动态加入 B 的远端源。
 */
function buildConferenceAnswerOptions(leg, normalCOutput)
{
  const options = {
    pcConfig     : Object.assign({}, pcConfig, { rtcpMuxPolicy: 'negotiate' }),
    extraHeaders : [
      `X-Data: ${xdata}`,
      `X-UA: ${navigator.userAgent}`,
      `X-Direction: ${leg.localDirection}`
    ],
    extraFeatures       : buildConferenceExtraFeatures(),
    rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true }
  };

  if (leg.role === 'B')
  {
    options.mediaConstraints = {
      audio : buildSelectedAudioConstraints(),
      video : buildSelectedVideoConstraints()
    };
    options.mediaEffectsComposer = buildConferenceComposerOptions();
    options.aiNoiseSuppression = buildCallAiNsOptions();
  }
  else
  {
    if (leg.silent)
    {
      // 静默 C 使用独立 composer：answer 时先以 A 的设备流创建输出，
      // 会话确认后再动态加入 B，不会影响 A-B 主会话。
      options.mediaConstraints = {
        audio : buildSelectedAudioConstraints(),
        video : buildSelectedVideoConstraints()
      };
      options.mediaEffectsComposer = buildConferenceComposerOptions();
    }
    else
    {
      if (!normalCOutput || !normalCOutput.mediaStream)
      {
        throw new Error('普通 C 缺少 A-B composer 输出流');
      }
      options.mediaStream = normalCOutput.mediaStream;
      options.mediaConstraints = { audio: true, video: true };
    }
    options.aiNoiseSuppression = buildCallAiNsOptions();
  }

  return options;
}

// =============================================================================
// 会话模型
//
// 每个会议成员（B 或 C）用一个 leg 对象管理其 RTCSession、远端媒体轨、
// 屏幕共享状态和 composer 合成输入。leg 的生命周期从 newRTCSession 事件开始，
// 到会话 ended/failed 事件结束。
// =============================================================================

/**
 * 创建会议成员 leg 对象。
 *
 * 每个 leg 保存以下关键信息：
 * - session：RTCSession 实例
 * - role：B 或 C
 * - originator：'local'（A 主动外呼）或 'remote'（A 被动接听）
 * - silent：是否为静默成员（只收不发）
 * - confirmed：媒体协商是否已确认
 * - remoteMainStream/remoteMainAudioTrack/remoteMainVideoTrack：远端媒体轨
 * - originalAudioSender/originalVideoSender/originalAudioTrack/originalVideoTrack：
 *   原始 sender 和 track 快照，用于 composer 降级恢复
 * - screenTransceiver/screenSender/screenMid/screenActive/screenTarget：屏幕共享状态
 *
 * 创建 leg 时自动将其注册到 conferenceLegs，并根据可见性设置默认选中。
 */
function createConferenceLeg(session, sessionOptions)
{
  const leg = {
    session,
    role                  : sessionOptions.role,
    remoteNo              : sessionOptions.remoteNo,
    originator            : sessionOptions.originator,
    localDirection        : sessionOptions.localDirection || 'sendrecv',
    silent                : Boolean(sessionOptions.silent),
    confirmed             : false,
    answering             : false,
    answerTimer           : null,
    signalingStage        : 'created',
    autoAnswer            : Boolean(sessionOptions.autoAnswer),
    ended                 : false,
    remoteMainStream      : new MediaStream(),
    remoteMainAudioTrack  : null,
    remoteMainVideoTrack  : null,
    originalAudioSender   : null,
    originalVideoSender   : null,
    originalAudioTrack    : null,
    originalVideoTrack    : null,
    fallbackLocalStream   : sessionOptions.fallbackLocalStream || null,
    normalComposerHostId  : sessionOptions.normalComposerHostId || null,
    composerSourceStream  : null,
    conferenceAudioStream : sessionOptions.conferenceAudioStream || null,
    audioElement          : null,
    screenTransceiver     : null,
    screenSender          : null,
    screenMid             : null,
    screenActive          : false,
    screenTarget          : false,
    trackListenerAttached : false,
    latestStatsReport     : null
  };

  conferenceLegs.set(session.id, leg);
  // 非静默成员或第一个成员自动成为当前选中
  if (!leg.silent || conferenceLegs.size === 1)
  {
    conferenceSelectedLegId = session.id;
    rtcSession = session;
  }

  return leg;
}

// =============================================================================
// 当前会议成员的通话统计与通用控制
//
// 三方会议中 A 与 B、C 分别维护独立的 PeerConnection，统计面板需要
// 根据当前选中的成员动态切换展示内容。所有统计相关信息通过
// RTCSession 的 stats:detailed-report 事件消费。
// =============================================================================

/**
 * 写统计面板文本的便捷方法。
 */
function setConferenceStatsText(selector, value)
{
  const element = document.querySelector(selector);

  if (element) element.textContent = value;
}

// stats:detailed-report 中 quality.issues 编码对应的中文名
const conferenceStatsIssueNames = {
  CONNECTION_UNAVAILABLE       : '连接不可用',
  CONNECTION_PATH_CHANGED      : '网络路径变化',
  DOWNLINK_HIGH_JITTER         : '下行高抖动',
  DOWNLINK_JITTER_BUFFER_DELAY : '下行缓冲过高',
  DOWNLINK_PACKET_DISCARDS     : '下行本地丢弃',
  DOWNLINK_PACKET_LOSS         : '下行丢包',
  DOWNLINK_TRANSPORT_STALLED   : '下行传输停滞',
  DOWNLINK_FEEDBACK_REQUESTS   : '下行重传请求多',
  ENCODER_CPU_LIMITED          : '编码器CPU受限',
  ENCODER_FRAME_RATE_REDUCED   : '编码帧率下降',
  ENCODER_RESOLUTION_REDUCED   : '编码分辨率下降',
  ENCODER_SLOW                 : '编码器过慢',
  HIGH_RTT                     : '高延迟',
  UPLINK_BANDWIDTH_BUDGET_LOW  : '上行可用带宽不足',
  UPLINK_BANDWIDTH_LIMITED     : '上行带宽受限',
  UPLINK_FEEDBACK_REQUESTS     : '上行重传请求多',
  UPLINK_HIGH_RETRANSMISSION   : '上行重传率高',
  UPLINK_LOCAL_SEND_DISCARDS   : '上行本地丢弃',
  UPLINK_PACKET_LOSS           : '上行丢包',
  UPLINK_SEND_QUEUE_DELAY      : '上行发送排队',
  VIDEO_DECODER_SLOW           : '解码器过慢',
  VIDEO_FRAME_DROPPING         : '视频丢帧',
  VIDEO_FREEZING               : '视频卡顿',
  VIDEO_PAUSING                : '视频暂停'
};
// 网络质量等级对应的中文名
const conferenceStatsQualityNames = [ '暂无数据', '极佳', '较好', '一般', '差', '极差', '严重异常' ];

function formatConferenceStatsNumber(value, unit)
{
  return value === null || value === undefined ? '-' : `${value}${unit || ''}`;
}

function formatConferenceStatsBitrate(value)
{
  return value === null || value === undefined ? '-' : `${(Math.round(value / 100) / 10).toFixed(1)}kbps`;
}

function formatConferenceNetworkQuality(value)
{
  if (value === null || value === undefined)
  {
    return '-';
  }

  return `${conferenceStatsQualityNames[value] || '未知'}(${value})`;
}

function getConferenceStatsStreamName(stream)
{
  return stream.kind === 'audio' || stream.type === 'audio' ? '音频' : '视频';
}

function appendConferenceStatsRow(table, values)
{
  values.forEach((value) =>
  {
    const cell = document.createElement('span');

    cell.className = 'rtc-stats-cell';
    cell.textContent = value;
    table.appendChild(cell);
  });
}

function renderConferenceStatsStreams(selector, streams, outbound)
{
  const element = document.querySelector(selector);
  const sortedStreams = (streams || []).slice().sort((left, right) =>
  {
    const leftKindOrder = getConferenceStatsStreamName(left) === '音频' ? 0 : 1;
    const rightKindOrder = getConferenceStatsStreamName(right) === '音频' ? 0 : 1;

    if (leftKindOrder !== rightKindOrder) return leftKindOrder - rightKindOrder;

    return String(left.mid === null ? '' : left.mid).localeCompare(
      String(right.mid === null ? '' : right.mid), undefined, { numeric: true }
    );
  });

  if (!element) return;
  element.textContent = '';

  if (sortedStreams.length === 0)
  {
    element.textContent = '无';

    return;
  }

  const table = document.createElement('div');

  table.className = 'rtc-stats-metric-table';
  sortedStreams.forEach((stream) =>
  {
    const streamName = getConferenceStatsStreamName(stream);
    const feedback = stream.remoteInbound;
    const bitrate = outbound ? stream.actualBitrateBps : stream.receiveBitrateBps;
    const jitter = outbound ? feedback && feedback.jitterMs : stream.jitterMs;
    const loss = outbound ? feedback && feedback.intervalLossPercent : stream.intervalLossPercent;

    appendConferenceStatsRow(table, [
      `${streamName}[${stream.mid === null || stream.mid === undefined ? '-' : stream.mid}]`,
      `编码:${stream.codec && stream.codec.name ? stream.codec.name : '-'}`,
      `码率:${formatConferenceStatsBitrate(bitrate)}`,
      `抖动:${formatConferenceStatsNumber(jitter, 'ms')}`,
      `丢包:${formatConferenceStatsNumber(loss, '%')}`
    ]);

    if (streamName === '视频')
    {
      appendConferenceStatsRow(table, [
        '',
        `画面:${stream.frameWidth === null || stream.frameWidth === undefined ||
          stream.frameHeight === null || stream.frameHeight === undefined ?
          '-' : `${stream.frameWidth}x${stream.frameHeight}`}`,
        `FPS:${formatConferenceStatsNumber(stream.framesPerSecond)}`,
        outbound ? `编码:${formatConferenceStatsNumber(stream.averageEncodeTimeMs, 'ms')}` :
          `解码:${formatConferenceStatsNumber(stream.averageDecodeTimeMs, 'ms')}`,
        outbound ? `限制:${stream.qualityLimitationReason || '-'}` : ''
      ]);
    }
  });
  element.appendChild(table);
}

function renderConferenceConnectionStats(connection)
{
  const element = document.querySelector('#rtcStatsConnection');

  if (!element) return;

  const table = document.createElement('div');

  table.className = 'rtc-stats-connection-table';
  appendConferenceStatsRow(table, [
    `状态:${connection.connectionState || '-'}`,
    `ICE:${connection.iceConnectionState || '-'}`,
    `DTLS:${connection.dtlsState || '-'}`
  ]);
  appendConferenceStatsRow(table, [
    `↑:${formatConferenceStatsBitrate(connection.sendBitrateBps)}/可用${formatConferenceStatsBitrate(connection.availableOutgoingBitrateBps)}`,
    `↓:${formatConferenceStatsBitrate(connection.receiveBitrateBps)}/可用${formatConferenceStatsBitrate(connection.availableIncomingBitrateBps)}`,
    ''
  ]);
  element.textContent = '';
  element.appendChild(table);
}

function renderConferenceStatsReport(leg, report)
{
  if (!leg || !report || statsSession !== leg.session)
  {
    return;
  }

  const quality = report.quality || {};
  const connection = report.connection || {};
  const issues = (quality.issues || []).map((issue) =>
    `${conferenceStatsIssueNames[issue.code] || issue.code}(L${issue.severity})`).join(' | ');

  renderConferenceConnectionStats(connection);
  setConferenceStatsText(
    '#rtcStatsQuality',
    `RTT:${formatConferenceStatsNumber(quality.RTT, 'ms')} | ` +
    `↑:${formatConferenceNetworkQuality(quality.uplinkNetworkQuality)} | ` +
    `↓:${formatConferenceNetworkQuality(quality.downlinkNetworkQuality)}`
  );
  setConferenceStatsText('#rtcStatsIssues', issues || '无');
  renderConferenceStatsStreams('#rtcStatsOutbound', report.outbound, true);
  renderConferenceStatsStreams('#rtcStatsInbound', report.inbound, false);
}

function renderConferenceStatsPeerLabels(leg)
{
  const role = getConferenceDisplayRole(leg);
  const remote = leg.remoteNo || '-';

  setConferenceStatsText('#rtcStatsPeerConnection', `A-${role} PeerConnection（${role}: ${remote}）`);
  setConferenceStatsText('#rtcStatsOutboundLabel', `A → ${role}:`);
  setConferenceStatsText('#rtcStatsInboundLabel', `${role} → A:`);
}

/**
 * 选中会议成员并更新统计面板。
 *
 * 切换 conferenceSelectedLegId 和 rtcSession，刷新 PeerConnection 标题、
 * 上行/下行标签，并渲染最新统计报告。
 */
function selectConferenceLeg(leg)
{
  if (!leg || leg.ended)
  {
    return;
  }

  conferenceSelectedLegId = leg.session.id;
  rtcSession = leg.session;
  statsSession = leg.session;
  renderConferenceStatsPeerLabels(leg);

  if (leg.latestStatsReport)
  {
    renderConferenceStatsReport(leg, leg.latestStatsReport);
  }
  else
  {
    [ '#rtcStatsConnection', '#rtcStatsQuality', '#rtcStatsOutbound', '#rtcStatsInbound' ]
      .forEach((selector) => setConferenceStatsText(selector, '--'));
    setConferenceStatsText('#rtcStatsIssues', '无');
  }
}

function bindConferenceStatsEvents(leg)
{
  leg.session.on('stats:detailed-report', (report) =>
  {
    leg.latestStatsReport = report;
    renderConferenceStatsReport(leg, report);
  });

  leg.session.on('stats:stats-error', (error) =>
  {
    if (statsSession === leg.session)
    {
      console.warn('[conference] stats error', error);
    }
  });

  if (conferenceSelectedLegId === leg.session.id)
  {
    selectConferenceLeg(leg);
  }
}

/**
 * 以当前选中成员为目标执行操作。
 *
 * 所有控制栏按钮（静音、保持、挂断等）都通过此函数统一获取当前选中的
 * 会议成员会话并执行操作，避免每个按钮重复检查有效性。
 */
function withConferenceSelectedSession(action, callback)
{
  const leg = getConferenceSelectedLeg();

  if (!leg || leg.ended)
  {
    setStatus(`无法${action}：当前没有可用的会议会话`);

    return;
  }

  try
  {
    return callback(leg.session, leg);
  }
  catch (error)
  {
    console.warn(`[conference] ${action} failed`, error);
    setStatus(`${action}失败：${error.message || error}`);
  }
}

/**
 * 绑定当前选中成员的控制按钮（静音、保持、挂断、DTMF 等）。
 * 在三方模式启用时由 updateConferenceUi 调用，将控制栏按钮事件
 * 重定向到当前选中的成员会话。
 */
function bindConferenceSelectedSessionControls()
{
  const bindClick = (selector, handler) =>
  {
    const element = document.querySelector(selector);

    if (element) element.onclick = handler;
  };

  bindClick('#cancel', () => withConferenceSelectedSession('挂断', (session) => session.terminate()));
  bindClick('#muteMic', () => withConferenceSelectedSession('关闭麦克风', (session) => session.mute({ audio: true })));
  bindClick('#unmuteMic', () => withConferenceSelectedSession('开启麦克风', (session) => session.unmute({ audio: true })));
  bindClick('#muteCam', () => withConferenceSelectedSession('关闭摄像头', (session) => session.mute({ video: true })));
  bindClick('#unmuteCam', () => withConferenceSelectedSession('开启摄像头', (session) => session.unmute({ video: true })));
  bindClick('#hold', () => withConferenceSelectedSession('切换保持状态', (session) =>
  {
    const holdState = session.isOnHold();

    if (holdState.local) session.unhold();
    else if (!holdState.remote) session.hold();
  }));
  bindClick('#dtmf', (event) => withConferenceSelectedSession('发送 DTMF', (session) =>
  {
    session.sendDTMF(event.target.innerText, { transportType: 'RFC2833' });
  }));
  bindClick('#sendInfo', () => withConferenceSelectedSession('发送 INFO', (session) =>
  {
    session.sendInfo('text/plain', JSON.stringify(document.querySelector('#info').value));
  }));
  bindClick('#switchDevice', () => withConferenceSelectedSession('切换摄像头', (session) =>
  {
    session.switchDevice('camera', camFlag ? 'environment' : 'user')
      .then(() => session.renegotiate())
      .catch((error) => setStatus(`切换摄像头失败：${error.message || error}`));
    camFlag = !camFlag;
  }));

  const videoHint = document.querySelector('#videoHint');

  if (videoHint)
  {
    videoHint.onchange = function()
    {
      withConferenceSelectedSession('设置视频内容类型', (session) =>
        session.setVideoContentHint(this.options[this.selectedIndex].value));
    };
  }
}

// =============================================================================
// 会话识别、远端媒体与 RTCSession 事件
//
// 三方模式下 newRTCSession 事件由 handleConferenceNewRTCSession 统一处理。
// 它负责分类呼入角色（B/C/静默）、创建 leg、绑定事件并决定是否自动接听。
// =============================================================================

/**
 * 从 newRTCSession 事件中提取远端号码。
 */
function getConferenceRemoteNumber(e)
{
  try
  {
    return e.originator === 'remote' ? e.request.from.uri.user : e.request.to.uri.user;
  }
  catch (error)
  {
    return '';
  }
}

/**
 * 从 newRTCSession 事件解析会话创建参数。
 *
 * 本地外呼：使用 pending 队列中的 sessionOptions。
 * 远端呼入：根据 X-Silent-Join 头部和当前会议状态分配角色。
 */
function resolveConferenceSessionOptions(e)
{
  if (e.originator === 'local' && conferencePendingOutgoing)
  {
    const pending = conferencePendingOutgoing;

    conferencePendingOutgoing = null;

    return pending;
  }

  if (e.originator !== 'remote')
  {
    return null;
  }

  const role = getConferenceNextRole();
  const silent = isConferenceHeaderEnabled(getConferenceRequestHeader(e.request, 'X-Silent-Join'));

  return {
    role,
    originator     : e.originator,
    remoteNo       : getConferenceRemoteNumber(e),
    localDirection : silent ? 'sendonly' : 'sendrecv',
    silent,
    autoAnswer     : role === 'C' && silent
  };
}

function addConferenceTrackEndedListener(track, listener)
{
  if (track && track.addEventListener)
  {
    track.addEventListener('ended', listener, { once: true });
  }
}

/**
 * 监听 PeerConnection 的 track 事件，自动收集远端音视频轨。
 *
 * 每个 leg 只绑定一次 track 监听。音频轨放入 remoteMainStream 并创建
 * 隐式 audio 元素播放；视频轨放入 remoteMainStream 并刷新主画面。
 * 轨道 ended 时自动清理并触发重新合成。
 */
function attachConferenceTrackListener(leg)
{
  const connection = leg.session.connection;

  if (!connection || leg.trackListenerAttached)
  {
    return;
  }

  leg.trackListenerAttached = true;
  connection.addEventListener('track', (event) =>
  {
    const track = event.track;

    if (track.kind === 'audio' &&
      (!leg.remoteMainAudioTrack || leg.remoteMainAudioTrack.readyState !== 'live'))
    {
      if (leg.remoteMainAudioTrack)
      {
        try { leg.remoteMainStream.removeTrack(leg.remoteMainAudioTrack); }
        catch (error) {}
      }
      leg.remoteMainAudioTrack = track;
      leg.remoteMainStream.addTrack(track);
      bindConferenceRemoteAudio(leg);
      scheduleConferenceSync();

      addConferenceTrackEndedListener(track, () =>
      {
        if (leg.remoteMainAudioTrack !== track) return;
        try { leg.remoteMainStream.removeTrack(track); }
        catch (error) {}
        leg.remoteMainAudioTrack = null;
        scheduleConferenceSync();
      });

      return;
    }

    if (track.kind === 'video' &&
      (!leg.remoteMainVideoTrack || leg.remoteMainVideoTrack.readyState !== 'live'))
    {
      if (leg.remoteMainVideoTrack)
      {
        try { leg.remoteMainStream.removeTrack(leg.remoteMainVideoTrack); }
        catch (error) {}
      }
      leg.remoteMainVideoTrack = track;
      leg.remoteMainStream.addTrack(track);
      renderConferenceMainVideo();
      scheduleConferenceSync();

      addConferenceTrackEndedListener(track, () =>
      {
        if (leg.remoteMainVideoTrack !== track) return;
        try { leg.remoteMainStream.removeTrack(track); }
        catch (error) {}
        leg.remoteMainVideoTrack = null;
        renderConferenceMainVideo();
        scheduleConferenceSync();
      });

      return;
    }

  });
}

/**
 * 从 PeerConnection 中提取已存在的远端媒体轨。
 *
 * 用于 track 事件触发之前已有远端轨的场景（比如 early media 或
 * 快速协商），确保 remoteMainStream 包含所有已有轨道。
 */
function hydrateConferenceRemoteMainStream(leg)
{
  const connection = leg.session.connection;

  if (!connection)
  {
    return;
  }

  const remoteStreams = CRTC.Utils.getStreams(connection, 'remote');
  const audioTrack = remoteStreams.audioStream.getAudioTracks()[0] || null;
  const videoTrack = remoteStreams.videoStream.getVideoTracks()[0] || null;

  if (audioTrack && !leg.remoteMainAudioTrack)
  {
    leg.remoteMainAudioTrack = audioTrack;
    leg.remoteMainStream.addTrack(audioTrack);
  }

  if (videoTrack && !leg.remoteMainVideoTrack)
  {
    leg.remoteMainVideoTrack = videoTrack;
    leg.remoteMainStream.addTrack(videoTrack);
  }

  bindConferenceRemoteAudio(leg);
}

function bindConferenceRemoteAudio(leg)
{
  if (!leg.remoteMainAudioTrack)
  {
    return;
  }

  if (!leg.audioElement)
  {
    leg.audioElement = document.createElement('audio');
    leg.audioElement.autoplay = true;
    leg.audioElement.className = 'hide conference-remote-audio';
    document.body.appendChild(leg.audioElement);
  }

  leg.audioElement.srcObject = new MediaStream([ leg.remoteMainAudioTrack ]);
  leg.audioElement.play().catch(() => {});
}

function rememberConferenceOriginalSenders(leg)
{
  const senders = leg.session.connection ? leg.session.connection.getSenders() : [];
  const audioSender = senders.find((sender) => sender.track && sender.track.kind === 'audio') || null;
  const videoSender = senders.find((sender) => sender.track && sender.track.kind === 'video') || null;

  // 首次快照用于 composer 失败时恢复。后续 confirmed/localMediastreamUpdate
  // 可能发生在 replaceTrack 之后，不能用混音输出覆盖原始轨。
  if (!leg.originalAudioSender && audioSender)
  {
    leg.originalAudioSender = audioSender;
    leg.originalAudioTrack = audioSender.track;
  }
  if (!leg.originalVideoSender && videoSender)
  {
    leg.originalVideoSender = videoSender;
    leg.originalVideoTrack = videoSender.track;
  }
}

/**
 * 绑定 RTCSession 生命周期事件（sending/trying/progress/confirmed/ended 等）。
 *
 * 事件处理中包含：
 * - 信令阶段追踪（signalingStage）
 * - confirmed 时自动收集轨道、记录原始 sender、触发 UI 更新和媒体合成
 * - ended/failed 时自动调用 cleanupConferenceLeg 清理资源
 */
function setupConferenceSessionEvents(leg)
{
  const session = leg.session;

  const updateStage = (stage, detail) =>
  {
    leg.signalingStage = stage;
    console.warn(`[conference] ${session.id} ${getConferenceDisplayRole(leg)} stage=${stage}`, detail || '');
  };

  session.on('sending', () =>
  {
    updateStage('invite-sent');
    setStatus(`会议成员 ${getConferenceDisplayRole(leg)} INVITE 已发送：${leg.remoteNo}`);
  });

  session.on('trying', () =>
  {
    updateStage('trying');
  });

  session.on('progress', () =>
  {
    updateStage('progress');
  });

  session.on('connecting', () =>
  {
    updateStage('connecting');
  });

  session.on('sdp', (data) =>
  {
    noremb && (data.sdp = data.sdp.replace(/a=rtcp-fb:\d* goog-remb\r\n/g, ''));
    noremb && (data.sdp = data.sdp.replace(/a=rtcp-fb:\d* transport-cc\r\n/g, ''));
    updateStage(`sdp-${data.originator || 'unknown'}-${data.type || 'unknown'}`);
  });

  session.on('remoteSupportsVideo', () =>
  {
    setStatus(`会议成员 ${getConferenceDisplayRole(leg)} 支持视频`);
  });

  session.on('refer', (data) =>
  {
    if (conferenceLegs.size > 1)
    {
      data.reject();
      setStatus('三方会议期间已拒绝远端 REFER');
    }
  });

  [
    'getusermediafailed',
    'peerconnection:createofferfailed',
    'peerconnection:createanswerfailed',
    'peerconnection:setlocaldescriptionfailed',
    'peerconnection:setremotedescriptionfailed'
  ].forEach((eventName) =>
  {
    session.on(eventName, (error) =>
    {
      updateStage(eventName, error);
      setStatus(`会议成员 ${getConferenceDisplayRole(leg)} 媒体协商失败：${eventName}`);
    });
  });

  session.on('accepted', () =>
  {
    updateStage('accepted');
    leg.answering = false;
    clearConferenceAnswerTimer(leg);
    setStatus(`会议成员 ${getConferenceDisplayRole(leg)} 已接听${leg.silent ? '（静默）' : ''}`);
  });

  session.on('confirmed', () =>
  {
    updateStage('confirmed');
    leg.confirmed = true;
    leg.answering = false;
    clearConferenceAnswerTimer(leg);
    attachConferenceTrackListener(leg);
    hydrateConferenceRemoteMainStream(leg);
    rememberConferenceOriginalSenders(leg);
    renderConferenceLocalVideo(leg);
    updateConferenceUi();
    renderConferenceMainVideo();
    scheduleConferenceSync();

    setStatus(`会议成员 ${getConferenceDisplayRole(leg)} 通话已确认${leg.silent ? '（静默）' : ''}`);
  });

  session.on('cameraChanged', (data) =>
  {
    const hostLeg = getConferenceLegByRole('B');
    const previewLeg = hostLeg || getConferenceSelectedLeg();
    const videoTrack = data.videoStream && data.videoStream.getVideoTracks ?
      data.videoStream.getVideoTracks()[0] : null;

    if (!previewLeg || previewLeg.session !== session)
    {
      return;
    }

    if (videoTrack)
    {
      bindMediaStreamIfChanged(localVideo, new MediaStream([ videoTrack ]));
      localVideo.play().catch(() => {});
    }

    if (hostLeg)
    {
      // 桥接端需要在下一轮按更新后的 composer 原始输入重新校准预览。
      setTimeout(() => renderConferenceLocalVideo(leg), 0);
    }
  });

  session.on('localMediastreamUpdate', () =>
  {
    renderConferenceLocalVideo(leg);
  });

  session.on('hold', (data) =>
  {
    setStatus(`会议成员 ${getConferenceDisplayRole(leg)} 已保持（${data.originator}）`);
  });

  session.on('unhold', (data) =>
  {
    setStatus(`会议成员 ${getConferenceDisplayRole(leg)} 已恢复（${data.originator}）`);
  });

  session.on('muted', (data) =>
  {
    setStatus(`会议成员 ${getConferenceDisplayRole(leg)} 已静音：${data.audio ? '音频' : ''}${data.video ? '视频' : ''}`);
  });

  session.on('unmuted', (data) =>
  {
    setStatus(`会议成员 ${getConferenceDisplayRole(leg)} 已取消静音：${data.audio ? '音频' : ''}${data.video ? '视频' : ''}`);
  });

  session.on('failed', (data) =>
  {
    updateStage('failed', data);
    leg.answering = false;
    clearConferenceAnswerTimer(leg);
    setStatus(`会议成员 ${getConferenceDisplayRole(leg)} 建立失败: ${data.cause}`);
    cleanupConferenceLeg(leg);
  });

  session.on('ended', (data) =>
  {
    updateStage('ended', data);
    leg.answering = false;
    clearConferenceAnswerTimer(leg);
    setStatus(`会议成员 ${getConferenceDisplayRole(leg)} 通话结束: ${data.cause}`);
    cleanupConferenceLeg(leg);
  });

  if (leg.originator === 'remote') session.on('mediaEffectsIssue', handleSessionMediaEffectsIssue);
  bindConferenceStatsEvents(leg);
  attachConferenceTrackListener(leg);
}

function clearConferenceAnswerTimer(leg)
{
  if (leg && leg.answerTimer)
  {
    clearTimeout(leg.answerTimer);
    leg.answerTimer = null;
  }
}

/**
 * 三方模式下的 newRTCSession 事件处理入口。
 *
 * 负责：
 * - 拒绝非会议呼叫按钮发起的外呼
 * - 检查会议容量、角色冲突和静默 C 准入条件
 * - 为合法会话创建 leg、绑定事件、处理自动接听
 *
 * @returns {boolean} true 表示事件已被会议模块处理
 */
function handleConferenceNewRTCSession(e)
{
  if (e.originator === 'local' && !conferencePendingOutgoing)
  {
    e.session.terminate();
    setStatus('三方模式下请使用会议呼叫按钮');

    return true;
  }

  if (conferenceLegs.size >= CONFERENCE_MAX_LEGS)
  {
    e.session.terminate({ status_code: 486, reason_phrase: 'Conference Full' });
    setStatus('三方会议已满，已拒绝额外来电');

    return true;
  }

  const sessionOptions = resolveConferenceSessionOptions(e);

  if (!sessionOptions)
  {
    return false;
  }

  const duplicateRoleLeg = getConferenceLegByRole(sessionOptions.role);

  if (duplicateRoleLeg && duplicateRoleLeg.session !== e.session)
  {
    e.session.terminate({ status_code: 486, reason_phrase: 'Conference Role Busy' });
    setStatus(`会议成员 ${sessionOptions.role} 已存在，拒绝重复呼入`);

    return true;
  }

  const conferenceHost = getConferenceLegByRole('B');

  if (sessionOptions.role === 'B' && sessionOptions.silent)
  {
    e.session.terminate({ status_code: 486, reason_phrase: 'Conference Host Not Ready' });
    setStatus('静默 C 呼入过早，请等待 A-B 接通后重试');

    return true;
  }

  if (sessionOptions.role === 'C' && (!conferenceHost || !conferenceHost.confirmed))
  {
    e.session.terminate({ status_code: 486, reason_phrase: 'Conference Host Not Ready' });
    setStatus('A-B 尚未确认，已拒绝 C 的提前呼入');

    return true;
  }

  if (e.originator === 'remote')
  {
    console.warn('[conference] incoming classified', {
      role       : sessionOptions.role,
      silent     : sessionOptions.silent,
      silentJoin : getConferenceRequestHeader(e.request, 'X-Silent-Join')
    });
  }

  sessionOptions.remoteNo = sessionOptions.remoteNo || getConferenceRemoteNumber(e);
  const leg = createConferenceLeg(e.session, sessionOptions);

  setupConferenceSessionEvents(leg);
  updateConferenceUi();

  if (e.originator === 'remote')
  {
    if (leg.autoAnswer)
    {
      setStatus(`收到静默会议成员 ${getConferenceDisplayRole(leg)} 呼叫：${leg.remoteNo}，正在自动接听`);
      setTimeout(() => answerConferenceLeg(leg).catch((error) =>
      {
        console.warn('[conference] silent answer failed', error);
        try { leg.session.terminate({ status_code: 480 }); }
        catch (terminateError) {}
      }), 0);
    }
    else
    {
      conferenceSelectedLegId = leg.session.id;
      setStatus(`收到会议成员 ${getConferenceDisplayRole(leg)} 呼叫：${leg.remoteNo}`);
      showIncomingCallNotification('video', leg.remoteNo);
    }
  }

  return true;
}

/**
 * 发起会议外呼。
 *
 * B 的呼叫：使用用户选择的设备，创建独立 composer。
 * C 的呼叫：先调用 prepareNormalCComposerOutput 准备 A-B 主 composer 的
 *   合成输出流，然后将该流作为 C 呼叫的 mediaStream 传入。这样 C 在
 *   INVITE 阶段就绑定了 A+B 的合成画面和混音，通话确认后只需向 composer
 *   加入 C 的远端源即可。
 *
 * @param {object} options - { role: 'B'|'C' }
 */
async function callConferenceVideo(options)
{
  options = options || {};

  if (typeof appMode === 'undefined' || appMode !== 'conference')
  {
    setStatus('请先选择三方模式');

    return;
  }

  if (!ua || !ua.isRegistered())
  {
    setStatus('请注册成功后发起会议呼叫');

    return;
  }

  if (conferencePendingOutgoing)
  {
    setStatus('已有会议呼叫正在创建');

    return;
  }

  if (conferenceLegs.size >= CONFERENCE_MAX_LEGS)
  {
    setStatus('三方会议已满');

    return;
  }

  const role = options.role || getConferenceNextRole();

  if (role !== 'B' && role !== 'C')
  {
    setStatus('会议成员角色仅支持 B 或 C');

    return;
  }
  if (getConferenceLegByRole(role))
  {
    setStatus(`会议成员 ${role} 已存在`);

    return;
  }

  const hostLeg = getConferenceLegByRole('B');

  if (role === 'C' && (!hostLeg || !hostLeg.confirmed))
  {
    setStatus('请先等待 A-B 主会话确认，再接入 C');

    return;
  }

  const number = document.querySelector('#callee').value.trim();

  if (!number)
  {
    setStatus('请输入会议成员号码');

    return;
  }

  let normalCOutput = null;
  let callOptions;
  // 在媒体准备前占用 pending 状态，避免用户快速重复点击创建两路相同会话。
  // newRTCSession 会消费同一个对象，补充字段时保持对象引用不变。
  const pendingOutgoing = {
    role,
    originator            : 'local',
    remoteNo              : number,
    localDirection        : 'sendrecv',
    silent                : false,
    fallbackLocalStream   : null,
    normalComposerHostId  : null,
    conferenceAudioStream : null,
    autoAnswer            : false
  };

  conferencePendingOutgoing = pendingOutgoing;
  updateConferenceUi();

  try
  {
    if (role === 'C') normalCOutput = await prepareNormalCComposerOutput(hostLeg);

    // 媒体准备期间可能已通过“全部挂断”或会话结束取消本次呼叫。
    if (conferencePendingOutgoing !== pendingOutgoing)
    {
      if (normalCOutput) await rollbackNormalCComposerOutput(hostLeg, normalCOutput);

      return;
    }

    if (normalCOutput)
    {
      pendingOutgoing.fallbackLocalStream = normalCOutput.fallbackLocalStream;
      pendingOutgoing.normalComposerHostId = normalCOutput.normalComposerHostId;
      pendingOutgoing.conferenceAudioStream = normalCOutput.conferenceAudioStream;
    }
    callOptions = buildConferenceCallOptions(role, normalCOutput);
  }
  catch (error)
  {
    if (conferencePendingOutgoing === pendingOutgoing)
    {
      conferencePendingOutgoing = null;
      if (normalCOutput) await rollbackNormalCComposerOutput(hostLeg, normalCOutput);
    }
    updateConferenceUi();
    setStatus(`准备会议媒体失败：${error.message || error}`);

    return;
  }

  try
  {
    setStatus(`正在呼叫会议成员 ${role}：${number}`);
    await ua.call(`${number}@${sipDomain}`, callOptions);
  }
  catch (error)
  {
    // newRTCSession 尚未接管该输出时，由这里恢复 A-B。
    // 若已创建 leg，failed/ended 事件会负责统一清理。
    if (conferencePendingOutgoing === pendingOutgoing)
    {
      conferencePendingOutgoing = null;
      if (normalCOutput) await rollbackNormalCComposerOutput(hostLeg, normalCOutput);
    }
    updateConferenceUi();
    setStatus(`会议呼叫失败：${error.message || error}`);
  }
}

/**
 * 以静默 C 身份呼叫 A。
 *
 * 使用 recvonly 方向 + X-Silent-Join 头部，只收 A-B 合成流，
 * 不发送音视频。CDemo 在点对点模式下使用此按钮模拟 C 端接入。
 */
async function callConferenceAsSilentC()
{
  if (typeof appMode === 'undefined' || appMode !== 'point-to-point')
  {
    setStatus('静默 C 呼入只能在点对点模式使用');

    return;
  }
  if (!ua || !ua.isRegistered())
  {
    setStatus('请注册成功后发起静默呼叫');

    return;
  }

  const number = document.querySelector('#callee').value;
  const callOptions = {
    extraHeaders : [
      `X-Data: ${xdata}`,
      `X-UA: ${navigator.userAgent}`,
      'X-Direction: recvonly',
      'X-Silent-Join: true'
    ],
    extraFeatures       : buildConferenceExtraFeatures(),
    pcConfig            : pcConfig,
    mediaConstraints    : { audio: false, video: false },
    rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
    eventHandlers       : {
      mediaEffectsIssue : handleSessionMediaEffectsIssue
    }
  };

  if (rtcSession && !rtcSession.isEnded()) rtcSession.terminate();
  setStatus(`正在以静默 C 身份呼叫 A：${number}`);
  const session = await ua.call(`${number}@${sipDomain}`, callOptions);

  // 静默呼叫不走普通 call() 的早期媒体监听。A 会在会话确认后向
  // C 会话的 composer 加入 B 源，因此 C 端需在远端轨到达时再刷新主画面。
  const refreshRemoteMedia = () =>
  {
    if (session.connection && !session.isEnded())
    {
      getStreams(session.connection);
    }
  };

  if (session.connection && session.connection.addEventListener)
  {
    session.connection.addEventListener('track', refreshRemoteMedia);
  }
  if (session.on)
  {
    session.on('confirmed', refreshRemoteMedia);
  }
}

/**
 * 接听会议来电。
 *
 * 对于普通 C，先准备 composer 输出流再应答；静默 C 创建独立 composer。
 * 设置超时保护，超时后自动挂断避免来电挂起。
 */
async function answerConferenceLeg(leg)
{
  leg = leg || getConferenceSelectedLeg();

  if (!leg || leg.originator !== 'remote' || leg.confirmed || leg.answering)
  {
    setStatus('当前没有待接听的会议会话');

    return;
  }

  leg.answering = true;
  leg.signalingStage = 'answer-requested';
  let normalCOutput = null;

  try
  {
    if (leg.role === 'C' && !leg.silent)
    {
      const hostLeg = getConferenceLegByRole('B');

      if (!hostLeg || !hostLeg.confirmed || hostLeg.ended)
      {
        throw new Error('A-B 主会话尚未就绪');
      }

      normalCOutput = await prepareNormalCComposerOutput(hostLeg);
      leg.fallbackLocalStream = normalCOutput.fallbackLocalStream;
      leg.normalComposerHostId = normalCOutput.normalComposerHostId;
      leg.conferenceAudioStream = normalCOutput.conferenceAudioStream;
    }

    if (leg.ended || leg.session.isEnded())
    {
      throw new Error('待接听会话已结束');
    }

    const answerOptions = buildConferenceAnswerOptions(leg, normalCOutput);

    // 静默 C 的 answerOptions 会为这路单独创建 composer，先以 A 媒体完成
    // SIP 应答；会话确认后再加入 B 源，不阻塞建链也不改动 A-B 会话。
    leg.session.answer(answerOptions);
    const answerTimeout = ua && ua.configuration && ua.configuration.no_answer_timeout ?
      ua.configuration.no_answer_timeout : 60000;

    clearConferenceAnswerTimer(leg);
    leg.answerTimer = setTimeout(() =>
    {
      if (leg.ended || leg.confirmed || leg.signalingStage === 'accepted')
      {
        return;
      }

      leg.answering = false;
      console.warn(`[conference] ${leg.session.id} answer timeout at stage=${leg.signalingStage}`);
      setStatus(`会议成员 ${getConferenceDisplayRole(leg)} 接听超时：${leg.signalingStage}`);
      try { leg.session.terminate({ status_code: 480, reason_phrase: 'Conference Answer Timeout' }); }
      catch (terminateError) {}
    }, answerTimeout);
    closeIncomingCallNotification();
    if (!leg.silent) setStatus(`正在接听会议成员 ${getConferenceDisplayRole(leg)}`);
  }
  catch (error)
  {
    leg.answering = false;
    if (normalCOutput)
    {
      await rollbackNormalCComposerOutput(getConferenceLegByRole('B'), normalCOutput);
      leg.fallbackLocalStream = null;
      leg.normalComposerHostId = null;
      leg.conferenceAudioStream = null;
    }
    throw error;
  }
}

// =============================================================================
// 三方媒体合成与失败降级
//
// 合成流程：A-B 和 A-C 的远端音视频轨通过 MediaEffectsComposer.addSource()
// 添加到主 composer 的不同 slot 中，composer 输出合成后的 A+B+C 视频画面，
// 并按 slot 混音分别输出 B 音频（A+C）和 C 音频（A+B）。
//
// 合成失败时的降级策略：移除所有 composer 远端源，恢复各会话的原始 sender
// track，保留原始 A-B 或 A-C 通话，不中断正在进行的会话。
// =============================================================================

/**
 * 调度媒体合成（防抖）。
 *
 * 多次连续调用只会执行一次实际的合成操作，避免 track 批量到达时重复合成。
 */
function scheduleConferenceSync()
{
  if (!conferenceSyncTimer)
  {
    conferenceSyncTimer = setTimeout(() =>
    {
      conferenceSyncTimer = null;
      conferenceSyncQueue = conferenceSyncQueue
        .then(() => syncConferenceComposer())
        .catch(async(error) =>
        {
          console.warn('[conference] sync failed', error);
          setStatus(`三方媒体合成失败，已保留原始通话：${error.message || error}`);

          if (conferenceComposer)
          {
            conferenceLegs.forEach((leg) =>
            {
              if (leg.composerSourceStream)
              {
                try { conferenceComposer.removeSource(leg.composerSourceStream); }
                catch (removeError) {}
                leg.composerSourceStream = null;
              }
            });
          }

          conferenceComposerSyncSignature = '';
          await restoreConferenceOriginalMedia(conferenceComposerHostId);
          releaseConferenceComposerOutputs();
          renderConferenceMainVideo();
        });
    }, 0);
  }

  return conferenceSyncQueue;
}

function getConferenceComposerSyncSignature(hostLeg, cLeg)
{
  const trackSignature = (track) =>
  {
    return track ? `${track.kind}:${track.id}:${track.readyState}` : '-';
  };

  return [
    hostLeg.session.id,
    cLeg.session.id,
    cLeg.silent ? 'silent' : 'normal',
    trackSignature(hostLeg.remoteMainAudioTrack),
    trackSignature(hostLeg.remoteMainVideoTrack),
    trackSignature(cLeg.remoteMainAudioTrack),
    trackSignature(cLeg.remoteMainVideoTrack)
  ].join('|');
}

/**
 * 更新 composer 中指定 leg 的远端媒体源。
 *
 * 每个 leg 在 composer 中最多有一个活跃的远端源。更换源时先移除旧的、
 * 再添加新的，避免轨道泄漏。
 */
function updateConferenceComposerSource(composer, leg, stream, slot)
{
  if (leg.composerSourceStream === stream)
  {
    return;
  }

  if (leg.composerSourceStream)
  {
    try { composer.removeSource(leg.composerSourceStream); }
    catch (error) {}
  }

  leg.composerSourceStream = null;

  if (stream && stream.getTracks().length > 0)
  {
    composer.addSource(stream, { slot, gain: 1 });
    leg.composerSourceStream = stream;
  }
}

/**
 * 执行三方媒体合成。
 *
 * 核心逻辑：
 * - 普通三方（A-B 主 composer）：composer slot 0=A 原始输入，slot 1=B 远端，
 *   slot 2=C 远端。输出视频 A+B+C。B 音频=slot 0+2（A+C），C 音频=slot 0+1（A+B）。
 * - 静默 C：使用 C 会话自己的 composer（slot 0=A 原始，slot 1=B 远端），
 *   避免改动 A-B 主会话的 canvas 输出。
 *
 * 使用 syncSignature 跳过无变化的重复合成。合成失败时自动降级。
 */
async function syncConferenceComposer()
{
  const hostLeg = getConferenceLegByRole('B');
  const cLeg = getConferenceLegByRole('C');

  if (!hostLeg || !cLeg || !hostLeg.confirmed || !cLeg.confirmed)
  {
    return;
  }

  // 普通三方由 A-B 主会话合成 A+B+C。静默 C 则必须使用 C 会话
  // 自己的 composer，否则向主 composer 加入 B 后，B 正在接收的同一条
  // canvas 输出轨也会立即变成 A+B。
  const composerOwnerLeg = cLeg.silent ? cLeg : hostLeg;
  const composer = composerOwnerLeg.session.getMediaEffectsComposer &&
    composerOwnerLeg.session.getMediaEffectsComposer();

  if (!composer)
  {
    throw new Error(cLeg.silent ?
      '静默 C 会话没有可用的 MediaEffectsComposer' :
      'A-B 主会话没有可用的 MediaEffectsComposer');
  }

  hydrateConferenceRemoteMainStream(hostLeg);
  hydrateConferenceRemoteMainStream(cLeg);

  if (!hostLeg.remoteMainVideoTrack && !hostLeg.remoteMainAudioTrack)
  {
    return;
  }

  const syncSignature = getConferenceComposerSyncSignature(hostLeg, cLeg);

  if (syncSignature === conferenceComposerSyncSignature)
  {
    return;
  }

  conferenceComposer = composer;
  conferenceComposerHostId = composerOwnerLeg.session.id;

  if (cLeg.silent)
  {
    // C 会话的本地 A 媒体已是 slot 0，只需把 B 加到 slot 1。
    // composer 只属于 C 会话，其 A+B 输出不会影响 A-B 会话。
    updateConferenceComposerSource(composer, cLeg, hostLeg.remoteMainStream, 1);
  }
  else
  {
    updateConferenceComposerSource(composer, hostLeg, hostLeg.remoteMainStream, 1);
    updateConferenceComposerSource(composer, cLeg, cLeg.remoteMainStream, 2);
  }

  const videoTrack = composer.getVideoStream().getVideoTracks()[0];

  if (!videoTrack)
  {
    throw new Error('MediaEffectsComposer 没有输出三方视频轨');
  }

  if (cLeg.silent)
  {
    // C 会话建立时已发送该 composer 的稳定音视频输出轨。
    // 动态加入 B 源后内容会自动更新，不需要 replaceTrack。
    hostLeg.conferenceAudioStream = null;
    cLeg.conferenceAudioStream = null;
  }
  else
  {
    let cAudioStream = cLeg.conferenceAudioStream;
    const cAlreadyUsesHostComposer = cLeg.normalComposerHostId === hostLeg.session.id;

    if (!cAudioStream || !cAlreadyUsesHostComposer)
    {
      cAudioStream = await composer.getAudioStream({ slots: [ 0, 1 ] });
    }

    const cAudioTrack = cAudioStream && cAudioStream.getAudioTracks()[0];
    const bAudioStream = hostLeg.conferenceAudioStream ||
      await composer.getAudioStream({ slots: [ 0, 2 ] });
    const bAudioTrack = bAudioStream && bAudioStream.getAudioTracks()[0];

    hostLeg.conferenceAudioStream = bAudioStream;
    cLeg.conferenceAudioStream = cAudioStream;

    // 首次呼入/呼出普通 C 时，C sender 在建链前已绑定这个主 composer，
    // 加入 C 源后只更新 canvas/audio graph。仅 B 挂断后重新补入新 B、
    // composer 宿主发生变化时，才需要把保留的 A-C 会话切到新 composer。
    if (!cAlreadyUsesHostComposer)
    {
      const fallbackLocalStream = cloneConferenceFallbackLocalStream(hostLeg);

      try
      {
        if (cLeg.originalVideoSender) await cLeg.originalVideoSender.replaceTrack(videoTrack);
        if (cLeg.originalAudioSender && cAudioTrack) await cLeg.originalAudioSender.replaceTrack(cAudioTrack);
      }
      catch (error)
      {
        CRTC.Utils.closeMediaStream(fallbackLocalStream);
        throw error;
      }

      if (cLeg.fallbackLocalStream) CRTC.Utils.closeMediaStream(cLeg.fallbackLocalStream);
      cLeg.fallbackLocalStream = fallbackLocalStream;
      cLeg.normalComposerHostId = hostLeg.session.id;
    }

    if (hostLeg.originalAudioSender && bAudioTrack && hostLeg.originalAudioSender.track !== bAudioTrack)
    {
      await hostLeg.originalAudioSender.replaceTrack(bAudioTrack);
    }
  }

  conferenceComposerSyncSignature = syncSignature;

  renderConferenceLocalVideo(hostLeg);
  renderConferenceMainVideo();
  updateConferenceUi();
  setStatus(cLeg.silent ?
    '静默 C 媒体已合成：C 接收 A+B，B 保持 A-B 原始通话' :
    '三方媒体已合成：视频 A+B+C；B 音频 A+C；C 音频 A+B');
}

/**
 * 恢复单个 leg 的原始音视频 sender track。
 *
 * composer 销毁或降级时调用，将 sender 替换回首次创建时的原始 track。
 * 如果 composer 宿主已销毁且有降级流可用，使用降级流（A 原始轨的克隆）。
 */
async function restoreConferenceLegOriginalMedia(leg, invalidComposerHostId)
{
  const tasks = [];
  const useFallback = Boolean(
    leg && invalidComposerHostId && leg.normalComposerHostId === invalidComposerHostId &&
    leg.fallbackLocalStream
  );
  const fallbackVideoTrack = useFallback && leg.fallbackLocalStream.getVideoTracks()[0];
  const fallbackAudioTrack = useFallback && leg.fallbackLocalStream.getAudioTracks()[0];
  const videoTrack = fallbackVideoTrack || (leg && leg.originalVideoTrack);
  const audioTrack = fallbackAudioTrack || (leg && leg.originalAudioTrack);

  if (leg && leg.originalVideoSender && videoTrack)
  {
    tasks.push(leg.originalVideoSender.replaceTrack(videoTrack).catch(() => {}));
  }
  if (leg && leg.originalAudioSender && audioTrack)
  {
    tasks.push(leg.originalAudioSender.replaceTrack(audioTrack).catch(() => {}));
  }

  await Promise.all(tasks);

  if (useFallback)
  {
    leg.normalComposerHostId = null;
    leg.conferenceAudioStream = null;
  }
}

async function restoreConferenceOriginalMedia(invalidComposerHostId)
{
  await Promise.all(Array.from(conferenceLegs.values()).map((leg) =>
    restoreConferenceLegOriginalMedia(leg, invalidComposerHostId)));
}

// =============================================================================
// 媒体预览与会话清理
// =============================================================================

/**
 * 渲染远端主画面。
 *
 * 优先显示 B 的视频在 remoteVideo 主区域；C 的视频在 conferenceRemoteVideoC
 * 辅助区域。如果 B 没有视频轨，则 C 视频占满主区域。
 * 静默 C 的上行视频本就不存在，A 端不为它保留空白预览区。
 */
function renderConferenceMainVideo()
{
  const bLeg = getConferenceLegByRole('B');
  const cLeg = getConferenceLegByRole('C');
  const bTrack = bLeg && bLeg.remoteMainVideoTrack;
  // 静默 C 的上行视频本就不存在，A 端不为它保留空白预览区。
  const cTrack = cLeg && !cLeg.silent ? cLeg.remoteMainVideoTrack : null;
  const cVideo = document.querySelector('#conferenceRemoteVideoC');

  if (bTrack)
  {
    bindConferencePreviewTrack(remoteVideo, bTrack, false);
    bindConferencePreviewTrack(cVideo, cTrack, true);
  }
  else
  {
    bindConferencePreviewTrack(remoteVideo, cTrack, false);
    bindConferencePreviewTrack(cVideo, null, true);
  }
}

/**
 * 渲染 A 端本地预览。
 *
 * 三方模式下优先取 A-B 主会话的 composer 原始输入流（getComposerInputStream），
 * 确保本地预览与 composer 看到的输入一致。回退到普通 localStream。
 */
function renderConferenceLocalVideo(leg)
{
  const hostLeg = getConferenceLegByRole('B');

  if (hostLeg)
  {
    leg = hostLeg;
  }

  if (!leg || !leg.session.connection)
  {
    return;
  }

  const sourceStream = leg.session.getComposerInputStream ?
    leg.session.getComposerInputStream() : null;
  const localStreams = CRTC.Utils.getStreams(leg.session.connection, 'local');
  const localTrack = sourceStream && sourceStream.getVideoTracks ?
    sourceStream.getVideoTracks()[0] : localStreams.videoStream.getVideoTracks()[0];

  if (localTrack)
  {
    bindMediaStreamIfChanged(localVideo, new MediaStream([ localTrack ]));
    localVideo.play().catch(() => {});
  }
}

function bindConferencePreviewTrack(video, track, hideWhenEmpty)
{
  if (!video)
  {
    return;
  }

  if (!track || track.readyState !== 'live')
  {
    video.srcObject = null;
    video.classList.toggle('hide', Boolean(hideWhenEmpty));

    return;
  }

  bindMediaStreamIfChanged(video, new MediaStream([ track ]));
  video.classList.remove('hide');
  video.play().catch(() => {});
}

function releaseConferenceComposerOutputs()
{
  if (conferenceComposer)
  {
    try { conferenceComposer.releaseSubmixAudioStream({ slots: [ 0, 2 ] }); }
    catch (error) {}
    try { conferenceComposer.releaseSubmixAudioStream({ slots: [ 0 ] }); }
    catch (error) {}
    try { conferenceComposer.releaseSubmixAudioStream({ slots: [ 0, 1 ] }); }
    catch (error) {}
  }

  conferenceComposer = null;
  conferenceComposerHostId = null;
  conferenceComposerSyncSignature = '';
}

/**
 * 清理单个会议成员的所有资源。
 *
 * 执行步骤：
 * 1. 停止屏幕共享 sender
 * 2. 移除远端音频播放元素
 * 3. 释放降级流
 * 4. 从 conferenceLegs 中删除
 * 5. B 挂断时自动终止关联的静默 C
 * 6. 清理 composer 中的远端源
 * 7. 恢复保留成员的原始 track（如果 composer 宿主已销毁）
 * 8. 更新 UI 和统计面板
 */
async function cleanupConferenceLeg(leg)
{
  if (!leg || leg.ended)
  {
    return;
  }

  const silentCLeg = leg.role === 'B' ? getConferenceLegByRole('C') : null;

  leg.ended = true;
  clearConferenceAnswerTimer(leg);

  if (leg.screenSender)
  {
    await leg.screenSender.replaceTrack(null).catch(() => {});
    leg.screenActive = false;
  }

  if (leg.audioElement)
  {
    leg.audioElement.srcObject = null;
    leg.audioElement.remove();
    leg.audioElement = null;
  }

  if (leg.fallbackLocalStream)
  {
    CRTC.Utils.closeMediaStream(leg.fallbackLocalStream);
    leg.fallbackLocalStream = null;
  }

  conferenceLegs.delete(leg.session.id);

  // B 是第一路主会话。B 离开时静默 C 没有独立通话意义；普通 C 则保留，
  // 会议退化为 A-C，之后允许新的第一路补入 B。
  if (silentCLeg && silentCLeg.silent && !silentCLeg.ended && !silentCLeg.session.isEnded())
  {
    try { silentCLeg.session.terminate(); }
    catch (error) {}
  }

  if (conferenceScreenStream && !conferenceScreenStarting &&
    !Array.from(conferenceLegs.values()).some((item) => item.screenActive))
  {
    await stopConferenceScreenShare();
  }

  if (conferenceComposer && leg.composerSourceStream)
  {
    try { conferenceComposer.removeSource(leg.composerSourceStream); }
    catch (error) {}
  }

  if (leg.session.id === conferenceComposerHostId)
  {
    // RTCSession 关闭时会销毁其会话级 composer；保留的普通 C
    // 使用预先 clone 的 A 原始轨继续 A-C 通话。
    await restoreConferenceOriginalMedia(leg.session.id);
    releaseConferenceComposerOutputs();
  }
  else if (conferenceComposer)
  {
    const hostLeg = getConferenceLegByRole('B');

    if (hostLeg && hostLeg.composerSourceStream)
    {
      try { conferenceComposer.removeSource(hostLeg.composerSourceStream); }
      catch (error) {}
      hostLeg.composerSourceStream = null;
    }

    await restoreConferenceOriginalMedia();
    releaseConferenceComposerOutputs();
  }

  if (conferenceSelectedLegId === leg.session.id)
  {
    const selected = getConferenceSelectedLeg();

    if (selected) selectConferenceLeg(selected);
    else
    {
      conferenceSelectedLegId = null;
      rtcSession = null;
      statsSession = null;
      setConferenceStatsText('#rtcStatsPeerConnection', '等待会话');
      setConferenceStatsText('#rtcStatsOutboundLabel', 'A → 远端:');
      setConferenceStatsText('#rtcStatsInboundLabel', '远端 → A:');
      [ '#rtcStatsConnection', '#rtcStatsQuality', '#rtcStatsOutbound', '#rtcStatsInbound' ]
        .forEach((selector) => setConferenceStatsText(selector, '--'));
      setConferenceStatsText('#rtcStatsIssues', '无');
    }
  }

  if (conferenceLegs.size === 0)
  {
    stopConferenceScreenShare().catch(() => {});
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
  }

  renderConferenceLocalVideo(getConferenceSelectedLeg());
  renderConferenceMainVideo();
  updateConferenceUi();
}

function terminateConferenceLeg(sessionId)
{
  const leg = conferenceLegs.get(sessionId);

  if (leg && !leg.session.isEnded())
  {
    leg.session.terminate();
  }
}

/**
 * 挂断所有会议成员（包括已确认和未确认的）。
 */
function terminateConference()
{
  // 如果外呼仍停留在媒体准备阶段，先取消 pending；准备函数返回后会回滚输出。
  conferencePendingOutgoing = null;

  Array.from(conferenceLegs.values()).forEach((leg) =>
  {
    if (!leg.session.isEnded())
    {
      try { leg.session.terminate(); }
      catch (error) {}
    }
  });
}

// =============================================================================
// 定向屏幕共享
//
// 三方模式下 A 可以通过 addTransceiver + renegotiate 向指定成员（B 或 C）
// 发送屏幕共享轨。共享信息通过 SIP INFO（event: screen-share）传递 MID，
// 接收端根据 MID 找到对应的 transceiver 并渲染。
//
// 编码不兼容时自动降级：移除旧 m-line 的 track，新建 transceiver 重新协商。
// =============================================================================

/**
 * 发起屏幕共享的 renegotiate。
 *
 * 使用 renegotiate({ useUpdate: false }) 发起完整 re-INVITE，
 * 10 秒内如果没有其他 renegotiate 阻塞则开始。失败自动终止。
 */
function renegotiateConferenceScreen(leg)
{
  return new Promise((resolve, reject) =>
  {
    const readyDeadline = Date.now() + 10000;
    let completed = false;
    let responseTimer = null;

    const finish = (error) =>
    {
      if (completed)
      {
        return;
      }

      completed = true;
      if (responseTimer) clearTimeout(responseTimer);
      if (error) reject(error);
      else resolve();
    };

    const attempt = () =>
    {
      if (leg.session.isEnded())
      {
        finish(new Error('会话已结束'));

        return;
      }

      let started;

      try
      {
        started = leg.session.renegotiate({ useUpdate: false, terminateOnFailure: false }, (error) => finish(error));
      }
      catch (error)
      {
        finish(error);

        return;
      }

      if (started)
      {
        if (!completed)
        {
          responseTimer = setTimeout(() =>
          {
            finish(new Error('屏幕共享重新协商响应超时'));
          }, 15000);
        }

        return;
      }

      if (Date.now() >= readyDeadline)
      {
        finish(new Error('等待可发起屏幕共享 re-INVITE 超时'));

        return;
      }

      setTimeout(attempt, 100);
    };

    attempt();
  });
}

function waitForConferenceScreenMid(leg, timeout)
{
  timeout = timeout || 3000;

  return new Promise((resolve, reject) =>
  {
    const startedAt = Date.now();
    const check = () =>
    {
      const mid = leg.screenTransceiver && leg.screenTransceiver.mid;

      if (mid !== null && mid !== undefined)
      {
        leg.screenMid = String(mid);
        resolve(leg.screenMid);
      }
      else if (Date.now() - startedAt >= timeout)
      {
        reject(new Error('屏幕共享协商完成但没有取得 MID'));
      }
      else
      {
        setTimeout(check, 50);
      }
    };

    check();
  });
}

function sendConferenceScreenInfo(leg, action)
{
  const body = JSON.stringify({
    event : 'screen-share',
    action,
    mid   : leg.screenMid
  });

  leg.session.sendInfo('application/json', body);
}

/**
 * 向指定成员发送屏幕共享。
 *
 * 如果该 leg 已有 screenSender（上次共享留下的 m-line），先尝试
 * replaceTrack 复用；编码不兼容时降级为新建 transceiver + 重新协商。
 */
async function shareConferenceScreenToLeg(leg, screenTrack, screenStream)
{
  if (!leg || !leg.confirmed)
  {
    throw new Error('目标会议成员尚未确认');
  }

  if (leg.screenSender && leg.screenMid)
  {
    try
    {
      await leg.screenSender.replaceTrack(screenTrack);
      leg.screenActive = true;
      sendConferenceScreenInfo(leg, 'start');

      return;
    }
    catch (error)
    {
      // 编码能力范围不兼容时，保留旧 m-line，并新增一条 transceiver 重新协商。
      console.warn(`[conference] reuse screen sender for ${leg.role} failed`, error);
      await leg.screenSender.replaceTrack(null).catch(() => {});
    }
  }

  const transceiver = leg.session.connection.addTransceiver(screenTrack, {
    direction : 'sendonly',
    streams   : [ screenStream ]
  });

  leg.screenTransceiver = transceiver;
  leg.screenSender = transceiver.sender;

  try
  {
    await renegotiateConferenceScreen(leg);
    await waitForConferenceScreenMid(leg);
  }
  catch (error)
  {
    await leg.screenSender.replaceTrack(null).catch(() => {});
    try { leg.screenTransceiver.direction = 'inactive'; }
    catch (directionError) {}
    leg.screenMid = null;
    leg.screenActive = false;

    throw error;
  }

  leg.screenActive = true;
  sendConferenceScreenInfo(leg, 'start');
}

function getConferenceScreenTargetLegs()
{
  return getConferenceConfirmedLegs().filter((leg) => leg.screenTarget);
}

/**
 * 启动会议屏幕共享。
 *
 * 调用 getDisplayMedia 获取屏幕流，逐一发送给所有选中 screenTarget 的成员。
 * 用户通过浏览器停止共享或 track ended 时自动停止。
 */
async function startConferenceScreenShare()
{
  if (conferenceScreenStarting)
  {
    setStatus('屏幕共享正在启动，请稍候');

    return;
  }

  if (getConferenceConfirmedLegs().length === 0)
  {
    setStatus('请先建立至少一条已确认的音视频会话');

    return;
  }

  const targets = getConferenceScreenTargetLegs();

  if (targets.length === 0)
  {
    setStatus('请至少选择一个屏幕共享目标');

    return;
  }

  conferenceScreenStarting = true;
  updateConferenceUi();
  let successCount = 0;

  try
  {
    if (conferenceScreenStream)
    {
      await stopConferenceScreenShare();
    }

    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video : { width: { max: 1920 }, height: { max: 1080 }, frameRate: 15 },
      audio : false
    });
    const screenTrack = screenStream.getVideoTracks()[0];

    if (!screenTrack)
    {
      CRTC.Utils.closeMediaStream(screenStream);
      throw new Error('未获取到屏幕视频轨');
    }

    conferenceScreenStream = screenStream;
    screenTrack.contentHint = 'detail';
    screenTrack.addEventListener('ended', () =>
    {
      stopConferenceScreenShare(true).catch((error) => console.warn('[conference] stop screen failed', error));
    });

    document.querySelector('#screen').srcObject = screenStream;
    document.querySelector('#screen').classList.remove('hide');
    document.querySelector('#screen').play()
      .catch(() => {});
    openScreenShareDialog('local');

    for (let index = 0; index < targets.length; index++)
    {
      const leg = targets[index];

      try
      {
        if (screenTrack.readyState === 'ended')
        {
          throw new Error('屏幕共享已由用户停止');
        }

        await shareConferenceScreenToLeg(leg, screenTrack, screenStream);
        successCount++;
        setStatus(`屏幕共享已发送给 ${getConferenceDisplayRole(leg)}`);
      }
      catch (error)
      {
        console.warn(`[conference] share screen to ${leg.role} failed`, error);
        setStatus(`屏幕共享发送给 ${getConferenceDisplayRole(leg)} 失败：${error.message || error}`);
        if (leg.screenSender) await leg.screenSender.replaceTrack(null).catch(() => {});
        leg.screenActive = false;
      }
    }

    if (successCount === 0)
    {
      await stopConferenceScreenShare();
    }
  }
  catch (error)
  {
    await stopConferenceScreenShare().catch(() => {});
    throw error;
  }
  finally
  {
    conferenceScreenStarting = false;
    updateConferenceUi();
  }
}

async function stopConferenceScreenShare(fromTrackEnded)
{
  const tasks = [];

  conferenceLegs.forEach((leg) =>
  {
    if (!leg.screenActive || !leg.screenSender)
    {
      return;
    }

    try { sendConferenceScreenInfo(leg, 'stop'); }
    catch (error) { console.warn(`[conference] send screen stop to ${leg.role} failed`, error); }

    tasks.push(leg.screenSender.replaceTrack(null).catch(() => {}));
    leg.screenActive = false;
  });

  await Promise.all(tasks);

  const stream = conferenceScreenStream;

  conferenceScreenStream = null;
  document.querySelector('#screen').srcObject = null;
  document.querySelector('#screen').classList.add('hide');
  closeScreenShareDialog('local');

  if (stream && !fromTrackEnded)
  {
    CRTC.Utils.closeMediaStream(stream);
  }

  // 系统共享选择器的“停止共享”通过 track ended 进入这里，
  // 统一刷新按钮，避免页面仍停留在“停止共享”状态。
  updateConferenceUi();
}

// =============================================================================
// 呼转与页面状态
// =============================================================================

/**
 * 三方模式下的 REFER 呼转。
 * 仅在只有一路已确认成员时可用；三方期间不支持 REFER。
 */
function referConferenceTwoPartyCall()
{
  const leg = getConferenceSelectedLeg();

  if (!leg || conferenceLegs.size !== 1 || !leg.confirmed)
  {
    setStatus('三方期间暂不支持 REFER');

    return;
  }

  const eventHandlers = {
    progress         : (data) => console.log('progress', data),
    failed           : () => { if (leg.session.isOnHold().local) leg.session.unhold(); },
    accepted         : (data) => { console.log('accept', data); leg.session.terminate(); },
    trying           : (data) => console.log('trying', data),
    requestSucceeded : (data) => console.log('requestSucceeded', data),
    requestFailed    : () => { if (leg.session.isOnHold().local) leg.session.unhold(); }
  };

  leg.session.hold();
  leg.session.refer(`${document.querySelector('#refer').value}@${sipDomain}`, { eventHandlers });
}

function cancelConferenceTwoPartyRefer()
{
  const leg = getConferenceSelectedLeg();

  if (leg && conferenceLegs.size === 1)
  {
    leg.session.sendInfo('text/plain', JSON.stringify({ event: 'cancel' }));
  }
}

/**
 * 刷新会议控制面板 UI。
 *
 * 负责：
 * - 渲染成员列表（含选中、共享目标、挂断按钮）
 * - 更新"接听来电"按钮的显示/隐藏状态
 * - 更新"添加成员"按钮的可用性
 * - 控制"开始/停止共享"按钮
 * - 重绑定当前选中成员的控制栏按钮
 * - 管理 REFER 相关按钮
 */
function updateConferenceUi()
{
  const participants = document.querySelector('#conferenceParticipants');
  const answerButton = document.querySelector('#conferenceAnswerVideo');
  const callButton = document.querySelector('#conferenceCallVideo');
  const hangupAllButton = document.querySelector('#conferenceHangupAll');
  const startScreenButton = document.querySelector('#conferenceStartScreen');
  const stopScreenButton = document.querySelector('#conferenceStopScreen');
  const referButton = document.querySelector('#referBtn');
  const cancelReferButton = document.querySelector('#cancelReferBtn');
  const threePartyActive = conferenceLegs.size > 1 || Boolean(conferencePendingOutgoing);
  const conferenceEnabled = typeof appMode !== 'undefined' && appMode === 'conference';
  const bLeg = getConferenceLegByRole('B');

  if (!participants)
  {
    return;
  }

  participants.textContent = '';
  conferenceLegs.forEach((leg) =>
  {
    const item = document.createElement('div');
    const selectButton = document.createElement('button');
    const screenTargetButton = document.createElement('button');
    const hangupButton = document.createElement('button');

    item.className = 'btn-group conference-participant-item';
    item.setAttribute('role', 'group');
    item.setAttribute('aria-label', `${getConferenceDisplayRole(leg)} 会议成员控制`);
    selectButton.type = 'button';
    selectButton.className = 'btn btn-sm conference-participant-select ' +
      `${conferenceSelectedLegId === leg.session.id ? 'btn-primary' : 'btn-outline-primary'}`;
    selectButton.textContent = `${getConferenceDisplayRole(leg)}: ${leg.remoteNo || '-'} ` +
      `(${leg.confirmed ? '通话中' : '等待中'}${leg.silent ? '，静默' : ''})`;
    selectButton.onclick = function()
    {
      selectConferenceLeg(leg);
      renderConferenceMainVideo();
      updateConferenceUi();
    };
    screenTargetButton.type = 'button';
    screenTargetButton.className = 'btn btn-sm conference-participant-share ' +
      `${leg.screenTarget ? 'btn-success' : 'btn-outline-success'}`;
    screenTargetButton.disabled = !leg.confirmed || Boolean(conferenceScreenStream);
    screenTargetButton.title = leg.screenTarget ? '取消该成员的共享目标' : '选择该成员为共享目标';
    screenTargetButton.setAttribute('aria-label', screenTargetButton.title);
    screenTargetButton.setAttribute('aria-pressed', String(Boolean(leg.screenTarget)));
    screenTargetButton.innerHTML = '<i class="bi-display-fill"></i>';
    screenTargetButton.onclick = function()
    {
      leg.screenTarget = !leg.screenTarget;
      updateConferenceUi();
    };
    hangupButton.type = 'button';
    hangupButton.className = 'btn btn-sm btn-outline-danger conference-participant-hangup';
    hangupButton.title = `挂断 ${getConferenceDisplayRole(leg)}: ${leg.remoteNo || '-'}`;
    hangupButton.setAttribute('aria-label', hangupButton.title);
    hangupButton.innerHTML = '<i class="bi-telephone-x-fill"></i>';
    hangupButton.onclick = function()
    {
      terminateConferenceLeg(leg.session.id);
    };
    item.appendChild(selectButton);
    item.appendChild(screenTargetButton);
    item.appendChild(hangupButton);
    participants.appendChild(item);
  });

  if (conferenceLegs.size === 0)
  {
    const empty = document.createElement('span');

    empty.className = 'conference-empty';
    empty.textContent = '暂无会议成员';
    participants.appendChild(empty);
  }

  const pendingAnswer = Array.from(conferenceLegs.values()).some((leg) =>
    leg.originator === 'remote' && !leg.confirmed && !leg.answering && !leg.autoAnswer);

  if (answerButton)
  {
    answerButton.disabled = !conferenceEnabled || !pendingAnswer;
    answerButton.classList.toggle('hide', !pendingAnswer);
  }
  if (callButton)
  {
    const nextRole = getConferenceNextRole();

    callButton.disabled = !conferenceEnabled || Boolean(conferencePendingOutgoing) ||
      conferenceLegs.size >= CONFERENCE_MAX_LEGS ||
      (nextRole === 'C' && (!bLeg || !bLeg.confirmed));
    callButton.textContent = '添加成员';
    callButton.classList.toggle('hide', Boolean(conferencePendingOutgoing) ||
      conferenceLegs.size >= CONFERENCE_MAX_LEGS);
  }
  if (hangupAllButton) hangupAllButton.disabled = !conferenceEnabled || conferenceLegs.size === 0;
  if (startScreenButton)
  {
    const hasSelectedScreenTarget = getConferenceScreenTargetLegs().length > 0;

    startScreenButton.disabled = !conferenceEnabled || conferenceScreenStarting ||
      Boolean(conferenceScreenStream) || !hasSelectedScreenTarget;
    startScreenButton.classList.toggle('hide', Boolean(conferenceScreenStream));
  }
  if (stopScreenButton)
  {
    stopScreenButton.disabled = !conferenceEnabled || !conferenceScreenStream;
    stopScreenButton.classList.toggle('hide', !conferenceScreenStream);
  }
  if (conferenceEnabled)
  {
    bindConferenceSelectedSessionControls();

    if (referButton)
    {
      referButton.disabled = threePartyActive;
      referButton.onclick = referConferenceTwoPartyCall;
    }
    if (cancelReferButton)
    {
      cancelReferButton.disabled = threePartyActive;
      cancelReferButton.onclick = cancelConferenceTwoPartyRefer;
    }
  }
}

function answerPendingConferenceVideo()
{
  return answerConferenceLeg().catch((error) => setStatus(`会议接听失败：${error.message || error}`));
}
