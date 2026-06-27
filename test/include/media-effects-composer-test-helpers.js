/* eslint-disable no-console */
const assert = require('assert');
const MediaEffectsComposer = require('../../lib/MediaEffectsComposer/MediaEffectsComposer');
const ComposerConfig = require('../../lib/MediaEffectsComposer/ComposerConfig');
const Watermark = require('../../lib/MediaEffectsComposer/Watermark');
const WorkerRenderer = require('../../lib/MediaEffectsComposer/Renderers/WorkerRenderer');
const MainCanvas2DRenderer = require('../../lib/MediaEffectsComposer/Renderers/MainCanvas2DRenderer');
const MainWebGL2Renderer = require('../../lib/MediaEffectsComposer/Renderers/MainWebGL2Renderer');
const workerScript = require('../../lib/MediaEffectsComposer/Renderers/WorkerScript');
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
    this._listeners = {};
  }

  addEventListener(type, handler)
  {
    if (!this._listeners[type])
    {
      this._listeners[type] = [];
    }

    this._listeners[type].push(handler);
  }

  removeEventListener(type, handler)
  {
    if (!this._listeners[type])
    {
      return;
    }

    this._listeners[type] = this._listeners[type].filter((item) => item !== handler);
  }

  dispatchEvent(event)
  {
    const type = event && event.type ? event.type : event;

    (this._listeners[type] || []).slice().forEach((handler) => handler.call(this, event));
  }

  stop()
  {
    this.readyState = 'ended';

    if (this.onended)
    {
      this.onended();
    }

    this.dispatchEvent({ type: 'ended' });
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

  disconnect(node)
  {
    if (node)
    {
      this.connections = this.connections.filter((item) => item !== node);

      if (node.inputs)
      {
        node.inputs = node.inputs.filter((item) => item !== this);
      }

      this.disconnected = this.connections.length === 0;

      return;
    }

    this.connections.forEach((nodea) =>
    {
      if (nodea && nodea.inputs)
      {
        nodea.inputs = nodea.inputs.filter((item) => item !== this);
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

module.exports = {
  assert,
  MediaEffectsComposer,
  ComposerConfig,
  Watermark,
  WorkerRenderer,
  MainCanvas2DRenderer,
  MainWebGL2Renderer,
  workerScript,
  vm,
  MockMediaStreamTrack,
  MockMediaStream,
  MockHTMLMediaElement,
  MockVideoElement,
  MockCanvas2DContext,
  MockWebGL2Context,
  MockCanvasElement,
  MockWorker,
  MockAudioContext,
  MockDynamicsCompressorNode,
  MockVideoFrame,
  MockVideoTrackGenerator,
  MockTrackGeneratorWriter,
  installBrowserMocks,
  saveGlobal,
  restoreGlobal,
  resetMockState,
  enableInsertableMocks,
  createStream,
  readWorkerShaderSource,
  flushAsync,
  assertRejects
};
