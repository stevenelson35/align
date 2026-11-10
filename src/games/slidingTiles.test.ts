import { describe, expect, it } from 'vitest'
import { moveSlidingTile, scrambleSlidingTiles, slidingTileSolved, solvedSlidingTiles } from './slidingTiles'

describe('picture slider', () => {
  it('creates a solved board with one empty space', () => {
    expect(solvedSlidingTiles(3)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0])
    expect(slidingTileSolved(solvedSlidingTiles(4))).toBe(true)
  })

  it('only moves a tile next to the empty space', () => {
    const board = solvedSlidingTiles(3)
    expect(moveSlidingTile(board, 7, 3)).toEqual([1, 2, 3, 4, 5, 6, 7, 0, 8])
    expect(moveSlidingTile(board, 0, 3)).toBeNull()
  })

  it('produces deterministic, solvable scrambles for the selected photo and size', () => {
    const first = scrambleSlidingTiles('family_photo-2026', 4)
    expect(first).toEqual(scrambleSlidingTiles('family_photo-2026', 4))
    expect(first).not.toEqual(scrambleSlidingTiles('family_photo-2026', 3))
    expect(first.slice().sort((a, b) => a - b)).toEqual(solvedSlidingTiles(4).slice().sort((a, b) => a - b))
    expect(slidingTileSolved(first)).toBe(false)
  })
})
