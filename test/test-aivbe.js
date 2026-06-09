/* eslint-disable no-console */
const assert = require('assert');
const Config = require('../lib/AiVBE/AiVBEConfig');

let nextAnimationFrameId = 1;
let scheduledFrames = {};
let createdCanvases = [];
let createdImages = [];
let appendedScripts = [];

class MockMediaStreamTrack
{
  constructor(kind)
  {
    this.kind = kind;
    this.readyState = 'live';
  }
}

class MockMediaStream
{
  constructor(tracks)
  {
    this._tracks = (tracks || []).slice();
  }

  getVideoTracks()
  {
    return this._tracks.filter((track) => track.kind === 'video');
  }
}

class Mock2DContext
{
  constructor(canvas)
  {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.filter = 'none';
    this.globalCompositeOperation = 'source-over';
    this.operations = [];
  }

  clearRect()
  {
    this.operations.push({ type: 'clearRect' });
  }

  drawImage()
  {
    this.operations.push({ type: 'drawImage' });
  }

  fillRect()
  {
    this.operations.push({ type: 'fillRect' });
  }

  save()
  {
    this.operations.push({ type: 'save' });
  }

  restore()
  {
    this.operations.push({ type: 'restore' });
  }

  translate()
  {
    this.operations.push({ type: 'translate' });
  }

  scale()
  {
    this.operations.push({ type: 'scale' });
  }

  createImageData(width, height)
  {
    return {
      width,
      height,
      data : new Uint8ClampedArray(width * height * 4)
    };
  }

  putImageData(imageData)
  {
    this.lastImageData = imageData;
  }
}

class MockWebGL2Context
{
  constructor(canvas)
  {
    this.canvas = canvas;
    this.VERTEX_SHADER = 0x8B31;
    this.FRAGMENT_SHADER = 0x8B30;
    this.COMPILE_STATUS = 0x8B81;
    this.LINK_STATUS = 0x8B82;
    this.ARRAY_BUFFER = 0x8892;
    this.STATIC_DRAW = 0x88E4;
    this.FLOAT = 0x1406;
    this.TEXTURE_2D = 0x0DE1;
    this.TEXTURE0 = 0x84C0;
    this.TEXTURE_WRAP_S = 0x2802;
    this.TEXTURE_WRAP_T = 0x2803;
    this.CLAMP_TO_EDGE = 0x812F;
    this.TEXTURE_MIN_FILTER = 0x2801;
    this.TEXTURE_MAG_FILTER = 0x2800;
    this.NEAREST = 0x2600;
    this.LINEAR = 0x2601;
    this.RGBA = 0x1908;
    this.RGBA8 = 0x8058;
    this.UNSIGNED_BYTE = 0x1401;
    this.COLOR_BUFFER_BIT = 0x4000;
    this.TRIANGLE_STRIP = 0x0005;
    this.FRAMEBUFFER = 0x8D40;
    this.COLOR_ATTACHMENT0 = 0x8CE0;
    this.RGBA4 = 0x8056;
    this.lastMirrorValue = null;
  }

  createShader(type) { return { type }; }

  shaderSource() {}

  compileShader() {}

  getShaderParameter() { return true; }

  getShaderInfoLog() { return ''; }

  createProgram() { return {}; }

  attachShader() {}

  linkProgram() {}

  getProgramParameter() { return true; }

  getProgramInfoLog() { return ''; }

  createVertexArray() { return {}; }

  bindVertexArray() {}

  createBuffer() { return {}; }

  bindBuffer() {}

  bufferData() {}

  getAttribLocation() { return 0; }

  enableVertexAttribArray() {}

  vertexAttribPointer() {}

  createTexture() { return {}; }

  bindTexture() {}

  texParameteri() {}

  texStorage2D() {}

  texSubImage2D() {}

  useProgram() {}

  getUniformLocation(program, name) { return { program, name }; }

  uniform1i() {}

  uniform1f(location, value)
  {
    if (location && location.name === 'u_mirror')
    {
      this.lastMirrorValue = value;
    }
  }

  activeTexture() {}

  texImage2D() {}

  viewport() {}

  clearColor() {}

  clear() {}

  drawArrays() {}

  deleteTexture() {}

  deleteBuffer() {}

  deleteShader() {}

  deleteProgram() {}

  deleteVertexArray() {}

