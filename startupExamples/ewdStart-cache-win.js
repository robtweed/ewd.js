var ewd = require('ewdgateway2');

var params = {
      lite: true,
      poolSize: 2,
      httpPort: 8080,
	  https: {
	    enabled: false,
	    keyPath: "c:\\Program Files (x86)\\nodejs\\ssl\\ssl.key",
	    certificatePath: "c:\\Program Files (x86)\\nodejs\\ssl\\ssl.crt",
      },
      database: {
        type: 'cache',
        nodePath: "c:\\Program Files (x86)\\nodejs\\cache",
        path:"c:\\InterSystems\\Cache\\Mgr",
        username: "_SYSTEM",
        password: "SYS",
        namespace: "USER"
      },
      modulePath: '~\\nodejs\\node_modules',
      traceLevel: 3,
      webServerRootPath: 'c:\\Program Files (x86)\\nodejs\\www',
      management: {
        password: 'keepThisSecret!'
     }
};

ewd.start(params);
