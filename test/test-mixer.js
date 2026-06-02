/* eslint-disable no-console */
const assert = require('assert');
const Mixer = require('../lib/Mixer');
const MixerConfig = require('../lib/MixerCore/MixerConfig');
const WatermarkManager = require('../lib/MixerCore/WatermarkManager');
const WorkerRenderer = require('../lib/MixerRenderer/WorkerRenderer');
const vm = require('vm');

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

  clone()
  {
    const cloned = new MockMediaStreamTrack(this.kind);

    return cloned;
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
    this.font = '';
    this.textBaseline = '';
    this.textAlign = '';
    this.globalAlpha = 1;
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

  save()
  {
    this.operations.push({ type: 'save' });
  }

  restore()
  {
    this.operations.push({ type: 'restore' });
  }

  translate(x, y)
  {
    this.operations.push({ type: 'translate', x, y });
  }

  scale(x, y)
  {
    this.operations.push({ type: 'scale', x, y });
  }

  drawImage(...args)
  {
    this.operations.push({
      type        : 'drawImage',
      globalAlpha : this.globalAlpha,
      args        : args
    });
  }

  fillText(text, x, y)
  {
    this.operations.push({ type: 'fillText', text, x, y });
  }

  measureText(text)
  {
    return { width: String(text).length * 12 };
  }
}

class MockWebGL2Context
{
  constructor()
  {
    this.VERTEX_SHADER = 0x8B31;
    this.FRAGMENT_SHADER = 0x8B30;
    this.COMPILE_STATUS = 0x8B81;
    this.LINK_STATUS = 0x8B82;
    this.ARRAY_BUFFER = 0x8892;
    this.STATIC_DRAW = 0x88E4;
    this.TEXTURE_2D = 0x0DE1;
    this.TEXTURE_WRAP_S = 0x2802;
    this.TEXTURE_WRAP_T = 0x2803;
    this.CLAMP_TO_EDGE = 0x812F;
    this.TEXTURE_MIN_FILTER = 0x2801;
    this.TEXTURE_MAG_FILTER = 0x2800;
    this.LINEAR = 0x2601;
    this.TEXTURE0 = 0x84C0;
    this.COLOR_BUFFER_BIT = 0x4000;
    this.BLEND = 0x0BE2;
    this.SRC_ALPHA = 0x0302;
    this.ONE_MINUS_SRC_ALPHA = 0x0303;
    this.UNPACK_FLIP_Y_WEBGL = 0x9240;
    this.RGBA = 0x1908;
    this.UNSIGNED_BYTE = 0x1401;
    this.TRIANGLE_STRIP = 0x0005;
    this.FLOAT = 0x1406;
    this.uniform1fCalls = [];
  }

  createShader(type) { return { type }; }
  shaderSource() {}
  compileShader() {}
  getShaderParameter() { return true; }
  getShaderInfoLog() { return ''; }
  deleteShader() {}
  createProgram() { return {}; }
  attachShader() {}
  linkProgram() {}
  getProgramParameter() { return true; }
  getProgramInfoLog() { return ''; }
  deleteProgram() {}
  createBuffer() { return {}; }
  bindBuffer() {}
  bufferData() {}
  useProgram() {}
  getAttribLocation() { return 0; }
  enableVertexAttribArray() {}
  vertexAttribPointer() {}
  getUniformLocation(program, name) { return { program, name }; }
  uniform1i() {}
  uniform1f(location, value)
  {
    this.uniform1fCalls.push({
      location : location && location.name ? location.name : location,
      value    : value
    });
  }
  createTexture() { return {}; }
  bindTexture() {}
  texParameteri() {}
  clearColor() {}
  clear() {}
  activeTexture() {}
  disable() {}
  enable() {}
  blendFunc() {}
  pixelStorei() {}
  texImage2D() {}
  viewport() {}
  drawArrays() {}
  flush() {}
  deleteTexture() {}
  deleteBuffer() {}
  getExtension() { return { loseContext: function() {} }; }
}

class MockCanvasElement
{
  constructor()
  {
    this.width = 0;
    this.height = 0;
    this.stream = null;
    this._context2d = new MockCanvas2DContext();
    this._contextWebGL2 = null;
    MockCanvasElement.instances.push(this);
  }

  setAttribute() {}

  getContext(type)
  {
    if (type === '2d')
    {
      return this._context2d;
    }

    if (type === 'webgl2' && MockCanvasElement.webgl2Supported)
    {
      this._contextWebGL2 = this._contextWebGL2 || new MockWebGL2Context();

      return this._contextWebGL2;
    }

    return null;
  }

  captureStream(fps)
  {
    const track = new MockMediaStreamTrack('video');

    if (fps === 0 && MockCanvasElement.captureTrackHasRequestFrame)
    {
      track.requestFrameCount = 0;
      track.requestFrame = function()
      {
        track.requestFrameCount += 1;
      };
    }

    const stream = new MockMediaStream([ track ]);

    stream.fps = fps || null;

    return stream;
  }
}

