import type { GameId } from '../../games/catalog'

export function GameTile({
  id,
  name,
  description,
  pinned,
  daily = false,
  doneToday = false,
  onPlay,
  onPin,
}: {
  id: GameId
  name: string
  description: string
  pinned: boolean
  /** A new puzzle every day (and whether you've finished today's). */
  daily?: boolean
  doneToday?: boolean
  onPlay: () => void
  onPin: () => void
}) {
  return (
    <article className="game-tile card">
      <button type="button" className="game-tile-main" onClick={onPlay}>
        {id === 'wordle' ? (
          <span className="game-mini-picture game-mini-wordle" role="img" aria-label={`${name} preview`}>
            {['W', 'O', 'R', 'D', 'L'].map((letter, i) => <span key={letter} className={i < 3 ? 'correct' : 'absent'}>{letter}</span>)}
          </span>
        ) : id === 'sliding-tiles' ? (
          <span className="game-mini-picture game-mini-slider" role="img" aria-label={`${name} preview`}>
            {Array.from({ length: 9 }, (_, i) => <span key={i} className={i === 8 ? 'empty' : 'number'}>{i === 8 ? '' : i + 1}</span>)}
          </span>
        ) : id === 'glider' ? (
          <span className="game-mini-picture game-mini-glider" role="img" aria-label={`${name} preview`}>
            <span className="glider-mini-tower top" />
            <span className="glider-mini-plane">➤</span>
            <span className="glider-mini-tower bottom" />
          </span>
        ) : id === 'tower-of-hanoi' ? (
          <span className="game-mini-picture game-mini-hanoi" role="img" aria-label={`${name} preview`}>
            <span className="hanoi-mini-stack"><i /><i /><i /></span>
            <span className="hanoi-mini-stack"><i /></span>
            <span className="hanoi-mini-stack" />
          </span>
        ) : (
          <span className={`game-mini-picture game-mini-${id}`} role="img" aria-label={`${name} preview`}>
            {Array.from({ length: 25 }, (_, i) => <span key={i} className={((i * 7 + 3) % 5 < 2) ? 'lit' : ''} />)}
          </span>
        )}
        <span className="game-tile-copy">
          <strong>
            {name}
            {daily && <span className={`badge daily-badge${doneToday ? ' done' : ''}`}>{doneToday ? '✓ Today’s done' : 'Daily'}</span>}
          </strong>
          <span className="muted small">{description}</span>
        </span>
      </button>
      <div className="row">
        <button type="button" className="small" onClick={onPlay}>Play</button>
        <button type="button" className="secondary small" onClick={onPin} aria-pressed={pinned}>
          {pinned ? '★ Pinned' : '☆ Pin'}
        </button>
      </div>
    </article>
  )
}
