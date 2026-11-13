// The Inbox (DESIGN.md §13, refactor phase 4): things family members send you in Align ("Send about this" → Align),
// and game invitations. One small collection, `inbox`, a document per message: only its sender and its recipient can
// read it; the recipient marks it read or clears it. The sender's app then asks the Apps Script web app to push a
// notification at once (seconds); the script also sweeps every 15 minutes for any it missed.
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch, type Timestamp } from 'firebase/firestore'
import { auth, db } from './config'
import { calendarSyncUrl } from './calendarSync'
import { inboxLink } from '../utils/inboxLink'

export type InboxKind = 'entry' | 'link' | 'board' | 'photo' | 'game' | 'note'

export interface InboxMessage {
  id: string
  to: string
  from: string
  kind: InboxKind
  /** What it's about ("Buy milk", "Voting: Movies", "Lights Out"). */
  title: string
  /** The sender's note. */
  text?: string
  /** Where tapping it goes: an Align address (#/…) or a web page. */
  link: string
  read: boolean
  /** Set by the Apps Script once the notification went out. */
  pushed: boolean
  createdAt?: Timestamp | null
}

/** The newest this many (older ones stay until cleared, but aren't loaded). */
export const INBOX_SIZE = 50
export const MAX_TEXT = 2000
export const MAX_TITLE = 300

/** Your Inbox, newest first, live. */
export function subscribeInbox(uid: string, onData: (messages: InboxMessage[]) => void, onError: (message: string) => void) {
  const q = query(collection(db, 'inbox'), where('to', '==', uid), orderBy('createdAt', 'desc'), limit(INBOX_SIZE))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InboxMessage, 'id'>) }))),
    (err) => onError(err.message),
  )
}

/**
 * Sends a message to each person's Inbox and asks for their notifications at once. Returns the new ids. The push is
 * best effort: if the web app can't be reached, the 15-minute sweep sends it.
 */
export async function sendToInbox(from: string, to: string[], message: { kind: InboxKind; title: string; text?: string; link: string }): Promise<string[]> {
  const ids: string[] = []
  for (const person of new Set(to)) {
    if (person === from) continue
    const ref = await addDoc(collection(db, 'inbox'), {
      to: person,
      from,
      kind: message.kind,
      title: message.title.trim().slice(0, MAX_TITLE) || 'Something',
      ...(message.text?.trim() ? { text: message.text.trim().slice(0, MAX_TEXT) } : {}),
      link: inboxLink(message.link),
      read: false,
      pushed: false,
      createdAt: serverTimestamp(),
    })
    ids.push(ref.id)
  }
  if (ids.length) void notifyNow(ids)
  return ids
}

/** Asks the Apps Script to push these messages now (it checks your sign-in, and that they're yours to send). */
export async function notifyNow(ids: string[]): Promise<boolean> {
  if (!calendarSyncUrl || !ids.length) return false
  try {
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) return false
    // text/plain keeps this a "simple" request: Apps Script can't answer a CORS preflight.
    const res = await fetch(calendarSyncUrl, { method: 'POST', body: JSON.stringify({ action: 'notify', idToken, ids }) })
    return res.ok && ((await res.json()) as { ok?: boolean }).ok === true
  } catch {
    return false
  }
}

export function markRead(ids: string[], read = true) {
  const batch = writeBatch(db)
  for (const id of ids) batch.update(doc(db, 'inbox', id), { read })
  return batch.commit()
}

/** Clears messages from your Inbox for good. */
export async function clearInbox(ids: string[]) {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db)
    for (const id of ids.slice(i, i + 400)) batch.delete(doc(db, 'inbox', id))
    await batch.commit()
  }
}

export const clearOne = (id: string) => deleteDoc(doc(db, 'inbox', id))
