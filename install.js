var readline = require('readline');
var os = require('os');
var fs = require('fs');

var modulePath = process.cwd();

if (!fs.existsSync(modulePath + '/www/')) {
  console.log('EWD.js has already been installed - update aborted')
  return;
}

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

var installEWD = function(path) {
  var installErrors = false;
  console.log('installing EWD.js to ' + path);
  if (os.type() === 'Linux') {}

  var oldPath = modulePath + '/www';
  var newPath = path + '/www';
  installErrors = moveDirectory(oldPath, newPath);
  if (installErrors) {
    console.log('Installation aborted');
    return;
  }

  oldPath = modulePath + '/ssl';
  newPath = path + '/ssl';
  installErrors = moveDirectory(oldPath, newPath);
  if (installErrors) {
    console.log('Installation aborted');
    return;
  }

  oldPath = modulePath + '/modules';
  newPath = path + '/node_modules';
  installErrors = copyFilesInDirectory(oldPath, newPath);

  if (installErrors) {
    console.log('Installation aborted');
    return;
  }

  fs.rmdirSync(oldPath);

  oldPath = modulePath + '/startupExamples/';
  newPath = path;
  installErrors = copyFilesInDirectory(oldPath, newPath);

  if (installErrors) {
    console.log('Installation aborted');
    return;
  }

  fs.rmdirSync(oldPath);

  console.log('EWD.js has been installed and configured successfully');

  /*

  var nmPath = modulePath + '/node_modules/';
  if (fs.existsSync(nmPath)) {
    var files = fs.readdirSync(nmPath);
    var file;
    var stats;
    var errors = false;
    for (var i = 0; i < files.length; i++) {
      file = files[i];
      stats = fs.lstatSync(nmPath + file);
      if (stats.isFile()) {
        oldPath = nmPath + file;
        newPath = path + '/node_modules/' + file;
        try {
          fs.renameSync(oldPath, newPath);
        }
        catch(err) {
          errors = true;
          console.log('Unable to move ' + oldPath + ' - check permissions');
          console.log('Error was: ' + err);
        }
      }
    }
    if (!errors) {
      fs.rmdirSync(nmPath);
      console.log('EWD.js has been installed and configured successfully');
    }
  }
  else {
    console.log('Warning: ' + nmPath + ' no longer exists in the ewd.js module directory');
  }
  */


};

if (process.argv[2] === 'silent') {
  var path = process.argv[3];
  if (!path) {
    process.chdir('../..');
    path = process.cwd();
  }
  installEWD(path);
}
else {
  var interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  process.chdir('../..');

  interface.question('Install EWD.js to directory path (' + process.cwd() + '): ', function(installPath) {
    if (installPath === '') installPath = process.cwd();
    if (installPath.slice(-1) === '/') installPath = installPath.slice(0,-1);
    if (fs.existsSync(installPath + '/www')) {
      console.log("**** Warning: you've previously installed EWD.js into this path");
      console.log("Existing files and directories will be updated with the ones in the new version of EWD.js");
      console.log("All other files that you've created will be left unchanged");
      interface.question('Do you want to continue? (Y/N): ', function(answer) {
        if (answer === 'Y' || answer === 'y') {
          installEWD(installPath);
        }
        else {
          console.log('Update aborted');
        }
        interface.close();
      }); 
    }
    else {
      installEWD(installPath);
      interface.close();
    }
  });
}

