/**
 * BFCP 属性子类合集。
 *
 * 将所有简单的属性子类集中在一个文件中，
 * 避免每个属性一个文件导致的过度拆分。
 *
 * 每个子类都继承 Attribute 基类，仅需在构造函数中设置
 * type、length、format、content 参数。
 *
 * @see {@link module:bfcp-lib.Attribute}
 */

const Attribute = require('./attributes/attribute.js');
const Format = require('./attributes/format.js');
const Length = require('./attributes/length.js');
const Type = require('./attributes/type.js');
const Primitive = require('./messages/primitive.js');

/**
 * BeneficiaryId 属性 — RFC 4582 §5.2.1
 * @extends Attribute
 */
class BeneficiaryId extends Attribute
{
  constructor(beneficiaryId)
  {
    super(Type.BeneficiaryId, Length.BeneficiaryId, Format.Unsigned16, beneficiaryId);
  }
}

/**
 * FloorId 属性 — RFC 4582 §5.2.2
 * @extends Attribute
 */
class FloorId extends Attribute
{
  constructor(floorId)
  {
    super(Type.FloorId, Length.FloorId, Format.Unsigned16, floorId);
  }
}

/**
 * FloorRequestId 属性 — RFC 4582 §5.2.3
 * @extends Attribute
 */
class FloorRequestId extends Attribute
{
  constructor(floorRequestId)
  {
    super(Type.FloorRequestId, Length.FloorRequestId, Format.Unsigned16, floorRequestId);
  }
}

/**
 * RequestStatus 属性 — RFC 4582 §5.2.5
 * @extends Attribute
 */
class RequestStatus extends Attribute
{
  constructor(requestStatus, queuePosition)
  {
    if (queuePosition == null || queuePosition == undefined)
    {
      queuePosition = 0;
    }

    super(Type.RequestStatus, Length.RequestStatus, Format.OctetString16, [ requestStatus, queuePosition ]);
  }
}

/**
 * SupportedAttributes 属性 — RFC 4582 §5.2.10
 * @extends Attribute
 */
class SupportedAttributes extends Attribute
{
  constructor(attributes)
  {
    let list;

    if (!attributes || attributes == undefined)
    {
      list = [
        Type.BeneficiaryId, Type.FloorId, Type.FloorRequestId, Type.Priority,
        Type.RequestStatus, Type.ErrorCode, Type.ErrorInfo,
        Type.ParticipantProvidedInfo, Type.StatusInfo, Type.SupportedAttributes,
        Type.SupportedPrimitives, Type.UserDisplayName, Type.UserUri,
        Type.RequestedByInformation, Type.FloorRequestInformation,
        Type.RequestedByInformation, Type.FloorRequestStatus,
        Type.OverallRequestStatus
      ];
    }
    else
    {
      list = attributes;
    }

    super(Type.SupportedAttributes, list.length + Length.SupportedAttributes, Format.OctetString, list);
  }
}

/**
 * SupportedPrimitives 属性 — RFC 4582 §5.2.11
 * @extends Attribute
 */
class SupportedPrimitives extends Attribute
{
  constructor(primitives)
  {
    let list;

    if (!primitives || primitives == undefined)
    {
      list = [
        Primitive.FloorRequest,
        Primitive.FloorRequestStatus,
        Primitive.FloorStatus,
        Primitive.Hello,
        Primitive.HelloAck,
        Primitive.Error,
        Primitive.FloorRequestStatusAck
      ];
    }
    else
    {
      list = primitives;
    }

    super(Type.SupportedPrimitives, list.length + Length.SupportedPrimitives, Format.OctetString, list);
  }
}

/**
 * FloorRequestStatus 属性 — RFC 4582 §5.2.17
 * @extends Attribute
 */
class FloorRequestStatus extends Attribute
{
  constructor(floorId, requestStatus)
  {
    super(Type.FloorRequestStatus, Length.FloorRequestStatus, Format.Grouped, [
      floorId,
      new RequestStatus(requestStatus)
    ]);
  }
}

/**
 * FloorRequestInformation 属性 — RFC 4582 §5.2.15
 * @extends Attribute
 */
class FloorRequestInformation extends Attribute
{
  constructor(floorRequestId, floorId, requestStatus)
  {
    super(Type.FloorRequestInformation, Length.FloorRequestInformation, Format.Grouped, [
      floorRequestId,
      new FloorRequestStatus(floorId, requestStatus)
    ]);
  }
}

module.exports = {
  BeneficiaryId,
  FloorId,
  FloorRequestId,
  RequestStatus,
  SupportedAttributes,
  SupportedPrimitives,
  FloorRequestStatus,
  FloorRequestInformation
};
