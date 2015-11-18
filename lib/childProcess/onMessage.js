/*
 ----------------------------------------------------------------------------
 | ewdChildProcess: Child Worker Process for EWD.js                         |
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

  18 November 2015

*/


var onMessage = function(messageObj) {

  /*
  ewdChild.timing = {
    start: process.hrtime()
  };
  */
  //var diff = process.hrtime(startTime)

  if (messageObj.type !== 'getMemory' && messageObj.type !== 'sessionGC') {
    if (ewdChild.traceLevel >= 3) {
      if (messageObj.messageType === 'getMemory' || messageObj.messageType === 'getLogTail' || messageObj.messageType === 'keepAlive') {}
      else {
        console.log('child process ' + process.pid + ' received message:' + JSON.stringify(messageObj, null, 2));
      }
    }
  }
  var type = messageObj.type;
  if (!ewdChild.messageHandlers[type] && ewdChild.Custom && ewdChild.Custom.messageHandlers[type]) {
    ewdChild.messageHandlers[type] = ewdChild.Custom.messageHandlers[type];
  }
  if (ewdChild.messageHandlers[type]) {
    if (ewdChild.timing) ewdChild.timing.beforeMessageHandlers = EWD.getElapsedMs(ewdChild.timing);
    var response = ewdChild.messageHandlers[type](messageObj);
    if (ewdChild.timing) ewdChild.timing.afterMessageHandlers = EWD.getElapsedMs(ewdChild.timing);
    if (response) {
      //console.log('**** message: type=' + type + '; ' + util.inspect(response));
      //console.log('**** message handler func returned: ' + JSON.stringify(response));
      if (response.json) {
        if (response.json.exit || response.json.finished === false) {
          // Web Service handler is responsible for sending the response to the master process
          return;
        }
      }
      if (response.response) {
        if (response.response.exit || response.response.finished === false) {
          // WebSocket handler is responsible for sending the response to the master process
          return;
        }
      }
      if (ewdChild.Custom && ewdChild.Custom.messageHandlers[type] && response.finished === false) {
          // Custom HTTP handler is responsible for sending the response to the master process
          return;
      }

      if (!response.type) response.type = type;
      response.pid = process.pid;
      response.release = true;
      if (messageObj.messageType) response.messageType = messageObj.messageType;
      if (ewdChild.timing) ewdChild.timing.end = EWD.getElapsedMs(ewdChild.timing);
      if (ewdChild.timing) response.childTiming = ewdChild.timing;
      process.send(response);
      response = null;
    }
    else {
      process.send({
        pid: process.pid,
        type: type,
        release: true,
        empty: true
      });
    }
  }
  else {
    process.send({
      type: 'error',
      error: 'Message type (' + type + ') not recognised',
      pid: process.pid,
      release: true
    });
  }
  messageObj = null;
  type = null;

};

module.exports = onMessage;

