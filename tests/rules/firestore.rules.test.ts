import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment

const lists = {
  stevePrivate: { name: 'Errands', kind: 'list', visibility: 'private', ownerId: 'steve', viewerVisible: false, defaultContext: 'family' },
  familyVisible: { name: 'Chores', kind: 'list', visibility: 'family', ownerId: 'steve', viewerVisible: true, defaultContext: 'family' },
  familyHidden: { name: 'Lawn', kind: 'project', visibility: 'family', ownerId: 'steve', viewerVisible: false, defaultContext: 'family' },
}

function task(listId: keyof typeof lists, overrides: Record<string, unknown> = {}) {
  const list = lists[listId]
  return {
    listId,
    visibility: list.visibility,
    ownerId: list.ownerId,
    viewerVisible: list.viewerVisible,
    title: 'Do the thing',
    priority: 2,
    status: 'todo',
    context: 'family',
    durationDays: 1,
    dependsOn: [],
    createdBy: 'steve',
    ...overrides,
  }
}

const db = (uid?: string): Firestore =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore() as unknown as Firestore

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-align',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore() as unknown as Firestore
    await setDoc(doc(admin, 'household/main'), {
      name: 'Test Household',
      members: {
        steve: { role: 'member', displayName: 'Steve', color: '#1f6feb' },
        daughter: { role: 'member', displayName: 'Daughter', color: '#d63384' },
        grandma: { role: 'viewer', displayName: 'Grandma', color: '#6f42c1' },
      },
      pets: [],
      weeklyTokens: 10,
      tokenStartDate: new Date('2026-09-21'),
    })
    for (const [id, list] of Object.entries(lists)) {
      await setDoc(doc(admin, 'lists', id), list)
      await setDoc(doc(admin, 'tasks', `${id}Task`), task(id as keyof typeof lists))
    }
    await setDoc(doc(admin, 'boards/movies'), { name: 'Movies & Shows', viewerVisible: true })
    await setDoc(doc(admin, 'boards/secret'), { name: 'Birthday Ideas', viewerVisible: false })
    await setDoc(doc(admin, 'boards/movies/items/m1'), { title: 'Paddington', status: 'open', createdBy: 'steve' })
    await setDoc(doc(admin, 'boards/secret/items/s1'), { title: 'Puppy', status: 'open', createdBy: 'steve' })
    await setDoc(doc(admin, 'boards/movies/items/m1/votes/steve'), { uid: 'steve', tokens: 3 })
  })
})

describe('household', () => {
  it('is readable by members and viewers only', async () => {
    await assertSucceeds(getDoc(doc(db('steve'), 'household/main')))
    await assertSucceeds(getDoc(doc(db('grandma'), 'household/main')))
    await assertFails(getDoc(doc(db('stranger'), 'household/main')))
    await assertFails(getDoc(doc(db(), 'household/main')))
  })

  it('lets a member edit their own display fields and household settings', async () => {
    await assertSucceeds(updateDoc(doc(db('daughter'), 'household/main'), { 'members.daughter.displayName': 'Kiddo' }))
    await assertSucceeds(updateDoc(doc(db('daughter'), 'household/main'), { weeklyTokens: 12 }))
  })

  it('blocks role changes, editing others, and viewer writes', async () => {
    await assertFails(updateDoc(doc(db('daughter'), 'household/main'), { 'members.daughter.role': 'viewer' }))
    await assertFails(updateDoc(doc(db('daughter'), 'household/main'), { 'members.steve.displayName': 'Dad' }))
    await assertFails(updateDoc(doc(db('grandma'), 'household/main'), { 'members.grandma.displayName': 'Nana' }))
    await assertFails(updateDoc(doc(db('steve'), 'household/main'), { name: 'Renamed' }))
    await assertFails(deleteDoc(doc(db('steve'), 'household/main')))
    await assertFails(setDoc(doc(db('stranger'), 'household/main'), { name: 'Mine' }))
  })
})

