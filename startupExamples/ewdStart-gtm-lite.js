var ewd = require('ewdgateway2');

var params = {
      poolSize: 2,
      httpPort: 8080,
	  https: {
	    enabled: true,
	    keyPath: "ssl/ssl.key",
	    certificatePath: "ssl/ssl.crt",
      },
      database: {
        type: 'gtm',
        nodePath:"/home/vista/mumps",
      },
      lite: true,
      modulePath: '/home/vista/www/node/node_modules',
      traceLevel: 3,
      webServerRootPath: '/home/vista/www',
      logFile: 'ewdLog.txt',
      management: {
        password: 'keepThisSecret!'
     }
};

ewd.start(params);
