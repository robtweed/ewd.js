/*

 ----------------------------------------------------------------------------
 | ewd.js: EWD.js Framework                                                 |
 |                                                                          |
 | Copyright (c) 2013-15 M/Gateway Developments Ltd,                        |
 | Reigate, Surrey UK.                                                      |
 | All rights reserved.                                                     |
 |                                                                          |
 | http://www.mgateway.com                                                  |
 | Email: rtweed@mgateway.com                                               |
 |                                                                          |
 |                                                                          |
 | Licensed under the Apache License, Version 2.0 (the "License");          |
 | you may not use this file except in compliance with the License.         |
 | You may obtain a copy of the License at                                  |
 |                                                                          |
 |     http://www.apache.org/licenses/LICENSE-2.0                           |
 |                                                                          |
 | Unless required by applicable law or agreed to in writing, software      |
 | distributed under the License is distributed on an "AS IS" BASIS,        |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. |
 | See the License for the specific language governing permissions and      |
 |  limitations under the License.                                          |
 ----------------------------------------------------------------------------

10 November 2015

*/

var net = require('net');

var startExternalListener = function() {
    if (ewd.webSockets.externalListenerPort) {
      var tcpServer = net.createServer(function(client) {
        client.on("data", function (data) {
          if (ewd.traceLevel >= 3) console.log("Message received by external listener: " + data);
          try {
            var obj = JSON.parse(data);
            // process the object
            // but only if the password matches!
            if (obj.password === ewd.management.password) {
              if (obj.recipients) {
                if (obj.recipients !== 'byApplication') obj.application = '';
                if (obj.recipients === 'byApplication') {
                  ewd.childProcessMessageHandlers.sendMsgToAppUsers({
                    appName: obj.application,
                    content: {
                      type: obj.type,
                      message: obj.message
                    }
                  });
                  return;
                }
                if (obj.recipients === 'all') {
                  var client;
                  for (var clientId in ewd.socketClient) {
                    client = ewd.socketClient[clientId];
                    if (client && client.connected && client.json) {
                      client.json.send({
                        type: obj.type,
                        message: obj.message
                      });
                    }
                  }
                  clientId = null;
                  client = null;
                  return;
                }
                if (obj.recipients === 'bySession') {
                  var requestObj = {
                    type:'externalMessage',
                    messageType: obj.type,
                    recipients: 'bySession',
                    session: obj.session,
                    message: obj.message
                  };
                  ewd.addToQueue(requestObj);
                }
              }
            }
          }
          catch(err) {
            // just ignore it
          }
        });
      });
      tcpServer.on('error', function(e) {
        if (e.code === 'EADDRINUSE') {
            console.log("**** ERROR: Unable to open External Listener Port (" + ewd.webSockets.externalListenerPort + ": already in use)");
            console.log("Change the port in the EWD.js Startup file to one that is available");
            console.log("This is defined in params.webSockets.externalListenerPort");
            console.log('EWD.js shutting down...');
            ewd.shutdown();
        }
      });
      tcpServer.listen(ewd.webSockets.externalListenerPort);
    }
    else {
      if (ewd.traceLevel >= 3) console.log('External Listener Port Disabled');
    }
};

module.exports = startExternalListener;

