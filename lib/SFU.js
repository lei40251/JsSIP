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

const createClient = (clientConfig) =>
{
  return new Client(clientConfig);
};

const createStream = (streamConfig) =>
{
  return new LocalStream(streamConfig);
};

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
  createClient,
  createStream,
  // Expose the debug module.
  debug : require('debug'),
  get name() { return pkg.title; },
  get version() { return pkg.version; }
};

module.exports = JsSIP;