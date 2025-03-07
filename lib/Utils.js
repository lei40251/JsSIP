const CRTC_C = require('./Constants');
const URI = require('./URI');
const Grammar = require('./Grammar');

exports.str_utf8_length = (string) => unescape(encodeURIComponent(string)).length;

// Used by 'hasMethods'.
const isFunction = exports.isFunction = (fn) =>
{
  if (fn !== undefined)
  {
    return (Object.prototype.toString.call(fn) === '[object Function]')? true : false;
  }
  else
  {
    return false;
  }
};

exports.isString = (str) =>
{
  if (str !== undefined)
  {
    return (Object.prototype.toString.call(str) === '[object String]')? true : false;
  }
  else
  {
    return false;
  }
};

exports.isDecimal = (num) => !isNaN(num) && (parseFloat(num) === parseInt(num, 10));

exports.isEmpty = (value) =>
{
  return (value === null ||
      value === '' ||
      value === undefined ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof(value) === 'number' && isNaN(value)));
};

exports.hasMethods = function(obj, ...methodNames)
{
  for (const methodName of methodNames)
  {
    if (isFunction(obj[methodName]))
    {
      return false;
    }
  }

  return true;
};

// Used by 'newTag'.
const createRandomToken = exports.createRandomToken = (size, base = 32) =>
{
  let i, r, token = '';

  for (i=0; i < size; i++)
  {
    r = (Math.random() * base) | 0;
    token += r.toString(base);
  }

  return token;
};

exports.newTag = () => createRandomToken(10);

// https://stackoverflow.com/users/109538/broofa.
exports.newUUID = () =>
{
  const UUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) =>
  {
    const r = Math.random()*16|0, v = c === 'x' ? r : ((r&0x3)|0x8);


    return v.toString(16);
  });

  return UUID;
};

// 获取 arraybuffer 数据
exports.getABU = (str) =>
{
  const buf = new ArrayBuffer(str.length*2);
  // 使用typeArray中的Uint16Array方法设置数据
  const uint16 = new Uint16Array(buf);
  // 使用循环设置数据

  for (let i =0; i<str.length; i++)
  {
    // 使用charCodeAt字符转为二进制编码
    uint16[i] = str.charCodeAt(i);
  }

  return uint16;
};

exports.hostType = (host) =>
{
  if (!host)
  {
    return;
  }
  else
  {
    host = Grammar.parse(host, 'host');
    if (host !== -1)
    {
      return host.host_type;
    }
  }
};

/**
* Hex-escape a SIP URI user.
* Don't hex-escape ':' (%3A), '+' (%2B), '?' (%3F"), '/' (%2F).
*
* Used by 'normalizeTarget'.
*/
const escapeUser = exports.escapeUser = (user) =>
  encodeURIComponent(decodeURIComponent(user))
    .replace(/%3A/ig, ':')
    .replace(/%2B/ig, '+')
    .replace(/%3F/ig, '?')
    .replace(/%2F/ig, '/');

/**
* Normalize SIP URI.
* NOTE: It does not allow a SIP URI without username.
* Accepts 'sip', 'sips' and 'tel' URIs and convert them into 'sip'.
* Detects the domain part (if given) and properly hex-escapes the user portion.
* If the user portion has only 'tel' number symbols the user portion is clean of 'tel' visual separators.
*/
exports.normalizeTarget = (target, domain) =>
{
  // If no target is given then raise an error.
  if (!target)
  {
    return;
  // If a URI instance is given then return it.
  }
  else if (target instanceof URI)
  {
    return target;

  // If a string is given split it by '@':
  // - Last fragment is the desired domain.
  // - Otherwise append the given domain argument.
  }
  else if (typeof target === 'string')
  {
    const target_array = target.split('@');
    let target_user;
    let target_domain;

    switch (target_array.length)
    {
      case 1:
        if (!domain)
        {
          return;
        }
        target_user = target;
        target_domain = domain;
        break;
      case 2:
        target_user = target_array[0];
        target_domain = target_array[1];
        break;
      default:
        target_user = target_array.slice(0, target_array.length-1).join('@');
        target_domain = target_array[target_array.length-1];
    }

    // Remove the URI scheme (if present).
    target_user = target_user.replace(/^(sips?|tel):/i, '');

    // Remove 'tel' visual separators if the user portion just contains 'tel' number symbols.
    if (/^[-.()]*\+?[0-9\-.()]+$/.test(target_user))
    {
      target_user = target_user.replace(/[-.()]/g, '');
    }

    // Build the complete SIP URI.
    target = `${CRTC_C.SIP}:${escapeUser(target_user)}@${target_domain}`;

    // Finally parse the resulting URI.
    let uri;

    if ((uri = URI.parse(target)))
    {
      return uri;
    }
    else
    {
      return;
    }
  }
  else
  {
    return;
  }
};

