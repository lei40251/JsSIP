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
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices)
  {
    return { error: 'The current browser does not support device enumeration function.' };
  }

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
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices)
  {
    return { error: 'The current browser does not support device enumeration function.' };
  }

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

  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices)
  {
    return { error: 'The current browser does not support device enumeration function.' };
  }

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
      const shareStreamIndex = sessionStorage.getItem(CRTC_C.BFCP_SHARED_STREAM_INDEX);

      // 处理本地流
      const senders = pc.getSenders();

      if (Array.isArray(senders))
      {
        senders.forEach((sender, index) =>
        {
          if (sender.track && sender.track.readyState === 'live')
          {
            if (sender.track.kind === 'audio')
            {
              audioStream.addTrack(sender.track);
            }
            else if (sender.track && sender.track.readyState === 'live' && shareStreamIndex !== index)
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
const createCanvasVideoTrack = function({ width = 64, height = 48 } = {})
{
  // 创建 Canvas 元素
  let canvas = document.createElement('canvas');
  // 适配部分情况需要绘制内容后才可以调用captureStream方法，比如：Firefox v86.0
  const ctx = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 捕获 Canvas 的视频流
  const videoStream = canvas.captureStream(1);

  canvas = null;
  videoStream.getVideoTracks()[0].stop();

  // 返回视频轨道和清理函数
  return {
    videoTrack : videoStream.getVideoTracks()[0]
  };
};

/**
 * 生成空视频流，根据是否支持 MediaStreamTrackGenerator 选择不同的方式
 * canvas 生成还是浏览器api直接生成
 *
 * MediaStreamTrackGenerator 生成的视频muted=false 不能满足要求，暂时改为canvas直接生成
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

// 输出一个黑图视频
exports.generateAnBlackVideoTrack = (options) =>
{
  options || (options = {});

  sessionStorage.clear('stopBlackTrack');

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const width = options.width || 640;
  const height = options.height || 480;
  const fps = options.fps || 5;
  const color = options.color || 'black';
  const svgSource = options.svgSource || null; // SVG图片源参数

  canvas.setAttribute('style', 'display:none');

  canvas.width = width;
  canvas.height = height;

  // 创建一个图像对象用于加载SVG
  let img = null;

  if (svgSource)
  {
    img = new Image();

    // 处理不同类型的SVG源
    if (typeof svgSource === 'string')
    {
      // 如果是URL或SVG字符串
      if (svgSource.startsWith('http') || svgSource.startsWith('data:'))
      {
        // 如果是URL或data URL
        img.src = svgSource;
      }
      else if (svgSource.includes('<svg'))
      {
        // 如果是SVG字符串，转换为data URL
        const svgBlob = new Blob([ svgSource ], { type: 'image/svg+xml' });

        img.src = URL.createObjectURL(svgBlob);
      }
    }
    else if (svgSource instanceof Blob || svgSource instanceof File)
    {
      // 如果是Blob或File对象
      img.src = URL.createObjectURL(svgSource);
    }
  }

  const drawToCanvas =function()
  {
    if (sessionStorage.getItem('stopBlackTrack'))
    {
      return;
    }

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    // 如果有SVG图片且已加载完成，则在画布中间绘制图片
    if (img && img.complete && img.naturalWidth !== 0)
    {
      // 计算图片在画布中的位置，使其居中
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      // 计算缩放比例，确保图片适合画布
      const scale = Math.min(
        width * 0.4 / imgWidth, // 使图片宽度最多占画布的80%
        height * 0.4 / imgHeight // 使图片高度最多占画布的80%
      );

      const scaledWidth = imgWidth * scale;
      const scaledHeight = imgHeight * scale;

      // 计算居中位置
      const x = (width - scaledWidth) / 2;
      const y = (height - scaledHeight) / 2;

      // 绘制图片
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
    }
    window.requestAnimationFrame(drawToCanvas);
  };

  drawToCanvas();

  // 捕获 Canvas 的视频流
  const videoTrack = canvas.captureStream(fps).getVideoTracks()[0];

  try
  {
    videoTrack.applyConstraints({ width: { exact: width }, height: { exact: height }, frameRate: { ideal: fps } });
  }
  catch (error) { console.warn(error); }

  // 返回视频轨道和清理函数
  return {
    videoTrack : videoTrack,
    // 添加清理函数
    cleanup    : () =>
    {
      sessionStorage.setItem('stopBlackTrack', 'true');
      // 如果使用了URL.createObjectURL，需要释放
      if (img && img.src.startsWith('blob:'))
      {
        URL.revokeObjectURL(img.src);
      }
    },
    reset : () =>
    {
      try
      {
        videoTrack.applyConstraints({ width: { exact: width }, height: { exact: height }, frameRate: { ideal: fps } });
      }
      catch (error) { console.warn(error); }
    }
  };
};
// 停止黑屏视频
exports.stopBlackVideo = () =>
{
  sessionStorage.setItem('stopBlackTrack', true);
};

// 创建一个静音音频轨道
const createSilentAudioTrack = async() =>
{
  const audio = new Audio();
  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  const source = audioContext.createMediaElementSource(audio);

  audio.loop = true;
  audio.crossOrigin = 'anonymous';
  audio.play().catch((error) => { console.warn(`new Audio() error: ${JSON.stringify(error)}`); });
  source.connect(destination);

  return {
    state        : audioContext.state,
    audioContext : audioContext,
    audioTrack   : destination.stream.getAudioTracks()[0]
  };
};

/**
 * 生成空音频流，根据是否支持 MediaStreamTrackGenerator 选择不同的方式
 * AudioContext 生成还是浏览器api直接生成
 */
exports.generateAnEmptyAudioTrack=() =>
{
  // if ('MediaStreamTrackGenerator' in window)
  // {
  //   // 如果支持 MediaStreamTrackGenerator，则使用它创建空视频轨道
  //   try
  //   {
  //     // eslint-disable-next-line no-undef
  //     const trackGenerator = new MediaStreamTrackGenerator({ kind: 'audio' });

  //     return { state: null, audioTrack: trackGenerator };
  //   }
  //   catch (error)
  //   {
  //     return createSilentAudioTrack();
  //   }
  // }
  // else
  // {
  // 如果不支持 MediaStreamTrackGenerator，则使用 canvas.captureStream()
  return createSilentAudioTrack();
  // }
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

exports.getApplicationMediaPositions = (sdp) =>
{
  // 将SDP按媒体块分割
  const sections = sdp.split(/m=/);
  const header = sections.shift();
  const mediaSections = sections.map((s) => `m=${ s}`);

  // 获取第一个媒体的ice凭证
  const firstMediaIceUfragMatch = mediaSections[0].match(/a=ice-ufrag:([^\r\n]+)/);
  const firstMediaIcePwdMatch = mediaSections[0].match(/a=ice-pwd:([^\r\n]+)/);
  const firstMediaIceUfrag = firstMediaIceUfragMatch ? firstMediaIceUfragMatch[1] : null;
  const firstMediaIcePwd = firstMediaIcePwdMatch ? firstMediaIcePwdMatch[1] : null;

  // 获取原始索引位置
  const bfcpIndex = mediaSections.findIndex((s) => s.includes('application') && s.includes('webrtc-datachannel'));
  const h224Index = mediaSections.findIndex((s) => s.includes('application') && s.includes('H224'));
  const tcpBfcpInde = mediaSections.findIndex((s) => s.includes('application') && s.includes('TCP/TLS/BFCP'));

  const indexesToRemove = [ h224Index, tcpBfcpInde ].filter((i) => i !== -1).sort((a, b) => b - a); // 降序排序

  indexesToRemove.forEach((index) =>
  {
    // 删除对应索引
    mediaSections.splice(index, 1);
  });

  // 如果存在BFCP媒体块，移动到最后
  if (bfcpIndex !== -1)
  {
    const bfcpSection = mediaSections.splice(bfcpIndex, 1)[0];

    mediaSections.push(bfcpSection);
  }

  // 为每个没有ice凭证的媒体块添加ice凭证，并为视频媒体添加rtcp-mux
  mediaSections.forEach((section, index) =>
  {
    let updatedSection = section;

    // 添加ice凭证
    if (firstMediaIceUfrag && firstMediaIcePwd && !section.includes('a=ice-ufrag:'))
    {
      updatedSection = updatedSection.replace(/(\r\n|\r|\n)/,
        `$1a=ice-ufrag:${firstMediaIceUfrag}\r\na=ice-pwd:${firstMediaIcePwd}\r\n`);
    }

    // 为视频媒体添加rtcp-mux
    if (section.startsWith('m=video') && !section.includes('a=rtcp-mux'))
    {
      updatedSection = updatedSection.replace(/(\r\n|\r|\n)/, '$1a=rtcp-mux\r\n');
    }

    mediaSections[index] = updatedSection;
  });

  // 重新组合SDP
  const newSdp = header + mediaSections.join('');

  // 返回原始索引位置和处理后的SDP
  return {
    originalIndexes : [ bfcpIndex, h224Index, tcpBfcpInde ],
    sdp             : newSdp
  };
};

exports.reorderApplicationMedia = (sdp, positions) =>
{
  const [ bfcpIndex, h224Index ] = positions;
  // 将SDP按媒体块分割
  const sections = sdp.split(/m=/);
  const header = sections.shift();
  const mediaSections = sections.map((s) => `m=${ s}`);

  // 找到BFCP和H224的媒体块
  const bfcpSection = mediaSections.find((s) => s.includes('application') && s.includes('BFCP'));
  const h224Section = mediaSections.find((s) => s.includes('application') && s.includes('H224'));

  // 移除原来的application媒体块
  const filteredSections = mediaSections.filter((s) =>
    !(s.includes('application') && (s.includes('BFCP') || s.includes('H224')))
  );

  // 在指定位置插入application媒体块
  if (bfcpSection)
  {
    filteredSections.splice(bfcpIndex, 0, bfcpSection);
  }
  if (h224Section)
  {
    filteredSections.splice(h224Index, 0, h224Section);
  }

  // 重新组合SDP
  return header + filteredSections.join('');
};

// rtcp-fb 改为 *
exports.processSdp = (sdp) =>
{
  // 将SDP按行分割
  const lines = sdp.split('\n');
  const processedLines = [];
  // let currentMediaType = ''; // 用于标记当前处理的媒体类型
  const seenRtcpFb = new Set(); // 用于存储当前媒体块中的rtcp-fb规则

  for (let i = 0; i < lines.length; i++)
  {
    let line = lines[i];

    // 检查是否进入新的媒体块
    if (line.startsWith('m='))
    {
      // 清空已见过的rtcp-fb集合
      seenRtcpFb.clear();
      // currentMediaType = line;
      processedLines.push(line);
      continue;
    }

    // 处理rtcp-fb行
    if (line.match(/^a=rtcp-fb:/))
    {
      // 将具体编码数字替换为*
      line = line.replace(/^a=rtcp-fb:\d+/, 'a=rtcp-fb:*');

      // 检查在当前媒体块中是否已经存在该规则
      if (seenRtcpFb.has(line))
      {
        continue; // 跳过重复的行
      }
      seenRtcpFb.add(line);
    }

    processedLines.push(line);
  }

  // 重新组合SDP
  return processedLines.join('\n');
};

// 是否Firefox浏览器
exports.isFirefox = () =>
{
  return typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
};

// 从SDP里面获取DTMF的payload
exports.getDtmfPayloadAndClockRate = (sdp) =>
{
  const lines = sdp.split('\n');
  const dtmfInfo = new Map(); // 使用 Map 存储，确保 payload 唯一

  for (const line of lines)
  {
    // 匹配形如 "a=rtpmap:110 telephone-event/48000" 的行
    const rtpmapDtmfMatch = line.match(/^a=rtpmap:(\d+)\s+telephone-event\/(\d+)/);

    if (rtpmapDtmfMatch)
    {
      const payload = rtpmapDtmfMatch[1];
      const clockRate = rtpmapDtmfMatch[2];
      // 如果同一个 payload 有多个定义（尽管不常见），这里会取最后一个

      dtmfInfo.set(payload, clockRate);
    }
  }

  // 将 Map 转换为数组以便输出
  return Array.from(dtmfInfo, ([ payload, clockRate ]) => ({ payload, clockRate }));
};

// 修复sdp里面rtcp行缺少ip地址的问题
exports.fixRtcpLines = (sdp) =>
{
  return sdp.replace(/^(a=rtcp:\d+(?:\s+IN\s+IP[46])?)(?:\s*)$/gm, (match, prefix) =>
  {
    // 如果已经有IP地址，不做修改
    if (/\d+\.\d+\.\d+\.\d+$/.test(match) || /[0-9a-fA-F:]+$/.test(match))
    {
      return match;
    }

    // 如果没有IP地址，添加默认的 0.0.0.0
    return `${prefix } 0.0.0.0`;
  });
};

/**
 * 根据提供的 payload 类型映射更新 SDP 字符串的 DTMF payload。
 * @param {Array<Object>} payloadMappings 一个对象数组，每个对象包含 { payloadType: number, frequency: number }。
 * @param {string} sdp 原始的 SDP 字符串。
 * @returns {string} 更新后的 SDP 字符串。
 */
exports.replaceDtmfPayloads = (sdp, payloadMappings) =>
{
  const lines = sdp.split('\r\n');
  const newSdpLines = [];

  // 1. 预处理新的 DTMF 信息，方便按频率查找新 payload
  // Map<clockRate, newPayload>
  const newDtmfPayloadByClockRate = new Map();

  payloadMappings.forEach((info) =>
  {
    newDtmfPayloadByClockRate.set(info.clockRate, info.payload);
  });

  // 2. 预处理目标 SDP 中的原始 DTMF rtpmap 信息，用于将现有 payload 映射回其时钟频率
  // Map<originalPayload, clockRate>
  const originalDtmfRtpmapLookup = new Map();

  lines.forEach((line) =>
  {
    const rtpmapDtmfMatch = line.match(/^a=rtpmap:(\d+)\s+telephone-event\/(\d+)/);

    if (rtpmapDtmfMatch)
    {
      const payload = rtpmapDtmfMatch[1];
      const clockRate = rtpmapDtmfMatch[2];

      originalDtmfRtpmapLookup.set(payload, clockRate);
    }
  });

  // 3. 遍历目标 SDP 行并执行替换
  for (const line of lines)
  {
    let processedLine = line;

    // 尝试匹配 a=rtpmap:XX telephone-event/YYY 行
    const rtpmapDtmfMatch = line.match(/^a=rtpmap:(\d+)\s+(telephone-event\/)(\d+)/);

    if (rtpmapDtmfMatch)
    {
      const codecAndSeparator = rtpmapDtmfMatch[2]; // "telephone-event/"
      const clockRate = rtpmapDtmfMatch[3];

      // 检查是否有新的 payload 对应这个时钟频率
      if (newDtmfPayloadByClockRate.has(clockRate))
      {
        const newPayload = newDtmfPayloadByClockRate.get(clockRate);

        processedLine = `a=rtpmap:${newPayload} ${codecAndSeparator}${clockRate}`;
      }
    }
    else
    {
      // 如果不是 DTMF rtpmap 行，则检查 m=audio 和 a=fmtp 行，因为它们也可能包含 DTMF payload

      // 尝试匹配 m=audio 行
      const audioMLineMatch = line.match(/^(m=audio\s+\d+\s+UDP\/TLS\/RTP\/SAVPF\s+)(.*)/);

      if (audioMLineMatch)
      {
        const prefix = audioMLineMatch[1];
        const currentPayloadsStr = audioMLineMatch[2];
        const currentPayloads = currentPayloadsStr.split(/\s+/);
        const updatedAudioPayloads = [];

        for (const p of currentPayloads)
        {
          if (originalDtmfRtpmapLookup.has(p))
          {
            // 如果此 payload 是原始 SDP 中的 DTMF payload
            const originalClockRate = originalDtmfRtpmapLookup.get(p);

            if (newDtmfPayloadByClockRate.has(originalClockRate))
            {
              // 并且有新的 payload 对应此频率，则进行替换
              updatedAudioPayloads.push(newDtmfPayloadByClockRate.get(originalClockRate));
            }
            else
            {
              updatedAudioPayloads.push(p); // 否则保持原样
            }
          }
          else
          {
            updatedAudioPayloads.push(p); // 非 DTMF payload 保持原样
          }
        }
        processedLine = prefix + updatedAudioPayloads.join(' ');
      }
      else
      {
        // 尝试匹配 a=fmtp:XX 行
        const fmtpMatch = line.match(/^(a=fmtp:)(\d+)(\s+.*)/);

        if (fmtpMatch)
        {
          const prefix = fmtpMatch[1]; // "a=fmtp:"
          const originalFmtpPayload = fmtpMatch[2]; // 原始 fmtp 后面的 payload 号
          const suffix = fmtpMatch[3]; // fmtp 参数部分

          if (originalDtmfRtpmapLookup.has(originalFmtpPayload))
          {
            // 如果此 fmtp payload 是原始 SDP 中的 DTMF payload
            const originalClockRate = originalDtmfRtpmapLookup.get(originalFmtpPayload);

            if (newDtmfPayloadByClockRate.has(originalClockRate))
            {
              // 并且有新的 payload 对应此频率，则进行替换
              const newPayload = newDtmfPayloadByClockRate.get(originalClockRate);

              processedLine = `${prefix}${newPayload}${suffix}`;
            }
            // 否则保持原样
          }
          // 否则保持原样 (非 DTMF fmtp 行)
        }
      }
    }
    newSdpLines.push(processedLine);
  }

  return newSdpLines.join('\r\n');
};

// 修复本端切换音频，远端sdp的问题
// 确保 SDP 的 video m-section 中包含以下行：
// a=setup, a=fingerprint, a=ice-ufrag, a=ice-pwd, a=rtcp-mux
exports.ensureVideoSdpAttrs = (sdp) =>
{
  if (typeof sdp !== 'string') return sdp;

  const eol = sdp.indexOf('\r\n') !== -1 ? '\r\n' : (sdp.indexOf('\n') !== -1 ? '\n' : '\r\n');
  const lines = sdp.split(/\r?\n/);

  // 收集所有 m= 行的索引
  const mIndices = [];

  for (let i = 0; i < lines.length; i++)
  {
    const t = (lines[i] || '').trim();

    if (t.slice(0, 2) === 'm=') mIndices.push(i);
  }

  // 构建媒体分段
  const sections = [];

  if (mIndices.length > 0)
  {
    for (let idx = 0; idx < mIndices.length; idx++)
    {
      const start = mIndices[idx];
      const end = (idx + 1 < mIndices.length) ? mIndices[idx + 1] : lines.length;
      const firstLine = (lines[start] || '').trim().toLowerCase();
      const kind = firstLine.indexOf('m=audio') === 0 ? 'audio'
        : firstLine.indexOf('m=video') === 0 ? 'video'
          : 'other';

      sections.push({ start: start, end: end, kind: kind });
    }
  }

  function ensureFinalNewline(text, newline)
  {
    return text.slice(-newline.length) === newline ? text : text + newline;
  }
  function getSectionLines(s) { return lines.slice(s.start, s.end); }
  function hasAttr(sectionLines, regex)
  {
    for (let j = 0; j < sectionLines.length; j++)
    {
      const l = (sectionLines[j] || '').trim();

      if (regex.test(l)) return true;
    }

    return false;
  }
  function getAttrLine(sectionLines, regex)
  {
    for (let j = 0; j < sectionLines.length; j++)
    {
      const l = (sectionLines[j] || '').trim();

      if (regex.test(l)) return l;
    }

    return null;
  }

  const checks = [
    { name: 'setup', test: /^a=setup(?::|$)/i },
    { name: 'fingerprint', test: /^a=fingerprint(?::|$)/i },
    { name: 'ice-ufrag', test: /^a=ice-ufrag:/i },
    { name: 'ice-pwd', test: /^a=ice-pwd:/i },
    { name: 'rtcp-mux', test: /^a=rtcp-mux$/i }
  ];

  // 没有任何 m= 行：在末尾追加一个 video m-line 即可（没有 audio 可复制）
  if (sections.length === 0)
  {
    const outLines0 = lines.slice();

    outLines0.push('m=video 0 UDP/TLS/RTP/SAVPF 106');

    return ensureFinalNewline(outLines0.join(eol), eol);
  }

  // 查找第一个 video 分段
  let videoIdx = -1;

  for (let sIdx = 0; sIdx < sections.length; sIdx++)
  {
    if (sections[sIdx].kind === 'video') { videoIdx = sIdx; break; }
  }

  if (videoIdx !== -1)
  {
    const videoSec = sections[videoIdx];
    const videoLines = getSectionLines(videoSec);

    // 全部存在则直接返回
    let allPresent = true;

    for (let cIdx = 0; cIdx < checks.length; cIdx++)
    {
      if (!hasAttr(videoLines, checks[cIdx].test)) { allPresent = false; break; }
    }
    if (allPresent) return ensureFinalNewline(sdp, eol);

    // 找到“前面最近”的 audio 分段
    let audioSec = null;

    for (let k = videoIdx - 1; k >= 0; k--)
    {
      if (sections[k].kind === 'audio') { audioSec = sections[k]; break; }
    }
    if (!audioSec) return ensureFinalNewline(sdp, eol);

    const audioLines = getSectionLines(audioSec);
    const updatedVideo = videoLines.slice();

    // 复制缺失项
    for (let cc = 0; cc < checks.length; cc++)
    {
      if (!hasAttr(updatedVideo, checks[cc].test))
      {
        const donor = getAttrLine(audioLines, checks[cc].test);

        if (donor) updatedVideo.push(donor);
      }
    }

    // 覆盖回原 SDP
    const outLines = lines.slice();
    const spliceArgs = [ videoSec.start, videoSec.end - videoSec.start ].concat(updatedVideo);

    Array.prototype.splice.apply(outLines, spliceArgs);

    return ensureFinalNewline(outLines.join(eol), eol);
  }
  else
  {
    // 不存在 video：在末尾追加，并从“前面最近的 audio（最后一个 audio）”复制
    const outLines2 = lines.slice();
    const insertPos = outLines2.length;
    let lastAudio = null;

    for (let m = sections.length - 1; m >= 0; m--)
    {
      if (sections[m].kind === 'audio' && sections[m].end <= insertPos) { lastAudio = sections[m]; break; }
    }

    const videoNew = [ 'm=video 0 UDP/TLS/RTP/SAVPF 106' ];

    if (lastAudio)
    {
      const audioLines2 = getSectionLines(lastAudio);

      for (let ci = 0; ci < checks.length; ci++)
      {
        const donor2 = getAttrLine(audioLines2, checks[ci].test);

        if (donor2) videoNew.push(donor2);
      }
    }

    Array.prototype.push.apply(outLines2, videoNew);

    return ensureFinalNewline(outLines2.join(eol), eol);
  }
};

// 主动发送关键帧
exports.sendKeyFrames = (pc, interval, frequency) =>
{
  if (!pc)
  {
    return;
  }

  let scaleResolutionDownBy = false;
  let timer;

  const start = (num) =>
  {
    let executed = 0;

    timer = setInterval(() =>
    {
      try
      {
        pc.getSenders().forEach((sender) =>
        {
          if (sender.track.kind === 'video')
          {
            const parameters = sender.getParameters();

            parameters.encodings[0].scaleResolutionDownBy = !scaleResolutionDownBy ? 1.001 : 1;
            scaleResolutionDownBy = !scaleResolutionDownBy;
            sender.setParameters(parameters);
          }
        });

        // for (const sender of pc.getSenders())
        // {
        //   if (sender.track && sender.track.kind === 'video')
        //   {
        //     // 更通用：replaceTrack 同一条 track
        //     await sender.replaceTrack(sender.track);

        //     // 如果实现支持（Chrome 等）：直接请求关键帧
        //     if (typeof sender.generateKeyFrame === 'function')
        //     {
        //       await sender.generateKeyFrame();
        //     }
        //   }
        // }
      }
      catch (error) { clearInterval(timer); console.warn(error.toString); }

      executed++;

      if ((frequency && executed >= frequency) || (num && executed >= num))
      {
        clearInterval(timer);
      }
    }, interval * 1000);
  };

  // 停止发送关键帧
  const stop = () =>
  {
    timer && clearInterval(timer);
  };

  // 定时发送
  if (interval)
  {
    start();
    if (!frequency)
    {
      return stop;
    }
  }
  else
  {
    // 只发送一次
    start(1);
  }
};