/**
 * Align: Google Calendar → Firestore sync (DESIGN.md §5.5).
 *
 * Runs in Google Apps Script (free) under the Google account that can see the family calendar.
 * Every 15 minutes (and when someone taps "Refresh calendar" in Align) it copies events into the "Family Calendar" family list as tasks. One-way: the calendar is the
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
 *   Family map alerts (optional, scripts/location/README.md): FCM_SERVICE_ACCOUNT, ALIGN_URL.
 *   Optional: WEEKS_AHEAD (8), DAYS_BEHIND (7), LIST_NAME ("Family Calendar"), LIST_ID (found or created automatically),
 *   TIME_ZONE (e.g. America/New_York; defaults to the script's zone from appsscript.json)
 *   Then run installTrigger() once.
 *   Optional "Refresh calendar" button: Deploy → New deployment → Web app (execute as me, anyone can access), and put
 *   the web app URL in Align's VITE_CALENDAR_SYNC_URL. See the README.
 */

var SYNC_EVERY_MINUTES = 15
// A manual refresh within this many seconds of the last one is skipped (the button can't be used to hammer the sync).
var MANUAL_COOLDOWN_SECONDS = 60

var DEFAULTS = {
  WEEKS_AHEAD: '8',
  DAYS_BEHIND: '7',
  LIST_NAME: 'Family Calendar',
  AUTH_URL: 'https://identitytoolkit.googleapis.com/v1',
  FIRESTORE_URL: 'https://firestore.googleapis.com/v1',
  FCM_URL: 'https://fcm.googleapis.com/v1',
}

// Fields the sync owns. Everything else on an imported task belongs to the family.
var SYNCED_FIELDS = ['title', 'startDate', 'durationDays', 'calendar']

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** Run once from the editor: replaces any existing sync trigger with one every SYNC_EVERY_MINUTES, then syncs. */
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) {
      return t.getHandlerFunction() === 'syncCalendar'
    })
    .forEach(function (t) {
      ScriptApp.deleteTrigger(t)
    })
  ScriptApp.newTrigger('syncCalendar').timeBased().everyMinutes(SYNC_EVERY_MINUTES).create()
  syncCalendar()
}

/** The old name, from when it synced hourly. Kept so earlier setup steps still work. */
function installHourlyTrigger() {
  installTrigger()
}

/** The trigger's entry point. One sync at a time: a scheduled run and a "Refresh calendar" tap could overlap. */
function syncCalendar() {
  var lock = LockService.getScriptLock()
  if (!lock.tryLock(30000)) throw new Error('Another calendar sync is still running.')
  try {
    return sync_()
  } finally {
    lock.releaseLock()
  }
}

/**
 * Web app entry point for Align's "Refresh calendar" button. Align posts {"idToken": <the user's Firebase ID token>}
 * as text/plain (a "simple" request, so the browser sends no CORS preflight). Only household members can trigger it.
 */
function doPost(e) {
  var result
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}')
    if (e && e.parameter && e.parameter.loc) result = location_(e.parameter.loc, body)
    else if (body.action === 'locationKey') result = locationKey_(body.idToken)
    else result = body.voice ? voice_(body) : manualSync_(body.idToken)
  } catch (err) {
    result = { ok: false, error: String((err && err.message) || err) }
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON)
}

function manualSync_(idToken) {
  if (!idToken) return { ok: false, error: 'Not signed in.' }
  var cfg = config_(PropertiesService.getScriptProperties().getProperties())
  var uid = verifyIdToken_(cfg, idToken)
  if (!uid) return { ok: false, error: 'Your sign-in could not be checked. Reload Align and try again.' }
  var household = firestoreApi_(cfg, signIn_(cfg)).get('household/main')
  var members = (household && household.fields.members) || {}
  if (!members[uid]) return { ok: false, error: 'Only household members can refresh the calendar.' }
  var cache = CacheService.getScriptCache()
  if (cache.get('manualSync')) return { ok: true, skipped: true }
  cache.put('manualSync', '1', MANUAL_COOLDOWN_SECONDS)
  var plan = syncCalendar()
  return { ok: true, created: plan.creates.length, updated: plan.updates.length, removed: plan.deletes.length }
}

