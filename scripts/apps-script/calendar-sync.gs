/**
 * Align: Google Calendar → Firestore sync (DESIGN.md §5.5).
 *
 * Runs in Google Apps Script (free) under the Google account that can see the family calendar.
 * Every hour it copies events into the "Family Calendar" family list as tasks. One-way: the calendar is the
 * source of truth for title, dates, time and location; status, priority, dependencies, etc. stay editable in Align.
 *
 * It signs in to Firebase as a dedicated household member (the "calendar bot"), so the normal security rules apply.
 *
 * Setup (see scripts/apps-script/README.md):
 *   Services → add "Google Calendar API" (identifier: Calendar). It gives each event, and each instance of a
 *   recurring event, an id that stays the same when the event moves.
 *   Project Settings → Script properties:
 *     CALENDAR_ID          e.g. abc123@group.calendar.google.com
 *     FIREBASE_API_KEY     the web app's apiKey
 *     FIREBASE_PROJECT_ID  align-a32c1
 *     BOT_EMAIL            the bot's Firebase Auth email
 *     BOT_PASSWORD         the bot's Firebase Auth password
 *   Optional: WEEKS_AHEAD (8), DAYS_BEHIND (7), LIST_NAME ("Family Calendar"), LIST_ID (found or created automatically)
 *   Then run installHourlyTrigger() once.
 */

var DEFAULTS = {
  WEEKS_AHEAD: '8',
  DAYS_BEHIND: '7',
  LIST_NAME: 'Family Calendar',
  AUTH_URL: 'https://identitytoolkit.googleapis.com/v1',
  FIRESTORE_URL: 'https://firestore.googleapis.com/v1',
}

// Fields the sync owns. Everything else on an imported task belongs to the family.
var SYNCED_FIELDS = ['title', 'startDate', 'durationDays', 'calendar']

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** Run once from the editor: replaces any existing trigger with an hourly one, then syncs. */
function installHourlyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) {
      return t.getHandlerFunction() === 'syncCalendar'
    })
    .forEach(function (t) {
      ScriptApp.deleteTrigger(t)
    })
  ScriptApp.newTrigger('syncCalendar').timeBased().everyHours(1).create()
  syncCalendar()
}

function syncCalendar() {
  var props = PropertiesService.getScriptProperties()
  var cfg = config_(props.getProperties())
  var now = new Date()
  var from = new Date(now.getTime() - Number(cfg.DAYS_BEHIND) * 86400000)
  var to = new Date(now.getTime() + Number(cfg.WEEKS_AHEAD) * 7 * 86400000)

  var events = []
  var tz = null
  var pageToken
  do {
    var page = Calendar.Events.list(cfg.CALENDAR_ID, {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: true, // one item per recurring instance
      maxResults: 2500,
      pageToken: pageToken,
    })
    tz = page.timeZone
    events = events.concat(page.items || [])
    pageToken = page.nextPageToken
  } while (pageToken)

  var fmt = {
    day: function (d) {
      return Utilities.formatDate(d, tz, 'yyyy-MM-dd')
    },
    time: function (d) {
      return Utilities.formatDate(d, tz, 'h:mm a')
    },
  }
  var api = firestoreApi_(cfg, signIn_(cfg))
  var list = ensureList_(api, cfg, props)
  var wanted = events
    .filter(function (ev) {
      return ev.status !== 'cancelled'
    })
    .map(function (ev) {
      return eventToTask_(ev, fmt)
    })
  var existing = api.query('tasks', [
    ['visibility', 'family'],
    ['listId', list.id],
  ])
  var plan = planSync_(wanted, existing, fmt.day(from), fmt.day(to))
  api.commit(buildWrites_(plan, list, api))
  console.log(
    'Synced ' + wanted.length + ' events: ' + plan.creates.length + ' new, ' + plan.updates.length + ' changed, ' + plan.deletes.length + ' removed.',
  )
  return plan
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in tests/apps-script/)
// ---------------------------------------------------------------------------

function config_(p) {
  var cfg = {}
  Object.keys(DEFAULTS).forEach(function (k) {
    cfg[k] = p[k] || DEFAULTS[k]
  })
  ;['CALENDAR_ID', 'FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID', 'BOT_EMAIL', 'BOT_PASSWORD'].forEach(function (k) {
    if (!p[k]) throw new Error('Missing script property ' + k + ' (Project Settings → Script properties).')
    cfg[k] = p[k]
  })
  cfg.LIST_ID = p.LIST_ID || ''
  return cfg
}

