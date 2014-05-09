var ewd = require('ewdjs');

params = {
  cwd: '/opt/ewdlite/',
  httpPort: 8080,
  traceLevel: 3,
  database: {
    type: 'globals',
    path:"/opt/globalsdb/mgr"
  },
  management: {
    password: 'keepThisSecret!'
  },
  webSockets: {
    externalListenerPort: 10000
  },
};

ewd.start(params);