MockCanvasElement.instances = [];
MockCanvasElement.webgl2Supported = false;
MockCanvasElement.captureTrackHasRequestFrame = false;

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

    if (node && node.inputs)
    {
      node.inputs.push(this);
    }
  }

  disconnect()
  {
    this.connections.forEach((node) =>
    {
      if (node && node.inputs)
      {
        node.inputs = node.inputs.filter((item) => item !== this);
      }
    });
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

class MockDynamicsCompressorNode extends MockAudioNode
{
  constructor()
  {
    super();

    this.inputs = [];
    this.threshold = { value: -24 };
    this.knee = { value: 30 };
    this.ratio = { value: 12 };
    this.attack = { value: 0.003 };
    this.release = { value: 0.25 };
  }
}

class MockAudioDestination extends MockAudioNode
{
  constructor()
  {
    super();

    this.stream = new MockMediaStream([ new MockMediaStreamTrack('audio') ]);
    this.inputs = [];
  }
}

class MockAudioContext
{
  constructor(options)
  {
    this.state = 'running';
    this.closed = false;
    this.sources = [];
    this.destinations = [];
    this.options = options || {};
    this.sampleRate = this.options.sampleRate || 44100;
    MockAudioContext.instances.push(this);
  }

  resume()
  {
    this.state = 'running';

    return Promise.resolve();
  }

  createMediaStreamDestination()
  {
    const destination = new MockAudioDestination();

    this.destination = destination;
    this.destinations.push(destination);

    return destination;
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

  createDynamicsCompressor()
  {
    return new MockDynamicsCompressorNode();
  }

  close()
  {
    this.closed = true;
    this.state = 'closed';

    return Promise.resolve();
  }

}

MockAudioContext.instances = [];

class MockWorker
{
  constructor(url)
  {
    this.url = url;
    this.script = MockWorker.scripts[url] || '';
    this.messages = [];
    this.terminated = false;
    this.onmessage = null;
    this.onerror = null;
    MockWorker.instances.push(this);
  }

  postMessage(message)
  {
    this.messages.push(message);
  }

  terminate()
  {
    this.terminated = true;
  }
}

MockWorker.instances = [];
MockWorker.scripts = {};

class MockOffscreenCanvas
{
  constructor(width, height)
  {
    this.width = width;
    this.height = height;
  }

  getContext()
  {
    return null;
  }
}

class MockVideoFrame
{
  constructor(source, options)
  {
    this.source = source;
    this.timestamp = options && options.timestamp;
    this.closed = false;
  }

  close()
  {
    this.closed = true;
  }
}

class MockTrackGeneratorWriter
{
  constructor()
  {
    this.writes = [];
    this.closed = false;
  }

  write(frame)
  {
    this.writes.push(frame);

    return Promise.resolve();
  }

  close()
  {
    this.closed = true;

    return Promise.resolve();
  }

  releaseLock()
  {}
}

class MockVideoTrackGenerator
{
  constructor()
  {
    this.track = new MockMediaStreamTrack('video');
    this._writer = new MockTrackGeneratorWriter();
    this.writable = {
      getWriter : () => this._writer
    };
    MockVideoTrackGenerator.instances.push(this);
  }
}

MockVideoTrackGenerator.instances = [];

function installBrowserMocks()
{
  const snapshots = {
    MediaStream               : saveGlobal('MediaStream'),
    HTMLMediaElement          : saveGlobal('HTMLMediaElement'),
    Worker                    : saveGlobal('Worker'),
    OffscreenCanvas           : saveGlobal('OffscreenCanvas'),
    URL                       : saveGlobal('URL'),
    Blob                      : saveGlobal('Blob'),
    window                    : saveGlobal('window'),
    document                  : saveGlobal('document'),
    performance               : saveGlobal('performance'),
    VideoFrame                : saveGlobal('VideoFrame'),
    createImageBitmap         : saveGlobal('createImageBitmap'),
    VideoTrackGenerator       : saveGlobal('VideoTrackGenerator'),
    MediaStreamTrackGenerator : saveGlobal('MediaStreamTrackGenerator')
  };

  resetMockState();

  global.MediaStream = MockMediaStream;
  global.HTMLMediaElement = MockHTMLMediaElement;
  global.Worker = MockWorker;
  global.OffscreenCanvas = MockOffscreenCanvas;
  global.URL = {
    createObjectURL : function(blob)
    {
      const url = `blob:mock-worker-${Object.keys(MockWorker.scripts).length + 1}`;

      MockWorker.scripts[url] = blob && blob.parts ? blob.parts.join('') : '';

      return url;
    },
    revokeObjectURL : function() {}
  };
  global.Blob = function(parts)
  {
    this.parts = parts || [];
  };
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
  delete global.VideoFrame;
  delete global.createImageBitmap;
  delete global.VideoTrackGenerator;
  delete global.MediaStreamTrackGenerator;

  return function()
  {
    restoreGlobal('MediaStream', snapshots.MediaStream);
    restoreGlobal('HTMLMediaElement', snapshots.HTMLMediaElement);
    restoreGlobal('Worker', snapshots.Worker);
    restoreGlobal('OffscreenCanvas', snapshots.OffscreenCanvas);
    restoreGlobal('URL', snapshots.URL);
    restoreGlobal('Blob', snapshots.Blob);
    restoreGlobal('window', snapshots.window);
    restoreGlobal('document', snapshots.document);
    restoreGlobal('performance', snapshots.performance);
    restoreGlobal('VideoFrame', snapshots.VideoFrame);
    restoreGlobal('createImageBitmap', snapshots.createImageBitmap);
    restoreGlobal('VideoTrackGenerator', snapshots.VideoTrackGenerator);
    restoreGlobal('MediaStreamTrackGenerator', snapshots.MediaStreamTrackGenerator);
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
  MockCanvasElement.instances = [];
  MockCanvasElement.webgl2Supported = false;
  MockCanvasElement.captureTrackHasRequestFrame = false;
  MockWorker.instances = [];
  MockWorker.scripts = {};
  MockVideoTrackGenerator.instances = [];
}

function enableInsertableMocks(options)
{
  options = options || {};
  global.VideoFrame = MockVideoFrame;
  global.window.VideoFrame = MockVideoFrame;
  // eslint-disable-next-line no-shadow
  global.createImageBitmap = function(source, options)
  {
    const bitmap = {
      source  : source,
      options : options,
      closed  : false,
      close   : function()
      { 
        bitmap.closed = true;
      }
    };

    return Promise.resolve(bitmap);
  };
  global.window.createImageBitmap = global.createImageBitmap;

  if (options.useLegacyGenerator)
  {
    global.MediaStreamTrackGenerator = class MockMediaStreamTrackGenerator
    {
      constructor(config)
      {
        this.kind = (config && config.kind) || 'video';
        this.track = new MockMediaStreamTrack('video');
        this._writer = new MockTrackGeneratorWriter();
        this.writable = { getWriter: () => this._writer };
        MockVideoTrackGenerator.instances.push(this);
      }
    };
    delete global.VideoTrackGenerator;
    delete global.window.VideoTrackGenerator;
    global.window.MediaStreamTrackGenerator = global.MediaStreamTrackGenerator;

    return;
  }

  global.VideoTrackGenerator = MockVideoTrackGenerator;
  global.window.VideoTrackGenerator = MockVideoTrackGenerator;
  delete global.MediaStreamTrackGenerator;
  delete global.window.MediaStreamTrackGenerator;
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

function readWorkerShaderSource(script)
{
  const context = {
    self        : {},
    postMessage : function() {}
  };

  vm.runInNewContext(
    `${script};this.shaderSource={vertexShader:VERTEX_SHADER,fragmentShader:FRAGMENT_SHADER};`,
    context
  );

  return context.shaderSource;
}

async function flushAsync()
{
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
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

async function testSlotAudioStreamsCreateIndependentBuses()
{
  resetMockState();

  const streams = [];
  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

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
  const firstBus = mixer._audioMixer._audioBuses.get('1,2,3');
  const secondBus = mixer._audioMixer._audioBuses.get('1,3,5');

  assert.ok(first);
  assert.ok(second);
  assert.notStrictEqual(second, first);
  assert.strictEqual(firstAgain, first);
  assert.strictEqual(first.getAudioTracks().length, 1);
  assert.strictEqual(first.getVideoTracks().length, 0);
  assert.strictEqual(second.getAudioTracks().length, 1);
  assert.strictEqual(second.getVideoTracks().length, 0);
  assert.strictEqual(context.destinations.length, 2);
  assert.strictEqual(context.destinations[0].stream, first);
  assert.strictEqual(context.destinations[1].stream, second);
  assert.strictEqual(context.destinations[0].inputs.length, 1);
  assert.strictEqual(context.destinations[1].inputs.length, 1);
  assert.strictEqual(context.sources.length, 4);
  assert.strictEqual(context.destinations[0].inputs[0] instanceof MockDynamicsCompressorNode, true);
  assert.strictEqual(firstBus.connections.size, 3);
  assert.strictEqual(secondBus.connections.size, 3);

  mixer.removeStream(streams[2].id);
  const refreshed = await mixer.getAudioStream({ slots: [ 1, 2, 3 ] });

  assert.strictEqual(refreshed, first);
  assert.strictEqual(firstBus.connections.size, 2);
  assert.strictEqual(secondBus.connections.size, 3);
  assert.strictEqual(context.destinations[1].inputs.length, 1);
  assert.strictEqual(await mixer.getAudioStream({ slots: [] }), null);
  assert.strictEqual(await mixer.getAudioStream({ slots: [ -1, 'x' ] }), null);

  const firstBusGain = context.destinations[0].inputs[0];

  mixer.stop();
  assert.strictEqual(firstBusGain.disconnected, true);
  assert.strictEqual(context.destinations[0].inputs.length, 0);
  assert.strictEqual(context.destinations[1].inputs.length, 0);
  assert.strictEqual(context.closed, true);
  assert.strictEqual(context.sampleRate, 48000);
}

async function testDefaultAudioStreamStillMixesAllSources()
{
  resetMockState();

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

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

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

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

async function testSlotAudioStreamIsStableWhenRequestedBeforeSources()
{
  resetMockState();

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
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

  assert.strictEqual(activeOutput, pendingOutput);
  assert.strictEqual(context.destinations[0].inputs.length, 1);
  assert.strictEqual(context.destinations[0].inputs[0].inputs.length, 1);

  mixer.stop();
}

async function testAudioSourceFansOutThroughMasterGain()
{
  resetMockState();

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
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
  assert.strictEqual(source.gainNode.connections[0], mixer._audioMixer._compressorNode);

  const bus = mixer._audioMixer._audioBuses.get('0');
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

  const mixer = new Mixer(video, { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

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

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
  const streamA = createStream({ video: false, audio: true });
  const streamB = createStream({ video: false, audio: true });

  mixer.appendStream(streamA, 0);
  mixer.appendStream(streamB, 1);

  await mixer.getAudioStream();
  await mixer.getAudioStream({ slots: [ 0, 1 ] });

  const sourceA = mixer._sources.find((source) => source.stream === streamA);
  const masterGain = sourceA.masterGainNode;
  const bus = mixer._audioMixer._audioBuses.get('0,1');
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

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  await mixer.getAudioStream({ slots: [ 0, 1 ] });

  mixer.appendStream(createStream({ video: false, audio: true }), 0);
  mixer.appendStream(createStream({ video: false, audio: true }), 1);

  const bus = mixer._audioMixer._audioBuses.get('0,1');

  assert.strictEqual(bus.connections.size, 0);

  await flushAsync();

  assert.strictEqual(bus.connections.size, 2);
  mixer.stop();
}

async function testDestinationTrackHealthRecreatesSilentBusDestination()
{
  resetMockState();

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  mixer.appendStream(createStream({ video: false, audio: true }), 0);

  const output = await mixer.getAudioStream({ slots: [ 0 ] });
  const context = MockAudioContext.instances[0];
  const oldDestination = context.destinations[0];
  const track = output.getAudioTracks()[0];

  track.muted = true;

  const refreshed = await mixer.getAudioStream({ slots: [ 0 ] });

  assert.strictEqual(refreshed, output);
  assert.strictEqual(context.destinations.length, 1);
  assert.strictEqual(oldDestination.disconnected, false);

  mixer.stop();
}

async function testDestinationTrackHealthRecreatesEndedBusDestination()
{
  resetMockState();

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

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

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  for (let slot = 0; slot < 4; slot++)
  {
    mixer.appendStream(createStream({ video: false, audio: true }), slot);
  }

  const first = await mixer.getAudioStream({ slots: [ 0, 1 ], isolated: true });
  const second = await mixer.getAudioStream({ slots: [ 2, 3 ], isolated: true });
  const firstAgain = await mixer.getAudioStream({ slots: [ 1, 0 ], isolated: true });

  assert.ok(first);
  assert.ok(second);
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(firstAgain, first);
  assert.strictEqual(first.getVideoTracks().length, 0);
  assert.strictEqual(second.getVideoTracks().length, 0);
  assert.strictEqual(firstAgain.getVideoTracks().length, 0);
  assert.strictEqual(MockAudioContext.instances.length, 3);

  mixer.stop();
  assert.strictEqual(MockAudioContext.instances[0].closed, true);
  assert.strictEqual(MockAudioContext.instances[1].closed, true);
  assert.strictEqual(MockAudioContext.instances[2].closed, true);
}

async function testReleaseIsolatedSubmixAudioStreamClosesContext()
{
  resetMockState();

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });

  for (let slot = 0; slot < 3; slot++)
  {
    mixer.appendStream(createStream({ video: false, audio: true }), slot);
  }

  const output = await mixer.getAudioStream({ slots: [ 0, 1 ], isolated: true });

  assert.ok(output);
  assert.strictEqual(MockAudioContext.instances.length, 1);
  assert.strictEqual(MockAudioContext.instances[0].closed, false);

  const released = mixer.releaseSubmixAudioStream({ slots: [ 1, 0 ], isolated: true });

  assert.strictEqual(released, true);
  assert.strictEqual(MockAudioContext.instances[0].closed, true);
  assert.strictEqual(mixer.releaseSubmixAudioStream({ slots: [ 0, 1 ], isolated: true }), false);

  mixer.stop();
}

async function testWatermarkConfigAndFiltering()
{
  resetMockState();

  const mixer = new Mixer([], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d',
    watermarks : {
      id       : 'brand',
      type     : 'text',
      text     : 'CRTC',
      position : 'bottom-right'
    }
  });

  await flushAsync();

  let watermarks = mixer.getWatermarks();

  assert.strictEqual(watermarks.length, 1);
  assert.strictEqual(watermarks[0].id, 'brand');
  assert.strictEqual(watermarks[0].target, 'output');
  assert.strictEqual(watermarks[0].status, 'ready');

  await mixer.setWatermarks([
    { id: 'slot0', target: 'source', slot: 0, text: 'Host', position: 'bottom-left' },
    { id: 'slot1', target: 'source', slot: 1, text: 'Guest', position: 'bottom-left' },
    { id: 'global', target: 'output', text: 'Live' }
  ]);

  mixer.clearWatermarks({ slot: 1 });
  watermarks = mixer.getWatermarks();

  assert.deepStrictEqual(watermarks.map((item) => item.id).sort(), [ 'global', 'slot0' ]);
  mixer.clearWatermarks();
  assert.strictEqual(mixer.getWatermarks().length, 0);

  mixer.stop();
  assert.throws(() => mixer.getWatermarks(), /has been stopped/);
  assert.throws(() => mixer.clearWatermarks(), /has been stopped/);
  await assertRejects(() => mixer.setWatermarks([]), /has been stopped/);
}

async function testCanvas2DWatermarkDrawOrder()
{
  resetMockState();

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
  const sourceA = createStream();
  const sourceB = createStream();

  mixer.appendStream(sourceA, 0);
  mixer.appendStream(sourceB, 1);
  await mixer.setWatermarks([
    {
      id              : 'slot0',
      target          : 'source',
      slot            : 0,
      text            : 'Host',
      opacity         : 0.5,
      position        : 'bottom-left',
      backgroundColor : 'rgba(0,0,0,0)'
    },
    {
      id              : 'brand',
      target          : 'output',
      text            : 'CRTC',
      opacity         : 0.75,
      position        : 'top-right',
      backgroundColor : 'rgba(0,0,0,0)'
    }
  ]);

  mixer.getVideoStream();
  mixer._canvas._context2d.operations = [];
  mixer._drawVideosToCanvas(undefined, true);

  const outputContext = mixer._canvas._context2d;
  const drawImages = outputContext.operations.filter((operation) => operation.type === 'drawImage');

  assert.strictEqual(drawImages.length, 4);
  assert.strictEqual(drawImages[0].globalAlpha, 1);
  assert.strictEqual(drawImages[1].globalAlpha, 1);
  assert.strictEqual(drawImages[2].globalAlpha, 0.5);
  assert.strictEqual(drawImages[3].globalAlpha, 0.75);
  assert.strictEqual(outputContext.globalAlpha, 1);

  mixer.stop();
}

async function testMainWebGL2WatermarkOpacity()
{
  resetMockState();
  MockCanvasElement.webgl2Supported = true;

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'main-webgl2' });
  const sourceA = createStream();

  mixer.appendStream(sourceA, 0);
  await mixer.setWatermarks([
    {
      id              : 'slot0',
      target          : 'source',
      slot            : 0,
      text            : 'Host',
      opacity         : 0.5,
      position        : 'bottom-left',
      backgroundColor : 'rgba(0,0,0,0)'
    },
    {
      id              : 'brand',
      target          : 'output',
      text            : 'CRTC',
      opacity         : 0.75,
      position        : 'top-right',
      backgroundColor : 'rgba(0,0,0,0)'
    }
  ]);

  mixer.getVideoStream();
  mixer._drawVideosToCanvas(undefined, true);

  const gl = mixer._canvas._contextWebGL2;
  const opacityCalls = gl.uniform1fCalls
    .filter((call) => call.location === 'u_opacity')
    .map((call) => call.value);

  assert(opacityCalls.includes(1));
  assert(opacityCalls.includes(0.5));
  assert(opacityCalls.includes(0.75));

  mixer.stop();
}

async function testMirrorGlobalAndSlotControls()
{
  resetMockState();

  const mixer = new Mixer([], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d',
    mirrorX    : true
  });

  mixer.appendStream(createStream(), 0);
  mixer.getVideoStream();

  mixer._canvas._context2d.operations = [];
  mixer._drawVideosToCanvas(undefined, true);

  let outputContext = mixer._canvas._context2d;
  let mirroredOps = outputContext.operations.filter((operation) =>
  {
    return operation.type === 'scale' && operation.x === -1 && operation.y === 1;
  });

  assert.strictEqual(mirroredOps.length, 1);
  assert.strictEqual(mixer.getGlobalMirror(), true);

  mixer.setSlotMirror(0, false);
  mixer._canvas._context2d.operations = [];
  mixer._drawVideosToCanvas(undefined, true);
  outputContext = mixer._canvas._context2d;
  mirroredOps = outputContext.operations.filter((operation) =>
  {
    return operation.type === 'scale' && operation.x === -1 && operation.y === 1;
  });
  assert.strictEqual(mirroredOps.length, 0);

  mixer.setSlotMirror(0, true);
  assert.deepStrictEqual(mixer.getSlotMirrors(), { '0': true });

  mixer._canvas._context2d.operations = [];
  mixer._drawVideosToCanvas(undefined, true);
  outputContext = mixer._canvas._context2d;
  mirroredOps = outputContext.operations.filter((operation) =>
  {
    return operation.type === 'scale' && operation.x === -1 && operation.y === 1;
  });
  assert.strictEqual(mirroredOps.length, 1);

  mixer.clearSlotMirror(0);
  assert.deepStrictEqual(mixer.getSlotMirrors(), {});

  mixer.stop();
  assert.throws(() => mixer.setGlobalMirror(true), /has been stopped/);
}

async function testMirrorAutoModeAvoidsWorkerRenderer()
{
  resetMockState();

  const mixer = new Mixer([], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'auto',
    mirrorX    : true
  });

  mixer.appendStream(createStream(), 0);
  mixer.getVideoStream();
  mixer._drawVideosToCanvas(undefined, true);

  const info = mixer.getRenderInfo();

  assert.strictEqual(MockWorker.instances.length, 0);
  assert.strictEqual(info.isWorker, false);
  assert.notStrictEqual(info.actualMode, 'worker-init');

  mixer.stop();
}

async function testEnableMirrorFallsBackFromWorkerToMainThread()
{
  resetMockState();

  const mixer = new Mixer([], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'auto',
    mirrorX    : false
  });

  mixer.appendStream(createStream(), 0);
  mixer.getVideoStream();
  mixer._drawVideosToCanvas(undefined, true);

  assert.strictEqual(MockWorker.instances.length, 1);
  assert.strictEqual(mixer.getRenderInfo().isWorker, true);

  mixer.setGlobalMirror(true);

  const info = mixer.getRenderInfo();

  assert.strictEqual(info.actualMode, 'main-2d');
  assert.strictEqual(info.isWorker, false);
  assert.strictEqual(mixer.getGlobalMirror(), true);

  mixer.stop();
}