function daysBetween_(a, b) {
  var pa = a.split('-').map(Number)
  var pb = b.split('-').map(Number)
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000)
}

function addDays_(day, n) {
  var p = day.split('-').map(Number)
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10)
}

/**
 * A Calendar API event as task fields. The event id is stable when the event moves, so family edits survive.
 * All-day events use plain dates with an exclusive end; timed events are shown in the calendar's zone.
 */
function eventToTask_(ev, fmt) {
  var allDay = !!ev.start.date
  var startDate, lastDay
  var calendar = { eventId: ev.id }
  if (allDay) {
    startDate = ev.start.date
    lastDay = ev.end && ev.end.date > startDate ? addDays_(ev.end.date, -1) : startDate
  } else {
    var start = new Date(ev.start.dateTime)
    var end = new Date(ev.end.dateTime)
    startDate = fmt.day(start)
    lastDay = end > start ? fmt.day(new Date(end.getTime() - 1)) : startDate
    calendar.time = fmt.time(start) + '–' + fmt.time(end)
  }
  if (ev.location) calendar.location = ev.location
  return {
    docId: 'gcal_' + ev.id.replace(/[^A-Za-z0-9_@.-]/g, '_'),
    fields: {
      title: ev.summary || '(no title)',
      startDate: startDate,
      durationDays: Math.max(1, daysBetween_(startDate, lastDay) + 1),
      calendar: calendar,
    },
  }
}

function sameSynced_(a, b) {
  return SYNCED_FIELDS.every(function (f) {
    return JSON.stringify(a[f]) === JSON.stringify(b[f])
  })
}

/**
 * What to write. `existing` is [{ id, fields }] for tasks in the list. Imported tasks whose event disappeared are
 * deleted only inside the sync window, so past history stays. Tasks family members added by hand are never touched.
 */
function planSync_(wanted, existing, windowStart, windowEnd) {
  var byId = {}
  existing.forEach(function (d) {
    byId[d.id] = d
  })
  var seen = {}
  var plan = { creates: [], updates: [], deletes: [] }
  wanted.forEach(function (w) {
    if (seen[w.docId]) return
    seen[w.docId] = true
    var have = byId[w.docId]
    if (!have) plan.creates.push(w)
    else if (!sameSynced_(have.fields, w.fields)) plan.updates.push(w)
  })
  existing.forEach(function (d) {
    var f = d.fields
    if (!f.calendar || seen[d.id]) return
    if (f.startDate >= windowStart && f.startDate <= windowEnd) plan.deletes.push(d.id)
  })
  return plan
}

/** JS value → Firestore REST Value. Undefined object fields are skipped. */
function toValue_(v) {
  if (v === null) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue_) } }
  return { mapValue: { fields: toFields_(v) } }
}

function toFields_(obj) {
  var out = {}
  Object.keys(obj).forEach(function (k) {
    if (obj[k] !== undefined) out[k] = toValue_(obj[k])
  })
  return out
}

/** Firestore REST Value → JS value (only the types Align stores). */
function fromValue_(v) {
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue' in v) return null
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue_)
  if ('mapValue' in v) return fromFields_(v.mapValue.fields || {})
  return undefined
}

function fromFields_(fields) {
  var out = {}
  Object.keys(fields).forEach(function (k) {
    out[k] = fromValue_(fields[k])
  })
  return out
}

/** Commit writes: creates carry the full task (with the list's copied fields); updates touch only synced fields. */
function buildWrites_(plan, list, api) {
  var stamp = [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }]
  var writes = []
  plan.creates.forEach(function (w) {
    var task = {
      listId: list.id,
      visibility: list.visibility,
      ownerId: list.ownerId,
      viewerVisible: list.viewerVisible,
      priority: 2,
      status: 'todo',
      context: list.defaultContext || 'family',
      dependsOn: [],
      createdBy: api.uid,
    }
    Object.keys(w.fields).forEach(function (k) {
      task[k] = w.fields[k]
    })
    writes.push({
      update: { name: api.docName('tasks/' + w.docId), fields: toFields_(task) },
      currentDocument: { exists: false },
      updateTransforms: stamp.concat([{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }]),
    })
  })
  plan.updates.forEach(function (w) {
    writes.push({
      update: { name: api.docName('tasks/' + w.docId), fields: toFields_(w.fields) },
      updateMask: { fieldPaths: SYNCED_FIELDS },
      currentDocument: { exists: true },
      updateTransforms: stamp,
    })
  })
  plan.deletes.forEach(function (id) {
    writes.push({ delete: api.docName('tasks/' + id) })
  })
  return writes
}

