import { useState, type FormEvent } from 'react'
import { updateItem } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import type { BoardItem } from '../../types'
import { Comments } from './Comments'
import { Icon } from '../UI/Icon'
import { cleanDetails } from '../../utils/details'
import { DetailsFields, DetailsView } from '../UI/Details'

/** A voting item opened up: its note, link and picture (the shared Details boxes), an Edit form, and comments. */
export function ItemDetail({ item }: { item: BoardItem }) {
  const { isMember } = useApp()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: item.title, note: item.note ?? '', url: item.url ?? '', imageUrl: item.imageUrl ?? '' })
  const [error, setError] = useState<string | null>(null)

  function save(e: FormEvent) {
    e.preventDefault()
    const details = cleanDetails(form)
    if (typeof details === 'string') {
      setError(details)
      return
    }
    setError(null)
    updateItem(item, { title: form.title.trim() || item.title, ...details })
      .then(() => setEditing(false))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }

  return (
    <div className="item-detail">
      {editing ? (
        <form className="form" onSubmit={save}>
          <label>
            Title
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </label>
          <DetailsFields value={form} onChange={(d) => setForm({ ...form, ...d })} onError={setError} linkHint="e.g. a trailer or menu" />
          {error && <p className="error small">{error}</p>}
          <div className="row">
            <button type="submit" className="small">
              Save
            </button>
            <button type="button" className="secondary small" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <DetailsView note={item.note} url={item.url} imageUrl={item.imageUrl} alt={item.title} />
          {isMember && (
            <button type="button" className="secondary small" onClick={() => setEditing(true)}>
              <Icon name="edit" /> Edit {item.note || item.url || item.imageUrl ? '' : '(add a note, link or picture)'}
            </button>
          )}
        </>
      )}
      <Comments boardId={item.boardId} itemId={item.id} />
    </div>
  )
}
