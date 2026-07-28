/* eslint-disable no-console */
const { runSuite } = require('./include/manual-test-suite');
const {
  assert,
  MediaEffectsComposer,
  ComposerConfig,
  MockMediaStream,
  MockVideoElement,
  MockAudioContext,
  MockDynamicsCompressorNode,
  installBrowserMocks,
  resetMockState,
  createStream,
  flushAsync,
  assertRejects
} = require('./include/media-effects-composer-test-helpers');

async function testPlainAudioRequestWithoutSourceDoesNotCreateAudioContext()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
  const output = await mixer.getAudioStream();

  assert.strictEqual(output, null);
  assert.strictEqual(MockAudioContext.instances.length, 0);
  assert.strictEqual(mixer.getAudioInfo().status, 'no-source');

  mixer.stop();
}


async function testAppendAudioSourceInjectsAudioTrack()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
  const output = await mixer.getMixedStream();
  const audioTrack = output.getAudioTracks()[0];

  mixer.appendStream(createStream({ audio: true }), 0);
  await flushAsync();

  assert.strictEqual(MockAudioContext.instances.length, 1);
  assert.strictEqual(output.getAudioTracks().length, 1);
  assert.strictEqual(output.getAudioTracks()[0], audioTrack);
  assert.strictEqual(mixer.getAudioInfo().status, 'mixing');

  mixer.stop();
}


async function testRepeatedOutputCallsReuseLiveStream()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([ createStream({ audio: true }) ], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d'
  });
  const first = await mixer.getMixedStream();
  const firstVideoTrack = first.getVideoTracks()[0];
  const second = await mixer.getMixedStream();

  assert.strictEqual(second, first);
  assert.strictEqual(firstVideoTrack.readyState, 'live');
  assert.strictEqual(first.getAudioTracks().length, 1);

  mixer.stop();
  assert.strictEqual(firstVideoTrack.readyState, 'ended');
}


async function testNewPublicApiStateAndSourceLifecycle()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
  const firstStream = createStream({ audio: true });
  const secondStream = createStream({ audio: true });

  assert.strictEqual(mixer.addSource(firstStream, 0), true);
  assert.strictEqual(mixer.addSource(secondStream, { slot: 1, gain: 0.5 }), true);

  let state = mixer.getState();

  assert.strictEqual(state.sources.length, 2);
  assert.strictEqual(state.sources[0].slot, 0);
  assert.strictEqual(state.sources[1].slot, 1);
  assert.strictEqual(state.config.outputMirror, false);
  assert.strictEqual(state.config.sourceMirror, false);
  assert.deepStrictEqual(state.config.sourceMirrorOverrides, {});

  assert.strictEqual(mixer.removeSource(firstStream.id), true);
  assert.strictEqual(mixer.removeSource(), false);

  state = mixer.getState();
  assert.strictEqual(state.sources.length, 1);
  assert.strictEqual(state.sources[0].streamId, secondStream.id);

  mixer.clearSources();
  assert.strictEqual(mixer.getState().sources.length, 0);

  mixer.stop();
}


