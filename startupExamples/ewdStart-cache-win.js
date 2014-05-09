/*
Example EWD.js Startup file for use with Cache on Windows

Notes:

1) Change the database.path value as appropriate for your Cache installation.  Also change the
    password etc if required

2) IMPORTANT!: The cache.node interface module file MUST exist in the primary node_modules directory
of your EWD.js configuration

*/

var ewd = require('ewdjs');

var params = {
      //cwd: 'c:\ewdjs',
      poolSize: 2,
      httpPort: 8080,
	  traceLevel: 3,
      database: {
        type: 'cache',
        path:"c:\\InterSystems\\Cache\\Mgr",
        username: "_SYSTEM",
        password: "SYS",
        namespace: "USER"
      },
      management: {
        password: 'keepThisSecret!'
     }
};

ewd.start(params);
