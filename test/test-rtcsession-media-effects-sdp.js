/* eslint-disable no-console */
const { runSuite } = require('./include/manual-test-suite');
const {
  assert,
  MockMediaStreamTrack,
  createMockUA,
  installGlobals,
  loadRTCSessionWithMockMixer,
  resetRtcSessionMediaEffectsTestState
} = require('./include/rtcsession-media-effects-test-helpers');

async function testCreateLocalDescriptionAppends720pGoogleBitrateFmtpOnlyForLocalDescription()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  let appliedDescription = null;
  let emittedSdp = null;

  session._sdpResolution = 'BP720P';
  session.on('sdp', (event) =>
  {
    emittedSdp = event.sdp;
  });
  session._connection = {
    iceGatheringState : 'complete',
    localDescription  : null,
    createOffer       : () => Promise.resolve({
      type : 'offer',
      sdp  : [
        'v=0',
        'o=- 0 0 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'a=group:BUNDLE 0 1',
        'm=audio 9 UDP/TLS/RTP/SAVPF 111',
        'c=IN IP4 0.0.0.0',
        'a=mid:0',
        'a=rtpmap:111 opus/48000/2',
        'm=video 9 UDP/TLS/RTP/SAVPF 96 97',
        'c=IN IP4 0.0.0.0',
        'a=mid:1',
        'a=rtpmap:96 H264/90000',
        'a=fmtp:96 profile-level-id=42e01f;packetization-mode=1',
        'a=rtpmap:97 rtx/90000',
        'a=fmtp:97 apt=96',
        ''
      ].join('\r\n')
    }),
    setLocalDescription : (desc) =>
    {
      appliedDescription = desc;
      session._connection.localDescription = desc;

      return Promise.resolve();
    }
  };

  await session._createLocalDescription('offer', {});

  assert.ok(appliedDescription);
  assert.ok(emittedSdp);
  assert.ok(appliedDescription.sdp.includes('a=fmtp:96 profile-level-id=42c01f;packetization-mode=1;x-google-min-bitrate=1946;x-google-max-bitrate=2378'));
  assert.ok(!appliedDescription.sdp.includes('a=fmtp:97 apt=96;x-google-min-bitrate=1946'));
  assert.ok(!emittedSdp.includes('x-google-min-bitrate=1946'));
  assert.ok(!emittedSdp.includes('x-google-max-bitrate=2378'));
}


