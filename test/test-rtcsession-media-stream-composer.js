/* eslint-disable no-console */
const assert = require('assert');
let trackSeed = 0;

class MockMediaStreamTrack
{
  constructor(kind, settings)
  {
    this.kind = kind;
    this.id = `${kind}-${++trackSeed}`;
    this.readyState = 'live';
    this._settings = Object.assign({}, settings || {});
  }

  getSettings()
  {
    return Object.assign({}, this._settings);
  }

  stop()
  {
    this.readyState = 'ended';
  }

  addEventListener() {}

  removeEventListener() {}
}

class MockMediaStream
{
  constructor(tracks)
  {
    this._tracks = (tracks || []).slice();
  }

  getTracks()
  {
    return this._tracks.slice();
  }

  getVideoTracks()
  {
    return this._tracks.filter((track) => track.kind === 'video');
  }

  getAudioTracks()
  {
    return this._tracks.filter((track) => track.kind === 'audio');
  }

  addTrack(track)
  {
    this._tracks.push(track);
  }

  removeTrack(track)
  {
    const index = this._tracks.indexOf(track);

    if (index >= 0)
    {
      this._tracks.splice(index, 1);
    }
  }
}

class MockMixer
{
  constructor(streams, options)
  {
    this.streams = streams;
    this.options = options;
    this.stopped = false;
    this.outputTrack = new MockMediaStreamTrack('video', { width: 640, height: 360, frameRate: 24 });
    MockMixer.instances.push(this);
  }

  async getOutput(options)
  {
    this.outputRequest = options;
    
    return new MockMediaStream([ this.outputTrack ]);
  }

  removeSource(stream)
  {
    this.removed = stream;
    MockMixer.removeCalls.push(stream);
    if (MockMixer.throwOnRemove)
    {
      throw new Error('remove failed');
    }
  }

  addSource(stream)
  {
    this.appended = stream;
    MockMixer.appendCalls.push(stream);
    if (MockMixer.throwOnAppend)
    {
      throw new Error('append failed');
    }
  }

  stop()
  {
    this.stopped = true;
    MockMixer.stopCalls += 1;
  }
}

MockMixer.instances = [];
MockMixer.stopCalls = 0;
MockMixer.removeCalls = [];
MockMixer.appendCalls = [];
MockMixer.throwOnRemove = false;
MockMixer.throwOnAppend = false;

class MockAiNSEngine
{
  constructor(options)
  {
    this.options = options;
    this.processCalls = [];
    this.replaceAudioTrackCalls = [];
    this.destroyed = false;
    MockAiNSEngine.instances.push(this);
  }

  async process(stream)
  {
    this.processCalls.push(stream);

    if (MockAiNSEngine.transform)
    {
      return MockAiNSEngine.transform(stream, this);
    }

    return stream;
  }

  async replaceAudioTrack(stream)
  {
    this.replaceAudioTrackCalls.push(stream);

    if (MockAiNSEngine.replaceAudioTrackTransform)
    {
      return MockAiNSEngine.replaceAudioTrackTransform(stream, this);
    }

    return stream;
  }

  async destroy()
  {
    this.destroyed = true;
    MockAiNSEngine.destroyCalls += 1;
  }
}

MockAiNSEngine.instances = [];
MockAiNSEngine.destroyCalls = 0;
MockAiNSEngine.transform = null;
MockAiNSEngine.replaceAudioTrackTransform = null;

function createMockUA()
{
  return {
    configuration : {
      session_timers                : false,
      session_timers_refresh_method : 'UPDATE'
    },
    sk                : [ '', '', '', '', '', '', '', '3', 'example.com' ],
    destroyRTCSession : function() {}
  };
}

function installGlobals()
{
  const snapshot = {
    MediaStream : global.MediaStream,
    navigator   : global.navigator,
    document    : global.document,
    window      : global.window
  };

  global.MediaStream = MockMediaStream;
  global.navigator = {
    userAgent    : 'unit-test',
    mediaDevices : {
      getUserMedia : () => Promise.resolve(new MockMediaStream())
    }
  };
  global.document = {
    hidden           : false,
    addEventListener : function() {}
  };
  global.window = global.window || {};

  return () =>
  {
    global.MediaStream = snapshot.MediaStream;
    global.navigator = snapshot.navigator;
    global.document = snapshot.document;
    global.window = snapshot.window;
  };
}

