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

24 November 2015

*/

// Handles incoming WebSocket requests from browsers for system functions

var fs = require('graceful-fs');
var path = require('path');

var systemMessageHandlers = {

    'EWD.benchmark': function(messageObj, client) {
      if (messageObj.noOfMessages && messageObj.noOfMessages > 0) {
        var type = ('EWD.ping' + messageObj.ping) || 'EWD.ping0';
        var messageType = type;
        if (type === 'EWD.ping1') type = 'webSocketMessage';
        var noOfMessages = parseInt(messageObj.noOfMessages) || 100;
        ewd.benchmark = {
          max: noOfMessages,
          startTime: new Date().getTime(),
          count: 0,
          childProcess: {}
        };  
        // ping0 = round trip without use of Mumps
        // ping1 = round trip hitting a Mumps global
        for (var i = 0; i < messageObj.noOfMessages; i++) {
          ewd.addToQueue({
            type: type,
            no: i,
            clientId: client.id,
            token: messageObj.token,
            messageType: messageType
          });
        }
      }
    },

    'EWD.exit': function(messageObj, client) {
      if (messageObj.password !== ewd.management.password) {
        client.json.send({
          type: 'EWD.exit',
          error: 'Incorrect EWD.js Management password'
        });
        return;
      }
      else {
        /*
        client.json.send({
          type: 'EWD.exit',
          ok: true
        });
        */
        ewd.sendToMonitor({
          type: 'EWD.exit',
          ok: true
        });
      }
      messageObj.type = 'EWD.exit';
      delete messageObj.messageType;
      //for (var i = 0; i < ewd.childProcess.poolSize; i++) {
      for (var pid in ewd.process) {
        messageObj.pid = pid;
        ewd.addToQueue(messageObj);
      }
    },

    'EWD.startMonitor': function(messageObj, client) {
      if (!ewd.statsEvent) {
        ewd.statsEvent = setTimeout(ewd.getStats, ewd.monitorInterval);
      }
      client.json.send({
        type:'processInfo', 
        data: {
          name: ewd.name,
          nodeVersion: process.version,
          masterProcess: process.pid,
          childProcesses: ewd.getChildProcesses(),
          build: ewd.buildNo + " (" + ewd.buildDate + ")",
          started: ewd.started,
          uptime: ewd.elapsedTime(),
          interval: ewd.monitorInterval,
          traceLevel: ewd.traceLevel,
          logTo: ewd.logTo,
          logFile: ewd.logFile,
          queueLength: ewd.queue.length,
          maxQueueLength: ewd.maxQueueLength,
          sessionGlobal: ewd.globalMap.session
        }
      });
    },

    'EWD.getFragment': function(messageObj, client) {
      var application = client.application;
      if (!application) return;
      var fragPath = ewd.webServerRootPath + '/ewd/' + application + '/' + messageObj.params.file;
      if (messageObj.params.isServiceFragment) {
        fragPath = ewd.webServerRootPath + '/services/' + messageObj.params.file;
      }

      fs.exists(fragPath, function(exists) { 
        if (exists) {
          fs.readFile(fragPath, 'utf8', function(err, data) {
            if (!err) {
              client.json.send({
                type: messageObj.messageType,
                message: {
                  content: data,
                  targetId: messageObj.params.targetId,
                  file: messageObj.params.file,
                  extra: messageObj.params.extra
                }
              });
            }
          });
        }
        else { // SJT inform of failure to load 
          var message = {
            error: true,
            file: messageObj.params.file
          };
          if (messageObj.params.isServiceFragment) {
            message.isServiceFragment = true;
          }
          client.json.send({
            type: messageObj.messageType,
            message: message
          });
        }
      });
    },

    'EWD.getSystemName': function(messageObj, client) {
      client.json.send({
        type: messageObj.messageType,
        message: {
          name: ewd.name
        }
      });
    },

    'EWD.setSystemName': function(messageObj, client) {

      function sendError(message) {
        client.json.send({
          type: messageObj.messageType,
          error: message
        });
      }

      var name = messageObj.params.name;
      if (!name || name === '') return sendError('Missing or invalid Name');
      ewd.name = name;
      client.json.send({
        type: messageObj.messageType,
        ok: true
      });
    },

    'EWD.getChildProcessSettings': function(messageObj, client) {
      client.json.send({
        type: messageObj.messageType,
        message: ewd.childProcess
      });
    },

    'EWD.setChildProcessSettings': function(messageObj, client) {

      function sendError(message) {
        client.json.send({
          type: messageObj.messageType,
          error: message
        });
      }
       
      var params = messageObj.params;
      console.log('setChildProcessSettings: ' + JSON.stringify(params));
      if (params.auto === '1') params.auto = true;
      if (params.auto === '0') params.auto = false;
      if (params.auto !== true && params.auto !== false) return sendError('Invalid auto value');
      if (!params.maximum || params.maximum === '' || !ewd.isInteger(params.maximum)) return sendError('Missing or invalid maximum');
      if  (params.maximum < 1) return sendError('Maximum value must be 1 or greater');
      if (!params.idleLimit || params.idleLimit === '' || !ewd.isInteger(params.idleLimit)) return sendError('Missing or invalid Idle Limit');
      if  (params.idleLimit < 30000) return sendError('Idle Limit value must be 30 seconds or greater');
      if (!params.unavailableLimit || params.unavailableLimit === '' || !ewd.isInteger(params.unavailableLimit)) return sendError('Missing or invalid Unavailable Limit');
      if  (params.unavailableLimit < 30000) return sendError('Unavailable Limit value must be 30 seconds or greater');
      ewd.setParameters({
        childProcess: params
      });
      client.json.send({
        type: messageObj.messageType,
        ok: true
      });
    },

    'EWD.getWebSocketSettings': function(messageObj, client) {
      client.json.send({
        type: messageObj.messageType,
        message: ewd.webSockets
      });
    },

    'EWD.getWSAuthStatus': function(messageObj, client) {
      client.json.send({
        type: messageObj.messageType,
        message: ewd.webservice.authenticate
      });
    },

    'EWD.setWSAuthStatus': function(messageObj, client) {
      ewd.webservice.authenticate = (messageObj.params.status === '1');
      client.json.send({
        type: messageObj.messageType,
        ok: ewd.webservice.authenticate
      });
    },

    'EWD.getHTTPAccess': function(messageObj, client) {
      client.json.send({
        type: messageObj.messageType,
        message: ewd.management.httpAccess.enabled
      });
    },

    'EWD.setHTTPAccess': function(messageObj, client) {
      ewd.management.httpAccess.enabled = (messageObj.params.status === '1');
      client.json.send({
        type: messageObj.messageType,
        ok: ewd.management.httpAccess.enabled
      });
    },

    'EWD.setWebSocketSettings': function(messageObj, client) {

      function sendError(message) {
        client.json.send({
          type: messageObj.messageType,
          error: message
        });
      }

      var params = messageObj.params;
      if (!params.maxDisconnectTime || params.maxDisconnectTime === '' || !ewd.isInteger(params.maxDisconnectTime)) return sendError('Missing or invalid Maximum Disconnect Time');
      if (params.maxDisconnectTime < 600000) return sendError('Maximum Disconnect Time value must be 600 seconds or greater');
      ewd.setParameters({
        webSockets: params
      });
      client.json.send({
        type: messageObj.messageType,
        ok: true
      });
    },

    'EWD.setExternalPortSettings': function(messageObj, client) {

      function sendError(message) {
        client.json.send({
          type: messageObj.messageType,
          error: message
        });
      }

      var params = messageObj.params;
      if (params.externalListenerPort !== false) {
        if (!params.externalListenerPort || params.externalListenerPort === '' || !ewd.isInteger(params.externalListenerPort)) return sendError('Missing or invalid Port Numner');
        params.externalListenerPort = parseInt(params.externalListenerPort);
        if (params.externalListenerPort < 1 || params.externalListenerPort > 65535 ) return sendError('Invalid Port Number');
      }
      ewd.setParameters({
        webSockets: params
      });
      client.json.send({
        type: messageObj.messageType,
        ok: true
      });
    },

    'EWD.workerProcess': function(messageObj, client) {
      if (messageObj.action === 'add') {
        var pid = ewd.startChildProcess(999, messageObj.debug);
        ewd.childProcess.poolSize++;
        messageObj.pid = pid;
        if (messageObj.debug) {
          messageObj.debug = ewd.process[pid].debug;
          messageObj.debug.web_port = ewd.debug.web_port;
        }
        messageObj.type = 'workerProcess';
        //client.json.send(messageObj);
        // update child process table on all running copies of ewdMonitor
        var xclient;
        for (var clientId in ewd.socketClient) {
          xclient = ewd.socketClient[clientId];
          if (xclient.application && xclient.application === 'ewdMonitor') {
            xclient.json.send(messageObj);
          }
        }
      }
    },
    stopChildProcess: function(messageObj, client) {
      if (ewd.childProcess.poolSize > 1) {
        var pid = messageObj.pid;
        if (pid && ewd.process[pid]) {
          if (ewd.process[pid].isAvailable) {
            ewd.addToQueue({
              type: 'EWD.exit',
              pid: pid,
            });
          }
          else {
            // process is stuck, so force it down and release its resources
            ewd.process[pid].kill();
            delete ewd.process[pid];
            delete ewd.requestsByProcess[pid];
            delete ewd.queueByPid[pid];
            ewd.childProcess.poolSize--;
            ewd.sendToMonitor({type: 'workerProcess', action: 'remove', pid: pid});
            if (ewd.traceLevel >= 1) console.log('process ' + pid + " was forced to shut down");
          }
          var xclient;
          for (var clientId in ewd.socketClient) {
            xclient = ewd.socketClient[clientId];
            if (xclient.application && xclient.application === 'ewdMonitor') {
              xclient.json.send({
                type: 'EWD.childProcessStopped',
                pid: pid
              });
            }
          }
        }
      }
    },

    'EWD.toggleAvailability': function(messageObj, client) {
      var pid = messageObj.pid;
      if (pid && pid !== '' && ewd.process[pid]) {
        ewd.process[pid].isAvailable = !ewd.process[pid].isAvailable;
        client.json.send({
          type: 'pidUpdate',
          pid: pid,
          available: ewd.process[pid].isAvailable
        });
      }
    },

    'EWD.setParameters': function(messageObj, client) {
      var ok = ewd.setParameters(messageObj.params);
    },

    'EWD.setParameter': function(messageObj, client) {
      if (messageObj.name === 'monitorLevel') {
        ewd.traceLevel = messageObj.value;
        ewd.io.set('log level', 0);
        if ((!ewd.silentStart)&&(messageObj.value > 0)) ewd.io.set('log level', 1);
      }
      if (messageObj.name === 'logTo') {
        ewd.logTo = messageObj.value;
        if (messageObj.value === 'file') console.log('ewd.js: Starting Log to File at ' + new Date().toUTCString());
      }
      if (messageObj.name === 'clearLogFile') {
        console.log('ewd.js: Starting Log to File at ' + new Date().toUTCString());
      }
      if (messageObj.name === 'changeLogFile') {
        ewd.logFile = messageObj.value;
        console.log('ewd.js: Starting Log to File at ' + new Date().toUTCString());
      }
      // update parameter in all child processes
      messageObj.type = 'EWD.setParameter';
      for (var pid in ewd.process) {
        messageObj.pid = pid;
        ewd.addToQueue(messageObj);
      }
    },

    'EWD.inspect': function(messageObj, client) {
      var scObj = {};
      var sc;
      for (var clientId in ewd.socketClient) {
        sc = ewd.socketClient[clientId];
        scObj[clientId] = {
          connected: sc.connected,
          application: sc.application || '',
          token: sc.token || '',
          disconnectedTime: sc.disconnectTime
        };
        if (sc.privateFilePath) scObj[clientId].privateFilePath = sc.privateFilePath;
      }
      var proc;
      var procObj = {};
      for (var pid in ewd.process) {
        proc = ewd.process[pid];
        procObj[pid] = {
          processNo: proc.processNo,
          isAvailable: proc.isAvailable,
          started: proc.started,
          debug: proc.debug
        };
      }
      var msgObj = {
        type: 'EWD.inspect',
        socketClient: scObj,
        socketClientByToken: ewd.socketClientByToken,
        process: procObj,
        requestsByProcess: ewd.requestsByProcess,
        queueByPid: ewd.queueByPid,
        poolSize: ewd.childProcess.poolSize,
        startParams: {
          childProcess: ewd.childProcess,
          httpPort: ewd.httpPort,
          database: ewd.database,
          webSockets: ewd.webSockets,
          ewdGlobalsPath: ewd.ewdGlobalsPath,
          traceLevel: ewd.traceLevel,
          EWDCompatible: ewd.EWDCompatible,
          logTo: ewd.logTo,
          logFile: ewd.logFile,
          startTime: ewd.startTime,
          https: ewd.https,
          webServerRootPath: ewd.webServerRootPath,
          privateFilePath: ewd.privateFilePath,
          management: {
            httpAccess: ewd.management.httpAccess
          },
          modulePath: ewd.modulePath,
          homePath: path.resolve('../'),
          debug: ewd.debug,
          webservice: ewd.webservice,
          ntp: ewd.ntp,
          globalMap: ewd.globalMap,
          routineMap: ewd.routineMap,
          GraphQL: ewd.GraphQL
        }
      };
      client.json.send(msgObj);
    },

    'EWD.resetPassword': function(messageObj, client) {
      var oldPassword = messageObj.currentPassword;
      if (oldPassword !== ewd.management.password) {
        client.json.send({
          type: 'EWD.resetPassword',
          error: 'You did not specify the current management password correctly'
        });
        return;
      }
      var newPassword = messageObj.newPassword;
      if (newPassword === '') {
        client.json.send({
          type: 'EWD.resetPassword',
          error: 'You did not enter a new password'
        });
        return;
      }
      ewd.management.password = newPassword;
      /*
      ewd.addToQueue({
        type: 'EWD.resetPassword',
        password: messageObj.newPassword
      });
      */
      client.json.send({
        type: 'EWD.resetPassword',
        error: false
      });
    },

    'EWD.getDebugPorts': function(messageObj, client) {
      var debug = ewd.debug;
      client.json.send({
        type: 'EWD.getDebugPorts',
        child_port: debug.child_port || '',
        web_port: debug.web_port || '',
      });
    },

    'EWD.changeDebugPorts': function(messageObj, client) {
      function isInteger(n) {
        n = parseInt(n);
        return +n === n && !(n % 1);
      }

      var debug = ewd.debug;
      var childPort = messageObj.child_port;
      var webPort = messageObj.web_port;
      var ok = true;
      if (childPort === '') ok = false;
      if (!isInteger(childPort)) ok = false;
      if (webPort === '') ok = false;
      if (!isInteger(webPort)) ok = false;
      if (ok) {
        debug.child_port = childPort;
        debug.web_port = webPort;
      }
      client.json.send({
        type: 'EWD.changeDebugPorts',
        ok: ok
      });
    },

    'EWD.logout': function(messageObj, client) {
      ewd.addToQueue({
        type: 'EWD.deleteSessionByToken',
        token: messageObj.token
      });
      client.disconnect();
    }
};

module.exports = systemMessageHandlers;

