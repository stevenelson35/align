// Daily goals (DESIGN.md §5.6): which days they apply, the suggested amount for progressive goals, and progress.
import { diffDays } from '../engine/dates'
import type { Goal, GoalEntry, Household, Role } from '../types'
import { canLogGoal } from './tasks'

/** 0 = Sunday, like Date.getDay(), for a 'YYYY-MM-DD' day (no time zone surprises). */
export function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function appliesOn(goal: Pick<Goal, 'weekdays' | 'archived'>, day: string): boolean {
  if (goal.archived) return false
  return !goal.weekdays?.length || goal.weekdays.includes(weekday(day))
}

/** A decreasing progressive goal (weight: start 180, −1 every 2 days, goal 165): lower is better. */
export function decreasing(goal: Pick<Goal, 'progression' | 'target'>): boolean {
  const p = goal.progression
  if (!p) return false
  return p.step < 0 || (p.step === 0 && goal.target !== undefined && goal.target < p.start)
}

/**
 * Progressive: start, plus `step` (negative to go down) for every full `every` days/weeks since `from`. It moves
 * toward the goal (`target`) and stops there; older goals' min/max are still honored.
 */
export function suggested(goal: Pick<Goal, 'progression' | 'target'>, day: string): number | undefined {
  const p = goal.progression
  if (!p) return undefined
  const period = Math.max(1, p.every) * (p.per === 'week' ? 7 : 1)
  const steps = Math.max(0, Math.floor(diffDays(p.from, day) / period))
  let v = p.start + steps * p.step
  if (goal.target !== undefined) v = p.step < 0 ? Math.max(v, goal.target) : p.step > 0 ? Math.min(v, goal.target) : v
  if (p.max !== undefined) v = Math.min(v, p.max)
  if (p.min !== undefined) v = Math.max(v, p.min)
  return Math.round(v * 100) / 100
}

/** Running total: everything added up to and including `day`. */
export function totalTo(goal: Pick<Goal, 'log'>, day: string): number {
  return Math.round(Object.entries(goal.log ?? {}).reduce((sum, [d, e]) => (d <= day ? sum + (e.value ?? 0) : sum), 0) * 100) / 100
}

/**
 * Is the day's goal met? check: done; tally: perDay taps; progressive: at least the suggestion (at most, when it
 * decreases); measure: at or past target; total: the running total has reached the target (any day).
 */
export function met(goal: Goal, entry: GoalEntry | undefined, day: string): boolean {
  if (goal.kind === 'total') return goal.target !== undefined && totalTo(goal, day) >= goal.target
  if (!entry) return false
  switch (goal.kind) {
    case 'check':
      return !!entry.done
    case 'tally':
      return (entry.count ?? 0) >= (goal.perDay ?? 1)
    case 'progressive': {
      if (entry.value === undefined) return false
      const s = suggested(goal, day) ?? 0
      return decreasing(goal) ? entry.value <= s : entry.value >= s
    }
    case 'measure':
      if (entry.value === undefined || goal.target === undefined) return false
      return goal.direction === 'up' ? entry.value >= goal.target : entry.value <= goal.target
  }
}

/** An amount with its unit: "$350", "12 lb", "8 glasses" (currency signs go in front). */
export function amount(n: number | undefined, unit?: string): string {
  if (n === undefined) return ''
  if (!unit) return String(n)
  return /^[$€£¥]$/.test(unit) ? `${unit}${n}` : `${n} ${unit}`
}

/** A short "what to do" line: "8 a day", "suggested 12 reps", "target 180 lb". */
export function goalHint(goal: Goal, day: string): string {
  const u = (n: number | undefined) => amount(n, goal.unit)
  switch (goal.kind) {
    case 'check':
      return ''
    case 'tally':
      return `${goal.perDay ?? 1} a day`
    case 'progressive':
      return `suggested ${u(suggested(goal, day))}`
    case 'measure':
      return goal.target !== undefined ? `target ${u(goal.target)}` : ''
    case 'total':
      return goal.target !== undefined ? `${u(totalTo(goal, day))} of ${u(goal.target)}` : `${u(totalTo(goal, day))} so far`
  }
}

/** Days in a range that the goal applied, with what was logged: for charts and streaks. Oldest first. */
export function history(goal: Goal, from: string, to: string): { day: string; entry?: GoalEntry; suggested?: number }[] {
  const out = []
  for (let i = 0, n = diffDays(from, to); i <= n; i++) {
    const [y, m, d] = from.split('-').map(Number)
    const day = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10)
    if (!goal.weekdays?.length || goal.weekdays.includes(weekday(day))) {
      // A progressive goal has no suggestion before it starts.
      const s = goal.kind === 'progressive' ? (goal.progression && day >= goal.progression.from ? suggested(goal, day) : undefined) : goal.kind === 'measure' || goal.kind === 'total' ? goal.target : undefined
      out.push({ day, entry: goal.log?.[day], suggested: s })
    }
  }
  return out
}

/**
 * Goals grouped by who can log them (the menu and Goals page): yours that only you log; shared ones that others
 * can log too (and you can); then, per person, goals you can only view. Archived goals are left out.
 */
