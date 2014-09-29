define([],function() {
  // anything here will be invoked as soon as module is loaded
  //console.log('callback in myService.js has been invoked');

  return {

    init: function(serviceName) {
      $('.js-ewdRequireLog').html(
        $('.js-ewdRequireLog').html() + '<br>- /services/microserviceExample.js: init() method has been invoked</br>'
      );
      // lets call upon a back end service now
      EWD.sockets.sendMessage({
        type:'backEndServiceMessage',
        service:'exampleBackEndService',
        frontEndService: serviceName // make sure the onMessage handlers in this service process the response
      });
      $('.js-ewdRequireLog').html(
        $('.js-ewdRequireLog').html() + '<br>- /services/microserviceExample.js: init() method sent a message of type "backEndServiceMessage" to the back-end Service module "exampleBackEndService.js"</br>'
      );
    },

    fragmentName: 'main.html', // optional, overrides automatic fragment path

    // this will extend the EWD.application.onMessage object
    // the handler name will be prefixed with the module name, or the namespace specified with:
    // EWD.require({nameSpace:'myNamespace'})

    onMessage: {
      // this will handle the response from our backend microservice which we're calling with init()

      backEndServiceMessage: function(messageObj) {
        var text = '<br>- /services/microServiceExample.js: backendServiceMessage() handler: The backend service just sent us the message:' + JSON.stringify(messageObj.message) + '</br>';
        $('.js-ewdRequireLog').html(
          $('.js-ewdRequireLog').html() + text
        );
      }
    },

    // this will extend the EWD.application.onFragment object

    onFragment: {
      /*
      'testPage.html': function(messageObj) {
         console.log('doing something onFragment');
       }
       */
    }
  }
});