async function testNewPublicApiConfigAndOutputs()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
  const sourceA = createStream({ audio: true });
  const sourceB = createStream({ audio: true });

  mixer.addSource(sourceA, 0);
  mixer.addSource(sourceB, 1);

  const config = await mixer.setConfig({
    outputMirror          : true,
    sourceMirror          : true,
    sourceMirrorOverrides : { 0: false, 1: true },
    mirrorWatermarks      : false,
    watermarks            : [
      { id: 'brand', target: 'output', text: 'CRTC' }
    ]
  });

  assert.strictEqual(config.outputMirror, true);
  assert.strictEqual(config.sourceMirror, true);
  assert.deepStrictEqual(config.sourceMirrorOverrides, { '0': false, '1': true });
  assert.strictEqual(config.mirrorWatermarks, false);
  assert.strictEqual(config.watermarks.length, 1);

  let state = mixer.getState();

  assert.strictEqual(state.config.outputMirror, true);
  assert.strictEqual(state.config.mirrorWatermarks, false);
  assert.deepStrictEqual(state.config.sourceMirrorOverrides, { '0': false, '1': true });

  const videoOutput = await mixer.getOutput({ type: 'video' });
  const mixedOutput = await mixer.getOutput();
  const busOutput = await mixer.getOutput({ type: 'audio', slots: [ 0 ] });
  const isolatedOutput = await mixer.getOutput({ type: 'audio', slots: [ 1 ], isolated: true });

  assert.strictEqual(videoOutput.getVideoTracks().length, 1);
  assert.strictEqual(mixedOutput.getVideoTracks().length, 1);
  assert.notStrictEqual(mixedOutput, videoOutput);
  assert.strictEqual(mixedOutput.getVideoTracks()[0], videoOutput.getVideoTracks()[0]);
  assert.strictEqual(mixedOutput.getAudioTracks().length, 1);
  assert.strictEqual(busOutput.getAudioTracks().length, 1);
  assert.strictEqual(isolatedOutput.getAudioTracks().length, 1);

  assert.strictEqual(mixer.releaseOutput({ type: 'audio', slots: [ 0 ] }), true);
  assert.strictEqual(mixer.releaseOutput({ type: 'audio', slots: [ 1 ], isolated: true }), true);
  assert.strictEqual(mixer.releaseOutput({ type: 'mixed' }), false);

  await mixer.setConfig({ clearSourceMirrorOverrides: true, clearWatermarks: true });
  state = mixer.getState();
  assert.deepStrictEqual(state.config.sourceMirrorOverrides, {});
  assert.strictEqual(state.config.watermarks.length, 0);

  mixer.stop();
}


async function testStopRejectsPublicReuse()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  await mixer.getMixedStream();
  mixer.stop();

  assert.throws(() => mixer.appendStream(createStream({ audio: true }), 0), /has been stopped/);
  assert.throws(() => mixer.addSource(createStream({ audio: true }), 0), /has been stopped/);
  assert.throws(() => mixer.removeSource('missing'), /has been stopped/);
  assert.throws(() => mixer.clearSources(), /has been stopped/);
  assert.throws(() => mixer.getVideoStream(), /has been stopped/);
  assert.throws(() => mixer.getSources(), /has been stopped/);
  assert.throws(() => mixer.getState(), /has been stopped/);
  await assertRejects(() => mixer.getMixedStream(), /has been stopped/);
  await assertRejects(() => mixer.getOutput(), /has been stopped/);
}


