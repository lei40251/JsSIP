const CommonHeader = require('./CommonHeader.js');
const FloorId = require('../AttributeClasses.js').FloorId;
const Message = require('./Message.js');
const PayloadLength = require('./PayloadLength.js');
const Primitive = require('./Primitive.js');

/**
 * @classdesc
 * FloorRequestStatusAck class is a abstraction of the FloorRequestStatusAck Message
 * extended from the RFC 4582 - BFCP
 * https://tools.ietf.org/html/rfc4582
 * @extends Message
 * @memberof bfcp-lib.Message
 */
class FloorRequestStatusAck extends Message
{
  /**
   * @constructor
   * @param {Integer} conferenceId   The conference id
   * @param {Integer} transactionId  The transaction id
   * @param {Integer} userId         The user id
   * @param {Integer} floorId        The floor id
   */
  constructor(conferenceId, transactionId, userId, floorId)
  {
    super(
      new CommonHeader(
        Primitive.FloorRequestStatusAck,
        PayloadLength.FloorRequestStatusAck,
        conferenceId,
        transactionId,
        userId
      ),
      [
        new FloorId(floorId)
      ]
    );
  }
}

module.exports = FloorRequestStatusAck;
