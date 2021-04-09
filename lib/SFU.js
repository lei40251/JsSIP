const pkg = require('../package.json');
const C = require('./Constants');
const Exceptions = require('./Exceptions');
const Utils = require('./Utils');
const UA = require('./UA');
const Client = require('./SFU/Client');
const LocalStream = require('./SFU/LocalStream');
const RemoteStream = require('./SFU/RemoteStream');
const URI = require('./URI');
const NameAddrHeader = require('./NameAddrHeader');
const Grammar = require('./Grammar');
const WebSocketInterface = require('./WebSocketInterface');
const debug = require('debug')('FlyInn');

debug('version %s', pkg.version);

/**
 * Expose the JsSIP module.
 */
const JsSIP = {
  C,
  Exceptions,
  Utils,
  UA,
  Client,
  LocalStream,
  RemoteStream,
  URI,
  NameAddrHeader,
  WebSocketInterface,
  Grammar,
  createClient            : require('./SFU/Utils').createClient,
  createStream            : require('./SFU/Utils').createStream,
  isScreenShareSupported  : require('./SFU/Utils').isScreenShareSupported,
  getDevices              : require('./SFU/Utils').getDevices,
  getCameras              : require('./SFU/Utils').getCameras,
  getMicrophones          : require('./SFU/Utils').getMicrophones,
  getSpeakers             : require('./SFU/Utils').getSpeakers,
  checkSystemRequirements : require('./SFU/Utils').checkSystemRequirements,
  version                 : require('./SFU/Utils').version,
  // Expose the debug module.
  debug                   : require('debug'),
  get name() { return pkg.title; }
  // get version() { return pkg.version; }
};

module.exports = JsSIP;