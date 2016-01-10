/*

 ----------------------------------------------------------------------------
 | EWD.js: Browser-side main logic for EWD.js Applications                  |
 |                                                                          |
 | Copyright (c) 2013-16 M/Gateway Developments Ltd,                        |
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

*/

var EWD = {
  version: {
    build: 29,
    date: '08 January 2016'
  },
  trace: false,
  initialised: false,
  messageTransport: 'websockets',
  show: function(id) {
    if (document.getElementById(id) !== null) {
      document.getElementById(id).style.display = '';
    }
  },
  hide: function(id) {
    if (document.getElementById(id) !== null) {
      document.getElementById(id).style.display = 'none';
    }
  },
  insertAfter: function(html, targetId) {
    var tag = document.createElement('div');
    tag.innerHTML = html;
  },
  getFragment: function(file, targetId, onFragment, isServiceFragment) {
    var messageObj = {
      type: "EWD.getFragment", 
      params:  {
        file: file,
        targetId: targetId
      }
    };
    if (typeof isServiceFragment === 'boolean' && isServiceFragment) {
      messageObj.params.isServiceFragment = true
    };
    if (onFragment) messageObj.done = onFragment; 
    EWD.sockets.sendMessage(messageObj); 
  },
  getFragmentResponseHandler: function(obj) {
        if (obj.message.error) {
          console.log('ERROR: target fragment ' + obj.message.file + ' could not be loaded');
          console.log(JSON.stringify(obj));
          if (obj.message.isServiceFragment) {
            EWD.application.onFragment[obj.message.file](obj,true);
          }
        }
        if (obj.message.targetId) {
          // check jQuery is loaded, targetId is valid jQuery selector and selector matches 1+ elements 
          if (window.jQuery && $(obj.message.targetId) instanceof jQuery && $(obj.message.targetId).length > 0) { // handle a jquery object
            // inject fragment to each matched element
            $(obj.message.targetId).each(function(ix,element) {
              $(element).html(obj.message.content);
            });
            // invoke onFragment handler
            if (EWD.application.onFragment) {
              if (EWD.application.onFragment[obj.message.file]) EWD.application.onFragment[obj.message.file](obj);
            }
          }
          // otherwise use jQuery-less fragment target handling
          else if (document.getElementById(obj.message.targetId)) { // handle as string id
            document.getElementById(obj.message.targetId).innerHTML = obj.message.content;
            if (EWD.application.onFragment) {
              if (EWD.application.onFragment[obj.message.file]) EWD.application.onFragment[obj.message.file](obj);
            }
          } 
        } 
        return;
  },
  /**
   * Generates a GUID string.
   * @returns {String} The generated GUID.
   * @example af8a8416-6e18-a307-bd9c-f2c947bbb3aa
   * @author Slavik Meltser (slavik@meltser.info).
   * @link http://slavik.meltser.info/?p=142
  */
  guid: function() {
    function _p8(s) {
      var p = (Math.random().toString(16)+"000000000").substr(2,8);
      return s ? "-" + p.substr(0,4) + "-" + p.substr(4,4) : p ;
    }
    return _p8() + _p8(true) + _p8(true) + _p8();
  },
  ajax: function(params) {
    if (typeof $ !== 'undefined') {
      $.ajax({
        url: '/ajax',
        type: 'post',
        data: JSON.stringify(params),
        dataType: 'json',
        timeout: 10000
      })
      .done(function (data ) {
        EWD.ajaxResponseHandler(data);
      });
    }
  },
  ajaxResponseHandler: function(data) {
    if (data.type === 'EWD.registered') {
      EWD.onRegistered(data);
      return;
    }
    if (EWD.sockets.log) console.log("onMessage: " + JSON.stringify(data));
    if (data.type === 'EWD.getFragment') {
      EWD.getFragmentResponseHandler(data);
      return;
    }
    // invoke the message handler function for returned type
    if (EWD.application && EWD.application.onMessage && EWD.application.onMessage[data.type]) {
      EWD.application.onMessage[data.type](data);
    }
  },
  onReRegistered: function(obj, socket) {
    console.log('Application was successfully re-registered');
    if (typeof toastr !== 'undefined') {
      toastr.warning('Application re-registered successfully');
    }
  },
  onRegistered: function(obj, socket) {
    //console.log('onRegistered: obj = ' + JSON.stringify(obj));
    //console.log('**** application = ' + EWD.application.name);
    if (EWD.application.name !== 'ewdMonitor' && obj.messageTransport) EWD.messageTransport = obj.messageTransport;
    //changed
    // handle service path
    // if require
    // user require config obj.servicepath
    // SJT Addition for setting up require.js service path 

    if (!EWD.client && typeof require === 'function') {
      // add tailing / to path if necessary
      if (obj.servicePath.slice(-1) !== '/') obj.servicePath += '/';
      require.config({
        baseUrl:obj.servicePath
      });
      // expose method to retrieve servicePath
      EWD.application.getServicePath = function() {
        return obj.servicePath;
      };
    }

    EWD.sockets.sendMessage = (function() {
      var applicationName = EWD.application.name;
      delete EWD.application.name;
      var io;
      if (typeof socket !== 'undefined') io = socket;
      var token = obj.token;
      var ajax = false;
      if (EWD.messageTransport === 'ajax') ajax = true;
      var augment = function(params) {
        params.token = token;
        if (ajax) {
          params.ajax = true;
          if (params.type === 'EWD.getFragment') {
            params.application = applicationName;
            delete params.token;
          }
        }
        return params;
      };
      return function(params) {
        if (typeof params.type === 'undefined') {
          if (EWD.sockets.log) console.log('Message not sent: type not defined');
        }
        else {
          params = augment(params);
          if (typeof console !== 'undefined') {
            if (EWD.sockets.log) console.log("sendMessage: " + JSON.stringify(params));
          }
          if (params.done) {
            if (params.type === 'EWD.getFragment') {
              if (!EWD.application.onFragment) EWD.application.onFragment = {};
              EWD.application.onFragment[params.params.file] = params.done; 
            }
            else {
              if (!EWD.application.onMessage) EWD.application.onMessage = {};
              EWD.application.onMessage[params.type] = params.done;
            }
            delete params.done;
          }
          if (params.ajax) {
            delete params.ajax;
            if (EWD.ajax) {
              EWD.ajax(params);
              return;
            }
          }
          else {
            if (io && io.connected) {
              io.json.send(JSON.stringify(params)); 
            }
            else {
              if (EWD.sockets.log) console.log('Socket is disconnected and unavilable for use');
              if (EWD.application.onMessage.error) {
                EWD.application.onMessage.error({
                  type: 'error',
                  messageType: params.type,
                  error: 'Socket disconnected'
                });
              }
            }
          }
        }
      };
    })();
    obj = null;
    socket = null;
    EWD.initialised = true;
    if (EWD.onSocketsReady) EWD.onSocketsReady();
  },
  require: function(options) {
    if (typeof require !== 'function') {
      console.log('ERROR: unable to invoke EWD.require as the dependency require.js has not been loaded');
      return;
    }
    // set require config if defined
    if (typeof options.requireConfig === 'object') {
      require.config(options.requireConfig);
    }
    // check if custom namespace is defined
    if (typeof options.nameSpace === 'undefined') {
      options.nameSpace = options.serviceName;
    }
    //console.log('namespace set to: ' + options.nameSpace)

    require([options.serviceName], function(module) {
      function invokeOnServiceReady(options) {
        if (typeof EWD.application.onServiceReady === 'object' &&  typeof options.done === 'undefined') {
          if (typeof EWD.application.onServiceReady[options.serviceName] === 'function') {
            EWD.application.onServiceReady[options.serviceName](module);
          }
        }
        else if (typeof options.done === 'function'){
          options.done(module);
        }
      };

      function invokeServiceInit(options, module) {
        if (typeof module.init === 'function') {
          //console.log('invoking init with namespace: ' + options.nameSpace);
          module.init(options.nameSpace);
        }
      }

      var method;
      // extend onMessage
      if (typeof module.onMessage === 'object') {
        for (method in module.onMessage) {
          if (typeof EWD.application.onMessage === 'undefined') {
            EWD.application.onMessage = {};
          }
          EWD.application.onMessage[options.nameSpace+'-'+method] = module.onMessage[method];
        }
      }
      // extend onFragment
      if (typeof module.onFragment === 'object') {
        for (method in module.onFragment) {
          if (typeof EWD.application.onFragment === 'undefined') {
            EWD.application.onFragment = {};
          }
          EWD.application.onFragment[method] = module.onFragment[method];
        }
      }
      // set correct fragmentName
      var fragmentName = false;
      var useServiceDirectory = true;
      if (typeof options.fragmentName !== 'boolean' && options.fragmentName !== false) {
        if (typeof options.fragmentName === 'string' && options.fragmentName.length > 0) {
          fragmentName = options.fragmentName;
          useServiceDirectory = false;
        }
        else if (typeof module.fragmentName === 'string' && module.fragmentName.length > 0) {
          fragmentName = module.fragmentName;
        }
        else if (typeof module.fragmentName === 'boolean' && module.fragmentName === false) {
          fragmentName = false;
        }
        else {
          console.log('default fragment')
          fragmentName = options.serviceName + '.html';
        }
      }

      // fetch fragment if fragmentName is supplied
      if (fragmentName) {
        // clone onFragment to overwrite & extend it with
        if (typeof EWD.application.onFragment[fragmentName] === 'function') {
          var _onFragment = EWD.application.onFragment[fragmentName];
        }
        EWD.getFragment(fragmentName, options.targetSelector, function(messageObj, fragmentError) {
          if (fragmentError) { // revert this handler back if fetching the fragment failed
            EWD.application.onFragment[fragmentName] = _onFragment;
          }
          else {
            if (typeof _onFragment === 'function'){
              _onFragment(messageObj);
            }
            invokeServiceInit(options, module);
            invokeOnServiceReady(options);
            // restore original onFragment handler 
            // prevents EWD.application.onFragment[fragmentName] from being continually extended by this
            if (typeof _onFragment === 'function') {
              EWD.application.onFragment[fragmentName] = _onFragment;
            }
          }
        },useServiceDirectory);
      }
      // no fragment to fetch, just run the init and service callbacks
      else {
        invokeServiceInit(options,module);
        invokeOnServiceReady(options);
      }
      // reset baseUrl for services if they were overridden
      if (typeof options.requireConfig === 'object') {
        require.config({
          baseUrl: EWD.application.getServicePath()
        });
      }
    });
  },
  json2XML: function(document, tagName, xml) {
    if (!xml) xml = '';
    var intRegex = /^\d+$/;
    var numericTagName = intRegex.test(+tagName);
    //console.log('tagName: ' + tagName);
    if (tagName && !numericTagName) xml = xml + '<' + tagName;
    var hasAttributes = false;
    var hasChildren = false;
    var property;
    var value;
    var text = '';

    for (property in document) {
      if (property.substring(0,1) === '#') {
        hasAttributes = true;
      }
      else if (property === '.text') {
        text = document[property];
      }
      //else if (!intRegex.test(property)) {
      else {
        hasChildren = true;
      }
    }

    if (hasAttributes) {
      for (property in document) {
        if (property.substring(0,1) === '#') {
          xml = xml + ' ' + property.substring(1) + '="' + document[property] + '"';
        }
      }
    }
    if (tagName && !numericTagName && hasChildren) xml = xml + '>';

    if (hasChildren) {
      for (property in document) {
        if (property.substring(0,1) !== '#') {
          if (typeof document[property] === 'object') {
            xml = this.json2XML(document[property], property, xml);
          }
          else {
            value = document[property];
            if (value !== '') {
              xml = xml + '<' + property + '>' + value + '</' + property + '>';
            }
            else {
              xml = xml + '<' + property + ' />';
            } 
          }
        }
      }
      if (tagName && !numericTagName) xml = xml + '</' + tagName + '>';
      return xml;
    }

    if (text !== '' && tagName) {
      xml = xml + '>' + text + '</' + tagName + '>';
      return xml;
    }

    xml = xml + ' />';
    return xml;

  },
  sockets: {
    log: false,
    handlerFunction: {},

    // Simon Tweed's pub/sub additions
    // object store for socket message events - used by on/off/emit:
    events:{},

    /** 
     * Binds a callback to a socket message type
     * @param {string} messageType - Socket message type name to bind callback to
     * @param {function} callback  - Callback to bind to message type
     */
    on: function(messageType, callback) {
      if (!this.events[messageType]) this.events[messageType] = [];
      this.events[messageType].push(callback);
    },

    /**
     * Unbinds callback(s) from a socket message type
     *
     * USAGE:
     * EWD.sockets.off(messageType) 
     * removes all event callbacks for a socket message type
     *
     * EWD.sockets.off(messageType, callback) 
     * removes a specific event callback for a socket message type
     *
     * @param {string} messageType - socket message type name
     * @param {function} [callback] - Specific callback to remove from a message type
     */
    off: function(messageType, callback) {
      if (typeof callback === 'function') {
        if (!this.events[messageType]) {
          return
        }
        else if (this.events[messageType]) {
          for (var i = 0; i < this.events[messageType].length; i++) {
            if (this.events[messageType][i] === callback) {
              this.events[messageType].splice(i,1);
            }
          }
        }
      }
      else {
        this.events[messageType] = [];
      }
    },

    /**
     * Invokes all callbacks associated with a socket message type. <br>
     * Invoked automatically when a socket message is recieved from the server <br>
     *
     * @param {string} messageType - message type to invoke callbacks for
     * @param {object} data - data object passed to callback(s)
     */
    emit: function(messageType, data) {
      if (!this.events[messageType] || this.events[messageType].length < 1) return;
      data = data || {};
      for (var i = 0; i < this.events[messageType].length; i++) {
        this.events[messageType][i](data);
      }
    },
    // End of Simon Tweed's additions

    keepAlive: function(mins) {
      EWD.sockets.timeout = mins;
      setTimeout(function() {
        EWD.sockets.sendMessage({type: "keepAlive", message:  "1"});
        EWD.sockets.keepAlive(EWD.sockets.timeout);
      },EWD.sockets.timeout*60000);
    },

    submitForm: function(params) {
      var framework = EWD.application.framework || 'extjs';
      var payload = params.fields;
      if (framework === 'extjs') {
        payload = Ext.getCmp(params.id).getValues();
      }
      if (framework === 'bootstrap') {
          if (params.popover) {
            EWD.application.popover = params.popover;
            if (!EWD.application.popovers) EWD.application.popovers = {};
            if (!EWD.application.popovers[params.popover.buttonId]) {
              $('#' + params.popover.buttonId).popover({
                title: params.alertTitle || 'Error',
                content: 'Testing',
                placement: 'top',
                container: '#' + params.popover.container,
                trigger: 'manual'
              });
              $('#' + params.popover.buttonId).on('shown.bs.popover', function() {
                var time = params.popover.time || 4000;
                setTimeout(function() {
                  $('#' + params.popover.buttonId).popover('hide');
                },time);
              });
              EWD.application.popovers[params.popover.buttonId] = true;
            }
          }
          if (params.toastr) {
            if (params.toastr.target) {
              toastr.options.target = '#' + params.toastr.target;
            }
            else {
              toastr.options.target = 'body';
            }
          }
      }
      if (params.alertTitle) payload.alertTitle = params.alertTitle;
      //payload.js_framework = framework;
      var msgObj = {
        type: params.messageType, 
        params: payload
      };
      if (params.done) msgObj.done = params.done;
      EWD.sockets.sendMessage(msgObj);
    }
  },
  utils: {
    addOptions: function(options, selectTagId) {
      // EWD.utils.addOptions([{value: 'John', text: 'John Smith'}], 'doctor');
      if (options instanceof Array) {
        var selectTag = document.getElementById(selectTagId);
        for (var i = 0; i < options.length; i++) {
          EWD.utils.addOption(selectTag, options[i].value, options[i].text);
        }
      }
    },
    addOption: function(selectTag, value, text) {
      var optionTag = document.createElement('option');
      optionTag.setAttribute('value', value);
      optionTag.text = text;
      try {
        // for IE earlier than version 8
        selectTag.add(optionTag, selectTag.options[null]);
      }
      catch (err) {
        selectTag.add(optionTag,null);
      }
    }
  },
  start: function(iox, url) {
    if (!iox && typeof io !== 'undefined') iox = io;
    if (EWD.application && EWD.application.chromecast) {
      EWD.application.parentOrigin = 'https://ec2.mgateway.com:8080';
      window.addEventListener('message', function(e) {
        var message = e.data;
        //if (EWD.sockets.log) console.log("*** message received from Receiver parent: " + JSON.stringify(message) + ': origin = ' + e.origin);
        if (e.origin === EWD.application.parentOrigin) {
          var type = message.message.type;
          if (typeof EWD.chromecast.onMessage !== 'undefined' && EWD.chromecast.onMessage[type]) {
            EWD.chromecast.onMessage[type](message);
          }
        }
      });
      EWD.chromecast.sendMessage = function(message) {
        window.parent.postMessage(message, EWD.application.parentOrigin);
      }
    }
    var socket;
    if (typeof iox === 'undefined') {
      // EWD.js running over Ajax only!

      EWD.messageTransport = 'ajax';
      var params = {
        type: 'EWD.register',
        //clientId: EWD.guid(),
        application: EWD.application,
      };
      EWD.ajax(params);

    }
    else {
      if (url) {
        socket = iox(url);
      }
      else {
        socket = iox.connect();
      }
      socket.on('disconnect', function() {
        if (EWD.sockets.log) console.log('socket.io disconnected');
        if (EWD.application.onMessage && EWD.application.onMessage.error) {
          EWD.application.onMessage.error({
            type: 'error',
            messageType: 'EWD.socket.disconnected',
            error: 'Socket disconnected'
          });
        }
      });

      socket.on('message', function(obj){
        if (EWD.sockets.log) {
          if (obj.type !== 'EWD.registered' && obj.type !== 'consoleText') {
            console.log("onMessage: " + JSON.stringify(obj));
          }
          else if(obj.type !== 'EWD.registered') {
            console.log('Registered successfully');
          }
        }
        if (EWD.application) {
          if (socket && obj.type === 'EWD.connected') {
            if (!EWD.application.name) {
              // connection made to previously registered application
              //  EWD.js may have been restarted and session may still be
              //  active, so try a re-register
              if (EWD.sockets.sendMessage) {
                EWD.sockets.sendMessage({
                  type: 'EWD.reregister'
                });
              }
              else {
                // Browser can't be re-registered
                return;
              }
            }
            else {
              var json = {
                type: 'EWD.register', 
                application: EWD.application
              };
              socket.json.send(JSON.stringify(json));
              return;
            }
          }
        }
        else {
          console.log('Unable to register application: EWD.application has not been defined');
          return;
        }
        if (obj.type === 'EWD.registered') {
          EWD.onRegistered(obj, socket);
          return;
        }
        if (obj.type === 'EWD.reregistered') {
          EWD.onReRegistered(obj, socket);
          return;
        }

        // Simon Tweed's pub-sub enhancement:
  
        EWD.sockets.emit(obj.type, obj);
 
        // End of Simon's enhancement

        if (obj.message) {
          var payloadType = obj.message.payloadType;
          if (payloadType === 'innerHTMLReplace') {
            var replacements = obj.message.replacements;
            var replacement;
            var prefix;
            for (var i = 0; i < replacements.length; i++) {
              replacement = replacements[i];
              prefix = replacement.prefix || '';
              for (var idName in replacement.ids) {
                document.getElementById(prefix + idName).innerHTML = replacement.ids[idName];
              }
            }
          }
          if (payloadType === 'bootstrap') {
            var action = obj.message.action;
            if (action === 'replaceTables') {
              var tables = obj.message.tables;
              var tableNo;
              var table;
              var i;
              var html;
              var tableTag;
              var columns;
              var colNo;
              var row;
              for (tableNo = 0; tableNo < tables.length; tableNo++) {
                table = tables[tableNo];
                tableTag = document.getElementById(table.id);
                html = '<thead><tr>';
                columns = EWD.bootstrap.table[table.id].columns;
                for (i = 0; i < columns.length; i++) {
                  if (columns[i].heading !== '') html = html + '<th>' + columns[i].heading + '</th>'; 
                }
                html = html + '</tr></thead>';
                html = html + '<tbody>';
                for (i = 0; i < table.content.length; i++) {
                  row = table.content[i];
                  html = html + '<tr>';
                  for (colNo = 0; colNo < columns.length; colNo++) {
                    html = html + '<td>' + row[columns[colNo].id] + '</td>';
                  }
                  html = html + '</tr>';
                }
                html = html + '</tbody>';
                tableTag.innerHTML = html;
              } 
              if (typeof EWD.application.onReplacedTables === "function") { // invoke onReplaceTables() after tables are built
                EWD.application.onReplacedTables();
              }
            }
          }
        }
        if (obj.type.indexOf('EWD.form.') !== -1) {
          if (obj.error) {
            var alertTitle = 'Form Error';
            if (obj.alertTitle) alertTitle = obj.alertTitle;
            if (EWD.application.framework === 'extjs') {
              Ext.Msg.alert(alertTitle, obj.error);
            }
            else if (EWD.application.framework === 'bootstrap') {
              if (typeof toastr !== 'undefined') {
                toastr.clear();
                toastr.error(obj.error);
              }
              else {
                if (EWD.sockets.log) console.log("error = " + obj.error);
                $('#' + EWD.application.popover.buttonId).popover('show');
                $('#' + EWD.application.popover.container).find('div.popover-content').html(obj.error);
              }
            }
            else {
              alert(obj.error);
            }
            return;
          }
          else {
            if (EWD.application.framework === 'bootstrap') {
              $('#loginBtn').popover('hide');
            }
          }
        }
        if (obj.type.indexOf('EWD.error') !== -1) {
          if (obj.error) {
            if (EWD.trace) console.log(obj.error);
          }
          return;
        }
        // SJT New additions for jQuery selector support for fragment target
        if (obj.type === 'EWD.getFragment') {
          EWD.getFragmentResponseHandler(obj);
          return;
        }
        if (obj.type.indexOf('EWD.inject') !== -1) {
          if (obj.js) {
            if (EWD.trace) console.log(obj.js);
            try {
              eval(obj.js);
              if (obj.fn) eval(obj.fn);
            }
            catch(error) {
              if (EWD.trace) {
                console.log('EWD.inject failed:');
                console.log(error);
              }
            }
          }
          return;
        }
        if (typeof EWD.token !== 'undefined' && typeof EWD.sockets.handlerFunction[obj.type] !== 'undefined') {
          EWD.sockets.handlerFunction[obj.type](obj);
          obj = null;
          return;
        }
        if (EWD.application && EWD.application.onMessage && EWD.application.onMessage[obj.type]) {
          EWD.application.onMessage[obj.type](obj);
          obj = null;
          return;
        }
        if (EWD.onSocketMessage) {
          EWD.onSocketMessage(obj);
          obj = null;
          return;
        }
      });
      if (typeof io !== 'undefined') io = null;
      if (iox) iox = null;
    }
  }
};


if (typeof $ !== 'undefined') {
  $(document).ready( function() {
    if (!EWD.customStart) EWD.start();
  });
}

//EWD.client = true;
//module.exports = EWD;