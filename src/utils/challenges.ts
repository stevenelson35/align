// Family challenges (DESIGN.md §5.24): a race to each person's own goal, measured in percent of that goal (so 200 →
// 170 lb and 138 → 128 lb compare fairly). Any numeric goal works, down or up (lose weight, save money, run miles).
// Pure and unit-tested.

export interface ChallengeEntry {
  /** When (ISO time). */
  at: string
  v: number
}

export interface ChallengePlayer {
  nickname: string
  /** An emoji on the track. */
  icon: string
  /** #rrggbb: their bar and line. */
  color: string
  start: number
  goal: number
  log?: ChallengeEntry[]
  /** A goal of theirs (a measure) that each check-in also logs. */
  goalId?: string
  joinedAt?: string
}

export interface Challenge {
  id: string
  title: string
  /** "lb", "kg", "$", "miles"… */
  unit: string
  /** The finish line's emoji. */
  goalIcon: string
  createdBy: string
  /** Everyone who can see it (the creator too); players are those who accepted. */
  invited: string[]
  players: Record<string, ChallengePlayer>
  status: 'active' | 'ended'
  createdAt?: string
  endedAt?: string
}

export const PLAYER_ICONS = ['🏃', '🏃‍♀️', '🚴', '🏊', '🧘', '🚶', '🐢', '🐇', '🦄', '🐎', '🚀', '🦊']
export const GOAL_ICONS = ['🏁', '🏆', '🎯', '⭐', '🥇', '🎉', '⛰️', '🏝️']
export const PLAYER_COLORS = ['#2da44e', '#d4893a', '#1f6feb', '#bf3989', '#8250df', '#cf222e', '#1b7c83', '#9a6700']

/** Their latest value (or where they started). */
export const current = (p: ChallengePlayer) => (p.log?.length ? p.log[p.log.length - 1].v : p.start)

/** How far to their goal, 0–100 (whole percent): down or up, whichever way their goal is. */
export function percent(p: ChallengePlayer, value = current(p)): number {
  const span = p.goal - p.start
  if (!span) return 0
  return Math.max(0, Math.min(100, Math.round(((value - p.start) / span) * 100)))
}

/** Players, furthest along first (ties: who got there first by joining order). */
export function ranked(c: Pick<Challenge, 'players'>): { uid: string; p: ChallengePlayer; pct: number }[] {
  return Object.entries(c.players)
    .map(([uid, p]) => ({ uid, p, pct: percent(p) }))
    .sort((a, b) => b.pct - a.pct || (a.p.joinedAt ?? '').localeCompare(b.p.joinedAt ?? ''))
}

/**
 * Where each icon sits on the one-line track: its percent across, and a lane (0, 1, 2…) so icons close together
 * don't hide each other.
 */
export function trackPositions(c: Pick<Challenge, 'players'>, near = 7): { uid: string; pct: number; lane: number }[] {
  const out: { uid: string; pct: number; lane: number }[] = []
  for (const { uid, pct } of [...ranked(c)].sort((a, b) => a.pct - b.pct)) {
    let lane = 0
    while (out.some((o) => o.lane === lane && Math.abs(o.pct - pct) < near)) lane++
    out.push({ uid, pct, lane })
  }
  return out
}

/** The 25 / 50 / 75 / 100% marks passed going from one value to the next (none going backward). */
export function milestonesPassed(p: ChallengePlayer, before: number, after: number): number[] {
  const a = percent(p, before)
  const b = percent(p, after)
  return [25, 50, 75, 100].filter((m) => a < m && b >= m)
}

/** Who you passed with a new value (they were ahead of or level with you, and now you're ahead). */
export function overtaken(c: Pick<Challenge, 'players'>, uid: string, after: number): string[] {
  const me = c.players[uid]
  if (!me) return []
  const was = percent(me)
  const now = percent(me, after)
  return Object.entries(c.players)
    .filter(([id, p]) => id !== uid && percent(p) >= was && percent(p) < now)
    .map(([id]) => id)
}

/** Everyone's reached their goal. */
export const allFinished = (c: Pick<Challenge, 'players'>) => Object.values(c.players).length > 0 && Object.values(c.players).every((p) => percent(p) >= 100)

/** Whether they've checked in on a day ("2026-11-28", in local time). */
export const checkedInOn = (p: ChallengePlayer, day: string) => (p.log ?? []).some((e) => localDay(e.at) === day)

export const localDay = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A player's line for the graph: their start, then each check-in, as [time, percent or value]. */
export function series(p: ChallengePlayer, as: 'percent' | 'value', since: string): [number, number][] {
  const points: [number, number][] = [[Date.parse(p.joinedAt ?? since), as === 'percent' ? 0 : p.start]]
  for (const e of p.log ?? []) points.push([Date.parse(e.at), as === 'percent' ? percent(p, e.v) : e.v])
  return points
}

/** A value as typed ("195", "195.4 lb") → a number, or null. */
export function parseValue(text: string): number | null {
  const m = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}
