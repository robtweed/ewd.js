var htmlEscape = function(text) {
  return text.toString().replace(/&/g, '&amp;').
    replace(/</g, '&lt;').  // it's not neccessary to escape >
    replace(/"/g, '&quot;').
    replace(/'/g, '&#039;');
};

module.exports = {

  onMessage: {

    'EWD.form.login': function(params, ewd) {
      if (params.username === '') return 'You must enter the EWD.js Management password';
      if (params.username !== ewd.session.$('ewd_password')._value) return 'Invalid password';

      ewd.session.setAuthenticated();

      ewd.sendWebSocketMsg({
        type: 'loggedIn',
        message: {
          ok: true
        }
      });
      return ''; 
    },

    'EWD.form.importJSON': function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        if (params.globalName === '') return 'You must enter a Storage Object name';
        var str = params.globalName;
        if (str.charAt(0) === '%') str = str.substring(1);
        var regex = /[A-Za-z]/gi;
        if (str.match(regex) === null) return 'Invalid Storage Object Name';
        var json = params.json.replace(/(\r\n|\n|\r)/gm,"");
        if (json === '') return 'You must enter a JSON document';
        //console.log('json = ' + json);
        try {
          var doc = JSON.parse(json);
        }
        catch(error) {
          return 'Invalid JSON: ' + error;
        }
        //console.log("** Global Name: " + params.globalName + ': ' + JSON.stringify(data));
        var glo = new ewd.mumps.Global(params.globalName);
        glo._setDocument(doc);
        ewd.sendWebSocketMsg({
          type: 'importJSON',
          ok: true,
          globalName: params.globalName
        });
        return ''
      }
    },

    closeSession: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        ewd.util.deleteSession(params.sessid);
      }
    },

    deleteGlobalNode: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var node = new ewd.mumps.GlobalNode(params.globalName, params.subscripts);
        node._delete();
        return;
      }
    },

    getGlobals: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var gloArray = ewd.mumps.getGlobalDirectory();
        var data = [];
        var rec;
        for (var i = 0; i < gloArray.length; i++) {
          rec = {
            name: gloArray[i],
            type: 'folder',
            subscripts: [],
            globalName: gloArray[i],
            operation: 'db'
          };
          data.push(rec);
        }
        return data;
      }
    },

    getGlobalSubscripts: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var glo = new ewd.mumps.GlobalNode(params.globalName, params.subscripts);
        var data = {
          operation: params.operation,
          globalName: params.globalName,
          rootLevel: params.rootLevel,
          subscripts: []
        }
        if (params.sessid) data.sessid = params.sessid;
        var rec;
        var count = 0;
        var type;
        glo._forEach(function(subscript, subNode) {
          count++;
          if (count > 200) return true;
          if (subNode._hasValue) {
            type = 'folder';
            if (!subNode._hasProperties) type = 'item';
            rec = {name: htmlEscape(subscript) + '<span>: </span>' + htmlEscape(subNode._value), type: type}
          }
          else {
            rec = {name: subscript, type: 'folder'}
          }
          rec.subscripts = params.subscripts.slice(0);
          rec.subscripts.push(subscript);
          rec.operation = params.operation;
          rec.globalName = params.globalName;
          data.subscripts.push(rec);
        });
        return data;
      }
    },

    getInterfaceVersion: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        return ewd.mumps.version();
      }
    },

    getSessionData: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var session = new ewd.mumps.GlobalNode('%zewdSession', ['session', params.sessid]);
        return session._getDocument();
      }
    },

    getSessions: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var mySessid = ewd.session.$('ewd_sessid')._value;
        var ewdSessions = new ewd.mumps.GlobalNode("%zewdSession", ['session']);
        var data = [];
        var rowNo = -1;
        ewdSessions._forEach(function(sessid, session) {
          var appName = session.$('ewd_appName')._value;
          var expiry = session.$('ewd_sessionExpiry')._value;
          expiry = (expiry - 4070908800) * 1000;
          var expireDate = new Date(expiry);
          rowNo++;
          var currentSession = (sessid === mySessid);
          data.push({
            rowNo: rowNo, 
            sessid: sessid, 
            appName: appName, 
            expiry: expireDate.toUTCString(), 
            currentSession: currentSession
          });
        });
        return data;
      }
    },

    keepAlive: function(params, ewd) {
      return {ok: true}
    },

    getWSUsers: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        var global = new ewd.mumps.GlobalNode('%zewd',['EWDLiteServiceAccessId']);
        return global._getDocument();
      }
    },

    wsMgr_saveUser: function(params, ewd) {
      var global = new ewd.mumps.GlobalNode('%zewd',['EWDLiteServiceAccessId']);
      var userRecord;
      for (var accessId in params.obj) {
        userRecord = global.$(accessId);
        userRecord._delete();
        userRecord._setDocument(params.obj[accessId]);
      }
      return {ok: true, mode: params.mode};
    },

    wsMgr_deleteUser: function(params, ewd) {
        var global = new ewd.mumps.GlobalNode('%zewd',['EWDLiteServiceAccessId', params.target]);
        global._delete();
        return {ok: true, accessId: params.target};
    },
  }
};