  createFramebuffer() { return {}; }

  bindFramebuffer() {}

  framebufferTexture2D() {}

  deleteFramebuffer() {}

  uniform2f() {}
}

class MockCanvas
{
  constructor()
  {
    this.width = 0;
    this.height = 0;
    this._gl = new MockWebGL2Context(this);
    this._ctx2d = new Mock2DContext(this);
    createdCanvases.push(this);
  }

  getContext(type)
  {
    if (type === 'webgl2')
    {
      return this._gl;
    }

    if (type === '2d')
    {
      return this._ctx2d;
    }

    return null;
  }

  captureStream(fps)
  {
    return { fps };
  }

  toDataURL()
  {
    return 'data:image/png;base64,solid-color';
  }
}

class MockVideoElement
{
  constructor()
  {
    this.muted = false;
    this.autoplay = false;
    this.playsInline = false;
    this.srcObject = null;
    this.loadCalled = false;
  }

  async play() {}

  load()
  {
    this.loadCalled = true;
  }
}

class MockImageElement
{
  constructor()
  {
    this.onload = null;
    this.onerror = null;
    this.crossOrigin = null;
    this.complete = false;
    this.naturalWidth = 16;
    this.naturalHeight = 16;
    this._src = '';
    this.autoLoad = MockImageElement.autoLoad;
    createdImages.push(this);
  }

  setAttribute() {}

  removeAttribute() {}

  getAttribute() { return null; }

  addEventListener(type, handler)
  {
    if (type === 'load')
    {
      this.onload = handler;
    }
    else if (type === 'error')
    {
      this.onerror = handler;
    }
  }

  removeEventListener(type, handler)
  {
    if (type === 'load' && this.onload === handler)
    {
      this.onload = null;
    }
    else if (type === 'error' && this.onerror === handler)
    {
      this.onerror = null;
    }
  }

  set src(value)
  {
    this._src = value;
    this.complete = true;
    if (this.autoLoad && this.onload)
    {
      const handler = this.onload;

      this.onload = null;
      handler();
    }
  }

  get src()
  {
    return this._src;
  }

  triggerLoad()
  {
    if (this.onload)
    {
      this.onload();
    }
  }

  triggerError()
  {
    if (this.onerror)
    {
      this.onerror();
    }
  }
}

MockImageElement.autoLoad = true;

