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

    messageTypeName: function(params, ewd) {
      if (ewd.session.isAuthenticated) {

        return {some: 'content'};
      }
    }

  }
};