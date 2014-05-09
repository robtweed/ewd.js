var ewd = require('ewdgateway2');

var params = {
      poolSize: 2,
      httpPort: 8080,
      https: {
        enabled: true,
        keyPath: "c:\\node\\ssl\\ssl.key",
        certificatePath: "c:\\node\\ssl\\ssl.crt",
      },
      database: {
        type: 'globals',
        nodePath: "cache",
        path:"c:\\Globals\\mgr",
      },
      modulePath: 'c:\\node\\node_modules',
      traceLevel: 3,
      webServerRootPath: 'c:\\node\\www',
      logFile: 'c:\\node\\ewdLog.txt',
      management: {
        password: 'keepThisSecret!'
     }
};

ewd.start(params);

