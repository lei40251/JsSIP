const CommonHeader = require('./CommonHeader.js');
const Message = require('./Message.js');
const PayloadLength = require('./PayloadLength.js');
const Primitive = require('./Primitive.js');
const SupportedPrimitives = require('../AttributeClasses.js').SupportedPrimitives;
const SupportedAttributes = require('../AttributeClasses.js').SupportedAttributes;

/**
 * @classdesc
 * HelloAck class is a abstraction of the HelloAck Message as defined in the
 * RFC 4582 - BFCP
 * https://tools.ietf.org/html/rfc4582#section-5.3.12
 * @extends Message
 * @memberof bfcp-lib.Message
 */
class HelloAck extends Message
{
  /**
   * @constructor
   * @param {Integer} conferenceId  The conference id
   * @param {Integer} transactionId The transaction id
   * @param {Integer} userId        The user id
   */
  constructor(conferenceId, transactionId, userId)
  {
    super(
      new CommonHeader(
        Primitive.HelloAck,
        PayloadLength.HelloAck,
        conferenceId,
        transactionId,
        userId
      ),
      [
        new SupportedPrimitives(),
        new SupportedAttributes()
      ]
    );
  }
}

module.exports = HelloAck;
