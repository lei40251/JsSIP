let CIRCULAR_ERROR_MESSAGE;

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

function Queue(capacity)
{
  let queue = [];
  let sent = [];

  this.length = () => queue.length;
  this.sent = () => sent.length;

  this.push = (message) =>
  {
    queue.push(message);
    if (queue.length > capacity)
    {
      queue.shift();
    }
  };

  this.send = () =>
  {
    if (!sent.length)
    {
      sent = queue;
      queue = [];
    }

    return sent;
  };

  this.confirm = () =>
  {
    sent = [];
    this.content = '';
  };

  this.fail = () =>
  {
    const overflow = 1 + queue.length + sent.length - capacity;

    if (overflow > 0)
    {
      sent.splice(0, overflow);
      queue = sent.concat(queue);
      this.confirm();
    }
    // if (queue.length + sent.length >= capacity) this.confirm();
  };
}

const hasStacktraceSupport = Boolean(getStacktrace());

let loglevel;
let originalFactory;
let pluginFactory;

// 格式化为字符串
function plain(log)
{
  return `[${log.timestamp}] ${log.level.label.toUpperCase()}${log.logger ? ` (${log.logger})` : ''
  }: ${log.message}${log.stacktrace ? `\n${log.stacktrace}` : ''}`;
}

// 默认参数
const defaults = {
  url            : '/logger',
  method         : 'POST',
  headers        : {},
  token          : '',
  onUnauthorized : () => { },
  timeout        : 0,
  interval       : 1000,
  level          : 'trace',
  backoff        : {
    multiplier : 2,
    jitter     : 0.1,
    limit      : 30000
  },
  capacity   : 500,
  stacktrace : {
    levels : [ 'trace', 'warn', 'error' ],
    depth  : 3,
    excess : 0
  },
  timestamp : () => new Date().toISOString(),
  format    : plain
};

// 导出对象
const remote = {
  plain,
  apply(logger)
  {
    if (!logger || !logger.getLogger)
    {
      throw new TypeError('Argument is not a root loglevel object');
    }

    if (loglevel)
    {
      throw new Error('You can assign a plugin only one time');
    }

    if (!XMLHttpRequest) return logger;

    loglevel = logger;

    const config = defaults;
    const { backoff } = config;
    const backoffFunc = (duration) =>
    {
      let next = duration * backoff.multiplier;

      if (next > backoff.limit) next = backoff.limit;
      next += next * backoff.jitter * Math.random();

      return next;
    };

    let { interval } = config;
    let isSending = false;
    let isSuspended = false;

    const queue = new Queue(config.capacity);

    function send()
    {
      if (isSuspended || isSending || config.token === undefined)
      {
        return;
      }

      if (!queue.sent())
      {
        if (!queue.length())
        {
          return;
        }

        const logs = queue.send();

        queue.content = logs.join('\n');
      }

      isSending = true;

      const xhr = new XMLHttpRequest();

      xhr.open(config.method, config.url, true);
      xhr.setRequestHeader('Content-Type', 'text/plain');
      if (config.token)
      {
        xhr.setRequestHeader('Authorization', `Bearer ${config.token}`);
      }

      const { headers } = config;

      for (const header in headers)
      {
        if (hasOwnProperty.call(headers, header))
        {
          const value = headers[header];

          if (value)
          {
            xhr.setRequestHeader(header, value);
          }
        }
      }

      function suspend(successful)
      {
        if (!successful)
        {
          // interval = config.backoff(interval || 1);
          interval = backoffFunc(interval || 1);
          queue.fail();
        }

        isSuspended = true;
        setTimeout(() =>
        {
          isSuspended = false;
          send();
        }, interval);
      }

      let timeout;

      if (config.timeout)
      {
        timeout = setTimeout(() =>
        {
          isSending = false;
          xhr.abort();
          suspend();
        }, config.timeout);
      }

      xhr.onreadystatechange = () =>
      {
        if (xhr.readyState !== 4)
        {
          return;
        }

        isSending = false;
        clearTimeout(timeout);

        if (xhr.status === 200)
        {
          // eslint-disable-next-line prefer-destructuring
          interval = config.interval;
          queue.confirm();
          suspend(true);
        }
        else
        {
          if (xhr.status === 401)
          {
            const { token } = config;

            config.token = undefined;
            config.onUnauthorized(token);
          }
          suspend();
        }
      };

      xhr.send(queue.content);
    }

    originalFactory = logger.methodFactory;

    pluginFactory = function remoteMethodFactory(methodName, logLevel, loggerName)
    {
      const rawMethod = originalFactory(methodName, logLevel, loggerName);
      const needStack = hasStacktraceSupport
        && config.stacktrace.levels.some((level) => level === methodName);
      const levelVal = loglevel.levels[methodName.toUpperCase()];
      const needLog = levelVal >= loglevel.levels[config.level.toUpperCase()];

      return (...args) =>
      {
        if (needLog)
        {
          const timestamp = config.timestamp();

          let stacktrace = needStack ? getStacktrace() : '';

          if (stacktrace)
          {
            const lines = stacktrace.split('\n');

            lines.splice(0, config.stacktrace.excess + 3);
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

          const log = config.format({
            message : interpolate(args),
            level   : {
              label : methodName,
              value : levelVal
            },
            logger : loggerName || '',
            timestamp,
            stacktrace
          });

          queue.push(log);
          send();
        }

        rawMethod(...args);
      };
    };

    logger.methodFactory = pluginFactory;
    logger.setLevel(logger.getLevel());

    remote.setToken = (token) =>
    {
      config.token = token;
      send();
    };

    return logger;
  }
};

export default remote;
