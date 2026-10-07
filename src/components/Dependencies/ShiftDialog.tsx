import { useState } from 'react'
import type { PendingShift } from '../../context/AppContext'
import { formatDay } from '../../engine/dates'
import { applySchedule } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import { conflictUpdates } from '../../utils/tasks'

/** Shift preview (DESIGN.md §6.3): shows every move, then writes them as one batch. */
export function ShiftDialog({ shift, onClose }: { shift: PendingShift; onClose: () => void }) {
  const { canEdit } = useApp()
  const { tasks } = useData()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const title = (id: string) => tasks.find((t) => t.id === id)?.title ?? id
  const { moves, blocked } = shift.preview

  async function apply() {
    setBusy(true)
    try {
      await applySchedule(moves, conflictUpdates(tasks, shift.preview, canEdit))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h2>{shift.title}</h2>
        {moves.length === 0 && blocked.length === 0 && <p className="muted">Nothing needs to move.</p>}
        {moves.length > 0 && (
          <table className="moves">
            <thead>
              <tr>
                <th>Task</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id}>
                  <td>{title(m.id)}</td>
                  <td className="muted">{m.from ? formatDay(m.from) : '—'}</td>
                  <td>
                    {formatDay(m.to)}
                    {m.durationDays && ` (${m.durationDays}d)`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {blocked.length > 0 && (
          <>
            <p className="small">These can't be moved by you and will stay in conflict:</p>
            <ul className="small">
              {blocked.map((b) => (
                <li key={b.id}>
                  {title(b.id)}: {b.reason}
                </li>
              ))}
            </ul>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="button" onClick={apply} disabled={busy || moves.length === 0}>
            Apply {moves.length} change{moves.length === 1 ? '' : 's'}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
