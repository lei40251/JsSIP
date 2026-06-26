/* eslint-disable no-console */
const { runSuite } = require('./include/manual-test-suite');
const {
  assert,
  MediaEffectsComposer,
  MainCanvas2DRenderer,
  MainWebGL2Renderer,
  MockVideoElement,
  MockCanvasElement,
  installBrowserMocks,
  resetMockState,
  createStream
} = require('./include/media-effects-composer-test-helpers');

async function testOutputMirrorKeepsWorkerRendererWithAiVirtualBackground()
{
  resetMockState();
  MockCanvasElement.webgl2Supported = true;

  const mixer = new MediaEffectsComposer([], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'auto'
  });

  mixer.appendStream(createStream(), {
    slot                : 0,
    aiVirtualBackground : {
      enabled  : true,
      mode     : 'image',
      imageUrl : 'background.png'
    }
  });
  mixer.getVideoStream();
  mixer._drawVideosToCanvas(undefined, true);

  assert.strictEqual(mixer.getRenderInfo().isWorker, true);
  assert.strictEqual(mixer.getRenderInfo().actualMode, 'worker-init');

  mixer.setMirror(true);

  assert.strictEqual(mixer.getRenderInfo().isWorker, true);
  assert.strictEqual(mixer.getRenderInfo().actualMode, 'worker-init');

  mixer.stop();
}


async function testSourceAiVBOptionsAppearInSourceSnapshot()
{
  resetMockState();
  MockCanvasElement.webgl2Supported = true;

  const mixer = new MediaEffectsComposer([], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'auto'
  });

  mixer.appendStream(createStream(), {
    slot                : 0,
    aiVirtualBackground : {
      enabled        : true,
      mode           : 'color',
      color          : '#123456',
      postProcessing : {
        foregroundBrightness : 1.2,
        foregroundContrast   : 1.1,
        foregroundSaturate   : 1.08
      }
    }
  });

  const source = mixer.getSources()[0];

  assert.ok(source);
  assert.strictEqual(source.aiVirtualBackground.mode, 'color');
  assert.strictEqual(source.aiVirtualBackground.backgroundColor, '#123456');
  assert.strictEqual(source.aiVirtualBackground.postProcessing.foregroundBrightness, 1.2);
  assert.strictEqual(source.aiVirtualBackground.foregroundFilter, undefined);
  assert.strictEqual(mixer._config.hasSourceAiVirtualBackground, true);
  assert.strictEqual(mixer._config.forceMainThreadRenderer, false);
  assert.strictEqual(mixer._config.forceMain2DRenderer, false);

  mixer.getVideoStream();

  assert.strictEqual(mixer.getRenderInfo().actualMode, 'worker-init');
  assert.strictEqual(mixer.getRenderInfo().isWorker, true);

  mixer.stop();
}


async function testSetSourceAiVirtualBackgroundLifecycle()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d'
  });

  mixer.appendStream(createStream(), 0);

  const config = mixer.setSourceAiVirtualBackground(0, {
    enabled    : true,
    mode       : 'blur',
    blurRadius : 9
  });

  assert.strictEqual(config.mode, 'blur');
  assert.strictEqual(config.blurRadius, 9);
  assert.strictEqual(mixer.getSourceAiVirtualBackground(0).mode, 'blur');

  mixer.clearSourceAiVirtualBackground(0);

  assert.strictEqual(mixer.getSourceAiVirtualBackground(0), null);

  mixer.stop();
}


async function testSetSourceAiVirtualBackgroundKeepsMainWebGL2Renderer()
{
  resetMockState();
  MockCanvasElement.webgl2Supported = true;

  const mixer = new MediaEffectsComposer([], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-webgl2'
  });

  mixer.appendStream(createStream(), 0);
  mixer.getVideoStream();

  assert.strictEqual(mixer.getRenderInfo().actualMode, 'main-webgl2');

  mixer.setSourceAiVirtualBackground(0, {
    enabled    : true,
    mode       : 'blur',
    blurRadius : 8
  });

  assert.strictEqual(mixer.getRenderInfo().actualMode, 'main-webgl2');
  assert.strictEqual(mixer.getRenderInfo().isWorker, false);

  mixer.stop();
}