async function testExternalVideoSrcObjectReconnectsAudio()
{
  resetMockState();

  const video = new MockVideoElement();
  const firstStream = createStream({ audio: true });
  const secondStream = createStream({ audio: true });

  video.srcObject = firstStream;

  const mixer = new MediaEffectsComposer(video, { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  await mixer.getMixedStream();
  video.srcObject = secondStream;
  mixer._drawVideosToCanvas(undefined, true);
  await flushAsync();

  assert.strictEqual(mixer.getSources()[0].streamId, secondStream.id);
  assert.strictEqual(mixer.getAudioInfo().connectedSources, 1);
  assert.strictEqual(MockAudioContext.instances[0].sources[1], secondStream);

  mixer.stop();
}


async function testSlotAudioStreamsCreateIndependentBuses()
{
  resetMockState();

  const streams = [];
  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  for (let slot = 0; slot < 7; slot++)
  {
    const stream = createStream({ video: false, audio: true });

    streams.push(stream);
    mixer.appendStream(stream, slot);
  }

  const first = await mixer.getAudioStream({ slots: [ 1, 2, 3 ] });
  const second = await mixer.getAudioStream({ slots: [ 1, 3, 5 ] });
  const firstAgain = await mixer.getAudioStream({ slots: [ 3, 2, 1 ] });
  const context = MockAudioContext.instances[0];
  const firstBus = mixer._audioComposer._audioBuses.get('1,2,3');
  const secondBus = mixer._audioComposer._audioBuses.get('1,3,5');

  assert.ok(first);
  assert.ok(second);
  assert.notStrictEqual(second, first);
  assert.notStrictEqual(firstAgain, first);
  assert.strictEqual(first.getAudioTracks().length, 1);
  assert.strictEqual(first.getVideoTracks().length, 0);
  assert.strictEqual(second.getAudioTracks().length, 1);
  assert.strictEqual(second.getVideoTracks().length, 0);
  assert.strictEqual(context.destinations.length, 3);
  assert.strictEqual(context.destinations[0].stream.getAudioTracks()[0].readyState, 'ended');
  assert.strictEqual(context.destinations[1].stream, second);
  assert.strictEqual(context.destinations[2].stream, firstAgain);
  assert.strictEqual(context.destinations[0].inputs.length, 0);
  assert.strictEqual(context.destinations[1].inputs.length, 1);
  assert.strictEqual(context.sources.length, 4);
  assert.strictEqual(context.destinations[2].inputs[0] instanceof MockDynamicsCompressorNode, true);
  assert.strictEqual(firstBus.connections.size, 3);
  assert.strictEqual(secondBus.connections.size, 3);

  mixer.removeStream(streams[2].id);
  const refreshed = await mixer.getAudioStream({ slots: [ 1, 2, 3 ] });

  assert.notStrictEqual(refreshed, firstAgain);
  const refreshedBus = mixer._audioComposer._audioBuses.get('1,2,3');

  assert.strictEqual(refreshedBus.connections.size, 2);
  assert.strictEqual(secondBus.connections.size, 3);
  assert.strictEqual(context.destinations[1].inputs.length, 1);
  assert.strictEqual(await mixer.getAudioStream({ slots: [] }), null);
  assert.strictEqual(await mixer.getAudioStream({ slots: [ -1, 'x' ] }), null);

  const firstBusGain = context.destinations[3].inputs[0].inputs[0];

  mixer.stop();
  assert.strictEqual(firstBusGain.disconnected, true);
  assert.strictEqual(context.destinations[0].inputs.length, 0);
  assert.strictEqual(context.destinations[1].inputs.length, 0);
  assert.strictEqual(context.closed, true);
  assert.strictEqual(context.sampleRate, 44100);
}


async function testDefaultAudioStreamStillMixesAllSources()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  for (let slot = 0; slot < 4; slot++)
  {
    mixer.appendStream(createStream({ video: false, audio: true }), slot);
  }

  const output = await mixer.getAudioStream();
  const context = MockAudioContext.instances[0];

  assert.ok(output);
  assert.strictEqual(context.destinations.length, 1);
  assert.strictEqual(context.destinations[0].inputs.length, 1);
  assert.strictEqual(context.destinations[0].inputs[0].inputs.length, 4);
  assert.strictEqual(mixer.getAudioInfo().connectedSources, 4);

  mixer.stop();
}


async function testDefaultAndSlotAudioShareSourceNodesWithSeparateGains()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  for (let slot = 0; slot < 3; slot++)
  {
    mixer.appendStream(createStream({ video: false, audio: true }), slot);
  }

  const defaultOutput = await mixer.getAudioStream();
  const slotOutput = await mixer.getAudioStream({ slots: [ 0, 1 ] });
  const context = MockAudioContext.instances[0];

  assert.ok(defaultOutput);
  assert.ok(slotOutput);
  assert.strictEqual(defaultOutput.getAudioTracks().length, 1);
  assert.strictEqual(defaultOutput.getVideoTracks().length, 0);
  assert.strictEqual(slotOutput.getAudioTracks().length, 1);
  assert.strictEqual(slotOutput.getVideoTracks().length, 0);
  assert.strictEqual(context.destinations.length, 2);
  assert.strictEqual(context.destinations[0].inputs.length, 1);
  assert.strictEqual(context.destinations[1].inputs.length, 1);
  assert.strictEqual(context.sources.length, 3);

  const defaultCompressor = context.destinations[0].inputs[0];
  const slotCompressor = context.destinations[1].inputs[0];

  assert.notStrictEqual(defaultCompressor, slotCompressor);
  assert.strictEqual(defaultCompressor.inputs.length, 3);
  assert.strictEqual(slotCompressor.inputs.length, 2);

  mixer.stop();
  assert.strictEqual(defaultCompressor.disconnected, true);
  assert.strictEqual(slotCompressor.disconnected, true);
}


