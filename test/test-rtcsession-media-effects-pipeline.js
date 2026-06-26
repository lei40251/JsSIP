/* eslint-disable no-console */
const { runSuite } = require('./include/manual-test-suite');
const {
  assert,
  MockMediaStreamTrack,
  MockMediaStream,
  MockMixer,
  MockAiNSEngine,
  createMockUA,
  installGlobals,
  loadRTCSessionWithMockMixer,
  resetRtcSessionMediaEffectsTestState
} = require('./include/rtcsession-media-effects-test-helpers');

async function testApplyMediaEffectsComposerOnSdkGumStreamUsesCtorOptions()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceVideo = new MockMediaStreamTrack('video', { width: 1280, height: 720, frameRate: 30 });
  const sourceAudio = new MockMediaStreamTrack('audio');
  const sourceStream = new MockMediaStream([ sourceVideo, sourceAudio ]);
  const mixed = await session._mediaPipeline.applyMediaEffectsComposerOnSdkGumStream(sourceStream, {
    sourceMirror     : true,
    mirror           : true,
    enableInsertable : true,
    watermarks       : [
      { id: 'out', target: 'output', type: 'text', text: 'ok' },
      { id: 'src', target: 'source', type: 'text', text: 'skip' },
      { id: 'none', type: 'text', text: 'keep' }
    ]
  });

  assert.notStrictEqual(mixed, sourceStream);
  assert.strictEqual(mixed.getAudioTracks().length, 1);
  assert.strictEqual(mixed.getVideoTracks().length, 1);
  assert.strictEqual(session.getMediaEffectsComposer(), MockMixer.instances[0]);
  assert.deepStrictEqual(MockMixer.instances[0].outputRequest, { type: 'mixed' });
  assert.strictEqual(mixed.getAudioTracks()[0], MockMixer.instances[0].outputAudioTrack);
  assert.strictEqual(MockMixer.instances[0].outputTrack.contentHint, 'video');
  assert.strictEqual(mixed.getVideoTracks()[0].contentHint, 'video');

  const ctorOptions = MockMixer.instances[0].options;

  assert.strictEqual(ctorOptions.width, 1280);
  assert.strictEqual(ctorOptions.height, 720);
  assert.strictEqual(ctorOptions.fps, 30);
  assert.strictEqual(ctorOptions.sourceMirror, true);
  assert.strictEqual(ctorOptions.mirror, true);
  assert.strictEqual(ctorOptions.enableInsertable, true);
  assert.strictEqual(ctorOptions.watermarks.length, 3);
  assert.strictEqual(ctorOptions.watermarks[0].id, 'out');
  assert.strictEqual(ctorOptions.watermarks[1].id, 'src');
  assert.strictEqual(ctorOptions.watermarks[2].id, 'none');
}


async function testApplyMediaEffectsComposerSkipsWhenNoVideoOrNoOptions()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const audioOnly = new MockMediaStream([ new MockMediaStreamTrack('audio') ]);
  const noOptions = await session._mediaPipeline.applyMediaEffectsComposerOnSdkGumStream(audioOnly, null);
  const noVideo = await session._mediaPipeline.applyMediaEffectsComposerOnSdkGumStream(audioOnly, { sourceMirror: true });

  assert.strictEqual(noOptions, audioOnly);
  assert.strictEqual(noVideo, audioOnly);
  assert.strictEqual(session.getMediaEffectsComposer(), null);
}


async function testCloseStopsAndClearsMediaEffectsComposer()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceAudioTrack = new MockMediaStreamTrack('audio');
  const sourceVideoTrack = new MockMediaStreamTrack('video', { width: 640, height: 360, frameRate: 15 });
  const sourceStream = new MockMediaStream([
    sourceAudioTrack,
    sourceVideoTrack
  ]);

  await session._mediaPipeline.applyMediaEffectsComposerOnSdkGumStream(sourceStream, { mirror: true });
  assert.ok(session.getMediaEffectsComposer());

  session._close();

  assert.strictEqual(MockMixer.stopCalls >= 1, true);
  assert.strictEqual(session.getMediaEffectsComposer(), null);
  assert.strictEqual(sourceAudioTrack.readyState, 'ended');
  assert.strictEqual(sourceVideoTrack.readyState, 'ended');
}


