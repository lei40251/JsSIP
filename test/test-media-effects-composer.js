/* eslint-disable no-console */
const { runSuite } = require('./include/manual-test-suite');
const { installBrowserMocks } = require('./include/media-effects-composer-test-helpers');
const audio = require('./test-media-effects-composer-audio');
const watermarkMirror = require('./test-media-effects-composer-watermark-mirror');
const aivb = require('./test-media-effects-composer-aivb');
const renderer = require('./test-media-effects-composer-renderer');

const TESTS = [
  ...audio.TESTS,
  ...watermarkMirror.TESTS,
  ...aivb.TESTS,
  ...renderer.TESTS
];

async function run()
{
  const restoreBrowserMocks = installBrowserMocks();

  try
  {
    return await runSuite({
      suiteName : 'MediaEffectsComposer',
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
