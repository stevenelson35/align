import { useState, type FormEvent } from 'react'
import { commentThread, deleteRemovedImages, updateItem } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import type { BoardItem } from '../../types'
import { Icon } from '../UI/Icon'
import { cleanDetails, detailsOf, hasDetails, storedDetails } from '../../utils/details'
import { itemLink } from '../../utils/text'
import { DetailsFields } from '../UI/Details'
import { EntryExtras } from '../UI/EntryExtras'

/**
 * A voting item opened up: the common EntryExtras block (note, links, pictures, comments, Text about this with a
 * link that opens this item) and Edit.
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
      .then(() => {
        setEditing(false)
        return deleteRemovedImages(detailsOf(item).images, details.images)
      })
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
          {isMember && (
            <div className="row entry-actions">
              <span className="grow" />
              <button type="button" className="secondary small" onClick={() => setEditing(true)}>
                <Icon name="edit" /> Edit {hasDetails(item) ? '' : '(add a note, links or pictures)'}
              </button>
            </div>
          )}
          <EntryExtras details={detailsOf(item)} alt={item.title} thread={commentThread.boardItem(item.boardId, item.id)} text={{ title: item.title, when: '', link: itemLink(item.boardId, item.id) }} />
        </>
      )}
    </div>
  )
}
