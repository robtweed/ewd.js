/*

 ----------------------------------------------------------------------------
 | ewd.js: EWD.js Framework                                                 |
 |                                                                          |
 | Copyright (c) 2013-16 M/Gateway Developments Ltd,                        |
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

22 January 2016

*/

var path = require('path');

var childProcessMessageHandlers = {
  
    // handlers for explictly-typed messages received from a child process

    firstChildInitialisationError: function(response) {
      console.log("Startup aborted");
      setTimeout(function() {
        console.log('EWD.js shutting down...');
        process.exit(1);
        // Shutdown!
      },1000);
    },

    'EWD.ping0': function(response) {
      var bm = ewd.benchmark;
      bm.count++;
      if (!bm.childProcess[response.pid]) {
        bm.childProcess[response.pid] = 1;
      }
      else {
        bm.childProcess[response.pid]++;
      }
      if (bm.count === bm.max) {
        var elap = (new Date().getTime() - bm.startTime) / 1000;
        var throughput = Math.floor(bm.max / elap);

        var clientId = ewd.process[response.pid].clientId;
        if (clientId) {
          var client = ewd.socketClient[clientId];
          if (client) {
            client.json.send({
              type:'EWD.benchmark', 
              no: bm.max,
              time: elap,
              messagesPerSec: throughput,
              childProcesses: bm.childProcess
            });
          }
        }
      }
    },

    'EWD.exit': function(response) {

      var noChildProcesses = function() {
        for (var name in ewd.process) {
          return false;
        }
        return true;
      };

      var pid = response.pid;
      ewd.sendToMonitor({type: 'workerProcess', action: 'remove', pid: pid});
      if (ewd.traceLevel >= 1) console.log('process ' + pid + " has been shut down");
      ewd.childProcess.poolSize--;
      delete ewd.process[pid];
      delete ewd.requestsByProcess[pid];
      delete ewd.queueByPid[pid];
      if (noChildProcesses()) {
        try {
          ewd.webserver.close();
        }
        catch(err) {}
        if (ewd.statsEvent) clearTimeout(ewd.statsEvent);
        if (ewd.sessionGCEvent) clearTimeout(ewd.sessionGCEvent);
        setTimeout(function() {
          console.log('EWD.js shutting down...');
          process.exit(1);
          // That's it - we're all shut down!
        },1000);
      }
    },

    'EWD.management': function(response) {
      // management messages are checked to ensure they have been sent by a logged in user of ewdMonitor
      // The response from the child process will indicate whether or not the message can be invoked
      //console.log('EWD.management response received from child process: ' + JSON.stringify(response.content));
      //console.log('Type: ' + response.messageType + '; error: ' + response.error);
      var clientId = ewd.process[response.pid].clientId;
      if (clientId) {
        var client = ewd.socketClient[clientId];
        if (client) {
          ewd.socketClientByToken[response.token] = client.id;
          ewd.socketClient[client.id].token = response.token;
          client.json.send({
            type: response.messageType,
            message: response.content
          });
        }
      }
    },

    firstChildInitialised: function(response) {
      console.log('First child process started.  Now starting the other processes....');
      ewd.interface = response.interface;
      ewd.startChildProcesses();
      console.log('Starting web server...');
      ewd.startWebServer();
    },

    childProcessStarted: function(response) {
      ewd.process[response.pid].started = true;
      var requestObj = {
        type:'initialise',
        params: {
          buildNo: ewd.buildNo,
          checkForUpdates: ewd.checkForUpdates,
          EWDCompatible: ewd.EWDCompatible,
          httpPort: ewd.httpPort,
          database: ewd.database,
          webSockets: ewd.webSockets,
          ewdGlobalsPath: ewd.ewdGlobalsPath,
          traceLevel: ewd.traceLevel,
          logTo: ewd.logTo,
          logFile: ewd.logFile,
          startTime: ewd.startTime,
          https: ewd.https,
          webServerRootPath: ewd.webServerRootPath,
          management: ewd.management,
          no: response.processNo,
          hNow: ewd.hSeconds(),
          modulePath: ewd.modulePath,
          homePath: path.resolve('../'),
          webservice: ewd.webservice,
          ntp: ewd.ntp,
          customModule: ewd.childProcess.customModule,
          globalMap: ewd.globalMap,
          routineMap: ewd.routineMap,
          GraphQL: ewd.GraphQL
 
        }			
      };
      if (ewd.customObj) requestObj.params.customObj = ewd.customObj;
      console.log("Sending initialise request to " + response.pid + ': ' + JSON.stringify(requestObj, null, 2));
      ewd.process[response.pid].send(requestObj);
    },

    'EWD.reregister': function(response) {
      if (!response.clientId) return;
      var clientId = response.clientId;
      var client = ewd.socketClient[clientId];
      if (!client) return;

      if (response.ok) {
        /*
           "QWl00lNJuWbZLEAQAAAB": {
             "connected": true,
             "application": "ewdMonitor",
             "token": "6d75e095-66d2-48c9-93ee-cbc17acccafe"
           }
       */
        var token = response.token;
        var socketClient = ewd.socketClient[clientId];
        socketClient.connected = true;
        socketClient.application = response.appName;
        socketClient.token = token;
        ewd.socketClientByToken[token] = clientId;
        client.json.send({
          type:'EWD.reregistered'
        }); 
      }
      else {
        if (ewd.traceLevel >= 2) console.log('Missing or invalid token, or session timed out, so re-registration not possible'); 
        client.json.send({
          type: 'error',
          messageType: 'EWD.reregister',
          error: 'Client cannot be re-registered'
        });
        client.disconnect();
        delete ewd.socketClient[clientId];
        return;
      }
    },

    'EWD.register': function(response) {
      var pid = response.pid;
      if (ewd.process[pid].response) {
        // original message came in via Ajax
        //ewd.socketClient[client.id].ajax = true;
        //console.log('socket client ' + client.id + ': ajax is true');
        var responseObj = {
          pid: pid,
          json: {
          type: 'EWD.registered',
          token: response.token,
          servicePath: ewd.servicePath,
            messageTransport: response.messageTransport
          }
        };
        ewd.childProcessMessageHandlers.webServiceRequest(responseObj);
        return;
      }

      var clientId = ewd.process[pid].clientId;
      if (clientId) {
        var client = ewd.socketClient[clientId];
        if (client) {
          ewd.socketClientByToken[response.token] = client.id;
          ewd.socketClient[client.id].token = response.token;

          client.json.send({
            type:'EWD.registered', 
            token: response.token,
            servicePath: ewd.servicePath,
            messageTransport: response.messageTransport
          });
          if (ewd.traceLevel >= 2) console.log("WebSocket client " + client.id + " registered with token " + response.token);
        }
      }
    },

    'EWD.reconnect': function(response) {
      if (response.reconnect) {
        //console.log('*** reconnect using token ' + response.token + ' ****');
      }
    },

    mgrMessage: function(response) {
      ewd.sendToMonitor(response.message);
    },

    sendMsgToAppUsers: function(response) {
      if (response.appName === 'ewdMonitor') {
        ewd.sendToMonitor(response.content);
      }
      else {
        var client;
        for (var clientId in ewd.socketClient) {
          if (ewd.socketClient[clientId].application === response.appName) {
            client = ewd.socketClient[clientId];
            if (client && client.connected && client.json) {
              client.json.send(response.content);
            }
          }
        }
        client = null;
        clientId = null;
      }
    },

    getMemory: function(response) {
      var message = {
        type: 'childProcessMemory', 
        results: response, 
        interval: ewd.monitorInterval
      };
      ewd.sendToMonitor(message);
      message = null;
      response = null;
    },

    error: function(response) {
      if (ewd.process[response.pid].response) {
        ewd.childProcessMessageHandlers.webServiceRequest(response);
        return;
      }
      if (ewd.traceLevel >= 1) console.log('** Error returned from Child Process ' + response.pid + ': ' + response.error);
      var clientId = ewd.process[response.pid].clientId;
      var client = ewd.socketClient[clientId];
      var message = {
        type: 'error',
        messageType: response.messageType,
        error: response.error
      };
      if (client && client.json) client.json.send(message);
      if (response.action === 'disconnect') {
        if (client) client.disconnect();
      }   
    },

    deleteSocketClient: function(response) {
      if (ewd.socketClientByToken[response.token]) {
        var clientId = ewd.socketClientByToken[response.token];
        var client = ewd.socketClient[clientId];
        if (client && !client.ajax) {
          client.json.send({
            type: 'EWD.session.deleted'
          });
        }
        delete ewd.socketClient[clientId];
        delete ewd.socketClientByToken[response.token];
        if (ewd.traceLevel >= 3) console.log('SocketClient record for ' + clientId + ' deleted');
        // stop logging stats if no instances of ewdMonitor running
        var ewdMonitorRunning = false;
        for (clientId in ewd.socketClient) {
          client = ewd.socketClient[clientId];
          if (client.application === 'ewdMonitor' && client.connected ) {
            ewdMonitorRunning = true;
            //console.log('deleteSocketClient: instance of ewdMonitor found');
          }
        }
        if (!ewdMonitorRunning && ewd.statsEvent) {
          //console.log('! 2 shutting down stats logging');
          clearTimeout(ewd.statsEvent);
          ewd.statsEvent = false;
        }
      }
    },

    'EWD.setParameter': function(response) {
      //console.log('Parameter set on Child Process ' + response.pid);
    },

    wsMessage: function(response) {
      //if (typeof response.content.type === 'ewd.releaseChildProcess') {
      if (response.content.type === 'ewd.releaseChildProcess') {
        response = null;
        return;
      }
      if (response.token) {
        if (ewd.socketClientByToken[response.token]) {
          var clientId = ewd.socketClientByToken[response.token];
          if (clientId) {
            var client = ewd.socketClient[clientId];
            if (client) {
              client.json.send(response.content);
              client = null;
            }
          }
          clientId = null;
        }
      }
      response = null;
    },

    webSocketMessage: function(response) {
      var pid = response.pid;
      if (ewd.process[pid].response) {
        // original message came in via Ajax
        response.json = {
          type: response.messageType,
          message: response.response
        };
        delete response.response;
        ewd.childProcessMessageHandlers.webServiceRequest(response);
        return;
      }
      var clientId = ewd.process[pid].clientId;
      var frontEndService = ewd.process[pid].frontEndService;
      var client = ewd.socketClient[clientId];
      if (client && response.messageType === 'EWD.getPrivateFile') {
        client.privateFilePath = response.path;
      }
      var message;
      var sendResponse = true;
      var type;
      if (response.messageType === 'EWD.ping1') {
        var bm = ewd.benchmark;
        bm.count++;
        if (!bm.childProcess[response.pid]) {
          bm.childProcess[response.pid] = 1;
        }
        else {
          bm.childProcess[response.pid]++;
        }
        if (bm.count === bm.max) {
          var elap = (new Date().getTime() - bm.startTime) / 1000;
          var throughput = Math.floor(bm.max / elap);
          client.json.send({
            type:'EWD.benchmark', 
            no: bm.max,
            time: elap,
            messagesPerSec: throughput,
            childProcesses: bm.childProcess,
            childTiming: response.childTiming 
          });
        }
        sendResponse = false;
      }
      else if (response.messageType.indexOf('EWD.form.') !== -1) {
        type = response.messageType;
        if (frontEndService) type = frontEndService + '-' + type;
        message = {
          type: type
        };
        if (response.response !== '') {
          message.ok = false;
          message.error = response.response;
        }
        else {
          message.ok = true;
        }
      }
      else {
        message = response;
        if (typeof message.response === 'string' && message.response === '') {
          sendResponse = false;
        }
        else {
          message.message = message.response;
          delete message.response;
          message.type = response.messageType;
          if (frontEndService) message.type = frontEndService + '-' + message.type;
          delete message.messageType;
          delete message.pid;
          delete message.release;
          delete message.processNo;
        }
      }
      if (sendResponse) {
        if (client && client.json) {
          client.json.send(message);
        }
        else {
          if (ewd.traceLevel >= 2) console.log('**** Error in webSocketMessage handler for child_process responses - client ' + clientId + ' unavailable');
        }
      }
      response = null;
      client = null;
      clientId = null;
      message = null;
    },

    webServiceRequest: function(responseObj) {
      var response = ewd.process[responseObj.pid].response;
      if (response) {
        if (responseObj.error) {
          ewd.errorResponse({error: responseObj.error}, response);
        }
        else if (responseObj.json && responseObj.json.error) {
          ewd.errorResponse({error: responseObj.json.error}, response);
        }
        else {
          var json;
          if (responseObj.mgr) {
            var params = responseObj.params;
            if (responseObj.mgr === 'EWD.mgr.exit') ewd.process[responseObj.pid].isAvailable = true; // unlock the child process used for authentication!
            json = ewd.mgrTask[responseObj.mgr](params);
          }
          else {
            json = responseObj.json;
          }

          var header = {};
          if (responseObj.json.headers) {
            // response came from returned object
            for (var headerName in responseObj.json.headers) {
              header[headerName] = responseObj.json.headers[headerName];
            }
            delete responseObj.json.headers;
          }
          else if (responseObj.headers && responseObj.headers !== '') {
            // response came from EWD.sendWebServiceResponse()
            header = responseObj.headers;
          }
          header.Date = new Date().toUTCString();
          header['Content-Type'] = responseObj.contentType || 'application/json';

          response.writeHead(200, header);
          response.write(JSON.stringify(json));
          response.end();
          header = null;
        }
        if (typeof ewd.process !== 'undefined' && ewd.process[responseObj.pid]) delete ewd.process[responseObj.pid].response;
        response = null;
      }
      responseObj = null;
    },

    externalMessage: function(responseObj) {
      var type = ewd.process[responseObj.pid].externalMessage.type;
      var message = ewd.process[responseObj.pid].externalMessage.message;
      delete ewd.process[responseObj.pid].externalMessage;
      var client;
      var clientId;
      for (var i = 0; i < responseObj.tokens.length; i++) {
        clientId = ewd.socketClientByToken[responseObj.tokens[i]];
        if (clientId) {
          client = ewd.socketClient[clientId];
            if (client) {
            client.json.send({
              type: type, 
              message: message
            });
          }
        }
      }
      responseObj = null;
      type = null;
      message = null;
      client = null;
      i = null;
    }
    
};

module.exports = childProcessMessageHandlers;