function installBrowserMocks()
{
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const previousCancelAnimationFrame = global.cancelAnimationFrame;
  const previousImage = global.Image;
  const previousHTMLCanvasElement = global.HTMLCanvasElement;
  const previousHTMLVideoElement = global.HTMLVideoElement;
  const previousMediaStream = global.MediaStream;
  const previousMediaStreamTrack = global.MediaStreamTrack;
  const previousPerformance = global.performance;
  const previousSetInterval = global.setInterval;
  const previousClearInterval = global.clearInterval;

  global.window = {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance : {
      now()
      {
        return Date.now();
      }
    },
    Worker : class
    {
      terminate()
      {
        this.terminated = true;
      }
    }
  };

  global.document = {
    head : {
      appendChild(node)
      {
        appendedScripts.push(node);

        if (node && typeof node.textContent === 'string' &&
          node.textContent.indexOf('window.CRTCAiVBEVisionTasks') !== -1)
        {
          global.window.CRTCAiVBEVisionTasks = {
            FilesetResolver : {
              async forVisionTasks(baseUrl)
              {
                return { wasmBaseUrl: baseUrl };
              }
            },
            ImageSegmenter : {
              async createFromOptions(vision, options)
              {
                return {
                  vision,
                  options,
                  getLabels()
                  {
                    return [ 'background', 'person' ];
                  },
                  segmentForVideo(videoEl, timestampMs, callback)
                  {
                    callback({
                      categoryMask : {
                        width  : 2,
                        height : 2,
                        getAsUint8Array()
                        {
                          return new Uint8Array([ 1, 0, 1, 0 ]);
                        }
                      }
                    });
                  },
                  async close() {}
                };
              }
            }
          };
        }

        if (typeof node.onload === 'function')
        {
          node.onload();
        }
      }
    },
    createElement(tagName)
    {
      if (tagName === 'canvas')
      {
        return new MockCanvas();
      }
      if (tagName === 'video')
      {
        return new MockVideoElement();
      }
      if (tagName === 'img')
      {
        return new MockImageElement();
      }
      if (tagName === 'script')
      {
        return this.createScriptElement();
      }

      return { tagName };
    },
    createScriptElement()
    {
      const attributes = {};

      return {
        type        : '',
        async       : false,
        textContent : '',
        onload      : null,
        onerror     : null,
        setAttribute(name, value)
        {
          attributes[name] = value;
        },
        removeAttribute(name)
        {
          delete attributes[name];
        },
        getAttribute(name)
        {
          return attributes[name] || null;
        },
        addEventListener(type, handler)
        {
          this[`on${type}`] = handler;
        },
        removeEventListener(type, handler)
        {
          if (this[`on${type}`] === handler)
          {
            this[`on${type}`] = null;
          }
        }
      };
    },
    querySelector()
    {
      return null;
    }
  };

  global.requestAnimationFrame = function(callback)
  {
    const id = nextAnimationFrameId++;

    scheduledFrames[id] = callback;

    return id;
  };

  global.cancelAnimationFrame = function(id)
  {
    delete scheduledFrames[id];
  };

  global.Image = MockImageElement;
  global.HTMLCanvasElement = MockCanvas;
  global.HTMLVideoElement = MockVideoElement;
  global.MediaStream = MockMediaStream;
  global.MediaStreamTrack = MockMediaStreamTrack;
  global.performance = global.window.performance;

  return function restore()
  {
    global.window = previousWindow;
    global.document = previousDocument;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    global.cancelAnimationFrame = previousCancelAnimationFrame;
    global.Image = previousImage;
    global.HTMLCanvasElement = previousHTMLCanvasElement;
    global.HTMLVideoElement = previousHTMLVideoElement;
    global.MediaStream = previousMediaStream;
    global.MediaStreamTrack = previousMediaStreamTrack;
    global.performance = previousPerformance;
    global.setInterval = previousSetInterval;
    global.clearInterval = previousClearInterval;
    nextAnimationFrameId = 1;
    scheduledFrames = {};
    createdCanvases = [];
    createdImages = [];
    appendedScripts = [];
    MockImageElement.autoLoad = true;
  };
}

function installMockSegmenterRuntime()
{
  const runtimePath = require.resolve('../lib/AiVBE/MediaPipeSegmenterRuntime');
  const original = require.cache[runtimePath];

  class MockSegmenterRuntime
  {
    constructor()
    {
      this.initializeCalls = [];
      this.destroyCalls = 0;
      MockSegmenterRuntime.instances.push(this);
    }

    async initialize(options)
    {
      this.initializeCalls.push(options);

      if (MockSegmenterRuntime.failInitialize)
      {
        throw new Error('segmenter init failed');
      }
    }

    async destroy()
    {
      this.destroyCalls += 1;
    }
  }

  MockSegmenterRuntime.instances = [];
  MockSegmenterRuntime.failInitialize = false;

  require.cache[runtimePath] = {
    id       : runtimePath,
    filename : runtimePath,
    loaded   : true,
    exports  : MockSegmenterRuntime
  };

  return {
    MockSegmenterRuntime,
    restore()
    {
      delete require.cache[require.resolve('../lib/AiVBE/index')];
      if (original)
      {
        require.cache[runtimePath] = original;
      }
      else
      {
        delete require.cache[runtimePath];
      }
    }
  };
}

async function testInitFailureDestroysPartiallyCreatedResources()
{
  const { MockSegmenterRuntime, restore } = installMockSegmenterRuntime();
  const AiVBEEngine = require('../lib/AiVBE');
  const engine = new AiVBEEngine();

  MockSegmenterRuntime.failInitialize = true;

  await assert.rejects(
    () => engine.init({ inputStream: new MockMediaStream([ new MockMediaStreamTrack('video') ]) }),
    /segmenter init failed/
  );

  assert.strictEqual(MockSegmenterRuntime.instances[0].destroyCalls, 1);
  assert.strictEqual(engine.canvas, null);
  assert.strictEqual(engine.videoEl, null);
  assert.strictEqual(engine.outputStream, null);
  restore();
}

