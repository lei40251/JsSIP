require('./include/common');
const JsSIP = require('../lib-es5/SFU.js');
const pkg = require('../package.json');


module.exports = {

  'name' : function(test)
  {
    test.equal(JsSIP.name, pkg.title);
    test.done();
  },

  'version' : function(test)
  {
    test.equal(JsSIP.version, pkg.version);
    test.done();
  }

};
