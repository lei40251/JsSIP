/* eslint-disable max-len */
const EventEmitter = require('events').EventEmitter;
const Utils = require('./Utils');
const Logger = require('./Logger');
const CRTC_C = require('./Constants');

const logger = new Logger('Stats');


module.exports = class getStats extends EventEmitter
{
  constructor(pc, delay = 2, interval = 5)
  {
    super();

    logger.debug('new getStats()');

    // 判断pc是不是 RTCPeerConnection
    try 
    {
      if (Object.prototype.toString.call(pc) !== '[object RTCPeerConnection]') 
      {
        logger.warn('pc parameter is not RTCPeerConnection');
      }
    }
    catch (error) 
    {
      logger.error('err: ', JSON.stringify(error));      
    }

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
      rtt       : 0,
      upStreams : {
        audio  : {},
        video  : {},
        shared : {}
      },
      downStreams : {
        audio  : {},
        video  : {},
        shared : {}
      }
    };

    this.start();
  }

  start()
  {
    logger.debug('start()');
    const processing = async() => 
    {
      
      let inform = false;

      // 全局停止统计信息输出
      if (window.CRTCStats === 'stop')
      {
        clearInterval(this._statsTimer);

        return;
      }

      this._data = '';

      if (this._count === 0)
      {
        // 第二次开始间隔5-10次输出一次完整report
        this._count = this._interval + (Math.random() * 5 | 0);
        inform = true;
      }

      this._count--;

      const transceivers = await this._pc.getTransceivers();

      for (const transceiver of transceivers)
      {
        const senderReports = await transceiver.sender.getStats();
        const receiverReports = await transceiver.receiver.getStats();

        if (transceiver.mid ===sessionStorage.getItem(CRTC_C.BFCP_SHARED_STREAM_INDEX))
        {
          this._parseSenderReport(senderReports, transceiver.sender, true, inform);
          this._parseReceiverReport(receiverReports, transceiver.receiver, true, inform);
        }
        else
        {
          transceiver.sender.track && this._parseSenderReport(senderReports, transceiver.sender, false, inform);
          this._parseReceiverReport(receiverReports, transceiver.receiver, false, inform);
        }
      }

      logger.debug(`pc status: cS: ${this._pc.connectionState} iS:${this._pc.iceConnectionState} sS:${this._pc.signalingState}`);

      try
      {
        this._pc.getSenders()
          .forEach((s) =>
          {
            if (!s.track)
            {
              return;
            }
            const trackStatus = `id: ${s.track.id}, enabled: ${s.track.enabled}, label: ${s.track.label},kind: ${s.track.kind},muted: ${s.track.muted},readyState: ${s.track.readyState},transport: ${s.transport && s.transport.state};`;

            logger.debug(`curr ${s.track.kind} track status: ${trackStatus}`);
            logger.debug(`settings: ${JSON.stringify(s.track.getSettings())} ***** constraints: ${JSON.stringify(s.track.getConstraints())} ***** capabilities: ${JSON.stringify(s.track.getCapabilities ? s.track.getCapabilities() : {})}`);
          });
      }
      catch (error)
      {
        logger.error(error.toString());
      }

      if (this._data)
      {
        logger.debug(this._data);

        return;
      }

      this._createReport();
    };

    setTimeout(() => 
    {
      processing();
    }, this._delay * 500);

    this._statsTimer = setInterval(async() =>
    {
      processing();
    }, this._delay * 1000);
  }

  stop()
  {
    logger.debug('stop()');
    clearInterval(this._statsTimer);
    this._count = this._interval;
    window.CRTCStats = '';
  }

  reset()
  {
    this.stop();
  }

  // 解析上行统计报告
  _parseSenderReport(reports, sender, shared, inform)
  {
    let type;
    let tmpObject = {};

    shared ? type = 'shared' : type = sender.track.kind;

    // 前一次的统计结果
    const previewStats = this._newStats.upStreams[type];

    let calc_bytesSent;
    let calc_packetsSent;
    let calc_packetsLost;
    let fractionLost;

    reports.forEach((report) =>
    {
      if (inform)
      {
        this._data += JSON.stringify(report);

        return;
      }

      switch (report.type)
      {
        case 'outbound-rtp':
        {
          // 用于计算速率和丢包的值
          calc_bytesSent = report['bytesSent'] - (previewStats.bytesSent || 0);
          calc_packetsSent = report['packetsSent'] - (previewStats.packetsSent || 0);

          // 当前报告的原始值
          tmpObject['bytesSent'] = report['bytesSent'];
          tmpObject['packetsSent'] = report['packetsSent'] || 0;
          if (report['kind'] === 'video')
          {
            report['framesSent'] && (tmpObject['framesSent'] = report['framesSent']);
            tmpObject['framesEncoded'] = report['framesEncoded'] || 0;
            tmpObject['framesPerSecond'] = report['framerateMean'] ? Math.ceil(report['framerateMean']) : report['framesPerSecond'] ? report['framesPerSecond'] : 0;
            tmpObject['frameHeight'] = report['frameHeight'] || (sender.track && sender.track.getSettings()['height']) || 0;
            tmpObject['frameWidth'] = report['frameWidth'] || (sender.track && sender.track.getSettings()['width']) || 0;
          }

          break;
        }
        case 'remote-inbound-rtp':
          calc_packetsLost = report['packetsLost'] - (previewStats.packetsLost || 0);

          fractionLost = ('fractionLost' in report ? report['fractionLost'] : null);
          this._newStats.rtt = report['roundTripTime'] && Math.floor(1e3 * report['roundTripTime']);
          if ('jitter' in report)
          {
            tmpObject['jitter'] = Math.floor(1e3 * report['jitter']);
          }
          tmpObject['packetsLost'] = report['packetsLost'];
          break;
        case 'codec':
          tmpObject['mimeType'] = report['mimeType'].split('/')[1];
          break;
        default:
          break;
      }
    });

    // 当前周期的计算值
    let loss = 0;

    try
    {
      loss = Math.floor(calc_packetsLost * 100 / calc_packetsSent);
    }
    catch (error) { }

    if (!calc_packetsSent)
    {
      loss = 100;
    }

    if (calc_packetsLost === null)
    {
      loss = 0;
    }

    if (fractionLost)
    {
      loss = Math.floor(fractionLost * 100);
    }

    tmpObject['calc_loss'] = isNaN(loss) ? 0 : loss;
    tmpObject['calc_speed'] = !calc_bytesSent ? 0 : (calc_bytesSent / this._delay * 8);

    !tmpObject['frameWidth'] && type!=='audio' && (tmpObject = {});

    // 合并统计结果
    (calc_packetsSent || calc_packetsSent === 0) && (this._newStats.upStreams[type]=tmpObject);
  }

  // 解析下行统计报告
  _parseReceiverReport(reports, receiver, shared, inform)
  {
    let type;
    let tmpObject = {};

    shared ? type = 'shared' : type = receiver.track.kind;

    // 前一次的统计结果
    const previewStats = this._newStats.downStreams[type];

    // 用于计算速率和丢包的值
    let calc_bytesReceived;
    let calc_packetsReceived;
    let calc_packetsLost;

    reports.forEach((report) =>
    {
      if (inform)
      {
        this._data += JSON.stringify(report);

        return;
      }

      switch (report.type)
      {
        case 'inbound-rtp':
        {
          // 用于计算速率和丢包的值
          calc_bytesReceived =report['bytesReceived'] > (previewStats.bytesReceived || 0) ? report['bytesReceived'] - (previewStats.bytesReceived || 0) : 0;
          calc_packetsReceived = report['packetsReceived'] > (previewStats.packetsReceived || 0) ? report['packetsReceived'] - (previewStats.packetsReceived || 0) : 0;
          calc_packetsLost = report['packetsLost'] > (previewStats.packetsLost || 0) ? report['packetsLost'] - (previewStats.packetsLost || 0) : 0;

          // 当前报告的原始值
          tmpObject['bytesReceived'] = report['bytesReceived'];
          tmpObject['packetsReceived'] = report['packetsReceived'] || 0;
          tmpObject['packetsLost'] = report['packetsLost'];
          if ('jitter' in report)
          {
            tmpObject['jitter'] = Math.floor(1e3 * report['jitter']);
          }
          if (report['kind'] === 'video')
          {
            report['framesReceived'] && (tmpObject['framesReceived'] = report['framesReceived']);
            tmpObject['framesDecoded'] = report['framesDecoded'] || 0;
            report['framerateMean'] && (tmpObject['framesPerSecond'] = Math.ceil(report['framerateMean']));
            report['framesPerSecond'] && (tmpObject['framesPerSecond'] = report['framesPerSecond']);
            // tmpObject['framesPerSecond'] = report['framerateMean'] ? Math.ceil(report['framerateMean']) : report['framesPerSecond'] ? report['framesPerSecond'] : 0;
            report['frameHeight'] && (tmpObject['frameHeight'] = report['frameHeight']);
            report['frameWidth'] && (tmpObject['frameWidth'] = report['frameWidth']);
          }
          break;
        }
        case 'codec':
          tmpObject['mimeType'] = report['mimeType'].split('/')[1];
          break;
        default:
          break;
      }
    });

    // 当前周期的计算值
    let loss = 0;

    try
    {
      loss = Math.floor(calc_packetsLost * 100 / (calc_packetsReceived + calc_packetsLost));
    }
    catch (error) { }

    if (!calc_bytesReceived)
    {
      loss = 100;
    }

    if (calc_packetsLost === null)
    {
      loss = 0;
    }

    tmpObject['calc_loss'] = loss;
    tmpObject['calc_speed'] = !calc_bytesReceived ? 0 : (calc_bytesReceived / this._delay * 8);

    calc_packetsReceived === 0 && (tmpObject = Object.assign({}, tmpObject, { packetsReceived: tmpObject['packetsReceived'], calc_speed: 0, calc_loss: 0, calc_bytesReceived: 0 }));
    // 合并统计结果
    (calc_packetsReceived || calc_packetsReceived === 0) && (this._newStats.downStreams[type] = tmpObject);
  }

  // 参考 https://blog.csdn.net/weixin_41821317/article/details/117261117
  // https://www.twilio.com/blog/2016/03/chrome-vs-firefox-webrtc-stats-api-with-twilio-video.html
  _createReport()
  {
    const newReport = formatStats(this._newStats);

    logger.debug(JSON.stringify(this._newStats));
    this.emit('report', {
      RTT         : newReport.rtt,
      upStreams   : newReport.upStreams,
      downStreams : newReport.downStreams
    });

    function formatStats(oldStats)
    {
      // 创建新的stats对象结构
      const newStats = {
        rtt   : oldStats.rtt,
        audio : {
          calc_uplink_loss   : 0,
          calc_downlink_loss : 0
        },
        video : {
          calc_uplink_loss   : 0,
          calc_downlink_loss : 0
        },
        upStreams   : [],
        downStreams : []
      };

      // 处理视频上下行流数据
      const oldUpStreams = oldStats.upStreams;
      const oldDownStreams = oldStats.downStreams;
      let maxUpLinkLoss = 0;
      let maxDownLinkLoss = 0;

      newStats.upStreams.push({
        type        : 'audio',
        mimeType    : oldUpStreams['audio'].mimeType,
        bytesSent   : oldUpStreams['audio'].bytesSent,
        packetsSent : oldUpStreams['audio'].packetsSent,
        loss        : oldUpStreams['audio'].calc_loss,
        jitter      : oldUpStreams['audio'].jitter,
        speed       : oldUpStreams['audio'].calc_speed === 0 ? 0 : (oldUpStreams['audio'].calc_speed / 1024).toFixed(1)
      });

      newStats.downStreams.push({
        type            : 'audio',
        mimeType        : oldDownStreams['audio'].mimeType,
        bytesReceived   : oldDownStreams['audio'].bytesReceived,
        packetsReceived : oldDownStreams['audio'].packetsReceived,
        loss            : oldDownStreams['audio'].calc_loss,
        jitter          : oldDownStreams['audio'].jitter,
        speed           : oldDownStreams['audio'].calc_speed === 0 ? 0: (oldDownStreams['audio'].calc_speed / 1024).toFixed(1)
      });

      // 计算video和shared的总和
      for (const type of [ 'video', 'shared' ])
      {
        if (Object.keys(oldUpStreams[type]).length > 1)
        {
          maxUpLinkLoss = Math.max(maxUpLinkLoss, oldUpStreams[type].calc_loss || 0);
          // 添加到新的upStreams数组
          newStats.upStreams.push({
            type            : type,
            mimeType        : oldUpStreams[type].mimeType,
            framesSent      : oldUpStreams[type].framesSent,
            framesEncoded   : oldUpStreams[type].framesEncoded,
            framesPerSecond : oldUpStreams[type].framesPerSecond,
            frameHeight     : oldUpStreams[type].frameHeight,
            frameWidth      : oldUpStreams[type].frameWidth,
            loss            : oldUpStreams[type].calc_loss,
            jitter          : oldUpStreams[type].jitter,
            speed           : oldUpStreams[type].calc_speed === 0 ? 0 : (oldUpStreams[type].calc_speed / 1024).toFixed(1)
          });
        }

        if (Object.keys(oldDownStreams[type]).length > 1)
        {
          maxDownLinkLoss = Math.max(maxDownLinkLoss, oldDownStreams[type].calc_loss || 0);
          // 添加到新的downStreams数组
          newStats.downStreams.push({
            type            : type,
            mimeType        : oldDownStreams[type].mimeType,
            framesReceived  : oldDownStreams[type].framesReceived,
            framesDecoded   : oldDownStreams[type].framesDecoded,
            framesPerSecond : oldDownStreams[type].framesPerSecond,
            frameHeight     : oldDownStreams[type].frameHeight,
            frameWidth      : oldDownStreams[type].frameWidth,
            loss            : oldDownStreams[type].calc_loss,
            jitter          : oldDownStreams[type].jitter,
            speed           : oldDownStreams[type].calc_speed === 0 ? 0 : (oldDownStreams[type].calc_speed / 1024).toFixed(1)
          });
        }
      }

      newStats.audio.calc_uplink_loss = oldUpStreams['audio'].calc_loss;
      newStats.audio.calc_downlink_loss = oldDownStreams['audio'].calc_loss;

      newStats.video.calc_uplink_loss = maxUpLinkLoss;
      newStats.video.calc_downlink_loss = maxDownLinkLoss;

      return newStats;
    }

    // 发送网络质量报告
    const RTT = [];
    const uplinkLoss = [];
    const uplinkNetworkQuality = [];
    const downlinkNetworkQuality = [];
    const downlinkLoss = [];

    RTT.push(newReport.rtt);
    // eslint-disable-next-line max-len
    uplinkLoss.push(newReport.audio.calc_uplink_loss > newReport.video.calc_uplink_loss ? newReport.audio.calc_uplink_loss : newReport.video.calc_uplink_loss);
    // eslint-disable-next-line max-len
    uplinkNetworkQuality.push(Utils.getNetworkQuality(newReport.audio.calc_uplink_loss > newReport.video.calc_uplink_loss ? newReport.audio.calc_uplink_loss : newReport.video.calc_uplink_loss, newReport.rtt));

    // eslint-disable-next-line max-len
    downlinkLoss.push(newReport.audio.calc_downlink_loss > newReport.video.calc_downlink_loss ? newReport.audio.calc_downlink_loss : newReport.video.calc_downlink_loss);
    // eslint-disable-next-line max-len
    downlinkNetworkQuality.push(Utils.getNetworkQuality(newReport.audio.calc_downlink_loss > newReport.video.calc_downlink_loss ? newReport.audio.calc_downlink_loss : newReport.video.calc_downlink_loss, newReport.rtt));
    this._networkQuality = {
      // eslint-disable-next-line max-len
      uplinkNetworkQuality   : uplinkNetworkQuality.length > 0 && (Math.floor(uplinkNetworkQuality.reduce((pre, cur) => pre + cur) / uplinkNetworkQuality.length) || 0),
      RTT                    : RTT.length > 0 && (Math.floor(RTT.reduce((pre, cur) => pre + cur) / RTT.length) || 0),
      // eslint-disable-next-line max-len
      uplinkLoss             : uplinkLoss.length > 0 && (Math.floor(uplinkLoss.reduce((pre, cur) => pre + cur) / uplinkLoss.length) || 0),
      // eslint-disable-next-line max-len
      downlinkNetworkQuality : downlinkNetworkQuality.length > 0 && (Math.floor(downlinkNetworkQuality.reduce((pre, cur) => pre + cur) / downlinkNetworkQuality.length) || 0),
      // eslint-disable-next-line max-len
      downlinkLoss           : downlinkLoss.length > 0 && (Math.floor(downlinkLoss.reduce((pre, cur) => pre + cur) / downlinkLoss.length) || 0)
    };

    logger.debug(`networkQuality: ${JSON.stringify(this._networkQuality)}`);
    this.emit('network-quality', this._networkQuality);
  }
};