async function testPublicMethodsRequireInitialization()
{
  const { restore } = installMockSegmenterRuntime();
  const AiVBEEngine = require('../lib/AiVBE');
  const engine = new AiVBEEngine();

  await assert.rejects(() => engine.setBackgroundImage('x'), /not initialized/);
  await assert.rejects(() => engine.setBlurBackground(), /not initialized/);
  await assert.rejects(() => engine.setSolidColor('#00ff00'), /not initialized/);
  assert.throws(() => engine.clearBackground(), /not initialized/);
  restore();
}

async function testClearBackgroundMirrorTracksSetMirror()
{
  const { restore } = installMockSegmenterRuntime();
  const AiVBEEngine = require('../lib/AiVBE');
  const engine = new AiVBEEngine({
    video : { mirror: true }
  });

  await engine.init({
    inputStream : new MockMediaStream([ new MockMediaStreamTrack('video') ])
  });
  engine.clearBackground();

  assert.strictEqual(engine.config.video.mirror, true);
  assert.ok(engine.pipeline);

  engine.setMirror(false);
  assert.strictEqual(engine.config.video.mirror, false);

  await engine.destroy();
  restore();
}

async function testSetSolidColorRebuildsPipelineWhenSwitchingFromBlur()
{
  const { restore } = installMockSegmenterRuntime();
  const AiVBEEngine = require('../lib/AiVBE');
  const engine = new AiVBEEngine();

  await engine.init({
    inputStream : new MockMediaStream([ new MockMediaStreamTrack('video') ])
  });

  let setupCalls = [];
  const originalSetupPipeline = engine.setupPipeline.bind(engine);

  engine.setupPipeline = async function(type, src)
  {
    setupCalls.push({ type, src });

    return originalSetupPipeline(type, src);
  };

  await engine.setSolidColor('#00ff00');
  assert.strictEqual(engine.currentBackgroundKind, 'color');
  await engine.setBlurBackground(12);
  assert.strictEqual(engine.currentBackgroundKind, 'blur');
  setupCalls = [];
  await engine.setSolidColor('#00ff00');

  assert.strictEqual(setupCalls.length, 1);
  assert.strictEqual(setupCalls[0].type, 'color');
  assert.strictEqual(engine.currentBackgroundKind, 'color');

  await engine.destroy();
  restore();
}

async function testDestroyWaitsForActiveRenderBeforeCleaningPipeline()
{
  const { restore } = installMockSegmenterRuntime();
  const AiVBEEngine = require('../lib/AiVBE');
  const engine = new AiVBEEngine();

  await engine.init({
    inputStream : new MockMediaStream([ new MockMediaStreamTrack('video') ])
  });

  let resolveRender;
  let cleaned = false;

  engine.pipeline = {
    render()
    {
      return new Promise((resolve) =>
      {
        resolveRender = resolve;
      });
    },
    cleanUp()
    {
      cleaned = true;
    }
  };

  engine.isRunning = true;

  const loopPromise = engine.loop(1000);

  assert.strictEqual(engine.isRendering, true);

  const destroyPromise = engine.destroy();

  await Promise.resolve();

  assert.strictEqual(cleaned, false);
  resolveRender();
  await destroyPromise;
  await loopPromise;

  assert.strictEqual(cleaned, true);
  assert.strictEqual(engine.pipeline, null);
  restore();
}

async function testPendingBackgroundImageLoadRejectsWhenCancelled()
{
  const { restore } = installMockSegmenterRuntime();
  const AiVBEEngine = require('../lib/AiVBE');
  const engine = new AiVBEEngine();

  await engine.init({
    inputStream : new MockMediaStream([ new MockMediaStreamTrack('video') ])
  });

  createdImages = [];
  MockImageElement.autoLoad = false;
  const loadPromise = engine.setBackgroundImage('first.png');

  assert.strictEqual(createdImages[0]._src, 'first.png');

  engine.clearBackground();

  await assert.rejects(() => loadPromise, /cancelled/);
  assert.strictEqual(engine.currentBackgroundKind, 'none');

  await engine.destroy();
  restore();
}

