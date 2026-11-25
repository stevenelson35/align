import { useEffect, useRef, useState } from 'react'
import { today } from '../../engine/dates'
import { calendarSyncUrl, refreshCalendar } from '../../firebase/calendarSync'
import { useApp } from '../../hooks/useApp'
import { googleCalendarDayUrl } from '../../utils/calendar'
import { Icon } from '../UI/Icon'

/**
 * Two small icons beside the date: 📅 (opens Google Calendar on today in a new tab, to check or change the family
 * calendar) and ↻ (syncs it now; new events then arrive through the live data, no reload). Coming back to Align after opening
 * Google Calendar from here refreshes automatically, so edits made there show up without another tap.
 */
export function CalendarActions() {
  const { isMember } = useApp()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null)
  const wentToCalendar = useRef(false)
  const canRefresh = !!calendarSyncUrl && isMember

  // After a refresh: ↻ dims for a minute (it's up to date), and the note fades after a few seconds.
  const [resting, setResting] = useState(false)
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), note.error ? 6000 : 3000)
    return () => clearTimeout(t)
  }, [note])
  useEffect(() => {
    if (!resting) return
    const t = setTimeout(() => setResting(false), 60_000)
    return () => clearTimeout(t)
  }, [resting])

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
      if (r.ok) setResting(true)
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
        className="link header-icon"
        href={googleCalendarDayUrl(today())}
        aria-label="Open Google Calendar (new tab)"
        target="_blank"
        rel="noopener noreferrer"
        title="Open the family calendar in Google Calendar (new tab)"
        onClick={() => (wentToCalendar.current = true)}
      >
        <Icon name="calendar" />
      </a>
      {canRefresh && (
        <button type="button" className={`link header-icon${busy ? ' spinning' : ''}`} onClick={run} disabled={busy || resting} title={resting ? 'Just refreshed' : 'Refresh the calendar (sync Google Calendar now)'} aria-label={busy ? 'Refreshing the calendar' : resting ? 'Calendar just refreshed' : 'Refresh the calendar'}>
          <Icon name="refresh" />
        </button>
      )}
      {/* What happened, for a moment, floating over the page (it doesn't push the header around). */}
      {note && (
        <span className={`toast small${note.error ? ' error' : ''}`} role="status">
          {note.text}
        </span>
      )}
    </span>
  )
}
