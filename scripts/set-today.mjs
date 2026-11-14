// Sets everyone's Today to one arrangement (DESIGN.md §13, phase 3 tiles): `members.<uid>.today` on household/main
// for each person (not the calendar bot). The arrangement is a JSON file kept outside the repo (it names the
// family's own entries): { "tiles": ["panel:photos", "panel:inbox", "group:Fun", …, "end:1", "panel:todo", "more", …] }.
// Per person, entries they can't open are left out, and anything they had on Today that the arrangement doesn't
// include is kept at the end of More… (nothing they pinned is lost). Safe to run again.
//
//   node scripts/set-today.mjs <arrangement.json>            # dry run against the emulators (prints each Today)
//   node scripts/set-today.mjs <arrangement.json> --write    # do it, on the emulators
//
// Live: FIRESTORE_PROJECT and FIRESTORE_TOKEN (an owner's OAuth access token), as for migrate-phase1.mjs; only after
// a backup and an emulator dry run. Never prints the token.
import { readFileSync } from 'node:fs'

const live = !!process.env.FIRESTORE_TOKEN
const project = live ? process.env.FIRESTORE_PROJECT : 'demo-align'
if (live && !project) throw new Error('Set FIRESTORE_PROJECT for a live run.')
const host = live ? 'https://firestore.googleapis.com' : `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'}`
const headers = { Authorization: `Bearer ${live ? process.env.FIRESTORE_TOKEN : 'owner'}`, 'Content-Type': 'application/json' }
const root = `projects/${project}/databases/(default)/documents`
const file = process.argv[2]
const write = process.argv.includes('--write')
if (!file) throw new Error('Usage: node scripts/set-today.mjs <arrangement.json> [--write]')
const { tiles } = JSON.parse(readFileSync(file, 'utf8'))
if (!Array.isArray(tiles) || !tiles.includes('more')) throw new Error('The arrangement needs a "tiles" list with the "more" line.')

const val = (v) => {
  if (!v) return undefined
  if ('stringValue' in v) return v.stringValue
  if ('booleanValue' in v) return v.booleanValue
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(val)
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, val(x)]))
  return null
}
async function get(path) {
  const res = await fetch(`${host}/v1/${root}/${path}`, { headers })
  if (res.status === 404) return null
  const body = await res.json()
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(body.error ?? body)}`)
  return Object.fromEntries(Object.entries(body.fields ?? {}).map(([k, x]) => [k, val(x)]))
}

/** The rules' canRead for an entry. */
function canRead(d, uid, role) {
  if (d.deleted) return false
  if (d.visibility === 'private') return role === 'member' && d.ownerId === uid
  if (d.visibility === 'family') return role === 'member' || d.viewerVisible === true
  return (d.sharedWith ?? []).includes(uid)
}

const household = await get('household/main')
const entries = new Map()
for (const t of tiles.filter((t) => t.startsWith('entry:'))) entries.set(t, await get(`tasks/${t.slice(6)}`))
const people = Object.entries(household.members ?? {}).filter(([, m]) => !m.bot && (m.role === 'member' || m.role === 'viewer'))
console.log(`${write ? 'WRITING' : 'Dry run'} on ${live ? `LIVE project ${project}` : 'the emulators'}`)
const fields = {}
for (const [uid, m] of people) {
  const mine = tiles.filter((t) => !t.startsWith('entry:') || (entries.get(t) && canRead(entries.get(t), uid, m.role)))
  // What they had that the arrangement doesn't include: their own pins (entries, lists, parts), kept in More….
  const had = m.today ?? (m.todayItems ?? []).map((id) => `entry:${id}`)
  const keep = had.filter((t) => !mine.includes(t) && /^(entry|list|person|game|daily):/.test(t))
  const today = [...mine, ...keep]
  console.log(`\n${m.displayName} (${m.role}): ${today.length} tiles${keep.length ? `, ${keep.length} of their own kept at the end of More…` : ''}`)
  for (const t of today) {
    const e = entries.get(t)
    console.log(`  ${t === 'more' ? '──── More… ────' : `${t}${e ? `  (${e.title})` : ''}`}`)
  }
  fields[uid] = { mapValue: { fields: { today: { arrayValue: { values: today.map((t) => ({ stringValue: t })) } } } } }
}
if (write) {
  // Only members.<uid>.today changes (uids can start with a digit: quoted in the field path).
  const mask = Object.keys(fields).map((uid) => `updateMask.fieldPaths=${encodeURIComponent(`members.\`${uid}\`.today`)}`).join('&')
  const res = await fetch(`${host}/v1/${root}/household/main?${mask}&currentDocument.exists=true`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields: { members: { mapValue: { fields } } } }),
  })
  if (!res.ok) throw new Error(`write: ${res.status} ${await res.text()}`)
  console.log(`\nSaved Today for ${Object.keys(fields).length} people.`)
} else console.log('\nRun with --write to save it.')
