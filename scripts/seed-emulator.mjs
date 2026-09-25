// Seeds the local emulators with test accounts and the household document.
// Only ever talks to the emulators: the demo- project ID can't reach real Firebase.
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'

initializeApp({ projectId: 'demo-align' })

const PASSWORD = 'align-dev'
const people = [
  { uid: 'steve', email: 'steve@example.com', displayName: 'Steve', role: 'member', color: '#1f6feb' },
  { uid: 'wife', email: 'wife@example.com', displayName: 'Wife', role: 'member', color: '#bf3989' },
  { uid: 'daughter', email: 'daughter@example.com', displayName: 'Daughter', role: 'member', color: '#bc4c00' },
  { uid: 'grandparent', email: 'grandparent@example.com', displayName: 'Grandparent', role: 'viewer', color: '#57606a' },
]

for (const { uid, email, displayName } of people) {
  try {
    await getAuth().createUser({ uid, email, displayName, password: PASSWORD })
  } catch (err) {
    if (err.code !== 'auth/uid-already-exists') throw err
  }
}

await getFirestore()
  .doc('household/main')
  .set({
    name: 'Nelson Household',
    members: Object.fromEntries(people.map(({ uid, displayName, role, color }) => [uid, { role, displayName, color }])),
    pets: [
      { id: 'dog1', name: 'Dog 1', kind: 'dog' },
      { id: 'dog2', name: 'Dog 2', kind: 'dog' },
      { id: 'cat1', name: 'Cat 1', kind: 'cat' },
      { id: 'cat2', name: 'Cat 2', kind: 'cat' },
      { id: 'bird', name: 'Bird', kind: 'bird' },
      { id: 'fish', name: 'Fish', kind: 'fish' },
    ],
    weeklyTokens: 10,
    tokenStartDate: Timestamp.now(),
  })

console.log(`Seeded ${people.length} accounts (password "${PASSWORD}") and household/main.`)
