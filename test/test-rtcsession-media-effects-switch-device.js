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

async function testUpgradeToVideoAppliesSessionMixerToSdkGum()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const localAudioTrack = new MockMediaStreamTrack('audio');
  const oldVideoTrack = new MockMediaStreamTrack('video');
  const senderState = { replaced: null };
  const transceiver = {
    direction : 'sendrecv',
    sender    : {
      replaceTrack : async(track) =>
      {
        senderState.replaced = track;
      }
    }
  };

  session._status = session.C.STATUS_CONFIRMED;
  session._connection = {
    getTransceivers : () => [],
    addTransceiver  : () => transceiver
  };
  session._localMediaStream = new MockMediaStream([ localAudioTrack ]);
  session._inviteMediaConstraints = { video: true };
  session._sessionMediaEffectsComposerOptions = {
    sourceMirror : true,
    watermarks   : [ { id: 'wm-upgrade', target: 'output', type: 'text', text: 'upgrade' } ]
  };
  session.renegotiate = function(opts, cb)
  {
    cb && cb();

    return true;
  };
  global.navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MockMediaStream([ oldVideoTrack ]));

  await session.upgradeToVideo({}, () => {});

  assert.strictEqual(MockMixer.instances.length, 1);
  assert.strictEqual(session._localMediaStream.getVideoTracks().length, 1);
  assert.strictEqual(session._localMediaStream.getVideoTracks()[0], MockMixer.instances[0].outputTrack);
  assert.strictEqual(senderState.replaced, MockMixer.instances[0].outputTrack);
}


async function testSwitchDeviceCameraDefaultPathAppliesSessionMixer()
{
  // 目标：默认分支在 session 配了 composer options 时，应重新走完整媒体管线。
  // 预期：sender 替换为 composer 输出轨，新的 composer 实例会被创建。
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const oldVideoTrack = new MockMediaStreamTrack('video');
  const newVideoTrack = new MockMediaStreamTrack('video', { width: 640, height: 480, frameRate: 15 });
  const sender = {
    track        : oldVideoTrack,
    replaceTrack : function(track)
    {
      this.replaced = track;
      this.track = track;
    }
  };

  session._status = session.C.STATUS_CONFIRMED;
  session._enableBFCP = false;
  session._connection = {
    getSenders : () => [ sender ]
  };
  session._localCameras = [ 'cam-a', 'cam-b' ];
  session._localMediaStream = new MockMediaStream([ oldVideoTrack ]);
  session._inviteMediaConstraints = { video: {} };

  session._sessionMediaEffectsComposerOptions = {
    mirror     : true,
    watermarks : [ { id: 'wm-switch', target: 'output', type: 'text', text: 'switch' } ]
  };
  global.navigator.mediaDevices.getSupportedConstraints = () => ({ facingMode: true });
  global.navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MockMediaStream([ newVideoTrack ]));

  await session.switchDevice('camera', 'user');

  assert.strictEqual(MockMixer.instances.length, 1);
  assert.strictEqual(MockMixer.instances[0].options.mirror, true);
  assert.strictEqual(sender.replaced, MockMixer.instances[0].outputTrack);
  assert.strictEqual(session._localMediaStream.getVideoTracks()[0], MockMixer.instances[0].outputTrack);
}


