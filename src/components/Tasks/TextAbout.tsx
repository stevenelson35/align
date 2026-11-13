import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../hooks/useApp'
import type { Task } from '../../types'
import { people } from '../../utils/tasks'
import { shareLink, smsUrl, textBody, whenText } from '../../utils/text'
import { Icon } from '../UI/Icon'
import { sendToInbox, type InboxKind } from '../../firebase/inbox'
import { audienceLabel, audienceOf, canReadAs, type Readers } from '../../utils/audience'
import { useStoredChoice } from '../../hooks/useStoredChoice'

/** "💬 Send about this" for an entry: to their Inbox, as a text, or both (TextForm). */
export function TextAbout({ task }: { task: Task }) {
  const { textingId } = useApp()
  // The 💬 on a list row opens it ready to write.
  return <TextForm subject={{ title: task.title, when: whenText(task), link: shareLink(task), readers: task }} startOpen={textingId === task.id} label="Send about this" />
}

const VIA = ['align', 'text', 'both'] as const
type Via = (typeof VIA)[number]
const VIA_LABEL: Record<Via, string> = { align: 'Align', text: 'Text', both: 'Both' }

/**
 * "Send about this" for any subject (an entry, a link, a board, a photo, a new blog post): pick a person, add a note,
 * and send it to their Align Inbox (a notification within seconds), as a text from your own phone (Messages opens
 * filled in; you press Send), or both. The choice is remembered on this device; view-only accounts can only text.
 */
export function TextForm({
  subject,
  startOpen,
  label,
  initialMessage = '',
  kind = 'entry',
}: {
  subject: { title: string; when: string; link: string; /** Who can open it (a warning if the person you pick can't). */ readers?: Readers }
  startOpen: boolean
  label: string
  /** Starts the message (e.g. a comment being texted). */
  initialMessage?: string
  /** What it is, for the Inbox's icon. */
  kind?: InboxKind
}) {
  const { household, uid, isMember } = useApp()
  const [open, setOpen] = useState(startOpen)
  const others = people(household).filter(([id]) => id !== uid)
  const firstWithPhone = others.find(([, m]) => m.phone)?.[0] ?? others[0]?.[0] ?? ''
  const [to, setTo] = useState(isMember ? (others[0]?.[0] ?? '') : firstWithPhone)
  const [message, setMessage] = useState(initialMessage)
  const [copied, setCopied] = useState(false)
  const [savedVia, setVia] = useStoredChoice<Via>('align-send-via', VIA, 'align')
  const via: Via = isMember ? savedVia : 'text'
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  // Opened from a list row's 💬: the form sits at the bottom of a long panel, so bring it into view, ready to type.
  const fromRow = startOpen
  useEffect(() => {
    if (!fromRow || !boxRef.current) return
    boxRef.current.scrollIntoView({ block: 'center' })
    boxRef.current.focus({ preventScroll: true })
  }, [fromRow])

  const body = textBody(message, subject)
  const phone = household.members[to]?.phone
  const toName = household.members[to]?.displayName ?? 'them'
  const blind = !!subject.readers && !!to && !canReadAs(subject.readers, to, household.members[to]?.role)

  /** To their Inbox (and the push). With a text too, the link's own tap opens Messages. */
  async function toInbox() {
    setSending(true)
    setError(null)
    try {
      await sendToInbox(uid, [to], { kind, title: subject.when ? `${subject.title} (${subject.when})` : subject.title, text: message, link: subject.link })
      setSent(via === 'both' ? `Sent to ${toName}’s Inbox; Messages opened for the text.` : `Sent to ${toName}’s Inbox.`)
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setSending(false)
  }

  return (
    <div className="text-about">
      {!open ? (
        <button type="button" className="secondary small" onClick={() => setOpen(true)}>
          <Icon name="message" /> {label}
        </button>
      ) : (
        <>
          <span className="label">{label}</span>
          {others.length === 0 && (
            <p className="muted small">
              No one else has an Align account yet. Once they do, you can send things to their Inbox (and text them, once they add a mobile number in ⚙ Settings).
              Meanwhile you can copy the text below.
            </p>
          )}
          <div className="row wrap" hidden={others.length === 0}>
            <select value={to} onChange={(e) => { setTo(e.target.value); setSent(null) }} aria-label="Send to">
              {others.map(([id, m]) => (
                <option key={id} value={id}>
                  {m.displayName}
                  {!isMember && !m.phone && ' (no number yet)'}
                </option>
              ))}
            </select>
            {isMember && (
              <span className="segmented small" role="group" aria-label="Send via">
                {VIA.map((v) => (
                  <button key={v} type="button" className={via === v ? 'on' : ''} aria-pressed={via === v} onClick={() => { setVia(v); setSent(null) }}>
                    {VIA_LABEL[v]}
                  </button>
                ))}
              </span>
            )}
          </div>
          <textarea ref={boxRef} rows={2} value={message} onChange={(e) => { setMessage(e.target.value); setSent(null) }} placeholder="Your message (optional)" aria-label="Message" />
          {blind && (
            <p className="warn small">
              <Icon name="lock" /> {toName} can’t open this ({audienceLabel(audienceOf(subject.readers as Parameters<typeof audienceOf>[0]))}). They’ll get its name and your note, but the link won’t show it. Share its list with them first if they need it.
            </p>
          )}
          {via !== 'align' && <pre className="text-preview small">{body}</pre>}
          <div className="row wrap">
            {others.length > 0 && via === 'align' && (
              <button type="button" className="small" onClick={toInbox} disabled={sending || !to}>
                <Icon name="mail" /> Send to {toName}
              </button>
            )}
            {others.length > 0 && via !== 'align' &&
              (phone ? (
                <a className="button-link small primary-link" href={smsUrl(phone, body)} onClick={() => { if (via === 'both') void toInbox() }}>
                  <Icon name="phone" /> {via === 'both' ? `Send to ${toName} (Inbox + text)` : 'Send text'}
                </a>
              ) : (
                <span className="muted small">
                  {toName} hasn't added a mobile number in ⚙ Settings yet.{isMember && via === 'both' ? ' Send with Align instead.' : ''}
                </span>
              ))}
            {via !== 'align' && (
              <button
                type="button"
                className="secondary small"
                onClick={async () => {
                  await navigator.clipboard?.writeText(body)
                  setCopied(true)
                }}
              >
                {copied ? 'Copied' : 'Copy text'}
              </button>
            )}
            <span className="grow" />
            <button type="button" className="link small" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          {sent && <p className="small sent-note"><Icon name="check" /> {sent}</p>}
          {error && <p className="error small">{error}</p>}
        </>
      )}
    </div>
  )
}
