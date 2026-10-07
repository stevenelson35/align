import { useEffect, useRef, useState, type FormEvent } from 'react'
import { execute, type Reply } from '../../chat/execute'
import { useApp, useData } from '../../hooks/useApp'
import { useTokenBalance } from '../../hooks/useVoting'

type Message = { from: 'me'; text: string } | { from: 'align'; reply: Reply }

// Kept across open/close of the panel for the session.
let history: Message[] = [{ from: 'align', reply: { text: 'Hi! Type a command, or "help" to see examples.' } }]

/** Slide-over chat panel with the local command parser (DESIGN.md §9). No AI service: zero cost. */
export function ChatPanel({ initialDraft, onClose }: { initialDraft: string; onClose: () => void }) {
  const app = useApp()
  const data = useData()
  const balance = useTokenBalance()
  const [messages, setMessages] = useState(history)
  const [draft, setDraft] = useState(initialDraft)
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    history = messages
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  useEffect(() => inputRef.current?.focus(), [])

  const push = (m: Message) => setMessages((ms) => [...ms, m])

  async function send(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    push({ from: 'me', text })
    setBusy(true)
    push({ from: 'align', reply: await execute(text, { app, data, balance }) })
    setBusy(false)
  }

  async function runAction(run: () => Promise<Reply | void> | Reply | void) {
    const reply = await run()
    if (reply) push({ from: 'align', reply })
  }

  return (
    <aside className="chat-panel">
      <header className="row">
        <strong className="grow">Chat</strong>
        <button type="button" className="link" onClick={onClose} aria-label="Close chat">
          ✕
        </button>
      </header>
      <div className="chat-messages">
        {messages.map((m, i) =>
          m.from === 'me' ? (
            <div key={i} className="msg me">
              {m.text}
            </div>
          ) : (
            <div key={i} className="msg align">
              <div>{m.reply.text}</div>
              {m.reply.lines && (
                <ul>
                  {m.reply.lines.map((l, j) => (
                    <li key={j}>{l}</li>
                  ))}
                </ul>
              )}
              {m.reply.actions && (
                <div className="chips">
                  {m.reply.actions.map((a, j) => (
                    <button key={j} type="button" className="secondary small" onClick={() => runAction(a.run)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>
      <form className="row" onSubmit={send}>
        <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder='e.g. "add task mow lawn on Saturday"' />
        <button type="submit" disabled={busy}>
          Send
        </button>
      </form>
    </aside>
  )
}