async function testOutputMirrorFlipsWholeComposedFrame()
{
  resetMockState();

  const mixer = new Mixer([], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d'
  });

  mixer.appendStream(createStream(), 0);
  mixer.getVideoStream();

  mixer.setOutputMirror(true);
  assert.strictEqual(mixer.getOutputMirror(), true);

  mixer._canvas._context2d.operations = [];
  mixer._drawVideosToCanvas(undefined, true);

  const outputContext = mixer._canvas._context2d;
  const mirroredOps = outputContext.operations.filter((operation) =>
  {
    return operation.type === 'scale' && operation.x === -1 && operation.y === 1;
  });

  assert.strictEqual(mirroredOps.length, 1);

  mixer.stop();
  assert.throws(() => mixer.setOutputMirror(true), /has been stopped/);
}

async function testOutputMirrorCanDisableWatermarkMirroring()
{
  resetMockState();

  const mixer = new Mixer([], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d'
  });
  const sourceA = createStream();

  mixer.appendStream(sourceA, 0);
  await mixer.setWatermarks([
    {
      id              : 'slot0',
      target          : 'source',
      slot            : 0,
      text            : 'HOST',
      opacity         : 0.5,
      position        : 'bottom-left',
      backgroundColor : 'rgba(0,0,0,0)'
    },
    {
      id              : 'brand',
      target          : 'output',
      text            : 'CRTC',
      opacity         : 0.75,
      position        : 'top-right',
      backgroundColor : 'rgba(0,0,0,0)'
    }
  ]);

  mixer.getVideoStream();
  mixer.setOutputMirror(true);
  mixer.setMirrorWatermarksWithOutput(false);
  assert.strictEqual(mixer.getMirrorWatermarksWithOutput(), false);

  mixer._canvas._context2d.operations = [];
  mixer._drawVideosToCanvas(undefined, true);

  const outputContext = mixer._canvas._context2d;
  const drawImages = outputContext.operations.filter((operation) => operation.type === 'drawImage');
  const mirroredDraws = outputContext.operations.filter((operation) =>
  {
    return operation.type === 'scale' && operation.x === -1 && operation.y === 1;
  });
  const slotWatermarkDraw = drawImages[drawImages.length - 2];
  const outputWatermarkDraw = drawImages[drawImages.length - 1];

  assert.ok(slotWatermarkDraw);
  assert.ok(outputWatermarkDraw);
  assert.strictEqual(mirroredDraws.length, 2);

  mixer.stop();
}

