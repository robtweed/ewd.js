/*
 ----------------------------------------------------------------------------
 | ewdChildProcess: Child Worker Process for EWD.js                         |
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

  Build 45; 12 June 2014

*/

var fs = require('fs');
var os = require('os');
var events = require('events');
var crypto = require('crypto');
var util = require('util');

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
  getSessid: function(token) {
    var node = {global: '%zewdSession', subscripts: ['tokens', token]}; 
    var sessid = database.get(node).data;
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
    zewd._setDocument(memory);
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
    ewdSession = null;
    token = null;
    sessid = null;
    if (expiry === '') return true;
    if (expiry > this.hSeconds()) return false;
    return true;
  },
  createNewSession: function(application, timeout) {
    EWD.deleteExpiredSessions();
    var sessionCounter = new mumps.GlobalNode('%zewd', ['nextSessid']);
    var sessid = sessionCounter._increment();
    var session = new mumps.GlobalNode('%zewdSession', ['session', sessid]);
    session._delete();
    var token = EWD.createToken();
    var now = EWD.hSeconds();
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
    session._setDocument(params);
    EWD.sendMessageToAppUsers({
      type: 'newSession', 
      content: {
        sessid: sessid,
        appName: application,
        expiry: new Date((expiry - 4070908800) * 1000).toUTCString()
      }, 
      appName: 'ewdMonitor'
    });
    var tokensBySession = new mumps.GlobalNode('%zewdSession', ['tokensBySession', sessid]);
    tokensBySession.$(token)._value = '';
    var tokens = new mumps.GlobalNode('%zewdSession', ['tokens']);
    tokens.$(token)._value = sessid + '~' + now + '~' + expiry + '~dummy';
    return session;
  },
  getSession: function(token) {
    if (this.isTokenExpired(token)) {
      return '';
    }
    else {
      var sessid = this.getSessid(token);
      var ewdSession = new mumps.GlobalNode('%zewdSession',['session',sessid]);
      ewdSession.sessid = database.get({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_sessid']}).data;
      ewdSession.app = database.get({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_appName']}).data;
      ewdSession.page = database.get({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_pageName']}).data;
      ewdSession.isAuthenticated = (+database.get({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_authenticated']}).data === 1);
      ewdSession.setAuthenticated = function() {
        database.set({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_authenticated'], data: 1})
      };
      ewdSession.setAuthenticated = function(value) {
        if (typeof value == 'undefined')
          value = true;
        database.set({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_authenticated'], data: value ? 1 : 0})
      };
      return ewdSession;
    }
  },
  updateSessionExpiry: function(session) {
    var now = EWD.hSeconds();
    var sessid = session.sessid;
    var timeout = +database.get({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_sessionTimeout']}).data;
    var expiry = now + timeout;
    database.set({global: '%zewdSession', subscripts: ['session', sessid, 'ewd_sessionExpiry'], data: expiry})
  }, 
  getRequest: function(ewdSession) {
    return new mumps.GlobalNode("%zewdSession",['request',ewdSession.sessid]);
  },
  getServer: function(ewdSession) {
    return new mumps.GlobalNode("%zewdSession",['server',ewdSession.sessid]);
  },
  createToken: function() {
    var result = [];
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
    var tokenLength = 63;
    while (--tokenLength) {
      result.push(chars.charAt(Math.floor(Math.random() * chars.length)));
    }
    return result.join('');
  },
  deleteExpiredSessions: function() {
    var sessions = new mumps.GlobalNode('%zewdSession',['session']);
    sessions._forEach(function(sessid, session) {
      var expiry = +session.$('ewd_sessionExpiry')._value;
      //ewdChild.log("sessid: " + sessid + "; expiry: " + expiry + "; now: " + EWD.hSeconds(), 3);
      if (expiry === '' || expiry < EWD.hSeconds()) {
        EWD.deleteSession(sessid);
      }
    });
  },
  deleteSession: function(sessid) {
    var token;
    var zewdSession = new mumps.GlobalNode("%zewdSession", []);
    token = zewdSession.$('session').$(sessid).$('ewd_wstoken')._value;
    process.send({
      pid: process.pid,
      type: 'deleteSocketClient',
      token: token
    });
    var tokens = zewdSession.$('tokens');
    var tokensBySession = zewdSession.$('tokensBySession').$(sessid);
    var count = 0;
    tokensBySession._forEach(function(token, subNode) {
      if (tokens.$(token)._exists) {
        var xsessid = tokens.$(token)._value.split('~')[0];
        if (xsessid !== '') tokens[token]._delete();
      }
    });
    tokensBySession._delete();
    zewdSession.$('session').$(sessid)._delete();
    zewdSession.$('nextPageTokens').$(sessid)._delete();
    zewdSession.$('action').$(sessid)._delete();
    zewdSession.$('jsonAccess').$(sessid)._delete();
    zewdSession.$('server').$(sessid)._delete();
    zewdSession.$('request').$(sessid)._delete();
      
    EWD.sendMessageToAppUsers({
      type: 'sessionDeleted', 
      content: {sessid: sessid}, 
      appName: 'ewdMonitor'
    }); 
  },
  sendMessageToAppUsers: function(params) {
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
    process.send({
      pid: process.pid,
      type: 'wsMessage',
      token: token,
      content: content
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
    scratch.$('inputs')._setDocument(ewd.query);
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
    var module = false;
    try {
      module = require(path);
      if (moduleName) ewdChild.module[moduleName] = module
      ewdChild.log("requireAndWatch: " + path + " loaded by process " + process.pid, 3);
      //fs.watch(require.resolve(path), function(event, filename) {
      fs.watch(path, function(event, filename) {
        ewdChild.log(filename + ' has changed - event = ' + event + '; process: ' + process.pid, 3);
        if (event === 'change') {
          var path = require.resolve(filename);
          //if (require.cache[path]) {
          //  console.log('****  ' + path + ' found in require.cache');
          //}
          //console.log('** resolved file path: ' + require.resolve(filename));
          //console.log('require.cache: ' + util.inspect(require.cache));
          //console.log('delete from require cache: ' + require.resolve(path));
          //delete require.cache[require.resolve(path)];
          delete require.cache[path];
          //console.log('require.cache is now: ' + util.inspect(require.cache));
          try {
            //if (!require.cache[path]) {
            //  console.log('!!!!!  ' + path + ' not found in require.cache');
            //}
            var module = require(path);
            if (moduleName) ewdChild.module[moduleName] = module
            if (!module) console.log('^&&*&^*&^*^ require failed');
            ewdChild.log(filename + " reloaded successfully", 3);
            //console.log('require.cache reset to: ' + util.inspect(require.cache));
          }
          catch (err) {
            ewdChild.log(path + " could not be reloaded: " + JSON.stringify(err), 3);
          }
        }
      });
      //console.log("requireAndWatch finished");
    }
    catch(err) {
      ewdChild.log("Error in requireAndWatch - " + path + " could not be loaded", 2);
    }
    return module;
  }

};

var ewdChild = {

  log: function(message, level, clearLog) {
    if (+level <= +ewdChild.traceLevel) {
      if (ewdChild.logTo === 'console') {
        console.log(message);
      }
      if (ewdChild.logTo === 'global') {
        ewdChild.logToGlobal(message);
      }
      if (ewdChild.logTo === 'file') {
        ewdChild.logToFile(message, clearLog);
      }
      try {
        process.send({pid: process.pid, type: 'log', message: message});
      }
      catch (err) {
      }
    }
    message = null;
    level = null;
  },
  logToGlobal: function(message) {
    var logMessage = message;
    var gloRef = {global: ewd.logGlobal, subscripts: []};
    this.queueCommand('increment', gloRef, function(error, results) {
      var index = results._value;
      var gloRef = {global: ewd.logGlobal, subscripts: [index], value: logMessage};
      this.queueCommand('set', gloRef, function(error, results) {
      });
    });
  },
  logToFile: function(message, clearLog) {
    var s = new Date().getTime() + ': ' + process.pid + ': ' + message.toString().replace(/\r\n|\r/g, '\n');
    s = s + '\n';
    var options = {};
    if (clearLog) {
      options.flag = 'w+'
    }
    fs.appendFile(ewdChild.logFile, s, options, function (err) {
      if (err) {
        console.log('Child Process error writing to ' + ewdChild.logFile + ': ' + err);
      }
    });
  },

  module: {},
  getModulePath: function(application) {
    var path = ewdChild.modulePath;
    var lchar = path.slice(-1);
    if (lchar === '/' || lchar === '\\') {
      path = path.slice(0,-1);
    }
    var delim = '/';
    if (process.platform === 'win32') delim = '\\';
    path = path + delim + application + '.js';
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
    var method = 'GET'
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

  messageHandlers: {

    // handlers for incoming messages, by type

    initialise: function(messageObj) {
      var params = messageObj.params;
      // initialising this worker process
      ewdChild.httpPort = params.httpPort;
      ewdChild.log(process.pid + " initialise: params = " + JSON.stringify(params), 3);
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
      var hNow = params.hNow;
      ewdChild.modulePath = params.modulePath;
      mumps = require(ewdChild.ewdGlobalsPath);
      if (ewdChild.database.type === 'mongodb') ewdChild.database.nodePath = 'mongoGlobals';
      try {
        var globals = require(ewdChild.database.nodePath);
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
          console.log("***8 ERROR: Database could not be opened: " + dbStatus.ErrorMessage);
          if (dbStatus.ErrorMessage.indexOf('unexpected error') !== -1) {
            console.log('It may be due to file privileges - try starting using sudo');
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
        var path = ewdChild.getModulePath('globalIndexer');
        var indexer = EWD.requireAndWatch(path);
        indexer.start(mumps);
        ewdChild.log("** Global Indexer loaded: " + path, 2);
      }
      catch(err) {}
      // ********************************************************
  
      var zewd = new mumps.GlobalNode('zewd', ['ewdjs', ewdChild.httpPort]);
      
      if (params.no === 0) {
        // first child process that is started clears down persistent stored EWD.js data
        ewdChild.log("First child process (' + process.pid + ') initialising database...");
        var funcObj;
        var resultObj;
        var pczewd = new mumps.Global('%zewd');
        pczewd.$('relink')._delete();
        pczewd = null;
  
        zewd._delete();
        if (typeof params.management.password !== 'undefined') {
          zewd.$('management').$('password')._value = params.management.password;
          zewd.management.$('path')._value = params.management.path;
          //console.log('management password saved');
        }
        process.send({
          pid: process.pid, 
          type: 'firstChildInitialised'
        });
      }
      var mem = EWD.getMemory();
      //console.log('memory: ' + JSON.stringify(mem, null, 2));
      zewd.$('processes').$(process.pid)._value = EWD.getDateFromhSeconds(hNow);
      //console.log('hNow set for ' + process.pid + ': ' + hNow);
      zewd = null;
    },
    //  ** end of initialise function

    'EWD.exit': function(messageObj) {
      setTimeout(function() {
        process.exit(1);
      },500);
      return {pid: process.pid, type: 'EWD.exit'};
    },

    getMemory: function(messageObj) {
      messageObj = null;
      return EWD.getMemory();
    },

    'EWD.register': function(messageObj) {
      EWD.deleteExpiredSessions();
      var sessionCounter = new mumps.GlobalNode('%zewd', ['nextSessid']);
      var sessid = sessionCounter._increment();
      var session = new mumps.GlobalNode('%zewdSession', ['session', sessid]);
      session._delete();
      var token = EWD.createToken();
      var now = EWD.hSeconds();
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
        ewd_password: messageObj.ewd_password,
        ewd_clientId: messageObj.ewd_clientId
      };
      session._setDocument(params);    

      EWD.sendMessageToAppUsers({
        type: 'newSession', 
        content: {
          sessid: sessid,
          appName: application.name,
          expiry: new Date((expiry - 4070908800) * 1000).toUTCString()
        }, 
        appName: 'ewdMonitor'
      });
      var tokensBySession = new mumps.GlobalNode('%zewdSession', ['tokensBySession', sessid]);
      tokensBySession.$(token)._value = '';
      var tokens = new mumps.GlobalNode('%zewdSession', ['tokens']);
      tokens.$(token)._value = sessid + '~' + now + '~' + expiry + '~dummy';
      return {sessid: sessid, token: token, application: application.name};
    },

    'EWD.reconnect': function(messageObj) {
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
      return {reconnect: false};
    },

    'EWD.resetPassword': function(messageObj) {
      var zewd = new mumps.GlobalNode('zewd', ['ewdjs', ewdChild.httpPort]);
      zewd.$('management').$('password')._value = messageObj.password;
      var sessions = new mumps.GlobalNode('%zewdSession',['session']);
      sessions._forEach(function(sessid, session) {
        session.$('ewd_password')._value = messageObj.password;
      });
      return {ok: true};
    },

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

    webSocketMessage: function(messageObj) {
      var ewdSession = EWD.getSession(messageObj.token);
      if (ewdSession !== '') {
        EWD.updateSessionExpiry(ewdSession);
        var moduleName = ewdSession.app;
        messageObj.appName = moduleName;
        if (!ewdChild.module[moduleName]) {
          var modulePath = ewdChild.getModulePath(moduleName);
          var module = EWD.requireAndWatch(modulePath, moduleName);
          if (!module) return {type: 'error', error: moduleName + ' could not be loaded'};
        }            
        var type = messageObj.messageType;
        var params = {
          session: ewdSession,
          mumps: mumps,
          db: database,
          log: ewdChild.log,
          database: ewdChild.database.type,
          util: EWD,
          ipAddress: messageObj.ipAddress,
          modulePath: ewdChild.modulePath,
          sendWebSocketMsg: function(content) {
            EWD.sendWebSocketMsg(this.session, content);
          },
          webSocketMessage: {
            type: type,
            params: messageObj.params
          }
        };
        if (ewdChild.database.type === 'mongodb') params.mongoDB = mongoDB;
        if (ewdChild.database.also && ewdChild.database.also.length > 0 && ewdChild.database.also[0] === 'mongodb') {
          params.mongoDB = mongoDB;
        }

        if (ewdChild.module[moduleName].onMessage && ewdChild.module[moduleName].onMessage[type]) {
          try {
            var result;
            result =  ewdChild.module[moduleName].onMessage[type](messageObj.params, params) || '';
            //return {pid: process.pid, response: result};
            return {response: result};
          }
          catch(err) {
            //return {pid: process.pid, response: {error: "Error returned by " + moduleName + "." + type + ": " + err}};
            ewdChild.log('Error attempting to execute ' + moduleName + ': ' + err, 1);
            //return {pid: process.pid, type: 'error', error: err};
            return {pid: process.pid, type: 'error', error: err};
          }
        }
        else {
          if (ewdChild.module[moduleName].onSocketMessage) {
            result =  ewdChild.module[moduleName].onSocketMessage(params) || '';
            //return {pid: process.pid, response: result};
            return {response: result};
          }
          else {    
            ewdChild.log('Error: ' + moduleName + ' has no handler for message type ' + type, 2);
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
      var auth = new mumps.GlobalNode('%zewd', ['EWDLiteServiceAccessId', messageObj.query.accessId]);
      if (!auth._exists) {
        return {error: messageObj.query.accessId + ' is not authorised for Web Service access'};
      }
      else if (!auth.$('apps').$(messageObj.appName)._exists) {
        return {error: messageObj.query.accessId + ' is not allowed access to the ' + messageObj.appName + ' application'};
      }
      else {
        var secretKey = auth.$('secretKey')._value;
        if (secretKey === '') {
          return {error: 'Invalid security credentials'};
        }
        else {
          var type = 'sha256';
          var stringToSign = ewdChild.createStringToSign(messageObj, true);
          //ewdChild.log("stringToSign: " + stringToSign, 3);
          var hash = ewdChild.digest(stringToSign, secretKey, type);
          var signature = messageObj.query.signature.split(' ').join('+');
          ewdChild.log("hash: " + hash, 3);
          ewdChild.log("signature: " + signature, 3);
          if (hash !== signature) {
            // try a second time, not including the port with the host this time
            stringToSign = ewdChild.createStringToSign(messageObj, false);
            //ewdChild.log("stringToSign: " + stringToSign, 3);
            hash = ewdChild.digest(stringToSign, secretKey, type);
            ewdChild.log("hash: " + hash, 3);
            ewdChild.log("signature: " + signature, 3);
            if (hash !== signature) {
              return {error: 'Signatures do not match'};
            }
          }
          // authenticated - now try to run the service
          var moduleName = messageObj.appName;
          if (!ewdChild.module[moduleName]) {
            var modulePath = ewdChild.getModulePath(moduleName);
            var module = EWD.requireAndWatch(modulePath, moduleName);
            if (!module) {
              return {error: moduleName + ' could not be loaded'};
            }
          }
          var serviceName = messageObj.serviceName;
          if (!ewdChild.module[moduleName][serviceName]) {
            return {error: 'The service named ' + serviceName + ' is not available for the ' + moduleName + ' application'};
          }
          else {
            // ready to try executing the specified method
            var params = {
              query: messageObj.query,
              mumps: mumps,
              util: EWD,
              log: ewdChild.log
            };
            if (ewdChild.database.type === 'mongodb') params.mongoDB = mongoDB;
            try {
              var result = ewdChild.module[moduleName][serviceName](params) || '';
            }
            catch(error) {
              return {error: 'An error occurred while executing ' + moduleName + '/' + serviceName + ': ' + error};
            }
            if (result.error) {
              return result;
            }
            else {
              // successful execution
              return {json: result};
            }
          }
        }
      }
    },

    externalMessage: function(messageObj) {
      var tokenArray = [];
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
      return {
        tokens: tokenArray
      };
    }

  }

};

// Handle incoming messages

process.on('message', function(messageObj) {
  if (messageObj.type !== 'getMemory') {
    ewdChild.log('child process ' + process.pid + ' received message:' + JSON.stringify(messageObj, null, 2), 3);
  }
  var type = messageObj.type;
  if (ewdChild.messageHandlers[type]) {
    var response = ewdChild.messageHandlers[type](messageObj);
    if (response) {
      if (!response.type) response.type = type;
      response.pid = process.pid;
      if (messageObj.messageType) response.messageType = messageObj.messageType;
      process.send(response);
      response = null;
    }
  }
  else {
    process.send({
      type: 'error',
      error: 'Message type (' + type + ') not recognised',
      pid: process.pid
    })
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
  ewdChild.log('*** ' + process.pid + ' closed ' + ewdChild.database.type, 2);
  if (ewdChild.database.also && ewdChild.database.also.length > 0) {
    if (ewdChild.database.also[0] === 'mongodb') {
      if (mongoDB) mongoDB.close();
    }
  }
});

// OK ready to go!

console.log('Child process ' + process.pid + ' has started');

// kick off the initialisation process now that the Child Process has started

process.send({
  type: 'childProcessStarted', 
  pid: process.pid
});



