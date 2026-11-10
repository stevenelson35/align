import { describe, expect, it } from 'vitest'
import { compareWordleResults, markGuess, normalizeWord, validWord } from './wordle'

describe('Wordle rules', () => {
  it('marks exact, present and absent letters', () => {
    expect(markGuess('crane', 'cared')).toEqual(['correct', 'present', 'present', 'present', 'absent'])
  })

  it('uses duplicate answer letters only once unless matched in place', () => {
    expect(markGuess('apple', 'allee')).toEqual(['correct', 'present', 'absent', 'absent', 'correct'])
    expect(markGuess('array', 'rarer')).toEqual(['present', 'present', 'correct', 'absent', 'absent'])
  })

  it('normalizes and validates supported custom word lengths', () => {
    expect(normalizeWord('  apple ')).toBe('APPLE')
    expect(validWord('my', 2)).toBe(true)
    expect(validWord('puzzling', 8)).toBe(true)
    expect(validWord('a')).toBe(false)
    expect(validWord('alphabeticalx')).toBe(false)
    expect(validWord('no spaces')).toBe(false)
    expect(validWord('apple', 4)).toBe(false)
  })

  it('ranks fewer guesses first, then faster time', () => {
    expect(compareWordleResults({ guesses: 3, ms: 99_000 }, { guesses: 4, ms: 10_000 })).toBeLessThan(0)
    expect(compareWordleResults({ guesses: 4, ms: 90_000 }, { guesses: 4, ms: 91_000 })).toBeLessThan(0)
  })
})