function loadRTCSessionWithMockMixer()
{
  const mixerPath = require.resolve('../lib/MediaStreamComposer');
  const aiNSPath = require.resolve('../lib/AINoiseSuppression/index.js');
  const rtcSessionPath = require.resolve('../lib/RTCSession');
  const mixerCache = require.cache[mixerPath];
  const aiNSCache = require.cache[aiNSPath];
  const rtcCache = require.cache[rtcSessionPath];

  require.cache[mixerPath] = {
    id       : mixerPath,
    filename : mixerPath,
    loaded   : true,
    exports  : MockMixer
  };
  require.cache[aiNSPath] = {
    id       : aiNSPath,
    filename : aiNSPath,
    loaded   : true,
    exports  : MockAiNSEngine
  };
  delete require.cache[rtcSessionPath];

  return () =>
  {
    if (mixerCache)
    {
      require.cache[mixerPath] = mixerCache;
    }
    else
    {
      delete require.cache[mixerPath];
    }

    if (aiNSCache)
    {
      require.cache[aiNSPath] = aiNSCache;
    }
    else
    {
      delete require.cache[aiNSPath];
    }

    if (rtcCache)
    {
      require.cache[rtcSessionPath] = rtcCache;
    }
    else
    {
      delete require.cache[rtcSessionPath];
    }
  };
}

async function testApplyMediaStreamComposerOnSdkGumStreamUsesCtorOptions()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceVideo = new MockMediaStreamTrack('video', { width: 1280, height: 720, frameRate: 30 });
  const sourceAudio = new MockMediaStreamTrack('audio');
  const sourceStream = new MockMediaStream([ sourceVideo, sourceAudio ]);
  const mixed = await session._mediaPipeline.applyMediaStreamComposerOnSdkGumStream(sourceStream, {
    sourceMirror : true,
    mirror       : true,
    watermarks   : [
      { id: 'out', target: 'output', type: 'text', text: 'ok' },
      { id: 'src', target: 'source', type: 'text', text: 'skip' },
      { id: 'none', type: 'text', text: 'keep' }
    ]
  });

  assert.notStrictEqual(mixed, sourceStream);
  assert.strictEqual(mixed.getAudioTracks().length, 1);
  assert.strictEqual(mixed.getVideoTracks().length, 1);
  assert.strictEqual(session.getMediaStreamComposer(), MockMixer.instances[0]);
  assert.deepStrictEqual(MockMixer.instances[0].outputRequest, { type: 'video' });

  const ctorOptions = MockMixer.instances[0].options;

  assert.strictEqual(ctorOptions.width, 1280);
  assert.strictEqual(ctorOptions.height, 720);
  assert.strictEqual(ctorOptions.fps, 30);
  assert.strictEqual(ctorOptions.sourceMirror, true);
  assert.strictEqual(ctorOptions.mirror, true);
  assert.strictEqual(ctorOptions.watermarks.length, 3);
  assert.strictEqual(ctorOptions.watermarks[0].id, 'out');
  assert.strictEqual(ctorOptions.watermarks[1].id, 'src');
  assert.strictEqual(ctorOptions.watermarks[2].id, 'none');
}

async function testApplyMediaStreamComposerSkipsWhenNoVideoOrNoOptions()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const audioOnly = new MockMediaStream([ new MockMediaStreamTrack('audio') ]);
  const noOptions = await session._mediaPipeline.applyMediaStreamComposerOnSdkGumStream(audioOnly, null);
  const noVideo = await session._mediaPipeline.applyMediaStreamComposerOnSdkGumStream(audioOnly, { sourceMirror: true });

  assert.strictEqual(noOptions, audioOnly);
  assert.strictEqual(noVideo, audioOnly);
  assert.strictEqual(session.getMediaStreamComposer(), null);
}

