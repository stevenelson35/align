import { useApp, useData } from '../../hooks/useApp'
import type { Board } from '../../types'
import { CollectionSection, PinButton } from '../UI/CollectionSection'
import { Icon } from '../UI/Icon'
import { usePinned } from '../../hooks/usePinned'
import { useState } from 'react'

/**
 * Voting on Today (in More… to start): the family's boards, each opening on a tap; + opens the Voting page to make a
 * new one (or start with the suggested boards).
 */
export function VotingSection() {
  const app = useApp()
  const { boards, items } = useData()
  const pins = usePinned()
  const [error, setError] = useState<string | null>(null)
  const open = (b: Board) => items.filter((i) => i.boardId === b.id && i.status === 'open').length
  const sorted = [...boards].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <CollectionSection<Board>
      id="voting"
      title="Voting"
      icon="star"
      help="voting"
      count={boards.length}
      actions={
        <button type="button" className="link small" onClick={() => app.navigate({ view: 'boards' })}>
          All boards
        </button>
      }
      items={sorted}
      pinned={sorted.filter((b) => pins.isPinned(b.id)).sort((a, b) => pins.order(a.id) - pins.order(b.id))}
      itemKey={(b) => b.id}
      matches={(b, q) => b.name.toLowerCase().includes(q.toLowerCase())}
      render={(b) => (
        <div className="collection-row">
          <button type="button" className="collection-row-main" onClick={() => app.navigate({ view: 'board', boardId: b.id })}>
            <Icon name="star" />
            <span className="grow">{b.name}</span>
            <span className="muted small">{open(b)} open</span>
          </button>
          <PinButton pinned={pins.isPinned(b.id)} onToggle={() => {
            setError(null)
            void pins.toggle(b.id).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
          }} label={b.name} />
        </div>
      )}
      filters={error && <p className="error small">{error}</p>}
      searchHint="Find a board…"
      empty={<p className="muted small">No voting boards yet. + makes one, or start with the suggested boards (Movies & Shows, Restaurants & Meals, Weekend Activities, Travel Plans).</p>}
      onAdd={app.isMember ? () => app.navigate({ view: 'boards' }) : undefined}
      addTitle="New voting board"
    />
  )
}
