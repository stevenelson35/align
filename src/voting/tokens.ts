// Token balance (DESIGN.md §7): weekly grants roll over with no cap; votes on open or chosen items count against it.
import type { ItemStatus } from '../types'

const WEEK_MS = 7 * 86_400_000

/** Grants received so far: one at tokenStartDate, then one every 7 days. */
export function weeksElapsed(tokenStartDate: Date, now: Date): number {
  const ms = now.getTime() - tokenStartDate.getTime()
  return ms < 0 ? 0 : Math.floor(ms / WEEK_MS) + 1
}

export function tokenBalance(
  weeklyTokens: number,
  weeks: number,
  myVotes: { tokens: number; itemStatus: ItemStatus | undefined }[],
): number {
  const committed = myVotes
    .filter((v) => v.itemStatus === 'open' || v.itemStatus === 'chosen')
    .reduce((sum, v) => sum + v.tokens, 0)
  return weeklyTokens * weeks - committed
}
