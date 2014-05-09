$(document).ready(function() {
  EWD = {};
  EWD.chromecast = {
    initialised: false
  };
  var guest;
  var namespace = 'urn:x-cast:com.mgateway.ewdjs';
  var mgr = cast.receiver.CastReceiverManager.getInstance();
  var bus = mgr.getCastMessageBus(namespace);
  mgr.start();

  bus.onMessage = function(e) {
    try {
      var msg = JSON.parse(e.data);
      var type = msg.type;
      //console.log('received ' + JSON.stringify(msg));
      if (type === 'launch') {
        //console.log('launch ' + msg.url);
        $('#content').hide();
        $('#guestFrame').attr("src", msg.url);
        $('#guestFrame').css('height', $(window).height()+'px');
        guest = $('#guestFrame')[0].contentWindow;
        var url = $(location).attr('href').split('//');
        var http = url[0];
        var domain = url[1].split('/')[0];
        EWD.parentOrigin = http + '//' + domain;
        EWD.iframe = guest;
        EWD.chromecast.senderId = e.senderId;
        if (msg.origin) {
          EWD.frameOrigin = msg.origin;
        }
        else {
          var url = msg.url.split('//');
          var http = url[0];
          var domain = url[1].split('/')[0];
          EWD.frameOrigin = http + '//' + domain;
        }
      }
      else {
        var message = {
          message: msg,
          senderId: e.senderId
        }
        // origin must be for destination window
        guest.postMessage(message, EWD.frameOrigin);
      }
    }
    catch(err) {
    }
  };

  window.addEventListener('message', function(e) {
    var message = e.data;
    //console.log("*** message received from iframe: " + JSON.stringify(message) + '; origin = ' + e.origin);
    // ensure received message came from domain of originally-loaded document
    if (e.origin === EWD.frameOrigin) {
      bus.send(EWD.chromecast.senderId, JSON.stringify(message));
      //console.log('message forwarded to sender application');
    }
  });


});