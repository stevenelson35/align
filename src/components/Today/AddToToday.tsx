import { useEffect, useRef, useState } from 'react'
import { DAILY_ITEMS } from '../../daily/settings'
import { GAMES } from '../../games/catalog'
import { useApp, useData } from '../../hooks/useApp'
import { useTodayTiles } from '../../hooks/useTodayTiles'
import { people } from '../../utils/tasks'
import { tile, type Tile } from '../../utils/tiles'
import { TODAY_SECTIONS } from '../../utils/today'
import { Icon } from '../UI/Icon'
import { useTileInfo } from './useTileInfo'

/** How many entries a search lists (lists, panels and parts are few). */
const ENTRY_RESULTS = 40

/**
 * Add to Today: search everything you can pin (panels, a person's location, Wordle of the day, an item of The
 * Daily, lists, and any entry) and add it with one tap; tap again to take it off. New tiles go at the end of the
 * main page (or of More…).
 */
export function AddToToday({ onClose }: { onClose: () => void }) {
  const app = useApp()
  const { lists, tasks, listItems } = useData()
  const today = useTodayTiles()
  const info = useTileInfo()
  const [query, setQuery] = useState('')
  const [toMore, setToMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (...text: (string | undefined)[]) => {
    const all = text.filter(Boolean).join(' ').toLowerCase()
    return words.every((w) => all.includes(w))
  }

  const panels = [tile('panel', 'todo'), ...TODAY_SECTIONS.map((s) => tile('panel', s.id))]
  const parts: Tile[] = [
    ...(app.isMember ? people(app.household, true).map(([uid]) => tile('person', uid)) : []),
    tile('game', 'wordle'),
    ...GAMES.filter((g) => g.id !== 'wordle').map((g) => tile('game', g.id)),
    ...DAILY_ITEMS.map((i) => tile('daily', i.value)),
  ]
  const listTiles = [...lists].sort((a, b) => a.name.localeCompare(b.name)).map((l) => tile('list', l.id))
  // Entries only once you type (there are thousands); open tasks before finished ones.
  const entryTiles = words.length
    ? [...listItems, ...tasks.filter((t) => t.status !== 'done' && t.status !== 'canceled')]
        .filter((t) => matches(t.title, t.category, t.contact?.org))
        .slice(0, ENTRY_RESULTS)
        .map((t) => tile('entry', t.id))
    : []

  const groups: { title: string; tiles: Tile[] }[] = [
    { title: 'Panels', tiles: panels },
    { title: 'Parts of panels', tiles: parts },
    { title: 'Lists', tiles: listTiles },
    { title: 'Entries', tiles: entryTiles },
  ]
    .map((g) => ({ ...g, tiles: g.tiles.filter((t) => g.title === 'Entries' || matches(info(t).label, info(t).kind)) }))
    .filter((g) => g.tiles.length)

  const toggle = (t: Tile) => {
    setError(null)
    ;(today.has(t) ? today.remove(t) : today.add(t, toMore)).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal add-to-today" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add to Today">
        <div className="row">
          <input
            ref={input}
            type="search"
            placeholder="Find a panel, person, list or entry…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            aria-label="Find something to add to Today"
          />
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <label className="small add-to-more">
          <input type="checkbox" checked={toMore} onChange={() => setToMore(!toMore)} /> Add to More… instead of the main page
        </label>
        {error && <p className="error small">{error}</p>}
        <div className="add-to-today-results">
          {groups.map((g) => (
            <section key={g.title}>
              <h4 className="muted small">{g.title}</h4>
              <ul>
                {g.tiles.map((t) => {
                  const it = info(t)
                  const on = today.has(t)
                  return (
                    <li key={t} className="row">
                      <span className="grow">
                        <Icon name={it.icon} /> {it.label} <span className="muted small">{it.kind}</span>
                      </span>
                      <button type="button" className={on ? 'secondary small' : 'small'} onClick={() => toggle(t)} aria-pressed={on} aria-label={on ? `Take ${it.label} off Today` : `Add ${it.label} to Today`}>
                        {on ? '✓ On Today' : 'Add'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {!groups.length && <p className="muted small">Nothing matches “{query.trim()}”.</p>}
          {!words.length && <p className="muted small">Type to find entries (a person, a link, a task, a note).</p>}
        </div>
      </div>
    </div>
  )
}
