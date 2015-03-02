var ewdGlobals = require('./node_modules/ewdjs/node_modules/globalsjs');
var interface = require('noDB');
var db = new interface.Gtm();
console.log('db: ' + JSON.stringify(db));
var ok = db.open();
console.log('db.open: ' + JSON.stringify(ok));
ewdGlobals.init(db);

var ewd = {
  mumps: ewdGlobals
};


// Environment is now set up exactly as within EWD.js
// for accessing Mumps globals and functions from within this
// test harness

console.log(JSON.stringify(db.about()));

// Set and retrieve a global node using raw cache.node API

var node = {
  global: 'test',
  subscripts: ['a', 'b'],
  data: 'Hello world'
};

db.set(node);

console.log('Global node value: ' + db.get(node).data);

// Now do the same, only using the globals.js interface:

var glo = new ewd.mumps.GlobalNode('test', []);
glo.$('a').$('c')._value = 'Pretty cool!';

var json = glo._getDocument();
console.log('Global contents: ' + JSON.stringify(json, null, 2));


db.close();