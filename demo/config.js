/* eslint-disable max-len */
/* eslint-disable no-unused-vars */

const defaulteEnv = {
  signalingUrl       : 'wss://5g.vsbc.com:9006/wss',
  sipDomain          : '5g.vsbc.com',
  secretKey          : sessionStorage.getItem('secret_key') || 'NqxXyFxzRgtUFimTCPdX++hWdLPlFNZsiD9FzMyZF3fLix3YQ33e81ioVXEmH5lTNDWN4R/FX43O+L4qgi1P02Zi8t18Stg36yxG8N9mLTtM8ksD1joAV21MT/NquAadCI0u/Ki9jwxoyutWd5BlpimAWvEKeZycgPnxbQJdlse8lyuQMDdMfY+EbBvuqe7eYOpIOG3Qh5xwfnK1tSJK5vkNSI0HWOFGEYKGynayYKnzOCLRC1Us4VPsD+a50IpiZAn7/sSpTXByt5uclHvIdWe1DaeSlKM/dPm9KpO78fRTdlqFEpWMdyZ8MUoFDXktRjl3PLPnAmTdSnSo3fyA6g==',
  iceServers         : [ { 'urls': 'turn:5g.vsbc.com:60000?transport=udp', 'username': 'ipcu', 'credential': 'yl_19cu' } ],
  iceTransportPolicy : 'relay'
};

const defaulteEnv_no = {
  signalingUrl : 'wss://5g.vsbc.com:9006/wss',
  sipDomain    : '5g.vsbc.com',
  secretKey    : sessionStorage.getItem('secret_key') || 'NqxXyFxzRgtUFimTCPdX++hWdLPlFNZsiD9FzMyZF3fLix3YQ33e81ioVXEmH5lTNDWN4R/FX43O+L4qgi1P02Zi8t18Stg36yxG8N9mLTtM8ksD1joAV21MT/NquAadCI0u/Ki9jwxoyutWd5BlpimAWvEKeZycgPnxbQJdlse8lyuQMDdMfY+EbBvuqe7eYOpIOG3Qh5xwfnK1tSJK5vkNSI0HWOFGEYKGynayYKnzOCLRC1Us4VPsD+a50IpiZAn7/sSpTXByt5uclHvIdWe1DaeSlKM/dPm9KpO78fRTdlqFEpWMdyZ8MUoFDXktRjl3PLPnAmTdSnSo3fyA6g=='
};

