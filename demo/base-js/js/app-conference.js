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
const MAX_LEGS = 2;
// session.id → leg 对象的映射，管理所有会议成员会话
const confLegs = new Map();

// 待确认的外呼会话参数，newRTCSession 事件中使用后清除
let pendingCall = null;
// 当前在统计面板和控制栏中选中的成员会话 ID
let selectedId = null;
// A-B 主会话的 MediaEffectsComposer 实例，用于合成 B + C 的远端媒体
let confMixer = null;
// 当前 composer 所属的会话 ID（可能是 A-B 或静默 C 的会话）
let mixHostId = null;
// 会议屏幕共享的 MediaStream
let shareStream = null;
// 是否正在发起屏幕共享（防止并发启动）
let sharing = false;
// 媒体合成调度队列，确保合成操作串行执行
let mixQueue = Promise.resolve();
// 媒体合成防抖定时器
let mixTimer = null;
// 当前合成签名字符串，用于跳过无变化的重复合成
let mixKey = '';

/**
 * 读取 SIP 请求中的自定义头部字段。
 * 用于识别 X-Silent-Join 等三方特有的信令标记。
 *
 * @param {object} request - SIP 请求对象（invite/reinvite）
 * @param {string} name - 头部字段名称
 * @returns {string|null} 头部字段值，不存在则返回 null
 */
function getConfHeader(request, name)
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
function hasConfHeader(value)
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
function getLegByRole(role)
{
  return Array.from(confLegs.values()).find((leg) => leg.role === role) || null;
}

/**
 * 获取下一个可用角色。
 * B 优先被分配，B 已存在时返回 C。
 */
function getNextRole()
{
  return getLegByRole('B') ? 'C' : 'B';
}

/**
 * 获取所有已确认且未结束的会议成员。
 */
function getLiveLegs()
{
  return Array.from(confLegs.values()).filter((leg) => leg.confirmed && !leg.ended);
}

/**
 * 获取当前选中的会议成员。
 *
 * 优先返回用户手动选中的成员；否则返回第一个可见成员（非静默、未结束）；
 * 再回退到任意未结束成员。
 */