// ---- Voice (the Align Alexa skill: scripts/alexa) ----

/**
 * "Alexa, ask sir georgie to add buy milk" / "…to add milk to groceries" / "…what's on today". The skill posts
 * {voice: true, secret, action: "add" | "today", text}. The secret (Script Property VOICE_SECRET, also in the skill's
 * code) keeps strangers out. "… to <list>" adds to that family list (a task list, project or checklist, no date);
 * otherwise it goes to the "Family Inbox", due today. The script writes as its calendar-helper member.
 */
function voice_(body) {
  var props = PropertiesService.getScriptProperties()
  var cfg = config_(props.getProperties())
  var secret = props.getProperty('VOICE_SECRET')
  if (!secret || body.secret !== secret) return { ok: false, speech: 'Align didn’t recognize this Alexa skill. Check the voice secret.' }
  var tz = cfg.TIME_ZONE || Session.getScriptTimeZone()
  var day = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd')
  var api = firestoreApi_(cfg, signIn_(cfg))
  if (body.action === 'add') {
    var lists = api.query('lists', [['visibility', 'family']])
    var target = voiceTarget_(body.text, lists)
    if (target && target.list.fields.name === 'Family Inbox') target = { text: target.text, list: null } // due today, as usual
    var title = voiceTitle_(target ? target.text : body.text)
    if (!title) return { ok: false, speech: 'What should I add?' }
    if (target && target.list) {
      api.create('tasks', voiceTaskFields_(voiceList_(target.list), title, null, api.uid))
      return { ok: true, speech: 'Added ' + title + ' to ' + target.list.fields.name + '.' }
    }
    api.create('tasks', voiceTaskFields_(voiceInbox_(api, lists), title, day, api.uid))
    return { ok: true, speech: 'Added ' + title + ' to the Family Inbox, for today.' }
  }
  if (body.action === 'today') {
    var seen = {}
    var all = []
    ;[['startDate', day], ['targetDate', day]].forEach(function (q) {
      api.query('tasks', [['visibility', 'family'], q]).forEach(function (t) {
        if (!seen[t.id]) {
          seen[t.id] = true
          all.push(t.fields)
        }
      })
    })
    return { ok: true, speech: voiceSummary_(all) }
  }
  return { ok: false, speech: 'You can say: add buy milk, add milk to groceries, or what’s on today.' }
}

// ---- Location (the family map: OwnTracks on each phone posts here; scripts/location/README.md) ----

// Keep this much of each person's trail (the map draws the last day).
var TRAIL_HOURS = 24
var TRAIL_POINTS = 100

/** The signing secret for personal location links: LOCATION_SECRET, or else VOICE_SECRET. */
function locationSecret_(props) {
  return props.getProperty('LOCATION_SECRET') || props.getProperty('VOICE_SECRET') || ''
}

/** "uid.signature": a personal key only this script can make (an HMAC of the uid), so a phone can't post for anyone else. */
function locationKeyFor_(uid, secret) {
  var sig = Utilities.computeHmacSha256Signature('location:' + uid, secret)
    .map(function (b) {
      return ('0' + (b & 255).toString(16)).slice(-2)
    })
    .join('')
  return uid + '.' + sig.slice(0, 32)
}

/** The uid in a personal key, or null when the signature doesn't match. */
function locationUid_(key, secret) {
  var uid = String(key || '').split('.')[0]
  return uid && secret && locationKeyFor_(uid, secret) === key ? uid : null
}

/** Align asks for the signed-in member's personal key (for their OwnTracks link). */
function locationKey_(idToken) {
  if (!idToken) return { ok: false, error: 'Not signed in.' }
  var props = PropertiesService.getScriptProperties()
  var cfg = config_(props.getProperties())
  var secret = locationSecret_(props)
  if (!secret) return { ok: false, error: 'Location sharing isn’t set up in the Apps Script (add VOICE_SECRET or LOCATION_SECRET).' }
  var uid = verifyIdToken_(cfg, idToken)
  if (!uid) return { ok: false, error: 'Your sign-in could not be checked. Reload Align and try again.' }
  var household = firestoreApi_(cfg, signIn_(cfg)).get('household/main')
  var me = ((household && household.fields.members) || {})[uid]
  if (!me || me.role !== 'member' || me.bot) return { ok: false, error: 'Only household members can share their location.' }
  return { ok: true, key: locationKeyFor_(uid, secret) }
}