async function testSlotAudioStreamRecreatesWhenRequestedBeforeSources()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
  const pendingOutput = await mixer.getAudioStream({ slots: [ 0 ] });
  const context = MockAudioContext.instances[0];

  assert.ok(pendingOutput);
  assert.strictEqual(pendingOutput.getAudioTracks().length, 1);
  assert.strictEqual(context.destinations.length, 1);
  assert.strictEqual(context.destinations[0].inputs.length, 1);
  assert.strictEqual(context.destinations[0].inputs[0].inputs.length, 0);

  mixer.appendStream(createStream({ video: false, audio: true }), 0);
  await flushAsync();

  const activeOutput = await mixer.getAudioStream({ slots: [ 0 ] });

  assert.notStrictEqual(activeOutput, pendingOutput);
  assert.strictEqual(context.destinations.length, 2);
  assert.strictEqual(context.destinations[0].stream.getAudioTracks()[0].readyState, 'ended');
  assert.strictEqual(context.destinations[1].inputs.length, 1);
  assert.strictEqual(context.destinations[1].inputs[0].inputs.length, 1);

  mixer.stop();
}


async function testAudioSourceFansOutThroughMasterGain()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
  const stream = createStream({ video: false, audio: true });

  mixer.appendStream(stream, 0);

  const defaultOutput = await mixer.getAudioStream();
  const slotOutput = await mixer.getAudioStream({ slots: [ 0 ] });
  const source = mixer._sources[0];

  assert.ok(defaultOutput);
  assert.ok(slotOutput);
  assert.strictEqual(source.audioSourceNode.connections.length, 1);
  assert.strictEqual(source.audioSourceNode.connections[0], source.masterGainNode);
  assert.strictEqual(source.masterGainNode.connections.length, 2);
  assert.strictEqual(source.gainNode.connections[0], mixer._audioComposer._compressorNode);

  const bus = mixer._audioComposer._audioBuses.get('0');
  const busConnection = bus.connections.get(source.id);

  assert.ok(busConnection);
  assert.strictEqual(busConnection.masterGainNode, source.masterGainNode);
  assert.strictEqual(busConnection.gainNode.connections[0], bus.compressor);

  mixer.stop();
}


async function testAudioSourceKeepsNodeWhenStreamObjectChangesButTrackIsSame()
{
  resetMockState();

  const video = new MockVideoElement();
  const firstStream = createStream({ audio: true });
  const secondStream = new MockMediaStream(firstStream.getTracks());

  video.srcObject = firstStream;

  const mixer = new MediaEffectsComposer(video, { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  await mixer.getAudioStream();

  const source = mixer._sources[0];
  const audioSourceNode = source.audioSourceNode;

  video.srcObject = secondStream;
  mixer._drawVideosToCanvas(undefined, true);
  await flushAsync();

  assert.strictEqual(source.audioSourceNode, audioSourceNode);
  assert.strictEqual(source.audioStream, firstStream);
  assert.strictEqual(MockAudioContext.instances[0].sources.length, 1);

  mixer.stop();
}


async function testBusRefreshMutesRemovedGainWithoutDisconnectingMaster()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
  const streamA = createStream({ video: false, audio: true });
  const streamB = createStream({ video: false, audio: true });

  mixer.appendStream(streamA, 0);
  mixer.appendStream(streamB, 1);

  await mixer.getAudioStream();
  await mixer.getAudioStream({ slots: [ 0, 1 ] });

  const sourceA = mixer._sources.find((source) => source.stream === streamA);
  const masterGain = sourceA.masterGainNode;
  const bus = mixer._audioComposer._audioBuses.get('0,1');
  const busGain = bus.connections.get(sourceA.id).gainNode;

  mixer.removeStream(streamA.id);

  assert.strictEqual(masterGain.disconnected, true);
  assert.strictEqual(busGain.disconnected, true);
  assert.strictEqual(busGain.gain.value, 0);
  assert.strictEqual(bus.connections.has(sourceA.id), false);

  mixer.stop();
  assert.strictEqual(busGain.disconnected, true);
}


async function testAudioRefreshIsBatchedIntoSingleMicrotask()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  await mixer.getAudioStream({ slots: [ 0, 1 ] });

  mixer.appendStream(createStream({ video: false, audio: true }), 0);
  mixer.appendStream(createStream({ video: false, audio: true }), 1);

  const bus = mixer._audioComposer._audioBuses.get('0,1');

  assert.strictEqual(bus.connections.size, 0);

  await flushAsync();

  assert.strictEqual(bus.connections.size, 2);
  mixer.stop();
}


