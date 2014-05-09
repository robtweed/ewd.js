var ewdrest = require('ewdrest');
var fs = require('fs');

var EWD = {
  restPort: 8000,
  restServer: {
    key: fs.readFileSync("/home/ubuntu/ssl/ssl.key"),
    certificate: fs.readFileSync("/home/ubuntu/ssl/ssl.crt"),
  },
  service: {
    vista: {
      module: 'VistARestServer',
      service: 'parse',
      contentType: 'application/json'
    }
  },
  server: {
    ec2: {
      host: 'localhost',
      port: 8080,
      ssl: true,
      secretKey: '$keepSecret!',
      accessId: 'VistAClient'
    }
  }
};

ewdrest.start(EWD);
