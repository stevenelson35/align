import { useState, type ReactNode } from 'react'
import { useApp, useData } from '../../hooks/useApp'
import type { List, Task } from '../../types'
import { safeUrl } from '../../utils/links'
import type { Route } from '../../utils/routes'
import { AUDIENCE_ICON, audienceLabel, audienceOf } from '../../utils/audience'
import { goalGroups } from '../../utils/goals'
import { BLOG_URL } from '../../blog/post'
import { isFinished, isItemList } from '../../utils/tasks'
import { Icon } from '../UI/Icon'

function NavLink({ route, label, color, count }: { route: Route; label: ReactNode; color?: string; count?: number }) {
  const app = useApp()
  const active = JSON.stringify({ ...app.route, timeline: undefined }) === JSON.stringify({ ...route, timeline: undefined })
  return (
    <button type="button" className={`nav-link${active ? ' active' : ''}`} onClick={() => app.navigate(route)}>
      {color && <span className="dot" style={{ background: color }} />}
      <span className="grow">{label}</span>
      {count !== undefined && count > 0 && <span className="muted small">{count}</span>}
    </button>
  )
}

const OPEN_KEY = 'align-menu-open'

/**
 * A collapsible menu section. One is open at a time (opening one closes the others), and the open one is
 * remembered on this device. A collapsed heading is highlighted when the page you're on is inside it.
 */
function Section({ title, count, active, isOpen, onToggle, children }: { title: string; count: number; active: boolean; isOpen: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className={`nav-section${isOpen ? ' open' : ''}`}>
      <button type="button" className={`nav-heading${active && !isOpen ? ' has-active' : ''}`} onClick={onToggle} aria-expanded={isOpen}>
        <span className="caret">{isOpen ? '▾' : '▸'}</span>
        <span className="grow">{title}</span>
        {count > 0 && <span className="muted small">{count}</span>}
      </button>
      {isOpen && children}
    </div>
  )
}

