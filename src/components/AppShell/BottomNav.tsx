import { useApp } from '../../hooks/useApp'
import type { Route } from '../../utils/routes'

/** Mobile navigation (DESIGN.md §10): Today (the start page), My Tasks, Family, Voting, Chat. */
export function BottomNav({ onChat }: { onChat: () => void }) {
  const { route, navigate, isMember } = useApp()
  const items: { label: string; route: Route }[] = [
    { label: 'Today', route: { view: 'today' } },
    ...(isMember ? [{ label: 'My Tasks', route: { view: 'mine' } as Route }] : []),
    { label: 'Family', route: { view: 'family' } },
    { label: 'Voting', route: { view: 'boards' } },
  ]
  return (
    <nav className="bottom-nav">
      {items.map((i) => (
        <button
          key={i.label}
          type="button"
          className={route.view === i.route.view || (i.route.view === 'boards' && route.view === 'board') ? 'active' : ''}
          onClick={() => navigate(i.route)}
        >
          {i.label}
        </button>
      ))}
      <button type="button" onClick={onChat}>
        Chat
      </button>
    </nav>
  )
}
