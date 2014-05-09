var ewd = require('ewdgateway2');

var params = {
      poolSize: 1,
      httpPort: 8080,
	  https: {
	    enabled: true,
	    keyPath: "/home/pi/ssl/ssl.key",
	    certificatePath: "/home/pi/ssl/ssl.crt",
      },
      database: {
        type: 'mongodb'
      },
      lite: true,
      modulePath: '/home/pi/node/node_modules',
      traceLevel: 3,
      webServerRootPath: '/home/pi/www',
      logFile: 'ewdLog.txt',
      management: {
        password: 'keepThisSecret!'
     }
};

ewd.start(params);
