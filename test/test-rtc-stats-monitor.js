/* eslint-disable max-len, no-console */
const assert = require('assert');
const RTCStatsMonitor = require('../lib/RTCStatsMonitor');
const runSuite = require('./include/manual-test-suite').runSuite;

require('./include/common');

function createPc(samples)
{
  let index = 0;

  return {
    connectionState    : 'connected',
    iceConnectionState : 'connected',
    iceGatheringState  : 'complete',
    signalingState     : 'stable',
    getTransceivers    : () => [],
    getStats           : () => Promise.resolve(samples[Math.min(index++, samples.length - 1)])
  };
}

function createStats(timestamp, multiplier = 1)
{
  const reports = [
    { id: 'codec-a', type: 'codec', timestamp, mimeType: 'audio/opus', payloadType: 111, clockRate: 48000, channels: 2 },
    { id: 'codec-v', type: 'codec', timestamp, mimeType: 'video/VP8', payloadType: 96, clockRate: 90000 },
    { id: 'source-a', type: 'media-source', timestamp, kind: 'audio', trackIdentifier: 'local-audio' },
    { id: 'source-v', type: 'media-source', timestamp, kind: 'video', trackIdentifier: 'local-video', width: 1280, height: 720, framesPerSecond: 30 },
    { id: 'local-candidate', type: 'local-candidate', timestamp, candidateType: 'host', protocol: 'udp', address: '192.0.2.1', port: 5000 },
    { id: 'remote-candidate', type: 'remote-candidate', timestamp, candidateType: 'srflx', protocol: 'udp', address: '198.51.100.1', port: 6000 },
    { id: 'pair', type: 'candidate-pair', timestamp, state: 'succeeded', nominated: true, bytesSent: 5000 * multiplier, bytesReceived: 6000 * multiplier, currentRoundTripTime: 0.08, totalRoundTripTime: 0.08 * multiplier, responsesReceived: multiplier, availableOutgoingBitrate: 900000, availableIncomingBitrate: 1200000, localCandidateId: 'local-candidate', remoteCandidateId: 'remote-candidate' },
    { id: 'transport', type: 'transport', timestamp, selectedCandidatePairId: 'pair', dtlsState: 'connected', iceState: 'connected' },
    { id: 'out-a', type: 'outbound-rtp', timestamp, kind: 'audio', mid: '0', codecId: 'codec-a', mediaSourceId: 'source-a', remoteId: 'remote-in-a', bytesSent: 2000 * multiplier, packetsSent: 20 * multiplier, headerBytesSent: 100 * multiplier },
    { id: 'out-v', type: 'outbound-rtp', timestamp, kind: 'video', mid: '1', codecId: 'codec-v', mediaSourceId: 'source-v', remoteId: 'remote-in-v', bytesSent: 10000 * multiplier, packetsSent: 100 * multiplier, framesSent: 60 * multiplier, framesEncoded: 60 * multiplier, framesPerSecond: 30, frameWidth: 1280, frameHeight: 720, totalEncodeTime: 0.6 * multiplier, qualityLimitationReason: 'none' },
    { id: 'remote-in-a', type: 'remote-inbound-rtp', timestamp, kind: 'audio', localId: 'out-a', codecId: 'codec-a', packetsLost: multiplier - 1, packetsReceived: 20 * multiplier, fractionLost: 0.01, jitter: 0.01, roundTripTime: 0.08 },
    { id: 'remote-in-v', type: 'remote-inbound-rtp', timestamp, kind: 'video', localId: 'out-v', codecId: 'codec-v', packetsLost: multiplier - 1, packetsReceived: 100 * multiplier, fractionLost: 0.02, jitter: 0.02, roundTripTime: 0.09 },
    { id: 'in-a', type: 'inbound-rtp', timestamp, kind: 'audio', mid: '0', codecId: 'codec-a', remoteId: 'remote-out-a', trackIdentifier: 'remote-audio', bytesReceived: 3000 * multiplier, packetsReceived: 30 * multiplier, packetsLost: multiplier - 1, jitter: 0.015 },
    { id: 'in-v', type: 'inbound-rtp', timestamp, kind: 'video', mid: '1', codecId: 'codec-v', remoteId: 'remote-out-v', trackIdentifier: 'remote-video', bytesReceived: 12000 * multiplier, packetsReceived: 120 * multiplier, packetsLost: multiplier - 1, jitter: 0.025, framesReceived: 60 * multiplier, framesDecoded: 58 * multiplier, framesDropped: 2 * multiplier, framesPerSecond: 29, frameWidth: 1280, frameHeight: 720, jitterBufferDelay: 0.2 * multiplier, jitterBufferEmittedCount: 60 * multiplier },
    { id: 'remote-out-a', type: 'remote-outbound-rtp', timestamp, kind: 'audio', localId: 'in-a', remoteTimestamp: timestamp - 50, reportsSent: multiplier },
    { id: 'remote-out-v', type: 'remote-outbound-rtp', timestamp, kind: 'video', localId: 'in-v', remoteTimestamp: timestamp - 50, reportsSent: multiplier }
  ];

  return new Map(reports.map((report) => [ report.id, report ]));
}