async function testEmptyInitialRenderDoesNotCreateRenderer()
{
  resetMockState();

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'auto' });

  assert.strictEqual(mixer.getRenderInfo().actualMode, 'not-started');
  assert.strictEqual(MockWorker.instances.length, 0);

  mixer.stop();
}

async function testWorkerShaderUsesRuntimeNewlines()
{
  resetMockState();

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'auto' });

  mixer.appendStream(createStream(), 0);
  mixer.getVideoStream();
  mixer._drawVideosToCanvas(undefined, true);

  assert.strictEqual(MockWorker.instances.length, 1);

  const script = MockWorker.instances[0].script;
  const shaderSource = readWorkerShaderSource(script);
  const vertexShader = shaderSource.vertexShader;
  const fragmentShader = shaderSource.fragmentShader;

  assert(vertexShader.includes('#version 300 es\nin vec2 a_position'));
  assert(fragmentShader.includes('#version 300 es\nprecision highp float'));
  assert(fragmentShader.includes('uniform float u_opacity;'));
  assert(fragmentShader.includes('color.a * u_opacity'));
  assert(!vertexShader.includes('\\\\n'));
  assert(!fragmentShader.includes('\\\\n'));

  mixer.stop();
}

async function testAutoRendererFallbackPrefersMainWebGL2()
{
  resetMockState();
  MockCanvasElement.webgl2Supported = true;

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'auto' });

  mixer.appendStream(createStream(), 0);
  mixer.getVideoStream();
  mixer._drawVideosToCanvas(undefined, true);

  assert.strictEqual(mixer.getRenderInfo().actualMode, 'worker-init');
  assert.strictEqual(MockWorker.instances.length, 1);

  MockWorker.instances[0].onmessage({
    data : {
      type   : 'failed',
      reason : 'Worker WebGL2 unavailable'
    }
  });

  const info = mixer.getRenderInfo();

  assert.strictEqual(info.requestedMode, 'auto');
  assert.strictEqual(info.actualMode, 'main-webgl2');
  assert.strictEqual(info.isFallback, true);
  assert.strictEqual(info.reason, 'Worker WebGL2 unavailable');

  mixer.stop();
}

