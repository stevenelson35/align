import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../hooks/useApp'
import type { Task } from '../../types'
import { people } from '../../utils/tasks'
import { shareLink, smsUrl, textBody, whenText } from '../../utils/text'

/**
 * "💬 Text about this": pick a person, type a note; Messages opens with your note plus this task's title, time and
 * link filled in, and you press Send. A real text from your phone, so replies come back as normal texts.
 */
export function TextAbout({ task }: { task: Task }) {
  const { textingId } = useApp()
  // The 💬 on a list row opens it ready to write.
  return <TextForm subject={{ title: task.title, when: whenText(task), link: shareLink(task) }} startOpen={textingId === task.id} label="Text about this" />
}

/** The texting form for any subject (a task, a link, a new blog post): pick a person, add a note, open Messages. */
export function TextForm({ subject, startOpen, label }: { subject: { title: string; when: string; link: string }; startOpen: boolean; label: string }) {
  const { household, uid } = useApp()
  const [open, setOpen] = useState(startOpen)
  const others = people(household).filter(([id]) => id !== uid)
  const firstWithPhone = others.find(([, m]) => m.phone)?.[0] ?? others[0]?.[0] ?? ''
  const [to, setTo] = useState(firstWithPhone)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
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
  return (
    <div className="text-about">
      {!open ? (
        <button type="button" className="secondary small" onClick={() => setOpen(true)}>
          💬 {label}
        </button>
      ) : (
        <>
          <span className="label">{label}</span>
          {others.length === 0 && (
            <p className="muted small">
              No one else has an Align account yet. Once they do, and add their mobile number in ⚙ Settings, you can text them from here.
              Meanwhile you can copy the text below.
            </p>
          )}
          <div className="row" hidden={others.length === 0}>
            <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Text to">
              {others.map(([id, m]) => (
                <option key={id} value={id}>
                  {m.displayName}
                  {!m.phone && ' (no number yet)'}
                </option>
              ))}
            </select>
          </div>
          <textarea ref={boxRef} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message (optional)" aria-label="Message" />
          <pre className="text-preview small">{body}</pre>
          <div className="row">
            {phone ? (
              <a className="button-link small primary-link" href={smsUrl(phone, body)}>
                📱 Send text
              </a>
            ) : (
              others.length > 0 && (
                <span className="muted small">{household.members[to]?.displayName} hasn't added a mobile number in ⚙ Settings yet.</span>
              )
            )}
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
            <span className="grow" />
            <button type="button" className="link small" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </>
      )}
    </div>
  )
}
