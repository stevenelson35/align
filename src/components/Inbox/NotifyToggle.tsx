import { useEffect, useState } from 'react'
import { disablePushHere, enablePushHere, pushProblem, pushTokenHere, saveAlertPrefs, useAlertPrefs } from '../../firebase/places'
import { useApp } from '../../hooks/useApp'
import { Icon } from '../UI/Icon'

/**
 * Notifications on this device (members): one switch for the Inbox and family map alerts alike (they share this
 * device's push address), plus whether Inbox messages notify at all. `compact`: only a "Turn on" nudge, shown while
 * they're off here (the Inbox tile).
 */
export function NotifyToggle({ compact = false }: { compact?: boolean }) {
  const app = useApp()
  const prefs = useAlertPrefs(app.uid)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('align-notify-nudge') === 'no')
  const token = pushTokenHere()
  const on = !!token && prefs.push.includes(token)
  useEffect(() => {
    void pushProblem().then(setProblem)
  }, [])
  if (!app.isMember) return null

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      if (on) await disablePushHere(app.uid, prefs.push)
      else await enablePushHere(app.uid, prefs.push)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setBusy(false)
  }

  if (compact) {
    if (on || dismissed || problem) return null
    return (
      <p className="notify-nudge small">
        <Icon name="phone" /> Get a notification on this device when something arrives.{' '}
        <button type="button" className="link small" onClick={toggle} disabled={busy}>
          Turn on
        </button>{' '}
        ·{' '}
        <button
          type="button"
          className="link small"
          onClick={() => {
            localStorage.setItem('align-notify-nudge', 'no')
            setDismissed(true)
          }}
        >
          Not now
        </button>
        {error && <span className="error small"> {error}</span>}
      </p>
    )
  }

  return (
    <div className="notify-setting">
      <label className="row">
        <input type="checkbox" checked={on} disabled={busy || (!on && !!problem)} onChange={toggle} /> Notifications on this device
      </label>
      {problem && !on && <p className="muted small">{problem}</p>}
      <label className="row">
        <input
          type="checkbox"
          checked={!prefs.inboxOff}
          onChange={() => saveAlertPrefs(app.uid, { inboxOff: !prefs.inboxOff }).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))}
        />{' '}
        Notify me when something arrives in my Inbox (messages, game invitations)
      </label>
      <p className="muted small">
        One switch per device: a phone with notifications on gets your Inbox and any family map alerts you set up. They arrive within seconds of being sent. On iPhone and iPad,
        add Align to the Home Screen first.
      </p>
      {error && <p className="error small">{error}</p>}
    </div>
  )
}
