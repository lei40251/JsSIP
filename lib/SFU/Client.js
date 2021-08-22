/* eslint-disable no-console */
const EventEmitter = require('events');
const { Base64 } = require('js-base64');
const UA = require('../UA');
const WebSocketInterface = require('../WebSocketInterface');
const LocalStream = require('./LocalStream');
const RemoteStream = require('./RemoteStream');
const log = require('./Logger');
const debug = require('debug')('FlyInn:SFU');
const debugerror = require('debug')('FlyInn:ERROR:SFU');
const callRouterPath = '/iapi/conf/join';
const sdpTransform = require('sdp-transform');

let prevSdp;
let localStream;
let isReinvite = false;
const tracks = new Set();

debugerror.log = console.warn.bind(console);

/**
 * @param {object} clientConfig
 * @param {string} clientConfig.call_router_url - callRouter 地址 url
 * @param {string} clientConfig.sdk_app_id - sdkAppID
 * @param {string} clientConfig.user_id - 用户ID
 * @param {string} clientConfig.user_sig - 签名信息
 * @param {string} clientConfig.log_url - 日志上传地址
 * @class
 * @classdesc 音视频通话客户对象，可以通过createClient创建
 * @extends {EventEmitter}
 */
class Client extends EventEmitter
{
  constructor(clientConfig)
  {
    debug('new Client()');
    log.debug('new Client()');

    log.enableUploadLog({ user_id: clientConfig.user_id, log_url: clientConfig.log_url });
    super();

    this._callRouterUrl = clientConfig.call_router_url;
    this._userId = clientConfig.user_id;
    this._sdkAppId = clientConfig.sdk_app_id;
    this._userSig = clientConfig.user_sig;
    this._register = clientConfig.register || false;
    this._session_timers = clientConfig.session_timers || false;
    this._dn = null;

    // 远端视频Map，临时存储拥有cname
    this._remoteStreams = new Map();
    // 是否用户自定义视频流
    this._custom = false;
    // 会话sip session
    this._session = null;
    // 会话 sip UA
    this._ua = null;

    // 会议房间 ID
    this._roomId = null;
    // 呼叫参数
    this._options = {};
    // 延迟发起呼叫，避免事务冲突
    this._timer = 50;

    this._splitSdp = false;

    this._pcConfig = null;

    // 是否可以继续发起呼叫
    this._canCall = false;

    // 初始化 ua
    // initUA.call(this);
  }

  uploadDebug()
  {
    // remote.apply(log, defaults);
    // loglevelServerSend(log);

    setTimeout(() =>
    {
      log.info('Log levels:');
      log.trace('trace message');
      log.debug('debug message');
      log.info('info message');
      log.warn('warn message');
      log.error('error message');
    }, 5000);
  }

