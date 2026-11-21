import { describe, expect, it } from 'vitest'
import { giftAfterMove, giftsLinking, hasGiftDetails, noteFromGift, noteReachWarning } from './giftNotes'

describe('a gift idea into a note', () => {
  const shirt = {
    title: 'Workout shirts',
    notes: 'The loose fit ones, short sleeves',
    links: [{ url: 'https://example.com/shirt', label: 'Store' }, 'https://example.com/other'],
    images: ['img:abc'],
    gift: { qty: 3, size: 'L', color: 'navy', price: 25, rank: 2 },
    noteIds: ['n0'],
  }
  it('takes the description, links, pictures, size and color, not how many or the price', () => {
    expect(noteFromGift(shirt)).toEqual({
      title: 'Workout shirts',
      notes: 'The loose fit ones, short sleeves\n\nSize L · Color navy',
      links: [{ url: 'https://example.com/shirt', label: 'Store' }, { url: 'https://example.com/other' }],
      images: ['img:abc'],
    })
    expect(noteFromGift({ title: 'Socks' })).toEqual({ title: 'Socks' })
  })
  it('leaves the idea its name and gift fields, linking the note', () => {
    expect(giftAfterMove(shirt, 'n1')).toEqual({ notes: undefined, links: undefined, images: undefined, noteIds: ['n0', 'n1'] })
    expect(hasGiftDetails(shirt)).toBe(true)
    expect(hasGiftDetails({ notes: '  ' })).toBe(false)
  })
})

describe('who can open a linked note', () => {
  it('warns when the note reaches fewer people than the gift list', () => {
    expect(noteReachWarning('everyone', 'everyone')).toBe('')
    expect(noteReachWarning('everyone', 'family')).toBe('')
    expect(noteReachWarning('family', 'everyone')).toMatch(/view-only/)
    expect(noteReachWarning('private', 'everyone')).toBe('only you can see this note')
    expect(noteReachWarning('parents', 'shared')).toBe('this note is seen by parents only')
    expect(noteReachWarning('parents', 'parents')).toBe('')
  })
  it('finds the gift ideas that link a note', () => {
    const items = [
      { id: 'a', listId: 'gifts1', noteIds: ['n1'] },
      { id: 'b', listId: 'todo', noteIds: ['n1'] },
      { id: 'c', listId: 'gifts2' },
    ]
    expect(giftsLinking('n1', items, new Set(['gifts1', 'gifts2'])).map((t) => t.id)).toEqual(['a'])
  })
})
