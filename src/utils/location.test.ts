import { describe, expect, it } from 'vitest'
import { agoText, cleanTrail, directionsUrl, initialsOf, ownTracksSetupLink, relayUrl, reportUrl, stuckSince } from './location'

describe('family map helpers', () => {
  it('says how long ago', () => {
    const now = Date.UTC(2026, 9, 25, 12)
    expect(agoText(now - 30_000, now)).toBe('just now')
    expect(agoText(now - 5 * 60000, now)).toBe('5 min ago')
    expect(agoText(now - 3 * 3600000, now)).toBe('3 h ago')
    expect(agoText(now - 50 * 3600000, now)).toBe('2 days ago')
  })
  it('makes initials', () => {
    expect(initialsOf('Steve Nelson')).toBe('SN')
    expect(initialsOf('wife')).toBe('W')
    expect(initialsOf('')).toBe('?')
  })
  it('builds the personal address and a one-tap OwnTracks setup link', () => {
    const url = reportUrl('https://script.google.com/macros/s/abc/exec', 'steve.0123')
    expect(url).toBe('https://script.google.com/macros/s/abc/exec?loc=steve.0123')
    const link = ownTracksSetupLink(url, 'Steve Nelson')
    expect(link.startsWith('owntracks:///config?inline=')).toBe(true)
    const config = JSON.parse(atob(link.split('inline=')[1]))
    expect(config).toMatchObject({ _type: 'configuration', mode: 3, url, tid: 'SN', monitoring: 1 })
  })
  it('posts through the relay next to the page, whatever the route', () => {
    expect(relayUrl('https://align.itsallonesong.com/#/map')).toBe('https://align.itsallonesong.com/owntracks.php')
    expect(relayUrl('https://example.com/align/index.html?x=1#/task/a')).toBe('https://example.com/align/owntracks.php')
    expect(reportUrl(relayUrl('https://align.itsallonesong.com/'), 'uid.abc')).toBe('https://align.itsallonesong.com/owntracks.php?loc=uid.abc')
  })
  it('links to directions', () => {
    expect(directionsUrl(28.6, -81.35)).toBe('https://www.google.com/maps/dir/?api=1&destination=28.6,-81.35')
  })
})

describe('places', () => {
  it('reads coordinates typed or pasted', async () => {
    const { parseLatLon } = await import('./location')
    expect(parseLatLon('28.6, -81.35')).toEqual({ lat: 28.6, lon: -81.35 })
    expect(parseLatLon('https://www.google.com/maps/@28.5973,-81.351,15z')).toEqual({ lat: 28.5973, lon: -81.351 })
    expect(parseLatLon('123 Main St')).toBeNull()
    expect(parseLatLon('95.1, 10')).toBeNull()
  })
  it('measures, formats and matches', async () => {
    const { distanceM, metersText, ruleMatches } = await import('./location')
    expect(Math.round(distanceM(28.6, -81.35, 28.6018, -81.35))).toBe(200)
    expect(metersText(350)).toBe('350 m')
    expect(metersText(1234)).toBe('1.2 km')
    const r = { person: 'daughter', place: '*', enter: true, leave: false }
    expect(ruleMatches(r, 'daughter', 'school', 'enter')).toBe(true)
    expect(ruleMatches(r, 'daughter', 'school', 'leave')).toBe(false)
    expect(ruleMatches(r, 'wife', 'school', 'enter')).toBe(false)
  })
})

describe('cleaning trails', () => {
  it('drops inaccurate points and one-point spikes, keeping real movement', async () => {
    const { cleanTrail } = await import('./location')
    const t = (lat: number, secs: number, acc?: number) => ({ lat, lon: -81.35, tst: secs * 1000, acc })
    const trail = [t(28.6, 0, 10), t(28.601, 60, 10), t(28.9, 120, 10), t(28.602, 180, 10), t(28.603, 240, 1500), t(28.604, 300, 10)]
    expect(cleanTrail(trail).map((p) => p.lat)).toEqual([28.6, 28.601, 28.602, 28.604])
    // A drive at highway speed stays.
    const drive = [t(28.6, 0), t(28.62, 60), t(28.64, 120), t(28.66, 180)]
    expect(cleanTrail(drive)).toHaveLength(4)
  })
})

describe('a phone that stopped getting locations', () => {
  const h = 3600000
  const now = 100 * h
  it('is stuck when it checks in but its location is hours older', () => {
    expect(stuckSince({ tst: now - 72 * h, updatedAt: now - 1 * h, off: false }, now)).toBe(now - 72 * h)
    expect(stuckSince({ tst: now - 2 * h, updatedAt: now - 1 * h, off: false }, now)).toBeNull() // just not moving
    expect(stuckSince({ tst: now - 72 * h, updatedAt: now - 70 * h, off: false }, now)).toBeNull() // check-in old too: just quiet
    expect(stuckSince({ tst: now - 72 * h, updatedAt: now - 1 * h, off: true }, now)).toBeNull() // paused
    expect(stuckSince({ tst: now - 72 * h, off: false }, now)).toBeNull() // no check-in time
  })

  it('drops repeats of the same fix from a trail', () => {
    const p = { lat: 1, lon: 1, tst: 1000 }
    expect(cleanTrail([p, { ...p }, { ...p }, { lat: 1.001, lon: 1, tst: 2000 }]).map((x) => x.tst)).toEqual([1000, 2000])
  })
})
