import { useState } from 'react'
import { setPinnedGames } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { useTodayExpansion } from '../../hooks/useTodaySection'
import { DEFAULT_PINNED_GAMES, GAMES } from '../../games/catalog'
import { CollectionContents, PinButton } from '../UI/CollectionSection'
import { Icon } from '../UI/Icon'
import { SectionHeader } from '../UI/SectionHeader'
import { GameInvitationsBlock } from './GameInvitationsBlock'

/**
 * Games on Today, in the same shape as Family Map and Contacts: Invitations and Live Wordle Updates (each a heading
 * that opens and closes, one at a time), then your pinned games (☆), a search, and Show all; Open games for the page.
 */
export function GamesTodaySection() {
  const app = useApp()
  const [open, saveOpen] = useStoredFlag('align-today-games', false)
  const setOpen = useTodayExpansion(open, saveOpen)
  const [error, setError] = useState<string | null>(null)
  const pinnedIds = app.member.pinnedGames ?? DEFAULT_PINNED_GAMES
  const pinned = pinnedIds.map((id) => GAMES.find((g) => g.id === id)).filter((g) => !!g)
  function togglePin(id: string) {
    const next = pinnedIds.includes(id) ? pinnedIds.filter((x) => x !== id) : [...pinnedIds, id]
    setError(null)
    setPinnedGames(app.uid, next).catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }

  return (
    <section className="day-section games-today">
      <SectionHeader icon="sparkle" title="Games" count={pinned.length} onTitleClick={() => setOpen(!open)} expanded={open} help="games">
        <button type="button" className="link small" onClick={() => app.navigate({ view: 'games' })}>
          Open games
        </button>
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </SectionHeader>
      {open && (
        <CollectionContents
          id="games"
          title="Games"
          items={[...GAMES]}
          pinned={pinned}
          itemKey={(g) => g.id}
          matches={(g, q) => q.toLowerCase().split(/\s+/).every((w) => `${g.name} ${g.description}`.toLowerCase().includes(w))}
          searchHint="Find a game…"
          top={<GameInvitationsBlock enabled={open} />}
          filters={error && <p className="error small">{error}</p>}
          render={(g) => (
            <div className="collection-row">
              <button type="button" className="collection-row-main" onClick={() => app.navigate({ view: 'games', gameId: g.id })} title={`Play ${g.name}`}>
                <Icon name="sparkle" />
                <span className="grow">{g.name}</span>
              </button>
              <button type="button" className="link small" onClick={() => app.navigate({ view: 'games', gameId: g.id })}>
                Play
              </button>
              {app.isMember && <PinButton pinned={pinnedIds.includes(g.id)} onToggle={() => togglePin(g.id)} label={g.name} />}
            </div>
          )}
        />
      )}
    </section>
  )
}