function createDiagnosticStats(timestamp, badSample)
{
  const stats = createStats(timestamp, badSample ? 2 : 1);
  const pair = stats.get('pair');
  const transport = stats.get('transport');
  const outbound = stats.get('out-v');
  const remoteInbound = stats.get('remote-in-v');
  const inbound = stats.get('in-v');

  Object.assign(pair, badSample ? {
    availableOutgoingBitrate    : 100000,
    packetsDiscardedOnSend      : 3,
    bytesDiscardedOnSend        : 1500,
    lastPacketReceivedTimestamp : timestamp - 11000
  } : {
    packetsDiscardedOnSend      : 0,
    bytesDiscardedOnSend        : 0,
    lastPacketReceivedTimestamp : timestamp - 100
  });
  transport.selectedCandidatePairChanges = badSample ? 1 : 0;

  Object.assign(outbound, badSample ? {
    bytesSent                          : 12000,
    headerBytesSent                    : 900,
    retransmittedBytesSent             : 2200,
    packetsSent                        : 120,
    retransmittedPacketsSent           : 10,
    framesEncoded                      : 80,
    framesPerSecond                    : 10,
    frameWidth                         : 640,
    frameHeight                        : 360,
    totalEncodeTime                    : 2.6,
    totalPacketSendDelay               : 2.1,
    qpSum                              : 1600,
    targetBitrate                      : 500000,
    qualityLimitationReason            : 'bandwidth',
    qualityLimitationDurations         : { none: 1, bandwidth: 2 },
    qualityLimitationResolutionChanges : 1,
    nackCount                          : 20,
    pliCount                           : 4,
    firCount                           : 3
  } : {
    retransmittedBytesSent             : 200,
    retransmittedPacketsSent           : 2,
    totalPacketSendDelay               : 0.1,
    qpSum                              : 600,
    targetBitrate                      : 500000,
    qualityLimitationDurations         : { none: 1, bandwidth: 0 },
    qualityLimitationResolutionChanges : 0,
    nackCount                          : 1,
    pliCount                           : 0,
    firCount                           : 0
  });

  Object.assign(remoteInbound, badSample ? {
    packetsLost     : 20,
    packetsReceived : 120,
    fractionLost    : 0.2,
    jitter          : 0.12,
    roundTripTime   : 0.4
  } : {});

  Object.assign(inbound, badSample ? {
    bytesReceived                : 26000,
    headerBytesReceived          : 1400,
    packetsReceived              : 140,
    packetsLost                  : 20,
    packetsDiscarded             : 3,
    jitter                       : 0.12,
    framesDecoded                : 78,
    framesDropped                : 12,
    framesPerSecond              : 10,
    totalDecodeTime              : 2.1,
    jitterBufferDelay            : 5.2,
    jitterBufferTargetDelay      : 4.2,
    jitterBufferMinimumDelay     : 3.2,
    jitterBufferEmittedCount     : 80,
    freezeCount                  : 1,
    totalFreezesDuration         : 0.8,
    pauseCount                   : 1,
    totalPausesDuration          : 0.5,
    nackCount                    : 20,
    pliCount                     : 4,
    firCount                     : 3,
    retransmittedPacketsReceived : 8,
    retransmittedBytesReceived   : 2400,
    fecPacketsReceived           : 6,
    fecPacketsDiscarded          : 2,
    fecBytesReceived             : 1800
  } : {
    headerBytesReceived          : 400,
    packetsDiscarded             : 0,
    totalDecodeTime              : 0.5,
    jitterBufferTargetDelay      : 0.2,
    jitterBufferMinimumDelay     : 0.1,
    freezeCount                  : 0,
    totalFreezesDuration         : 0,
    pauseCount                   : 0,
    totalPausesDuration          : 0,
    nackCount                    : 1,
    pliCount                     : 0,
    firCount                     : 0,
    retransmittedPacketsReceived : 1,
    retransmittedBytesReceived   : 400,
    fecPacketsReceived           : 1,
    fecPacketsDiscarded          : 0,
    fecBytesReceived             : 200
  });

  return stats;
}

