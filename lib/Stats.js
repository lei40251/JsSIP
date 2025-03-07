/* eslint-disable no-unused-vars */
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
    this._pc = pc;
    this._delay = delay;
    this._interval = interval;

    // 多少次getStats后发送完整statsReport
    this._count = this._interval;

    this._statsTimer;

    // 基本传输信息
    this._transport = {
      RTT : null
    };

    // 使用Map存储音频统计信息
    this._audioStats = new Map();

    // 使用Map存储视频统计信息，key为ssrc或trackId
    this._videoStats = new Map();

    // 当前周期的变化量
    this._currentChanges = {
      audio : new Map(),
      video : new Map()
    };

    // 汇总的统计信息
    this._aggregatedStats = {
      audio : {
        bytesSent           : 0,
        packetsSent         : 0,
        packetsSentLost     : 0,
        bytesReceived       : 0,
        packetsReceived     : 0,
        packetsReceivedLost : 0,
        uplinkLoss          : null,
        uplinkSpeed         : null,
        downlinkLoss        : null,
        downlinkSpeed       : null
      },
      video : {
        bytesSent           : 0,
        packetsSent         : 0,
        packetsSentLost     : 0,
        bytesReceived       : 0,
        packetsReceived     : 0,
        packetsReceivedLost : 0,
        uplinkLoss          : null,
        uplinkSpeed         : null,
        downlinkLoss        : null,
        downlinkSpeed       : null,
        // 视频特有的统计信息
        framesEncoded       : 0,
        framesDecoded       : 0,
        framesSent          : 0,
        framesReceived      : 0,
        // 使用数组存储多个视频流的帧率和分辨率
        upStreams           : [],
        downStreams         : []
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
          this.parseReport(stats);
          if (this._count === 0)
          {
            // 第二次开始间隔5-10次输出一次完整report
            this._count = this._interval + (Math.random() * 5 | 0);
            this.parseReport(stats, true);
          }

          this._count--;
        });

      logger.debug(`pc status: cS: ${this._pc.connectionState} iS:${this._pc.iceConnectionState} sS:${this._pc.signalingState}`);

      try
      {
        this._pc.getSenders()
          .forEach((s) =>
          {
            if (s.track)
            {
              const trackStatus = `id: ${s.track.id}, enabled: ${s.track.enabled}, label: ${s.track.label},kind: ${s.track.kind},muted: ${s.track.muted},readyState: ${s.track.readyState},transport: ${s.transport.state && s.transport.state};`;

              logger.debug(`curr ${s.track.kind} track status: ${trackStatus}`);
              logger.debug(`settings: ${JSON.stringify(s.track.getSettings())} ***** constraints: ${JSON.stringify(s.track.getConstraints())} ***** capabilities: ${JSON.stringify(s.track.getCapabilities ? s.track.getCapabilities() : {})}`);
            }
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
  {
    this._transport = {
      RTT : null
    };

    this._audioStats.clear();
    this._videoStats.clear();

    this._currentChanges = {
      audio : new Map(),
      video : new Map()
    };

    this._aggregatedStats = {
      audio : {
        bytesSent           : 0,
        packetsSent         : 0,
        packetsSentLost     : 0,
        bytesReceived       : 0,
        packetsReceived     : 0,
        packetsReceivedLost : 0,
        uplinkLoss          : null,
        uplinkSpeed         : null,
        downlinkLoss        : null,
        downlinkSpeed       : null
      },
      video : {
        bytesSent           : 0,
        packetsSent         : 0,
        packetsSentLost     : 0,
        bytesReceived       : 0,
        packetsReceived     : 0,
        packetsReceivedLost : 0,
        uplinkLoss          : null,
        uplinkSpeed         : null,
        downlinkLoss        : null,
        downlinkSpeed       : null,
        framesEncoded       : 0,
        framesDecoded       : 0,
        framesSent          : 0,
        framesReceived      : 0,
        upStreams           : [],
        downStreams         : []
      }
    };
  }

  // 重置聚合统计信息
  _resetAggregatedStats()
  {
    // 重置音频统计信息
    this._aggregatedStats.audio.bytesSent = 0;
    this._aggregatedStats.audio.packetsSent = 0;
    this._aggregatedStats.audio.packetsSentLost = 0;
    this._aggregatedStats.audio.bytesReceived = 0;
    this._aggregatedStats.audio.packetsReceived = 0;
    this._aggregatedStats.audio.packetsReceivedLost = 0;

    // 重置视频统计信息
    this._aggregatedStats.video.bytesSent = 0;
    this._aggregatedStats.video.packetsSent = 0;
    this._aggregatedStats.video.packetsSentLost = 0;
    this._aggregatedStats.video.bytesReceived = 0;
    this._aggregatedStats.video.packetsReceived = 0;
    this._aggregatedStats.video.packetsReceivedLost = 0;
    this._aggregatedStats.video.framesEncoded = 0;
    this._aggregatedStats.video.framesDecoded = 0;
    this._aggregatedStats.video.framesSent = 0;
    this._aggregatedStats.video.framesReceived = 0;
    this._aggregatedStats.video.upStreams = [];
    this._aggregatedStats.video.downStreams = [];
  }

  // 参考 https://blog.csdn.net/weixin_41821317/article/details/117261117
  // https://www.twilio.com/blog/2016/03/chrome-vs-firefox-webrtc-stats-api-with-twilio-video.html
  parseReport(stats, inform)
  {
    let data = null;

    // 清空当前周期的变化量
    this._currentChanges.audio.clear();
    this._currentChanges.video.clear();

    // 清空聚合统计信息
    this._resetAggregatedStats();

    stats.forEach((report) =>
    {
      if (inform)
      {
        data = data ? data + JSON.stringify(report) : JSON.stringify(report);

        return;
      }

      switch (report.type)
      {
        case 'remote-inbound-rtp':
          if (!report['packetsLost'])
          {
            break;
          }

          if (report.kind === 'video')
          {
            const id = report.ssrc || report.id;
            const prevStats = this._videoStats.get(id) || {};
            const currentStats = Object.assign({}, prevStats, {
              packetsSentLost : report['packetsLost']
            });

            // 计算当前周期的变化量
            const change = {
              packetsSentLost : report['packetsLost'] - (prevStats.packetsSentLost || 0)
            };

            this._videoStats.set(id, currentStats);
            this._currentChanges.video.set(id, Object.assign({}, this._currentChanges.video.get(id) || {}, change));
          }
          else if (report.kind === 'audio')
          {
            const id = report.ssrc || report.id;
            const prevStats = this._audioStats.get(id) || {};
            const currentStats = Object.assign({}, prevStats, {
              packetsSentLost : report['packetsLost']
            });

            // 计算当前周期的变化量
            const change = {
              packetsSentLost : report['packetsLost'] - (prevStats.packetsSentLost || 0)
            };

            this._audioStats.set(id, currentStats);
            this._currentChanges.audio.set(id, Object.assign({}, this._currentChanges.audio.get(id) || {}, change));
          }
          break;

        case 'candidate-pair':
          if (report['state'] !== 'succeeded')
          {
            break;
          }
          else
          {
            this._transport.RTT = Math.floor(1e3 * report['currentRoundTripTime']);
          }
          break;

        case 'outbound-rtp':
          if (report.kind === 'video')
          {
            const id = report.ssrc || report.id;
            const prevStats = this._videoStats.get(id) || {};
            const currentStats = Object.assign({}, prevStats, {
              packetsSent     : report['packetsSent'],
              bytesSent       : report['bytesSent'],
              frameHeight     : report['frameHeight'],
              frameWidth      : report['frameWidth'],
              framesEncoded   : report['framesEncoded'],
              framesSent      : report['framesSent'],
              framesPerSecond : report['framesPerSecond'],
              mediaSourceId   : report['mediaSourceId'],
              contentType     : report['contentType']
            });

            // 计算当前周期的变化量
            const change = {
              packetsSent : report['packetsSent'] - (prevStats.packetsSent || 0),
              bytesSent   : report['bytesSent'] - (prevStats.bytesSent || 0)
            };

            this._videoStats.set(id, currentStats);
            this._currentChanges.video.set(id, Object.assign({}, this._currentChanges.video.get(id) || {}, change));

            // 添加到上行流信息
            if (currentStats.frameHeight && currentStats.frameWidth)
            {
              // 更新过滤逻辑，只排除特定的测试流
              const isTestStream = currentStats.frameHeight === 48 &&
                                  currentStats.frameWidth === 64 &&
                                  currentStats.framesPerSecond === 1 &&
                                  !currentStats.contentType;

              if (!isTestStream)
              {
                this._aggregatedStats.video.upStreams.push({
                  id,
                  frameHeight     : currentStats.frameHeight,
                  frameWidth      : currentStats.frameWidth,
                  framesPerSecond : currentStats.framesPerSecond,
                  contentType     : currentStats.contentType || 'video',
                  type            : report.mid == sessionStorage.getItem(CRTC_C.BFCP_SHARED_STREAM_INDEX)?'shared':report.mid
                });
              }
            }
          }
          else if (report.kind === 'audio')
          {
            const id = report.ssrc || report.id;
            const prevStats = this._audioStats.get(id) || {};
            const currentStats = Object.assign({}, prevStats, {
              packetsSent : report['packetsSent'],
              bytesSent   : report['bytesSent']
            });

            // 计算当前周期的变化量
            const change = {
              packetsSent : report['packetsSent'] - (prevStats.packetsSent || 0),
              bytesSent   : report['bytesSent'] - (prevStats.bytesSent || 0)
            };

            this._audioStats.set(id, currentStats);
            this._currentChanges.audio.set(id, Object.assign({}, this._currentChanges.audio.get(id) || {}, change));
          }
          break;

        case 'inbound-rtp':
          if (report.kind === 'video')
          {
            const id = report.ssrc || report.id;
            const prevStats = this._videoStats.get(id) || {};
            const currentStats = Object.assign({}, prevStats, {
              packetsReceived     : report['packetsReceived'],
              bytesReceived       : report['bytesReceived'],
              packetsReceivedLost : report['packetsLost'],
              frameHeight         : report['frameHeight'],
              frameWidth          : report['frameWidth'],
              framesDecoded       : report['framesDecoded'],
              framesReceived      : report['framesReceived'],
              framesPerSecond     : report['framesPerSecond']
            });

            // 计算当前周期的变化量
            const change = {
              packetsReceived     : report['packetsReceived'] - (prevStats.packetsReceived || 0),
              bytesReceived       : report['bytesReceived'] - (prevStats.bytesReceived || 0),
              packetsReceivedLost : report['packetsLost'] - (prevStats.packetsReceivedLost || 0)
            };

            this._videoStats.set(id, currentStats);
            this._currentChanges.video.set(id, Object.assign({}, this._currentChanges.video.get(id) || {}, change));

            // 添加到下行流信息
            if (currentStats.frameHeight && currentStats.frameWidth)
            {
              // 添加所有接收到的视频流，不进行过滤
              this._aggregatedStats.video.downStreams.push({
                id,
                frameHeight     : currentStats.frameHeight,
                frameWidth      : currentStats.frameWidth,
                framesPerSecond : currentStats.framesPerSecond || 0,
                contentType     : report.contentType || 'video',
                type            : report.mid == sessionStorage.getItem(CRTC_C.BFCP_TRANSCEIVER_INDEX)?'shared':report.mid
              });
            }
          }
          else if (report.kind === 'audio')
          {
            const id = report.ssrc || report.id;
            const prevStats = this._audioStats.get(id) || {};
            const currentStats = Object.assign({}, prevStats, {
              packetsReceived     : report['packetsReceived'],
              bytesReceived       : report['bytesReceived'],
              packetsReceivedLost : report['packetsLost']
            });

            // 计算当前周期的变化量
            const change = {
              packetsReceived     : report['packetsReceived'] - (prevStats.packetsReceived || 0),
              bytesReceived       : report['bytesReceived'] - (prevStats.bytesReceived || 0),
              packetsReceivedLost : report['packetsLost'] - (prevStats.packetsReceivedLost || 0)
            };

            this._audioStats.set(id, currentStats);
            this._currentChanges.audio.set(id, Object.assign({}, this._currentChanges.audio.get(id) || {}, change));
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

    // 计算聚合统计信息
    this._calculateAggregatedStats();

    // 计算网络质量
    this._calculateNetworkQuality();

    // 生成报告
    const report = this._generateReport();

    logger.debug(JSON.stringify(this._aggregatedStats));
    this.emit('report', report);
    this.emit('network-quality', this._networkQuality);
  }

  // 计算聚合统计信息
  _calculateAggregatedStats()
  {
    // 计算音频聚合统计信息
    for (const [ id, stats ] of this._audioStats.entries())
    {
      // 上行统计
      if (stats.packetsSent !== undefined)
      {
        this._aggregatedStats.audio.bytesSent += stats.bytesSent || 0;
        this._aggregatedStats.audio.packetsSent += stats.packetsSent || 0;
      }

      // 上行丢包
      if (stats.packetsSentLost !== undefined)
      {
        this._aggregatedStats.audio.packetsSentLost += stats.packetsSentLost || 0;
      }

      // 下行统计
      if (stats.packetsReceived !== undefined)
      {
        this._aggregatedStats.audio.bytesReceived += stats.bytesReceived || 0;
        this._aggregatedStats.audio.packetsReceived += stats.packetsReceived || 0;
      }

      // 下行丢包
      if (stats.packetsReceivedLost !== undefined)
      {
        this._aggregatedStats.audio.packetsReceivedLost += stats.packetsReceivedLost || 0;
      }
    }

    // 计算视频聚合统计信息
    for (const [ id, stats ] of this._videoStats.entries())
    {
      // 上行统计
      if (stats.packetsSent !== undefined)
      {
        this._aggregatedStats.video.bytesSent += stats.bytesSent || 0;
        this._aggregatedStats.video.packetsSent += stats.packetsSent || 0;
        this._aggregatedStats.video.framesEncoded += stats.framesEncoded || 0;
        this._aggregatedStats.video.framesSent += stats.framesSent || 0;
      }

      // 上行丢包
      if (stats.packetsSentLost !== undefined)
      {
        this._aggregatedStats.video.packetsSentLost += stats.packetsSentLost || 0;
      }

      // 下行统计
      if (stats.packetsReceived !== undefined)
      {
        this._aggregatedStats.video.bytesReceived += stats.bytesReceived || 0;
        this._aggregatedStats.video.packetsReceived += stats.packetsReceived || 0;
        this._aggregatedStats.video.framesDecoded += stats.framesDecoded || 0;
        this._aggregatedStats.video.framesReceived += stats.framesReceived || 0;
      }

      // 下行丢包
      if (stats.packetsReceivedLost !== undefined)
      {
        this._aggregatedStats.video.packetsReceivedLost += stats.packetsReceivedLost || 0;
      }
    }

    // 计算音频上行丢包率
    if (this._aggregatedStats.audio.packetsSent > 0 && this._aggregatedStats.audio.packetsSentLost >= 0)
    {
      this._aggregatedStats.audio.uplinkLoss = Math.floor(
        (this._aggregatedStats.audio.packetsSentLost * 100) /
        (this._aggregatedStats.audio.packetsSentLost + this._aggregatedStats.audio.packetsSent)
      );
    }

    // 计算音频下行丢包率
    if (this._aggregatedStats.audio.packetsReceived > 0 && this._aggregatedStats.audio.packetsReceivedLost >= 0)
    {
      this._aggregatedStats.audio.downlinkLoss = Math.floor(
        (this._aggregatedStats.audio.packetsReceivedLost * 100) /
        (this._aggregatedStats.audio.packetsReceivedLost + this._aggregatedStats.audio.packetsReceived)
      );
    }

    // 计算视频上行丢包率
    if (this._aggregatedStats.video.packetsSent > 0 && this._aggregatedStats.video.packetsSentLost >= 0)
    {
      this._aggregatedStats.video.uplinkLoss = Math.floor(
        (this._aggregatedStats.video.packetsSentLost * 100) /
        (this._aggregatedStats.video.packetsSentLost + this._aggregatedStats.video.packetsSent)
      );
    }

    // 计算视频下行丢包率
    if (this._aggregatedStats.video.packetsReceived > 0 && this._aggregatedStats.video.packetsReceivedLost >= 0)
    {
      this._aggregatedStats.video.downlinkLoss = Math.floor(
        (this._aggregatedStats.video.packetsReceivedLost * 100) /
        (this._aggregatedStats.video.packetsReceivedLost + this._aggregatedStats.video.packetsReceived)
      );
    }

    // 计算音频上行速率
    const audioBytesSentChanges = Array.from(this._currentChanges.audio.values())
      .reduce((sum, change) => sum + (change.bytesSent || 0), 0);

    this._aggregatedStats.audio.uplinkSpeed = audioBytesSentChanges / this._delay * 8;

    // 计算音频下行速率
    const audioBytesReceivedChanges = Array.from(this._currentChanges.audio.values())
      .reduce((sum, change) => sum + (change.bytesReceived || 0), 0);

    this._aggregatedStats.audio.downlinkSpeed = audioBytesReceivedChanges / this._delay * 8;

    // 计算视频上行速率
    const videoBytesSentChanges = Array.from(this._currentChanges.video.values())
      .reduce((sum, change) => sum + (change.bytesSent || 0), 0);

    this._aggregatedStats.video.uplinkSpeed = videoBytesSentChanges / this._delay * 8;

    // 计算视频下行速率
    const videoBytesReceivedChanges = Array.from(this._currentChanges.video.values())
      .reduce((sum, change) => sum + (change.bytesReceived || 0), 0);

    this._aggregatedStats.video.downlinkSpeed = videoBytesReceivedChanges / this._delay * 8;
  }

  // 计算网络质量
  _calculateNetworkQuality()
  {
    // 获取最大丢包率
    const maxUplinkLoss = Math.max(
      this._aggregatedStats.audio.uplinkLoss || 0,
      this._aggregatedStats.video.uplinkLoss || 0
    );

    const maxDownlinkLoss = Math.max(
      this._aggregatedStats.audio.downlinkLoss || 0,
      this._aggregatedStats.video.downlinkLoss || 0
    );

    // 计算上行和下行网络质量
    const uplinkNetworkQuality = Utils.getNetworkQuality(maxUplinkLoss, this._transport.RTT);
    const downlinkNetworkQuality = Utils.getNetworkQuality(maxDownlinkLoss, this._transport.RTT);

    this._networkQuality = {
      uplinkNetworkQuality   : uplinkNetworkQuality,
      RTT                    : this._transport.RTT || 0,
      uplinkLoss             : maxUplinkLoss,
      downlinkNetworkQuality : downlinkNetworkQuality,
      downlinkLoss           : maxDownlinkLoss
    };
  }

  // 生成报告
  _generateReport()
  {
    const rp = {
      transport : {
        RTT : this._transport.RTT
      },
      audio : {
        bytesSent       : this._aggregatedStats.audio.bytesSent,
        packetsSent     : this._aggregatedStats.audio.packetsSent,
        uplinkLoss      : this._aggregatedStats.audio.uplinkLoss,
        uplinkSpeed     : this._aggregatedStats.audio.uplinkSpeed,
        bytesReceived   : this._aggregatedStats.audio.bytesReceived,
        packetsReceived : this._aggregatedStats.audio.packetsReceived,
        downlinkLoss    : this._aggregatedStats.audio.downlinkLoss,
        downlinkSpeed   : this._aggregatedStats.audio.downlinkSpeed
      },
      video : {
        bytesSent       : this._aggregatedStats.video.bytesSent,
        packetsSent     : this._aggregatedStats.video.packetsSent,
        framesSent      : this._aggregatedStats.video.framesSent,
        framesEncoded   : this._aggregatedStats.video.framesEncoded,
        uplinkLoss      : this._aggregatedStats.video.uplinkLoss,
        uplinkSpeed     : this._aggregatedStats.video.uplinkSpeed,
        bytesReceived   : this._aggregatedStats.video.bytesReceived,
        packetsReceived : this._aggregatedStats.video.packetsReceived,
        framesReceived  : this._aggregatedStats.video.framesReceived,
        framesDecoded   : this._aggregatedStats.video.framesDecoded,
        downlinkLoss    : this._aggregatedStats.video.downlinkLoss,
        downlinkSpeed   : this._aggregatedStats.video.downlinkSpeed,
        upStreams       : this._aggregatedStats.video.upStreams,
        downStreams     : this._aggregatedStats.video.downStreams
      }
    };

    // 返回格式化的报告
    return {
      RTT           : rp.transport.RTT,
      upStreams     : rp.video.upStreams,
      downStreams   : rp.video.downStreams,
      uplinkSpeed   : `${((rp.video.uplinkSpeed + rp.audio.uplinkSpeed) / 1000).toFixed(1)}kbps`,
      downlinkSpeed : `${((rp.video.downlinkSpeed + rp.audio.downlinkSpeed) / 1000).toFixed(1)}kbps`,
      downlinkLoss  : `${Math.max(rp.audio.downlinkLoss || 0, rp.video.downlinkLoss || 0)}%`,
      uplinkLoss    : `${Math.max(rp.audio.uplinkLoss || 0, rp.video.uplinkLoss || 0)}%`
    };
  }
};