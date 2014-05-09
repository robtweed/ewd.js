EWD.application = {
  name: 'ewdGDSync'
};

function getNVP(key) {
  key = key.replace(/[*+?^$.\[\]{}()|\\\/]/g, "\\$&"); // escape RegEx meta chars
  var match = location.search.match(new RegExp("[?&]"+key+"=([^&]+)(&|$)"));
  return match && decodeURIComponent(match[1].replace(/\+/g, " "));
}

EWD.onSocketsReady = function() {
  var code = getNVP('code');
  var token = getNVP('state');
  EWD.sockets.sendMessage({
    type: 'googleAuthentication',
    params: {
      code: code,
      token: token
    }
  });
  window.close();
};
