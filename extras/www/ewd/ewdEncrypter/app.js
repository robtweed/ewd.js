EWD.sockets.log = true;

EWD.application = {
  name: 'ewdEncrypter',
  timeout: 3600,
  labels: {
    'ewd-title': 'ewdEncrypter',
    'ewd-navbar-title-phone': 'VistA Encrypt Tool',
    'ewd-navbar-title-other': 'EWD VistA Login Encryption Tool'
  },
  navFragments: {
    main: {
      cache: true
    },
    about: {
      cache: true
    }
  },

  onStartup: function() {

    EWD.getFragment('navlist.html', 'navList'); 
    EWD.getFragment('main.html', 'main_Container'); 

  },

  onPageSwap: {
  },

  onFragment: {
    // add handlers that fire after fragment contents are loaded into browser

    'navlist.html': function(messageObj) {
      EWD.bootstrap3.nav.enable();
    },

    'main.html': function(messageObj) {
      $('[data-toggle="tooltip"]').tooltip();

      $('#encryptBtn').on('click', function(e) {
        e.preventDefault(); // prevent default bootstrap behavior
        EWD.sockets.submitForm({
          fields: {
            accessCode: $('#accessCode').val(),
            verifyCode: $('#verifyCode').val(),
            key: $('#key').val(),
          },
          id: 'encryptForm',
          messageType: 'EWD.form.encrypt'
        });
      });
    }

  },

  onMessage: {

    // add handlers that fire after JSON WebSocket messages are received from back-end

     encrypted: function(messageObj) {
       $('#credentials').val(messageObj.message.credentials);
     }

  }

};





