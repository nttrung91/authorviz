var $ = jQuery.noConflict()

var draftback = {}

draftback.indexedDB = {}
draftback.indexedDB.db = null

draftback.pendingRevisions = {}

draftback.getParameterByName = function(url, name) {
  var match = RegExp('[?&]' + name + '=([^&]*)').exec(url);
  return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

draftback.addPendingRevision = function(data, requestId) {
  draftback.pendingRevisions[requestId] = data
}

draftback.getPendingRevision = function(requestId) {
  return draftback.pendingRevisions[requestId]
}

draftback.deletePendingRevision = function(requestId) {
  delete draftback.pendingRevisions[requestId]
}

Array.prototype.insert = function(element, index) {
  this.splice(index, 0, element)
}

Array.prototype.delete = function(startIndex, endIndex) {
  return this.splice(startIndex, (endIndex - startIndex) + 1)
}

draftback.kills = {}

draftback.shouldKill = function(docId) {
  if (draftback.kills[docId]) {
    delete draftback.kills[docId]
    return true
  } else {
    return false
  }
}

draftback.autoincrements = {}
draftback.windows = {}

draftback.render = function(characters, entry, builder, cllbck) {
  var character_limit = 1000 // Magic number change in two places
  var slop = 500
  var should_change_viewing_window_to = false
  var old_window = draftback.windows[builder.docId]
  var current_window_start_i = old_window[0]
  var current_window_end_i = old_window[1]

  char_length = characters.length

  if (entry['ty'] == "is") {
    var start_i = entry['ibi'] - 1
    var end_i = start_i + entry['s'].length
  } else if (entry['ty'] == "ds") {
    var start_i = entry['si'] - 1
    var end_i = entry['ei']
  }

  if (current_window_end_i - current_window_start_i > character_limit + slop) {
    current_window_start_i += slop / 2
    current_window_end_i -= slop / 2
  }

  if (end_i - start_i > character_limit) {
    var left_cut = current_window_start_i
    var right_cut = current_window_end_i
  } else {
    if (start_i < current_window_start_i) {
      var new_start = Math.max(start_i - 100, 0)
      draftback.windows[builder.docId] = [new_start, new_start + character_limit]
    } else if (end_i > current_window_end_i) {
      var new_end = Math.min(end_i + 100, char_length - 1)
      draftback.windows[builder.docId] = [new_end - character_limit, new_end]
    } else {
      if (entry['ty'] == "is") {
        draftback.windows[builder.docId] = [current_window_start_i, current_window_end_i + entry['s'].length]
      } else if (entry['ty'] == "ds") {
        should_change_viewing_window_to = [current_window_start_i, current_window_end_i - (end_i - start_i)]
      }
    }
  }
  var builder_viewing_window = draftback.windows[builder.docId]
  var left_cut = builder_viewing_window[0]
  var right_cut = builder_viewing_window[1]

  var html = ""

  if (char_length < 35000) {
    html = "<div class='progress'><p>"
    $.each(characters, function(i, char) {
      if (!char) return true

      if (i == left_cut) {
        html += "<div class='window'><p>"
      }
      if (i == start_i) {
        html += (entry['ty'] == "is" ? "<ins>" : "<del>")
      }
      if (char.s == "\n") {
        html += "</p><p>"
      } else {
        html += char.s
      }
      if (i == end_i) {
        html += (entry['ty'] == "is" ? "</ins>" : "</del>")
      }
      if (i == right_cut || i == char_length - 1) {
        html += "</p></div>"
      }
    })
    html += "</p></div>"
    html = html.replace(/<p><\/p>/g, "<p>&nbsp;</p>")
  }

  html += "<div class='content'>"

  var delta_start_point = start_i - left_cut
  var delta_end_point = end_i - left_cut

  $.each(characters.slice(left_cut, right_cut + 1), function(i, char) {
    if (!char) return true

    if (i == delta_start_point) {
      html += (entry['ty'] == "is" ? "<ins>" : "<del>")
    }

    if (char.s == "\n") {
      html += "<br>"
    } else {
      html += char.s
    }

    if (i == delta_end_point) {
      html += (entry['ty'] == "is" ? "</ins>" : "</del>")
    }
  })

  html += "</div>";

  if (should_change_viewing_window_to) {
    draftback.windows[builder.docId] = should_change_viewing_window_to
  }

  var rev = {
    seq: draftback.autoincrements[builder.docId]++,
    docId: builder.docId,
    rendered: html,
    timestamp: entry.timestamp,
    revno: entry.revno
  }
  draftback.indexedDB.addRevision(rev, cllbck)
}

draftback.buildRevisions = function(docId, raw_revisions) {
  chrome.tabs.query({url: '*://docs.google.com/*/' + docId + '/edit'}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {msg: 'clearing'}, function(response) {});
  });

  draftback.clearAllRevisionsByDocId(docId, function() {
    chrome.tabs.query({url: '*://docs.google.com/*/' + docId + '/edit'}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {msg: 'cleared'}, function(response) {});
    });

    var raw = raw_revisions.split("\n").pop()
    var changelog = JSON.parse(raw).changelog
    var totalChangelogSize = changelog.length
    var characters = []
    draftback.autoincrements[docId] = 0
    draftback.windows[docId] = [0, 1000] // Magic number change in two places

    var handlers = {
      'is': function insert(data) {
        // console.log('is')
        var insertBeginIndex = data.ibi,
              stringToInsert = data.s

        var charactersToInsert = $.map(stringToInsert, function(s, i) { return {"s": s} })

        for (var i = 0; i < stringToInsert.length; i++) {
          characters.insert(charactersToInsert[i], (insertBeginIndex - 1) + i)
        }
      },
      'ds': function del(data) {
        // console.log('ds')
        var deleteStartIndex = data.si,
              deleteEndIndex = data.ei

        var deleted = characters.delete(deleteStartIndex - 1, deleteEndIndex - 1)
      },
      'mlti': function multi(data, clb) {
        var i = 0
        async.eachSeries(data.mts, function(subcmd, mlticb) {
          if (!subcmd.revno) subcmd.revno = [data.revno, i].join('-')
          subcmd.timestamp = data.timestamp
          dispatch(subcmd, mlticb)
          i++
        }, function() { clb() })
      }
    }

    var dispatch = function(ent, theCallback) {
      var handler = handlers[ent.ty]

      if (handler) {
        if (ent.ty == 'is') {
          handler(ent)
          draftback.render(characters, ent, {docId: docId}, theCallback)
        } else if (ent.ty == 'ds') {
          draftback.render(characters, ent, {docId: docId}, theCallback)
          handler(ent)
        } else if (ent.ty == 'mlti') {
          handler(ent, theCallback)
        }
      } else {
        theCallback()
      }
    }

    var it = 0
    async.eachSeries(changelog, function(ce, theTopCallback) {
      console.log(it);
      if (draftback.shouldKill(docId)) return
      var entry = $.extend(ce[0], {timestamp: ce[1], uid: ce[2], revno: ce[3]})
      dispatch(entry, theTopCallback)

      chrome.tabs.query({url: '*://docs.google.com/*/' + docId + '/edit'}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {msg: 'progress', so_far: (it + 1), out_of: totalChangelogSize}, function(response) {});
      });

      it++
    })
  })
}

