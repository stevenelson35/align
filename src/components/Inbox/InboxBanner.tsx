import { useEffect, useRef, useState } from 'react'
import type { InboxMessage } from '../../firebase/inbox'
import { useApp } from '../../hooks/useApp'
import { useInbox } from '../../hooks/useInbox'
import { Icon } from '../UI/Icon'
import { useOpenMessage } from '../../hooks/useOpenMessage'

/** How long the banner stays (a game invitation stays until answered or closed). */
const SHOW_MS = 10_000

/**
 * A new message while Align is open: a banner at the top for a few seconds ("Steve: Buy milk · Open"), so a live game
 * invitation is seen at once even without notifications. Messages already there when Align opened don't show.
 */
export function InboxBanner() {
  const app = useApp()
  const { messages, loaded } = useInbox()
  const seen = useRef<Set<string> | null>(null)
  const [shown, setShown] = useState<InboxMessage | null>(null)
  const openMessage = useOpenMessage()
  useEffect(() => {
    if (!loaded) return
    if (!seen.current) {
      seen.current = new Set(messages.map((m) => m.id))
      return
    }
    const fresh = messages.find((m) => !m.read && !seen.current!.has(m.id))
    for (const m of messages) seen.current.add(m.id)
    if (fresh) setShown(fresh)
  }, [messages, loaded])
  useEffect(() => {
    if (!shown || shown.kind === 'game') return
    const t = setTimeout(() => setShown(null), SHOW_MS)
    return () => clearTimeout(t)
  }, [shown])
  if (!shown) return null
  const from = app.household.members[shown.from]?.displayName ?? 'Someone'
  return (
    <div className="inbox-banner" role="status">
      <Icon name={shown.kind === 'game' ? 'sparkle' : 'mail'} />
      <span className="grow">
        <strong>{from}</strong>
        {shown.kind === 'game' ? ' invited you: ' : ': '}
        {shown.title}
        {shown.text && <span className="muted"> “{shown.text}”</span>}
      </span>
      <button
        type="button"
        className="small"
        onClick={() => {
          openMessage(shown)
          setShown(null)
        }}
      >
        {shown.kind === 'game' ? 'Play' : 'Open'}
      </button>
      <button type="button" className="link" onClick={() => setShown(null)} aria-label="Close">
        <Icon name="close" />
      </button>
    </div>
  )
}
