// Favorite photos (DESIGN.md §10.3): psort publishes its starred, non-private photos for the blog's photo browser
// (blog.itsallonesong.com/browse.html): web-size copies plus browse-manifest.json beside them on Turbify. Align
// reads the same manifest (psort's .htaccess allows this origin) to pick blog / entry pictures, show "On this
// day", and text a photo. Read-only: nothing in Align changes what psort publishes.

export const PHOTOS_BASE = 'https://www.itsallonesong.com/pics/browse/'
export const PHOTO_BROWSER_URL = 'https://blog.itsallonesong.com/browse.html'

export interface Favorite {
  /** File name without extension, e.g. "20260703_145634". */
  id: string
  /** Local time the photo was taken, "YYYY-MM-DDTHH:MM:SS" (may be missing). */
  taken_at: string | null
  people: string[]
  /** Named event slug (e.g. "summer-vacation-2026"), if it falls in one. */
  event: string | null
  /** A top pick. */
  top?: boolean
}

export interface FavoritesManifest {
  photos: Favorite[]
  events: { slug: string; name: string; start: string; end: string }[]
}

/** The sizes psort renders (the blog's list); 640 for thumbnails, 1024 to look at, 2048 to send or post. */
export type PhotoSize = 640 | 768 | 1024 | 1366 | 1600 | 1920 | 2048

export function photoUrl(id: string, size: PhotoSize = 1024): string {
  return `${PHOTOS_BASE}${size}/${encodeURIComponent(id)}-${size}.jpg`
}

let loading: Promise<FavoritesManifest> | null = null

/** The manifest, fetched once per session (it's small: about 150 bytes a photo). */
export function loadFavorites(): Promise<FavoritesManifest> {
  loading ??= fetch(`${PHOTOS_BASE}browse-manifest.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`The photo list didn't load (${r.status}).`)
      return r.json() as Promise<FavoritesManifest>
    })
    .then((m) => ({ photos: (m.photos ?? []).slice().sort((a, b) => (b.taken_at ?? '').localeCompare(a.taken_at ?? '')), events: m.events ?? [] }))
    .catch((err) => {
      loading = null // try again next time
      throw err instanceof TypeError ? new Error('Couldn’t reach the photo list. Check the connection and try again.') : err
    })
  return loading
}

/** Favorites taken on the same month and day in earlier years, most recent year first. */
export function onThisDay(photos: Favorite[], day: string): Favorite[] {
  const md = day.slice(5, 10)
  const year = day.slice(0, 4)
  return photos
    .filter((p) => p.taken_at && p.taken_at.slice(5, 10) === md && p.taken_at.slice(0, 4) < year)
    .sort((a, b) => b.taken_at!.localeCompare(a.taken_at!))
}

export function yearsAgo(p: Favorite, day: string): number {
  return p.taken_at ? Number(day.slice(0, 4)) - Number(p.taken_at.slice(0, 4)) : 0
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 21, 2012" (or "Undated"). */
export function photoDate(p: Favorite): string {
  if (!p.taken_at) return 'Undated'
  const [y, m, d] = p.taken_at.slice(0, 10).split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

/** Plain words for a photo: "Oct 21, 2012 · Camilla and Steve · summer vacation 2026". */
export function photoCaption(p: Favorite): string {
  const first = p.people.map((n) => n.split(/\s+/)[0])
  const who = first.length <= 1 ? first.join('') : `${first.slice(0, -1).join(', ')} and ${first.at(-1)}`
  return [photoDate(p), who, p.event?.replace(/-/g, ' ')].filter(Boolean).join(' · ')
}

/** Search: every word must match a name, the event, the year, or the month ("camilla 2012", "oct", "vacation"). */
export function matchesSearch(p: Favorite, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = [...p.people, p.event?.replace(/-/g, ' ') ?? '', photoDate(p), p.taken_at?.slice(0, 10) ?? ''].join(' ').toLowerCase()
  return words.every((w) => hay.includes(w))
}

/** Days apart on the calendar, ignoring the year and wrapping at New Year (Dec 30 ↔ Jan 2 is 3). */
function calendarGap(a: string, b: string): number {
  const doy = (md: string) => {
    const [m, d] = md.split('-').map(Number)
    return (Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 864e5 // a non-leap year; Feb 29 counts as Mar 1
  }
  const diff = Math.abs(doy(a) - doy(b))
  return Math.min(diff, 365 - diff)
}

/** A small stable number for a day, so the "from the archive" pick stays the same all day. */
function seed(day: string): number {
  let h = 2166136261
  for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

export type DayPhotos = { kind: 'same' | 'near' | 'archive'; photos: Favorite[] }

/**
 * Photos for a day view: favorites from this date in earlier years; if none, the nearest date within `nearDays`
 * (either side, earlier years); if still none, a few picked at random from the archive (the same pick all day).
 */
export function photosForDay(photos: Favorite[], day: string, nearDays = 7, archiveCount = 3): DayPhotos {
  const same = onThisDay(photos, day)
  if (same.length) return { kind: 'same', photos: same }
  const year = day.slice(0, 4)
  const md = day.slice(5, 10)
  const earlier = photos.filter((p) => p.taken_at && p.taken_at.slice(0, 4) < year)
  if (!earlier.length) return { kind: 'archive', photos: [] }
  const gaps = earlier.map((p) => calendarGap(p.taken_at!.slice(5, 10), md))
  const nearest = Math.min(...gaps)
  if (nearest <= nearDays) {
    return { kind: 'near', photos: earlier.filter((_, i) => gaps[i] === nearest).sort((a, b) => b.taken_at!.localeCompare(a.taken_at!)) }
  }
  const pool = [...earlier]
  const picked: Favorite[] = []
  let s = seed(day)
  while (picked.length < archiveCount && pool.length) {
    s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0
    picked.push(pool.splice(s % pool.length, 1)[0])
  }
  return { kind: 'archive', photos: picked }
}
