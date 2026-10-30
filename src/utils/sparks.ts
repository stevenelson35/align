// Sparks (goal rewards, DESIGN.md §5.6): each goal you meet earns one (up to 5 a day), and finishing all of your
// day's goals 2 more. They're banked: never spent, never lost. The family's lifetime total unlocks the reward ladder;
// sparks earned since a reveal began are your moves in its game. Pure helpers, unit-tested.

export const SPARKS_PER_DAY = 5
export const DAY_BONUS = 2
/** Moves everyone gets when a new reveal starts, so it can be tried at once. */
export const STARTER_MOVES = 3

/** A day's sparks from how many of your goals you met. */
export function daySparks(met: number, total: number): number {
  if (total <= 0 || met <= 0) return 0
  return Math.min(SPARKS_PER_DAY, met) + (met >= total ? DAY_BONUS : 0)
}

/** sparks/{uid}: that person's sparks by day. */
export type SparkDays = Record<string, number>

export const totalSparks = (days: SparkDays | undefined, from = '') =>
  Object.entries(days ?? {}).reduce((sum, [d, n]) => (d >= from && Number.isFinite(n) ? sum + n : sum), 0)

/** Everyone's sparks, all time. */
export const familySparks = (all: Record<string, SparkDays>) => Object.values(all).reduce((sum, days) => sum + totalSparks(days), 0)

/** Moves you have left in a reveal: starter moves, plus sparks earned since it began, less moves played. */
export const movesLeft = (days: SparkDays | undefined, startedAt: string, spent: number | undefined) => Math.max(0, STARTER_MOVES + totalSparks(days, startedAt) - (spent ?? 0))

export interface Reward {
  title: string
  sparks: number
}

/** The ladder until someone changes it. */
export const DEFAULT_LADDER: Reward[] = [
  { title: 'Ice cream night', sparks: 50 },
  { title: 'Movie night', sparks: 120 },
  { title: 'Weekend outing', sparks: 300 },
  { title: 'Vacation fund', sparks: 1000 },
]

/** The ladder in order, which are unlocked by the family's total, and the next one up. */
export function ladderStatus(rewards: Reward[], total: number): { rewards: (Reward & { unlocked: boolean })[]; next?: Reward & { toGo: number } } {
  const sorted = [...rewards].sort((a, b) => a.sparks - b.sparks)
  const next = sorted.find((r) => r.sparks > total)
  return { rewards: sorted.map((r) => ({ ...r, unlocked: total >= r.sparks })), next: next && { ...next, toGo: next.sparks - total } }
}

/** A ladder as typed: titles trimmed, sensible numbers, at most 20. */
export function cleanLadder(rewards: { title: string; sparks: number | string }[]): Reward[] {
  return rewards
    .map((r) => ({ title: r.title.trim().slice(0, 60), sparks: Math.round(Number(r.sparks)) }))
    .filter((r) => r.title && Number.isFinite(r.sparks) && r.sparks > 0 && r.sparks <= 1_000_000)
    .slice(0, 20)
}

/** The next reveal's photo, by chance (so whoever starts it doesn't know): a top pick not revealed yet, else any
 *  favorite not revealed yet, else any. */
export function pickRevealPhoto(photos: { id: string; top?: boolean }[], past: string[], rand: () => number): string | null {
  const seen = new Set(past)
  const pool = [photos.filter((p) => p.top && !seen.has(p.id)), photos.filter((p) => !seen.has(p.id)), photos].find((list) => list.length)
  return pool ? pool[Math.floor(rand() * pool.length)].id : null
}
