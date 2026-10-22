import { useState } from 'react'
import { today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { AUDIENCE_ICON, audienceLabel, audienceOf } from '../../utils/audience'
import { appliesOn, goalGroups, met, otherLoggers } from '../../utils/goals'
import { Icon } from '../UI/Icon'
import { GoalControl } from './GoalControl'
import { GoalEditor } from './GoalEditor'
import { HelpTip } from '../UI/HelpTip'

/** Every goal: log today's from here, open one for its chart, or add a new one. */
export function GoalsView() {
  const { isMember, navigate, uid, member, household } = useApp()
  const { goals } = useData()
  const [creating, setCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const day = today()
  const active = goals.filter((g) => !g.archived)
  const archived = goals.filter((g) => g.archived)
  const groups = goalGroups(goals, uid, member.role, household)
  return (
    <section>
      <header className="view-header">
        <h2>Goals</h2>
        <HelpTip topic="goals" />
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
      <p className="muted small">Goals you log show on each day they apply. Tap a name for its chart, history and notes.</p>
      {groups.map((group) => (
        <div key={group.key} className="goal-group">
          <h3>{group.title}</h3>
          <div className="goal-list">
            {group.goals.map((g) => (
              <div key={g.id} className="goal-row">
                {appliesOn(g, day) ? (
                  <GoalControl goal={g} day={day} who={group.key === 'shared' ? otherLoggers(g, household, uid) : undefined} />
                ) : (
                  <div className="goal-control">
                    <button type="button" className="goal-name link" onClick={() => navigate({ view: 'goal', goalId: g.id })}>
                      {g.name}
                    </button>
                    <span className="muted small"> · not today</span>
                  </div>
                )}
                <span className="muted small goal-privacy" title={`Who can view: ${audienceLabel(audienceOf(g))}`}>
                  <Icon name={AUDIENCE_ICON[audienceOf(g)]} label={`Visible to: ${audienceLabel(audienceOf(g))}`} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
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
