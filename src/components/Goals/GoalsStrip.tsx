import { today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { appliesOn, met } from '../../utils/goals'
import { GoalControl } from './GoalControl'

/** The day's goals, at the top of a day view: log them right there. */
export function GoalsStrip({ day }: { day: string }) {
  const { navigate } = useApp()
  const { goals } = useData()
  const forDay = goals.filter((g) => appliesOn(g, day))
  if (!forDay.length) return null
  const metCount = forDay.filter((g) => met(g, g.log?.[day], day)).length
  return (
    <div className="goals-strip">
      <h3>
        Goals <span className="muted">{metCount}/{forDay.length}</span>
        <button type="button" className="link small" onClick={() => navigate({ view: 'goals' })}>
          Manage
        </button>
      </h3>
      {day > today() && <p className="muted small">Log goals on the day.</p>}
      <div className="goal-list">
        {forDay.map((g) => (
          <GoalControl key={g.id} goal={g} day={day} />
        ))}
      </div>
    </div>
  )
}
