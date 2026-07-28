/* eslint-disable no-console */
const { runSuite } = require('./include/manual-test-suite');
const {
  assert,
  MediaEffectsComposer,
  ComposerConfig,
  WorkerRenderer,
  workerScript,
  vm,
  MockVideoElement,
  MockCanvasElement,
  MockWorker,
  MockVideoFrame,
  MockVideoTrackGenerator,
  installBrowserMocks,
  resetMockState,
  enableInsertableMocks,
  createStream,
  readWorkerShaderSource,
  flushAsync
} = require('./include/media-effects-composer-test-helpers');

async function testInitialSourcesArrayMapsSourceOptionsByIndex()
{
  resetMockState();

  const sourceA = createStream();
  const sourceB = createStream();
  const mixer = new MediaEffectsComposer([ sourceA, sourceB ], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d',
    sources    : [
      {
        slot         : 0,
        sourceMirror : true,
        aiBackground : {
          enabled    : true,
          mode       : 'blur',
          blurRadius : 7
        }
      },
      {
        slot         : 1,
        sourceMirror : false
      }
    ]
  });

  const sources = mixer.getSources();

  assert.strictEqual(sources.length, 2);
  assert.strictEqual(sources[0].slot, 0);
  assert.strictEqual(sources[0].sourceMirror, true);
  assert.strictEqual(sources[0].aiBackground.mode, 'blur');
  assert.strictEqual(sources[0].aiBackground.blurRadius, 7);
  assert.strictEqual(sources[1].slot, 1);
  assert.strictEqual(sources[1].sourceMirror, false);
  assert.strictEqual(sources[1].aiBackground, null);

  mixer.stop();
}


async function testEmptyInitialRenderDoesNotCreateRenderer()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'auto' });

  assert.strictEqual(mixer.getRenderInfo().actualMode, 'not-started');
  assert.strictEqual(MockWorker.instances.length, 0);

  mixer.stop();
}


async function testWorkerShaderUsesRuntimeNewlines()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'auto' });

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


async function testAutoRendererWithWorkerSupportStartsWorkerWebGL2()
{
  resetMockState();
  MockCanvasElement.webgl2Supported = true;

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'auto' });

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


async function testAutoRendererWithoutWorkerSupportStartsMainWebGL2()
{
  resetMockState();
  MockCanvasElement.webgl2Supported = true;

  const originalWorker = global.Worker;

  delete global.Worker;

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'auto' });

  try
  {
    mixer.appendStream(createStream(), 0);
    mixer.getVideoStream();
    mixer._drawVideosToCanvas(undefined, true);

    const info = mixer.getRenderInfo();

    assert.strictEqual(info.requestedMode, 'auto');
    assert.strictEqual(info.actualMode, 'main-webgl2');
    assert.strictEqual(info.isWorker, false);
    assert.strictEqual(MockWorker.instances.length, 0);
  }
  finally
  {
    global.Worker = originalWorker;
    mixer.stop();
  }
}


async function testAutoRendererFallbackTriesWorker2DBeforeMain2D()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'auto' });

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

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'auto' });

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
  const script = workerScript.createWorkerScript();

  assert.ok(script.includes('gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);'));
}


async function testWorkerVideoFrameDoesNotUseImageBitmapFlipY()
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

  const renderer = new WorkerRenderer({ backgroundColor: '#000', maxFrameQueue: 1 }, {
    actualMode : 'worker-webgl2'
  });
  const video = new MockVideoElement();

  await renderer._createFrame(video);

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].options, undefined);
}


