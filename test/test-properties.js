require('./include/common');
const CRTC = require('../lib-es5/JsSIP.js');
const pkg = require('../package.json');


module.exports = {

  'name' : function(test)
  {
    test.equal(CRTC.name, pkg.title);
    test.done();
  },

  'version' : function(test)
  {
    test.equal(CRTC.version, pkg.version);
    test.done();
  }

};
