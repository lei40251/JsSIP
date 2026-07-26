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
    this._listeners = new Map();
    this.id = `stream-${Math.random()}`;
  }

  getTracks() { return this._tracks.slice(); }
  getAudioTracks() { return this._tracks.filter((track) => track.kind === 'audio'); }
  getVideoTracks() { return this._tracks.filter((track) => track.kind === 'video'); }
  addTrack(track) { if (!this._tracks.includes(track)) this._tracks.push(track); }
  removeTrack(track) { this._tracks = this._tracks.filter((item) => item !== track); }
  // 辅流实现会监听 MediaStream.inactive；Mock 保留最小 EventTarget 行为，
  // 让测试可以覆盖监听绑定/解除，而不依赖 Node 环境不存在的原生 MediaStream。
  addEventListener(type, listener)
  {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(listener);
  }
  removeEventListener(type, listener)
  {
    if (this._listeners.has(type)) this._listeners.get(type).delete(listener);
  }
  dispatchEvent(event)
  {
    const listeners = this._listeners.get(event.type) || [];

    listeners.forEach((listener) => listener(event));
  }
}

/**
 * 创建可记录 stop 次数、enabled 状态和 ended/unmute 事件的最小媒体轨。
 * stopCount 用于判断某条 RTCSession 是否错误停止了多会话复用的共享源。
 */
