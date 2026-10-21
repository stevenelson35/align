// The details any entry can carry, the same way everywhere: a note, links and pictures (voting items, goal
// entries, tasks, checklist items, notes, links). Older docs kept one `url` / `imageUrl`; they read as the first
// link / picture. Tasks keep `url` as their own address (a links-list item, a "Read:" task); `links` are extras.
import { safeUrl } from './links'
import { isStoredImage } from './pictures'

export const MAX_LINKS = 10
export const MAX_IMAGES = 10

export interface Details {
  note: string
  links: string[]
  images: string[]
}

interface Stored {
  note?: string
  url?: string
  imageUrl?: string
  links?: string[]
  images?: string[]
}

/** What a doc has, legacy single fields included (`withUrl: false` for tasks, whose url is their own address). */
export function detailsOf(d: Stored, withUrl = true): Details {
  const links = [...(withUrl && d.url ? [d.url] : []), ...(d.links ?? [])]
  const images = [...(d.imageUrl ? [d.imageUrl] : []), ...(d.images ?? [])]
  return { note: d.note ?? '', links: [...new Set(links)], images: [...new Set(images)] }
}

export const hasDetails = (d: Stored | undefined, withUrl = true) => {
  if (!d) return false
  const x = detailsOf(d, withUrl)
  return !!(x.note || x.links.length || x.images.length)
}

/** Checked addresses, blanks dropped, no repeats; or an error message. Pictures may also be stored ones. */
export function cleanUrls(urls: string[], max: number, what: string): string[] | string {
  const out: string[] = []
  for (const u of urls) {
    if (!u.trim()) continue
    const ok = what === 'pictures' && isStoredImage(u) ? u : safeUrl(u)
    if (!ok) return `“${u.trim()}” doesn’t look like a web address.`
    if (!out.includes(ok)) out.push(ok)
  }
  return out.length > max ? `Up to ${max} ${what}, please.` : out
}

export function cleanDetails(d: Details): Details | string {
  const links = cleanUrls(d.links, MAX_LINKS, 'links')
  if (typeof links === 'string') return links
  const images = cleanUrls(d.images, MAX_IMAGES, 'pictures')
  if (typeof images === 'string') return images
  return { note: d.note.trim(), links, images }
}

/** The fields to store: `links` / `images` (undefined when empty, so they're removed) and the old single fields cleared. */
export function storedDetails(d: Details) {
  return { ...taskDetails(d), url: undefined, imageUrl: undefined }
}

/** For tasks (and checklist items, notes, links): their `url` is their own address, and they never had imageUrl. */
export function taskDetails(d: Pick<Details, 'links' | 'images'>) {
  return { links: d.links.length ? d.links : undefined, images: d.images.length ? d.images : undefined }
}