async function testAutoRendererFallbackTriesWorker2DBeforeMain2D()
{
  resetMockState();

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'auto' });

  mixer.appendStream(createStream(), 0);
  mixer.getVideoStream();
  mixer._drawVideosToCanvas(undefined, true);

  assert.strictEqual(mixer.getRenderInfo().actualMode, 'worker-init');
  assert.strictEqual(MockWorker.instances.length, 1);

  MockWorker.instances[0].onmessage({
    data : {
      type   : 'failed',
      reason : 'Worker WebGL2 unavailable'
    }
  });

  let info = mixer.getRenderInfo();

  assert.strictEqual(info.requestedMode, 'auto');
  assert.strictEqual(info.actualMode, 'worker-init');
  assert.strictEqual(info.isFallback, true);
  assert.strictEqual(MockWorker.instances.length, 2);

  MockWorker.instances[1].onmessage({
    data : {
      type       : 'ready',
      actualMode : 'worker-2d',
      isWebGL2   : false,
      reason     : ''
    }
  });

  info = mixer.getRenderInfo();

  assert.strictEqual(info.requestedMode, 'auto');
  assert.strictEqual(info.actualMode, 'worker-2d');
  assert.strictEqual(info.isFallback, true);

  mixer.stop();
}

async function testAutoRendererFallbackEndsAtMain2D()
{
  resetMockState();

  const mixer = new Mixer([], { width: 320, height: 180, fps: 15, renderMode: 'auto' });

  mixer.appendStream(createStream(), 0);
  mixer.getVideoStream();
  mixer._drawVideosToCanvas(undefined, true);

  MockWorker.instances[0].onmessage({
    data : {
      type   : 'failed',
      reason : 'Worker WebGL2 unavailable'
    }
  });
  MockWorker.instances[1].onmessage({
    data : {
      type   : 'failed',
      reason : 'Worker Canvas2D unavailable'
    }
  });

  const info = mixer.getRenderInfo();

  assert.strictEqual(info.requestedMode, 'auto');
  assert.strictEqual(info.actualMode, 'main-2d');
  assert.strictEqual(info.isFallback, true);
  assert.strictEqual(info.reason, 'Worker Canvas2D unavailable');

  mixer.stop();
}

