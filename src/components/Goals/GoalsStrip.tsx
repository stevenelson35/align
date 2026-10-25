import { useState } from 'react'
import { today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { useDailyFlag } from '../../hooks/useDailyFlag'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import type { Goal } from '../../types'
import { appliesOn, goalDaysText, goalGroups, goalHint, goalStatus, met, otherLoggers } from '../../utils/goals'
import { canLogGoal } from '../../utils/tasks'
import { GoalControl } from './GoalControl'
import { SectionHeader } from '../UI/SectionHeader'
import { Icon } from '../UI/Icon'
import { GoalSparkline } from './GoalSparkline'

/**
 * The day's goals you can log, at the top of a day view. It starts as a summary (each goal's status and trend, like
 * the wall display); the pencil on a goal opens logging for that one, and "Log all" shows every goal's controls
 * (remembered on this device). Hidden each morning (Show opens them for the day).
 */
export function GoalsStrip({ day }: { day: string }) {
  const { navigate, uid, member, household } = useApp()
  const { goals } = useData()
  const [hidden, setHidden] = useDailyFlag('align-goals-hidden', true)
  const [logAll, setLogAll] = useStoredFlag('align-goals-log-all', false)
  const [logging, setLogging] = useState<Set<string>>(new Set())
  const toggleOne = (id: string) => {
    const next = new Set(logging)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setLogging(next)
  }
  // Only the goals you log; ones you can just view are on the Goals page.
  // Your own goals first, then shared ones (with who else logs them), like the Goals page.
  const yours = goalGroups(goals, uid, member.role, household)
    .filter((group) => group.key === 'mine' || group.key === 'shared')
    .flatMap((group) => group.goals)
    .filter((g) => !g.archived && canLogGoal(g, uid, member.role))
  const forDay = yours.filter((g) => appliesOn(g, day))
  // Goals that skip this day (Walking on weekdays only) stay listed, greyed, so they don't seem to have vanished.
  const offDay = yours.filter((g) => !appliesOn(g, day))
  if (!yours.length) return null
  const metCount = forDay.filter((g) => met(g, g.log?.[day], day)).length
  return (
    <div className="day-section goals-strip">
      <SectionHeader icon="goal" title="Goals" count={`${metCount}/${forDay.length}`} onTitleClick={() => setHidden(!hidden)} expanded={!hidden} help="goals">
        {!hidden && forDay.length > 0 && (
          <button type="button" className="link small" onClick={() => setLogAll(!logAll)} aria-pressed={logAll} aria-label={logAll ? 'Summary' : 'Log all'} title={logAll ? 'Back to the summary' : 'Show every goal ready to log'}>
            <Icon name={logAll ? 'list' : 'edit'} /> <span className="hide-mobile">{logAll ? 'Summary' : 'Log all'}</span>
          </button>
        )}
        <button type="button" className="link small" onClick={() => navigate({ view: 'goals' })}>
          Manage
        </button>
        <button type="button" className="link small" onClick={() => setHidden(!hidden)} aria-expanded={!hidden}>
          {hidden ? 'Show' : 'Hide'}
        </button>
      </SectionHeader>
      {!hidden && (
        <>
          {day > today() && <p className="muted small">Log goals on the day.</p>}
          <div className="goal-list">
            {forDay.map((g) =>
              logAll ? (
                <GoalControl key={g.id} goal={g} day={day} who={otherLoggers(g, household, uid) || undefined} />
              ) : (
                <GoalSummary key={g.id} goal={g} day={day} open={logging.has(g.id)} onToggle={() => toggleOne(g.id)} who={otherLoggers(g, household, uid) || undefined} />
              ),
            )}
            {offDay.map((g) => (
              <div key={g.id} className="goal-control off-day">
                <div className="goal-head">
                  <button type="button" className="goal-name link" onClick={() => navigate({ view: 'goal', goalId: g.id })} title="See this goal's history">
                    {g.name}
                  </button>
                  <span className="muted small">Not today · {goalDaysText(g)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** One goal as a summary line: name, where it stands (or what it asks), the trend, and a pencil to log just this one. */
function GoalSummary({ goal, day, open, onToggle, who }: { goal: Goal; day: string; open: boolean; onToggle: () => void; who?: string }) {
  const { navigate } = useApp()
  const status = goalStatus(goal, goal.log?.[day], day)
  const hint = goalHint(goal, day)
  if (open)
    return (
      <div className="goal-summary-open">
        <GoalControl goal={goal} day={day} who={who} />
        <button type="button" className="link small" onClick={onToggle} aria-label={`Close logging for ${goal.name}`}>
          <Icon name="check" /> Done
        </button>
      </div>
    )
  return (
    <div className={`goal-summary${status.state === 'met' || status.state === 'exceeded' ? ' met' : ''}`}>
      <button type="button" className="goal-name link" onClick={() => navigate({ view: 'goal', goalId: goal.id })} title="See this goal's history">
        {goal.name}
        {who && <span className="muted small goal-who"> ({who})</span>}
      </button>
      {status.text ? (
        <span className={`goal-status status-${status.state}`}>
          {(status.state === 'met' || status.state === 'exceeded') && <Icon name="check" />} {status.text}
        </span>
      ) : (
        <span className="muted small">{hint || 'Not done yet'}</span>
      )}
      <span className="grow" />
      <button type="button" className="spark-button" onClick={() => navigate({ view: 'goal', goalId: goal.id })} aria-label={`${goal.name}: see the chart`}>
        <GoalSparkline goal={goal} />
      </button>
      <button type="button" className="icon-button small goal-log-one" onClick={onToggle} title={`Log ${goal.name}`} aria-label={`Log ${goal.name}`}>
        <Icon name="edit" />
      </button>
    </div>
  )
}
