var nodeVista = require('nodeVista');
var crypto = require('crypto');

// Crypto functions

var encryptCredentials = function(accessCode, verifyCode, key) {
  var text = 'accessCode=' + accessCode + '&verifyCode=' + verifyCode;
  var cipher = crypto.createCipher('aes-256-cbc',key)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
};

var decryptCredentials = function(encryptedString, key) {
  var decipher = crypto.createDecipher('aes-256-cbc', key);
  var dec;
  try {
    dec = decipher.update(encryptedString,'hex','utf8')
    dec += decipher.final('utf8');
    var str = dec.split('accessCode=')[1];
    var pieces = str.split('&verifyCode=');
    return {
      accessCode: pieces[0],
      verifyCode: pieces[1]
    };
  }
  catch(err) {
    return {
      error: 'Invalid credentials value'
    }
  }
};

// Re-usable core VistA interface functions

var VistALogin = function(accessCode, verifyCode, ewd) {
  var authP = new ewd.mumps.GlobalNode('%zewdTemp', [process.pid]);
  authP._delete();
  authP._setDocument({
    inputs:{
      password: verifyCode,
      username: accessCode
    }
  });
  var result = ewd.mumps.function('login^ZZCPCR00', '');
  if (result === '') {
    var document = authP._getDocument();
    return {
      error: false,
      outputs: document.outputs
    };
  }
  else{
    return {error: result};
  }
};

var getPatientsByName = function(prefix, max, ewd) {
  var patientIndex = new ewd.mumps.GlobalNode("DPT", ["B"]);
  var results = [];
  var namesById = {};
  var i = 0;
  patientIndex._forPrefix(prefix.toUpperCase(), function(name, node) {
    node._forEach(function(id) {
      i++;
      if (i > max) return true;
      results.push({
        id: id, 
        text: name
      });
      namesById[id] = name;
    });
    if (i > max) return true;
  });
  return {
    results: results,
    namesById: namesById
  };
};

var getPatientSummaryDetails = function(patientId, ewd) {
  var patient= new ewd.mumps.GlobalNode("DPT", [patientId,'0']);
  var patientRec0 = patient._value;
  var patientObj = patientRec0.split('^');
  return {
    EIN: patientId,
    name: patientObj[0],
    sex: patientObj[1],
    DOB: nodeVista.convertFtoStringDate(patientObj[2]),
    SSN: patientObj[8]
  };
};

// REST & Web Server authentication function

var authenticate = function(ewd) {
  var statusCode = 401;
  var token = ewd.query.token;
  if (ewd.query['rest_auth']) token = ewd.query['rest_auth'];
  if (!token) {
    return errorResponse('Failed authentication (1)', statusCode, ewd);
  }
  else if (token === '') {
    return errorResponse('Failed authentication (2)', statusCode, ewd);
  }
  else {
    var session = ewd.util.getSession(token);
    if (session === '') {
      return errorResponse('Failed authentication (3)', statusCode, ewd);
    }
    else {
      ewd.util.updateSessionExpiry({
        sessid: session.$('ewd_sessid')._value
      });
      return {
        ok: true,
        session: session
      }
    }
  }
};

var loginStatus = function(ewd) {
  var status = authenticate(ewd);
  if (status.error) return status;
  var statusCode=401;
  if (status.session.$('VistAUser').$('DUZ')._value === '') return errorResponse('Failed authentication (4)', statusCode, ewd);
  if (status.session.$('cipherKey')._value !== '') return errorResponse('Failed authentication (5)', statusCode, ewd);
  return status;
}

// REST & Web Service error response formatter function

var errorResponse = function(error, statusCode, ewd) {
  if (ewd.query['rest_method']) {
    return {
      "error": {
        "text": error,
        "statusCode": statusCode
      }
    }; 
  }
  else {
    return {error: error};
  }
};

