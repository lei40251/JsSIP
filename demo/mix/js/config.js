// var domain = 'elong.vsbc.com';
// var wss = 'wss://elong.vsbc.com:9060/wss';

/**
 * 获取url参数
 *
 * @param {string} name - 参数名，区分大小写
 */
function handleGetQuery(name)
{
  const reg = new RegExp(`(^|&)${name}=([^&]*)(&|$)`, 'i');
  const r = window.location.search.substr(1).match(reg);

  if (r != null) return unescape(r[2]);

  return null;
}

const extraFeatures = [];

const xdata = handleGetQuery('xdata') || 'dGVzdCB4LWRhdGE=';
const mbit = handleGetQuery('mbit') || 400;
const env = handleGetQuery('env');
const noremb = handleGetQuery('noremb') || false;
const { signalingUrl, sipDomain, secretKey, iceServers, iceTransportPolicy } = env ? envs[`env_${env}`] : envs['env_default'];
const exts = handleGetQuery('ext') ? handleGetQuery('ext').split(',') : null;

exts && exts.forEach((ext) => extraFeatures.push(ext));
// RTCPeerConnection 的 RTCConfiguration 对象
const pcConfig = {};

iceServers && (pcConfig['iceServers'] = iceServers);
iceTransportPolicy && (pcConfig['iceTransportPolicy'] = iceTransportPolicy);
pcConfig['iceCandidatePoolSize'] = 10;

pcConfig['bundlePolicy'] = 'max-compat';

const domain = sipDomain;
const wss = signalingUrl;
// var domain = 'elongsbc.vsbc.com';
// var wss = 'wss://elongsbc.vsbc.com:9060/wss';

// var domain = 'rtc.vsbc.com';
// var wss = 'wss://rtc.vsbc.com:5092/wss';
// var wss = 'wss://10.33.250.207:5092/wss';
// const pcConfig = {};
var phoneModal = 'audio'; // mix,audio
const enable_ice_ipv6 = 1;
const enable_group_bundle = 0;
var phoneModal = 'mix'; // mix,audio

const autoAnswer = false;
const autoAnswerTimer = 5000;
