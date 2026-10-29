import { useApp, useData } from '../../hooks/useApp'
import { usePinned } from '../../hooks/usePinned'
import { useStoredChoice } from '../../hooks/useStoredChoice'
import type { List } from '../../types'
import { AUDIENCE_ICON, audienceLabel, audienceOf } from '../../utils/audience'
import { isFinished, isItemList } from '../../utils/tasks'
import { CollectionSection, PinButton } from '../UI/CollectionSection'
import { Icon, type IconName } from '../UI/Icon'

const KIND: Record<List['kind'], { icon: IconName; label: string }> = {
  list: { icon: 'todo', label: 'Tasks' },
  project: { icon: 'chain', label: 'Project' },
  checklist: { icon: 'check', label: 'Checklist' },
  notes: { icon: 'note', label: 'Notes' },
  links: { icon: 'link', label: 'Links' },
  picks: { icon: 'star', label: 'Pick list' },
  cards: { icon: 'book', label: 'Flashcards' },
  contacts: { icon: 'person', label: 'Contacts' },
  gifts: { icon: 'gift', label: 'Gift list' },
}

type Whose = 'all' | 'mine' | 'family' | 'shared'
const WHOSE: { value: Whose; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'family', label: 'Family' },
  { value: 'shared', label: 'Shared' },
]

/** Who a list is for, in the three menu groups it used to be split into. */
const whoseOf = (l: List, uid: string): Whose => (l.visibility === 'private' && l.ownerId === uid ? 'mine' : l.visibility === 'family' ? 'family' : 'shared')

/**
 * A Today section of lists in the shared shape (pinned, search, all): Lists, Projects or Flashcards. Rows show the
 * kind, who sees it and how much is open; cards show the same as tiles. ☆ pins a list to the top (for you, on every
 * device).
 */
function ListCollection({ id, title, icon, kinds, whose = false, help }: { id: string; title: string; icon: IconName; kinds: List['kind'][]; whose?: boolean; help?: Parameters<typeof CollectionSection>[0]['help'] }) {
  const app = useApp()
  const { lists, tasks, listItems } = useData()
  const pins = usePinned()
  const [filter, setFilter] = useStoredChoice<Whose>(`align-today-${id}-whose`, ['all', 'mine', 'family', 'shared'], 'all')
  const visible = lists
    .filter((l) => kinds.includes(l.kind) && !l.giftSecret && (l.visibility !== 'private' || l.ownerId === app.uid))
    .sort((a, b) => a.name.localeCompare(b.name))
  const items = whose && filter !== 'all' ? visible.filter((l) => whoseOf(l, app.uid) === filter) : visible
  const pinned = visible.filter((l) => pins.isPinned(l.id)).sort((a, b) => pins.order(a.id) - pins.order(b.id))
  const open = (l: List) =>
    (isItemList(l) ? listItems : tasks).filter((t) => t.listId === l.id && (l.kind === 'notes' || l.kind === 'links' || l.kind === 'cards' || l.kind === 'contacts' || !isFinished(t))).length
  const go = (l: List) => app.navigate({ view: 'list', listId: l.id, timeline: false })

  const render = (l: List, mode: 'row' | 'card') => {
    const audience = audienceOf(l)
    const n = open(l)
    const unit = l.kind === 'notes' ? 'notes' : l.kind === 'links' ? 'links' : l.kind === 'cards' ? 'cards' : l.kind === 'contacts' ? 'people' : 'open'
    const pin = <PinButton pinned={pins.isPinned(l.id)} onToggle={() => void pins.toggle(l.id)} label={l.name} />
    if (mode === 'card')
      return (
        <div className={`collection-card color-${l.visibility}`}>
          <button type="button" className="collection-card-main" onClick={() => go(l)}>
            <Icon name={KIND[l.kind].icon} />
            <strong>{l.name}</strong>
            <span className="muted small">
              {KIND[l.kind].label} · {n} {unit}
            </span>
            <span className="muted small">
              <Icon name={AUDIENCE_ICON[audience]} /> {audienceLabel(audience)}
            </span>
          </button>
          {pin}
        </div>
      )
    return (
      <div className={`collection-row color-${l.visibility}`}>
        <button type="button" className="collection-row-main" onClick={() => go(l)}>
          <Icon name={KIND[l.kind].icon} />
          <span className="grow">{l.name}</span>
          <span className="muted small" title={audienceLabel(audience)}>
            <Icon name={AUDIENCE_ICON[audience]} label={audienceLabel(audience)} />
          </span>
          <span className="muted small">
            {n} {unit}
          </span>
        </button>
        {pin}
      </div>
    )
  }

  if (!visible.length) return null
  return (
    <CollectionSection
      id={id}
      title={title}
      icon={icon}
      help={help}
      count={visible.length}
      items={items}
      pinned={pinned}
      itemKey={(l) => l.id}
      matches={(l, q) => q.toLowerCase().split(/\s+/).every((w) => l.name.toLowerCase().includes(w) || KIND[l.kind].label.toLowerCase().includes(w))}
      render={render}
      searchHint={`Find a ${title === 'Lists' ? 'list' : title === 'Projects' ? 'project' : 'set'}…`}
      allowCards
      filters={
        whose && (
          <div className="chip-filter small" role="group" aria-label="Whose lists">
            {WHOSE.map((w) => (
              <button key={w.value} type="button" className={`chip-toggle${filter === w.value ? ' on' : ''}`} onClick={() => setFilter(w.value)} aria-pressed={filter === w.value}>
                {w.label}
              </button>
            ))}
          </div>
        )
      }
    />
  )
}

/** Task lists and the other everyday lists (checklists, notes, links, pick lists), with Mine / Family / Shared. */
export const ListsSection = () => <ListCollection id="lists" title="Lists" icon="list" kinds={['list', 'checklist', 'notes', 'links', 'picks']} whose help="tasks" />
export const ProjectsSection = () => <ListCollection id="projects" title="Projects" icon="chain" kinds={['project']} help="projects" />
export const FlashcardsSection = () => <ListCollection id="cards" title="Flashcards" icon="book" kinds={['cards']} help="cards" />
