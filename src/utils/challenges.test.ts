import { describe, expect, it } from 'vitest'
import { allFinished, checkedInOn, milestonesPassed, overtaken, parseValue, percent, ranked, series, trackPositions, type ChallengePlayer } from './challenges'

const player = (start: number, goal: number, values: number[] = [], joinedAt = '2026-11-01T12:00:00Z'): ChallengePlayer => ({
  nickname: 'x',
  icon: '🏃',
  color: '#2da44e',
  start,
  goal,
  joinedAt,
  log: values.map((v, i) => ({ at: `2026-11-${String(2 + i).padStart(2, '0')}T12:00:00Z`, v })),
})

describe('family challenges', () => {
  it('measures each person in percent of their own goal, either way', () => {
    expect(percent(player(200, 170, [194]))).toBe(20)
    expect(percent(player(138, 128, [135]))).toBe(30)
    expect(percent(player(0, 500, [250]))).toBe(50) // a goal going up (saving money)
    expect(percent(player(200, 170, [205]))).toBe(0) // no worse than 0
    expect(percent(player(200, 170, [160]))).toBe(100) // no more than 100
  })

  it('ranks, places icons on the track without hiding each other, and spots milestones and overtakes', () => {
    const c = { players: { steve: player(200, 170, [194]), linda: player(138, 128, [135]), cam: player(100, 90, [98]) } }
    expect(ranked(c).map((r) => r.uid)).toEqual(['linda', 'steve', 'cam'])
    // Steve 20%, Cam 20%: close together, so one moves to the next lane.
    expect(trackPositions(c)).toEqual([
      { uid: 'steve', pct: 20, lane: 0 },
      { uid: 'cam', pct: 20, lane: 1 },
      { uid: 'linda', pct: 30, lane: 0 },
    ])
    expect(milestonesPassed(c.players.steve, 194, 184)).toEqual([25, 50])
    expect(milestonesPassed(c.players.steve, 184, 190)).toEqual([])
    expect(overtaken(c, 'steve', 189)).toEqual(['linda', 'cam']) // Cam was level with Steve: moving ahead passes him too
    expect(overtaken(c, 'steve', 193)).toEqual(['cam'])
    expect(overtaken(c, 'linda', 136)).toEqual([])
    expect(allFinished(c)).toBe(false)
    expect(allFinished({ players: { a: player(10, 5, [5]), b: player(0, 2, [3]) } })).toBe(true)
  })

  it('reads check-ins, typed values and graph lines', () => {
    const p = player(200, 170, [195, 192])
    expect(checkedInOn(p, '2026-11-03')).toBe(true)
    expect(checkedInOn(p, '2026-11-20')).toBe(false)
    expect(parseValue('195.4 lb')).toBe(195.4)
    expect(parseValue('1,250')).toBe(1250)
    expect(parseValue('lb')).toBeNull()
    expect(series(p, 'percent', '2026-11-01').map(([, y]) => y)).toEqual([0, 17, 27])
    expect(series(p, 'value', '2026-11-01').map(([, y]) => y)).toEqual([200, 195, 192])
  })
})
