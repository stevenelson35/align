import { useState } from 'react'
import { setPinnedGames } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { useTodayExpansion } from '../../hooks/useTodaySection'
import { DEFAULT_PINNED_GAMES, GAMES } from '../../games/catalog'
import { SectionHeader } from '../UI/SectionHeader'
import { GameTile } from './GameTile'

export function GamesTodaySection() {
  const app = useApp()
  const [open, saveOpen] = useStoredFlag('align-today-games', false)
  const setOpen = useTodayExpansion(open, saveOpen)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pinnedIds = app.member.pinnedGames ?? DEFAULT_PINNED_GAMES
  const pinned = GAMES.filter((game) => pinnedIds.includes(game.id))
  const searching = !!query.trim()
  const shown = searching ? GAMES.filter((game) => `${game.name} ${game.description}`.toLowerCase().includes(query.trim().toLowerCase())) : pinned

  function togglePin(id: string) {
    const next = pinnedIds.includes(id) ? pinnedIds.filter((x) => x !== id) : [...pinnedIds, id]
    setError(null)
    setPinnedGames(app.uid, next).catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }

  return (
    <section className="day-section games-today">
      <SectionHeader icon="sparkle" title="Games" count={pinned.length} onTitleClick={() => setOpen(!open)} expanded={open}>
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </SectionHeader>
      {open && (
        <div className="section-content">
          <label className="games-search">
            <span className="sr-only">Search games</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games…" />
          </label>
          <h4 className="small">{searching ? 'Matches' : 'Pinned games'}</h4>
          {shown.length ? (
            <div className="game-mini-list">
              {shown.map((game) => (
                <GameTile
                  key={game.id}
                  {...game}
                  pinned={pinnedIds.includes(game.id)}
                  onPlay={() => app.navigate({ view: 'games', gameId: game.id })}
                  onPin={() => togglePin(game.id)}
                />
              ))}
            </div>
          ) : (
            <p className="muted small">{searching ? 'No games match that search.' : 'No games pinned yet. Search for a game or show all games to pin one.'}</p>
          )}
          <div className="row">
            <button type="button" className="secondary small" onClick={() => app.navigate({ view: 'games' })}>Show all games</button>
          </div>
          {error && <p className="error small">{error}</p>}
        </div>
      )}
    </section>
  )
}
