/* Demo 基础通话：UA、点对点会话、通话控制和媒体状态。 */
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
const NO_CAMERA = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg t="1756366745939" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="10589" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100"><path d="M865.08627 773.036973l-0.83027 0.996324a35.424865 35.424865 0 0 0-17.380324-4.649513 36.006054 36.006054 0 0 0-2.767568 71.956757c8.468757 7.140324 13.062919 14.612757 13.062919 22.417297 0 45.111351-152.050162 81.643243-339.635892 81.643243-130.739892 0-244.154811-17.767784-300.945297-43.782919l-50.425081 50.36973C241.442595 995.272649 370.632649 1024 517.535135 1024c232.475676 0 420.67027-71.956757 420.67027-160.518919 0-33.542919-27.011459-64.70573-73.119135-90.444108zM965.881081 49.816216a33.210811 33.210811 0 0 0-46.937946 0L58.118919 910.751135a33.210811 33.210811 0 0 0 46.827243 46.827243L965.881081 96.643459a33.210811 33.210811 0 0 0 0-46.827243zM251.350486 647.610811a363.935135 363.935135 0 0 1-73.229837-221.405406c0-195.611676 148.895135-354.248649 339.414486-354.248648a329.728 329.728 0 0 1 222.955243 86.126702l51.58746-51.532108A407.164541 407.164541 0 0 0 517.535135 0c-229.265297 0-415.135135 190.796108-415.135135 426.205405a431.076324 431.076324 0 0 0 96.754162 273.380325z m382.643892-382.588541a199.264865 199.264865 0 0 0-278.14054 278.140541l120.665946-120.942703a83.027027 83.027027 0 1 1 53.635459-53.635459zM716.8 426.205405a207.622919 207.622919 0 0 0-1.439135-23.635027l-221.405406 221.405406a207.622919 207.622919 0 0 0 23.579676 1.494486 199.264865 199.264865 0 0 0 199.264865-199.264865z m-398.861838 373.732325A404.618378 404.618378 0 0 0 517.535135 852.410811c229.265297 0 415.135135-190.796108 415.135135-426.205406a433.34573 433.34573 0 0 0-45.996973-194.947459L830.380973 287.827027a371.407568 371.407568 0 0 1 26.568649 138.378378c0 195.611676-148.895135 354.248649-339.414487 354.248649a329.783351 329.783351 0 0 1-146.127567-33.819676z" fill="#8a8a8a" p-id="10590"></path></svg>';

// =============================================================================
// 通话状态变量
// =============================================================================

// 当前向页面统计浮层提供数据的 RTCSession。
let statsCall;
// 远端是否存在回铃音：false 表示可播放本地振铃音
let earlyMedia = false;
// 当前活跃通话的 RTCSession 实例
let rtcSession;
// 用户选择模式前不创建 UA，也不会连接或注册。
let appMode = null;
// CRTC.UserAgent 实例，由 initMode() 在用户选择模式后创建。
// 点对点和三方模式共用同一个 UA，负责 SIP 连接、注册和新会话分发。
let ua = null;
// SIP 注册状态：'idle'（未初始化）、'registering'（注册中）、
// 'registered'（已注册）、'unregistered'（已注销）
let regState = 'idle';

// iOS 兼容：定时发送 OPTIONS 保活的定时器句柄
let keepTimer;
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
let cameraId;
// 当前选中的麦克风 deviceId
let micId;

// 移动端摄像头方向切换标记：true 表示下次切换到 environment（后置），false 表示下次切换到 user（前置）
let camFlag = true;

// 音视频升级模式选择：true = useUpdate，false = useReInvite
let useUpdate = true;
// 系统是否有可用摄像头
let hasCamera = false;
// 通话是否已确认（ACK 完成）
let confirmed = false;

// =============================================================================
// 断网提示相关变量
// =============================================================================

// 是否主动停止 UA（页面卸载时设为 true，避免误判断网）
let handleStop = false;
// 断网原因标记：'BROWSER'（浏览器离线）、'UA'（信令断开）
let endBy = null;
// =============================================================================
// 通话模式与媒体流变量
// =============================================================================

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
let callNotice = null;
// 浏览器是否已提示过“不支持系统通知”，避免重复日志
let noticeWarned = false;

// 通话附加扩展特性列表（如 BP720P、BFCP 等）
const features = [];

// =============================================================================
// DOM 元素引用
// =============================================================================

// 本端视频播放元素
const localVid = document.querySelector('#localVid');
// 远端视频播放元素
const remoteVid = document.querySelector('#remoteVid');
// 远端音频播放元素（用于回铃音/早期媒体播放）
const remoteAud = document.querySelector('#remoteAud');

// 自定义媒体流容器（屏幕分享等场景复用）
let callStream = new MediaStream();
// 无摄像头/黑屏视频轨道生成器实例
let blackVideo = null;

// =============================================================================
// URL 参数解析
// =============================================================================

// 随路数据（Base64 编码），默认 'dGVzdCB4LWRhdGE=' → 'test x-data'
let xdata = getQuery('xdata') || 'dGVzdCB4LWRhdGE=';
// 通话录音时长（秒），0 或不传则不录音
const rec = getQuery('rec') || false;
// 环境标识，用于切换不同的信令服务器/密码等配置
const env = getQuery('env');
// 是否移除 REMB/Transport-CC 扩展（VoLTE 互通兼容）
const noremb = getQuery('noremb') || false;
// 根据 env 参数选择对应的环境配置，默认使用 env_default
const { signalingUrl, sipDomain, secretKey, iceServers, iceTransportPolicy, password } = env ? envs[`env_${env}`] : envs['env_default'];
// 附加扩展特性的 URL 参数，逗号分隔
const exts = getQuery('ext') ? getQuery('ext').split(',') : null;
// 扩展特性转为大写集合，便于快速查重
const extSet = new Set((exts || []).map((ext) => String(ext).trim()
  .toUpperCase()).filter(Boolean));

// 将 URL 传入的扩展特性逐个注册到 features 列表
exts && exts.forEach((ext) => features.push(ext));

// =============================================================================
// UA 与信令配置
// =============================================================================

// SIP 注册用户名（来自 URL 参数 caller）
const account = getQuery('caller');

/**
 * 构建 UA 配置对象。
 * 在用户选择点对点或三方模式后才调用，替代之前页面加载时即创建的 const config。
 *
 * @param {object} transport - WebSocket 信令传输实例
 * @returns {object} 传给 new CRTC.UA() 的配置
 */
function getUaOpts(transport)
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
let videoOpts = {
  facingMode : 'user',
  width      : 640,
  height     : 480,
  frameRate  : 15
};

// 如果请求了 BP720P 扩展，则升级到 720p 分辨率
if (extSet.has('BP720P'))
{
  videoOpts = {
    facingMode : 'user',
    width      : 1280,
    height     : 720,
    frameRate  : 15
  };
}

