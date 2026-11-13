import { markRead, type InboxMessage } from '../firebase/inbox'

/** Opens what a message is about (and marks it read): an Align page, or a web page in a new tab. */
export function useOpenMessage() {
  return (m: InboxMessage) => {
    if (!m.read) void markRead([m.id]).catch(() => undefined)
    if (m.link.startsWith('#/')) window.location.hash = m.link
    else if (/^https?:\/\//.test(m.link)) window.open(m.link, '_blank', 'noopener,noreferrer')
  }
}
