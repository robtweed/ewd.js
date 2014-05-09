/*
Example EWD.js Startup file for use with GlobalsDB

Notes:

1) Change the database.path value as appropriate for your GlobalsDB installation

2) IMPORTANT!: The cache.node interface module file MUST exist in the primary node_modules directory
of your EWD.js configuration. 

3) Comment out the cwd parameter if you want to use this startup file from the command line

4) You may need to invoke this startup file as sudo if you have used Mike Clayton's Ubuntu installer for EWD.js

*/

var ewd = require('ewdjs');

params = {
  cwd: '/opt/ewdlite/',
  httpPort: 8080,
  traceLevel: 3,
  database: {
    type: 'globals',
    path:"/opt/globalsdb/mgr"
  },
  management: {
    password: 'keepThisSecret!'
  },
  webSockets: {
    externalListenerPort: 10000
  },
};

ewd.start(params);
