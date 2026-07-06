/* eslint-disable no-console */
const assert = require('assert');

let nextTrackId = 1;

class MockMediaStreamTrack
{
  constructor(kind)
  {
    this.kind = kind;
    this.id = `${kind}-${nextTrackId++}`;
    this.readyState = 'live';
  }
}

class MockMediaStream
{
  constructor(tracks)
  {
    this._tracks = (tracks || []).slice();
  }

  getTracks()
  {
    return this._tracks.slice();
  }

  getAudioTracks()
  {
    return this._tracks.filter((track) => track.kind === 'audio');
  }

  getVideoTracks()
  {
    return this._tracks.filter((track) => track.kind === 'video');
  }

  addTrack(track)
  {
    this._tracks.push(track);
  }
}

class MockAudioNode
{
  connect(target)
  {
    this.connectedTo = target;

    return target;
  }

  disconnect()
  {
    this.disconnected = true;
  }
}

class MockDestinationNode extends MockAudioNode
{
  constructor()
  {
    super();
    this.stream = new MockMediaStream([ new MockMediaStreamTrack('audio') ]);
  }
}

class MockAudioContext
{
  constructor(options = {})
  {
    this.sampleRate = options.sampleRate || 48000;
    this.state = 'suspended';
    this.closed = false;
    this.audioWorklet = {
      addModule : async(url) =>
      {
        MockAudioContext.addedModules.push(url);

        if (MockAudioContext.addModuleError)
        {
          throw MockAudioContext.addModuleError;
        }
      }
    };
    MockAudioContext.instances.push(this);
  }

  async resume()
  {
    this.state = 'running';
  }

  createMediaStreamDestination()
  {
    this.destination = new MockDestinationNode();

    return this.destination;
  }

  createMediaStreamSource(stream)
  {
    const node = new MockAudioNode();

    node.stream = stream;
    this.lastSourceStream = stream;

    return node;
  }

  async close()
  {
    this.closed = true;
    this.state = 'closed';
  }
}

MockAudioContext.instances = [];
MockAudioContext.addedModules = [];
MockAudioContext.addModuleError = null;

class MockAudioWorkletNode extends MockAudioNode
{
  constructor(audioContext, name, options)
  {
    super();
    this.audioContext = audioContext;
    this.name = name;
    this.options = options;
    this.port = {
      messages    : [],
      onmessage   : null,
      postMessage : (message) =>
      {
        this.port.messages.push(message);
      },
      emitMessage : (message) =>
      {
        if (typeof this.port.onmessage === 'function')
        {
          this.port.onmessage({ data: message });
        }
      }
    };
  }
}

class MockBlob
{
  constructor(parts, options = {})
  {
    this.parts = parts;
    this.type = options.type || '';
  }
}

function resetMockState()
{
  nextTrackId = 1;
  MockAudioContext.instances = [];
  MockAudioContext.addedModules = [];
  MockAudioContext.addModuleError = null;
}

function installBrowserMocks(options = {})
{
  const previous = {
    AudioContext     : global.AudioContext,
    AudioWorkletNode : global.AudioWorkletNode,
    MediaStream      : global.MediaStream,
    MediaStreamTrack : global.MediaStreamTrack,
    WebAssembly      : global.WebAssembly,
    Blob             : global.Blob,
    URL              : global.URL,
    fetch            : global.fetch
  };

  if (options.supported === false)
  {
    delete global.AudioContext;
    delete global.AudioWorkletNode;
    delete global.MediaStream;
    delete global.MediaStreamTrack;
    delete global.WebAssembly;
    delete global.Blob;
    delete global.URL;
    delete global.fetch;
  }
  else
  {
    global.AudioContext = MockAudioContext;
    global.AudioWorkletNode = MockAudioWorkletNode;
    global.MediaStream = MockMediaStream;
    global.MediaStreamTrack = MockMediaStreamTrack;
    global.WebAssembly = {};
    global.Blob = MockBlob;
    global.URL = {
      createObjectURL : () => 'blob:mock-ains-worklet',
      revokeObjectURL : () => {}
    };
    global.fetch = async(url) =>
    {
      if (typeof options.fetchImpl === 'function')
      {
        return options.fetchImpl(url);
      }

      return {
        ok          : true,
        status      : 200,
        statusText  : 'OK',
        arrayBuffer : async() => new ArrayBuffer(url.indexOf('.wasm') !== -1 ? 16 : 32)
      };
    };

    MockAudioContext.addModuleError = options.addModuleError || null;
  }

  return function restore()
  {
    Object.keys(previous).forEach((key) =>
    {
      if (previous[key] === undefined)
      {
        delete global[key];
      }
      else
      {
        global[key] = previous[key];
      }
    });
  };
}

