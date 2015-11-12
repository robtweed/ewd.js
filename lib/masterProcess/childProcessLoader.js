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

var cp = require('child_process');

var startChildProcess = function(processNo, debug) {
    if (debug) {
      ewd.debug.child_port++;
      process.execArgv.push('--debug=' + ewd.debug.child_port);
    }
    var childProcess = cp.fork(ewd.childProcess.path, [], {env: process.env});
    var pid = childProcess.pid;
    ewd.process[pid] = childProcess;
    var thisProcess = ewd.process[pid];
    thisProcess.isAvailable = false;
    thisProcess.time = new Date().getTime();
    thisProcess.started = false;
    ewd.requestsByProcess[pid] = 0;
    thisProcess.processNo = processNo;
    if (debug) {
      thisProcess.debug = {
        enabled: true,
        port: ewd.debug.child_port,
        web_port: ewd.debug.web_port
      };
    }
    else {
      thisProcess.debug = {enabled: false};
    }
    ewd.queueByPid[pid] = [];
    thisProcess.on('message', function(response) {
      response.processNo = processNo;
      var release = response.release;
      var pid = response.pid;
      if (ewd.process[pid]) {
        var proc = ewd.process[pid];
        if (response.type !== 'getMemory' && response.type !== 'sessionGC' && response.type !== 'log') {
          if (ewd.traceLevel >= 3) {
            if (response.content && response.content.type === 'getMemory') {}
            else if (response.content && response.content.type === 'getLogTail') {}
            else if (response.messageType && (response.messageType === 'keepAlive' || response.messageType === 'getMemory' || response.messageType === 'getLogTail')) {}
            else {
              console.log("child process returned response " + JSON.stringify(response));
            }
          }
        }
        if (ewd.childProcessMessageHandlers[response.type]) {
          ewd.childProcessMessageHandlers[response.type](response);
        }
        else {
          if (!response.empty && ewd.traceLevel >= 3) console.log('No handler available for child process message type (' + response.type + ')');
        }
        // release the child process back to the available pool
        //console.log('** response.type: ' + response.type);
        //console.log('** ewd.process for pid ' + pid + ': ' + ewd.process[pid].type);
        if (response.type !== 'EWD.exit' && release) {
          if (ewd.traceLevel >= 3 && response.type !== 'getMemory' && response.type !== 'sessionGC' && response.type !== 'keepAlive') {
            if (response.messageType !== 'getLogTail') {
              console.log('process ' + pid + ' returned to available pool; type=' + response.type);
            }
          }
          delete proc.response;
          delete proc.type;
          delete proc.frontEndService;
          proc.isAvailable = true;
          if (response.type !== 'getMemory') proc.time = new Date().getTime();
          ewd.queueEvent.emit("processQueue");
        }
      }
      response = null;
      pid = null;
      release = null;
    });

    return pid;
};

module.exports = startChildProcess;
