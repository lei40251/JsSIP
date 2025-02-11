const FloorRequestStatus = require('../messages/floorRequestStatus.js');
const FloorStatus = require('../messages/floorStatus.js');
const Primitive = require('../messages/primitive.js');
const Hello = require('../messages/hello.js');
const HelloAck = require('../messages/helloAck.js');
const RequestStatusValue = require('../messages/requestStatusValue.js');
const Parser = require('../parser/parser.js');
const AttrName = require('../attributes/name.js');

/**
 * @classdesc
 * This class is a abstract representation of a User in the BFCP environment,
 * and is used as the primary interface to this library. A User receive and
 * returns BFCP messages totally in the binary form, as like when receiving
 * from TCP/UDP sockets, so the application who utilize it doesn't need to
 * know anything about the codification and decodification of BFCP messages.
 * @memberof bfcp-lib
 */
class User
{
  /**
   * @param {String} userId       A string representing the User ID
   * @param {String} conferenceId A string representing the Conference ID
   * @constructor
   */
  constructor(userId, conferenceId)
  {
    this._userId = parseInt(userId);
    this._conferenceId = parseInt(conferenceId);
    this._currentMessage = null;
    this._currentTransactionId = 0;
    this._floorRequestId = 0;
  }

  /**
   * Gets the User ID
   * @return {Integer} User ID
   */
  get userId()
  {
    return this._userId;
  }

  set userId(userId)
  {
    this._userId = userId;
  }

  /**
   * Gets the Conference ID
   * @return {Integer} Conference ID
   */
  get conferenceId()
  {
    return this._conferenceId;
  }

  set conferenceId(conferenceId)
  {
    this._conferenceId = conferenceId;
  }

  /**
   * Gets the current message
   * @return {bfcp-lib.Message} This User last message received by the method
   * 'receiveMessage'
   */
  get currentMessage()
  {
    return this._currentMessage;
  }

  set currentMessage(currentMessage)
  {
    this._currentMessage = currentMessage;
  }

  /**
   * Gets the current transaction id
   * @return {Integer} Current transaction id
   */
  get currentTransactionId()
  {
    return this._currentTransactionId;
  }

  set currentTransactionId(currentTransactionId)
  {
    this._currentTransactionId = currentTransactionId;
  }

  /**
   * Gets the wanted floor id
   * @return {Integer} This user last wanted floor id received by a
   * FloorRequest Message
   */
  get wantedFloorId()
  {
    return this._wantedFloorId;
  }

  set wantedFloorId(wantedFloorId)
  {
    this._wantedFloorId = wantedFloorId;
  }

  /**
   * Gets the actual floor request id
   * @return {Integer} Floor request id
   * @static
   */
  static getFloorRequestId()
  {
    return this.FloorRequestId;
  }

  /**
   * Increments the actual floor request id
   */
  static incFloorRequestId()
  {
    this.FloorRequestId++;
  }

  // 将十六进制字符串转换为 Uint8Array
  static hexStringToUint8Array(hexString)
  {
  // 去掉空格和换行符
    hexString = hexString.replace(/\s+/g, '');

    // 检查长度是否为偶数
    if (hexString.length % 2 !== 0)
    {
      throw new Error('Invalid hex string length.');
    }

    // 将十六进制字符串转换为 Uint8Array
    const length = hexString.length / 2;
    const uint8Array = new Uint8Array(length);

    for (let i = 0; i < length; i++)
    {
      const byte = hexString.substr(i * 2, 2);

      uint8Array[i] = parseInt(byte, 16);
    }

    return uint8Array; // 返回 Uint8Array，而不是二进制字符串
  }

  static base64ToUint8Array(base64String)
  {
    // 去掉空格和换行符
    base64String = base64String.replace(/\s+/g, '');

    // 使用 atob 解码 Base64 字符串
    const binaryString = atob(base64String);

    // 将二进制字符串转换为 Uint8Array
    const length = binaryString.length;
    const uint8Array = new Uint8Array(length);

    for (let i = 0; i < length; i++)
    {
      uint8Array[i] = binaryString.charCodeAt(i); // 获取每个字符的 ASCII 码
    }

    return uint8Array;
  }

  /**
   * Receives a buffered message, parses it to a BFCP Message Object,
   * sets it as the current message and returns it.
   * @param  {Buffer} message The buffered Message
   * @return {bfcp-lib.Message} The BFCP Message Object
   * @public
   */
  receiveMessage(message)
  {
    try
    {
      const bfcpMessage = Parser.parseMessage(message);

      this.currentMessage = bfcpMessage;

      return bfcpMessage;
    }
    catch (error)
    {
      throw error;
    }
  }

  // 心跳消息
  helloMessage(transactionId, floorId)
  {
    const hello = new Hello(this.conferenceId, transactionId, this.userId, floorId);

    return Buffer.from(hello.encode());
  }

  /**
   * Gets a buffered HelloAck message
   * @param  {bfcp-lib.Message.Hello} helloMessage The Hello message that the HelloAck
   * will respond to.
   * @return {bfcp-lib.Message.HelloAck}  The HelloAck buffered message
   * @public
   */
  helloAckMessage(helloMessage)
  {
    const helloAck = new HelloAck(this.conferenceId, helloMessage.commonHeader.transactionId, this.userId);

    return Buffer.from(helloAck.encode());
  }

  /**
   * Gets a buffered FloorRequestStatus message
   * @param  {bfcp-lib.Message.FloorRequest | bfcp-lib.Message.FloorRelease} message
   * The FloorRequest or Release message that the FloorRequestStatus will respond to.
   * @param  {Integer} floorId The floor id
   * @param  {bfcp-lib.Message.RequestStatusValue} requestStatus The request status
   * @return {bfcp-lib.Message.FloorRequestStatus} The FloorRequestStatus buffered message
   * @public
   */
  floorRequestStatusMessage(message, floorId, requestStatus)
  {
    let floorRequestId;

    if (message.commonHeader.primitive == Primitive.FloorRequest)
    {
      if (requestStatus == RequestStatusValue.Granted)
      {
        User.incFloorRequestId();
      }
      floorRequestId = User.getFloorRequestId();
    }
    else
    {
      floorRequestId = message.getAttribute(AttrName.FloorRequestId).content;
    }
    // eslint-disable-next-line max-len
    const floorRequestStatus = new FloorRequestStatus(this.conferenceId, message.commonHeader.transactionId, this.userId, floorRequestId, floorId, requestStatus);


    return Buffer.from(floorRequestStatus.encode());
  }

  /**
   * Gets a buffered FloorStatus message
   * @param  {Integer} floorId The floor id
   * @param  {bfcp-lib.Message.RequestStatusValue} requestStatus The request status
   * @return {bfcp-lib.Message.FloorStatus} The FloorStatus buffered message
   * @public
   */
  floorStatusMessage(floorId, requestStatus)
  {
    if (this.currentMessage)
    {
      if (this.currentMessage.commonHeader.transactionId > this.currentTransactionId)
      {
        this.currentTransactionId = this.currentMessage.commonHeader.transactionId;
      }
    }
    this.currentTransactionId++;
    const floorStatus = new FloorStatus(this.conferenceId, this.currentTransactionId, this.userId, User.getFloorRequestId(), floorId, requestStatus);


    return Buffer.from(floorStatus.encode());
  }
}

User.FloorRequestId = 0;
module.exports = User;
