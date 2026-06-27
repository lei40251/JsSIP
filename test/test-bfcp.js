/* eslint-disable no-console */
const assert = require('assert');

// =============================================================================
// BFCP (Binary Floor Control Protocol) Test Suite
// Covers: constants, attributes, messages, parser, User API, round-trip
// Based on RFC 4582
// =============================================================================

// --- Load all BFCP modules ------------------------------------------------
const Primitive = require('../lib/BFCP/messages/Primitive.js');
const RequestStatusValue = require('../lib/BFCP/messages/RequestStatusValue.js');
const PayloadLength = require('../lib/BFCP/messages/PayloadLength.js');
const CommonHeader = require('../lib/BFCP/messages/CommonHeader.js');
const Message = require('../lib/BFCP/messages/Message.js');
const Hello = require('../lib/BFCP/messages/Hello.js');
const HelloAck = require('../lib/BFCP/messages/HelloAck.js');
const FloorRequest = require('../lib/BFCP/messages/FloorRequest.js');
const FloorRelease = require('../lib/BFCP/messages/FloorRelease.js');
const FloorRequestStatusMsg = require('../lib/BFCP/messages/FloorRequestStatus.js');
const FloorRequestStatusAck = require('../lib/BFCP/messages/FloorRequestStatusAck.js');
const FloorStatus = require('../lib/BFCP/messages/FloorStatus.js');
const FloorStatusAck = require('../lib/BFCP/messages/FloorStatusAck.js');
const FloorQuery = require('../lib/BFCP/messages/FloorQuery.js');

const Attribute = require('../lib/BFCP/attributes/Attribute.js');
const Type = require('../lib/BFCP/attributes/Type.js');
const Format = require('../lib/BFCP/attributes/Format.js');
const Length = require('../lib/BFCP/attributes/Length.js');
const Name = require('../lib/BFCP/AttributeName.js');
const { FloorId, FloorRequestId, BeneficiaryId, RequestStatus, FloorRequestStatus: FloorRequestStatusAtr, FloorRequestInformation, SupportedAttributes, SupportedPrimitives } = require('../lib/BFCP/AttributeClasses.js');

const Complements = require('../lib/BFCP/parser/Complements.js');
const Parser = require('../lib/BFCP/parser/Parser.js');
const User = require('../lib/BFCP/user/User.js');
const BFCPLib = require('../lib/BFCP/index.js');

// =============================================================================
// Test Runner
// =============================================================================

const tests = [];

function test(name, fn)
{
  tests.push({ name, fn });
}

function run()
{
  return new Promise((resolve, reject) =>
  {
    let passed = 0;
    let failed = 0;
    const failures = [];

    for (const t of tests)
    {
      try
      {
        t.fn();
        passed++;
      }
      catch (e)
      {
        failed++;
        failures.push({ name: t.name, error: e });
      }
    }

    // Only print failures, not every passing test
    if (failures.length > 0)
    {
      console.log(`\n  BFCP Failures (${failed}):`);
      for (const f of failures)
      {
        console.log(`    ✗ ${f.name}`);
        console.log(`      ${f.error.message}`);
      }
    }

    console.log(`  BFCP Tests: ${passed} passed, ${failed} failed, ${tests.length} total`);

    if (failed > 0)
    {
      reject(new Error(`${failed} BFCP test(s) failed`));
    }
    else
    {
      resolve();
    }
  });
}

/**
 * Encode a BFCP message into a Buffer (simulating what User methods do).
 */
function encodeMessage(message)
{
  return Buffer.from(message.encode());
}

// =============================================================================
// 1. CONSTANTS / ENUMS
// =============================================================================

test('Primitive constants have correct values', () =>
{
  assert.strictEqual(Primitive.FloorRequest, 1);
  assert.strictEqual(Primitive.FloorRelease, 2);
  assert.strictEqual(Primitive.FloorRequestQuery, 3);
  assert.strictEqual(Primitive.FloorRequestStatus, 4);
  assert.strictEqual(Primitive.UserQuery, 5);
  assert.strictEqual(Primitive.UserStatus, 6);
  assert.strictEqual(Primitive.FloorQuery, 7);
  assert.strictEqual(Primitive.FloorStatus, 8);
  assert.strictEqual(Primitive.ChairAction, 9);
  assert.strictEqual(Primitive.ChairActionAck, 10);
  assert.strictEqual(Primitive.Hello, 11);
  assert.strictEqual(Primitive.HelloAck, 12);
  assert.strictEqual(Primitive.Error, 13);
  assert.strictEqual(Primitive.FloorRequestStatusAck, 14);
  assert.strictEqual(Primitive.FloorStatusAck, 15);
  assert.strictEqual(Primitive.Goodbye, 16);
  assert.strictEqual(Primitive.GoodbyeAck, 17);
});

test('RequestStatusValue constants have correct values', () =>
{
  assert.strictEqual(RequestStatusValue.Pending, 1);
  assert.strictEqual(RequestStatusValue.Accepted, 2);
  assert.strictEqual(RequestStatusValue.Granted, 3);
  assert.strictEqual(RequestStatusValue.Denied, 4);
  assert.strictEqual(RequestStatusValue.Cancelled, 5);
  assert.strictEqual(RequestStatusValue.Released, 6);
  assert.strictEqual(RequestStatusValue.Revoked, 7);
});

