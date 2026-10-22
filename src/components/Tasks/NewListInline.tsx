import { useState } from 'react'
import { createList } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import type { List } from '../../types'
import { audienceLabel, parentsOf, privacyFields } from '../../utils/audience'
import { Icon } from '../UI/Icon'

/**
 * "+ New list…" from a list chooser: type a name, Create. It gets your default "who can see it" (Settings), which
 * Edit list can change later. Calls back with the new list's id (the list shows at once from the local write).
 */
export function NewListInline({ kind, onCreated, onCancel }: { kind: List['kind']; onCreated: (id: string) => void; onCancel: () => void }) {
  const app = useApp()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audience = app.member.defaultVisibility ?? 'everyone'
  const noun = kind === 'checklist' ? 'checklist' : 'list'

  async function create() {
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const id = await createList({ name: name.trim(), kind, ownerId: app.uid, defaultContext: 'family', ...privacyFields(audience, app.uid, [], parentsOf(app.household)) })
      onCreated(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="new-list-inline">
      <div className="row">
        <input
          autoFocus
          className="grow"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void create()
            }
            if (e.key === 'Escape') onCancel()
          }}
          placeholder={`New ${noun} name`}
          maxLength={100}
          aria-label={`New ${noun} name`}
        />
        <button type="button" className="small" onClick={create} disabled={!name.trim() || busy}>
          <Icon name="plus" /> Create
        </button>
        <button type="button" className="link small" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p className="muted small">Who can see it: {audienceLabel(audience)} (your default; change it later with Edit list).</p>
      {error && <p className="error small">{error}</p>}
    </div>
  )
}
