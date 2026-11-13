// Refactor phase 1 migration (DESIGN.md §13): every list, entry and goal must have `updatedAt`, because change-only
// sync asks "what changed since…" and a document without it would never be seen. Stamps the missing ones with their
// `createdAt` (or now, if they have neither). Safe to run more than once: documents that already have it are skipped.
//
//   node scripts/migrate-phase1.mjs            # dry run against the emulators (shows what it would change)
//   node scripts/migrate-phase1.mjs --write    # do it, on the emulators
//
// Live: set FIRESTORE_PROJECT=align-a32c1 and FIRESTORE_TOKEN to an OAuth access token for an owner of the project
// (the Firebase CLI's sign-in), and pass --write only after a backup and an emulator dry run. Never prints the token.
const live = !!process.env.FIRESTORE_TOKEN
const project = live ? process.env.FIRESTORE_PROJECT : 'demo-align'
if (live && !project) throw new Error('Set FIRESTORE_PROJECT for a live run.')
const host = live ? 'https://firestore.googleapis.com' : `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'}`
const token = live ? process.env.FIRESTORE_TOKEN : 'owner'
const write = process.argv.includes('--write')
const root = `projects/${project}/databases/(default)/documents`
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

async function listAll(collection) {
  const docs = []
  let pageToken = ''
  do {
    const res = await fetch(`${host}/v1/${root}/${collection}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { headers })
    const body = await res.json()
    if (!res.ok) throw new Error(`${collection}: ${res.status} ${JSON.stringify(body.error ?? body)}`)
    docs.push(...(body.documents ?? []))
    pageToken = body.nextPageToken
  } while (pageToken)
  return docs
}

async function commit(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const res = await fetch(`${host}/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ writes: writes.slice(i, i + 400) }) })
    if (!res.ok) throw new Error(`commit: ${res.status} ${await res.text()}`)
  }
}

console.log(`${write ? 'WRITING' : 'Dry run'} on ${live ? `LIVE project ${project}` : 'the emulators'}`)
let total = 0
for (const collection of ['lists', 'tasks', 'goals']) {
  const docs = await listAll(collection)
  const missing = docs.filter((d) => !d.fields?.updatedAt)
  const writes = missing.map((d) =>
    d.fields?.createdAt
      ? { update: { name: d.name, fields: { updatedAt: d.fields.createdAt } }, updateMask: { fieldPaths: ['updatedAt'] }, currentDocument: { exists: true } }
      : { transform: { document: d.name, fieldTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] }, currentDocument: { exists: true } },
  )
  console.log(`  ${collection}: ${docs.length} documents, ${missing.length} without updatedAt${missing.length ? `: ${missing.map((d) => `${d.name.split('/').pop()}${d.fields?.createdAt ? '' : ' (no createdAt: now)'}`).join(', ')}` : ''}`)
  if (write && writes.length) await commit(writes)
  total += writes.length
}
console.log(write ? `Stamped ${total}.` : `Would stamp ${total}. Run with --write to do it.`)