async function testTimestampDeltaAndCompatibility()
{
  const monitor = new RTCStatsMonitor(createPc([ createStats(1000, 1), createStats(3000, 2) ]), { autoStart: false, transitionGraceSamples: 0 });
  const first = await monitor._collect();
  const second = await monitor._collect();

  assert.strictEqual(first.phase, 'warming-up');
  assert.strictEqual(first.outbound[0].actualBitrateBps, null);
  assert.strictEqual(second.phase, 'active');
  assert.strictEqual(second.sampleDurationMs, 2000);
  assert.strictEqual(second.outbound.find((stream) => stream.id === 'out-a').actualBitrateBps, 8000);
  assert.strictEqual(second.inbound.find((stream) => stream.id === 'in-a').receiveBitrateBps, 12000);
  assert.strictEqual(second.compatibility.level, 'full');
  assert.strictEqual(second.connection.candidatePairSelection, 'transport');
}

async function testDetailedLogUsesCompactSummary()
{
  const monitor = new RTCStatsMonitor(createPc([ createStats(1000, 1), createStats(3000, 2) ]), { autoStart: false, transitionGraceSamples: 0 });

  await monitor._collect();
  const detailed = await monitor._collect();
  const summary = monitor._createDetailedLogReport(detailed);

  assert.deepStrictEqual(Object.keys(summary), [
    'compatibility',
    'phase',
    'ready',
    'sampleDurationMs',
    'connection',
    'outbound',
    'inbound',
    'quality',
    'performance'
  ]);
  assert.deepStrictEqual(summary.connection.candidatePath.local, {
    candidateType : 'host',
    protocol      : 'udp',
    relayProtocol : null
  });
  assert.ok(!Object.prototype.hasOwnProperty.call(summary.connection.candidatePath.local, 'address'));
  assert.ok(!Object.prototype.hasOwnProperty.call(summary.outbound[0], 'bytesSent'));
  assert.ok(!Object.prototype.hasOwnProperty.call(summary.inbound[0], 'bytesReceived'));
  assert.strictEqual(summary.outbound.find((stream) => stream.type === 'audio').rttMs, 80);
  assert.strictEqual(summary.inbound.find((stream) => stream.type === 'video').averageJitterBufferDelayMs, 3.333);
  const summaryLength = JSON.stringify(summary).length;
  const detailedLength = JSON.stringify(detailed).length;

  assert.ok(summaryLength < 3000);
  assert.ok(summaryLength < detailedLength / 2);
}

async function testLegacyEventShape()
{
  const monitor = new RTCStatsMonitor(createPc([ createStats(1000, 1), createStats(3000, 2) ]), { autoStart: false, transitionGraceSamples: 0 });

  await monitor._collect();
  const detailed = await monitor._collect();
  const report = monitor._createLegacyReport(detailed);
  const network = monitor._createNetworkQuality(detailed);
  const audioUp = report.upStreams.find((stream) => stream.type === 'audio');
  const videoUp = report.upStreams.find((stream) => stream.type === 'video');
  const audioDown = report.downStreams.find((stream) => stream.type === 'audio');
  const videoDown = report.downStreams.find((stream) => stream.type === 'video');

  assert.deepStrictEqual(Object.keys(report), [ 'RTT', 'upStreams', 'downStreams' ]);
  assert.deepStrictEqual(Object.keys(audioUp), [ 'type', 'mimeType', 'bytesSent', 'packetsSent', 'loss', 'jitter', 'speed' ]);
  assert.deepStrictEqual(Object.keys(videoUp), [ 'type', 'mimeType', 'framesSent', 'framesEncoded', 'framesPerSecond', 'frameHeight', 'frameWidth', 'loss', 'jitter', 'speed' ]);
  assert.deepStrictEqual(Object.keys(audioDown), [ 'type', 'mimeType', 'bytesReceived', 'packetsReceived', 'loss', 'jitter', 'speed' ]);
  assert.deepStrictEqual(Object.keys(videoDown), [ 'type', 'mimeType', 'framesReceived', 'framesDecoded', 'framesPerSecond', 'frameHeight', 'frameWidth', 'loss', 'jitter', 'speed' ]);
  assert.strictEqual(typeof audioUp.speed, 'number');
  // speed 对外单位为十进制 kbps，必须使用 bps / 1000，不能按 1024 换算。
  assert.strictEqual(audioUp.speed, 8);
  assert.strictEqual(videoUp.speed, 40);
  assert.strictEqual(audioDown.speed, 12);
  assert.strictEqual(videoDown.speed, 48);
  assert.deepStrictEqual(Object.keys(network), [ 'uplinkNetworkQuality', 'RTT', 'uplinkLoss', 'downlinkNetworkQuality', 'downlinkLoss' ]);
  // 三种报告结构不同，但重叠的质量快照必须完全一致。
  assert.strictEqual(report.RTT, detailed.quality.RTT);
  assert.strictEqual(network.RTT, detailed.quality.RTT);
  assert.strictEqual(network.uplinkLoss, detailed.quality.uplinkLoss);
  assert.strictEqual(network.downlinkLoss, detailed.quality.downlinkLoss);
  assert.strictEqual(network.uplinkNetworkQuality, detailed.quality.uplinkNetworkQuality);
  assert.strictEqual(network.downlinkNetworkQuality, detailed.quality.downlinkNetworkQuality);
}

