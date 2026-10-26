import { describe, expect, it } from 'vitest'
import type { GiftClaim, Household, List, Task } from '../types'
import { claimState, cleanGift, giftSummary, isRecipient, recipientKey, recipientLabel, secretListFor, secretSharedWith } from './gifts'

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
  it('shares secret ideas with every member except the recipient (never the helper account)', () => {
    expect(secretSharedWith(household, 'daughter', 'steve').sort()).toEqual(['steve', 'wife'])
    expect(secretSharedWith(household, 'steve', 'wife').sort()).toEqual(['daughter', 'wife'])
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