exports.headerize = (string) =>
{
  const exceptions = {
    'Call-Id'          : 'Call-ID',
    'Cseq'             : 'CSeq',
    'Www-Authenticate' : 'WWW-Authenticate'
  };

  const name = string.toLowerCase()
    .replace(/_/g, '-')
    .split('-');
  let hname = '';
  const parts = name.length;
  let part;

  for (part = 0; part < parts; part++)
  {
    if (part !== 0)
    {
      hname +='-';
    }
    hname += name[part].charAt(0).toUpperCase()+name[part].substring(1);
  }
  if (exceptions[hname])
  {
    hname = exceptions[hname];
  }

  return hname;
};

exports.sipErrorCause = (status_code) =>
{
  for (const cause in CRTC_C.SIP_ERROR_CAUSES)
  {
    if (CRTC_C.SIP_ERROR_CAUSES[cause].indexOf(status_code) !== -1)
    {
      return CRTC_C.causes[cause];
    }
  }

  return CRTC_C.causes.SIP_FAILURE_CODE;
};

/**
* Generate a random Test-Net IP (https://tools.ietf.org/html/rfc5735)
*/
exports.getRandomTestNetIP = () =>
{
  function getOctet(from, to)
  {
    return Math.floor((Math.random() * (to-from+1)) + from);
  }

  return `192.0.2.${getOctet(1, 254)}`;
};

