(function() {
  'use strict';

  var $ = jQuery.noConflict();

  // If authorviz is already exist, use it. Otherwise make a new object
  var authorviz = authorviz || {};


  // Add new properties to existing properties
  $.extend(authorviz, {
    authors: [],
    loaded: false,

    init: function() {
      this.renderApp();
      this.setToken();
      this.getRevisionData();
    },


    // Set Token on Body Tag
    setToken: function() {
      var code = function() {
        document.getElementsByTagName('body')[0].setAttribute("tok", _docs_flag_initialData.info_params.token)
      };
      var script = document.createElement('script');
      script.textContent = '(' + code + ')()';
      (document.head||document.documentElement).appendChild(script);
      script.parentNode.removeChild(script);
    },


    setRevisionNumber: function(num) {
      $('.js-revision-number').add('.js-revision-out-of').text(num);
    },


    getDocId: function() {
      var regexMatch = location.href.match("((https?:\/\/)?docs\.google\.com\/(.*?\/)*document\/d\/(.*?))\/edit");
      return regexMatch[4];
    },


    getToken: function() {
      return $('body').attr('tok');
    },


    getHistoryUrl: function() {
      var token = this.getToken(),
          regexMatch = location.href.match("((https?:\/\/)?docs\.google\.com\/(.*?\/)*document\/d\/(.*?))\/edit"),
          http = regexMatch[1],
          http = http.replace('/d/','/u/1/d/'),
          historyUrl = http + '/revisions/history?id=' + this.getDocId() + "&token=" + token + "&start=1&end=-1&zoom_level=0";

      return historyUrl;
    },


    getRevisionData: function() {
      var that = this;

      $.ajax({
        type: 'GET',
        url: this.getHistoryUrl(),
        dataType: 'html',
        success: function(data) {
          var raw = jQuery.parseJSON(data.substring(4)),
              revisionNumber = raw[raw.length-1][raw[raw.length-1].length-1][3];

          that.setRevisionNumber(revisionNumber);

          that.authors = that.getAuthor(raw[2]);
        }
      })
    },


    getAuthor: function(arr) {
      var rawAuthorData,
          i,
          authors = [];

      var Author = function(name, color, id) {
        return {
          name: name,
          color: color,
          id: id
        };
      };

      rawAuthorData = _.union(_.compact(_.flatten(_.map(arr, function(val) {
                      return val[1];
                    }))));

      for(i = 0; i < rawAuthorData.length; i+=3) {
        authors.push(Author(rawAuthorData[i], rawAuthorData[i+1], rawAuthorData[i+2]));
      }

      return authors;
    },


    getDocTitle: function() {
      return $('#docs-title-inner').text();
    },


    getRevisionNumber: function() {
      return $('.js-revision-number').text();
    },


    // Construct an URL to retrieve Changelog Data
    getChangelogUrl: function() {
      var regmatch = location.href.match(/^(https:\/\/docs\.google\.com.*?\/document\/d\/)/),
          baseUrl = regmatch[1],
          loadUrl = baseUrl + this.getDocId() + "/revisions/load?id=" + this.getDocId() + "&start=1&end=" + parseInt(('' + this.getRevisionNumber()).replace(/,/g, '')) + "&token=" + this.getToken();

      return loadUrl;
    },


    // Retrieve Changelog data and send it to Model
    getChangelog: function() {
      var that = this;

      $.ajax({
        type: 'GET',
        url: this.getChangelogUrl(),
        dataType: 'html',

        success: function(data) {
          console.log(that.authors);
          var raw = jQuery.parseJSON(data.substring(4));
          // Send Changelog data to Model
          chrome.runtime.sendMessage({msg: 'changelog', docId: that.getDocId(), changelog: raw.changelog, authors: that.authors}, function(data) {});
        },
        error: function(error) {
          console.log(error.status);
        }
      });
    },


    addListenerToAuthorvizBtn: function() {
      var that = this;
      $(document).on('click', '.js-authorviz-btn', function() {
        // Show App
        $('.js-authorviz').removeClass('hideVisually');

        that.getChangelog();

        $(document).off('click', '.js-authorviz-btn');
      });
    },


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

      var html = '<div class="authorviz js-authorviz hideVisually"><div class="authorviz__layout"><div class="l-half l-half--left authorviz__wrap--left"><div class="aligner txt-c js-left-panel" style="height: 100%"><div class="aligner-item authorviz__intro"><div class="aligner-item aligner-item-top"><h3 class="authorivz__doc-title js-doc-title">Final Paper</h3><div class="js-author authorviz__author"></div></div><div class="aligner-item js-progress-bar"><div class="authorviz__progress-bar"><div class="authorviz__progress-bar-item js-progress-so-far"></div></div><p class="authorviz__loading-text">Loading <span class="js-revision-so-far">0</span>/<span class="js-revision-out-of">?</span> revisions</p></div></div></div></div><div class="l-half l-half--right authorviz__wrap--right"><div class="authoviz__box js-result"></div></div></div</div>';

      $('body').prepend(html);

      this.renderAuthorvizBtn();

      // Update Document Title
      $('.js-doc-title').text(this.getDocTitle());

    },


    renderAuthorvizBtn: function() {
      var btnGroup = $('#docs-titlebar-share-client-button').prev();

      // js-authorviz: feature btn
      // js-revision-number: revision number
      $('<div class="goog-inline-block js-authorviz-btn"><div role="button" class="goog-inline-block jfk-button jfk-button-standard docs-titlebar-button jfk-button-clear-outline" aria-disabled="false" aria-pressed="false" tabindex="0" data-tooltip="Visualize Document" aria-label="Visualize Document" value="undefined" style="-webkit-user-select: none;">Visualize Document(<span class="js-revision-number">?</span> revs)</div><div id="docs-docos-caret" style="display: none" class="docos-enable-new-header"><div class="docs-docos-caret-outer"></div><div class="docs-docos-caret-inner"></div></div></div>').prependTo(btnGroup);

      this.addListenerToAuthorvizBtn();
    },


    renderProgressBar: function(soFar) {
      if(this.loaded) {
        return;
      }

      var outOf = this.getRevisionNumber(),
          progressSoFar = (soFar / outOf) * 100;

      $('.js-progress-so-far').css("width", progressSoFar + '%');
      $('.js-revision-so-far').text(soFar);

      // When progress bar is fully loaded, do something
      if(progressSoFar === 100) {
        this.loaded = true;
        this.renderCloseBtn();
        this.renderPrintBtn();
        $('.js-progress-bar').addClass('hideVisually');
        $('.js-author').html(this.renderAuthorName());
      }
    },


    renderAuthorName: function() {
      var html = _.reduce(this.authors, function(memo, author, index, list) {
        if(index === list.length - 1) {
          return memo + '<span style="color:' + author.color + '">' + author.name + '</span>'
        }

        return memo + '<span style="color:' + author.color + '">' + author.name + ', </span>'
      },'');

      return html;
    },


    renderCloseBtn: function() {
      var html = '<button class="btn btn-primary js-close authorviz__close-btn">Close</button>',
          that = this;

      $('.js-left-panel').append(html);

      $(document).on('click', '.js-close', function() {
        $('.js-authorviz').addClass('hideVisually');

        $(document).on('click','.js-authorviz-btn', function() {
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





  authorviz.init();





  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      switch(request.msg) {
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




