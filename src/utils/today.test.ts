import { describe, expect, it } from 'vitest'
import { arrangement, DEFAULT_MORE, moreOf, TODAY_SECTIONS } from './today'

describe('arranging Today', () => {
  it('starts with the less-used sections in More…, then follows your arrangement', () => {
    expect([...moreOf({})]).toEqual(DEFAULT_MORE)
    expect(DEFAULT_MORE).toEqual(['gifts', 'lists', 'links', 'projects', 'cards', 'voting', 'invest'])
    expect(moreOf({}).has('games')).toBe(false)
    expect([...moreOf({ todayMore: ['daily'] })].sort()).toEqual(['daily', 'invest', 'voting']) // newly added sections start in More…
    expect([...moreOf({ todayMore: ['!voting', '!invest'] })].filter((s) => !s.startsWith('!'))).toEqual([]) // everything on the main page
    expect(TODAY_SECTIONS.map((s) => s.id)).not.toContain('todo') // To Do always stays
  })

  it('lets Games move between Today and More…', () => {
    const inMore = arrangement(moreOf({}), 'games', true)
    expect(moreOf({ todayMore: inMore }).has('games')).toBe(true)
    const onToday = arrangement(moreOf({ todayMore: inMore }), 'games', false)
    expect(moreOf({ todayMore: onToday }).has('games')).toBe(false)
  })

  it('remembers a newly added section moved to the main page, and back', () => {
    const before = moreOf({ todayMore: ['gifts'] }) // gifts, and voting + invest (new)
    const main = arrangement(before, 'voting', false)
    expect(main).toEqual(['gifts', 'invest', '!voting'])
    expect(moreOf({ todayMore: main }).has('voting')).toBe(false)
    const back = arrangement(moreOf({ todayMore: main }), 'voting', true)
    expect(back).toEqual(['gifts', 'voting', 'invest'])
    // Moving another section keeps the mark.
    expect(arrangement(moreOf({ todayMore: main }), 'daily', true)).toEqual(['gifts', 'daily', 'invest', '!voting'])
  })
})
