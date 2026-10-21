import { useState, type FormEvent } from 'react'
import { chooseImage } from '../../blog/cloudinary'
import { updateItem } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import type { BoardItem } from '../../types'
import { safeUrl } from '../../utils/links'
import { Comments } from './Comments'
import { Icon } from '../UI/Icon'

/**
 * A voting item opened up: its note, link and picture, an Edit form, and comments. Pictures upload through the same
 * Cloudinary widget as blog posts (anyone with the image's long address can open it), or paste an image address.
 */
export function ItemDetail({ item }: { item: BoardItem }) {
  const { isMember } = useApp()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: item.title, note: item.note ?? '', url: item.url ?? '', imageUrl: item.imageUrl ?? '' })
  const [error, setError] = useState<string | null>(null)
  const link = safeUrl(item.url)
  const picture = safeUrl(item.imageUrl)

  function save(e: FormEvent) {
    e.preventDefault()
    const url = form.url.trim() ? safeUrl(form.url) : ''
    const imageUrl = form.imageUrl.trim() ? safeUrl(form.imageUrl) : ''
    if (url === null || imageUrl === null) {
      setError('That doesn’t look like a web address.')
      return
    }
    setError(null)
    updateItem(item, { title: form.title.trim() || item.title, note: form.note.trim(), url, imageUrl })
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
          <label>
            Note
            <textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={5000} />
          </label>
          <label>
            Link
            <input type="text" inputMode="url" autoCapitalize="off" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="e.g. a trailer or menu" />
          </label>
          <div>
            <span className="label">Picture</span>
            <div className="row">
              <button
                type="button"
                className="secondary small"
                onClick={() => chooseImage(({ url }) => setForm((f) => ({ ...f, imageUrl: url }))).catch((err) => setError(String(err.message ?? err)))}
              >
                <Icon name="camera" /> {form.imageUrl ? 'Change picture' : 'Upload picture'}
              </button>
              {form.imageUrl && (
                <button type="button" className="link small" onClick={() => setForm({ ...form, imageUrl: '' })}>
                  Remove
                </button>
              )}
            </div>
            <input
              type="text"
              inputMode="url"
              autoCapitalize="off"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="…or paste a picture's address"
              aria-label="Picture address"
            />
          </div>
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
          {item.note && <p className="item-note">{item.note}</p>}
          {link && (
            <p className="small">
              <a href={link} target="_blank" rel="noopener noreferrer">
                {item.url} ↗
              </a>
            </p>
          )}
          {picture && (
            <a href={picture} target="_blank" rel="noopener noreferrer">
              <img src={picture} alt={item.title} className="item-picture" loading="lazy" />
            </a>
          )}
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
