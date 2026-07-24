/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable no-undef */

// =============================================================================
// 调试配置
// =============================================================================

// 开启 SDK 调试信息输出，便于开发排查问题
CRTC.debug.enable('CRTC:*');
// 关闭调试信息输出
// CRTC.debug.disable('CRTC:*');

// =============================================================================
// 全局常量
// =============================================================================

// 无摄像头时展示的占位 SVG 图标
const no_camera_svg = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg t="1756366745939" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="10589" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100"><path d="M865.08627 773.036973l-0.83027 0.996324a35.424865 35.424865 0 0 0-17.380324-4.649513 36.006054 36.006054 0 0 0-2.767568 71.956757c8.468757 7.140324 13.062919 14.612757 13.062919 22.417297 0 45.111351-152.050162 81.643243-339.635892 81.643243-130.739892 0-244.154811-17.767784-300.945297-43.782919l-50.425081 50.36973C241.442595 995.272649 370.632649 1024 517.535135 1024c232.475676 0 420.67027-71.956757 420.67027-160.518919 0-33.542919-27.011459-64.70573-73.119135-90.444108zM965.881081 49.816216a33.210811 33.210811 0 0 0-46.937946 0L58.118919 910.751135a33.210811 33.210811 0 0 0 46.827243 46.827243L965.881081 96.643459a33.210811 33.210811 0 0 0 0-46.827243zM251.350486 647.610811a363.935135 363.935135 0 0 1-73.229837-221.405406c0-195.611676 148.895135-354.248649 339.414486-354.248648a329.728 329.728 0 0 1 222.955243 86.126702l51.58746-51.532108A407.164541 407.164541 0 0 0 517.535135 0c-229.265297 0-415.135135 190.796108-415.135135 426.205405a431.076324 431.076324 0 0 0 96.754162 273.380325z m382.643892-382.588541a199.264865 199.264865 0 0 0-278.14054 278.140541l120.665946-120.942703a83.027027 83.027027 0 1 1 53.635459-53.635459zM716.8 426.205405a207.622919 207.622919 0 0 0-1.439135-23.635027l-221.405406 221.405406a207.622919 207.622919 0 0 0 23.579676 1.494486 199.264865 199.264865 0 0 0 199.264865-199.264865z m-398.861838 373.732325A404.618378 404.618378 0 0 0 517.535135 852.410811c229.265297 0 415.135135-190.796108 415.135135-426.205406a433.34573 433.34573 0 0 0-45.996973-194.947459L830.380973 287.827027a371.407568 371.407568 0 0 1 26.568649 138.378378c0 195.611676-148.895135 354.248649-339.414487 354.248649a329.783351 329.783351 0 0 1-146.127567-33.819676z" fill="#8a8a8a" p-id="10590"></path></svg>';

// =============================================================================
// 通话状态变量
// =============================================================================

// 当前向页面统计浮层提供数据的 RTCSession。
let statsSession;
// 远端是否存在回铃音：false 表示可播放本地振铃音
let earlyMedia = false;
// 当前活跃通话的 RTCSession 实例
let rtcSession;
// 用户选择模式前不创建 UA，也不会连接或注册。
let appMode = null;
let ua = null;
let appRegistrationState = 'idle';

/**
 * 读取当前通话最近一份统计，不触发新的采样。
 * 可在浏览器控制台执行 getCurrentCallStats() 对照 docs/user-guide/05-call-statistics.md。
 *
 * @returns {{networkQuality: object|null, legacyReport: object|null, detailedReport: object|null}|null}
 */
function getCurrentCallStats()
{
  const monitor = rtcSession && rtcSession.statsMonitor;

  if (!monitor)
  {
    return null;
  }

  return {
    networkQuality : monitor.getLatestNetworkQuality(),
    legacyReport   : monitor.getLatestLegacyReport(),
    detailedReport : monitor.getLatestReport()
  };
}

window.getCurrentCallStats = getCurrentCallStats;
// iOS 兼容：定时发送 OPTIONS 保活的定时器句柄
let optionsTimer;
// 呼叫转移场景中被转入的新会话实例
let tmpSession;
// Safari 浏览器屏幕分享降级标志：需用户手势触发
let safari_r = false;
// 外呼时传入的选项对象缓存
let options;
// 被 refer 转移前的旧会话实例
let oldSession;
// B2B 呼转时从服务端获取的被叫号码
let callee;
// 远端来电/呼叫的号码
let remoteNo;

// =============================================================================
// 设备与 UI 状态变量
// =============================================================================

// 当前选中的摄像头 deviceId
let selectCamera;
// 当前选中的麦克风 deviceId
let selectMic;

// 移动端摄像头方向切换标记：true 表示下次切换到 environment（后置），false 表示下次切换到 user（前置）
let camFlag = true;

// 音视频升级模式选择：true = useUpdate，false = useReInvite
let useUpdate = true;
// 系统是否有可用摄像头
let haveACamera = false;
// 通话是否已确认（ACK 完成）
let confirmed = false;

// =============================================================================
// 断网提示相关变量
// =============================================================================

// 是否主动停止 UA（页面卸载时设为 true，避免误判断网）
let handleStop = false;
// 断网原因标记：'BROWSER'（浏览器离线）、'UA'（信令断开）
let disconnectedBy = null;
// eslint-disable-next-line no-unused-vars
// 断网提示 UI 是否已显示
let isShowUI = false;

// =============================================================================
// 通话模式与媒体流变量
// =============================================================================

// 混音/混流实例（预留）
let mix;
// 是否纯视频模式（不采集麦克风）
let videoOnly = false;

// 当前通话模式：'audio'（音频）或 'video'（视频）
let curMode;

// 兼容 MCU 等候室：克隆的本地媒体流引用
let cloneStream = null;
// 是否正在处理 refer 呼叫转移
let isRefer = false;

// =============================================================================
// 录音与通知变量
// =============================================================================

// 通话录音实例（MultiStreamRecorder）
let recorder;
// 浏览器系统通知实例，用于来电弹窗
let incomingCallNotification = null;
// 浏览器是否不支持系统通知（只记录一次，避免重复日志）
let notificationUnsupportedLogged = false;

// 通话附加扩展特性列表（如 BP720P、BFCP 等）
const extraFeatures = [];

// let payload;

// =============================================================================
// DOM 元素引用
// =============================================================================

// 本端视频播放元素
const localVideo = document.querySelector('#localVideo');
// 远端视频播放元素
const remoteVideo = document.querySelector('#remoteVideo');
// 远端音频播放元素（用于回铃音/早期媒体播放）
const remoteAudio = document.querySelector('#remoteAudio');

// 自定义媒体流容器（屏幕分享等场景复用）
let cusMediaStream = new MediaStream();
// 无摄像头/黑屏视频轨道生成器实例
let blackVideo = null;

// =============================================================================
// URL 参数解析
// =============================================================================

// 随路数据（Base64 编码），默认 'dGVzdCB4LWRhdGE=' → 'test x-data'
let xdata = handleGetQuery('xdata') || 'dGVzdCB4LWRhdGE=';
// 最大视频码率（kbps），用于 RTCRtpSender 配置
const mbit = handleGetQuery('mbit') || 400;
// 通话录音时长（秒），0 或不传则不录音
const rec = handleGetQuery('rec') || false;
// 环境标识，用于切换不同的信令服务器/密码等配置
const env = handleGetQuery('env');
// 是否移除 REMB/Transport-CC 扩展（VoLTE 互通兼容）
const noremb = handleGetQuery('noremb') || false;
// 根据 env 参数选择对应的环境配置，默认使用 env_default
const { signalingUrl, sipDomain, secretKey, iceServers, iceTransportPolicy, password } = env ? envs[`env_${env}`] : envs['env_default'];
// 附加扩展特性的 URL 参数，逗号分隔
const exts = handleGetQuery('ext') ? handleGetQuery('ext').split(',') : null;
// 扩展特性转为大写集合，便于快速查重
const extSet = new Set((exts || []).map((ext) => String(ext).trim()
  .toUpperCase()).filter(Boolean));

// 将 URL 传入的扩展特性逐个注册到 extraFeatures 列表
exts && exts.forEach((ext) => extraFeatures.push(ext));

// =============================================================================
// UA 与信令配置
// =============================================================================

// SIP 注册用户名（来自 URL 参数 caller）
const account = handleGetQuery('caller');

/**
 * 构建 UA 配置对象。
 * 在用户选择点对点或三方模式后才调用，替代之前页面加载时即创建的 const configuration。
 *
 * @param {object} transport - WebSocket 信令传输实例
 * @returns {object} 传给 new CRTC.UA() 的配置
 */
function buildUaConfiguration(transport)
{
  return {
    sockets                          : transport,
    uri                              : `sip:${account}@${sipDomain}`,
    display_name                     : account,
    password                         : `${password ? password : 'yl_19'}${account}`,
    connection_recovery_max_interval : 3,
    connection_recovery_min_interval : 2,
    register_expires                 : 20,
    // 用户选择页面模式后，UA 连接成功即自动发送 REGISTER。
    register                         : true,
    session_timers                   : false,
    secret_key                       : secretKey
  };
}

// =============================================================================
// 媒体约束
// =============================================================================

// 默认视频采集参数：前置摄像头、640x480、15fps
let videoConstraints = {
  facingMode : 'user',
  width      : 640,
  height     : 480,
  frameRate  : 15
};

// 如果请求了 BP720P 扩展，则升级到 720p 分辨率
if (extSet.has('BP720P'))
{
  videoConstraints = {
    facingMode : 'user',
    width      : 1280,
    height     : 720,
    frameRate  : 15
  };
}

// =============================================================================
// RTCPeerConnection 配置
// =============================================================================

const pcConfig = {};

// ICE 服务器列表（STUN/TURN）
iceServers && (pcConfig['iceServers'] = iceServers);
// ICE 传输策略（如 'relay' 强制走 TURN）
iceTransportPolicy && (pcConfig['iceTransportPolicy'] = iceTransportPolicy);
// ICE 候选池大小，预收集候选加速连接
pcConfig['iceCandidatePoolSize'] = 4;

// BUNDLE 策略设为最大兼容模式，所有媒体流复用同一端口
pcConfig['bundlePolicy'] = 'max-compat';

// ***** UA 事件回调 *****
// 点对点和三方模式共用同一组 UA 层事件（连接、注册、断网等）。
// newRTCSession 事件在模式初始化时按模式分别绑定不同的处理函数。

/**
 * 绑定 UA 级别的事件回调（连接、注册、断网、浏览器网络状态）。
 * 点对点和三方模式共用，在 initializeDemoMode 中调用。
 */
