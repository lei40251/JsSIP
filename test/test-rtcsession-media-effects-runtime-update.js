/* eslint-disable no-console */
const { runSuite } = require('./include/manual-test-suite');
const {
  assert,
  MockMediaStreamTrack,
  MockMediaStream,
  MockMixer,
  createMockUA,
  installGlobals,
  loadRTCSessionWithMockMixer,
  resetRtcSessionMediaEffectsTestState
} = require('./include/rtcsession-media-effects-test-helpers');

function testResolveMediaEffectsComposerOptionsUsesSourcesOnly()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const resolved = session._mediaPipeline.resolveMediaEffectsComposerOptions({
    mediaEffectsComposer : {
      mirror  : true,
      sources : [
        {
          sourceMirror : true,
          aiBackground : {
            enabled    : true,
            mode       : 'blur',
            blurRadius : 12
          }
        }
      ]
    }
  });

  assert.strictEqual(resolved.mirror, true);
  assert.strictEqual(resolved.sources.length, 1);
  assert.strictEqual(resolved.sources[0].sourceMirror, true);
  assert.strictEqual(resolved.sources[0].aiBackground.blurRadius, 12);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(resolved, 'sourceOptions'), false);
}


async function testUpdateMediaEffectsComposerUpdatesConfigPatch()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('video'), new MockMediaStreamTrack('audio') ]);

  await session._mediaPipeline.applyMediaEffectsComposerOnSdkGumStream(sourceStream, {
    mirror     : false,
    watermarks : []
  });

  const state = await session.updateMediaEffectsComposer({
    mirror           : true,
    mirrorWatermarks : false,
    watermarks       : [
      { id: 'wm1', target: 'output', type: 'text', text: 'live' }
    ]
  });

  assert.strictEqual(state.config.outputMirror, true);
  assert.strictEqual(state.config.mirrorWatermarks, false);
  assert.strictEqual(state.config.watermarks.length, 1);
  assert.strictEqual(state.config.watermarks[0].id, 'wm1');
}


async function testUpdateMediaEffectsComposerUpdatesPrimarySourceEffects()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('video'), new MockMediaStreamTrack('audio') ]);

  await session._mediaPipeline.applyMediaEffectsComposerOnSdkGumStream(sourceStream, {
    sources : [
      {
        aiBackground : {
          enabled    : true,
          mode       : 'blur',
          blurRadius : 6
        }
      }
    ]
  });

  const state = await session.updateMediaEffectsComposer({
    sources : [
      {
        sourceMirror : true,
        aiBackground : {
          enabled : true,
          mode    : 'color',
          color   : '#456789'
        }
      }
    ]
  });

  assert.strictEqual(state.sources[0].aiBackground.color, '#456789');
  assert.strictEqual(state.sources[0].sourceMirror, true);
  assert.strictEqual(session.getAiVirtualBackground().color, '#456789');
}


async function testUpdateMediaEffectsComposerClearsPrimarySourceAiVirtualBackground()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('video'), new MockMediaStreamTrack('audio') ]);

  await session._mediaPipeline.applyMediaEffectsComposerOnSdkGumStream(sourceStream, {
    mirror  : true,
    sources : [
      {
        aiBackground : {
          enabled    : true,
          mode       : 'blur',
          blurRadius : 6
        }
      }
    ]
  });

  const state = await session.updateMediaEffectsComposer({
    mirror     : false,
    watermarks : [
      { id: 'wm-clear-aivb', target: 'output', type: 'text', text: 'live' }
    ],
    sources : [
      {
        aiBackground : null
      }
    ]
  });

  assert.strictEqual(state.config.outputMirror, false);
  assert.strictEqual(state.config.watermarks.length, 1);
  assert.strictEqual(state.sources[0].aiBackground, null);
  assert.strictEqual(session.getAiVirtualBackground(), null);
}