async function testSwitchDeviceCameraWithActiveMixerReusesMixer()
{
  // 目标：active mixer 场景复用同一个 mixer 实例，不重建 mixer。
  // 预期：走 removeSource + addSource 替换输入源，sender 仍发送 mixer 输出轨。
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const oldInputAudioTrack = new MockMediaStreamTrack('audio');
  const oldInputVideoTrack = new MockMediaStreamTrack('video');
  const oldInputStream = new MockMediaStream([ oldInputAudioTrack, oldInputVideoTrack ]);
  const oldMixedTrack = new MockMediaStreamTrack('video');
  const sender = {
    track        : oldMixedTrack,
    replaceTrack : function(track)
    {
      this.replaced = track;
      this.track = track;
    }
  };

  session._status = session.C.STATUS_CONFIRMED;
  session._enableBFCP = false;
  session._connection = {
    getSenders : () => [ sender ]
  };
  session._localCameras = [ 'cam-a', 'cam-b' ];
  session._localMediaStream = new MockMediaStream([ oldMixedTrack ]);
  session._inviteMediaConstraints = { video: {} };
  session._sessionMediaEffectsComposerOptions = { mirror: true };

  const mixedOutputTrack = new MockMediaStreamTrack('video', { width: 960, height: 540, frameRate: 20 });
  const composer = {
    removeSource : function(stream)
    {
      this.removed = stream;
      MockMixer.removeCalls.push(stream);
    },
    addSource : function(stream)
    {
      this.appended = stream;
      MockMixer.appendCalls.push(stream);
    },
    getOutput : async function(options)
    {
      this.outputRequest = options;

      return new MockMediaStream([ mixedOutputTrack ]);
    }
  };

  session._mediaEffectsComposer = composer;
  session._mediaEffectsComposerInputStream = oldInputStream;

  const newVideoTrack = new MockMediaStreamTrack('video', { width: 640, height: 480, frameRate: 15 });

  global.navigator.mediaDevices.getSupportedConstraints = () => ({ facingMode: true });
  global.navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MockMediaStream([ newVideoTrack ]));

  await session.switchDevice('camera', 'user');

  assert.strictEqual(oldInputVideoTrack.readyState, 'ended');
  assert.strictEqual(MockMixer.instances.length, 0);
  assert.strictEqual(MockMixer.removeCalls.length, 1);
  assert.strictEqual(MockMixer.appendCalls.length, 1);
  assert.strictEqual(MockMixer.removeCalls[0], oldInputStream);
  assert.deepStrictEqual(composer.outputRequest, { type: 'video' });
  assert.strictEqual(sender.replaced, mixedOutputTrack);
  assert.strictEqual(session._localMediaStream.getVideoTracks()[0], mixedOutputTrack);
  assert.strictEqual(session._mediaEffectsComposerInputStream, MockMixer.appendCalls[0]);
  assert.strictEqual(MockMixer.appendCalls[0].getAudioTracks()[0], oldInputAudioTrack);
  assert.strictEqual(MockMixer.appendCalls[0].getVideoTracks()[0], newVideoTrack);
}


async function testSwitchDeviceCameraMixerBranchStopsOldInputBeforeGum()
{
  // 目标：验证 mixer 分支关键顺序：先 stop 旧输入 videoTrack，再调用 getUserMedia。
  // 预期：getUserMedia 执行时，oldInputVideoTrack.readyState 已为 ended。
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const oldInputVideoTrack = new MockMediaStreamTrack('video');
  const oldInputStream = new MockMediaStream([ oldInputVideoTrack ]);
  const oldMixedTrack = new MockMediaStreamTrack('video');
  const sender = {
    track        : oldMixedTrack,
    replaceTrack : function(track)
    {
      this.replaced = track;
      this.track = track;
    }
  };

  session._status = session.C.STATUS_CONFIRMED;
  session._enableBFCP = false;
  session._connection = {
    getSenders : () => [ sender ]
  };
  session._localCameras = [ 'cam-a', 'cam-b' ];
  session._localMediaStream = new MockMediaStream([ oldMixedTrack ]);
  session._inviteMediaConstraints = { video: {} };
  session._sessionMediaEffectsComposerOptions = { mirror: true };
  session._mediaEffectsComposer = {
    removeSource : function() {},
    addSource    : function() {},
    getOutput    : async function()
    {
      return new MockMediaStream([ new MockMediaStreamTrack('video') ]);
    }
  };
  session._mediaEffectsComposerInputStream = oldInputStream;

  let stoppedBeforeGum = false;
  const newVideoTrack = new MockMediaStreamTrack('video');

  global.navigator.mediaDevices.getSupportedConstraints = () => ({ facingMode: true });
  global.navigator.mediaDevices.getUserMedia = () =>
  {
    stoppedBeforeGum = oldInputVideoTrack.readyState === 'ended';

    return Promise.resolve(new MockMediaStream([ newVideoTrack ]));
  };

  await session.switchDevice('camera', 'user');

  assert.strictEqual(stoppedBeforeGum, true);
}


async function testSwitchDeviceCameraMixerBranchFallbackToDefault()
{
  // 目标：验证 mixer 分支失败可回退默认流程，保证切换摄像头可用性。
  // 手段：让 mixer.removeStream 抛错，强制进入 fallback。
  // 预期：sender 最终替换为默认分支获取的新摄像头 track。
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const oldInputVideoTrack = new MockMediaStreamTrack('video');
  const oldInputStream = new MockMediaStream([ oldInputVideoTrack ]);
  const oldMixedTrack = new MockMediaStreamTrack('video');
  const sender = {
    track        : oldMixedTrack,
    replaceTrack : function(track)
    {
      this.replaced = track;
      this.track = track;
    }
  };

  session._status = session.C.STATUS_CONFIRMED;
  session._enableBFCP = false;
  session._connection = {
    getSenders : () => [ sender ]
  };
  session._localCameras = [ 'cam-a', 'cam-b' ];
  session._localMediaStream = new MockMediaStream([ oldMixedTrack ]);
  session._inviteMediaConstraints = { video: {} };
  session._sessionMediaEffectsComposerOptions = { mirror: true };
  session._mediaEffectsComposer = {
    removeSource : function()
    {
      throw new Error('remove fail');
    },
    addSource : function() {},
    getOutput : async function()
    {
      return new MockMediaStream([ new MockMediaStreamTrack('video') ]);
    }
  };
  session._mediaEffectsComposerInputStream = oldInputStream;

  const fallbackTrack = new MockMediaStreamTrack('video', { width: 1280, height: 720, frameRate: 30 });

  global.navigator.mediaDevices.getSupportedConstraints = () => ({ facingMode: true });
  global.navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MockMediaStream([ fallbackTrack ]));

  const result = await session.switchDevice('camera', 'user');

  assert.strictEqual(sender.replaced, fallbackTrack);
  assert.strictEqual(result.getVideoTracks()[0], fallbackTrack);
  assert.strictEqual(session._localMediaStream.getVideoTracks()[0], fallbackTrack);
}


