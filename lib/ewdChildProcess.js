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

  Build 81; 15 May 2015

*/

var fs = require('fs');
var os = require('os');
var events = require('events');
var crypto = require('crypto');
var util = require('util');
var uuid = require('node-uuid');
var se = require('speakeasy');
var ntp = require('ntp-client');
var domain = require('domain');

var mumps;
var database;
var mongo;
var mongoDB;

// This set of utility functions will be made available via ewd.util

var EWD = {
  hSeconds: function(date) {
    // get [current] time in seconds, adjusted to Mumps $h time
    if (date) {
      date = new Date(date);
    }
    else {
      date = new Date();
    }
    var secs = Math.floor(date.getTime()/1000);
    var offset = date.getTimezoneOffset()*60;
    var hSecs = secs - offset + 4070908800;
    return hSecs;
  },
  hDate: function(date) {
    var hSecs = EWD.hSeconds(date);
    var days = Math.floor(hSecs / 86400);
    var secs = hSecs % 86400;
    return days + ',' + secs;
  },
  getDateFromhSeconds: function(hSecs) {
    var sec = hSecs - 4070908800;
    return new Date(sec * 1000).toString();
  },
  getElapsedMs: function(timingObj) {
    if (timingObj) {
      var elapsed = process.hrtime(timingObj.start);
      return (elapsed[0] * 1000000) + (elapsed[1] / 1000);
    }
    return 0;
  },
  getSessid: function(token) {
    var node = {global: '%zewdSession', subscripts: ['tokens', token]}; 
    var sessid = database.get(node).data;
    if (!sessid) return '';
    return sessid.split('~')[0];
  },
  getMemory: function() {
    var mem = process.memoryUsage();
    var memory = {
      rss: (mem.rss /1024 /1024).toFixed(2),
      heapTotal: (mem.heapTotal /1024 /1024).toFixed(2), 
      heapUsed: (mem.heapUsed /1024 /1024).toFixed(2)
    };
    var zewd = new mumps.GlobalNode('zewd', ['ewdjs', ewdChild.httpPort, 'memoryUsage', process.pid]);
    zewd._setDocument(memory, true);
    memory.pid = process.pid;
    memory.modules = ewdChild.module;
    zewd = null;
    return memory;
  },
  isTokenExpired: function(token) {
    var sessid = this.getSessid(token);
    if (sessid === '') return true;
    var node = {global: '%zewdSession', subscripts: ['session', sessid, 'ewd_sessionExpiry']}; 
    var expiry = +database.get(node).data;
    token = null;
    sessid = null;
    if (expiry === '') return true;
    var now = Math.floor(new Date().getTime()/1000);
    //if (expiry > this.hSeconds()) return false;
    if (expiry > now) return false;
    return true;
  },
  createNewSession: function(application, timeout) {
    var node = {global: '%zewd', subscripts: ['nextSessid']};
    var sessid = database.increment(node).data;
    node = {global: '%zewdSession', subscripts: ['session', sessid]};
    database.kill(node);

    var token = EWD.createToken();
    var now = Math.floor(new Date().getTime()/1000);
    //var now = EWD.hSeconds();
    if (!timeout) timeout = 3600;
    var expiry = now + timeout;
    var params = {
      ewd_token: token,
      ewd_sessid: sessid,
      ewd_sessionTimeout: timeout,
      ewd_sessionExpiry: expiry,
      ewd_appName: application,
      ewd_lite: 1
    };
    for (var name in params) {
      node = {global: '%zewdSession', subscripts: ['session', sessid, name], data: params[name]};
      database.set(node);
    }
    EWD.sendMessageToAppUsers({
      type: 'newSession',
      appName: 'ewdMonitor',
      content: {
        sessid: sessid,
        appName: application,
        // thanks to Ward DeBacker for this bug-fix:
        //expiry: new Date((expiry - 4070908800) * 1000).toUTCString()
        expiry: new Date(expiry * 1000).toUTCString()
      }
    });

    node = {global: '%zewdSession', subscripts: ['tokensBySession', sessid, token], data: ''};
    database.set(node);
    var data = sessid + '~' + now + '~' + expiry + '~dummy';
    node = {global: '%zewdSession', subscripts: ['tokens', token], data: data};
    database.set(node);
    return new mumps.GlobalNode('%zewdSession', ['session', sessid]);
  },
  getSession: function(token) {
    //if (ewdChild.timing) ewdChild.timing.startGetSession = EWD.getElapsedMs(ewdChild.timing);
    var now = new Date().getTime();
    var sessid;
    if (ewdChild.sessionCache.tokenExists(token)) {
      sessid = ewdChild.sessionCache.getSessid(token);
      var cachedTime = ewdChild.sessionCache.bySessid[sessid].time;
      if ((now - cachedTime) < 250) {
        return ewdChild.sessionCache.bySessid[sessid].session;
      }
    }
    //console.log('not using session cache');
    if (this.isTokenExpired(token)) {
      ewdChild.sessionCache.deleteByToken(token);
      return '';
    }
    else {
      //if (ewdChild.timing) ewdChild.timing.tokenExpiryChecked = EWD.getElapsedMs(ewdChild.timing);
      sessid = this.getSessid(token);
      //if (ewdChild.timing) ewdChild.timing.gotSessid = EWD.getElapsedMs(ewdChild.timing);
      var ewdSession = new mumps.GlobalNode('%zewdSession',['session',sessid]);
      //if (ewdChild.timing) ewdChild.timing.ewdSessionNodeCreated = EWD.getElapsedMs(ewdChild.timing);
      ewdSession.sessid = database.get({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_sessid']}).data;
      ewdSession.app = database.get({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_appName']}).data;
      ewdSession.page = database.get({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_pageName']}).data;
      Object.defineProperty(ewdSession, 'isAuthenticated', {
        get: function() {
          return (+database.get({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_authenticated']}).data === 1);
        }
      });
      //if (ewdChild.timing) ewdChild.timing.beforeAuthenticatedFn = EWD.getElapsedMs(ewdChild.timing);
      ewdSession.setAuthenticated = function(authenticated) {
        // modification suggested by Ward De Backer, 21 June 2014
        if (typeof authenticated === 'undefined') authenticated = true;
        var data = 0;
        if (authenticated) data = 1;
        database.set({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_authenticated'], data: data});
        ewdChild.sessionCache.deleteBySessid(sessid);
      };
      //if (ewdChild.timing) ewdChild.timing.endGetSession = EWD.getElapsedMs(ewdChild.timing);
      // Cache the last session handled by this child process
      ewdChild.sessionCache.add(sessid, token, ewdSession);
      if (!ewdChild.sessionCache.GCEvent) ewdChild.sessionCache.garbageCollect();
      return ewdSession;
    }
  },
  updateSessionExpiry: function(session) {
    //var now = EWD.hSeconds();
    var now = Math.floor(new Date().getTime()/1000);
    var sessid = session.sessid;
    var timeout = +database.get({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_sessionTimeout']}).data;
    var savedExpiry = database.get({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_sessionExpiry']}).data;
    var expiry = now + timeout;
    if ((expiry - savedExpiry) > 0) {
      database.set({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_sessionExpiry'], data: expiry});
    }
  }, 
  getRequest: function(ewdSession) {
    return new mumps.GlobalNode("%zewdSession",['request',ewdSession.sessid]);
  },
  getServer: function(ewdSession) {
    return new mumps.GlobalNode("%zewdSession",['server',ewdSession.sessid]);
  },
  createToken: function() {
    return uuid.v4();
    /*
    var result = [];
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
    var tokenLength = 63;
    while (--tokenLength) {
      result.push(chars.charAt(Math.floor(Math.random() * chars.length)));
    }
    return result.join('');
    */
  },
  deleteExpiredSessions: function() {
    var node = {global: '%zewdSession', subscripts: ['session', '']};
    var sessid;
    var expiryNode;
    var expiry;
    var now = Math.floor(new Date().getTime()/1000);
    do {
      node = database.order(node);
      sessid = node.result || '';
      if (sessid !== '') {
        expiryNode = {global: '%zewdSession', subscripts: ['session', sessid, 'ewd_sessionExpiry']};
        expiry = database.get(expiryNode).data;
        if (expiry === '' || expiry < now) {
          EWD.deleteSession(sessid);
        }
      }
    }
    while (sessid !== '');
  },
  deleteSession: function(sessid) {
    var token;
    var node = {global: '%zewdSession', subscripts: ['session', sessid, 'ewd_wstoken']};
    token = database.get(node).data;
    if (token !== '') {
      process.send({
        pid: process.pid,
        type: 'deleteSocketClient',
        token: token
      });
      ewdChild.sessionCache.deleteByToken(token);
    }
    node = {global: '%zewdSession', subscripts: ['tokensBySession', sessid, '']};
    var tokensNode;
    var xsessid;
    do {
      node = database.order(node);
      token = node.result || '';
      if (token !== '') {
        tokensNode = {global: '%zewdSession', subscripts: ['tokens', token]};
        xsessid = database.get(tokensNode).data;
        if (xsessid !== '') {
          xsessid = xsessid.split('~')[0];
          if (xsessid !== '') database.kill(tokensNode);
        }
      }
    }
    while (token !== '');

    node = {global: '%zewdSession', subscripts: ['tokensBySession', sessid]};
    database.kill(node);
    node = {global: '%zewdSession', subscripts: ['session', sessid]};
    database.kill(node);
    node = {global: '%zewdSession', subscripts: ['nextPageTokens', sessid]};
    database.kill(node);
    node = {global: '%zewdSession', subscripts: ['action', sessid]};
    database.kill(node);
    node = {global: '%zewdSession', subscripts: ['jsonAccess', sessid]};
    database.kill(node);
    node = {global: '%zewdSession', subscripts: ['server', sessid]};
    database.kill(node);
    node = {global: '%zewdSession', subscripts: ['request', sessid]};
    database.kill(node);
    EWD.sendMessageToAppUsers({
      type: 'sessionDeleted',
      appName: 'ewdMonitor',
      content: {
        sessid: sessid
      }
    });
  },
  sendMessageToAppUsers: function(params) {
    /*
    var sessions = new mumps.GlobalNode('%zewdSession',['session']);
    sessions._forEach(function(sessid, session) {
      if (session.$('ewd_appName')._value === params.appName) {
        process.send({
          pid: process.pid,
          type: 'wsMessage',
          token: session.$('ewd_wstoken')._value,
          content: {
            type: params.type,
            json: params.content
          }
        });
      }
    });
    */
    process.send({
      pid: process.pid,
      type: 'sendMsgToAppUsers',
      appName: params.appName,
      content: {
        type: params.type,
        json: params.content
      }   
    });
  },
  msgRcvd: new events.EventEmitter(),
  sendWebSocketMsg: function(session, content) {
    var token;
    if (typeof content.token !== 'undefined') {
      token = content.token;
      delete content.token;
    }
    else {
      token = session.$('ewd_wstoken')._value;
    }
    var release = false;
    if (content.release) {
      release = true;
      delete content.release;
    }
    if (content.finished) {
      release = true;
      delete content.finished;
    }
    var message = {
      pid: process.pid,
      type: 'wsMessage',
      token: token,
      content: content
    };
    if (release) message.release = true;
    process.send(message);
  },
  releaseChildProcess: function(session) {
    // silently releases the child process
    EWD.sendWebSocketMsg(session, {
      type: 'ewd.releaseChildProcess',
      finished: true
    });
  },
  sendWebServiceResponse: function(json) {
    process.send({
      type: 'webServiceRequest',
      pid: process.pid,
      json: json,
      release: true
    });
  },
  sendMessageByToken: function(token, type, json) {
    process.send({
      pid: process.pid,
      type: 'wsMessage',
      token: token,
      content: {
        type: type,
        json: json
      }
    });
  },
  escape: function(string, encode) {
    if (encode === "escape") {
      var unreserved = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~';
      var escString = '';
      var c;
      var hex;
      for (var i=0; i< string.length; i++) {
        c = string.charAt(i);
        if (unreserved.indexOf(c) !== -1) {
          escString = escString + c;
        }
        else {
          hex = string.charCodeAt(i).toString(16).toUpperCase();
          //console.log(string + "; c=" + c + "; hex = " + hex);
          if (hex.length === 1) hex = '0' + hex;
          escString = escString + '%' + hex;
        }
      }
      return escString;
    }
    else {
      var enc = encodeURIComponent(string);
      return enc.replace(/\*/g, "%2A").replace(/\'/g, "%27").replace(/\!/g, "%21").replace(/\(/g, "%28").replace(/\)/g, "%29");
    }
  },
  invokeWrapperFunction: function(functionName, ewd) {
    delete ewd.query.signature;
    delete ewd.query.timestamp;
    delete ewd.query.accessId;
    var scratch = new ewd.mumps.GlobalNode('%zewdTemp', [process.pid]);
    scratch._delete();
    scratch.$('inputs')._setDocument(ewd.query, true);
    var result = ewd.mumps.function(functionName, process.pid);
    //console.log('***** invokeWrapperFunction: result = ' + result);
    if (result === '') {
      var outputs = scratch.$('outputs')._getDocument();
      scratch._delete();
      return {error: false, results: outputs};
    }
    else {
      return {error: result};
    }
  },
  requireAndWatch: function(path, moduleName) {
    if (!moduleName) {
      moduleName = path;
      path = ewdChild.getModulePath(moduleName);
    }
    var module = false;
    try {
      module = require(path);
      if (moduleName) ewdChild.module[moduleName] = module;
      if (module && module.services && moduleName) {
        var list = module.services();
        ewdChild.services[moduleName] = {};
        var services = ewdChild.services[moduleName];
        for (var i = 0; i < list.length; i++) {
          services[list[i]] = {};
        }
      }
      if (ewdChild.traceLevel >= 3) console.log("requireAndWatch: " + path + " loaded by process " + process.pid);
      var watchPath = require.resolve(path);
      (function(watchPath, path, moduleName) {
        fs.watch(watchPath, function(event, filename) {
          if (ewdChild.traceLevel >= 3) console.log(filename + ' has changed - event = ' + event + '; process: ' + process.pid);
          if (event === 'change') {
            try {
              //console.log('resolving path ' + path);
              var modulePath = require.resolve(path);
              //console.log('modulePath: ' + modulePath + '; moduleName: ' + moduleName);
              delete require.cache[modulePath];
              var module = require(path);
              if (moduleName) ewdChild.module[moduleName] = module;
              if (module && module.services && moduleName) ewdChild.services[moduleName] = module.services();
              if (!module) console.log('require failed');
              if (ewdChild.traceLevel >= 3) console.log(path + " reloaded successfully");
            }
            catch (err) {
              if (ewdChild.traceLevel >= 3) console.log(path + " could not be reloaded: " + JSON.stringify(err));
            }
          }
        });
      }(watchPath, path, moduleName));
    }
    catch(err) {
      if (ewdChild.traceLevel >= 2) console.log("Error in requireAndWatch - " + path + " could not be loaded");
    }
    return module;
  },
  googleAuthenticator: {
    checkCode: function(enteredCode, key, callback) {
      ntp.getNetworkTime(ewdChild.ntp.host, ewdChild.ntp.port, function(err, date) {
        if (err) {
          if (callback) callback({error: err});
        }
        else {
          var code = se.time({
            key: key, 
            time: date.getTime()/1000, 
            encoding: 'base32'
          });
          var match = false;
          if (code.toString() === enteredCode.toString()) match = true;
          if (callback) callback({match: match});
        }
      });
    },
    generateKey: function(appName, length) {
      return se.generate_key({
        length: length || 20,
        google_auth_qr: true,
        name: appName || 'Not_Defined'
      });
    }
  }
};

var ewdChild = {
  log: function(message) {
    console.log(message);
  },
  Custom: false,
  module: {},
  services: {},
  getModulePath: function(application) {
    var path = ewdChild.modulePath;
    var lchar = path.slice(-1);
    if (lchar === '/' || lchar === '\\') {
      path = path.slice(0,-1);
    }
    var delim = '/';
    if (process.platform === 'win32') delim = '\\';
    //path = path + delim + application + '.js';
    path = path + delim + application;
    return path;
  },

  createStringToSign: function(requestObj, includePort) {
    var stringToSign;
    var name;
    var amp = '';
    var value;
    var keys = [];
    var index = 0;
    var pieces;
    var host = requestObj.host;
    if (!includePort) { 
      if (host.indexOf(":") !== -1) {
        pieces = host.split(":");
        host = pieces[0];
      }
    }
    var url = requestObj.uri;
    var method = 'GET';
    stringToSign = method + '\n' + host + '\n' + url + '\n';
    for (name in requestObj.query) {
      if (name !== 'signature') {
        keys[index] = name;
        index++;
      }
    }
    keys.sort();
    for (var i=0; i < keys.length; i++) {
      name = keys[i];
      value = requestObj.query[name];
      //console.log("name = " + name + "; value = " + value);
      stringToSign = stringToSign + amp + EWD.escape(name, 'uri') + '=' + EWD.escape(value, 'uri');
      amp = '&';
    }
    return stringToSign;
  },
  digest: function(string, key, type) {
    // type = sha1|sha256|sha512
    var hmac = crypto.createHmac(type, key.toString());
    hmac.update(string);
    return hmac.digest('base64');
  },
  sessionCache: {
    byToken: {},
    bySessid: {},
    add: function(sessid, token, ewdSession) {
      ewdChild.sessionCache.bySessid[sessid] = {
        session: ewdSession,
        token: token,
        time: new Date().getTime()
      };
      ewdChild.sessionCache.byToken[token] = sessid;
    },
    deleteBySessid: function(sessid) {
      if (sessid && ewdChild.sessionCache.bySessid[sessid]) {
        var token = ewdChild.sessionCache.bySessid[sessid].token;
        delete ewdChild.sessionCache.bySessid[sessid];
        delete ewdChild.sessionCache.byToken[token];
      }
    },
    deleteByToken: function(token) {
      if (token && ewdChild.sessionCache.byToken[token]) {
        var sessid = ewdChild.sessionCache.byToken[token];
        delete ewdChild.sessionCache.bySessid[sessid];
        delete ewdChild.sessionCache.byToken[token];
      }
    },
    getSessid: function(token) {
      return ewdChild.sessionCache.byToken[token];
    },
    getToken: function(sessid) {
      return ewdChild.sessionCache.bySessid[sessid];
    },
    sessidExists: function(sessid) {
      return (typeof ewdChild.sessionCache.bySessid[sessid] !== 'undefined');
    },
    tokenExists: function(token) {
      return (typeof ewdChild.sessionCache.byToken[token] !== 'undefined');
    },
    clearDown: function() {
      var now = new Date().getTime();
      var sessionCache = ewdChild.sessionCache.bySessid;
      for (var sessid in sessionCache) {
        if ((now - sessionCache[sessid].time) > 1000) {
          ewdChild.sessionCache.deleteBySessid(sessid);
        }
      }
    },
    GCEvent: false,
    garbageCollect: function() {
      ewdChild.sessionCache.clearDown();
      ewdChild.sessionCache.GCEvent = setTimeout(function() {
        ewdChild.sessionCache.garbageCollect();
      },300000);
    }
  },
  password: {
    matches: function(fromUser, credentials) {
      var iterations = 10000;
      var keyLength = 64;
      var salt = new Buffer(credentials.salt, 'base64');
      var encrypted = crypto.pbkdf2Sync(fromUser, salt, iterations, keyLength);
      encrypted = encrypted.toString('base64');
      if (credentials.hash === encrypted) return true;
      return false;
    }
  },

  errorResponse: function() {
    return {
      type: 'webServiceRequest',
      json: {
        error: 'Authentication failed'
      },
      pid: process.pid,
      release: true
    };
  },

  authenticate: function(messageObj) {
    if (!messageObj.token || messageObj.token === '') return ewdChild.errorResponse();
    var session = EWD.getSession(messageObj.token);
    if (session === '') return ewdChild.errorResponse();
    return {
      type: 'webServiceRequest',
      mgr: messageObj.type,
      params: messageObj.params,
      pid: process.pid,
      release: true
    };
  },

  messageHandlers: {

    // handlers for incoming messages, by type

    initialise: function(messageObj) {
      var params = messageObj.params;
      // initialising this worker process
      ewdChild.httpPort = params.httpPort;
      if (ewdChild.traceLevel >= 3) console.log(process.pid + " initialise: params = " + JSON.stringify(params));
      ewdChild.ewdGlobalsPath = params.ewdGlobalsPath;
      ewdChild.nodePath = params.nodePath;
      ewdChild.logTo = params.logTo;
      ewdChild.logFile = params.logFile;
      ewdChild.startTime = params.startTime;
      ewdChild.database = params.database;
      ewdChild.webSockets = params.webSockets;
      ewdChild.traceLevel = params.traceLevel;
      ewdChild.logToBrowser = params.logToBrowser;
      ewdChild.webServerRootPath = params.webServerRootPath;
      ewdChild.management = params.management;
      ewdChild.lite = params.lite;
      ewdChild.homePath = params.homePath;
      ewdChild.webservice = params.webservice;
      var hNow = params.hNow;
      ewdChild.modulePath = params.modulePath;
      ewdChild.ntp = params.ntp;
      mumps = require(ewdChild.ewdGlobalsPath);
      if (ewdChild.database.type === 'mongodb') ewdChild.database.nodePath = 'mongoGlobals';
      var globals;
      try {
        globals = require(ewdChild.database.nodePath);
      }
      catch(err) {
        console.log("**** ERROR: The database gateway module " + ewdChild.database.nodePath + ".node could not be found or loaded");
        console.log(err);
        process.send({
          pid: process.pid, 
          type: 'firstChildInitialisationError'
        });
        return;
      }
      var dbStatus;
      if (ewdChild.database.type === 'cache') {
        database = new globals.Cache();
        dbStatus = database.open(ewdChild.database);
        if (dbStatus.ErrorMessage) {
          console.log("*** ERROR: Database could not be opened: " + dbStatus.ErrorMessage);
          if (dbStatus.ErrorMessage.indexOf('unexpected error') !== -1) {
            console.log('It may be due to file privileges - try starting using sudo');
          }
          else if (dbStatus.ErrorMessage.indexOf('Access Denied') !== -1) {
            console.log('It may be because the Callin Interface Service has not been activated');
            console.log('Check the System Management Portal: System - Security Management - Services - %Service Callin');
          }
          process.send({
            pid: process.pid, 
            type: 'firstChildInitialisationError'
          });
          return;
        }
      }
      else if (ewdChild.database.type === 'gtm') {
        database = new globals.Gtm();
        dbStatus = database.open();
        if (dbStatus && dbStatus.ok !== 1) console.log("**** dbStatus: " + JSON.stringify(dbStatus));
        ewdChild.database.namespace = '';
        var node = {global: '%zewd', subscripts: ['nextSessid']}; 
        var test = database.get(node);
        if (test.ok === 0) {
          console.log('*** ERROR: Global access test failed: Code ' + test.errorCode + '; ' + test.errorMessage);
          if (test.errorMessage.indexOf('GTMCI') !== -1) {
            console.log('***');
            console.log('*** Did you start EWD.js using "node ewdStart-gtm gtm-config"? ***');
            console.log('***');
          } 
          process.send({
            pid: process.pid, 

            type: 'firstChildInitialisationError'
          });
          return;
        }
      }
      else if (ewdChild.database.type === 'mongodb') {
        mongo = require('mongo');
        mongoDB = new mongo.Mongo();
        database = new globals.Mongo();
        dbStatus = database.open(mongoDB, {address: ewdChild.database.address, port: ewdChild.database.port});
        ewdChild.database.namespace = '';
      }
      if (ewdChild.database.also && ewdChild.database.also.length > 0) {
        if (ewdChild.database.also[0] === 'mongodb') {
          mongo = require('mongo');
          mongoDB = new mongo.Mongo();
          mongoDB.open({address: ewdChild.database.address, port: ewdChild.database.port});
        }
      }
      mumps.init(database);

      // ********************** Load Global Indexer *******************
      try {
        //var path = ewdChild.getModulePath('globalIndexer');
        //var indexer = EWD.requireAndWatch(path);
        var indexer = EWD.requireAndWatch('globalIndexer');
        indexer.start(mumps);
        if (ewdChild.traceLevel >= 2) console.log("** Global Indexer loaded: " + path);
      }
      catch(err) {}
      // ********************************************************
  
      var zewd = new mumps.GlobalNode('zewd', ['ewdjs', ewdChild.httpPort]);
      
      if (params.no === 0) {
        // first child process that is started clears down persistent stored EWD.js data
        console.log("First child process (' + process.pid + ') initialising database...");
        //var funcObj;
        //var resultObj;
        var pczewd = new mumps.Global('%zewd');
        pczewd.$('relink')._delete();
        pczewd = null;
  
        zewd._delete();
        /*
        if (typeof params.management.password !== 'undefined') {
          zewd.$('management').$('password')._value = params.management.password;
          zewd.management.$('path')._value = params.management.path;
          //console.log('management password saved');
        }
        */
        process.send({
          pid: process.pid, 
          type: 'firstChildInitialised',
          interface: mumps.version()
        });
      }
      //var mem = EWD.getMemory();
      //console.log('memory: ' + JSON.stringify(mem, null, 2));
      zewd.$('processes').$(process.pid)._value = EWD.getDateFromhSeconds(hNow);
      //console.log('hNow set for ' + process.pid + ': ' + hNow);
      zewd = null;
      /*
        *** Load Custom Module if defined
      */
      if (params.customModule) {
        var custom = EWD.requireAndWatch(params.customModule);
        if (custom.onReady) {
          ewdChild.Custom = custom.onReady();
        }
        if (custom.onExit) ewdChild.Custom.onExit = custom.onExit;
      }

    },
    //  ** end of initialise function

    'EWD.exit': function(messageObj) {
      clearTimeout(ewdChild.sessionCache.GCEvent);
      setTimeout(function() {
        process.exit(1);
      },500);
      return {pid: process.pid, type: 'EWD.exit'};
    },

    sessionGC: function(messageObj) {
      EWD.deleteExpiredSessions();
    },

    getMemory: function(messageObj) {
      messageObj = null;
      return EWD.getMemory();
    },

    'EWD.ping0': function(messageObj) {
      return {
        no: messageObj.no,
        time: new Date().getTime(),
        token: messageObj.token
      };
    },

    'EWD.register': function(messageObj) {
      var node = {global: '%zewd', subscripts: ['nextSessid']};
      var sessid = database.increment(node).data;
      node = {global: '%zewdSession', subscripts: ['session', sessid]};
      database.kill(node);

      /*
      var sessionCounter = new mumps.GlobalNode('%zewd', ['nextSessid']);
      var sessid = sessionCounter._increment();
      var session = new mumps.GlobalNode('%zewdSession', ['session', sessid]);
      session._delete();
      */

      var token = EWD.createToken();
      //var now = EWD.hSeconds();
      var now = Math.floor(new Date().getTime()/1000);
      var timeout = messageObj.application.timeout || 3600;
      var expiry = now + timeout;
      var application = {name: 'undefined'};
      if (messageObj.application && messageObj.application.name) application = messageObj.application;
      var params = {
        ewd_token: token,
        ewd_wstoken: token,
        ewd_sessid: sessid,
        ewd_sessionTimeout: timeout,
        ewd_sessionExpiry: expiry,
        ewd_appName: application.name,
        ewd_authenticated: 0,
        //ewd_password: ewdChild.management.password,
        //ewd_password: messageObj.ewd_password,
        ewd_clientId: messageObj.ewd_clientId
      };
      for (var name in params) {
        node = {global: '%zewdSession', subscripts: ['session', sessid, name], data: params[name]};
        database.set(node);
      }
      //session._setDocument(params);    

      EWD.sendMessageToAppUsers({
        type: 'newSession', 
        content: {
          sessid: sessid,
          appName: application.name,
          // thanks to Ward DeBacker for this bug-fix
          //expiry: new Date((expiry - 4070908800) * 1000).toUTCString()
          expiry: new Date(expiry * 1000).toUTCString()
        }, 
        appName: 'ewdMonitor'
      });

      node = {global: '%zewdSession', subscripts: ['tokensBySession', sessid, token], data: ''};
      database.set(node);
      var data = sessid + '~' + now + '~' + expiry + '~dummy';
      node = {global: '%zewdSession', subscripts: ['tokens', token], data: data};
      database.set(node);

      /*
      var tokensBySession = new mumps.GlobalNode('%zewdSession', ['tokensBySession', sessid]);
      tokensBySession.$(token)._value = '';
      var tokens = new mumps.GlobalNode('%zewdSession', ['tokens']);
      tokens.$(token)._value = sessid + '~' + now + '~' + expiry + '~dummy';
      */
      return {sessid: sessid, token: token, application: application.name};
    },

    'EWD.getPrivateFile': function(messageObj, session) {
      if (session.$('ewd_privateFiles').$(messageObj.path)._exists) {
        return {
          url: '/privateFiles/' + session.$('ewd_wstoken')._value,
          path: messageObj.path
        };
      }
      else {
        return {error: 'access to file not permitted'};
      }
    },

    'EWD.reconnect': function(messageObj) {
      var node = {global: '%zewdSession', subscripts: ['session', '']};
      var sessid;
      var xNode;
      var token;
      var clientId;
      do {
        node = database.order(node);
        sessid = node.result || '';
        if (sessid !== '') {
          xNode = {global: '%zewdSession', subscripts: ['session', sessid, 'ewd_wstoken']};
          token = database.get(xNode).data;
          if (token && token !== '' && !EWD.isTokenExpired(token)) {
            xNode = {global: '%zewdSession', subscripts: ['session', sessid, 'ewd_clientId']};
            clientId = database.get(xNode).data;
            if (messageObj['client.id'] === clientId) {
              return {
                reconnect: true,
                token: token
              };
            }
          } 
        }
      }
      while (sessid !== '');
      /*
      var sessions = new mumps.GlobalNode('%zewdSession',['session']);
      sessions._forEach(function(sessid, session) {
        var token = session.$('ewd_wstoken')._value;
        if (token && !EWD.isTokenExpired(token)) {
          //console.log('clientid in message: ' + messageObj['client.id'] + '; in session: ' + session.$('ewd_clientId')._value);
          if (messageObj['client.id'] === session.$('ewd_clientId')._value) {
            //console.log('client id match!');
            return {
              reconnect: true,
              token: token
            };
          } 
        }
      });
      */
      return {reconnect: false};
    },

    /*
    'EWD.resetPassword': function(messageObj) {
      var zewd = new mumps.GlobalNode('zewd', ['ewdjs', ewdChild.httpPort]);
      zewd.$('management').$('password')._value = messageObj.password;
      var sessions = new mumps.GlobalNode('%zewdSession',['session']);
      sessions._forEach(function(sessid, session) {
        session.$('ewd_password')._value = messageObj.password;
      });
      return {ok: true};
    },
    */

    'EWD.setParameter': function(messageObj) {
      if (messageObj.name === 'monitorLevel') {
        ewdChild.traceLevel = messageObj.value;
      }
      if (messageObj.name === 'logTo') {
        ewdChild.logTo = messageObj.value;
      }
      if (messageObj.name === 'changeLogFile') {
        ewdChild.logFile = messageObj.value;
      }
      return {ok: true};
    },

    'EWD.deleteSessionByToken': function(messageObj) {
      var sessid = EWD.getSessid(messageObj.token);
      if (sessid !== '') {
        EWD.deleteSession(sessid);
      }
    },

    'EWD.mgr.authenticate': function(messageObj) {
      if (!messageObj.username || messageObj.username === '') return ewdChild.errorResponse();
      if (!messageObj.password || messageObj.password === '') return ewdChild.errorResponse();
      if (!messageObj.mgtPassword || messageObj.mgtPassword === '') return ewdChild.errorResponse();
      var loginGlo = new mumps.GlobalNode('zewdMonitor', ['login']);
      if (loginGlo._exists) {
        var userGlo = loginGlo.$(messageObj.username);
        if (!userGlo._exists) return ewdChild.errorResponse();
        var credentials = userGlo._getDocument();
        if (!ewdChild.password.matches(messageObj.password, credentials)) return ewdChild.errorResponse();
      }
      else {
        if (messageObj.password !== messageObj.mgtPassword) return ewdChild.errorResponse();
      }
      var session = EWD.createNewSession('ewdjs', 600);
      var token = session.$('ewd_token')._value;
      return {
        type: 'webServiceRequest',
        json: {
          authorization: token
        }
      };
    },

    'EWD.mgr.about': function(messageObj) {
      return ewdChild.authenticate(messageObj);
    },

    'EWD.mgr.getChildProcesses': function(messageObj) {
      return ewdChild.authenticate(messageObj);
    },

    'EWD.mgr.startChildProcess': function(messageObj) {
      return ewdChild.authenticate(messageObj);
    },

    'EWD.mgr.stopChildProcess': function(messageObj) {
      return ewdChild.authenticate(messageObj);
    },

    'EWD.mgr.setAvailability': function(messageObj) {
      return ewdChild.authenticate(messageObj);
    },

    'EWD.mgr.setParameters': function(messageObj) {
      return ewdChild.authenticate(messageObj);
    },

    'EWD.mgr.exit': function(messageObj) {
      return ewdChild.authenticate(messageObj);
    },

    'EWD.mgr.getChildProcessInfo': function(messageObj) {
      if (!messageObj.token || messageObj.token === '') return ewdChild.errorResponse();
      var session = EWD.getSession(messageObj.token);
      if (session === '') return ewdChild.errorResponse();
      return {
        type: 'webServiceRequest',
        mgr: messageObj.type,
        params: {
          isAvailable: true,
          memory: EWD.getMemory()
        },
        release: true
      };
    },

    webSocketMessage: function(messageObj) {
      //if (ewdChild.timing) ewdChild.timing.startWebSocketMessage = EWD.getElapsedMs(ewdChild.timing);
      var modulePath;
      var module;
      var ewdSession = EWD.getSession(messageObj.token);
      //if (ewdChild.timing) ewdChild.timing.gotSession = EWD.getElapsedMs(ewdChild.timing);
      if (ewdSession !== '') {
        EWD.updateSessionExpiry(ewdSession);
        //if (ewdChild.timing) ewdChild.timing.sessionExpiryUpdated = EWD.getElapsedMs(ewdChild.timing);
        if (messageObj.messageType === 'EWD.getPrivateFile') {
          return ewdChild.messageHandlers['EWD.getPrivateFile'](messageObj, ewdSession);
        }
        var moduleName = ewdSession.app;
        messageObj.appName = moduleName;
        if (!ewdChild.module[moduleName]) {
          //modulePath = ewdChild.getModulePath(moduleName);
          //module = EWD.requireAndWatch(modulePath, moduleName);
          module = EWD.requireAndWatch(moduleName);
          if (!module) return {type: 'error', error: moduleName + ' could not be loaded'};
        }
        if (messageObj.service) {
          if (!ewdChild.services[moduleName]) {
            return {type: 'error', error: moduleName + ' is not registered to use any back-end services'};
          }
          if (!ewdChild.services[moduleName][messageObj.service]) {
            return {type: 'error', error: 'Access to the ' + messageObj.service + ' service is not permitted'};
          }
          moduleName = messageObj.service;
          if (!ewdChild.module[moduleName]) {
            //modulePath = ewdChild.getModulePath(moduleName);
            //module = EWD.requireAndWatch(modulePath, moduleName);
            module = EWD.requireAndWatch(moduleName);
            if (!module) return {type: 'error', error: 'Service module ' + moduleName + ' could not be loaded'};
          }
        }
        var type = messageObj.messageType;
        //if (ewdChild.timing) ewdChild.timing.settingUpParams = EWD.getElapsedMs(ewdChild.timing);
        var params = {
          session: ewdSession,
          mumps: mumps,
          db: database,
          log: ewdChild.log,
          logFile: ewdChild.logFile,
          database: ewdChild.database.type,
          util: EWD,
          ipAddress: messageObj.ipAddress,
          module: ewdChild.module,
          modulePath: ewdChild.modulePath,
          sendWebSocketMsg: function(content) {
            EWD.sendWebSocketMsg(this.session, content);
          },
          releaseChildProcess: function() { 
            EWD.releaseChildProcess(this.session)
          },
          webSocketMessage: {
            type: type,
            params: messageObj.params
          },
          Custom: ewdChild.Custom
        };
        //if (ewdChild.timing) ewdChild.timing.paramsCreated = EWD.getElapsedMs(ewdChild.timing);   
        if (ewdChild.database.type === 'mongodb') params.mongoDB = mongoDB;
        if (ewdChild.database.also && ewdChild.database.also.length > 0 && ewdChild.database.also[0] === 'mongodb') {
          params.mongoDB = mongoDB;
        }

        // create the EWD.js WebSocket domain (Enhancement by Ward De Backer)
        var ewdWSD = domain.create(); 
        // this function traps all errors been thrown in asynchronous functions in user modules
        ewdWSD.on('error', function(err) {
          if (ewdChild.traceLevel >= 1) {
            console.error('An error occurred in module ' + moduleName + ':\n', err.stack);
            // logging to file is very useful for production, you can see/log all errors that occurred in the past too
            if (ewdChild.logTo === 'file') {
              try {
                // logging to file has to be synchronous, otherwise not all errors that will be logged when the child crashes
                fs.appendFileSync(ewdChild.logFile, 'Error in module ' + moduleName + ' logged at ' + (new Date().toUTCString()) + '\n' + err.stack + '\n\n');
              }
              catch(err) {
                console.log('Error writing to log file ' + ewdChild.logFile);
              }
            }
          }
          // just put a try/catch around process.send in case it couldn't be sent to the master process
          try {
            // we can't do a return anymore because we are in the domain error handling function
            // so try to send the error nicely back to the master process...
            process.send({
              type: 'error',
              error: 'An error occurred: ' + err.message,
              pid: process.pid,
              release: true
            });
          }
          catch(err) {
            if (ewdChild.traceLevel >= 1) console.error('*** error sending error back to process!', err.stack);
          }
        });
        // End (Ward De Backer)

        var result;
        if (ewdChild.module[moduleName].onMessage && ewdChild.module[moduleName].onMessage[type]) {
          // Ward De Backer: you still need a try/catch block here to catch all synchronous errors, see https://gist.github.com/owenallenaz/7141699
          try {
            // Ward De Backer: ewdWSD.run has to return in this case, 
            //  because the response is returned by the code inside ewdWSD.run
            return ewdWSD.run(function() {
              //if (ewdChild.timing) ewdChild.timing.beforeOnMessage = EWD.getElapsedMs(ewdChild.timing);
              if (ewdChild.module[moduleName].beforeOnMessage) ewdChild.module[moduleName].beforeOnMessage(params); 
              result =  ewdChild.module[moduleName].onMessage[type](messageObj.params, params) || '';
              if (ewdChild.module[moduleName].afterOnMessage) result = ewdChild.module[moduleName].afterOnMessage(params, result); 
              //if (ewdChild.timing) ewdChild.timing.afterOnMessage = EWD.getElapsedMs(ewdChild.timing);   
              return {response: result};
            });
          }
          catch(err) {
            //return {pid: process.pid, response: {error: "Error returned by " + moduleName + "." + type + ": " + err}};
            // Modification by Ward De Backer
            //if (ewdChild.traceLevel >= 1) console.log('Error attempting to execute ' + moduleName + ': ' + err, 1);
            if (ewdChild.traceLevel >= 1) {
              console.error('An error occurred in module ' + moduleName + ':\n', err.stack);
              // logging to file is very useful for production, you can see/log all errors that occurred in the past too
              if (ewdChild.logTo === 'file') {
                try {
                  // logging to file has to be synchronous, otherwise not all errors that will be logged when the child crashes
                  fs.appendFileSync(ewdChild.logFile, 'Error in module ' + moduleName + ' logged at ' + (new Date().toUTCString()) + '\n' + err.stack + '\n\n');
                }
                catch(err) {
                  console.log('Error writing to log file ' + ewdChild.logFile);
                }
              }
            }
            return {pid: process.pid, type: 'error', error: err};
          }
        }
        else {
          if (ewdChild.module[moduleName].onSocketMessage) {
            // Ward De Backer: no domain error handling logic added here, as this stuff is deprecated
            if (ewdChild.module[moduleName].beforeOnMessage) ewdChild.module[moduleName].beforeOnMessage(params); 
            result =  ewdChild.module[moduleName].onSocketMessage(params) || '';
            if (ewdChild.module[moduleName].afterOnMessage) result = ewdChild.module[moduleName].afterOnMessage(params, result);
            //return {pid: process.pid, response: result};
            return {response: result};
          }
          else {    
            if (ewdChild.traceLevel >= 2) console.log('Error: ' + moduleName + ' has no handler for message type ' + type);
            //return {pid: process.pid, type: 'error', error: moduleName + ' has no handler for message type ' + type};
            return {type: 'error', error: moduleName + ' has no handler for message type ' + type};
          }
        }
      }
      else {
        //return {pid: process.pid, type: 'error', error: messageObj.token + " has expired or is invalid"};
        return {
          type: 'error', 
          error: 'Session has expired or not recognised',
          //action: 'disconnect'
        };
      }
    },

    webServiceRequest: function(messageObj) {
      //console.log('child process ' + process.pid + ': in webServiceRequest handler at ' + process.hrtime(ewdChild.startns));
      //if (ewdChild.timing) ewdChild.timing.push({inWebServiceRequest: process.hrtime(ewdChild.timing[0].start)});
      if (ewdChild.webservice.authenticate) {
        //console.log('child process ' + process.pid + ': webServiceRequest - authenticate!');
        var node = {global: '%zewd', subscripts: ['EWDLiteServiceAccessId', messageObj.query.accessId]}; 
        var node2 = {global: '%zewd', subscripts: ['EWDLiteServiceAccessId', messageObj.query.accessId, 'apps', messageObj.appName]}; 

        //var auth = new mumps.GlobalNode('%zewd', ['EWDLiteServiceAccessId', messageObj.query.accessId]);
        //if (!auth._exists) {
        if (database.data(node).defined === 0) {
          return {error: messageObj.query.accessId + ' is not authorised for Web Service access'};
        }
        //else if (!auth.$('apps').$(messageObj.appName)._exists) {
        if (database.data(node2).defined === 0) {
          return {error: messageObj.query.accessId + ' is not allowed access to the ' + messageObj.appName + ' application'};
        }
        node = {global: '%zewd', subscripts: ['EWDLiteServiceAccessId', messageObj.query.accessId, 'secretKey']};
        var secretKey = database.get(node).data; 
        //var secretKey = auth.$('secretKey')._value;
        if (secretKey === '') {
          return {error: 'Invalid security credentials'};
        }
        var type = 'sha256';
        var stringToSign = ewdChild.createStringToSign(messageObj, true);
        //ewdChild.log("stringToSign: " + stringToSign, 3);
        var hash = ewdChild.digest(stringToSign, secretKey, type);
        var signature = messageObj.query.signature.split(' ').join('+');
        if (ewdChild.traceLevel >= 3) console.log("hash: " + hash);
        if (ewdChild.traceLevel >= 3) console.log("signature: " + signature);
        if (hash !== signature) {
          // try a second time, not including the port with the host this time
          stringToSign = ewdChild.createStringToSign(messageObj, false);
          //ewdChild.log("stringToSign: " + stringToSign, 3);
          hash = ewdChild.digest(stringToSign, secretKey, type);
          if (ewdChild.traceLevel >= 3) console.log("hash: " + hash);
          if (ewdChild.traceLevel >= 3) console.log("signature: " + signature);
          if (hash !== signature) {
            return {error: 'Signatures do not match'};
          }
        }
      }

      // authenticated - now try to run the service
      var moduleName = messageObj.appName;
      //console.log('child process ' + process.pid + ': webServiceRequest - moduleName = ' + moduleName);
      if (!ewdChild.module[moduleName]) {
        //console.log('loading module ' + moduleName);
        //var modulePath = ewdChild.getModulePath(moduleName);
        //var module = EWD.requireAndWatch(modulePath, moduleName);
        var module = EWD.requireAndWatch(moduleName);
        if (!module) {
          return {error: moduleName + ' could not be loaded'};
        }
       }
      var serviceName = messageObj.serviceName;
      if (!ewdChild.module[moduleName][serviceName]) {
        return {error: 'The service named ' + serviceName + ' is not available for the ' + moduleName + ' application'};
      }

      // ready to try executing the specified method
      //console.log('creating params object at ' + process.hrtime(ewdChild.startns));
      //if (ewdChild.timing) ewdChild.timing.push({creatingParams: process.hrtime(ewdChild.timing[0].start)});
      var params = {
        query: messageObj.query,
        post_data: messageObj.post_data,
        mumps: mumps,
        db: database,
        util: EWD,
        module: ewdChild.module,
        log: ewdChild.log,
        logFile: ewdChild.logFile,
        sendWebServiceResponse: function(json) {
          EWD.sendWebServiceResponse(json);
        },
        Custom: ewdChild.Custom
      };
      //console.log('params object created at ' + process.hrtime(ewdChild.startns));
      //if (ewdChild.timing) ewdChild.timing.push({paramsCreated: process.hrtime(ewdChild.timing[0].start)});
      var result;
      if (ewdChild.database.type === 'mongodb') params.mongoDB = mongoDB;

      // Ward De Backer: create the EWD.js WebService domain
      var ewdWSD = domain.create();
      // this function traps all errors thrown in asynchronous functions
      // it can also log to an error file 
      ewdWSD.on('error', function(err) {
        if (ewdChild.traceLevel >= 1) {
          console.error('An error occurred in module/service ' + moduleName + '/' + serviceName + ':\n', err.stack);
          // logging to file is very useful for production, you can see/log all errors that occurred in the past too
          if (ewdChild.logTo === 'file') {
            try {
              // logging to file has to be synchronous, otherwise not all errors that will be logged when the child crashes
              fs.appendFileSync(ewdChild.logFile, 'Error in module/service ' + moduleName + '/' + serviceName + ' logged at ' + (new Date().toUTCString()) + '\n' + err.stack + '\n\n');
            }
            catch(err) {
              console.log('Error writing to log file ' + ewdChild.logFile);
            }
          }
        }
        // just put a try/catch around process.send in case it couldn't send to the master process
        try {
          // can't do a return anymore because we are in the domain onError function
          // so try to send the error nicely back to the master process ...
          process.send({
            type: 'error',
            error: 'An error occurred: ' + err.message,
            pid: process.pid,
            release: true
          });
        }
        catch(err) {
          if (ewdChild.traceLevel >= 1) console.error('*** error sending error back to process!', err.stack);
        }
      });		
      try { 
        ewdWSD.run(function() {
          //console.log('invoking handler for ' + moduleName + ' / ' + serviceName + ' at ' + process.hrtime(ewdChild.startns));
          //if (ewdChild.timing) ewdChild.timing.push({invokingModuleService: process.hrtime(ewdChild.timing[0].start)});
          if (ewdChild.module[moduleName].beforeOnWebService) ewdChild.module[moduleName].beforeOnWebService(params);
          result = ewdChild.module[moduleName][serviceName](params) || '';
          if (ewdChild.module[moduleName].afterOnWebService) result = ewdChild.module[moduleName].afterOnWebService(params, result);
          //console.log('handler completed at ' + process.hrtime(ewdChild.startns));
          //if (ewdChild.timing) ewdChild.timing.push({moduleServiceCompleted: process.hrtime(ewdChild.timing[0].start)});
        });
      }
      catch(err) {
        if (ewdChild.traceLevel >= 1) {
          console.error('An error occurred in module/service ' + moduleName + '/' + serviceName + ':\n', err.stack);
          // logging to file is very useful for production, you can see/log all errors that occurred in the past too
          if (ewdChild.logTo === 'file') {
            try {
              // logging to file has to be synchronous, otherwise not all errors that will be logged when the child crashes
              fs.appendFileSync(ewdChild.logFile, 'Error in module/service ' + moduleName + '/' + serviceName + ' logged at ' + (new Date().toUTCString()) + '\n' + err.stack + '\n\n');
            }
            catch (err) {
              console.log('Error writing to log file ' + ewdChild.logFile);
            }
          }
        }
        return {error: 'An error occurred while executing ' + moduleName + '/' + serviceName + ': ' + err};
      }
      // End of Ward's error-handling enhancement
      if (result.error) {
        return result;
      }
      else {
        // successful execution
        //console.log('child process ' + process.pid + ': webServiceRequest handler completed at ' + process.hrtime(ewdChild.startns));
        //if (ewdChild.timing) ewdChild.timing.push({webServiceRequest: process.hrtime(ewdChild.timing[0].start)});
        return {json: result};
      }
    },

    externalMessage: function(messageObj) {
      var tokenArray = [];
      var node = {global: '%zewdSession', subscripts: ['session', '']};
      var sessid;
      var xnode;
      do {
        node = database.order(node);
        sessid = node.result || '';
        if (sessid !== '') {
          if (messageObj.recipients === 'byApplication') {
            xnode = {global: '%zewdSession', subscripts: ['session', sessid, 'ewd_appName']};
            if (database.get(xnode).data === messageObj.application) {
              xnode = {global: '%zewdSession', subscripts: ['session', sessid, 'ewd_wstoken']};
              tokenArray.push(database.get(xnode).data);
            }
          }
          if (messageObj.recipients === 'bySession') {
            if (messageObj.session && (messageObj.session instanceof Array)) {
              var ok = true;
              for (var i = 0; i < messageObj.session.length; i++) {
                xnode = {global: '%zewdSession', subscripts: ['session', sessid, messageObj.session[i].name]};
                ok = ok && (database.get(xnode).data === messageObj.session[i].value);
              }
              if (ok) {
                xnode = {global: '%zewdSession', subscripts: ['session', sessid, 'ewd_wstoken']};
                tokenArray.push(database.get(xnode).data);
              }
            }
          }
          if (messageObj.recipients === 'all') {
            xnode = {global: '%zewdSession', subscripts: ['session', sessid, 'ewd_wstoken']};
            tokenArray.push(database.get(xnode).data);
          }
        }
      }
      while (sessid !== '');
      /*
      var sessions = new mumps.GlobalNode('%zewdSession', ['session']);
      sessions._forEach(function(sessid, sessionNode) {
        if (messageObj.recipients === 'byApplication') {
          if (sessionNode.$('ewd_appName')._value === messageObj.application) tokenArray.push(sessionNode.$('ewd_wstoken')._value);
        }
        if (messageObj.recipients === 'bySessionValue') {
          if (messageObj.session && (messageObj.session instanceof Array)) {
            var ok = true;
            for (var i = 0; i < messageObj.session.length; i++) {
              ok = ok && (sessionNode.$(messageObj.session[i].name)._value === messageObj.session[i].value);
            }
            if (ok) tokenArray.push(sessionNode.$('ewd_wstoken')._value);
          }
        }
        if (messageObj.recipients === 'all') tokenArray.push(sessionNode.$('ewd_wstoken')._value);
      });
      */
      return {
        tokens: tokenArray
      };
    }

  }

};

// Handle incoming messages

process.on('message', function(messageObj) {
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
  if (ewdChild.messageHandlers[type]) {
    if (ewdChild.timing) ewdChild.timing.beforeMessageHandlers = EWD.getElapsedMs(ewdChild.timing);
    var response = ewdChild.messageHandlers[type](messageObj);
    if (ewdChild.timing) ewdChild.timing.afterMessageHandlers = EWD.getElapsedMs(ewdChild.timing);
    if (response) {
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
});

// Child process shutdown handler - close down database cleanly

process.on('exit',function() {
  if (database) {
    try {
      database.close();
    }
    catch(err) {}
  }
  if (ewdChild.traceLevel >= 2) console.log('*** ' + process.pid + ' closed ' + ewdChild.database.type);
  if (ewdChild.database.also && ewdChild.database.also.length > 0) {
    if (ewdChild.database.also[0] === 'mongodb') {
      if (mongoDB) mongoDB.close();
    }
  }
  if (ewdChild.sessionCache.GCEvent) clearTimeout(ewdChild.sessionCache.GCEvent);
  if (ewdChild.Custom && ewdChild.Custom.onExit) {
    ewdChild.Custom.onExit();
  }
});

// OK ready to go!

console.log('Child process ' + process.pid + ' has started');

process.on( 'SIGINT', function() {
  console.log('Child Process ' + process.pid + ' detected SIGINT (Ctrl-C) - ignored');
});
process.on( 'SIGTERM', function() {
  console.log('Child Process ' + process.pid + ' detected SIGTERM signal - ignored');
});


// kick off the initialisation process now that the Child Process has started

process.send({
  type: 'childProcessStarted', 
  pid: process.pid
});



