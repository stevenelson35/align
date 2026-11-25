import { useEffect, useState } from 'react'
import { clearInbox, clearOne, markRead, type InboxMessage } from '../../firebase/inbox'
import { useOpenMessage } from '../../hooks/useOpenMessage'
import { useApp } from '../../hooks/useApp'
import { useInbox } from '../../hooks/useInbox'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { useTodayExpansion } from '../../hooks/useTodaySection'
import { actionLabel, afterName } from '../../utils/inboxHeadline'
import { agoText } from '../../utils/location'
import { Icon, type IconName } from '../UI/Icon'
import { SectionHeader } from '../UI/SectionHeader'
import { NotifyToggle } from './NotifyToggle'
import { InboxCompose } from './InboxCompose'

const KIND_ICON: Record<InboxMessage['kind'], IconName> = { entry: 'note', link: 'link', board: 'star', photo: 'photo', game: 'sparkle', result: 'sparkle', note: 'message' }

/** How many read messages the Today tile shows (the Inbox page shows all). */
const TILE_READ = 3

/**
 * The Inbox (DESIGN.md §13, phase 4): what family members sent you in Align (entries, links, boards, photos, notes)
 * and game invitations, newest first. Tap one to open it (it's then read); ✕ clears it. On Today it's a tile with the
 * unread ones and the last few read; `page` is the whole Inbox (#/inbox).
 */
export function InboxPanel({ page = false }: { page?: boolean }) {
  const app = useApp()
  const { messages, unread, error, loaded } = useInbox()
  const [open, saveOpen] = useStoredFlag('align-today-inbox', true)
  const setOpen = useTodayExpansion(open, saveOpen)
  const [problem, setProblem] = useState<string | null>(null)
  const openMessage = useOpenMessage()
  const now = useMinute()
  const fail = (err: unknown) => setProblem(err instanceof Error ? err.message : String(err))
  const unreadOnes = messages.filter((m) => !m.read)
  const readOnes = messages.filter((m) => m.read)
  const shown = page ? messages : [...unreadOnes, ...readOnes.slice(0, TILE_READ)]
  const name = (uid: string) => app.household.members[uid]?.displayName ?? 'Someone'
  const expanded = page || open
  // Writing a message (to someone, or a reply to them; '' = pick).
  const [composing, setComposing] = useState<string | null>(null)
  const write = (to = '') => {
    if (!page && !open) setOpen(true)
    setComposing(to)
  }

  return (
    <div className="day-section inbox-panel">
      <SectionHeader icon="mail" title="Inbox" count={unread || undefined} onTitleClick={page ? undefined : () => setOpen(!open)} expanded={expanded} help="inbox">
        {unread > 0 && (
          <button type="button" className="link small" onClick={() => markRead(unreadOnes.map((m) => m.id)).catch(fail)}>
            Mark all read
          </button>
        )}
        {app.canPlay && (
          <button type="button" className="link small header-add" onClick={() => (composing === null ? write() : setComposing(null))} title="New message" aria-label="New message" aria-expanded={composing !== null}>
            <Icon name="compose" />
          </button>
        )}
        {!page && (
          <button type="button" className="link small" onClick={() => app.navigate({ view: 'inbox' })}>
            All
          </button>
        )}
      </SectionHeader>
      {expanded && (
        <div className="inbox-body">
          {composing !== null && <InboxCompose key={composing} to={composing || undefined} onDone={() => setComposing(null)} />}
          <NotifyToggle compact />
          {error && <p className="error small">{error.includes('index') ? 'The Inbox is still being set up (a few minutes after an update). Try again shortly.' : error}</p>}
          {problem && <p className="error small">{problem}</p>}
          {loaded && !messages.length && composing === null && (
            <p className="muted small inbox-empty">
              <Icon name="mail" /> No messages.{' '}
              {app.canPlay && (
                <button type="button" className="link small" onClick={() => write()}>
                  Write one
                </button>
              )}
            </p>
          )}
          <ul className="inbox-list">
            {shown.map((m) => (
              <li key={m.id} className={`inbox-row${m.read ? ' read' : ' unread'}${m.kind === 'game' || m.kind === 'result' ? ' game' : ''}`}>
                <button type="button" className="inbox-open" onClick={() => openMessage(m)} title={m.read ? 'Opened before; open again' : 'Open'}>
                  {m.read ? <span className="inbox-seen" aria-label="Opened"><Icon name="check" /></span> : <span className="inbox-dot" aria-label="New" />}
                  <Icon name={KIND_ICON[m.kind] ?? 'mail'} />
                  <span className="inbox-text">
                    <span className="inbox-line">
                      <strong>{name(m.from)}</strong>
                      {afterName(m)}
                    </span>
                    {m.text && <span className="inbox-note">{m.kind === 'game' || m.kind === 'result' ? m.text : `“${m.text}”`}</span>}
                  </span>
                  <span className="inbox-when muted small">{m.read ? 'seen · ' : ''}{m.createdAt ? agoText(m.createdAt.toMillis(), now) : 'just now'}</span>
                </button>
                {m.kind === 'note' && m.link === '#/inbox' && app.canPlay && app.household.members[m.from] && (
                  <button type="button" className="link small" onClick={() => write(m.from)} title={`Reply to ${name(m.from)}`}>
                    Reply
                  </button>
                )}
                {(m.kind === 'game' || m.kind === 'result') && (
                  <button type="button" className={`small inbox-play${m.read ? ' secondary' : ''}`} onClick={() => openMessage(m)} title={m.read ? 'You opened this; open it again' : actionLabel(m)}>
                    {m.read ? <><Icon name="check" /> Opened</> : actionLabel(m)}
                  </button>
                )}
                <button type="button" className="row-action" onClick={() => clearOne(m.id).catch(fail)} aria-label={`Clear ${m.title} from your Inbox`} title="Clear">
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
          {!page && readOnes.length > TILE_READ && (
            <button type="button" className="link small" onClick={() => app.navigate({ view: 'inbox' })}>
              {readOnes.length - TILE_READ} older
            </button>
          )}
          {page && readOnes.length > 0 && (
            <button type="button" className="link small" onClick={() => window.confirm(`Clear the ${readOnes.length} read message(s)?`) && clearInbox(readOnes.map((m) => m.id)).catch(fail)}>
              Clear read ({readOnes.length})
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** The time, every minute (for "5 min ago"). */
function useMinute() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}
