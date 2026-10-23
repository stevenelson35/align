// The Daily's fetched items (DESIGN.md §10.5): free public sites that allow a browser to read them directly (no keys
// of ours, no server). Each is fetched at most once a day per device (saved in localStorage) and fails quietly.

export interface Joke {
  setup: string
  punchline: string
}
export interface DailyPicture {
  title: string
  image: string
  /** A larger copy or the page about it, to open. */
  link?: string
  text?: string
  credit?: string
}
export interface Animal {
  image: string
  name: string
  scientific: string
  credit: string
  link: string
}

const KEY = (day: string, what: string) => `align-daily:${day}:${what}`

/** Today's copy from this device, or fetch it (once). Yesterday's copies are cleared as we go. */
export async function daily<T>(day: string, what: string, load: () => Promise<T>): Promise<T> {
  const saved = localStorage.getItem(KEY(day, what))
  if (saved) return JSON.parse(saved) as T
  const value = await load()
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('align-daily:') && !k.startsWith(`align-daily:${day}:`)) localStorage.removeItem(k)
    localStorage.setItem(KEY(day, what), JSON.stringify(value))
  } catch {
    // storage full: just don't keep it
  }
  return value
}

async function getJson(url: string, headers: Record<string, string> = {}) {
  const r = await fetch(url, { headers: { Accept: 'application/json', ...headers } })
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
}

/** A two-part joke (setup, then punchline), family-safe; a dad joke if that site is down. */
export async function fetchJoke(): Promise<Joke> {
  try {
    const j = await getJson('https://v2.jokeapi.dev/joke/Pun,Misc,Programming?safe-mode&type=twopart&blacklistFlags=nsfw,religious,political,racist,sexist,explicit')
    if (j.setup && j.delivery) return { setup: j.setup, punchline: j.delivery }
  } catch {
    // try the other one
  }
  const d = await getJson('https://icanhazdadjoke.com/')
  const parts = String(d.joke).split(/(?<=\?)\s+/)
  return parts.length > 1 ? { setup: parts[0], punchline: parts.slice(1).join(' ') } : { setup: d.joke, punchline: '' }
}

const SPACE_TOPICS = ['nebula', 'galaxy', 'hubble', 'webb telescope', 'aurora', 'saturn', 'jupiter', 'mars surface', 'earth from space', 'moon surface', 'star cluster', 'comet']

/**
 * A space picture from NASA's image library: a different topic and image each day. (NASA's "Astronomy Picture of
 * the Day" service was returning only a placeholder logo in October 2026, so it isn't used.)
 */
export async function fetchNasa(dayIndex: number): Promise<DailyPicture> {
  const topic = SPACE_TOPICS[dayIndex % SPACE_TOPICS.length]
  const j = await getJson(`https://images-api.nasa.gov/search?q=${encodeURIComponent(topic)}&media_type=image`)
  const items = (j.collection?.items ?? []).filter((i: { links?: { href?: string }[] }) => i.links?.[0]?.href)
  if (!items.length) throw new Error('no picture')
  const item = items[Math.floor(dayIndex / SPACE_TOPICS.length) % items.length]
  const d = item.data?.[0] ?? {}
  return {
    title: d.title ?? 'NASA',
    image: item.links[0].href,
    link: d.nasa_id ? `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}` : item.links[0].href,
    text: d.description ? stripHtml(String(d.description)).slice(0, 600) : undefined,
    credit: `NASA${d.center ? ` · ${d.center}` : ''}`,
  }
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

/** Wikipedia / Wikimedia Commons Picture of the Day. */
export async function fetchCommonsPicture(day: string): Promise<DailyPicture> {
  const [y, m, d] = day.split('-')
  const f = await getJson(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${y}/${m}/${d}`)
  const img = f.image
  if (!img?.thumbnail?.source) throw new Error('no picture')
  return {
    title: stripHtml(img.description?.text ?? img.title ?? 'Picture of the day').split('. ')[0].slice(0, 120),
    image: img.thumbnail.source,
    link: img.file_page ?? img.image?.source,
    text: img.description?.text ? stripHtml(img.description.text) : undefined,
    credit: [img.artist?.text ? stripHtml(img.artist.text) : '', img.license?.type ?? ''].filter(Boolean).join(' · '),
  }
}

/** A wild animal photo from iNaturalist (research-grade, openly licensed), different each day: guess what it is. */
export async function fetchAnimal(dayIndex: number): Promise<Animal> {
  const page = (dayIndex % 2000) + 1
  const j = await getJson(
    `https://api.inaturalist.org/v1/observations?photos=true&quality_grade=research&taxon_id=1&photo_license=cc-by,cc-by-nc,cc0&order_by=votes&per_page=1&page=${page}`,
  )
  const o = j.results?.[0]
  const photo = o?.photos?.[0]
  if (!o || !photo?.url) throw new Error('no animal')
  return {
    image: String(photo.url).replace('/square.', '/medium.'),
    name: o.taxon?.preferred_common_name ?? o.taxon?.name ?? 'Unknown',
    scientific: o.taxon?.name ?? '',
    credit: photo.attribution ?? '',
    link: o.uri ?? `https://www.inaturalist.org/observations/${o.id}`,
  }
}
