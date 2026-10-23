import { describe, expect, it } from 'vitest'
import { mathPuzzle } from './math'

describe('mathPuzzle', () => {
  it('is the same for the same day and grade, and different across days', () => {
    expect(mathPuzzle('2026-10-23', 4)).toEqual(mathPuzzle('2026-10-23', 4))
    const week = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'].map((d) => mathPuzzle(d, 3).question)
    expect(new Set(week).size).toBeGreaterThan(2)
  })
  it('gives correct answers at each grade', () => {
    let checked = 0
    for (let g = 1; g <= 8; g++) {
      for (const d of ['2026-01-05', '2026-03-17', '2026-10-23']) {
        const p = mathPuzzle(d, g)
        expect(p.question.length).toBeGreaterThan(5)
        expect(p.answer.length).toBeGreaterThan(0)
        // Check the plain arithmetic forms exactly.
        const m = p.question.match(/^(\d+) ([+−×÷]) (\d+) = \?$/)
        if (m) {
          checked++
          const [a, b] = [Number(m[1]), Number(m[3])]
          const want = m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b
          expect(Number(p.answer)).toBe(want)
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
})
