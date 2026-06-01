/* eslint no-console: 0*/

// Show uncaught errors.
process.on('uncaughtException', function(error)
{
  console.error('uncaught exception:');
  console.error(error.stack);
  process.exit(1);
});

// Minimal Event polyfill (needed by JsSIP's CustomEvent IIFE)
function Event(type)
{
  this.type = type;
}

// --- Browser-like globals polyfill for Node.js ---

// WebSocket
global.WebSocket = function()
{
  this.close = function() {};
};

// navigator (used by bowser, UA.js)
global.navigator = {
  userAgent    : '',
  mediaDevices : {
    addEventListener    : function() {},
    removeEventListener : function() {}
  }
};

// document (used by UA.js, RTCSession.js)
global.document = {
  hidden              : false,
  visibilityState     : 'visible',
  addEventListener    : function() {},
  removeEventListener : function() {},
  createEvent         : function()
  {
    return { initCustomEvent: function() {} };
  }
};

// window (used by jsencrypt, JsSIP, UA.js, RTCSession.js)
global.window = {
  crypto : {
    getRandomValues : function(buf)
    {
      return require('crypto').randomFillSync(buf);
    }
  },
  Event               : Event,
  CustomEvent         : Event,
  navigator           : global.navigator,
  addEventListener    : function() {},
  removeEventListener : function() {}
};
