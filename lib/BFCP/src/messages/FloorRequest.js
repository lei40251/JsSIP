const CommonHeader = require('./CommonHeader.js');
const FloorId = require('../AttributeClasses.js').FloorId;
const Message = require('./Message.js');
const PayloadLength = require('./PayloadLength.js');
const Primitive = require('./Primitive.js');

/**
 * @classdesc
 * FloorRequest class is a abstraction of the FloorRequest Message as defined in the
 * RFC 4582 - BFCP
 * https://tools.ietf.org/html/rfc4582#section-5.3.1
 * @extends Message
 * @memberof bfcp-lib.Message
 */
class FloorRequest extends Message
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
        Primitive.FloorRequest,
        PayloadLength.FloorRequest,
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

module.exports = FloorRequest;
