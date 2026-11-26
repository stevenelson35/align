import { describe, expect, it } from 'vitest'
import type { GiftClaim, Household, List, Task } from '../types'
import { claimState, cleanGift, giftStatus, giftSummary, priceText, reRank, showGifts, sortGifts, isRecipient, recipientKey, recipientLabel, secretListFor, secretSharedWith, qtyLine, cleanPayName, payLinks } from './gifts'

const household = {
  members: {
    steve: { role: 'member', displayName: 'Steve', color: '' },
    wife: { role: 'member', displayName: 'Linda', color: '' },
    daughter: { role: 'member', displayName: 'Daughter', color: '' },
    grandma: { role: 'viewer', displayName: 'Grandma', color: '' },
    bot: { role: 'member', displayName: 'Calendar', color: '', bot: true },
  },
} as unknown as Household
const claim = (itemId: string, by: string, qty: number, bought = false) => ({ id: `${itemId}_${by}`, itemId, claimedBy: by, qty, bought }) as GiftClaim

describe('gift helpers', () => {
  it('names the recipient, member or not', () => {
    expect(recipientKey({ recipientId: 'daughter' })).toBe('daughter')
    expect(recipientKey({ recipientName: 'Grandma Rose' })).toBe('name:Grandma Rose')
    expect(recipientLabel({ recipientId: 'wife' }, household)).toBe('Linda')
    expect(recipientLabel({ recipientName: 'Grandma Rose' }, household)).toBe('Grandma Rose')
    expect(isRecipient({ recipientId: 'daughter' }, 'daughter')).toBe(true)
    expect(isRecipient({}, 'daughter')).toBe(false)
  })
  it('shares secret ideas with every household account except the recipient (viewers too; never the helper account)', () => {
    expect(secretSharedWith(household, 'daughter', 'steve').sort()).toEqual(['grandma', 'steve', 'wife'])
    expect(secretSharedWith(household, 'grandma', 'wife').sort()).toEqual(['daughter', 'steve', 'wife'])
  })
  it('finds a list’s own secret companion', () => {
    const lists = [{ id: 'a', kind: 'gifts' }, { id: 's', kind: 'gifts', giftSecret: true, secretOf: 'a' }, { id: 't', kind: 'gifts', giftSecret: true, secretOf: 'b' }] as List[]
    expect(secretListFor(lists[0], lists)?.id).toBe('s')
    expect(secretListFor({ id: 'c' } as List, lists)).toBeUndefined()
  })
  it('adds up claims against the quantity wanted', () => {
    const item = { id: 'g1', gift: { qty: 3 } } as Task
    expect(claimState(item, [claim('g1', 'steve', 2, true), claim('g1', 'wife', 1), claim('g2', 'wife', 1)])).toMatchObject({ wanted: 3, claimed: 3, bought: 2, open: 0 })
    expect(claimState({ id: 'g2' } as Task, [])).toMatchObject({ wanted: 1, claimed: 0, open: 1 })
  })
  it('tidies and summarizes a gift', () => {
    expect(cleanGift({ qty: '2', color: ' Navy ', size: 'M' })).toEqual({ qty: 2, color: 'Navy', size: 'M' })
    expect(cleanGift({ qty: '1', color: '', size: ' ' })).toBeUndefined()
    expect(cleanGift({ qty: 500 })).toEqual({ qty: 99 })
    expect(giftSummary({ gift: { qty: 2, color: 'Navy', size: 'M' } })).toBe('×2 · Navy · size M')
    expect(giftSummary({})).toBe('')
  })
})

