import { useEffect, useRef, useState } from 'react'
import { formatDay } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { PRIVACY_ICON } from '../../utils/tasks'
import { searchAll } from '../../utils/search'

/** 🔍 Search (or "/"): tasks, checklist items, notes, links and lists. Picking one opens it. */
export function SearchDialog({ onClose }: { onClose: () => void }) {
  const app = useApp()
  const { tasks, listItems, lists } = useData()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])
  const results = searchAll(query, tasks, listItems, lists)

  return (
    <div className="modal-backdrop search-backdrop" onClick={onClose}>
      <div className="card modal search-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
        <div className="row">
          <input
            ref={inputRef}
            type="search"
            placeholder="Search tasks, items, notes, links, lists…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            aria-label="Search"
          />
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <ul className="search-results">
          {results.map((r) =>
            r.kind === 'list' ? (
              <li key={`l${r.list.id}`}>
                <button type="button" onClick={() => (app.navigate({ view: 'list', listId: r.list.id, timeline: false }), onClose())}>
                  <strong>{r.list.name}</strong> <span className="muted small">{r.list.kind === 'list' ? 'task list' : r.list.kind}</span>
                </button>
              </li>
            ) : (
              <li key={r.task.id}>
                <button type="button" onClick={() => (app.navigate({ view: 'task', taskId: r.task.id }), onClose())}>
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
        {query.trim() && results.length === 0 && <p className="muted small">Nothing matches "{query.trim()}".</p>}
        {!query.trim() && <p className="muted small">Shortcuts on a keyboard: / search · n new task · t today</p>}
      </div>
    </div>
  )
}
