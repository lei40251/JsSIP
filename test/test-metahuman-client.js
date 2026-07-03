/* eslint-disable no-console */
const { runSuite } = require('./include/manual-test-suite');
const {
  assert,
  MockMediaStreamTrack,
  MockMediaStream,
  MockAiNSEngine,
  resetRtcSessionMediaEffectsTestState
} = require('./include/rtcsession-media-effects-test-helpers');

MockAiNSEngine.isSupported = () => true;

async function expectRejected(promise, expectedMessage)
{
  let error = null;

  try
  {
    await promise;
  }
  catch (err)
  {
    error = err;
  }

  assert.ok(error, 'expected promise to reject');
  if (expectedMessage !== undefined)
  {
    assert.strictEqual(error.message, expectedMessage);
  }
}

function installGlobals()
{
  const snapshot = {
    MediaStream : global.MediaStream,
    navigator   : global.navigator,
    fetch       : global.fetch
  };

  global.MediaStream = MockMediaStream;
  global.navigator = {
    mediaDevices : {
      getUserMedia : () => Promise.resolve(new MockMediaStream())
    }
  };
  global.fetch = () => Promise.reject(new Error('fetch should not be called'));

  return () =>
  {
    global.MediaStream = snapshot.MediaStream;
    global.navigator = snapshot.navigator;
    global.fetch = snapshot.fetch;
  };
}

function loadMetaHumanClientWithMockAiNS()
{
  const aiNSPath = require.resolve('../lib/AiNoiseSuppression/AiNSEngine');
  const clientPath = require.resolve('../lib/MetaHumanClient');
  const aiNSCache = require.cache[aiNSPath];
  const clientCache = require.cache[clientPath];

  require.cache[aiNSPath] = {
    id       : aiNSPath,
    filename : aiNSPath,
    loaded   : true,
    exports  : MockAiNSEngine
  };
  delete require.cache[clientPath];

  return () =>
  {
    if (aiNSCache)
    {
      require.cache[aiNSPath] = aiNSCache;
    }
    else
    {
      delete require.cache[aiNSPath];
    }

    if (clientCache)
    {
      require.cache[clientPath] = clientCache;
    }
    else
    {
      delete require.cache[clientPath];
    }
  };
}

async function testConnectDisablesNativeNoiseSuppressionForAiNS()
{
  const MetaHumanClient = require('../lib/MetaHumanClient');
  let capturedConstraints = null;

  global.navigator.mediaDevices.getUserMedia = (constraints) =>
  {
    capturedConstraints = constraints;

    return Promise.reject(new Error('stop-after-capture'));
  };

  const client = new MetaHumanClient({
    server             : 'https://example.com',
    aiNoiseSuppression : {}
  });

  client.on('error', () => {});

  await expectRejected(client.connect(), 'stop-after-capture');

  assert.ok(capturedConstraints);
  assert.strictEqual(capturedConstraints.audio.noiseSuppression, false);
  assert.strictEqual(capturedConstraints.audio.sampleRate, 48000);
}

async function testConnectKeepsExplicitMetaHumanAudioDefaultsWithoutAiNS()
{
  const MetaHumanClient = require('../lib/MetaHumanClient');
  let capturedConstraints = null;

  global.navigator.mediaDevices.getUserMedia = (constraints) =>
  {
    capturedConstraints = constraints;

    return Promise.reject(new Error('stop-after-capture'));
  };

  const client = new MetaHumanClient({
    server : 'https://example.com'
  });

  client.on('error', () => {});

  await expectRejected(client.connect(), 'stop-after-capture');

  assert.ok(capturedConstraints);
  assert.strictEqual(capturedConstraints.audio.sampleRate, 48000);
  assert.strictEqual(capturedConstraints.audio.channelCount, 1);
  assert.strictEqual(capturedConstraints.audio.echoCancellation, true);
  assert.strictEqual(capturedConstraints.audio.autoGainControl, true);
  assert.strictEqual(capturedConstraints.audio.noiseSuppression, true);
}

