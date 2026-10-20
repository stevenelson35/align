// Search across tasks, checklist items, notes, links and list names (DESIGN.md §10). Plain substring matching on
// every word, title matches first: a household's data fits in memory, so no index is needed.
import type { List, Task } from '../types'

export type SearchResult = { kind: 'task' | 'item'; task: Task; list?: List } | { kind: 'list'; list: List }

export function searchAll(query: string, tasks: Task[], items: Task[], lists: List[], limit = 30): SearchResult[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const matches = (text: string) => words.every((w) => text.includes(w))
  const listById = new Map(lists.map((l) => [l.id, l]))
  const scored: { score: number; result: SearchResult }[] = []
  for (const l of lists) if (matches(l.name.toLowerCase())) scored.push({ score: 0, result: { kind: 'list', list: l } })
  for (const [kind, docs] of [['task', tasks], ['item', items]] as const) {
    for (const t of docs) {
      const title = t.title.toLowerCase()
      const rest = [t.notes, t.url, t.category].filter(Boolean).join(' ').toLowerCase()
      if (!matches(`${title} ${rest}`)) continue
      const finished = t.status === 'done' || t.status === 'canceled'
      scored.push({ score: (matches(title) ? 1 : 2) + (finished ? 2 : 0), result: { kind, task: t, list: listById.get(t.listId) } })
    }
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.result)
}
