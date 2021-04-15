const EventEmitter = require('events');
const { Base64 } = require('js-base64');
const UA = require('../UA');
const WebSocketInterface = require('../WebSocketInterface');
const LocalStream = require('./LocalStream');
const RemoteStream = require('./RemoteStream');
const debug = require('debug')('FlyInn:RTC');
const debugerror = require('debug')('FlyInn:ERROR:RTC');
const callRouterPath = '/iapi/conf/join';
const sdpTransform = require('sdp-transform');

debugerror.log = console.warn.bind(console);

/**
 * @param {object} clientConfig
 * @param {string} clientConfig.call_router_url - callRouter 地址 url
 * @param {string} clientConfig.sdk_app_id - sdkAppID
 * @param {string} clientConfig.user_id - 用户ID
 * @param {string} clientConfig.user_sig - 签名信息
 * @class
 * @classdesc 音视频通话客户对象，可以通过createClient创建
 * @extends {EventEmitter}
 */
class Client extends EventEmitter
{
  constructor(clientConfig)
  {
    debug('new Client()');

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

    // 初始化 ua
    // initUA.call(this);
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
    this._roomId = roomId;
    this._options = options;
    this._dn = displayName;

    post(this._callRouterUrl+callRouterPath, { roomId: roomId }, { 'authorization': this._userSig, 'X-SID': this._sdkAppId, 'X-UID': this._userId }, (res) =>
    {
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

      const configuration={
        sockets        : new WebSocketInterface('wss://lccsp.zgpajf.com.cn:5092/wss'),
        uri            : `sip:${this._userId}@${res.data.sfu.domain}`,
        register       : this._register,
        session_timers : this._session_timers,
        display_name   : displayName
      };

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

      this._ua.on('registered', (data) =>
      {
        /**
         * 注册成功事件，注册后呼叫情况下使用
         *
         * @event Client#REGISTERED
         * @property {object} data
         */
        this.emit('registered', data);
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
      this._ua.on('registered', () =>
      {
        if (this._register)
        {
          setTimeout(() =>
          {
            call.call(this, String(res.data.roomId), this._options);
          }, this._timer);
        }
      });

      this._ua.on('connected', () =>
      {
        if (this._register)
        {
          return;
        }
        setTimeout(() =>
        {
          call.call(this, String(res.data.roomId), this._options);
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
    this._session.terminate();
    this._ua.stop();
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

/* Ajax请求 Pet */
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
let pcRecvVideo;
let prevSdp;

// 创建单独的pc
function createPC(sdp, that)
{
  // test start
  pcRecvVideo = new RTCPeerConnection();

  pcRecvVideo.ontrack=({ track, streams }) =>
  {
    // track.onunmute=() =>
    // {
    that.emit('stream-added', new RemoteStream(track));
    // };
  };

  that.emit('pc', pcRecvVideo);

  pcRecvVideo.addEventListener('onicegatheringstatechange', () =>
  {
    if ((pcRecvVideo.iceGatheringState === 'complete'))
    {
    // eslint-disable-next-line no-console
      console.log('pls: ', pcRecvVideo.localDescription.sdp);
    }
  });

  const answer = new RTCSessionDescription({ type: 'offer', sdp: sdp });

  // eslint-disable-next-line no-console
  return pcRecvVideo.setRemoteDescription(answer).then(() =>
  {
    return pcRecvVideo.createAnswer({
      offerToReceiveAudio : false,
      offerToReceiveVideo : true
    })
      .then((desc) =>
      {
        return pcRecvVideo.setLocalDescription(desc)
          .catch((error) =>
          {
            return Promise.reject(error);
          });
      })
      .then(() =>
      {
      // Resolve right away if 'pc.iceGatheringState' is 'complete'.
        if (pcRecvVideo.iceGatheringState === 'complete')
        {

          // eslint-disable-next-line no-console
          delete sdpTransform.parse(pcRecvVideo.localDescription.sdp).media[0].mid;
          const pcrvSdp=sdpTransform.parse(pcRecvVideo.localDescription.sdp).media[0];

          // cb(pcrvSdp);
          prevSdp = pcrvSdp;

          return pcrvSdp;
        }

        // Add 'pc.onicencandidate' event handler to resolve on last candidate.
        return new Promise(() =>
        {
          let finished = false;
          let iceCandidateListener;
          let iceGatheringStateListener;
          let iceGatheringDuration = 0;
          let iceGatheringTimer;
          let iceGatherFlag = true;

          const ready = () =>
          {
            pcRecvVideo.removeEventListener('icecandidate', iceCandidateListener);
            pcRecvVideo.removeEventListener('icegatheringstatechange', iceGatheringStateListener);

            // 清理 ICE 收集超时定时器
            clearInterval(iceGatheringTimer);
            finished = true;
            delete sdpTransform.parse(pcRecvVideo.localDescription.sdp).media[0].mid;
            const pcrvSdp=sdpTransform.parse(pcRecvVideo.localDescription.sdp).media[0];

            // cb(pcrvSdp);
            prevSdp = pcrvSdp;

            return pcrvSdp;
          };

          pcRecvVideo.addEventListener('icecandidate', iceCandidateListener = () =>
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

          pcRecvVideo.addEventListener('icegatheringstatechange', iceGatheringStateListener = () =>
          {
            if ((pcRecvVideo.iceGatheringState === 'complete') && !finished)
            {
              ready();
            }
          });
        });
      });
  });
}

let recvSdp;

function timeout(ms)
{
  return new Promise((resolve) =>
  {
    setTimeout(resolve, ms, 'done');
  });
}

function nSdp(sdp)
{
  return timeout(5000).then(() =>
  {
    const tmpSdp2= sdpTransform.parse(sdp);

    tmpSdp2.media.push(prevSdp);

    return sdpTransform.write(tmpSdp2);
  });
  // d.sdp=sdpTransform.write(tmpSdp2);
  // d.sdp = d.sdp.replace(/(?=a=ice-ufra)/g, `a=x-sfu-cname:${Base64.encode(JSON.stringify(cname))}\r\n`);
}

// 发起呼叫
function call(roomId, options)
{
  const self = this;

  // createPC((pcrvSdp) =>
  // {
  self._session = self._ua.call(roomId, options);
  // x-sfu-cname
  self._session.on('sdp', (d) =>
  {
    const cname = { 'userid': self._userId, 'dn': Base64.encode(self._dn) };

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
        d.sdp = nSdp(d.sdp).then((sdp) =>
        {
          return sdp.replace(/(?=a=ice-ufra)/g, `a=x-sfu-cname:${Base64.encode(JSON.stringify(cname))}\r\n`);
        });
      }
      else
      {
        d.sdp = d.sdp.replace(/(?=a=ice-ufra)/g, `a=x-sfu-cname:${Base64.encode(JSON.stringify(cname))}\r\n`);
      }
    }

    if (d.originator==='remote')
    {
      const tmpSdp = sdpTransform.parse(d.sdp);

      if (tmpSdp.media.length>2)
      {
        this._splitSdp=true;
        recvSdp = tmpSdp.media.pop();
        d.sdp = sdpTransform.write(tmpSdp);
        tmpSdp.media = [ recvSdp ];
        createPC(sdpTransform.write(tmpSdp), self);
      }
    }
  });

  // 根据Session Event触发Client Event给用户
  self._session.on('getusermediafailed', () =>
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
    self.emit('error', 'GETUSERMEDIAFAILED');
  });

  self._session.on('failed', (data) =>
  {
    self.emit('error', data.message.reason_phrase?data.message.reason_phrase:data.cause?data.cause:'failed');
  });

  self._session.on('peerconnection:createofferfailed', () =>
  {
    self.emit('error', 'CREATEOFFERFAILED');
  });

  self._session.on('peerconnection:createanswerfailed', () =>
  {
    self.emit('error', 'CREATEANSWERFAILED');
  });

  self._session.on('peerconnection:setlocaldescriptionfailed', () =>
  {
    self.emit('error', 'SETLOCALDESCRIPTIONFAILED');
  });

  self._session.on('peerconnection:setremotedescriptionfailed', () =>
  {
    self.emit('error', 'SETREMOTEDESCRIPTIONFAILED');
  });

  self._session.on('confirmed', () =>
  {
    const localTracks = [];

    self._session.connection.getSenders().forEach((sender) =>
    {
      if (
        sender.track &&
      sender.track.readyState === 'live'
      )
      {
        localTracks.push(sender.track);
      }
    });

    const localStream = new LocalStream({}, localTracks);

    localStream.session = self._session;
    localStream.custom = self._custom;

    if (localStream._videoBitrate)
    {
      const senders = self._session.connection.getSenders();

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
      const senders = self._session.connection.getSenders();

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
    localTracks.length > 0 && self.emit('local-joined', localStream);

    self._session.on('ended', () =>
    {
      /**
     * 本地已退出会议事件
     *
     * @event Client#LOCAL-LEAVE
     */
      self.emit('local-leave');
    });

    if (self._session.connection.getReceivers)
    {
      self._session.connection.getReceivers().forEach((receiver) =>
      {
        if (receiver.track.kind === 'audio')
        {
          /**
         * 新用户媒体加入会议事件
         *
         * @event Client#STREAM-ADDED
         * @property {object} data 远端媒体流对象
         */
          self.emit('stream-added', new RemoteStream(receiver.track));
        }
      });
    }
    else
    {
      self._session.connection.getRemoteStreams().forEach((stream) =>
      {
        self.emit('stream-added', new RemoteStream(stream.getTracks()[0]));
      });
    }
  });

  // 收到 reinvite 后触发 stream-added 事件
  self._session.on('reinvite', (d) =>
  {
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
            if (self._remoteStreams.get(trackId))
            {
              self._remoteStreams.get(trackId).cname = xSfuCname;

              /**
             * 远端入会事件
             *
             * @event Client#PEER-JOIN
             * @property {object} data
             * @property {string} data.userId - 用户ID
             */
              self.emit('peer-join', { userId: self._userId });

              self.emit('stream-added', self._remoteStreams.get(trackId));

              self._remoteStreams.delete(trackId);
            }
          }
        });
      }
    };
  });

  // 媒体变化, 触发媒体新增事件
  self._session.connection.addEventListener('track', ({ track }) =>
  {

    if (track.kind === 'video' && track.enabled)
    {
      const remoteStream = new RemoteStream(track);

      remoteStream.on('stream-removed', () =>
      {
        /**
       * 远端用户媒体流已经移除事件
       *
       * @event Client#STREAM-REMOVED
       * @property {object} data 远端媒体对象
       */
        self.emit('stream-removed', remoteStream);

        /**
       * 远端离会事件
       *
       * @event Client#PEER-LEAVE
       * @property {object} data
       * @property {string} data.userId - 用户ID
       */
        self.emit('peer-leave', { userId: self._userId });
      });

      self._remoteStreams.set(track.id, remoteStream);

      // this.emit('stream-added', remoteStream);
    }
  });
  // });
  // test end
}

module.exports = Client;