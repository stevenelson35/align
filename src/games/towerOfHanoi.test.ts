import { describe, expect, it } from 'vitest'
import { hanoiOptimalMoves, hanoiSolved, isHanoiDiskCount, moveHanoiDisk, newHanoiBoard } from './towerOfHanoi'

describe('Tower of Hanoi', () => {
  it('starts with all disks on the first rod', () => {
    expect(newHanoiBoard()).toEqual({ A: [3, 2, 1], B: [], C: [] })
  })

  it('moves only a top disk and rejects placing a larger disk on a smaller one', () => {
    const board = newHanoiBoard()
    expect(moveHanoiDisk(board, 'A', 'B')).toEqual({ A: [3, 2], B: [1], C: [] })
    expect(moveHanoiDisk(board, 'A', 'C')).not.toBeNull()
    const afterTwoMoves = moveHanoiDisk(board, 'A', 'B')!
    expect(moveHanoiDisk(afterTwoMoves, 'A', 'B')).toBeNull()
    expect(moveHanoiDisk(board, 'A', 'A')).toBeNull()
  })

  it('detects the completed tower', () => {
    expect(hanoiSolved({ A: [], B: [], C: [3, 2, 1] })).toBe(true)
    expect(hanoiSolved(newHanoiBoard())).toBe(false)
  })

  it('can solve the three-disk puzzle in the optimal seven moves', () => {
    let board = newHanoiBoard()
    for (const [from, to] of [['A', 'C'], ['A', 'B'], ['C', 'B'], ['A', 'C'], ['B', 'A'], ['B', 'C'], ['A', 'C']] as const) {
      board = moveHanoiDisk(board, from, to)!
    }
    expect(hanoiSolved(board)).toBe(true)
    expect(board).toEqual({ A: [], B: [], C: [3, 2, 1] })
  })

  it('calculates the optimal move count for each supported difficulty', () => {
    expect([3, 4, 5, 6].map(hanoiOptimalMoves)).toEqual([7, 15, 31, 63])
    expect(isHanoiDiskCount(3)).toBe(true)
    expect(isHanoiDiskCount(6)).toBe(true)
    expect(isHanoiDiskCount(2)).toBe(false)
  })

  it('creates and solves boards with different disk counts', () => {
    for (const disks of [3, 4, 5, 6]) {
      expect(newHanoiBoard(disks).A).toHaveLength(disks)
      expect(hanoiSolved({ A: [], B: [], C: Array.from({ length: disks }, (_, i) => disks - i) }, disks)).toBe(true)
    }
  })
})
