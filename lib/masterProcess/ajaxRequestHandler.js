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

10 November 2015

*/

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
      if (ewd.traceLevel >= 2) console.log(error); 
      ewd.errorResponse({error: error}, response);
      return;
    }
};

module.exports = handleAjaxRequest;

