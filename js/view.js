(function() {
  'use strict';

  var $ = jQuery.noConflict();

  // If authorviz is already exist, use it. Otherwise make a new object
  var authorviz = authorviz || {};


  // Add new properties to existing properties
  $.extend(authorviz, {
    authors: [],

    init: function() {
      this.renderAuthorvizBtn();
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

    setRevisionNumberForAuthorvizBtn: function(num) {
      $('.js-revision-number').text(num);
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
          historyUrl = http + '/revisions/history?id=' + this.getDocId() + "&token=" + token + "&start=1&end=-1&zoom_level=0";

      return historyUrl;
    },

    getRevisionData: function() {
      var that = this;

      $.ajax({
        type: "GET",
        url: this.getHistoryUrl(),
        dataType: 'html',
        success: function(data) {
          var raw = jQuery.parseJSON(data.substring(4)),
              revisionNumber = raw[raw.length-1][raw[raw.length-1].length-1][3];

          that.setRevisionNumberForAuthorvizBtn(revisionNumber);

          that.authors = that.getAuthor(raw[2]);
        }
      })
    },

    getAuthor: function(arr) {
      var authors = _.union(_.compact(_.flatten(_.map(arr, function(val) {
        return val[1];
      }))));

      return authors;
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
        type: "get",
        url: this.getChangelogUrl(),
        dataType: 'html',

        success: function(data) {
          var raw = jQuery.parseJSON(data.substring(4));
          // Send Changelog data to Model
          chrome.runtime.sendMessage({msg: 'changelog', docId: that.getDocId(), changelog: raw.changelog, authors: that.authors}, function(data) {});
        }
      });
    },

    renderAuthorvizBtn: function() {
      var btnGroup = $('#docs-titlebar-share-client-button').prev();

      // js-authorviz: feature btn
      // js-revision-number: revision number
      $('<div class="goog-inline-block js-authorviz"><div role="button" class="goog-inline-block jfk-button jfk-button-standard docs-titlebar-button jfk-button-clear-outline" aria-disabled="false" aria-pressed="false" tabindex="0" data-tooltip="Open comments thread (⌘+Option+Shift+A)" aria-label="Open comments thread (shortcut ⌘+Option+Shift+A.)" value="undefined" style="-webkit-user-select: none;">Visualize Rev(<span class="js-revision-number">?</span> revs)</div><div id="docs-docos-caret" style="display: none" class="docos-enable-new-header"><div class="docs-docos-caret-outer"></div><div class="docs-docos-caret-inner"></div></div></div>').prependTo(btnGroup);

      this.addListenerToAuthorvizBtn();
    },

    renderProgressBar: function(soFar) {
      console.log(soFar + " / " + this.getRevisionNumber());
    },

    renderResult: function(html) {
      var panel = '<div class="js-result l-fullscreen"></div>';
      $('body').append(panel);
      $('.js-result').append(html);
      console.log(html);
    },

    addListenerToAuthorvizBtn: function() {
      var that = this;
      $(document).on('click', '.js-authorviz', function() { that.getChangelog(); });
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
          authorviz.renderResult(request.html);
          sendResponse('done');
          break;

        default:
      }
    });
}());




