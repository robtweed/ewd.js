// EWD.js Google Drive Synchroniser - back-end logic

// Ensure you do this first:
//   npm install googleapis

var googleapis = require('googleapis');
var https = require('https');
var url = require('url');
var path = require('path');
var fs = require('fs');

// Google Drive Handlers

var google = {

  // Register and configure this application on your Google Account using the Google Cloud Console:
  //  https://cloud.google.com/console#/project
  api_key: '[Your Google Cloud API Key for this application]',
  client_id: '[Your Google Cloud Client Id]',
  client_secret: '[Your Google Cloud Client Secret]',
  redirect_url: 'https://[Your External Domain Name]:8080/ewd/ewdGDSync/google.html',
  scope: 'https://www.googleapis.com/auth/drive',

  users: {},

  createClient: function(ewd, callback) {
    googleapis.discover('drive', 'v2').execute(function(err, client) {
      google.oauthClient = new googleapis.OAuth2Client(google.client_id, google.client_secret, google.redirect_url);
      google.client = client;
      var url = ewd.session.$('google').$('url')._value;
      if (url === '') {
        // login - user needs to be authorised by Google
        url = google.getRedirectUrl(ewd);
        callback(url);
      }
      else {
        // a different process is handling - it just needed client instantiating
        callback(ewd);
      }
    });
  },

  getRedirectUrl: function(ewd) {
    var token = ewd.session.$('ewd_wstoken')._value;
    var url = ewd.session.$('google').$('url')._value;
    if (url === '') {
      url = google.oauthClient.generateAuthUrl({
        scope: google.scope,
        state: token,
        //approval_prompt: 'auto',
        access_type: 'online'
      });
      ewd.session.$('google').$('url')._value = url;
    }
    return url;
  },

  getUserPermission: function(ewd) {
    if (!google.oauthClient) {
      google.createClient(ewd, function(url) {
        ewd.sendWebSocketMsg({type:'authorise', content: {url: url}});
      });
    }
    else {
      var url = google.getRedirectUrl(ewd);
      ewd.sendWebSocketMsg({type:'authorise', content: {url: url}});
    }
  },

  setCredentials: function(ewd) {
    var tokens = ewd.session.$('google').$('tokens')._getDocument();
    google.oauthClient.credentials = {
      access_token: tokens['access_token']
    };
  },

  getRoot: function(ewd) {
    if (!google.oauthClient) {
      google.createClient(ewd, function(ewd) {
        // now re-call it and it will fall through properly this time
        google.getRoot(ewd);
      });
    }
    google.setCredentials(ewd);
    google.client.drive.files
      .list({q: "title='EWD.js'"})
      .withAuthClient(google.oauthClient).execute(function(error, results) {
        if (results.items.length > 0) {
          google.getChildren({
            parentId: results.items[0].id,
            isFolder: true,
            subtype: 'appName',
            msgType: 'ewdAppList',
            ewd: ewd
          });
        }
        else {
          //console.log('no EWD apps on your Google Drive!');
          ewd.sendWebSocketMsg({
            type:'ewdAppList', 
            content: {
              'results': []
            }
          });
        }
    });
  },

  getChildren: function(params) {
    if (!google.oauthClient) {
      google.createClient(params.ewd, function(ewd) {
        // now re-call it and it will fall through properly this time
        google.getChildren(params);
      });
    }
    google.setCredentials(params.ewd);
    google.client.drive.children
      .list({folderId: params.parentId})
      .withAuthClient(google.oauthClient).execute(function(error, results) {
        if (error) {
          console.log("*!*!*!*!* google children error: " + JSON.stringify(error));
        }
        else {
          var array = [];
          var item;
          var noOfChildren = results.items.length;
          var count = 0;
          for (var i = 0; i < noOfChildren; i++) {
            item = results.items[i];
            google.client.drive.files
              .get({fileId: item.id})
              .withAuthClient(google.oauthClient).execute(function(error, file) {
              console.log('file: ' + JSON.stringify(file, null, 2));
              count++;
              console.log('count: ' + count);
              if (!file.labels.trashed) {
                var wanted = false;
                var type;
                if (params.isFolder && file.mimeType === 'application/vnd.google-apps.folder') {
                  wanted = true;
                  type = 'folder';
                }
                if (!params.isFolder && file.mimeType !== 'application/vnd.google-apps.folder') {
                  wanted = true;
                  type = 'item';
                }
                console.log('wanted: ' + wanted + '; type: ' + type);
                if (wanted) {
                  array.push({
                    name: file.title, 
                    id: file.id,
                    downloadUrl: file.downloadUrl,
                    type: type,
                    subtype: params.subtype,
                    appName: params.appName,
                    folder: params.folder
                  });
                }
              }
              if (count === noOfChildren) {
                console.log('sending message: ' + params.msgType);
                params.ewd.sendWebSocketMsg({
                  type: params.msgType, 
                  content: {
                    results: array
                  }
                });
              }
            });
          }
        }
    });
  }
};