function bindCommonUaEvents()
{
  /**
   * browser:navigator:offline — 浏览器离线
   *
   * @fires 浏览器检测到网络断开时触发
   *
   * 处理逻辑：记录断开来源为 BROWSER，显示断网提示 UI。
   * 只有首次断开时才标记来源，避免重复设置。
   */
  ua.on('browser:navigator:offline', function()
  {
    setStatus('浏览器已离线');

    // 仅首次断开时设置断开来源，后续重复事件忽略
    if (!disconnectedBy)
    {
      disconnectedBy = 'BROWSER';

      // 显示断网提示 UI
      isShowUI = true;
    }
  });

  /**
   * browser:navigator:online — 浏览器恢复在线
   *
   * @fires 浏览器检测到网络恢复时触发
   *
   * 处理逻辑：仅当之前是由浏览器触发的断网时才清除状态。
   * UA 层断网与浏览器断网分开管理，避免互相干扰。
   */
  ua.on('browser:navigator:online', function()
  {
    setStatus('浏览器在线');
    // 只有浏览器离线导致的断网才在此恢复
    if (disconnectedBy === 'BROWSER')
    {
      disconnectedBy = null;

      // 关闭断网提示 UI
      isShowUI = false;
    }
  });

  /**
   * connected — 信令 WebSocket 连接成功
   *
   * @fires 与信令服务器 WebSocket 连接建立时触发
   *
   * 处理逻辑：清除所有断网状态，关闭断网提示。
   * 此事件表示传输层已就绪，但尚未完成 SIP 注册。
   */
  ua.on('connected', function()
  {
    // 信令连接成功后清除所有断网标记
    disconnectedBy = null;

    // 关闭断网提示 UI
    isShowUI = false;

    // 连接成功后进入注册中状态，更新页面标签
    appRegistrationState = 'registering';
    updateAppModeUi();
    setStatus('信令连接成功');
  });

  /**
   * disconnected — 信令 WebSocket 断开
   *
   * @fires 信令 WebSocket 断开时触发
   *
   * @type {object}
   * @property {number} code - 断开状态码
   * @property {string} reason - 断开原因描述
   * @property {boolean} error - 是否因错误断开
   *
   * 处理逻辑：
   * - 主动停止（handleStop）时不显示断网提示
   * - 非主动断开时标记为 UA 断网并显示提示
   */
  ua.on('disconnected', function(data)
  {
    setStatus(`信令连接断开: ${data.code} ${data.reason}`);
    // 信令断开后标记未注册，更新页面标签为"未注册"
    appRegistrationState = 'unregistered';
    updateAppModeUi();

    // 页面卸载/主动停止 UA 导致的断开，不触发断网提示
    if (handleStop)
    {
      return;
    }

    // 首次被动断开时显示断网提示
    if (!disconnectedBy)
    {
      isShowUI = true;
    }
    disconnectedBy = 'UA';
  });

  /**
   * failed — UA 错误
   *
   * @fires UA 内部发生不可恢复的错误时触发
   *
   * @type {object}
   * @property {string} originator - 错误来源模块
   * @property {string} message - 错误描述
   * @property {string} cause - 错误根本原因
   *
   * 处理逻辑：重置纯视频模式标志，输出详细错误信息。
   */
  ua.on('failed', function(data)
  {
    // 发生错误时重置纯视频模式
    videoOnly = false;
    setStatus(`${data.originator} ${data.message} ${data.cause}`);
  });

  /**
   * registered — SIP 注册成功
   *
   * @fires SIP REGISTER 请求收到 200 OK 响应时触发
   *
   * @type {object}
   * @property {object} response - SIP 注册响应实例
   *
   * 处理逻辑：输出注册成功信息。后续可在此自动发起呼叫（已注释）。
   */
  ua.on('registered', function(data)
  {
    setStatus(`注册成功：${data.response.from.uri.toString()}`);
    // 注册成功后更新状态标签为"已注册"（绿色）
    appRegistrationState = 'registered';
    updateAppModeUi();
    // 注册成功后自动发起呼叫（测试用，已注释）
    // setTimeout(() =>
    // {
    //   call('callnull');
    // }, 1000);
  });

  /**
   * registrationFailed — SIP 注册失败
   *
   * @fires SIP REGISTER 请求失败时触发
   *
   * @type {object}
   * @property {object} response - 失败的响应实例
   * @property {string} cause - 注册失败原因
   *
   * 处理逻辑：输出失败原因供排查。
   */
  ua.on('registrationFailed', function(data)
  {
    setStatus(`注册失败${data.cause}`);
    // 注册失败后更新状态标签为"未注册"
    appRegistrationState = 'unregistered';
    updateAppModeUi();
  });

  /**
   * unregistered — SIP 主动注销或注册失效
   */
  ua.on('unregistered', function(data)
  {
    setStatus(`已注销${data && data.cause ? `：${data.cause}` : ''}`);
    // 注销后更新状态标签为"未注册"
    appRegistrationState = 'unregistered';
    updateAppModeUi();
  });
}

/**
 * newRTCSession — 新建通话会话
 *
 * @fires 呼入或呼出通话时触发（SIP INVITE 发送或接收）
 *
 * @type {object}
 * @property {string} originator - 'local'（本端发起）或 'remote'（远端呼入）
 * @property {object} session - 通话的 RTCSession 实例
 * @property {object} request - 请求对象，远端呼入时可从此获取随路数据和呼叫模式
 *
 * 处理逻辑：
 * 1. 打印会话信息和远端操作系统类型
 * 2. 会话交接：已有会话时按冲突策略处理（终止新会话或排队为 tmpSession）
 * 3. 远端呼入时提取主叫号码并显示通知
 */
function handleSessionMediaEffectsIssue(d)
{
  const moduleName = d && d.module ? d.module : 'MediaEffects';
  const message = d && d.message ? d.message : 'Unknown media effects failure';

  console.warn(
    `[base-js][mediaEffectsIssue] module=${moduleName} message=${message}`,
    d
  );
  setStatus(`媒体效果异常[${moduleName}]：${message}`);
}

/**
 * 点对点模式下的 newRTCSession 事件处理入口。
 *
 * 三方模式下此函数不会被调用（由 handleConferenceNewRTCSession 接管）。
 * 除常规的呼叫/接听逻辑外，还包括：
 * - A 端定向屏幕共享的远端视频轨到达处理（通过 SIP INFO MID 匹配）
 * - 点对点模式下的 stats 面板标签设置
 */
