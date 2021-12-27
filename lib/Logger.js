const debug = require('debug');
const pkg = require('../package.json');

const APP_NAME = pkg.title;
const logs =[];

function pushToLogs(msg)
{
  const _log = `${new Date().toISOString()} ${msg}\n`;

  logs.push(_log);
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
    this._debug.log = console.info.bind(console);
    this._warn.log = console.warn.bind(console);
    this._error.log = console.error.bind(console);
    /* eslint-enable no-console */

    // TODO:Test
    this._debug = function(msg)
    {
      pushToLogs(msg);
    };

    // for upload
    this._uDebug = function(msg)
    {
      pushToLogs(msg);
    };

    this._uWarn = function(msg)
    {
      pushToLogs(msg);
    };

    this._uError = function(msg)
    {
      pushToLogs(msg);
    };
  }

  get debug()
  {
    return this._debug;
  }

  get uDebug()
  {
    return this._uDebug;
  }

  get warn()
  {
    return this._warn;
  }

  get uWarn()
  {
    return this._uWarn;
  }

  get error()
  {
    return this._error;
  }

  get uError()
  {
    return this._uError;
  }

  shiftLog()
  {
    return logs.shift();
  }

  clearLogs()
  {
    logs.length = 0;
  }
};
