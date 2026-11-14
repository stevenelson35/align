import { useState, type MouseEvent } from 'react'
import { Timestamp } from 'firebase/firestore'
import { useApp } from '../../hooks/useApp'
import { declineGameChallenge, dismissGameChallenge, type GameChallenge, type WordleChallengeProgress } from '../../firebase/games'
import { cancelWordleChallenge, declineWordleChallenge } from '../../firebase/wordle'
import { Icon } from '../UI/Icon'
import { gameById } from '../../games/catalog'
import { WordleProgressBoard } from './WordleProgressBoard'

const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

function challengeProgress(challenge: GameChallenge, progress: WordleChallengeProgress[]) {
  const puzzleId = challenge.payload?.puzzleId
  return puzzleId ? progress.find((item) => item.groupId === puzzleId && item.uid === challenge.to) : undefined
}

function isOpenChallenge(challenge: GameChallenge, progress: WordleChallengeProgress[]) {
  const playerProgress = challengeProgress(challenge, progress)
  return (challenge.status === 'pending' || challenge.status === 'playing') && !playerProgress?.complete
}

function challengeStatus(challenge: GameChallenge, progress: WordleChallengeProgress[]) {
  const playerProgress = challengeProgress(challenge, progress)
  if (playerProgress?.status === 'declined') return 'Declined'
  if (playerProgress?.status === 'abandoned') return 'Gave up'
  if (challenge.status === 'cancelled' || playerProgress?.status === 'cancelled') return 'Cancelled'
  if (challenge.status === 'expired' || playerProgress?.status === 'expired') return 'Expired'
  if (challenge.challengeType === 'realtime-live' && playerProgress?.lobbyStatus === 'waiting') {
    return playerProgress.ready ? 'Ready' : 'Waiting'
  }
  if (playerProgress?.complete) return playerProgress.solved ? 'Won' : 'Lost'
  if (challenge.status === 'playing') return 'Playing'
  if (challenge.status === 'declined') return 'Declined'
  if (challenge.status === 'abandoned' || challenge.result?.abandoned) return 'Gave up'
  if (challenge.status === 'completed') {
    if (challenge.gameId === 'wordle') return challenge.result?.solved ? 'Won' : 'Lost'
    return 'Played'
  }
  return 'New'
}

function challengeDate(value: GameChallenge['createdAt']) {
  const date = value instanceof Timestamp
    ? value.toDate()
    : value instanceof Date
      ? value
      : typeof value === 'string'
        ? new Date(value)
        : null
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : 'Date unavailable'
}

export function PendingGameInvitations({
  challenges,
  wordleChallenges,
  progress,
  loaded,
  errors,
  invitationsOpen,
  liveUpdatesOpen,
  onToggleInvitations,
  onToggleLiveUpdates,
}: {
  challenges: GameChallenge[]
  wordleChallenges: GameChallenge[]
  progress: WordleChallengeProgress[]
  loaded: boolean
  errors: string[]
  invitationsOpen: boolean
  liveUpdatesOpen: boolean
  onToggleInvitations: () => void
  onToggleLiveUpdates: () => void
}) {
  const app = useApp()
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const invitations = challenges.filter((challenge) => !challenge.dismissed)
  const openCount = invitations.filter((challenge) => isOpenChallenge(challenge, progress)).length
  const completeCount = invitations.length - openCount
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

  function toggleDisclosure(event: MouseEvent<HTMLElement>, toggle: () => void) {
    event.preventDefault()
    toggle()
  }

  async function declineChallenge(challenge: GameChallenge) {
    setActionId(challenge.id)
    setActionError(null)
    try {
      if (challenge.gameId === 'wordle' && challenge.challengeType === 'realtime-live') await cancelWordleChallenge(challenge.id)
      else if (challenge.gameId === 'wordle') await declineWordleChallenge(challenge.id)
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
    <section className="game-invitations-list" aria-label="Game invitations and live Wordle updates">
      <details className="game-invitations-disclosure games-today-disclosure" open={invitationsOpen}>
        <summary className="game-invitations-heading" onClick={(event) => toggleDisclosure(event, onToggleInvitations)}>
          <span className="game-invitations-title"><Icon name="sparkle" /> Invitations</span>
          <span className="game-invitations-count">
            {loaded ? `${openCount} open, ${completeCount} complete` : 'Loading…'}
          </span>
        </summary>
        <div className="game-invitations-content">
          {errors.map((error) => <p className="error small" key={error}>{error}</p>)}
          {actionError && <p className="error small" role="alert">{actionError}</p>}
          {!loaded && <p className="muted small">Loading invitations…</p>}
          {loaded && !invitations.length && !errors.length && <p className="muted small">No invitations right now.</p>}
          {invitations.map((challenge) => {
            const status = challengeStatus(challenge, progress)
            const open = isOpenChallenge(challenge, progress)
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
                    {challenge.challengeType && (
                      <p className="muted small">
                        {challenge.challengeType === 'invite'
                          ? 'Separate word invite'
                          : challenge.challengeType === 'realtime-live'
                            ? 'Real-time Live Wordle · everyone must be ready before play starts'
                            : 'Live Wordle challenge'}
                      </p>
                    )}
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
                {open ? (
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
                {challenge.status === 'pending' && open && (
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => void declineChallenge(challenge)}
                    disabled={actionId !== null}
                  >
                    {actionId === challenge.id
                      ? challenge.challengeType === 'realtime-live' ? 'Cancelling…' : 'Declining…'
                      : challenge.challengeType === 'realtime-live' ? 'Cancel challenge' : 'Decline'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </details>
      <details className="wordle-challenge-updates games-today-disclosure" open={liveUpdatesOpen}>
        <summary className="game-invitations-heading" onClick={(event) => toggleDisclosure(event, onToggleLiveUpdates)}>
          <span className="game-invitations-title"><Icon name="clock" /> Live Wordle Updates</span>
          <span className="game-invitations-count">{liveGroups.length ? `${liveGroups.length} ${liveGroups.length === 1 ? 'game' : 'games'}` : 'none now'}</span>
        </summary>
          {!liveGroups.length && <p className="muted small">No live Wordle updates right now.</p>}
          {liveGroups.map((group) => {
            const first = group[0]
            const players = [...new Set(first.players ?? group.map((item) => item.to))]
            const groupProgress = progress.filter((item) => item.groupId === first.payload?.puzzleId)
            const finished = groupProgress.filter((item) => item.complete).length
            const complete = players.length > 0 && players.every((uid) => groupProgress.some((item) => item.uid === uid && item.complete))
            return (
              <details className="wordle-challenge-update" key={first.payload?.puzzleId}>
                <summary className="wordle-challenge-update-heading">
                  <span>{challengeDate(first.createdAt)}</span>
                  <span>
                    {first.challengeType === 'random-live'
                      ? 'Live random word'
                      : first.challengeType === 'realtime-live' ? 'Real-time Live Wordle' : 'Live chosen word'}
                  </span>
                  <span>{players.length} {players.length === 1 ? 'player' : 'players'} · {finished}/{players.length} finished</span>
                  <span className="wordle-challenge-update-status" aria-label={complete ? 'Complete' : 'In progress'}>
                    <Icon name={complete ? 'check' : 'clock'} />
                  </span>
                </summary>
                <WordleProgressBoard
                  participants={players}
                  progress={groupProgress}
                  members={app.household.members}
                />
              </details>
            )
          })}
      </details>
    </section>
  )
}