describe('lists', () => {
  it('keeps private lists private to their owner', async () => {
    await assertSucceeds(getDoc(doc(db('steve'), 'lists/stevePrivate')))
    await assertFails(getDoc(doc(db('daughter'), 'lists/stevePrivate')))
    await assertFails(getDoc(doc(db('grandma'), 'lists/stevePrivate')))
    await assertFails(updateDoc(doc(db('daughter'), 'lists/stevePrivate'), { name: 'Mine now' }))
  })

  it('lets a member create only private lists they own', async () => {
    await assertSucceeds(setDoc(doc(db('daughter'), 'lists/d1'), { ...lists.stevePrivate, ownerId: 'daughter' }))
    await assertFails(setDoc(doc(db('daughter'), 'lists/d2'), lists.stevePrivate))
    await assertFails(setDoc(doc(db('daughter'), 'lists/d3'), { ...lists.stevePrivate, ownerId: 'daughter', viewerVisible: true }))
  })

  it('shares family lists with members and, when marked, viewers', async () => {
    await assertSucceeds(getDoc(doc(db('daughter'), 'lists/familyHidden')))
    await assertSucceeds(updateDoc(doc(db('daughter'), 'lists/familyHidden'), { name: 'Lawn & Garden' }))
    await assertSucceeds(getDoc(doc(db('grandma'), 'lists/familyVisible')))
    await assertFails(getDoc(doc(db('grandma'), 'lists/familyHidden')))
    await assertFails(updateDoc(doc(db('grandma'), 'lists/familyVisible'), { name: 'Nope' }))
    await assertFails(getDoc(doc(db('stranger'), 'lists/familyVisible')))
  })

  it('only lets the owner change ownership', async () => {
    await assertFails(updateDoc(doc(db('daughter'), 'lists/familyVisible'), { ownerId: 'daughter' }))
    await assertSucceeds(updateDoc(doc(db('steve'), 'lists/familyVisible'), { ownerId: 'daughter' }))
  })

  it('rejects invalid lists', async () => {
    await assertFails(setDoc(doc(db('steve'), 'lists/bad'), { ...lists.familyVisible, kind: 'folder' }))
    await assertFails(setDoc(doc(db('steve'), 'lists/bad'), { ...lists.familyVisible, name: '' }))
  })
})

describe('tasks', () => {
  it('follows the visibility of the list', async () => {
    await assertSucceeds(getDoc(doc(db('steve'), 'tasks/stevePrivateTask')))
    await assertFails(getDoc(doc(db('daughter'), 'tasks/stevePrivateTask')))
    await assertSucceeds(getDoc(doc(db('daughter'), 'tasks/familyHiddenTask')))
    await assertSucceeds(getDoc(doc(db('grandma'), 'tasks/familyVisibleTask')))
    await assertFails(getDoc(doc(db('grandma'), 'tasks/familyHiddenTask')))
  })

  it('lets members add family tasks but viewers cannot', async () => {
    await assertSucceeds(setDoc(doc(db('daughter'), 'tasks/t1'), task('familyVisible', { createdBy: 'daughter' })))
    await assertFails(setDoc(doc(db('grandma'), 'tasks/t2'), task('familyVisible', { createdBy: 'grandma' })))
    await assertFails(setDoc(doc(db('daughter'), 'tasks/t3'), task('stevePrivate', { createdBy: 'daughter' })))
  })

  it('requires the copied list fields to match the list', async () => {
    await assertFails(setDoc(doc(db('steve'), 'tasks/t4'), task('familyHidden', { viewerVisible: true })))
    await assertFails(setDoc(doc(db('steve'), 'tasks/t5'), task('stevePrivate', { visibility: 'family' })))
  })

  it('allows a batch that changes a list and its tasks together', async () => {
    const steve = db('steve')
    const batch = writeBatch(steve)
    batch.update(doc(steve, 'lists/familyHidden'), { viewerVisible: true })
    batch.update(doc(steve, 'tasks/familyHiddenTask'), { viewerVisible: true })
    await assertSucceeds(batch.commit())
  })

  it('rejects invalid tasks and forged creators', async () => {
    await assertFails(setDoc(doc(db('steve'), 'tasks/t6'), task('familyVisible', { status: 'someday' })))
    await assertFails(setDoc(doc(db('steve'), 'tasks/t7'), task('familyVisible', { durationDays: 0 })))
    await assertFails(setDoc(doc(db('steve'), 'tasks/t8'), task('familyVisible', { createdBy: 'daughter' })))
    await assertFails(updateDoc(doc(db('daughter'), 'tasks/familyVisibleTask'), { createdBy: 'daughter' }))
  })

  it('allows the queries the app will run', async () => {
    const tasks = (uid: string) => collection(db(uid), 'tasks')
    await assertSucceeds(getDocs(query(tasks('steve'), where('ownerId', '==', 'steve'), where('visibility', '==', 'private'))))
    await assertSucceeds(getDocs(query(tasks('daughter'), where('visibility', '==', 'family'))))
    await assertSucceeds(getDocs(query(tasks('grandma'), where('visibility', '==', 'family'), where('viewerVisible', '==', true))))
    await assertFails(getDocs(query(tasks('grandma'), where('visibility', '==', 'family'))))
    await assertFails(getDocs(tasks('daughter')))
  })
})

