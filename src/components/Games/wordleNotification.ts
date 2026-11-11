import type { GameChallenge, WordleChallengeProgress } from '../../firebase/games'
import type { WordleGameState } from '../../firebase/wordle'
import { wordleChallengeFinished } from '../../games/wordle'

function updatedAtMillis(value: WordleChallengeProgress['updatedAt']) {
  if (!value) return Number.NEGATIVE_INFINITY
  if (typeof value === 'string') return Date.parse(value)
  return value instanceof Date ? value.getTime() : value.toMillis()
}

export function challengeNotification(
  game: WordleGameState,
  challenge: GameChallenge | undefined,
  progress: WordleChallengeProgress[],
  members: Record<string, { displayName: string }>,
) {
  const allPlayersFinished = challenge
    ? wordleChallengeFinished(challenge.players ?? [challenge.to], progress)
    : false
  if (game.complete) {
    if (game.challengeStatus === 'cancelled') return 'This real-time challenge was cancelled.'
    if (game.challengeStatus === 'expired') return 'The real-time lobby timed out.'
    const others = challenge ? allPlayersFinished ? ' Challenge complete.' : ' Other players can keep going.' : ''
    if (game.solved) return `You solved it!${others}`
    if (game.abandoned) return `You gave up.${others}`
    return `No guesses left.${others}`
  }
  if (challenge) {
    const finished = progress
      .filter((item) => item.complete)
      .sort((a, b) => {
        const first = updatedAtMillis(a.updatedAt)
        const second = updatedAtMillis(b.updatedAt)
        return first < second ? -1 : first > second ? 1 : 0
      })
    const latest = finished[finished.length - 1]
    if (latest) {
      const name = members[latest.uid]?.displayName ?? 'A family member'
      if (latest.status === 'declined') return `${name} declined. You can keep playing or give up.`
      if (latest.status === 'abandoned') return `${name} gave up. You can keep playing or give up.`
      if (!latest.solved) return `${name} ran out of guesses. You can keep playing or give up.`
      const solved = finished.filter((item) => item.solved).length
      return `${name} ${solved === 1 ? 'solved first' : `solved (${solved} finished)`}! Keep playing or give up.`
    }
  }
  return game.length === 5 ? 'Hard mode: use every revealed hint.' : ' '
}