async function testUsesCurrentMediaRttAndWorstLoss()
{
  const first = createStats(1000, 1);
  const second = createStats(3000, 2);
  const third = createStats(5000, 3);

  second.get('pair').currentRoundTripTime = 0.01;
  second.get('remote-in-a').roundTripTime = 0.4;
  second.get('remote-in-a').fractionLost = 0.05;
  second.get('remote-in-v').roundTripTime = 0.2;
  second.get('remote-in-v').fractionLost = 0.3;
  second.get('in-a').packetsLost = 10;
  second.get('in-v').packetsLost = 20;

  third.get('pair').currentRoundTripTime = 0.5;
  third.get('remote-in-a').roundTripTime = 0.05;
  third.get('remote-in-a').fractionLost = 0;
  third.get('remote-in-v').roundTripTime = 0.04;
  third.get('remote-in-v').fractionLost = 0.01;
  third.get('in-a').packetsLost = 10;
  third.get('in-v').packetsLost = 20;

  const monitor = new RTCStatsMonitor(createPc([ first, second, third ]), { autoStart: false, transitionGraceSamples: 0 });

  await monitor._collect();
  const degraded = await monitor._collect();
  const recovered = await monitor._collect();

  assert.strictEqual(degraded.quality.RTT, 400);
  assert.strictEqual(degraded.quality.uplinkLoss, 30);
  assert.strictEqual(degraded.quality.downlinkLoss, 25);
  assert.strictEqual(recovered.quality.RTT, 50);
  assert.strictEqual(recovered.quality.uplinkLoss, 1);
  assert.strictEqual(recovered.quality.downlinkLoss, 0);

  delete third.get('remote-in-a').roundTripTime;
  delete third.get('remote-in-v').roundTripTime;
  third.get('pair').currentRoundTripTime = 0.123;

  const fallback = new RTCStatsMonitor(createPc([ third ]), { autoStart: false, transitionGraceSamples: 0 });
  const fallbackReport = await fallback._collect();

  assert.strictEqual(fallbackReport.quality.RTT, 123);
}

async function testKeepsEachRtpStreamAndFallsBackToTrackSettings()
{
  const first = createStats(1000, 1);
  const second = createStats(3000, 2);

  [ first, second ].forEach((stats) =>
  {
    const outbound = stats.get('out-v');

    delete outbound.mediaSourceId;
    delete outbound.frameWidth;
    delete outbound.frameHeight;
  });

  first.set('out-v2', { id: 'out-v2', type: 'outbound-rtp', timestamp: 1000, kind: 'video', mid: '1', codecId: 'codec-v', remoteId: 'remote-in-v2', bytesSent: 4000, packetsSent: 40, framesSent: 30, framesEncoded: 30, framesPerSecond: 15, frameWidth: 320, frameHeight: 180 });
  first.set('remote-in-v2', { id: 'remote-in-v2', type: 'remote-inbound-rtp', timestamp: 1000, kind: 'video', localId: 'out-v2', codecId: 'codec-v', packetsLost: 0, packetsReceived: 40, fractionLost: 0.15, jitter: 0.03, roundTripTime: 0.12 });
  second.set('out-v2', { id: 'out-v2', type: 'outbound-rtp', timestamp: 3000, kind: 'video', mid: '1', codecId: 'codec-v', remoteId: 'remote-in-v2', bytesSent: 8000, packetsSent: 80, framesSent: 60, framesEncoded: 60, framesPerSecond: 15, frameWidth: 320, frameHeight: 180 });
  second.set('remote-in-v2', { id: 'remote-in-v2', type: 'remote-inbound-rtp', timestamp: 3000, kind: 'video', localId: 'out-v2', codecId: 'codec-v', packetsLost: 6, packetsReceived: 80, fractionLost: 0.15, jitter: 0.03, roundTripTime: 0.12 });

  const pc = createPc([ first, second ]);

  pc.getTransceivers = () => [ {
    mid    : '1',
    sender : {
      track : {
        id          : 'local-video',
        getSettings : () => ({ width: 640, height: 360, frameRate: 24 })
      }
    }
  } ];

  const monitor = new RTCStatsMonitor(pc, { autoStart: false, transitionGraceSamples: 0 });

  await monitor._collect();
  const detailed = await monitor._collect();
  const report = monitor._createLegacyReport(detailed);
  const videoUp = report.upStreams.filter((stream) => stream.type === 'video');

  assert.deepStrictEqual(report.upStreams.map((stream) => stream.type), [ 'audio', 'video', 'video' ]);
  assert.strictEqual(videoUp[0].frameWidth, 640);
  assert.strictEqual(videoUp[0].frameHeight, 360);
  assert.strictEqual(videoUp[1].frameWidth, 320);
  assert.strictEqual(videoUp[1].frameHeight, 180);
  assert.deepStrictEqual(videoUp.map((stream) => stream.loss), [ 2, 15 ]);
  assert.strictEqual(detailed.quality.uplinkLoss, 15);
  assert.strictEqual(detailed.quality.RTT, 120);
}

