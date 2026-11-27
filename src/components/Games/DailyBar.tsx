import { DAILY_GAMES, gameById, type GameId } from '../../games/catalog'
import { useApp } from '../../hooks/useApp'
import { useDailyDone } from '../../hooks/useDailyDone'
import { Icon } from '../UI/Icon'

/**
 * Today's daily games, on each of them: ‹ the one before, which one this is (a chip each, ✓ when finished), the next
 * one ›. Skipping ahead is fine: the timed puzzles don't start until you tap Start.
 */
export function DailyBar({ current }: { current: GameId }) {
  const app = useApp()
  const done = useDailyDone()
  const at = DAILY_GAMES.indexOf(current)
  const go = (id: GameId) => app.navigate({ view: 'games', gameId: id })
  const prev = DAILY_GAMES[at - 1]
  const next = DAILY_GAMES[at + 1]
  return (
    <nav className="daily-bar" aria-label="Today’s daily games">
      <div className="daily-bar-row">
        <button type="button" className="secondary small" disabled={!prev} onClick={() => prev && go(prev)} aria-label={prev ? `Previous: ${gameById(prev)?.name}` : 'No previous game'}>
          <Icon name="chevron-left" />
        </button>
        <span className="daily-bar-title small">
          <strong>Daily</strong> {at + 1} of {DAILY_GAMES.length} · {DAILY_GAMES.filter((g) => done.has(g)).length} done
        </span>
        <button type="button" className="secondary small" disabled={!next} onClick={() => next && go(next)} aria-label={next ? `Next: ${gameById(next)?.name}` : 'No next game'}>
          {next ? gameById(next)?.name : 'Last one'} <Icon name="chevron-right" />
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
