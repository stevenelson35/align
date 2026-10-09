import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { filterTasks, isForToday, sortTasks, startMinutes } from './tasks'

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

describe('filterTasks "Not done"', () => {
  it('hides calendar events that are over, but not overdue regular tasks', () => {
    const cal = { eventId: 'e' }
    const tasks = [
      t({ id: 'pastEvent', calendar: cal, startDate: '2026-10-01' }),
      t({ id: 'multiDayNow', calendar: cal, startDate: '2026-10-07', durationDays: 3 }),
      t({ id: 'futureEvent', calendar: cal, startDate: '2026-10-20' }),
      t({ id: 'overdueChore', startDate: '2026-10-01' }),
    ]
    expect(filterTasks(tasks, { status: 'open' }, day).map((x) => x.id)).toEqual(['multiDayNow', 'futureEvent', 'overdueChore'])
    expect(filterTasks(tasks, {}, day)).toHaveLength(4)
  })
})

describe('Today with done tasks', () => {
  it('includes finished tasks that were on for today only when asked', () => {
    const doneEvent = t({ status: 'done', startDate: day, calendar: { eventId: 'e', time: '4:00 PM–5:00 PM' } })
    expect(isForToday(doneEvent, day)).toBe(false)
    expect(isForToday(doneEvent, day, true)).toBe(true)
    expect(isForToday(t({ status: 'done', targetDate: day }), day, true)).toBe(true)
    expect(isForToday(t({ status: 'done', startDate: '2026-10-01' }), day, true)).toBe(false) // old work stays out
  })
})

describe('time of day', () => {
  it('reads an event start time', () => {
    expect(startMinutes(t({ calendar: { eventId: 'e', time: '4:30 PM–5:00 PM' } }))).toBe(990)
    expect(startMinutes(t({ calendar: { eventId: 'e', time: '12:15 AM–1:00 AM' } }))).toBe(15)
    expect(startMinutes(t({ calendar: { eventId: 'e', time: '12:00 PM–1:00 PM' } }))).toBe(720)
    expect(startMinutes(t({ calendar: { eventId: 'e' } }))).toBeUndefined()
  })

  it('sorts a day as all-day events, timed events by clock, then other tasks', () => {
    const ev = (id: string, time?: string) => t({ id, startDate: day, calendar: { eventId: id, time } })
    const tasks = [
      t({ id: 'task', startDate: day }),
      ev('pm', '4:00 PM–5:00 PM'),
      ev('am', '9:00 AM–10:00 AM'),
      ev('allday'),
      t({ id: 'earlier', startDate: '2026-10-07' }),
    ]
    expect(sortTasks(tasks, 'date').map((x) => x.id)).toEqual(['earlier', 'allday', 'am', 'pm', 'task'])
    expect(sortTasks(tasks, 'priority').map((x) => x.id)).toEqual(['earlier', 'allday', 'am', 'pm', 'task'])
  })
})
