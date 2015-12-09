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

var ewdDefaultParams = function(cwd) {
    return {
      childProcess: {
        poolSize: 2,
        path: __dirname + '/../ewdChildProcess.js',
        //path: './../ewdChildProcess.js',
        auto: true,
        maximum: 4,
        idleLimit: 1800000, // half an hour
        unavailableLimit: 600000, // 10 minutes
        customModule: false
      },
      os: 'linux',
      name: 'EWD.js Server',
      database: {
        type: 'gtm',
      },
      debug: {
        enabled: false,
        child_port: 5859,
        web_port: 8081
      },
      ewdPath: '/ewd/',
      defaultPage: 'index.html',
      //ewdGlobalsPath: './ewdGlobals',
      ewdGlobalsPath: 'globalsjs',
      http: {},
      httpPort: 8080,
      https: {
        enabled: false,
        keyPath: cwd + '/ssl/ssl.key',
        certificatePath: cwd + '/ssl/ssl.crt',
      },
      messageTransport: 'websockets',
      webSockets: {
        path: '/ewdWebSocket/',
        socketIoPath: 'socket.io',
        externalListenerPort: 10000,
        maxDisconnectTime: 3600000
      },
      checkForUpdates: true,
      EWDCompatible: false,
      logFile: '/var/log/ewdjs.log',
      logTo: 'console',
      logHTTP: false,
      modulePath: cwd + '/node_modules',
      servicePath: '/services',
      monitorInterval: 30000,
      sessionGCInterval: 300000,
      silentStart: false,
      traceLevel: 1,
      webServerRootPath: cwd + '/www',
      privateFilePath: '/privateFiles',
      webservice: {
        json: {
          path: '/json'
        },
        authenticate: true
      },
      management: {
        httpAccess: {
          path: '/ewdjsMgr',
          enabled: true
        },
        password: 'makeSureYouChangeThis!'
      },
      ajax: {
        path: '/ajax'
      },
      webRTC: {
        enabled: false,
        resources: {
          screen: false,
          video: true,
          audio: false
        }
      },
      ntp: {
        host: 'pool.ntp.org',
        port: 123
      },
      globalMap: {
        session: '%zewdSession',
        zewd: 'zewd',
        sessionNo: '%zewd',
        temp: '%zewdTemp',
        monitor: 'zewdMonitor'
      },
      routineMap: {
        utils: 'ewdjsUtils'
      },
      GraphQL: {
        schema: 'GraphQLSchema',
        module: 'GraphQLServer',
        type: 'GraphQL'
      }
    };

};

var setPropertyDefaults = function(property,defaults, params) {
    var name;
    ewd[property] = {};
    for (name in defaults[property]) {
      ewd[property][name] = defaults[property][name];
      if (params && typeof params[property] !== 'undefined') {
        if (typeof params[property][name] !== 'undefined') ewd[property][name] = params[property][name];
      }
    }
};

var setDefaults = function(defaults, params) {
    var name;
    //var value;
    var subDefaults = {
      childProcess: '',
      database: '',
      https: '',
      webSockets: '',
      management: '',
      webRTC: '',
      webservice: '',
      ntp: '',
      debug: '',
      ajax: '',
      globalMap: '',
      routineMap: '',
      GraphQL: ''
    };
    if (params.database && params.database.type === 'cache') {
      if (params.database.ip_address) {
        defaults.database.ip_address = params.database.ip_address;
        defaults.database.tcp_port = 1972;
      }
    }
    for (name in defaults) {
      if (typeof subDefaults[name] !== 'undefined') {
        setPropertyDefaults(name, defaults, params);
      }
      else {
        ewd[name] = defaults[name];
        if (params && typeof params[name] !== 'undefined') ewd[name] = params[name];
      }
    }
    if (ewd.database.type === 'globals') ewd.database.type = 'cache';
    if (params.database && params.database.also) {
      ewd.database.also = params.database.also;
      if (ewd.database.also.length > 0 && ewd.database.also[0] === 'mongodb') {
        ewd.database.address = params.database.address || 'localhost';
        ewd.database.port = params.database.port || 27017;
      }
    }
};

var defaults = function(params) {

    var cwd = params.cwd || process.cwd();
    if (cwd.slice(-1) === '/') cwd = cwd.slice(0,-1);

    var defaults = ewdDefaultParams(cwd);

    if (params) {
      if (!params.childProcess) params.childProcess = {};
      if (params.database) {
        if (typeof params.database.type !== 'undefined') defaults.database.type = params.database.type;
        if (params.database.type === 'noDB' || params.database.nodePath === 'noDB') {
          params.database.type = 'gtm';
          params.database.nodePath = 'noDB';
          params.childProcess.poolSize = 1;
          params.childProcess.maximum = 1;
          params.childProcess.auto = false;
        }
      }
      if (typeof params.os !== 'undefined') defaults.os = params.os;
    }
    if (defaults.database.type === 'cache' || defaults.database.type === 'globals') {
      defaults.database = {
        type: 'cache',
        nodePath: 'cache',
        username: '_SYSTEM',
        password: 'SYS',
        namespace: 'USER',
        charset: 'UTF-8',
        lock: 0
      };
      if (defaults.os === 'windows') {
        defaults.database.path = 'c:\\InterSystems\\Cache\\Mgr';
      }
      else {
        defaults.database.path = '/opt/cache/mgr';
      }
    }
    if (defaults.database.type === 'gtm') {
      defaults.database = {
        type: 'gtm',
        nodePath: 'nodem',
      };
    }
    if (defaults.database.type === 'mongodb') {
      defaults.database = {
        type: 'mongodb',
        nodePath: 'mongo',
        address: 'localhost',
        port: 27017
      };
    }
    //if (defaults.poolSize && !defaults.childProcess.poolSize) defaults.childProcess.poolSize = defaults.poolSize;
    if (params) {
      if (params.poolSize && params.childProcess && !params.childProcess.poolSize) params.childProcess.poolSize = params.poolSize;
      if (params.childProcess.poolSize) {
        if (!params.childProcess.maximum && params.childProcess.poolSize > defaults.childProcess.maximum) {
          params.childProcess.maximum = params.childProcess.poolSize;
        }
      }
    }
    setDefaults(defaults, params);
    
    if (ewd.debug.enabled) {
      var cp = ewd.childProcess;
      cp.poolSize = 1;
      cp.maximum = 1;
      cp.auto = false;
    } 
};

module.exports = defaults;
