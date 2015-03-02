var ewdGlobals = require('./node_modules/ewdjs/node_modules/globalsjs');
var interface = require('cache');

// Modify these parameters to match your GlobalsDB or Cache System:
var params = {
  path: "c:\\InterSystems\\Cache\\Mgr",
  username: "_SYSTEM",
  password: "SYS",
  namespace: "USER"
};
var db = new interface.Cache();
console.log('db: ' + JSON.stringify(db));

var ok = db.open(params);
console.log('ok: ' + JSON.stringify(ok));

ewdGlobals.init(db);

var ewd = {
  mumps: ewdGlobals
};

// Environment is now set up exactly as within EWD.js
// for accessing Mumps globals and functions from within this
// test harness, eg:

//var version = ewd.mumps.function('version^%zewdAPI');
//console.log('version = ' + version);

//var zewd = new ewd.mumps.GlobalNode('%zewd', []);
//zewd._forEach(function(index) {
//  console.log(index);
//});

// Make sure you close the interface
//  If you don't, use tset to recover


var test = new ewd.mumps.GlobalNode('rob', ['test']);
test._delete();
var json = {
  string: 'abc',
  number: 12345
};

test._setDocument(json);

var x = test._getDocument();
console.log(JSON.stringify(x, null, 2));

db.close();
