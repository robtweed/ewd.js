var ewdGlobals = require('./node_modules/ewdjs/node_modules/globalsjs');
var interface = require('nodem');
require('gtm-config');
var db = new interface.Gtm();
var ok = db.open();
ewdGlobals.init(db);

var ewd = {
  mumps: ewdGlobals
};

var zewd = new ewd.mumps.GlobalNode('%zewd', []);
zewd._setDocument({
  "EWDLiteServiceAccessId": {
    "VistAClient": {
      "secretKey": "$keepSecret!",
      "apps": {
        "VistADemo": true,
        "VistARestServer": true
      }
    }
  }
});

db.close();