async function testSlotAudioStreamRecreatesEvenWhenPreviousTrackMuted()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  mixer.appendStream(createStream({ video: false, audio: true }), 0);

  const output = await mixer.getAudioStream({ slots: [ 0 ] });
  const context = MockAudioContext.instances[0];
  const oldDestination = context.destinations[0];
  const track = output.getAudioTracks()[0];

  track.muted = true;

  const refreshed = await mixer.getAudioStream({ slots: [ 0 ] });

  assert.notStrictEqual(refreshed, output);
  assert.strictEqual(context.destinations.length, 2);
  assert.strictEqual(oldDestination.disconnected, true);

  mixer.stop();
}


async function testDestinationTrackHealthRecreatesEndedBusDestination()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  mixer.appendStream(createStream({ video: false, audio: true }), 0);

  const output = await mixer.getAudioStream({ slots: [ 0 ] });
  const context = MockAudioContext.instances[0];
  const oldDestination = context.destinations[0];
  const track = output.getAudioTracks()[0];

  track.readyState = 'ended';

  const refreshed = await mixer.getAudioStream({ slots: [ 0 ] });
  const newDestination = context.destinations[1];

  assert.notStrictEqual(refreshed, output);
  assert.strictEqual(oldDestination.disconnected, true);
  assert.strictEqual(newDestination.stream, refreshed);
  assert.strictEqual(newDestination.inputs.length, 1);

  mixer.stop();
}


async function testIsolatedSlotAudioStreamsCreateIndependentContexts()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  for (let slot = 0; slot < 4; slot++)
  {
    mixer.appendStream(createStream({ video: false, audio: true }), slot);
  }

  const first = await mixer.getAudioStream({ slots: [ 0, 1 ], isolated: true });
  const second = await mixer.getAudioStream({ slots: [ 2, 3 ], isolated: true });
  const firstAgain = await mixer.getAudioStream({ slots: [ 1, 0 ], isolated: true });
  const info = mixer.getAudioInfo();

  assert.ok(first);
  assert.ok(second);
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(firstAgain, first);
  assert.strictEqual(first.getVideoTracks().length, 0);
  assert.strictEqual(second.getVideoTracks().length, 0);
  assert.strictEqual(firstAgain.getVideoTracks().length, 0);
  assert.strictEqual(MockAudioContext.instances.length, 3);
  assert.strictEqual(info.busCount, 0);
  assert.strictEqual(info.isolatedSubmixCount, 2);
  assert.strictEqual(info.isolatedContextRequests, 3);

  mixer.stop();
  assert.strictEqual(MockAudioContext.instances[0].closed, true);
  assert.strictEqual(MockAudioContext.instances[1].closed, true);
  assert.strictEqual(MockAudioContext.instances[2].closed, true);
}


