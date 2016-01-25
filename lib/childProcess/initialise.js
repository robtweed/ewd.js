/*
 ----------------------------------------------------------------------------
 | ewdChildProcess: Child Worker Process for EWD.js                         |
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

  24 January 2016

*/

var initialise = function(messageObj) {
      var database;
      var mongo;
      var mongoDB; 
      var params = messageObj.params;
      // initialising this worker process
      ewdChild.httpPort = params.httpPort;
      if (ewdChild.traceLevel >= 3) console.log(process.pid + " initialise: params = " + JSON.stringify(params));
      ewdChild.buildNo = params.buildNo;
      ewdChild.checkForUpdates = params.checkForUpdates;
      ewdChild.EWDCompatible = params.EWDCompatible;
      ewdChild.ewdGlobalsPath = params.ewdGlobalsPath;
      ewdChild.nodePath = params.nodePath;
      ewdChild.logTo = params.logTo;
      ewdChild.logFile = params.logFile;
      ewdChild.startTime = params.startTime;
      ewdChild.database = params.database;
      ewdChild.webSockets = params.webSockets;
      ewdChild.traceLevel = params.traceLevel;
      ewdChild.logToBrowser = params.logToBrowser;
      ewdChild.webServerRootPath = params.webServerRootPath;
      ewdChild.management = params.management;
      ewdChild.lite = params.lite;
      ewdChild.homePath = params.homePath;
      ewdChild.webservice = params.webservice;
      var hNow = params.hNow;
      ewdChild.modulePath = params.modulePath;
      ewdChild.ntp = params.ntp;
      ewdChild.global = params.globalMap;
      ewdChild.routine = params.routineMap;
      ewdChild.GraphQL = params.GraphQL;
      var mumps = require(ewdChild.ewdGlobalsPath);
      global.mumps = mumps;
      global.globals = mumps;
      if (ewdChild.database.type === 'mongodb') ewdChild.database.nodePath = 'mongoGlobals';
      var globals;
      try {
        globals = require(ewdChild.database.nodePath);
      }
      catch(err) {
        console.log("**** ERROR: The database gateway module " + ewdChild.database.nodePath + ".node could not be found or loaded");
        console.log(err);
        process.send({
          pid: process.pid, 
          type: 'firstChildInitialisationError'
        });
        return;
      }
      var dbStatus;
      if (ewdChild.database.type === 'cache') {
        database = new globals.Cache();
        dbStatus = database.open(ewdChild.database);
        if (dbStatus.ErrorMessage) {
          console.log("*** ERROR: Database could not be opened: " + dbStatus.ErrorMessage);
          if (dbStatus.ErrorMessage.indexOf('unexpected error') !== -1) {
            console.log('It may be due to file privileges - try starting using sudo');
          }
          else if (dbStatus.ErrorMessage.indexOf('Access Denied') !== -1) {
            console.log('It may be because the Callin Interface Service has not been activated');
            console.log('Check the System Management Portal: System - Security Management - Services - %Service Callin');
          }
          process.send({
            pid: process.pid, 
            type: 'firstChildInitialisationError'
          });
          return;
        }
      }
      else if (ewdChild.database.type === 'gtm') {
        database = new globals.Gtm();
        dbStatus = database.open();
        if (dbStatus && dbStatus.ok !== 1) console.log("**** dbStatus: " + JSON.stringify(dbStatus));
        database.namespace = '';
        var node = {global: ewdChild.global.sessionNo, subscripts: ['nextSessid']}; 
        var test = database.get(node);
        if (test.ok === 0) {
          console.log('*** ERROR: Global access test failed: Code ' + test.errorCode + '; ' + test.errorMessage);
          if (test.errorMessage.indexOf('GTMCI') !== -1) {
            console.log('***');
            console.log('*** Did you start EWD.js using "node ewdStart-gtm gtm-config"? ***');
            console.log('***');
          } 
          process.send({
            pid: process.pid, 

            type: 'firstChildInitialisationError'
          });
          return;
        }
      }
      else if (ewdChild.database.type === 'mongodb') {
        mongo = require('mongo');
        mongoDB = new mongo.Mongo();
        database = new globals.Mongo();
        global.mongoDB = mongoDB;
        dbStatus = database.open(mongoDB, {address: ewdChild.database.address, port: ewdChild.database.port});
        database.namespace = '';
      }
      if (database.also && database.also.length > 0) {
        if (database.also[0] === 'mongodb') {
          mongo = require('mongo');
          mongoDB = new mongo.Mongo();
          global.mongoDB = mongoDB;
          mongoDB.open({address: ewdChild.database.address, port: ewdChild.database.port});
        }
      }
      mumps.init(database);

      // ********************** Load Global Indexer *******************
      try {
        //var path = ewdChild.getModulePath('globalIndexer');
        //var indexer = global.EWD.requireAndWatch(path);
        var indexer = EWD.requireAndWatch('globalIndexer');
        indexer.start(mumps);
        //if (ewdChild.traceLevel >= 2) console.log("** Global Indexer loaded: " + path);
      }
      catch(err) {}
      // ********************************************************
  
      var zewd = new mumps.GlobalNode(ewdChild.global.zewd, ['ewdjs', ewdChild.httpPort]);
      
      if (params.no === 0) {
        // first child process that is started clears down persistent stored EWD.js data
        console.log("First child process (' + process.pid + ') initialising database...");
        //var funcObj;
        //var resultObj;
        var pczewd = new mumps.Global(ewdChild.global.sessionNo);
        pczewd.$('relink')._delete();
        pczewd = null;
  
        zewd._delete();
        /*
        if (typeof params.management.password !== 'undefined') {
          zewd.$('management').$('password')._value = params.management.password;
          zewd.management.$('path')._value = params.management.path;
          //console.log('management password saved');
        }
        */
        process.send({
          pid: process.pid, 
          type: 'firstChildInitialised',
          interface: mumps.version()
        });
      }
      //var mem = EWD.getMemory();
      //console.log('memory: ' + JSON.stringify(mem, null, 2));
      zewd.$('processes').$(process.pid)._value = EWD.getDateFromhSeconds(hNow);
      //console.log('hNow set for ' + process.pid + ': ' + hNow);
      zewd = null;
      /*
        *** Load Custom Module if defined
      */
      if (params.customModule) {
        var custom = EWD.requireAndWatch(params.customModule);
        if (custom.onReady) {
          ewdChild.Custom = custom.onReady();
        }
        if (custom.onExit) ewdChild.Custom.onExit = custom.onExit;
        if (params.customObj && ewdChild.Custom) {
          for (var objName in params.customObj) {
            ewdChild.Custom[objName] = params.customObj[objName];
          }
        }
      }
      global.db = database;

};

module.exports = initialise;