async function testStaleBackgroundImageLoadCannotOverwriteNewPipeline()
{
  const { restore } = installMockSegmenterRuntime();
  const AiVBEEngine = require('../lib/AiVBE');
  const engine = new AiVBEEngine();

  await engine.init({
    inputStream : new MockMediaStream([ new MockMediaStreamTrack('video') ])
  });

  createdImages = [];
  MockImageElement.autoLoad = false;
  const stalePromise = engine.setBackgroundImage('first.png');
  const staleImage = createdImages[0];

  await engine.setBlurBackground(9);
  staleImage.triggerLoad();

  await assert.rejects(() => stalePromise, /cancelled/);
  assert.strictEqual(engine.currentBackgroundKind, 'blur');

  await engine.destroy();
  restore();
}

async function testSetBackgroundImageTrimsNoneSentinel()
{
  const { restore } = installMockSegmenterRuntime();
  const AiVBEEngine = require('../lib/AiVBE');
  const engine = new AiVBEEngine();

  await engine.init({
    inputStream : new MockMediaStream([ new MockMediaStreamTrack('video') ])
  });
  await engine.setSolidColor('#00ff00');
  await engine.setBackgroundImage(' none ');

  assert.strictEqual(engine.currentBackgroundKind, 'none');

  await engine.destroy();
  restore();
}

async function testSetSolidColorRejectsOutOfRangeRgb()
{
  const { restore } = installMockSegmenterRuntime();
  const AiVBEEngine = require('../lib/AiVBE');
  const engine = new AiVBEEngine();

  await engine.init({
    inputStream : new MockMediaStream([ new MockMediaStreamTrack('video') ])
  });

  await assert.rejects(() => engine.setSolidColor('rgb(999,0,0)'), /Invalid color format/);
  await assert.rejects(() => engine.setSolidColor('rgba(0,0,0,2)'), /Invalid color format/);

  await engine.destroy();
  restore();
}

async function testMirrorAppliesToSegmentationMask()
{
  const { buildCanvas2DPipeline } = require('../lib/AiVBE/Canvas2DPipeline');
  const canvas = new MockCanvas();
  const videoElement = new MockVideoElement();
  const maskCanvas = new MockCanvas();
  const existingCanvases = createdCanvases.slice();
  const segmenterRuntime = {
    async segmentForVideo()
    {
      return {
        segmentationMask : maskCanvas
      };
    }
  };

  canvas.width = 16;
  canvas.height = 16;

  const pipeline = buildCanvas2DPipeline({
    canvas,
    videoElement,
    mode             : 'color',
    mirror           : true,
    segmenterRuntime : segmenterRuntime,
    backgroundColor  : '#000000'
  });

  await pipeline.render();

  const personCanvas = createdCanvases.find((candidate) => existingCanvases.indexOf(candidate) === -1);
  const personScaleOperations = personCanvas._ctx2d.operations.filter((operation) => operation.type === 'scale');
  const personDrawOperations = personCanvas._ctx2d.operations.filter((operation) => operation.type === 'drawImage');

  assert.strictEqual(personScaleOperations.length, 2);
  assert.strictEqual(personDrawOperations.length, 2);
}

async function testInitBuildsPassthroughPipelineByDefault()
{
  const { restore } = installMockSegmenterRuntime();
  const AiVBEEngine = require('../lib/AiVBE');
  const engine = new AiVBEEngine();

  await engine.init({
    inputStream : new MockMediaStream([ new MockMediaStreamTrack('video') ])
  });

  assert.ok(engine.pipeline);
  assert.strictEqual(engine.currentBackgroundKind, 'none');

  await engine.destroy();
  restore();
}

async function testRuntimeClosesSegmentationResultAfterMaskCopy()
{
  delete require.cache[require.resolve('../lib/AiVBE/MediaPipeSegmenterRuntime')];
  const Runtime = require('../lib/AiVBE/MediaPipeSegmenterRuntime');
  const runtime = new Runtime();
  let closeCalls = 0;
  const mask = {
    width  : 2,
    height : 1,
    getAsFloat32Array()
    {
      return new Float32Array([ 0, 1 ]);
    }
  };

  runtime.initialized = true;
  runtime.segmenter = {
    segmentForVideo(videoElement, timestampMs, callback)
    {
      callback({
        confidenceMasks : [ mask ],
        close()
        {
          closeCalls += 1;
        }
      });
    }
  };

  const result = await runtime.segmentForVideo({});

  assert.ok(result.segmentationMask);
  assert.strictEqual(closeCalls, 1);

  await runtime.destroy();
}

