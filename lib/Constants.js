module.exports = {
  USER_AGENT : 'UA/__VERSION__ (Web)',

  // SIP scheme.
  SIP  : 'sip',
  SIPS : 'sips',

  // DataChannel
  MAX_BUFFERED_AMOUNT     : 16*1024,
  CHANNEL_CLOSING_TIMEOUT : 5*1000,

  // BFCP相关
  BFCP                     : 'BFCP',
  // BFCP心跳间隔，默认30秒
  BFCP_HEARTBEAT_INTERVAL  : 30*1000,
  // BFCP未响应重试次数；重试间隔第一次500，第n次为2的n次方乘以500，单位ms
  MAX_RETRY_ATTEMPTS       : 4,
  // BFCP控制的流transceiver索引号
  BFCP_TRANSCEIVER_INDEX   : 'trancesiver_index',
  BFCP_SHARED_STREAM_INDEX : 'shared_stream_index',

  ANIMATION_ID : 'animationId',

  CMODE : {
    PAPHONE : 'paphone'
  },

  NO_CAMERA_SVG : '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg t="1756366745939" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="10589" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100"><path d="M865.08627 773.036973l-0.83027 0.996324a35.424865 35.424865 0 0 0-17.380324-4.649513 36.006054 36.006054 0 0 0-2.767568 71.956757c8.468757 7.140324 13.062919 14.612757 13.062919 22.417297 0 45.111351-152.050162 81.643243-339.635892 81.643243-130.739892 0-244.154811-17.767784-300.945297-43.782919l-50.425081 50.36973C241.442595 995.272649 370.632649 1024 517.535135 1024c232.475676 0 420.67027-71.956757 420.67027-160.518919 0-33.542919-27.011459-64.70573-73.119135-90.444108zM965.881081 49.816216a33.210811 33.210811 0 0 0-46.937946 0L58.118919 910.751135a33.210811 33.210811 0 0 0 46.827243 46.827243L965.881081 96.643459a33.210811 33.210811 0 0 0 0-46.827243zM251.350486 647.610811a363.935135 363.935135 0 0 1-73.229837-221.405406c0-195.611676 148.895135-354.248649 339.414486-354.248648a329.728 329.728 0 0 1 222.955243 86.126702l51.58746-51.532108A407.164541 407.164541 0 0 0 517.535135 0c-229.265297 0-415.135135 190.796108-415.135135 426.205405a431.076324 431.076324 0 0 0 96.754162 273.380325z m382.643892-382.588541a199.264865 199.264865 0 0 0-278.14054 278.140541l120.665946-120.942703a83.027027 83.027027 0 1 1 53.635459-53.635459zM716.8 426.205405a207.622919 207.622919 0 0 0-1.439135-23.635027l-221.405406 221.405406a207.622919 207.622919 0 0 0 23.579676 1.494486 199.264865 199.264865 0 0 0 199.264865-199.264865z m-398.861838 373.732325A404.618378 404.618378 0 0 0 517.535135 852.410811c229.265297 0 415.135135-190.796108 415.135135-426.205406a433.34573 433.34573 0 0 0-45.996973-194.947459L830.380973 287.827027a371.407568 371.407568 0 0 1 26.568649 138.378378c0 195.611676-148.895135 354.248649-339.414487 354.248649a329.783351 329.783351 0 0 1-146.127567-33.819676z" fill="#8a8a8a" p-id="10590"></path></svg>',

  // 不同清晰度对应H264的levleId和AS值
  SDP_LEVELID_AS : {
    BP720P : {
      LEVELID          : '42c01f',
      AS               : 2162,
      VIDEOCONSTRAINTS : {
        width     : 1280,
        height    : 720,
        frameRate : 15
      }
    },
    BP480P : {
      LEVELID : '42c01e',
      AS      : 960
    }
  },

  // End and Failure causes.
  causes : {
    // Generic error causes.
    CONNECTION_ERROR    : 'Connection Error',
    REQUEST_TIMEOUT     : 'Request Timeout',
    SIP_FAILURE_CODE    : 'SIP Failure Code',
    INTERNAL_ERROR      : 'Internal Error',
    // 授权错误
    AUTHORIZATION_ERROR : 'Authorization Error',

    // SIP error causes.
    BUSY                 : 'Busy',
    REJECTED             : 'Rejected',
    REDIRECTED           : 'Redirected',
    UNAVAILABLE          : 'Unavailable',
    NOT_FOUND            : 'Not Found',
    ADDRESS_INCOMPLETE   : 'Address Incomplete',
    INCOMPATIBLE_SDP     : 'Incompatible SDP',
    MISSING_SDP          : 'Missing SDP',
    AUTHENTICATION_ERROR : 'Authentication Error',

    // Session error causes.
    BYE                      : 'Terminated',
    WEBRTC_ERROR             : 'WebRTC Error',
    CANCELED                 : 'Canceled',
    NO_ANSWER                : 'No Answer',
    EXPIRES                  : 'Expires',
    NO_ACK                   : 'No ACK',
    DIALOG_ERROR             : 'Dialog Error',
    USER_DENIED_MEDIA_ACCESS : 'User Denied Media Access',
    BAD_MEDIA_DESCRIPTION    : 'Bad Media Description',
    RTP_TIMEOUT              : 'RTP Timeout'
  },

  AUTHORIZATION_ERROR_CAUSES : {
    AUTH_DECRYPT_ERROR    : -1000, // 解密错误
    AUTH_ANALYSIS_ERROR   : -1001, // 解析解密后字符串错误
    AUTH_PRODUCT_ID_ERROR : -1002, // 产品ID错误
    AUTH_STARTTIME_ERROR  : -1003, // 授权开始时间错误
    AUTH_ENDTIME_ERROR    : -1004, // 授权结束时间错误
    AUTH_ENDVERSION_ERROR : -1005, // 截至版本号错误
    AUTH_HID_ERROR        : -1006, // 一机一码错误
    AUTH_SIPDOMAIN_ERROR  : -1007, // SIP域名错误
    AUTH_SIPPROXY_ERROR   : -1008, // 代理服务器地址错误
    AUTH_PLATFORMID_ERROR : -1009 // 授权平台错误
  },

  SIP_ERROR_CAUSES : {
    REDIRECTED           : [ 300, 301, 302, 305, 380 ],
    BUSY                 : [ 486, 600 ],
    REJECTED             : [ 403, 603 ],
    NOT_FOUND            : [ 404, 604 ],
    UNAVAILABLE          : [ 480, 410, 408, 430 ],
    ADDRESS_INCOMPLETE   : [ 484, 424 ],
    INCOMPATIBLE_SDP     : [ 488, 606 ],
    AUTHENTICATION_ERROR : [ 401, 407 ]
  },

  // SIP Methods.
  ACK       : 'ACK',
  PRACK     : 'PRACK', // 100rel rfc3262
  BYE       : 'BYE',
  CANCEL    : 'CANCEL',
  INFO      : 'INFO',
  INVITE    : 'INVITE',
  MESSAGE   : 'MESSAGE',
  NOTIFY    : 'NOTIFY',
  OPTIONS   : 'OPTIONS',
  REGISTER  : 'REGISTER',
  REFER     : 'REFER',
  UPDATE    : 'UPDATE',
  SUBSCRIBE : 'SUBSCRIBE',

  // DTMF transport methods.
  DTMF_TRANSPORT : {
    INFO    : 'INFO',
    RFC2833 : 'RFC2833'
  },

  /* SIP Response Reasons
   * DOC: https://www.iana.org/assignments/sip-parameters
   * Copied from https://github.com/versatica/OverSIP/blob/master/lib/oversip/sip/constants.rb#L7
   */
  REASON_PHRASE : {
    100 : 'Trying',
    180 : 'Ringing',
    181 : 'Call Is Being Forwarded',
    182 : 'Queued',
    183 : 'Session Progress',
    199 : 'Early Dialog Terminated', // draft-ietf-sipcore-199
    200 : 'OK',
    202 : 'Accepted', // RFC 3265
    204 : 'No Notification', // RFC 5839
    300 : 'Multiple Choices',
    301 : 'Moved Permanently',
    302 : 'Moved Temporarily',
    305 : 'Use Proxy',
    380 : 'Alternative Service',
    400 : 'Bad Request',
    401 : 'Unauthorized',
    402 : 'Payment Required',
    403 : 'Forbidden',
    404 : 'Not Found',
    405 : 'Method Not Allowed',
    406 : 'Not Acceptable',
    407 : 'Proxy Authentication Required',
    408 : 'Request Timeout',
    410 : 'Gone',
    412 : 'Conditional Request Failed', // RFC 3903
    413 : 'Request Entity Too Large',
    414 : 'Request-URI Too Long',
    415 : 'Unsupported Media Type',
    416 : 'Unsupported URI Scheme',
    417 : 'Unknown Resource-Priority', // RFC 4412
    420 : 'Bad Extension',
    421 : 'Extension Required',
    422 : 'Session Interval Too Small', // RFC 4028
    423 : 'Interval Too Brief',
    424 : 'Bad Location Information', // RFC 6442
    428 : 'Use Identity Header', // RFC 4474
    429 : 'Provide Referrer Identity', // RFC 3892
    430 : 'Flow Failed', // RFC 5626
    433 : 'Anonymity Disallowed', // RFC 5079
    436 : 'Bad Identity-Info', // RFC 4474
    437 : 'Unsupported Certificate', // RFC 4744
    438 : 'Invalid Identity Header', // RFC 4744
    439 : 'First Hop Lacks Outbound Support', // RFC 5626
    440 : 'Max-Breadth Exceeded', // RFC 5393
    469 : 'Bad Info Package', // draft-ietf-sipcore-info-events
    470 : 'Consent Needed', // RFC 5360
    478 : 'Unresolvable Destination', // Custom code copied from Kamailio.
    480 : 'Temporarily Unavailable',
    481 : 'Call/Transaction Does Not Exist',
    482 : 'Loop Detected',
    483 : 'Too Many Hops',
    484 : 'Address Incomplete',
    485 : 'Ambiguous',
    486 : 'Busy Here',
    487 : 'Request Terminated',
    488 : 'Not Acceptable Here',
    489 : 'Bad Event', // RFC 3265
    491 : 'Request Pending',
    493 : 'Undecipherable',
    494 : 'Security Agreement Required', // RFC 3329
    500 : 'CRTC Internal Error',
    501 : 'Not Implemented',
    502 : 'Bad Gateway',
    503 : 'Service Unavailable',
    504 : 'Server Time-out',
    505 : 'Version Not Supported',
    513 : 'Message Too Large',
    580 : 'Precondition Failure', // RFC 3312
    600 : 'Busy Everywhere',
    603 : 'Decline',
    604 : 'Does Not Exist Anywhere',
    606 : 'Not Acceptable'
  },

  ALLOWED_METHODS                  : 'INVITE,ACK,PRACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY',
  ACCEPTED_BODY_TYPES              : 'application/sdp, application/dtmf-relay',
  MAX_FORWARDS                     : 69,
  SESSION_EXPIRES                  : 90,
  MIN_SESSION_EXPIRES              : 60,
  CONNECTION_RECOVERY_MAX_INTERVAL : 30,
  CONNECTION_RECOVERY_MIN_INTERVAL : 2
};
