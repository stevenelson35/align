import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DAILY_ITEMS } from '../../daily/settings'
import { addTaskNow } from '../../firebase/db'
import { GAMES } from '../../games/catalog'
import { useApp, useData } from '../../hooks/useApp'
import { useTodayTiles } from '../../hooks/useTodayTiles'
import type { List } from '../../types'
import { defaultName, safeUrl } from '../../utils/links'
import { LIST_KIND } from '../../utils/listKinds'
import { splitTitleNote } from '../../utils/quickAdd'
import { people } from '../../utils/tasks'
import { addGroup, addTile, groupNames, tile, tilesInGroup, type Tile, type TilePlace } from '../../utils/tiles'
import { TODAY_SECTIONS } from '../../utils/today'
import { Icon } from '../UI/Icon'
import { useTileInfo } from './useTileInfo'

/** How many entries a search lists (lists, panels and parts are few). */
const ENTRY_RESULTS = 40
/** Kinds of list a new entry can go in from here (one line of text makes sense for them). */
const QUICK_KINDS: List['kind'][] = ['list', 'project', 'checklist', 'notes', 'links', 'picks']
const LAST_LIST = 'align-add-entry-list'

const placeKey = (p: TilePlace) => (typeof p === 'string' ? p : `g:${p.group}`)
const keyPlace = (k: string): TilePlace => (k === 'top' || k === 'bottom' || k === 'more' ? k : { group: k.slice(2) })

/**
 * Add to Today, from the footer's + or a group's +: where it goes ("Put it in"), what that group holds now (✕ takes
 * one off), something new (an entry in one of your lists, a new list, or a new group; each is pinned where you
 * chose), and a search over everything you can pin (panels, a person's location, Wordle of the day, an item of The
 * Daily, lists, any entry), each added or taken off with one tap.
 */
