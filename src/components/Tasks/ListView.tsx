import { useState, type FormEvent } from 'react'
import { recalculate } from '../../engine/scheduling'
import { createTask } from '../../firebase/db'
import { today } from '../../engine/dates'
import { useApp, useData } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import type { List, Task } from '../../types'
import { isFinished, sortTasks, type SortKey } from '../../utils/tasks'
import { linkProjectTasks, withDependencyChanges } from '../../utils/project'
import { CalendarActions } from './CalendarActions'
import { ListHeader } from './ListHeader'
import { TaskCard } from './TaskCard'

export function ListView({ list }: { list: List }) {
  const app = useApp()
  const { tasks } = useData()
  const [title, setTitle] = useState('')
  // Finished tasks stay, crossed off at the bottom, unless you hide them (remembered per list on this device).
  const [hideDone, setHideDone] = useStoredFlag(`align-hide-finished:${list.id}`, false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>(list.kind === 'project' ? 'dependency' : 'priority')
  const [lastAdded, setLastAdded] = useState<Task | null>(null)
  const [followPrevious, setFollowPrevious] = useState(false)
  const [adding, setAdding] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const [sequence, setSequence] = useState<string[]>([])

  const listTasks = tasks.filter((t) => t.listId === list.id)
  const order = sort
  const open = sortTasks(listTasks.filter((t) => !isFinished(t)), order)
  const finished = hideDone ? [] : sortTasks(listTasks.filter(isFinished), order)
  const shown = [...open, ...finished]
  const editable = app.canEdit(list)
  const doneCount = listTasks.filter(isFinished).length

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || adding) return
    setError(null)
    setAdding(true)
    try {
      const previous = lastAdded && tasks.find((t) => t.id === lastAdded.id && t.listId === list.id)
      const input = { title: title.trim(), priority: 2 as const, status: 'todo' as const, context: list.defaultContext,
        durationDays: 1, dependsOn: followPrevious && previous ? [{ taskId: previous.id, offsetDays: 0 }] : [],
        ...(list.kind === 'project' ? { startDate: today() } : {}) }
      const id = await createTask(list, input, app.uid)
      const added: Task = { ...input, id, listId: list.id, visibility: list.visibility, ownerId: list.ownerId,
        viewerVisible: list.viewerVisible, createdBy: app.uid }
      setLastAdded(added)
      setTitle('')
      if (input.dependsOn.length) {
        const current = [...tasks.filter((t) => t.id !== id), added]
        const preview = recalculate(current, (taskId) => taskId === id)
        if (preview.moves.length) app.proposeShift({ title: `Schedule ${added.title}`, preview })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAdding(false)
    }
  }

  function toggleSequence(id: string) {
    setSequence((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function linkSequence() {
    setError(null)
    try {
      if (sequence.some((id) => !listTasks.some((t) => t.id === id && app.canEdit(t) && !isFinished(t)))) {
        throw new Error('A selected task is no longer available. Select the order again.')
      }
      const dependencies = linkProjectTasks(tasks, list.id, sequence)
      if (!dependencies.length) { setError('Those prerequisite links already exist.'); return }
      const linked = withDependencyChanges(tasks, dependencies)
      const preview = recalculate(linked, (id) => {
        const task = linked.find((t) => t.id === id)
        return !!task && task.listId === list.id && app.canEdit(task)
      })
      app.proposeShift({ title: `Link tasks in ${list.name}`, preview, dependencies })
      setOrdering(false)
      setSequence([])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function recalc() {
    const preview = recalculate(tasks, (id) => {
      const t = tasks.find((x) => x.id === id)
      return !!t && t.listId === list.id && app.canEdit(t)
    })
    app.proposeShift({ title: `Recalculate ${list.name}`, preview })
  }

  return (
    <section>
      <ListHeader list={list}>
        {listTasks.some((t) => t.calendar) && <CalendarActions />}
        {list.kind === 'project' && (
          <>
            <button type="button" className="secondary small" onClick={() => app.navigate({ view: 'list', listId: list.id, timeline: true })}>
              Timeline
            </button>
            {editable && (
              <>
                <button type="button" className="secondary small" onClick={recalc}>Recalculate</button>
                <button type="button" className="secondary small" aria-pressed={ordering} onClick={() => {
                  setOrdering(!ordering); setSequence([])
                }}>Select order</button>
              </>
            )}
          </>
        )}
      </ListHeader>

      {editable && (
        <form className="row add-task" onSubmit={add}>
          <input placeholder="Add a task…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="submit" disabled={adding || !title.trim()}>Add</button>
        </form>
      )}
      {editable && list.kind === 'project' && lastAdded && (
        <label className="row small">
          <input type="checkbox" checked={followPrevious} onChange={(e) => setFollowPrevious(e.target.checked)} />
          Next task follows {lastAdded.title}
        </label>
      )}
      {list.kind === 'project' && (
        <label className="row small">Order
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="dependency">Prerequisites first</option>
            <option value="priority">Priority</option>
            <option value="date">Date</option>
          </select>
        </label>
      )}
      {ordering && (
        <div className="row">
          <span className="small">{sequence.length} selected</span>
          <button type="button" onClick={linkSequence} disabled={sequence.length < 2}>Preview prerequisite links</button>
          <button type="button" className="secondary" onClick={() => { setSequence([]); setOrdering(false) }}>Cancel</button>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      <div className="task-list">
        {shown.map((t) => (
          <div key={t.id} className={ordering ? 'ordered-task' : undefined} onClickCapture={(e) => {
            if (!ordering && editable && list.kind === 'project' && (e.ctrlKey || e.metaKey) && !isFinished(t)) {
              e.preventDefault(); e.stopPropagation(); setOrdering(true); toggleSequence(t.id)
            }
          }}>
            {ordering && <label className="row small">
              <input type="checkbox" checked={sequence.includes(t.id)} disabled={!app.canEdit(t) || isFinished(t)}
                onChange={() => toggleSequence(t.id)} aria-label={`Select ${t.title} for prerequisite order`} />
              {sequence.includes(t.id) ? sequence.indexOf(t.id) + 1 : ''}
            </label>}
            <div onClickCapture={(e) => {
              if (ordering && app.canEdit(t) && !isFinished(t)) {
                e.preventDefault(); e.stopPropagation(); toggleSequence(t.id)
              }
            }}><TaskCard task={t} showList={false} /></div>
          </div>
        ))}
        {shown.length === 0 && <p className="muted">{doneCount ? 'Nothing left to do.' : 'No tasks yet.'}</p>}
      </div>
      {doneCount > 0 && (
        <button type="button" className="link" onClick={() => setHideDone(!hideDone)}>
          {hideDone ? 'Show' : 'Hide'} {doneCount} finished
        </button>
      )}
    </section>
  )
}
