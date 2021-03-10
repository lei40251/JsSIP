// const JsSIP_C = require('./Constants');
// const URI = require('./URI');
// const Grammar = require('./Grammar');
// const Utils = require('./Utils');
const { EventEmitter } = require('events');
const UA = require('./UA');
const debug = require('debug')('FlyInn:RTC');
const debugerror = require('debug')('FlyInn:ERROR:RTC');

debugerror.log = console.warn.bind(console);

module.exports = class RTC extends EventEmitter
{
  constructor()
  {
    debug('new RTC()');

    super();

    this._ua = null;
    this._sessionn = null;
  }

  createClient(configuration)
  {
    debug('createClient()');

    this._ua = new UA(configuration);

    this._ua.start();

    return this._ua;
  }

  join(linkman, options)
  {
    this._sessionn = this._ua.call(linkman, options);

    return this._sessionn;
  }

  leave()
  {
    this._sessionn.terminate();
  }


};