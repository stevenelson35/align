import { useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { declineGameChallenge, dismissGameChallenge, type GameChallenge, type WordleChallengeProgress } from '../../firebase/games'
import { declineWordleChallenge } from '../../firebase/wordle'
import { Icon } from '../UI/Icon'
import { gameById } from '../../games/catalog'
import { WordleProgressBoard } from './WordleProgressBoard'

const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

function challengeStatus(challenge: GameChallenge) {
  if (challenge.status === 'playing') return 'Playing'
  if (challenge.status === 'declined') return 'Declined'
  if (challenge.status === 'abandoned' || challenge.result?.abandoned) return 'Gave up'
  if (challenge.status === 'completed') {
    if (challenge.gameId === 'wordle') return challenge.result?.solved ? 'Won' : 'Lost'
    return 'Played'
  }
  return 'New'
}

export function PendingGameInvitations({
  challenges,
  wordleChallenges,
  progress,
  loaded,
  errors,
}: {
  challenges: GameChallenge[]
  wordleChallenges: GameChallenge[]
  progress: WordleChallengeProgress[]
  loaded: boolean
  errors: string[]
}) {
  const app = useApp()
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const invitations = challenges.filter((challenge) => !challenge.dismissed)
  const dismissedGroups = new Set(
    wordleChallenges
      .filter((challenge) => challenge.to === app.uid && challenge.dismissed)
      .map((challenge) => challenge.payload?.puzzleId)
      .filter((puzzleId): puzzleId is string => !!puzzleId),
  )
  const groups = new Map<string, GameChallenge[]>()
  for (const challenge of wordleChallenges) {
    const puzzleId = challenge.payload?.puzzleId
    if (!puzzleId || dismissedGroups.has(puzzleId) || challenge.challengeType === 'invite') continue
    const group = groups.get(puzzleId) ?? []
    group.push(challenge)
    groups.set(puzzleId, group)
  }
  const liveGroups = [...groups.values()]

  async function declineChallenge(challenge: GameChallenge) {
    setActionId(challenge.id)
    setActionError(null)
    try {
      if (challenge.gameId === 'wordle') await declineWordleChallenge(challenge.id)
      else await declineGameChallenge(challenge.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionId(null)
    }
  }

  async function dismissChallenge(challengeId: string) {
    setActionId(challengeId)
    setActionError(null)
    try {
      await dismissGameChallenge(challengeId)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionId(null)
    }
  }

  return (
    <section className="game-invitations-list" aria-label="Invitations">
      <h4 className="small"><Icon name="sparkle" /> Invitations</h4>
      {errors.map((error) => <p className="error small" key={error}>{error}</p>)}
      {actionError && <p className="error small" role="alert">{actionError}</p>}
      {!loaded && <p className="muted small">Loading invitations…</p>}
      {loaded && !invitations.length && !errors.length && <p className="muted small">No invitations right now.</p>}
      {invitations.map((challenge) => {
        const status = challengeStatus(challenge)
        const sender = app.household.members[challenge.from]?.displayName ?? 'A family member'
        const result = challenge.result
        return (
          <div className="game-invitation-row" key={challenge.id}>
            <details className="grow">
              <summary>
                <span>{sender} · {gameById(challenge.gameId)?.name ?? challenge.gameId}</span>
                <span className={`game-invitation-status ${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span>
              </summary>
              <div className="game-invitation-details">
                {challenge.challengeType && <p className="muted small">{challenge.challengeType === 'invite' ? 'Separate word invite' : 'Live Wordle challenge'}</p>}
                {result && (
                  <p className="muted small">
                    {result.abandoned
                      ? `Gave up after ${result.guesses ?? 0} ${result.guesses === 1 ? 'guess' : 'guesses'}.`
                      : challenge.gameId === 'wordle'
                        ? result.solved
                          ? `Solved in ${result.guesses ?? '?'} ${result.guesses === 1 ? 'guess' : 'guesses'}.`
                          : `Finished after ${result.guesses ?? '?'} guesses without solving.`
                        : 'Game completed.'}
                    {result.ms ? ` Time: ${seconds(result.ms)}.` : ''}
                    {result.hardMode === true ? ' Hard mode.' : ''}
                  </p>
                )}
              </div>
            </details>
            {challenge.status === 'pending' || challenge.status === 'playing' ? (
              <button type="button" className="small" onClick={() => app.navigate({ view: 'games', challengeId: challenge.id })}>
                {challenge.status === 'playing' ? 'Continue' : 'Play'}
              </button>
            ) : (
              <button
                type="button"
                className="secondary small"
                onClick={() => void dismissChallenge(challenge.id)}
                disabled={actionId !== null}
              >
                {actionId === challenge.id ? 'Clearing…' : 'Clear'}
              </button>
            )}
            {challenge.status === 'pending' && (
              <button
                type="button"
                className="secondary small"
                onClick={() => void declineChallenge(challenge)}
                disabled={actionId !== null}
              >
                {actionId === challenge.id ? 'Declining…' : 'Decline'}
              </button>
            )}
          </div>
        )
      })}
      {!!liveGroups.length && (
        <div className="wordle-challenge-updates">
          <strong className="small">Live Wordle updates</strong>
          {liveGroups.map((group) => {
            const first = group[0]
            const players = first.players ?? group.map((item) => item.to)
            const groupProgress = progress.filter((item) => item.groupId === first.payload?.puzzleId)
            const finished = groupProgress.filter((item) => item.complete).length
            return (
              <div className="wordle-challenge-update" key={first.payload?.puzzleId}>
                <strong className="small">
                  {first.challengeType === 'random-live' ? 'Live random word' : 'Live chosen word'}
                  {' · '}{finished} of {players.length} players finished
                </strong>
                <WordleProgressBoard
                  participants={players.filter((uid) => uid !== app.uid)}
                  progress={groupProgress}
                  members={app.household.members}
                />
                {groupProgress.filter((item) => item.complete).map((item) => {
                  const name = app.household.members[item.uid]?.displayName ?? 'A family member'
                  const outcome = item.status === 'declined'
                    ? 'declined'
                    : item.status === 'abandoned'
                      ? 'gave up'
                      : item.solved
                        ? `solved in ${item.rows.length} ${item.rows.length === 1 ? 'guess' : 'guesses'}`
                        : 'ran out of guesses'
                  return <p className="muted small" key={item.uid}>{name} {outcome}.</p>
                })}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
