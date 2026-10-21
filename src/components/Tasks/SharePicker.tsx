import { useApp } from '../../hooks/useApp'
import { people, sharedNames } from '../../utils/tasks'
import { Icon } from '../UI/Icon'

/**
 * "Chosen people": name chips (the owner is always included), for the "Chosen people" choice of AudiencePicker.
 * `forLogging` leaves out view-only accounts (they can't log) and says "can log" instead of "will see".
 */
export function SharePicker({
  ownerId,
  sharedWith,
  onChange,
  noun,
  forLogging = false,
}: {
  ownerId: string
  sharedWith: string[]
  onChange: (uids: string[]) => void
  noun: string
  forLogging?: boolean
}) {
  const app = useApp()
  const everyone = people(app.household, forLogging)
  const chosen = new Set([ownerId, ...sharedWith])
  const toggle = (id: string) => {
    if (id === ownerId) return
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }
  return (
    <div className="share-picker">
      <div className="chips">
        {everyone.map(([id, m]) => (
          <label key={id} className={`chip-toggle${chosen.has(id) ? ' on' : ''}`} title={id === ownerId ? 'The owner is always included' : ''}>
            <input type="checkbox" checked={chosen.has(id)} disabled={id === ownerId} onChange={() => toggle(id)} />
            {id === app.uid ? 'You' : m.displayName}
            {m.role === 'viewer' && ' (view only)'}
          </label>
        ))}
      </div>
      <p className="muted small">
        <Icon name="shared" /> {sharedNames([...chosen], app.household, app.uid)} {forLogging ? `can log this ${noun}.` : `will see this ${noun}. Only people on it can open it.`}
      </p>
    </div>
  )
}
