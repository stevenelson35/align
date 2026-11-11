import { useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { usePendingGameChallenges, useWordleChallengeUpdates, useWordleChallengeProgress, type GameChallenge } from '../../firebase/games'
import { declineWordleChallenge } from '../../firebase/wordle'
import { Icon } from '../UI/Icon'
import { gameById } from '../../games/catalog'
import { WordleProgressBoard } from './WordleProgressBoard'

const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

/** A small, app-wide inbox for game invitations and live Wordle progress. */
export function PendingGameInvitations({ activeChallengeId }: { activeChallengeId?: string }) {
  const app = useApp()
  const [expanded, setExpanded] = useState(false)
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [declineError, setDeclineError] = useState<string | null>(null)
  const { challenges, error } = usePendingGameChallenges(app.uid, app.isMember)
  const { challenges: wordleChallenges, error: wordleError } = useWordleChallengeUpdates(app.uid, app.isMember)
  const { progress, error: progressError } = useWordleChallengeProgress(app.uid, app.isMember)
  const visibleChallenges = challenges.filter((challenge) => challenge.id !== activeChallengeId)
  const groups = new Map<string, GameChallenge[]>()
  for (const challenge of wordleChallenges) {
    const puzzleId = challenge.payload?.puzzleId
    if (!puzzleId) continue
    const group = groups.get(puzzleId) ?? []
    group.push(challenge)
    groups.set(puzzleId, group)
  }
  const liveGroups = [...groups.values()].filter((group) => (
    !group.some((challenge) => challenge.id === activeChallengeId)
    && !(group[0].challengeType === 'invite' && group.some((challenge) => challenge.to === app.uid && challenge.status === 'pending'))
  ))
  const hasError = !!error || !!wordleError || !!progressError || !!declineError
  if (!visibleChallenges.length && !hasError && !liveGroups.length) return null

  async function declineChallenge(challengeId: string) {
    setDecliningId(challengeId)
    setDeclineError(null)
    try {
      await declineWordleChallenge(challengeId)
    } catch (err) {
      setDeclineError(err instanceof Error ? err.message : String(err))
    } finally {
      setDecliningId(null)
    }
  }

  return (
    <section className="game-invitations card" aria-label="Game invitations">
      <details
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary>
          <Icon name="sparkle" /> Game invitations &amp; updates
          {visibleChallenges.length > 0 && <span className="game-invitations-count">{visibleChallenges.length} invitation{visibleChallenges.length === 1 ? '' : 's'}</span>}
          {!!liveGroups.length && <span className="muted small">{liveGroups.length} Wordle update{liveGroups.length === 1 ? '' : 's'}</span>}
        </summary>
        <div className="game-invitations-content">
          {error && <p className="error small">{error}</p>}
          {wordleError && <p className="error small">{wordleError}</p>}
          {progressError && <p className="error small">{progressError}</p>}
          {declineError && <p className="error small" role="alert">{declineError}</p>}
          {visibleChallenges.map((challenge) => (
            <div className="row" key={challenge.id}>
              <span className="grow small">
                {`${app.household.members[challenge.from]?.displayName ?? 'Someone'} challenged you to ${gameById(challenge.gameId)?.name ?? challenge.gameId}.`}
              </span>
              <button type="button" className="small" onClick={() => app.navigate({ view: 'games', challengeId: challenge.id })}>
                Play
              </button>
              {challenge.gameId === 'wordle' && (
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => void declineChallenge(challenge.id)}
                  disabled={decliningId !== null}
                >
                  {decliningId === challenge.id ? 'Declining…' : 'Decline'}
                </button>
              )}
            </div>
          ))}
          {!!liveGroups.length && (
            <div className="wordle-challenge-updates">
              <strong className="small">Wordle challenge updates</strong>
              {liveGroups.map((group) => {
                const first = group[0]
                const inviteOnly = first.challengeType === 'invite'
                const completed = group.filter((item) => item.status === 'completed')
                const declined = group.filter((item) => item.status === 'declined')
                const abandoned = group.filter((item) => item.status === 'abandoned')
                const players = first.players ?? group.map((item) => item.to)
                const groupProgress = progress.filter((item) => item.groupId === first.payload?.puzzleId)
                const finished = inviteOnly
                  ? completed.length + abandoned.length
                  : groupProgress.filter((item) => item.complete && item.status !== 'declined').length
                const ownChallenge = group.find((item) => item.to === app.uid)
                return (
                  <div className="wordle-challenge-update" key={first.payload?.puzzleId}>
                    <div className="row wrap">
                      <strong className="grow small">
                        {inviteOnly ? 'Word invite' : 'Live Wordle'}
                        {' · '}{finished} of {players.length} players finished
                        {declined.length ? ` · ${declined.length} declined` : ''}
                        {abandoned.length ? ` · ${abandoned.length} gave up` : ''}
                        {' · '}challenge from{' '}
                        {app.household.members[first.from]?.displayName ?? 'a family member'}
                      </strong>
                      {ownChallenge?.status === 'pending' && (
                        <button type="button" className="small" onClick={() => app.navigate({ view: 'games', challengeId: ownChallenge.id })}>
                          Play
                        </button>
                      )}
                    </div>
                    {!inviteOnly && <WordleProgressBoard participants={players} progress={groupProgress} members={app.household.members} />}
                    {declined.map((item) => (
                      <p className="muted small" role="status" key={item.id}>
                        {app.household.members[item.to]?.displayName ?? 'A family member'} declined the Wordle challenge.
                      </p>
                    ))}
                    {[...completed, ...abandoned].map((item) => {
                      const result = item.result
                      if (!result) return null
                      const name = app.household.members[item.to]?.displayName ?? 'A family member'
                      const outcome = result.abandoned
                        ? `gave up after ${result.guesses ?? 0} ${result.guesses === 1 ? 'guess' : 'guesses'}`
                        : result.solved === false
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
        </div>
      </details>
    </section>
  )
}