export function goalGroups(goals: Goal[], uid: string, role: Role, household: Household): { key: string; title: string; goals: Goal[] }[] {
  const active = goals.filter((g) => !g.archived)
  const mine: Goal[] = []
  const shared: Goal[] = []
  const viewOnly = new Map<string, Goal[]>()
  for (const g of active) {
    if (!canLogGoal(g, uid, role)) viewOnly.set(g.ownerId, [...(viewOnly.get(g.ownerId) ?? []), g])
    else if (g.ownerId === uid && (g.editAudience ?? (g.visibility === 'private' ? 'private' : 'family')) === 'private') mine.push(g)
    else shared.push(g)
  }
  const groups = [
    { key: 'mine', title: 'My goals', goals: mine },
    { key: 'shared', title: 'Shared goals', goals: shared },
    ...[...viewOnly].map(([owner, gs]) => ({ key: `of:${owner}`, title: `${household.members[owner]?.displayName ?? 'Someone'}'s goals`, goals: gs })),
  ]
  return groups.filter((g) => g.goals.length)
}

/** The time in the goal's unit: hours or seconds if the unit says so, otherwise minutes (one decimal). */
export function timerValue(ms: number, unit?: string): number {
  const u = (unit ?? '').trim().toLowerCase()
  if (/^(h|hr|hrs|hour|hours)$/.test(u)) return Math.round((ms / 3_600_000) * 100) / 100
  if (/^(s|sec|secs|second|seconds)$/.test(u)) return Math.round(ms / 1000)
  return Math.round((ms / 60_000) * 10) / 10
}

/**
 * Who else logs a goal, for a short note beside its name: "Family" (everyone in the household can), "with Sam"
 * (named people besides you), or "" when only you (or only its owner) log it.
 */
export function otherLoggers(goal: Pick<Goal, 'ownerId' | 'editAudience' | 'editors' | 'visibility'>, household: Household, uid: string): string {
  const a = goal.editAudience ?? (goal.visibility === 'private' ? 'private' : 'family')
  if (a === 'private') return ''
  if (a === 'family' || a === 'everyone') return 'Family'
  const names = (goal.editors ?? []).filter((id) => id !== uid).map((id) => household.members[id]?.displayName ?? 'someone')
  return names.length ? `with ${names.join(', ')}` : ''
}

/**
 * Goals you add to through the day (reps, minutes, a tally): more is better and it accumulates, so the log box offers
 * "+ more". Single measurements (weight) and lower-is-better goals don't.
 */
export function accumulates(goal: Pick<Goal, 'kind' | 'progression' | 'target' | 'direction'>): boolean {
  if (goal.kind === 'tally') return true
  if (goal.kind === 'progressive') return !decreasing(goal)
  if (goal.kind === 'measure') return goal.direction === 'up'
  return false
}

export type GoalState = 'none' | 'partial' | 'notYet' | 'met' | 'exceeded'

/**
 * Where the day stands, in words: nothing logged yet; started but more to do ("4 to go"); a single measurement not
 * there yet ("1.2 lb to go"); met; or beyond it ("+3 extra", "0.8 lb ahead"). Lower-is-better goals (weight) count
 * being under the target as ahead. A running total is about the whole goal ("$2,650 to go", then reached).
 */
export function goalStatus(goal: Goal, entry: GoalEntry | undefined, day: string): { state: GoalState; text: string } {
  const u = (n: number) => amount(Math.round(Math.abs(n) * 100) / 100, goal.unit)
  const compare = (value: number | undefined, target: number | undefined, lowerIsBetter: boolean, single: boolean) => {
    if (value === undefined) return { state: 'none' as const, text: '' }
    if (target === undefined) return { state: 'met' as const, text: 'Logged' }
    const gap = lowerIsBetter ? value - target : target - value // > 0: not there yet
    if (gap > 0) return { state: single ? ('notYet' as const) : ('partial' as const), text: `${u(gap)} to go` }
    if (gap === 0) return { state: 'met' as const, text: single ? 'On target' : 'Done' }
    return { state: 'exceeded' as const, text: lowerIsBetter ? `${u(gap)} ahead` : `+${u(gap)} extra` }
  }
  switch (goal.kind) {
    case 'check':
      return entry?.done ? { state: 'met', text: 'Done' } : { state: 'none', text: '' }
    case 'tally':
      return compare(entry?.count || undefined, goal.perDay ?? 1, false, false)
    case 'progressive':
      return compare(entry?.value, suggested(goal, day), decreasing(goal), decreasing(goal))
    case 'measure':
      return compare(entry?.value, goal.target, goal.direction !== 'up', goal.direction !== 'up')
    case 'total': {
      if (goal.target === undefined) return { state: entry?.value ? 'met' : 'none', text: '' }
      const sofar = totalTo(goal, day)
      if (sofar >= goal.target) return { state: sofar > goal.target ? 'exceeded' : 'met', text: 'Reached' }
      return { state: sofar > 0 ? 'partial' : 'none', text: `${u(goal.target - sofar)} to go` }
    }
  }
}
