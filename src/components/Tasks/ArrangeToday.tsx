import { useState } from 'react'
import { setTodayMore } from '../../firebase/db'
import { useApp } from '../../hooks/useApp'
import { DEFAULT_MORE, moreOf, TODAY_SECTIONS } from '../../utils/today'

/**
 * Arrange Today: each section on the main page or in More… (one tap moves it), saved for you on every device. To Do
 * always stays on the main page. People and links go in Shortcuts ("Add to Shortcuts" in their details).
 */
export function ArrangeToday() {
  const { uid, member } = useApp()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const more = moreOf(member)
  const move = (id: string, toMore: boolean) => {
    const next = TODAY_SECTIONS.map((s) => s.id).filter((s) => (s === id ? toMore : more.has(s)))
    setTodayMore(uid, next).catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }
  if (!open)
    return (
      <p className="small">
        <button type="button" className="link small" onClick={() => setOpen(true)}>
          Arrange Today…
        </button>
      </p>
    )
  return (
    <div className="day-section arrange-today">
      <h3 className="row">
        <span className="grow">Arrange Today</span>
        <button type="button" className="link small" onClick={() => setOpen(false)}>
          Done
        </button>
      </h3>
      <p className="muted small">Move what you use most to the main page and the rest into More…. To Do always stays. To keep a person or a link one tap away, open it and tap “Add to Shortcuts”.</p>
      {TODAY_SECTIONS.map((s) => {
        const inMore = more.has(s.id)
        return (
          <div key={s.id} className="arrange-row">
            <span className="grow">{s.label}</span>
            <span className="muted small">{inMore ? 'in More…' : 'on Today'}</span>
            <button type="button" className="secondary small" onClick={() => move(s.id, !inMore)}>
              {inMore ? '↑ Move to Today' : '↓ Move to More…'}
            </button>
          </div>
        )
      })}
      {member.todayMore && (
        <button type="button" className="link small" onClick={() => setTodayMore(uid, DEFAULT_MORE).catch((err) => setError(String(err)))}>
          Back to the usual arrangement
        </button>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  )
}
