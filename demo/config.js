/* eslint-disable max-len */
/* eslint-disable no-unused-vars */

const defaulteEnv = {
  signalingUrl       : 'wss://5g.vsbc.com:9002/wss',
  sipDomain          : '5g.vsbc.com',
  secretKey          : sessionStorage.getItem('secret_key') || 'pdiC8Sg121leH89+tXKLKmUIJTrUqf/Jq+i5vtsl10n4Us/7m2RuyMZWZWIgs4+WyZPfluXtmOwgq2QV8ZVk1+nL7E/5ZovRARwZzeeiG+Y39e9BRXiiu0panarGBzLfaAaMxnr3itlq6XWBvKDbN/PXS0NpQ55zRcEgRoXrBB0so1klK5gqPyF5bbyUVAUidla4qgnoXYufxGOLSbYezKPaW07uaHDWPigsHRxCFnvspPzYIZhJGWQBXiutPhI3oriGjcomkcodTtwHTpF7TGNVKbdous9TgS7MnawZGEwBNVk8VYUjeGbU8Op/BnWDseSRJHz/0NV4LFBogIjQxA==',
  // iceServers         : [ { 'urls': 'turn:5g.vsbc.com:60000?transport=udp', 'username': 'ipcu', 'credential': 'yl_19cu' } ],
  iceTransportPolicy : 'relay'
};

