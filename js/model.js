;
(function() {
    'use strict';

    var $ = jQuery.noConflict();

    // "Array.prototype" allows us to add aditional methods to the Array object. Here we add "insert" and "delete" methods

    // "insert" method lets us add an element at any index
    // e.g.
    // [a,b,d].insert('c', 2); // [a,b,c,d]
    Array.prototype.insert = function(element, index) {
        this.splice(index, 0, element);
    }

    // "remove" method lets us remove elements within index range
    // e.g.
    // [a,b,c,d].remove(0, 2); // [d]
    Array.prototype.delete = function(startIndex, endIndex) {
        return this.splice(startIndex, (endIndex - startIndex) + 1);
    }

    // If authorviz is already exist, use it. Otherwise make a new object
    var authorviz = authorviz || {};

    $.extend(authorviz, {

        // "str" stores all the Character objects from a Google Doc
        str: [],

        // Render method construct HTML DOM element from a set of Character and Author Data
        render: function(chars, authors) {
            return _.reduce(chars, function(memo, obj) {
                var author = _.where(authors, {
                    id: obj.aid
                });

                if (author[0] === undefined){ // We are trying to handle the Anonymous user 
                   if (obj.s === "\n") {
                       return memo + "<br>";
                   } else {
                       return memo + '<span style="color:#7F7F7F">' + obj.s + '</span>';
                   }
               }

               else{
                   if (obj.s === "\n") {
                       return memo + "<br>";
                   } else {
                       return memo + '<span style="color:' + author[0]['color'] + '">' + obj.s + '</span>';
                   }
               }

           }, '');
        },


        // Construct method constructs the "str" variable
        construct: function(entry, authorId) {
            var that = this,
                type = entry.ty,
                insertStartIndex = null,
                deleteStartIndex = null,
                deleteEndIndex = null;

            if (type === 'mlti') {

                _.each(entry.mts, function(ent) {
                    that.construct(ent, authorId);
                });

            } else if (type === 'rplc') {
                _.each(entry.snapshot, function(ent) {
                    that.construct(ent, authorId);
                });

            } else if (type === 'rvrt') {            
                that.str = [];            
                _.each(entry.snapshot, function(ent) {                
                    that.construct(ent, authorId);            
                });
            } else if (type === 'is' || type === 'iss') {
                insertStartIndex = entry.ibi;

                // Break string downs into character and add individual character to 'str' array
                _.each(entry.s, function(character, index) {
                    var charObj = {
                        s: character,
                        aid: authorId
                    };

                    that.str.insert(charObj, (insertStartIndex - 1) + index);
                });

            } else if (type === 'ds' || type === 'dss') {
                deleteStartIndex = entry.si;
                deleteEndIndex = entry.ei;

                this.str.delete(deleteStartIndex - 1, deleteEndIndex - 1);
            } else if (type === 'as') {
                //console.log("entering as");
                var stringModifications = entry.sm,
                    startIndex = entry.si,
                    endIndex = entry.ei,
                    specialType = entry.st
                    // console.log(entry);
                for (var i = startIndex - 1; i < endIndex; i++) {
                    //console.log(that.str[i]);
                    $.extend(that.str[i], stringModifications)
                    //console.log(that.str[i]);
                }
            } else {
                // todo
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
                command = null,
                authorId = null;


            // Async run through each entry in a synchronous sequence.
            async.eachSeries(changelog, function(entry, callBack) {
                authorId = entry[2],
                command = entry[0];

                // Retrieve the Google Doc Tab and send a message to that Tab's view
                chrome.tabs.query({
                    url: '*://docs.google.com/*/' + docId + '/edit*'
                }, function(tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        msg: 'progress',
                        soFar: soFar + 1
                    }, function(response) {

                        // Update progress bar
                        soFar += 1;

                        that.construct(command, authorId);

                        // Callback lets async knows that the sequence is finished can it can start run another entry
                        callBack();

                        //              html = that.render(that.str, authors);
                        //                            chrome.tabs.query({url: '*://docs.google.com/*/' + docId + '/edit'}, function(tabs) {
                        //                chrome.tabs.sendMessage(tabs[0].id, {msg: 'render', html: html}, function(response) {
                        //                //    console.log(response);
                        //                });
                        //              });

                        // When Progress Bar reaches 100%, do something
                        if (soFar === revisionNumber) {
                            // === revisionNumber
                            html = that.render(that.str, authors);

                            chrome.tabs.query({
                                url: '*://docs.google.com/*/' + docId + '/edit*'
                            }, function(tabs) {
                                chrome.tabs.sendMessage(tabs[0].id, {
                                    msg: 'render',
                                    html: html
                                }, function(response) {
                                    //    console.log(response);
                                });
                            });
                        }
                    });

                });
            });
        }
    });





    // Listen to message sent out from the View
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            switch (request.msg) {
                // If the message is 'changelog', run 'buildRevision'
                case 'changelog':
                    authorviz.buildRevisions(request.docId, request.changelog, request.authors);
                    break;

                default:
            }
        });

}());