import { useEffect, useState, type FormEvent } from 'react'
import { addTaskNow, updateTask, withStatus } from '../../firebase/db'
import { getDailyWordlePreview, type DailyWordlePreview } from '../../firebase/wordle'
import { gameById } from '../../games/catalog'
import type { DailyItem } from '../../daily/settings'
import { useApp, useData } from '../../hooks/useApp'
import { useEntrySize } from '../../hooks/useEntrySize'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { useTodayExpansion } from '../../hooks/useTodaySection'
import type { List, Task } from '../../types'
import type { EntrySize } from '../../utils/entries'
import { safeUrl } from '../../utils/links'
import { LIST_KIND } from '../../utils/listKinds'
import { splitTitleNote } from '../../utils/quickAdd'
import { isFinished, isItemList, sortTasks } from '../../utils/tasks'
import { parseTile, type Tile } from '../../utils/tiles'
import type { TodaySection } from '../../utils/today'
import { PersonRow } from '../Contacts/ContactsView'
import { TheDaily } from '../Daily/TheDaily'
import { EntryRow } from '../Entries/EntryRow'
import { GamesTodaySection } from '../Games/GamesTodaySection'
import { GiftsStrip } from '../Gifts/GiftsStrip'
import { GoalsStrip } from '../Goals/GoalsStrip'
import { InvestingSection } from '../Investing/InvestingSection'
import { FlashcardsSection, LinksSection, ListsSection, ProjectsSection } from '../Lists/ListSections'
import { ContactsStrip } from '../Contacts/ContactsStrip'
import { FamilyMapStrip, PersonLocationTile } from '../Map/FamilyMapStrip'
import { OnThisDay } from '../Photos/OnThisDay'
import { RewardsStrip } from '../Rewards/RewardsStrip'
import { TaskCard } from '../Tasks/TaskCard'
import { TodoPanel } from '../Tasks/TodoPanel'
import { Icon, type IconName } from '../UI/Icon'
import { memberForContact } from '../../utils/contacts'
import { useMemberLocation } from '../../hooks/useMemberLocation'
import { useFamilyOnMap } from '../../hooks/useFamilyOnMap'
import { ItemIcon } from '../UI/ItemIcon'
import { SectionHeader } from '../UI/SectionHeader'
import { InboxPanel } from '../Inbox/InboxPanel'
import { VotingSection } from '../Voting/VotingSection'

/** One Today tile (utils/tiles.ts). Something no longer here shows nothing (Arrange lists it, to remove). */
export function TileView({ tile, day }: { tile: Tile; day: string }) {
  const { kind, id } = parseTile(tile)
  switch (kind) {
    case 'panel':
      return <PanelTile id={id} day={day} />
    case 'list':
      return <ListTile listId={id} />
    case 'entry':
      return <EntryTile id={id} />
    case 'person':
      return <PersonLocationTile uid={id} />
    case 'game':
      return <GameTodayTile id={id} />
    case 'daily':
      return <TheDaily day={day} only={id as DailyItem} />
    default:
      return null
  }
}

function PanelTile({ id, day }: { id: string; day: string }) {
  switch (id as TodaySection | 'todo') {
    case 'todo':
      return <TodoPanel day={day} />
    case 'inbox':
      return <InboxPanel />
    case 'goals':
      return <GoalsStrip day={day} />
    case 'rewards':
      return <RewardsStrip />
    case 'games':
      return <GamesTodaySection />
    case 'map':
      return <FamilyMapStrip />
    case 'contacts':
      return <ContactsStrip />
    case 'gifts':
      return <GiftsStrip />
    case 'lists':
      return <ListsSection />
    case 'links':
      return <LinksSection />
    case 'projects':
      return <ProjectsSection />
    case 'cards':
      return <FlashcardsSection />
    case 'photos':
      return <OnThisDay day={day} />
    case 'daily':
      return <TheDaily day={day} />
    case 'voting':
      return <VotingSection />
    case 'invest':
      return <InvestingSection />
    default:
      return null
  }
}

/** When it was added (to the nanosecond); one still being saved is newest. */
const added = (t: Task) => (t.createdAt ? t.createdAt.seconds + t.createdAt.nanoseconds / 1e9 : Infinity)

