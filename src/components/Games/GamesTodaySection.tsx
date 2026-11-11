import { useState } from 'react'
import { setPinnedGames } from '../../firebase/db'
import { useGameChallenges, useWordleChallengeProgress, useWordleChallengeUpdates } from '../../firebase/games'
import { useApp } from '../../hooks/useApp'
import { useStoredChoice } from '../../hooks/useStoredChoice'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { useTodayExpansion } from '../../hooks/useTodaySection'
import { DEFAULT_PINNED_GAMES, GAMES } from '../../games/catalog'
import { SectionHeader } from '../UI/SectionHeader'
import { GameTile } from './GameTile'
import { PendingGameInvitations } from './PendingGameInvitations'

const GAMES_PANEL_SECTIONS = ['invitations', 'live-updates', 'pinned-games', 'search-games', 'none'] as const
type GamesPanelSection = typeof GAMES_PANEL_SECTIONS[number]

export function GamesTodaySection() {
  const app = useApp()
  const [open, saveOpen] = useStoredFlag('align-today-games', false)
  const setOpen = useTodayExpansion(open, saveOpen)
  const [expandedSection, setExpandedSection] = useStoredChoice<GamesPanelSection>(
    'align-today-games-panel-section',
    GAMES_PANEL_SECTIONS,
    'invitations',
  )
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
  function togglePin(id: string) {
    const next = pinnedIds.includes(id) ? pinnedIds.filter((x) => x !== id) : [...pinnedIds, id]
    setError(null)
    setPinnedGames(app.uid, next).catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }

  return (
    <section className="day-section games-today">
      <SectionHeader icon="sparkle" title="Games" count={pinned.length} onTitleClick={() => setOpen(!open)} expanded={open} />
      {open && (
        <div className="section-content">
          <PendingGameInvitations
            challenges={challenges}
            wordleChallenges={wordleChallenges}
            progress={progress}
            loaded={challengesLoaded}
            errors={[challengeError, wordleError, progressError].filter((message): message is string => !!message)}
            invitationsOpen={expandedSection === 'invitations'}
            liveUpdatesOpen={expandedSection === 'live-updates'}
            onToggleInvitations={() => setExpandedSection(expandedSection === 'invitations' ? 'none' : 'invitations')}
            onToggleLiveUpdates={() => setExpandedSection(expandedSection === 'live-updates' ? 'none' : 'live-updates')}
          />
          <details className="games-today-disclosure games-pinned-section" open={expandedSection === 'pinned-games'}>
            <summary
              className="small"
              onClick={(event) => {
                event.preventDefault()
                setExpandedSection(expandedSection === 'pinned-games' ? 'none' : 'pinned-games')
              }}
            >
              Pinned Games
            </summary>
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
              <p className="muted small">No games pinned yet. Search for a game or choose Show All Games to pin one.</p>
            )}
          </details>
          <details className="games-today-disclosure games-today-search" open={expandedSection === 'search-games'}>
            <summary
              className="small"
              onClick={(event) => {
                event.preventDefault()
                setExpandedSection(expandedSection === 'search-games' ? 'none' : 'search-games')
              }}
            >
              Search Games
            </summary>
            <label className="games-search">
              <input
                type="search"
                aria-label="Search games"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a game…"
              />
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
          </details>
          <div className="games-today-show-all">
            <button type="button" className="secondary small" onClick={() => app.navigate({ view: 'games' })}>Show All Games</button>
          </div>
          {error && <p className="error small">{error}</p>}
        </div>
      )}
    </section>
  )
}
