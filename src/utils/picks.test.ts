import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { averageRating, pickOne, rankPicks } from './picks'

const item = (id: string, ratings: Record<string, number>, watched?: string[]) => ({ id, title: id, ratings, watched }) as unknown as Task

describe('pick lists', () => {
  const items = [
    item('crowd-pleaser', { steve: 4, linda: 4, camilla: 4 }),
    item('divisive', { steve: 5, linda: 5, camilla: 1 }),
    item('unknown', {}),
    item('just-watched', { steve: 5, linda: 5, camilla: 5 }, ['2026-10-20']),
    item('watched-in-summer', { steve: 5, linda: 5, camilla: 5 }, ['2026-07-01']),
  ]
  it('favors what nobody dislikes, rests recent ones, and fades the fairly recent', () => {
    const r = rankPicks(items, ['steve', 'linda', 'camilla'], '2026-10-22')
    // A favorite watched in July has mostly faded back (5 − 0.45); last week's is resting.
    expect(r.map((x) => x.item.id)).toEqual(['watched-in-summer', 'crowd-pleaser', 'unknown', 'divisive'])
    expect(r.find((x) => x.item.id === 'divisive')!.score).toBeLessThan(r.find((x) => x.item.id === 'crowd-pleaser')!.score)
    expect(r.find((x) => x.item.id === 'unknown')!.unrated).toEqual(['steve', 'linda', 'camilla'])
  })
  it('only counts the people watching', () => {
    const r = rankPicks(items, ['steve', 'linda'], '2026-10-22')
    expect(r[0].item.id).toBe('divisive') // Camilla's 1 doesn't count when she isn't watching
  })
  it('picks from the top, weighted toward higher scores', () => {
    const r = rankPicks(items, ['steve', 'linda', 'camilla'], '2026-10-22')
    expect(pickOne(r, 3, () => 0)!.item.id).toBe('watched-in-summer')
    expect(pickOne(r, 3, () => 0.999)!.item.id).toBe('unknown') // the third of the top 3
    expect(averageRating(items[1])).toBe(3.7)
  })
})
