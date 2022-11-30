const debug = require('debug');

const APP_NAME = 'CRTC';

if (!window.CLog)
{
  window.CLog = console;
}

module.exports = class Logger
{
  constructor(prefix)
  {
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
    this._debug.log = window.CLog.info.bind(window.CLog);
    this._warn.log = window.CLog.warn.bind(window.CLog);
    this._error.log = window.CLog.error.bind(window.CLog);
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