// Runs the real Apps Script calendar sync against the local emulators, with stand-ins for Google's services.
// Needs `npm run emulators` and `npm run seed` first. Usage: npm run test:calendar
import { execFileSync } from 'node:child_process'
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
  start: { dateTime: `${dayStr(offset)}T${String(hour).padStart(2, '0')}:00:00-05:00` },
  end: { dateTime: `${dayStr(offset)}T${String(hour + 1).padStart(2, '0')}:00:00-05:00` },
})
const allDay = (id, summary, offset, days) => ({ id, summary, start: { date: dayStr(offset) }, end: { date: dayStr(offset + days) } })
let events = []

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
  PropertiesService: {
    getScriptProperties: () => ({ getProperties: () => ({ ...props }), setProperty: (k, v) => (props[k] = v) }),
  },
  Calendar: {
    // The calendar's own zone set to UTC reproduces the 4 PM → 8 PM bug; times must follow the script's zone.
    Events: { list: () => ({ timeZone: 'UTC', items: events }) },
  },
  Utilities: {
    formatDate: (d, tz, pattern) =>
      pattern === 'yyyy-MM-dd'
        ? new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d)
        : new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(d),
  },
  UrlFetchApp: {
    fetch: (url, o) => {
      const args = ['-s', '-X', o.method.toUpperCase(), '-H', 'Content-Type: application/json', '-w', '\n%{http_code}']
      if (o.headers.Authorization) args.push('-H', `Authorization: ${o.headers.Authorization}`)
      if (o.payload) args.push('-d', o.payload)
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
console.log('Calendar sync works against the emulator.')
process.exit(0)
