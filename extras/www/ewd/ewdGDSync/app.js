EWD.application = {
  name: 'ewdGDSync',
  login: true,
  labels: {
    'ewd-title': 'EWD.js Google Drive Synchroniser',
    'ewd-loginPanel-title': 'EWD.js Google Drive Synchroniser',
    'ewd-navbar-title-phone': 'Google Drive Sync',
    'ewd-navbar-title-other': 'EWD.js Google Drive Synchroniser',
  },

  onStartup: function() {

    // FuelUX Tree

    EWD.application.tree = {};

    EWD.application.tree.DataSource = function (options) {
      this._formatter = options.formatter;
      this._columns = options.columns;
      this._data = options.data;
    };

    EWD.application.tree.DataSource.prototype = {
      columns: function () {
        return this._columns;
      },

      data: function (options, callback) {
        if (jQuery.isEmptyObject(options)) {
          // load up the tree
          callback({data: this._data});
        }
        else {
          // fetch sub-items
          console.log('options: ' + JSON.stringify(options, null, 2));
          EWD.application.tree.callback = callback;
          var type;
          var appName;
          var folder;
          if (options.subtype === 'appName') {
            type = 'getEWDjsAppFolders';
            appName = options.name;
            folder = '';
          }
          if (options.subtype === 'appFolder') {
            type = 'getEWDjsAppFiles';
            appName = options.appName;
            folder = options.name;
          }
          EWD.sockets.sendMessage({
            type: type,
            params: {
              id: options.id,
              appName: appName,
              folder: folder
            }
          });
        }
      }
    };

    $('#ewdAppList').on('selected', function (evt, data) {
      EWD.application.googleFile = data.info[0];
      $('#actionPanel').show();
      var filename = data.info[0].name;
      $('#action').text(filename);
      EWD.sockets.sendMessage({
        type: 'checkLocalStatus',
        params: {
          filename: EWD.application.googleFile.name,
          appName: EWD.application.googleFile.appName,
          folder: EWD.application.googleFile.folder,
          href: window.location.href
        }
      });
    });  

    $('#downloadBtn').on('click', function () {
      console.log("Download!....");
      $('#action').text('Downloading ' + EWD.application.googleFile.name + "....");
      EWD.sockets.sendMessage({
        type: 'downloadFile',
        params: {
          url: EWD.application.googleFile.downloadUrl,
          filename: EWD.application.googleFile.name,
          appName: EWD.application.googleFile.appName,
          folder: EWD.application.googleFile.folder,
          href: window.location.href
        }
      });
    }); 

    $(function(){
      $("#downloadBtn").tooltip({
        title: "Update local copy with version on Google Drive"
      });
    });
  },

  onMessage: {
    authorise: function(messageObj) {
      var url = messageObj.content.url;
      console.log('opening window for ' + url);
      EWD.application.authWindow = window.open(url, 'authWin', 'left=200,top=200,width=700,height=300');
    },

    googleAuthentication: function(messageObj) {
      if (messageObj.ok) {
        EWD.sockets.sendMessage({
          type: 'getEWDjsApps'
        });
      }
    },

    ewdAppList: function(messageObj) {
      //console.log('display the folders');
      EWD.application.tree.treeDataSource = new EWD.application.tree.DataSource({
        data: messageObj.content.results,
        delay: 400
      });
      $('#ewdAppList').tree({dataSource: EWD.application.tree.treeDataSource});
      $('#wait').hide();
      $('.folderTitle').show();
    },

    ewdAppFolders: function(messageObj) {
      EWD.application.tree.callback({data: messageObj.content.results});
    },

    ewdAppFiles: function(messageObj) {
      EWD.application.tree.callback({data: messageObj.content.results});
    },

    info: function(messageObj) {
      $('#info').append('<div>' + messageObj.content.message + '</div>');
      if ($('#info').length > 0){
        $('#info')[0].scrollTop = $('#info')[0].scrollHeight;
      }
    },

    downloadComplete: function(messageObj) {
      $('#action').text(EWD.application.googleFile.name + ': local copy updated');
    }
  }

};










