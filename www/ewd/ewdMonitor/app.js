/*

 ----------------------------------------------------------------------------
 | ewdMonitor: EWD.js Monitor Application                                   |
 |                                                                          |
 | Copyright (c) 2013-14 M/Gateway Developments Ltd,                        |
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

Build 9: 29 August 2014

*/

var isInteger = function(n) {    
  return $.isNumeric(n) && parseInt(n, 10) > 0;
};

EWD.application = {
  name: 'ewdMonitor',
  timeout: 3600,
  login: true,
  labels: {
    'ewd-title': 'EWD.js Monitor',
    'ewd-loginPanel-title': 'EWD.js Monitor',
    'ewd-navbar-title-phone': 'EWD.js',
    'ewd-navbar-title-other': 'EWD.js Monitor',
    'ewd-menu-title': 'Menu'
  },
  navFragments: {
    memory: {
      cache: false
    },
    sessions: {
      cache: false
    },
    internals: {
      cache: false
    },
    db: {
      cache: true
    },
    importer: {
      cache: true
    },
    wsMgr: {
      cache: true
    },
    about: {
      cache: true
    },
    logout: {
      cache: true
    }
  },

  onStartup: function() {

    EWD.bootstrap3.nav.enable();

    EWD.maxConsoleLength = 1000;

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

    EWD.getPlotData = function(name) {
      var data = {
        rss: [],
        heapTotal: [],
        heapUsed: []
      };
      for (var i = 0; i < EWD.memory.plot[name].length; i++) {
        data.rss.push([i, +EWD.memory.plot[name][i].rss]);
        data.heapTotal.push([i, +EWD.memory.plot[name][i].heapTotal]);
        data.heapUsed.push([i, +EWD.memory.plot[name][i].heapUsed]);
      }
      return data;
    };

    EWD.replotGraph = function(name) {
      if (EWD.memory.plot[name]) {
        var data = EWD.getPlotData(name);
        EWD.plot.setData([
          {data: data.rss, label: 'rss'},
          {data: data.heapTotal, label: 'heapTotal'}, 
          {data: data.heapUsed, label: 'heapUsed'} 
        ]);
        EWD.plot.setupGrid();
        EWD.plot.draw();
      }
      else {
        EWD.currentGraph = 'master';
      }
    };

    EWD.addChildProcessToTable = function(pid, debug) {
      var html = '';
      html = html + '<tr class="table" id="cpRow' + pid + '">';
      html = html + '<td class="cpPid" id="cpPid' + pid + '">' + pid + '</td>';
      html = html + '<td id="cpRequests' + pid + '">0</td>';
      html = html + '<td id="cpAvailable' + pid + '">true</td>';
      html = html + '<td>'
      if (debug) {
        html = html + '<button class="btn btn-info pull-left cpNodeInspector" type="button" id="cpNodeInspectorBtn' + debug.port + '_' + debug.web_port + '" data-toggle="tooltip" data-placement="top" title="" data-original-title="Start Debugging (web_port=' + debug.web_port + ')"><span class="glyphicon glyphicon-wrench"></span></button>';
      }
      html = html + '<button class="btn btn-danger pull-right cpStop" type="button" id="cpStopBtn' + pid + '" data-toggle="tooltip" data-placement="top" title="" data-original-title="Stop Child Process"><span class="glyphicon glyphicon-remove"></span></button></td>';
      html = html + '</tr>';
      EWD.memory['cpPid' + pid] = {
        rss: 'Not yet available',
        heapTotal: 'Not yet available',
        heapUsed: 'Not yet available'
      };
      EWD.memory.plot['cpPid' + pid] = [];
      return html;
    };

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
            type: "stopChildProcess", 
            password: EWD.password,
            pid: pid
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

    EWD.getGlobalSubscripts = function(params) {
      EWD.sockets.sendMessage({
        type: 'getGlobalSubscripts',
        params: params
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


    // Enable tooltips
    $('[data-toggle="tooltip"]').tooltip();


    $('#mainProcess-pid').popover({
      title: "Memory Utilisation",
      html: true,
      trigger: "hover",
      content: function() {
        return '<table>                                                        \
                  <tr><td>rss:</td><td id="master-rss">' + EWD.memory.master.rss + '</td></tr>              \
                  <tr><td>Heap Total:</td><td id="master-heapTotal">' + EWD.memory.master.heapTotal + '</td></tr> \
                  <tr><td>Heap Used:</td><td id="master-heapUsed">' + EWD.memory.master.heapUsed + '</td></tr>   \
                </table>';
      }
    });


    $('#stopBtn').click(function(e) {
      $('#confirmPanelHeading').text('Attention!');
      $('#confirmPanelQuestion').text('Are you sure you really want to shut down the EWD.js process?');
      $('#confirmPanelOKBtn').text('Yes');
      $('#confirmPanelOKBtn').attr('data-event-type', 'shutdown');
      $('#confirmPanel').modal('show');
      //EWD.stopBtn = 'shutdown';
    });

    $('#confirmPanelOKBtn').click(function(e) {
      var eventType = $('#confirmPanelOKBtn').attr('data-event-type');
      if (eventType === 'shutdown') {
        $('#confirmPanel').modal('hide');
        EWD.sockets.sendMessage({
          type: "EWD.exit", 
          password: EWD.password
        });
        toastr.clear();
        toastr.warning('EWD.js has been stopped');
      }
      if (eventType === 'deleteGlobalNode') {
        var globalName = $('#confirmPanelOKBtn').attr('data-globalName');
        var subscripts = JSON.parse($('#confirmPanelOKBtn').attr('data-subscripts'));
        var xtype = $('#confirmPanelOKBtn').attr('data-x-type');
        //console.log(globalName + ': ' + JSON.stringify(subscripts));
        $('#confirmPanel').modal('hide');
        EWD.sockets.sendMessage({
          type: "deleteGlobalNode", 
          params: {
            globalName: globalName,
            subscripts: subscripts
          }
        });

        var deleteEmptyFolder = function(treeFolderContentNode) {
          if ($(treeFolderContentNode).children().length === 0) {
            var treeFolderNode = $(treeFolderContentNode).parent();
            var treeFolderContentNodeAbove = $(treeFolderNode).parent();
            $(treeFolderNode).remove();
            deleteEmptyFolder(treeFolderContentNodeAbove);
          }
        };

        if (xtype === 'item' || xtype === 'folder') {          
          var treeFolderContentNode = EWD.application.tree.node.parent();
          $(EWD.application.tree.node).remove();
          deleteEmptyFolder(treeFolderContentNode);
        }
      }
    });

    $('#cpStartBtn').click(function(e) {
      EWD.sockets.sendMessage({
        type: "EWD.workerProcess", 
        action:  'add', 
        password: EWD.password,
        debug: false
      });
    });

    $('#cpDebugBtn').click(function(e) {
      EWD.sockets.sendMessage({
        type: "EWD.workerProcess", 
        action:  'add', 
        password: EWD.password,
        debug: true
      });
    });

    $('#monitoringLevelBtn').click(function(e) {
      EWD.sockets.sendMessage({
        type: "EWD.getFragment", 
        params:  {
          file: 'monLevel.html',
          targetId: 'InfoPanelText'
        }
      });
    });

    $('#monitoringDestBtn').click(function(e) {
      EWD.sockets.sendMessage({
        type: "EWD.getFragment", 
        params:  {
          file: 'monDest.html',
          targetId: 'InfoPanelText'
        }
      });
    });

    $('#InfoPanelCloseBtn').click(function(e) {
      $('#InfoPanel').modal('hide');
    });

    EWD.stopBtn = false;

    EWD.keepAlive = function() {
      setTimeout(function() {
        EWD.sockets.sendMessage({
          type: 'keepAlive'
        });
      },3400000);
    };

    EWD.keepAlive();

  },

  onPageSwap: {

    console: function() {
      $('.console').height($(window).height() - 200);
      //console.log("**** height: " + $('.console').height());
      setTimeout(function() {
        $("#consoleText").animate({ scrollTop: $('#consoleText')[0].scrollHeight}, 5);
     }, 3000);
     $(window).resize(function() {
       $('.console').height($(window).height() - 200);
     });
    },

    db: function() {
      if (EWD.targetIdExists('dbPageLoaded')) {
        $('.fuelux').remove();
        EWD.sockets.sendMessage({
          type: 'getGlobals'
        });
      }
    }
  },

  onFragment: {
    // injected fragments

    'logout.html': function(messageObj) {
      EWD.sockets.sendMessage({
        type: 'EWD.logout'
      });
      setTimeout(function() {
        EWD.bootstrap3.nav.disable();
      }, 2000);
    },

    'monLevel.html': function(messageObj) {
      $('#InfoPanelTitle').text('Monitoring Level');
      $('#InfoPanelHeading').text('');
      $('#InfoPanel').modal('show');
      $('#monLevel' + EWD.application.traceLevel).prop('checked', true);
      $("input[name=monLevel]").click(function(){
        var level = $('input[name=monLevel]:checked', '#monLevelForm').val();
        $('#InfoPanel').modal('hide');
        EWD.sockets.sendMessage({
            type: 'EWD.setParameter', 
            name: 'monitorLevel', 
            value: level,
	     password: EWD.password
        });
        EWD.application.traceLevel = level;
        toastr.clear();
        toastr.success('Monitoring level reset to ' + level);
      });
    },

    'mgrPassword.html': function(messageObj) {
      $('#InfoPanelTitle').text('Management Password Reset');
      $('#InfoPanelHeading').text('');
      $('#InfoPanel').modal('show');
      $('#mgrPassword').val(EWD.password);

      $("#updateMgrPasswordBtn").click(function(){
        var newPassword = $('#mgrPassword').val();
        if (newPassword === '') {
          toastr.error('You must enter a password value');
        }
        else {
          EWD.sockets.sendMessage({
            type: 'EWD.resetPassword', 
            value: newPassword,
            password: EWD.password
          });
        }
      });

    },

    'debugForm.html': function(messageObj) {
      $('#InfoPanelTitle').text('Reset Node Inspector Ports');
      $('#InfoPanelHeading').text('');
      $('#InfoPanel').modal('show');
      EWD.sockets.sendMessage({
        type: 'EWD.getDebugPorts',
        password: EWD.password
      });

      $("#updateDebugBtn").click(function(){
        var childPort = $('#debug_child_port').val();
        if (childPort === '') {
          toastr.error('You must enter a value for the Child Process Debugger Port');
          return;
        }
        if (!isInteger(childPort)) {
          toastr.error('Invalid Child Process Debugger Port');
          return;
        }
        var webPort = $('#debug_web_port').val();
        if (webPort === '') {
          toastr.error("You must enter a value for Node Inspector's Web Port");
          return;
        }
        if (!isInteger(webPort)) {
          toastr.error("Invalid value for Node Inspector's Web Port");
          return;
        }
        EWD.sockets.sendMessage({
          type: 'EWD.changeDebugPorts', 
          child_port: childPort,
          web_port: webPort,
          password: EWD.password
        });
      });

    },

    'monDest.html': function(messageObj) {
      $('#InfoPanelTitle').text('Monitoring Destination');
      $('#InfoPanelHeading').text('');
      $('#InfoPanel').modal('show');
      $('#monDest' + EWD.application.logTo).prop('checked', true);
      $('#monDestFileName').val(EWD.application.logFile);
      if (EWD.application.logTo === 'console') $('#monDestFileName').prop("disabled", true);
      $("input[name=monDest]").click(function(){
        var dest = $('input[name=monDest]:checked', '#monDestForm').val();
        if (dest === 'console') {
          $('#InfoPanel').modal('hide');
        }
        else {
          $('#monDestFileName').prop("disabled", false);
        }
        EWD.sockets.sendMessage({
            type: 'EWD.setParameter', 
            name: 'logTo', 
            value: dest,
	     password: EWD.password
        });
        EWD.application.logTo = dest;
        toastr.clear();
        toastr.success('Monitoring destination reset to ' + dest);
      });
      $('#monDestFileName').focusout(function() {
        var filename = $('#monDestFileName').val();
        if (filename !== EWD.application.logFile) {
          EWD.sockets.sendMessage({
            type: 'EWD.setParameter',
            name: 'changeLogFile', 
            value: filename, 
            password: EWD.password
          });
          EWD.application.logFile = filename;
          toastr.clear();
          toastr.success('Monitoring file reset to ' + filename);
        }
      });
    },

    'memory.html': function(messageObj) {
      $('.graph-Container').width($(window).width() * 0.76);
      $('#memoryGraph').width($(window).width() * 0.75);
      var data = EWD.getPlotData('master');
      EWD.plot = $.plot("#memoryGraph", [
          {data: data.rss, label: 'rss'},
          {data: data.heapTotal, label: 'heapTotal'}, 
          {data: data.heapUsed, label: 'heapUsed'} 
        ], {
        series: {
          shadowSize: 0,
          points: {show: true},
          lines: {show: true}
        },
        grid: {
          hoverable: true
        },
        yaxis: {
          min: 0
        },
        xaxis: {
          min: 0,
          max: 60,
          show: true
        }
      });
      EWD.currentGraph = 'master';
      $("<div id='memory-tooltip'></div>").css({
        position: "absolute",
        display: "none",
        border: "1px solid #fdd",
        padding: "2px",
        "background-color": "#fee",
        opacity: 0.80
      }).appendTo("body");
      $("#memoryGraph").bind("plothover", function (event, pos, item) {
        if (item) {
          var x = item.datapoint[0].toFixed(2);
          var y = item.datapoint[1].toFixed(2);
          $("#memory-tooltip").html(item.series.label + ": " + y)
            .css({top: item.pageY+5, left: item.pageX+5})
            .fadeIn(200);
        }
        else {
          $("#memory-tooltip").hide();
        }
      });
      var pname;
      var cls;
      var html;
      for (var name in EWD.memory.plot) {
        pname = name;
        cls = 'btn-success';
        if (name !== 'master') {
          pname = name.split('cpPid')[1];
          cls = 'btn-primary';
        }
        html = '<div><button type="button" class="btn memoryBtn ' + cls + '" id="memoryBtn' + pname + '">' + pname + '</button></div>';
        $('#memory-processes').append(html);
      }
      $('.memoryBtn').click(function(e) {
        var pid = e.target.id.split('memoryBtn')[1];
        //console.log(pid + '; ' + EWD.currentGraph);
        var name = pid;
        if (pid !== 'master') name = 'cpPid' + pid;
        var oldName = EWD.currentGraph;
        if (oldName !== 'master') oldName = EWD.currentGraph.split('cpPid')[1];
        if (name !== EWD.currentGraph) {
          $('#memoryBtn' + pid).addClass('btn-success').removeClass('btn-primary');
          $('#memoryBtn' + oldName).addClass('btn-primary').removeClass('btn-success');
          EWD.currentGraph = name;
          EWD.replotGraph(name);
        }
      });
      $(window).resize(function() {
        if ($('.console').length > 0) {
          $('.console').height($(window).height() - 200);
        }
        if ($('#memoryGraph').length > 0) {
          $('.graph-Container').width($(window).width() * 0.76);
          $('#memoryGraph').width($(window).width() * 0.75);
          EWD.plot.resize();
          EWD.replotGraph(EWD.currentGraph);
        }
      });
      $('#graph-interval').slider({
        value: (EWD.application.interval / 1000) || 30,
        min: 5,
        max: 600,
        step: 5,
        slide: function(event, ui) {
          $( "#graph-interval-value" ).val(ui.value);
        },
        stop: function(event, ui) {
          EWD.sockets.sendMessage({
            type: 'EWD.setParameter',
            name: 'monitorInterval',
            value: ui.value * 1000,
            password: EWD.password
          });
          toastr.clear();
          toastr.success('Monitoring interval reset to ' + ui.value + ' sec');
        }
      });
      $( "#graph-interval-value" ).val(EWD.application.interval / 1000);
    },

    'sessions.html': function(messageObj) {
      EWD.sockets.sendMessage({type: "getSessions"});
    },

    'internals.html': function(messageObj) {
      EWD.sockets.sendMessage({
        type: "EWD.inspect",
        password: EWD.password
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

    'tree.html': function(messageObj) {
      var msg = EWD.application.messageObj;
      if (msg.message.operation === 'sessionData') {
        $('#sessionDataPanel').show();
        $('#sessionDataTitle').text('Session ' + msg.message.sessid);
      }
      var data;
      if (msg.type === 'getGlobals') {
        data = msg.message;
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

    'importer.html': function(messageObj) {
      $("#json").keyup(function(e) {
        while($(this).outerHeight() < this.scrollHeight + parseFloat($(this).css("borderTopWidth")) + parseFloat($(this).css("borderBottomWidth"))) {
          $(this).height($(this).height()+1);
        };
      });
      $('#importJSONBtn').on('click', function(e) {
        e.preventDefault(); // prevent default bootstrap behavior
        EWD.sockets.submitForm({
          fields: {
            globalName: $('#globalName').val(),
            json: $('#json').val()
          },
          id: 'jsonForm',
          messageType: 'EWD.form.importJSON'
        });
      });
    },

    'wsMgr.html': function(messageObj) {

      EWD.application.wsMgr = {
        extraApp: function(count) {
          var target = "#edit_appInputs";
          var id = "edit_appNameInput";
          var delId = "del_edit_appNameInput";
          $(target).append(EWD.application.wsMgr.newApphtml);
          $("#appNameInput_new").attr("placeholder", "Application Name " + (count + 1));
          $("#appNameInput_new").attr("id", id + count);
          $("#appNameDel_new").attr("id", delId + count);
          $("#" + delId + count).unbind();
          $("#" + delId + count).on('click', EWD.application.wsMgr.deleteApp);
        },

        deleteApp: function() {
          var outer = $(this).parent().parent();
          //console.log('deleteApp: outer.id = ' + outer.id);
          var Id = "edit_appNameInput";
          //console.log('no of apps: ' + EWD.application.wsMgr.appCount);
          if (EWD.application.wsMgr.appCount > 1) {
            $(this).parent().remove();
            EWD.application.wsMgr.appCount--;
            
            for (var i = 1; i < outer.children().length; i++) {
              outer.children()[i].children[0].id = Id + (i - 1);
              outer.children()[i].children[0].placeholder = "Application Name " + i;
              outer.children()[i].children[1].id = "del_" + Id + (i - 1);
            }
          }
          else {
            toastr.clear();
            toastr.error("You must assign at least 1 application");
          }
        },

        initialiseEdit: function(mode, accessId) {
          if (mode === 'edit' && !accessId) {
            toastr.clear();
            toastr.error('No user Selected!');
            return;
          }
          var outer = $("edit_appInputs");
          for (var i = 1; i < outer.children().length; i++) {
            //console.log("running for");
            //console.log(delID);
            outer.children()[i].children[0].id = ID + (i - 1);
            outer.children()[i].children[0].placeholder = "Application Name " + i;
          }   
          EWD.application.wsMgr.appCount = 0;
          $("#menu-0").removeClass("active");
          $("#manageUsersPanel").hide();
          $("#editUsersPanel").show();
          var userObj = {};
          if (mode === 'edit') {
            $('#wsMgrEdit-title').text('Edit Registered User');
            userObj = EWD.application.wsMgr.users[accessId];
            $("#edit_accessIdInput").val(accessId);
            $("#edit_accessIdInput").prop('readonly', true);
            $("#edit_secretKeyInput").val(EWD.application.wsMgr.users[accessId].secretKey);
            var count = 0;
            for (var i in userObj.apps) {
              if (count > 0) {
                EWD.application.wsMgr.extraApp(count);
              }
              $("#edit_appNameInput" + count).val(i);
              count++;
            }
            EWD.application.wsMgr.appCount = count;
          }
          else {
            $('#wsMgrEdit-title').text('Add New Registered User');
            $("#edit_accessIdInput").val('');
            $("#edit_accessIdInput").prop('readonly', false);
            $("#edit_secretKeyInput").val('');
            $("#wsMgr_extraApps").html('');
            $("#edit_appNameInput0").val('');
            EWD.application.wsMgr.appCount = 1;
          }
        },
        newApphtml: "<div class='input-group'>                                             \
                       <input type='text' class='form-control' id='appNameInput_new' />    \
                       <span class='input-group-btn' id='appNameDel_new'>                  \
                         <button class='btn btn-default'>                                  \
                           <span class='glyphicon glyphicon-remove'></span>                \
                         </button>                                                         \
                       </span>                                                             \
                     </div>",
        mode: '',

        clearExtraApps: function() {
          EWD.application.wsMgr.appCount = 1;
          var inputs = $("#appInputs").children().length;
          inputs = inputs -2;
          var editInputs = $("#edit_appInputs").children().length;
          editInputs = editInputs -2;
          for (var i = 0; i < inputs; i++) {
            $("#appInputs").children()[2].remove();
          }
          for (var j = 0; j < editInputs; j++) {
            $("#edit_appInputs").children()[2].remove();
          }
        },

        clearInputs: function() {
          $("#edit_accessIdInput").val("");
          $("#edit_secretKeyInput").val("");
          $("#edit_appNameInput0").val("");
        },
        listOver: function() {
          $(this).css({"background-color": "#9f9f9f", "cursor":"pointer"});
        },

        listOut: function() {
          if (!$(this).hasClass('clicked')) $(this).css({"background-color": ""});
        },

        listClick: function() {
          var id = $(this).attr("id");
          var idChars = id.length;
          var user = id.substring(5, idChars);
          EWD.application.wsMgr.selectedUser = user;
          if ($(this) !== EWD.application.wsMgr.selectedAccessId) {
            $(EWD.application.wsMgr.selectedAccessId).removeClass('clicked');
            $(EWD.application.wsMgr.selectedAccessId).css({"background-color": ""});
            EWD.application.wsMgr.selectedAccessId = $(this);
            $(this).addClass('clicked');
            $(this).css({"background-color": "#9f9f9f"});
          }
        },
        userInfo: function(eventObj) {
          var key = eventObj.data.key; 
          var apps = eventObj.data.apps;

          var buildKeyList = function() {
            var oldkeys = $("#secretKeyList").children().length;
            for (var i = 1; i < oldkeys; i++) {
              $("#secretKeyList").children()[1].remove();
            }
            var html = "<li class='list-group-item' id='newKey' data-keylist></li>";
            $("#secretKeyList").append(html);
            $("#newKey").text(key);
            $("#newKey").attr("id", "key_" + key);
          };

          var buildAppsList = function() {
            var oldapps = $("#appList").children().length;
            for (var i = 1; i < oldapps; i++) {
              $("#appList").children()[1].remove();
            }
            var html = "<li class='list-group-item' id='newApp' data-applist></li>"
            for (var i in apps) {
              $("#appList").append(html);
              $("#newApp").text(i);
              $("#newApp").attr("id", "app_" + i);
            }
          };

          $("[data-userlist]").each( function() {
            if ($(this).hasClass("active")) {
              $(this).removeClass("active");
            }
          });
          $(this).addClass("active");
          if ($("#secretKeyListHeader").is(":hidden")) {
            $("#secretKeyListHeader").show();
          }
          if ($("#appListHeader").is(":hidden")) {
            $("#appListHeader").show();
          }
          buildKeyList();
          buildAppsList();
        },

        clearList: function(listId) {
          var length = $(listId).children().length;
          if (length > 1) {
            for (var i = 1; i < length; i++) {
              $(listId).children()[1].remove();
            }
          }
        },
        deleteUser: function() {
          if (EWD.application.wsMgr.selectedUser) {
            EWD.sockets.sendMessage({
              type: 'wsMgr_deleteUser',
              params: {
                target: EWD.application.wsMgr.selectedUser
              }
            });
          }
          else {
            toastr.clear();
            toastr.error("You must click an AccessId first!");
          }
        }
      };

      EWD.sockets.sendMessage({
        type: "getWSUsers"
      });

      $("#mgrPasswordBtn").on('click', function() {
        EWD.sockets.sendMessage({
          type: "EWD.getFragment", 
          params:  {
            file: 'mgrPassword.html',
            targetId: 'InfoPanelText'
          }
        });
      });

      $("#wsMgr_back").on('click', function() {
        $("#manageUsersPanel").show();
        $("#editUsersPanel").hide();
      });

      $("#wsMgr_extraApp").on('click', function() {
        EWD.application.wsMgr.extraApp(EWD.application.wsMgr.appCount);
        EWD.application.wsMgr.appCount++;
      });

      $("#del_edit_appNameInput0").on('click', EWD.application.wsMgr.deleteApp);

      $("#wsMgr_AddBtn").on('click', function() {
        EWD.application.wsMgr.mode = 'add';
        EWD.application.wsMgr.initialiseEdit('add');
      });

      $("#wsMgr_DeleteBtn").on('click', function() {
        EWD.application.wsMgr.deleteUser();
      });

      $("#wsMgr_EditBtn").on('click', function() {
        EWD.application.wsMgr.mode = 'edit';
        EWD.application.wsMgr.initialiseEdit('edit', EWD.application.wsMgr.selectedUser);
      });

      $("#wsMgr_SaveBtn").on('click', function(eventObj) {
        var validate = function(id, key, app) {
          //console.log('validate: ' + id + '; ' + key + '; ' + app);
          if (id === "" || id === " ") { 
            return [false, "Access Id must not be empty"];
          }
          if (key === "" || key === " ") { 
            return [false, "Secret Key must not be empty"];
          }
          for (var i = 0; i < app.length; i++) {
            if (app[i] === "" || app[i] === " ") { 
              return [false, "You must specify at least one application"];
            }
          }
          return [true];
        };
        
        var doSave = function(id, key, appNames, mode) {
          var saveObj = {};
          var appNameObj = {};
          for (var i in appNames) {
            appNameObj[appNames[i]] = true;
          }
          saveObj[id] = {
            "secretKey": key,
            "apps": appNameObj
          };
          EWD.sockets.sendMessage({
            type: 'wsMgr_saveUser',
            params: {
              obj: saveObj,
              mode: mode
            }
          });
        };
        
        var idInputId = "#edit_accessIdInput";
        var keyInputId = "#edit_secretKeyInput";
        var appInputId = "#edit_appInputs";
        var count = EWD.application.wsMgr.appCount;
        //console.log(idInputId + " " + keyInputId + " " + appInputId);
        var id = $(idInputId).val();
        if (EWD.application.wsMgr.mode === 'add' && id && id !== '' && EWD.application.wsMgr.users[id]) {
          toastr.clear();
          toastr.error(id + ' is already registered');
          return;
        }

        var key = $(keyInputId).val();
        var appNames = [];
        var appName = "";
        for (var app = 1; app < (count+1); app++) {
          //console.log(app);
          appName = $(appInputId).children()[app].children[0].value;
          if (appName !== '') appNames.push(appName);
        }
        //console.log("appNames = " + JSON.stringify(appNames));
        var isValid = validate(id, key, appNames);
        if (isValid[0]) {
          doSave(id, key, appNames, EWD.application.wsMgr.mode);
          EWD.application.wsMgr.clearExtraApps();
          EWD.application.wsMgr.clearInputs();
        }
        else {
          toastr.error(isValid[1]);
        }
      });
    }

  },

  onMessage: {

    childProcessMemory: function(messageObj) {
      if (EWD.application.loggedIn) {
        //{"type":"childProcessMemory","results":{"rss":"37.43","heapTotal":"28.53","heapUsed":"3.55","pid":4848},"interval":30000} 
        if (EWD.memory['cpPid' + messageObj.results.pid]) {
          EWD.memory['cpPid' + messageObj.results.pid] = messageObj.results;
          if ($('#cpPid' + messageObj.results.pid + 'rss')) {
            $('#cpPid' + messageObj.results.pid + 'rss').text(messageObj.results.rss);
            $('#cpPid' + messageObj.results.pid + 'heapTotal').text(messageObj.results.heapTotal);
            $('#cpPid' + messageObj.results.pid + 'heapUsed').text(messageObj.results.heapUsed);
          }
          EWD.memory.plot['cpPid' + messageObj.results.pid].push(messageObj.results);
          if (EWD.memory.plot['cpPid' + messageObj.results.pid].length > 60) EWD.memory.plot['cpPid' + messageObj.results.pid].shift();
          if (EWD.currentGraph === ('cpPid' + messageObj.results.pid)) EWD.replotGraph(EWD.currentGraph);
        }
      }
    },

    consoleText: function(messageObj) {
      if (EWD.application.loggedIn) {
        var html = $('<div/>').text(messageObj.text).html();
        $('#consoleText').append(html);
        $("#consoleText").animate({ scrollTop: $('#consoleText')[0].scrollHeight}, 5);
        if ($("#consoleText").children().size() > (EWD.maxConsoleLength || 1000)) {
          $('#consoleText').find('div:first').remove();
        }
      }
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

    getGlobalSubscripts: function(messageObj) {
      if (EWD.application.loggedIn) {
        if (messageObj.message.rootLevel) {
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
          EWD.application.tree.callback({data: messageObj.message.subscripts});
          //EWD.application.tree.addDeleteButton();
        }
      }
    },

    getInterfaceVersion: function(messageObj) {
      if (EWD.application.loggedIn) {
        var pieces = messageObj.message.split(';');
        $('#buildVersion-iface').text(pieces[0]);
        $('#buildVersion-db').text(pieces[1]);
      }
    },

    getSessionData: function(messageObj) {
      if (EWD.application.loggedIn) {
        //console.log("**** session data: " + JSON.stringify(messageObj));
      }
    },

    sessionDeleted: function(messageObj) {
      if (EWD.application.loggedIn) {
        var sessid = messageObj.json.sessid;
        if ($('#session-table-row-' + sessid).length > 0) {
          toastr.warning('EWD Session ' + sessid + ' has been terminated');
          $('#session-table-row-' + sessid).remove();
        }
      }
    },

    newSession: function(messageObj) {
      if (EWD.application.loggedIn) {
        var session = messageObj.json;
        var html = '';
        html = html + '<tr class="table" id="session-table-row-' + session.sessid + '">';
        html = html + '<td>' + session.sessid + '</td>';
        html = html + '<td>' + session.appName + '</td>';
        html = html + '<td>' + session.expiry + '</td>';
        html = html + '<td><button class="btn btn-info pull-right sessionDetails" type="button" id="sessionDetailsBtn' + session.sessid + '" data-toggle="tooltip" data-placement="top" title="" data-original-title="Display Session Data"><span class="glyphicon glyphicon-open"></span></button></td>';
        html = html + '<td><button class="btn btn-danger pull-right sessionStop" type="button" id="sessionStopBtn' + session.sessid + '" data-toggle="tooltip" data-placement="top" title="" data-original-title="Stop Session"><span class="glyphicon glyphicon-remove"></span></button></td>';
        html = html + '</tr>';
        $('#session-table tbody').append(html);
        $('.sessionStop').on('click', function(e) {
          var id = e.target.id;
          if (!id) id = e.target.parentNode.id;
          var sessid = id.split('sessionStopBtn')[1];
          EWD.sockets.sendMessage({
            type: 'closeSession', 
            params: {
              sessid: sessid
            }
          });
          //$('#session-table-row-' + sessid).remove();
          //toastr.clear();
          //toastr.warning('EWD Session ' + sessid + ' has been stopped');
        });

        $('[data-toggle="tooltip"]').tooltip();

        $('.sessionDetails').on('click', function(e) {
          //console.log("getSessionDetails!");
          var id = e.target.id;
          if (!id) id = e.target.parentNode.id;
          var sessid = id.split('sessionDetailsBtn')[1];
          EWD.getGlobalSubscripts({
            rootLevel: true,
            sessid: sessid,
            operation: 'sessionData',
            globalName: '%zewdSession',
            subscripts: ['session', sessid]
          });
        });
        toastr.info('New Session ' + session.sessid + ' has started');
        EWD.sockets.sendMessage({
          type: 'keepAlive'
        });
      }
    },

    getSessions: function(messageObj) {
      if (EWD.application.loggedIn) {
        var html = '';
        var session;
        for (var i = 0; i < messageObj.message.length; i++) {
          session = messageObj.message[i];
          html = html + '<tr class="table" id="session-table-row-' + session.sessid + '">';
          html = html + '<td>' + session.sessid + '</td>';
          html = html + '<td>' + session.appName + '</td>';
          html = html + '<td>' + session.expiry + '</td>';
          html = html + '<td><button class="btn btn-info pull-right sessionDetails" type="button" id="sessionDetailsBtn' + session.sessid + '" data-toggle="tooltip" data-placement="top" title="" data-original-title="Display Session Data"><span class="glyphicon glyphicon-open"></span></button></td>';
          if (!session.currentSession) {
            html = html + '<td><button class="btn btn-danger pull-right sessionStop" type="button" id="sessionStopBtn' + session.sessid + '" data-toggle="tooltip" data-placement="top" title="" data-original-title="Stop Session"><span class="glyphicon glyphicon-remove"></span></button></td>';
          }
          html = html + '</tr>';
        }
        $('#session-table tbody').html(html);
        $('.sessionStop').on('click', function(e) {
          var id = e.target.id;
          if (!id) id = e.target.parentNode.id;
          var sessid = id.split('sessionStopBtn')[1];
          EWD.sockets.sendMessage({
            type: 'closeSession', 
            params: {
              sessid: sessid
            }
          });
          //$('#session-table-row-' + sessid).remove();
          //toastr.clear();
          //toastr.warning('EWD Session ' + sessid + ' has been stopped');
        });
 
        $('[data-toggle="tooltip"]').tooltip();

        $('.sessionDetails').on('click', function(e) {
          //console.log("getSessionDetails!");
          var id = e.target.id;
          if (!id) id = e.target.parentNode.id;
          var sessid = id.split('sessionDetailsBtn')[1];
          EWD.getGlobalSubscripts({
            rootLevel: true,
            sessid: sessid,
            operation: 'sessionData',
            globalName: '%zewdSession',
            subscripts: ['session', sessid]
          });
        });
      }
    },

    importJSON: function(messageObj) {
      if (EWD.application.loggedIn) {
        if (messageObj.ok) {
          //toastr.clear();
          toastr.success('JSON successfully saved in ' + messageObj.globalName);
        }
      }
    },

    loggedIn: function(messageObj) {
      toastr.options.target = 'body';
      $('#overview_Container').show();
      EWD.password = $('#username').val();
      EWD.sockets.sendMessage({type: "EWD.startConsole", message:  "start", password: EWD.password});
      EWD.sockets.sendMessage({type: "getInterfaceVersion"});
      EWD.application.loggedIn = true;
    },

    memory: function(messageObj) {
      $('#uptime').text(messageObj.uptime);
      if (EWD.application.loggedIn) {
        EWD.memory.master = messageObj;
        if ($('#master-rss')) {
          $('#master-rss').text(messageObj.rss);
          $('#master-heapTotal').text(messageObj.heapTotal);
          $('#master-heapUsed').text(messageObj.heapUsed);
        }
        EWD.memory.plot.master.push({
          rss: messageObj.rss,
          heapTotal: messageObj.heapTotal,
          heapUsed: messageObj.heapUsed
        });
        if (EWD.memory.plot.master.length > 60) EWD.memory.plot.master.shift();
        if (EWD.currentGraph) EWD.replotGraph(EWD.currentGraph);
      }
    },

    pidUpdate: function(messageObj) {
      if (EWD.application.loggedIn) {
        var pid = messageObj.pid;
        $('#cpRequests' + pid).text(messageObj.noOfRequests);
        $('#cpAvailable' + pid).text(messageObj.available);
      }
    },

    processInfo: function(messageObj) {
      if (EWD.application.loggedIn) {
        var data = messageObj.data;
        EWD.application.traceLevel = data.traceLevel;
        EWD.application.logTo = data.logTo;
        EWD.application.logFile = data.logFile;
        EWD.application.interval = data.interval;
        $('#buildVersion-Node').text(data.nodeVersion);
        $('#buildVersion-ewdgateway2').text(data.build);
        $('#startedDate').text(data.started);
        $('#uptime').text(data.uptime);
        $('#mainProcess-pid').text(data.masterProcess);
        var childProcesses = messageObj.data.childProcesses;
        var html = '';
        var childProcess;
        var pid;
        for (var i = 0; i < childProcesses.length; i++) {
          childProcess = childProcesses[i];
          pid = childProcess.pid;
          html = html + '<tr class="table" id="cpRow' + pid + '">';
          html = html + '<td class="cpPid" id="cpPid' + pid + '">' + pid + '</td>';
          html = html + '<td id="cpRequests' + pid + '">' + childProcess.noOfRequests + '</td>';
          html = html + '<td id="cpAvailable' + pid + '">' + childProcess.available + '</td>';
          html = html + '<td>';
          if (childProcess.debug.enabled) {
            html = html + '<button class="btn btn-info pull-left cpNodeInspector" type="button" id="cpNodeInspectorBtn' + childProcess.debug.port + '_' + childProcess.debug.web_port + '" data-toggle="tooltip" data-placement="top" title="" data-original-title="Start Debugging (web_port=' + childProcess.debug.web_port + ')"><span class="glyphicon glyphicon-wrench"></span></button>';
          }     
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
      }
    },

    queueInfo: function(messageObj) {
      if (EWD.application.loggedIn) {
        $('#masterProcess-qLength').text(messageObj.qLength);
        if (messageObj.qLength > EWD.qMax) {
          EWD.qMax = messageObj.qLength;
          $('#masterProcess-max').text(messageObj.qLength);
        }
      }
    },

    workerProcess: function(messageObj) {
      if (EWD.application.loggedIn) {
        if (messageObj.action === 'add') {
          var html = EWD.addChildProcessToTable(messageObj.pid, messageObj.debug);
          $('#childProcessTable tbody').append(html);
          EWD.enablePopovers();
          $('[data-toggle="tooltip"]').tooltip();
        }
      }
    },

    'EWD.inspect': function(messageObj) {
      $('#internals_socketClient').text(JSON.stringify(messageObj.socketClient, null, 2));
      $('#internals_socketClientByToken').text(JSON.stringify(messageObj.socketClientByToken, null, 2));
      $('#internals_process').text(JSON.stringify(messageObj.process, null, 2));
      $('#internals_requestsByProcess').text(JSON.stringify(messageObj.requestsByProcess, null, 2));
      $('#internals_queueByPid').text(JSON.stringify(messageObj.queueByPid, null, 2));
      $('#internals_poolSize').text(messageObj.poolSize);
      $('#internals_params').text(JSON.stringify(messageObj.startParams, null, 2));
    },

    'EWD.resetPassword': function(messageObj) {
      if (!messageObj.error) {
        EWD.password = messageObj.password
      }
      else {
        toastr.error(messageObj.message);
      }
      $('#InfoPanel').modal('hide');
    },

    'EWD.getDebugPorts': function(messageObj) {
      $('#debug_child_port').val(messageObj.child_port);
      $('#debug_web_port').val(messageObj.web_port);
    },

    'EWD.changeDebugPorts': function(messageObj) {
      $('#InfoPanel').modal('hide');
      $('#internals_Nav').click()
    },

    'EWD.childProcessStopped': function(messageObj) {
      var pid = messageObj.pid;
      if (pid) {
        $('#cpRow' + pid).remove();
        delete EWD.memory.plot['cpPid' + pid];
        delete EWD.memory['cpPid' + pid];
      }
    },

    keepAlive: function(messageObj) {
      EWD.keepAlive();
    },
   
    getWSUsers: function(messageObj) {
      var html = "<li class='list-group-item' id='newuser' data-userlist></li>"
      var key;
      var apps = [];
      var user;
      EWD.application.wsMgr.clearList("#accessIdList");
      EWD.application.wsMgr.clearList("#secretKeyList");
      EWD.application.wsMgr.clearList("#appList");
      EWD.application.wsMgr.users = messageObj.message;
      for (var id in messageObj.message) {
        user = messageObj.message[id];
        $("#accessIdList").append(html);
        $("#newuser").text(id);
        $("#newuser").attr("id", "user_" + id);
        $("#user_" + id).on('click', { 
            id: id, 
            key: user.secretKey, 
            apps: user.apps 
          }, EWD.application.wsMgr.userInfo);
        $("#user_" + id).on('mouseover', EWD.application.wsMgr.listOver);
        $("#user_" + id).on('mouseout', EWD.application.wsMgr.listOut);
        $("#user_" + id).on('click', EWD.application.wsMgr.listClick);
      }
    },
    wsMgr_saveUser: function(messageObj) {
      if (messageObj.message.ok) {
        var msg;
        if (messageObj.message.mode === 'add') {
          msg = 'New user record saved'
        }
        else {
          msg = 'User record edited'
        }
        toastr.clear();
        toastr.success(msg);
        $("#manageUsersPanel").show();
        $("#editUsersPanel").hide();
        EWD.sockets.sendMessage({
          type: "getWSUsers"
        });
      }
    },

    wsMgr_deleteUser: function(messageObj) {
      toastr.clear();
      toastr.success('Access Id ' + messageObj.message.accessId + ' de-registered');
      EWD.sockets.sendMessage({
        type: "getWSUsers"
      });
      delete EWD.application.wsMgr.selectedUser;
    }
  }

};





