import { useState, type FormEvent } from 'react'
import { recalculate } from '../../engine/scheduling'
import { createTask } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List } from '../../types'
import { sortTasks } from '../../utils/tasks'
import { TaskCard } from './TaskCard'

export function ListView({ list }: { list: List }) {
  const app = useApp()
  const { tasks } = useData()
  const [title, setTitle] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listTasks = tasks.filter((t) => t.listId === list.id)
  const shown = sortTasks(
    listTasks.filter((t) => showDone || t.status !== 'done'),
    list.kind === 'project' ? 'dependency' : 'priority',
  )
  const editable = app.canEdit(list)
  const doneCount = listTasks.filter((t) => t.status === 'done').length

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError(null)
    try {
      const id = await createTask(list, { title: title.trim(), priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [] }, app.uid)
      setTitle('')
      app.selectTask(id)
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
      <header className="view-header">
        <h2>{list.name}</h2>
        <span className={`badge ${list.kind === 'project' ? 'color-project' : `color-${list.visibility}`}`}>
          {list.visibility === 'private' ? 'Private' : 'Family'}
          {list.kind === 'project' && ' project'}
        </span>
        {list.viewerVisible && <span className="badge">Visible to viewers</span>}
        {list.defaultContext === 'work' && <span className="badge work">Work</span>}
        <span className="grow" />
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
        {editable && (
          <button type="button" className="secondary small" onClick={() => app.editList(list)}>
            Edit list
          </button>
        )}
      </header>

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
        {shown.length === 0 && <p className="muted">No open tasks.</p>}
      </div>
      {doneCount > 0 && (
        <button type="button" className="link" onClick={() => setShowDone((s) => !s)}>
          {showDone ? 'Hide' : 'Show'} {doneCount} done
        </button>
      )}
    </section>
  )
}