function handlePointToPointNewRTCSession(e)
{
  // 输出完整会话对象用于调试
  console.warn('nsession: ', e);
  // 检测远端设备的操作系统类型（用于后续兼容处理）
  console.warn('dOS: ', detectRemoteOS(e.request));

  // 重置通话确认标志
  confirmed = false;

  // ---- 会话交接/冲突处理 ----
  // 策略：最多保留两个会话（rtcSession + tmpSession），第三个直接拒绝
  if (tmpSession)
  {
    // 已有两个会话，拒绝第三个（486 Busy Here）
    e.session.terminate({ status_code: 486 });
  }
  else if (!rtcSession)
  {
    // 当前无活跃会话，直接作为主会话
    rtcSession = e.session;
  }
  else
  {
    // 已有主会话，新会话排队为临时会话（呼叫转接场景）
    tmpSession = e.session;
  }

  // A 的定向屏幕共享通过第二条 video m-line 发送，并用 SIP INFO
  // 携带 MID 标识共享轨。INFO 和 track 的到达顺序不固定，因此分别缓存。
  // ---
  // pointToPointRemoteVideoTracks: Map<mid, MediaStreamTrack> —— 缓存已到达的远端视频轨
  // pointToPointRemoteScreenMid:  SIP INFO 告知的屏幕共享轨 MID（可能早于或晚于 track 到达）
  const pointToPointRemoteVideoTracks = new Map();
  let pointToPointRemoteScreenMid = null;

  // 清除远端屏幕共享：清空 #remoteVideo2 并关闭共享浮层
  const clearPointToPointRemoteScreen = function()
  {
    const remoteSharedVideo = document.querySelector('#remoteVideo2');

    if (remoteSharedVideo)
    {
      remoteSharedVideo.srcObject = null;
      remoteSharedVideo.className = 'screen-share-dialog-video hide';
    }
    if (typeof closeScreenShareDialog === 'function') closeScreenShareDialog('remote');
  };

  // 根据 MID 渲染远端屏幕共享画面。
  // 优先从缓存取 track；缓存未命中时遍历 transceiver 查找对应 track。
  // track 未到达或未就绪时静默返回，等待后续 track/unmute 事件再次触发。
  const renderPointToPointRemoteScreen = function(mid)
  {
    if (mid === null || mid === undefined || !e.session.connection)
    {
      return;
    }

    const normalizedMid = String(mid);
    let track = pointToPointRemoteVideoTracks.get(normalizedMid);

    if (!track)
    {
      const transceiver = e.session.connection.getTransceivers().find((item) =>
        String(item.mid) === normalizedMid);

      track = transceiver && transceiver.receiver && transceiver.receiver.track;
    }

    if (!track || track.readyState !== 'live')
    {
      return;
    }

    pointToPointRemoteVideoTracks.set(normalizedMid, track);
    const remoteSharedVideo = document.querySelector('#remoteVideo2');

    if (!remoteSharedVideo)
    {
      return;
    }

    const sharedStream = new MediaStream([ track ]);

    bindMediaStreamIfChanged(remoteSharedVideo, sharedStream);
    remoteSharedVideo.className = 'screen-share-dialog-video';
    remoteSharedVideo.play().catch(() => {});
    if (typeof openScreenShareDialog === 'function') openScreenShareDialog('remote');
  };

  // 监听 PeerConnection 的 track 事件，收集所有到达的远端视频轨。
  // 视频轨到达时先按 MID 缓存；若此时 SIP INFO 已告知该 MID 是共享轨则立即渲染。
  // 轨道 unmute 时再次尝试渲染（覆盖 track 先于 INFO 到达的时序），
  // 轨道 ended 时从缓存移除并清理 UI。
  const handlePointToPointRemoteVideoTrack = function(event)
  {
    const track = event.track;

    if (!track || track.kind !== 'video' || !e.session.connection)
    {
      return;
    }

    const transceiver = e.session.connection.getTransceivers().find((item) =>
      item.receiver && item.receiver.track === track);
    const mid = transceiver && transceiver.mid;

    if (mid === null || mid === undefined)
    {
      return;
    }

    const normalizedMid = String(mid);

    pointToPointRemoteVideoTracks.set(normalizedMid, track);

    const refresh = function()
    {
      if (pointToPointRemoteScreenMid === normalizedMid)
      {
        renderPointToPointRemoteScreen(normalizedMid);
      }
    };

    track.addEventListener('unmute', refresh);
    track.addEventListener('ended', function()
    {
      pointToPointRemoteVideoTracks.delete(normalizedMid);
      if (pointToPointRemoteScreenMid === normalizedMid)
      {
        pointToPointRemoteScreenMid = null;
        clearPointToPointRemoteScreen();
      }
    }, { once: true });
    refresh();
  };

  // ---- 远端呼入处理 ----
  if (e.originator === 'remote')
  {
    // 从请求中提取主叫号码
    remoteNo = e.request.from.uri.user;
    document.querySelector('#callee').value = remoteNo;

    // 根据请求模式显示对应的呼叫通知
    setStatus(`收到${e.request.mode === 'video' ? '视频' : '音频'}呼叫`);
    showIncomingCallNotification(e.request.mode, remoteNo);
    // 可通过 request.getHeader(param) 获取随路数据
    // setStatus(`收到 x-data: ${e.request.getHeader('x-data')}`);
  }

  // =========================================================================
  // RTCSession 统计事件接入示例
  // =========================================================================

  // 统计浮层只负责展示；节点不存在时不影响通话流程。
  const setSessionStatsPanelText = function(selector, value)
  {
    const element = document.querySelector(selector);

    if (element)
    {
      element.textContent = value;
    }
  };

  // null/undefined 表示浏览器未提供该指标，不应显示为 0。
  const formatSessionStatsNumber = function(value, unit)
  {
    return value === null || value === undefined ? '-' : `${value}${unit || ''}`;
  };

  // stats:detailed-report 中的码率统一为 bps，页面换算为 kbps。
  const formatSessionStatsBitrate = function(value)
  {
    return value === null || value === undefined ? '-' : `${(Math.round(value / 100) / 10).toFixed(1)}kbps`;
  };

  const getSessionStatsStreamName = function(stream)
  {
    return stream.kind === 'audio' || stream.type === 'audio' ? '音频' : '视频';
  };

  // 质量问题 code 保持在事件中不变，页面只转换成更短、更直观的中文名称。
  const sessionStatsIssueNames = {
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

  const sessionStatsQualityNames = [ '暂无数据', '极佳', '较好', '一般', '差', '极差', '严重异常' ];

  const formatSessionNetworkQuality = function(value)
  {
    if (value === null || value === undefined)
    {
      return '-';
    }

    return `${sessionStatsQualityNames[value] || '未知'}(${value})`;
  };

  const appendSessionStatsRow = function(table, values)
  {
    values.forEach((value) =>
    {
      const cell = document.createElement('span');

      cell.className = 'rtc-stats-cell';
      cell.textContent = value;
      table.appendChild(cell);
    });
  };

  const renderSessionStatsStreams = function(selector, streams, outbound)
  {
    const element = document.querySelector(selector);

    if (!element)
    {
      return;
    }

    // 上下行都按音频、视频、MID 排序，统计行与 SDP 中的媒体顺序保持一致。
    const sortedStreams = streams.slice().sort((left, right) =>
    {
      const leftKindOrder = getSessionStatsStreamName(left) === '音频' ? 0 : 1;
      const rightKindOrder = getSessionStatsStreamName(right) === '音频' ? 0 : 1;

      if (leftKindOrder !== rightKindOrder)
      {
        return leftKindOrder - rightKindOrder;
      }

      return String(left.mid === null ? '' : left.mid).localeCompare(
        String(right.mid === null ? '' : right.mid),
        undefined,
        { numeric: true }
      );
    });

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
      const streamName = getSessionStatsStreamName(stream);
      const codecName = stream.codec && stream.codec.name ? stream.codec.name : '-';
      const feedback = stream.remoteInbound;
      const bitrate = outbound ? stream.actualBitrateBps : stream.receiveBitrateBps;
      const jitter = outbound ? feedback && feedback.jitterMs : stream.jitterMs;
      const loss = outbound ? feedback && feedback.intervalLossPercent : stream.intervalLossPercent;

      appendSessionStatsRow(table, [
        `${streamName}[${stream.mid === null ? '-' : stream.mid}]`,
        `编码:${codecName}`,
        `码率:${formatSessionStatsBitrate(bitrate)}`,
        `抖动:${formatSessionStatsNumber(jitter, 'ms')}`,
        `丢包:${formatSessionStatsNumber(loss, '%')}`
      ]);

      if (streamName === '视频')
      {
        appendSessionStatsRow(table, [
          '',
          `画面:${stream.frameWidth === null || stream.frameWidth === undefined ||
            stream.frameHeight === null || stream.frameHeight === undefined
            ? '-' : `${stream.frameWidth}x${stream.frameHeight}`}`,
          `FPS:${formatSessionStatsNumber(stream.framesPerSecond)}`,
          outbound
            ? `编码:${formatSessionStatsNumber(stream.averageEncodeTimeMs, 'ms')}`
            : `解码:${formatSessionStatsNumber(stream.averageDecodeTimeMs, 'ms')}`,
          outbound ? `限制:${stream.qualityLimitationReason || '-'}` : ''
        ]);
      }
    });

    element.appendChild(table);
  };

  const renderSessionConnectionStats = function(connection)
  {
    const element = document.querySelector('#rtcStatsConnection');

    if (!element)
    {
      return;
    }

    const table = document.createElement('div');

    table.className = 'rtc-stats-connection-table';
    appendSessionStatsRow(table, [
      `状态:${connection.connectionState || '-'}`,
      `ICE:${connection.iceConnectionState || '-'}`,
      `DTLS:${connection.dtlsState || '-'}`
    ]);
    appendSessionStatsRow(table, [
      `↑:${formatSessionStatsBitrate(connection.sendBitrateBps)}/可用${formatSessionStatsBitrate(connection.availableOutgoingBitrateBps)}`,
      `↓:${formatSessionStatsBitrate(connection.receiveBitrateBps)}/可用${formatSessionStatsBitrate(connection.availableIncomingBitrateBps)}`,
      ''
    ]);

    element.textContent = '';
    element.appendChild(table);
  };

  // 会话切换或结束时清空旧数据，避免把上一通通话误认为当前状态。
  const resetSessionStatsPanel = function()
  {
    const waitingText = '--';

    setSessionStatsPanelText('#rtcStatsConnection', waitingText);
    setSessionStatsPanelText('#rtcStatsQuality', waitingText);
    setSessionStatsPanelText('#rtcStatsIssues', '无');
    setSessionStatsPanelText('#rtcStatsOutbound', waitingText);
    setSessionStatsPanelText('#rtcStatsInbound', waitingText);
  };

  statsSession = e.session;
  // 点对点模式下的统计面板标签：标明 PeerConnection 对象和链路方向。
  // 三方模式下由 renderConferenceStatsPeerLabels() 覆盖为 A-B/A-C 等。
  setSessionStatsPanelText('#rtcStatsPeerConnection', '点对点 PeerConnection');
  setSessionStatsPanelText('#rtcStatsOutboundLabel', '本端 → 远端:');
  setSessionStatsPanelText('#rtcStatsInboundLabel', '远端 → 本端:');
  resetSessionStatsPanel();

  // 推荐从 RTCSession 消费统计事件，不在 Demo 中直接管理 RTCStatsMonitor。
  e.session.on('stats:detailed-report', function(report)
  {
    if (statsSession !== e.session)
    {
      return;
    }

    // 事件只提供浮层使用的摘要；完整报告由 SDK logger 输出，也可通过
    // e.session.statsMonitor.getLatestReport() 获取。
    const quality = report.quality;
    const issueText = quality.issues.map((issue) =>
    {
      return `${sessionStatsIssueNames[issue.code] || issue.code}(L${issue.severity})`;
    }).join(' | ');

    renderSessionStatsStreams('#rtcStatsOutbound', report.outbound, true);
    renderSessionStatsStreams('#rtcStatsInbound', report.inbound, false);
    renderSessionConnectionStats(report.connection);
    setSessionStatsPanelText(
      '#rtcStatsQuality',
      `RTT:${formatSessionStatsNumber(quality.RTT, 'ms')} | ↑:${formatSessionNetworkQuality(quality.uplinkNetworkQuality)} | ↓:${formatSessionNetworkQuality(quality.downlinkNetworkQuality)}`
    );
    setSessionStatsPanelText('#rtcStatsIssues', issueText || '无');
  });

  // 统计失败不会中断通话，业务只需按需记录。
  e.session.on('stats:stats-error', function(error)
  {
    if (statsSession === e.session)
    {
      console.warn('[RTCStatsMonitor] stats-error:', error);
    }
  });

  // 以下可以用于兼容原来 stats = new CRTC.getStats(e.session.connection) 的对应事件
  e.session.on('stats:network-quality', function(error) { });
  e.session.on('stats:report', function(error) { });

  // ***** Session 事件回调 *****
  // 以下为通话级事件监听，在每个 newRTCSession 中注册

  /**
   * remoteSupportsVideo — 远端支持视频
   *
   * @fires 收到远端 SDP 中包含视频媒体行时触发
   * 用于判断对端是否具备视频能力。
   */
  e.session.on('remoteSupportsVideo', function(d)
  {
    setStatus('对端支持视频模式');
  });

  /**
   * refer — 呼叫转移
   *
   * @fires 收到远端 REFER 请求时触发
   *
   * 处理逻辑：
   * - 修正 refer_to 的 host 为当前域，确保转接目标可达
   * - 保存旧会话引用，接受转接请求
   * - 标记 isRefer 兼容华为 MCU 等候室场景
   */
  e.session.on('refer', function(d)
  {
    setStatus('refer');
    // 统一转接目标域为当前 SIP 域
    d.request.refer_to.uri.host = sipDomain;
    // 保存当前会话为旧会话
    oldSession = e.session;
    // 接受转接请求
    d.accept(null, options);
    // 标记正在处理 refer，兼容华为 MCU
    isRefer = true;
    // 备选方案：接受转接后主动挂断旧会话并发起新呼叫
    // d.accept(() =>
    // {
    //   e.session.terminate();
    //   call('video', null, cloneStream);
    // }, options);
  });

  /**
   * sdp — SDP 协商
   *
   * @fires 每次 SDP 创建或接收时触发
   *
   * 处理逻辑：
   * - 呼叫 VoLTE 手机号时需要移除 REMB 和 Transport-CC 扩展，避免互通问题
   */
  e.session.on('sdp', function(d)
  {
    // 移除 Google REMB（Receiver Estimated Maximum Bitrate）扩展
    noremb && (d.sdp = d.sdp.replace(/a=rtcp-fb:\d* goog-remb\r\n/g, ''));
    // 移除 Transport-CC（Transport-wide Congestion Control）扩展
    noremb && (d.sdp = d.sdp.replace(/a=rtcp-fb:\d* transport-cc\r\n/g, ''));
  });

  /**
   * trying — SIP 100 Trying
   *
   * @fires 收到或发出 SIP 100 Trying 响应时触发
   * 表示下一跳已收到 INVITE，正在处理中。
   */
  e.session.on('trying', function()
  {
    setStatus('Trying');
  });

  /**
   * progress — 呼叫进展（振铃）
   *
   * @fires 收到或发出 SIP 1xx（>100）临时响应时触发
   * 可在此设置回铃音或本地振铃提示。
   *
   * @type {object}
   * @property {string} originator - 'local'（本端为被叫，正在振铃）或 'remote'（本端为主叫，远端已振铃）
   * @property {string} mode - 'audio' 或 'video'
   * @property {object} response - 触发此事件的 SIP 响应对象（仅 remote 方向时可用于检测远端 OS）
   *
   * 处理逻辑：
   * - local：本端已收到 INVITE，正在振铃
   * - remote：远端已振铃；若没有远端回铃音（earlyMedia），可播放本地铃声
   */
  e.session.on('progress', function(d)
  {
    if (d.originator === 'local')
    {
      // 被叫侧：本端正振铃等待用户接听
      setStatus('收到呼叫，振铃中');
    }
    else
    {
      // 主叫侧：远端已振铃
      // 若不存在远端回铃音，此处可播放本地铃声
      if (!earlyMedia)
      {
        // 可在此播放本地回铃音（local ringback tone）
      }

      setStatus('对方已振铃，请等待接听');
    }
  });

  /**
   * hold — 通话保持
   *
   * @fires 本端或远端将通话置于保持状态时触发
   *
   * @type {object}
   * @property {string} originator - 'remote'（远端保持）或 'local'（本端保持）
   *
   * 处理逻辑：暂停后清空媒体渲染，切换到保持状态 UI。
   */
  e.session.on('hold', function(d)
  {
    setStatus(`${d.originator} hold`);
    // 清空所有音视频渲染，切换 UI 为暂停状态
    stopStreams();
  });

  /**
   * unhold — 取消保持
   *
   * @fires 本端或远端恢复通话时触发
   *
   * @type {object}
   * @property {string} originator - 'remote' 或 'local'
   *
   * 处理逻辑：恢复后重新从 PeerConnection 获取本地和远端媒体流并渲染。
   * 部分场景下取消保持后可能无法自动恢复媒体，因此这里主动调用 getStreams。
   */
  e.session.on('unhold', function(d)
  {
    setStatus(`${d.originator} unhold`);

    // 重新获取并渲染媒体流
    getStreams(e.session.connection);
  });

  /**
   * mode — 通话模式切换
   *
   * @fires 通话模式变化时触发（音频→视频、视频→音频）
   *
   * @type {object}
   * @property {string} mode - 'audio' 或 'video'
   *
   * 处理逻辑：
   * - 更新当前模式和统计实例
   * - 切换为视频模式时设置最大码率 400kbps
   * - 重新获取媒体流渲染
   */
  e.session.on('mode', function(d)
  {
    setStatus(`mode: ${d.mode}`);

    // 更新当前通话模式
    curMode = d.mode;

    // 切换到视频模式时，设置视频发送最大码率
    if (d.mode == 'video')
    {
      e.session.connection.getSenders().forEach((sender) =>
      {
        if (sender.track && sender.track.kind === 'video')
        {
          const parameters = sender.getParameters();

          // 设置视频编码最大码率为 400kbps
          parameters.encodings[0].maxBitrate = 400 * 1000;

          sender.setParameters(parameters);
        }
      });
    }

    // 模式切换后重新获取媒体流
    getStreams(e.session.connection);
  });

  /**
   * cameraChanged — 摄像头切换完成
   *
   * @fires 调用 switchDevice('camera', ...) 成功后触发
   *
   * @type {object}
   * @property {MediaStream} videoStream - 切换后的新视频流
   *
   * 处理逻辑：
   * - 克隆本地音频轨道 + 新视频轨道构造新的 MediaStream
   * - 兼容 MCU 等候室场景（保留 cloneStream 引用）
   * - 延迟 100ms 播放以兼容不同浏览器的安全策略
   */
  e.session.on('cameraChanged', function(d)
  {
    // 获取当前本地音频和视频流
    const localStream = CRTC.Utils.getStreams(e.session.connection, 'local');
    const tmpTracks = [];

    // 有音频轨道时克隆一份
    if (localStream.audioStream.getAudioTracks().length > 0)
    {
      tmpTracks.push(localStream.audioStream.getAudioTracks()[0].clone());
    }

    // 有新视频轨道时克隆一份
    if (d.videoStream.getVideoTracks().length > 0)
    {
      tmpTracks.push(d.videoStream.getVideoTracks()[0].clone());
    }

    // 停止旧的克隆流（用 SDK 提供的 closeMediaStream 统一释放，
    // 避免手动遍历 track.stop() 遗漏音频轨或已结束的轨）
    CRTC.Utils.closeMediaStream(cloneStream);

    // 创建新的克隆流用于本地预览
    cloneStream = new MediaStream(tmpTracks);
    localVideo.srcObject = cloneStream;

    // 延迟播放兼容不同浏览器的自动播放策略
    setTimeout(() =>
    {
      localVideo.play();
    }, 100);
  });

  /**
   * remoteShared — 远端开始共享
   *
   * @fires 远端发起屏幕/元素共享时触发
   *
   * 处理逻辑：将共享的视频流渲染到辅助视频区域。
   */
  e.session.on('remoteShared', function(d)
  {
    document.querySelector('#remoteVideo2').srcObject = d.sharedStream.videoStream;
    // 替换为屏幕共享浮层样式，并自动弹出浮层
    document.querySelector('#remoteVideo2').className = 'screen-share-dialog-video';
    if (typeof openScreenShareDialog === 'function') openScreenShareDialog('remote');
  });

  /**
   * remoteUnShared — 远端停止共享
   *
   * @fires 远端停止共享时触发
   *
   * 处理逻辑：清空辅助视频区域并隐藏浮层。
   */
  e.session.on('remoteUnShared', function()
  {
    document.querySelector('#remoteVideo2').srcObject = null;
    document.querySelector('#remoteVideo2').className = 'screen-share-dialog-video hide';
    if (typeof closeScreenShareDialog === 'function') closeScreenShareDialog('remote');
  });

  /**
   * peerconnection:iceConnectionState — ICE 连接状态变化
   *
   * @fires RTCPeerConnection 的 iceconnectionstatechange 事件触发
   *
   * 可用于监控媒体连接的健康状态：
   * - checking 后长时间未变为 connected → 可能存在网络/防火墙问题
   */
  e.session.on('peerconnection:iceConnectionState', (d) =>
  {
    console.warn('iceConnectionState: ', d);
  });

  /**
   * mediaerror — 用户媒体异常
   *
   * @fires 本地媒体轨道出现已知异常时触发（如视频轨道静音/黑屏）
   *
   * @type {object}
   * @property {string} type - 异常轨道类型（如 'video'）
   * @property {MediaStream} mediastream - 触发异常的媒体流
   *
   * 处理逻辑：
   * - 启动定时检测（共 3 次，间隔 1s）
   * - 若轨道恢复正常则停止检测
   * - 若 3 次后仍异常，可提示用户或做进一步处理
   */
  e.session.on('mediaerror', function(d)
  {
    setStatus(`用户媒体错误：${d.type} track failed`);

    // 定时检测视频轨道是否恢复正常，最多检测 3 次
    let count = 3;
    const timer = setInterval(() =>
    {
      // 视频轨道已恢复正常
      if (CRTC.Utils.isVideoTrackHealthy(d.mediastream))
      {
        clearInterval(timer);
      }
      // 达到重试上限仍未恢复
      else if (count >= 0)
      {
        clearInterval(timer);
        // 可在此提示用户摄像头异常或引导检查设备
      }
      else
      {
        count--;
      }
    }, 1000);
  });

  if (e.originator !== 'local')
  {
    e.session.on('mediaEffectsIssue', handleSessionMediaEffectsIssue);
  }

  /**
   * failed — 通话建立失败
   *
   * @fires 通话建立过程中发生不可恢复的错误时触发
   *
   * @type {object}
   * @property {string} originator - 'remote' 或 'local'
   * @property {string} message - 失败描述（originator 为 remote 时）
   * @property {string} cause - 失败原因码/描述
   *
   * 处理逻辑：
   * - 清理通知、重置状态、停止混流
   * - 停止录音和统计
   * - 清理自定义流和 AiNS 验证器
   */
  e.session.on('failed', function(d)
  {
    closeIncomingCallNotification();
    videoOnly = false;
    remoteNo = undefined;
    // 停止混流实例（如果存在）
    if (mix)
    {
      mix.stop();
      mix = null;
    }
    setStatus(`通话建立失败: ${d.cause}`);

    // 重置会话引用
    tmpSession = null;
    rtcSession = null;

    // 清理录音
    if (recorder)
    {
      recorder.stop();
      recorder.clearRecordedData();
    }

    // 输出通话时间线
    setStatus(`start: ${e.session.start_time}`);
    setStatus(`ended: ${e.session.end_time}`);

    if (statsSession === e.session)
    {
      statsSession = null;
      resetSessionStatsPanel();
    }

    // 停止 iOS OPTIONS 保活定时器
    optionsTimer && clearInterval(optionsTimer);

    // 清理 UI：恢复远端视频区域布局，关闭共享浮层
    document.querySelector('#remoteVideo').classList = 'h-100';
    document.querySelector('#remoteVideo2').className = 'screen-share-dialog-video hide';
    if (typeof closeScreenShareDialog === 'function') closeScreenShareDialog();

    // 清理自定义媒体流（用 SDK closeMediaStream 统一释放，避免轨道泄漏）
    CRTC.Utils.closeMediaStream(cusMediaStream);
    cusMediaStream = new MediaStream();

    // 停止 AiNS 验证器（如果该 demo 版本提供了该函数）
    if (typeof stopAiNsMonitor === 'function')
    {
      stopAiNsMonitor().catch((error) =>
      {
        console.warn('failed stopAiNsMonitor on failed', error);
      });
    }
  });

  /**
   * videoTrackState — 视频轨道状态变化
   *
   * @fires 视频轨道的属性发生变化时触发（muted/readyState/enabled/label 等）
   *
   * @type {object}
   * @property {MediaStreamTrack} track - 触发事件的视频轨道
   * @property {string} properties - 变化的属性名
   * @property {string|boolean} value - 变化后的值
   */
  e.session.on('videoTrackState', function(d)
  {
    setStatus(`VTState ${d.properties} ${d.value}`);
  });

  /**
   * ended — 通话结束
   *
   * @fires 通话正常或异常结束时触发
   *
   * @type {object}
   * @property {string} originator - 'remote' 或 'local'
   * @property {string} message - 结束描述
   * @property {string} cause - 结束原因
   *
   * 处理逻辑：
   * - 清理通知、状态、混流、录音
   * - 如果有排队的临时会话（tmpSession），则切换到该会话
   * - 否则完全清理通话状态
   */
  e.session.on('ended', function(d)
  {
    closeIncomingCallNotification();
    videoOnly = false;
    remoteNo = undefined;
    // 停止混流实例
    if (mix)
    {
      mix.stop();
      mix = null;
    }
    setStatus(`通话结束: ${d.cause}`);

    // 停止并清理录音数据
    if (recorder)
    {
      recorder.stop();
      recorder.clearRecordedData();
    }

    // 输出通话时间线
    setStatus(`start: ${e.session.start_time}`);
    setStatus(`ended: ${e.session.end_time}`);

    if (statsSession === e.session)
    {
      statsSession = null;
      resetSessionStatsPanel();
    }

    // ---- 会话交接逻辑 ----
    // 如果结束的是主会话且有排队的 tmpSession，切换到该会话
    if (rtcSession === e.session && Boolean(tmpSession))
    {
      // 停止当前渲染，切换到临时会话的媒体流
      stopStreams();
      getStreams(tmpSession.connection);
    }
    else
    {
      // 无排队的会话，完全清理
      tmpSession = null;
      rtcSession = null;
    }
    optionsTimer && clearInterval(optionsTimer);

    // 清理 UI：恢复视频布局并关闭共享浮层
    document.querySelector('#remoteVideo').classList = 'h-100';
    document.querySelector('#remoteVideo2').className = 'screen-share-dialog-video hide';
    if (typeof closeScreenShareDialog === 'function') closeScreenShareDialog();

    // 清理自定义媒体流（用 SDK closeMediaStream 统一释放，避免轨道泄漏）
    CRTC.Utils.closeMediaStream(cusMediaStream);
    cusMediaStream = new MediaStream();

    // 停止 AiNS 验证器（如果该 demo 版本提供了该函数）
    if (typeof stopAiNsMonitor === 'function')
    {
      stopAiNsMonitor().catch((error) =>
      {
        console.warn('failed stopAiNsMonitor on ended', error);
      });
    }
  });

  /**
   * newDTMF — 收到 DTMF 信号
   *
   * @fires 收到 INFO 模式携带的 DTMF 信令时触发
   *
   * @type {object}
   * @property {string} originator - 'remote' 或 'local'
   * @property {object} dtmf - DTMF 对象
   * @property {string} dtmf.tone - DTMF 按键字符（0-9、*、#、A-D）
   */
  e.session.on('newDTMF', function(d)
  {
    // 输出 INFO 模式收到的 DTMF
    setStatus(`${d.originator} DTMF:${d.dtmf.tone}`);
  });

  /**
   * newInfo — 收到 SIP INFO 消息
   *
   * @fires 收到 INFO 消息时触发
   *
   * @type {object}
   * @property {string} originator - 'remote' 或 'local'
   * @property {object} info - INFO 消息体对象
   *
   * 处理逻辑：
   * - remote：解析 JSON body，处理 cancel 事件（取消呼转等候室）
   * - local：输出已发送的消息内容
   */
  e.session.on('newInfo', function(d)
  {
    if (d.originator === 'remote')
    {
      setStatus(`收到新消息：${JSON.stringify(d.info.body)}`);
      let body;

      // SDK 可能传入已解析的对象或原始 JSON 字符串，统一兼容。
      // 解析失败时静默丢弃，不中断其他 INFO 处理逻辑。
      try
      {
        body = typeof d.info.body === 'string' ? JSON.parse(d.info.body) : d.info.body;
      }
      catch (error)
      {
        console.warn('[base-js] invalid INFO body', error);

        return;
      }

      // 收到 cancel 事件时终止呼转等候室会话
      if (body)
      {
        if (body.event === 'cancel')
        {
          isRefer && tmpSession.terminate();
        }
        // 远端通过 SIP INFO 告知屏幕共享轨的 MID，用于点对点定向屏幕共享。
        // start：记录 MID 并尝试渲染（如果 track 已到达）
        // stop：清除 MID 并清理远端屏幕共享 UI
        else if (body.event === 'screen-share' && body.action === 'start')
        {
          pointToPointRemoteScreenMid = String(body.mid);
          renderPointToPointRemoteScreen(pointToPointRemoteScreenMid);
        }
        else if (body.event === 'screen-share' && body.action === 'stop')
        {
          pointToPointRemoteScreenMid = null;
          clearPointToPointRemoteScreen();
        }
      }
    }
    else if (d.originator === 'local')
    {
      setStatus(`发出消息：${d.info.body}`);
    }
  });

  /**
   * notify — 收到 SIP NOTIFY
   *
   * @fires 收到需要处理的 NOTIFY 消息（talk/hold 事件类型）时触发
   *
   * @type {object}
   * @property {string} event - 事件类型: 'talk'（3PCC 接通）、'hold'（3PCC 保持）
   * @property {object} request - NOTIFY 请求对象
   *
   * 处理逻辑：
   * - talk: 如果本地已保持则取消保持，否则自动应答（3PCC 场景）
   * - hold: 将会话置于保持状态
   */
  e.session.on('notify', function(d)
  {
    // 3PCC（Third Party Call Control）唤醒/接通
    if (d.event == 'talk')
    {
      // 如果本地已保持，只需取消保持即可恢复通话
      if (e.session.isOnHold().local)
      {
        e.session.unhold();
        setStatus('3pcc unhold');

        return;
      }

      // 否则自动应答（3PCC 呼入自动接听）
      e.session.answer({
        rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
        mediaConstraints    : {
          audio :
          {
            sampleRate   : 48000,
            channelCount : 1
          },
          video : buildSelectedVideoConstraints()
        },
        pcConfig : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' })
      });
      setStatus('3pcc answer');
    }
    // 3PCC 保持通话
    else if (d.event == 'hold')
    {
      e.session.hold();
      setStatus('3pcc hold');
    }
  });

  /**
   * muted — 媒体已静音/关闭
   *
   * @fires 本端调用 mute() 成功后触发
   *
   * @type {object}
   * @property {boolean} audio - 是否关闭了麦克风
   * @property {boolean} video - 是否关闭了摄像头
   */
  e.session.on('muted', function(d)
  {
    if (d.audio)
    {
      setStatus('关闭麦克风');
    }
    else if (d.video)
    {
      setStatus('关闭摄像头');
    }
  });

  /**
   * unmuted — 媒体已取消静音/开启
   *
   * @fires 本端调用 unmute() 成功后触发
   *
   * @type {object}
   * @property {boolean} audio - 是否开启了麦克风
   * @property {boolean} video - 是否开启了摄像头
   */
  e.session.on('unmuted', function(d)
  {
    if (d.audio)
    {
      setStatus('开启麦克风');
    }
    else if (d.video)
    {
      setStatus('开启摄像头');
    }
  });

  /**
   * upgradeToVideo — 远端请求升级为视频通话
   *
   * @fires 远端发起视频升级请求时触发
   *
   * 处理逻辑：
   * - 如果已确认且无摄像头，则拒绝升级
   * - 否则接受，使用当前视频约束
   */
  e.session.on('upgradeToVideo', (d) =>
  {
    // 已确认通话且无摄像头时拒绝升级
    if (confirmed && !haveACamera)
    {
      d.reject();
    }
    else
    {
      d.accept(buildSelectedVideoConstraints());
    }
  });

  /**
   * accepted — 远端接受呼叫
   *
   * @fires 收到 SIP 200 OK（即远端应答）时触发
   *
   * 处理逻辑：关闭来电通知，检测远端操作系统类型。
   */
  e.session.on('accepted', (d) =>
  {
    // 已应答，关闭来电提示
    closeIncomingCallNotification();
    console.warn('dOS: ', detectRemoteOS(d.response));
  });

  /**
   * confirmed — 通话确认（ACK 完成）
   *
   * @fires 通话 SIP ACK 确认后触发，此时媒体链路已完全建立
   *
   * @type {object}
   * @property {string} originator - 'remote' 或 'local'
   *
   * 处理逻辑：
   * 1. 关闭来电通知
   * 2. ICE 状态异常检测
   * 3. 启动录音（如果 URL 参数指定）
   * 4. 渲染本地/远端媒体流
   * 5. 监听 ontrack 处理远端辅助视频流
   * 6. 根据参数设置视频码率
   */
  e.session.on('confirmed', async function()
  {
    closeIncomingCallNotification();

    // ---- ICE 异常检测 ----
    // 如果 ICE 仍处于 'new' 状态，说明网络连接可能异常
    if (e.session.connection.iceConnectionState === 'new')
    {
      // 可根据业务需要进行网络异常提示，或延迟 2 秒后再判一次确认
    }

    // 获取本地媒体流（用于录音/渲染）
    const localStream = CRTC.Utils.getStreams(e.session.connection, 'local');
    // 获取远端媒体流
    const remoteStream = CRTC.Utils.getStreams(e.session.connection, 'remote');

    // ---- 录音逻辑 ----
    // rec 参数为录音时长（秒），由 URL 查询参数传入
    if (rec)
    {
      // 同时录制本地和远端视频
      recorder = new MultiStreamRecorder([ localStream.videoStream, remoteStream.videoStream ]);
      recorder.mimeType = 'video/webm;codecs=vp8';
      // 录音数据可用时自动下载
      recorder.ondataavailable = function(blob)
      {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        a.href = url;
        a.download = `rec_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
      };
      // 按指定秒数启动录音
      recorder.start(Number(rec) * 1000);
    }

    setStatus('confirmed');

    // 标记通话已确认
    confirmed = true;

    // ---- 渲染本地和远端媒体流 ----
    getStreams(e.session.connection);

    // ---- 监听 A 通过重协商新增的屏幕视频轨 ----
    // 不根据 ontrack 当下的 muted 状态猜测，而是等 SIP INFO 中的 MID
    // 与 transceiver.mid 匹配后渲染，并在轨道 unmute 时自动刷新。
    e.session.connection.addEventListener('track', handlePointToPointRemoteVideoTrack);

    // ---- 设置视频发送最大码率 ----
    // 根据 URL 参数 mbit 调整视频编码码率
    if (mbit)
    {
      e.session.connection.getSenders().forEach((sender) =>
      {
        if (sender.track && sender.track.kind === 'video')
        {
          const parameters = sender.getParameters();

          // 将 mbit（kbps）转为 bps 设置
          parameters.encodings[0].maxBitrate = mbit * 1000;

          sender.setParameters(parameters).then(() =>
          {
            console.log('成功设置 maxBitrate');
          })
            .catch((err) =>
            {
              console.error('设置 RTCRtpSender 参数失败:', err);
            });

          sender.track.contentHint = 'detail';
        }
      });
    }
  });

  //  ***** DOM 事件绑定 *****
  // 以下事件绑定在 newRTCSession 内部，因此每个会话都持有独立的 handler 引用

  /**
   * videoHint — 视频内容优先级切换
   *
   * 控制视频编码策略：
   * - 'motion'（保流畅）：偏向高帧率
   * - 'detail'（保清晰）：偏向高分辨率
   */
  document.querySelector('#videoHint').onchange = function()
  {
    e.session.setVideoContentHint(this.options[this.selectedIndex].value);
    setStatus(`${this.options[this.selectedIndex].text}`);
  };

  /**
   * answer — 音频接听
   *
   * 仅使用音频，不采集/发送视频。
   * 携带随路数据 X-Data 和 X-UA 用于自定义业务逻辑。
   */
  document.querySelector('#answer').onclick = function()
  {
    e.session.answer({
      mediaConstraints : {
        audio : buildSelectedAudioConstraints(),
        video : false // 不采集视频
      },
      pcConfig             : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
      // 随路数据：注意 'X' 大写及 ':' 后面的空格
      extraHeaders         : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints  : { offerToReceiveAudio: true },
      extraFeatures        : extraFeatures,
      mediaEffectsComposer : buildCallComposerOptions(),
      aiNoiseSuppression   : buildCallAiNsOptions()
    });

    setStatus('audio answer');
  };

  /**
   * answerVideo — 视频接听
   *
   * 同时采集音频和视频，使用当前的 videoConstraints。
   */
  document.querySelector('#answerVideo').onclick = function()
  {
    e.session.answer({
      mediaConstraints : {
        audio : buildSelectedAudioConstraints(),
        video : buildSelectedVideoConstraints()
      },
      pcConfig             : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
      extraHeaders         : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints  : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures        : extraFeatures,
      mediaEffectsComposer : buildCallComposerOptions(),
      aiNoiseSuppression   : buildCallAiNsOptions()
    });

    setStatus('video answer');
  };

  /**
   * answerAudio — 空音频接听
   *
   * 使用静默音频轨道（generateAnEmptyAudioTrack）代替真实麦克风采集。
   * 视频使用真实摄像头。适用于仅需视频、不需要真实音频的场景。
   */
  document.querySelector('#answerAudio').onclick = async function()
  {
    const tmpStream = new MediaStream();
    // 生成静默音频轨道（不采集真实麦克风）
    const emptyTrack = await CRTC.Utils.generateAnEmptyAudioTrack();

    tmpStream.addTrack(emptyTrack.audioTrack, tmpStream);
    e.session.answer({
      mediaConstraints : {
        audio : true,
        video : buildSelectedVideoConstraints()
      },
      pcConfig            : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
      extraHeaders        : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures       : extraFeatures,
      mediaStream         : tmpStream // 使用自定义的静默音频流
    });

    setStatus('video answer');
  };

  /**
   * onlyVideoAudio — 单视频接听（无音频采集）
   *
   * 仅采集视频，不采集麦克风。设置 videoOnly 标志。
   */
  document.querySelector('#onlyVideoAudio').onclick = async function()
  {
    videoOnly = true;
    e.session.answer({
      mediaConstraints : {
        audio : false, // 不采集音频
        video : buildSelectedVideoConstraints()
      },
      pcConfig            : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
      extraHeaders        : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures       : extraFeatures
    });

    setStatus('video answer');
  };

  /**
   * onlyCommVideo — 自定义黑屏视频接听（无音频）
   *
   * 使用黑色占位视频轨道（无摄像头图标）代替真实摄像头。
   * 不采集音频。适用于仅需展示占位视频的场景。
   */
  document.querySelector('#onlyCommVideo').onclick = async function()
  {
    const tmpStream = new MediaStream();

    // 生成黑色占位视频轨道（仅首次创建）
    blackVideo || (blackVideo = CRTC.Utils.generateAnBlackVideoTrack({ svgSource: no_camera_svg, width: videoConstraints.width, height: videoConstraints.height, fps: videoConstraints.fps }));

    tmpStream.addTrack(blackVideo.videoTrack, tmpStream);

    e.session.answer({
      mediaConstraints : {
        audio : false,
        video : true
      },
      pcConfig            : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
      extraHeaders        : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures       : extraFeatures,
      mediaStream         : tmpStream
    });

    setStatus('video answer');
  };

  /**
   * audioCommVideo — 自定义黑屏视频接听（含音频）
   *
   * 与 onlyCommVideo 相同，但保留真实音频采集。
   */
  document.querySelector('#audioCommVideo').onclick = async function()
  {
    const tmpStream = new MediaStream();

    blackVideo || (blackVideo = CRTC.Utils.generateAnBlackVideoTrack({ svgSource: no_camera_svg, width: videoConstraints.width, height: videoConstraints.height, fps: videoConstraints.fps }));

    tmpStream.addTrack(blackVideo.videoTrack, tmpStream);

    e.session.answer({
      mediaConstraints : {
        audio : true,
        video : true
      },
      pcConfig            : Object.assign(pcConfig, { 'rtcpMuxPolicy': 'negotiate' }),
      extraHeaders        : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures       : extraFeatures,
      mediaStream         : tmpStream
    });

    setStatus('video answer');
  };

  /**
   * toAudio — 切换为纯音频模式
   *
   * 触发 session 的 mode 事件回调，关闭视频发送。
   */
  document.querySelector('#toAudio').onclick = function()
  {
    e.session.downgradeToAudio({ useUpdate: useUpdate }, () => { setStatus(`切换音频模式完成${curMode}`); });
  };

  /**
   * toVideo — 切换为视频模式
   *
   * 触发 session 的 mode 事件回调，开启视频发送。
   */
  document.querySelector('#toVideo').onclick = function()
  {
    e.session.upgradeToVideo({ useUpdate: useUpdate, videoConstraints: buildSelectedVideoConstraints() }, () => { setStatus(`切换视频模式完成${curMode}`); });
  };

  // // b2b切换视频模式
  // document.querySelector('#b2bToVideo').onclick =async function()
  // {
  //   request({
  //     url    : 'https://pro.vsbc.com:5085/b2b/tapi/v1/getInCallIdStr',
  //     method : 'POST',
  //     secret : '1qaz2wsx3edc4rfv5tgb6yhn7ujm8iko1qaz2wsx3edc4rfv5tgb6yhn7ujm8ikp',

  //     body : { 'caller': remoteNo }
  //   })
  //     .then((callId) =>
  //     {
  //       console.warn('cid: ', callId);

  //       return request({
  //         url    : 'https://pro.vsbc.com:5085/b2b/tapi/v1/status',
  //         method : 'POST',
  //         secret : '1qaz2wsx3edc4rfv5tgb6yhn7ujm8iko1qaz2wsx3edc4rfv5tgb6yhn7ujm8ikp',

  //         body : { 'callId': callId.data.data, 'cmd': 'query' }
  //       });
  //     })
  //     .then(((callNo) =>
  //     {
  //       b2bChannel.postMessage({ type: 'toVideo', data: BigInt(callNo.data.data.stat) });
  //     }));
  // };

  // // b2b切换音频模式
  // document.querySelector('#b2bToAudio').onclick = function()
  // {
  //   b2bChannel.postMessage({ type: 'toAudio' });
  // };

  /**
   * toCommonVideoSendonly — 切换为单向视频（自定义黑屏流，仅发送）
   *
   * 使用黑色占位视频轨道，仅发不收。依赖 useUpdate 全局变量。
   */
  document.querySelector('#toCommonVideoSendonly').onclick = function()
  {
    const tmpStream = new MediaStream();

    blackVideo || (blackVideo = CRTC.Utils.generateAnBlackVideoTrack({ svgSource: no_camera_svg, width: videoConstraints.width, height: videoConstraints.height, fps: videoConstraints.fps }));

    tmpStream.addTrack(blackVideo.videoTrack, tmpStream);

    e.session.upgradeToVideo({ sendOnly: true, useUpdate: useUpdate, videoStream: tmpStream }, () => { setStatus('切换视频模式完成') + curMode; });
  };

  /**
   * switchVideo — 动态替换视频轨道
   *
   * 通话中将视频发送轨道替换为黑色占位视频，不经过协商。
   */
  document.querySelector('#switchVideo').onclick = function()
  {
    const cusVideo = CRTC.Utils.generateAnBlackVideoTrack({ svgSource: no_camera_svg, width: videoConstraints.width, height: videoConstraints.height, fps: videoConstraints.fps });

    e.session.connection.getSenders().forEach((sender) =>
    {
      if (sender.track.kind === 'video')
      {
        sender.replaceTrack(cusVideo.videoTrack).then(() => setStatus('替换成功'));
      }
    });
  };

  /**
   * toVideoSendonly — 切换为单向视频（真实摄像头，仅发送）
   */
  document.querySelector('#toVideoSendonly').onclick = function()
  {
    e.session.upgradeToVideo({ sendOnly: true, useUpdate: useUpdate, videoConstraints: buildSelectedVideoConstraints() }, () => { setStatus('切换视频模式完成') + curMode; });
  };

  /**
   * toCommonVideo — 切换为自定义流视频模式（双向）
   *
   * 使用黑色占位视频作为视频源进行双向视频通话。
   */
  document.querySelector('#toCommonVideo').onclick = function()
  {
    const tmpStream = new MediaStream();

    blackVideo || (blackVideo = CRTC.Utils.generateAnBlackVideoTrack({ svgSource: no_camera_svg, width: videoConstraints.width, height: videoConstraints.height, fps: videoConstraints.fps }));

    tmpStream.addTrack(blackVideo.videoTrack, tmpStream);
    e.session.upgradeToVideo({ useUpdate: useUpdate, videoStream: tmpStream }, () => { setStatus('切换视频模式完成') + curMode; });
  };

  // 摄像头和麦克风的切换已统一在 app.ui-bindings.js 中处理，
  // 避免同一个元素被多次 addEventListener 导致重复绑定。

  /**
   * switchDevice — 移动端前后摄像头切换
   *
   * 在 'user'（前置）和 'environment'（后置）之间切换。
   * 切换后调用 renegotiate 更新 SDP。
   */
  document.querySelector('#switchDevice').onclick = async function()
  {
    if (cloneStream)
    {
      cloneStream.getVideoTracks().forEach((v) =>
      {
        v.stop();
      });
    }
    e.session.switchDevice('camera', camFlag ? 'environment' : 'user')
      .then(() => e.session.renegotiate())
      .catch((err) => console.warn('err: ', err));

    // 翻转标记供下次切换
    camFlag = !camFlag;
    setStatus(`switchDevice facingMode ${camFlag}`);
  };

  /**
   * cancel — 结束通话
   *
   * 终止所有相关会话（主会话、临时会话、旧会话），清理黑屏视频资源和通知。
   */
  document.querySelector('#cancel').onclick = function()
  {
    closeIncomingCallNotification();
    blackVideo && blackVideo.cleanup();

    try
    {
      // 终止所有可能的会话：旧 refer 会话、当前会话、主会话、排队会话
      oldSession && oldSession.isEstablished() && oldSession.terminate();
      e.session && e.session.terminate();
      rtcSession && rtcSession.terminate();
      tmpSession && tmpSession.terminate();
    }
    catch (error) { console.error(error); }
  };

  /**
   * cancelReferBtn — 取消呼转
   *
   * 通过 SIP INFO 发送 cancel 事件通知对端。
   */
  document.querySelector('#cancelReferBtn').onclick = function()
  {
    e.session.sendInfo('text/plain', JSON.stringify({ 'event': 'cancel' }));
  };

  /**
   * referBtn — 呼叫盲转（Blind Transfer）
   *
   * 保持当前通话后将呼叫盲转到指定号码。
   * 转接过程中监听各类事件：
   * - failed/requestFailed：取消保持恢复通话
   * - accepted：转接成功后终止原会话
   */
  document.querySelector('#referBtn').onclick = function()
  {
    // 转接过程中的事件回调
    const eventHandlers = {
      'progress'         : function(data) { console.log('progress', data); },
      'failed'           : function() { if (e.session.isOnHold().local) { e.session.unhold(); } },
      'accepted'         : function(data) { console.log('accept', data); e.session.terminate(); },
      'trying'           : function(data) { console.log('trying', data); },
      'requestSucceeded' : function(data) { console.log('requestSucceeded', data); },
      'requestFailed'    : function() { if (e.session.isOnHold().local) { e.session.unhold(); } }
    };

    // 保持当前通话后发起盲转
    e.session.hold();
    e.session.refer(`${document.querySelector('#refer').value}@${sipDomain}`, {
      eventHandlers : eventHandlers
    });
  };

  /**
   * muteMic — 关闭麦克风
   */
  document.querySelector('#muteMic').onclick = function()
  {
    console.log('mute: ', e.session.isMuted().audio);
    e.session.mute({ audio: true });
  };

  /**
   * unmuteMic — 开启麦克风
   */
  document.querySelector('#unmuteMic').onclick = function()
  {
    console.log('unmute: ', e.session.isMuted().audio);
    e.session.unmute({ audio: true });
  };

  /**
   * muteCam — 关闭摄像头
   *
   * 如果为纯视频模式（videoOnly），使用 video_only 参数仅关闭视频轨道。
   */
  document.querySelector('#muteCam').onclick = function()
  {
    if (videoOnly)
    {
      // 纯视频模式：使用 video_only 标志
      e.session.mute({ video: true, video_only: true });
    }
    else
    {
      e.session.mute({ video: true });
    }
  };

  /**
   * unmuteCam — 开启摄像头
   *
   * 仅在摄像头已关闭状态下有效。
   */
  document.querySelector('#unmuteCam').onclick = function()
  {
    e.session.unmute({ video: true });
  };

  /**
   * hold — 暂停/恢复通话
   *
   * 切换逻辑：本端已暂停则恢复，否则暂停（仅当远端也未暂停时）。
   */
  document.querySelector('#hold').onclick = function()
  {
    const isHold = e.session.isOnHold();

    // 本端已暂停 → 恢复通话
    if (isHold.local)
    {
      e.session.unhold();
    }
    // 本地和远端都未暂停 → 执行暂停
    else if (!isHold.remote)
    {
      e.session.hold();
    }
  };

  /**
   * screenShare — 分享屏幕（简单模式）
   *
   * 启动屏幕分享，不替换本地视频轨道。
   * share(type, id, assembly, dual, skip) 参数说明：
   *   type: 'screen' — 分享屏幕
   *   id: null       — 屏幕分享不需要 CSS 选择器
   *   assembly: null — 屏幕分享不需要渲染函数
   */
  document.querySelector('#screenShare').onclick = function()
  {
    e.session.share('screen', null, null)
      .then((stream) =>
      {
        document.querySelector('#screen').srcObject = stream;
        // 屏幕共享统一使用浮层样式，并弹出共享浮层
        document.querySelector('#screen').className = 'screen-share-dialog-video';
        if (typeof openScreenShareDialog === 'function') openScreenShareDialog('local');

        // 用户通过浏览器 UI 停止分享时隐藏屏幕预览
        stream.getVideoTracks()[0].onended = () =>
        {
          document.querySelector('#screen').className = 'screen-share-dialog-video hide';
          if (typeof closeScreenShareDialog === 'function') closeScreenShareDialog('local');
        };
      });
  };

  /**
   * screenShareD — 分享屏幕（双流模式）
   *
   * 在双流模式下分享屏幕：额外的视频流作为第二路发送。
   * share(type, id, assembly, dual, skip) 参数说明：
   *   type: 'screen' — 分享屏幕
   *   id: null       — 屏幕分享不需要 CSS 选择器
   *   assembly: null — 屏幕分享不需要渲染函数
   *   dual: true     — 双流模式，屏幕画面作为独立第二路视频流，不替换摄像头画面
   * 包含双重停止检测机制：
   * 1. ended 事件（主流）
   * 2. 定时轮询 readyState（兜底，部分场景 ended 不触发）
   *
   * Safari 兼容：检测到 user gesture 错误时设置 safari_r 标志，
   * 引导用户点击专用的 macOS 分享按钮。
   */
  document.querySelector('#screenShareD').onclick = function()
  {
    e.session.share('screen', null, null, true)
      .then((stream) =>
      {
        // 渲染屏幕共享预览
        document.querySelector('#screen').srcObject = stream;
        document.querySelector('#screen').className = 'screen-share-dialog-video';
        if (typeof openScreenShareDialog === 'function') openScreenShareDialog('local');

        // 方式一：监听 ended 事件（主流浏览器支持）
        stream.getVideoTracks()[0].addEventListener('ended', () =>
        {
          document.querySelector('#screen').className = 'screen-share-dialog-video hide';
          if (typeof closeScreenShareDialog === 'function') closeScreenShareDialog('local');
        });

        // 方式二：定时轮询兜底（部分被动场景 ended 事件不触发）
        const timer = setInterval(() =>
        {
          if (stream.getVideoTracks()[0].readyState === 'ended')
          {
            document.querySelector('#screen').className = 'screen-share-dialog-video hide';
            if (typeof closeScreenShareDialog === 'function') closeScreenShareDialog('local');
            clearInterval(timer);
          }
        }, 100);

        // 双流模式下清空辅助视频区
        document.querySelector('#remoteVideo2').srcObject = null;
        document.querySelector('#remoteVideo2').className = 'screen-share-dialog-video hide';
      })
      .catch((error) =>
      {
        // Safari 浏览器需用户手势才能触发屏幕分享
        if (error.message && error.message.indexOf('user gesture handler') !== -1)
        {
          safari_r = true;
          setStatus('请在浏览器中点击 "Safari分享" 按钮触发屏幕分享');
        }

        setStatus(error.message);
      });
  };

  /**
   * screenShareD_iOS — Safari 屏幕分享补救按钮
   *
   * 当首次分享因 Safari 缺少 user gesture 而失败（safari_r 被置为 true）时，
   * 用户需手动点击此按钮以提供用户手势上下文，重新发起分享。
   * share(type, id, assembly, dual, skip) 参数说明：
   *   type: 'screen' — 分享屏幕
   *   id: null       — 屏幕分享不需要 CSS 选择器
   *   assembly: null — 屏幕分享不需要渲染函数
   *   dual: true     — 双流模式
   *   skip: true     — 跳过 BFCP 握手（Safari 兼容），直接发起屏幕分享
   */
  document.querySelector('#screenShareD_iOS').onclick = function()
  {
    if (safari_r)
    {
      safari_r = false;
      e.session.share('screen', null, null, true, true)
        .then((stream) =>
        {
          document.querySelector('#screen').srcObject = stream;
          document.querySelector('#screen').className = 'screen-share-dialog-video';
          if (typeof openScreenShareDialog === 'function') openScreenShareDialog('local');

          stream.getVideoTracks()[0].addEventListener('ended', () =>
          {
            document.querySelector('#screen').className = 'screen-share-dialog-video hide';
            if (typeof closeScreenShareDialog === 'function') closeScreenShareDialog('local');
          });

          const timer = setInterval(() =>
          {
            if (stream.getVideoTracks()[0].readyState === 'ended')
            {
              document.querySelector('#screen').className = 'screen-share-dialog-video hide';
              if (typeof closeScreenShareDialog === 'function') closeScreenShareDialog('local');
              clearInterval(timer);
            }
          }, 100);

          document.querySelector('#remoteVideo2').srcObject = null;
          document.querySelector('#remoteVideo2').className = 'screen-share-dialog-video hide';
        })
        .catch((err) =>
        {
          console.warn('err: ', err);
        });
    }
  };

  /**
   * formShare / formShareD — 分享 HTML 元素
   *
   * share(type, id, assembly, dual, skip) 参数说明：
   *   type: 'html'        — 分享页面 HTML 元素
   *   id: '#ele'          — 要分享的 DOM 元素 CSS 选择器
   *   assembly: html2canvas — 将 DOM 元素渲染为 Canvas 的函数
   *   dual: true/false    — 是否双流模式（D 后缀版本传 true）
   * 依赖 html2canvas.js 将 DOM 元素渲染为视频流。
   */
  document.querySelector('#formShare').onclick = function()
  {
    e.session.share('html', '#ele', html2canvas);
  };
  document.querySelector('#formShareD').onclick = function()
  {
    e.session.share('html', '#ele', html2canvas, true);
  };

  /**
   * picShare / picShareD — 分享图片
   *
   * share(type, id, assembly, dual, skip) 参数说明：
   *   type: 'pic'     — 分享图片元素
   *   id: '#pic_s'    — 图片元素的 CSS 选择器
   *   assembly: null  — 图片分享不需要渲染函数
   *   dual: true/false — 是否双流模式（D 后缀版本传 true）
   */
  document.querySelector('#picShare').onclick = function()
  {
    e.session.share('pic', '#pic_s', null);
  };
  document.querySelector('#picShareD').onclick = function()
  {
    e.session.share('pic', '#pic_s', null, true);
  };

  /**
   * videoShare / videoShareD — 分享视频元素
   *
   * share(type, id, assembly, dual, skip) 参数说明：
   *   type: 'video'    — 分享正在播放的 video 元素
   *   id: '#video_s'   — video 元素的 CSS 选择器
   *   assembly: null   — 视频分享不需要渲染函数，直接 captureStream
   *   dual: true/false — 是否双流模式（D 后缀版本传 true）
   * 需要视频已在播放状态。
   */
  document.querySelector('#videoShare').onclick = function()
  {
    document.querySelector('#video_s').play()
      .then(() =>
      {
        e.session.share('video', '#video_s', null);
      });
  };
  document.querySelector('#videoShareD').onclick = function()
  {
    document.querySelector('#video_s').play()
      .then(() =>
      {
        e.session.share('video', '#video_s', null, true);
      });
  };

  /**
   * stopShare — 停止分享
   *
   * 停止后延迟 300ms 恢复本地/远端媒体渲染。
   */
  document.querySelector('#stopShare').onclick = function()
  {
    e.session.unShare();
    // 手动停止共享后同步清理屏幕预览和浮层
    document.querySelector('#screen').srcObject = null;
    document.querySelector('#screen').className = 'screen-share-dialog-video hide';
    if (typeof closeScreenShareDialog === 'function') closeScreenShareDialog('local');

    setTimeout(() =>
    {
      getStreams(e.session.connection);
    }, 300);
  };

  /**
   * dtmf — 发送 DTMF 按键
   *
   * 使用 RFC2833 方式传输，通过按键文本确定 tone。
   */
  document.querySelector('#dtmf').onclick = function(d)
  {
    e.session.sendDTMF(d.target.innerText, { 'transportType': 'RFC2833' });
  };

  /**
   * sendInfo — 通话中推送消息
   *
   * 通过 SIP INFO 发送自定义 JSON 数据。
   * contentType 为 text/plain。
   */
  document.querySelector('#sendInfo').onclick = function()
  {
    e.session.sendInfo('text/plain', JSON.stringify(document.querySelector('#info').value));
  };

  /**
   * capture — 对远端视频截图
   *
   * 将当前远端视频帧绘制到 Canvas 上并显示预览面板。
   * 分辨率优先取实际视频分辨率，回退到 CSS 尺寸，再回退到默认 640x360。
   */
  document.querySelector('#capture').onclick = function()
  {
    const canvas = document.getElementById('captureView');
    const ctx = canvas.getContext('2d');
    const videoEl = $('#remoteVideo')[0];
    // 优先取实际视频分辨率，回退到 CSS 尺寸，最后回退到默认值
    const frameW = videoEl.videoWidth || videoEl.clientWidth || 640;
    const frameH = videoEl.videoHeight || videoEl.clientHeight || 360;

    canvas.width = frameW;
    canvas.height = frameH;

    ctx.drawImage(
      videoEl,
      0,
      0,
      frameW,
      frameH
    );

    // drawImage 是同步的，画完后直接显示预览面板
    canvas.classList.remove('hide');

    const captureEmpty = document.getElementById('capture-empty');
    const capturePanel = document.getElementById('capture-preview-panel');

    if (captureEmpty)
    {
      captureEmpty.classList.add('hide');
    }

    if (capturePanel)
    {
      capturePanel.classList.add('has-capture');
    }
  };

}


/**
 * 发起呼叫（核心函数）
 *
 * @param {string} type - 呼叫类型：
 *   - 空/默认: 音频模式
 *   - 'video': 视频模式
 *   - 'onlyVideo': 纯视频模式（不采集麦克风）
 *   - 'screen': 屏幕分享模式
 *   - 'callnull': 空音视频模式
 *   - 'callnullaudio': 空音频模式
 *   - 'callnullvideo': 空视频模式
 * @param {string} direction - 媒体方向: 'sendonly'（仅发送）或 'sendrecv'（双向，默认）
 * @param {MediaStream} mediaStream - 自定义媒体流（优先于 mediaConstraints）
 *
 * 处理流程：
 * 1. 检查注册状态
 * 2. 构建呼叫选项（随路数据、媒体约束、设备选择等）
 * 3. 根据 type 参数定制媒体流
 * 4. 发起 SIP 呼叫并处理早期事件
 */
async function call(type, direction, mediaStream)
{
  // 仅点对点模式可用；三方模式使用 callConferenceVideo 等专用入口。
  if (appMode !== 'point-to-point')
  {
    setStatus(appMode ? '三方模式下请使用会议呼叫按钮' : '请先选择点对点模式');

    return;
  }

  // 重置录音实例
  recorder = undefined;
  // 重置为前置摄像头
  camFlag = true;

  // ---- 前置检查：必须已注册 ----
  if (!ua || !ua.isRegistered())
  {
    setStatus(ua ? '请注册成功后呼叫' : '请先选择点对点模式');

    return;
  }

  // ---- 终止已有会话 ----
  rtcSession && rtcSession.terminate();

  // ---- 构建呼叫选项 ----
  options = {
    // 随路数据：X-Data（业务数据）、X-UA（设备信息）、X-Direction（媒体方向）
    extraHeaders  : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}`, `X-Direction: ${direction || 'sendrecv'}` ],
    extraFeatures : extraFeatures,
    pcConfig      : pcConfig,
    eventHandlers : {
      mediaEffectsIssue : handleSessionMediaEffectsIssue
    }
  };

  // ---- 附加媒体特效合成器配置 ----
  const composerOptions = buildCallComposerOptions();

  if (composerOptions)
  {
    options.mediaEffectsComposer = composerOptions;
  }

  // options = {
  //   'extraHeaders'  : [ 'X-Data: dGVzdCB4LWRhdGE=', 'X-UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36' ],
  //   'extraFeatures' : [],
  //   'pcConfig'      : {
  //     'iceServers'           : [ { 'urls': 'turn:5g.vsbc.com:60000?transport=udp', 'username': 'ipcu', 'credential': 'yl_19cu' } ],
  //     'iceTransportPolicy'   : 'relay',
  //     'iceCandidatePoolSize' : 10,
  //     'bundlePolicy'         : 'max-compat'
  //   },
  //   'mediaConstraints' : { 'audio': true, 'video': true },
  //   'mediaStream'      : {}
  // };

  // options = {
  //   'extraHeaders'  : [ 'X-Data: dGVzdCB4LWRhdGE=', 'X-UA: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', 'X-Direction: sendrecv' ],
  //   'extraFeatures' : [],
  //   'pcConfig'      : {
  //     'iceServers'           : [ { 'urls': 'turn:5g.vsbc.com:60000?transport=udp', 'username': 'ipcu', 'credential': 'yl_19cu' } ],
  //     'iceTransportPolicy'   : 'relay',
  //     'iceCandidatePoolSize' : 10,
  //     'bundlePolicy'         : 'max-compat'
  //   },
  //   'mediaConstraints' : {
  //     'audio' : {
  //       'sampleRate'   : 48000,
  //       'channelCount' : 1
  //     },
  //     'video' : {
  //       'facingMode' : 'user',
  //       'width'      : 640,
  //       'height'     : 480,
  //       'frameRate'  : 15
  //     }
  //   }
  // };

  // ---- 媒体方向控制 ----
  if (direction == 'sendonly')
  {
    // 仅发送模式：不接收远端视频
    options['rtcOfferConstraints'] = { offerToReceiveAudio: true, offerToReceiveVideo: false };
    // 纯视频 + 仅发送：音频也不接收
    if (type === 'onlyVideo')
    {
      options['rtcOfferConstraints'] = { offerToReceiveAudio: false, offerToReceiveVideo: false };
    }
  }

  // ---- 媒体流选择：自定义流优先于媒体约束 ----
  if (mediaStream)
  {
    // 使用传入的自定义媒体流
    options['mediaStream'] = mediaStream;
  }
  else
  {
    // 使用媒体约束让浏览器自动采集
    options['mediaConstraints'] = {
      audio : buildSelectedAudioConstraints(),
      // 仅 video 和 onlyVideo 类型需要视频
      video : (type === 'video' || type === 'onlyVideo') ? buildSelectedVideoConstraints() : false
    };
  }

  // ---- 屏幕分享模式：采集屏幕 + 麦克风 ----
  if (type === 'screen')
  {
    await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false })
      .then(async(stream) =>
      {
        // 同时获取麦克风音频流
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: options['mediaConstraints'].audio, video: false });

        // 合并屏幕视频 + 麦克风音频
        cusMediaStream.addTrack(stream.getVideoTracks()[0]);
        cusMediaStream.addTrack(audioStream.getAudioTracks()[0]);
        delete options['mediaConstraints'];
        options['mediaStream'] = cusMediaStream;
      });
  }

  // ---- 空媒体模式：使用静默/黑屏占位轨道 ----
  if (type === 'callnull' || type === 'callnullaudio' || type === 'callnullvideo')
  {
    const tmpStream = new MediaStream();

    // callnullaudio 或 callnull：使用静默音频轨道
    if (type === 'callnullaudio' || type === 'callnull')
    {
      const emptyTrack = await CRTC.Utils.generateAnEmptyAudioTrack();

      tmpStream.addTrack(emptyTrack.audioTrack, tmpStream);
    }

    // 生成黑色占位视频轨道（全局复用，仅首次创建）
    blackVideo || (blackVideo = CRTC.Utils.generateAnBlackVideoTrack({ svgSource: no_camera_svg, width: videoConstraints.width, height: videoConstraints.height, fps: videoConstraints.fps }));

    window.novideo = blackVideo;

    // callnullvideo 或 callnull：附加黑屏视频轨道
    (type === 'callnullvideo' || type === 'callnull') && tmpStream.addTrack(novideo.videoTrack, tmpStream);

    options['mediaStream'] = tmpStream;

    // 同时指定媒体约束作为 fallback（系统麦克风和摄像头）
    options['mediaConstraints'] = {
      audio : type === 'callnullvideo' ? true : false,
      video : type === 'callnullaudio' ? videoConstraints : true
    };
  }

  // ---- 纯视频模式：关闭音频采集 ----
  if (type === 'onlyVideo')
  {
    options.mediaConstraints.audio = false;
  }

  console.log('op: ', options);

  // ---- 发起 SIP 呼叫 ----
  try
  {
    // 确定被叫号码：优先使用 B2B 转接的 callee，否则取输入框值
    const number = callee || document.querySelector('#callee').value;

    // ---- 应用选中的摄像头设备 ----
    if (selectCamera && options.mediaConstraints && options.mediaConstraints.video)
    {
      options.mediaConstraints.video.deviceId = { exact: selectCamera };
    }

    // ---- 应用选中的麦克风设备 ----
    if (selectMic && options.mediaConstraints && options.mediaConstraints.audio)
    {
      if (typeof options.mediaConstraints.audio === 'object')
      {
        // 音频约束是对象，直接附加 deviceId
        options.mediaConstraints.audio.deviceId = { exact: selectMic };
      }
      else
      {
        // 音频约束是布尔值，需要构造对象
        options.mediaConstraints.audio = { deviceId: { exact: selectMic } };
      }
    }

    // ---- 重新构建媒体效果和降噪配置（使用最新的 UI 选择） ----
    options.mediaEffectsComposer = buildCallComposerOptions();
    options.aiNoiseSuppression = buildCallAiNsOptions();

    remoteNo = number;

    // 发起 SIP 呼叫
    const session = await ua.call(`${number}@${sipDomain}`, options);

    // ---- 远端回铃音（早期媒体）处理 ----
    // 默认假设无远端回铃音
    earlyMedia = false;

    session.connection.ontrack = function(event)
    {
      // 仅处理音频轨道（回铃音）
      if (event.track.kind === 'audio')
      {
        // 收到远端音频媒体，说明存在回铃音
        earlyMedia = true;

        // 将远端音频渲染到音频元素
        remoteAudio.srcObject = event.streams[0];

        // Chrome 自动播放策略兼容：必须 catch 否则可能抛出 NotAllowedError
        remoteAudio.play()
          .catch(() => { });
      }
    };

    // ---- 外呼阶段取消按钮（newRTCSession 触发前有效） ----
    document.querySelector('#cancel').onclick = function()
    {
      closeIncomingCallNotification();
      try
      {
        session.terminate();
      }
      catch (error)
      {
        // SIP 状态 7/8 表示会话已结束/已终止，可忽略
        if (error.message === 'Invalid status: 8' || error.message === 'Invalid status: 7')
        {
          console.warn('ended');
        }
        setStatus(error.message);
      }

      // 清理黑屏视频资源
      blackVideo && blackVideo.cleanup();

      // 兼容 MCU 等候室：停止克隆流的所有轨道（用 SDK closeMediaStream 统一释放）
      if (cloneStream)
      {
        CRTC.Utils.closeMediaStream(cloneStream);
        localVideo.srcObject = null;
      }

      cloneStream = null;
    };
  }
  catch (error)
  {
    console.warn(`name: ${error.name}, message: ${error.message}`);
  }

  // ---- iOS 保活机制 ----
  // iOS 设备在后台时 WebSocket 可能被系统挂起，
  // 定时发送 OPTIONS 请求保持信令通道活跃
  if (optionsTimer)
  {
    clearInterval(optionsTimer);
  }

  if (navigator.userAgent.indexOf('iPhone') != -1)
  {
    optionsTimer = setInterval(() =>
    {
      ua.sendOptions(`sip_ping@${sipDomain}`);
    }, 3000);
  }
}

