/*

 ----------------------------------------------------------------------------
 | ewdFederatorMgr: EWD Federator Management Utility                        |
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

Build 1: 12 November 2014

*/

var http = require('http');
var https = require('https');
var querystring = require('querystring');
var util = require('util');
var crypto = require("crypto");

var password = {
  encrypt: function(password) {
    if (!password || password === '') return {error: 'Missing or invalid password'};
    var salt = crypto.randomBytes(64);
    var iterations = 10000;
    var keyLength = 64;
    var encrypted = crypto.pbkdf2Sync(password, salt, iterations, keyLength);
    return {
      type: 'password',
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


var restRequest = function(params, ewd, callback) {
  
  // params.path
  // params.query (object name/value pairs
  // params.method

  var queryObj = params.query;

  var restServer = ewd.session.$('restServer')._getDocument();

  var options = {
    host: restServer.host,
    port: restServer.port,
    method: params.method || 'GET',
    path: params.path
  }
  if (queryObj && queryObj !== '') {
    options.path = options.path + '?' + querystring.stringify(queryObj);
  }
  options.headers = {Authorization: restServer.password};

  var responseHandler = function(response) {
    //console.log('STATUS: ' + response.statusCode);
    //console.log('HEADERS: ' + JSON.stringify(response.headers));
    response.setEncoding('utf8');
    var data = '';
    response.on('data', function(chunk) {
      data += chunk;
    });
    response.on('end', function() {
      if (response.statusCode !== 200) {
        //console.log("*** error - response: " + util.inspect(response));
        //console.log("*** data = " + data);
        var error;
        try {
          error = JSON.parse(data);
        }
        catch(err) {
          error = data;
        }
        if (callback) callback({
          error: response.statusCode,
          data: error || ''
        });
      }
      else {
        try {
          var results = JSON.parse(data);
          if (callback) callback(false, results);
        }
        catch(err) {
          console.log('unable to parse response: ' + data);
          if (callback) callback({
            error: err
          });
        }
      }
    });
  };

  var req;
  if (restServer.ssl) {
    req = https.request(options, responseHandler);
  }
  else {
    req = http.request(options, responseHandler);
  }

  req.on('error', function(e) {
    callback({error: e.message});
  });
  req.end();
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
        var userGlo = loginGlo.$(params.username);
        if (!userGlo._exists) return 'Invalid login attempt';
        var type = userGlo.$('type')._value;
        if (params.password === '') {
          if (type !== 'ga') {
            return 'You must enter your ewdMonitor password';
          }
          else {
            return 'You must enter the current Google Authenticator Code';
          }
        }
        if (type !== 'ga') {
          var credentials = userGlo._getDocument();
          //console.log('credentials: ' + JSON.stringify(credentials));
          if (credentials.type === 'password' && !password.matches(params.password, credentials)) return 'Invalid login attempt';
        }
        else {
          var key = userGlo.$('key')._value;
          ewd.util.checkGoogleAuthenticatorCode(params.password, key, function(result) {
            if (result.error) {
              ewd.sendWebSocketMsg({
                type: 'EWD.form.login',
                ok: false,
                error: result.error,
                finished: true
              });
            }
            else {
              if (result.match) {
                ewd.sendWebSocketMsg({
                  type: 'EWD.form.login',
                  ok: true
                });
                ewd.session.setAuthenticated();
                ewd.sendWebSocketMsg({
                  type: 'loggedIn',
                  message: {
                    ok: true
                  },
                  finished: true
                });
              }
              else {
                ewd.sendWebSocketMsg({
                  type: 'EWD.form.login',
                  ok: false,
                  error: 'Invalid code!',
                  finished: true
                });
              }
            }
          });
          return {finished: false}; 
        } 
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

    getServers: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var servers = new ewd.mumps.GlobalNode('zewdFederators', []);
        if (servers._exists) {
          var list = [];
          servers._forEach(function(name) {
          list.push(name);
          });
          return {
            status: true,
            servers: list
          };
       }
        else {
          return {status: false};
        }
      }
    },

    addServer: function(params, ewd) {
      if (ewd.session.isAuthenticated) { 
        if (params.name === '') return {error: 'You must enter a Name'};
        if (params.host === '') return {error: 'You must enter a host IP Address or Name'};
        if (params.port === '') return {error: 'You must enter a Port Number'};
        if (params.port < 1) return {error: 'Invalid Port Number'};
        if (params.password === '') return {error: "You must enter the REST Server's Management Password"};
        if (params.ssl !== 'true' && params.ssl !== 'false') return {error: "Invalid SSL value"};
        params.ssl = (params.ssl === 'true');
        var servers = new ewd.mumps.GlobalNode('zewdFederators', []);
        if (servers.$(params.name)._exists) return {error: 'That name is already in use'};
        ewd.session.$('restServer')._setDocument(params, true);
        var request = {
          path: '/_mgr/info',
        };
        restRequest(request, ewd, function(error, response) {
          if (error) {
            //console.log("error: " + JSON.stringify(error));
            ewd.sendWebSocketMsg({
              type: 'addServer',
              message: error
            });
          }
          else {
            //console.log("response: " + JSON.stringify(response, null, 2));
            if (response.product === 'ewd-federator') {
              //var servers = new ewd.mumps.GlobalNode('zewdFederators', []);
              servers.$(params.name)._setDocument(params, true);
              ewd.sendWebSocketMsg({
                type: 'addServer',
                message: {
                  success: true,
                  response: response
                }
              });
            }
            else {
              ewd.sendWebSocketMsg({
                type: 'addServer',
                message: {
                  error: 'Invalid Server'
                }
              });
            }
          }
        });
      }
    },

    connect: function(params, ewd) {
      if (!ewd.session.isAuthenticated) return;
      if (params.name && params.name !== '') {
        var servers = new ewd.mumps.GlobalNode('zewdFederators', [params.name]);
        if (servers._exists) {
          var server = servers._getDocument();
          ewd.session.$('restServer')._setDocument(server, true);
          var request = {
            path: '/_mgr/info',
          };
          restRequest(request, ewd, function(error, response) {
            if (error) {
              console.log("**** error: " + JSON.stringify(error));
              var errorText = '';
              if (error.data && error.data.message) errorText = error.data.message;
              if (error.error && error.error === 'connect ECONNREFUSED') errorText = 'Unable to connect to selected EWD Federator'
              ewd.sendWebSocketMsg({
                type: 'connect',
                message: {
                  error: error.error,
                  errorText: errorText
                }
              });
            }
            else {
              ewd.session.$('restServer').$('info')._setDocument(response, true);
              ewd.sendWebSocketMsg({
                type: 'connect',
                message: {
                  info: response
                }
              });
            }
          });
        }
        else {
          return {error: 'Invalid Federator Name'};
        }
      }
      else {
        return {error: 'Federator name not specified'};
      }
    },

    halt: function(params, ewd) {
      if (!ewd.session.isAuthenticated) return;
      var request = {
        path: '/_mgr/halt',
      };
      restRequest(request, ewd, function(error, response) {
        if (error) {
          console.log("**** error: " + JSON.stringify(error));
          ewd.sendWebSocketMsg({
            type: 'halt',
            message: {
              error: error.error
            }
          });
        }
        else {
          ewd.sendWebSocketMsg({
            type: 'halt',
            message: {
              info: response
            }
          });
        }
      });
    },

    getDBInfo: function(params, ewd) {
      if (!ewd.session.isAuthenticated) return;
      var request = {
        path: '/_mgr/getDBInfo',
      };
      restRequest(request, ewd, function(error, response) {
        console.log("getDBInfo response: " + JSON.stringify(response));
        ewd.sendWebSocketMsg({
          type: 'getDBInfo',
          message: {
            database: response
          }
        });
      });
    },

    startChildProcess: function(params, ewd) {
      if (!ewd.session.isAuthenticated) return;
      var request = {
        path: '/_mgr/childProcess',
        method: 'PUT'
      };
      restRequest(request, ewd, function(error, response) {
        console.log("startChildProcess response: " + JSON.stringify(response));
        var cps = ewd.session.$('restServer').$('info').$('childProcesses');
        var cpArr = cps._getDocument();
        cpArr.push(response.pid);
        cps._delete();
        cps._setDocument(cpArr, true);
        ewd.sendWebSocketMsg({
          type: 'startChildProcess',
          ok: true,
          pid: response.pid
        });
      });
    },

    getGlobals: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var request = {
          path: '/_mgr/globalDirectory',
        };
        restRequest(request, ewd, function(error, response) {
          console.log("getGlobals response: " + JSON.stringify(response));
          ewd.sendWebSocketMsg({
            type: 'getGlobals',
            message: {
              globals: response
            }
          });
        });
      }
    },

    getGlobalSubscripts: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        console.log('** getGlobalSubscripts sending message with query = ' + JSON.stringify(params));
        var request = {
          path: '/_mgr/globalSubscripts',
          query: {
            rootLevel: params.rootLevel,
            operation: params.operation,
            globalName: params.globalName,
            subscripts: JSON.stringify(params.subscripts)
          }
        };
        restRequest(request, ewd, function(error, response) {
          console.log("getGlobalSubscripts response: " + JSON.stringify(response));
          ewd.sendWebSocketMsg({
            type: 'getGlobalSubscripts',
            message: {
              subscripts: response
            }
          });
        });
      }
    },

    getInternals: function(params, ewd) {
      var request = {
        path: '/_mgr/internals',
        method: 'GET'
      };
      restRequest(request, ewd, function(error, response) {
        ewd.sendWebSocketMsg({
          type: 'getInternals',
          message: response
        });
      });
    },

    stopFederatorChildProcess: function(params, ewd) {
      var pid = params.pid;
      var request = {
        path: '/_mgr/childProcess',
        method: 'DELETE',
        query: {
          pid: pid
        }
      };
      (function(pid) {
        restRequest(request, ewd, function(error, response) {
          console.log("stopFederatorChildProcess response: " + JSON.stringify(response));
          var cps = ewd.session.$('restServer').$('info').$('childProcesses');
          var cpArr = cps._getDocument();
          var newArr = [];
          for (var i = 0; i < cpArr.length; i++) {
            if (cpArr[i] !== pid) newArr.push(cpArr[i]);
          }
          cps._delete();
          cps._setDocument(newArr, true);
          ewd.sendWebSocketMsg({
            type: 'stopFederatorChildProcess',
            ok: true,
            pid: pid
          });
        });
      }(pid));
    },

    getMemory: function(params, ewd) {
      var serverInfo = ewd.session.$('restServer').$('info')._getDocument();
      var pid = serverInfo.masterProcess;
      var request = {
        path: '/_mgr/memory',
        query: {
          pid: pid
        }
      };       
      (function(pid) {
        restRequest(request, ewd, function(error, response) {
          //console.log("getMemory response: " + JSON.stringify(response));
          ewd.sendWebSocketMsg({
            type: 'getMemory',
            pid: pid,
            childProcess: false,
            memory: response
          });
        });
      }(pid));

      for (var i = 0; i < serverInfo.childProcesses.length; i++) {
        pid = serverInfo.childProcesses[i];
        request = {
          path: '/_mgr/memory',
          query: {
            pid: pid
          }
        };       
        (function(pid) {
          restRequest(request, ewd, function(error, response) {
            //console.log("getMemory response: " + JSON.stringify(response));
            ewd.sendWebSocketMsg({
              type: 'getMemory',
              pid: pid,
              childProcess: true,
              memory: response
            });
          });
        }(pid));
      }
    }
  }
};