async function testReleaseIsolatedSubmixAudioStreamClosesContext()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  for (let slot = 0; slot < 3; slot++)
  {
    mixer.appendStream(createStream({ video: false, audio: true }), slot);
  }

  const output = await mixer.getAudioStream({ slots: [ 0, 1 ], isolated: true });

  assert.ok(output);
  assert.strictEqual(MockAudioContext.instances.length, 1);
  assert.strictEqual(MockAudioContext.instances[0].closed, false);

  const released = mixer.releaseSubmixStream({ slots: [ 1, 0 ], isolated: true });

  assert.strictEqual(released, true);
  assert.strictEqual(MockAudioContext.instances[0].closed, true);
  assert.strictEqual(mixer.getAudioInfo().busCount, 0);
  assert.strictEqual(mixer.getAudioInfo().isolatedSubmixCount, 0);
  assert.strictEqual(mixer.releaseSubmixStream({ slots: [ 0, 1 ], isolated: true }), false);

  mixer.stop();
}


async function testSlotAudioStreamDefaultsToNewDestinationTrack()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  mixer.appendStream(createStream({ video: false, audio: true }), 0);

  const first = await mixer.getAudioStream({ slots: [ 0 ] });
  const firstAgain = await mixer.getAudioStream({ slots: [ 0 ] });
  const context = MockAudioContext.instances[0];

  assert.notStrictEqual(firstAgain, first);
  assert.notStrictEqual(firstAgain.getAudioTracks()[0], first.getAudioTracks()[0]);
  assert.strictEqual(context.destinations.length, 2);
  assert.strictEqual(context.destinations[0].stream.getAudioTracks()[0].readyState, 'ended');
  assert.strictEqual(context.closed, false);

  mixer.stop();
}


async function testAudioTrackEndedDisconnectsSourceAndBus()
{
  resetMockState();

  const stream = createStream({ video: false, audio: true });
  const track = stream.getAudioTracks()[0];
  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  mixer.appendStream(stream, 0);
  await mixer.getAudioStream();
  await mixer.getAudioStream({ slots: [ 0 ] });

  const source = mixer._sources[0];
  const bus = mixer._audioComposer._audioBuses.get('0');
  const busGain = bus.connections.get(source.id).gainNode;
  const masterGain = source.masterGainNode;

  assert.strictEqual(mixer.getAudioInfo().boundTrackListeners, 1);

  track.stop();
  await flushAsync();

  assert.strictEqual(source.audioSourceNode, null);
  assert.strictEqual(source.audioTrackListeners, null);
  assert.strictEqual(bus.connections.size, 0);
  assert.strictEqual(busGain.disconnected, true);
  assert.strictEqual(masterGain.disconnected, true);
  assert.strictEqual(mixer.getAudioInfo().boundTrackListeners, 0);

  mixer.stop();
}


async function testMixedStreamCreatesStableAudioTrackBeforeSources()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
  const mixed = await mixer.getMixedStream();
  const audioTrack = mixed.getAudioTracks()[0];
  const context = MockAudioContext.instances[0];

  assert.ok(audioTrack);
  assert.strictEqual(mixed.getAudioTracks().length, 1);
  assert.strictEqual(context.destinations.length, 1);

  mixer.appendStream(createStream({ video: false, audio: true }), 0);
  await flushAsync();

  assert.strictEqual(mixed.getAudioTracks().length, 1);
  assert.strictEqual(mixed.getAudioTracks()[0], audioTrack);
  assert.strictEqual(mixer.getAudioInfo().stableOutputAudioTrack, true);

  mixer.stop();
}

async function testFullCapacityAllowsSameSlotReplacementAndStateIsIsolated()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  for (let slot = 0; slot < ComposerConfig.getMaxSources(); slot++)
  {
    assert.strictEqual(mixer.addSource(createStream(), {
      slot,
      aiBackground : slot === 3 ? {
        enabled        : true,
        mode           : 'blur',
        postProcessing : { foregroundBrightness: 1.2 }
      } : null
    }), true);
  }

  const snapshot = mixer.getState();

  snapshot.sources[3].aiBackground.postProcessing.foregroundBrightness = 0;
  assert.strictEqual(mixer.getState().sources[3].aiBackground.postProcessing.foregroundBrightness, 1.2);

  const replacement = createStream();

  assert.strictEqual(mixer.addSource(replacement, 3), true);
  assert.strictEqual(mixer.getSources().length, ComposerConfig.getMaxSources());
  assert.strictEqual(mixer.getSources().find((source) => source.slot === 3).streamId, replacement.id);
  mixer.stop();
}

