import { useApp } from '../../hooks/useApp'
import { people, sharedNames } from '../../utils/tasks'
import { Icon } from '../UI/Icon'

/**
 * "👥 Chosen people": name chips plus a Parents shortcut. The owner is always included. Used by the list and goal
 * editors; what's saved is exactly the chosen uids (`sharedWith`).
 */
export function SharePicker({ ownerId, sharedWith, onChange, noun }: { ownerId: string; sharedWith: string[]; onChange: (uids: string[]) => void; noun: string }) {
  const app = useApp()
  const everyone = people(app.household)
  const chosen = new Set([ownerId, ...sharedWith])
  const parents = (app.household.groups?.parents ?? []).filter((id) => app.household.members[id])
  const toggle = (id: string) => {
    if (id === ownerId) return
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }
  return (
    <div className="share-picker">
      <span className="label">Share with</span>
      <div className="chips">
        {parents.length > 0 && (
          <button
            type="button"
            className="secondary small"
            onClick={() => onChange([...new Set([ownerId, ...parents])])}
            title={`Just the parents: ${parents.map((id) => app.household.members[id].displayName).join(', ')}`}
          >
            Parents
          </button>
        )}
        {everyone.map(([id, m]) => (
          <label key={id} className={`chip-toggle${chosen.has(id) ? ' on' : ''}`} title={id === ownerId ? 'The owner is always included' : ''}>
            <input type="checkbox" checked={chosen.has(id)} disabled={id === ownerId} onChange={() => toggle(id)} />
            {id === app.uid ? 'You' : m.displayName}
            {m.role === 'viewer' && ' (viewer)'}
          </label>
        ))}
      </div>
      <p className="muted small">
        <Icon name="shared" /> {sharedNames([...chosen], app.household, app.uid)} will see this {noun}. Only people on it can open it.
        {parents.length === 0 && ' (Set who the parents are in ⚙ Settings for a one-tap "Parents" choice.)'}
      </p>
    </div>
  )
}