async function testWatermarkPresetAndCoordinatePositions()
{
  resetMockState();

  const manager = new WatermarkManager();

  await manager.setWatermarks([
    { id: 'top-center', text: 'AB', position: 'top-center', margin: 10 },
    { id: 'bottom-center', text: 'AB', position: 'bottom-center', margin: 10 },
    { id: 'coordinate', text: 'AB', position: { x: 7, y: 11 } }
  ]);

  const items = manager.createRenderItems({ width: 320, height: 180, items: [] }).outputWatermarks;
  const byId = items.reduce((map, item) =>
  {
    map[item.id] = item;

    return map;
  }, {});

  assert.strictEqual(byId['top-center'].draw.x, 145);
  assert.strictEqual(byId['top-center'].draw.y, 10);
  assert.strictEqual(byId['bottom-center'].draw.x, 145);
  assert.strictEqual(byId['bottom-center'].draw.y, 134);
  assert.deepStrictEqual(byId.coordinate.draw, { x: 7, y: 11, width: 30, height: 36 });
}

async function testWorkerRendererCarriesWatermarkPayload()
{
  const renderer = new WorkerRenderer({ backgroundColor: '#000', maxFrameQueue: 1 }, {});
  const messages = [];
  const closed = [];
  const sourceFrame = { close: () => closed.push('source') };
  const watermarkFrame = { close: () => closed.push('watermark') };

  renderer._worker = {
    postMessage : function(message, transfers)
    {
      messages.push({ message, transfers });
    }
  };
  renderer._workerReady = true;
  renderer._createFrame = function()
  {
    return Promise.resolve(sourceFrame);
  };
  renderer._createWatermarkFrame = function()
  {
    return Promise.resolve(watermarkFrame);
  };

  await renderer._renderInWorker({
    width           : 320,
    height          : 180,
    backgroundColor : '#123456',
    items           : [
      { id: 'source-1', video: { readyState: 2 }, draw: { x: 0, y: 0, width: 100, height: 80 } }
    ],
    sourceWatermarks : [
      { id: 'wm-1', image: { width: 40, height: 20 }, opacity: 0.5, draw: { x: 4, y: 5, width: 40, height: 20 } }
    ],
    outputWatermarks : []
  });

  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0].message.type, 'render');
  assert.strictEqual(messages[0].message.payload.items.length, 1);
  assert.strictEqual(messages[0].message.payload.sourceWatermarks.length, 1);
  assert.strictEqual(messages[0].transfers.length, 2);
  renderer._closeTransferFrames(messages[0].message.payload.items);
  renderer._closeTransferFrames(messages[0].message.payload.sourceWatermarks);
  assert.deepStrictEqual(closed, [ 'source', 'watermark' ]);
}

async function testWorkerWatermarkFrameFlipYOnlyForWebGL2()
{
  resetMockState();
  const calls = [];

  global.createImageBitmap = function(source, options)
  {
    calls.push({ source, options });

    return Promise.resolve({
      source,
      options,
      close : function() {}
    });
  };
  global.window.createImageBitmap = global.createImageBitmap;

  const worker2dRenderer = new WorkerRenderer({ backgroundColor: '#000', maxFrameQueue: 1 }, {
    actualMode : 'worker-2d'
  });
  const workerWebglRenderer = new WorkerRenderer({ backgroundColor: '#000', maxFrameQueue: 1 }, {
    actualMode : 'worker-webgl2'
  });
  const image = { width: 10, height: 10 };

  await worker2dRenderer._createWatermarkFrame(image);
  await workerWebglRenderer._createWatermarkFrame(image);

  assert.strictEqual(calls.length, 2);
  assert.strictEqual(calls[0].options, undefined);
  assert.deepStrictEqual(calls[1].options, { imageOrientation: 'flipY' });
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
  const defaultConfig = MixerConfig.create({});
  const customConfig = MixerConfig.create({ width: '640', height: 360, fps: '15' });

  // 默认值：width=1280, height=720, fps=15, renderMode='auto'
  assert.strictEqual(defaultConfig.width, 1280);
  assert.strictEqual(defaultConfig.height, 720);
  assert.strictEqual(defaultConfig.fps, 15);
  assert.strictEqual(defaultConfig.renderMode, 'auto');

  // 自定义值
  assert.strictEqual(customConfig.width, 640);
  assert.strictEqual(customConfig.height, 360);
  assert.strictEqual(customConfig.fps, 15);
  assert.strictEqual(customConfig.renderMode, 'auto');
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
  assert.deepStrictEqual(
    MixerConfig.normalizeSourceOptions({ slot: 1, mirrorX: true }, 0, 0.8),
    { slot: 1, mirrorX: true }
  );
  assert.deepStrictEqual(
    MixerConfig.normalizeSourceOptions({ slot: 1, mirror: false }, 0, 0.8),
    { slot: 1, mirrorX: false }
  );
}

