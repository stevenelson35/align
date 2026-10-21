import { useState, type FormEvent } from 'react'
import { updateItem } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import type { BoardItem } from '../../types'
import { Comments } from './Comments'
import { Icon } from '../UI/Icon'
import { cleanDetails, detailsOf, hasDetails, storedDetails } from '../../utils/details'
import { itemLink } from '../../utils/text'
import { DetailsFields, DetailsView } from '../UI/Details'
import { TextForm } from '../Tasks/TextAbout'

/**
 * A voting item opened up: its note, links and pictures (the shared Details boxes), an Edit form, Text about this
 * (a link that opens this item), and comments.
 */
export function ItemDetail({ item }: { item: BoardItem }) {
  const { isMember } = useApp()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: item.title, ...detailsOf(item) })
  const [error, setError] = useState<string | null>(null)

  function save(e: FormEvent) {
    e.preventDefault()
    const details = cleanDetails(form)
    if (typeof details === 'string') {
      setError(details)
      return
    }
    setError(null)
    updateItem(item, { title: form.title.trim() || item.title, note: details.note, ...storedDetails(details) })
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
          <DetailsView {...detailsOf(item)} alt={item.title} />
          {isMember && (
            <button type="button" className="secondary small" onClick={() => setEditing(true)}>
              <Icon name="edit" /> Edit {hasDetails(item) ? '' : '(add a note, links or pictures)'}
            </button>
          )}
        </>
      )}
      {isMember && <TextForm subject={{ title: item.title, when: '', link: itemLink(item.boardId, item.id) }} startOpen={false} label="Text about this" />}
      <Comments boardId={item.boardId} itemId={item.id} />
    </div>
  )
}
