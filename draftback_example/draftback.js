var $ = jQuery.noConflict()

window.draftback = window.draftback || {}

$.extend(window.draftback, {
  firstMark: [],
  getDocId: function() {
    var docIdRegexp = /\/document\/d\/(.*?)\//g
    var match = docIdRegexp.exec(location.pathname)
    return match[1]
  },
  getDocTitle: function() {
    return document.title.split(" - ")[0];
  },
  setToken: function(tok) {
    if (!draftback.token) {
      draftback.token = tok
      draftback.getRevisionCount()
    }
  },
  setRevisionCount: function(count) {
    draftback.revisionCount = ('' + count).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,")
    $('#revision-count').text(draftback.revisionCount)
  },
  updateProgress: function(so_far, out_of) {
    $("#so_far").text(Math.min(so_far, out_of))
    $("#out_of").text(out_of)

    if (so_far % 50 == 0) {
      var firstMark = draftback.firstMark
      var newMark = [so_far, new Date().getTime()]
      if (firstMark.length) {
        var interval = newMark[0] - firstMark[0]
        var timeForInterval = newMark[1] - firstMark[1]
        var ticksLeft = out_of - so_far
        var estimatedTimeLeft = (ticksLeft / interval) * timeForInterval
        var durationLeft = moment.duration(estimatedTimeLeft)

        if (durationLeft.asMilliseconds() < 60000) {
          if (durationLeft.asMilliseconds() > 30000) {
            var humanizedDuration = 'about a minute'
          } else {
            var humanizedDuration = 'a few seconds'
          }
        } else {
          var humanizedDuration = durationLeft.humanize()
        }
        $(".time-col").text(humanizedDuration + " left")
      } else {
        draftback.firstMark = newMark
      }

    }

    if (so_far >= (out_of - 1)) {
      $(".upload-file:first").addClass("complete")
      $(".time-col").html('<img src="https://cloud.githubusercontent.com/assets/21294/4967993/00bf782e-682d-11e4-93e7-106fcf26f6a0.gif" class="sprite sprite_web s_web_s_check">')
      $("a.dest").text('View')
    }
    $(".upload-progress-bar").css("width", (so_far / out_of) * 100 + '%')
  },
  disable: function() {
    $("#draftback").addClass('jfk-button-disabled')
      .attr('data-tooltip', 'Draftback is only available on docs you have permission to edit')
      .attr('aria-label', 'Draftback is only available on docs you have permission to edit')
      .attr('disabled', 'disabled')
      .attr('aria-disabled', 'disabled')
      .html('Draftback unavailable')
  },
  getRevisionCount: function() {
    var regmatch = location.href.match(/^(https:\/\/docs\.google\.com.*?\/document\/d\/)/)
    var baseUrl = regmatch[1]
    var docId = draftback.getDocId()
    var historyUrl = baseUrl + docId + "/revisions/history?id=" + docId + "&start=1&end=-1&zoom_level=0&token=" + draftback.token

    $.ajax({
      type: "get",
      url: historyUrl,
      headers: {"x-same-domain": 1},
      error: function(response, error_type, error) {
        if (response.status == 200) {
          var res = response.responseText
          var lines = $.grep(res.split("\n"), function(l, i) { return (l.match(/\,\d+\,\d+\,\d+\,\d+/) || l.match(/null,\d+,\d+/)) })
          var vals = $.map(lines, function(l) { return parseInt(l.split(',')[2]) })
          draftback.setRevisionCount(Math.max.apply(null, vals))
        } else if (response.status == 403) {
          draftback.disable()
        }
      },
      success: function(response) {
        console.log(response)
      }
    })
  },

  getChangelog: function() {
    var regmatch = location.href.match(/^(https:\/\/docs\.google\.com.*?\/document\/d\/)/)
    var baseUrl = regmatch[1]
    var docId = draftback.getDocId()
    var loadUrl = baseUrl + docId + "/revisions/load?id=" + docId + "&start=1&end=" + parseInt(('' + draftback.revisionCount).replace(/,/g, '')) + "&token=" + draftback.token

    $.ajax({
      type: "get",
      url: loadUrl,
      headers: {"x-same-domain": 1},
      error: function(response, error_type, error) {
        var res = response.responseText
        chrome.runtime.sendMessage({msg: 'changelog', docId: draftback.getDocId(), changelog: res}, function(response) {});
      },
      success: function(response) {
        console.log(response)
      }
    })
  }
})

