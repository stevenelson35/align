import { describe, expect, it } from 'vitest'
import data from '../data/elements.json'
import { elementOfDay, FAMILIES, familyMembers, findElement, glossaryParts, keySentence, type Element } from './elements'

const elements = data as unknown as Element[]

describe('the periodic table data', () => {
  it('has all 118 elements, each in a known family and a free cell', () => {
    expect(elements).toHaveLength(118)
    expect(elements.map((e) => e.number)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1))
    const ids = new Set(FAMILIES.map((f) => f.id))
    expect(elements.every((e) => ids.has(e.family))).toBe(true)
    const cells = new Set(elements.map((e) => `${e.x},${e.y}`))
    expect(cells.size).toBe(118)
  })
  it('puts the families a class learns in the right columns', () => {
    expect(familyMembers(elements, 'noble-gas').map((e) => e.symbol)).toEqual(['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn', 'Og'])
    expect(familyMembers(elements, 'halogen').map((e) => e.symbol)).toEqual(['F', 'Cl', 'Br', 'I', 'At', 'Ts'])
    expect(familyMembers(elements, 'alkali-metal').map((e) => e.symbol)).toEqual(['Li', 'Na', 'K', 'Rb', 'Cs', 'Fr'])
    expect(familyMembers(elements, 'alkaline-earth-metal').map((e) => e.symbol)).toEqual(['Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Ra'])
    expect(findElement(elements, 'copper')).toMatchObject({ symbol: 'Cu', number: 29, group: 11, family: 'transition-metal' })
    expect(findElement(elements, 'Fe')?.name).toBe('Iron')
  })
  it('marks glossary words once, longest match first', () => {
    const parts = glossaryParts('One outer electron, so they form ions; more ions.')
    expect(parts.filter((p) => p.term).map((p) => p.term)).toEqual(['outer electron', 'ions'])
    expect(parts.map((p) => p.text).join('')).toBe('One outer electron, so they form ions; more ions.')
  })
  it('skips the "is a chemical element" opener for the sentence worth reading', () => {
    expect(keySentence(findElement(elements, 'Copper')!)).toMatch(/^It is a soft, malleable/)
    expect(keySentence({ summary: 'Neon glows red. It is a noble gas.' })).toBe('Neon glows red.')
  })
  it('picks the same element all day', () => {
    expect(elementOfDay(elements, '2026-11-17')).toBe(elementOfDay(elements, '2026-11-17'))
  })
})
