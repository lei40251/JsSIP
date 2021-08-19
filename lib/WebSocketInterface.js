const Grammar = require('./Grammar');
const debug = require('debug')('FlyInn:WebSocketInterface');
const debugerror = require('debug')('FlyInn:ERROR:WebSocketInterface');
const log = require('./SFU/Logger');

debugerror.log = console.warn.bind(console);

module.exports = class WebSocketInterface
{
  constructor(url)
  {
    debug('new() [url:"%s"]', url);
    log.debug(`new() [url:"${url}"]`);

    this._url = url;
    this._sip_uri = null;
    this._via_transport = null;
    this._ws = null;

    const parsed_url = Grammar.parse(url, 'absoluteURI');

    if (parsed_url === -1)
    {
      debugerror(`invalid WebSocket URI: ${url}`);
      log.error(`invalid WebSocket URI: ${url}`);
      throw new TypeError(`Invalid argument: ${url}`);
    }
    else if (parsed_url.scheme !== 'wss' && parsed_url.scheme !== 'ws')
    {
      debugerror(`invalid WebSocket URI scheme: ${parsed_url.scheme}`);
      log.error(`invalid WebSocket URI scheme: ${parsed_url.scheme}`);
      throw new TypeError(`Invalid argument: ${url}`);
    }
    else
    {
      this._sip_uri = `sip:${parsed_url.host}${parsed_url.port ? `:${parsed_url.port}` : ''};transport=ws`;
      this._via_transport = parsed_url.scheme.toUpperCase();
    }
  }

  get via_transport()
  {
    return this._via_transport;
  }

  set via_transport(value)
  {
    this._via_transport = value.toUpperCase();
  }

  get sip_uri()
  {
    return this._sip_uri;
  }

  get url()
  {
    return this._url;
  }

  connect()
  {
    debug('connect()');
    log.debug('connect()');

    if (this.isConnected())
    {
      debug(`WebSocket ${this._url} is already connected`);
      log.debug(`WebSocket ${this._url} is already connected`);

      return;
    }
    else if (this.isConnecting())
    {
      debug(`WebSocket ${this._url} is connecting`);
      log.debug(`WebSocket ${this._url} is connecting`);

      return;
    }

    if (this._ws)
    {
      this.disconnect();
    }

    debug(`connecting to WebSocket ${this._url}`);
    log.debug(`connecting to WebSocket ${this._url}`);

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

  disconnect()
  {
    debug('disconnect()');
    log.debug('disconnect()');

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

  send(message)
  {
    debug('send()');
    log.debug('send()');

    if (this.isConnected())
    {
      this._ws.send(message);

      return true;
    }
    else
    {
      debugerror('unable to send message, WebSocket is not open');
      log.error('unable to send message, WebSocket is not open');

      return false;
    }
  }

  isConnected()
  {
    return this._ws && this._ws.readyState === this._ws.OPEN;
  }

  isConnecting()
  {
    return this._ws && this._ws.readyState === this._ws.CONNECTING;
  }


  /**
   * WebSocket Event Handlers
   */

  _onOpen()
  {
    debug(`WebSocket ${this._url} connected`);
    log.debug(`WebSocket ${this._url} connected`);

    this.onconnect();
  }

  _onClose({ wasClean, code, reason })
  {
    debug(`WebSocket ${this._url} closed`);
    log.debug(`WebSocket ${this._url} closed`);

    if (wasClean === false)
    {
      debug('WebSocket abrupt disconnection');
      log.debug('WebSocket abrupt disconnection');
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
    log.debug('received WebSocket message');

    this.ondata(data);
  }

  _onError(e)
  {
    debugerror(`WebSocket ${this._url} error: ${e}`);
    log.error(`WebSocket ${this._url} error: ${e}`);
  }
};
