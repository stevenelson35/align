// "text <name> …": a real text from your own phone. Align fills in Messages (sms: link); you press Send there,
// so it costs nothing and replies arrive as normal texts. "about <task>" adds the task's title, time and link.
import { formatDay } from '../engine/dates'
import type { Household, Task } from '../types'
import { people } from './tasks'

/** Digits and a leading +: what an sms: link wants. */
export function phoneDigits(phone: string): string {
  const trimmed = phone.trim()
  return (trimmed.startsWith('+') ? '+' : '') + trimmed.replace(/\D/g, '')
}

/** Opens Messages with the number and text filled in. "?&body=" works on both iPhone and Android. */
export function smsUrl(phone: string, body: string): string {
  return `sms:${phoneDigits(phone)}?&body=${encodeURIComponent(body)}`
}

/** What to send for an item: a link's own address, or a link that opens the task / item / note in Align. */
export function shareLink(t: Pick<Task, 'id' | 'url'>): string {
  return t.url ?? taskLink(t.id)
}

/** A link that opens this task (or checklist item / note) in Align. */
export function taskLink(id: string, base = `${window.location.origin}${window.location.pathname}`): string {
  return `${base}#/task/${encodeURIComponent(id)}`
}

/** When it happens, for the text: "Fri, Oct 9 · 3:00 PM–4:00 PM", "Sat, Oct 10", "due Mon, Oct 12", or nothing. */
export function whenText(t: Pick<Task, 'startDate' | 'targetDate' | 'calendar'>): string {
  if (t.startDate) return `${formatDay(t.startDate)}${t.calendar?.time ? ` · ${t.calendar.time}` : ''}`
  if (t.targetDate) return `due ${formatDay(t.targetDate)}`
  return ''
}

/** The text itself: your message, then (when it's about something) its title, time and link. */
export function textBody(message: string, about?: { title: string; when: string; link: string }): string {
  const msg = message.trim()
  if (!about) return msg
  const re = `Re: ${about.title}${about.when ? ` (${about.when})` : ''}\n${about.link}`
  return msg ? `${msg}\n\n${re}` : re
}

/**
 * The person a "text …" command starts with: the longest name (full display name, or first name) that the text
 * begins with. Returns their uid and the rest of the text.
 */
export function splitRecipient(text: string, household: Household): { uid: string; rest: string } | null {
  const lower = text.toLowerCase()
  let best: { uid: string; rest: string; len: number } | null = null
  for (const [uid, m] of people(household)) {
    for (const name of new Set([m.displayName, m.displayName.split(/\s+/)[0]])) {
      const n = name.toLowerCase()
      if (n && (lower === n || lower.startsWith(`${n} `)) && (!best || n.length > best.len)) {
        best = { uid, rest: text.slice(n.length).trim(), len: n.length }
      }
    }
  }
  return best && { uid: best.uid, rest: best.rest }
}

/** "about <task>: <message>" (or "about <task> - <message>"), or just a message. */
export function splitAbout(rest: string): { about?: string; message: string } {
  const m = rest.match(/^about\s+(.+?)(?:\s*:\s*|\s+-\s+)(.*)$/is)
  if (m) return { about: m[1].trim(), message: m[2].trim() }
  const only = rest.match(/^about\s+(.+)$/is)
  if (only) return { about: only[1].trim(), message: '' }
  return { message: rest }
}
