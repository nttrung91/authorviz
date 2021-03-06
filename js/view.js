// Authorviz Annotations
// _____________________________
//
// BB: means Black Box. When you see this, it means you don't need to care about what goes inside the methods. It is because the method name is self-explanatory and inside is complex. The methods do what they supposed to do

;
(function() {
    'use strict';

    // Reserve the "$" character to only be use as a call to to jQuery
    // e.g. instead of writing "jQuery.someMethods", you can write "$.someMethods"
    var $ = jQuery.noConflict();

    // If authorviz is already exist, use it. Otherwise make a new object
    var authorviz = authorviz || {};


    // Add new properties to the existing object's properties
    $.extend(authorviz, {
        // Store each author object in the document
        // Each author object will have a unique ID, color, and name
        authors: [],
        
        /*TODO delete*/
	    revAuthors: [],
	    revTimestamps: [],
	    /**/

        // Loaded lets us know whether users run Authorviz or not. If they already ran it, "loaded" will be set to "true" and the next time they click on the Authorviz Button again, the app won't load the revisions again and simply display the results since they already loaded the revisions on their first time clicking the Authorviz Button
        loaded: false,

        // Initialize the application
        init: function() {
            // History URL be use as an URL in an AJAX call later. The ajax call allows us to grab the Total Revision Number and Authors data
            var historyUrl = null;

            // Render means displaying HTML onto the page. From now on, whenever you see the keyword "render" (e.g. renderButton, renderProgressBar) it means that the methods will inject the HTML code into the page
            this.renderApp();

            // setToken method sets the Google Document's unique token onto the page so that we can retrieve it later for other uses.
            // The token is required in all Ajax URL from Google Doc
            this.setToken();

            // getHistoryUrl constructs the history URL
            historyUrl = this.getHistoryUrl(location.href);

            // This method makes the Ajax call using the History URL. The method will grab Google Doc's History Data. In that data, there are important informations such as Revision Numbers and Authors data
            this.getHistoryData(historyUrl);
        },


        // Set Token on Body Tag
        // ** BB
        setToken: function() {
            var code = function() {
                document.getElementsByTagName('body')[0].setAttribute("tok", _docs_flag_initialData.info_params.token)
            };
            var script = document.createElement('script');
            script.textContent = '(' + code + ')()';
            (document.head || document.documentElement).appendChild(script);
            script.parentNode.removeChild(script);
        },


        // Set Revision Number to corresponded elements
        setRevisionNumber: function(num) {
            $('.js-revision-number').add('.js-revision-out-of').text(num);
        },


        // Get the Google Doc's ID
        // ** BB
        getDocId: function() {
            var regexMatch = location.href.match("((https?:\/\/)?docs\.google\.com\/(.*?\/)*document\/d\/(.*?))\/edit");
            return regexMatch[4];
        },


        // Get the Google Doc's unique Token
        // The token is required to construct certain Ajax URL
        getToken: function() {
            return $('body').attr('tok');
        },


        // Construct History URL to be use in an Ajax call
        // ** BB
        getHistoryUrl: function(url, switchUrl) {
            var token = this.getToken(),
                regexMatch = url.match("((https?:\/\/)?docs\.google\.com\/(.*?\/)*document\/d\/(.*?))\/edit"),
                http = regexMatch[1],

                // after: https://docs.google.com/document/d/101qa3iTDpprM6E2FZX_2mFbfimEWG1F8Pr9OevEEbDg
                historyUrl = null;

		        if (switchUrl === 0) {
		            http = http.replace('/d/', '/u/1/d/');
		        }
		        else if(switchUrl > 0)
		        {
		            http = http.replace('/u/1/d/', '/u/0/d/');
		        }
		        else{

		        }

		        historyUrl = http + '/revisions/tiles?id=' + this.getDocId() + "&token=" + token + "&start=1&showDetailedRevisions=false";
		        // console.log("historyUrl is at: ");
		        // console.log(historyUrl);
		        return historyUrl;
		    },


        // Ajax call to get Google Doc's history data which contains revision number and authors data
        getHistoryData: function(url) {
            var that = this;
            var errorCounter = 0;

            $.ajax({
                type: 'GET',
                url: url,
                dataType: 'html',

                // If the Ajax call failed, make another call using a different url
                error: function(request, error) {
                    var historyUrl = null;

                    if (request.status === 400) {
                        historyUrl = that.getHistoryUrl(location.href, errorCounter);
                        that.getHistoryData(historyUrl);
                        errorCounter ++;
                    }
                    else{

                    }
                },

                // If the call success, turn the result DATA into JSON object and get the important information (Revision number & authors data)
                success: function(data) {
                    var raw = jQuery.parseJSON(data.substring(4)),
                        // revisionNumber = raw[2][raw[2].length - 1][3];
                        revisionNumber = raw.tileInfo[raw.tileInfo.length-1].end;

                    that.setRevisionNumber(revisionNumber);
                    $('.js-authorviz-btn').removeClass('is-disabled');

                    that.authors = that.parseAuthors(raw.userMap);
                    that.parseRevTimestampsAuthors(raw.tileInfo, that.authors); // set an array of authors which correspond for revisions' time

                }
            })
        },


        // parseAuthors method receive "raw authors" data (JSON Object) and maniputlate on that JSON Object to return a set of structural Author Object.
        // ** BB
        parseAuthors: function(userMap) {
            var 
                authors = [];

            // Author is a factory that creat "author object" a set of structural property and value.
            // If you come from Programming language like Java, C, C++, Python, think of this Author as a Class used to create as many author children as needed
            var Author = function(name, color, id) {
                return {
                    name: name,
                    color: color,
                    id: id
                };
            };





            var colorArray = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
            "#8c564b", "#e377c2", "#7B8A91", "#bcbd22", "#17becf", "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5", "#bd9e39",
            "#e6550d", "#637939", "#aa2287", "#fed000", "#cedb9c", "#393b79", "#E71AC9", "#FEFC5A", "#c18A61", "#A6B1A5",
            "#8743fd", "#517EB8", "#014D0B", "#B90367", "#C54d07" ];

        
	        //check size of users and use math to append more colors to colorarray based on the number of users.
	        //ex: 80 users. colorArray.append(80-30(50 colors of gray into the colorArray))
	            
	        //new code
	        var d3Color = d3.scale.category20().range(colorArray);
	        //colors will repeat if more than 20 authors. range can accomodate for more than 20 colors in the array of hex colors.
	    

	        _.each(Object.keys(userMap), function(d, i){

	            if (userMap[d].anonymous === true){
	                //need to keep track of all unique anonymous users.
	                authors.push(Author("Anonymous Author(s)", "#D3D3D3", d));
	            }
	            else if (i > 30){
	                authors.push(Author(userMap[d].name, "#a8a8a8", d));

	            }
	            else{
	                authors.push(Author(userMap[d].name, d3Color(i), d));
	            }
	        	

	        });
	        

	        return authors;
	    },

    parseRevTimestampsAuthors: function(tileInfo, authors) {
        var that = this,
            rawData,
            i,
            rawAuthors = [],
            //  authors = [],
            authorId = [];
        //timestamps = [];

        // Author is a factory that create "author object" a set of structural property and value.
        // If you come from Programming language like Java, C, C++, Python, think of this Author as a Class used to create as many author children as needed
        // var Author = function(name, color, id) {
        //     return {
        //         name: name,
        //         color: color,
        //         id: id
        //     };
        // };

        // var timeStamp = function(timestamp1, timestamp2) {
        //     return {
        //         timestamp1: timestamp1,
        //         timestamp2: timestamp2
        //     };
        // };


        _.each(tileInfo, function(tile) {
            var authorsArray = [];
            _.each(tile.users, function(eachAuthor) {

                var author = _.find(authors, function(val) {
                    return eachAuthor === val.id;
                });

                authorsArray.push(author);
            });

            that.revTimestamps.push(tile.endMillis);
            that.revAuthors.push(authorsArray);


        });

        // console.log("Time: ");
        // console.log(that.revTimestamps);

    },
        getDocTitle: function() {
            return $('.docs-title-input').val();
        },


        getRevisionNumber: function() {
            return $('.js-revision-number').text();
        },


        // Construct an URL to retrieve Changelog Data
        // ** BB
        getChangelogUrl: function() {
            var regmatch = location.href.match(/^(https:\/\/docs\.google\.com.*?\/document\/d\/)/),
                baseUrl = regmatch[1],
                loadUrl = baseUrl + this.getDocId() + "/revisions/load?id=" + this.getDocId() + "&start=1&end=" + parseInt(('' + this.getRevisionNumber()).replace(/,/g, '')) + "&token=" + this.getToken();

            return loadUrl;
        },


        // Retrieve Changelog data and send it to Model
        getChangelog: function(url) {
            // this stores reference to current object
            var that = this;

            $.ajax({
                type: 'GET',
                url: url,
                dataType: 'html',

                // If the call success, send Changelog Data, Document ID, authors data to Model
                success: function(data) {
                    var raw = jQuery.parseJSON(data.substring(4));
                    // Send Changelog data to Model
                    //  console.log(data);
                    chrome.runtime.sendMessage({
                        msg: 'changelog',
                        docId: that.getDocId(),
                        changelog: raw.changelog,
                        authors: that.authors
                    }, function(data) {});
                },
                error: function(error) {
                    console.log(error.status);
                }
            });
        },


        // Bind Click Event onto the Authorviz Button
        addListenerToAuthorvizBtn: function() {
            var that = this;

            // When the button is click, show the app and disable this button
            $(document).on('click', '.js-authorviz-btn', function() {
                var changelogUrl = null;

                // Make the App Visible to user
                $('.js-authorviz').removeClass('hideVisually');

                changelogUrl = that.getChangelogUrl(location.href);
                that.getChangelog(changelogUrl);

                // Remove the click event from Authorviz button
                $(document).off('click', '.js-authorviz-btn');
            });
        },


        // *************************************
        //   RENDER (Inject HTML in the page)
        // *************************************

        renderApp: function() {
            // js-authorviz: Authoviz App
            // js-progress-bar: Progress Bar
            // js-progress-so-far: Updated part of Progress Bar
            // js-revision-so-far: Revision Number so far
            // js-revision-out-of: Total number of revisions
            // js-doc-title: Document's title
            // js-author: The author section
            // js-result: The result panel
            // js-left-panel: Left Panel

            var html = '<div class="authorviz js-authorviz hideVisually"><div class="authorviz__layout"><div class="l-half l-half--top authorviz__wrap--top"><div class="aligner txt-c js-left-panel" style="height: 100%"><div class="aligner-item authorviz__intro"><div class="aligner-item aligner-item-top"><h3 class="authorivz__doc-title js-doc-title">Final Paper</h3><div class="js-author authorviz__author"></div></div><div class="aligner-item js-progress-bar"><div class="authorviz__progress-bar"><div class="authorviz__progress-bar-item js-progress-so-far"></div></div><p class="authorviz__loading-text">Loading <span class="js-revision-so-far">0</span>/<span class="js-revision-out-of">?</span> revisions</p></div></div></div></div><div class="l-half l-half--bottom authorviz__wrap--bottom"><div class="authoviz__box js-result"></div></div></div</div>';

            $('body').prepend(html);

            this.renderAuthorvizBtn();

            // Update Document Title
            $('.js-doc-title').text(this.getDocTitle());

        },


        renderAuthorvizBtn: function() {
            var btnGroup = $('#docs-titlebar-share-client-button').prev();

            // js-authorviz: feature btn
            // js-revision-number: revision number
            $('<div class="goog-inline-block js-authorviz-btn is-disabled"><div role="button" class="goog-inline-block jfk-button jfk-button-standard docs-titlebar-button jfk-button-clear-outline" aria-disabled="false" aria-pressed="false" tabindex="0" data-tooltip="Visualize Document" aria-label="Visualize Document" value="undefined" style="-webkit-user-select: none;">AuthorViz (<span class="js-revision-number">loading</span> revisions)</div><div id="docs-docos-caret" style="display: none" class="docos-enable-new-header"><div class="docs-docos-caret-outer"></div><div class="docs-docos-caret-inner"></div></div></div>').prependTo(btnGroup);

            this.addListenerToAuthorvizBtn();
        },


        renderProgressBar: function(soFar) {
            var outOf,
                progressSoFar;

            // If users already loaded Revision data, don't need to display the Progress Bar again
            if (this.loaded) {
                return;
            }

            outOf = this.getRevisionNumber();
            progressSoFar = (soFar / outOf) * 100;

            $('.js-progress-so-far').css("width", progressSoFar + '%');
            $('.js-revision-so-far').text(soFar);

            // When progress bar is fully loaded, do something
            if (progressSoFar === 100) {
                this.loaded = true;
                this.renderCloseBtn();
                this.renderPrintBtn();
                $('.js-progress-bar').addClass('hideVisually');
                $('.js-author').html(this.renderAuthorName());
            }
        },


        renderAuthorName: function() {
            var html = _.reduce(this.authors, function(memo, author, index, list) {
                if (index === list.length - 1) {
                    return memo + '<span style="color:' + author.color + '">' + author.name + '</span>'
                }

                return memo + '<span style="color:' + author.color + '">' + author.name + ', </span>'
            }, '');

            return html;
        },


        renderCloseBtn: function() {
            var html = '<button class="btn btn-primary js-close authorviz__close-btn">Close</button>',
                that = this;

            $('.js-left-panel').append(html);

            $(document).on('click', '.js-close', function() {
                $('.js-authorviz').addClass('hideVisually');

                $(document).on('click', '.js-authorviz-btn', function() {
                    // Show App
                    $('.js-authorviz').removeClass('hideVisually');
                });
            });
        },


        renderPrintBtn: function() {
            var html = '<button class="btn btn-primary-alt js-print authorviz__print-btn">Print</button>',
                that = this;

            $('.js-left-panel').append(html);

            $(document).on('click', '.js-print', function() {
                var printContent = $('.js-result');
                var printWindow = window.open('', '', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');
                printWindow.document.write(printContent.html());
                printWindow.document.close();
                printWindow.focus();
                printWindow.print();
                printWindow.close();
            });
        },


        renderResultPanel: function(html) {
            $('.js-result').html(html);
        }

    });

    // When Google Doc is finished loading, initialize authorViz app
    authorviz.init();

    // These methods are provided by Chrome API
    // chrome.runtime.onMessage method listen to the Model. Whenever Model wants to send data over to View, this method will activate and listen the call
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            switch (request.msg) {
                case 'progress':
                    authorviz.renderProgressBar(request.soFar, request.outOf);
                    sendResponse('done');
                    break;

                case 'render':
                    authorviz.renderResultPanel(request.html);
                    sendResponse('end');
                    break;

                default:
            }
        });
}());