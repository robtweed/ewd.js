EWD.chromecast = {
  namespace: 'urn:x-cast:com.mgateway.ewdjs',
  timer: null,
  session: null,
  initialiseCastApi: function () {
    console.log("initialising chromecast API...");
    var applicationID = 'CCBCB93C'  // Generic EWD.js Receiver Application Id
    var sessionRequest = new chrome.cast.SessionRequest(applicationID);
    var apiConfig = new chrome.cast.ApiConfig(sessionRequest, EWD.chromecast.sessionListener, EWD.chromecast.receiverListener);
    chrome.cast.initialize(apiConfig, EWD.chromecast.onInitSuccess, EWD.chromecast.onError);
  },
  onInitSuccess: function() {
    if (EWD.sockets.log) console.log("Chromecast initialised successfully");
  },
  onError: function() {
    if (EWD.sockets.log) console.log("Chromecast initialisation error");
  },
  onSuccess: function(message) {
    if (EWD.sockets.log) console.log(message);
  },
  onStopAppSuccess: function() {
    if (EWD.sockets.log) console.log('Session stopped');
  },
  sessionListener: function(e) {
    if (EWD.sockets.log) console.log('New session ID: ' + e.sessionId);
    EWD.chromecast.session = e;
    if (EWD.chromecast.session.media.length != 0) {
      if (EWD.sockets.log) console.log('Found ' + session.media.length + ' existing media sessions.');
      EWD.chromecast.onMediaDiscovered('sessionListener', session.media[0]);
    }
    EWD.chromecast.session.addMediaListener(
      onMediaDiscovered.bind(this, 'addMediaListener'));
      EWD.chromecast.session.addUpdateListener(EWD.chromecast.sessionUpdateListener.bind(this)
    );  
  },
  receiverListener: function(e) {
    if( e === 'available' ) {
      if (EWD.sockets.log) console.log("receiver found");
    }
    else {
      if (EWD.sockets.log) console.log("receiver list empty");
    }
  },
  sessionUpdateListener: function(isAlive) {
    if (EWD.sockets.log) console.log("sessionUpdateListener: isAlive = " + isAlive);
    var message = isAlive ? 'Session Updated' : 'Session Removed';
    message += ': ' + EWD.chromecast.session.sessionId;
    if (EWD.sockets.log) console.log(message);
    if (!isAlive) {
      if (EWD.chromecast.onStop) EWD.chromecast.onStop();
      EWD.chromecast.session = null;
      if(EWD.chromecast.timer ) {
        clearInterval(EWD.chromecast.timer);
      }
      else {
        EWD.chromecast.timer = setInterval(EWD.chromecast.updateCurrentTime.bind(this), 1000);
      }
    }
  },
  launchApp: function() {
    if (EWD.sockets.log) console.log("launching app");
    chrome.cast.requestSession(EWD.chromecast.onRequestSessionSuccess, EWD.chromecast.onLaunchError);
    if( EWD.chromecast.timer ) {
      clearInterval(EWD.chromecast.timer);
    }
  },
  onRequestSessionSuccess: function(e) {
    if (EWD.sockets.log) console.log("session success: " + e.sessionId);
    EWD.chromecast.session = e;
    EWD.chromecast.session.addMessageListener(EWD.chromecast.namespace, function(namespace, message) {
      //if (EWD.sockets.log) console.log('message returned from Chromecast: ' + message);
      //if (EWD.sockets.log) console.log('namespace: ' + namespace);
      try {
        var messageObj = JSON.parse(message);
        var type = messageObj.type;
        if (EWD.chromecast.onMessage && EWD.chromecast.onMessage[type]) {
          EWD.chromecast.onMessage[type](messageObj);
        }
      }
      catch(err) {
        console.log('invalid message received from Chromecast');
      }
    });
    EWD.chromecast.session.addUpdateListener(EWD.chromecast.sessionUpdateListener.bind(this));  
    if (EWD.chromecast.session.media.length != 0) {
      EWD.chromecast.onMediaDiscovered('onRequestSession', EWD.chromecast.session.media[0]);
    }
    if (!EWD.chromecast.launchUrl) console.log('Launch URL is not defined!');
    
    var json = {
      type: 'launch',
      url: EWD.chromecast.launchUrl
    };
    EWD.chromecast.sendMessage(json, function() {
      if (EWD.chromecast.onStart) EWD.chromecast.onStart();
    }, function(err) {
    });

  },
  onLaunchError: function() {
    if (EWD.sockets.log) console.log("launch error");
  },
  sendMessage: function(json, successCallback, errorCallback) {
    try {
      EWD.chromecast.session.sendMessage(EWD.chromecast.namespace, JSON.stringify(json), successCallback, errorCallback);
    }
    catch(err) {
      if (EWD.sockets.log) console.log('sendMessage error: invalid JSON: ' + json);
    }
  },
  stopApp: function() {
    EWD.chromecast.session.stop(EWD.chromecast.onStopAppSuccess, EWD.chromecast.onError);
    if( EWD.chromecast.timer ) {
      clearInterval(EWD.chromecast.timer);
    }
  },
  onStopAppSuccess: function() {
    if (EWD.sockets.log) console.log('Session stopped');
  },
  updateCurrentTime: function() {
    if (!EWD.chromecast.session || !currentMedia) {
      return;
    }
    if (currentMedia.media && currentMedia.media.duration != null) {
      var cTime = currentMedia.getEstimatedTime();
    }
    else {
      if( EWD.chromecast.timer ) {
        clearInterval(EWD.chromecast.timer);
      }
    }
  }
};