test('Attribute Type constants have correct values', () =>
{
  assert.strictEqual(Type.BeneficiaryId, 1);
  assert.strictEqual(Type.FloorId, 2);
  assert.strictEqual(Type.FloorRequestId, 3);
  assert.strictEqual(Type.Priority, 4);
  assert.strictEqual(Type.RequestStatus, 5);
  assert.strictEqual(Type.ErrorCode, 6);
  assert.strictEqual(Type.ErrorInfo, 7);
  assert.strictEqual(Type.ParticipantProvidedInfo, 8);
  assert.strictEqual(Type.StatusInfo, 9);
  assert.strictEqual(Type.SupportedAttributes, 10);
  assert.strictEqual(Type.SupportedPrimitives, 11);
  assert.strictEqual(Type.UserDisplayName, 12);
  assert.strictEqual(Type.UserUri, 13);
  assert.strictEqual(Type.BeneficiaryInformation, 14);
  assert.strictEqual(Type.FloorRequestInformation, 15);
  assert.strictEqual(Type.RequestedByInformation, 16);
  assert.strictEqual(Type.FloorRequestStatus, 17);
  assert.strictEqual(Type.OverallRequestStatus, 18);
});

test('Format constants have correct values', () =>
{
  assert.strictEqual(Format.Unsigned16, 'Unsigned16');
  assert.strictEqual(Format.OctetString16, 'OctetString16');
  assert.strictEqual(Format.OctetString, 'OctetString');
  assert.strictEqual(Format.Grouped, 'Grouped');
});

test('Length constants have correct values', () =>
{
  assert.strictEqual(Length.BeneficiaryId, 4);
  assert.strictEqual(Length.FloorId, 4);
  assert.strictEqual(Length.FloorRequestId, 4);
  assert.strictEqual(Length.Priority, 4);
  assert.strictEqual(Length.RequestStatus, 4);
  assert.strictEqual(Length.SupportedAttributes, 2);
  assert.strictEqual(Length.SupportedPrimitives, 2);
  assert.strictEqual(Length.FloorRequestInformation, 12);
  assert.strictEqual(Length.FloorRequestStatus, 8);
});

test('Attribute Name constants have correct values', () =>
{
  assert.strictEqual(Name.BeneficiaryId, 'BeneficiaryId');
  assert.strictEqual(Name.FloorId, 'FloorId');
  assert.strictEqual(Name.FloorRequestId, 'FloorRequestId');
  assert.strictEqual(Name.RequestStatus, 'RequestStatus');
  assert.strictEqual(Name.SupportedAttributes, 'SupportedAttributes');
  assert.strictEqual(Name.SupportedPrimitives, 'SupportedPrimitives');
  assert.strictEqual(Name.FloorRequestInformation, 'FloorRequestInformation');
  assert.strictEqual(Name.FloorRequestStatus, 'FloorRequestStatus');
});

test('PayloadLength constants have correct values', () =>
{
  assert.strictEqual(PayloadLength.Hello, 1);
  assert.strictEqual(PayloadLength.HelloAck, 3);
  assert.strictEqual(PayloadLength.FloorRequest, 1);
  assert.strictEqual(PayloadLength.FloorRelease, 1);
  assert.strictEqual(PayloadLength.FloorRequestStatus, 4);
  assert.strictEqual(PayloadLength.FloorStatus, 4);
  assert.strictEqual(PayloadLength.FloorRequestStatusAck, 1);
  assert.strictEqual(PayloadLength.FloorStatusAck, 1);
});

// =============================================================================
// 2. COMPLEMENTS (binary utilities)
// =============================================================================

test('complementBinary pads binary to required length', () =>
{
  assert.strictEqual(Complements.complementBinary('1010', 8), '00001010');
  assert.strictEqual(Complements.complementBinary('11111111', 8), '11111111');
  assert.strictEqual(Complements.complementBinary('1', 32), '00000000000000000000000000000001');
});

test('complementBinary does not truncate when already at or over length', () =>
{
  assert.strictEqual(Complements.complementBinary('11111111', 8), '11111111');
  assert.strictEqual(Complements.complementBinary('11111111', 4), '11111111');
});

test('complementPadding pads to 32-bit boundary', () =>
{
  const short = '00000000';

  assert.strictEqual(Complements.complementPadding(short).length, 32);

  const already32 = '0'.repeat(32);

  assert.strictEqual(Complements.complementPadding(already32), already32);
});

// =============================================================================
// 3. ATTRIBUTES - Creation & Properties
// =============================================================================

test('FloorId attribute creation and properties', () =>
{
  const fid = new FloorId(5);

  assert.strictEqual(fid.type, Type.FloorId);
  assert.strictEqual(fid.length, Length.FloorId);
  assert.strictEqual(fid.format, Format.Unsigned16);
  assert.strictEqual(fid.content, 5);
});

test('FloorId attribute with zero value', () =>
{
  const fid = new FloorId(0);

  assert.strictEqual(fid.content, 0);
});

