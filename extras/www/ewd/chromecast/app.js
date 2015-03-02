EWD.sockets.log = false;

EWD.chromecast.launchUrl = 'https://www.mgateway.com:38080/ewd/cctest/index.html';

var controller = new Leap.Controller({
  enableGestures: true,
  //frameEventName: 'animationFrame',
  loopWhileDisconnected: false
});

EWD.chromecast.onStart = function() {
  $('#aboutBtn').show();
  $('#mainBtn').hide();
  $('#stopBtn').show();
  $('#startBtn').hide();
  $('#upBtn').show();
  $('#downBtn').show();
  $('#leftBtn').show();
  $('#rightBtn').show();
  $('#leapOnBtn').show();

  var maxWidth = $(window).width() - 30;
  var maxHeight = $(window).height() - 100;
  var x = maxWidth/2;
  var y = maxHeight/2;
  var yFactor = maxHeight / 150;
  var xFactor = maxWidth / 300;
  $('#pointer').css({
    left: x,
    top: y
  });
  var frameNo = 0;
  var leapCycle;

  EWD.leapRunning = false;

  controller.on('disconnect', function() {
    EWD.leapRunning = false;
    clearInterval(leapCycle);
    if (EWD.chromecast.stop) {
      EWD.chromecast.stopApp();
    }
  });

  controller.on('connect', function() {
    console.log('leapMotion controller connected');
    EWD.leapRunning = true;
    var started = false;
    leapCycle = setInterval(function(){
      var frame = controller.frame();
      if (frame.valid && frame.hands.length > 0) {
        if (!started) {
          console.log('started receiving frames');
          started = true;
          $(window).blur();
          $(window).focus();
        }
        var hand = frame.hands[0];
        var position = hand.palmPosition;
        //console.log(JSON.stringify(position[0]));
        console.log(position[0] + ';' + position[1]);
        x = (position[0] + 150) * xFactor;
        y = maxHeight - ((position[1] - 50) * yFactor);
        //x = x + (xpos/15);
        if (x < -20) {
          x = -20;
        }
        if (x > maxWidth) x = maxWidth;
        //y = y + (ypos);
        if (y < 0) y = 0;
        if (y > maxHeight) y = maxHeight;
        $('#pointer').css({
          left: x,
          top: y
        });
        EWD.chromecast.sendMessage({
          type: 'pointerPosition',
          x: x,
          y: y
        });
      }
    }, 100);
  });

};

EWD.chromecast.onStop = function() {
  $('#aboutBtn').hide();
  $('#mainBtn').hide();
  $('#stopBtn').hide();
  $('#startBtn').show();
  $('#upBtn').hide();
  $('#downBtn').hide();
  $('#leftBtn').hide();
  $('#rightBtn').hide();
  $('#leapOnBtn').hide();
  $('#leapOffBtn').hide();
};

EWD.chromecast.onMessage = {
  aboutReceived: function(messageObj) {
    console.log(messageObj.message);
  }
};


EWD.application = {
  name: 'chromecast',
  timeout: 3600,
  login: true,

  labels: {
    'ewd-title': 'Chromecast Sender',
    'ewd-navbar-title-phone': 'Chromecast Demo',
    'ewd-navbar-title-other': 'Chromecast Demonstration Application'
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

    EWD.getFragment('login.html', 'loginPanel'); 
    EWD.getFragment('navlist.html', 'navList'); 
    EWD.getFragment('main.html', 'main_Container'); 

    // **** Chromecast initialisation
    EWD.chromecast.initialiseCastApi();
  },

  onPageSwap: {
  },

  onFragment: {

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

    'main.html': function() {
      $('#aboutBtn').hide();
      $('#mainBtn').hide();
      $('#stopBtn').hide();
      $('#upBtn').hide();
      $('#downBtn').hide();
      $('#leftBtn').hide();
      $('#rightBtn').hide();
      $('#leapOnBtn').hide();
      $('#leapOffBtn').hide();
      $('[data-toggle="tooltip"]').tooltip();
      $('#startBtn').on('click', function() {
        EWD.chromecast.launchApp();
      });
      $('#stopBtn').on('click', function() {
        if (EWD.leapRunning) {
          EWD.chromecast.stop = true;
          controller.disconnect();
        }
        else {
          EWD.chromecast.stopApp();
        }
      });
      $('#aboutBtn').on('click', function() {
        EWD.chromecast.sendMessage({
          type: 'about'
        });
        $('#aboutBtn').hide();
        $('#mainBtn').show();
      });
      $('#mainBtn').on('click', function() {
        EWD.chromecast.sendMessage({
          type: 'main'
        });
        $('#aboutBtn').show();
        $('#mainBtn').hide();        
      });
      //$('#pointer').draggable();
      $('#downBtn').on('click', function() {
        EWD.chromecast.sendMessage({
          type: 'down'
        });
      });
      $('#upBtn').on('click', function() {
        EWD.chromecast.sendMessage({
          type: 'up'
        });
      });
      $('#leftBtn').on('click', function() {
        EWD.chromecast.sendMessage({
          type: 'left'
        });
      });
      $('#rightBtn').on('click', function() {
        EWD.chromecast.sendMessage({
          type: 'right'
        });
      });
      $('#leapOnBtn').on('click', function() {
        controller.connect();
        $('#leapOnBtn').hide();
        $('#leapOffBtn').show();
      });
      $('#leapOffBtn').on('click', function() {
        EWD.chromecast.stop = false;
        controller.disconnect();
        $('#leapOnBtn').show();
        $('#leapOffBtn').hide();
      });

    }

  },

  onMessage: {

    loggedIn: function(messageObj) {
      toastr.options.target = 'body';
      $('#main_Container').show();
    }
  }

};