draftback.indexedDB.open = function() {
  var version = 4
  var request = indexedDB.open("revisions", version)

  request.onupgradeneeded = function(e) {
    var db = e.target.result

    e.target.transaction.onerror = draftback.indexedDB.onerror

    if (db.objectStoreNames.contains("revision")) {
      db.deleteObjectStore("revision")
    }

    var store = db.createObjectStore("revision", { autoIncrement: true })

    store.createIndex("docseq", ["docId", "seq"], { unique: false })
  }

  request.onsuccess = function(e) {
    draftback.indexedDB.db = e.target.result
  }

  request.onerror = draftback.indexedDB.onerror
}

draftback.indexedDB.addRevision = function(data, cb) {
  var db = draftback.indexedDB.db
  var trans = db.transaction(["revision"], "readwrite")
  var store = trans.objectStore("revision")

  var request = store.put(data)

  request.onsuccess = function(e) {
    // console.log('commit to db')
    cb()
  }

  request.onerror = function(e) {
    console.log(e.value)
  }
}

draftback.indexedDB.getAllRevisions = function() {
  var db = draftback.indexedDB.db
  var trans = db.transaction(["revision"], "readwrite")
  var store = trans.objectStore("revision")

  var keyRange = IDBKeyRange.lowerBound(0)
  var cursorRequest = store.openCursor(keyRange)

  cursorRequest.onsuccess = function(e) {
    var result = e.target.result
    if(!!result == false)
      return

    result.continue()
  }

  cursorRequest.onerror = draftback.indexedDB.onerror
}

