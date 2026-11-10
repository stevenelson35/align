import type { WordleChallengeProgress } from '../../firebase/games'
import { decodeWordleProgressRow, WORDLE_MAX_GUESSES } from '../../games/wordle'

const seconds = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

export function WordleProgressBoard({
  participants,
  progress,
  members,
}: {
  participants: string[]
  progress: WordleChallengeProgress[]
  members: Record<string, { displayName: string }>
}) {
  return (
    <div className="wordle-live-players" aria-label="Live Wordle progress">
      {participants.map((uid) => {
        const player = progress.find((item) => item.uid === uid)
        const rows = player?.rows ?? []
        const name = members[uid]?.displayName ?? 'Family member'
        return (
          <div className="wordle-live-player" key={uid}>
            <div className="row">
              <strong className="grow small">{name}</strong>
              <span className="muted small">
                {!player || !rows.length
                  ? 'Ready'
                  : player.complete
                    ? player.solved
                      ? `Solved · ${rows.length} ${rows.length === 1 ? 'guess' : 'guesses'}${player.elapsedMs ? ` · ${seconds(player.elapsedMs)}` : ''}`
                      : 'Out of guesses'
                    : `${rows.length} of ${WORDLE_MAX_GUESSES} guesses`}
              </span>
            </div>
            <div className="wordle-live-board" aria-label={`${name}'s guesses`}>
              {Array.from({ length: WORDLE_MAX_GUESSES }, (_, row) => (
                <div className="wordle-live-row" style={{ gridTemplateColumns: `repeat(${player?.length ?? 5}, minmax(0, 1fr))` }} key={row}>
                  {Array.from({ length: player?.length ?? 5 }, (_, column) => {
                    const mark = decodeWordleProgressRow(rows[row])[column]
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
