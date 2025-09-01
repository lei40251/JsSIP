/**
 * bfcp-lib: A simple library for BFCP protocol
 * @module bfcp-lib
 */

const User = require('./lib/user/user.js');
const Primitive = require('./lib/messages/primitive.js');
const RequestStatusValue = require('./lib/messages/requestStatusValue.js');
const AttributeName = require('./lib/attributes/name.js');

const BFCPLib = {
  'User'               : User,
  'Primitive'          : Primitive,
  'RequestStatusValue' : RequestStatusValue,
  'AttributeName'      : AttributeName
};

module.exports = BFCPLib;
