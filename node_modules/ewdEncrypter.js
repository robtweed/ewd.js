var vistaDemo = require('VistADemo');

module.exports = {

  onMessage: {

    'EWD.form.encrypt': function(params, ewd) {
      if (params.accessCode === '') return 'You must enter an Access Code';
      if (params.verifyCode === '') return 'You must enter a Verify Code';
      if (params.key === '') return 'You must enter the encryption key';
      var credentials = vistaDemo.encrypt(params.accessCode, params.verifyCode, params.key);

      ewd.sendWebSocketMsg({
        type: 'encrypted',
        message: {
          credentials: credentials
        }
      });
      return ''; 
    }

  }
};