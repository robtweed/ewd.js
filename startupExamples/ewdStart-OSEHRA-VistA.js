var ewd = require('ewdgateway2');
var params = {
      poolSize: 2,
      httpPort: 8080,
       https: {
         enabled: true,
         keyPath: "/home/ubuntu/ssl/ssl.key",
         certificatePath: "/home/ubuntu/ssl/ssl.crt",
      },
      database: {
        type: 'gtm',
        nodePath: "/home/ubuntu/mumps"
      },
      lite: true,
      modulePath: '/home/ubuntu/node/node_modules',
      traceLevel: 3,
      webServerRootPath: '/home/ubuntu/www',
      logFile: 'ewdLog.txt',
      management: {
        password: 'keepThisSecret!'
     }
};
ewd.start(params); 