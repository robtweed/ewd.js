/*
 ----------------------------------------------------------------------------
 | ewdChildProcess: Child Worker Process for EWD.js                         |
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

var fs = require('fs');
var events = require('events');
var uuid = require('node-uuid');
var se = require('speakeasy');
var ntp = require('ntp-client');

var EWD = {
  ping: function() {
    console.log('This is EWD.js');
  },
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
    var hSecs = secs - offset;
    if (ewdChild.EWDCompatible) hSecs = hSecs + 4070908800;
    return hSecs;
  },
  hDate: function(date) {
    var hSecs = this.hSeconds(date);
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
    var node = {global: ewdChild.global.session, subscripts: ['tokens', token]}; 
    var sessid = db.get(node).data;
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
    var zewd = new mumps.GlobalNode(ewdChild.global.zewd, ['ewdjs', ewdChild.httpPort, 'memoryUsage', process.pid]);
    zewd._setDocument(memory, true);
    memory.pid = process.pid;
    memory.modules = {};
    for (var name in ewdChild.module) {
      memory.modules[name] = '';
    }
    //memory.modules = ewdChild.module;
    zewd = null;
    return memory;
  },
  isTokenExpired: function(token) {
    var sessid = this.getSessid(token);
    if (sessid === '') return true;
    var node = {global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_sessionExpiry']}; 
    var expiry = +db.get(node).data;
    token = null;
    sessid = null;
    if (expiry === '') return true;
    var now = Math.floor(new Date().getTime()/1000);
    if (ewdChild.EWDCompatible) now = now + 4070908800;
    //if (expiry > this.hSeconds()) return false;
    if (expiry > now) return false;
    return true;
  },
  createNewSession: function(application, timeout) {
    var node = {global: ewdChild.global.sessionNo, subscripts: ['nextSessid']};
    var sessid = db.increment(node).data;
    node = {global: ewdChild.global.session, subscripts: ['session', sessid]};
    db.kill(node);

    var token = this.createToken();
    var now = Math.floor(new Date().getTime()/1000);
    if (ewdChild.EWDCompatible) now = now + 4070908800;
    //var now = EWD.hSeconds();
    if (!timeout) timeout = 3600;
    var expiry = now + timeout;
    var params = {
      ewd_token: token,
      ewd_sessid: sessid,
      ewd_sessionTimeout: timeout,
      ewd_sessionExpiry: expiry,
      ewd_appName: application,
      ewd_authenticated: 0
    };
    for (var name in params) {
      node = {global: ewdChild.global.session, subscripts: ['session', sessid, name], data: params[name]};
      db.set(node);
    }
    if (ewdChild.EWDCompatible) expiry = expiry - 4070908800;
    this.sendMessageToAppUsers({
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

    node = {global: ewdChild.global.session, subscripts: ['tokensBySession', sessid, token], data: ''};
    db.set(node);
    var data = sessid + '~' + now + '~' + expiry + '~dummy';
    node = {global: ewdChild.global.session, subscripts: ['tokens', token], data: data};
    db.set(node);
    //return new mumps.GlobalNode(ewdChild.global.session, ['session', sessid]);
    return this.getSession(token);
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
      var ewdSession = new mumps.GlobalNode(ewdChild.global.session,['session',sessid]);
      //if (ewdChild.timing) ewdChild.timing.ewdSessionNodeCreated = EWD.getElapsedMs(ewdChild.timing);
      ewdSession.sessid = db.get({global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_sessid']}).data;
      ewdSession.app = db.get({global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_appName']}).data;
      ewdSession.page = db.get({global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_pageName']}).data;
      Object.defineProperty(ewdSession, 'isAuthenticated', {
        get: function() {
          return (+db.get({global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_authenticated']}).data === 1);
        }
      });
      //if (ewdChild.timing) ewdChild.timing.beforeAuthenticatedFn = EWD.getElapsedMs(ewdChild.timing);
      ewdSession.setAuthenticated = function(authenticated) {
        // modification suggested by Ward De Backer, 21 June 2014
        if (typeof authenticated === 'undefined') authenticated = true;
        var data = 0;
        if (authenticated) data = 1;
        db.set({global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_authenticated'], data: data});
        ewdChild.sessionCache.deleteBySessid(sessid);
      };
      //if (ewdChild.timing) ewdChild.timing.endGetSession = EWD.getElapsedMs(ewdChild.timing);
      // Cache the last session handled by this child process
      ewdChild.sessionCache.add(sessid, token, ewdSession);
      if (!ewdChild.sessionCache.GCEvent) ewdChild.sessionCache.garbageCollect();
      return ewdSession;
    }
  },
  createSessionToken: function(tokenName, session) {
    var token = this.createToken();
    session.$(tokenName)._value = token;
    var now = Math.floor(new Date().getTime()/1000);
    if (ewdChild.EWDCompatible) now = now + 4070908800;
    var timeout = session.$('ewd_sessionTimeout')._value;
    var expiry = now + timeout;
    var node = {global: ewdChild.global.session, subscripts: ['tokensBySession', session.sessid, token], data: ''};
    db.set(node);
    var data = session.sessid + '~' + now + '~' + expiry + '~dummy';
    node = {global: ewdChild.global.session, subscripts: ['tokens', token], data: data};
    db.set(node);
    return token;
  },
  removeSessionToken: function(tokenName, session) {
    var tokenNode = session.$(tokenName);
    var token = tokenNode._value;
    var node = {global: ewdChild.global.session, subscripts: ['tokensBySession', session.sessid, token]};
    db.kill(node);
    node = {global: ewdChild.global.session, subscripts: ['tokens', token]};
    db.kill(node);
    tokenNode._delete();
  },
  updateSessionExpiry: function(session) {
    //var now = EWD.hSeconds();
    var now = Math.floor(new Date().getTime()/1000);
    if (ewdChild.EWDCompatible) now = now + 4070908800;
    var sessid = session.sessid;
    var timeout = +db.get({global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_sessionTimeout']}).data;
    var savedExpiry = db.get({global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_sessionExpiry']}).data;
    var expiry = now + timeout;
    if ((expiry - savedExpiry) > 0) {
      db.set({global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_sessionExpiry'], data: expiry});
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
    var node = {global: ewdChild.global.session, subscripts: ['session', '']};
    var sessid;
    var expiryNode;
    var expiry;
    var now = Math.floor(new Date().getTime()/1000);
    if (ewdChild.EWDCompatible) now = now + 4070908800;
    do {
      node = db.order(node);
      sessid = node.result || '';
      if (sessid !== '') {
        expiryNode = {global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_sessionExpiry']};
        expiry = db.get(expiryNode).data;
        if (expiry === '' || expiry < now) {
          this.deleteSession(sessid);
        }
      }
    }
    while (sessid !== '');
  },
  deleteSession: function(sessid) {
    var token;
    var node = {global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_wstoken']};
    token = db.get(node).data;
    if (token !== '') {
      process.send({
        pid: process.pid,
        type: 'deleteSocketClient',
        token: token
      });
      ewdChild.sessionCache.deleteByToken(token);
    }
    node = {global: ewdChild.global.session, subscripts: ['tokensBySession', sessid, '']};
    var tokensNode;
    var xsessid;
    do {
      node = db.order(node);
      token = node.result || '';
      if (token !== '') {
        tokensNode = {global: ewdChild.global.session, subscripts: ['tokens', token]};
        xsessid = db.get(tokensNode).data;
        if (xsessid !== '') {
          xsessid = xsessid.split('~')[0];
          if (xsessid !== '') db.kill(tokensNode);
        }
      }
    }
    while (token !== '');

    node = {global: ewdChild.global.session, subscripts: ['tokensBySession', sessid]};
    db.kill(node);
    node = {global: ewdChild.global.session, subscripts: ['session', sessid]};
    db.kill(node);
    node = {global: ewdChild.global.session, subscripts: ['nextPageTokens', sessid]};
    db.kill(node);
    node = {global: ewdChild.global.session, subscripts: ['action', sessid]};
    db.kill(node);
    node = {global: ewdChild.global.session, subscripts: ['jsonAccess', sessid]};
    db.kill(node);
    node = {global: ewdChild.global.session, subscripts: ['server', sessid]};
    db.kill(node);
    node = {global: ewdChild.global.session, subscripts: ['request', sessid]};
    db.kill(node);
    this.sendMessageToAppUsers({
      type: 'sessionDeleted',
      appName: 'ewdMonitor',
      content: {
        sessid: sessid
      }
    });
  },
  sendMessageToAppUsers: function(params) {
    /*
    var sessions = new mumps.GlobalNode(ewdChild.global.session,['session']);
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
    this.sendWebSocketMsg(session, {
      type: 'ewd.releaseChildProcess',
      finished: true
    });
  },
  sendWebServiceResponse: function(json, contentType, headers) {
    process.send({
      type: 'webServiceRequest',
      pid: process.pid,
      json: json,
      contentType: contentType || 'application/json',
      release: true,
      headers: headers || ''
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
  customHTTPResponse: function(responseObj) {
    var release = true;
    if (responseObj.finished === false) release = false;
    process.send({
      type: responseObj.type,
      pid: process.pid,
      json: responseObj.json,
      release: release
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
    var scratch = new ewd.mumps.GlobalNode(ewdChild.global.temp, [process.pid]);
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
  },
  clearSymbolTable: function(ewd) {
    var func = 'clearSymbolTable^' + ewd.map.routine.utils;
    return ewd.mumps.function(func);
  },
  saveSymbolTable: function(ewd, session) {
    if (!session) session = ewd.session;
    var gloRef = '^' + ewd.map.global.session + '("session",' + session.sessid + ',"ewd_symbolTable")';
    var func = 'saveSymbolTable^' + ewd.map.routine.utils;
    //console.log('**** func = ' + func + '; gloRef = ' + gloRef);
    return ewd.mumps.function(func, gloRef);
  },
  restoreSymbolTable: function(ewd, session) {
    if (!session) session = ewd.session;
    var gloRef = '^' + ewd.map.global.session + '("session",' + session.sessid + ',"ewd_symbolTable")';
    var func = 'restoreSymbolTable^' + ewd.map.routine.utils;
    return ewd.mumps.function(func, gloRef);
  }
};

module.exports = EWD;

