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

    const primarySourceOptions = options && options.sources && options.sources[0] ?
      options.sources[0] :
      null;

    this.sourceAiVirtualBackground = options &&
      primarySourceOptions &&
      primarySourceOptions.aiVirtualBackground ?
      primarySourceOptions.aiVirtualBackground :
      null;
    this.sourceMirrorState = primarySourceOptions && typeof primarySourceOptions.sourceMirror === 'boolean' ?
      primarySourceOptions.sourceMirror :
      false;
    this.configState = {
      outputMirror               : Boolean(options && options.mirror),
      sourceMirror               : Boolean(options && options.sourceMirror),
      sourceMirrorOverrides      : {},
      mirrorWatermarksWithOutput : options && Object.prototype.hasOwnProperty.call(options, 'mirrorWatermarksWithOutput') ?
        Boolean(options.mirrorWatermarksWithOutput) :
        true,
      watermarks : options && options.watermarks ? [].concat(options.watermarks) : []
    };
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

  addSource(stream, options)
  {
    this.appended = stream;
    this.appendedOptions = options || null;
    if (options && Object.prototype.hasOwnProperty.call(options, 'aiVirtualBackground'))
    {
      this.sourceAiVirtualBackground = options.aiVirtualBackground;
    }
    if (options && typeof options.sourceMirror === 'boolean')
    {
      this.sourceMirrorState = options.sourceMirror;
    }
    MockMixer.appendCalls.push(stream);
    MockMixer.appendOptionCalls.push(options || null);
    if (MockMixer.throwOnAppend)
    {
      throw new Error('append failed');
    }
  }

  getSourceAiVirtualBackground()
  {
    return this.sourceAiVirtualBackground;
  }

  setSourceAiVirtualBackground(slotOrTarget, options)
  {
    this.sourceAiVirtualBackground = options;

    return this.sourceAiVirtualBackground;
  }

  clearSourceAiVirtualBackground()
  {
    this.sourceAiVirtualBackground = null;
  }

  getSourceMirror(slot)
  {
    return {
      slot      : slot,
      global    : false,
      override  : null,
      effective : Boolean(this.sourceMirrorState)
    };
  }

  setSourceMirror(slotOrEnabled, enabled)
  {
    if (typeof slotOrEnabled === 'boolean' && enabled === undefined)
    {
      this.configState.sourceMirror = slotOrEnabled;
      this.sourceMirrorState = slotOrEnabled;

      return;
    }

    this.configState.sourceMirrorOverrides[String(slotOrEnabled)] = Boolean(enabled);
    this.sourceMirrorState = Boolean(enabled);
  }

  async setConfig(patch)
  {
    if (Object.prototype.hasOwnProperty.call(patch, 'outputMirror'))
    {
      this.configState.outputMirror = Boolean(patch.outputMirror);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'mirrorWatermarksWithOutput'))
    {
      this.configState.mirrorWatermarksWithOutput = Boolean(patch.mirrorWatermarksWithOutput);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'watermarks'))
    {
      this.configState.watermarks = patch.watermarks ? [].concat(patch.watermarks) : [];
    }

    return this.getState().config;
  }

  getState()
  {
    return {
      sources : [
        {
          slot                : 0,
          sourceMirror        : this.sourceMirrorState,
          aiVirtualBackground : this.sourceAiVirtualBackground
        }
      ],
      config : {
        outputMirror               : this.configState.outputMirror,
        sourceMirror               : this.configState.sourceMirror,
        sourceMirrorOverrides      : Object.assign({}, this.configState.sourceMirrorOverrides),
        mirrorWatermarksWithOutput : this.configState.mirrorWatermarksWithOutput,
        watermarks                 : this.configState.watermarks.slice()
      }
    };
  }

  getRenderInfo()
  {
    return this.renderInfo || {
      actualMode : 'worker-2d',
      isWorker   : true
    };
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
MockMixer.appendOptionCalls = [];
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
  assert.strictEqual(session.getMediaStreamComposer(), MockMixer.instances[0]);
  assert.deepStrictEqual(MockMixer.instances[0].outputRequest, { type: 'video' });

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
  
  session._sessionMediaStreamComposerOptions = {
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
  assert.strictEqual(session.getAiNoiseSuppression(), MockAiNSEngine.instances[0]);
}

async function testGetUserMediaPipelineAppliesSessionAiVirtualBackground()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceVideo = new MockMediaStreamTrack('video', { width: 1280, height: 720, frameRate: 30 });
  const sourceAudio = new MockMediaStreamTrack('audio');
  const sourceStream = new MockMediaStream([ sourceVideo, sourceAudio ]);

  session._sessionMediaStreamComposerOptions = session._mediaPipeline.resolveMediaStreamComposerOptions({
    mediaStreamComposer : {
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
    session._sessionMediaStreamComposerOptions
  );
  const effect = session.getAiVirtualBackground();

  assert.strictEqual(MockMixer.instances.length, 1);
  assert.strictEqual(MockMixer.instances[0].options.sources[0].aiVirtualBackground.mode, 'blur');
  assert.strictEqual(MockMixer.instances[0].options.sources[0].aiVirtualBackground.blurRadius, 18);
  assert.strictEqual(effect.mode, 'blur');
  assert.strictEqual(effect.blurRadius, 18);
  assert.strictEqual(stream.getVideoTracks()[0], MockMixer.instances[0].outputTrack);
  assert.strictEqual(stream.getAudioTracks()[0], sourceAudio);
}

async function testGetUserMediaPipelineAcceptsComposerSourcesArray()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceVideo = new MockMediaStreamTrack('video', { width: 640, height: 360, frameRate: 24 });
  const sourceAudio = new MockMediaStreamTrack('audio');
  const sourceStream = new MockMediaStream([ sourceVideo, sourceAudio ]);

  session._sessionMediaStreamComposerOptions = session._mediaPipeline.resolveMediaStreamComposerOptions({
    mediaStreamComposer : {
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
    session._sessionMediaStreamComposerOptions
  );

  assert.strictEqual(MockMixer.instances.length, 1);
  assert.strictEqual(MockMixer.instances[0].options.sources[0].aiVirtualBackground.imageUrl, 'https://example.com/bg-a.png');
  assert.strictEqual(session.getAiVirtualBackground().imageUrl, 'https://example.com/bg-a.png');
  assert.strictEqual(stream.getVideoTracks()[0], MockMixer.instances[0].outputTrack);
  assert.strictEqual(stream.getAudioTracks()[0], sourceAudio);
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
  session._sessionMediaStreamComposerOptions = session._mediaPipeline.resolveMediaStreamComposerOptions({
    mediaStreamComposer : {
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

async function testCloseStopsSessionComposerWithAiVirtualBackground()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceVideo = new MockMediaStreamTrack('video');
  const sourceAudio = new MockMediaStreamTrack('audio');
  const sourceStream = new MockMediaStream([ sourceVideo, sourceAudio ]);

  await session._mediaPipeline.applyMediaStreamComposerOnSdkGumStream(sourceStream, {
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

async function testUpgradeToVideoAcceptsComposerSourceAiVirtualBackgroundOptions()
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
    mediaStreamComposer : {
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

  assert.strictEqual(session._sessionMediaStreamComposerOptions.sources[0].aiVirtualBackground.mode, 'color');
  assert.strictEqual(MockMixer.instances.length, 1);
  assert.strictEqual(MockMixer.instances[0].options.sources[0].aiVirtualBackground.color, '#abcdef');
  assert.strictEqual(senderState.replaced, MockMixer.instances[0].outputTrack);
}

function testResolveMediaStreamComposerOptionsUsesSourcesOnly()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const resolved = session._mediaPipeline.resolveMediaStreamComposerOptions({
    mediaStreamComposer : {
      mirror  : true,
      sources : [
        {
          sourceMirror        : true,
          aiVirtualBackground : {
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
  assert.strictEqual(resolved.sources[0].aiVirtualBackground.blurRadius, 12);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(resolved, 'sourceOptions'), false);
}

async function testUpdateMediaStreamComposerUpdatesConfigPatch()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('video'), new MockMediaStreamTrack('audio') ]);

  await session._mediaPipeline.applyMediaStreamComposerOnSdkGumStream(sourceStream, {
    mirror     : false,
    watermarks : []
  });

  const state = await session.updateMediaStreamComposer({
    mirror                     : true,
    mirrorWatermarksWithOutput : false,
    watermarks                 : [
      { id: 'wm1', target: 'output', type: 'text', text: 'live' }
    ]
  });

  assert.strictEqual(state.config.outputMirror, true);
  assert.strictEqual(state.config.mirrorWatermarksWithOutput, false);
  assert.strictEqual(state.config.watermarks.length, 1);
  assert.strictEqual(state.config.watermarks[0].id, 'wm1');
}

async function testUpdateMediaStreamComposerUpdatesPrimarySourceEffects()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('video'), new MockMediaStreamTrack('audio') ]);

  await session._mediaPipeline.applyMediaStreamComposerOnSdkGumStream(sourceStream, {
    sources : [
      {
        aiVirtualBackground : {
          enabled    : true,
          mode       : 'blur',
          blurRadius : 6
        }
      }
    ]
  });

  const state = await session.updateMediaStreamComposer({
    sources : [
      {
        sourceMirror        : true,
        aiVirtualBackground : {
          enabled : true,
          mode    : 'color',
          color   : '#456789'
        }
      }
    ]
  });

  assert.strictEqual(state.sources[0].aiVirtualBackground.color, '#456789');
  assert.strictEqual(state.sources[0].sourceMirror, true);
  assert.strictEqual(session.getAiVirtualBackground().color, '#456789');
}

async function testUpdateMediaStreamComposerClearsPrimarySourceAiVirtualBackground()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('video'), new MockMediaStreamTrack('audio') ]);

  await session._mediaPipeline.applyMediaStreamComposerOnSdkGumStream(sourceStream, {
    mirror  : true,
    sources : [
      {
        aiVirtualBackground : {
          enabled    : true,
          mode       : 'blur',
          blurRadius : 6
        }
      }
    ]
  });

  const state = await session.updateMediaStreamComposer({
    mirror     : false,
    watermarks : [
      { id: 'wm-clear-aivb', target: 'output', type: 'text', text: 'live' }
    ],
    sources : [
      {
        aiVirtualBackground : null
      }
    ]
  });

  assert.strictEqual(state.config.outputMirror, false);
  assert.strictEqual(state.config.watermarks.length, 1);
  assert.strictEqual(state.sources[0].aiVirtualBackground, null);
  assert.strictEqual(session.getAiVirtualBackground(), null);
}

async function testUpdateMediaStreamComposerCreatesComposerForCurrentVideoTrack()
{
  const session = new (require('../lib/RTCSession'))(createMockUA());
  const localAudioTrack = new MockMediaStreamTrack('audio');
  const localVideoTrack = new MockMediaStreamTrack('video', { width: 640, height: 480, frameRate: 15 });
  const sender = {
    track        : localVideoTrack,
    replaceTrack : async function(track)
    {
      this.replaced = track;
      this.track = track;
    }
  };

  session._connection = {
    getSenders : () => [ sender ]
  };
  session._localMediaStream = new MockMediaStream([ localAudioTrack, localVideoTrack ]);

  const state = await session.updateMediaStreamComposer({
    mirror  : true,
    sources : [
      {
        aiVirtualBackground : {
          enabled    : true,
          mode       : 'blur',
          blurRadius : 8
        }
      }
    ]
  });

  assert.strictEqual(MockMixer.instances.length, 1);
  assert.strictEqual(MockMixer.instances[0].options.mirror, true);
  assert.strictEqual(MockMixer.instances[0].options.sources[0].aiVirtualBackground.blurRadius, 8);
  assert.strictEqual(sender.replaced, MockMixer.instances[0].outputTrack);
  assert.strictEqual(session._localMediaStream.getVideoTracks()[0], MockMixer.instances[0].outputTrack);
  assert.strictEqual(state.config.outputMirror, true);
  assert.strictEqual(state.sources[0].aiVirtualBackground.blurRadius, 8);
}

async function testUpdateMediaStreamComposerKeepsComposerWhenMainWebGL2SupportsAiVB()
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

  await session._mediaPipeline.applyMediaStreamComposerOnSdkGumStream(sourceStream, {
    mirror : true
  });

  const firstComposer = session.getMediaStreamComposer();

  firstComposer.renderInfo = {
    actualMode : 'main-webgl2',
    isWorker   : false
  };

  const state = await session.updateMediaStreamComposer({
    mirror  : true,
    sources : [
      {
        aiVirtualBackground : {
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
  assert.strictEqual(firstComposer.getSourceAiVirtualBackground(0).blurRadius, 10);
  assert.strictEqual(sender.replaced, undefined);
  assert.strictEqual(session._localMediaStream.getVideoTracks()[0], outputVideoTrack);
  assert.strictEqual(state.sources[0].aiVirtualBackground.blurRadius, 10);
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
    { name: 'testSwitchDeviceCameraDefaultPathAppliesSessionMixer', fn: testSwitchDeviceCameraDefaultPathAppliesSessionMixer },
    { name: 'testSwitchDeviceCameraWithActiveMixerReusesMixer', fn: testSwitchDeviceCameraWithActiveMixerReusesMixer },
    { name: 'testSwitchDeviceCameraMixerBranchStopsOldInputBeforeGum', fn: testSwitchDeviceCameraMixerBranchStopsOldInputBeforeGum },
    { name: 'testSwitchDeviceCameraMixerBranchFallbackToDefault', fn: testSwitchDeviceCameraMixerBranchFallbackToDefault },
    { name: 'testReplaceCanvasToVideoAppliesSessionMixerToSdkGum', fn: testReplaceCanvasToVideoAppliesSessionMixerToSdkGum },
    { name: 'testGetUserMediaPipelineAppliesSessionAiNoiseSuppression', fn: testGetUserMediaPipelineAppliesSessionAiNoiseSuppression },
    { name: 'testGetUserMediaPipelineAppliesSessionAiVirtualBackground', fn: testGetUserMediaPipelineAppliesSessionAiVirtualBackground },
    { name: 'testGetUserMediaPipelineAcceptsComposerSourcesArray', fn: testGetUserMediaPipelineAcceptsComposerSourcesArray },
    { name: 'testSessionAiNoiseSuppressionDisablesNativeNoiseSuppression', fn: testSessionAiNoiseSuppressionDisablesNativeNoiseSuppression },
    { name: 'testApplyAiNoiseSuppressionSkipsDisabledOptions', fn: testApplyAiNoiseSuppressionSkipsDisabledOptions },
    { name: 'testSwitchDeviceAudioReusesSessionAiNoiseSuppressionEngine', fn: testSwitchDeviceAudioReusesSessionAiNoiseSuppressionEngine },
    { name: 'testSwitchDeviceCameraAppliesSessionAiVirtualBackground', fn: testSwitchDeviceCameraAppliesSessionAiVirtualBackground },
    { name: 'testGetAiNoiseSuppressionReturnsNullByDefault', fn: testGetAiNoiseSuppressionReturnsNullByDefault },
    { name: 'testGetAiVirtualBackgroundReturnsNullByDefault', fn: testGetAiVirtualBackgroundReturnsNullByDefault },
    { name: 'testCloseDestroysSessionAiNoiseSuppression', fn: testCloseDestroysSessionAiNoiseSuppression },
    { name: 'testCloseStopsSessionComposerWithAiVirtualBackground', fn: testCloseStopsSessionComposerWithAiVirtualBackground },
    { name: 'testUpgradeToVideoAcceptsComposerSourceAiVirtualBackgroundOptions', fn: testUpgradeToVideoAcceptsComposerSourceAiVirtualBackgroundOptions },
    { name: 'testResolveMediaStreamComposerOptionsUsesSourcesOnly', fn: testResolveMediaStreamComposerOptionsUsesSourcesOnly },
    { name: 'testUpdateMediaStreamComposerUpdatesConfigPatch', fn: testUpdateMediaStreamComposerUpdatesConfigPatch },
    { name: 'testUpdateMediaStreamComposerUpdatesPrimarySourceEffects', fn: testUpdateMediaStreamComposerUpdatesPrimarySourceEffects },
    { name: 'testUpdateMediaStreamComposerClearsPrimarySourceAiVirtualBackground', fn: testUpdateMediaStreamComposerClearsPrimarySourceAiVirtualBackground },
    { name: 'testUpdateMediaStreamComposerCreatesComposerForCurrentVideoTrack', fn: testUpdateMediaStreamComposerCreatesComposerForCurrentVideoTrack },
    { name: 'testUpdateMediaStreamComposerKeepsComposerWhenMainWebGL2SupportsAiVB', fn: testUpdateMediaStreamComposerKeepsComposerWhenMainWebGL2SupportsAiVB },
    { name: 'testProcessMediaStreamDoesNotApplySessionAiNoiseSuppression', fn: testProcessMediaStreamDoesNotApplySessionAiNoiseSuppression }
  ];

  try
  {
    MockMixer.instances = [];
    MockMixer.stopCalls = 0;
    MockMixer.removeCalls = [];
    MockMixer.appendCalls = [];
    MockMixer.appendOptionCalls = [];
    MockMixer.throwOnRemove = false;
    MockMixer.throwOnAppend = false;
    MockAiNSEngine.instances = [];
    MockAiNSEngine.destroyCalls = 0;
    MockAiNSEngine.transform = null;
    MockAiNSEngine.replaceAudioTrackTransform = null;

    for (const t of TESTS)
    {
      MockMixer.instances = [];
      MockMixer.stopCalls = 0;
      MockMixer.removeCalls = [];
      MockMixer.appendCalls = [];
      MockMixer.appendOptionCalls = [];
      MockAiNSEngine.instances = [];
      MockAiNSEngine.destroyCalls = 0;
      MockAiNSEngine.transform = null;
      MockAiNSEngine.replaceAudioTrackTransform = null;
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
