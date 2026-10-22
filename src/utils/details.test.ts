import { describe, expect, it } from 'vitest'
import { cleanDetails, detailsOf, hasDetails, storedDetails } from './details'

describe('details', () => {
  it('reads old single link / picture fields as the first of each', () => {
    expect(detailsOf({ note: 'hi', url: 'https://a.com', imageUrl: 'https://i/1.jpg', links: ['https://b.com'], images: ['https://i/2.jpg'] })).toEqual({
      note: 'hi',
      links: [
        { url: 'https://a.com', label: '' },
        { url: 'https://b.com', label: '' },
      ],
      images: ['https://i/1.jpg', 'https://i/2.jpg'],
    })
    // A task's url is its own address, not an extra link.
    expect(detailsOf({ url: 'https://a.com' }, false).links).toEqual([])
    expect(hasDetails({ url: 'https://a.com' }, false)).toBe(false)
  })
  it('checks addresses, drops blanks and repeats, and stores arrays', () => {
    const l = (url: string, label = '') => ({ url, label })
    const d = cleanDetails({ note: ' x ', links: [l('example.com', ' Menu '), l(''), l('https://example.com')], images: [] })
    expect(d).toEqual({ note: 'x', links: [l('https://example.com/', 'Menu')], images: [] })
    expect(cleanDetails({ note: '', links: [l('javascript:alert(1)')], images: [] })).toMatch(/doesn’t look like/)
    expect(cleanDetails({ note: '', links: [l('', 'Tickets')], images: [] })).toMatch(/Add the address for “Tickets”/)
    // Names are stored only when given.
    expect(storedDetails(d as never)).toEqual({ links: [{ url: 'https://example.com/', label: 'Menu' }], images: undefined, url: undefined, imageUrl: undefined })
    expect(storedDetails({ note: '', links: [l('https://a.com/')], images: [] }).links).toEqual([{ url: 'https://a.com/' }])
  })
})
