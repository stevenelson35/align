import { useState, type FormEvent } from 'react'
import { addTaskNow, deleteTask, updateTask, withStatus } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import type { List, Task } from '../../types'
import { ListHeader } from './ListHeader'
import { Icon } from '../UI/Icon'
import { splitTitleNote } from '../../utils/quickAdd'
import { EntryRow } from '../Entries/EntryRow'
import { EntrySizeSwitch } from '../Entries/EntrySizeSwitch'
import { useEntrySize } from '../../hooks/useEntrySize'

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
  const [size, setSize] = useEntrySize(list)

  const items = listItems.filter((t) => t.listId === list.id)
  const open = items.filter((t) => t.status !== 'done').sort(addedOrder)
  const checked = items.filter((t) => t.status === 'done').sort(addedOrder)
  const shown = hideChecked ? open : [...open, ...checked]

  function add(e: FormEvent) {
    e.preventDefault()
    const text = title.trim()
    if (!text) return
    setError(null)
    setTitle('') // clear at once: the item shows immediately, and a second tap finds nothing to add
    addTaskNow(list, { ...splitTitleNote(text), priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [] }, app.uid).written.catch((err) => {
      setError(err instanceof Error ? err.message : String(err))
      setTitle(text)
    })
  }

  async function clearChecked() {
    if (!window.confirm(`Delete the ${checked.length} checked item(s) from ${list.name}?`)) return
    try {
      for (const t of checked) await deleteTask(t)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section>
      <ListHeader list={list}>
        <EntrySizeSwitch value={size} onChange={setSize} />
      </ListHeader>
      {editable && (
        <form className="row add-task" onSubmit={add}>
          <input placeholder="Add an item… (item: details)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New item" />
<button type="submit" className="icon-button" aria-label="Add" title="Add">
            <Icon name="plus" />
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <ul className="entry-list">
        {shown.map((t) => (
          <EntryRow
            key={t.id}
            entry={t}
            size={size}
            className={t.status === 'done' ? 'checked' : ''}
            check={{
              checked: t.status === 'done',
              disabled: !editable,
              label: `Check off ${t.title}`,
              onChange: (on) => updateTask(t.id, withStatus(t, on ? 'done' : 'todo')).catch((err) => setError(String(err))),
            }}
          />
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
