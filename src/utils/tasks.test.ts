import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { isForToday } from './tasks'

const t = (over: Partial<Task>): Task => ({
  id: 'x',
  listId: 'l',
  visibility: 'family',
  ownerId: 'o',
  viewerVisible: false,
  title: 'x',
  priority: 2,
  status: 'todo',
  context: 'family',
  durationDays: 1,
  dependsOn: [],
  createdBy: 'o',
  ...over,
})
const day = '2026-10-08'

describe('isForToday', () => {
  it('includes overdue, due-today and in-progress tasks', () => {
    expect(isForToday(t({ startDate: '2026-10-01' }), day)).toBe(true)
    expect(isForToday(t({ targetDate: '2026-10-08' }), day)).toBe(true)
    expect(isForToday(t({ status: 'doing' }), day)).toBe(true)
    expect(isForToday(t({ startDate: '2026-10-09' }), day)).toBe(false)
    expect(isForToday(t({ startDate: '2026-10-01', status: 'done' }), day)).toBe(false)
  })

  it('shows calendar events only on the days they happen', () => {
    const cal = { eventId: 'e' }
    expect(isForToday(t({ calendar: cal, startDate: '2026-10-01' }), day)).toBe(false)
    expect(isForToday(t({ calendar: cal, startDate: '2026-10-08' }), day)).toBe(true)
    expect(isForToday(t({ calendar: cal, startDate: '2026-10-07', durationDays: 3 }), day)).toBe(true)
    expect(isForToday(t({ calendar: cal, startDate: '2026-10-09' }), day)).toBe(false)
  })
})
