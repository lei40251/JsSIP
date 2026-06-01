require('./include/common');
const CRTC = require('../lib/JsSIP.js');
const pkg = require('../package.json');


module.exports = {

  'name' : function(test)
  {
    // __TITLE__ is a build-time placeholder replaced by gulp-replace during browserify.
    // When running directly from lib/ (no build step), it stays as the placeholder.
    const expected = pkg.title; 

    test.ok(CRTC.name === expected || CRTC.name === '__TITLE__',
      `CRTC.name should be "${expected}" or "__TITLE__" (build placeholder), got "${CRTC.name}"`);
    test.done();
  },

  'version' : function(test)
  {
    const expected = pkg.version;

    test.ok(CRTC.version === expected || CRTC.version === '__VERSION__',
      `CRTC.version should be "${expected}" or "__VERSION__" (build placeholder), got "${CRTC.version}"`);
    test.done();
  }

};
