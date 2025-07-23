/* eslint-disable max-len */
/* eslint-disable no-unused-vars */

const defaulteEnv = {
  signalingUrl : 'wss://5g.vsbc.com:9002/wss',
  sipDomain    : '5g.vsbc.com',
  // secretKey    : sessionStorage.getItem('secret_key') ||'WjEI+dWAJYCGB+FqZJURtj9hhb0CMY6suuv8OQbkkO0BWS039oxggfJXuijuq30BXrsFt0kO8n8zpOkyQ0fM4oZqzDiFRgRxEtbE0rABqbtLoMxniFCxaVpRQi8q7F8YbsZDyv8CKaozYsFrw2VdGTBLPtiI8akgCOIXhFwg8XVHeUJ28HLWHna/h0EyV08ottnpO8L6M9h0zxxiHR109UI+WFW5E2kK5Z/mllIM5z62kSrOx6J1gt/BYCPNVSixW1FsYDmI7BirPqytBim9MTjciHzSYosEjzmjhKA980APFXQ4YCCCqTkRjxJJAHFMWdOAttrYtyTfdEteKfRRsg==',
  secretKey    : sessionStorage.getItem('secret_key') || 'pdiC8Sg121leH89+tXKLKmUIJTrUqf/Jq+i5vtsl10n4Us/7m2RuyMZWZWIgs4+WyZPfluXtmOwgq2QV8ZVk1+nL7E/5ZovRARwZzeeiG+Y39e9BRXiiu0panarGBzLfaAaMxnr3itlq6XWBvKDbN/PXS0NpQ55zRcEgRoXrBB0so1klK5gqPyF5bbyUVAUidla4qgnoXYufxGOLSbYezKPaW07uaHDWPigsHRxCFnvspPzYIZhJGWQBXiutPhI3oriGjcomkcodTtwHTpF7TGNVKbdous9TgS7MnawZGEwBNVk8VYUjeGbU8Op/BnWDseSRJHz/0NV4LFBogIjQxA==',
  iceServers   : [ {
    'urls'       : 'turn:5g.vsbc.com:60000?transport=udp',
    'username'   : 'ipcu',
    'credential' : 'yl_19cu'
  } ],
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
    secretKey    : sessionStorage.getItem('secret_key') || 'WjEI+dWAJYCGB+FqZJURtj9hhb0CMY6suuv8OQbkkO0BWS039oxggfJXuijuq30BXrsFt0kO8n8zpOkyQ0fM4oZqzDiFRgRxEtbE0rABqbtLoMxniFCxaVpRQi8q7F8YbsZDyv8CKaozYsFrw2VdGTBLPtiI8akgCOIXhFwg8XVHeUJ28HLWHna/h0EyV08ottnpO8L6M9h0zxxiHR109UI+WFW5E2kK5Z/mllIM5z62kSrOx6J1gt/BYCPNVSixW1FsYDmI7BirPqytBim9MTjciHzSYosEjzmjhKA980APFXQ4YCCCqTkRjxJJAHFMWdOAttrYtyTfdEteKfRRsg==',
    iceServers   : null
  },
  env_pro40 : {
    signalingUrl : 'wss://pro.vsbc.com:60040/wss',
    sipDomain    : 'pro.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'WjEI+dWAJYCGB+FqZJURtj9hhb0CMY6suuv8OQbkkO0BWS039oxggfJXuijuq30BXrsFt0kO8n8zpOkyQ0fM4oZqzDiFRgRxEtbE0rABqbtLoMxniFCxaVpRQi8q7F8YbsZDyv8CKaozYsFrw2VdGTBLPtiI8akgCOIXhFwg8XVHeUJ28HLWHna/h0EyV08ottnpO8L6M9h0zxxiHR109UI+WFW5E2kK5Z/mllIM5z62kSrOx6J1gt/BYCPNVSixW1FsYDmI7BirPqytBim9MTjciHzSYosEjzmjhKA980APFXQ4YCCCqTkRjxJJAHFMWdOAttrYtyTfdEteKfRRsg==',
    iceServers   : null
  },
  env_pro41 : {
    signalingUrl : 'wss://pro.vsbc.com:60041/wss',
    sipDomain    : 'pro.vsbc.com',
    secretKey    : sessionStorage.getItem('secret_key') || 'WjEI+dWAJYCGB+FqZJURtj9hhb0CMY6suuv8OQbkkO0BWS039oxggfJXuijuq30BXrsFt0kO8n8zpOkyQ0fM4oZqzDiFRgRxEtbE0rABqbtLoMxniFCxaVpRQi8q7F8YbsZDyv8CKaozYsFrw2VdGTBLPtiI8akgCOIXhFwg8XVHeUJ28HLWHna/h0EyV08ottnpO8L6M9h0zxxiHR109UI+WFW5E2kK5Z/mllIM5z62kSrOx6J1gt/BYCPNVSixW1FsYDmI7BirPqytBim9MTjciHzSYosEjzmjhKA980APFXQ4YCCCqTkRjxJJAHFMWdOAttrYtyTfdEteKfRRsg==',
    iceServers   : null
  },
  env_jfvideo : {
    signalingUrl : 'wss://jfvideo-bond-media-stg.zgpajf.com.cn:50600/wss',
    sipDomain    : 'jfvideo-bond-media-stg.zgpajf.com.cn',
    secretKey    : sessionStorage.getItem('secret_key') || 'pdiC8Sg121leH89+tXKLKmUIJTrUqf/Jq+i5vtsl10n4Us/7m2RuyMZWZWIgs4+WyZPfluXtmOwgq2QV8ZVk1+nL7E/5ZovRARwZzeeiG+Y39e9BRXiiu0panarGBzLfaAaMxnr3itlq6XWBvKDbN/PXS0NpQ55zRcEgRoXrBB0so1klK5gqPyF5bbyUVAUidla4qgnoXYufxGOLSbYezKPaW07uaHDWPigsHRxCFnvspPzYIZhJGWQBXiutPhI3oriGjcomkcodTtwHTpF7TGNVKbdous9TgS7MnawZGEwBNVk8VYUjeGbU8Op/BnWDseSRJHz/0NV4LFBogIjQxA==',
    iceServers   : null
  },
  env_cloudnetuc : {
    signalingUrl       : 'wss://cloudnetuc.vsbc.com:50600/wss',
    sipDomain          : 'cloudnetuc.vsbc.com',
    secretKey          : sessionStorage.getItem('secret_key') || 'lOujhLsCfirM1l0AlbHIAHBgZa4+6bVPsJef83HkijZ/gGhtZC8fmEsnaK9wnQCKbq6Qp1uUt9bCvv61PefL7TCa6CJITdOYYiJY4AOO8q1WHH1wri8v7yujsd9EJKn3OkCeCVnC4IfPCmElD8U7yuBgqVzDH6DDpXBIN0qUsRAr6/nSZtAHx3aF9lyN/qTC+is3Pwgs9NxXajTzyf6I7Nl1xbHCexNTp4+ndN1JaeleeeCnFVHzazE8nwrmcoH9tMwaiUjkYBYbV3qaFAEU0k9QLebcW/twJbkb8v8lTo/OFEU4hS2bzBcyoHslQQ2E1o+kgqWR9OCntSoRTtIiIA==',
    iceServers         : [ { 'urls': 'turn:cloudnetuc.vsbc.com:20100?transport=udp', 'username': 'ipcu', 'credential': 'yl_19cu' }, { 'urls': 'turn:cloudnetuc.vsbc.com:20100?transport=tcp', 'username': 'ipcu', 'credential': 'yl_19cu' } ],
    iceTransportPolicy : 'relay'
  },
  env_cloudnetuc_tcp : {
    signalingUrl       : 'wss://cloudnetuc.vsbc.com:50600/wss',
    sipDomain          : 'cloudnetuc.vsbc.com',
    secretKey          : sessionStorage.getItem('secret_key') || 'lOujhLsCfirM1l0AlbHIAHBgZa4+6bVPsJef83HkijZ/gGhtZC8fmEsnaK9wnQCKbq6Qp1uUt9bCvv61PefL7TCa6CJITdOYYiJY4AOO8q1WHH1wri8v7yujsd9EJKn3OkCeCVnC4IfPCmElD8U7yuBgqVzDH6DDpXBIN0qUsRAr6/nSZtAHx3aF9lyN/qTC+is3Pwgs9NxXajTzyf6I7Nl1xbHCexNTp4+ndN1JaeleeeCnFVHzazE8nwrmcoH9tMwaiUjkYBYbV3qaFAEU0k9QLebcW/twJbkb8v8lTo/OFEU4hS2bzBcyoHslQQ2E1o+kgqWR9OCntSoRTtIiIA==',
    iceServers         : [ { 'urls': 'turn:cloudnetuc.vsbc.com:20100?transport=tcp', 'username': 'ipcu', 'credential': 'yl_19cu' } ],
    iceTransportPolicy : 'relay'
  },
  env_cloudnetuc_udp : {
    signalingUrl       : 'wss://cloudnetuc.vsbc.com:50600/wss',
    sipDomain          : 'cloudnetuc.vsbc.com',
    secretKey          : sessionStorage.getItem('secret_key') || 'lOujhLsCfirM1l0AlbHIAHBgZa4+6bVPsJef83HkijZ/gGhtZC8fmEsnaK9wnQCKbq6Qp1uUt9bCvv61PefL7TCa6CJITdOYYiJY4AOO8q1WHH1wri8v7yujsd9EJKn3OkCeCVnC4IfPCmElD8U7yuBgqVzDH6DDpXBIN0qUsRAr6/nSZtAHx3aF9lyN/qTC+is3Pwgs9NxXajTzyf6I7Nl1xbHCexNTp4+ndN1JaeleeeCnFVHzazE8nwrmcoH9tMwaiUjkYBYbV3qaFAEU0k9QLebcW/twJbkb8v8lTo/OFEU4hS2bzBcyoHslQQ2E1o+kgqWR9OCntSoRTtIiIA==',
    iceServers         : [ { 'urls': 'turn:cloudnetuc.vsbc.com:20100?transport=udp', 'username': 'ipcu', 'credential': 'yl_19cu' } ],
    iceTransportPolicy : 'relay'
  },
  env_cloudnetuc_no : {
    signalingUrl       : 'wss://cloudnetuc.vsbc.com:50600/wss',
    sipDomain          : 'cloudnetuc.vsbc.com',
    secretKey          : sessionStorage.getItem('secret_key') || 'lOujhLsCfirM1l0AlbHIAHBgZa4+6bVPsJef83HkijZ/gGhtZC8fmEsnaK9wnQCKbq6Qp1uUt9bCvv61PefL7TCa6CJITdOYYiJY4AOO8q1WHH1wri8v7yujsd9EJKn3OkCeCVnC4IfPCmElD8U7yuBgqVzDH6DDpXBIN0qUsRAr6/nSZtAHx3aF9lyN/qTC+is3Pwgs9NxXajTzyf6I7Nl1xbHCexNTp4+ndN1JaeleeeCnFVHzazE8nwrmcoH9tMwaiUjkYBYbV3qaFAEU0k9QLebcW/twJbkb8v8lTo/OFEU4hS2bzBcyoHslQQ2E1o+kgqWR9OCntSoRTtIiIA==',
    // iceServers         : [ { 'urls': 'turn:cloudnetuc.vsbc.com:20100?transport=udp', 'username': 'ipcu', 'credential': 'yl_19cu' } ],
    iceTransportPolicy : 'all'
  },
  env_cloudnetuchw : {
    signalingUrl       : 'wss://cloudnetuchw.vsbc.com:50600/wss',
    sipDomain          : 'cloudnetuchw.vsbc.com',
    secretKey          : sessionStorage.getItem('secret_key') || 'DNkWSqkLI79UprRRwlS09VNytskRaDdzSi+kc/SX4obPhkkRxrg7dOoQt5pWr4kYoDvAoyCYJg6IJR00mEFgs6fbnzk7qVuUV4thEF7WSM4Cp2yUtjIwActYAM/13eZDNnR73UxiepUW/arubPkQ0Y6xMwqJMRB52VL1kpI1eFf8aAioZ72FqTwlR6MiLX0llio8eUzZ42tG51kOHUXHt5HuG+EyHXeVHEYaLgqZdIB0B6Azh/g0yPvReD1wB/MHzvU+uvuFezJnfbndwlwpLJXMr6F2GKZrqgtMGUIhaLOt6mleKL059ut5JTiNGm0c1oEhQSy4RKDmiQ/+mtao2g==',
    iceServers         : [ { 'urls': 'turn:cloudnetuchw.vsbc.com:10000?transport=udp', 'username': 'ipcu', 'credential': 'yl_19cu' }, { 'urls': 'turn:cloudnetuchw.vsbc.com:10000?transport=tcp', 'username': 'ipcu', 'credential': 'yl_19cu' } ],
    iceTransportPolicy : 'relay'
  },
  env_cloudnetuchw443 : {
    signalingUrl       : 'wss://cloudnetuchw.vsbc.com:50443/wss',
    sipDomain          : 'cloudnetuchw.vsbc.com',
    secretKey          : sessionStorage.getItem('secret_key') || 'DNkWSqkLI79UprRRwlS09VNytskRaDdzSi+kc/SX4obPhkkRxrg7dOoQt5pWr4kYoDvAoyCYJg6IJR00mEFgs6fbnzk7qVuUV4thEF7WSM4Cp2yUtjIwActYAM/13eZDNnR73UxiepUW/arubPkQ0Y6xMwqJMRB52VL1kpI1eFf8aAioZ72FqTwlR6MiLX0llio8eUzZ42tG51kOHUXHt5HuG+EyHXeVHEYaLgqZdIB0B6Azh/g0yPvReD1wB/MHzvU+uvuFezJnfbndwlwpLJXMr6F2GKZrqgtMGUIhaLOt6mleKL059ut5JTiNGm0c1oEhQSy4RKDmiQ/+mtao2g==',
    iceServers         : [ { 'urls': 'turn:cloudnetuchw.vsbc.com:10002?transport=udp', 'username': 'ipcu', 'credential': 'yl_19cu' }, { 'urls': 'turn:cloudnetuchw.vsbc.com:10002?transport=tcp', 'username': 'ipcu', 'credential': 'yl_19cu' } ],
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