import { DAILY_GAMES, gameById, type GameId } from '../../games/catalog'
import { useApp } from '../../hooks/useApp'
import { useDailyDone } from '../../hooks/useDailyDone'
import { Icon } from '../UI/Icon'

/**
 * Today's daily games, on each while you play through them: ‹ the one before and the next one › (both named; the set
 * goes round, so after the last comes the first), which one this is, and a chip for each (✓ when finished). Skipping
 * ahead is fine: the timed puzzles don't start until you tap Start.
 */
export function DailyBar({ current }: { current: GameId }) {
  const app = useApp()
  const done = useDailyDone()
  const at = DAILY_GAMES.indexOf(current)
  const go = (id: GameId) => app.navigate({ view: 'games', gameId: id, daily: true })
  const count = DAILY_GAMES.length
  const prev = DAILY_GAMES[(at - 1 + count) % count]
  const next = DAILY_GAMES[(at + 1) % count]
  return (
    <nav className="daily-bar" aria-label="Today’s daily games">
      <div className="daily-bar-row">
        <button type="button" className="secondary small" onClick={() => go(prev)} aria-label={`Previous: ${gameById(prev)?.name}`}>
          <Icon name="chevron-left" /> {gameById(prev)?.name}
        </button>
        <span className="daily-bar-title small">
          <strong>Daily</strong> {at + 1} of {count} · {DAILY_GAMES.filter((g) => done.has(g)).length} done
        </span>
        <button type="button" className="secondary small" onClick={() => go(next)} aria-label={`Next: ${gameById(next)?.name}`}>
          {gameById(next)?.name} <Icon name="chevron-right" />
        </button>
      </div>
      <div className="daily-bar-chips">
        {DAILY_GAMES.map((g) => (
          <button key={g} type="button" className={`daily-chip${g === current ? ' on' : ''}${done.has(g) ? ' done' : ''}`} onClick={() => go(g)} aria-current={g === current ? 'page' : undefined}>
            {done.has(g) && <Icon name="check" />} {gameById(g)?.name}
          </button>
        ))}
      </div>
    </nav>
  )
}