async function testCloseStopsAndClearsMediaStreamComposer()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceAudioTrack = new MockMediaStreamTrack('audio');
  const sourceVideoTrack = new MockMediaStreamTrack('video', { width: 640, height: 360, frameRate: 15 });
  const sourceStream = new MockMediaStream([
    sourceAudioTrack,
    sourceVideoTrack
  ]);

  await session._mediaPipeline.applyMediaStreamComposerOnSdkGumStream(sourceStream, { mirror: true });
  assert.ok(session.getMediaStreamComposer());

  session._close();

  assert.strictEqual(MockMixer.stopCalls >= 1, true);
  assert.strictEqual(session.getMediaStreamComposer(), null);
  assert.strictEqual(sourceAudioTrack.readyState, 'ended');
  assert.strictEqual(sourceVideoTrack.readyState, 'ended');
}

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
  session._sessionMediaStreamComposerOptions = {
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

async function testSwitchDeviceCameraDefaultPathDoesNotApplyMixer()
{
  // 目标：默认分支（即使 session 配了 mixer options，但当前没有 active mixer）不应重建/应用 mixer。
  // 预期：sender 直接替换为新摄像头 track，MockMixer 不产生新实例。
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
  
  session._sessionMediaStreamComposerOptions = {
    mirror     : true,
    watermarks : [ { id: 'wm-switch', target: 'output', type: 'text', text: 'switch' } ]
  };
  global.navigator.mediaDevices.getSupportedConstraints = () => ({ facingMode: true });
  global.navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MockMediaStream([ newVideoTrack ]));

  await session.switchDevice('camera', 'user');

  assert.strictEqual(MockMixer.instances.length, 0);
  assert.strictEqual(sender.replaced, newVideoTrack);
  assert.strictEqual(session._localMediaStream.getVideoTracks()[0], newVideoTrack);
}

async function testSwitchDeviceCameraWithActiveMixerReusesMixer()
{
  // 目标：active mixer 场景复用同一个 mixer 实例，不重建 mixer。
  // 预期：走 removeSource + addSource 替换输入源，sender 仍发送 mixer 输出轨。
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
  session._sessionMediaStreamComposerOptions = { mirror: true };

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

  session._mediaStreamComposer = composer;
  session._mediaStreamComposerInputStream = oldInputStream;

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
  assert.strictEqual(session._mediaStreamComposerInputStream, MockMixer.appendCalls[0]);
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
  session._sessionMediaStreamComposerOptions = { mirror: true };
  session._mediaStreamComposer = {
    removeSource : function() {},
    addSource    : function() {},
    getOutput    : async function()
    {
      return new MockMediaStream([ new MockMediaStreamTrack('video') ]);
    }
  };
  session._mediaStreamComposerInputStream = oldInputStream;

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
  session._sessionMediaStreamComposerOptions = { mirror: true };
  session._mediaStreamComposer = {
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
  session._mediaStreamComposerInputStream = oldInputStream;

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
  session._sessionMediaStreamComposerOptions = {
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

  assert.strictEqual(stream, processedStream);
  assert.strictEqual(sender.replaced, replacementAudioTrack);
  assert.strictEqual(session._localMediaStream.getAudioTracks()[0], replacementAudioTrack);
  assert.strictEqual(session._sessionAiNSEngine.replaceAudioTrackCalls.length, 1);
  assert.strictEqual(session._sessionAiNSEngine.replaceAudioTrackCalls[0], sourceStream);
  assert.strictEqual(session._sessionAiNSEngine.processCalls.length, 0);
  assert.strictEqual(session._aiNSInputStream, sourceStream);
}

async function testCloseDestroysSessionAiNoiseSuppression()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('audio') ]);

  await session._mediaPipeline.applyAiNoiseSuppressionOnSdkGumStream(sourceStream, true);

  session._close();
  await Promise.resolve();

  assert.strictEqual(MockAiNSEngine.destroyCalls, 1);
  assert.strictEqual(session._sessionAiNSEngine, null);
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

