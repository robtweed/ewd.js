EWD.sockets.log = true;
EWD.VistATerminalPort = 8081;

EWD.application = {
  name: 'VistADemo',
  timeout: 3600,
  login: true,
  labels: {
    'ewd-title': 'VistA Demo',
    'ewd-navbar-title-phone': 'VistA Demo',
    'ewd-navbar-title-other': 'VistA Demo using EWD.js'
  },
  navFragments: {
    main: {
      cache: true
    },
    terminal: {
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
    EWD.getFragment('patientSelectPanel.html', 'patientSelectionPanel'); 

  },

  onPageSwap: {
  },

  onFragment: {
    // injected fragments

    'main.html': function(messageObj) {
      $('#newPatientBtn').click(function(e) {
        $('#patientSelectionPanel').modal('show');
      });
    },

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
    },

    'patientPanel.html': function(messageObj) {
      EWD.application.activeMenu = 'patientMenu-vitals';
      var patient = EWD.application.patient;
      var sex = 'Male';
      if (patient.sex === 'F') sex = 'Female'
      var title = patient.name + ' ;  DOB   ' + patient.DOB + ' (' + sex + ')';
      $('#patientPanelTitle').text(title);
      $('.patientMenu').click(function(e) {
        e.stopPropagation();
        var id = e.currentTarget.id;
        $('#' + EWD.application.activeMenu).toggleClass("active", false);
        $('#' + id).toggleClass("active", true);
        EWD.application.activeMenu = id;
        var option = id.split('patientMenu-')[1];
        if (option === 'vitals') {
          $('#patientDataPanel').text('Patient Vitals Go Here');
        }
      });
    },

    'terminal.html': function(messageObj) {
      var url = 'https://' + $(location).attr('hostname') + ':' + EWD.VistATerminalPort + '/ewdVistATerm/term.html';
      $('#terminalFrame').attr('src', url);
    }

  },

  onMessage: {

    loggedIn: function(messageObj) {
      toastr.options.target = 'body';
      $('#main_Container').show();
      $('#mainPageTitle').text('Welcome to VistA, ' + messageObj.message.name);
      $('#patientSelectionPanel').modal('show');

      EWD.bootstrap3.enableSelect2();
    },

    patientSelected: function(messageObj) {
      $('#patientSelectionPanel').modal('hide');
      EWD.application.patient = messageObj.message;
      if ($('#patientPanel').length > 0) $('#patientPanel').remove();
      EWD.getFragment('patientPanel.html', 'mainPageContent');
    }
  }

};






