var fs = require('fs');
var os = require('os');

var home = process.env.HOME;
var gtmdir = home + '/.fis-gtm';
var gtmver = fs.readdirSync(gtmdir)[0];
var gtmroot = gtmdir + '/' + gtmver;
var gtmver2 = fs.readdirSync('/usr/lib/fis-gtm')[0];
var gtmdist = '/usr/lib/fis-gtm/' + gtmver2;

process.env['GTM_REPLICATION'] = 'off';
process.env['gtmdir'] = gtmdir;
process.env['gtmver'] = gtmver;
process.env['gtm_dist'] = gtmdist;
//process.env['GTMCI'] = process.cwd() + '/node_modules/nodem/resources/calltab.ci';
process.env['GTMCI'] = process.cwd() + '/node_modules/nodem/resources/nodem.ci';
process.env['gtmgbldir'] = gtmroot + '/g/gtm.gld';
process.env['gtmroutines'] = gtmroot + '/o(' + gtmroot + '/r ' + gtmdir + '/r)'
if (os.arch() !== 'ia32') process.env['gtmroutines'] = process.env['gtmroutines'] + ' ' + gtmdist + '/libgtmutil.so'
process.env['gtmroutines'] = process.env['gtmroutines'] + ' ' + gtmdist + ' ' + process.cwd() + '/node_modules/nodem/src';

module.exports = {
  setParams: function() {
    return {
    };
  }
};