// MD5 (Message-Digest Algorithm) https://www.webtoolkit.info.
exports.calculateMD5 = (string) =>
{
  function rotateLeft(lValue, iShiftBits)
  {
    return (lValue<<iShiftBits) | (lValue>>>(32-iShiftBits));
  }

  function addUnsigned(lX, lY)
  {
    const lX8 = (lX & 0x80000000);
    const lY8 = (lY & 0x80000000);
    const lX4 = (lX & 0x40000000);
    const lY4 = (lY & 0x40000000);
    const lResult = (lX & 0x3FFFFFFF)+(lY & 0x3FFFFFFF);

    if (lX4 & lY4)
    {
      return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
    }
    if (lX4 | lY4)
    {
      if (lResult & 0x40000000)
      {
        return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
      }
      else
      {
        return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
      }
    }
    else
    {
      return (lResult ^ lX8 ^ lY8);
    }
  }

  function doF(x, y, z)
  {
    return (x & y) | ((~x) & z);
  }

  function doG(x, y, z)
  {
    return (x & z) | (y & (~z));
  }

  function doH(x, y, z)
  {
    return (x ^ y ^ z);
  }

  function doI(x, y, z)
  {
    return (y ^ (x | (~z)));
  }

  function doFF(a, b, c, d, x, s, ac)
  {
    a = addUnsigned(a, addUnsigned(addUnsigned(doF(b, c, d), x), ac));

    return addUnsigned(rotateLeft(a, s), b);
  }

  function doGG(a, b, c, d, x, s, ac)
  {
    a = addUnsigned(a, addUnsigned(addUnsigned(doG(b, c, d), x), ac));

    return addUnsigned(rotateLeft(a, s), b);
  }

  function doHH(a, b, c, d, x, s, ac)
  {
    a = addUnsigned(a, addUnsigned(addUnsigned(doH(b, c, d), x), ac));

    return addUnsigned(rotateLeft(a, s), b);
  }

  function doII(a, b, c, d, x, s, ac)
  {
    a = addUnsigned(a, addUnsigned(addUnsigned(doI(b, c, d), x), ac));

    return addUnsigned(rotateLeft(a, s), b);
  }

  function convertToWordArray(str)
  {
    let lWordCount;
    const lMessageLength = str.length;
    const lNumberOfWords_temp1=lMessageLength + 8;
    const lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1 % 64))/64;
    const lNumberOfWords = (lNumberOfWords_temp2+1)*16;
    const lWordArray = new Array(lNumberOfWords-1);
    let lBytePosition = 0;
    let lByteCount = 0;

    while (lByteCount < lMessageLength)
    {
      lWordCount = (lByteCount-(lByteCount % 4))/4;
      lBytePosition = (lByteCount % 4)*8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] |
          (str.charCodeAt(lByteCount)<<lBytePosition));
      lByteCount++;
    }
    lWordCount = (lByteCount-(lByteCount % 4))/4;
    lBytePosition = (lByteCount % 4)*8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80<<lBytePosition);
    lWordArray[lNumberOfWords-2] = lMessageLength<<3;
    lWordArray[lNumberOfWords-1] = lMessageLength>>>29;

    return lWordArray;
  }

  function wordToHex(lValue)
  {
    let wordToHexValue='', wordToHexValue_temp='', lByte, lCount;

    for (lCount = 0; lCount<=3; lCount++)
    {
      lByte = (lValue>>>(lCount*8)) & 255;
      wordToHexValue_temp = `0${lByte.toString(16)}`;
      wordToHexValue = wordToHexValue +
        wordToHexValue_temp.substr(wordToHexValue_temp.length-2, 2);
    }

    return wordToHexValue;
  }

  function utf8Encode(str)
  {
    let utftext = '';

    for (let n = 0; n < str.length; n++)
    {
      const c = str.charCodeAt(n);

      if (c < 128)
      {
        utftext += String.fromCharCode(c);
      }
      else if ((c > 127) && (c < 2048))
      {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      }
      else
      {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }
    }

    return utftext;
  }

  let x=[];
  let k, AA, BB, CC, DD, a, b, c, d;
  const S11=7, S12=12, S13=17, S14=22;
  const S21=5, S22=9, S23=14, S24=20;
  const S31=4, S32=11, S33=16, S34=23;
  const S41=6, S42=10, S43=15, S44=21;

  string = utf8Encode(string);

  x = convertToWordArray(string);

  a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;

  for (k=0; k<x.length; k+=16)
  {
    AA=a; BB=b; CC=c; DD=d;
    a=doFF(a, b, c, d, x[k+0], S11, 0xD76AA478);
    d=doFF(d, a, b, c, x[k+1], S12, 0xE8C7B756);
    c=doFF(c, d, a, b, x[k+2], S13, 0x242070DB);
    b=doFF(b, c, d, a, x[k+3], S14, 0xC1BDCEEE);
    a=doFF(a, b, c, d, x[k+4], S11, 0xF57C0FAF);
    d=doFF(d, a, b, c, x[k+5], S12, 0x4787C62A);
    c=doFF(c, d, a, b, x[k+6], S13, 0xA8304613);
    b=doFF(b, c, d, a, x[k+7], S14, 0xFD469501);
    a=doFF(a, b, c, d, x[k+8], S11, 0x698098D8);
    d=doFF(d, a, b, c, x[k+9], S12, 0x8B44F7AF);
    c=doFF(c, d, a, b, x[k+10], S13, 0xFFFF5BB1);
    b=doFF(b, c, d, a, x[k+11], S14, 0x895CD7BE);
    a=doFF(a, b, c, d, x[k+12], S11, 0x6B901122);
    d=doFF(d, a, b, c, x[k+13], S12, 0xFD987193);
    c=doFF(c, d, a, b, x[k+14], S13, 0xA679438E);
    b=doFF(b, c, d, a, x[k+15], S14, 0x49B40821);
    a=doGG(a, b, c, d, x[k+1], S21, 0xF61E2562);
    d=doGG(d, a, b, c, x[k+6], S22, 0xC040B340);
    c=doGG(c, d, a, b, x[k+11], S23, 0x265E5A51);
    b=doGG(b, c, d, a, x[k+0], S24, 0xE9B6C7AA);
    a=doGG(a, b, c, d, x[k+5], S21, 0xD62F105D);
    d=doGG(d, a, b, c, x[k+10], S22, 0x2441453);
    c=doGG(c, d, a, b, x[k+15], S23, 0xD8A1E681);
    b=doGG(b, c, d, a, x[k+4], S24, 0xE7D3FBC8);
    a=doGG(a, b, c, d, x[k+9], S21, 0x21E1CDE6);
    d=doGG(d, a, b, c, x[k+14], S22, 0xC33707D6);
    c=doGG(c, d, a, b, x[k+3], S23, 0xF4D50D87);
    b=doGG(b, c, d, a, x[k+8], S24, 0x455A14ED);
    a=doGG(a, b, c, d, x[k+13], S21, 0xA9E3E905);
    d=doGG(d, a, b, c, x[k+2], S22, 0xFCEFA3F8);
    c=doGG(c, d, a, b, x[k+7], S23, 0x676F02D9);
    b=doGG(b, c, d, a, x[k+12], S24, 0x8D2A4C8A);
    a=doHH(a, b, c, d, x[k+5], S31, 0xFFFA3942);
    d=doHH(d, a, b, c, x[k+8], S32, 0x8771F681);
    c=doHH(c, d, a, b, x[k+11], S33, 0x6D9D6122);
    b=doHH(b, c, d, a, x[k+14], S34, 0xFDE5380C);
    a=doHH(a, b, c, d, x[k+1], S31, 0xA4BEEA44);
    d=doHH(d, a, b, c, x[k+4], S32, 0x4BDECFA9);
    c=doHH(c, d, a, b, x[k+7], S33, 0xF6BB4B60);
    b=doHH(b, c, d, a, x[k+10], S34, 0xBEBFBC70);
    a=doHH(a, b, c, d, x[k+13], S31, 0x289B7EC6);
    d=doHH(d, a, b, c, x[k+0], S32, 0xEAA127FA);
    c=doHH(c, d, a, b, x[k+3], S33, 0xD4EF3085);
    b=doHH(b, c, d, a, x[k+6], S34, 0x4881D05);
    a=doHH(a, b, c, d, x[k+9], S31, 0xD9D4D039);
    d=doHH(d, a, b, c, x[k+12], S32, 0xE6DB99E5);
    c=doHH(c, d, a, b, x[k+15], S33, 0x1FA27CF8);
    b=doHH(b, c, d, a, x[k+2], S34, 0xC4AC5665);
    a=doII(a, b, c, d, x[k+0], S41, 0xF4292244);
    d=doII(d, a, b, c, x[k+7], S42, 0x432AFF97);
    c=doII(c, d, a, b, x[k+14], S43, 0xAB9423A7);
    b=doII(b, c, d, a, x[k+5], S44, 0xFC93A039);
    a=doII(a, b, c, d, x[k+12], S41, 0x655B59C3);
    d=doII(d, a, b, c, x[k+3], S42, 0x8F0CCC92);
    c=doII(c, d, a, b, x[k+10], S43, 0xFFEFF47D);
    b=doII(b, c, d, a, x[k+1], S44, 0x85845DD1);
    a=doII(a, b, c, d, x[k+8], S41, 0x6FA87E4F);
    d=doII(d, a, b, c, x[k+15], S42, 0xFE2CE6E0);
    c=doII(c, d, a, b, x[k+6], S43, 0xA3014314);
    b=doII(b, c, d, a, x[k+13], S44, 0x4E0811A1);
    a=doII(a, b, c, d, x[k+4], S41, 0xF7537E82);
    d=doII(d, a, b, c, x[k+11], S42, 0xBD3AF235);
    c=doII(c, d, a, b, x[k+2], S43, 0x2AD7D2BB);
    b=doII(b, c, d, a, x[k+9], S44, 0xEB86D391);
    a=addUnsigned(a, AA);
    b=addUnsigned(b, BB);
    c=addUnsigned(c, CC);
    d=addUnsigned(d, DD);
  }

  const temp = wordToHex(a)+wordToHex(b)+wordToHex(c)+wordToHex(d);

  return temp.toLowerCase();
};

