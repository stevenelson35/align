import { describe, expect, it } from 'vitest'
import { agoText, directionsUrl, initialsOf, ownTracksSetupLink, reportUrl } from './location'

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
  it('links to directions', () => {
    expect(directionsUrl(28.6, -81.35)).toBe('https://www.google.com/maps/dir/?api=1&destination=28.6,-81.35')
  })
})
