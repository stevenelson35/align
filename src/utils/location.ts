// The family map (DESIGN.md §5.11): OwnTracks on each phone posts to the Apps Script, which keeps locations/{uid}.
// Pure helpers, unit-tested.

export interface TrailPoint {
  lat: number
  lon: number
  tst: number
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
}

/** Older than this, a position shows faded ("last seen"). */
export const STALE_MS = 2 * 3600000

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

/** The personal address OwnTracks posts to: the Apps Script web app with the person's signed key. */
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
