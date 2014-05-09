/*
Example EWD.js Startup file for use with GT.M running on Linux

Notes:

1) The configuration/startup definition below assumes that EWD.js has been installed in 
   ~/ewdjs

2) IMPORTANT!: Nodem must have been installed using "npm install nodem" from within ~/ewdjs
   Remember to configure Nodem properly by moving files from its repository correctly

*/

var ewd = require('ewdjs');

var params = {
      httpPort: 8080,
      poolSize: 2,
      database: {
        type: 'gtm',
        nodePath:"nodem",
      },
      traceLevel: 3,
      management: {
        password: 'keepThisSecret!'
     }
};

ewd.start(params);
