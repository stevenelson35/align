import { describe, expect, it } from 'vitest'
import { balanceHint, blocksHint, combineHint, starsHint, trailHint, combineMove, combineSolved, combineStuck, makeCombine, balanceConflicts, balanceSolved, blocksSolved, daySeed, makeBalance, makeBlocks, makeStars, makeTrail, starConflicts, starsSolved, trailOnTrack, trailSolved, type Mark } from './logic'

const seeds = Array.from({ length: 25 }, (_, i) => daySeed('test', `2026-12-${String(i + 1).padStart(2, '0')}`))

describe('the daily logic puzzles', () => {
  it('gives everyone the same puzzle on a day, and a different one the next', () => {
    expect(daySeed('trail', '2026-11-27')).toBe(daySeed('trail', '2026-11-27'))
    expect(daySeed('trail', '2026-11-27')).not.toBe(daySeed('trail', '2026-11-28'))
    expect(makeTrail(daySeed('trail', '2026-11-27'))).toEqual(makeTrail(daySeed('trail', '2026-11-27')))
  })

  it('Trail: a path through every square, meeting the numbers in order', () => {
    for (const seed of seeds) {
      const p = makeTrail(seed)
      expect(trailSolved(p, p.solution)).toBe(true)
      expect(Object.keys(p.numbers).length).toBeGreaterThanOrEqual(6)
      expect(trailSolved(p, p.solution.slice(0, -1))).toBe(false)
      expect(trailSolved(p, [...p.solution].reverse())).toBe(false)
      expect(trailOnTrack(p, p.solution.slice(0, 5))).toBe(true)
    }
  })

  it('Balance: halves in every line, never three in a row, = and × kept', () => {
    for (const seed of seeds) {
      const p = makeBalance(seed)
      expect(balanceSolved(p, p.solution)).toBe(true)
      const wrong = [...p.solution] as (Mark | null)[]
      const free = wrong.findIndex((_, i) => p.given[i] === undefined)
      wrong[free] = wrong[free] === 0 ? 1 : 0
      expect(balanceSolved(p, wrong)).toBe(false)
      expect(balanceConflicts(p, wrong).size).toBeGreaterThan(0)
    }
  })

  it('Star Fields: one star per row, column and area, none touching', () => {
    for (const seed of seeds) {
      const p = makeStars(seed)
      expect(new Set(p.regions).size).toBe(7)
      expect(p.regions.every((g) => g >= 0)).toBe(true)
      expect(starsSolved(p, new Set(p.solution))).toBe(true)
      const star = p.solution[0]
      const crowded = new Set([star, star % 7 === 0 ? star + 1 : star - 1])
      expect(starConflicts(p, crowded).size).toBe(2)
    }
  })

  it('Blocks: rectangles cover the grid, each with its size as its only number', () => {
    for (const seed of seeds) {
      const p = makeBlocks(seed)
      expect(blocksSolved(p, p.solution)).toBe(true)
      expect(blocksSolved(p, p.solution.slice(1))).toBe(false)
      expect(Object.values(p.clues).reduce((a, b) => a + b, 0)).toBe(36)
    }
  })

  it('Sum Up: equal neighbors combine into their sum, down to one square, at every size', () => {
    for (const n of [3, 4, 5]) for (const seed of seeds.slice(0, 8)) {
      const p = makeCombine(seed, n)
      expect(p.grid.every((v) => v > 0)).toBe(true)
      let grid = p.grid
      for (const [from, to] of p.solution) {
        const next = combineMove(grid, from, to, n)
        expect(next).not.toBeNull()
        grid = next!
      }
      expect(combineSolved(grid)).toBe(true)
      expect(grid.reduce((a, b) => a + b, 0)).toBe(n === 3 ? 32 : n === 4 ? 64 : 128)
    }
    expect(combineMove([2, 2, 0, 0], 0, 1, 2)).toEqual([0, 4, 0, 0])
    expect(combineMove([2, 4, 0, 0], 0, 1, 2)).toBeNull()
    expect(combineMove([2, 0, 0, 2], 0, 3, 2)).toBeNull()
    expect(combineStuck([2, 4, 0, 8], 2)).toBe(true)
  })

  it('hints take one correct step from where you are, and following them finishes the puzzle', () => {
    for (const seed of seeds.slice(0, 6)) {
      const t = makeTrail(seed)
      let path: number[] = []
      while (!trailSolved(t, path)) path = trailHint(t, path)
      expect(path).toEqual(t.solution)

      const b = makeBalance(seed)
      let grid = Array.from({ length: 36 }, (_, i) => b.given[i] ?? null) as (Mark | null)[]
      grid[grid.findIndex((v) => v === null)] = 0
      for (let h = balanceHint(b, grid); h; h = balanceHint(b, grid)) grid = grid.map((v, i) => (i === h!.cell ? h!.value : v))
      expect(balanceSolved(b, grid)).toBe(true)

      const st = makeStars(seed)
      const stars = new Set<number>([0])
      for (let h = starsHint(st, stars); h; h = starsHint(st, stars)) {
        if (h.star) stars.add(h.cell)
        else stars.delete(h.cell)
      }
      expect(starsSolved(st, stars)).toBe(true)

      const bl = makeBlocks(seed)
      const rects = [] as typeof bl.solution
      for (let q = blocksHint(bl, rects); q; q = blocksHint(bl, rects)) rects.push(q)
      expect(blocksSolved(bl, rects)).toBe(true)

      for (const n of [3, 4]) {
        const c = makeCombine(seed, n)
        let g = c.grid
        for (let m = combineHint(g, n, c); m; m = combineHint(g, n, c)) g = combineMove(g, m[0], m[1], n)!
        expect(combineSolved(g)).toBe(true)
      }
    }
    expect(combineHint([2, 4, 0, 8], 2)).toBeNull()
    // Off the puzzle's way (3 × 3): the search still finds a way through.
    const c = makeCombine(seeds[0], 3)
    const moves = [...Array(9).keys()].flatMap((i) => [i + 1, i + 3].map((j) => [i, j] as [number, number]))
    const off = moves.map(([a, b]) => combineMove(c.grid, a, b, 3)).find((g) => g && combineHint(g, 3, undefined) !== null)
    if (off) {
      let g = off
      for (let m = combineHint(g, 3); m; m = combineHint(g, 3)) g = combineMove(g, m[0], m[1], 3)!
      expect(combineSolved(g)).toBe(true)
    }
  })
})

