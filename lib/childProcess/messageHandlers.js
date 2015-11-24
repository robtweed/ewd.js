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

  24 November 2015

*/

var domain = require('domain');
var fs = require('fs');
var initialise = require('./initialise');

var messageHandlers = {

    // handlers for incoming messages, by type

    initialise: initialise,

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

    'EWD.reregister': function(messageObj) {
      var clientId = messageObj.ewd_clientId;
      var token = messageObj.token;
      var session = EWD.getSession(token);
      if (session === '') {
        return {
          ok: false,
          clientId: clientId
        };
      }
      // re-register session against new client Id
      session.$('ewd_clientId')._value = clientId;
      return {
        ok: true,
        token: messageObj.token,
        clientId: clientId,
        appName: session.$('ewd_appName')._value
      };
    },

    'EWD.register': function(messageObj) {
      var node = {global: ewdChild.global.sessionNo, subscripts: ['nextSessid']};
      var sessid = db.increment(node).data;
      node = {global: ewdChild.global.session, subscripts: ['session', sessid]};
      db.kill(node);

      /*
      var sessionCounter = new mumps.GlobalNode(ewdChild.global.sessionNo, ['nextSessid']);
      var sessid = sessionCounter._increment();
      var session = new mumps.GlobalNode(ewdChild.global.session, ['session', sessid]);
      session._delete();
      */

      var token = EWD.createToken();
      //var now = EWD.hSeconds();
      var now = Math.floor(new Date().getTime()/1000);
      if (ewdChild.EWDCompatible) now = now + 4070908800;
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
        //ewd_clientId: messageObj.ewd_clientId
      };
      if (messageObj.ewd_clientId) params.ewd_clientId = messageObj.ewd_clientId
      for (var name in params) {
        node = {global: ewdChild.global.session, subscripts: ['session', sessid, name], data: params[name]};
        db.set(node);
      }
      //session._setDocument(params);    
      if (ewdChild.EWDCompatible) expiry = expiry - 4070908800;
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

      node = {global: ewdChild.global.session, subscripts: ['tokensBySession', sessid, token], data: ''};
      db.set(node);
      var data = sessid + '~' + now + '~' + expiry + '~dummy';
      node = {global: ewdChild.global.session, subscripts: ['tokens', token], data: data};
      db.set(node);

      /*
      var tokensBySession = new mumps.GlobalNode(ewdChild.global.session, ['tokensBySession', sessid]);
      tokensBySession.$(token)._value = '';
      var tokens = new mumps.GlobalNode(ewdChild.global.session, ['tokens']);
      tokens.$(token)._value = sessid + '~' + now + '~' + expiry + '~dummy';
      */
      return {
        sessid: sessid,
        token: token,
        application: application.name,
        messageTransport: messageObj.messageTransport
      };
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
      var node = {global: ewdChild.global.session, subscripts: ['session', '']};
      var sessid;
      var xNode;
      var token;
      var clientId;
      do {
        node = db.order(node);
        sessid = node.result || '';
        if (sessid !== '') {
          xNode = {global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_wstoken']};
          token = db.get(xNode).data;
          if (token && token !== '' && !EWD.isTokenExpired(token)) {
            xNode = {global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_clientId']};
            clientId = db.get(xNode).data;
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
      var sessions = new mumps.GlobalNode(ewdChild.global.session,['session']);
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
      var zewd = new mumps.GlobalNode(ewdChild.global.zewd, ['ewdjs', ewdChild.httpPort]);
      zewd.$('management').$('password')._value = messageObj.password;
      var sessions = new mumps.GlobalNode(ewdChild.global.session,['session']);
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
      var loginGlo = new mumps.GlobalNode(ewdChild.global.monitor, ['login']);
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
          globals: mumps,
          db: db,
          log: ewdChild.log,
          logFile: ewdChild.logFile,
          database: ewdChild.database.type,
          map: {
            global: ewdChild.global,
            routine: ewdChild.routine,
          },
          util: EWD,
          ipAddress: messageObj.ipAddress,
          module: ewdChild.module,
          modulePath: ewdChild.modulePath,
          sendWebSocketMsg: function(content) {
            EWD.sendWebSocketMsg(this.session, content);
          },
          releaseChildProcess: function() { 
            EWD.releaseChildProcess(this.session);
          },
          webSocketMessage: {
            type: type,
            params: messageObj.params
          },
          GraphQL: ewdChild.GraphQL,
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
        var node = {global: ewdChild.global.sessionNo, subscripts: ['EWDLiteServiceAccessId', messageObj.query.accessId]}; 
        var node2 = {global: ewdChild.global.sessionNo, subscripts: ['EWDLiteServiceAccessId', messageObj.query.accessId, 'apps', messageObj.appName]}; 

        //var auth = new mumps.GlobalNode(ewdChild.global.sessionNo, ['EWDLiteServiceAccessId', messageObj.query.accessId]);
        //if (!auth._exists) {
        if (db.data(node).defined === 0) {
          return {error: messageObj.query.accessId + ' is not authorised for Web Service access'};
        }
        //else if (!auth.$('apps').$(messageObj.appName)._exists) {
        if (db.data(node2).defined === 0) {
          return {error: messageObj.query.accessId + ' is not allowed access to the ' + messageObj.appName + ' application'};
        }
        node = {global: ewdChild.global.sessionNo, subscripts: ['EWDLiteServiceAccessId', messageObj.query.accessId, 'secretKey']};
        var secretKey = db.get(node).data; 
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
        headers: messageObj.headers,
        method: messageObj.method,
        mumps: mumps,
        globals: mumps,
        db: db,
        util: EWD,
        module: ewdChild.module,
        log: ewdChild.log,
        logFile: ewdChild.logFile,
        map: {
          global: ewdChild.global,
          routine: ewdChild.routine,
        },
        sendWebServiceResponse: function(json, contentType) {
          EWD.sendWebServiceResponse(json, contentType);
        },
        GraphQL: ewdChild.GraphQL,
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
      var node = {global: ewdChild.global.session, subscripts: ['session', '']};
      var sessid;
      var xnode;
      do {
        node = db.order(node);
        sessid = node.result || '';
        if (sessid !== '') {
          if (messageObj.recipients === 'byApplication') {
            xnode = {global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_appName']};
            if (db.get(xnode).data === messageObj.application) {
              xnode = {global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_wstoken']};
              tokenArray.push(db.get(xnode).data);
            }
          }
          if (messageObj.recipients === 'bySession') {
            if (messageObj.session && (messageObj.session instanceof Array)) {
              var ok = true;
              for (var i = 0; i < messageObj.session.length; i++) {
                xnode = {global: ewdChild.global.session, subscripts: ['session', sessid, messageObj.session[i].name]};
                ok = ok && (db.get(xnode).data === messageObj.session[i].value);
              }
              if (ok) {
                xnode = {global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_wstoken']};
                tokenArray.push(db.get(xnode).data);
              }
            }
          }
          if (messageObj.recipients === 'all') {
            xnode = {global: ewdChild.global.session, subscripts: ['session', sessid, 'ewd_wstoken']};
            tokenArray.push(db.get(xnode).data);
          }
        }
      }
      while (sessid !== '');
      /*
      var sessions = new mumps.GlobalNode(ewdChild.global.session, ['session']);
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

};

module.exports = messageHandlers;


