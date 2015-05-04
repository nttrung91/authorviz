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
        var author = _.where(authors, {id: obj.aid});

        if(obj.s === "\n") {
          return memo + "<br>";
        } else {
          return memo + '<span style="color:' + author[0]['color'] + '">' + obj.s + '</span>';
        }

      },'');
    },


    construct: function(entry, authorId) {
      var that = this,
          type = entry.ty,
          insertStartIndex = null,
          deleteStartIndex = null,
          deleteEndIndex = null;

      if(type === 'mlti') {
        _.each(entry.mts, function(ent) {
          that.construct(ent, authorId);
        });

      } else if(type === 'is') {
        insertStartIndex = entry.ibi;

        // Break string downs into character and add individual character to 'str' array
        _.each(entry.s, function(character, index) {
          var charObj = {
            s: character,
            aid: authorId
          };

          that.str.insert(charObj, (insertStartIndex - 1) + index);
        });

      } else if (type === 'ds') {
        deleteStartIndex = entry.si;
        deleteEndIndex = entry.ei;

        this.str.delete(deleteStartIndex - 1, deleteEndIndex - 1);
      }

      return true;
    },


    buildRevisions: function(docId, changelog, authors) {
      // Clear previous revision data
      this.str = [];

      var that = this,
          soFar = 0,
          revisionNumber = changelog.length,
          html = '',
          entry = null,
          authorId = null;


      async.eachSeries(changelog, function(entries, callBack) {
        authorId = entries[2],
        entry = entries[0];


        chrome.tabs.query({url: '*://docs.google.com/*/' + docId + '/edit'}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, {msg: 'progress', soFar: soFar + 1}, function(response) {

            // Update progress bar
            soFar += 1;

            that.construct(entry, authorId);
            callBack();


            // When Progress Bar reaches 100%, do something
            if(soFar === revisionNumber) {
              html = that.render(that.str, authors);

              chrome.tabs.query({url: '*://docs.google.com/*/' + docId + '/edit'}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {msg: 'render', html: html}, function(response) {console.log(response);});
              });
            }
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