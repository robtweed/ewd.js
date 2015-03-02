/*
Example EWD.js Startup file for use with GlobalsDB running on Linux or OS X

Notes:

1) Change the database.path value as appropriate for your GlobalsDB installation

2) IMPORTANT!: The cache.node interface module file MUST exist in the primary node_modules directory
of your EWD.js configuration. 

3) Comment out the cwd parameter if you want to use this startup file from the command line

4) You may need to invoke this startup file as sudo if you have used Mike Clayton's Ubuntu installer for EWD.js

*/

var ewd = require('ewdjs');
var config = {};
if (process.argv[2]) config = require(process.argv[2]);

var defaults = {
  cwd: process.env.HOME + '/ewdjs',
  path: process.env.HOME + '/globalsdb/mgr',
  port: 8080,
  poolsize: 2,
  tracelevel: 3,
  password: 'keepThisSecret!',
  ssl: false
};

if (config.setParams) {
  var overrides = config.setParams();
  for (var name in overrides) {
    defaults[name] = overrides[name];
  }
}

params = {
  cwd: defaults.cwd,
  httpPort: defaults.port,
  poolSize: defaults.poolsize,
  database: {
    type: 'globals',
    path: defaults.path,
  },
  https: {
    enabled: defaults.ssl
  },
  traceLevel: defaults.tracelevel,
  management: {
    password: defaults.password
  }
};

ewd.start(params);