/**
 * 获取或创建黑屏视频轨道生成器（懒初始化，只创建一次）。
 * 用于无摄像头呼叫和音视频升级场景中的视频占位，
 * 避免 PeerConnection 因缺少视频轨而无法完成 SDP 协商。
 *
 * @returns {{videoTrack: MediaStreamTrack}} 黑屏视频轨道包装对象
 */
// 黑屏占位轨只创建一次，接听和音视频升级场景共用。
function getBlackTrack()
{
  if (!blackVideo)
  {
    blackVideo = CRTC.Utils.generateAnBlackVideoTrack({
      svgSource : NO_CAMERA,
      width     : videoOpts.width,
      height    : videoOpts.height,
      fps       : videoOpts.frameRate
    });
  }

  return blackVideo;
}

// =============================================================================
// RTCPeerConnection 配置
// =============================================================================

// 基础 RTCPeerConnection 配置对象，所有呼叫/接听共用。
// 包含 ICE 服务器、ICE 传输策略、候选池大小和 BUNDLE 策略。
// 在 ua.call() 时通过 pcConfig 选项传入，不同场景可在此基础扩展。
const pcConfig = {};

// ICE 服务器列表（STUN/TURN）
iceServers && (pcConfig['iceServers'] = iceServers);
// ICE 传输策略（如 'relay' 强制走 TURN）
iceTransportPolicy && (pcConfig['iceTransportPolicy'] = iceTransportPolicy);
// ICE 候选池大小，预收集候选加速连接
pcConfig['iceCandidatePoolSize'] = 4;

// BUNDLE 策略设为最大兼容模式，所有媒体流复用同一端口
pcConfig['bundlePolicy'] = 'max-compat';

/**
 * 构建接听侧的 RTCPeerConnection 配置。
 * 在 pcConfig 基础上追加 rtcpMuxPolicy: 'negotiate'，
 * 用于兼容部分要求非复用 RTCP 的远端端点，避免因 RTCP 复用策略不匹配
 * 导致 DTLS 握手或媒体传输失败。
 *
 * @returns {object} 接听专用的 RTCPeerConnection 配置对象
 */
function getAnswerPc()
{
  return Object.assign({}, pcConfig, { rtcpMuxPolicy: 'negotiate' });
}

// =============================================================================
// UA 事件回调
//
// 点对点和三方模式共用同一组 UA 层事件（连接、注册、断网等）。
// newRTCSession 事件在模式初始化时按模式分别绑定不同的处理函数。
// =============================================================================

/**
 * 绑定 UA 级别的事件回调（连接、注册、断网、浏览器网络状态）。
 * 点对点和三方模式共用，在 initMode 中调用。
 */
