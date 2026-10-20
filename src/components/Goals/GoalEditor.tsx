import { useState, type FormEvent } from 'react'
import { today } from '../../engine/dates'
import { createGoal, deleteGoal, updateGoal, type GoalInput } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import type { Goal } from '../../types'
import { SharePicker } from '../Tasks/SharePicker'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const KIND_HELP: Record<Goal['kind'], string> = {
  check: 'Done or not, each day (walk the dogs).',
  tally: 'Tap once each time, up to a number a day (12 oz water × 8).',
  progressive: 'A suggested amount that grows on a schedule; enter what you did (push-ups, suggested 10).',
  measure: 'A target and what you measured (weight).',
}

/** Create or edit a goal. Privacy works like lists; new goals start as "Just me". */
export function GoalEditor({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const app = useApp()
  const [form, setForm] = useState<GoalInput>(
    goal ?? { name: '', kind: 'check', visibility: 'private', ownerId: app.uid, viewerVisible: false, perDay: 8, progression: { start: 10, step: 1, every: 2, per: 'day', from: today() }, direction: 'down' },
  )
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
      target: form.kind === 'measure' ? form.target : undefined,
      direction: form.kind === 'measure' ? (form.direction ?? 'down') : undefined,
      weekdays: form.weekdays?.length ? [...form.weekdays].sort() : undefined,
      sharedWith: form.visibility === 'shared' ? [...new Set([form.ownerId, ...(form.sharedWith ?? [])])] : undefined,
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
      await deleteGoal(goal.id)
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
            <option value="progressive">Progressive (growing suggestion)</option>
            <option value="measure">Measure (target vs actual)</option>
          </select>
        </label>
        <p className="muted small">{KIND_HELP[form.kind]}</p>

        {form.kind === 'tally' && (
          <label>
            Times a day
            <input type="number" min={1} max={50} value={form.perDay ?? 1} onChange={(e) => set({ perDay: num(e.target.value) })} />
          </label>
        )}
        {form.kind === 'progressive' && (
          <div className="grid2">
            <label>
              Start at
              <input type="number" step="any" value={prog.start} onChange={(e) => setProg({ start: num(e.target.value) ?? 0 })} />
            </label>
            <label>
              Starting
              <input type="date" value={prog.from} onChange={(e) => setProg({ from: e.target.value || today() })} />
            </label>
            <label>
              Increase by
              <input type="number" step="any" value={prog.step} onChange={(e) => setProg({ step: num(e.target.value) ?? 0 })} />
            </label>
            <label>
              Every
              <span className="row">
                <input type="number" min={1} value={prog.every} onChange={(e) => setProg({ every: Math.max(1, num(e.target.value) ?? 1) })} />
                <select value={prog.per} onChange={(e) => setProg({ per: e.target.value as 'day' | 'week' })} aria-label="Days or weeks">
                  <option value="day">days</option>
                  <option value="week">weeks</option>
                </select>
              </span>
            </label>
            <label>
              Minimum (optional)
              <input type="number" step="any" value={prog.min ?? ''} onChange={(e) => setProg({ min: num(e.target.value) })} />
            </label>
            <label>
              Maximum (optional)
              <input type="number" step="any" value={prog.max ?? ''} onChange={(e) => setProg({ max: num(e.target.value) })} />
            </label>
          </div>
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
        {form.kind !== 'check' && (
          <label>
            Unit (optional)
            <input value={form.unit ?? ''} onChange={(e) => set({ unit: e.target.value || undefined })} placeholder={form.kind === 'tally' ? 'glasses' : form.kind === 'measure' ? 'lb' : 'reps'} maxLength={20} />
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

        <label>
          Who can see it
          <select value={form.visibility} onChange={(e) => set({ visibility: e.target.value as Goal['visibility'] })}>
            <option value="private">🔒 Just me</option>
            <option value="family">👪 Family (anyone can log it)</option>
            <option value="shared">👥 Chosen people</option>
          </select>
        </label>
        {form.visibility === 'shared' && (
          <SharePicker ownerId={form.ownerId} sharedWith={form.sharedWith ?? []} onChange={(uids) => set({ sharedWith: uids })} noun="goal" />
        )}
        {form.visibility === 'family' && (
          <label className="inline">
            <input type="checkbox" checked={form.viewerVisible} onChange={(e) => set({ viewerVisible: e.target.checked })} />
            Visible to viewers (grandparents, etc.)
          </label>
        )}

        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" disabled={busy}>
            {goal ? 'Save' : 'Create'}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
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
