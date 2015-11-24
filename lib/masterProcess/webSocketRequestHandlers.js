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

24 November 2015

*/

var webSocketMessageHandlers = {
  
    // handlers for incoming WebSocket messages from browsers
    
    'EWD.reregister': function(messageObj, client) {
      // browser was previously connected and has sent a re-register
      // request - if token valid and session still active, re-register against
      // new client connection.  This will happen if EWD.js is restarted and
      // there are any previously-connected socket-based browsers still actively
      // sitting waiting out there
      //
      // so first step is to check the token against the current sessions
      var clientId = client.id;
      ewd.socketClient[clientId] = client;
      ewd.addToQueue({
        type: 'EWD.reregister',
        token: messageObj.token,
        clientId: clientId,
        ewd_clientId: clientId
      });
    },

    'EWD.register': function(messageObj, client) {
      if (messageObj.application && messageObj.application.name) {
        var transport = ewd.messageTransport;
        if (!messageObj.ajax) {
          ewd.socketClient[client.id] = client;
          ewd.socketClient[client.id].application = messageObj.application.name;
          if (messageObj.application.name === 'ewdMonitor') ewd.ewdMonitor[client.id] = client.id;
        }
        else {
          transport = 'ajax'
        }
        var requestObj = {
          type:'EWD.register',
          application: messageObj.application,
          messageTransport: transport
          //ewd_password: ewd.management.password
        };
        if (messageObj.ajax) {
          requestObj.ajax = true;
          requestObj.response = messageObj.response;
        }
        else {
          requestObj.clientId = client.id;
          requestObj.ewd_clientId = client.id;
        }
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
      // normalising GrapgQL messages to standard EWD.js format
      if (messageObj.messageType === ewd.GraphQL.type) {
        messageObj.service = ewd.GraphQL.module;
        if (!messageObj.params) messageObj.params = {};
        messageObj.params.ewd_type = ewd.GraphQL.type;
      }
      if (messageObj[ewd.GraphQL.type]) {
        // messageObj.GraphQL contains the query
        messageObj.params = messageObj[ewd.GraphQL.type]; // copy messageObj.GraphQL to params;
        messageObj.params.ewd_type = messageObj.messageType;
        messageObj.messageType = ewd.GraphQL.type; // 'GraphQL'
        messageObj.service = ewd.GraphQL.module;
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
};

module.exports = webSocketMessageHandlers;