/**
 * One OwnTracks report ({_type: "location", lat, lon, acc, batt, tst, …}) for the person in the key: becomes their
 * locations/{uid} document (latest point plus a day's trail). Paused people (off) aren't updated. OwnTracks expects
 * a JSON array back.
 */
function location_(key, body) {
  var props = PropertiesService.getScriptProperties()
  var uid = locationUid_(key, locationSecret_(props))
  if (!uid) return { ok: false, error: 'Unknown location link.' }
  var point = locationPoint_(body)
  if (!point) return []
  var cfg = config_(props.getProperties())
  var api = firestoreApi_(cfg, signIn_(cfg))
  var before = api.get('locations/' + uid)
  if (before && before.fields.off) return []
  var prev = before && before.fields
  var doc = locationDoc_(prev, point)
  var places = api.all('places')
  var late = !!prev && typeof prev.lat === 'number' && point.tst < prev.tst
  var change = placeChanges_(prev, late ? null : point, places)
  doc.inside = change.inside
  doc.events = ((prev && prev.events) || []).concat(change.events).slice(-20)
  api.commit([{ update: { name: api.docName('locations/' + uid), fields: toFields_(doc) }, updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] }])
  if (change.events.length) {
    try {
      sendAlerts_(cfg, api, uid, change.events)
    } catch (err) {
      console.log('Alerts failed: ' + err)
    }
  }
  return []
}

// ---- Places (geofences) and alerts ----

