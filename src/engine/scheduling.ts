// Scheduling engine (DESIGN.md §6). Pure functions over plain task data; no Firebase.
import { addDays } from './dates'
import { descendants, topoSort } from './graph'

export interface SchedTask {
  id: string
  startDate?: string
  durationDays: number
  targetDate?: string
  dependsOn: { taskId: string; offsetDays: number }[]
}

export interface Move {
  id: string
  from?: string
  to: string
  /** Set when the duration changes too (only for the task the user edited). */
  durationDays?: number
}

export interface ShiftPreview {
  moves: Move[]
  /** Tasks that needed to move but the user can't edit; they get a conflict flag instead. */
  blocked: { id: string; reason: string }[]
}

export type CanEdit = (id: string) => boolean

export function finish(t: Pick<SchedTask, 'startDate' | 'durationDays'>): string | undefined {
  return t.startDate && addDays(t.startDate, t.durationDays - 1)
}

/** max(finish(A) + 1 + offset) over scheduled prerequisites, or undefined if none are scheduled. */
export function earliestStart(t: SchedTask, byId: Map<string, SchedTask>): string | undefined {
  let best: string | undefined
  for (const dep of t.dependsOn) {
    const prereq = byId.get(dep.taskId)
    const end = prereq && finish(prereq)
    if (!end) continue
    const candidate = addDays(end, 1 + dep.offsetDays)
    if (!best || candidate > best) best = candidate
  }
  return best
}

export function conflictOf(t: SchedTask, byId: Map<string, SchedTask>): string | undefined {
  if (!t.startDate) return undefined
  const earliest = earliestStart(t, byId)
  if (earliest && t.startDate < earliest) return `starts before prerequisite (earliest ${earliest})`
  const end = finish(t)!
  if (t.targetDate && end > t.targetDate) return `misses target date ${t.targetDate}`
  return undefined
}

export function conflictsById(tasks: SchedTask[]): Map<string, string> {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const out = new Map<string, string>()
  for (const t of tasks) {
    const c = conflictOf(t, byId)
    if (c) out.set(t.id, c)
  }
  return out
}

/**
 * Forward shift (push): apply `change` to one task, then move its dependents later only as far as needed.
 * Only descendants of the changed task are considered, so unrelated pre-existing conflicts stay put.
 */
export function shiftForward(
  tasks: SchedTask[],
  change: { id: string; startDate: string; durationDays?: number },
  canEdit: CanEdit,
): ShiftPreview {
  const current = new Map(tasks.map((t) => [t.id, { ...t }]))
  const original = current.get(change.id)
  if (!original) return { moves: [], blocked: [] }
  const moves: Move[] = [{ id: change.id, from: original.startDate, to: change.startDate, durationDays: change.durationDays }]
  original.startDate = change.startDate
  if (change.durationDays) original.durationDays = change.durationDays
  return pushDescendants(current, [change.id], canEdit, moves)
}

/** Recalculate: move every editable task that starts before its prerequisites allow, cascading to dependents. */
export function recalculate(tasks: SchedTask[], canEdit: CanEdit): ShiftPreview {
  const current = new Map(tasks.map((t) => [t.id, { ...t }]))
  const moves: Move[] = []
  const blocked: ShiftPreview['blocked'] = []
  for (const t of topoSort([...current.values()])) {
    const earliest = earliestStart(t, current)
    if (!t.startDate || !earliest || t.startDate >= earliest) continue
    if (!canEdit(t.id)) {
      blocked.push({ id: t.id, reason: `starts before prerequisite (earliest ${earliest})` })
      continue
    }
    moves.push({ id: t.id, from: t.startDate, to: earliest })
    t.startDate = earliest
  }
  return { moves, blocked }
}

function pushDescendants(current: Map<string, SchedTask>, roots: string[], canEdit: CanEdit, moves: Move[]) {
  const affected = descendants([...current.values()], roots)
  const blocked: ShiftPreview['blocked'] = []
  for (const t of topoSort([...current.values()])) {
    if (!affected.has(t.id) || !t.startDate) continue
    const earliest = earliestStart(t, current)
    if (!earliest || t.startDate >= earliest) continue
    if (!canEdit(t.id)) {
      blocked.push({ id: t.id, reason: `starts before prerequisite (earliest ${earliest})` })
      continue
    }
    moves.push({ id: t.id, from: t.startDate, to: earliest })
    t.startDate = earliest
  }
  return { moves, blocked }
}

/**
 * Backward shift (pull), "meet new date": make `id` finish by `finishBy`, moving its prerequisites earlier
 * only as far as needed.
 */
export function meetDate(tasks: SchedTask[], id: string, finishBy: string, canEdit: CanEdit): ShiftPreview {
  const current = new Map(tasks.map((t) => [t.id, { ...t }]))
  const target = current.get(id)
  const moves: Move[] = []
  const blocked: ShiftPreview['blocked'] = []
  if (!target) return { moves, blocked }

  const latestStart = addDays(finishBy, 1 - target.durationDays)
  if (!target.startDate || target.startDate > latestStart) {
    if (!canEdit(id)) return { moves, blocked: [{ id, reason: `misses target date ${finishBy}` }] }
    moves.push({ id, from: target.startDate, to: latestStart })
    target.startDate = latestStart
  }

  // Walk prerequisites from the target outward (reverse topological order of its ancestors).
  const ancestors = new Set<string>()
  const stack = [id]
  while (stack.length) {
    for (const dep of current.get(stack.pop()!)?.dependsOn ?? []) {
      if (!ancestors.has(dep.taskId) && current.has(dep.taskId)) {
        ancestors.add(dep.taskId)
        stack.push(dep.taskId)
      }
    }
  }
  const order = topoSort([...current.values()]).reverse()
  for (const a of order) {
    if (!ancestors.has(a.id) || !a.startDate) continue
    // Latest finish allowed by every dependent that is itself the target or an ancestor.
    let latestFinish: string | undefined
    for (const d of current.values()) {
      if (d.id !== id && !ancestors.has(d.id)) continue
      if (!d.startDate) continue
      for (const dep of d.dependsOn) {
        if (dep.taskId !== a.id) continue
        const limit = addDays(d.startDate, -1 - dep.offsetDays)
        if (!latestFinish || limit < latestFinish) latestFinish = limit
      }
    }
    if (!latestFinish || finish(a)! <= latestFinish) continue
    if (!canEdit(a.id)) {
      blocked.push({ id: a.id, reason: `must finish by ${latestFinish}` })
      continue
    }
    const to = addDays(latestFinish, 1 - a.durationDays)
    moves.push({ id: a.id, from: a.startDate, to })
    a.startDate = to
  }
  return { moves, blocked }
}

/** Apply a preview to task data, returning the updated copies (used to recompute conflicts before writing). */
export function applyPreview<T extends SchedTask>(tasks: T[], preview: ShiftPreview): T[] {
  const byMove = new Map(preview.moves.map((m) => [m.id, m]))
  return tasks.map((t) => {
    const m = byMove.get(t.id)
    return m ? { ...t, startDate: m.to, durationDays: m.durationDays ?? t.durationDays } : t
  })
}
