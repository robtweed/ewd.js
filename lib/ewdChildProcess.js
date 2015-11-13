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

  Build 85; 12 November 2015

*/

global.EWD = require('./childProcess/EWD');
global.ewdChild = require('./childProcess/ewdChild');
ewdChild.messageHandlers = require('./childProcess/messageHandlers');
var onMessage = require('./childProcess/onMessage');
var onExit = require('./childProcess/onExit');

// Handle incoming messages

process.on('message', onMessage);

// Child process shutdown handler - close down database cleanly

process.on('exit', onExit);

// trap CTRL & C to prevent premature exit

process.on( 'SIGINT', function() {
  console.log('Child Process ' + process.pid + ' detected SIGINT (Ctrl-C) - ignored');
});
process.on( 'SIGTERM', function() {
  console.log('Child Process ' + process.pid + ' detected SIGTERM signal - ignored');
});


// kick off the master process's initialisation sequence 
//  now that this Child Process has started

process.send({
  type: 'childProcessStarted', 
  pid: process.pid
});

// OK, this child process is ready for use;

console.log('Child process ' + process.pid + ' has started');