test('FloorRequestId attribute creation and properties', () =>
{
  const frid = new FloorRequestId(42);

  assert.strictEqual(frid.type, Type.FloorRequestId);
  assert.strictEqual(frid.length, Length.FloorRequestId);
  assert.strictEqual(frid.format, Format.Unsigned16);
  assert.strictEqual(frid.content, 42);
});

test('BeneficiaryId attribute creation and properties', () =>
{
  const bid = new BeneficiaryId(100);

  assert.strictEqual(bid.type, Type.BeneficiaryId);
  assert.strictEqual(bid.length, Length.BeneficiaryId);
  assert.strictEqual(bid.format, Format.Unsigned16);
  assert.strictEqual(bid.content, 100);
});

test('RequestStatus attribute with explicit queue position', () =>
{
  const rs = new RequestStatus(RequestStatusValue.Granted, 2);

  assert.strictEqual(rs.type, Type.RequestStatus);
  assert.strictEqual(rs.length, Length.RequestStatus);
  assert.strictEqual(rs.format, Format.OctetString16);
  assert.strictEqual(rs.content[0], RequestStatusValue.Granted);
  assert.strictEqual(rs.content[1], 2);
});

test('RequestStatus attribute defaults queue position to 0', () =>
{
  const rs = new RequestStatus(RequestStatusValue.Pending);

  assert.strictEqual(rs.content[0], RequestStatusValue.Pending);
  assert.strictEqual(rs.content[1], 0);
});

test('RequestStatus attribute defaults queue position when explicitly null', () =>
{
  const rs = new RequestStatus(RequestStatusValue.Accepted, null);

  assert.strictEqual(rs.content[1], 0);
});

test('FloorRequestStatus (attribute) creation', () =>
{
  const frs = new FloorRequestStatusAtr(1, RequestStatusValue.Granted);

  assert.strictEqual(frs.type, Type.FloorRequestStatus);
  assert.strictEqual(frs.length, Length.FloorRequestStatus);
  assert.strictEqual(frs.format, Format.Grouped);
  assert.strictEqual(frs.content[0], 1);
  assert.ok(frs.content[1] instanceof RequestStatus);
  assert.strictEqual(frs.content[1].content[0], RequestStatusValue.Granted);
});

test('FloorRequestInformation attribute creation', () =>
{
  const fri = new FloorRequestInformation(10, 2, RequestStatusValue.Accepted);

  assert.strictEqual(fri.type, Type.FloorRequestInformation);
  assert.strictEqual(fri.length, Length.FloorRequestInformation);
  assert.strictEqual(fri.format, Format.Grouped);
  assert.strictEqual(fri.content[0], 10);
  assert.ok(fri.content[1] instanceof FloorRequestStatusAtr);
  assert.strictEqual(fri.content[1].content[0], 2);
  assert.strictEqual(fri.content[1].content[1].content[0], RequestStatusValue.Accepted);
});

test('SupportedAttributes default constructor includes common types', () =>
{
  const sa = new SupportedAttributes();

  assert.strictEqual(sa.type, Type.SupportedAttributes);
  assert.strictEqual(sa.format, Format.OctetString);
  assert.ok(sa.length > Length.SupportedAttributes);
  assert.ok(sa.content.includes(Type.FloorId));
  assert.ok(sa.content.includes(Type.FloorRequestId));
  assert.ok(sa.content.includes(Type.SupportedAttributes));
  assert.ok(sa.content.includes(Type.SupportedPrimitives));
});

test('SupportedAttributes with custom list', () =>
{
  const sa = new SupportedAttributes([ Type.FloorId, Type.FloorRequestId ]);

  assert.strictEqual(sa.content.length, 2);
  assert.strictEqual(sa.content[0], Type.FloorId);
  assert.strictEqual(sa.content[1], Type.FloorRequestId);
  assert.strictEqual(sa.length, 4);
});

test('SupportedPrimitives default constructor includes standard primitives', () =>
{
  const sp = new SupportedPrimitives();

  assert.strictEqual(sp.type, Type.SupportedPrimitives);
  assert.strictEqual(sp.format, Format.OctetString);
  assert.ok(sp.content.includes(Primitive.FloorRequest));
  assert.ok(sp.content.includes(Primitive.FloorRequestStatus));
  assert.ok(sp.content.includes(Primitive.FloorStatus));
  assert.ok(sp.content.includes(Primitive.Hello));
  assert.ok(sp.content.includes(Primitive.HelloAck));
  assert.ok(sp.content.includes(Primitive.Error));
  assert.ok(sp.content.includes(Primitive.FloorRequestStatusAck));
});

test('SupportedPrimitives with custom list', () =>
{
  const sp = new SupportedPrimitives([ Primitive.Hello, Primitive.HelloAck ]);

  assert.strictEqual(sp.content.length, 2);
  assert.strictEqual(sp.content[0], Primitive.Hello);
  assert.strictEqual(sp.content[1], Primitive.HelloAck);
});

// =============================================================================
// 4. ATTRIBUTE - Encode: Unsigned16 format
// =============================================================================