async function testDefaultCadenceIsTwoSeconds()
{
  const monitor = new RTCStatsMonitor(createPc([ createStats(1000, 1) ]), { autoStart: false });

  assert.strictEqual(monitor._options.sampleIntervalMs, 2000);
  assert.strictEqual(monitor._options.legacyReportIntervalMs, 2000);
  assert.strictEqual(monitor._options.backgroundSampleIntervalMs, 2000);
  assert.strictEqual(monitor._options.getStatsTimeoutMs, 5000);
}

async function testEventsAndSamplingCadence()
{
  const monitor = new RTCStatsMonitor(createPc([ createStats(1000, 1), createStats(1500, 2), createStats(2000, 3) ]), {
    autoStart              : false,
    sampleIntervalMs       : 500,
    legacyReportIntervalMs : 1000,
    transitionGraceSamples : 0
  });
  const detailedReports = [];
  const legacyReports = [];
  const networkReports = [];
  const eventOrder = [];

  // 测试中关闭定时器，只验证每次采样后的事件节奏。
  monitor._schedule = () => {};
  monitor._started = true;
  monitor._runId = 1;
  monitor.on('detailed-report', (report) =>
  {
    eventOrder.push('detailed-report');
    detailedReports.push(report);
  });
  monitor.on('report', (report) =>
  {
    eventOrder.push('report');
    legacyReports.push(report);
  });
  monitor.on('network-quality', (report) =>
  {
    eventOrder.push('network-quality');
    networkReports.push(report);
  });

  await monitor._sample();
  await monitor._sample();
  await monitor._sample();

  assert.strictEqual(detailedReports.length, 3);
  assert.strictEqual(legacyReports.length, 1);
  assert.strictEqual(networkReports.length, 1);
  assert.deepStrictEqual(Object.keys(detailedReports[2]).sort(), [ 'connection', 'inbound', 'outbound', 'quality' ]);
  assert.deepStrictEqual(Object.keys(detailedReports[2].connection).sort(), [
    'availableIncomingBitrateBps',
    'availableOutgoingBitrateBps',
    'connectionState',
    'dtlsState',
    'iceConnectionState',
    'receiveBitrateBps',
    'sendBitrateBps'
  ]);
  assert.ok(!Object.prototype.hasOwnProperty.call(detailedReports[2].outbound[0], 'bytesSent'));
  assert.ok(!Object.prototype.hasOwnProperty.call(detailedReports[2].inbound[0], 'bytesReceived'));
  assert.ok(monitor.getLatestReport().performance);
  assert.ok(monitor.getLatestReport().compatibility);
  assert.deepStrictEqual(eventOrder.slice(-3), [ 'detailed-report', 'report', 'network-quality' ]);
  assert.strictEqual(legacyReports[0].RTT, detailedReports[2].quality.RTT);
  assert.strictEqual(networkReports[0].RTT, detailedReports[2].quality.RTT);
  assert.strictEqual(networkReports[0].uplinkLoss, monitor.getLatestReport().quality.uplinkLoss);
  assert.strictEqual(networkReports[0].downlinkLoss, monitor.getLatestReport().quality.downlinkLoss);
  assert.strictEqual(networkReports[0].uplinkNetworkQuality, detailedReports[2].quality.uplinkNetworkQuality);
  assert.strictEqual(networkReports[0].downlinkNetworkQuality, detailedReports[2].quality.downlinkNetworkQuality);
  monitor.stop();
}

async function testAutomaticDegradation()
{
  const unsupported = new RTCStatsMonitor({}, { autoStart: false });
  const partialStats = new Map([ [ 'out', { id: 'out', type: 'outbound-rtp', timestamp: 1000, kind: 'audio', bytesSent: 1, packetsSent: 1 } ] ]);
  const partial = new RTCStatsMonitor(createPc([ partialStats ]), { autoStart: false });
  const legacy = new RTCStatsMonitor(createPc([]), { autoStart: false });
  const legacyRaw = {
    result : () => [ {
      id        : 'legacy-out',
      type      : 'ssrc',
      timestamp : 1000,
      names     : () => [ 'bytesSent', 'packetsSent', 'mediaType', 'googCodecName' ],
      stat      : (name) => ({ bytesSent: '100', packetsSent: '10', mediaType: 'audio', googCodecName: 'opus' })[name]
    } ]
  };

  assert.strictEqual(unsupported.compatibility.level, 'unsupported');
  await partial._collect();
  assert.strictEqual(partial.compatibility.level, 'partial');
  const normalized = legacy._normalize(legacyRaw);

  legacy._updateCompatibility(normalized.reports, normalized.format);
  assert.strictEqual(legacy.compatibility.level, 'legacy-basic');
  assert.strictEqual(normalized.reports[0].type, 'outbound-rtp');
}

