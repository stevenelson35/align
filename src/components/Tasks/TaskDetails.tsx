import { useState, type FormEvent } from 'react'
import { finish, meetDate, shiftForward } from '../../engine/scheduling'
import { wouldCreateCycle } from '../../engine/graph'
import { deleteTask, updateTask, type TaskInput } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { Context, Dependency, Priority, Status, Task } from '../../types'
import { NumberField } from './NumberField'
import { isFinished, people as humans, STATUS_LABEL, targetName } from '../../utils/tasks'

/** ✓ done, ✕ canceled, ⏳ not finished yet. */
function statusIcon(t: Task) {
  return t.status === 'done' ? '✓' : t.status === 'canceled' ? '✕' : '⏳'
}

/** Right panel: task details, dependencies and schedule (DESIGN.md §10). */
export function TaskDetails({ task }: { task: Task }) {
  const app = useApp()
  const { tasks, lists, conflicts, dependents } = useData()
  const editable = app.canEdit(task)
  const [form, setForm] = useState(task)
  const [newDep, setNewDep] = useState({ taskId: '', offsetDays: 0 })
  const [meetBy, setMeetBy] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (patch: Partial<Task>) => setForm((f) => ({ ...f, ...patch }))
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const canEditId = (id: string) => {
    const t = byId.get(id)
    return !!t && app.canEdit(t)
  }
  const people = humans(app.household, true)
  const targets = [...people.map(([id, m]) => ({ id, name: m.displayName })), ...app.household.pets.map((p) => ({ id: p.id, name: p.name }))]
  // Lists this task can move to: ones the user can edit.
  const listChoices = lists.filter((l) => app.canEdit(l))
  const depChoices = tasks.filter((t) => t.id !== task.id && !form.dependsOn.some((d) => d.taskId === t.id))

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const patch: Partial<TaskInput> = {
      title: form.title.trim() || task.title,
      notes: form.notes || undefined,
      priority: form.priority,
      status: form.status,
      context: form.context,
      assigneeId: form.assigneeId || undefined,
      for: form.for?.length ? form.for : undefined,
      targetDate: form.targetDate || undefined,
      dependsOn: form.dependsOn,
    }
    const scheduleChanged = (form.startDate || undefined) !== task.startDate || form.durationDays !== task.durationDays
    let preview = null
    if (scheduleChanged && form.startDate) {
      // Dependents might need to move: preview first, apply as one batch (DESIGN.md §6.3).
      const updated = tasks.map((t) => (t.id === task.id ? { ...t, dependsOn: form.dependsOn } : t))
      preview = shiftForward(updated, { id: task.id, startDate: form.startDate, durationDays: form.durationDays }, canEditId)
      if (preview.moves.length <= 1 && preview.blocked.length === 0) preview = null
    }
    if (scheduleChanged && !preview) {
      patch.startDate = form.startDate || undefined
      patch.durationDays = Math.max(1, form.durationDays)
    }
    const moveTo = form.listId !== task.listId ? lists.find((l) => l.id === form.listId) : undefined
    try {
      await updateTask(task.id, patch, moveTo)
      if (preview) app.proposeShift({ title: `Move ${task.title}`, preview })
      // Close, so the change shows on the task's card (on a phone this panel covers the whole page).
      app.selectTask(null)
      return
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setBusy(false)
  }

  function addDependency() {
    if (!newDep.taskId) return
    if (wouldCreateCycle(tasks.map((t) => (t.id === task.id ? form : t)), task.id, newDep.taskId)) {
      setError('That would create a loop: the other task already depends on this one.')
      return
    }
    setError(null)
    set({ dependsOn: [...form.dependsOn, { taskId: newDep.taskId, offsetDays: newDep.offsetDays }] })
    setNewDep({ taskId: '', offsetDays: 0 })
  }

  function updateDep(i: number, patch: Partial<Dependency>) {
    set({ dependsOn: form.dependsOn.map((d, j) => (j === i ? { ...d, ...patch } : d)) })
  }

  function proposeMeet() {
    if (!meetBy) return
    app.proposeShift({ title: `Finish ${task.title} by ${meetBy}`, preview: meetDate(tasks, task.id, meetBy, canEditId) })
  }

  async function remove() {
    const dependents = tasks.filter((t) => t.dependsOn.some((d) => d.taskId === task.id))
    const warning = dependents.length ? `\n\n${dependents.length} task(s) depend on it and will lose that dependency.` : ''
    if (!window.confirm(`Delete "${task.title}"?${warning}`)) return
    try {
      for (const d of dependents.filter((t) => app.canEdit(t))) {
        await updateTask(d.id, { dependsOn: d.dependsOn.filter((x) => x.taskId !== task.id) })
      }
      await deleteTask(task.id)
      app.selectTask(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const conflict = conflicts.get(task.id)
  const end = finish(form)

  return (
    <form className="task-details form" onSubmit={save}>
      <header className="row">
        <h3 className="grow">{editable ? 'Edit task' : 'Task'}</h3>
        <button type="button" className="link" onClick={() => app.selectTask(null)} aria-label="Close">
          ✕
        </button>
      </header>
      {conflict && <p className="badge danger">⚠ {conflict}</p>}
      {task.calendar && (
        <p className="calendar-note small">
          📅 From the family Google Calendar{task.calendar.time && ` · ${task.calendar.time}`}
          {task.calendar.location && ` · ${task.calendar.location}`}. The sync (every 15 minutes, or ↻ Refresh calendar) keeps the title and dates in step with
          the calendar; everything else here is yours to edit.
        </p>
      )}
      <fieldset disabled={!editable}>
        <label>
          Title
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} required />
        </label>
        <label>
          Notes
          <textarea rows={3} value={form.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
        </label>
        <label>
          List
          <select value={form.listId} onChange={(e) => set({ listId: e.target.value })}>
            {(listChoices.some((l) => l.id === task.listId) ? listChoices : [...listChoices, ...lists.filter((l) => l.id === task.listId)]).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.visibility})
              </option>
            ))}
          </select>
        </label>
        <div className="grid2">
          <label>
            Priority
            <select value={form.priority} onChange={(e) => set({ priority: Number(e.target.value) as Priority })}>
              <option value={1}>High</option>
              <option value={2}>Medium</option>
              <option value={3}>Low</option>
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={(e) => set({ status: e.target.value as Status })}>
              <option value="todo">To do</option>
              <option value="doing">Doing</option>
              <option value="done">Done</option>
              <option value="canceled">Canceled</option>
            </select>
          </label>
          <label>
            Context
            <select value={form.context} onChange={(e) => set({ context: e.target.value as Context })}>
              <option value="family">Family</option>
              <option value="work">Work</option>
            </select>
          </label>
          <label>
            Assignee
            <select value={form.assigneeId ?? ''} onChange={(e) => set({ assigneeId: e.target.value || undefined })}>
              <option value="">Nobody</option>
              {people.map(([id, m]) => (
                <option key={id} value={id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <span className="label">For</span>
          <div className="chips">
            {targets.map((t) => {
              const on = form.for?.includes(t.id) ?? false
              return (
                <label key={t.id} className={`chip-toggle${on ? ' on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => set({ for: on ? form.for?.filter((x) => x !== t.id) : [...(form.for ?? []), t.id] })}
                  />
                  {t.name}
                </label>
              )
            })}
          </div>
        </div>

        <div className="grid2">
          <label>
            Start
            <input type="date" value={form.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value || undefined })} />
          </label>
          <label>
            Days
            <NumberField min={1} value={form.durationDays} onChange={(n) => set({ durationDays: n })} />
          </label>
          <label>
            Target date
            <input type="date" value={form.targetDate ?? ''} onChange={(e) => set({ targetDate: e.target.value || undefined })} />
          </label>
          <div className="muted small">{end && `Finishes ${end}`}</div>
        </div>

        <div>
          <span className="label">Depends on</span>
          {form.dependsOn.map((d, i) => {
            const pre = byId.get(d.taskId)
            return (
            <div className="row dep-row" key={d.taskId}>
              {pre ? (
                <span
                  className={`grow dep-link${isFinished(pre) ? '' : ' open'}`}
                  role="button"
                  tabIndex={0}
                  title={`${STATUS_LABEL[pre.status]}. Open it.`}
                  onClick={() => app.selectTask(pre.id)}
                  onKeyDown={(e) => e.key === 'Enter' && app.selectTask(pre.id)}
                >
                  {statusIcon(pre)} {pre.title}
                </span>
              ) : (
                <span className="grow muted">(hidden or deleted task)</span>
              )}
              <span className="muted small">+</span>
              <NumberField
                className="narrow"
                min={0}
                value={d.offsetDays}
                onChange={(n) => updateDep(i, { offsetDays: n })}
                aria-label="Days after it finishes"
              />
              <span className="muted small">days</span>
              <button type="button" className="link" onClick={() => set({ dependsOn: form.dependsOn.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
            )
          })}
          <div className="row dep-row">
            <select className="grow" value={newDep.taskId} onChange={(e) => setNewDep({ ...newDep, taskId: e.target.value })}>
              <option value="">Add a prerequisite…</option>
              {depChoices.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <span className="muted small">+</span>
            <NumberField
              className="narrow"
              min={0}
              value={newDep.offsetDays}
              onChange={(n) => setNewDep({ ...newDep, offsetDays: n })}
              aria-label="Days after it finishes"
            />
            <button type="button" className="secondary small" onClick={addDependency}>
              Add
            </button>
          </div>
        </div>
      </fieldset>

      {(dependents.get(task.id) ?? []).length > 0 && (
        <div className="needed-by">
          <span className="label">Needed by</span>
          {(dependents.get(task.id) ?? []).map((d) => (
            <div className="row dep-row" key={d.id}>
              <span
                className={`grow dep-link${isFinished(d) ? '' : ' open'}`}
                role="button"
                tabIndex={0}
                title={`${STATUS_LABEL[d.status]}. Open it.`}
                onClick={() => app.selectTask(d.id)}
                onKeyDown={(e) => e.key === 'Enter' && app.selectTask(d.id)}
              >
                {statusIcon(d)} {d.title}
              </span>
            </div>
          ))}
          {!isFinished(task) && <p className="muted small">These can't start until this task is done or canceled.</p>}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {editable && (
        <>
          <div className="row">
            <button type="submit" disabled={busy}>
              Save
            </button>
            <span className="grow" />
            <button type="button" className="danger small" onClick={remove}>
              Delete
            </button>
          </div>
          <div className="row meet">
            <span className="small">Finish by</span>
            <input type="date" value={meetBy} onChange={(e) => setMeetBy(e.target.value)} />
            <button type="button" className="secondary small" onClick={proposeMeet} disabled={!meetBy}>
              Shift prerequisites
            </button>
          </div>
        </>
      )}
      {task.createdBy && <p className="muted small">Created by {targetName(task.createdBy, app.household)}</p>}
    </form>
  )
}
