import { useApp } from '../../hooks/useApp'
import { usePendingGameChallenges, useWordleChallengeUpdates, useWordleChallengeProgress, type GameChallenge } from '../../firebase/games'
import { Icon } from '../UI/Icon'
import { gameById } from '../../games/catalog'
import { WordleProgressBoard } from './WordleProgressBoard'

const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

/** A small, app-wide inbox for game invitations and live Wordle progress. */
export function PendingGameInvitations() {
  const app = useApp()
  const { challenges, error } = usePendingGameChallenges(app.uid, app.isMember)
  const { challenges: wordleChallenges, error: wordleError } = useWordleChallengeUpdates(app.uid, app.isMember)
  const { progress, error: progressError } = useWordleChallengeProgress(app.uid, app.isMember)
  const groups = new Map<string, GameChallenge[]>()
  for (const challenge of wordleChallenges) {
    const puzzleId = challenge.payload?.puzzleId
    if (!puzzleId) continue
    const group = groups.get(puzzleId) ?? []
    group.push(challenge)
    groups.set(puzzleId, group)
  }
  const liveGroups = [...groups.values()]
  if (!challenges.length && !error && !liveGroups.length && !wordleError && !progressError) return null
  return (
    <section className="game-invitations card" aria-label="Game invitations">
      <strong><Icon name="sparkle" /> Game challenges {challenges.length ? `(${challenges.length})` : ''}</strong>
      {error && <p className="error small">{error}</p>}
      {wordleError && <p className="error small">{wordleError}</p>}
      {progressError && <p className="error small">{progressError}</p>}
      {challenges.map((challenge) => (
        <div className="row" key={challenge.id}>
          <span className="grow small">
            {challenge.from === app.uid
              ? `You started a Wordle challenge with ${Math.max(0, (challenge.players?.length ?? 1) - 1)} other ${challenge.players?.length === 2 ? 'player' : 'players'}.`
              : `${app.household.members[challenge.from]?.displayName ?? 'Someone'} challenged you to ${gameById(challenge.gameId)?.name ?? challenge.gameId}.`}
          </span>
          <button type="button" className="small" onClick={() => app.navigate({ view: 'games', challengeId: challenge.id })}>
            Play
          </button>
        </div>
      ))}
      {!!liveGroups.length && (
        <div className="wordle-challenge-updates">
          <strong className="small">Live Wordle challenges</strong>
          {liveGroups.map((group) => {
            const first = group[0]
            const completed = group.filter((item) => item.status === 'completed')
            const players = first.players ?? group.map((item) => item.to)
            const groupProgress = progress.filter((item) => item.groupId === first.payload?.puzzleId)
            const finished = groupProgress.filter((item) => item.complete).length
            const ownChallenge = group.find((item) => item.to === app.uid)
            return (
              <div className="wordle-challenge-update" key={first.payload?.puzzleId}>
                <div className="row wrap">
                  <strong className="grow small">
                    {finished} of {players.length} players finished · challenge from{' '}
                    {app.household.members[first.from]?.displayName ?? 'a family member'}
                  </strong>
                  {ownChallenge?.status === 'pending' && (
                    <button type="button" className="small" onClick={() => app.navigate({ view: 'games', challengeId: ownChallenge.id })}>
                      Play
                    </button>
                  )}
                </div>
                <WordleProgressBoard participants={players} progress={groupProgress} members={app.household.members} />
                {completed.map((item) => {
                  const result = item.result
                  if (!result) return null
                  const name = app.household.members[item.to]?.displayName ?? 'A family member'
                  const outcome = result.solved === false
                    ? `finished in ${result.guesses ?? '?'} guesses`
                    : `solved in ${result.guesses ?? '?'} ${result.guesses === 1 ? 'guess' : 'guesses'}`
                  const mode = result.hardMode === true
                    ? 'Hard mode'
                    : result.hardMode === false ? 'Standard mode' : 'Mode unknown'
                  return (
                    <p className="muted small" key={item.id}>
                      {name} {outcome} ({result.ms ? seconds(result.ms) : 'time unavailable'} · {mode}).
                    </p>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