/**
 * 页面初始化
 *
 * 页面加载时只做两件事：
 * 1. 输出 SDK 版本号
 * 2. 预采集一次媒体权限以填充设备列表
 * 3. 提示用户选择"点对点"或"三方"模式
 *
 * UA 的创建、信令连接和注册在用户点击模式按钮后由 initializeDemoMode() 执行。
 * 按钮绑定、设备变化监听等在 app.ui-bindings.js 中统一管理。
 */
function initializePage()
{
  setStatus(`${CRTC.version}`);

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(async(mediastream) =>
    {
      await updateDevices();
      CRTC.Utils.closeMediaStream(mediastream);
    })
    .catch(async(error) =>
    {
      try
      {
        await updateDevices();
      }
      catch (deviceError)
      {
        setStatus(`设备列表加载失败: ${deviceError.name || deviceError.message || 'unknown'}`);
      }

      setStatus(`预采集失败: ${error.name || error.message || 'unknown'}`);
    });

  setStatus('请选择三方或点对点模式');
}

/**
 * 根据当前 appMode 和 appRegistrationState 刷新页面 UI。
 *
 * 负责：
 * - 更新顶部模式/注册状态标签（"点对点 · 已注册" 等）
 * - 禁用/启用"点对点"/"三方"选择按钮
 * - 禁用/启用点对点专属按钮（data-mode="point-to-point"、呼叫/接听按钮组）
 * - 展开/收起会议面板（三方模式首次选择时自动展开）
 * - 切换会议面板的帮助文字和控件可见性
 * - 同步调用三方模块的 updateConferenceUi（如果已加载）
 *
 * 此函数在注册状态变化和模式切换时被多处调用，是页面状态同步的中心入口。
 */