async function testBuildMediaEffectsComposerCtorOptionsKeepsPortraitTrackOnAndroid()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const previousUserAgent = global.navigator.userAgent;
  const sourceVideo = new MockMediaStreamTrack('video', { width: 720, height: 1280, frameRate: 24 });
  const sourceStream = new MockMediaStream([ sourceVideo ]);

  global.navigator.userAgent = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36';

  try
  {
    const options = session._mediaPipeline.buildMediaEffectsComposerCtorOptions(sourceStream, { mirror: true });

    assert.strictEqual(options.width, 720);
    assert.strictEqual(options.height, 1280);
    assert.strictEqual(options.fps, 24);
  }
  finally
  {
    global.navigator.userAgent = previousUserAgent;
  }
}


async function testGetUserMediaPipelineAppliesSessionAiNoiseSuppression()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const audioTrack = new MockMediaStreamTrack('audio');
  const sourceStream = new MockMediaStream([ audioTrack ]);
  const processedAudioTrack = new MockMediaStreamTrack('audio');
  const processedStream = new MockMediaStream([ processedAudioTrack ]);

  session._sessionAiNSOptions = {
    enabled             : true,
    noiseReductionLevel : 92
  };

  MockAiNSEngine.transform = () => processedStream;
  global.navigator.mediaDevices.getUserMedia = () => Promise.resolve(sourceStream);

  const stream = await session._mediaPipeline.getUserMediaWithSessionPipeline({ audio: true, video: false }, null);

  assert.strictEqual(stream, processedStream);
  assert.strictEqual(MockAiNSEngine.instances.length, 1);
  assert.strictEqual(MockAiNSEngine.instances[0].options.noiseReductionLevel, 92);
  assert.strictEqual(MockAiNSEngine.instances[0].processCalls[0], sourceStream);
  assert.strictEqual(session.getAiNoiseSuppression(), MockAiNSEngine.instances[0]);
}


async function testGetUserMediaPipelineAppliesSessionAiVirtualBackground()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceVideo = new MockMediaStreamTrack('video', { width: 1280, height: 720, frameRate: 30 });
  const sourceAudio = new MockMediaStreamTrack('audio');
  const sourceStream = new MockMediaStream([ sourceVideo, sourceAudio ]);

  session._sessionMediaEffectsComposerOptions = session._mediaPipeline.resolveMediaEffectsComposerOptions({
    mediaEffectsComposer : {
      sources : [
        {
          aiVirtualBackground : {
            enabled    : true,
            mode       : 'blur',
            blurRadius : 18,
            video      : { width: 640, height: 360, processingScale: 0.5 }
          }
        }
      ]
    }
  });
  global.navigator.mediaDevices.getUserMedia = () => Promise.resolve(sourceStream);

  const stream = await session._mediaPipeline.getUserMediaWithSessionPipeline(
    { audio: true, video: true },
    session._sessionMediaEffectsComposerOptions
  );
  const effect = session.getAiVirtualBackground();

  assert.strictEqual(MockMixer.instances.length, 1);
  assert.strictEqual(MockMixer.instances[0].options.sources[0].aiVirtualBackground.mode, 'blur');
  assert.strictEqual(MockMixer.instances[0].options.sources[0].aiVirtualBackground.blurRadius, 18);
  assert.strictEqual(effect.mode, 'blur');
  assert.strictEqual(effect.blurRadius, 18);
  assert.strictEqual(stream.getVideoTracks()[0], MockMixer.instances[0].outputTrack);
  assert.strictEqual(stream.getAudioTracks()[0], MockMixer.instances[0].outputAudioTrack);
}


