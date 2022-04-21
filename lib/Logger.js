/* eslint-disable prefer-rest-params */
/* eslint-disable no-console */
const debug = require('debug');
const pkg = require('../package.json');

const APP_NAME = pkg.title;

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
    this._debug.log = (function(oriLogFunc) 
    {
      // 可处理日志
      return function() 
      {
        try 
        {
          oriLogFunc.call(console, ...arguments);
          // console.error(...arguments);
        }
        catch (e)
        {
          // eslint-disable-next-line no-console
          console.error('console.log error', e);
        }
      };
    })(console.log);
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
