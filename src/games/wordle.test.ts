import { describe, expect, it } from 'vitest'
import { compareWordleResults, decodeWordleProgressRow, hardModeError, markGuess, normalizeWord, validWord, wordleChallengeFinished, wordleKeyboardMarks, wordleProgressLabel, shareGrid, shareTitle, resultTitle, challengeMessage, wordleDay, rankingLine, dailyStandings, type WordleGuess } from './wordle'

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

  it('labels live progress before and during play, including decline and give-up', () => {
    expect(wordleProgressLabel()).toBe('Invited · 0/6')
    expect(wordleProgressLabel({ rows: [], started: false, complete: false, solved: false })).toBe('Ready · 0/6')
    expect(wordleProgressLabel({ rows: ['ACPAA'], started: true, complete: false, solved: false })).toBe('Playing · 1/6')
    expect(wordleProgressLabel({ rows: ['ACPAA'], complete: true, solved: false, status: 'abandoned' })).toBe('Gave up · 1/6')
    expect(wordleProgressLabel({ rows: [], complete: true, solved: false, status: 'declined' })).toBe('Declined')
    expect(wordleProgressLabel({ rows: ['CCCCC'], complete: true, solved: true })).toBe('Solved · 1 guess')
    expect(wordleProgressLabel({ rows: ['ACPAA', 'ACPAA'], complete: true, solved: false })).toBe('Out of guesses · 2/6')
  })

  it('ends a live challenge when every player has completed or abandoned it', () => {
    const players = ['alex', 'camilla']
    expect(wordleChallengeFinished(players, [
      { uid: 'alex', complete: true },
      { uid: 'camilla', complete: false },
    ])).toBe(false)
    expect(wordleChallengeFinished(players, [
      { uid: 'alex', complete: true },
      { uid: 'camilla', complete: true },
    ])).toBe(true)
    expect(wordleChallengeFinished([], [])).toBe(false)
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

  it('requires yellow letters but allows them in their previous positions', () => {
    const guesses = [{ word: 'SLATE', marks: markGuess('CIGAR', 'SLATE') }]
    expect(hardModeError(guesses, 'CIGAR')).toBeNull()
    expect(hardModeError(guesses, 'CIARS')).toBeNull()
    expect(hardModeError(guesses, 'CIGRS')).toContain('Use at least 1')
  })

  it('still requires all revealed copies of a letter', () => {
    const guesses = [{ word: 'ALLOT', marks: markGuess('LABEL', 'ALLOT') }]
    expect(hardModeError(guesses, 'LABLE')).toBeNull()
    expect(hardModeError(guesses, 'LACED')).toContain('Use at least 2 Ls')
  })

  it('does not count the same revealed hint repeatedly across guesses', () => {
    const first = { word: 'CRANE', marks: markGuess('CRISP', 'CRANE') }
    const second = { word: 'CRATE', marks: markGuess('CRISP', 'CRATE') }
    expect(hardModeError([first, second], 'CRISP')).toBeNull()
  })
})

describe('sharing a result', () => {
  it('shows colors only, a line per guess, and the score', () => {
    expect(shareGrid([{ word: 'CRANE', marks: ['absent', 'present', 'correct', 'absent', 'absent'] }, { word: 'GRASP', marks: ['correct', 'correct', 'correct', 'correct', 'correct'] }])).toBe('⬛🟨🟩⬛⬛\n🟩🟩🟩🟩🟩')
    expect(shareTitle('2026-11-17', true, 4)).toBe('Wordle 4/6 · 2026-11-17')
    expect(shareTitle('2026-11-17', false, 6)).toBe('Wordle X/6 · 2026-11-17')
  })
})

describe('announcing a finished Wordle of the day', () => {
  it('leads with the score and time, and ranks today by guesses then time', () => {
    expect(wordleDay('2026-11-20')).toBe('Fri, Nov 20')
    expect(resultTitle('2026-11-20', '2026-11-20', { solved: true, guesses: 3, ms: 123000 })).toBe('completed today’s Wordle (Fri, Nov 20): 3/6 in 2:03')
    expect(resultTitle('2026-11-19', '2026-11-20', { solved: false, guesses: 6, ms: 300000 })).toBe('missed the Wordle for Thu, Nov 19: X/6')
    expect(resultTitle('2026-11-20', '2026-11-20', { solved: false, abandoned: true, guesses: 2, ms: 1 })).toBe('gave up on today’s Wordle (Fri, Nov 20)')
    const names: Record<string, string> = { s: 'Steve', l: 'Linda', c: 'Camilla' }
    expect(rankingLine([{ uid: 's', guesses: 4, ms: 125000 }, { uid: 'l', guesses: 3, ms: 80000 }, { uid: 'c', guesses: 4, ms: 90000 }], (u) => names[u])).toBe('Today: 1. Linda 3 · 1:20, 2. Camilla 4 · 1:30, 3. Steve 4 · 2:05')
    expect(rankingLine([], (u) => u)).toBe('')
    expect(rankingLine([{ uid: 's', guesses: 2 }], (u) => names[u], 'Thu, Nov 19')).toBe('Thu, Nov 19: 1. Steve 2')
  })
})

describe('what a Wordle challenge says', () => {
  it('names the kind of challenge and who else is in it', () => {
    expect(challengeMessage('invite', 0).title).toBe('sent you their own word to guess in Wordle')
    expect(challengeMessage('live-chosen', 2).title).toBe('challenged you and 2 others to a Wordle with a word they picked')
    expect(challengeMessage('random-live', 1).title).toBe('challenged you and 1 other to a Wordle with a random word')
    expect(challengeMessage('random-live', 1).text).toMatch(/^Not real time/)
    expect(challengeMessage('realtime-live', 0).title).toBe('invited you to a real-time Wordle race')
  })
})

describe("a day's standings", () => {
  it('ranks solvers by guesses then time, then missed, gave up, playing and not played', () => {
    const people = [
      { uid: 'a', name: 'Ann' },
      { uid: 'b', name: 'Bo' },
      { uid: 'c', name: 'Cy' },
      { uid: 'd', name: 'Di' },
      { uid: 'e', name: 'Ed' },
      { uid: 'f', name: 'Flo' },
    ]
    const scores = [
      { uid: 'b', guesses: 5, ms: 148000 },
      { uid: 'a', guesses: 3, ms: 106000 },
    ]
    const boards = [
      { uid: 'a', date: 'd', rows: ['AAPAA', 'CPAAC', 'CCCCC'], complete: true, solved: true },
      { uid: 'c', date: 'd', rows: ['AAAAA', 'AAAAA', 'AAAAA', 'AAAAA', 'AAAAA', 'AAAAA'], complete: true, solved: false },
      { uid: 'd', date: 'd', rows: ['AAAAA'], complete: true, solved: false, abandoned: true },
      { uid: 'e', date: 'd', rows: ['APAAA'], complete: false, solved: false },
    ]
    const s = dailyStandings(people, scores, boards)
    expect(s.map((x) => `${x.place ?? '-'} ${x.name} ${x.text}`)).toEqual([
      '1 Ann 3 guesses · 1:46',
      '2 Bo 5 guesses · 2:28',
      '- Cy X/6',
      '- Di Gave up',
      '- Ed Playing now',
      '- Flo Not played yet',
    ])
    expect(s[0].rows).toHaveLength(3)
    expect(s[5].state).toBe('waiting')
  })
})