  /**
   * 加入房间，房间不存在则创建
   *
   * @param {string} roomId - 房间号
   * @param {string} displayName - 显示名（可以为中文）
   * @param {object} [options={}]
   * @param {MediaStream} [options.mediaStream] - 本地媒体流，则默认调用麦克风、摄像头获取
   * @param {array} [options.pcConfig] - turn服务器设置 [{urls:'turn:example.com:666',username:'',credential:''}]
   * @param {string} [options.iceTransportPolicy=all] - ICE协商策略, 'relay':强制使用TURN, 'all':任何类型
   * @param {string} [options.preferredVideoCodec] - 首选的视频编码 vp8 h264
   * @memberof Client
   */
  join(roomId, displayName, options = { iceTransportPolicy: 'all' })
  {
    debug('join()');
    log.debug('join()');

    if (this._session)
    {
      return;
    }

    this._canCall = true;

    this._roomId = roomId;
    this._options = options;
    this._dn = displayName;

    post(this._callRouterUrl+callRouterPath, { roomId: roomId }, { 'authorization': this._userSig, 'X-SID': this._sdkAppId, 'X-UID': this._userId, 'X-FLG': 2 }, (res) =>
    {
      if (!this._canCall)
      {
        this.emit('error', 'Canceled');

        return;
      }

      if (res.code !== 1000)
      {
        /**
         * 加入房间失败事件
         *
         * @event Client#JOIN-ROOM-FAILED
         * @property {string} code - code 列表另附
         * @memberof Client
         */
        this.emit('join-room-failed', res.code);

        return;
      }

      this.pcConfig={
        iceTransportPolicy : 'relay',
        iceServers         : [
          {
            urls       : [ ],
            username   : res.data.relay.auth.authname,
            credential : res.data.relay.auth.token
          }
        ]
      };

      res.data.relay && res.data.relay.server.forEach((server) =>
      {
        const serverArr = server.split('|');

        this.pcConfig.iceServers[0].urls.push(`turn:${serverArr[0]}:${serverArr[1]}?transport=${serverArr[2]}`);
      });

      if (this.pcConfig.iceServers[0].urls.length>0)
      {
        // TODO: 测试用
        this._options.pcConfig=this.pcConfig;
      }

      const sockets=[];

      res.data.sfu.server.forEach((ser) =>
      {
        sockets.push(new WebSocketInterface(`wss://${ser.domain}:${ser.port}/${ser.uri}?${ser.queryString}`));
      });

      const configuration={
        // sockets        : new WebSocketInterface('wss://lccsp.vsbc.com:7777/ws?st=mpjpZLbindWLAVmUt6WcgmCSUxo&ts=1618905683&e=172800&dest=192.168.23.178:5092'),
        // sockets        : new WebSocketInterface('wss://lccsp.zgpajf.com.cn:5092/wss'),
        // TODO:测试用
        // sockets        : new WebSocketInterface('wss://a.vsbc.com:5062/wss'),
        sockets        : sockets,
        uri            : `sip:${this._userId}@${res.data.sfu.domain}`,
        register       : this._register,
        session_timers : this._session_timers,
        display_name   : displayName
      };

      this._options['extraHeaders']= [ `X-AuthName:${res.data.sfu.auth.authname}`, `X-Token:${res.data.sfu.auth.token}` ];

      this._ua = new UA(configuration);

      // 根据UA Event触发Client Event给用户
      this._ua.on('connecting', () =>
      {
        /**
         * WebSocket 信令通道连接状态变化事件
         *
         * @event Client#CONNECTION-STATE-CHANGED
         * @property {string} data - CONNECTING 连接中，CONNECTED 已连接，DISCONNECTED 已断开
         */
        this.emit('connection-state-changed', 'CONNECTING');
      });

      this._ua.on('connected', () =>
      {
        this.emit('connection-state-changed', 'CONNECTED');
      });

      this._ua.on('disconnected', () =>
      {
        this.emit('connection-state-changed', 'DISCONNECTED');
      });

      this._ua.on('registrationFailed', () =>
      {
        /**
         * 注册失败事件，注册后呼叫情况下使用
         *
         * @event Client#REGISTRATIONFAILED
         * @property {object} data
         */
        this.emit('registrationFailed', 'REGISTRATIONFAILED');
      });

      // 避免415
      this._ua.on('newMessage', (e) =>
      {
      // eslint-disable-next-line no-console
        console.log('new Message: ', JSON.parse(e.request.body));
      });

      // 需要注册则注册成功后发起呼叫；否则连接成功发起呼叫
      this._ua.on('registered', (data) =>
      {
        /**
         * 注册成功事件，注册后呼叫情况下使用
         *
         * @event Client#REGISTERED
         * @property {object} data
         */
        this.emit('registered', data);

        if (this._session)
        {
          return;
        }

        if (this._register)
        {
          setTimeout(() =>
          {
            // 是否取消了呼叫
            if (!this._canCall)
            {
              this.emit('error', 'Canceled');

              return;
            }

            call.call(this, String(res.data.confId), this._options);
          }, this._timer);
        }
      });

      this._ua.on('connected', () =>
      {
        if (this._register)
        {
          return;
        }

        if (this._session)
        {
          return;
        }

        setTimeout(() =>
        {
          // 是否取消了呼叫
          if (!this._canCall)
          {
            this.emit('error', 'Canceled');

            return;
          }
          call.call(this, String(res.data.confId), this._options);
        }, this._timer);
      });

      // 如果入会参数包含媒体信息，则为用户自定义媒体流
      if (options.mediaStream)
      {
        this._custom = true;
      }
      else
      {
        this._custom = false;
      }

      this._ua.start();
    }, () =>
    {
      this.emit('JOIN_ROOM_FAILED', 'HTTP ERROR');
    });
  }

