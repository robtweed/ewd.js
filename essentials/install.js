/*

 ----------------------------------------------------------------------------
 | install.js: EWD.js Installer                                             |
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

 Build 5: 09 December 2015

*/

var readline = require('readline');
var os = require('os');
var fs = require('fs');

var copyFilesInDirectory = function(oldPath, newPath) {
  console.log("Move files in " + oldPath + " to " + newPath);
  var files = fs.readdirSync(oldPath);
  //if (files) console.log(files.length + ' files found');
  var file;
  var stats;
  var oldFilePath;
  var newFilePath;
  var error = false;
  for (var i = 0; i < files.length; i++) {
    file = files[i];
    //console.log('file: ' + file);
    stats = fs.lstatSync(oldPath + '/' + file);
    if (stats.isFile()) {
      oldFilePath = oldPath + '/' + file;
      newFilePath = newPath + '/' + file;
      try {
        fs.renameSync(oldFilePath, newFilePath);
      }
      catch(err) {
        error = true;
        console.log('Unable to move ' + oldPath + ' - check permissions');
        console.log('Error was: ' + err);
      }
    }
  }
  return error
};


var moveDirectory = function(oldPath, newPath) {
  console.log("Move Directory from " + oldPath + " to " + newPath);
  var error = false;
  if (fs.existsSync(oldPath)) {
    if (!fs.existsSync(newPath)) {
      fs.mkdirSync(newPath);    
    }
    // go through any sub-directories

    var files = fs.readdirSync(oldPath);
    var file;
    var stats;
    if (files) for (var i = 0; i < files.length; i++) {
      file = files[i];
      stats = fs.lstatSync(oldPath + '/' + file);
      if (stats.isDirectory()) {
        oldSubDirectoryPath = oldPath + '/' + file;
        newSubDirectoryPath = newPath + '/' + file;
        error = moveDirectory(oldSubDirectoryPath, newSubDirectoryPath);
        if (error) break;
      }
    }
    // copy any files in this directory
    if (error) return error;

    error = copyFilesInDirectory(oldPath, newPath);
    if (error) {
      return error;
    }
    else {
      fs.rmdirSync(oldPath);
    }
  }
  else {
    console.log('Warning: ' + oldPath + ' no longer exists in the ewd.js module directory');
  }
  return error;

};

var deleteDirectory = function(path) {
  var files = [];
  if( fs.existsSync(path) ) {
    files = fs.readdirSync(path);
    files.forEach(function(file,index){
      var curPath = path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteDirectory(curPath);
      } 
      else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

var tidyUp = function(path) {
  var essentialsPath = path + '/node_modules/ewdjs/essentials';
  fs.unlinkSync(essentialsPath + '/install.js');
  process.chdir(path);
  fs.rmdirSync(essentialsPath);
}; 

var installEWD = function(path) {
  var installErrors = false;
  console.log('installing EWD.js to ' + path);
  //if (os.type() === 'Linux') {}

  var essentialsPath = path + '/node_modules/ewdjs/essentials';

  // copy www directories (ewd and ewdjs)

  var oldPath = essentialsPath + '/www';
  var newPath = path + '/www';
  installErrors = moveDirectory(oldPath, newPath);
  if (installErrors) {
    console.log('Installation aborted');
    return;
  }

  // create ssl directories if not already there

  newPath = path + '/ssl';
  if (!fs.existsSync(newPath)) fs.mkdirSync(newPath);

  oldPath = essentialsPath + '/node_modules';
  newPath = path + '/node_modules';
  installErrors = copyFilesInDirectory(oldPath, newPath);

  if (installErrors) {
    console.log('Installation aborted');
    return;
  }
  fs.rmdirSync(oldPath);

  console.log('EWD.js has been installed and configured successfully');

};

var installExtras = function(path) {
  var installErrors = false;
  console.log('installing EWD.js extra resources to ' + path);

  var extrasPath = path + '/node_modules/ewdjs/extras';

  var oldPath = extrasPath + '/node_modules';
  var newPath = path + '/node_modules';
  var installErrors = copyFilesInDirectory(oldPath, newPath);

  if (installErrors) {
    console.log('Installation aborted');
    return;
  }
  fs.rmdirSync(oldPath);

  oldPath = extrasPath + '/ssl';
  newPath = path + '/ssl';
  installErrors = copyFilesInDirectory(oldPath, newPath);

  if (installErrors) {
    console.log('Installation aborted');
    return;
  }
  fs.rmdirSync(oldPath);

  oldPath = extrasPath + '/startupExamples';
  newPath = path ;
  installErrors = copyFilesInDirectory(oldPath, newPath);

  if (installErrors) {
    console.log('Installation aborted');
    return;
  }
  fs.rmdirSync(oldPath);

  oldPath = extrasPath + '/www';
  newPath = path + '/www';
  installErrors = moveDirectory(oldPath, newPath);

  if (installErrors) {
    console.log('Installation aborted');
    return;
  }
  deleteDirectory(oldPath);

};

// *********************************************************************
//
//    Starts here
//
// *********************************************************************


// Silent Mode: Try to read config options from a file named silent.js

/* 
  eg file contents might be:
     {
       "silent": true,
       "extras": false
     }
*/

var installPath;
var params = {
  silent: false
};
var paramsFile = '../../silent.js';
if( fs.existsSync(paramsFile) ) {
  try {
    params = JSON.parse(fs.readFileSync(paramsFile, 'utf8'));
    fs.unlinkSync(paramsFile);
  }
  catch(err) {
    // fall through in silent mode
  }
}

if (params.silent) {
  if (!params.installPath) {
    process.chdir('../..');
    installPath = process.cwd();
  }
  else {
    installPath = params.installPath;
  }
  installEWD(installPath);
  if (params.extras) {
    installExtras(installPath);
  }
  else {
    var extrasPath = installPath + '/node_modules/ewdjs/extras';
    deleteDirectory(extrasPath);
  }
  tidyUp(installPath);
  process.chdir(installPath);
  return;
}

// Interactive mode:

var interface = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

process.chdir('../..');
console.log(' ');

interface.question('Install EWD.js to directory path (' + process.cwd() + '): ', function(installPath) {
  if (installPath === '' || installPath === 'Y' || installPath === 'y') installPath = process.cwd();
  if (installPath.slice(-1) === '/') installPath = installPath.slice(0,-1);
  installEWD(installPath);
  console.log('  ');
  console.log('Do you want to install the additional resources from the /extras directory?');
  console.log("If you're new to EWD.js or want to create a test environment, enter Y");
  console.log("If you're an experienced user or this is a production environment, enter N");
  interface.question("Enter Y/N: ", function(answer) {
    if (answer === 'Y' || answer === 'y') {
      installExtras(installPath);
    }
    else {
      var extrasPath = installPath + '/node_modules/ewdjs/extras';
      deleteDirectory(extrasPath);
    }
    tidyUp(installPath);
    interface.close();
    process.chdir(installPath);
  });
});


