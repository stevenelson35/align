import { describe, expect, it } from 'vitest'
import { hanoiSolved, moveHanoiDisk, newHanoiBoard } from './towerOfHanoi'

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
})
