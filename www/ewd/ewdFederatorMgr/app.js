/*

 ----------------------------------------------------------------------------
 | ewdFederatorMgr: EWD Federator Management Utility                        |
 |                                                                          |
 | Copyright (c) 2013-15 M/Gateway Developments Ltd,                        |
 | Reigate, Surrey UK.                                                      |
 | All rights reserved.                                                     |
 |                                                                          |
 | http://www.mgateway.com                                                  |
 | Email: rtweed@mgateway.com                                               |
 |                                                                          |
 |                                                                          |
 | Licensed under the Apache License, Version 2.0 (the "License");          |
 | you may not use this file except in compliance with the License.         |
 | You may obtain a copy of the License at                                  |
 |                                                                          |
 |     http://www.apache.org/licenses/LICENSE-2.0                           |
 |                                                                          |
 | Unless required by applicable law or agreed to in writing, software      |
 | distributed under the License is distributed on an "AS IS" BASIS,        |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. |
 | See the License for the specific language governing permissions and      |
 |  limitations under the License.                                          |
 ----------------------------------------------------------------------------

Build 2: 5 February 2015

*/

EWD.sockets.log = true;

EWD.qMax = 0;

EWD.memory = {
  master: {
    rss: 'Not yet available',
    heapTotal: 'Not yet available',
    heapUsed: 'Not yet available'
  },
  plot: {
    master: []
  }
};
EWD.currentGraph = false;

    EWD.enablePopovers = function() {
      $('.cpPid').popover({
        title: "Memory Utilisation",
        html: true,
        trigger: "hover",
        container: 'body',
        content: function() {
          var html = '<table>                                                        \
                    <tr><td>rss:</td><td id="' + this.id + 'rss">' + EWD.memory[this.id].rss + '</td></tr>              \
                    <tr><td>Heap Total:</td><td id="' + this.id + 'heapTotal">' + EWD.memory[this.id].heapTotal + '</td></tr> \
                    <tr><td>Heap Used:</td><td id="' + this.id + 'heapUsed">' + EWD.memory[this.id].heapUsed + '</td></tr>   \
                  </table><br /><table id="' + this.id + 'Modules"> \
                    <thead><tr>    \
                      <th>Modules loaded</th>  \
                    </tr></thead>  \
                    <tbody>';
          for (var name in EWD.memory[this.id].modules) {
            html = html + '<tr><td>' + name + '</td></tr>';
          }
          html = html + '</tbody> \
                  </table>';
          return html;
        }
      });
      $('.cpStop').unbind('click');
      $('.cpStop').on('click', function(e) {
        if ($('#childProcessTable tr').length > 2) {
          var id = e.target.id;
          if (!id) id = e.target.parentNode.id;
          var pid = id.split('cpStopBtn')[1];
          EWD.sockets.sendMessage({
            type: "stopFederatorChildProcess",
            params: {
              pid: pid
            },
            done: function(messageObj) {
              var pid = messageObj.pid;
              if (pid) {
                $('#cpRow' + pid).remove();
                delete EWD.memory.plot['cpPid' + pid];
                delete EWD.memory['cpPid' + pid];
              }
            }
          });
          /*
          $('#cpRow' + pid).remove();
          delete EWD.memory.plot['cpPid' + pid];
          delete EWD.memory['cpPid' + pid];
          */
        }
        else {
          toastr.clear();
          toastr.warning('At least one Child Process must be left running');
        }
      });
      $('.cpNodeInspector').unbind('click');
      $('.cpNodeInspector').on('click', function(e) {
        var id = e.target.id;
        if (!id) id = e.target.parentNode.id;
        var ports = id.split('cpNodeInspectorBtn')[1].split('_');
        window.open('http://' + window.location.hostname + ':' + ports[1] + '/debug?port=' + ports[0], '_blank');
      });
    };

