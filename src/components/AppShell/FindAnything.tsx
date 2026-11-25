import { useState } from 'react'
import { formatDay } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { searchAll } from '../../utils/search'
import { PRIVACY_ICON } from '../../utils/tasks'
import { Icon } from '../UI/Icon'
import { LIBRARY_FIND_KEY, useLibraryPages, type LibraryPage } from '../../hooks/useLibraryPages'

/** Entries and lists matching what's typed (tasks, checklist items, notes, links, lists), each opening it. */
export function EntryResults({ query, limit = 30, onPick }: { query: string; limit?: number; onPick?: () => void }) {
  const app = useApp()
  const { tasks, listItems, lists } = useData()
  const results = searchAll(query, tasks, listItems, lists, limit)
  if (!results.length) return null
  return (
    <ul className="search-results find-results">
      {results.map((r) =>
        r.kind === 'list' ? (
          <li key={`l${r.list.id}`}>
            <button type="button" onClick={() => (app.navigate({ view: 'list', listId: r.list.id, timeline: false }), onPick?.())}>
              <Icon name="list" /> <strong>{r.list.name}</strong> <span className="muted small">{r.list.kind === 'list' ? 'task list' : r.list.kind}</span>
            </button>
          </li>
        ) : (
          <li key={r.task.id}>
            <button type="button" onClick={() => (app.navigate({ view: 'task', taskId: r.task.id }), onPick?.())}>
              <span className={r.task.status === 'done' || r.task.status === 'canceled' ? 'muted strike' : ''}>{r.task.title}</span>{' '}
              <span className="muted small">
                {r.list && `${r.list.visibility !== 'family' ? `${PRIVACY_ICON[r.list.visibility]} ` : ''}${r.list.name}`}
                {r.task.startDate && ` · ${formatDay(r.task.startDate)}`}
              </span>
            </button>
          </li>
        ),
      )}
    </ul>
  )
}

/**
 * Find… at the top of Home's More sheet: browse before typing (every page as a tap, and the Library for everything
 * else), and type to narrow to pages, lists and entries. "See everything" carries what you typed to the Library.
 */
export function FindAnything({ onPick }: { onPick?: () => void }) {
  const app = useApp()
  const pages = useLibraryPages()
  const [query, setQuery] = useState('')
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const pageHits = words.length ? pages.filter((p) => words.every((w) => p.label.toLowerCase().includes(w))) : pages
  const open = (p: LibraryPage) => {
    if (p.route) app.navigate(p.route)
    else p.onClick?.()
    onPick?.()
  }
  const library = () => {
    if (query.trim()) sessionStorage.setItem(LIBRARY_FIND_KEY, query.trim())
    app.navigate({ view: 'library' })
    onPick?.()
  }
  return (
    <div className="find-anything">
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find anything…" aria-label="Find anything in Align" />
      {pageHits.length > 0 && (
        <div className="find-pages" aria-label="Pages">
          {pageHits.map((p) => (
            <button key={p.label} type="button" className="find-page" onClick={() => open(p)}>
              <Icon name={p.icon} /> {p.label}
              {!!p.badge && <span className="library-badge">{p.badge}</span>}
            </button>
          ))}
        </div>
      )}
      {words.length > 0 && <EntryResults query={query} limit={12} onPick={onPick} />}
      <button type="button" className="link small find-library" onClick={library}>
        <Icon name="book" /> {words.length ? `See everything for “${query.trim()}” in the Library` : 'Everything else: the Library (every list, page and board)'} ›
      </button>
    </div>
  )
}
