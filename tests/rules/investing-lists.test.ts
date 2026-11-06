import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment
const db = (uid: string) => env.authenticatedContext(uid).firestore()
const list = (over: Record<string, unknown> = {}) => ({
  ownerId: 'owner', name: 'Investments', kind: 'holdings', visibility: 'private', viewerVisible: false,
  symbols: ['AAPL'], positions: [{ symbol: 'AAPL', qty: 12, paid: 100 }], ...over,
})
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-investing-lists', firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
})
afterAll(async () => { await env.cleanup() })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'household/main'), {
      members: { owner: { role: 'member' }, spouse: { role: 'member' }, viewer: { role: 'viewer' }, bot: { role: 'member', bot: true } },
    })
  })
})

describe('independent investment list audiences', () => {
  it('lets migration get missing defaults, while refusing other private list access', async () => {
    await assertSucceeds(getDoc(doc(db('owner'), 'investmentLists/holdings_owner')))
    await assertSucceeds(getDoc(doc(db('owner'), 'investmentLists/overreactions_owner')))
    await assertSucceeds(setDoc(doc(db('owner'), 'investmentLists/holdings_owner'), list()))
    await assertFails(getDoc(doc(db('spouse'), 'investmentLists/holdings_owner')))
    await assertFails(setDoc(doc(db('viewer'), 'investmentLists/viewer'), list({ ownerId: 'viewer' })))
    await assertFails(setDoc(doc(db('spouse'), 'investmentLists/other'), list()))
    await assertFails(setDoc(doc(db('owner'), 'investmentLists/holdings_spouse'), list()))
    await assertFails(setDoc(doc(db('owner'), 'investmentLists/overreactions_spouse'), list()))
  })
  it('shares portfolio positions with a spouse, but not a viewer; only owner edits', async () => {
    await assertSucceeds(setDoc(doc(db('owner'), 'investmentLists/portfolio'), list({ visibility: 'shared', sharedWith: ['owner', 'spouse'] })))
    await assertSucceeds(setDoc(doc(db('bot'), 'investmentLists/portfolio/data/summary'), { day: '2026-11-05', holdings: [] }))
    await assertSucceeds(getDoc(doc(db('spouse'), 'investmentLists/portfolio/data/summary')))
    await assertSucceeds(setDoc(doc(db('bot'), 'investmentLists/portfolio/data/status'), { screened: 200 }))
    await assertSucceeds(getDoc(doc(db('spouse'), 'investmentLists/portfolio/data/status')))
    await assertFails(getDoc(doc(db('viewer'), 'investmentLists/portfolio/data/status')))
    await assertFails(setDoc(doc(db('owner'), 'investmentLists/portfolio/data/status'), { screened: 1706 }))
    await assertFails(getDoc(doc(db('viewer'), 'investmentLists/portfolio')))
    await assertFails(getDoc(doc(db('viewer'), 'investmentLists/portfolio/data/summary')))
    await assertFails(updateDoc(doc(db('spouse'), 'investmentLists/portfolio'), { symbols: ['MSFT'] }))
    await assertFails(setDoc(doc(db('owner'), 'investmentLists/portfolio/data/summary'), { holdings: [] }))
    await assertFails(updateDoc(doc(db('owner'), 'investmentLists/portfolio'), { ownerId: 'spouse' }))
    await assertFails(updateDoc(doc(db('owner'), 'investmentLists/portfolio'), { kind: 'overreactions' }))
    await assertSucceeds(setDoc(doc(db('owner'), 'investmentLists/portfolio'), list()))
    await assertFails(getDoc(doc(db('spouse'), 'investmentLists/portfolio/data/summary')))
    await assertFails(getDoc(doc(db('spouse'), 'investmentLists/portfolio/data/status')))
  })
  it('shares only overreactions with a named viewer, including a rule-provable query', async () => {
    const report = list({ kind: 'overreactions', symbols: [], positions: [], visibility: 'shared', sharedWith: ['owner', 'viewer'] })
    await assertSucceeds(setDoc(doc(db('owner'), 'investmentLists/overreactions_owner'), report))
    await assertSucceeds(setDoc(doc(db('bot'), 'investmentLists/overreactions_owner/data/watchlist'), { candidates: [] }))
    await assertSucceeds(getDocs(query(collection(db('viewer'), 'investmentLists'), where('sharedWith', 'array-contains', 'viewer'))))
    await assertSucceeds(getDoc(doc(db('viewer'), 'investmentLists/overreactions_owner/data/watchlist')))
    await assertSucceeds(setDoc(doc(db('bot'), 'investmentLists/overreactions_owner/data/status'), { queued: 21 }))
    await assertSucceeds(getDoc(doc(db('viewer'), 'investmentLists/overreactions_owner/data/status')))
    await assertFails(setDoc(doc(db('bot'), 'investmentLists/missing/data/status'), { queued: 21 }))
    await assertFails(getDoc(doc(db('spouse'), 'investmentLists/overreactions_owner/data/watchlist')))
    await assertFails(updateDoc(doc(db('viewer'), 'investmentLists/overreactions_owner'), { name: 'Edited' }))
    await assertFails(setDoc(doc(db('bot'), 'investmentLists/overreactions_owner/data/summary'), { holdings: [] }))
    await assertFails(setDoc(doc(db('bot'), 'investmentLists/missing/data/watchlist'), { candidates: [] }))
    await assertFails(setDoc(doc(db('owner'), 'investmentLists/duplicate'), report))
    await assertFails(setDoc(doc(db('owner'), 'investmentLists/overreactions_owner'), { ...report, symbols: ['AAPL'] }))
  })
  it('supports private, family and everyone queries without granting broad collection reads', async () => {
    await assertSucceeds(setDoc(doc(db('owner'), 'investmentLists/family'), list({ visibility: 'family' })))
    await assertSucceeds(setDoc(doc(db('owner'), 'investmentLists/everyone'), list({ visibility: 'family', viewerVisible: true })))
    await assertSucceeds(getDocs(query(collection(db('owner'), 'investmentLists'), where('ownerId', '==', 'owner'), where('visibility', '==', 'private'))))
    await assertSucceeds(getDocs(query(collection(db('spouse'), 'investmentLists'), where('visibility', '==', 'family'))))
    await assertSucceeds(getDocs(query(collection(db('viewer'), 'investmentLists'), where('visibility', '==', 'family'), where('viewerVisible', '==', true))))
    await assertFails(getDocs(collection(db('viewer'), 'investmentLists')))
    await assertSucceeds(getDocs(collection(db('bot'), 'investmentLists')))
    await assertFails(setDoc(doc(db('owner'), 'investmentLists/bad'), list({ symbols: Array(101).fill('X') })))
    await assertFails(setDoc(doc(db('owner'), 'investmentLists/bad'), list({ visibility: 'private', viewerVisible: true })))
    await assertFails(setDoc(doc(db('owner'), 'investmentLists/bad'), list({ visibility: 'private', sharedWith: ['owner'] })))
  })
  it('keeps legacy status owner-only and bot-written', async () => {
    await assertSucceeds(setDoc(doc(db('bot'), 'investing/owner/data/status'), { screened: 200 }))
    await assertSucceeds(getDoc(doc(db('owner'), 'investing/owner/data/status')))
    await assertFails(getDoc(doc(db('viewer'), 'investing/owner/data/status')))
    await assertFails(setDoc(doc(db('owner'), 'investing/owner/data/status'), { screened: 400 }))
  })
})
