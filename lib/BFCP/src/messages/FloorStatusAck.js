const CommonHeader = require('./CommonHeader.js');
const FloorId = require('../AttributeClasses.js').FloorId;
const Message = require('./Message.js');
const PayloadLength = require('./PayloadLength.js');
const Primitive = require('./Primitive.js');

/**
 * @classdesc
 * FloorStatusAck class is a abstraction of the FloorStatusAck Message
 * extended from the RFC 4582 - BFCP
 * https://tools.ietf.org/html/rfc4582
 * @extends Message
 * @memberof bfcp-lib.Message
 */
class FloorStatusAck extends Message
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
        Primitive.FloorStatusAck,
        PayloadLength.FloorStatusAck,
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

module.exports = FloorStatusAck;