async function testCounterResetDoesNotCreateNegativeRate()
{
  const monitor = new RTCStatsMonitor(createPc([ createStats(1000, 2), createStats(2000, 1) ]), { autoStart: false, transitionGraceSamples: 0 });

  await monitor._collect();
  const report = await monitor._collect();

  assert.strictEqual(report.outbound.find((stream) => stream.id === 'out-a').actualBitrateBps, null);
  assert.strictEqual(report.inbound.find((stream) => stream.id === 'in-a').receiveBitrateBps, null);
}

async function testCallbackGetStatsSignatures()
{
  const report = createStats(1000, 1);
  const successFirstPc = createPc([]);
  const selectorFirstPc = createPc([]);
  const misleadingSelectorFirstPc = createPc([]);
  const misleadingSuccessFirstPc = createPc([]);

  successFirstPc.getStats = function(success)
  {
    if (typeof success === 'function')
    {
      success(report);
    }
  };
  selectorFirstPc.getStats = function(selector, success, failure)
  {
    assert.strictEqual(typeof failure, 'function');

    if (typeof success === 'function')
    {
      success(report);
    }
  };
  // length=1 会让模块先尝试 success-first；同步失败后必须交换成 selector-first。
  misleadingSelectorFirstPc.getStats = function(selector, ...rest)
  {
    if (typeof selector === 'undefined' && rest.length === 0)
    {
      return;
    }

    const success = rest[0];

    if (selector !== null || typeof success !== 'function')
    {
      throw new TypeError('selector-first signature required');
    }

    success(report);
  };
  // length=3 会让模块先尝试 selector-first；同步失败后必须交换成 success-first。
  misleadingSuccessFirstPc.getStats = function(success, selector, ignored)
  {
    // selector 和 ignored 仅用于把函数 length 固定为 3，模拟声明了三个形参的旧浏览器实现。
    void selector;
    void ignored;

    if (typeof success === 'undefined')
    {
      return;
    }

    if (typeof success !== 'function')
    {
      throw new TypeError('success-first signature required');
    }

    success(report);
  };

  const successFirst = new RTCStatsMonitor(successFirstPc, { autoStart: false });
  const selectorFirst = new RTCStatsMonitor(selectorFirstPc, { autoStart: false });
  const misleadingSelectorFirst = new RTCStatsMonitor(misleadingSelectorFirstPc, { autoStart: false });
  const misleadingSuccessFirst = new RTCStatsMonitor(misleadingSuccessFirstPc, { autoStart: false });

  await successFirst._collect();
  await selectorFirst._collect();
  await misleadingSelectorFirst._collect();
  await misleadingSuccessFirst._collect();
  assert.strictEqual(successFirst.compatibility.api.callbackGetStats, true);
  assert.strictEqual(selectorFirst.compatibility.api.callbackGetStats, true);
  assert.strictEqual(misleadingSelectorFirst.compatibility.api.callbackGetStats, true);
  assert.strictEqual(misleadingSuccessFirst.compatibility.api.callbackGetStats, true);
}

async function testGetStatsTimeoutEmitsErrorAndReleasesSamplingLock()
{
  const silentPc = createPc([]);

  silentPc.getStats = function(success)
  {
    // 保留一个形参，使函数 length=1，用来模拟 success-first callback 签名。
    void success;
    // 模拟异常 WebView：既不返回 Promise，也不调用 callback。
  };

  const monitor = new RTCStatsMonitor(silentPc, { autoStart: false, getStatsTimeoutMs: 100 });
  const errors = [];

  monitor._schedule = () => {};
  monitor._started = true;
  monitor._runId = 1;
  monitor.on('stats-error', (error) => errors.push(error));

  await monitor._sample();

  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0].code, 'GET_STATS_FAILED');
  assert.match(errors[0].message, /timed out/);
  assert.strictEqual(monitor._sampling, false);
  monitor.stop();
}

