import { useEffect, useRef, useState } from 'react'
import { DAILY_ITEMS } from '../../daily/settings'
import { GAMES } from '../../games/catalog'
import { useApp, useData } from '../../hooks/useApp'
import { useTodayTiles } from '../../hooks/useTodayTiles'
import { people } from '../../utils/tasks'
import { addGroup, groupNames, tile, type Tile, type TilePlace } from '../../utils/tiles'
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
  // Where new tiles go: the top of Today (above your groups), a group, or More….
  const [place, setPlace] = useState<string>('top')
  const yourGroups = groupNames(today.tiles)
  const where: TilePlace = place === 'top' || place === 'bottom' || place === 'more' ? place : { group: place.slice(2) }
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
    ;(today.has(t) ? today.remove(t) : today.add(t, where)).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
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
        <label className="small add-to-place">
          Put it in{' '}
          <select
            value={place}
            onChange={(e) => {
              if (e.target.value !== 'new') return setPlace(e.target.value)
              const name = window.prompt('Name the new group (e.g. Kids, School, Call)')?.trim().replace(/\s+/g, ' ').slice(0, 40)
              if (!name) return
              setError(null)
              today.save(addGroup(today.tiles, name)).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
              setPlace(`g:${name}`)
            }}
            aria-label="Where new tiles go"
          >
            <option value="top">Today, above your groups</option>
            <option value="bottom">Today, below your groups</option>
            {yourGroups.map((g) => (
              <option key={g} value={`g:${g}`}>
                The “{g}” group
              </option>
            ))}
            <option value="new">A new group…</option>
            <option value="more">More…</option>
          </select>
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