async function testWorkerWebGL2AiVBUsesNonFlippedUploadForBothRawAndCompositedSurface()
{
  resetMockState();
  const pixelStoreCalls = [];
  const sourceFrame = {
    width  : 320,
    height : 180,
    close  : function()
    {
      sourceFrame.closed = true;
    }
  };
  const composedSurface = { width: 320, height: 180 };

  const script = workerScript.createWorkerScript();

  assert.ok(script);

  const sandbox = {
    OffscreenCanvas : class
    {
      constructor(width, height)
      {
        this.width = width;
        this.height = height;
      }

      getContext(type)
      {
        if (type === '2d')
        {
          return {
            clearRect() {},
            drawImage() {},
            save() {},
            restore() {},
            translate() {},
            scale() {},
            fillRect() {},
            createImageData(width, height)
            {
              return {
                data   : new Uint8ClampedArray(width * height * 4),
                width  : width,
                height : height
              };
            },
            putImageData() {},
            get filter() { return this._filter || ''; },
            set filter(value) { this._filter = value; },
            get globalCompositeOperation() { return this._gco || 'source-over'; },
            set globalCompositeOperation(value) { this._gco = value; }
          };
        }

        return {
          VERTEX_SHADER       : 0x8B31,
          FRAGMENT_SHADER     : 0x8B30,
          COMPILE_STATUS      : 0x8B81,
          LINK_STATUS         : 0x8B82,
          ARRAY_BUFFER        : 0x8892,
          STATIC_DRAW         : 0x88E4,
          TEXTURE_2D          : 0x0DE1,
          TEXTURE_WRAP_S      : 0x2802,
          TEXTURE_WRAP_T      : 0x2803,
          CLAMP_TO_EDGE       : 0x812F,
          TEXTURE_MIN_FILTER  : 0x2801,
          TEXTURE_MAG_FILTER  : 0x2800,
          LINEAR              : 0x2601,
          TEXTURE0            : 0x84C0,
          COLOR_BUFFER_BIT    : 0x4000,
          BLEND               : 0x0BE2,
          SRC_ALPHA           : 0x0302,
          ONE_MINUS_SRC_ALPHA : 0x0303,
          UNPACK_FLIP_Y_WEBGL : 0x9240,
          RGBA                : 0x1908,
          UNSIGNED_BYTE       : 0x1401,
          TRIANGLE_STRIP      : 0x0005,
          FLOAT               : 0x1406, 
          createShader() { return {}; },
          shaderSource() {},
          compileShader() {},
          getShaderParameter() { return true; },
          getShaderInfoLog() { return ''; },
          deleteShader() {},
          createProgram() { return {}; },
          attachShader() {},
          linkProgram() {},
          getProgramParameter() { return true; },
          getProgramInfoLog() { return ''; },
          deleteProgram() {},
          createBuffer() { return {}; },
          bindBuffer() {},
          bufferData() {},
          useProgram() {},
          getAttribLocation() { return 0; },
          enableVertexAttribArray() {},
          vertexAttribPointer() {},
          getUniformLocation() { return {}; },
          uniform1i() {},
          uniform1f() {},
          createTexture() { return {}; },
          bindTexture() {},
          texParameteri() {},
          clearColor() {},
          clear() {},
          activeTexture() {},
          disable() {},
          enable() {},
          blendFunc() {},
          pixelStorei(pname, value)
          {
            pixelStoreCalls.push({ pname, value });
          },
          texImage2D() {},
          viewport() {},
          drawArrays() {},
          flush() {},
          deleteTexture() {},
          deleteBuffer() {},
          getExtension() { return null; }
        };
      }

      transferToImageBitmap()
      {
        return {
          close : function() {}
        };
      }
    },
    ImageBitmap : function() {},
    fetch       : async function()
    {
      return {
        ok   : true,
        blob : async function()
        {
          return {};
        }
      };
    },
    createImageBitmap : async function()
    {
      return composedSurface;
    },
    performance : { now: () => 0 },
    postMessage : function() {},
    import      : async function()
    {
      return {
        FilesetResolver : {
          forVisionTasks : async function()
          {
            return {};
          }
        },
        ImageSegmenter : {
          createFromOptions : async function()
          {
            return {
              getLabels : function()
              {
                return [ 'background', 'person' ];
              },
              segmentForVideo : function(input, timestamp, callback)
              {
                callback({
                  confidenceMasks : [
                    {
                      width             : 2,
                      height            : 2,
                      getAsFloat32Array : function()
                      {
                        return new Float32Array([ 0, 1, 1, 0 ]);
                      },
                      close : function() {}
                    }
                  ]
                });
              },
              close : async function() {}
            };
          }
        }
      };
    },
    self : {}
  };

  vm.runInNewContext(`${script}
this.__workerTest = {
  setActualMode : function(value) { actualMode = value; },
  setDimensions : function(w, h) { width = w; height = h; },
  setGl : function(mock) { gl = mock; },
  setProgram : function(value) { program = value; },
  setOpacityLocation : function(value) { opacityLocation = value; },
  overrideGetRenderableSurface : function(fn) { getRenderableSurface = fn; },
  renderWebGL2 : renderWebGL2
};`, sandbox);

  sandbox.__workerTest.setActualMode('worker-webgl2');
  sandbox.__workerTest.setDimensions(320, 180);
  sandbox.__workerTest.setProgram({});
  sandbox.__workerTest.setOpacityLocation({});
  sandbox.__workerTest.setGl(new sandbox.OffscreenCanvas(320, 180).getContext('webgl2'));
  sandbox.__workerTest.overrideGetRenderableSurface(async function(item)
  {
    return item.aiBackground ? composedSurface : item.frame;
  });

  await sandbox.__workerTest.renderWebGL2({
    backgroundColor : '#000',
    items           : [
      {
        id           : 'plain',
        draw         : { x: 0, y: 0, width: 100, height: 100 },
        mirrorX      : false,
        aiBackground : null,
        frame        : sourceFrame
      },
      {
        id           : 'aivb',
        draw         : { x: 0, y: 0, width: 100, height: 100 },
        mirrorX      : false,
        aiBackground : {
          enabled : true,
          mode    : 'color'
        },
        frame : sourceFrame
      }
    ],
    sourceWatermarks : [],
    outputWatermarks : []
  });

  assert.strictEqual(pixelStoreCalls.length >= 2, true);
  assert.strictEqual(pixelStoreCalls[0].value, false);
  assert.strictEqual(pixelStoreCalls[1].value, false);
}