exports.closeMediaStream = (stream) =>
{
  if (!stream)
  {
    return;
  }

  // Latest spec states that MediaStream has no stop() method and instead must
  // call stop() on every MediaStreamTrack.
  try
  {
    let tracks;

    if (stream.getTracks)
    {
      tracks = stream.getTracks();
      for (const track of tracks)
      {
        track.stop();
      }
    }
    else
    {
      tracks = stream.getAudioTracks();
      for (const track of tracks)
      {
        track.stop();
      }
      tracks = stream.getVideoTracks();
      for (const track of tracks)
      {
        track.stop();
      }
    }
  }
  catch (error)
  {
    // Deprecated by the spec, but still in use.
    // NOTE: In Temasys IE plugin stream.stop is a callable 'object'.
    if (typeof stream.stop === 'function' || typeof stream.stop === 'object')
    {
      stream.stop();
    }
  }
};

exports.cloneArray = (array) =>
{
  return (array && array.slice()) || [];
};

exports.cloneObject = (obj, fallback = {}) =>
{
  return (obj && Object.assign({}, obj)) || fallback;
};

/**
 * 返回摄像头设备列表
 *
 * 该接口不支持在 http 协议下使用，请使用 https 协议部署您的网站
 * <a href="https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Privacy_and_security"> Privacy and security </a>。<br>
 * '出于安全的考虑，在用户未授权摄像头或麦克风访问权限前，label 及 deviceId 字段可能都是空的。<br>
 * 因此建议在用户授权访问后， 再调用该接口获取设备详情
 *
 */
