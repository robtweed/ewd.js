// Template Indexer Module for GlobalNodes modified through EWD Lite / ewdGlobals.js

// This should be extended by the developer to include indexing / de-indexing of all data GlobalNode
// objects

// The Example Globals are provided below as a guide

exports.start = function(mumps) {

  mumps.changeHandler.removeAllListeners();

  mumps.changeHandler.on('beforesave', function(node) {
    //console.log('!!Before Save: ' + process.pid + ': ' + node.global + ' ' + JSON.stringify(node.subscripts));
  });

  mumps.changeHandler.on('aftersave', function(node) {
    //console.log('* After Save ' + process.pid + ': ' + node.global + ' ' + JSON.stringify(node.subscripts) + '; oldValue: ' + node.oldValue + '; newValue: ' + node.newValue);

   // Example Globals:

     //  CLPPats(id, 'lastName') = 'Smith'
     //    creates CLPPatIndex('lastName', 'smith', id) = 'Smith'

    if (node.global === 'CLPPats') {
      if (node.subscripts[1] === 'lastName') {
        var index = new mumps.Global('CLPPatIndex');
        var id = node.subscripts[0];
        var oldName = node.oldValue.toLowerCase();
        if (oldName !== '') {
          // remove index node for old, previous value
          index.$('lastName').$(oldName).$(id)._delete();
        }
        // create index node for new value
        index.$('lastName').$(node.newValue.toLowerCase()).$(id)._value = node.newValue;
      }
    }

  });
  
  mumps.changeHandler.on('beforedelete', function(node) {
    //console.log('!!Before Delete: ' + process.pid + ': ' + node.global + ' ' + JSON.stringify(node.subscripts));
  });

  mumps.changeHandler.on('afterdelete', function(node) {
    //console.log('!!After Delete: ' + process.pid + ': ' + node.global + ' ' + JSON.stringify(node.subscripts));

    if (node.global === 'CLPPats') {
      if (node.subscripts[1] === 'lastName') {
        var index = new mumps.Global('CLPPatIndex');
        var id = node.subscripts[0];
        var oldName = node.oldValue.toLowerCase();
        if (oldName !== '') {
          // remove index node for old, previous value
          index.$('lastName').$(oldName).$(id)._delete();
        }
      }
    }

  });


};
