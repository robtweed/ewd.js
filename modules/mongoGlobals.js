var fs = require('fs');
var mongoDB;
var db = 'db.globals';
var dbIndex = 'db.globalIndex';

/* 
=================================================
 EWD.js MongoDB emulation of Mumps Global Storage
 
 Build 1
 2 December 2013
=================================================
*/

var global = {

  log: function(message, clearLog) {
    var logpath = 'mongoLog.txt';
    var s = new Date().getTime() + ': ' + process.pid + ': ' + message.toString().replace(/\r\n|\r/g, '\n'); // hack
    var flag = 'a+';
    if (clearLog) flag = 'w+';
    var fd = fs.openSync(logpath, flag, 0666);
    fs.writeSync(fd, s + '\r\n');
    fs.closeSync(fd);
  },

  createRoot: function(globalName) {
    if (global.exists(globalName)) return false;
    var result = mongoDB.insert(db, {
      globalName: globalName, 
      parent: "", 
      children: [], 
      subscripts: [], 
    });
    var rootId = result._id;
    mongoDB.insert(dbIndex, {
      globalName: globalName
    });
    return rootId;
  },

  delete: function(globalName) {
    mongoDB.remove(db, {
      globalName: globalName
    });
    mongoDB.remove(dbIndex, {
      globalName: globalName
    });
  },

  stringifySubscripts: function(subscripts) {
    for (var i = 0; i < subscripts.length; i++) {
      subscripts[i] = subscripts[i].toString();
    }
    return subscripts;
  },

  getUuid: function(globalName, subscripts) {
    var uuid = '';
    if (globalName && globalName !== '') {
      if (subscripts) {
        subscripts = global.stringifySubscripts(subscripts);
        var results = mongoDB.retrieve(db, {
          globalName: globalName,
          subscripts: subscripts
        });
        if (results.data && results.data.length > 0) {
          uuid = results.data[0]._id;
        }
      }
    }
    return uuid;
  },

  deleteNode: function(globalName, subscripts) {  
    var deleteParentRef = function(parentId, uuid) {
      var results = mongoDB.retrieve(db, {
        _id: parentId
      });
      if (results.data && results.data.length > 0) {
        var parentNode = results.data[0];
        var children = parentNode.children;
        if (children.length > 0) {
          for (var i = 0; i < children.length; i++) {
            if (children[i]._id === uuid) {
              children.splice(i, 1);
              if (children.length === 0) {
                // now orphaned so delete and remove its ref from parent
                var nextParentId = parentNode.parent;
                if (nextParentId !== '') {
                  deleteParentRef(nextParentId, parentId);
                }
                else {
                  mongoDB.remove(dbIndex, {globalName: parentNode.global});
                }
                mongoDB.remove(db, {_id: parentId});
              }
              else {
                // update the node with the new reduced children array
                delete parentNode._id;
                mongoDB.update(db, {_id: parentId}, parentNode);
              }
              break;
            }
          }
        }
      }
    };
  
    var deleteByUuid = function(uuid) {
      var results = mongoDB.retrieve(db, {
        _id: uuid
      });
      if (results.data && results.data.length > 0) {
        var gloNode = results.data[0];
        var children = gloNode.children;
        var child;
        var childUuid;
        if (children.length > 0) {
          for (var i = 0; i < children.length; i++) {
            childUuid = children[i]._id;
            deleteByUuid(childUuid);
          }
        }
        var parentId = gloNode.parent;
        deleteParentRef(parentId, uuid);
        mongoDB.remove(db, {
          _id: uuid
        });
      }
    };

    var uuid = global.getUuid(globalName, subscripts);
    if (uuid !== '') deleteByUuid(uuid);
    if (!global.exists(globalName)) {
      mongoDB.remove(dbIndex, {
        globalName: globalName
      });
    };
  },

  exists: function(globalName) {
    var results = mongoDB.retrieve(db, {
      globalName: globalName, 
      parent: ''
    });
    //console.log('exists: ' + JSON.stringify(results));
    if (results.data.length === 0) {
      return false;
    }
    else {
      return true;
    }
  },

  nodeExists: function(globalName, subscripts) {
    subscripts = global.stringifySubscripts(subscripts);
    var results = mongoDB.retrieve(db, {
      globalName: globalName, 
      subscripts: subscripts
    });
    if (results.data.length === 0) {
      return false;
    }
    else {
      return true;
    }
  },

  addNode: function(globalName, parentId, subscript, data) {
    if (!global.exists(globalName)) return false;
    var parentNode = mongoDB.retrieve(db, {
      _id: parentId}
    ).data[0];
    var subscripts = parentNode.subscripts.slice(0);
    subscripts.push(subscript);
    var content = {
      globalName: globalName, 
      parent: parentId, 
      children: [], 
      subscripts: subscripts, 
    };
    if (typeof data !== 'undefined') content.data = data;
    if (data === null) delete content.data;
    var result = mongoDB.insert(db, content );
    var guid = result._id;
    var children = parentNode.children; 
    children.push({
      _id: guid, 
      subscript: subscript
    });
    delete parentNode._id;
    mongoDB.update(db, {_id: parentId}, parentNode);
    return guid;
  },

  set: function(globalName, subscripts, data) {
    var parentId;
    var subs = [];
    var subscript;
    var value;
    var leaf;
    var rootNode;
    var i;
    var node;
    if (!global.exists(globalName)) {
      parentId = global.createRoot(globalName);
    }
    else {
      //global.log('set: global ' + globalName + ' exists');
      rootNode = mongoDB.retrieve(db, {
        globalName: globalName, 
        parent: ''
      });
      parentId = rootNode.data[0]._id;
      //global.log('set: parentId = ' + parentId);
    }
    for (i = 0; i < subscripts.length; i++) {
      value = null;
      leaf = false;
      if (i === (subscripts.length - 1)) {
        if (typeof data === 'undefined') data = '';
        value = data;
        leaf = true;
      }
      subscript = subscripts[i].toString();
      subs.push(subscript);
      if (!global.nodeExists(globalName, subs)) {
        //global.log('set: global node ' + globalName + '; ' + JSON.stringify(subs) + ' does not exist');
        parentId = global.addNode(globalName, parentId, subscript, value);
      }
      else {
        //global.log('set: global node ' + globalName + '; ' + JSON.stringify(subs) + ' exists');
        node = mongoDB.retrieve(db, {
          globalName: globalName, 
          subscripts: subs
        }).data[0];
        parentId = node._id;
        if (leaf) {
          //node.data = value.toString();
          node.data = value;
          delete node._id;
          mongoDB.update(db, {_id: parentId}, node);		
        }
      }
    }
    return parentId;
  },

  isNumeric: function(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }
};