async function testWorkerWebGL2WatermarkUploadUsesFlipY()
{
  resetMockState();
  const pixelStoreCalls = [];
  const script = workerScript.createWorkerScript();

  const sandbox = {
    OffscreenCanvas : class
    {
      constructor(width, height)
      {
        this.width = width;
        this.height = height;
      }

      getContext(type)
      {
        if (type === '2d')
        {
          return {
            clearRect() {},
            drawImage() {},
            save() {},
            restore() {},
            translate() {},
            scale() {},
            fillRect() {}
          };
        }

        return {
          VERTEX_SHADER       : 0x8B31,
          FRAGMENT_SHADER     : 0x8B30,
          COMPILE_STATUS      : 0x8B81,
          LINK_STATUS         : 0x8B82,
          ARRAY_BUFFER        : 0x8892,
          STATIC_DRAW         : 0x88E4,
          TEXTURE_2D          : 0x0DE1,
          TEXTURE_WRAP_S      : 0x2802,
          TEXTURE_WRAP_T      : 0x2803,
          CLAMP_TO_EDGE       : 0x812F,
          TEXTURE_MIN_FILTER  : 0x2801,
          TEXTURE_MAG_FILTER  : 0x2800,
          LINEAR              : 0x2601,
          TEXTURE0            : 0x84C0,
          COLOR_BUFFER_BIT    : 0x4000,
          BLEND               : 0x0BE2,
          SRC_ALPHA           : 0x0302,
          ONE_MINUS_SRC_ALPHA : 0x0303,
          UNPACK_FLIP_Y_WEBGL : 0x9240,
          RGBA                : 0x1908,
          UNSIGNED_BYTE       : 0x1401,
          TRIANGLE_STRIP      : 0x0005,
          FLOAT               : 0x1406,
          createShader() { return {}; },
          shaderSource() {},
          compileShader() {},
          getShaderParameter() { return true; },
          getShaderInfoLog() { return ''; },
          deleteShader() {},
          createProgram() { return {}; },
          attachShader() {},
          linkProgram() {},
          getProgramParameter() { return true; },
          getProgramInfoLog() { return ''; },
          deleteProgram() {},
          createBuffer() { return {}; },
          bindBuffer() {},
          bufferData() {},
          useProgram() {},
          getAttribLocation() { return 0; },
          enableVertexAttribArray() {},
          vertexAttribPointer() {},
          getUniformLocation() { return {}; },
          uniform1i() {},
          uniform1f() {},
          createTexture() { return {}; },
          bindTexture() {},
          texParameteri() {},
          clearColor() {},
          clear() {},
          activeTexture() {},
          disable() {},
          enable() {},
          blendFunc() {},
          pixelStorei(pname, value)
          {
            pixelStoreCalls.push({ pname, value });
          },
          texImage2D() {},
          viewport() {},
          drawArrays() {},
          flush() {},
          deleteTexture() {},
          deleteBuffer() {},
          getExtension() { return null; }
        };
      }

      transferToImageBitmap()
      {
        return {
          close : function() {}
        };
      }
    },
    ImageBitmap : function() {},
    fetch       : async function()
    {
      return {
        ok   : true,
        blob : async function()
        {
          return {};
        }
      };
    },
    createImageBitmap : async function(input)
    {
      return input;
    },
    performance : { now: () => 0 },
    postMessage : function() {},
    import      : async function() { return {}; },
    self        : {}
  };

  vm.runInNewContext(`${script}
this.__workerTest = {
  setActualMode : function(value) { actualMode = value; },
  setDimensions : function(w, h) { width = w; height = h; },
  setGl : function(mock) { gl = mock; },
  setProgram : function(value) { program = value; },
  setOpacityLocation : function(value) { opacityLocation = value; },
  renderWebGL2 : renderWebGL2
};`, sandbox);

  sandbox.__workerTest.setActualMode('worker-webgl2');
  sandbox.__workerTest.setDimensions(320, 180);
  sandbox.__workerTest.setProgram({});
  sandbox.__workerTest.setOpacityLocation({});
  sandbox.__workerTest.setGl(new sandbox.OffscreenCanvas(320, 180).getContext('webgl2'));

  await sandbox.__workerTest.renderWebGL2({
    backgroundColor  : '#000',
    items            : [],
    sourceWatermarks : [
      {
        id      : 'wm-1',
        frame   : { width: 40, height: 20 },
        draw    : { x: 10, y: 12, width: 40, height: 20 },
        opacity : 1
      }
    ],
    outputWatermarks : []
  });

  assert.strictEqual(pixelStoreCalls.length, 1);
  assert.strictEqual(pixelStoreCalls[0].value, true);
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


async function testWorkerRendererPassesBitmapToInsertableFrameCallback()
{
  resetMockState();
  const renderer = new WorkerRenderer({
    backgroundColor : '#000',
    maxFrameQueue   : 1,
    insertable      : true
  }, {});
  const canvas = new MockCanvasElement();
  const received = [];
  const bitmap = {
    width  : 320,
    height : 180,
    close  : function()
    {
      bitmap.closed = true;
    }
  };

  renderer._canvas = canvas;
  renderer._outputContext = canvas.getContext('2d');
  renderer.setFrameCallback((frameCtx) => received.push(frameCtx));

  renderer._handleWorkerMessage({
    data : {
      type   : 'rendered',
      bitmap : bitmap
    }
  });

  assert.strictEqual(received.length, 1);
  assert.strictEqual(received[0].canvas, canvas);
  assert.strictEqual(received[0].frameSource, bitmap);
  assert.strictEqual(received[0].frameSourceConsumed, true);
  assert.notStrictEqual(bitmap.closed, true);
}


async function testWorkerWebGL2AiVBDisablesDirectInsertableBitmapPath()
{
  resetMockState();
  const renderer = new WorkerRenderer({
    backgroundColor : '#000',
    maxFrameQueue   : 1,
    insertable      : true,
    hasAiBackground : true
  }, {
    actualMode : 'worker-webgl2',
    isWorker   : true,
    isWebGL2   : true
  });
  const canvas = new MockCanvasElement();
  const received = [];
  const bitmap = {
    width  : 320,
    height : 180,
    close  : function()
    {
      bitmap.closed = true;
    }
  };

  renderer._canvas = canvas;
  renderer._outputContext = canvas.getContext('2d');
  renderer.setFrameCallback((frameCtx) => received.push(frameCtx));

  renderer._handleWorkerMessage({
    data : {
      type   : 'rendered',
      bitmap : bitmap
    }
  });

  assert.strictEqual(received.length, 1);
  assert.strictEqual(received[0].canvas, canvas);
  assert.strictEqual(received[0].frameSource, null);
  assert.strictEqual(received[0].frameSourceConsumed, false);
  assert.strictEqual(bitmap.closed, true);
  assert.strictEqual(canvas._context2d.operations.some((operation) => operation.type === 'translate' && operation.x === 0 && operation.y === canvas.height), true);
  assert.strictEqual(canvas._context2d.operations.some((operation) => operation.type === 'scale' && operation.x === 1 && operation.y === -1), true);
}


async function testComposerConfigDefaults()
{
  const defaultConfig = ComposerConfig.create({});
  const customConfig = ComposerConfig.create({ width: '640', height: 360, fps: '15' });

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


async function testComposerConfigSourceOptions()
{
  assert.deepStrictEqual(
    ComposerConfig.normalizeSourceOptions(2, 1, 0.8),
    { slot: 3 }
  );
  assert.deepStrictEqual(
    ComposerConfig.normalizeSourceOptions({ slot: 0, gain: 0 }, 0, 0.8),
    { slot: 0, gain: 0 }
  );
  assert.deepStrictEqual(
    ComposerConfig.normalizeSourceOptions({ slot: -2, gain: -1 }, 2, 0.8),
    { slot: 2, gain: 0.8 }
  );
  assert.deepStrictEqual(
    ComposerConfig.normalizeSourceOptions({ slot: 1, sourceMirror: true }, 0, 0.8),
    { slot: 1, sourceMirror: true }
  );
  assert.strictEqual(ComposerConfig.normalizeSourceOptions({ slot: 999 }, 0, 0.8).slot, 8);
}


async function testConsumedInsertableFrameSourceClosesOnSuccessAndCreationFailure()
{
  resetMockState();
  enableInsertableMocks();

  const mixer = new MediaEffectsComposer([ createStream() ], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d',
    insertable : true
  });

  mixer.getVideoStream();
  await flushAsync();

  const successfulSource = {
    closed : false,
    close()
    {
      this.closed = true;
    }
  };

  mixer._outMgr.onFramePresented({
    frameSource         : successfulSource,
    frameSourceConsumed : true,
    timestamp           : 1
  });
  await flushAsync();
  assert.strictEqual(successfulSource.closed, true);

  const FailedVideoFrame = function()
  {
    throw new Error('frame construction failed');
  };
  const failedSource = {
    closed : false,
    close()
    {
      this.closed = true;
    }
  };

  global.VideoFrame = FailedVideoFrame;
  global.window.VideoFrame = FailedVideoFrame;
  mixer._outMgr.onFramePresented({
    frameSource         : failedSource,
    frameSourceConsumed : true,
    timestamp           : 2
  });
  await flushAsync();
  assert.strictEqual(failedSource.closed, true);
  mixer.stop();
}


async function testRepeatedInsertableWriteFailureSwitchesLiveOutputToCaptureStream()
{
  resetMockState();
  enableInsertableMocks();

  const mixer = new MediaEffectsComposer([ createStream() ], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d',
    insertable : true
  });
  const output = mixer.getVideoStream();
  const oldTrack = output.getVideoTracks()[0];
  const writer = MockVideoTrackGenerator.instances[0]._writer;

  await flushAsync();
  writer.write = () => Promise.reject(new Error('writer closed'));

  for (let attempt = 0; attempt < 5; attempt++)
  {
    mixer._outMgr.onFramePresented({ canvas: mixer._canvas, timestamp: attempt + 10 });
    await flushAsync();
  }

  const nextTrack = output.getVideoTracks()[0];

  assert.notStrictEqual(nextTrack, oldTrack);
  assert.strictEqual(oldTrack.readyState, 'ended');
  assert.strictEqual(nextTrack.readyState, 'live');
  assert.strictEqual(mixer.getRenderInfo().outputMode, 'capture-stream');
  mixer.stop();
}


