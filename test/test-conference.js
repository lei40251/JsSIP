/* eslint-disable no-console, key-spacing, prefer-rest-params */

require('./include/common');

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RTCSession = require('../lib/RTCSession');

class MockMediaStream
{
  constructor(tracks)
  {
    this._tracks = (tracks || []).slice();
    this.id = `stream-${Math.random()}`;
  }

  getTracks() { return this._tracks.slice(); }
  getAudioTracks() { return this._tracks.filter((track) => track.kind === 'audio'); }
  getVideoTracks() { return this._tracks.filter((track) => track.kind === 'video'); }
  addTrack(track) { if (!this._tracks.includes(track)) this._tracks.push(track); }
  removeTrack(track) { this._tracks = this._tracks.filter((item) => item !== track); }
}

function createElement()
{
  return {
    value         : '7305',
    checked       : false,
    disabled      : false,
    textContent   : '',
    selectedIndex : 0,
    options       : [ { value: 'detail' } ],
    children      : [],
    dataset       : {},
    classList     : {
      add    : function() {},
      remove : function() {},
      toggle : function() {}
    },
    appendChild : function(child) { this.children.push(child); },
    remove      : function() {},
    setAttribute : function() {},
    play        : function() { return Promise.resolve(); }
  };
}

function loadConferenceDemo()
{
  const elements = new Map();
  const statuses = [];
  const capturedCalls = [];
  const document = {
    body : { appendChild: function() {} },
    querySelector : function(selector)
    {
      if (!elements.has(selector)) elements.set(selector, createElement());

      return elements.get(selector);
    },
    createElement : function() { return createElement(); }
  };
  const context = {
    console,
    Promise,
    Map,
    Set,
    JSON,
    Math,
    Date,
    Error,
    String,
    Boolean,
    Array,
    Object,
    setTimeout,
    clearTimeout,
    MediaStream : MockMediaStream,
    document,
    navigator : {
      userAgent    : 'conference-test',
      mediaDevices : {}
    },
    CRTC : {
      Utils : {
        closeMediaStream : function(stream)
        {
          if (stream) stream.getTracks().forEach((track) => track.stop && track.stop());
        },
        getStreams : function()
        {
          return { audioStream: new MockMediaStream(), videoStream: new MockMediaStream() };
        }
      }
    },
    extraFeatures                  : [],
    appMode                       : 'conference',
    pcConfig                       : {},
    xdata                          : '',
    sipDomain                      : 'example.test',
    rtcSession                     : null,
    statsSession                   : null,
    camFlag                        : true,
    noremb                         : false,
    localVideo                     : createElement(),
    remoteVideo                    : createElement(),
    buildCallComposerOptions       : function() { return {}; },
    buildCallAiNsOptions           : function() { return null; },
    buildSelectedAudioConstraints  : function() { return true; },
    buildSelectedVideoConstraints  : function() { return true; },
    handleSessionMediaEffectsIssue : function() {},
    bindMediaStreamIfChanged       : function() {},
    showIncomingCallNotification   : function() {},
    closeIncomingCallNotification  : function() {},
    setStatus                      : function(value) { statuses.push(value); },
    ua : {
      configuration : { no_answer_timeout: 1000 },
      isRegistered  : function() { return true; },
      call          : function(target, options)
      {
        capturedCalls.push({ target, options });

        return Promise.resolve({});
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../demo/base-js/js/app-conference.js'), 'utf8'),
    context,
    { filename: 'app-conference.js' }
  );

  context.elements = elements;
  context.statuses = statuses;
  context.capturedCalls = capturedCalls;

  return context;
}

function createConferenceRequest(headers)
{
  const normalized = {};

  Object.keys(headers).forEach((name) => { normalized[name.toLowerCase()] = headers[name]; });

  return {
    body      : '',
    from      : { uri: { user: '7302' } },
    to        : { uri: { user: '7305' } },
    getHeader : function(name) { return normalized[String(name).toLowerCase()] || null; }
  };
}

function createAnswerSession(overrides)
{
  const replies = [];
  const session = {
    _id             : 'answer-test',
    _ua             : { configuration: {}, sk: null },
    _status         : RTCSession.C.STATUS_WAITING_FOR_ANSWER,
    _direction      : 'incoming',
    _request        : {
      parseSDP : function() { return { media: [ { type: 'audio', direction: 'sendrecv' } ] }; },
      reply    : function() { replies.push(Array.prototype.slice.call(arguments)); },
      body     : ''
    },
    _contact         : '<sip:test@example.test>',
    _sessionTimers   : { enabled: false },
    _timers          : { userNoAnswerTimer: null },
    _mediaPipeline   : {
      resolveMediaEffectsComposerOptions : function() { return null; },
      stopSessionAiNoiseSuppression      : function() {}
    },
    _bfcp : {
      enabled : false,
      init    : function() {}
    },
    _createDialog     : function() { return true; },
    _failed           : function(originator, message, cause)
    {
      this.failedCause = cause;
      this._status = RTCSession.C.STATUS_TERMINATED;
    },
    local_identity  : { uri: { user: '7305' } },
    remote_identity : { uri: { user: '7302' } },
    _data            : {},
    _late_sdp        : true,
    _connecting      : function() {},
    _connectionPromiseQueue : Promise.resolve()
  };

  Object.assign(session, overrides || {});
  session.replies = replies;

  return session;
}

module.exports = {
  'page defers UA creation and selects exactly one session handler' : function(test)
  {
    const source = fs.readFileSync(path.join(__dirname, '../demo/base-js/js/app.js'), 'utf8');
    const conferenceSource = fs.readFileSync(path.join(__dirname, '../demo/base-js/js/app-conference.js'), 'utf8');

    test.ok(source.includes('let ua = null;'));
    test.ok(source.includes('function initializeDemoMode(mode)'));
    test.ok(source.includes('register                         : true'));
    test.strictEqual(source.includes("handleGetQuery('register')"), false);
    test.strictEqual((source.match(/ua\.on\('newRTCSession'/g) || []).length, 1);
    test.strictEqual((conferenceSource.match(/ua\.on\('newRTCSession'/g) || []).length, 0);
    test.done();
  },

  'conference assigns B then C by slot instead of SIP role headers' : function(test)
  {
    const context = loadConferenceDemo();

    context.testRequest = createConferenceRequest({});
    const first = vm.runInContext("resolveConferenceSessionOptions({ originator: 'remote', request: testRequest })", context);

    test.strictEqual(first.role, 'B');
    vm.runInContext("conferenceLegs.set('b', { role: 'B', confirmed: true });", context);
    const second = vm.runInContext("resolveConferenceSessionOptions({ originator: 'remote', request: testRequest })", context);

    test.strictEqual(second.role, 'C');
    test.strictEqual(second.silent, false);
    test.strictEqual(second.autoAnswer, false);
    test.done();
  },

  'only X-Silent-Join marks the second inbound call as silent C' : function(test)
  {
    const context = loadConferenceDemo();

    context.testRequest = createConferenceRequest({ 'X-Silent-Join': 'true' });
    vm.runInContext("conferenceLegs.set('b', { role: 'B', confirmed: true });", context);
    const incoming = vm.runInContext("resolveConferenceSessionOptions({ originator: 'remote', request: testRequest })", context);

    test.strictEqual(incoming.role, 'C');
    test.strictEqual(incoming.silent, true);
    test.strictEqual(incoming.autoAnswer, true);
    test.strictEqual(incoming.localDirection, 'sendonly');
    test.done();
  },

  'recvonly SDP without silent header remains a normal C call' : function(test)
  {
    const context = loadConferenceDemo();

    context.testRequest = createConferenceRequest({});
    context.testRequest.body = 'v=0\r\nm=audio 9 RTP/AVP 0\r\na=recvonly\r\n';
    vm.runInContext("conferenceLegs.set('b', { role: 'B', confirmed: true });", context);
    const incoming = vm.runInContext("resolveConferenceSessionOptions({ originator: 'remote', request: testRequest })", context);

    test.strictEqual(incoming.role, 'C');
    test.strictEqual(incoming.silent, false);
    test.strictEqual(incoming.autoAnswer, false);
    test.strictEqual(incoming.localDirection, 'sendrecv');
    test.done();
  },

  'silent C is rejected before B exists' : function(test)
  {
    const context = loadConferenceDemo();
    let terminated;

    context.testRequest = createConferenceRequest({ 'X-Silent-Join': 'true' });
    context.testSession = {
      id        : 'early-silent',
      terminate : function(options) { terminated = options; }
    };
    vm.runInContext("handleConferenceNewRTCSession({ originator: 'remote', request: testRequest, session: testSession })", context);

    test.strictEqual(terminated.status_code, 486);
    test.ok(context.statuses.some((status) => status.includes('过早')));
    test.done();
  },

  'C is rejected while B is not confirmed' : function(test)
  {
    const context = loadConferenceDemo();
    let terminated;

    vm.runInContext("conferenceLegs.set('b', { role: 'B', confirmed: false });", context);
    context.testRequest = createConferenceRequest({});
    context.testSession = {
      id        : 'early-c',
      terminate : function(options) { terminated = options; }
    };
    vm.runInContext("handleConferenceNewRTCSession({ originator: 'remote', request: testRequest, session: testSession })", context);

    test.strictEqual(terminated.status_code, 486);
    test.ok(context.statuses.some((status) => status.includes('尚未确认')));
    test.done();
  },

  'extra inbound call is rejected when B and C slots are occupied' : function(test)
  {
    const context = loadConferenceDemo();
    let terminated;

    vm.runInContext("conferenceLegs.set('b', { role: 'B', confirmed: true }); conferenceLegs.set('c', { role: 'C', confirmed: true });", context);
    context.testRequest = createConferenceRequest({});
    context.testSession = { terminate: function(options) { terminated = options; } };
    vm.runInContext("handleConferenceNewRTCSession({ originator: 'remote', request: testRequest, session: testSession })", context);

    test.strictEqual(terminated.status_code, 486);
    test.ok(context.statuses.some((status) => status.includes('会议已满')));
    test.done();
  },

  'silent C button uses SDK offer constraints for recvonly media' : function(test)
  {
    const context = loadConferenceDemo();

    context.appMode = 'point-to-point';
    vm.runInContext('appMode = "point-to-point"; callConferenceAsSilentC()', context)
      .then(function()
      {
        const call = context.capturedCalls[0];

        test.ok(call.options.extraHeaders.includes('X-Silent-Join: true'));
        test.ok(call.options.extraHeaders.includes('X-Direction: recvonly'));
        test.strictEqual(call.options.extraHeaders.filter((header) => header.indexOf('X-Conference') === 0).length, 0);
        test.strictEqual(call.options.mediaEffectsComposer, undefined);
        test.strictEqual(call.options.mediaConstraints.audio, false);
        test.strictEqual(call.options.mediaConstraints.video, false);
        test.strictEqual(call.options.rtcOfferConstraints.offerToReceiveAudio, true);
        test.strictEqual(call.options.rtcOfferConstraints.offerToReceiveVideo, true);
        test.strictEqual(call.options.eventHandlers.peerconnection, undefined);
        test.done();
      })
      .catch(function(error)
      {
        throw error;
      });
  },

  'conference stats identify the selected peer connection and render detailed media fields' : function(test)
  {
    const context = loadConferenceDemo();

    vm.runInContext(`
      statsLeg = createConferenceLeg({ id: 'stats-b' }, {
        role: 'B', remoteNo: '7301', originator: 'local'
      });
      statsLeg.confirmed = true;
      selectConferenceLeg(statsLeg);
      renderConferenceStatsReport(statsLeg, {
        connection: {
          connectionState: 'connected', iceConnectionState: 'connected', dtlsState: 'connected',
          sendBitrateBps: 100000, availableOutgoingBitrateBps: 200000,
          receiveBitrateBps: 120000, availableIncomingBitrateBps: 220000
        },
        quality: { RTT: 20, uplinkNetworkQuality: 1, downlinkNetworkQuality: 2, issues: [] },
        outbound: [ {
          kind: 'video', mid: '1', codec: { name: 'VP8' }, actualBitrateBps: 100000,
          framesPerSecond: 15, frameWidth: 640, frameHeight: 480,
          averageEncodeTimeMs: 2, qualityLimitationReason: 'none',
          remoteInbound: { jitterMs: 3, intervalLossPercent: 0 }
        } ],
        inbound: []
      });
    `, context);

    test.strictEqual(context.elements.get('#rtcStatsPeerConnection').textContent, 'A-B PeerConnection（B: 7301）');
    test.strictEqual(context.elements.get('#rtcStatsOutboundLabel').textContent, 'A → B:');
    test.strictEqual(context.elements.get('#rtcStatsInboundLabel').textContent, 'B → A:');
    const outboundTable = context.elements.get('#rtcStatsOutbound').children[0];

    test.strictEqual(outboundTable.className, 'rtc-stats-metric-table');
    test.ok(outboundTable.children.some((cell) => cell.textContent === '编码:VP8'));
    test.ok(outboundTable.children.some((cell) => cell.textContent === '画面:640x480'));
    test.done();
  },

  'A outbound conference call does not send silent or role headers' : function(test)
  {
    const context = loadConferenceDemo();
    const options = vm.runInContext("buildConferenceCallOptions('B')", context);

    test.ok(options.extraHeaders.includes('X-Direction: sendrecv'));
    test.strictEqual(options.extraHeaders.some((header) => header.indexOf('X-Silent-Join') === 0), false);
    test.strictEqual(options.extraHeaders.some((header) => header.indexOf('X-Conference-Role') === 0), false);
    test.done();
  },

  'conference locks the add-member action while C media is being prepared' : function(test)
  {
    const context = loadConferenceDemo();

    vm.runInContext(`
      conferenceLegs.set('host', {
        role: 'B', confirmed: true, ended: false,
        session: { id: 'host' }
      });
      prepareCalls = 0;
      preparation = new Promise(function(resolve) { resolvePreparation = resolve; });
      prepareNormalCComposerOutput = function() {
        prepareCalls += 1;
        return preparation;
      };
    `, context);

    const firstCall = vm.runInContext("callConferenceVideo({ role: 'C' })", context);
    const duplicateCall = vm.runInContext("callConferenceVideo({ role: 'C' })", context);

    test.strictEqual(vm.runInContext('prepareCalls', context), 1);
    test.strictEqual(context.capturedCalls.length, 0);
    test.ok(context.statuses.some((status) => status.includes('正在创建')));

    vm.runInContext(`
      resolvePreparation({
        mediaStream: new MediaStream([
          { kind: 'audio', id: 'prepared-audio', readyState: 'live' },
          { kind: 'video', id: 'prepared-video', readyState: 'live' }
        ]),
        fallbackLocalStream: new MediaStream(),
        normalComposerHostId: 'host',
        conferenceAudioStream: new MediaStream()
      });
    `, context);

    Promise.all([ firstCall, duplicateCall ])
      .then(function()
      {
        test.strictEqual(context.capturedCalls.length, 1);
        test.done();
      })
      .catch(function(error)
      {
        throw error;
      });
  },

  'original sender snapshots are not overwritten after composer replaceTrack' : function(test)
  {
    const context = loadConferenceDemo();

    vm.runInContext(`
      originalAudio = { kind: 'audio', id: 'original-audio', readyState: 'live' };
      originalVideo = { kind: 'video', id: 'original-video', readyState: 'live' };
      mixedAudio = { kind: 'audio', id: 'mixed-audio', readyState: 'live' };
      audioSender = { track: originalAudio };
      videoSender = { track: originalVideo };
      senderLeg = {
        originalAudioSender: null, originalVideoSender: null,
        originalAudioTrack: null, originalVideoTrack: null,
        session: { connection: { getSenders: function() { return [ audioSender, videoSender ]; } } }
      };
      rememberConferenceOriginalSenders(senderLeg);
      audioSender.track = mixedAudio;
      rememberConferenceOriginalSenders(senderLeg);
    `, context);

    test.strictEqual(vm.runInContext('senderLeg.originalAudioTrack === originalAudio', context), true);
    test.strictEqual(vm.runInContext('senderLeg.originalVideoTrack === originalVideo', context), true);
    test.done();
  },

  'conference media controls use the active conference composer' : function(test)
  {
    const context = loadConferenceDemo();

    vm.runInContext(`
      testComposer = {};
      conferenceLegs.set('host', {
        role: 'B',
        session: { getMediaEffectsComposer: function() { return testComposer; } }
      });
    `, context);

    test.strictEqual(vm.runInContext('getConferenceMediaEffectsComposer()', context), context.testComposer);
    test.done();
  },

  'normal C call and answer start with the prepared A-B composer output' : function(test)
  {
    const context = loadConferenceDemo();

    vm.runInContext(`
      normalCOutput = {
        mediaStream: new MediaStream([
          { kind: 'audio', id: 'ab-audio', readyState: 'live' },
          { kind: 'video', id: 'ab-video', readyState: 'live' }
        ])
      };
    `, context);

    const callOptions = vm.runInContext("buildConferenceCallOptions('C', normalCOutput)", context);
    const answerOptions = vm.runInContext(
      "buildConferenceAnswerOptions({ role: 'C', localDirection: 'sendrecv', silent: false }, normalCOutput)",
      context
    );
    const silentAnswerOptions = vm.runInContext(
      "buildConferenceAnswerOptions({ role: 'C', localDirection: 'sendonly', silent: true })",
      context
    );

    test.strictEqual(callOptions.mediaStream, context.normalCOutput.mediaStream);
    test.strictEqual(callOptions.mediaConstraints.audio, true);
    test.strictEqual(callOptions.mediaConstraints.video, true);
    test.strictEqual(answerOptions.mediaStream, context.normalCOutput.mediaStream);
    // false 会删除自定义流的轨道，留空则会使 SDP 约束处理收到 undefined。
    // 明确传 true 保留轨道，SDK 仍会根据 mediaStream 自动跳过重复设备采集。
    test.strictEqual(answerOptions.mediaConstraints.audio, true);
    test.strictEqual(answerOptions.mediaConstraints.video, true);
    test.strictEqual(answerOptions.mediaEffectsComposer, undefined);
    test.ok(silentAnswerOptions.mediaEffectsComposer);
    test.strictEqual(silentAnswerOptions.mediaStream, undefined);
    test.strictEqual(silentAnswerOptions.mediaConstraints.audio, true);
    test.strictEqual(silentAnswerOptions.mediaConstraints.video, true);
    test.done();
  },

  'normal C output is prepared from the host composer before signaling' : function(test)
  {
    const context = loadConferenceDemo();

    vm.runInContext(`
      preparedAddedSources = [];
      preparedHostAudioReplacements = [];
      preparedA = {
        audio: { kind: 'audio', id: 'a-audio', readyState: 'live', clone: function() { return { kind: 'audio', id: 'a-audio-clone', readyState: 'live' }; } },
        video: { kind: 'video', id: 'a-video', readyState: 'live', clone: function() { return { kind: 'video', id: 'a-video-clone', readyState: 'live' }; } }
      };
      preparedB = {
        audio: { kind: 'audio', id: 'b-audio', readyState: 'live' },
        video: { kind: 'video', id: 'b-video', readyState: 'live' }
      };
      preparedOutputVideo = { kind: 'video', id: 'ab-video', readyState: 'live' };
      preparedCAudio = { kind: 'audio', id: 'ab-audio', readyState: 'live' };
      preparedBAudio = { kind: 'audio', id: 'ac-audio', readyState: 'live' };
      preparedComposer = {
        addSource: function(stream, options) { preparedAddedSources.push({ stream: stream, slot: options.slot }); },
        removeSource: function() {},
        getVideoStream: function() { return new MediaStream([ preparedOutputVideo ]); },
        getAudioStream: function(options) {
          return Promise.resolve(new MediaStream([ options.slots[1] === 1 ? preparedCAudio : preparedBAudio ]));
        }
      };
      preparedHostLeg = {
        role: 'B', confirmed: true,
        remoteMainStream: new MediaStream([ preparedB.audio, preparedB.video ]),
        remoteMainAudioTrack: preparedB.audio,
        remoteMainVideoTrack: preparedB.video,
        composerSourceStream: null,
        conferenceAudioStream: null,
        session: {
          id: 'prepared-host',
          connection: {
            getSenders: function() { return [
              { track: preparedA.audio, replaceTrack: function(track) { preparedHostAudioReplacements.push(track); return Promise.resolve(); } },
              { track: preparedOutputVideo, replaceTrack: function() { return Promise.resolve(); } }
            ]; }
          },
          getMediaEffectsComposer: function() { return preparedComposer; },
          getComposerInputStream: function() { return new MediaStream([ preparedA.audio, preparedA.video ]); }
        }
      };
    `, context);

    vm.runInContext('prepareNormalCComposerOutput(preparedHostLeg)', context)
      .then(function(output)
      {
        test.strictEqual(vm.runInContext('preparedAddedSources.length', context), 1);
        test.strictEqual(vm.runInContext('preparedAddedSources[0].slot', context), 1);
        test.strictEqual(output.mediaStream.getVideoTracks()[0], context.preparedOutputVideo);
        test.strictEqual(output.mediaStream.getAudioTracks()[0], context.preparedCAudio);
        test.strictEqual(output.conferenceAudioStream.getAudioTracks()[0], context.preparedCAudio);
        test.strictEqual(output.normalComposerHostId, 'prepared-host');
        test.strictEqual(output.fallbackLocalStream.getVideoTracks()[0].id, 'a-video-clone');
        test.strictEqual(vm.runInContext('preparedHostAudioReplacements[0] === preparedBAudio', context), true);
        test.done();
      })
      .catch(function(error)
      {
        throw error;
      });
  },

  'normal C keeps the prebound host composer tracks when C joins' : function(test)
  {
    const context = loadConferenceDemo();

    vm.runInContext(`
      normalCVideoReplacements = [];
      normalCAudioReplacements = [];
      normalHostAudioReplacements = [];
      normalAddedSources = [];

      normalMixedVideo = { kind: 'video', id: 'abc-video', readyState: 'live' };
      normalCAudio = { kind: 'audio', id: 'ab-audio', readyState: 'live' };
      normalBAudio = { kind: 'audio', id: 'ac-audio', readyState: 'live' };
      normalBRemote = new MediaStream([
        { kind: 'audio', id: 'b-audio', readyState: 'live' },
        { kind: 'video', id: 'b-video', readyState: 'live' }
      ]);
      normalCRemote = new MediaStream([
        { kind: 'audio', id: 'c-audio', readyState: 'live' },
        { kind: 'video', id: 'c-video', readyState: 'live' }
      ]);

      normalComposer = {
        addSource: function(stream, options) { normalAddedSources.push({ stream: stream, slot: options.slot }); },
        removeSource: function() {},
        getVideoStream: function() { return new MediaStream([ normalMixedVideo ]); },
        getAudioStream: function() { throw new Error('prebound audio buses must be reused'); }
      };
      normalHostLeg = {
        role: 'B', confirmed: true, silent: false,
        remoteMainStream: normalBRemote,
        remoteMainAudioTrack: normalBRemote.getAudioTracks()[0],
        remoteMainVideoTrack: normalBRemote.getVideoTracks()[0],
        composerSourceStream: normalBRemote,
        conferenceAudioStream: new MediaStream([ normalBAudio ]),
        originalAudioSender: {
          track: normalBAudio,
          replaceTrack: function(track) { normalHostAudioReplacements.push(track); return Promise.resolve(); }
        },
        originalVideoSender: null,
        session: { id: 'normal-host', connection: {}, getMediaEffectsComposer: function() { return normalComposer; } }
      };
      normalCLeg = {
        role: 'C', confirmed: true, silent: false,
        remoteMainStream: normalCRemote,
        remoteMainAudioTrack: normalCRemote.getAudioTracks()[0],
        remoteMainVideoTrack: normalCRemote.getVideoTracks()[0],
        composerSourceStream: null,
        conferenceAudioStream: new MediaStream([ normalCAudio ]),
        normalComposerHostId: 'normal-host',
        originalVideoSender: { replaceTrack: function(track) { normalCVideoReplacements.push(track); return Promise.resolve(); } },
        originalAudioSender: { replaceTrack: function(track) { normalCAudioReplacements.push(track); return Promise.resolve(); } },
        session: { id: 'normal-c', connection: {}, getMediaEffectsComposer: function() { return null; } }
      };
      conferenceLegs.set('normal-host', normalHostLeg);
      conferenceLegs.set('normal-c', normalCLeg);
    `, context);

    vm.runInContext('syncConferenceComposer()', context)
      .then(function()
      {
        test.strictEqual(vm.runInContext('normalAddedSources.length', context), 1);
        test.strictEqual(vm.runInContext('normalAddedSources[0].slot', context), 2);
        test.strictEqual(vm.runInContext('normalCVideoReplacements.length', context), 0);
        test.strictEqual(vm.runInContext('normalCAudioReplacements.length', context), 0);
        test.strictEqual(vm.runInContext('normalHostAudioReplacements.length', context), 0);
        test.done();
      })
      .catch(function(error)
      {
        throw error;
      });
  },

  'silent C receives A plus B while B keeps the original A media' : function(test)
  {
    const context = loadConferenceDemo();

    vm.runInContext(`
      silentHostVideoReplacements = [];
      silentHostAudioReplacements = [];
      silentCVideoReplacements = [];
      silentCAudioReplacements = [];
      silentAddedSources = [];

      silentHostVideo = { kind: 'video', id: 'a-video', readyState: 'live' };
      silentHostAudio = { kind: 'audio', id: 'a-audio', readyState: 'live' };
      silentBVideo = { kind: 'video', id: 'b-video', readyState: 'live' };
      silentBAudio = { kind: 'audio', id: 'b-audio', readyState: 'live' };
      silentMixedVideo = { kind: 'video', id: 'ab-video', readyState: 'live' };
      silentMixedAudio = { kind: 'audio', id: 'ab-audio', readyState: 'live' };

      silentComposer = {
        addSource: function(stream, options) { silentAddedSources.push({ stream: stream, slot: options.slot }); },
        removeSource: function() {},
        getVideoStream: function() { return new MediaStream([ silentMixedVideo ]); },
        getAudioStream: function() { return Promise.resolve(new MediaStream([ silentMixedAudio ])); }
      };

      silentHostLeg = {
        role: 'B', confirmed: true, silent: false,
        remoteMainStream: new MediaStream([ silentBAudio, silentBVideo ]),
        remoteMainAudioTrack: silentBAudio, remoteMainVideoTrack: silentBVideo,
        composerSourceStream: null, conferenceAudioStream: null,
        originalVideoTrack: silentHostVideo, originalAudioTrack: silentHostAudio,
        originalVideoSender: { replaceTrack: function(track) { silentHostVideoReplacements.push(track); return Promise.resolve(); } },
        originalAudioSender: { replaceTrack: function(track) { silentHostAudioReplacements.push(track); return Promise.resolve(); } },
        session: {
          id: 'silent-host', connection: {},
          getMediaEffectsComposer: function() { throw new Error('silent C must not use the A-B composer'); }
        }
      };
      silentCLeg = {
        role: 'C', confirmed: true, silent: true,
        remoteMainStream: new MediaStream(),
        remoteMainAudioTrack: null, remoteMainVideoTrack: null,
        composerSourceStream: null, conferenceAudioStream: null,
        originalVideoTrack: { kind: 'video', id: 'temporary-c-video', readyState: 'live' },
        originalAudioTrack: { kind: 'audio', id: 'temporary-c-audio', readyState: 'live' },
        originalVideoSender: { replaceTrack: function(track) { silentCVideoReplacements.push(track); return Promise.resolve(); } },
        originalAudioSender: { replaceTrack: function(track) { silentCAudioReplacements.push(track); return Promise.resolve(); } },
        session: {
          id: 'silent-c', connection: {},
          getMediaEffectsComposer: function() { return silentComposer; }
        }
      };

      conferenceLegs.set(silentHostLeg.session.id, silentHostLeg);
      conferenceLegs.set(silentCLeg.session.id, silentCLeg);
    `, context);

    vm.runInContext('syncConferenceComposer()', context)
      .then(function()
      {
        test.strictEqual(vm.runInContext('silentAddedSources.length', context), 1);
        test.strictEqual(vm.runInContext('silentAddedSources[0].slot', context), 1);
        test.strictEqual(vm.runInContext('silentAddedSources[0].stream === silentHostLeg.remoteMainStream', context), true);
        test.strictEqual(vm.runInContext('silentHostVideoReplacements.length', context), 0);
        test.strictEqual(vm.runInContext('silentHostAudioReplacements.length', context), 0);
        test.strictEqual(vm.runInContext('silentCVideoReplacements.length', context), 0);
        test.strictEqual(vm.runInContext('silentCAudioReplacements.length', context), 0);
        test.ok(context.statuses.some((status) => status.includes('C 接收 A+B')));
        test.done();
      })
      .catch(function(error)
      {
        throw error;
      });
  },

  'B hangup terminates silent C but preserves normal C' : function(test)
  {
    const context = loadConferenceDemo();

    vm.runInContext(`
      silentCTerminated = 0;
      testB = {
        role: 'B', ended: false, screenSender: null, audioElement: null,
        composerSourceStream: null,
        session: { id: 'b', isEnded: function() { return true; } }
      };
      testC = {
        role: 'C', silent: true, confirmed: true, ended: false, remoteNo: '7302',
        screenSender: null, audioElement: null,
        composerSourceStream: null, remoteMainVideoTrack: null, remoteMainAudioTrack: null,
        session: {
          id: 'c', connection: null,
          isEnded: function() { return false; },
          terminate: function() { silentCTerminated += 1; }
        }
      };
      conferenceLegs.set('b', testB);
      conferenceLegs.set('c', testC);
    `, context);

    vm.runInContext('cleanupConferenceLeg(testB)', context)
      .then(function()
      {
        test.strictEqual(vm.runInContext('silentCTerminated', context), 1);

        vm.runInContext(`
          conferenceLegs.clear();
          normalCTerminated = 0;
          testB.ended = false;
          testC.silent = false;
          testC.session.terminate = function() { normalCTerminated += 1; };
          conferenceLegs.set('b', testB);
          conferenceLegs.set('c', testC);
        `, context);

        return vm.runInContext('cleanupConferenceLeg(testB)', context);
      })
      .then(function()
      {
        test.strictEqual(vm.runInContext('normalCTerminated', context), 0);
        test.strictEqual(vm.runInContext("conferenceLegs.has('c')", context), true);
        test.done();
      })
      .catch(function(error)
      {
        throw error;
      });
  },

  'normal C falls back to cloned A tracks when its composer host B ends' : function(test)
  {
    const context = loadConferenceDemo();

    vm.runInContext(`
      fallbackVideoReplacements = [];
      fallbackAudioReplacements = [];
      fallbackVideo = { kind: 'video', id: 'fallback-video', readyState: 'live' };
      fallbackAudio = { kind: 'audio', id: 'fallback-audio', readyState: 'live' };
      fallbackLeg = {
        normalComposerHostId: 'ended-b',
        conferenceAudioStream: new MediaStream([ { kind: 'audio', id: 'old-submix', readyState: 'ended' } ]),
        fallbackLocalStream: new MediaStream([ fallbackAudio, fallbackVideo ]),
        originalVideoTrack: { kind: 'video', id: 'ended-composer-video', readyState: 'ended' },
        originalAudioTrack: { kind: 'audio', id: 'ended-composer-audio', readyState: 'ended' },
        originalVideoSender: { replaceTrack: function(track) { fallbackVideoReplacements.push(track); return Promise.resolve(); } },
        originalAudioSender: { replaceTrack: function(track) { fallbackAudioReplacements.push(track); return Promise.resolve(); } }
      };
    `, context);

    vm.runInContext("restoreConferenceLegOriginalMedia(fallbackLeg, 'ended-b')", context)
      .then(function()
      {
        test.strictEqual(vm.runInContext('fallbackVideoReplacements[0] === fallbackVideo', context), true);
        test.strictEqual(vm.runInContext('fallbackAudioReplacements[0] === fallbackAudio', context), true);
        test.strictEqual(vm.runInContext('fallbackLeg.normalComposerHostId', context), null);
        test.strictEqual(vm.runInContext('fallbackLeg.conferenceAudioStream', context), null);
        test.done();
      })
      .catch(function(error)
      {
        throw error;
      });
  },

  'answer synchronous peer connection failure closes INVITE' : function(test)
  {
    const session = createAnswerSession({
      _createRTCConnection : function() { throw new Error('invalid pc config'); }
    });

    test.throws(function()
    {
      RTCSession.prototype.answer.call(session, {
        mediaConstraints    : { audio: false, video: false },
        rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true }
      });
    });
    test.strictEqual(session.replies[0][0], 500);
    test.strictEqual(session.failedCause, 'WebRTC Error');
    test.done();
  },

  'answer asynchronous SDP failure emits failed instead of hanging' : function(test)
  {
    const session = createAnswerSession({
      _createRTCConnection    : function() { this._connection = {}; },
      _createLocalDescription : function() { return Promise.reject(new Error('create answer failed')); }
    });

    RTCSession.prototype.answer.call(session, {
      mediaConstraints    : { audio: false, video: false },
      rtcOfferConstraints : { offerToReceiveAudio: true, offerToReceiveVideo: true }
    });

    setImmediate(function()
    {
      test.strictEqual(session.replies[0][0], 500);
      test.strictEqual(session.failedCause, 'WebRTC Error');
      test.done();
    });
  },

  'optional screen renegotiation failure preserves established call' : function(test)
  {
    let requestOptions;
    let terminateOptions;
    let callbackError;
    const session = {
      _id                 : 'renegotiate-test',
      _status             : RTCSession.C.STATUS_CONFIRMED,
      _isReadyToReOffer   : function() { return true; },
      _markStatsTransition : function() {},
      _setLocalMediaStatus : function() {},
      _sendReinvite       : function(options) { requestOptions = options; },
      terminate           : function(options) { terminateOptions = options; }
    };

    const started = RTCSession.prototype.renegotiate.call(
      session,
      { terminateOnFailure: false },
      function(error) { callbackError = error; }
    );

    requestOptions.eventHandlers.failed();
    test.strictEqual(started, true);
    test.ok(callbackError instanceof Error);
    test.strictEqual(terminateOptions, undefined);
    test.done();
  },

  'default renegotiation failure still terminates the call' : function(test)
  {
    let requestOptions;
    let terminateOptions;
    let callbackCalled = false;
    const session = {
      _id                  : 'renegotiate-default-test',
      _status              : RTCSession.C.STATUS_CONFIRMED,
      _isReadyToReOffer    : function() { return true; },
      _markStatsTransition : function() {},
      _setLocalMediaStatus : function() {},
      _sendReinvite        : function(options) { requestOptions = options; },
      terminate            : function(options) { terminateOptions = options; }
    };

    RTCSession.prototype.renegotiate.call(session, {}, function() { callbackCalled = true; });
    requestOptions.eventHandlers.failed();

    test.strictEqual(callbackCalled, false);
    test.strictEqual(terminateOptions.status_code, 500);
    test.done();
  },

  'composer input stream getter returns the tracked original stream' : function(test)
  {
    const stream = new MockMediaStream();
    const session = { _mediaEffectsComposerInputStream: stream };

    test.strictEqual(RTCSession.prototype.getComposerInputStream.call(session), stream);
    test.done();
  }
};
