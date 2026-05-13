const assert = require('assert');
const Mixer = require('../lib/Mixer');
const MixerConfig = require('../lib/mixer-core/MixerConfig');
const WorkerRenderer = require('../lib/mixer-renderer/WorkerRenderer');

let nextTrackId = 1;
let nextStreamId = 1;
let nextAnimationFrameId = 1;
let animationFrames = {};

class MockMediaStreamTrack
{
  constructor(kind)
  {
    this.kind = kind;
    this.id = `${kind}-${nextTrackId++}`;
    this.enabled = true;
    this.readyState = 'live';
    this.onended = null;
  }

  stop()
  {
    this.readyState = 'ended';

    if (this.onended)
    {
      this.onended();
    }
  }
}

class MockMediaStream
{
  constructor(tracks)
  {
    this.id = `stream-${nextStreamId++}`;
    this._tracks = (tracks || []).slice();
  }

  get active()
  {
    return this._tracks.some((track) => track.readyState === 'live');
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
}

class MockHTMLMediaElement {}

class MockVideoElement extends MockHTMLMediaElement
{
  constructor()
  {
    super();

    this.id = `video-${nextStreamId++}`;
    this.srcObject = null;
    this.muted = false;
    this.autoplay = false;
    this.readyState = 2;
    this.videoWidth = 640;
    this.videoHeight = 360;
    this._removed = false;
    this._paused = false;
  }

  setAttribute() {}

  play()
  {
    return Promise.resolve();
  }

  pause()
  {
    this._paused = true;
  }

  remove()
  {
    this._removed = true;
  }
}

class MockCanvas2DContext
{
  constructor()
  {
    this.fillStyle = '#000';
    this.imageSmoothingEnabled = false;
    this.operations = [];
  }

  fillRect(x, y, width, height)
  {
    this.operations.push({ type: 'fillRect', x, y, width, height });
  }

  clearRect(x, y, width, height)
  {
    this.operations.push({ type: 'clearRect', x, y, width, height });
  }

  drawImage()
  {
    this.operations.push({ type: 'drawImage' });
  }
}

class MockCanvasElement
{
  constructor()
  {
    this.width = 0;
    this.height = 0;
    this.stream = null;
    this._context2d = new MockCanvas2DContext();
  }

  setAttribute() {}

  getContext(type)
  {
    if (type === '2d')
    {
      return this._context2d;
    }

    return null;
  }

  captureStream(fps)
  {
    const stream = new MockMediaStream([ new MockMediaStreamTrack('video') ]);

    stream.fps = fps || null;

    return stream;
  }
}

class MockAudioNode
{
  constructor()
  {
    this.connections = [];
    this.disconnected = false;
  }

  connect(node)
  {
    this.connections.push(node);
  }

  disconnect()
  {
    this.disconnected = true;
    this.connections = [];
  }
}

class MockGainNode extends MockAudioNode
{
  constructor()
  {
    super();

    this.gain = { value: 1 };
  }
}

class MockAudioDestination extends MockAudioNode
{
  constructor()
  {
    super();

    this.stream = new MockMediaStream([ new MockMediaStreamTrack('audio') ]);
  }
}

class MockAudioContext
{
  constructor()
  {
    this.state = 'running';
    this.closed = false;
    this.sources = [];
    MockAudioContext.instances.push(this);
  }

  resume()
  {
    this.state = 'running';

    return Promise.resolve();
  }

  createMediaStreamDestination()
  {
    this.destination = new MockAudioDestination();

    return this.destination;
  }

  createMediaStreamSource(stream)
  {
    const node = new MockAudioNode();

    node.stream = stream;
    this.sources.push(stream);

    return node;
  }

  createGain()
  {
    return new MockGainNode();
  }

