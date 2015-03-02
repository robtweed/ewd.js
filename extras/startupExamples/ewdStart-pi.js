var ewd = require('ewdjs');

var params = {
      poolSize: 1,
      httpPort: 8080,
	  https: {
	    enabled: false,
      },
      traceLevel: 3,
      database: {
        nodePath:"noDB",
      },
      management: {
        password: 'keepThisSecret!'
     }
};

ewd.start(params);
