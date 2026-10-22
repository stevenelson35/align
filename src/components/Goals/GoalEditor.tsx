import { useState, type FormEvent } from 'react'
import { today } from '../../engine/dates'
import { createGoal, deleteGoal, updateGoal, type GoalInput } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import type { Goal } from '../../types'
import { audienceLabel, audienceOf, parentsOf, privacyFields, viewCoveringEditors, type Audience } from '../../utils/audience'
import { AudiencePicker } from '../UI/AudiencePicker'
import { NumberField } from '../Tasks/NumberField'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const KIND_HELP: Record<Goal['kind'], string> = {
  check: 'Done or not, each day (walk the dogs).',
  tally: 'Tap once each time, up to a number a day (12 oz water × 8).',
  progressive: 'A suggested amount that changes on a schedule toward a goal; enter what you did (push-ups up from 10; weight down 1 lb every 2 days to 169).',
  measure: 'A fixed target and what you measured.',
  total: 'Amounts add up toward a target (vacation savings: everyone who can log adds what they put in).',
}

/** Create or edit a goal: who can view it (default Everyone) and who can log it (default Only me) are separate. */
export function GoalEditor({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const app = useApp()
  const [form, setForm] = useState<GoalInput>(
    goal ?? { name: '', kind: 'check', visibility: 'family', ownerId: app.uid, viewerVisible: true, perDay: 8, progression: { start: 10, step: 1, every: 2, per: 'day', from: today() }, direction: 'down' },
  )
  const parents = parentsOf(app.household)
  const others = (ids: string[] | undefined) => (ids ?? []).filter((id) => id !== form.ownerId)
  const [view, setView] = useState<Audience>(goal ? audienceOf(goal) : 'everyone')
  const [viewChosen, setViewChosen] = useState<string[]>(others(goal?.visibility === 'shared' ? goal.sharedWith : []))
  // Older goals (before "who can log") were loggable by anyone who could edit them: Family, or the chosen people.
  const [edit, setEdit] = useState<Audience>(
    goal?.editAudience ?? (goal && goal.visibility !== 'private' ? (audienceOf(goal) === 'everyone' ? 'family' : audienceOf(goal)) : 'private'),
  )
  const [editChosen, setEditChosen] = useState<string[]>(others(goal?.editors ?? (goal?.visibility === 'shared' ? goal.sharedWith : [])))
  const effective = viewCoveringEditors(view, viewChosen, edit, editChosen, form.ownerId, parents)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<GoalInput>) => setForm((f) => ({ ...f, ...patch }))
  const prog = form.progression ?? { start: 10, step: 1, every: 2, per: 'day' as const, from: today() }
  const setProg = (patch: Partial<typeof prog>) => set({ progression: { ...prog, ...patch } })
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v))

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    // Keep only the fields this kind uses.
    const data: GoalInput = {
      ...form,
      name: form.name.trim(),
      perDay: form.kind === 'tally' ? Math.max(1, Math.round(form.perDay ?? 1)) : undefined,
      progression: form.kind === 'progressive' ? prog : undefined,
      target: form.kind === 'measure' || form.kind === 'progressive' || form.kind === 'total' ? form.target : undefined,
      direction: form.kind === 'measure' ? (form.direction ?? 'down') : undefined,
      timer: (form.kind === 'progressive' || form.kind === 'measure' || form.kind === 'total') && form.timer ? true : undefined,
      weekdays: form.weekdays?.length ? [...form.weekdays].sort() : undefined,
      sharedWith: undefined,
      audience: undefined,
      ...privacyFields(effective.view, form.ownerId, effective.viewChosen, parents),
      editAudience: edit,
      editors: edit === 'parents' || edit === 'shared' ? privacyFields(edit, form.ownerId, editChosen, parents).sharedWith : undefined,
    }
    const problem =
      (view === 'shared' && !viewChosen.length) || (edit === 'shared' && !editChosen.length)
        ? 'Pick at least one other person for "Chosen people", or choose another option.'
        : (view === 'parents' || edit === 'parents') && !parents.length
          ? 'Nobody is set as a parent yet: tick the parents in ⚙ Settings → Parents first.'
          : form.kind === 'total' && !(form.target! > 0)
            ? 'A running total needs a target above 0.'
            : null
    if (problem) {
      setError(problem)
      setBusy(false)
      return
    }
    try {
      if (goal) await updateGoal(goal, data)
      else {
        const id = await createGoal(data, app.uid)
        app.navigate({ view: 'goal', goalId: id })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!goal || !window.confirm(`Delete "${goal.name}" and all its history? (Archive keeps the history.)`)) return
    try {
      await deleteGoal(goal)
      app.navigate({ view: 'goals' })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const days = new Set(form.weekdays ?? [])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card form modal" onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <h2>{goal ? 'Edit goal' : 'New goal'}</h2>
        <label>
          Name
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} required autoFocus placeholder="e.g. Push-ups" maxLength={100} />
        </label>
        <label>
          Kind
          <select value={form.kind} onChange={(e) => set({ kind: e.target.value as Goal['kind'] })}>
            <option value="check">Check (done or not)</option>
            <option value="tally">Tally (tap each time)</option>
            <option value="progressive">Progressive (suggestion moves toward a goal)</option>
            <option value="measure">Measure (fixed target vs actual)</option>
            <option value="total">Running total (amounts add up to a target)</option>
          </select>
        </label>
        <p className="muted small">{KIND_HELP[form.kind]}</p>

        {form.kind === 'tally' && (
          <label>
            Times a day
            <NumberField min={1} max={50} value={form.perDay ?? 1} onChange={(n) => set({ perDay: n })} />
          </label>
        )}
        {form.kind === 'progressive' && (
          <div className="grid2">
            <label>
              Start at
              <NumberField decimals value={prog.start} onChange={(n) => setProg({ start: n })} />
            </label>
            <label>
              Starting
              <input type="date" value={prog.from} onChange={(e) => setProg({ from: e.target.value || today() })} />
            </label>
            <label>
              Change by (− to go down)
              <NumberField decimals value={prog.step} onChange={(n) => setProg({ step: n })} />
            </label>
            <label>
              Every
              <span className="row">
                <NumberField min={1} value={prog.every} onChange={(n) => setProg({ every: n })} aria-label="How many" />
                <select value={prog.per} onChange={(e) => setProg({ per: e.target.value as 'day' | 'week' })} aria-label="Days or weeks">
                  <option value="day">days</option>
                  <option value="week">weeks</option>
                </select>
              </span>
            </label>
            <label>
              Goal (optional; stops there)
              <input type="number" step="any" value={form.target ?? ''} onChange={(e) => set({ target: num(e.target.value) })} />
            </label>
          </div>
        )}
        {form.kind === 'progressive' && (
          <p className="muted small">
            {prog.start}
            {form.unit ? ` ${form.unit}` : ''}, {prog.step < 0 ? 'down' : 'up'} {Math.abs(prog.step)} every {prog.every > 1 ? `${prog.every} ` : ''}
            {prog.per}
            {prog.every > 1 ? 's' : ''}
            {form.target !== undefined ? `, until ${form.target}` : ''}. {prog.step < 0 ? 'At or below the suggestion counts as met.' : 'At or above the suggestion counts as met.'}
          </p>
        )}
        {form.kind === 'total' && (
          <label>
            Target
            <input type="number" step="any" min={0} value={form.target ?? ''} onChange={(e) => set({ target: num(e.target.value) })} placeholder="e.g. 3000" />
          </label>
        )}
        {form.kind === 'measure' && (
          <div className="grid2">
            <label>
              Target
              <input type="number" step="any" value={form.target ?? ''} onChange={(e) => set({ target: num(e.target.value) })} />
            </label>
            <label>
              Better is
              <select value={form.direction ?? 'down'} onChange={(e) => set({ direction: e.target.value as 'down' | 'up' })}>
                <option value="down">lower (at or below target)</option>
                <option value="up">higher (at or above target)</option>
              </select>
            </label>
          </div>
        )}
        {(form.kind === 'progressive' || form.kind === 'measure' || form.kind === 'total') && (
          <label className="inline">
            <input type="checkbox" checked={!!form.timer} onChange={(e) => set({ timer: e.target.checked || undefined })} />
            Show a timer (start / pause, then Use puts the time in the entry; minutes unless the unit is hours or seconds)
          </label>
        )}
        {form.kind !== 'check' && (
          <label>
            Unit (optional)
            <input value={form.unit ?? ''} onChange={(e) => set({ unit: e.target.value || undefined })} placeholder={form.kind === 'tally' ? 'glasses' : form.kind === 'measure' ? 'lb' : form.kind === 'total' ? '$' : 'reps or lb'} maxLength={20} />
          </label>
        )}

        <div>
          <span className="label">Days</span>
          <div className="chips">
            {DAYS.map((d, i) => (
              <label key={d} className={`chip-toggle${days.has(i) ? ' on' : ''}`}>
                <input
                  type="checkbox"
                  checked={days.has(i)}
                  onChange={() => set({ weekdays: days.has(i) ? [...days].filter((x) => x !== i) : [...days, i] })}
                />
                {d}
              </label>
            ))}
          </div>
          <p className="muted small">{days.size ? 'Only on the ticked days.' : 'Every day (tick days to limit it).'}</p>
        </div>

        <AudiencePicker
          label="Who can view it (see progress)"
          value={view}
          onChange={setView}
          ownerId={form.ownerId}
          chosen={viewChosen}
          onChosen={(ids) => setViewChosen(others(ids))}
          noun="goal"
        />
        <AudiencePicker
          label="Who can log it (add entries)"
          value={edit}
          onChange={setEdit}
          ownerId={form.ownerId}
          chosen={editChosen}
          onChosen={(ids) => setEditChosen(others(ids))}
          noun="goal"
          everyoneHint="Everyone with a household account (view-only accounts can't log)."
          forLogging
        />
        {effective.widened && (
          <p className="muted small">
            Everyone who can log it can also see it, so it will be visible to {effective.view === 'shared' ? 'the chosen people plus the loggers' : audienceLabel(effective.view)}.
          </p>
        )}
        <p className="muted small">Only you can change the goal's settings.</p>

        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" className="small" disabled={busy}>
            {goal ? 'Save' : 'Create'}
          </button>
          <button type="button" className="secondary small" onClick={onClose}>
            Cancel
          </button>
          <span className="grow" />
          {goal && (
            <button type="button" className="danger small" onClick={remove}>
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
