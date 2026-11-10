import type { WordleChallengeProgress } from '../../firebase/games'
import { decodeWordleProgressRow, WORDLE_MAX_GUESSES } from '../../games/wordle'

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
    <div className="wordle-live-players" aria-label="Opponent Wordle progress">
      {participants.map((uid) => {
        const player = progress.find((item) => item.uid === uid)
        const rows = player?.rows ?? []
        const name = members[uid]?.displayName ?? 'Family member'
        return (
          <div className="wordle-live-player" key={uid}>
            <div className="wordle-live-player-heading">
              <strong title={name}>{name}</strong>
              <span className="muted">
                {!player || !rows.length
                  ? 'Ready'
                  : player.complete
                    ? player.solved
                      ? `Solved · ${rows.length}`
                      : 'Finished'
                    : `${rows.length}/${WORDLE_MAX_GUESSES}`}
              </span>
            </div>
            <div className="wordle-live-board" aria-label={`${name}'s guesses`}>
              {rows.map((row, rowIndex) => (
                <div className="wordle-live-row" style={{ gridTemplateColumns: `repeat(${player?.length ?? 5}, minmax(0, 1fr))` }} key={rowIndex}>
                  {Array.from({ length: player?.length ?? 5 }, (_, column) => {
                    const mark = decodeWordleProgressRow(row)[column]
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