async function run()
{
  const restoreGlobals = installGlobals();
  const restoreModules = loadRTCSessionWithMockMixer();
  let passed = 0;
  let failed = 0;
  const failures = [];

  const TESTS = [
    { name: 'testApplyMediaStreamComposerOnSdkGumStreamUsesCtorOptions', fn: testApplyMediaStreamComposerOnSdkGumStreamUsesCtorOptions },
    { name: 'testApplyMediaStreamComposerSkipsWhenNoVideoOrNoOptions', fn: testApplyMediaStreamComposerSkipsWhenNoVideoOrNoOptions },
    { name: 'testCloseStopsAndClearsMediaStreamComposer', fn: testCloseStopsAndClearsMediaStreamComposer },
    { name: 'testUpgradeToVideoAppliesSessionMixerToSdkGum', fn: testUpgradeToVideoAppliesSessionMixerToSdkGum },
    { name: 'testSwitchDeviceCameraDefaultPathDoesNotApplyMixer', fn: testSwitchDeviceCameraDefaultPathDoesNotApplyMixer },
    { name: 'testSwitchDeviceCameraWithActiveMixerReusesMixer', fn: testSwitchDeviceCameraWithActiveMixerReusesMixer },
    { name: 'testSwitchDeviceCameraMixerBranchStopsOldInputBeforeGum', fn: testSwitchDeviceCameraMixerBranchStopsOldInputBeforeGum },
    { name: 'testSwitchDeviceCameraMixerBranchFallbackToDefault', fn: testSwitchDeviceCameraMixerBranchFallbackToDefault },
    { name: 'testReplaceCanvasToVideoAppliesSessionMixerToSdkGum', fn: testReplaceCanvasToVideoAppliesSessionMixerToSdkGum },
    { name: 'testGetUserMediaPipelineAppliesSessionAiNoiseSuppression', fn: testGetUserMediaPipelineAppliesSessionAiNoiseSuppression },
    { name: 'testSessionAiNoiseSuppressionDisablesNativeNoiseSuppression', fn: testSessionAiNoiseSuppressionDisablesNativeNoiseSuppression },
    { name: 'testApplyAiNoiseSuppressionSkipsDisabledOptions', fn: testApplyAiNoiseSuppressionSkipsDisabledOptions },
    { name: 'testSwitchDeviceAudioReusesSessionAiNoiseSuppressionEngine', fn: testSwitchDeviceAudioReusesSessionAiNoiseSuppressionEngine },
    { name: 'testCloseDestroysSessionAiNoiseSuppression', fn: testCloseDestroysSessionAiNoiseSuppression },
    { name: 'testProcessMediaStreamDoesNotApplySessionAiNoiseSuppression', fn: testProcessMediaStreamDoesNotApplySessionAiNoiseSuppression }
  ];

  try
  {
    MockMixer.instances = [];
    MockMixer.stopCalls = 0;
    MockMixer.removeCalls = [];
    MockMixer.appendCalls = [];
    MockMixer.throwOnRemove = false;
    MockMixer.throwOnAppend = false;
    MockAiNSEngine.instances = [];
    MockAiNSEngine.destroyCalls = 0;
    MockAiNSEngine.transform = null;
    MockAiNSEngine.replaceAudioTrackTransform = null;

    for (const t of TESTS)
    {
      MockMixer.instances = [];
      MockMixer.removeCalls = [];
      MockMixer.appendCalls = [];
      MockAiNSEngine.instances = [];
      MockAiNSEngine.destroyCalls = 0;
      MockAiNSEngine.transform = null;
      MockAiNSEngine.replaceAudioTrackTransform = null;
      if (t.fn === testCloseStopsAndClearsMediaStreamComposer)
      {
        MockMixer.stopCalls = 0;
      }
      try
      {
        await t.fn();
        passed++;
      }
      catch (e)
      {
        failed++;
        failures.push({ name: t.name, error: e });
      }
    }
  }
  finally
  {
    restoreModules();
    restoreGlobals();
  }

  if (failures.length > 0)
  {
    console.log(`\n  RTCSession-MediaStreamComposer Failures (${failed}):`);
    for (const f of failures)
    {
      console.log(`    ✗ ${f.name}`);
      console.log(`      ${f.error.message}`);
    }
  }
  console.log(`  RTCSession-MediaStreamComposer Tests: ${passed} passed, ${failed} failed, ${TESTS.length} total`);

  if (failed > 0)
  {
    throw new Error(`${failed} RTCSession-MediaStreamComposer test(s) failed`);
  }
}

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
