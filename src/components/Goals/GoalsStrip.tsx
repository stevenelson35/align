import { useState } from 'react'
import { addDays, today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { useDailyFlag } from '../../hooks/useDailyFlag'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import type { Goal } from '../../types'
import { appliesOn, goalDaysText, goalGroups, goalHint, goalStatus, loggableGoals, met, otherLoggers } from '../../utils/goals'
import { GoalControl } from './GoalControl'
import { SectionHeader } from '../UI/SectionHeader'
import { Icon } from '../UI/Icon'
import { GoalSparkline } from './GoalSparkline'
import { useTodaySelect } from '../../hooks/useTodaySection'

/**
 * The day's goals you can log, at the top of a day view. It starts as a summary (each goal's status and trend, like
 * the wall display); the pencil on a goal opens logging for that one, and "Log all" shows every goal's controls
 * (remembered on this device). Hidden each morning (Show opens them for the day).
 */
export function GoalsStrip({ day }: { day: string }) {
  const { navigate, uid, member, household } = useApp()
  const { goals } = useData()
  const [hidden, saveHidden] = useDailyFlag('align-goals-hidden', true)
  const [logAll, saveLogAll] = useStoredFlag('align-goals-log-all', false)
  // Optionally, everyone else's goals for the day below yours (view only: no pencil).
  const [showFamily, saveShowFamily] = useStoredFlag('align-goals-family', false)
  const [logging, setLogging] = useState<Set<string>>(new Set())
  const select = useTodaySelect(() => {
    saveLogAll(false)
    saveShowFamily(false)
    setLogging(new Set())
  })
  const setHidden = (next: boolean) => {
    if (!next) select()
    saveHidden(next)
  }
  const setLogAll = (next: boolean) => {
    if (next) select()
    saveLogAll(next)
  }
  const setShowFamily = (next: boolean) => {
    if (next) select()
    saveShowFamily(next)
  }
  const toggleOne = (id: string) => {
    const next = new Set(logging)
    if (next.has(id)) next.delete(id)
    else { select(); next.add(id) }
    setLogging(next)
  }
  // Only the goals you log (yours first, then shared ones); ones you can just view are on the Goals page. Goals that
  // skip this day (Walking on weekdays only) stay listed, greyed, so they don't seem to have vanished.
  const { forDay, offDay } = loggableGoals(goals, uid, member.role, household, day)
  if (!forDay.length && !offDay.length) return null
  const metCount = forDay.filter((g) => met(g, g.log?.[day], day)).length
  const allDone = forDay.length > 0 && metCount === forDay.length
  const family = goalGroups(goals, uid, member.role, household)
    .filter((g) => g.key.startsWith('of:'))
    .map((g) => ({ ...g, goals: g.goals.filter((x) => appliesOn(x, day)) }))
    .filter((g) => g.goals.length)
  return (
    <div className={`day-section goals-strip${allDone && day === today() ? ' all-done' : ''}`}>
      <SectionHeader icon="goal" title="Goals" count={forDay.length ? `${metCount}/${forDay.length}` : 'none today'} onTitleClick={() => setHidden(!hidden)} expanded={!hidden} help="goals">
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
      {(!hidden || !forDay.length) && (
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
                  <span className="muted small">{nextOn(g, day)}</span>
                </div>
              </div>
            ))}
          </div>
          {family.length > 0 && (
            <>
              <button type="button" className="link small goals-family-toggle" onClick={() => setShowFamily(!showFamily)} aria-expanded={showFamily}>
                {showFamily ? 'Hide the family’s goals' : `Show the family’s goals (${family.map((g) => g.title.replace(/’s goals$|'s goals$/, '')).join(', ')})`}
              </button>
              {showFamily &&
                family.map((g) => (
                  <div key={g.key} className="goals-family">
                    <h4 className="goals-family-title small">{g.title}</h4>
                    <div className="goal-list">
                      {g.goals.map((x) => (
                        <GoalSummary key={x.id} goal={x} day={day} open={false} onToggle={() => {}} readOnly />
                      ))}
                    </div>
                  </div>
                ))}
            </>
          )}
        </>
      )}
    </div>
  )
}

/** "Next on Monday · Weekdays" for a goal that isn't on this day. */
function nextOn(goal: Goal, day: string): string {
  for (let k = 1; k <= 7; k++) {
    const d = addDays(day, k)
    if (appliesOn(goal, d)) return `${k === 1 ? 'Tomorrow' : `Next on ${new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'long' })}`} · ${goalDaysText(goal)}`
  }
  return `Not today · ${goalDaysText(goal)}`
}

/** One goal as a summary line: name, where it stands (or what it asks), the trend, and a pencil to log just this one. */
function GoalSummary({ goal, day, open, onToggle, who, readOnly = false }: { goal: Goal; day: string; open: boolean; onToggle: () => void; who?: string; /** Someone else's goal: no pencil. */ readOnly?: boolean }) {
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
    <div className={`goal-summary${status.state === 'met' || status.state === 'exceeded' ? ' met' : ''}${readOnly ? ' read-only' : ''}`} data-goal-id={readOnly ? undefined : goal.id}>
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
      {!readOnly && (
        <button type="button" className="icon-button small goal-log-one" onClick={onToggle} title={`Log ${goal.name}`} aria-label={`Log ${goal.name}`}>
          <Icon name="edit" />
        </button>
      )}
    </div>
  )
}
