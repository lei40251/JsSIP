const Grammar = require('./Grammar');
const debug = require('debug')('JsSIP:WebSocketInterface');
const debugerror = require('debug')('JsSIP:ERROR:WebSocketInterface');

debugerror.log = console.warn.bind(console);

/**
 * @param {string} url - wss url 地址
 * @class
 * @classdesc - websocket 接口类
 */
class WebSocketInterface
{
  constructor(url)
  {
    debug('new() [url:"%s"]', url);

    this._url = url;
    this._sip_uri = null;
    this._via_transport = null;
    this._ws = null;

    const parsed_url = Grammar.parse(url, 'absoluteURI');

    if (parsed_url === -1)
    {
      debugerror(`invalid WebSocket URI: ${url}`);
      throw new TypeError(`Invalid argument: ${url}`);
    }
    else if (parsed_url.scheme !== 'wss' && parsed_url.scheme !== 'ws')
    {
      debugerror(`invalid WebSocket URI scheme: ${parsed_url.scheme}`);
      throw new TypeError(`Invalid argument: ${url}`);
    }
    else
    {
      this._sip_uri = `sip:${parsed_url.host}${parsed_url.port ? `:${parsed_url.port}` : ''};transport=ws`;
      this._via_transport = parsed_url.scheme.toUpperCase();
    }
  }

  /**
   * @member {string} via_transport - via 地址
   *
   * @memberof WebSocketInterface
   */
  get via_transport()
  {
    return this._via_transport;
  }
  set via_transport(value)
  {
    this._via_transport = value.toUpperCase();
  }

  /**
   * @member {string} sip_uri - sip 地址
   *
   * @readonly
   * @memberof WebSocketInterface
   */
  get sip_uri()
  {
    return this._sip_uri;
  }

  /**
   * @member {string} url - wss url 地址
   *
   * @readonly
   * @memberof WebSocketInterface
   */
  get url()
  {
    return this._url;
  }

  /**
   * 建立连接
   */
  connect()
  {
    debug('connect()');

    if (this.isConnected())
    {
      debug(`WebSocket ${this._url} is already connected`);

      return;
    }
    else if (this.isConnecting())
    {
      debug(`WebSocket ${this._url} is connecting`);

      return;
    }

    if (this._ws)
    {
      this.disconnect();
    }

    debug(`connecting to WebSocket ${this._url}`);

    try
    {
      this._ws = new WebSocket(this._url, 'sip');

      this._ws.binaryType = 'arraybuffer';

      this._ws.onopen = this._onOpen.bind(this);
      this._ws.onclose = this._onClose.bind(this);
      this._ws.onmessage = this._onMessage.bind(this);
      this._ws.onerror = this._onError.bind(this);
    }
    catch (e)
    {
      this._onError(e);
    }
  }

  /**
   * 断开连接
   */
  disconnect()
  {
    debug('disconnect()');

    if (this._ws)
    {
      // Unbind websocket event callbacks.
      this._ws.onopen = () => {};
      this._ws.onclose = () => {};
      this._ws.onmessage = () => {};
      this._ws.onerror = () => {};

      this._ws.close();
      this._ws = null;
    }
  }

  /**
   * 发送消息
   * @param {any} message - 消息内容
   * @returns {boolean} - 已发送？ true 或者 false
   */
  send(message)
  {
    debug('send()');

    if (this.isConnected())
    {
      this._ws.send(message);

      return true;
    }
    else
    {
      debugerror('unable to send message, WebSocket is not open');

      return false;
    }
  }

  /**
   * 是否已连接成功
   * @returns {boolean} - true 或者 false
   */
  isConnected()
  {
    return this._ws && this._ws.readyState === this._ws.OPEN;
  }

  /**
   * 是否正在连接中
   * @returns {boolean} - true 或者 false
   */
  isConnecting()
  {
    return this._ws && this._ws.readyState === this._ws.CONNECTING;
  }

  // WebSocket Event Handlers
  _onOpen()
  {
    debug(`WebSocket ${this._url} connected`);

    this.onconnect();
  }

  _onClose({ wasClean, code, reason })
  {
    debug(`WebSocket ${this._url} closed`);

    if (wasClean === false)
    {
      debug('WebSocket abrupt disconnection');
    }

    const data = {
      socket : this,
      error  : !wasClean,
      code,
      reason
    };

    this.ondisconnect(data);
  }

  _onMessage({ data })
  {
    debug('received WebSocket message');

    this.ondata(data);
  }

  _onError(e)
  {
    debugerror(`WebSocket ${this._url} error: ${e}`);
  }
};

module.exports = WebSocketInterface;