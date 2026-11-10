import { describe, expect, it } from 'vitest'
import { compareWordleResults, decodeWordleProgressRow, hardModeError, markGuess, normalizeWord, validWord, wordleKeyboardMarks, type WordleGuess } from './wordle'

describe('Wordle rules', () => {
  it('marks exact, present and absent letters', () => {
    expect(markGuess('crane', 'cared')).toEqual(['correct', 'present', 'present', 'present', 'absent'])
  })

  it('uses duplicate answer letters only once unless matched in place', () => {
    expect(markGuess('apple', 'allee')).toEqual(['correct', 'present', 'absent', 'absent', 'correct'])
    expect(markGuess('array', 'rarer')).toEqual(['present', 'present', 'correct', 'absent', 'absent'])
  })

  it('marks absent keyboard keys and upgrades them when a better hint appears', () => {
    const guesses: WordleGuess[] = [
      { word: 'CRANE', marks: ['absent', 'absent', 'present', 'absent', 'absent'] },
      { word: 'CRISP', marks: ['correct', 'present', 'absent', 'correct', 'absent'] },
    ]
    const marks = wordleKeyboardMarks(guesses)
    expect(marks.get('C')).toBe('correct')
    expect(marks.get('R')).toBe('present')
    expect(marks.get('A')).toBe('present')
    expect(marks.get('N')).toBe('absent')
    expect(marks.get('E')).toBe('absent')
  })

  it('decodes the compact marks used for shared challenge progress', () => {
    expect(decodeWordleProgressRow('ACPAA')).toEqual(['absent', 'correct', 'present', 'absent', 'absent'])
    expect(decodeWordleProgressRow(undefined)).toEqual([])
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

  it('requires hard-mode hints to be reused in later guesses', () => {
    const guesses = [{ word: 'CRANE', marks: markGuess('CRISP', 'CRANE') }]
    expect(hardModeError(guesses, 'CRISP')).toBeNull()
    expect(hardModeError(guesses, 'XRATE')).toContain('Keep C in position 1')
    expect(hardModeError(guesses, 'CRISP')).toBeNull()
  })

  it('keeps yellow letters and moves them from the known wrong position', () => {
    const guesses = [{ word: 'SLATE', marks: markGuess('CIGAR', 'SLATE') }]
    expect(hardModeError(guesses, 'CIGAR')).toBeNull()
    expect(hardModeError(guesses, 'CIARS')).toContain('Move A from position 3')
    expect(hardModeError(guesses, 'CIGRS')).toContain('Use at least 1')
  })

  it('does not count the same revealed hint repeatedly across guesses', () => {
    const first = { word: 'CRANE', marks: markGuess('CRISP', 'CRANE') }
    const second = { word: 'CRATE', marks: markGuess('CRISP', 'CRATE') }
    expect(hardModeError([first, second], 'CRISP')).toBeNull()
  })
})