/** Meters between two points (haversine). */
function distanceM_(lat1, lon1, lat2, lon2) {
  var r = 6371000
  var rad = Math.PI / 180
  var dLat = (lat2 - lat1) * rad
  var dLon = (lon2 - lon1) * rad
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Which places someone is in after a report, and the arrivals / departures since the last one. Leaving needs a
 * margin beyond the radius (the GPS accuracy, 30–150 m) so a fix wobbling at the edge doesn't flap. No events on
 * the first report, for a place added since the last report, or from a fix worse than 500 m (state just carries
 * on). `point` null (a late, older report): nothing changes.
 */
function placeChanges_(prev, point, places) {
  var was = (prev && prev.inside) || []
  var known = {}
  places.forEach(function (p) {
    known[p.id] = true
  })
  if (!point) return { inside: was.filter(function (id) { return known[id] }), events: [] }
  var first = !prev || typeof prev.lat !== 'number'
  if (!first && point.acc !== undefined && point.acc > 500) return { inside: was.filter(function (id) { return known[id] }), events: [] }
  var margin = Math.max(30, Math.min(point.acc || 0, 150))
  var inside = []
  var events = []
  places.forEach(function (p) {
    var f = p.fields
    var d = distanceM_(point.lat, point.lon, f.lat, f.lon)
    var wasIn = was.indexOf(p.id) >= 0
    var isNew = first || (f.createdAt && Date.parse(f.createdAt) > prev.tst)
    var nowIn = wasIn && !isNew ? d <= f.radius + margin : d <= f.radius
    if (nowIn) inside.push(p.id)
    if (!isNew && nowIn !== wasIn) events.push({ place: p.id, name: f.name, kind: nowIn ? 'enter' : 'leave', tst: point.tst })
  })
  return { inside: inside, events: events }
}

/** Who wants to hear about this: alertPrefs whose rules match the person, place and kind (never yourself). */
function alertTargets_(prefs, personUid, event) {
  return prefs.filter(function (p) {
    if (p.id === personUid) return false
    return (p.fields.rules || []).some(function (r) {
      return (r.person === '*' || r.person === personUid) && (r.place === '*' || r.place === event.place) && !!r[event.kind]
    })
  })
}

/** "Daughter arrived at School" / "Daughter left School", with the time in the calendar's zone. */
function alertText_(name, event, tz) {
  return {
    title: name + (event.kind === 'enter' ? ' arrived at ' : ' left ') + event.name,
    body: Utilities.formatDate(new Date(event.tst), tz, 'h:mm a') + ' · Align family map',
  }
}

function sendAlerts_(cfg, api, uid, events) {
  var prefs = api.all('alertPrefs')
  if (!prefs.length) return
  var household = api.get('household/main')
  var name = (((household && household.fields.members) || {})[uid] || {}).displayName || 'Someone'
  var tz = cfg.TIME_ZONE || Session.getScriptTimeZone()
  events.forEach(function (ev) {
    var text = alertText_(name, ev, tz)
    alertTargets_(prefs, uid, ev).forEach(function (p) {
      ;(p.fields.push || []).forEach(function (token) {
        try {
          sendPush_(cfg, token, text, ev.place + ':' + uid)
        } catch (err) {
          console.log('Push failed: ' + err)
        }
      })
      if (p.fields.emailOn && p.fields.email) {
        try {
          MailApp.sendEmail(p.fields.email, text.title, text.body + (cfg.ALIGN_URL ? '\n\n' + cfg.ALIGN_URL.replace(/#.*$/, '') + '#/map' : ''))
        } catch (err) {
          console.log('Email failed: ' + err)
        }
      }
    })
  })
}

/** One notification through Firebase Cloud Messaging (HTTP v1), as data the app's service worker shows. */
function sendPush_(cfg, token, text, tag) {
  var access = fcmAccessToken_(cfg)
  if (!access) return
  http_(
    'post',
    cfg.FCM_URL + '/projects/' + cfg.FIREBASE_PROJECT_ID + '/messages:send',
    { message: { token: token, data: { title: text.title, body: text.body, url: '#/map', tag: tag }, webpush: { headers: { Urgency: 'high', TTL: '3600' } } } },
    access,
  )
}

/**
 * An OAuth token for FCM from the service account in FCM_SERVICE_ACCOUNT (the JSON key from Firebase → Project
 * settings → Service accounts), cached for 50 minutes. No key, no push (email still works).
 */
function fcmAccessToken_(cfg) {
  var cache = CacheService.getScriptCache()
  var cached = cache.get('fcmToken')
  if (cached) return cached
  if (!cfg.FCM_SERVICE_ACCOUNT) return null
  var sa = JSON.parse(cfg.FCM_SERVICE_ACCOUNT)
  var now = Math.floor(Date.now() / 1000)
  var b64 = function (s) {
    return Utilities.base64EncodeWebSafe(s).replace(/=+$/, '')
  }
  var aud = sa.token_uri || 'https://oauth2.googleapis.com/token'
  var unsigned = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: aud, iat: now, exp: now + 3600 }))
  var jwt = unsigned + '.' + Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(unsigned, sa.private_key)).replace(/=+$/, '')
  var res = UrlFetchApp.fetch(aud, { method: 'post', payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }, muteHttpExceptions: true })
  if (res.getResponseCode() >= 300) throw new Error('FCM sign-in failed (' + res.getResponseCode() + '): ' + res.getContentText())
  var token = JSON.parse(res.getContentText()).access_token
  cache.put('fcmToken', token, 3000)
  return token
}

/** The parts of an OwnTracks location message Align keeps, or null for anything else (waypoints, status…). */
function locationPoint_(m) {
  if (!m || m._type !== 'location' || typeof m.lat !== 'number' || typeof m.lon !== 'number') return null
  if (Math.abs(m.lat) > 90 || Math.abs(m.lon) > 180) return null
  var p = { lat: Math.round(m.lat * 1e6) / 1e6, lon: Math.round(m.lon * 1e6) / 1e6, tst: (typeof m.tst === 'number' ? m.tst : Math.floor(Date.now() / 1000)) * 1000 }
  if (typeof m.acc === 'number') p.acc = Math.round(m.acc)
  if (typeof m.batt === 'number') p.batt = Math.round(m.batt)
  return p
}

