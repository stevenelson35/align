// Runs the real Apps Script calendar sync against the local emulators, with stand-ins for Google's services.
// Needs `npm run emulators` and `npm run seed` first. Usage: npm run test:calendar
import { execFileSync } from 'node:child_process'
import { createHmac, createSign, generateKeyPairSync } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
initializeApp({ projectId: 'demo-align' })
const admin = getFirestore()

const TZ = 'America/Chicago'
const props = {
  CALENDAR_ID: 'family@group.calendar.google.com',
  FIREBASE_API_KEY: 'demo-key',
  FIREBASE_PROJECT_ID: 'demo-align',
  BOT_EMAIL: 'calendar-bot@example.com',
  BOT_PASSWORD: 'align-dev',
  AUTH_URL: 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1',
  FIRESTORE_URL: 'http://127.0.0.1:8080/v1',
}

// Calendar API event shapes (singleEvents: true).
const dayStr = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
}
const timed = (id, summary, offset, hour, location) => ({
  id,
  summary,
  location,
  htmlLink: `https://www.google.com/calendar/event?eid=${id}`,
  start: { dateTime: `${dayStr(offset)}T${String(hour).padStart(2, '0')}:00:00-05:00` },
  end: { dateTime: `${dayStr(offset)}T${String(hour + 1).padStart(2, '0')}:00:00-05:00` },
})
const allDay = (id, summary, offset, days) => ({ id, summary, start: { date: dayStr(offset) }, end: { date: dayStr(offset + days) } })
let events = []
const mails = []

const cache = new Map()
let lockHeld = false
const sandbox = createContext({
  console,
  LockService: {
    getScriptLock: () => ({
      tryLock: () => (lockHeld ? false : (lockHeld = true)),
      releaseLock: () => (lockHeld = false),
    }),
  },
  CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
  ContentService: {
    MimeType: { JSON: 'json' },
    createTextOutput: (text) => ({ text, setMimeType() { return this } }),
  },
  Session: { getScriptTimeZone: () => TZ },
  MailApp: { sendEmail: (to, subject, body) => mails.push({ to, subject, body }) },
  PropertiesService: {
    getScriptProperties: () => ({ getProperties: () => ({ ...props }), getProperty: (k) => props[k] ?? null, setProperty: (k, v) => (props[k] = v) }),
  },
  Calendar: {
    // The calendar's own zone set to UTC reproduces the 4 PM → 8 PM bug; times must follow the script's zone.
    Events: { list: () => ({ timeZone: 'UTC', items: events }) },
  },
  Utilities: {
    // Apps Script returns signed bytes.
    computeRsaSha256Signature: (value, pem) => [...createSign('RSA-SHA256').update(value).sign(pem)].map((b) => (b > 127 ? b - 256 : b)),
    base64EncodeWebSafe: (v) => Buffer.from(typeof v === 'string' ? v : v.map((b) => b & 255)).toString('base64url') + '=',
    computeHmacSha256Signature: (value, key) => [...createHmac('sha256', key).update(value).digest()].map((b) => (b > 127 ? b - 256 : b)),
    formatDate: (d, tz, pattern) =>
      pattern === 'yyyy-MM-dd'
        ? new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d)
        : new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(d),
  },
  UrlFetchApp: {
    fetch: (url, o) => {
      // A payload object is a form post (Apps Script sends it form-encoded), as for the FCM sign-in.
      const form = o.payload && typeof o.payload === 'object'
      const args = ['-s', '-X', o.method.toUpperCase(), '-H', `Content-Type: ${form ? 'application/x-www-form-urlencoded' : 'application/json'}`, '-w', '\n%{http_code}']
      if (o.headers?.Authorization) args.push('-H', `Authorization: ${o.headers.Authorization}`)
      if (o.payload) args.push('-d', form ? new URLSearchParams(o.payload).toString() : o.payload)
      const out = execFileSync('curl', [...args, url], { encoding: 'utf8' })
      const at = out.lastIndexOf('\n')
      return { getResponseCode: () => Number(out.slice(at + 1)), getContentText: () => out.slice(0, at) }
    },
  },
})
runInContext(readFileSync('scripts/apps-script/calendar-sync.gs', 'utf8'), sandbox)

const imported = async () =>
  (await admin.collection('tasks').where('listId', '==', props.LIST_ID).get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
function check(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`ok: ${msg}`)
}

