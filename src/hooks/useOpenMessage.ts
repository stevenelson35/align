import { markRead, type InboxMessage } from '../firebase/inbox'

/** Opens what a message is about (and marks it read): an Align page, or a web page in a new tab. */
export function useOpenMessage() {
  return (m: InboxMessage) => {
    if (!m.read) void markRead([m.id]).catch(() => undefined)
    const link = m.link
    if (link.startsWith('#/')) window.location.hash = link
    else if (/^https?:\/\//.test(link)) window.open(link, '_blank', 'noopener,noreferrer')
  }
}