test('FloorId encode produces correct binary', () =>
{
  const fid = new FloorId(5);
  const encoded = fid.encode();

  assert.strictEqual(parseInt(encoded.substring(0, 7), 2), Type.FloorId);
  assert.strictEqual(encoded[7], '1'); // Mandatory bit
  assert.strictEqual(parseInt(encoded.substring(8, 16), 2), Length.FloorId);
  assert.strictEqual(parseInt(encoded.substring(16, 32), 2), 5);
  assert.strictEqual(encoded.length, 32); // Padded to 32-bit boundary
});

test('BeneficiaryId encode produces correct binary', () =>
{
  const bid = new BeneficiaryId(7);
  const encoded = bid.encode();

  assert.strictEqual(parseInt(encoded.substring(0, 7), 2), Type.BeneficiaryId);
  assert.strictEqual(encoded[7], '1');
  assert.strictEqual(parseInt(encoded.substring(8, 16), 2), 4);
  assert.strictEqual(parseInt(encoded.substring(16, 32), 2), 7);
});

test('FloorRequestId encode produces correct binary', () =>
{
  const frid = new FloorRequestId(99);
  const encoded = frid.encode();

  assert.strictEqual(parseInt(encoded.substring(0, 7), 2), Type.FloorRequestId);
  assert.strictEqual(parseInt(encoded.substring(16, 32), 2), 99);
});

// =============================================================================
// 5. ATTRIBUTE - Encode: OctetString format
// =============================================================================

test('SupportedAttributes encode produces correct binary', () =>
{
  const sa = new SupportedAttributes([ Type.FloorId, Type.FloorRequestId ]);
  const encoded = sa.encode();

  assert.strictEqual(parseInt(encoded.substring(0, 7), 2), Type.SupportedAttributes);
  assert.strictEqual(encoded[7], '1');
  // Each supported type: 7 bits type + 1 pad bit = 8 bits per entry
  // Type.FloorId=2 -> '0000010'+'0'='00000100'=4, Type.FloorRequestId=3 -> '0000011'+'0'='00000110'=6
  assert.strictEqual(parseInt(encoded.substring(16, 24), 2), 4);
  assert.strictEqual(parseInt(encoded.substring(24, 32), 2), 6);
});

test('SupportedPrimitives encode produces correct binary', () =>
{
  const sp = new SupportedPrimitives([ Primitive.Hello, Primitive.HelloAck ]);
  const encoded = sp.encode();

  assert.strictEqual(parseInt(encoded.substring(0, 7), 2), Type.SupportedPrimitives);
  assert.strictEqual(parseInt(encoded.substring(16, 24), 2), Primitive.Hello);
  assert.strictEqual(parseInt(encoded.substring(24, 32), 2), Primitive.HelloAck);
});

// =============================================================================
// 6. ATTRIBUTE - Encode: Grouped format
// =============================================================================

test('FloorRequestInformation encode (Grouped) produces valid binary', () =>
{
  const fri = new FloorRequestInformation(10, 2, RequestStatusValue.Granted);
  const encoded = fri.encode();

  assert.strictEqual(parseInt(encoded.substring(0, 7), 2), Type.FloorRequestInformation);
  assert.strictEqual(encoded[7], '1');
  assert.strictEqual(parseInt(encoded.substring(16, 32), 2), 10); // floorRequestId
});

test('FloorRequestStatus attribute encode (Grouped) produces valid binary', () =>
{
  const frs = new FloorRequestStatusAtr(3, RequestStatusValue.Denied);
  const encoded = frs.encode();

  assert.strictEqual(parseInt(encoded.substring(0, 7), 2), Type.FloorRequestStatus);
  assert.strictEqual(parseInt(encoded.substring(16, 32), 2), 3); // floorId
});

// =============================================================================
// 7. ATTRIBUTE - Encode: OctetString16 format
// =============================================================================

test('RequestStatus encode (OctetString16) produces correct binary', () =>
{
  const rs = new RequestStatus(RequestStatusValue.Granted, 5);
  const encoded = rs.encode();

  assert.strictEqual(parseInt(encoded.substring(0, 7), 2), Type.RequestStatus);
  assert.strictEqual(encoded[7], '1');
  assert.strictEqual(parseInt(encoded.substring(8, 16), 2), Length.RequestStatus);
  assert.strictEqual(parseInt(encoded.substring(16, 24), 2), RequestStatusValue.Granted);
  assert.strictEqual(parseInt(encoded.substring(24, 32), 2), 5);
});

// =============================================================================
// 8. COMMON HEADER
// =============================================================================

test('CommonHeader creation and getters/setters', () =>
{
  const ch = new CommonHeader(Primitive.Hello, 1, 100, 200, 50);

  assert.strictEqual(ch.primitive, Primitive.Hello);
  assert.strictEqual(ch.payloadLength, 1);
  assert.strictEqual(ch.conferenceId, 100);
  assert.strictEqual(ch.transactionId, 200);
  assert.strictEqual(ch.userId, 50);

  ch.primitive = Primitive.FloorRequest;
  ch.payloadLength = 4;
  ch.conferenceId = 999;
  ch.transactionId = 555;
  ch.userId = 333;

  assert.strictEqual(ch.primitive, Primitive.FloorRequest);
  assert.strictEqual(ch.payloadLength, 4);
  assert.strictEqual(ch.conferenceId, 999);
  assert.strictEqual(ch.transactionId, 555);
  assert.strictEqual(ch.userId, 333);
});

