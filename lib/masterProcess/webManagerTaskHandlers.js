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

var mgrTaskHandlers = {

    authenticate: function(postedData, authorization, response) {

      if (!authorization || authorization === '') return false;
      var pcs = authorization.split('-&-');
      var username = '';
      var password = '';
      var requestObj;
      if (pcs && pcs.length === 2) {
        if (pcs[0]) username = pcs[0];
        if (pcs[1]) password = pcs[1];
        if (username === '') return false;
        if (password === '') return false;
        requestObj = {
          type:'EWD.mgr.authenticate',
          username: username,
          password: password,
          response: response,
          mgtPassword: ewd.management.password
        };
      }
      else {
        requestObj = {
          type:'EWD.mgr.authenticate',
          username: 'dummy',
          password: authorization,
          response: response,
          mgtPassword: ewd.management.password
        };
      }
      ewd.addToQueue(requestObj);
      return {sendResponse: false};
    },

    setParameters: function(postedData, authorization, response) {
      // this requires a POST with an application/json payload containing the parameters object definition, eg
      //  {
      //   "traceLevel": 2
      //  }
      if (!authorization || authorization === '') return false;
      var params;
      if (postedData.params) {
        params = postedData.params;
      }
      else {
        params = postedData;
      }
      var requestObj = {
        type:'EWD.mgr.setParameters',
        token: authorization,
        response: response,
        params: params
      };
      ewd.addToQueue(requestObj);
      return {sendResponse: false};
    },

    setAvailability: function(postedData, authorization, response) {
      if (!authorization || authorization === '') return false;
      var pid = postedData.pid;
      if (!pid || pid === '') return {error: 'Invalid or missing pid'};
      if (!ewd.process[pid]) return {error: 'Child Process does not exist'};
      var available = postedData.available;
      if (available === 'false') available = false;
      if (available === 'true') available = true;
      if (available !== true && available !== false) return {error: 'Invalid or missing available value'};
      var requestObj = {
        type:'EWD.mgr.setAvailability',
        token: authorization,
        response: response,
        params: {
          pid: pid,
          available: available
        }
      };
      ewd.addToQueue(requestObj);
      return {sendResponse: false};
    },

    about: function(postedData, authorization, response) {
      if (!authorization || authorization === '') return false;
      var requestObj = {
        type:'EWD.mgr.about',
        token: authorization,
        response: response
      };
      ewd.addToQueue(requestObj);
      return {sendResponse: false};
    },

    getChildProcesses: function(postedData, authorization, response) {
      if (!authorization || authorization === '') return false;
      var requestObj = {
        type:'EWD.mgr.getChildProcesses',
        token: authorization,
        response: response
      };
      ewd.addToQueue(requestObj);
      return {sendResponse: false};
    },

    startChildProcess: function(postedData, authorization, response) {
      if (!authorization || authorization === '') return false;
      var requestObj = {
        type:'EWD.mgr.startChildProcess',
        token: authorization,
        response: response,
        params: {
          debug: postedData.debug || false
        }
      };
      ewd.addToQueue(requestObj);
      return {sendResponse: false};
    },

    stopChildProcess: function(postedData, authorization, response) {

      if (!authorization || authorization === '') return false;
      if (ewd.childProcess.poolSize > 1) {
        var pid = postedData.pid;
        if (pid && ewd.process[pid]) {
          var requestObj = {
            type:'EWD.mgr.stopChildProcess',
            token: authorization,
            response: response,
            params: {
              pid: pid
            }
          };
          ewd.addToQueue(requestObj);
          return {sendResponse: false};
        }
        else {
          return {error: 'Pid not defined or does not exist'};
        }
      }
      else {
        return {error: 'Poolsize must be 1 or greater'};
      }
    },

    exit: function(postedData, authorization, response) {
      if (!authorization || authorization === '') return false;
      var requestObj = {
        type:'EWD.mgr.exit',
        token: authorization,
        response: response
      };
      ewd.addToQueue(requestObj);
      return {sendResponse: false};
    },

    getChildProcessInfo: function(postedData, authorization, response) {

      if (!authorization || authorization === '') return false;
      var pid = postedData.pid;
      if (pid) {
        if (ewd.process[pid]) {
          if (ewd.process[pid].isAvailable) {
            var requestObj = {
              type:'EWD.mgr.getChildProcessInfo',
              pid: pid,
              token: authorization,
              response: response
            };
            ewd.addToQueue(requestObj);
            return {sendResponse: false};
          }
          else {
            return {
              json: {
                pid: pid,
                isAvailable: false
              }
            };
          }
        }
        else {
          return {error: 'No such pid: ' + pid};
        }
      }
      else {
        return {
          error: 'No pid specified'
        };
      }

    }
};

module.exports = mgrTaskHandlers;
