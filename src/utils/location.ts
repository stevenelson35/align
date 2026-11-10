// The family map (DESIGN.md §5.11): OwnTracks on each phone posts to the Apps Script, which keeps locations/{uid}.
// Pure helpers, unit-tested.

export interface TrailPoint {
  lat: number
  lon: number
  tst: number
  /** Meters (newer trail points carry it). */
  acc?: number
}

/**
 * Bad fixes, the same limits as the Apps Script (locationVerdict_): a fix less accurate than this many meters, and a
 * jump faster than this many meters per second after allowing for both fixes' accuracy.
 */
export const MAX_ACCURACY = 250
export const MAX_SPEED = 70

/** Meters per second between two fixes, after taking off both accuracy radii (so wobble isn't speed). */
export function speedBetween(a: TrailPoint, b: TrailPoint): number {
  const gap = distanceM(a.lat, a.lon, b.lat, b.lon) - (a.acc ?? 0) - (b.acc ?? 0)
  return Math.max(0, gap) / Math.max(1, Math.abs(b.tst - a.tst) / 1000)
}

/**
 * A trail fit to draw: points less accurate than MAX_ACCURACY dropped, and spikes removed (a point the path jumps
 * out to and straight back from, impossibly fast both ways, while its neighbors are close), and repeats of the same
 * fix. The Apps Script already filters new reports; this tidies trails saved before it did.
 */
export function cleanTrail(points: TrailPoint[]): TrailPoint[] {
  // Trails saved before the Apps Script stopped it can hold the same fix many times over (a phone resending it).
  const ok = points.filter((p, i) => !(p.acc !== undefined && p.acc > MAX_ACCURACY) && !(i > 0 && p.tst === points[i - 1].tst))
  const out: TrailPoint[] = []
  for (let i = 0; i < ok.length; i++) {
    const prev = out[out.length - 1]
    const next = ok[i + 1]
    if (prev && next && speedBetween(prev, ok[i]) > MAX_SPEED && speedBetween(ok[i], next) > MAX_SPEED && speedBetween(prev, next) <= MAX_SPEED) continue
    out.push(ok[i])
  }
  return out
}

/** locations/{uid}: the latest point (tst in ms), accuracy (m), battery (%), the day's trail, and paused (off). */
export interface FamilyLocation {
  uid: string
  lat?: number
  lon?: number
  acc?: number
  batt?: number
  tst?: number
  trail?: TrailPoint[]
  off: boolean
  /** When the phone last checked in (ms), even if it sent no new location. */
  updatedAt?: number
  /** Places they're in now (ids), and their latest arrivals / departures (newest last). */
  inside?: string[]
  events?: PlaceEvent[]
}

/** places/{id}: a geofence on the family map. */
export interface Place {
  id: string
  name: string
  lat: number
  lon: number
  /** Meters. */
  radius: number
}

export interface PlaceEvent {
  place: string
  name: string
  kind: 'enter' | 'leave'
  tst: number
}

/** One alert: whose (a uid, or '*' anyone) arrivals / departures at which place (an id, or '*' any). */
export interface AlertRule {
  person: string
  place: string
  enter: boolean
  leave: boolean
}

/** alertPrefs/{uid}: your alert rules, your devices' push tokens, and optional email alerts. */
export interface AlertPrefs {
  rules: AlertRule[]
  push: string[]
  email?: string
  emailOn?: boolean
}

export const RADIUS = { min: 50, max: 2000, default: 150 }

/** Meters between two points (haversine). */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** "28.6, -81.35" (or with a space, or from a Google Maps address bar "@28.6,-81.35,15z") → a point, else null. */
export function parseLatLon(text: string): { lat: number; lon: number } | null {
  const m = text.match(/(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)/)
  if (!m) return null
  const lat = Number(m[1])
  const lon = Number(m[2])
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && /[.,]/.test(text) ? { lat, lon } : null
}

/** "350 m" / "1.2 km". */
export const metersText = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

/** "Arrived at School 3:05 PM (2 h ago)" for someone's latest event. */
export function eventText(e: PlaceEvent, now = Date.now()): string {
  const time = new Date(e.tst).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${e.kind === 'enter' ? 'Arrived at' : 'Left'} ${e.name} ${time} (${agoText(e.tst, now)})`
}

/** Whether a rule fires for this person, place and kind (the Apps Script's alertTargets_ does the same). */
export const ruleMatches = (r: AlertRule, person: string, place: string, kind: 'enter' | 'leave') => (r.person === '*' || r.person === person) && (r.place === '*' || r.place === place) && r[kind]

/** Older than this, a position shows faded ("last seen"). */
export const STALE_MS = 2 * 3600000

/** A location this much older than the phone's last check-in means the phone isn't getting new locations. */
export const STUCK_MS = 6 * 3600000

/**
 * A phone that keeps checking in (recently) but sends the same old location: OwnTracks without location permission
 * in the background (on an iPhone, Location "Always" and Background App Refresh). Returns the time of the old
 * location, or null when all is well.
 */
export function stuckSince(loc: Pick<FamilyLocation, 'tst' | 'updatedAt' | 'off'>, now = Date.now()): number | null {
  if (loc.off || typeof loc.tst !== 'number' || typeof loc.updatedAt !== 'number') return null
  return loc.updatedAt - loc.tst > STUCK_MS && now - loc.updatedAt < 3 * 86400000 ? loc.tst : null
}

/** What to tell someone about a stuck phone (the details are in Help → Family map). */
export const STUCK_HELP = 'Open OwnTracks and keep it open until the red number on its icon is gone. Still stuck? Help → Family map.'

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function agoText(tst: number, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - tst) / 60000))
  if (min < 2) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 36) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}

/** "SN" from "Steve Nelson", "S" from "Steve": OwnTracks' two-letter tracker id and the map pin's letter. */
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?'

/**
 * Where OwnTracks posts: owntracks.php next to Align's page, which passes reports on to the Apps Script. OwnTracks
 * for iPhone treats the script's own 302 answer as a failure and resends its oldest report forever, so phones must
 * not post to the script directly (scripts/location/README.md).
 */
export const relayUrl = (pageUrl: string) => new URL('owntracks.php', pageUrl.split('#')[0]).href

/** The personal address OwnTracks posts to: the relay (or, in development, the Apps Script) with the person's signed key. */
export const reportUrl = (webAppUrl: string, key: string) => `${webAppUrl}${webAppUrl.includes('?') ? '&' : '?'}loc=${encodeURIComponent(key)}`

/**
 * A link that opens OwnTracks and sets it up in one tap (owntracks:///config?inline=<base64 JSON>): HTTP mode to the
 * personal address, significant-change monitoring (battery-friendly), battery and accuracy included.
 */
export function ownTracksSetupLink(url: string, name: string): string {
  const config = {
    _type: 'configuration',
    mode: 3, // HTTP
    url,
    tid: initialsOf(name).slice(0, 2),
    username: name,
    deviceId: 'phone',
    auth: false,
    monitoring: 1, // significant changes
    extendedData: true, // iPhone: battery and connection
    pubExtendedData: true, // Android: the same
  }
  const bytes = new TextEncoder().encode(JSON.stringify(config))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return `owntracks:///config?inline=${btoa(bin)}`
}

/** A Google Maps link to a point (directions from wherever you are). */
export const directionsUrl = (lat: number, lon: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
