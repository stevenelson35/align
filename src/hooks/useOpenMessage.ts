import { markRead, type InboxMessage } from '../firebase/inbox'

/** Opens what a message is about (and marks it read): an Align page, or a web page in a new tab. */
export function useOpenMessage() {
  return (m: InboxMessage) => {
    if (!m.read) void markRead([m.id]).catch(() => undefined)
    // A Wordle invitation sent before invitations had a page went to today's Wordle; the Games page lists them.
    const link = m.kind === 'game' && m.link === '#/games/play/wordle' ? '#/games' : m.link
    if (link.startsWith('#/')) window.location.hash = link
    else if (/^https?:\/\//.test(link)) window.open(link, '_blank', 'noopener,noreferrer')
  }
}
