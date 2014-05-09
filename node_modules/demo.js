module.exports = {
  webServiceExample: function(ewd) {
    var session = new ewd.mumps.GlobalNode('%zewdSession', ["session", ewd.query.sessid]);
    if (!session._exists) return {error: 'EWD.js Session ' + ewd.query.sessid + ' does not exist'};
    return session._getDocument();
  }
};