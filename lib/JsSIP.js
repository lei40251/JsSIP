const pkg = require('../package.json');
const C = require('./Constants');
const Exceptions = require('./Exceptions');
const Utils = require('./Utils');
const UA = require('./UA');
const URI = require('./URI');
const NameAddrHeader = require('./NameAddrHeader');
const Grammar = require('./Grammar');
const WebSocketInterface = require('./WebSocketInterface');
const debug = require('debug')('CRTC');
const getStats = require('./Stats');

debug('version %s', pkg.version);

(function()
{

  if (typeof window.CustomEvent === 'function') return;

  function CustomEvent(event, params)
  {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    const evt = document.createEvent('CustomEvent');

    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);

    return evt;
  }

  CustomEvent.prototype = window.Event.prototype;

  window.CustomEvent = CustomEvent;
})();

/**
 * Expose the CRTC module.
 */
module.exports = {
  C,
  Exceptions,
  Utils,
  UA,
  URI,
  NameAddrHeader,
  WebSocketInterface,
  Grammar,
  getStats,
  // Expose the debug module.
  debug : require('debug'),
  get name() { return pkg.title; },
  get version() { return pkg.version; }
};