describe('voting', () => {
  it('shows boards to members, and viewer-visible boards to viewers', async () => {
    await assertSucceeds(getDocs(collection(db('daughter'), 'boards')))
    await assertSucceeds(getDocs(query(collection(db('grandma'), 'boards'), where('viewerVisible', '==', true))))
    await assertFails(getDocs(collection(db('grandma'), 'boards')))
    await assertSucceeds(getDocs(collection(db('grandma'), 'boards/movies/items')))
    await assertFails(getDocs(collection(db('grandma'), 'boards/secret/items')))
    await assertFails(getDocs(collection(db('stranger'), 'boards/movies/items')))
  })

  it('lets members manage boards and items, not viewers', async () => {
    await assertSucceeds(setDoc(doc(db('daughter'), 'boards/food'), { name: 'Restaurants', viewerVisible: false }))
    await assertSucceeds(setDoc(doc(db('daughter'), 'boards/movies/items/m2'), { title: 'Moana', status: 'open', createdBy: 'daughter' }))
    await assertFails(setDoc(doc(db('daughter'), 'boards/movies/items/m3'), { title: 'Moana 2', status: 'maybe' }))
    await assertFails(setDoc(doc(db('grandma'), 'boards/movies/items/m4'), { title: 'Casablanca', status: 'open' }))
  })

  it('lets members cast only their own whole-number votes', async () => {
    await assertSucceeds(setDoc(doc(db('daughter'), 'boards/movies/items/m1/votes/daughter'), { uid: 'daughter', tokens: 5 }))
    await assertFails(setDoc(doc(db('daughter'), 'boards/movies/items/m1/votes/steve'), { uid: 'steve', tokens: 0 }))
    await assertFails(setDoc(doc(db('daughter'), 'boards/movies/items/m1/votes/daughter'), { uid: 'daughter', tokens: -1 }))
    await assertFails(setDoc(doc(db('daughter'), 'boards/movies/items/m1/votes/daughter'), { uid: 'daughter', tokens: 1.5 }))
    await assertFails(setDoc(doc(db('grandma'), 'boards/movies/items/m1/votes/grandma'), { uid: 'grandma', tokens: 1 }))
    await assertFails(deleteDoc(doc(db('daughter'), 'boards/movies/items/m1/votes/steve')))
  })

  it('allows the token-balance collection-group query for members', async () => {
    await assertSucceeds(getDocs(query(collectionGroup(db('steve'), 'votes'), where('uid', '==', 'steve'))))
    await assertFails(getDocs(query(collectionGroup(db('stranger'), 'votes'), where('uid', '==', 'stranger'))))
  })
})