  /**
   * 离开房间
   *
   * @memberof Client
   */
  leave()
  {
    debug('leave()');
    log.debug('leave()');

    try
    {
      // 取消呼叫
      this._canCall = false;
      // 退出时关闭新创建的pc
      this._remoteStreams.forEach((track) =>
      {
        track.peer.close();
      });

      localStream && localStream.close();
      this._session && this._session.terminate();
      this._ua.stop();
    }
    catch (error) { }
  }

  /**
   * 监听客户端对象事件
   *
   * @param {string} eventName - 事件名称
   * @param {function} handler - 事件处理方法
   * @memberof Client
   */
  on(eventName, handler)
  {
    this.addListener(eventName, handler);
  }

  /**
   * 解除事件绑定
   *
   * @param {string} eventName - 事件名称
   * @param {function} handler - 事件处理方法
   * @memberof Client
   */
  off(eventName, handler)
  {
    this.removeListener(eventName, handler);
  }
}

/* Ajax请求 Post */
function post(url, data, headers={}, callback, errorHandle)
{
  if (typeof data === 'function')
  {
    callback = data;
    data = null;
  }
  const xhr = new XMLHttpRequest();

  xhr.addEventListener('error', (e) => { errorHandle(e); });
  xhr.open('post', url);
  xhr.onload = function()
  {
    callback(JSON.parse(xhr.responseText));
  };

  for (const key in headers)
  {
    if ({}.hasOwnProperty.call(headers, key))
    {
      xhr.setRequestHeader(key, headers[key]);
    }
  }
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify(data));
}

// 创建单独的pc
function createPC(pc, sdp, that)
{
  if (!pc.peer)
  {
    pc.peer = new RTCPeerConnection(that.pcConfig/* { sdpSemantics: 'plan-b' } */);

    pc.peer.ontrack=({ track/* , streams */ }) =>
    {
      const remoteStream = new RemoteStream(track);

      if (!tracks.has(track.id))
      {
        tracks.add(track.id);
        // track.onunmute=() =>
        // {
        // that.emit('stream-added', remoteStream);
        // };
      }

      remoteStream.on('stream-removed', (id) =>
      {
        tracks.delete(id);
        that.emit('stream-removed', remoteStream);
        that.emit('peer-leave', { userId: that._userId });
      });

      that._remoteStreams.set(track.id, remoteStream);
    };
  }

  that.emit('pc', pc.peer);

  pc.peer.addEventListener('onicegatheringstatechange', () =>
  {
    if ((pc.peer.iceGatheringState === 'complete'))
    {
    // eslint-disable-next-line no-console
      // console.log('pls: ', pc.peer.localDescription.sdp);
    }
  });

  const answer = new RTCSessionDescription({ type: 'offer', sdp: sdp });

  // eslint-disable-next-line no-console
  return pc.peer.setRemoteDescription(answer).then(() =>
  {
    return pc.peer.createAnswer({
      offerToReceiveAudio : false,
      offerToReceiveVideo : true
    })
      .then((desc) =>
      {
        return pc.peer.setLocalDescription(desc)
          .catch((error) =>
          {
            return Promise.reject(error);
          });
      })
      .then(() =>
      {
        // Resolve right away if 'pc.iceGatheringState' is 'complete'.
        if (pc.peer.iceGatheringState === 'complete')
        {
          // eslint-disable-next-line no-console
          delete sdpTransform.parse(pc.peer.localDescription.sdp).media[0].mid;
          const pcrvSdp=sdpTransform.parse(pc.peer.localDescription.sdp).media[0];

          // cb(pcrvSdp);
          // prevSdp = pcrvSdp;

          return Promise.resolve(pcrvSdp);
        }

        // Add 'pc.onicencandidate' event handler to resolve on last candidate.
        return new Promise((resolve) =>
        {
          let finished = false;
          let iceCandidateListener;
          let iceGatheringStateListener;
          let iceGatheringDuration = 0;
          let iceGatheringTimer;
          let iceGatherFlag = true;

          const ready = () =>
          {
            pc.peer.removeEventListener('icecandidate', iceCandidateListener);
            pc.peer.removeEventListener('icegatheringstatechange', iceGatheringStateListener);

            // 清理 ICE 收集超时定时器
            clearInterval(iceGatheringTimer);
            finished = true;
            delete sdpTransform.parse(pc.peer.localDescription.sdp).media[0].mid;
            const pcrvSdp=sdpTransform.parse(pc.peer.localDescription.sdp).media[0];

            // cb(pcrvSdp);
            // prevSdp = pcrvSdp;

            return resolve(pcrvSdp);
          };

          pc.peer.addEventListener('icecandidate', iceCandidateListener = () =>
          {
            // 添加 ice 收集超时控制
            if (iceGatherFlag)
            {
              iceGatherFlag = false;
              iceGatheringTimer = setInterval(() =>
              {
                iceGatheringDuration -= 100;
                if (iceGatheringDuration<=0)
                {
                  ready();
                }
              }, 100);
            }

            else if (!finished)
            {
              ready();
            }
          });

          pc.peer.addEventListener('icegatheringstatechange', iceGatheringStateListener = () =>
          {
            if ((pc.peer.iceGatheringState === 'complete') && !finished)
            {
              ready();
            }
          });
        });
      });
  });
}

