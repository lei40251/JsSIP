const pkg = require('../package.json');

module.exports = {
  USER_AGENT : `UA/${pkg.version} (Web)`,

  // SIP scheme.
  SIP  : 'sip',
  SIPS : 'sips',

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
  CONNECTION_RECOVERY_MIN_INTERVAL : 2,
  RING_AUDIO                       : 'data:audio/ogg;base64,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'
};
