import { useState } from 'react'
import { useApp } from '../../hooks/useApp'
import type { Task } from '../../types'
import { people } from '../../utils/tasks'
import { smsUrl, taskLink, textBody, whenText } from '../../utils/text'

/**
 * "💬 Text about this": pick a person, type a note; Messages opens with your note plus this task's title, time and
 * link filled in, and you press Send. A real text from your phone, so replies come back as normal texts.
 */
export function TextAbout({ task }: { task: Task }) {
  const { household, uid } = useApp()
  const [open, setOpen] = useState(false)
  const others = people(household).filter(([id]) => id !== uid)
  const firstWithPhone = others.find(([, m]) => m.phone)?.[0] ?? others[0]?.[0] ?? ''
  const [to, setTo] = useState(firstWithPhone)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  if (others.length === 0) return null

  const body = textBody(message, { title: task.title, when: whenText(task), link: taskLink(task.id) })
  const phone = household.members[to]?.phone
  return (
    <div className="text-about">
      {!open ? (
        <button type="button" className="secondary small" onClick={() => setOpen(true)}>
          💬 Text about this
        </button>
      ) : (
        <>
          <span className="label">Text about this</span>
          <div className="row">
            <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Text to">
              {others.map(([id, m]) => (
                <option key={id} value={id}>
                  {m.displayName}
                  {!m.phone && ' (no number yet)'}
                </option>
              ))}
            </select>
          </div>
          <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message (optional)" aria-label="Message" />
          <pre className="text-preview small">{body}</pre>
          <div className="row">
            {phone ? (
              <a className="button-link small primary-link" href={smsUrl(phone, body)}>
                📱 Send text
              </a>
            ) : (
              <span className="muted small">{household.members[to]?.displayName} hasn't added a mobile number in ⚙ Settings yet.</span>
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