module.exports = {
 
  onMessage: {
    
    'EWD.form.login': function(params, ewd) {
      if (params.username === '') return 'You must enter a password';
      if (params.username !== ewd.session.$('ewd_password')._value) return 'Invalid password';
      ewd.session.setAuthenticated();
      google.getUserPermission(ewd);
    },

    googleAuthentication: function(params, ewd) {
      //if (ewd.session.isAuthenticated) {
        var otherSessid = ewd.util.getSessid(params.token);
        var session = new ewd.mumps.GlobalNode('%zewdSession',['session', otherSessid]);
        session.$('google').$('authCode')._value = params.code;
        google.oauthClient.getToken(params.code, function(err, tokens) {
          session.$('google').$('tokens')._setDocument(tokens);
          process.send({
            ok: process.pid,
            type: 'wsMessage',
            token: params.token,
            content: {
              type: 'googleAuthentication',
              ok: true
            }
          });
        });
      //}
    },


    getEWDjsApps: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        google.getRoot(ewd);
      }
    },

    getEWDjsAppFolders: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        google.getChildren({
          parentId: params.id,
          isFolder: true,
          subtype: 'appFolder',
          msgType: 'ewdAppFolders',
          appName: params.appName,
          folder: params.folder,
          ewd: ewd
        });
      }
    },

    getEWDjsAppFiles: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        google.getChildren({
          parentId: params.id,
          isFolder: false,
          subtype: 'file',
          msgType: 'ewdAppFiles',
          appName: params.appName,
          folder: params.folder,
          ewd: ewd
        });
      }
    },

    checkLocalStatus: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var filepath;
        var dirpath;
        if (params.folder === 'node_modules') {
          // create local node_modules path
          dirpath = __dirname;
          filepath = dirpath + path.sep + params.filename;
        }
        else {
          var urlObj = url.parse(params.href);
          dirpath = ewd.homePath + urlObj.path.split('ewdGDSync')[0] + params.appName;
          filepath = dirpath + path.sep + params.filename;
        }
        if (!fs.existsSync(dirpath)) {
          ewd.sendWebSocketMsg({
            type: 'info', 
            content: {
              message: params.appName + ' does not yet exist on your local system'
            }
          });
        }
        if (!fs.existsSync(filepath)) {
          ewd.sendWebSocketMsg({
            type: 'info', 
            content: {
              message: 'This file does not exist on your local system'
            }
          });
        }
        else {
          ewd.sendWebSocketMsg({
            type: 'info', 
            content: {
              message: 'Clicking Update will overwrite your local copy'
            }
          });
        }
      }
    },

    downloadFile: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var googleUrl = url.parse(params.url);
        var token = ewd.session.$('google').$('tokens').$('access_token')._value;
        var filepath;
        var dirpath;
        if (params.folder === 'node_modules') {
          // create local node_modules path
          dirpath = __dirname;
          filepath = dirpath + path.sep + params.filename;
        }
        else {
          var urlObj = url.parse(params.href);
          dirpath = ewd.homePath + urlObj.path.split('ewdGDSync')[0] + params.appName;
          filepath = dirpath + path.sep + params.filename;
        }
        if (!fs.existsSync(dirpath)) {
          // create the application directory
          fs.mkdirSync(dirpath);
          ewd.sendWebSocketMsg({
            type: 'info', 
            content: {
              message: 'Target directory ' + dirpath + ' has been created'
            }
          });
        }
      
        var request = {
          hostname: googleUrl.hostname,
          path: googleUrl.path,
          headers: {
            Authorization: 'Bearer ' + token
          }
        };
        https.get(request, function(response) {
          response.on('data', function(data) {
            console.log("data: " + data);
            fs.writeFile(filepath, data, 'utf8');
            ewd.sendWebSocketMsg({
              type: 'info', 
              content: {
                message: filepath + ' has been updated'
              }
            });
            ewd.sendWebSocketMsg({
              type: 'downloadComplete'
            });
          });
          response.on('error', function(error) {
            console.log("error: " + error);
          });
        });
      }
    }

  }
};

