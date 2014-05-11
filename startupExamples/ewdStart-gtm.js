/*
Example EWD.js Startup file for use with GT.M running on Linux

*/

if (process.argv[2]) var config = require(process.argv[2]);
var ewd = require('ewdjs');

var port = process.argv[3] || 8080;
var poolsize = process.argv[4] || 2;
var tracelevel = process.argv[5] || 3;
var password = process.argv[6] || 'keepThisSecret!';

var params = {
      httpPort: port,
      poolSize: poolsize,
      database: {
        type: 'gtm'
      },
      traceLevel: tracelevel,
      management: {
        password: password
     }
};

setTimeout(function() {
  ewd.start(params);
},1000);
