import { useState } from 'react'
import { today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { appliesOn, met } from '../../utils/goals'
import { PRIVACY_ICON } from '../../utils/tasks'
import { GoalControl } from './GoalControl'
import { GoalEditor } from './GoalEditor'

/** Every goal: log today's from here, open one for its chart, or add a new one. */
export function GoalsView() {
  const { isMember, navigate } = useApp()
  const { goals } = useData()
  const [creating, setCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const day = today()
  const active = goals.filter((g) => !g.archived)
  const archived = goals.filter((g) => g.archived)
  return (
    <section>
      <header className="view-header">
        <h2>Goals</h2>
        <span className="muted">
          {active.filter((g) => appliesOn(g, day) && met(g, g.log?.[day], day)).length}/{active.filter((g) => appliesOn(g, day)).length} today
        </span>
        <span className="grow" />
        {isMember && (
          <button type="button" className="small" onClick={() => setCreating(true)}>
            + New goal
          </button>
        )}
      </header>
      <p className="muted small">Daily goals show on each day they apply. Tap a name for its chart and history.</p>
      <div className="goal-list">
        {active.map((g) => (
          <div key={g.id} className="goal-row">
            {appliesOn(g, day) ? (
              <GoalControl goal={g} day={day} />
            ) : (
              <div className="goal-control">
                <button type="button" className="goal-name link" onClick={() => navigate({ view: 'goal', goalId: g.id })}>
                  {g.name}
                </button>
                <span className="muted small"> · not today</span>
              </div>
            )}
            {g.visibility !== 'private' && <span className="muted small goal-privacy">{PRIVACY_ICON[g.visibility]}</span>}
          </div>
        ))}
      </div>
      {active.length === 0 && <p className="muted">No goals yet. Try "Walk the dogs" (check) or "Water" (tally, 8 a day).</p>}
      {archived.length > 0 && (
        <>
          <button type="button" className="link small" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide' : 'Show'} {archived.length} archived
          </button>
          {showArchived && (
            <ul>
              {archived.map((g) => (
                <li key={g.id}>
                  <button type="button" className="link" onClick={() => navigate({ view: 'goal', goalId: g.id })}>
                    {g.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {creating && <GoalEditor goal={null} onClose={() => setCreating(false)} />}
    </section>
  )
}