async function testGetUserMediaPipelineAcceptsComposerSourcesArray()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceVideo = new MockMediaStreamTrack('video', { width: 640, height: 360, frameRate: 24 });
  const sourceAudio = new MockMediaStreamTrack('audio');
  const sourceStream = new MockMediaStream([ sourceVideo, sourceAudio ]);

  session._sessionMediaEffectsComposerOptions = session._mediaPipeline.resolveMediaEffectsComposerOptions({
    mediaEffectsComposer : {
      sources : [
        {
          aiVirtualBackground : {
            enabled  : true,
            mode     : 'image',
            imageUrl : 'https://example.com/bg-a.png'
          }
        }
      ]
    }
  });
  global.navigator.mediaDevices.getUserMedia = () => Promise.resolve(sourceStream);

  const stream = await session._mediaPipeline.getUserMediaWithSessionPipeline(
    { audio: true, video: true },
    session._sessionMediaEffectsComposerOptions
  );

  assert.strictEqual(MockMixer.instances.length, 1);
  assert.strictEqual(MockMixer.instances[0].options.sources[0].aiVirtualBackground.imageUrl, 'https://example.com/bg-a.png');
  assert.strictEqual(session.getAiVirtualBackground().imageUrl, 'https://example.com/bg-a.png');
  assert.strictEqual(stream.getVideoTracks()[0], MockMixer.instances[0].outputTrack);
  assert.strictEqual(stream.getAudioTracks()[0], MockMixer.instances[0].outputAudioTrack);
}


async function testSessionAiNoiseSuppressionDisablesNativeNoiseSuppression()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());

  session._sessionAiNSOptions = true;

  const constraints = session._mediaPipeline.getGumConstraintsWithProcessorFlags({
    audio : { deviceId: { exact: 'mic-1' } },
    video : false
  }, session._sessionAiNSOptions);

  assert.strictEqual(constraints.audio.noiseSuppression, false);
  assert.deepStrictEqual(constraints.audio.deviceId, { exact: 'mic-1' });
}


async function testApplyAiNoiseSuppressionSkipsDisabledOptions()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('audio') ]);

  const stream = await session._mediaPipeline.applyAiNoiseSuppressionOnSdkGumStream(sourceStream, { enabled: false });

  assert.strictEqual(stream, sourceStream);
  assert.strictEqual(MockAiNSEngine.instances.length, 0);
}


function testGetAiNoiseSuppressionReturnsNullByDefault()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());

  assert.strictEqual(session.getAiNoiseSuppression(), null);
}


function testGetAiVirtualBackgroundReturnsNullByDefault()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());

  assert.strictEqual(session.getAiVirtualBackground(), null);
}


async function testCloseDestroysSessionAiNoiseSuppression()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('audio') ]);

  await session._mediaPipeline.applyAiNoiseSuppressionOnSdkGumStream(sourceStream, true);

  session._close();
  await Promise.resolve();

  assert.strictEqual(MockAiNSEngine.destroyCalls, 1);
  assert.strictEqual(session.getAiNoiseSuppression(), null);
}


async function testApplyAiNoiseSuppressionEmitsMediaEffectsIssue()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('audio') ]);
  const events = [];

  session.on('mediaEffectsIssue', (event) => events.push(event));
  MockAiNSEngine.issueOnProcess = (engine) =>
  {
    engine.onIssue && engine.onIssue({
      module          : 'AiNS',
      component       : 'MockAiNSEngine',
      stage           : 'mock-process',
      severity        : 'warn',
      message         : 'mock ai noise suppression issue',
      fallbackApplied : true,
      degraded        : true,
      details         : {
        source : 'unit-test'
      }
    });
  };

  await session._mediaPipeline.applyAiNoiseSuppressionOnSdkGumStream(sourceStream, true);

  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].module, 'AiNS');
  assert.strictEqual(events[0].message, 'mock ai noise suppression issue');
}


async function testCloseStopsSessionComposerWithAiVirtualBackground()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceVideo = new MockMediaStreamTrack('video');
  const sourceAudio = new MockMediaStreamTrack('audio');
  const sourceStream = new MockMediaStream([ sourceVideo, sourceAudio ]);

  await session._mediaPipeline.applyMediaEffectsComposerOnSdkGumStream(sourceStream, {
    sources : [
      {
        aiVirtualBackground : {
          enabled : true,
          mode    : 'color',
          color   : '#123456'
        }
      }
    ]
  });

  session._close();
  await Promise.resolve();

  assert.strictEqual(MockMixer.stopCalls, 1);
  assert.strictEqual(session.getAiVirtualBackground(), null);
  assert.strictEqual(sourceVideo.readyState, 'ended');
  assert.strictEqual(sourceAudio.readyState, 'ended');
}