function bindUa()
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
    if (!endBy)
    {
      endBy = 'BROWSER';
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
    if (endBy === 'BROWSER')
    {
      endBy = null;
    }
  });

  /**
   * connected — 信令 WebSocket 连接成功
   *
   * @fires 与信令服务器 WebSocket 连接建立时触发
   *
   * 处理逻辑：清除断网状态并开始注册。
   * 此事件表示传输层已就绪，但尚未完成 SIP 注册。
   */
  ua.on('connected', function()
  {
    // 信令连接成功后清除所有断网标记
    endBy = null;

    // 连接成功后进入注册中状态，更新页面标签
    regState = 'registering';
    updateMode();
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
    regState = 'unregistered';
    updateMode();

    // 页面卸载/主动停止 UA 导致的断开，不触发断网提示
    if (handleStop)
    {
      return;
    }

    endBy = 'UA';
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
   * 处理逻辑：输出注册成功信息并更新页面状态。
   */
  ua.on('registered', function(data)
  {
    setStatus(`注册成功：${data.response.from.uri.toString()}`);
    // 注册成功后更新状态标签为"已注册"（绿色）
    regState = 'registered';
    updateMode();
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
    regState = 'unregistered';
    updateMode();
  });

  /**
   * unregistered — SIP 主动注销或注册失效
   *
   * @fires 主动调用 ua.unregister() 或注册因网络/服务端原因失效时触发
   *
   * @type {object}
   * @property {string} [cause] - 注销原因描述（如 'Expired'、'Connection Error'）
   *
   * 处理逻辑：更新 regState 为 'unregistered'、更新模式 UI、显示注销原因。
   */
  ua.on('unregistered', function(data)
  {
    setStatus(`已注销${data && data.cause ? `：${data.cause}` : ''}`);
    // 注销后更新状态标签为"未注册"
    regState = 'unregistered';
    updateMode();
  });
}

// =============================================================================
// 通话统计面板
// =============================================================================

// 统计事件中的问题编码保持不变，Demo 只负责转成便于阅读的中文。
const statsIssues = {
  CONNECTION_UNAVAILABLE       : '连接不可用',
  CONNECTION_PATH_CHANGED      : '网络路径变化',
  DOWNLINK_HIGH_JITTER         : '下行高抖动',
  DOWNLINK_JITTER_BUFFER_DELAY : '下行缓冲过高',
  DOWNLINK_PACKET_DISCARDS     : '下行本地丢弃',
  DOWNLINK_PACKET_LOSS         : '下行丢包',
  DOWNLINK_TRANSPORT_STALLED   : '下行传输停滞',
  DOWNLINK_FEEDBACK_REQUESTS   : '下行重传请求多',
  ENCODER_CPU_LIMITED          : '编码器 CPU 受限',
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
// 网络质量等级 0-6 对应的中文标签，用于统计面板展示
const qualityText = [ '暂无数据', '极佳', '较好', '一般', '差', '极差', '严重异常' ];

/**
 * 将文本设置到指定 DOM 元素的 textContent。
 * 元素不存在时静默跳过（避免统计面板未渲染时抛错）。
 *
 * @param {string} selector - CSS 选择器，定位目标 DOM 元素
 * @param {string} value - 要显示的文本内容
 */
function setStats(selector, value)
{
  const element = document.querySelector(selector);

  if (element) element.textContent = value;
}

/**
 * 格式化数值，null/undefined 时返回 '-'。
 *
 * @param {number|null|undefined} value - 待格式化的数值
 * @param {string} [unit] - 可选单位后缀（如 'ms'、'%'）
 * @returns {string} 格式化后的字符串，如 '42ms' 或 '-'
 */
function fmtNum(value, unit)
{
  return value === null || value === undefined ? '-' : `${value}${unit || ''}`;
}

/**
 * 格式化码率（bps → kbps），null/undefined 时返回 '-'。
 *
 * @param {number|null|undefined} value - 码率（bps）
 * @returns {string} 格式化后的字符串，如 '1.5kbps' 或 '-'
 */
function fmtRate(value)
{
  return value === null || value === undefined ? '-' : `${(value / 1000).toFixed(1)}kbps`;
}

/**
 * 格式化网络质量等级（数字 → 中文标签），null/undefined 时返回 '-'。
 *
 * @param {number|null|undefined} value - 质量等级索引（0-6），对应 qualityText 数组
 * @returns {string} 格式化后的字符串，如 '极佳(1)' 或 '-'
 */
function fmtQuality(value)
{
  return value === null || value === undefined ? '-' :
    `${qualityText[value] || '未知'}(${value})`;
}

/**
 * 向统计表格容器追加一行数据单元格。
 * 每个值生成一个 span.rtc-stats-cell 元素。
 *
 * @param {HTMLElement} table - 统计表格的容器 DOM 元素
 * @param {string[]} values - 每列的文本值数组
 */
function addStatsRow(table, values)
{
  values.forEach((value) =>
  {
    const cell = document.createElement('span');

    cell.className = 'rtc-stats-cell';
    cell.textContent = value;
    table.appendChild(cell);
  });
}

/**
 * 渲染发送或接收媒体流的详细统计（编码、码率、抖动、丢包、画面、FPS 等）。
 * 按音频优先、MID 数字顺序排序，便于与 SDP 媒体行对照排查。
 *
 * @param {string} selector - 统计容器 CSS 选择器
 * @param {Array} streams - 媒体流统计对象数组（来自 stats:detailed-report）
 * @param {boolean} outbound - true 为发送（outbound），false 为接收（inbound）
 */
function renderMedia(selector, streams, outbound)
{
  const element = document.querySelector(selector);

  if (!element) return;

  // 固定按音频、视频、MID 排序，便于和 SDP 中的媒体行对照。
  const sorted = (streams || []).slice().sort((left, right) =>
  {
    const leftKind = left.kind || left.type;
    const rightKind = right.kind || right.type;

    if (leftKind !== rightKind) return leftKind === 'audio' ? -1 : 1;

    return String(left.mid === null ? '' : left.mid).localeCompare(
      String(right.mid === null ? '' : right.mid), undefined, { numeric: true }
    );
  });

  element.textContent = '';
  if (sorted.length === 0)
  {
    element.textContent = '无';

    return;
  }

  const table = document.createElement('div');

  table.className = 'rtc-stats-metric-table';
  sorted.forEach((stream) =>
  {
    const streamName = (stream.kind || stream.type) === 'audio' ? '音频' : '视频';
    const feedback = stream.remoteInbound;
    const bitrate = outbound ? stream.actualBitrateBps : stream.receiveBitrateBps;
    const jitter = outbound ? feedback && feedback.jitterMs : stream.jitterMs;
    const loss = outbound ? feedback && feedback.intervalLossPercent : stream.intervalLossPercent;

    addStatsRow(table, [
      `${streamName}[${stream.mid === null || stream.mid === undefined ? '-' : stream.mid}]`,
      `编码:${stream.codec && stream.codec.name ? stream.codec.name : '-'}`,
      `码率:${fmtRate(bitrate)}`,
      `抖动:${fmtNum(jitter, 'ms')}`,
      `丢包:${fmtNum(loss, '%')}`
    ]);

    if (streamName === '视频')
    {
      const hasSize = stream.frameWidth !== null && stream.frameWidth !== undefined &&
        stream.frameHeight !== null && stream.frameHeight !== undefined;

      addStatsRow(table, [
        '',
        `画面:${hasSize ? `${stream.frameWidth}x${stream.frameHeight}` : '-'}`,
        `FPS:${fmtNum(stream.framesPerSecond)}`,
        outbound ? `编码:${fmtNum(stream.averageEncodeTimeMs, 'ms')}` :
          `解码:${fmtNum(stream.averageDecodeTimeMs, 'ms')}`,
        outbound ? `限制:${stream.qualityLimitationReason || '-'}` : ''
      ]);
    }
  });
  element.appendChild(table);
}

/**
 * 渲染连接层统计（连接状态、ICE 状态、DTLS 状态、收发带宽）。
 *
 * @param {object} connection - stats:detailed-report 中的 connection 字段
 */
function renderConn(connection)
{
  const element = document.querySelector('#statsConn');

  if (!element) return;

  const table = document.createElement('div');

  table.className = 'rtc-stats-connection-table';
  addStatsRow(table, [
    `状态:${connection.connectionState || '-'}`,
    `ICE:${connection.iceConnectionState || '-'}`,
    `DTLS:${connection.dtlsState || '-'}`
  ]);
  addStatsRow(table, [
    `↑:${fmtRate(connection.sendBitrateBps)}/可用${fmtRate(connection.availableOutgoingBitrateBps)}`,
    `↓:${fmtRate(connection.receiveBitrateBps)}/可用${fmtRate(connection.availableIncomingBitrateBps)}`,
    ''
  ]);
  element.textContent = '';
  element.appendChild(table);
}

/**
 * 展示 RTCSession 的详细统计。点对点和三方会话共用此函数。
 *
 * @param {object} session - RTCSession 实例，用于去重校验
 *   （仅当传入 session 与当前 statsCall 相同时才渲染，避免旧会话覆盖新会话统计）
 * @param {object} report - stats:detailed-report 事件中的详细报告对象
 */
function renderStats(session, report)
{
  if (!report || statsCall !== session) return;

  const quality = report.quality || {};
  const issues = (quality.issues || []).map((issue) =>
    `${statsIssues[issue.code] || issue.code}(L${issue.severity})`).join(' | ');

  renderMedia('#statsOut', report.outbound, true);
  renderMedia('#statsIn', report.inbound, false);
  renderConn(report.connection || {});
  setStats('#statsQuality',
    `RTT:${fmtNum(quality.RTT, 'ms')} | ` +
    `↑:${fmtQuality(quality.uplinkNetworkQuality)} | ` +
    `↓:${fmtQuality(quality.downlinkNetworkQuality)}`);
  setStats('#statsIssues', issues || '无');
}

/**
 * 重置所有统计面板显示为占位符（'--' / '无'）。
 * 在会话结束后调用，避免残留上一通通话的统计数据。
 */
function resetStats()
{
  [ '#statsConn', '#statsQuality', '#statsOut', '#statsIn' ]
    .forEach((selector) => setStats(selector, '--'));
  setStats('#statsIssues', '无');
}

// =============================================================================
// 屏幕共享画面渲染
// =============================================================================

/**
 * 在共享浮层中展示本端或远端屏幕共享画面。
 * 同时启动标注（startInk）并打开共享浮层（openShareBox）。
 *
 * @param {MediaStream} stream - 屏幕共享的媒体流
 * @param {'local'|'remote'} mode - 共享来源：'local' 显示在本端预览窗口，
 *   'remote' 显示在远端画面窗口
 */
// 屏幕共享统一使用同一个浮层。mode 为 local 时显示本端预览，为 remote 时显示远端画面。
function showShare(stream, mode)
{
  const video = document.querySelector(mode === 'local' ? '#screen' : '#shareVid');

  video.srcObject = stream;
  video.className = 'screen-share-dialog-video';
  if (typeof startInk === 'function') startInk(mode);
  if (typeof openShareBox === 'function') openShareBox(mode);
}

/**
 * 隐藏共享画面，清除 srcObject 并添加 hide CSS 类。
 * 同时停止标注（stopInk）并关闭共享浮层（closeShareBox）。
 *
 * @param {'local'|'remote'} mode - 要隐藏的共享来源
 */
function hideShare(mode)
{
  const video = document.querySelector(mode === 'local' ? '#screen' : '#shareVid');

  video.srcObject = null;
  video.className = 'screen-share-dialog-video hide';
  if (typeof stopInk === 'function') stopInk(mode);
  if (typeof closeShareBox === 'function') closeShareBox(mode);
}

/**
 * 监听屏幕共享轨道的结束事件，清理预览画面。
 *
 * 部分浏览器不触发 MediaStreamTrack 的 ended 事件（如 Chrome 通过浏览器
 * 原生 UI 停止共享时），因此提供 poll 参数启用额外的 readyState 轮询作为
 * 兜底兼容方案。
 *
 * @param {MediaStream} stream - 屏幕共享的媒体流
 * @param {boolean} poll - 是否额外每 100ms 轮询 track.readyState 作为兼容兜底
 */
// 部分浏览器不触发 ended，双流分享额外轮询轨道状态作为兼容处理。
function watchShare(stream, poll)
{
  const track = stream.getVideoTracks()[0];
  let timer;
  const stop = function()
  {
    if (timer) clearInterval(timer);
    hideShare('local');
  };

  track.addEventListener('ended', stop);
  if (poll)
  {
    timer = setInterval(() =>
    {
      if (track.readyState === 'ended') stop();
    }, 100);
  }
}

/**
 * mediaEffectsIssue 事件回调（点对点和三方共用）。
 * 媒体效果管线出现异常时（如虚拟背景初始化失败、水印渲染错误等），
 * 通过此回调在控制台告警并更新页面状态栏，便于开发者快速定位问题。
 *
 * @param {object} d - SDK 事件对象
 * @param {string} [d.module] - 发生异常的媒体效果模块名称
 * @param {string} [d.message] - 异常描述信息
 */
function onFxIssue(d)
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
 * newRTCSession 在呼入或呼出通话时触发（SIP INVITE 发送或接收）。
 * 事件对象关键字段：
 * - originator: 'local'（本端发起）或 'remote'（远端呼入）
 * - session: 通话的 RTCSession 实例
 * - request: 请求对象，远端呼入时可从此获取随路数据和呼叫模式
 *
 * 三方模式下此函数不会被调用（由 onConfSession 接管）。
 * 除常规的呼叫/接听逻辑外，还包括：
 * - 通过 SDK remoteShared/remoteUnShared 事件渲染远端共享
 * - 点对点模式下的 stats 面板标签设置
 * - 会话交接：已有会话时按冲突策略处理（终止新会话或排队为 tmpSession）
 * - 远端呼入时提取主叫号码并显示通知
 */
function onSession(e)
{
  // 输出完整会话对象用于调试
  console.warn('nsession: ', e);
  // 检测远端设备的操作系统类型（用于后续兼容处理）
  console.warn('dOS: ', getRemoteOs(e.request));

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

  // 标注消息属于当前 RTCSession。这里只绑定已被 Demo 接管的会话，避免被 486
  // 拒绝的额外来电在 failed 事件中误清理当前白板。
  if ((e.session === rtcSession || e.session === tmpSession) &&
    typeof bindInk === 'function')
  {
    bindInk(e.session);
  }

  // ---- 远端呼入处理 ----
  if (e.originator === 'remote')
  {
    // 从请求中提取主叫号码
    remoteNo = e.request.from.uri.user;
    document.querySelector('#callee').value = remoteNo;

    // 根据请求模式显示对应的呼叫通知
    setStatus(`收到${e.request.mode === 'video' ? '视频' : '音频'}呼叫`);
    showNotice(e.request.mode, remoteNo);
    // 可通过 request.getHeader(param) 获取随路数据
    // setStatus(`收到 x-data: ${e.request.getHeader('x-data')}`);
  }

  statsCall = e.session;
  setStats('#statsPc', '点对点 PeerConnection');
  setStats('#statsOutLabel', '本端 → 远端:');
  setStats('#statsInLabel', '远端 → 本端:');
  resetStats();

  // 推荐从 RTCSession 消费统计事件
  e.session.on('stats:detailed-report', function(report)
  {
    renderStats(e.session, report);
  });

  // 统计失败不会中断通话，业务只需按需记录。
  e.session.on('stats:stats-error', function(error)
  {
    if (statsCall === e.session)
    {
      console.warn('[RTCStatsMonitor] stats-error:', error);
    }
  });

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
    clearStreams();
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
   * 部分场景下取消保持后可能无法自动恢复媒体，因此这里主动调用 showStreams。
   */
  e.session.on('unhold', function(d)
  {
    setStatus(`${d.originator} unhold`);

    // 重新获取并渲染媒体流
    showStreams(e.session.connection);
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
   * - 重新获取媒体流渲染
   */
  e.session.on('mode', function(d)
  {
    setStatus(`mode: ${d.mode}`);

    // 更新当前通话模式
    curMode = d.mode;

    // 模式切换后重新获取媒体流
    showStreams(e.session.connection);
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
    localVid.srcObject = cloneStream;

    // 延迟播放兼容不同浏览器的自动播放策略
    setTimeout(() =>
    {
      localVid.play();
    }, 100);
  });

  /**
   * remoteShared — 远端开始共享
   *
   * BFCP 共享和本次新增的非 BFCP 辅流共享都会由 SDK 归一化为该事件。
   * 对于辅流，SDK 已经在内部完成 SIP INFO MID 与 track 的乱序匹配；Demo
   * 不需要监听 PeerConnection.track，也不需要解析 screen-share INFO。
   *
   * @fires 远端发起屏幕/元素共享且共享视频轨已就绪时触发
   * @param {Object} d 共享事件数据
   * @param {MediaStream} d.sharedStream.videoStream 可直接绑定到 video.srcObject 的视频流
   * @param {string} [d.mid] 非 BFCP 辅流的 m-line MID；普通 UI 无需使用
   */
  e.session.on('remoteShared', function(d)
  {
    showShare(d.sharedStream.videoStream, 'remote');
  });

  /**
   * remoteUnShared — 远端停止共享
   *
   * stop INFO、远端共享 track ended 或 BFCP FloorRelease 都由 SDK 统一转换为该事件。
   * 页面只清理展示状态，不直接操作远端 transceiver 或 MediaStreamTrack。
   *
   * @fires 远端停止共享时触发
   */
  e.session.on('remoteUnShared', function()
  {
    hideShare('remote');
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
    e.session.on('mediaEffectsIssue', onFxIssue);
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
   * - 清理通知和通话状态
   * - 停止录音和统计
   * - 清理自定义流和 AiNS 验证器
   */
  e.session.on('failed', function(d)
  {
    closeNotice();
    videoOnly = false;
    remoteNo = undefined;
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

    if (statsCall === e.session)
    {
      statsCall = null;
      resetStats();
    }

    // 停止 iOS OPTIONS 保活定时器
    keepTimer && clearInterval(keepTimer);

    // 清理 UI：恢复远端视频区域布局，关闭共享浮层
    document.querySelector('#remoteVid').classList = 'h-100';
    document.querySelector('#shareVid').className = 'screen-share-dialog-video hide';
    if (typeof closeShareBox === 'function') closeShareBox();

    // 清理自定义媒体流（用 SDK closeMediaStream 统一释放，避免轨道泄漏）
    CRTC.Utils.closeMediaStream(callStream);
    callStream = new MediaStream();

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
   * - 清理通知、状态和录音
   * - 如果有排队的临时会话（tmpSession），则切换到该会话
   * - 否则完全清理通话状态
   */
  e.session.on('ended', function(d)
  {
    closeNotice();
    videoOnly = false;
    remoteNo = undefined;
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

    if (statsCall === e.session)
    {
      statsCall = null;
      resetStats();
    }

    // ---- 会话交接逻辑 ----
    // 如果结束的是主会话且有排队的 tmpSession，切换到该会话
    if (rtcSession === e.session && Boolean(tmpSession))
    {
      // 停止当前渲染，切换到临时会话的媒体流
      clearStreams();
      showStreams(tmpSession.connection);
    }
    else
    {
      // 无排队的会话，完全清理
      tmpSession = null;
      rtcSession = null;
    }
    keepTimer && clearInterval(keepTimer);

    // 清理 UI：恢复视频布局并关闭共享浮层
    document.querySelector('#remoteVid').classList = 'h-100';
    document.querySelector('#shareVid').className = 'screen-share-dialog-video hide';
    if (typeof closeShareBox === 'function') closeShareBox();

    // 清理自定义媒体流（用 SDK closeMediaStream 统一释放，避免轨道泄漏）
    CRTC.Utils.closeMediaStream(callStream);
    callStream = new MediaStream();

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
    // 白板/屏幕标注由 app-annotation.js 独立校验和处理，避免通用 INFO 状态栏
    // 输出整段坐标数据。其他历史 INFO 行为保持不变。
    if (d.info && String(d.info.contentType || '').toLowerCase()
      .indexOf('application/vnd.crtc.annotation+json') === 0)
    {
      return;
    }

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
          video : getVideoOpts()
        },
        pcConfig : getAnswerPc()
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
    if (confirmed && !hasCamera)
    {
      d.reject();
    }
    else
    {
      d.accept(getVideoOpts());
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
    closeNotice();
    console.warn('dOS: ', getRemoteOs(d.response));
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
   */
  e.session.on('confirmed', async function()
  {
    closeNotice();

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
    showStreams(e.session.connection);
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
        audio : getAudioOpts(),
        video : false // 不采集视频
      },
      pcConfig             : getAnswerPc(),
      // 随路数据：注意 'X' 大写及 ':' 后面的空格
      extraHeaders         : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints  : { offerToReceiveAudio: true },
      extraFeatures        : features,
      mediaEffectsComposer : getFxOpts(),
      aiNoiseSuppression   : getNsOpts()
    });

    setStatus('audio answer');
  };

  /**
   * answerVideo — 视频接听
   *
   * 同时采集音频和视频，使用当前的 videoOpts。
   */
  document.querySelector('#answerVideo').onclick = function()
  {
    e.session.answer({
      mediaConstraints : {
        audio : getAudioOpts(),
        video : getVideoOpts()
      },
      pcConfig             : getAnswerPc(),
      extraHeaders         : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints  : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures        : features,
      mediaEffectsComposer : getFxOpts(),
      aiNoiseSuppression   : getNsOpts()
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
        video : getVideoOpts()
      },
      pcConfig            : getAnswerPc(),
      extraHeaders        : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures       : features,
      mediaStream         : tmpStream // 使用自定义的静默音频流
    });

    setStatus('video answer');
  };

  /**
   * ansVideoOnly — 单视频接听（无音频采集）
   *
   * 仅采集视频，不采集麦克风。设置 videoOnly 标志。
   */
  document.querySelector('#ansVideoOnly').onclick = async function()
  {
    videoOnly = true;
    e.session.answer({
      mediaConstraints : {
        audio : false, // 不采集音频
        video : getVideoOpts()
      },
      pcConfig            : getAnswerPc(),
      extraHeaders        : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures       : features
    });

    setStatus('video answer');
  };

  /**
   * answerBlack — 自定义黑屏视频接听（无音频）
   *
   * 使用黑色占位视频轨道（无摄像头图标）代替真实摄像头。
   * 不采集音频。适用于仅需展示占位视频的场景。
   */
  document.querySelector('#answerBlack').onclick = async function()
  {
    const tmpStream = new MediaStream();

    // 生成黑色占位视频轨道（仅首次创建）
    tmpStream.addTrack(getBlackTrack().videoTrack, tmpStream);

    e.session.answer({
      mediaConstraints : {
        audio : false,
        video : true
      },
      pcConfig            : getAnswerPc(),
      extraHeaders        : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures       : features,
      mediaStream         : tmpStream
    });

    setStatus('video answer');
  };

  /**
   * ansBlackAv — 自定义黑屏视频接听（含音频）
   *
   * 与 answerBlack 相同，但保留真实音频采集。
   */
  document.querySelector('#ansBlackAv').onclick = async function()
  {
    const tmpStream = new MediaStream();

    tmpStream.addTrack(getBlackTrack().videoTrack, tmpStream);

    e.session.answer({
      mediaConstraints : {
        audio : true,
        video : true
      },
      pcConfig            : getAnswerPc(),
      extraHeaders        : [ `X-Data: ${xdata}`, `X-UA: ${navigator.userAgent}` ],
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true },
      extraFeatures       : features,
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
    e.session.upgradeToVideo({ useUpdate: useUpdate, videoConstraints: getVideoOpts() }, () => { setStatus(`切换视频模式完成${curMode}`); });
  };

  /**
   * toBlackSend — 切换为单向视频（自定义黑屏流，仅发送）
   *
   * 使用黑色占位视频轨道，仅发不收。依赖 useUpdate 全局变量。
   */
  document.querySelector('#toBlackSend').onclick = function()
  {
    const tmpStream = new MediaStream();

    tmpStream.addTrack(getBlackTrack().videoTrack, tmpStream);

    e.session.upgradeToVideo({ sendOnly: true, useUpdate: useUpdate, videoStream: tmpStream }, () => { setStatus('切换视频模式完成') + curMode; });
  };

  /**
   * switchVideo — 动态替换视频轨道
   *
   * 通话中将视频发送轨道替换为黑色占位视频，不经过协商。
   */
  document.querySelector('#switchVideo').onclick = function()
  {
    e.session.connection.getSenders().forEach((sender) =>
    {
      if (sender.track.kind === 'video')
      {
        sender.replaceTrack(getBlackTrack().videoTrack).then(() => setStatus('替换成功'));
      }
    });
  };

  /**
   * toVideoSend — 切换为单向视频（真实摄像头，仅发送）
   */
  document.querySelector('#toVideoSend').onclick = function()
  {
    e.session.upgradeToVideo({ sendOnly: true, useUpdate: useUpdate, videoConstraints: getVideoOpts() }, () => { setStatus('切换视频模式完成') + curMode; });
  };

  /**
   * toBlackVideo — 切换为自定义流视频模式（双向）
   *
   * 使用黑色占位视频作为视频源进行双向视频通话。
   */
  document.querySelector('#toBlackVideo').onclick = function()
  {
    const tmpStream = new MediaStream();

    tmpStream.addTrack(getBlackTrack().videoTrack, tmpStream);
    e.session.upgradeToVideo({ useUpdate: useUpdate, videoStream: tmpStream }, () => { setStatus('切换视频模式完成') + curMode; });
  };

  // 摄像头和麦克风的切换已统一在 app-events.js 中处理，
  // 避免同一个元素被多次 addEventListener 导致重复绑定。

  /**
   * switchDevice — 移动端前后摄像头切换
   *
   * 在 'user'（前置）和 'environment'（后置）之间切换。
   * 切换后调用 renegotiate 更新 SDP。
   */
  document.querySelector('#switchDev').onclick = async function()
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
    closeNotice();
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
   * cancelRefer — 取消呼转
   *
   * 通过 SIP INFO 发送 cancel 事件通知对端。
   */
  document.querySelector('#cancelRefer').onclick = function()
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
    const events = {
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
      eventHandlers : events
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
   * shareScreen — 分享屏幕（简单模式）
   *
   * 启动普通屏幕分享，用屏幕轨临时替换当前发送的摄像头轨。
   * 推荐使用 share(type, options) 对象参数，屏幕分享不需要额外 options 字段。
   * 未开启 dual 时沿用原有替换摄像头轨的分享方式。
   */
  document.querySelector('#shareScreen').onclick = function()
  {
    e.session.share('screen', {})
      .then((stream) =>
      {
        showShare(stream, 'local');
        watchShare(stream, false);
      });
  };

  /**
   * shareScreen2 — 分享屏幕（双流模式）
   *
   * 在双流模式下分享屏幕：额外的视频流作为第二路发送。
   * share(type, options) 参数说明：
   *   type: 'screen' — 分享屏幕
   *   dual: true     — BFCP 双流模式，屏幕画面作为独立第二路视频流
   * 包含双重停止检测机制：
   * 1. ended 事件（主流）
   * 2. 定时轮询 readyState（兜底，部分场景 ended 不触发）
   *
   * Safari 兼容：检测到 user gesture 错误时设置 safari_r 标志，
   * 引导用户点击专用的 macOS 分享按钮。
   */
  document.querySelector('#shareScreen2').onclick = function()
  {
    e.session.share('screen', { dual: true })
      .then((stream) =>
      {
        showShare(stream, 'local');
        watchShare(stream, true);
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
   * shareIos — Safari 屏幕分享补救按钮
   *
   * 当首次分享因 Safari 缺少 user gesture 而失败（safari_r 被置为 true）时，
   * 用户需手动点击此按钮以提供用户手势上下文，重新发起分享。
   * share(type, options) 参数说明：
   *   type: 'screen' — 分享屏幕
   *   dual: true     — 双流模式
   *   skip: true     — 跳过 BFCP 握手（Safari 兼容），直接发起屏幕分享
   */
  document.querySelector('#shareIos').onclick = function()
  {
    if (safari_r)
    {
      safari_r = false;
      e.session.share('screen', { dual: true, skip: true })
        .then((stream) =>
        {
          showShare(stream, 'local');
          watchShare(stream, true);
        })
        .catch((err) =>
        {
          console.warn('err: ', err);
        });
    }
  };

  /**
   * shareHtml / shareHtmlDual — 分享 HTML 元素
   *
   * share(type, options) 参数说明：
   *   type: 'html'        — 分享页面 HTML 元素
   *   id: '#ele'          — 要分享的 DOM 元素 CSS 选择器
   *   assembly: html2canvas — 将 DOM 元素渲染为 Canvas 的函数
   *   dual: true/false    — 是否双流模式（D 后缀版本传 true）
   * 依赖 html2canvas.js 将 DOM 元素渲染为视频流。
   */
  document.querySelector('#shareHtml').onclick = function()
  {
    e.session.share('html', { id: '#ele', assembly: html2canvas });
  };
  document.querySelector('#shareHtmlDual').onclick = function()
  {
    e.session.share('html', { id: '#ele', assembly: html2canvas, dual: true });
  };

  /**
   * sharePic / sharePicDual — 分享图片
   *
   * share(type, options) 参数说明：
   *   type: 'pic'     — 分享图片元素
   *   id: '#pic_s'    — 图片元素的 CSS 选择器
   *   dual: true/false — 是否双流模式（D 后缀版本传 true）
   */
  document.querySelector('#sharePic').onclick = function()
  {
    e.session.share('pic', { id: '#pic_s' });
  };
  document.querySelector('#sharePicDual').onclick = function()
  {
    e.session.share('pic', { id: '#pic_s', dual: true });
  };

  /**
   * shareVideo / shareVideo2 — 分享视频元素
   *
   * share(type, options) 参数说明：
   *   type: 'video'    — 分享正在播放的 video 元素
   *   id: '#video_s'   — video 元素的 CSS 选择器
   *   dual: true/false — 是否双流模式（D 后缀版本传 true）
   * 需要视频已在播放状态。
   */
  document.querySelector('#shareVideo').onclick = function()
  {
    document.querySelector('#video_s').play()
      .then(() =>
      {
        e.session.share('video', { id: '#video_s' });
      });
  };
  document.querySelector('#shareVideo2').onclick = function()
  {
    document.querySelector('#video_s').play()
      .then(() =>
      {
        e.session.share('video', { id: '#video_s', dual: true });
      });
  };

  /**
   * unshare — 停止屏幕分享
   *
   * 调用 session.unShare() 发起 re-INVITE 移除屏幕视频轨，
   * 同步清理本地共享预览浮层（hideShare），并延迟 300ms 恢复
   * 本地/远端摄像头画面渲染。延迟是为了等待 renegotiation 完成，
   * 避免在 PeerConnection 尚未移除旧轨道时提前读取流。
   */
  document.querySelector('#unshare').onclick = function()
  {
    e.session.unShare();
    hideShare('local');

    setTimeout(() =>
    {
      showStreams(e.session.connection);
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
    const videoEl = document.querySelector('#remoteVid');
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

    const emptyEl = document.getElementById('captureEmpty');
    const panel = document.getElementById('capturePanel');

    if (emptyEl)
    {
      emptyEl.classList.add('hide');
    }

    if (panel)
    {
      panel.classList.add('has-capture');
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
  // 仅点对点模式可用；三方模式使用 callConf 等专用入口。
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
    extraFeatures : features,
    pcConfig      : pcConfig,
    eventHandlers : {
      mediaEffectsIssue : onFxIssue
    }
  };

  // ---- 媒体方向控制 ----
  if (direction === 'sendonly')
  {
    // 仅发送模式：不接收远端视频
    options.rtcOfferConstraints = { offerToReceiveAudio: true, offerToReceiveVideo: false };
    // 纯视频 + 仅发送：音频也不接收
    if (type === 'onlyVideo')
    {
      options.rtcOfferConstraints = { offerToReceiveAudio: false, offerToReceiveVideo: false };
    }
  }

  // ---- 媒体流选择：自定义流优先于媒体约束 ----
  if (mediaStream)
  {
    // 使用传入的自定义媒体流
    options.mediaStream = mediaStream;
  }
  else
  {
    // 使用媒体约束让浏览器自动采集
    options.mediaConstraints = {
      audio : getAudioOpts(),
      // 仅 video 和 onlyVideo 类型需要视频
      video : (type === 'video' || type === 'onlyVideo') ? getVideoOpts() : false
    };
  }

  // ---- 屏幕分享模式：采集屏幕 + 麦克风 ----
  if (type === 'screen')
  {
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio : options.mediaConstraints.audio,
      video : false
    });

    // 自定义流直接传给 ua.call()，包含屏幕视频轨和麦克风音频轨。
    callStream.addTrack(screen.getVideoTracks()[0]);
    callStream.addTrack(audioStream.getAudioTracks()[0]);
    delete options.mediaConstraints;
    options.mediaStream = callStream;
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
    getBlackTrack();

    window.novideo = blackVideo;

    // callnullvideo 或 callnull：附加黑屏视频轨道
    if (type === 'callnullvideo' || type === 'callnull') tmpStream.addTrack(blackVideo.videoTrack, tmpStream);

    options.mediaStream = tmpStream;

    // 同时指定媒体约束作为 fallback（系统麦克风和摄像头）
    options.mediaConstraints = {
      audio : type === 'callnullvideo' ? true : false,
      video : type === 'callnullaudio' ? videoOpts : true
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

    // 呼叫前读取页面当前选择的媒体效果和降噪参数。
    options.mediaEffectsComposer = getFxOpts();
    options.aiNoiseSuppression = getNsOpts();

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
        remoteAud.srcObject = event.streams[0];

        // Chrome 自动播放策略兼容：必须 catch 否则可能抛出 NotAllowedError
        remoteAud.play()
          .catch(() => { });
      }
    };

    // ---- 外呼阶段取消按钮（newRTCSession 触发前有效） ----
    document.querySelector('#cancel').onclick = function()
    {
      closeNotice();
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
        localVid.srcObject = null;
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
  if (keepTimer)
  {
    clearInterval(keepTimer);
  }

  if (navigator.userAgent.indexOf('iPhone') != -1)
  {
    keepTimer = setInterval(() =>
    {
      ua.sendOptions(`sip_ping@${sipDomain}`);
    }, 3000);
  }
}

// =============================================================================
// 页面级通话操作
//
// app-events.js 只负责把静态页面控件绑定到这些具名操作。这里集中维护
// UA 注册状态、设备选择和通话协商选项，避免页面绑定入口承载通话逻辑。
// =============================================================================

/**
 * 主动注册当前 UA。
 * 初始化时 UA 会自动注册；该操作用于主动注销后重新注册。
 */
function registerUa()
{
  if (!ua)
  {
    setStatus('请先选择点对点或三方模式');

    return;
  }
  if (!ua.isConnected())
  {
    setStatus('信令尚未连接，不能注册');

    return;
  }
  if (ua.isRegistered())
  {
    setStatus('当前账号已经注册');

    return;
  }

  setStatus('正在主动注册');
  regState = 'registering';
  updateMode();
  ua.register();
}

/**
 * 主动注销当前 UA，保留 WSS 连接以便再次注册。
 */
function unregisterUa()
{
  if (!ua)
  {
    setStatus('请先选择点对点或三方模式');

    return;
  }
  if (!ua.isRegistered())
  {
    setStatus('当前账号尚未注册');

    return;
  }

  setStatus('正在主动注销');
  ua.unregister();
}

/**
 * 保存摄像头选择；通话中立即通过 RTCSession.switchDevice() 热切换。
 * 切换前停止 MCU 等候室场景遗留的克隆视频轨道。
 *
 * @param {HTMLSelectElement} selectEl - 摄像头选择框
 */
function changeCamera(selectEl)
{
  const option = selectEl.options[selectEl.selectedIndex];

  cameraId = option.value;

  if (rtcSession)
  {
    if (cloneStream)
    {
      cloneStream.getVideoTracks().forEach((track) => track.stop());
    }
    rtcSession.switchDevice('camera', cameraId);
  }

  setStatus(`${rtcSession ? 'switchDevice' : 'select camera'} ${option.innerText}`);
}

/**
 * 保存麦克风选择；通话中立即通过 RTCSession.switchDevice() 热切换。
 *
 * @param {HTMLSelectElement} selectEl - 麦克风选择框
 */
function changeMic(selectEl)
{
  const option = selectEl.options[selectEl.selectedIndex];

  micId = option.value;

  if (rtcSession)
  {
    rtcSession.switchDevice('audio', micId);
  }

  setStatus(`${rtcSession ? 'switchDevice' : 'select mic'} ${option.innerText}`);
}

/**
 * 选择音视频升级时使用 SIP UPDATE 还是 re-INVITE。
 *
 * @param {HTMLSelectElement} selectEl - 协商方式选择框
 */
function changeUpdateMode(selectEl)
{
  const option = selectEl.options[selectEl.selectedIndex];

  useUpdate = option.value === 'update';
  console.log(option);
  setStatus(`${useUpdate ? 'useUpdate' : 'useReInvite'}`);
}

/**
 * 发起纯视频呼叫，并保存纯视频模式供后续 mute/unmute 使用。
 *
 * @param {'sendonly'|undefined} direction - 传 'sendonly' 时仅发送视频
 */
function callVideoOnly(direction)
{
  videoOnly = true;
  call('onlyVideo', direction);
}

/**
 * 页面卸载前主动停止 UA，避免将正常关闭误判为网络断开。
 */
function stopUaBeforeUnload()
{
  handleStop = true;
  if (ua) ua.stop();
}

/**
 * 页面初始化
 *
 * 页面加载时只做三件事：
 * 1. 输出 SDK 版本号
 * 2. 预采集一次媒体权限以填充设备列表
 * 3. 提示用户选择"点对点"或"三方"模式
 *
 * UA 的创建、信令连接和注册在用户点击模式按钮后由 initMode() 执行。
 * 静态页面控件在 app-events.js 中统一绑定，具体通话操作由本文件实现。
 */
async function initPage()
{
  setStatus(`${CRTC.version}`);

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function')
  {
    setStatus('当前浏览器不支持媒体设备采集');

    return;
  }

  let mediaStream;
  let captureError;

  try
  {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  }
  catch (error)
  {
    captureError = error;
  }
  finally
  {
    // 预采集只用于请求权限，设备列表加载失败时也必须立即释放轨道。
    if (mediaStream) CRTC.Utils.closeMediaStream(mediaStream);
  }

  let deviceError;

  try
  {
    await loadDevices();
  }
  catch (error)
  {
    deviceError = error;
  }

  if (captureError)
  {
    setStatus(`预采集失败: ${captureError.name || captureError.message || 'unknown'}`);

    return;
  }

  if (deviceError)
  {
    setStatus(`设备列表加载失败: ${deviceError.name || deviceError.message || 'unknown'}`);

    return;
  }

  setStatus('请选择三方或点对点模式');
}

/**
 * 根据当前 appMode 和 regState 刷新页面 UI。
 *
 * 负责：
 * - 更新顶部模式/注册状态标签（"点对点 · 已注册" 等）
 * - 禁用/启用"点对点"/"三方"选择按钮
 * - 禁用/启用点对点专属按钮（data-mode="point-to-point"、呼叫/接听按钮组）
 * - 三方模式下禁用呼转输入框和操作按钮
 * - 展开/收起会议面板（三方模式首次选择时自动展开）
 * - 切换会议面板的帮助文字和控件可见性
 * - 同步调用三方模块的 updateConfUi（如果已加载）
 *
 * 此函数在注册状态变化和模式切换时被多处调用，是页面状态同步的中心入口。
 */
function updateMode()
{
  const modeLabel = document.querySelector('#modeLabel');
  const pointButton = document.querySelector('#initP2p');
  const confBtn = document.querySelector('#initConf');
  const confPanel = document.querySelector('#confPanel');
  const confSummary = document.querySelector('#confSummary');
  const p2pOnly = document.querySelectorAll(
    '[data-mode="point-to-point"], #p2pCall button, #p2pAnswer button'
  );
  const transferControls = document.querySelectorAll('#refer, #referBtn, #cancelRefer');
  const confActive = document.querySelector('#confActive');
  const confHelp = document.querySelector('#confHelp');

  if (modeLabel)
  {
    const modeName = appMode === 'conference' ? '三方 A' : '点对点';
    const stateText = regState === 'registered' ? '已注册' :
      (regState === 'registering' ? '注册中' : '未注册');

    modeLabel.textContent = appMode ? `${modeName} · ${stateText}` : '尚未注册';
    modeLabel.classList.toggle('is-active', regState === 'registered');
    modeLabel.classList.toggle('is-pending', regState === 'registering');
  }
  if (pointButton) pointButton.disabled = Boolean(appMode);
  if (confBtn) confBtn.disabled = Boolean(appMode);

  p2pOnly.forEach((element) =>
  {
    element.disabled = appMode !== 'point-to-point';
  });
  transferControls.forEach((element) =>
  {
    element.disabled = appMode === 'conference';
  });

  if (confPanel)
  {
    if (appMode === 'conference' && confPanel.dataset.autoOpened !== 'true')
    {
      confPanel.open = true;
      confPanel.dataset.autoOpened = 'true';
    }
    else if (appMode !== 'conference')
    {
      confPanel.open = false;
      delete confPanel.dataset.autoOpened;
    }
    confPanel.classList.toggle('conference-inactive', appMode !== 'conference');
  }
  if (confSummary)
  {
    confSummary.textContent = appMode === 'conference' ?
      '三方会议（A 作为媒体桥接端）' : '三方会议（选择三方模式后启用）';
  }
  if (confActive) confActive.classList.toggle('hide', appMode !== 'conference');
  if (confHelp) confHelp.classList.toggle('hide', appMode === 'conference');
  if (typeof updateConfUi === 'function') updateConfUi();
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
 * 2. 三方模式需确认 onConfSession 已加载
 * 3. 创建 WebSocket 信令传输和 UA 实例
 * 4. 绑定共用 UA 事件 + 模式对应的 newRTCSession 处理函数
 * 5. 重置断网状态并调用 ua.start()
 * 6. 10 秒后检测连接/注册状态，超时则停止 UA
 */
function initMode(mode)
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
  if (mode === 'conference' && typeof onConfSession !== 'function')
  {
    setStatus('三方模块尚未加载');

    return;
  }

  appMode = mode;
  // 创建 UA 后立即进入"注册中"状态，页面标签显示蓝色"注册中"
  regState = 'registering';
  const socket = new CRTC.WebSocketInterface(signalingUrl);
  const config = getUaOpts(socket);

  ua = new CRTC.UA(config);
  bindUa();
  // 按模式绑定不同的 newRTCSession 处理函数：点对点 vs 三方
  ua.on('newRTCSession', mode === 'conference' ?
    onConfSession : onSession);

  // 重置断网状态（每次新建 UA 时都从干净状态开始）
  handleStop = false;
  endBy = null;
  // 刷新页面 UI：禁用模式选择按钮、展开/收起会议面板等
  updateMode();
  setStatus(`正在注册${mode === 'conference' ? '三方' : '点对点'}模式`);
  ua.start();

  // 闭包捕获当前 UA 引用，防止 setTimeout 时 ua 已被重新赋值。
  const newUa = ua;

  setTimeout(() =>
  {
    // 10 秒后如果 UA 已被重新赋值（虽然当前不支持切换模式），则跳过检测
    if (newUa !== ua)
    {
      return;
    }
    if (!newUa.isConnected() || !newUa.isRegistered())
    {
      newUa.stop();
      regState = 'unregistered';
      updateMode();
      setStatus('网络连接异常或未注册成功');
    }
  }, 10000);
}

// =============================================================================
// 应用入口
// =============================================================================

// 页面只初始化 UI 和设备列表；UA 必须由用户选择模式后创建。
initPage();
updateMode();
