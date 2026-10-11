import { useState, type FormEvent } from 'react'
import { recalculate } from '../../engine/scheduling'
import { createTask } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import type { List } from '../../types'
import { isFinished, sortTasks } from '../../utils/tasks'
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

  const listTasks = tasks.filter((t) => t.listId === list.id)
  const order = list.kind === 'project' ? 'dependency' : 'priority'
  const open = sortTasks(listTasks.filter((t) => !isFinished(t)), order)
  const finished = hideDone ? [] : sortTasks(listTasks.filter(isFinished), order)
  const shown = [...open, ...finished]
  const editable = app.canEdit(list)
  const doneCount = listTasks.filter(isFinished).length

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError(null)
    try {
      // Just add it: the box stays ready for the next one. Tap a task to fill in details.
      await createTask(list, { title: title.trim(), priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [] }, app.uid)
      setTitle('')
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
              <button type="button" className="secondary small" onClick={recalc}>
                Recalculate
              </button>
            )}
          </>
        )}
      </ListHeader>

      {editable && (
        <form className="row add-task" onSubmit={add}>
          <input placeholder="Add a task…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="submit">Add</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}

      <div className="task-list">
        {shown.map((t) => (
          <TaskCard key={t.id} task={t} showList={false} />
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
