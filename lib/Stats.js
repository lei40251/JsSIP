/* eslint-disable max-len */
const EventEmitter = require('events').EventEmitter;
const Utils = require('./Utils');
const Logger = require('./Logger');
const CRTC_C = require('./Constants');

const logger = new Logger('Stats');

module.exports = class getStats extends EventEmitter
{
  constructor(pc, delay = 1, interval = 5)
  {
    super();
    this._pc = pc;
    this._delay = delay;
    this._interval = interval;

    // 多少次getStats后发送完整statsReport
    this._count = this._interval;

    // 存储 mediaSourceId 和 trackIdentifier 的对应关系
    this._mediaSourceIdToTrackIdentifier = new Map();

    // 远端共享的 trackIdentifier
    this._remoteSharedTrackIdentifier = null;

    this._remoteInboundRtps = new Map();

    // 本端共享的 trackIdentifier
    this._localSharedTrackIdentifier = null;

    this._statsTimer;

    // 新的统计信息
    this._newStats = {
      transport : {
        RTT : null
      },
      audio : {},
      video : {
        upStreams : {
          camera : {},
          shared : {}
        },
        downStreams : {
          camera : {},
          shared : {}
        }
      }
    };

    this.start();
  }

  start()
  {
    this._statsTimer = setInterval(async() =>
    {
      // 全局停止统计信息输出
      if (window.CRTCStats === 'stop')
      {
        clearInterval(this._statsTimer);

        return;
      }

      this._pc.getStats()
        .then((stats) =>
        {
          // 通话开始的时候统计报告不完整
          // try
          // {
          this._parseReport(stats);
          // }
          // catch (error)
          // {
          //   logger.error(`parseReport error: ${error.message}`);
          // }

          if (this._count === 0)
          {
            // 第二次开始间隔5-10次输出一次完整report
            this._count = this._interval + (Math.random() * 5 | 0);
            this._parseReport(stats, true);
          }

          this._count--;
        });

      logger.debug(`pc status: cS: ${this._pc.connectionState} iS:${this._pc.iceConnectionState} sS:${this._pc.signalingState}`);

      try
      {
        this._pc.getSenders()
          .forEach((s) =>
          {
            const trackStatus = `id: ${s.track.id}, enabled: ${s.track.enabled}, label: ${s.track.label},kind: ${s.track.kind},muted: ${s.track.muted},readyState: ${s.track.readyState},transport: ${s.transport.state && s.transport.state};`;

            logger.debug(`curr ${s.track.kind} track status: ${trackStatus}`);
            logger.debug(`settings: ${JSON.stringify(s.track.getSettings())} ***** constraints: ${JSON.stringify(s.track.getConstraints())} ***** capabilities: ${JSON.stringify(s.track.getCapabilities ? s.track.getCapabilities() : {})}`);
          });
      }
      catch (error)
      {
        logger.error(error.toString());
      }

    }, this._delay * 1000);
  }

  stop()
  {
    clearInterval(this._statsTimer);
    this._count = 5;
  }

  reset()
  { }

  // 参考 https://blog.csdn.net/weixin_41821317/article/details/117261117
  // https://www.twilio.com/blog/2016/03/chrome-vs-firefox-webrtc-stats-api-with-twilio-video.html
  _parseReport(stats, inform)
  {
    let data = null;

    // 取得 mediaSourceId 和 trackIdentifier 的对应关系
    stats.forEach((report) =>
    {
      if (report.type === 'media-source')
      {
        this._mediaSourceIdToTrackIdentifier.set(report.mediaSourceId, report.trackIdentifier);
      }

      if (report.type === 'remote-inbound-rtp')
      {
        this._remoteInboundRtps.set(report.id, report);
      }
    });

    // 获取远端共享的 trackIdentifier
    this._pc.getTransceivers().forEach((transceiver) =>
    {
      if (transceiver.mid === sessionStorage.getItem(CRTC_C.BFCP_TRANSCEIVER_INDEX) && transceiver.track && transceiver.track.kind === 'video')
      {
        this._remoteSharedTrackIdentifier = transceiver.track.id;
      }
    });

    // 获取本端共享的 trackIdentifier
    this._localSharedTrackIdentifier = sessionStorage.getItem(CRTC_C.BFCP_SHARED_STREAM_INDEX);

    // 遍历所有的 report 获取必要数据
    stats.forEach((report) =>
    {
      if (inform)
      {
        data += JSON.stringify(report);

        return;
      }

      switch (report.type)
      {
        case 'candidate-pair':
          if (report['state'] !== 'succeeded')
          {
            break;
          }
          else
          {
            this._newStats.transport.RTT = Math.floor(1e3 * report['currentRoundTripTime']);
          }
          break;
        case 'outbound-rtp':
          // 上行视频
          if (report.kind === 'video')
          {
            const tmpObject = {};
            // 当前统计报告的类型
            const type = report['mediaSourceId'] === this._localSharedTrackIdentifier ? 'shared' : 'camera';
            // 前一次的统计结果
            const previewStats = this._newStats.video.upStreams[type];
            const remoteInboundRtpsPacketsLost = this._remoteInboundRtps.get(report['remoteId']) ? this._remoteInboundRtps.get(report['remoteId']).packetsLost ? this._remoteInboundRtps.get(report['remoteId']).packetsLost : 0 : 0;

            // 用于计算速率和丢包的值
            const calc_bytesSent = report['bytesSent'] - (previewStats.bytesSent || 0);
            const calc_packetsSent = report['packetsSent'] - (previewStats.packetsSent || 0);
            const calc_packetsLost = remoteInboundRtpsPacketsLost - (previewStats.packetsLost || 0);

            // 当前报告的原始值
            tmpObject['bytesSent'] = report['bytesSent'];
            tmpObject['packetsSent'] = report['packetsSent'];
            tmpObject['framesSent'] = report['framesSent'];
            tmpObject['framesEncoded'] = report['framesEncoded'];
            tmpObject['framesPerSecond'] = report['framesPerSecond'];
            tmpObject['frameHeight'] = report['frameHeight'];
            tmpObject['frameWidth'] = report['frameWidth'];
            // 通过 remote-inbound-rtp 报告获取的原始值
            tmpObject['packetsLost'] = remoteInboundRtpsPacketsLost;

            // 当前周期的计算值
            let loss = 0;

            if (!calc_packetsSent || calc_packetsLost === null)
            {
              loss = null;
            }
            else if (this._remoteInboundRtps.get(report['remoteId']) && ('fractionLost' in this._remoteInboundRtps.get(report['remoteId'])))
            {
              loss = Math.floor(this._remoteInboundRtps.get(report['remoteId']).fractionLost * 100);
            }
            else
            {
              loss = Math.floor(calc_packetsLost * 100 / calc_packetsSent);
            }

            logger.warn('vuloss: ', Math.floor(calc_packetsLost * 100 / calc_packetsSent), '#', loss);

            tmpObject['calc_loss'] = loss;
            tmpObject['calc_speed'] = (report['bytesSent'] === null) ? null : (calc_bytesSent / this._delay * 8);

            // 合并统计结果
            Object.assign(this._newStats.video.upStreams[type], tmpObject);
          }
          else if (report.kind === 'audio')
          {
            const tmpObject = {};

            // 前一次的统计结果
            const previewStats = this._newStats.audio;

            const remoteInboundRtpsPacketsLost = this._remoteInboundRtps.get(report['remoteId']) ? this._remoteInboundRtps.get(report['remoteId']).packetsLost ? this._remoteInboundRtps.get(report['remoteId']).packetsLost : 0 : 0;

            // 用于计算速率和丢包的值
            const calc_bytesSent = report['bytesSent'] - (previewStats.bytesSent || 0);
            const calc_packetsSent = report['packetsSent'] - (previewStats.sendPacketsLost || 0);
            const calc_packetsLost = remoteInboundRtpsPacketsLost - (previewStats.packetsLost || 0);

            // 当前报告的原始值
            tmpObject['bytesSent'] = report['bytesSent'];
            tmpObject['packetsSent'] = report['packetsSent'];
            // 通过 remote-inbound-rtp 报告获取的原始值
            tmpObject['sendPacketsLost'] = remoteInboundRtpsPacketsLost;

            // 当前周期的计算值
            let loss = 0;

            if (!calc_packetsSent || calc_packetsLost === null)
            {
              loss = null;
            }
            else if (this._remoteInboundRtps.get(report['remoteId']) && ('fractionLost' in this._remoteInboundRtps.get(report['remoteId'])))
            {
              loss = Math.floor(this._remoteInboundRtps.get(report['remoteId']).fractionLost * 100);
            }
            else
            {
              loss = Math.floor(calc_packetsLost * 100 / calc_packetsSent);
            }

            logger.warn('auloss: ', Math.floor(calc_packetsLost * 100 / calc_packetsSent), '#', loss);

            tmpObject['calc_uplink_loss'] = loss;
            tmpObject['calc_uplink_speed'] = (report['bytesSent'] === null) ? null : (calc_bytesSent / this._delay * 8);

            // 合并统计结果
            Object.assign(this._newStats.audio, tmpObject);
          }

          break;
        case 'inbound-rtp':
          // 下行视频
          if (report.kind === 'video')
          {
            const tmpObject = {};
            // 当前统计报告的类型
            const type = report['trackIdentifier'] === this._remoteSharedTrackIdentifier ? 'shared' : 'camera';

            // 前一次的统计结果
            const previewStats = this._newStats.video.downStreams[type];

            // 用于计算速率和丢包的值
            const calc_bytesReceived = report['bytesReceived'] - (previewStats.bytesReceived || 0);
            const calc_packetsReceived = report['packetsReceived'] - (previewStats.packetsReceived || 0);
            const calc_packetsLost = report['packetsLost'] - (previewStats.packetsLost || 0);

            // 当前报告的原始值
            tmpObject['bytesReceived'] = report['bytesReceived'];
            tmpObject['packetsReceived'] = report['packetsReceived'];
            tmpObject['packetsLost'] = report['packetsLost'];
            tmpObject['framesReceived'] = report['framesReceived'];
            tmpObject['framesDecoded'] = report['framesDecoded'];
            tmpObject['framesPerSecond'] = report['framesPerSecond'];
            tmpObject['frameHeight'] = report['frameHeight'];
            tmpObject['frameWidth'] = report['frameWidth'];

            // 当前周期的计算值
            let loss = 0;

            if (!calc_bytesReceived || calc_packetsLost === null)
            {
              loss = null;
            }
            else
            {
              loss = Math.floor(calc_packetsLost * 100 / (calc_packetsReceived + calc_packetsLost));
            }

            logger.warn('vdloss: ', loss);

            tmpObject['calc_loss'] = loss;
            tmpObject['calc_speed'] = (report['bytesReceived'] === null) ? null : (calc_bytesReceived / this._delay * 8);

            // 合并统计结果
            Object.assign(this._newStats.video.downStreams[type], tmpObject);
          }
          else if (report.kind === 'audio')
          {
            const tmpObject = {};

            // 前一次的统计结果
            const previewStats = this._newStats.audio;

            // 用于计算速率和丢包的值
            const calc_bytesReceived = report['bytesReceived'] - (previewStats.bytesReceived || 0);
            const calc_packetsReceived = report['packetsReceived'] - (previewStats.packetsReceived || 0);
            const calc_packetsLost = report['packetsLost'] - (previewStats.recvPacketsLost || 0);

            // 当前报告的原始值
            tmpObject['bytesReceived'] = report['bytesReceived'];
            tmpObject['packetsReceived'] = report['packetsReceived'];
            tmpObject['recvPacketsLost'] = report['packetsLost'];

            // 当前周期的计算值
            let loss = 0;

            if (!calc_bytesReceived || calc_packetsLost === null)
            {
              loss = null;
            }
            else
            {
              loss = Math.floor(calc_packetsLost * 100 / (calc_packetsReceived + calc_packetsLost));
            }

            logger.warn('adloss: ', loss);

            tmpObject['calc_downlink_loss'] = loss;
            tmpObject['calc_downlink_speed'] = (report['bytesReceived'] === null) ? null : (calc_bytesReceived / this._delay * 8);
            // 合并统计结果
            Object.assign(this._newStats.audio, tmpObject);
          }

          break;
        default:
          break;
      }
    });

    if (data)
    {
      logger.debug(data);

      return;
    }

    const newReport = formatStats(this._newStats);

    logger.debug(JSON.stringify(this._newStats));
    this.emit('report', {
      RTT           : newReport.transport.RTT,
      upStreams     : newReport.video.upStreams,
      downStreams   : newReport.video.downStreams,
      uplinkSpeed   : `${((newReport.video.calc_uplink_speed + newReport.audio.calc_uplink_speed) / 1000).toFixed(1)}kbps`,
      downlinkSpeed : `${((newReport.video.calc_downlink_speed + newReport.audio.calc_downlink_speed) / 1000).toFixed(1)}kbps`,
      downlinkLoss  : `${Math.max(newReport.audio.calc_downlink_loss || 0, newReport.video.calc_downlink_loss || 0)}%`,
      uplinkLoss    : `${Math.max(newReport.audio.calc_uplink_loss || 0, newReport.video.calc_uplink_loss || 0)}%`
    });

    function formatStats(oldStats)
    {
      // 创建新的stats对象结构
      const newStats = {
        transport : {
          RTT : oldStats.transport.RTT
        },
        audio : {
          bytesSent           : oldStats.audio.bytesSent,
          packetsSent         : oldStats.audio.packetsSent,
          bytesReceived       : oldStats.audio.bytesReceived,
          packetsReceived     : oldStats.audio.packetsReceived,
          calc_uplink_loss    : oldStats.audio.calc_uplink_loss,
          calc_uplink_speed   : oldStats.audio.calc_uplink_speed,
          calc_downlink_loss  : oldStats.audio.calc_downlink_loss,
          calc_downlink_speed : oldStats.audio.calc_downlink_speed
        },
        video : {
          bytesSent           : 0,
          packetsSent         : 0,
          bytesReceived       : 0,
          packetsReceived     : 0,
          calc_uplink_loss    : 0,
          calc_uplink_speed   : 0,
          calc_downlink_loss  : 0,
          calc_downlink_speed : 0,
          upStreams           : [],
          downStreams         : []
        }
      };

      // 处理视频上行流数据
      const oldUpStreams = oldStats.video.upStreams;
      let totalBytesSent = 0;
      let totalPacketsSent = 0;
      let maxUpLinkLoss = 0;
      let totalUpLinkSpeed = 0;

      // 计算camera和shared的总和
      for (const type of [ 'camera', 'shared' ])
      {
        if (oldUpStreams[type])
        {
          totalBytesSent += oldUpStreams[type].bytesSent || 0;
          totalPacketsSent += oldUpStreams[type].packetsSent || 0;
          maxUpLinkLoss = Math.max(maxUpLinkLoss, oldUpStreams[type].calc_loss || 0);
          totalUpLinkSpeed += oldUpStreams[type].calc_speed || 0;

          // 添加到新的upStreams数组
          newStats.video.upStreams.push({
            type            : type,
            framesSent      : oldUpStreams[type].framesSent,
            framesEncoded   : oldUpStreams[type].framesEncoded,
            framesPerSecond : oldUpStreams[type].framesPerSecond,
            frameHeight     : oldUpStreams[type].frameHeight,
            frameWidth      : oldUpStreams[type].frameWidth
          });
        }
      }

      // 处理视频下行流数据
      const oldDownStreams = oldStats.video.downStreams;
      let totalBytesReceived = 0;
      let totalPacketsReceived = 0;
      let maxDownLinkLoss = 0;
      let totalDownLinkSpeed = 0;

      // 计算camera和shared的总和
      for (const type of [ 'camera', 'shared' ])
      {
        if (oldDownStreams[type])
        {
          totalBytesReceived += oldDownStreams[type].bytesReceived || 0;
          totalPacketsReceived += oldDownStreams[type].packetsReceived || 0;
          maxDownLinkLoss = Math.max(maxDownLinkLoss, oldDownStreams[type].calc_loss || 0);
          totalDownLinkSpeed += oldDownStreams[type].calc_speed || 0;

          // 添加到新的downStreams数组
          newStats.video.downStreams.push({
            type            : type,
            framesReceived  : oldDownStreams[type].framesReceived,
            framesDecoded   : oldDownStreams[type].framesDecoded,
            framesPerSecond : oldDownStreams[type].framesPerSecond,
            frameHeight     : oldDownStreams[type].frameHeight,
            frameWidth      : oldDownStreams[type].frameWidth
          });
        }
      }

      // 设置计算后的视频统计数据
      newStats.video.bytesSent = totalBytesSent;
      newStats.video.packetsSent = totalPacketsSent;
      newStats.video.bytesReceived = totalBytesReceived;
      newStats.video.packetsReceived = totalPacketsReceived;
      newStats.video.calc_uplink_loss = maxUpLinkLoss;
      newStats.video.calc_uplink_speed = totalUpLinkSpeed;
      newStats.video.calc_downlink_loss = maxDownLinkLoss;
      newStats.video.calc_downlink_speed = totalDownLinkSpeed;

      return newStats;
    }

    // 发送网络质量报告
    const RTT = [];
    const uplinkLoss = [];
    const uplinkNetworkQuality = [];
    const downlinkNetworkQuality = [];
    const downlinkLoss = [];

    RTT.push(newReport.transport.RTT);
    // eslint-disable-next-line max-len
    uplinkLoss.push(newReport.audio.calc_uplink_loss > newReport.video.calc_uplink_loss ? newReport.audio.calc_uplink_loss : newReport.video.calc_uplink_loss);
    // eslint-disable-next-line max-len
    uplinkNetworkQuality.push(Utils.getNetworkQuality(newReport.audio.calc_uplink_loss > newReport.video.calc_uplink_loss ? newReport.audio.calc_uplink_loss : newReport.video.calc_uplink_loss, newReport.transport.RTT));

    // eslint-disable-next-line max-len
    downlinkLoss.push(newReport.audio.calc_downlink_loss > newReport.video.calc_downlink_loss ? newReport.audio.calc_downlink_loss : newReport.video.calc_downlink_loss);
    // eslint-disable-next-line max-len
    downlinkNetworkQuality.push(Utils.getNetworkQuality(newReport.audio.calc_downlink_loss > newReport.video.calc_downlink_loss ? newReport.audio.calc_downlink_loss : newReport.video.calc_downlink_loss, newReport.transport.RTT));
    this._networkQuality = {
      // eslint-disable-next-line max-len
      uplinkNetworkQuality   : uplinkNetworkQuality.length > 0 ? Math.floor(uplinkNetworkQuality.reduce((pre, cur) => pre + cur) / uplinkNetworkQuality.length) || 0 : null,
      RTT                    : RTT.length > 0 ? Math.floor(RTT.reduce((pre, cur) => pre + cur) / RTT.length) || 0 : null,
      // eslint-disable-next-line max-len
      uplinkLoss             : uplinkLoss.length > 0 ? Math.floor(uplinkLoss.reduce((pre, cur) => pre + cur) / uplinkLoss.length) || 0 : null,
      // eslint-disable-next-line max-len
      downlinkNetworkQuality : downlinkNetworkQuality.length > 0 ? Math.floor(downlinkNetworkQuality.reduce((pre, cur) => pre + cur) / downlinkNetworkQuality.length) || 0 : null,
      // eslint-disable-next-line max-len
      downlinkLoss           : downlinkLoss.length > 0 ? Math.floor(downlinkLoss.reduce((pre, cur) => pre + cur) / downlinkLoss.length) || 0 : null
    };

    logger.debug(`networkQuality: ${JSON.stringify(this._networkQuality)}`);
    this.emit('network-quality', this._networkQuality);
  }
};