exports.getCameras = async() =>
{
  try
  {
    // 获取所有设备
    const devices = await navigator.mediaDevices.enumerateDevices();

    // 筛选出视频输入设备（摄像头）
    const cameras = devices
      .filter((device) => device.kind === 'videoinput')
      .map((cam, index) => ({
        kind     : cam.kind,
        label    : cam.label || `camera ${index + 1}`, // 默认标签
        deviceId : cam.deviceId
      }));

    return cameras;
  }
  catch (error)
  {
    // 返回明确的错误信息
    return { error: error.message };
  }
};

/**
 * 返回麦克风设备列表
 *
 * 该接口不支持在 http 协议下使用，请使用 https 协议部署您的网站
 * <a href="https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Privacy_and_security"> Privacy and security </a>。<br>
 * '出于安全的考虑，在用户未授权摄像头或麦克风访问权限前，label 及 deviceId 字段可能都是空的。<br>
 * 因此建议在用户授权访问后， 再调用该接口获取设备详情，比如在 initialize() 后再调用此接口获取设备详情。
 *
 */
exports.getMicrophones = async() =>
{
  try
  {
    // 获取所有设备
    const devices = await navigator.mediaDevices.enumerateDevices();

    // 筛选出音频输入设备（麦克风）
    const microphones = devices
      .filter((device) => device.kind === 'audioinput')
      .map((mic, index) => ({
        kind     : mic.kind,
        label    : mic.label || `microphone ${index + 1}`, // 默认标签
        deviceId : mic.deviceId
      }));

    return microphones;
  }
  catch (error)
  {
    // 返回明确的错误信息
    return { error: error.message };
  }
};

/**
 * 返回音频输出设备列表
 *
 * 该接口不支持在 http 协议下使用，请使用 https 协议部署您的网站
 * <a href="https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Privacy_and_security"> Privacy and security </a>。<br>
 * '出于安全的考虑，在用户未授权摄像头或麦克风访问权限前，label 及 deviceId 字段可能都是空的。<br>
 * 因此建议在用户授权访问后， 再调用该接口获取设备详情，比如在 initialize() 后再调用此接口获取设备详情。
 *
 */
exports.getSpeakers = async() =>
{
  try
  {
    // 获取所有设备
    const devices = await navigator.mediaDevices.enumerateDevices();

    // 筛选出音频输出设备
    const speakers = devices
      .filter((device) => device.kind === 'audiooutput')
      .map((speaker, index) => ({
        kind     : speaker.kind,
        label    : speaker.label || `speaker ${index + 1}`, // 默认标签
        deviceId : speaker.deviceId
      }));

    return speakers;
  }
  catch (error)
  {
    // 返回明确的错误信息
    return { error: error.message };
  }
};

/**
 * 获取音视频流（音频流、视频流或媒体流）。
 *
 * @param {RTCPeerConnection} pc - RTCPeerConnection 实例，用于管理 WebRTC 连接。
 * @param {string} type - 流类型，可选值：
 *   - 'remote': 获取远程流（通过 getReceivers 方法）。
 *   - 'slides': 获取幻灯片流（通过 sessionStorage 中的索引定位特定接收器）。
 *   - 'local': 获取本地流（通过 getSenders 方法）。
 *   - 默认：兼容旧版 API，使用 getRemoteStreams 方法获取远程流。
 *
 * @returns {Object|null} 返回包含音频流、视频流和媒体流的对象，格式如下：
 *   {
 *     audioStream: MediaStream,  // 音频流
 *     videoStream: MediaStream,  // 视频流
 *     mediaStream: MediaStream   // 媒体流（包含所有轨道）
 *   }
 *   如果发生错误或参数无效，则返回 null。
 */
