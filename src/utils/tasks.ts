import { today } from '../engine/dates'
import { topoSort } from '../engine/graph'
import { applyPreview, conflictsById, finish, type ShiftPreview } from '../engine/scheduling'
import type { Context, Household, List, Priority, Role, Status, Task } from '../types'

export function canEditTask(task: Pick<Task, 'visibility' | 'ownerId'>, uid: string, role: Role): boolean {
  return role === 'member' && (task.visibility === 'family' || task.ownerId === uid)
}

/** Done or canceled: nothing more to do, and it no longer holds up the tasks that depend on it. */
export function isFinished(t: Pick<Task, 'status'>): boolean {
  return t.status === 'done' || t.status === 'canceled'
}

/**
 * The prerequisites still holding this task up: ones you can see that aren't finished. A prerequisite in someone
 * else's private list isn't visible, so it can't be shown (or block) here.
 */
export function waitingOn(t: Task, byId: Map<string, Task>): Task[] {
  return t.dependsOn.map((d) => byId.get(d.taskId)).filter((p): p is Task => !!p && !isFinished(p))
}

/** Color key from DESIGN.md §8: project lists are green regardless of visibility; finished is gray. */
export function colorKey(task: Task, list: List | undefined): 'private' | 'family' | 'project' | 'done' {
  if (isFinished(task)) return 'done'
  if (list?.kind === 'project') return 'project'
  return task.visibility
}

export const PRIORITY_LABEL: Record<Priority, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }
export const STATUS_LABEL: Record<Status, string> = { todo: 'To do', doing: 'Doing', done: 'Done', canceled: 'Canceled' }

/** Real people (no calendar bot), optionally only members. */
export function people(household: Household, membersOnly = false) {
  return Object.entries(household.members).filter(([, m]) => !m.bot && (!membersOnly || m.role === 'member'))
}

/** Name for a `for` target or assignee: member uid or pet id. */
export function targetName(id: string, household: Household): string {
  return household.members[id]?.displayName ?? household.pets.find((p) => p.id === id)?.name ?? id
}

/**
 * Belongs in "Today": in progress, scheduled or due today, or overdue. Calendar events only on the days they
 * happen; a past appointment isn't overdue work. With `includeDone`, finished tasks that were on for today
 * (scheduled or due today, or today's events) count too, so the Today view's status filter can show them.
 */
export function isForToday(t: Task, day: string, includeDone = false): boolean {
  const onToday = t.startDate !== undefined && t.startDate <= day && finish(t)! >= day
  if (isFinished(t)) return includeDone && (onToday || t.targetDate === day)
  if (t.calendar) return onToday
  return t.status === 'doing' || (t.startDate !== undefined && t.startDate <= day) || (t.targetDate !== undefined && t.targetDate <= day)
}

/** Minutes after midnight of a calendar event's start ("4:30 PM–5:00 PM" → 990), or undefined (all day / not an event). */
export function startMinutes(t: Task): number | undefined {
  const m = t.calendar?.time?.match(/^(\d{1,2}):(\d{2})\s*([AP])M/i)
  if (!m) return undefined
  return ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'P' ? 12 : 0)) * 60 + Number(m[2])
}

export type SortKey = 'priority' | 'date' | 'dependency'

/**
 * Day, then time of day: on the same day, all-day calendar events come first, then timed events in clock
 * order, then tasks without a time.
 */
function dateKey(t: Task): string {
  const day = t.startDate ?? t.targetDate ?? '9999-99-99'
  const minutes = startMinutes(t)
  const slot = t.calendar ? (minutes === undefined ? 0 : 1 + minutes) : 9999
  return `${day} ${String(slot).padStart(4, '0')}`
}

export function sortTasks(tasks: Task[], by: SortKey): Task[] {
  if (by === 'dependency') return topoSort(tasks)
  const sorted = [...tasks]
  sorted.sort((a, b) =>
    by === 'priority'
      ? a.priority - b.priority || dateKey(a).localeCompare(dateKey(b))
      : dateKey(a).localeCompare(dateKey(b)) || a.priority - b.priority,
  )
  return sorted
}

export interface TaskFilter {
  listId?: string
  context?: Context
  forId?: string
  assigneeId?: string
  priority?: Priority
  status?: Status | 'open'
  from?: string
  to?: string
}

/** "Not done" hides finished (done or canceled) tasks, and calendar events that are over: they're history, not unfinished work. */
export function filterTasks(tasks: Task[], f: TaskFilter, now = today()): Task[] {
  return tasks.filter((t) => {
    if (f.status === 'open' && t.calendar && (finish(t) ?? '9999-99-99') < now) return false
    if (f.listId && t.listId !== f.listId) return false
    if (f.context && t.context !== f.context) return false
    if (f.forId && !t.for?.includes(f.forId)) return false
    if (f.assigneeId && t.assigneeId !== f.assigneeId) return false
    if (f.priority && t.priority !== f.priority) return false
    if (f.status === 'open' ? isFinished(t) : f.status && t.status !== f.status) return false
    const day = t.startDate ?? t.targetDate
    if (f.from && (!day || day < f.from)) return false
    if (f.to && (!day || day > f.to)) return false
    return true
  })
}

/** Conflict flags to store after applying a preview: only editable, unfinished tasks whose flag actually changes. */
export function conflictUpdates(tasks: Task[], preview: ShiftPreview, canEdit: (t: Task) => boolean) {
  const after = applyPreview(tasks, preview)
  const now = conflictsById(after)
  const out = new Map<string, string | undefined>()
  for (const t of after) {
    if (!canEdit(t)) continue
    const next = isFinished(t) ? undefined : now.get(t.id)
    if ((t.conflict ?? undefined) !== next) out.set(t.id, next)
  }
  return out
}
