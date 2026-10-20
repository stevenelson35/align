// What a day looks like (DESIGN.md §8): what was left to do, what got done, what was skipped, what was pushed on.
import { addDays } from '../engine/dates'
import { finish } from '../engine/scheduling'
import type { Task } from '../types'
import { isFinished, isForToday } from './tasks'

/** Scheduled (or spanning) that day, or due that day. */
function onDay(t: Task, day: string): boolean {
  return (t.startDate !== undefined && t.startDate <= day && (finish(t) ?? t.startDate) >= day) || t.targetDate === day
}

export interface DayBuckets {
  /** Still to do. Today: everything for today, overdue included. A past day: what was on for it and is still open. */
  todo: Task[]
  /** Done that day. */
  done: Task[]
  /** Canceled ("won't do") that day. */
  skipped: Task[]
  /** Pushed off that day to a later one (and not finished that day). */
  pushed: Task[]
}

export function dayBuckets(tasks: Task[], day: string, now: string): DayBuckets {
  const out: DayBuckets = { todo: [], done: [], skipped: [], pushed: [] }
  for (const t of tasks) {
    if (isFinished(t)) {
      if (t.finishedOn === day) (t.status === 'done' ? out.done : out.skipped).push(t)
      else if (t.pushedFrom?.includes(day)) out.pushed.push(t)
      continue
    }
    if (t.pushedFrom?.includes(day) && !onDay(t, day)) {
      out.pushed.push(t)
      continue
    }
    const forDay = day === now ? isForToday(t, day) : day > now ? onDay(t, day) : onDay(t, day) && !t.calendar
    if (forDay) out.todo.push(t)
  }
  return out
}

/**
 * "⏭ next day" from `day`: the new start (or due) date, and the day recorded in pushedFrom. A task with a start
 * date starts the next day; one that's only due gets the next day as its due date; one with neither starts then.
 */
export function pushToNextDay(t: Pick<Task, 'startDate' | 'targetDate' | 'pushedFrom'>, day: string) {
  const next = addDays(day, 1)
  const pushedFrom = [...new Set([...(t.pushedFrom ?? []), day])]
  if (t.startDate || !t.targetDate) return { startDate: next, pushedFrom }
  return { targetDate: next, pushedFrom }
}

/** "Today", "Yesterday", "Tomorrow", or nothing (the caller shows the date). */
export function relativeDay(day: string, now: string): string {
  if (day === now) return 'Today'
  if (day === addDays(now, -1)) return 'Yesterday'
  if (day === addDays(now, 1)) return 'Tomorrow'
  return ''
}
