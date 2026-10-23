import { describe, expect, it } from 'vitest'
import { boardFromFen } from './chess'

describe('boardFromFen', () => {
  it('reads the starting position', () => {
    const b = boardFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(b).toHaveLength(8)
    expect(b.every((r) => r.length === 8)).toBe(true)
    expect(b[0].join('')).toBe('rnbqkbnr')
    expect(b[4].every((s) => s === null)).toBe(true)
    expect(b[7][4]).toBe('K')
  })
})