// ---------------------------------------------------------------------------
// Firebase REST (UrlFetchApp)
// ---------------------------------------------------------------------------

function http_(method, url, body, token) {
  var options = { method: method, contentType: 'application/json', muteHttpExceptions: true, headers: {} }
  if (body !== undefined) options.payload = JSON.stringify(body)
  if (token) options.headers.Authorization = 'Bearer ' + token
  var res = UrlFetchApp.fetch(url, options)
  var code = res.getResponseCode()
  var text = res.getContentText()
  if (code >= 300) throw new Error(method + ' ' + url.split('?')[0] + ' failed (' + code + '): ' + text)
  return text ? JSON.parse(text) : {}
}

function signIn_(cfg) {
  var res = http_('post', cfg.AUTH_URL + '/accounts:signInWithPassword?key=' + encodeURIComponent(cfg.FIREBASE_API_KEY), {
    email: cfg.BOT_EMAIL,
    password: cfg.BOT_PASSWORD,
    returnSecureToken: true,
  })
  return { token: res.idToken, uid: res.localId }
}

function firestoreApi_(cfg, auth) {
  var root = 'projects/' + cfg.FIREBASE_PROJECT_ID + '/databases/(default)/documents'
  var base = cfg.FIRESTORE_URL + '/' + root
  return {
    uid: auth.uid,
    docName: function (path) {
      return root + '/' + path
    },
    get: function (path) {
      try {
        var d = http_('get', base + '/' + path, undefined, auth.token)
        return { id: d.name.split('/').pop(), fields: fromFields_(d.fields || {}) }
      } catch (e) {
        if (String(e.message).indexOf('(404)') >= 0) return null
        throw e
      }
    },
    create: function (collection, data) {
      var d = http_('post', base + '/' + collection, { fields: toFields_(data) }, auth.token)
      return d.name.split('/').pop()
    },
    /** Equality filters only; they must match the security rules (e.g. visibility == "family"). */
    query: function (collection, equals) {
      var filters = equals.map(function (e) {
        return { fieldFilter: { field: { fieldPath: e[0] }, op: 'EQUAL', value: toValue_(e[1]) } }
      })
      var res = http_(
        'post',
        base + ':runQuery',
        { structuredQuery: { from: [{ collectionId: collection }], where: { compositeFilter: { op: 'AND', filters: filters } } } },
        auth.token,
      )
      return res
        .filter(function (r) {
          return r.document
        })
        .map(function (r) {
          return { id: r.document.name.split('/').pop(), fields: fromFields_(r.document.fields || {}) }
        })
    },
    commit: function (writes) {
      // A commit holds at most 500 writes.
      for (var i = 0; i < writes.length; i += 400) {
        http_('post', base + ':commit', { writes: writes.slice(i, i + 400) }, auth.token)
      }
    },
  }
}

/** Finds the target list (LIST_ID, or a family list named LIST_NAME), creating it if needed. */
function ensureList_(api, cfg, props) {
  var list = null
  if (cfg.LIST_ID) {
    try {
      list = api.get('lists/' + cfg.LIST_ID)
    } catch (e) {
      // The rules answer 403 rather than 404 for a deleted list; fall back to finding or creating it.
      list = null
    }
  }
  if (!list) {
    var match = api.query('lists', [['visibility', 'family']]).filter(function (l) {
      return l.fields.name === cfg.LIST_NAME
    })[0]
    if (match) {
      list = match
    } else {
      var id = api.create('lists', {
        name: cfg.LIST_NAME,
        kind: 'list',
        visibility: 'family',
        ownerId: api.uid,
        viewerVisible: false,
        defaultContext: 'family',
      })
      list = api.get('lists/' + id)
    }
    props.setProperty('LIST_ID', list.id)
  }
  var f = list.fields
  return { id: list.id, visibility: f.visibility, ownerId: f.ownerId, viewerVisible: f.viewerVisible, defaultContext: f.defaultContext }
}
