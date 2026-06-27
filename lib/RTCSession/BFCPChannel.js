const Logger = require('../Logger');
const CRTC_C = require('../Constants');
const Utils = require('../Utils');
const BFCPLib = require('../BFCP/index');

const logger = new Logger('RTCSession:BFCPChannel');
const BFCPUser = BFCPLib.User;
const Primitive = BFCPLib.Primitive;
const AttributeName = BFCPLib.AttributeName;
const RequestStatusValue = BFCPLib.RequestStatusValue;

// 用于将 SDP 中 DataChannel 媒体描述替换为 BFCP 媒体描述
const SDP_DATA_CHANNEL_MEDIA = 'UDP/DTLS/SCTP webrtc-datachannel';
const SDP_BFCP_MEDIA = 'UDP/DTLS/SCTP/BFCP *';

/**
 * BFCPChannel —— BFCP 协议 + DataChannel 封装模块。
 *
 * 把原本散落在 RTCSession 中的 BFCP 状态管理、DataChannel 生命周期、
 * BFCP 消息协议（Hello / FloorRequest / FloorRelease / FloorRequestStatus / FloorStatus）、
 * SDP 属性注入及 BFCP 音频混音等逻辑集中收敛到一个文件。
 *
 * 使用方式与现有子模块（DTMF.js, Info.js）一致：
 *   - RTCSession 构造函数中创建 `this._bfcp = new BFCPChannel(this)`
 *   - 通过 getter 访问状态：`this._bfcp.enabled`、`this._bfcp.floorctrl` 等
 *   - 通过方法操作：`this._bfcp.init(...)`、`this._bfcp.sendFloorRequest()` 等
 *
 * @param {RTCSession} session - 所属的 RTCSession 实例，用于访问连接、UA、事件发射等
 */
