import { describe, expect, it } from 'vitest'
import { activeEarners, iceLeft, moveHits, thicknessFor } from './reveal'

describe('reveal ice', () => {
  it('works out the ice left per cell', () => {
    expect(iceLeft({ 0: 2, 1: 1, 3: 5 }, 2, 4)).toEqual([0, 1, 2, 0])
  })

  it('breaks one layer per burst, never more than a cell needs', () => {
    const left = [2, 2, 1, 0, 2, 2, 2, 2, 2, 2]
    expect(moveHits([0, 0, 0, 2, 2, 3], left, 5)).toEqual({ 0: 2, 2: 1 })
  })

  it('chips the iced cell nearest the bursts when only a few are left', () => {
    // 2 columns × 4 rows; only cells 6 and 1 still iced; bursts at the bottom row → cell 6 is nearest.
    const left = [0, 1, 0, 0, 0, 0, 2, 0]
    expect(moveHits([7], left, 2)).toEqual({ 6: 1 })
    // Bursting on 6 itself takes a layer, and the assist chips the nearest remaining (6 again, still iced).
    expect(moveHits([6], left, 2)).toEqual({ 6: 2 })
    // Nothing burst, nothing chipped.
    expect(moveHits([], left, 2)).toEqual({})
  })

  it('makes the ice thicker for more people earning sparks', () => {
    const recent = { a: { '2026-10-25': 3 }, b: { '2026-10-30': 1 }, c: { '2026-09-01': 7 } }
    expect(activeEarners(recent, '2026-10-30')).toBe(2)
    expect(activeEarners({}, '2026-10-30')).toBe(1)
    expect([1, 2, 3, 6].map(thicknessFor)).toEqual([2, 3, 4, 4])
  })
})