const envs =
{
  env_default : defaulteEnv,
  env_5g      : defaulteEnv,
  env_5g_no   : defaulteEnv_no,
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
    secretKey    : sessionStorage.getItem('secret_key') || 'FgUvPLJlMrIcAE4msvkZ4WfKy1XtpWXNoQhB9Dx8RhDw7yJfINTJsNPybpGALXOjFFbZq+iwXbRleTJgEGAAMgIpHmSlctsN/DJ7637Va8RQsGBXxAB3zpsz+n9gR4PIzhBQlKVMknvETgFIaUvbfzP0RWhzdHDvBcYGvfrjHZ6ZMcV4lbAT+uSG9xpJZKzUQTl5h2AdCt51pIYNBJftSol+szubf2sB7oAoiXWpgjJL2dc73CFwSRDvGHwMQZOgyIP/mLyw7FNeU7ENieW+At4Eytu0sETnpNlw9rIKvyl62/j/zY5VG6dWoMQ7YF8aEALXLVU0pQbDCYG2EQQ3Zg==',
    iceServers   : null
  },
  env_backqu : {
    signalingUrl       : 'wss://crtc.backqu.com:9002/wss',
    sipDomain          : 'crtc.backqu.com',
    secretKey          : sessionStorage.getItem('secret_key') || 'nQx3agNP4MAce6re5Cim7gDte6xSwvdjvd337cWZnYd2dyn+WxxZ+tFoSK2eQ0lJYXMmrvRcAhuj5FA6FnkEdHNeg3zhW0Gwme0lJ27klqopKA9qZWDs7OgmQvoxYU5mMAWuMPIWPD09+WndmsX8FURsDZQExEoC6UWjKy/lWC+QgFX3QVxQ5EbNiNKgp1JHihnx6Kps71dg034fmrCQaUzg1R2e+hPwRMWCCk+n3vabjodeOyWlUTGpFpo+jx2oFPAP+TjbW7q7NNr/K1uSubuoK80ks5c7cBY6CFK3XXyFImXjOjkGvA7uSEXWHP4e99eDeyUD99ZHMEb88Phnsg==',
    iceServers         : [ { 'urls': 'turn:crtc.backqu.com:60000?transport=udp', 'username': 'ipcu', 'credential': 'yl_19cu' } ],
    iceTransportPolicy : 'relay'
  },
  env_pro40 : {
    signalingUrl : 'wss://pro.vsbc.com:60040/wss',
    sipDomain    : 'pro.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'NqxXyFxzRgtUFimTCPdX++hWdLPlFNZsiD9FzMyZF3fLix3YQ33e81ioVXEmH5lTNDWN4R/FX43O+L4qgi1P02Zi8t18Stg36yxG8N9mLTtM8ksD1joAV21MT/NquAadCI0u/Ki9jwxoyutWd5BlpimAWvEKeZycgPnxbQJdlse8lyuQMDdMfY+EbBvuqe7eYOpIOG3Qh5xwfnK1tSJK5vkNSI0HWOFGEYKGynayYKnzOCLRC1Us4VPsD+a50IpiZAn7/sSpTXByt5uclHvIdWe1DaeSlKM/dPm9KpO78fRTdlqFEpWMdyZ8MUoFDXktRjl3PLPnAmTdSnSo3fyA6g==',
    iceServers   : null
  },
  env_pro41 : {
    signalingUrl : 'wss://pro.vsbc.com:60041/wss',
    sipDomain    : 'pro.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'NqxXyFxzRgtUFimTCPdX++hWdLPlFNZsiD9FzMyZF3fLix3YQ33e81ioVXEmH5lTNDWN4R/FX43O+L4qgi1P02Zi8t18Stg36yxG8N9mLTtM8ksD1joAV21MT/NquAadCI0u/Ki9jwxoyutWd5BlpimAWvEKeZycgPnxbQJdlse8lyuQMDdMfY+EbBvuqe7eYOpIOG3Qh5xwfnK1tSJK5vkNSI0HWOFGEYKGynayYKnzOCLRC1Us4VPsD+a50IpiZAn7/sSpTXByt5uclHvIdWe1DaeSlKM/dPm9KpO78fRTdlqFEpWMdyZ8MUoFDXktRjl3PLPnAmTdSnSo3fyA6g==',
    iceServers   : null
  },
  env_pro12550 : {
    signalingUrl : 'wss://pro.vsbc.com:12550/wss',
    sipDomain    : 'pro.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'NqxXyFxzRgtUFimTCPdX++hWdLPlFNZsiD9FzMyZF3fLix3YQ33e81ioVXEmH5lTNDWN4R/FX43O+L4qgi1P02Zi8t18Stg36yxG8N9mLTtM8ksD1joAV21MT/NquAadCI0u/Ki9jwxoyutWd5BlpimAWvEKeZycgPnxbQJdlse8lyuQMDdMfY+EbBvuqe7eYOpIOG3Qh5xwfnK1tSJK5vkNSI0HWOFGEYKGynayYKnzOCLRC1Us4VPsD+a50IpiZAn7/sSpTXByt5uclHvIdWe1DaeSlKM/dPm9KpO78fRTdlqFEpWMdyZ8MUoFDXktRjl3PLPnAmTdSnSo3fyA6g==',
    iceServers   : [ {
      'urls'       : 'turn:pro.vsbc.com:12103?transport=udp',
      'username'   : 'user',
      'credential' : '5g_24@cu'
    } ],
    iceTransportPolicy : 'relay'
  },
  env_pro_b2b : {
    signalingUrl : 'wss://pro.vsbc.com:12550/wss',
    sipDomain    : 'pro.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'NqxXyFxzRgtUFimTCPdX++hWdLPlFNZsiD9FzMyZF3fLix3YQ33e81ioVXEmH5lTNDWN4R/FX43O+L4qgi1P02Zi8t18Stg36yxG8N9mLTtM8ksD1joAV21MT/NquAadCI0u/Ki9jwxoyutWd5BlpimAWvEKeZycgPnxbQJdlse8lyuQMDdMfY+EbBvuqe7eYOpIOG3Qh5xwfnK1tSJK5vkNSI0HWOFGEYKGynayYKnzOCLRC1Us4VPsD+a50IpiZAn7/sSpTXByt5uclHvIdWe1DaeSlKM/dPm9KpO78fRTdlqFEpWMdyZ8MUoFDXktRjl3PLPnAmTdSnSo3fyA6g==',
    iceServers   : [ {
      'urls'       : 'turn:pro.vsbc.com:12103?transport=udp',
      'username'   : 'user',
      'credential' : '5g_24@cu'
    } ],
    iceTransportPolicy : 'relay',
    password           : 'Admin123$'
  },
  env_jfvideo : {
    signalingUrl : 'wss://jfvideo-bond-media-stg.zgpajf.com.cn:50600/wss',
    sipDomain    : 'jfvideo-bond-media-stg.zgpajf.com.cn',
    secretKey    : 'xI1atJ6EEP/nhioXYoLXdN6tdKmEDBW6vSSrBO9gGGWzJIdHYzC8Laa7rYU4QG8WumlkPZEleHlkPgLlNI8kL3yufmMVakllcBvZs4Ho10NCHfhVLNYYnEdMSxK3w7sSL2RJ9HJh2F2ftajEN7hJxXiPf/lzNb7ASwUsI3qZwXDo1fvSAh7b0Po/flq4MPIOlyN/cf6rZ9DX83qXoP5EcgdS1cVzDz/hKIhDqPMyq50kd7rPloZCOt6nUH0XU4nmNksLqRKCQgtpVCUKqj+3UUZuvx6tBQu/coeUZa/CYexHu8x+ifqQEWuAsEe3yrNYSn1t8PWWiXDz+YCZw1UPNg==',
    iceServers   : null,
    password     : '3214'
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
  },
  env_pamb : {
    signalingUrl       : 'wss://pamb.zgpajf.com.cn:50600/wss',
    sipDomain          : 'pamb.zgpajf.com.cn',
    secretKey          : 'wDzDaMtPB/F+J5QfPgGCbCCsRYfLElw2cp8X/lNXD0KFzdiLPycFwP5rvR5ZqXS+xGHfz2+Ass4ePwPaOdKVLQoqF5YOL2knzikAn6+cF7oEE7thbJoHPNXTp6xpOcZOeuhsBriza9+TQh132Lpy6nno2fWWTUtbAocDdV90sS9tI0AyyqD5aqKBgHhKrCbviPU7wF3CuqC/g2DluGndoJ13oY3ZVgbFRZI0D+OxLwuCl5GyF04F7czW/93r0bmR4TNEZ/1esRC9hRHyou0VMoHkJe4IVow3nwex9MsxArAt5IdQAKm8o0etfdTBbsXvKnMuqtTeXkAAEz91fXVu2A==',
    iceTransportPolicy : 'relay',
    password           : 'sos_'
  }
};