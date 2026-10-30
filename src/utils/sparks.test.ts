import { describe, expect, it } from 'vitest'
import { cleanLadder, daySparks, DEFAULT_LADDER, familySparks, ladderStatus, movesLeft, pickRevealPhoto, totalSparks } from './sparks'

describe('sparks', () => {
  it('gives one per goal met, up to 5, and 2 more for finishing the day', () => {
    expect(daySparks(0, 3)).toBe(0)
    expect(daySparks(1, 3)).toBe(1)
    expect(daySparks(3, 3)).toBe(5)
    expect(daySparks(5, 8)).toBe(5)
    expect(daySparks(8, 8)).toBe(7)
    expect(daySparks(2, 0)).toBe(0)
  })

  it('adds up a person and the family, and counts moves since a reveal began', () => {
    const steve = { '2026-10-28': 4, '2026-10-29': 7, '2026-10-30': 2 }
    expect(totalSparks(steve)).toBe(13)
    expect(totalSparks(steve, '2026-10-29')).toBe(9)
    expect(familySparks({ steve, linda: { '2026-10-30': 5 } })).toBe(18)
    expect(movesLeft(steve, '2026-10-29', 4)).toBe(3 + 9 - 4)
    expect(movesLeft(undefined, '2026-10-29', 10)).toBe(0)
  })

  it('unlocks the ladder by the family total, never spending it', () => {
    const s = ladderStatus(DEFAULT_LADDER, 130)
    expect(s.rewards.filter((r) => r.unlocked).map((r) => r.title)).toEqual(['Ice cream night', 'Movie night'])
    expect(s.next).toMatchObject({ title: 'Weekend outing', toGo: 170 })
    expect(ladderStatus(DEFAULT_LADDER, 5000).next).toBeUndefined()
  })

  it('cleans a typed ladder', () => {
    expect(cleanLadder([{ title: ' Pizza ', sparks: '75' }, { title: '', sparks: 5 }, { title: 'Bad', sparks: 'x' }, { title: 'Zero', sparks: 0 }])).toEqual([{ title: 'Pizza', sparks: 75 }])
  })
})

describe('reveal photo', () => {
  it('picks a top photo not revealed yet, then any new one, then any', () => {
    const photos = [{ id: 'a', top: true }, { id: 'b' }, { id: 'c', top: true }]
    expect(pickRevealPhoto(photos, ['a'], () => 0)).toBe('c')
    expect(pickRevealPhoto(photos, ['a', 'c'], () => 0)).toBe('b')
    expect(pickRevealPhoto(photos, ['a', 'b', 'c'], () => 0.99)).toBe('c')
    expect(pickRevealPhoto([], [], () => 0)).toBeNull()
  })
})
