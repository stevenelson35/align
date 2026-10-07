import { topoSort } from '../engine/graph'
import { applyPreview, conflictsById, type ShiftPreview } from '../engine/scheduling'
import type { Context, Household, List, Priority, Role, Status, Task } from '../types'

export function canEditTask(task: Pick<Task, 'visibility' | 'ownerId'>, uid: string, role: Role): boolean {
  return role === 'member' && (task.visibility === 'family' || task.ownerId === uid)
}

/** Color key from DESIGN.md §8: project lists are green regardless of visibility; done is gray. */
export function colorKey(task: Task, list: List | undefined): 'private' | 'family' | 'project' | 'done' {
  if (task.status === 'done') return 'done'
  if (list?.kind === 'project') return 'project'
  return task.visibility
}

export const PRIORITY_LABEL: Record<Priority, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }
export const STATUS_LABEL: Record<Status, string> = { todo: 'To do', doing: 'Doing', done: 'Done' }

/** Name for a `for` target or assignee: member uid or pet id. */
export function targetName(id: string, household: Household): string {
  return household.members[id]?.displayName ?? household.pets.find((p) => p.id === id)?.name ?? id
}

export type SortKey = 'priority' | 'date' | 'dependency'

const dateKey = (t: Task) => t.startDate ?? t.targetDate ?? '9999-99-99'

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

export function filterTasks(tasks: Task[], f: TaskFilter): Task[] {
  return tasks.filter((t) => {
    if (f.listId && t.listId !== f.listId) return false
    if (f.context && t.context !== f.context) return false
    if (f.forId && !t.for?.includes(f.forId)) return false
    if (f.assigneeId && t.assigneeId !== f.assigneeId) return false
    if (f.priority && t.priority !== f.priority) return false
    if (f.status === 'open' ? t.status === 'done' : f.status && t.status !== f.status) return false
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
    const next = t.status === 'done' ? undefined : now.get(t.id)
    if ((t.conflict ?? undefined) !== next) out.set(t.id, next)
  }
  return out
}
