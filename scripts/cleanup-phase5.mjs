// Refactor phase 5 (DESIGN.md §13): clears what the old Today left on the household and the Inbox.
// - members.<uid>.todayItems (the old Shortcuts list; Today tiles replaced it) and todayMore (sections moved into
//   More…), and a "shortcuts" panel style, on every member entry;
// - Inbox game invitations still linking to "#/games/play/wordle" (today's Wordle) now open the Games page, which lists
//   invitations.
// Safe to run again: what's already clean is left alone.
//
//   node scripts/cleanup-phase5.mjs            # dry run against the emulators (prints what it would change)
//   node scripts/cleanup-phase5.mjs --write    # do it, on the emulators
//
// Live: FIRESTORE_PROJECT and FIRESTORE_TOKEN (an owner's OAuth access token), as for migrate-phase1.mjs; only after a
// backup and an emulator dry run. Never prints the token.
const live = !!process.env.FIRESTORE_TOKEN
const project = live ? process.env.FIRESTORE_PROJECT : 'demo-align'
if (live && !project) throw new Error('Set FIRESTORE_PROJECT for a live run.')
const host = live ? 'https://firestore.googleapis.com' : `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'}`
const headers = { Authorization: `Bearer ${live ? process.env.FIRESTORE_TOKEN : 'owner'}`, 'Content-Type': 'application/json' }
const root = `projects/${project}/databases/(default)/documents`
const write = process.argv.includes('--write')

async function call(method, path, body) {
  const res = await fetch(`${host}/v1/${root}${path}`, { method, headers, body: body && JSON.stringify(body) })
  const json = await res.json()
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(json.error ?? json)}`)
  return json
}

console.log(`${write ? 'WRITING' : 'Dry run'} on ${live ? `LIVE project ${project}` : 'the emulators'}`)

// 1. The household's member entries.
const household = await call('GET', '/household/main')
const members = household.fields?.members?.mapValue?.fields ?? {}
const paths = []
for (const [uid, m] of Object.entries(members)) {
  const f = m.mapValue?.fields ?? {}
  const name = f.displayName?.stringValue ?? uid.slice(0, 4)
  const old = ['todayItems', 'todayMore'].filter((k) => k in f)
  const style = 'shortcuts' in (f.todayPanels?.mapValue?.fields ?? {})
  if (!old.length && !style) continue
  console.log(`  ${name}: remove ${[...old, ...(style ? ['todayPanels.shortcuts'] : [])].join(', ')}${f.today ? '' : '  (no Today tiles saved: they get the default layout)'}`)
  for (const k of old) paths.push(`members.\`${uid}\`.${k}`)
  if (style) paths.push(`members.\`${uid}\`.todayPanels.shortcuts`)
}
if (!paths.length) console.log('  member entries: already clean')
// Listing a field in the mask but not in the body deletes it; nothing else on the document changes.
if (write && paths.length) await call('PATCH', `/household/main?${paths.map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&')}&currentDocument.exists=true`, { fields: {} })

// 2. Old Wordle invitation links in the Inbox.
const found = await call('POST', ':runQuery', {
  structuredQuery: { from: [{ collectionId: 'inbox' }], where: { fieldFilter: { field: { fieldPath: 'link' }, op: 'EQUAL', value: { stringValue: '#/games/play/wordle' } } } },
})
const old = found.filter((r) => r.document && r.document.fields?.kind?.stringValue === 'game')
console.log(`  Inbox: ${old.length} game invitation(s) to point at the Games page`)
if (write && old.length)
  await call('POST', ':commit', {
    writes: old.map((r) => ({ update: { name: r.document.name, fields: { link: { stringValue: '#/games' } } }, updateMask: { fieldPaths: ['link'] }, currentDocument: { exists: true } })),
  })
console.log(write ? 'Done.' : 'Run with --write to do it.')
