import { describe, expect, it } from 'vitest'
import { cleanDetails, detailsOf, hasDetails, storedDetails } from './details'

describe('details', () => {
  it('reads old single link / picture fields as the first of each', () => {
    expect(detailsOf({ note: 'hi', url: 'https://a.com', imageUrl: 'https://i/1.jpg', links: ['https://b.com'], images: ['https://i/2.jpg'] })).toEqual({
      note: 'hi',
      links: ['https://a.com', 'https://b.com'],
      images: ['https://i/1.jpg', 'https://i/2.jpg'],
    })
    // A task's url is its own address, not an extra link.
    expect(detailsOf({ url: 'https://a.com' }, false).links).toEqual([])
    expect(hasDetails({ url: 'https://a.com' }, false)).toBe(false)
  })
  it('checks addresses, drops blanks and repeats, and stores arrays', () => {
    const d = cleanDetails({ note: ' x ', links: ['example.com', '', 'https://example.com'], images: [] })
    expect(d).toEqual({ note: 'x', links: ['https://example.com/'], images: [] })
    expect(cleanDetails({ note: '', links: ['javascript:alert(1)'], images: [] })).toMatch(/doesn’t look like/)
    expect(storedDetails(d as never)).toEqual({ links: ['https://example.com/'], images: undefined, url: undefined, imageUrl: undefined })
  })
})