function loadEngine()
{
  [
    '../lib/AiNoiseSuppression/AiNSEngine',
    '../lib/AiNoiseSuppression/AiNSWorkletRuntime',
    '../lib/AiNoiseSuppression/AiNSWorkletSource',
    '../lib/AiNoiseSuppression/AiNSConfig'
  ].forEach((id) =>
  {
    delete require.cache[require.resolve(id)];
  });

  return require('../lib/AiNoiseSuppression/AiNSEngine');
}

function createInputStream()
{
  const audioTrack = new MockMediaStreamTrack('audio');
  const videoTrack = new MockMediaStreamTrack('video');

  return {
    stream     : new MockMediaStream([ audioTrack, videoTrack ]),
    audioTrack : audioTrack,
    videoTrack : videoTrack
  };
}

function testCapabilityReportListsMissingRequirements()
{
  resetMockState();
  const restore = installBrowserMocks({ supported: false });

  try
  {
    const Engine = loadEngine();
    const report = Engine.getCapabilityReport();

    assert.strictEqual(report.supported, false);
    assert.ok(report.missing.indexOf('audioContext') !== -1);
    assert.ok(report.missing.indexOf('audioWorklet') !== -1);
  }
  finally
  {
    restore();
  }
}

async function testProcessBuildsProcessedStreamAndPreservesVideoTrack()
{
  resetMockState();
  const restore = installBrowserMocks();

  try
  {
    const Engine = loadEngine();
    const engine = new Engine({ noiseReductionLevel: 92, sampleRate: 44100 });
    const input = createInputStream();
    const output = await engine.process(input.stream);

    assert.strictEqual(output.getAudioTracks().length, 1);
    assert.strictEqual(output.getVideoTracks().length, 1);
    assert.strictEqual(output.getVideoTracks()[0], input.videoTrack);
    assert.strictEqual(engine.getOutputStream(), output);
    assert.strictEqual(engine.getCapabilityReport().supported, true);
    assert.strictEqual(engine.getCapabilityReport().runtime.initialized, true);
    assert.strictEqual(engine.getCapabilityReport().runtime.noiseReductionLevel, 92);
    assert.strictEqual(MockAudioContext.instances[0].lastSourceStream.getAudioTracks()[0], input.audioTrack);
    assert.strictEqual(engine.getProcessor().workletNode.options.channelCount, 1);
    assert.strictEqual(engine.getProcessor().workletNode.options.channelCountMode, 'explicit');
    assert.deepStrictEqual(engine.getProcessor().workletNode.options.outputChannelCount, [ 1 ]);

    await engine.destroy();
  }
  finally
  {
    restore();
  }
}

async function testReplaceAudioTrackPreservesVideoTrack()
{
  resetMockState();
  const restore = installBrowserMocks();

  try
  {
    const Engine = loadEngine();
    const engine = new Engine();
    const input = createInputStream();

    await engine.process(input.stream);

    const replacementAudio = new MockMediaStreamTrack('audio');
    const replaced = await engine.replaceAudioTrack(new MockMediaStream([ replacementAudio ]));

    assert.strictEqual(replaced.getVideoTracks()[0], input.videoTrack);
    assert.strictEqual(engine.inputStream.getAudioTracks()[0], replacementAudio);

    await engine.destroy();
  }
  finally
  {
    restore();
  }
}