exports.getStreams = (pc, type, i) =>
{
  // 检查 pc 是否有效
  if (!pc || !(pc instanceof RTCPeerConnection))
  {
    console.warn('Invalid RTCPeerConnection object:', pc);

    return null;
  }

  const videoStream = new MediaStream();
  const audioStream = new MediaStream();
  const mediaStream = new MediaStream();
  let result;

  try
  {
    if (type === 'remote' && typeof pc.getReceivers === 'function')
    {
      // 处理辅流
      let streamIndex = sessionStorage.getItem(CRTC_C.BFCP_TRANSCEIVER_INDEX);

      i && (streamIndex = i);


      // 处理远程流
      const receivers = pc.getReceivers();

      if (Array.isArray(receivers))
      {
        receivers.forEach((receiver, index) =>
        {
          if (receiver.track && receiver.track.readyState === 'live' && index != streamIndex)
          {
            mediaStream.addTrack(receiver.track);

            if (receiver.track.kind === 'audio')
            {
              audioStream.addTrack(receiver.track);
            }
            else
            {
              videoStream.addTrack(receiver.track);
            }
          }
        });
      }

      result = { audioStream, videoStream, mediaStream };
    }
    else if (type === 'shared' && typeof pc.getReceivers === 'function')
    {
      // 处理辅流
      let streamIndex = sessionStorage.getItem(CRTC_C.BFCP_TRANSCEIVER_INDEX);

      i && (streamIndex = i);

      if (streamIndex !== -1 && streamIndex !== null && !isNaN(streamIndex))
      {
        const receivers = pc.getReceivers();
        const index = parseInt(streamIndex, 10);

        if (Array.isArray(receivers) && receivers[index] && receivers[index].track)
        {
          const track = receivers[index].track;

          if (track.readyState === 'live')
          {
            mediaStream.addTrack(track);
            videoStream.addTrack(track);
          }
        }
        else
        {
          console.warn(`Invalid stream index: ${streamIndex}`);
        }
      }
      else
      {
        console.warn('BFCP_TRANSCEIVER_INDEX is not set or invalid.');
      }

      result = { videoStream, mediaStream };
    }
    else if (type === 'local' && typeof pc.getSenders === 'function')
    {
      // 处理本地流
      const senders = pc.getSenders();

      if (Array.isArray(senders))
      {
        senders.forEach((sender) =>
        {
          if (sender.track && sender.track.readyState === 'live')
          {
            if (sender.track.kind === 'audio')
            {
              audioStream.addTrack(sender.track);
            }
            else
            {
              videoStream.addTrack(sender.track);
            }
          }
        });
      }

      result = { audioStream, videoStream };
    }
    else
    {
      // 兼容旧版 API
      const stream = pc.getRemoteStreams()[0];

      stream.getTracks().forEach((track) =>
      {
        if (track.readyState === 'live')
        {
          mediaStream.addTrack(track);

          if (track.kind === 'audio')
          {
            audioStream.addTrack(track);
          }
          else
          {
            videoStream.addTrack(track);
          }
        }
      });

      result = { audioStream, videoStream, mediaStream };
    }
  }
  catch (error)
  {
    console.warn('Error occurred while processing streams:', error);

    return null;
  }

  return result;
};

/**
 * 通过 canvas 画布获取视频流
 *
 * @param {MediaStream} stream - 要转换的媒体流
 */
