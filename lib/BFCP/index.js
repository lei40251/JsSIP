/**
 * bfcp-lib: A simple library for BFCP protocol
 * @module bfcp-lib
 */

const User = require('./user/User.js');
const Primitive = require('./messages/Primitive.js');
const RequestStatusValue = require('./messages/RequestStatusValue.js');
const AttributeName = require('./AttributeName.js');

const BFCPLib = {
  'User'               : User,
  'Primitive'          : Primitive,
  'RequestStatusValue' : RequestStatusValue,
  'AttributeName'      : AttributeName
};

module.exports = BFCPLib;
