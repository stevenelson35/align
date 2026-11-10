import { describe, expect, it } from 'vitest'
import { compareGameResults, formatGameResult } from './catalog'

describe('game result contracts', () => {
  it('ranks Lights Out by moves before elapsed time', () => {
    expect(compareGameResults('lights-out', { moves: 10, ms: 5000 }, { moves: 11, ms: 1000 })).toBeLessThan(0)
    expect(compareGameResults('lights-out', { moves: 10, ms: 4000 }, { moves: 10, ms: 5000 })).toBeLessThan(0)
  })

  it('formats only the metrics used by a game', () => {
    expect(formatGameResult('lights-out', { moves: 10, ms: 65000 })).toBe('10 moves · 1:05')
  })
})
