import { useState } from 'react'
import { calendarSyncUrl, refreshCalendar } from '../../firebase/calendarSync'
import { useApp } from '../../hooks/useApp'

/** "↻ Refresh calendar": syncs Google Calendar now. New events then arrive through the live data, no reload. */
export function CalendarRefresh() {
  const { isMember } = useApp()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null)
  if (!calendarSyncUrl || !isMember) return null

  async function run() {
    setBusy(true)
    setNote(null)
    try {
      const r = await refreshCalendar()
      if (!r.ok) setNote({ text: r.error ?? 'That didn’t work.', error: true })
      else if (r.skipped) setNote({ text: 'Just refreshed; it’s up to date.' })
      else {
        const changes = (r.created ?? 0) + (r.updated ?? 0) + (r.removed ?? 0)
        setNote({ text: changes ? `Calendar refreshed: ${r.created} new, ${r.updated} changed, ${r.removed} removed.` : 'Calendar is up to date.' })
      }
    } catch (err) {
      setNote({ text: `Couldn’t reach the calendar sync (${err instanceof Error ? err.message : String(err)}).`, error: true })
    }
    setBusy(false)
  }

  return (
    <span className="calendar-refresh">
      <button type="button" className="secondary small" onClick={run} disabled={busy} title="Sync Google Calendar now">
        {busy ? 'Refreshing…' : '↻ Refresh calendar'}
      </button>
      {note && <span className={`small${note.error ? ' error-text' : ' muted'}`}>{note.text}</span>}
    </span>
  )
}
