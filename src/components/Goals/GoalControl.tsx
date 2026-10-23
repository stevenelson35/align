import { useState } from 'react'
import { today } from '../../engine/dates'
import { addToTotal, logGoal } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import type { Goal, GoalEntry } from '../../types'
import { accumulates, amount, goalHint, goalStatus, met, suggested } from '../../utils/goals'
import { canLogGoal } from '../../utils/tasks'
import { GoalSparkline } from './GoalSparkline'
import { GoalTimer } from './GoalTimer'
import { Icon } from '../UI/Icon'

/**
 * Log one goal for one day, in as few taps as possible: a checkbox (check), one tap per time (tally), one tap for
 * "did the suggestion" or type the amount (progressive), type the measurement (measure), or add an amount (total).
 * People who can only view see the same thing, read-only.
 */
export function GoalControl({ goal, day, showName = true, who }: { goal: Goal; day: string; showName?: boolean; /** Who else logs it, e.g. "with Sam". */ who?: string }) {
  const { uid, member, navigate } = useApp()
  const [error, setError] = useState<string | null>(null)
  const entry = goal.log?.[day]
  const editable = canLogGoal(goal, uid, member.role) && day <= today()
  const save = (e: GoalEntry) => logGoal(goal.id, day, e, uid).catch((err) => setError(err instanceof Error ? err.message : String(err)))
  const done = met(goal, entry, day)
  const hint = goalHint(goal, day)
  const status = goalStatus(goal, entry, day)
  // Where the day stands ("4 to go", "Done", "+3 extra", "0.8 lb ahead"); nothing until something is logged.
  const badge = status.text && (
    <span className={`goal-status status-${status.state}`}>
      {(status.state === 'met' || status.state === 'exceeded') && <Icon name="check" />} {status.text}
    </span>
  )

  // The trend at a glance (rows only; the goal's own page has the full chart). Tap for the chart.
  const spark = showName && (
    <button type="button" className="spark-button" onClick={() => navigate({ view: 'goal', goalId: goal.id })} aria-label={`${goal.name}: see the chart`}>
      <GoalSparkline goal={goal} />
    </button>
  )
  const name = showName && (
    <button type="button" className="goal-name link" onClick={() => navigate({ view: 'goal', goalId: goal.id })} title="See this goal's history">
      {goal.name}
      {who && <span className="muted small goal-who"> ({who})</span>}
    </button>
  )

  return (
    <div className={`goal-control kind-${goal.kind}${done ? ' met' : ''}`}>
      {goal.kind === 'check' ? (
        <div className="goal-head">
          <label className="inline goal-check">
            <input type="checkbox" checked={!!entry?.done} disabled={!editable} onChange={(e) => save({ done: e.target.checked || undefined })} />
            {name || <span>Done</span>}
          </label>
          {badge}
          {spark}
        </div>
      ) : (
        <div className="goal-head">
          {name}
          {hint && <span className="muted small">{hint}</span>}
          {badge}
          {spark}
        </div>
      )}
      {goal.kind === 'tally' && <Tally goal={goal} count={entry?.count ?? 0} editable={editable} onSet={(count) => save({ count: count || undefined })} />}
      {(goal.kind === 'progressive' || goal.kind === 'measure') && (
        <Amount
          key={`${day}:${entry?.value ?? ''}`}
          value={entry?.value}
          unit={goal.unit}
          editable={editable}
          quick={goal.kind === 'progressive' ? suggested(goal, day) : undefined}
          onSave={(value) => save({ value })}
          timerGoalId={goal.timer ? goal.id : undefined}
          accumulate={accumulates(goal)}
        />
      )}
      {goal.kind === 'total' && editable && (
        <AddAmount
          added={entry?.value}
          unit={goal.unit}
          timerGoalId={goal.timer ? goal.id : undefined}
          onAdd={(n) => addToTotal(goal.id, day, n, uid).catch((err) => setError(err instanceof Error ? err.message : String(err)))}
        />
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  )
}

/** Running total: type an amount and Add (a minus amount takes some back). Several people can add on one day. */
function AddAmount({ added, unit, onAdd, timerGoalId }: { added?: number; unit?: string; onAdd: (n: number) => void; timerGoalId?: string }) {
  const [text, setText] = useState('')
  const n = Number(text)
  const add = () => {
    if (text.trim() && Number.isFinite(n) && n !== 0) {
      onAdd(n)
      setText('')
    }
  }
  return (
    <>
      <div className="row goal-amount">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={text}
          placeholder="Amount"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          aria-label="Amount to add"
        />
        {unit && <span className="muted small">{unit}</span>}
        <button type="button" className="small" onClick={add} disabled={!text.trim() || !Number.isFinite(n) || n === 0}>
          Add
        </button>
        {!!added && <span className="muted small">+{amount(added, unit)} this day</span>}
      </div>
      {timerGoalId && (
        <GoalTimer goalId={timerGoalId} unit={unit} onAdd={onAdd} />
      )}
    </>
  )
}

/** One dot per time; tap the next empty dot to add one, tap the last filled dot to take one back. */
function Tally({ goal, count, editable, onSet }: { goal: Goal; count: number; editable: boolean; onSet: (n: number) => void }) {
  const perDay = Math.max(1, goal.perDay ?? 1)
  if (perDay > 12) {
    return (
      <div className="row tally-count">
        <button type="button" className="secondary small" disabled={!editable || count === 0} onClick={() => onSet(count - 1)} aria-label="One less">
          −
        </button>
        <span>
          {count} / {perDay}
        </span>
        <button type="button" className="small" disabled={!editable} onClick={() => onSet(count + 1)} aria-label="One more">
          +
        </button>
      </div>
    )
  }
  return (
    <div className="tally" role="group" aria-label={`${goal.name}: ${count} of ${perDay}`}>
      {Array.from({ length: perDay }, (_, i) => (
        <button
          key={i}
          type="button"
          className={`tally-dot${i < count ? ' on' : ''}`}
          disabled={!editable}
          onClick={() => onSet(i + 1 === count ? i : i + 1)}
          aria-label={i < count ? `Take back number ${i + 1}` : `Mark number ${i + 1}`}
          title={i < count ? 'Tap the last one to take it back' : 'Tap each time'}
        />
      ))}
      {count >= perDay && (
        <button type="button" className="link small" disabled={!editable} onClick={() => onSet(count + 1)} title="Did more than the goal">
          +1 {count > perDay && `(${count})`}
        </button>
      )}
    </div>
  )
}

/** Type an amount (saved on Enter or leaving the box); for progressive goals, one tap logs the suggestion. */
function Amount({
  value,
  unit,
  editable,
  quick,
  onSave,
  timerGoalId,
  accumulate = false,
}: {
  value?: number
  unit?: string
  editable: boolean
  quick?: number
  onSave: (v: number | undefined) => void
  /** Show the goal's timer; its Add adds the timed amount to the day's value (several walks add up). */
  timerGoalId?: string
  /** Reps, minutes: offer "+ more" (adds to the day's amount) and Reset. */
  accumulate?: boolean
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  const [more, setMore] = useState('')
  const addMore = () => {
    const n = Number(more)
    if (!more.trim() || !Number.isFinite(n) || n === 0) return
    onSave(Math.round(((value ?? 0) + n) * 100) / 100)
    setMore('')
  }
  const commit = () => {
    const t = text.trim()
    const n = Number(t)
    if (t === '') {
      if (value !== undefined) onSave(undefined)
    } else if (Number.isFinite(n) && n !== value) onSave(n)
  }
  return (
    <>
      <div className="row goal-amount">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={text}
          disabled={!editable}
          placeholder={quick !== undefined ? String(quick) : '—'}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          aria-label="Amount"
        />
        {unit && <span className="muted small">{unit}</span>}
        {quick !== undefined && value === undefined && editable && (
          <button type="button" className="secondary small" onClick={() => onSave(quick)} title="Log the suggested amount">
            ✓ {quick}
          </button>
        )}
      </div>
      {accumulate && editable && value !== undefined && (
        <div className="row goal-more">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={more}
            placeholder="+ more"
            onChange={(e) => setMore(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMore()}
            aria-label="Add more to today's amount"
          />
          <button type="button" className="icon-button" onClick={addMore} disabled={!more.trim()} aria-label="Add to today's amount" title="Add to today's amount">
            <Icon name="plus" />
          </button>
          <button type="button" className="link small" onClick={() => window.confirm('Clear today’s amount?') && onSave(undefined)} title="Clear today's amount">
            Reset
          </button>
        </div>
      )}
      {timerGoalId && (
        <GoalTimer goalId={timerGoalId} unit={unit} disabled={!editable} onAdd={(v) => onSave(Math.round(((value ?? 0) + v) * 100) / 100)} />
      )}
    </>
  )
}