describe('gift priorities, prices and group gifts', () => {
  const at = (s: number) => ({ seconds: s, nanoseconds: 0 }) as Task['createdAt']
  const g = (id: string, gift: Task['gift'], s: number) => ({ id, title: id, gift, createdAt: at(s) }) as Task
  const items = [g('a', { price: 40 }, 1), g('b', { rank: 2, price: 10 }, 2), g('c', { rank: 1 }, 3), g('d', {}, 4)]
  const claim = (itemId: string, by: string, qty = 1, amount?: number) => ({ id: `${itemId}_${by}`, listId: 'l', itemId, recipientId: 'r', claimedBy: by, title: itemId, qty, bought: false, ...(amount ? { amount } : {}) }) as GiftClaim
  it('sorts by priority (unranked after, oldest first), price either way (no price last), or newest', () => {
    expect(sortGifts(items, 'priority').map((t) => t.id)).toEqual(['c', 'b', 'a', 'd'])
    expect(sortGifts(items, 'cheap').map((t) => t.id)).toEqual(['b', 'a', 'c', 'd'])
    expect(sortGifts(items, 'pricey').map((t) => t.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(sortGifts(items, 'newest').map((t) => t.id)).toEqual(['d', 'c', 'b', 'a'])
  })
  it('renumbers only what changes when the order changes', () => {
    expect(reRank([items[2], items[1], items[0]])).toEqual([{ id: 'a', rank: 3 }])
    expect(reRank([items[0], items[2]])).toEqual([{ id: 'a', rank: 1 }, { id: 'c', rank: 2 }])
  })
  it('knows what is still open: one of two, part of a group gift', () => {
    const two = g('shorts', { qty: 2 }, 5)
    expect(giftStatus(two, [])).toBe('open')
    expect(giftStatus(two, [claim('shorts', 'linda', 1)])).toBe('partial')
    expect(giftStatus(two, [claim('shorts', 'linda', 1), claim('shorts', 'sam', 1)])).toBe('claimed')
    const bike = g('bike', { price: 200, pool: true }, 6)
    expect(claimState(bike, [claim('bike', 'linda', 1, 80)])).toMatchObject({ pledged: 80, still: 120, open: 1 })
    expect(giftStatus(bike, [claim('bike', 'linda', 1, 80)])).toBe('partial')
    expect(giftStatus(bike, [claim('bike', 'linda', 1, 80), claim('bike', 'sam', 1, 120)])).toBe('claimed')
    expect(showGifts([two, bike], 'open', [claim('shorts', 'linda', 1)]).map((t) => t.id)).toEqual(['shorts', 'bike'])
    expect(showGifts([two, bike], 'claimed', [claim('shorts', 'linda', 1)]).map((t) => t.id)).toEqual(['shorts'])
  })
  it('stores a price (typed with $ or commas), keeps the priority, and shows it', () => {
    expect(cleanGift({ qty: '1', price: '$1,250.5', rank: 3, pool: true })).toEqual({ price: 1250.5, rank: 3, pool: true })
    expect(cleanGift({ price: '' })).toBeUndefined()
    expect(giftSummary({ gift: { qty: 2, color: 'Navy', price: 25 } })).toBe('×2 · Navy · about $25')
    expect(priceText(12.5)).toBe('$12.50')
  })
})

describe('several of one gift, and paying toward a group gift', () => {
  it('says how many are still needed', () => {
    expect(qtyLine({ wanted: 2, open: 1, claims: [{}] })).toBe('1 of 2 still needed')
    expect(qtyLine({ wanted: 2, open: 0, claims: [{}, {}] })).toBe('All 2 taken')
    expect(qtyLine({ wanted: 2, open: 2, claims: [] })).toBe('')
    expect(qtyLine({ wanted: 1, open: 0, claims: [{}] })).toBe('')
    expect(qtyLine({ wanted: 3, open: 1, claims: [{}] }, true)).toBe('')
  })
  it('opens PayPal or Venmo with the amount and a note', () => {
    expect(cleanPayName('@sam-w')).toBe('sam-w')
    expect(cleanPayName('https://www.paypal.me/SamW')).toBe('SamW')
    expect(cleanPayName('venmo.com/u/sam_99')).toBe('sam_99')
    expect(cleanPayName('not a name!')).toBe('')
    expect(payLinks({ paypal: 'SamW', venmo: '@sam_99' }, 25.5, 'For the bike')).toEqual([
      { label: 'PayPal', url: 'https://paypal.me/SamW/25.5USD' },
      { label: 'Venmo', url: 'https://venmo.com/sam_99?txn=pay&amount=25.5&note=For%20the%20bike' },
    ])
    expect(payLinks(undefined, 10, 'x')).toEqual([])
  })
})
