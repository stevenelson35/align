import { useState, type ReactNode } from 'react'
import { BLOG_URL } from '../../blog/post'
import { useApp, useData } from '../../hooks/useApp'
import { useInbox } from '../../hooks/useInbox'
import { useStoredSet } from '../../hooks/useStoredSet'
import { useTodayTiles } from '../../hooks/useTodayTiles'
import type { List, Task } from '../../types'
import { AUDIENCE_ICON, audienceLabel, audienceOf } from '../../utils/audience'
import { safeUrl } from '../../utils/links'
import { LIST_KIND } from '../../utils/listKinds'
import { menuSectionOf } from '../../utils/menu'
import type { Route } from '../../utils/routes'
import { isFinished, isItemList } from '../../utils/tasks'
import { placeOf, tile, type Tile } from '../../utils/tiles'
import { Icon, type IconName } from '../UI/Icon'

/** The Library's sections of lists, in the menu's order, each with its kind's icon. */
const SECTIONS: { title: string; icon: IconName }[] = [
  { title: 'Lists', icon: 'list' },
  { title: 'Projects', icon: 'chain' },
  { title: 'Checklists', icon: 'check' },
  { title: 'Notes', icon: 'note' },
  { title: 'Links', icon: 'link' },
  { title: 'Pick lists', icon: 'star' },
  { title: 'Flashcards', icon: 'book' },
  { title: 'Contacts', icon: 'person' },
  { title: 'Gifts', icon: 'gift' },
]

/** "On Today", "On Today · Kids", "In More…" (or nothing): where a tile sits on your Today. */
function whereText(tiles: Tile[], t: Tile): string | null {
  const p = placeOf(tiles, t)
  if (!p) return null
  return `${p.more ? 'In More…' : 'On Today'}${p.group ? ` · ${p.group}` : ''}`
}

/**
 * The Library (☰ on a phone): everything in Align as a page. Pages as tiles, then every list by kind in cards you
 * open (several at once, remembered on this device); each list shows what it is, how much is in it, who sees it, and
 * whether it's on your Today (📌 pins or unpins it). The find box filters everything and opens what matches.
 */
