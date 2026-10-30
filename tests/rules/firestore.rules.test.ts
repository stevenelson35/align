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
  parentsOnly: {
    name: 'Gift ideas', kind: 'checklist', visibility: 'shared', sharedWith: ['steve', 'wife'], ownerId: 'steve', viewerVisible: false, defaultContext: 'family',
  },
} as Record<string, Record<string, unknown>>

function task(listId: keyof typeof lists, overrides: Record<string, unknown> = {}) {
  const list = lists[listId]
  return {
    listId,
    ...(list.sharedWith ? { sharedWith: list.sharedWith } : {}),
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
        wife: { role: 'member', displayName: 'Sam', color: '#1a7f37' },
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

describe('goals', () => {
  const goal = (over: Record<string, unknown> = {}) => ({
    name: 'Push-ups', kind: 'progressive', visibility: 'private', ownerId: 'steve', viewerVisible: false,
    progression: { start: 10, step: 1, every: 2, per: 'day', from: '2026-10-20' }, createdBy: 'steve', ...over,
  })

  it('keeps a private goal to its owner, who can log days', async () => {
    await assertSucceeds(setDoc(doc(db('steve'), 'goals/p'), goal()))
    await assertSucceeds(updateDoc(doc(db('steve'), 'goals/p'), { 'log.2026-10-20.value': 12 }))
    await assertFails(getDoc(doc(db('daughter'), 'goals/p')))
    await assertFails(updateDoc(doc(db('daughter'), 'goals/p'), { 'log.2026-10-20.value': 50 }))
  })

  it('shares family and chosen-people goals like lists', async () => {
    await assertSucceeds(setDoc(doc(db('steve'), 'goals/dogs'), goal({ name: 'Walk dogs', kind: 'check', visibility: 'family', progression: null })))
    await assertSucceeds(updateDoc(doc(db('daughter'), 'goals/dogs'), { 'log.2026-10-20.done': true }))
    await assertSucceeds(setDoc(doc(db('steve'), 'goals/both'), goal({ visibility: 'shared', sharedWith: ['steve', 'wife'] })))
    await assertSucceeds(getDoc(doc(db('wife'), 'goals/both')))
    await assertFails(getDoc(doc(db('daughter'), 'goals/both')))
    await assertSucceeds(getDocs(query(collection(db('wife'), 'goals'), where('sharedWith', 'array-contains', 'wife'))))
  })

  it('separates who can view a goal from who can log it', async () => {
    // Steve's weight: everyone may view, only Steve logs.
    await assertSucceeds(setDoc(doc(db('steve'), 'goals/weight'), goal({ name: 'Weight', kind: 'progressive', visibility: 'family', viewerVisible: true, editAudience: 'private' })))
    await assertSucceeds(getDoc(doc(db('wife'), 'goals/weight')))
    await assertSucceeds(getDoc(doc(db('grandma'), 'goals/weight')))
    await assertFails(updateDoc(doc(db('wife'), 'goals/weight'), { 'log.2026-10-21.value': 150 }))
    await assertSucceeds(updateDoc(doc(db('steve'), 'goals/weight'), { 'log.2026-10-21.value': 199 }))
    // Vacation savings: chosen people log; only the owner changes the goal.
    await assertSucceeds(setDoc(doc(db('steve'), 'goals/vacation'), goal({ name: 'Vacation', kind: 'total', visibility: 'family', editAudience: 'shared', editors: ['steve', 'wife'] })))
    await assertSucceeds(updateDoc(doc(db('wife'), 'goals/vacation'), { 'log.2026-10-21.value': 50 }))
    await assertFails(updateDoc(doc(db('wife'), 'goals/vacation'), { name: 'My vacation' }))
    await assertFails(updateDoc(doc(db('daughter'), 'goals/vacation'), { 'log.2026-10-21.value': 5 }))
    await assertFails(deleteDoc(doc(db('wife'), 'goals/vacation')))
    // Family can log: any member, log only.
    await assertSucceeds(setDoc(doc(db('steve'), 'goals/dishes'), goal({ name: 'Dishes', kind: 'check', visibility: 'family', editAudience: 'family' })))
    await assertSucceeds(updateDoc(doc(db('daughter'), 'goals/dishes'), { 'log.2026-10-21.done': true }))
    await assertFails(updateDoc(doc(db('grandma'), 'goals/dishes'), { 'log.2026-10-21.done': true }))
  })

  it('rejects malformed goals and viewer writes', async () => {
    await assertFails(setDoc(doc(db('steve'), 'goals/bad'), goal({ kind: 'diet' })))
    await assertFails(setDoc(doc(db('steve'), 'goals/bad2'), goal({ name: '' })))
    await assertFails(setDoc(doc(db('steve'), 'goals/bad3'), goal({ ownerId: 'wife' })))
    await assertFails(setDoc(doc(db('grandma'), 'goals/g'), goal({ ownerId: 'grandma', createdBy: 'grandma' })))
  })
})

describe('sharing with chosen people', () => {
  it('lets only the people on a shared list read it and its items', async () => {
    for (const uid of ['steve', 'wife']) {
      await assertSucceeds(getDoc(doc(db(uid), 'lists/parentsOnly')))
      await assertSucceeds(getDoc(doc(db(uid), 'tasks/parentsOnlyTask')))
    }
    for (const uid of ['daughter', 'grandma']) {
      await assertFails(getDoc(doc(db(uid), 'lists/parentsOnly')))
      await assertFails(getDoc(doc(db(uid), 'tasks/parentsOnlyTask')))
    }
  })

  it('allows the "shared with me" query, only for yourself', async () => {
    await assertSucceeds(getDocs(query(collection(db('wife'), 'lists'), where('sharedWith', 'array-contains', 'wife'))))
    await assertSucceeds(getDocs(query(collection(db('wife'), 'tasks'), where('sharedWith', 'array-contains', 'wife'))))
    await assertSucceeds(getDocs(query(collection(db('daughter'), 'tasks'), where('sharedWith', 'array-contains', 'daughter'))))
    await assertFails(getDocs(query(collection(db('daughter'), 'tasks'), where('sharedWith', 'array-contains', 'wife'))))
  })

  it('lets members on the list edit it and add items; others cannot', async () => {
    await assertSucceeds(updateDoc(doc(db('wife'), 'tasks/parentsOnlyTask'), { status: 'done' }))
    await assertSucceeds(setDoc(doc(db('wife'), 'tasks/gift2'), task('parentsOnly', { createdBy: 'wife', title: 'Bike' })))
    await assertFails(updateDoc(doc(db('daughter'), 'tasks/parentsOnlyTask'), { status: 'done' }))
    await assertFails(setDoc(doc(db('daughter'), 'tasks/gift3'), task('parentsOnly', { createdBy: 'daughter' })))
  })

  it('checks the shape: owner included, sharedWith only on shared, items copy the list', async () => {
    const base = lists.parentsOnly
    await assertSucceeds(setDoc(doc(db('steve'), 'lists/ok'), { ...base, sharedWith: ['steve', 'daughter'] }))
    await assertFails(setDoc(doc(db('steve'), 'lists/noOwner'), { ...base, sharedWith: ['wife'] }))
    const { sharedWith: _omit, ...noList } = base
    await assertFails(setDoc(doc(db('steve'), 'lists/noList'), noList))
    await assertFails(setDoc(doc(db('steve'), 'lists/privateWithList'), { ...lists.stevePrivate, sharedWith: ['steve'] }))
    await assertFails(setDoc(doc(db('steve'), 'tasks/mismatch'), task('parentsOnly', { sharedWith: ['steve'] })))
  })

  it('can include a viewer, who may read but not change it', async () => {
    await assertSucceeds(updateDoc(doc(db('steve'), 'lists/parentsOnly'), { sharedWith: ['steve', 'wife', 'grandma'] }))
    await assertSucceeds(getDoc(doc(db('grandma'), 'lists/parentsOnly')))
    await assertFails(updateDoc(doc(db('grandma'), 'lists/parentsOnly'), { name: 'Mine now' }))
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

  it('lets a member set only their own default visibility, to one of the choices', async () => {
    await assertSucceeds(updateDoc(doc(db('daughter'), 'household/main'), { 'members.daughter.defaultVisibility': 'family' }))
    await assertSucceeds(updateDoc(doc(db('daughter'), 'household/main'), { 'members.daughter.defaultVisibility': 'private' }))
    await assertSucceeds(updateDoc(doc(db('daughter'), 'household/main'), { 'members.daughter.defaultVisibility': 'everyone' }))
    await assertSucceeds(updateDoc(doc(db('daughter'), 'household/main'), { 'members.daughter.defaultVisibility': 'parents' }))
    await assertFails(updateDoc(doc(db('daughter'), 'household/main'), { 'members.daughter.defaultVisibility': 'the world' }))
    await assertFails(updateDoc(doc(db('daughter'), 'household/main'), { 'members.steve.defaultVisibility': 'family' }))
  })

  it('lets a member arrange their own Today (More… and contacts / links on it), and no one else’s', async () => {
    await assertSucceeds(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.todayMore': ['gifts', 'links'], 'members.wife.todayItems': ['contact1'] }))
    await assertFails(updateDoc(doc(db('wife'), 'household/main'), { 'members.steve.todayMore': [] }))
    await assertFails(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.todayItems': 'contact1' }))
    await assertFails(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.todayMore': Array.from({ length: 31 }, (_, i) => `s${i}`) }))
  })
  it('lets a member pin lists and contacts to their own Today sections, and no one else’s', async () => {
    await assertSucceeds(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.pinned': ['familyVisible', 'contact1'] }))
    await assertFails(updateDoc(doc(db('wife'), 'household/main'), { 'members.steve.pinned': ['familyVisible'] }))
    await assertFails(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.pinned': 'familyVisible' }))
    await assertFails(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.pinned': Array.from({ length: 201 }, (_, i) => `l${i}`) }))
  })
  it('lets a member set their own mobile number and the Parents group', async () => {
    await assertSucceeds(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.phone': '+1 555 010 0100' }))
    await assertFails(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.phone': 'x'.repeat(40) }))
    await assertFails(updateDoc(doc(db('wife'), 'household/main'), { 'members.steve.phone': '+1 555 010 0199' }))
    await assertSucceeds(updateDoc(doc(db('wife'), 'household/main'), { groups: { parents: ['steve', 'wife'] } }))
    await assertFails(updateDoc(doc(db('wife'), 'household/main'), { groups: 'parents' }))
    // Once set, only a parent can change who the parents are: the daughter can't opt in.
    await assertFails(updateDoc(doc(db('daughter'), 'household/main'), { 'groups.parents': ['steve', 'wife', 'daughter'] }))
    await assertSucceeds(updateDoc(doc(db('daughter'), 'household/main'), { 'members.daughter.displayName': 'Kiddo' }))
    await assertSucceeds(updateDoc(doc(db('steve'), 'household/main'), { 'groups.parents': ['steve'] }))
    await assertFails(updateDoc(doc(db('grandma'), 'household/main'), { groups: { parents: ['grandma'] } }))
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

describe('household setup', () => {
  const fresh = (uid: string) => ({
    name: 'New Household',
    members: { [uid]: { role: 'member', displayName: 'Me', color: '#1f6feb' } },
    pets: [],
    weeklyTokens: 10,
    tokenStartDate: new Date('2026-10-05'),
  })
  const removeHousehold = () =>
    env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore() as unknown as Firestore, 'household/main')))

  it('lets a signed-in user see that no household exists and create it as a member', async () => {
    await removeHousehold()
    await assertSucceeds(getDoc(doc(db('stranger'), 'household/main')))
    await assertFails(getDoc(doc(db(), 'household/main')))
    await assertFails(setDoc(doc(db('stranger'), 'household/main'), { ...fresh('stranger'), extra: true }))
    await assertFails(setDoc(doc(db('stranger'), 'household/main'), fresh('someoneElse')))
    await assertSucceeds(setDoc(doc(db('stranger'), 'household/main'), fresh('stranger')))
  })

  it('cannot be used to take over an existing household', async () => {
    await assertFails(setDoc(doc(db('stranger'), 'household/main'), fresh('stranger')))
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

  it('accepts checklists, notes and links lists', async () => {
    await assertSucceeds(setDoc(doc(db('steve'), 'lists/bookmarks'), { ...lists.familyVisible, kind: 'links' }))
    await assertSucceeds(setDoc(doc(db('steve'), 'tasks/link1'), task('familyVisible', { url: 'https://example.com', category: 'Home/Utilities' })))
    await assertFails(setDoc(doc(db('steve'), 'tasks/link2'), task('familyVisible', { url: 'x'.repeat(3000) })))
    await assertSucceeds(setDoc(doc(db('steve'), 'tasks/read1'), task('familyVisible', { title: 'Read: x', url: 'https://example.com', linkId: 'link1' })))
    await assertFails(setDoc(doc(db('steve'), 'tasks/read2'), task('familyVisible', { linkId: 42 })))
    await assertSucceeds(setDoc(doc(db('steve'), 'lists/shopping'), { ...lists.familyVisible, kind: 'checklist' }))
    await assertSucceeds(setDoc(doc(db('steve'), 'lists/wifi'), { ...lists.familyVisible, kind: 'notes' }))
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

  it('accepts day history fields, and rejects malformed ones', async () => {
    await assertSucceeds(setDoc(doc(db('steve'), 'tasks/h1'), task('familyVisible', { status: 'done', finishedOn: '2026-10-19', pushedFrom: ['2026-10-18'] })))
    await assertFails(setDoc(doc(db('steve'), 'tasks/h2'), task('familyVisible', { finishedOn: 20261019 })))
    await assertFails(setDoc(doc(db('steve'), 'tasks/h3'), task('familyVisible', { pushedFrom: '2026-10-18' })))
  })

  it('accepts every task status, including canceled', async () => {
    for (const status of ['todo', 'doing', 'done', 'canceled']) {
      await assertSucceeds(setDoc(doc(db('steve'), `tasks/s-${status}`), task('familyVisible', { status })))
    }
  })

  it('rejects invalid tasks and forged creators', async () => {
    await assertFails(setDoc(doc(db('steve'), 'tasks/t6'), task('familyVisible', { status: 'someday' })))
    await assertFails(setDoc(doc(db('steve'), 'tasks/t7'), task('familyVisible', { durationDays: 0 })))
    await assertFails(setDoc(doc(db('steve'), 'tasks/t8'), task('familyVisible', { createdBy: 'daughter' })))
    await assertFails(updateDoc(doc(db('daughter'), 'tasks/familyVisibleTask'), { createdBy: 'daughter' }))
  })

  it('accepts calendar-imported tasks with a fixed id, and rejects a malformed calendar field', async () => {
    const imported = task('familyVisible', { title: 'Vet', startDate: '2026-10-12', calendar: { eventId: 'abc', time: '3:00 PM–3:30 PM' } })
    await assertSucceeds(setDoc(doc(db('steve'), 'tasks/gcal_abc'), imported))
    await assertSucceeds(updateDoc(doc(db('steve'), 'tasks/gcal_abc'), { startDate: '2026-10-13', calendar: { eventId: 'abc' } }))
    await assertFails(setDoc(doc(db('steve'), 'tasks/gcal_bad'), task('familyVisible', { calendar: 'abc' })))
  })

  it('allows the queries the app will run', async () => {
    const tasks = (uid: string) => collection(db(uid), 'tasks')
    await assertSucceeds(getDocs(query(tasks('steve'), where('ownerId', '==', 'steve'), where('visibility', '==', 'private'))))
    await assertSucceeds(getDocs(query(tasks('daughter'), where('visibility', '==', 'family'))))
    await assertSucceeds(getDocs(query(tasks('steve'), where('visibility', '==', 'family'), where('listId', '==', 'familyVisible'))))
    await assertSucceeds(getDocs(query(tasks('grandma'), where('visibility', '==', 'family'), where('viewerVisible', '==', true))))
    await assertFails(getDocs(query(tasks('grandma'), where('visibility', '==', 'family'))))
    await assertFails(getDocs(tasks('daughter')))
  })
})

describe('who can edit a list', () => {
  it('lets everyone see a list but only its owner (or its editors) change it and its tasks', async () => {
    const seeAll = { name: 'Steve’s errands', kind: 'list', visibility: 'family', ownerId: 'steve', viewerVisible: true, defaultContext: 'family', editAudience: 'private' }
    await assertSucceeds(setDoc(doc(db('steve'), 'lists/mine'), seeAll))
    const t = { listId: 'mine', title: 'Dentist', status: 'todo', priority: 2, context: 'family', durationDays: 1, dependsOn: [], visibility: 'family', ownerId: 'steve', viewerVisible: true, editAudience: 'private', createdBy: 'steve' }
    await assertSucceeds(setDoc(doc(db('steve'), 'tasks/m1'), t))
    await assertSucceeds(getDoc(doc(db('wife'), 'tasks/m1'))) // everyone can see it
    await assertSucceeds(getDoc(doc(db('grandma'), 'tasks/m1')))
    await assertFails(updateDoc(doc(db('wife'), 'tasks/m1'), { status: 'done' })) // but only Steve edits
    await assertFails(setDoc(doc(db('wife'), 'tasks/m2'), { ...t, createdBy: 'wife' }))
    await assertFails(updateDoc(doc(db('wife'), 'lists/mine'), { name: 'Mine now', editAudience: 'family' }))
    await assertFails(setDoc(doc(db('steve'), 'tasks/m3'), { ...t, editAudience: 'family' })) // tasks match their list
    // Steve lets Sam edit too (Chosen people), and she can.
    const steve = db('steve')
    const batch = writeBatch(steve)
    batch.update(doc(steve, 'lists/mine'), { editAudience: 'shared', editors: ['steve', 'wife'] })
    batch.update(doc(steve, 'tasks/m1'), { editAudience: 'shared', editors: ['steve', 'wife'] })
    await assertSucceeds(batch.commit())
    await assertSucceeds(updateDoc(doc(db('wife'), 'tasks/m1'), { status: 'done' }))
    await assertFails(updateDoc(doc(db('daughter'), 'tasks/m1'), { status: 'todo' }))
    // Lists without editAudience keep the old rule: family members can edit.
    await assertSucceeds(updateDoc(doc(db('wife'), 'lists/familyVisible'), { name: 'Chores!' }))
  })
})

describe('pick lists', () => {
  it('lets everyone who can see an item rate it (their own stars, 1–5) and mark it watched', async () => {
    const list = { name: 'Movies', kind: 'picks', pickKind: 'movies', visibility: 'family', ownerId: 'steve', viewerVisible: true, defaultContext: 'family', editAudience: 'private' }
    await assertSucceeds(setDoc(doc(db('steve'), 'lists/movies'), list))
    const t = { listId: 'movies', title: 'Paddington', status: 'todo', priority: 2, context: 'family', durationDays: 1, dependsOn: [], visibility: 'family', ownerId: 'steve', viewerVisible: true, editAudience: 'private', createdBy: 'steve' }
    await assertSucceeds(setDoc(doc(db('steve'), 'tasks/p1'), t))
    await assertSucceeds(updateDoc(doc(db('wife'), 'tasks/p1'), { 'ratings.wife': 5 })) // she can't edit the list, but can rate
    await assertSucceeds(updateDoc(doc(db('daughter'), 'tasks/p1'), { 'ratings.daughter': 2, watched: ['2026-10-22'] }))
    await assertFails(updateDoc(doc(db('wife'), 'tasks/p1'), { 'ratings.daughter': 5 })) // not someone else's
    await assertFails(updateDoc(doc(db('wife'), 'tasks/p1'), { 'ratings.wife': 9 }))
    await assertFails(updateDoc(doc(db('wife'), 'tasks/p1'), { 'ratings.wife': 4, title: 'Paddington 2' })) // nothing else
    await assertFails(updateDoc(doc(db('grandma'), 'tasks/p1'), { 'ratings.grandma': 5 })) // view-only accounts don't rate
    await assertSucceeds(updateDoc(doc(db('steve'), 'tasks/p1'), { title: 'Paddington 2' }))
    // Contacts: the contact details are a map on the item (lists of kind 'contacts').
    await assertSucceeds(setDoc(doc(db('steve'), 'lists/people'), { name: 'Contacts', kind: 'contacts', visibility: 'family', ownerId: 'steve', viewerVisible: false, defaultContext: 'family' }))
    const person = { listId: 'people', title: 'Sam Lee', status: 'todo', priority: 2, context: 'family', durationDays: 1, dependsOn: [], visibility: 'family', ownerId: 'steve', viewerVisible: false, createdBy: 'steve' }
    await assertSucceeds(setDoc(doc(db('steve'), 'tasks/c1'), { ...person, contact: { phones: [{ label: 'mobile', value: '407 555 0100' }] } }))
    await assertFails(setDoc(doc(db('steve'), 'tasks/c2'), { ...person, contact: 'not a map' }))
    // Flashcards: anyone who can see a card records only their own result.
    await assertSucceeds(updateDoc(doc(db('daughter'), 'tasks/p1'), { 'results.daughter': { known: true, right: 1, wrong: 0, last: '2026-10-23' } }))
    await assertFails(updateDoc(doc(db('daughter'), 'tasks/p1'), { 'results.wife': { known: true } }))
    await assertFails(updateDoc(doc(db('daughter'), 'tasks/p1'), { 'results.daughter': 'yes' }))
  })
})

describe('pinned links', () => {
  it('lets a member pin links to their own menu only', async () => {
    await assertSucceeds(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.pinnedLinks': ['link1', 'link2'] }))
    await assertFails(updateDoc(doc(db('wife'), 'household/main'), { 'members.steve.pinnedLinks': ['link1'] }))
    await assertFails(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.pinnedLinks': 'link1' }))
    await assertSucceeds(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.newTaskDue': 'none' }))
    await assertFails(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.newTaskDue': 'someday' }))
  })
})

describe('your color', () => {
  it('lets a member change their own color to a plain #rrggbb only', async () => {
    await assertSucceeds(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.color': '#bf3989' }))
    await assertFails(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.color': 'red; background: url(x)' }))
    await assertFails(updateDoc(doc(db('wife'), 'household/main'), { 'members.steve.color': '#bf3989' }))
    await assertFails(updateDoc(doc(db('grandma'), 'household/main'), { 'members.grandma.color': '#0f7b7d' })) // viewers can't change the household
    // Other settings still save while the color is left as it was.
    await assertSucceeds(updateDoc(doc(db('wife'), 'household/main'), { 'members.wife.newTaskDue': 'none' }))
  })
})

describe('household config', () => {
  it('lets members set shared integration keys that only the household can read', async () => {
    await assertSucceeds(setDoc(doc(db('wife'), 'config/integrations'), { rescueGroupsKey: 'abc123' }))
    await assertSucceeds(getDoc(doc(db('grandma'), 'config/integrations')))
    await assertFails(getDoc(doc(db(), 'config/integrations'))) // signed out
    await assertFails(setDoc(doc(db('grandma'), 'config/integrations'), { rescueGroupsKey: 'x' })) // viewers
    await assertFails(setDoc(doc(db('wife'), 'config/other'), { x: 1 }))
  })
})

describe('stored pictures', () => {
  const pic = (createdBy: string, extra: Record<string, unknown> = {}) => ({
    data: 'data:image/jpeg;base64,/9j/4AAQ',
    width: 10,
    height: 8,
    createdBy,
    createdAt: new Date(),
    ...extra,
  })

  it('lets members add pictures, the household open them by id, and only the adder delete them', async () => {
    await assertSucceeds(setDoc(doc(db('steve'), 'images/p1'), pic('steve')))
    await assertFails(setDoc(doc(db('steve'), 'images/p2'), pic('wife'))) // posing as someone else
    await assertSucceeds(setDoc(doc(db('grandma'), 'images/p3'), pic('grandma'))) // viewers add them too (gift ideas)
    await assertFails(setDoc(doc(db('steve'), 'images/p4'), pic('steve', { data: 'https://example.com/x.jpg' })))
    await assertFails(setDoc(doc(db('steve'), 'images/p5'), pic('steve', { data: 'data:image/jpeg;base64,' + 'A'.repeat(1000001) })))
    await assertFails(setDoc(doc(db('steve'), 'images/p6'), pic('steve', { listId: 'x' })))
    for (const uid of ['steve', 'wife', 'grandma']) await assertSucceeds(getDoc(doc(db(uid), 'images/p1')))
    await assertFails(getDoc(doc(db(), 'images/p1'))) // signed out
    await assertFails(getDocs(collection(db('steve'), 'images'))) // no listing
    await assertFails(updateDoc(doc(db('steve'), 'images/p1'), { width: 11 }))
    await assertFails(deleteDoc(doc(db('wife'), 'images/p1')))
    await assertSucceeds(deleteDoc(doc(db('steve'), 'images/p1')))
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

  it('lets members add a note, link and picture to items', async () => {
    await assertSucceeds(updateDoc(doc(db('daughter'), 'boards/movies/items/m1'), { note: 'The bear one', url: 'https://example.com', imageUrl: 'https://res.cloudinary.com/x/p.jpg' }))
    await assertFails(updateDoc(doc(db('daughter'), 'boards/movies/items/m1'), { note: 'x'.repeat(6000) }))
    await assertFails(updateDoc(doc(db('grandma'), 'boards/movies/items/m1'), { note: 'viewers cannot' }))
  })

  it('allows up to 10 links and 10 pictures on items and tasks', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => `https://example.com/${i}`)
    await assertSucceeds(updateDoc(doc(db('daughter'), 'boards/movies/items/m1'), { links: ten, images: ['https://example.com/a.jpg'] }))
    await assertFails(updateDoc(doc(db('daughter'), 'boards/movies/items/m1'), { links: [...ten, 'https://example.com/11'] }))
    await assertFails(updateDoc(doc(db('daughter'), 'boards/movies/items/m1'), { images: 'https://example.com/a.jpg' }))
    await assertSucceeds(setDoc(doc(db('steve'), 'tasks/pics1'), task('familyVisible', { links: ten, images: ten })))
    await assertFails(setDoc(doc(db('steve'), 'tasks/pics2'), task('familyVisible', { images: [...ten, 'https://example.com/x.jpg'] })))
  })

  it('lets members comment on boards and items, and change only their own comments', async () => {
    const c = (uid: string, text = 'Yes please') => ({ text, uid, createdAt: new Date() })
    await assertSucceeds(setDoc(doc(db('steve'), 'boards/movies/comments/c1'), c('steve')))
    await assertSucceeds(setDoc(doc(db('daughter'), 'boards/movies/items/m1/comments/c2'), c('daughter')))
    await assertFails(setDoc(doc(db('daughter'), 'boards/movies/comments/c3'), c('steve'))) // posing as someone else
    await assertFails(updateDoc(doc(db('daughter'), 'boards/movies/comments/c1'), { text: 'edited by someone else' }))
    await assertSucceeds(updateDoc(doc(db('steve'), 'boards/movies/comments/c1'), { text: 'Changed my mind' }))
    await assertFails(deleteDoc(doc(db('daughter'), 'boards/movies/comments/c1')))
    await assertSucceeds(deleteDoc(doc(db('steve'), 'boards/movies/comments/c1')))
    await assertSucceeds(getDocs(collection(db('grandma'), 'boards/movies/items/m1/comments'))) // viewers read visible boards
    await assertFails(setDoc(doc(db('grandma'), 'boards/movies/comments/c4'), c('grandma')))
    await assertFails(getDocs(collection(db('grandma'), 'boards/secret/comments')))
  })

  it('lets people who can see a task or goal comment on it, and change only their own comments', async () => {
    const c = (uid: string, text = 'On it') => ({ text, uid, createdAt: new Date() })
    await assertSucceeds(setDoc(doc(db('steve'), 'tasks/fam1'), task('familyVisible')))
    await assertSucceeds(setDoc(doc(db('steve'), 'tasks/priv1'), task('stevePrivate')))
    await assertSucceeds(setDoc(doc(db('wife'), 'tasks/fam1/comments/c1'), c('wife')))
    await assertSucceeds(setDoc(doc(db('steve'), 'tasks/fam1/comments/c2'), c('steve')))
    await assertSucceeds(getDocs(collection(db('grandma'), 'tasks/fam1/comments'))) // the task is visible to viewers
    await assertFails(setDoc(doc(db('grandma'), 'tasks/fam1/comments/c3'), c('grandma'))) // viewers don't write
    await assertFails(setDoc(doc(db('wife'), 'tasks/priv1/comments/c4'), c('wife'))) // can't see the task
    await assertFails(getDocs(collection(db('wife'), 'tasks/priv1/comments')))
    await assertFails(updateDoc(doc(db('wife'), 'tasks/fam1/comments/c2'), { text: 'edited by someone else' }))
    await assertSucceeds(updateDoc(doc(db('wife'), 'tasks/fam1/comments/c1'), { text: 'Done, actually', uid: 'wife', edited: true }))
    await assertFails(deleteDoc(doc(db('wife'), 'tasks/fam1/comments/c2')))
    await assertSucceeds(deleteDoc(doc(db('wife'), 'tasks/fam1/comments/c1')))
    await assertSucceeds(setDoc(doc(db('steve'), 'goals/g1'), { name: 'Walk', kind: 'check', visibility: 'private', ownerId: 'steve', viewerVisible: false, createdBy: 'steve' }))
    await assertSucceeds(setDoc(doc(db('steve'), 'goals/g1/comments/c5'), c('steve')))
    await assertFails(setDoc(doc(db('wife'), 'goals/g1/comments/c6'), c('wife'))) // a private goal
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

describe('family map locations', () => {
  const point = { lat: 28.6, lon: -81.35, acc: 12, batt: 80, tst: 1761400000000, trail: [], off: false }
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore() as unknown as Firestore, 'household/main'), { 'members.bot': { role: 'member', displayName: 'Calendar', color: '#57606a', bot: true } })
    })
  })
  it('lets the helper account post a member’s location, which members (not viewers) can see', async () => {
    await assertSucceeds(setDoc(doc(db('bot'), 'locations/steve'), point))
    await assertSucceeds(getDoc(doc(db('wife'), 'locations/steve')))
    await assertSucceeds(getDocs(collection(db('daughter'), 'locations')))
    await assertFails(getDoc(doc(db('grandma'), 'locations/steve')))
    await assertFails(getDoc(doc(db(), 'locations/steve')))
  })
  it('keeps people from posting someone else’s location, or for a non-member', async () => {
    await assertFails(setDoc(doc(db('wife'), 'locations/steve'), point))
    await assertFails(setDoc(doc(db('bot'), 'locations/grandma'), point))
    await assertFails(setDoc(doc(db('bot'), 'locations/stranger'), point))
    await assertSucceeds(setDoc(doc(db('wife'), 'locations/wife'), point))
  })
  it('honors a pause: the helper can neither update a paused person nor pause or unpause anyone', async () => {
    await assertSucceeds(setDoc(doc(db('steve'), 'locations/steve'), { off: true }))
    await assertFails(setDoc(doc(db('bot'), 'locations/steve'), point))
    await assertFails(setDoc(doc(db('bot'), 'locations/daughter'), { ...point, off: true }))
    await assertSucceeds(setDoc(doc(db('steve'), 'locations/steve'), { off: false }, { merge: true }))
    await assertSucceeds(setDoc(doc(db('bot'), 'locations/steve'), point))
  })
  it('checks the shape and lets only the person delete theirs', async () => {
    await assertFails(setDoc(doc(db('bot'), 'locations/steve'), { ...point, lat: 123 }))
    await assertFails(setDoc(doc(db('bot'), 'locations/steve'), { ...point, extra: 1 }))
    await assertFails(setDoc(doc(db('bot'), 'locations/steve'), { ...point, trail: Array(101).fill({ lat: 1, lon: 1, tst: 1 }) }))
    await assertSucceeds(setDoc(doc(db('bot'), 'locations/steve'), point))
    await assertFails(deleteDoc(doc(db('wife'), 'locations/steve')))
    await assertFails(deleteDoc(doc(db('bot'), 'locations/steve')))
    await assertSucceeds(deleteDoc(doc(db('steve'), 'locations/steve')))
  })
})

describe('gift lists, secret ideas and claims', () => {
  const giftList = { name: 'Daughter Christmas', kind: 'gifts', recipientId: 'daughter', visibility: 'family', ownerId: 'daughter', viewerVisible: false, defaultContext: 'family' }
  const secret = {
    name: 'Daughter Christmas (secret ideas)', kind: 'gifts', recipientId: 'daughter', giftSecret: true, secretOf: 'gifts1',
    visibility: 'shared', sharedWith: ['steve', 'wife'], ownerId: 'steve', viewerVisible: false, defaultContext: 'family',
  }
  const item = (listId: string, l: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    listId, visibility: l.visibility, ownerId: l.ownerId, viewerVisible: l.viewerVisible, ...(l.sharedWith ? { sharedWith: l.sharedWith } : {}),
    title: 'Shorts', priority: 2, status: 'todo', context: 'family', durationDays: 1, dependsOn: [], createdBy: l.ownerId, ...extra,
  })
  const claim = (by: string, extra: Record<string, unknown> = {}) => ({ listId: 'gifts1', itemId: 'g1', recipientId: 'daughter', claimedBy: by, title: 'Shorts', qty: 1, bought: false, ...extra })
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore() as unknown as Firestore
      await setDoc(doc(admin, 'lists/gifts1'), giftList)
      await setDoc(doc(admin, 'lists/secret1'), secret)
      await setDoc(doc(admin, 'tasks/g1'), item('gifts1', giftList, { gift: { qty: 2, color: 'blue' }, noteIds: ['n1'] }))
      await setDoc(doc(admin, 'tasks/s1'), item('secret1', secret, { title: 'Necklace' }))
    })
  })
  it('hides the secret ideas from the recipient, and shows them to everyone else on it', async () => {
    await assertSucceeds(getDoc(doc(db('daughter'), 'tasks/g1')))
    await assertFails(getDoc(doc(db('daughter'), 'lists/secret1')))
    await assertFails(getDoc(doc(db('daughter'), 'tasks/s1')))
    await assertSucceeds(getDoc(doc(db('wife'), 'tasks/s1')))
    await assertSucceeds(setDoc(doc(db('wife'), 'tasks/s2'), item('secret1', secret, { title: 'Book', createdBy: 'wife' })))
  })
  it('refuses a secret list that includes the recipient, or a gift field elsewhere', async () => {
    await assertFails(setDoc(doc(db('steve'), 'lists/bad'), { ...secret, sharedWith: ['steve', 'daughter'] }))
    const { sharedWith: _unused, ...familySecret } = secret
    await assertFails(setDoc(doc(db('steve'), 'lists/bad2'), { ...familySecret, visibility: 'family' }))
    await assertFails(setDoc(doc(db('steve'), 'lists/bad3'), { ...lists.familyVisible, recipientId: 'daughter' }))
    await assertSucceeds(setDoc(doc(db('steve'), 'lists/ok'), { ...secret, secretOf: 'gifts1' }))
  })
  it('lets others claim a gift and see claims, but never the recipient', async () => {
    await assertSucceeds(setDoc(doc(db('steve'), 'giftClaims/g1_steve'), claim('steve')))
    await assertSucceeds(getDoc(doc(db('wife'), 'giftClaims/g1_steve')))
    await assertSucceeds(getDocs(query(collection(db('wife'), 'giftClaims'), where('recipientId', '==', 'daughter'))))
    await assertFails(getDoc(doc(db('daughter'), 'giftClaims/g1_steve')))
    await assertFails(getDocs(query(collection(db('daughter'), 'giftClaims'), where('recipientId', '==', 'daughter'))))
    await assertFails(getDocs(collection(db('daughter'), 'giftClaims')))
    await assertFails(getDoc(doc(db(), 'giftClaims/g1_steve')))
  })
  it('lets view-only accounts (extended family) claim and see claims, still never their own gifts', async () => {
    await assertSucceeds(setDoc(doc(db('grandma'), 'giftClaims/g1_grandma'), claim('grandma')))
    await assertSucceeds(getDocs(query(collection(db('grandma'), 'giftClaims'), where('recipientId', '==', 'daughter'))))
    await assertFails(getDoc(doc(db('daughter'), 'giftClaims/g1_grandma')))
    await assertFails(setDoc(doc(db('grandma'), 'tasks/x'), item('gifts1', giftList, { createdBy: 'grandma' })))
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore() as unknown as Firestore
      await setDoc(doc(admin, 'lists/forGrandma'), { ...giftList, recipientId: 'grandma', ownerId: 'steve' })
      await setDoc(doc(admin, 'tasks/gg'), item('forGrandma', { ...giftList, ownerId: 'steve' }))
    })
    await assertSucceeds(setDoc(doc(db('wife'), 'giftClaims/gg_wife'), { ...claim('wife'), listId: 'forGrandma', itemId: 'gg', recipientId: 'grandma' }))
    await assertFails(getDocs(query(collection(db('grandma'), 'giftClaims'), where('recipientId', '==', 'grandma'))))
    await assertFails(setDoc(doc(db('grandma'), 'giftClaims/gg_grandma'), { ...claim('grandma'), listId: 'forGrandma', itemId: 'gg', recipientId: 'grandma' }))
  })
  it('allows sharing a list with up to 50 people', async () => {
    const many = ['steve', ...Array.from({ length: 49 }, (_, i) => `cousin${i}`)]
    await assertSucceeds(setDoc(doc(db('steve'), 'lists/big'), { ...lists.parentsOnly, sharedWith: many }))
    await assertFails(setDoc(doc(db('steve'), 'lists/toobig'), { ...lists.parentsOnly, sharedWith: [...many, 'one-more'] }))
  })
  it('checks claims: your own, the real recipient, the right item; the recipient can’t claim', async () => {
    await assertFails(setDoc(doc(db('daughter'), 'giftClaims/g1_daughter'), claim('daughter')))
    await assertFails(setDoc(doc(db('steve'), 'giftClaims/g1_steve'), claim('steve', { recipientId: 'wife' })))
    await assertFails(setDoc(doc(db('steve'), 'giftClaims/g1_steve'), claim('steve', { recipientId: '' })))
    await assertFails(setDoc(doc(db('steve'), 'giftClaims/g1_wife'), claim('steve')))
    await assertFails(setDoc(doc(db('steve'), 'giftClaims/g1_steve'), claim('wife')))
    await assertFails(setDoc(doc(db('steve'), 'giftClaims/x_steve'), claim('steve', { itemId: 'x' })))
    await assertFails(setDoc(doc(db('steve'), 'giftClaims/g1_steve'), claim('steve', { qty: 0 })))
    await assertSucceeds(setDoc(doc(db('steve'), 'giftClaims/g1_steve'), claim('steve', { qty: 2, note: 'Target' })))
    await assertFails(setDoc(doc(db('wife'), 'giftClaims/g1_steve'), claim('steve', { bought: true })))
    await assertFails(deleteDoc(doc(db('wife'), 'giftClaims/g1_steve')))
    await assertSucceeds(setDoc(doc(db('steve'), 'giftClaims/g1_steve'), claim('steve', { bought: true })))
    await assertSucceeds(deleteDoc(doc(db('steve'), 'giftClaims/g1_steve')))
  })
  it('allows claims on a secret idea, still hidden from the recipient', async () => {
    await assertSucceeds(setDoc(doc(db('wife'), 'giftClaims/s1_wife'), { ...claim('wife'), listId: 'secret1', itemId: 's1', title: 'Necklace' }))
    await assertFails(getDoc(doc(db('daughter'), 'giftClaims/s1_wife')))
  })
})

describe('view-only accounts adding gift ideas', () => {
  const giftList = { name: 'Daughter Christmas', kind: 'gifts', recipientId: 'daughter', visibility: 'family', ownerId: 'daughter', viewerVisible: true, defaultContext: 'family' }
  const idea = (listId: string, l: Record<string, unknown>, by: string, extra: Record<string, unknown> = {}) => ({
    listId, visibility: l.visibility, ownerId: l.ownerId, viewerVisible: l.viewerVisible, ...(l.sharedWith ? { sharedWith: l.sharedWith } : {}),
    ...(l.editAudience ? { editAudience: l.editAudience } : {}),
    title: 'Puzzle', priority: 2, status: 'todo', context: 'family', durationDays: 1, dependsOn: [], createdBy: by, ...extra,
  })
  const companion = {
    name: 'Daughter Christmas (secret ideas)', kind: 'gifts', recipientId: 'daughter', giftSecret: true, secretOf: 'gl',
    visibility: 'shared', sharedWith: ['grandma', 'steve', 'wife'], ownerId: 'grandma', viewerVisible: false, defaultContext: 'family',
  }
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore() as unknown as Firestore
      await setDoc(doc(admin, 'lists/gl'), giftList)
      await setDoc(doc(admin, 'lists/onlyMe'), { ...giftList, editAudience: 'private' })
      await setDoc(doc(admin, 'tasks/byDaughter'), idea('gl', giftList, 'daughter', { title: 'Skates' }))
    })
  })
  it('lets a viewer make the secret companion and add secret ideas the recipient can’t see', async () => {
    await assertSucceeds(setDoc(doc(db('grandma'), 'lists/sec'), companion))
    await assertSucceeds(setDoc(doc(db('grandma'), 'tasks/v1'), idea('sec', companion, 'grandma')))
    await assertSucceeds(setDoc(doc(db('steve'), 'tasks/m1'), idea('sec', companion, 'steve', { title: 'Book' })))
    await assertFails(getDoc(doc(db('daughter'), 'tasks/v1')))
    await assertFails(setDoc(doc(db('grandma'), 'lists/sec2'), { ...companion, sharedWith: ['grandma', 'daughter'] }))
    await assertFails(setDoc(doc(db('grandma'), 'lists/sec3'), { ...companion, recipientId: 'wife' }))
    await assertFails(setDoc(doc(db('grandma'), 'lists/plain'), { ...lists.familyVisible, ownerId: 'grandma' }))
  })
  it('lets a viewer add to a gift list unless its owner narrowed who edits, and never to other lists', async () => {
    await assertSucceeds(setDoc(doc(db('grandma'), 'tasks/v2'), idea('gl', giftList, 'grandma')))
    await assertFails(setDoc(doc(db('grandma'), 'tasks/v3'), idea('onlyMe', { ...giftList, editAudience: 'private' }, 'grandma')))
    await assertFails(setDoc(doc(db('grandma'), 'tasks/v4'), task('familyVisible', { createdBy: 'grandma' })))
    await assertFails(setDoc(doc(db('grandma'), 'tasks/v5'), idea('gl', giftList, 'steve')))
  })
  it('lets a viewer change or remove only their own ideas', async () => {
    await assertSucceeds(setDoc(doc(db('grandma'), 'tasks/v6'), idea('gl', giftList, 'grandma')))
    await assertSucceeds(updateDoc(doc(db('grandma'), 'tasks/v6'), { title: 'Bigger puzzle', gift: { qty: 2 } }))
    await assertFails(updateDoc(doc(db('grandma'), 'tasks/byDaughter'), { title: 'Changed' }))
    await assertFails(updateDoc(doc(db('grandma'), 'tasks/v6'), { listId: 'familyVisible', visibility: 'family' }))
    await assertFails(deleteDoc(doc(db('grandma'), 'tasks/byDaughter')))
    await assertSucceeds(deleteDoc(doc(db('grandma'), 'tasks/v6')))
  })
})

describe('pictures from view-only accounts', () => {
  it('lets a viewer add and remove their own picture (for the gift ideas they suggest)', async () => {
    const pic = { data: 'data:image/jpeg;base64,AAAA', width: 10, height: 10, createdBy: 'grandma' }
    await assertSucceeds(setDoc(doc(db('grandma'), 'images/p1'), pic))
    await assertFails(setDoc(doc(db('grandma'), 'images/p2'), { ...pic, createdBy: 'steve' }))
    await assertFails(deleteDoc(doc(db('wife'), 'images/p1')))
    await assertSucceeds(deleteDoc(doc(db('grandma'), 'images/p1')))
  })
})

describe('places and alerts', () => {
  const place = { name: 'School', lat: 28.65, lon: -81.35, radius: 150, createdBy: 'steve' }
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore() as unknown as Firestore, 'household/main'), { 'members.bot': { role: 'member', displayName: 'Calendar', color: '#57606a', bot: true } })
    })
  })
  it('lets members (not viewers) see and manage places, with a sane shape', async () => {
    await assertSucceeds(setDoc(doc(db('steve'), 'places/school'), place))
    await assertSucceeds(getDocs(collection(db('bot'), 'places')))
    await assertSucceeds(updateDoc(doc(db('wife'), 'places/school'), { radius: 300 }))
    await assertFails(getDoc(doc(db('grandma'), 'places/school')))
    await assertFails(setDoc(doc(db('grandma'), 'places/park'), place))
    await assertFails(setDoc(doc(db('steve'), 'places/bad1'), { ...place, radius: 10 }))
    await assertFails(setDoc(doc(db('steve'), 'places/bad2'), { ...place, lat: 100 }))
    await assertFails(setDoc(doc(db('steve'), 'places/bad3'), { ...place, extra: true }))
    await assertSucceeds(deleteDoc(doc(db('wife'), 'places/school')))
  })
  it('keeps alert settings to their owner, readable by the helper account', async () => {
    const prefs = { rules: [{ person: 'daughter', place: 'school', enter: true, leave: false }], push: ['tok'], email: 's@example.com', emailOn: true }
    await assertSucceeds(setDoc(doc(db('steve'), 'alertPrefs/steve'), prefs))
    await assertFails(getDoc(doc(db('wife'), 'alertPrefs/steve')))
    await assertFails(setDoc(doc(db('wife'), 'alertPrefs/steve'), prefs))
    await assertSucceeds(getDocs(collection(db('bot'), 'alertPrefs')))
    await assertFails(getDocs(collection(db('wife'), 'alertPrefs')))
    await assertFails(setDoc(doc(db('steve'), 'alertPrefs/steve'), { ...prefs, push: Array(11).fill('t') }))
    await assertFails(setDoc(doc(db('grandma'), 'alertPrefs/grandma'), prefs))
  })
  it('lets the helper account record who is at which place, and recent arrivals', async () => {
    const loc = { lat: 28.65, lon: -81.35, tst: 1, trail: [], off: false, inside: ['school'], events: [{ place: 'school', name: 'School', kind: 'enter', tst: 1 }] }
    await assertSucceeds(setDoc(doc(db('bot'), 'locations/daughter'), loc))
    await assertFails(setDoc(doc(db('bot'), 'locations/daughter'), { ...loc, events: Array(21).fill(loc.events[0]) }))
    // A suspicious jump held aside until the next report (the helper writes just that field).
    await assertSucceeds(updateDoc(doc(db('bot'), 'locations/daughter'), { pending: { lat: 29.2, lon: -81.35, tst: 2 } }))
    await assertFails(updateDoc(doc(db('bot'), 'locations/daughter'), { pending: 'not a point' }))
  })
})