EWD.application = {
  name: 'ewdFederatorMgr',
  timeout: 3600,
  login: false,
  labels: {
    'ewd-title': 'EWD Federator Manager',
    'ewd-navbar-title-phone': 'Federator Manager',
    'ewd-navbar-title-other': 'EWD Federator Manager'
  },
  navFragments: {
    main: {
      cache: true
    },
    internals: {
      cache: false
    },
    db: {
      cache: false
    },
    about: {
      cache: true
    },
    disconnect: {
      cache: false
    }
  },
  memoryPolling: false,

  onStartup: function() {

    //EWD.getFragment('login.html', 'loginPanel'); 
    EWD.getFragment('navlist.html', 'navList'); 
    EWD.getFragment('confirm.html', 'confirmPanel'); 

    $('#loginPanel').modal({show: true, backdrop: 'static'});

    EWD.getGlobalSubscripts = function(params) {
      EWD.sockets.sendMessage({
        type: 'getGlobalSubscripts',
        params: params,
        done: function(messageObj) {
          if (EWD.application.loggedIn) {
            console.log('*** messageObj: ' + JSON.stringify(messageObj, null, 2));
            var data = messageObj.message.subscripts;
            if (data.rootLevel === 'true') {
              $('.tree-example').remove();
              EWD.application.messageObj = messageObj;
              EWD.sockets.sendMessage({
                type: "EWD.getFragment", 
                params:  {
                  file: 'tree.html',
                  targetId: 'sessionDataTree'
                }
              });
            }
            else {
              EWD.application.tree.callback({data: data.subscripts});
            }
          }
        }
      });  
    };

    // FuelUX Tree
    EWD.application.tree = {};
    EWD.application.tree.DataSource = function (options) {
      this._formatter = options.formatter;
      this._columns = options.columns;
      this._data = options.data;
    };
    EWD.application.tree.DataSource.prototype = {
      columns: function () {
        return this._columns;
      },
      data: function (options, callback) {
        if (jQuery.isEmptyObject(options)) {
          // load up the tree
          callback({data: this._data});
        }
        else {
          // fetch sub-items
          //console.log('options: ' + JSON.stringify(options, null, 2));
          EWD.application.tree.callback = callback;
          var type;
          var appName;
          var folder;
          if (options.type === 'folder') {
            EWD.getGlobalSubscripts({
              rootLevel: false,
              operation: options.operation,
              globalName: options.globalName,
              subscripts: options.subscripts
            });
          }
        }
      }
    };

    EWD.application.tree.confirmDelete = function(subscripts, xtype) {
      var globalName = subscripts.shift();
      $('#confirmPanelHeading').text('Are you sure you want to delete this record:');
      $('#confirmPanelQuestion').text(globalName + JSON.stringify(subscripts));
      $('#confirmPanelOKBtn').text('Yes');
      $('#confirmPanelOKBtn').attr('data-globalName', globalName);
      $('#confirmPanelOKBtn').attr('data-subscripts', JSON.stringify(subscripts));
      $('#confirmPanelOKBtn').attr('data-event-type', 'deleteGlobalNode');
      $('#confirmPanelOKBtn').attr('data-x-type', xtype);
      $('#confirmPanel').modal('show');
      //EWD.stopBtn = 'deleteGlobalNode';
    };

    EWD.application.tree.removeDeleteButton = function() {
      $('.tree-folder-name').off();
      $('.tree-item-name').off();
      EWD.application.tree.clearDeleteButton();
    };

    EWD.application.tree.clearDeleteButton = function() {
      if ($('#xcheck').length > 0) {
        var xtype = $('#xcheck').attr('class');
        if (xtype === 'xfolder') {
          text = $('#xcheck').attr('data-x-name');
          var parNode = $('#xcheck').parent();
          $('#xcheck').remove();
          $(parNode).text(text);
        }
        if (xtype === 'xitem') {
          var nodeSubscript = $('#xcheck').attr('data-x-name');
          var nodeValue = $('#xcheck').attr('data-x-value');
          var parNode = $('#xcheck').parent();
          $('#xcheck').remove();
          $(parNode).html(nodeSubscript + '<span>: </span>' + nodeValue);
        }
      }
    };

    EWD.application.tree.addDeleteButton = function() {
      var text;
      var nodeSubscript;
      var nodeValue;
      EWD.mouseIn = false;

      setTimeout(function() {
        $('.tree-folder-name').hover(function(e) {
          e.stopPropagation();
          if (EWD.mouseIn) return;
          EWD.mouseIn = true;
          EWD.application.tree.clearDeleteButton();
          text = $(this).text().trim();
          //$(this).html('<div class="checkbox" id="xcheck"><label id="xcheckText">' + text + '<input type="checkbox" name="xxx" /></label></div>');
          $(this).html('<div id="xcheck" class="xfolder" data-x-name="' + text + '">' + text + '&nbsp;&nbsp;<button type="button" class="btn btn-default btn-xs" data-toggle="tooltip" data-placement="top" data-original-title="Delete this node and its children"><span class="glyphicon glyphicon-remove"></span></button></div>');
          $('[data-toggle="tooltip"]').tooltip();
          $('#xcheck').on('click', function(evt) {
            evt.stopPropagation();
            var parents = $(e.target).parents('.tree-folder');
            var nodes = [];
            for (var i = 0; i < parents.length; i++) {
              nodes.push($(parents[i]).find('.tree-folder-name:first'));
            }
            var path = [];
            for (i = 0; i < nodes.length; i++) {
              path.push($(nodes[i]).text().trim());
            }
            path.reverse();
            path[path.length - 1] = text;
            //console.log(JSON.stringify(path));
            EWD.application.tree.node = $(e.target).parents('.tree-folder:first');
            EWD.application.tree.confirmDelete(path, 'folder');
          });
          $('#xcheck').on('mouseleave', function(evt) {
            evt.stopPropagation();
            EWD.application.tree.clearDeleteButton();
          });
          EWD.mouseIn = false;
        });

        $('.tree-item-name').hover(function(e) {
          e.stopPropagation();
          if (EWD.mouseIn) return;
          EWD.mouseIn = true;
          EWD.application.tree.clearDeleteButton();
          text = $(this).html();
          nodeSubscript = text.split('<span>')[0];
          nodeValue = text.split('</span>')[1];
          $(this).html('<div id="xcheck" class="xitem" data-x-name="' + nodeSubscript + '" data-x-value="' + nodeValue + '">' + text + '&nbsp;&nbsp;<button type="button" class="btn btn-default btn-xs" data-toggle="tooltip" data-placement="top" data-original-title="Delete"><span class="glyphicon glyphicon-remove"></span></button></div>');
          $('[data-toggle="tooltip"]').tooltip();
          $('#xcheck').on('click', function(evt) {
            evt.stopPropagation();
            var parents = $(this).parents('.tree-folder');
            var nodes = [];
            for (var i = 0; i < parents.length; i++) {
              nodes.push($(parents[i]).find('.tree-folder-name:first'));
            }
            var path = [];
            for (i = 0; i < nodes.length; i++) {
              path.push($(nodes[i]).text().trim());
            }
            path.reverse();
            //var parNode = $(this).parents('.tree-item:first').parent(); 
            //path.push($(parNode).find('.tree-folder-name:first').text().trim());
            path.push(nodeSubscript);
            //console.log(JSON.stringify(path));
            EWD.application.tree.node = $(this).parents('.tree-item:first');
            EWD.application.tree.confirmDelete(path, 'item');
          });
          $('#xcheck').on('mouseleave', function(evt) {
            evt.stopPropagation();
            EWD.application.tree.clearDeleteButton();
          });
          EWD.mouseIn = false;
        });
     
      },300);
    };

    EWD.bootstrap3.nav.enable();

    EWD.activateLoginPanel = function(fullLogin) {
      $('#ewd-loginPanel-title').text('EWD Federator Manager');

      document.getElementById('username').focus();

      $('#loginPanelBody').keydown(function(event){
        if (event.keyCode === 13) {
          document.getElementById('loginBtn').click();
        }
      });

      $('#loginBtn').click(function(event) {
        event.preventDefault(); // prevent default bootstrap behavior
        var password = '';
        if (fullLogin) password = $('#password').val();
        EWD.sockets.submitForm({
          fields: {
            username: $('#username').val(),
            password: password
          },
          messageType: 'EWD.form.login',
          alertTitle: 'Login Error',
          toastr: {
            target: 'loginPanel'
          },
          done: function(messageObj) {
            if(messageObj.ok) {
              $('#loginPanel').modal('hide');
              EWD.application.loggedIn = true;
              EWD.sockets.sendMessage({
                type: 'getServers',
                done: function(messageObj) {
                  if (messageObj.message.status) {
                    EWD.application.servers = messageObj.message.servers;
                    EWD.getFragment('selectServer.html', 'serverPanel');
                  }
                  else {
                    //display new server panel
                    EWD.getFragment('addServer.html', 'serverPanel'); 
                  }
                }
              });
            }
          }
        }); 
      });

      $('#loginBtn').show();

    };

    EWD.sockets.sendMessage({
      type: 'getLoginType',
      done: function(messageObj) {
        EWD.sockets.sendMessage({
          type: "EWD.getFragment", 
          params:  {
            file: messageObj.message.file,
            targetId: 'loginPanel'
          }
        });
      }
    });

  },

  onPageSwap: {
    // add handlers that fire after pages are swapped via top nav menu
    /* eg:
    about: function() {
      console.log('"about" menu was selected');
    }
    */

    db: function() {
      if (EWD.targetIdExists('dbPageLoaded')) {
        $('.fuelux').remove();
        EWD.sockets.sendMessage({
          type: 'getGlobals'
        });
      }
    },

    disconnect: function(messageObj) {
      //$('#disconnect_Container').text('');
      setTimeout(function() {
        if (EWD.application.getMemoryEvent) {
          clearTimeout(EWD.application.getMemoryEvent);
          delete EWD.application.getMemoryEvent;
          EWD.application.memoryPolling = false;
        }
        toastr.options.target = '#serverPanel';
        $('#main_Nav').click();
        $('#main_Container').html('');
        $('#serverPanel').modal({show: true, backdrop: 'static'});
      },2000);
    },

  },

  onFragment: {
    // add handlers that fire after fragment contents are loaded into browser

    'login.html': function(messageObj) {
      EWD.activateLoginPanel(true);
    },

    'initialLogin.html': function(messageObj) {
      EWD.activateLoginPanel(false);
    },

    'navlist.html': function(messageObj) {
      EWD.bootstrap3.nav.enable();
    },

    'addServer.html': function(messageObj) {
      $('#serverPanel').on('show.bs.modal', function() {
        setTimeout(function() {
          document.getElementById('name').focus();
        },1000);
      });

      $('#addServerPanelBody').keydown(function(event){
        if (event.keyCode === 13) {
          document.getElementById('addBtn').click();
        }
      });

      $('#addBtn').click(function(e) {
        e.preventDefault();
        if ($('#name').val() === '') {
          toastr.error('You must give this new instance a name');
          return;
        }
        if ($('#host').val() === '') {
          toastr.error('You must enter a host IP Address or Name');
          return;
        }
        var port = $('#port').val();
        if (port === '') {
          toastr.error('You must enter a Port number');
          return;
        }
        if (!$.isNumeric(port) || port < 1) {
          toastr.error('Invalid Port number');
          return;
        }
        if ($('#password').val() === '') {
          toastr.error("You must enter the REST Server's Management Password");
          return;
        }

        EWD.sockets.sendMessage({
          type: 'addServer',
          params: {
            name: $('#name').val(),          
            host: $('#host').val(),
            port: $('#port').val(),
            password: $('#password').val(),
            ssl: $("input[name='ssl']:checked").val(),
          },
          done: function(messageObj) {
            if (messageObj.message.error) {
              if (messageObj.message.data) {
                toastr.error('Unable to connect to server: ' + messageObj.message.data.message);
              }
              else {
                toastr.error('Unable to connect to server: ' + messageObj.message.error);
              }
            }
            else {
              EWD.application.servers = [$('#name').val()];
              //$('#serverPanel').modal('hide');
              toastr.success('New Federator Added Successfully');
              EWD.getFragment('selectServer.html', 'serverPanel'); 
            }
          }
        });
      });

      $('#backToSelectBtn').click(function(e) {
        e.preventDefault();
        EWD.getFragment('selectServer.html', 'serverPanel'); 
      });

      $('#serverPanel').modal({show: true, backdrop: 'static'});
      $('#addBtn').show();
      if (EWD.application.servers) $('#backToSelectBtn').show();
      $('[data-toggle="tooltip"]').tooltip();

    },

    'selectServer.html': function(messageObj) {
      //console.log("selectServer fetched");
      toastr.options.target = '#serverPanel';
      var name;
      for (var i = 0; i < EWD.application.servers.length; i++) {
        name = EWD.application.servers[i];
        $('#federatorName').append('<option value="' + name + '">' + name + '</option>');
      }
      $('#selectInstanceBtn').click(function(e) {
        e.preventDefault();
        EWD.sockets.sendMessage({
          type: 'connect',
          params: {
            name: $('#federatorName').val()      
          },
          done: function(messageObj) {
            if (messageObj.message.error) {
              var error = messageObj.message.error;
              if (messageObj.message.errorText) error = messageObj.message.errorText;
              toastr.error(error);
              //console.log('error: ' + error);
            }
            else {
              EWD.application.info = messageObj.message.info;
              $('#serverPanel').modal('hide');
              EWD.getFragment('main.html', 'main_Container');
              //$('#main_Nav').click();
              EWD.application.info.instanceName = $('#federatorName').val(); 
            }
          }
        });
      });

      $('#addInstanceBtn').click(function(e) {
        e.preventDefault();
        EWD.getFragment('addServer.html', 'serverPanel'); 
      });

      $('#serverPanel').modal({show: true, backdrop: 'static'});
      $('#selectInstanceBtn').show();
      $('#addInstanceBtn').show();
      $('[data-toggle="tooltip"]').tooltip();
    },

    'internals.html': function(messageObj) {
      EWD.sockets.sendMessage({
        type: "getInternals",
        done: function(messageObj) {
          $('#internals_poolSize').text(messageObj.message.poolSize);
          $('#internals_params').text(JSON.stringify(messageObj.message.startupParams, null, 2));
          $('#internals_process').text(JSON.stringify(messageObj.message.process, null, 2));
          $('#internals_requestsByProcess').text(JSON.stringify(messageObj.message.requestsByProcess, null, 2));
          $('#internals_queueByPid').text(JSON.stringify(messageObj.message.queueByPid, null, 2));
        }
      });
      $('#internalsDebugBtn').click(function(e) {
        EWD.sockets.sendMessage({
          type: "EWD.getFragment", 
          params:  {
            file: 'debugForm.html',
            targetId: 'InfoPanelText'
          }
        });
      });
    },

    'main.html': function(messageObj) {
      $('#main_Container').show();
      $('#buildVersion-Node').text(EWD.application.info.nodejs);
      $('#buildVersion-federator').text(EWD.application.info.build);
      $('#mainProcess-pid').text(EWD.application.info.masterProcess);
      $('#startedDate').text(EWD.application.info.started);
      $('#uptime').text(EWD.application.info.uptime);
      $('#overviewTitle').text('  EWD Federator (' + EWD.application.info.instanceName + ') Overview');
      $('#ewd-navbar-title-other').text('EWD Federator Manager: ' + EWD.application.info.instanceName);

      $('#mainProcess-pid').popover({
        title: "Memory Utilisation",
        html: true,
        trigger: "hover",
        content: function() {
          return '<table>                                                        \
                    <tr><td>rss:</td><td id="master-rss">' + EWD.memory.master.rss + '</td></tr>              \
                    <tr><td>Heap Total:</td><td id="master-heapTotal">' + EWD.memory.master.heapTotal + '</td></tr> \
                    <tr><td>Heap Used:</td><td id="master-heapUsed">' + EWD.memory.master.heapUsed + '</td></tr>   \
                  </table>'
          ;
        }
      });

      var childProcesses = EWD.application.info.childProcesses;
      var html = '';
      var childProcess;
      var pid;
      for (var i = 0; i < childProcesses.length; i++) {
        pid = childProcesses[i];
        html = html + '<tr class="table" id="cpRow' + pid + '">';
        html = html + '<td class="cpPid" id="cpPid' + pid + '">' + pid + '</td>';
        html = html + '<td id="cpRequests' + pid + '"></td>';
        html = html + '<td id="cpAvailable' + pid + '"></td>';
        html = html + '<td>';   
        html = html + '<button class="btn btn-danger pull-right cpStop" type="button" id="cpStopBtn' + pid + '" data-toggle="tooltip" data-placement="top" title="" data-original-title="Stop Child Process"><span class="glyphicon glyphicon-remove"></span></button></td>';
        html = html + '</tr>';
        EWD.memory['cpPid' + pid] = {
          rss: 'Not yet available',
          heapTotal: 'Not yet available',
          heapUsed: 'Not yet available'
        }
        EWD.memory.plot['cpPid' + pid] = [];
      }
      $('#childProcessTable tbody').html(html);
      EWD.enablePopovers();
      $('[data-toggle="tooltip"]').tooltip();

      $('#stopBtn').click(function(e) {
        $('#confirmPanelHeading').text('Attention!');
        $('#confirmPanelQuestion').text('Are you sure you really want to shut down this EWD Federator?');
        $('#confirmPanelOKBtn').text('Yes');
        $('#confirmPanelOKBtn').attr('data-event-type', 'shutdown');
        $('#confirmPanel').modal('show');
      });

      $('#confirmPanelOKBtn').click(function(e) {
        var eventType = $('#confirmPanelOKBtn').attr('data-event-type');
        if (eventType === 'shutdown') {
          $('#confirmPanel').modal('hide');
          EWD.sockets.sendMessage({
            type: "halt",
            done: function(messageObj) {
              toastr.clear();
              toastr.warning('This EWD Federator has been stopped');
              setTimeout(function() {
                if (messageObj.message.info.ok) {
                  //location.reload();
                  $('#disconnect_Nav').click();
                }
              },2000);
            }
          });
        }
      });

      $('#cpStartBtn').click(function(e) {
        EWD.sockets.sendMessage({
          type: "startChildProcess",
          done: function(messageObj) {
            var html = '';
            var pid = messageObj.pid;
            html = html + '<tr class="table" id="cpRow' + pid + '">';
            html = html + '<td class="cpPid" id="cpPid' + pid + '">' + pid + '</td>';
            html = html + '<td id="cpRequests' + pid + '">0</td>';
            html = html + '<td id="cpAvailable' + pid + '">true</td>';
            html = html + '<td>'
            if (messageObj.debug) {
              html = html + '<button class="btn btn-info pull-left cpNodeInspector" type="button" id="cpNodeInspectorBtn' + debug.port + '_' + debug.web_port + '" data-toggle="tooltip" data-placement="top" title="" data-original-title="Start Debugging (web_port=' + debug.web_port + ')"><span class="glyphicon glyphicon-wrench"></span></button>';
            }
            html = html + '<button class="btn btn-danger pull-right cpStop" type="button" id="cpStopBtn' + pid + '" data-toggle="tooltip" data-placement="top" title="" data-original-title="Stop Child Process"><span class="glyphicon glyphicon-remove"></span></button></td>';
            html = html + '</tr>';
            $('#childProcessTable tbody').append(html);
            EWD.enablePopovers();
            $('[data-toggle="tooltip"]').tooltip();
            EWD.memory['cpPid' + pid] = {
              rss: 'Not yet available',
              heapTotal: 'Not yet available',
              heapUsed: 'Not yet available'
            };
            EWD.memory.plot['cpPid' + pid] = [];
          }
        });
      });

      EWD.sockets.sendMessage({
        type: 'getDBInfo',
        done: function(messageObj) {
          var pieces = messageObj.message.database.split('; ');
          $('#buildVersion-iface').text(pieces[0]);
          $('#buildVersion-db').text(pieces[1]);
        }
      });

      EWD.application.getMemory = function() {
        EWD.sockets.sendMessage({
          type: 'getMemory',
          done: function(messageObj) {
            //console.log('*** updating');
            if (!messageObj.childProcess) {
              $('#master-rss').text(messageObj.memory.rss);
              $('#master-heapTotal').text(messageObj.memory.heapTotal);
              $('#master-heapUsed').text(messageObj.memory.heapUsed);
              $('#masterProcess-qLength').text(messageObj.memory.queueLength);
              $('#uptime').text(messageObj.memory.upTime);
              EWD.memory.master = messageObj.memory;
              for (var cpPid in messageObj.memory.childProcesses) {
                $('#cpRequests' + cpPid).text(messageObj.memory.childProcesses[cpPid].requests);                
                $('#cpAvailable' + cpPid).text(messageObj.memory.childProcesses[cpPid].available);   
              }
            }
            else {
              var pid = messageObj.pid;
              EWD.memory['cpPid' + pid] = messageObj.memory;
              if ($('#cpPid' + pid + 'rss')) {
                $('#cpPid' + pid + 'rss').text(messageObj.memory.rss);
                $('#cpPid' + pid + 'heapTotal').text(messageObj.memory.heapTotal);
                $('#cpPid' + pid + 'heapUsed').text(messageObj.memory.heapUsed);
              }
            }
          }
        });
        EWD.application.getMemoryEvent = setTimeout(EWD.application.getMemory, 30000);
      };

      // start memory poll
      if (!EWD.application.memoryPolling) {
        EWD.application.getMemoryEvent = setTimeout(EWD.application.getMemory, 1000);
        EWD.application.memoryPolling = true;
      }
    },

    'tree.html': function(messageObj) {
      var msg = EWD.application.messageObj;
      if (msg.message.operation === 'sessionData') {
        $('#sessionDataPanel').show();
        $('#sessionDataTitle').text('Session ' + msg.message.sessid);
      }
      var data;
      if (msg.type === 'getGlobals') {
        data = msg.message.globals;
      }
      else {
        data = msg.message.subscripts;
      }
      EWD.application.tree.treeDataSource = new EWD.application.tree.DataSource({
        data: data,
        delay: 400
      });
      $('#ewd-session-root').tree({dataSource: EWD.application.tree.treeDataSource});
      $('#wait').hide();
      $('.tree-example').on('selected', function (evt, data) {
        // remove the tick if you select an item
        EWD.tree = {evt: evt, data: data};
        $('.icon-ok').removeClass('icon-ok').addClass('tree-dot');
      });
      $('.tree-example').on('opened', function (evt, data) {
        EWD.tree = {evt: evt, data: data};
      });
    },

    'db.html': function(messageObj) {
      $('[data-toggle="tooltip"]').tooltip();
      $('#dbTreePanel').height($(window).height() - 200);
      $('#dbDisableDeleteBtn').hide();
      EWD.sockets.sendMessage({
        type: 'getGlobals'
      });
      $('#dbReloadBtn').on('click', function(e) {
        EWD.sockets.sendMessage({
          type: 'getGlobals'
        });
      });
      $('#dbEnableDeleteBtn').on('click', function(e) {
        EWD.application.tree.addDeleteButton();
        $('#dbDisableDeleteBtn').show();
        $('#dbEnableDeleteBtn').hide();
      });
      $('#dbDisableDeleteBtn').on('click', function(e) {
        EWD.application.tree.removeDeleteButton();
        $('#dbDisableDeleteBtn').hide();
        $('#dbEnableDeleteBtn').show();
      });
    },

  },

  onMessage: {

    // add handlers that fire after JSON WebSocket messages are received from back-end

    loggedIn: function(messageObj) {
      toastr.options.target = 'body';
      $('#main_Container').show();
      //$('#mainPageTitle').text('Welcome to VistA, ' + messageObj.message.name);
    },

    getGlobals: function(messageObj) {
      if (EWD.application.loggedIn) {
        $('.tree-example').remove();
        EWD.application.messageObj = messageObj;
        EWD.sockets.sendMessage({
          type: "EWD.getFragment", 
          params:  {
            file: 'tree.html',
            targetId: 'dbTreePanel'
          }
        });
      }
    },

  }

};