export function LibraryView() {
  const app = useApp()
  const { lists, boards, tasks, listItems } = useData()
  const { unread } = useInbox()
  const today = useTodayTiles()
  const [filter, setFilter] = useState('')
  const [open, toggleOpen] = useStoredSet('align-library-open')
  const [error, setError] = useState<string | null>(null)
  const words = filter.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const hit = (...text: string[]) => words.every((w) => text.join(' ').toLowerCase().includes(w))
  const finding = words.length > 0

  const pages: { label: string; icon: IconName; route?: Route; onClick?: () => void; badge?: number; tile?: Tile; members?: boolean }[] = [
    { label: 'Today', icon: 'sun', route: { view: 'today' } },
    { label: 'Inbox', icon: 'mail', route: { view: 'inbox' }, badge: unread, tile: 'panel:inbox' },
    { label: 'Tasks', icon: 'todo', route: { view: 'home' } },
    { label: 'Goals', icon: 'goal', route: { view: 'goals' }, tile: 'panel:goals' },
    { label: 'Games', icon: 'sparkle', route: { view: 'games' }, tile: 'panel:games', members: true },
    { label: 'Family map', icon: 'map', route: { view: 'map' }, tile: 'panel:map', members: true },
    { label: 'Photos', icon: 'photo', route: { view: 'photos' } },
    { label: 'Voting boards', icon: 'star', route: { view: 'boards' }, tile: 'panel:voting' },
    { label: 'New blog post', icon: 'compose', route: { view: 'blog' }, members: true },
    { label: 'Wall display', icon: 'calendar', route: { view: 'wall' } },
    { label: 'Help & about', icon: 'help', route: { view: 'help' } },
    { label: 'Settings', icon: 'settings', onClick: app.openSettings },
  ]
  const shownPages = pages.filter((p) => (!p.members || app.isMember) && (!finding || hit(p.label)))
  const links = (app.member.pinnedLinks ?? []).map((id) => listItems.find((t) => t.id === id)).filter((t): t is Task => !!t && !!safeUrl(t.url))
  const shownLinks = [{ id: 'blog', title: "Travelin' On blog", url: BLOG_URL }, ...links.map((t) => ({ id: t.id, title: t.title, url: safeUrl(t.url)! }))].filter((l) => !finding || hit(l.title))

  const inSection = (title: string) =>
    lists
      .filter((l) => menuSectionOf(l) === title && !l.giftSecret && (l.visibility !== 'private' || l.ownerId === app.uid) && (!finding || hit(l.name, title)))
      .sort((a, b) => a.name.localeCompare(b.name))
  const count = (l: List) => (isItemList(l) ? listItems : tasks).filter((t) => t.listId === l.id && (l.kind === 'notes' || l.kind === 'links' || l.kind === 'contacts' || l.kind === 'cards' || !isFinished(t))).length
  const unit = (l: List) => (l.kind === 'notes' ? 'notes' : l.kind === 'links' ? 'links' : l.kind === 'cards' ? 'cards' : l.kind === 'contacts' ? 'people' : l.kind === 'gifts' ? 'ideas' : 'open')
  const shownBoards = boards.filter((b) => !finding || hit(b.name, 'voting'))

  const pin = (t: Tile, name: string) => {
    if (!today.canChange) return null
    const on = today.has(t)
    return (
      <button
        type="button"
        className={`library-pin${on ? ' on' : ''}`}
        aria-pressed={on}
        onClick={() => {
          setError(null)
          today.toggle(t).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
        }}
        aria-label={on ? `Take ${name} off Today` : `Pin ${name} to Today`}
        title={on ? 'On your Today: tap to take it off' : 'Pin to Today'}
      >
        <Icon name="pin" />
      </button>
    )
  }

  const section = (key: string, title: string, icon: IconName, n: number, body: ReactNode) => {
    const isOpen = finding || open.has(key)
    return (
      <section key={key} className={`library-section${isOpen ? ' open' : ''}`} data-section={title}>
        <button type="button" className="library-section-head" onClick={() => toggleOpen(key)} aria-expanded={isOpen}>
          <span className="section-icon">
            <Icon name={icon} />
          </span>
          <span className="library-section-title">{title}</span>
          <span className="section-count">{n}</span>
          <span className="grow" />
          <span className="library-caret" aria-hidden="true">
            {isOpen ? '▾' : '▸'}
          </span>
        </button>
        {isOpen && <div className="library-section-body">{body}</div>}
      </section>
    )
  }

  const sections = SECTIONS.map((s) => ({ ...s, lists: inSection(s.title) })).filter((s) => !finding || s.lists.length)

  return (
    <section className="library">
      <header className="view-header">
        <h2>Library</h2>
        <span className="grow" />
        {app.isMember && (
          <button type="button" className="secondary small" onClick={() => app.editList(null)}>
            <Icon name="plus" /> New list
          </button>
        )}
      </header>
      <input type="search" className="library-find" placeholder="Find a list, page or board…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Find in the Library" />
      {error && <p className="error small">{error}</p>}

      {shownPages.length > 0 && (
        <div className="library-pages">
          {shownPages.map((p) => {
            const where = p.tile && whereText(today.tiles, p.tile)
            return (
              <button key={p.label} type="button" className="library-page" onClick={() => (p.route ? app.navigate(p.route) : p.onClick?.())}>
                <span className="section-icon">
                  <Icon name={p.icon} />
                </span>
                <span className="library-page-text">
                  <span className="library-page-label">
                    {p.label}
                    {!!p.badge && <span className="library-badge">{p.badge}</span>}
                  </span>
                  {where && <span className="library-where small">{where}</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}
      {shownLinks.length > 0 && (
        <div className="library-links" aria-label="Your links">
          {shownLinks.map((l) => (
            <a key={l.id} className="library-link" href={l.url} target="_blank" rel="noopener noreferrer" title={l.url}>
              <Icon name={l.id === 'blog' ? 'blog' : 'link'} /> {l.title} <Icon name="external" />
            </a>
          ))}
        </div>
      )}

      {sections.map((s) =>
        section(
          s.title,
          s.title,
          s.icon,
          s.lists.length,
          s.lists.length ? (
            <ul className="library-rows">
              {s.lists.map((l) => {
                const audience = audienceOf(l)
                const where = whereText(today.tiles, tile('list', l.id))
                return (
                  <li key={l.id} className={`library-row color-${l.visibility}`}>
                    <button type="button" className="library-row-main" onClick={() => app.navigate({ view: 'list', listId: l.id, timeline: false })}>
                      <Icon name={LIST_KIND[l.kind].icon} />
                      <span className="library-row-text">
                        <span className="library-row-name">{l.name}</span>
                        <span className="muted small">
                          {count(l)} {unit(l)} · <Icon name={AUDIENCE_ICON[audience]} /> {audienceLabel(audience)}
                          {where && <span className="library-where"> · {where}</span>}
                        </span>
                      </span>
                    </button>
                    {pin(tile('list', l.id), l.name)}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="muted small">None yet.</p>
          ),
        ),
      )}
      {(!finding || shownBoards.length > 0) &&
        section(
          'Voting',
          'Voting',
          'star',
          boards.length,
          <ul className="library-rows">
            <li className="library-row">
              <button type="button" className="library-row-main" onClick={() => app.navigate({ view: 'boards' })}>
                <Icon name="star" />
                <span className="library-row-text">
                  <span className="library-row-name">All boards</span>
                </span>
              </button>
            </li>
            {shownBoards.map((b) => (
              <li key={b.id} className="library-row">
                <button type="button" className="library-row-main" onClick={() => app.navigate({ view: 'board', boardId: b.id })}>
                  <Icon name="star" />
                  <span className="library-row-text">
                    <span className="library-row-name">{b.name}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>,
        )}
      {finding && !shownPages.length && !shownLinks.length && !sections.length && !shownBoards.length && <p className="muted small">Nothing matches “{filter.trim()}”.</p>}
      {finding && <p className="muted small">Looking for an entry inside a list? Use search (top bar).</p>}
    </section>
  )
}
