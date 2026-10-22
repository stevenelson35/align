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

describe('progressive toward a goal, and running totals', () => {
  it('declines weight toward the goal and stops there; lower counts as met', async () => {
    const { suggested, met, decreasing } = await import('./goals')
    const weight = g({ kind: 'progressive', unit: 'lb', target: 169, progression: { start: 200, step: -1, every: 2, per: 'day', from: '2026-10-01' } })
    expect(decreasing(weight)).toBe(true)
    expect(suggested(weight, '2026-10-01')).toBe(200)
    expect(suggested(weight, '2026-10-11')).toBe(195)
    expect(suggested(weight, '2027-03-01')).toBe(169) // reached the goal: stays there
    expect(met(weight, { value: 194 }, '2026-10-11')).toBe(true)
    expect(met(weight, { value: 196 }, '2026-10-11')).toBe(false)
    const pushups = g({ kind: 'progressive', target: 30, progression: { start: 10, step: 2, every: 1, per: 'week', from: '2026-10-01' } })
    expect(suggested(pushups, '2027-06-01')).toBe(30)
  })
  it('adds up a running total toward its target', async () => {
    const { totalTo, met, goalHint } = await import('./goals')
    const savings = g({ kind: 'total', unit: '$', target: 500, log: { '2026-10-01': { value: 200 }, '2026-10-05': { value: 150.5 }, '2026-11-01': { value: 200 } } })
    expect(totalTo(savings, '2026-10-20')).toBe(350.5)
    expect(met(savings, undefined, '2026-10-20')).toBe(false)
    expect(met(savings, undefined, '2026-11-02')).toBe(true)
    expect(goalHint(savings, '2026-10-20')).toBe('$350.5 of $500')
  })
})

describe('goalGroups', () => {
  it('groups goals by who can log them: mine, shared, and view-only per person', async () => {
    const { goalGroups } = await import('./goals')
    const household = { members: { me: { displayName: 'Steve', role: 'member' }, wife: { displayName: 'Linda', role: 'member' } } } as never
    const base = { kind: 'check', ownerId: 'me', visibility: 'family', viewerVisible: true, createdBy: 'me' } as const
    const goals = [
      { ...base, id: 'w', name: 'Weight', editAudience: 'private' },
      { ...base, id: 'v', name: 'Vacation', kind: 'total', editAudience: 'shared', editors: ['me', 'wife'] },
      { ...base, id: 'r', name: 'Run', ownerId: 'wife', editAudience: 'private' },
      { ...base, id: 'a', name: 'Old', archived: true },
    ] as never
    expect(goalGroups(goals, 'me', 'member', household).map((g) => [g.title, g.goals.map((x) => x.id)])).toEqual([
      ['My goals', ['w']],
      ['Shared goals', ['v']],
      ["Linda's goals", ['r']],
    ])
    // Linda sees the vacation goal as shared (she can log it) and the weight as Steve's, view only.
    expect(goalGroups(goals, 'wife', 'member', household).map((g) => g.title)).toEqual(['My goals', 'Shared goals', "Steve's goals"])
    expect(goalGroups(goals, 'wife', 'viewer', household).map((g) => g.title)).toEqual(["Steve's goals", "Linda's goals"])
  })
})

describe('timerValue', () => {
  it('turns timer time into the goal unit: minutes unless it says hours or seconds', async () => {
    const { timerValue } = await import('./goals')
    expect(timerValue(12 * 60_000 + 30_000, 'min')).toBe(12.5)
    expect(timerValue(12 * 60_000 + 30_000)).toBe(12.5)
    expect(timerValue(90 * 60_000, 'hours')).toBe(1.5)
    expect(timerValue(95_400, 'sec')).toBe(95)
  })
})

describe('otherLoggers', () => {
  it('names who else logs a goal', async () => {
    const { otherLoggers } = await import('./goals')
    const household = { members: { me: { displayName: 'Steve' }, wife: { displayName: 'Linda' } } } as never
    expect(otherLoggers({ ownerId: 'me', editAudience: 'private', visibility: 'family' }, household, 'me')).toBe('')
    expect(otherLoggers({ ownerId: 'me', editAudience: 'shared', editors: ['me', 'wife'], visibility: 'family' }, household, 'me')).toBe('with Linda')
    expect(otherLoggers({ ownerId: 'me', editAudience: 'everyone', visibility: 'family' }, household, 'wife')).toBe('Family')
  })
})