async function testStopAndImmediateRestartDuringInFlightSample()
{
  let resolveFirst;
  let callCount = 0;
  const pc = createPc([]);

  pc.getStats = function()
  {
    callCount++;

    if (callCount === 1)
    {
      return new Promise((resolve) => { resolveFirst = resolve; });
    }

    return Promise.resolve(createStats(3000, 2));
  };

  const monitor = new RTCStatsMonitor(pc, { autoStart: false, transitionGraceSamples: 0 });
  const scheduled = [];
  const detailedReports = [];

  monitor._schedule = (timeoutMs) => scheduled.push(timeoutMs);
  monitor.on('detailed-report', (report) => detailedReports.push(report));
  monitor.start();

  const oldSample = monitor._sample();

  monitor.stop();
  monitor.start();
  assert.strictEqual(monitor._restartPending, true);

  resolveFirst(createStats(1000, 1));
  await oldSample;

  // 旧 runId 的结果不发事件、不留下基线，并为新 runId 安排一次立即采样。
  assert.strictEqual(detailedReports.length, 0);
  assert.strictEqual(monitor._previous.size, 0);
  assert.strictEqual(monitor._restartPending, false);
  assert.deepStrictEqual(scheduled, [ 0, 0 ]);

  await monitor._sample();
  assert.strictEqual(detailedReports.length, 1);
  assert.strictEqual(monitor.getLatestReport().phase, 'warming-up');
  monitor.stop();
}

async function testTransitionGraceSamplesReturnToActive()
{
  const monitor = new RTCStatsMonitor(createPc([
    createStats(1000, 1),
    createStats(3000, 2),
    createStats(5000, 3),
    createStats(7000, 4),
    createStats(9000, 5)
  ]), { autoStart: false, transitionGraceSamples: 2 });

  await monitor._collect();
  const active = await monitor._collect();

  monitor.markTransition('test-media-change');

  const firstTransition = await monitor._collect();
  const secondTransition = await monitor._collect();
  const activeAgain = await monitor._collect();

  assert.strictEqual(active.phase, 'active');
  assert.strictEqual(firstTransition.phase, 'transitioning');
  assert.deepStrictEqual(firstTransition.transition, { reason: 'test-media-change', remainingSamples: 2 });
  assert.strictEqual(secondTransition.phase, 'transitioning');
  assert.deepStrictEqual(secondTransition.transition, { reason: 'test-media-change', remainingSamples: 1 });
  assert.strictEqual(activeAgain.phase, 'active');
}

async function testResetKeepsRunningAndRebuildsBaseline()
{
  const monitor = new RTCStatsMonitor(createPc([ createStats(1000, 1) ]), { autoStart: false });

  monitor._schedule = () => {};
  monitor.start();
  monitor._previous.set('out-a', { id: 'out-a' });
  monitor.reset();

  assert.strictEqual(monitor._started, true);
  assert.strictEqual(monitor._previous.size, 0);
  assert.strictEqual(monitor._transitionReason, 'reset');
  monitor.stop();
}

async function testPublicExport()
{
  const CRTC = require('../lib/JsSIP');

  assert.strictEqual(CRTC.RTCStatsMonitor, RTCStatsMonitor);
  assert.strictEqual(CRTC.getStats, RTCStatsMonitor);
  assert.strictEqual(typeof CRTC.getStats.prototype.setMode, 'undefined');
}

async function testDetailedFieldsAndAutomaticDiagnostics()
{
  const monitor = new RTCStatsMonitor(createPc([
    createDiagnosticStats(1000, false),
    createDiagnosticStats(3000, true)
  ]), { autoStart: false, transitionGraceSamples: 0 });

  await monitor._collect();
  const report = await monitor._collect();
  const outbound = report.outbound.find((stream) => stream.id === 'out-v');
  const inbound = report.inbound.find((stream) => stream.id === 'in-v');
  const issueCodes = report.quality.issues.map((item) => item.code);

  assert.strictEqual(outbound.headerBytesSent, 900);
  assert.strictEqual(outbound.packetsSentDelta, 20);
  assert.strictEqual(outbound.framesEncodedDelta, 20);
  assert.strictEqual(outbound.averageEncodeTimeMs, 100);
  assert.strictEqual(outbound.averagePacketSendDelayMs, 100);
  assert.strictEqual(outbound.retransmitPacketPercent, 40);
  assert.deepStrictEqual(outbound.qualityLimitationDurationsDelta, { none: 0, bandwidth: 2 });
  assert.strictEqual(inbound.headerBytesReceived, 1400);
  assert.strictEqual(inbound.framesDecodedDelta, 20);
  assert.strictEqual(inbound.averageDecodeTimeMs, 80);
  assert.strictEqual(inbound.averageJitterBufferDelayMs, 250);
  assert.strictEqual(inbound.retransmitReceiveBitrateBps, 8000);
  assert.strictEqual(inbound.fecReceiveBitrateBps, 6400);
  assert.strictEqual(report.connection.selectedCandidatePairChangesDelta, 1);
  assert.strictEqual(report.connection.packetsDiscardedOnSendDelta, 3);
  [
    'UPLINK_BANDWIDTH_LIMITED',
    'UPLINK_SEND_QUEUE_DELAY',
    'UPLINK_HIGH_RETRANSMISSION',
    'ENCODER_SLOW',
    'DOWNLINK_PACKET_LOSS',
    'DOWNLINK_JITTER_BUFFER_DELAY',
    'VIDEO_DECODER_SLOW',
    'VIDEO_FREEZING',
    'VIDEO_PAUSING',
    'UPLINK_LOCAL_SEND_DISCARDS',
    'UPLINK_BANDWIDTH_BUDGET_LOW',
    'DOWNLINK_TRANSPORT_STALLED',
    'CONNECTION_PATH_CHANGED'
  ].forEach((code) => assert.ok(issueCodes.includes(code), `missing issue: ${code}`));
}