const TESTS = [
  { name: 'testPlainAudioRequestWithoutSourceDoesNotCreateAudioContext', fn: testPlainAudioRequestWithoutSourceDoesNotCreateAudioContext },
  { name: 'testAppendAudioSourceInjectsAudioTrack', fn: testAppendAudioSourceInjectsAudioTrack },
  { name: 'testRepeatedOutputCallsReuseLiveStream', fn: testRepeatedOutputCallsReuseLiveStream },
  { name: 'testNewPublicApiStateAndSourceLifecycle', fn: testNewPublicApiStateAndSourceLifecycle },
  { name: 'testNewPublicApiConfigAndOutputs', fn: testNewPublicApiConfigAndOutputs },
  { name: 'testStopRejectsPublicReuse', fn: testStopRejectsPublicReuse },
  { name: 'testExternalVideoSrcObjectReconnectsAudio', fn: testExternalVideoSrcObjectReconnectsAudio },
  { name: 'testSlotAudioStreamsCreateIndependentBuses', fn: testSlotAudioStreamsCreateIndependentBuses },
  { name: 'testDefaultAudioStreamStillMixesAllSources', fn: testDefaultAudioStreamStillMixesAllSources },
  { name: 'testDefaultAndSlotAudioShareSourceNodesWithSeparateGains', fn: testDefaultAndSlotAudioShareSourceNodesWithSeparateGains },
  { name: 'testSlotAudioStreamRecreatesWhenRequestedBeforeSources', fn: testSlotAudioStreamRecreatesWhenRequestedBeforeSources },
  { name: 'testAudioSourceFansOutThroughMasterGain', fn: testAudioSourceFansOutThroughMasterGain },
  { name: 'testAudioSourceKeepsNodeWhenStreamObjectChangesButTrackIsSame', fn: testAudioSourceKeepsNodeWhenStreamObjectChangesButTrackIsSame },
  { name: 'testBusRefreshMutesRemovedGainWithoutDisconnectingMaster', fn: testBusRefreshMutesRemovedGainWithoutDisconnectingMaster },
  { name: 'testAudioRefreshIsBatchedIntoSingleMicrotask', fn: testAudioRefreshIsBatchedIntoSingleMicrotask },
  { name: 'testSlotAudioStreamRecreatesEvenWhenPreviousTrackMuted', fn: testSlotAudioStreamRecreatesEvenWhenPreviousTrackMuted },
  { name: 'testDestinationTrackHealthRecreatesEndedBusDestination', fn: testDestinationTrackHealthRecreatesEndedBusDestination },
  { name: 'testIsolatedSlotAudioStreamsCreateIndependentContexts', fn: testIsolatedSlotAudioStreamsCreateIndependentContexts },
  { name: 'testReleaseIsolatedSubmixAudioStreamClosesContext', fn: testReleaseIsolatedSubmixAudioStreamClosesContext },
  { name: 'testSlotAudioStreamDefaultsToNewDestinationTrack', fn: testSlotAudioStreamDefaultsToNewDestinationTrack },
  { name: 'testAudioTrackEndedDisconnectsSourceAndBus', fn: testAudioTrackEndedDisconnectsSourceAndBus },
  { name: 'testMixedStreamCreatesStableAudioTrackBeforeSources', fn: testMixedStreamCreatesStableAudioTrackBeforeSources },
  { name: 'testFullCapacityAllowsSameSlotReplacementAndStateIsIsolated', fn: testFullCapacityAllowsSameSlotReplacementAndStateIsIsolated }
];

async function run(customSuiteName)
{
  const suiteName = customSuiteName || 'MediaEffectsComposer-Audio';
  const restoreBrowserMocks = installBrowserMocks();

  try
  {
    return await runSuite({
      suiteName : suiteName,
      tests     : TESTS
    });
  }
  finally
  {
    restoreBrowserMocks();
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