async function testInsertableVideoStreamPreferredWhenSupported()
{
  resetMockState();
  enableInsertableMocks();

  const mixer = new Mixer([ createStream({ audio: true }) ], {
    width            : 320,
    height           : 180,
    fps              : 15,
    renderMode       : 'main-2d',
    enableInsertable : true
  });
  const output = mixer.getVideoStream();
  const generator = MockVideoTrackGenerator.instances[0];

  await flushAsync();
  const writtenFrames = generator && generator._writer ? generator._writer.writes.length : 0;

  assert.ok(generator);
  assert.strictEqual(output.getVideoTracks().length, 1);
  assert.strictEqual(mixer._capturedStreams.length, 0);
  assert.ok(writtenFrames >= 1);

  const info = mixer.getRenderInfo();

  assert.strictEqual(info.outputMode, 'insertable');
  assert.strictEqual(info.insertableActive, true);
  assert.strictEqual(info.insertableEnabledByConfig, true);
  assert.strictEqual(info.insertableSupported, true);
  assert.strictEqual(info.insertableGeneratorType, 'video-track-generator');

  mixer.stop();
}

async function testInsertableFallbacksToCaptureStreamWhenGeneratorUnavailable()
{
  resetMockState();
  global.VideoFrame = MockVideoFrame;
  global.createImageBitmap = function(source)
  {
    return Promise.resolve({
      source,
      close : function() {}
    });
  };
  delete global.VideoTrackGenerator;
  delete global.MediaStreamTrackGenerator;
  delete global.window.VideoTrackGenerator;
  delete global.window.MediaStreamTrackGenerator;

  const mixer = new Mixer([ createStream({ audio: true }) ], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d'
  });
  const output = mixer.getVideoStream();
  const info = mixer.getRenderInfo();

  assert.strictEqual(output.getVideoTracks().length, 1);
  assert.strictEqual(mixer._capturedStreams.length, 1);
  assert.strictEqual(info.outputMode, 'capture-stream');
  assert.strictEqual(info.insertableActive, false);
  assert.strictEqual(info.insertableSupported, false);
  assert.strictEqual(info.captureFrameControlMode, 'auto-capture-fps');

  mixer.stop();
}

async function testCaptureStreamUsesManualRequestFrameWhenSupported()
{
  resetMockState();
  MockCanvasElement.captureTrackHasRequestFrame = true;
  global.VideoFrame = MockVideoFrame;
  global.createImageBitmap = function(source)
  {
    return Promise.resolve({
      source,
      close : function() {}
    });
  };
  delete global.VideoTrackGenerator;
  delete global.MediaStreamTrackGenerator;
  delete global.window.VideoTrackGenerator;
  delete global.window.MediaStreamTrackGenerator;

  const mixer = new Mixer([ createStream({ audio: true }) ], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d'
  });
  const output = mixer.getVideoStream();
  const capturedTrack = output.getVideoTracks()[0];
  const before = capturedTrack.requestFrameCount || 0;

  mixer._drawVideosToCanvas(undefined, true);
  mixer._drawVideosToCanvas(undefined, true);

  const after = capturedTrack.requestFrameCount || 0;
  const info = mixer.getRenderInfo();

  assert.strictEqual(info.outputMode, 'capture-stream');
  assert.strictEqual(info.captureFrameControlMode, 'manual-request-frame');
  assert.ok(after > before);

  mixer.stop();
}

async function testInsertableCanUseLegacyMediaStreamTrackGenerator()
{
  resetMockState();
  enableInsertableMocks({ useLegacyGenerator: true });

  const mixer = new Mixer([ createStream({ audio: true }) ], {
    width            : 320,
    height           : 180,
    fps              : 15,
    renderMode       : 'main-2d',
    enableInsertable : true
  });
  const output = mixer.getVideoStream();

  assert.strictEqual(output.getVideoTracks().length, 1);
  assert.strictEqual(mixer._capturedStreams.length, 0);
  assert.ok(MockVideoTrackGenerator.instances.length >= 1);

  mixer.stop();
}

async function testDisableInsertableForcesCaptureStreamEvenWhenSupported()
{
  resetMockState();
  enableInsertableMocks();

  const mixer = new Mixer([ createStream({ audio: true }) ], {
    width            : 320, 
    height           : 180,
    fps              : 15,
    renderMode       : 'main-2d',
    enableInsertable : false
  });
  const output = mixer.getVideoStream();
  const info = mixer.getRenderInfo();

  assert.strictEqual(output.getVideoTracks().length, 1);
  assert.strictEqual(mixer._capturedStreams.length, 1);
  assert.strictEqual(info.outputMode, 'capture-stream');
  assert.strictEqual(info.insertableActive, false);
  assert.strictEqual(info.insertableEnabledByConfig, false);
  assert.strictEqual(info.insertableSupported, true);

  mixer.stop();
}

async function testDefaultPrefersCaptureStreamEvenWhenInsertableSupported()
{
  resetMockState();
  enableInsertableMocks();

  const mixer = new Mixer([ createStream({ audio: true }) ], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d'
  });
  const output = mixer.getVideoStream();
  const info = mixer.getRenderInfo();

  assert.strictEqual(output.getVideoTracks().length, 1);
  assert.strictEqual(mixer._capturedStreams.length, 1);
  assert.strictEqual(info.outputMode, 'capture-stream');
  assert.strictEqual(info.insertableActive, false);
  assert.strictEqual(info.insertableEnabledByConfig, false);
  assert.strictEqual(info.insertableSupported, true);
  assert.strictEqual(info.activeCaptureSinkAttached, true);
  assert.ok(mixer._outputStreamManager._activeCaptureSinkVideo);
  assert.strictEqual(mixer._outputStreamManager._activeCaptureSinkVideo.srcObject, mixer._capturedStreams[0]);

  mixer.stop();
}

async function testCaptureStreamActiveSinkIsDisposedOnStop()
{
  resetMockState();
  enableInsertableMocks();

  const mixer = new Mixer([ createStream({ audio: true }) ], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d'
  });

  mixer.getVideoStream();
  const sinkVideo = mixer._outputStreamManager._activeCaptureSinkVideo;

  assert.ok(sinkVideo);

  mixer.stop();

  assert.strictEqual(sinkVideo._paused, true);
  assert.strictEqual(sinkVideo._removed, true);
  assert.strictEqual(sinkVideo.srcObject, null);
  assert.strictEqual(mixer._outputStreamManager._activeCaptureSinkVideo, null);
}

