import { describe, expect, it } from 'vitest'
import { matchesSearch, onThisDay, photoCaption, photoUrl, yearsAgo, type Favorite } from './favorites'

const photos: Favorite[] = [
  { id: '20121021_101500', taken_at: '2012-10-21T10:15:00', people: ['Alex Lee', 'Steve Lee'], event: null },
  { id: '20201021_090000', taken_at: '2020-10-21T09:00:00', people: [], event: 'fall-break-2020', top: true },
  { id: '20261021_080000', taken_at: '2026-10-21T08:00:00', people: ['Sam Lee'], event: null },
  { id: '20121022_120000', taken_at: '2012-10-22T12:00:00', people: [], event: null },
  { id: 'scan_001', taken_at: null, people: [], event: null },
]

describe('favorites', () => {
  it('finds photos from this day in earlier years, newest first', () => {
    expect(onThisDay(photos, '2026-10-21').map((p) => p.id)).toEqual(['20201021_090000', '20121021_101500'])
    expect(yearsAgo(photos[0], '2026-10-21')).toBe(14)
  })
  it('builds the published image address and a caption', () => {
    expect(photoUrl('20121021_101500', 640)).toBe('https://www.itsallonesong.com/pics/browse/640/20121021_101500-640.jpg')
    expect(photoCaption(photos[0])).toBe('Oct 21, 2012 · Alex and Steve')
    expect(photoCaption(photos[1])).toBe('Oct 21, 2020 · fall break 2020')
  })
  it('searches names, events, years and months', () => {
    expect(photos.filter((p) => matchesSearch(p, 'alex 2012')).map((p) => p.id)).toEqual(['20121021_101500'])
    expect(photos.filter((p) => matchesSearch(p, 'fall break')).length).toBe(1)
    expect(photos.filter((p) => matchesSearch(p, 'oct 22')).map((p) => p.id)).toEqual(['20121022_120000'])
  })
})

describe('photosForDay', () => {
  it('uses this date, else the nearest date within a week, else a stable random pick', async () => {
    const { photosForDay } = await import('./favorites')
    expect(photosForDay(photos, '2026-10-21').kind).toBe('same')
    const near = photosForDay(photos, '2026-10-25')
    expect(near.kind).toBe('near')
    expect(near.photos.map((p) => p.id)).toEqual(['20121022_120000'])
    const archive = photosForDay(photos, '2026-06-01')
    expect(archive.kind).toBe('archive')
    expect(archive.photos.length).toBe(3)
    expect(photosForDay(photos, '2026-06-01')).toEqual(archive) // same pick all day
    // Wraps at New Year: Jan 2 is near Dec 30.
    const ny = [{ id: 'nye', taken_at: '2019-12-30T20:00:00', people: [], event: null }]
    expect(photosForDay(ny, '2026-01-02').kind).toBe('near')
  })
})
