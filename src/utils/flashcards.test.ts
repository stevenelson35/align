import { describe, expect, it } from 'vitest'
import { cardsFromData, choicesFor, parseCards, parseSimpleCards, studyOrder } from './flashcards'
import { seeded } from './match3'

describe('flashcards', () => {
  it('reads plain lines in several forms', () => {
    expect(parseSimpleCards('Paris | Capital of France\n# a comment\nBerlin\tCapital of Germany\n7 × 8 :: 56\nQ: Largest planet?\nA: Jupiter\n\nnot a card')).toEqual([
      { front: 'Paris', back: 'Capital of France' },
      { front: 'Berlin', back: 'Capital of Germany' },
      { front: '7 × 8', back: '56' },
      { front: 'Largest planet?', back: 'Jupiter' },
    ])
  })
  it('reads YAML lists, cards: keys, alternate field names, and term: definition maps', async () => {
    expect(await parseCards('- front: H2O\n  back: Water\n- q: NaCl\n  a: Salt')).toEqual([
      { front: 'H2O', back: 'Water' },
      { front: 'NaCl', back: 'Salt' },
    ])
    expect(await parseCards('cards:\n  - term: photosynthesis\n    definition: How plants make food from light')).toEqual([{ front: 'photosynthesis', back: 'How plants make food from light' }])
    expect(cardsFromData({ cat: 'gato', dog: 'perro' })).toEqual([
      { front: 'cat', back: 'gato' },
      { front: 'dog', back: 'perro' },
    ])
    expect(await parseCards('[{"question":"2+2","answer":4}]')).toEqual([{ front: '2+2', back: '4' }])
  })
  it('orders cards: as added, shuffled (stable per seed), or only unknown ones', () => {
    const cards = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, results: id === 'b' || id === 'd' ? { me: { known: true } } : undefined }))
    expect(studyOrder(cards, 'order', 'me', 1).map((c) => c.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    const s1 = studyOrder(cards, 'shuffle', 'me', 42).map((c) => c.id)
    expect(s1).toEqual(studyOrder(cards, 'shuffle', 'me', 42).map((c) => c.id))
    expect([...s1].sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(studyOrder(cards, 'unknown', 'me', 7).map((c) => c.id).sort()).toEqual(['a', 'c', 'e'])
  })
})

describe('multiple choice', () => {
  it('mixes the answer with three other answers from the set', () => {
    const c = choicesFor('Paris', ['Paris', 'Madrid', 'Rome', 'Berlin', 'Lisbon', 'madrid '], [], seeded(1))
    expect(c).toHaveLength(4)
    expect(c).toContain('Paris')
    expect(new Set(c.map((x) => x.toLowerCase())).size).toBe(4)
  })

  it('tops up from extras when the set is small, and gives none with nothing to choose from', () => {
    const c = choicesFor('Lima', ['Quito'], ['Bogotá', 'Lima', 'Santiago'], seeded(2))
    expect(c.sort()).toEqual(['Bogotá', 'Lima', 'Quito', 'Santiago'])
    expect(choicesFor('Lima', ['Lima'], [], seeded(3))).toEqual([])
  })
})
