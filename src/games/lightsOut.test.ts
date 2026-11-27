import { describe, expect, it } from 'vitest'
import { compareLightsOutScores, isLightsOutSolved, lightsOutBoard, lightsOutHint, lightsOutScramble, toggleLights } from './lightsOut'

describe('Lights Out', () => {
  it('toggles a cell and its in-bounds neighbors', () => {
    expect(toggleLights(Array(9).fill(false), 0, 3)).toEqual([true, true, false, true, false, false, false, false, false])
  })

  it('makes a repeatable, solvable puzzle', () => {
    const board = lightsOutBoard('challenge-1', 4)
    expect(board).toEqual(lightsOutBoard('challenge-1', 4))
    expect(board).toHaveLength(16)
    const solved = lightsOutScramble('challenge-1', 4).reduce((current, move) => toggleLights(current, move, 4), board)
    expect(isLightsOutSolved(solved)).toBe(true)
  })

  it('ranks fewer moves first, then less time', () => {
    expect(compareLightsOutScores({ moves: 10, ms: 5000 }, { moves: 11, ms: 1000 })).toBeLessThan(0)
    expect(compareLightsOutScores({ moves: 10, ms: 4000 }, { moves: 10, ms: 5000 })).toBeLessThan(0)
  })
})

describe('Lights Out hints', () => {
  it('pressing each hint in turn switches every light off', () => {
    for (const seed of ['2026-11-27', '2026-11-28', 'practice-1']) {
      let board = lightsOutBoard(seed)
      const pressed: number[] = [3, 7]
      for (const i of pressed) board = toggleLights(board, i)
      for (let h = lightsOutHint(seed, pressed); h !== null; h = lightsOutHint(seed, pressed)) {
        board = toggleLights(board, h)
        pressed.push(h)
      }
      expect(isLightsOutSolved(board)).toBe(true)
    }
  })
})
