import { useState, type FormEvent } from 'react'
import { addTaskNow } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List } from '../../types'
import { ListHeader } from './ListHeader'
import { Icon } from '../UI/Icon'
import { splitTitleNote } from '../../utils/quickAdd'
import { EntryRow } from '../Entries/EntryRow'
import { EntrySizeSwitch } from '../Entries/EntrySizeSwitch'
import { useEntrySize } from '../../hooks/useEntrySize'

/** Notes: reference info (Wi-Fi password, sizes, the plumber's number). Alphabetical, as entry rows (Detail shows the
 *  text in place). */
export function NotesView({ list }: { list: List }) {
  const app = useApp()
  const { listItems } = useData()
  const editable = app.canEdit(list)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const notes = listItems.filter((t) => t.listId === list.id).sort((a, b) => a.title.localeCompare(b.title))
  const [size, setSize] = useEntrySize(list)

  function add(e: FormEvent) {
    e.preventDefault()
    const text = title.trim()
    if (!text) return
    setError(null)
    setTitle('')
    const { id, written } = addTaskNow(list, { ...splitTitleNote(text), priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [] }, app.uid)
    app.selectTask(id) // straight to writing it
    written.catch((err) => {
      setError(err instanceof Error ? err.message : String(err))
      setTitle(text)
    })
  }

  return (
    <section>
      <ListHeader list={list}>
        <EntrySizeSwitch value={size} onChange={setSize} />
      </ListHeader>
      {editable && (
        <form className="row add-task" onSubmit={add}>
          <input placeholder="New note… (title: text)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New note title" />
<button type="submit" className="icon-button" aria-label="Add note" title="Add note">
            <Icon name="plus" />
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <ul className="entry-list">
        {notes.map((n) => (
          <EntryRow key={n.id} entry={n} size={size} />
        ))}
      </ul>
      {notes.length === 0 && <p className="muted">No notes yet.</p>}
    </section>
  )
}