async function testReplaceCanvasToVideoAppliesSessionMixerToSdkGum()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const oldVideoTrack = new MockMediaStreamTrack('video');
  const newVideoTrack = new MockMediaStreamTrack('video', { width: 720, height: 1280, frameRate: 24 });
  const sender = {
    track        : oldVideoTrack,
    replaceTrack : function(track)
    {
      this.replaced = track;
      this.track = track;
    }
  };

  session._connection = {
    getSenders : () => [ sender ]
  };
  session._inviteMediaConstraints = { video: true, width: 640, height: 360 };
  session._sessionMediaEffectsComposerOptions = {
    mirror : true
  };
  session._restoreCameraTrackDraw = 1;
  session._restoreCameraTrackCtx = {
    clearRect : function() {}
  };
  session._localMediaStream = new MockMediaStream([ oldVideoTrack ]);
  session.isMuted = () => ({ video: false });
  global.window.cancelAnimationFrame = function() {};
  global.navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MockMediaStream([ newVideoTrack ]));

  session._replaceCanvasToVideo();
  // 需要多次 microtask 刷新以穿透 async 链:
  // getUserMedia → _processMediaStream → _applyMixerOnSdkGumStream → .then()
  for (let i = 0; i < 8; i++)
  {
    await Promise.resolve();
  }

  assert.strictEqual(MockMixer.instances.length, 1);
  assert.strictEqual(sender.replaced, MockMixer.instances[0].outputTrack);
  assert.strictEqual(session._localMediaStream.getVideoTracks()[0], MockMixer.instances[0].outputTrack);
}


async function testSwitchDeviceAudioReusesSessionAiNoiseSuppressionEngine()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const oldAudioTrack = new MockMediaStreamTrack('audio');
  const oldInputAudioTrack = new MockMediaStreamTrack('audio');
  const nextInputAudioTrack = new MockMediaStreamTrack('audio');
  const replacementAudioTrack = new MockMediaStreamTrack('audio');
  const sourceStream = new MockMediaStream([ nextInputAudioTrack ]);
  const processedStream = new MockMediaStream([ replacementAudioTrack ]);
  const sender = {
    track        : oldAudioTrack,
    replaceTrack : function(track)
    {
      this.replaced = track;
      this.track = track;
    }
  };

  session._status = session.C.STATUS_CONFIRMED;
  session._connection = {
    getSenders : () => [ sender ]
  };
  session._localMediaStream = new MockMediaStream([ oldAudioTrack ]);
  session._sessionAiNSOptions = {
    enabled             : true,
    noiseReductionLevel : 75
  };
  session._sessionAiNSEngine = new MockAiNSEngine(session._sessionAiNSOptions);
  session._aiNSInputStream = new MockMediaStream([ oldInputAudioTrack ]);

  MockAiNSEngine.replaceAudioTrackTransform = () => processedStream;
  global.navigator.mediaDevices.getUserMedia = () =>
  {
    assert.strictEqual(oldInputAudioTrack.readyState, 'ended');

    return Promise.resolve(sourceStream);
  };

  const stream = await session.switchDevice('audio', 'mic-2');
  const engine = session.getAiNoiseSuppression();

  assert.strictEqual(stream, processedStream);
  assert.strictEqual(sender.replaced, replacementAudioTrack);
  assert.strictEqual(session._localMediaStream.getAudioTracks()[0], replacementAudioTrack);
  assert.strictEqual(engine.replaceAudioTrackCalls.length, 1);
  assert.strictEqual(engine.replaceAudioTrackCalls[0], sourceStream);
  assert.strictEqual(engine.processCalls.length, 0);
  assert.strictEqual(session._aiNSInputStream, sourceStream);
}


