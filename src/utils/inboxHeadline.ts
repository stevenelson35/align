// How an Inbox message reads in one line, after the sender's name (Inbox, banner; the Apps Script's notifications
// mirror it in inboxText_). Game messages are written as what the sender did ("invited you to play Lights Out",
// "completed today's Wordle (Fri, Nov 20): 3/6 in 2:03"); messages from before that keep their old wording. Pure.

export interface HeadlineMessage {
  kind: string
  title: string
  link: string
}

/** After the name: " completed today's Wordle …", " invited you: Lights Out" (older), ": Buy milk". */
export function afterName(m: HeadlineMessage): string {
  // A challenge's news reads the same way ("Steve reached 50% in The Road to 40").
  if (m.kind === 'challenge') return /^[a-z]/.test(m.title) ? ` ${m.title}` : `: ${m.title}`
  if (m.kind === 'result' || m.kind === 'game') {
    if (/^[a-z]/.test(m.title)) return ` ${m.title}`
    // Older messages: the day's Wordle result, then invitations with just the game's name.
    if (m.kind === 'result' || m.link.startsWith('#/games/play/')) return ` shared a result: ${m.title}`
    return ` invited you: ${m.title}`
  }
  return `: ${m.title}`
}

export const headline = (from: string, m: HeadlineMessage) => `${from}${afterName(m)}`

/**
 * The button: a result you've played already, see the results; one you haven't, play it too; an invitation, play;
 * the rest, open.
 */
export function actionLabel(m: HeadlineMessage): string {
  if (m.kind === 'result' && m.link.endsWith('/results')) return 'See results'
  if (m.kind === 'result' || (m.kind === 'game' && m.link.startsWith('#/games/play/'))) return 'Play it too'
  return m.kind === 'game' ? 'Play' : 'Open'
}
