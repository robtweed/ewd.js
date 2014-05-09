var ewdGlobals = require('/home/ubuntu/node/node_modules/ewdgateway2/lib/ewdGlobals');
var interface = require('/home/ubuntu/mumps');
var db = new interface.Gtm();
var util = require('util');
var ok = db.open();
console.log('Open: ' + ok);
ewdGlobals.init(db);

var ewd = {
  mumps: ewdGlobals
};


// Environment is now set up exactly as within ewdgateway2/EWD Lite
// for accessing Mumps globals and functions from within this
// test harness, eg:

console.log(JSON.stringify(db.about()));

var node = {global: '%A1', subscripts: ['a', 'b'], data: 'hello world'};
var result = db.set(node);
console.log(JSON.stringify(result));

db.close();