import { useEffect, useRef, useState } from 'react'
import { today } from '../../engine/dates'
import { calendarSyncUrl, refreshCalendar } from '../../firebase/calendarSync'
import { useApp } from '../../hooks/useApp'
import { googleCalendarDayUrl } from '../../utils/calendar'

/**
 * "📅 Google Calendar ↗" (opens today in a new tab, to check or change the family calendar) and "↻ Refresh calendar"
 * (syncs it now; new events then arrive through the live data, no reload). Coming back to Align after opening
 * Google Calendar from here refreshes automatically, so edits made there show up without another tap.
 */
export function CalendarActions() {
  const { isMember } = useApp()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null)
  const wentToCalendar = useRef(false)
  const canRefresh = !!calendarSyncUrl && isMember

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

  // Back from the Google Calendar tab: pick up whatever was changed there.
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  })
  useEffect(() => {
    if (!canRefresh) return
    const onVisible = () => {
      if (document.visibilityState === 'visible' && wentToCalendar.current) {
        wentToCalendar.current = false
        void runRef.current()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [canRefresh])

  if (!isMember) return null
  return (
    <span className="calendar-refresh">
      <a
        className="button-link secondary small"
        href={googleCalendarDayUrl(today())}
        target="_blank"
        rel="noopener noreferrer"
        title="Open the family calendar in Google Calendar (new tab)"
        onClick={() => (wentToCalendar.current = true)}
      >
        📅 Google Calendar ↗
      </a>
      {canRefresh && (
        <button type="button" className="secondary small" onClick={run} disabled={busy} title="Sync Google Calendar now">
          {busy ? 'Refreshing…' : '↻ Refresh calendar'}
        </button>
      )}
      {note && <span className={`small${note.error ? ' error-text' : ' muted'}`}>{note.text}</span>}
    </span>
  )
}
