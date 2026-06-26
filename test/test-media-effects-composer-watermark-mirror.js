/* eslint-disable no-console */
const { runSuite } = require('./include/manual-test-suite');
const {
  assert,
  MediaEffectsComposer,
  ComposerConfig,
  Watermark,
  MockCanvasElement,
  MockWorker,
  installBrowserMocks,
  resetMockState,
  createStream,
  flushAsync,
  assertRejects
} = require('./include/media-effects-composer-test-helpers');

async function testWatermarkConfigAndFiltering()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], {
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

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-2d' });
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

  const mixer = new MediaEffectsComposer([], { width: 320, height: 180, fps: 15, renderMode: 'main-webgl2' });
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

  const mixer = new MediaEffectsComposer([], {
    width        : 320,
    height       : 180,
    fps          : 15,
    renderMode   : 'main-2d',
    sourceMirror : true
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
  assert.deepStrictEqual(mixer.getSourceMirror(), { global: true, overrides: {} });
  assert.strictEqual(mixer.getSources()[0].sourceMirror, null);
  assert.strictEqual(mixer.getSourceMirror(0).effective, true);

  mixer.setSourceMirror(0, false);
  mixer._canvas._context2d.operations = [];
  mixer._drawVideosToCanvas(undefined, true);
  outputContext = mixer._canvas._context2d;
  mirroredOps = outputContext.operations.filter((operation) =>
  {
    return operation.type === 'scale' && operation.x === -1 && operation.y === 1;
  });
  assert.strictEqual(mirroredOps.length, 0);

  mixer.setSourceMirror(0, true);
  assert.deepStrictEqual(mixer.getSourceMirror(), { global: true, overrides: { '0': true } });
  assert.deepStrictEqual(mixer.getSourceMirror(0), { slot: 0, global: true, override: true, effective: true });

  mixer._canvas._context2d.operations = [];
  mixer._drawVideosToCanvas(undefined, true);
  outputContext = mixer._canvas._context2d;
  mirroredOps = outputContext.operations.filter((operation) =>
  {
    return operation.type === 'scale' && operation.x === -1 && operation.y === 1;
  });
  assert.strictEqual(mirroredOps.length, 1);

  mixer.clearSourceMirror(0);
  assert.deepStrictEqual(mixer.getSourceMirror(), { global: true, overrides: {} });

  mixer.stop();
  assert.throws(() => mixer.setSourceMirror(true), /has been stopped/);
}


async function testMirrorAutoModeKeepsWorkerRenderer()
{
  resetMockState();
  MockCanvasElement.webgl2Supported = true;

  const mixer = new MediaEffectsComposer([], {
    width        : 320,
    height       : 180,
    fps          : 15,
    renderMode   : 'auto',
    sourceMirror : true
  });

  mixer.appendStream(createStream(), 0);
  mixer.getVideoStream();
  mixer._drawVideosToCanvas(undefined, true);

  const info = mixer.getRenderInfo();

  assert.strictEqual(MockWorker.instances.length, 1);
  assert.strictEqual(info.isWorker, true);
  assert.strictEqual(info.actualMode, 'worker-init');

  mixer.stop();
}


async function testEnableMirrorKeepsCurrentRendererUntilFailure()
{
  resetMockState();
  MockCanvasElement.webgl2Supported = true;

  const mixer = new MediaEffectsComposer([], {
    width        : 320,
    height       : 180,
    fps          : 15,
    renderMode   : 'auto',
    sourceMirror : false
  });

  mixer.appendStream(createStream(), 0);
  mixer.getVideoStream();
  mixer._drawVideosToCanvas(undefined, true);

  assert.strictEqual(MockWorker.instances.length, 1);
  assert.strictEqual(mixer.getRenderInfo().isWorker, true);

  mixer.setSourceMirror(true);

  const info = mixer.getRenderInfo();

  assert.strictEqual(info.actualMode, 'worker-init');
  assert.strictEqual(info.isWorker, true);
  assert.deepStrictEqual(mixer.getSourceMirror(), { global: true, overrides: {} });

  mixer.stop();
}


async function testClearSourceMirrorWithoutSlotClearsAllOverrides()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], {
    width        : 320,
    height       : 180,
    fps          : 15,
    renderMode   : 'main-2d',
    sourceMirror : true
  });

  mixer.appendStream(createStream(), 0);
  mixer.appendStream(createStream(), 1);
  mixer.setSourceMirror(0, false);
  mixer.setSourceMirror(1, true);

  assert.deepStrictEqual(mixer.getSourceMirror(), {
    global    : true,
    overrides : { '0': false, '1': true }
  });

  mixer.clearSourceMirror();

  assert.deepStrictEqual(mixer.getSourceMirror(), { global: true, overrides: {} });
  mixer.stop();
}


