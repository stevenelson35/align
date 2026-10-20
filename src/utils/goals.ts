// Daily goals (DESIGN.md §5.6): which days they apply, the suggested amount for progressive goals, and progress.
import { diffDays } from '../engine/dates'
import type { Goal, GoalEntry } from '../types'

/** 0 = Sunday, like Date.getDay(), for a 'YYYY-MM-DD' day (no time zone surprises). */
export function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function appliesOn(goal: Pick<Goal, 'weekdays' | 'archived'>, day: string): boolean {
  if (goal.archived) return false
  return !goal.weekdays?.length || goal.weekdays.includes(weekday(day))
}

/** Progressive: start, plus `step` for every full `every` days/weeks since `from`, kept within min..max. */
export function suggested(goal: Pick<Goal, 'progression'>, day: string): number | undefined {
  const p = goal.progression
  if (!p) return undefined
  const period = Math.max(1, p.every) * (p.per === 'week' ? 7 : 1)
  const steps = Math.max(0, Math.floor(diffDays(p.from, day) / period))
  let v = p.start + steps * p.step
  if (p.max !== undefined) v = Math.min(v, p.max)
  if (p.min !== undefined) v = Math.max(v, p.min)
  return Math.round(v * 100) / 100
}

/** Is the day's goal met? check: done; tally: perDay taps; progressive: did at least the suggestion; measure: at or past target. */
export function met(goal: Goal, entry: GoalEntry | undefined, day: string): boolean {
  if (!entry) return false
  switch (goal.kind) {
    case 'check':
      return !!entry.done
    case 'tally':
      return (entry.count ?? 0) >= (goal.perDay ?? 1)
    case 'progressive':
      return entry.value !== undefined && entry.value >= (suggested(goal, day) ?? 0)
    case 'measure':
      if (entry.value === undefined || goal.target === undefined) return false
      return goal.direction === 'up' ? entry.value >= goal.target : entry.value <= goal.target
  }
}

/** A short "what to do" line: "8 a day", "suggested 12 reps", "target 180 lb". */
export function goalHint(goal: Goal, day: string): string {
  const unit = goal.unit ? ` ${goal.unit}` : ''
  switch (goal.kind) {
    case 'check':
      return ''
    case 'tally':
      return `${goal.perDay ?? 1} a day`
    case 'progressive':
      return `suggested ${suggested(goal, day)}${unit}`
    case 'measure':
      return goal.target !== undefined ? `target ${goal.target}${unit}` : ''
  }
}

/** Days in a range that the goal applied, with what was logged: for charts and streaks. Oldest first. */
export function history(goal: Goal, from: string, to: string): { day: string; entry?: GoalEntry; suggested?: number }[] {
  const out = []
  for (let i = 0, n = diffDays(from, to); i <= n; i++) {
    const [y, m, d] = from.split('-').map(Number)
    const day = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10)
    if (!goal.weekdays?.length || goal.weekdays.includes(weekday(day))) {
      out.push({ day, entry: goal.log?.[day], suggested: goal.kind === 'progressive' ? suggested(goal, day) : goal.kind === 'measure' ? goal.target : undefined })
    }
  }
  return out
}