// Clean slate for the calendar list.
for (const d of (await admin.collection('lists').where('name', '==', 'Family Calendar').get()).docs) {
  for (const t of (await admin.collection('tasks').where('listId', '==', d.id).get()).docs) await t.ref.delete()
  await d.ref.delete()
}

events = [
  timed('vet1', 'Vet: Dog 1', 3, 15, 'Main St Vet'),
  allDay('trip1', 'Lake trip', 10, 3),
  timed('piano_1', 'Piano', 1, 17),
  timed('piano_2', 'Piano', 8, 17),
]
let plan = sandbox.syncCalendar()
check(plan.creates.length === 4, 'first sync creates 4 tasks (recurring instances are separate)')
let tasks = await imported()
check(tasks.length === 4 && tasks.every((t) => t.createdBy === 'calendar-bot' && t.visibility === 'family'), 'tasks land in the family list as the bot')
check(tasks.find((t) => t.title === 'Lake trip')?.durationDays === 3, 'all-day trip spans 3 days')
check(/3:00\s?PM/.test(tasks.find((t) => t.title === 'Vet: Dog 1')?.calendar.time ?? ''), 'timed event keeps its time in the calendar zone')
check(tasks.find((t) => t.title === 'Vet: Dog 1')?.calendar.link === 'https://www.google.com/calendar/event?eid=vet1', "the event's Google Calendar link is stored")

// A family member completes the vet task and adds a note; then the event moves and piano #2 is cancelled.
const vet = tasks.find((t) => t.title === 'Vet: Dog 1')
await admin.doc(`tasks/${vet.id}`).update({ status: 'done', notes: 'Bring records' })
events = [timed('vet1', 'Vet: Dog 1 (moved)', 4, 9, 'Main St Vet'), events[1], events[2], { ...events[3], status: 'cancelled' }]
plan = sandbox.syncCalendar()
check(plan.creates.length === 0 && plan.updates.length === 1 && plan.deletes.length === 1, 'second sync: 1 update, 1 delete')
tasks = await imported()
const moved = tasks.find((t) => t.id === vet.id)
check(moved.title === 'Vet: Dog 1 (moved)' && moved.status === 'done' && moved.notes === 'Bring records', 'update changes synced fields only')
check(tasks.length === 3, 'cancelled instance removed')

plan = sandbox.syncCalendar()
check(plan.creates.length + plan.updates.length + plan.deletes.length === 0, 'third sync with no changes writes nothing')
check(!lockHeld, 'the sync lock is released after each run')

// "Refresh calendar" from Align: the web app's doPost, called with a member's real ID token.
const idTokenFor = async (email) => {
  const res = await fetch(`${props.AUTH_URL}/accounts:signInWithPassword?key=demo-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'align-dev', returnSecureToken: true }),
  })
  return (await res.json()).idToken
}
const post = (body) => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(body) } }).text)
events = [...events, timed('dentist', 'Dentist', 2, 10)]
let reply = post({ idToken: await idTokenFor('steve@example.com') })
check(reply.ok && reply.created === 1, 'a member can refresh the calendar from Align, and it syncs')
check((await imported()).some((t) => t.title === 'Dentist'), 'the refresh imported the new event')
reply = post({ idToken: await idTokenFor('wife@example.com') })
check(reply.ok && reply.skipped, 'a second refresh within a minute is skipped')
cache.clear()
check(post({ idToken: 'not-a-token' }).ok === false, 'an invalid sign-in is refused')
const stranger = await (
  await fetch(`${props.AUTH_URL}/accounts:signUp?key=demo-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `stranger${Date.now()}@example.com`, password: 'align-dev', returnSecureToken: true }),
  })
).json()
reply = post({ idToken: stranger.idToken })
check(!reply.ok && /household members/.test(reply.error), 'a signed-in account outside the household is refused')
check(post({}).ok === false && post({}).error === 'Not signed in.', 'a request without a sign-in is refused')
lockHeld = true
reply = post({ idToken: await idTokenFor('steve@example.com') })
check(!reply.ok && /still running/.test(reply.error), 'a refresh during a running sync says so instead of overlapping')
lockHeld = false

