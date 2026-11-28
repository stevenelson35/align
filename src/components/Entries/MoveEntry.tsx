import { useState, type FormEvent } from 'react'
import { updateTask } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List, Task } from '../../types'
import { AUDIENCE_ICON, audienceLabel, audienceOf } from '../../utils/audience'
import { isItemList, privacyText } from '../../utils/tasks'
import { entryListLabel } from '../../utils/listKinds'
import { canAddIdeas } from '../../utils/gifts'
import { Icon } from '../UI/Icon'

/** A focused move form shared by task and item panels. */
export function MoveEntry({ item, list, onDone }: { item: Task; list: List; onDone: () => void }) {
  const app = useApp()
  const { lists } = useData()
  const [listId, setListId] = useState(item.listId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const choices = lists.filter((candidate) => (
    candidate.id === item.listId ||
    (isItemList(list) ? candidate.kind === list.kind && (
      app.canEdit(candidate) || list.kind === 'gifts' && canAddIdeas(candidate, app.member.role, false)
    ) : app.canEdit(candidate) && !isItemList(candidate))
  ))
  const target = lists.find((candidate) => candidate.id === listId)
  const noun = list.kind === 'notes' ? 'note' : list.kind === 'links' ? 'link' : list.kind === 'gifts' ? 'gift idea' : isItemList(list) ? 'item' : 'task'
  const changed = listId !== item.listId

  async function move(e: FormEvent) {
    e.preventDefault()
    if (!changed || !target || busy) return
    setBusy(true)
    setError(null)
    try {
      await updateTask(item.id, {}, target, item)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <form className="task-details form" onSubmit={move}>
      <header className="row panel-header">
        <h3 className="grow">Move to another list</h3>
        <button type="submit" className="small" disabled={!changed || !target || busy}>
          Move
        </button>
        <button type="button" className="secondary small" onClick={onDone} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="link" onClick={() => app.selectTask(null)} aria-label="Close">
          ✕
        </button>
      </header>
      <label>
        {entryListLabel(list)}
        <select value={listId} onChange={(e) => setListId(e.target.value)} autoFocus>
          {choices.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} ({audienceLabel(audienceOf(candidate))})
            </option>
          ))}
        </select>
      </label>
      {!choices.some((candidate) => candidate.id !== item.listId) && (
        <p className="muted small">There aren't any other {entryListLabel(list).toLowerCase()} choices you can edit.</p>
      )}
      {target && (
        <p className="privacy-note">
          <Icon name={AUDIENCE_ICON[audienceOf(target)]} /> {privacyText(target, noun, app.household, app.uid)}
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </form>
  )
}
