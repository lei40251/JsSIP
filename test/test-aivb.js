/* eslint-disable no-console */
const assert = require('assert');
const Config = require('../lib/MediaEffectsComposer/aiVirtualBackground/AiVBConfig');

let nextAnimationFrameId = 1;
let scheduledFrames = {};
let createdCanvases = [];
let createdImages = [];
let appendedScripts = [];

async function flushMicrotasks(count = 6)
{
  for (let index = 0; index < count; index += 1)
  {
    await Promise.resolve();
  }
}

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
          node.textContent.indexOf('window.CRTCAiVBVisionTasks') !== -1)
        {
          global.window.CRTCAiVBVisionTasks = {
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

async function testRuntimeClosesSegmentationResultAfterMaskCopy()
{
  delete require.cache[require.resolve('../lib/MediaEffectsComposer/aiVirtualBackground/MediaPipeSegmenterRuntime')];
  const Runtime = require('../lib/MediaEffectsComposer/aiVirtualBackground/MediaPipeSegmenterRuntime');
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
  delete require.cache[require.resolve('../lib/MediaEffectsComposer/aiVirtualBackground/MediaPipeSegmenterRuntime')];
  const Runtime = require('../lib/MediaEffectsComposer/aiVirtualBackground/MediaPipeSegmenterRuntime');
  const runtime = new Runtime();

  assert.throws(() => runtime.readMaskValues(), /mask is required/);
}

async function testRuntimeProcessesLatestQueuedFrame()
{
  delete require.cache[require.resolve('../lib/MediaEffectsComposer/aiVirtualBackground/MediaPipeSegmenterRuntime')];
  const Runtime = require('../lib/MediaEffectsComposer/aiVirtualBackground/MediaPipeSegmenterRuntime');
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

async function testRuntimeRejectsWhenGpuInitFails()
{
  const runtimePath = require.resolve('../lib/MediaEffectsComposer/aiVirtualBackground/MediaPipeSegmenterRuntime');
  const loaderPath = require.resolve('../lib/MediaEffectsComposer/aiVirtualBackground/AiVBAssetLoader');
  const originalLoader = require.cache[loaderPath];
  const createCalls = [];

  class MockAssetLoader
  {
    async ensureTasksLoaded()
    {
      return {
        FilesetResolver : {
          async forVisionTasks()
          {
            return {};
          }
        },
        ImageSegmenter : {
          async createFromOptions(vision, options)
          {
            createCalls.push(options.baseOptions.delegate);

            throw new Error('gpu init failed');
          }
        }
      };
    }

    getRuntimeOptions()
    {
      return {
        moduleUrl   : './assets/aivb/vision.js',
        wasmBaseUrl : './assets/aivb',
        modelUrl    : './assets/aivb/selfie_segmenter_landscape.tflite'
      };
    }
  }

  require.cache[loaderPath] = {
    id       : loaderPath,
    filename : loaderPath,
    loaded   : true,
    exports  : MockAssetLoader
  };

  delete require.cache[runtimePath];

  try
  {
    const Runtime = require('../lib/MediaEffectsComposer/aiVirtualBackground/MediaPipeSegmenterRuntime');
    const runtime = new Runtime();

    await assert.rejects(() => runtime.initialize(), /gpu init failed/);

    assert.deepStrictEqual(createCalls, [ 'GPU' ]);
    assert.strictEqual(runtime.initialized, false);
    assert.deepStrictEqual(runtime.labels, []);
    await runtime.destroy();
  }
  finally
  {
    delete require.cache[runtimePath];

    if (originalLoader)
    {
      require.cache[loaderPath] = originalLoader;
    }
    else
    {
      delete require.cache[loaderPath];
    }
  }
}

async function testAssetLoaderSharesConcurrentRuntimeLoad()
{
  const AssetLoader = require('../lib/MediaEffectsComposer/aiVirtualBackground/AiVBAssetLoader');
  const loaderA = new AssetLoader({ moduleUrl: './tasks/vision_bundle.mjs' });
  const loaderB = new AssetLoader({ moduleUrl: './tasks/vision_bundle.mjs' });

  delete global.window.CRTCAiVBVisionTasks;
  appendedScripts = [];
  global.document.querySelector = () => null;

  const results = await Promise.all([
    loaderA.ensureTasksLoaded(),
    loaderB.ensureTasksLoaded()
  ]);

  assert.strictEqual(results[0], global.window.CRTCAiVBVisionTasks);
  assert.strictEqual(results[1], global.window.CRTCAiVBVisionTasks);
  assert.strictEqual(appendedScripts.length, 1);
}

async function testConfigNormalizesCdnUrlAndSegmentationOptions()
{
  const config = Config.create({
    segmentation : {
      delegate : 'cpu'
    },
    assetConfig : {
      cdnUrl   : './assets/ai-vb/',
      modelUrl : './assets/tasks/selfie_segmenter_landscape.tflite'
    }
  });

  assert.strictEqual(config.segmentation.delegate, 'GPU');
  assert.deepStrictEqual(config.segmentation, {
    delegate  : 'GPU',
    frameSkip : 1
  });
  assert.strictEqual(config.assetConfig.moduleUrl, './assets/ai-vb/vision.js');
  assert.strictEqual(config.assetConfig.wasmBaseUrl, './assets/ai-vb');
  assert.strictEqual(config.assetConfig.modelUrl, './assets/tasks/selfie_segmenter_landscape.tflite');
}

async function testConfigNormalizesCdnUrlDefaultModelPath()
{
  const config = Config.create({
    assetConfig : {
      cdnUrl : './assets/ai-vb/'
    }
  });

  assert.strictEqual(config.assetConfig.moduleUrl, './assets/ai-vb/vision.js');
  assert.strictEqual(config.assetConfig.wasmBaseUrl, './assets/ai-vb');
  assert.strictEqual(config.assetConfig.modelUrl, './assets/ai-vb/selfie_segmenter_landscape.tflite');
}

async function testConfigRejectsLegacySegmentationOptions()
{
  assert.throws(
    () => Config.create({
      segmentation : {
        inputResolution : '256x256'
      }
    }),
    /Unsupported AIVirtualBackground segmentation option\(s\): inputResolution/
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
    /Unsupported AIVirtualBackground postProcessing option\(s\): coverage/
  );
}

async function testConfigClampsPostProcessingRanges()
{
  const config = Config.create({
    postProcessing : {
      blurRadius    : 999,
      maxBlurRadius : 12
    },
    video : {
      processingScale : 9,
      targetFps       : 240
    },
    segmentation : {
      frameSkip : 999
    }
  });

  assert.strictEqual(config.postProcessing.blurRadius, 12);
  assert.strictEqual(config.postProcessing.maxBlurRadius, 12);
  assert.strictEqual(config.video.processingScale, 1);
  assert.strictEqual(config.video.targetFps, 60);
  assert.strictEqual(config.segmentation.frameSkip, 120);
}

async function testSourceAiVBManagerUsesScaledCanvasForSegmentation()
{
  delete require.cache[require.resolve('../lib/MediaEffectsComposer/aiVirtualBackground/SourceAiVBController')];
  const SourceAiVBManager = require('../lib/MediaEffectsComposer/aiVirtualBackground/SourceAiVBController');
  const manager = new SourceAiVBManager();
  const source = { slot: 0 };

  manager.setSourceConfig(source, {
    enabled        : true,
    mode           : 'blur',
    blurRadius     : 8,
    runtimeEnabled : true,
    startupDelayMs : 0,
    video          : { width: 640, height: 480, processingScale: 0.5 },
    segmentation   : { delegate: 'CPU', frameSkip: 0 }
  });

  const state = manager._states.get(source);
  const calls = [];

  state.runtimeReady = true;
  state.runtime = {
    async segmentForVideo(input)
    {
      const context = input && typeof input.getContext === 'function' ? input.getContext('2d') : null;

      calls.push({
        width      : input && input.width,
        height     : input && input.height,
        operations : context ? context.operations.slice() : []
      });

      return {
        segmentationMask : new MockCanvas()
      };
    }
  };

  manager.getRenderableState(source, {
    readyState  : 2,
    videoWidth  : 640,
    videoHeight : 480
  });

  await Promise.resolve();
  await Promise.resolve();

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].width, 320);
  assert.strictEqual(calls[0].height, 240);
  assert.strictEqual(calls[0].operations.some((item) => item.type === 'drawImage'), true);
}

async function testSourceAiVBManagerQueuesLatestFrameWhileSegmentationPending()
{
  delete require.cache[require.resolve('../lib/MediaEffectsComposer/aiVirtualBackground/SourceAiVBController')];
  const SourceAiVBManager = require('../lib/MediaEffectsComposer/aiVirtualBackground/SourceAiVBController');
  const manager = new SourceAiVBManager();
  const source = { slot: 0 };
  const resolvers = [];
  const pendingPromises = [
    new Promise((resolve) =>
    {
      resolvers.push(resolve);
    }),
    new Promise((resolve) =>
    {
      resolvers.push(resolve);
    })
  ];
  let now = 1000;

  manager._now = () => now;

  manager.setSourceConfig(source, {
    enabled        : true,
    mode           : 'blur',
    blurRadius     : 8,
    runtimeEnabled : true,
    startupDelayMs : 0,
    maxRuntimeFps  : 5,
    video          : { width: 640, height: 480, processingScale: 0.5 },
    segmentation   : { delegate: 'CPU', frameSkip: 0 }
  });

  const state = manager._states.get(source);
  const calls = [];
  const queuedUpdates = [];

  state.runtimeReady = true;
  state.runtime = {
    segmentForVideo(input)
    {
      calls.push(input);

      return pendingPromises[calls.length - 1];
    },
    updateQueuedFrame(input)
    {
      queuedUpdates.push(input);

      return true;
    }
  };

  manager.getRenderableState(source, {
    readyState  : 2,
    videoWidth  : 640,
    videoHeight : 480
  });
  now = 1250;
  manager.getRenderableState(source, {
    readyState  : 2,
    videoWidth  : 640,
    videoHeight : 480
  });
  now = 1300;
  manager.getRenderableState(source, {
    readyState  : 2,
    videoWidth  : 640,
    videoHeight : 480
  });

  assert.strictEqual(calls.length, 2);
  assert.strictEqual(queuedUpdates.length, 0);
  assert.strictEqual(state.pendingSegmentation, true);
  assert.strictEqual(state.activeSegPromise, pendingPromises[0]);
  assert.strictEqual(state.queuedSegPromise, pendingPromises[1]);

  resolvers[0]({
    segmentationMask : new MockCanvas()
  });
  await flushMicrotasks();

  assert.strictEqual(state.pendingSegmentation, true);
  assert.strictEqual(state.activeSegPromise, pendingPromises[1]);
  assert.strictEqual(state.queuedSegPromise, null);

  resolvers[1]({
    segmentationMask : new MockCanvas()
  });
  await flushMicrotasks();

  assert.strictEqual(state.pendingSegmentation, false);
  assert.strictEqual(state.activeSegPromise, null);
}

async function testSourceAiVBManagerDefersHeavyWorkUntilVideoReady()
{
  const managerPath = require.resolve('../lib/MediaEffectsComposer/aiVirtualBackground/SourceAiVBController');
  const runtimePath = require.resolve('../lib/MediaEffectsComposer/aiVirtualBackground/MediaPipeSegmenterRuntime');
  const originalRuntime = require.cache[runtimePath];
  let runtimeConstructed = 0;
  let runtimeInitializeCalls = 0;

  class MockRuntime
  {
    constructor()
    {
      runtimeConstructed += 1;
    }

    initialize()
    {
      runtimeInitializeCalls += 1;

      return new Promise(() => {});
    }
  }

  require.cache[runtimePath] = {
    id       : runtimePath,
    filename : runtimePath,
    loaded   : true,
    exports  : MockRuntime
  };
  delete require.cache[managerPath];

  try
  {
    const SourceAiVBManager = require('../lib/MediaEffectsComposer/aiVirtualBackground/SourceAiVBController');
    const manager = new SourceAiVBManager();
    const source = { slot: 0 };

    createdImages = [];

    manager.setSourceConfig(source, {
      enabled        : true,
      mode           : 'image',
      imageUrl       : 'pre-call-background.png',
      runtimeEnabled : true,
      startupDelayMs : 0,
      video          : { width: 640, height: 480, processingScale: 0.5 }
    });

    let renderable = manager.getRenderableState(source, {
      readyState  : 0,
      videoWidth  : 0,
      videoHeight : 0
    });

    assert.strictEqual(runtimeConstructed, 0);
    assert.strictEqual(runtimeInitializeCalls, 0);
    assert.strictEqual(createdImages.length, 0);
    assert.strictEqual(renderable.backgroundImage, null);

    renderable = manager.getRenderableState(source, {
      readyState  : 2,
      videoWidth  : 640,
      videoHeight : 480
    });

    assert.strictEqual(runtimeConstructed, 1);
    assert.strictEqual(runtimeInitializeCalls, 1);
    assert.strictEqual(createdImages.length, 1);
    assert.strictEqual(createdImages[0].src, 'pre-call-background.png');
    assert.strictEqual(renderable.backgroundImage, createdImages[0]);
  }
  finally
  {
    delete require.cache[managerPath];

    if (originalRuntime)
    {
      require.cache[runtimePath] = originalRuntime;
    }
    else
    {
      delete require.cache[runtimePath];
    }
  }
}

async function testSourceAiVBManagerStartsRuntimeByDefaultAfterStartupDelay()
{
  const managerPath = require.resolve('../lib/MediaEffectsComposer/aiVirtualBackground/SourceAiVBController');
  const runtimePath = require.resolve('../lib/MediaEffectsComposer/aiVirtualBackground/MediaPipeSegmenterRuntime');
  const originalRuntime = require.cache[runtimePath];
  let runtimeConstructed = 0;
  let runtimeInitializeCalls = 0;

  class MockRuntime
  {
    constructor()
    {
      runtimeConstructed += 1;
    }

    initialize()
    {
      runtimeInitializeCalls += 1;

      return new Promise(() => {});
    }
  }

  require.cache[runtimePath] = {
    id       : runtimePath,
    filename : runtimePath,
    loaded   : true,
    exports  : MockRuntime
  };
  delete require.cache[managerPath];

  try
  {
    const SourceAiVBManager = require('../lib/MediaEffectsComposer/aiVirtualBackground/SourceAiVBController');
    const manager = new SourceAiVBManager();
    const source = { slot: 0 };
    let now = 1000;

    manager._now = () => now;

    manager.setSourceConfig(source, {
      enabled  : true,
      mode     : 'image',
      imageUrl : 'safe-default-background.png',
      video    : { width: 640, height: 480, processingScale: 0.5 }
    });

    now = 2000;
    manager.getRenderableState(source, {
      readyState  : 2,
      videoWidth  : 640,
      videoHeight : 480
    });

    assert.strictEqual(runtimeConstructed, 0);
    assert.strictEqual(runtimeInitializeCalls, 0);
    assert.strictEqual(manager._states.get(source).runtime, null);

    now = 2600;
    manager.getRenderableState(source, {
      readyState  : 2,
      videoWidth  : 640,
      videoHeight : 480
    });

    assert.strictEqual(runtimeConstructed, 1);
    assert.strictEqual(runtimeInitializeCalls, 1);
  }
  finally
  {
    delete require.cache[managerPath];

    if (originalRuntime)
    {
      require.cache[runtimePath] = originalRuntime;
    }
    else
    {
      delete require.cache[runtimePath];
    }
  }
}

async function testSourceAiVBManagerDoesNotPileSegmentationWorkWhileQueued()
{
  delete require.cache[require.resolve('../lib/MediaEffectsComposer/aiVirtualBackground/SourceAiVBController')];
  const SourceAiVBManager = require('../lib/MediaEffectsComposer/aiVirtualBackground/SourceAiVBController');
  const manager = new SourceAiVBManager();
  const source = { slot: 0 };
  const pendingPromises = [
    new Promise(() => {}),
    new Promise(() => {})
  ];
  let now = 1000;

  manager._now = () => now;

  manager.setSourceConfig(source, {
    enabled        : true,
    mode           : 'blur',
    blurRadius     : 8,
    runtimeEnabled : true,
    startupDelayMs : 0,
    maxRuntimeFps  : 5,
    video          : { width: 640, height: 480, processingScale: 0.5, targetFps: 15 },
    segmentation   : { frameSkip: 0 }
  });

  const state = manager._states.get(source);
  const calls = [];
  const queuedUpdates = [];

  state.runtimeReady = true;
  state.runtime = {
    segmentForVideo(input)
    {
      calls.push(input);

      return pendingPromises[calls.length - 1];
    },
    updateQueuedFrame(input)
    {
      queuedUpdates.push(input);

      return true;
    }
  };

  const videoElement = {
    readyState  : 2,
    videoWidth  : 640,
    videoHeight : 480
  };

  manager.getRenderableState(source, videoElement);
  now = 1250;
  manager.getRenderableState(source, videoElement);

  const operationsAfterQueued = state.segmentationContext.operations.length;

  now = 1300;
  manager.getRenderableState(source, videoElement);
  manager.getRenderableState(source, videoElement);

  assert.strictEqual(calls.length, 2);
  assert.strictEqual(queuedUpdates.length, 0);
  assert.strictEqual(state.segmentationContext.operations.length, operationsAfterQueued);
}

async function testSourceAiVBManagerKeepsPreviousBackgroundUntilNextImageLoads()
{
  delete require.cache[require.resolve('../lib/MediaEffectsComposer/aiVirtualBackground/SourceAiVBController')];
  const SourceAiVBManager = require('../lib/MediaEffectsComposer/aiVirtualBackground/SourceAiVBController');
  const manager = new SourceAiVBManager();
  const source = { slot: 0 };

  createdImages = [];
  MockImageElement.autoLoad = false;

  manager.setSourceConfig(source, {
    enabled      : true,
    mode         : 'image',
    imageUrl     : 'first.png',
    video        : { width: 640, height: 480, processingScale: 0.5 },
    segmentation : { delegate: 'CPU', frameSkip: 1 }
  });

  let renderable = manager.getRenderableState(source, {
    readyState  : 2,
    videoWidth  : 640,
    videoHeight : 480
  });
  const firstImage = createdImages[0];

  assert.strictEqual(firstImage.src, 'first.png');
  assert.strictEqual(renderable.backgroundImage, null);

  firstImage.triggerLoad();
  renderable = manager.getRenderableState(source, {
    readyState  : 2,
    videoWidth  : 640,
    videoHeight : 480
  });

  assert.strictEqual(renderable.backgroundImage, firstImage);

  manager.setSourceConfig(source, {
    enabled      : true,
    mode         : 'image',
    imageUrl     : 'second.png',
    video        : { width: 640, height: 480, processingScale: 0.5 },
    segmentation : { delegate: 'CPU', frameSkip: 1 }
  });

  renderable = manager.getRenderableState(source, {
    readyState  : 2,
    videoWidth  : 640,
    videoHeight : 480
  });
  const secondImage = createdImages[1];

  assert.strictEqual(secondImage.src, 'second.png');
  assert.strictEqual(renderable.backgroundImage, firstImage);

  secondImage.triggerLoad();
  renderable = manager.getRenderableState(source, {
    readyState  : 2,
    videoWidth  : 640,
    videoHeight : 480
  });

  assert.strictEqual(renderable.backgroundImage, secondImage);
}

async function run()
{
  const restoreBrowserMocks = installBrowserMocks();
  let passed = 0;
  let failed = 0;
  const failures = [];

  const TESTS = [
    { name: 'testRuntimeClosesSegmentationResultAfterMaskCopy', fn: testRuntimeClosesSegmentationResultAfterMaskCopy },
    { name: 'testRuntimeRejectsMissingMask', fn: testRuntimeRejectsMissingMask },
    { name: 'testRuntimeProcessesLatestQueuedFrame', fn: testRuntimeProcessesLatestQueuedFrame },
    { name: 'testRuntimeRejectsWhenGpuInitFails', fn: testRuntimeRejectsWhenGpuInitFails },
    { name: 'testAssetLoaderSharesConcurrentRuntimeLoad', fn: testAssetLoaderSharesConcurrentRuntimeLoad },
    { name: 'testConfigNormalizesCdnUrlAndSegmentationOptions', fn: testConfigNormalizesCdnUrlAndSegmentationOptions },
    { name: 'testConfigNormalizesCdnUrlDefaultModelPath', fn: testConfigNormalizesCdnUrlDefaultModelPath },
    { name: 'testConfigRejectsLegacySegmentationOptions', fn: testConfigRejectsLegacySegmentationOptions },
    { name: 'testConfigRejectsLegacyPostProcessingOptions', fn: testConfigRejectsLegacyPostProcessingOptions },
    { name: 'testConfigClampsPostProcessingRanges', fn: testConfigClampsPostProcessingRanges },
    { name: 'testSourceAiVBManagerUsesScaledCanvasForSegmentation', fn: testSourceAiVBManagerUsesScaledCanvasForSegmentation },
    { name: 'testSourceAiVBManagerQueuesLatestFrameWhileSegmentationPending', fn: testSourceAiVBManagerQueuesLatestFrameWhileSegmentationPending },
    { name: 'testSourceAiVBManagerDefersHeavyWorkUntilVideoReady', fn: testSourceAiVBManagerDefersHeavyWorkUntilVideoReady },
    { name: 'testSourceAiVBManagerStartsRuntimeByDefaultAfterStartupDelay', fn: testSourceAiVBManagerStartsRuntimeByDefaultAfterStartupDelay },
    { name: 'testSourceAiVBManagerDoesNotPileSegmentationWorkWhileQueued', fn: testSourceAiVBManagerDoesNotPileSegmentationWorkWhileQueued },
    { name: 'testSourceAiVBManagerKeepsPreviousBackgroundUntilNextImageLoads', fn: testSourceAiVBManagerKeepsPreviousBackgroundUntilNextImageLoads }
  ];

  try
  {
    for (const test of TESTS)
    {
      try
      {
        await test.fn();
        passed += 1;
      }
      catch (error)
      {
        failed += 1;
        failures.push({ name: test.name, error });
      }
    }
  }
  finally
  {
    restoreBrowserMocks();
  }

  if (failed > 0)
  {
    console.log(`\n  AIVirtualBackground Failures (${failed}):`);
    for (const failure of failures)
    {
      console.log(`    ✗ ${failure.name}`);
      console.log(`      ${failure.error.message}`);
    }
  }

  console.log(`  AIVirtualBackground Tests: ${passed} passed, ${failed} failed, ${TESTS.length} total`);

  if (failed > 0)
  {
    throw new Error(`${failed} AIVirtualBackground test(s) failed`);
  }
}

module.exports = { run };