function createMockTrack(kind, id)
{
  const listeners = new Map();

  return {
    kind,
    id,
    label       : id,
    readyState  : 'live',
    enabled     : true,
    contentHint : '',
    stopCount   : 0,
    addEventListener : function(type, listener)
    {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener : function(type, listener)
    {
      if (listeners.has(type)) listeners.get(type).delete(listener);
    },
    dispatch : function(type)
    {
      const handlers = listeners.get(type) || [];

      handlers.forEach((listener) => listener({ type, track: this }));
    },
    stop : function()
    {
      this.stopCount++;
      this.readyState = 'ended';
      this.dispatch('ended');
    }
  };
}

/**
 * 创建只包含 auxiliary share 所需依赖的 RTCSession 测试替身。
 *
 * renegotiate 同步成功并为 transceiver 提供固定 MID=2；sender.replaceTrack 会记录
 * 每次替换，使测试能够区分“首次新增 m-line”和“再次共享复用旧 sender”。
 */
function createAuxiliaryShareSession(id)
{
  const session = Object.create(RTCSession.prototype);
  const sender = {
    track        : null,
    replacements : [],
    replaceTrack : function(track)
    {
      this.track = track;
      this.replacements.push(track);

      return Promise.resolve();
    }
  };
  const transceiver = { sender, mid: '2', direction: 'sendonly' };

  Object.assign(session, {
    _id                              : id,
    _status                          : RTCSession.C.STATUS_CONFIRMED,
    _bfcp                            : { enabled: false },
    _localShareRTPSender             : null,
    _localShareStream                : null,
    _localShareStreamLocallyGenerated : false,
    _shareMode                       : null,
    _auxiliaryShareTransceiver       : null,
    _auxiliaryShareMid               : null,
    _auxiliaryShareActive            : false,
    _auxiliaryShareStarting          : false,
    _auxiliaryShareCancelRequested   : false,
    _auxiliaryShareOwnsStream        : false,
    _auxiliaryShareStopPromise       : null,
    _auxiliaryShareEndTimer          : null,
    _auxiliaryShareBoundTrack        : null,
    _auxiliaryShareTrackEndedHandler : null,
    _auxiliaryShareStreamInactiveHandler : null,
    _remoteAuxiliaryShareMid         : null,
    _remoteAuxiliaryShareTracks      : new Map(),
    _remoteAuxiliaryShareBoundTracks : new Set(),
    _remoteAuxiliaryShareActiveTrack : null,
    _markStatsTransition             : function() {},
    _logOperationError               : function() {},
    isEnded                          : function() { return false; },
    renegotiate                      : function(options, done)
    {
      this.renegotiateOptions = options;
      done();

      return true;
    },
    sendInfo : function(contentType, body)
    {
      this.sentInfos.push({ contentType, body: JSON.parse(body) });
    },
    sentInfos : [],
    _connection : {
      addTransceiverCalls : [],
      addTransceiver      : function(track, options)
      {
        this.addTransceiverCalls.push({ track, options });

        return transceiver;
      }
    }
  });

  session.testSender = sender;
  session.testTransceiver = transceiver;

  return session;
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

  // 三方会议最关键的所有权用例：B 停止共享不能 stop B/C 共用的屏幕轨，
  // 两条会话都停止后仍由 Demo 统一释放外部流。
  'SDK auxiliary share reuses an external screen stream without taking ownership' : function(test)
  {
    const screenTrack = createMockTrack('video', 'shared-screen');
    const screenStream = new MockMediaStream([ screenTrack ]);
    const firstSession = createAuxiliaryShareSession('aux-b');
    const secondSession = createAuxiliaryShareSession('aux-c');
    const options = {
      mode                : 'auxiliary',
      mediaStream         : screenStream,
      stopStreamOnUnShare : false
    };

    Promise.all([
      firstSession.share('screen', options),
      secondSession.share('screen', options)
    ])
      .then(function(streams)
      {
        test.strictEqual(streams[0], screenStream);
        test.strictEqual(streams[1], screenStream);
        test.strictEqual(firstSession._connection.addTransceiverCalls.length, 1);
        test.strictEqual(secondSession._connection.addTransceiverCalls.length, 1);
        test.strictEqual(firstSession._connection.addTransceiverCalls[0].options.direction, 'sendonly');
        test.strictEqual(firstSession.sentInfos[0].body.action, 'start');
        test.strictEqual(firstSession.sentInfos[0].body.mid, '2');
        test.strictEqual(firstSession.renegotiateOptions.terminateOnFailure, false);
        test.strictEqual(firstSession._shareMode, 'auxiliary');

        return firstSession.unShare();
      })
      .then(function()
      {
        test.strictEqual(screenTrack.stopCount, 0);
        test.strictEqual(secondSession._auxiliaryShareActive, true);
        test.strictEqual(firstSession.sentInfos[1].body.action, 'stop');
        test.strictEqual(firstSession._shareMode, null);

        return secondSession.unShare();
      })
      .then(function()
      {
        test.strictEqual(screenTrack.stopCount, 0);
        test.done();
      })
      .catch(function(error)
      {
        throw error;
      });
  },

  // 停止后保留 transceiver/MID；第二次共享应只 replaceTrack，不新增 SDP m-section。
  'SDK auxiliary share reuses the negotiated sender on the next share' : function(test)
  {
    const session = createAuxiliaryShareSession('aux-reuse');
    const firstTrack = createMockTrack('video', 'screen-1');
    const firstStream = new MockMediaStream([ firstTrack ]);
    const secondTrack = createMockTrack('video', 'screen-2');
    const secondStream = new MockMediaStream([ secondTrack ]);

    firstTrack.contentHint = 'motion';

    // 保留上一版第四参数 options 写法的兼容测试，同时验证空 contentHint 不被改成 detail。
    session.share('screen', null, null, {
      mode        : 'auxiliary',
      mediaStream : firstStream,
      contentHint : ''
    })
      .then(function()
      {
        test.strictEqual(firstTrack.contentHint, '');

        return session.unShare();
      })
      .then(function()
      {
        // 模拟两次辅流之间执行过历史 screen 分享，它会清空共享 sender 引用；
        // SDK 应从保留的 transceiver 恢复 sender，仍然复用原 MID。
        session._localShareRTPSender = null;

        return session.share('screen', { mode: 'auxiliary', mediaStream: secondStream });
      })
      .then(function()
      {
        test.strictEqual(session._connection.addTransceiverCalls.length, 1);
        test.strictEqual(session.testSender.track, secondTrack);
        test.strictEqual(session.sentInfos.filter((info) => info.body.action === 'start').length, 2);

        return session.unShare();
      })
      .then(function()
      {
        test.done();
      })
      .catch(function(error)
      {
        throw error;
      });
  },

  // 摄像头控制和屏幕辅流必须相互独立：mute/音频模式只影响主视频轨。
  'camera mute and audio mode do not stop an active auxiliary share' : function(test)
  {
    const session = createAuxiliaryShareSession('aux-media-state');
    const cameraTrack = createMockTrack('video', 'camera');
    const screenTrack = createMockTrack('video', 'screen');
    const cameraSender = { track: cameraTrack };

    session._localShareRTPSender = session.testSender;
    session.testSender.track = screenTrack;
    session._connection.getSenders = function() { return [ cameraSender, session.testSender ]; };
    session._videoOnlyMute = false;
    session._toggleMuteVideo(true);

    test.strictEqual(cameraTrack.enabled, false);
    test.strictEqual(screenTrack.enabled, true);

    session._localMediaStream = new MockMediaStream([ cameraTrack ]);
    session._localShareStream = new MockMediaStream([ screenTrack ]);
    session._customMediaStream = false;
    session._auxiliaryShareActive = true;
    session._setLocalMedia('audio');

    test.strictEqual(cameraTrack.stopCount, 1);
    test.strictEqual(screenTrack.stopCount, 0);
    test.done();
  },

  // 同一会话不能让历史共享和独立辅流同时覆盖共享状态；unShare 后应解除模式锁。
  'SDK share modes are mutually exclusive and unlock after unShare' : function(test)
  {
    const session = createAuxiliaryShareSession('share-mode');
    const legacyTrack = createMockTrack('video', 'legacy-share');
    const legacyStream = new MockMediaStream([ legacyTrack ]);
    const auxiliaryStream = new MockMediaStream([ createMockTrack('video', 'aux-share') ]);

    let legacyArguments;

    session._shareLegacyImpl = function(type, id, assembly, dual, skip)
    {
      legacyArguments = { type, id, assembly, dual, skip };
      this._localShareStream = legacyStream;
    };

    // Demo 推荐的二参对象必须准确还原成历史实现所需参数，不能改变底层媒体时序。
    session.share('video', {
      id       : '#legacy',
      assembly : 'legacy-assembly',
      dual     : false,
      skip     : true
    })
      .then(function()
      {
        test.deepEqual(legacyArguments, {
          type     : 'video',
          id       : '#legacy',
          assembly : 'legacy-assembly',
          dual     : false,
          skip     : true
        });
        test.strictEqual(session._shareMode, 'legacy');

        return session.share('screen', {
          mode        : 'auxiliary',
          mediaStream : auxiliaryStream
        });
      })
      .then(function()
      {
        test.ok(false, 'active legacy share should reject auxiliary share');
      })
      .catch(function(error)
      {
        test.ok(/legacy media share is already active/.test(error.message));
        test.strictEqual(session._connection.addTransceiverCalls.length, 0);

        session.unShare();
        test.strictEqual(session._shareMode, null);

        return session.share('screen', {
          mode        : 'auxiliary',
          mediaStream : auxiliaryStream
        });
      })
      .then(function()
      {
        test.strictEqual(session._shareMode, 'auxiliary');

        return session.unShare();
      })
      .then(function()
      {
        test.strictEqual(session._shareMode, null);
        test.done();
      })
      .catch(function(error)
      {
        throw error;
      });
  },

  // 浏览器 track 与 SIP INFO 没有固定先后顺序，两种顺序都只能触发一次 remoteShared。
  'SDK matches auxiliary share INFO and track in either arrival order' : function(test)
  {
    const OriginalMediaStream = global.MediaStream;
    const track = createMockTrack('video', 'remote-screen');
    const session = createAuxiliaryShareSession('aux-remote');
    const emitted = [];

    global.MediaStream = MockMediaStream;
    session.emit = function(name, payload) { emitted.push({ name, payload }); };
    session._connection.getTransceivers = function()
    {
      return [ { mid: '7', receiver: { track } } ];
    };

    session._handleAuxiliaryShareTrack({ track, transceiver: session._connection.getTransceivers()[0] });
    test.strictEqual(emitted.filter((event) => event.name === 'remoteShared').length, 0);

    session.newInfo({
      originator : 'remote',
      info       : { body: JSON.stringify({ event: 'screen-share', action: 'start', mid: '7' }) }
    });

    const sharedEvent = emitted.find((event) => event.name === 'remoteShared');

    test.ok(sharedEvent);
    test.strictEqual(sharedEvent.payload.sharedStream.videoStream.getVideoTracks()[0], track);

    session.newInfo({
      originator : 'remote',
      info       : { body: JSON.stringify({ event: 'screen-share', action: 'stop', mid: '7' }) }
    });
    test.strictEqual(emitted.filter((event) => event.name === 'remoteUnShared').length, 1);

    const infoFirstSession = createAuxiliaryShareSession('aux-remote-info-first');
    const infoFirstEvents = [];

    infoFirstSession.emit = function(name, payload) { infoFirstEvents.push({ name, payload }); };
    infoFirstSession._connection.getTransceivers = function() { return []; };
    infoFirstSession.newInfo({
      originator : 'remote',
      info       : { body: JSON.stringify({ event: 'screen-share', action: 'start', mid: '8' }) }
    });
    infoFirstSession._handleAuxiliaryShareTrack({
      track,
      transceiver : { mid: '8', receiver: { track } }
    });
    test.strictEqual(infoFirstEvents.filter((event) => event.name === 'remoteShared').length, 1);
    global.MediaStream = OriginalMediaStream;
    test.done();
  },

  // Demo 边界测试：页面可以采集/编排，但不得再直接调用 addTransceiver、renegotiate
  // 或发送 screen-share INFO，所有目标都必须委托 RTCSession.share()/unShare()。
  'conference screen sharing delegates each target to RTCSession share and unShare' : function(test)
  {
    const context = loadConferenceDemo();
    const screenTrack = createMockTrack('video', 'conference-screen');
    const screenStream = new MockMediaStream([ screenTrack ]);
    const shareCalls = [];
    const stopCalls = [];

    context.navigator.mediaDevices.getDisplayMedia = function() { return Promise.resolve(screenStream); };
    context.updateConferenceUi = function() {};
    context.openScreenShareDialog = function() {};
    context.closeScreenShareDialog = function() {};
    context.testSessionB = {
      id        : 'share-b',
      isEnded   : function() { return false; },
      share     : function()
      {
        shareCalls.push(Array.prototype.slice.call(arguments));

        return Promise.resolve(screenStream);
      },
      unShare   : function()
      {
        stopCalls.push('B');

        return Promise.resolve();
      }
    };
    context.testSessionC = {
      id        : 'share-c',
      isEnded   : function() { return false; },
      share     : function()
      {
        shareCalls.push(Array.prototype.slice.call(arguments));

        return Promise.resolve(screenStream);
      },
      unShare   : function()
      {
        stopCalls.push('C');

        return Promise.resolve();
      }
    };

    vm.runInContext(`
      conferenceLegs.set('share-b', {
        role: 'B', confirmed: true, ended: false, screenTarget: true, screenActive: false,
        session: testSessionB
      });
      conferenceLegs.set('share-c', {
        role: 'C', confirmed: true, ended: false, screenTarget: true, screenActive: false,
        session: testSessionC
      });
    `, context);

    vm.runInContext('startConferenceScreenShare()', context)
      .then(function()
      {
        test.strictEqual(shareCalls.length, 2);
        test.strictEqual(shareCalls[0][0], 'screen');
        test.strictEqual(shareCalls[0][1].mode, 'auxiliary');
        test.strictEqual(shareCalls[0][1].mediaStream, screenStream);
        test.strictEqual(shareCalls[1][1].mediaStream, screenStream);

        return vm.runInContext('stopConferenceScreenShare()', context);
      })
      .then(function()
      {
        test.deepEqual(stopCalls.sort(), [ 'B', 'C' ]);
        test.strictEqual(screenTrack.stopCount, 1);
        test.done();
      })
      .catch(function(error)
      {
        throw error;
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