test('CommonHeader encode produces 96-bit string with correct structure', () =>
{
  const ch = new CommonHeader(Primitive.Hello, 1, 0, 0, 0);
  const encoded = ch.encode();

  assert.strictEqual(encoded.length, 96);
  assert.strictEqual(encoded.substring(0, 3), '001'); // version
  assert.strictEqual(encoded.substring(3, 8), '00000'); // reserved
  assert.strictEqual(parseInt(encoded.substring(8, 16), 2), Primitive.Hello);
  assert.strictEqual(parseInt(encoded.substring(16, 32), 2), 1); // payloadLen
  assert.strictEqual(parseInt(encoded.substring(32, 64), 2), 0); // confId
  assert.strictEqual(parseInt(encoded.substring(64, 80), 2), 0); // txId
  assert.strictEqual(parseInt(encoded.substring(80, 96), 2), 0); // userId
});

test('CommonHeader encode with non-zero values', () =>
{
  const ch = new CommonHeader(Primitive.FloorRequestStatus, 4, 42, 7, 13);
  const encoded = ch.encode();

  assert.strictEqual(parseInt(encoded.substring(8, 16), 2), 4);
  assert.strictEqual(parseInt(encoded.substring(16, 32), 2), 4);
  assert.strictEqual(parseInt(encoded.substring(32, 64), 2), 42);
  assert.strictEqual(parseInt(encoded.substring(64, 80), 2), 7);
  assert.strictEqual(parseInt(encoded.substring(80, 96), 2), 13);
});

// =============================================================================
// 9. MESSAGE - Base class
// =============================================================================

test('Message getAttribute finds attribute by constructor name', () =>
{
  const ch = new CommonHeader(Primitive.Hello, 1, 1, 1, 1);
  const fid = new FloorId(5);
  const msg = new Message(ch, [ fid ]);

  const found = msg.getAttribute('FloorId');

  assert.ok(found instanceof FloorId);
  assert.strictEqual(found.content, 5);
});

test('Message getAttribute returns null for missing attribute', () =>
{
  const ch = new CommonHeader(Primitive.Hello, 1, 1, 1, 1);
  const msg = new Message(ch, []);

  assert.strictEqual(msg.getAttribute('FloorId'), null);
});

test('Message encode returns valid octet array', () =>
{
  const ch = new CommonHeader(Primitive.Hello, 1, 100, 200, 50);
  const msg = new Message(ch, [ new FloorId(5) ]);
  const octets = msg.encode();

  assert.ok(Array.isArray(octets));
  assert.ok(octets.length > 0);
  for (const octet of octets)
  {
    assert.ok(octet >= 0 && octet <= 255, `Octet ${octet} out of range [0,255]`);
  }
  // Hello: commonHeader(96 bits=12 octets) + FloorId(32 bits=4 octets) = 16 octets
  assert.strictEqual(octets.length, 16);
});

// =============================================================================
// 10. MESSAGES - All message type constructions
// =============================================================================

test('Hello message construction', () =>
{
  const hello = new Hello(1, 100, 50, 5);

  assert.strictEqual(hello.commonHeader.primitive, Primitive.Hello);
  assert.strictEqual(hello.commonHeader.conferenceId, 1);
  assert.strictEqual(hello.commonHeader.transactionId, 100);
  assert.strictEqual(hello.commonHeader.userId, 50);
  assert.strictEqual(hello.commonHeader.payloadLength, PayloadLength.Hello);
  assert.strictEqual(hello.attributes.length, 1);
  assert.ok(hello.attributes[0] instanceof FloorId);
  assert.strictEqual(hello.attributes[0].content, 5);
  assert.ok(Buffer.isBuffer(encodeMessage(hello)));
});

test('HelloAck message construction', () =>
{
  const ha = new HelloAck(1, 100, 50);

  assert.strictEqual(ha.commonHeader.primitive, Primitive.HelloAck);
  assert.strictEqual(ha.commonHeader.payloadLength, PayloadLength.HelloAck);
  assert.strictEqual(ha.attributes.length, 2);
  assert.ok(ha.attributes[0] instanceof SupportedPrimitives);
  assert.ok(ha.attributes[1] instanceof SupportedAttributes);
});

test('FloorRequest message construction', () =>
{
  const fr = new FloorRequest(1, 200, 30, 2);

  assert.strictEqual(fr.commonHeader.primitive, Primitive.FloorRequest);
  assert.strictEqual(fr.commonHeader.payloadLength, PayloadLength.FloorRequest);
  assert.ok(fr.attributes[0] instanceof FloorId);
  assert.strictEqual(fr.attributes[0].content, 2);
});

test('FloorRelease message construction', () =>
{
  const fr = new FloorRelease(1, 300, 40, 99);

  assert.strictEqual(fr.commonHeader.primitive, Primitive.FloorRelease);
  assert.strictEqual(fr.commonHeader.payloadLength, PayloadLength.FloorRelease);
  assert.ok(fr.attributes[0] instanceof FloorRequestId);
  assert.strictEqual(fr.attributes[0].content, 99);
});