export function AddToToday({ onClose, start = 'top' }: { onClose: () => void; /** Where it opens aimed (a group's +). */ start?: TilePlace }) {
  const app = useApp()
  const { lists, tasks, listItems } = useData()
  const today = useTodayTiles()
  const info = useTileInfo()
  const [query, setQuery] = useState('')
  const [place, setPlace] = useState<string>(placeKey(start))
  const yourGroups = groupNames(today.tiles)
  const where = keyPlace(place)
  const group = typeof where === 'object' ? where.group : null
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [making, setMaking] = useState<'entry' | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (start === 'top') input.current?.focus()
  }, [start])
  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err))

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

  const sections: { title: string; tiles: Tile[] }[] = words.length
    ? [
        { title: 'Panels', tiles: panels },
        { title: 'Parts of panels', tiles: parts },
        { title: 'Lists', tiles: listTiles },
        { title: 'Entries', tiles: entryTiles },
      ]
        .map((g) => ({ ...g, tiles: g.tiles.filter((t) => g.title === 'Entries' || matches(info(t).label, info(t).kind)) }))
        .filter((g) => g.tiles.length)
    : [
        { title: 'Panels', tiles: panels },
        { title: 'Parts of panels', tiles: parts },
        { title: 'Lists', tiles: listTiles },
      ]

  const toggle = (t: Tile) => {
    setError(null)
    setNote(null)
    ;(today.has(t) ? today.remove(t) : today.add(t, where)).catch(fail)
  }

  const whereText = place === 'top' ? 'at the top of Today' : place === 'bottom' ? 'on Today, below your groups' : place === 'more' ? 'in More…' : `in “${group}”`

  function newGroup() {
    const name = window.prompt('Name the new group (e.g. Kids, School, Call)')?.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!name) return
    setError(null)
    today.save(addGroup(today.tiles, name)).catch(fail)
    setPlace(`g:${name}`)
    setNote(`Made the “${name}” group. What you add now goes in it.`)
  }

  function newList() {
    setError(null)
    // The list editor (who sees it, who edits it…); the new list is pinned here instead of opening.
    app.editList(null, undefined, (id) => {
      today.save(addTile(today.tiles, tile('list', id), where)).catch(fail)
      setNote(`Your new list is on Today ${whereText}. Add to it with its +.`)
    })
  }

  const inGroup = group ? tilesInGroup(today.tiles, group) : []

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal add-to-today" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={group ? `Add to ${group}` : 'Add to Today'}>
        <div className="row">
          <strong className="grow">{group ? `Add to “${group}”` : 'Add to Today'}</strong>
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <label className="small add-to-place">
          Put it in{' '}
          <select
            value={place}
            onChange={(e) => {
              setNote(null)
              if (e.target.value === 'new') newGroup()
              else setPlace(e.target.value)
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
        {note && <p className="small sent-note"><Icon name="check" /> {note}</p>}

        <div className="add-to-today-results">
          {group && (
            <section>
              <h4 className="muted small">In “{group}” now</h4>
              {inGroup.length ? (
                <ul>
                  {inGroup.map((t) => {
                    const it = info(t)
                    return (
                      <li key={t} className="row">
                        <span className="grow">
                          <Icon name={it.icon} /> {it.label} <span className="muted small">{it.kind}</span>
                        </span>
                        <button type="button" className="row-action" onClick={() => today.remove(t).catch(fail)} aria-label={`Take ${it.label} out of ${group}`} title="Take it off Today (it stays in its list)">
                          <Icon name="close" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="muted small">Nothing yet: add something below.</p>
              )}
            </section>
          )}

          {app.isMember && (
            <section>
              <h4 className="muted small">Something new</h4>
              <div className="row wrap add-new-buttons">
                <button type="button" className={making === 'entry' ? 'small' : 'secondary small'} onClick={() => setMaking(making === 'entry' ? null : 'entry')} aria-expanded={making === 'entry'}>
                  <Icon name="plus" /> New entry in a list
                </button>
                <button type="button" className="secondary small" onClick={newList}>
                  <Icon name="list" /> New list
                </button>
                <button type="button" className="secondary small" onClick={newGroup}>
                  <Icon name="folder" /> New group
                </button>
              </div>
              {making === 'entry' && (
                <NewEntry
                  onMade={(id, title) => {
                    today.save(addTile(today.tiles, tile('entry', id), where)).catch(fail)
                    setNote(`Added “${title}” and put it ${whereText}.`)
                  }}
                  onError={fail}
                />
              )}
            </section>
          )}

          <section>
            <h4 className="muted small">Find something to pin</h4>
            <input
              ref={input}
              type="search"
              placeholder="A panel, person, list or entry…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && onClose()}
              aria-label="Find something to add to Today"
            />
          </section>
          {sections.map((g) => (
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
          {words.length > 0 && !sections.length && <p className="muted small">Nothing matches “{query.trim()}”.</p>}
          {!words.length && <p className="muted small">Type to find entries too (a person, a link, a task, a note).</p>}
        </div>
      </div>
    </div>
  )
}

/**
 * A new entry in one of your lists, typed in one line ("Title: note"; for a links list, a web address makes it a
 * link). The list is remembered on this device for next time.
 */
function NewEntry({ onMade, onError }: { onMade: (id: string, title: string) => void; onError: (err: unknown) => void }) {
  const app = useApp()
  const { lists } = useData()
  const mine = lists.filter((l) => QUICK_KINDS.includes(l.kind) && !l.giftSecret && app.canEdit(l)).sort((a, b) => a.name.localeCompare(b.name))
  const [listId, setListId] = useState(() => {
    const saved = localStorage.getItem(LAST_LIST)
    return mine.some((l) => l.id === saved) ? saved! : (mine[0]?.id ?? '')
  })
  const [text, setText] = useState('')
  const list = mine.find((l) => l.id === listId)

  function make(e: FormEvent) {
    e.preventDefault()
    const typed = text.trim()
    if (!typed || !list) return
    let fields: { title: string; notes?: string; url?: string }
    const address = list.kind === 'links' ? typed.match(/\b(https?:\/\/\S+|[\w-]+(\.[\w-]+)+(\/\S*)?)/)?.[0] : undefined
    const href = address && safeUrl(address)
    if (href) {
      const rest = typed.replace(address!, '').trim().replace(/^[-:–]\s*/, '')
      fields = { title: rest || defaultName(href), url: href }
    } else fields = splitTitleNote(typed)
    const { id, written } = addTaskNow(list, { ...fields, priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [] }, app.uid)
    written.catch(onError)
    localStorage.setItem(LAST_LIST, list.id)
    setText('')
    onMade(id, fields.title)
  }

  if (!mine.length) return <p className="muted small">You don’t have a list to add to yet: make one with New list.</p>
  return (
    <form className="add-new-entry" onSubmit={make}>
      <select value={listId} onChange={(e) => setListId(e.target.value)} aria-label="Which list">
        {mine.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} ({LIST_KIND[l.kind].label})
          </option>
        ))}
      </select>
      <div className="row">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={list?.kind === 'links' ? 'A web address and a name…' : 'What to add… (title: note)'}
          aria-label="New entry"
        />
        <button type="submit" className="small" disabled={!text.trim()}>
          Add
        </button>
      </div>
    </form>
  )
}
