import { useState, type FormEvent } from 'react'
import { deleteTask, updateTask } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List, Task } from '../../types'

/** Side panel for a checklist item or a note: title, text, move, delete. Save and ✕ are at the top. */
export function ItemDetails({ item, list }: { item: Task; list: List }) {
  const app = useApp()
  const { lists } = useData()
  const editable = app.canEdit(item)
  const isNote = list.kind === 'notes'
  const [title, setTitle] = useState(item.title)
  const [text, setText] = useState(item.notes ?? '')
  const [listId, setListId] = useState(item.listId)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Only to lists of the same kind (a note doesn't become a shopping item) that you can edit.
  const moveChoices = lists.filter((l) => l.kind === list.kind && (l.id === item.listId || app.canEdit(l)))

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const moveTo = listId !== item.listId ? lists.find((l) => l.id === listId) : undefined
      await updateTask(item.id, { title: title.trim() || item.title, notes: text.trim() ? text : undefined }, moveTo)
      app.selectTask(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${item.title}"?`)) return
    try {
      await deleteTask(item.id)
      app.selectTask(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <form className="task-details form" onSubmit={save}>
      <header className="row panel-header">
        <h3 className="grow">{isNote ? 'Note' : 'Item'}</h3>
        {editable && (
          <button type="submit" className="small" disabled={busy}>
            Save
          </button>
        )}
        <button type="button" className="link" onClick={() => app.selectTask(null)} aria-label="Close">
          ✕
        </button>
      </header>
      <fieldset disabled={!editable}>
        <label>
          {isNote ? 'Title' : 'Item'}
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          {isNote ? 'Note' : 'Details'}
          <textarea
            rows={isNote ? 14 : 3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isNote ? 'Anything worth keeping: numbers, sizes, passwords, instructions…' : 'Size, brand, where to get it…'}
          />
        </label>
        {moveChoices.length > 1 && (
          <label>
            {isNote ? 'Notes list' : 'Checklist'}
            <select value={listId} onChange={(e) => setListId(e.target.value)}>
              {moveChoices.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.visibility})
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
      {error && <p className="error">{error}</p>}
      {editable && (
        <div className="row">
          <span className="grow" />
          <button type="button" className="danger small" onClick={remove}>
            Delete
          </button>
        </div>
      )}
    </form>
  )
}