test('FloorRequestStatusMsg construction', () =>
{
  const frs = new FloorRequestStatusMsg(1, 400, 50, 10, 3, RequestStatusValue.Granted);

  assert.strictEqual(frs.commonHeader.primitive, Primitive.FloorRequestStatus);
  assert.strictEqual(frs.commonHeader.payloadLength, PayloadLength.FloorRequestStatus);
  assert.ok(frs.attributes[0] instanceof FloorRequestInformation);
  assert.strictEqual(frs.attributes[0].content[0], 10);
  assert.strictEqual(frs.attributes[0].content[1].content[0], 3);
  assert.strictEqual(frs.attributes[0].content[1].content[1].content[0],
    RequestStatusValue.Granted);
});

test('FloorRequestStatusAck construction', () =>
{
  const frsa = new FloorRequestStatusAck(1, 500, 60, 3);

  assert.strictEqual(frsa.commonHeader.primitive, Primitive.FloorRequestStatusAck);
  assert.strictEqual(frsa.commonHeader.payloadLength, PayloadLength.FloorRequestStatusAck);
  assert.ok(frsa.attributes[0] instanceof FloorId);
  assert.strictEqual(frsa.attributes[0].content, 3);
});

test('FloorStatus message construction', () =>
{
  const fs = new FloorStatus(1, 600, 70, 20, 5, RequestStatusValue.Accepted);

  assert.strictEqual(fs.commonHeader.primitive, Primitive.FloorStatus);
  assert.strictEqual(fs.commonHeader.payloadLength, PayloadLength.FloorStatus);
  assert.ok(fs.attributes[0] instanceof FloorRequestInformation);
  assert.strictEqual(fs.attributes[0].content[0], 20);
});

test('FloorStatusAck message construction', () =>
{
  const fsa = new FloorStatusAck(1, 700, 80, 4);

  assert.strictEqual(fsa.commonHeader.primitive, Primitive.FloorStatusAck);
  assert.strictEqual(fsa.commonHeader.payloadLength, PayloadLength.FloorStatusAck);
  assert.ok(fsa.attributes[0] instanceof FloorId);
  assert.strictEqual(fsa.attributes[0].content, 4);
});

test('FloorQuery message construction', () =>
{
  const fq = new FloorQuery(1, 800, 90, 6);

  assert.strictEqual(fq.commonHeader.primitive, Primitive.FloorQuery);
  assert.strictEqual(fq.commonHeader.payloadLength, PayloadLength.FloorQuery);
  assert.ok(fq.attributes[0] instanceof FloorId);
  assert.strictEqual(fq.attributes[0].content, 6);
});

// =============================================================================
// 11. ROUND-TRIP: Encode then Decode (Parser.parseMessage)
// =============================================================================

function roundTrip(name, message, expectedClass, checks)
{
  test(name, () =>
  {
    const buf = encodeMessage(message);
    const parsed = Parser.parseMessage(buf);

    assert.strictEqual(parsed.commonHeader.primitive, message.commonHeader.primitive);
    assert.strictEqual(parsed.commonHeader.conferenceId, message.commonHeader.conferenceId);
    assert.strictEqual(parsed.commonHeader.transactionId, message.commonHeader.transactionId);
    assert.strictEqual(parsed.commonHeader.userId, message.commonHeader.userId);
    assert.ok(parsed instanceof expectedClass);

    if (checks)
    {
      checks(parsed);
    }
  });
}

roundTrip('Round-trip: Hello', new Hello(100, 200, 50, 5), Hello, (p) =>
{
  assert.strictEqual(p.getAttribute('FloorId').content, 5);
});

roundTrip('Round-trip: HelloAck', new HelloAck(200, 300, 60), HelloAck, (p) =>
{
  assert.ok(p.getAttribute('SupportedPrimitives'));
  assert.ok(p.getAttribute('SupportedAttributes'));
});

roundTrip('Round-trip: FloorRequest', new FloorRequest(300, 400, 70, 3), FloorRequest, (p) =>
{
  assert.strictEqual(p.getAttribute('FloorId').content, 3);
});

roundTrip('Round-trip: FloorRelease', new FloorRelease(400, 500, 80, 55), FloorRelease, (p) =>
{
  assert.strictEqual(p.getAttribute('FloorRequestId').content, 55);
});

roundTrip('Round-trip: FloorRequestStatus',
  new FloorRequestStatusMsg(500, 600, 90, 10, 3, RequestStatusValue.Granted),
  FloorRequestStatusMsg, (p) =>
  {
    const fri = p.getAttribute('FloorRequestInformation');

    assert.strictEqual(fri.content[0], 10);
    assert.strictEqual(fri.content[1].content[0], 3);
    assert.strictEqual(fri.content[1].content[1].content[0], RequestStatusValue.Granted);
  });

roundTrip('Round-trip: FloorRequestStatusAck',
  new FloorRequestStatusAck(600, 700, 100, 7), FloorRequestStatusAck, (p) =>
  {
    assert.strictEqual(p.getAttribute('FloorId').content, 7);
  });

roundTrip('Round-trip: FloorStatus',
  new FloorStatus(700, 800, 110, 20, 8, RequestStatusValue.Denied), FloorStatus, (p) =>
  {
    const fri = p.getAttribute('FloorRequestInformation');

    assert.strictEqual(fri.content[0], 20);
    assert.strictEqual(fri.content[1].content[0], 8);
    assert.strictEqual(fri.content[1].content[1].content[0], RequestStatusValue.Denied);
  });

