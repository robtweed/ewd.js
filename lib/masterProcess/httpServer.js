/*

 ----------------------------------------------------------------------------
 | ewd.js: EWD.js Framework                                                 |
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

5 January 2016

*/

var fs = require('graceful-fs');
var constants = require('constants');
var url = require('fast-url-parser');
var queryString = require('querystring');

var fileRequestHandler = require('./fileRequestHandler').handleFileRequest;
var startSocketIo = require('./socketServer');
var startExternalListener = require('./externalListener');

var startWebServer = function() { 

    var webServer;

    var webserverCallback = function(request, response) {
      var content = '';
      request.on("data", function(chunk) {
        content += chunk;
      });
	  
      request.once("end", function(){
        var urlObj = url.parse(request.url, true); 
        var postedData;
        if (request.headers['content-type'] === 'application/json' && request.method === 'POST') {
          try {
            postedData = JSON.parse(content);
          }
          catch(err) {
            ewd.display404(response);
            return;
          }
          for (var name in urlObj.query) {
            if (!postedData[name]) postedData[name] = urlObj.query[name];
          } 
        }
        //else if (request.headers['content-type'] === 'application/graphql' && request.method === 'POST') {
        //  postedData = content;
        //}
        else {
          postedData = queryString.parse(content);
        }
        //var contentType;
        var uri = urlObj.pathname;
        if (uri === '/favicon.ico') {
          ewd.display404(response);
          uri = null;
          urlObj = null;
          return;
        }

        var ip = request.headers['x-forwarded-for'] || 
          request.connection.remoteAddress || 
          request.socket.remoteAddress || 'Unknown';
          //request.connection.socket.remoteAddress;
        if (ip !== 'Unknown') {
          var indexOfColon = ip.lastIndexOf(':');
          ip = ip.substring(indexOfColon+1,ip.length);
        }

        var pathPrefix;
        var httpParams = {
          request: request,
          response: response,
          postedData: postedData,
          uri: uri,
          urlObj: urlObj,
          content: content,
          remoteAddress: ip
        };

        if (ewd.http.all) {
          for (pathPrefix in ewd.http.all) {
            if (uri.substr(0,pathPrefix.length) === pathPrefix) {
              ewd.http.all[pathPrefix](httpParams);
              return;
            }
          }
        }

        if (request.method === 'GET' && ewd.http.get) {
          for (pathPrefix in ewd.http.get) {
            if (uri.substr(0,pathPrefix.length) === pathPrefix) {
              ewd.http.get[pathPrefix](httpParams);
              return;
            }
          }
        }
        if (request.method === 'POST' && ewd.http.post) {
          for (pathPrefix in ewd.http.post) {
            if (uri.substr(0,pathPrefix.length) === pathPrefix) {
              ewd.http.post[pathPrefix](httpParams);
              return;
            }
          }
        }

        /*
        if (ewd.customWebServerRequestHandler) {
          var requestObj = {
            uri: uri,
            urlObj: urlObj,
            postedData: postedData,
            request: request
          };
          var ok = ewd.customWebServerRequestHandler(requestObj, response);
          if (ok) return;
        }
        */

        fileRequestHandler(httpParams);
      });
    };

    // WebServer definition - https or http

    if (ewd.https.enabled) {
      var https = require("https");
      var options = {
        key: fs.readFileSync(ewd.https.keyPath),
        cert: fs.readFileSync(ewd.https.certificatePath),
        // turn off SSL 3.0 to protect against POODLE vulnerability
        secureProtocol: 'SSLv23_method',
        secureOptions: constants.SSL_OP_NO_SSLv3,
      };
      if (ewd.traceLevel >= 1) console.log("HTTPS is enabled; listening on port " + ewd.httpPort);
      webServer = https.createServer(options, webserverCallback);
      // Start HTTP listening service for GT.M/Cache to use for WebSockets events
    }
    else {
      if (ewd.traceLevel >= 1) console.log("HTTP is enabled; listening on port " + ewd.httpPort);
      var http = require("http");
      webServer = http.createServer(webserverCallback);
    }
    webServer.on('error', function(e) {
        console.log('**** Error reported by web server: ' + e.code + ': ' + e.message + ' *****');
        if (e.code === 'EADDRINUSE' || e.code === 'EACCES') {
          console.log("**** Probably unable to open WebServer Port (" + ewd.httpPort + "): already in use");
          console.log("or you do not have permissions to use it");
          console.log("Change the port in the EWD.js Startup file to one that is available");
          console.log('EWD.js shutting down...');
          ewd.shutdown();
        }
    });

    webServer.listen(ewd.httpPort);
    //ewd.webserver = webServer;

    // now start up socket.io and message handlers
    startSocketIo(webServer);
    // startup external TCP message listener
    startExternalListener();
    // start periodic Session Clear-down / garbage collection
    ewd.sessionGC() ;
};

module.exports = startWebServer;







