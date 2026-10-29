import { useState } from 'react'
import { useApp, useData } from '../../hooks/useApp'
import { AddItemDialog } from './AddItemDialog'
import { usePinned } from '../../hooks/usePinned'
import { useStoredChoice } from '../../hooks/useStoredChoice'
import type { List, Task } from '../../types'
import { defaultName, safeUrl } from '../../utils/links'
import { AUDIENCE_ICON, audienceLabel, audienceOf } from '../../utils/audience'
import { isFinished, isItemList } from '../../utils/tasks'
import { CollectionSection, PinButton } from '../UI/CollectionSection'
import { WhoseChips } from '../UI/WhoseChips'
import { WHOSE_VALUES, whoseMatches, type Whose } from '../../utils/whose'
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


/**
 * A Today section of lists in the shared shape (pinned, search, all): Lists, Projects or Flashcards. Rows show the
 * kind, who sees it and how much is open; cards show the same as tiles. ☆ pins a list to the top (for you, on every
 * device).
 */
function ListCollection({ id, title, icon, kinds, whose = false, help, addKind, addTitle }: { id: string; title: string; icon: IconName; kinds: List['kind'][]; whose?: boolean; help?: Parameters<typeof CollectionSection>[0]['help']; /** What + Add makes. */ addKind: List['kind']; addTitle: string }) {
  const app = useApp()
  const { lists, tasks, listItems } = useData()
  const pins = usePinned()
  const [filter, setFilter] = useStoredChoice<Whose>(`align-today-${id}-whose`, WHOSE_VALUES, 'all')
  const visible = lists
    .filter((l) => kinds.includes(l.kind) && !l.giftSecret && (l.visibility !== 'private' || l.ownerId === app.uid))
    .sort((a, b) => a.name.localeCompare(b.name))
  const items = whose ? visible.filter((l) => whoseMatches(l, filter, app.uid)) : visible
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

  if (!visible.length && !app.isMember) return null
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
      onAdd={app.isMember ? () => app.editList(null, addKind) : undefined}
      addTitle={addTitle}
      filters={whose && <WhoseChips value={filter} onChange={setFilter} label="Whose lists" />}
    />
  )
}

/** Task lists and the other everyday lists (checklists, notes, links, pick lists), with Mine / Family / Shared. */
export const ListsSection = () => (
  <ListCollection id="lists" title="Lists" icon="list" kinds={['list', 'checklist', 'notes', 'links', 'picks']} whose help="tasks" addKind="list" addTitle="New list (task list, checklist, notes…)" />
)
export const ProjectsSection = () => <ListCollection id="projects" title="Projects" icon="chain" kinds={['project']} help="projects" addKind="project" addTitle="New project" />
export const FlashcardsSection = () => <ListCollection id="cards" title="Flashcards" icon="book" kinds={['cards']} help="cards" addKind="cards" addTitle="New set of flashcards" />

/**
 * Links (bookmarks) on Today, in the shared shape: your pinned links, search (name, address, category), then every
 * link, by category. A link opens in a new tab; ⓘ shows its details; ☆ pins it.
 */
export function LinksSection() {
  const app = useApp()
  const { lists, listItems } = useData()
  const pins = usePinned()
  const [adding, setAdding] = useState(false)
  const linkLists = new Map(lists.filter((l) => l.kind === 'links' && (l.visibility !== 'private' || l.ownerId === app.uid)).map((l) => [l.id, l]))
  const links = listItems
    .filter((t) => linkLists.has(t.listId) && safeUrl(t.url))
    .sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.title.localeCompare(b.title))
  if (!linkLists.size) return null
  const pinned = links.filter((t) => pins.isPinned(t.id)).sort((a, b) => pins.order(a.id) - pins.order(b.id))
  const sub = (t: Task) => [t.category, linkLists.get(t.listId)?.name].filter(Boolean).join(' · ')

  const render = (t: Task, mode: 'row' | 'card') => {
    const href = safeUrl(t.url)!
    const pin = <PinButton pinned={pins.isPinned(t.id)} onToggle={() => void pins.toggle(t.id)} label={t.title} />
    const info = (
      <button type="button" className="link small" onClick={() => app.selectTask(t.id)} title="Details" aria-label={`Details for ${t.title}`}>
        <Icon name="help" />
      </button>
    )
    if (mode === 'card')
      return (
        <div className="collection-card">
          <a className="collection-card-main" href={href} target="_blank" rel="noopener noreferrer">
            <Icon name="link" />
            <strong>{t.title}</strong>
            <span className="muted small">{sub(t) || defaultName(href)}</span>
          </a>
          {info}
          {pin}
        </div>
      )
    return (
      <div className="collection-row">
        <a className="collection-row-main" href={href} target="_blank" rel="noopener noreferrer" title={href}>
          <Icon name="link" />
          <span className="grow collection-row-text">
            {t.title}
            {sub(t) && <span className="muted small">{sub(t)}</span>}
          </span>
          <Icon name="external" />
        </a>
        {info}
        {pin}
      </div>
    )
  }

  return (
    <>
    <CollectionSection<Task>
      id="links"
      title="Links"
      icon="link"
      help="links"
      count={links.length}
      items={links}
      pinned={pinned}
      itemKey={(t) => t.id}
      matches={(t, q) => {
        const hay = [t.title, t.url, t.category, linkLists.get(t.listId)?.name].filter(Boolean).join(' ').toLowerCase()
        return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))
      }}
      render={render}
      searchHint="Find a link (name, address, category)…"
      allowCards
      onAdd={app.isMember ? () => setAdding(true) : undefined}
      addTitle="Add a link"
    />
    {adding && <AddItemDialog kind="links" onClose={() => setAdding(false)} />}
    </>
  )
}
