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

*/

var events = require('events');

var ewd = {
  version: function() {
    return 'EWD.js build ' + this.buildNo + ', ' + this.buildDate;
  },
  startTime: new Date().getTime(),
  started: new Date().toUTCString(),
  elapsedSec: function() {
    var now = new Date().getTime();
    return (now - this.startTime)/1000;
  },
  elapsedTime: function() {
    var sec = this.elapsedSec();
    var hrs = Math.floor(sec / 3600);
    sec %= 3600;
    var mins = Math.floor(sec / 60);
    if (mins < 10) mins = '0' + mins;
    sec = Math.floor(sec % 60);
    if (sec < 10) sec = '0' + sec;
    var days = Math.floor(hrs / 24);
    hrs %= 24;
    return days + ' days ' + hrs + ':' + mins + ':' + sec;
  },
  hSeconds: function() {
    // get current time in seconds, adjusted to Mumps $h time
    var date = new Date();
    var secs = Math.floor(date.getTime()/1000);
    var offset = date.getTimezoneOffset()*60;
    var hSecs = secs - offset + 4070908800;
    return hSecs;
  },

  isInteger: function(n) {
    n = parseInt(n);
    return +n === n && !(n % 1);
  },

  ewdMonitor: {},

  sendToMonitor: function(message) {
    // 
    var lastMsgSent = this.lastMsgSent || this.startTime;
    var now = new Date().getTime();
    if ((message.type === 'sessionDeleted' || message.type === 'newSession') && (now - lastMsgSent) < 1000) {
      // throttle these messages to no more than 1 per second
      // required for times when large numbers of REST-created sessions time out at the same time
      return;
    }
    else {
      var clientId;
      var client;
      for (clientId in this.ewdMonitor) {
        client = this.socketClient[clientId];
        if (client && client.connected && client.application === 'ewdMonitor' && client.json) {
          client.json.send(message);
        }
        else {
          delete this.ewdMonitor[clientId];
        }
      }
      this.lastMsgSent = now;
      client = null;
      clientId = null;
      message = null;
      now = null;
    }
  },

  shutdown: function() {
    //for (var i = 0; i < this.childProcess.poolSize; i++) {
    for (var pid in this.process) {
      this.addToQueue({
        type: 'EWD.exit',
        pid: pid
      });
    }
  },

  sessionClearDown: function() {
    // check for stuck processes and idle ones that can be shut down
    var proc;
    var dur;
    var ok;
    var newPid;
    var xclient;
    var clientId;
    console.log('*** checking child process pool at ' + new Date().toUTCString());
    var poolSize = this.childProcess.poolSize + 0;
    for (var pid in this.process) {
      proc = this.process[pid];
      dur = new Date().getTime() - proc.time;
      if (!proc.isAvailable) {
        console.log('pid: ' + pid + ' not available for ' + dur);
        if (dur > this.childProcess.unavailableLimit) {
          // locked for too long - close it down!
          if (poolSize < 2) {
            // start a new child process first!
            newPid = this.startChildProcess(99, false);
            this.childProcess.poolSize++;
            console.log('too few child processes - ' + newPid + ' started');
            poolSize++;
            for (clientId in this.socketClient) {
              xclient = this.socketClient[clientId];
              if (xclient.application && xclient.application === 'ewdMonitor') {
                xclient.json.send({
                  pid: newPid,
                  type: 'workerProcess',
                  action: 'add'
                });
              }
            }
          }
          ok = this.mgrTask['EWD.mgr.stopChildProcess']({pid: pid});
          poolSize--;
        }
      }
      else {
        console.log('pid: ' + pid + ' available for ' + dur);
        if (this.childProcess.auto && dur > this.childProcess.idleLimit) {
          // idle for too long - close it down unless minimum process pool reached already
          if (poolSize > 1) {
            ok = this.mgrTask['EWD.mgr.stopChildProcess']({pid: pid});
            poolSize--;
          }
        }
      }
    }
    var requestObj = {
      type: 'sessionGC'
    };
    this.addToQueue(requestObj);
    requestObj = null;
  },

  sessionGCEvent: false,  

  sessionGC: function() {
    // EWD Session cleardown / garbage collection
    this.sessionClearDown();
    this.sessionGCEvent = setTimeout(function() {
      ewd.sessionGC();
    }, this.sessionGCInterval);
  },

  showQ: function() {
    if (this.queue.length > 0) console.log('Queue length: ' + this.queue.length);
  },

  showQLoop: function() {
    // Show length of queue every second
    this.showQ();
    this.showQEvent = setTimeout(this.showQLoop, 1000);
  },

  memoryUsed: function() {
    var mem = process.memoryUsage();
    var message = {
      type: 'memory', 
      rss: (mem.rss /1024 /1024).toFixed(2), 
      heapTotal: (mem.heapTotal /1024 /1024).toFixed(2), 
      heapUsed: (mem.heapUsed /1024 /1024).toFixed(2), 
      interval: this.monitorInterval,
      uptime: this.elapsedTime(),
      maxQueueLength: this.maxQueueLength,
      queueLength: this.queue.length,
      childProcess: {}
    };
    for (var pid in this.process) {
      message.childProcess[pid] = {
        isAvailable: this.process[pid].isAvailable,
        noOfRequests: this.requestsByProcess[pid]
      };
      this.getChildProcessMemory(pid);
    }
    this.sendToMonitor(message);
    mem = null;
    return 'rss: ' + message.rss + 'Mb; heapTotal: ' + message.heapTotal + 'Mb; heapUsed: ' + message.heapUsed + 'Mb';
  },

  runningStats: false,
  statsEvent: false,

  getStats: function() {
    process.nextTick(function memory() {
      var  mem = ewd.memoryUsed();
      ewd.maxQueueLength = 0;
      ewd.statsEvent = setTimeout(ewd.getStats, ewd.monitorInterval);
      mem = null;
    });
  },

  getChildProcessMemory: function(pid) {
    if (pid && !this.process[pid]) return;
    var requestObj = {
      type: 'getMemory'
    };
    if (pid) {
      requestObj.pid = pid;
    }
    this.addToQueue(requestObj);
    requestObj = null;
  },

  process: {},
  requestsByProcess: {},

  setParameters: function(params) {
    var allowed = {
      traceLevel: '',
      childProcess: {
        auto: '',
        maximum: '',
        idleLimit: '',
        unavailableLimit: ''
      },
      webSockets: {
        externalListenerPort: '',
        maxDisconnectTime: ''
      },
      management: {
        password: ''
      },
      debug: {
        child_port: '',
        web_port: ''
      },
      webservice: {
        authenticate: ''
      }
    };
    var value;
    var name;
    for (var section in params) {
      if (allowed[section]) {
        if (typeof allowed[section] === 'object') {
          for (name in params[section]) {
            value = params[section][name];
            if (typeof allowed[section][name] !== 'undefined' && value !== '') {
              this[section][name] = value;
            }
          }
        }
      }
      else {
        value = params[section];
        if (value !== '') this[section] = value;
      }
    }
    return '';
  },

  startChildProcesses: function() {
    //console.log("startChildProcesses - poolSize = " + this.childProcess.poolSize);
    if (this.childProcess.poolSize > 1) {
      var pid;
      for (var i = 1; i < this.childProcess.poolSize; i++) {
        pid = this.startChildProcess(i, false);
        //console.log('startChildProcess ' + i + '; pid ' + pid);
      }
      pid = null;
      i = null;
    }
  },

  getChildProcesses: function() {
    var pid;
    var pids = [];
    for (pid in this.process) {
      pids.push({
        pid: pid, 
        available: this.process[pid].isAvailable, 
        noOfRequests: this.requestsByProcess[pid],
        debug: this.process[pid].debug      
      });
    }
    pid = null;
    return pids;
  },

  display404: function(response) {
    response.writeHead(404, {"Content-Type" : "text/plain" });  
    response.write("404 Not Found \n");  
    response.end();  
  }, 

  errorResponse: function(errorObj, response) {
    var header = {
      'Date': new Date().toUTCString(),
      'Content-Type': 'application/json'
    };
    response.writeHead(400, header); 
    response.write(JSON.stringify(errorObj));  
    response.end(); 
  },

  socketClient: {},
  socketClientByToken: {},

  clearDisconnectedSockets: function() {
    // clear out any socket client references that have been 
    // disconnected for more than maximum allowed time
    var ewdMonitorRunning = false;
    var client;
    var disconnectedTime;
    var now = new Date().getTime();
    var maxTime = this.webSockets.maxDisconnectTime;
    var token;
    for (var clientId in this.socketClient) {
      client = this.socketClient[clientId];
      if (!client.connected) {
        disconnectedTime = now - client.disconnectTime;
        if (disconnectedTime > maxTime) {
          if (this.traceLevel >= 2) console.log('cleared down socket client record for: ' + clientId);
          token = client.token;
          delete this.socketClient[clientId];
          if (token) delete this.socketClientByToken[token];
        }
      }
      else {
        if (client.application === 'ewdMonitor') {
          ewdMonitorRunning = true;
        }
      }
    }
    if (!ewdMonitorRunning && this.statsEvent) {
      //console.log('! shutting down logging');
      clearTimeout(this.statsEvent);
      this.statsEvent = false;
    }
    client = null;
    disconnectedTime = null;
  },

  queue: [],
  queueByPid: {},
  queueEvent: new events.EventEmitter(),
  totalRequests: 0,
  maxQueueLength: 0,

  addToQueue: function(requestObj) {
    if (requestObj.type !== 'webServiceRequest' && requestObj.type !== 'getMemory' && requestObj.type !== 'sessionGC' && !requestObj.ajax) {
      if (!requestObj.response) {
        if (requestObj.messageType && (requestObj.messageType === 'getMemory' || requestObj.messageType === 'getLogTail' || requestObj.messageType === 'keepAlive')) {}
        else if (this.traceLevel >= 3) console.log("addToQueue: " + JSON.stringify(requestObj, null, 2));
      }
    }
    // puts a request onto the queue and triggers the queue to be processed
    if (requestObj.pid && this.queueByPid[requestObj.pid]) {
      //console.log('request ' + requestObj.type + ' added to queue for pid ' + requestObj.pid);
      this.queueByPid[requestObj.pid].push(requestObj);
    }
    else {
      this.queue.push(requestObj);
    }
    this.totalRequests++;
    var qLength = this.queue.length;
    //if (this.traceLevel > 0) this.sendToMonitor({type: 'queueInfo', qLength: qLength});
    if (qLength > this.maxQueueLength) this.maxQueueLength = qLength;
    if (requestObj.type !== 'webServiceRequest' && requestObj.type !== 'getMemory' && requestObj.type !== 'sessionGC') {
      if (this.traceLevel >= 2) {
        if (requestObj.messageType && (requestObj.messageType === 'getMemory' || requestObj.messageType === 'getLogTail' || requestObj.messageType === 'keepAlive')) {}
        else {
          console.log('Request added to Queue: queue length = ' + qLength + '; requestNo = ' + this.totalRequests + '; after ' + this.elapsedTime());
        }
      }
    }
    // trigger the processing of the queue
    this.queueEvent.emit('processQueue');
    requestObj = null;
    qLength = null;
  },

  processQueue: function() {
    var queuedRequest;
    var pid;
      for (pid in ewd.queueByPid) {
        if (ewd.queueByPid[pid].length > 0) {
          if (ewd.queueByPid[pid][0].type === 'EWD.exit') ewd.process[pid].isAvailable = true; // force available
          if (ewd.process[pid].isAvailable) {
            queuedRequest = ewd.queueByPid[pid].shift();
            ewd.process[pid].isAvailable = false;
            if (queuedRequest.type !== 'getMemory') ewd.process[pid].time = new Date().getTime();
            /*
            ewd.sendToMonitor({
              type: 'pidUpdate', 
              pid: pid, 
              noOfRequests: ewd.requestsByProcess[pid], 
              available: ewd.process[pid].isAvailable,
              debug: ewd.process[pid].debug
           });
           */
           ewd.sendRequestToChildProcess(queuedRequest, pid);
          }
        }
      }

    pid = (ewd.queue.length !== 0);
    if (pid && ewd.traceLevel >= 3 && ewd.queue.length > 1) console.log("processing queue; length " + ewd.queue.length + "; after " + ewd.elapsedTime());
    while (pid) {
      pid = ewd.getChildProcess();
      if (pid) {
        queuedRequest = ewd.queue.shift();
        ewd.sendRequestToChildProcess(queuedRequest, pid);
      }
      if (ewd.queue.length === 0) {
        pid = false;
        //if (ewd.traceLevel >= 3) console.log("queue has been emptied");
      }
    }
    if (ewd.queue.length > 0) {
      if (ewd.traceLevel >= 2) console.log("queue processing aborted: no free child proceses available");
      if (ewd.childProcess.auto && ewd.queue[0] && ewd.queue[0].type !== 'getMemory') {
        if (ewd.childProcess.poolSize < ewd.childProcess.maximum) {
          // start new child process
          var newPid = ewd.startChildProcess(99, false);
          console.log(newPid + ' started to relieve queue pressure');
          ewd.childProcess.poolSize++;
          var xclient;
          for (var clientId in ewd.socketClient) {
            xclient = ewd.socketClient[clientId];
            if (xclient.application && xclient.application === 'ewdMonitor') {
              xclient.json.send({
                pid: newPid,
                type: 'workerProcess',
                action: 'add'
              });
            }
          }
        }
        else {
          // is everything locked up?
          var proc;
          var dur;
          var poolSize = ewd.childProcess.poolSize + 0;
          var trigger = false;
          var ok;
          for (var pid1 in ewd.process) {
            proc = ewd.process[pid1];
            dur = new Date().getTime() - proc.time;
            if (!proc.isAvailable && poolSize > 1 && dur > ewd.childProcess.unavailableLimit) {
              // get rid of stuck process
              ok = ewd.mgrTask['EWD.mgr.stopChildProcess']({pid: pid1});
              poolSize--;
              trigger = true;
            }
          }
          if (trigger) {
            setTimeout(function() {
              // try the queue again - it should now open new processes
              ewd.queueEvent.emit("processQueue");
            },2000);
          }
        }
      }
    }
    queuedRequest = null;
    pid = null;
  },

  sendRequestToChildProcess: function(queuedRequest, pid) {
    var type = queuedRequest.type;
    if (type === 'webServiceRequest' || queuedRequest.ajax) {
      this.process[pid].response = queuedRequest.response;
      delete queuedRequest.response;  // don't pass to child process but leave waiting on main process side
      if (queuedRequest.ajax) delete queuedRequest.ajax;
    }
    if (type === 'closeSession') {
      // make sure ewdMonitor-initiated session closure results in socket message to remove from display
      this.lastMsgSent = this.startTime;
    }
    if (type === 'externalMessage') {
      this.process[pid].externalMessage = {
        message: queuedRequest.message,
        type: queuedRequest.messageType
      };
      delete queuedRequest.message;  // don't pass to child process but leave waiting on main process side
      delete queuedRequest.messageType;  // don't pass to child process but leave waiting on main process side
    }
    //this.sendToMonitor({type: 'queueInfo', qLength: this.queue.length});
    //this.log("queuedRequest = " + JSON.stringify(queuedRequest), 3);
    if (queuedRequest.type !== 'getMemory' && queuedRequest.type !== 'sessionGC' && queuedRequest.messageType !== 'getLogTail' && queuedRequest.messageType !== 'getMemory' && queuedRequest.messageType !== 'keepAlive') {
      if (this.traceLevel >= 3) console.log("dispatching request to " + pid + " at " + this.elapsedTime()); // + ': ' + JSON.stringify(queuedRequest));
    }
    var childProcess = this.process[pid];
    childProcess.clientId = queuedRequest.clientId;
    childProcess.type = type;
    if (queuedRequest.frontEndService) {
      childProcess.frontEndService = queuedRequest.frontEndService;
      delete queuedRequest.frontEndService;
    }
    delete queuedRequest.clientId;
    if (queuedRequest.response) {
      this.process[pid].response = queuedRequest.response;
      delete queuedRequest.response;
    }
    try {
      //console.log('trying to send request to child process ' + pid + ': ' + JSON.stringify(queuedRequest));
      childProcess.send(queuedRequest);
    }
    catch(err) {
      //console.log('*** error caught - ' + err);
      //Child process has become unavailable for some reason
      // remove it from the pool and put queuedRequest back on the queue
      this.childProcess.poolSize--;
      delete this.process[pid];
      delete this.requestsByProcess[pid];
      delete this.queueByPid[pid];
      this.queue.push(queuedRequest);
      // start a new child process
      var newPid = this.startChildProcess(999, false);
      var xclient;
      for (var clientId in this.socketClient) {
        xclient = this.socketClient[clientId];
        if (xclient.application && xclient.application === 'ewdMonitor') {
          xclient.json.send({
            pid: newPid,
            type: 'workerProcess',
            action: 'add'
          });
        }
      }
      this.childProcess.poolSize++;
      return;
    }
    this.requestsByProcess[pid]++;
    /*
    this.sendToMonitor({
      type: 'pidUpdate', 
      pid: pid, 
      noOfRequests: this.requestsByProcess[pid], 
      available: this.process[pid].isAvailable,
      debug: this.process[pid].debug
    });
    */
    childProcess = null;
    type = null;
  },

  getChildProcess: function() {
    var pid;
    // try to find a free child process, otherwise return false
    for (pid in this.process) {
      if (this.process[pid].isAvailable) {
        this.process[pid].isAvailable = false;
        this.process[pid].time = new Date().getTime();
        /*
        this.sendToMonitor({
          type: 'pidUpdate', 
          pid: pid, 
          noOfRequests: this.requestsByProcess[pid], 
          available: this.process[pid].isAvailable,
          debug: this.process[pid].debug
        });
        */
        return pid;
      }
    }
    return false;
  }

};

module.exports = ewd;