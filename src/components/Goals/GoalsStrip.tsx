import { useState, type FormEvent } from 'react'
import { createGoal, logGoal } from '../../firebase/db'
import { useStoredSet } from '../../hooks/useStoredSet'
import { canLogGoal } from '../../utils/tasks'
import { addDays, today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { useDailyFlag } from '../../hooks/useDailyFlag'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import type { Goal } from '../../types'
import { appliesOn, goalDaysText, goalGroups, goalHint, goalStatus, loggableGoals, met, otherLoggers } from '../../utils/goals'
import { GoalControl } from './GoalControl'
import { SectionHeader } from '../UI/SectionHeader'
import { GoalEditor } from './GoalEditor'
import { Icon } from '../UI/Icon'
import { GoalSparkline } from './GoalSparkline'
import { useTodaySelect } from '../../hooks/useTodaySection'

/**
 * The day's goals you can log, at the top of a day view. It starts as a summary (each goal's status and trend, like
 * the wall display); tapping a goal (its name, trend or pencil) opens logging for that one in place, and "Log all" shows every goal's controls
 * (remembered on this device). Hidden each morning (Show opens them for the day).
 */
export function GoalsStrip({ day }: { day: string }) {
  const { navigate, uid, member, household } = useApp()
  const [creating, setCreating] = useState<string | null>(null)
  const [quick, setQuick] = useState(false)
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
  // No goals of your own: members still get the heading, to add one.
  if (!forDay.length && !offDay.length && member.role !== 'member') return null
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
        {member.role === 'member' && (
          <button
            type="button"
            className="link small header-add"
            onClick={() => {
              setHidden(false)
              setQuick(!quick)
            }}
            aria-expanded={quick}
            title="New goal"
            aria-label="New goal"
          >
            <Icon name="plus" />
          </button>
        )}
        <button type="button" className="link small" onClick={() => navigate({ view: 'goals' })}>
          Manage
        </button>
        <button type="button" className="link small" onClick={() => setHidden(!hidden)} aria-expanded={!hidden}>
          {hidden ? 'Show' : 'Hide'}
        </button>
      </SectionHeader>
      {quick && <QuickGoal onDone={() => setQuick(false)} onMore={(name) => { setQuick(false); setCreating(name) }} />}
      {(!hidden || !forDay.length) && (forDay.length > 0 || offDay.length > 0 || family.length > 0) && (
        <div className="section-content">
          {day > today() && <p className="muted small">Log goals on the day.</p>}
          <div className="goal-list">
            {forDay.map((g) =>
              logAll ? (
                <GoalControl key={g.id} goal={g} day={day} who={otherLoggers(g, household, uid) || undefined} onName={() => setLogAll(false)} />
              ) : (
                <GoalSummary key={g.id} goal={g} day={day} open={logging.has(g.id)} onToggle={() => toggleOne(g.id)} who={otherLoggers(g, household, uid) || undefined} />
              ),
            )}
            {offDay.map((g) => (
              <div key={g.id} className="goal-control off-day">
                <div className="goal-head">
                  <span className="goal-name">{g.name}</span>
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
              {showFamily && <FamilyGoals groups={family} day={day} />}
            </>
          )}
        </div>
      )}
      {creating !== null && <GoalEditor goal={null} name={creating} onClose={() => setCreating(null)} />}
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

/**
 * One goal as a summary line: a tick (done or not) or +1 (tallies) to log it in one tap, the name, where it stands (or
 * what it asks), the trend, and (other kinds) a pencil. Tapping the name, the trend or the pencil opens logging for
 * just this one, in place (notes, undoing a +1); Manage (above) is the way to a goal's own page.
 */
function GoalSummary({ goal, day, open, onToggle, who, readOnly = false }: { goal: Goal; day: string; open: boolean; onToggle: () => void; who?: string; /** Someone else's goal: no pencil. */ readOnly?: boolean }) {
  const { uid, member } = useApp()
  const status = goalStatus(goal, goal.log?.[day], day)
  const hint = goalHint(goal, day)
  const entry = goal.log?.[day]
  // One tap, right on the line: tick a done-or-not goal, or +1 on a tally. (Other kinds open to log.)
  const quickLog = !readOnly && !open && day <= today() && canLogGoal(goal, uid, member.role) && (goal.kind === 'check' || goal.kind === 'tally')
  const tick = () => void logGoal(goal.id, day, goal.kind === 'check' ? { done: entry?.done ? undefined : true } : { count: (entry?.count ?? 0) + 1 }, uid).catch(() => undefined)
  if (open)
    return (
      <div className="goal-summary-open">
        <GoalControl goal={goal} day={day} who={who} onName={onToggle} />
        <button type="button" className="link small" onClick={onToggle} aria-label={`Close logging for ${goal.name}`}>
          <Icon name="check" /> Done
        </button>
      </div>
    )
  return (
    <div className={`goal-summary${status.state === 'met' || status.state === 'exceeded' ? ' met' : ''}${readOnly ? ' read-only' : ''}`} data-goal-id={readOnly ? undefined : goal.id}>
      {quickLog &&
        (goal.kind === 'check' ? (
          <button type="button" className={`goal-tick${entry?.done ? ' on' : ''}`} onClick={tick} aria-pressed={!!entry?.done} aria-label={entry?.done ? `Undo ${goal.name}` : `Done: ${goal.name}`} title={entry?.done ? 'Done (tap to undo)' : 'Tap when done'}>
            <Icon name="check" />
          </button>
        ) : (
          <button type="button" className="goal-plus-one small" onClick={tick} aria-label={`One more: ${goal.name}`} title="One more">
            +1
          </button>
        ))}
      {readOnly ? (
        <span className="goal-name">{goal.name}</span>
      ) : (
        <button type="button" className="goal-name link" onClick={onToggle} title={`Log ${goal.name}`} aria-expanded={false}>
          {goal.name}
          {who && <span className="muted small goal-who"> ({who})</span>}
        </button>
      )}
      {status.text ? (
        <span className={`goal-status status-${status.state}`}>
          {(status.state === 'met' || status.state === 'exceeded') && <Icon name="check" />} {status.text}
        </span>
      ) : (
        <span className="muted small">{hint || 'Not done yet'}</span>
      )}
      <span className="grow" />
      {readOnly ? (
        <GoalSparkline goal={goal} />
      ) : (
        <button type="button" className="spark-button" onClick={onToggle} aria-label={`Log ${goal.name}`}>
          <GoalSparkline goal={goal} />
        </button>
      )}
      {!readOnly && !quickLog && (
        <button type="button" className="icon-button small goal-log-one" onClick={onToggle} title={`Log ${goal.name}`} aria-label={`Log ${goal.name}`}>
          <Icon name="edit" />
        </button>
      )}
    </div>
  )
}

/**
 * Add a goal in one line: its name and what kind, in plain words (done or not each day, or a number of times a day).
 * Everyone can see it and only you log it, every day; More options opens the full form (other kinds, days, who logs).
 */
function QuickGoal({ onDone, onMore }: { onDone: () => void; onMore: (name: string) => void }) {
  const { uid } = useApp()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'check' | 'tally'>('check')
  const [times, setTimes] = useState('8')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createGoal(
        { name: name.trim().slice(0, 100), kind, ...(kind === 'tally' ? { perDay: Math.max(1, Math.min(99, Math.round(Number(times) || 1))) } : {}), visibility: 'family', viewerVisible: true, ownerId: uid, editAudience: 'private' },
        uid,
      )
      setName('')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setBusy(false)
  }
  return (
    <form className="quick-goal" onSubmit={add}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New goal (e.g. Walk the dogs)" aria-label="New goal" autoFocus maxLength={100} />
      <div className="quick-goal-kind" role="radiogroup" aria-label="What kind">
        <label>
          <input type="radio" name="quick-goal-kind" checked={kind === 'check'} onChange={() => setKind('check')} /> Done or not, each day
        </label>
        <label>
          <input type="radio" name="quick-goal-kind" checked={kind === 'tally'} onChange={() => setKind('tally')} />{' '}
          <input type="number" min={1} max={99} value={times} onChange={(e) => { setTimes(e.target.value); setKind('tally') }} aria-label="Times a day" className="quick-goal-times" /> times a day
        </label>
      </div>
      {error && <p className="error small">{error}</p>}
      <div className="row">
        <button type="submit" className="small" disabled={busy || !name.trim()}>
          {busy ? 'Adding…' : 'Add goal'}
        </button>
        <button type="button" className="link small" onClick={() => onMore(name.trim())}>
          More options…
        </button>
        <button type="button" className="link small" onClick={onDone}>
          Cancel
        </button>
      </div>
      <p className="muted small">Everyone can see it; only you log it. More options: amounts, targets, some days only, logging together.</p>
    </form>
  )
}

/**
 * The family's goals for the day, one line per person (how many they've done), each opening to their goals,
 * indented under them like a folder's tiles. Open ones are remembered on this device.
 */
function FamilyGoals({ groups, day }: { groups: { key: string; title: string; goals: Goal[] }[]; day: string }) {
  const [open, toggle] = useStoredSet('align-goals-family-open')
  return (
    <div className="goals-family">
      {groups.map((g) => {
        const done = g.goals.filter((x) => met(x, x.log?.[day], day)).length
        const isOpen = open.has(g.key)
        return (
          <div key={g.key} className="goals-person">
            <button type="button" className="goals-person-head" onClick={() => toggle(g.key)} aria-expanded={isOpen}>
              <Icon name="person" /> <strong>{g.title.replace(/’s goals$|'s goals$/, '')}</strong>
              <span className="muted small">
                {done} of {g.goals.length} done
              </span>
              <span className="grow" />
              <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} />
            </button>
            {isOpen && (
              <div className="goal-list goals-person-body">
                {g.goals.map((x) => (
                  <GoalSummary key={x.id} goal={x} day={day} open={false} onToggle={() => {}} readOnly />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