function updateAppModeUi()
{
  const modeLabel = document.querySelector('#appModeLabel');
  const pointButton = document.querySelector('#initializePointToPoint');
  const conferenceButton = document.querySelector('#initializeConference');
  const conferencePanel = document.querySelector('#conferencePanel');
  const conferenceSummary = document.querySelector('#conferenceModeSummary');
  const pointToPointOnly = document.querySelectorAll(
    '[data-mode="point-to-point"], #pointToPointCallControls button, #pointToPointAnswerControls button'
  );
  const conferenceActiveControls = document.querySelector('#conferenceActiveControls');
  const conferenceInactiveHelp = document.querySelector('#conferenceInactiveHelp');

  if (modeLabel)
  {
    const modeName = appMode === 'conference' ? '三方 A' : '点对点';
    const stateText = appRegistrationState === 'registered' ? '已注册' :
      (appRegistrationState === 'registering' ? '注册中' : '未注册');

    modeLabel.textContent = appMode ? `${modeName} · ${stateText}` : '尚未注册';
    modeLabel.classList.toggle('is-active', appRegistrationState === 'registered');
    modeLabel.classList.toggle('is-pending', appRegistrationState === 'registering');
  }
  if (pointButton) pointButton.disabled = Boolean(appMode);
  if (conferenceButton) conferenceButton.disabled = Boolean(appMode);

  pointToPointOnly.forEach((element) =>
  {
    element.disabled = appMode !== 'point-to-point';
  });

  if (conferencePanel)
  {
    if (appMode === 'conference' && conferencePanel.dataset.autoOpened !== 'true')
    {
      conferencePanel.open = true;
      conferencePanel.dataset.autoOpened = 'true';
    }
    else if (appMode !== 'conference')
    {
      conferencePanel.open = false;
      delete conferencePanel.dataset.autoOpened;
    }
    conferencePanel.classList.toggle('conference-inactive', appMode !== 'conference');
  }
  if (conferenceSummary)
  {
    conferenceSummary.textContent = appMode === 'conference' ?
      '三方会议（A 作为媒体桥接端）' : '三方会议（选择三方模式后启用）';
  }
  if (conferenceActiveControls) conferenceActiveControls.classList.toggle('hide', appMode !== 'conference');
  if (conferenceInactiveHelp) conferenceInactiveHelp.classList.toggle('hide', appMode === 'conference');
  if (typeof updateConferenceUi === 'function') updateConferenceUi();
}

