const debugFactory = require('debug');

const APP_NAME = 'CRTC';

// 北京时间 ISO 字符串（不带 Z）
function toBeijingISOString(date = new Date())
{
  const beijingTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));


  return beijingTime.toISOString().replace('Z', '');
}

/**
 * 覆写 debug 的 formatArgs：
 * - 每行输出时前置时间戳
 * - 仅对 CRTC* 的日志，把展示用的 "CRTC" 改为 "CRTC:D/W/E"
 * - 为了更简洁，移除展示文案中的末尾 ":WARN"/":ERROR"（不影响真实 namespace 和开关）
 */
const originalFormatArgs = debugFactory.formatArgs;

debugFactory.formatArgs = function(args)
{
  // 按原逻辑先构建（包含 namespace、颜色、+ms）
  originalFormatArgs.call(this, args);

  // 逐行生成时间戳并前置
  const ts = `${toBeijingISOString()} →`;

  if (this.useColors && typeof args[0] === 'string' && args[0].startsWith('%c'))
  {
    // 在第一个 %c 后面插入时间戳，沿用原 namespace 颜色
    args[0] = args[0].replace(/^%c/, `${ts} %c`);
  }
  else
  {
    args[0] = `${ts} ${args[0]}`;
  }

  // 仅处理自家命名空间
  const ns = String(this.namespace || '');

  if (!ns.startsWith(APP_NAME)) return;

  // 推断级别：默认 D；:WARN => W；:ERROR => E
  let level = 'D';

  if (ns.endsWith(':WARN')) level = 'W';
  else if (ns.endsWith(':ERROR')) level = 'E';

  // 展示时是否去掉 :WARN/:ERROR（不影响开关）
  const baseNs = ns.replace(/:(WARN|ERROR)$/, '');

  // 把 "CRTC" 替换为 "CRTC:D/W/E"
  let displayedNs = baseNs;

  if (displayedNs.startsWith(APP_NAME))
  {
    displayedNs = displayedNs.replace(
      new RegExp(`^${APP_NAME}\\b`),
      `${APP_NAME}:${level}`
    );
  }
  else
  {
    // 理论上不会到这里；兜底
    displayedNs = `${APP_NAME}:${level}:${displayedNs}`;
  }

  // 用展示用的 namespace 替换原 namespace（只替换第一个出现位置）
  args[0] = args[0].replace(ns, displayedNs);
};

// 选择输出通道（browser 用 window.CLog，fallback 到 console）
function pickConsole()
{
  if (typeof window !== 'undefined' && window && window.CLog) return window.CLog;
  if (typeof console !== 'undefined') return console;

  return { log() {}, info() {}, warn() {}, error() {} };
}

module.exports = class Logger
{
  constructor(prefix)
  {
    const factory = debugFactory.default || debugFactory;
    const base = prefix ? `${APP_NAME}:${prefix}` : APP_NAME;

    // 注意：这里仍然保持真实 namespace（用于开关），不拼时间戳/级别标记
    this._debug = factory(base); // -> 视觉上显示为 CRTC:D:*
    this._warn = factory(`${base}:WARN`); // -> 视觉上显示为 CRTC:W:*
    this._error = factory(`${base}:ERROR`); // -> 视觉上显示为 CRTC:E:*

    const clog = pickConsole();
    /* eslint-disable no-console */

    this._debug.log = clog.info.bind(clog);
    this._warn.log = clog.warn.bind(clog);
    this._error.log = clog.error.bind(clog);
    /* eslint-enable no-console */
  }

  get debug() { return this._debug; }
  get warn() { return this._warn; }
  get error() { return this._error; }
};

// 使用示例：
// const Logger = require('src/utils/logger');
// const log = new Logger('Auth');
// log.debug('登录成功');  // [ts] CRTC:D:Auth 登录成功 +5ms
// log.warn('风险提示');   // [ts] CRTC:W:Auth 风险提示 +3ms
// log.error('异常信息');  // [ts] CRTC:E:Auth 异常信息 +1ms
