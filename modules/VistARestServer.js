var url = require('url');
var vista = require('VistADemo');

module.exports = {

  parse: function(ewd) {
    var path = ewd.query.rest_path.split('/');
    if (path[1] === 'initiate') {
      return vista.initiate(ewd);
    }
    if (path[1] === 'authenticate') {
      return vista.login(ewd);
    }
    if (path[1] === 'patientsByName') {
      return vista.getPatientsByNamePrefix(ewd);
    }
    if (path[1] === 'patientSummary') {
      return vista.getPatientSummary(ewd);
    }
    return {
      "error": {
        "text": "Unrecognized Service",
        "statusCode": 400
      }
    };
  }
};