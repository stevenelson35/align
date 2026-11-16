import { useRef, useState, type FormEvent, type ReactNode } from 'react'
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
import { addGroup, addTile, groupNames, known, placeOf, splitMore, tile, tilesInGroup, type Tile, type TilePlace } from '../../utils/tiles'
import { TODAY_SECTIONS } from '../../utils/today'
import { Icon } from '../UI/Icon'
import { useTileInfo } from './useTileInfo'

/** How many entries a search lists (lists, panels and parts are few). */
const ENTRY_RESULTS = 40
/** Kinds of list a new entry can go in from here (one line of text makes sense for them). */
const QUICK_KINDS: List['kind'][] = ['list', 'project', 'checklist', 'notes', 'links', 'picks']
const LAST_LIST = 'align-add-entry-list'

/** The dialog's screens: the choices, then one task each (or everything on one page). */
type Step = 'choose' | 'find' | 'new' | 'group' | 'remove' | 'all'

const placeKey = (p: TilePlace) => (typeof p === 'string' ? p : `g:${p.group}`)
const keyPlace = (k: string): TilePlace => (k === 'top' || k === 'bottom' || k === 'more' ? k : { group: k.slice(2) })

/**
 * Add to Today, from the footer's + or a group's +. It starts with four choices, each one small screen: pin something
 * already in Align (search), add something new (an entry in one of your lists, or a new list), make a new group, or
 * take something out. "Show everything on one page" has it all at once. What's added goes where it was opened (the
 * group, or the top of Today); "Goes in" changes that.
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

  function newList() {
    setError(null)
    // The list editor (who sees it, who edits it…); the new list is pinned here instead of opening.
    app.editList(null, undefined, (id) => {
      today.save(addTile(today.tiles, tile('list', id), where)).catch(fail)
      setNote(`Your new list is on Today ${whereText}. Add to it with its +.`)
    })
  }

  const inGroup = group ? tilesInGroup(today.tiles, group) : []
  // What "Take something out" lists: the group's tiles, or (aimed at Today itself) the tiles not in any group.
  const removable = group
    ? inGroup
    : splitMore(today.tiles).main.filter((t) => known(t) && !t.startsWith('group:') && !t.startsWith('end:') && placeOf(today.tiles, t)?.group === undefined)
  const [step, setStep] = useState<Step>('choose')
  const [groupName, setGroupName] = useState('')
  const [browse, setBrowse] = useState(false)
  const go = (next: Step) => {
    setError(null)
    setNote(null)
    setStep(next)
  }

  function makeGroup(e: FormEvent) {
    e.preventDefault()
    const name = groupName.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!name) return
    if (yourGroups.includes(name)) return setError(`There’s already a group called “${name}”.`)
    setError(null)
    today.save(addGroup(today.tiles, name)).catch(fail)
    setPlace(`g:${name}`)
    setGroupName('')
    setNote(`Made the “${name}” group. Add something to it?`)
    setStep('choose')
  }

  const title = group ? `“${group}”` : place === 'more' ? 'More…' : 'Today'
  const row = (t: Tile, action: ReactNode) => {
    const it = info(t)
    return (
      <li key={t} className="row">
        <span className="grow">
          <Icon name={it.icon} /> {it.label} <span className="muted small">{it.kind}</span>
        </span>
        {action}
      </li>
    )
  }
  const addButton = (t: Tile) => {
    const it = info(t)
    const on = today.has(t)
    return (
      <button type="button" className={on ? 'secondary small' : 'small'} onClick={() => toggle(t)} aria-pressed={on} aria-label={on ? `Take ${it.label} off Today` : `Add ${it.label} to Today`}>
        {on ? '✓ On Today' : 'Add'}
      </button>
    )
  }
  const removeButton = (t: Tile) => (
    <button type="button" className="row-action" onClick={() => today.remove(t).catch(fail)} aria-label={`Take ${info(t).label} off Today`} title="Take it off Today (it stays in its list)">
      <Icon name="close" />
    </button>
  )
  const results = (all: boolean) =>
    (all || words.length ? sections : []).map((g) => (
      <section key={g.title}>
        <h4 className="muted small">{g.title}</h4>
        <ul>{g.tiles.map((t) => row(t, addButton(t)))}</ul>
      </section>
    ))
  const search = (
    <input
      ref={input}
      type="search"
      autoFocus={step === 'find'}
      placeholder="A list, person, link, task, note or panel…"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      aria-label="Find something to add to Today"
    />
  )
  const placePicker = (
    <label className="small add-to-place">
      Goes in{' '}
      <select
        value={place}
        onChange={(e) => {
          setNote(null)
          if (e.target.value === 'new') go('group')
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
  )
  const back = (
    <button type="button" className="link small add-back" onClick={() => go('choose')}>
      ‹ Back
    </button>
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal add-to-today" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Add to ${title}`}>
        <div className="row">
          <strong className="grow">{step === 'remove' ? `Take something out of ${title}` : step === 'group' ? 'Make a new group' : `Add to ${title}`}</strong>
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {error && <p className="error small">{error}</p>}
        {note && <p className="small sent-note"><Icon name="check" /> {note}</p>}

        {step === 'choose' && (
          <div className="add-choices">
            <button type="button" className="add-choice" onClick={() => go('find')}>
              <span className="section-icon"><Icon name="pin" /></span>
              <span><strong>Pin something already in Align</strong><span className="muted small">A list, a person, a link, a note, a panel</span></span>
            </button>
            {app.isMember && (
              <button type="button" className="add-choice" onClick={() => go('new')}>
                <span className="section-icon"><Icon name="plus" /></span>
                <span><strong>Add something new</strong><span className="muted small">A new entry in one of your lists, or a new list</span></span>
              </button>
            )}
            <button type="button" className="add-choice" onClick={() => go('group')}>
              <span className="section-icon"><Icon name="folder" /></span>
              <span><strong>Make a new group</strong><span className="muted small">A heading you name, to gather tiles under</span></span>
            </button>
            {removable.length > 0 && (
              <button type="button" className="add-choice" onClick={() => go('remove')}>
                <span className="section-icon"><Icon name="close" /></span>
                <span><strong>Take something out</strong><span className="muted small">{removable.length} in {title} now</span></span>
              </button>
            )}
            <button type="button" className="link small add-everything" onClick={() => go('all')}>
              Show everything on one page
            </button>
          </div>
        )}

        {step === 'find' && (
          <div className="add-step">
            {back}
            {placePicker}
            {search}
            <div className="add-to-today-results">
              {results(browse)}
              {words.length > 0 && !sections.length && <p className="muted small">Nothing matches “{query.trim()}”.</p>}
              {!words.length && !browse && (
                <p className="muted small">
                  Type a few letters of what you want.{' '}
                  <button type="button" className="link small" onClick={() => setBrowse(true)}>
                    Or browse panels and lists
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'new' && (
          <div className="add-step">
            {back}
            {placePicker}
            <h4 className="muted small">A new entry in one of your lists</h4>
            <NewEntry
              onMade={(id, made) => {
                today.save(addTile(today.tiles, tile('entry', id), where)).catch(fail)
                setNote(`Added “${made}” and put it ${whereText}.`)
              }}
              onError={fail}
            />
            <p className="small">
              Or{' '}
              <button type="button" className="link small" onClick={newList}>
                make a new list
              </button>{' '}
              and put it {whereText}.
            </p>
          </div>
        )}

        {step === 'group' && (
          <form className="add-step" onSubmit={makeGroup}>
            {back}
            <p className="muted small">A group is a heading on Today with its own tiles under it (like Fun or Links). Name it; then add things to it.</p>
            <div className="row">
              <input autoFocus value={groupName} maxLength={40} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Kids, School, Call" aria-label="Group name" />
              <button type="submit" className="small" disabled={!groupName.trim()}>
                Make it
              </button>
            </div>
          </form>
        )}

        {step === 'remove' && (
          <div className="add-step">
            {back}
            <p className="muted small">✕ takes it off Today; it stays where it is in Align.</p>
            <div className="add-to-today-results">
              <ul>{removable.map((t) => row(t, removeButton(t)))}</ul>
              {!removable.length && <p className="muted small">Nothing left here.</p>}
            </div>
          </div>
        )}

        {step === 'all' && (
          <div className="add-step">
            {back}
            {placePicker}
            <div className="add-to-today-results">
              {group && (
                <section>
                  <h4 className="muted small">In “{group}” now</h4>
                  {inGroup.length ? <ul>{inGroup.map((t) => row(t, removeButton(t)))}</ul> : <p className="muted small">Nothing yet: add something below.</p>}
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
                    <button type="button" className="secondary small" onClick={() => go('group')}>
                      <Icon name="folder" /> New group
                    </button>
                  </div>
                  {making === 'entry' && (
                    <NewEntry
                      onMade={(id, made) => {
                        today.save(addTile(today.tiles, tile('entry', id), where)).catch(fail)
                        setNote(`Added “${made}” and put it ${whereText}.`)
                      }}
                      onError={fail}
                    />
                  )}
                </section>
              )}
              <section>
                <h4 className="muted small">Find something to pin</h4>
                {search}
              </section>
              {results(true)}
              {words.length > 0 && !sections.length && <p className="muted small">Nothing matches “{query.trim()}”.</p>}
            </div>
          </div>
        )}
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
