/*

 ----------------------------------------------------------------------------
 | ewd.js: EWD.js Framework                                                 |
 |                                                                          |
 | Copyright (c) 2013-14 M/Gateway Developments Ltd,                        |
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
var fs = require('fs');
var url = require('fast-url-parser');
var queryString = require('querystring');
var path = require('path');
var events = require('events');
var net = require('net');
var util = require('util');
var mime = require('mime');
var constants = require('constants');


var ewd = {
  buildNo: 90,
  buildDate: '17 November 2014',
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

  defaults: function(params) {
    var cwd = params.cwd || process.cwd();
    if (cwd.slice(-1) === '/') cwd = cwd.slice(0,-1);
    var defaults = {
      childProcessPath: __dirname + '/ewdChildProcess.js',
      os: 'linux',
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
      logFile: 'ewdLog.txt',
      logTo: 'console',
      logHTTP: false,
      modulePath: cwd + '/node_modules',
      servicePath: '/services',
      monitorInterval: 30000,
      poolSize: 2,
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
        path: '/ewdjsMgr',
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
      }
    };

    if (params && params.debug && typeof params.debug.enabled !== 'undefined') {
      defaults.debug.enabled = params.debug.enabled;
      if (params.debug.enabled)
        params.poolSize = 1;
    };

    if (params && params.database && typeof params.database.type !== 'undefined') defaults.database.type = params.database.type;
    if (params && typeof params.os !== 'undefined') defaults.os = params.os;
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
    this.setDefaults(defaults, params);
  },
  setDefaults: function(defaults, params) {
    var name;
    //var value;
    var subDefaults = {
      database: '',
      debug: '',
      https: '',
      webSockets: '',
      management: '',
      ajax: '',
      webRTC: '',
      webservice: ''
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

  log: function(message, level, clearLog) {
    if (level <= this.traceLevel) {
      if (this.logTo === 'console') {
        console.log(message);
      }
      if (this.logTo === 'global') {
        this.logToGlobal(message);
      }
      if (this.logTo === 'file') {
        this.logToFile(message, clearLog);
      }
      this.logToBrowser(message);
    }
    message = null;
    level = null;
  },

  logToFile: function(message, clearLog) {
    var s = new Date().getTime() + ': ' + process.pid + ': ' + message.toString().replace(/\r\n|\r/g, '\n');
    s = s + '\n';
    var options = {};
    if (clearLog) {
      options.flag = 'w+';
    }
    fs.appendFile(ewd.logFile, s, options, function (err) {
      if (err) {
        // don't do anything
      }
    });
  },

  logToBrowser: function(message) {
    var date = new Date();
    message = date.toDateString() + ' ' + date.toLocaleTimeString() + ': ' + message;
    ewd.sendToMonitor({type: 'consoleText', text: message});
  },
  sendToMonitor: function(message) {
    //return;
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
    client = null;
    clientId = null;
    message = null;
  },

  shutdown: function() {
    for (var i = 0; i < ewd.poolSize; i++) {
      ewd.addToQueue({type: 'EWD.exit'});
    }
  },

  sessionClearDown: function() {
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
      uptime: this.elapsedTime()
    };
    ewd.sendToMonitor(message);
    for (var pid in ewd.process) {
      this.getChildProcessMemory(pid);
    }
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
    if (pid) requestObj.pid = pid;
    this.addToQueue(requestObj);
    requestObj = null;
  },

  process: {},
  requestsByProcess: {},

  startChildProcesses: function() {
    //console.log("startChildProcesses - poolSize = " + this.poolSize);
    if (this.poolSize > 1) {
      var pid;
      for (var i = 1; i < this.poolSize; i++) {
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
    var childProcess = cp.fork(this.childProcessPath, [], {env: process.env});
    var pid = childProcess.pid;
    ewd.process[pid] = childProcess;
    var thisProcess = ewd.process[pid];
    thisProcess.isAvailable = false;
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
        if (response.type !== 'getMemory') {
          if (ewd.traceLevel >= 3) ewd.log("child process returned response " + JSON.stringify(response), 3);
        }
        if (ewd.childProcessMessageHandlers[response.type]) {
          ewd.childProcessMessageHandlers[response.type](response);
        }
        else {
          if (!response.empty && ewd.traceLevel >= 3) ewd.log('No handler available for child process message type (' + response.type + ')', 3);
        }
        // release the child process back to the available pool
        //console.log('** response.type: ' + response.type);
        //console.log('** ewd.process for pid ' + pid + ': ' + ewd.process[pid].type);
        if (response.type !== 'EWD.exit' && release) {
          if (ewd.traceLevel >= 3) ewd.log('process ' + pid + ' returned to available pool; type=' + response.type, 3);
          delete proc.response;
          delete proc.type;
          delete proc.frontEndService;
          proc.isAvailable = true;
          ewd.queueEvent.emit("processQueue");
          ewd.sendToMonitor({
            type: 'pidUpdate', 
            pid: pid, 
            noOfRequests: ewd.requestsByProcess[pid], 
            available: proc.isAvailable,
            debug: proc.debug
          });
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

    if (ewd.traceLevel >= 1) ewd.log("incoming JSON Web Service request: " + uri, 1);
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
    if (ewd.traceLevel >= 2) ewd.log("JSON WS: query = " + JSON.stringify(query), 2);
    if (ewd.traceLevel >= 2) ewd.log("JSON WS: app: " + appName + "; service: " + serviceName, 2);

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
      if (ewd.traceLevel >= 3) ewd.log(error, 3);
      ewd.errorResponse({error: error}, response);
      return;
    }
    try {
      params = JSON.parse(content);
    }
    catch(err) {
      error = 'Badly formed params in Ajax request: ' + content + ': ' + err;
      if (ewd.traceLevel >= 3) ewd.log(error, 3);
      ewd.errorResponse({error: error}, response);
    }
    if (ewd.traceLevel >= 1) ewd.log("incoming Ajax request - data: " + JSON.stringify(params, null, 2), 1);
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
      if (ewd.traceLevel >= 2) ewd.log(error, 2); 
      ewd.errorResponse({error: error}, response);
      return;
    }
  },

  handleWebMgrRequest: function(uri, urlObj, postedData, request, response) {
    if (ewd.traceLevel >= 1) ewd.log("incoming management request URL: " + uri, 1);
    if (request.method.toLowerCase() === 'get') postedData = urlObj.query;
    if (typeof postedData.password !== 'undefined') {
      if (postedData.password === ewd.management.password) {
        if (postedData.exit === 'true') {
          /*
          response.writeHead(200, {'Content-Type': 'text/plain'});
          response.end("ok\n");
          ewd.systemMessageHandlers['EWD.exit']({
            source: 'http'
          });
          return;
          */
          postedData.task = 'exit';
        }
        if (postedData.task && ewd.mgrTaskHandlers[postedData.task]) {
          var json = ewd.mgrTaskHandlers[postedData.task](postedData, response);
          if (json) {
            response.writeHead(200, {'Content-Type': 'application/json'});
            response.write(JSON.stringify(json, null, 2));
            response.end();
          }
          return;
        }
        ewd.display404(response);
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
    if (ewd.traceLevel >= 1) ewd.log("Incoming HTTP request for: " + fileName, 1);
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
              if (ewd.traceLevel >= 2) ewd.log("etag = " + etag, 2);
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
        var postedData = queryString.parse(content);
        //var contentType;
        var urlObj = url.parse(request.url, true); 
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

        if (uri.substr(0,ewd.management.path.length)===ewd.management.path) {
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
      if (ewd.traceLevel >= 1) ewd.log("HTTPS is enabled; listening on port " + ewd.httpPort, 1);
      ewd.webserver = https.createServer(options, webserverCallback);
      // Start HTTP listening service for GT.M/Cache to use for WebSockets events
    }
    else {
      if (ewd.traceLevel >= 1) ewd.log("HTTP is enabled; listening on port " + ewd.httpPort, 1);
      var http = require("http");
      ewd.webserver = http.createServer(webserverCallback);
    }
    ewd.webserver.on('error', function(e) {
        console.log('**** Error reported by web server: ' + e.code + ': ' + e.message + ' *****');
        if (e.code === 'EADDRINUSE' || e.code === 'EACCES') {
          console.log("**** Probably unable to open WebServer Port (" + ewd.httpPort + "): already in use");
          console.log("or you do not have permissions to use it")
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
      if (ewd.traceLevel >= 1) ewd.log("New websocket connected: " + client.id, 1);
      if (ewd.socketClient[client.id]) {
        ewd.socketClient[client.id].connected = true;
        if (ewd.traceLevel >= 1) ewd.log("socketClient " + client.id + ": reconnected and re-registered", 1);
      }
      else {
        if (ewd.traceLevel >= 2) ewd.log("WebSocket client is new", 2);
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
        if (ewd.traceLevel >= 3) ewd.log('WebSocket message received from browser: ' + JSON.stringify(messageObj), 3);
        var type = messageObj.type;
        if (type === 'webSocketMessage') {
          if (ewd.traceLevel >= 2) ewd.log('*** Message received with type webSocketMessage, so ignored', 2);
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
            if (ewd.traceLevel >= 2) ewd.log('Token missing or invalid on incoming message from browser, so ignored', 2); 
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
        if (ewd.traceLevel >= 1) ewd.log("WebSocket disconnected: " + client.id, 1);
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
          if (ewd.traceLevel >= 2) ewd.log('cleared down socket client record for: ' + clientId, 2);
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
          if (ewd.traceLevel >= 3) ewd.log("Message received by external listener: " + data, 3);
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
      if (ewd.traceLevel >= 3) ewd.log('External Listener Port Disabled', 3);
    }
  },

  queue: [],
  queueByPid: {},
  queueEvent: new events.EventEmitter(),
  totalRequests: 0,
  maxQueueLength: 0,

  addToQueue: function(requestObj) {
    if (requestObj.type !== 'webServiceRequest' && requestObj.type !== 'getMemory' && !requestObj.ajax) {
      if (!requestObj.response) {
        if (ewd.traceLevel >= 3) ewd.log("addToQueue: " + JSON.stringify(requestObj, null, 2), 3);
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
    if (ewd.traceLevel > 0) ewd.sendToMonitor({type: 'queueInfo', qLength: qLength});
    if (qLength > this.maxQueueLength) this.maxQueueLength = qLength;
    if (requestObj.type !== 'webServiceRequest' && requestObj.type !== 'getMemory') {
      if (ewd.traceLevel >= 2) ewd.log('Request added to Queue: queue length = ' + qLength + '; requestNo = ' + this.totalRequests + '; after ' + this.elapsedTime(), 2);
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
          if (ewd.process[pid].isAvailable) {
            queuedRequest = ewd.queueByPid[pid].shift();
            ewd.process[pid].isAvailable = false;
            ewd.sendToMonitor({
              type: 'pidUpdate', 
              pid: pid, 
              noOfRequests: ewd.requestsByProcess[pid], 
              available: ewd.process[pid].isAvailable,
              debug: ewd.process[pid].debug
           });
           ewd.sendRequestToChildProcess(queuedRequest, pid);
          }
        }
      }

    pid = (ewd.queue.length !== 0);
    if (pid && ewd.traceLevel >= 3) ewd.log("processing queue; length " + ewd.queue.length + "; after " + ewd.elapsedTime(), 3);
    while (pid) {
      pid = ewd.getChildProcess();
      if (pid) {
        queuedRequest = ewd.queue.shift();
        ewd.sendRequestToChildProcess(queuedRequest, pid);
      }
      if (ewd.queue.length === 0) {
        pid = false;
        if (ewd.traceLevel >= 3) ewd.log("queue has been emptied", 3);
      }
    }
    queuedRequest = null;
    pid = null;
    if (ewd.queue.length > 0) {
      if (ewd.traceLevel >= 2) ewd.log("queue processing aborted: no free child proceses available", 2);
    }
  },

  sendRequestToChildProcess: function(queuedRequest, pid) {
    var type = queuedRequest.type;
    if (type === 'webServiceRequest' || queuedRequest.ajax) {
      ewd.process[pid].response = queuedRequest.response;
      delete queuedRequest.response;  // don't pass to child process but leave waiting on main process side
      if (queuedRequest.ajax) delete queuedRequest.ajax;
    }
    if (type === 'externalMessage') {
      ewd.process[pid].externalMessage = {
        message: queuedRequest.message,
        type: queuedRequest.messageType
      };
      delete queuedRequest.message;  // don't pass to child process but leave waiting on main process side
      delete queuedRequest.messageType;  // don't pass to child process but leave waiting on main process side
    }
    ewd.sendToMonitor({type: 'queueInfo', qLength: ewd.queue.length});
    //ewd.log("queuedRequest = " + JSON.stringify(queuedRequest), 3);
    if (queuedRequest.type !== 'getMemory') {
      if (ewd.traceLevel >= 3) ewd.log("dispatching request to " + pid + " at " + ewd.elapsedTime(), 3);
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
      childProcess.send(queuedRequest);
    }
    catch(err) {
      //Child process has become unavailable for some reason
      // remove it from the pool and put queuedRequest back on the queue
      ewd.poolSize--;
      delete ewd.process[pid];
      delete ewd.requestsByProcess[pid];
      delete ewd.queueByPid[pid];
      ewd.queue.push(queuedRequest);
      // start a new child process
      ewd.startChildProcess(999, false);
      ewd.poolSize++;
      return;
    }
    ewd.requestsByProcess[pid]++;
    ewd.sendToMonitor({
      type: 'pidUpdate', 
      pid: pid, 
      noOfRequests: ewd.requestsByProcess[pid], 
      available: ewd.process[pid].isAvailable,
      debug: ewd.process[pid].debug
    });
    childProcess = null;
    type = null;
  },

  getChildProcess: function() {
    var pid;
    // try to find a free child process, otherwise return false
    for (pid in ewd.process) {
      if (ewd.process[pid].isAvailable) {
        ewd.process[pid].isAvailable = false;
        ewd.sendToMonitor({
          type: 'pidUpdate', 
          pid: pid, 
          noOfRequests: ewd.requestsByProcess[pid], 
          available: ewd.process[pid].isAvailable,
          debug: ewd.process[pid].debug
        });
        return pid;
      }
    }
    return false;
  },

  mgrTaskHandlers: {
    about: function() {
      var json = {};
      json.overview = {
        nodeVersion: process.version,
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
        webservice: ewd.webservice
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
        poolSize: ewd.poolSize,
      };
      return json;
    },

    getChildProcesses: function() {
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
      procObj.queueLength = ewd.queue.length;
      return procObj;
    },

    startChildProcess: function(postedData) {
      var debug = postedData.debug || false;
      var pid = ewd.startChildProcess(999, debug);
      ewd.poolSize++;
      var messageObj = {};
      messageObj.pid = pid;
      if (postedData.debug) {
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

    stopChildProcess: function(postedData) {
      if (ewd.poolSize > 1) {
        var pid = postedData.pid;
        if (pid && ewd.process[pid]) {
          if (ewd.process[pid].isAvailable) {
            ewd.addToQueue({
              type: 'EWD.exit',
              pid: pid,
            });
            return {ok: pid + ' flagged to stop'};
          }
          else {
            // process is stuck, so force it down and release its resources
            ewd.process[pid].kill();
            delete ewd.process[pid];
            delete ewd.requestsByProcess[pid];
            delete ewd.queueByPid[pid];
            ewd.poolSize--;
            ewd.sendToMonitor({type: 'workerProcess', action: 'remove', pid: pid});
            if (ewd.traceLevel >= 1) ewd.log('process ' + pid + " was forced to shut down", 1);
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
          return {ok: pid + ' forced closed'};
        }
        else {
          return {error: 'Pid not defined or does not exist'};
        }
      }
      else {
        return {error: 'Poolsize must be 1 or greater'};
      }
    },

    exit: function() {
      var response = {};
      for (var pid in ewd.process) {
        response[pid] = ewd.mgrTaskHandlers.stopChildProcess({pid: pid});
      }
      setTimeout(function() {
        if (ewd.poolSize === 0) {
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
    },

    pingProcess: function(postedData, response) {
      var pid = postedData.pid;
      if (pid) {
        if (ewd.process[pid]) {
          if (ewd.process[pid].isAvailable) {
            var requestObj = {
              type:'EWD.pingProcess',
              pid: pid,
              response: response
            };
            ewd.addToQueue(requestObj);
            return false;
          }
          else {
            return {error: 'Child process ' + pid + ' is not available'};
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
      var pid = response.pid;
      ewd.sendToMonitor({type: 'workerProcess', action: 'remove', pid: pid});
      if (ewd.traceLevel >= 1) ewd.log('process ' + pid + " has been shut down", 1);
      ewd.poolSize--;
      delete ewd.process[pid];
      delete ewd.requestsByProcess[pid];
      delete ewd.queueByPid[pid];
      if (ewd.poolSize === 0) {
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
    firstChildInitialised: function(response) {
      console.log('First child process started.  Now starting the other processes....');
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
          webservice: ewd.webservice
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
          if (ewd.traceLevel >= 2) ewd.log("WebSocket client " + client.id + " registered with token " + response.token, 2);
        }
      }
    },
    'EWD.reconnect': function(response) {
      if (response.reconnect) {
        //console.log('*** reconnect using token ' + response.token + ' ****');
      }
    },
    log: function(response) {
      ewd.logToBrowser(response.message);
      response = null;
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
    wsMessage: function(response) {
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
        /*
        else {
          // token is no longer linked to a web socket, so delete the EWD Session
          ewd.addToQueue({
            type: 'EWD.deleteSessionByToken',
            token: response.token
          });
        }
        */
      }
      response = null;
    },
    getMemory: function(response) {
      ewd.sendToMonitor({type: 'childProcessMemory', results: response, interval: ewd.monitorInterval});
      response = null;
    },
    error: function(response) {
      if (ewd.process[response.pid].response) {
        ewd.childProcessMessageHandlers.webServiceRequest(response);
        return;
      }
      if (ewd.traceLevel >= 1) ewd.log('** Error returned from Child Process ' + response.pid + ': ' + response.error, 1);
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
        delete ewd.socketClient[clientId];
        delete ewd.socketClientByToken[response.token];
        if (ewd.traceLevel >= 3) ewd.log('SocketClient record for ' + clientId + ' deleted', 3);
        // stop logging stats if no instances of ewdMonitor running
        var client;
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
      if (response.messageType.indexOf('EWD.form.') !== -1) {
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
          if (ewd.traceLevel >= 2) ewd.log('**** Error in webSocketMessage handler for child_process responses - client ' + clientId + ' unavailable', 2);
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
        else {
          var header = {
            'Date': new Date().toUTCString(),
            'Content-Type': 'application/json'
          };
          response.writeHead(200, header);
          response.write(JSON.stringify(responseObj.json));
          response.end();
          header = null;
        }
        delete ewd.process[responseObj.pid].response;
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
          ewd_password: ewd.management.password
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
      if (ewd.systemMessageHandlers[messageObj.messageType]) {
        var messageType = messageObj.messageType;
        if (messageType === 'EWD.getFragment' || messageType === 'EWD.logout') messageObj.password = ewd.management.password;
        // check security first - password must be present and correct
        if (messageObj.password && messageObj.password === ewd.management.password) {
          ewd.systemMessageHandlers[messageType](messageObj, client);
        }
        else {
          // ignore this message
          if (ewd.traceLevel >= 2) ewd.log('An incoming system message was ignored as it did not have a valid password', 2);
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
        var type = messageObj.pingType || 'EWD.ping0';
        var noOfMessages = messageObj.noOfMessages || 100;
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
            clientId: client.id
          });
        }
      }
    },
    'EWD.exit': function(messageObj, client) {
      messageObj.type = 'EWD.exit';
      delete messageObj.messageType;
      for (var i = 0; i < ewd.poolSize; i++) {
        ewd.addToQueue(messageObj);
      }
    },
    'EWD.startConsole': function(messageObj, client) {
      //console.log('EWD.startConsole - ewd.runningStats = ' + ewd.runningStats);
      if (!ewd.statsEvent) {
        ewd.statsEvent = setTimeout(ewd.getStats, ewd.monitorInterval);
      }
      client.json.send({
        type:'processInfo', 
        data: {
          nodeVersion: process.version,
          masterProcess: process.pid,
          childProcesses: ewd.getChildProcesses(),
          build: ewd.buildNo + " (" + ewd.buildDate + ")",
          started: ewd.started,
          uptime: ewd.elapsedTime(),
          interval: ewd.monitorInterval,
          traceLevel: ewd.traceLevel,
          logTo: ewd.logTo,
          logFile: ewd.logFile
        }
      });
    },
    'EWD.getFragment': function(messageObj, client) {
      var application = client.application;
      if (!application) return;
      var fragPath = ewd.webServerRootPath + '/ewd/' + application + '/' + messageObj.params.file;
      if (messageObj.params.isServiceFragment) {
        fragPath = ewd.webServerRootPath + '/services/' + messageObj.params.file;
      };

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
          }
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
    'EWD.workerProcess': function(messageObj, client) {
      if (messageObj.action === 'add') {
        var pid = ewd.startChildProcess(999, messageObj.debug);
        ewd.poolSize++;
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
      if (ewd.poolSize > 1) {
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
            ewd.poolSize--;
            ewd.sendToMonitor({type: 'workerProcess', action: 'remove', pid: pid});
            if (ewd.traceLevel >= 1) ewd.log('process ' + pid + " was forced to shut down", 1);
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
    'EWD.setParameter': function(messageObj, client) {
      if (messageObj.name === 'monitorLevel') {
        ewd.traceLevel = messageObj.value;
        ewd.io.set('log level', 0);
        if ((!ewd.silentStart)&&(messageObj.value > 0)) ewd.io.set('log level', 1);
      }
      if (messageObj.name === 'logTo') {
        ewd.logTo = messageObj.value;
        if (messageObj.value === 'file') ewd.log('ewd.js: Starting Log to File at ' + new Date().toUTCString(), ewd.traceLevel, true);
      }
      if (messageObj.name === 'clearLogFile') {
        ewd.log('ewd.js: Starting Log to File at ' + new Date().toUTCString(), ewd.traceLevel, true);
      }
      if (messageObj.name === 'changeLogFile') {
        ewd.logFile = messageObj.value;
        ewd.log('ewd.js: Starting Log to File at ' + new Date().toUTCString(), ewd.traceLevel, true);
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
        poolSize: ewd.poolSize,
        startParams: {
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
          management: ewd.management,
          modulePath: ewd.modulePath,
          homePath: path.resolve('../'),
          debug: ewd.debug,
          webservice: ewd.webservice
        }
      };
      client.json.send(msgObj);
    },
    'EWD.resetPassword': function(messageObj, client) {
      if (messageObj.value !== '') {
        ewd.management.password = messageObj.value;
        ewd.addToQueue({
          type: 'EWD.resetPassword',
          password: messageObj.value
        });
        client.json.send({
          type: 'EWD.resetPassword',
          error: false,
          password: messageObj.value
        });
      }
      else {
        client.json.send({
          type: 'EWD.resetPassword',
          error: true,
          message: 'Empty string'
        });
      }
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
    ewd.defaults(params);

    ewd.queueEvent.on("processQueue", ewd.processQueue);
	
    console.log('   ');
    console.log('********************************************');
    console.log('**** EWD.js Build ' + ewd.buildNo + ' (' + ewd.buildDate + ') *******');
    console.log('********************************************');
    console.log('  ');
    console.log('Started: ' + ewd.started);
    console.log('Master process: ' + process.pid);
    console.log(ewd.poolSize + ' child Node processes will be started...');

    // start child processes which, in turn, starts web server
    ewd.startChildProcess(0, ewd.debug.enabled);

    if (callback) callback(ewd);

  }
};