async function testUpdateMediaEffectsComposerPreservesSessionCreateOptionsAcrossRuntimePatch()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('video'), new MockMediaStreamTrack('audio') ]);

  session._sessionMediaEffectsComposerOptions = {
    width      : 1280,
    height     : 720,
    renderMode : 'worker-webgl2',
    mirror     : false,
    sources    : [
      {
        aiBackground : {
          enabled    : true,
          mode       : 'blur',
          blurRadius : 6
        }
      }
    ]
  };

  await session._mediaPipeline.applyMediaEffectsComposerOnSdkGumStream(sourceStream, {
    mirror : false
  });

  await session.updateMediaEffectsComposer({
    mirror           : true,
    mirrorWatermarks : false
  });

  assert.strictEqual(session._sessionMediaEffectsComposerOptions.width, 1280);
  assert.strictEqual(session._sessionMediaEffectsComposerOptions.height, 720);
  assert.strictEqual(session._sessionMediaEffectsComposerOptions.renderMode, 'worker-webgl2');
  assert.strictEqual(session._sessionMediaEffectsComposerOptions.mirror, true);
  assert.strictEqual(session._sessionMediaEffectsComposerOptions.sources[0].aiBackground.blurRadius, 6);
}


async function testUpdateMediaEffectsComposerRejectsImmutableRuntimeFields()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('video'), new MockMediaStreamTrack('audio') ]);

  session._sessionMediaEffectsComposerOptions = {
    width      : 640,
    height     : 360,
    renderMode : 'main-2d',
    mirror     : false
  };

  await session._mediaPipeline.applyMediaEffectsComposerOnSdkGumStream(sourceStream, {
    width      : 640,
    height     : 360,
    renderMode : 'main-2d'
  });

  await assert.rejects(async() =>
  {
    await session.updateMediaEffectsComposer({
      width  : 1920,
      mirror : true
    });
  }, /width/);

  assert.strictEqual(session._sessionMediaEffectsComposerOptions.width, 640);
  assert.strictEqual(session._sessionMediaEffectsComposerOptions.mirror, false);
}


async function testUpdateMediaEffectsComposerCreatesComposerForCurrentVideoTrack()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const localAudioTrack = new MockMediaStreamTrack('audio');
  const localVideoTrack = new MockMediaStreamTrack('video', { width: 640, height: 480, frameRate: 15 });
  const videoSender = {
    track        : localVideoTrack,
    replaceTrack : async function(track)
    {
      this.replaced = track;
      this.track = track;
    }
  };
  const audioSender = {
    track        : localAudioTrack,
    replaceTrack : async function(track)
    {
      this.replaced = track;
      this.track = track;
    }
  };

  session._connection = {
    getSenders : () => [ audioSender, videoSender ]
  };
  session._localMediaStream = new MockMediaStream([ localAudioTrack, localVideoTrack ]);

  const state = await session.updateMediaEffectsComposer({
    mirror  : true,
    sources : [
      {
        aiBackground : {
          enabled    : true,
          mode       : 'blur',
          blurRadius : 8
        }
      }
    ]
  });

  assert.strictEqual(MockMixer.instances.length, 1);
  assert.strictEqual(MockMixer.instances[0].options.mirror, true);
  assert.strictEqual(MockMixer.instances[0].options.sources[0].aiBackground.blurRadius, 8);
  assert.strictEqual(MockMixer.instances[0].streams[0].getAudioTracks()[0], localAudioTrack);
  assert.strictEqual(videoSender.replaced, MockMixer.instances[0].outputTrack);
  assert.strictEqual(audioSender.replaced, MockMixer.instances[0].outputAudioTrack);
  assert.strictEqual(session._localMediaStream.getVideoTracks()[0], MockMixer.instances[0].outputTrack);
  assert.strictEqual(session._localMediaStream.getAudioTracks()[0], MockMixer.instances[0].outputAudioTrack);
  assert.strictEqual(state.config.outputMirror, true);
  assert.strictEqual(state.sources[0].aiBackground.blurRadius, 8);
}


