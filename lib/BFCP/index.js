/**
 * bfcp-lib: A simple library for BFCP protocol
 * @module bfcp-lib
 */

const User = require('./src/user/User.js');
const Primitive = require('./src/messages/Primitive.js');
const RequestStatusValue = require('./src/messages/RequestStatusValue.js');
const AttributeName = require('./src/AttributeName.js');

const BFCPLib = {
  'User'               : User,
  'Primitive'          : Primitive,
  'RequestStatusValue' : RequestStatusValue,
  'AttributeName'      : AttributeName
};

module.exports = BFCPLib;
