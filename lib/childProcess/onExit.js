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

  18 November 2015

*/

var onExit = function() {

  if (ewdChild.database) {
    try {
      db.close();
    }
    catch(err) {}
  }
  if (ewdChild.traceLevel >= 2) console.log('*** ' + process.pid + ' closed ' + ewdChild.database.type);
  if (ewdChild.database.also && ewdChild.database.also.length > 0) {
    if (ewdChild.database.also[0] === 'mongodb') {
      if (mongoDB) mongoDB.close();
    }
  }
  if (ewdChild.sessionCache.GCEvent) clearTimeout(ewdChild.sessionCache.GCEvent);
  if (ewdChild.Custom && ewdChild.Custom.onExit) {
    ewdChild.Custom.onExit();
  }
};

module.exports = onExit;
