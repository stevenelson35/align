import { safeUrl } from './links'

/** A note, a link and a picture: the details any entry can carry (voting items, goal log entries). */
export interface DetailsDraft {
  note: string
  url: string
  imageUrl: string
}

export function draftOf(d: { note?: string; url?: string; imageUrl?: string }): DetailsDraft {
  return { note: d.note ?? '', url: d.url ?? '', imageUrl: d.imageUrl ?? '' }
}

/** Trimmed details with checked addresses, or an error message. Empty fields come back as ''. */
export function cleanDetails(d: DetailsDraft): DetailsDraft | string {
  const url = d.url.trim() ? safeUrl(d.url) : ''
  const imageUrl = d.imageUrl.trim() ? safeUrl(d.imageUrl) : ''
  if (url === null || imageUrl === null) return 'That doesn’t look like a web address.'
  return { note: d.note.trim(), url, imageUrl }
}

export const hasDetails = (d: { note?: string; url?: string; imageUrl?: string } | undefined) => !!(d?.note || d?.url || d?.imageUrl)
