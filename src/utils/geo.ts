// Flashcard maps (DESIGN.md §5.9): finds the country or US state a card is about (and whether its capital is part
// of it) from the card's own words, so existing sets get maps without any extra typing. Pure; unit-tested.
import type { Box } from './topo'

/** src/data/geo-meta.json (scripts/build-geo.mjs). */
export interface GeoMeta {
  /** caps: every capital, the usual one first: [name, lat, lon, ...other spellings]. */
  countries: Record<string, { n: string; al: string[]; c: string; s: string; l: [number, number]; caps?: (string | number)[][]; w: string }>
  states: Record<string, { n: string; caps?: (string | number)[][] }>
}

export type PlaceKind = 'country' | 'state'

export interface Place {
  kind: PlaceKind
  /** The id in its shapes file (ISO numeric for countries, FIPS for states). */
  id: string
  name: string
  capital?: { name: string; lat: number; lon: number }
  /** The card mentions the capital (so the answer map marks it). */
  showCapital: boolean
}

/** Lowercase, no accents or punctuation, single spaces, no leading "the". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '')
}

interface Entry {
  kind: PlaceKind
  id: string
  /** For a capital: which of the place's capitals. */
  cap?: number
}

export interface GeoIndex {
  meta: GeoMeta
  names: Map<string, Entry[]>
  capitals: Map<string, Entry[]>
}

export function buildIndex(meta: GeoMeta): GeoIndex {
  const names = new Map<string, Entry[]>()
  const capitals = new Map<string, Entry[]>()
  const add = (map: Map<string, Entry[]>, text: string, e: Entry) => {
    const k = normalize(text)
    // Two letters or fewer would match too much ("US" is the exception people type).
    if (k.length < 3 && k !== 'us' && k !== 'uk') return
    if (!(map.get(k) ?? []).some((x) => x.kind === e.kind && x.id === e.id && x.cap === e.cap)) map.set(k, [...(map.get(k) ?? []), e])
  }
  for (const [id, c] of Object.entries(meta.countries)) {
    for (const a of c.al) add(names, a, { kind: 'country', id })
    c.caps?.forEach((cap, i) => [cap[0], ...cap.slice(3)].forEach((n) => add(capitals, String(n), { kind: 'country', id, cap: i })))
  }
  for (const [id, s] of Object.entries(meta.states)) {
    add(names, s.n, { kind: 'state', id })
    s.caps?.forEach((cap, i) => add(capitals, String(cap[0]), { kind: 'state', id, cap: i }))
  }
  return { meta, names, capitals }
}

/** Places named in some text: the whole text if it's a name, else every name inside it (longest first). */
function find(map: Map<string, Entry[]>, text: string): Entry[] {
  const t = normalize(text)
  if (!t) return []
  const whole = map.get(t)
  if (whole) return whole
  const padded = ` ${t} `
  return [...map.keys()]
    .filter((k) => padded.includes(` ${k} `))
    .sort((a, b) => b.length - a.length)
    .flatMap((k) => map.get(k)!)
}

const pick = (entries: Entry[], prefer: PlaceKind) => entries.find((e) => e.kind === prefer) ?? entries[0]

/**
 * The place a card is about, if any: a country or state named on either side (or, failing that, one whose capital
 * is), and whether its capital is mentioned. `prefer` settles names that are both (Georgia, Washington).
 */
export function matchCard(front: string, back: string, index: GeoIndex, prefer: PlaceKind = 'country'): Place | null {
  const named = [...find(index.names, front), ...find(index.names, back)]
  const caps = [...find(index.capitals, front), ...find(index.capitals, back)]
  let entry = named.length ? pick(named, prefer) : undefined
  // "Washington" on a states card is the state, but on a "United States" card it's the capital.
  if (entry && caps.some((c) => c.kind === entry!.kind && c.id === entry!.id) === false) {
    const capFor = named.map((n) => caps.find((c) => c.kind === n.kind && c.id === n.id)).find(Boolean)
    if (capFor) entry = capFor
  }
  if (!entry && caps.length) entry = pick(caps, prefer)
  if (!entry) return null
  const m = entry.kind === 'country' ? index.meta.countries[entry.id] : index.meta.states[entry.id]
  // The capital the card names (Sucre or La Paz), else the usual one.
  const named_ = caps.find((c) => c.kind === entry!.kind && c.id === entry!.id)
  const raw = m.caps?.[named_?.cap ?? 0]
  const cap = raw ? { name: String(raw[0]), lat: Number(raw[1]), lon: Number(raw[2]) } : undefined
  return { kind: entry.kind, id: entry.id, name: m.n, capital: cap, showCapital: !!named_ }
}

/** Whether a set is mostly US states (so "Georgia" means the state there). */
export function setPrefers(cards: { front: string; back: string }[], index: GeoIndex): PlaceKind {
  let states = 0
  let countries = 0
  for (const c of cards) {
    const all = [...find(index.names, c.front), ...find(index.names, c.back)]
    if (all.some((e) => e.kind === 'state')) states++
    if (all.some((e) => e.kind === 'country')) countries++
  }
  return states > countries ? 'state' : 'country'
}

/** The region a hint shows a country in: its continent (open-ocean islands and far-off places get their own area). */
const CONTINENT_FRAMES: Record<string, Box> = {
  Africa: [-19, -36, 53, 38],
  Europe: [-25, 34, 45, 71],
  Asia: [25, -11, 150, 56],
  'North America': [-170, 7, -52, 75],
  'South America': [-84, -56, -33, 14],
  Oceania: [110, -48, 180, -5],
}

/** The lower 48, where a state hint shows (Alaska and Hawaii show around themselves). */
export const LOWER_48: Box = [-125, 24, -66.5, 49.5]

export function continentFrame(continent: string, label: [number, number]): Box | null {
  const f = CONTINENT_FRAMES[continent]
  if (!f) return null
  const [lon, lat] = label
  // Only when the place is actually inside its continent's usual view (not the Azores or Guam).
  return lon >= f[0] && lon <= f[2] && lat >= f[1] && lat <= f[3] ? f : null
}

/** The Wikipedia article for a place (some names need their kind, like Georgia). */
export function wikiTitle(place: Place, meta: GeoMeta): string {
  if (place.kind === 'state') return place.name === 'Georgia' ? 'Georgia (U.S. state)' : place.name === 'Washington' ? 'Washington (state)' : place.name
  const w = meta.countries[place.id]?.w ?? place.name
  return w === 'Georgia' ? 'Georgia (country)' : w
}

/**
 * Wrong answers that make sense for a place (for multiple choice when a set is small): other places on the same
 * continent (or other states), as names, or as capitals when the answer is the place's capital.
 */
export function nearbyAnswers(place: Place, meta: GeoMeta, answer: string): string[] {
  const wantCapital = !!place.capital && normalize(answer) === normalize(place.capital.name)
  if (place.kind === 'state')
    return Object.entries(meta.states)
      .filter(([id, s]) => id !== place.id && s.caps)
      .map(([, s]) => (wantCapital ? String(s.caps![0][0]) : s.n))
  const continent = meta.countries[place.id]?.c
  return Object.entries(meta.countries)
    .filter(([id, c]) => id !== place.id && c.c === continent && c.caps)
    .map(([, c]) => (wantCapital ? String(c.caps![0][0]) : c.n))
}
