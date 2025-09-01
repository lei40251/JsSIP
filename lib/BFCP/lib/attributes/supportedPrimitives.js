const Attribute = require('./attribute.js');
const Format = require('./format.js');
const Length = require('./length.js');
const Primitive = require('../messages/primitive.js');
const Type = require('./type.js');

/**
 * @classdesc
 * SupportedPrimitives class is a abstraction of the SupportedPrimitives
 * attribute as defined in the RFC 4582 - BFCP
 * https://tools.ietf.org/html/rfc4582#section-5.2.11
 * @extends Attribute
 * @memberof bfcp-lib.Attribute
 */
class SupportedPrimitives extends Attribute
{
  /**
   * @constructor
   * @param {bfcp-lib.Message.Primitive} primitives A Message Primitive list
   * representing the supported primitives (messages)
   */
  constructor(primitives)
  {
    let supPrimitives = [];

    if (!primitives || primitives == undefined)
    {
      supPrimitives = [
        Primitive.FloorRequest,
        // Primitive.FloorRelease,
        // Primitive.FloorRequestQuery,
        Primitive.FloorRequestStatus,
        // Primitive.UserQuery,
        // Primitive.UserStatus,
        // Primitive.FloorQuery,
        Primitive.FloorStatus,
        Primitive.Hello,
        Primitive.HelloAck,
        Primitive.Error,
        Primitive.FloorRequestStatusAck
        // Primitive.FloorStatusAck
        // Primitive.Goodbye,
        // Primitive.GoodbyeAck
      ];
    }
    else
    {
      supPrimitives = primitives;
    }

    const length = supPrimitives.length + Length.SupportedPrimitives;

    super(Type.SupportedPrimitives, length, Format.OctetString, supPrimitives);
  }
}

module.exports = SupportedPrimitives;