const envs =
{
  env_default : defaulteEnv,
  env_5g      : defaulteEnv,
  env_dev     : {
    signalingUrl       : 'wss://dev.vsbc.com:5062/wss',
    sipDomain          : 'dev.vsbc.com',
    secretKey          : sessionStorage.getItem('secret_key') || 'rq+mNXSyGT04iMNQDXxCbuZJZNwnO3royUvKKPIw4KBNXH1tKmO0/loaggQn7LD9Q3ua1yxOgWaHZiVrd8JJoRd1IvkHuVf2o3Q7QSHvS+SIUIhq+bFb8Vti12wVRVpQ489XEWjqrRLa/YZ/HOWkZIi7Zulmd6O8HMlCY8nnlRPZI/XRRPEyKsLrncdJcE4mtPkaenj2LrI4NbC3jBWfKGAXQo3Ddvzyqpd8qhJqnKkW87IH/UH+MRDHVI8UcoMPlRDs2nFC5JTm8b0+Tq0sb8X2t2NDl41ccPHXYfBbSbOgEiMcQsnehsrCXuEMX+puEJcl+OUpNRNB0GcyzS46SA==',
    iceServers         : null,
    iceTransportPolicy : 'all'
  },
  env_a : {
    signalingUrl : 'wss://a.vsbc.com:5062/wss',
    sipDomain    : 'a.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'pdiC8Sg121leH89+tXKLKmUIJTrUqf/Jq+i5vtsl10n4Us/7m2RuyMZWZWIgs4+WyZPfluXtmOwgq2QV8ZVk1+nL7E/5ZovRARwZzeeiG+Y39e9BRXiiu0panarGBzLfaAaMxnr3itlq6XWBvKDbN/PXS0NpQ55zRcEgRoXrBB0so1klK5gqPyF5bbyUVAUidla4qgnoXYufxGOLSbYezKPaW07uaHDWPigsHRxCFnvspPzYIZhJGWQBXiutPhI3oriGjcomkcodTtwHTpF7TGNVKbdous9TgS7MnawZGEwBNVk8VYUjeGbU8Op/BnWDseSRJHz/0NV4LFBogIjQxA==',
    iceServers   : null
  },
  env_pro40 : {
    signalingUrl : 'wss://pro.vsbc.com:60040/wss',
    sipDomain    : 'pro.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'pdiC8Sg121leH89+tXKLKmUIJTrUqf/Jq+i5vtsl10n4Us/7m2RuyMZWZWIgs4+WyZPfluXtmOwgq2QV8ZVk1+nL7E/5ZovRARwZzeeiG+Y39e9BRXiiu0panarGBzLfaAaMxnr3itlq6XWBvKDbN/PXS0NpQ55zRcEgRoXrBB0so1klK5gqPyF5bbyUVAUidla4qgnoXYufxGOLSbYezKPaW07uaHDWPigsHRxCFnvspPzYIZhJGWQBXiutPhI3oriGjcomkcodTtwHTpF7TGNVKbdous9TgS7MnawZGEwBNVk8VYUjeGbU8Op/BnWDseSRJHz/0NV4LFBogIjQxA==',
    iceServers   : null
  },
  env_pro41 : {
    signalingUrl : 'wss://pro.vsbc.com:60041/wss',
    sipDomain    : 'pro.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'pdiC8Sg121leH89+tXKLKmUIJTrUqf/Jq+i5vtsl10n4Us/7m2RuyMZWZWIgs4+WyZPfluXtmOwgq2QV8ZVk1+nL7E/5ZovRARwZzeeiG+Y39e9BRXiiu0panarGBzLfaAaMxnr3itlq6XWBvKDbN/PXS0NpQ55zRcEgRoXrBB0so1klK5gqPyF5bbyUVAUidla4qgnoXYufxGOLSbYezKPaW07uaHDWPigsHRxCFnvspPzYIZhJGWQBXiutPhI3oriGjcomkcodTtwHTpF7TGNVKbdous9TgS7MnawZGEwBNVk8VYUjeGbU8Op/BnWDseSRJHz/0NV4LFBogIjQxA==',
    iceServers   : null
  },
  env_pro12550 : {
    signalingUrl : 'wss://pro.vsbc.com:12550/wss',
    sipDomain    : 'pro.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'pdiC8Sg121leH89+tXKLKmUIJTrUqf/Jq+i5vtsl10n4Us/7m2RuyMZWZWIgs4+WyZPfluXtmOwgq2QV8ZVk1+nL7E/5ZovRARwZzeeiG+Y39e9BRXiiu0panarGBzLfaAaMxnr3itlq6XWBvKDbN/PXS0NpQ55zRcEgRoXrBB0so1klK5gqPyF5bbyUVAUidla4qgnoXYufxGOLSbYezKPaW07uaHDWPigsHRxCFnvspPzYIZhJGWQBXiutPhI3oriGjcomkcodTtwHTpF7TGNVKbdous9TgS7MnawZGEwBNVk8VYUjeGbU8Op/BnWDseSRJHz/0NV4LFBogIjQxA==',
    iceServers   : [ {
      'urls'       : 'turn:pro.vsbc.com:12103?transport=udp',
      'username'   : 'user',
      'credential' : '5g_24@cu'
    } ],
    iceTransportPolicy : 'relay'
  },
  env_jfvideo : {
    signalingUrl : 'wss://jfvideo-bond-media-stg.zgpajf.com.cn:50600/wss',
    sipDomain    : 'jfvideo-bond-media-stg.zgpajf.com.cn',
    secretKey    : sessionStorage.getItem('secret_key') || 'pdiC8Sg121leH89+tXKLKmUIJTrUqf/Jq+i5vtsl10n4Us/7m2RuyMZWZWIgs4+WyZPfluXtmOwgq2QV8ZVk1+nL7E/5ZovRARwZzeeiG+Y39e9BRXiiu0panarGBzLfaAaMxnr3itlq6XWBvKDbN/PXS0NpQ55zRcEgRoXrBB0so1klK5gqPyF5bbyUVAUidla4qgnoXYufxGOLSbYezKPaW07uaHDWPigsHRxCFnvspPzYIZhJGWQBXiutPhI3oriGjcomkcodTtwHTpF7TGNVKbdous9TgS7MnawZGEwBNVk8VYUjeGbU8Op/BnWDseSRJHz/0NV4LFBogIjQxA==',
    iceServers   : null
  },
  env_cloudnetuc : {
    signalingUrl : 'wss://cloudnetuc.vsbc.com:50600/wss',
    sipDomain    : 'cloudnetuc.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'hKYP6CQrdljDH/gqoulQH3HixgezPT6vYJVYY9W1rhf0nII/loX9ToYk09FqSks2NK/m0i9uW6RVvkYvIbL5DDy/TQXFGxILQ286mx1AS6POVOHT4X9rYu048f65/uHilP3YIFyIF2eTibvSydT4wwQBFqn1mcTJzF4n14frDE+wp0wkZpl5vF+hjRITPXnRJ/r2ge19JBmzm5t4NBCSY/UHb2XroNBkYpZ2TtikkghmEAewVOmhI83eBn0QTuzng1hTMFn+zBTCBBe/MUQONUgI9jbPBLXMiPWTUV2SQrLbocvJlxJr/HkYeq+hRGdXzoOLIdd1vfvfBG02WH3KuQ==',
    iceServers   : [ {
      'urls'       : 'turn:cloudnetuc.vsbc.com:20100?transport=udp',
      'username'   : 'ipcu',
      'credential' : 'yl_19cu'
    }, {
      'urls'       : 'turn:cloudnetuc.vsbc.com:20100?transport=tcp',
      'username'   : 'ipcu',
      'credential' : 'yl_19cu'
    } ],
    iceTransportPolicy : 'relay'
  },
  env_cloudnetuc_tcp : {
    signalingUrl : 'wss://cloudnetuc.vsbc.com:50600/wss',
    sipDomain    : 'cloudnetuc.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'hKYP6CQrdljDH/gqoulQH3HixgezPT6vYJVYY9W1rhf0nII/loX9ToYk09FqSks2NK/m0i9uW6RVvkYvIbL5DDy/TQXFGxILQ286mx1AS6POVOHT4X9rYu048f65/uHilP3YIFyIF2eTibvSydT4wwQBFqn1mcTJzF4n14frDE+wp0wkZpl5vF+hjRITPXnRJ/r2ge19JBmzm5t4NBCSY/UHb2XroNBkYpZ2TtikkghmEAewVOmhI83eBn0QTuzng1hTMFn+zBTCBBe/MUQONUgI9jbPBLXMiPWTUV2SQrLbocvJlxJr/HkYeq+hRGdXzoOLIdd1vfvfBG02WH3KuQ==',
    iceServers   : [ {
      'urls'       : 'turn:cloudnetuc.vsbc.com:20100?transport=tcp',
      'username'   : 'ipcu',
      'credential' : 'yl_19cu'
    } ],
    iceTransportPolicy : 'relay'
  },
  env_cloudnetuc_udp : {
    signalingUrl : 'wss://cloudnetuc.vsbc.com:50600/wss',
    sipDomain    : 'cloudnetuc.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'hKYP6CQrdljDH/gqoulQH3HixgezPT6vYJVYY9W1rhf0nII/loX9ToYk09FqSks2NK/m0i9uW6RVvkYvIbL5DDy/TQXFGxILQ286mx1AS6POVOHT4X9rYu048f65/uHilP3YIFyIF2eTibvSydT4wwQBFqn1mcTJzF4n14frDE+wp0wkZpl5vF+hjRITPXnRJ/r2ge19JBmzm5t4NBCSY/UHb2XroNBkYpZ2TtikkghmEAewVOmhI83eBn0QTuzng1hTMFn+zBTCBBe/MUQONUgI9jbPBLXMiPWTUV2SQrLbocvJlxJr/HkYeq+hRGdXzoOLIdd1vfvfBG02WH3KuQ==',
    iceServers   : [ {
      'urls'       : 'turn:cloudnetuc.vsbc.com:20100?transport=udp',
      'username'   : 'ipcu',
      'credential' : 'yl_19cu'
    } ],
    iceTransportPolicy : 'relay'
  },
  env_cloudnetuc_no : {
    signalingUrl       : 'wss://cloudnetuc.vsbc.com:50600/wss',
    sipDomain          : 'cloudnetuc.vsbc.com',
    secretKey          : sessionStorage.getItem('secret_key') || 'hKYP6CQrdljDH/gqoulQH3HixgezPT6vYJVYY9W1rhf0nII/loX9ToYk09FqSks2NK/m0i9uW6RVvkYvIbL5DDy/TQXFGxILQ286mx1AS6POVOHT4X9rYu048f65/uHilP3YIFyIF2eTibvSydT4wwQBFqn1mcTJzF4n14frDE+wp0wkZpl5vF+hjRITPXnRJ/r2ge19JBmzm5t4NBCSY/UHb2XroNBkYpZ2TtikkghmEAewVOmhI83eBn0QTuzng1hTMFn+zBTCBBe/MUQONUgI9jbPBLXMiPWTUV2SQrLbocvJlxJr/HkYeq+hRGdXzoOLIdd1vfvfBG02WH3KuQ==',
    // iceServers         : [ { 'urls': 'turn:cloudnetuc.vsbc.com:20100?transport=udp', 'username': 'ipcu', 'credential': 'yl_19cu' } ],
    iceTransportPolicy : 'all'
  },
  env_cloudnetuchw : {
    signalingUrl : 'wss://cloudnetuchw.vsbc.com:50600/wss',
    sipDomain    : 'cloudnetuchw.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'H2pTrTdX5VyS9s/0zU1bpZgUNP8HvGUjjOawCdpLEZw7OLzkhG0ve4nDB+jMthbpSmVmyfhT8v2zmjEYvkpEDF5VOtVvuZ5ZaUHtA4Dp8PZ8EKvObEn7xp+6TIdgz4cu4ERoRk58bcjm+wckvz1hI6d68+Mc323fNiDlfMQ0MC5D4J/YDTuFqgglI33aXEy3KtnOxCfbd3TIh+/GEKjITbV2W3fAZi2bgtxhE5yZAwZGnGpiUrALCD5dVADlDh1wpcT2pAysoh/UlSDYw0VsiuF6Uyfy6lzj2KzHBYz0Mqxm7hb3l+JvLdpD9qct6174eL68+IdZay4So7BZv6TvIQ==',
    iceServers   : [ {
      'urls'       : 'turn:cloudnetuchw.vsbc.com:10000?transport=udp',
      'username'   : 'ipcu',
      'credential' : 'yl_19cu'
    }, {
      'urls'       : 'turn:cloudnetuchw.vsbc.com:10000?transport=tcp',
      'username'   : 'ipcu',
      'credential' : 'yl_19cu'
    } ],
    iceTransportPolicy : 'relay'
  },
  env_cloudnetuchw443 : {
    signalingUrl : 'wss://cloudnetuchw.vsbc.com:50443/wss',
    sipDomain    : 'cloudnetuchw.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'H2pTrTdX5VyS9s/0zU1bpZgUNP8HvGUjjOawCdpLEZw7OLzkhG0ve4nDB+jMthbpSmVmyfhT8v2zmjEYvkpEDF5VOtVvuZ5ZaUHtA4Dp8PZ8EKvObEn7xp+6TIdgz4cu4ERoRk58bcjm+wckvz1hI6d68+Mc323fNiDlfMQ0MC5D4J/YDTuFqgglI33aXEy3KtnOxCfbd3TIh+/GEKjITbV2W3fAZi2bgtxhE5yZAwZGnGpiUrALCD5dVADlDh1wpcT2pAysoh/UlSDYw0VsiuF6Uyfy6lzj2KzHBYz0Mqxm7hb3l+JvLdpD9qct6174eL68+IdZay4So7BZv6TvIQ==',
    iceServers   : [ {
      'urls'       : 'turn:cloudnetuchw.vsbc.com:10002?transport=udp',
      'username'   : 'ipcu',
      'credential' : 'yl_19cu'
    }, {
      'urls'       : 'turn:cloudnetuchw.vsbc.com:10002?transport=tcp',
      'username'   : 'ipcu',
      'credential' : 'yl_19cu'
    } ],
    iceTransportPolicy : 'relay'
  },
  env_ar_rec : {
    signalingUrl       : 'wss://crtc.ai-rtc.com:8443/wss',
    sipDomain          : 'crtc.ai-rtc.com',
    secretKey          : 'oSsKA/AuIVTMgi3G2SJZoseErvVeif9klrfHMBbj2tGf2VxvjHB0wuahGoLPV/rGbllpAuC0Rl1jDJ+Ci09zZOjnou2mL0Ebf+rKg0vf5v47VeKpmJAQecWJgnQ5+g1vBKTdi6TAD/cmtMgEfbuHbdFeQTQ7uTRNwjJT6PDbBpfYui+koO64LeZLfx01pnZLxuErWkErk7y/YptVzz9EniFqzPVrAwSrDVVXXElPhHwXnF3Le2ky1HdpoqzA96WWEopd/UsBwJntsH1+bbneeDBhliekCaalIaqNYqh/9ok2Ip5D+nlCVDJXgapzqCEw2SylZDq3VzKW5A09TzdO3w==',
    iceServers         : [ { 'urls': 'turn:116.133.5.85:30120?transport=udp', 'username': 'user', 'credential': '5g_24@cu' } ],
    iceTransportPolicy : 'relay'
  }
};