async function testCreateLocalDescriptionAnswerUsesRemoteAsFor720pGoogleBitrateFmtp()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  let appliedDescription = null;
  let emittedSdp = null;

  session._sdpResolution = 'BP720P';
  session.on('sdp', (event) =>
  {
    emittedSdp = event.sdp;
  });
  session._lastRemoteOfferSdpForAnswer = [
    'v=0',
    'o=- 0 0 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0 1',
    'm=audio 9 UDP/TLS/RTP/SAVPF 111',
    'c=IN IP4 0.0.0.0',
    'a=mid:0',
    'a=rtpmap:111 opus/48000/2',
    'm=video 9 UDP/TLS/RTP/SAVPF 96 97',
    'c=IN IP4 0.0.0.0',
    'b=AS:2162',
    'a=mid:1',
    'a=rtpmap:96 H264/90000',
    'a=fmtp:96 profile-level-id=42e01f;packetization-mode=1',
    'a=rtpmap:97 rtx/90000',
    'a=fmtp:97 apt=96',
    ''
  ].join('\r\n');
  session._connection = {
    iceGatheringState : 'complete',
    localDescription  : null,
    remoteDescription : {
      type : 'offer',
      sdp  : [
        'v=0',
        'o=- 0 0 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'a=group:BUNDLE 0 1',
        'm=audio 9 UDP/TLS/RTP/SAVPF 111',
        'c=IN IP4 0.0.0.0',
        'a=mid:0',
        'a=rtpmap:111 opus/48000/2',
        'm=video 9 UDP/TLS/RTP/SAVPF 96 97',
        'c=IN IP4 0.0.0.0',
        'a=mid:1',
        'a=rtpmap:96 H264/90000',
        'a=fmtp:96 profile-level-id=42e01f;packetization-mode=1',
        'a=rtpmap:97 rtx/90000',
        'a=fmtp:97 apt=96',
        ''
      ].join('\r\n')
    },
    createAnswer : () => Promise.resolve({
      type : 'answer',
      sdp  : [
        'v=0',
        'o=- 0 0 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'a=group:BUNDLE 0 1',
        'm=audio 9 UDP/TLS/RTP/SAVPF 111',
        'c=IN IP4 0.0.0.0',
        'a=mid:0',
        'a=rtpmap:111 opus/48000/2',
        'm=video 9 UDP/TLS/RTP/SAVPF 96 97',
        'c=IN IP4 0.0.0.0',
        'a=mid:1',
        'a=rtpmap:96 H264/90000',
        'a=fmtp:96 profile-level-id=42e01f;packetization-mode=1',
        'a=rtpmap:97 rtx/90000',
        'a=fmtp:97 apt=96',
        ''
      ].join('\r\n')
    }),
    setLocalDescription : (desc) =>
    {
      appliedDescription = desc;
      session._connection.localDescription = desc;

      return Promise.resolve();
    }
  };

  await session._createLocalDescription('answer', {});

  assert.ok(appliedDescription);
  assert.ok(emittedSdp);
  assert.ok(appliedDescription.sdp.includes('a=fmtp:96 profile-level-id=42c01f;packetization-mode=1;x-google-min-bitrate=1946;x-google-max-bitrate=2378'));
  assert.ok(!appliedDescription.sdp.includes('a=fmtp:97 apt=96;x-google-min-bitrate=1946'));
  assert.ok(!emittedSdp.includes('x-google-min-bitrate=1946'));
  assert.ok(!emittedSdp.includes('x-google-max-bitrate=2378'));
}


async function testCreateLocalDescriptionAnswerPrefersRemoteAsForNon720p()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  let appliedDescription = null;

  session._sdpResolution = 'BP480P';
  session._lastRemoteOfferSdpForAnswer = [
    'v=0',
    'o=- 0 0 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'm=video 9 UDP/TLS/RTP/SAVPF 96 97',
    'c=IN IP4 0.0.0.0',
    'b=AS:1200',
    'a=mid:1',
    'a=rtpmap:96 H264/90000',
    'a=fmtp:96 profile-level-id=42e01e;packetization-mode=1',
    'a=rtpmap:97 rtx/90000',
    'a=fmtp:97 apt=96',
    ''
  ].join('\r\n');
  session._connection = {
    iceGatheringState : 'complete',
    localDescription  : null,
    remoteDescription : { type: 'offer', sdp: 'v=0\r\n' },
    createAnswer      : () => Promise.resolve({
      type : 'answer',
      sdp  : [
        'v=0',
        'o=- 0 0 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'm=video 9 UDP/TLS/RTP/SAVPF 96 97',
        'c=IN IP4 0.0.0.0',
        'a=mid:1',
        'a=rtpmap:96 H264/90000',
        'a=fmtp:96 profile-level-id=42e01e;packetization-mode=1',
        'a=rtpmap:97 rtx/90000',
        'a=fmtp:97 apt=96',
        ''
      ].join('\r\n')
    }),
    setLocalDescription : (desc) =>
    {
      appliedDescription = desc;
      session._connection.localDescription = desc;

      return Promise.resolve();
    }
  };

  await session._createLocalDescription('answer', {});

  assert.ok(appliedDescription.sdp.includes('a=fmtp:96 profile-level-id=42c01e;packetization-mode=1;x-google-min-bitrate=1080;x-google-max-bitrate=1320'));
  assert.ok(!appliedDescription.sdp.includes('x-google-min-bitrate=864'));
}


