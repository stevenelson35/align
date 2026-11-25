import { useState, type FormEvent } from 'react'
import { MAX_TITLE, sendToInbox } from '../../firebase/inbox'
import { useApp } from '../../hooks/useApp'
import { people } from '../../utils/tasks'
import { Icon } from '../UI/Icon'

/**
 * A message of its own (not about an entry): to one person's Inbox, with a notification if they turned them on.
 * `to`: who it's for at first (Reply).
 */
export function InboxCompose({ to: start, onDone }: { to?: string; onDone: () => void }) {
  const { uid, household } = useApp()
  const others = people(household)
    .filter(([id]) => id !== uid)
    .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))
  const [to, setTo] = useState(start && household.members[start] ? start : (others[0]?.[0] ?? ''))
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toName = household.members[to]?.displayName ?? 'them'

  async function send(e: FormEvent) {
    e.preventDefault()
    const text = message.trim()
    if (!text || !to) return
    setBusy(true)
    setError(null)
    try {
      // A short message is the whole line ("Steve: Dinner at 6?"); a long one starts it and the rest shows under it.
      const title = text.length <= 120 ? text : `${text.slice(0, 117).trimEnd()}…`
      await sendToInbox(uid, [to], { kind: 'note', title: title.slice(0, MAX_TITLE), ...(text.length > 120 ? { text } : {}), link: '#/inbox' })
      setMessage('')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setBusy(false)
  }

  if (!others.length) return <p className="muted small">No one else has an Align account yet.</p>
  return (
    <form className="inbox-compose" onSubmit={send}>
      <label className="small">
        To{' '}
        <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Send to">
          {others.map(([id, m]) => (
            <option key={id} value={id}>
              {m.displayName}
            </option>
          ))}
        </select>
      </label>
      <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`Message to ${toName}`} aria-label="Message" autoFocus maxLength={2000} />
      {error && <p className="error small">{error}</p>}
      <div className="row">
        <button type="submit" className="small" disabled={busy || !message.trim()}>
          <Icon name="send" /> {busy ? 'Sending…' : `Send to ${toName}`}
        </button>
        <button type="button" className="link small" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}