async function testRequestFrameFailureSwitchesLiveOutputToAutomaticCapture()
{
  resetMockState();
  MockCanvasElement.captureTrackHasRequestFrame = true;

  const mixer = new MediaEffectsComposer([ createStream() ], {
    width              : 320,
    height             : 180,
    fps                : 15,
    renderMode         : 'main-2d',
    manualFrameControl : true
  });
  const output = mixer.getVideoStream();
  const oldTrack = output.getVideoTracks()[0];

  oldTrack.requestFrame = () =>
  {
    throw new Error('requestFrame unavailable');
  };
  mixer._outMgr.onFramePresented({ canvas: mixer._canvas, timestamp: 20 });

  const nextTrack = output.getVideoTracks()[0];

  assert.notStrictEqual(nextTrack, oldTrack);
  assert.strictEqual(oldTrack.readyState, 'ended');
  assert.strictEqual(nextTrack.readyState, 'live');
  assert.strictEqual(mixer.getRenderInfo().frameControlMode, 'auto-capture-fps');
  mixer.stop();
}


async function testDefaultPrefersCaptureStreamEvenWhenInsertableSupported()
{
  resetMockState();
  enableInsertableMocks();

  const mixer = new MediaEffectsComposer([ createStream({ audio: true }) ], {
    width              : 320,
    height             : 180,
    fps                : 15,
    renderMode         : 'main-2d',
    manualFrameControl : false
  });
  const output = mixer.getVideoStream();
  const info = mixer.getRenderInfo();

  assert.strictEqual(output.getVideoTracks().length, 1);
  assert.strictEqual(mixer._capturedStreams.length, 1);
  assert.strictEqual(info.outputMode, 'capture-stream');
  assert.strictEqual(info.insertableActive, false);
  assert.strictEqual(info.insertableConfigured, false);
  assert.strictEqual(info.insertableSupported, true);
  assert.strictEqual(info.captureSinkActive, true);
  assert.ok(mixer._outMgr._captureSinkVideo);
  assert.strictEqual(mixer._outMgr._captureSinkVideo.srcObject, mixer._capturedStreams[0]);

  mixer.stop();
}


