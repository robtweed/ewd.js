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

var handleWebServiceRequest = function(params) {

    var uri = params.uri;
    var urlObj = params.urlObj;
    var request = params.request;
    var postedData = params.postedData;
    var response = params.response;

    if (ewd.traceLevel >= 1) console.log("incoming JSON Web Service request: " + uri);
    //console.log("*** postedData = " + postedData + '***');
    var pieces = uri.split('/');
    var appName = pieces[2];
    if (!appName) {
      ewd.errorResponse({error: 'Application Name not specified'}, response);
      return;
    }
    var serviceName = pieces[3];
    if (!serviceName) {
      ewd.errorResponse({error: 'Service Name not specified'}, response);
      return;
    }
    var query = urlObj.query;
    if (ewd.traceLevel >= 2) console.log("JSON WS: query = " + JSON.stringify(query));
    if (ewd.traceLevel >= 2) console.log("JSON WS: app: " + appName + "; service: " + serviceName);

    if (ewd.webservice.authenticate) {
      if (!query.accessId || !query.signature || !query.timestamp) {
        ewd.errorResponse({error: 'Missing Access Credentials'}, response);
        return;
      }
      if (!(new Date(query.timestamp).getFullYear() > 0)) {
        ewd.errorResponse({error: 'Invalid timestamp'}, response);
        return;
      }
    }

    var requestObj = {
      type:'webServiceRequest',
      appName: appName,
      serviceName: serviceName,
      query: query,
      uri: uri,
      host: request.headers.host,
      headers: request.headers,
      method: request.method,
      response: response,
      post_data: postedData
    };
    ewd.addToQueue(requestObj);
};

module.exports = handleWebServiceRequest;

