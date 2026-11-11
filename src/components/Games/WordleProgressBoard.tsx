import type { WordleChallengeProgress } from '../../firebase/games'
import { decodeWordleProgressRow, WORDLE_MAX_GUESSES, wordleProgressLabel } from '../../games/wordle'

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
  const layout = Math.min(participants.length, 3)
  return (
    <div className="wordle-live-players" data-count={layout} aria-label="Opponent Wordle progress">
      {participants.map((uid) => {
        const player = progress.find((item) => item.uid === uid)
        const rows = player?.rows ?? []
        const length = player?.length ?? 5
        const name = members[uid]?.displayName ?? 'Family member'
        const elapsed = player?.complete && player.elapsedMs !== undefined ? ` · ${seconds(player.elapsedMs)}` : ''
        return (
          <div className="wordle-live-player" data-layout={layout === 1 ? 'single' : 'multiple'} key={uid}>
            <div className="wordle-live-player-heading">
              <strong title={name}>{name}</strong>
              <span className="muted">{wordleProgressLabel(player)}{elapsed}</span>
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
