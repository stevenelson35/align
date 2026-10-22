import { useState } from 'react'
import { addDays, formatDay, today } from '../../engine/dates'
import { commentThread, deleteRemovedImages, logGoal, updateGoal } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import type { Goal } from '../../types'
import { appliesOn, goalHint, history, totalTo } from '../../utils/goals'
import { canLogGoal, privacyText, sharedNames } from '../../utils/tasks'
import { cleanDetails, detailsOf, hasDetails, storedDetails } from '../../utils/details'
import { DetailsFields, DetailsView } from '../UI/Details'
import { Icon } from '../UI/Icon'
import { EntryExtras } from '../UI/EntryExtras'
import { goalLink } from '../../utils/text'
import { GoalChart } from './GoalChart'
import { GoalControl } from './GoalControl'
import { GoalEditor } from './GoalEditor'
import { HelpTip } from '../UI/HelpTip'

const RANGES = [14, 30, 90, 365]

/**
 * One goal: log today (or another day) with an optional note / link / picture, its chart, a table of every day, and
 * (for its owner) edit / archive. People who can only view see the same page without the log box.
 */
export function GoalDetail({ goal }: { goal: Goal }) {
  const app = useApp()
  const [editing, setEditing] = useState(false)
  const [days, setDays] = useState(30)
  const [showTable, setShowTable] = useState(false)
  const [logDay, setLogDay] = useState(today())
  // Settings (and archiving) are the owner's; logging follows "who can log" (the rules say the same).
  const editable = app.isMember && goal.ownerId === app.uid
  const canLog = canLogGoal(goal, app.uid, app.member.role)
  const rows = history(goal, addDays(today(), -(days - 1)), today()).reverse()
  const value = (r: (typeof rows)[number]) =>
    goal.kind === 'check' ? (r.entry?.done ? '✓' : '') : goal.kind === 'tally' ? String(r.entry?.count ?? '') : String(r.entry?.value ?? '')
  const owner = goal.ownerId === app.uid ? 'you' : (app.household.members[goal.ownerId]?.displayName ?? 'the owner')
  const loggers =
    goal.editAudience === undefined
      ? null
      : goal.editAudience === 'private'
        ? `only ${owner}`
        : goal.editAudience === 'parents' || goal.editAudience === 'shared'
          ? sharedNames(goal.editors ?? [goal.ownerId], app.household, app.uid)
          : 'every household member'

  return (
    <section>
      <header className="view-header">
        <button type="button" className="link small" onClick={() => app.navigate({ view: 'goals' })}>
          ← Goals
        </button>
        <h2>{goal.name}</h2>
        <HelpTip topic="goals" />
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
        {privacyText(goal, 'goal', app.household, app.uid)}
        {loggers && ` Who can log it: ${loggers}.`}
      </p>

      {!goal.archived && canLog && (
        <div className="goal-log card">
          <div className="row">
            <strong className="grow">Log</strong>
            <input type="date" value={logDay} max={today()} onChange={(e) => setLogDay(e.target.value || today())} aria-label="Day to log" />
          </div>
          {appliesOn(goal, logDay) ? <GoalControl goal={goal} day={logDay} showName={false} /> : <p className="muted small">This goal isn't on for {formatDay(logDay)}.</p>}
          {appliesOn(goal, logDay) && <EntryDetails key={logDay} goal={goal} day={logDay} />}
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
              <th>{goal.kind === 'check' ? 'Done' : goal.kind === 'tally' ? `Times (goal ${goal.perDay ?? 1})` : goal.kind === 'progressive' ? 'Did' : goal.kind === 'total' ? 'Added' : 'Measured'}</th>
              {goal.kind === 'total' && <th>Total</th>}
              {(goal.kind === 'progressive' || goal.kind === 'measure') && <th>{goal.kind === 'progressive' ? 'Suggested' : 'Target'}</th>}
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day}>
                <td>{formatDay(r.day)}</td>
                <td>{value(r)}</td>
                {goal.kind === 'total' && <td>{r.entry?.value !== undefined ? totalTo(goal, r.day) : ''}</td>}
                {(goal.kind === 'progressive' || goal.kind === 'measure') && <td>{r.suggested ?? ''}</td>}
                <td>
                  {hasDetails(r.entry) && (
                    <button type="button" className="link small" onClick={() => setLogDay(r.day)} title={r.entry?.note ?? 'Show the details'}>
                      {r.entry?.note && <Icon name="note" label="Note" />}
                      {detailsOf(r.entry ?? {}).links.length > 0 && <Icon name="link" label="Links" />}
                      {detailsOf(r.entry ?? {}).images.length > 0 && <Icon name="photo" label="Pictures" />}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!canLog && rows.some((r) => hasDetails(r.entry)) && (
        <div className="goal-notes">
          <h3>Notes and pictures</h3>
          {rows
            .filter((r) => hasDetails(r.entry))
            .map((r) => (
              <div key={r.day} className="card">
                <strong className="small">{formatDay(r.day)}</strong>
                <DetailsView {...detailsOf(r.entry ?? {})} alt={`${goal.name}, ${formatDay(r.day)}`} />
              </div>
            ))}
        </div>
      )}
      <EntryExtras details={{}} alt={goal.name} thread={commentThread.goal(goal.id)} text={{ title: goal.name, when: goalHint(goal, today()), link: goalLink(goal.id) }} />
      {editing && <GoalEditor goal={goal} onClose={() => setEditing(false)} />}
    </section>
  )
}

/** The day's note, link and picture: shown under the log box, with Add / Edit. */
function EntryDetails({ goal, day }: { goal: Goal; day: string }) {
  const { uid } = useApp()
  const entry = goal.log?.[day]
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(detailsOf(entry ?? {}))
  const [error, setError] = useState<string | null>(null)

  function save() {
    const d = cleanDetails(form)
    if (typeof d === 'string') return setError(d)
    setError(null)
    logGoal(goal.id, day, { note: d.note || undefined, ...storedDetails(d) }, uid)
      .then(() => {
        setEditing(false)
        return deleteRemovedImages(detailsOf(entry ?? {}).images, d.images)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }

  if (!editing) {
    return (
      <div className="entry-details">
        <DetailsView {...detailsOf(entry ?? {})} alt={`${goal.name}, ${formatDay(day)}`} />
        <button type="button" className="link small" onClick={() => setEditing(true)} disabled={day > today()}>
          <Icon name="note" /> {hasDetails(entry) ? 'Edit note, links or pictures' : 'Add a note, links or pictures'}
        </button>
      </div>
    )
  }
  return (
    <div className="entry-details form">
      <DetailsFields value={form} onChange={setForm} onError={setError} />
      {error && <p className="error small">{error}</p>}
      <div className="row">
        <button type="button" className="small" onClick={save}>
          Save
        </button>
        <button type="button" className="secondary small" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