async function testRTCSessionOwnsAndForwardsStatsMonitor()
{
  const OriginalMediaStream = global.MediaStream;

  global.MediaStream = class MediaStreamMock
  {
    getTracks() { return []; }
    getAudioTracks() { return []; }
    getVideoTracks() { return []; }
  };

  try
  {
    const RTCSession = require('../lib/RTCSession');
    const ua = {
      configuration : {
        session_timers                : false,
        session_timers_refresh_method : 'UPDATE'
      },
      destroyRTCSession : () => {}
    };
    const session = new RTCSession(ua);
    const detailedReports = [];
    const legacyReports = [];

    session.on('stats:detailed-report', (report) => detailedReports.push(report));
    session.on('stats:report', (report) => legacyReports.push(report));
    session._startStatsMonitor(createPc([ createStats(1000, 1), createStats(3000, 2) ]));

    const monitor = session.statsMonitor;

    clearTimeout(monitor._timer);
    monitor._timer = null;
    monitor._schedule = () => {};
    await monitor._sample();
    await monitor._sample();

    assert.ok(monitor instanceof RTCStatsMonitor);
    assert.strictEqual(detailedReports.length, 2);
    assert.strictEqual(legacyReports.length, 1);
    assert.strictEqual(legacyReports[0].RTT, detailedReports[1].quality.RTT);

    session._markStatsTransition('test-session-change');
    assert.strictEqual(monitor._transitionReason, 'test-session-change');
    session._stopStatsMonitor();
    assert.strictEqual(session.statsMonitor, null);
  }
  finally
  {
    global.MediaStream = OriginalMediaStream;
  }
}

async function run()
{
  return runSuite({
    suiteName : 'RTCStatsMonitor',
    tests     : [
      { name: 'uses report timestamps for deltas and detects full support', fn: testTimestampDeltaAndCompatibility },
      { name: 'keeps detailed logs compact while retaining user-facing diagnostics', fn: testDetailedLogUsesCompactSummary },
      { name: 'keeps report and network-quality payload shapes compatible', fn: testLegacyEventShape },
      { name: 'uses current media RTT and worst current RTP loss', fn: testUsesCurrentMediaRttAndWorstLoss },
      { name: 'keeps each RTP stream and falls back to track settings', fn: testKeepsEachRtpStreamAndFallsBackToTrackSettings },
      { name: 'uses a two-second default cadence in foreground and background', fn: testDefaultCadenceIsTwoSeconds },
      { name: 'emits detailed reports faster than legacy events', fn: testEventsAndSamplingCadence },
      { name: 'automatically degrades compatibility levels', fn: testAutomaticDegradation },
      { name: 'treats reset counters as a new baseline', fn: testCounterResetDoesNotCreateNegativeRate },
      { name: 'supports both historical callback getStats signatures', fn: testCallbackGetStatsSignatures },
      { name: 'times out silent getStats callbacks and releases the sampling lock', fn: testGetStatsTimeoutEmitsErrorAndReleasesSamplingLock },
      { name: 'restarts cleanly when stop and start occur during an in-flight sample', fn: testStopAndImmediateRestartDuringInFlightSample },
      { name: 'returns from transition grace samples to active phase', fn: testTransitionGraceSamplesReturnToActive },
      { name: 'keeps reset running while rebuilding the sampling baseline', fn: testResetKeepsRunningAndRebuildsBaseline },
      { name: 'exports RTCStatsMonitor under both public SDK names without setMode', fn: testPublicExport },
      { name: 'calculates detailed fields and emits corroborated diagnostics', fn: testDetailedFieldsAndAutomaticDiagnostics },
      { name: 'lets RTCSession own and forward its stats monitor', fn: testRTCSessionOwnsAndForwardsStatsMonitor }
    ]
  });
}

if (require.main === module)
{
  run().catch((error) =>
  {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { run };
