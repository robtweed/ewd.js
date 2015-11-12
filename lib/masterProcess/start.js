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

  12 November 2015

*/


var start = function(params, callback) {
    if (process.argv.indexOf('debug') !== -1) {
      if (!params) params = {};
      if (!params.debug) params.debug = {};
      params.debug.enabled = true;
    }
    require('./defaults')(params);

    ewd.http = {
      all: {},
      get: {},
      post: {}
    };
    // /json
    ewd.http.all[ewd.webservice.json.path] = require('./webServiceRequestHandler');
    // /ajax
    ewd.http.all[ewd.ajax.path] = require('./ajaxRequestHandler');
    // /privateFiles
    //   incoming requests for private file must be tokenised single-shot URL
    //    eg example URL /privateFiles/khqwkhqwhequyiyiuy
    ewd.http.all[ewd.privateFilePath] = require('./fileRequestHandler').handlePrivateFileRequest;
    // /ewdjsMgr
    //  incoming management requests must be accompanied by valid password or ignored
    //    eg example URL /ewdjsMgr?password=xxxxxxxx&task=value
    ewd.http.all[ewd.management.httpAccess.path] = require('./webManagerRequestHandler');

    ewd.mgrTask = require('./ewdManagerTasks');
    ewd.systemMessageHandlers = require('./systemMessageHandlers');
    ewd.webSocketMessageHandlers = require('./webSocketRequestHandlers');
    ewd.childProcessMessageHandlers = require('./workerResponseHandlers');

    ewd.startWebServer = require('./httpServer');
    ewd.startChildProcess = require('./childProcessLoader');

    ewd.queueEvent.on("processQueue", ewd.processQueue);
	
    console.log('   ');
    console.log('********************************************');
    console.log('**** EWD.js Build ' + ewd.buildNo + ' (' + ewd.buildDate + ') *******');
    console.log('********************************************');
    console.log('  ');
    console.log('Started: ' + ewd.started);
    console.log('Master process: ' + process.pid);
    console.log(ewd.childProcess.poolSize + ' child Node processes will be started...');

    // start child processes which, in turn, starts web server
    ewd.startChildProcess(0, ewd.debug.enabled); // ******

    process.on( 'SIGINT', function() {
      console.log('*** CTRL & C detected: shutting down gracefully...');
      ewd.mgrTask['EWD.mgr.exit']();  // ******
    });

    process.on( 'SIGTERM', function() {
      console.log('*** Master Process ' + process.pid + ' detected SIGTERM signal.  Shutting down gracefully...');
      ewd.mgrTask['EWD.mgr.exit'](); // *******
    });

    if (callback) callback();

};

module.exports = start;