$(document).ready(function() {
  var code = function() {
    document.getElementsByTagName('body')[0].setAttribute("tok", _docs_flag_initialData.info_params.token)
  };
  var script = document.createElement('script');
  script.textContent = '(' + code + ')()';
  (document.head||document.documentElement).appendChild(script);
  script.parentNode.removeChild(script);

  draftback.setToken($('body').attr('tok'))

  var $draftback_button = $('<div role="button" id="draftback" class="goog-inline-block jfk-button jfk-button-standard docs-titlebar-button" aria-disabled="false" aria-pressed="false" tabindex="0" data-tooltip="Play back this document\'s history" aria-label="Play back this document\'s history" value="undefined" style="-webkit-user-select: none;">Draftback (<span id="revision-count">' + (draftback.revisionCount || '<img src="https://cloud.githubusercontent.com/assets/21294/4969053/0b7748bc-6857-11e4-9985-89b361f919f8.gif"/>') + '</span> revs)</div>')
  $draftback_button.prependTo($('.docs-titlebar-buttons'))

  var $draftback_message = '<div id="draftback-message" style="display: none;"><span>Processing changelog...</span> <img src="https://cloud.githubusercontent.com/assets/21294/4968082/0933ba06-6832-11e4-9039-f5877fca316b.gif"/></div>'
  $draftback_button.before($draftback_message)

  $('#draftback').live('click', function() {
    if ($(this).attr('disabled') == 'disabled') return false
    $("#progress").removeClass('killed')
    chrome.runtime.sendMessage({msg: 'clear-killed', docId: draftback.getDocId()}, function(response) {});
    if ($('#draftback-box:visible').length) {
      $('#draftback-box').hide()
      $('#docs-docos-caret').hide().removeClass('draftbacked')
    } else {
      chrome.runtime.sendMessage({msg: 'get-last-revision', docId: draftback.getDocId()}, function(response) {
        if (response.seq > 0) {
          $('#existing-revisions-count').text(('' + parseInt(response.revno)).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"))
          $('#docs-docos-caret').show().addClass('draftbacked')
          $('#draftback-box').show()
        } else {
          $('#draftback-message').show()
          draftback.getChangelog()
        }
      })
    }
    return false
  })

  $('#draftback-box .docos-new-comment-button').live('click', function() {
    $('#draftback-box').hide()
    $('#docs-docos-caret').hide().removeClass('draftbacked')
    $("#progress").removeClass('killed')
    chrome.runtime.sendMessage({msg: 'clear-killed', docId: draftback.getDocId()}, function(response) {});

    switch($(this).attr('draftback-action')) {
      case 'rerender':
        $('#draftback-message').show();
        draftback.getChangelog();
        break;

      case 'playback':
        chrome.runtime.sendMessage({msg: 'preview', docId: draftback.getDocId()}, function(response) {});
        break;

      case 'delete':
        $('#draftback-message').show().find('span').text('Clearing existing revisions...');
        chrome.runtime.sendMessage({msg: 'delete', docId: draftback.getDocId()}, function(response) {});
        break;
    }

    return false
  })

  var $draftback_box = $('<div class="docs-docos-activitybox docos-enable-new-header" id="draftback-box" aria-label="Draftback box" tabindex="0" style="display: none;"> <div class="docs-docos-activitybox-inner" dir="ltr" style="text-align: left;"> <div class="docos docos-streampane-container docos-enable-docs-header" tabindex="0"> <div class="docos-streampane-content"> <div class="docos-streampane-header"> <div class="docos-new-comment-button jfk-button jfk-button-standard" role="button" data-tooltip="Play back the history Draftback has already rendered for this doc" aria-label="Play back the history Draftback has already rendered for this doc" draftback-action="playback" aria-disabled="false" tabindex="0" style="-webkit-user-select: none;"> <div class="docos-new-comment-icon docos-icon-insert-comment docos-icon"></div>Play <span id="existing-revisions-count">57</span> stored revisions </div><div class="docos-new-comment-button jfk-button jfk-button-standard" role="button" data-tooltip="Delete the revisions Draftback has stored for this doc" aria-label="Delete the revisions Draftback has stored for this doc" draftback-action="delete" aria-disabled="false" tabindex="0" style="-webkit-user-select: none;"> <div class="docos-new-comment-icon docos-icon-insert-comment docos-icon"></div>Delete </div><div class="docos-new-comment-button jfk-button jfk-button-standard" role="button" data-tooltip="Re-render revisions for this doc (if there are more to add, for instance)" aria-label="Re-render revisions for this doc (if there are more to add, for instance)" draftback-action="rerender" aria-disabled="false" tabindex="0" style="-webkit-user-select: none;"> <div class="docos-new-comment-icon docos-icon-insert-comment docos-icon"></div>Re-render </div> </div> </div> </div> </div> </div>')
  $draftback_box.appendTo($('body'))

  $('#draftback-box .docos-new-comment-button').live('mouseover', function() {
    $(this).addClass('jfk-button-hover')
  })

  $('#draftback-box .docos-new-comment-button').live('mouseout', function() {
    $(this).removeClass('jfk-button-hover')
  })

  var $modal = $('<div id="modal-overlay" style="display: none;">')
  $modal.appendTo($('body'))
  var truncatedDocId = draftback.getDocId()
  truncatedDocId = truncatedDocId.slice(0, 10) + '...' + truncatedDocId.slice(35, 45)
  var $progress = $('<div id="progress" style="display: none;"><div id="modal-box"><a href="#" id="modal-x"></a><h2 id="modal-title">Rendering Draftback for "' + draftback.getDocTitle() + '"</h2><div id="modal-content" style="height: auto;"><div><ol id="upload-files-list"><li class="upload-file"><div class="upload-progress-bar"></div><div class="upload-file-info"><div class="filename-col"><img src="https://cloud.githubusercontent.com/assets/21294/4967993/00bf782e-682d-11e4-93e7-106fcf26f6a0.gif" class="sprite sprite_web s_web_page_white_word"> <span class="filename">' + truncatedDocId + '</span> <span class="size">- <span id="so_far">0</span>/<span id="out_of">0</span> revs</span></div><div class="dest-col"><a href="#" class="dest">Preview</a></div><div class="status-col"></div><div class="time-col">estimating time left</div><br class="clear"></div></li></ol></div></div></div></div>')
  $progress.css("left", $(".kix-page:first").offset().left + 85)
  $progress.appendTo($('body'))

  $("a.dest").live('click', function() {
    chrome.runtime.sendMessage({msg: 'preview', docId: draftback.getDocId()}, function(response) {});
    return false;
  })

  $("#modal-x").live('click', function() {
    chrome.runtime.sendMessage({msg: 'kill', docId: draftback.getDocId()}, function(response) {});
    $("#modal-overlay").hide();
    $("#progress").addClass('killed').hide()
    return false
  })
})

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    switch(request.msg) {
      case 'token':
        draftback.setToken(request.token)

        break;
      case 'cleared':
        $('#draftback-message').hide().find('span').text('Processing changelog...')

        break;
      case 'clearing':
        $('#draftback-message').show().find('span').text('Clearing existing revisions...')

        break;
      case 'progress':
         if (!$('#progress').hasClass('killed')) {
           $("#progress").show()
           $("#modal-overlay").show()
         }

         draftback.updateProgress(request.so_far, request.out_of)

         break;
      default:
        console.log(request)
    }
  sendResponse("ok")
});