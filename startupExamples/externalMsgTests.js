var net = require('net');
var  injectMsg = function(recipients, params) {
  var client = net.createConnection({
      host: '127.0.0.1',
      port: 10000
    },
    function() {
      if (recipients === 'all') {
        var messageObj = {
          recipients: 'all',
          password: "keepThisSecret!",
          type: "externalMessageTest",
          message: params.message
        }
        var message = JSON.stringify(messageObj);
        client.write(message);
        client.destroy();
        return
      }
      if (recipients !== 'bySession') {
        var messageObj = {
          recipients: recipients,
          application: "ewdMonitor",
          password: "keepThisSecret!",
          type: "externalMessageTest",
          message: params.message
        }
        var message = JSON.stringify(messageObj);
        client.write(message);
        client.destroy();
      }
      else {
        var messageObj = {
          recipients: recipients,
          password: "keepThisSecret!",
          type: "externalMessageTest",
          session: params.session,
          message: params.message
        }
        var message = JSON.stringify(messageObj);
        client.write(message);
        client.destroy();
      }
    }
  );
};

var test1 = function() {
  injectMsg('bySession', {
    session: [
      {name: 'ewd_appName',value: 'ewdMonitor'}
    ],
    message: {
      a: 'bySession message where appName = ewdMonitor',
      b: 'hello'
    }
  });
};

var test2 = function() {
  injectMsg('all', {
    message: {
      a: 'to all users!',
      b: 'hello'
    }
  });
};

var test3 = function() {
  injectMsg('byApplication', {
    application: 'ewdMonitor',
    message: {
      a: 'byApplication = ewdMonitor',
      b: 'hello'
    }
  });
};

if (process.argv[2] === '1') test1();
if (process.argv[2] === '2') test2();
if (process.argv[2] === '3') test3();




