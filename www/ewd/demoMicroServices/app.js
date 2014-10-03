EWD.sockets.log = true;

EWD.application = {
  name: 'demoMicroServices',
  timeout: 3600,
  login: false,
  labels: {
    'ewd-title': 'Microservice Demo App',
    'ewd-navbar-title-phone': 'Microservice Demo App',
    'ewd-navbar-title-other': 'Microservice Demo App'
  },
  navFragments: {
    main: {
      cache: true
    }
  },
  onStartup: function() {
    console.log('app.js: onStartup() has fired');
    EWD.getFragment('navlist.html', 'navList'); 

    console.log('app.js: invoking EWD.require to load the demoPatientProfile front-end service');

    EWD.require({
      serviceName:'demoPatientProfile',
      targetSelector:'#main_Container',
      done: function() {
        console.log('app.js: demoPatientProfile service loaded successfully');
      }
    });
    
  },
  onPageSwap: {
  },
  onFragment: {
    'navlist.html': function(messageObj) {
      EWD.bootstrap3.nav.enable();
    },
  }
};




