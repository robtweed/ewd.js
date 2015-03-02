/*
Example EWD.js Startup file for use with GlobalsDB on Windows

Notes:

1) Change the database.path value as appropriate for your Cache installation.

2) IMPORTANT!: The cache.node interface module file MUST exist in the primary node_modules directory
of your EWD.js configuration

*/

var ewd = require('ewdjs');

var params = {
      poolSize: 2,
      httpPort: 8080,
      database: {
        type: 'globals',
        path:"c:\\Globals\\mgr",
      },
      traceLevel: 3,
      management: {
        password: 'keepThisSecret!'
     }
};

ewd.start(params);

