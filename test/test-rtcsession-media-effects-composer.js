/* eslint-disable no-console */
const { runSuite } = require('./include/manual-test-suite');
const {
  installGlobals,
  loadRTCSessionWithMockMixer,
  resetRtcSessionMediaEffectsTestState
} = require('./include/rtcsession-media-effects-test-helpers');
const pipeline = require('./test-rtcsession-media-effects-pipeline');
const switchDevice = require('./test-rtcsession-media-effects-switch-device');
const sdp = require('./test-rtcsession-media-effects-sdp');
const runtimeUpdate = require('./test-rtcsession-media-effects-runtime-update');

const TESTS = [
  ...pipeline.TESTS,
  ...switchDevice.TESTS,
  ...sdp.TESTS,
  ...runtimeUpdate.TESTS
];

async function run()
{
  const restoreGlobals = installGlobals();
  const restoreModules = loadRTCSessionWithMockMixer();

  try
  {
    return await runSuite({
      suiteName  : 'RTCSession-MediaEffectsComposer',
      tests      : TESTS,
      beforeEach : function()
      {
        resetRtcSessionMediaEffectsTestState();
      }
    });
  }
  finally
  {
    restoreModules();
    restoreGlobals();
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
