module.exports = {
  onMessage: {

    // returns some patient info
    // this likely would have been fetched from our database
    getUserData: function(params,ewd) {
      var patientData = {
        'First Name': 'Patient',
        'Last Name': 'Zero',
        'Date of Birth': '11/11/1950',
        'Address': '10 The Lane',
        'City': 'London',
        'State': 'UK'
      } 
      return patientData;
    }
  }
};