// const JsSIP_C = require('./Constants');
// const URI = require('./URI');
// const Grammar = require('./Grammar');
// const Utils = require('./Utils');
const { EventEmitter } = require('events');
const UA = require('../UA');
const WebSocketInterface = require('../WebSocketInterface');
const debug = require('debug')('FlyInn:RTC');
const debugerror = require('debug')('FlyInn:ERROR:RTC');

debugerror.log = console.warn.bind(console);

module.exports = class Client extends EventEmitter
{
  constructor(clientConfig)
  {
    debug('new Client()');

    super();

    this._domain = clientConfig.domain;
    this._userId = clientConfig.userId;
    this._wssUrl = clientConfig.wssUrl;
    this._userSig = clientConfig.userSig;

    this._sessionn = null;

    this._configuration={
      sockets  : new WebSocketInterface(this._wssUrl),
      uri      : `sip:${this._userId}@${this._domain}`,
      password : this._userSig
    };

    this._ua = new UA(this._configuration);

    this._ua.on('sipEvent', (data) =>
    {
      this.emit('sipEvent', {
        data
      });
    });

    this._ua.on('registered', (data) =>
    {
      // this.emit('registered', data);
    });

    this._ua.start();

    // this.emit('transactionDestroyed', {
    //   data : 'transaction'
    // });
  }

  join(roomId, options)
  {
    this._sessionn = this._ua.call(roomId, options);

    this._sessionn.on('muted', (data) =>
    {
      this.emit('muted', {
        data
      });
    });

    return this._sessionn;
  }

  leave()
  {
    this._sessionn.terminate();
  }


};