/** What a list tile shows first: what's left to do (tasks, checklists), else everything, in the list's own order. */
function tileEntries(list: List, all: Task[]): Task[] {
  const mine = all.filter((t) => t.listId === list.id)
  if (list.kind === 'list' || list.kind === 'project') return sortTasks(mine.filter((t) => !isFinished(t)), 'date')
  if (list.kind === 'checklist') return mine.filter((t) => t.status !== 'done').sort((a, b) => added(a) - added(b))
  if (list.kind === 'links') return mine.sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.title.localeCompare(b.title))
  return mine.sort((a, b) => a.title.localeCompare(b.title))
}

/** How many rows a list tile shows before "Show all". */
const LIST_TILE_ROWS = 8

/** A whole list on Today: its open entries (the list's own row size), a quick add, and Open for the full list. */
function ListTile({ listId }: { listId: string }) {
  const app = useApp()
  const { lists, tasks, listItems } = useData()
  const list = lists.find((l) => l.id === listId)
  const [open, saveOpen] = useStoredFlag(`align-tile-open:list:${listId}`, true)
  const setOpen = useTodayExpansion(open, saveOpen)
  const [all, setAll] = useState(false)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!list) return null
  const entries = tileEntries(list, isItemList(list) ? listItems : tasks)
  const shown = all ? entries : entries.slice(0, LIST_TILE_ROWS)
  const editable = app.canEdit(list)
  const canAdd = editable && list.kind !== 'contacts' && list.kind !== 'cards' && list.kind !== 'gifts'

  function add(e: FormEvent) {
    e.preventDefault()
    const text = title.trim()
    if (!text || !list) return
    setError(null)
    setTitle('')
    addTaskNow(list, { ...splitTitleNote(text), priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [] }, app.uid).written.catch((err) => {
      setError(err instanceof Error ? err.message : String(err))
      setTitle(text)
    })
  }

  return (
    <div className="day-section tile-list">
      <SectionHeader icon={LIST_KIND[list.kind].icon} title={list.name} count={entries.length} onTitleClick={() => setOpen(!open)} expanded={open}>
        {canAdd && (
          <button type="button" className="link small header-add" onClick={() => { if (!open) setOpen(true); setAdding(!adding) }} aria-expanded={adding} title={`Add to ${list.name}`} aria-label={`Add to ${list.name}`}>
            <Icon name="plus" />
          </button>
        )}
        <button type="button" className="link small" onClick={() => app.navigate({ view: 'list', listId: list.id, timeline: false })}>
          Open
        </button>
      </SectionHeader>
      {open && adding && (
        <form className="row add-task" onSubmit={add}>
          <input autoFocus placeholder={`Add to ${list.name}… (title: note)`} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setAdding(false)} aria-label={`New entry in ${list.name}`} />
          <button type="submit" className="icon-button" aria-label="Add" title="Add" disabled={!title.trim()}>
            <Icon name="plus" />
          </button>
        </form>
      )}
      {error && <p className="error small">{error}</p>}
      {open && (
        <>
          <ul className="entry-list">
            {shown.map((t) => (
              <TileEntry key={t.id} entry={t} list={list} />
            ))}
          </ul>
          {!entries.length && <p className="muted small">{list.kind === 'list' || list.kind === 'project' || list.kind === 'checklist' ? 'Nothing left to do.' : 'Nothing here yet.'}</p>}
          {entries.length > LIST_TILE_ROWS && (
            <button type="button" className="link small" onClick={() => setAll(!all)}>
              {all ? 'Show fewer' : `Show all ${entries.length}`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/** One entry on Today, as its own list shows it (sized by that list, at most medium): a task, a checklist item, a person, a link. */
function TileEntry({ entry, list, size: forced, flat = false }: { entry: Task; list?: List; size?: EntrySize; /** One line, the kind's icon, no border (an entry pinned on its own). */ flat?: boolean }) {
  const app = useApp()
  const [listSize] = useEntrySize(list ?? { id: '', kind: 'list' })
  // Today stays a glance: a list shown in full detail (notes) is medium here; tapping a row still opens it in place.
  const size = forced ?? (listSize === 'detail' ? 'medium' : listSize)
  if (!list || list.kind === 'list' || list.kind === 'project')
    return (
      <li className="tile-task">
        <TaskCard task={entry} size={size} />
      </li>
    )
  if (list.kind === 'contacts' || entry.contact) return <PersonRow person={entry} size={size} />
  const flatLook = flat ? { className: 'flat', lead: tileIcon(LIST_KIND[list.kind].icon) } : {}
  const href = list.kind === 'links' ? safeUrl(entry.url) : null
  if (href)
    return (
      <EntryRow
        entry={entry}
        size={size}
        {...flatLook}
        title={
          <a href={href} target="_blank" rel="noopener noreferrer" className="entry-title link-name">
            <ItemIcon value={entry.customIcon} /> <span className="entry-title-text">{entry.title}</span> <Icon name="external" />
          </a>
        }
      />
    )
  if (list.kind === 'checklist')
    return (
      <EntryRow
        entry={entry}
        size={size}
        className={`${entry.status === 'done' ? 'checked' : ''}${flat ? ' flat' : ''}`}
        check={{
          checked: entry.status === 'done',
          disabled: !app.canEdit(entry),
          label: `Check off ${entry.title}`,
          onChange: (on) => void updateTask(entry.id, withStatus(entry, on ? 'done' : 'todo')),
        }}
      />
    )
  return <EntryRow entry={entry} size={size} {...flatLook} />
}

/**
 * One entry pinned to Today, as one line like the panels' headings: the kind's icon in the same tinted square, the
 * title, its quick buttons, no border (a person: call / text / email, and where they are if they're in the family;
 * a link: opens the site). Tap the title to open it in place. Tasks keep their task card.
 */
function EntryTile({ id }: { id: string }) {
  const { lists, tasks, listItems } = useData()
  const entry = listItems.find((t) => t.id === id) ?? tasks.find((t) => t.id === id)
  if (!entry) return null
  const list = lists.find((l) => l.id === entry.listId)
  return (
    <ul className="entry-list tile-entry">
      {list && (list.kind === 'contacts' || entry.contact) ? <PersonTile person={entry} /> : <TileEntry entry={entry} list={list} size="simple" flat />}
    </ul>
  )
}

const tileIcon = (name: IconName) => (
  <span className="section-icon" aria-hidden="true">
    <Icon name={name} />
  </span>
)

/** A person on Today: one line; if they're in the family (and you're a member), where they are, more when opened. */
function PersonTile({ person }: { person: Task }) {
  const app = useApp()
  const uid = app.isMember ? memberForContact(person, app.household.members) : null
  if (uid) return <FamilyPersonTile person={person} uid={uid} />
  return <PersonRow person={person} size="simple" lead={tileIcon('person')} className="flat" />
}

/**
 * A family member pinned to Today: one line, their location shortened to fit ("at Ho…"). Tapping the name opens the
 * whole contact in place, like any row; tapping the location shows the full location line under it (Show opens the
 * map); 🗺 opens the map on them.
 */
function FamilyPersonTile({ person, uid }: { person: Task; uid: string }) {
  const where = useMemberLocation(uid)
  const onMap = useFamilyOnMap()
  const [peek, setPeek] = useState(false)
  return (
    <PersonRow
      person={person}
      size="simple"
      lead={tileIcon('person')}
      className="flat"
      mapUid={onMap(person)}
      aside={
        <button type="button" className="entry-aside-button" onClick={() => setPeek(!peek)} aria-expanded={peek} title={peek ? 'Hide the location' : `Where ${person.title} is: tap for more`}>
          {where}
        </button>
      }
      below={peek && <div className="tile-person-peek"><PersonLocationTile uid={uid} /></div>}
      extra={!peek && <PersonLocationTile uid={uid} />}
    />
  )
}

/** A game on Today; Wordle shows whether you've done today's. */
function GameTodayTile({ id }: { id: string }) {
  const app = useApp()
  const game = gameById(id)
  const [daily, setDaily] = useState<DailyWordlePreview | null>(null)
  useEffect(() => {
    if (id !== 'wordle' || !app.isMember) return
    let live = true
    getDailyWordlePreview()
      .then((p) => live && setDaily(p))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [id, app.isMember])
  if (!game) return null
  const status = id !== 'wordle' ? game.description : !daily ? '' : daily.complete ? (daily.solved ? `Solved in ${daily.guessCount}` : 'Not solved today') : daily.guessCount ? `${daily.guessCount} guesses so far` : 'Not played yet'
  return (
    <div className="day-section tile-game">
      <div className="collection-row">
        <button type="button" className="collection-row-main" onClick={() => app.navigate({ view: 'games', gameId: id })}>
          <Icon name="sparkle" />
          <span className="grow">
            <strong>{id === 'wordle' ? 'Wordle of the day' : game.name}</strong> <span className="muted small">{status}</span>
          </span>
        </button>
        <button type="button" className="secondary small" onClick={() => app.navigate({ view: 'games', gameId: id })}>
          <Icon name="play" /> {daily?.complete ? 'See it' : 'Play'}
        </button>
      </div>
    </div>
  )
}