async function testCreateLocalDescriptionSkipsGoogleBitrateFmtpWhenNoAsAvailable()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  let appliedDescription = null;
  const Constants = require('../lib/Constants');
  const originalSdpLevel = Constants.SDP_LEVELID_AS.BP480P;

  session._sdpResolution = 'BP480P';
  session._lastRemoteOfferSdpForAnswer = [
    'v=0',
    'o=- 0 0 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'm=video 9 UDP/TLS/RTP/SAVPF 96 97',
    'c=IN IP4 0.0.0.0',
    'a=mid:1',
    'a=rtpmap:96 H264/90000',
    'a=fmtp:96 profile-level-id=42e01e;packetization-mode=1',
    'a=rtpmap:97 rtx/90000',
    'a=fmtp:97 apt=96',
    ''
  ].join('\r\n');
  Constants.SDP_LEVELID_AS.BP480P = { LEVELID: originalSdpLevel.LEVELID };
  session._connection = {
    iceGatheringState : 'complete',
    localDescription  : null,
    remoteDescription : { type: 'offer', sdp: 'v=0\r\n' },
    createAnswer      : () => Promise.resolve({
      type : 'answer',
      sdp  : [
        'v=0',
        'o=- 0 0 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'm=video 9 UDP/TLS/RTP/SAVPF 96 97',
        'c=IN IP4 0.0.0.0',
        'a=mid:1',
        'a=rtpmap:96 H264/90000',
        'a=fmtp:96 profile-level-id=42e01e;packetization-mode=1',
        'a=rtpmap:97 rtx/90000',
        'a=fmtp:97 apt=96',
        ''
      ].join('\r\n')
    }),
    setLocalDescription : (desc) =>
    {
      appliedDescription = desc;
      session._connection.localDescription = desc;

      return Promise.resolve();
    }
  };

  try
  {
    await session._createLocalDescription('answer', {});
  }
  finally
  {
    Constants.SDP_LEVELID_AS.BP480P = originalSdpLevel;
  }

  assert.ok(appliedDescription);
  assert.ok(!appliedDescription.sdp.includes('x-google-min-bitrate='));
  assert.ok(!appliedDescription.sdp.includes('x-google-max-bitrate='));
}


async function testConfirmedSetsDetailContentHintAndAppliesSenderBitrateFromSdpAs()
{
  const RTCSession = require('../lib/RTCSession');
  const Utils = require('../lib/Utils');
  const session = new RTCSession(createMockUA());
  const originalSendKeyFrames = Utils.sendKeyFrames;
  const senderTrack = new MockMediaStreamTrack('video', { width: 640, height: 480, frameRate: 15 });
  const setParametersCalls = [];
  const sender = {
    track            : senderTrack,
    generateKeyFrame : () => Promise.resolve(),
    getParameters    : () => ({ encodings: [ {} ] }),
    setParameters    : (parameters) =>
    {
      setParametersCalls.push(JSON.parse(JSON.stringify(parameters)));

      return Promise.resolve();
    }
  };

  senderTrack.contentHint = 'video';
  session._sdpResolution = 'BP480P';
  session._connection = {
    getSenders : () => [ sender ]
  };
  session._startVideoFrameRateMonitor = function() {};

  Utils.sendKeyFrames = function() {};

  try
  {
    session._confirmed('local', null);
    session._clearMaxBitrateRetryTimer();
  }
  finally
  {
    Utils.sendKeyFrames = originalSendKeyFrames;
  }

  assert.strictEqual(senderTrack.contentHint, 'detail');
  assert.ok(setParametersCalls.length >= 1);
  assert.strictEqual(setParametersCalls[0].encodings[0].minBitrate, 864 * 1000);
  assert.strictEqual(setParametersCalls[0].encodings[0].maxBitrate, 1056 * 1000);
}