async function testCaptureStreamActiveSinkIsDisposedOnStop()
{
  resetMockState();
  enableInsertableMocks();

  const mixer = new MediaEffectsComposer([ createStream({ audio: true }) ], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d'
  });

  mixer.getVideoStream();
  const sinkVideo = mixer._outMgr._captureSinkVideo;

  assert.ok(sinkVideo);

  mixer.stop();

  assert.strictEqual(sinkVideo._paused, true);
  assert.strictEqual(sinkVideo._removed, true);
  assert.strictEqual(sinkVideo.srcObject, null);
  assert.strictEqual(mixer._outMgr._captureSinkVideo, null);
}


async function testInsertableVideoStreamPreferredWhenSupported()
{
  resetMockState();
  enableInsertableMocks();

  const mixer = new MediaEffectsComposer([ createStream({ audio: true }) ], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d',
    insertable : true
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
  assert.strictEqual(info.insertableConfigured, true);
  assert.strictEqual(info.insertableSupported, true);
  assert.strictEqual(info.generatorType, 'video-track-generator');

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

  const mixer = new MediaEffectsComposer([ createStream({ audio: true }) ], {
    width              : 320,
    height             : 180,
    fps                : 15,
    renderMode         : 'main-2d',
    manualFrameControl : false
  });
  const output = mixer.getVideoStream();
  const info = mixer.getRenderInfo();

  assert.strictEqual(output.getVideoTracks().length, 1);
  assert.strictEqual(mixer._capturedStreams.length, 1);
  assert.strictEqual(info.outputMode, 'capture-stream');
  assert.strictEqual(info.insertableActive, false);
  assert.strictEqual(info.insertableSupported, false);
  assert.strictEqual(info.frameControlMode, 'auto-capture-fps');

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

  const mixer = new MediaEffectsComposer([ createStream({ audio: true }) ], {
    width              : 320,
    height             : 180,
    fps                : 15,
    renderMode         : 'main-2d',
    manualFrameControl : true
  });
  const output = mixer.getVideoStream();
  const capturedTrack = output.getVideoTracks()[0];
  const before = capturedTrack.requestFrameCount || 0;

  mixer._drawVideosToCanvas(undefined, true);
  mixer._drawVideosToCanvas(undefined, true);

  const after = capturedTrack.requestFrameCount || 0;
  const info = mixer.getRenderInfo();

  assert.strictEqual(info.outputMode, 'capture-stream');
  assert.strictEqual(info.frameControlMode, 'manual-request-frame');
  assert.ok(after > before);

  mixer.stop();
}


async function testInsertableCanUseLegacyMediaStreamTrackGenerator()
{
  resetMockState();
  enableInsertableMocks({ useLegacyGenerator: true });

  const mixer = new MediaEffectsComposer([ createStream({ audio: true }) ], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d',
    insertable : true
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

  const mixer = new MediaEffectsComposer([ createStream({ audio: true }) ], {
    width              : 320,
    height             : 180,
    fps                : 15,
    renderMode         : 'main-2d',
    insertable         : false,
    manualFrameControl : false
  });
  const output = mixer.getVideoStream();
  const info = mixer.getRenderInfo();

  assert.strictEqual(output.getVideoTracks().length, 1);
  assert.strictEqual(mixer._capturedStreams.length, 1);
  assert.strictEqual(info.outputMode, 'capture-stream');
  assert.strictEqual(info.insertableActive, false);
  assert.strictEqual(info.insertableConfigured, false);
  assert.strictEqual(info.insertableSupported, true);

  mixer.stop();
}

const TESTS = [
  { name: 'testInitialSourcesArrayMapsSourceOptionsByIndex', fn: testInitialSourcesArrayMapsSourceOptionsByIndex },
  { name: 'testEmptyInitialRenderDoesNotCreateRenderer', fn: testEmptyInitialRenderDoesNotCreateRenderer },
  { name: 'testWorkerShaderUsesRuntimeNewlines', fn: testWorkerShaderUsesRuntimeNewlines },
  { name: 'testAutoRendererWithWorkerSupportStartsWorkerWebGL2', fn: testAutoRendererWithWorkerSupportStartsWorkerWebGL2 },
  { name: 'testAutoRendererWithoutWorkerSupportStartsMainWebGL2', fn: testAutoRendererWithoutWorkerSupportStartsMainWebGL2 },
  { name: 'testAutoRendererFallbackTriesWorker2DBeforeMain2D', fn: testAutoRendererFallbackTriesWorker2DBeforeMain2D },
  { name: 'testAutoRendererFallbackEndsAtMain2D', fn: testAutoRendererFallbackEndsAtMain2D },
  { name: 'testWorkerRendererCarriesWatermarkPayload', fn: testWorkerRendererCarriesWatermarkPayload },
  { name: 'testWorkerWatermarkFrameFlipYOnlyForWebGL2', fn: testWorkerWatermarkFrameFlipYOnlyForWebGL2 },
  { name: 'testWorkerVideoFrameDoesNotUseImageBitmapFlipY', fn: testWorkerVideoFrameDoesNotUseImageBitmapFlipY },
  { name: 'testWorkerWebGL2AiVBUsesNonFlippedUploadForBothRawAndCompositedSurface', fn: testWorkerWebGL2AiVBUsesNonFlippedUploadForBothRawAndCompositedSurface },
  { name: 'testWorkerWebGL2WatermarkUploadUsesFlipY', fn: testWorkerWebGL2WatermarkUploadUsesFlipY },
  { name: 'testWorkerRendererKeepsEmptyPayload', fn: testWorkerRendererKeepsEmptyPayload },
  { name: 'testWorkerRendererPassesBitmapToInsertableFrameCallback', fn: testWorkerRendererPassesBitmapToInsertableFrameCallback },
  { name: 'testWorkerWebGL2AiVBDisablesDirectInsertableBitmapPath', fn: testWorkerWebGL2AiVBDisablesDirectInsertableBitmapPath },
  { name: 'testComposerConfigDefaults', fn: testComposerConfigDefaults },
  { name: 'testComposerConfigSourceOptions', fn: testComposerConfigSourceOptions },
  { name: 'testConsumedInsertableFrameSourceClosesOnSuccessAndCreationFailure', fn: testConsumedInsertableFrameSourceClosesOnSuccessAndCreationFailure },
  { name: 'testRepeatedInsertableWriteFailureSwitchesLiveOutputToCaptureStream', fn: testRepeatedInsertableWriteFailureSwitchesLiveOutputToCaptureStream },
  { name: 'testRequestFrameFailureSwitchesLiveOutputToAutomaticCapture', fn: testRequestFrameFailureSwitchesLiveOutputToAutomaticCapture },
  { name: 'testDefaultPrefersCaptureStreamEvenWhenInsertableSupported', fn: testDefaultPrefersCaptureStreamEvenWhenInsertableSupported },
  { name: 'testCaptureStreamActiveSinkIsDisposedOnStop', fn: testCaptureStreamActiveSinkIsDisposedOnStop },
  { name: 'testInsertableVideoStreamPreferredWhenSupported', fn: testInsertableVideoStreamPreferredWhenSupported },
  { name: 'testInsertableFallbacksToCaptureStreamWhenGeneratorUnavailable', fn: testInsertableFallbacksToCaptureStreamWhenGeneratorUnavailable },
  { name: 'testCaptureStreamUsesManualRequestFrameWhenSupported', fn: testCaptureStreamUsesManualRequestFrameWhenSupported },
  { name: 'testInsertableCanUseLegacyMediaStreamTrackGenerator', fn: testInsertableCanUseLegacyMediaStreamTrackGenerator },
  { name: 'testDisableInsertableForcesCaptureStreamEvenWhenSupported', fn: testDisableInsertableForcesCaptureStreamEvenWhenSupported }
];

async function run(customSuiteName)
{
  const suiteName = customSuiteName || 'MediaEffectsComposer-Renderer';
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
