var ewdGlobals = require('c:\\node\\node_modules\\ewdgateway2\\lib\\ewdGlobals');
//var ewdGlobals = require('/home/pi/node/node_modules/ewdgateway2/lib/ewdGlobals');
var mongo = require('mongo');
var mongoDB = new mongo.Mongo();

var interface = require('mongoGlobals');
var db = new interface.Mongo();
db.open(mongoDB);
ewdGlobals.init(db);

var ewd = {
  mumps: ewdGlobals
};

// We're now in the same environment as back-end EWD.js modules
//  Write your test code here... (replace examples below)

// Mumps Global Emulation tests...

console.log(ewd.mumps.version());
console.log(db.about());

var testGlobal = new ewd.mumps.GlobalNode('testing', ['x']);

testGlobal._delete();
testGlobal.$('y')._value = 'hello world';
testGlobal.$('z')._value = '';
console.log('increment: ' + testGlobal.y._increment());
console.log('increment: ' + testGlobal.y._increment());
console.log('increment: ' + testGlobal.y._increment());
console.log('increment: ' + testGlobal.y._increment());

testGlobal._forEach(function(index, node) {
  console.log(index);
});

db.list('testing');
console.log('testing: ' + JSON.stringify(testGlobal._getDocument(), null, 2));

// ===============================

// MongoDB APIs can also be directly used, eg:

console.log(db.version());
// insert into collection
var result = db.insert("db.test", {
  department: "IT", 
  key: 1, 
  name: "Chris Munt", 
  phone_numbers: [
    {type: "home", no: 1234}, 
	{type: "work", no: 4321}
  ]
});
console.log("Result : " + JSON.stringify(result, null, 2));
// retrieve from collection
result = db.retrieve("db.test", {department: "IT"});
console.log("MongoDB Data: " + JSON.stringify(result, null, 2));

// Make sure you close the Node.js connection to MongoDB before you finish
db.close();