module.exports = {

  // encryption function for manual testing

  encrypt: function(accessCode, verifyCode, key) {
    return encryptCredentials(accessCode, verifyCode, key);
  },

  // Web Service wrappers

  initiate: function(ewd) {
    var session = ewd.util.createNewSession('VistADemo', 300);
    var token = session.$('ewd_token')._value;
    var key = ewd.util.createToken();
    session.$('cipherKey')._value = key;
    return {
      Authorization: token,
      key: key
    };
  },

  login: function(ewd) {
    var status = authenticate(ewd);
    if (status.error) {
      return status;
    }
    else {
      var session = status.session;
      var sessid = session.$('ewd_sessid')._value;
      var errorStatusCode = 400;
      var key = session.$('cipherKey')._value;
      if (key === '') {
        ewd.util.deleteSession(sessid);
        return errorResponse('No key available', errorStatusCode, ewd);
      }
      var credentials = decryptCredentials(ewd.query.credentials, key);
      if (credentials.error) {
        ewd.util.deleteSession(sessid);
        return errorResponse(credentials.error, errorStatusCode, ewd);
      }
      if (!credentials.accessCode || credentials.accessCode === '') {
        ewd.util.deleteSession(sessid);
        return errorResponse('Missing Access Code', errorStatusCode, ewd);
      }
      if (!credentials.verifyCode || credentials.verifyCode === '') {
        ewd.util.deleteSession(sessid);
        return errorResponse('Missing Verify Code', errorStatusCode, ewd);
      }
      // ****************************
      var results = VistALogin(credentials.accessCode, credentials.verifyCode, ewd);
      // ****************************

      if (results.error) {
        ewd.util.deleteSession(sessid);
        return errorResponse(results.error, errorStatusCode, ewd);
      }
      else {
        // logged in
        session.$('cipherKey')._delete();
        //results.outputs.token = session.$('ewd_token')._value;
        session.$('VistAUser')._setDocument(results.outputs);
        return results.outputs;
      }
    }
  },

  getPatientsByNamePrefix: function(ewd) {
    var status = loginStatus(ewd);
    if (status.error) {
      return status;
    }
    else {
      var session = status.session;
      var errorStatusCode = 400;
      if (!ewd.query.prefix || ewd.query.prefix === '') return errorResponse('You must enter a name prefix', errorStatusCode, ewd);

      // ******************************
      var results = getPatientsByName(ewd.query.prefix, 1000, ewd)
      // ******************************

      return results.results;
    }
  },

  getPatientSummary: function(ewd) {
    var status = loginStatus(ewd);
    if (status.error) {
      return status;
    }
    else {
      var errorStatusCode = 400;
      if (!ewd.query.id || ewd.query.id === '') return errorResponse('You must enter a patient Id', errorStatusCode, ewd);

      // **********************************
      var results = getPatientSummaryDetails(ewd.query.id, ewd)
      // **********************************

      return results;
    }
  },


  // EWD.js Application Handlers/wrappers

  onMessage: {

    'EWD.form.login': function(params, ewd) {
      if (params.username === '') return 'You must enter an Access Code';
      if (params.password === '') return 'You must enter a Verify Code';

      // Access Code / Verify Code Example: fakedoc1/1Doc!@#$

      // **********************************
      var results = VistALogin(params.username, params.password, ewd); 
      // **********************************

      if (results.error) {
        return results.error;
      }
      else {
        ewd.session.$('username')._value = params.username;
        ewd.session.$('userDUZ')._value = results.outputs.DUZ;
        ewd.session.$('displayName')._value = results.outputs.displayName;
        ewd.sendWebSocketMsg({
          type: 'loggedInAs',
          message: {
            fullName: results.outputs.displayName
          }
        });
        ewd.session.setAuthenticated();
        ewd.sendWebSocketMsg({
          type: 'loggedIn',
          message: {
            ok: true,
            name: ewd.session.$('displayName')._value
          }
        });
        return '';
      } 
    },

    patientQuery: function(params, ewd) {
      if (ewd.session.isAuthenticated) {

        // ********************************
        var results = getPatientsByName(params.prefix, 40, ewd);
        // ********************************

        ewd.session.$('names')._delete();
        ewd.session.$('names')._setDocument(results.namesById);
        ewd.sendWebSocketMsg({
          type: 'patientMatches',
          message: results.results
        });
      }
    },

    patientSelected: function(params, ewd) {
      if (ewd.session.isAuthenticated) {
        // record at back end for future validation of actions
        ewd.session.$('patientIdSelected')._value = params.patientId;

        // ***********************************
        var results = getPatientSummaryDetails(params.patientId, ewd)
        // ***********************************

        return results;
      }
    }

  }
};