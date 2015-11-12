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

var mgrTaskHandlers = require('./webManagerTaskHandlers');

var handleWebMgrRequest = function(httpParams) {

    if (!ewd.management.httpAccess.enabled) return;

    var uri = httpParams.uri;
    var urlObj = httpParams.urlObj;
    var postedData = httpParams.postedData;
    var request = httpParams.request;
    var response = httpParams.response;

    if (ewd.traceLevel >= 1) console.log("incoming management request URL: " + uri);
    if (request.method.toLowerCase() === 'get') postedData = urlObj.query;

    var authorization = request.headers.authorization || '';
    var task = uri.split('/');
    if (task && task[2]) task = task[2];
    if (mgrTaskHandlers[task]) {
      var json = mgrTaskHandlers[task](postedData, authorization, response);
      if (json) {
        if (json.sendResponse === false) {
          // don't do anything - the handler function is looking after the response for us
        }
        else if (json.error) {
          ewd.errorResponse({error: json.error}, response);
        }
        else {
          response.writeHead(200, {'Content-Type': 'application/json'});
          response.write(JSON.stringify(json, null, 2));
          response.end();
        }
      }
      else {
        ewd.display404(response);
      }
    }
    else {
      ewd.display404(response);
    }
};

module.exports = handleWebMgrRequest;