roundTrip('Round-trip: FloorStatusAck',
  new FloorStatusAck(800, 900, 120, 9), FloorStatusAck, (p) =>
  {
    assert.strictEqual(p.getAttribute('FloorId').content, 9);
  });

roundTrip('Round-trip: FloorQuery', new FloorQuery(900, 1000, 130, 11), FloorQuery, (p) =>
{
  assert.strictEqual(p.getAttribute('FloorId').content, 11);
});

// =============================================================================
// 12. PARSER - Edge cases
// =============================================================================

test('Parser throws on unknown primitive', () =>
{
  // eslint-disable-next-line no-useless-concat
  const invalidBinary = `${'001' + '00000'}${ 
    Complements.complementBinary('255', 8) 
  }${Complements.complementBinary('0', 16) 
  }${Complements.complementBinary('0', 32) 
  }${Complements.complementBinary('0', 16) 
  }${Complements.complementBinary('0', 16)}`;
  const octets = [];

  for (let i = 0; i < invalidBinary.length / 8; i++)
  {
    octets.push(parseInt(invalidBinary.substring(i * 8, (i + 1) * 8), 2));
  }

  assert.throws(
    () => Parser.parseMessage(Buffer.from(octets)),
    /Problem parsing message|I can't decode/
  );
});

// =============================================================================
// 13. USER API
// =============================================================================

test('User construction parses userId and conferenceId as integers', () =>
{
  const user = new User('100', '200');

  assert.strictEqual(user.userId, 100);
  assert.strictEqual(user.conferenceId, 200);
  assert.strictEqual(user.currentTransactionId, 0);
  assert.strictEqual(user._floorRequestId, 0);
});

test('User setters and getters', () =>
{
  const user = new User('1', '2');

  user.userId = 999;
  user.conferenceId = 888;
  user.currentTransactionId = 777;

  assert.strictEqual(user.userId, 999);
  assert.strictEqual(user.conferenceId, 888);
  assert.strictEqual(user.currentTransactionId, 777);
});

test('User helloMessage returns Buffer', () =>
{
  const user = new User('100', '200');
  const buf = user.helloMessage(1, 5);

  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 0);
});

test('User helloAckMessage returns Buffer for valid Hello', () =>
{
  const user = new User('100', '200');
  const hello = new Hello(user.conferenceId, 1, user.userId, 5);
  const buf = user.helloAckMessage(hello);

  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 0);
});

test('User floorRequestMessage returns Buffer', () =>
{
  const user = new User('100', '200');
  const buf = user.floorRequestMessage(1, 3);

  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 0);
});

test('User floorReleaseMessage returns Buffer', () =>
{
  const user = new User('100', '200');
  const buf = user.floorReleaseMessage(1, 42);

  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 0);
});

test('User floorRequestStatusMessage (Granted) increments floorRequestId', () =>
{
  const user = new User('100', '200');
  const fr = new FloorRequest(user.conferenceId, 1, user.userId, 3);

  User.FloorRequestId = 0;
  const buf = user.floorRequestStatusMessage(fr, 3, RequestStatusValue.Granted);

  assert.ok(Buffer.isBuffer(buf));
  assert.ok(User.FloorRequestId > 0, 'FloorRequestId should increment for Granted');
});

test('User floorRequestStatusMessage for FloorRelease uses existing ID', () =>
{
  const user = new User('100', '200');
  const fr = new FloorRelease(user.conferenceId, 1, user.userId, 99);
  const buf = user.floorRequestStatusMessage(fr, 3, RequestStatusValue.Released);

  assert.ok(Buffer.isBuffer(buf));
});

test('User floorStatusMessage returns Buffer', () =>
{
  const user = new User('100', '200');
  const buf = user.floorStatusMessage(3, RequestStatusValue.Accepted, 1);

  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 0);
});

test('User floorStatusAckMessage returns Buffer', () =>
{
  const user = new User('100', '200');
  const floorStatus = new FloorStatus(user.conferenceId, 1, user.userId, 10, 3,
    RequestStatusValue.Granted);
  const buf = user.floorStatusAckMessage(3, floorStatus);

  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 0);
});

test('User receiveMessage parses Hello Buffer', () =>
{
  const user = new User('100', '200');
  const hello = new Hello(user.conferenceId, 1, user.userId, 5);
  const buf = encodeMessage(hello);
  const parsed = user.receiveMessage(buf);

  assert.ok(parsed instanceof Hello);
  assert.strictEqual(user.currentMessage, parsed);
});

test('User receiveMessage parses FloorRequest Buffer', () =>
{
  const user = new User('100', '200');
  const fr = new FloorRequest(user.conferenceId, 1, user.userId, 3);
  const buf = encodeMessage(fr);
  const parsed = user.receiveMessage(buf);

  assert.ok(parsed instanceof FloorRequest);
});

test('User receiveMessage parses FloorRequestStatus Buffer', () =>
{
  const user = new User('100', '200');
  const frs = new FloorRequestStatusMsg(user.conferenceId, 1, user.userId, 10, 3,
    RequestStatusValue.Granted);
  const buf = encodeMessage(frs);
  const parsed = user.receiveMessage(buf);

  assert.ok(parsed instanceof FloorRequestStatusMsg);
});