async function testApplyMediaEffectsComposerEmitsMediaEffectsIssue()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceVideo = new MockMediaStreamTrack('video', { width: 640, height: 360, frameRate: 24 });
  const sourceAudio = new MockMediaStreamTrack('audio');
  const sourceStream = new MockMediaStream([ sourceVideo, sourceAudio ]);
  const events = [];

  session.on('mediaEffectsIssue', (event) => events.push(event));
  MockMixer.issueOnGetOutput = (mixer) =>
  {
    mixer.onIssue && mixer.onIssue({
      module          : 'MediaEffectsComposer',
      component       : 'MockMixer',
      stage           : 'mock-get-output',
      severity        : 'warn',
      message         : 'mock composer issue',
      fallbackApplied : true,
      degraded        : true,
      details         : {
        source : 'unit-test'
      }
    });
  };

  await session._mediaPipeline.applyMediaEffectsComposerOnSdkGumStream(sourceStream, { mirror: true });

  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].module, 'MediaEffectsComposer');
  assert.strictEqual(events[0].message, 'mock composer issue');
}


async function testProcessMediaStreamDoesNotApplySessionAiNoiseSuppression()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('audio') ]);

  session._sessionAiNSOptions = true;
  MockAiNSEngine.transform = () => new MockMediaStream([ new MockMediaStreamTrack('audio') ]);

  const result = await session._mediaPipeline.processMediaStream(sourceStream);

  assert.strictEqual(result, sourceStream);
  assert.strictEqual(MockAiNSEngine.instances.length, 0);
}

const TESTS = [
  { name: 'testApplyMediaEffectsComposerOnSdkGumStreamUsesCtorOptions', fn: testApplyMediaEffectsComposerOnSdkGumStreamUsesCtorOptions },
  { name: 'testApplyMediaEffectsComposerSkipsWhenNoVideoOrNoOptions', fn: testApplyMediaEffectsComposerSkipsWhenNoVideoOrNoOptions },
  { name: 'testCloseStopsAndClearsMediaEffectsComposer', fn: testCloseStopsAndClearsMediaEffectsComposer },
  { name: 'testBuildMediaEffectsComposerCtorOptionsKeepsPortraitTrackOnAndroid', fn: testBuildMediaEffectsComposerCtorOptionsKeepsPortraitTrackOnAndroid },
  { name: 'testGetUserMediaPipelineAppliesSessionAiNoiseSuppression', fn: testGetUserMediaPipelineAppliesSessionAiNoiseSuppression },
  { name: 'testGetUserMediaPipelineAppliesSessionAiVirtualBackground', fn: testGetUserMediaPipelineAppliesSessionAiVirtualBackground },
  { name: 'testGetUserMediaPipelineAcceptsComposerSourcesArray', fn: testGetUserMediaPipelineAcceptsComposerSourcesArray },
  { name: 'testSessionAiNoiseSuppressionDisablesNativeNoiseSuppression', fn: testSessionAiNoiseSuppressionDisablesNativeNoiseSuppression },
  { name: 'testApplyAiNoiseSuppressionSkipsDisabledOptions', fn: testApplyAiNoiseSuppressionSkipsDisabledOptions },
  { name: 'testGetAiNoiseSuppressionReturnsNullByDefault', fn: testGetAiNoiseSuppressionReturnsNullByDefault },
  { name: 'testGetAiVirtualBackgroundReturnsNullByDefault', fn: testGetAiVirtualBackgroundReturnsNullByDefault },
  { name: 'testCloseDestroysSessionAiNoiseSuppression', fn: testCloseDestroysSessionAiNoiseSuppression },
  { name: 'testApplyAiNoiseSuppressionEmitsMediaEffectsIssue', fn: testApplyAiNoiseSuppressionEmitsMediaEffectsIssue },
  { name: 'testCloseStopsSessionComposerWithAiVirtualBackground', fn: testCloseStopsSessionComposerWithAiVirtualBackground },
  { name: 'testApplyMediaEffectsComposerEmitsMediaEffectsIssue', fn: testApplyMediaEffectsComposerEmitsMediaEffectsIssue },
  { name: 'testProcessMediaStreamDoesNotApplySessionAiNoiseSuppression', fn: testProcessMediaStreamDoesNotApplySessionAiNoiseSuppression }
];

async function run(customSuiteName)
{
  const suiteName = customSuiteName || 'RTCSession-MediaEffects-Pipeline';
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
