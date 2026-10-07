// Small fuzzy matcher for chat commands (DESIGN.md §9). Good enough for hundreds of household names.

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 0..1: exact 1, prefix 0.9, substring 0.8, otherwise the share of query words found in the name. */
export function score(query: string, name: string): number {
  const q = normalize(query)
  const n = normalize(name)
  if (!q || !n) return 0
  if (q === n) return 1
  if (n.startsWith(q)) return 0.9
  if (n.includes(q)) return 0.8
  const words = q.split(' ')
  const nameWords = n.split(' ')
  const hits = words.filter((w) => nameWords.some((nw) => nw.startsWith(w) || (w.length > 3 && nw.includes(w)))).length
  return (0.7 * hits) / words.length
}

export type MatchResult<T> = { kind: 'none' } | { kind: 'one'; item: T } | { kind: 'many'; items: T[] }

/** Returns one match when the best is clearly ahead, several when they're close, none below the threshold. */
export function fuzzyMatch<T>(query: string, items: T[], nameOf: (item: T) => string, threshold = 0.5): MatchResult<T> {
  const scored = items
    .map((item) => ({ item, s: score(query, nameOf(item)) }))
    .filter((x) => x.s >= threshold)
    .sort((a, b) => b.s - a.s)
  if (scored.length === 0) return { kind: 'none' }
  if (scored[0].s === 1) {
    const exact = scored.filter((x) => x.s === 1)
    return exact.length === 1 ? { kind: 'one', item: exact[0].item } : { kind: 'many', items: exact.map((x) => x.item) }
  }
  const close = scored.filter((x) => x.s >= scored[0].s - 0.05)
  return close.length === 1 ? { kind: 'one', item: close[0].item } : { kind: 'many', items: close.slice(0, 5).map((x) => x.item) }
}
