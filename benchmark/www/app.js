EWD.application = {
  name: 'benchmark',

  onMessage: {
    'EWD.benchmark': function(messageObj) {
      var text = '<br />' + messageObj.no + ' messages';
      text = text + '<br />Time: ' + messageObj.time + ' sec';
      text = text + '<br />Throughput: ' + messageObj.messagesPerSec + ' /sec'
      text = text + '<br /><pre>' + JSON.stringify(messageObj.childProcesses, null, 2) + '</pre>';
      document.getElementById('results').innerHTML = text;
    }
  }
};

var sendMessage = function() {
 EWD.sockets.sendMessage({
   type: 'EWD.benchmark',
   noOfMessages: 10000,
   password: 'keepThisSecret!' 
 });
};
EWD.sockets.log = true;