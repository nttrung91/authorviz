(function() {
  'use strict';

  var $ = jQuery.noConflict();

  Array.prototype.insert = function(element, index) {
    this.splice(index, 0, element);
  }

  Array.prototype.delete = function(startIndex, endIndex) {
    return this.splice(startIndex, (endIndex - startIndex) + 1);
  }


  // If authorviz is already exist, use it. Otherwise make a new object
  var authorviz = authorviz || {};

  $.extend(authorviz, {

    str: [],

    render: function(chars, authors) {
      return _.reduce(chars, function(memo, obj) {

        var colorIndex = _.indexOf(authors, obj.aid) - 1;
        if(obj.s === "\n") {
          return memo + "<br>";
        } else {
          return memo + '<span style="color:' + authors[colorIndex] + '">' + obj.s + '</span>';
        }

      },'');
    },

    process: function(entry, authorId) {
      var that = this,
          type = entry.ty,
          insertStartIndex = null,
          deleteStartIndex = null,
          deleteEndIndex = null;

      if(type === 'mlti') {
        _.each(entry.mts, function(ent) {
          that.process(ent, authorId);
        });

      } else if(type === 'is') {
        insertStartIndex = entry.ibi;

        // Break string downs into character and add individual character to 'str' array
        _.each(entry.s, function(character, index) {
          var charObj = {
            s: character,
            aid: authorId
          }
          that.str.insert(charObj, (insertStartIndex - 1) + index);
        });

      } else if (type === 'ds') {
        deleteStartIndex = entry.si;
        deleteEndIndex = entry.ei;

        this.str.delete(deleteStartIndex - 1, deleteEndIndex - 1);
      }
    },

    buildRevisions: function(docId, changelog, authors) {
      var that = this,
          soFar = 0,
          revisionNumber = changelog.length;

      async.eachSeries(changelog, function(entry, callBack) {
        var authorId = entry[2],
            entry = entry[0],
            html = "";

        chrome.tabs.query({url: '*://docs.google.com/*/' + docId + '/edit'}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, {msg: 'progress', soFar: soFar + 1}, function(response) {

            // Update progress bar
            soFar += 1;


            // Progress bar reaches 100%, do something
            if(soFar === revisionNumber) {
              html = that.render(that.str, authors);

              chrome.tabs.query({url: '*://docs.google.com/*/' + docId + '/edit'}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {msg: 'render', html: html}, function(response) {});
              });
            }

            that.process(entry, authorId);
            callBack();
          });
        });
      });

    }


  });





  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      switch(request.msg) {
        case 'changelog':
          authorviz.buildRevisions(request.docId, request.changelog, request.authors);
        break;

        default:
      }
    });

}());