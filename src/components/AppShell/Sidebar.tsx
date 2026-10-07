import { useApp, useData } from '../../hooks/useApp'
import type { List } from '../../types'
import type { Route } from '../../utils/routes'

function NavLink({ route, label, color, count }: { route: Route; label: string; color?: string; count?: number }) {
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

export function Sidebar({ open }: { open: boolean }) {
  const { uid, isMember, editList } = useApp()
  const { lists, boards, tasks } = useData()
  const openCount = (l: List) => tasks.filter((t) => t.listId === l.id && t.status !== 'done').length

  const sections: { title: string; lists: List[]; color: string }[] = [
    { title: 'My lists', lists: lists.filter((l) => l.visibility === 'private' && l.kind === 'list' && l.ownerId === uid), color: 'var(--color-private)' },
    { title: 'Family lists', lists: lists.filter((l) => l.visibility === 'family' && l.kind === 'list'), color: 'var(--color-family)' },
    { title: 'Projects', lists: lists.filter((l) => l.kind === 'project'), color: 'var(--color-project)' },
  ]

  return (
    <nav className={`sidebar${open ? ' open' : ''}`}>
      <NavLink route={{ view: 'today' }} label="Today" />
      <NavLink route={{ view: 'home' }} label="Everything" />
      {isMember && <NavLink route={{ view: 'mine' }} label="My tasks" />}
      <NavLink route={{ view: 'family' }} label="Family tasks" />
      <NavLink route={{ view: 'work' }} label="Work" />

      {sections.map((s) => (
        <div key={s.title} className="nav-section">
          <h3>{s.title}</h3>
          {s.lists.map((l) => (
            <NavLink key={l.id} route={{ view: 'list', listId: l.id, timeline: false }} label={l.name} color={s.color} count={openCount(l)} />
          ))}
          {s.lists.length === 0 && <p className="muted small">None yet</p>}
        </div>
      ))}
      {isMember && (
        <button type="button" className="secondary small" onClick={() => editList(null)}>
          + New list or project
        </button>
      )}

      <div className="nav-section">
        <h3>Voting</h3>
        <NavLink route={{ view: 'boards' }} label="All boards" />
        {boards.map((b) => (
          <NavLink key={b.id} route={{ view: 'board', boardId: b.id }} label={b.name} />
        ))}
      </div>
    </nav>
  )
}