async function testSetSourceAiVirtualBackgroundKeepsWorkerRenderer()
{
  resetMockState();
  MockCanvasElement.webgl2Supported = true;

  const mixer = new MediaEffectsComposer([], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'auto'
  });

  mixer.appendStream(createStream(), 0);
  mixer.getVideoStream();
  mixer._drawVideosToCanvas(undefined, true);

  assert.strictEqual(mixer.getRenderInfo().actualMode, 'worker-init');

  mixer.setSourceAiVirtualBackground(0, {
    enabled  : true,
    mode     : 'image',
    imageUrl : 'background.png'
  });

  assert.strictEqual(mixer.getRenderInfo().actualMode, 'worker-init');
  assert.strictEqual(mixer.getRenderInfo().isWorker, true);

  mixer.stop();
}


async function testOutputMirrorDoesNotPreloadAiVBBackgroundImage()
{
  resetMockState();
  MockCanvasElement.webgl2Supported = true;

  const createdImages = [];
  const originalImage = global.Image;

  global.Image = class MockImage
  {
    constructor()
    {
      this.onload = null;
      this.onerror = null;
      createdImages.push(this);
    }

    set src(value)
    {
      this._src = value;

      if (typeof this.onload === 'function')
      {
        this.onload();
      }
    }

    get src()
    {
      return this._src;
    }
  };

  try
  {
    const mixer = new MediaEffectsComposer([], {
      width      : 320,
      height     : 180,
      fps        : 15,
      renderMode : 'auto'
    });

    mixer.appendStream(createStream(), 0);
    mixer.getVideoStream();
    mixer._drawVideosToCanvas(undefined, true);

    mixer.setSourceAiVirtualBackground(0, {
      enabled  : true,
      mode     : 'image',
      imageUrl : 'background.png'
    });

    const source = mixer._sources[0];
    const stateBeforeMirror = source && mixer._sourceAiVBManager._states.get(source);

    assert.strictEqual(createdImages.length, 0);
    assert.ok(stateBeforeMirror);
    assert.strictEqual(stateBeforeMirror.bgImageStatus, 'idle');
    assert.strictEqual(stateBeforeMirror.backgroundImage, null);

    await mixer.setConfig({ outputMirror: true });

    const stateAfterMirror = source && mixer._sourceAiVBManager._states.get(source);

    assert.ok(stateAfterMirror);
    assert.strictEqual(createdImages.length, 0);
    assert.strictEqual(stateAfterMirror.bgImageStatus, 'idle');
    assert.strictEqual(stateAfterMirror.backgroundImage, null);

    mixer.stop();
  }
  finally
  {
    if (originalImage === undefined)
    {
      delete global.Image;
    }
    else
    {
      global.Image = originalImage;
    }
  }
}


async function testMainCanvas2DAiVirtualBackgroundUsesMaskFramePair()
{
  resetMockState();

  const outputCanvas = new MockCanvasElement();
  const source = { slot: 0 };
  const liveVideo = new MockVideoElement();
  const frozenFrame = new MockCanvasElement();
  const mask = new MockCanvasElement();
  const state = {};
  const renderer = new MainCanvas2DRenderer({
    aiVirtualBackgroundManager : {
      getRenderableState()
      {
        return {
          config          : { mode: 'color', backgroundColor: '#123456' },
          latestMask      : mask,
          latestFrame     : frozenFrame,
          backgroundImage : null,
          state           : state
        };
      },
      noteFrameRendered() {}
    }
  });

  renderer.init(outputCanvas);
  renderer._drawAiVirtualBackgroundItem({
    source              : source,
    video               : liveVideo,
    draw                : { x: 0, y: 0, width: 320, height: 180 },
    mirrorX             : false,
    aiVirtualBackground : { enabled: true, mode: 'color' }
  }, false, 320);

  const workDraws = state.workCanvas._context2d.operations.filter((operation) => operation.type === 'drawImage');

  assert.strictEqual(workDraws[0].args[0], frozenFrame);
  assert.strictEqual(workDraws[0].args[0] === liveVideo, false);
  assert.strictEqual(state.workCanvas._context2d.filter, 'none');
}


