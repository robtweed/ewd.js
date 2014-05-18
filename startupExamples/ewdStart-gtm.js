/*
Example EWD.js Startup file for use with GT.M running on Linux

*/

var config = {};
if (process.argv[2]) config = require(process.argv[2]);
var ewd = require('ewdjs');

var defaults = {
  port: 8080,
  poolsize: 2,
  tracelevel: 3,
  password: 'keepThisSecret!',
  ssl: false,
  database: 'gtm'
};

if (config.setParams) {
  var overrides = config.setParams();
  for (var name in overrides) {
    defaults[name] = overrides[name];
  }
}

var params = {
  httpPort: defaults.port,
  poolSize: defaults.poolsize,
  database: {
    type: defaults.database
  },
  https: {
    enabled: defaults.ssl
  },
  traceLevel: defaults.tracelevel,
  management: {
    password: defaults.password
  }
};

setTimeout(function() {
  ewd.start(params);
},1000);