module.exports = {

  // Emulation of NodeM & GT.M using MongoDB

  Mongo: function() {

    this.version = function() {
      var build = mongoDB.command("db", {buildInfo : ""});
      return mongoDB.version() + '; MongoDB ' + build.data.version;
    };

    this.about = function() {
      return 'MongoDB Adaptor for Node.js (M/Gateway Developments Ltd)';
    };

    this.open = function(mongoObj, params) {
      //global.log('open', true);
      mongoDB = mongoObj;
      //mongoDB = new mongo.Mongo();
      params = params || {};
      if (!params.address) params.address = 'localhost';
      if (!params.port) params.port = 27017;
      if (params.db) {
        db = params.db;
        delete params.db;
      }
      return mongoDB.open(params);
    };

    this.set = function(node) {
      //global.log('set: ' + JSON.stringify(node));
      if (node) {
        if (node.global && node.global !== '') {
          if (node.subscripts) {
            global.set(node.global, node.subscripts, node.data);
            return {
              ok: 1,
              global: node.global,
              result: 0,
              subscripts: node.subscripts
            };
          }
        }
      }
      return {
        ok: 0,
        global: '',
        result: 0,
        subscripts: []
      };
    };
  
    this.get = function(node) {
      //console.log('get - node: ' + JSON.stringify(node));
      if (node) {
        if (node.global && node.global !== '') {
          if (node.subscripts) {
            node.subscripts = global.stringifySubscripts(node.subscripts);
            var result = mongoDB.retrieve(db, {
              globalName: node.global,
              subscripts: node.subscripts
            });
            //console.log('get - result: ' + JSON.stringify(result));
            var defined = 0;
            if (result.data && result.data.length > 0) {
              var content = result.data[0];
              //console.log('get - content: ' + JSON.stringify(content));
              var hasChildren = (content.children.length > 0);
              if (typeof content.data !== 'undefined') {
                defined = 1;
                if (hasChildren) defined = 11;
              }
              else {
                if (hasChildren) defined = 10;
             }
             var data = content.data;
             //console.log('get - data = ' + data);
             if (global.isNumeric(data)) data = +data;
               //console.log('get2 - defined = ' + defined);
              return {
                ok: 1,
                global: node.global,
                data: data,
                defined: defined,
                subscripts: node.subscripts
              };
            }
          }
        }
      }
      if (!node) node = {};
      return {
        ok: 1,
        global: node.global || '',
        data: '',
        defined: 0,
        subscripts: node.subscripts || []
      };
    };

    this.data = function(node) {
      if (node) {
        if (node.global && node.global !== '') {
          if (node.subscripts) {
            var result = this.get(node);
            delete result.data;
            return result;
          }
        }
      }
      if (!node) node = {};
      return {
        ok: 1,
        global: node.global || '',
        defined: 0,
        subscripts: node.subscripts || []
      };
    };

    this.increment = function(node) {
      //global.log('increment: ' + JSON.stringify(node));
      var value = this.get(node).data;
      if (isNaN(+value)) value = 0;
      var inc = node.increment || 1;
      value = value + inc;
      node.data = value;
      this.set(node);
      return {
        ok: 1,
        global: node.global,
        data: value,
        subscripts: node.subscripts
      };
    };

    this.kill = function(node) {
      //global.log('kill: ' + JSON.stringify(node));
      if (node) {
        if (node.global && node.global !== '') {
          if (node.subscripts) {
            if (node.subscripts.length === 0) {
              //  subscripts is [], so kill all nodes
              global.delete(node.global);
            }
            else {
              global.deleteNode(node.global, node.subscripts);
            }
            return {
              ok: 1,
              global: node.global,
              result: 0,
              subscripts: node.subscripts
            };
          }
        }
      }
      if (!node) node = {};
      return {
        ok: 1,
        global: node.global || '',
        result: 0,
        subscripts: node.subscripts || []
      };
    };

    this.sequence = function(node, direction) {
      var start = node.subscripts.pop();
      //console.log('sequence - start = ' + start);
      //console.log('sequence - node = ' + JSON.stringify(node));
      if (node) {
        if (node.global && node.global !== '') {
          if (node.subscripts) {
            node.subscripts = global.stringifySubscripts(node.subscripts);
            var result = mongoDB.retrieve(db, {
              globalName: node.global,
              subscripts: node.subscripts
            });
            //console.log('sequence - result: ' + JSON.stringify(result));
            if (result.data && result.data.length > 0) {
              var gloNode = result.data[0];
              var children = gloNode.children;
              if (children.length > 0) {
                var match = false;
                var subscripts = [];
                var subscript;
                var pos;
                var result = '';
                for (var i = 0; i < children.length; i++) {
                  subscript = children[i].subscript;
                  if (subscript === start) match = true;
                  subscripts.push(subscript);
                }
                if (!match && start !== '') subscripts.push(start);
                subscripts.sort();
                if (match) {
                  if (direction === 'next') {
                    pos = subscripts.indexOf(start) + 1;
                    if (pos === subscripts.length) {
                      result = '';
                    }
                    else {
                      result = subscripts[pos];
                    }
                  }
                  else {
                    pos = subscripts.indexOf(start) - 1;
                    result = '';
                    if (pos > 0) result = subscripts[pos];
                  }
                }
                else {
                  if (start === '') {
                    if (direction === 'next') {
                      result = subscripts[0];
                    }
                    else {
                      result = subscripts[subscripts.length - 1];
                    }
                  }
                  else {
                    if (direction === 'next') {
                      pos = subscripts.indexOf(start) + 1;
                      if (pos === subscripts.length) {
                        result = '';
                      }
                      else {
                        result = subscripts[pos];
                      }
                    }
                    else {
                      pos = subscripts.indexOf(start) - 1;
                      if (pos < 0) {
                        result = '';
                      }
                      else {
                        result = subscripts[pos];
                      }
                    }
                  }
                }
                node.subscripts[node.subscripts.length] = result;
                if (global.isNumeric(result)) result = +result;
                return {
                  ok: 1,
                  global: node.global,
                  result: result,
                  subscripts: node.subscripts
                };
              }
            }
          }
        }
      }
      if (!node) node = {};
      return {
        ok: 1,
        global: node.global || '',
        result: '',
        subscripts: node.subscripts || []
      };	  
    };

    this.order = function(node) {
      return this.sequence(node, 'next');
    };

    this.next = function(node) {
      return this.sequence(node, 'next');
    };

    this.previous = function(node) {
      return this.sequence(node, 'previous');
    };

    this.global_directory = function() {
      var list = [];
      var result = {data: []};
      result = mongoDB.retrieve(dbIndex, {});
      for (var i = 0; i < result.data.length; i++) {
        list.push(result.data[i].globalName);
      }
      return list;
    };

    this.list = function(globalName) {
      var obj = {};
      if (globalName) obj = {globalName: globalName}; 
      var glo = mongoDB.retrieve(db, obj);
      console.log(JSON.stringify(glo, null, 2));
    };

    this.close = function() {
      return mongoDB.close()
    };

  }
};