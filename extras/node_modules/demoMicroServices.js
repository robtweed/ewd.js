module.exports = {

  onMessage: {

  },
  // authorise this app to access the demoPatientProfile back-end Micro-Service
  services: function() {
   return ['demoPatientProfile'];
  }
};