async function testRuntimeRejectsMissingMask()
{
  delete require.cache[require.resolve('../lib/AiVBE/MediaPipeSegmenterRuntime')];
  const Runtime = require('../lib/AiVBE/MediaPipeSegmenterRuntime');
  const runtime = new Runtime();

  assert.throws(() => runtime.readMaskValues(), /mask is required/);
}

async function testRuntimeProcessesLatestQueuedFrame()
{
  delete require.cache[require.resolve('../lib/AiVBE/MediaPipeSegmenterRuntime')];
  const Runtime = require('../lib/AiVBE/MediaPipeSegmenterRuntime');
  const runtime = new Runtime();
  const callbacks = [];
  const calls = [];

  runtime.initialized = true;
  runtime.segmenter = {
    segmentForVideo(videoElement, timestampMs, callback)
    {
      calls.push(videoElement.id);
      callbacks.push(callback);
    }
  };

  const firstPromise = runtime.segmentForVideo({ id: 'first' });
  const secondPromise = runtime.segmentForVideo({ id: 'second' });

  assert.deepStrictEqual(calls, [ 'first' ]);

  callbacks[0]({
    confidenceMasks : [ {
      width  : 1,
      height : 1,
      getAsFloat32Array()
      {
        return new Float32Array([ 0.25 ]);
      }
    } ]
  });
  await firstPromise;

  assert.deepStrictEqual(calls, [ 'first', 'second' ]);

  callbacks[1]({
    confidenceMasks : [ {
      width  : 1,
      height : 1,
      getAsFloat32Array()
      {
        return new Float32Array([ 0.75 ]);
      }
    } ]
  });

  const secondResult = await secondPromise;

  assert.ok(secondResult.segmentationMask);

  await runtime.destroy();
}

async function testAssetLoaderSharesConcurrentRuntimeLoad()
{
  const AssetLoader = require('../lib/AiVBE/AiVBEAssetLoader');
  const loaderA = new AssetLoader({ moduleUrl: './tasks/vision_bundle.mjs' });
  const loaderB = new AssetLoader({ moduleUrl: './tasks/vision_bundle.mjs' });

  delete global.window.CRTCAiVBEVisionTasks;
  appendedScripts = [];
  global.document.querySelector = () => null;

  const results = await Promise.all([
    loaderA.ensureTasksLoaded(),
    loaderB.ensureTasksLoaded()
  ]);

  assert.strictEqual(results[0], global.window.CRTCAiVBEVisionTasks);
  assert.strictEqual(results[1], global.window.CRTCAiVBEVisionTasks);
  assert.strictEqual(appendedScripts.length, 1);
}

async function testConfigNormalizesTasksAssetBaseUrlAndSegmentationOptions()
{
  const config = Config.create({
    segmentation : {
      delegate : 'cpu'
    },
    assetConfig : {
      baseUrl  : './assets/tasks/',
      modelUrl : './assets/tasks/selfie_segmenter_landscape.tflite'
    }
  });

  assert.strictEqual(config.segmentation.delegate, 'CPU');
  assert.deepStrictEqual(config.segmentation, { delegate: 'CPU' });
  assert.strictEqual(config.assetConfig.moduleUrl, './assets/tasks/vision_bundle.mjs');
  assert.strictEqual(config.assetConfig.wasmBaseUrl, './assets/tasks/wasm');
  assert.strictEqual(config.assetConfig.modelUrl, './assets/tasks/selfie_segmenter_landscape.tflite');
}

async function testConfigNormalizesFlatAivbAssetBaseUrl()
{
  const config = Config.create({
    assetConfig : {
      flatBaseUrl : './assets/aivb/'
    }
  });

  assert.strictEqual(config.assetConfig.moduleUrl, './assets/aivb/vision.js');
  assert.strictEqual(config.assetConfig.wasmBaseUrl, './assets/aivb');
  assert.strictEqual(config.assetConfig.modelUrl, './assets/aivb/selfie_segmenter_landscape.tflite');
}

async function testConfigRejectsLegacySegmentationOptions()
{
  assert.throws(
    () => Config.create({
      segmentation : {
        inputResolution : '256x256'
      }
    }),
    /Unsupported AiVBE segmentation option\(s\): inputResolution/
  );
}

async function testConfigRejectsLegacyPostProcessingOptions()
{
  assert.throws(
    () => Config.create({
      postProcessing : {
        coverage : [ 0.5, 0.75 ]
      }
    }),
    /Unsupported AiVBE postProcessing option\(s\): coverage/
  );
}

