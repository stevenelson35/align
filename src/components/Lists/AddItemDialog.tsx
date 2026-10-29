import { useState, type FormEvent } from 'react'
import { addTaskNow } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List } from '../../types'
import { audienceLabel, audienceOf } from '../../utils/audience'
import { cleanCategory, defaultName, safeUrl } from '../../utils/links'

/**
 * Add one link or one person from Today without leaving it: pick the list (links lists / contacts lists you can
 * edit; the last one used is remembered), then the name (and for a link, its address and category). A new person
 * opens in the side panel for their numbers and addresses.
 */
export function AddItemDialog({ kind, onClose }: { kind: 'links' | 'contacts'; onClose: () => void }) {
  const app = useApp()
  const { lists } = useData()
  const choices = lists.filter((l) => l.kind === kind && !l.giftSecret && app.canEdit(l)).sort((a, b) => a.name.localeCompare(b.name))
  const remembered = localStorage.getItem(`align-add-${kind}-list`)
  const [listId, setListId] = useState(choices.some((l) => l.id === remembered) ? remembered! : (choices[0]?.id ?? ''))
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState<string | null>(null)
  const noun = kind === 'links' ? 'link' : 'person'

  function save(e: FormEvent) {
    e.preventDefault()
    const list = choices.find((l) => l.id === listId) as List | undefined
    if (!list) return setError(`Make a ${kind === 'links' ? 'links' : 'contacts'} list first (Menu → + New list).`)
    let title = name.trim()
    const extra: { url?: string; category?: string } = {}
    if (kind === 'links') {
      const href = safeUrl(url)
      if (!href) return setError('That doesn’t look like a web address.')
      extra.url = href
      if (cleanCategory(category)) extra.category = cleanCategory(category)
      title ||= defaultName(href)
    }
    if (!title) return setError('Give it a name.')
    localStorage.setItem(`align-add-${kind}-list`, list.id)
    const { id, written } = addTaskNow(list, { title, priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [], ...extra }, app.uid)
    written.catch((err) => setError(err instanceof Error ? err.message : String(err)))
    if (kind === 'contacts') app.selectTask(id) // add numbers and addresses there
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card form modal" onSubmit={save} onClick={(e) => e.stopPropagation()} aria-label={`Add a ${noun}`}>
        <h2>Add a {noun}</h2>
        {choices.length > 1 && (
          <label>
            {kind === 'links' ? 'Links list' : 'Contacts list'}
            <select value={listId} onChange={(e) => setListId(e.target.value)}>
              {choices.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({audienceLabel(audienceOf(l))})
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === 'links' && (
          <label>
            Address
            <input type="text" inputMode="url" autoCapitalize="off" autoCorrect="off" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="school.example.com" required autoFocus />
          </label>
        )}
        <label>
          {kind === 'links' ? 'Name (optional)' : 'Name'}
          <input value={name} onChange={(e) => setName(e.target.value)} required={kind === 'contacts'} autoFocus={kind === 'contacts'} placeholder={kind === 'links' ? 'School portal' : 'First and last name'} />
        </label>
        {kind === 'links' && (
          <label>
            Category (optional)
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="School, Home/Utilities…" />
          </label>
        )}
        {!choices.length && <p className="muted small">You don’t have a {kind === 'links' ? 'links' : 'contacts'} list you can add to yet: make one from Menu → + New list.</p>}
        {error && <p className="error small">{error}</p>}
        <div className="row">
          <button type="submit" className="small" disabled={!choices.length}>
            Add
          </button>
          <button type="button" className="secondary small" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
