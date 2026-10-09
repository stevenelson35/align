import { useState, type FormEvent } from 'react'
import { createTask, deleteTask, updateTask } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import type { List, Task } from '../../types'
import { ListHeader } from './ListHeader'

/** When it was added (to the nanosecond: quick additions land in the same second); one still being saved is newest. */
const added = (t: Task) => (t.createdAt ? t.createdAt.seconds + t.createdAt.nanoseconds / 1e9 : Infinity)
/** In the order they were added. */
const addedOrder = (a: Task, b: Task) => added(a) - added(b) || a.title.localeCompare(b.title)

/** A checklist (shopping, gifts, people to call): items to tick off, not tasks. Ticked items stay, crossed off. */
export function ChecklistView({ list }: { list: List }) {
  const app = useApp()
  const { listItems } = useData()
  const editable = app.canEdit(list)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hideChecked, setHideChecked] = useStoredFlag(`align-hide-finished:${list.id}`, false)

  const items = listItems.filter((t) => t.listId === list.id)
  const open = items.filter((t) => t.status !== 'done').sort(addedOrder)
  const checked = items.filter((t) => t.status === 'done').sort(addedOrder)
  const shown = hideChecked ? open : [...open, ...checked]

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError(null)
    try {
      await createTask(list, { title: title.trim(), priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [] }, app.uid)
      setTitle('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function clearChecked() {
    if (!window.confirm(`Delete the ${checked.length} checked item(s) from ${list.name}?`)) return
    try {
      for (const t of checked) await deleteTask(t.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section>
      <ListHeader list={list} />
      {editable && (
        <form className="row add-task" onSubmit={add}>
          <input placeholder="Add an item…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New item" />
          <button type="submit">Add</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <ul className="checklist">
        {shown.map((t) => (
          <li key={t.id} className={`check-item${t.status === 'done' ? ' checked' : ''}${app.selectedTaskId === t.id ? ' selected' : ''}`}>
            <input
              type="checkbox"
              aria-label={`Check off ${t.title}`}
              checked={t.status === 'done'}
              disabled={!editable}
              onChange={(e) => updateTask(t.id, { status: e.target.checked ? 'done' : 'todo' }).catch((err) => setError(String(err)))}
            />
            <button type="button" className="check-title" onClick={() => app.selectTask(t.id)}>
              {t.title}
              {t.notes && <span className="muted small"> · {t.notes.split('\n')[0]}</span>}
            </button>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="muted">Nothing on this list yet.</p>}
      {open.length === 0 && items.length > 0 && <p className="muted">All checked off.</p>}
      {checked.length > 0 && (
        <div className="row">
          <button type="button" className="link" onClick={() => setHideChecked(!hideChecked)}>
            {hideChecked ? 'Show' : 'Hide'} {checked.length} checked
          </button>
          {editable && (
            <button type="button" className="link" onClick={clearChecked}>
              Clear checked
            </button>
          )}
        </div>
      )}
    </section>
  )
}