/** The new document: the newest point on top, the previous one added to the trail (last TRAIL_HOURS, TRAIL_POINTS). */
function locationDoc_(prev, p) {
  var trail = ((prev && prev.trail) || []).slice()
  if (prev && typeof prev.lat === 'number') {
    if (p.tst < prev.tst) return locationDocKeep_(prev) // an older report arriving late: keep the newer one
    trail.push({ lat: prev.lat, lon: prev.lon, tst: prev.tst })
  }
  var since = p.tst - TRAIL_HOURS * 3600000
  trail = trail
    .filter(function (t) {
      return t.tst >= since
    })
    .slice(-TRAIL_POINTS)
  var doc = { lat: p.lat, lon: p.lon, tst: p.tst, trail: trail, off: false }
  if (p.acc !== undefined) doc.acc = p.acc
  if (p.batt !== undefined) doc.batt = p.batt
  return doc
}

/** A stored document as it was (so a late, older report changes nothing). */
function locationDocKeep_(prev) {
  var doc = { lat: prev.lat, lon: prev.lon, tst: prev.tst, trail: prev.trail || [], off: false }
  if (prev.acc !== undefined) doc.acc = prev.acc
  if (prev.batt !== undefined) doc.batt = prev.batt
  return doc
}

/** "buy milk" → "Buy milk": trimmed, a little tidy, at most 200 characters. */
function voiceTitle_(text) {
  var t = String(text || '').replace(/\s+/g, ' ').trim().replace(/^(to|a|an)\s+/i, '')
  if (!t) return ''
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 200)
}

/** A list name or spoken name, simplified for matching: "Steve's Groceries List" → "steve grocery". */
function voiceKey_(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(function (w) {
      return w && ['the', 'my', 'our', 'list'].indexOf(w) < 0
    })
    .map(function (w) {
      return w.length > 3 ? w.replace(/(ies)$/, 'y').replace(/s$/, '') : w
    })
    .join(' ')
}

/**
 * "milk to groceries" / "milk to the grocery list" / "drill bits on home depot" → { text: 'milk', list } when the
 * words after the last "to" / "on" name one family list you can add tasks to (a task list, project or checklist):
 * the same name, or the start of exactly one name ("best buy" → "Best Buy Shopping"). Otherwise null, and the whole
 * thing is the task ("go to the store").
 */
function voiceTarget_(text, lists) {
  var t = String(text || '').replace(/\s+/g, ' ').trim()
  var re = /\s(?:to|on|onto|in|into)\s/gi
  var m
  var cut = -1
  while ((m = re.exec(t))) cut = m.index
  if (cut < 0) return null
  var spoken = voiceKey_(t.slice(cut).replace(/^\s\S+\s/, ''))
  if (!spoken) return null
  var usable = lists.filter(function (l) {
    return ['list', 'project', 'checklist'].indexOf(l.fields.kind || 'list') >= 0 && !l.fields.archived
  })
  var exact = usable.filter(function (l) {
    return voiceKey_(l.fields.name) === spoken
  })
  var starts = usable.filter(function (l) {
    return (voiceKey_(l.fields.name) + ' ').indexOf(spoken + ' ') === 0
  })
  var list = exact.length === 1 ? exact[0] : !exact.length && starts.length === 1 ? starts[0] : null
  return list ? { text: t.slice(0, cut), list: list } : null
}

/** The shared "Family Inbox" task list (found among `lists`, or made for everyone to see). */
function voiceInbox_(api, lists) {
  var match = lists.filter(function (l) {
    return l.fields.name === 'Family Inbox' && (l.fields.kind || 'list') === 'list'
  })[0]
  if (!match) {
    var id = api.create('lists', { name: 'Family Inbox', kind: 'list', visibility: 'family', ownerId: api.uid, viewerVisible: true, defaultContext: 'family' })
    match = api.get('lists/' + id)
  }
  return voiceList_(match)
}

/** What a new task copies from its list (the rules require the list's privacy on each task). */
function voiceList_(match) {
  var f = match.fields
  var list = { id: match.id, visibility: f.visibility, ownerId: f.ownerId, viewerVisible: f.viewerVisible, defaultContext: f.defaultContext || 'family' }
  if (f.editAudience) list.editAudience = f.editAudience
  if (f.editors) list.editors = f.editors
  return list
}