draftback.indexedDB.lastRevisionByDocId = function(docId, callback) {
  var db = draftback.indexedDB.db
  var trans = db.transaction(["revision"], "readonly")
  var store = trans.objectStore("revision")
  var index = store.index("docseq")

  var lowerBound = [docId, 0]
  var upperBound = [docId, Number.MAX_VALUE]
  var range = IDBKeyRange.bound(lowerBound, upperBound)

  var openCursorRequest = index.openCursor(range, 'prev')
  var maxRevisionObject = null

  openCursorRequest.onsuccess = function(event) {
    if (event.target.result) {
      maxRevisionObject = event.target.result.value;
      callback(maxRevisionObject)
    } else {
      callback({docId: docId, seq: 0})
    }
  }

  openCursorRequest.onerror = draftback.indexedDB.onerror
}

draftback.indexedDB.getRevisionsByDocIdWithOffsetAndLimit = function(docId, offset, limit, cb) {
  var db = draftback.indexedDB.db
  var trans = db.transaction(["revision"], "readwrite") // FIXME: this should be readonly? as should some others?
  var store = trans.objectStore("revision")
  var index = store.index("docseq")

  var lowerBound = [docId, offset]
  var upperBound = [docId, offset + limit]
  var range = IDBKeyRange.bound(lowerBound, upperBound)

  var array = []
  var cursorRequest = index.openCursor(range, 'next')

  cursorRequest.onsuccess = function(event) {
    var cursor = event.target.result
    if (cursor) {
      array.push(cursor.value)
      cursor.continue()
    } else if (cb) {
      cb(array)
    }
  }

  cursorRequest.onerror = draftback.indexedDB.onerror
  return array
}

draftback.indexedDB.clearAllRevisions = function() {
  var db = draftback.indexedDB.db
  var trans = db.transaction(["revision"], "readwrite")
  var store = trans.objectStore("revision")

  var request = store.clear()

  request.onsuccess = function(e) {
    console.log('successfully cleared revisions')
  }

  request.onerror = function(e) {
    console.log(e);
  }
}

draftback.clearAllRevisionsByDocId = function(docId, callback) {
  draftback.indexedDB.lastRevisionByDocId(docId, function(rev) {
    draftback.indexedDB.clearAllRevisionsByDocId(docId, rev.seq, callback)
  });
}

draftback.indexedDB.clearAllRevisionsByDocId = function(docId, upper, cb) {
  var db = draftback.indexedDB.db
  var trans = db.transaction(["revision"], "readwrite")
  var store = trans.objectStore("revision")
  var index = store.index("docseq")

  var lowerBound = [docId, 0]
  var upperBound = [docId, upper]
  var range = IDBKeyRange.bound(lowerBound, upperBound)

  var pdestroy = index.openKeyCursor(range)
  pdestroy.onsuccess = function() {
    var cursor = pdestroy.result
    if (cursor) {
      store.delete(cursor.primaryKey)
      cursor.continue()
    } else if (cb) {
      cb()
    }
  }
}

function initDB() {
  draftback.indexedDB.open()
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    switch(request.msg) {
      case 'changelog':
        draftback.buildRevisions(request.docId, request.changelog)

        sendResponse('ok')
        break;
      case 'get-revisions':
        draftback.indexedDB.getRevisionsByDocIdWithOffsetAndLimit(request.docId, request.offset, request.limit, function(revs) {
          sendResponse($.map(revs, function(r, i) { return {timestamp: r.timestamp, content: r.rendered, revno: r.revno} }))
        });
        return true;

        break;

      case 'get-last-revision':
        draftback.indexedDB.lastRevisionByDocId(request.docId, function(rev) {
          sendResponse(rev)
        });
        return true;

        break;

      case 'kill':
        draftback.kills[request.docId] = true
        break;

      case 'clear-killed':
        delete draftback.kills[request.docId]
        break;

      case 'delete':
        draftback.clearAllRevisionsByDocId(request.docId, function() {
          chrome.tabs.query({url: '*://docs.google.com/*/' + request.docId + '/edit'}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {msg: 'cleared'}, function(response) {});
          });
        })
        break;

      case 'preview':
        chrome.tabs.create({url: "/playback.html?docId=" + request.docId})
        break;
      default:
        console.log(request)
    }
});

window.addEventListener("DOMContentLoaded", initDB, false)

// Playback memes:
// - Suppose each letter were tagged with the revision that introduced it. Then could we highlight a phrase and ask where it came from? And watch its playback? What would that even mean, for paragraphs that were composites?

// What if all *contiguous* edits were compiled into little playback streams, and clicking any one of those contiguous revisions would take you to that stream, which would be like its origin story?

// Every letter has "the set of all revisions which touched me"?

// Export to CSV.

// Migrate to an event page: https://developer.chrome.com/extensions/event_pages.