async function testUpdateMediaEffectsComposerKeepsComposerWhenMainWebGL2SupportsAiVB()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceVideoTrack = new MockMediaStreamTrack('video', { width: 640, height: 480, frameRate: 15 });
  const sourceAudioTrack = new MockMediaStreamTrack('audio');
  const sourceStream = new MockMediaStream([ sourceVideoTrack, sourceAudioTrack ]);
  const outputVideoTrack = new MockMediaStreamTrack('video', { width: 640, height: 480, frameRate: 15 });
  const sender = {
    track        : outputVideoTrack,
    replaceTrack : async function(track)
    {
      this.replaced = track;
      this.track = track;
    }
  };

  session._connection = {
    getSenders : () => [ sender ]
  };
  session._localMediaStream = new MockMediaStream([ sourceAudioTrack, outputVideoTrack ]);

  await session._mediaPipeline.applyMediaEffectsComposerOnSdkGumStream(sourceStream, {
    mirror : true
  });

  const firstComposer = session.getMediaEffectsComposer();

  firstComposer.renderInfo = {
    actualMode : 'main-webgl2',
    isWorker   : false
  };

  const state = await session.updateMediaEffectsComposer({
    mirror  : true,
    sources : [
      {
        aiBackground : {
          enabled    : true,
          mode       : 'blur',
          blurRadius : 10
        }
      }
    ]
  });

  assert.strictEqual(MockMixer.instances.length, 1);
  assert.strictEqual(firstComposer.stopped, false);
  assert.strictEqual(sourceVideoTrack.readyState, 'live');
  assert.strictEqual(sourceAudioTrack.readyState, 'live');
  assert.strictEqual(MockMixer.instances[0].streams[0], sourceStream);
  assert.strictEqual(firstComposer.getAiBackground(0).blurRadius, 10);
  assert.strictEqual(sender.replaced, undefined);
  assert.strictEqual(session._localMediaStream.getVideoTracks()[0], outputVideoTrack);
  assert.strictEqual(state.sources[0].aiBackground.blurRadius, 10);
}

const TESTS = [
  { name: 'testResolveMediaEffectsComposerOptionsUsesSourcesOnly', fn: testResolveMediaEffectsComposerOptionsUsesSourcesOnly },
  { name: 'testUpdateMediaEffectsComposerUpdatesConfigPatch', fn: testUpdateMediaEffectsComposerUpdatesConfigPatch },
  { name: 'testUpdateMediaEffectsComposerUpdatesPrimarySourceEffects', fn: testUpdateMediaEffectsComposerUpdatesPrimarySourceEffects },
  { name: 'testUpdateMediaEffectsComposerClearsPrimarySourceAiVirtualBackground', fn: testUpdateMediaEffectsComposerClearsPrimarySourceAiVirtualBackground },
  { name: 'testUpdateMediaEffectsComposerPreservesSessionCreateOptionsAcrossRuntimePatch', fn: testUpdateMediaEffectsComposerPreservesSessionCreateOptionsAcrossRuntimePatch },
  { name: 'testUpdateMediaEffectsComposerRejectsImmutableRuntimeFields', fn: testUpdateMediaEffectsComposerRejectsImmutableRuntimeFields },
  { name: 'testUpdateMediaEffectsComposerCreatesComposerForCurrentVideoTrack', fn: testUpdateMediaEffectsComposerCreatesComposerForCurrentVideoTrack },
  { name: 'testUpdateMediaEffectsComposerKeepsComposerWhenMainWebGL2SupportsAiVB', fn: testUpdateMediaEffectsComposerKeepsComposerWhenMainWebGL2SupportsAiVB }
];

async function run(customSuiteName)
{
  const suiteName = customSuiteName || 'RTCSession-MediaEffects-RuntimeUpdate';
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
