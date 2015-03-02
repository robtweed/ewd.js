EWD.sockets.log = true;   // *** set this to false after testing / development

EWD.application = {
  name: 'bootstrap3', // **** change to your application name
  timeout: 3600,
  login: true,
  labels: {
    'ewd-title': 'Demo',                                     // *** Change as needed
    'ewd-navbar-title-phone': 'Demo App',                    // *** Change as needed
    'ewd-navbar-title-other': 'Demonstration Application'    // *** Change as needed
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

    // Enable tooltips
    //$('[data-toggle="tooltip"]').tooltip()

    //$('#InfoPanelCloseBtn').click(function(e) {
    //  $('#InfoPanel').modal('hide');
    //});

    EWD.getFragment('login.html', 'loginPanel'); 
    EWD.getFragment('navlist.html', 'navList'); 
    EWD.getFragment('infoPanel.html', 'infoPanel'); 
    EWD.getFragment('confirm.html', 'confirmPanel'); 
    EWD.getFragment('main.html', 'main_Container'); 

  },

  onPageSwap: {
    // add handlers that fire after pages are swapped via top nav menu
    /* eg:
    about: function() {
      console.log('"about" menu was selected');
    }
    */
  },

  onFragment: {
    // add handlers that fire after fragment contents are loaded into browser

    'navlist.html': function(messageObj) {
      EWD.bootstrap3.nav.enable();
    },

    'login.html': function(messageObj) {
      $('#loginBtn').show();
      $('#loginPanel').on('show.bs.modal', function() {
        setTimeout(function() {
          document.getElementById('username').focus();
        },1000);
      });

      $('#loginPanelBody').keydown(function(event){
        if (event.keyCode === 13) {
          document.getElementById('loginBtn').click();
        }
      });
    }

  },

  onMessage: {

    // add handlers that fire after JSON WebSocket messages are received from back-end

    loggedIn: function(messageObj) {
      toastr.options.target = 'body';
      $('#main_Container').show();
      $('#mainPageTitle').text('Welcome to VistA, ' + messageObj.message.name);
    }
  }

};





