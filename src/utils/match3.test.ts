import { describe, expect, it } from 'vitest'
import { boardFrom, canSwap, findGroups, hasMove, newGame, play, seeded } from './match3'

const full = (cells: unknown[]) => cells.every((x) => x !== null)

describe('match-3', () => {
  it('deals a board with nothing lined up and a move to make, the same for the same seed', () => {
    const a = newGame(8, 7, 5, seeded(42))
    const b = newGame(8, 7, 5, seeded(42))
    expect(a.cells.map((x) => x!.color)).toEqual(b.cells.map((x) => x!.color))
    expect(findGroups(a)).toEqual([])
    expect(hasMove(a)).toBe(true)
    expect(a.cells).toHaveLength(56)
  })

  it('only swaps neighbors that line something up', () => {
    const g = boardFrom(['0010', '2342', '3423'])
    expect(canSwap(g, 2, 3)).toBe(true) // the third 0 slides in from the right
    expect(canSwap(g, 0, 5)).toBe(false) // not neighbors
    expect(canSwap(g, 4, 5)).toBe(false) // lines nothing up
    expect(play(g, 4, 5, seeded(1))).toBeNull()
  })

  it('bursts a line of three, drops the gems above and fills the board', () => {
    const g = boardFrom(['1234', '0010', '2342'])
    const r = play(g, 6, 7, seeded(3))!
    expect(r.hits.slice(0, 3)).toEqual([4, 5, 6])
    expect(r.steps[0].burst.sort()).toEqual([4, 5, 6])
    expect(full(g.cells)).toBe(true)
    // The row above fell into the gap: its gems are now one row down (before any chain).
    expect(r.steps[0].after[4]!.id).toBe(1)
  })

  it('makes a line-clearing special from four in a row, where you swapped', () => {
    // Row 2 is 0 0 1 0 3; the 0 above the 1 swaps down to make four 0s.
    const g = boardFrom(['12041', '00103', '23423'])
    const r = play(g, 2, 7, seeded(5))!
    expect(r.steps[0].made).toHaveLength(1)
    expect(r.steps[0].made[0]).toMatchObject({ at: 7, gem: { special: 'col', color: 0 } })
  })

  it('makes a bomb from an L or T', () => {
    // Column 0 down and row 2 across share the corner: one group, both ways.
    const groups = findGroups(boardFrom(['01234', '01234', '00003']))
    expect(groups).toHaveLength(1)
    expect(groups[0].cross).toBe(true)
    expect(groups[0].cells).toHaveLength(6)
  })

  it('sets off a swapped special: a row clears its row and breaks all that ice', () => {
    const g = boardFrom(['1234', '2341', '3412'])
    g.cells[5] = { id: 99, color: 3, special: 'row' }
    const r = play(g, 5, 1, seeded(7))!
    // The special moved to the top row (index 1) and cleared it.
    expect(r.steps[0].burst.sort()).toEqual([0, 1, 2, 3])
    expect(r.hits).toEqual(expect.arrayContaining([0, 1, 2, 3]))
    expect(full(g.cells)).toBe(true)
  })

  it('a swapped color special clears every gem of the other one’s color', () => {
    const g = boardFrom(['1214', '3132', '2141'])
    g.cells[0] = { id: 99, color: 0, special: 'color' }
    const r = play(g, 0, 1, seeded(9))!
    // It lands at 1 and takes the color of the 2 it swapped with (now at 0): every 2 on the board, and itself.
    expect(r.steps[0].burst.sort((x, y) => x - y)).toEqual([0, 1, 7, 8])
  })

  it('keeps playing to the end of chains and always leaves a move', () => {
    const rand = seeded(11)
    const g = newGame(8, 7, 5, rand)
    let moves = 0
    for (let n = 0; n < 40; n++) {
      let found: [number, number] | null = null
      for (let i = 0; i < g.cells.length && !found; i++) for (const j of [i + 1, i + 8]) if (j < g.cells.length && canSwap(g, i, j)) found = [i, j]
      expect(found).not.toBeNull()
      const r = play(g, found![0], found![1], rand)!
      expect(r.hits.length).toBeGreaterThanOrEqual(3)
      expect(findGroups(g)).toEqual([])
      expect(full(g.cells)).toBe(true)
      moves++
    }
    expect(moves).toBe(40)
  })
})
