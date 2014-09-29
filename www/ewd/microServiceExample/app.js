EWD.sockets.log = true;

EWD.application = {
  name: 'microServiceExample',
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
    $('.report').html(
      'app.js: onStartup()has fired</br>'
    );
    EWD.getFragment('navlist.html', 'navList'); 

    var opts = {

      //requireConfig: {                  // pass in config options for require.js (optional)
      //  baseUrl:'/coolServices'
      //},
      //fragmentName: 'coolService.js',   // override target fragment for loading (optional)
      //nameSpace: 'coolService',         // override namespace given to onMessage handlers (optional)

      serviceName: 'microServiceExample',           // filename (no path & extension) of module 
      targetSelector: '#main_Container',  // jQuery selector target(s) fragment will be loaded into
      done: function(module) {
        $('.js-ewdRequireLog').html(
          $('.js-ewdRequireLog').html() + '<br>- app.js: EWD.require done() method has been invoked: /services/microServiceExample.js is now ready to be used!</br>'
        );
      }
    }
    EWD.require(opts);
    $('.report').append(
      'app.js: EWD.require() is loading front-end MicroService "/services/microServiceExample.js" </br>'
    );

  },

  onPageSwap: {
  },

  onFragment: {
    // add handlers that fire after fragment contents are loaded into browser

    'navlist.html': function(messageObj) {
      EWD.bootstrap3.nav.enable();
    },

    'main.html':function(messageObj) {
      $('.js-ewdRequireLog').html(
        $('.js-ewdRequireLog').html() + '<br>- app.js: the onFragment handler for the main.html fragment has been invoked</br>');
    }

  },

  onMessage: {
  },

  onServiceReady: {
    /* example event handler (EWD.require done() method has priority over this)
    module3: function() {
      console.log('Module3 onModule event handler invoked');
    }
    */
  }

};




