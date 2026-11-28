import { describe, expect, it } from 'vitest'
import { dailyGamesDone, doneToday, earnsDaily, playClock, roundEarns } from './play'

describe('play time', () => {
  it('pays for finished rounds of 5 or more: a minute and 5 s a card after that; a Challenge 1:30', () => {
    expect(roundEarns(4, false)).toBe(0)
    expect(roundEarns(5, false)).toBe(60)
    expect(roundEarns(39, false)).toBe(230)
    expect(roundEarns(10, true)).toBe(90)
    expect(playClock(230)).toBe('3:50')
  })
  it('counts each daily thing once a day', () => {
    expect(earnsDaily('word')).toBe(15)
    expect(earnsDaily('wordle')).toBe(60)
    expect(earnsDaily('joke')).toBe(0)
    expect(doneToday({ day: '2026-11-17', done: ['word'] }, '2026-11-17')).toEqual(['word'])
    expect(doneToday({ day: '2026-11-16', done: ['word'] }, '2026-11-17')).toEqual([])
  })
  it('counts a finished Wordle board only for its owner and day, including a given-up game', () => {
    const board = { uid: 'a', date: '2026-11-17', complete: true, abandoned: true }
    const record = { day: '2026-11-17', done: ['trail'] }
    expect([...dailyGamesDone(record, '2026-11-17', board, 'a')]).toEqual(['trail', 'wordle'])
    expect([...dailyGamesDone(record, '2026-11-17', { ...board, complete: false }, 'a')]).toEqual(['trail'])
    expect([...dailyGamesDone(record, '2026-11-17', board, 'b')]).toEqual(['trail'])
    expect([...dailyGamesDone(record, '2026-11-18', board, 'a')]).toEqual([])
  })
})
