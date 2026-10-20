import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { dayBuckets, pushToNextDay, relativeDay } from './day'

const t = (over: Partial<Task>): Task => ({
  id: over.id ?? 'x', listId: 'l', visibility: 'family', ownerId: 'o', viewerVisible: false, title: over.id ?? 'x', priority: 2,
  status: 'todo', context: 'family', durationDays: 1, dependsOn: [], createdBy: 'o', ...over,
})
const now = '2026-10-20'
const yesterday = '2026-10-19'

describe('dayBuckets', () => {
  const tasks = [
    t({ id: 'doneY', status: 'done', finishedOn: yesterday, startDate: yesterday }),
    t({ id: 'skippedY', status: 'canceled', finishedOn: yesterday, startDate: yesterday }),
    t({ id: 'pushedY', startDate: now, pushedFrom: [yesterday] }),
    t({ id: 'missedY', startDate: yesterday }), // still open: shows as not done yesterday, and overdue today
    t({ id: 'today', startDate: now }),
    t({ id: 'doneToday', status: 'done', finishedOn: now, startDate: yesterday }),
    t({ id: 'tomorrow', startDate: '2026-10-21' }),
    t({ id: 'dueToday', targetDate: now }),
  ]
  it('shows what happened on a past day', () => {
    const b = dayBuckets(tasks, yesterday, now)
    expect(b.done.map((x) => x.id)).toEqual(['doneY'])
    expect(b.skipped.map((x) => x.id)).toEqual(['skippedY'])
    expect(b.pushed.map((x) => x.id)).toEqual(['pushedY'])
    expect(b.todo.map((x) => x.id)).toEqual(['missedY'])
  })
  it("shows today's to-do (overdue included) and what was done today", () => {
    const b = dayBuckets(tasks, now, now)
    expect(b.todo.map((x) => x.id).sort()).toEqual(['dueToday', 'missedY', 'pushedY', 'today'])
    expect(b.done.map((x) => x.id)).toEqual(['doneToday'])
  })
  it('shows only what is scheduled or due on a future day', () => {
    expect(dayBuckets(tasks, '2026-10-21', now).todo.map((x) => x.id)).toEqual(['tomorrow'])
  })
})

describe('pushToNextDay', () => {
  it('moves the start (or the due date) and records the day', () => {
    expect(pushToNextDay({ startDate: now }, now)).toEqual({ startDate: '2026-10-21', pushedFrom: [now] })
    expect(pushToNextDay({ targetDate: now }, now)).toEqual({ targetDate: '2026-10-21', pushedFrom: [now] })
    expect(pushToNextDay({}, now)).toEqual({ startDate: '2026-10-21', pushedFrom: [now] })
    expect(pushToNextDay({ startDate: yesterday, pushedFrom: [yesterday] }, now).pushedFrom).toEqual([yesterday, now])
  })
  it('names nearby days', () => {
    expect([relativeDay(now, now), relativeDay(yesterday, now), relativeDay('2026-10-21', now), relativeDay('2026-10-01', now)]).toEqual(['Today', 'Yesterday', 'Tomorrow', ''])
  })
})
