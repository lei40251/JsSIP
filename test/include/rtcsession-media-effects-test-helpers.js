/* eslint-disable no-console */
const assert = require('assert');
let trackSeed = 0;

class MockMediaStreamTrack
{
  constructor(kind, settings)
  {
    this.kind = kind;
    this.id = `${kind}-${++trackSeed}`;
    this.readyState = 'live';
    // 模拟浏览器 Track 的 contentHint 字段，覆盖 composer 输出轨和 confirmed 阶段逻辑。
    this.contentHint = '';
    this._settings = Object.assign({}, settings || {});
  }

  getSettings()
  {
    return Object.assign({}, this._settings);
  }

  stop()
  {
    this.readyState = 'ended';
  }

  addEventListener() {}

  removeEventListener() {}
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

  removeTrack(track)
  {
    const index = this._tracks.indexOf(track);

    if (index >= 0)
    {
      this._tracks.splice(index, 1);
    }
  }
}

class MockMixer
{
  constructor(streams, options)
  {
    this.streams = streams;
    this.options = options;
    this.onIssue = options && typeof options.onIssue === 'function' ? options.onIssue : null;

    const primarySourceOptions = options && options.sources && options.sources[0] ?
      options.sources[0] :
      null;

    this.aiBackground = options &&
      primarySourceOptions &&
      primarySourceOptions.aiBackground ?
      primarySourceOptions.aiBackground :
      null;
    this.sourceMirrorState = primarySourceOptions && typeof primarySourceOptions.sourceMirror === 'boolean' ?
      primarySourceOptions.sourceMirror :
      false;
    this.configState = {
      outputMirror          : Boolean(options && options.mirror),
      sourceMirror          : Boolean(options && options.sourceMirror),
      sourceMirrorOverrides : {},
      mirrorWatermarks      : options && Object.prototype.hasOwnProperty.call(options, 'mirrorWatermarks') ?
        Boolean(options.mirrorWatermarks) :
        true,
      watermarks : options && options.watermarks ? [].concat(options.watermarks) : []
    };
    this.stopped = false;
    this.outputTrack = new MockMediaStreamTrack('video', { width: 640, height: 360, frameRate: 24 });
    this.outputAudioTrack = new MockMediaStreamTrack('audio');
    MockMixer.instances.push(this);
  }

  async getOutput(options)
  {
    this.outputRequest = options;

    if (typeof MockMixer.issueOnGetOutput === 'function')
    {
      MockMixer.issueOnGetOutput(this);
    }

    if (options && options.type === 'audio')
    {
      return new MockMediaStream([ this.outputAudioTrack ]);
    }

    if (options && options.type === 'mixed')
    {
      return new MockMediaStream([ this.outputAudioTrack, this.outputTrack ]);
    }

    return new MockMediaStream([ this.outputTrack ]);
  }

  removeSource(stream)
  {
    this.removed = stream;
    MockMixer.removeCalls.push(stream);
    if (MockMixer.throwOnRemove)
    {
      throw new Error('remove failed');
    }
  }

  addSource(stream, options)
  {
    this.appended = stream;
    this.appendedOptions = options || null;
    if (options && Object.prototype.hasOwnProperty.call(options, 'aiBackground'))
    {
      this.aiBackground = options.aiBackground;
    }
    if (options && typeof options.sourceMirror === 'boolean')
    {
      this.sourceMirrorState = options.sourceMirror;
    }
    MockMixer.appendCalls.push(stream);
    MockMixer.appendOptionCalls.push(options || null);
    if (MockMixer.throwOnAppend)
    {
      throw new Error('append failed');
    }
  }

  getAiBackground()
  {
    return this.aiBackground;
  }

  setAiBackground(slotOrTarget, options)
  {
    this.aiBackground = options;

    return this.aiBackground;
  }

  clearAiBackground()
  {
    this.aiBackground = null;
  }

  getSourceMirror(slot)
  {
    return {
      slot      : slot,
      global    : false,
      override  : null,
      effective : Boolean(this.sourceMirrorState)
    };
  }

  setSourceMirror(slotOrEnabled, enabled)
  {
    if (typeof slotOrEnabled === 'boolean' && enabled === undefined)
    {
      this.configState.sourceMirror = slotOrEnabled;
      this.sourceMirrorState = slotOrEnabled;

      return;
    }

    this.configState.sourceMirrorOverrides[String(slotOrEnabled)] = Boolean(enabled);
    this.sourceMirrorState = Boolean(enabled);
  }

  async setConfig(patch)
  {
    if (Object.prototype.hasOwnProperty.call(patch, 'outputMirror'))
    {
      this.configState.outputMirror = Boolean(patch.outputMirror);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'mirrorWatermarks'))
    {
      this.configState.mirrorWatermarks = Boolean(patch.mirrorWatermarks);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'watermarks'))
    {
      this.configState.watermarks = patch.watermarks ? [].concat(patch.watermarks) : [];
    }

    return this.getState().config;
  }

  getState()
  {
    return {
      sources : [
        {
          slot         : 0,
          sourceMirror : this.sourceMirrorState,
          aiBackground : this.aiBackground
        }
      ],
      config : {
        outputMirror          : this.configState.outputMirror,
        sourceMirror          : this.configState.sourceMirror,
        sourceMirrorOverrides : Object.assign({}, this.configState.sourceMirrorOverrides),
        mirrorWatermarks      : this.configState.mirrorWatermarks,
        watermarks            : this.configState.watermarks.slice()
      }
    };
  }

  getRenderInfo()
  {
    return this.renderInfo || {
      actualMode : 'worker-2d',
      isWorker   : true
    };
  }

  stop()
  {
    this.stopped = true;
    MockMixer.stopCalls += 1;
  }
}