/** A new task's fields: the list's privacy copied (the rules require it), due `day` (none when null), written by the script's member. */
function voiceTaskFields_(list, title, day, uid) {
  var t = {
    listId: list.id,
    title: title,
    priority: 2,
    status: 'todo',
    context: list.defaultContext || 'family',
    durationDays: 1,
    dependsOn: [],
    visibility: list.visibility,
    ownerId: list.ownerId,
    viewerVisible: list.viewerVisible,
    createdBy: uid,
  }
  if (day) t.targetDate = day
  if (list.editAudience) t.editAudience = list.editAudience
  if (list.editors) t.editors = list.editors
  return t
}

/** What Alexa says for "what's on today": calendar events (with times) first, then up to 5 open to-dos. */
function voiceSummary_(tasks) {
  var open = tasks.filter(function (t) {
    return t.status !== 'done' && t.status !== 'canceled'
  })
  var events = open.filter(function (t) {
    return t.calendar
  })
  var todos = open.filter(function (t) {
    return !t.calendar
  })
  var parts = []
  if (events.length) {
    parts.push(
      'On the calendar: ' +
        events
          .map(function (e) {
            var time = e.calendar && e.calendar.time ? String(e.calendar.time).split('–')[0].trim() : ''
            return e.title + (time ? ' at ' + time : '')
          })
          .join(', ') +
        '.',
    )
  }
  if (todos.length) {
    var some = todos.slice(0, 5).map(function (t) {
      return t.title
    })
    parts.push('To do: ' + some.join(', ') + (todos.length > 5 ? ', and ' + (todos.length - 5) + ' more' : '') + '.')
  }
  return parts.length ? parts.join(' ') : 'Nothing on the calendar or the to-do list for today.'
}

/** The uid behind a Firebase ID token, or null if it isn't a valid token for this project. */
function verifyIdToken_(cfg, idToken) {
  try {
    var res = http_('post', cfg.AUTH_URL + '/accounts:lookup?key=' + encodeURIComponent(cfg.FIREBASE_API_KEY), { idToken: idToken })
    return (res.users && res.users[0] && res.users[0].localId) || null
  } catch (e) {
    return null
  }
}

function sync_() {
  var props = PropertiesService.getScriptProperties()
  var cfg = config_(props.getProperties())
  var now = new Date()
  var from = new Date(now.getTime() - Number(cfg.DAYS_BEHIND) * 86400000)
  var to = new Date(now.getTime() + Number(cfg.WEEKS_AHEAD) * 7 * 86400000)

  // Show times in the family's zone. Not the calendar's own zone setting: a calendar can be set to UTC while
  // Google Calendar still displays it in local time, which made 4 PM events read 8 PM.
  var tz = cfg.TIME_ZONE || Session.getScriptTimeZone()
  var events = []
  var pageToken
  do {
    var page = Calendar.Events.list(cfg.CALENDAR_ID, {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: true, // one item per recurring instance
      maxResults: 2500,
      timeZone: tz,
      pageToken: pageToken,
    })
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
    'Synced ' + wanted.length + ' events (' + tz + '): ' + plan.creates.length + ' new, ' + plan.updates.length + ' changed, ' + plan.deletes.length + ' removed.',
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
  cfg.TIME_ZONE = p.TIME_ZONE || ''
  // Optional: the family map's alerts. FCM_SERVICE_ACCOUNT (JSON key) for phone notifications; ALIGN_URL for the
  // link in alert emails.
  cfg.FCM_SERVICE_ACCOUNT = p.FCM_SERVICE_ACCOUNT || ''
  cfg.ALIGN_URL = p.ALIGN_URL || ''
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
  // The event's own page in Google Calendar, for Align's "Open in Google Calendar" link.
  if (ev.htmlLink) calendar.link = ev.htmlLink
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
    return stableJson_(a[f]) === stableJson_(b[f])
  })
}

/** JSON with object keys sorted, so a map read back from Firestore in another key order still compares equal. */
function stableJson_(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(stableJson_).join(',') + ']'
  return (
    '{' +
    Object.keys(v)
      .filter(function (k) {
        return v[k] !== undefined
      })
      .sort()
      .map(function (k) {
        return JSON.stringify(k) + ':' + stableJson_(v[k])
      })
      .join(',') +
    '}'
  )
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
    /** Every document in a collection (small ones: places, alert settings). */
    all: function (collection) {
      var res = http_('post', base + ':runQuery', { structuredQuery: { from: [{ collectionId: collection }] } }, auth.token)
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
