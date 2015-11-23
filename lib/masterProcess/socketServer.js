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

23 November 2015

*/

var startSocketIo = function(webserver) {
    var log = {};
    if (ewd.silentStart) log = {log: false};
    ewd.io = require(ewd.webSockets.socketIoPath).listen(webserver, log);
    //ewd.io.set('log level', 0);
    if ((!ewd.silentStart)&&(ewd.traceLevel > 0)) ewd.io.set('log level', 1);

    ewd.io.sockets.on('connection', function(client){
      if (ewd.traceLevel >= 1) console.log("New websocket connected: " + client.id);
      if (ewd.socketClient[client.id]) {
        ewd.socketClient[client.id].connected = true;
        if (ewd.traceLevel >= 1) console.log("socketClient " + client.id + ": reconnected and re-registered");
      }
      else {
        if (ewd.traceLevel >= 2) console.log("WebSocket client is new");
        // see if this client was previously established by checking the back-end session
        // should ask browser for a token - ie to check if previously connected
        // if so, check that token and if still valid, set up new client mapping
        /*
        ewd.addToQueue({
          type: 'EWD.reconnect',
          'client.id': client.id
        });
        */
      }
      client.connected = true;
      client.json.send({type:'EWD.connected'});

      client.on('message', function(message){
        var messageObj;
        try {
          messageObj = JSON.parse(message);
        }
        catch(err) {
          // invalid JSON message - ignore
          return;
        }
        if (ewd.traceLevel >= 3) {
          if (messageObj.type === 'getMemory') {}
          else if (messageObj.type === 'getLogTail' || messageObj.type === 'keepAlive') {}
          else {
            console.log('WebSocket message received from browser: ' + JSON.stringify(messageObj));
          }
        }
        var type = messageObj.type;
        if (type === 'webSocketMessage') {
          if (ewd.traceLevel >= 2) console.log('*** Message received with type webSocketMessage, so ignored');
          return;
        }

        /*
        if (type === 'EWD.getPrivateFile') {
          ewd.addToQueue(messageObj);
          return;
        }
        */

        if (type !== 'EWD.register' && type !== 'EWD.reregister') {
          if (messageObj.token && ewd.socketClientByToken[messageObj.token]) {
            messageObj.messageType = type;
            type = 'webSocketMessage';
            messageObj.type = type;
          }
          else {
            if (ewd.traceLevel >= 2) console.log('Token missing or invalid on incoming message from browser, so ignored'); 
            client.json.send({
              type: 'error',
              messageType: type,
              error: 'Invalid or missing token'
            });
            client.disconnect();
            return;
          }
        }

        if (ewd.webSocketMessageHandlers[type]) {
          ewd.webSocketMessageHandlers[type](messageObj, client);
        }
        type = null;
        message = null;
        messageObj = null;
      });

      client.on('disconnect', function() {
        if (ewd.traceLevel >= 1) console.log("WebSocket disconnected: " + client.id);
        if (ewd.socketClient[client.id]) {
          ewd.socketClient[client.id].connected = false;
          ewd.socketClient[client.id].disconnectTime = new Date().getTime();
        }
      });

    });
};

module.exports = startSocketIo;
