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

var crypto = require('crypto');

var ewdChild = {

  log: function(message) {
    console.log(message);
  },
  Custom: false,
  module: {},
  services: {},
  getModulePath: function(application) {
    var path = this.modulePath;
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
    if (!messageObj.token || messageObj.token === '') return this.errorResponse();
    var session = EWD.getSession(messageObj.token);
    if (session === '') return ewdChild.errorResponse();
    return {
      type: 'webServiceRequest',
      mgr: messageObj.type,
      params: messageObj.params,
      pid: process.pid,
      release: true
    };
  }

};

module.exports = ewdChild;
