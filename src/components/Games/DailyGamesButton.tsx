import { DAILY_GAMES, nextDaily } from '../../games/catalog'
import { useApp } from '../../hooks/useApp'
import { useDailyDone } from '../../hooks/useDailyDone'
import { Icon } from '../UI/Icon'

/**
 * 🧩 in Today's header: straight into today's daily games (the first one not done), with how many are left as a
 * small number (none once they're all done).
 */
export function DailyGamesButton() {
  const app = useApp()
  const done = useDailyDone()
  if (!app.canPlay) return null
  const left = DAILY_GAMES.filter((g) => !done.has(g)).length
  return (
    <button
      type="button"
      className="link header-icon daily-games-button"
      onClick={() => app.navigate({ view: 'games', gameId: nextDaily(done), daily: true })}
      title={left ? `Play today’s daily games (${left} left)` : 'Today’s daily games: all done'}
      aria-label={left ? `Play today’s daily games, ${left} left` : 'Today’s daily games, all done'}
    >
      <Icon name="puzzle" />
      {left > 0 && <span className="header-icon-count">{left}</span>}
    </button>
  )
}
