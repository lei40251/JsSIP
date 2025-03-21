/* eslint-disable no-unused-vars */
/* eslint-disable max-len */

const defaulteEnv ={
  signalingUrl : 'wss://5g.vsbc.com:9002/wss',
  sipDomain    : '5g.vsbc.com',
  secretKey    : sessionStorage.getItem('secret_key') ||'WjEI+dWAJYCGB+FqZJURtj9hhb0CMY6suuv8OQbkkO0BWS039oxggfJXuijuq30BXrsFt0kO8n8zpOkyQ0fM4oZqzDiFRgRxEtbE0rABqbtLoMxniFCxaVpRQi8q7F8YbsZDyv8CKaozYsFrw2VdGTBLPtiI8akgCOIXhFwg8XVHeUJ28HLWHna/h0EyV08ottnpO8L6M9h0zxxiHR109UI+WFW5E2kK5Z/mllIM5z62kSrOx6J1gt/BYCPNVSixW1FsYDmI7BirPqytBim9MTjciHzSYosEjzmjhKA980APFXQ4YCCCqTkRjxJJAHFMWdOAttrYtyTfdEteKfRRsg==',
  iceServers   : null
};

const envs =
  {
    env_default : defaulteEnv,
    env_5g      : defaulteEnv,
    env_a       : {
      signalingUrl : 'wss://a.vsbc.com:5062/wss',
      sipDomain    : 'a.vsbc.com',
      secretKey    : sessionStorage.getItem('secret_key') ||'WjEI+dWAJYCGB+FqZJURtj9hhb0CMY6suuv8OQbkkO0BWS039oxggfJXuijuq30BXrsFt0kO8n8zpOkyQ0fM4oZqzDiFRgRxEtbE0rABqbtLoMxniFCxaVpRQi8q7F8YbsZDyv8CKaozYsFrw2VdGTBLPtiI8akgCOIXhFwg8XVHeUJ28HLWHna/h0EyV08ottnpO8L6M9h0zxxiHR109UI+WFW5E2kK5Z/mllIM5z62kSrOx6J1gt/BYCPNVSixW1FsYDmI7BirPqytBim9MTjciHzSYosEjzmjhKA980APFXQ4YCCCqTkRjxJJAHFMWdOAttrYtyTfdEteKfRRsg==',
      iceServers   : null
    },
    env_pro40 : {
      signalingUrl : 'wss://pro.vsbc.com:60040/wss',
      sipDomain    : 'pro.vsbc.com',
      secretKey    : sessionStorage.getItem('secret_key') ||'WjEI+dWAJYCGB+FqZJURtj9hhb0CMY6suuv8OQbkkO0BWS039oxggfJXuijuq30BXrsFt0kO8n8zpOkyQ0fM4oZqzDiFRgRxEtbE0rABqbtLoMxniFCxaVpRQi8q7F8YbsZDyv8CKaozYsFrw2VdGTBLPtiI8akgCOIXhFwg8XVHeUJ28HLWHna/h0EyV08ottnpO8L6M9h0zxxiHR109UI+WFW5E2kK5Z/mllIM5z62kSrOx6J1gt/BYCPNVSixW1FsYDmI7BirPqytBim9MTjciHzSYosEjzmjhKA980APFXQ4YCCCqTkRjxJJAHFMWdOAttrYtyTfdEteKfRRsg==',
      iceServers   : null
    },
    env_pro41 : {
      signalingUrl : 'wss://pro.vsbc.com:60041/wss',
      sipDomain    : 'pro.vsbc.com',
      secretKey    : sessionStorage.getItem('secret_key') ||'WjEI+dWAJYCGB+FqZJURtj9hhb0CMY6suuv8OQbkkO0BWS039oxggfJXuijuq30BXrsFt0kO8n8zpOkyQ0fM4oZqzDiFRgRxEtbE0rABqbtLoMxniFCxaVpRQi8q7F8YbsZDyv8CKaozYsFrw2VdGTBLPtiI8akgCOIXhFwg8XVHeUJ28HLWHna/h0EyV08ottnpO8L6M9h0zxxiHR109UI+WFW5E2kK5Z/mllIM5z62kSrOx6J1gt/BYCPNVSixW1FsYDmI7BirPqytBim9MTjciHzSYosEjzmjhKA980APFXQ4YCCCqTkRjxJJAHFMWdOAttrYtyTfdEteKfRRsg==',
      iceServers   : null
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
      secretKey    : sessionStorage.getItem('secret_key') || 'lOujhLsCfirM1l0AlbHIAHBgZa4+6bVPsJef83HkijZ/gGhtZC8fmEsnaK9wnQCKbq6Qp1uUt9bCvv61PefL7TCa6CJITdOYYiJY4AOO8q1WHH1wri8v7yujsd9EJKn3OkCeCVnC4IfPCmElD8U7yuBgqVzDH6DDpXBIN0qUsRAr6/nSZtAHx3aF9lyN/qTC+is3Pwgs9NxXajTzyf6I7Nl1xbHCexNTp4+ndN1JaeleeeCnFVHzazE8nwrmcoH9tMwaiUjkYBYbV3qaFAEU0k9QLebcW/twJbkb8v8lTo/OFEU4hS2bzBcyoHslQQ2E1o+kgqWR9OCntSoRTtIiIA==',
      iceServers   : [ { 'urls': 'turn:cloudnetuc.vsbc.com:20100?transport=udp', 'username': 'ipcu', 'credential': 'yl_19cu' } ]
    },
    env_cloudnetuchw : {
      signalingUrl : 'wss://cloudnetuchw.vsbc.com:50600/wss',
      sipDomain    : 'cloudnetuchw.vsbc.com',
      secretKey    : sessionStorage.getItem('secret_key') || 'DNkWSqkLI79UprRRwlS09VNytskRaDdzSi+kc/SX4obPhkkRxrg7dOoQt5pWr4kYoDvAoyCYJg6IJR00mEFgs6fbnzk7qVuUV4thEF7WSM4Cp2yUtjIwActYAM/13eZDNnR73UxiepUW/arubPkQ0Y6xMwqJMRB52VL1kpI1eFf8aAioZ72FqTwlR6MiLX0llio8eUzZ42tG51kOHUXHt5HuG+EyHXeVHEYaLgqZdIB0B6Azh/g0yPvReD1wB/MHzvU+uvuFezJnfbndwlwpLJXMr6F2GKZrqgtMGUIhaLOt6mleKL059ut5JTiNGm0c1oEhQSy4RKDmiQ/+mtao2g==',
      iceServers   : [ { 'urls': 'turn:cloudnetuchw.vsbc.com:10000?transport=udp', 'username': 'ipcu', 'credential': 'yl_19cu' } ]
    }
  };