export function Sidebar({ open, onSettings }: { open: boolean; onSettings: () => void }) {
  const { uid, member, household, isMember, editList, route } = useApp()
  const [openSection, setOpenSection] = useState<string | null>(() => localStorage.getItem(OPEN_KEY))
  const toggle = (title: string) => {
    const next = openSection === title ? null : title
    if (next) localStorage.setItem(OPEN_KEY, next)
    else localStorage.removeItem(OPEN_KEY)
    setOpenSection(next)
  }
  const activeListId = route.view === 'list' ? route.listId : null
  const { lists, boards, tasks, listItems, goals } = useData()
  const groups = goalGroups(goals, uid, member.role, household)
  // Your pinned links (Pin to my menu), in the order you pinned them; ones you can no longer see drop out.
  const pinned = (member.pinnedLinks ?? []).map((id) => listItems.find((t) => t.id === id)).filter((t): t is Task => !!t && !!safeUrl(t.url))
  // Unfinished tasks or unchecked items; for notes, how many there are.
  const openCount = (l: List) =>
    (isItemList(l) ? listItems : tasks).filter((t) => t.listId === l.id && (l.kind === 'notes' || l.kind === 'links' || !isFinished(t))).length
  const color = (l: List) => `var(--color-${l.visibility})`

  const sections: { title: string; lists: List[]; color: string }[] = [
    { title: 'My lists', lists: lists.filter((l) => l.visibility === 'private' && l.kind === 'list' && l.ownerId === uid), color: 'var(--color-private)' },
    { title: 'Family lists', lists: lists.filter((l) => l.visibility === 'family' && l.kind === 'list'), color: 'var(--color-family)' },
    { title: 'Shared lists', lists: lists.filter((l) => l.visibility === 'shared' && l.kind === 'list'), color: 'var(--color-shared)' },
    { title: 'Projects', lists: lists.filter((l) => l.kind === 'project'), color: 'var(--color-project)' },
    { title: 'Checklists', lists: lists.filter((l) => l.kind === 'checklist'), color: '' },
    { title: 'Notes', lists: lists.filter((l) => l.kind === 'notes'), color: '' },
    { title: 'Links', lists: lists.filter((l) => l.kind === 'links'), color: '' },
    { title: 'Pick lists', lists: lists.filter((l) => l.kind === 'picks'), color: '' },
  ]

  return (
    <nav className={`sidebar${open ? ' open' : ''}`}>
      <NavLink route={{ view: 'today' }} label="Today" />
      <NavLink route={{ view: 'home' }} label="Everything" />
      {isMember && <NavLink route={{ view: 'mine' }} label="My tasks" />}
      <NavLink route={{ view: 'family' }} label="Family tasks" />
      <NavLink route={{ view: 'work' }} label="Work" />
      {isMember && <NavLink route={{ view: 'blog' }} label={<><Icon name="compose" /> New blog post</>} />}
      <NavLink route={{ view: 'photos' }} label={<><Icon name="photo" /> Photos</>} />
      <a className="nav-link" href={BLOG_URL} target="_blank" rel="noopener noreferrer">
        <span className="grow">
          <Icon name="blog" /> Travelin' On blog
        </span>
        <Icon name="external" label="opens blog.itsallonesong.com" />
      </a>
      {pinned.map((t) => (
        <a key={t.id} className="nav-link pinned-link" href={safeUrl(t.url)!} target="_blank" rel="noopener noreferrer" title={t.url}>
          <span className="grow">
            <Icon name="link" /> {t.title}
          </span>
          <Icon name="external" label="opens in a new tab" />
        </a>
      ))}

      <Section
        title="Goals"
        count={groups.reduce((n, g) => n + g.goals.length, 0)}
        active={route.view === 'goals' || route.view === 'goal'}
        isOpen={openSection === 'Goals'}
        onToggle={() => toggle('Goals')}
      >
        <NavLink route={{ view: 'goals' }} label={<><Icon name="goal" /> All goals</>} />
        {groups.map((g) => (
          <div key={g.key} className="nav-group">
            <p className="nav-group-title muted small">{g.title}</p>
            {g.goals.map((goal) => (
              <NavLink key={goal.id} route={{ view: 'goal', goalId: goal.id }} label={goal.name} />
            ))}
          </div>
        ))}
      </Section>

      {sections.map((s) => (
        <Section
          key={s.title}
          title={s.title}
          count={s.lists.length}
          active={s.lists.some((l) => l.id === activeListId)}
          isOpen={openSection === s.title}
          onToggle={() => toggle(s.title)}
        >
          {s.lists.map((l) => (
            <NavLink
              key={l.id}
              route={{ view: 'list', listId: l.id, timeline: false }}
              label={l.visibility === 'family' ? l.name : <>{l.name} <Icon name={AUDIENCE_ICON[audienceOf(l)]} label={audienceLabel(audienceOf(l))} /></>}
              color={s.color || color(l)}
              count={openCount(l)}
            />
          ))}
          {s.lists.length === 0 && <p className="muted small">None yet</p>}
        </Section>
      ))}
      {isMember && (
        <button type="button" className="secondary small" onClick={() => editList(null)}>
          + New list
        </button>
      )}

      <Section
        title="Voting"
        count={boards.length}
        active={route.view === 'boards' || route.view === 'board'}
        isOpen={openSection === 'Voting'}
        onToggle={() => toggle('Voting')}
      >
        <NavLink route={{ view: 'boards' }} label="All boards" />
        {boards.map((b) => (
          <NavLink key={b.id} route={{ view: 'board', boardId: b.id }} label={b.name} />
        ))}
      </Section>
      <div className="nav-section">
        <button type="button" className="nav-link" onClick={onSettings}>
          <Icon name="settings" /> Settings
        </button>
        <NavLink route={{ view: 'help' }} label={<><Icon name="help" /> Help & about</>} />
      </div>
    </nav>
  )
}
