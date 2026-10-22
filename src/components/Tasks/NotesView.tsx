import { useState, type FormEvent } from 'react'
import { addTaskNow } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List } from '../../types'
import { ListHeader } from './ListHeader'
import { DetailsMarks } from '../UI/Details'
import { Icon } from '../UI/Icon'

/** Notes: reference info (Wi-Fi password, sizes, the plumber's number). Alphabetical; tap one to read or edit it. */
export function NotesView({ list }: { list: List }) {
  const app = useApp()
  const { listItems } = useData()
  const editable = app.canEdit(list)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const notes = listItems.filter((t) => t.listId === list.id).sort((a, b) => a.title.localeCompare(b.title))

  function add(e: FormEvent) {
    e.preventDefault()
    const text = title.trim()
    if (!text) return
    setError(null)
    setTitle('')
    const { id, written } = addTaskNow(list, { title: text, priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [] }, app.uid)
    app.selectTask(id) // straight to writing it
    written.catch((err) => {
      setError(err instanceof Error ? err.message : String(err))
      setTitle(text)
    })
  }

  return (
    <section>
      <ListHeader list={list} />
      {editable && (
        <form className="row add-task" onSubmit={add}>
          <input placeholder="New note title…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New note title" />
<button type="submit" className="icon-button" aria-label="Add note" title="Add note">
            <Icon name="plus" />
          </button>
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
            <strong>
              {n.title}
              <DetailsMarks links={n.links} images={n.images} />
            </strong>
            {n.notes ? <span className="note-preview">{n.notes}</span> : <span className="muted small">Empty</span>}
          </button>
        ))}
      </div>
      {notes.length === 0 && <p className="muted">No notes yet.</p>}
    </section>
  )
}
