
const Client = require('./Client');
const LocalStream = require('./LocalStream');

module.exports= {
  createClient : (clientConfig) =>
  {
    return new Client(clientConfig);
  },

  createStream : (streamConfig) =>
  {
    return new LocalStream(streamConfig);
  },

  isScreenShareSupported : () =>
  {
    return Boolean(navigator.mediaDevices.getDisplayMedia);
  },

  getDevices : () =>
  {
    return Promise.resolve()
      .then(() =>
      {
        return navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      })
      .then((stream) =>
      {
        stream.getTracks().forEach((track) =>
        {
          track.stop();
        });

        return navigator.mediaDevices.enumerateDevices();
      })
      .catch((e) => { return e; });
  },

  getCameras : () =>
  {
    return Promise.resolve()
      .then(() =>
      {
        return navigator.mediaDevices.getUserMedia({ video: true });
      })
      .then((stream) =>
      {
        stream.getTracks().forEach((track) =>
        {
          track.stop();
        });

        return navigator.mediaDevices.enumerateDevices();
      })
      .then((devices) =>
      {
        return devices.filter((dev) => { return dev.kind==='videoinput'; });
      })
      .catch((e) => { return e; });
  },

  getMicrophones : () =>
  {
    return Promise.resolve()
      .then(() =>
      {
        return navigator.mediaDevices.getUserMedia({ audio: true });
      })
      .then((stream) =>
      {
        stream.getTracks().forEach((track) =>
        {
          track.stop();
        });

        return navigator.mediaDevices.enumerateDevices();
      })
      .then((devices) =>
      {
        return devices.filter((dev) => { return dev.kind==='audioinput'; });
      })
      .catch((e) => { return e; });
  },

  getSpeakers : () =>
  {
    return Promise.resolve()
      .then(() =>
      {
        return navigator.mediaDevices.getUserMedia({ audio: true });
      })
      .then((stream) =>
      {
        stream.getTracks().forEach((track) =>
        {
          track.stop();
        });

        return navigator.mediaDevices.enumerateDevices();
      })
      .then((devices) =>
      {
        return devices.filter((dev) => { return dev.kind==='audiooutput'; });
      })
      .catch((e) => { return e; });
  }
};