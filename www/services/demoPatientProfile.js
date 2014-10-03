define([],function() {

  console.log('demoPatientProfile service: loading');

  // anything here will be invoked as soon as module is loaded
  // however anyone calling upon this microservice will not have direct access to this section

  // populates the profile page with data returned from the backend profile service
  function populateProfileData(patientData) {
    // detatch our template element from the DOM
    var $templateRowEl = $('.js-profile-dataList-template').detach();
    var $templateCloneEl;
    // inject each piece of patient data into a clone of our template element
    // the attach the clone back into the DOM
    for (var heading in patientData) {
      $templateCloneEl = $templateRowEl.clone();
      $templateCloneEl.text(heading + ' : ' + patientData[heading]);
      $('.js-profile-dataList').append($templateCloneEl);
    }
  };

  // anything nested within this return will be available to the done() or onServiceReady method for this service
  return { 

    init: function(serviceName) {
      console.log('demoPatientProfile service: init() firing');
      // lets call upon the profile back end service now
      EWD.sockets.sendMessage({
        type:'getUserData',
        service:'demoPatientProfile',
        frontEndService: serviceName
      });
      console.log('demoPatientProfile service: message sent to demoPatientProfile back-end service');
    },

    // this will extend the EWD.application.onMessage object
    // the handler name will be prefixed with the module name, or the namespace specified with:
    // EWD.require({nameSpace:'myNamespace'})
    onMessage: {
      // handle the profile data our init() method has fetched
      getUserData: function(messageObj) {
        console.log('demoPatientProfile service: response received from dempPatientProfile back-end service');
        var patientData = messageObj.message;
        populateProfileData(patientData);
        $('.js-profile').show();
      }
    }

  }
});