async function testProcessFailsWhenAssetFetchFails()
{
  resetMockState();
  const issues = [];
  let fetchCount = 0;
  const restore = installBrowserMocks({
    fetchImpl : async() =>
    {
      fetchCount += 1;

      return {
        ok         : false,
        status     : 503,
        statusText : 'Service Unavailable'
      };
    }
  });

  try
  {
    const Engine = loadEngine();
    const engine = new Engine({
      onIssue : (issue) =>
      {
        issues.push(issue);
      }
    });

    await assert.rejects(async() =>
    {
      await engine.process(createInputStream().stream);
    }, /Failed to fetch asset/);
    assert.strictEqual(fetchCount, 2);
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].stage, 'asset-fetch');
    assert.strictEqual(issues[0].fallbackApplied, true);
    assert.strictEqual(issues[0].degraded, true);
    assert.strictEqual(engine.getIssues().length, 1);
    assert.strictEqual(engine.getLastIssue().stage, 'asset-fetch');
    assert.strictEqual(engine.getCapabilityReport().runtime.issueCount, 1);
  }
  finally
  {
    restore();
  }
}

async function testProcessFailsWhenWorkletRegistrationFails()
{
  resetMockState();
  const restore = installBrowserMocks({
    addModuleError : new Error('addModule failed')
  });

  try
  {
    const Engine = loadEngine();
    const engine = new Engine();

    await assert.rejects(async() =>
    {
      await engine.process(createInputStream().stream);
    }, /addModule failed/);
  }
  finally
  {
    restore();
  }
}

async function testWorkletPortWarningIsRecordedInEngineIssueHistory()
{
  resetMockState();
  const issues = [];
  const restore = installBrowserMocks();

  try
  {
    const Engine = loadEngine();
    const engine = new Engine({
      onIssue : (issue) =>
      {
        issues.push(issue);
      }
    });

    await engine.process(createInputStream().stream);
    engine.getProcessor().workletNode.port.emitMessage({
      type    : 'AINS_UNSUPPORTED_CHANNEL_LAYOUT',
      message : 'Bypassed AI noise suppression for unsupported multi-channel input',
      details : {
        inputChannelCount  : 2,
        outputChannelCount : 2
      }
    });

    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].stage, 'unsupported-channel-layout');
    assert.strictEqual(issues[0].severity, 'warn');
    assert.strictEqual(engine.getIssues().length, 1);
    assert.strictEqual(engine.getLastIssue().stage, 'unsupported-channel-layout');
    assert.strictEqual(engine.getLastIssue().details.inputChannelCount, 2);

    await engine.destroy();
  }
  finally
  {
    restore();
  }
}

async function run()
{
  let passed = 0;
  let failed = 0;
  const failures = [];
  const TESTS = [
    { name: 'testCapabilityReportListsMissingRequirements', fn: testCapabilityReportListsMissingRequirements },
    { name: 'testProcessBuildsProcessedStreamAndPreservesVideoTrack', fn: testProcessBuildsProcessedStreamAndPreservesVideoTrack },
    { name: 'testReplaceAudioTrackPreservesVideoTrack', fn: testReplaceAudioTrackPreservesVideoTrack },
    { name: 'testProcessFailsWhenAssetFetchFails', fn: testProcessFailsWhenAssetFetchFails },
    { name: 'testProcessFailsWhenWorkletRegistrationFails', fn: testProcessFailsWhenWorkletRegistrationFails },
    { name: 'testWorkletPortWarningIsRecordedInEngineIssueHistory', fn: testWorkletPortWarningIsRecordedInEngineIssueHistory }
  ];

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
      failures.push({
        name  : test.name,
        error : error
      });
    }
  }

  if (failed > 0)
  {
    console.log(`\n  AiNS Failures (${failed}):`);
    failures.forEach((failure, index) =>
    {
      console.log(`    ${index + 1}. ${failure.name}`);
      console.log(`       ${failure.error && failure.error.stack ? failure.error.stack : failure.error}`);
    });
  }

  console.log(`  AiNS Tests: ${passed} passed, ${failed} failed, ${TESTS.length} total`);

  if (failed > 0)
  {
    throw new Error(`${failed} AiNS test(s) failed`);
  }
}

module.exports = { run };