async function testSwitchDeviceCameraAppliesSessionAiVirtualBackground()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const oldVideoTrack = new MockMediaStreamTrack('video');
  const newVideoTrack = new MockMediaStreamTrack('video', { width: 640, height: 480, frameRate: 15 });
  const sender = {
    track        : oldVideoTrack,
    replaceTrack : function(track)
    {
      this.replaced = track;
      this.track = track;
    }
  };

  session._status = session.C.STATUS_CONFIRMED;
  session._enableBFCP = false;
  session._connection = {
    getSenders : () => [ sender ]
  };
  session._localCameras = [ 'cam-a', 'cam-b' ];
  session._localMediaStream = new MockMediaStream([ oldVideoTrack ]);
  session._inviteMediaConstraints = { video: {} };
  session._sessionMediaEffectsComposerOptions = session._mediaPipeline.resolveMediaEffectsComposerOptions({
    mediaEffectsComposer : {
      sources : [
        {
          aiVirtualBackground : {
            enabled  : true,
            mode     : 'image',
            imageUrl : 'https://example.com/bg.png'
          }
        }
      ]
    }
  });
  global.navigator.mediaDevices.getSupportedConstraints = () => ({ facingMode: true });
  global.navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MockMediaStream([ newVideoTrack ]));

  await session.switchDevice('camera', 'user');

  assert.strictEqual(MockMixer.instances.length, 1);
  assert.strictEqual(MockMixer.instances[0].options.sources[0].aiVirtualBackground.imageUrl, 'https://example.com/bg.png');
  assert.strictEqual(sender.replaced, MockMixer.instances[0].outputTrack);
  assert.strictEqual(session._localMediaStream.getVideoTracks()[0], MockMixer.instances[0].outputTrack);
}


async function testUpgradeToVideoAcceptsComposerSourceAiVBOptions()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const localAudioTrack = new MockMediaStreamTrack('audio');
  const capturedVideoTrack = new MockMediaStreamTrack('video');
  const senderState = { replaced: null };
  const transceiver = {
    direction : 'sendrecv',
    sender    : {
      replaceTrack : async(track) =>
      {
        senderState.replaced = track;
      }
    }
  };

  session._status = session.C.STATUS_CONFIRMED;
  session._connection = {
    getTransceivers : () => [],
    addTransceiver  : () => transceiver
  };
  session._localMediaStream = new MockMediaStream([ localAudioTrack ]);
  session._inviteMediaConstraints = { video: true };
  session.renegotiate = function(opts, cb)
  {
    cb && cb();

    return true;
  };
  global.navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MockMediaStream([ capturedVideoTrack ]));

  await session.upgradeToVideo({
    mediaEffectsComposer : {
      sources : [
        {
          aiVirtualBackground : {
            enabled : true,
            mode    : 'color',
            color   : '#abcdef'
          }
        }
      ]
    }
  }, () => {});

  assert.strictEqual(session._sessionMediaEffectsComposerOptions.sources[0].aiVirtualBackground.mode, 'color');
  assert.strictEqual(MockMixer.instances.length, 1);
  assert.strictEqual(MockMixer.instances[0].options.sources[0].aiVirtualBackground.color, '#abcdef');
  assert.strictEqual(senderState.replaced, MockMixer.instances[0].outputTrack);
}

const TESTS = [
  { name: 'testUpgradeToVideoAppliesSessionMixerToSdkGum', fn: testUpgradeToVideoAppliesSessionMixerToSdkGum },
  { name: 'testSwitchDeviceCameraDefaultPathAppliesSessionMixer', fn: testSwitchDeviceCameraDefaultPathAppliesSessionMixer },
  { name: 'testSwitchDeviceCameraWithActiveMixerReusesMixer', fn: testSwitchDeviceCameraWithActiveMixerReusesMixer },
  { name: 'testSwitchDeviceCameraMixerBranchStopsOldInputBeforeGum', fn: testSwitchDeviceCameraMixerBranchStopsOldInputBeforeGum },
  { name: 'testSwitchDeviceCameraMixerBranchFallbackToDefault', fn: testSwitchDeviceCameraMixerBranchFallbackToDefault },
  { name: 'testReplaceCanvasToVideoAppliesSessionMixerToSdkGum', fn: testReplaceCanvasToVideoAppliesSessionMixerToSdkGum },
  { name: 'testSwitchDeviceAudioReusesSessionAiNoiseSuppressionEngine', fn: testSwitchDeviceAudioReusesSessionAiNoiseSuppressionEngine },
  { name: 'testSwitchDeviceCameraAppliesSessionAiVirtualBackground', fn: testSwitchDeviceCameraAppliesSessionAiVirtualBackground },
  { name: 'testUpgradeToVideoAcceptsComposerSourceAiVBOptions', fn: testUpgradeToVideoAcceptsComposerSourceAiVBOptions }
];

async function run(customSuiteName)
{
  const suiteName = customSuiteName || 'RTCSession-MediaEffects-SwitchDevice';
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
