import { describe, expect, it } from 'vitest'
import { DEFAULT_MORE, moreOf, TODAY_SECTIONS } from './today'

describe('arranging Today', () => {
  it('starts with the less-used sections in More…, then follows your arrangement', () => {
    expect([...moreOf({})]).toEqual(DEFAULT_MORE)
    expect(DEFAULT_MORE).toEqual(['gifts', 'lists', 'links', 'projects', 'cards'])
    expect([...moreOf({ todayMore: ['daily'] })]).toEqual(['daily'])
    expect([...moreOf({ todayMore: [] })]).toEqual([]) // everything on the main page
    expect(TODAY_SECTIONS.map((s) => s.id)).not.toContain('todo') // To Do always stays
  })
})
