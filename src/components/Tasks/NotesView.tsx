import { useState, type FormEvent } from 'react'
import { createTask } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List } from '../../types'
import { ListHeader } from './ListHeader'

/** Notes: reference info (Wi-Fi password, sizes, the plumber's number). Alphabetical; tap one to read or edit it. */
export function NotesView({ list }: { list: List }) {
  const app = useApp()
  const { listItems } = useData()
  const editable = app.canEdit(list)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const notes = listItems.filter((t) => t.listId === list.id).sort((a, b) => a.title.localeCompare(b.title))

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError(null)
    try {
      const id = await createTask(list, { title: title.trim(), priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [] }, app.uid)
      setTitle('')
      app.selectTask(id) // straight to writing it
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section>
      <ListHeader list={list} />
      {editable && (
        <form className="row add-task" onSubmit={add}>
          <input placeholder="New note title…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New note title" />
          <button type="submit">Add</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <div className="note-list">
        {notes.map((n) => (
          <button
            type="button"
            key={n.id}
            className={`note-card${app.selectedTaskId === n.id ? ' selected' : ''}`}
            onClick={() => app.selectTask(n.id)}
          >
            <strong>{n.title}</strong>
            {n.notes ? <span className="note-preview">{n.notes}</span> : <span className="muted small">Empty</span>}
          </button>
        ))}
      </div>
      {notes.length === 0 && <p className="muted">No notes yet.</p>}
    </section>
  )
}
