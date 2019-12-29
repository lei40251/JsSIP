const EventEmitter = require('events').EventEmitter;
const debugerror = require('debug')('JsSIP:ERROR:RTCSession:Notify');

debugerror.log = console.warn.bind(console);
// const JsSIP_C = require('../Constants');
// const Exceptions = require('../Exceptions');
// const Utils = require('../Utils');

module.exports = class Notify extends EventEmitter
{
  constructor(session)
  {
    super();

    this._session = session;
    this._direction = null;
    this._contentType = null;
    this._body = null;
  }

  get contentType()
  {
    return this._contentType;
  }

  get body()
  {
    return this._body;
  }

  init_incoming(request)
  {
    this._direction = 'incoming';
    this.request = request;

    request.reply(200);

    this._contentType = request.getHeader('content-type');
    this._body = request.body;

    this._session.newNotify({
      originator : 'remote',
      notify       : this,
      request
    });
  }
};