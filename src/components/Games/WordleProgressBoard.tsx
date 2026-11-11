import type { WordleChallengeProgress } from '../../firebase/games'
import { decodeWordleProgressRow, WORDLE_MAX_GUESSES, wordleProgressLabel } from '../../games/wordle'

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
    <div className="wordle-live-players" data-count={layout} aria-label="Opponent Wordle progress">
      {participants.map((uid) => {
        const player = progress.find((item) => item.uid === uid)
        const rows = player?.rows ?? []
        const length = player?.length ?? 5
        const name = members[uid]?.displayName ?? 'Family member'
        return (
          <div className="wordle-live-player" data-layout={layout === 1 ? 'single' : 'multiple'} key={uid}>
            <div className="wordle-live-player-heading">
              <strong title={name}>{name}</strong>
              <span className="muted">{wordleProgressLabel(player)}</span>
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
