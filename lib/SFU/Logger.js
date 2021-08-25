/* eslint-disable no-mixed-operators */
const HmacSHA256 = require('crypto-js/hmac-sha256');
const Utils = require('../Utils');

const log = require('loglevel');
const { Base64 } = require('js-base64');

const url = 'https://pro.vsbc.com:6082/clog/log';

let CIRCULAR_ERROR_MESSAGE;
let uploadLog = true;
let uid = null;
let host = 'pro.vsbc.com';

function getStacktrace()
{
  try
  {
    throw new Error();
  }
  catch (trace)
  {
    return trace.stack;
  }
}

// 尝试序列化
function tryStringify(arg)
{
  try
  {
    return JSON.stringify(arg);
  }
  catch (error)
  {
    // Populate the circular error message lazily
    if (!CIRCULAR_ERROR_MESSAGE)
    {
      try
      {
        const a = {};

        a.a = a;
        JSON.stringify(a);
      }
      catch (circular)
      {
        CIRCULAR_ERROR_MESSAGE = circular.message;
      }
    }
    if (error.message === CIRCULAR_ERROR_MESSAGE)
    {
      return '[Circular]';
    }
    throw error;
  }
}

// 获取构造函数名称
function getConstructorName(obj)
{
  if (!Object.getOwnPropertyDescriptor || !Object.getPrototypeOf)
  {
    return Object.prototype.toString.call(obj).slice(8, -1);
  }

  // https://github.com/nodejs/node/blob/master/lib/internal/util.js
  while (obj)
  {
    const descriptor = Object.getOwnPropertyDescriptor(obj, 'constructor');

    if (
      descriptor !== undefined
      && typeof descriptor.value === 'function'
      && descriptor.value.name !== ''
    )
    {
      return descriptor.value.name;
    }

    obj = Object.getPrototypeOf(obj);
  }

  return '';
}

function interpolate(array)
{
  let result = '';
  let index = 0;

  if (array.length > 1 && typeof array[0] === 'string')
  {
    result = array[0].replace(/(%?)(%([sdjo]))/g, (match, escaped, ptn, flag) =>
    {
      if (!escaped)
      {
        index += 1;
        const arg = array[index];
        let a = '';

        switch (flag)
        {
          case 's':
            a += arg;
            break;
          case 'd':
            a += Number(arg);
            break;
          case 'j':
            a = tryStringify(arg);
            break;
          case 'o': {
            let obj = tryStringify(arg);

            if (obj[0] !== '{' && obj[0] !== '[')
            {
              obj = `<${obj}>`;
            }
            a = getConstructorName(arg) + obj;
            break;
          }
        }

        return a;
      }

      return match;
    });

    // update escaped %% values
    result = result.replace(/%{2,2}/g, '%');

    index += 1;
  }

  // arguments remaining after formatting
  if (array.length > index)
  {
    if (result) result += ' ';
    result += array.slice(index).join(' ');
  }

  return result;
}

const hasStacktraceSupport = Boolean(getStacktrace());

// 上传日志的默认参数
const config = {
  url            : url,
  method         : 'POST',
  token          : '',
  callOriginal   : true,
  onUnauthorized : () => { },
  timeout        : 0,
  level          : 'error',
  capacity       : 500,
  stacktrace     : {
    levels : [ 'trace', 'warn', 'error' ],
    depth  : 3,
    excess : 0
  },
  timestamp : () => new Date().toString(),
  format    : function(msg)
  {
    return `[${msg.timestamp}] ${msg.level.label.toUpperCase()}${msg.logger ? ` (${msg.logger})` : ''
    }: ${msg.message}${msg.stacktrace ? `\n${msg.stacktrace}` : ''}`;
  }
};

