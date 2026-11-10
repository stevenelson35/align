import { useApp } from '../../hooks/useApp'
import { usePendingGameChallenges } from '../../firebase/games'
import { Icon } from '../UI/Icon'
import { gameById } from '../../games/catalog'

/** A small, app-wide inbox so family game invitations are visible on the next visit. */
export function PendingGameInvitations() {
  const app = useApp()
  const { challenges, error } = usePendingGameChallenges(app.uid, app.isMember)
  if (!challenges.length && !error) return null
  return (
    <section className="game-invitations card" aria-label="Game invitations">
      <strong><Icon name="sparkle" /> Game challenges {challenges.length ? `(${challenges.length})` : ''}</strong>
      {error && <p className="error small">{error}</p>}
      {challenges.map((challenge) => (
        <div className="row" key={challenge.id}>
          <span className="grow small">
            {app.household.members[challenge.from]?.displayName ?? 'Someone'} challenged you to {gameById(challenge.gameId)?.name ?? challenge.gameId}.
          </span>
          <button type="button" className="small" onClick={() => app.navigate({ view: 'games', challengeId: challenge.id })}>
            Play
          </button>
        </div>
      ))}
    </section>
  )
}
