EWD.application = {
  name: 'benchmark',


};

EWD.onSocketsReady = function() {
  EWD.sockets.sendMessage({
    type: 'getLoginType',
    done: function(messageObj) {
      var login = messageObj.message.login;
      document.getElementById('login-' + login).style.display = '';
      if (login === 'ewdMonitor') {
        EWD.application.login = function() {
          var username = document.getElementById('username').value;
          if (username === '') {
            alert('You must enter your username');
            return;
          }
          var password = document.getElementById('password').value;
          if (password === '') {
            alert('You must enter your password');
            return;
          }
          EWD.sockets.sendMessage({
            type: 'login',
            params: {
              username: username,
              password: password,
            },
            done: function(messageObj) {
              if (messageObj.message.error) {
                alert(messageObj.message.error);
              }
              else {
                document.getElementById('login-ewdMonitor').style.display = 'none';
                document.getElementById('test').style.display = '';
                document.getElementById('startCPBtn').onclick = function() {EWD.application.startTest(0)};
                document.getElementById('startMumpsBtn').onclick = function() {EWD.application.startTest(1)};
              }
            }
          });
        }
      }
      else {
        EWD.application.login = function() {
          var password = document.getElementById('mgrPassword').value;
          if (password === '') {
            alert('You must enter the EWD.js Managemnent password');
            return;
          }
          EWD.sockets.sendMessage({
            type: 'login',
            params: {
              password: password,
            },
            done: function(messageObj) {
              if (messageObj.message.error) {
                alert(messageObj.message.error);
              }
              else {
                document.getElementById('login-mgrPassword').style.display = 'none';
                document.getElementById('test').style.display = '';
                document.getElementById('startCPBtn').onclick = function() {EWD.application.startTest(0)};
                document.getElementById('startMumpsBtn').onclick = function() {EWD.application.startTest(1)};
              }
            }
          });
        }
      }
    }
  });


};

EWD.application.startTest = function(trip) {
 var no = $('#noOfMessages').val();
 EWD.sockets.sendMessage({
   type: 'EWD.benchmark',
   noOfMessages: no,
   ping: trip,
   done: function(messageObj) {
     var text = '<br />' + messageObj.no + ' messages';
     text = text + '<br />Time: ' + messageObj.time + ' sec';
     text = text + '<br />Throughput: ' + messageObj.messagesPerSec + ' /sec'
     text = text + '<br /><pre>' + JSON.stringify(messageObj.childProcesses, null, 2) + '</pre>';
     document.getElementById('results').innerHTML = text;
   }
 });
};

EWD.sockets.log = false;

