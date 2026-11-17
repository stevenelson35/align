import { describe, expect, it } from 'vitest'
import data from '../data/elements.json'
import { elementChoices, EVERYDAY, readElementCard, seriesCards, SERIES, STARTER_FAMILIES } from './elementCards'
import type { Element } from './elements'

const elements = data as unknown as Element[]
const pick = (symbols: string[]) => symbols.map((s) => elements.find((e) => e.symbol === s)!)
let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

describe('element flashcards', () => {
  it('makes five sets that read back as element cards', () => {
    const chosen = pick([...STARTER_FAMILIES, ...EVERYDAY])
    expect(chosen.every(Boolean)).toBe(true)
    for (const s of SERIES) {
      const cards = seriesCards(s.id, chosen)
      expect(cards.length, s.id).toBeGreaterThan(3)
      for (const c of cards) expect(readElementCard(c.front, c.back, elements)?.series, c.front).toBe(s.id)
    }
    expect(seriesCards('symbol', pick(['Cu']))).toEqual([{ front: 'What is the symbol for Copper?', back: 'Cu' }])
    expect(seriesCards('member', pick(['Cl']))).toEqual([{ front: 'Which of these is a halogen?', back: 'Chlorine' }])
    expect(seriesCards('traits', pick(['F', 'Cl'])).length).toBe(1) // one per family
    expect(readElementCard('What is the capital of France?', 'Paris', elements)).toBeNull()
  })
  it('deals plausible wrong answers, never a second right one', () => {
    const cu = readElementCard('What is the symbol for Copper?', 'Cu', elements)!
    const c = elementChoices(cu, 'Cu', elements, rand)
    expect(c).toHaveLength(4)
    expect(c).toContain('Cu')
    expect(c.filter((x) => x !== 'Cu').every((x) => x.startsWith('C') || ['Co', 'Ni', 'Zn', 'Ga', 'Fe', 'Mn'].includes(x))).toBe(true)
    const cl = readElementCard('Which of these is a halogen?', 'Chlorine', elements)!
    for (let i = 0; i < 20; i++) {
      const opts = elementChoices(cl, 'Chlorine', elements, rand)
      const halogens = opts.filter((n) => elements.find((e) => e.name === n)?.family === 'halogen')
      expect(halogens).toEqual(['Chlorine'])
    }
    const n = elementChoices(readElementCard('What is the atomic number of Copper?', '29', elements)!, '29', elements, rand)
    expect(n.every((x) => Math.abs(Number(x) - 29) <= 8)).toBe(true)
  })
})