  close()
  {
    this.closed = true;

    return Promise.resolve();
  }
}

MockAudioContext.instances = [];

function installBrowserMocks()
{
  const snapshots = {
    MediaStream      : saveGlobal('MediaStream'),
    HTMLMediaElement : saveGlobal('HTMLMediaElement'),
    window           : saveGlobal('window'),
    document         : saveGlobal('document'),
    performance      : saveGlobal('performance')
  };

  resetMockState();

  global.MediaStream = MockMediaStream;
  global.HTMLMediaElement = MockHTMLMediaElement;
  global.window = {
    AudioContext          : MockAudioContext,
    webkitAudioContext    : MockAudioContext,
    requestAnimationFrame : function(callback)
    {
      const id = nextAnimationFrameId++;

      animationFrames[id] = callback;

      return id;
    },
    cancelAnimationFrame : function(id)
    {
      delete animationFrames[id];
    }
  };
  global.document = {
    createElement : function(tagName)
    {
      if (tagName === 'canvas')
      {
        return new MockCanvasElement();
      }

      if (tagName === 'video')
      {
        return new MockVideoElement();
      }

      throw new Error(`Unsupported test element: ${tagName}`);
    }
  };
  global.performance = {
    now : function()
    {
      return Date.now();
    }
  };

  return function()
  {
    restoreGlobal('MediaStream', snapshots.MediaStream);
    restoreGlobal('HTMLMediaElement', snapshots.HTMLMediaElement);
    restoreGlobal('window', snapshots.window);
    restoreGlobal('document', snapshots.document);
    restoreGlobal('performance', snapshots.performance);
    resetMockState();
  };
}

function saveGlobal(name)
{
  return {
    exists : Object.prototype.hasOwnProperty.call(global, name),
    value  : global[name]
  };
}

function restoreGlobal(name, snapshot)
{
  if (snapshot.exists)
  {
    global[name] = snapshot.value;

    return;
  }

  delete global[name];
}

function resetMockState()
{
  nextTrackId = 1;
  nextStreamId = 1;
  nextAnimationFrameId = 1;
  animationFrames = {};
  MockAudioContext.instances = [];
}

function createStream(options)
{
  const tracks = [];

  if (!options || options.video !== false)
  {
    tracks.push(new MockMediaStreamTrack('video'));
  }

  if (options && options.audio)
  {
    tracks.push(new MockMediaStreamTrack('audio'));
  }

  return new MockMediaStream(tracks);
}

async function flushAsync()
{
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function assertRejects(fn, pattern)
{
  let rejected = false;

  try
  {
    await fn();
  }
  catch (error)
  {
    rejected = true;
    assert.ok(pattern.test(error.message), error.message);
  }

  assert.strictEqual(rejected, true);
}

async function testNoAudioDoesNotCreateAudioContext()
{
  resetMockState();

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
  const output = await mixer.getMixedStream();

  assert.strictEqual(output.getAudioTracks().length, 0);
  assert.strictEqual(MockAudioContext.instances.length, 0);
  assert.strictEqual(mixer.getAudioInfo().status, 'no-source');

  mixer.stop();
}

async function testAppendAudioSourceInjectsAudioTrack()
{
  resetMockState();

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
  const output = await mixer.getMixedStream();

  mixer.appendStream(createStream({ audio: true }), 0);
  await flushAsync();

  assert.strictEqual(MockAudioContext.instances.length, 1);
  assert.strictEqual(output.getAudioTracks().length, 1);
  assert.strictEqual(mixer.getAudioInfo().status, 'mixing');

  mixer.stop();
}

async function testRepeatedOutputCallsReuseLiveStream()
{
  resetMockState();

  const mixer = new Mixer([ createStream({ audio: true }) ], {
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

async function testStopRejectsPublicReuse()
{
  resetMockState();

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  await mixer.getMixedStream();
  mixer.stop();

  assert.throws(() => mixer.appendStream(createStream({ audio: true }), 0), /has been stopped/);
  assert.throws(() => mixer.getVideoStream(), /has been stopped/);
  assert.throws(() => mixer.getSources(), /has been stopped/);
  await assertRejects(() => mixer.getMixedStream(), /has been stopped/);
}

async function testExternalVideoSrcObjectReconnectsAudio()
{
  resetMockState();

  const video = new MockVideoElement();
  const firstStream = createStream({ audio: true });
  const secondStream = createStream({ audio: true });

  video.srcObject = firstStream;

  const mixer = new Mixer(video, { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  await mixer.getMixedStream();
  video.srcObject = secondStream;
  mixer._drawVideosToCanvas(undefined, true);
  await flushAsync();

  assert.strictEqual(mixer.getSources()[0].streamId, secondStream.id);
  assert.strictEqual(mixer.getAudioInfo().connectedSources, 1);
  assert.strictEqual(MockAudioContext.instances[0].sources[1], secondStream);

  mixer.stop();
}

async function testWorkerRendererKeepsEmptyPayload()
{
  const renderer = new WorkerRenderer({ backgroundColor: '#000', maxFrameQueue: 1 }, {});
  const messages = [];

  renderer._worker = {
    postMessage : function(message, transfers)
    {
      messages.push({ message, transfers });
    }
  };
  renderer._workerReady = true;

  await renderer._renderInWorker({
    width           : 320,
    height          : 180,
    backgroundColor : '#123456',
    items           : []
  });

  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0].message.type, 'render');
  assert.deepStrictEqual(messages[0].message.payload.items, []);
  assert.strictEqual(messages[0].transfers.length, 0);
}

async function testMixerConfigDefaults()
{
  const legacyConfig = MixerConfig.create({});
  const gridConfig = MixerConfig.create({ width: '640', height: 360, fps: '15' });

  assert.strictEqual(legacyConfig.hasModernOptions, false);
  assert.strictEqual(legacyConfig.layoutMode, 'legacy');
  assert.strictEqual(legacyConfig.config.width, null);
  assert.strictEqual(legacyConfig.config.height, null);
  assert.strictEqual(legacyConfig.config.renderMode, 'main-2d');

  assert.strictEqual(gridConfig.hasModernOptions, true);
  assert.strictEqual(gridConfig.layoutMode, 'grid');
  assert.strictEqual(gridConfig.config.width, 640);
  assert.strictEqual(gridConfig.config.height, 360);
  assert.strictEqual(gridConfig.config.fps, 15);
  assert.strictEqual(gridConfig.config.renderMode, 'auto');
}

async function testMixerConfigSourceOptions()
{
  assert.deepStrictEqual(
    MixerConfig.normalizeSourceOptions(2, 1, 0.8),
    { slot: 3 }
  );
  assert.deepStrictEqual(
    MixerConfig.normalizeSourceOptions({ slot: 0, gain: 0 }, 0, 0.8),
    { slot: 0, gain: 0 }
  );
  assert.deepStrictEqual(
    MixerConfig.normalizeSourceOptions({ slot: -2, gain: -1 }, 2, 0.8),
    { slot: 2, gain: 0.8 }
  );
}

async function run()
{
  const restoreBrowserMocks = installBrowserMocks();

  try
  {
    await testNoAudioDoesNotCreateAudioContext();
    await testAppendAudioSourceInjectsAudioTrack();
    await testRepeatedOutputCallsReuseLiveStream();
    await testStopRejectsPublicReuse();
    await testExternalVideoSrcObjectReconnectsAudio();
    await testWorkerRendererKeepsEmptyPayload();
    await testMixerConfigDefaults();
    await testMixerConfigSourceOptions();
  }
  finally
  {
    restoreBrowserMocks();
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
