import { describe, expect, it } from 'vitest'
import { flap, H, hits, newWorld, PLANE_X, step } from './glider'

describe('Glider', () => {
  it('sinks without taps and ends at the ground', () => {
    let w = newWorld(42)
    for (let i = 0; i < 200 && !w.over; i++) w = step(w, 1 / 30)
    expect(w.over).toBe(true)
    expect(w.y).toBeGreaterThan(H / 2)
  })
  it('a tap lifts the plane', () => {
    const w = step(flap(newWorld(42)), 0.1)
    expect(w.y).toBeLessThan(H / 2)
  })
  it('scores a tower flown through, and a tower edge ends the run', () => {
    // Fly a steady line through the middle of a gap: put the gap on the plane.
    let w = newWorld(7)
    w = { ...w, towers: w.towers.map((t) => ({ ...t, gapY: H / 2 })) }
    for (let i = 0; i < 400 && w.score < 1; i++) {
      w = step(w, 1 / 60)
      if (w.y > H / 2 + 10) w = flap(w)
    }
    expect(w.score).toBeGreaterThanOrEqual(1)
    expect(hits({ y: 20, towers: [{ x: PLANE_X - 10, gapY: H / 2, passed: false }] })).toBe(true)
  })
})