async function run()
{
  const restoreBrowserMocks = installBrowserMocks();
  let passed = 0;
  let failed = 0;
  const failures = [];

  const TESTS = [
    { name: 'testNoAudioDoesNotCreateAudioContext', fn: testNoAudioDoesNotCreateAudioContext },
    { name: 'testAppendAudioSourceInjectsAudioTrack', fn: testAppendAudioSourceInjectsAudioTrack },
    { name: 'testRepeatedOutputCallsReuseLiveStream', fn: testRepeatedOutputCallsReuseLiveStream },
    { name: 'testStopRejectsPublicReuse', fn: testStopRejectsPublicReuse },
    { name: 'testExternalVideoSrcObjectReconnectsAudio', fn: testExternalVideoSrcObjectReconnectsAudio },
    { name: 'testSlotAudioStreamsCreateIndependentBuses', fn: testSlotAudioStreamsCreateIndependentBuses },
    { name: 'testDefaultAudioStreamStillMixesAllSources', fn: testDefaultAudioStreamStillMixesAllSources },
    { name: 'testDefaultAndSlotAudioShareSourceNodesWithSeparateGains', fn: testDefaultAndSlotAudioShareSourceNodesWithSeparateGains },
    { name: 'testSlotAudioStreamIsStableWhenRequestedBeforeSources', fn: testSlotAudioStreamIsStableWhenRequestedBeforeSources },
    { name: 'testAudioSourceFansOutThroughMasterGain', fn: testAudioSourceFansOutThroughMasterGain },
    { name: 'testAudioSourceKeepsNodeWhenStreamObjectChangesButTrackIsSame', fn: testAudioSourceKeepsNodeWhenStreamObjectChangesButTrackIsSame },
    { name: 'testBusRefreshMutesRemovedGainWithoutDisconnectingMaster', fn: testBusRefreshMutesRemovedGainWithoutDisconnectingMaster },
    { name: 'testAudioRefreshIsBatchedIntoSingleMicrotask', fn: testAudioRefreshIsBatchedIntoSingleMicrotask },
    { name: 'testDestinationTrackHealthRecreatesSilentBusDestination', fn: testDestinationTrackHealthRecreatesSilentBusDestination },
    { name: 'testDestinationTrackHealthRecreatesEndedBusDestination', fn: testDestinationTrackHealthRecreatesEndedBusDestination },
    { name: 'testIsolatedSlotAudioStreamsCreateIndependentContexts', fn: testIsolatedSlotAudioStreamsCreateIndependentContexts },
    { name: 'testReleaseIsolatedSubmixAudioStreamClosesContext', fn: testReleaseIsolatedSubmixAudioStreamClosesContext },
    { name: 'testWatermarkConfigAndFiltering', fn: testWatermarkConfigAndFiltering },
    { name: 'testCanvas2DWatermarkDrawOrder', fn: testCanvas2DWatermarkDrawOrder },
    { name: 'testMainWebGL2WatermarkOpacity', fn: testMainWebGL2WatermarkOpacity },
    { name: 'testMirrorGlobalAndSlotControls', fn: testMirrorGlobalAndSlotControls },
    { name: 'testMirrorAutoModeAvoidsWorkerRenderer', fn: testMirrorAutoModeAvoidsWorkerRenderer },
    { name: 'testEnableMirrorFallsBackFromWorkerToMainThread', fn: testEnableMirrorFallsBackFromWorkerToMainThread },
    { name: 'testOutputMirrorFlipsWholeComposedFrame', fn: testOutputMirrorFlipsWholeComposedFrame },
    { name: 'testOutputMirrorCanDisableWatermarkMirroring', fn: testOutputMirrorCanDisableWatermarkMirroring },
    { name: 'testEmptyInitialRenderDoesNotCreateRenderer', fn: testEmptyInitialRenderDoesNotCreateRenderer },
    { name: 'testWorkerShaderUsesRuntimeNewlines', fn: testWorkerShaderUsesRuntimeNewlines },
    { name: 'testAutoRendererFallbackPrefersMainWebGL2', fn: testAutoRendererFallbackPrefersMainWebGL2 },
    { name: 'testAutoRendererFallbackTriesWorker2DBeforeMain2D', fn: testAutoRendererFallbackTriesWorker2DBeforeMain2D },
    { name: 'testAutoRendererFallbackEndsAtMain2D', fn: testAutoRendererFallbackEndsAtMain2D },
    { name: 'testWatermarkPresetAndCoordinatePositions', fn: testWatermarkPresetAndCoordinatePositions },
    { name: 'testWorkerRendererCarriesWatermarkPayload', fn: testWorkerRendererCarriesWatermarkPayload },
    { name: 'testWorkerWatermarkFrameFlipYOnlyForWebGL2', fn: testWorkerWatermarkFrameFlipYOnlyForWebGL2 },
    { name: 'testWorkerRendererKeepsEmptyPayload', fn: testWorkerRendererKeepsEmptyPayload },
    { name: 'testMixerConfigDefaults', fn: testMixerConfigDefaults },
    { name: 'testMixerConfigSourceOptions', fn: testMixerConfigSourceOptions },
    { name: 'testDefaultPrefersCaptureStreamEvenWhenInsertableSupported', fn: testDefaultPrefersCaptureStreamEvenWhenInsertableSupported },
    { name: 'testCaptureStreamActiveSinkIsDisposedOnStop', fn: testCaptureStreamActiveSinkIsDisposedOnStop },
    { name: 'testInsertableVideoStreamPreferredWhenSupported', fn: testInsertableVideoStreamPreferredWhenSupported },
    { name: 'testInsertableFallbacksToCaptureStreamWhenGeneratorUnavailable', fn: testInsertableFallbacksToCaptureStreamWhenGeneratorUnavailable },
    { name: 'testCaptureStreamUsesManualRequestFrameWhenSupported', fn: testCaptureStreamUsesManualRequestFrameWhenSupported },
    { name: 'testInsertableCanUseLegacyMediaStreamTrackGenerator', fn: testInsertableCanUseLegacyMediaStreamTrackGenerator },
    { name: 'testDisableInsertableForcesCaptureStreamEvenWhenSupported', fn: testDisableInsertableForcesCaptureStreamEvenWhenSupported }
  ];

  try
  {
    for (const t of TESTS)
    {
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
    restoreBrowserMocks();
  }

  if (failures.length > 0)
  {
    console.log(`\n  Mixer Failures (${failed}):`);
    for (const f of failures)
    {
      console.log(`    ✗ ${f.name}`);
      console.log(`      ${f.error.message}`);
    }
  }
  console.log(`  Mixer Tests: ${passed} passed, ${failed} failed, ${TESTS.length} total`);

  if (failed > 0)
  {
    throw new Error(`${failed} Mixer test(s) failed`);
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
