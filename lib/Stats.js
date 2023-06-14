const EventEmitter = require('events').EventEmitter;
const Utils = require('./Utils');
const Logger = require('./Logger');

const logger = new Logger('Stats');

module.exports = class getStats extends EventEmitter
{
  constructor(pc, delay = 1)
  {
    super();
    this._pc = pc;
    this._delay = delay;

    // 多少次getStats后发送完整statsReport
    this._count = 5;

    this._statsTimer;
    this._stats = {
      transport : {
        RTT : null
      },
      audio : {
        bytesSent           : null,
        packetsSent         : null,
        packetsSentLost     : null,
        bytesReceived       : null,
        packetsReceived     : null,
        packetsReceivedLost : null,
        // uplinkRTT           : null,
        uplinkLoss          : null,
        uplinkSpeed         : null,
        // downlinkRTT         : null,
        downlinkLoss        : null,
        downlinkSpeed       : null
      },
      video : {
        packetsSent         : null,
        packetsSentLost     : null,
        packetsReceived     : null,
        packetsReceivedLost : null,
        bytesSent           : null,
        bytesReceived       : null,
        // uplinkRTT           : null,
        uplinkLoss          : null,
        uplinkSpeed         : null,
        // downlinkRTT         : null,
        downlinkLoss        : null,
        downlinkSpeed       : null,
        framesEncoded       : null,
        framesDecoded       : null,
        framesSent          : null,
        framesReceived      : null,
        upFrameHeight       : null,
        upFrameWidth        : null,
        downFrameHeight     : null,
        downFrameWidth      : null
      }
    };

    this._cStats = {
      audio : {
        bytesSent           : null,
        packetsSent         : null,
        packetsSentLost     : null,
        bytesReceived       : null,
        packetsReceived     : null,
        packetsReceivedLost : null
      },
      video : {
        packetsSent         : null,
        packetsSentLost     : null,
        packetsReceived     : null,
        packetsReceivedLost : null,
        bytesSent           : null,
        bytesReceived       : null
      }
    };

    this.start();
  }

  start()
  {
    this._statsTimer = setInterval(() =>
    {
      this._pc.getStats().then((stats) =>
      {
        this.parseReport(stats);
        if (this._count === 0)
        {
          this.parseReport(stats, true);
        }
      });
      this._count--;
      logger.debug(`cS: ${this._pc.connectionState} iS:${this._pc.iceConnectionState} sS:${this._pc.signalingState}`);

    }, this._delay * 1000);
  }

  stop()
  {
    clearInterval(this._statsTimer);
    this._count = 5;
  }

  reset()
  {
    this._stats = {
      transport : {
        RTT : null
      },
      audio : {
        bytesSent           : null,
        packetsSent         : null,
        packetsSentLost     : null,
        bytesReceived       : null,
        packetsReceived     : null,
        packetsReceivedLost : null,
        // uplinkRTT           : null,
        uplinkLoss          : null,
        uplinkSpeed         : null,
        // downlinkRTT         : null,
        downlinkLoss        : null,
        downlinkSpeed       : null
      },
      video : {
        packetsSent         : null,
        packetsSentLost     : null,
        packetsReceived     : null,
        packetsReceivedLost : null,
        bytesSent           : null,
        bytesReceived       : null,
        // uplinkRTT           : null,
        uplinkLoss          : null,
        uplinkSpeed         : null,
        // downlinkRTT         : null,
        downlinkLoss        : null,
        downlinkSpeed       : null,
        framesEncoded       : null,
        framesDecoded       : null,
        framesSent          : null,
        framesReceived      : null,
        upFrameHeight       : null,
        upFrameWidth        : null,
        downFrameHeight     : null,
        downFrameWidth      : null
      }
    };
  }

  // 参考 https://blog.csdn.net/weixin_41821317/article/details/117261117
  // https://www.twilio.com/blog/2016/03/chrome-vs-firefox-webrtc-stats-api-with-twilio-video.html
  parseReport(stats, inform)
  {
    let data = null;

    stats.forEach((report) =>
    {
      if (inform)
      {
        data += JSON.stringify(report);
      }

      switch (report.type)
      {
        case 'remote-inbound-rtp':
          if (report.kind === 'video')
          {
            this._cStats.video.packetsSentLost = report['packetsLost'] - (this._stats.video.packetsSentLost?this._stats.video.packetsSentLost:0);
            this._stats.video.packetsSentLost = report['packetsLost'];
          }
          else if (report.kind === 'audio')
          {
            this._cStats.audio.packetsSentLost = report['packetsLost'] - (this._stats.audio.packetsSentLost?this._stats.audio.packetsSentLost:0);
            this._stats.audio.packetsSentLost = report['packetsLost'];
          }
          break;
        case 'candidate-pair':
          if (report['state'] !== 'succeeded')
          {
            break;
          }
          else
          {
            this._stats.transport.RTT =Math.floor(1e3 * report['currentRoundTripTime']);
          }
          break;
        case 'outbound-rtp':
          if (report.kind === 'video')
          {
            this._cStats.video.packetsSent = report['packetsSent'] - (this._stats.video.packetsSent?this._stats.video.packetsSent:0);
            this._cStats.video.bytesSent = report['bytesSent'] - (this._stats.video.bytesSent?this._stats.video.bytesSent:0);

            this._stats.video.packetsSent = report['packetsSent'];
            this._stats.video.bytesSent = report['bytesSent'];

            this._stats.video.upFrameHeight = report['frameHeight'];
            this._stats.video.upFrameWidth = report['frameWidth'];
            this._stats.video.framesEncoded = report['framesEncoded'];
            this._stats.video.framesSent = report['framesSent'];
          }
          else if (report.kind === 'audio')
          {
            this._cStats.audio.packetsSent = report['packetsSent'] - (this._stats.audio.packetsSent?this._stats.audio.packetsSent:0);
            this._cStats.audio.bytesSent = report['bytesSent'] - (this._stats.audio.bytesSent?this._stats.audio.bytesSent:0);

            this._stats.audio.packetsSent = report['packetsSent'];
            this._stats.audio.bytesSent = report['bytesSent'];
          }
          break;
        case 'inbound-rtp':
          if (report.kind === 'video')
          {
            this._cStats.video.packetsReceived = report['packetsReceived'] - (this._stats.video.packetsReceived?this._stats.video.packetsReceived:0);
            this._cStats.video.bytesReceived = report['bytesReceived'] - (this._stats.video.bytesReceived?this._stats.video.bytesReceived:0);
            this._cStats.video.packetsReceivedLost = report['packetsLost'] - (this._stats.video.packetsReceivedLost?this._stats.video.packetsReceivedLost:0);

            this._stats.video.packetsReceived = report['packetsReceived'];
            this._stats.video.bytesReceived = report['bytesReceived'];
            this._stats.video.packetsReceivedLost = report['packetsLost'];

            this._stats.video.downFrameHeight = report['frameHeight'];
            this._stats.video.downFrameWidth = report['frameWidth'];
            this._stats.video.framesDecoded = report['framesDecoded'];
            this._stats.video.framesReceived = report['framesReceived'];
          }
          else if (report.kind === 'audio')
          {
            this._cStats.audio.packetsReceived = report['packetsReceived'] - (this._stats.audio.packetsReceived?this._stats.audio.packetsReceived:0);
            this._cStats.audio.bytesReceived = report['bytesReceived'] - (this._stats.audio.bytesReceived?this._stats.audio.bytesReceived:0);
            this._cStats.audio.packetsReceivedLost = report['packetsLost'] - (this._stats.audio.packetsReceivedLost?this._stats.audio.packetsReceivedLost:0);

            this._stats.audio.packetsReceived = report['packetsReceived'];
            this._stats.audio.bytesReceived = report['bytesReceived'];
            this._stats.audio.packetsReceivedLost = report['packetsLost'];
          }
          break;
        default:
          break;
      }
    });

    if (data)
    {
      logger.debug(data);
    }

    // 语音上行丢包率
    if (this._cStats.audio.packetsSent === null)
    {
      this._stats.audio.uplinkLoss = null;
    }
    else if (this._cStats.audio.packetsSentLost === null)
    {
      this._stats.audio.uplinkLoss = null;
    }
    else
    {
      let audioUplinkLoss = 0;

      if (this._cStats.audio.packetsSent === 0)
      {
        audioUplinkLoss = 100;
      }
      else
      {
        audioUplinkLoss = Math.floor((this._cStats.audio.packetsSentLost*100/
        (this._cStats.audio.packetsSentLost + this._cStats.audio.packetsSent)));
      }

      if (audioUplinkLoss >= 0)
      {
        this._stats.audio.uplinkLoss = audioUplinkLoss;
      }
    }

    // 语音上行速率
    if (this._cStats.audio.bytesSent === null)
    {
      this._stats.audio.uplinkSpeed = null;
    }
    else
    {
      this._stats.audio.uplinkSpeed =
          this._cStats.audio.bytesSent / this._delay * 8;
    }

    // 语音下行丢包率
    if (this._cStats.audio.packetsReceived === null)
    {
      this._stats.audio.downlinkLoss = null;
    }
    else
    if (this._cStats.audio.packetsReceivedLost === null)
    {
      this._stats.audio.downlinkLoss = null;
    }
    else
    {
      let audioDownlinkLoss = 0;

      if (this._cStats.audio.packetsReceived === 0)
      {
        audioDownlinkLoss = 100;
      }
      else
      {
        audioDownlinkLoss = Math.floor(this._cStats.audio.packetsReceivedLost*100/
        (this._cStats.audio.packetsReceivedLost + this._cStats.audio.packetsReceived));
      }

      if (audioDownlinkLoss >= 0)
      {
        this._stats.audio.downlinkLoss = audioDownlinkLoss;
      }
    }

    // 语音下行速率
    if (this._cStats.audio.bytesReceived === null)
    {
      this._stats.audio.downlinkSpeed = null;
    }
    else
    {
      this._stats.audio.downlinkSpeed =
          this._cStats.audio.bytesReceived / this._delay * 8;
    }

    // 视频上行丢包率
    if (this._cStats.video.packetsSent === null)
    {
      this._stats.video.uplinkLoss = null;
    }
    else
    if (this._cStats.video.packetsSentLost === null)
    {
      this._stats.video.uplinkLoss = null;
    }
    else
    {
      let videoUplinkLoss = 0;

      if (this._cStats.video.packetsSent === 0)
      {
        videoUplinkLoss = 100;
      }
      else
      {
        videoUplinkLoss = Math.floor((this._cStats.video.packetsSentLost*100/
        (this._cStats.video.packetsSentLost + this._cStats.video.packetsSent)));
      }

      if (videoUplinkLoss >= 0)
      {
        this._stats.video.uplinkLoss = videoUplinkLoss;
      }
    }

    // 视频上行速率
    if (this._cStats.video.bytesSent === null)
    {
      this._stats.video.uplinkSpeed = null;
    }
    else
    {
      this._stats.video.uplinkSpeed =
          this._cStats.video.bytesSent / this._delay * 8;
    }

    // 视频下行丢包率
    if (this._cStats.video.packetsReceived === null || this._cStats.video.packetsReceivedLost === null)
    {
      this._stats.video.downlinkLoss = null;
    }
    else
    {
      let videoDownlinkLoss = 0;

      if (this._cStats.video.packetsReceived === 0)
      {
        videoDownlinkLoss = 100;
      }
      else
      {
        videoDownlinkLoss = Math.floor(this._cStats.video.packetsReceivedLost*100/
        (this._cStats.video.packetsReceivedLost + this._cStats.video.packetsReceived));
      }

      if (videoDownlinkLoss >= 0)
      {
        this._stats.video.downlinkLoss = videoDownlinkLoss;
      }
    }

    // 视频下行速率
    if (this._cStats.video.bytesReceived === null)
    {
      this._stats.video.downlinkSpeed = null;
    }
    else
    {
      this._stats.video.downlinkSpeed =
            this._cStats.video.bytesReceived / this._delay * 8;
    }


    function parseStatsReport(report)
    {
      const rp = {
        transport : {
          RTT : report.transport.RTT
        },
        audio : {
          bytesSent       : report.audio.bytesSent,
          packetsSent     : report.audio.packetsSent,
          uplinkLoss      : report.audio.uplinkLoss,
          uplinkSpeed     : report.audio.uplinkSpeed,
          bytesReceived   : report.audio.bytesReceived,
          packetsReceived : report.audio.packetsReceived,
          downlinkLoss    : report.audio.downlinkLoss,
          downlinkSpeed   : report.audio.downlinkSpeed
        },
        video : {
          bytesSent       : report.video.bytesSent,
          packetsSent     : report.video.packetsSent,
          framesSent      : report.video.framesSent,
          framesEncoded   : report.video.framesEncoded,
          upFrameWidth    : report.video.upFrameWidth,
          upFrameHeight   : report.video.upFrameHeight,
          uplinkLoss      : report.video.uplinkLoss,
          uplinkSpeed     : report.video.uplinkSpeed,
          bytesReceived   : report.video.bytesReceived,
          packetsReceived : report.video.packetsReceived,
          framesReceived  : report.video.framesReceived,
          framesDecoded   : report.video.framesDecoded,
          downFrameWidth  : report.video.downFrameWidth,
          downFrameHeight : report.video.downFrameHeight,
          downlinkLoss    : report.video.downlinkLoss,
          downlinkSpeed   : report.video.downlinkSpeed
        }
      };

      return {
        RTT             : rp.transport.RTT,
        upFrameWidth    : rp.video.upFrameWidth,
        upFrameHeight   : rp.video.upFrameHeight,
        downFrameWidth  : rp.video.downFrameWidth,
        downFrameHeight : rp.video.downFrameHeight,
        uplinkSpeed     : `${((rp.video.uplinkSpeed + rp.audio.uplinkSpeed)/1000).toFixed(1) }kbps`,
        downlinkSpeed   : `${((rp.video.downlinkSpeed + rp.audio.downlinkSpeed)/1000).toFixed(1) }kbps`,
        downlinkLoss    : `${rp.audio.downlinkLoss > rp.video.downlinkLoss ? rp.audio.downlinkLoss : rp.video.downlinkLoss }%`,
        uplinkLoss      : `${rp.audio.uplinkLoss > rp.video.uplinkLoss ? rp.audio.uplinkLoss : rp.video.uplinkLoss }%`
      };
    }

    logger.debug(JSON.stringify(this._stats));
    this.emit('report', parseStatsReport(this._stats));

    // 发送网络质量报告
    const RTT = [];
    const uplinkLoss = [];
    const uplinkNetworkQuality = [];
    const downlinkNetworkQuality = [];
    const downlinkLoss = [];

    RTT.push(this._stats.transport.RTT);
    // eslint-disable-next-line max-len
    uplinkLoss.push(this._stats.audio.uplinkLoss > this._stats.video.uplinkLoss ? this._stats.audio.uplinkLoss : this._stats.video.uplinkLoss);
    // eslint-disable-next-line max-len
    uplinkNetworkQuality.push(Utils.getNetworkQuality(this._stats.audio.uplinkLoss > this._stats.video.uplinkLoss ? this._stats.audio.uplinkLoss : this._stats.video.uplinkLoss, this._stats.transport.RTT));


    // eslint-disable-next-line max-len
    downlinkLoss.push(this._stats.audio.downlinkLoss > this._stats.video.downlinkLoss ? this._stats.audio.downlinkLoss : this._stats.video.downlinkLoss);
    // eslint-disable-next-line max-len
    downlinkNetworkQuality.push(Utils.getNetworkQuality(this._stats.audio.downlinkLoss > this._stats.video.downlinkLoss ? this._stats.audio.downlinkLoss : this._stats.video.downlinkLoss, this._stats.transport.RTT));

    this._networkQuality = {
      // eslint-disable-next-line max-len
      uplinkNetworkQuality   : uplinkNetworkQuality.length > 0 ? Math.floor(uplinkNetworkQuality.reduce((pre, cur) => pre + cur)/uplinkNetworkQuality.length)||0 : 0,
      RTT                    : RTT.length > 0 ? Math.floor(RTT.reduce((pre, cur) => pre + cur)/RTT.length)||0 : 0,
      // eslint-disable-next-line max-len
      uplinkLoss             : uplinkLoss.length > 0 ? Math.floor(uplinkLoss.reduce((pre, cur) => pre + cur)/uplinkLoss.length)||0 : 0,
      // eslint-disable-next-line max-len
      downlinkNetworkQuality : downlinkNetworkQuality.length > 0 ? Math.floor(downlinkNetworkQuality.reduce((pre, cur) => pre + cur)/downlinkNetworkQuality.length)||0 : 0,
      // eslint-disable-next-line max-len
      downlinkLoss           : downlinkLoss.length > 0 ? Math.floor(downlinkLoss.reduce((pre, cur) => pre + cur)/downlinkLoss.length)||0 : 0
    };

    logger.debug(`networkQuality: ${JSON.stringify(this._networkQuality)}`);
    this.emit('network-quality', this._networkQuality);
  }
};