async function testOutputMirrorFlipsWholeComposedFrame()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d'
  });

  mixer.appendStream(createStream(), 0);
  mixer.getVideoStream();

  mixer.setMirror(true);
  assert.strictEqual(mixer.getMirror(), true);

  mixer._canvas._context2d.operations = [];
  mixer._drawVideosToCanvas(undefined, true);

  const outputContext = mixer._canvas._context2d;
  const mirroredOps = outputContext.operations.filter((operation) =>
  {
    return operation.type === 'scale' && operation.x === -1 && operation.y === 1;
  });

  assert.strictEqual(mirroredOps.length, 1);

  mixer.stop();
  assert.throws(() => mixer.setMirror(true), /has been stopped/);
}


async function testOutputMirrorCanDisableWatermarkMirroring()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], {
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
  mixer.setMirror(true);
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


async function testLegacyAsyncSettersReturnPromises()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d'
  });

  mixer.appendStream(createStream(), 0);

  const mirrorResult = mixer.setMirror(true);
  const sourceMirrorResult = mixer.setSourceMirror(0, true);
  const watermarkClearResult = mixer.clearWatermarks();

  assert.ok(mirrorResult && typeof mirrorResult.then === 'function');
  assert.ok(sourceMirrorResult && typeof sourceMirrorResult.then === 'function');
  assert.ok(watermarkClearResult && typeof watermarkClearResult.then === 'function');

  await Promise.all([ mirrorResult, sourceMirrorResult, watermarkClearResult ]);
  mixer.stop();
}


async function testCapabilityReportExposesRenderAndAudioRoute()
{
  resetMockState();

  const mixer = new MediaEffectsComposer([ createStream({ audio: true }) ], {
    width      : 320,
    height     : 180,
    fps        : 15,
    renderMode : 'main-2d'
  });

  await mixer.getAudioStream();
  mixer.getVideoStream();

  const report = mixer.getCapabilityReport();

  assert.strictEqual(report.limits.maxSources, ComposerConfig.getMaxSources());
  assert.strictEqual(report.features.multiSource, true);
  assert.strictEqual(report.features.audioSubmix, true);
  assert.strictEqual(report.render.actualMode, mixer.getRenderInfo().actualMode);
  assert.strictEqual(report.audio.status, mixer.getAudioInfo().status);

  mixer.stop();
}


async function testSourceMirrorKeepsWorkerRenderer()
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

  assert.strictEqual(mixer.getRenderInfo().isWorker, true);
  assert.strictEqual(mixer.getRenderInfo().actualMode, 'worker-init');

  mixer.setSourceMirror(true);

  assert.strictEqual(mixer.getRenderInfo().isWorker, true);
  assert.strictEqual(mixer.getRenderInfo().actualMode, 'worker-init');

  mixer.stop();
}


async function testWatermarkPresetAndCoordinatePositions()
{
  resetMockState();

  const manager = new Watermark();

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

const TESTS = [
  { name: 'testWatermarkConfigAndFiltering', fn: testWatermarkConfigAndFiltering },
  { name: 'testCanvas2DWatermarkDrawOrder', fn: testCanvas2DWatermarkDrawOrder },
  { name: 'testMainWebGL2WatermarkOpacity', fn: testMainWebGL2WatermarkOpacity },
  { name: 'testMirrorGlobalAndSlotControls', fn: testMirrorGlobalAndSlotControls },
  { name: 'testMirrorAutoModeKeepsWorkerRenderer', fn: testMirrorAutoModeKeepsWorkerRenderer },
  { name: 'testEnableMirrorKeepsCurrentRendererUntilFailure', fn: testEnableMirrorKeepsCurrentRendererUntilFailure },
  { name: 'testClearSourceMirrorWithoutSlotClearsAllOverrides', fn: testClearSourceMirrorWithoutSlotClearsAllOverrides },
  { name: 'testOutputMirrorFlipsWholeComposedFrame', fn: testOutputMirrorFlipsWholeComposedFrame },
  { name: 'testOutputMirrorCanDisableWatermarkMirroring', fn: testOutputMirrorCanDisableWatermarkMirroring },
  { name: 'testLegacyAsyncSettersReturnPromises', fn: testLegacyAsyncSettersReturnPromises },
  { name: 'testCapabilityReportExposesRenderAndAudioRoute', fn: testCapabilityReportExposesRenderAndAudioRoute },
  { name: 'testSourceMirrorKeepsWorkerRenderer', fn: testSourceMirrorKeepsWorkerRenderer },
  { name: 'testWatermarkPresetAndCoordinatePositions', fn: testWatermarkPresetAndCoordinatePositions }
];

async function run(customSuiteName)
{
  const suiteName = customSuiteName || 'MediaEffectsComposer-WatermarkMirror';
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
