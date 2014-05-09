var client = require('ewdliteclient');

var args = {
 host: 'ec2-54-211-177-232.compute-1.amazonaws.com',
 port: 8080,
 ssl: true,
 appName: 'VistADemo',
 serviceName: 'authenticate',
 params: {
 accessId: 'VistAClient',
 accessCode: 'fakedoc1',
 verifyCode: '1Doc!@#$'
 },
 secretKey: '$keepSecret!'
};


client.run(args, function(error, data) {
 if (error) {
 console.log('An error occurred: ' + JSON.stringify(error));
 }
 else {
 console.log('Data returned by web service: ' + JSON.stringify(data));
 }
});

args.returnUrl = true;
var url = client.run(args);
console.log('url: ' + url);