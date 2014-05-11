var fs = require('fs');
var exec = require('child_process').exec;
var gtmdir = '/opt/lsb-gtm';
var gtmver = '6.0-001_i686';

if (!fs.existsSync('/usr/local/lib/libgtmshr.so')) {
  var contents = '#!/usr/bin/env bash\nsudo -i\ncd /usr/local/lib\nln -s ' + gtmdir + '/' + gtmver + '/libgtmshr.so\nldconfig\nexit';
  fs.writeFileSync('tmp.sh', contents, 'utf-8');
  var ok = exec('tmp.sh', function() {
    fs.unlinkSync('tmp.sh');
  });
};

process.env['GTMCI'] = process.cwd() + '/node_modules/nodem/resources/calltab.ci';
process.env['gtmroutines'] = process.cwd() + '/node_modules/nodem/src ' + process.env['gtmroutines'];