/**
 * 初始化 Demo 模式（点对点或三方）。
 *
 * 页面加载后不自动创建 UA。用户点击"点对点"或"三方"按钮后调用此函数，
 * 创建 UA 实例、绑定事件、连接信令并注册。模式一旦选定不可切换（需刷新页面）。
 *
 * @param {'point-to-point'|'conference'} mode - 目标模式
 *
 * 执行流程：
 * 1. 检查是否已选择模式，已选择则提示刷新
 * 2. 三方模式需确认 handleConferenceNewRTCSession 已加载
 * 3. 创建 WebSocket 信令传输和 UA 实例
 * 4. 绑定共用 UA 事件 + 模式对应的 newRTCSession 处理函数
 * 5. 重置断网状态并调用 ua.start()
 * 6. 10 秒后检测连接/注册状态，超时则停止 UA
 */
function initializeDemoMode(mode)
{
  if (appMode)
  {
    setStatus('当前页面已经选择模式，切换模式请刷新页面');

    return;
  }
  if (mode !== 'point-to-point' && mode !== 'conference')
  {
    setStatus('不支持的初始化模式');

    return;
  }
  if (mode === 'conference' && typeof handleConferenceNewRTCSession !== 'function')
  {
    setStatus('三方模块尚未加载');

    return;
  }

  appMode = mode;
  // 创建 UA 后立即进入"注册中"状态，页面标签显示蓝色"注册中"
  appRegistrationState = 'registering';
  const socket = new CRTC.WebSocketInterface(signalingUrl);
  const configuration = buildUaConfiguration(socket);

  ua = new CRTC.UA(configuration);
  bindCommonUaEvents();
  // 按模式绑定不同的 newRTCSession 处理函数：点对点 vs 三方
  ua.on('newRTCSession', mode === 'conference' ?
    handleConferenceNewRTCSession : handlePointToPointNewRTCSession);

  // 重置断网状态（每次新建 UA 时都从干净状态开始）
  handleStop = false;
  disconnectedBy = null;
  isShowUI = false;
  // 刷新页面 UI：禁用模式选择按钮、展开/收起会议面板等
  updateAppModeUi();
  setStatus(`正在注册${mode === 'conference' ? '三方' : '点对点'}模式`);
  ua.start();

  // 闭包捕获当前 UA 引用，防止 setTimeout 时 ua 已被重新赋值。
  const initializedUa = ua;

  setTimeout(() =>
  {
    // 10 秒后如果 UA 已被重新赋值（虽然当前不支持切换模式），则跳过检测
    if (initializedUa !== ua)
    {
      return;
    }
    if (!initializedUa.isConnected() || !initializedUa.isRegistered())
    {
      initializedUa.stop();
      appRegistrationState = 'unregistered';
      updateAppModeUi();
      setStatus('网络连接异常或未注册成功');
    }
  }, 10000);
}

// =============================================================================
// 应用入口
// =============================================================================

// 页面只初始化 UI 和设备列表；UA 必须由用户选择模式后创建。
initializePage();
updateAppModeUi();
// 初始化媒体效果模块（虚拟背景、AI 降噪、水印等）
initMediaEffects();
