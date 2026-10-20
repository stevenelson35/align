import { describe, expect, it } from 'vitest'
import type { Goal } from '../types'
import { appliesOn, goalHint, history, met, suggested, weekday } from './goals'

const g = (over: Partial<Goal>): Goal => ({
  id: 'g', name: 'G', kind: 'check', visibility: 'private', ownerId: 'o', viewerVisible: false, createdBy: 'o', ...over,
})

describe('goals', () => {
  it('knows the weekday and which days a goal applies', () => {
    expect(weekday('2026-10-20')).toBe(2) // a Tuesday
    expect(appliesOn(g({}), '2026-10-20')).toBe(true)
    expect(appliesOn(g({ weekdays: [1, 3, 5] }), '2026-10-20')).toBe(false)
    expect(appliesOn(g({ weekdays: [2] }), '2026-10-20')).toBe(true)
    expect(appliesOn(g({ archived: true }), '2026-10-20')).toBe(false)
  })

  it('grows the suggestion on schedule, within min and max', () => {
    const pushups = g({ kind: 'progressive', progression: { start: 10, step: 1, every: 2, per: 'day', from: '2026-10-20', max: 12 } })
    expect(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-24', '2026-11-30'].map((d) => suggested(pushups, d))).toEqual([10, 10, 10, 11, 12, 12])
    const weekly = g({ kind: 'progressive', progression: { start: 20, step: 5, every: 1, per: 'week', from: '2026-10-20' } })
    expect(suggested(weekly, '2026-10-26')).toBe(20)
    expect(suggested(weekly, '2026-10-27')).toBe(25)
    const down = g({ kind: 'progressive', progression: { start: 30, step: -2, every: 1, per: 'day', from: '2026-10-20', min: 25 } })
    expect(suggested(down, '2026-10-30')).toBe(25)
  })

  it('decides whether a day was met, and hints at what to do', () => {
    const day = '2026-10-20'
    expect(met(g({ kind: 'check' }), { done: true }, day)).toBe(true)
    expect(met(g({ kind: 'tally', perDay: 8 }), { count: 7 }, day)).toBe(false)
    expect(met(g({ kind: 'tally', perDay: 8 }), { count: 8 }, day)).toBe(true)
    const pushups = g({ kind: 'progressive', unit: 'reps', progression: { start: 10, step: 1, every: 1, per: 'day', from: day } })
    expect(met(pushups, { value: 10 }, day)).toBe(true)
    expect(met(pushups, { value: 9 }, day)).toBe(false)
    const weight = g({ kind: 'measure', unit: 'lb', target: 180, direction: 'down' })
    expect(met(weight, { value: 179.5 }, day)).toBe(true)
    expect(met(weight, { value: 183 }, day)).toBe(false)
    expect([goalHint(pushups, day), goalHint(weight, day), goalHint(g({ kind: 'tally', perDay: 8 }), day)]).toEqual(['suggested 10 reps', 'target 180 lb', '8 a day'])
  })

  it('lists the days a goal applied, with entries and suggestions', () => {
    const goal = g({ kind: 'progressive', weekdays: [1, 3], progression: { start: 5, step: 1, every: 1, per: 'day', from: '2026-10-19' }, log: { '2026-10-21': { value: 7 } } })
    expect(history(goal, '2026-10-19', '2026-10-25')).toEqual([
      { day: '2026-10-19', entry: undefined, suggested: 5 },
      { day: '2026-10-21', entry: { value: 7 }, suggested: 7 },
    ])
  })
})
