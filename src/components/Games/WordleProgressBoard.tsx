import type { WordleChallengeProgress } from '../../firebase/games'
import { decodeWordleProgressRow, WORDLE_MAX_GUESSES } from '../../games/wordle'

const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

function statusLabel(player?: WordleChallengeProgress) {
  if (!player) return 'Invited'
  if (player.status === 'declined') return 'Declined'
  if (player.status === 'abandoned') return 'Gave up'
  if (player.complete) return player.solved ? 'Solved' : 'Out of guesses'
  return player.started || player.rows.length ? 'Playing' : 'Ready'
}

export function WordleProgressBoard({
  participants,
  progress,
  members,
}: {
  participants: string[]
  progress: WordleChallengeProgress[]
  members: Record<string, { displayName: string }>
}) {
  const layout = Math.min(participants.length, 3)
  return (
    <div className="wordle-live-players" data-count={layout} aria-label="Live Wordle player progress">
      {participants.map((uid) => {
        const player = progress.find((item) => item.uid === uid)
        const rows = player?.rows ?? []
        const length = player?.length ?? 5
        const name = members[uid]?.displayName ?? 'Family member'
        const guesses = `${rows.length} ${rows.length === 1 ? 'guess' : 'guesses'}`
        const elapsed = player?.elapsedMs !== undefined ? seconds(player.elapsedMs) : '—'
        return (
          <div className="wordle-live-player" data-layout={layout === 1 ? 'single' : 'multiple'} key={uid}>
            <div className="wordle-live-player-heading">
              <strong title={name}>{name}</strong>
              <span className="wordle-live-player-status">{statusLabel(player)}</span>
              <span className="wordle-live-player-meta">{guesses} · Time: {elapsed}</span>
            </div>
            <div className="wordle-live-board" aria-label={`${name}'s Wordle progress`}>
              {Array.from({ length: WORDLE_MAX_GUESSES }, (_, rowIndex) => (
                <div className="wordle-live-row" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }} key={rowIndex}>
                  {Array.from({ length }, (_, column) => {
                    const mark = decodeWordleProgressRow(rows[rowIndex])[column]
                    return <span className={`wordle-live-cell${mark ? ` ${mark}` : ''}`} key={column} />
                  })}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