function getSelLeg()
{
  if (selectedId && confLegs.has(selectedId))
  {
    const selectedLeg = confLegs.get(selectedId);

    if (!selectedLeg.ended)
    {
      return selectedLeg;
    }
  }

  const activeLegs = Array.from(confLegs.values()).filter((leg) => !leg.ended);
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
 * 与点对点模式共用 getFxOpts()，但强制启用 insertable 模式，
 * 确保即使页面未选择任何特效，主会话也持有可动态添加远端源的 composer。
 */
function buildMixOpts()
{
  const options = Object.assign({}, getFxOpts() || {});

  // 即使页面没有选择特效，主会话也必须创建 composer，供三方动态加源。
  options.enableInsertable = true;

  return options;
}

/**
 * 获取当前会议的 MediaEffectsComposer 实例。
 *
 * 优先返回缓存的 confMixer；否则尝试从 A-B 主会话获取。
 * 供 app-media-effects.js 中的 getFx() 调用，
 * 让媒体特效面板在三方模式下操作正确的 composer。
 */
function getConfMixer()
{
  if (confMixer)
  {
    return confMixer;
  }

  const hostLeg = getLegByRole('B');

  return hostLeg && hostLeg.session.getMediaEffectsComposer ?
    hostLeg.session.getMediaEffectsComposer() : null;
}

/**
 * 构建三方模式下的 features 列表。
 *
 * 三方屏幕共享使用 RTCSession.share() 的非 BFCP 辅流模式，
 * 因此需要从 features 中移除 BFCP，避免 SDK 同时创建 BFCP 占位轨并执行
 * FloorRequest。音视频通话、媒体特效等其他 features 保持页面原配置。
 *
 * @returns {Array} 适用于每条会议 RTCSession 的功能列表
 */
function getConfFx()
{
  // 三方共享由 SDK 辅流模式协商第二条 video m-line，不使用 BFCP 占位轨。
  return features.filter((feature) => String(feature).toUpperCase() !== 'BFCP');
}

/**
 * 确保 A-B 主会话拥有可用的 MediaEffectsComposer。
 *
 * 如果主会话尚未创建 composer，则调用 updateMediaEffectsComposer 初始化。
 * 创建成功后刷新本端预览，确保 composer 的原始输入流正确绑定到 localVid。
 *
 * @throws {Error} 如果主会话不存在或无法创建 composer
 */
async function ensureMixer(hostLeg)
{
  if (!hostLeg || !hostLeg.session)
  {
    throw new Error('A-B 主会话不存在');
  }

  let composer = hostLeg.session.getMediaEffectsComposer && hostLeg.session.getMediaEffectsComposer();

  if (!composer && hostLeg.session.updateMediaEffectsComposer)
  {
    await hostLeg.session.updateMediaEffectsComposer(buildMixOpts());
    composer = hostLeg.session.getMediaEffectsComposer();
    showLocal(hostLeg);
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
function cloneHost(hostLeg)
{
  const source = hostLeg.session.getComposerInputStream &&
    hostLeg.session.getComposerInputStream();

  if (!source || source.getTracks().length === 0)
  {
    throw new Error('A-B 主会话没有可复用的 A 原始媒体流');
  }

  const backup = new MediaStream();

  source.getTracks().forEach((track) => backup.addTrack(track.clone()));

  return backup;
}

/**
 * 用 composer 输出轨构建 MediaStream。
 * 视频轨来自 composer.getVideoStream()，音频轨来自指定的音频流。
 */
function getMixStream(videoTrack, audioStream)
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
async function prepCOutput(hostLeg)
{
  const composer = await ensureMixer(hostLeg);
  const backupStream = cloneHost(hostLeg);

  try
  {
    loadRemote(hostLeg);
    setMixSource(composer, hostLeg, hostLeg.rStream, 1);

    const videoTrack = composer.getVideoStream().getVideoTracks()[0];

    if (!videoTrack)
    {
      throw new Error('A-B composer 没有输出视频轨');
    }

    const cAudio = await composer.getAudioStream({ slots: [ 0, 1 ] });
    const bAudio = await composer.getAudioStream({ slots: [ 0, 2 ] });
    const bAudioTrack = bAudio && bAudio.getAudioTracks()[0];

    saveMedia(hostLeg);
    if (hostLeg.audioSender && bAudioTrack)
    {
      await hostLeg.audioSender.replaceTrack(bAudioTrack);
    }

    hostLeg.mixAudio = bAudio;
    confMixer = composer;
    mixHostId = hostLeg.session.id;

    return {
      mediaStream : getMixStream(videoTrack, cAudio),
      mixAudio    : cAudio,
      backupStream,
      mixerHostId : hostLeg.session.id
    };
  }
  catch (error)
  {
    await undoCOutput(hostLeg, { backupStream });
    throw error;
  }
}

/**
 * 回滚 prepCOutput 的状态变更。
 *
 * 在 C 呼叫失败或 composer 宿主切换时需要调用，确保：
 * - 移除已添加到 composer 的 B 远端源
 * - 恢复 B 的原始音频 sender
 * - 释放已创建的混音输出和降级流
 */
async function undoCOutput(hostLeg, output)
{
  const composer = hostLeg && hostLeg.session.getMediaEffectsComposer &&
    hostLeg.session.getMediaEffectsComposer();

  if (composer && hostLeg.mixSource)
  {
    try { composer.removeSource(hostLeg.mixSource); }
    catch (error) {}
    hostLeg.mixSource = null;
  }

  await restoreMedia(hostLeg);

  if (composer)
  {
    try { composer.releaseSubmixAudioStream({ slots: [ 0, 2 ] }); }
    catch (error) {}
    try { composer.releaseSubmixAudioStream({ slots: [ 0, 1 ] }); }
    catch (error) {}
  }

  if (hostLeg) hostLeg.mixAudio = null;
  if (output && output.backupStream)
  {
    CRTC.Utils.closeMediaStream(output.backupStream);
  }

  if (hostLeg && mixHostId === hostLeg.session.id)
  {
    confMixer = null;
    mixHostId = null;
    mixKey = '';
  }
}

/**
 * 构建三方会议外呼的 call options。
 *
 * @param {'B'|'C'} role - 呼叫的角色
 * @param {object|null} cOutput - prepCOutput 的返回值，C 呼出时必传
 *
 * B 的呼叫：使用用户选择的摄像头/麦克风约束，创建独立的 composer。
 * C 的呼叫（非静默）：使用 A-B 主 composer 的输出流作为 mediaStream，
 *   传入 { audio: true, video: true } 告诉 SDK 保留已有轨道、不重复采集。
 *   这样 C 在 INVITE 阶段就绑定了稳定的 composer 输出轨。
 */
function buildCallOpts(role, cOutput)
{
  const options = {
    extraHeaders : [
      `X-Data: ${xdata}`,
      `X-UA: ${navigator.userAgent}`,
      'X-Direction: sendrecv'
    ],
    extraFeatures : getConfFx(),
    pcConfig      : pcConfig,
    eventHandlers : {
      mediaEffectsIssue : onFxIssue
    }
  };

  if (role === 'B')
  {
    options.mediaConstraints = {
      audio : getAudioOpts(),
      video : getVideoOpts()
    };
    options.rtcOfferConstraints = {
      offerToReceiveAudio : true,
      offerToReceiveVideo : true
    };
    options.mediaEffectsComposer = buildMixOpts();
    options.nsMode = getNsOpts();

    return options;
  }

  // 普通 C 在 INVITE 创建时就绑定 A-B 主 composer 的稳定输出轨。
  // 通话确认后只向 composer 加入 C 源，不再替换 C 的 sender。
  if (!cOutput || !cOutput.mediaStream)
  {
    throw new Error('普通 C 缺少 A-B composer 输出流');
  }
  options.mediaStream = cOutput.mediaStream;
  // true 表示保留自定义流中已有的轨道。RTCSession 会在识别到
  // mediaStream 轨道后自动关闭重复 getUserMedia，不能传 false 或留空。
  options.mediaConstraints = { audio: true, video: true };
  options.rtcOfferConstraints = {
    offerToReceiveAudio : true,
    offerToReceiveVideo : true
  };
  options.nsMode = getNsOpts();

  return options;
}

/**
 * 构建三方会议接听的 answer options。
 *
 * @param {object} leg - 待接听的会议成员
 * @param {object|null} cOutput - 普通 C 的 composer 输出
 *
 * B 的接听：使用用户选择的设备约束，创建独立 composer。
 * 普通 C 的接听：复用 prepCOutput 的输出流。
 * 静默 C 的接听：使用独立 composer，应答时以 A 的设备流创建输出；
 *   会话确认后再动态加入 B 的远端源。
 */
function getAnswerOpts(leg, cOutput)
{
  const options = {
    pcConfig     : Object.assign({}, pcConfig, { rtcpMuxPolicy: 'negotiate' }),
    extraHeaders : [
      `X-Data: ${xdata}`,
      `X-UA: ${navigator.userAgent}`,
      `X-Direction: ${leg.direction}`
    ],
    extraFeatures       : getConfFx(),
    rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true }
  };

  if (leg.role === 'B')
  {
    options.mediaConstraints = {
      audio : getAudioOpts(),
      video : getVideoOpts()
    };
    options.mediaEffectsComposer = buildMixOpts();
    options.nsMode = getNsOpts();
  }
  else
  {
    if (leg.silent)
    {
      // 静默 C 使用独立 composer：answer 时先以 A 的设备流创建输出，
      // 会话确认后再动态加入 B，不会影响 A-B 主会话。
      options.mediaConstraints = {
        audio : getAudioOpts(),
        video : getVideoOpts()
      };
      options.mediaEffectsComposer = buildMixOpts();
    }
    else
    {
      if (!cOutput || !cOutput.mediaStream)
      {
        throw new Error('普通 C 缺少 A-B composer 输出流');
      }
      options.mediaStream = cOutput.mediaStream;
      options.mediaConstraints = { audio: true, video: true };
    }
    options.nsMode = getNsOpts();
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
 * - rStream/rAudio/rVideo：远端媒体轨
 * - audioSender/videoSender/audioTrack/videoTrack：
 *   原始 sender 和 track 快照，用于 composer 降级恢复
 * - sharingScreen：该会话是否已经由 session.share() 成功发送屏幕辅流
 * - shareTarget：用户是否选择把下一次屏幕或白板共享发送给该成员
 *
 * 创建 leg 时自动将其注册到 confLegs，并根据可见性设置默认选中。
 */
function addLeg(session, opts)
{
  const leg = {
    session,
    role          : opts.role,
    remoteNo      : opts.remoteNo,
    originator    : opts.originator,
    direction     : opts.direction || 'sendrecv',
    silent        : Boolean(opts.silent),
    confirmed     : false,
    answering     : false,
    answerTimer   : null,
    stage         : 'created',
    autoAnswer    : Boolean(opts.autoAnswer),
    ended         : false,
    rStream       : new MediaStream(),
    rAudio        : null,
    rVideo        : null,
    audioSender   : null,
    videoSender   : null,
    audioTrack    : null,
    videoTrack    : null,
    backupStream  : opts.backupStream || null,
    mixerHostId   : opts.mixerHostId || null,
    mixSource     : null,
    mixAudio      : opts.mixAudio || null,
    audioEl       : null,
    sharingScreen : false,
    shareTarget   : false,
    tracksBound   : false,
    stats         : null
  };

  confLegs.set(session.id, leg);
  // 非静默成员或第一个成员自动成为当前选中
  if (!leg.silent || confLegs.size === 1)
  {
    selectedId = session.id;
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

function showLegStats(leg)
{
  const role = leg.role;
  const remote = leg.remoteNo || '-';

  setStats('#statsPc', `A-${role} PeerConnection（${role}: ${remote}）`);
  setStats('#statsOutLabel', `A → ${role}:`);
  setStats('#statsInLabel', `${role} → A:`);
}

/**
 * 选中会议成员并更新统计面板。
 *
 * 切换 selectedId 和 rtcSession，刷新 PeerConnection 标题、
 * 上行/下行标签，并渲染最新统计报告。
 */
function selectLeg(leg)
{
  if (!leg || leg.ended)
  {
    return;
  }

  selectedId = leg.session.id;
  rtcSession = leg.session;
  statsCall = leg.session;
  showLegStats(leg);

  if (leg.stats)
  {
    renderStats(leg.session, leg.stats);
  }
  else
  {
    resetStats();
  }
}

function bindLegStats(leg)
{
  leg.session.on('stats:detailed-report', (report) =>
  {
    leg.stats = report;
    renderStats(leg.session, report);
  });

  leg.session.on('stats:stats-error', (error) =>
  {
    if (statsCall === leg.session)
    {
      console.warn('[conference] stats error', error);
    }
  });

  if (selectedId === leg.session.id)
  {
    selectLeg(leg);
  }
}

/**
 * 以当前选中成员为目标执行操作。
 *
 * 所有控制栏按钮（静音、保持、挂断等）都通过此函数统一获取当前选中的
 * 会议成员会话并执行操作，避免每个按钮重复检查有效性。
 */
function withLeg(action, callback)
{
  const leg = getSelLeg();

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
 * 在三方模式启用时由 updateConfUi 调用，将控制栏按钮事件
 * 重定向到当前选中的成员会话。
 */
function bindControls()
{
  const bindClick = (selector, handler) =>
  {
    const element = document.querySelector(selector);

    if (element) element.onclick = handler;
  };

  bindClick('#cancel', () => withLeg('挂断', (session) => session.terminate()));
  bindClick('#muteMic', () => withLeg('关闭麦克风', (session) => session.mute({ audio: true })));
  bindClick('#unmuteMic', () => withLeg('开启麦克风', (session) => session.unmute({ audio: true })));
  bindClick('#muteCam', () => withLeg('关闭摄像头', (session) => session.mute({ video: true })));
  bindClick('#unmuteCam', () => withLeg('开启摄像头', (session) => session.unmute({ video: true })));
  bindClick('#hold', () => withLeg('切换保持状态', (session) =>
  {
    const holdState = session.isOnHold();

    if (holdState.local) session.unhold();
    else if (!holdState.remote) session.hold();
  }));
  bindClick('#dtmf', (event) => withLeg('发送 DTMF', (session) =>
  {
    session.sendDTMF(event.target.innerText, { transportType: 'RFC2833' });
  }));
  bindClick('#sendInfo', () => withLeg('发送 INFO', (session) =>
  {
    session.sendInfo('text/plain', JSON.stringify(document.querySelector('#info').value));
  }));
  bindClick('#switchDev', () => withLeg('切换摄像头', (session) =>
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
      withLeg('设置视频内容类型', (session) =>
        session.setVideoContentHint(this.options[this.selectedIndex].value));
    };
  }
}

// =============================================================================
// 会话识别、远端媒体与 RTCSession 事件
//
// 三方模式下 newRTCSession 事件由 onConfSession 统一处理。
// 它负责分类呼入角色（B/C/静默）、创建 leg、绑定事件并决定是否自动接听。
// =============================================================================

/**
 * 从 newRTCSession 事件中提取远端号码。
 */
function getRemoteNo(e)
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
 * 本地外呼：使用 pending 队列中的 opts。
 * 远端呼入：根据 X-Silent-Join 头部和当前会议状态分配角色。
 */
function getSessOpts(e)
{
  if (e.originator === 'local' && pendingCall)
  {
    const pending = pendingCall;

    pendingCall = null;

    return pending;
  }

  if (e.originator !== 'remote')
  {
    return null;
  }

  const role = getNextRole();
  const silent = hasConfHeader(getConfHeader(e.request, 'X-Silent-Join'));

  return {
    role,
    originator : e.originator,
    remoteNo   : getRemoteNo(e),
    direction  : silent ? 'sendonly' : 'sendrecv',
    silent,
    autoAnswer : role === 'C' && silent
  };
}

function onTrackEnd(track, listener)
{
  if (track && track.addEventListener)
  {
    track.addEventListener('ended', listener, { once: true });
  }
}

/**
 * 监听 PeerConnection 的 track 事件，自动收集远端音视频轨。
 *
 * 每个 leg 只绑定一次 track 监听。音频轨放入 rStream 并创建
 * 隐式 audio 元素播放；视频轨放入 rStream 并刷新主画面。
 * 轨道 ended 时自动清理并触发重新合成。
 */
function bindTracks(leg)
{
  const connection = leg.session.connection;

  if (!connection || leg.tracksBound)
  {
    return;
  }

  leg.tracksBound = true;
  connection.addEventListener('track', (event) =>
  {
    const track = event.track;

    if (track.kind === 'audio' &&
      (!leg.rAudio || leg.rAudio.readyState !== 'live'))
    {
      if (leg.rAudio)
      {
        try { leg.rStream.removeTrack(leg.rAudio); }
        catch (error) {}
      }
      leg.rAudio = track;
      leg.rStream.addTrack(track);
      bindAudio(leg);
      queueMix();

      onTrackEnd(track, () =>
      {
        if (leg.rAudio !== track) return;
        try { leg.rStream.removeTrack(track); }
        catch (error) {}
        leg.rAudio = null;
        queueMix();
      });

      return;
    }

    if (track.kind === 'video' &&
      (!leg.rVideo || leg.rVideo.readyState !== 'live'))
    {
      if (leg.rVideo)
      {
        try { leg.rStream.removeTrack(leg.rVideo); }
        catch (error) {}
      }
      leg.rVideo = track;
      leg.rStream.addTrack(track);
      showMain();
      queueMix();

      onTrackEnd(track, () =>
      {
        if (leg.rVideo !== track) return;
        try { leg.rStream.removeTrack(track); }
        catch (error) {}
        leg.rVideo = null;
        showMain();
        queueMix();
      });

      return;
    }

  });
}

/**
 * 从 PeerConnection 中提取已存在的远端媒体轨。
 *
 * 用于 track 事件触发之前已有远端轨的场景（比如 early media 或
 * 快速协商），确保 rStream 包含所有已有轨道。
 */
function loadRemote(leg)
{
  const connection = leg.session.connection;

  if (!connection)
  {
    return;
  }

  const remoteStreams = CRTC.Utils.getStreams(connection, 'remote');
  const audioTrack = remoteStreams.audioStream.getAudioTracks()[0] || null;
  const videoTrack = remoteStreams.videoStream.getVideoTracks()[0] || null;

  if (audioTrack && !leg.rAudio)
  {
    leg.rAudio = audioTrack;
    leg.rStream.addTrack(audioTrack);
  }

  if (videoTrack && !leg.rVideo)
  {
    leg.rVideo = videoTrack;
    leg.rStream.addTrack(videoTrack);
  }

  bindAudio(leg);
}

function bindAudio(leg)
{
  if (!leg.rAudio)
  {
    return;
  }

  if (!leg.audioEl)
  {
    leg.audioEl = document.createElement('audio');
    leg.audioEl.autoplay = true;
    leg.audioEl.className = 'hide conference-remote-audio';
    document.body.appendChild(leg.audioEl);
  }

  leg.audioEl.srcObject = new MediaStream([ leg.rAudio ]);
  leg.audioEl.play().catch(() => {});
}

function saveMedia(leg)
{
  const senders = leg.session.connection ? leg.session.connection.getSenders() : [];
  const audioSender = senders.find((sender) => sender.track && sender.track.kind === 'audio') || null;
  const videoSender = senders.find((sender) => sender.track && sender.track.kind === 'video') || null;

  // 首次快照用于 composer 失败时恢复。后续 confirmed/localMediastreamUpdate
  // 可能发生在 replaceTrack 之后，不能用混音输出覆盖原始轨。
  if (!leg.audioSender && audioSender)
  {
    leg.audioSender = audioSender;
    leg.audioTrack = audioSender.track;
  }
  if (!leg.videoSender && videoSender)
  {
    leg.videoSender = videoSender;
    leg.videoTrack = videoSender.track;
  }
}

/**
 * 绑定 RTCSession 生命周期事件（sending/trying/progress/confirmed/ended 等）。
 *
 * 事件处理中包含：
 * - 信令阶段追踪（stage）
 * - confirmed 时自动收集轨道、记录原始 sender、触发 UI 更新和媒体合成
 * - ended/failed 时自动调用 removeLeg 清理资源
 */
function bindLegEvents(leg)
{
  const session = leg.session;

  const updateStage = (stage, detail) =>
  {
    leg.stage = stage;
    console.warn(`[conference] ${session.id} ${leg.role} stage=${stage}`, detail || '');
  };

  session.on('sending', () =>
  {
    updateStage('invite-sent');
    setStatus(`会议成员 ${leg.role} INVITE 已发送：${leg.remoteNo}`);
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
    setStatus(`会议成员 ${leg.role} 支持视频`);
  });

  session.on('refer', (data) =>
  {
    if (confLegs.size > 1)
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
      setStatus(`会议成员 ${leg.role} 媒体协商失败：${eventName}`);
    });
  });

  session.on('accepted', () =>
  {
    updateStage('accepted');
    leg.answering = false;
    clearAnswer(leg);
    setStatus(`会议成员 ${leg.role} 已接听${leg.silent ? '（静默）' : ''}`);
  });

  session.on('confirmed', () =>
  {
    updateStage('confirmed');
    leg.confirmed = true;
    leg.answering = false;
    clearAnswer(leg);
    bindTracks(leg);
    loadRemote(leg);
    saveMedia(leg);
    showLocal(leg);
    updateConfUi();
    showMain();
    queueMix();

    // 只向当前白板共享目标发送快照，避免未选中的成员收到白板内容。
    if (typeof sendSnapshot === 'function' &&
      typeof isBoardLeg === 'function' && isBoardLeg(session))
    {
      sendSnapshot(session);
    }

    setStatus(`会议成员 ${leg.role} 通话已确认${leg.silent ? '（静默）' : ''}`);
  });

  session.on('cameraChanged', (data) =>
  {
    const hostLeg = getLegByRole('B');
    const previewLeg = hostLeg || getSelLeg();
    const videoTrack = data.videoStream && data.videoStream.getVideoTracks ?
      data.videoStream.getVideoTracks()[0] : null;

    if (!previewLeg || previewLeg.session !== session)
    {
      return;
    }

    if (videoTrack)
    {
      setMedia(localVid, new MediaStream([ videoTrack ]));
      localVid.play().catch(() => {});
    }

    if (hostLeg)
    {
      // 桥接端需要在下一轮按更新后的 composer 原始输入重新校准预览。
      setTimeout(() => showLocal(leg), 0);
    }
  });

  session.on('localMediastreamUpdate', () =>
  {
    showLocal(leg);
  });

  session.on('hold', (data) =>
  {
    setStatus(`会议成员 ${leg.role} 已保持（${data.originator}）`);
  });

  session.on('unhold', (data) =>
  {
    setStatus(`会议成员 ${leg.role} 已恢复（${data.originator}）`);
  });

  session.on('muted', (data) =>
  {
    setStatus(`会议成员 ${leg.role} 已静音：${data.audio ? '音频' : ''}${data.video ? '视频' : ''}`);
  });

  session.on('unmuted', (data) =>
  {
    setStatus(`会议成员 ${leg.role} 已取消静音：${data.audio ? '音频' : ''}${data.video ? '视频' : ''}`);
  });

  session.on('failed', (data) =>
  {
    updateStage('failed', data);
    leg.answering = false;
    clearAnswer(leg);
    setStatus(`会议成员 ${leg.role} 建立失败: ${data.cause}`);
    removeLeg(leg);
  });

  session.on('ended', (data) =>
  {
    updateStage('ended', data);
    leg.answering = false;
    clearAnswer(leg);
    setStatus(`会议成员 ${leg.role} 通话结束: ${data.cause}`);
    removeLeg(leg);
  });

  if (leg.originator === 'remote') session.on('mediaEffectsIssue', onFxIssue);
  bindLegStats(leg);
  bindTracks(leg);
}

function clearAnswer(leg)
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
function onConfSession(e)
{
  if (e.originator === 'local' && !pendingCall)
  {
    e.session.terminate();
    setStatus('三方模式下请使用会议呼叫按钮');

    return true;
  }

  if (confLegs.size >= MAX_LEGS)
  {
    e.session.terminate({ status_code: 486, reason_phrase: 'Conference Full' });
    setStatus('三方会议已满，已拒绝额外来电');

    return true;
  }

  const opts = getSessOpts(e);

  if (!opts)
  {
    return false;
  }

  const oldLeg = getLegByRole(opts.role);

  if (oldLeg && oldLeg.session !== e.session)
  {
    e.session.terminate({ status_code: 486, reason_phrase: 'Conference Role Busy' });
    setStatus(`会议成员 ${opts.role} 已存在，拒绝重复呼入`);

    return true;
  }

  const host = getLegByRole('B');

  if (opts.role === 'B' && opts.silent)
  {
    e.session.terminate({ status_code: 486, reason_phrase: 'Conference Host Not Ready' });
    setStatus('静默 C 呼入过早，请等待 A-B 接通后重试');

    return true;
  }

  if (opts.role === 'C' && (!host || !host.confirmed))
  {
    e.session.terminate({ status_code: 486, reason_phrase: 'Conference Host Not Ready' });
    setStatus('A-B 尚未确认，已拒绝 C 的提前呼入');

    return true;
  }

  if (e.originator === 'remote')
  {
    console.warn('[conference] incoming classified', {
      role       : opts.role,
      silent     : opts.silent,
      silentJoin : getConfHeader(e.request, 'X-Silent-Join')
    });
  }

  opts.remoteNo = opts.remoteNo || getRemoteNo(e);
  const leg = addLeg(e.session, opts);

  if (typeof bindInk === 'function') bindInk(e.session);
  bindLegEvents(leg);
  updateConfUi();

  if (e.originator === 'remote')
  {
    if (leg.autoAnswer)
    {
      setStatus(`收到静默会议成员 ${leg.role} 呼叫：${leg.remoteNo}，正在自动接听`);
      setTimeout(() => answerLeg(leg).catch((error) =>
      {
        console.warn('[conference] silent answer failed', error);
        try { leg.session.terminate({ status_code: 480 }); }
        catch (endError) {}
      }), 0);
    }
    else
    {
      selectedId = leg.session.id;
      setStatus(`收到会议成员 ${leg.role} 呼叫：${leg.remoteNo}`);
      showNotice('video', leg.remoteNo);
    }
  }

  return true;
}

/**
 * 发起会议外呼。
 *
 * B 的呼叫：使用用户选择的设备，创建独立 composer。
 * C 的呼叫：先调用 prepCOutput 准备 A-B 主 composer 的
 *   合成输出流，然后将该流作为 C 呼叫的 mediaStream 传入。这样 C 在
 *   INVITE 阶段就绑定了 A+B 的合成画面和混音，通话确认后只需向 composer
 *   加入 C 的远端源即可。
 *
 * @param {object} options - { role: 'B'|'C' }
 */
async function callConf(options)
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

  if (pendingCall)
  {
    setStatus('已有会议呼叫正在创建');

    return;
  }

  if (confLegs.size >= MAX_LEGS)
  {
    setStatus('三方会议已满');

    return;
  }

  const role = options.role || getNextRole();

  if (role !== 'B' && role !== 'C')
  {
    setStatus('会议成员角色仅支持 B 或 C');

    return;
  }
  if (getLegByRole(role))
  {
    setStatus(`会议成员 ${role} 已存在`);

    return;
  }

  const hostLeg = getLegByRole('B');

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

  let cOutput = null;
  let callOptions;
  // 在媒体准备前占用 pending 状态，避免用户快速重复点击创建两路相同会话。
  // newRTCSession 会消费同一个对象，补充字段时保持对象引用不变。
  const pending = {
    role,
    originator   : 'local',
    remoteNo     : number,
    direction    : 'sendrecv',
    silent       : false,
    backupStream : null,
    mixerHostId  : null,
    mixAudio     : null,
    autoAnswer   : false
  };

  pendingCall = pending;
  updateConfUi();

  try
  {
    if (role === 'C') cOutput = await prepCOutput(hostLeg);

    // 媒体准备期间可能已通过“全部挂断”或会话结束取消本次呼叫。
    if (pendingCall !== pending)
    {
      if (cOutput) await undoCOutput(hostLeg, cOutput);

      return;
    }

    if (cOutput)
    {
      pending.backupStream = cOutput.backupStream;
      pending.mixerHostId = cOutput.mixerHostId;
      pending.mixAudio = cOutput.mixAudio;
    }
    callOptions = buildCallOpts(role, cOutput);
  }
  catch (error)
  {
    if (pendingCall === pending)
    {
      pendingCall = null;
      if (cOutput) await undoCOutput(hostLeg, cOutput);
    }
    updateConfUi();
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
    if (pendingCall === pending)
    {
      pendingCall = null;
      if (cOutput) await undoCOutput(hostLeg, cOutput);
    }
    updateConfUi();
    setStatus(`会议呼叫失败：${error.message || error}`);
  }
}

/**
 * 以静默 C 身份呼叫 A。
 *
 * 使用 recvonly 方向 + X-Silent-Join 头部，只收 A-B 合成流，
 * 不发送音视频。CDemo 在点对点模式下使用此按钮模拟 C 端接入。
 */
async function callSilentC()
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
    extraFeatures       : getConfFx(),
    pcConfig            : pcConfig,
    mediaConstraints    : { audio: false, video: false },
    rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
    eventHandlers       : {
      mediaEffectsIssue : onFxIssue
    }
  };

  if (rtcSession && !rtcSession.isEnded()) rtcSession.terminate();
  setStatus(`正在以静默 C 身份呼叫 A：${number}`);
  const session = await ua.call(`${number}@${sipDomain}`, callOptions);

  // 静默呼叫不走普通 call() 的早期媒体监听。A 会在会话确认后向
  // C 会话的 composer 加入 B 源，因此 C 端需在远端轨到达时再刷新主画面。
  const refreshMedia = () =>
  {
    if (session.connection && !session.isEnded())
    {
      showStreams(session.connection);
    }
  };

  if (session.connection && session.connection.addEventListener)
  {
    session.connection.addEventListener('track', refreshMedia);
  }
  if (session.on)
  {
    session.on('confirmed', refreshMedia);
  }
}

/**
 * 接听会议来电。
 *
 * 对于普通 C，先准备 composer 输出流再应答；静默 C 创建独立 composer。
 * 设置超时保护，超时后自动挂断避免来电挂起。
 */
async function answerLeg(leg)
{
  leg = leg || getSelLeg();

  if (!leg || leg.originator !== 'remote' || leg.confirmed || leg.answering)
  {
    setStatus('当前没有待接听的会议会话');

    return;
  }

  leg.answering = true;
  leg.stage = 'answer-requested';
  let cOutput = null;

  try
  {
    if (leg.role === 'C' && !leg.silent)
    {
      const hostLeg = getLegByRole('B');

      if (!hostLeg || !hostLeg.confirmed || hostLeg.ended)
      {
        throw new Error('A-B 主会话尚未就绪');
      }

      cOutput = await prepCOutput(hostLeg);
      leg.backupStream = cOutput.backupStream;
      leg.mixerHostId = cOutput.mixerHostId;
      leg.mixAudio = cOutput.mixAudio;
    }

    if (leg.ended || leg.session.isEnded())
    {
      throw new Error('待接听会话已结束');
    }

    const answerOpts = getAnswerOpts(leg, cOutput);

    // 静默 C 的 answerOpts 会为这路单独创建 composer，先以 A 媒体完成
    // SIP 应答；会话确认后再加入 B 源，不阻塞建链也不改动 A-B 会话。
    leg.session.answer(answerOpts);
    const timeout = ua && ua.configuration && ua.configuration.no_answer_timeout ?
      ua.configuration.no_answer_timeout : 60000;

    clearAnswer(leg);
    leg.answerTimer = setTimeout(() =>
    {
      if (leg.ended || leg.confirmed || leg.stage === 'accepted')
      {
        return;
      }

      leg.answering = false;
      console.warn(`[conference] ${leg.session.id} answer timeout at stage=${leg.stage}`);
      setStatus(`会议成员 ${leg.role} 接听超时：${leg.stage}`);
      try { leg.session.terminate({ status_code: 480, reason_phrase: 'Conference Answer Timeout' }); }
      catch (endError) {}
    }, timeout);
    closeNotice();
    if (!leg.silent) setStatus(`正在接听会议成员 ${leg.role}`);
  }
  catch (error)
  {
    leg.answering = false;
    if (cOutput)
    {
      await undoCOutput(getLegByRole('B'), cOutput);
      leg.backupStream = null;
      leg.mixerHostId = null;
      leg.mixAudio = null;
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
function queueMix()
{
  if (!mixTimer)
  {
    mixTimer = setTimeout(() =>
    {
      mixTimer = null;
      mixQueue = mixQueue
        .then(() => syncMixer())
        .catch(async(error) =>
        {
          console.warn('[conference] sync failed', error);
          setStatus(`三方媒体合成失败，已保留原始通话：${error.message || error}`);

          if (confMixer)
          {
            confLegs.forEach((leg) =>
            {
              if (leg.mixSource)
              {
                try { confMixer.removeSource(leg.mixSource); }
                catch (removeError) {}
                leg.mixSource = null;
              }
            });
          }

          mixKey = '';
          await restoreAll(mixHostId);
          releaseMixer();
          showMain();
        });
    }, 0);
  }

  return mixQueue;
}

function getMixKey(hostLeg, cLeg)
{
  const trackKey = (track) =>
  {
    return track ? `${track.kind}:${track.id}:${track.readyState}` : '-';
  };

  return [
    hostLeg.session.id,
    cLeg.session.id,
    cLeg.silent ? 'silent' : 'normal',
    trackKey(hostLeg.rAudio),
    trackKey(hostLeg.rVideo),
    trackKey(cLeg.rAudio),
    trackKey(cLeg.rVideo)
  ].join('|');
}

/**
 * 更新 composer 中指定 leg 的远端媒体源。
 *
 * 每个 leg 在 composer 中最多有一个活跃的远端源。更换源时先移除旧的、
 * 再添加新的，避免轨道泄漏。
 */
function setMixSource(composer, leg, stream, slot)
{
  if (leg.mixSource === stream)
  {
    return;
  }

  if (leg.mixSource)
  {
    try { composer.removeSource(leg.mixSource); }
    catch (error) {}
  }

  leg.mixSource = null;

  if (stream && stream.getTracks().length > 0)
  {
    composer.addSource(stream, { slot, gain: 1 });
    leg.mixSource = stream;
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
 * 使用 key 跳过无变化的重复合成。合成失败时自动降级。
 */
async function syncMixer()
{
  const hostLeg = getLegByRole('B');
  const cLeg = getLegByRole('C');

  if (!hostLeg || !cLeg || !hostLeg.confirmed || !cLeg.confirmed)
  {
    return;
  }

  // 普通三方由 A-B 主会话合成 A+B+C。静默 C 则必须使用 C 会话
  // 自己的 composer，否则向主 composer 加入 B 后，B 正在接收的同一条
  // canvas 输出轨也会立即变成 A+B。
  const owner = cLeg.silent ? cLeg : hostLeg;
  const composer = owner.session.getMediaEffectsComposer &&
    owner.session.getMediaEffectsComposer();

  if (!composer)
  {
    throw new Error(cLeg.silent ?
      '静默 C 会话没有可用的 MediaEffectsComposer' :
      'A-B 主会话没有可用的 MediaEffectsComposer');
  }

  loadRemote(hostLeg);
  loadRemote(cLeg);

  if (!hostLeg.rVideo && !hostLeg.rAudio)
  {
    return;
  }

  const key = getMixKey(hostLeg, cLeg);

  if (key === mixKey)
  {
    return;
  }

  confMixer = composer;
  mixHostId = owner.session.id;

  if (cLeg.silent)
  {
    // C 会话的本地 A 媒体已是 slot 0，只需把 B 加到 slot 1。
    // composer 只属于 C 会话，其 A+B 输出不会影响 A-B 会话。
    setMixSource(composer, cLeg, hostLeg.rStream, 1);
  }
  else
  {
    setMixSource(composer, hostLeg, hostLeg.rStream, 1);
    setMixSource(composer, cLeg, cLeg.rStream, 2);
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
    hostLeg.mixAudio = null;
    cLeg.mixAudio = null;
  }
  else
  {
    let cAudio = cLeg.mixAudio;
    const cUsesMixer = cLeg.mixerHostId === hostLeg.session.id;

    if (!cAudio || !cUsesMixer)
    {
      cAudio = await composer.getAudioStream({ slots: [ 0, 1 ] });
    }

    const cAudioTrack = cAudio && cAudio.getAudioTracks()[0];
    const bAudio = hostLeg.mixAudio ||
      await composer.getAudioStream({ slots: [ 0, 2 ] });
    const bAudioTrack = bAudio && bAudio.getAudioTracks()[0];

    hostLeg.mixAudio = bAudio;
    cLeg.mixAudio = cAudio;

    // 首次呼入/呼出普通 C 时，C sender 在建链前已绑定这个主 composer，
    // 加入 C 源后只更新 canvas/audio graph。仅 B 挂断后重新补入新 B、
    // composer 宿主发生变化时，才需要把保留的 A-C 会话切到新 composer。
    if (!cUsesMixer)
    {
      const backupStream = cloneHost(hostLeg);

      try
      {
        if (cLeg.videoSender) await cLeg.videoSender.replaceTrack(videoTrack);
        if (cLeg.audioSender && cAudioTrack) await cLeg.audioSender.replaceTrack(cAudioTrack);
      }
      catch (error)
      {
        CRTC.Utils.closeMediaStream(backupStream);
        throw error;
      }

      if (cLeg.backupStream) CRTC.Utils.closeMediaStream(cLeg.backupStream);
      cLeg.backupStream = backupStream;
      cLeg.mixerHostId = hostLeg.session.id;
    }

    if (hostLeg.audioSender && bAudioTrack && hostLeg.audioSender.track !== bAudioTrack)
    {
      await hostLeg.audioSender.replaceTrack(bAudioTrack);
    }
  }

  mixKey = key;

  showLocal(hostLeg);
  showMain();
  updateConfUi();
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
async function restoreMedia(leg, badHostId)
{
  const tasks = [];
  const useFallback = Boolean(
    leg && badHostId && leg.mixerHostId === badHostId &&
    leg.backupStream
  );
  const backupVideo = useFallback && leg.backupStream.getVideoTracks()[0];
  const backupAudio = useFallback && leg.backupStream.getAudioTracks()[0];
  const videoTrack = backupVideo || (leg && leg.videoTrack);
  const audioTrack = backupAudio || (leg && leg.audioTrack);

  if (leg && leg.videoSender && videoTrack)
  {
    tasks.push(leg.videoSender.replaceTrack(videoTrack).catch(() => {}));
  }
  if (leg && leg.audioSender && audioTrack)
  {
    tasks.push(leg.audioSender.replaceTrack(audioTrack).catch(() => {}));
  }

  await Promise.all(tasks);

  if (useFallback)
  {
    leg.mixerHostId = null;
    leg.mixAudio = null;
  }
}

async function restoreAll(badHostId)
{
  await Promise.all(Array.from(confLegs.values()).map((leg) =>
    restoreMedia(leg, badHostId)));
}

// =============================================================================
// 媒体预览与会话清理
// =============================================================================

/**
 * 渲染远端主画面。
 *
 * 优先显示 B 的视频在 remoteVid 主区域；C 的视频在 confVideoC
 * 辅助区域。如果 B 没有视频轨，则 C 视频占满主区域。
 * 静默 C 的上行视频本就不存在，A 端不为它保留空白预览区。
 */
function showMain()
{
  const bLeg = getLegByRole('B');
  const cLeg = getLegByRole('C');
  const bTrack = bLeg && bLeg.rVideo;
  // 静默 C 的上行视频本就不存在，A 端不为它保留空白预览区。
  const cTrack = cLeg && !cLeg.silent ? cLeg.rVideo : null;
  const cVideo = document.querySelector('#confVideoC');

  if (bTrack)
  {
    bindPreview(remoteVid, bTrack, false);
    bindPreview(cVideo, cTrack, true);
  }
  else
  {
    bindPreview(remoteVid, cTrack, false);
    bindPreview(cVideo, null, true);
  }
}

/**
 * 渲染 A 端本地预览。
 *
 * 三方模式下优先取 A-B 主会话的 composer 原始输入流（getComposerInputStream），
 * 确保本地预览与 composer 看到的输入一致。回退到普通 localStream。
 */
function showLocal(leg)
{
  const hostLeg = getLegByRole('B');

  if (hostLeg)
  {
    leg = hostLeg;
  }

  if (!leg || !leg.session.connection)
  {
    return;
  }

  const source = leg.session.getComposerInputStream ?
    leg.session.getComposerInputStream() : null;
  const localStreams = CRTC.Utils.getStreams(leg.session.connection, 'local');
  const localTrack = source && source.getVideoTracks ?
    source.getVideoTracks()[0] : localStreams.videoStream.getVideoTracks()[0];

  if (localTrack)
  {
    setMedia(localVid, new MediaStream([ localTrack ]));
    localVid.play().catch(() => {});
  }
}

function bindPreview(video, track, hideEmpty)
{
  if (!video)
  {
    return;
  }

  if (!track || track.readyState !== 'live')
  {
    video.srcObject = null;
    video.classList.toggle('hide', Boolean(hideEmpty));

    return;
  }

  setMedia(video, new MediaStream([ track ]));
  video.classList.remove('hide');
  video.play().catch(() => {});
}

function releaseMixer()
{
  if (confMixer)
  {
    try { confMixer.releaseSubmixAudioStream({ slots: [ 0, 2 ] }); }
    catch (error) {}
    try { confMixer.releaseSubmixAudioStream({ slots: [ 0 ] }); }
    catch (error) {}
    try { confMixer.releaseSubmixAudioStream({ slots: [ 0, 1 ] }); }
    catch (error) {}
  }

  confMixer = null;
  mixHostId = null;
  mixKey = '';
}

/**
 * 清理单个会议成员的所有资源。
 *
 * 执行步骤：
 * 1. 清理屏幕共享页面状态（底层 sender 由 RTCSession 关闭）
 * 2. 移除远端音频播放元素
 * 3. 释放降级流
 * 4. 从 confLegs 中删除
 * 5. B 挂断时自动终止关联的静默 C
 * 6. 清理 composer 中的远端源
 * 7. 恢复保留成员的原始 track（如果 composer 宿主已销毁）
 * 8. 更新 UI 和统计面板
 */
async function removeLeg(leg)
{
  if (!leg || leg.ended)
  {
    return;
  }

  const silentCLeg = leg.role === 'B' ? getLegByRole('C') : null;

  leg.ended = true;
  clearAnswer(leg);

  // RTCSession 的 ended/failed 关闭流程会释放本会话的辅流 sender；这里仅清理
  // Demo 的选择/展示状态，不能 stop 全局屏幕流，否则仍在通话的其他 leg 也会中断。
  leg.sharingScreen = false;

  if (leg.audioEl)
  {
    leg.audioEl.srcObject = null;
    leg.audioEl.remove();
    leg.audioEl = null;
  }

  if (leg.backupStream)
  {
    CRTC.Utils.closeMediaStream(leg.backupStream);
    leg.backupStream = null;
  }

  confLegs.delete(leg.session.id);

  if (confLegs.size === 0 && typeof resetInk === 'function')
  {
    resetInk();
  }

  // B 是第一路主会话。B 离开时静默 C 没有独立通话意义；普通 C 则保留，
  // 会议退化为 A-C，之后允许新的第一路补入 B。
  if (silentCLeg && silentCLeg.silent && !silentCLeg.ended && !silentCLeg.session.isEnded())
  {
    try { silentCLeg.session.terminate(); }
    catch (error) {}
  }

  if (shareStream && !sharing &&
    !Array.from(confLegs.values()).some((item) => item.sharingScreen))
  {
    await unshareConf();
  }

  if (confMixer && leg.mixSource)
  {
    try { confMixer.removeSource(leg.mixSource); }
    catch (error) {}
  }

  if (leg.session.id === mixHostId)
  {
    // RTCSession 关闭时会销毁其会话级 composer；保留的普通 C
    // 使用预先 clone 的 A 原始轨继续 A-C 通话。
    await restoreAll(leg.session.id);
    releaseMixer();
  }
  else if (confMixer)
  {
    const hostLeg = getLegByRole('B');

    if (hostLeg && hostLeg.mixSource)
    {
      try { confMixer.removeSource(hostLeg.mixSource); }
      catch (error) {}
      hostLeg.mixSource = null;
    }

    await restoreAll();
    releaseMixer();
  }

  if (selectedId === leg.session.id)
  {
    const selected = getSelLeg();

    if (selected) selectLeg(selected);
    else
    {
      selectedId = null;
      rtcSession = null;
      statsCall = null;
      setStats('#statsPc', '等待会话');
      setStats('#statsOutLabel', 'A → 远端:');
      setStats('#statsInLabel', '远端 → A:');
      resetStats();
    }
  }

  if (confLegs.size === 0)
  {
    unshareConf().catch(() => {});
    localVid.srcObject = null;
    remoteVid.srcObject = null;
  }

  showLocal(getSelLeg());
  showMain();
  updateConfUi();
}

function endLeg(sessionId)
{
  const leg = confLegs.get(sessionId);

  if (leg && !leg.session.isEnded())
  {
    leg.session.terminate();
  }
}

/**
 * 挂断所有会议成员（包括已确认和未确认的）。
 */
function endConf()
{
  // 如果外呼仍停留在媒体准备阶段，先取消 pending；准备函数返回后会回滚输出。
  pendingCall = null;

  Array.from(confLegs.values()).forEach((leg) =>
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
// 三方模式下 A 调用每条 RTCSession 的 share() 辅流模式，向指定成员（B 或 C）
// 发送同一个屏幕流。transceiver、重协商、MID 通知和失败回滚均由 SDK 负责。
// Demo 只保留“选择目标、采集一次屏幕、调用 SDK、维护页面预览”四项教学逻辑，
// 不直接访问 session.connection，也不自行发送 screen-share INFO。
// =============================================================================

function getShareLegs()
{
  return getLiveLegs().filter((leg) => leg.shareTarget);
}

/**
 * 启动会议屏幕共享。
 *
 * 为什么仍由 Demo 采集一次屏幕：三方会议有两条独立 RTCSession，如果分别让每条
 * session.share() 调用 getDisplayMedia，浏览器会弹出两次系统共享选择器。这里获取
 * 一份 MediaStream，再通过 SDK 的 mediaStream 参数交给所有目标会话复用。
 *
 * 页面职责：校验目标、采集/预览、逐路调用 SDK、展示每路成功或失败状态。
 * SDK 职责：sender/transceiver、re-INVITE、MID INFO、track-ended 和失败回滚。
 * 单路失败不会撤销已经成功的其他会话；全部失败时才统一关闭本地预览和屏幕流。
 *
 * @returns {Promise<void>} 所有目标会话均完成尝试后结束
 * @throws {Error} 屏幕采集失败时由调用方展示错误；单路发送失败只更新状态提示
 */
async function shareConf()
{
  if (sharing)
  {
    setStatus('屏幕共享正在启动，请稍候');

    return;
  }

  if (getLiveLegs().length === 0)
  {
    setStatus('请先建立至少一条已确认的音视频会话');

    return;
  }

  const targets = getShareLegs();

  if (targets.length === 0)
  {
    setStatus('请至少选择一个屏幕共享目标');

    return;
  }

  sharing = true;
  updateConfUi();
  let done = 0;

  try
  {
    if (shareStream)
    {
      await unshareConf();
    }

    // 只采集一次，避免向 B/C 分别弹出系统选择器；当前三方示例只共享视频，
    // 不发送系统音频，防止与会议音频混合链路产生回声或重复声音。
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

    shareStream = screenStream;
    screenTrack.contentHint = 'detail';
    // 用户点击浏览器原生“停止共享”时走同一个停止入口，确保每条已发送会话
    // 都会调用 session.unShare()，而不是仅关闭本地预览。
    screenTrack.addEventListener('ended', () =>
    {
      unshareConf(true).catch((error) => console.warn('[conference] stop screen failed', error));
    });

    showShare(screenStream, 'local');
    document.querySelector('#screen').play()
      .catch(() => {});

    // 逐路等待便于在页面明确提示 B/C 中哪一路失败，也避免同一时间并发发起多次
    // re-INVITE 让调试日志难以定位。不同 RTCSession 之间的成功状态互不回滚。
    for (let index = 0; index < targets.length; index++)
    {
      const leg = targets[index];

      try
      {
        if (screenTrack.readyState === 'ended')
        {
          throw new Error('屏幕共享已由用户停止');
        }

        await leg.session.share('screen', {
          // auxiliary 表示新增独立 video m-line，不替换本会话的摄像头轨，也不使用 BFCP。
          mode                : 'auxiliary',
          // 多条会话复用同一个屏幕源，避免重复采集和重复系统授权。
          mediaStream         : screenStream,
          // 单条会话停止/挂断时不能 stop 共享流，流由 unshareConf 统一释放。
          stopStreamOnUnShare : false,
          // detail 优先保证桌面文字、表格和 UI 边缘清晰。
          contentHint         : 'detail'
        });

        // share() 等待 re-INVITE 期间用户可能已从系统栏停止共享。此时立即撤销
        // 刚成功的 sender，不能把 ended track 标记成有效共享。
        if (screenTrack.readyState === 'ended')
        {
          await leg.session.unShare().catch(() => {});
          throw new Error('屏幕共享已由用户停止');
        }

        leg.sharingScreen = true;
        done++;
        setStatus(`屏幕共享已发送给 ${leg.role}`);
      }
      catch (error)
      {
        console.warn(`[conference] share screen to ${leg.role} failed`, error);
        setStatus(`屏幕共享发送给 ${leg.role} 失败：${error.message || error}`);
        leg.sharingScreen = false;
      }
    }

    // 允许部分成功：例如 B 成功、C 协商失败时仍继续给 B 共享；只有全部失败才收尾。
    if (done === 0)
    {
      await unshareConf();
    }
  }
  catch (error)
  {
    await unshareConf().catch(() => {});
    throw error;
  }
  finally
  {
    sharing = false;
    updateConfUi();
  }
}

/**
 * 停止当前会议屏幕共享。
 *
 * 先让所有 active leg 调用 session.unShare()，等待 SDK 发 stop INFO 并停止 sender；
 * 然后再清空本地预览。只有页面主动停止时才 stop MediaStream，系统 ended 路径中的
 * track 已经停止，避免再次操作已结束的共享源。
 *
 * @param {boolean} [fromEnded=false] 是否由浏览器系统共享结束事件触发
 * @returns {Promise<void>} 所有会话的停止请求完成后结束
 */
async function unshareConf(fromEnded)
{
  const tasks = [];

  confLegs.forEach((leg) =>
  {
    if (!leg.sharingScreen)
    {
      return;
    }

    // 已结束会话会在 RTCSession._close() 中自行释放；仍存活的会话必须显式
    // unShare()，让对端及时收到 remoteUnShared，而不是等待整条通话结束。
    if (!leg.session.isEnded())
    {
      tasks.push(Promise.resolve()
        .then(() => leg.session.unShare())
        .catch((error) => console.warn(`[conference] stop screen to ${leg.role} failed`, error)));
    }
    leg.sharingScreen = false;
  });

  // 等待所有 sender 清空后再 stop 共享源，避免 replaceTrack(null) 与 track ended 竞争。
  await Promise.all(tasks);

  const stream = shareStream;

  shareStream = null;
  hideShare('local');

  if (stream && !fromEnded)
  {
    CRTC.Utils.closeMediaStream(stream);
  }

  // 系统共享选择器的“停止共享”通过 track ended 进入这里，
  // 统一刷新按钮，避免页面仍停留在“停止共享”状态。
  updateConfUi();
}

// =============================================================================
// 呼转与页面状态
// =============================================================================

/**
 * 三方模式下的 REFER 呼转。
 * 仅在只有一路已确认成员时可用；三方期间不支持 REFER。
 */
function referSelected()
{
  const leg = getSelLeg();

  if (!leg || confLegs.size !== 1 || !leg.confirmed)
  {
    setStatus('三方期间暂不支持 REFER');

    return;
  }

  const events = {
    progress         : (data) => console.log('progress', data),
    failed           : () => { if (leg.session.isOnHold().local) leg.session.unhold(); },
    accepted         : (data) => { console.log('accept', data); leg.session.terminate(); },
    trying           : (data) => console.log('trying', data),
    requestSucceeded : (data) => console.log('requestSucceeded', data),
    requestFailed    : () => { if (leg.session.isOnHold().local) leg.session.unhold(); }
  };

  leg.session.hold();
  leg.session.refer(`${document.querySelector('#refer').value}@${sipDomain}`, { eventHandlers: events });
}

function cancelRefer()
{
  const leg = getSelLeg();

  if (leg && confLegs.size === 1)
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
function updateConfUi()
{
  const participants = document.querySelector('#confUsers');
  const answerButton = document.querySelector('#confAnswer');
  const callButton = document.querySelector('#confCall');
  const hangupBtn = document.querySelector('#confHangup');
  const shareBtn = document.querySelector('#confShare');
  const boardBtn = document.querySelector('#openBoard');
  const stopBtn = document.querySelector('#confUnshare');
  const referButton = document.querySelector('#referBtn');
  const cancelBtn = document.querySelector('#cancelRefer');
  const threeActive = confLegs.size > 1 || Boolean(pendingCall);
  const confEnabled = typeof appMode !== 'undefined' && appMode === 'conference';
  const bLeg = getLegByRole('B');
  const canShare = getShareLegs().length > 0;
  const boardOpen = typeof isBoardOpen === 'function' && isBoardOpen();

  if (!participants)
  {
    return;
  }

  participants.textContent = '';
  confLegs.forEach((leg) =>
  {
    const item = document.createElement('div');
    const selectBtn = document.createElement('button');
    const targetBtn = document.createElement('button');
    const endBtn = document.createElement('button');

    item.className = 'btn-group conference-participant-item';
    item.setAttribute('role', 'group');
    item.setAttribute('aria-label', `${leg.role} 会议成员控制`);
    selectBtn.type = 'button';
    selectBtn.className = 'btn btn-sm conference-participant-select ' +
      `${selectedId === leg.session.id ? 'btn-primary' : 'btn-outline-primary'}`;
    selectBtn.textContent = `${leg.role}: ${leg.remoteNo || '-'} ` +
      `(${leg.confirmed ? '通话中' : '等待中'}${leg.silent ? '，静默' : ''})`;
    selectBtn.onclick = function()
    {
      selectLeg(leg);
      showMain();
      updateConfUi();
    };
    targetBtn.type = 'button';
    targetBtn.className = 'btn btn-sm conference-participant-share ' +
      `${leg.shareTarget ? 'btn-success' : 'btn-outline-success'}`;
    targetBtn.disabled = !leg.confirmed || Boolean(shareStream) || boardOpen;
    targetBtn.title = leg.shareTarget ? '取消该成员的屏幕/白板共享目标' :
      '选择该成员为屏幕/白板共享目标';
    targetBtn.setAttribute('aria-label', targetBtn.title);
    targetBtn.setAttribute('aria-pressed', String(Boolean(leg.shareTarget)));
    targetBtn.innerHTML = '<i class="bi-display-fill"></i>';
    targetBtn.onclick = function()
    {
      leg.shareTarget = !leg.shareTarget;
      updateConfUi();
    };
    endBtn.type = 'button';
    endBtn.className = 'btn btn-sm btn-outline-danger conference-participant-hangup';
    endBtn.title = `挂断 ${leg.role}: ${leg.remoteNo || '-'}`;
    endBtn.setAttribute('aria-label', endBtn.title);
    endBtn.innerHTML = '<i class="bi-telephone-x-fill"></i>';
    endBtn.onclick = function()
    {
      endLeg(leg.session.id);
    };
    item.appendChild(selectBtn);
    item.appendChild(targetBtn);
    item.appendChild(endBtn);
    participants.appendChild(item);
  });

  if (confLegs.size === 0)
  {
    const empty = document.createElement('span');

    empty.className = 'conference-empty';
    empty.textContent = '暂无会议成员';
    participants.appendChild(empty);
  }

  const pendingLeg = Array.from(confLegs.values()).some((leg) =>
    leg.originator === 'remote' && !leg.confirmed && !leg.answering && !leg.autoAnswer);

  if (answerButton)
  {
    answerButton.disabled = !confEnabled || !pendingLeg;
    answerButton.classList.toggle('hide', !pendingLeg);
  }
  if (callButton)
  {
    const nextRole = getNextRole();

    callButton.disabled = !confEnabled || Boolean(pendingCall) ||
      confLegs.size >= MAX_LEGS ||
      (nextRole === 'C' && (!bLeg || !bLeg.confirmed));
    callButton.textContent = '添加成员';
    callButton.classList.toggle('hide', Boolean(pendingCall) ||
      confLegs.size >= MAX_LEGS);
  }
  if (hangupBtn) hangupBtn.disabled = !confEnabled || confLegs.size === 0;
  if (shareBtn)
  {
    shareBtn.disabled = !confEnabled || sharing ||
      Boolean(shareStream) || boardOpen || !canShare;
    shareBtn.classList.toggle('hide', Boolean(shareStream));
  }
  if (boardBtn)
  {
    boardBtn.disabled = !confEnabled || sharing ||
      boardOpen || !canShare;
  }
  if (stopBtn)
  {
    stopBtn.disabled = !confEnabled || !shareStream;
    stopBtn.classList.toggle('hide', !shareStream);
  }
  if (confEnabled)
  {
    bindControls();

    if (referButton)
    {
      referButton.disabled = threeActive;
      referButton.onclick = referSelected;
    }
    if (cancelBtn)
    {
      cancelBtn.disabled = threeActive;
      cancelBtn.onclick = cancelRefer;
    }
  }
}

function answerConf()
{
  return answerLeg().catch((error) => setStatus(`会议接听失败：${error.message || error}`));
}