async function testConfigClampsPostProcessingRanges()
{
  const config = Config.create({
    postProcessing : {
      blurRadius : 999
    },
    video : {
      targetFps : 240
    }
  });

  assert.strictEqual(config.postProcessing.blurRadius, 100);
  assert.strictEqual(config.video.targetFps, 60);
}

async function run()
{
  const restoreBrowserMocks = installBrowserMocks();
  let passed = 0;
  let failed = 0;
  const failures = [];

  const TESTS = [
    { name: 'testInitFailureDestroysPartiallyCreatedResources', fn: testInitFailureDestroysPartiallyCreatedResources },
    { name: 'testPublicMethodsRequireInitialization', fn: testPublicMethodsRequireInitialization },
    { name: 'testClearBackgroundMirrorTracksSetMirror', fn: testClearBackgroundMirrorTracksSetMirror },
    { name: 'testInitBuildsPassthroughPipelineByDefault', fn: testInitBuildsPassthroughPipelineByDefault },
    { name: 'testSetSolidColorRebuildsPipelineWhenSwitchingFromBlur', fn: testSetSolidColorRebuildsPipelineWhenSwitchingFromBlur },
    { name: 'testDestroyWaitsForActiveRenderBeforeCleaningPipeline', fn: testDestroyWaitsForActiveRenderBeforeCleaningPipeline },
    { name: 'testPendingBackgroundImageLoadRejectsWhenCancelled', fn: testPendingBackgroundImageLoadRejectsWhenCancelled },
    { name: 'testStaleBackgroundImageLoadCannotOverwriteNewPipeline', fn: testStaleBackgroundImageLoadCannotOverwriteNewPipeline },
    { name: 'testSetBackgroundImageTrimsNoneSentinel', fn: testSetBackgroundImageTrimsNoneSentinel },
    { name: 'testSetSolidColorRejectsOutOfRangeRgb', fn: testSetSolidColorRejectsOutOfRangeRgb },
    { name: 'testMirrorAppliesToSegmentationMask', fn: testMirrorAppliesToSegmentationMask },
    { name: 'testRuntimeClosesSegmentationResultAfterMaskCopy', fn: testRuntimeClosesSegmentationResultAfterMaskCopy },
    { name: 'testRuntimeRejectsMissingMask', fn: testRuntimeRejectsMissingMask },
    { name: 'testRuntimeProcessesLatestQueuedFrame', fn: testRuntimeProcessesLatestQueuedFrame },
    { name: 'testAssetLoaderSharesConcurrentRuntimeLoad', fn: testAssetLoaderSharesConcurrentRuntimeLoad },
    { name: 'testConfigNormalizesTasksAssetBaseUrlAndSegmentationOptions', fn: testConfigNormalizesTasksAssetBaseUrlAndSegmentationOptions },
    { name: 'testConfigNormalizesFlatAivbAssetBaseUrl', fn: testConfigNormalizesFlatAivbAssetBaseUrl },
    { name: 'testConfigRejectsLegacySegmentationOptions', fn: testConfigRejectsLegacySegmentationOptions },
    { name: 'testConfigRejectsLegacyPostProcessingOptions', fn: testConfigRejectsLegacyPostProcessingOptions },
    { name: 'testConfigClampsPostProcessingRanges', fn: testConfigClampsPostProcessingRanges }
  ];

  try
  {
    for (const test of TESTS)
    {
      delete require.cache[require.resolve('../lib/AiVBE/index')];

      try
      {
        await test.fn();
        passed += 1;
        console.log(`[AiVBE] PASS ${test.name}`);
      }
      catch (error)
      {
        failed += 1;
        failures.push({ name: test.name, error });
        console.error(`[AiVBE] FAIL ${test.name}: ${error && error.stack ? error.stack : error}`);
      }
    }
  }
  finally
  {
    restoreBrowserMocks();
  }

  if (failed > 0)
  {
    const summary = failures.map((failure) => `${failure.name}: ${failure.error.message}`).join('; ');

    throw new Error(`AiVBE tests failed (${passed} passed, ${failed} failed): ${summary}`);
  }

  console.log(`[AiVBE] ${passed} passed`);
}

module.exports = { run };