async function testUpdateConfigRecomputesAudioConstraintsForAiNS()
{
  const MetaHumanClient = require('../lib/MetaHumanClient');
  let capturedConstraints = null;

  global.navigator.mediaDevices.getUserMedia = (constraints) =>
  {
    capturedConstraints = constraints;

    return Promise.reject(new Error('stop-after-capture'));
  };

  const client = new MetaHumanClient({
    server : 'https://example.com'
  });

  client.on('error', () => {});

  client.updateConfig({ aiNoiseSuppression: {} });
  await expectRejected(client.connect(), 'stop-after-capture');
  assert.strictEqual(capturedConstraints.audio.noiseSuppression, false);

  client.updateConfig({ aiNoiseSuppression: null });
  await expectRejected(client.connect(), 'stop-after-capture');
  assert.strictEqual(capturedConstraints.audio.noiseSuppression, true);
}

async function testApplyAiNoiseSuppressionForwardsIssueEventAndSampleRate()
{
  const MetaHumanClient = require('../lib/MetaHumanClient');
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('audio') ]);
  const issues = [];

  MockAiNSEngine.issueOnProcess = (engine) =>
  {
    engine.onIssue({
      module          : 'AiNS',
      component       : 'MockAiNSEngine',
      stage           : 'mock-process',
      severity        : 'warn',
      message         : 'mock ai noise suppression issue',
      fallbackApplied : true,
      degraded        : true
    });
  };

  const client = new MetaHumanClient({
    server             : 'https://example.com',
    audioConstraints   : { sampleRate: 32000 },
    aiNoiseSuppression : {}
  });

  client.on('mediaEffectsIssue', (issue) => issues.push(issue));

  const result = await client._applyAiNoiseSuppression(sourceStream);

  assert.strictEqual(result, sourceStream);
  assert.strictEqual(MockAiNSEngine.instances.length, 1);
  assert.strictEqual(MockAiNSEngine.instances[0].options.sampleRate, 32000);
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].stage, 'mock-process');
  assert.strictEqual(issues[0].message, 'mock ai noise suppression issue');
}

async function testApplyAiNoiseSuppressionEmitsFallbackIssueOnFailure()
{
  const MetaHumanClient = require('../lib/MetaHumanClient');
  const sourceStream = new MockMediaStream([ new MockMediaStreamTrack('audio') ]);
  const issues = [];

  MockAiNSEngine.transform = () =>
  {
    throw new Error('mock process failure');
  };

  const client = new MetaHumanClient({
    server             : 'https://example.com',
    aiNoiseSuppression : {}
  });

  client.on('mediaEffectsIssue', (issue) => issues.push(issue));

  const result = await client._applyAiNoiseSuppression(sourceStream);

  assert.strictEqual(result, sourceStream);
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].stage, 'apply-ai-noise-suppression');
  assert.strictEqual(issues[0].message, 'mock process failure');
  assert.strictEqual(issues[0].degraded, true);
  assert.strictEqual(MockAiNSEngine.destroyCalls, 1);
}

async function run()
{
  let restoreGlobals = null;
  let restoreModules = null;

  try
  {
    await runSuite({
      suiteName  : 'MetaHumanClient',
      beforeEach : async() =>
      {
        if (restoreGlobals)
        {
          restoreGlobals();
          restoreGlobals = null;
        }
        if (restoreModules)
        {
          restoreModules();
          restoreModules = null;
        }

        resetRtcSessionMediaEffectsTestState();
        restoreGlobals = installGlobals();
        restoreModules = loadMetaHumanClientWithMockAiNS();
      },
      tests : [
        { name: 'testConnectDisablesNativeNoiseSuppressionForAiNS', fn: testConnectDisablesNativeNoiseSuppressionForAiNS },
        { name: 'testConnectKeepsExplicitMetaHumanAudioDefaultsWithoutAiNS', fn: testConnectKeepsExplicitMetaHumanAudioDefaultsWithoutAiNS },
        { name: 'testUpdateConfigRecomputesAudioConstraintsForAiNS', fn: testUpdateConfigRecomputesAudioConstraintsForAiNS },
        { name: 'testApplyAiNoiseSuppressionForwardsIssueEventAndSampleRate', fn: testApplyAiNoiseSuppressionForwardsIssueEventAndSampleRate },
        { name: 'testApplyAiNoiseSuppressionEmitsFallbackIssueOnFailure', fn: testApplyAiNoiseSuppressionEmitsFallbackIssueOnFailure }
      ]
    });
  }
  finally
  {
    if (restoreGlobals)
    {
      restoreGlobals();
    }
    if (restoreModules)
    {
      restoreModules();
    }
  }
}

module.exports = { run };
