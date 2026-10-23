import { useState, type FormEvent } from 'react'
import { finish, meetDate, shiftForward } from '../../engine/scheduling'
import { wouldCreateCycle } from '../../engine/graph'
import { commentThread, createTask, deleteRemovedImages, deleteTask, type TaskInput, updateTask, withStatus } from '../../firebase/db'
import { formatDay, today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import type { Context, Dependency, Priority, Status, Task } from '../../types'
import { googleCalendarDayUrl } from '../../utils/calendar'
import { safeUrl } from '../../utils/links'
import { NumberField } from './NumberField'
import { NewListInline } from './NewListInline'
import { isFinished, isItemList, people as humans, PRIORITY_LABEL, privacyText, STATUS_LABEL, targetName } from '../../utils/tasks'
import { shareLink, whenText } from '../../utils/text'
import { EntryExtras, EntryFact, EntryPanel } from '../UI/EntryExtras'
import { Icon } from '../UI/Icon'
import { AUDIENCE_ICON, audienceLabel, audienceOf } from '../../utils/audience'
import { cleanLinks, cleanUrls, detailsOf, MAX_IMAGES, taskDetails } from '../../utils/details'
import { DetailsView, LinksAndPictures } from '../UI/Details'
import { AutoTextarea } from '../UI/AutoTextarea'

/** ✓ done, ✕ canceled, ⏳ not finished yet. */
function statusIcon(t: Task) {
  return t.status === 'done' ? '✓' : t.status === 'canceled' ? '✕' : '⏳'
}

/** The list chooser's "+ New list…" value. */
const NEW = '__new__'

/** Right panel for a task (DESIGN.md §10): opens as a view; Edit switches to the full form. */
export function TaskDetails({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false)
  return editing ? <TaskEditForm task={task} onDone={() => setEditing(false)} /> : <TaskView task={task} onEdit={() => setEditing(true)} />
}

/**
 * A task before Edit: its facts (status, when, who, list, what it waits on), then the common EntryExtras block
 * (note, links, pictures, comments, Text about this).
 */
function TaskView({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const app = useApp()
  const { tasks, lists, conflicts, dependents } = useData()
  const list = lists.find((l) => l.id === task.listId)
  const name = (id: string) => tasks.find((t) => t.id === id)?.title
  const waits = task.dependsOn.map((d) => name(d.taskId)).filter(Boolean)
  const unblocks = (dependents.get(task.id) ?? []).map((t) => t.title)
  const end = finish(task)
  const href = safeUrl(task.url)
  const who = [task.assigneeId && `${targetName(task.assigneeId, app.household)} is doing it`, task.for?.length && `for ${task.for.map((id) => targetName(id, app.household)).join(', ')}`].filter(Boolean)
  return (
    <EntryPanel
      kind="Task"
      title={task.title}
      onEdit={app.canEdit(task) ? onEdit : undefined}
      onClose={() => app.selectTask(null)}
      facts={
        <>
          {conflicts.get(task.id) && <EntryFact icon="warning">{conflicts.get(task.id)}</EntryFact>}
          <EntryFact icon={isFinished(task) ? 'check' : 'todo'}>
            {STATUS_LABEL[task.status]}
            {task.finishedOn && isFinished(task) && ` ${formatDay(task.finishedOn)}`} · {PRIORITY_LABEL[task.priority]} priority
            {task.context === 'work' && ' · Work'}
          </EntryFact>
          {(task.startDate || task.targetDate) && (
            <EntryFact icon="clock">
              {task.startDate && (task.durationDays > 1 && end ? `${formatDay(task.startDate)} to ${formatDay(end)}` : formatDay(task.startDate))}
              {task.calendar?.time && ` · ${task.calendar.time}`}
              {task.startDate && task.targetDate && ' · '}
              {task.targetDate && `due ${formatDay(task.targetDate)}`}
            </EntryFact>
          )}
          {task.calendar && (
            <EntryFact icon="calendar">
              From the family calendar{task.calendar.location && ` · ${task.calendar.location}`}
              {(task.calendar.link || task.startDate) && (
                <>
                  {' · '}
                  <a href={task.calendar.link ?? googleCalendarDayUrl(task.startDate!)} target="_blank" rel="noopener noreferrer">
                    Open in Google Calendar
                  </a>
                </>
              )}
            </EntryFact>
          )}
          {who.length > 0 && <EntryFact icon="person">{who.join(', ')}</EntryFact>}
          {href && (
            <EntryFact icon="external">
              <a href={href} target="_blank" rel="noopener noreferrer">
                Open the link
              </a>
            </EntryFact>
          )}
          {waits.length > 0 && <EntryFact icon="waiting">Waiting on {waits.join(', ')}</EntryFact>}
          {unblocks.length > 0 && <EntryFact icon="chain">Needed by {unblocks.join(', ')}</EntryFact>}
          {list && (
            <EntryFact icon={AUDIENCE_ICON[audienceOf(list)]}>
              {list.name} · {privacyText(list, 'task', app.household, app.uid)}
            </EntryFact>
          )}
        </>
      }
    >
      <EntryExtras
        details={{ ...detailsOf(task, false), note: task.notes }}
        alt={task.title}
        thread={commentThread.task(task.id)}
        text={{ title: task.title, when: whenText(task), link: shareLink(task) }}
        startTextOpen={app.textingId === task.id}
      />
    </EntryPanel>
  )
}

/** The edit form: every field, dependencies and schedule (DESIGN.md §10). Save returns to the view. */
function TaskEditForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const app = useApp()
  const { tasks, lists, conflicts, dependents } = useData()
  const editable = app.canEdit(task)
  const [form, setForm] = useState(task)
  const [extras, setExtras] = useState(() => detailsOf(task, false))
  const [newDep, setNewDep] = useState({ taskId: '', offsetDays: 0 })
  const [showOtherTasks, setShowOtherTasks] = useState(false)
  const [meetBy, setMeetBy] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [itemListId, setItemListId] = useState('')
  const [itemTitle, setItemTitle] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [itemMessage, setItemMessage] = useState('')

  const set = (patch: Partial<Task>) => setForm((f) => ({ ...f, ...patch }))
  // "+ New list…" in the list chooser (or "+ New checklist…" for Add an item): which one is being named.
  const [newList, setNewList] = useState<'list' | 'checklist' | null>(null)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const canEditId = (id: string) => {
    const t = byId.get(id)
    return !!t && app.canEdit(t)
  }
  const people = humans(app.household, true)
  const targets = [...people.map(([id, m]) => ({ id, name: m.displayName })), ...app.household.pets.map((p) => ({ id: p.id, name: p.name }))]
  // Lists this task can move to: ones the user can edit.
  const listChoices = lists.filter((l) => app.canEdit(l) && !isItemList(l))
  const itemLists = lists.filter((l) => app.canEdit(l) && l.kind === 'checklist')
  const inProject = lists.find((l) => l.id === form.listId)?.kind === 'project'
  const depChoices = tasks.filter((t) => t.id !== task.id && !form.dependsOn.some((d) => d.taskId === t.id)
    && (!inProject || showOtherTasks || t.listId === form.listId))

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const links = cleanLinks(extras.links)
    const images = cleanUrls(extras.images, MAX_IMAGES, 'pictures')
    if (typeof links === 'string' || typeof images === 'string') {
      setError(typeof links === 'string' ? links : (images as string))
      setBusy(false)
      return
    }
    const patch: Partial<TaskInput> = {
      ...taskDetails({ links, images }),
      title: form.title.trim() || task.title,
      notes: form.notes || undefined,
      priority: form.priority,
      ...withStatus(task, form.status),
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
      void deleteRemovedImages(detailsOf(task, false).images, images)
      if (preview) app.proposeShift({ title: `Move ${task.title}`, preview })
      onDone() // back to the view, which shows the change
      return
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setBusy(false)
  }

  async function addItem() {
    const list = itemLists.find((l) => l.id === itemListId)
    if (!list || !itemTitle.trim() || addingItem) return
    setAddingItem(true)
    setItemMessage('')
    try {
      await createTask(list, { title: itemTitle.trim(), priority: 2, status: 'todo', context: list.defaultContext,
        durationDays: 1, dependsOn: [] }, app.uid)
      setItemMessage(`Added ${itemTitle.trim()} to ${list.name}.`)
      setItemTitle('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAddingItem(false)
    }
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
      await deleteTask(task)
      app.selectTask(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const conflict = conflicts.get(task.id)
  const end = finish(form)

  return (
    <form className="task-details form" onSubmit={save}>
      {/* Save at the top too (and the header stays in view), so a quick edit needs no scrolling. */}
      <header className="row panel-header">
        <h3 className="grow">Edit task</h3>
        {editable && (
          <>
            <button type="submit" className="small" disabled={busy}>Save</button>
            <button type="button" className="danger small" onClick={remove} disabled={busy}>Delete</button>
          </>
        )}
        <button type="button" className="secondary small" onClick={onDone}>Cancel</button>
        <button type="button" className="link" onClick={() => app.selectTask(null)} aria-label="Close">
          ✕
        </button>
      </header>
      {conflict && <p className="badge danger"><Icon name="warning" /> {conflict}</p>}
      {task.url && safeUrl(task.url) && (
        <p className="small">
          <a href={safeUrl(task.url)!} target="_blank" rel="noopener noreferrer">
            Open the link ↗
          </a>
        </p>
      )}
      {task.calendar && (
        <p className="calendar-note small">
          <Icon name="calendar" /> From the family Google Calendar{task.calendar.time && ` · ${task.calendar.time}`}
          {task.calendar.location && ` · ${task.calendar.location}`}.{' '}
          {/* The event itself when the sync stored its link (newer script), otherwise that day. */}
          {(task.calendar.link || task.startDate) && (
            <a href={task.calendar.link ?? googleCalendarDayUrl(task.startDate!)} target="_blank" rel="noopener noreferrer">
              Open in Google Calendar ↗
            </a>
          )} The sync (every 15 minutes, or ↻ Refresh calendar) keeps the title and dates in step with
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
          <AutoTextarea rows={3} value={form.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
        </label>
        {editable ? (
          <LinksAndPictures value={extras} onChange={(d) => setExtras({ ...extras, ...d })} onError={setError} />
        ) : (
          <DetailsView links={extras.links} images={extras.images} alt={task.title} />
        )}
        <label>
          List
          <select value={newList === 'list' ? NEW : form.listId} onChange={(e) => {
            const listId = e.target.value
            if (listId === NEW) return setNewList('list')
            setNewList(null)
            set({ listId, startDate: form.startDate || (lists.find((l) => l.id === listId)?.kind === 'project' ? today() : undefined) })
            setNewDep({ taskId: '', offsetDays: 0 })
            setShowOtherTasks(false)
          }}>
            {(listChoices.some((l) => l.id === task.listId) ? listChoices : [...listChoices, ...lists.filter((l) => l.id === task.listId)]).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({audienceLabel(audienceOf(l))})
              </option>
            ))}
            {app.isMember && <option value={NEW}>+ New list…</option>}
          </select>
        </label>
        {newList === 'list' && (
          <NewListInline
            kind="list"
            onCreated={(listId) => {
              setNewList(null)
              set({ listId })
              setNewDep({ taskId: '', offsetDays: 0 })
            }}
            onCancel={() => setNewList(null)}
          />
        )}
        {(() => {
          const target = lists.find((l) => l.id === form.listId)
          return target && <p className="privacy-note small"><Icon name={AUDIENCE_ICON[audienceOf(target)]} /> {privacyText(target, 'task', app.household, app.uid)}</p>
        })()}
        {itemLists.length > 0 && (
          <details>
            <summary>Add a shopping / checklist item</summary>
            <label>
              Checklist
              <select value={newList === 'checklist' ? NEW : itemListId} onChange={(e) => {
                if (e.target.value === NEW) return setNewList('checklist')
                setNewList(null)
                setItemListId(e.target.value)
              }}>
                <option value="">Choose a list…</option>
                {itemLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                <option value={NEW}>+ New checklist…</option>
              </select>
            </label>
            {newList === 'checklist' && (
              <NewListInline
                kind="checklist"
                onCreated={(id) => {
                  setNewList(null)
                  setItemListId(id)
                }}
                onCancel={() => setNewList(null)}
              />
            )}
            <label>
              Item
              <input value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void addItem() }
              }} />
            </label>
            <button type="button" className="secondary small" onClick={addItem}
              disabled={addingItem || !itemListId || !itemTitle.trim()}>Add item</button>
            {itemMessage && <p className="small" role="status">{itemMessage}</p>}
          </details>
        )}
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
          {inProject && (
            <label className="row small">
              <input type="checkbox" checked={showOtherTasks} onChange={(e) => {
                setShowOtherTasks(e.target.checked)
                setNewDep({ taskId: '', offsetDays: 0 })
              }} />
              Show other tasks
            </label>
          )}
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
            <button type="submit" className="small" disabled={busy}>
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