// Voice (the Alexa skill): adds to the Family Inbox, or to a family list named after "to".
props.VOICE_SECRET = 'test-secret'
check(post({ voice: true, secret: 'wrong', action: 'add', text: 'milk' }).ok === false, 'voice: a wrong secret is refused')
await admin.doc('lists/voice-groceries').set({ name: 'Groceries', kind: 'checklist', visibility: 'family', ownerId: 'steve', viewerVisible: true, defaultContext: 'family' })
reply = post({ voice: true, secret: 'test-secret', action: 'add', text: 'milk to the grocery list' })
check(reply.ok && reply.speech === 'Added Milk to Groceries.', `voice: "milk to the grocery list" adds to Groceries (${reply.speech})`)
const grocery = (await admin.collection('tasks').where('listId', '==', 'voice-groceries').get()).docs.map((d) => d.data())
check(grocery.length === 1 && grocery[0].title === 'Milk' && !grocery[0].targetDate && grocery[0].createdBy === 'calendar-bot', 'voice: the checklist item is written (no due date) and the rules allow it')
reply = post({ voice: true, secret: 'test-secret', action: 'add', text: 'go to the store' })
check(reply.ok && /Go to the store to the Family Inbox/.test(reply.speech), `voice: other phrases go to the Family Inbox (${reply.speech})`)
reply = post({ voice: true, secret: 'test-secret', action: 'today' })
check(reply.ok && /Go to the store/.test(reply.speech), `voice: what's on today includes it (${reply.speech})`)

// Location (the family map): Align gets a personal key; OwnTracks posts with it in the URL.
const postTo = (params, body) => JSON.parse(sandbox.doPost({ parameter: params, postData: { contents: JSON.stringify(body) } }).text)
reply = post({ action: 'locationKey', idToken: await idTokenFor('steve@example.com') })
check(reply.ok && /^steve\.[0-9a-f]{32}$/.test(reply.key), `location: a member gets a personal key (${JSON.stringify(reply)})`)
const key = reply.key
check(!post({ action: 'locationKey', idToken: await idTokenFor('grandparent@example.com') }).ok, 'location: a viewer gets no key')
const report = { _type: 'location', lat: 28.6, lon: -81.35, acc: 10, batt: 77, tst: Math.floor(Date.now() / 1000), tid: 'SN' }
check(JSON.stringify(postTo({ loc: key }, report)) === '[]', 'location: a report is answered with [] (what OwnTracks expects)')
let loc = (await admin.doc('locations/steve').get()).data()
check(loc && loc.lat === 28.6 && loc.batt === 77 && loc.off === false && loc.updatedAt, 'location: the report lands in locations/steve as the helper (rules allow it)')
postTo({ loc: key }, { ...report, lat: 28.61, tst: report.tst + 60 })
loc = (await admin.doc('locations/steve').get()).data()
check(loc.lat === 28.61 && loc.trail.length === 1 && loc.trail[0].lat === 28.6, 'location: the next report moves the previous point onto the trail')
check(postTo({ loc: 'steve.' + '0'.repeat(32) }, report).ok === false, 'location: a forged key is refused')
check(postTo({ loc: key.replace('steve', 'wife') }, report).ok === false, "location: one person's key can't post for another")
await admin.doc('locations/steve').update({ off: true })
postTo({ loc: key }, { ...report, lat: 30, tst: report.tst + 120 })
check((await admin.doc('locations/steve').get()).data().lat === 28.61, 'location: nothing is written while paused')

