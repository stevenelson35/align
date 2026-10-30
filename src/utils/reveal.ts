// The reveal's ice (goal rewards, DESIGN.md §5.6): each cell of the picture takes `thick` hits to break. Pure
// helpers, unit-tested: what a move breaks (with a little help at the very end), and how thick to make the ice so a
// reveal takes about a week for however many people are earning sparks.
import { addDays } from '../engine/dates'
import type { SparkDays } from './sparks'

/** Hits still needed per cell (0 = clear). */
export function iceLeft(hits: Record<string, number> | undefined, thick: number, cells: number): number[] {
  return Array.from({ length: cells }, (_, i) => Math.max(0, thick - (hits?.[i] ?? 0)))
}

/** When this few cells still have ice, each move also chips the one nearest its bursts (no stubborn last squares). */
export const ASSIST_BELOW = 5

/**
 * What a move breaks: one hit per burst on a cell that still has ice (a cell bursting twice in a chain takes two),
 * never more than it needs; then, near the end, one more hit on the iced cell nearest the bursts.
 */
export function moveHits(burst: number[], left: number[], cols: number): Record<number, number> {
  const need = left.slice()
  const out: Record<number, number> = {}
  for (const i of burst)
    if (need[i] > 0) {
      need[i]--
      out[i] = (out[i] ?? 0) + 1
    }
  const still = need.flatMap((n, i) => (n > 0 ? [i] : []))
  if (still.length && still.length <= ASSIST_BELOW && burst.length) {
    const cx = burst.reduce((s, i) => s + (i % cols), 0) / burst.length
    const cy = burst.reduce((s, i) => s + Math.floor(i / cols), 0) / burst.length
    const dist = (i: number) => Math.hypot((i % cols) - cx, Math.floor(i / cols) - cy)
    const near = still.reduce((a, b) => (dist(b) < dist(a) ? b : a))
    out[near] = (out[near] ?? 0) + 1
  }
  return out
}

/** People who earned sparks in the last two weeks (at least 1). */
export function activeEarners(all: Record<string, SparkDays>, day: string): number {
  const from = addDays(day, -13)
  return Math.max(1, Object.values(all).filter((days) => Object.entries(days).some(([d, n]) => d >= from && d <= day && n > 0)).length)
}

/** Ice thickness for a new reveal: about a week of moves for this many people earning sparks (2 to 4 hits). */
export const thicknessFor = (earners: number) => Math.min(4, Math.max(2, earners + 1))
