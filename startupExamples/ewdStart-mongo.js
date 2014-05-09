var ewd = require('ewdgateway2');
var params = {
 lite: true,
 poolSize: 2,
 httpPort: 8080,
 https: {
 enabled: false
 },
 database: {
 type: 'mongodb',
 nodePath: 'mongoGlobals',
 },
 modulePath: 'c:\\node\\node_modules',
 traceLevel: 3,
 webServerRootPath: 'www',
 logFile: 'ewdLog.txt', 
 management: {
 password: 'keepThisSecret!'
 }
};
ewd.start(params);