async function testApplyVideoMaxBitrateSkipsWhenSdpAsMissing()
{
  const RTCSession = require('../lib/RTCSession');
  const Constants = require('../lib/Constants');
  const session = new RTCSession(createMockUA());
  const originalSdpLevel = Constants.SDP_LEVELID_AS.BP480P;
  const setParametersCalls = [];
  const sender = {
    track         : new MockMediaStreamTrack('video'),
    getParameters : () => ({ encodings: [ {} ] }),
    setParameters : (parameters) =>
    {
      setParametersCalls.push(parameters);

      return Promise.resolve();
    }
  };

  Constants.SDP_LEVELID_AS.BP480P = { LEVELID: originalSdpLevel.LEVELID };
  session._sdpResolution = 'BP480P';
  session._connection = {
    getSenders : () => [ sender ]
  };

  try
  {
    session._applyVideoMaxBitrate();
  }
  finally
  {
    Constants.SDP_LEVELID_AS.BP480P = originalSdpLevel;
  }

  assert.strictEqual(setParametersCalls.length, 0);
}


async function testToggleModeToVideoAppliesSenderBitrateFromSdpAs()
{
  const RTCSession = require('../lib/RTCSession');
  const session = new RTCSession(createMockUA());
  const setParametersCalls = [];
  const sender = {
    track         : new MockMediaStreamTrack('video'),
    getParameters : () => ({ encodings: [ {} ] }),
    setParameters : (parameters) =>
    {
      setParametersCalls.push(JSON.parse(JSON.stringify(parameters)));

      return Promise.resolve();
    }
  };

  session._mode = 'audio';
  session._sdpResolution = 'BP720P';
  session._connection = {
    getSenders : () => [ sender ]
  };

  session._ontogglemode('video');

  assert.strictEqual(setParametersCalls.length, 1);
  assert.strictEqual(setParametersCalls[0].encodings[0].minBitrate, 1946 * 1000);
  assert.strictEqual(setParametersCalls[0].encodings[0].maxBitrate, 2378 * 1000);
}

const TESTS = [
  { name: 'testCreateLocalDescriptionAppends720pGoogleBitrateFmtpOnlyForLocalDescription', fn: testCreateLocalDescriptionAppends720pGoogleBitrateFmtpOnlyForLocalDescription },
  { name: 'testCreateLocalDescriptionAnswerUsesRemoteAsFor720pGoogleBitrateFmtp', fn: testCreateLocalDescriptionAnswerUsesRemoteAsFor720pGoogleBitrateFmtp },
  { name: 'testCreateLocalDescriptionAnswerPrefersRemoteAsForNon720p', fn: testCreateLocalDescriptionAnswerPrefersRemoteAsForNon720p },
  { name: 'testCreateLocalDescriptionSkipsGoogleBitrateFmtpWhenNoAsAvailable', fn: testCreateLocalDescriptionSkipsGoogleBitrateFmtpWhenNoAsAvailable },
  { name: 'testConfirmedSetsDetailContentHintAndAppliesSenderBitrateFromSdpAs', fn: testConfirmedSetsDetailContentHintAndAppliesSenderBitrateFromSdpAs },
  { name: 'testApplyVideoMaxBitrateSkipsWhenSdpAsMissing', fn: testApplyVideoMaxBitrateSkipsWhenSdpAsMissing },
  { name: 'testToggleModeToVideoAppliesSenderBitrateFromSdpAs', fn: testToggleModeToVideoAppliesSenderBitrateFromSdpAs }
];

async function run(customSuiteName)
{
  const suiteName = customSuiteName || 'RTCSession-MediaEffects-Sdp';
  const restoreGlobals = installGlobals();
  const restoreModules = loadRTCSessionWithMockMixer();

  try
  {
    return await runSuite({
      suiteName  : suiteName,
      tests      : TESTS,
      beforeEach : function()
      {
        resetRtcSessionMediaEffectsTestState();
      }
    });
  }
  finally
  {
    restoreModules();
    restoreGlobals();
  }
}

exports.TESTS = TESTS;
exports.run = run;

if (require.main === module)
{
  run().catch((error) =>
  {
    process.exitCode = 1;
    setImmediate(() =>
    {
      throw error;
    });
  });
}
