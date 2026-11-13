// Loads a backup of the live database (made by a read-only export: one JSON file per collection, each document in
// Firestore's own typed form) into the local emulators, for dry runs of migrations and testing against real data.
// Never touches the live project: it talks only to the emulators and writes under the demo- project.
//
//   node scripts/restore-to-emulator.mjs <backup dir> [uid=email ...]
//
// Each uid=email pair also creates an emulator login for that uid (password "align-dev"), so you can sign in as
// that person. The household document in the backup decides who's a member.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
const PROJECT = 'demo-align'

const [dir, ...people] = process.argv.slice(2)
if (!dir) {
  console.error('Usage: node scripts/restore-to-emulator.mjs <backup dir> [uid=email ...]')
  process.exit(1)
}

const base = `http://${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents`
let written = 0
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'manifest.json')) {
  const docs = JSON.parse(readFileSync(join(dir, file), 'utf8'))
  for (const d of docs) {
    // projects/<live>/databases/(default)/documents/<path> → the same path under the demo project.
    const path = d.name.split('/documents/')[1]
    const res = await fetch(`${base}/${path}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: d.fields ?? {} }),
    })
    if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
    written++
  }
}

initializeApp({ projectId: PROJECT })
for (const pair of people) {
  const [uid, email] = pair.split('=')
  try {
    await getAuth().createUser({ uid, email, password: 'align-dev' })
  } catch (err) {
    if (err.code !== 'auth/uid-already-exists' && err.code !== 'auth/email-already-exists') throw err
  }
}
console.log(`restored ${written} documents; ${people.length} logins (password align-dev)`)
