const Logger = require('./Logger');
const Socket = require('./Socket');
const CRTC_C = require('./Constants');
const Utils = require('./Utils');

const logger = new Logger('Transport');

/**
 * Constants
 */
const C = {
  // Transport status.
  STATUS_CONNECTED    : 0,
  STATUS_CONNECTING   : 1,
  STATUS_DISCONNECTED : 2,

  // Socket status.
  SOCKET_STATUS_READY : 0,
  SOCKET_STATUS_ERROR : 1,

  // Recovery options.
  recovery_options : {
    // minimum interval in seconds between recover attempts.
    min_interval : CRTC_C.CONNECTION_RECOVERY_MIN_INTERVAL,
    // maximum interval in seconds between recover attempts.
    max_interval : CRTC_C.CONNECTION_RECOVERY_MAX_INTERVAL
  }
};

/*
 * Manages one or multiple CRTC.Socket instances.
 * Is reponsible for transport recovery logic among all socket instances.
 *
 * @socket CRTC::Socket instance
 */
module.exports = class Transport
{
  constructor(sockets, recovery_options = C.recovery_options)
  {
    logger.debug('new()');

    this.status = C.STATUS_DISCONNECTED;

    // Current socket.
    this.socket = null;

    // Socket collection.
    this.sockets = [];

    this.recovery_options = recovery_options;
    this.recover_attempts = 0;
    this.recovery_timer = null;

    this.close_requested = false;

    // 适配部分浏览器的SDP 的 DC 参数，适配 Firefox
    this._sctp_port = null;
    this._max_message_size = null;

    this._sdpResolution = 'BP480P';

    // It seems that TextDecoder is not available in some versions of React-Native.
    // See https://github.com/versatica/JsSIP/issues/695
    try
    {
      this.textDecoder = new TextDecoder('utf8');
    }
    catch (error)
    {
      logger.warn(`cannot use TextDecoder: ${error}`);
    }

    if (typeof sockets === 'undefined')
    {
      throw new TypeError('Invalid argument.' +
                          ' undefined \'sockets\' argument');
    }

    if (!(sockets instanceof Array))
    {
      sockets = [ sockets ];
    }

    sockets.forEach(function(socket)
    {
      if (!Socket.isSocket(socket.socket))
      {
        throw new TypeError('Invalid argument.' +
                            ' invalid \'CRTC.Socket\' instance');
      }

      if (socket.weight && !Number(socket.weight))
      {
        throw new TypeError('Invalid argument.' +
                            ' \'weight\' attribute is not a number');
      }

      this.sockets.push({
        socket : socket.socket,
        weight : socket.weight || 0,
        status : C.SOCKET_STATUS_READY
      });
    }, this);

    // Get the socket with higher weight.
    this._getSocket();

    const orignalSetItem = sessionStorage.setItem;

    sessionStorage.setItem = function(key, ...newValue)
    {
      const setItemEvent = new CustomEvent('setItemEvent');

      setItemEvent.key = key;
      setItemEvent.newValue = newValue[0];
      window.dispatchEvent(setItemEvent);
      orignalSetItem.apply(this, [ key, ...newValue ]);
    };
  }

  /**
   * Instance Methods
   */

  get via_transport()
  {
    return this.socket.via_transport;
  }

  get url()
  {
    return this.socket.url;
  }

  get sip_uri()
  {
    return this.socket.sip_uri;
  }

  get sdpResolution()
  {
    return this._sdpResolution;
  }

  set sdpResolution(value)
  {
    this._sdpResolution = value;
  }

  connect()
  {
    logger.debug('connect()');

    if (this.isConnected())
    {
      logger.debug('Transport is already connected');

      return;
    }
    else if (this.isConnecting())
    {
      logger.debug('Transport is connecting');

      return;
    }

    this.close_requested = false;
    this.status = C.STATUS_CONNECTING;
    this.onconnecting({ socket: this.socket, attempts: this.recover_attempts });

    if (!this.close_requested)
    {
      // Bind socket event callbacks.
      this.socket.onconnect = this._onConnect.bind(this);
      this.socket.ondisconnect = this._onDisconnect.bind(this);
      this.socket.ondata = this._onData.bind(this);

      this.socket.connect();
    }

    return;
  }

  disconnect()
  {
    logger.debug('close()');

    this.close_requested = true;
    this.recover_attempts = 0;
    this.status = C.STATUS_DISCONNECTED;

    // Clear recovery_timer.
    if (this.recovery_timer !== null)
    {
      clearTimeout(this.recovery_timer);
      this.recovery_timer = null;
    }

    // Unbind socket event callbacks.
    this.socket.onconnect = () => {};
    this.socket.ondisconnect = () => {};
    this.socket.ondata = () => {};

    this.socket.disconnect();
    this.ondisconnect({
      socket : this.socket,
      error  : false
    });
  }

  send(data)
  {
    logger.debug('send()');

    if (!this.isConnected())
    {
      logger.warn('unable to send message, transport is not connected');

      return false;
    }

    let message = data.toString();

    // 统一修改发出的SDP
    message = Utils.processSdp(message);
    message = message.replace(/a=group:BUNDLE.*\r\n/, '');
    message = message.replace(/a=candidate.*typ host.*\r?\n/gm, '');
    // 去掉IPV6
    message = message.replace(/a=candidate:.*:.*\r\n/g, '');

    // 修改端口，适配 icecandidate 收集未完成的情况
    message = message.replace(/m=audio 9 /, 'm=audio 11028 ');
    message = message.replace(/m=video 9 /, 'm=video 11029 ');

    // 修复修改SDP后的Header头
    message = Utils.fixContentLength(message);

    const sctpPortMatch = message.match(/a=sctp-port:(\d+)/);
    const maxMessageSizeMatch = message.match(/a=max-message-size:(\d+)/);

    // 提取SCTP端口
    sctpPortMatch && sctpPortMatch[1] && (this._sctp_port = sctpPortMatch[1]); // 结果: "5000"
    // 提取最大消息大小
    maxMessageSizeMatch && maxMessageSizeMatch[1] && (this._max_message_size = maxMessageSizeMatch[1]); // 结果: "1073741823"

    logger.debug('scpt,max_message_size: ', this._sctp_port, this._max_message_size);
    logger.debug(`sending message:\n\n${message}\n`);

    return this.socket.send(message);
  }

  isConnected()
  {
    return this.status === C.STATUS_CONNECTED;
  }

  isConnecting()
  {
    return this.status === C.STATUS_CONNECTING;
  }

  /**
   * Private API.
   */

  _reconnect()
  {
    this.recover_attempts+=1;

    let k = Math.floor((Math.random() * Math.pow(2, this.recover_attempts)) +1);

    if (k < this.recovery_options.min_interval)
    {
      k = this.recovery_options.min_interval;
    }

    else if (k > this.recovery_options.max_interval)
    {
      k = this.recovery_options.max_interval;
    }

    logger.debug(`reconnection attempt: ${this.recover_attempts}. next connection attempt in ${k} seconds`);

    this.recovery_timer = setTimeout(() =>
    {
      if (!this.close_requested && !(this.isConnected() || this.isConnecting()))
      {
        // Get the next available socket with higher weight.
        this._getSocket();

        // Connect the socket.
        this.connect();
      }
    }, k * 1000);
  }

  /**
   * get the next available socket with higher weight
   */
  _getSocket()
  {

    let candidates = [];

    this.sockets.forEach((socket) =>
    {
      if (socket.status === C.SOCKET_STATUS_ERROR)
      {
        return; // continue the array iteration
      }
      else if (candidates.length === 0)
      {
        candidates.push(socket);
      }
      else if (socket.weight > candidates[0].weight)
      {
        candidates = [ socket ];
      }
      else if (socket.weight === candidates[0].weight)
      {
        candidates.push(socket);
      }
    });

    if (candidates.length === 0)
    {
      // All sockets have failed. reset sockets status.
      this.sockets.forEach((socket) =>
      {
        socket.status = C.SOCKET_STATUS_READY;
      });

      // Get next available socket.
      this._getSocket();

      return;
    }

    const idx = Math.floor((Math.random()* candidates.length));

    this.socket = candidates[idx].socket;
  }

  /**
   * Socket Event Handlers
   */

  _onConnect()
  {
    // 信令连接成功，如果重试次数不为零则为重连，延迟1秒后调用reinvite
    if (this.recover_attempts !== 0)
    {
      setTimeout(() =>
      {
        const setItemEvent = new CustomEvent('setItemEvent');

        setItemEvent.key = 'needReinvite';
        setItemEvent.newValue = 1;
        window.dispatchEvent(setItemEvent);
      }, 200);
    }

    this.recover_attempts = 0;
    this.status = C.STATUS_CONNECTED;

    // Clear recovery_timer.
    if (this.recovery_timer !== null)
    {
      clearTimeout(this.recovery_timer);
      this.recovery_timer = null;
    }

    this.onconnect({ socket: this });
  }

  _onDisconnect(error, code, reason)
  {
    this.status = C.STATUS_DISCONNECTED;
    this.ondisconnect({
      socket : this.socket,
      error,
      code,
      reason
    });

    if (this.close_requested)
    {
      return;
    }

    // Update socket status.
    else
    {
      this.sockets.forEach(function(socket)
      {
        if (this.socket === socket.socket)
        {
          socket.status = C.SOCKET_STATUS_ERROR;
        }
      }, this);
    }

    this._reconnect(error);
  }

  _onData(data)
  {
    // CRLF Keep Alive response from server. Ignore it.
    if (data === '\r\n')
    {
      logger.debug('received message with CRLF Keep Alive response');

      return;
    }

    // Binary message.
    else if (typeof data !== 'string')
    {
      try
      {
        if (this.textDecoder)
          data = this.textDecoder.decode(data);
        else
          data = String.fromCharCode.apply(null, new Uint8Array(data));
      }
      catch (evt)
      {
        logger.debug('received binary message failed to be converted into string,' +
              ' message discarded');

        return;
      }

      logger.debug(`received binary message:\n\n${data}\n`);
    }

    // Text message.
    else
    {
      logger.debug(`received text message:\n\n${data}\n`);
    }

    // 统一修改收到的SDP
    data = data.replace(/b=(AS|RS|RR):\d.*\r?\n/g, '');
    data = data.replace(/(m=video[^\r\n]*(?:[\s\S]*?(?=\r?\nm=|$)))/gm, (match) =>
    {
      if (match.includes('a=inactive'))
      {
        // 替换该视频块中的m=video行的端口为0
        return match.replace(/m=video \d+/g, 'm=video 0');
      }

      return match;
    });

    // 适配paphone
    data = data.replace(/profile-level-id=420D0D;.*packetization-mode=1;/g, 'level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01f');
    data = data.replace(/420D0D/g, '42e01f');

    // data += 'a=sctp-port:5000\r\na=max-message-size:1073741823\r\n';

    // 兼容hwcloudlink，修改收到的 profile
    data = data.replace(/profile-level-id=([a-zA-Z0-9]{6})/g, `profile-level-id=${CRTC_C.SDP_LEVELID_AS[this._sdpResolution].LEVELID}`);
    // eslint-disable-next-line max-len
    // data = data.replace(/(a=fmtp:\d+\s+profile-level-id=[\w\d]+[\s\S]*?a=fmtp:\d+\s+profile-level-id=)([\w\d]+)/, '$142c01e');

    // 修复BFCP用到的SDP信息
    data = data.replace('UDP/DTLS/SCTP/BFCP *', 'UDP/DTLS/SCTP webrtc-datachannel');

    // 检查并添加SCTP参数,适配Firefox
    if (data.includes('UDP/DTLS/SCTP webrtc-datachannel'))
    {
      const hasSctpPort = /a=sctp-port:\d+/.test(data);
      const hasMaxMessageSize = /a=max-message-size:\d+/.test(data);

      if (!hasSctpPort || !hasMaxMessageSize)
      {
        data = data.replace(/(SCTP webrtc-datachannel\r\n)/g, `$1a=sctp-port:${this._sctp_port}\r\na=max-message-size:${this._max_message_size}\r\n`);
      }
    }

    // 修复修改SDP后的Header头
    data = Utils.fixContentLength(data);

    logger.debug(`modified message:\n\n${data}\n`);
    this.ondata({ transport: this, message: data });
  }
};
