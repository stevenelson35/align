// Whole-day dates as "YYYY-MM-DD" strings (DESIGN.md §6.1). Arithmetic is done in UTC so DST never shifts a day.

const DAY_MS = 86_400_000

function toUtc(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(day: string, n: number): string {
  return fromUtc(toUtc(day) + n * DAY_MS)
}

/** Days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS)
}

/** A local Date as a day string. */
export function toDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function today(): string {
  return toDay(new Date())
}

/** e.g. "Wed, Oct 7". */
export function formatDay(day: string): string {
  return new Date(toUtc(day)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}
