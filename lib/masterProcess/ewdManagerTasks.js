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

// Incoming HTTP requests for EWD Management functions

var path = require('path');

var mgrTask = {
    'EWD.mgr.about': function(dummy) {
      var json = {};
      json.overview = {
        name: ewd.name,
        nodeVersion: process.version,
        interface: ewd.interface,
        masterProcess: process.pid,
        childProcesses: ewd.getChildProcesses(),
        build: ewd.buildNo + " (" + ewd.buildDate + ")",
        started: ewd.started,
        uptime: ewd.elapsedTime(),
        interval: ewd.monitorInterval,
        traceLevel: ewd.traceLevel,
        logTo: ewd.logTo,
        logFile: ewd.logFile
      };
      json.startParams = {
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
        management: ewd.management,
        modulePath: ewd.modulePath,
        homePath: path.resolve('../'),
        debug: ewd.debug,
        webservice: ewd.webservice,
        ntp: ewd.ntp,
        globalMap: ewd.globalMap,
        routineMap: ewd.routineMap,
        GraphQL: ewd.GraphQL
      };
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

      json.mainProcess = {
        socketClient: scObj,
        socketClientByToken: ewd.socketClientByToken,
        process: procObj,
        requestsByProcess: ewd.requestsByProcess,
        queueByPid: ewd.queueByPid,
        poolSize: ewd.childProcess.poolSize,
      };
      return json;
    },

    'EWD.mgr.getChildProcesses': function() {
      var procObj = {};
      var proc;
      for (var pid in ewd.process) {
        proc = ewd.process[pid];
        procObj[pid] = {
          processNo: proc.processNo,
          isAvailable: proc.isAvailable,
          started: proc.started,
          debug: proc.debug
        };
      }
      procObj.queueLength = ewd.queue.length;
      return procObj;
    },

    'EWD.mgr.startChildProcess': function(params) {
      var debug = params.debug || false;
      var pid = ewd.startChildProcess(999, debug);
      ewd.childProcess.poolSize++;
      var messageObj = {};
      messageObj.pid = pid;
      if (debug) {
        messageObj.debug = ewd.process[pid].debug;
        messageObj.debug.web_port = ewd.debug.web_port;
      }
      messageObj.type = 'workerProcess';
      messageObj.action = 'add';
      // update child process table on all running copies of ewdMonitor
      var xclient;
      for (var clientId in ewd.socketClient) {
        xclient = ewd.socketClient[clientId];
        if (xclient.application && xclient.application === 'ewdMonitor') {
          xclient.json.send(messageObj);
        }
      }
      return {
        pid: pid
      };
    },

    'EWD.mgr.stopChildProcess': function(params) {
      var pid = params.pid;
      var returnValue;
      if (ewd.process[pid].isAvailable) {
        ewd.addToQueue({
          type: 'EWD.exit',
          pid: pid,
        });
        returnValue = {ok: pid + ' flagged to stop'};
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
        returnValue = {ok: pid + ' forced closed'};
      }
      var xclient;
      for (var clientId in ewd.socketClient) {
        xclient = ewd.socketClient[clientId];
        if (xclient && xclient.application && xclient.application === 'ewdMonitor') {
          if (xclient.json) {
            xclient.json.send({
              type: 'EWD.childProcessStopped',
              pid: pid
            });
          }
        }
      }
      return returnValue;
    },

    'EWD.mgr.setAvailability': function(params) {
      var available = params.available;
      var pid = params.pid;
      ewd.process[pid].isAvailable = available;
      var timeStamp = new Date().getTime();
      ewd.process[pid].time = timeStamp;
      ewd.sendToMonitor({
        type: 'pidUpdate',
        pid: pid,
        available: available
      });
      return {
        pid: pid,
        isAvailable: available,
        time: timeStamp
      };
    },

    'EWD.mgr.setParameters': function(params) {
      var ok = ewd.setParameters(params);
      return {ok: true};
    },

    'EWD.mgr.getChildProcessInfo': function(params) {
      return params;
    },

    'EWD.mgr.exit': function(params) {
      var response = {};
      for (var pid in ewd.process) {
        response[pid] = ewd.mgrTask['EWD.mgr.stopChildProcess']({pid: pid});
      }
      setTimeout(function() {
        if (ewd.childProcess.poolSize === 0) {
          try {
            ewd.webserver.close();
          }
          catch(err) {}
          if (ewd.statsEvent) clearTimeout(ewd.statsEvent);
          if (ewd.sessionGCEvent) clearTimeout(ewd.sessionGCEvent);
          console.log('EWD.js shutting down...');
          process.exit(1);
          // That's it - we're all shut down!
        }
      },4000);
      response.master = 'Shutting down master process';
      return response;
    }
};

module.exports = mgrTask;