const loglevelServerSend = function(logger, options)
{
  if (!logger || !logger.methodFactory)
    throw new Error('loglevel instance has to be specified in order to be extended');

  const _logger = logger;
  const _url = options.url;
  const _callOriginal = options.callOriginal;
  const _headers = options.headers;
  const _originalFactory = _logger.methodFactory;
  const _sendQueue = [];

  let _isSending = false;

  const _sendNextMessage = function(message)
  {
    if ((!(_sendQueue.length>0) || _isSending) && !message)
      return;

    _isSending = true;

    const version = '1.0.0';
    const contentType = 'application/json;charset=utf-8';

    // 线上环境参数
    const timestamp = new Date().getTime()
      .toString()
      .substring(0, 10);
    const sKey = 'q0[fua0jmal;gjq0ruiqefjefjasl;fj';
    const sdkId = '1001';
    const newLog = Base64.encode(`${_sendQueue.shift()}\n`);
    // eslint-disable-next-line object-curly-spacing,comma-spacing,key-spacing,quotes
    const msg = {"log":newLog,"tag":"h5","type":options.level||'debug',"uid":uid,"uuid":""};

    const req = new XMLHttpRequest();
    const headers = {
      'X-Timestamp'  : timestamp,
      'X-SID'        : sdkId,
      'X-Version'    : version,
      'Content-Type' : contentType
    };

    console.error('host:', host);
    const headerSig = HmacSHA256(`content-type:${contentType}\r\nhost:${host}\r\nx-sid:${sdkId}\r\nx-timestamp:${timestamp}\r\nx-version:${version}`, sKey);

    headers['Authorization'] = HmacSHA256(JSON.stringify(msg), headerSig.toString()).toString();

    req.open('POST', _url, true); '';
    if (_headers)
    {
      const entries = Object.entries(_headers);

      entries.map((header) => req.setRequestHeader(header[0], header[1]));
    }

    req.onreadystatechange = function()
    {
      if (req.readyState===4)
      {
        _isSending = false;
        _sendNextMessage();
      }
    };

    for (const key in headers)
    {
      if ({}.hasOwnProperty.call(headers, key))
      {
        req.setRequestHeader(key, headers[key]);
      }
    }

    try
    {
      req.send(JSON.stringify(msg));

      // TODO: 发送失败补发
      // setTimeout(() =>
      // {
      //   if (req.status !== 200 && uploadLog)
      //   {
      //     _isSending = false;
      //     _sendNextMessage(msg);
      //   }
      // }, 5000);
    }
    catch (error)
    { }
  };

  _logger.methodFactory = function(methodName, logLevel, loggerName)
  {
    const rawMethod = _originalFactory(methodName, logLevel, loggerName);
    const needStack = hasStacktraceSupport
      && config.stacktrace.levels.some((level) => level === methodName);
    const levelVal = _logger.levels[methodName.toUpperCase()];
    const needLog = levelVal >= _logger.levels[config.level.toUpperCase()];

    return function(...args)
    {
      if (uploadLog && needLog)
      {
        const timestamp = config.timestamp();

        let stacktrace = needStack ? getStacktrace() : '';

        if (stacktrace)
        {
          const lines = stacktrace.split('\n');

          lines.splice(0, config.stacktrace.excess + 5);
          const { depth } = config.stacktrace;

          if (depth && lines.length !== depth + 1)
          {
            const shrink = lines.splice(0, depth);

            stacktrace = shrink.join('\n');
            if (lines.length) stacktrace += `\n    and ${lines.length} more`;
          }
          else
          {
            stacktrace = lines.join('\n');
          }
        }

        const msg = config.format({
          message : interpolate(args),
          level   : {
            label : methodName,
            value : levelVal
          },
          logger : loggerName || '',
          timestamp,
          stacktrace
        });

        _sendQueue.push(msg);
        _sendNextMessage();
      }

      _callOriginal && rawMethod(...args);
    };
  };
  _logger.setLevel(_logger.levels.TRACE);
};

/**
 * @namespace PRTC.Logger
 * @name PRTC.Logger
 */
module.exports ={
  /**
   * @var {number} - 日志输出等级
   * @readonly
   * @memberof PRTC.Logger
   */
  // LogLevel : log.levels,

  /**
  * 设置日志输出等级
  *
  * @param {string} level - debug 或 error - 必须在 createClient 前调用，否则无效
  * @memberof PRTC.Logger
  */
  setLogLevel : (level) =>
  {
    config.level = level;

    return log.setLevel(level);
  },

  /**
  * 打开日志上传
  *
  * @memberof PRTC.Logger
  */
  enableUploadLog : (options = {}) =>
  {
    if (options.user_id)
    {
      uid = options.user_id;
    }

    if (options.log_url)
    {
      config.url = options.log_url;
      host = Utils.getHost(options.log_url);
    }

    loglevelServerSend(log, config);
    uploadLog=true;
  },

  /**
  * 关闭日志上传
  * @memberof PRTC.Logger
  */
  disableUploadLog : () =>
  {
    uploadLog=false;
  },

  track : (message) =>
  {
    log.track(message);
  },

  debug : (message) =>
  {
    log.debug(message);
  },

  info : (message) =>
  {
    log.info(message);
  },

  warn : (message) =>
  {
    log.warn(message);
  },

  error : (message) =>
  {
    log.error(message);
  }
};