var ewdGlobals = require('/home/ubuntu/node/node_modules/ewdgateway2/lib/ewdGlobals');
var interface = require('/home/ubuntu/mumps');
var db = new interface.Gtm();
var util = require('util');
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