test('User full flow: Hello → HelloAck', () =>
{
  const userA = new User('100', '1000');
  const userB = new User('200', '1000');

  const helloMsg = userA.helloMessage(1, 1);
  const receivedHello = userB.receiveMessage(helloMsg);

  assert.ok(receivedHello instanceof Hello);

  const helloAck = userB.helloAckMessage(receivedHello);
  const receivedAck = userA.receiveMessage(helloAck);

  assert.ok(receivedAck instanceof HelloAck);
  assert.strictEqual(receivedAck.commonHeader.primitive, Primitive.HelloAck);
});

test('User full flow: FloorRequest → FloorRequestStatus → FloorRequestStatusAck', () =>
{
  const userA = new User('100', '1000');
  const userB = new User('200', '1000');

  // A sends FloorRequest
  const frMsg = userA.floorRequestMessage(1, 2);
  const receivedFr = userB.receiveMessage(frMsg);

  assert.ok(receivedFr instanceof FloorRequest);

  // B sends FloorRequestStatus (Granted)
  User.FloorRequestId = 0;
  const statusMsg = userB.floorRequestStatusMessage(receivedFr, 2, RequestStatusValue.Granted);
  const receivedStatus = userA.receiveMessage(statusMsg);

  assert.ok(receivedStatus instanceof FloorRequestStatusMsg);

  // A sends FloorRequestStatusAck
  const ackMsg = userA.floorRequestStatusAckMessage(receivedStatus);
  const receivedAck = userB.receiveMessage(ackMsg);

  assert.ok(receivedAck instanceof FloorRequestStatusAck);
});

test('User full flow: FloorStatus → FloorStatusAck', () =>
{
  const userA = new User('100', '1000');
  const userB = new User('200', '1000');

  User.FloorRequestId = 1;
  const fsMsg = userB.floorStatusMessage(2, RequestStatusValue.Granted, 5);
  const receivedFs = userA.receiveMessage(fsMsg);

  assert.ok(receivedFs instanceof FloorStatus);
  assert.strictEqual(receivedFs.commonHeader.transactionId, 5);

  const fsAckMsg = userA.floorStatusAckMessage(2, receivedFs);
  const receivedAck = userB.receiveMessage(fsAckMsg);

  assert.ok(receivedAck instanceof FloorStatusAck);
  assert.strictEqual(receivedAck.commonHeader.transactionId, 5);
});

// =============================================================================
// 14. User hex/base64 conversion utilities
// =============================================================================

test('User.hexStringToUint8Array converts hex correctly', () =>
{
  const result = User.hexStringToUint8Array('FF00AB');

  assert.ok(result instanceof Uint8Array);
  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0], 255);
  assert.strictEqual(result[1], 0);
  assert.strictEqual(result[2], 171);
});

test('User.hexStringToUint8Array handles whitespace', () =>
{
  const result = User.hexStringToUint8Array('FF 00 AB');

  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0], 255);
});

test('User.hexStringToUint8Array throws on odd-length hex', () =>
{
  assert.throws(
    () => User.hexStringToUint8Array('FF0'),
    /Invalid hex string length/
  );
});

test('User.base64ToUint8Array converts base64 correctly', () =>
{
  // 'AAEC' = [0, 1, 2]
  const result = User.base64ToUint8Array('AAEC');

  assert.ok(result instanceof Uint8Array);
  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0], 0);
  assert.strictEqual(result[1], 1);
  assert.strictEqual(result[2], 2);
});

// =============================================================================
// 15. BFCP Index module
// =============================================================================

test('BFCPLib exports User, Primitive, RequestStatusValue, AttributeName', () =>
{
  assert.strictEqual(BFCPLib.User, User);
  assert.strictEqual(BFCPLib.Primitive, Primitive);
  assert.strictEqual(BFCPLib.RequestStatusValue, RequestStatusValue);
  assert.strictEqual(BFCPLib.AttributeName, Name);
});

// =============================================================================
// 16. Attribute encode error paths
// =============================================================================

test('Attribute encode throws on unknown format', () =>
{
  const attr = new Attribute(99, 4, 'UnknownFormat', 0);

  assert.throws(() => attr.encode(), /Format unknown/);
});

test('Attribute encode throws on unknown OctetString type', () =>
{
  const attr = new Attribute(99, 4, Format.OctetString, [ 1, 2, 3 ]);

  assert.throws(() => attr.encode(), /Type unknown/);
});

test('Attribute encode throws on unknown OctetString16 type', () =>
{
  const attr = new Attribute(99, 4, Format.OctetString16, [ 1, 2 ]);

  assert.throws(() => attr.encode(), /Type unknown/);
});

test('Attribute encode (_encodeGroupedAttributeContent) throws on invalid content', () =>
{
  const attr = new Attribute(99, 8, Format.Grouped, [ { foo: 'bar' } ]);

  assert.throws(() => attr.encode(), /Unknown attribute!/);
});

// =============================================================================
// Module exports (for gulp test runner)
// =============================================================================

module.exports = { run };
