var ewdGlobals = require('./node_modules/ewdjs/node_modules/globalsjs');
var interface = require('nodem');
require('gtm-config');
var db = new interface.Gtm();
console.log('db: ' + JSON.stringify(db));
var ok = db.open();
console.log('db.optn: ' + JSON.stringify(ok));
ewdGlobals.init(db);

var ewd = {
  mumps: ewdGlobals
};


// Environment is now set up exactly as within EWD.js
// for accessing Mumps globals and functions from within this
// test harness

console.log(JSON.stringify(db.about()));

db.close();