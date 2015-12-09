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

04 December 2015

*/

var fs = require('graceful-fs');
var mime = require('mime');

var display404 = function(response) {
    response.writeHead(404, {"Content-Type" : "text/plain" });  
    response.write("404 Not Found \n");  
    response.end();  
};

var fetchFile = function(fileName, request, response) {

    if (fileName.indexOf('..') !== -1) {
      display404(response);
      return;
    }
    if (fileName.indexOf('./') !== -1) {
      display404(response);
      return;
    }
    if (fileName.indexOf('.\\') !== -1) {
      display404(response);
      return;
    }
    fs.exists(fileName, function(exists) {  
      if (!exists) {  
        display404(response); 
      }
      else {
        fs.readFile(fileName, "binary", function(err, file) {  
          if (err) {
            var errCode = 500;
            if (err.errNo === 34) errCode = 404;
            response.writeHead(errCode, {"Content-Type": "text/plain"});  
            response.write(err + "\n");  
            response.end();
          }
          else {
            fs.stat(fileName,function(err, stat) {
              var etag = stat.size + '-' + Date.parse(stat.mtime);
              if (ewd.traceLevel >= 2) console.log("etag = " + etag);
              if (request.headers['if-none-match'] === etag) {
                response.setHeader('Last-Modified', stat.mtime);
                response.statusCode = 304;
                response.end();
                return;
              }
              var contentType = mime.lookup(fileName);
              /*
              var contentType = "text/plain";
              if (fileName.indexOf(".htm") !== -1) contentType = "text/html";
              else if (fileName.indexOf(".js") !== -1) contentType = "application/javascript";
              else if (fileName.indexOf(".css") !== -1) contentType = "text/css";
              else if (fileName.indexOf(".jpg") !== -1) contentType = "image/jpeg";
              else if (fileName.indexOf(".xml") !== -1) contentType = "text/xml";
              else if (fileName.indexOf(".xsl") !== -1) contentType = "text/xml";
              */
              var xdate = new Date();
              var year = xdate.getFullYear() + 1;
              xdate = xdate.setFullYear(year);
              var expire = new Date(xdate).toUTCString();
              var headers = {
                "Content-Type": contentType, 
                "Last-Modified": stat.mtime.toUTCString(), //split("GMT")[0] + "GMT"),
                "ETag": etag,
                "Cache-Control": 'public; max-age=31536000',
                "Expires": expire
              };
              response.writeHead(200, headers);  
              response.write(file, "binary");  
              response.end();
            });
          }
        }); 
      }
    });
};

var handleFileRequest = function(httpParams) {

    var uri = httpParams.uri;
    var request = httpParams.request;
    var response = httpParams.response;

    if (uri.substr(0,ewd.webServerRootPath.length)===ewd.webServerRootPath) {
      uri = uri.substr(ewd.webServerRootPath.length);
    }

    var pieces = uri.split('/');
    // If this is a request for an EWD.js app and no file is defined
    //  append the default page (eg index.html) to the uri
    if (pieces[1] === ewd.ewdPath.replace(/\//g, '')) {
      if (pieces.length === 4 && pieces[3] === '') {
        uri = uri + ewd.defaultPage;
      }
    }

    var fileName = unescape(ewd.webServerRootPath + uri);
    if (ewd.traceLevel >= 1) console.log("Incoming HTTP request for: " + fileName);
    fetchFile(fileName, request, response);
};

var handlePrivateFileRequest = function(httpParams) {

    var uri = httpParams.uri;
    var request = httpParams.request;
    var response = httpParams.response;

    if (uri.substr(0,ewd.privateFilePath.length) === ewd.privateFilePath) {
      uri = uri.substr(ewd.privateFilePath.length);
    }
    var token = uri.substr(1);
    if (token && token !== '' && ewd.socketClientByToken[token]) {
      var clientId = ewd.socketClientByToken[token];
      if (ewd.socketClient[clientId] && ewd.socketClient[clientId].privateFilePath) {
        var path = ewd.socketClient[clientId].privateFilePath;
        if (path !== '') {
          var cwd = process.cwd();
          if (cwd.slice(-1) === '/') cwd = cwd.slice(0,-1);
          fetchFile(cwd + path, request, response);
          delete ewd.socketClient[clientId].privateFilePath;
          return;
        }
      }
    }
    display404(response);
};

module.exports = {
  handleFileRequest: handleFileRequest,
  handlePrivateFileRequest: handlePrivateFileRequest
};

