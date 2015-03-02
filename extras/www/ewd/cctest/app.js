EWD.sockets.log = true;   // *** set this to false after testing / development

EWD.application = {
  name: 'cctest',
  timeout: 3600,
  chromecast: true,
  login: false,
  labels: {
    'ewd-title': 'Demo', 
    'ewd-navbar-title-phone': 'Demo App',
    'ewd-navbar-title-other': 'Demonstration Application'
  },
  navFragments: {
    main: {
      cache: true
    },
    about: {
      cache: true
    }
  },
  contentLoaded: false,

  onStartup: function() {
    EWD.getFragment('navlist.html', 'navList');
    EWD.getFragment('main.html', 'main_Container');
  },

  onPageSwap: {
  },

  onFragment: {

    'navlist.html': function(messageObj) {
      EWD.bootstrap3.nav.enable();
    }
  },

  onMessage: {
  }

};

EWD.chromecast = {
  onMessage: {
    about: function(obj) {
      var msg = obj.message;
      var senderId = obj.senderId;
      $('#about_Nav').click();
      EWD.chromecast.sendMessage({
        type: 'aboutReceived',
        message: 'Yes I received the request to switch to the about panel'
      });
    },
    main: function(obj) {
      $('#main_Nav').click();
    },
    down: function(obj) {
      $('#pointer').animate({
        top: "+=50"
      }, 100, function() {
        // Animation complete.
      });
    },
    up: function(obj) {
      $('#pointer').animate({
        top: "-=50"
      }, 100, function() {
        // Animation complete.
      });
    },
     left: function(obj) {
      $('#pointer').animate({
        left: "-=50"
      }, 100, function() {
        // Animation complete.
      });
    },
    right: function(obj) {
      $('#pointer').animate({
        left: "+=50"
      }, 100, function() {
        // Animation complete.
      });
    },
    pointerPosition: function(obj) {
      $('#pointer').css({
        left: obj.message.x,
        top: obj.message.y
      });
    }
  }
};





