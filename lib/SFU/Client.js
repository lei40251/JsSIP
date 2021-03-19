// const JsSIP_C = require('./Constants');
// const URI = require('./URI');
// const Grammar = require('./Grammar');
// const Utils = require('./Utils');
const { EventEmitter } = require('events');
const { Base64 } = require('js-base64');
const UA = require('../UA');
const WebSocketInterface = require('../WebSocketInterface');
const LocalStream = require('./LocalStream');
const RemoteStream = require('./RemoteStream');
const debug = require('debug')('FlyInn:RTC');
const debugerror = require('debug')('FlyInn:ERROR:RTC');

debugerror.log = console.warn.bind(console);
module.exports = class Client extends EventEmitter
{
  constructor(clientConfig)
  {
    debug('new Client()');

    super();

    this._domain = clientConfig.domain;
    this._userId = clientConfig.user_id;
    this._wssUrl = clientConfig.wss_url;
    this._userSig = clientConfig.user_sig;
    this._register = clientConfig.register || false;
    this._dn = clientConfig.display_name;

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

    // 初始化 ua
    initUA.call(this);
  }

  // 加入房间
  join(roomId, options = {})
  {
    this._roomId = roomId;
    this._options = options;

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
  }

  leave()
  {
    this._session.terminate();
    this._ua.stop();
  }

};

function initUA()
{
  const configuration={
    sockets        : new WebSocketInterface(this._wssUrl),
    uri            : `sip:${this._userId}@${this._domain}`,
    password       : this._userSig,
    session_timers : false
  };

  this._ua = new UA(configuration);

  // 根据UA Event触发Client Event给用户
  this._ua.on('connecting', () =>
  {
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
    this.emit('registered', data);
  });

  this._ua.on('registrationFailed', () =>
  {
    this.emit('error', 'REGISTRATIONFAILED');
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
        call.call(this, this._roomId, this._options);
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
      call.call(this, this._roomId, this._options);
    }, this._timer);
  });
}

function call(roomId, options)
{
  this._session = this._ua.call(roomId, options);
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
    d.sdp = d.sdp.replace(/(?=a=ice-ufra)/g, `a=x-sfu-cname:${Base64.encode(JSON.stringify(cname))}\r\n`);
  });

  // 根据Session Event触发Client Event给用户
  this._session.on('getusermediafailed', () =>
  {
    this.emit('error;', 'GETUSERMEDIAFAILED');
  });

  this._session.on('peerconnection:createofferfailed', () =>
  {
    this.emit('error;', 'CREATEOFFERFAILED');
  });

  this._session.on('peerconnection:createanswerfailed', () =>
  {
    this.emit('error;', 'CREATEANSWERFAILED');
  });

  this._session.on('peerconnection:setlocaldescriptionfailed', () =>
  {
    this.emit('error;', 'SETLOCALDESCRIPTIONFAILED');
  });

  this._session.on('peerconnection:setremotedescriptionfailed', () =>
  {
    this.emit('error;', 'SETREMOTEDESCRIPTIONFAILED');
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

    const localStream = new LocalStream({}, localTracks);

    localStream.session = this._session;
    localStream.custom = this._custom;

    localTracks.length > 0 && this.emit('local-joined', localStream);

    this._session.connection.getReceivers().forEach((receiver) =>
    {
      if (receiver.track.kind === 'audio')
      {
        this.emit('stream-added', new RemoteStream(receiver.track));
      }
    });
  });

  // 收到 reinvite 后触发 stream-added 事件
  this._session.on('reinvite', (d) =>
  {
    d.callback = () =>
    {
      const transceiverMids = new Map();
      const transceivers = this._session.connection.getTransceivers();

      for (let i = 0; i < transceivers.length; ++i)
      {
        transceiverMids.set(
          transceivers[i].mid,
          transceivers[i].receiver.track.id
        );
      }

      const medias = d.request['sdp'] ? d.request['sdp'].media : [];

      for (let i = 0; i < medias.length; ++i)
      {
        let xSfuCname = '';

        try
        {
          xSfuCname = JSON.parse(Base64.decode(medias[i].xSfuCname));
        }
        catch (error) {}

        if (this._remoteStreams.get(transceiverMids.get(String(i))))
        {
          this._remoteStreams.get(transceiverMids.get(String(i))).cname = xSfuCname;

          this.emit('stream-added', this._remoteStreams.get(transceiverMids.get(String(i))));

          this._remoteStreams.delete(transceiverMids.get(String(i)));
        }
      }
    };
  });

  this._session.on('ended', () =>
  {
    this.emit('local-left');
  });

  // 媒体变化, 触发媒体新增事件
  this._session.connection.addEventListener('track', (trackEvent) =>
  {
    if (trackEvent.track.kind === 'video' && trackEvent.track.enabled)
    {
      const remoteStream = new RemoteStream(trackEvent.track);

      remoteStream.on('stream-removed', () =>
      {
        this.emit('stream-removed', remoteStream);
      });

      this._remoteStreams.set(trackEvent.track.id, remoteStream);

      // this.emit('stream-added', remoteStream);
    }
  });
}