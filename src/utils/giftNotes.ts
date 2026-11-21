// Gift ideas and notes (DESIGN.md §5.19): a gift idea's description can move into a note ("Make it a note"), which the
// idea then links to instead of keeping its own copy; and a note can go on a gift list ("Add to a gift list"), as an
// idea that links to it. So "Steve's clothes" notes describe the favorite shirts once, and any gift list can point
// at them. Pure, unit-tested.
import type { Task } from '../types'
import { audienceLabel, type Audience } from './audience'
import { detailsOf } from './details'

/**
 * The note made from a gift idea: its name, description, links and pictures, plus its size and color as a line
 * ("Size L · Color navy"), which describe the thing itself. Not how many, the price, its place on the list or claims.
 */
export function noteFromGift(item: Pick<Task, 'title' | 'notes' | 'links' | 'images' | 'gift'>) {
  const d = detailsOf(item, false)
  const facts = [item.gift?.size ? `Size ${item.gift.size}` : '', item.gift?.color ? `Color ${item.gift.color}` : ''].filter(Boolean).join(' · ')
  const notes = [item.notes?.trim() ?? '', facts].filter(Boolean).join('\n\n')
  return {
    title: item.title,
    ...(notes ? { notes } : {}),
    ...(d.links.length ? { links: d.links.map((l) => (l.label ? { url: l.url, label: l.label } : { url: l.url })) } : {}),
    ...(d.images.length ? { images: d.images } : {}),
  }
}

/** What the gift idea keeps after its details moved to a note: everything but those, and a link to the note. */
export function giftAfterMove(item: Pick<Task, 'noteIds'>, noteId: string) {
  return { notes: undefined, links: undefined, images: undefined, noteIds: [...(item.noteIds ?? []).filter((id) => id !== noteId), noteId] }
}

/** Whether a gift idea has anything to move into a note. */
export const hasGiftDetails = (item: Pick<Task, 'notes' | 'links' | 'images'>) => {
  const d = detailsOf(item, false)
  return !!(item.notes?.trim() || d.links.length || d.images.length)
}

const REACH: Record<Audience, number> = { private: 0, parents: 1, shared: 1, family: 2, everyone: 3 }

/**
 * A warning when some people who see the entry (a gift list) can't see the note it links to, or ''. Everyone ⊃
 * Family ⊃ the rest; Parents and Chosen people are only the same when they're the same choice.
 */
export function noteReachWarning(note: Audience, entry: Audience): string {
  if (note === entry || REACH[note] > REACH[entry]) return ''
  if (note === 'family' && entry === 'everyone') return 'view-only relatives won’t be able to open this note'
  if (note === 'private') return 'only you can see this note'
  return `this note is seen by ${audienceLabel(note).toLowerCase()} only`
}

/** The gift ideas that link to a note (on lists you can see). */
export const giftsLinking = (noteId: string, items: Pick<Task, 'id' | 'listId' | 'noteIds'>[], giftListIds: Set<string>) =>
  items.filter((t) => giftListIds.has(t.listId) && t.noteIds?.includes(noteId))
