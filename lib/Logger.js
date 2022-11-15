/* eslint-disable no-console */
/* eslint-disable prefer-rest-params */
const debug = require('debug');
const APP_NAME = 'CRTC';
// const _info = console.info;
// const _warn = console.warn;
// const _error = console.error;

// function parseLog(msg)
// {
//   console.log(`${new Date().toISOString()} → ${msg.replace(/%c/g, '')}`);
// }

module.exports = class Logger
{
  constructor(prefix)
  {
    /* eslint-disable no-console */
    // console.info = function(msg)
    // {
    //   parseLog(msg);
    //   _info.apply(console, arguments);
    // };

    // console.warn = function(msg)
    // {
    //   parseLog(msg);
    //   _warn.apply(console, arguments);
    // };

    // console.error = function(msg)
    // {
    //   parseLog(msg);
    //   _error.apply(console, arguments);
    // };

    if (prefix)
    {
      this._debug = debug.default(`${APP_NAME}:${prefix}`);
      this._warn = debug.default(`${APP_NAME}:WARN:${prefix}`);
      this._error = debug.default(`${APP_NAME}:ERROR:${prefix}`);
    }
    else
    {
      this._debug = debug.default(APP_NAME);
      this._warn = debug.default(`${APP_NAME}:WARN`);
      this._error = debug.default(`${APP_NAME}:ERROR`);
    }
    /* eslint-disable no-console */
    this._debug.log = console.info.bind(console);
    this._warn.log = console.warn.bind(console);
    this._error.log = console.error.bind(console);
    /* eslint-enable no-console */
  }

  get debug()
  {
    return this._debug;
  }

  get warn()
  {
    return this._warn;
  }

  get error()
  {
    return this._error;
  }
};
