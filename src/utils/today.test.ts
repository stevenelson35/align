import { describe, expect, it } from 'vitest'
import { arrangement, DEFAULT_MORE, moreOf, TODAY_SECTIONS } from './today'

describe('arranging Today', () => {
  it('starts with the less-used sections in More…, then follows your arrangement', () => {
    expect([...moreOf({})]).toEqual(DEFAULT_MORE)
    expect(DEFAULT_MORE).toEqual(['gifts', 'lists', 'links', 'projects', 'cards', 'voting'])
    expect([...moreOf({ todayMore: ['daily'] })].sort()).toEqual(['daily', 'voting']) // a newly added section starts in More…
    expect([...moreOf({ todayMore: ['!voting'] })].filter((s) => !s.startsWith('!'))).toEqual([]) // everything on the main page
    expect(TODAY_SECTIONS.map((s) => s.id)).not.toContain('todo') // To Do always stays
  })

  it('remembers a newly added section moved to the main page, and back', () => {
    const before = moreOf({ todayMore: ['gifts'] }) // gifts, and voting (new)
    const main = arrangement(before, 'voting', false)
    expect(main).toEqual(['gifts', '!voting'])
    expect(moreOf({ todayMore: main }).has('voting')).toBe(false)
    const back = arrangement(moreOf({ todayMore: main }), 'voting', true)
    expect(back).toEqual(['gifts', 'voting'])
    // Moving another section keeps the mark.
    expect(arrangement(moreOf({ todayMore: main }), 'daily', true)).toEqual(['gifts', 'daily', '!voting'])
  })
})
