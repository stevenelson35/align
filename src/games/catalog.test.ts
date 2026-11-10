import { describe, expect, it } from 'vitest'
import { compareGameResults, formatGameResult } from './catalog'

describe('game result contracts', () => {
  it('ranks Lights Out by moves before elapsed time', () => {
    expect(compareGameResults('lights-out', { moves: 10, ms: 5000 }, { moves: 11, ms: 1000 })).toBeLessThan(0)
    expect(compareGameResults('lights-out', { moves: 10, ms: 4000 }, { moves: 10, ms: 5000 })).toBeLessThan(0)
  })

  it('formats only the metrics used by a game', () => {
    expect(formatGameResult('lights-out', { moves: 10, ms: 65000 })).toBe('10 moves · 1:05')
    expect(formatGameResult('wordle', { guesses: 3, ms: 65000 })).toBe('3 guesses · 1:05')
  })

  it('ranks Wordle by guesses before elapsed time', () => {
    expect(compareGameResults('wordle', { guesses: 3, ms: 5000 }, { guesses: 4, ms: 1000 })).toBeLessThan(0)
    expect(compareGameResults('wordle', { guesses: 3, ms: 4000 }, { guesses: 3, ms: 5000 })).toBeLessThan(0)
  })
})