module.exports = class BFCPChannel
{
  constructor(session)
  {
    this._session = session;

    // ── DataChannel 状态 ──
    this._dataChannel = null; // RTCDataChannel 实例
    this._dataChannelName = CRTC_C.BFCP; // DataChannel 名称
    this._dataChannelReady = false; // DataChannel 是否就绪
    this._dataChannelConfig = { ordered: false, maxRetransmits: 0 }; // 乱序，不可靠传输
    this._dataChannelMsgs = {}; // 待响应的 DC 消息映射表（transactionId → {resolve, reject, ...}）

    // ── BFCP 协商状态 ──
    this._enabled = false; // 是否启用 BFCP
    this._bfcpUser = null; // BFCP 协议 User 对象，用于构造/解析消息
    this._floorId = null; // BFCP 控制的 floorId，SDP 协商获得
    this._floorctrl = null; // BFCP 服务类型（c-s / s-only / c-only），根据 SDP 协商修改
    this._mStream = null; // 本端发送给 BFCP 服务器的流的 mid
    this._mstrm = null; // 服务端发送给本端的流的 label，用于获取远端辅流
    this._transceiverIndex = null; // 远端辅流在 PC 中的 transceiver 索引号
    this._bfcpUserId = null; // SDP 协商过程中远端给的 userId
    this._confId = null; // SDP 协商过程中远端给的 confId
    this._floorRequestId = null; // 发送 FloorRequest 后收到的响应里的 requestId，用于释放资源
    this._transactionId = 1; // BFCP 消息事务 ID，每次发送自增
    this._bfcpHeatbeatTimer = null; // BFCP 心跳定时器
    this._bfcpVideoTrack = null; // BFCP 协商时的占位视频轨道，用于后续替换
    this._bfcpStream = null; // BFCP 控制的远端辅流，接通后获取
    this._remoteShared = false; // 远端是否正在共享
    this._requestStatus = null; // 本端 FloorRequest 的响应状态

    // ── BFCP 音频混音 ──
    this._bfcpAudioDestination = null; // AudioContext 混音目标
    this._bfcpAudioSources = []; // 音频源列表
    this._bfcpMediastreams = []; // BFCP 相关 MediaStream 列表，用于清理
    this._bfcpAudioCtx = null; // AudioContext 实例

    // ── DataChannel 关闭状态检测 ──
    this._closingInterval = null; // 检测 DC 卡在 "closing" 状态的定时器
  }

  // ═══════════════════════════════════════════════════════════
  // 公开属性（Getter）
  // ═══════════════════════════════════════════════════════════

  /** 是否启用 BFCP */
  get enabled() { return this._enabled; }

  /** BFCP 服务类型：'c-s' | 's-only' | 'c-only' */
  get floorctrl() { return this._floorctrl; }
  set floorctrl(v) { this._floorctrl = v; }

  /** BFCP 控制的 floorId */
  get floorId() { return this._floorId; }

  /** 本端辅流的 mid */
  get mStream() { return this._mStream; }
  set mStream(v) { this._mStream = v; }

  /** 远端辅流的 label */
  get mstrm() { return this._mstrm; }

  /** BFCP 占位视频轨道 */
  get videoTrack() { return this._bfcpVideoTrack; }

  /** 远端 BFCP 辅流 */
  get stream() { return this._bfcpStream; }

  /** 远端是否正在共享 */
  get remoteShared() { return this._remoteShared; }

  /** 本端 FloorRequest 的响应状态 */
  get requestStatus() { return this._requestStatus; }

  /** 远端辅流在 PC 中的 transceiver 索引 */
  get transceiverIndex() { return this._transceiverIndex; }

  /** BFCP 相关 MediaStream 列表（用于清理） */
  get mediastreams() { return this._bfcpMediastreams; }

  /** DataChannel 是否就绪 */
  get dataChannelReady() { return this._dataChannelReady; }

  // ═══════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════
 
  /**
   * 根据 connect / answer 的 extraFeatures 决定是否启用 BFCP。
   * 如果启用，创建 BFCPUser 实例用于后续消息构造与解析。
   *
   * @param {string[]} extraFeatures - 用户传入的扩展特性列表
   * @param {string}   localUser     - 本端 SIP 用户名
   * @param {string}   remoteUser    - 远端 SIP 用户名
   */
  init(extraFeatures, localUser, remoteUser)
  {
    this._enabled = false;
    if (extraFeatures && extraFeatures.indexOf(CRTC_C.BFCP) !== -1)
    {
      this._enabled = true;
      this._bfcpUser = new BFCPUser(localUser, remoteUser);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SDP 处理
  // ═══════════════════════════════════════════════════════════

  /**
   * 从呼入 INVITE 的 SDP 中解析 floorctrl。
   * 对端发送的值与本端相反：c-s ↔ s-only, c-only ↔ s-only。
   *
   * @param {string} sdpText - 原始 SDP 文本
   */
  parseFloorctrlFromIncomingSDP(sdpText)
  {
    const lines = sdpText.split(/\r?\n/);
    const line = lines.find((l) =>
      l.trim().startsWith('a=floorctrl:') && l.includes(':')
    );

    if (line)
    {
      switch (line.split(':')[1].trim())
      {
        case 'c-s':
        case 'c-only':
          this._floorctrl = 's-only';
          break;
        case 's-only':
          this._floorctrl = 'c-only';
          break;
        default:
          break;
      }
    }
  }

  /**
   * 给外呼 offer SDP 添加 BFCP 属性：
   *   - a=floorctrl
   *   - a=content（主辅流标志）
   *   - 将 DataChannel 媒体替换为 BFCP
   *
   * @param {string} desc - SDP 文本
   * @returns {string} 修改后的 SDP 文本
   */
  addOfferSDPAttributes(desc)
  {
    const floorctrl = this._floorctrl || 'c-s';
    let result = desc.replace(/^(m=application .*\r\n)/mg, `$1a=floorctrl:${floorctrl}\r\n`);

    // 添加主辅流标志
    result = this._addMediastreamFlag(result, this._mStream);

    // 替换 DataChannel 媒体描述为 BFCP
    result = this.replaceDataChannelMediaWithBFCP(result);

    return result;
  }

  /**
   * 给应答 SDP 添加 BFCP 属性。
   * s-only 模式下设置 floorId=2，并添加 floorid / mstrm / confid / userid。
   *
   * @param {string} desc - SDP 文本
   * @returns {string} 修改后的 SDP 文本
   */
  addAnswerSDPAttributes(desc)
  {
    let result = desc;

    if (this._floorctrl === 's-only')
    {
      this._floorId = 2;
      result = result.replace(
        /^(m=application .*\r\n)/mg,
        `$1a=floorctrl:${this._floorctrl}\r\na=floorid:${this._floorId} mstrm:12\r\na=confid:123\r\na=userid:456\r\n`
      );
    }

    result = this.replaceDataChannelMediaWithBFCP(result);

    return result;
  }

  /**
   * 从远端 SDP 应答中解析 BFCP 属性：floorId、floorctrl、confId、userId、mstrm。
   * 同时将 userId 和 confId 写入 BFCPUser 实例。
   *
   * @param {string} sdpText - SDP 文本
   */
  parseAnswerSDP(sdpText)
  {
    this._floorId = Number((sdpText.match(/a=floorid:(\d+)/) || [ null, 1 ])[1]);
    this._floorctrl = ((sdpText.match(/a=floorctrl:([a-z-]+)/) || [ null, '' ])[1] === 's-only')
      ? 'c-only' : 'c-s';
    this._confId = (sdpText.match(/a=confid:(\d+)/) || [ null, '' ])[1];
    this._bfcpUserId = (sdpText.match(/a=userid:(\d+)/) || [ null, '' ])[1];
    this._mstrm = (sdpText.match(/mstrm:(\d+)/) || [ null, '' ])[1];

    // 将协商到的 userId 和 confId 写入 BFCPUser，后续消息构造需要
    if (this._bfcpUser)
    {
      this._bfcpUser.userId = Number(this._bfcpUserId);
      this._bfcpUser.conferenceId = Number(this._confId);
    }
  }

  /**
   * 给 re-INVITE offer SDP 添加 BFCP 属性：floorctrl、floorid、m-stream 及主辅流标志。
   *
   * @param {string} desc - SDP 文本
   * @returns {string} 修改后的 SDP 文本
   */
  addReinviteAttributes(desc)
  {
    let result = desc.replace(
      /^(m=application .*\r\n)/mg,
      `$1a=floorctrl:${this._floorctrl}\r\na=floorid:${this._floorId} m-stream:${this._mStream}\r\n`
    );

    result = this._addMediastreamFlag(result, this._mStream);

    return result;
  }

  /**
   * 给 re-INVITE 应答 SDP 添加 BFCP 属性，并重排 application 媒体顺序。
   *
   * @param {string} desc              - SDP 文本
   * @param {number[]} applicationIndex - 原始 SDP 中 application 媒体的位置
   * @returns {string} 修改后的 SDP 文本
   */
  addReinviteAnswerAttributes(desc, applicationIndex)
  {
    let result = desc;

    if (this._floorctrl === 's-only')
    {
      result = result.replace(
        /^(m=application .*\r\n)/mg,
        `$1a=floorctrl:${this._floorctrl}\r\na=floorid:${this._floorId} mstrm:12\r\na=confid:123\r\na=userid:456\r\n`
      );
    }

    // 适配通用情况下的 SDP H224
    if (applicationIndex && applicationIndex[1] !== -1)
    {
      result += 'm=application 0 UDP/TLS/RTP/SAVPF 100\r\na=rtpmap:100 H224/4800\r\na=inactive\r\n';
    }
    result = Utils.reorderApplicationMedia(result, applicationIndex);

    return result;
  }

  /**
   * 从 re-INVITE 响应中解析 transceiver 索引并获取远端辅流。
   *
   * @param {string} responseBody - 响应 SDP 内容
   */
  parseTransceiverIndex(responseBody)
  {
    this._transceiverIndex = Utils.findLabelIndexByMstrm(responseBody);
    if (this._transceiverIndex && this._transceiverIndex !== -1)
    {
      sessionStorage.setItem(CRTC_C.BFCP_TRANSCEIVER_INDEX, this._transceiverIndex);

      try
      {
        this._bfcpStream = Utils.getStreams(this._session._connection, 'shared');
      }
      catch (error)
      {
        logger.error(`${this._session._id} Failed to set item in sessionStorage:${error}`);
      }
    }
  }

  /**
   * 将 SDP 中 DataChannel 媒体描述替换为 BFCP 媒体描述。
   * 用于 sdp 事件发出前，将 webrtc-datachannel 替换为 BFCP 协议标识。
   *
   * @param {string} sdp - SDP 文本
   * @returns {string}
   */
  replaceDataChannelMediaWithBFCP(sdp)
  {
    return sdp.replace(SDP_DATA_CHANNEL_MEDIA, SDP_BFCP_MEDIA);
  }

  /**
   * 给 SDP 的 video 媒体块添加 a=content 主辅流标志。
   * 根据 mid 判断：匹配 targetMid 的标记为 "slides"，其余为 "main"。
   *
   * @param {string} sdp       - SDP 文本
   * @param {string} targetMid  - 辅流对应的 mid 值
   * @returns {string}
   */
  _addMediastreamFlag(sdp, targetMid)
  {
    if (!targetMid) return sdp;

    const videoPattern = new RegExp('(m=video[\\s\\S]*?^a=mid:(\\d+)\\r?\\n)', 'gm');

    sdp = sdp.replace(videoPattern, (match, p1, mid) =>
    {
      // 根据 mid 设置 content：匹配辅流 mid 的为 slides，其余为 main
      const content = mid === targetMid ? 'slides' : 'main';

      return `${p1}a=content:${content}\r\n`;
    });

    return sdp;
  }

  // ═══════════════════════════════════════════════════════════
  // BFCP 媒体 & DataChannel 初始化
  // ═══════════════════════════════════════════════════════════

  /**
   * 外呼时初始化 BFCP：创建音频混音流，包装为新的 MediaStream。
   *
   * @param {MediaStream} mediaStream - 原始本地媒体流
   * @returns {MediaStream} 混音后的媒体流
   */
  setupForOutgoing(mediaStream)
  {
    const mixedStream = new MediaStream([
      this._createBfcpAudioTrack(mediaStream),
      mediaStream.getVideoTracks()[0]
    ]);

    this._bfcpMediastreams.push(mediaStream);

    return mixedStream;
  }

  /**
   * 外呼时添加 BFCP 占位视频轨道并初始化 DataChannel。
   */
  setupVideoTrackAndDataChannel()
  {
    const connection = this._session._connection;
    const localMediaStream = this._session._localMediaStream;
    const { videoTrack } = Utils.generateAnEmptyVideoTrack();

    this._bfcpVideoTrack = videoTrack;
    connection.addTrack(this._bfcpVideoTrack, localMediaStream);

    this._initDataChannel();
  }

  /**
   * 呼入时添加 BFCP 占位视频轨道，并监听远端 DataChannel。
   */
  setupForIncoming()
  {
    const connection = this._session._connection;
    const localMediaStream = this._session._localMediaStream;
    const { videoTrack } = Utils.generateAnEmptyVideoTrack();

    this._bfcpVideoTrack = videoTrack;
    connection.addTrack(this._bfcpVideoTrack, localMediaStream);
    connection.ondatachannel = (event) => { this._initDataChannel(event); };
  }

  /**
   * 遍历 transceiver 找到画布流对应的 mid，设为 mStream。
   * 用于后续 SDP 中标记辅流。
   */
  findAndSetMStream()
  {
    const connection = this._session._connection;
    let supportedMSTC = false;

    if ('MediaStreamTrackGenerator' in window)
    {
      supportedMSTC = true;
    }

    connection.getTransceivers().forEach((transceiver) =>
    {
      const track = transceiver.sender.track;

      if (!track) return;

      if (supportedMSTC)
      {
        // eslint-disable-next-line no-undef
        if (track instanceof MediaStreamTrackGenerator || this._isCanvasTrack(track))
        {
          this._mStream = transceiver.mid;
          sessionStorage.setItem(CRTC_C.BFCP_SHARED_STREAM_INDEX, transceiver.mid);
        }
      }
      else if (this._isCanvasTrack(track))
      {
        this._mStream = transceiver.mid;
        sessionStorage.setItem(CRTC_C.BFCP_SHARED_STREAM_INDEX, transceiver.mid);
      }
    });
  }

  /**
   * 判断 sender track 是否为 BFCP 占位视频轨道或本地共享轨道。
   * 用于 switchDevice 等场景中排除 BFCP 控制轨道的干扰。
   *
   * @param {MediaStreamTrack} track            - 待判断的轨道
   * @param {MediaStream}      localShareStream  - 本地共享流
   * @returns {boolean}
   */
  isBfcpVideoTrack(track, localShareStream)
  {
    const shareVideoTrack = localShareStream && localShareStream.getVideoTracks
      ? localShareStream.getVideoTracks()[0]
      : null;

    return track === this._bfcpVideoTrack || track === shareVideoTrack;
  }

  // ═══════════════════════════════════════════════════════════
  // BFCP 协议操作
  // ═══════════════════════════════════════════════════════════

  /**
   * 发送 BFCP FloorRequest，请求共享权限。
   *
   * @returns {Promise<Object>} 解析后的 FloorRequestStatus 响应消息
   */
  sendFloorRequest()
  {
    const currentTransactionId = this._transactionId;

    this._transactionId++;
    const floorRequest = this._bfcpUser.floorRequestMessage(currentTransactionId, this._floorId);

    return this._dataChannelSend(floorRequest, currentTransactionId);
  }

  /**
   * 发送 BFCP FloorRelease，释放共享权限。
   */
  sendFloorRelease()
  {
    const currentTransactionId = this._transactionId;

    this._transactionId++;
    const floorRelease = this._bfcpUser.floorReleaseMessage(currentTransactionId, this._floorRequestId);

    return this._dataChannelSend(floorRelease, currentTransactionId);
  }

  /**
   * 发送 BFCP Hello 心跳消息。
   */
  sendHello()
  {
    const currentTransactionId = this._transactionId;

    this._transactionId++;
    const hello = this._bfcpUser.helloMessage(currentTransactionId, this._floorId);

    return this._dataChannelSend(hello, currentTransactionId);
  }

  /**
   * 处理收到的 FloorRequestStatus 响应消息。
   * 内部会发送 FloorRequestStatusAck 确认，并更新本端请求状态。
   * 如果状态为 Granted，会踢掉远端共享（触发 remoteUnShared 事件）。
   *
   * @param {Object} floorResponse - 解析后的 FloorRequestStatus 消息
   * @returns {string} 请求状态值（如 Granted / Denied / Revoked）
   */
  handleFloorRequestStatusMessage(floorResponse)
  {
    this._sendFloorRequestStatusAck(floorResponse);

    const status = floorResponse.getAttribute(AttributeName.FloorRequestInformation)
      .content[1].content[1].content[0];

    this._requestStatus = status;

    // 主动踢掉远端的共享
    this._remoteShared = false;
    this._session.emit('remoteUnShared');

    // 保存 FloorRequestId，用于后续 sendFloorRelease
    this._floorRequestId = floorResponse.getAttribute(AttributeName.FloorRequestInformation).content[0];

    return status;
  }

  // ═══════════════════════════════════════════════════════════
  // BFCP 音频混音
  // ═══════════════════════════════════════════════════════════

  /**
   * 为 BFCP 创建混音音频轨道。
   * 将 mediaStream 的音频输入 AudioContext 混音，返回混音后的 AudioTrack。
   *
   * @param {MediaStream} mediaStream - 需要混音的媒体流
   * @returns {MediaStreamTrack} 混音后的音频轨道
   */
  _createBfcpAudioTrack(mediaStream)
  {
    this._bfcpAudioCtx = new AudioContext();

    const audioSource = this._bfcpAudioCtx.createMediaStreamSource(mediaStream);

    this._bfcpAudioSources.push(audioSource);
    this._bfcpAudioDestination = this._bfcpAudioCtx.createMediaStreamDestination();

    audioSource.connect(this._bfcpAudioDestination);

    return this._bfcpAudioDestination.stream.getAudioTracks()[0];
  }

  /**
   * 将屏幕共享的音频轨道加入 BFCP 混音。
   *
   * @param {MediaStream} mediaStream - 屏幕共享流
   */
  addShareAudioToBfcpAudioTrack(mediaStream)
  {
    const audioSource = this._bfcpAudioCtx.createMediaStreamSource(mediaStream);

    this._bfcpAudioSources.push(audioSource);

    audioSource.connect(this._bfcpAudioDestination);
  }

  /**
   * 销毁 BFCP 混音资源。
   */
  destroyBfcpAudioTrack()
  {
    if (this._bfcpAudioSources.length > 0)
    {
      this._bfcpAudioSources.forEach((audioSource) => audioSource.disconnect());
      this._bfcpAudioSources = [];

      this._bfcpAudioDestination = null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // DataChannel 生命周期
  // ═══════════════════════════════════════════════════════════

  /**
   * 初始化 DataChannel。
   * 外呼方通过 createDataChannel 创建，呼入方通过 ondatachannel 事件接收。
   * 设置 binaryType、onmessage、onopen（启动心跳）、onclose、onerror 等事件处理。
   *
   * @param {Object} [event] - 呼入方的 datachannel 事件对象
   * @returns {RTCDataChannel|undefined}
   */
  _initDataChannel(event)
  {
    logger.debug(`${this._session._id} initDataChannel() ${JSON.stringify(event)}`);

    let datachannel;

    // 呼入方：使用远端创建的 channel
    if (event && event.channel)
    {
      this._dataChannel = datachannel = event.channel;
    }
    // 外呼方：本端创建 DataChannel
    else
    {
      this._dataChannel = datachannel = this._session._connection.createDataChannel(
        this._dataChannelName, this._dataChannelConfig
      );
    }

    // 特殊场景存在 createDataChannel 不成功的问题
    if (!datachannel)
    {
      logger.error(`${this._session._id} Data channel event is missing \`channel\` property`);

      return;
    }

    // 设置二进制传输模式
    datachannel.binaryType = 'arraybuffer';
    this._dataChannelName = datachannel.label;

    // 收到消息
    datachannel.onmessage = (ev) =>
    {
      this._onChannelMessage(ev);
    };

    // DC 打开：开始发送 BFCP Hello 心跳
    datachannel.onopen = () =>
    {
      logger.warn(`${this._session._id} datachannel opened.`);

      this._dataChannelReady = true;
      this.sendHello();
      this._bfcpHeatbeatTimer = setInterval(() =>
      {
        this.sendHello();
      }, CRTC_C.BFCP_HEARTBEAT_INTERVAL);
    };

    // DC 关闭
    datachannel.onclose = () =>
    {
      this._onChannelClose();
    };

    // DC 错误：尝试重连
    datachannel.onerror = (ev) =>
    {
      logger.error(`${this._session._id} datachannel error.`);
      const err = ev.error instanceof Error
        ? ev.error
        : new Error(`Datachannel error: ${ev.message} ${ev.filename}:${ev.lineno}:${ev.colno}`);

      this._dataChannelReady = false;
      logger.warn(`${this._session._id} data err: `, err);

      // 如果 ICE 连接正常则触发重新协商重建 DC
      if (this._session._connection.iceConnectionState === 'connected')
      {
        this._session.renegotiate();
      }
    };

    // Chrome 偶现 DC 卡在 "closing" 状态不触发 onclose，定时检测兜底
    let isClosing = false;

    this._closingInterval = setInterval(() =>
    {
      if (datachannel && datachannel.readyState === 'closing')
      {
        if (isClosing) this._onChannelClose();
        isClosing = true;
      }
      else
      {
        isClosing = false;
      }
    }, CRTC_C.CHANNEL_CLOSING_TIMEOUT);

    return datachannel;
  }

  /**
   * 处理 DataChannel 收到的消息。
   * 先检查是否有已注册的 Promise（事务匹配），再根据 Primitive 类型路由。
   *
   * @param {MessageEvent} event - DataChannel 消息事件
   */
  _onChannelMessage(event)
  {
    logger.debug(`${this._session._id} onChannelMessage()`);

    if (!this._dataChannelReady)
    {
      logger.warn(`${this._session._id} onChannelMessage(): Data channel is not ready, ignoring message.`);

      return;
    }

    const data = event.data;

    if (!(data instanceof ArrayBuffer))
    {
      logger.warn(`${this._session._id} onChannelMessage(): Received non-ArrayBuffer message, ignoring.`);

      return;
    }

    try
    {
      const bufferData = Buffer.from(data);

      logger.debug(`${this._session._id} recv unit8: `, Utils.uint8ArrayToBase64(bufferData));

      // 忽略空心跳包（0002 0000）
      if (Utils.uint8ArrayToBase64(bufferData) === 'AgAAAA==')
      {
        return;
      }

      const message = this._bfcpUser.receiveMessage(bufferData);

      logger.debug(`${this._session._id} BFCP recv: ${JSON.stringify(message)}, Transaction ID: ${message.commonHeader.transactionId}, Timestamp: ${Date.now()}`);

      // 匹配已注册的事务消息（如 FloorRequest / Hello 的响应）
      if (this._dataChannelMsgs[message.commonHeader.transactionId])
      {
        logger.debug(`${this._session._id} bfcp response time: transactionId(${message.commonHeader.transactionId}), time(${Date.now() - this._dataChannelMsgs[message.commonHeader.transactionId].sendAt}ms)`);

        this._dataChannelMsgs[message.commonHeader.transactionId].received = true;
        this._dataChannelMsgs[message.commonHeader.transactionId].resolve(message);
        delete this._dataChannelMsgs[message.commonHeader.transactionId];

        return;
      }

      // 根据消息类型路由到对应处理器
      switch (message.commonHeader.primitive)
      {
        case Primitive.Hello:
          this._handleHelloMessage(message);
          break;

        case Primitive.FloorRequestStatus:
          this._handleFloorRequestStatus(message);
          break;

        case Primitive.FloorStatus:
          this._handleFloorStatus(message);
          break;

        case Primitive.FloorRequest:
          this._handleFloorRequest(message);
          break;

        default:
          logger.debug(`${this._session._id} onChannelMessage(): do not require processing type: ${message.commonHeader.primitive}`);
          break;
      }
    }
    catch (error)
    {
      logger.error(`${this._session._id} onChannelMessage(): Error while processing message.`, error);
    }
  }

  /**
   * DataChannel 关闭后的处理。
   * 如果 ICE 连接正常则触发重新协商重建 DC，否则清理状态。
   */
  _onChannelClose()
  {
    logger.debug(`${this._session._id} datachannel closed.`);

    setTimeout(() =>
    {
      if (this._session._connection && this._session._connection.iceConnectionState === 'connected')
      {
        this._session.renegotiate();
      }
      else
      {
        this._dataChannelReady = false;
        clearInterval(this._bfcpHeatbeatTimer);
        this._bfcpHeatbeatTimer = null;
        clearInterval(this._closingInterval);
      }
    }, 1000);
  }

  /**
   * 通过 DataChannel 发送消息，带超时重试机制。
   * FloorRelease 消息不重试。
   *
   * @param {Buffer}  message       - 待发送的 BFCP 消息
   * @param {number}  transactionId - 事务 ID
   * @returns {Promise<Object>} 解析后的响应消息
   */
  _dataChannelSend(message, transactionId)
  {
    logger.debug(`${this._session._id} dataChannelSend() ${transactionId}`);

    return new Promise((resolve, reject) =>
    {
      if (!this._dataChannelReady)
      {
        reject(`[DataChannel] Not ready for transactionId: ${transactionId}`);
        logger.error(`${this._session._id} [DataChannel] Not ready for transactionId: ${transactionId}`);

        return;
      }

      // 注册事务消息，等待响应匹配
      if (!this._dataChannelMsgs[transactionId])
      {
        this._dataChannelMsgs[transactionId] = {
          retries  : 0,
          sendAt   : Date.now(),
          message,
          received : false,
          resolve,
          reject
        };
      }

      const messageState = this._dataChannelMsgs[transactionId];

      // 超过最大重试次数
      if (messageState.retries !== 0 && (messageState.retries > CRTC_C.MAX_RETRY_ATTEMPTS))
      {
        logger.warn(`${this._session._id} [DataChannel] Max retry attempts (${CRTC_C.MAX_RETRY_ATTEMPTS}) reached for transactionId: ${transactionId}`);
        messageState.reject(`[DataChannel] Max retry attempts (${CRTC_C.MAX_RETRY_ATTEMPTS}) reached for transactionId: ${transactionId}`);

        return;
      }

      logger.debug(`${this._session._id} BFCP send: ${JSON.stringify(this._bfcpUser.receiveMessage(messageState.message))} ${JSON.stringify(Utils.uint8ArrayToBase64(messageState.message))} ${messageState.retries + 1}, ${transactionId} ${Date.now()}`);

      const sendMessage = this._bfcpUser.receiveMessage(messageState.message);

      // FloorRelease 不重发，其他消息启用指数退避重试
      if (CRTC_C.MAX_RETRY_ATTEMPTS > 0 && sendMessage.commonHeader.primitive !== Primitive.FloorRelease)
      {
        setTimeout(() =>
        {
          if (messageState && !messageState.received)
          {
            messageState.retries++;
            this._dataChannelSend(messageState.message, transactionId);
          }
        }, Math.pow(2, messageState.retries) * 500);
      }

      this._dataChannel && this._dataChannel.send(messageState.message);
    });
  }

  /**
   * 直接通过 DataChannel 发送消息（无重试），用于 ACK 类响应。
   */
  _sendDataChannelMessage(message, transactionId)
  {
    logger.debug(`${this._session._id} Sending message ${Utils.uint8ArrayToBase64(message)} with Transaction ID: ${transactionId}, Timestamp: ${Date.now()}`);
    this._dataChannel.send(message);
  }

  // ═══════════════════════════════════════════════════════════
  // BFCP 消息处理器
  // ═══════════════════════════════════════════════════════════

  /**
   * 处理收到的 Hello 消息：回复 HelloAck。
   */
  _handleHelloMessage(message)
  {
    logger.debug(`${this._session._id} BFCP send HACK: Transaction ID: ${message.commonHeader.transactionId}, Timestamp: ${Date.now()}`);
    const response = this._bfcpUser.helloAckMessage(message);

    this._sendDataChannelMessage(response);
  }

  /**
   * 处理收到的 FloorRequestStatus 消息（来自服务器对本端请求的响应）。
   * 发送 FloorRequestStatusAck 确认，如果状态为 Revoked 则自动取消共享。
   */
  _handleFloorRequestStatus(message)
  {
    logger.debug(`${this._session._id} BFCP send FloorRequestStatusACK: Transaction ID: ${message.commonHeader.transactionId}, Timestamp: ${Date.now()}`);
    const response = this._bfcpUser.floorRequestStatusAckMessage(message);

    this._sendDataChannelMessage(response);

    // 处理本端分享被撤销的情况
    const status = message.getAttribute(AttributeName.FloorRequestInformation)
      .content[1].content[1].content[0];

    if (status === RequestStatusValue.Revoked)
    {
      this._requestStatus = status;
      // 已经共享了的自动取消共享
      if (this._session._localShareStreamLocallyGenerated)
      {
        this._session.unShare();
      }
    }
  }

  /**
   * 处理收到的 FloorStatus 消息（远端共享状态变更通知）。
   * 根据 Granted / Released 触发 remoteShared / remoteUnShared 事件。
   */
  _handleFloorStatus(message)
  {
    const floorStatus = message.getAttribute(AttributeName.FloorRequestInformation)
      .content[1].content[1].content[0];

    if (floorStatus === RequestStatusValue.Granted && !this._remoteShared)
    {
      this._remoteShared = true;
      this._session.emit('remoteShared', { sharedStream: this._bfcpStream });
    }
    else if (floorStatus === RequestStatusValue.Released && this._remoteShared)
    {
      this._remoteShared = false;
      this._session.emit('remoteUnShared');
    }
    else
    {
      logger.warn(`${this._session._id} Unknown floor status: ${floorStatus}`);
    }
  }

  /**
   * 处理收到的 FloorRequest 消息（远端请求共享权限）。
   * 如果没有外部监听器，自动 Granted；否则抛出 floorRequest 事件交业务决定。
   */
  _handleFloorRequest(message)
  {
    const wantedFloorId = message.getAttribute(AttributeName.FloorId).content;

    if (this._session.listeners('floorRequest').length === 0
      || (message.commonHeader.primitive === Primitive.FloorRelease))
    {
      // 自动接受请求
      const response = this._bfcpUser.floorRequestStatusMessage(
        message, wantedFloorId, RequestStatusValue.Granted
      );

      this._sendDataChannelMessage(response, message.commonHeader.transactionId);
    }
    else
    {
      // 触发事件，允许外部处理
      this._session.emit('floorRequest', {
        message,
        accept : () =>
        {
          const response = this._bfcpUser.floorRequestStatusMessage(
            message, wantedFloorId, RequestStatusValue.Granted
          );

          this._sendDataChannelMessage(response, message.commonHeader.transactionId);
        },
        reject : () =>
        {
          const response = this._bfcpUser.floorRequestStatusMessage(
            message, wantedFloorId, RequestStatusValue.Denied
          );

          this._sendDataChannelMessage(response, message.commonHeader.transactionId);
        }
      });
    }
  }

  /**
   * 发送 FloorRequestStatusAck 确认。
   */
  _sendFloorRequestStatusAck(message)
  {
    logger.debug(`${this._session._id} _sendFloorStatusAck()`);

    const floorStatus = this._bfcpUser.floorStatusAckMessage(this._floorId, message);

    return this._sendDataChannelMessage(floorStatus);
  }

  // ═══════════════════════════════════════════════════════════
  // 工具方法
  // ═══════════════════════════════════════════════════════════

  /**
   * 判断一个轨道是否为 canvas 生成的视频轨道。
   * 用于区分 BFCP 占位轨道、画布流轨道和真实摄像头轨道。
   *
   * @param {MediaStreamTrack} track
   * @returns {boolean}
   */
  _isCanvasTrack(track)
  {
    const settings = track.getSettings();

    return (!settings.deviceId || settings.deviceId === 'canvas') ||
      track.label.toLowerCase().includes('canvas') ||
      (track.constructor && track.constructor.name === 'CanvasCaptureMediaStreamTrack') ||
      (!settings.deviceId && track.label.includes('MediaStreamTrack'));
  }

  // ═══════════════════════════════════════════════════════════
  // 资源清理
  // ═══════════════════════════════════════════════════════════

  /**
   * 关闭并清理所有 BFCP / DataChannel 相关资源。
   * 清理顺序：混音资源 → MediaStream → bfcpStream → DataChannel → 定时器。
   */
  close()
  {
    // 销毁 BFCP 混音
    this.destroyBfcpAudioTrack();

    // 关闭 BFCP 相关 MediaStream
    if (this._bfcpMediastreams.length > 0)
    {
      this._bfcpMediastreams.forEach((mediaStream) =>
      {
        logger.debug(`${this._session._id} close() | closing local bfcp MediaStream`);
        Utils.closeMediaStream(mediaStream);
      });
    }

    // 关闭远端辅流
    if (this._bfcpStream)
    {
      logger.debug(`${this._session._id} close() | closing local bfcp MediaStream`);
      Utils.closeMediaStream(this._bfcpStream);
    }

    // 关闭 DataChannel
    if (this._dataChannel)
    {
      this._dataChannel.close();
      this._dataChannel = null;
    }

    // 重置状态
    this._dataChannelReady = false;

    // 停止 BFCP 心跳
    if (this._bfcpHeatbeatTimer)
    {
      clearInterval(this._bfcpHeatbeatTimer);
      this._bfcpHeatbeatTimer = null;
    }

    // 停止 closing 状态检测
    if (this._closingInterval)
    {
      clearInterval(this._closingInterval);
    }
  }
};
