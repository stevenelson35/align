import { useState } from 'react'
import { addDays, formatDay, today } from '../../engine/dates'
import { updateGoal } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import type { Goal } from '../../types'
import { appliesOn, goalHint, history } from '../../utils/goals'
import { privacyText } from '../../utils/tasks'
import { GoalChart } from './GoalChart'
import { GoalControl } from './GoalControl'
import { GoalEditor } from './GoalEditor'

const RANGES = [14, 30, 90, 365]

/** One goal: log today (or another day), its chart, a table of every day, and edit / archive. */
export function GoalDetail({ goal }: { goal: Goal }) {
  const app = useApp()
  const [editing, setEditing] = useState(false)
  const [days, setDays] = useState(30)
  const [showTable, setShowTable] = useState(false)
  const [logDay, setLogDay] = useState(today())
  const editable = app.canEdit(goal)
  const rows = history(goal, addDays(today(), -(days - 1)), today()).reverse()
  const value = (r: (typeof rows)[number]) =>
    goal.kind === 'check' ? (r.entry?.done ? '✓' : '') : goal.kind === 'tally' ? String(r.entry?.count ?? '') : String(r.entry?.value ?? '')

  return (
    <section>
      <header className="view-header">
        <button type="button" className="link small" onClick={() => app.navigate({ view: 'goals' })}>
          ← Goals
        </button>
        <h2>{goal.name}</h2>
        {goal.archived && <span className="badge">Archived</span>}
        <span className="grow" />
        {editable && (
          <>
            <button type="button" className="secondary small" onClick={() => updateGoal(goal, { archived: goal.archived ? undefined : true })}>
              {goal.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button type="button" className="secondary small" onClick={() => setEditing(true)}>
              Edit goal
            </button>
          </>
        )}
      </header>
      <p className="muted small">
        {goalHint(goal, today())}
        {goalHint(goal, today()) && ' · '}
        {goal.weekdays?.length ? `On ${goal.weekdays.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}` : 'Every day'} ·{' '}
        {privacyText(goal, 'goal', app.household, app.uid).replace(/^\S+ /, '')}
      </p>

      {!goal.archived && (
        <div className="goal-log card">
          <div className="row">
            <strong className="grow">Log</strong>
            <input type="date" value={logDay} max={today()} onChange={(e) => setLogDay(e.target.value || today())} aria-label="Day to log" />
          </div>
          {appliesOn(goal, logDay) ? <GoalControl goal={goal} day={logDay} showName={false} /> : <p className="muted small">This goal isn't on for {formatDay(logDay)}.</p>}
        </div>
      )}

      <div className="row chart-range" role="group" aria-label="Range">
        {RANGES.map((r) => (
          <button key={r} type="button" className={`small ${r === days ? '' : 'secondary'}`} aria-pressed={r === days} onClick={() => setDays(r)}>
            {r === 365 ? '1 year' : `${r} days`}
          </button>
        ))}
        <span className="grow" />
        <button type="button" className="link small" onClick={() => setShowTable(!showTable)}>
          {showTable ? 'Hide table' : 'Show table'}
        </button>
      </div>
      <GoalChart goal={goal} days={days} />
      {showTable && (
        <table className="goal-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>{goal.kind === 'check' ? 'Done' : goal.kind === 'tally' ? `Times (goal ${goal.perDay ?? 1})` : goal.kind === 'progressive' ? 'Did' : 'Measured'}</th>
              {(goal.kind === 'progressive' || goal.kind === 'measure') && <th>{goal.kind === 'progressive' ? 'Suggested' : 'Target'}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day}>
                <td>{formatDay(r.day)}</td>
                <td>{value(r)}</td>
                {(goal.kind === 'progressive' || goal.kind === 'measure') && <td>{r.suggested ?? ''}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && <GoalEditor goal={goal} onClose={() => setEditing(false)} />}
    </section>
  )
}
