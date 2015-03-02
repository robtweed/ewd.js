module.exports = {

  onMessage: {

    'EWD.form.login': function(params, ewd) {
      if (params.username === '') return 'You must enter a username';
      if (params.username !== 'rob') return 'Invalid username';
      if (params.password === '') return 'You must enter a password';
      if (params.password !== 'secret') return 'Invalid password';

      ewd.session.setAuthenticated();

      ewd.sendWebSocketMsg({
        type: 'loggedIn',
        message: {
          ok: true,
          username: params.username
        }
      });
      return ''; 
    },

    messageTypeName: function(params, ewd) {                 // *** change messageTypeName as required
      if (ewd.session.isAuthenticated) {                     // *** usually a sensible precaution!
        // do whatever you have to do
        return {some: 'content'};                            // *** return JSON to Browser
      }
    }

  }
};