async function testMainWebGL2AiVirtualBackgroundComposesMaskAndSkipsFinalMirror()
{
  resetMockState();
  MockCanvasElement.webgl2Supported = true;

  const outputCanvas = new MockCanvasElement();
  const source = { slot: 0 };
  const liveVideo = new MockVideoElement();
  const frozenFrame = new MockCanvasElement();
  const mask = new MockCanvasElement();
  const state = {};
  const drawCalls = [];
  const renderer = new MainWebGL2Renderer({
    aiVirtualBackgroundManager : {
      getRenderableState()
      {
        return {
          config          : { mode: 'color', backgroundColor: '#123456' },
          latestMask      : mask,
          latestFrame     : frozenFrame,
          backgroundImage : null,
          state           : state
        };
      },
      noteFrameRendered() {}
    }
  });

  renderer.init(outputCanvas);
  renderer._drawItem = function(item, canvasHeight, outputMirrorX, outputWidth)
  {
    drawCalls.push({ item, canvasHeight, outputMirrorX, outputWidth });
  };
 
  renderer.render({
    width           : 320,
    height          : 180,
    outputMirrorX   : true,
    backgroundColor : '#000000',
    items           : [ {
      id                  : 'source-0',
      source              : source,
      video               : liveVideo,
      draw                : { x: 20, y: 0, width: 100, height: 80 },
      mirrorX             : false,
      aiVirtualBackground : { enabled: true, mode: 'color' }
    } ],
    sourceWatermarks : [],
    outputWatermarks : []
  });

  const operations = state.foregroundCanvas._context2d.operations;
  const mirroredDraws = operations.filter((operation) => operation.type === 'scale' && operation.x === -1 && operation.y === 1);
  const drawImages = operations.filter((operation) => operation.type === 'drawImage');

  assert.strictEqual(mirroredDraws.length, 2);
  assert.strictEqual(drawImages[0].args[0], frozenFrame);
  assert.strictEqual(drawImages[1].args[0], mask);
  assert.strictEqual(drawCalls.length, 1);
  assert.strictEqual(drawCalls[0].outputMirrorX, false);
  assert.strictEqual(drawCalls[0].item.draw.x, 200);
  assert.strictEqual(drawCalls[0].item.mirrorX, false);
}


async function testMainWebGL2AiVirtualBackgroundUsesMainThreadManager()
{
  resetMockState();
  MockCanvasElement.webgl2Supported = true;

  const source = createStream();
  let getRenderableStateCalls = 0;
  const mixer = new MediaEffectsComposer([ source ], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-webgl2',
    sources    : [
      {
        slot                : 0,
        aiVirtualBackground : {
          enabled  : true,
          mode     : 'image',
          imageUrl : 'background.png'
        }
      }
    ]
  });

  mixer._sourceAiVBManager.getRenderableState = function()
  {
    getRenderableStateCalls += 1;

    return null;
  };

  mixer.getVideoStream();
  mixer._drawVideosToCanvas(undefined, true);

  assert.strictEqual(mixer.getRenderInfo().actualMode, 'main-webgl2');
  assert.strictEqual(mixer.getRenderInfo().isWorker, false);
  assert.strictEqual(getRenderableStateCalls > 0, true);

  mixer.stop();
}

const TESTS = [
  { name: 'testOutputMirrorKeepsWorkerRendererWithAiVirtualBackground', fn: testOutputMirrorKeepsWorkerRendererWithAiVirtualBackground },
  { name: 'testSourceAiVBOptionsAppearInSourceSnapshot', fn: testSourceAiVBOptionsAppearInSourceSnapshot },
  { name: 'testSetSourceAiVirtualBackgroundLifecycle', fn: testSetSourceAiVirtualBackgroundLifecycle },
  { name: 'testSetSourceAiVirtualBackgroundKeepsMainWebGL2Renderer', fn: testSetSourceAiVirtualBackgroundKeepsMainWebGL2Renderer },
  { name: 'testSetSourceAiVirtualBackgroundKeepsWorkerRenderer', fn: testSetSourceAiVirtualBackgroundKeepsWorkerRenderer },
  { name: 'testOutputMirrorDoesNotPreloadAiVBBackgroundImage', fn: testOutputMirrorDoesNotPreloadAiVBBackgroundImage },
  { name: 'testMainCanvas2DAiVirtualBackgroundUsesMaskFramePair', fn: testMainCanvas2DAiVirtualBackgroundUsesMaskFramePair },
  { name: 'testMainWebGL2AiVirtualBackgroundComposesMaskAndSkipsFinalMirror', fn: testMainWebGL2AiVirtualBackgroundComposesMaskAndSkipsFinalMirror },
  { name: 'testMainWebGL2AiVirtualBackgroundUsesMainThreadManager', fn: testMainWebGL2AiVirtualBackgroundUsesMainThreadManager }
];

async function run(customSuiteName)
{
  const suiteName = customSuiteName || 'MediaEffectsComposer-Aivb';
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
