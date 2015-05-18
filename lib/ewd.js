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

var cp = require('child_process');
var fs = require('graceful-fs');
var url = require('fast-url-parser');
var queryString = require('querystring');
var path = require('path');
var events = require('events');
var net = require('net');
var util = require('util');
var mime = require('mime');
var constants = require('constants');


var ewd = {
  buildNo: 100,
  buildDate: '15 May 2015',
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

  defaults: function(params) {
    var cwd = params.cwd || process.cwd();
    if (cwd.slice(-1) === '/') cwd = cwd.slice(0,-1);
    var defaults = {
      childProcess: {
        poolSize: 2,
        path: __dirname + '/ewdChildProcess.js',
        auto: true,
        maximum: 4,
        idleLimit: 1800000, // half an hour
        unavailableLimit: 600000, // 10 minutes
        customModule: false
      },
      os: 'linux',
      name: 'EWD.js Server',
      database: {
        type: 'gtm',
      },
      debug: {
        enabled: false,
        child_port: 5859,
        web_port: 8081
      },
      ewdPath: '/ewd/',
      //ewdGlobalsPath: './ewdGlobals',
      ewdGlobalsPath: 'globalsjs',
      httpPort: 8080,
      https: {
        enabled: false,
        keyPath: cwd + '/ssl/ssl.key',
        certificatePath: cwd + '/ssl/ssl.crt',
      },
      webSockets: {
        path: '/ewdWebSocket/',
        socketIoPath: 'socket.io',
        externalListenerPort: 10000,
        maxDisconnectTime: 3600000
      },
      logFile: '/var/log/ewdjs.log',
      logTo: 'console',
      logHTTP: false,
      modulePath: cwd + '/node_modules',
      servicePath: '/services',
      monitorInterval: 30000,
      sessionGCInterval: 300000,
      silentStart: false,
      traceLevel: 1,
      webServerRootPath: cwd + '/www',
      privateFilePath: '/privateFiles',
      webservice: {
        json: {
          path: '/json'
        },
        authenticate: true
      },
      management: {
        httpAccess: {
          path: '/ewdjsMgr',
          enabled: true
        },
        password: 'makeSureYouChangeThis!'
      },
      ajax: {
        path: '/ajax'
      },
      webRTC: {
        enabled: false,
        resources: {
          screen: false,
          video: true,
          audio: false
        }
      },
      ntp: {
        host: 'pool.ntp.org',
        port: 123
      }
    };

    if (params) {
      if (!params.childProcess) params.childProcess = {};
      if (params.database) {
        if (typeof params.database.type !== 'undefined') defaults.database.type = params.database.type;
        if (params.database.type === 'noDB' || params.database.nodePath === 'noDB') {
          params.database.type = 'gtm';
          params.database.nodePath = 'noDB';
          params.childProcess.poolSize = 1;
          params.childProcess.maximum = 1;
          params.childProcess.auto = false;
        }
      }
      if (typeof params.os !== 'undefined') defaults.os = params.os;
    }
    if (defaults.database.type === 'cache' || defaults.database.type === 'globals') {
      defaults.database = {
        type: 'cache',
        nodePath: 'cache',
        username: '_SYSTEM',
        password: 'SYS',
        namespace: 'USER',
        charset: 'UTF-8',
        lock: 0
      };
      if (defaults.os === 'windows') {
        defaults.database.path = 'c:\\InterSystems\\Cache\\Mgr';
      }
      else {
        defaults.database.path = '/opt/cache/mgr';
      }
    }
    if (defaults.database.type === 'gtm') {
      defaults.database = {
        type: 'gtm',
        nodePath: 'nodem',
      };
    }
    if (defaults.database.type === 'mongodb') {
      defaults.database = {
        type: 'mongodb',
        nodePath: 'mongo',
        address: 'localhost',
        port: 27017
      };
    }
    //if (defaults.poolSize && !defaults.childProcess.poolSize) defaults.childProcess.poolSize = defaults.poolSize;
    if (params) {
      if (params.poolSize && params.childProcess && !params.childProcess.poolSize) params.childProcess.poolSize = params.poolSize;
      if (params.childProcess.poolSize) {
        if (!params.childProcess.maximum && params.childProcess.poolSize > defaults.childProcess.maximum) {
          params.childProcess.maximum = params.childProcess.poolSize;
        }
      }
    }
    this.setDefaults(defaults, params);
    if (ewd.debug.enabled) {
      ewd.childProcess.poolSize = 1;
      ewd.childProcess.maximum = 1;
      ewd.childProcess.auto = false;
    } 
  },
  setDefaults: function(defaults, params) {
    var name;
    //var value;
    var subDefaults = {
      childProcess: '',
      database: '',
      https: '',
      webSockets: '',
      management: '',
      webRTC: '',
      webservice: '',
      ntp: '',
      debug: '',
      ajax: ''
    };
    for (name in defaults) {
      if (typeof subDefaults[name] !== 'undefined') {
        this.setPropertyDefaults(name, defaults, params);
      }
      else {
        ewd[name] = defaults[name];
        if (params && typeof params[name] !== 'undefined') ewd[name] = params[name];
      }
    }
    if (ewd.database.type === 'globals') ewd.database.type = 'cache';
    if (params.database && params.database.also) {
      ewd.database.also = params.database.also;
      if (ewd.database.also.length > 0 && ewd.database.also[0] === 'mongodb') {
        ewd.database.address = params.database.address || 'localhost';
        ewd.database.port = params.database.port || 27017;
      }
    }
  },

  setPropertyDefaults: function(property,defaults, params) {
    var name;
    ewd[property] = {};
    for (name in defaults[property]) {
      ewd[property][name] = defaults[property][name];
      if (params && typeof params[property] !== 'undefined') {
        if (typeof params[property][name] !== 'undefined') ewd[property][name] = params[property][name];
      }
    }
  },

  ewdMonitor: {},

  sendToMonitor: function(message) {
    // 
    var lastMsgSent = ewd.lastMsgSent || ewd.startTime;
    var now = new Date().getTime();
    if ((message.type === 'sessionDeleted' || message.type === 'newSession') && (now - lastMsgSent) < 1000) {
      // throttle these messages to no more than 1 per second
      // required for times when large numbers of REST-created sessions time out at the same time
      return;
    }
    else {
      var clientId;
      var client;
      for (clientId in ewd.ewdMonitor) {
        client = ewd.socketClient[clientId];
        if (client && client.connected && client.application === 'ewdMonitor' && client.json) {
          client.json.send(message);
        }
        else {
          delete ewd.ewdMonitor[clientId];
        }
      }
      ewd.lastMsgSent = now;
      client = null;
      clientId = null;
      message = null;
      now = null;
    }
  },

  shutdown: function() {
    //for (var i = 0; i < ewd.childProcess.poolSize; i++) {
    for (var pid in ewd.process) {
      ewd.addToQueue({
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
    var poolSize = ewd.childProcess.poolSize + 0;
    for (var pid in ewd.process) {
      proc = ewd.process[pid];
      dur = new Date().getTime() - proc.time;
      if (!proc.isAvailable) {
        console.log('pid: ' + pid + ' not available for ' + dur);
        if (dur > ewd.childProcess.unavailableLimit) {
          // locked for too long - close it down!
          if (poolSize < 2) {
            // start a new child process first!
            newPid = ewd.startChildProcess(99);
            ewd.childProcess.poolSize++;
            console.log('too few child processes - ' + newPid + ' started');
            poolSize++;
            for (clientId in ewd.socketClient) {
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
          ok = ewd.mgrTask['EWD.mgr.stopChildProcess']({pid: pid});
          poolSize--;
        }
      }
      else {
        console.log('pid: ' + pid + ' available for ' + dur);
        if (ewd.childProcess.auto && dur > ewd.childProcess.idleLimit) {
          // idle for too long - close it down unless minimum process pool reached already
          if (poolSize > 1) {
            ok = ewd.mgrTask['EWD.mgr.stopChildProcess']({pid: pid});
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
    ewd.sessionClearDown();
    ewd.sessionGCEvent = setTimeout(ewd.sessionGC, ewd.sessionGCInterval);
  },

  showQ: function() {
    if (ewd.queue.length > 0) console.log('Queue length: ' + ewd.queue.length);
  },

  showQLoop: function() {
    // Show length of queue every second
    ewd.showQ();
    ewd.showQEvent = setTimeout(ewd.showQLoop, 1000);
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
      maxQueueLength: ewd.maxQueueLength,
      queueLength: ewd.queue.length,
      childProcess: {}
    };
    for (var pid in ewd.process) {
      message.childProcess[pid] = {
        isAvailable: ewd.process[pid].isAvailable,
        noOfRequests: ewd.requestsByProcess[pid]
      };
      this.getChildProcessMemory(pid);
    }
    ewd.sendToMonitor(message);
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
    if (pid && !ewd.process[pid]) return;
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
              ewd[section][name] = value;
            }
          }
        }
      }
      else {
        value = params[section];
        if (value !== '') ewd[section] = value;
      }
    }
    return '';
  },

  startChildProcesses: function() {
    //console.log("startChildProcesses - poolSize = " + this.childProcess.poolSize);
    if (this.childProcess.poolSize > 1) {
      var pid;
      for (var i = 1; i < this.childProcess.poolSize; i++) {
        pid = this.startChildProcess(i);
        //console.log('startChildProcess ' + i + '; pid ' + pid);
      }
      pid = null;
      i = null;
    }
  },
  startChildProcess: function(processNo, debug) {
    if (debug) {
      ewd.debug.child_port++;
      process.execArgv.push('--debug=' + ewd.debug.child_port);
    }
    var childProcess = cp.fork(this.childProcess.path, [], {env: process.env});
    var pid = childProcess.pid;
    ewd.process[pid] = childProcess;
    var thisProcess = ewd.process[pid];
    thisProcess.isAvailable = false;
    thisProcess.time = new Date().getTime();
    thisProcess.started = false;
    this.requestsByProcess[pid] = 0;
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
    this.queueByPid[pid] = [];
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
          /*
          ewd.sendToMonitor({
            type: 'pidUpdate', 
            pid: pid, 
            noOfRequests: ewd.requestsByProcess[pid], 
            available: proc.isAvailable,
            debug: proc.debug
          });
          */
        }
      }
      response = null;
      pid = null;
      release = null;
    });

    return pid;
  },
  
  getChildProcesses: function() {
    var pid;
    var pids = [];
    for (pid in ewd.process) {
      pids.push({
        pid: pid, 
        available: ewd.process[pid].isAvailable, 
        noOfRequests: ewd.requestsByProcess[pid],
        debug: ewd.process[pid].debug      
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

  handleWebServiceRequest: function(uri, urlObj, request, postedData, response) {

    if (ewd.traceLevel >= 1) console.log("incoming JSON Web Service request: " + uri);
    //console.log("*** postedData = " + postedData + '***');
    var pieces = uri.split('/');
    var appName = pieces[2];
    if (!appName) {
      ewd.errorResponse({error: 'Application Name not specified'}, response);
      return;
    }
    var serviceName = pieces[3];
    if (!serviceName) {
      ewd.errorResponse({error: 'Service Name not specified'}, response);
      return;
    }
    var query = urlObj.query;
    if (ewd.traceLevel >= 2) console.log("JSON WS: query = " + JSON.stringify(query));
    if (ewd.traceLevel >= 2) console.log("JSON WS: app: " + appName + "; service: " + serviceName);

    if (ewd.webservice.authenticate) {
      if (!query.accessId || !query.signature || !query.timestamp) {
        ewd.errorResponse({error: 'Missing Access Credentials'}, response);
        return;
      }
      if (!(new Date(query.timestamp).getFullYear() > 0)) {
        ewd.errorResponse({error: 'Invalid timestamp'}, response);
        return;
      }
    }

    var requestObj = {
      type:'webServiceRequest',
      appName: appName,
      serviceName: serviceName,
      query: query,
      uri: uri,
      host: request.headers.host,
      response: response,
      post_data: postedData
    };
    ewd.addToQueue(requestObj);
  },

  handleAjaxRequest: function(content, response) {
    var error;
    var params;
    if (!content || content === '') {
      error = 'Ajax message error: Missing or empty posted data';
      if (ewd.traceLevel >= 3) console.log(error);
      ewd.errorResponse({error: error}, response);
      return;
    }
    try {
      params = JSON.parse(content);
    }
    catch(err) {
      error = 'Badly formed params in Ajax request: ' + content + ': ' + err;
      if (ewd.traceLevel >= 3) console.log(error);
      ewd.errorResponse({error: error}, response);
    }
    if (ewd.traceLevel >= 1) console.log("incoming Ajax request - data: " + JSON.stringify(params, null, 2));
    //ewd.log("incoming Ajax request - data: " + content, null, 2), 1);
    if (params.token && ewd.socketClientByToken[params.token]) {
      params.messageType = params.type;
      params.type = 'webSocketMessage';
      params.ajax = true;
      params.response = response;
      ewd.addToQueue(params);
    }
    else {
      error = 'Token missing or invalid on incoming message from browser, so ignored';
      if (ewd.traceLevel >= 2) console.log(error); 
      ewd.errorResponse({error: error}, response);
      return;
    }
  },

  handleWebMgrRequest: function(uri, urlObj, postedData, request, response) {
    if (ewd.traceLevel >= 1) console.log("incoming management request URL: " + uri);
    if (request.method.toLowerCase() === 'get') postedData = urlObj.query;
    /*
    if (request.method.toLowerCase() === 'post') {
      console.log('Headers: ' + JSON.stringify(request.headers));
      console.log('data: ' + JSON.stringify(postedData, null, 2));
    }
    */
    var authorization = request.headers.authorization || '';
    var task = uri.split('/');
    if (task && task[2]) task = task[2];
    if (ewd.mgrTaskHandlers[task]) {
      var json = ewd.mgrTaskHandlers[task](postedData, authorization, response);
      if (json) {
        if (json.sendResponse === false) {
          // don't do anything - the handler function is looking after the response for us
        }
        else if (json.error) {
          ewd.errorResponse({error: json.error}, response);
        }
        else {
          response.writeHead(200, {'Content-Type': 'application/json'});
          response.write(JSON.stringify(json, null, 2));
          response.end();
        }
      }
      else {
        ewd.display404(response);
      }
    }
    else {
      ewd.display404(response);
    }
    uri = null;
    urlObj = null;
    postedData = null;
    request = null;
    response = null;
  },

  handlePrivateFileRequest: function(uri, request, response) {

    if (uri.substr(0,ewd.privateFilePath.length) === ewd.privateFilePath) {
      uri = uri.substr(ewd.privateFilePath.length);
    }
    var token = uri.substr(1);
    if (token && token !== '' && ewd.socketClientByToken[token]) {
      var clientId = ewd.socketClientByToken[token];
      if (ewd.socketClient[clientId] && ewd.socketClient[clientId].privateFilePath) {
        var path = ewd.socketClient[clientId].privateFilePath;
        if (path !== '') {
          var cwd = process.cwd();
          if (cwd.slice(-1) === '/') cwd = cwd.slice(0,-1);
          ewd.fetchFile(cwd + path, request, response);
          delete ewd.socketClient[clientId].privateFilePath;
          return;
        }
      }
    }
    ewd.display404(response);
  },

  handleFileRequest: function(uri, request, response) {

    if (uri.substr(0,ewd.webServerRootPath.length)===ewd.webServerRootPath) {
      uri = uri.substr(ewd.webServerRootPath.length);
    }

    var fileName = unescape(ewd.webServerRootPath + uri);
    if (ewd.traceLevel >= 1) console.log("Incoming HTTP request for: " + fileName);
    ewd.fetchFile(fileName, request, response);
  },

  fetchFile: function(fileName, request, response) {
    if (fileName.indexOf('..') !== -1) {
      ewd.display404(response);
      return;
    }
    if (fileName.indexOf('./') !== -1) {
      ewd.display404(response);
      return;
    }
    if (fileName.indexOf('.\\') !== -1) {
      ewd.display404(response);
      return;
    }
    fs.exists(fileName, function(exists) {  
      if (!exists) {  
        ewd.display404(response); 
      }
      else {
        fs.readFile(fileName, "binary", function(err, file) {  
          if (err) {
            var errCode = 500;
            if (err.errNo === 34) errCode = 404;
            response.writeHead(errCode, {"Content-Type": "text/plain"});  
            response.write(err + "\n");  
            response.end();
          }
          else {
            fs.stat(fileName,function(err, stat) {
              var etag = stat.size + '-' + Date.parse(stat.mtime);
              if (ewd.traceLevel >= 2) console.log("etag = " + etag);
              if (request.headers['if-none-match'] === etag) {
                response.setHeader('Last-Modified', stat.mtime);
                response.statusCode = 304;
                response.end();
                return;
              }
              var contentType = mime.lookup(fileName);
              /*
              var contentType = "text/plain";
              if (fileName.indexOf(".htm") !== -1) contentType = "text/html";
              else if (fileName.indexOf(".js") !== -1) contentType = "application/javascript";
              else if (fileName.indexOf(".css") !== -1) contentType = "text/css";
              else if (fileName.indexOf(".jpg") !== -1) contentType = "image/jpeg";
              else if (fileName.indexOf(".xml") !== -1) contentType = "text/xml";
              else if (fileName.indexOf(".xsl") !== -1) contentType = "text/xml";
              */
              var xdate = new Date();
              var year = xdate.getFullYear() + 1;
              xdate = xdate.setFullYear(year);
              var expire = new Date(xdate).toUTCString();
              var headers = {
                "Content-Type": contentType, 
                "Last-Modified": stat.mtime.toUTCString(), //split("GMT")[0] + "GMT"),
                "ETag": etag,
                "Cache-Control": 'public; max-age=31536000',
                "Expires": expire
              };
              response.writeHead(200, headers);  
              response.write(file, "binary");  
              response.end();
            });
          }
        }); 
      }
    });
  },

  startWebServer: function() { 

    var webserverCallback = function(request, response) {
      var content = '';
      request.on("data", function(chunk) {
        content += chunk;
      });
	  
      request.once("end", function(){
        var urlObj = url.parse(request.url, true); 
        var postedData;
        if (request.headers['content-type'] === 'application/json' && request.method === 'POST') {
          try {
            postedData = JSON.parse(content);
          }
          catch(err) {
            ewd.display404(response);
            return;
          }
          for (var name in urlObj.query) {
            if (!postedData[name]) postedData[name] = urlObj.query[name];
          } 
        }
        else {
          postedData = queryString.parse(content);
        }
        //var contentType;
        var uri = urlObj.pathname;
        if (uri === '/favicon.ico') {
          ewd.display404(response);
          uri = null;
          urlObj = null;
          return;
        }
        /*
        if (uri === '/queueLength') {
          response.writeHead(200, {'Content-Type': 'text/plain'});
          response.write(ewd.maxQueueLength + " \n");  
          response.end();
        }
        if (uri === '/resetQueueLength') {
          ewd.maxQueueLength = 0;
          response.writeHead(200, {'Content-Type': 'text/plain'});
          response.write('ok \n');
          response.end();
        }
        */
        //ewd.log("uri: " + uri, 3);
        //ewd.log("***** postedData = " + JSON.stringify(postedData), 3);

        if (uri.substr(0,ewd.webservice.json.path.length) === ewd.webservice.json.path) {
          /*		    
           incoming request to invoke a JSON-based Web Service
           eg example URL /json/myApp/serviceName?param1=xxx&param2=yyy&userId=rob123&signature=1234567
          */
          
          ewd.handleWebServiceRequest(uri, urlObj, request, postedData, response);
          return;
        }

        if (uri.substr(0,ewd.ajax.path.length)===ewd.ajax.path) {
          /*		    
            incoming Ajax-packaged message request 
          */
          ewd.handleAjaxRequest(content, response);
          return;
        }

        if (ewd.management.httpAccess.enabled && uri.substr(0, ewd.management.httpAccess.path.length) === ewd.management.httpAccess.path) {
          /*		    
            incoming management request (must be accompanied by valid password or ignored
            eg example URL /ewdjsMgr?password=xxxxxxxx&task=value
          */
          ewd.handleWebMgrRequest(uri, urlObj, postedData, request, response);
          return;
        }

        if (uri.substr(0,ewd.privateFilePath.length) === ewd.privateFilePath) {
          /*		    
            incoming request for private file - tokenised single-shot URL
            eg example URL /privateFilePath/khqwkhqwhequyiyiuy
          */
          ewd.handlePrivateFileRequest(uri, request, response);
          return;
        }

        ewd.handleFileRequest(uri, request, response);
      });
    };

    // WebServer definition - https or http

    if (ewd.https.enabled) {
      var https = require("https");
      var options = {
        key: fs.readFileSync(ewd.https.keyPath),
        cert: fs.readFileSync(ewd.https.certificatePath),
        // turn off SSL 3.0 to protect against POODLE vulnerability
        secureProtocol: 'SSLv23_method',
        secureOptions: constants.SSL_OP_NO_SSLv3,
      };
      if (ewd.traceLevel >= 1) console.log("HTTPS is enabled; listening on port " + ewd.httpPort);
      ewd.webserver = https.createServer(options, webserverCallback);
      // Start HTTP listening service for GT.M/Cache to use for WebSockets events
    }
    else {
      if (ewd.traceLevel >= 1) console.log("HTTP is enabled; listening on port " + ewd.httpPort);
      var http = require("http");
      ewd.webserver = http.createServer(webserverCallback);
    }
    ewd.webserver.on('error', function(e) {
        console.log('**** Error reported by web server: ' + e.code + ': ' + e.message + ' *****');
        if (e.code === 'EADDRINUSE' || e.code === 'EACCES') {
          console.log("**** Probably unable to open WebServer Port (" + ewd.httpPort + "): already in use");
          console.log("or you do not have permissions to use it");
          console.log("Change the port in the EWD.js Startup file to one that is available");
          console.log('EWD.js shutting down...');
          ewd.shutdown();
        }
    });

    ewd.webserver.listen(ewd.httpPort);
    // now start up socket.io and message handlers
    this.startSocketIo(ewd.webserver);
    // startup external TCP message listener
    this.startExternalListener();
    // start periodic Session Clear-down / garbage collection
    this.sessionGC() ;
    //this.showQLoop();
    process.on( 'SIGINT', function() {
      console.log('*** CTRL & C detected: shutting down gracefully...');
      ewd.mgrTask['EWD.mgr.exit']();
    });

    process.on( 'SIGTERM', function() {
      console.log('*** Master Process ' + process.pid + ' detected SIGTERM signal.  Shutting down gracefully...');
      ewd.mgrTask['EWD.mgr.exit']();
    });

  },
  socketClient: {},
  socketClientByToken: {},
  startSocketIo: function(webserver) {
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
        ewd.addToQueue({
          type: 'EWD.reconnect',
          'client.id': client.id
        });
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

        if (type !== 'EWD.register') {
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
  },

  clearDisconnectedSockets: function() {
    // clear out any socket client references that have been 
    // disconnected for more than maximum allowed time
    var ewdMonitorRunning = false;
    var client;
    var disconnectedTime;
    var now = new Date().getTime();
    var maxTime = ewd.webSockets.maxDisconnectTime;
    var token;
    for (var clientId in ewd.socketClient) {
      client = ewd.socketClient[clientId];
      if (!client.connected) {
        disconnectedTime = now - client.disconnectTime;
        if (disconnectedTime > maxTime) {
          if (ewd.traceLevel >= 2) console.log('cleared down socket client record for: ' + clientId);
          token = client.token;
          delete ewd.socketClient[clientId];
          if (token) delete ewd.socketClientByToken[token];
        }
      }
      else {
        if (client.application === 'ewdMonitor') {
          ewdMonitorRunning = true;
        }
      }
    }
    if (!ewdMonitorRunning && ewd.statsEvent) {
      //console.log('! shutting down logging');
      clearTimeout(ewd.statsEvent);
      ewd.statsEvent = false;
    }
    client = null;
    disconnectedTime = null;
  },

  startExternalListener: function() {
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
        else if (ewd.traceLevel >= 3) console.log("addToQueue: " + JSON.stringify(requestObj, null, 2));
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
    //if (ewd.traceLevel > 0) ewd.sendToMonitor({type: 'queueInfo', qLength: qLength});
    if (qLength > this.maxQueueLength) this.maxQueueLength = qLength;
    if (requestObj.type !== 'webServiceRequest' && requestObj.type !== 'getMemory' && requestObj.type !== 'sessionGC') {
      if (ewd.traceLevel >= 2) {
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
          var newPid = ewd.startChildProcess(99);
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
      ewd.process[pid].response = queuedRequest.response;
      delete queuedRequest.response;  // don't pass to child process but leave waiting on main process side
      if (queuedRequest.ajax) delete queuedRequest.ajax;
    }
    if (type === 'closeSession') {
      // make sure ewdMonitor-initiated session closure results in socket message to remove from display
      ewd.lastMsgSent = ewd.startTime;
    }
    if (type === 'externalMessage') {
      ewd.process[pid].externalMessage = {
        message: queuedRequest.message,
        type: queuedRequest.messageType
      };
      delete queuedRequest.message;  // don't pass to child process but leave waiting on main process side
      delete queuedRequest.messageType;  // don't pass to child process but leave waiting on main process side
    }
    //ewd.sendToMonitor({type: 'queueInfo', qLength: ewd.queue.length});
    //ewd.log("queuedRequest = " + JSON.stringify(queuedRequest), 3);
    if (queuedRequest.type !== 'getMemory' && queuedRequest.type !== 'sessionGC' && queuedRequest.messageType !== 'getLogTail' && queuedRequest.messageType !== 'getMemory' && queuedRequest.messageType !== 'keepAlive') {
      if (ewd.traceLevel >= 3) console.log("dispatching request to " + pid + " at " + ewd.elapsedTime()); // + ': ' + JSON.stringify(queuedRequest));
    }
    var childProcess = ewd.process[pid];
    childProcess.clientId = queuedRequest.clientId;
    childProcess.type = type;
    if (queuedRequest.frontEndService) {
      childProcess.frontEndService = queuedRequest.frontEndService;
      delete queuedRequest.frontEndService;
    }
    delete queuedRequest.clientId;
    if (queuedRequest.response) {
      ewd.process[pid].response = queuedRequest.response;
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
      ewd.childProcess.poolSize--;
      delete ewd.process[pid];
      delete ewd.requestsByProcess[pid];
      delete ewd.queueByPid[pid];
      ewd.queue.push(queuedRequest);
      // start a new child process
      var newPid = ewd.startChildProcess(999, false);
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
      ewd.childProcess.poolSize++;
      return;
    }
    ewd.requestsByProcess[pid]++;
    /*
    ewd.sendToMonitor({
      type: 'pidUpdate', 
      pid: pid, 
      noOfRequests: ewd.requestsByProcess[pid], 
      available: ewd.process[pid].isAvailable,
      debug: ewd.process[pid].debug
    });
    */
    childProcess = null;
    type = null;
  },

  getChildProcess: function() {
    var pid;
    // try to find a free child process, otherwise return false
    for (pid in ewd.process) {
      if (ewd.process[pid].isAvailable) {
        ewd.process[pid].isAvailable = false;
        ewd.process[pid].time = new Date().getTime();
        /*
        ewd.sendToMonitor({
          type: 'pidUpdate', 
          pid: pid, 
          noOfRequests: ewd.requestsByProcess[pid], 
          available: ewd.process[pid].isAvailable,
          debug: ewd.process[pid].debug
        });
        */
        return pid;
      }
    }
    return false;
  },

  mgrTaskHandlers: {

    authenticate: function(postedData, authorization, response) {
      if (!authorization || authorization === '') return false;
      var pcs = authorization.split('-&-');
      var username = '';
      var password = '';
      var requestObj;
      if (pcs && pcs.length === 2) {
        if (pcs[0]) username = pcs[0];
        if (pcs[1]) password = pcs[1];
        if (username === '') return false;
        if (password === '') return false;
        requestObj = {
          type:'EWD.mgr.authenticate',
          username: username,
          password: password,
          response: response,
          mgtPassword: ewd.management.password
        };
      }
      else {
        requestObj = {
          type:'EWD.mgr.authenticate',
          username: 'dummy',
          password: authorization,
          response: response,
          mgtPassword: ewd.management.password
        };
      }
      ewd.addToQueue(requestObj);
      return {sendResponse: false};
    },

    setParameters: function(postedData, authorization, response) {
      // this requires a POST with an application/json payload containing the parameters object definition, eg
      //  {
      //   "traceLevel": 2
      //  }
      if (!authorization || authorization === '') return false;
      var params;
      if (postedData.params) {
        params = postedData.params;
      }
      else {
        params = postedData;
      }
      var requestObj = {
        type:'EWD.mgr.setParameters',
        token: authorization,
        response: response,
        params: params
      };
      ewd.addToQueue(requestObj);
      return {sendResponse: false};
    },

    setAvailability: function(postedData, authorization, response) {
      if (!authorization || authorization === '') return false;
      var pid = postedData.pid;
      if (!pid || pid === '') return {error: 'Invalid or missing pid'};
      if (!ewd.process[pid]) return {error: 'Child Process does not exist'};
      var available = postedData.available;
      if (available === 'false') available = false;
      if (available === 'true') available = true;
      if (available !== true && available !== false) return {error: 'Invalid or missing available value'};
      var requestObj = {
        type:'EWD.mgr.setAvailability',
        token: authorization,
        response: response,
        params: {
          pid: pid,
          available: available
        }
      };
      ewd.addToQueue(requestObj);
      return {sendResponse: false};
    },

    about: function(postedData, authorization, response) {
      if (!authorization || authorization === '') return false;
      var requestObj = {
        type:'EWD.mgr.about',
        token: authorization,
        response: response
      };
      ewd.addToQueue(requestObj);
      return {sendResponse: false};
    },

    getChildProcesses: function(postedData, authorization, response) {
      if (!authorization || authorization === '') return false;
      var requestObj = {
        type:'EWD.mgr.getChildProcesses',
        token: authorization,
        response: response
      };
      ewd.addToQueue(requestObj);
      return {sendResponse: false};
    },

    startChildProcess: function(postedData, authorization, response) {
      if (!authorization || authorization === '') return false;
      var requestObj = {
        type:'EWD.mgr.startChildProcess',
        token: authorization,
        response: response,
        params: {
          debug: postedData.debug || false
        }
      };
      ewd.addToQueue(requestObj);
      return {sendResponse: false};
    },

    stopChildProcess: function(postedData, authorization, response) {
      if (!authorization || authorization === '') return false;
      if (ewd.childProcess.poolSize > 1) {
        var pid = postedData.pid;
        if (pid && ewd.process[pid]) {
          var requestObj = {
            type:'EWD.mgr.stopChildProcess',
            token: authorization,
            response: response,
            params: {
              pid: pid
            }
          };
          ewd.addToQueue(requestObj);
          return {sendResponse: false};
        }
        else {
          return {error: 'Pid not defined or does not exist'};
        }
      }
      else {
        return {error: 'Poolsize must be 1 or greater'};
      }
    },

    exit: function(postedData, authorization, response) {
      if (!authorization || authorization === '') return false;
      var requestObj = {
        type:'EWD.mgr.exit',
        token: authorization,
        response: response
      };
      ewd.addToQueue(requestObj);
      return {sendResponse: false};
    },

    getChildProcessInfo: function(postedData, authorization, response) {
      if (!authorization || authorization === '') return false;
      var pid = postedData.pid;
      if (pid) {
        if (ewd.process[pid]) {
          if (ewd.process[pid].isAvailable) {
            var requestObj = {
              type:'EWD.mgr.getChildProcessInfo',
              pid: pid,
              token: authorization,
              response: response
            };
            ewd.addToQueue(requestObj);
            return {sendResponse: false};
          }
          else {
            return {
              json: {
                pid: pid,
                isAvailable: false
              }
            };
          }
        }
        else {
          return {error: 'No such pid: ' + pid};
        }
      }
      else {
        return {
          error: 'No pid specified'
        };
      }

    },
  },

  mgrTask: {
    'EWD.mgr.about': function() {
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
        ntp: ewd.ntp
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
        if (xclient.application && xclient.application === 'ewdMonitor') {
          xclient.json.send({
            type: 'EWD.childProcessStopped',
            pid: pid
          });
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
  },

  childProcessMessageHandlers: {
  
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
      console.log('EWD.management response received from child process: ' + JSON.stringify(response.content));
      console.log('Type: ' + response.messageType + '; error: ' + response.error);
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
          customModule: ewd.childProcess.customModule
        }			
      };
      console.log("Sending initialise request to " + response.pid + ': ' + JSON.stringify(requestObj, null, 2));
      ewd.process[response.pid].send(requestObj);
    },
    'EWD.register': function(response) {
      var clientId = ewd.process[response.pid].clientId;
      if (clientId) {
        var client = ewd.socketClient[clientId];
        if (client) {
          ewd.socketClientByToken[response.token] = client.id;
          ewd.socketClient[client.id].token = response.token;
          client.json.send({
            type:'EWD.registered', 
            token: response.token,
            servicePath: ewd.servicePath
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
    /*
    log: function(response) {
      ewd.logToBrowser(response.message);
      response = null;
    },
    */
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
        if (client) {
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
      if (typeof response.content.type === 'ewd.releaseChildProcess') {
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
          var header = {
            'Date': new Date().toUTCString(),
            'Content-Type': 'application/json'
          };
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
    
  },

  webSocketMessageHandlers: {
  
    // handlers for incoming WebSocket messages from browsers
    
    'EWD.register': function(messageObj, client) {
      if (messageObj.application) {
        ewd.socketClient[client.id] = client;
        ewd.socketClient[client.id].application = messageObj.application.name;
        if (messageObj.application.name === 'ewdMonitor') ewd.ewdMonitor[client.id] = client.id;
        var requestObj = {
          type:'EWD.register',
          clientId: client.id,
          application: messageObj.application,
          ewd_clientId: client.id,
          //ewd_password: ewd.management.password
        };
        ewd.addToQueue(requestObj);
        requestObj = null;
      }
      else {
        // register message ignored - no application specified
      }
      // use this opportunity to clear out any socket references that have been disconnected for over 1 day
      ewd.clearDisconnectedSockets();
      messageObj = null;
      client = null;
    },
    
    webSocketMessage: function(messageObj, client) {
      // check if this is a special system message, eg for EWD.startConsole etc
      var token;
      var clientId;
      var intercept = {
        'EWD.form.login': ['ewdMonitor', 'ewdFederatorMgr'],
        addUser: ['ewdMonitor'],
        changeUserPassword: ['ewdMonitor'],
        deleteUser: ['ewdMonitor'],
        login: ['benchmark']
      };
      if (messageObj.messageType && intercept[messageObj.messageType]) {
        var apps = intercept[messageObj.messageType];
        // special pre-processing for ewdMonitor commands
        token = messageObj.token;
        if (ewd.socketClientByToken[token]) {
          clientId = ewd.socketClientByToken[token];
          if (ewd.socketClient[clientId]) {
            var app;
            for (var i = 0; i < apps.length; i++) {
              app = apps[i];
              if (ewd.socketClient[clientId].application === app) {
                messageObj.params.managementPassword = ewd.management.password;
                break;
              }
            }
          }
        }
      }
      if (ewd.systemMessageHandlers[messageObj.messageType]) {
        // All system message requests must first be checked to ensure that they have been sent by
        //  a logged in ewdMonitor user
        var messageType = messageObj.messageType;
        token = messageObj.token;
        if (ewd.socketClientByToken[token]) {
          // token is genuine
          if (messageType === 'EWD.getFragment' || messageType === 'EWD.logout') {
            ewd.systemMessageHandlers[messageType](messageObj, client);
          }
          else {
            clientId = ewd.socketClientByToken[token];
            if (ewd.socketClient[clientId]) {
              if (messageType === 'EWD.benchmark' && ewd.socketClient[clientId].application === 'benchmark') {
                // OK to process it!
                ewd.systemMessageHandlers[messageType](messageObj, client);
              }
              else if (ewd.socketClient[clientId].application === 'ewdMonitor') {
                // OK to process it!
                ewd.systemMessageHandlers[messageType](messageObj, client);
              }
              else {
                if (ewd.traceLevel >= 2) console.log('An incoming system message was ignored as it did not come from an ewdMonitor user');
              }
            }
          }
        }
        else {
          if (ewd.traceLevel >= 2) console.log('An incoming system message was ignored as it did not have a valid token');
        }
      }
      else {
        // send to back-end for processing by application-specific module
        messageObj.ipAddress = client.handshake.address;
        messageObj.clientId = client.id;
        ewd.addToQueue(messageObj);
        messageObj = null;
        client = null;
      }
    }
  },
  
  systemMessageHandlers: {
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
          maxQueueLength: ewd.maxQueueLength
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
          ntp: ewd.ntp
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
      client.json.send({
        type: 'EWD.getDebugPorts',
        child_port: ewd.debug.child_port || '',
        web_port: ewd.debug.web_port || '',
      });
    },
    'EWD.changeDebugPorts': function(messageObj, client) {
      function isInteger(n) {
        n = parseInt(n);
        return +n === n && !(n % 1);
      }

      var childPort = messageObj.child_port;
      var webPort = messageObj.web_port;
      var ok = true;
      if (childPort === '') ok = false;
      if (!isInteger(childPort)) ok = false;
      if (webPort === '') ok = false;
      if (!isInteger(webPort)) ok = false;
      if (ok) {
        ewd.debug.child_port = childPort;
        ewd.debug.web_port = webPort;
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
  }

};

module.exports = {
  start: function(params, callback) {
    if (process.argv.indexOf('debug') !== -1) {
      if (!params) params = {};
      if (!params.debug) params.debug = {};
      params.debug.enabled = true;
    }	
    ewd.defaults(params);

    ewd.queueEvent.on("processQueue", ewd.processQueue);
	
    console.log('   ');
    console.log('********************************************');
    console.log('**** EWD.js Build ' + ewd.buildNo + ' (' + ewd.buildDate + ') *******');
    console.log('********************************************');
    console.log('  ');
    console.log('Started: ' + ewd.started);
    console.log('Master process: ' + process.pid);
    console.log(ewd.childProcess.poolSize + ' child Node processes will be started...');

    // start child processes which, in turn, starts web server
    ewd.startChildProcess(0, ewd.debug.enabled);

    if (callback) callback(ewd);

  },

  test: ewd

};


