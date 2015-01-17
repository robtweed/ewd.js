/*
 ----------------------------------------------------------------------------
 | ewdMonitor: EWD.js Monitor Application                                   |
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
Build 12: 16 December 2014
*/

var fs = require('fs');
var crypto = require("crypto");

var password = {
  encrypt: function(password) {
    if (!password || password === '') return {error: 'Missing or invalid password'};
    var salt = crypto.randomBytes(64);
    var iterations = 10000;
    var keyLength = 64;
    var encrypted = crypto.pbkdf2Sync(password, salt, iterations, keyLength);
    return {
      hash: encrypted.toString('base64'),
      salt: salt.toString('base64')
    };
  },
  matches: function(fromUser, credentials) {
    var iterations = 10000;
    var keyLength = 64;
    var salt = new Buffer(credentials.salt, 'base64');
    var encrypted = crypto.pbkdf2Sync(fromUser, salt, iterations, keyLength);
    encrypted = encrypted.toString('base64');
    if (credentials.hash === encrypted) return true;
    return false;
  }
};

var htmlEscape = function(text) {
  return text.toString().replace(/&/g, '&amp;').
    replace(/</g, '&lt;').  // it's not neccessary to escape >
    replace(/"/g, '&quot;').
    replace(/'/g, '&#039;');
};

module.exports = {

  onMessage: {

    getLoginType: function(params, ewd) {
      var loginGlo = new ewd.mumps.GlobalNode('zewdMonitor', ['login']);
      if (loginGlo._exists) {
        return {file: 'login.html'};
      }
      else {
        return {file: 'initialLogin.html'};
      }
    },

    'EWD.form.login': function(params, ewd) {
      var loginGlo = new ewd.mumps.GlobalNode('zewdMonitor', ['login']);
      if (loginGlo._exists) {
        if (params.username === '') return 'You must enter your ewdMonitor username';
        if (params.password === '') return 'You must enter your ewdMonitor password';
        var userGlo = loginGlo.$(params.username);
        if (!userGlo._exists) return 'Invalid login attempt';
        var credentials = userGlo._getDocument();
        console.log('credentials: ' + JSON.stringify(credentials));
        if (!password.matches(params.password, credentials)) return 'Invalid login attempt';
      }
      else {
        if (params.username === '') return 'You must enter the EWD.js Management password';
        if (params.username !== params.managementPassword) return 'Invalid password';
      }

      ewd.session.setAuthenticated();
      ewd.sendWebSocketMsg({
        type: 'loggedIn',
        message: {
          ok: true
        }
      });
      return ''; 
    },

    getUsers: function(params, ewd) {
      var loginGlo = new ewd.mumps.GlobalNode('zewdMonitor', ['login']);
      var users = [];
      loginGlo._forEach(function(username) {
        users.push({
          username: username
        });
      });
      return users;
    },

    addUser: function(params, ewd) {
      if (params.username === '') return {error: 'You must enter a username'};
      if (params.password === '') return {error: 'You must enter a password'};
      if (params.mgtPassword === '') return {error: 'You must enter the EWD.js management password'};
      if (params.mgtPassword !== params.managementPassword) return {error: 'Incorrect EWD.js management password'};
      var loginGlo = new ewd.mumps.GlobalNode('zewdMonitor', ['login', params.username]);
      if (loginGlo._exists) {
        return {error: 'Username already exists'};
      }
      var hashObj = password.encrypt(params.password);
      loginGlo._setDocument(hashObj);
      return {ok: true};
    },

    changeUserPassword: function(params, ewd) {
      if (params.username === '') return {error: 'Missing username'};
      if (params.password === '') return {error: 'You did not enter a password'};
      if (params.mgtPassword === '') return {error: 'You must enter the EWD.js management password'};
      if (params.mgtPassword !== params.managementPassword) return {error: 'Incorrect EWD.js management password'};
      var loginGlo = new ewd.mumps.GlobalNode('zewdMonitor', ['login', params.username]);
      if (!loginGlo._exists) {
        return {error: 'Username does not exist'};
      }
      var hashObj = password.encrypt(params.password);
      loginGlo._setDocument(hashObj);
      return {ok: true};
    },

    deleteUser: function(params, ewd) {
      if (params.username === '') return {error: 'No username selected'};
      if (params.password === '') return {error: 'You must enter the EWD.js management password'};
      if (params.password !== params.managementPassword) return {error: 'Incorrect EWD.js management password'};
      var loginGlo = new ewd.mumps.GlobalNode('zewdMonitor', ['login', params.username]);
      if (!loginGlo._exists) {
        return {error: 'Username does not exist'};
      }
      loginGlo._delete();
      return {ok: true};
    },

    'EWD.form.importJSON': function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        if (params.globalName === '') return 'You must enter a Storage Object name';
        var str = params.globalName;
        if (str.charAt(0) === '%') str = str.substring(1);
        var regex = /[A-Za-z]/gi;
        if (str.match(regex) === null) return 'Invalid Storage Object Name';
        var json = params.json.replace(/(\r\n|\n|\r)/gm,"");
        if (json === '') return 'You must enter a JSON document';
        //console.log('json = ' + json);
        var doc;
        try {
          doc = JSON.parse(json);
        }
        catch(error) {
          return 'Invalid JSON: ' + error;
        }
        //console.log("** Global Name: " + params.globalName + ': ' + JSON.stringify(data));
        var glo = new ewd.mumps.Global(params.globalName);
        glo._setDocument(doc);
        ewd.sendWebSocketMsg({
          type: 'importJSON',
          ok: true,
          globalName: params.globalName
        });
        return '';
      }
    },

    closeSession: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        ewd.util.deleteSession(params.sessid);
      }
    },

    startConsole: function(params, ewd) {
      var logFile = ewd.logFile;
      var oldSize = ewd.session.$('logFileSize')._value;
      if (oldSize === '') oldSize = 0;

      fs.stat(logFile, function(error, info){
        if (error) {
          if (error.code=="ENOENT") {
            if (oldSize !== 0){
              ewd.session.$('logFileSize')._value = 0;
            }
          }
        }
        else {
          if (info.size !== oldSize){
            ewd.session.$('logFileSize')._value = info.size;
          }
        }
      });
      return {ok: true};
    },

    getLogTail: function(params, ewd) {

      var logFile = ewd.logFile;
      var oldSize = ewd.session.$('logFileSize')._value;
      if (oldSize === '') oldSize = 0;
      oldSize = parseInt(oldSize);
      var tail = '';

      fs.stat(logFile, function(error, info){
        if (error) {
          if (error.code=="ENOENT") {
            if (oldSize !== 0){
              ewd.session.$('logFileSize')._value = 0;
            }
          }
        }
        else {
          if (info.size !== oldSize){
            var options = {
              flags: 'r',
              encoding: 'utf8',
              fd: null,
              mode: 0666,
              autoClose: true,
              start: oldSize,
              end: info.size -1
            };
            if (info.size > oldSize) {
              try {
                var stream = fs.createReadStream(logFile, options);
                stream.on('readable', function() {
                  var buf;
                  while (buf = stream.read()) {
                    tail = tail + buf.toString();
                  }
                });
                stream.once('end', function() {
                  ewd.sendWebSocketMsg({
                    type: 'getLogTail',
                    data: tail,
                  });
                });
              }
              catch(err) {
                // file was probably reset to empty
              }
            }
            ewd.session.$('logFileSize')._value = info.size;
          }
        }
      });
    },

    deleteGlobalNode: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var node = new ewd.mumps.GlobalNode(params.globalName, params.subscripts);
        node._delete();
        return;
      }
    },

    getGlobals: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var gloArray = ewd.mumps.getGlobalDirectory();
        var data = [];
        var rec;
        for (var i = 0; i < gloArray.length; i++) {
          rec = {
            name: gloArray[i],
            type: 'folder',
            subscripts: [],
            globalName: gloArray[i],
            operation: 'db'
          };
          data.push(rec);
        }
        return data;
      }
    },

    getGlobalSubscripts: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var glo = new ewd.mumps.GlobalNode(params.globalName, params.subscripts);
        var data = {
          operation: params.operation,
          globalName: params.globalName,
          rootLevel: params.rootLevel,
          subscripts: []
        };
        if (params.sessid) data.sessid = params.sessid;
        var rec;
        var count = 0;
        var type;
        glo._forEach(function(subscript, subNode) {
          count++;
          if (count > 200) return true;
          if (subNode._hasValue) {
            type = 'folder';
            if (!subNode._hasProperties) type = 'item';
            rec = {name: htmlEscape(subscript) + '<span>: </span>' + htmlEscape(subNode._value), type: type};
          }
          else {
            rec = {name: subscript, type: 'folder'};
          }
          rec.subscripts = params.subscripts.slice(0);
          rec.subscripts.push(subscript);
          rec.operation = params.operation;
          rec.globalName = params.globalName;
          data.subscripts.push(rec);
        });
        return data;
      }
    },

    getInterfaceVersion: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        return ewd.mumps.version();
      }
    },

    getSessionData: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var session = new ewd.mumps.GlobalNode('%zewdSession', ['session', params.sessid]);
        return session._getDocument();
      }
    },

    getSessions: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var mySessid = ewd.session.$('ewd_sessid')._value;
        var ewdSessions = new ewd.mumps.GlobalNode("%zewdSession", ['session']);
        var data = [];
        var rowNo = -1;
        ewdSessions._forEach(function(sessid, session) {
          var appName = session.$('ewd_appName')._value;
          var expiry = session.$('ewd_sessionExpiry')._value;
          //expiry = (expiry - 4070908800) * 1000;
          expiry = expiry * 1000;
          var expireDate = new Date(expiry);
          rowNo++;
          var currentSession = (sessid === mySessid);
          data.push({
            rowNo: rowNo, 
            sessid: sessid, 
            appName: appName, 
            expiry: expireDate.toUTCString(), 
            currentSession: currentSession
          });
        });
        return data;
      }
    },

    keepAlive: function(params, ewd) {
      return {ok: true};
    },

    getWSUsers: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var global = new ewd.mumps.GlobalNode('%zewd',['EWDLiteServiceAccessId']);
        return global._getDocument();
      }
    },

    wsMgr_saveUser: function(params, ewd) {
      var global = new ewd.mumps.GlobalNode('%zewd',['EWDLiteServiceAccessId']);
      var userRecord;
      for (var accessId in params.obj) {
        userRecord = global.$(accessId);
        userRecord._delete();
        userRecord._setDocument(params.obj[accessId]);
      }
      return {ok: true, mode: params.mode};
    },

    wsMgr_deleteUser: function(params, ewd) {
        var global = new ewd.mumps.GlobalNode('%zewd',['EWDLiteServiceAccessId', params.target]);
        global._delete();
        return {ok: true, accessId: params.target};
    },
  }
};