MockMixer.instances = [];
MockMixer.stopCalls = 0;
MockMixer.removeCalls = [];
MockMixer.appendCalls = [];
MockMixer.appendOptionCalls = [];
MockMixer.throwOnRemove = false;
MockMixer.throwOnAppend = false;
MockMixer.issueOnGetOutput = null;

class MockAiNSEngine
{
  constructor(options)
  {
    this.options = options;
    this.onIssue = options && typeof options.onIssue === 'function' ? options.onIssue : null;
    this.processCalls = [];
    this.replaceAudioTrackCalls = [];
    this.destroyed = false;
    MockAiNSEngine.instances.push(this);
  }

  async process(stream)
  {
    this.processCalls.push(stream);

    if (typeof MockAiNSEngine.issueOnProcess === 'function')
    {
      MockAiNSEngine.issueOnProcess(this, stream);
    }

    if (MockAiNSEngine.transform)
    {
      return MockAiNSEngine.transform(stream, this);
    }

    return stream;
  }

  async replaceTrack(stream)
  {
    this.replaceAudioTrackCalls.push(stream);

    if (MockAiNSEngine.replaceAudioTrackTransform)
    {
      return MockAiNSEngine.replaceAudioTrackTransform(stream, this);
    }

    return stream;
  }

  async destroy()
  {
    this.destroyed = true;
    MockAiNSEngine.destroyCalls += 1;
  }
}

MockAiNSEngine.instances = [];
MockAiNSEngine.destroyCalls = 0;
MockAiNSEngine.transform = null;
MockAiNSEngine.replaceAudioTrackTransform = null;
MockAiNSEngine.issueOnProcess = null;

function createMockUA()
{
  return {
    configuration : {
      session_timers                : false,
      session_timers_refresh_method : 'UPDATE'
    },
    sk                : [ '', '', '', '', '', '', '', '3', 'example.com' ],
    destroyRTCSession : function() {}
  };
}

function installGlobals()
{
  const snapshot = {
    MediaStream         : global.MediaStream,
    navigatorDescriptor : Object.getOwnPropertyDescriptor(global, 'navigator'),
    document            : global.document,
    window              : global.window
  };

  global.MediaStream = MockMediaStream;
  // Node 22 的 global.navigator 没有 setter，普通赋值不会替换原生 Navigator。
  Object.defineProperty(global, 'navigator', {
    configurable : true,
    enumerable   : true,
    writable     : true,
    value        : {
      userAgent    : 'unit-test',
      mediaDevices : {
        getUserMedia : () => Promise.resolve(new MockMediaStream())
      }
    }
  });
  global.document = {
    hidden           : false,
    addEventListener : function() {}
  };
  global.window = global.window || {};

  return () =>
  {
    global.MediaStream = snapshot.MediaStream;

    if (snapshot.navigatorDescriptor)
    {
      Object.defineProperty(global, 'navigator', snapshot.navigatorDescriptor);
    }
    else
    {
      delete global.navigator;
    }

    global.document = snapshot.document;
    global.window = snapshot.window;
  };
}

function loadRTCSessionWithMockMixer()
{
  const mixerPath = require.resolve('../../lib/MediaEffectsComposer/MediaEffectsComposer');
  const aiNSPath = require.resolve('../../lib/AiNoiseSuppression/AiNSEngine');
  const rtcSessionPath = require.resolve('../../lib/RTCSession');
  const mixerCache = require.cache[mixerPath];
  const aiNSCache = require.cache[aiNSPath];
  const rtcCache = require.cache[rtcSessionPath];

  require.cache[mixerPath] = {
    id       : mixerPath,
    filename : mixerPath,
    loaded   : true,
    exports  : MockMixer
  };
  require.cache[aiNSPath] = {
    id       : aiNSPath,
    filename : aiNSPath,
    loaded   : true,
    exports  : MockAiNSEngine
  };
  delete require.cache[rtcSessionPath];

  return () =>
  {
    if (mixerCache)
    {
      require.cache[mixerPath] = mixerCache;
    }
    else
    {
      delete require.cache[mixerPath];
    }

    if (aiNSCache)
    {
      require.cache[aiNSPath] = aiNSCache;
    }
    else
    {
      delete require.cache[aiNSPath];
    }

    if (rtcCache)
    {
      require.cache[rtcSessionPath] = rtcCache;
    }
    else
    {
      delete require.cache[rtcSessionPath];
    }
  };
}

function resetRtcSessionMediaEffectsTestState()
{
  MockMixer.instances = [];
  MockMixer.stopCalls = 0;
  MockMixer.removeCalls = [];
  MockMixer.appendCalls = [];
  MockMixer.appendOptionCalls = [];
  MockMixer.throwOnRemove = false;
  MockMixer.throwOnAppend = false;
  MockMixer.issueOnGetOutput = null;
  MockAiNSEngine.instances = [];
  MockAiNSEngine.destroyCalls = 0;
  MockAiNSEngine.transform = null;
  MockAiNSEngine.replaceAudioTrackTransform = null;
  MockAiNSEngine.issueOnProcess = null;
}

module.exports = {
  assert,
  MockMediaStreamTrack,
  MockMediaStream,
  MockMixer,
  MockAiNSEngine,
  createMockUA,
  installGlobals,
  loadRTCSessionWithMockMixer,
  resetRtcSessionMediaEffectsTestState
};
