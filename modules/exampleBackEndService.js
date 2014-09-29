module.exports = {
 onMessage: {
   backEndServiceMessage: function(params, ewd) {
     //var msgNamespace = params.namespace;
     // send message back to browser
     // use front-end microservice namespace to ensure it's processed correctly in the browser's DOM

     //ewd.sendWebSocketMsg({
     //  type: msgNamespace + '-backendServiceMessage',
     //  message: 'The backEndServiceMessage was handled successfully by exampleBackEndService.js'
     //});
     return {status: 'The backEndServiceMessage was handled successfully by exampleBackEndService.js'};
   }
 }
};