function timeout(ms)
{
  return new Promise((resolve) =>
  {
    setTimeout(resolve, ms, 'done');
  });
}

function nSdp(sdp)
{
  return timeout(1000).then(() =>
  {
    const tmpSdp2= sdpTransform.parse(sdp);

    tmpSdp2.media.push(...prevSdp);
    prevSdp=[];

    return sdpTransform.write(tmpSdp2);
  });
}

// 发起呼叫
function call(confId, options)
{
  // 清理tracks值
  tracks.clear();
  // 单独创建的 RTCPeerConnection 数组，存放对应pc数据、状态等
  let pcArr=[];

  this._session = this._ua.call(confId, options);

  // x-sfu-cname
  this._session.on('sdp', (d) =>
  {
    const cname = { 'userid': this._userId, 'dn': Base64.encode(this._dn) };

    d.sdp = d.sdp
      .replace(/network-id [^1][^\d*].*$/gm, '@')
      .replace(
        /(a=cand.*9 typ.*(\n|(\r\n)))|(a=cand.*@(\n|(\r\n)))|(a=.*generation [^0].*(\n|(\r\n)))|(a=mid:.*(\n|(\r\n)))|(a=group:BUNDLE.*(\n|(\r\n)))/g,
        ''
      );

    if (d.originator === 'local')
    {
      if (this._splitSdp)
      {
        d.sdp = d.sdp.replace(/(?=a=ice-ufra)/g, `a=x-sfu-cname:${Base64.encode(JSON.stringify(cname))}\r\n`);

        d.sdp = nSdp(d.sdp).then((sdp) =>
        {
          return sdp;
        });
      }
      else
      {
        d.sdp = d.sdp.replace(/(?=a=ice-ufra)/g, `a=x-sfu-cname:${Base64.encode(JSON.stringify(cname))}\r\n`);
      }
    }

    if (d.originator==='remote' && isReinvite)
    {
      isReinvite = false;
      const tmpSdp = sdpTransform.parse(d.sdp);

      if (tmpSdp.media.length>2)
      {
        // 判断响应事务是否需要等待sdp信息
        this._splitSdp=true;
        // 需要单独创建 pc 的sdp分离
        const recvMediaArr = tmpSdp.media.splice(2, tmpSdp.media.length);

        // 发送媒体对应pc的信息写回
        d.sdp = sdpTransform.write(tmpSdp);

        // 开始处理需要单独创建pc的媒体sdp
        // tmpSdp.media=recvSdp;

        if (pcArr.length===0)
        {
          // 添加第一个远端媒体的 reinvite
          recvMediaArr.forEach((media) =>
          {
            let ssrc_cname;

            // 获取 ssrc 的 cname
            media.ssrcs.forEach((ssrc) =>
            {
              if (ssrc.attribute==='cname')
              {
                ssrc_cname=ssrc.value;
              }
            });
            // 添加到 pcArr
            pcArr.push({ peer: null, media: media, ssrc_cname: ssrc_cname });
          });

          console.log('pcArr 1: ', pcArr);
        }
        else
        {
          const nPCArr=[];

          // 后续 reinvite
          for (let i=0; i<recvMediaArr.length; ++i)
          {
            let ssrc_cname;

            recvMediaArr[i].ssrcs.forEach((ssrc) =>
            {
              if (ssrc.attribute==='cname')
              {
                ssrc_cname=ssrc.value;
              }
            });

            for (let j = 0; j<=pcArr.length; ++j)
            {
              if (j === pcArr.length)
              {
                // 如果新收到媒体数量多于原来，后面媒体直接添加
                nPCArr.push(
                  { peer: null, media: recvMediaArr[i], ssrc_cname: ssrc_cname }
                );
                break;
              }

              if (ssrc_cname === pcArr[j].ssrc_cname)
              {
                // 媒体对应的pc已经存在的,更新原数据
                if (recvMediaArr[i].direction==='inactive')
                {
                  pcArr[j].peer.close();
                }
                else
                {
                  // 添加到新数组
                  nPCArr.push(
                    {
                      peer       : pcArr[j].peer,
                      media      : recvMediaArr[i],
                      ssrc_cname : pcArr[j].ssrc_cname
                    }
                  );
                }
                pcArr[j].peer=null;
                break;
              }
            }
          }

          pcArr.forEach((pc) =>
          {
            pc.peer && pc.peer.close();
          });

          pcArr= nPCArr;
          console.log('pcArr 2: ', pcArr);
        }

        const self = this;

        Promise.all(
          pcArr.map((pc) =>
          {
            // if (pc.media.direction==='inactive')
            // {
            //   // pc.peer.close();
            //   console.log(pc.peer.getReceivers);
            //   pc.peer.getReceivers()
            //     .forEach((receiver) =>
            //     {
            //       receiver.track.stop();
            //     });
            // }
            tmpSdp.media=[ pc.media ];

            return createPC(pc, sdpTransform.write(tmpSdp), self);
          })
        )
          .then((mediaArr) =>
          {
            prevSdp = mediaArr;
            // console.log('prevSdp: ', prevSdp);
          })
          .catch((e) =>
          {
            console.log('E: ', e);
          });
      }
    }
  });

  // 根据Session Event触发Client Event给用户
  this._session.on('getusermediafailed', () =>
  {
    /**
   * 错误事件
   *
   * @event Client#ERROR
   * @property {string} GETUSERMEDIAFAILED - 获取媒体设备失败
   * @property {string} CREATEOFFERFAILED - 呼叫失败
   * @property {string} CREATEANSWERFAILED - 应答失败
   * @property {string} SETLOCALDESCRIPTIONFAILED - 设置本端描述失败
   * @property {string} SETREMOTEDESCRIPTIONFAILED - 设备远端描述失败
   * @property {string} - 其他
   */
    this.emit('error', 'GETUSERMEDIAFAILED');
  });

  this._session.on('failed', (data) =>
  {
    this.emit('error', data.message?data.message:data.cause?data.cause:'failed');
    this._session = null;
    this._ua.stop();
  });

  this._session.on('peerconnection:createofferfailed', () =>
  {
    this.emit('error', 'CREATEOFFERFAILED');
    this._session = null;
  });

  this._session.on('peerconnection:createanswerfailed', () =>
  {
    this.emit('error', 'CREATEANSWERFAILED');
    this._session = null;
  });

  this._session.on('peerconnection:setlocaldescriptionfailed', () =>
  {
    this.emit('error', 'SETLOCALDESCRIPTIONFAILED');
    this._session = null;
  });

  this._session.on('peerconnection:setremotedescriptionfailed', () =>
  {
    this.emit('error', 'SETREMOTEDESCRIPTIONFAILED');
    this._session = null;
  });

  this._session.on('confirmed', () =>
  {
    const localTracks = [];

    this._session.connection.getSenders().forEach((sender) =>
    {
      if (
        sender.track &&
      sender.track.readyState === 'live'
      )
      {
        localTracks.push(sender.track);
      }
    });

    localStream = new LocalStream({}, localTracks);

    localStream.session = this._session;
    localStream.custom = this._custom;

    if (localStream._videoBitrate)
    {
      const senders = this._session.connection.getSenders();

      senders.forEach((sender) =>
      {
        if (sender.track.kind === 'video')
        {
          const parameters = sender.getParameters();

          parameters.encodings[0].maxBitrate = localStream._videoBitrate*1024;
          sender.setParameters(parameters);
        }
      });
    }

    if (localStream._audioBitrate)
    {
      const senders = this._session.connection.getSenders();

      senders.forEach((sender) =>
      {
        if (sender.track.kind === 'audio')
        {
          const parameters = sender.getParameters();

          parameters.encodings[0].maxBitrate = localStream._audioBitrate*1024;
          sender.setParameters(parameters);
        }
      });
    }

    /**
   * 本地已加入会议事件
   *
   * @event Client#LOCAL-JOINED
   * @property {object} data - 本地媒体流对象
   */
    localTracks.length > 0 && this.emit('local-joined', localStream);

    this._session.on('ended', () =>
    {
      /**
       * 本地已退出会议事件
       *
       * @event Client#LOCAL-LEAVE
       */
      this.emit('local-leave');
      this._session = null;
      this._ua.stop();
    });

    if (this._session.connection.getReceivers)
    {
      this._session.connection.getReceivers().forEach((receiver) =>
      {
        if (receiver.track.kind === 'audio')
        {
          /**
         * 新用户媒体加入会议事件
         *
         * @event Client#STREAM-ADDED
         * @property {object} data 远端媒体流对象
         */
          this.emit('stream-added', new RemoteStream(receiver.track));
        }
      });
    }
    // else
    // {
    //   this._session.connection.getRemoteStreams().forEach((stream) =>
    //   {
    //     this.emit('stream-added', new RemoteStream(stream.getTracks()[0]));
    //   });
    // }
  });

  // 收到 reinvite 后触发 stream-added 事件
  this._session.on('reinvite', (d) =>
  {
    isReinvite=true;
    d.callback = () =>
    {
      const medias = d.request['sdp'] ? d.request['sdp'].media : [];

      for (let i = 0; i < medias.length; ++i)
      {
        const ssrcs = medias[i].ssrcs||[];

        let xSfuCname = '';

        try
        {
          xSfuCname = JSON.parse(Base64.decode(medias[i].xSfuCname));
        }
        catch (error) {}

        ssrcs.forEach((ssrc) =>
        {
          let trackId;

          if (ssrc.attribute==='msid')
          {
            trackId = ssrc.value.split(' ')[1];
            if (this._remoteStreams.get(trackId))
            {
              this._remoteStreams.get(trackId).cname = xSfuCname;

              /**
             * 远端入会事件
             *
             * @event Client#PEER-JOIN
             * @property {object} data
             * @property {string} data.userId - 用户ID
             */
              this.emit('peer-join', { userId: xSfuCname.userid });

              this.emit('stream-added', this._remoteStreams.get(trackId));

              this._remoteStreams.delete(trackId);
            }
          }
        });
      }
    };
  });

  // 媒体变化, 触发媒体新增事件
  this._session.connection.addEventListener('track', ({ track }) =>
  {

    if (track.kind === 'video' && track.enabled)
    {
      const remoteStream = new RemoteStream(track);

      remoteStream.on('stream-removed', (id) =>
      {
        tracks.delete(id);

        /**
       * 远端用户媒体流已经移除事件
       *
       * @event Client#STREAM-REMOVED
       * @property {object} data 远端媒体对象
       */
        this.emit('stream-removed', remoteStream);

        /**
       * 远端离会事件
       *
       * @event Client#PEER-LEAVE
       * @property {object} data
       * @property {string} data.userId - 用户ID
       */
        this.emit('peer-leave', { userId: this._userId });
      });

      this._remoteStreams.set(track.id, remoteStream);

      // this.emit('stream-added', remoteStream);
    }
  });
  // });
  // test end
}

module.exports = Client;