// Places and alerts: a stand-in for Google's token and FCM endpoints runs in its own process (the curl calls above
// block this one), logging each request to a file.
const dir = mkdtempSync(join(tmpdir(), 'align-fcm-'))
const logFile = join(dir, 'requests.jsonl')
const stub = spawn(process.execPath, ['-e', `
  const fs = require('fs'); const http = require('http')
  http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    fs.appendFileSync(${JSON.stringify(logFile)}, JSON.stringify({ url: req.url, auth: req.headers.authorization || '', body: b }) + '\\n')
    res.setHeader('Content-Type', 'application/json')
    res.end(req.url === '/token' ? JSON.stringify({ access_token: 'stub-access', expires_in: 3600 }) : JSON.stringify({ name: 'projects/x/messages/1' }))
  }) }).listen(5399, () => console.log('ready'))
`])
await new Promise((ok) => stub.stdout.once('data', ok))
const requests = () => (existsSync(logFile) ? readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [])
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
props.FCM_SERVICE_ACCOUNT = JSON.stringify({ client_email: 'fcm@demo.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'http://127.0.0.1:5399/token' })
props.FCM_URL = 'http://127.0.0.1:5399/v1'
props.ALIGN_URL = 'https://align.example.com/'
await admin.doc('locations/steve').update({ off: false })
await admin.doc('places/home').set({ name: 'Home', lat: 28.6, lon: -81.35, radius: 200, createdBy: 'steve', createdAt: new Date('2026-01-01') })
await admin.doc('alertPrefs/wife').set({ rules: [{ person: 'steve', place: '*', enter: true, leave: true }], push: ['wife-phone'], email: 'wife@example.com', emailOn: true })
await admin.doc('alertPrefs/steve').set({ rules: [{ person: '*', place: '*', enter: true, leave: true }], push: ['steve-phone'] })
postTo({ loc: key }, { ...report, lat: 28.6001, tst: report.tst + 300 })
loc = (await admin.doc('locations/steve').get()).data()
check(loc.inside?.[0] === 'home' && loc.events?.at(-1)?.kind === 'enter', `places: arriving home is noticed (${JSON.stringify(loc.inside)}, ${loc.events?.at(-1)?.kind})`)
let sent = requests().filter((r) => r.url.includes('messages:send'))
const push = sent.length && JSON.parse(sent[0].body).message
check(sent.length === 1 && push.token === 'wife-phone' && push.data.title === 'Steve arrived at Home' && sent[0].auth === 'Bearer stub-access', `alerts: one notification, to Linda's phone, signed in through the service account (${sent.length})`)
const signIn = requests().find((r) => r.url === '/token')
const assertion = signIn && new URLSearchParams(signIn.body).get('assertion')
const claim = assertion && JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString())
check(claim && claim.iss === 'fcm@demo.iam.gserviceaccount.com' && claim.scope.includes('firebase.messaging'), 'alerts: the FCM sign-in is a JWT from the service account')
check(mails.length === 1 && mails[0].to === 'wife@example.com' && mails[0].subject === 'Steve arrived at Home' && mails[0].body.includes('https://align.example.com/#/map'), 'alerts: and an email, with a link to the map')
postTo({ loc: key }, { ...report, lat: 28.6002, tst: report.tst + 360 })
check(requests().filter((r) => r.url.includes('messages:send')).length === 1, 'alerts: staying home sends nothing more')
postTo({ loc: key }, { ...report, lat: 28.62, tst: report.tst + 420 })
loc = (await admin.doc('locations/steve').get()).data()
sent = requests().filter((r) => r.url.includes('messages:send'))
check(!loc.inside.length && loc.events.at(-1).kind === 'leave' && JSON.parse(sent.at(-1).body).message.data.title === 'Steve left Home', 'places: leaving is noticed and alerted')
check(sent.every((r) => JSON.parse(r.body).message.token !== 'steve-phone'), "alerts: never about yourself")

// Bad fixes: a glitch is held (nothing moves), then dropped when the next fix is back on track; a poor-accuracy fix
// is ignored; a real jump is confirmed by the next fix and both join the trail.
const latNow = async () => (await admin.doc('locations/steve').get()).data()
postTo({ loc: key }, { ...report, lat: 29.2, tst: report.tst + 480 })
loc = await latNow()
check(loc.lat === 28.62 && loc.pending?.lat === 29.2, `filter: an impossible jump is held, not shown (lat ${loc.lat}, pending ${loc.pending?.lat})`)
postTo({ loc: key }, { ...report, lat: 28.6201, tst: report.tst + 540 })
loc = await latNow()
check(loc.lat === 28.6201 && !loc.pending && !loc.trail.some((t) => t.lat === 29.2), 'filter: the next good fix replaces it; the glitch never reaches the trail')
postTo({ loc: key }, { ...report, lat: 28.63, acc: 2000, tst: report.tst + 600 })
check((await latNow()).lat === 28.6201, 'filter: a fix accurate only to 2 km is ignored while the last good one is recent')
postTo({ loc: key }, { ...report, lat: 30, tst: report.tst + 660 })
postTo({ loc: key }, { ...report, lat: 30.0005, tst: report.tst + 720 })
loc = await latNow()
check(loc.lat === 30.0005 && loc.trail.some((t) => t.lat === 30) && !loc.pending, 'filter: a jump the next fix confirms is accepted, with both on the trail')
stub.kill()
console.log('Calendar sync works against the emulator.')
process.exit(0)