exports.getStreamThroughCanvas=(stream) =>
{
  if (stream.getVideoTracks().length === 0)
  {
    return stream;
  }

  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  video.setAttribute('style', 'display:none');
  canvas.setAttribute('style', 'display:none');

  video.muted= true;
  video.autoplay = true;
  video.setAttribute('playsinline', '');

  document.body.append(video);
  document.body.append(canvas);
  video.srcObject = stream;

  // 将视频绘制到画布
  const drawToCanvas = function()
  {
    if (ctx !== null)
    {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      window.requestAnimationFrame(drawToCanvas);
    }
  };

  // 开始播放视频并设置画布尺寸后开始绘制视频到画布
  video.oncanplay = function()
  {
    video.play();
    drawToCanvas();
  };

  const newStream = canvas.captureStream(15);
  const canvasTrack = newStream.getVideoTracks()[0];
  const trackStop = canvasTrack.stop;

  // 视频停止后清理数据
  canvasTrack.stop = function()
  {
    trackStop.call(canvasTrack);
    drawToCanvas();
    stream.getTracks().forEach((track) =>
    {
      track.stop();
    });
    video.srcObject = null;
    video.remove();
    canvas.width = 0;
    canvas.remove();
  };

  // 合并音频轨道
  if (stream instanceof MediaStream && stream.getAudioTracks().length !== 0)
  {
    const audioTrack = stream.getAudioTracks()[0];

    newStream.addTrack(audioTrack);
  }

  return newStream;
};

// 使用 canvas.captureStream 创建空视频轨道的辅助函数
const createCanvasVideoTrack = function({ width = 64, height = 48, frameRate = 1 } = {})
{
  // 创建 Canvas 元素
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  let frameCount = 0;
  let animationFrameId;

  // 定义更新 Canvas 内容的函数
  const updateCanvas = () =>
  {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制动态内容（例如一个移动的矩形）
    ctx.fillStyle = 'red';
    const x = (frameCount % canvas.width); // 矩形水平移动

    ctx.fillRect(x, 1, 1, 1);

    // 增加帧计数
    frameCount++;

    // 使用 requestAnimationFrame 循环调用
    animationFrameId = requestAnimationFrame(updateCanvas);
  };

  // 启动动画
  updateCanvas();

  // 捕获 Canvas 的视频流
  const videoStream = canvas.captureStream(frameRate);

  // 提供一个清理函数，用于停止动画
  const stopAnimation = () =>
  {
    if (animationFrameId)
    {
      cancelAnimationFrame(animationFrameId);
    }
  };

  // 返回视频轨道和清理函数
  return {
    videoTrack : videoStream.getVideoTracks()[0],
    stopAnimation
  };
};

/**
 * 生成空视频流，根据是否支持 MediaStreamTrackGenerator 选择不同的方式
 * canvas 生成还是浏览器api直接生成
 *
 * MediaStreamTrackGenerator 生成的视频muted=false 不能满足要求，暂时改为canvas直接生成
 *
 * @param {MediaStream} stream - 要转换的媒体流
 */
exports.generateAnEmptyVideoTrack=() =>
{
  if ('MediaStreamTrackGenerator' in window)
  {
    // 如果支持 MediaStreamTrackGenerator，则使用它创建空视频轨道
    try
    {
      // eslint-disable-next-line no-undef
      const trackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });

      return { videoTrack: trackGenerator };
    }
    catch (error)
    {
      return createCanvasVideoTrack();
    }
  }
  else
  {
    // 如果不支持 MediaStreamTrackGenerator，则使用 canvas.captureStream()
    return createCanvasVideoTrack();
  }

};

/**
 * 计算网络质量
 *
 * 根据丢包率和RTT值计算网络质量值
 */
exports.getNetworkQuality = (loss, rtt) =>
{
  if (!loss && !rtt)
  {
    return 6;
  }

  // eslint-disable-next-line max-len
  return loss > 40 || rtt > 500 ? 6 : loss > 30 || rtt > 350 ? 5 : loss > 20 || rtt > 200 ? 4 : loss > 10 || rtt > 100 ? 3 : loss > 0 || rtt >= 50 ? 2 : loss >= 0 || rtt < 50 ? 1 : 0;
};

/**
 * 修正SDP修改后信令Header里面的内容长度值
 */
exports.fixContentLength=(data) =>
{
  try
  {
    // 使用正则表达式获取 v=0 开始到字符串结束的部分
    const sdpContent = data.match(/v=0[\s\S]*/)[0];
    // 计算SDP内容的长度
    const contentLength = sdpContent.length.toString();

    // 替换原始字符串中的Content-Length
    return data.replace(/Content-Length: \d+/, `Content-Length: ${ contentLength}`);
  }
  catch (error)
  {
    return data;
  }
};

/**
 * 兼容 payload
 * paphone 移动端呼叫 payload 124
 */
