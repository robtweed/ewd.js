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

18 November 2015

*/

var fs = require('graceful-fs');

var sendResponse = function(json, response) {
  var header = {
    'Date': new Date().toUTCString(),
    'Content-Type': 'application/json'
  };
  response.writeHead(200, header);
  response.write(JSON.stringify(json));
  response.end();
};

var getFragment = function(params, httpParams) {
      //var clientId = ewd.socketClientByToken[params.token];
      //console.log('getFragment: clientId = ' + clientId);
      //var application;
      //if (clientId) application = ewd.socketClient[clientId].application;
      var application = params.application;
      if (!application) {
        ewd.errorResponse({error: 'Application not defined'}, httpParams.response);
        return;
      }
      //console.log('getFragment: application = ' + application);
      var file = params.params.file;
      var fragPath = ewd.webServerRootPath + '/ewd/' + application + '/' + file;
      if (params.params.isServiceFragment) {
        fragPath = ewd.webServerRootPath + '/services/' + file;
      }
      fs.exists(fragPath, function(exists) { 
        //console.log('fs.exists - params = ' + JSON.stringify(params));
        if (exists) {
          fs.readFile(fragPath, 'utf8', function(err, data) {
            //console.log('readFile - params = ' + JSON.stringify(params));
            if (!err) {
              var response = httpParams.response;
              var json = {
                type: params.type,
                message: {
                  content: data,
                  targetId: params.params.targetId,
                  file: file,
                  extra: params.params.extra
                }
              };
              sendResponse(json, httpParams.response);
            }
          });
        }
        else { // SJT inform of failure to load 
          var message = {
            error: true,
            file: file
          };
          if (params.params.isServiceFragment) {
            message.isServiceFragment = true;
          }
          var json = {
            type: params.type,
            message: message
          };
          sendResponse(json, httpParams.response);
        }
      });
};

var handleAjaxRequest = function(httpParams) {

    var content = httpParams.content;
    var response = httpParams.response;

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

    if (params.type === 'EWD.register') {
      /*
      var client = {
        id: params.clientId
      }
      */
      params.response = response;
      params.ajax = true;
      ewd.webSocketMessageHandlers[params.type](params); // , client);
      return;
    }

    if (params.type === 'EWD.getFragment') {
      getFragment(params, httpParams);
      return;
    }

    //ewd.log("incoming Ajax request - data: " + content, null, 2), 1);
    //if (params.token && ewd.socketClientByToken[params.token]) {
    if (params.token) {
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
};

module.exports = handleAjaxRequest;

