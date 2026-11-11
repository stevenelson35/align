import { useState } from 'react'
import { setPinnedGames } from '../../firebase/db'
import { useGameChallenges, usePendingGameChallenges, useWordleChallengeProgress, useWordleChallengeUpdates } from '../../firebase/games'
import { useApp } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { useTodayExpansion } from '../../hooks/useTodaySection'
import { DEFAULT_PINNED_GAMES, GAMES } from '../../games/catalog'
import { SectionHeader } from '../UI/SectionHeader'
import { GameTile } from './GameTile'
import { PendingGameInvitations } from './PendingGameInvitations'

export function GamesTodaySection() {
  const app = useApp()
  const [open, saveOpen] = useStoredFlag('align-today-games', false)
  const setOpen = useTodayExpansion(open, saveOpen)
  const { challenges: pendingChallenges, error: pendingError } = usePendingGameChallenges(app.uid, app.isMember)
  const { challenges, error: challengeError, loaded: challengesLoaded } = useGameChallenges(app.uid, app.isMember && open)
  const { challenges: wordleChallenges, error: wordleError } = useWordleChallengeUpdates(app.uid, app.isMember && open)
  const { progress, error: progressError } = useWordleChallengeProgress(app.uid, app.isMember && open)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pinnedIds = app.member.pinnedGames ?? DEFAULT_PINNED_GAMES
  const pinned = GAMES.filter((game) => pinnedIds.includes(game.id))
  const matches = query.trim()
    ? GAMES.filter((game) => `${game.name} ${game.description}`.toLowerCase().includes(query.trim().toLowerCase()))
    : []
  const invitationCount = pendingChallenges.length

  function togglePin(id: string) {
    const next = pinnedIds.includes(id) ? pinnedIds.filter((x) => x !== id) : [...pinnedIds, id]
    setError(null)
    setPinnedGames(app.uid, next).catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }

  return (
    <section className="day-section games-today">
      <SectionHeader icon="sparkle" title="Games" count={pinned.length} onTitleClick={() => setOpen(!open)} expanded={open}>
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {invitationCount} invitation{invitationCount === 1 ? '' : 's'}
        </button>
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </SectionHeader>
      {open && (
        <div className="section-content">
          <PendingGameInvitations
            challenges={challenges}
            wordleChallenges={wordleChallenges}
            progress={progress}
            loaded={challengesLoaded}
            errors={[pendingError, challengeError, wordleError, progressError].filter((message): message is string => !!message)}
          />
          <h4 className="small">Pinned games</h4>
          {pinned.length ? (
            <div className="game-mini-list">
              {pinned.map((game) => (
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
            <p className="muted small">No games pinned yet. Search for a game or show all games to pin one.</p>
          )}
          <h4 className="small">Search games</h4>
          <label className="games-search">
            <span className="sr-only">Search games</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games…" />
          </label>
          {!!query.trim() && (matches.length ? (
            <div className="game-mini-list">
              {matches.map((game) => (
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
            <p className="muted small">No games match that search.</p>
          ))}
          <div className="row">
            <button type="button" className="secondary small" onClick={() => app.navigate({ view: 'games' })}>Show all games</button>
          </div>
          {error && <p className="error small">{error}</p>}
        </div>
      )}
    </section>
  )
}