exports.compatiblePayload = (sdp, newPayload = 124) =>
{
  // 分割SDP为单独的行
  const lines = sdp.split(/\n/g);

  // 取得浏览器生成的payload
  const currPayload = sdp.match(/a=fmtp:(\d+) .*packetization-mode=0/)?sdp.match(/a=fmtp:(\d+) .*packetization-mode=0/)[1]:'';

  if (!currPayload)
  {
    return sdp;
  }

  // 替换对应行的payload
  const updatedLines = lines.map((line) =>
  {
    if (line.includes(`:${currPayload} `) || line.includes(`=${currPayload}`) || line.includes(` ${currPayload} `))
    {
      line = line
        .replace(new RegExp(`=${currPayload}(\\D|$| |;)`), `=${newPayload}$1`)
        .replace(new RegExp(`:${currPayload}( |;)`), `:${newPayload}$1`)
        .replace(new RegExp(`(m=video.* )${currPayload} `), `$1${newPayload} `);
    }

    return line;
  });

  const newSdp = updatedLines.join('\n');

  return newSdp;
};

/**
 * 从sdp解析出指定content的索引
 */
exports.findLabelIndexByMstrm =(sdp) =>
{
  // Step 0: 输入参数校验
  if (typeof sdp !== 'string' || !sdp.trim())
  {
    throw new Error('Invalid SDP input: SDP must be a non-empty string.');
  }

  // Step 1: 解析 SDP 并生成 labelMap
  const lines = sdp.split('\n');
  const labelMap = [];
  let currentMediaType = null;
  let currentContent = null;

  try
  {
    for (const line of lines)
    {
      if (line.startsWith('m='))
      {
        // 提取媒体类型（如 audio、video）
        const mediaType = line.split(' ')[0].substring(2);

        // 只处理 audio 和 video 类型
        if (mediaType === 'audio' || mediaType === 'video')
        {
          currentMediaType = mediaType;
          currentContent = 'unknown'; // 默认内容类型

          // 将当前媒体类型添加到数组中
          labelMap.push({
            label     : null, // 默认没有 label
            mediaType : currentMediaType,
            content   : currentContent
          });
        }
        else
        {
          currentMediaType = null;
          currentContent = null;
        }
      }
      else if (currentMediaType && line.startsWith('a=content:'))
      {
        // 提取内容类型（如 main、slides）
        currentContent = line.split(':')[1];

        // 更新最后一个元素的内容类型
        if (labelMap.length > 0)
        {
          labelMap[labelMap.length - 1].content = currentContent;
        }
      }
      else if (currentMediaType && line.startsWith('a=label:'))
      {
        // 提取 label 值
        const labelMatch = line.match(/^a=label:(\S+)/);
        const label = labelMatch ? labelMatch[1].trim() : '';

        // 更新最后一个元素的 label
        if (labelMap.length > 0)
        {
          labelMap[labelMap.length - 1].label = label;
        }
      }
    }
  }
  catch (error)
  {
    throw new Error(`Error parsing SDP: ${error.message}`);
  }

  // Step 2: 提取所有 mstrm 值并找到对应的 label 索引
  try
  {
    for (const line of lines)
    {
      if (line.includes('mstrm:'))
      {
        // 提取 mstrm 的值
        const mstrmMatch = line.match(/mstrm:(\d+)/);

        if (mstrmMatch)
        {
          const mstrm = mstrmMatch[1];

          // 在 labelMap 中查找对应的 label 索引
          const index = labelMap.findIndex((item) => item.label === mstrm);

          if (index !== -1)
          {
            return index; // 返回第一个匹配的索引
          }
        }
      }
    }
  }
  catch (error)
  {
    throw new Error(`Error matching mstrm to label: ${error.message}`);
  }

  return -1; // 如果未找到，返回 -1
};

exports.uint8ArrayToBase64 =(uint8Array) =>
{
  let binary = '';

  for (let i = 0; i < uint8Array.length; i++)
  {
    binary += String.fromCharCode(uint8Array[i]);
  }

  return btoa(binary);
};

exports.uint8ArrayToBinaryString = (uint8Array) =>
{
  return Array.from(uint8Array, (byte) =>
    byte.toString(2).padStart(8, '0') // 将每个字节转为8位二进制字符串
  ).join(' '); // 可选：用空格分隔每个字节，增强可读性
};